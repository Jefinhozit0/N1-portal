import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { sendPasswordResetCodeEmail, sendVerificationCodeEmail } from "./_core/email";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createVerificationCode, discardVerificationCode, verifyCode } from "./_core/verificationCodes";
import { supabase } from "./_core/supabase";
import { completeFirstAccess, findFirstAccessUser, findUserByEmail, getClienteId, provisionClientAccess } from "./_core/clientAccess";
import { TERMS_VERSION } from "@shared/termos";
import { computeDashboard } from "./_core/dashboard";
import { ENV } from "./_core/env";
import type { TrpcContext } from "./_core/context";
import { TICKET_TOPICS, formatTicketMessage, parseTicketMessage } from "@shared/tickets";

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

/** Procedures for a logged-in client: resolves which cliente row the Supabase session belongs to. */
const clientProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const token = ctx.req.headers["x-supabase-token"];
  if (typeof token !== "string" || !token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Faça login para continuar." });
  }
  const { data, error } = await supabase.auth.getUser(token);
  const clienteId = data.user ? getClienteId(data.user) : null;
  if (error || clienteId === null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta conta não está vinculada a um cliente." });
  }
  return next({ ctx: { ...ctx, clienteId, clienteUser: data.user! } });
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

const firstAccessInput = z.object({ u: z.string().max(64), t: z.string().max(128) });

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
          discardVerificationCode(input.email);
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
    verifyEmailCode: publicProcedure
      .input(verificationCodeInput.extend({ code: z.string().regex(/^\d{6}$/, "Informe o código de 6 dígitos.") }))
      .mutation(({ input }) => {
        if (!verifyCode(input.email, input.code)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido ou expirado. Solicite um novo código." });
        }
        return { verified: true } as const;
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
          discardVerificationCode(resetCodeKey(input.email));
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
        if (!verifyCode(resetCodeKey(input.email), input.code)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido ou expirado. Solicite um novo código." });
        }
        const user = await findUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido ou expirado. Solicite um novo código." });
        const { error } = await supabase.auth.admin.updateUserById(user.id, {
          password: input.password,
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
    clientes: publicProcedure.query(async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("id", { ascending: true });
      if (error) {
        console.warn("[portal.clientes] Supabase error:", error.message);
        return [];
      }
      // With a real update date, the "Atualização" column is computed instead of typed by hand.
      return (data ?? []).map((row) => (row.atualizado_em ? { ...row, updated: formatUpdatedLabel(row.atualizado_em) } : row));
    }),

    /** Every number on the dashboard, computed from the real data */
    dashboard: publicProcedure.query(() => computeDashboard()),

    /** Create a client */
    createCliente: publicProcedure
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
        // Login link goes out right away, by e-mail and from the corporate WhatsApp.
        const access = await provisionClientAccess({ id: data.id, name: data.name, email: input.email, phone: input.phone }, getPortalUrl(ctx.req));
        return { ...data, access };
      }),

    /** Generate a new temporary password for a client and e-mail it again */
    reenviarAcesso: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { data, error } = await supabase.from("clientes").select("id, name, email, phone").eq("id", input.id).single();
        if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
        if (!data.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Cadastre um e-mail para este cliente primeiro." });
        // A new link replaces the previous one, which stops working.
        return provisionClientAccess({ id: data.id, name: data.name, email: data.email, phone: data.phone }, getPortalUrl(ctx.req));
      }),

    /** Update a client */
    updateCliente: publicProcedure
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
    chargebacks: publicProcedure.query(async () => {
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
    vendas: publicProcedure.query(async () => {
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
    createVenda: publicProcedure
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
    updateVenda: publicProcedure
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

    /** Delete a sale */
    deleteVenda: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { error } = await supabase.from("vendas").delete().eq("id", input.id);
        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        return { success: true };
      }),

    /** Get messages for a client */
    mensagens: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const { data, error } = await supabase
          .from("mensagens")
          .select("*")
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
    conversas: publicProcedure.query(async () => {
      const { data: rows, error } = await supabase
        .from("mensagens")
        .select("client_id, client_name, sender, text, created_at")
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
    sendMensagem: publicProcedure
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
      const { data, error } = await supabase
        .from("clientes")
        .select("id, name, type, status, updated, tone, services")
        .eq("id", ctx.clienteId)
        .single();
      if (error || !data) throw new TRPCError({ code: "NOT_FOUND", message: "Processo não encontrado." });
      return data as { id: number; name: string; type: string | null; status: string | null; updated: string | null; tone: "green" | "yellow" | "red" | null; services: string[] | null };
    }),

    mensagens: clientWithTermsProcedure.query(async ({ ctx }) => {
      const { data, error } = await supabase
        .from("mensagens")
        .select("id, sender, text, time")
        .eq("client_id", ctx.clienteId)
        .order("created_at", { ascending: true });
      if (error) {
        console.warn("[cliente.mensagens] Supabase error:", error.message);
        return [];
      }
      return (data ?? []).map((row) => ({ id: row.id as number, from: row.sender as "client" | "team", text: row.text as string, time: (row.time as string) ?? "" }));
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

