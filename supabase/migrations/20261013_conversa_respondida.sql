-- "Marcar como respondida" no Atendimento: guarda quando a equipe marcou a conversa do cliente
-- como resolvida sem mandar mensagem. Mensagens do cliente até esse momento deixam de contar como
-- "aguardando resposta"; uma mensagem nova depois disso volta a contar.

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS conversa_respondida_em TIMESTAMPTZ;
