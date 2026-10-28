// Tests voor loten in één dossier (domein/prijstabel.js): een pand dupliceren en de prijstabel per
// lot, en de prijstabel in het verslag (buildPrintHtml). Scenario: een blok van 6 gelijkaardige
// appartementen — 2 ingangen (A en B) van elk 3 boven elkaar, het bovenste onder het dak (schuine
// wanden, lagere coëfficiënt) en één met een zolder. Verzonnen gegevens.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { dupliceerPand, prijstabelRij, bouwPrijstabel } from "../domein/prijstabel.js";
import { berekenWaardering } from "../domein/waardering.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { initialData, maakLeegPand, HUISSTIJLEN } from "../constants.js";

const ruimtes = (extra = []) => [
  { id: 1, verdieping: "1everdiep", naam: "Leefruimte", opp: "45", coeff: 1, vloer: "" },
  { id: 2, verdieping: "1everdiep", naam: "Slaapkamers", opp: "35", coeff: 1, vloer: "" },
  { id: 3, verdieping: "terras", naam: "Terras", opp: "8", coeff: 0.9, vloer: "" },
  ...extra,
];
const hoofd = () => ({
  ...initialData, id: "d1", straat: "Negenoogstraat", nummer: "3", bus: "0001", postcode: "9140", gemeente: "Temse",
  pandType: "Appartement", pandNaam: "GLV A", lotVerdieping: "gelijkvloers", opdrachtgeverNaam: "Familie Peeters", reden: "Nalatenschap",
  ruimtes: ruimtes(), slaapkamers: [{ id: 1 }, { id: 2 }], schijven: [{ opp: "120", prijs: "250" }], grondopp: "120",
  fotos: [{ id: "f1", base64: "data:image/jpeg;base64,AAAA" }], documenten: [{ naam: "EPC.pdf" }],
  venaleWaarde: "250000", extraPanden: [], parkeerplaatsenGarages: [],
});

describe("pand dupliceren", () => {
  it("neemt alle pand-gegevens over, maar geen foto's, documenten, lot of manuele waarde", () => {
    const bron = hoofd();
    const kopie = dupliceerPand(bron, maakLeegPand());
    expect(kopie.ruimtes).toEqual(bron.ruimtes);
    expect(kopie.slaapkamers).toHaveLength(2);
    expect(kopie.pandType).toBe("Appartement");
    expect(kopie.straat).toBe("Negenoogstraat");
    expect(kopie.fotos).toEqual([]);
    expect(kopie.documenten).toEqual([]);
    expect(kopie.pandNaam).toBe("");
    expect(kopie.lotVerdieping).toBe("");
    expect(kopie.venaleWaarde).toBe("");
    expect(kopie.pandId).toBeTruthy();
  });

  it("kopieert diep: een aanpassing aan het nieuwe lot raakt het origineel niet", () => {
    const bron = hoofd();
    const kopie = dupliceerPand(bron, maakLeegPand());
    kopie.ruimtes[0].opp = "60";
    kopie.slaapkamers.push({ id: 3 });
    expect(bron.ruimtes[0].opp).toBe("45");
    expect(bron.slaapkamers).toHaveLength(2);
  });

  it("neemt geen dossierbrede velden mee (opdrachtgever, reden, …)", () => {
    const kopie = dupliceerPand(hoofd(), maakLeegPand());
    expect("opdrachtgeverNaam" in kopie).toBe(false);
    expect("reden" in kopie).toBe(false);
    expect("extraPanden" in kopie).toBe(false);
  });

  it("geeft elk duplicaat een eigen id", () => {
    const bron = hoofd();
    expect(dupliceerPand(bron, maakLeegPand()).pandId).not.toBe(dupliceerPand(bron, maakLeegPand()).pandId);
  });
});

