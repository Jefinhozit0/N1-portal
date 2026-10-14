-- Chargebacks com os mesmos campos da planilha "CHARGE BACK": datas da venda e da contestação,
-- valor, consultores do comercial e do jurídico, reversão e observações.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.

ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS data_venda DATE;
ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS data_contestacao DATE;
ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS valor NUMERIC(12, 2);
ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS comercial TEXT;
ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS juridico TEXT;
ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS reversao TEXT;      -- texto livre da coluna REVERSÃO
ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS observacoes TEXT;

CREATE INDEX IF NOT EXISTS chargebacks_data_contestacao_idx ON public.chargebacks (data_contestacao DESC);

-- Confere: deve listar as colunas novas.
SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chargebacks' ORDER BY ordinal_position;
