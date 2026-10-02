// Tests voor de waardering volgens de vergelijkende methode (domein/vglWaardering.js) en de
// inpassing ervan in de venale waarde en het verslag (domein/waardering.js). Verzonnen gegevens.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { berekenVergelijkendeWaarde, marginaleGrondprijs } from "../domein/vglWaardering.js";
import { berekenWaardering, rapportWaarderingsBlokken, rapportVenaleWaardeZin, rapportVergelijkingspuntRijen } from "../domein/waardering.js";
import { initialData } from "../constants.js";

const punt = (o = {}) => ({ id: o.id || Math.random().toString(36).slice(2), adres: "Proefstraat 1", belastbareGrondslag: "400000", nuttigeOpp: "200", grondOpp: "", datumTransactie: "2025-09-30", weging: "1", ...o });
const pand = (punten, o = {}) => ({ pandType: "Woning", grondopp: "800", schijven: [], referentiedatum: "2026-09-30", vergelijkingspunten: punten, ...o });
const ctx = (o = {}) => ({ onderwerpOpp: 180, intrinsiek: 0, ...o });

describe("berekenVergelijkendeWaarde — rekenwijze", () => {
  it("neemt het gemiddelde van de m²-prijzen maal de gewogen nuttige oppervlakte van het te schatten goed", () => {
    const v = berekenVergelijkendeWaarde(pand([
      punt({ belastbareGrondslag: "400000", nuttigeOpp: "200" }), // 2.000/m²
      punt({ belastbareGrondslag: "440000", nuttigeOpp: "200" }), // 2.200/m²
      punt({ belastbareGrondslag: "378000", nuttigeOpp: "180" }), // 2.100/m²
    ]), ctx());
    expect(v.aantal).toBe(3);
    expect(v.gemiddeldePerM2).toBeCloseTo(2100, 6);
    expect(v.waarde).toBeCloseTo(2100 * 180, 6);
    expect(v.mediaanPerM2).toBeCloseTo(2100, 6);
    expect(v.minPerM2).toBeCloseTo(2000, 6);
    expect(v.maxPerM2).toBeCloseTo(2200, 6);
    expect(v.volwaardig).toBe(true);
  });

  it("corrigeert enkel het grondverschil, aan de marginale (laagste) grondprijs uit de schijven", () => {
    const d = pand([punt({ belastbareGrondslag: "424000", nuttigeOpp: "200", grondOpp: "1400" })], {
      schijven: [{ opp: "500", prijs: "300" }, { opp: "300", prijs: "40" }],
    });
    const v = berekenVergelijkendeWaarde(d, ctx());
    expect(marginaleGrondprijs(d.schijven)).toBe(40);
    expect(v.punten[0].grondcorrectie).toBe(-24000); // (800 − 1.400) × 40
    expect(v.punten[0].prijsPerM2Basis).toBeCloseTo(2000, 6); // (424.000 − 24.000) / 200
    expect(v.grondprijsIsStandaard).toBe(true);
  });

  it("gebruikt een manueel ingevulde grondcorrectieprijs in plaats van de standaard", () => {
    const d = pand([punt({ belastbareGrondslag: "400000", nuttigeOpp: "200", grondOpp: "700" })], {
      schijven: [{ opp: "800", prijs: "40" }], vglGrondcorrectiePrijs: "100",
    });
    expect(berekenVergelijkendeWaarde(d, ctx()).punten[0].grondcorrectie).toBe(10000); // (800 − 700) × 100
  });

  it("past optioneel een jaarlijkse marktevolutie toe tot de referentiedatum", () => {
    const d = pand([punt({ belastbareGrondslag: "400000", nuttigeOpp: "200", datumTransactie: "2025-09-30" })], { vglMarktevolutiePct: "3" });
    expect(berekenVergelijkendeWaarde(d, ctx()).punten[0].prijsPerM2Basis).toBeCloseTo(2060, 6);
    const zonder = pand([punt({ belastbareGrondslag: "400000", nuttigeOpp: "200" })]);
    expect(berekenVergelijkendeWaarde(zonder, ctx()).punten[0].prijsPerM2Basis).toBeCloseTo(2000, 6);
  });

  it("telt de correcties van de schatter op (ligging + staat + overige) en vraagt om een motivering", () => {
    const v = berekenVergelijkendeWaarde(pand([punt({ correctieLigging: "5", correctieStaat: "-10" })]), ctx());
    expect(v.punten[0].correctiePct).toBe(-5);
    expect(v.punten[0].prijsPerM2).toBeCloseTo(1900, 6);
    expect(v.punten[0].opmerkingen).toContain("correctie zonder motivering");
  });

  it("weegt een zeer vergelijkbaar punt dubbel en laat een punt met weging 0 weg", () => {
    const v = berekenVergelijkendeWaarde(pand([
      punt({ belastbareGrondslag: "400000", weging: "2" }), // 2.000
      punt({ belastbareGrondslag: "460000", weging: "1" }), // 2.300
      punt({ belastbareGrondslag: "800000", weging: "0" }),
    ]), ctx());
    expect(v.aantal).toBe(2);
    expect(v.gemiddeldePerM2).toBeCloseTo((2000 * 2 + 2300) / 3, 6);
    expect(v.punten[2].reden).toBe("telt niet mee (weging 0)");
  });

  it("legt uit waarom een punt niet meetelt", () => {
    const v = berekenVergelijkendeWaarde(pand([
      punt({ nuttigeOpp: "" }),
      punt({ belastbareGrondslag: "" }),
      punt({ belastbareGrondslag: "20000", grondOpp: "2000" }), // (800 − 2.000) × 50 = −60.000
    ], { schijven: [{ opp: "800", prijs: "50" }] }), ctx());
    expect(v.punten[0].reden).toBe("gewogen nuttige oppervlakte ontbreekt");
    expect(v.punten[1].reden).toBe("geen prijs (belastbare grondslag) ingevuld");
    expect(v.punten[2].reden).toContain("grondcorrectie is groter dan de prijs");
  });

  it("corrigeert geen grond bij een appartement", () => {
    const v = berekenVergelijkendeWaarde(pand([punt({ grondOpp: "1400" })], { pandType: "Appartement", schijven: [{ opp: "1", prijs: "100" }] }), ctx());
    expect(v.punten[0].grondcorrectie).toBe(0);
    expect(v.grondprijs).toBeNull();
  });
});