describe("prijstabel", () => {
  it("toont per lot verdieping, gewogen opp., slaapkamers, terras/tuin, waarde en €/m²", () => {
    const pd = { ...hoofd(), venaleWaarde: "" };
    const r = prijstabelRij(pd, berekenWaardering(pd), "Hoofdpand");
    expect(r.lot).toBe("GLV A");
    expect(r.verdieping).toBe("gelijkvloers");
    expect(r.slaapkamers).toBe(2);
    expect(r.buitenOpp).toBe(8);
    expect(r.gewogenOpp).toBeCloseTo(45 + 35 + 8 * 0.9, 6);
    expect(r.perM2).toBeCloseTo(r.venaleWaarde / r.gewogenOpp, 6);
    expect(r.prijsvork.minimum).toBeLessThanOrEqual(r.venaleWaarde);
  });

  it("toont de parkeerplaatsen als aparte regel, niet in de waarde van het eerste lot", () => {
    const pd = { ...hoofd(), parkeerplaatsenGarages: [{ id: 1, type: "Garage", aantal: "2", waardePerStuk: "20000" }] };
    const calc = berekenWaardering(pd);
    const pt = bouwPrijstabel([{ pd, calc }]);
    expect(pt.parkeerTotaal).toBe(40000);
    expect(pt.rijen[0].venaleWaarde).toBe(calc.venaleWaardePand);
    expect(pt.totaal).toBe(calc.venaleWaarde);
  });

  it("valt terug op Hoofdpand / Pand N zonder lot", () => {
    const pd = { ...hoofd(), pandNaam: "" };
    const pt = bouwPrijstabel([{ pd, calc: berekenWaardering(pd) }, { pd, calc: berekenWaardering(pd) }]);
    expect(pt.rijen.map((r) => r.lot)).toEqual(["Hoofdpand", "Pand 2"]);
  });
});

// het blok: GLV A/B, 1ste A/B, 2de A/B (onder het dak, lagere coëfficiënt), 2de B met zolder
const blok = () => {
  const d = { ...hoofd(), venaleWaarde: "" };
  const loten = [
    ["GLV B", "gelijkvloers", ruimtes()],
    ["1ste A", "1ste verdieping", ruimtes()],
    ["1ste B", "1ste verdieping", ruimtes()],
    ["2de A", "2de verdieping (dak)", ruimtes().map((r) => (r.verdieping === "terras" ? r : { ...r, coeff: 0.85 }))],
    ["2de B", "2de verdieping (dak)", [...ruimtes().map((r) => (r.verdieping === "terras" ? r : { ...r, coeff: 0.85 })), { id: 4, verdieping: "zolder", naam: "Zolder", opp: "30", coeff: 0.5, vloer: "" }]],
  ].map(([lot, verd, rz], i) => ({ ...dupliceerPand(d, maakLeegPand()), pandNaam: lot, lotVerdieping: verd, bus: `000${i + 2}`, ruimtes: rz }));
  return { ...d, extraPanden: loten };
};

describe("prijstabel van een blok van 6 appartementen", () => {
  const d = blok();
  const panden = [{ pd: d, calc: berekenWaardering(d) }, ...d.extraPanden.map((p) => {
    const pd = { ...d, ...p, extraPanden: [], parkeerplaatsenGarages: [] };
    return { pd, calc: berekenWaardering(pd) };
  })];
  const pt = bouwPrijstabel(panden);

  it("telt de loten op tot de totale waarde, met de totale prijsvork errond", () => {
    expect(pt.rijen.map((r) => r.lot)).toEqual(["GLV A", "GLV B", "1ste A", "1ste B", "2de A", "2de B"]);
    expect(pt.totaal).toBeCloseTo(pt.rijen.reduce((s, r) => s + r.venaleWaarde, 0), 6);
    expect(pt.totaleVork.minimum).toBeLessThanOrEqual(pt.totaal);
    expect(pt.totaleVork.maximum).toBeGreaterThanOrEqual(pt.totaal);
  });

  it("weerspiegelt de verschillen: het dakappartement minder gewogen m², de zolder erbij", () => {
    const [glvA, , , , dakA, dakB] = pt.rijen;
    expect(dakA.gewogenOpp).toBeLessThan(glvA.gewogenOpp);
    expect(dakB.gewogenOpp).toBeCloseTo(dakA.gewogenOpp + 30 * 0.5, 6);
    expect(dakA.venaleWaarde).toBeLessThan(glvA.venaleWaarde);
    expect(dakB.venaleWaarde).toBeGreaterThan(dakA.venaleWaarde);
  });

  it("zet de prijstabel in het verslag, met het lot in de hoofdstuktitels en op het voorblad", () => {
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain("Prijstabel en totale waarde");
    for (const lot of ["GLV A", "GLV B", "1ste A", "1ste B", "2de A", "2de B"]) expect(html).toContain(`<strong>${lot}</strong>`);
    expect(html).toContain("2de B — Negenoogstraat 3/0006, 9140 Temse — Waardering");
    expect(html).toContain("6 loten");
    expect(html).toContain("Totaal (6 loten)");
    expect(html).toContain("Totale venale waarde (6 loten)");
    expect(html).toContain("bus 0006");
    expect(html).not.toContain("Negenoogstraat 3/0001</div>");
  });
});

