// Tests voor de prijsvork rond de venale waarde (domein/prijsvork.js) en de inpassing ervan in de
// berekening en het verslag (domein/waardering.js). Verzonnen bedragen.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { berekenPrijsvork, berekenTotaalPrijsvork } from "../domein/prijsvork.js";
import { berekenWaardering, rapportWaarderingsBlokken, rapportVenaleWaardeZin } from "../domein/waardering.js";
import { initialData } from "../constants.js";

// een minimale "calc" zoals berekenWaardering die oplevert
const calc = (o = {}) => ({
  intrinsiek: 400000, energiecorrectieBedrag: 0, marktMargeOnderPct: 5, marktMargeBovenPct: 5, isGarageStaanplaats: false,
  dcfWaarde: 0, yieldRows: [], dcfTransactiekostenPct: 0, dcfWaardeNaTransactiekosten: 0, dcfMeerjarenWaarde: 0,
  venaleWaardePand: 400000, venaleWaarde: 400000, parkeerTotaal: 0, ...o,
});
const rijen = (jaarhuur, yields) => yields.map((y) => ({ yield: y, waarde: jaarhuur / (y / 100) }));

describe("berekenPrijsvork", () => {
  it("volgt bij enkel de analytische methode de marktmarge rond de intrinsieke waarde", () => {
    const pv = berekenPrijsvork({}, calc());
    expect(pv.minimum).toBe(380000);
    expect(pv.maximum).toBe(420000);
    expect(pv.verruimdOmMethodes).toBe(false);
    expect(pv.motivering).toContain("marktmarge −5% / +5%");
  });

  it("rondt naar buiten af op € 1.000", () => {
    const pv = berekenPrijsvork({}, calc({ intrinsiek: 401234, venaleWaardePand: 401234, venaleWaarde: 401234 }));
    expect(pv.minimum).toBe(381000); // 381.172 naar beneden
    expect(pv.maximum).toBe(422000); // 421.296 naar boven
  });

  it("combineert de analytische bandbreedte met enkel de UITKOMST van de rendementsmethode (gemiddelde)", () => {
    const yr = rijen(20000, [4.8, 5, 5.2]); // 416.667 – 400.000 – 384.615
    const dcf = yr.reduce((s, r) => s + r.waarde, 0) / yr.length;
    const pv = berekenPrijsvork({}, calc({ dcfWaarde: dcf, yieldRows: yr, dcfWaardeNaTransactiekosten: dcf, venaleWaardePand: (400000 + dcf) / 2, venaleWaarde: (400000 + dcf) / 2 }));
    expect(pv.gecombineerdOnder).toBeCloseTo((380000 + dcf) / 2, 6);
    expect(pv.gecombineerdBoven).toBeCloseTo((420000 + dcf) / 2, 6);
    expect(pv.verruimdOmMethodes).toBe(false);
    const r = pv.methodes.find((m) => m.sleutel === "rendement");
    expect(r.onder).toBe(dcf);
    expect(r.boven).toBe(dcf);
    expect(r.toelichting).toBe("uitkomst, gemiddelde over yield 4,8% – 5,2%");
  });

  it("gebruikt de waarden bij de hoogste/laagste yield NIET als grenzen (anders werd de vork te breed)", () => {
    const yr = rijen(20000, [4, 5, 6]); // 500.000 – 400.000 – 333.333
    const dcf = yr.reduce((s, r) => s + r.waarde, 0) / yr.length; // 411.111
    const pv = berekenPrijsvork({}, calc({ dcfWaarde: dcf, yieldRows: yr, dcfWaardeNaTransactiekosten: dcf, venaleWaardePand: (400000 + dcf) / 2, venaleWaarde: (400000 + dcf) / 2 }));
    expect(pv.minimum).toBe(395000); // (380.000 + 411.111) / 2 = 395.556, naar beneden
    expect(pv.maximum).toBe(416000); // (420.000 + 411.111) / 2 = 415.556, naar boven
    expect(pv.minimum).toBeGreaterThan(333334);
    expect(pv.maximum).toBeLessThan(500000);
  });

  it("verruimt de vork tot alle methode-uitkomsten wanneer de methodes sterk uiteenlopen, en vraagt een motivering", () => {
    const yr = rijen(15000, [5]); // 300.000
    const pv = berekenPrijsvork({}, calc({ dcfWaarde: 300000, yieldRows: yr, dcfWaardeNaTransactiekosten: 300000, venaleWaardePand: 350000, venaleWaarde: 350000 }));
    expect(pv.gecombineerdOnder).toBeCloseTo(340000, 6);
    expect(pv.gecombineerdBoven).toBeCloseTo(360000, 6);
    expect(pv.minimum).toBe(300000);
    expect(pv.maximum).toBe(400000);
    expect(pv.verruimdOmMethodes).toBe(true);
    expect(pv.waarschuwingen.some((w) => w.includes("waarderingsmethodes onderling sterk verschillen"))).toBe(true);
  });

  it("neemt de meerjaren-DCF mee als methode-uitkomst", () => {
    const pv = berekenPrijsvork({}, calc({ dcfMeerjarenWaarde: 450000, venaleWaardePand: 425000, venaleWaarde: 425000 }));
    expect(pv.methodes.map((m) => m.sleutel)).toEqual(["analytisch", "meerjarenDcf"]);
    expect(pv.maximum).toBe(450000);
  });

  it("neemt de uitkomst na transactiekosten", () => {
    const yr = rijen(20000, [5]);
    const pv = berekenPrijsvork({}, calc({ dcfWaarde: 400000, yieldRows: yr, dcfTransactiekostenPct: 10, dcfWaardeNaTransactiekosten: 360000, venaleWaardePand: 380000, venaleWaarde: 380000 }));
    const r = pv.methodes.find((m) => m.sleutel === "rendement");
    expect(r.onder).toBeCloseTo(360000, 6);
    expect(r.boven).toBeCloseTo(360000, 6);
    expect(r.toelichting).toBe("uitkomst, yield 5%, na 10% transactiekosten");
  });

  it("omvat altijd een manueel ingevulde venale waarde, met een waarschuwing als die buiten de methodes valt", () => {
    const pv = berekenPrijsvork({}, calc({ venaleWaardePand: 450000, venaleWaarde: 450000 }));
    expect(pv.maximum).toBe(450000);
    expect(pv.verruimdOmVenale).toBe(true);
    expect(pv.waarschuwingen[0]).toContain("buiten de uitkomsten van de methodes");
  });

  it("telt parkeerplaatsen/garages als vast bedrag mee aan beide kanten", () => {
    const pv = berekenPrijsvork({}, calc({ parkeerTotaal: 20000, venaleWaarde: 420000 }));
    expect(pv.minimum).toBe(400000);
    expect(pv.maximum).toBe(440000);
  });

  it("laat de schatter de vork manueel overschrijven, elk uiteinde apart, en controleert die", () => {
    const pv = berekenPrijsvork({ prijsvorkMin: "390000" }, calc());
    expect(pv.manueel).toBe(true);
    expect(pv.minimum).toBe(390000);
    expect(pv.maximum).toBe(420000);
    expect(pv.berekendOnder).toBe(380000);
    expect(berekenPrijsvork({ prijsvorkMin: "430000", prijsvorkMax: "420000" }, calc()).waarschuwingen).toContain("Het minimum van de prijsvork is hoger dan het maximum.");
    expect(berekenPrijsvork({ prijsvorkMin: "410000" }, calc()).waarschuwingen).toContain("De venale waarde ligt buiten de manueel ingevulde prijsvork.");
  });

  it("geeft geen vork zonder enige waarde", () => {
    expect(berekenPrijsvork({}, calc({ intrinsiek: 0, venaleWaardePand: 0, venaleWaarde: 0 })).beschikbaar).toBe(false);
  });
});

