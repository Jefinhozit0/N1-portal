-- Fecha o acesso direto às tabelas pela chave pública (anon), que vai junto no site.
-- As políticas "Allow all" deixavam qualquer pessoa ler, alterar e apagar todos os dados
-- pela API do Supabase, sem passar pelo portal.
--
-- O portal não perde nada: o servidor usa a service role key, que ignora o RLS, e o navegador
-- não lê as tabelas diretamente. Com o RLS ligado e sem políticas, só o servidor acessa os dados.

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chargebacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all clientes" ON public.clientes;
DROP POLICY IF EXISTS "Allow all chargebacks" ON public.chargebacks;
DROP POLICY IF EXISTS "Allow all vendas" ON public.vendas;
DROP POLICY IF EXISTS "Allow all mensagens" ON public.mensagens;

-- Confere: deve listar as 4 tabelas com rowsecurity = true e nenhuma política.
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('clientes', 'chargebacks', 'vendas', 'mensagens');
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
