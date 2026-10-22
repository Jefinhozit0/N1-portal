import { describe, expect, it } from "vitest";
import { BANCOS_CONHECIDOS, bancoConhecido, dataPorExtenso, moeda, problemasNotificacao, reaisPorExtenso } from "@shared/notificacao";
import { buildNotificacaoPdf, notificacaoFileName } from "./notificacaoPdf";

const santander = BANCOS_CONHECIDOS[0];
const dados = { nome: "Maria da Silva", cpf: "00000000000", valor: 50000, parcelas: 60, valorParcela: 1845.54, bancoNome: santander.nome, bancoCnpj: santander.cnpj, bancoEndereco: santander.endereco, cidade: "São Paulo", data: "2025-11-14" };

describe("notificação extrajudicial", () => {
  it("writes amounts in words like the model", () => {
    expect(reaisPorExtenso(50000)).toBe("cinquenta mil reais");
    expect(reaisPorExtenso(1845.54)).toBe("um mil oitocentos e quarenta e cinco reais e cinquenta e quatro centavos");
    expect(reaisPorExtenso(848.37)).toBe("oitocentos e quarenta e oito reais e trinta e sete centavos");
    expect(reaisPorExtenso(1100)).toBe("um mil e cem reais");
    expect(reaisPorExtenso(2_000_000)).toBe("dois milhões de reais");
    expect(reaisPorExtenso(1)).toBe("um real");
    expect(reaisPorExtenso(0.5)).toBe("cinquenta centavos");
    expect(moeda(50000)).toBe("R$50.000,00");
  });

  it("notifies Santander for Aymoré and Santander contracts", () => {
    expect(bancoConhecido("AYMORÉ CRÉDITO, FINANCIAMENTO E INVESTIMENTO S.A.")?.cnpj).toBe("90.400.888/0001-42");
    expect(bancoConhecido("BANCO PAN S.A.")).toBeUndefined();
  });

  it("writes the place and date", () => {
    expect(dataPorExtenso("São Paulo", "2025-11-14")).toBe("São Paulo, 14 de novembro de 2025.");
  });

  it("asks for what is missing", () => {
    expect(problemasNotificacao(dados)).toEqual([]);
    expect(problemasNotificacao({ ...dados, bancoEndereco: "" })).toEqual(["Falta o endereço da sede da instituição."]);
    expect(problemasNotificacao({ ...dados, valorParcela: 0, cidade: "3550308" })).toHaveLength(2);
  });

  it("produces a PDF named after the client", async () => {
    const pdf = await buildNotificacaoPdf(dados);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(notificacaoFileName(dados)).toBe("Notificação extrajudicial - MARIA DA SILVA.pdf");
  });
});
