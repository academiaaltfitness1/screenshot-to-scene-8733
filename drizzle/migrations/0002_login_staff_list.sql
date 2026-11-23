
CREATE OR REPLACE FUNCTION public.login_staff_list()
RETURNS TABLE (id uuid, full_name text, cargo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.full_name, p.cargo
  FROM public.profiles p
  WHERE p.active AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id)
  ORDER BY p.full_name
$$;
REVOKE EXECUTE ON FUNCTION public.login_staff_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_staff_list() TO anon, authenticated;
