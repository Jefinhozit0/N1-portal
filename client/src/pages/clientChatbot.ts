import type { TicketTopic } from "@shared/tickets";

/**
 * Scripted assistant shown in the client's chat. No AI: every answer below is fixed text,
 * filled in with the client's own process data where it says so.
 * To change what the assistant says, edit the `reply` texts and `options` of each step.
 */

export type ProcessInfo = { firstName: string; type: string; status: string; updated: string };

export type BotStepId = "menu" | "andamento" | "documentos" | "prazos" | "pagamentos" | "atendente";

type BotStep = {
  /** Text on the quick-reply button that leads to this step. */
  label: string;
  reply: (process: ProcessInfo, topic: TicketTopic) => string;
  /** Buttons offered after the reply. */
  options: BotStepId[];
  /** Subject the ticket gets if the client asks for an attendant from here. */
  topic?: TicketTopic;
  /** After this reply, the next message the client types becomes a ticket for the team. */
  opensTicket?: boolean;
};

const MAIN_OPTIONS: BotStepId[] = ["andamento", "documentos", "prazos", "pagamentos", "atendente"];

export const BOT_STEPS: Record<BotStepId, BotStep> = {
  menu: {
    label: "Voltar ao menu",
    reply: () => "Como posso ajudar?",
    options: MAIN_OPTIONS,
  },
  andamento: {
    label: "Como está meu processo?",
    reply: (p) => `Seu processo de ${p.type} está com a situação "${p.status}". Última atualização: ${p.updated}.\n\nSempre que houver novidade, ela aparece aqui no portal.`,
    options: ["atendente", "menu"],
    topic: "Andamento do processo",
  },
  documentos: {
    label: "Quais documentos preciso enviar?",
    reply: () => "Os documentos variam conforme o processo. Normalmente pedimos documento com foto (RG ou CNH), comprovante de residência e o contrato com o banco.\n\nSe estiver faltando algo no seu caso, a equipe avisa por esta conversa.",
    options: ["atendente", "menu"],
    topic: "Documentos",
  },
  prazos: {
    label: "Quanto tempo demora?",
    reply: () => "O prazo depende da análise de cada caso e do retorno do banco, por isso não conseguimos garantir uma data exata.\n\nA situação do seu processo é atualizada aqui a cada etapa.",
    options: ["atendente", "menu"],
    topic: "Prazos",
  },
  pagamentos: {
    label: "Pagamentos e valores",
    reply: () => "Dúvidas sobre valores, pagamentos ou contrato são tratadas direto com a equipe.\n\nEscreva sua pergunta no campo abaixo e um atendente responde por aqui.",
    options: ["menu"],
    topic: "Pagamentos e valores",
    opensTicket: true,
  },
  atendente: {
    label: "Falar com um atendente",
    reply: (_p, topic) => `Certo! Escreva sua dúvida no campo abaixo e envie. Ela vai para a equipe da N1 com o assunto "${topic}", e a resposta aparece aqui nesta conversa.`,
    options: ["menu"],
    opensTicket: true,
  },
};

export function greeting(process: ProcessInfo) {
  return `Olá, ${process.firstName}! Sou o assistente virtual da N1 Soluções. Escolha uma opção abaixo ou escreva sua dúvida.`;
}

export const TICKET_SENT_REPLY = "Pronto, sua mensagem foi enviada para a equipe. A resposta aparece aqui nesta conversa, normalmente em horário comercial.";
