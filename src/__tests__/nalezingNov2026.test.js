// Tests voor de verbeteringen na de nalezing van een verslag met drie panden (november 2026):
// samenhang van het EPC (label ↔ score, certificaatnummer ↔ datum, EPC van vóór 2019 bij verkoop),
// de kopregel met alle adressen, slaapkamers en oppervlaktekolom in de prijstabel, de
// inhoudstafel-markeringen buiten de tekstloop, geen kopje met "0 foto's", de voorafgaande
// opmerking bij meerdere panden, de SWOT-samenvatting en het overnemen van de ligging van een pand
// in dezelfde straat. Verzonnen gegevens.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { labelVoorScoreResidentieel, datumUitCertificaat, epcGegevens, epcConsistentie } from "../domein/epc.js";
import { kopAdres, KOPADRES_MAX } from "../domein/locatie.js";
import { bouwPrijstabel, dupliceerPand } from "../domein/prijstabel.js";
import { berekenWaardering } from "../domein/waardering.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { voorafgaandeOpmerkingen } from "../rapport/html.js";
import { buildPropertySummary } from "../data/ai.js";
import { liggingBronInDezelfdeStraat } from "../stappen/StepLigging.jsx";
import { initialData, maakLeegPand, HUISSTIJLEN } from "../constants.js";

const res = (o = {}) => ({ vastgoedType: "Residentieel", ...o });

describe("EPC: label, score en certificaatnummer", () => {
  it("geeft het label dat bij de energiescore hoort (residentieel)", () => {
    expect(labelVoorScoreResidentieel(-12)).toBe("A+");
    expect(labelVoorScoreResidentieel(0)).toBe("A+");
    expect(labelVoorScoreResidentieel(100)).toBe("A");
    expect(labelVoorScoreResidentieel("101")).toBe("B");
    expect(labelVoorScoreResidentieel("299,5")).toBe("C");
    expect(labelVoorScoreResidentieel(450)).toBe("E");
    expect(labelVoorScoreResidentieel(501)).toBe("F");
    expect(labelVoorScoreResidentieel("")).toBe("");
  });

  it("haalt de opmaakdatum uit het certificaatnummer", () => {
    expect(datumUitCertificaat("20160415-0001853753-1")).toBe("2016-04-15");
    expect(datumUitCertificaat(" 20230102 ")).toBe("2023-01-02");
    expect(datumUitCertificaat("20161345-0001853753-1")).toBe("");
    expect(datumUitCertificaat("ABC-123")).toBe("");
    expect(datumUitCertificaat("")).toBe("");
  });

  it("rekent de geldigheid vanaf de datum in het certificaatnummer", () => {
    const e = epcGegevens(res({ epcCertificaatnummer: "20160415-0001853753-1", epcDatum: "2020-04-15" }));
    expect(e.datumCertificaat).toBe("2016-04-15");
    expect(e.geldigTot.slice(0, 4)).toBe("2026");
  });

  it("meldt een label dat niet bij de score past", () => {
    const uit = epcConsistentie(res({ epcLabel: "C", epcWaarde: "450" }));
    expect(uit.join(" ")).toContain("Label C past niet");
    expect(uit.join(" ")).toContain("label E");
    expect(epcConsistentie(res({ epcLabel: "E", epcWaarde: "450" }))).toEqual([]);
  });

  it("meldt een datum die niet bij het certificaatnummer past", () => {
    const uit = epcConsistentie(res({ epcCertificaatnummer: "20160415-0001853753-1", epcDatum: "2020-04-15" }));
    expect(uit.join(" ")).toContain("certificaatnummer wijst op een EPC van 15/04/2016");
  });

  it("meldt een EPC van vóór 2019 enkel bij een verkoop", () => {
    const oud = { epcCertificaatnummer: "20160415-0001853753-1", epcDatum: "2016-04-15" };
    expect(epcConsistentie(res({ ...oud, reden: "Verkoop" })).join(" ")).toContain("vóór 2019");
    expect(epcConsistentie(res({ ...oud, reden: "Nalatenschap" }))).toEqual([]);
  });

  it("controleert niets bij een niet-residentieel EPC", () => {
    expect(epcConsistentie({ vastgoedType: "Kantoor", bedrijfsEpcType: "EPC NR (niet-residentieel)", bedrijfsEpcLabel: "C", bedrijfsEpcWaarde: "450" })).toEqual([]);
  });
});

