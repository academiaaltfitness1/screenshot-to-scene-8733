GRANT EXECUTE ON FUNCTION public.mark_student_email_verified() TO supabase_auth_admin, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_student_qr_secret() TO authenticated, service_role;
