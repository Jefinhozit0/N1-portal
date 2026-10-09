import { afterEach, describe, expect, it, vi } from "vitest";
import { checkCode, createVerificationCode, discardVerificationCode, verifyCode } from "./verificationCodes";

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

describe("verification codes after a resend", () => {
  it("keeps the previous code valid, and either one burns both", () => {
    const first = createVerificationCode("resend@example.com");
    const second = createVerificationCode("resend@example.com");

    expect(checkCode("resend@example.com", first)).toBe("ok");
    expect(checkCode("resend@example.com", second)).toBe("expired");
  });

  it("tells a wrong code apart from an expired one", () => {
    const code = createVerificationCode("reason@example.com");
    expect(checkCode("reason@example.com", code === "123456" ? "654321" : "123456")).toBe("wrong");
    expect(checkCode("nobody@example.com", "123456")).toBe("expired");
  });

  it("drops only the code whose e-mail failed", () => {
    const kept = createVerificationCode("partial@example.com");
    const failed = createVerificationCode("partial@example.com");
    discardVerificationCode("partial@example.com", failed);

    expect(checkCode("partial@example.com", kept)).toBe("ok");
  });
});