describe("kopregel met alle adressen", () => {
  const pand = (o) => ({ straat: "Vlyminckshoek", nummer: "", bus: "", postcode: "", gemeente: "", ...o });
  const hoofd = { ...pand({ nummer: "40A", postcode: "9100", gemeente: "Sint-Niklaas" }) };

  it("geeft bij één pand gewoon het adres", () => {
    expect(kopAdres({ ...hoofd, extraPanden: [] })).toBe("Vlyminckshoek 40A, 9100 Sint-Niklaas");
  });

  it("vat de panden in dezelfde straat samen (extra panden nemen postcode en gemeente van het hoofdpand)", () => {
    const d = { ...hoofd, extraPanden: [pand({ nummer: "40B" }), pand({ nummer: "40C", postcode: "9100", gemeente: "Sint-Niklaas" })] };
    expect(kopAdres(d)).toBe("Vlyminckshoek 40A, 40B, 40C, 9100 Sint-Niklaas");
  });

  it("vermeldt andere straten en percelen zonder adres apart", () => {
    const anderestraat = { ...hoofd, extraPanden: [pand({ straat: "Kerkstraat", nummer: "2" })] };
    expect(kopAdres(anderestraat)).toBe("Vlyminckshoek 40A, 9100 Sint-Niklaas · Kerkstraat 2, 9100 Sint-Niklaas");
    const perceel = { ...hoofd, extraPanden: [pand({ straat: "", capakey: "46021A0123/00B000" })] };
    expect(kopAdres(perceel)).toBe("Vlyminckshoek 40A, 9100 Sint-Niklaas · 1 perceel zonder adres");
  });

  it("valt terug op het eerste adres met het aantal andere panden als de regel te lang wordt", () => {
    const extra = Array.from({ length: 6 }, (_, i) => pand({ straat: `Een heel lange straatnaam nummer ${i}`, nummer: String(i + 1) }));
    const regel = kopAdres({ ...hoofd, extraPanden: extra });
    expect(regel).toBe("Vlyminckshoek 40A, 9100 Sint-Niklaas (+ 6 andere panden)");
    expect(regel.length).toBeLessThanOrEqual(KOPADRES_MAX);
  });
});

describe("prijstabel: slaapkamers en oppervlaktekolom", () => {
  const calc = (opp, waarde) => ({ totOppNaCoeff: opp, venaleWaarde: waarde, prijsvork: null });
  const woning = { ...maakLeegPand(), vastgoedType: "Residentieel", pandType: "Woning", slaapkamers: [{ id: 1 }, { id: 2 }, { id: 3 }] };
  const kmo = { ...maakLeegPand(), vastgoedType: "KMO-unit / gemengd", pandType: "KMO-unit" };

  it("telt geen slaapkamers bij een bedrijfspand (ook niet de standaardrij uit een leeg pand)", () => {
    expect(kmo.slaapkamers.length).toBeGreaterThan(0);
    const pt = bouwPrijstabel([{ pd: kmo, calc: calc(300, 360000) }]);
    expect(pt.rijen[0].slaapkamers).toBe(0);
    expect(pt.metSlaapkamers).toBe(false);
    expect(pt.oppLabel).toBe("Nuttige opp.");
    expect(pt.totaalOpp).toBe(300);
  });

  it("telt geen oppervlaktes op van verschillende soorten panden", () => {
    const pt = bouwPrijstabel([{ pd: woning, calc: calc(180, 400000) }, { pd: kmo, calc: calc(300, 360000) }]);
    expect(pt.rijen.map((r) => r.slaapkamers)).toEqual([3, 0]);
    expect(pt.metSlaapkamers).toBe(true);
    expect(pt.totaalOpp).toBe(0);
    expect(pt.oppLabel).toBe("Opp.");
  });

  it("houdt de gewogen oppervlakte bij enkel woningen", () => {
    const pt = bouwPrijstabel([{ pd: woning, calc: calc(180, 400000) }, { pd: woning, calc: calc(120, 300000) }]);
    expect(pt.oppLabel).toBe("Gewogen opp.");
    expect(pt.totaalOpp).toBe(300);
  });
});

