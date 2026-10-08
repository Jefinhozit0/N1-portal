import { toast } from "sonner";

type ChannelResult = { sent: true } | { sent: false; reason: string };

/** Tells the team, per channel, whether the client's first-access link went out. */
export function showAccessResult(result: { email: ChannelResult; whatsapp: ChannelResult }, intro: string) {
  const sent = [result.email.sent && "e-mail", result.whatsapp.sent && "WhatsApp"].filter(Boolean).join(" e ");
  const failures = [
    !result.email.sent && `E-mail: ${result.email.reason}`,
    !result.whatsapp.sent && `WhatsApp: ${result.whatsapp.reason}`,
  ].filter(Boolean) as string[];

  if (sent) toast.success(`${intro} Link de acesso enviado por ${sent}.`);
  if (failures.length) toast.warning(sent ? `Não enviado — ${failures.join(" ")}` : `${intro} O link de acesso não foi enviado. ${failures.join(" ")}`, { duration: 10_000 });
}
