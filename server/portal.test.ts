import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("portal authentication contract", () => {
  it("exposes unauthenticated state for the login shell", async () => {
    const ctx = {
      user: undefined,
      req: {} as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    } satisfies TrpcContext;

    const result = await appRouter.createCaller(ctx).auth.me();
    expect(result).toBeUndefined();
  });

  it("keeps logout idempotent for the dashboard shell", async () => {
    const clearedCookies: string[] = [];
    const ctx = {
      user: undefined,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string) => clearedCookies.push(name),
      } as TrpcContext["res"],
    } satisfies TrpcContext;

    const result = await appRouter.createCaller(ctx).auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
  });
});
