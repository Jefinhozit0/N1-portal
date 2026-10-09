export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  gmailUser: process.env.GMAIL_USER ?? "",
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD ?? "",
  /** E-mails of the N1 team, comma separated. Only these accounts open the team area. */
  staffEmails: (process.env.STAFF_EMAILS ?? "").split(/[,;\s]+/).map((email) => email.trim().toLowerCase()).filter(Boolean),
  /** Public URL of the portal, used in the access e-mail sent to new clients. */
  appUrl: process.env.APP_URL ?? "",
  /**
   * How the first-access link goes out by WhatsApp: "web" (unofficial, number paired by QR code),
   * "cloud" (official Meta API) or "off". Unset: "cloud" when a Meta token exists, else "web".
   */
  whatsappProvider: (process.env.WHATSAPP_PROVIDER || (process.env.WHATSAPP_TOKEN ? "cloud" : "web")).toLowerCase(),
  /** WhatsApp Business Platform (Meta Cloud API) for messages from the corporate number. */
  whatsappToken: process.env.WHATSAPP_TOKEN ?? "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappAccessTemplate: process.env.WHATSAPP_ACCESS_TEMPLATE ?? "",
  whatsappTemplateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "pt_BR",
  whatsappApiVersion: process.env.WHATSAPP_API_VERSION ?? "v23.0",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
