import { FormEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ChevronRight, Clock3, Eye, EyeOff, LockKeyhole, LogOut, Send, X } from "lucide-react";
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
  const processoQuery = trpc.cliente.meuProcesso.useQuery(undefined, { retry: false, enabled: termsAccepted });
  const mensagensQuery = trpc.cliente.mensagens.useQuery(undefined, { retry: false, refetchInterval: 30_000, enabled: termsAccepted });
  const [draft, setDraft] = useState("");
  const enviarMensagem = trpc.cliente.enviarMensagem.useMutation({
    // Returning the refetch keeps the mutation pending until the new message is in the list,
    // so the "Enviando..." bubble is replaced without flicker.
    onSuccess: (_data, variables) => {
      if (variables.assunto) {
        setBotTrail([{ id: nextBotId(), from: "bot", text: TICKET_SENT_REPLY }]);
        setBotOptions(["menu"]);
        setTicketOpen(false);
        setTopic("Outros assuntos");
      }
      return mensagensQuery.refetch();
    },
    onError: (_error, variables) => setDraft((current) => current || variables.text),
  });
  const chatBody = useRef<HTMLDivElement>(null);

  // Scripted assistant: lives only in this screen, nothing it says is saved. Only tickets reach the team.
  const [botTrail, setBotTrail] = useState<{ id: number; from: "bot" | "client"; text: string }[]>([]);
  const [botOptions, setBotOptions] = useState<BotStepId[]>(BOT_STEPS.menu.options);
  const [topic, setTopic] = useState<TicketTopic>("Outros assuntos");
  const [ticketOpen, setTicketOpen] = useState(false);
  const botIdRef = useRef(0);
  const nextBotId = () => ++botIdRef.current;

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

  useEffect(() => {
    // Greet once, as soon as the client's name is known.
    if (processo && botIdRef.current === 0) setBotTrail([{ id: nextBotId(), from: "bot", text: greeting(processInfo) }]);
  }, [processo]);

  useEffect(() => {
    const body = chatBody.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [messages.length, pendingText, botTrail.length]);

  function chooseOption(stepId: BotStepId) {
    const step = BOT_STEPS[stepId];
    const nextTopic: TicketTopic = stepId === "menu" ? "Outros assuntos" : step.topic ?? topic;
    setBotTrail((trail) => [
      ...trail,
      { id: nextBotId(), from: "client", text: step.label },
      { id: nextBotId(), from: "bot", text: step.reply(processInfo, nextTopic) },
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
      <main className="client-portal-main">
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
          <section className="client-portal-card client-portal-hero">
            <span className="eyebrow eyebrow-muted">Acompanhamento do processo</span>
            <h1>Olá, {firstName}</h1>
            <div className="client-portal-status">
              <div><small>Tipo de processo</small><strong>{processo.type || "Em definição"}</strong></div>
              <div><small>Situação</small><StatusPill tone={processo.tone ?? "green"}>{processo.status || "Em andamento"}</StatusPill></div>
              <div><small>Última atualização</small><strong><Clock3 size={16} /> {processo.updated || "—"}</strong></div>
            </div>
            {processo.services && processo.services.length > 0 && (
              <div className="client-portal-services">
                <small>Serviços contratados</small>
                <div>{processo.services.map((service) => <span key={service} className="client-portal-chip">{service}</span>)}</div>
              </div>
            )}
          </section>

          <section className="client-portal-card client-portal-chat">
            <div className="client-portal-chat-head">
              <h2>Fale com a equipe</h2>
              <p><LockKeyhole size={13} /> Conversa privada com a N1 Soluções</p>
            </div>
            <div className="client-portal-chat-body" ref={chatBody} aria-live="polite">
              {mensagensQuery.isLoading && <p className="client-portal-empty">Carregando mensagens...</p>}
              {messages.map((message) => (
                <div key={message.id} className={`client-bubble ${message.from === "client" ? "client-bubble-own" : "client-bubble-team"}`}>
                  {message.from === "team" && <span className="client-bubble-author">Equipe N1</span>}
                  <p>{message.text}</p>
                  <small>{message.time} {message.from === "client" && <CheckCircle2 size={12} />}</small>
                </div>
              ))}
              {botTrail.map((entry) => entry.from === "bot" ? (
                <div key={entry.id} className="client-bubble client-bubble-team client-bubble-bot">
                  <span className="client-bubble-author"><Bot size={13} /> Assistente N1</span>
                  <p>{entry.text}</p>
                </div>
              ) : (
                <div key={entry.id} className="client-bubble client-bubble-own client-bubble-choice"><p>{entry.text}</p></div>
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
        </>}
      </main>
      <footer className="app-footer">© 2026 N1 Soluções <span>·</span> Todos os direitos reservados.</footer>
    </div>
  );
}
