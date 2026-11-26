-- Add optional image/video attachments to student announcements.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IS NULL OR media_type IN ('image', 'video'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('comunicados', 'comunicados', false, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "staff upload announcement media" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'comunicados' AND public.can_access('comunicados')
  );
CREATE POLICY "staff read announcement media" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'comunicados' AND public.can_access('comunicados')
  );
CREATE POLICY "students read published announcement media" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'comunicados'
    AND public.current_student_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.media_path = name AND a.starts_at <= now()
        AND (a.ends_at IS NULL OR a.ends_at > now())
    )
  );
CREATE POLICY "staff delete announcement media" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'comunicados' AND public.can_access('comunicados')
  );
