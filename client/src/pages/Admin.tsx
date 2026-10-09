import { useState } from "react";
import { DatabaseBackup, History, Link2, MessageCircle, RefreshCw, Search, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "ainda não rodou";

const STATUS_TEXT: Record<string, string> = {
  connected: "Conectado",
  waiting_qr: "Aguardando o QR code",
  connecting: "Conectando...",
  off: "Desligado",
};

/** Administration: corporate WhatsApp, daily backup, reminders and the team's action log. */
export default function AdminPage() {
  // Refreshes often while a QR code is on screen, since WhatsApp replaces it every ~20 seconds.
  const sistema = trpc.admin.sistema.useQuery(undefined, {
    retry: false,
    refetchInterval: (query) => (query.state.data?.whatsapp.status === "connected" ? 30_000 : 5_000),
  });
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const auditoria = trpc.admin.auditoria.useQuery({ busca: buscaAplicada || undefined, limite: 200 }, { retry: false });
  const [confirmLogout, setConfirmLogout] = useState(false);
  const desconectar = trpc.admin.desconectarWhatsApp.useMutation({
    onSuccess: () => { toast.success("WhatsApp desconectado. Um novo QR code aparece em alguns segundos."); setConfirmLogout(false); sistema.refetch(); },
    onError: (error) => toast.error(error.message),
  });
  const fazerBackup = trpc.admin.fazerBackup.useMutation({
    onSuccess: () => { toast.success("Backup feito."); sistema.refetch(); auditoria.refetch(); },
    onError: (error) => toast.error(error.message),
  });

  const data = sistema.data;
  const whatsapp = data?.whatsapp;

  return (
    <div className="page-content admin-page">
      <div className="admin-grid">
        <section className="panel admin-card">
          <div className="admin-card-head"><Smartphone size={18} /><h3>WhatsApp da empresa</h3></div>
          {!whatsapp ? <p className="admin-muted">Carregando...</p> : whatsapp.provider !== "web" ? (
            <p className="admin-muted">{whatsapp.provider === "cloud" ? "O portal usa a API oficial da Meta" : "O WhatsApp do portal está desligado"} (WHATSAPP_PROVIDER={whatsapp.provider} no .env).</p>
          ) : (
            <>
              <p className={`admin-status admin-status-${whatsapp.status}`}><span /> {STATUS_TEXT[whatsapp.status] ?? whatsapp.status}{whatsapp.number ? ` · ${whatsapp.number}` : ""}</p>
              {whatsapp.qr && (
                <div className="admin-qr">
                  <img src={whatsapp.qr} alt="QR code para conectar o WhatsApp da empresa" width={240} height={240} />
                  <p>No celular da empresa: WhatsApp, Configurações, Dispositivos conectados, Conectar um dispositivo. Aponte a câmera para este código.</p>
                </div>
              )}
              <p className="admin-muted">Desde {when(whatsapp.since)}. Os links de acesso e os avisos aos clientes saem por este número.</p>
              {whatsapp.status === "connected" && (
                <Button variant="outline" size="sm" onClick={() => setConfirmLogout(true)}>Desconectar para trocar o número</Button>
              )}
            </>
          )}
        </section>

        <section className="panel admin-card">
          <div className="admin-card-head"><DatabaseBackup size={18} /><h3>Backup diário</h3></div>
          {data && (
            <>
              <p className="admin-muted">Último backup: <b>{when(data.backup.lastRun)}</b>{data.backup.lastResult ? ` · ${data.backup.lastResult}` : ""}</p>
              {data.backup.lastError && <p className="form-message">O último backup falhou: {data.backup.lastError}</p>}
              <p className="admin-muted">Pasta: <code>{data.backup.pasta}</code>. Guarda os últimos 30 dias e uma cópia de cada documento.</p>
              <p className="admin-muted">Para ter uma cópia fora do notebook, aponte BACKUP_DIR no .env para uma pasta do Google Drive ou OneDrive.</p>
              <Button size="sm" disabled={fazerBackup.isPending} onClick={() => fazerBackup.mutate()}><RefreshCw size={15} /> {fazerBackup.isPending ? "Fazendo backup..." : "Fazer backup agora"}</Button>
            </>
          )}
        </section>

        <section className="panel admin-card">
          <div className="admin-card-head"><MessageCircle size={18} /><h3>Avisos automáticos</h3></div>
          {data && (
            <>
              <p className="admin-muted">Clientes recebem aviso por WhatsApp e e-mail quando a equipe responde, muda o status ou anexa um documento: <b>{data.avisosParaClientes ? "ligado" : "desligado (NOTIFY_CLIENTS=off)"}</b>.</p>
              <p className="admin-muted">Lembrete para quem não criou a senha em 2 dias, uma vez, das 9h às 20h. Última verificação: <b>{when(data.lembretes.lastRun)}</b>{data.lembretes.lastResult ? ` · ${data.lembretes.lastResult}` : ""}.</p>
              {data.lembretes.lastError && <p className="form-message">A última verificação falhou: {data.lembretes.lastError}</p>}
            </>
          )}
        </section>

        <section className="panel admin-card">
          <div className="admin-card-head"><Link2 size={18} /><h3>Endereço do portal</h3></div>
          {data && (
            <>
              <p className="admin-address"><a href={data.enderecoPublico} target="_blank" rel="noreferrer">{data.enderecoPublico}</a></p>
              <p className="admin-muted">É o endereço que vai nos links para os clientes. Com APP_URL=auto no .env, ele acompanha o túnel do Cloudflare quando muda.</p>
            </>
          )}
        </section>
      </div>

      <section className="panel admin-log">
        <div className="admin-log-head">
          <div className="admin-card-head"><History size={18} /><h3>Registro de ações</h3></div>
          <form className="admin-search" onSubmit={(event) => { event.preventDefault(); setBuscaAplicada(busca.trim()); }}>
            <Search size={15} />
            <input aria-label="Buscar no registro" placeholder="Buscar por pessoa, ação ou cliente" value={busca} onChange={(event) => setBusca(event.target.value)} />
          </form>
        </div>
        {auditoria.data && !auditoria.data.ready && <p className="form-message">O registro de ações ainda não existe no banco. Rode o arquivo supabase/migrations/20261010_melhorias.sql no Supabase.</p>}
        {auditoria.isLoading && <p className="admin-muted">Carregando...</p>}
        {auditoria.data?.ready && auditoria.data.entries.length === 0 && <p className="admin-muted">{buscaAplicada ? "Nada encontrado." : "Nenhuma ação registrada ainda."}</p>}
        {auditoria.data && auditoria.data.entries.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhes</th></tr></thead>
              <tbody>
                {auditoria.data.entries.map((entry) => (
                  <tr key={entry.id}><td>{when(entry.created_at)}</td><td>{entry.autor}</td><td><strong>{entry.acao}</strong></td><td>{entry.detalhes ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AlertDialog open={confirmLogout} onOpenChange={(open) => !desconectar.isPending && setConfirmLogout(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar o WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>O portal para de enviar links e avisos até alguém escanear o novo QR code. Use isto para trocar o número da empresa.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desconectar.isPending}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={desconectar.isPending} onClick={() => desconectar.mutate()}>{desconectar.isPending ? "Desconectando..." : "Desconectar"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
