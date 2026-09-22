// Tests voor de rekenmodule (berekenWaardering) uit App.jsx — zie audit, punt M4: "5.000
// regels, nul geautomatiseerde controle". Deze tests dekken niet elk detail van de
// waarderingsberekening, maar wel de kern-formules en de drie optionele extra's
// (energiecorrectie, meerjaren-DCF, residuele grondwaarde) — precies de plekken waar een
// tikfout in de code stil, zonder enige waarschuwing, tot een verkeerd taxatiebedrag zou leiden.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { berekenWaardering, berekenParkeerplaatsenTotaal, rapportWaarderingsBlokken } from "../domein/waardering.js";
import { maakLeegPand, initialData } from "../constants.js";
import { buildMultiPandReportData } from "../rapport/bouwers.js";
import { wPara } from "../rapport/html.js";

// Minimale, geldige basis: elk veld dat berekenWaardering ergens leest, ingevuld met een
// "neutrale" waarde (meestal 0/leeg) zodat een test enkel de velden hoeft te overschrijven die
// voor dát ene aspect van de berekening relevant zijn.
function basisDossier(overrides = {}) {
  return {
    ruimtes: [],
    gemeenschappelijkeDelenOpp: "",
    aandeelDuizendsten: "",
    grondopp: "",
    pandType: "Woning",
    klasse: "Gewoon huis", // moet overeenkomen met een label uit KLASSEN, zie App.jsx
    gevel: "2",
    abexIndexHuidig: "1000",
    klasse2: "", klasseMixPct: "50", abexPerM2Override: "",
    grondwaardeMeetellenBijAppartement: true,
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
    grondAandeelGemeenschapActief: false,
    dcfTransactiekostenActief: false, dcfTransactiekostenPct: "",
    // gemeenschappelijkeDelenVuistregelActief telt zelf nergens rechtstreeks mee in
    // berekenWaardering (zie PLANNING.md, functionaliteit 1) — het is een eenmalige knop in
    // StepAfmetingen die gemeenschappelijkeDelenOpp hierboven invult. Toch hier opgenomen zodat
    // basisDossier() de volledige dossiervorm blijft weerspiegelen.
    gemeenschappelijkeDelenVuistregelActief: false,
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

describe("berekenWaardering — vervangingswaarde KMO-vastgoed/Bedrijfsvastgoed", () => {
  it("gebruikt de ABEX-woningindex zolang vastgoedType ontbreekt of 'Residentieel' is (bestaand gedrag, o.a. voor dossiers van vóór deze functionaliteit)", () => {
    const d = basisDossier({ ruimtes: [{ opp: "100", coeff: "1" }] });
    const calc = berekenWaardering(d);
    expect(calc.gebruiktBedrijfsVervangingswaarde).toBe(false);
    expect(calc.actueleWaardeGebouw).toBeGreaterThan(0);
  });

  it("negeert een ingevulde bedrijfsVervangingswaarde zolang vastgoedType 'Residentieel' blijft", () => {
    const d = basisDossier({ ruimtes: [{ opp: "100", coeff: "1" }], vastgoedType: "Residentieel", bedrijfsVervangingswaarde: "500000" });
    const calc = berekenWaardering(d);
    expect(calc.gebruiktBedrijfsVervangingswaarde).toBe(false);
  });

  it("gebruikt de manueel ingevulde vervangingswaarde bij KMO-vastgoed i.p.v. de ABEX-berekening", () => {
    const d = basisDossier({ ruimtes: [{ opp: "1000", coeff: "1" }], vastgoedType: "KMO-vastgoed", bedrijfsVervangingswaarde: "500000" });
    const calc = berekenWaardering(d);
    expect(calc.gebruiktBedrijfsVervangingswaarde).toBe(true);
    expect(calc.actueleWaardeGebouw).toBe(500000);
    expect(calc.nieuwbouwwaarde).toBe(500000);
  });

  it("valt terug op de ABEX-berekening bij Bedrijfsvastgoed zolang de vervangingswaarde nog leeg is", () => {
    const d = basisDossier({ ruimtes: [{ opp: "100", coeff: "1" }], vastgoedType: "Bedrijfsvastgoed", bedrijfsVervangingswaarde: "" });
    const calc = berekenWaardering(d);
    expect(calc.gebruiktBedrijfsVervangingswaarde).toBe(false);
    expect(calc.actueleWaardeGebouw).toBeGreaterThan(0);
  });
});

// Garage/Staanplaats (nieuw vastgoedType, zie StepType/DossierWizard): een sterk vereenvoudigd
// waarderingsmechanisme dat volledig los staat van de ABEX-woningindex, de klasse-mix en de
// bedrijfsmatige vervangingswaarde — de schatter kiest zelf tussen "Aantal × prijs per stuk" en
// "Prijs per m² × oppervlakte" (per dossier verschillend, zie de AskUserQuestion-keuze).
describe("berekenWaardering — Garage/Staanplaats (nieuw vastgoedType)", () => {
  it("methode 'Aantal × prijs per stuk': garageWaarde = aantal × prijsPerStuk, en dit is zowel nieuwbouw- als actuele waarde", () => {
    const d = basisDossier({
      vastgoedType: "Garage / Staanplaats", ruimtes: [],
      garageWaarderingsMethode: "Aantal × prijs per stuk", garageAantal: "3", garagePrijsPerStuk: "9000",
    });
    const calc = berekenWaardering(d);
    expect(calc.isGarageStaanplaats).toBe(true);
    expect(calc.garageMethodeM2).toBe(false);
    expect(calc.garageWaarde).toBeCloseTo(27000); // 3 × 9.000
    expect(calc.nieuwbouwwaarde).toBeCloseTo(27000);
    expect(calc.actueleWaardeGebouw).toBeCloseTo(27000);
    expect(calc.gebruiktBedrijfsVervangingswaarde).toBe(false);
  });

  it("methode 'Prijs per m² × oppervlakte': garageWaarde = prijsPerM2 × totOppNaCoeff (uit de ruimtes-tabel)", () => {
    const d = basisDossier({
      vastgoedType: "Garage / Staanplaats", ruimtes: [{ opp: "18", coeff: "1" }],
      garageWaarderingsMethode: "Prijs per m² × oppervlakte", garagePrijsPerM2: "500",
    });
    const calc = berekenWaardering(d);
    expect(calc.garageMethodeM2).toBe(true);
    expect(calc.totOppNaCoeff).toBeCloseTo(18);
    expect(calc.garageWaarde).toBeCloseTo(9000); // 18 × 500
    expect(calc.nieuwbouwwaarde).toBeCloseTo(9000);
    expect(calc.actueleWaardeGebouw).toBeCloseTo(9000);
  });

  it("negeert ABEX/klasse en een eventuele bedrijfsVervangingswaarde volledig zolang vastgoedType 'Garage / Staanplaats' is", () => {
    const d = basisDossier({
      vastgoedType: "Garage / Staanplaats", klasse: "Luxueus", gevel: "4", abexIndexHuidig: "5000",
      bedrijfsVervangingswaarde: "999999", // zou bij KMO/Bedrijfsvastgoed wél meetellen — hier niet
      garageWaarderingsMethode: "Aantal × prijs per stuk", garageAantal: "1", garagePrijsPerStuk: "12000",
    });
    const calc = berekenWaardering(d);
    expect(calc.garageWaarde).toBeCloseTo(12000);
    expect(calc.nieuwbouwwaarde).toBeCloseTo(12000);
    expect(calc.gebruiktBedrijfsVervangingswaarde).toBe(false);
  });

  it("controlePunten: meldt een garage-specifieke check en slaat de generieke oppervlakte-/grond-/ABEX-checks over", () => {
    const dLeeg = basisDossier({
      vastgoedType: "Garage / Staanplaats", ruimtes: [],
      garageWaarderingsMethode: "Aantal × prijs per stuk", garageAantal: "1", garagePrijsPerStuk: "",
    });
    const calcLeeg = berekenWaardering(dLeeg);
    expect(calcLeeg.controlePunten).toContain("waarde garage/staanplaats is nog niet ingevuld");
    expect(calcLeeg.controlePunten).not.toContain("geen enkele ruimte met oppervlakte ingevuld");
    expect(calcLeeg.controlePunten).not.toContain("oppervlakte na coëfficiënten is 0");
    expect(calcLeeg.controlePunten).not.toContain("grondoppervlakte ontbreekt");
    expect(calcLeeg.controlePunten).not.toContain("klasse/gevel leveren geen ABEX-waarde per m² op");

    const dIngevuld = basisDossier({
      vastgoedType: "Garage / Staanplaats", ruimtes: [],
      garageWaarderingsMethode: "Aantal × prijs per stuk", garageAantal: "1", garagePrijsPerStuk: "5000",
    });
    expect(berekenWaardering(dIngevuld).controlePunten).not.toContain("waarde garage/staanplaats is nog niet ingevuld");
  });

  it("laat andere vastgoedTypes volledig ongemoeid (regressie): isGarageStaanplaats/garageWaarde blijven false/0", () => {
    const d = basisDossier({ ruimtes: [{ opp: "100", coeff: "1" }], vastgoedType: "Residentieel" });
    const calc = berekenWaardering(d);
    expect(calc.isGarageStaanplaats).toBe(false);
    expect(calc.garageWaarde).toBe(0);
    expect(calc.nieuwbouwwaarde).toBeGreaterThan(0); // ongewijzigd ABEX-pad
  });
});

describe("rapportWaarderingsBlokken — Garage/Staanplaats", () => {
  it("toont Methode + Prijs per m²/Oppervlakte + Waarde bij de m²-methode, zonder Klasse/Gevel/Abex/Vetusiteit-rijen", () => {
    const d = basisDossier({
      vastgoedType: "Garage / Staanplaats", ruimtes: [{ opp: "20", coeff: "1" }],
      garageWaarderingsMethode: "Prijs per m² × oppervlakte", garagePrijsPerM2: "600",
    });
    const calc = berekenWaardering(d);
    const blokken = rapportWaarderingsBlokken(d, calc);
    expect(blokken[0].titel).toBe("Waardering garage/staanplaats");
    const labels = blokken[0].rijen.map((r) => r[0]).join("|");
    expect(labels).toContain("Methode");
    expect(labels).toContain("Prijs per m²");
    expect(labels).toContain("Oppervlakte");
    expect(labels).toContain("Waarde garage/staanplaats");
    expect(labels).not.toContain("Klasse");
    expect(labels).not.toContain("Gevel");
    expect(labels).not.toContain("Abex");
    expect(labels).not.toContain("vetusiteit");
  });

  it("toont Methode + Aantal/Prijs per stuk + Waarde bij de stuks-methode", () => {
    const d = basisDossier({
      vastgoedType: "Garage / Staanplaats", ruimtes: [],
      garageWaarderingsMethode: "Aantal × prijs per stuk", garageAantal: "2", garagePrijsPerStuk: "7500",
    });
    const calc = berekenWaardering(d);
    const blokken = rapportWaarderingsBlokken(d, calc);
    const labels = blokken[0].rijen.map((r) => r[0]).join("|");
    expect(labels).toContain("Aantal");
    expect(labels).toContain("Prijs per stuk");
    expect(labels).not.toContain("Prijs per m²");
  });

  it("laat het residentiële/bedrijfsmatige blok ongewijzigd (regressie)", () => {
    const dResidentieel = basisDossier({ ruimtes: [{ opp: "100", coeff: "1" }], vastgoedType: "Residentieel", klasse: "Gewoon huis" });
    const calcResidentieel = berekenWaardering(dResidentieel);
    const blokkenResidentieel = rapportWaarderingsBlokken(dResidentieel, calcResidentieel);
    expect(blokkenResidentieel[0].titel).toBe("Waardering op basis van vervangingswaarde");
    expect(blokkenResidentieel[0].rijen.map((r) => r[0]).join("|")).toContain("Klasse");

    const dKmo = basisDossier({ ruimtes: [{ opp: "100", coeff: "1" }], vastgoedType: "KMO-vastgoed", bedrijfsVervangingswaarde: "300000" });
    const calcKmo = berekenWaardering(dKmo);
    const blokkenKmo = rapportWaarderingsBlokken(dKmo, calcKmo);
    expect(blokkenKmo[0].rijen.map((r) => r[0]).join("|")).toContain("Vervangingswaarde (manueel ingeschat)");
  });
});

describe("berekenWaardering — Abex klasse-mix en manuele override (optionele extra's)", () => {
  it("gebruikt enkel de basis1998 van de geselecteerde klasse zolang klasse2 leeg blijft (bestaand gedrag)", () => {
    const dZonderMix = basisDossier({ klasse: "Gewoon huis", klasse2: "" });
    const dMetOntbrekendVeld = basisDossier({ klasse: "Gewoon huis" }); // klasse2 niet meegegeven, zoals een dossier van vóór deze functionaliteit
    delete dMetOntbrekendVeld.klasse2;
    const calcZonderMix = berekenWaardering(dZonderMix);
    const calcOntbrekend = berekenWaardering(dMetOntbrekendVeld);
    expect(calcZonderMix.klasseObj2).toBeNull();
    expect(calcOntbrekend.klasseObj2).toBeNull();
    expect(calcOntbrekend.abexPerM2).toBeCloseTo(calcZonderMix.abexPerM2);
  });

  it("mengt twee klassen naar verhouding (klasseMixPct = gewicht van klasse2)", () => {
    // "Gewoon huis" (660) en "Verzorgd / comfortabel" (740) op 2-gevel, Abex-index 1000 (= ABEX_INDEX_1998 * 1000/475 vereenvoudigd hieronder)
    // basis1998-waarden herijkt op de KAVEX/FEBEVEX-basistabellen juli 2022 (basis 954) — zie constants.js/KLASSEN.
    const dEnkel1 = basisDossier({ klasse: "Gewoon huis", klasse2: "" });
    const d40pct = basisDossier({ klasse: "Gewoon huis", klasse2: "Verzorgd / comfortabel", klasseMixPct: "40" });
    const calcEnkel1 = berekenWaardering(dEnkel1);
    const calc40 = berekenWaardering(d40pct);
    expect(calc40.klasseObj2).not.toBeNull();
    expect(calc40.klasseMixPct).toBe(40);
    // verwacht: 60% "Gewoon huis" (660) + 40% "Verzorgd / comfortabel" (740) = 692 als basis1998,
    // dus de Abex-waarde/m² schaalt exact evenredig t.o.v. de niet-gemengde (enkel klasse 1) waarde.
    const verwachteFactor = (660 * 0.6 + 740 * 0.4) / 660;
    expect(calc40.abexPerM2).toBeCloseTo(calcEnkel1.abexPerM2 * verwachteFactor, 5);
  });

  it("een mengverhouding van 50/50 zonder klasseMixPct valt terug op een gelijke verdeling (standaardwaarde)", () => {
    const d = basisDossier({ klasse: "Gewoon huis", klasse2: "Luxueus" });
    delete d.klasseMixPct; // simuleert een dossier waar dit veld nog ontbreekt
    const calc = berekenWaardering(d);
    const dEnkel1 = basisDossier({ klasse: "Gewoon huis", klasse2: "" });
    const calcEnkel1 = berekenWaardering(dEnkel1);
    // basis1998: "Gewoon huis" 660, "Luxueus" 821 (KAVEX-herijking juli 2022, basis 954 — zie constants.js/KLASSEN).
    const verwachteFactor = (660 * 0.5 + 821 * 0.5) / 660;
    expect(calc.abexPerM2).toBeCloseTo(calcEnkel1.abexPerM2 * verwachteFactor, 5);
  });

  it("begrenst een klasseMixPct buiten [0, 100] naar de dichtstbijzijnde grens", () => {
    const dTeHoog = basisDossier({ klasse: "Gewoon huis", klasse2: "Luxueus", klasseMixPct: "150" });
    const dTeLaag = basisDossier({ klasse: "Gewoon huis", klasse2: "Luxueus", klasseMixPct: "-20" });
    expect(berekenWaardering(dTeHoog).klasseMixPct).toBe(100);
    expect(berekenWaardering(dTeLaag).klasseMixPct).toBe(0);
  });

  it("een manuele abexPerM2Override overschrijft de tabel/mix volledig, maar vetusiteit blijft verrekend", () => {
    const dZonderOverride = basisDossier({
      ruimtes: [{ opp: "100", coeff: "1" }], klasse: "Gewoon huis",
      vetOuderdom: "20", vetFrequentie: "20", vetGebruik: "20", vetKwaliteit: "20",
    });
    const dMetOverride = basisDossier({
      ruimtes: [{ opp: "100", coeff: "1" }], klasse: "Gewoon huis", abexPerM2Override: "800",
      vetOuderdom: "20", vetFrequentie: "20", vetGebruik: "20", vetKwaliteit: "20",
    });
    const calcZonder = berekenWaardering(dZonderOverride);
    const calcMet = berekenWaardering(dMetOverride);
    expect(calcMet.abexPerM2).toBe(800);
    expect(calcMet.abexPerM2).not.toBeCloseTo(calcZonder.abexPerM2);
    // vetusiteit blijft verrekend bovenop de override: nieuwbouwwaarde = 800 * 100 = 80.000.
    // Vetusiteit = SOM van de vier factoren (20+20+20+20 = 80%), niet het gemiddelde (zie
    // berekenWaardering): actuele waarde na 80% vetusiteit = 80.000 * (1 - 0.8) = 16.000.
    expect(calcMet.nieuwbouwwaarde).toBeCloseTo(80000);
    expect(calcMet.actueleWaardeGebouw).toBeCloseTo(16000);
  });

  it("een lege abexPerM2Override (of ontbrekend veld) laat de tabel/mix ongemoeid (bestaand gedrag)", () => {
    const dLeeg = basisDossier({ klasse: "Gewoon huis", abexPerM2Override: "" });
    const dOntbrekend = basisDossier({ klasse: "Gewoon huis" });
    delete dOntbrekend.abexPerM2Override;
    const dReferentie = basisDossier({ klasse: "Gewoon huis" });
    const calcLeeg = berekenWaardering(dLeeg);
    const calcOntbrekend = berekenWaardering(dOntbrekend);
    const calcReferentie = berekenWaardering(dReferentie);
    expect(calcLeeg.abexPerM2).toBeCloseTo(calcReferentie.abexPerM2);
    expect(calcOntbrekend.abexPerM2).toBeCloseTo(calcReferentie.abexPerM2);
  });
});

describe("berekenWaardering — vetusiteit: som van de vier factoren (klassieke additieve methode)", () => {
  it("telt de vier vetusiteitsfactoren OP i.p.v. het gemiddelde te nemen", () => {
    const d = basisDossier({
      klasse: "Gewoon huis", abexPerM2Override: "1000", ruimtes: [{ opp: "100", coeff: "1" }],
      vetOuderdom: "10", vetFrequentie: "10", vetGebruik: "10", vetKwaliteit: "10",
    });
    const calc = berekenWaardering(d);
    // som = 10+10+10+10 = 40% (NIET het gemiddelde, dat 10% zou zijn)
    expect(calc.totaalVetusiteit).toBeCloseTo(40);
    expect(calc.nieuwbouwwaarde).toBeCloseTo(100000);
    // actuele waarde na 40% vetusiteit = 100.000 * (1 - 0.4) = 60.000 — bij het (foutieve)
    // gemiddelde van 10% zou dit 90.000 zijn geweest.
    expect(calc.actueleWaardeGebouw).toBeCloseTo(60000);
  });

  it("verschillende, ongelijke deelfactoren tellen elk volledig mee (geen onderlinge compensatie)", () => {
    // een pand dat slecht onderhouden is (hoge score) mag NIET gecompenseerd worden door bv. een
    // lage ouderdomsscore — dat is precies waarom optellen i.p.v. middelen wordt gebruikt.
    const d = basisDossier({
      klasse: "Gewoon huis", abexPerM2Override: "1000", ruimtes: [{ opp: "100", coeff: "1" }],
      vetOuderdom: "15", vetFrequentie: "5", vetGebruik: "0", vetKwaliteit: "10",
    });
    const calc = berekenWaardering(d);
    expect(calc.totaalVetusiteit).toBeCloseTo(30);
    expect(calc.actueleWaardeGebouw).toBeCloseTo(100000 * 0.7);
  });

  it("begrenst de totale vetusiteit op 100% (nooit een negatieve actuele waarde)", () => {
    const d = basisDossier({
      klasse: "Gewoon huis", abexPerM2Override: "1000", ruimtes: [{ opp: "100", coeff: "1" }],
      vetOuderdom: "50", vetFrequentie: "50", vetGebruik: "50", vetKwaliteit: "50",
    });
    const calc = berekenWaardering(d);
    // ruwe som zou 200% zijn — begrensd op 100%
    expect(calc.totaalVetusiteit).toBe(100);
    expect(calc.actueleWaardeGebouw).toBeCloseTo(0);
  });

  it("geen vetusiteit ingevuld (alles 0) verandert niets (bestaand gedrag, regressietest)", () => {
    const d = basisDossier({ klasse: "Gewoon huis", abexPerM2Override: "1000", ruimtes: [{ opp: "100", coeff: "1" }] });
    const calc = berekenWaardering(d);
    expect(calc.totaalVetusiteit).toBe(0);
    expect(calc.actueleWaardeGebouw).toBeCloseTo(100000);
  });

  it('vetusteitMethode ontbrekend (dossier van vóór deze functionaliteit) gedraagt zich als "Optellen"', () => {
    const dZonderVeld = basisDossier({
      klasse: "Gewoon huis", abexPerM2Override: "1000", ruimtes: [{ opp: "100", coeff: "1" }],
      vetOuderdom: "10", vetFrequentie: "10", vetGebruik: "10", vetKwaliteit: "10",
    });
    delete dZonderVeld.vetusteitMethode;
    const dExpliciet = basisDossier({
      klasse: "Gewoon huis", abexPerM2Override: "1000", ruimtes: [{ opp: "100", coeff: "1" }],
      vetOuderdom: "10", vetFrequentie: "10", vetGebruik: "10", vetKwaliteit: "10",
      vetusteitMethode: "Optellen",
    });
    const calcZonder = berekenWaardering(dZonderVeld);
    const calcExpliciet = berekenWaardering(dExpliciet);
    expect(calcZonder.vetusteitMethode).toBe("Optellen");
    expect(calcZonder.totaalVetusiteit).toBeCloseTo(calcExpliciet.totaalVetusiteit);
    expect(calcZonder.actueleWaardeGebouw).toBeCloseTo(calcExpliciet.actueleWaardeGebouw);
  });

  it('vetusteitMethode "Gemiddelde" deelt de som door 4 i.p.v. te begrenzen op 100%', () => {
    const d = basisDossier({
      klasse: "Gewoon huis", abexPerM2Override: "1000", ruimtes: [{ opp: "100", coeff: "1" }],
      vetusteitMethode: "Gemiddelde",
      vetOuderdom: "10", vetFrequentie: "10", vetGebruik: "10", vetKwaliteit: "10",
    });
    const calc = berekenWaardering(d);
    // (10+10+10+10) / 4 = 10% — bij "Optellen" zou dit 40% zijn (zie de eerste test hierboven)
    expect(calc.totaalVetusiteit).toBeCloseTo(10);
    expect(calc.actueleWaardeGebouw).toBeCloseTo(90000);
  });

  it('vetusteitMethode "Gemiddelde" heeft geen 100%-grens nodig (het gemiddelde blijft vanzelf binnen [0, 100])', () => {
    const d = basisDossier({
      klasse: "Gewoon huis", abexPerM2Override: "1000", ruimtes: [{ opp: "100", coeff: "1" }],
      vetusteitMethode: "Gemiddelde",
      vetOuderdom: "50", vetFrequentie: "50", vetGebruik: "50", vetKwaliteit: "50",
    });
    const calc = berekenWaardering(d);
    // (50+50+50+50) / 4 = 50% — bij "Optellen" zou dit begrensd worden op 100% (zie hierboven)
    expect(calc.totaalVetusiteit).toBe(50);
    expect(calc.actueleWaardeGebouw).toBeCloseTo(50000);
  });

  it('rapportWaarderingsBlokken toont het rijlabel passend bij de gekozen methode', () => {
    const dOptellen = basisDossier({
      klasse: "Gewoon huis", abexPerM2Override: "1000", ruimtes: [{ opp: "100", coeff: "1" }],
      vetusteitMethode: "Optellen", vetOuderdom: "10", vetFrequentie: "10", vetGebruik: "10", vetKwaliteit: "10",
    });
    const dGemiddelde = basisDossier({
      klasse: "Gewoon huis", abexPerM2Override: "1000", ruimtes: [{ opp: "100", coeff: "1" }],
      vetusteitMethode: "Gemiddelde", vetOuderdom: "10", vetFrequentie: "10", vetGebruik: "10", vetKwaliteit: "10",
    });
    const calcOptellen = berekenWaardering(dOptellen);
    const calcGemiddelde = berekenWaardering(dGemiddelde);
    const blokkenOptellen = rapportWaarderingsBlokken(dOptellen, calcOptellen);
    const blokkenGemiddelde = rapportWaarderingsBlokken(dGemiddelde, calcGemiddelde);
    const rijOptellen = blokkenOptellen.flatMap((b) => b.rijen).find((r) => r[0].includes("vetusteit"));
    const rijGemiddelde = blokkenGemiddelde.flatMap((b) => b.rijen).find((r) => r[0].includes("vetusteit"));
    expect(rijOptellen[0]).toBe("Totale vetusteit");
    expect(rijGemiddelde[0]).toBe("Gemiddelde vetusteit");
  });
});

describe("berekenWaardering — nieuwbouwprijzen-tabel appartementen (optionele extra)", () => {
  it("gebruikt de directe waardePerM2Nieuwbouw, zonder Abex-index-schaling en zonder gevelfactor", () => {
    const d = basisDossier({
      pandType: "Appartement", klasse: "Gewoon appartement (nieuwbouwprijzen)",
      gevel: "4", abexIndexHuidig: "2500", // beide zouden bij de klassieke tabel het resultaat wél beïnvloeden
    });
    const calc = berekenWaardering(d);
    expect(calc.isNieuwbouwtabel).toBe(true);
    expect(calc.abexPerM2).toBe(3156);
    expect(calc.gevelFactor).toBe(1);
  });

  it("mengt twee nieuwbouwprijzen-klassen naar verhouding, net als bij de klassieke tabel", () => {
    const d = basisDossier({
      pandType: "Appartement", klasse: "Bescheiden appartement (nieuwbouwprijzen)",
      klasse2: "Luxueus appartement (nieuwbouwprijzen)", klasseMixPct: "40",
    });
    const calc = berekenWaardering(d);
    // 60% × 2678 + 40% × 4750 = 3506,8
    expect(calc.abexPerM2).toBeCloseTo(2678 * 0.6 + 4750 * 0.4, 5);
  });

  it("laat de klassieke Abex-appartementsklassen (basis1998) ongewijzigd, inclusief gevelfactor en indexschaling", () => {
    const d = basisDossier({ pandType: "Appartement", klasse: "Gewoon appartement", gevel: "3", abexIndexHuidig: "1000" });
    const calc = berekenWaardering(d);
    expect(calc.isNieuwbouwtabel).toBe(false);
    // basis1998 (821 — KAVEX-herijking juli 2022, basis 954, zie constants.js/KLASSEN) * gevelfactor 3-gevel (1.1) / 475 * 1000
    expect(calc.abexPerM2).toBeCloseTo((821 * 1.1) / 475 * 1000, 5);
  });

  it("telt de grondwaarde per schijf standaard nog mee bij een appartement (backward-compat, veld ontbreekt of staat aan)", () => {
    const dOntbrekend = basisDossier({
      pandType: "Appartement", klasse: "Gewoon appartement (nieuwbouwprijzen)",
      ruimtes: [{ opp: "80", coeff: "1" }], schijven: [{ opp: "10", prijs: "100" }],
    });
    delete dOntbrekend.grondwaardeMeetellenBijAppartement;
    const dExplicietAan = basisDossier({
      pandType: "Appartement", klasse: "Gewoon appartement (nieuwbouwprijzen)",
      ruimtes: [{ opp: "80", coeff: "1" }], schijven: [{ opp: "10", prijs: "100" }],
      grondwaardeMeetellenBijAppartement: true,
    });
    expect(berekenWaardering(dOntbrekend).grondwaardeMeetellen).toBe(true);
    expect(berekenWaardering(dOntbrekend).grondwaarde).toBeCloseTo(1000);
    expect(berekenWaardering(dExplicietAan).grondwaarde).toBeCloseTo(1000);
  });

  it("sluit de grondwaarde per schijf uit de intrinsieke waarde zodra ze bij een appartement expliciet uitgezet wordt", () => {
    const d = basisDossier({
      pandType: "Appartement", klasse: "Gewoon appartement (nieuwbouwprijzen)",
      ruimtes: [{ opp: "80", coeff: "1" }], schijven: [{ opp: "10", prijs: "100" }],
      grondwaardeMeetellenBijAppartement: false,
    });
    const calc = berekenWaardering(d);
    expect(calc.grondwaardeMeetellen).toBe(false);
    expect(calc.grondwaarde).toBe(0);
    // intrinsiek = actueleWaardeGebouw + grondwaarde(0) = enkel het gebouw
    expect(calc.intrinsiek).toBeCloseTo(calc.actueleWaardeGebouw);
  });

  it("negeert grondwaardeMeetellenBijAppartement=false bij een woning — de grondwaarde blijft daar onvoorwaardelijk meetellen", () => {
    const d = basisDossier({
      pandType: "Woning", klasse: "Gewoon huis",
      ruimtes: [{ opp: "80", coeff: "1" }], schijven: [{ opp: "10", prijs: "100" }],
      grondwaardeMeetellenBijAppartement: false,
    });
    const calc = berekenWaardering(d);
    expect(calc.grondwaardeMeetellen).toBe(true);
    expect(calc.grondwaarde).toBeCloseTo(1000);
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

describe("berekenWaardering — grond: aandeel gemeenschap (+12%, optionele extra)", () => {
  it("grondwaarde blijft gelijk aan de basis (som van de schijven) zolang ze niet actief is", () => {
    const d = basisDossier({
      schijven: [{ opp: "100", prijs: "200" }], // basis: 100 × 200 = 20.000
      grondAandeelGemeenschapActief: false,
    });
    const calc = berekenWaardering(d);
    expect(calc.grondwaardeBasis).toBeCloseTo(20000);
    expect(calc.grondAandeelGemeenschapBedrag).toBe(0);
    expect(calc.grondwaarde).toBeCloseTo(20000);
  });

  it("telt 12% van de basis bij de grondwaarde op zodra ze actief is — en werkt door in de intrinsieke waarde", () => {
    const d = basisDossier({
      schijven: [{ opp: "100", prijs: "200" }], // basis: 20.000, +12% = 2.400
      grondAandeelGemeenschapActief: true,
    });
    const calc = berekenWaardering(d);
    expect(calc.grondwaardeBasis).toBeCloseTo(20000);
    expect(calc.grondAandeelGemeenschapBedrag).toBeCloseTo(2400);
    expect(calc.grondwaarde).toBeCloseTo(22400);
    // grondwaarde telt mee in de intrinsieke waarde (actueleWaardeGebouw + grondwaarde)
    expect(calc.intrinsiek).toBeCloseTo(calc.actueleWaardeGebouw + 22400);
  });
});

describe("berekenWaardering — DCF-transactiekosten (optionele extra)", () => {
  it("blijft op nul zolang ze niet actief is, ook met een ingevuld percentage", () => {
    const d = basisDossier({
      huurMaand: "1000",
      yieldVan: "10", yieldTot: "10", yieldStap: "1", // één rendementspunt: dcfWaarde = 100.000
      dcfTransactiekostenActief: false,
      dcfTransactiekostenPct: "12", // bewust ingevuld, maar niet actief
    });
    const calc = berekenWaardering(d);
    expect(calc.dcfWaarde).toBeCloseTo(100000);
    expect(calc.dcfTransactiekostenPct).toBe(0);
    expect(calc.dcfTransactiekostenBedrag).toBe(0);
    expect(calc.dcfWaardeNaTransactiekosten).toBeCloseTo(calc.dcfWaarde);
  });

  it("trekt het ingevulde percentage af van de DCF-waarde zodra ze actief is", () => {
    const d = basisDossier({
      huurMaand: "1000",
      yieldVan: "10", yieldTot: "10", yieldStap: "1", // dcfWaarde = 100.000
      dcfTransactiekostenActief: true,
      dcfTransactiekostenPct: "12", // 12% van 100.000 = 12.000
    });
    const calc = berekenWaardering(d);
    expect(calc.dcfWaarde).toBeCloseTo(100000);
    expect(calc.dcfTransactiekostenBedrag).toBeCloseTo(12000);
    expect(calc.dcfWaardeNaTransactiekosten).toBeCloseTo(88000);
  });
});

// DCF meegerekend in de venale waarde (op vraag van de schatter-expert): de voorgestelde venale
// waarde is voortaan het gemiddelde van de intrinsieke waarde (+ energiecorrectie) en de
// samengestelde DCF-waarde (dcfSamengesteld) — maar enkel wanneer er effectief DCF-gegevens zijn
// ingevuld. Alle scenario's hieronder gebruiken enkel "schijven" (grondwaarde) en geen "ruimtes",
// zodat de gebouwwaarde 0 blijft en intrinsiek exact de grondwaarde is — dat maakt de verwachte
// gemiddeldes met de hand na te rekenen.
describe("berekenWaardering — DCF meegerekend in de venale waarde", () => {
  it("telt de directe-kapitalisatie-DCF mee in de voorgestelde venale waarde, als gemiddelde met de intrinsieke waarde", () => {
    const d = basisDossier({
      schijven: [{ opp: "1000", prijs: "140" }], // intrinsiek = 140.000
      huurMaand: "1000", yieldVan: "10", yieldTot: "10", yieldStap: "1", // dcfWaarde = 100.000
    });
    const calc = berekenWaardering(d);
    expect(calc.intrinsiek).toBeCloseTo(140000);
    expect(calc.dcfWaarde).toBeCloseTo(100000);
    expect(calc.dcfSamengesteld).toBeCloseTo(100000);
    expect(calc.voorgesteldeVenaleWaarde).toBeCloseTo(120000); // gemiddelde van 140.000 en 100.000
    expect(calc.venaleWaarde).toBeCloseTo(120000); // veld leeg -> volgt de voorgestelde waarde
  });

  it("telt de meerjaren-DCF mee in de voorgestelde venale waarde, ook zonder ingevulde yield-vork", () => {
    const d = basisDossier({
      schijven: [{ opp: "1000", prijs: "140" }], // intrinsiek = 140.000
      huurMaand: "1000", dcfMeerjarenActief: true, dcfJaren: "1",
      dcfHuurgroeiPct: "0", dcfLeegstandPct: "0", dcfDiscontovoetPct: "6",
    });
    const calc = berekenWaardering(d);
    expect(calc.dcfWaarde).toBe(0); // geen yield van/tot ingevuld
    expect(calc.dcfMeerjarenWaarde).toBeCloseTo(10000 / 1.06, 2);
    expect(calc.dcfSamengesteld).toBeCloseTo(calc.dcfMeerjarenWaarde, 2);
    expect(calc.voorgesteldeVenaleWaarde).toBeCloseTo((140000 + calc.dcfMeerjarenWaarde) / 2, 2);
    expect(calc.venaleWaarde).toBeCloseTo(calc.voorgesteldeVenaleWaarde, 2);
  });

  it("middelt beide DCF-benaderingen eerst samen, vooraleer te mengen met de intrinsieke waarde, wanneer beide aanwezig zijn", () => {
    const d = basisDossier({
      schijven: [{ opp: "1000", prijs: "140" }], // intrinsiek = 140.000
      huurMaand: "1000", yieldVan: "10", yieldTot: "10", yieldStap: "1", // dcfWaarde = 100.000
      dcfMeerjarenActief: true, dcfJaren: "1", dcfHuurgroeiPct: "0", dcfLeegstandPct: "0", dcfDiscontovoetPct: "6",
    });
    const calc = berekenWaardering(d);
    const verwachteDcfSamengesteld = (calc.dcfWaarde + calc.dcfMeerjarenWaarde) / 2;
    expect(calc.dcfSamengesteld).toBeCloseTo(verwachteDcfSamengesteld, 2);
    expect(calc.voorgesteldeVenaleWaarde).toBeCloseTo((calc.intrinsiek + verwachteDcfSamengesteld) / 2, 2);
  });

  it("gebruikt de DCF-waarde ná transactiekosten in de samenstelling, niet de rauwe DCF-waarde", () => {
    const d = basisDossier({
      schijven: [{ opp: "1000", prijs: "140" }], // intrinsiek = 140.000
      huurMaand: "1000", yieldVan: "10", yieldTot: "10", yieldStap: "1", // dcfWaarde = 100.000
      dcfTransactiekostenActief: true, dcfTransactiekostenPct: "12", // dcfWaardeNaTransactiekosten = 88.000
    });
    const calc = berekenWaardering(d);
    expect(calc.dcfWaardeNaTransactiekosten).toBeCloseTo(88000);
    expect(calc.dcfSamengesteld).toBeCloseTo(88000); // niet 100.000
    expect(calc.voorgesteldeVenaleWaarde).toBeCloseTo((140000 + 88000) / 2);
  });

  it("een expliciet ingevulde venale waarde blijft het laatste woord, ook met DCF-gegevens aanwezig", () => {
    const d = basisDossier({
      schijven: [{ opp: "1000", prijs: "140" }],
      huurMaand: "1000", yieldVan: "10", yieldTot: "10", yieldStap: "1",
      venaleWaarde: "500000",
    });
    const calc = berekenWaardering(d);
    expect(calc.dcfSamengesteld).toBeGreaterThan(0);
    expect(calc.venaleWaarde).toBe(500000);
  });

  it("dcfSamengesteld blijft op 0 zonder huurgegevens, en de voorgestelde venale waarde verandert dan niet (regressie)", () => {
    const d = basisDossier({ schijven: [{ opp: "1000", prijs: "140" }] });
    const calc = berekenWaardering(d);
    expect(calc.dcfSamengesteld).toBe(0);
    expect(calc.voorgesteldeVenaleWaarde).toBeCloseTo(calc.intrinsiek);
    expect(calc.venaleWaarde).toBeCloseTo(calc.intrinsiek);
  });
});

// zie ook de toelichting bij berekenParkeerplaatsenTotaal in App.jsx: bewust een eenvoudige,
// zelfstandige optelsom los van berekenWaardering hierboven — deze telt enkel "aantal × waarde
// per stuk" op over de dossierbrede lijst parkeerplaatsen/garages (StepWaardering, meerdere
// panden per dossier).
describe("berekenParkeerplaatsenTotaal", () => {
  it("geeft 0 voor een lege of ontbrekende lijst", () => {
    expect(berekenParkeerplaatsenTotaal([])).toBe(0);
    expect(berekenParkeerplaatsenTotaal(undefined)).toBe(0);
  });

  it("telt aantal × waarde per stuk op over meerdere items", () => {
    const lijst = [
      { type: "Autostaanplaats (buiten)", aantal: "2", waardePerStuk: "8000" },
      { type: "Garage (afgesloten box)", aantal: "1", waardePerStuk: "15000" },
    ];
    // 2 × 8.000 + 1 × 15.000 = 31.000
    expect(berekenParkeerplaatsenTotaal(lijst)).toBeCloseTo(31000);
  });

  it("behandelt een leeg 'aantal' of 'waardePerStuk' als 0, niet als een fout", () => {
    const lijst = [{ type: "Andere", aantal: "", waardePerStuk: "" }];
    expect(berekenParkeerplaatsenTotaal(lijst)).toBe(0);
  });
});

// ----------------------------------------------------------------------------
// Regressietests bij de code-audit van 17/09/2026
// ----------------------------------------------------------------------------
// Een dossier van vóór een bepaalde functionaliteit — en élk extra pand, dat enkel zijn eigen
// ingevulde velden bijhoudt i.p.v. de volledige initialData — mist sleutels volledig. De
// rekenmodule las zo'n ontbrekend veld voorheen als "ingevuld" (d.veld !== "" is waar bij
// undefined) en viel dan terug op num(undefined) = 0 i.p.v. op de bedoelde standaardwaarde.
describe("berekenWaardering — ontbrekende velden vallen terug op de bedoelde standaardwaarde", () => {
  function zonder(velden, overrides = {}) {
    const d = basisDossier(overrides);
    velden.forEach((v) => delete d[v]);
    return d;
  }

  it("marktmarge valt terug op 5%/5% wanneer de velden volledig ontbreken, niet op 0%", () => {
    const calc = berekenWaardering(zonder(["marktMargeOnderPct", "marktMargeBovenPct"], {
      ruimtes: [{ opp: "150", coeff: "1" }],
    }));
    expect(calc.marktMargeOnderPct).toBe(5);
    expect(calc.marktMargeBovenPct).toBe(5);
    expect(calc.marktOnder).toBeCloseTo(calc.intrinsiek * 0.95, 5);
    expect(calc.marktBoven).toBeCloseTo(calc.intrinsiek * 1.05, 5);
  });

  it("venale waarde valt terug op de voorgestelde waarde wanneer het veld ontbreekt, niet op 0", () => {
    const calc = berekenWaardering(zonder(["venaleWaarde"], { ruimtes: [{ opp: "150", coeff: "1" }] }));
    expect(calc.venaleWaarde).toBeGreaterThan(0);
    expect(calc.venaleWaarde).toBeCloseTo(calc.intrinsiek, 5);
  });

  it("KMO-vastgoed zonder ingevulde vervangingswaarde blijft gewoon de ABEX-berekening gebruiken", () => {
    const calc = berekenWaardering(zonder(["bedrijfsVervangingswaarde"], {
      vastgoedType: "KMO-vastgoed", ruimtes: [{ opp: "150", coeff: "1" }],
    }));
    expect(calc.gebruiktBedrijfsVervangingswaarde).toBe(false);
    expect(calc.actueleWaardeGebouw).toBeGreaterThan(0);
  });

  it("meerjaren-DCF behoudt zijn eindwaarde wanneer de exit-yield niet ingevuld is", () => {
    const basis = {
      dcfMeerjarenActief: true, huurMaand: "2000", yieldVan: "3.5", yieldTot: "4.5",
      dcfDiscontovoetPct: "6", dcfJaren: "10",
    };
    const metLeegVeld = berekenWaardering(basisDossier({ ...basis, dcfExitYieldPct: "" }));
    const zonderVeld = berekenWaardering(zonder(["dcfExitYieldPct"], basis));
    expect(zonderVeld.dcfExitYieldPct).toBeCloseTo(4, 5); // (3,5 + 4,5) / 2
    expect(zonderVeld.dcfMeerjarenWaarde).toBeCloseTo(metLeegVeld.dcfMeerjarenWaarde, 5);
    expect(zonderVeld.dcfMeerjarenWaarde).toBeGreaterThan(0);
  });
});

describe("berekenWaardering — klasse-mix met een leeggemaakt mengpercentage", () => {
  it("valt terug op 50/50 i.p.v. de tweede klasse volledig te negeren", () => {
    const calc = berekenWaardering(basisDossier({
      klasse: "Gewoon huis", klasse2: "Luxueus", klasseMixPct: "", ruimtes: [{ opp: "150", coeff: "1" }],
    }));
    expect(calc.klasseMixPct).toBe(50);
    const enkelKlasse1 = berekenWaardering(basisDossier({
      klasse: "Gewoon huis", klasse2: "", ruimtes: [{ opp: "150", coeff: "1" }],
    }));
    expect(calc.abexPerM2).toBeGreaterThan(enkelKlasse1.abexPerM2);
  });
});

describe("berekenWaardering — yield-reeks over een breed bereik", () => {
  it("dekt het volledige bereik i.p.v. de reeks halverwege af te kappen", () => {
    const calc = berekenWaardering(basisDossier({
      huurMaand: "2000", yieldVan: "1", yieldTot: "20", yieldStap: "0.05",
    }));
    expect(calc.yieldRows.length).toBeLessThan(201);
    expect(calc.yieldRows[calc.yieldRows.length - 1].yield).toBeCloseTo(20, 5);
  });

  it("laat een gewoon, smal bereik volledig ongewijzigd (regressie)", () => {
    const calc = berekenWaardering(basisDossier({
      huurMaand: "2000", yieldVan: "3", yieldTot: "6", yieldStap: "0.5",
    }));
    expect(calc.yieldRows.length).toBe(7);
    expect(calc.yieldRows[0].yield).toBeCloseTo(3, 5);
    expect(calc.yieldRows[6].yield).toBeCloseTo(6, 5);
  });
});

describe("berekenWaardering — controlePunten: grondwaarde", () => {
  it("meldt een grondwaarde van 0 ook wanneer de grondoppervlakte wél ingevuld is", () => {
    const calc = berekenWaardering(basisDossier({
      ruimtes: [{ opp: "150", coeff: "1" }], grondopp: "500", schijven: [], venaleWaarde: "300000",
    }));
    expect(calc.grondwaarde).toBe(0);
    expect(calc.controlePunten.join(" | ")).toContain("grondwaarde is nog 0");
    expect(calc.oppCheck).toBe(false);
  });

  it("meldt niets zodra de grondschijven ingevuld zijn (regressie)", () => {
    const calc = berekenWaardering(basisDossier({
      ruimtes: [{ opp: "150", coeff: "1" }], grondopp: "500",
      schijven: [{ opp: "500", prijs: "300" }], venaleWaarde: "300000",
    }));
    expect(calc.grondwaarde).toBeCloseTo(150000);
    expect(calc.controlePunten.some((p) => p.includes("grondwaarde is nog 0"))).toBe(false);
  });
});

describe("meerdere panden — het tabblad Waardering en de PDF moeten hetzelfde rekenen", () => {
  // Het tabblad Waardering (DossierWizard/bindPand), de portefeuilletabel eronder en de PDF-opbouw
  // (rapport/bouwers.js) stellen elk hun eigen pand-object samen. Zolang een pand álle velden van
  // maakLeegPand() heeft, geven die paden per definitie hetzelfde resultaat. Een pand dat bewaard
  // werd vóór een veld bestond, miste die sleutel — en dan liepen ze uiteen, of liep de berekening
  // zelfs volledig vast. App.jsx vult daarom bij het openen elk pand aan met maakLeegPand().
  const normaliseer = (pand) => ({ ...maakLeegPand(), ...pand });
  const hoofddossier = () => ({
    ...basisDossier({ venaleWaarde: "410000", ruimtes: [{ opp: "200", coeff: "1" }] }),
    id: "dossier-1", extraPanden: [], parkeerplaatsenGarages: [],
  });

  it("een pand uit een oudere versie laat de berekening vastlopen, na aanvulling niet meer", () => {
    const ouderPand = { pandId: "p2", pandNaam: "Garage", klasse: "Gewoon huis" }; // geen ruimtes
    let liepVast = false;
    try { berekenWaardering({ ...ouderPand, id: "dossier-1" }); } catch { liepVast = true; }
    expect(liepVast).toBe(true);
    const calcNa = berekenWaardering({ ...normaliseer(ouderPand), id: "dossier-1" });
    expect(calcNa.totOpp).toBe(0); // niets ingevuld, maar geen crash meer
  });

  it("een aangevuld pand erft de handmatige venale waarde van het hoofdpand NIET", () => {
    const d = hoofddossier();
    const pand = normaliseer({ pandNaam: "Pand 2", klasse: "Gewoon huis", ruimtes: [{ opp: "100", coeff: "1" }] });
    const schermCalc = berekenWaardering({ ...d, ...pand, id: d.id, extraPanden: [], parkeerplaatsenGarages: [] });
    const pdfCalc = berekenWaardering({ ...d, ...pand, extraPanden: [], parkeerplaatsenGarages: [] });
    expect(schermCalc.venaleWaarde).toBeCloseTo(pdfCalc.venaleWaarde, 5);
    expect(schermCalc.venaleWaarde).toBeCloseTo(schermCalc.intrinsiek, 5);
    expect(schermCalc.venaleWaarde).toBeGreaterThan(0);
  });

  it("zonder die aanvulling zou het pand wél de venale waarde van het hoofdpand overnemen", () => {
    const d = hoofddossier();
    const ouderPand = { pandId: "p2", klasse: "Gewoon huis", ruimtes: [{ opp: "100", coeff: "1" }], schijven: [] };
    const zonder = berekenWaardering({ ...d, ...ouderPand, extraPanden: [], parkeerplaatsenGarages: [] });
    expect(zonder.venaleWaarde).toBe(410000); // precies wat de normalisatie in App.jsx voorkomt
    const met = berekenWaardering({ ...d, ...normaliseer(ouderPand), extraPanden: [], parkeerplaatsenGarages: [] });
    expect(met.venaleWaarde).toBeCloseTo(met.intrinsiek, 5);
  });
});

describe("meerdere panden — pandgebonden juridische gegevens in het verslag", () => {
  // Een extra pand heeft voor akten, erfdienstbaarheden en zakelijke rechten geen eigen invoerveld
  // (zie maakLeegPand). Die van het hoofdpand overnemen zou in het verslag een feitelijke bewering
  // over een ánder pand zetten — in een nalatenschap met twee panden kreeg pand 2 zo de
  // erfdienstbaarheden en de verwervingsakte van pand 1. De eigenaars horen wél bij de opdracht en
  // blijven dus dossierbreed. Getoetst op het effectief opgebouwde verslag: elk gegeven mag maar
  // evenveel keer voorkomen als er panden zijn waar het echt bij hoort.
  const aantalKeer = (tekst, naald) => tekst.split(naald).length - 1;
  const dossierMetTweePanden = () => ({
    ...initialData,
    id: "dossier-1",
    ruimtes: [{ opp: "150", coeff: "1" }],
    erfdienstbaarheden: "Recht van doorgang voor het achterliggende perceel",
    zakelijkeRechten: "Vruchtgebruik ten voordele van mevrouw Peeters",
    aankoopAkteType: "Notariele akte",
    aankoopAkteDatum: "2015-06-01",
    basisAkteDatum: "2010-01-01",
    eigenaars: [{ naam: "Jan Janssens", recht: "Volle eigendom", aandeel: "1/1" }],
    extraPanden: [{ ...maakLeegPand("Pand 2"), ruimtes: [{ opp: "100", coeff: "1" }] }],
    parkeerplaatsenGarages: [],
  });

  it("de akte- en erfdienstbaarheidgegevens van het hoofdpand staan maar bij één pand in het verslag", () => {
    const d = dossierMetTweePanden();
    const html = buildMultiPandReportData(d, berekenWaardering(d), undefined).sectionsBlockHtml;
    expect(aantalKeer(html, "Recht van doorgang")).toBe(1);
    expect(aantalKeer(html, "Vruchtgebruik ten voordele")).toBe(1);
    expect(aantalKeer(html, "Notariele akte")).toBe(1);
  });

  it("de eigenaars blijven wel dossierbreed en staan dus bij beide panden", () => {
    const d = dossierMetTweePanden();
    const html = buildMultiPandReportData(d, berekenWaardering(d), undefined).sectionsBlockHtml;
    expect(aantalKeer(html, "Jan Janssens")).toBe(2);
  });
});

describe("meerdere panden — elk pand met zijn eigen adres en perceel", () => {
  // Adres, CaPaKey en de kadasterkaart horen bij één pand. De invoervelden daarvoor stonden
  // voorheen op het dossier-tabblad "Opdracht & partijen", waardoor een extra pand ze nooit kon
  // krijgen; ze staan nu op het pand-tabblad "Type, staat & kadaster". Het verslag las ze al per
  // pand — deze test legt vast dat beide panden effectief hun eigen gegevens tonen.
  const aantalKeer = (tekst, naald) => tekst.split(naald).length - 1;

  it("toont het adres, de CaPaKey en het perceel van elk pand afzonderlijk", () => {
    const pandTwee = {
      ...maakLeegPand("Pand 2"),
      straat: "Nieuwstraat", nummer: "12", postcode: "9100", gemeente: "Sint-Niklaas",
      capakey: "46021B0299/00A000",
      cadgisBbox: "4.1,51.1,4.2,51.2", cadgisRingen: [[[4.1, 51.1], [4.2, 51.1], [4.2, 51.2]]],
      ruimtes: [{ opp: "100", coeff: "1" }],
    };
    const d = {
      ...initialData,
      id: "dossier-1",
      straat: "Kerkstraat", nummer: "5", postcode: "9120", gemeente: "Beveren",
      capakey: "46003A0155/00B000",
      cadgisBbox: "4.3,51.3,4.4,51.4", cadgisRingen: [[[4.3, 51.3], [4.4, 51.3], [4.4, 51.4]]],
      ruimtes: [{ opp: "150", coeff: "1" }],
      extraPanden: [pandTwee],
      parkeerplaatsenGarages: [],
    };
    const html = buildMultiPandReportData(d, berekenWaardering(d), undefined).sectionsBlockHtml;
    expect(html).toContain("Kerkstraat");
    expect(html).toContain("Nieuwstraat");
    expect(aantalKeer(html, "46003A0155/00B000")).toBe(1); // enkel bij het hoofdpand
    expect(aantalKeer(html, "46021B0299/00A000")).toBe(1); // enkel bij pand 2
  });

  it("laat de CaPaKey van het hoofdpand niet doorlekken naar een pand zonder eigen perceel", () => {
    const d = {
      ...initialData,
      id: "dossier-1", straat: "Kerkstraat", capakey: "46003A0155/00B000",
      ruimtes: [{ opp: "150", coeff: "1" }],
      extraPanden: [{ ...maakLeegPand("Pand 2"), ruimtes: [{ opp: "100", coeff: "1" }] }],
      parkeerplaatsenGarages: [],
    };
    const html = buildMultiPandReportData(d, berekenWaardering(d), undefined).sectionsBlockHtml;
    expect(aantalKeer(html, "46003A0155/00B000")).toBe(1);
  });
});

describe("berekenWaardering — bedrijfsmatig: eigen nieuwbouwprijs per m² + vetusiteit", () => {
  // Naast de reeds-afgeschreven vervangingswaarde (tabblad Bedrijfskenmerken) kan de schatter-expert
  // bij KMO-/Bedrijfsvastgoed ook zelf een NIEUWBOUWprijs per m² ingeven op het tabblad Waardering.
  // Dan verloopt de berekening als bij een woning: prijs/m² × oppervlakte = nieuwbouwwaarde, waarop
  // de vetusiteit wél wordt toegepast.
  const bedrijfsDossier = (extra = {}) => basisDossier({
    vastgoedType: "KMO-vastgoed",
    ruimtes: [{ opp: "400", coeff: "1" }],
    ...extra,
  });

  it("berekent de nieuwbouwwaarde als prijs per m² × oppervlakte", () => {
    const calc = berekenWaardering(bedrijfsDossier({ bedrijfsPrijsPerM2: "900" }));
    expect(calc.gebruiktBedrijfsPrijsPerM2).toBe(true);
    expect(calc.nieuwbouwwaarde).toBeCloseTo(900 * 400, 5);
  });

  it("past de vetusiteit toe op die nieuwbouwwaarde", () => {
    const calc = berekenWaardering(bedrijfsDossier({
      bedrijfsPrijsPerM2: "900", vetOuderdom: "10", vetFrequentie: "5", vetGebruik: "5", vetKwaliteit: "0",
    }));
    expect(calc.totaalVetusiteit).toBeCloseTo(20, 5);
    expect(calc.actueleWaardeGebouw).toBeCloseTo(900 * 400 * 0.8, 5);
  });

  it("krijgt voorrang op een ingevulde vervangingswaarde", () => {
    const calc = berekenWaardering(bedrijfsDossier({
      bedrijfsPrijsPerM2: "900", bedrijfsVervangingswaarde: "250000",
    }));
    expect(calc.gebruiktBedrijfsPrijsPerM2).toBe(true);
    expect(calc.gebruiktBedrijfsVervangingswaarde).toBe(false);
    expect(calc.nieuwbouwwaarde).toBeCloseTo(900 * 400, 5);
  });

  it("laat de bestaande vervangingswaarde-weg volledig ongemoeid zolang er geen prijs per m² staat", () => {
    const calc = berekenWaardering(bedrijfsDossier({
      bedrijfsVervangingswaarde: "250000", vetOuderdom: "30",
    }));
    expect(calc.gebruiktBedrijfsPrijsPerM2).toBe(false);
    expect(calc.gebruiktBedrijfsVervangingswaarde).toBe(true);
    // de sleet zit al in dat bedrag verrekend en mag er dus niet nog eens af
    expect(calc.actueleWaardeGebouw).toBe(250000);
    expect(calc.nieuwbouwwaarde).toBe(250000);
  });

  it("negeert een prijs per m² bij residentieel vastgoed", () => {
    const calc = berekenWaardering(basisDossier({
      ruimtes: [{ opp: "400", coeff: "1" }], bedrijfsPrijsPerM2: "900",
    }));
    expect(calc.gebruiktBedrijfsPrijsPerM2).toBe(false);
    expect(calc.abexPerM2).toBeGreaterThan(0); // blijft gewoon de Abex-berekening gebruiken
  });

  it("toont de opbouw in het rapport: prijs per m², oppervlakte, nieuwbouwwaarde en vetusiteit", () => {
    const d = bedrijfsDossier({ bedrijfsPrijsPerM2: "900", vetOuderdom: "20" });
    const blokken = rapportWaarderingsBlokken(d, berekenWaardering(d));
    const labels = blokken[0].rijen.map((r) => r[0]).join("|");
    expect(labels).toContain("Nieuwbouwprijs per m² (manueel ingeschat)");
    expect(labels).toContain("Nieuwbouwwaarde");
    expect(labels).toContain("Totale vetusteit");
    expect(labels).toContain("Actuele waarde gebouw");
  });
});

describe("berekenWaardering — jaarhuur: 10 maanden bij woningen, 12 bij bedrijfsmatig vastgoed", () => {
  it("houdt de klassieke 10-maandenconventie aan bij een woning", () => {
    const calc = berekenWaardering(basisDossier({ huurMaand: "1000" }));
    expect(calc.huurMaandenPerJaar).toBe(10);
    expect(calc.jaarhuur).toBe(10000);
  });

  it("rekent met de volle 12 maanden bij KMO-vastgoed", () => {
    const calc = berekenWaardering(basisDossier({ vastgoedType: "KMO-vastgoed", huurMaand: "1000" }));
    expect(calc.huurMaandenPerJaar).toBe(12);
    expect(calc.jaarhuur).toBe(12000);
  });

  it("rekent ook bij Bedrijfsvastgoed met 12 maanden", () => {
    const calc = berekenWaardering(basisDossier({ vastgoedType: "Bedrijfsvastgoed", huurMaand: "1000" }));
    expect(calc.jaarhuur).toBe(12000);
  });

  it("laat Garage / Staanplaats ongewijzigd op 10 maanden", () => {
    const calc = berekenWaardering(basisDossier({ vastgoedType: "Garage / Staanplaats", huurMaand: "1000" }));
    expect(calc.huurMaandenPerJaar).toBe(10);
  });

  it("werkt door in de directe kapitalisatie: de DCF-waarde ligt 20% hoger bij bedrijfsmatig", () => {
    const opties = { huurMaand: "1000", yieldVan: "5", yieldTot: "5", yieldStap: "0.5" };
    const woning = berekenWaardering(basisDossier(opties));
    const bedrijf = berekenWaardering(basisDossier({ ...opties, vastgoedType: "KMO-vastgoed" }));
    expect(bedrijf.dcfWaarde).toBeCloseTo(woning.dcfWaarde * 1.2, 5);
  });

  it("werkt ook door in de meerjaren-DCF", () => {
    const opties = {
      huurMaand: "1000", dcfMeerjarenActief: true, dcfJaren: "1",
      dcfHuurgroeiPct: "0", dcfLeegstandPct: "0", dcfDiscontovoetPct: "6",
    };
    const bedrijf = berekenWaardering(basisDossier({ ...opties, vastgoedType: "KMO-vastgoed" }));
    expect(bedrijf.dcfMeerjarenWaarde).toBeCloseTo(12000 / 1.06, 2);
  });

  it("vermeldt de gebruikte conventie in het verslag", () => {
    const d = basisDossier({ vastgoedType: "KMO-vastgoed", huurMaand: "1000", yieldVan: "5", yieldTot: "5" });
    const blokken = rapportWaarderingsBlokken(d, berekenWaardering(d));
    const dcfBlok = blokken.find((b) => b.titel === "Rendementsbenadering (DCF)");
    expect(dcfBlok.rijen.map((r) => r[0]).join("|")).toContain("Jaarhuur (12 maanden)");
  });
});

describe("meerdere panden — verslag gebundeld tot 1 geheel (eedformule, bijlagen, foto's, TOC)", () => {
  // Voorheen kreeg elk pand zijn eigen "Pand N — Eedformule" en "Pand N — Bijlagen"-sectie, en
  // werden alle foto's van alle panden gewoon per 6 op een hoop gegooid (kon panden vermengen op
  // dezelfde foto-pagina). Dit blok legt de bundeling vast: 1 eedformule, 1 verzamelde
  // bijlagensectie achteraan, foto's nooit meer vermengd tussen panden, en een tussentitel per
  // pand in de inhoudstafel i.p.v. het "Pand N —"-voorvoegsel op elke sectieregel.
  const aantalKeer = (tekst, naald) => tekst.split(naald).length - 1;
  const dossierMetTweePanden = (overrides1 = {}, overrides2 = {}) => ({
    ...initialData,
    id: "dossier-1",
    ruimtes: [{ opp: "150", coeff: "1" }],
    straat: "Kerkstraat", nummer: "5", postcode: "9120", gemeente: "Beveren",
    eedPlaats: "Beveren", datumVerslag: "2026-01-15", schatterNaam: "Piet Peeters",
    ...overrides1,
    extraPanden: [{ ...maakLeegPand("Pand 2"), ruimtes: [{ opp: "100", coeff: "1" }], ...overrides2 }],
    parkeerplaatsenGarages: [],
  });

  it("de eedformule verschijnt precies 1 keer voor het hele verslag, niet 1 keer per pand", () => {
    const d = dossierMetTweePanden();
    const html = buildMultiPandReportData(d, berekenWaardering(d), undefined).sectionsBlockHtml;
    expect(aantalKeer(html, "Ik zweer dat ik mijn opdracht in eer en geweten getrouw heb vervuld")).toBe(1);
    expect(aantalKeer(html, "Eedformule")).toBe(1); // geen "Pand 1 — Eedformule"/"Pand 2 — Eedformule" meer
  });

  it("de documenten van elk pand staan gebundeld in 1 bijlagensectie achteraan, niet meer tussen de secties van dat pand", () => {
    const d = dossierMetTweePanden(
      { documenten: [{ naam: "bodemattest.pdf", type: "application/pdf" }] },
      { documenten: [{ naam: "epc-pand2.pdf", type: "application/pdf" }] },
    );
    const html = buildMultiPandReportData(d, berekenWaardering(d), undefined).sectionsBlockHtml;
    expect(aantalKeer(html, "Bijlagen — geraadpleegde stukken")).toBe(1);
    expect(/Pand \d — Bijlagen/.test(html)).toBe(false);
    expect(html).toContain("bodemattest.pdf");
    expect(html).toContain("epc-pand2.pdf");
    // de gebundelde bijlagensectie staat NA alle inhoudelijke pandsecties (ook na Waardering van pand 2)
    expect(html.indexOf("Bijlagen — geraadpleegde stukken")).toBeGreaterThan(html.indexOf("Pand 2 — Waardering"));
  });

  it("foto's van verschillende panden komen niet meer samen op dezelfde foto-pagina terecht", () => {
    const fotoRij = (n, label) => Array.from({ length: n }, (_, i) => ({ base64: "data:image/png;base64,AAA", categorie: `${label}-${i}` }));
    const d = dossierMetTweePanden(
      { fotos: fotoRij(3, "Pand1foto") },
      { fotos: fotoRij(4, "Pand2foto") },
    );
    const fotoBlockHtml = buildMultiPandReportData(d, berekenWaardering(d), undefined).fotoBlockHtml;
    // 3 + 4 = 7 foto's: bij een simpele "alles op 1 hoop"-indeling per 6 gaf dat 2 blokken waarbij
    // pand 2 z'n 4de foto in hetzelfde blok als pand 1 belandde — hier moet elk pand zijn eigen
    // foto-blok(ken) krijgen (2 blokken, één per pand, want elk zit onder de 6).
    expect((fotoBlockHtml.match(/<section class="foto-block">/g) || []).length).toBe(2);
    expect(fotoBlockHtml).toContain("Foto's — Pand 1 — Kerkstraat 5, 9120 Beveren");
    expect(fotoBlockHtml).toContain("Foto's — Pand 2 —");
    const eersteBlok = fotoBlockHtml.split('<section class="foto-block">')[1];
    expect(eersteBlok).toContain("Pand1foto-0");
    expect(eersteBlok).not.toContain("Pand2foto-0");
  });

  it("de inhoudstafel toont een tussentitel per pand i.p.v. het 'Pand N —'-voorvoegsel op elke sectieregel", () => {
    const d = dossierMetTweePanden();
    const data = buildMultiPandReportData(d, berekenWaardering(d), undefined);
    expect(data.tocBlockHtml).toContain("PAND 1 —");
    expect(data.tocBlockHtml).toContain("PAND 2 —");
    expect(data.tocBlockHtml).not.toContain("Pand 1 — Opdracht &amp; partijen");
    expect(data.tocBlockHtml).not.toContain("Pand 2 — Opdracht &amp; partijen");
    // in het verslag zelf (de paginakop boven de sectie) blijft dat voorvoegsel wél gewoon staan
    expect(data.sectionsBlockHtml).toContain("Pand 1 — Opdracht &amp; partijen");
    expect(data.sectionsBlockHtml).toContain("Pand 2 — Opdracht &amp; partijen");
  });
});

describe("wPara — vrije tekst behoudt zijn regeleinden in het verslag", () => {
  // "Ligging in de omgeving" (omgevingsvoorzieningen/bereikbaarheid/straatuitrusting) en
  // "Omschrijving indeling & functionaliteit" (bedrijfsOmschrijvingIndeling) gebruiken deze
  // gedeelde wPara-bouwsteen — zonder white-space:pre-line negeert de browser/Chromium elke
  // newline die de schatter-expert typte, en smolt alles samen tot 1 ononderbroken tekst.
  it("geeft white-space:pre-line mee zodat getypte regeleinden niet meer tot 1 lopende tekst samensmelten", () => {
    const html = wPara("Bereikbaarheid", "Vlot bereikbaar met de wagen.\nOok een bushalte op wandelafstand.");
    expect(html).toContain("white-space:pre-line");
    expect(html).toContain("Vlot bereikbaar met de wagen.\nOok een bushalte op wandelafstand.");
  });
});
