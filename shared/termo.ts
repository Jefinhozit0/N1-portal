import { PROBLEMA_DOCUMENTO, documentoValido } from "./procuracao";
import type { Genero } from "./genero";
import type { Modalidade } from "./notificacao";

/**
 * Termo de conhecimento de prestação de serviços: tells the client that N1 sent the bank the
 * notificação extrajudicial asking for the contract. The client and the bank change; N1 is fixed.
 */
export type TermoDados = {
  nome: string;
  /** brasileiro/brasileira, inscrito/inscrita, denominado/denominada; null keeps "(a)". */
  genero: Genero | null;
  cpf: string;
  email: string;
  /** Full address, CEP included ("Rua Nova, 591 - Tancredo Neves II - Paulo Afonso - BA - CEP: 48609-116"). */
  endereco: string;
  /** The creditor bank ("Banco C6 S.A."). */
  banco: string;
  modalidade: Modalidade;
};

export const N1_TERMO = {
  nome: "N1 Soluções Financeiras",
  cnpj: "52.388.558/0001-90",
  sede: "Rua Líbero Badaró, 293, SALA 26 C Centro Histórico de São Paulo – SP, 01009-000",
};

export function problemasTermo(dados: TermoDados): string[] {
  const problems: string[] = [];
  if (!dados.nome.trim()) problems.push("Falta o nome do cliente.");
  if (!documentoValido(dados.cpf)) problems.push(PROBLEMA_DOCUMENTO);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) problems.push("Falta um e-mail válido.");
  if (!dados.endereco.trim()) problems.push("Falta o endereço do cliente.");
  if (!dados.banco.trim()) problems.push("Falta a instituição financeira.");
  return problems;
}
