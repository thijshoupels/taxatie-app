// Tests voor het ondernemingsnummer (domein/kbo.js), zoals een kantoor-beheerder het invult op
// Kantoor-instellingen en zoals het op het voorblad komt.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { isGeldigKbo, schrijfKbo, kboCijfers } from "../domein/kbo.js";

describe("ondernemingsnummer", () => {
  it("herkent een geldig nummer, ook als btw-nummer of zonder punten", () => {
    expect(isGeldigKbo("BE1028139622")).toBe(true);
    expect(isGeldigKbo("BE 1028.139.622")).toBe(true);
    expect(isGeldigKbo("1028139622")).toBe(true);
  });
  it("weigert een fout controlegetal of een verkeerde lengte", () => {
    expect(isGeldigKbo("1028139623")).toBe(false);
    expect(isGeldigKbo("102813962")).toBe(false);
    expect(isGeldigKbo("")).toBe(false);
  });
  it("schrijft een geldig nummer als 0123.456.789 en laat een ongeldig ongemoeid", () => {
    expect(schrijfKbo("BE1028139622")).toBe("1028.139.622");
    expect(schrijfKbo(" 1234 ")).toBe("1234");
  });
  it("vult een oud nummer van 9 cijfers aan met een 0", () => {
    expect(kboCijfers("BE 403.170.701")).toBe("0403170701");
  });
});
