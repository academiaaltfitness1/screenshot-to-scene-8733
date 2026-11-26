DROP POLICY IF EXISTS "aluno le proprios treinos" ON public.workouts;
CREATE POLICY "aluno le proprios treinos" ON public.workouts FOR SELECT TO authenticated
  USING (student_id = public.current_student_id() AND (active OR EXISTS (
    SELECT 1 FROM public.workout_sessions ws
    WHERE ws.workout_id = workouts.id AND ws.student_id = public.current_student_id() AND ws.status = 'em_andamento'
  )));
DROP POLICY IF EXISTS "aluno le proprios exercicios" ON public.workout_exercises;
CREATE POLICY "aluno le proprios exercicios" ON public.workout_exercises FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.workouts w
    WHERE w.id = workout_id AND w.student_id = public.current_student_id()
      AND (w.active OR EXISTS (
        SELECT 1 FROM public.workout_sessions ws
        WHERE ws.workout_id = w.id AND ws.student_id = public.current_student_id() AND ws.status = 'em_andamento'
      ))
  ));
