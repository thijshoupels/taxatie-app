// Tests voor de vormgeving van het verslag: voorblad (wVoorblad), cijfertabel en conclusiekader
// van de waardering (wCijferTabel/wWaardeConclusie), het ingesloten lettertype voor de PDF
// (rapport/lettertypes.js) en de opbouw van de volledige PDF-HTML (buildPrintHtml).
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { wVoorblad, wCijferTabel, wWaardeConclusie, vorkPosities, veiligeKleur, RAPPORT_LETTER } from "../rapport/html.js";
import { buildPrintHtml, waarderingConclusieHtml } from "../rapport/bouwers.js";
import { isLettertypeBestand, lettertypeCssUitBytes } from "../rapport/lettertypes.js";
import { berekenWaardering, rapportWaarderingsBlokken } from "../domein/waardering.js";
import { initialData, maakLeegPand, HUISSTIJLEN } from "../constants.js";

const dossier = (o = {}) => ({
  ...initialData, id: "d1", straat: "Negenoogstraat", nummer: "3", postcode: "9140", gemeente: "Temse", reden: "Nalatenschap",
  opdrachtgeverNaam: "Familie Peeters", referentiedatum: "2026-08-03", datumVerslag: "2026-10-12", schatterNaam: "Thijs Houpels",
  ruimtes: [{ opp: "180", coeff: "1" }], schijven: [{ opp: "800", prijs: "200" }], grondopp: "800", extraPanden: [], parkeerplaatsenGarages: [], ...o,
});

