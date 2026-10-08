import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const verificationTtlMs = 10 * 60 * 1000;
const maximumAttempts = 5;
const pepper = randomBytes(32);

const verificationCodes = new Map<string, {
  digest: Buffer;
  expiresAt: number;
  attempts: number;
}>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function digestCode(email: string, code: string) {
  return createHmac("sha256", pepper).update(`${normalizeEmail(email)}:${code}`).digest();
}

export function createVerificationCode(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  verificationCodes.set(normalizedEmail, {
    digest: digestCode(normalizedEmail, code),
    expiresAt: Date.now() + verificationTtlMs,
    attempts: 0,
  });
  return code;
}

export function discardVerificationCode(email: string) {
  verificationCodes.delete(normalizeEmail(email));
}

export function verifyCode(email: string, code: string) {
  const normalizedEmail = normalizeEmail(email);
  const entry = verificationCodes.get(normalizedEmail);
  if (!entry) return false;

  if (Date.now() >= entry.expiresAt || entry.attempts >= maximumAttempts) {
    verificationCodes.delete(normalizedEmail);
    return false;
  }

  entry.attempts += 1;
  const submittedDigest = digestCode(normalizedEmail, code);
  const isValid = timingSafeEqual(entry.digest, submittedDigest);
  if (isValid || entry.attempts >= maximumAttempts) verificationCodes.delete(normalizedEmail);
  return isValid;
}
