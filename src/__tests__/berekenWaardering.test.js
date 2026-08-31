// Tests voor de rekenmodule (berekenWaardering) uit App.jsx — zie audit, punt M4: "5.000
// regels, nul geautomatiseerde controle". Deze tests dekken niet elk detail van de
// waarderingsberekening, maar wel de kern-formules en de drie optionele extra's
// (energiecorrectie, meerjaren-DCF, residuele grondwaarde) — precies de plekken waar een
// tikfout in de code stil, zonder enige waarschuwing, tot een verkeerd taxatiebedrag zou leiden.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { berekenWaardering } from "../App.jsx";

// Minimale, geldige basis: elk veld dat berekenWaardering ergens leest, ingevuld met een
// "neutrale" waarde (meestal 0/leeg) zodat een test enkel de velden hoeft te overschrijven die
// voor dát ene aspect van de berekening relevant zijn.
function basisDossier(overrides = {}) {
  return {
    ruimtes: [],
    gemeenschappelijkeDelenOpp: "",
    aandeelDuizendsten: "",
    grondopp: "",
    klasse: "Gewoon huis", // moet overeenkomen met een label uit KLASSEN, zie App.jsx
    gevel: "2",
    abexIndexHuidig: "1000",
    vetOuderdom: "0", vetFrequentie: "0", vetGebruik: "0", vetKwaliteit: "0",
    schijven: [],
    marktMargeOnderPct: "", marktMargeBovenPct: "",
    huurMaand: "",
    yieldVan: "", yieldTot: "", yieldStap: "",
    energiecorrectieActief: false, energiecorrectiePct: "",
    venaleWaarde: "",
    gedwongenFactor: "1",
    dcfMeerjarenActief: false, dcfJaren: "10", dcfExitYieldPct: "",
    dcfHuurgroeiPct: "0", dcfLeegstandPct: "0", dcfDiscontovoetPct: "6",
    residueelActief: false, residueelEindwaarde: "", residueelBouwkost: "",
    residueelBijkomendeKostenPct: "12", residueelWinstmargePct: "15",
    ...overrides,
  };
}

describe("berekenWaardering — oppervlaktes", () => {
  it("telt de oppervlakte van ruimtes en gemeenschappelijke delen correct op", () => {
    const d = basisDossier({
      ruimtes: [{ opp: "10", coeff: "1" }, { opp: "20", coeff: "0.5" }],
      gemeenschappelijkeDelenOpp: "5",
    });
    const calc = berekenWaardering(d);
    expect(calc.totOpp).toBeCloseTo(35); // 10 + 20 + 5
    expect(calc.totOppNaCoeff).toBeCloseTo(25); // (10*1) + (20*0.5) + 5
    expect(calc.ratio).toBeCloseTo(25 / 35);
  });
});

describe("berekenWaardering — venale waarde", () => {
  it("valt terug op de intrinsieke waarde zolang het veld leeg blijft", () => {
    const d = basisDossier({
      ruimtes: [{ opp: "100", coeff: "1" }],
      schijven: [{ opp: "200", prijs: "150" }],
    });
    const calc = berekenWaardering(d);
    expect(calc.venaleWaarde).toBeCloseTo(calc.intrinsiek);
  });

  it("een expliciet ingevulde venale waarde krijgt altijd het laatste woord", () => {
    const d = basisDossier({
      ruimtes: [{ opp: "100", coeff: "1" }],
      schijven: [{ opp: "200", prijs: "150" }],
      venaleWaarde: "300000",
    });
    const calc = berekenWaardering(d);
    expect(calc.venaleWaarde).toBe(300000);
  });

  it("gedwongen verkoopwaarde is de venale waarde vermenigvuldigd met de ingevulde factor", () => {
    const d = basisDossier({ venaleWaarde: "200000", gedwongenFactor: "0.85" });
    const calc = berekenWaardering(d);
    expect(calc.gedwongenVerkoop).toBeCloseTo(200000 * 0.85);
  });
});

