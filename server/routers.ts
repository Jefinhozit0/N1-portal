import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sendPasswordResetCodeEmail, sendVerificationCodeEmail } from "./_core/email";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { checkCode, codeErrorMessage, createVerificationCode, discardVerificationCode } from "./_core/verificationCodes";
import { supabase } from "./_core/supabase";
import { completeFirstAccess, findFirstAccessUser, findUserByEmail, getClienteId, provisionClientAccess, removeClientLogins } from "./_core/clientAccess";
import { TERMS_VERSION } from "@shared/termos";
import { computeDashboard } from "./_core/dashboard";
import { ENV } from "./_core/env";
import type { TrpcContext } from "./_core/context";
import { TICKET_TOPICS, formatTicketMessage, parseTicketMessage } from "@shared/tickets";
import { MAX_DOCUMENT_BYTES, PROCESS_STATUSES, toneForStatus } from "@shared/processo";
import { addEvent, deleteDocument, documentDownloadUrl, listDocuments, listEvents, removeClientFiles, uploadDocument } from "./_core/processo";

const verificationRequestTimes = new Map<string, number>();
const verificationRequestCooldownMs = 60_000;
const verificationCodeInput = z.object({ email: z.string().trim().email().max(320) });

/** One e-mail per minute per IP and per address, for anything that sends a code. */
function enforceEmailCooldown(req: TrpcContext["req"], email: string) {
  const requester = `ip:${req.ip || "unknown"}`;
  const emailKey = `email:${email.toLowerCase()}`;
  const now = Date.now();
  const lastRequest = Math.max(verificationRequestTimes.get(requester) ?? 0, verificationRequestTimes.get(emailKey) ?? 0);
  if (now - lastRequest < verificationRequestCooldownMs) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Aguarde um minuto antes de solicitar outro código." });
  }
  verificationRequestTimes.set(requester, now);
  verificationRequestTimes.set(emailKey, now);
}

/** Reset codes live apart from sign-up codes, so one can never be used as the other. */
const resetCodeKey = (email: string) => `reset:${email}`;

function getPortalUrl(req: TrpcContext["req"]) {
  if (ENV.appUrl) return ENV.appUrl;
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0].trim();
  return `${proto}://${req.get("host")}`;
}

/** The Supabase user behind the request's session token, or null when there is no valid session. */
async function getSessionUser(ctx: TrpcContext) {
  const token = ctx.req.headers["x-supabase-token"];
  if (typeof token !== "string" || !token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

/**
 * Anyone can create an account on the login screen, so a login alone does not make someone
 * part of the team: the e-mail must be in STAFF_EMAILS, or the account must carry role "staff"
 * in app_metadata (which only the service key can set).
 */
function isStaffUser(user: { email?: string; app_metadata?: Record<string, unknown> }) {
  if (user.app_metadata?.role === "client") return false;
  if (user.app_metadata?.role === "staff") return true;
  return Boolean(user.email && ENV.staffEmails.includes(user.email.toLowerCase()));
}

/** Procedures for the N1 team: every route with data from all clients goes through here. */
const staffProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const user = await getSessionUser(ctx);
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Faça login para continuar." });
  if (!isStaffUser(user)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta ainda não foi liberada para a área da equipe." });
  }
  return next({ ctx: { ...ctx, staffUser: user } });
});

/** Procedures for a logged-in client: resolves which cliente row the Supabase session belongs to. */
const clientProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const user = await getSessionUser(ctx);
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Faça login para continuar." });
  }
  const clienteId = getClienteId(user);
  if (clienteId === null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta conta não está vinculada a um cliente." });
  }
  return next({ ctx: { ...ctx, clienteId, clienteUser: user } });
});

const hasAcceptedTerms = (user: { app_metadata?: Record<string, unknown> }) =>
  (user.app_metadata?.terms as { version?: string } | undefined)?.version === TERMS_VERSION;

/** The process and the chat only open after the current version of the terms was accepted. */
const clientWithTermsProcedure = clientProcedure.use(({ ctx, next }) => {
  if (!hasAcceptedTerms(ctx.clienteUser)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Aceite os termos de uso para continuar." });
  }
  return next();
});

