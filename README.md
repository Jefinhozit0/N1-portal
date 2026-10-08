# N1 Portal

Portal da **N1 Soluções** com duas áreas:

- **Área interna (equipe N1):** painel de indicadores, cadastro e acompanhamento de clientes, chargebacks, atendimento por chat e o Sales HUB comercial.
- **Área do cliente:** o cliente cria a senha pelo link de primeiro acesso, aceita os termos de uso e acompanha o próprio processo e as mensagens.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS 4, shadcn/ui (Radix), wouter |
| API | Express + tRPC (`/api/trpc`), superjson |
| Banco e autenticação | Supabase (Postgres + Auth) |
| E-mail | Gmail SMTP (nodemailer) ou Resend |
| WhatsApp | Meta WhatsApp Cloud API (template de primeiro acesso) |
| Testes | Vitest |

## O que já está pronto

### Área interna (`/`)
- **Login, cadastro e recuperação de senha** com código de verificação por e-mail.
- **Dashboard** com indicadores (clientes ativos, solicitações pendentes, processos, taxa de reversão de chargebacks), gráfico de processos e listas filtráveis que abrem exatamente os registros de cada número. Atualiza a cada 60 s.
- **Clientes:** busca, filtros por status, cadastro com serviços contratados, edição, tags e página de detalhe. No cadastro, o cliente recebe o link de primeiro acesso por e-mail e/ou WhatsApp, com opção de reenviar.
- **Chargebacks:** lista com detalhe de cada caso.
- **Atendimento:** conversas com os clientes em tempo real (mensagens e chamados).
- **Sales HUB:** vendas por mês, ranking de consultores, cadastro/edição/exclusão de vendas e exportação em CSV, com seções Comercial, Jurídico e Controle.
- **Tema claro e escuro.**

### Área do cliente
- **Primeiro acesso (`/primeiro-acesso`):** link válido por 7 dias e de uso único para criar a senha.
- **Termos de uso** versionados. O processo e o chat só abrem depois do aceite, e o servidor também verifica isso.
- **Meu processo** e **chat** com a equipe, incluindo um assistente para dúvidas frequentes.

### Design (revisão de 08/10/2026)
- Ponte entre os tokens da marca e os componentes shadcn/ui, que antes apareciam com fundo transparente.
- Modo escuro dos componentes ligado ao botão de tema.
- Melhorias de contraste (WCAG AA), contorno de foco, zoom liberado no celular e respeito a "reduzir movimento".
- Ajustes de layout para celular (até 375 px), títulos em fonte serifada, escala única de cantos e sombras, animações de carregamento e página 404 com a marca.

## Estrutura

```
client/          Frontend React (Vite)
  src/pages/     Home (área interna), ClientPortal, ClientDetail, FirstAccess, NotFound
  src/index.css  Tokens de tema e estilos do portal
server/          API Express + tRPC
  routers.ts     Rotas: auth, account, portal (equipe) e cliente
  _core/         Servidor, e-mail, WhatsApp, dashboard, acesso do cliente, Supabase
shared/          Tipos e regras compartilhadas (dashboard, chamados)
supabase/        Migrações SQL
supabase-schema.sql  Esquema completo: clientes, chargebacks, vendas, mensagens
```

## Como rodar

### Pré-requisitos
- Node.js 20 ou superior
- pnpm 10 (`npm install -g pnpm` ou `corepack enable`)
- Um projeto no [Supabase](https://supabase.com)

### 1. Instalar as dependências
```bash
pnpm install
```

### 2. Configurar as variáveis de ambiente
```bash
cp .env.example .env
```
Preencha o `.env`:

| Variável | Para quê |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Acesso do servidor ao Supabase (service role) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Acesso do navegador ao Supabase (login) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Envio de e-mails pelo Gmail (senha de app) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Alternativa ao Gmail para e-mails |
| `APP_URL` | URL pública usada nos links de primeiro acesso |
| `WHATSAPP_*` | Envio do link de primeiro acesso pelo WhatsApp (opcional) |
| `PORT` | Porta do servidor (padrão 3000) |

### 3. Criar as tabelas no Supabase
No Supabase, abra **SQL Editor** e rode o conteúdo de `supabase-schema.sql`. Depois rode os arquivos de `supabase/migrations/` em ordem.

Para popular dados de exemplo (opcional):
```bash
npx tsx seed-supabase.ts
```

### 4. Rodar em desenvolvimento
```bash
pnpm dev
```
Abra http://localhost:3000. O mesmo servidor entrega a API e o frontend. Se a porta estiver ocupada, ele usa a próxima livre e mostra qual no terminal.

> Se a tela mostrar "Failed to fetch", o servidor não está rodando. Inicie o `pnpm dev` de novo.
> Se aparecer "JWT issued at future", sincronize o relógio do computador.

### 5. Produção
```bash
pnpm build
pnpm start
```

### Outros comandos
```bash
pnpm test     # testes (Vitest)
pnpm check    # checagem de tipos (TypeScript)
pnpm format   # formatação (Prettier)
```

## Pendências conhecidas
- **Rotas da equipe sem autenticação no servidor:** as rotas `portal.*` usam `publicProcedure`. Antes de publicar, elas devem exigir um usuário da equipe logado.
- Página 404 ainda em inglês.
- Janelas do Sales HUB não fecham com Esc nem prendem o foco do teclado.
- `DashboardLayout.tsx` e `ComponentShowcase.tsx` não são usados e podem ser removidos.
- O pacote JavaScript passa de 800 kB; carregar o Sales HUB sob demanda reduziria isso.
