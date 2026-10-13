import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const verificationTtlMs = 10 * 60 * 1000;
const maximumAttempts = 5;
/**
 * A resend no longer kills the previous code: the last few stay valid until they expire, so a
 * code copied from an older e-mail (Gmail stacks them in one thread) still works.
 */
const maximumActiveCodes = 3;
/**
 * A new code resets the attempts above, so on their own they only slow down a guesser who keeps
 * asking for codes. Wrong codes are also counted per e-mail for an hour, and a new code does not
 * reset that count: guessing a 6-digit code becomes a matter of years, not days.
 */
const failureWindowMs = 60 * 60 * 1000;
const maximumFailuresPerWindow = 10;
const pepper = randomBytes(32);

type Entry = { codes: { digest: Buffer; expiresAt: number }[]; attempts: number };
const verificationCodes = new Map<string, Entry>();
const failures = new Map<string, { count: number; since: number }>();

export type CodeCheck = "ok" | "wrong" | "expired" | "locked" | "blocked";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Sign-up and reset codes use keys like "reset:a@x.com"; wrong guesses count for the e-mail itself. */
function failureKey(key: string) {
  return key.slice(key.lastIndexOf(":") + 1);
}

function recentFailures(key: string) {
  const entry = failures.get(failureKey(key));
  if (!entry) return 0;
  if (Date.now() - entry.since >= failureWindowMs) {
    failures.delete(failureKey(key));
    return 0;
  }
  return entry.count;
}

function recordFailure(key: string) {
  const now = Date.now();
  // Keeps the map small: drop windows that are already over.
  if (failures.size > 5_000) failures.forEach((value, email) => { if (now - value.since >= failureWindowMs) failures.delete(email); });
  const email = failureKey(key);
  const entry = failures.get(email);
  if (entry && now - entry.since < failureWindowMs) entry.count += 1;
  else failures.set(email, { count: 1, since: now });
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
  if (recentFailures(normalizedEmail) >= maximumFailuresPerWindow) return "blocked";
  if (entry.attempts >= maximumAttempts) return "locked";

  const submittedDigest = digestCode(normalizedEmail, code);
  if (codes.some((stored) => timingSafeEqual(stored.digest, submittedDigest))) {
    verificationCodes.delete(normalizedEmail);
    failures.delete(failureKey(normalizedEmail));
    return "ok";
  }
  entry.attempts += 1;
  recordFailure(normalizedEmail);
  if (recentFailures(normalizedEmail) >= maximumFailuresPerWindow) return "blocked";
  return entry.attempts >= maximumAttempts ? "locked" : "wrong";
}

export function verifyCode(email: string, code: string) {
  return checkCode(email, code) === "ok";
}

/** What to tell the person when the code didn't work. */
export function codeErrorMessage(result: Exclude<CodeCheck, "ok">) {
  if (result === "wrong") return "Código incorreto. Confira se copiou o código do e-mail mais recente.";
  if (result === "locked") return "Muitas tentativas com código errado. Clique em \"Reenviar código\" para receber um novo.";
  if (result === "blocked") return "Muitas tentativas com código errado. Por segurança, aguarde 1 hora e peça um novo código.";
  return "Este código expirou. Clique em \"Reenviar código\" para receber um novo.";
}