describe("berekenWaardering — energiecorrectie (optionele extra)", () => {
  it("telt nergens mee zolang de schatter-expert ze niet aanvinkt", () => {
    const d = basisDossier({
      ruimtes: [{ opp: "100", coeff: "1" }],
      energiecorrectieActief: false,
      energiecorrectiePct: "10", // bewust ingevuld, maar niet actief
    });
    const calc = berekenWaardering(d);
    expect(calc.energiecorrectiePct).toBe(0);
    expect(calc.energiecorrectieBedrag).toBe(0);
    expect(calc.venaleWaarde).toBeCloseTo(calc.intrinsiek);
  });

  it("past het ingevulde percentage toe op de intrinsieke waarde zodra ze actief is", () => {
    const d = basisDossier({
      ruimtes: [{ opp: "100", coeff: "1" }],
      schijven: [{ opp: "200", prijs: "150" }],
      energiecorrectieActief: true,
      energiecorrectiePct: "10",
    });
    const calc = berekenWaardering(d);
    expect(calc.energiecorrectieBedrag).toBeCloseTo(calc.intrinsiek * 0.1);
    // venale waarde (leeg gelaten) volgt automatisch de gecorrigeerde waarde
    expect(calc.venaleWaarde).toBeCloseTo(calc.intrinsiek + calc.energiecorrectieBedrag);
  });
});

describe("berekenWaardering — meerjaren-DCF (optionele extra)", () => {
  it("blijft op nul zolang ze niet actief is, ook met een ingevulde huurprijs", () => {
    const d = basisDossier({ huurMaand: "1000", dcfMeerjarenActief: false });
    const calc = berekenWaardering(d);
    expect(calc.dcfMeerjarenWaarde).toBe(0);
  });

  it("berekent de contante waarde van 1 jaar huur bij de ingevulde discontovoet", () => {
    // jaarhuur = 1000 (maand) * 10 = 10.000 (conform de bestaande Excel-conventie)
    // 1 jaar, geen huurgroei/leegstand, geen exit-yield (yieldVan/yieldTot leeg) → pv = 10.000 / 1,06
    const d = basisDossier({
      huurMaand: "1000",
      dcfMeerjarenActief: true,
      dcfJaren: "1",
      dcfHuurgroeiPct: "0",
      dcfLeegstandPct: "0",
      dcfDiscontovoetPct: "6",
    });
    const calc = berekenWaardering(d);
    expect(calc.dcfMeerjarenWaarde).toBeCloseTo(10000 / 1.06, 2);
  });

  it("leegstand vermindert de contante waarde evenredig", () => {
    const zonderLeegstand = berekenWaardering(basisDossier({
      huurMaand: "1000", dcfMeerjarenActief: true, dcfJaren: "1",
      dcfHuurgroeiPct: "0", dcfLeegstandPct: "0", dcfDiscontovoetPct: "6",
    }));
    const metLeegstand = berekenWaardering(basisDossier({
      huurMaand: "1000", dcfMeerjarenActief: true, dcfJaren: "1",
      dcfHuurgroeiPct: "0", dcfLeegstandPct: "10", dcfDiscontovoetPct: "6",
    }));
    expect(metLeegstand.dcfMeerjarenWaarde).toBeCloseTo(zonderLeegstand.dcfMeerjarenWaarde * 0.9, 2);
  });
});

describe("berekenWaardering — residuele grondwaarde (optionele extra)", () => {
  it("blijft op nul zolang ze niet actief is", () => {
    const d = basisDossier({
      residueelActief: false,
      residueelEindwaarde: "300000", residueelBouwkost: "150000",
    });
    expect(berekenWaardering(d).residueleGrondwaarde).toBe(0);
  });

  it("trekt bouwkost, bijkomende kosten en winstmarge af van de eindwaarde", () => {
    const d = basisDossier({
      residueelActief: true,
      residueelEindwaarde: "300000",
      residueelBouwkost: "150000",
      residueelBijkomendeKostenPct: "12", // 12% van 150.000 = 18.000
      residueelWinstmargePct: "15", // 15% van 300.000 = 45.000
    });
    // 300.000 - 150.000 - 18.000 - 45.000 = 87.000
    expect(berekenWaardering(d).residueleGrondwaarde).toBeCloseTo(87000);
  });
});
