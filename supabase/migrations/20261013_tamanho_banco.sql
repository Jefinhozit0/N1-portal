-- Tamanho real do banco, para o painel "Uso do Supabase" na Administração.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.
-- Sem esta função o painel mostra só uma estimativa.

CREATE OR REPLACE FUNCTION public.tamanho_banco()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pg_database_size(current_database()) $$;

-- Só o servidor do portal (chave secreta) pode chamar.
REVOKE ALL ON FUNCTION public.tamanho_banco() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tamanho_banco() TO service_role;

-- Confere: mostra o tamanho atual.
SELECT pg_size_pretty(public.tamanho_banco()) AS tamanho_do_banco;
