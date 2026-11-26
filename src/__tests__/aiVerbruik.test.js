import { describe, it, expect } from "vitest";
import { vatVerbruikSamen, weekVan } from "../domein/aiVerbruik.js";

const rij = (email, functie, kosten, datum, zoek = 0) => ({
  gebruiker_id: email, email, functie, model: "claude-sonnet-4-6",
  invoer_tokens: 1000, uitvoer_tokens: 100, webzoekopdrachten: zoek, kosten_usd: kosten, aangemaakt_op: datum,
});

describe("vatVerbruikSamen", () => {
  it("telt op per account, week en functie en sorteert op kosten", () => {
    const s = vatVerbruikSamen([
      rij("a@x.be", "ligging", 0.5, "2026-11-24T10:00:00Z", 5),
      rij("a@x.be", "swot", 0.1, "2026-11-25T10:00:00Z"),
      rij("b@x.be", "ligging", 0.4, "2026-11-17T10:00:00Z", 4),
    ]);
    expect(s.totaal.aanroepen).toBe(3);
    expect(s.totaal.webzoekopdrachten).toBe(9);
    expect(s.totaal.kostenUsd).toBeCloseTo(1.0);
    expect(s.perAccount.map((a) => a.email)).toEqual(["a@x.be", "b@x.be"]);
    expect(s.perAccount[0].aandeel).toBeCloseTo(0.6);
    expect(s.perAccount[0].laatste).toBe("2026-11-25T10:00:00Z");
    expect(s.perWeek.map((w) => w.week)).toEqual(["2026-11-23", "2026-11-16"]);
    expect(s.perFunctie[0].functie).toBe("ligging");
    expect(s.perFunctie[0].kostenUsd).toBeCloseTo(0.9);
  });

  it("geeft lege totalen zonder rijen", () => {
    const s = vatVerbruikSamen([]);
    expect(s.totaal.aanroepen).toBe(0);
    expect(s.perAccount).toEqual([]);
  });
});

describe("weekVan", () => {
  it("geeft de maandag van de week", () => {
    expect(weekVan("2026-11-26T12:00:00")).toBe("2026-11-23");
    expect(weekVan("2026-11-23T12:00:00")).toBe("2026-11-23");
    expect(weekVan("2026-11-29T12:00:00")).toBe("2026-11-23");
  });
});
