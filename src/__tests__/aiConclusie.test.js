// Tests voor het AI-voorstel voor de conclusie (data/aiConclusie.js): enkel voor de
// platform-beheerder, en zonder persoonsgegevens, straat of vergelijkingspunten naar de AI.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { magAiConclusie, bouwConclusieContext, bouwConclusiePrompt, genereerAiConclusie } from "../data/aiConclusie.js";
import { berekenWaardering } from "../domein/waardering.js";
import { initialData } from "../constants.js";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), "src", f), "utf8");
const dossier = (o = {}) => ({
  ...initialData, extraPanden: [], parkeerplaatsenGarages: [], reden: "Verkoop",
  straat: "Kerkstraat", nummer: "4", postcode: "9120", gemeente: "Beveren",
  opdrachtgeverNaam: "Eva Braem", eigenaars: [{ id: 1, naam: "Jan Peeters", recht: "Volle eigendom", aandeel: "" }],
  overledenNaam: "Maria Claes", huurderNaam: "Piet Huurder",
  bouwtype: "Open", gevel: "4-gevel", bouwjaar: "1985",
  ruimtes: [{ verdieping: "gelijkvloers", opp: "150", coeff: "1" }], schijven: [{ naam: "Bouwgrond", opp: "800", prijs: "250" }], grondopp: "800",
  sterktes: "Ruime tuin\nRustige ligging", zwaktes: "Verouderde keuken", kansen: "", bedreigingen: "",
  vergelijkingspunten: [{ id: "v", adres: "Heistraat 99, Beveren", belastbareGrondslag: "325000", meetellen: true }],
  documenten: [{ id: "doc", naam: "akte.pdf", notities: "Verkoper: Jan Peeters, erfdienstbaarheid van uitweg" }],
  ...o,
});

describe("AI-voorstel voor de conclusie", () => {
  it("is enkel voor de platform-beheerder", () => {
    expect(magAiConclusie({ isPlatformBeheerder: true })).toBe(true);
    expect(magAiConclusie({ isPlatformBeheerder: false, isAdmin: true })).toBe(false);
    expect(magAiConclusie({})).toBe(false);
    expect(magAiConclusie(null)).toBe(false);
  });

  it("stuurt geen namen, straat, vergelijkingspunten of documentnotities mee", () => {
    const d = dossier();
    const ctx = bouwConclusieContext(d, berekenWaardering(d));
    for (const verboden of ["Eva Braem", "Jan Peeters", "Maria Claes", "Piet Huurder", "Kerkstraat", "Heistraat", "325000", "erfdienstbaarheid", "Eigendomstoestand", "vergelijkingspunten"]) {
      expect(ctx).not.toContain(verboden);
    }
    expect(ctx).toContain("Ligging: 9120 Beveren");
  });

  it("geeft de SWOT en de uitkomst van de waardering mee", () => {
    const d = dossier();
    const calc = berekenWaardering(d);
    const ctx = bouwConclusieContext(d, calc);
    expect(ctx).toContain("Doel van de schatting: Verkoop");
    expect(ctx).toContain("Sterktes: Ruime tuin; Rustige ligging");
    expect(ctx).toContain("Zwaktes: Verouderde keuken");
    expect(ctx).not.toContain("Kansen:");
    expect(calc.venaleWaarde).toBeGreaterThan(0);
    expect(ctx).toMatch(/Venale waarde \(eindconclusie van de schatter-expert\): €\s\d/);
    expect(ctx).toContain("Berekende oppervlakte (na coëfficiënten): 150 m²");
    const prompt = bouwConclusiePrompt(d, calc);
    expect(prompt).toContain("hoogstens 150 woorden");
    expect(prompt).toContain("Verzin niets");
  });

  it("vraagt Sonnet en geeft enkel de tekst terug", async () => {
    let body = null;
    const oud = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      body = JSON.parse(opts.body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ content: [{ type: "text", text: "Conclusie:\n\nHet **ruime** pand ligt rustig." }] }) };
    };
    try {
      const d = dossier();
      const tekst = await genereerAiConclusie(d, berekenWaardering(d));
      expect(tekst).toBe("Het ruime pand ligt rustig.");
      expect(body.model).toBe("claude-sonnet-4-6");
      expect(body.tools).toBe(undefined);
      expect(body.messages[0].content).not.toContain("Jan Peeters");
    } finally {
      globalThis.fetch = oud;
    }
  });

  it("het model staat op de lijst van de server", () => {
    expect(fs.readFileSync(path.join(process.cwd(), "api/claude.js"), "utf8")).toMatch(/TOEGELATEN_MODELLEN = \[[^\]]*"claude-sonnet-4-6"/);
  });

  it("de knop verschijnt enkel met aiConclusie, en de app geeft de gebruiker door", () => {
    const swot = lees("stappen/StepSwot.jsx");
    expect(swot).toContain("{aiConclusie && (");
    expect(swot).toContain("export function StepSwot({ d, set, setD, calc, aiConclusie = false })");
    expect(lees("schermen/DossierWizard.jsx")).toContain("aiConclusie={magAiConclusie(user)}");
    expect(lees("App.jsx")).toContain("huisstijl={activeHuisstijl || huisstijl} user={session} />");
  });
});
