// Tests voor de waardering van appartementen (klasse, tweede klasse, eigen Abex-waarde/m²) — naar
// aanleiding van "klasse/gevel leveren geen ABEX-waarde per m² op" bij een appartement waarvan het
// veld "Eigen Abex-waarde/m²" op 0 stond, en van oudere dossiers met een woningklasse of een menging
// van de klassieke en de nieuwbouwprijzen-tabel.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { berekenWaardering } from "../domein/waardering.js";
import { initialData } from "../constants.js";

const app = (o = {}) => ({
  ...initialData, extraPanden: [], parkeerplaatsenGarages: [], pandType: "Appartement",
  klasse: "Verzorgd appartement", gevel: "2-gevel", grondopp: "800", aandeelDuizendsten: "120",
  ruimtes: [{ verdieping: "1everdiep", opp: "95", coeff: "1" }], schijven: [{ opp: "96", prijs: "250" }], ...o,
});
const tekst = (c) => c.controlePunten.join(" | ");

describe("eigen Abex-waarde/m²", () => {
  it("negeert 0 en rekent met de tabel, met een duidelijke melding", () => {
    const zonder = berekenWaardering(app());
    const nul = berekenWaardering(app({ abexPerM2Override: "0" }));
    expect(nul.abexPerM2).toBeCloseTo(zonder.abexPerM2, 6);
    expect(nul.abexPerM2).toBeGreaterThan(0);
    expect(nul.actueleWaardeGebouw).toBeCloseTo(zonder.actueleWaardeGebouw, 6);
    expect(tekst(nul)).not.toContain("klasse/gevel leveren geen ABEX-waarde per m² op");
    expect(tekst(nul)).toContain("eigen Abex-waarde/m² staat op 0");
    expect(nul.abexPerM2Override).toBe("");
  });
  it("gebruikt een positieve eigen waarde wel", () => {
    expect(berekenWaardering(app({ abexPerM2Override: "2500" })).abexPerM2).toBe(2500);
  });
});

describe("klasse en tweede klasse", () => {
  it("negeert een tweede klasse uit een andere tabel i.p.v. een onzinnige menging te maken", () => {
    const enkel = berekenWaardering(app({ klasse: "Luxueus appartement" }));
    const gemengd = berekenWaardering(app({ klasse: "Luxueus appartement", klasse2: "Gewoon appartement (nieuwbouwprijzen)", klasseMixPct: 50 }));
    expect(gemengd.abexPerM2).toBeCloseTo(enkel.abexPerM2, 6);
    expect(gemengd.klasseObj2).toBeNull();
    expect(tekst(gemengd)).toContain("komt uit een andere tabel");
    // binnen dezelfde tabel blijft de menging werken
    const nb = berekenWaardering(app({ klasse: "Gewoon appartement (nieuwbouwprijzen)", klasse2: "Verzorgd appartement (nieuwbouwprijzen)", klasseMixPct: 50 }));
    expect(nb.abexPerM2).toBeCloseTo((3156 + 3953) / 2, 6);
  });
  it("meldt een woningklasse bij een appartement en een onbekende klasse", () => {
    expect(tekst(berekenWaardering(app({ klasse: "Luxueus" })))).toContain('klasse "Luxueus" is een woningklasse, maar het pand is een appartement');
    expect(tekst(berekenWaardering(app({ klasse: "Gewoon huis" })))).toContain("is een woningklasse");
    expect(tekst(berekenWaardering(app({ klasse: "Verdwenen klasse" })))).toContain('klasse "Verdwenen klasse" bestaat niet (meer)');
  });
  it("geeft geen meldingen bij een correct ingevuld appartement", () => {
    const c = tekst(berekenWaardering(app()));
    expect(c).not.toMatch(/woningklasse|andere tabel|bestaat niet|staat op 0|geen ABEX/);
  });
});
