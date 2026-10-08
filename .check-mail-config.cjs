const fs = require("node:fs");
for (const file of [".env", ".env.example"]) {
  if (!fs.existsSync(file)) { console.log(`${file}: ausente`); continue; }
  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(GMAIL_USER|GMAIL_APP_PASSWORD|RESEND_API_KEY|EMAIL_FROM)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  const configured = (key) => Boolean(values[key]) && !/your-|placeholder|xxx/i.test(values[key]);
  console.log(`${file}: GMAIL_USER=${configured("GMAIL_USER") ? "set" : "missing/placeholder"}; GMAIL_APP_PASSWORD=${configured("GMAIL_APP_PASSWORD") ? "set (hidden)" : "missing/placeholder"}; RESEND_API_KEY=${configured("RESEND_API_KEY") ? "set (hidden)" : "missing/placeholder"}; EMAIL_FROM=${values.EMAIL_FROM ? "set (hidden)" : "missing"}`);
}