describe("berekenVergelijkendeWaarde — waarschuwingen", () => {
  it("noemt het resultaat indicatief bij minder dan 3 punten", () => {
    const v = berekenVergelijkendeWaarde(pand([punt(), punt()]), ctx());
    expect(v.volwaardig).toBe(false);
    expect(v.waarschuwingen.some((w) => w.includes("Slechts 2 bruikbare vergelijkingspunten"))).toBe(true);
  });

  it("waarschuwt bij grote spreiding en duidt een uitschieter aan zonder hem weg te laten", () => {
    const v = berekenVergelijkendeWaarde(pand([
      punt({ belastbareGrondslag: "400000" }), punt({ belastbareGrondslag: "410000" }), punt({ belastbareGrondslag: "640000" }),
    ]), ctx());
    expect(v.aantal).toBe(3);
    expect(v.punten[2].uitschieter).toBe(true);
    expect(v.waarschuwingen.some((w) => w.includes("Grote spreiding"))).toBe(true);
  });

  it("vraagt een motivering bij meer dan 15% verschil met de intrinsieke waarde", () => {
    const v = berekenVergelijkendeWaarde(pand([punt(), punt(), punt()]), ctx({ intrinsiek: 300000 })); // 360.000 → +20%
    expect(v.afwijkingIntrinsiek).toBeCloseTo(0.2, 6);
    expect(v.waarschuwingen.some((w) => w.includes("wijkt 20% af van de intrinsieke waarde"))).toBe(true);
  });

  it("berekent geen waarde zolang de oppervlakte van het te schatten goed ontbreekt", () => {
    const v = berekenVergelijkendeWaarde(pand([punt(), punt(), punt()]), ctx({ onderwerpOpp: 0 }));
    expect(v.waarde).toBe(0);
    expect(v.waarschuwingen[0]).toContain("gewogen nuttige oppervlakte van het te schatten goed ontbreekt");
  });
});

// ---------- inpassing in de venale waarde en het verslag ----------
function dossier(o = {}) {
  return {
    ...initialData, id: "d1", ruimtes: [{ opp: "180", coeff: "1" }], schijven: [{ opp: "800", prijs: "200" }], grondopp: "800",
    extraPanden: [], parkeerplaatsenGarages: [], referentiedatum: "2026-09-30",
    vergelijkingspunten: [
      punt({ id: "a", adres: "Proefstraat 1", belastbareGrondslag: "400000", nuttigeOpp: "200", grondOpp: "800" }),
      punt({ id: "b", adres: "Testlaan 2", belastbareGrondslag: "440000", nuttigeOpp: "200", grondOpp: "800" }),
      punt({ id: "c", adres: "Voorbeeldweg 3", belastbareGrondslag: "378000", nuttigeOpp: "180", grondOpp: "800", correctieStaat: "5", correctieMotivering: "recent gerenoveerde badkamer" }),
    ],
    ...o,
  };
}

