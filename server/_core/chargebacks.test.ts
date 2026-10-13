import { describe, expect, it } from "vitest";
import { CHARGEBACK_STATUSES, brToIsoDate, formatBrl, parseBrlInput } from "@shared/chargebacks";
import { DASHBOARD_RULES } from "@shared/dashboard";
import { parseDeadline, parseMoney } from "./dashboard";
import { chargebackInput, chargebackRow, describeChanges } from "./chargebacks";

const input = chargebackInput.parse({ client: "Ana Souza", clienteId: 7, bank: "Nubank", amount: 1234.5, deadline: "2026-10-20", status: "Em conferência" });

describe("chargebacks", () => {
  it("writes the amount and deadline in the formats the dashboard reads", () => {
    const row = chargebackRow(input);
    expect(row).toMatchObject({ client: "Ana Souza", cliente_id: 7, venda_id: null, bank: "Nubank", amount: "R$ 1.234,50", deadline: "20/10/2026", status: "Em conferência", tone: "blue", observacao: null });
    expect(parseMoney(row.amount)).toBe(1234.5);
    expect(parseDeadline(row.deadline)?.toDateString()).toBe(new Date(2026, 9, 20).toDateString());
  });

  it("every closed status on the list counts as won or lost on the dashboard", () => {
    const won = DASHBOARD_RULES.chargebackSuccessStatuses as readonly string[];
    const lost = DASHBOARD_RULES.chargebackFailedStatuses as readonly string[];
    for (const status of CHARGEBACK_STATUSES) {
      if (status.tone === "green") expect(won).toContain(status.label);
      if (status.tone === "red") expect(lost).toContain(status.label);
      if (status.tone === "blue" || status.tone === "yellow") expect([...won, ...lost]).not.toContain(status.label);
    }
  });

  it("describes each change for the history", () => {
    const before = chargebackRow(input);
    const after = chargebackRow({ ...input, status: "Revertido", amount: 1500, observacao: "Protocolo 123" });
    expect(describeChanges(before, after)).toEqual(["Status: Em conferência → Revertido", "Valor: R$ 1.234,50 → R$ 1.500,00", "Observação alterada"]);
    expect(describeChanges(before, chargebackRow(input))).toEqual([]);
    expect(describeChanges({ client: "Ana Souza", status: null }, chargebackRow({ ...input, bank: "", amount: null, deadline: null, clienteId: null }))).toEqual(["Status: vazio → Em conferência"]);
  });

  it("reads what the team types", () => {
    expect(parseBrlInput("1.234,56")).toBe(1234.56);
    expect(parseBrlInput("R$ 900")).toBe(900);
    expect(parseBrlInput("abc")).toBeNaN();
    expect(formatBrl(0)).toBe("R$ 0,00");
    expect(brToIsoDate("15/10/2026")).toBe("2026-10-15");
    expect(brToIsoDate("03 out 2026")).toBe("");
  });

  it("rejects a status that is not on the list", () => {
    expect(chargebackInput.safeParse({ client: "Ana", status: "Qualquer coisa" }).success).toBe(false);
  });
});
