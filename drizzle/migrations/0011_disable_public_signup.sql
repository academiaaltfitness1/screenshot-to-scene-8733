-- Disable unauthenticated public account creation after the first admin exists.
-- Existing staff accounts remain untouched; staff/student accounts are provisioned only by server-side admin.createUser.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _kind text := COALESCE(NEW.raw_app_meta_data->>'kind', '');
BEGIN
  IF _kind = 'student' THEN
    RETURN NEW;
  END IF;

  IF _kind = 'staff' THEN
    INSERT INTO public.profiles (id, full_name, email, cargo)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'cargo', 'Equipe')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Cadastro público desativado. Solicite acesso à recepção.';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, cargo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'Administrador'
  )
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;
