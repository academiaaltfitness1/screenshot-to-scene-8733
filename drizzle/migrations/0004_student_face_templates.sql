-- The content of this migration cannot be applied: its table, columns and policies already exist in the database (policy "catraca read face templates" already exists).
-- -- Habilitacao opcional do reconhecimento facial e armazenamento restrito de templates.
-- ALTER TABLE public.settings
--   ADD COLUMN IF NOT EXISTS allow_face boolean NOT NULL DEFAULT false;

-- CREATE TABLE IF NOT EXISTS public.student_face_templates (
--   student_id uuid PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
--   descriptor jsonb NOT NULL CHECK (jsonb_typeof(descriptor) = 'array'),
--   consent_at timestamptz NOT NULL,
--   consent_text_version text NOT NULL,
--   recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
--   created_at timestamptz NOT NULL DEFAULT now(),
--   updated_at timestamptz NOT NULL DEFAULT now()
-- );

-- COMMENT ON TABLE public.student_face_templates IS
--   'Dados biométricos sensíveis para identificação facial opcional. Acesso limitado a usuários com permissão de catraca.';
-- COMMENT ON COLUMN public.student_face_templates.descriptor IS
--   'Vetor biométrico facial; não é fotografia e deve receber proteção equivalente a dado pessoal sensível.';

-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_face_templates TO authenticated;
-- GRANT ALL ON public.student_face_templates TO service_role;
-- ALTER TABLE public.student_face_templates ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "catraca read face templates" ON public.student_face_templates
--   FOR SELECT TO authenticated USING (public.can_access('catraca'));
-- CREATE POLICY "catraca insert face templates" ON public.student_face_templates
--   FOR INSERT TO authenticated WITH CHECK (public.can_access('catraca'));
-- CREATE POLICY "catraca update face templates" ON public.student_face_templates
--   FOR UPDATE TO authenticated USING (public.can_access('catraca'))
--   WITH CHECK (public.can_access('catraca'));
-- CREATE POLICY "catraca delete face templates" ON public.student_face_templates
--   FOR DELETE TO authenticated USING (public.can_access('catraca'));
SELECT 1;
