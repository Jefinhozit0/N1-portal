import { Download, FileSpreadsheet, User } from "lucide-react";
import { toast } from "sonner";
import { formatFileSize } from "@shared/processo";
import { LaudoForm } from "@/components/LaudoDialog";
import { trpc } from "@/lib/trpc";

const formatDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Laudos (pareceres técnicos): make one from a contract, and download the ones already attached to clients. */
export default function LaudosPage({ onOpenClient }: { onOpenClient: (row: Record<string, unknown>) => void }) {
  const clientesQuery = trpc.portal.clientes.useQuery(undefined, { retry: false });
  const laudosQuery = trpc.portal.laudos.useQuery(undefined, { retry: false });
  const baixarDocumento = trpc.portal.baixarDocumento.useMutation({ onError: (error) => toast.error(error.message) });

  const rows = (clientesQuery.data ?? []) as Record<string, unknown>[];
  const clients = rows
    .filter((row) => typeof row.id === "number" && typeof row.name === "string" && row.name.trim())
    .map((row) => ({ id: row.id as number, name: (row.name as string).trim() }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const laudos = laudosQuery.data ?? [];

  async function download(id: number) {
    const { url } = await baixarDocumento.mutateAsync({ id });
    window.location.href = url;
  }

  function openClient(id: number) {
    const row = rows.find((item) => item.id === id);
    if (row) onOpenClient(row);
  }

  return <div className="page-content laudos-page">
    <section className="panel laudos-form-panel">
      <div className="panel-heading"><div><h3>Novo laudo</h3><p>Envie o contrato em PDF ou digite os dados. O laudo sai pronto em PDF, com as tabelas e a conclusão.</p></div></div>
      <LaudoForm variant="page" clients={clients} onDone={({ attached }) => { if (attached) laudosQuery.refetch(); }} />
    </section>

    <section className="panel">
      <div className="panel-heading"><div><h3>Laudos anexados</h3><p>{laudosQuery.isLoading ? "Carregando..." : laudos.length ? `${laudos.length} laudo(s) nos cadastros dos clientes` : "Os laudos anexados a um cliente aparecem aqui"}</p></div></div>
      <div className="laudos-list">
        {!laudosQuery.isLoading && laudos.length === 0 && <p className="detail-empty">Nenhum laudo anexado ainda. Escolha um cliente no formulário e marque "Anexar" para guardar o laudo no cadastro dele.</p>}
        {laudos.map((laudo) => <div key={laudo.id} className="laudos-item">
          <span className="laudos-icon"><FileSpreadsheet size={18} /></span>
          <div className="laudos-info">
            <strong>{laudo.nome}</strong>
            <small>{formatDateTime(laudo.createdAt)} · {formatFileSize(laudo.tamanho)}{laudo.enviadoPor ? ` · ${laudo.enviadoPor}` : ""}</small>
          </div>
          {laudo.clientName && <button type="button" className="secondary-button laudos-client" onClick={() => openClient(laudo.clientId)} title="Abrir cadastro do cliente"><User size={14} /> {laudo.clientName}</button>}
          <button type="button" className="icon-button" onClick={() => download(laudo.id).catch(() => undefined)} disabled={baixarDocumento.isPending} aria-label={`Baixar ${laudo.nome}`} title="Baixar laudo"><Download size={16} /></button>
        </div>)}
      </div>
    </section>
  </div>;
}
