
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS dashboard_mascot_url text;

CREATE TABLE public.student_accounts (
  user_id uuid PRIMARY KEY,
  student_id uuid NOT NULL UNIQUE REFERENCES public.students(id) ON DELETE CASCADE,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_accounts TO authenticated;
GRANT ALL ON public.student_accounts TO service_role;
ALTER TABLE public.student_accounts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_id FROM public.student_accounts
  WHERE user_id = auth.uid() AND (email_verified_at IS NOT NULL OR phone_verified_at IS NOT NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.current_student_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated, service_role;

CREATE POLICY "own student account" ON public.student_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "staff read student accounts" ON public.student_accounts FOR SELECT TO authenticated USING (public.can_access('alunos'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.raw_app_meta_data->>'kind', '') = 'student' THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.profiles (id, full_name, email, cargo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NEW.email,
          CASE WHEN NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN 'Administrador' ELSE 'Recepção' END)
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.student_activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.student_activation_codes (student_id);
GRANT ALL ON public.student_activation_codes TO service_role;
ALTER TABLE public.student_activation_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.student_auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  kind text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.student_auth_attempts (key, created_at DESC);
GRANT ALL ON public.student_auth_attempts TO service_role;
ALTER TABLE public.student_auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.student_qr_secrets (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.student_qr_secrets TO service_role;
ALTER TABLE public.student_qr_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aluno le proprios treinos" ON public.workouts FOR SELECT TO authenticated
  USING (active AND student_id = public.current_student_id());
CREATE POLICY "aluno le proprios exercicios" ON public.workout_exercises FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id AND w.active AND w.student_id = public.current_student_id()));
CREATE POLICY "aluno le proprias mensalidades" ON public.receivables FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());
CREATE POLICY "aluno le proprias matriculas" ON public.enrollments FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());
CREATE POLICY "aluno le proprias avaliacoes" ON public.assessments FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());

CREATE OR REPLACE FUNCTION public.aluno_me()
RETURNS TABLE (id uuid, matricula integer, name text, status text, photo_url text, valid_until date, overdue_since date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.matricula, s.name, s.status, s.photo_url,
    (SELECT max(e.end_date) FROM public.enrollments e WHERE e.student_id = s.id AND e.status = 'ativa'),
    (SELECT min(r.due_date) FROM public.receivables r WHERE r.student_id = s.id AND r.paid_at IS NULL)
  FROM public.students s WHERE s.id = public.current_student_id()
$$;
REVOKE EXECUTE ON FUNCTION public.aluno_me() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_me() TO authenticated;

CREATE OR REPLACE FUNCTION public.aluno_pix()
RETURNS TABLE (gym_name text, pix_key text, phone text, tolerance_days integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT st.gym_name, st.pix_key, st.phone, st.tolerance_days FROM public.settings st
  WHERE st.id = 1 AND public.current_student_id() IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.aluno_pix() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_pix() TO authenticated;

CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  workout_id uuid REFERENCES public.workouts(id) ON DELETE SET NULL,
  letter text NOT NULL,
  workout_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluido', 'cancelado')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX ON public.workout_sessions (student_id, started_at DESC);
GRANT SELECT ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno le proprias execucoes" ON public.workout_sessions FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());
CREATE POLICY "equipe le execucoes" ON public.workout_sessions FOR SELECT TO authenticated
  USING (public.can_access('treinos'));

CREATE TABLE public.workout_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.workout_exercises(id) ON DELETE SET NULL,
  exercise_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  set_number integer NOT NULL DEFAULT 1,
  load numeric(7,2),
  reps integer,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'concluido' CHECK (status IN ('concluido', 'pulado')),
  skip_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, sort_order, set_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_set_logs TO authenticated;
GRANT ALL ON public.workout_set_logs TO service_role;
ALTER TABLE public.workout_set_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno le proprios registros" ON public.workout_set_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND ws.student_id = public.current_student_id()));
CREATE POLICY "equipe le registros" ON public.workout_set_logs FOR SELECT TO authenticated
  USING (public.can_access('treinos'));
CREATE POLICY "aluno registra em treino aberto" ON public.workout_set_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND ws.student_id = public.current_student_id() AND ws.status = 'em_andamento'));
CREATE POLICY "aluno corrige em treino aberto" ON public.workout_set_logs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND ws.student_id = public.current_student_id() AND ws.status = 'em_andamento'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND ws.student_id = public.current_student_id() AND ws.status = 'em_andamento'));
CREATE POLICY "aluno remove em treino aberto" ON public.workout_set_logs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND ws.student_id = public.current_student_id() AND ws.status = 'em_andamento'));

