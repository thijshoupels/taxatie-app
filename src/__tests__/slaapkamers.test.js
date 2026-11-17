// Slaapkamers: "Verwarming" (ja/nee) in plaats van Radiator — op het scherm en in het verslag.
// Het veld heet intern nog "radiator", zodat bestaande dossiers hun antwoord behouden.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { berekenWaardering } from "../domein/waardering.js";
import { initialData, HUISSTIJLEN } from "../constants.js";

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
});
