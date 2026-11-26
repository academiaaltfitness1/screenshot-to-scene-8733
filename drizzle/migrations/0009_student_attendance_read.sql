-- Allow a student account to read only its own attendance records.
DROP POLICY IF EXISTS "aluno le propria frequencia" ON public.attendance;
CREATE POLICY "aluno le propria frequencia" ON public.attendance
  FOR SELECT TO authenticated
  USING (student_id = public.current_student_id());
