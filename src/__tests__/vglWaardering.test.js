// Tests voor de waardering volgens de vergelijkende methode (domein/vglWaardering.js) en de
// inpassing ervan in de venale waarde en het verslag (domein/waardering.js). Verzonnen gegevens.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { berekenVergelijkendeWaarde, grondwaardeVolgensSchijven, analytischVoorstel, onderwerpVoorVergelijking } from "../domein/vglWaardering.js";
import { berekenWaardering, rapportWaarderingsBlokken, rapportVenaleWaardeZin, rapportVergelijkingspuntRijen } from "../domein/waardering.js";
import { initialData } from "../constants.js";

const punt = (o = {}) => ({ id: o.id || Math.random().toString(36).slice(2), adres: "Proefstraat 1", belastbareGrondslag: "450000", nuttigeOpp: "200", grondOpp: "800", datumTransactie: "2025-09-30", weging: "1", ...o });
// grondschijven van het te schatten goed: 500 m² bouwgrond aan € 300/m² + 300 m² tuin aan € 40/m²
const SCHIJVEN = [{ opp: "500", prijs: "300" }, { opp: "300", prijs: "40" }];
const pand = (punten, o = {}) => ({ pandType: "Woning", grondopp: "800", schijven: SCHIJVEN, referentiedatum: "2026-09-30", vergelijkingspunten: punten, ...o });
const ctx = (o = {}) => ({ onderwerpOpp: 180, intrinsiek: 0, ...o });

describe("grondwaardeVolgensSchijven", () => {
  const s = [{ opp: 500, prijs: 300 }, { opp: 300, prijs: 40 }];
  it("waardeert een perceel schijf per schijf, en grond voorbij de laatste schijf aan de laatste prijs", () => {
    expect(grondwaardeVolgensSchijven(300, s)).toBe(90000);
    expect(grondwaardeVolgensSchijven(800, s)).toBe(162000);
    expect(grondwaardeVolgensSchijven(1400, s)).toBe(186000); // 500 × 300 + 900 × 40
    expect(grondwaardeVolgensSchijven(800, s, 1.12)).toBeCloseTo(181440, 6);
    expect(grondwaardeVolgensSchijven(800, [])).toBeNull();
  });
});

describe("voorstel per vergelijkingspunt (analytisch: grond + gebouw)", () => {
  it("trekt de grond af volgens de grondschijven, rekent de gebouwwaarde per m² om en telt de grond van het te schatten goed bij", () => {
    const v = berekenVergelijkendeWaarde(pand([punt({ belastbareGrondslag: "450000", nuttigeOpp: "200", grondOpp: "800" })]), ctx());
    const p = v.punten[0];
    expect(p.grondVgl).toBe(162000);
    expect(p.gebouwVgl).toBe(288000);
    expect(p.gebouwPerM2).toBe(1440);
    expect(p.gebouwOnderwerp).toBe(259200);
    expect(p.grondOnderwerp).toBe(162000);
    expect(p.voorstel).toBe(421200);
  });

  it("verrekent een groter of kleiner perceel via de schijven, zonder de grond mee te schalen met de oppervlakte", () => {
    const groot = berekenVergelijkendeWaarde(pand([punt({ grondOpp: "1400" })]), ctx()).punten[0];
    expect(groot.grondVgl).toBe(186000);
    expect(groot.voorstel).toBeCloseTo((450000 - 186000) / 200 * 180 + 162000, 6); // 399.600
    const klein = berekenVergelijkendeWaarde(pand([punt({ belastbareGrondslag: "400000", nuttigeOpp: "180", grondOpp: "600" })]), ctx()).punten[0];
    expect(klein.voorstel).toBeCloseTo(400000 - 154000 + 162000, 6); // zelfde oppervlakte: 408.000
  });

  it("neemt het gewogen gemiddelde van de voorstellen als vergelijkende waarde", () => {
    const v = berekenVergelijkendeWaarde(pand([
      punt({}), punt({ grondOpp: "1400" }), punt({ belastbareGrondslag: "400000", nuttigeOpp: "180", grondOpp: "600" }),
    ]), ctx());
    expect(v.aantal).toBe(3);
    expect(v.waarde).toBeCloseTo((421200 + 399600 + 408000) / 3, 6);
    expect(v.mediaan).toBeCloseTo(408000, 6);
    expect(v.min).toBeCloseTo(399600, 6);
    expect(v.max).toBeCloseTo(421200, 6);
    expect(v.volwaardig).toBe(true);
  });

  it("past vetusteit en staat toe op het gebouwdeel, ligging en overige op het geheel", () => {
    const p = berekenVergelijkendeWaarde(pand([punt({ correctieVetusteit: "10", correctieStaat: "-5", correctieLigging: "5", correctieMotivering: "x" })]), ctx()).punten[0];
    expect(p.gebouwCorrPct).toBe(5);
    expect(p.totaalCorrPct).toBe(5);
    expect(p.gebouwOnderwerpNaCorr).toBeCloseTo(259200 * 1.05, 6);
    expect(p.voorstel).toBeCloseTo((259200 * 1.05 + 162000) * 1.05, 6);
    expect(p.voorstelZonderCorrecties).toBe(421200);
  });

  it("vraagt om een motivering bij een correctie", () => {
    const p = berekenVergelijkendeWaarde(pand([punt({ correctieVetusteit: "10" })]), ctx()).punten[0];
    expect(p.opmerkingen).toContain("correctie zonder motivering");
  });

  it("past optioneel een jaarlijkse marktevolutie toe op de prijs", () => {
    const p = berekenVergelijkendeWaarde(pand([punt({ datumTransactie: "2025-09-30" })], { vglMarktevolutiePct: "3" }), ctx()).punten[0];
    expect(p.prijsNaTijd).toBeCloseTo(450000 * 1.03, 6);
    expect(p.voorstel).toBeCloseTo((450000 * 1.03 - 162000) / 200 * 180 + 162000, 6);
  });

  it("veronderstelt dezelfde grond als het te schatten goed wanneer het perceel van het VGL-punt onbekend is", () => {
    const p = berekenVergelijkendeWaarde(pand([punt({ grondOpp: "" })]), ctx()).punten[0];
    expect(p.grondVgl).toBe(162000);
    expect(p.opmerkingen.some((o) => o.includes("perceeloppervlakte onbekend"))).toBe(true);
  });

  it("weegt een zeer vergelijkbaar punt dubbel en laat een punt met weging 0 weg", () => {
    const v = berekenVergelijkendeWaarde(pand([
      punt({ weging: "2" }), punt({ grondOpp: "1400", weging: "1" }), punt({ belastbareGrondslag: "900000", weging: "0" }),
    ]), ctx());
    expect(v.aantal).toBe(2);
    expect(v.waarde).toBeCloseTo((421200 * 2 + 399600) / 3, 6);
    expect(v.punten[2].reden).toBe("telt niet mee (weging 0)");
  });

  it("legt uit waarom een punt geen voorstel krijgt", () => {
    const v = berekenVergelijkendeWaarde(pand([
      punt({ nuttigeOpp: "" }), punt({ belastbareGrondslag: "" }), punt({ belastbareGrondslag: "150000", grondOpp: "1000" }),
    ]), ctx());
    expect(v.punten[0].reden).toBe("gewogen nuttige oppervlakte ontbreekt");
    expect(v.punten[1].reden).toBe("geen prijs (belastbare grondslag) ingevuld");
    expect(v.punten[2].reden).toContain("grondwaarde volgens de grondschijven is hoger dan de prijs");
  });

  it("splitst geen grond af zonder grondschijven (met waarschuwing) en nooit bij een appartement", () => {
    const zonder = berekenVergelijkendeWaarde(pand([punt({ belastbareGrondslag: "400000" })], { schijven: [] }), ctx());
    expect(zonder.punten[0].voorstel).toBeCloseTo(400000 / 200 * 180, 6);
    expect(zonder.waarschuwingen.some((w) => w.includes("nog geen grondschijven"))).toBe(true);
    const app = berekenVergelijkendeWaarde(pand([punt({ belastbareGrondslag: "400000" })], { pandType: "Appartement" }), ctx());
    expect(app.punten[0].grondApart).toBe(false);
    expect(app.punten[0].voorstel).toBeCloseTo(360000, 6);
  });

  it("geeft hetzelfde voorstel voor een verkoop uit de Vlabel-lijst vóór het overnemen", () => {
    const o = onderwerpVoorVergelijking(pand([]), ctx({ grondwaardeOnderwerp: 162000 }));
    expect(analytischVoorstel({ prijs: 450000, opp: 200, grond: 800 }, o).voorstel).toBe(421200);
  });
});