describe("prijsvork in de berekening en het verslag", () => {
  const dossier = (o = {}) => ({
    ...initialData, id: "d1", ruimtes: [{ opp: "180", coeff: "1" }], schijven: [{ opp: "800", prijs: "200" }], grondopp: "800",
    extraPanden: [], parkeerplaatsenGarages: [], ...o,
  });

  it("berekent de vork mee en zet de venale waarde er altijd binnen", () => {
    const c = berekenWaardering(dossier({ huurMaand: "1200", yieldVan: "4", yieldTot: "5", yieldStap: "0.5" }));
    expect(c.prijsvork.beschikbaar).toBe(true);
    expect(c.prijsvork.minimum).toBeLessThanOrEqual(c.venaleWaarde);
    expect(c.prijsvork.maximum).toBeGreaterThanOrEqual(c.venaleWaarde);
    expect(c.prijsvork.methodes.map((m) => m.sleutel)).toEqual(["analytisch", "rendement"]);
  });

  it("toont de vork met de uitkomst per methode in het verslag, en vermeldt ze bij de venale waarde", () => {
    const d = dossier();
    const c = berekenWaardering(d);
    const blok = rapportWaarderingsBlokken(d, c).find((b) => b.titel === "Prijsvork venale waarde");
    expect(blok).toBeTruthy();
    expect(blok.rijen[0][0]).toBe("Analytische methode (intrinsieke waarde ± marktmarge)");
    expect(blok.rijen[blok.rijen.length - 1][0]).toBe("Prijsvork");
    expect(blok.motivering).toContain("De prijsvork geeft de marge aan waarbinnen een verkoop onder normale omstandigheden redelijkerwijs kan worden verwacht.");
    expect(rapportVenaleWaardeZin(d, c)).toContain("binnen een prijsvork van");
  });

  it("vermeldt een manueel bepaalde vork als zodanig", () => {
    const d = dossier({ reden: "Hypothecair krediet", prijsvorkMin: "300000", prijsvorkMax: "400000", prijsvorkMotivering: "eigen marktinschatting" });
    const blok = rapportWaarderingsBlokken(d, berekenWaardering(d)).find((b) => b.titel === "Prijsvork venale waarde");
    expect(blok.rijen[blok.rijen.length - 1][0]).toBe("Prijsvork (bepaald door de schatter-expert)");
    expect(blok.motivering).toContain("eigen marktinschatting");
    expect(blok.motivering).toContain("De gedwongen verkoopwaarde maakt geen deel uit van de prijsvork");
  });

  it("houdt de gedwongen verkoop buiten de vork: andere factor, zelfde vork", () => {
    const a = berekenWaardering(dossier({ gedwongenFactor: "0.8" }));
    const b = berekenWaardering(dossier({ gedwongenFactor: "0.5" }));
    expect(a.gedwongenVerkoop).not.toBe(b.gedwongenVerkoop);
    expect(a.prijsvork.minimum).toBe(b.prijsvork.minimum);
    expect(a.prijsvork.maximum).toBe(b.prijsvork.maximum);
    expect(a.prijsvork.methodes.some((m) => /gedwongen/i.test(m.label))).toBe(false);
  });

  it("vermeldt in het verslag bij beide blokken dat de gedwongen verkoop niet in de vork zit, met de vork als laatste blok", () => {
    const d = dossier({ reden: "Hypothecair krediet", gedwongenFactor: "0.8" });
    const blokken = rapportWaarderingsBlokken(d, berekenWaardering(d));
    const titels = blokken.map((b) => b.titel);
    const iVork = titels.indexOf("Prijsvork venale waarde");
    expect(iVork).toBe(titels.length - 1);
    expect(blokken.find((b) => b.titel === "Gedwongen verkoop").motivering).toContain("valt buiten de prijsvork");
    expect(blokken[iVork].motivering).toContain("De gedwongen verkoopwaarde maakt geen deel uit van de prijsvork");
    expect(blokken[iVork].rijen.some(([label]) => /gedwongen/i.test(label))).toBe(false);
  });
});

