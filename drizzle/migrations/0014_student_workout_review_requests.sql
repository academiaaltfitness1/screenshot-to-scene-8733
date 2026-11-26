CREATE TABLE IF NOT EXISTS public.student_workout_review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  note text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','atendido','cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);
CREATE INDEX IF NOT EXISTS student_workout_review_requests_pending_idx ON public.student_workout_review_requests(status,created_at DESC);
GRANT SELECT,INSERT,UPDATE ON public.student_workout_review_requests TO authenticated;
GRANT ALL ON public.student_workout_review_requests TO service_role;
ALTER TABLE public.student_workout_review_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aluno cria pedido de revisao" ON public.student_workout_review_requests;
CREATE POLICY "aluno cria pedido de revisao" ON public.student_workout_review_requests FOR INSERT TO authenticated
  WITH CHECK (student_id=public.current_student_id() AND status='pendente');
DROP POLICY IF EXISTS "aluno le proprios pedidos de revisao" ON public.student_workout_review_requests;
CREATE POLICY "aluno le proprios pedidos de revisao" ON public.student_workout_review_requests FOR SELECT TO authenticated
  USING (student_id=public.current_student_id());
DROP POLICY IF EXISTS "equipe le pedidos de revisao" ON public.student_workout_review_requests;
CREATE POLICY "equipe le pedidos de revisao" ON public.student_workout_review_requests FOR SELECT TO authenticated
  USING (public.can_access('treinos') OR public.can_access('alunos'));
DROP POLICY IF EXISTS "equipe atualiza pedidos de revisao" ON public.student_workout_review_requests;
CREATE POLICY "equipe atualiza pedidos de revisao" ON public.student_workout_review_requests FOR UPDATE TO authenticated
  USING (public.can_access('treinos') OR public.can_access('alunos'))
  WITH CHECK (public.can_access('treinos') OR public.can_access('alunos'));
