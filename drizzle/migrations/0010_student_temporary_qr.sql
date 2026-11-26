-- Create a random server-only secret for each student, without changing the printed fixed QR.
INSERT INTO public.student_qr_secrets (student_id, secret)
SELECT s.id, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
FROM public.students s
ON CONFLICT (student_id) DO NOTHING;
