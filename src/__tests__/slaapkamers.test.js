// Slaapkamers: "Verwarming" (ja/nee) in plaats van Radiator — op het scherm en in het verslag.
// Het veld heet intern nog "radiator", zodat bestaande dossiers hun antwoord behouden.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { berekenWaardering } from "../domein/waardering.js";
import { initialData, maakLeegPand, HUISSTIJLEN } from "../constants.js";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), "src", f), "utf8");

describe("slaapkamers: verwarming ja/nee", () => {
  it("het verslag toont de kolom Verwarming met het bestaande antwoord", () => {
    const d = {
      ...initialData, extraPanden: [], parkeerplaatsenGarages: [], straat: "Kerkstraat", nummer: "4", postcode: "9120", gemeente: "Beveren",
      slaapkamers: [{ id: 1, naam: "Slaapkamer 1", vloer: "Parket", verdieping: "1e verdieping", ingemaaktKasten: "Nee", radiator: "Ja" }],
    };
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain(">Verwarming<");
    expect(html).not.toMatch(/>Radiator</);
    const rij = html.slice(html.indexOf("Slaapkamer 1"), html.indexOf("Slaapkamer 1") + 400);
    expect(rij).toContain("Ja");
  });
  it("het scherm en de voorvertoning zeggen nergens nog Radiator", () => {
    for (const f of ["stappen/StepRuimteEigenschappen.jsx", "rapport/StepRapport.jsx", "rapport/bouwers.js"]) {
      expect(lees(f)).not.toMatch(/"Radiator"|>Radiator</);
    }
    expect(lees("stappen/StepRuimteEigenschappen.jsx")).toContain('updateSlaapkamer(s.id, "radiator", e.target.value)');
  });

  it("een nieuwe slaapkamer staat niet voorgeselecteerd, en het verslag toont dan een streepje", () => {
    expect(initialData.slaapkamers[0].radiator).toBe("");
    expect(maakLeegPand().slaapkamers[0].radiator).toBe("");
    const wizard = lees("schermen/DossierWizard.jsx");
    expect(wizard).not.toContain('radiator: "Nee"');
    expect((wizard.match(/ingemaaktKasten: "Nee", radiator: "" \}/g) || []).length).toBe(2);
    expect(lees("stappen/StepRuimteEigenschappen.jsx")).toContain('leeg="Kies" value={s.radiator || ""}');
    const d = {
      ...initialData, extraPanden: [], parkeerplaatsenGarages: [], straat: "Kerkstraat", nummer: "4", postcode: "9120", gemeente: "Beveren",
      slaapkamers: [{ id: 1, naam: "Slaapkamer 9", vloer: "", verdieping: "", ingemaaktKasten: "Nee", radiator: "" }],
    };
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    const rij = html.slice(html.indexOf("Slaapkamer 9"), html.indexOf("</tr>", html.indexOf("Slaapkamer 9")));
    expect(rij).not.toContain(">Ja<");
    expect(rij.match(/>—</g).length).toBe(3); // vloer, verdieping en verwarming
    // het voorbeeld op het tabblad Rapport is sinds nov. 2026 exact deze HTML (zie StepRapport.jsx)
    expect(lees("rapport/StepRapport.jsx")).toContain("buildPrintHtml(d, calc, hs, { lettertypeCss })");
  });
});
