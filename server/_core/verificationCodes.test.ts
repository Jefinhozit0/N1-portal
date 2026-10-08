import { afterEach, describe, expect, it, vi } from "vitest";
import { createVerificationCode, verifyCode } from "./verificationCodes";

afterEach(() => {
  vi.useRealTimers();
});

describe("verification codes", () => {
  it("accepts a valid code only once and normalizes email case", () => {
    const code = createVerificationCode(" Person@Example.com ");

    expect(verifyCode("person@example.com", code)).toBe(true);
    expect(verifyCode("person@example.com", code)).toBe(false);
  });

  it("expires after ten minutes", () => {
    vi.useFakeTimers();
    const code = createVerificationCode("expiry@example.com");

    vi.advanceTimersByTime(10 * 60 * 1000);

    expect(verifyCode("expiry@example.com", code)).toBe(false);
  });

  it("locks a code after five incorrect attempts", () => {
    const code = createVerificationCode("attempts@example.com");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(verifyCode("attempts@example.com", "000000" === code ? "000001" : "000000")).toBe(false);
    }

    expect(verifyCode("attempts@example.com", code)).toBe(false);
  });
});
