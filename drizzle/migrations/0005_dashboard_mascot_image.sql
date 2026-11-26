-- The content of this migration cannot be applied: it writes to storage.buckets, which migrations may not do. Its column and policies are re-applied by a later migration; the bucket is created through the storage tool.
-- ALTER TABLE public.settings
--   ADD COLUMN IF NOT EXISTS dashboard_mascot_url text;

-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'dashboard-assets',
--   'dashboard-assets',
--   true,
--   5242880,
--   ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
-- )
-- ON CONFLICT (id) DO UPDATE SET
--   public = EXCLUDED.public,
--   file_size_limit = EXCLUDED.file_size_limit,
--   allowed_mime_types = EXCLUDED.allowed_mime_types;

-- CREATE POLICY "dashboard image upload"
-- ON storage.objects FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'dashboard-assets' AND public.can_access('sistema'));

-- CREATE POLICY "dashboard image update"
-- ON storage.objects FOR UPDATE TO authenticated
-- USING (bucket_id = 'dashboard-assets' AND public.can_access('sistema'))
-- WITH CHECK (bucket_id = 'dashboard-assets' AND public.can_access('sistema'));

-- CREATE POLICY "dashboard image delete"
-- ON storage.objects FOR DELETE TO authenticated
-- USING (bucket_id = 'dashboard-assets' AND public.can_access('sistema'));
SELECT 1;
