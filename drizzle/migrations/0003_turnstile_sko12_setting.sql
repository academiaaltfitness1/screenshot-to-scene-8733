-- Ativacao independente do teclado USB SKO12 conectado ao computador da recepcao.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS allow_sko12 boolean NOT NULL DEFAULT true;
