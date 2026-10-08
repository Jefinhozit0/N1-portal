import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { parseTicketMessage } from "@shared/tickets";
import { CHARGEBACK_LIST_FILTERS, CLIENT_LIST_FILTERS, DASHBOARD_RULES, METRIC_HELP, type ChargebackListFilter, type ClientListFilter, type ListFilter } from "@shared/dashboard";
import ClientDetail from "./ClientDetail";
import { ChangePasswordScreen, ClientPortal } from "./ClientPortal";
import { toast } from "sonner";
import { showAccessResult } from "@/lib/accessToast";
import type { Session } from "@supabase/supabase-js";
import { trpc } from "@/lib/trpc";
import { N1Logo } from "@/components/N1Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import {
  AlertTriangle,
  Briefcase,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Scale,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Trophy,
  Users,
  X,
} from "lucide-react";

type View = "dashboard" | "clientes" | "chargebacks" | "atendimento" | "saleshub" | "client-detail";
type Client = { id?: number; name: string; cpf: string; type: string; status: string; updated: string; tone: "green" | "yellow" | "red"; email?: string; phone?: string; services?: string[]; tags?: string[] };

const clientServices = ["Financiamento Imobiliário", "Financiamento Veicular", "Empréstimo Pessoal", "Empréstimo Consignado", "Cartão de Crédito", "Outros"];

const clients: Client[] = [
  { name: "Joyce Gomes da Silva Rosa", cpf: "***.482.***-09", type: "Revisão de juros", status: "Em andamento", updated: "Hoje, 09:42", tone: "green", tags: ["Urgente", "VIP"] },
  { name: "Marcos Vinícius Almeida", cpf: "***.119.***-42", type: "Busca e apreensão", status: "Aguardando documento", updated: "Ontem, 16:18", tone: "yellow", tags: ["Documentação pendente", "Aguardando cliente"] },
  { name: "Ana Paula Ferreira", cpf: "***.763.***-20", type: "Revisão de juros", status: "Em análise", updated: "26 set, 11:05", tone: "yellow", tags: ["Em revisão"] },
  { name: "Rafael de Souza Lima", cpf: "***.058.***-73", type: "Portabilidade", status: "Concluído", updated: "25 set, 14:27", tone: "green", tags: [] },
  { name: "Camila Rodrigues Santos", cpf: "***.391.***-64", type: "Revisão de contrato", status: "Atenção necessária", updated: "24 set, 10:12", tone: "red", tags: ["Urgente", "Documentação pendente"] },
];

const chargebacks = [
  { client: "Joyce Gomes da Silva Rosa", bank: "Banco Vértice", amount: "R$ 8.420,55", deadline: "03 out 2026", status: "Documentação enviada", tone: "blue" },
  { client: "Marcos Vinícius Almeida", bank: "CredMais", amount: "R$ 4.890,00", deadline: "07 out 2026", status: "Em conferência", tone: "yellow" },
  { client: "Ana Paula Ferreira", bank: "Banco União", amount: "R$ 12.164,30", deadline: "12 out 2026", status: "Aguardando assinatura", tone: "purple" },
];

export type HubSale = { id: number; date: string; client: string; phone: string; consultants: string[]; product: string; status: "Pendente" | "OK"; cbk: boolean; gross: number; net: number; note: string };
export type HubRankingItem = { name: string; count: number; gross: number; net: number };

const initialHubSales: HubSale[] = [
  { id: 1, date: "28/09/2026", client: "Silvani Pereira Nunes", phone: "+55 63 99276-2023", consultants: ["Beatriz", "Juan"], product: "Revisão de Juros", status: "Pendente", cbk: false, gross: 1600, net: 1600, note: "" },
  { id: 2, date: "28/09/2026", client: "Carlos Henrique Ramos dos Santos", phone: "(81) 98767-0239", consultants: ["Bruno Alemão"], product: "Portabilidade", status: "OK", cbk: false, gross: 3840, net: 3840, note: "Contrato conferido" },
  { id: 3, date: "28/09/2026", client: "Pedro Adelar Gomes", phone: "(41) 9218-0655", consultants: ["Gaby Inácio", "Fernanda"], product: "Revisão de Juros", status: "Pendente", cbk: false, gross: 900, net: 900, note: "" },
  { id: 4, date: "25/09/2026", client: "Diego Junior Vieira Souza", phone: "31 99538-6202", consultants: ["Alexandre", "Isabella"], product: "Revisão de contrato", status: "Pendente", cbk: false, gross: 1500, net: 1500, note: "Retornar ao cliente" },
  { id: 5, date: "25/09/2026", client: "Valmir Pereira da Silva", phone: "94981871466", consultants: ["Ana G."], product: "Revisão de Juros", status: "Pendente", cbk: false, gross: 1000, net: 1000, note: "" },
  { id: 6, date: "24/09/2026", client: "Adimar Rosa da Silva", phone: "24 99816-0605", consultants: ["Ana G.", "Alexandre"], product: "Laudo", status: "Pendente", cbk: false, gross: 2100, net: 2100, note: "" },
  { id: 7, date: "23/09/2026", client: "Josue Feliz Batista", phone: "(14) 99603-8753", consultants: ["Arthur Panizza", "Juan"], product: "Revisão de contrato", status: "Pendente", cbk: false, gross: 5786, net: 5241, note: "" },
  { id: 8, date: "21/09/2026", client: "Fernanda Souza", phone: "62981313765", consultants: ["Rafaela"], product: "Portabilidade", status: "OK", cbk: false, gross: 540, net: 513, note: "" },
];

const hubConsultants = ["Alexandre", "Ana G.", "Arthur Panizza", "Beatriz", "Bruno Alemão", "Fernanda", "Gaby Inácio", "Isabella", "Jaqueline", "Jenifer", "João", "Juan", "Kariny", "Matheus", "Rafaela"];
export const hubMoney = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
export const buildSalesHubCsv = (sales: HubSale[], ranking: HubRankingItem[]) => [
  "RELATÓRIO SALES HUB",
  `Vendas filtradas: ${sales.length}`,
  "",
  ["Data", "Cliente", "Telefone", "Consultor(es)", "Produto", "Status", "CBK", "Bruto", "Líquido", "Observação"].map(csvCell).join(";"),
  ...sales.map((sale) => [sale.date, sale.client, sale.phone, sale.consultants.join(", "), sale.product, sale.status, sale.cbk ? "sim" : "não", sale.gross, sale.net, sale.note].map(csvCell).join(";")),
  "",
  "RANKING DE CONSULTORES",
  ["Posição", "Consultor", "Vendas", "Bruto", "Líquido"].map(csvCell).join(";"),
  ...ranking.map((item, index) => [index + 1, item.name, item.count, item.gross, item.net].map(csvCell).join(";")),
].join("\n");

