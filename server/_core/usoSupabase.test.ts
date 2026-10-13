import { describe, expect, it } from "vitest";
import { gauge, monthsUntilLimit } from "./usoSupabase";

const MB = 1024 * 1024;

describe("Supabase usage", () => {
  it("projects the months left at the pace of the last 30 days", () => {
    expect(monthsUntilLimit(100 * MB, 1024 * MB, 50 * MB)).toBeCloseTo(18.48, 1);
    expect(monthsUntilLimit(100 * MB, 1024 * MB, 0)).toBeNull();
    expect(monthsUntilLimit(1100 * MB, 1024 * MB, 10 * MB)).toBe(0);
  });

  it("warns from 80% of a limit on", () => {
    expect(gauge(79, 100, 0)).toMatchObject({ percent: 0.79, alerta: false });
    expect(gauge(80, 100, 1)).toMatchObject({ percent: 0.8, alerta: true, mesesAteOLimite: 20 });
  });
});
