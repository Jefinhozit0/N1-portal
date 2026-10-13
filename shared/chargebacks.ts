/**
 * Status the team can choose for a chargeback, with the color shown next to it.
 * "Revertido" and "Negado"/"Cancelado" must stay in DASHBOARD_RULES so they count as won and lost.
 */
export const CHARGEBACK_STATUSES = [
  { label: "Em conferência", tone: "blue" },
  { label: "Documentação enviada", tone: "blue" },
  { label: "Aguardando banco", tone: "yellow" },
  { label: "Em disputa", tone: "yellow" },
  { label: "Revertido", tone: "green" },
  { label: "Negado", tone: "red" },
  { label: "Cancelado", tone: "red" },
] as const;

export type ChargebackStatus = (typeof CHARGEBACK_STATUSES)[number]["label"];
export const CHARGEBACK_STATUS_LABELS = CHARGEBACK_STATUSES.map((status) => status.label) as [ChargebackStatus, ...ChargebackStatus[]];

export function chargebackTone(status: string): string {
  return CHARGEBACK_STATUSES.find((option) => option.label === status)?.tone ?? "blue";
}

/** 1234.5 → "R$ 1.234,50", the format the amount column has always used. */
export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ");
}

/** What the team types: "1.234,56", "1234,56", "R$ 1.234,56" or "1234.56". NaN when it is not a number. */
export function parseBrlInput(value: string): number {
  const cleaned = value.trim().replace(/[^\d.,]/g, "");
  if (!cleaned) return NaN;
  return Number(cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned);
}

/** "2026-10-15" → "15/10/2026", the deadline format the dashboard reads. */
export const isoToBrDate = (iso: string) => iso.split("-").reverse().join("/");

/** "15/10/2026" → "2026-10-15" for a date input; anything else (like "03 out 2026") → "". */
export function brToIsoDate(value: string | null | undefined): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? "").trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

/** What the Sales HUB passes on when a sale is marked with chargeback. */
export type ChargebackDraft = { client: string; amount?: number; vendaId?: number; note?: string };

export type ChargebackHistoryEntry = { at: string; autor: string; acao: string };
