/** Client list order: newest registration first (imported clients keep their original date), then highest id. */
export function newestFirst<T extends { created_at?: unknown; id?: unknown }>(rows: T[]): T[] {
  const time = (row: T) => {
    const parsed = typeof row.created_at === "string" ? Date.parse(row.created_at) : NaN;
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return [...rows].sort((a, b) => time(b) - time(a) || Number(b.id ?? 0) - Number(a.id ?? 0));
}

type SearchableClient = { name: string; type?: string; email?: string; phone?: string };

const digitsOf = (value: string) => value.replace(/\D/g, "");

/**
 * The phone as typed in the search, without +55 or a leading 0 (long distance), so
 * "+55 (11) 98868-5326", "011 98868-5326" and "11988685326" all become "11988685326".
 */
function searchDigits(query: string) {
  let digits = digitsOf(query);
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length >= 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

/**
 * The client's phone in every form someone may search for: as saved and, for old mobile numbers
 * saved without the 9 ("(83) 9346-4018"), also with it ("83993464018").
 */
function phoneVariants(phone: string) {
  let digits = digitsOf(phone);
  if (digits.length >= 12 && digits.startsWith("55")) digits = digits.slice(2);
  const variants = [digits];
  if (digits.length === 10 && /[6-9]/.test(digits[2])) variants.push(`${digits.slice(0, 2)}9${digits.slice(2)}`);
  return variants;
}

/**
 * Search box of the client list: name, process type, e-mail or phone. A query made of digits and
 * phone punctuation ("98868-5326", "(11) 98868 5326", "+55 11 9 8868-5326") is matched against the
 * phone's digits, so the format typed does not matter. At least 4 digits, to avoid matching everyone.
 */
export function matchesClientSearch(client: SearchableClient, query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  if (`${client.name} ${client.type ?? ""} ${client.email ?? ""} ${client.phone ?? ""}`.toLowerCase().includes(text)) return true;
  if (!/^[\d\s()+.-]+$/.test(text)) return false;
  const digits = searchDigits(text);
  return digits.length >= 4 && phoneVariants(client.phone ?? "").some((variant) => variant.includes(digits));
}
