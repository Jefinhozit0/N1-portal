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

export type ProcessTone = "green" | "yellow" | "red";

export function toneForStatus(status: string, fallback: ProcessTone = "yellow"): ProcessTone {
  return PROCESS_STATUSES.find((option) => option.label === status)?.tone ?? fallback;
}

/** Biggest file the team can attach (the browser sends it to the server inside the request). */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type ProcessEventType = "cadastro" | "status" | "progresso" | "documento";

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
