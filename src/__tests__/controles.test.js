// Tests voor de inhoudelijke controles vóór aflevering (domein/controles.js) en de onderbouwing van
// de kostenbenadering in het verslag (oppervlakte × eenheidsprijs, vetusteit per factor, grond per
// schijf, aanhorigheden). Gebaseerd op de tegenstrijdigheden uit een echte nalezing.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { inhoudelijkeControles } from "../domein/controles.js";
import { berekenWaardering, rapportWaarderingsBlokken } from "../domein/waardering.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { valideerDossier } from "../App.jsx";
import { initialData, HUISSTIJLEN } from "../constants.js";

const woning = (o = {}) => ({
  ...initialData, extraPanden: [], parkeerplaatsenGarages: [], bouwtype: "Open", gevel: "4-gevel", bouwjaar: "1985",
  bouwprijsBasis: "Exclusief btw en erelonen",
  ruimtes: [{ verdieping: "gelijkvloers", opp: "150", coeff: "1" }, { verdieping: "1everdiep", opp: "93", coeff: "1" }],
  schijven: [{ naam: "Bouwgrond", opp: "800", prijs: "250" }, { naam: "Tuin", opp: "521", prijs: "60" }], grondopp: "1321", ...o,
});
const controles = (o) => { const d = woning(o); return inhoudelijkeControles(d, berekenWaardering(d)); };

describe("inhoudelijke controles", () => {
  it("geeft niets bij een coherent dossier", () => {
    expect(controles({})).toEqual([]);
  });
  it("vangt halfopen bebouwing met 4 gevels", () => {
    expect(controles({ bouwtype: "Halfopen" }).join(" ")).toContain('Bouwtype "Halfopen" en "4-gevel"');
  });
  it("vangt twee verschillende bewoonbare oppervlaktes", () => {
    expect(controles({ bewoonbareOppSchatting: "276.9" }).join(" ")).toContain("Twee bewoonbare oppervlaktes");
    expect(controles({ bewoonbareOppSchatting: "245" })).toEqual([]);
  });
  it("vangt agrarisch gebied met een verkaveling en vraagt naar zonevreemdheid", () => {
    const c = controles({ gewestplan: "Agrarisch gebied", verkaveling: "Ja" }).join(" ");
    expect(c).toContain("Agrarisch gebied én een verkaveling");
    expect(c).toContain("geef aan of ze zonevreemd is");
    expect(controles({ gewestplan: "Agrarisch gebied", verkaveling: "Nee", zonevreemd: "Ja" }).join(" ")).toContain("licht de gevolgen toe");
  });
  it("vangt een hoge coëfficiënt voor een tuinberging", () => {
    const c = controles({ ruimtes: [...woning().ruimtes, { verdieping: "tuinberging", naam: "Poolhouse", opp: "45", coeff: "0.7" }] });
    expect(c.join(" ")).toContain("Coëfficiënt 0,7 voor Poolhouse ligt hoog");
  });
  it("vraagt de basis van de eenheidsprijs, een motivering bij onbekend bouwjaar en bij een asymmetrische marge", () => {
    const c = controles({ bouwprijsBasis: "", bouwjaar: "", vetOuderdom: 20, vetFrequentie: 8, marktMargeBovenPct: "2.5" }).join(" ");
    expect(c).toContain("inclusief of exclusief btw");
    expect(c).toContain("terwijl het bouwjaar onbekend is");
    expect(c).toContain("Asymmetrische marktmarge");
  });
  it("vangt een SWOT die zichzelf of de invoer tegenspreekt", () => {
    const c = controles({ kansen: "Agrarische omgeving biedt rust", bedreigingen: "Agrarische bestemming beperkt uitbreiding", zwaktes: "Ontbrekende elektrische keuring", keuringStatus: "Onbekend" }).join(" ");
    expect(c).toContain('noemt "agrarisch" zowel bij kansen als bij bedreigingen');
    expect(c).toContain("ontbrekende elektrische keuring");
  });
  it("komt mee in de controle vóór aflevering", () => {
    const d = woning({ bouwtype: "Halfopen" });
    expect(valideerDossier(d, berekenWaardering(d)).aandachtspunten.join(" ")).toContain("Bouwtype");
    expect(valideerDossier(d).aandachtspunten.join(" ")).not.toContain("Bouwtype");
  });
});

describe("onderbouwing van de kostenbenadering", () => {
  it("toont oppervlakte, nieuwbouwwaarde en aanhorigheden, zonder vetusteit per factor of grondwaarde", () => {
    const d = woning({ vetOuderdom: 20, vetFrequentie: 8, vetusteitMotivering: "schil gerenoveerd, technieken origineel",
      aanhorigheden: [{ id: "a", omschrijving: "Zwemvijver", waarde: "25000" }, { id: "b", omschrijving: "Zonnepanelen 6 kWp", waarde: "4000" }] });
    const c = berekenWaardering(d);
    expect(c.aanhorighedenTotaal).toBe(29000);
    expect(c.intrinsiek).toBeCloseTo(c.actueleWaardeGebouw + c.grondwaarde + 29000, 6);
    const blok = rapportWaarderingsBlokken(d, c).find((b) => b.titel === "Waardering op basis van vervangingswaarde");
    const labels = blok.rijen.map((r) => r[0]);
    expect(labels).toContain("Abex-waarde/m² — exclusief btw en erelonen");
    expect(labels).toContain("Bewoonbare oppervlakte (na coëfficiënten)");
    expect(labels).toContain("Nieuwbouwwaarde");
    expect(labels).toContain("Totale vetusteit");
    expect(labels.some((l) => /Ouderdom|Frequentie van onderhoud|^Grond|Grondwaarde/.test(l))).toBe(false);
    expect(labels).toContain("Zwemvijver");
    expect(blok.motivering).toContain("Vetusteit: schil gerenoveerd, technieken origineel.");
  });
  it("zet zonevreemdheid en de overstromingsgevoeligheid in de PDF, en laat een lege juridische rubriek weg", () => {
    const d = woning({ zonevreemd: "Ja", zonevreemdToelichting: "Uitbreiding beperkt tot 1.000 m³." });
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain("Overstromingsgevoeligheid perceel (watertoets)");
    expect(html).toContain("Uitbreiding beperkt tot 1.000 m³.");
    expect(html).not.toContain(">Juridische gegevens<");
  });
});
