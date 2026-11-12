// Tests voor de uitsnede van de voorbladfoto (domein/voorbladFoto.js) en het voorblad in het
// verslag (wVoorblad in rapport/html.js): zonder instelling blijft het voorblad zoals vroeger
// (gecentreerd bijsnijden in een kader van 178 × 96 mm), met een instelling volgt het verslag
// exact wat de schatter-expert op het tabblad Foto's koos.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { normaliseerUitsnede, voorbladFotoCss, voorbladFotoStijl, verschuiving, UITSNEDE_STANDAARD } from "../domein/voorbladFoto.js";
import { wVoorblad } from "../rapport/html.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { berekenWaardering } from "../domein/waardering.js";
import { initialData, HUISSTIJLEN } from "../constants.js";

const FOTO = "data:image/jpeg;base64,/9j/AAAA";
const voorblad = (fotoUitsnede) => wVoorblad({ hs: HUISSTIJLEN.houpels, d: { ...initialData }, titel: "Kerkstraat 4", fotoSrc: FOTO, fotoUitsnede });

describe("uitsnede normaliseren", () => {
  it("valt zonder instelling terug op gecentreerd bijsnijden zonder zoom", () => {
    expect(normaliseerUitsnede(null)).toEqual(UITSNEDE_STANDAARD);
    expect(normaliseerUitsnede(undefined)).toEqual({ modus: "bijsnijden", x: 50, y: 50, zoom: 1 });
  });
  it("begrenst positie en zoom en kent enkel de twee modi", () => {
    expect(normaliseerUitsnede({ modus: "iets", x: -20, y: 140, zoom: 9 })).toEqual({ modus: "bijsnijden", x: 0, y: 100, zoom: 4 });
    expect(normaliseerUitsnede({ modus: "volledig", x: "30", y: "abc", zoom: 0.2 })).toEqual({ modus: "volledig", x: 30, y: 50, zoom: 1 });
  });
});

describe("stijl van kader en foto", () => {
  it("houdt het kader op de verhouding van het voorblad (178 × 96 mm)", () => {
    expect(voorbladFotoCss(null).kader).toContain("aspect-ratio:178/96");
    expect(voorbladFotoStijl(null).kader.aspectRatio).toBe("178/96");
  });
  it("bijsnijden: positie en zoom rond hetzelfde punt", () => {
    const css = voorbladFotoCss({ modus: "bijsnijden", x: 20, y: 80, zoom: 1.5 }).foto;
    expect(css).toContain("object-fit:cover");
    expect(css).toContain("object-position:20% 80%");
    expect(css).toContain("transform:scale(1.5)");
    expect(css).toContain("transform-origin:20% 80%");
  });
  it("hele foto: contain, zonder verschuiving of zoom", () => {
    const css = voorbladFotoCss({ modus: "volledig", x: 10, y: 10, zoom: 3 }).foto;
    expect(css).toContain("object-fit:contain");
    expect(css).toContain("object-position:50% 50%");
    expect(css).not.toContain("transform");
  });
  it("de app en het verslag gebruiken exact dezelfde stijl", () => {
    const u = { modus: "bijsnijden", x: 33, y: 66, zoom: 2 };
    expect(voorbladFotoStijl(u).foto.objectPosition).toBe("33% 66%");
    expect(voorbladFotoCss(u).foto).toContain(`left:0;top:0;`);
  });
});

describe("slepen", () => {
  it("een brede foto in het kader: horizontaal te verschuiven, verticaal niet (zonder zoom)", () => {
    // kader 356 × 192 px, foto 4000 × 1000 px → geschaald naar 768 × 192 px, steekt 412 px uit
    expect(verschuiving(-41.2, 356, 4000, 192, 1000, 1)).toBeCloseTo(10, 6); // naar links slepen = meer van rechts
    expect(verschuiving(20, 192, 1000, 356, 4000, 1)).toBe(0);
  });
  it("met zoom kan je ook langs de andere as verschuiven", () => {
    expect(verschuiving(19.2, 192, 1000, 356, 4000, 2)).toBeCloseTo(-10, 6); // bereik = 192 × (2 − 1)
  });
  it("valt niet om zonder afmetingen", () => {
    expect(verschuiving(10, 0, 0, 0, 0, 1)).toBe(0);
  });
});

describe("voorblad in het verslag", () => {
  it("zonder instelling: zoals vroeger gecentreerd bijgesneden, in een kader van 178 × 96 mm", () => {
    const html = voorblad(null);
    expect(html).toContain("aspect-ratio:178/96");
    expect(html).toContain("object-fit:cover;object-position:50% 50%;");
    expect(html).not.toContain("height:96mm");
  });
  it("volgt de gekozen uitsnede en de keuze 'hele foto'", () => {
    expect(voorblad({ modus: "bijsnijden", x: 10, y: 90, zoom: 1.25 })).toContain("object-position:10% 90%;transform:scale(1.25)");
    expect(voorblad({ modus: "volledig" })).toContain("object-fit:contain");
  });
  it("neemt de uitsnede van het dossier mee in de PDF", () => {
    const d = { ...initialData, voorpaginaFoto: { id: "v", base64: FOTO }, voorpaginaUitsnede: { modus: "bijsnijden", x: 15, y: 70, zoom: 1.5 },
      ruimtes: [{ verdieping: "gelijkvloers", opp: "120", coeff: "1" }], schijven: [{ opp: "500", prijs: "200" }], grondopp: "500", extraPanden: [], parkeerplaatsenGarages: [] };
    expect(buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels)).toContain("object-position:15% 70%;transform:scale(1.5)");
  });
  it("zonder foto geen kader", () => {
    expect(wVoorblad({ hs: HUISSTIJLEN.houpels, d: { ...initialData }, titel: "x", fotoSrc: "" })).not.toContain("aspect-ratio");
  });
});
