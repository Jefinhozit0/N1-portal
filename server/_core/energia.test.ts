import { describe, expect, it } from "vitest";
import { parsePowerFile } from "./energia";

const NOW = Date.parse("2026-10-13T18:00:00Z");

describe("parsePowerFile", () => {
  it("reads what the watchdog writes, including the BOM PowerShell adds", () => {
    const content = `﻿{"naTomada":false,"bateria":38,"minutosRestantes":42,"em":"2026-10-13T17:59:50.000Z"}`;
    expect(parsePowerFile(content, NOW)).toEqual({ naTomada: false, bateria: 38, minutosRestantes: 42 });
  });

  it("ignores an old file, so a stopped watchdog does not leave a warning on screen", () => {
    expect(parsePowerFile(`{"naTomada":false,"bateria":38,"em":"2026-10-13T17:50:00.000Z"}`, NOW)).toBeNull();
  });

  it("ignores broken content", () => {
    expect(parsePowerFile("not json", NOW)).toBeNull();
    expect(parsePowerFile(`{"bateria":38,"em":"2026-10-13T17:59:50.000Z"}`, NOW)).toBeNull();
  });
});

describe("isUnderMaintenance", () => {
  it("can be turned on by hand with MANUTENCAO=on", async () => {
    const { isUnderMaintenance } = await import("./energia");
    expect(await isUnderMaintenance()).toBe(false);
    process.env.MANUTENCAO = "on";
    try {
      expect(await isUnderMaintenance()).toBe(true);
    } finally {
      delete process.env.MANUTENCAO;
    }
  });
});
