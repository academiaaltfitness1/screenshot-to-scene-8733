ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS allow_face boolean NOT NULL DEFAULT false;
