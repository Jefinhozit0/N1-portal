import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageInfo } from "@/lib/pagination";

/** "‹ Página 2 de 9 · 31–60 de 254 ›" under a table. Hidden when everything fits on one page. */
export function Pager({ page, pages, from, to, total, setPage, noun }: PageInfo & { setPage: (page: number) => void; noun: string }) {
  if (pages <= 1) return null;
  return (
    <nav className="sales-pager" aria-label={`Páginas de ${noun}`}>
      <button type="button" className="icon-button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></button>
      <span>Página {page + 1} de {pages} · {noun} {from}–{to} de {total}</span>
      <button type="button" className="icon-button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Próxima página"><ChevronRight size={16} /></button>
    </nav>
  );
}