describe("venale waarde en verslag", () => {
  it("verandert niets zolang de schatter de vergelijkende waarde niet als basis kiest", () => {
    const calc = berekenWaardering(dossier());
    expect(calc.vgl.waarde).toBeGreaterThan(0);
    expect(calc.vglGebruikt).toBe(false);
    expect(calc.voorgesteldeVenaleWaarde).toBeCloseTo(calc.intrinsiek + calc.energiecorrectieBedrag, 6);
    expect(rapportWaarderingsBlokken(dossier(), calc).some((b) => b.titel.includes("vergelijkende methode"))).toBe(false);
  });

  it("gebruikt de vergelijkende waarde als voorgestelde venale waarde wanneer de schatter dat aanzet", () => {
    const d = dossier({ vglWaardeGebruiken: true });
    const calc = berekenWaardering(d);
    expect(calc.vglGebruikt).toBe(true);
    expect(calc.voorgesteldeVenaleWaarde).toBeCloseTo(calc.vgl.waarde, 6);
    expect(calc.venaleWaarde).toBeCloseTo(calc.vgl.waarde, 6);
    expect(rapportVenaleWaardeZin(d, calc)).toContain("bepaald volgens de vergelijkende methode, op basis van 3 vergelijkingspunten");
  });

  it("telt de energiecorrectie niet nog eens op bovenop de vergelijkende waarde", () => {
    const calc = berekenWaardering(dossier({ vglWaardeGebruiken: true, energiecorrectieActief: true, energiecorrectiePct: "-5" }));
    expect(calc.voorgesteldeVenaleWaarde).toBeCloseTo(calc.vgl.waarde, 6);
  });

  it("neemt het gemiddelde met de DCF-waarde als er huurgegevens zijn", () => {
    const calc = berekenWaardering(dossier({ vglWaardeGebruiken: true, huurMaand: "1200", yieldVan: "4", yieldTot: "4", yieldStap: "0.5" }));
    expect(calc.dcfSamengesteld).toBeGreaterThan(0);
    expect(calc.voorgesteldeVenaleWaarde).toBeCloseTo((calc.vgl.waarde + calc.dcfSamengesteld) / 2, 6);
  });

  it("laat een manueel ingevulde venale waarde altijd voorgaan", () => {
    expect(berekenWaardering(dossier({ vglWaardeGebruiken: true, venaleWaarde: "333000" })).venaleWaardePand).toBe(333000);
  });

  it("toont de punten in het verslag zonder adres, behalve bij een nalatenschap (GDPR)", () => {
    const gewoon = dossier({ vglWaardeGebruiken: true, reden: "Verkoop" });
    const blokGewoon = rapportWaarderingsBlokken(gewoon, berekenWaardering(gewoon)).find((b) => b.titel === "Waardering volgens de vergelijkende methode");
    const tekstGewoon = JSON.stringify(blokGewoon);
    expect(tekstGewoon).toContain("Vergelijkingspunt 1");
    expect(tekstGewoon).not.toContain("Proefstraat");
    expect(blokGewoon.motivering).toContain("Correcties vergelijkingspunt 3: recent gerenoveerde badkamer");

    const nalatenschap = dossier({ vglWaardeGebruiken: true, reden: "Nalatenschap" });
    const blokNal = rapportWaarderingsBlokken(nalatenschap, berekenWaardering(nalatenschap)).find((b) => b.titel === "Waardering volgens de vergelijkende methode");
    expect(JSON.stringify(blokNal)).toContain("Vergelijkingspunt 1 — Proefstraat 1");
  });

  it("toont gewogen oppervlakte, perceel en correcties bij de VGL-punten in het verslag", () => {
    const rijen = rapportVergelijkingspuntRijen(punt({ nuttigeOpp: "200", grondOpp: "760", correctieLigging: "-5", correctieStaat: "2.5", correctieMotivering: "drukke weg; nieuwe keuken" }));
    const kaart = Object.fromEntries(rijen);
    expect(kaart["Gewogen nuttige oppervlakte"]).toBe("200 m²");
    expect(kaart["Perceeloppervlakte"]).toBe("760 m²");
    expect(kaart["Correcties"]).toBe("ligging −5%, staat & afwerking +2,5% — drukke weg; nieuwe keuken");
  });
});