/** "Hoje, 09:42", "Ontem, 16:18" or "26 set, 11:05", for the "Atualização" column. */
function formatUpdatedLabel(iso: string) {
  const date = new Date(iso);
  const hour = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const day = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  if (day(date) === day(new Date())) return `Hoje, ${hour}`;
  if (day(date) === day(new Date(Date.now() - 86_400_000))) return `Ontem, ${hour}`;
  const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "").replace(" de ", " ");
  return `${label}, ${hour}`;
}

/** Whether the SQL that adds clientes.atualizado_em was run (checked until it is). */
let clientesHasUpdatedAt = false;
async function hasUpdatedAtColumn() {
  if (!clientesHasUpdatedAt) {
    const { error } = await supabase.from("clientes").select("atualizado_em").limit(1);
    clientesHasUpdatedAt = !error;
  }
  return clientesHasUpdatedAt;
}

/**
 * The client's chat with the virtual assistant is saved in the same table as the real messages,
 * so it survives logging out and opening the portal on another device. Those rows use their own
 * senders and never reach the team's inbox, the dashboard or the ticket counts.
 */
const TEAM_VISIBLE_SENDERS = ["client", "team"];
const ASSISTANT_SENDERS = { bot: "assistant", choice: "assistant_choice" } as const;
const clientMessageFrom: Record<string, "client" | "team" | "bot" | "choice"> = {
  client: "client",
  team: "team",
  [ASSISTANT_SENDERS.bot]: "bot",
  [ASSISTANT_SENDERS.choice]: "choice",
};

const nowHHmm = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

