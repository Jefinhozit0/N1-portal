import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ENCARGO_LABELS, type Encargos, type LaudoDados, avisosLaudo, calcularLaudo, emptyLaudo, formatBRL, parseBRL, problemasLaudo } from "@shared/laudo";
import { MAX_DOCUMENT_BYTES } from "@shared/processo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

type TextKey = "contrato" | "contratante" | "instituicao" | "garantia" | "dataContrato" | "primeiroVencimento" | "jurosMora";
type NumberKey = "valorSolicitado" | "valorFinanciado" | "valorParcela" | "iof" | "parcelas" | "taxaMensal" | "taxaAnual";
/** Every field as typed; numbers are converted only for the preview and the PDF. */
type Form = Record<TextKey | NumberKey | keyof Encargos, string>;

const TEXT_FIELDS: { key: TextKey; label: string; placeholder?: string; wide?: boolean }[] = [
  { key: "contratante", label: "Contratante", wide: true },
  { key: "contrato", label: "Contrato nº" },
  { key: "instituicao", label: "Instituição financeira", placeholder: "Ex.: BANCO PAN S.A." },
  { key: "garantia", label: "Veículo / garantia", placeholder: "Marca, modelo e ano", wide: true },
  { key: "dataContrato", label: "Data do contrato", placeholder: "dd/mm/aaaa" },
  { key: "primeiroVencimento", label: "1º vencimento", placeholder: "dd/mm/aaaa" },
];
const NUMBER_FIELDS: { key: NumberKey; label: string; placeholder: string }[] = [
  { key: "valorSolicitado", label: "Valor solicitado (crédito liberado)", placeholder: "50.000,00" },
  { key: "valorFinanciado", label: "Valor financiado (total contratado)", placeholder: "55.885,04" },
  { key: "parcelas", label: "Quantidade de parcelas", placeholder: "60" },
  { key: "valorParcela", label: "Valor da parcela", placeholder: "1.845,54" },
  { key: "taxaMensal", label: "Taxa de juros mensal (%)", placeholder: "2,59" },
  { key: "taxaAnual", label: "Taxa de juros anual (%)", placeholder: "35,91" },
  { key: "iof", label: "IOF financiado", placeholder: "1.811,15" },
];
const ENCARGO_KEYS = Object.keys(ENCARGO_LABELS) as (keyof Encargos)[];

const toText = (value: number, decimals = 2) => (value > 0 ? value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : "");

function toForm(dados: LaudoDados): Form {
  return {
    contrato: dados.contrato, contratante: dados.contratante, instituicao: dados.instituicao, garantia: dados.garantia,
    dataContrato: dados.dataContrato, primeiroVencimento: dados.primeiroVencimento, jurosMora: dados.jurosMora,
    valorSolicitado: toText(dados.valorSolicitado), valorFinanciado: toText(dados.valorFinanciado), valorParcela: toText(dados.valorParcela), iof: toText(dados.iof),
    parcelas: dados.parcelas > 0 ? String(dados.parcelas) : "", taxaMensal: toText(dados.taxaMensal), taxaAnual: toText(dados.taxaAnual),
    seguros: toText(dados.encargos.seguros ?? 0), avaliacao: toText(dados.encargos.avaliacao ?? 0), cadastro: toText(dados.encargos.cadastro ?? 0), registro: toText(dados.encargos.registro ?? 0),
  };
}

function toDados(form: Form): LaudoDados {
  const number = (text: string) => parseBRL(text) ?? 0;
  // An empty charge is "NÃO CONSTA" in the laudo; zero too.
  const charge = (text: string) => { const value = parseBRL(text); return value && value > 0 ? value : null; };
  return {
    ...emptyLaudo(),
    contrato: form.contrato.trim(), contratante: form.contratante.trim().toUpperCase(), instituicao: form.instituicao.trim().toUpperCase(), garantia: form.garantia.trim().toUpperCase(),
    dataContrato: form.dataContrato.trim(), primeiroVencimento: form.primeiroVencimento.trim(), jurosMora: form.jurosMora.trim(),
    valorSolicitado: number(form.valorSolicitado), valorFinanciado: number(form.valorFinanciado), valorParcela: number(form.valorParcela), iof: number(form.iof),
    parcelas: Math.trunc(number(form.parcelas)), taxaMensal: number(form.taxaMensal), taxaAnual: number(form.taxaAnual),
    encargos: { seguros: charge(form.seguros), avaliacao: charge(form.avaliacao), cadastro: charge(form.cadastro), registro: charge(form.registro) },
  };
}

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function downloadPdf(name: string, base64: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

type LaudoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: number;
  clientName: string;
  /** A contract already attached to the client: it is read as soon as the dialog opens. */
  documento?: { id: number; nome: string } | null;
  onAttached?: () => void;
};

/**
 * Parecer técnico from a contract: the PDF fills the form (or the team types it), the numbers can be
 * changed, and the preview shows the result before the PDF is made.
 */
