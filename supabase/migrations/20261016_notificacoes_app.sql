-- Notificações do aplicativo do portal: cada aparelho em que o cliente ativou os avisos
-- (celular, computador) vira uma linha aqui. O servidor manda por ela os avisos de resposta da
-- equipe, mudança de situação e documento novo. Aparelho que desinstalou ou bloqueou os avisos é
-- apagado sozinho no próximo envio.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.

CREATE TABLE IF NOT EXISTS public.push_inscricoes (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES public.clientes (id) ON DELETE CASCADE,
  -- Endereço do serviço de avisos do navegador (Google, Apple, Mozilla, Microsoft); único por aparelho.
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  -- Ativado de dentro do app instalado (tela inicial / janela própria), não de uma aba do navegador.
  instalado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_envio_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS push_inscricoes_client_id_idx ON public.push_inscricoes (client_id);

-- Só o servidor (chave de serviço) lê e escreve; o navegador nunca acessa a tabela direto.
ALTER TABLE public.push_inscricoes ENABLE ROW LEVEL SECURITY;

-- Confere: deve mostrar a tabela com 0 linhas.
SELECT COUNT(*) AS aparelhos FROM public.push_inscricoes;
