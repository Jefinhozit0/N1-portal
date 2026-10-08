const fs = require("node:fs");

for (const file of [".env", ".env.local", ".env.example"]) {
  if (!fs.existsSync(file)) continue;
  const config = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(RESEND_API_KEY|EMAIL_FROM)\s*=\s*(.*?)\s*$/);
    if (match) config[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  const key = config.RESEND_API_KEY || "";
  const from = config.EMAIL_FROM || "";
  const email = from.match(/<([^<>]+)>/)?.[1] || from;
  const domain = email.match(/@([^\s]+)/)?.[1] || "";
  console.log(`${file}: RESEND_API_KEY=${!key ? "missing" : /^re_[A-Za-z0-9_]+$/.test(key) && !/your|placeholder|xxx/i.test(key) ? "format-ok (hidden)" : "placeholder-or-invalid (hidden)"}; EMAIL_FROM=${!from ? "missing" : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? `format-ok; domain=${domain}` : "format-invalid (hidden)"}`);
}