describe("berekenTotaalPrijsvork (meerdere panden)", () => {
  const pand = (venale, min, max, o = {}) => ({ venaleWaarde: venale, prijsvork: { beschikbaar: true, minimum: min, maximum: max, manueel: false, ...o } });

  it("telt de minima en de maxima van de vork per pand op", () => {
    const tv = berekenTotaalPrijsvork([pand(400000, 380000, 420000), pand(250000, 235000, 266000)]);
    expect(tv.minimum).toBe(615000);
    expect(tv.maximum).toBe(686000);
    expect(tv.totaal).toBe(650000);
    expect(tv.beschikbaar).toBe(true);
    expect(tv.waarschuwingen).toEqual([]);
    expect(tv.motivering).toContain("som van de prijsvorken per pand");
  });

  it("neemt een manueel bepaalde vork van een pand over en vermeldt dat", () => {
    const tv = berekenTotaalPrijsvork([pand(400000, 390000, 410000, { manueel: true }), pand(250000, 235000, 266000)]);
    expect(tv.minimum).toBe(625000);
    expect(tv.manueel).toBe(true);
    expect(tv.motivering).toContain("manueel bepaald");
  });

  it("waarschuwt wanneer een pand nog geen vork heeft", () => {
    const tv = berekenTotaalPrijsvork([pand(400000, 380000, 420000), { venaleWaarde: 0, prijsvork: { beschikbaar: false, minimum: 0, maximum: 0 } }]);
    expect(tv.beschikbaar).toBe(false);
    expect(tv.minimum).toBe(380000);
    expect(tv.waarschuwingen[0]).toContain("Voor 1 pand is nog geen prijsvork beschikbaar");
  });

  it("werkt op echte berekeningen: de totale venale waarde ligt binnen de totale vork", () => {
    const basis = { ...initialData, ruimtes: [{ opp: "180", coeff: "1" }], schijven: [{ opp: "800", prijs: "200" }], grondopp: "800", extraPanden: [], parkeerplaatsenGarages: [] };
    const c1 = berekenWaardering(basis);
    const c2 = berekenWaardering({ ...basis, ruimtes: [{ opp: "120", coeff: "1" }], schijven: [{ opp: "400", prijs: "250" }], grondopp: "400" });
    const tv = berekenTotaalPrijsvork([c1, c2]);
    expect(tv.beschikbaar).toBe(true);
    expect(tv.minimum).toBeLessThanOrEqual(tv.totaal);
    expect(tv.maximum).toBeGreaterThanOrEqual(tv.totaal);
    expect(tv.minimum).toBe(c1.prijsvork.minimum + c2.prijsvork.minimum);
  });
});
