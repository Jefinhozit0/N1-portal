import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ChevronRight, ClipboardList, Clock3, Download, Eye, EyeOff, FileText, LockKeyhole, LogOut, MessageCircle, Send, X } from "lucide-react";
import { formatFileSize } from "@shared/processo";

const formatDay = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).replace(" de ", " ").replace(".", "");
import type { TicketTopic } from "@shared/tickets";
import { TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION } from "@shared/termos";
import { BOT_STEPS, TICKET_SENT_REPLY, greeting, type BotStepId, type ProcessInfo } from "./clientChatbot";
import { N1Logo } from "@/components/N1Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { StatusPill } from "./Home";

/** Shown on the first login with the temporary password sent by e-mail. */
export function ChangePasswordScreen({ onDone, onLogout }: { onDone: () => void; onLogout: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setMessage("A senha precisa ter pelo menos 8 caracteres.");
    if (password !== confirmPassword) return setMessage("As senhas não conferem.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password, data: { must_change_password: false } });
    setSaving(false);
    if (error) return setMessage(error.code === "same_password" ? "Escolha uma senha diferente da provisória." : "Não foi possível salvar a senha. Tente novamente.");
    onDone();
  }

  return (
    <main className="client-portal-center">
      <div className="login-panel-inner">
        <N1Logo size="md" />
        <h2>Crie sua senha</h2>
        <p className="login-subtitle">Este é seu primeiro acesso. Troque a senha provisória recebida por e-mail por uma senha só sua.</p>
        <form onSubmit={submit} className="login-form">
          <label>Nova senha<div className="password-wrap"><input required minLength={8} autoFocus autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="Mínimo de 8 caracteres" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          <label>Confirmar senha<input required minLength={8} autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="Digite a senha novamente" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          {message && <p className="form-message">{message}</p>}
          <button className="primary-button login-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar e continuar"} <ChevronRight size={18} /></button>
        </form>
        <button className="link-button" type="button" onClick={onLogout}>Sair</button>
      </div>
    </main>
  );
}

