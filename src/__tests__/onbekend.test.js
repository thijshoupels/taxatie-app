// Tests voor de optie "Onbekend" in de keuzelijsten: elke keuzelijst krijgt "Onbekend" (behalve de
// keuzes die de schatter-expert zelf maakt of die de berekening sturen), en een gekozen "Onbekend"
// geeft in het verslag geen foute zin of foute waarschuwing.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { metOnbekend, ONBEKEND } from "../ui/velden.jsx";
import { voorafgaandeOpmerkingen } from "../rapport/html.js";
import { renovatieplicht, epcRapportRijen } from "../domein/epc.js";
import { kenmerkRapportGroepen } from "../domein/bedrijfskenmerken.js";
import { buildPrintHtml } from "../rapport/bouwers.js";
import { berekenWaardering } from "../domein/waardering.js";
import { initialData, HUISSTIJLEN } from "../constants.js";

const SRC = path.join(process.cwd(), "src");
const bronnen = () => {
  const uit = [];
  const loop = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { if (f !== "__tests__") loop(p); } else if (f.endsWith(".jsx")) uit.push([path.relative(SRC, p), fs.readFileSync(p, "utf8")]);
    }
  };
  loop(SRC);
  return uit;
};

describe("Onbekend in de keuzelijsten", () => {
  it("voegt Onbekend achteraan toe, zonder dubbel", () => {
    expect(metOnbekend(["A", "B"])).toEqual(["A", "B", ONBEKEND]);
    expect(metOnbekend(["Ja", "Nee", "Onbekend"])).toEqual(["Ja", "Nee", "Onbekend"]);
  });

  it("laat Onbekend enkel weg bij de vaste uitzonderingen", () => {
    const zonder = bronnen().flatMap(([f, s]) => [...s.matchAll(/<Select zonderOnbekend options=\{([^}]*)\}/g)].map((m) => `${f}: ${m[1]}`));
    expect(zonder.sort()).toEqual([
      'stappen/StepMarkt.jsx: ["2-gevel", "3-gevel", "4-gevel"]',
      "stappen/StepOpdracht.jsx: OPTS.jaNee.slice(0, 2)",
      "stappen/StepOpdracht.jsx: OPTS.reden",
      "stappen/StepType.jsx: OPTS.vastgoedType",
      "stappen/StepType.jsx: pandOptiesVoor(d).includes(d.pandType) || !d.pandType ? pandOptiesVoor(d) : [d.pandType, ...pandOptiesVoor(d)]",
      "stappen/StepVergelijkingspunten.jsx: OPTS.wijzeVanWaardering",
      "stappen/StepVergelijkingspunten.jsx: PRIJS_SOORTEN",
      "stappen/StepWaardering.jsx: AFRONDING_OPTIES",
      'stappen/StepWaardering.jsx: ["Automatisch (volgens de reden)", "Ja", "Nee"]',
      "stappen/StepWaardering.jsx: OPTS.garageWaarderingsMethode",
      "stappen/StepWaardering.jsx: OPTS.vetusteitMethode",
    ].sort());
  });

  it("knipt Onbekend nergens meer weg uit de Ja/Nee-lijst (behalve 'opdrachtgever aanwezig')", () => {
    const knip = bronnen().flatMap(([f, s]) => s.split("\n").filter((l) => l.includes("OPTS.jaNee.slice(0, 2)")).map((l) => f + (l.includes("opdrachtgeverAanwezig") ? ":opdrachtgever" : ":ANDER")));
    expect(knip).toEqual(["stappen/StepOpdracht.jsx:opdrachtgever"]);
  });
});

describe("een gekozen Onbekend in het verslag", () => {
  it("zegt bij gebruik Onbekend niet dat het eigendom in gebruik was", () => {
    const zinnen = voorafgaandeOpmerkingen({ ...initialData, gebruik: "Onbekend" }, 12);
    expect(zinnen).toContain("Het gebruik van het eigendom ten tijde van onderhavig onderzoek kon niet worden vastgesteld.");
    expect(zinnen.join(" ")).not.toContain("was het eigendom in gebruik");
    expect(voorafgaandeOpmerkingen({ ...initialData, gebruik: "Normaal" }, 12).join(" ")).toContain("was het eigendom in gebruik");
  });

  it("vraagt bij EPC-regime Onbekend niet meer om een regime te kiezen, en toont het in het verslag", () => {
    const d = { vastgoedType: "Kantoor", bedrijfsEpcType: "Onbekend", bedrijfsEpcLabel: "Onbekend" };
    const r = renovatieplicht(d);
    expect(r.waarschuwingen.join(" ")).not.toContain("Kies het EPC-regime");
    expect(r.tekst).not.toContain("renovatie dus nodig");
    expect(Object.fromEntries(epcRapportRijen(d))).toMatchObject({ "EPC-regime": "Onbekend", "EPC-label": "Onbekend" });
    // een nog leeg regime blijft wel een herinnering geven
    expect(renovatieplicht({ vastgoedType: "Kantoor", bedrijfsEpcType: "" }).waarschuwingen.join(" ")).toContain("Kies het EPC-regime");
  });

  it("toont een gekozen Onbekend bij de kenmerken van een bedrijfstype", () => {
    const g = kenmerkRapportGroepen({ vastgoedType: "Kantoor", kantoorKlasse: "Onbekend" });
    expect(g[0].rijen).toEqual([["Standing", "Onbekend"]]);
  });

  it("zet Onbekend-keuzes letterlijk in de PDF", () => {
    const d = { ...initialData, gebruik: "Onbekend", watertoetsP: "Onbekend", hoofddakMateriaal: "Onbekend", keuringStatus: "Onbekend",
      ruimtes: [{ verdieping: "gelijkvloers", opp: "120", coeff: "1" }], schijven: [{ opp: "500", prijs: "200" }], grondopp: "500", extraPanden: [], parkeerplaatsenGarages: [] };
    const html = buildPrintHtml(d, berekenWaardering(d), HUISSTIJLEN.houpels);
    expect(html).toContain("kon niet worden vastgesteld");
    expect((html.match(/>Onbekend</g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
