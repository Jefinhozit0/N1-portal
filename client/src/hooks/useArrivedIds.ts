import { useRef } from "react";

/**
 * Tells which items arrived after a list was first shown (per `scope`, e.g. per conversation),
 * so only genuinely new chat messages get the entrance animation, not the whole history
 * or a saved copy replacing a line that was already on screen.
 */
export function useArrivedIds(scope: string | number | null, ids: readonly number[] | undefined) {
  const seen = useRef<{ scope: string | number | null; ids: Set<number> } | null>(null);
  // Lazy, idempotent initialisation per scope (allowed during render).
  if (ids && seen.current?.scope !== scope) seen.current = { scope, ids: new Set(ids) };
  return (id: number) => seen.current !== null && seen.current.scope === scope && !seen.current.ids.has(id);
}
