import { describe, expect, it } from "vitest";
import { avisosLaudo, calcularLaudo, emptyLaudo, impliedRate, parseBRL, problemasLaudo } from "@shared/laudo";
import { type Line, extrairContrato } from "./laudoContrato";
import { buildLaudoPdf } from "./laudoPdf";

/** "[50]Label [489]R$ 1,00" → a line with its items at those x positions (as pdf.js gives them). */
const line = (y: number, spec: string): Line => {
  const items = [...spec.matchAll(/\[(\d+)\]([^[]*)/g)].map((match) => ({ x: Number(match[1]), y, text: match[2].trim() })).filter((item) => item.text);
  return { page: 1, y, items, text: items.map((item) => item.text).join(" ") };
};

// Page 1 of a SIM / Aymoré CCB (crédito pessoal com garantia de veículo), personal data replaced.
const SIM_CCB = [
  line(840, "[147]AYMORÉ CRÉDITO, FINANCIAMENTO E INVESTIMENTO S.A. CNPJ: 07.707.650/0001-10"),
  line(827, "[169]CÉDULA DE CRÉDITO BANCÁRIO - CRÉDITO PESSOAL COM GARANTIA DE VEÍCULO"),
  line(811, "[258]OPERAÇAO N° 663795516"),
  line(763, "[50]Nome do Cliente: [123]MARIA DA SILVA EXEMPLO"),
  line(750, "[50]CPF: [85]000.000.000-00 [320]RG: [340]00000000"),
  line(710, "[426]COROLLA GLI 1.8 FLEX 16V"),
  line(705, "[50]Veículo (Marca): [123]TOYOTA [221]Ano-modelo: [277]2017/2018 [391]Modelo:"),
  line(700, "[426]AUT."),
  line(662, "[51]Valor do veículo [144]R$ 83.440,00 [221]Cor: [246]CINZA"),
  line(636, "[27]B.1 [50]Valor Solicitado [489]R$ 50.000,00"),
  line(621, "[50]Seguro (s) - financiado (s):"),
  line(608, "[27]B.2 [50]Discriminação do(s) seguro(s) se houver: [214]SIM PROTEGIDO COM DESEMPREGO [468]R$ 3.767,92 [536]6,74%"),
  line(595, "[50]Seguradora: [115]ZURICH SANTANDER BRASIL SEG PREV S/A"),
  line(584, "[27]B.3 [50]Registro contrato - Cartório (cf. legislação estadual) - financiado: [501]R$ 0,00"),
  line(571, "[27]B.4 [50]Registro contrato - órgão de trânsito (Res. 320 CONTRAN) - financiado: [496]R$ 305,97"),
  line(558, "[27]B.5 [50]Subtotal (B.1+B.2+B.3+B.4): [489]R$ 54.073,89"),
  line(520, "[27]C.1 [50]Tarifa de Cadastro [194]Isenta: [246]sim [281]não [319]Financiada: [389]sim [429]não [480]R$ 0,00 [537]0,00%"),
  line(507, "[27]C.2 [50]Tarifa de Avaliação de bem [194]Isenta: [246]sim [281]não [319]Financiada: [389]sim [429]não [480]R$ 0,00 [537]0,00%"),
  line(493, "[27]C.3 [50]Total de tarifas a serem financiadas [480]R$ 0,00 [537]0,00%"),
  line(467, "[27]D.1 [50]Valor total a ser financiado sem impostos (B.5 + C.3) [489]R$ 54.073,89"),
  line(455, "[27]D.2 [49]IOF - financiado: [249]sim [289]não [352]alíquota: [418]3,00% [471]R$ 1.613,10 [537]2,89%"),
  line(442, "[27]D.3 [49]IOF - adicional (Decreto 6.339/08) - financiado: [249]sim [289]não [352]alíquota: [418]0,38% [475]R$ 198,05 [537]0,35%"),
  line(428, "[27]D.4 [49]Total de impostos a serem financiados [471]R$ 1.811,15 [537]3,24%"),
  line(402, "[27]E.1 [50]Data do 1° Vencimento [494]06/02/2025"),
  line(389, "[27]E.2 [50]Número de parcelas mensais: [512]60"),
  line(376, "[27]E.3 [50]Valor total das parcelas intermediárias (quando houver) [501]R$ 0,00"),
  line(362, "[398]mensal % am: [470]anual % a.a.:"),
  line(350, "[27]E.4 [50]Taxa de juros mensal e anual"),
  line(340, "[415]2,59% [480]35,91%"),
  line(327, "[27]E.5 [50]Valor de cada parcela mensal [465]null [489]0,03 [492]R$ 1.845,54"),
  line(309, "[27]E.6 [50]VALOR TOTAL CONTRATADO (COM IMPOSTOS) (D.1 + D.4) [468]R$ 55.885,04 [537]1,00%"),
  line(292, "[32]F [50]VALOR TOTAL PAGO AO FINAL (soma das parcelas) [466]R$ 110.732,40"),
  line(252, "[31]H [50]Prazo de validade do orçamento (²): 15 dias [312]Local: RIOLANDIA"),
  line(208, "[214]Assinado eletronicamente mediante login/senha por MARIA DA SILVA"),
  line(198, "[34]I [208]EXEMPLO, em Terça-feira, 7 de Janeiro de 2025 às 13:38:21 através de iPhone-OS iPhone -"),
];

describe("extrairContrato", () => {
  const { dados } = extrairContrato(SIM_CCB);

  it("reads the parties, the vehicle and the dates", () => {
    expect(dados).toMatchObject({
      contrato: "663795516",
      contratante: "MARIA DA SILVA EXEMPLO",
      instituicao: "AYMORÉ CRÉDITO, FINANCIAMENTO E INVESTIMENTO S.A.",
      garantia: "TOYOTA COROLLA GLI 1.8 FLEX 16V AUT. 2017/2018",
      dataContrato: "07/01/2025",
      primeiroVencimento: "06/02/2025",
    });
  });

  it("reads the amounts, the term and the rates", () => {
    expect(dados).toMatchObject({ valorSolicitado: 50000, valorFinanciado: 55885.04, valorParcela: 1845.54, parcelas: 60, taxaMensal: 2.59, taxaAnual: 35.91, iof: 1811.15 });
  });

  it("adds the charges and leaves the ones at zero as absent", () => {
    expect(dados.encargos).toEqual({ seguros: 3767.92, registro: 305.97, cadastro: null, avaliacao: null });
    expect(problemasLaudo(dados)).toEqual([]);
    expect(avisosLaudo(dados)).toEqual([]);
  });

  it("gives back an empty laudo for a PDF without text", () => {
    expect(extrairContrato([]).encontrados).toEqual([]);
  });
});

describe("calcularLaudo", () => {
  // Same numbers as the parecer the team made by hand for this contract.
  const laudo = calcularLaudo(extrairContrato(SIM_CCB).dados);

  it("uses the rate the payment implies, not the rounded one in the contract", () => {
    expect(laudo.taxaEfetiva).toBeCloseTo(0.0259053, 6);
    expect(laudo.original.linhas[0]).toMatchObject({ mes: 1 });
    expect(laudo.original.linhas[0].juros).toBeCloseTo(1447.72, 2);
    expect(laudo.original.linhas[1].juros).toBeCloseTo(1437.41, 2);
  });

  it("recalculates without the charges", () => {
    expect(laudo.encargos).toBe(4073.89);
    expect(laudo.recalculado.valorFinanciado).toBe(51811.15);
    expect(laudo.recalculado.prestacao).toBeCloseTo(1711, 2);
    expect(laudo.recalculado.linhas.at(-1)!.prestacao).toBeCloseTo(1711, 2);
    expect(laudo.recalculado.totalPago).toBeCloseTo(102660.26, 1);
    expect(laudo.diferencaParcela).toBe(134.54);
    expect(laudo.diferencaTotal).toBe(8072.4);
  });

  it("pays the debt off exactly, and the totals add up", () => {
    for (const tabela of [laudo.original, laudo.recalculado]) {
      expect(tabela.linhas).toHaveLength(60);
      expect(tabela.linhas.at(-1)!.saldo).toBe(0);
      expect(tabela.totalAmortizado).toBeCloseTo(tabela.valorFinanciado, 2);
      expect(tabela.totalPago).toBeCloseTo(tabela.totalAmortizado + tabela.totalJuros, 2);
    }
    expect(laudo.original.totalPago).toBeCloseTo(110732.4, 1);
  });

  it("falls back to the written rate when there is no payment", () => {
    const semParcela = calcularLaudo({ ...extrairContrato(SIM_CCB).dados, valorParcela: 0 });
    expect(semParcela.taxaEfetiva).toBe(0.0259);
    expect(semParcela.original.prestacao).toBe(1845.32);
  });

  it("reads amounts the way people type them", () => {
    expect(["R$ 50.000,00", "50000,00", "50000.00", "50000", "50.000"].map(parseBRL)).toEqual([50000, 50000, 50000, 50000, 50000]);
    expect(["1.845,54", "1845.54", "2,59%", "0,5"].map(parseBRL)).toEqual([1845.54, 1845.54, 2.59, 0.5]);
    expect(parseBRL("")).toBeNull();
  });

  it("refuses impossible data", () => {
    expect(impliedRate(1000, 10, 12)).toBeNull();
    expect(problemasLaudo(emptyLaudo())).toContain("Falta o valor financiado.");
  });
});

describe("buildLaudoPdf", () => {
  it("produces a PDF", async () => {
    const pdf = await buildLaudoPdf(extrairContrato(SIM_CCB).dados, new Date("2026-10-22T12:00:00Z"));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(10_000);
  });
});
