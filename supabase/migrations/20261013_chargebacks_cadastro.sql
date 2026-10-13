-- Cadastro e edição de chargebacks pelo portal: ligação com o cliente e com a venda,
-- observações, data da última alteração e histórico de quem mudou o quê.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.

ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES public.clientes (id) ON DELETE SET NULL;
ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS venda_id BIGINT REFERENCES public.vendas (id) ON DELETE SET NULL;
ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS observacao TEXT;
ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT NOW();
-- Lista de { at, autor, acao }, a mais recente por último.
ALTER TABLE public.chargebacks ADD COLUMN IF NOT EXISTS historico JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS chargebacks_cliente_id_idx ON public.chargebacks (cliente_id);
CREATE INDEX IF NOT EXISTS chargebacks_venda_id_idx ON public.chargebacks (venda_id);

-- Confere: deve listar as 5 colunas novas.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'chargebacks'
  AND column_name IN ('cliente_id', 'venda_id', 'observacao', 'atualizado_em', 'historico');