function SalesHubPage({ userName }: { userName: string }) {
  const [section, setSection] = useState<"comercial" | "juridico" | "control">("comercial");
  const [month, setMonth] = useState("2026-09");
  const [consultant, setConsultant] = useState("Todos");
  const [query, setQuery] = useState("");
  const vendasQuery = trpc.portal.vendas.useQuery(undefined, { retry: false });
  const createVendaMutation = trpc.portal.createVenda.useMutation({ onSuccess: () => vendasQuery.refetch() });
  const updateVendaMutation = trpc.portal.updateVenda.useMutation({ onSuccess: () => vendasQuery.refetch() });
  const deleteVendaMutation = trpc.portal.deleteVenda.useMutation({ onSuccess: () => vendasQuery.refetch() });
  const remoteVendas = vendasQuery.data;
  const [sales, setSales] = useState<HubSale[]>(initialHubSales);
  // Keep local sales in sync with remote
  useEffect(() => { if (remoteVendas && remoteVendas.length > 0) setSales(remoteVendas); }, [remoteVendas]);
  const [consultants, setConsultants] = useState<string[]>(hubConsultants);
  const [modal, setModal] = useState<"consultants" | "new-sale" | null>(null);
  const [notice, setNoticeState] = useState("");
  const setNotice = (message: string) => {
    const clientName = message.match(/^Ações para (.*?):/)?.[1];
    if (clientName) {
      const sale = sales.find((item) => item.client === clientName);
      setNoticeState(sale ? `${sale.client} · ${sale.product} · ${sale.status} · bruto ${hubMoney(sale.gross)} · líquido ${hubMoney(sale.net)}` : message);
      return;
    }
    setNoticeState(message);
  };
  const [newConsultant, setNewConsultant] = useState("");
  const [newSale, setNewSale] = useState({ client: "", phone: "", product: "Revisão de Juros", status: "Pendente" as HubSale["status"], gross: "", net: "", note: "", consultants: [] as string[] });
  const [chartsReady, setChartsReady] = useState(false);
  const [selectedRanking, setSelectedRanking] = useState<string | null>(null);

  useEffect(() => {
    consultants.forEach((name) => {
      if (!hubConsultants.includes(name)) hubConsultants.push(name);
    });
  }, [consultants]);

  useEffect(() => {
    setChartsReady(false);
    const timer = window.setTimeout(() => setChartsReady(true), 650);
    return () => window.clearTimeout(timer);
  }, [section, consultant, query, month, sales.length]);

  const filteredSales = useMemo(() => sales.filter((sale) => {
    const matchesConsultant = consultant === "Todos" || sale.consultants.includes(consultant);
    const [day, saleMonth, year] = sale.date.split("/");
    const matchesMonth = !month || `${year}-${saleMonth}` === month;
    const haystack = `${sale.client} ${sale.phone} ${sale.product} ${sale.consultants.join(" ")} ${sale.note}`.toLowerCase();
    return matchesConsultant && matchesMonth && haystack.includes(query.toLowerCase());
  }), [consultant, month, query, sales]);
  const gross = filteredSales.reduce((sum, sale) => sum + sale.gross, 0);
  const net = filteredSales.reduce((sum, sale) => sum + sale.net, 0);
  const ranking = useMemo<HubRankingItem[]>(() => consultants.map((name) => ({ name, count: filteredSales.filter((sale) => sale.consultants.includes(name)).length, gross: filteredSales.filter((sale) => sale.consultants.includes(name)).reduce((sum, sale) => sum + sale.gross, 0), net: filteredSales.filter((sale) => sale.consultants.includes(name)).reduce((sum, sale) => sum + sale.net, 0) })).filter((item) => item.count > 0).sort((a, b) => b.net - a.net), [consultants, filteredSales]);

  function selectRanking(name: string) {
    setConsultant(name);
    setSelectedRanking(name);
    setNotice(`${name} selecionado: a tabela foi filtrada por este consultor.`);
  }

  function shiftMonth(delta: number) { const [year, current] = (month || new Date().toISOString().slice(0, 7)).split("-").map(Number); const date = new Date(year, current - 1 + delta, 1); setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`); }
  function toggleConsultant(name: string) { setNewSale((current) => ({ ...current, consultants: current.consultants.includes(name) ? current.consultants.filter((item) => item !== name) : [...current.consultants, name] })); }
  function saveSale(event: FormEvent) { event.preventDefault(); if (!newSale.client || !newSale.gross) { setNotice("Informe pelo menos cliente e valor bruto."); return; } const value = Number(newSale.gross); const saleData = { date: new Date().toLocaleDateString("pt-BR"), client: newSale.client, phone: newSale.phone || "—", consultants: newSale.consultants.length ? newSale.consultants : ["—"], product: newSale.product, status: newSale.status, cbk: false, gross: value, net: Number(newSale.net || newSale.gross), note: newSale.note }; createVendaMutation.mutateAsync(saleData).catch(() => setSales((current) => [{ id: Date.now(), ...saleData }, ...current])); setModal(null); setNewSale({ client: "", phone: "", product: "Revisão de Juros", status: "Pendente", gross: "", net: "", note: "", consultants: [] }); setNotice("Venda cadastrada com sucesso."); }
  function addConsultant(event: FormEvent) { event.preventDefault(); const name = newConsultant.trim(); if (!name) return; if (consultants.some((item) => item.toLowerCase() === name.toLowerCase())) { setNotice("Esse consultor já está cadastrado."); return; } setConsultants((current) => [...current, name]); setNotice(`Consultor ${name} cadastrado.`); setNewConsultant(""); }
  function downloadFile(content: BlobPart, type: string, filename: string) { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
  function exportCsv() { downloadFile(`\ufeff${buildSalesHubCsv(filteredSales, ranking)}`, "text/csv;charset=utf-8", "sales-hub-relatorio.csv"); setNotice("CSV exportado com vendas filtradas e ranking de consultores."); }
  function exportPdf() { const printWindow = window.open("", "_blank"); if (!printWindow) { setNotice("O navegador bloqueou a janela do PDF. Permita pop-ups para exportar."); return; } const rows = filteredSales.map((sale) => `<tr><td>${sale.date}</td><td>${sale.client}</td><td>${sale.consultants.join(", ")}</td><td>${sale.product}</td><td>${sale.status}</td><td>${hubMoney(sale.gross)}</td><td>${hubMoney(sale.net)}</td></tr>`).join(""); const rankingRows = ranking.map((item, index) => `<tr><td>${index + 1}</td><td>${item.name}</td><td>${item.count}</td><td>${hubMoney(item.gross)}</td><td>${hubMoney(item.net)}</td></tr>`).join(""); printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Sales HUB — Relatório</title><style>body{font:12px Arial;color:#202020;margin:34px}h1{color:#8a6016;margin-bottom:4px}h2{margin-top:28px;border-bottom:2px solid #d5a63d;padding-bottom:7px}p{color:#555}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:7px;text-align:left}th{background:#f5e7c2}tr:nth-child(even){background:#fafafa}.meta{display:flex;gap:24px;margin:18px 0;font-weight:bold}@media print{body{margin:15mm}}</style></head><body><h1>Sales HUB</h1><p>Relatório de vendas e ranking de consultores</p><div class="meta"><span>Período: ${month || "Todos"}</span><span>Vendas: ${filteredSales.length}</span><span>Bruto: ${hubMoney(gross)}</span><span>Líquido: ${hubMoney(net)}</span></div><h2>Vendas filtradas</h2><table><thead><tr><th>Data</th><th>Cliente</th><th>Consultor(es)</th><th>Produto</th><th>Status</th><th>Bruto</th><th>Líquido</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Nenhuma venda encontrada.</td></tr>'}</tbody></table><h2>Ranking de consultores</h2><table><thead><tr><th>Posição</th><th>Consultor</th><th>Vendas</th><th>Bruto</th><th>Líquido</th></tr></thead><tbody>${rankingRows}</tbody></table><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`); printWindow.document.close(); setNotice("Relatório PDF aberto para impressão ou salvamento."); }

  if (section === "control") return <div className="hub-dashboard"><HubHeader section={section} setSection={setSection} userName={userName} /><section className="control-dashboard"><div className="control-title"><div><span className="eyebrow eyebrow-muted">N1 Control</span><h2>Inteligência consolidada</h2><p>Vendas, margem e exposição a chargebacks em tempo real.</p></div><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div><div className="control-metrics"><HubMetric label="Bruto consolidado" value={hubMoney(1229657.15)} detail="290 venda(s) no mês" tone="gold" /><HubMetric label="Líquido" value={hubMoney(1126784.27)} detail="Margem líquida 91.6%" tone="green" /><HubMetric label="Chargebacks" value={hubMoney(0)} detail="0 caso(s) · taxa 0.0%" tone="red" /><HubMetric label="Resultado líquido final" value={hubMoney(1126784.27)} detail="Líquido − perda c/ CBK" tone="gold" /></div><section className="control-panel"><h3>Distribuição do faturamento</h3><p>Participação de cada setor sobre o bruto do mês</p><div className="distribution-row"><span>Comercial</span><div><i style={{ width: "35%" }} /></div><strong>R$ 435.827,29 · 35.4%</strong></div><div className="distribution-row"><span>Jurídico</span><div><i style={{ width: "65%" }} /></div><strong>R$ 793.829,86 · 64.6%</strong></div></section><div className="control-sector-grid"><ControlSector title="Comercial" count="165" ticket="R$ 2.641,38" gross="R$ 435.827,29" net="R$ 370.235,00" margin="84.9%" /><ControlSector title="Jurídico" count="125" ticket="R$ 6.350,64" gross="R$ 793.829,86" net="R$ 756.549,27" margin="95.3%" /></div><section className="control-panel"><h3>Resumo inteligente</h3><div className="smart-summary"><span>Ticket médio geral <b>R$ 4.240,20</b></span><span>Taxa de reversão CBK <b>0.0%</b></span><span>Perda líquida com CBK <b>R$ 0,00</b></span><span>Resultado líquido final <b>R$ 1.126.784,27</b></span></div></section></section></div>;

  return <div className="hub-dashboard"><HubHeader section={section} setSection={setSection} userName={userName} /><section className="hub-summary"><div><h2>Dashboard executivo</h2><p>Comercial × Jurídico — setembro de 2026</p></div><div className="summary-totals">Total bruto: <b>{hubMoney(gross || 1223317.15)}</b> &nbsp; Líquido: <b>{hubMoney(net || 1120444.27)}</b> &nbsp; CBKs: <b>0</b></div><div className="sector-overview"><div><span>Comercial</span><b>162</b><strong>35.1% do bruto</strong><i style={{ width: "35%" }} /></div><div><span>Jurídico</span><b>125</b><strong>64.9% do bruto</strong><i style={{ width: "65%" }} /></div></div></section><div className="hub-tabs"><button className={section === "comercial" ? "active" : ""} onClick={() => setSection("comercial")}><Briefcase size={16} /> Comercial</button><button className={section === "juridico" ? "active" : ""} onClick={() => setSection("juridico")}><Scale size={16} /> Jurídico</button><button className="" onClick={() => setSection("control")}><LayoutDashboard size={16} /> N1 Control</button></div><div className="hub-metrics"><HubMetric label="Vendas no mês" value={String(filteredSales.length || 165)} detail="Em movimento" tone="blue" /><HubMetric label="Valor bruto" value={hubMoney(gross || 435827.29)} detail="Total faturado" tone="green" /><HubMetric label="Valor líquido" value={hubMoney(net || 370235)} detail="84.9% do bruto" tone="gold" /><HubMetric label="Chargebacks" value="0" detail="Nenhum chargeback no período" tone="red" /></div><section className="hub-filter-panel"><div className="hub-filter-row"><div><label>Período</label><div className="month-control"><button onClick={() => shiftMonth(-1)}>‹</button><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /><button onClick={() => shiftMonth(1)}>›</button><button onClick={() => setMonth("")}>×</button></div></div><div><label>Consultor</label><select value={consultant} onChange={(event) => { const value = event.target.value; setConsultant(value); setSelectedRanking(value === "Todos" ? null : value); }}><option>Todos</option>{hubConsultants.map((name) => <option key={name}>{name}</option>)}</select></div><div className="hub-search"><label>Buscar</label><div><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, telefone, consultor, produto..." /></div></div><div className="hub-actions"><button onClick={exportCsv}><FileText size={14} /> CSV</button><button onClick={exportPdf}><FileText size={14} /> PDF</button><button onClick={() => setModal("consultants")}><Users size={14} /> Consultores</button><button className="hub-primary" onClick={() => setModal("new-sale")}><Plus size={15} /> Nova venda</button></div></div></section><section className="hub-panel ranking-panel"><div className="hub-panel-heading"><div><h3><Trophy size={17} /> Ranking de consultores</h3><p>{selectedRanking ? `${selectedRanking} selecionado · tabela filtrada` : "Clique em um consultor para filtrar a tabela"}</p>{selectedRanking && <button className="ranking-clear" onClick={() => { setSelectedRanking(null); setConsultant("Todos"); }}>Limpar seleção <X size={13} /></button>}</div></div><div className="ranking-grid">{ranking.slice(0, 9).map((item, index) => <button className={`ranking-card ${selectedRanking === item.name ? "selected" : ""}`} aria-pressed={selectedRanking === item.name} key={item.name} onClick={() => selectRanking(item.name)}><div><b>#{index + 1}</b><strong>{item.name}</strong><small>{item.count} venda(s)</small></div><span>Bruto <b>{hubMoney(item.gross)}</b></span><span>Líquido <b>{hubMoney(item.net)}</b></span><i style={{ width: `${Math.min(100, item.net / Math.max(1, ranking[0]?.net || 1) * 100)}%` }} /></button>)}</div></section><section className="hub-analytics"><div className="hub-panel"><div className="hub-panel-heading"><div><h3>Evolução — últimos 12 meses</h3><p>Bruto, líquido e chargebacks · todos os consultores</p></div><span className="chart-legend"><i /> Bruto <i /> Líquido</span></div>{chartsReady ? <div className="bar-chart">{[22, 30, 27, 38, 32, 45, 42, 55, 48, 62, 70, 86].map((height, index) => <div key={index}><span style={{ height: `${height}%` }} /><small>{["out", "nov", "dez", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set"][index]}</small></div>)}</div> : <ChartSkeleton label="Carregando evolução mensal" />}</div><div className="hub-panel heatmap-panel"><div className="hub-panel-heading"><div><h3>Heatmap de vendas</h3><p>Dia da semana × período do dia</p></div></div>{chartsReady ? <><div className="heatmap">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day, row) => <div key={day}><small>{day}</small>{[0, 1, 2, 3].map((cell) => <i key={cell} className={`heat-${(row * 3 + cell) % 5}`} />)}</div>)}</div><p className="heatmap-caption">Pico: <b>27 venda(s)</b> em uma faixa</p></> : <ChartSkeleton label="Calculando horários de pico" compact />}</div></section><section className="hub-panel sales-table-panel"><div className="hub-panel-heading"><div><h3>Vendas registradas</h3><p>{filteredSales.length} registro(s) no filtro atual</p></div><button className="text-button" onClick={() => setQuery("")}>Limpar filtros <X size={14} /></button></div><div className="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Telefone</th><th>Consultor</th><th>Produto</th><th>Status</th><th>CBK</th><th>Bruto</th><th>Líquido</th><th>Ações</th></tr></thead><tbody>{filteredSales.map((sale) => <tr key={sale.id}><td>{sale.date}</td><td><strong>{sale.client}</strong></td><td>{sale.phone}</td><td>{sale.consultants.join(", ")}</td><td>{sale.product}</td><td><StatusPill tone={sale.status === "OK" ? "green" : "yellow"}>{sale.status}</StatusPill></td><td>{sale.cbk ? "sim" : "não"}</td><td>{hubMoney(sale.gross)}</td><td>{hubMoney(sale.net)}</td><td><button className="row-more icon-button" onClick={() => setNotice(`Ações para ${sale.client}: edição e histórico estarão disponíveis na próxima etapa.`)}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div></section>{notice && <button className="hub-toast" onClick={() => setNotice("")}>{notice}<X size={14} /></button>}{modal === "consultants" && <div className="hub-modal-backdrop"><div className="hub-modal"><button className="drawer-close icon-button" onClick={() => setModal(null)}><X size={18} /></button><span className="eyebrow eyebrow-muted">Gestão de equipe</span><h2>Consultores — {section === "juridico" ? "Jurídico" : "Comercial"}</h2><form className="add-consultant" onSubmit={addConsultant}><input placeholder="Nome do novo consultor" value={newConsultant} onChange={(event) => setNewConsultant(event.target.value)} /><button className="hub-primary" type="submit"><Plus size={16} /></button></form><div className="consultant-list">{hubConsultants.map((name) => <div key={name}><span>{name}</span><button className="icon-button" onClick={() => setNotice(`Remoção de ${name} disponível após confirmação.`)} aria-label={`Remover ${name}`}>×</button></div>)}</div><small>Vendas já registradas continuam preservadas no histórico.</small></div></div>}{modal === "new-sale" && <div className="hub-modal-backdrop"><form className="hub-modal new-sale-modal" onSubmit={saveSale}><button type="button" className="drawer-close icon-button" onClick={() => setModal(null)}><X size={18} /></button><span className="eyebrow eyebrow-muted">Cadastro operacional</span><h2>Nova venda</h2><div className="new-sale-grid"><label>Cliente<input value={newSale.client} onChange={(event) => setNewSale({ ...newSale, client: event.target.value })} placeholder="Nome do cliente" /></label><label>Telefone<input value={newSale.phone} onChange={(event) => setNewSale({ ...newSale, phone: event.target.value })} placeholder="(00) 00000-0000" /></label><label>Data da venda<input type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Produto<input value={newSale.product} onChange={(event) => setNewSale({ ...newSale, product: event.target.value })} /></label><label className="consultant-picker">Consultor(es)<div>{hubConsultants.slice(0, 8).map((name) => <button type="button" className={newSale.consultants.includes(name) ? "selected" : ""} key={name} onClick={() => toggleConsultant(name)}>{name}</button>)}</div></label><label>Status<select value={newSale.status} onChange={(event) => setNewSale({ ...newSale, status: event.target.value as HubSale["status"] })}><option>Pendente</option><option>OK</option></select></label><label>Valor bruto (R$)<input type="number" min="0" value={newSale.gross} onChange={(event) => setNewSale({ ...newSale, gross: event.target.value })} placeholder="0,00" /></label><label>Valor líquido (R$)<input type="number" min="0" value={newSale.net} onChange={(event) => setNewSale({ ...newSale, net: event.target.value })} placeholder="0,00" /></label><label className="checkbox-label"><input type="checkbox" /> Houve chargeback (CBK)</label><label className="full-field">Observação<textarea value={newSale.note} onChange={(event) => setNewSale({ ...newSale, note: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancelar</button><button type="submit" className="hub-primary">Salvar venda</button></div></form></div>}</div>;
}

