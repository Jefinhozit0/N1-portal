import { z } from "zod";
import { CHARGEBACK_STATUS_LABELS, chargebackTone, formatBrl, isoToBrDate, type ChargebackHistoryEntry } from "@shared/chargebacks";

export const chargebackInput = z.object({
  client: z.string().trim().min(1, "Informe o cliente.").max(200),
  clienteId: z.number().int().positive().nullable().default(null),
  vendaId: z.number().int().positive().nullable().default(null),
  bank: z.string().trim().max(120).default(""),
  amount: z.number().min(0, "O valor não pode ser negativo.").max(100_000_000).nullable().default(null),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de prazo inválida.").nullable().default(null),
  status: z.enum(CHARGEBACK_STATUS_LABELS),
  observacao: z.string().trim().max(2000).default(""),
});

export type ChargebackInput = z.infer<typeof chargebackInput>;

/** The columns written for a chargeback, in the formats the list and the dashboard already read. */
export function chargebackRow(input: ChargebackInput) {
  return {
    client: input.client,
    cliente_id: input.clienteId,
    venda_id: input.vendaId,
    bank: input.bank || null,
    amount: input.amount === null ? null : formatBrl(input.amount),
    deadline: input.deadline ? isoToBrDate(input.deadline) : null,
    status: input.status,
    tone: chargebackTone(input.status),
    observacao: input.observacao || null,
  };
}

type Row = ReturnType<typeof chargebackRow>;
const FIELDS: { key: keyof Row; label: string }[] = [
  { key: "client", label: "Cliente" },
  { key: "bank", label: "Instituição" },
  { key: "amount", label: "Valor" },
  { key: "deadline", label: "Prazo" },
];

/** One line per field that changed, e.g. 'Status: Em conferência → Revertido'. */
export function describeChanges(before: Partial<Record<keyof Row, unknown>>, after: Row): string[] {
  const show = (value: unknown) => (value === null || value === undefined || value === "" ? "vazio" : String(value));
  const changes: string[] = [];
  if ((before.status ?? null) !== after.status) changes.push(`Status: ${show(before.status)} → ${after.status}`);
  for (const { key, label } of FIELDS) {
    if ((before[key] ?? null) !== (after[key] ?? null)) changes.push(`${label}: ${show(before[key])} → ${show(after[key])}`);
  }
  if ((before.observacao ?? null) !== (after.observacao ?? null)) changes.push("Observação alterada");
  if ((before.cliente_id ?? null) !== (after.cliente_id ?? null)) changes.push(after.cliente_id ? "Ligado ao cadastro do cliente" : "Desligado do cadastro do cliente");
  return changes;
}

export function historyEntry(autor: string | undefined, acao: string, at = new Date()): ChargebackHistoryEntry {
  return { at: at.toISOString(), autor: autor ?? "equipe", acao };
}

export const CHARGEBACK_MIGRATION = "Rode o arquivo supabase/migrations/20261013_chargebacks_cadastro.sql no SQL Editor do Supabase.";

export const chargebackErrorMessage = (message: string) =>
  /cliente_id|venda_id|observacao|atualizado_em|historico|schema cache/i.test(message)
    ? `O banco ainda não tem os campos novos dos chargebacks. ${CHARGEBACK_MIGRATION}`
    : message;
