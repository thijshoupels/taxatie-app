// Tests voor de sjabloon- en echtscheidingsverbeteringen uit de nalezing van een verslag: het
// juiste aantal bladzijden (merker voor de PDF-server), lege rubrieken zonder kop, de gedwongen
// verkoopwaarde per reden, de echtscheidingsgegevens, het voorblad met vennootschap en adres, en
// omschrijvingen bij de geraadpleegde stukken.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("../data/supabase.js", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../data/supabase.js";
import { haalKantoorHuisstijl } from "../data/kantoren.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { voorafgaandeOpmerkingen } from "../rapport/html.js";
import { berekenWaardering, rapportWaarderingsBlokken } from "../domein/waardering.js";
import { inhoudelijkeControles } from "../domein/controles.js";
import { initialData, HUISSTIJLEN } from "../constants.js";

const dossier = (o = {}) => ({
  ...initialData, extraPanden: [], parkeerplaatsenGarages: [], straat: "Drieschouwen", nummer: "64", gemeente: "Stekene",
  ruimtes: [{ verdieping: "gelijkvloers", opp: "150", coeff: "1" }], schijven: [{ opp: "800", prijs: "200" }], grondopp: "800", ...o,
});
const pdf = (d) => buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);

describe("aantal bladzijden", () => {
  it("markeert het geschatte aantal zodat de PDF-server het door het echte aantal vervangt", () => {
    const html = pdf(dossier());
    const m = /Het verslag bestaat uit <span data-paginatotaal="1">([a-zë]+) \((\d+)\)<\/span> bladzijden\./.exec(html);
    expect(m).toBeTruthy();
    // dezelfde reguliere expressie als in api/generate-pdf.js
    const api = fs.readFileSync(path.join(process.cwd(), "api/generate-pdf.js"), "utf8");
    const re = /finaleHtml\.replace\((\/<span data-paginatotaal[^,]+\/g),/.exec(api);
    expect(re).toBeTruthy();
    const regex = new Function(`return ${re[1]};`)();
    expect(html.replace(regex, "<span data-paginatotaal=\"1\">achttien (18)</span>")).toContain("Het verslag bestaat uit <span data-paginatotaal=\"1\">achttien (18)</span> bladzijden.");
  });
});

describe("voorafgaande opmerkingen en rubrieken", () => {
  it("geeft de verklaring een onderwerp en vermeldt bij een echtscheiding de andere partij", () => {
    const z = voorafgaandeOpmerkingen(dossier({ reden: "Echtscheiding", echtAnderePartij: "Op de hoogte, niet aanwezig" }), 12);
    expect(z.join(" ")).toContain("De schatter-expert verklaart dat het taxatieverslag is opgemaakt");
    expect(z).toContain("De andere partij was op de hoogte van het plaatsbezoek, maar was niet aanwezig.");
    expect(voorafgaandeOpmerkingen(dossier(), 12).join(" ")).not.toContain("andere partij");
  });

  it("laat een lege rubriek verkoper weg en toont de echtscheidingsgegevens", () => {
    const html = pdf(dossier({ reden: "Echtscheiding", echtEigendom: "Eigen goed van één partner", echtVraagstelling: "Venale waarde met en zonder de renovatie.", echtWaardeZonderWerken: "480000" }));
    expect(html).not.toContain("Contactgegevens verkoper");
    expect(html).toContain("Eigen goed van één partner");
    expect(html).toContain("Venale waarde met en zonder de renovatie.");
    expect(html).toMatch(/Waarde zonder de werken[\s\S]{0,400}480\.000/);
    expect(pdf(dossier({ verkoperNaam: "J. Peeters" }))).toContain("Contactgegevens verkoper");
  });

  it("toont de vennootschap en het adres op het voorblad, en de omschrijving van een stuk", () => {
    const html = pdf(dossier({ documenten: [{ id: "x", naam: "download-1793.pdf", type: "application/pdf", omschrijving: "Kadastraal plan" }] }));
    expect(html).toContain("Houpels Valuation &amp; Real Estate CommV");
    expect(html).toContain("Oude Heirbaan 27, 9140 Tielrode");
    expect(html).toContain("Kadastraal plan");
    expect(html).not.toContain("download-1793.pdf");
  });
});

describe("gedwongen verkoopwaarde per reden", () => {
  const heeft = (d) => rapportWaarderingsBlokken(d, berekenWaardering(d)).some((b) => b.titel === "Gedwongen verkoop");
  it("staat enkel standaard in het verslag bij hypothecair krediet of gerechtelijk", () => {
    expect(heeft(dossier({ reden: "Echtscheiding" }))).toBe(false);
    expect(heeft(dossier({ reden: "Nalatenschap" }))).toBe(false);
    expect(heeft(dossier({ reden: "Hypothecair krediet" }))).toBe(true);
    expect(heeft(dossier({ reden: "Echtscheiding", gedwongenVerkoopTonen: "Ja" }))).toBe(true);
    expect(heeft(dossier({ reden: "Gerechtelijk", gedwongenVerkoopTonen: "Nee" }))).toBe(false);
    // dossiers in rekenversie 1 houden haar zoals vroeger
    expect(heeft(dossier({ reden: "Echtscheiding", rekenversie: 1 }))).toBe(true);
  });
  it("vermeldt de prijsvork dan ook niet dat ze er buiten valt", () => {
    const c = berekenWaardering(dossier({ reden: "Echtscheiding" }));
    expect(c.prijsvork.motivering).not.toContain("gedwongen verkoopwaarde");
  });
});

describe("controles op vorm en echtscheiding", () => {
  it("vraagt omschrijvingen, nagekeken omgevingsgegevens en de echtscheidingsgegevens", () => {
    const d = dossier({ reden: "Echtscheiding", documenten: [{ id: "x", naam: "a.jpg" }], liggingOpgezochtAdres: "Drieschouwen 64, Stekene", gedwongenVerkoopTonen: "Ja" });
    const c = inhoudelijkeControles(d, berekenWaardering(d)).join(" ");
    expect(c).toContain("1 geraadpleegd stuk heeft geen omschrijving");
    expect(c).toContain("nog niet als nagekeken bevestigd");
    expect(c).toContain("vermeld of de andere partij op de hoogte was");
    expect(c).toContain("noteer de exacte vraagstelling");
    expect(c).toContain("geeft de partij die het pand overneemt een lager ankerpunt");
    expect(inhoudelijkeControles({ ...d, liggingNagekeken: true }, berekenWaardering(d)).join(" ")).not.toContain("nagekeken bevestigd");
  });
});

describe("huisstijl van het kantoor", () => {
  it("geeft het adres van het kantoor mee, en voor Houpels de vennootschapsnaam", async () => {
    const single = async () => ({ data: { naam: "Houpels Valuation & Real Estate", kleur: "#8C6A2F", logo: null, adres: "" }, error: null });
    supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });
    const hs = await haalKantoorHuisstijl("kantoor-houpels");
    expect(hs.juridischeNaam).toBe("Houpels Valuation & Real Estate CommV");
    expect(hs.adres).toBe("Oude Heirbaan 27, 9140 Tielrode");
    const single2 = async () => ({ data: { naam: "Huyzen Vastgoed", kleur: "#0093D3", logo: null, adres: "Markt 1, Beveren" }, error: null });
    supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ single: single2 }) }) });
    expect(await haalKantoorHuisstijl("kantoor-huyzen")).toEqual({ naam: "Huyzen Vastgoed", kleur: "#0093D3", logo: null, adres: "Markt 1, Beveren" });
  });
});