// Gemelde fout (lot 9A): bij meerdere panden kwamen de dossierbrede garages bij de venale waarde
// van het hoofdpand — en zo ook in zijn prijsvork en gedwongen verkoopwaarde — terwijl de
// prijstabel ze er wel uit hield. Het verslag sprak zichzelf daardoor tegen.
describe("garages bij een dossier met meerdere panden", () => {
  const garages = [{ id: 1, type: "Garage", aantal: "3", waardePerStuk: "20000" }];
  const metLoten = () => {
    const d = { ...hoofd(), venaleWaarde: "", gedwongenFactor: 0.8, parkeerplaatsenGarages: garages };
    return { ...d, extraPanden: [{ ...dupliceerPand(d, maakLeegPand()), pandNaam: "9B", bus: "0002" }] };
  };

  it("rekent ze niet bij de venale waarde, prijsvork of gedwongen verkoopwaarde van het hoofdpand", () => {
    const d = metLoten();
    const c = berekenWaardering(d);
    const zonder = berekenWaardering({ ...d, parkeerplaatsenGarages: [] });
    expect(c.parkeerTotaal).toBe(0);
    expect(c.venaleWaarde).toBeCloseTo(zonder.venaleWaarde, 6);
    expect(c.gedwongenVerkoop).toBeCloseTo(zonder.gedwongenVerkoop, 6);
    expect(c.prijsvork.minimum).toBe(zonder.prijsvork.minimum);
    expect(c.prijsvork.maximum).toBe(zonder.prijsvork.maximum);
  });

  it("telt ze wel één keer mee in het totaal en de totale prijsvork", () => {
    const d = metLoten();
    const c1 = berekenWaardering(d);
    const c2 = berekenWaardering({ ...d, ...d.extraPanden[0], extraPanden: [], parkeerplaatsenGarages: [] });
    const pt = bouwPrijstabel([{ pd: d, calc: c1 }, { pd: d.extraPanden[0], calc: c2 }], { parkeerTotaal: 60000 });
    expect(pt.parkeerTotaal).toBe(60000);
    expect(pt.totaal).toBeCloseTo(c1.venaleWaarde + c2.venaleWaarde + 60000, 6);
    expect(pt.totaleVork.minimum).toBe(c1.prijsvork.minimum + c2.prijsvork.minimum + 60000);
    expect(pt.totaleVork.maximum).toBe(c1.prijsvork.maximum + c2.prijsvork.maximum + 60000);
  });

  it("laat het verslag zichzelf niet meer tegenspreken: de waardering van het hoofdpand zonder garages, het totaal met", () => {
    const d = metLoten();
    const c = berekenWaardering(d);
    const html = buildPrintHtml(d, c, HUISSTIJLEN.houpels);
    const sectie = html.slice(html.indexOf("— Waardering</h2>"), html.indexOf("— Waardering</h2>") + 20000);
    expect(sectie).not.toContain("Parkeerplaatsen &amp; garages (vast bedrag)");
    expect(sectie).not.toContain("Totaal parkeerplaatsen/garages");
    expect(html).toContain("Parkeerplaatsen &amp; garages</td>");
  });

  it("blijft ze bij één pand gewoon in de venale waarde rekenen", () => {
    const d = { ...hoofd(), venaleWaarde: "", parkeerplaatsenGarages: garages };
    const c = berekenWaardering(d);
    expect(c.parkeerTotaal).toBe(60000);
    expect(c.venaleWaarde).toBeCloseTo(c.venaleWaardePand + 60000, 6);
  });
});