const firstAccessInput =z.object({ u: z.string().max(64), t: z.string().max(128) });

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  account: router({
    requestVerificationCode: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320) }))
      .mutation(async ({ ctx, input }) => {
        const requester = `ip:${ctx.req.ip || "unknown"}`;
        const emailKey = `email:${input.email.toLowerCase()}`;
        const now = Date.now();
        const lastRequest = Math.max(verificationRequestTimes.get(requester) ?? 0, verificationRequestTimes.get(emailKey) ?? 0);

        if (now - lastRequest < verificationRequestCooldownMs) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Aguarde um minuto antes de solicitar outro código." });
        }

        const code = createVerificationCode(input.email);
        try {
          await sendVerificationCodeEmail(input.email, code);
        } catch (error) {
          discardVerificationCode(input.email, code);
          console.error("[Email] Verification code delivery failed:", error);
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error instanceof Error ? error.message : "Não foi possível enviar o e-mail.",
          });
        }

        verificationRequestTimes.set(requester, now);
        verificationRequestTimes.set(emailKey, now);
        return { success: true } as const;
      }),
    /** Which area the logged-in account may open: the team's, the client's, or neither yet. */
    meuAcesso: publicProcedure.query(async ({ ctx }) => {
      const user = await getSessionUser(ctx);
      if (!user) return { kind: "none" } as const;
      if (getClienteId(user) !== null) return { kind: "client" } as const;
      return { kind: isStaffUser(user) ? "staff" : "pending" } as const;
    }),

    /**
     * "Criar login": checks the e-mailed code and creates the account here, already confirmed.
     * The code proves the person owns the e-mail, so an account that already exists for it
     * (one that was never confirmed, or whose password was forgotten) just gets the new password,
     * the same thing "Esqueci minha senha" would do. Client logins are left alone.
     */
    criarConta: publicProcedure
      .input(verificationCodeInput.extend({
        code: z.string().regex(/^\d{6}$/, "Informe o código de 6 dígitos."),
        password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
      }))
      .mutation(async ({ input }) => {
        const email = input.email.toLowerCase();
        // The code comes first, so nobody can find out who has an account without owning the e-mail.
        const result = checkCode(email, input.code);
        if (result !== "ok") throw new TRPCError({ code: "BAD_REQUEST", message: codeErrorMessage(result) });

        const existing = await findUserByEmail(email).catch((error) => {
          console.error("[criarConta] Lookup failed:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar a conta agora. Tente novamente." });
        });
        if (existing && getClienteId(existing) !== null) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este e-mail é de um cliente da N1. Entre com a senha criada no primeiro acesso ou use \"Esqueci minha senha\"." });
        }

        if (!existing) {
          const { error } = await supabase.auth.admin.createUser({ email, password: input.password, email_confirm: true });
          if (error) {
            console.error("[criarConta] Create failed:", error);
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar a conta agora. Tente novamente." });
          }
          return { status: "created" } as const;
        }

        const { error } = await supabase.auth.admin.updateUserById(existing.id, { password: input.password, email_confirm: true });
        if (error) {
          console.error("[criarConta] Update failed:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar a senha agora. Tente novamente." });
        }
        return { status: "updated" } as const;
      }),

    /** Opening the link from the e-mail / WhatsApp: is it still valid, and for whom? */
    primeiroAcessoInfo: publicProcedure
      .input(firstAccessInput)
      .query(async ({ input }) => {
        const user = await findFirstAccessUser(input.u, input.t);
        if (!user?.email) return { valid: false } as const;
        const name = (user.user_metadata?.name as string | undefined) ?? "";
        return { valid: true, firstName: name.trim().split(/\s+/)[0] ?? "", email: user.email } as const;
      }),

    definirSenhaPrimeiroAcesso: publicProcedure
      .input(firstAccessInput.extend({ password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72) }))
      .mutation(async ({ input }) => {
        const user = await findFirstAccessUser(input.u, input.t);
        if (!user?.email) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Este link expirou ou já foi usado. Peça um novo link à equipe da N1." });
        }
        try {
          await completeFirstAccess(user, input.password);
        } catch (error) {
          console.error("[FirstAccess] Update failed:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar a senha. Tente novamente." });
        }
        return { email: user.email };
      }),

    /** Step 1 of "Esqueci minha senha": e-mails a 6-digit code if the account exists. */
    solicitarRedefinicaoSenha: publicProcedure
      .input(verificationCodeInput)
      .mutation(async ({ ctx, input }) => {
        enforceEmailCooldown(ctx.req, input.email);
        // Same answer whether or not the account exists, so the form cannot be used to find out who is registered.
        const user = await findUserByEmail(input.email).catch((error) => {
          console.error("[PasswordReset] Lookup failed:", error);
          return null;
        });
        if (!user) return { success: true } as const;

        const code = createVerificationCode(resetCodeKey(input.email));
        try {
          await sendPasswordResetCodeEmail(input.email, code);
        } catch (error) {
          discardVerificationCode(resetCodeKey(input.email), code);
          console.error("[PasswordReset] E-mail delivery failed:", error);
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos." });
        }
        return { success: true } as const;
      }),

    /** Step 2: checks the code and sets the new password. */
    redefinirSenha: publicProcedure
      .input(verificationCodeInput.extend({
        code: z.string().regex(/^\d{6}$/, "Informe o código de 6 dígitos."),
        password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
      }))
      .mutation(async ({ input }) => {
        const result = checkCode(resetCodeKey(input.email), input.code);
        if (result !== "ok") throw new TRPCError({ code: "BAD_REQUEST", message: codeErrorMessage(result) });
        const user = await findUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido ou expirado. Solicite um novo código." });
        const { error } = await supabase.auth.admin.updateUserById(user.id, {
          password: input.password,
          // The e-mailed code proves the address, so an account never confirmed starts working too.
          email_confirm: true,
          // The person just chose this password, so a client is not asked to change it again.
          user_metadata: { ...user.user_metadata, must_change_password: false },
        });
        if (error) {
          console.error("[PasswordReset] Update failed:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar a nova senha. Tente novamente." });
        }
        return { success: true } as const;
      }),
  }),

  // ── Portal data routers backed by Supabase ──────────────────────────────
  portal: router({
    /** List all clients */
    clientes: staffProcedure.query(async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("id", { ascending: true });
      if (error) {
        console.warn("[portal.clientes] Supabase error:", error.message);
        return [];
      }
      // The "Atualização" column is computed from real dates instead of text typed by hand.
      // Until the atualizado_em migration is run, the registration date stands in for it.
      return (data ?? []).map((row) => {
        const at = row.atualizado_em ?? row.created_at;
        return at ? { ...row, updated: formatUpdatedLabel(at) } : row;
      });
    }),

    /** Every number on the dashboard, computed from the real data */
    dashboard: staffProcedure.query(() => computeDashboard()),

    /** Create a client */
    createCliente: staffProcedure
      .input(z.object({
        name: z.string().min(1),
        cpf: z.string().optional(),
        type: z.string().optional(),
        status: z.string().optional(),
        updated: z.string().optional(),
        tone: z.enum(["green", "yellow", "red"]).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        services: z.array(z.string()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { data, error } = await supabase.from("clientes").insert(input).select().single();
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        await addEvent(data.id, {
          tipo: "cadastro",
          titulo: "Cadastro realizado",
          descricao: input.type ? `Início do processo: ${input.type}` : "Início do processo",
          autor: ctx.staffUser.email,
        });
        // Login link goes out right away, by e-mail and from the corporate WhatsApp.
        const access = await provisionClientAccess({ id: data.id, name: data.name, email: input.email, phone: input.phone }, getPortalUrl(ctx.req));
        return { ...data, access };
      }),

    /** Generate a new temporary password for a client and e-mail it again */
    reenviarAcesso: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { data, error } = await supabase.from("clientes").select("id, name, email, phone").eq("id", input.id).single();
        if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
        if (!data.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Cadastre um e-mail para este cliente primeiro." });
        // A new link replaces the previous one, which stops working.
        return provisionClientAccess({ id: data.id, name: data.name, email: data.email, phone: data.phone }, getPortalUrl(ctx.req));
      }),

    /** Update a client */
    updateCliente: staffProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        cpf: z.string().optional(),
        type: z.string().optional(),
        status: z.string().optional(),
        updated: z.string().optional(),
        tone: z.enum(["green", "yellow", "red"]).optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        services: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...patch } = input;
        const changes = (await hasUpdatedAtColumn()) ? { ...patch, atualizado_em: new Date().toISOString() } : patch;
        const { data, error } = await supabase.from("clientes").update(changes).eq("id", id).select().single();
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return data;
      }),

    /** List chargebacks */
    chargebacks: staffProcedure.query(async () => {
      const { data, error } = await supabase
        .from("chargebacks")
        .select("*")
        .order("id", { ascending: true });
      if (error) {
        console.warn("[portal.chargebacks] Supabase error:", error.message);
        return [];
      }
      return data ?? [];
    }),

    /** List sales (vendas) */
    vendas: staffProcedure.query(async () => {
      const { data, error } = await supabase
        .from("vendas")
        .select("*")
        .order("id", { ascending: false });
      if (error) {
        console.warn("[portal.vendas] Supabase error:", error.message);
        return [];
      }
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as number,
        date: row.date as string,
        client: row.client as string,
        phone: row.phone as string,
        consultants: (row.consultants as string[]) ?? [],
        product: row.product as string,
        status: (row.status as "Pendente" | "OK") ?? "Pendente",
        cbk: (row.cbk as boolean) ?? false,
        gross: Number(row.gross ?? 0),
        net: Number(row.net ?? 0),
        note: (row.note as string) ?? "",
      }));
    }),

    /** Create a sale */
    createVenda: staffProcedure
      .input(z.object({
        date: z.string(),
        client: z.string(),
        phone: z.string().optional(),
        consultants: z.array(z.string()).optional(),
        product: z.string().optional(),
        status: z.enum(["Pendente", "OK"]).optional(),
        cbk: z.boolean().optional(),
        gross: z.number().optional(),
        net: z.number().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { data, error } = await supabase.from("vendas").insert(input).select().single();
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return data;
      }),

    /** Update a sale */
    updateVenda: staffProcedure
      .input(z.object({
        id: z.number(),
        date: z.string().optional(),
        client: z.string().optional(),
        phone: z.string().optional(),
        consultants: z.array(z.string()).optional(),
        product: z.string().optional(),
        status: z.enum(["Pendente", "OK"]).optional(),
        cbk: z.boolean().optional(),
        gross: z.number().optional(),
        net: z.number().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...patch } = input;
        const { data, error } = await supabase.from("vendas").update(patch).eq("id", id).select().single();
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return data;
      }),

    /**
     * Deletes a client for good: the registration, the conversation (removed by the database
     * together with the row) and the portal login, so the old first-access link stops working too.
     * Sales and chargebacks are kept, since they are the company's records.
     */
    deleteCliente: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { data: cliente, error: findError } = await supabase.from("clientes").select("id, name").eq("id", input.id).maybeSingle();
        if (findError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: findError.message });
        if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Este cliente já foi apagado." });

        // The login goes first: if anything fails after that, the client still can't get in.
        try {
          await removeClientLogins(input.id);
          await removeClientFiles(input.id);
        } catch (error) {
          console.error("[portal.deleteCliente] Could not remove the portal login:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível remover o acesso do cliente ao portal. Nada foi apagado." });
        }
        const { error: messagesError } = await supabase.from("mensagens").delete().eq("client_id", input.id);
        if (messagesError) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: messagesError.message });
        const { error } = await supabase.from("clientes").delete().eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        // Leaves a trail in the server log of who deleted whom.
        console.log(`[portal.deleteCliente] ${ctx.staffUser.email} apagou o cliente #${cliente.id} (${cliente.name}).`);
        return { success: true } as const;
      }),

    /** Everything on the client's detail page: the registration, the documents and the timeline. */
    detalheCliente: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase.from("clientes").select("*").eq("id", input.id).maybeSingle();
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
        const [documentos, eventos] = await Promise.all([listDocuments(input.id), listEvents(input.id)]);
        return {
          cliente: { ...data, progresso: typeof data.progresso === "number" ? data.progresso : 0 },
          documentos,
          eventos,
        };
      }),

    /** Changes the status and/or the progress; the client sees it on the next refresh. */
    atualizarProcesso: staffProcedure
      .input(z.object({
        id: z.number().int().positive(),
        status: z.enum(PROCESS_STATUSES.map((option) => option.label) as [string, ...string[]]).optional(),
        progresso: z.number().int().min(0).max(100).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { data: current, error: findError } = await supabase.from("clientes").select("*").eq("id", input.id).maybeSingle();
        if (findError || !current) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });

        const patch: Record<string, unknown> = {};
        if (input.status !== undefined && input.status !== current.status) {
          patch.status = input.status;
          patch.tone = toneForStatus(input.status);
        }
        if (input.progresso !== undefined && input.progresso !== current.progresso) patch.progresso = input.progresso;
        if (Object.keys(patch).length === 0) return { changed: false } as const;
        if (await hasUpdatedAtColumn()) patch.atualizado_em = new Date().toISOString();

        const { error } = await supabase.from("clientes").update(patch).eq("id", input.id);
        if (error) {
          const missingProgress = /progresso/.test(error.message);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: missingProgress ? "O banco ainda não tem o campo de progresso. Rode o arquivo supabase/migrations/20261009_documentos_e_historico.sql no SQL Editor do Supabase." : error.message,
          });
        }

        if (patch.status) {
          await addEvent(input.id, { tipo: "status", titulo: "Status atualizado", descricao: `${current.status || "Sem status"} → ${input.status}`, autor: ctx.staffUser.email });
        }
        if (patch.progresso !== undefined) {
          await addEvent(input.id, { tipo: "progresso", titulo: "Progresso atualizado", descricao: `Progresso do caso atualizado para ${input.progresso}%`, autor: ctx.staffUser.email });
        }
        return { changed: true } as const;
      }),

    enviarDocumento: staffProcedure
      .input(z.object({
        clientId: z.number().int().positive(),
        nome: z.string().trim().min(1).max(200),
        tipo: z.string().max(150).optional(),
        descricao: z.string().trim().max(300).optional(),
        /** File content in base64. */
        conteudo: z.string().min(1).max(Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 4),
      }))
      .mutation(async ({ ctx, input }) => {
        const bytes = Buffer.from(input.conteudo, "base64");
        if (bytes.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo está vazio." });
        if (bytes.length > MAX_DOCUMENT_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo passa de 10 MB." });
        const { data: cliente } = await supabase.from("clientes").select("id").eq("id", input.clientId).maybeSingle();
        if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
        return uploadDocument(input.clientId, { nome: input.nome, tipo: input.tipo, descricao: input.descricao, bytes }, ctx.staffUser.email ?? "equipe");
      }),

    baixarDocumento: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const url = await documentDownloadUrl(input.id);
        if (!url) throw new TRPCError({ code: "NOT_FOUND", message: "Documento não encontrado." });
        return { url };
      }),

    apagarDocumento: staffProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await deleteDocument(input.id, ctx.staffUser.email ?? "equipe");
        return { success: true } as const;
      }),

    /** Clears a client's whole conversation (messages, tickets and the assistant's lines). The client stays registered. */
    apagarConversa: staffProcedure
      .input(z.object({ clientId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { error, count } = await supabase.from("mensagens").delete({ count: "exact" }).eq("client_id", input.clientId);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        console.log(`[portal.apagarConversa] ${ctx.staffUser.email} apagou ${count ?? 0} mensagem(ns) do cliente #${input.clientId}.`);
        return { apagadas: count ?? 0 };
      }),

    /** Delete a sale */
    deleteVenda: staffProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase.from("vendas").delete().eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),

    /** Get messages for a client */
    mensagens: staffProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from("mensagens")
          .select("*")
          .in("sender", TEAM_VISIBLE_SENDERS)
          .eq("client_id", input.clientId)
          .order("created_at", { ascending: true });
        if (error) {
          console.warn("[portal.mensagens] Supabase error:", error.message);
          return [];
        }
        return (data ?? []).map((row: Record<string, unknown>) => ({
          id: row.id as number,
          from: (row.sender as "client" | "team") ?? "team",
          text: row.text as string,
          time: (row.time as string) ?? "",
          createdAt: (row.created_at as string) ?? null,
        }));
      }),

    /** One entry per client who has written or been written to, newest activity first */
    conversas: staffProcedure.query(async () => {
      const { data: rows, error } = await supabase
        .from("mensagens")
        .select("client_id, client_name, sender, text, created_at")
        .in("sender", TEAM_VISIBLE_SENDERS)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) {
        console.warn("[portal.conversas] Supabase error:", error.message);
        return [];
      }

      type Row = { client_id: number | null; client_name: string | null; sender: "client" | "team"; text: string; created_at: string };
      const byClient = new Map<number, Row[]>();
      for (const row of (rows ?? []) as Row[]) {
        if (row.client_id === null) continue;
        const list = byClient.get(row.client_id) ?? [];
        list.push(row);
        byClient.set(row.client_id, list);
      }

      const ids = Array.from(byClient.keys());
      const { data: clientes } = ids.length
        ? await supabase.from("clientes").select("id, name, type, status, tone").in("id", ids)
        : { data: [] };
      const clienteById = new Map((clientes ?? []).map((c) => [c.id as number, c]));

      return ids.map((clientId) => {
        const history = byClient.get(clientId)!; // newest first
        const last = history[0];
        // Client messages since the team last answered: those are what is still waiting.
        const lastTeamReply = history.findIndex((m) => m.sender === "team");
        const unanswered = lastTeamReply === -1 ? history : history.slice(0, lastTeamReply);
        const openTicket = unanswered.map((m) => parseTicketMessage(m.text)).find(Boolean) ?? null;
        const cliente = clienteById.get(clientId);
        return {
          clientId,
          name: (cliente?.name as string) ?? last.client_name ?? `Cliente #${clientId}`,
          type: (cliente?.type as string | null) ?? null,
          status: (cliente?.status as string | null) ?? null,
          tone: (cliente?.tone as "green" | "yellow" | "red" | null) ?? null,
          lastText: parseTicketMessage(last.text)?.body ?? last.text,
          lastFrom: last.sender,
          lastAt: last.created_at,
          awaitingReply: last.sender === "client",
          ticketTopic: openTicket?.topic ?? null,
        };
      });
    }),

    /** Send a message */
    sendMensagem: staffProcedure
      .input(z.object({
        clientId: z.number(),
        clientName: z.string().optional(),
        sender: z.enum(["client", "team"]),
        text: z.string().min(1),
        time: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const now = new Date();
        const time = input.time ?? `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        const { data, error } = await supabase.from("mensagens").insert({
          client_id: input.clientId,
          client_name: input.clientName,
          sender: input.sender,
          text: input.text,
          time,
        }).select().single();
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { ...data, from: data.sender as "client" | "team", time: data.time };
      }),
  }),

  // ── Area for the client themselves (only ever sees their own process) ──
  cliente: router({
    /** Whether the client still has to accept the current terms (read fresh from the server, not from the session). */
    termos: clientProcedure.query(({ ctx }) => ({ version: TERMS_VERSION, accepted: hasAcceptedTerms(ctx.clienteUser) })),

    aceitarTermos: clientProcedure
      .input(z.object({ version: z.literal(TERMS_VERSION) }))
      .mutation(async ({ ctx }) => {
        const user = ctx.clienteUser;
        const forwarded = String(ctx.req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
        // Kept in app_metadata (only the server can write it) as evidence of the acceptance.
        const { error } = await supabase.auth.admin.updateUserById(user.id, {
          app_metadata: {
            ...user.app_metadata,
            terms: {
              version: TERMS_VERSION,
              accepted_at: new Date().toISOString(),
              ip: forwarded || ctx.req.ip || null,
              user_agent: String(ctx.req.headers["user-agent"] ?? "").slice(0, 300),
            },
          },
        });
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível registrar o aceite. Tente novamente." });
        return { accepted: true } as const;
      }),

    meuProcesso: clientWithTermsProcedure.query(async ({ ctx }) => {
      // "*" keeps working before and after the migration that adds progresso and atualizado_em.
      const { data, error } = await supabase.from("clientes").select("*").eq("id", ctx.clienteId).single();
      if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "Processo não encontrado." });
      const updatedAt = (data.atualizado_em ?? data.created_at) as string | null;
      return {
        id: data.id as number,
        name: data.name as string,
        type: (data.type as string | null) ?? null,
        status: (data.status as string | null) ?? null,
        updated: updatedAt ? formatUpdatedLabel(updatedAt) : ((data.updated as string | null) ?? null),
        tone: (data.tone as "green" | "yellow" | "red" | null) ?? null,
        services: (data.services as string[] | null) ?? null,
        progresso: typeof data.progresso === "number" ? data.progresso : 0,
      };
    }),

    /** The client's own documents. */
    documentos: clientWithTermsProcedure.query(async ({ ctx }) => {
      const rows = await listDocuments(ctx.clienteId);
      return rows.map(({ enviado_por: _author, ...row }) => row);
    }),

    /** The client's own timeline, without the names of who made each change. */
    historico: clientWithTermsProcedure.query(async ({ ctx }) => {
      const rows = await listEvents(ctx.clienteId);
      return rows.map(({ autor: _author, ...row }) => row);
    }),

    baixarDocumento: clientWithTermsProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        // Passing the client id makes a document of someone else look like it doesn't exist.
        const url = await documentDownloadUrl(input.id, ctx.clienteId);
        if (!url) throw new TRPCError({ code: "NOT_FOUND", message: "Documento não encontrado." });
        return { url };
      }),

    mensagens: clientWithTermsProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabase
        .from("mensagens")
        .select("id, sender, text, time")
        .eq("client_id", ctx.clienteId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) {
        console.warn("[cliente.mensagens] Supabase error:", error.message);
        return [];
      }
      return (data ?? []).flatMap((row) => {
        const from = clientMessageFrom[row.sender as string];
        return from ? [{ id: row.id as number, from, text: row.text as string, time: (row.time as string) ?? "" }] : [];
      });
    }),

    /** Saves what the assistant said and which options the client picked, in order. */
    registrarAssistente: clientWithTermsProcedure
      .input(z.object({
        entries: z.array(z.object({ from: z.enum(["bot", "choice"]), text: z.string().trim().min(1).max(4000) })).min(1).max(4),
      }))
      .mutation(async ({ ctx, input }) => {
        const time = nowHHmm();
        // Inserted one by one so created_at keeps the order of the conversation.
        for (const entry of input.entries) {
          const { error } = await supabase.from("mensagens").insert({
            client_id: ctx.clienteId,
            sender: ASSISTANT_SENDERS[entry.from],
            text: entry.text,
            time,
          });
          if (error) {
            // Until the migration that allows these senders runs, the assistant still works, it just isn't saved.
            console.warn("[cliente.registrarAssistente] Not saved:", error.message);
            return { saved: false } as const;
          }
        }
        return { saved: true } as const;
      }),

    enviarMensagem: clientWithTermsProcedure
      .input(z.object({
        text: z.string().trim().min(1).max(2000),
        /** Set when the chatbot handed the client over to the team: the message becomes a ticket. */
        assunto: z.enum(TICKET_TOPICS).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        const { data: cliente } = await supabase.from("clientes").select("name").eq("id", ctx.clienteId).single();
        const { error } = await supabase.from("mensagens").insert({
          client_id: ctx.clienteId,
          client_name: cliente?.name,
          sender: "client",
          text: input.assunto ? formatTicketMessage(input.assunto, input.text) : input.text,
          time,
        });
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;

