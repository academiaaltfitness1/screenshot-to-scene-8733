-- Add optional image/video attachments to student announcements.
-- Idempotent because this migration was also applied directly to the linked Lovable database.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS media_path text,
  ADD COLUMN IF NOT EXISTS media_type text CHECK (media_type IS NULL OR media_type IN ('image', 'video'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('comunicados', 'comunicados', false, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='staff upload announcement media') THEN
    CREATE POLICY "staff upload announcement media" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'comunicados' AND public.can_access('comunicados')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='staff read announcement media') THEN
    CREATE POLICY "staff read announcement media" ON storage.objects
      FOR SELECT TO authenticated USING (
        bucket_id = 'comunicados' AND public.can_access('comunicados')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='students read published announcement media') THEN
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
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='staff delete announcement media') THEN
    CREATE POLICY "staff delete announcement media" ON storage.objects
      FOR DELETE TO authenticated USING (
        bucket_id = 'comunicados' AND public.can_access('comunicados')
      );
  END IF;
END $$;
