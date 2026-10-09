-- Guarda a conversa do cliente com o assistente virtual na tabela de mensagens, para ela
-- continuar lá depois que o cliente sai e entra de novo, inclusive em outro aparelho.
--   assistant         = o que o assistente respondeu
--   assistant_choice  = a opção que o cliente escolheu
-- Essas linhas só aparecem para o próprio cliente. A caixa de atendimento, o dashboard e a
-- contagem de chamados da equipe continuam vendo apenas 'client' e 'team'.

ALTER TABLE public.mensagens DROP CONSTRAINT IF EXISTS mensagens_sender_check;
ALTER TABLE public.mensagens ADD CONSTRAINT mensagens_sender_check
  CHECK (sender IN ('client', 'team', 'assistant', 'assistant_choice'));
