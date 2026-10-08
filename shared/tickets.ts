/** Subjects a client can pick when the chatbot hands them over to the team. */
export const TICKET_TOPICS = [
  "Andamento do processo",
  "Documentos",
  "Prazos",
  "Pagamentos e valores",
  "Outros assuntos",
] as const;

export type TicketTopic = (typeof TICKET_TOPICS)[number];

/** How a ticket shows up in the team's Atendimento: the subject on the first line, the question below. */
export function formatTicketMessage(topic: TicketTopic, text: string) {
  return `Ticket · ${topic}\n${text}`;
}

/** Splits a stored message back into subject and question; null for an ordinary message. */
export function parseTicketMessage(text: string): { topic: string; body: string } | null {
  const match = /^Ticket · ([^\n]+)\n([\s\S]*)$/.exec(text);
  return match ? { topic: match[1], body: match[2] } : null;
}