describe("verslag met meerdere panden", () => {
  const ruimtes = () => [
    { id: 1, verdieping: "gelijkvloers", naam: "Leefruimte", opp: "45", coeff: 1, vloer: "" },
    { id: 2, verdieping: "1everdiep", naam: "Slaapkamers", opp: "35", coeff: 1, vloer: "" },
  ];
  const hoofd = () => ({
    ...initialData, id: "d1", straat: "Vlyminckshoek", nummer: "40A", postcode: "9100", gemeente: "Sint-Niklaas",
    pandType: "Woning", pandNaam: "40A", opdrachtgeverNaam: "Familie Peeters", reden: "Nalatenschap",
    ruimtes: ruimtes(), slaapkamers: [{ id: 1 }, { id: 2 }], schijven: [{ opp: "300", prijs: "250" }], grondopp: "300",
    fotos: [{ id: "f1", base64: "data:image/jpeg;base64,AAAA" }], documenten: [{ naam: "EPC.pdf" }],
    venaleWaarde: "250000", extraPanden: [], parkeerplaatsenGarages: [],
  });
  const metExtra = () => {
    const d = hoofd();
    return { ...d, extraPanden: [{ ...dupliceerPand(d, maakLeegPand()), pandNaam: "40B", nummer: "40B" }] };
  };

  it("houdt de inhoudstafel-markeringen buiten de tekstloop (geen extra regel of pagina)", () => {
    const html = buildPrintHtml(metExtra(), berekenWaardering(metExtra()), HUISSTIJLEN.houpels);
    expect(html).toContain(".tocmark { position: absolute;");
    expect(html).toContain("[[TOCMARK:");
  });

  it("toont geen kopje met \"0 foto's\" voor een pand zonder foto's en stukken", () => {
    const html = buildPrintHtml(metExtra(), berekenWaardering(metExtra()), HUISSTIJLEN.houpels);
    expect(html).not.toMatch(/\b0 foto/);
    expect(html).toContain("1 foto");
  });

  it("zegt in de voorafgaande opmerkingen dat de waarde per pand bepaald is", () => {
    const html = buildPrintHtml(metExtra(), berekenWaardering(metExtra()), HUISSTIJLEN.houpels);
    expect(html).toContain("De waarde werd per pand bepaald");
    expect(html).not.toContain("De waardebepaling gaat uit van de getaxeerde zaken als één geheel");
  });

  it("houdt bij één pand de gewone zin", () => {
    const zinnen = voorafgaandeOpmerkingen(hoofd(), 12);
    expect(zinnen.join(" ")).toContain("De waardebepaling gaat uit van de getaxeerde zaken als één geheel");
    expect(voorafgaandeOpmerkingen(hoofd(), 12, { meerderePanden: true }).join(" ")).toContain("De waarde werd per pand bepaald");
  });
});

describe("samenvatting voor de SWOT", () => {
  const d = () => ({ ...initialData, straat: "Vlyminckshoek", nummer: "40A", postcode: "9100", gemeente: "Sint-Niklaas", eigenaars: [], vergelijkingspunten: [], documenten: [], bewoonbareOppSchatting: "205" });

  it("laat de wijze van waardering en een onbekende eigendomstoestand weg", () => {
    const swot = buildPropertySummary(d(), { voorSwot: true });
    expect(swot).not.toContain("Wijze van waardering");
    expect(swot).not.toContain("Aantal vergelijkingspunten");
    expect(swot).not.toContain("Eigendomstoestand");
    const volledig = buildPropertySummary(d());
    expect(volledig).toContain("Wijze van waardering");
    expect(volledig).toContain("Eigendomstoestand: onbekend");
  });

  it("gebruikt de berekende oppervlakte i.p.v. de eerste schatting", () => {
    expect(buildPropertySummary(d(), { calc: { totOppNaCoeff: 234.04 }, voorSwot: true })).toContain("234 m²");
    expect(buildPropertySummary(d(), { voorSwot: true })).toContain("205 m²");
  });
});

describe("ligging overnemen van een pand in dezelfde straat", () => {
  const d = { straat: "Vlyminckshoek", gemeente: "Sint-Niklaas" };

  it("vindt een ander pand in dezelfde straat met ingevulde ligging", () => {
    const bron = { naam: "40A", straat: "vlyminckshoek ", gemeente: "", omgevingsvoorzieningen: "Bakker op 300 m" };
    expect(liggingBronInDezelfdeStraat(d, [{ naam: "Elders", straat: "Kleine Laan", omgevingsvoorzieningen: "x" }, bron])).toBe(bron);
  });

  it("negeert panden zonder ligging, in een andere gemeente, of een pand zonder straat", () => {
    expect(liggingBronInDezelfdeStraat(d, [{ straat: "Vlyminckshoek", gemeente: "Sint-Niklaas" }])).toBeNull();
    expect(liggingBronInDezelfdeStraat(d, [{ straat: "Vlyminckshoek", gemeente: "Temse", bereikbaarheid: "N70" }])).toBeNull();
    expect(liggingBronInDezelfdeStraat({ straat: "" }, [{ straat: "", bereikbaarheid: "N70" }])).toBeNull();
  });
});
