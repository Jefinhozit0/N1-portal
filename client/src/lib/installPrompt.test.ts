import { describe, expect, it, vi } from "vitest";

// The module listens on window when it loads; the tests run in Node, so give it a minimal one.
vi.stubGlobal("window", { addEventListener: () => undefined });
vi.stubGlobal("navigator", { userAgent: "", maxTouchPoints: 0 });
const { isIosSafari } = await import("./installPrompt");

describe("isIosSafari", () => {
  it("is true only for Safari on iPhone/iPad, where the app is added from the Share menu", () => {
    expect(isIosSafari("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe(true);
    expect(isIosSafari("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(isIosSafari("Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36")).toBe(false);
  });
});