export default function LaudoDialog({ open, onOpenChange, clientId, clientName, documento, onAttached }: LaudoDialogProps) {
  const blank = () => toForm({ ...emptyLaudo(), contratante: clientName.toUpperCase() });
  const [form, setForm] = useState<Form>(blank);
  const [source, setSource] = useState("");
  const [anexar, setAnexar] = useState(false);

  const lerContrato = trpc.portal.lerContrato.useMutation();
  const gerarLaudo = trpc.portal.gerarLaudo.useMutation();

  async function read(input: { documentoId: number } | { conteudo: string }, name: string) {
    setSource(`Lendo ${name}...`);
    try {
      const { dados, encontrados } = await lerContrato.mutateAsync(input);
      if (encontrados.length === 0) {
        setSource(`Não encontrei texto em ${name} (pode ser um contrato escaneado). Preencha os dados à mão.`);
        return;
      }
      setForm(toForm({ ...dados, contratante: dados.contratante || clientName.toUpperCase() }));
      setSource(`Dados lidos de ${name}. Confira os valores antes de gerar.`);
    } catch (error) {
      setSource("");
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o contrato.");
    }
  }

  useEffect(() => {
    if (!open) return;
    setForm(blank());
    setSource("");
    setAnexar(false);
    if (documento) read({ documentoId: documento.id }, documento.nome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documento?.id]);

  function pickContract() {
    const input = Object.assign(document.createElement("input"), { type: "file", accept: "application/pdf,.pdf" });
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_DOCUMENT_BYTES) { toast.error(`${file.name} passa de 10 MB.`); return; }
      read({ conteudo: await readAsBase64(file) }, file.name);
    };
    input.click();
  }

  const dados = useMemo(() => toDados(form), [form]);
  const problems = problemasLaudo(dados);
  const warnings = problems.length ? [] : avisosLaudo(dados);
  const result = problems.length ? null : calcularLaudo(dados);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (problems.length) { toast.error(problems[0]); return; }
    try {
      const pdf = await gerarLaudo.mutateAsync({ clientId, anexar: anexar && clientId !== undefined, dados });
      downloadPdf(pdf.nome, pdf.conteudo);
      toast.success(anexar ? "Laudo gerado e anexado aos documentos." : "Laudo gerado.");
      if (anexar) onAttached?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o laudo.");
    }
  }

  const set = (key: keyof Form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const busy = lerContrato.isPending || gerarLaudo.isPending;

  return <Dialog open={open} onOpenChange={(next) => !gerarLaudo.isPending && onOpenChange(next)}>
    <DialogContent className="hub-dialog laudo-dialog">
      <form onSubmit={generate}>
        <DialogHeader>
          <DialogTitle>Gerar laudo</DialogTitle>
          <DialogDescription>Parecer técnico com o recálculo das parcelas sem os encargos financiados (seguros, tarifas e registro).</DialogDescription>
        </DialogHeader>

        <div className="laudo-source">
          <Button type="button" variant="outline" size="sm" onClick={pickContract} disabled={busy}>
            {lerContrato.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />} Ler contrato (PDF)
          </Button>
          <small>{source || "Envie o contrato para preencher sozinho, ou digite só os dados abaixo."}</small>
        </div>

        <div className="new-sale-grid">
          {TEXT_FIELDS.map((field) => <label key={field.key} className={field.wide ? "full-field" : undefined}>{field.label}
            <input value={form[field.key]} onChange={set(field.key)} placeholder={field.placeholder} disabled={lerContrato.isPending} />
          </label>)}
          {NUMBER_FIELDS.map((field) => <label key={field.key}>{field.label}
            <input inputMode="decimal" value={form[field.key]} onChange={set(field.key)} placeholder={field.placeholder} disabled={lerContrato.isPending} />
          </label>)}
          <label>Juros moratórios<input value={form.jurosMora} onChange={set("jurosMora")} placeholder="1% A.M." disabled={lerContrato.isPending} /></label>
        </div>

        <fieldset className="laudo-encargos">
          <legend>Encargos a retirar <small>(vazio = não consta no contrato)</small></legend>
          <div className="new-sale-grid">
            {ENCARGO_KEYS.map((key) => <label key={key}>{ENCARGO_LABELS[key]}
              <input inputMode="decimal" value={form[key]} onChange={set(key)} placeholder="Não consta" disabled={lerContrato.isPending} />
            </label>)}
          </div>
        </fieldset>

        <div className="laudo-preview" aria-live="polite">
          {result ? <>
            <div><span>Parcela</span><strong>{formatBRL(result.original.prestacao)} → {formatBRL(result.recalculado.prestacao)}</strong></div>
            <div><span>Encargos retirados</span><strong>{formatBRL(result.encargos)}</strong></div>
            <div><span>Diferença por parcela</span><strong>{formatBRL(result.diferencaParcela)}</strong></div>
            <div><span>Proveito econômico</span><strong className="laudo-total">{formatBRL(result.diferencaTotal)}</strong></div>
          </> : <p>{problems[0]}</p>}
        </div>
        {warnings.map((warning) => <p key={warning} className="laudo-warning"><AlertTriangle size={14} /> {warning}</p>)}

        {clientId !== undefined && <label className="laudo-attach">
          <input type="checkbox" checked={anexar} onChange={(event) => setAnexar(event.target.checked)} />
          Anexar também aos documentos do cliente (o cliente vê no portal)
        </label>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={gerarLaudo.isPending}>Cancelar</Button>
          <Button type="submit" disabled={busy || problems.length > 0}>{gerarLaudo.isPending ? "Gerando..." : "Gerar laudo (PDF)"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
