// Tests voor de oppervlakte per functie en de huurwaardebenadering bij bedrijfsvastgoed
// (domein/zones.js) en de inpassing ervan in berekenWaardering, de prijsvork en het verslag.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { berekenZones, berekenHuurwaarde, STANDAARD_ZONES, eenheidVan } from "../domein/zones.js";
import { berekenWaardering, rapportWaarderingsBlokken, rapportVenaleWaardeZin } from "../domein/waardering.js";
import { berekenPrijsvork } from "../domein/prijsvork.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { initialData, HUISSTIJLEN } from "../constants.js";

const ZONES = [
  { id: "a", functie: "kantoor", opp: "200", bouwprijs: "1400", markthuur: "110" },
  { id: "b", functie: "magazijn", opp: "800", bouwprijs: "650", markthuur: "55" },
  { id: "c", functie: "buiten", opp: "500", bouwprijs: "60", markthuur: "8" },
  { id: "d", functie: "parking", opp: "10", bouwprijs: "3500", markthuur: "600" },
];

const kmo = (o = {}) => ({
  ...initialData, vastgoedType: "KMO-unit / gemengd", extraPanden: [], parkeerplaatsenGarages: [],
  schijven: [{ opp: "2500", prijs: "100" }], ruimtes: [{ opp: "999", coeff: "1" }], zones: ZONES, ...o,
});

describe("berekenZones", () => {
  it("telt overdekte vloer, buitenopp en parkeerplaatsen apart", () => {
    const z = berekenZones(ZONES);
    expect(z.vloerOpp).toBe(1000);
    expect(z.buitenOpp).toBe(500);
    expect(z.parkeerplaatsen).toBe(10);
    expect(z.nieuwbouwwaarde).toBe(200 * 1400 + 800 * 650 + 500 * 60 + 10 * 3500);
    expect(z.markthuurJaar).toBe(200 * 110 + 800 * 55 + 500 * 8 + 10 * 600);
    expect(eenheidVan("parking")).toBe("st.");
  });

  it("meldt zones zonder bouwprijs of markthuur (parking uitgezonderd voor de huur)", () => {
    const z = berekenZones([{ functie: "kantoor", opp: "100", bouwprijs: "1200" }, { functie: "mezzanine", opp: "50" }, { functie: "parking", opp: "4", bouwprijs: "3000" }]);
    expect(z.zonderBouwprijs).toEqual(["Mezzanine"]);
    expect(z.zonderMarkthuur).toEqual(["Kantoor", "Mezzanine"]);
    expect(z.metMarkthuur).toBe(false);
  });

  it("heeft een voorstel van zones per bedrijfstype", () => {
    expect(STANDAARD_ZONES["Industrie & logistiek"]).toContain("productie");
    expect(STANDAARD_ZONES.Kantoor[0]).toBe("kantoor");
  });
});

describe("berekenHuurwaarde", () => {
  it("kapitaliseert de netto markthuur en trekt de kosten koper af", () => {
    const h = berekenHuurwaarde({ markthuurJaar: 100000, leegstandPct: 5, kostenPct: 2, yieldPct: 7, kostenKoperPct: 12.5 });
    expect(h.nettoHuur).toBeCloseTo(100000 * 0.95 * 0.98, 6);
    expect(h.investeringswaarde).toBeCloseTo(93100 / 0.07, 6);
    expect(h.waarde).toBeCloseTo(93100 / 0.07 / 1.125, 6);
    expect(h.beschikbaar).toBe(true);
  });

  it("waarschuwt bij een ontbrekend of ongebruikelijk rendement en een afwijkende effectieve huur", () => {
    expect(berekenHuurwaarde({ markthuurJaar: 50000 }).beschikbaar).toBe(false);
    expect(berekenHuurwaarde({ markthuurJaar: 50000 }).waarschuwingen[0]).toContain("aanvangsrendement");
    expect(berekenHuurwaarde({ markthuurJaar: 50000, yieldPct: 2, kostenKoperPct: 12.5 }).waarschuwingen.join(" ")).toContain("ongebruikelijk");
    const h = berekenHuurwaarde({ markthuurJaar: 50000, yieldPct: 7, kostenKoperPct: 12.5, effectieveJaarhuur: 60000 });
    expect(h.afwijking).toBeCloseTo(0.2, 6);
    expect(h.waarschuwingen.join(" ")).toContain("20% boven de markthuur");
  });
});

