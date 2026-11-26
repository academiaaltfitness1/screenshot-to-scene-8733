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
BEGIN
  IF _sid IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
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