describe("waarschuwingen", () => {
  it("noemt het resultaat indicatief bij minder dan 3 punten", () => {
    const v = berekenVergelijkendeWaarde(pand([punt(), punt()]), ctx());
    expect(v.volwaardig).toBe(false);
    expect(v.waarschuwingen.some((w) => w.includes("Slechts 2 bruikbare vergelijkingspunten"))).toBe(true);
  });

  it("waarschuwt bij grote spreiding en duidt een uitschieter aan zonder hem weg te laten", () => {
    const v = berekenVergelijkendeWaarde(pand([punt(), punt({ belastbareGrondslag: "460000" }), punt({ belastbareGrondslag: "700000" })]), ctx());
    expect(v.aantal).toBe(3);
    expect(v.punten[2].uitschieter).toBe(true);
    expect(v.waarschuwingen.some((w) => w.includes("Grote spreiding"))).toBe(true);
  });

  it("vraagt een motivering bij meer dan 15% verschil met de intrinsieke waarde", () => {
    const v = berekenVergelijkendeWaarde(pand([punt(), punt(), punt()]), ctx({ intrinsiek: 351000 })); // 421.200 → +20%
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
    // grond volgens de schijven van het dossier (800 m² × € 200) = dezelfde grondwaarde als in de analytische methode
    expect(calc.vgl.grondOnderwerp).toBe(calc.grondwaarde);
    expect(calc.vgl.punten[0].voorstel).toBeCloseTo((400000 - 160000) / 200 * 180 + 160000, 6);
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
    expect(blokGewoon.motivering).toContain("de grond van elk vergelijkingspunt werd gewaardeerd volgens dezelfde grondschijven");

    const nalatenschap = dossier({ vglWaardeGebruiken: true, reden: "Nalatenschap" });
    const blokNal = rapportWaarderingsBlokken(nalatenschap, berekenWaardering(nalatenschap)).find((b) => b.titel === "Waardering volgens de vergelijkende methode");
    expect(JSON.stringify(blokNal)).toContain("Vergelijkingspunt 1 — Proefstraat 1");
  });

  it("toont gewogen oppervlakte, perceel en correcties bij de VGL-punten in het verslag", () => {
    const rijen = rapportVergelijkingspuntRijen(punt({ nuttigeOpp: "200", grondOpp: "760", correctieLigging: "-5", correctieStaat: "2.5", correctieMotivering: "drukke weg; nieuwe keuken" }));
    const kaart = Object.fromEntries(rijen);
    expect(kaart["Gewogen nuttige oppervlakte"]).toBe("200 m²");
    expect(kaart["Perceeloppervlakte"]).toBe("760 m²");
    expect(kaart["Correcties"]).toBe("staat & afwerking +2,5%, ligging −5% — drukke weg; nieuwe keuken");
  });
});
