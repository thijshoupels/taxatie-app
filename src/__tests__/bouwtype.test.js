// Tests voor het bouwtype zonder stilzwijgende standaardwaarde: nieuwe dossiers (en nieuwe extra
// panden) starten op "— kies —" i.p.v. "Gesloten", en de controle in de waardering meldt een
// woning waarvoor nog geen bouwtype gekozen werd.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { initialData, maakLeegPand } from "../constants.js";
import { berekenWaardering } from "../domein/waardering.js";

const MELDING = "bouwtype (open/halfopen/gesloten) is nog niet gekozen";
const dossier = (o = {}) => ({
  ...initialData, ruimtes: [{ opp: "180", coeff: "1" }], schijven: [{ opp: "800", prijs: "200" }], grondopp: "800",
  extraPanden: [], parkeerplaatsenGarages: [], ...o,
});

describe("bouwtype zonder standaardwaarde", () => {
  it("start een nieuw dossier en een nieuw extra pand zonder bouwtype", () => {
    expect(initialData.bouwtype).toBe("");
    expect(maakLeegPand("Pand 2").bouwtype).toBe("");
  });

  it("meldt een woning zonder gekozen bouwtype in de controlepunten", () => {
    const c = berekenWaardering(dossier());
    expect(c.controlePunten).toContain(MELDING);
    expect(c.oppCheck).toBe(false);
  });

  it("meldt niets meer zodra het bouwtype gekozen is", () => {
    for (const bouwtype of ["Open", "Halfopen", "Gesloten"]) {
      expect(berekenWaardering(dossier({ bouwtype })).controlePunten).not.toContain(MELDING);
    }
  });

  it("vraagt geen bouwtype bij een appartement of bij niet-residentieel vastgoed", () => {
    expect(berekenWaardering(dossier({ pandType: "Appartement" })).controlePunten).not.toContain(MELDING);
    expect(berekenWaardering(dossier({ vastgoedType: "Bedrijfsvastgoed" })).controlePunten).not.toContain(MELDING);
  });

  it("laat de berekende waarde ongemoeid (het bouwtype telt niet mee in de berekening)", () => {
    expect(berekenWaardering(dossier()).venaleWaarde).toBe(berekenWaardering(dossier({ bouwtype: "Gesloten" })).venaleWaarde);
  });
});
