import { useState } from "react";
import { ArrowLeft, FileText, Phone, Mail, Upload, Trash2, Sparkles, AlertTriangle, ChevronDown, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "./Home";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { showAccessResult } from "@/lib/accessToast";

type Client = {
  id?: number;
  name: string;
  cpf: string;
  type: string;
  status: string;
  updated: string;
  tone: "green" | "yellow" | "red";
  email?: string;
  phone?: string;
  services?: string[];
  tags?: string[];
};

type ClientDetailProps = {
  client: Client;
  onBack: () => void;
};

type Document = {
  id: number;
  name: string;
  date: string;
  size: string;
  description: string;
};

type TimelineEvent = {
  id: number;
  type: "document" | "progress" | "registration";
  title: string;
  description: string;
  date: string;
  time: string;
};

export default function ClientDetail({ client, onBack }: ClientDetailProps) {
  const [progress, setProgress] = useState(25);
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [progressInput, setProgressInput] = useState("25");
  const [status, setStatus] = useState("Em análise");
  const [appInstalled, setAppInstalled] = useState(false);
  const reenviarAcesso = trpc.portal.reenviarAcesso.useMutation({
    onSuccess: (result) => showAccessResult(result, "Novo link gerado (o anterior deixou de valer)."),
    onError: (error) => toast.error(error.message),
  });
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isAnalyzingRisk, setIsAnalyzingRisk] = useState(false);
  const [summary, setSummary] = useState("");
  const [riskAnalysis, setRiskAnalysis] = useState("");
  const [tags, setTags] = useState<string[]>(client.tags || ["Urgente", "Documentação pendente"]);
  const [isEditingTags, setIsEditingTags] = useState(false);

  const availableTags = ["Urgente", "Documentação pendente", "Aguardando cliente", "VIP", "Em revisão", "Financiamento Veicular"];
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 1,
      name: "Contrato-2026-001551-LOIR-SANTOS - Clicksign.pdf",
      date: "28/09/2026",
      size: "2.4 MB",
      description: "Contrato de financiamento veicular assinado digitalmente",
    },
    {
      id: 2,
      name: "DECLARACAO-DE-TRANSACAO - Clicksign (3).pdf",
      date: "28/09/2026",
      size: "1.8 MB",
      description: "Declaração de transação financeira",
    },
  ]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([
    {
      id: 1,
      type: "document",
      title: "Novo documento recebido",
      description: "DECLARACAO-DE-TRANSACAO - Clicksign (3).pdf",
      date: "28/09/2026",
      time: "14:32",
    },
    {
      id: 2,
      type: "document",
      title: "Novo documento recebido",
      description: "Contrato-2026-001551-LOIR-SANTOS - Clicksign.pdf",
      date: "28/09/2026",
      time: "14:30",
    },
    {
      id: 3,
      type: "progress",
      title: "Progresso atualizado",
      description: "Progresso do caso atualizado para 25%",
      date: "28/09/2026",
      time: "14:25",
    },
    {
      id: 4,
      type: "registration",
      title: "Cadastro realizado",
      description: "Início do processo: Financiamento Veicular",
      date: "28/09/2026",
      time: "10:15",
    },
  ]);

  function handleGenerateSummary() {
    setIsGeneratingSummary(true);
    setTimeout(() => {
      setSummary("Cliente LOIR SANTOS possui um processo de Financiamento Veicular em andamento. O progresso atual é de 25%, indicando que o processo está em fase inicial de análise. Foram recebidos 2 documentos importantes: o contrato de financiamento e a declaração de transação. O cliente ainda não instalou o aplicativo para acompanhamento.");
      setIsGeneratingSummary(false);
    }, 2000);
  }

  function handleAnalyzeRisk() {
    setIsAnalyzingRisk(true);
    setTimeout(() => {
      setRiskAnalysis("Probabilidade de churn: BAIXA (15%). O cliente demonstrou engamento inicial com envio rápido de documentos. Recomenda-se manter contato regular para acompanhar o progresso.");
      setIsAnalyzingRisk(false);
    }, 2000);
  }

  function handleUploadDocument() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "*/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const newDoc: Document = {
          id: Date.now(),
          name: file.name,
          date: new Date().toLocaleDateString("pt-BR"),
          size: (file.size / (1024 * 1024)).toFixed(1) + " MB",
          description: "Documento recém-anexado",
        };
        setDocuments([...documents, newDoc]);
        setTimeline([
          {
            id: Date.now(),
            type: "document",
            title: "Novo documento recebido",
            description: file.name,
            date: new Date().toLocaleDateString("pt-BR"),
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          },
          ...timeline,
        ]);
      }
    };
    input.click();
  }

  function handleDeleteDocument(id: number) {
    setDocuments(documents.filter((doc) => doc.id !== id));
  }

  function handleDeleteTimelineEvent(id: number) {
    setTimeline(timeline.filter((event) => event.id !== id));
  }

  function handleEditProgress() {
    setIsEditingProgress(true);
    setProgressInput(String(progress));
  }

  function handleSaveProgress() {
    const newProgress = parseInt(progressInput);
    if (newProgress >= 0 && newProgress <= 100) {
      setProgress(newProgress);
      setIsEditingProgress(false);
      // Add to timeline
      setTimeline([
        {
          id: Date.now(),
          type: "progress",
          title: "Progresso atualizado",
          description: `Progresso do caso atualizado para ${newProgress}%`,
          date: new Date().toLocaleDateString("pt-BR"),
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
        ...timeline,
      ]);
    }
  }

  function handleCancelProgress() {
    setIsEditingProgress(false);
    setProgressInput(String(progress));
  }

  function toggleTag(tag: string) {
    if (isEditingTags) {
      setTags((prev) =>
        prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
      );
    }
  }

  return (
    <div className="client-detail-page">
      <div className="client-detail-header">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="back-button"
        >
          <ArrowLeft size={18} />
          Voltar
        </Button>
      </div>

      <div className="client-detail-content">
        {/* Client Header */}
        <section className="client-header-section">
          <div className="client-avatar">
            {client.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
          </div>
          <div className="client-info">
            <h1>{client.name}</h1>
            <div className="client-contact">
              <span className="contact-item">
                <Phone size={14} />
                {client.phone || "(11) 98400-1682"}
              </span>
              <span className="contact-item">
                <Mail size={14} />
                {client.email || "loir02@hotmail.com"}
              </span>
              {client.id !== undefined && client.email && (
                <button type="button" className="secondary-button" disabled={reenviarAcesso.isPending} onClick={() => reenviarAcesso.mutate({ id: client.id! })}>
                  {reenviarAcesso.isPending ? "Enviando..." : "Reenviar acesso ao portal"}
                </button>
              )}
            </div>
            <div className="client-tags">
              <StatusPill tone={client.tone}>{status}</StatusPill>
              <span className="tag service-tag">{client.type}</span>
              <span className="tag app-tag">{appInstalled ? "App instalado" : "App não instalado"}</span>
              {isEditingTags ? (
                <div className="tags-edit-container">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`tag-edit-btn ${tags.includes(tag) ? "active" : ""}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                  <Button size="sm" onClick={() => setIsEditingTags(false)} className="tags-save-btn">
                    Salvar
                  </Button>
                </div>
              ) : (
                <div className="tags-display">
                  {tags.map((tag) => (
                    <span key={tag} className="tag detail-tag">{tag}</span>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingTags(true)} className="tags-edit-trigger">
                    Editar tags
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Progress Bar */}
        <section className="progress-section">
          <div className="progress-header">
            <span>Progresso do caso</span>
            {isEditingProgress ? (
              <div className="progress-edit-controls">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={progressInput}
                  onChange={(e) => setProgressInput(e.target.value)}
                  className="progress-input"
                />
                <span className="progress-percent">%</span>
                <Button size="sm" onClick={handleSaveProgress} className="progress-save-btn">
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelProgress} className="progress-cancel-btn">
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="progress-display-controls">
                <span className="progress-percent">{progress}%</span>
                <Button size="sm" variant="ghost" onClick={handleEditProgress} className="progress-edit-btn">
                  Editar
                </Button>
              </div>
            )}
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </section>

        {/* Action Panels */}
        <div className="action-panels-grid">
          {/* Automatic Summary */}
          <section className="action-panel">
            <div className="panel-header">
              <Sparkles size={18} />
              <h3>Resumo automático</h3>
            </div>
            {summary ? (
              <p className="panel-content">{summary}</p>
            ) : (
              <p className="panel-content placeholder">Clique em gerar para criar um resumo do caso usando IA.</p>
            )}
            <Button
              size="sm"
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
              className="panel-button"
            >
              {isGeneratingSummary ? "Gerando..." : "Gerar"}
            </Button>
          </section>

          {/* Risk Detection */}
          <section className="action-panel">
            <div className="panel-header">
              <AlertTriangle size={18} />
              <h3>Detecção de risco</h3>
            </div>
            {riskAnalysis ? (
              <p className="panel-content">{riskAnalysis}</p>
            ) : (
              <p className="panel-content placeholder">Analise a probabilidade de churn do cliente.</p>
            )}
            <Button
              size="sm"
              onClick={handleAnalyzeRisk}
              disabled={isAnalyzingRisk}
              className="panel-button"
            >
              {isAnalyzingRisk ? "Analisando..." : "Analisar"}
            </Button>
          </section>

          {/* Status & Actions */}
          <section className="action-panel">
            <div className="panel-header">
              <Clock size={18} />
              <h3>Status & ações</h3>
            </div>
            <div className="status-select">
              <label>Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full" aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Em análise">Em análise</SelectItem>
                  <SelectItem value="Pendente documentação">Pendente documentação</SelectItem>
                  <SelectItem value="Pendente contato">Pendente contato</SelectItem>
                  <SelectItem value="Em negociação">Em negociação</SelectItem>
                  <SelectItem value="Em andamento judicial">Em andamento judicial</SelectItem>
                  <SelectItem value="Concluído">Concluído</SelectItem>
                  <SelectItem value="Tratativa suspensa">Tratativa suspensa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>

        {/* Documents Section */}
        <section className="documents-section">
          <div className="section-header">
            <h2>Documentos</h2>
            <Button size="sm" onClick={handleUploadDocument} className="upload-button">
              <Upload size={16} />
              Anexar documentos
            </Button>
          </div>
          <div className="documents-list">
            {documents.map((doc) => (
              <div key={doc.id} className="document-item">
                <div className="document-icon">
                  <FileText size={20} />
                </div>
                <div className="document-info">
                  <strong>{doc.name}</strong>
                  <div className="document-meta">
                    <span>{doc.date}</span>
                    <span>•</span>
                    <span>{doc.size}</span>
                  </div>
                  <p className="document-description">{doc.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDocument(doc.id)}
                  className="delete-button"
                  aria-label={`Excluir ${doc.name}`}
                  title="Excluir documento"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline Section */}
        <section className="timeline-section">
          <div className="section-header">
            <h2>Linha do tempo</h2>
            <Select defaultValue="all">
              <SelectTrigger className="timeline-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os serviços</SelectItem>
                <SelectItem value="documents">Documentos</SelectItem>
                <SelectItem value="progress">Progresso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="timeline-list">
            {timeline.map((event) => (
              <div key={event.id} className="timeline-item">
                <div className="timeline-icon">
                  {event.type === "document" && <FileText size={16} />}
                  {event.type === "progress" && <Clock size={16} />}
                  {event.type === "registration" && <Plus size={16} />}
                </div>
                <div className="timeline-content">
                  <strong>{event.title}</strong>
                  <p>{event.description}</p>
                  <span className="timeline-date">
                    {event.date} às {event.time}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteTimelineEvent(event.id)}
                  className="delete-button"
                  aria-label={`Excluir evento: ${event.title}`}
                  title="Excluir evento"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
