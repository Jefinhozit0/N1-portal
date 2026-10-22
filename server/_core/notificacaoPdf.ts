import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatCPF } from "@shared/procuracao";
import { N1_NOTIFICACAO as N1, type NotificacaoDados, dataPorExtenso, moeda, reaisPorExtenso } from "@shared/notificacao";
import { renderPdf, safePdfName } from "./pdf";

/** Notificação extrajudicial asking the bank for the contract, laid out like the team's Word model. */

const PAGE_WIDTH = 595.28;
const body = (text: Content): Content => ({ text, style: "body" } as Content);

export function notificacaoDefinition(dados: NotificacaoDados): TDocumentDefinitions {
  const nome = dados.nome.trim().toUpperCase();
  const qualificacao = `${dados.bancoNome.trim()}, pessoa jurídica de direito privado, inscrita no CNPJ sob o n° ${dados.bancoCnpj.trim()}, com sede na ${dados.bancoEndereco.trim().replace(/\.$/, "")}.`;

  return {
    pageSize: "A4",
    pageMargins: [92, 80, 80, 80],
    info: { title: `Notificação extrajudicial – ${nome}`, author: N1.nome },
    defaultStyle: { font: "Roboto", fontSize: 10.5, color: "#1a1a1a" },
    styles: { body: { lineHeight: 1.75, alignment: "justify", margin: [0, 0, 0, 12] } },
    background: () => ({ canvas: [{ type: "line", x1: 72, y1: 42, x2: PAGE_WIDTH, y2: 42, lineWidth: 1.4, lineColor: "#b3b3b3" }] }),
    footer: () => ({
      text: `Em prestação de serviços jurídicos para N1 SOLUÇÕES - CNPJ nº ${N1.cnpj} – sediada em ${N1.sede}.`,
      bold: true, fontSize: 8, lineHeight: 1.15, margin: [92, 26, 80, 0],
    }),
    content: [
      { text: "NOTIFICAÇÃO EXTRAJUDICIAL", bold: true, fontSize: 13, alignment: "center", margin: [0, 0, 0, 28] },
      body(dataPorExtenso(dados.cidade, dados.data)),
      body(`À Instituição financeira ${qualificacao}`),
      body([
        "A N1 Soluções Financeiras, vem, por meio de procurador qualificado na procuração em anexo, em nome de ",
        { text: nome, bold: true },
        ", inscrito(a) no CPF nº ",
        { text: formatCPF(dados.cpf), bold: true },
        ", apresentar a presente ",
        { text: "NOTIFICAÇÃO EXTRAJUDICIAL", bold: true },
        ` destinada a obter o contrato de financiamento no valor de ${moeda(dados.valor)} (${reaisPorExtenso(dados.valor)}), a serem pagos em ${dados.parcelas} parcelas de ${moeda(dados.valorParcela)} (${reaisPorExtenso(dados.valorParcela)}).`,
      ]),
      body([
        "O documento solicitado deverá ser encaminhado, preferencialmente de forma eletrônica, através do seguinte endereço de e-mail ",
        { text: `${N1.email},`, bold: true },
        ` ou por correspondência física na ${N1.correspondencia}.`,
      ]),
      body("Por fim, caso a apresentação do contrato somente seja possível mediante pagamento de taxa administrativa, solicito que informe, através do e-mail acima:"),
      {
        table: { widths: [36, "*"], body: [["(i)", "valor a ser pago;"], ["(ii)", "forma de pagamento;"], ["(iii)", "cláusula contratual que permite a cobrança."]] },
        layout: "noBorders", margin: [62, -4, 0, 22], lineHeight: 1.5,
      },
      body("O não envio do documento, no prazo de 7 (sete) dias úteis, será tido como recusa tácita de seu fornecimento, permitindo o provimento judicial para sua obtenção neste sentido e, mais, eventualmente a reparação do dano ocasionado pelo não fornecimento de documento útil a discutir direitos do consumidor."),
      {
        unbreakable: true,
        stack: [
          { text: "Cordialmente,", margin: [56, 14, 0, 8] },
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: PAGE_WIDTH - 92 - 80, y2: 0, lineWidth: 0.8, lineColor: "#333" }] },
          { text: N1.nome, bold: true, alignment: "center", margin: [0, 12, 0, 6] },
          { text: `CNPJ: ${N1.cnpj}`, bold: true, alignment: "center" },
        ],
      },
    ],
  };
}

export const buildNotificacaoPdf = (dados: NotificacaoDados) => renderPdf(notificacaoDefinition(dados));

/** "Notificação extrajudicial - MARIA DA SILVA.pdf" */
export const notificacaoFileName = (dados: NotificacaoDados) => safePdfName(`Notificação extrajudicial - ${dados.nome.trim().toUpperCase()}`);
