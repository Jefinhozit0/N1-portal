import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseBRL } from "@shared/laudo";
import { BANCOS_CONHECIDOS, type NotificacaoDados, bancoConhecido, dataPorExtenso, moeda, problemasNotificacao } from "@shared/notificacao";
import { MAX_DOCUMENT_BYTES } from "@shared/processo";
import { formatCPF, hojeISO } from "@shared/procuracao";
import { Button } from "@/components/ui/button";
import { downloadPdf, pickPdf } from "@/lib/downloadPdf";
import { trpc } from "@/lib/trpc";
import type { ProcuracaoClient } from "./ProcuracaoForm";

/** Every field as typed; the amounts are converted for the preview and the PDF. */
type Form = Record<keyof NotificacaoDados, string>;

const FIELDS: { key: keyof NotificacaoDados; label: string; placeholder?: string; wide?: boolean; numeric?: boolean }[] = [
  { key: "nome", label: "Nome do cliente", wide: true },
  { key: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { key: "valor", label: "Valor do contrato (crédito liberado)", placeholder: "50.000,00", numeric: true },
  { key: "parcelas", label: "Quantidade de parcelas", placeholder: "60", numeric: true },
  { key: "valorParcela", label: "Valor da parcela", placeholder: "1.845,54", numeric: true },
];
const BANK_FIELDS: { key: keyof NotificacaoDados; label: string; placeholder?: string; wide?: boolean }[] = [
  { key: "bancoNome", label: "Instituição financeira (notificada)", placeholder: "Banco Santander (Brasil) S.A", wide: true },
  { key: "bancoCnpj", label: "CNPJ da instituição", placeholder: "00.000.000/0000-00" },
  { key: "bancoEndereco", label: "Endereço da sede", placeholder: "Rua, número, bairro, cidade - UF, CEP", wide: true },
];

const toText = (value: number) => (value > 0 ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
const blank = (): Form => ({ nome: "", cpf: "", valor: "", parcelas: "", valorParcela: "", bancoNome: "", bancoCnpj: "", bancoEndereco: "", cidade: "São Paulo", data: hojeISO() });

function toDados(form: Form): NotificacaoDados {
  return {
    ...form,
    nome: form.nome.trim(), cpf: form.cpf.trim(), bancoNome: form.bancoNome.trim(), bancoCnpj: form.bancoCnpj.trim(), bancoEndereco: form.bancoEndereco.trim(), cidade: form.cidade.trim(),
    valor: parseBRL(form.valor) ?? 0, valorParcela: parseBRL(form.valorParcela) ?? 0, parcelas: Math.trunc(parseBRL(form.parcelas) ?? 0),
  };
}

/** Notificação extrajudicial asking the bank for the contract: the contract PDF fills the client, the amounts and the bank. */
export function NotificacaoForm({ clients, onDone }: { clients: ProcuracaoClient[]; onDone?: (result: { attached: boolean }) => void }) {
  const [form, setForm] = useState<Form>(blank);
  const [clientName, setClientName] = useState("");
  const [anexar, setAnexar] = useState(false);
  const [source, setSource] = useState("");
  const lerContrato = trpc.portal.lerContrato.useMutation();
  const gerar = trpc.portal.gerarNotificacao.useMutation();
  const chosen = clients.find((option) => option.name.trim().toLowerCase() === clientName.trim().toLowerCase());

  function chooseClient(name: string) {
    setClientName(name);
    const match = clients.find((option) => option.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (match) setForm((current) => ({ ...current, nome: current.nome || match.name.toUpperCase(), cpf: current.cpf || (match.cpf ? formatCPF(match.cpf) : "") }));
  }

  function chooseBank(id: string) {
    const bank = BANCOS_CONHECIDOS.find((option) => option.id === id);
    setForm((current) => bank
      ? { ...current, bancoNome: bank.nome, bancoCnpj: bank.cnpj, bancoEndereco: bank.endereco }
      : { ...current, bancoNome: "", bancoCnpj: "", bancoEndereco: "" });
  }

  async function readContract() {
    const file = await pickPdf(MAX_DOCUMENT_BYTES, (name) => toast.error(`${name} passa de 10 MB.`));
    if (!file) return;
    setSource(`Lendo ${file.name}...`);
    try {
      const { dados, cpf, cnpjInstituicao, encontrados } = await lerContrato.mutateAsync({ conteudo: file.base64 });
      if (encontrados.length === 0) {
        setSource(`Não encontrei texto em ${file.name} (pode ser um contrato escaneado). Preencha os dados à mão.`);
        return;
      }
      const bank = bancoConhecido(dados.instituicao);
      setForm((current) => ({
        ...current,
        nome: dados.contratante || current.nome,
        cpf: cpf ? formatCPF(cpf) : current.cpf,
        valor: toText(dados.valorSolicitado || dados.valorFinanciado),
        parcelas: dados.parcelas ? String(dados.parcelas) : "",
        valorParcela: toText(dados.valorParcela),
        ...(bank
          ? { bancoNome: bank.nome, bancoCnpj: bank.cnpj, bancoEndereco: bank.endereco }
          : { bancoNome: dados.instituicao, bancoCnpj: cnpjInstituicao, bancoEndereco: "" }),
      }));
      setSource(bank || !dados.instituicao
        ? `Dados lidos de ${file.name}. Confira os valores antes de gerar.`
        : `Dados lidos de ${file.name}. Falta o endereço da sede de ${dados.instituicao}: confira no site do banco.`);
    } catch (error) {
      setSource("");
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o contrato.");
    }
  }

  function reset() {
    setForm(blank());
    setClientName("");
    setAnexar(false);
    setSource("");
  }

  const dados = toDados(form);
  const problems = problemasNotificacao(dados);
  const attach = anexar && chosen !== undefined;
  const busy = lerContrato.isPending || gerar.isPending;
  const knownBank = BANCOS_CONHECIDOS.find((bank) => bank.nome === form.bancoNome && bank.cnpj === form.bancoCnpj);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (problems.length) { toast.error(problems[0]); return; }
    try {
      const pdf = await gerar.mutateAsync({ clientId: chosen?.id, anexar: attach, dados });
      downloadPdf(pdf.nome, pdf.conteudo);
      toast.success(attach ? `Notificação gerada e anexada aos documentos de ${chosen!.name}.` : "Notificação gerada.");
      onDone?.({ attached: attach });
      reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar a notificação.");
    }
  }

  const set = (key: keyof NotificacaoDados) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const input = (field: { key: keyof NotificacaoDados; label: string; placeholder?: string; wide?: boolean; numeric?: boolean }) =>
    <label key={field.key} className={field.wide ? "full-field" : undefined}>{field.label}
      <input name={`notificacao-${field.key}`} autoComplete="off" inputMode={field.numeric ? "decimal" : undefined} value={form[field.key]} onChange={set(field.key)} placeholder={field.placeholder} disabled={busy} />
    </label>;

  return <form onSubmit={generate} className="laudo-form laudo-form-page" autoComplete="off">
    <div className="laudo-source">
      <Button type="button" variant="outline" size="sm" onClick={readContract} disabled={busy}>
        {lerContrato.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />} Ler contrato (PDF)
      </Button>
      <small>{source || "Envie o contrato para preencher cliente, valores e banco, ou digite os dados abaixo."}</small>
    </div>

    <div className="new-sale-grid">
      <label className="full-field">Cliente (opcional)
        <input list="notificacao-clientes" value={clientName} onChange={(event) => chooseClient(event.target.value)} placeholder="Escolha da lista para poder anexar a notificação ao cadastro" disabled={busy} />
        <datalist id="notificacao-clientes">{clients.map((option) => <option key={option.id} value={option.name} />)}</datalist>
      </label>
      {FIELDS.map(input)}
    </div>

    <fieldset className="laudo-encargos">
      <legend>Instituição notificada</legend>
      <div className="new-sale-grid">
        <label className="full-field">Banco
          <select value={knownBank?.id ?? ""} onChange={(event) => chooseBank(event.target.value)} disabled={busy}>
            {BANCOS_CONHECIDOS.map((bank) => <option key={bank.id} value={bank.id}>{bank.nome}</option>)}
            <option value="">Outro (digitar abaixo)</option>
          </select>
        </label>
        {BANK_FIELDS.map(input)}
      </div>
    </fieldset>

    <div className="new-sale-grid laudo-place">
      <label>Cidade<input name="notificacao-cidade" autoComplete="off" value={form.cidade} onChange={set("cidade")} disabled={busy} /></label>
      <label>Data<input type="date" value={form.data} onChange={set("data")} disabled={busy} /></label>
    </div>

    <div className="laudo-preview procuracao-preview" aria-live="polite">
      {problems.length
        ? <p>{problems[0]}</p>
        : <p>Pede a <strong>{dados.bancoNome}</strong> o contrato de <strong>{dados.nome.toUpperCase()}</strong>: {moeda(dados.valor)} em {dados.parcelas} parcelas de {moeda(dados.valorParcela)} · {dataPorExtenso(dados.cidade, dados.data)}</p>}
    </div>

    {chosen
      ? <label className="laudo-attach">
          <input type="checkbox" checked={anexar} onChange={(event) => setAnexar(event.target.checked)} />
          Anexar também aos documentos de {chosen.name} (o cliente vê no portal)
        </label>
      : clientName.trim() && <p className="laudo-hint">Cliente não encontrado na lista: a notificação é gerada, mas não fica anexada a nenhum cadastro.</p>}

    <div className="laudo-actions">
      <Button type="button" variant="outline" onClick={reset} disabled={busy}>Limpar</Button>
      <Button type="submit" disabled={busy || problems.length > 0}>{gerar.isPending ? "Gerando..." : "Gerar notificação (PDF)"}</Button>
    </div>
  </form>;
}
