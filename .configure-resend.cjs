const fs = require("node:fs");
const path = ".env";
if (!fs.existsSync(path)) throw new Error(".env não encontrado na raiz do projeto.");
const original = fs.readFileSync(path, "utf8");
const keyLine = original.match(/^\s*RESEND_API_KEY\s*=\s*(.*?)\s*$/m);
const key = keyLine?.[1].replace(/^['"]|['"]$/g, "") || "";
if (!/^re_[A-Za-z0-9_]+$/.test(key) || /your|placeholder|xxx/i.test(key)) {
  throw new Error("RESEND_API_KEY ausente ou com formato inválido; .env não foi alterado.");
}
const desired = "EMAIL_FROM=onboarding@resend.dev";
const fromLine = /^\s*EMAIL_FROM\s*=.*$/m;
const updated = fromLine.test(original)
  ? original.replace(fromLine, desired)
  : `${original.replace(/\s*$/, "")}\n${desired}\n`;
if (updated !== original) fs.writeFileSync(path, updated);
console.log(updated === original ? "EMAIL_FROM já estava configurado para Resend Onboarding." : "EMAIL_FROM configurado para Resend Onboarding; chave preservada e oculta.");
