// Tests voor de vastgoedtypes (domein/vastgoedtypes.js): de nieuwe indeling (Residentieel, vijf
// bedrijfstypes, Garage) en het omzetten van oudere dossiers ("KMO-vastgoed", "Bedrijfsvastgoed"
// + subtype).
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import {
  VASTGOEDTYPES, BEDRIJFSTYPES, normaliseerType, typeVan, isBedrijfsmatig, isGarage, isResidentieelType,
  bedrijfstypeVan, categorieVan, normaliseerVastgoedtype, PAND_PER_BEDRIJFSTYPE,
} from "../domein/vastgoedtypes.js";
import { berekenWaardering } from "../domein/waardering.js";
import { initialData, OPTS } from "../constants.js";

describe("vastgoedtypes", () => {
  it("biedt Residentieel, vijf bedrijfstypes en Garage aan", () => {
    expect(OPTS.vastgoedType).toEqual(["Residentieel", "Kantoor", "KMO-unit / gemengd", "Industrie & logistiek", "Retail", "Horeca", "Garage / Staanplaats"]);
    expect(VASTGOEDTYPES).toEqual(OPTS.vastgoedType);
    for (const t of BEDRIJFSTYPES) expect(PAND_PER_BEDRIJFSTYPE[t].length).toBeGreaterThan(1);
  });

  it("zet oudere dossiers om naar het nieuwe type", () => {
    expect(normaliseerType("KMO-vastgoed")).toBe("KMO-unit / gemengd");
    expect(normaliseerType("Bedrijfsvastgoed", "Kantoor")).toBe("Kantoor");
    expect(normaliseerType("Bedrijfsvastgoed", "Winkel")).toBe("Retail");
    expect(normaliseerType("Bedrijfsvastgoed", "Industrieel/logistiek")).toBe("Industrie & logistiek");
    expect(normaliseerType("Bedrijfsvastgoed", "Horeca")).toBe("Horeca");
    expect(normaliseerType("Bedrijfsvastgoed", "")).toBe("KMO-unit / gemengd");
    expect(normaliseerType(undefined)).toBe("Residentieel");
    expect(normaliseerType("Kantoor")).toBe("Kantoor");
  });

  it("normaliseert een dossier en laat een reeds omgezet dossier ongemoeid", () => {
    const oud = { vastgoedType: "Bedrijfsvastgoed", bedrijfsSubtype: "Winkel", straat: "X" };
    expect(normaliseerVastgoedtype(oud)).toEqual({ vastgoedType: "Retail", bedrijfsSubtype: "", straat: "X" });
    const nieuw = { vastgoedType: "Retail", bedrijfsSubtype: "" };
    expect(normaliseerVastgoedtype(nieuw)).toBe(nieuw);
  });

  it("deelt elk type in bij de juiste categorie", () => {
    expect(isBedrijfsmatig({ vastgoedType: "Kantoor" })).toBe(true);
    expect(isBedrijfsmatig({ vastgoedType: "KMO-vastgoed" })).toBe(true);
    expect(isBedrijfsmatig({ vastgoedType: "Residentieel" })).toBe(false);
    expect(isGarage({ vastgoedType: "Garage / Staanplaats" })).toBe(true);
    expect(isResidentieelType({})).toBe(true);
    expect(bedrijfstypeVan({ vastgoedType: "Bedrijfsvastgoed", bedrijfsSubtype: "Kantoor" })).toBe("Kantoor");
    expect(bedrijfstypeVan({ vastgoedType: "Residentieel" })).toBe("");
    expect(categorieVan({ vastgoedType: "Horeca" })).toBe("bedrijfsmatig");
    expect(typeVan({ vastgoedType: "Bedrijfsvastgoed", bedrijfsSubtype: "Winkel" })).toBe("Retail");
  });

  it("rekent met de nieuwe types exact zoals met de oude (12 maanden huur, geen ABEX-controle)", () => {
    const basis = { ...initialData, ruimtes: [{ opp: "400", coeff: "1" }], schijven: [{ opp: "1000", prijs: "80" }], bedrijfsPrijsPerM2: "900", huurMaand: "3000", yieldVan: "7", yieldTot: "7", yieldStap: "0.5" };
    const oud = berekenWaardering({ ...basis, vastgoedType: "Bedrijfsvastgoed", bedrijfsSubtype: "Kantoor" });
    const nieuw = berekenWaardering({ ...basis, vastgoedType: "Kantoor" });
    expect(nieuw.venaleWaarde).toBeCloseTo(oud.venaleWaarde, 6);
    expect(nieuw.huurMaandenPerJaar).toBe(12);
    expect(nieuw.gebruiktBedrijfsPrijsPerM2).toBe(true);
  });
});
