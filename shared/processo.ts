/** Status the team can set on a client's process, with the color shown next to it. */
export const PROCESS_STATUSES = [
  { label: "Em análise", tone: "yellow" },
  { label: "Pendente documentação", tone: "yellow" },
  { label: "Pendente contato", tone: "yellow" },
  { label: "Em andamento", tone: "green" },
  { label: "Em negociação", tone: "green" },
  { label: "Em andamento judicial", tone: "green" },
  { label: "Atenção necessária", tone: "red" },
  { label: "Concluído", tone: "green" },
  { label: "Suspenso", tone: "red" },
] as const;

/** Status of a client who was just registered. */
export const INITIAL_STATUS = PROCESS_STATUSES[0];

export type ProcessTone = "green" | "yellow" | "red";

export function toneForStatus(status: string, fallback: ProcessTone = "yellow"): ProcessTone {
  return PROCESS_STATUSES.find((option) => option.label === status)?.tone ?? fallback;
}

/** Biggest file the team can attach (the browser sends it to the server inside the request). */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type ProcessEventType = "cadastro" | "status" | "progresso" | "documento";

const summaryDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

/**
 * Short text about the case, built from its data. The team sees it in the third person and the
 * client in the second. Documents and events come newest first, as the server lists them.
 */
export function caseSummary(
  data: { name: string; type?: string | null; status?: string | null; progress: number; documents: { created_at: string }[]; events: { titulo: string; created_at: string }[] },
  audience: "equipe" | "cliente",
) {
  const type = data.type || "tipo ainda não definido";
  const status = data.status || "sem status";
  const lastEvent = data.events[0];
  const docs = data.documents.length;
  return [
    audience === "equipe"
      ? `${data.name.split(" ")[0]} tem um processo de ${type}, com status "${status}" e ${data.progress}% de progresso.`
      : `Seu processo de ${type} está com status "${status}" e ${data.progress}% de progresso.`,
    docs === 0
      ? (audience === "equipe" ? "Nenhum documento anexado até agora." : "A equipe ainda não anexou documentos.")
      : `${docs} ${docs === 1 ? "documento anexado" : "documentos anexados"}, o mais recente em ${summaryDate(data.documents[0].created_at)}.`,
    lastEvent ? `Última movimentação: ${lastEvent.titulo.toLowerCase()} em ${summaryDate(lastEvent.created_at)}.` : "",
  ].filter(Boolean).join(" ");
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
