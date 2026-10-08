// Apply schema using Supabase Management API (pg REST endpoint)
import "dotenv/config";
import https from "node:https";

const projectRef = new URL(process.env.SUPABASE_URL ?? "https://invalid.supabase.co").hostname.split(".")[0];
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? "";

const sql = `
CREATE TABLE IF NOT EXISTS public.clientes (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  cpf         TEXT,
  type        TEXT,
  status      TEXT,
  updated     TEXT,
  tone        TEXT DEFAULT 'green',
  email       TEXT,
  phone       TEXT,
  services    TEXT[],
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chargebacks (
  id          BIGSERIAL PRIMARY KEY,
  client      TEXT NOT NULL,
  bank        TEXT,
  amount      TEXT,
  deadline    TEXT,
  status      TEXT,
  tone        TEXT DEFAULT 'blue',
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.vendas (
  id           BIGSERIAL PRIMARY KEY,
  date         TEXT NOT NULL,
  client       TEXT NOT NULL,
  phone        TEXT,
  consultants  TEXT[],
  product      TEXT,
  status       TEXT DEFAULT 'Pendente',
  cbk          BOOLEAN DEFAULT FALSE,
  gross        NUMERIC(12,2) DEFAULT 0,
  net          NUMERIC(12,2) DEFAULT 0,
  note         TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mensagens (
  id          BIGSERIAL PRIMARY KEY,
  client_id   BIGINT,
  client_name TEXT,
  sender      TEXT NOT NULL,
  text        TEXT NOT NULL,
  time        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

INSERT INTO public.clientes (id, name, cpf, type, status, updated, tone, email, phone, services) VALUES
  (1, 'Joyce Gomes da Silva Rosa', '***.482.***-09', 'Revisão de juros', 'Em andamento', 'Hoje, 09:42', 'green', 'joyce@example.com', '(11) 99999-0001', ARRAY['Revisão de Juros']),
  (2, 'Marcos Vinícius Almeida', '***.119.***-42', 'Busca e apreensão', 'Aguardando documento', 'Ontem, 16:18', 'yellow', 'marcos@example.com', '(11) 99999-0002', ARRAY['Busca e Apreensão']),
  (3, 'Ana Paula Ferreira', '***.763.***-20', 'Revisão de juros', 'Em análise', '26 set, 11:05', 'yellow', 'ana@example.com', '(11) 99999-0003', ARRAY['Revisão de Juros']),
  (4, 'Rafael de Souza Lima', '***.058.***-73', 'Portabilidade', 'Concluído', '25 set, 14:27', 'green', 'rafael@example.com', '(11) 99999-0004', ARRAY['Portabilidade']),
  (5, 'Camila Rodrigues Santos', '***.391.***-64', 'Revisão de contrato', 'Atenção necessária', '24 set, 10:12', 'red', 'camila@example.com', '(11) 99999-0005', ARRAY['Revisão de Contrato'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.chargebacks (id, client, bank, amount, deadline, status, tone) VALUES
  (1, 'Joyce Gomes da Silva Rosa', 'Banco Vértice', 'R$ 8.420,55', '03 out 2026', 'Documentação enviada', 'blue'),
  (2, 'Marcos Vinícius Almeida', 'CredMais', 'R$ 4.890,00', '07 out 2026', 'Em conferência', 'yellow'),
  (3, 'Ana Paula Ferreira', 'Banco União', 'R$ 12.164,30', '12 out 2026', 'Aguardando assinatura', 'purple')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.vendas (id, date, client, phone, consultants, product, status, cbk, gross, net, note) VALUES
  (1, '28/09/2026', 'Silvani Pereira Nunes', '+55 63 99276-2023', ARRAY['Beatriz', 'Juan'], 'Revisão de Juros', 'Pendente', false, 1600, 1600, ''),
  (2, '28/09/2026', 'Carlos Henrique Ramos dos Santos', '(81) 98767-0239', ARRAY['Bruno Alemão'], 'Portabilidade', 'OK', false, 3840, 3840, 'Contrato conferido'),
  (3, '28/09/2026', 'Pedro Adelar Gomes', '(41) 9218-0655', ARRAY['Gaby Inácio', 'Fernanda'], 'Revisão de Juros', 'Pendente', false, 900, 900, ''),
  (4, '25/09/2026', 'Diego Junior Vieira Souza', '31 99538-6202', ARRAY['Alexandre', 'Isabella'], 'Revisão de contrato', 'Pendente', false, 1500, 1500, 'Retornar ao cliente'),
  (5, '25/09/2026', 'Valmir Pereira da Silva', '94981871466', ARRAY['Ana G.'], 'Revisão de Juros', 'Pendente', false, 1000, 1000, ''),
  (6, '24/09/2026', 'Adimar Rosa da Silva', '24 99816-0605', ARRAY['Ana G.', 'Alexandre'], 'Laudo', 'Pendente', false, 2100, 2100, ''),
  (7, '23/09/2026', 'Josue Feliz Batista', '(14) 99603-8753', ARRAY['Arthur Panizza', 'Juan'], 'Revisão de contrato', 'Pendente', false, 5786, 5241, ''),
  (8, '21/09/2026', 'Fernanda Souza', '62981313765', ARRAY['Rafaela'], 'Portabilidade', 'OK', false, 540, 513, '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mensagens (id, client_id, client_name, sender, text, time) VALUES
  (1, 1, 'Joyce Gomes da Silva Rosa', 'client', 'Bom dia, não tem nenhuma novidade no meu processo?', '09:42'),
  (2, 1, 'Joyce Gomes da Silva Rosa', 'team', 'Bom dia, Joyce! A análise financeira foi concluída e já enviamos a documentação para a próxima etapa. Vou te avisar assim que houver atualização.', '09:51')
ON CONFLICT (id) DO NOTHING;
`;

function postRequest(path: string, body: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.supabase.com",
      path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log("Applying schema via Supabase Management API...");
  
  const result = await postRequest(
    `/v1/projects/${projectRef}/database/query`,
    JSON.stringify({ query: sql }),
    { Authorization: `Bearer ${serviceKey}` }
  );
  
  console.log(`Status: ${result.status}`);
  console.log("Response:", result.body.slice(0, 500));
}

main().catch(console.error);
