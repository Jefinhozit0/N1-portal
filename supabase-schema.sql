-- =============================================================================
-- N1 Portal - Supabase Schema
-- Execute este SQL no Supabase SQL Editor (https://supabase.com/dashboard/project/dnxianxtbxyqhvaliinj/sql)
-- =============================================================================

-- ----------------------------------------
-- Clientes (casos jurídicos)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  cpf         TEXT,
  type        TEXT,                          -- Tipo do processo (ex: Revisão de juros)
  status      TEXT,                          -- Status atual do processo
  updated     TEXT,                          -- Data/hora da última atualização (texto livre)
  tone        TEXT CHECK (tone IN ('green', 'yellow', 'red')) DEFAULT 'green',
  email       TEXT,
  phone       TEXT,
  services    TEXT[],                        -- Array de serviços contratados
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  atualizado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL -- Última atualização do processo (usada no dashboard)
);

-- ----------------------------------------
-- Chargebacks
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.chargebacks (
  id          BIGSERIAL PRIMARY KEY,
  client      TEXT NOT NULL,
  bank        TEXT,
  amount      TEXT,                          -- Valor formatado (ex: R$ 8.420,55)
  deadline    TEXT,                          -- Prazo formatado
  status      TEXT,
  tone        TEXT DEFAULT 'blue',
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------
-- Sales Hub (vendas)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.vendas (
  id           BIGSERIAL PRIMARY KEY,
  date         TEXT NOT NULL,               -- Data da venda (dd/mm/yyyy)
  client       TEXT NOT NULL,
  phone        TEXT,
  consultants  TEXT[],                      -- Array de consultores
  product      TEXT,
  status       TEXT CHECK (status IN ('Pendente', 'OK')) DEFAULT 'Pendente',
  cbk          BOOLEAN DEFAULT FALSE,
  gross        NUMERIC(12, 2) DEFAULT 0,
  net          NUMERIC(12, 2) DEFAULT 0,
  note         TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------
-- Atendimento (mensagens de chat)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.mensagens (
  id          BIGSERIAL PRIMARY KEY,
  client_id   BIGINT REFERENCES public.clientes(id) ON DELETE CASCADE,
  client_name TEXT,                          -- Denormalized for convenience
  sender      TEXT CHECK (sender IN ('client', 'team')) NOT NULL,
  text        TEXT NOT NULL,
  time        TEXT,                          -- Horário formatado (HH:mm)
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ----------------------------------------
-- Seed data - Clientes
-- ----------------------------------------
INSERT INTO public.clientes (name, cpf, type, status, updated, tone, email, phone, services) VALUES
  ('Joyce Gomes da Silva Rosa', '***.482.***-09', 'Revisão de juros', 'Em andamento', 'Hoje, 09:42', 'green', 'joyce@example.com', '(11) 99999-0001', ARRAY['Revisão de Juros']),
  ('Marcos Vinícius Almeida', '***.119.***-42', 'Busca e apreensão', 'Aguardando documento', 'Ontem, 16:18', 'yellow', 'marcos@example.com', '(11) 99999-0002', ARRAY['Busca e Apreensão']),
  ('Ana Paula Ferreira', '***.763.***-20', 'Revisão de juros', 'Em análise', '26 set, 11:05', 'yellow', 'ana@example.com', '(11) 99999-0003', ARRAY['Revisão de Juros']),
  ('Rafael de Souza Lima', '***.058.***-73', 'Portabilidade', 'Concluído', '25 set, 14:27', 'green', 'rafael@example.com', '(11) 99999-0004', ARRAY['Portabilidade']),
  ('Camila Rodrigues Santos', '***.391.***-64', 'Revisão de contrato', 'Atenção necessária', '24 set, 10:12', 'red', 'camila@example.com', '(11) 99999-0005', ARRAY['Revisão de Contrato'])
ON CONFLICT DO NOTHING;

-- ----------------------------------------
-- Seed data - Chargebacks
-- ----------------------------------------
INSERT INTO public.chargebacks (client, bank, amount, deadline, status, tone) VALUES
  ('Joyce Gomes da Silva Rosa', 'Banco Vértice', 'R$ 8.420,55', '03 out 2026', 'Documentação enviada', 'blue'),
  ('Marcos Vinícius Almeida', 'CredMais', 'R$ 4.890,00', '07 out 2026', 'Em conferência', 'yellow'),
  ('Ana Paula Ferreira', 'Banco União', 'R$ 12.164,30', '12 out 2026', 'Aguardando assinatura', 'purple')
ON CONFLICT DO NOTHING;

-- ----------------------------------------
-- Seed data - Vendas
-- ----------------------------------------
INSERT INTO public.vendas (date, client, phone, consultants, product, status, cbk, gross, net, note) VALUES
  ('28/09/2026', 'Silvani Pereira Nunes', '+55 63 99276-2023', ARRAY['Beatriz', 'Juan'], 'Revisão de Juros', 'Pendente', FALSE, 1600, 1600, ''),
  ('28/09/2026', 'Carlos Henrique Ramos dos Santos', '(81) 98767-0239', ARRAY['Bruno Alemão'], 'Portabilidade', 'OK', FALSE, 3840, 3840, 'Contrato conferido'),
  ('28/09/2026', 'Pedro Adelar Gomes', '(41) 9218-0655', ARRAY['Gaby Inácio', 'Fernanda'], 'Revisão de Juros', 'Pendente', FALSE, 900, 900, ''),
  ('25/09/2026', 'Diego Junior Vieira Souza', '31 99538-6202', ARRAY['Alexandre', 'Isabella'], 'Revisão de contrato', 'Pendente', FALSE, 1500, 1500, 'Retornar ao cliente'),
  ('25/09/2026', 'Valmir Pereira da Silva', '94981871466', ARRAY['Ana G.'], 'Revisão de Juros', 'Pendente', FALSE, 1000, 1000, ''),
  ('24/09/2026', 'Adimar Rosa da Silva', '24 99816-0605', ARRAY['Ana G.', 'Alexandre'], 'Laudo', 'Pendente', FALSE, 2100, 2100, ''),
  ('23/09/2026', 'Josue Feliz Batista', '(14) 99603-8753', ARRAY['Arthur Panizza', 'Juan'], 'Revisão de contrato', 'Pendente', FALSE, 5786, 5241, ''),
  ('21/09/2026', 'Fernanda Souza', '62981313765', ARRAY['Rafaela'], 'Portabilidade', 'OK', FALSE, 540, 513, '')
ON CONFLICT DO NOTHING;

-- ----------------------------------------
-- Seed data - Mensagens (linked to Joyce, id=1)
-- ----------------------------------------
INSERT INTO public.mensagens (client_id, client_name, sender, text, time) VALUES
  (1, 'Joyce Gomes da Silva Rosa', 'client', 'Bom dia, não tem nenhuma novidade no meu processo?', '09:42'),
  (1, 'Joyce Gomes da Silva Rosa', 'team', 'Bom dia, Joyce! A análise financeira foi concluída e já enviamos a documentação para a próxima etapa. Vou te avisar assim que houver atualização.', '09:51')
ON CONFLICT DO NOTHING;

-- ----------------------------------------
-- Enable RLS (Row Level Security) - permissive for now
-- You can tighten these policies later
-- ----------------------------------------
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chargebacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anon (service key bypasses RLS anyway)
CREATE POLICY "Allow all clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all chargebacks" ON public.chargebacks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all vendas" ON public.vendas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mensagens" ON public.mensagens FOR ALL USING (true) WITH CHECK (true);
