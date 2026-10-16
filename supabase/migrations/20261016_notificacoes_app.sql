-- Notificações do aplicativo do portal: cada aparelho (celular, computador) em que alguém ativou
-- os avisos vira uma linha aqui.
--   Cliente (client_id): avisos de resposta da equipe, mudança de situação e documento novo.
--   Equipe (staff_email): aviso quando um cliente manda mensagem no portal.
-- Aparelho que desinstalou ou bloqueou os avisos é apagado sozinho no próximo envio.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema (inclusive por cima da
-- primeira versão deste arquivo, que só tinha clientes).

CREATE TABLE IF NOT EXISTS public.push_inscricoes (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT REFERENCES public.clientes (id) ON DELETE CASCADE,
  staff_email TEXT,
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

-- Quem rodou a primeira versão: abre a tabela também para a equipe.
ALTER TABLE public.push_inscricoes ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.push_inscricoes ADD COLUMN IF NOT EXISTS staff_email TEXT;

-- Cada aparelho é de um cliente ou de alguém da equipe, nunca dos dois.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_inscricoes_dono') THEN
    ALTER TABLE public.push_inscricoes ADD CONSTRAINT push_inscricoes_dono CHECK ((client_id IS NULL) <> (staff_email IS NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS push_inscricoes_client_id_idx ON public.push_inscricoes (client_id);
CREATE INDEX IF NOT EXISTS push_inscricoes_staff_email_idx ON public.push_inscricoes (staff_email);

-- Só o servidor (chave de serviço) lê e escreve; o navegador nunca acessa a tabela direto.
ALTER TABLE public.push_inscricoes ENABLE ROW LEVEL SECURITY;

-- Confere: deve mostrar quantos aparelhos de clientes e da equipe já existem (0 e 0 na primeira vez).
SELECT COUNT(client_id) AS aparelhos_clientes, COUNT(staff_email) AS aparelhos_equipe FROM public.push_inscricoes;
