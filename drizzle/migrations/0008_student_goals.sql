-- ALT ALUNO goals: instructor-managed weekly targets and durable goal-reached events.
DROP POLICY IF EXISTS "equipe gerencia metas" ON public.student_goals;
CREATE POLICY "equipe gerencia metas" ON public.student_goals
  FOR ALL TO authenticated
  USING (public.can_access('treinos') OR public.can_access('alunos'))
  WITH CHECK (public.can_access('treinos') OR public.can_access('alunos'));

CREATE TABLE IF NOT EXISTS public.student_goal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  target_sessions integer NOT NULL,
  completed_sessions integer NOT NULL,
  reached_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, week_start)
);
GRANT SELECT ON public.student_goal_events TO authenticated;
GRANT ALL ON public.student_goal_events TO service_role;
ALTER TABLE public.student_goal_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aluno le proprios eventos de meta" ON public.student_goal_events;
CREATE POLICY "aluno le proprios eventos de meta" ON public.student_goal_events
  FOR SELECT TO authenticated USING (student_id = public.current_student_id());
DROP POLICY IF EXISTS "equipe le eventos de meta" ON public.student_goal_events;
CREATE POLICY "equipe le eventos de meta" ON public.student_goal_events
  FOR SELECT TO authenticated USING (public.can_access('treinos') OR public.can_access('alunos'));

CREATE OR REPLACE FUNCTION public.record_student_goal_reached()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target integer;
  _week_start date;
  _completed integer;
BEGIN
  IF NEW.status <> 'concluido' OR OLD.status = 'concluido' OR NEW.finished_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT weekly_sessions INTO _target
  FROM public.student_goals WHERE student_id = NEW.student_id;
  IF _target IS NULL OR _target < 1 THEN RETURN NEW; END IF;

  _week_start := date_trunc('week', NEW.finished_at)::date;
  SELECT count(*)::integer INTO _completed
  FROM public.workout_sessions
  WHERE student_id = NEW.student_id
    AND status = 'concluido'
    AND finished_at >= _week_start
    AND finished_at < (_week_start + 7);

  IF _completed >= _target THEN
    INSERT INTO public.student_goal_events (student_id, week_start, target_sessions, completed_sessions)
    VALUES (NEW.student_id, _week_start, _target, _completed)
    ON CONFLICT (student_id, week_start) DO UPDATE
      SET completed_sessions = GREATEST(student_goal_events.completed_sessions, EXCLUDED.completed_sessions);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_student_goal_progress ON public.workout_sessions;
CREATE TRIGGER on_student_goal_progress
  AFTER UPDATE OF status ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.record_student_goal_reached();
