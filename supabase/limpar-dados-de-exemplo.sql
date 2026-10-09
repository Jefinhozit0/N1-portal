-- Apaga os dados de exemplo que vieram com o esquema inicial (todos criados no mesmo instante,
-- em 28/09/2026 às 20:40:39 UTC): 5 clientes, 3 chargebacks, 8 vendas e as mensagens deles.
-- NÃO é uma migração: rode só se esses registros forem mesmo de exemplo. Não dá para desfazer,
-- a não ser pelo backup diário do portal (pasta backups/).
--
-- Antes de rodar, confira o que será apagado:
SELECT 'clientes' AS tabela, id, name AS descricao FROM public.clientes WHERE created_at = '2026-09-28 20:40:39.424902+00'
UNION ALL
SELECT 'chargebacks', id, client FROM public.chargebacks WHERE created_at = '2026-09-28 20:40:39.424902+00'
UNION ALL
SELECT 'vendas', id, client FROM public.vendas WHERE created_at = '2026-09-28 20:40:39.424902+00';

-- Para os CLIENTES, prefira o botão "Apagar cliente" no portal: ele também apaga o login do
-- cliente (o Rafael de exemplo tem um) e os arquivos dele. As linhas de clientes abaixo servem
-- só se preferir fazer tudo por aqui.
-- Se a lista estiver certa, selecione as linhas abaixo e rode:
-- DELETE FROM public.mensagens   WHERE client_id IN (SELECT id FROM public.clientes WHERE created_at = '2026-09-28 20:40:39.424902+00');
-- DELETE FROM public.clientes    WHERE created_at = '2026-09-28 20:40:39.424902+00';
-- DELETE FROM public.chargebacks WHERE created_at = '2026-09-28 20:40:39.424902+00';
-- DELETE FROM public.vendas      WHERE created_at = '2026-09-28 20:40:39.424902+00';
