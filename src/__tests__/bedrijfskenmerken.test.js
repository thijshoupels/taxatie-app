// Tests voor de kenmerken per bedrijfstype (domein/bedrijfskenmerken.js): eigen kenmerken per type,
// standaardwaarden, opmaak voor het verslag, en de nieuwe hoofdstukken in de PDF (kenmerken van
// het type, technische installaties, oppervlakte per functie).
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { kenmerkGroepen, kenmerkRapportGroepen, kenmerkWaarde, KENMERK_STANDAARD, KENMERKEN_PER_TYPE, INSTALLATIES } from "../domein/bedrijfskenmerken.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { berekenWaardering } from "../domein/waardering.js";
import { buildPropertySummary, genereerAutomatischeSwot } from "../data/ai.js";
import { initialData, maakLeegPand, HUISSTIJLEN, OPTS } from "../constants.js";

const basis = (o = {}) => ({ ...initialData, extraPanden: [], parkeerplaatsenGarages: [], schijven: [{ opp: "2000", prijs: "100" }], ruimtes: [{ opp: "500", coeff: "1" }], ...o });

describe("kenmerken per bedrijfstype", () => {
  it("geeft elk bedrijfstype een eigen blok, plus de technische installaties", () => {
    const titels = (t) => kenmerkGroepen({ vastgoedType: t }).map((g) => g.titel);
    expect(titels("Kantoor")).toEqual(["Kantoor — specifieke kenmerken", "Installaties & veiligheid"]);
    expect(titels("KMO-unit / gemengd")[0]).toBe("KMO-unit — specifieke kenmerken");
    expect(titels("Industrie & logistiek")[0]).toBe("Industrie & logistiek — specifieke kenmerken");
    expect(titels("Retail")[0]).toBe("Retail — specifieke kenmerken");
    expect(titels("Horeca")[0]).toBe("Horeca — specifieke kenmerken");
    // oude dossiers (Bedrijfsvastgoed + subtype) krijgen het blok van hun nieuwe type
    expect(titels("Bedrijfsvastgoed")[0]).toBe("KMO-unit — specifieke kenmerken");
    expect(kenmerkGroepen({ vastgoedType: "Bedrijfsvastgoed", bedrijfsSubtype: "Horeca" })[0].titel).toBe("Horeca — specifieke kenmerken");
  });

  it("deelt sleutels tussen types, zodat een typewissel niets verliest", () => {
    const sleutels = (t) => KENMERKEN_PER_TYPE[t].velden.map((v) => v.k);
    expect(sleutels("KMO-unit / gemengd")).toContain("industrieelVrijeHoogte");
    expect(sleutels("Industrie & logistiek")).toContain("industrieelVrijeHoogte");
    expect(sleutels("Industrie & logistiek")).toContain("kmoPoorten");
  });

  it("heeft standaardwaarden in initialData en maakLeegPand, zonder bestaande te overschrijven", () => {
    expect(KENMERK_STANDAARD.bedrijfsSprinkler).toBe("Onbekend");
    expect(KENMERK_STANDAARD.winkelDiepte).toBe("");
    expect(initialData.horecaBrouwerij).toBe("Onbekend");
    expect(maakLeegPand().industrieelKraanbaan).toBe("Onbekend");
    expect(initialData.kantoorLiftAanwezig).toBe("Onbekend");
    // elke OPTS-verwijzing bestaat
    for (const g of [INSTALLATIES, ...Object.values(KENMERKEN_PER_TYPE)]) {
      for (const v of g.velden) if (typeof v.opties === "string") expect(Array.isArray(OPTS[v.opties])).toBe(true);
    }
  });

  it("maakt de waarden op voor het verslag en laat Onbekend en lege velden weg", () => {
    expect(kenmerkWaarde({ soort: "getal", eenheid: "m" }, "9.5")).toBe("9,5 m");
    expect(kenmerkWaarde({ soort: "getal", eenheid: "€/maand" }, "250")).toBe("€ 250 per maand");
    expect(kenmerkWaarde({ soort: "janee" }, "Onbekend")).toBe("");
    const g = kenmerkRapportGroepen({ vastgoedType: "Kantoor", kantoorKlasse: "Klasse B (courant, gemoderniseerd)", bedrijfsKoeling: "Volledig gekoeld", kantoorLiftAanwezig: "Onbekend" });
    expect(g[0].rijen).toEqual([["Standing", "Klasse B (courant, gemoderniseerd)"]]);
    expect(g[1].rijen).toEqual([["Koeling", "Volledig gekoeld"]]);
    expect(kenmerkRapportGroepen({ vastgoedType: "Retail" })).toEqual([]);
  });
});

describe("eigen hoofdstukken in het verslag", () => {
  it("zet de kenmerken van een logistiek pand en de installaties in de PDF", () => {
    const d = basis({ vastgoedType: "Industrie & logistiek", industrieelVrijeHoogte: "12", industrieelKraanbaan: "Ja", industrieelKraanCapaciteit: "10",
      industrieelRechtsgrond: "Concessie (havengebied)", bedrijfsSprinkler: "Ja" });
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain("Industrie &amp; logistiek — specifieke kenmerken");
    expect(html).toContain("12 m");
    expect(html).toContain("10 ton");
    expect(html).toContain("Concessie (havengebied)");
    expect(html).toContain("Installaties &amp; veiligheid");
    expect(html).toContain("Sprinklerinstallatie");
  });

  it("toont bij zones de tabel Oppervlakte per functie i.p.v. de bouwlagen", () => {
    const d = basis({ vastgoedType: "Kantoor", zones: [{ functie: "kantoor", opp: "450", bouwprijs: "1600", markthuur: "135" }, { functie: "parking", opp: "12", markthuur: "900" }] });
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain("Oppervlakte per functie");
    expect(html).toContain("450 m²");
    expect(html).toContain("12 st.");
    expect(html).toContain("€ 71.550 per jaar");
    expect(html).not.toContain(">Bouwlaag<");
    // de manuele vervangingswaarde staat er niet als de kostenbenadering per functie geldt
    const metVw = { ...d, bedrijfsVervangingswaarde: "777777" };
    expect(buildPrintHtml(metVw, berekenWaardering(metVw), HUISSTIJLEN.houpels)).not.toContain("777.777");
  });

  it("residentieel houdt de bouwlagen en krijgt geen bedrijfskenmerken", () => {
    const d = basis({ ruimtes: [{ verdieping: "gelijkvloers", opp: "120", coeff: "1" }] });
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain("Bouwlaag");
    expect(html).not.toContain("Bedrijfskenmerken");
    expect(html).not.toContain("Krachtstroom");
  });
});

describe("AI-samenvatting en SWOT", () => {
  it("geeft de kenmerken van het type mee aan de AI en leidt er SWOT-punten uit af", () => {
    const d = basis({ vastgoedType: "Horeca", horecaBrouwerij: "Ja", horecaZitplaatsen: "60", bedrijfsEpcType: "EPC NR (niet-residentieel)", bedrijfsEpcLabel: "G", bedrijfsEpcOppervlakte: "900" });
    const tekst = buildPropertySummary(d);
    expect(tekst).toContain("Horeca — specifieke kenmerken: zitplaatsen binnen 60");
    expect(tekst).toContain("label G");
    const swot = genereerAutomatischeSwot(d);
    const alles = JSON.stringify(swot);
    expect(alles).toContain("brouwerijcontract");
    expect(alles).toContain("Renovatieplicht na overdracht");
  });
});
