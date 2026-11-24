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

describe("rendementsbenadering: verkeerd yieldbereik", () => {
  it("meldt een minimum dat hoger ligt dan het maximum, met het tabblad", () => {
    const c = controles({ huurMaand: "1100", yieldVan: "5", yieldTot: "3.5", yieldStap: "0.5" });
    expect(c.join(" ")).toContain('"Yield van" (5%) ligt hoger dan "Yield tot" (3,5%)');
    expect(c.join(" ")).toContain("— tabblad Waardering");
  });
  it("geen melding bij een correct bereik", () => {
    // (de kostenbenadering en de rendementsbenadering lopen in dit voorbeeld wel 24% uiteen — dat
    // meldt een aparte controle, zie "uiteenlopende methodes" hieronder)
    expect(controles({ huurMaand: "1100", yieldVan: "3.5", yieldTot: "5", yieldStap: "0.5" }).filter((t) => /yield/i.test(t))).toEqual([]);
  });
});

// Controles uit de nalezing van een verslag met een woning en twee loodsen (november 2026): een EPC
// waarvan label, score en certificaatnummer elkaar tegenspreken, ontbrekende attesten bij een
// verkoop, een grondschijf die niet strookt met het perceel, uiteenlopende methodes, een SWOT met
// een oppervlakte die nergens in het dossier staat, en controles over de panden heen.
describe("controles na de nalezing van november 2026", () => {
  it("vangt een EPC waarvan label, score en certificaatnummer elkaar tegenspreken", () => {
    const c = controles({ reden: "Verkoop", asbestattest: "Aanwezig — asbestveilig", bodemattest: "Aanwezig — geen verontreiniging gekend",
      epcLabel: "B", epcWaarde: "204", epcDatum: "2026-04-15", epcCertificaatnummer: "20160415-0001853753-1", referentiedatum: "2026-11-23" }).join(" | ");
    expect(c).toContain("Label B past niet bij de energiescore van 204 kWh/m² (dat is label C)");
    expect(c).toContain("wijst op een EPC van 15/04/2016");
    expect(c).toContain("vóór 2019 mag bij een verkoop niet meer gebruikt worden");
    expect(c).toContain("Het EPC is verlopen (geldig tot 15/04/2026)");
  });
  it("vraagt naar het asbest- en bodemattest bij een verkoop, niet bij een nalatenschap", () => {
    const c = controles({ reden: "Verkoop", bouwjaar: "1973" }).join(" | ");
    expect(c).toContain("Gebouwd in 1973, dus vóór 2001");
    expect(c).toContain("is een bodemattest verplicht");
    expect(controles({ reden: "Nalatenschap", bouwjaar: "1973" }).join(" | ")).not.toContain("asbestattest");
    expect(controles({ reden: "Verkoop", bouwjaar: "2005", bodemattest: "Niet aanwezig" }).join(" | ")).not.toContain("asbestattest");
  });
  it("vangt een grondschijf die niet strookt met het perceel", () => {
    const c = controles({ schijven: [{ naam: "Grond", opp: "1236", prijs: "200" }], grondopp: "2030" }).join(" | ");
    expect(c).toContain("De grondwaarde rekent met 1236 m² (grondschijven), maar het perceel is 2030 m²");
  });
  it("vangt een kosten- en rendementsbenadering die ver uiteenlopen", () => {
    const c = controles({ huurMaand: "1100", yieldVan: "3.5", yieldTot: "5", yieldStap: "0.5" }).join(" | ");
    expect(c).toMatch(/De kostenbenadering \(€ [\d.]+\) en de rendementsbenadering \(€ [\d.]+\) liggen \d+% uit elkaar/);
  });
  it("vangt een SWOT met een oppervlakte of eigendomstoestand die niet klopt", () => {
    const c = controles({ kansen: "Ruime grond (1321 m²) tegen beperkte bewoonbare opp. (205 m²)", bedreigingen: "Eigendomstoestand onbekend",
      eigenaars: [{ id: 1, naam: "Jan Peeters", recht: "Volle eigendom", aandeel: "" }] }).join(" | ");
    expect(c).toContain("De SWOT vermeldt 205 m², een oppervlakte die nergens in het dossier staat (berekend: 243 m²)");
    expect(c).toContain("noemt de eigendomstoestand onbekend");
    expect(c).not.toContain("1321 m²,");
  });
  it("vraagt een omschrijving bij gewestplan Andere", () => {
    expect(controles({ gewestplan: "Andere" }).join(" ")).toContain('Gewestplan "Andere" zonder omschrijving');
    expect(controles({ gewestplan: "Andere", gewestplanAndere: "zone voor ambachtelijke bedrijven" }).join(" ")).not.toContain("Gewestplan");
  });
  it("kijkt bij meerdere panden ook naar elk extra pand en over de panden heen", async () => {
    const { controlesAllePanden } = await import("../domein/controles.js");
    const loods = (o) => ({ straat: "Vlyminckshoek", nummer: o.nummer, postcode: "9100", gemeente: "Sint-Niklaas", vastgoedType: "Industrie & logistiek",
      bedrijfsSubtype: "", mobiscore: o.mobiscore, bedrijfsIndustrieelMeer70: o.industrie || "Onbekend", wijzeVanWaardering: "Vergelijkende methode",
      vergelijkingspunten: [], sterktes: "", zwaktes: "", kansen: "", bedreigingen: "", ruimtes: [{ verdieping: "gelijkvloers", opp: "800", coeff: "1" }],
      schijven: [{ naam: "Grond", opp: "900", prijs: "200" }], grondopp: "900", huurMaand: "4000", yieldVan: "6", yieldTot: "6", yieldStap: "0.5",
      dcfTransactiekostenActief: true, dcfTransactiekostenPct: o.kk });
    const d = woning({ straat: "Vlyminckshoek", nummer: "40A", postcode: "9100", gemeente: "Sint-Niklaas", mobiscore: "8.5",
      extraPanden: [loods({ nummer: "40B", mobiscore: "8.5", kk: "14" }), loods({ nummer: "40C", mobiscore: "8.6", kk: "12", industrie: "Ja" })] });
    const c = controlesAllePanden(d, berekenWaardering(d)).join(" | ");
    expect(c).toContain("Vlyminckshoek 40B: De vergelijkende methode staat als wijze van waardering, maar er zijn geen vergelijkingspunten");
    expect(c).toContain("Vlyminckshoek 40C: De SWOT-analyse is leeg");
    expect(c).toContain("De kosten koper verschillen tussen de panden (14% / 12%)");
    expect(c).toContain("Panden in dezelfde straat met een verschillende Mobiscore (8,5 / 8,6)");
    expect(c).toContain("Het EPC-regime van de industriële panden is verschillend bepaald");
  });
});
