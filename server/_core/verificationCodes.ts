import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const verificationTtlMs = 10 * 60 * 1000;
const maximumAttempts = 5;
/**
 * A resend no longer kills the previous code: the last few stay valid until they expire, so a
 * code copied from an older e-mail (Gmail stacks them in one thread) still works.
 */
const maximumActiveCodes = 3;
const pepper = randomBytes(32);

type Entry = { codes: { digest: Buffer; expiresAt: number }[]; attempts: number };
const verificationCodes = new Map<string, Entry>();

export type CodeCheck = "ok" | "wrong" | "expired" | "locked";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function digestCode(email: string, code: string) {
  return createHmac("sha256", pepper).update(`${normalizeEmail(email)}:${code}`).digest();
}

function liveCodes(entry: Entry | undefined) {
  const now = Date.now();
  return (entry?.codes ?? []).filter((code) => code.expiresAt > now);
}

export function createVerificationCode(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const previous = verificationCodes.get(normalizedEmail);
  verificationCodes.set(normalizedEmail, {
    codes: [...liveCodes(previous), { digest: digestCode(normalizedEmail, code), expiresAt: Date.now() + verificationTtlMs }].slice(-maximumActiveCodes),
    attempts: 0,
  });
  return code;
}

/** Drops one code, for when its e-mail could not be sent. */
export function discardVerificationCode(email: string, code: string) {
  const normalizedEmail = normalizeEmail(email);
  const entry = verificationCodes.get(normalizedEmail);
  if (!entry) return;
  const digest = digestCode(normalizedEmail, code);
  entry.codes = entry.codes.filter((stored) => !timingSafeEqual(stored.digest, digest));
  if (entry.codes.length === 0) verificationCodes.delete(normalizedEmail);
}

/** Checks a code and says why it failed. A code works only once; using it burns all codes of that e-mail. */
export function checkCode(email: string, code: string): CodeCheck {
  const normalizedEmail = normalizeEmail(email);
  const entry = verificationCodes.get(normalizedEmail);
  const codes = liveCodes(entry);
  if (!entry || codes.length === 0) {
    verificationCodes.delete(normalizedEmail);
    return "expired";
  }
  if (entry.attempts >= maximumAttempts) return "locked";

  const submittedDigest = digestCode(normalizedEmail, code);
  if (codes.some((stored) => timingSafeEqual(stored.digest, submittedDigest))) {
    verificationCodes.delete(normalizedEmail);
    return "ok";
  }
  entry.attempts += 1;
  return entry.attempts >= maximumAttempts ? "locked" : "wrong";
}

export function verifyCode(email: string, code: string) {
  return checkCode(email, code) === "ok";
}

/** What to tell the person when the code didn't work. */
export function codeErrorMessage(result: Exclude<CodeCheck, "ok">) {
  if (result === "wrong") return "Código incorreto. Confira se copiou o código do e-mail mais recente.";
  if (result === "locked") return "Muitas tentativas com código errado. Clique em \"Reenviar código\" para receber um novo.";
  return "Este código expirou. Clique em \"Reenviar código\" para receber um novo.";
}