CREATE TABLE public.student_training_state (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  next_letter text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_training_state TO authenticated;
GRANT ALL ON public.student_training_state TO service_role;
ALTER TABLE public.student_training_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno le propria sequencia" ON public.student_training_state FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());
CREATE POLICY "equipe le sequencia" ON public.student_training_state FOR SELECT TO authenticated
  USING (public.can_access('treinos'));

CREATE OR REPLACE FUNCTION public.aluno_start_session(_workout_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := public.current_student_id(); _w public.workouts%ROWTYPE; _id uuid;
BEGIN
  IF _sid IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO _w FROM public.workouts WHERE id = _workout_id AND student_id = _sid AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Treino não encontrado'; END IF;
  SELECT id INTO _id FROM public.workout_sessions WHERE student_id = _sid AND workout_id = _workout_id AND status = 'em_andamento' ORDER BY started_at DESC LIMIT 1;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  UPDATE public.workout_sessions SET status = 'cancelado', finished_at = now() WHERE student_id = _sid AND status = 'em_andamento';
  INSERT INTO public.workout_sessions (student_id, workout_id, letter, workout_name) VALUES (_sid, _w.id, _w.letter, _w.name) RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.aluno_start_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_start_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.aluno_finish_session(_session_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid := public.current_student_id(); _letter text; _next text;
BEGIN
  IF _sid IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  UPDATE public.workout_sessions SET status = 'concluido', finished_at = now()
    WHERE id = _session_id AND student_id = _sid AND status = 'em_andamento' RETURNING letter INTO _letter;
  IF _letter IS NULL THEN RAISE EXCEPTION 'Treino não está em andamento'; END IF;
  SELECT min(letter) INTO _next FROM public.workouts WHERE student_id = _sid AND active AND letter > _letter;
  IF _next IS NULL THEN SELECT min(letter) INTO _next FROM public.workouts WHERE student_id = _sid AND active; END IF;
  INSERT INTO public.student_training_state (student_id, next_letter) VALUES (_sid, COALESCE(_next, _letter))
    ON CONFLICT (student_id) DO UPDATE SET next_letter = EXCLUDED.next_letter, updated_at = now();
  RETURN COALESCE(_next, _letter);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.aluno_finish_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_finish_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.aluno_cancel_session(_session_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.workout_sessions SET status = 'cancelado', finished_at = now()
  WHERE id = _session_id AND student_id = public.current_student_id() AND status = 'em_andamento'
$$;
REVOKE EXECUTE ON FUNCTION public.aluno_cancel_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_cancel_session(uuid) TO authenticated;

CREATE TABLE public.student_goals (
  student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  weekly_sessions integer CHECK (weekly_sessions BETWEEN 1 AND 14),
  target_weight numeric(6,2),
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.student_goals TO authenticated;
GRANT ALL ON public.student_goals TO service_role;
ALTER TABLE public.student_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno le propria meta" ON public.student_goals FOR SELECT TO authenticated USING (student_id = public.current_student_id());
CREATE POLICY "equipe le metas" ON public.student_goals FOR SELECT TO authenticated USING (public.can_access('treinos') OR public.can_access('avaliacao'));
CREATE POLICY "aluno cria propria meta" ON public.student_goals FOR INSERT TO authenticated WITH CHECK (student_id = public.current_student_id());
CREATE POLICY "aluno altera propria meta" ON public.student_goals FOR UPDATE TO authenticated USING (student_id = public.current_student_id()) WITH CHECK (student_id = public.current_student_id());

CREATE TABLE public.payment_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id uuid NOT NULL REFERENCES public.receivables(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.payment_proofs (receivable_id);
CREATE INDEX ON public.payment_proofs (student_id);
GRANT SELECT, INSERT, UPDATE ON public.payment_proofs TO authenticated;
GRANT ALL ON public.payment_proofs TO service_role;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno le proprios comprovantes" ON public.payment_proofs FOR SELECT TO authenticated USING (student_id = public.current_student_id());
CREATE POLICY "aluno envia comprovante" ON public.payment_proofs FOR INSERT TO authenticated
  WITH CHECK (student_id = public.current_student_id() AND status = 'pendente' AND reviewed_by IS NULL AND reviewed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.receivables r WHERE r.id = receivable_id AND r.student_id = public.current_student_id()));
CREATE POLICY "equipe le comprovantes" ON public.payment_proofs FOR SELECT TO authenticated USING (public.can_access('receber'));
CREATE POLICY "equipe revisa comprovantes" ON public.payment_proofs FOR UPDATE TO authenticated USING (public.can_access('receber')) WITH CHECK (public.can_access('receber'));

CREATE POLICY "aluno envia arquivo de comprovante" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprovantes' AND (storage.foldername(name))[1] = public.current_student_id()::text);
CREATE POLICY "aluno le arquivo de comprovante" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprovantes' AND (storage.foldername(name))[1] = public.current_student_id()::text);
CREATE POLICY "equipe le arquivo de comprovante" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprovantes' AND public.can_access('receber'));

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "equipe le comunicados" ON public.announcements FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "aluno le comunicados vigentes" ON public.announcements FOR SELECT TO authenticated
  USING (public.current_student_id() IS NOT NULL AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "comunicados insert" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.can_access('comunicados'));
CREATE POLICY "comunicados update" ON public.announcements FOR UPDATE TO authenticated USING (public.can_access('comunicados')) WITH CHECK (public.can_access('comunicados'));
CREATE POLICY "admin delete comunicados" ON public.announcements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, student_id)
);
GRANT SELECT, INSERT ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aluno le proprias leituras" ON public.announcement_reads FOR SELECT TO authenticated USING (student_id = public.current_student_id());
CREATE POLICY "aluno marca leitura" ON public.announcement_reads FOR INSERT TO authenticated WITH CHECK (student_id = public.current_student_id());
CREATE POLICY "equipe le leituras" ON public.announcement_reads FOR SELECT TO authenticated USING (public.can_access('comunicados'));
