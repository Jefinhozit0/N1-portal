-- Real "last update" date for each client, used by the dashboard
-- (Ociosos 10+ dias, Sem atualização 15d) and by the "Atualização" column.
-- Run once in the Supabase SQL Editor. Safe to run again.
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ;
UPDATE public.clientes SET atualizado_em = created_at WHERE atualizado_em IS NULL;
ALTER TABLE public.clientes ALTER COLUMN atualizado_em SET DEFAULT NOW();
ALTER TABLE public.clientes ALTER COLUMN atualizado_em SET NOT NULL;
