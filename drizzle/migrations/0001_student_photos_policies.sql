
CREATE POLICY "staff read fotos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'fotos' AND public.is_staff());
CREATE POLICY "alunos upload fotos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos' AND public.can_access('alunos'));
CREATE POLICY "alunos update fotos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'fotos' AND public.can_access('alunos'));
CREATE POLICY "admin delete fotos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fotos' AND public.has_role(auth.uid(), 'admin'));
