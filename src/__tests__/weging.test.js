// Tests voor de rekenregels versie 2 (domein/weging.js en berekenWaardering): kapitalisatie aan het
// gemiddelde rendement, kosten koper als deling, gewogen methodes (huur bij woningen standaard
// enkel controle), afronding, gevoeligheidstabel — en dossiers in versie 1 die ongewijzigd rekenen.
// De cijfers komen uit de nalezing van een echt verslag: € 2.200/maand, 10 maanden, 2,5–3,5%,
// 14% kosten.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { wegMethodes, afrondingsStap, afronden, kapitaliseer, gevoeligheidstabel } from "../domein/weging.js";
import { berekenWaardering, rapportWaarderingsBlokken, rapportVenaleWaardeZin } from "../domein/waardering.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { initialData, HUISSTIJLEN } from "../constants.js";

const villa = (o = {}) => ({
  ...initialData, extraPanden: [], parkeerplaatsenGarages: [],
  ruimtes: [{ verdieping: "gelijkvloers", opp: "180", coeff: "1" }, { verdieping: "eerste", opp: "97", coeff: "1" }],
  schijven: [{ opp: "1321", prijs: "225" }], grondopp: "1321",
  huurMaand: "2200", yieldVan: "2.5", yieldTot: "3.5", yieldStap: "0.5", dcfTransactiekostenActief: true, dcfTransactiekostenPct: "14",
  ...o,
});

describe("kapitalisatie", () => {
  it("deelt door (1 + kosten koper) en kapitaliseert aan het gemiddelde rendement", () => {
    expect(kapitaliseer(22000, 3, 14)).toBeCloseTo(22000 / 0.03 / 1.14, 6);
    const c = berekenWaardering(villa());
    expect(c.rekenversie).toBe(2);
    expect(c.gemiddeldRendement).toBeCloseTo(3, 9);
    expect(c.dcfWaarde).toBeCloseTo(733333.33, 1);
    expect(c.dcfWaardeNaTransactiekosten).toBeCloseTo(643274.85, 1);
  });

  it("laat een dossier in versie 1 exact zoals vroeger rekenen", () => {
    const c = berekenWaardering(villa({ rekenversie: 1 }));
    expect(c.rekenversie).toBe(1);
    expect(c.dcfWaarde).toBeCloseTo((880000 + 733333.333 + 628571.429) / 3, 0); // 747.302
    expect(c.dcfWaardeNaTransactiekosten).toBeCloseTo(c.dcfWaarde * 0.86, 6); // 642.679
    expect(c.voorgesteldeVenaleWaarde).toBeCloseTo((c.intrinsiek + c.dcfSamengesteld) / 2, 6);
    expect(c.afrondingStap).toBe(0);
    // een dossier zonder veld rekenversie is ook versie 1
    expect(berekenWaardering({ ...villa(), rekenversie: undefined }).rekenversie).toBe(1);
  });
});

describe("weging van de methodes", () => {
  it("laat de huurbenadering bij een woning standaard enkel als controle meetellen", () => {
    const c = berekenWaardering(villa());
    const rendement = c.weging.methodes.find((m) => m.sleutel === "rendement");
    expect(rendement.controle).toBe(true);
    expect(c.voorgesteldeVenaleWaarde).toBe(afronden(c.intrinsiek, c.afrondingStap));
    expect(c.prijsvork.methodes.find((m) => m.sleutel === "rendement").controle).toBe(true);
    // de controle bepaalt de vork niet
    const zonderHuur = berekenWaardering(villa({ huurMaand: "" }));
    expect(c.prijsvork.minimum).toBe(zonderHuur.prijsvork.minimum);
    expect(c.prijsvork.maximum).toBe(zonderHuur.prijsvork.maximum);
  });

  it("weegt volgens de ingestelde percentages", () => {
    const c = berekenWaardering(villa({ wegingKostenPct: "50", wegingRendementPct: "50", afrondingVenale: "Geen" }));
    expect(c.voorgesteldeVenaleWaarde).toBeCloseTo((c.intrinsiek + c.dcfWaardeNaTransactiekosten) / 2, 6);
    const c2 = berekenWaardering(villa({ wegingKostenPct: "75", wegingRendementPct: "25", afrondingVenale: "Geen" }));
    expect(c2.voorgesteldeVenaleWaarde).toBeCloseTo(0.75 * c2.intrinsiek + 0.25 * c2.dcfWaardeNaTransactiekosten, 6);
  });

  it("laat bij bedrijfsvastgoed de rendementsbenadering standaard meewegen", () => {
    const w = wegMethodes({}, { kosten: 400000, rendement: 600000 }, "bedrijf");
    expect(w.gewogen).toBe(500000);
    expect(w.methodes.every((m) => !m.controle)).toBe(true);
  });

  it("valt terug op de kostenbenadering als niets meeweegt", () => {
    const w = wegMethodes({ wegingKostenPct: "0" }, { kosten: 400000, rendement: 600000 }, "residentieel");
    expect(w.gewogen).toBe(400000);
    expect(w.methodes.find((m) => m.sleutel === "kosten").terugval).toBe(true);
  });
});

