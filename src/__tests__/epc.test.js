// Tests voor het EPC per vastgoedtype en de renovatieplicht (domein/epc.js). Regels: residentieel
// label A+–F (renovatieplicht bij E/F → D binnen 6 jaar), EPC NR label A–G/X (5 jaar geldig), EPC
// kNR label A+–F, kleine eenheid ≤ 500 m² → label C, grote eenheid → label E (+ label E vanaf
// 2030), industrieel gebruik > 70% buiten de regeling.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { epcRegime, epcLabelsVoor, epcGegevens, renovatieplicht, epcRapportRijen } from "../domein/epc.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { berekenWaardering } from "../domein/waardering.js";
import { initialData, HUISSTIJLEN } from "../constants.js";

const res = (o = {}) => ({ vastgoedType: "Residentieel", ...o });
const nr = (o = {}) => ({ vastgoedType: "Kantoor", bedrijfsEpcType: "EPC NR (niet-residentieel)", ...o });

describe("EPC per vastgoedtype", () => {
  it("gebruikt de juiste labelschaal", () => {
    expect(epcLabelsVoor(res())).toEqual(["A+", "A", "B", "C", "D", "E", "F"]);
    expect(epcLabelsVoor(nr())).toEqual(["A", "B", "C", "D", "E", "F", "G", "X"]);
    expect(epcLabelsVoor(nr({ bedrijfsEpcType: "EPC kNR (klein niet-residentieel, ≤ 500 m²)" }))).toEqual(["A+", "A", "B", "C", "D", "E", "F"]);
  });

  it("herkent ook de oudere omschrijvingen van het regime", () => {
    expect(epcRegime(nr({ bedrijfsEpcType: "EPC kNR (klein niet-residentieel)" }))).toBe("kNR");
    expect(epcRegime(nr({ bedrijfsEpcType: "Niet vereist / in onderzoek" }))).toBe("geen");
    expect(epcRegime(nr({ bedrijfsEpcType: "" }))).toBe("onbekend");
    expect(epcRegime({ vastgoedType: "Bedrijfsvastgoed", bedrijfsSubtype: "Kantoor", bedrijfsEpcType: "EPC NR (niet-residentieel)" })).toBe("NR");
  });

  it("rekent de geldigheid uit: residentieel 10 jaar, EPC NR 5 jaar", () => {
    expect(epcGegevens(res({ epcDatum: "2020-03-01" })).geldigTot).toBe("2030-03-01");
    const e = epcGegevens(nr({ bedrijfsEpcDatum: "2020-03-01", referentiedatum: "2026-10-01" }));
    expect(e.geldigTot).toBe("2025-03-01");
    expect(e.verlopen).toBe(true);
    expect(epcGegevens(nr({ bedrijfsEpcType: "EPC kNR (klein niet-residentieel, ≤ 500 m²)", bedrijfsEpcDatum: "2020-03-01" })).geldigTot).toBe("");
  });
});

describe("renovatieplicht", () => {
  it("residentieel: enkel bij label E of F, met label D binnen 6 jaar", () => {
    expect(renovatieplicht(res({ epcLabel: "F" })).tekst).toContain("binnen 6 jaar na de akte minstens label D");
    expect(renovatieplicht(res({ epcLabel: "C" })).tekst).toBe("");
  });

  it("grote niet-residentiële eenheid: label E, en het label-E-doel 2030", () => {
    const r = renovatieplicht(nr({ bedrijfsEpcLabel: "G", bedrijfsEpcOppervlakte: "1200" }));
    expect(r.tekst).toContain("minstens label E");
    expect(r.tekst).toContain("Vanaf 2030");
    expect(r.tekst).toContain("Met het huidige label G is een energetische renovatie dus nodig.");
    expect(r.waarschuwingen.some((w) => w.includes("vanaf 2030 minstens label E"))).toBe(true);
  });

  it("kleine eenheid (≤ 500 m² of kNR): label C, zonder 2030-vermelding", () => {
    const r = renovatieplicht(nr({ bedrijfsEpcLabel: "D", bedrijfsEpcOppervlakte: "300" }));
    expect(r.tekst).toContain("minstens label C");
    expect(r.tekst).not.toContain("Vanaf 2030");
    expect(r.tekst).toContain("Met het huidige label D");
    expect(renovatieplicht(nr({ bedrijfsEpcType: "EPC kNR (klein niet-residentieel, ≤ 500 m²)", bedrijfsEpcLabel: "B" })).tekst).toContain("label C");
  });

  it("industrie met > 70% industrieel gebruik valt erbuiten", () => {
    const d = { vastgoedType: "Industrie & logistiek", bedrijfsIndustrieelMeer70: "Ja", bedrijfsEpcType: "EPC NR (niet-residentieel)" };
    expect(epcRegime(d)).toBe("geen");
    expect(renovatieplicht(d).tekst).toContain("valt buiten het EPC NR en de renovatieplicht");
  });

  it("label X telt niet als slechter, maar krijgt een eigen waarschuwing", () => {
    const r = renovatieplicht(nr({ bedrijfsEpcLabel: "X", bedrijfsEpcOppervlakte: "2000" }));
    expect(r.tekst).not.toContain("renovatie dus nodig");
    expect(r.waarschuwingen).toContain("Label X: het EPC NR werd opgemaakt zonder meetgegevens.");
  });
});

describe("EPC in het verslag", () => {
  it("toont label, score, datum en geldigheid, en laat lege rijen weg", () => {
    const rijen = epcRapportRijen(nr({ bedrijfsEpcLabel: "C", bedrijfsEpcWaarde: "310", bedrijfsEpcDatum: "2024-05-02" }));
    const map = Object.fromEntries(rijen);
    expect(map["EPC-label"]).toBe("C");
    expect(map["Energiescore"]).toBe("310 kWh/m² per jaar");
    expect(map["Geldig tot"]).toBe("02/05/2029");
    expect(map["Bruikbare vloeroppervlakte volgens het EPC"]).toBe("");
  });

  it("zet het EPC en de renovatieplicht van een kantoor in de PDF", () => {
    const d = { ...initialData, vastgoedType: "Kantoor", bedrijfsEpcType: "EPC NR (niet-residentieel)", bedrijfsEpcLabel: "F", bedrijfsEpcOppervlakte: "800",
      ruimtes: [{ opp: "800", coeff: "1" }], schijven: [{ opp: "1500", prijs: "120" }], bedrijfsPrijsPerM2: "1100", extraPanden: [], parkeerplaatsenGarages: [] };
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain("Energieprestatie (EPC)");
    expect(html).toContain("Bij een overdracht van een niet-residentiële eenheid geldt een renovatieplicht");
    expect(html).toContain("Kantoor");
  });

  it("zet bij een woning met label F de renovatieplicht in de PDF", () => {
    const d = { ...initialData, epcLabel: "F", epcWaarde: "620", ruimtes: [{ opp: "150", coeff: "1" }], schijven: [{ opp: "600", prijs: "200" }], grondopp: "600", extraPanden: [], parkeerplaatsenGarages: [] };
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain("620 kWh/m² per jaar");
    expect(html).toContain("minstens label D halen");
  });
});