describe("zones in berekenWaardering", () => {
  it("haalt de oppervlakte en de nieuwbouwwaarde uit de zones", () => {
    const c = berekenWaardering(kmo());
    expect(c.metZones).toBe(true);
    expect(c.totOpp).toBe(1000);
    expect(c.gebruiktZonesBouwprijs).toBe(true);
    expect(c.nieuwbouwwaarde).toBe(865000);
  });

  it("zones gaan voor op een prijs per m² en op de oude ruimtetabel", () => {
    const c = berekenWaardering(kmo({ bedrijfsPrijsPerM2: "2000" }));
    expect(c.nieuwbouwwaarde).toBe(865000);
    expect(berekenWaardering(kmo({ zones: [], bedrijfsPrijsPerM2: "2000" })).totOpp).toBe(999);
  });

  it("residentieel negeert eventuele zones", () => {
    const c = berekenWaardering(kmo({ vastgoedType: "Residentieel" }));
    expect(c.metZones).toBe(false);
    expect(c.huurwaardeActief).toBe(false);
  });

  it("de huurwaarde vervangt de directe kapitalisatie in de venale waarde en de prijsvork", () => {
    const d = kmo({ huurMaand: "6000", yieldVan: "6", yieldTot: "6", yieldStap: "0.5", huurwaardeYieldPct: "7", huurwaardeKostenKoperPct: "12.5" });
    const c = berekenWaardering(d);
    const verwacht = 76000 / 0.07 / 1.125;
    expect(c.huurwaardeActief).toBe(true);
    expect(c.huurwaarde.waarde).toBeCloseTo(verwacht, 6);
    expect(c.dcfSamengesteld).toBeCloseTo(verwacht, 6);
    const pv = berekenPrijsvork(d, c);
    expect(pv.methodes.map((m) => m.sleutel)).toContain("huurwaarde");
    expect(pv.methodes.map((m) => m.sleutel)).not.toContain("rendement");
    expect(rapportVenaleWaardeZin(d, c)).toContain("huurwaardebenadering");
  });

  it("zonder aanvangsrendement blijft de directe kapitalisatie gelden", () => {
    const c = berekenWaardering(kmo({ huurMaand: "6000", yieldVan: "6", yieldTot: "6", yieldStap: "0.5" }));
    expect(c.huurwaardeActief).toBe(false);
    expect(c.dcfSamengesteld).toBeCloseTo(c.dcfWaardeNaTransactiekosten, 6);
  });
});

describe("zones en huurwaarde in het verslag", () => {
  const d = kmo({ huurwaardeYieldPct: "7", huurwaardeKostenKoperPct: "12.5", huurwaardeMotivering: "Referentiehuren in de KMO-zone." });

  it("toont de kostenbenadering per functie en het blok Huurwaardebenadering", () => {
    const c = berekenWaardering(d);
    const blokken = rapportWaarderingsBlokken(d, c);
    const tekst = JSON.stringify(blokken);
    expect(tekst).toContain("Huurwaardebenadering");
    expect(tekst).toContain("Netto huurwaarde");
    expect(tekst).toContain("Referentiehuren in de KMO-zone.");
    expect(tekst).toContain("Kantoor");
    expect(tekst).toContain("Magazijn / opslag");
  });

  it("zet de huurwaardebenadering in de PDF", () => {
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain("Huurwaardebenadering");
    expect(html).toContain("Waarde na kosten koper");
  });
});
