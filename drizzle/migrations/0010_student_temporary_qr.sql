-- Create a random server-only secret for each student, without changing the printed fixed QR.
INSERT INTO public.student_qr_secrets (student_id, secret)
SELECT s.id, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
FROM public.students s
ON CONFLICT (student_id) DO NOTHING;

-- Ensure every future student receives a secret automatically.
CREATE OR REPLACE FUNCTION public.ensure_student_qr_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.student_qr_secrets (student_id, secret)
  VALUES (NEW.id, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  ON CONFLICT (student_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_student_qr_secret() FROM PUBLIC;
DROP TRIGGER IF EXISTS on_student_created_qr_secret ON public.students;
CREATE TRIGGER on_student_created_qr_secret
  AFTER INSERT ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.ensure_student_qr_secret();
