/**
 * Notificação extrajudicial asking the bank for a copy of the client's contract. The client, the
 * contract figures and the bank change; N1's contacts and the 7-day term are fixed.
 */

export type NotificacaoDados = {
  nome: string;
  cpf: string;
  /** Amount of the contract (crédito liberado). */
  valor: number;
  parcelas: number;
  valorParcela: number;
  bancoNome: string;
  bancoCnpj: string;
  bancoEndereco: string;
  cidade: string;
  /** aaaa-mm-dd */
  data: string;
};

export const N1_NOTIFICACAO = {
  nome: "N1 SOLUÇÕES FINANCEIRAS",
  cnpj: "52.388.558/0001-90",
  sede: "Rua Líbero Badaró, 293, SALA 26 C Centro Histórico de São Paulo – SP, 01009-000",
  email: "nonesolucoes@gmail.com",
  correspondencia: "Rua Líbero Badaró, 488, Edifício Stella Penteado, 5° andar – Conjunto 5A, Centro – SP, 01008-000",
};

/** Banks whose full qualification the team already uses. Aymoré contracts are notified to Santander, its parent bank. */
export const BANCOS_CONHECIDOS = [
  {
    id: "santander",
    nome: "Banco Santander (Brasil) S.A",
    cnpj: "90.400.888/0001-42",
    endereco: "Av. Presidente Juscelino Kubitschek, n° 2041, conj. 281, Bloco A cond. WTorre JK, Vila Nova Conceição, São Paulo - SP, CEP: 04543-011",
    reconhece: /santander|aymor[ée]/i,
  },
];

export const bancoConhecido = (instituicao: string) => BANCOS_CONHECIDOS.find((banco) => banco.reconhece.test(instituicao));

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "São Paulo, 14 de novembro de 2025." */
export function dataPorExtenso(cidade: string, data: string) {
  const [year, month, day] = data.split("-").map(Number);
  return `${cidade.trim()}, ${day} de ${MESES[month - 1]} de ${year}.`;
}

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 0–999 in words ("cento e vinte e três"). */
function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), rest = n % 100;
  const parts: string[] = [];
  if (c) parts.push(CENTENAS[c]);
  if (rest < 20) { if (rest) parts.push(UNIDADES[rest]); }
  else { parts.push(DEZENAS[Math.floor(rest / 10)] + (rest % 10 ? ` e ${UNIDADES[rest % 10]}` : "")); }
  return parts.join(" e ");
}

/** Whole number in words, up to the billions ("um mil oitocentos e quarenta e cinco"). */
export function numeroPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const scales: [number, string, string][] = [[1e9, "bilhão", "bilhões"], [1e6, "milhão", "milhões"], [1e3, "mil", "mil"]];
  const groups: { value: number; text: string }[] = [];
  let rest = n;
  for (const [size, singular, plural] of scales) {
    const count = Math.floor(rest / size);
    rest %= size;
    // The team's model writes "um mil" (R$1.845,54 → "um mil oitocentos..."), common in legal texts.
    if (count) groups.push({ value: count * size, text: `${ate999(count)} ${count === 1 ? singular : plural}` });
  }
  if (rest) groups.push({ value: rest, text: ate999(rest) });
  // "e" before the last group when it is under 100 or a round hundred ("mil e cem", "mil e vinte"); otherwise just a space.
  return groups.map((group, index) => {
    if (index === 0) return group.text;
    const last = index === groups.length - 1;
    return last && (group.value < 100 || group.value % 100 === 0) ? `e ${group.text}` : group.text;
  }).join(" ");
}

/** "cinquenta mil reais", "um mil oitocentos e quarenta e cinco reais e cinquenta e quatro centavos". */
export function reaisPorExtenso(value: number): string {
  const cents = Math.round(value * 100);
  const reais = Math.floor(cents / 100), centavos = cents % 100;
  const parts: string[] = [];
  if (reais) {
    const millions = reais >= 1e6 && reais % 1e6 === 0;
    parts.push(`${numeroPorExtenso(reais)}${millions ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos) parts.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return parts.length ? parts.join(" e ") : "zero reais";
}

/** "R$50.000,00", written without a space, as in the model. */
export const moeda = (value: number) => `R$${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function problemasNotificacao(dados: NotificacaoDados): string[] {
  const problems: string[] = [];
  if (!dados.nome.trim()) problems.push("Falta o nome do cliente.");
  if (dados.cpf.replace(/\D/g, "").length !== 11) problems.push("O CPF precisa ter 11 números.");
  if (!(dados.valor > 0)) problems.push("Falta o valor do contrato.");
  if (!(dados.parcelas > 0 && Number.isInteger(dados.parcelas))) problems.push("Falta a quantidade de parcelas.");
  if (!(dados.valorParcela > 0)) problems.push("Falta o valor da parcela.");
  if (!dados.bancoNome.trim()) problems.push("Falta a instituição financeira.");
  if (!dados.bancoCnpj.trim()) problems.push("Falta o CNPJ da instituição.");
  if (!dados.bancoEndereco.trim()) problems.push("Falta o endereço da sede da instituição.");
  if (!dados.cidade.trim()) problems.push("Falta a cidade.");
  else if (/\d/.test(dados.cidade)) problems.push(`Escreva a cidade por extenso: "${dados.cidade.trim()}" parece um código, não o nome da cidade.`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.data)) problems.push("Falta a data.");
  return problems;
}