function ChartSkeleton({ label, compact = false }: { label: string; compact?: boolean }) { return <div className={`chart-skeleton ${compact ? "compact" : ""}`} role="status" aria-label={label}><span className="skeleton-spinner" /><strong>{label}</strong><div className="skeleton-bars">{[1,2,3,4,5,6,7].map((item) => <i key={item} />)}</div></div>; }
function HubHeader({ section, setSection, userName }: { section: "comercial" | "juridico" | "control"; setSection: (section: "comercial" | "juridico" | "control") => void; userName: string }) { return <section className="hub-hero-banner"><span className="eyebrow">Centro consolidado de vendas</span><h2>Sales HUB</h2><p>Vendas consolidadas — comercial & jurídico em um só lugar.</p><div className="hub-user-badge"><Users size={20} /><strong>{userName.split(" ")[0]}</strong><small>Master · Comercial & Jurídico</small></div></section>; }
function HubMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <div className={`hub-metric hub-metric-${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function ControlSector({ title, count, ticket, gross: grossValue, net: netValue, margin }: { title: string; count: string; ticket: string; gross: string; net: string; margin: string }) { return <section className="control-sector"><h3>{title}</h3><p>{count} venda(s) · ticket médio {ticket}</p><div><span>Bruto <b>{grossValue}</b></span><span>Líquido <b>{netValue}</b></span><span>Margem líquida <b>{margin}</b></span></div><hr /><p>Exposição a chargebacks</p><div><span>QTD CBK <b>0</b></span><span>VALOR CBK <b>R$ 0,00</b></span></div></section>; }

function Logo({ compact = false, size = "md" }: { compact?: boolean; size?: "sm" | "md" | "lg" | "xl" }) {
  return <N1Logo compact={compact} size={size} />;
}

export function StatusPill({ children, tone }: { children: string; tone: string }) {
  return <span className={`status-pill status-${tone}`}><span className="status-dot" />{children}</span>;
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const requestVerificationCode = trpc.account.requestVerificationCode.useMutation();
  const verifyEmailCode = trpc.account.verifyEmailCode.useMutation();
  const requestPasswordReset = trpc.account.solicitarRedefinicaoSenha.useMutation();
  const resetPassword = trpc.account.redefinirSenha.useMutation();
  const [mode, setMode] = useState<"login" | "register" | "verify" | "verified" | "forgot" | "reset">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [notice, setNotice] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    if (!loginEmail || !password) {
      setMessage("Preencha e-mail e senha para continuar.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: password,
    });
    if (error) {
      setMessage(
        error.code === "invalid_credentials" || error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos. Confira os dados ou use \"Esqueci minha senha\"."
          : error.code === "email_not_confirmed"
            ? "Seu e-mail ainda não foi confirmado."
            : "Não foi possível entrar agora. Tente novamente em instantes.",
      );
      return;
    }
    onLogin();
  }

  async function sendVerificationCode(email: string) {
    setMessage("");
    try {
      await requestVerificationCode.mutateAsync({ email: email.trim() });
      setVerifiedEmail(email.trim());
      setVerificationCode("");
      setMode("verify");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o código.");
    }
  }

  async function requestLogin(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage("As senhas não conferem.");
      return;
    }
    // Step 1: send verification code to the email
    await sendVerificationCode(registerEmail);
  }

  async function verifyRegistrationCode(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      // Step 2: verify the code via our server
      await verifyEmailCode.mutateAsync({ email: verifiedEmail, code: verificationCode });
      // Step 3: code OK — create the account on Supabase
      const { data, error } = await supabase.auth.signUp({
        email: verifiedEmail,
        password: password,
      });
      if (error) {
        setMessage("Falha ao criar conta: " + error.message);
        return;
      }
      if (data.session) {
        onLogin();
      } else {
        setMessage("");
        setNotice("Conta criada! Faça login para continuar.");
        setMode("login");
        setLoginEmail(verifiedEmail);
        setPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível validar o código.");
    }
  }

  async function sendResetCode() {
    setMessage("");
    try {
      await requestPasswordReset.mutateAsync({ email: resetEmail.trim() });
      setResetCode("");
      setPassword("");
      setConfirmPassword("");
      setMode("reset");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o código.");
    }
  }

  async function confirmPasswordReset(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmPassword) {
      setMessage("As senhas não conferem.");
      return;
    }
    try {
      await resetPassword.mutateAsync({ email: resetEmail.trim(), code: resetCode, password });
      setMode("login");
      setLoginEmail(resetEmail.trim());
      setPassword("");
      setConfirmPassword("");
      setNotice("Senha alterada. Entre com a nova senha.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a nova senha.");
    }
  }

  function backToLogin() {
    setMode("login");
    setMessage("");
    setVerificationCode("");
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="login-hero-top"><Logo size="lg" /></div>
        <div className="hero-copy">
          <span className="eyebrow"><ShieldCheck size={15} /> Histórias verificadas</span>
          <h1>Seu processo,<br /><em>transparente</em> de ponta a ponta.</h1>
          <p>Acompanhe cada etapa com clareza, segurança e o cuidado de uma equipe que está do seu lado.</p>
          <div className="testimonial">
            <div className="quote-mark">“</div>
            <p>Sempre desconfiei dos valores que pagava no meu financiamento. A equipe da N1 explicou cada etapa, sem enrolação.</p>
            <div className="testimonial-author"><span className="avatar avatar-coral">JS</span><div><strong>Cliente verificado</strong><small>São Paulo / SP</small></div><CheckCircle2 size={17} /></div>
          </div>
        </div>
        <div className="login-hero-footer"><span>Revisão de juros</span><strong>Recuperou R$ 8.420,55</strong><small>em 42 dias</small></div>
      </section>
      <section className="login-panel">
        <ThemeToggle className="login-theme-toggle" />
        <div className="login-panel-inner">
          <div className="login-mobile-logo"><Logo size="md" /></div>
          <div className="secure-badge"><LockKeyhole size={16} /> Acesso seguro</div>
          <h2>{mode === "login" ? "Entrar no portal" : mode === "register" ? "Criar login" : mode === "verify" ? "Verificar e-mail" : mode === "forgot" ? "Redefinir senha" : mode === "reset" ? "Criar nova senha" : "E-mail verificado"}</h2>
          <p className="login-subtitle">{mode === "login" ? "Use seu e-mail e senha para acompanhar o seu processo." : mode === "register" ? "Informe um e-mail que você possa acessar. Enviaremos um código para verificar o endereço." : mode === "verify" ? `Digite o código enviado para ${verifiedEmail}.` : mode === "forgot" ? "Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um código para você criar uma nova senha." : mode === "reset" ? `Se ${resetEmail.trim()} tiver uma conta, enviamos um código para ele. Digite o código e a nova senha.` : "Seu e-mail foi validado. A criação persistente da conta ainda precisa ser conectada ao sistema de usuários."}</p>
          {mode === "login" ? <>
            <form onSubmit={submit} className="login-form">
              <label>E-mail<input required type="email" autoComplete="username" aria-label="E-mail" placeholder="voce@email.com" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} /></label>
              <label>Senha<div className="password-wrap"><input aria-label="Senha" type={showPassword ? "text" : "password"} placeholder="Digite sua senha" value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="icon-button password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              {notice && <p className="form-message form-message-success" role="status">{notice}</p>}
              {message && <p className="form-message">{message}</p>}
              <button className="primary-button login-button" type="submit">Entrar <ChevronRight size={18} /></button>
            </form>
            <button className="link-button" type="button" onClick={() => { setResetEmail(loginEmail); setMode("forgot"); setMessage(""); setNotice(""); }}>Esqueci minha senha</button>
            <div className="first-access"><strong>Primeiro acesso?</strong><span>Use a senha inicial fornecida pela N1 Soluções. Será solicitada a troca.</span></div>
            <button className="link-button" type="button" onClick={() => { setMode("register"); setMessage(""); }}>Criar login</button>
            <button className="demo-button" type="button" onClick={onLogin}>Acessar demonstração do portal <ArrowUpRight size={15} /></button>
          </> : mode === "register" ? <>
            <form onSubmit={requestLogin} className="login-form">
              <label>E-mail para verificação<input required type="email" aria-label="E-mail para verificação" placeholder="voce@email.com" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} /></label>
              <label>Nova senha<div className="password-wrap"><input required minLength={8} aria-label="Nova senha" type={showPassword ? "text" : "password"} placeholder="Mínimo de 8 caracteres" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="icon-button password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              <label>Confirmar senha<input required minLength={8} aria-label="Confirmar senha" type={showPassword ? "text" : "password"} placeholder="Digite a senha novamente" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
              {message && <p className="form-message">{message}</p>}
              <button className="primary-button login-button" type="submit">Criar conta <ChevronRight size={18} /></button>
            </form>
            <button className="link-button" type="button" onClick={() => { setMode("login"); setMessage(""); }}>Voltar para entrar</button>
          </> : mode === "verify" ? <>
            <form onSubmit={verifyRegistrationCode} className="login-form">
              <label>Código de verificação<input required autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6} aria-label="Código de verificação" placeholder="000000" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
              {message && <p className="form-message">{message}</p>}
              <button className="primary-button login-button" type="submit" disabled={verifyEmailCode.isPending || verificationCode.length !== 6}>{verifyEmailCode.isPending ? "Verificando..." : "Verificar código"} <ChevronRight size={18} /></button>
            </form>
            <button className="link-button" type="button" disabled={requestVerificationCode.isPending} onClick={() => sendVerificationCode(verifiedEmail)}>{requestVerificationCode.isPending ? "Reenviando..." : "Reenviar código"}</button>
            <button className="link-button" onClick={() => { setMode("register"); setMessage(""); }}>Alterar e-mail</button>
          </> : mode === "forgot" ? <>
            <form onSubmit={(event) => { event.preventDefault(); sendResetCode(); }} className="login-form">
              <label>E-mail<input required autoFocus type="email" autoComplete="username" aria-label="E-mail" placeholder="voce@email.com" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} /></label>
              {message && <p className="form-message">{message}</p>}
              <button className="primary-button login-button" type="submit" disabled={requestPasswordReset.isPending}>{requestPasswordReset.isPending ? "Enviando..." : "Enviar código"} <ChevronRight size={18} /></button>
            </form>
            <button className="link-button" type="button" onClick={backToLogin}>Voltar para entrar</button>
          </> : mode === "reset" ? <>
            <form onSubmit={confirmPasswordReset} className="login-form">
              <label>Código recebido por e-mail<input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} aria-label="Código recebido por e-mail" placeholder="000000" value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, "").slice(0, 6))} /></label>
              <label>Nova senha<div className="password-wrap"><input required minLength={8} autoComplete="new-password" aria-label="Nova senha" type={showPassword ? "text" : "password"} placeholder="Mínimo de 8 caracteres" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="icon-button password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
              <label>Confirmar nova senha<input required minLength={8} autoComplete="new-password" aria-label="Confirmar nova senha" type={showPassword ? "text" : "password"} placeholder="Digite a senha novamente" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
              {message && <p className="form-message">{message}</p>}
              <button className="primary-button login-button" type="submit" disabled={resetPassword.isPending || resetCode.length !== 6}>{resetPassword.isPending ? "Salvando..." : "Salvar nova senha"} <ChevronRight size={18} /></button>
            </form>
            <button className="link-button" type="button" disabled={requestPasswordReset.isPending} onClick={sendResetCode}>{requestPasswordReset.isPending ? "Reenviando..." : "Reenviar código"}</button>
            <button className="link-button" type="button" onClick={backToLogin}>Voltar para entrar</button>
          </> : <>
            <button className="primary-button login-button" onClick={backToLogin}>Voltar para entrar <ChevronRight size={18} /></button>
          </>}
          <div className="login-trust"><span><ShieldCheck size={14} /> Certificado</span><span><LockKeyhole size={14} /> Selo LGPD</span><small>Nº LGPD-BR-2024/0917-VTR</small></div>
        </div>
      </section>
    </main>
  );
}

/** Conversations whose last message came from the client (menu badge, bell and dashboard banner). */
function useAwaitingConversations() {
  const conversasQuery = trpc.portal.conversas.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  return (conversasQuery.data ?? []).filter((conversation) => conversation.awaitingReply);
}

function Sidebar({ view, setView, collapsed, setCollapsed, onLogout, userName }: { view: View; setView: (view: View) => void; collapsed: boolean; setCollapsed: (value: boolean) => void; onLogout: () => void; userName: string }) {
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const awaitingCount = useAwaitingConversations().length;
  const items: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "chargebacks", label: "Chargebacks", icon: CreditCard },
    { id: "atendimento", label: "Atendimento", icon: MessageCircle },
    { id: "saleshub", label: "Sales HUB", icon: FileText },
  ];
  return <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
    <div className="sidebar-head"><Logo compact={collapsed} size={collapsed ? "sm" : "md"} /><button className="icon-button collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label="Recolher menu">{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button></div>
    <nav className="main-nav">{items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? "nav-item-active" : ""}`} onClick={() => setView(id)}><Icon size={18} /><span>{label}</span>{id === "atendimento" && awaitingCount > 0 && <b className="nav-count">{awaitingCount}</b>}</button>)}</nav>
    <div className="sidebar-bottom">
      {!collapsed ? (
        <div className="profile-card">
          <div className="profile-card-header">
            <div className="profile-avatar-wrap">
              <span className="avatar avatar-gold">{initials}</span>
              <span className="avatar-status-dot" />
            </div>
            <div className="profile-copy">
              <strong>{userName}</strong>
              <small>Online agora</small>
            </div>
            <button
              className="icon-button profile-logout-btn"
              onClick={onLogout}
              title="Encerrar sessão"
              aria-label="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="profile-card-collapsed">
          <div className="profile-avatar-wrap" title={userName}>
            <span className="avatar avatar-gold">{initials}</span>
            <span className="avatar-status-dot" />
          </div>
          <button
            className="icon-button profile-logout-btn"
            onClick={onLogout}
            title="Encerrar sessão"
            aria-label="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </div>
  </aside>;
}

function Topbar({ view, onMenu, onSearch, onNotifications, userName }: { view: View; onMenu: () => void; onSearch: () => void; onNotifications: () => void; userName: string }) {
  const hasAwaiting = useAwaitingConversations().length > 0;
  const titles: Record<View, [string, string]> = { dashboard: ["Dashboard", "Visão geral do seu portal"], clientes: ["Clientes", "Acompanhe pessoas e processos"], "client-detail": ["Detalhes do Cliente", "Informações completas do cliente"], chargebacks: ["Chargebacks", "Solicitações de devolução em andamento"], atendimento: ["Atendimento", "Converse com seus clientes"], saleshub: ["Sales HUB", "Centro de inteligência comercial e jurídico"] };
  const initials = userName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  return <header className="topbar"><button className="mobile-menu-button icon-button" onClick={onMenu} aria-label="Abrir menu"><Menu size={21} /></button><div><p className="breadcrumb">N1 Soluções <ChevronRight size={14} /> {titles[view][0]}</p><h1>{titles[view][0]}</h1><span>{titles[view][1]}</span></div><div className="topbar-actions"><button className="icon-button" aria-label="Buscar clientes" title="Buscar clientes" onClick={onSearch}><Search size={19} /></button><button className="icon-button notification-button" aria-label="Abrir atendimentos" title="Abrir atendimentos" onClick={onNotifications}><Bell size={19} />{hasAwaiting && <span />}</button><ThemeToggle /><span className="topbar-separator" /><div className="topbar-user"><span className="avatar avatar-gold">{initials}</span><div><strong>{userName}</strong><small>Online agora</small></div></div></div></header>;
}

const formatInt = (value: number) => value.toLocaleString("pt-BR");
const formatPercent = (value: number | null) => (value === null ? "—" : `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);

/** "agora", "há 18 min", "há 2 h", "ontem", "há 3 dias" or the date. */
function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

const activityIcons = { check: CheckCircle2, file: FileText, alert: AlertTriangle, arrow: ArrowUpRight, message: MessageCircle, user: Users };

function deadlinePill(daysLeft: number): { tone: string; text: string } {
  if (daysLeft < 0) return { tone: "red", text: `Venceu há ${-daysLeft} dia${daysLeft === -1 ? "" : "s"}` };
  if (daysLeft === 0) return { tone: "red", text: "Vence hoje" };
  if (daysLeft <= 3) return { tone: "red", text: `Em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}` };
  if (daysLeft <= 7) return { tone: "yellow", text: `Em ${daysLeft} dias` };
  return { tone: "blue", text: `Em ${daysLeft} dias` };
}

function Dashboard({ navigate, userName }: { navigate: (view: View, filter?: ListFilter) => void; userName: string }) {
  const setView = (view: View) => navigate(view);
  const [alertVisible, setAlertVisible] = useState(true);
  const awaiting = useAwaitingConversations();
  const latest = awaiting[0];
  const dashboardQuery = trpc.portal.dashboard.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  const data = dashboardQuery.data;
  const m = data?.metrics;
  const processos = data?.processos;
  const loading = "…";

  const heroes: { id: keyof typeof METRIC_HELP; label: string; value: string; detail: string; icon: typeof Users; target: View; filter?: ListFilter; alert?: boolean }[] = [
    { id: "ativos", label: "Clientes ativos", value: m ? formatInt(m.ativos) : loading, detail: m ? `${formatInt(m.andamento)} em andamento · ${formatInt(m.atencao)} com atenção` : "", icon: Users, target: "clientes", filter: "ativos" },
    { id: "pendentes", label: "Solicitações pendentes", value: m ? formatInt(m.pendentes) : loading, detail: m ? (m.pendentes ? "Conversas aguardando resposta" : "Nenhuma conversa esperando") : "", icon: MessageCircle, target: "atendimento", alert: (m?.pendentes ?? 0) > 0 },
    { id: "cbkAbertos", label: "Chargebacks abertos", value: m ? formatInt(m.cbkAbertos) : loading, detail: m ? (m.ticketCbk === null ? "Sem valores registrados" : `Ticket médio ${hubMoney(m.ticketCbk)}`) : "", icon: CreditCard, target: "chargebacks", filter: "abertos", alert: (m?.prazosVencidos ?? 0) > 0 },
    { id: "reversao", label: "Taxa de reversão", value: m ? formatPercent(m.reversao.percent) : loading, detail: m ? (m.reversao.encerrados ? `${m.reversao.revertidos} de ${m.reversao.encerrados} chargebacks encerrados` : "Nenhum caso encerrado ainda") : "", icon: ArrowUpRight, target: "chargebacks" },
  ];

  const attention: { id: ListFilter; label: string; help: string; value: number | undefined; target: View; severity: "yellow" | "red" }[] = [
    { id: "ociosos", label: CLIENT_LIST_FILTERS.ociosos, help: METRIC_HELP.ociosos, value: m?.ociosos, target: "clientes", severity: "yellow" },
    { id: "semAtualizacao", label: CLIENT_LIST_FILTERS.semAtualizacao, help: METRIC_HELP.semAtualizacao, value: m?.semAtualizacao, target: "clientes", severity: "yellow" },
    { id: "atencao", label: CLIENT_LIST_FILTERS.atencao, help: "Clientes ativos marcados como \"atenção necessária\".", value: m?.atencao, target: "clientes", severity: "red" },
    { id: "vencidos", label: CHARGEBACK_LIST_FILTERS.vencidos, help: "Chargebacks em aberto cujo prazo já passou.", value: m?.prazosVencidos, target: "chargebacks", severity: "red" },
  ];
  const attentionTotal = attention.reduce((sum, item) => sum + (item.value ?? 0), 0);

  const share = (n: number) => (processos && processos.total ? (n / processos.total) * 100 : 0);
  const donutBackground = processos && processos.total
    ? `conic-gradient(var(--chart-1) 0 ${share(processos.andamento)}%, var(--chart-2) ${share(processos.andamento)}% ${share(processos.andamento + processos.atencao)}%, var(--chart-3) ${share(processos.andamento + processos.atencao)}% 100%)`
    : "var(--surface-sunken)";

  return <div className="page-content dashboard-content">
    {alertVisible && latest && <div className="alert-banner"><div className="alert-icon"><Bell size={18} /></div><div><strong>{awaiting.length === 1 ? "1 conversa aguardando resposta" : `${awaiting.length} conversas aguardando resposta`}</strong><p>{latest.name} <span>·</span> {latest.ticketTopic ? `Ticket · ${latest.ticketTopic}: ` : ""}“{latest.lastText.length > 90 ? `${latest.lastText.slice(0, 90)}…` : latest.lastText}”</p></div><button className="banner-link" onClick={() => setView("atendimento")}>Responder <ArrowUpRight size={15} /></button><button className="banner-close icon-button" aria-label="Fechar" onClick={() => setAlertVisible(false)}><X size={16} /></button></div>}

    <div className="welcome-row"><div><span className="eyebrow eyebrow-muted">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span><h2>Olá, {userName.split(" ")[0]}</h2><p>{m ? (attentionTotal || m.pendentes ? "Há itens que precisam da sua atenção hoje." : "Tudo em dia por aqui.") : "Carregando o resumo do portal..."}</p></div><button className="secondary-button" onClick={() => setView("clientes")}><Users size={16} /> Ver clientes</button></div>

    {dashboardQuery.error && <p className="dashboard-error" role="alert">Não foi possível calcular os indicadores agora: {dashboardQuery.error.message}</p>}

    <div className="kpi-grid">
      {heroes.map(({ id, label, value, detail, icon: Icon, target, filter, alert }) => <button key={id} type="button" className={`kpi-card ${alert ? "kpi-card-alert" : ""}`} title={METRIC_HELP[id]} onClick={() => navigate(target, filter)}>
        <span className="kpi-head"><span>{label}</span><span className="kpi-icon"><Icon size={17} /></span></span>
        <strong className={m || dashboardQuery.error ? undefined : "is-loading"}>{value}</strong>
        <small>{detail}</small>
      </button>)}
    </div>

    <div className="dashboard-columns">
      <section className="panel">
        <div className="panel-heading"><div><h3>Carteira de clientes</h3><p>Situação dos processos</p></div><button className="text-button" onClick={() => setView("clientes")}>Ver <ChevronRight size={15} /></button></div>
        <div className="donut-wrap"><div className="donut" style={{ background: donutBackground }}><div className="donut-center"><strong>{processos ? formatInt(processos.total) : loading}</strong><span>clientes</span></div></div><div className="legend"><div><i className="legend-dot dot-violet" /><span>Em andamento</span><strong>{processos?.andamento ?? loading}</strong></div><div><i className="legend-dot dot-yellow" /><span>Atenção</span><strong>{processos?.atencao ?? loading}</strong></div><div><i className="legend-dot dot-green" /><span>Concluídos</span><strong>{processos?.concluidos ?? loading}</strong></div></div></div>
        <div className="progress-caption"><span>Taxa de conclusão</span><strong>{formatPercent(processos?.taxaConclusao ?? null)}</strong></div><div className="progress-bar"><span style={{ width: `${(processos?.taxaConclusao ?? 0) * 100}%` }} /></div>
        <p className="panel-footnote" title={METRIC_HELP.desconsiderados}>{m ? <>{formatInt(m.desconsiderados)} desconsiderado(s) — suspensos ou com chargeback, fora das métricas.{m.desconsiderados > 0 && <> <button type="button" className="inline-link" onClick={() => navigate("clientes", "desconsiderados")}>Ver quais</button></>}</> : ""}</p>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h3>Pontos de atenção</h3><p>{m ? (attentionTotal ? `${formatInt(attentionTotal)} item(ns) para revisar` : "Nada pendente") : "Calculando..."}</p></div></div>
        <div className="attention-list">
          {attention.map((item) => {
            const count = item.value;
            const ok = count === 0;
            return <button key={item.id} type="button" className="attention-row" title={item.help} onClick={() => navigate(item.target, item.id)}>
              <span className={`attention-dot ${count === undefined ? "" : ok ? "attention-ok" : `attention-${item.severity}`}`} />
              <span className="attention-label">{item.label}</span>
              <span className={`attention-count ${count === undefined ? "" : ok ? "attention-count-ok" : `attention-count-${item.severity}`}`}>{count === undefined ? loading : ok ? "Em dia" : formatInt(count)}</span>
              <ChevronRight size={15} />
            </button>;
          })}
        </div>
        {data && !data.temDataDeAtualizacao && <p className="panel-footnote">Usando a data de cadastro até a data de atualização ser ativada no banco.</p>}
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h3>Portal do cliente</h3><p>Uso do portal pelos clientes</p></div></div>
        <div className="portal-stats">
          <div title={METRIC_HELP.aceite}>
            <div className="portal-stat-head"><span>Aceite do termo</span><strong>{m ? formatPercent(m.aceite.percent) : loading}</strong></div>
            <div className="progress-track"><span style={{ width: `${(m?.aceite.percent ?? 0) * 100}%` }} /></div>
            <small>{m ? `${m.aceite.aceitos} de ${m.aceite.elegiveis} clientes com login` : ""}</small>
          </div>
          <div title={METRIC_HELP.conversao}>
            <div className="portal-stat-head"><span>Solicitações respondidas</span><strong>{m ? formatPercent(m.conversao.percent) : loading}</strong></div>
            <div className="progress-track"><span style={{ width: `${(m?.conversao.percent ?? 0) * 100}%` }} /></div>
            <small>{m ? `${m.conversao.respondidas} de ${m.conversao.total} conversas` : ""}</small>
          </div>
          <div title={METRIC_HELP.ativos30d}>
            <div className="portal-stat-head"><span>Acessaram nos últimos {DASHBOARD_RULES.recentLoginDays} dias</span><strong>{m ? formatInt(m.ativos30d) : loading}</strong></div>
            <small>{m ? (m.aceite.elegiveis ? `de ${m.aceite.elegiveis} cliente(s) com login` : "Nenhum cliente com login ainda") : ""}</small>
          </div>
        </div>
      </section>
    </div>

    <div className="dashboard-columns dashboard-columns-wide">
      <section className="panel recent-panel"><div className="panel-heading"><div><h3>Atividade recente</h3><p>Últimos acontecimentos no portal</p></div></div>
        <div className="activity-list">
          {data && data.atividade.length === 0 && <p className="dashboard-empty">Nenhuma atividade registrada ainda.</p>}
          {!data && <LoadingRows />}
          {data?.atividade.map((item, index) => {
            const Icon = activityIcons[item.icon];
            return <div className="activity-item" key={`${item.at}-${index}`}><span className={`activity-icon activity-${item.kind}`}><Icon size={16} /></span><div><strong>{item.title}</strong><p>{item.detail}</p></div><time dateTime={item.at}>{timeAgo(item.at)}</time></div>;
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading"><div><h3>Próximos prazos</h3><p>Chargebacks em aberto</p></div><button className="text-button" onClick={() => setView("chargebacks")}>Ver todos <ChevronRight size={15} /></button></div>
        {data && data.prazos.length === 0 && <p className="dashboard-empty">Nenhum prazo em aberto.</p>}
        {!data && <LoadingRows />}
        {data && data.prazos.length > 0 && <div className="deadline-list">{data.prazos.map((prazo) => {
          const date = new Date(prazo.date);
          const pill = deadlinePill(prazo.daysLeft);
          return <div className="deadline-row" key={`${prazo.client}-${prazo.date}`}><span className={`calendar-box ${pill.tone === "red" ? "calendar-red" : pill.tone === "yellow" ? "calendar-yellow" : ""}`}><b>{String(date.getDate()).padStart(2, "0")}</b><small>{date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</small></span><div><strong>{prazo.client}</strong><p>{prazo.title}</p></div><StatusPill tone={pill.tone}>{pill.text}</StatusPill></div>;
        })}</div>}
      </section>
    </div>
  </div>;
}

/** Shows which dashboard filter a list is under, with a way out. */
function ListFilterBar({ label, count, noun, onClear }: { label: string; count: number | undefined; noun: string; onClear: () => void }) {
  return <div className="list-filter-bar" role="status">
    <span>Filtro do painel: <b>{label}</b>{count !== undefined && <> · {count} {noun}</>}</span>
    <button type="button" className="text-button" onClick={onClear}>Limpar filtro <X size={14} /></button>
  </div>;
}

function ClientsPage({ setView, selectedClient, setSelectedClient, listFilter, onClearFilter }: { setView: (view: View) => void; selectedClient: Client | null; setSelectedClient: (client: Client | null) => void; listFilter: ClientListFilter | null; onClearFilter: () => void }) {
  const dashboardQuery = trpc.portal.dashboard.useQuery(undefined, { retry: false, enabled: listFilter !== null });
  const filterIds = listFilter ? dashboardQuery.data?.listas.clientes[listFilter] : undefined;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "attention">("all");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", cpf: "", phone: "", services: [] as string[] });

  // Supabase-backed data
  const clientesQuery = trpc.portal.clientes.useQuery(undefined, { retry: false });
  const createClienteMutation = trpc.portal.createCliente.useMutation({
    onSuccess: (created) => {
      clientesQuery.refetch();
      showAccessResult(created.access, "Cliente cadastrado.");
    },
    onError: (error) => toast.error(`Não foi possível cadastrar o cliente: ${error.message}`),
  });
  const remoteClientes = clientesQuery.data;
  // Merge remote + fallback to local static data
  const clientList: Client[] = useMemo(() => {
    if (remoteClientes && remoteClientes.length > 0) {
      return (remoteClientes as Record<string, unknown>[]).map((row) => ({
        id: typeof row.id === "number" ? row.id : undefined,
        name: String(row.name ?? ""),
        cpf: String(row.cpf ?? ""),
        type: String(row.type ?? ""),
        status: String(row.status ?? ""),
        updated: String(row.updated ?? ""),
        tone: (row.tone as "green" | "yellow" | "red") ?? "green",
        email: row.email ? String(row.email) : undefined,
        phone: row.phone ? String(row.phone) : undefined,
        services: Array.isArray(row.services) ? (row.services as string[]) : undefined,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
      } as Client));
    }
    return clients;
  }, [remoteClientes]);

  const filtered = useMemo(() => clientList.filter((client) => {
    if (listFilter) {
      // Same records the dashboard counted (ids computed on the server)
      if (!filterIds || client.id === undefined || !filterIds.includes(client.id)) return false;
      return `${client.name} ${client.type} ${client.email ?? ""} ${client.phone ?? ""}`.toLowerCase().includes(query.toLowerCase());
    }
    const matchesQuery = `${client.name} ${client.type} ${client.email ?? ""} ${client.phone ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "attention" ? client.tone === "red" : client.status !== "Concluído" && client.tone !== "red");
    return matchesQuery && matchesStatus;
  }), [clientList, query, statusFilter, listFilter, filterIds]);
  const activeCount = clientList.filter((client) => client.status !== "Concluído" && client.tone !== "red").length;
  const attentionCount = clientList.filter((client) => client.tone === "red").length;

  function registerClient(event: FormEvent) {
    event.preventDefault();
    const clientData = {
      name: newClient.name.trim(),
      cpf: newClient.cpf.trim(),
      type: newClient.services.join(", "),
      status: "Em andamento",
      updated: "Agora",
      tone: "green" as const,
      email: newClient.email.trim() || undefined,
      phone: newClient.phone.trim() || undefined,
      services: newClient.services,
    };
    createClienteMutation.mutate(clientData);
    setNewClient({ name: "", email: "", cpf: "", phone: "", services: [] });
    setRegistrationOpen(false);
  }

  return (
    <div className="page-content">
      <div className="page-actions">
        <div className="search-field">
          <Search size={17} />
          <input placeholder="Buscar por nome ou tipo de processo" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <button className="primary-button" onClick={() => setRegistrationOpen(true)}><Users size={16} /> Cadastrar clientes</button>
      </div>
      <section className="panel table-panel">
        <div className="panel-heading">
          <div><h3>Carteira de clientes</h3><p>{filtered.length} clientes exibidos · {clientesQuery.isLoading ? "Carregando..." : remoteClientes && remoteClientes.length > 0 ? "dados do Supabase" : "dados de demonstração"}</p></div>
          <div className="filter-buttons"><button className={statusFilter === "all" && !listFilter ? "filter-active" : ""} onClick={() => { onClearFilter(); setStatusFilter("all"); }}>Todos <b>{clientList.length}</b></button><button className={statusFilter === "active" && !listFilter ? "filter-active" : ""} onClick={() => { onClearFilter(); setStatusFilter("active"); }}>Em andamento <b>{activeCount}</b></button><button className={statusFilter === "attention" && !listFilter ? "filter-active" : ""} onClick={() => { onClearFilter(); setStatusFilter("attention"); }}>Atenção <b>{attentionCount}</b></button></div>
        </div>
        {listFilter && <ListFilterBar label={CLIENT_LIST_FILTERS[listFilter]} count={filterIds ? filtered.length : undefined} noun="cliente(s)" onClear={onClearFilter} />}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>CPF</th><th>Status</th><th>Tags</th><th>Atualização</th><th /></tr></thead>
            <tbody>{filtered.length === 0 && <tr className="empty-row"><td colSpan={6}>{listFilter && !filterIds ? "Carregando..." : listFilter ? "Nenhum cliente nesta situação. Tudo em dia!" : "Nenhum cliente encontrado."}</td></tr>}{filtered.map((client) => <tr key={client.name} onClick={() => { setSelectedClient(client); setView("client-detail"); }}><td><div className="table-person"><span className="avatar avatar-gradient">{client.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><strong>{client.name}</strong></div></td><td>{client.cpf}</td><td><StatusPill tone={client.tone}>{client.status}</StatusPill></td><td><div className="tags-container">{client.tags && client.tags.length > 0 ? client.tags.map((tag) => <span key={tag} className="client-tag">{tag}</span>) : <span className="no-tags">-</span>}</div></td><td className="muted-cell">{client.updated}</td><td><button className="row-more icon-button" aria-label="Abrir cliente"><ChevronRight size={17} /></button></td></tr>)}</tbody>
          </table>
        </div>
      </section>
      {registrationOpen && <div className="hub-modal-backdrop" onClick={() => setRegistrationOpen(false)}>
        <section className="hub-modal" role="dialog" aria-modal="true" aria-labelledby="client-registration-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="drawer-close icon-button" onClick={() => setRegistrationOpen(false)} aria-label="Fechar cadastro"><X size={18} /></button>
          <span className="eyebrow saleshub-eyebrow">Carteira de clientes</span>
          <h2 id="client-registration-title">Cadastrar cliente</h2>
          <form onSubmit={registerClient}>
            <div className="new-sale-grid">
              <label>Nome completo<input required autoFocus value={newClient.name} onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>E-mail<input required type="email" value={newClient.email} onChange={(event) => setNewClient((current) => ({ ...current, email: event.target.value }))} /></label>
              <label>CPF<input required inputMode="numeric" placeholder="000.000.000-00" value={newClient.cpf} onChange={(event) => setNewClient((current) => ({ ...current, cpf: event.target.value }))} /></label>
              <label>Telefone<input required type="tel" placeholder="(11) 90000-0000" value={newClient.phone} onChange={(event) => setNewClient((current) => ({ ...current, phone: event.target.value }))} /></label>
            </div>
            <fieldset className="client-service-selection">
              <legend>Serviços contratados</legend>
              <div className="client-service-options">{clientServices.map((service) => <label key={service}><input type="checkbox" checked={newClient.services.includes(service)} required={newClient.services.length === 0} onChange={(event) => setNewClient((current) => ({ ...current, services: event.target.checked ? [...current.services, service] : current.services.filter((item) => item !== service) }))} /><span>{service}</span></label>)}</div>
            </fieldset>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setRegistrationOpen(false)}>Cancelar</button><button type="submit" className="hub-primary">Cadastrar cliente</button></div>
          </form>
        </section>
      </div>}
    </div>
  );
}

