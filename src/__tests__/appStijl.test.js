// Tests voor de app-stijl "grafiet & messing" (index.css + constants.js): de verslagkleuren van de
// huisstijl blijven ongewijzigd, de lettertypes worden zelf gehost (de CSP in vercel.json laat
// enkel font-src 'self' toe) en het grafiet vlak (.schil) herdefinieert de gewone tokens.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { BRASS, BRASS_SOFT, STAMP, STAMP_SOFT, DANGER, SANS, MONO, OK, INK, PAPER } from "../constants.js";

// naast dit testbestand (src/__tests__ → src/index.css), anders vanuit de projectmap
const kandidaten = [fileURLToPath(new URL("../index.css", import.meta.url)), resolve(process.cwd(), "src/index.css")];
const css = readFileSync(kandidaten.find((p) => existsSync(p)) || kandidaten[0], "utf8");

describe("app-stijl grafiet & messing", () => {
  it("laat de verslagkleuren van de huisstijl ongemoeid", () => {
    expect([BRASS, BRASS_SOFT, STAMP, STAMP_SOFT, DANGER]).toEqual(["#8C6A2F", "#F1E9D6", "#2F5B4F", "#E4EEEB", "#9A3B2E"]);
  });

  it("verwijst voor letters en kleuren naar de CSS-variabelen", () => {
    expect([SANS, MONO, OK, INK, PAPER]).toEqual(["var(--font-sans)", "var(--font-mono)", "var(--ok)", "var(--ink)", "var(--paper)"]);
  });

  it("host de lettertypes zelf en laadt niets van Google Fonts (CSP: font-src 'self')", () => {
    expect(css).toContain('url("/fonts/SchibstedGrotesk-VariableFont_wght.ttf")');
    expect(css).toContain('url("/fonts/SplineSansMono-VariableFont_wght.ttf")');
    expect(css).not.toMatch(/fonts\.googleapis|fonts\.gstatic|@import\s+url/);
    expect(css).toMatch(/font-display:\s*swap/);
  });

  it("definieert het grafiet vlak .schil met eigen waarden voor de gewone tokens", () => {
    const schil = css.slice(css.indexOf(".schil {"), css.indexOf("}", css.indexOf(".schil {")));
    for (const token of ["--ink:", "--ink-soft:", "--paper:", "--paper-raised:", "--line:", "--accent:", "--ok:"]) {
      expect(schil).toContain(token);
    }
  });

  it("definieert elke kleurtoken ook voor de donkere modus (systeem én knop)", () => {
    const blok = (start) => css.slice(css.indexOf(start), css.indexOf("}", css.indexOf(start)));
    const licht = blok(":root {");
    const knop = blok(':root[data-theme="dark"] {');
    for (const token of ["--ink:", "--paper:", "--paper-raised:", "--line:", "--accent:", "--ok:", "--ok-soft:", "--waarschuwing:", "--shell:"]) {
      expect(licht).toContain(token);
      expect(knop).toContain(token);
    }
  });
});
