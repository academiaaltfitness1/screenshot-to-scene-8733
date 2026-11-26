-- Additive ALT ALUNO hardening: private proof bucket and server-enforced workout sequence.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('comprovantes', 'comprovantes', false, 5242880, ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','application/pdf'];

CREATE OR REPLACE FUNCTION public.aluno_start_session(_workout_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := public.current_student_id();
  _w public.workouts%ROWTYPE;
  _id uuid;
  _expected text;
  _student_status text;
  _valid_until date;
  _overdue_since date;
  _tolerance integer;
  _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF _sid IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_sid::text));

  -- Financial/access restriction: keep the portal and all history readable,
  -- but do not allow a new workout after the configured grace period.
  SELECT s.status,
    (SELECT max(e.end_date) FROM public.enrollments e WHERE e.student_id = s.id AND e.status = 'ativa'),
    (SELECT min(r.due_date) FROM public.receivables r WHERE r.student_id = s.id AND r.paid_at IS NULL),
    COALESCE((SELECT st.tolerance_days FROM public.settings st WHERE st.id = 1), 5)
  INTO _student_status, _valid_until, _overdue_since, _tolerance
  FROM public.students s WHERE s.id = _sid;

  IF _student_status IS DISTINCT FROM 'ativo' THEN
    RAISE EXCEPTION 'Acesso aos treinos indisponível. Procure a recepção.';
  END IF;
  IF _valid_until IS NULL OR _today > (_valid_until + _tolerance) THEN
    RAISE EXCEPTION 'Mensalidade ou matrícula vencida. Regularize na recepção para iniciar treinos.';
  END IF;
  IF _overdue_since IS NOT NULL AND _today > (_overdue_since + _tolerance) THEN
    RAISE EXCEPTION 'Existe mensalidade em atraso. Regularize na recepção para iniciar treinos.';
  END IF;

  SELECT * INTO _w FROM public.workouts
    WHERE id = _workout_id AND student_id = _sid AND active
    FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Treino não encontrado'; END IF;

  SELECT id INTO _id FROM public.workout_sessions
    WHERE student_id = _sid AND workout_id = _workout_id AND status = 'em_andamento'
    ORDER BY started_at DESC LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;

  IF EXISTS (SELECT 1 FROM public.workout_sessions
    WHERE student_id = _sid AND status = 'em_andamento') THEN
    RAISE EXCEPTION 'Conclua ou cancele o treino em andamento antes de iniciar outro.';
  END IF;

  SELECT next_letter INTO _expected FROM public.student_training_state WHERE student_id = _sid;
  IF _expected IS NULL THEN
    SELECT min(letter) INTO _expected FROM public.workouts WHERE student_id = _sid AND active;
  END IF;
  IF _expected IS NULL OR _w.letter <> _expected THEN
    RAISE EXCEPTION 'A sequência atual exige o treino %.', COALESCE(_expected, 'inicial');
  END IF;

  INSERT INTO public.workout_sessions (student_id, workout_id, letter, workout_name)
  VALUES (_sid, _w.id, _w.letter, _w.name)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.aluno_start_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_start_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.aluno_finish_session(_session_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid := public.current_student_id();
  _workout_id uuid;
  _letter text;
  _next text;
BEGIN
  IF _sid IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT workout_id, letter INTO _workout_id, _letter
  FROM public.workout_sessions
  WHERE id = _session_id AND student_id = _sid AND status = 'em_andamento'
  FOR UPDATE;
  IF _letter IS NULL THEN RAISE EXCEPTION 'Treino não está em andamento'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.workout_exercises WHERE workout_id = _workout_id) THEN
    RAISE EXCEPTION 'Este treino ainda não possui exercícios cadastrados.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.workout_exercises e
    WHERE e.workout_id = _workout_id
      AND NOT EXISTS (
        SELECT 1 FROM public.workout_set_logs l
        WHERE l.session_id = _session_id AND l.exercise_id = e.id
      )
  ) THEN
    RAISE EXCEPTION 'Registre as séries de todos os exercícios antes de concluir o treino.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workout_set_logs l
    WHERE l.session_id = _session_id
      AND l.status = 'pulado'
      AND NULLIF(trim(l.skip_reason), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Informe o motivo de cada exercício pulado antes de concluir o treino.';
  END IF;

  UPDATE public.workout_sessions SET status = 'concluido', finished_at = now()
  WHERE id = _session_id AND student_id = _sid AND status = 'em_andamento';

  SELECT min(letter) INTO _next FROM public.workouts
    WHERE student_id = _sid AND active AND letter > _letter;
  IF _next IS NULL THEN
    SELECT min(letter) INTO _next FROM public.workouts WHERE student_id = _sid AND active;
  END IF;
  INSERT INTO public.student_training_state (student_id, next_letter)
  VALUES (_sid, COALESCE(_next, _letter))
  ON CONFLICT (student_id) DO UPDATE
    SET next_letter = EXCLUDED.next_letter, updated_at = now();
  RETURN COALESCE(_next, _letter);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.aluno_finish_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_finish_session(uuid) TO authenticated;

-- Atomic staff review: approval and receivable settlement happen in one transaction.
CREATE OR REPLACE FUNCTION public.review_student_payment_proof(
  _proof_id uuid,
  _approved boolean,
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proof public.payment_proofs%ROWTYPE;
  _amount numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_access('receber') THEN
    RAISE EXCEPTION 'Sem permissão para revisar comprovantes.';
  END IF;
  SELECT * INTO _proof FROM public.payment_proofs
    WHERE id = _proof_id AND status = 'pendente'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comprovante não encontrado ou já revisado.'; END IF;

  IF _approved THEN
    SELECT amount INTO _amount FROM public.receivables
      WHERE id = _proof.receivable_id AND student_id = _proof.student_id AND paid_at IS NULL
      FOR UPDATE;
    IF _amount IS NULL THEN RAISE EXCEPTION 'Lançamento já pago ou não encontrado.'; END IF;
    UPDATE public.receivables
      SET paid_at = now(), paid_amount = _amount, payment_method = 'Pix (comprovante)'
      WHERE id = _proof.receivable_id;
  END IF;

  UPDATE public.payment_proofs
    SET status = CASE WHEN _approved THEN 'aprovado' ELSE 'recusado' END,
        note = NULLIF(trim(COALESCE(_note, '')), ''),
        reviewed_by = auth.uid(), reviewed_at = now()
    WHERE id = _proof_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.review_student_payment_proof(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_student_payment_proof(uuid, boolean, text) TO authenticated;

-- Mark app accounts verified only after Supabase Auth confirms the email OTP.
CREATE OR REPLACE FUNCTION public.mark_student_email_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    UPDATE public.student_accounts
      SET email_verified_at = COALESCE(email_verified_at, NEW.email_confirmed_at)
      WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_student_email_verified() FROM PUBLIC;
DROP TRIGGER IF EXISTS on_student_email_confirmed ON auth.users;
CREATE TRIGGER on_student_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.mark_student_email_verified();