function ChargebacksPage({ listFilter, onClearFilter }: { listFilter: ChargebackListFilter | null; onClearFilter: () => void }) {
  const chargebacksQuery = trpc.portal.chargebacks.useQuery(undefined, { retry: false });
  const dashboardQuery = trpc.portal.dashboard.useQuery(undefined, { retry: false });
  const cbSummary = dashboardQuery.data?.chargebacks;
  const reversao = dashboardQuery.data?.metrics.reversao;
  const remoteChargebacks = chargebacksQuery.data;
  const chargebackList = useMemo(() => {
    if (remoteChargebacks && remoteChargebacks.length > 0) {
      return (remoteChargebacks as Record<string, unknown>[]).map((row) => ({
        id: typeof row.id === "number" ? row.id : undefined,
        client: String(row.client ?? ""),
        bank: String(row.bank ?? ""),
        amount: String(row.amount ?? ""),
        deadline: String(row.deadline ?? ""),
        status: String(row.status ?? ""),
        tone: String(row.tone ?? "blue"),
      }));
    }
    return chargebacks;
  }, [remoteChargebacks]);
  const [selected, setSelected] = useState<(typeof chargebackList)[number] | null>(null);
  const filterIds = listFilter ? dashboardQuery.data?.listas.chargebacks[listFilter] : undefined;
  const visibleChargebacks = listFilter
    ? chargebackList.filter((item) => {
      const id = (item as { id?: number }).id;
      return id !== undefined && (filterIds ?? []).includes(id);
    })
    : chargebackList;

  function exportReport() {
    const rows = [
      ["Cliente", "Instituição", "Valor estimado", "Prazo", "Status"],
      ...visibleChargebacks.map((item) => [item.client, item.bank, item.amount, item.deadline, item.status]),
    ];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\ufeff${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    link.download = "solicitacoes-chargeback.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <div className="page-content">
    <div className="chargeback-summary"><div title="Soma dos chargebacks revertidos registrados neste ano."><span>Valor recuperado em {cbSummary?.ano ?? new Date().getFullYear()}</span><strong>{cbSummary ? hubMoney(cbSummary.recuperadoNoAno) : "…"}</strong><small>{reversao ? `${reversao.revertidos} caso(s) revertido(s)` : "Calculando..."}</small></div><div title="Chargebacks que ainda não foram revertidos nem negados."><span>Solicitações abertas</span><strong>{cbSummary ? cbSummary.abertos : "…"}</strong><small>{chargebackList.length} registrada(s) no total</small></div><div title="Revertidos dentre os já encerrados (revertidos + negados)."><span>Taxa de sucesso</span><strong>{cbSummary ? formatPercent(cbSummary.taxaSucesso) : "…"}</strong><small>{reversao ? (reversao.encerrados ? `${reversao.revertidos} de ${reversao.encerrados} encerrados` : "Nenhum caso encerrado ainda") : "Calculando..."}</small></div></div>
    <section className="panel table-panel">
      <div className="panel-heading"><div><h3>Solicitações de chargeback</h3><p>Acompanhe devoluções e recuperações financeiras</p></div><button className="secondary-button" onClick={exportReport}><FileText size={16} /> Exportar CSV</button></div>
      {listFilter && <ListFilterBar label={CHARGEBACK_LIST_FILTERS[listFilter]} count={filterIds ? visibleChargebacks.length : undefined} noun="chargeback(s)" onClear={onClearFilter} />}
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Instituição</th><th>Valor estimado</th><th>Prazo</th><th>Status</th><th /></tr></thead><tbody>{visibleChargebacks.length === 0 && <tr className="empty-row"><td colSpan={6}>{listFilter && !filterIds ? "Carregando..." : listFilter ? "Nenhum chargeback nesta situação." : "Nenhum chargeback registrado."}</td></tr>}{visibleChargebacks.map((item) => <tr key={item.client} onClick={() => setSelected(item)}><td><div className="table-person"><span className="avatar avatar-gradient">{item.client.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><strong>{item.client}</strong></div></td><td>{item.bank}</td><td><strong>{item.amount}</strong></td><td className="muted-cell">{item.deadline}</td><td><StatusPill tone={item.tone}>{item.status}</StatusPill></td><td><button className="row-more icon-button" aria-label={`Ver solicitação de ${item.client}`} onClick={(event) => { event.stopPropagation(); setSelected(item); }}><ChevronRight size={17} /></button></td></tr>)}</tbody></table></div>
    </section>
    {selected && <div className="detail-drawer"><button className="drawer-close icon-button" onClick={() => setSelected(null)} aria-label="Fechar detalhes"><X size={18} /></button><span className="eyebrow eyebrow-muted">Solicitação de chargeback</span><div className="drawer-person"><span className="avatar avatar-large avatar-gradient">{selected.client.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><h2>{selected.client}</h2><p>{selected.bank}</p></div></div><StatusPill tone={selected.tone}>{selected.status}</StatusPill><div className="drawer-section"><span>Valor estimado</span><strong>{selected.amount}</strong></div><div className="drawer-section"><span>Prazo</span><strong>{selected.deadline}</strong></div></div>}
  </div>;
}

const avatarTones = ["avatar-coral", "avatar-green", "avatar-purple", "avatar-blue"];
const initialsOf = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("");
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const yesterday = () => new Date(Date.now() - 86_400_000);

/** "09:42" today, "Ontem", or "26/09" for the conversation list. */
function shortWhen(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (sameDay(date, new Date())) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay(date, yesterday())) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Separator shown in the chat when the day changes. */
function dayLabel(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (sameDay(date, new Date())) return "Hoje";
  if (sameDay(date, yesterday())) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

function AtendimentoPage() {
  const utils = trpc.useUtils();
  const conversasQuery = trpc.portal.conversas.useQuery(undefined, { retry: false, refetchInterval: 15_000 });
  const conversations = conversasQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const activeId = selectedId ?? conversations[0]?.clientId ?? null;
  const selected = conversations.find((conversation) => conversation.clientId === activeId) ?? null;
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [draft, setDraft] = useState("");
  const chatBody = useRef<HTMLDivElement>(null);

  const mensagensQuery = trpc.portal.mensagens.useQuery({ clientId: activeId ?? 0 }, { enabled: activeId !== null, retry: false, refetchInterval: 15_000 });
  const messages = activeId === null ? [] : mensagensQuery.data ?? [];
  const sendMensagemMutation = trpc.portal.sendMensagem.useMutation({
    // Stays pending until the reply shows in the chat and the list stops flagging the conversation.
    onSuccess: () => Promise.all([mensagensQuery.refetch(), utils.portal.conversas.invalidate()]),
    onError: (_error, variables) => setDraft((current) => current || variables.text),
  });
  const pendingText = sendMensagemMutation.isPending ? sendMensagemMutation.variables?.text : undefined;

  const visibleConversations = conversations.filter((conversation) => conversation.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const awaitingCount = conversations.filter((conversation) => conversation.awaitingReply).length;

  useEffect(() => {
    const body = chatBody.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [activeId, messages.length, pendingText]);

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selected || sendMensagemMutation.isPending) return;
    sendMensagemMutation.mutate({ clientId: selected.clientId, clientName: selected.name, sender: "team", text });
    setDraft("");
  }

  function downloadTranscript() {
    if (!selected) return;
    const transcript = messages.map((message) => `${message.time} · ${message.from === "team" ? "Equipe" : selected.name}: ${message.text}`).join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([transcript], { type: "text/plain;charset=utf-8" }));
    link.download = `conversa-${selected.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <div className="page-content support-page"><div className="support-layout">
    <section className="panel conversation-list">
      <div className="conversation-head"><div><h3>Conversas</h3><p>{conversations.length} conversa(s){awaitingCount > 0 && <> · <b className="conversation-waiting-count">{awaitingCount} aguardando resposta</b></>}</p></div><button className="icon-button" aria-label="Buscar conversas" title="Buscar conversas" onClick={() => { setSearchOpen((open) => !open); setSearchQuery(""); }}><Search size={17} /></button></div>
      {searchOpen && <div className="conversation-search"><input autoFocus placeholder="Buscar pelo nome do cliente..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></div>}
      {conversasQuery.isLoading && <p className="conversation-empty">Carregando conversas...</p>}
      {!conversasQuery.isLoading && visibleConversations.length === 0 && <p className="conversation-empty">{searchQuery ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda. Quando um cliente escrever pelo portal, ela aparece aqui."}</p>}
      {visibleConversations.map((conversation) => <button key={conversation.clientId} className={`conversation conversation-button ${activeId === conversation.clientId ? "active-conversation" : ""}`} onClick={() => setSelectedId(conversation.clientId)}>
        <span className={`avatar ${avatarTones[conversation.clientId % avatarTones.length]}`}>{initialsOf(conversation.name)}</span>
        <div>
          <strong>{conversation.name}</strong>
          <p>{conversation.lastFrom === "team" ? "Você: " : ""}{conversation.lastText}</p>
          <small>{shortWhen(conversation.lastAt)}{conversation.awaitingReply && <span className="conversation-waiting">{conversation.ticketTopic ? `Ticket · ${conversation.ticketTopic}` : "Aguardando resposta"}</span>}</small>
        </div>
        {conversation.awaitingReply && <span className="unread-dot" />}
      </button>)}
    </section>
    <section className="panel chat-panel">
      {selected ? <>
        <div className="chat-head"><div className="table-person"><span className={`avatar ${avatarTones[selected.clientId % avatarTones.length]}`}>{initialsOf(selected.name)}</span><div><strong>{selected.name}</strong><small>{[selected.type, selected.status].filter(Boolean).join(" · ") || "Processo acompanhado pela equipe"}</small></div></div><button className="icon-button" aria-label="Baixar conversa" title="Baixar conversa" onClick={downloadTranscript}><FileText size={17} /></button></div>
        <div className="chat-body" ref={chatBody}>
          {mensagensQuery.isLoading && <div className="chat-date">Carregando mensagens...</div>}
          {messages.map((message, index) => {
            const ticket = parseTicketMessage(message.text);
            const day = dayLabel(message.createdAt);
            const showDay = day && day !== dayLabel(messages[index - 1]?.createdAt ?? null);
            return <Fragment key={message.id}>
              {showDay && <div className="chat-date">{day}</div>}
              <div className={`chat-message ${message.from === "team" ? "message-team" : "message-client"}`}>
                {ticket && <span className="ticket-label">Ticket · {ticket.topic}</span>}
                <p>{ticket ? ticket.body : message.text}</p>
                <small>{message.time} {message.from === "team" && <CheckCircle2 size={12} />}</small>
              </div>
            </Fragment>;
          })}
          {pendingText && <div className="chat-message message-team chat-message-pending"><p>{pendingText}</p><small>Enviando...</small></div>}
        </div>
        {sendMensagemMutation.error && <p className="chat-send-error" role="alert">Não foi possível enviar a mensagem. Tente novamente.</p>}
        <form className="chat-composer" onSubmit={sendMessage}><input aria-label={`Responder a ${selected.name}`} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Responder a ${selected.name.split(" ")[0]}...`} maxLength={2000} /><button type="submit" className="send-button" aria-label="Enviar mensagem" title="Enviar mensagem" disabled={sendMensagemMutation.isPending || !draft.trim()}><Send size={17} /></button></form>
      </> : <div className="chat-empty"><MessageCircle size={28} /><p>{conversasQuery.isLoading ? "Carregando..." : "Selecione uma conversa para ver as mensagens."}</p></div>}
    </section>
  </div></div>;
}

/** Shimmering placeholder rows while a panel loads. */
function LoadingRows() { return <div className="skeleton-list" role="status" aria-label="Carregando..."><i /><i /><i /></div>; }

function MoreIcon() { return <span className="more-icon"><i /><i /><i /></span>; }

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  // Filter chosen on the dashboard; opening a page from the menu clears it.
  const [listFilter, setListFilter] = useState<ListFilter | null>(null);
  function navigate(next: View, filter?: ListFilter) {
    setListFilter(filter ?? null);
    setView(next);
  }
  const clientFilter = listFilter && listFilter in CLIENT_LIST_FILTERS ? (listFilter as ClientListFilter) : null;
  const chargebackFilter = listFilter && listFilter in CHARGEBACK_LIST_FILTERS ? (listFilter as ChargebackListFilter) : null;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [userName, setUserName] = useState("Usuário");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  // Logins created automatically when a client is registered carry role "client" in app_metadata.
  const [isClientUser, setIsClientUser] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  function applySession(session: Session | null) {
    if (!session) return;
    const meta = session.user.user_metadata;
    const name = meta?.full_name || meta?.name || session.user.email?.split("@")[0] || "Usuário";
    setUserName(name);
    setIsClientUser(session.user.app_metadata?.role === "client");
    setMustChangePassword(meta?.must_change_password === true);
  }

  // On mount, check if there's already an active session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        applySession(data.session);
        setLoggedIn(true);
      }
    });
  }, []);

  function handleLogin() {
    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session);
      setLoggedIn(true);
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setLoggedIn(false);
    setUserName("Usuário");
    setIsClientUser(false);
    setMustChangePassword(false);
  }

  if (!loggedIn) return <LoginScreen onLogin={handleLogin} />;
  if (mustChangePassword) return <ChangePasswordScreen onDone={() => setMustChangePassword(false)} onLogout={handleLogout} />;
  if (isClientUser) return <ClientPortal onLogout={handleLogout} />;
  return (
    <div className="app-shell">
      {mobileMenu && (
        <>
          <div className="sidebar-overlay visible" onClick={() => setMobileMenu(false)} />
          <div className="mobile-sidebar mobile-sidebar-open">
            <div className="mobile-sidebar-head">
              <Logo size="md" />
              <button className="icon-button" onClick={() => setMobileMenu(false)} aria-label="Fechar menu">
                <X size={20} />
              </button>
            </div>
            <Sidebar view={view} setView={(next) => { navigate(next); setMobileMenu(false); }} collapsed={false} setCollapsed={() => undefined} onLogout={handleLogout} userName={userName} />
          </div>
        </>
      )}
      <Sidebar view={view} setView={(next) => navigate(next)} collapsed={collapsed} setCollapsed={setCollapsed} onLogout={handleLogout} userName={userName} />
      <main className={`main-area ${collapsed ? "main-area-wide" : ""}`}>
        <Topbar view={view} onMenu={() => setMobileMenu(true)} onSearch={() => navigate("clientes")} onNotifications={() => navigate("atendimento")} userName={userName} />
        {view === "dashboard" && <Dashboard navigate={navigate} userName={userName} />}
        {view === "clientes" && <ClientsPage setView={setView} selectedClient={selectedClient} setSelectedClient={setSelectedClient} listFilter={clientFilter} onClearFilter={() => setListFilter(null)} />}
        {view === "client-detail" && selectedClient && <ClientDetail client={selectedClient} onBack={() => setView("clientes")} />}
        {view === "chargebacks" && <ChargebacksPage listFilter={chargebackFilter} onClearFilter={() => setListFilter(null)} />}
        {view === "atendimento" && <AtendimentoPage />}
        {view === "saleshub" && <SalesHubPage userName={userName} />}
        <footer className="app-footer">© 2026 N1 Soluções <span>·</span> Todos os direitos reservados.</footer>
      </main>
    </div>
  );
}
