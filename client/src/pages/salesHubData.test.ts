import { describe, expect, it } from "vitest";
import { filterSales, heatLevel, heatmap, monthlyEvolution, ranking, shiftMonth, totals, type HubSale } from "./salesHubData";

const sale = (overrides: Partial<HubSale>): HubSale => ({
  id: 1, date: "15/09/2026", client: "Cliente", phone: "", consultants: [], product: "Revisão", status: "OK",
  cbk: false, gross: 1000, net: 900, note: "", setor: "comercial", createdAt: null, ...overrides,
});

describe("Sales HUB numbers", () => {
  const sales = [
    sale({ id: 1, consultants: ["Ana"], gross: 1000, net: 900 }),
    sale({ id: 2, consultants: ["Ana", "Beto"], gross: 3000, net: 2500, setor: "juridico" }),
    sale({ id: 3, date: "02/10/2026", consultants: ["Beto"], gross: 500, net: 500, cbk: true }),
  ];

  it("filters by month, sector, consultant and text", () => {
    expect(filterSales(sales, { month: "2026-09", sector: "todos", consultant: "Todos", query: "" }).map((s) => s.id)).toEqual([1, 2]);
    expect(filterSales(sales, { month: "2026-09", sector: "juridico", consultant: "Todos", query: "" }).map((s) => s.id)).toEqual([2]);
    expect(filterSales(sales, { month: "", sector: "todos", consultant: "Beto", query: "" }).map((s) => s.id)).toEqual([2, 3]);
    expect(filterSales(sales, { month: "", sector: "todos", consultant: "Todos", query: "nada" })).toEqual([]);
  });

  it("adds up totals, with the chargeback loss as the net of CBK sales", () => {
    const result = totals(sales);
    expect(result).toMatchObject({ count: 3, gross: 4500, net: 3900, cbkCount: 1, cbkNet: 500, resultado: 3400 });
    expect(result.netShare).toBeCloseTo(3900 / 4500);
    expect(totals([]).netShare).toBeNull();
  });

  it("ranks consultants by net, counting a shared sale for each of them", () => {
    expect(ranking(sales)).toEqual([
      { name: "Ana", count: 2, gross: 4000, net: 3400 },
      { name: "Beto", count: 2, gross: 3500, net: 3000 },
    ]);
  });

  it("builds 12 months ending on the chosen one, crossing the year and keeping empty months at zero", () => {
    const points = monthlyEvolution(sales, "2026-10");
    expect(points).toHaveLength(12);
    expect(points[0].month).toBe("2025-11");
    expect(points[11]).toMatchObject({ month: "2026-10", gross: 500, count: 1 });
    expect(points[10]).toMatchObject({ month: "2026-09", gross: 4000, net: 3400, count: 2 });
    expect(points[5].gross).toBe(0);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("places sales on the heatmap in Brazil's time", () => {
    // 2026-10-05 is a Monday; 01:30 UTC is still Sunday 22:30 in São Paulo (night).
    const result = heatmap([sale({ createdAt: "2026-10-05T01:30:00Z" }), sale({ createdAt: "2026-10-05T13:00:00Z" })]);
    expect(result.grid[0][3]).toBe(1); // Sunday, night
    expect(result.grid[1][1]).toBe(1); // Monday, morning (10:00 in Brazil)
    expect(result.peak?.count).toBe(1);
    expect(heatLevel(0, 4)).toBe(0);
    expect(heatLevel(1, 4)).toBe(1);
    expect(heatLevel(4, 4)).toBe(4);
  });
});