/** What a logged-in client sees: only their own process and the conversation with the team. */
export function ClientPortal({ onLogout }: { onLogout: () => void }) {
  // The process and the chat only load once the current terms are accepted (the server enforces it too).
  const termosQuery = trpc.cliente.termos.useQuery(undefined, { retry: false });
  const termsAccepted = termosQuery.data?.accepted === true;
  const aceitarTermos = trpc.cliente.aceitarTermos.useMutation({ onSuccess: () => termosQuery.refetch() });
  const [agreed, setAgreed] = useState(false);
  const processoQuery = trpc.cliente.meuProcesso.useQuery(undefined, { retry: false, enabled: termsAccepted, refetchInterval: 60_000 });
  const documentosQuery = trpc.cliente.documentos.useQuery(undefined, { retry: false, enabled: termsAccepted, refetchInterval: 60_000 });
  const historicoQuery = trpc.cliente.historico.useQuery(undefined, { retry: false, enabled: termsAccepted, refetchInterval: 60_000 });
  const documentos = documentosQuery.data ?? [];
  const historico = historicoQuery.data ?? [];
  const baixarDocumento = trpc.cliente.baixarDocumento.useMutation();
  async function downloadDocument(id: number) {
    const { url } = await baixarDocumento.mutateAsync({ id }).catch(() => ({ url: "" }));
    // The link is signed to download the file, so the portal stays open.
    if (url) window.location.href = url;
  }
  const mensagensQuery = trpc.cliente.mensagens.useQuery(undefined, { retry: false, refetchInterval: 30_000, enabled: termsAccepted });
  const [draft, setDraft] = useState("");
  // On a phone the process and the chat are two tabs; on a computer both stay on screen.
  const [tab, setTab] = useState<"processo" | "conversa">("processo");
  const enviarMensagem = trpc.cliente.enviarMensagem.useMutation({
    // Returning the refetch keeps the mutation pending until the new message is in the list,
    // so the "Enviando..." bubble is replaced without flicker.
    onSuccess: async (_data, variables) => {
      await mensagensQuery.refetch();
      if (variables.assunto) {
        saveAssistant([{ from: "bot", text: TICKET_SENT_REPLY }]);
        setBotOptions(["menu"]);
        setTicketOpen(false);
        setTopic("Outros assuntos");
      }
    },
    onError: (_error, variables) => setDraft((current) => current || variables.text),
  });
  const chatBody = useRef<HTMLDivElement>(null);

  // Scripted assistant. What it says and what the client picks is saved with the messages, so the
  // conversation is still there after logging out. Only tickets reach the team.
  // botTrail holds the lines shown right away while they are being saved.
  const [botTrail, setBotTrail] = useState<{ id: number; from: "bot" | "choice"; text: string }[]>([]);
  const [botOptions, setBotOptions] = useState<BotStepId[]>(BOT_STEPS.menu.options);
  const [topic, setTopic] = useState<TicketTopic>("Outros assuntos");
  const [ticketOpen, setTicketOpen] = useState(false);
  const botIdRef = useRef(0);
  const nextBotId = () => ++botIdRef.current;
  const registrarAssistente = trpc.cliente.registrarAssistente.useMutation();
  // Saves run one after another so the conversation keeps its order.
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const greeted = useRef(false);

  const processo = processoQuery.data;
  const firstName = processo?.name.split(" ")[0] ?? "";
  const messages = mensagensQuery.data ?? [];
  const pendingText = enviarMensagem.isPending ? enviarMensagem.variables?.text : undefined;
  const processInfo: ProcessInfo = {
    firstName,
    type: processo?.type || "processo em definição",
    status: processo?.status || "Em andamento",
    updated: processo?.updated || "sem data registrada",
  };

  function saveAssistant(entries: { from: "bot" | "choice"; text: string }[]) {
    const shown = entries.map((entry) => ({ ...entry, id: nextBotId() }));
    setBotTrail((trail) => [...trail, ...shown]);
    saveQueue.current = saveQueue.current
      .then(() => registrarAssistente.mutateAsync({ entries }))
      .then(async (result) => {
        // Once saved, the lines come back with the messages; if saving failed they stay on screen.
        if (!result.saved) return;
        await mensagensQuery.refetch();
        setBotTrail((trail) => trail.filter((line) => !shown.some((saved) => saved.id === line.id)));
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    // Greet only on the first visit; after that the saved conversation is shown as it was.
    if (!processo || !mensagensQuery.isSuccess || greeted.current) return;
    greeted.current = true;
    if (!messages.some((message) => message.from === "bot")) saveAssistant([{ from: "bot", text: greeting(processInfo) }]);
  }, [processo, mensagensQuery.isSuccess]);

  useEffect(() => {
    const body = chatBody.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [messages.length, pendingText, botTrail.length, tab]);

  function chooseOption(stepId: BotStepId) {
    const step = BOT_STEPS[stepId];
    const nextTopic: TicketTopic = stepId === "menu" ? "Outros assuntos" : step.topic ?? topic;
    saveAssistant([
      { from: "choice", text: step.label },
      { from: "bot", text: step.reply(processInfo, nextTopic) },
    ]);
    setBotOptions(step.options);
    setTopic(nextTopic);
    setTicketOpen(Boolean(step.opensTicket));
  }

  function cancelTicket() {
    setTicketOpen(false);
    setTopic("Outros assuntos");
    setBotOptions(BOT_STEPS.menu.options);
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || enviarMensagem.isPending) return;
    enviarMensagem.mutate({ text, assunto: ticketOpen ? topic : undefined });
    setDraft("");
  }

  return (
    <div className="client-portal">
      <header className="client-portal-header">
        <N1Logo size="sm" />
        <div className="client-portal-header-actions">
          <ThemeToggle />
          <button className="secondary-button" onClick={onLogout}><LogOut size={15} /> Sair</button>
        </div>
      </header>
      <main className={`client-portal-main ${processo ? "client-portal-main-wide" : ""}`}>
        {termosQuery.isLoading && <section className="client-portal-card" aria-busy="true"><p className="client-portal-muted">Carregando...</p></section>}
        {termosQuery.error && (
          <section className="client-portal-card client-portal-problem">
            <AlertTriangle size={22} />
            <div>
              <h2>Não foi possível abrir o portal</h2>
              <p>{termosQuery.error.message} Fale com a equipe N1 Soluções.</p>
            </div>
          </section>
        )}
        {termosQuery.data && !termsAccepted && (
          <section className="client-portal-card client-terms">
            <span className="eyebrow eyebrow-muted">Antes de continuar</span>
            <h1>{TERMS_TITLE}</h1>
            <p className="client-portal-muted">Leia e aceite para acompanhar seu processo. Versão {TERMS_VERSION}.</p>
            <div className="client-terms-text" tabIndex={0} aria-label="Texto dos termos">
              {TERMS_SECTIONS.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.text}</p></section>)}
            </div>
            <label className="client-terms-agree"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> Li e aceito os termos de uso e o tratamento dos meus dados.</label>
            {aceitarTermos.error && <p className="form-message">{aceitarTermos.error.message}</p>}
            <div className="client-terms-actions">
              <button className="primary-button" disabled={!agreed || aceitarTermos.isPending} onClick={() => aceitarTermos.mutate({ version: TERMS_VERSION })}>{aceitarTermos.isPending ? "Registrando..." : "Aceitar e continuar"}</button>
            </div>
          </section>
        )}
        {termsAccepted && processoQuery.isLoading && <section className="client-portal-card" aria-busy="true"><p className="client-portal-muted">Carregando seu processo...</p></section>}
        {processoQuery.error && (
          <section className="client-portal-card client-portal-problem">
            <AlertTriangle size={22} />
            <div>
              <h2>Não encontramos seu processo</h2>
              <p>{processoQuery.error.message} Fale com a equipe N1 Soluções.</p>
            </div>
          </section>
        )}
        {processo && <>
          <div className="client-portal-tabs" role="tablist" aria-label="Seções do portal">
            <button type="button" role="tab" aria-selected={tab === "processo"} onClick={() => setTab("processo")}><ClipboardList size={16} /> Meu processo</button>
            <button type="button" role="tab" aria-selected={tab === "conversa"} onClick={() => setTab("conversa")}><MessageCircle size={16} /> Conversa</button>
          </div>
          <div className="client-portal-layout" data-tab={tab}>
          <div className="client-portal-side">
          <section className="client-portal-card client-portal-hero">
            <span className="eyebrow eyebrow-muted">Acompanhamento do processo</span>
            <h1>Olá, {firstName}</h1>
            <div className="client-portal-status">
              <div><small>Tipo de processo</small><strong>{processo.type || "Em definição"}</strong></div>
              <div><small>Situação</small><StatusPill tone={processo.tone ?? "green"}>{processo.status || "Em andamento"}</StatusPill></div>
              <div><small>Última atualização</small><strong><Clock3 size={16} /> {processo.updated || "—"}</strong></div>
            </div>
            <div className="client-portal-progress">
              <div><small>Progresso do caso</small><strong>{processo.progresso ?? 0}%</strong></div>
              <div className="progress-bar-container" role="progressbar" aria-valuenow={processo.progresso ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do caso">
                <div className="progress-bar-fill" style={{ width: `${processo.progresso ?? 0}%` }} />
              </div>
            </div>
            {processo.services && processo.services.length > 0 && (
              <div className="client-portal-services">
                <small>Serviços contratados</small>
                <div>{processo.services.map((service) => <span key={service} className="client-portal-chip">{service}</span>)}</div>
              </div>
            )}
            <button type="button" className="primary-button client-portal-to-chat" onClick={() => setTab("conversa")}><MessageCircle size={17} /> Falar com a equipe</button>
          </section>

          <section className="client-portal-card client-portal-block">
            <h2>Documentos</h2>
            {documentosQuery.isLoading && <p className="client-portal-muted">Carregando...</p>}
            {documentosQuery.isSuccess && documentos.length === 0 && <p className="client-portal-muted">Nenhum documento por enquanto. Quando a equipe anexar um arquivo, ele aparece aqui.</p>}
            <ul className="client-doc-list">
              {documentos.map((doc) => (
                <li key={doc.id}>
                  <FileText size={18} />
                  <div><strong>{doc.nome}</strong><small>{formatDay(doc.created_at)} · {formatFileSize(doc.tamanho)}</small></div>
                  <button type="button" className="icon-button" disabled={baixarDocumento.isPending} onClick={() => downloadDocument(doc.id)} aria-label={`Baixar ${doc.nome}`} title="Baixar"><Download size={17} /></button>
                </li>
              ))}
            </ul>
            {baixarDocumento.error && <p className="form-message">{baixarDocumento.error.message}</p>}
          </section>

          <section className="client-portal-card client-portal-block">
            <h2>Histórico</h2>
            {historicoQuery.isSuccess && historico.length === 0 && <p className="client-portal-muted">Nada registrado ainda.</p>}
            <ol className="client-history">
              {historico.map((event) => (
                <li key={event.id}>
                  <strong>{event.titulo}</strong>
                  {event.descricao && <p>{event.descricao}</p>}
                  <small>{formatDay(event.created_at)}</small>
                </li>
              ))}
            </ol>
          </section>
          </div>

          <section className="client-portal-card client-portal-chat">
            <div className="client-portal-chat-head">
              <h2>Fale com a equipe</h2>
              <p><LockKeyhole size={13} /> Conversa privada com a N1 Soluções</p>
            </div>
            <div className="client-portal-chat-body" ref={chatBody} aria-live="polite">
              {mensagensQuery.isLoading && <p className="client-portal-empty">Carregando mensagens...</p>}
              {messages.map((message) => message.from === "bot" ? (
                <div key={message.id} className="client-bubble client-bubble-team client-bubble-bot">
                  <span className="client-bubble-author"><Bot size={13} /> Assistente N1</span>
                  <p>{message.text}</p>
                  <small>{message.time}</small>
                </div>
              ) : message.from === "choice" ? (
                <div key={message.id} className="client-bubble client-bubble-own client-bubble-choice"><p>{message.text}</p></div>
              ) : (
                <div key={message.id} className={`client-bubble ${message.from === "client" ? "client-bubble-own" : "client-bubble-team"}`}>
                  {message.from === "team" && <span className="client-bubble-author">Equipe N1</span>}
                  <p>{message.text}</p>
                  <small>{message.time} {message.from === "client" && <CheckCircle2 size={12} />}</small>
                </div>
              ))}
              {botTrail.map((entry) => entry.from === "bot" ? (
                <div key={`local-${entry.id}`} className="client-bubble client-bubble-team client-bubble-bot">
                  <span className="client-bubble-author"><Bot size={13} /> Assistente N1</span>
                  <p>{entry.text}</p>
                </div>
              ) : (
                <div key={`local-${entry.id}`} className="client-bubble client-bubble-own client-bubble-choice"><p>{entry.text}</p></div>
              ))}
              {pendingText && <div className="client-bubble client-bubble-own client-bubble-pending"><p>{pendingText}</p><small>Enviando...</small></div>}
              {!enviarMensagem.isPending && botOptions.length > 0 && (
                <div className="client-bot-options" role="group" aria-label="Opções do assistente">
                  {botOptions.map((stepId) => <button key={stepId} type="button" onClick={() => chooseOption(stepId)}>{BOT_STEPS[stepId].label}</button>)}
                </div>
              )}
            </div>
            {enviarMensagem.error && <p className="client-portal-send-error" role="alert">Não foi possível enviar sua mensagem. Tente novamente.</p>}
            {ticketOpen && (
              <div className="client-ticket-bar">
                <span>Novo ticket · <b>{topic}</b></span>
                <button type="button" className="icon-button" onClick={cancelTicket} aria-label="Cancelar ticket" title="Cancelar ticket"><X size={15} /></button>
              </div>
            )}
            <form className="chat-composer" onSubmit={sendMessage}>
              <input aria-label="Mensagem para a equipe" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={ticketOpen ? `Escreva sua dúvida sobre "${topic}"...` : "Digite sua mensagem..."} maxLength={2000} />
              <button type="submit" className="send-button" aria-label="Enviar mensagem" disabled={enviarMensagem.isPending || !draft.trim()}><Send size={17} /></button>
            </form>
          </section>
          </div>
        </>}
      </main>
      <footer className="app-footer">© 2026 N1 Soluções <span>·</span> Todos os direitos reservados.</footer>
    </div>
  );
}
