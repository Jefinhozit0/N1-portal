-- Documentos, progresso e linha do tempo de cada cliente, salvos de verdade.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.

-- Data real da última atualização (mesmo conteúdo de 20261008_clientes_atualizado_em.sql,
-- repetido aqui para quem ainda não rodou aquele arquivo).
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ;
UPDATE public.clientes SET atualizado_em = created_at WHERE atualizado_em IS NULL;
ALTER TABLE public.clientes ALTER COLUMN atualizado_em SET DEFAULT NOW();
ALTER TABLE public.clientes ALTER COLUMN atualizado_em SET NOT NULL;

-- Progresso do caso, de 0 a 100. Cliente novo começa em 0.
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS progresso INT NOT NULL DEFAULT 0;
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_progresso_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_progresso_check CHECK (progresso BETWEEN 0 AND 100);

-- Documentos: o arquivo fica no Storage (pasta privada "documentos"), aqui fica o registro.
CREATE TABLE IF NOT EXISTS public.documentos (
  id           BIGSERIAL PRIMARY KEY,
  client_id    BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  descricao    TEXT,
  tamanho      BIGINT NOT NULL,
  tipo         TEXT,
  caminho      TEXT NOT NULL UNIQUE,
  enviado_por  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS documentos_client_id_idx ON public.documentos (client_id);

-- Linha do tempo do processo.
CREATE TABLE IF NOT EXISTS public.cliente_eventos (
  id          BIGSERIAL PRIMARY KEY,
  client_id   BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('cadastro', 'status', 'progresso', 'documento')),
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  autor       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS cliente_eventos_client_id_idx ON public.cliente_eventos (client_id);

-- Só o servidor (service role key) lê e grava. Nenhuma política para anon.
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_eventos ENABLE ROW LEVEL SECURITY;

-- Clientes que já existiam ganham o evento de cadastro na data em que foram criados.
INSERT INTO public.cliente_eventos (client_id, tipo, titulo, descricao, created_at)
SELECT c.id, 'cadastro', 'Cadastro realizado',
       CASE WHEN c.type IS NULL OR c.type = '' THEN 'Início do processo' ELSE 'Início do processo: ' || c.type END,
       c.created_at
FROM public.clientes c
WHERE NOT EXISTS (SELECT 1 FROM public.cliente_eventos e WHERE e.client_id = c.id AND e.tipo = 'cadastro');

-- Pasta privada dos arquivos, com limite de 10 MB por arquivo.
-- Os arquivos só saem por links temporários gerados pelo servidor.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documentos', 'documentos', false, 10485760)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760;
