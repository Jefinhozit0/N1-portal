import { describe, expect, it } from "vitest";
import { matchesClientSearch } from "./clientSearch";

const ana = { name: "Ana Paula", type: "Financiamento Veicular", email: "ana@gmail.com", phone: "(11) 98868-5326" };
const old = { name: "Adiel Borges", type: "Financiamento Imobiliário", email: "adiel@gmail.com", phone: "(67) 9346-4018" };

describe("matchesClientSearch", () => {
  it.each(["11988685326", "98868-5326", "988685326", "(11) 98868 5326", "+55 11 9 8868-5326", "011 98868-5326", "5326"])(
    "finds the client by phone typed as %s",
    (query) => expect(matchesClientSearch(ana, query)).toBe(true),
  );

  it("finds an old mobile number saved without the 9", () => {
    expect(matchesClientSearch(old, "67993464018")).toBe(true);
    expect(matchesClientSearch(old, "6793464018")).toBe(true);
  });

  it("does not match other phones or too few digits", () => {
    expect(matchesClientSearch(ana, "11999990000")).toBe(false);
    expect(matchesClientSearch(ana, "12")).toBe(false);
  });

  it("still finds by name, process type and e-mail", () => {
    expect(matchesClientSearch(ana, "paula")).toBe(true);
    expect(matchesClientSearch(ana, "veicular")).toBe(true);
    expect(matchesClientSearch(ana, "ana@gmail")).toBe(true);
    expect(matchesClientSearch(ana, "imobiliário")).toBe(false);
  });

  it("shows everyone when the search is empty", () => {
    expect(matchesClientSearch(ana, "  ")).toBe(true);
  });
});
