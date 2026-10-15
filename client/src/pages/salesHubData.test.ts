import { describe, expect, it } from "vitest";
import { CARD_FEES, filterSales, netAfterCardFee, heatLevel, heatmap, monthlyEvolution, ranking, shiftMonth, sortSales, totals, type HubSale } from "./salesHubData";

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

describe("sortSales", () => {
  const sales = [
    sale({ id: 1, date: "28/09/2026", client: "Bruno", gross: 500 }),
    sale({ id: 2, date: "03/10/2026", client: "Ana", gross: 2000 }),
    sale({ id: 3, date: "03/10/2026", client: "Carla", gross: 1000 }),
  ];

  it("sorts dates as dates, newest first, with the latest registered on top on the same day", () => {
    expect(sortSales(sales, "date", "desc").map((item) => item.id)).toEqual([3, 2, 1]);
    expect(sortSales(sales, "date", "asc").map((item) => item.id)).toEqual([1, 3, 2]);
  });

  it("sorts by name and by value", () => {
    expect(sortSales(sales, "client", "asc").map((item) => item.client)).toEqual(["Ana", "Bruno", "Carla"]);
    expect(sortSales(sales, "gross", "desc").map((item) => item.gross)).toEqual([2000, 1000, 500]);
  });
});

describe("netAfterCardFee", () => {
  it("matches sales the team already calculated by hand", () => {
    expect(netAfterCardFee(20000, 4)).toBe(18326); // Reginaldo, 4x
    expect(netAfterCardFee(8282.49, 7)).toBe(7074.07); // Cleber, 7x (the team rounded to 7.074)
  });

  it("applies each part's fee when a payment is split", () => {
    expect(netAfterCardFee(7000, 5)).toBe(6341.3);
    expect(netAfterCardFee(230, 1)).toBe(218.8);
  });

  it("has a fee from 1x to 10x and nothing beyond", () => {
    expect(CARD_FEES).toHaveLength(10);
    expect(netAfterCardFee(1000, 10)).toBe(810.6);
    expect(() => netAfterCardFee(1000, 11)).toThrow();
  });
});