describe("afronding", () => {
  it("rondt automatisch af naar de grootte van het bedrag, of zoals gekozen", () => {
    expect(afrondingsStap(37203, "Automatisch")).toBe(1000);
    expect(afrondingsStap(628268, "Automatisch")).toBe(5000);
    expect(afrondingsStap(1250000, "Automatisch")).toBe(10000);
    expect(afrondingsStap(628268, "10000")).toBe(10000);
    expect(afrondingsStap(628268, "Geen")).toBe(0);
    expect(afronden(628268, 5000)).toBe(630000);
    expect(afronden(628268, 0)).toBe(628268);
  });

  it("geeft een afgeronde venale waarde en gedwongen verkoopwaarde", () => {
    const c = berekenWaardering(villa());
    expect(c.venaleWaarde % 5000).toBe(0);
    expect(c.gedwongenVerkoop % 1000).toBe(0);
  });
});

describe("gevoeligheid en verslag", () => {
  it("toont hoe sterk de rendementswaarde van huur en rendement afhangt", () => {
    const g = gevoeligheidstabel({ huurMaand: 2200, maandenPerJaar: 10, rendementen: [3, 3.5], kostenPct: 14 });
    expect(g.rendementen).toEqual([3, 3.5]);
    expect(g.rijen.map((r) => r.huurMaand)).toEqual([1760, 1980, 2200, 2420]);
    const basis = g.rijen.find((r) => r.basis);
    expect(Math.round(basis.waarden[0])).toBe(643275);
    expect(Math.round(basis.waarden[1])).toBe(551378);
  });

  it("schrijft de rendementsbenadering narekenbaar uit, met de gevoeligheid en als controle", () => {
    const d = villa();
    const c = berekenWaardering(d);
    const blokken = rapportWaarderingsBlokken(d, c);
    const rb = blokken.find((b) => b.titel === "Rendementsbenadering (directe kapitalisatie)");
    expect(rb.rijen.map((r) => r[0])).toEqual([
      "Marktconforme maandhuur", "Jaarhuur (10 maanden)", "Kapitalisatievoet",
      "Investeringswaarde (jaarhuur ÷ kapitalisatievoet)", "Kosten koper (÷ 1,14)", "Rendementswaarde",
    ]);
    expect(rb.rijen.find((r) => r[0] === "Kapitalisatievoet")[1]).toBe("3% (gemiddelde van 2,5% – 3,5%)");
    expect(rb.tabel.koppen).toEqual(["Maandhuur", "2,5%", "3%", "3,5%"]);
    expect(rb.motivering).toContain("enkel ter controle");
    expect(blokken.some((b) => /DCF/.test(b.titel))).toBe(false);
    const samen = blokken.find((b) => b.titel === "Samenstelling venale waarde");
    expect(samen.rijen[1][0]).toContain("ter controle, weegt niet mee");
    expect(rapportVenaleWaardeZin(d, c)).toMatch(/steunt op de analytische methode \(kostenbenadering\), afgerond op €\s5\.000\./);
    const html = buildPrintHtml(d, c, HUISSTIJLEN.houpels);
    expect(html).toContain("Gevoeligheid van de rendementswaarde");
    expect(html).not.toContain("DCF-waarde");
    expect(c.prijsvork.motivering).toContain("Ter controle werd ook de rendementsbenadering berekend");
    expect(c.prijsvork.motivering).not.toContain("gecombineerd met");
  });

  it("vraagt een toelichting bij een asymmetrische marge en neemt die op in de prijsvork", () => {
    const c = berekenWaardering(villa({ marktMargeOnderPct: "5", marktMargeBovenPct: "2.5", marktMargeMotivering: "beperkt opwaarts potentieel door het platte dak" }));
    expect(c.prijsvork.motivering).toContain("−5% tot +2,5% (beperkt opwaarts potentieel door het platte dak)");
  });
});
