import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, CreditCard, Pencil, Search, Trash2, X } from "lucide-react";
import { pageSlice } from "@/lib/pagination";
import { Pager } from "@/components/Pager";
import { StatusPill } from "./Home";
import { SECTOR_LABEL, filterSales, hubMoney, monthLabel, sectorOf, sortSales, totals, type HubSale, type SaleSortKey, type Sector } from "./salesHubData";

type Props = {
  sales: HubSale[];
  /** Sector filter to start with (the sector tab the user came from). */
  initialSector: Sector | "todos";
  /** Export, consultants and new sale buttons, shared with the other tabs. */
  actions: React.ReactNode;
  loading: boolean;
  consultantOptions: string[];
  isAdmin: boolean;
  /** Month shared with the other Sales HUB tabs ("" = all time). */
  month: string;
  monthControl: React.ReactNode;
  onEdit: (sale: HubSale) => void;
  onDelete: (sale: HubSale) => void;
  onMarkPaid: (sale: HubSale) => void;
  markingPaid: boolean;
  onChargeback: (sale: HubSale) => void;
};

/** Every registered sale, to look up, check and fix one by one. */
export function SalesManager({ initialSector, actions, sales, loading, consultantOptions, isAdmin, month, monthControl, onEdit, onDelete, onMarkPaid, markingPaid, onChargeback }: Props) {
  const [sector, setSector] = useState<Sector | "todos">(initialSector);
  const [status, setStatus] = useState<"todos" | HubSale["status"]>("todos");
  const [cbk, setCbk] = useState<"todos" | "sim" | "nao">("todos");
  const [consultant, setConsultant] = useState("Todos");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SaleSortKey; direction: "asc" | "desc" }>({ key: "date", direction: "desc" });
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const base = filterSales(sales, { month, sector, consultant, query }).filter((sale) =>
      (status === "todos" || sale.status === status) && (cbk === "todos" || sale.cbk === (cbk === "sim")));
    return sortSales(base, sort.key, sort.direction);
  }, [sales, month, sector, consultant, query, status, cbk, sort]);
  const sum = useMemo(() => totals(filtered), [filtered]);
  const pending = filtered.filter((sale) => sale.status === "Pendente").length;
  const pagination = pageSlice(filtered, page);
  const visible = pagination.visible;
  const selected = sales.find((sale) => sale.id === selectedId) ?? null;
  const hasFilters = sector !== "todos" || status !== "todos" || cbk !== "todos" || consultant !== "Todos" || query !== "";

  // Any filter change goes back to the first page.
  const change = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setPage(0); };
  function clearFilters() {
    setSector("todos"); setStatus("todos"); setCbk("todos"); setConsultant("Todos"); setQuery(""); setPage(0);
  }
  function sortBy(key: SaleSortKey) {
    // Same column: flip. New column: names A→Z, dates and values from the highest.
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: key === "client" ? "asc" : "desc" });
    setPage(0);
  }
  const sortIcon = (key: SaleSortKey) => sort.key !== key ? null : sort.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
  const header = (key: SaleSortKey, label: string, className?: string) => (
    <th className={className} aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="sales-sort" onClick={() => sortBy(key)}>{label} {sortIcon(key)}</button>
    </th>
  );

  return (
    <>
      <section className="hub-filter-panel">
        <div className="hub-filter-row sales-manager-filters">
          <div>
            <label htmlFor="hub-month">Período</label>
            {monthControl}
          </div>
          <div>
            <label htmlFor="sales-sector">Setor</label>
            <select id="sales-sector" value={sector} onChange={(event) => change(setSector)(event.target.value as Sector | "todos")}>
              <option value="todos">Todos</option><option value="comercial">Comercial</option><option value="juridico">Jurídico</option>
            </select>
          </div>
          <div>
            <label htmlFor="sales-status">Status</label>
            <select id="sales-status" value={status} onChange={(event) => change(setStatus)(event.target.value as "todos" | HubSale["status"])}>
              <option value="todos">Todos</option><option value="Pendente">Pendente</option><option value="OK">OK</option>
            </select>
          </div>
          <div>
            <label htmlFor="sales-cbk">Chargeback</label>
            <select id="sales-cbk" value={cbk} onChange={(event) => change(setCbk)(event.target.value as "todos" | "sim" | "nao")}>
              <option value="todos">Todos</option><option value="sim">Com CBK</option><option value="nao">Sem CBK</option>
            </select>
          </div>
          <div>
            <label htmlFor="sales-consultant">Consultor</label>
            <select id="sales-consultant" value={consultant} onChange={(event) => change(setConsultant)(event.target.value)}>
              <option>Todos</option>
              {consultantOptions.map((name) => <option key={name}>{name}</option>)}
            </select>
          </div>
          <div className="hub-search">
            <label htmlFor="sales-search">Buscar</label>
            <div><Search size={15} /><input id="sales-search" value={query} onChange={(event) => change(setQuery)(event.target.value)} placeholder="Cliente, telefone, produto, observação..." /></div>
          </div>
        </div>
        {actions}
      </section>

      <section className="hub-panel sales-table-panel">
        <div className="hub-panel-heading">
          <div>
            <h3>Vendas cadastradas</h3>
            <p>{loading ? "Carregando..." : `${filtered.length} venda(s) · ${month ? monthLabel(month) : "todo o período"} · bruto ${hubMoney(sum.gross)} · líquido ${hubMoney(sum.net)}${pending ? ` · ${pending} pendente(s)` : ""}`}</p>
          </div>
          {hasFilters && <button type="button" className="text-button" onClick={clearFilters}>Limpar filtros <X size={14} /></button>}
        </div>
        <div className="table-wrap">
          <table className="sales-fit">
            <thead><tr>{header("date", "Data")}<th>Setor</th>{header("client", "Cliente")}<th>Consultor</th><th>Produto</th><th>Status</th>{header("gross", "Bruto", "num")}{header("net", "Líquido", "num")}<th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {!loading && filtered.length === 0 && <tr><td colSpan={9} className="hub-empty-row">Nenhuma venda com esses filtros.</td></tr>}
              {visible.map((sale) => (
                <tr key={sale.id} className={`sales-row ${selectedId === sale.id ? "is-selected" : ""}`} onClick={() => setSelectedId(sale.id)}>
                  <td className="nowrap">{sale.date}</td>
                  <td>{SECTOR_LABEL[sectorOf(sale)]}</td>
                  <td className="sales-client"><strong>{sale.client}</strong>{sale.phone && <small className="hub-note">{sale.phone}</small>}</td>
                  <td>{sale.consultants.join(", ") || "—"}</td>
                  <td>{sale.product || "—"}</td>
                  <td className="nowrap"><StatusPill tone={sale.status === "OK" ? "green" : "yellow"}>{sale.status}</StatusPill>{sale.cbk && <span className="sales-cbk-tag">CBK</span>}</td>
                  <td className="num">{hubMoney(sale.gross)}</td>
                  <td className="num">{hubMoney(sale.net)}</td>
                  <td className="hub-row-actions" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="icon-button" onClick={() => onEdit(sale)} aria-label={`Editar venda de ${sale.client}`} title="Editar venda"><Pencil size={15} /></button>
                    {isAdmin && <button type="button" className="icon-button hub-delete" onClick={() => onDelete(sale)} aria-label={`Apagar venda de ${sale.client}`} title="Apagar venda"><Trash2 size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager {...pagination} setPage={setPage} noun="vendas" />
      </section>

      {selected && (
        <div className="detail-drawer sales-drawer">
          <button className="drawer-close icon-button" onClick={() => setSelectedId(null)} aria-label="Fechar detalhes"><X size={18} /></button>
          <span className="eyebrow eyebrow-muted">Venda #{selected.id} · {SECTOR_LABEL[sectorOf(selected)]}</span>
          <h2 className="sales-drawer-title">{selected.client}</h2>
          <div className="sales-drawer-pills"><StatusPill tone={selected.status === "OK" ? "green" : "yellow"}>{selected.status}</StatusPill>{selected.cbk && <StatusPill tone="red">Chargeback</StatusPill>}</div>
          <div className="sales-drawer-actions">
            <button type="button" className="secondary-button" onClick={() => onEdit(selected)}><Pencil size={15} /> Editar</button>
            {selected.status === "Pendente" && <button type="button" className="secondary-button" disabled={markingPaid} onClick={() => onMarkPaid(selected)}><CheckCircle2 size={15} /> Marcar como OK</button>}
            {selected.cbk && <button type="button" className="secondary-button" onClick={() => onChargeback(selected)}><CreditCard size={15} /> Registrar chargeback</button>}
            {isAdmin && <button type="button" className="secondary-button cbk-delete" onClick={() => onDelete(selected)}><Trash2 size={15} /> Apagar</button>}
          </div>
          <div className="drawer-section"><span>Data da venda</span><strong>{selected.date}</strong></div>
          <div className="drawer-section"><span>Valores</span><strong>Bruto {hubMoney(selected.gross)} · Líquido {hubMoney(selected.net)}</strong>{selected.gross > selected.net && <small className="cbk-muted">Diferença de {hubMoney(selected.gross - selected.net)}</small>}</div>
          <div className="drawer-section"><span>Produto</span><strong>{selected.product || "—"}</strong></div>
          <div className="drawer-section"><span>Consultor(es)</span><strong>{selected.consultants.join(", ") || "—"}</strong></div>
          <div className="drawer-section"><span>Telefone</span><strong>{selected.phone || "—"}</strong></div>
          <div className="drawer-section"><span>Observação</span><p className="cbk-note">{selected.note || "—"}</p></div>
          {selected.createdAt && <p className="cbk-muted sales-drawer-created">Registrada no portal em {new Date(selected.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>}
        </div>
      )}
    </>
  );
}