describe("voorblad", () => {
  it("toont soort verslag + reden, het adres en de kerngegevens", () => {
    const html = wVoorblad({ hs: HUISSTIJLEN.houpels, d: dossier(), titel: "Negenoogstraat 3", subtitel: "9140 Temse" });
    expect(html).toContain("Taxatieverslag · Nalatenschap");
    expect(html).toContain("Negenoogstraat 3");
    expect(html).toContain("9140 Temse");
    expect(html).toContain("Familie Peeters");
    expect(html).toContain("Referentiedatum");
    expect(html).toContain("Thijs Houpels");
    expect(html).toContain("#8C6A2F");
  });

  it("laat lege kerngegevens en een ontbrekende foto weg", () => {
    const html = wVoorblad({ hs: HUISSTIJLEN.houpels, d: dossier({ opdrachtgeverNaam: "", referentiedatum: "" }), titel: "X" });
    expect(html).not.toContain("Opdrachtgever");
    expect(html).not.toContain("Referentiedatum");
    expect(html).not.toContain("<img");
  });

  it("escapet vrije tekst, weigert externe afbeeldingen en ongeldige kleuren", () => {
    const html = wVoorblad({ hs: { naam: "<b>X</b>", kleur: "red;background:url(x)", logo: null }, d: dossier({ opdrachtgeverNaam: "<script>x</script>" }), titel: "T", fotoSrc: "https://elders.example/foto.jpg" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>X</b>");
    expect(html).not.toContain("elders.example");
    expect(html).not.toContain("url(x)");
    expect(veiligeKleur("#1A2b3C")).toBe("#1A2b3C");
    expect(veiligeKleur("javascript:")).toBe("#8C6A2F");
  });

  it("neemt een ingesloten voorpaginafoto wel op", () => {
    const html = wVoorblad({ hs: HUISSTIJLEN.houpels, d: dossier(), titel: "T", fotoSrc: "data:image/jpeg;base64,AAAA" });
    expect(html).toContain('src="data:image/jpeg;base64,AAAA"');
  });
});

describe("waardering in het verslag", () => {
  it("zet bedragen rechts en uitkomsten vet, en laat lege rijen weg", () => {
    const html = wCijferTabel([["Klasse", "Gewoon huis"], ["Leeg", ""], ["Intrinsieke waarde", "€ 226.966", true]]);
    expect(html).toContain("text-align:right");
    expect(html).not.toContain("Leeg");
    expect(html.match(/font-weight:700/g).length).toBe(2);
  });

  it("markeert de uitkomsten in het gedeelde waarderingsmodel", () => {
    const d = dossier({ huurMaand: "1150", yieldVan: "4.8", yieldTot: "5.2", yieldStap: "0.2" });
    const blokken = rapportWaarderingsBlokken(d, berekenWaardering(d));
    const rij = (titel, label) => blokken.find((b) => b.titel === titel).rijen.find((r) => r[0] === label);
    expect(rij("Waardering op basis van vervangingswaarde", "Intrinsieke waarde")[2]).toBe(true);
    expect(rij("Waardering op basis van vervangingswaarde", "Klasse")[2]).toBeUndefined();
    const dcf = blokken.find((b) => b.titel === "Rendementsbenadering (DCF)").rijen;
    expect(dcf[dcf.length - 1][2]).toBe(true);
    expect(rij("Prijsvork venale waarde", "Prijsvork")[2]).toBe(true);
  });

  it("toont de venale waarde groot met de prijsvork als balk", () => {
    const html = wWaardeConclusie({ waarde: 228606, prijsvork: { minimum: 222000, maximum: 235000 } });
    expect(html).toMatch(/€\s228\.606/);
    expect(html).toMatch(/€\s222\.000 – €\s235\.000/);
    expect(html).toContain("break-inside:avoid");
    const p = vorkPosities(222000, 235000, 228606);
    expect(p.min).toBeLessThan(p.waarde);
    expect(p.waarde).toBeLessThan(p.max);
  });

  it("toont zonder prijsvork enkel de waarde", () => {
    const html = wWaardeConclusie({ waarde: 300000, prijsvork: null });
    expect(html).not.toContain("Prijsvork");
  });

  it("houdt het prijsvork-blok samen met de conclusie", () => {
    const d = dossier();
    const html = waarderingConclusieHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html.indexOf("Prijsvork venale waarde")).toBeLessThan(html.indexOf("Venale waarde<"));
    expect(html.startsWith('<div style="break-inside:avoid;')).toBe(true);
  });
});

describe("PDF-HTML", () => {
  it("gebruikt één schreefloze letter (geen Georgia/Arial meer, die bestaan niet op de PDF-server)", () => {
    const d = dossier();
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).not.toMatch(/Georgia|Times New Roman/);
    expect(html).toContain(RAPPORT_LETTER);
    expect(html).toContain("Taxatieverslag · Nalatenschap");
    expect(html.indexOf("Waardering op basis van vervangingswaarde")).toBeLessThan(html.indexOf("Prijsvork venale waarde"));
  });

  it("sluit het lettertype in wanneer het meegegeven wordt", () => {
    const d = dossier();
    const css = "@font-face { font-family: 'Schibsted Grotesk'; src: url(data:font/ttf;base64,AAAA) format('truetype'); }";
    expect(buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels, { lettertypeCss: css })).toContain(css);
  });

  it("toont bij meerdere panden het totaal met de totale prijsvork", () => {
    const d = dossier({ extraPanden: [{ ...maakLeegPand("Pand 2"), straat: "Kasteelstraat", nummer: "12", postcode: "9100", gemeente: "Sint-Niklaas", grondopp: "400", ruimtes: [{ opp: "95", coeff: "1" }], schijven: [{ opp: "400", prijs: "250" }] }] });
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain("Totale venale waarde (alle panden)");
    expect(html).toContain("Totale prijsvork");
    expect(html).toContain("Taxatieverslag — meerdere panden · Nalatenschap");
  });
});

describe("ingesloten lettertype", () => {
  it("herkent een lettertypebestand en weigert iets anders (bv. een HTML-pagina)", () => {
    expect(isLettertypeBestand(new Uint8Array([0, 1, 0, 0, 9]))).toBe(true);
    expect(isLettertypeBestand(new Uint8Array([79, 84, 84, 79]))).toBe(true);
    expect(isLettertypeBestand(new TextEncoder().encode("<!doctype html>"))).toBe(false);
    expect(isLettertypeBestand(new Uint8Array([]))).toBe(false);
  });

  it("maakt er een @font-face met data-URL van", () => {
    const css = lettertypeCssUitBytes(new Uint8Array([0, 1, 0, 0, 65, 66]));
    expect(css).toContain("font-family: 'Schibsted Grotesk'");
    expect(css).toContain("url(data:font/ttf;base64,AAEAAEFC)");
    expect(lettertypeCssUitBytes(new TextEncoder().encode("<html>"))).toBe("");
  });
});
