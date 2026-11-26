ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS dynamic_qr_enabled boolean NOT NULL DEFAULT false;
UPDATE public.settings SET dynamic_qr_enabled = false WHERE dynamic_qr_enabled IS NULL;
