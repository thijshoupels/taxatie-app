// Tests voor de SWOT na de waardering: het tabblad "SWOT-analyse" staat als laatste vóór het
// rapport, en de SWOT kan pas opgemaakt worden als de waarde vastligt — een venale waarde boven
// € 0 en een waardering zonder openstaande controlepunten (waardeLigtVast in domein/waardering.js).
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { berekenWaardering, waardeLigtVast } from "../domein/waardering.js";
import { initialData } from "../constants.js";
import { GROND } from "../domein/vastgoedtypes.js";
import { StepSwot } from "../stappen/StepSwot.jsx";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), "src", f), "utf8");
const grond = (extra = {}) => ({
  ...initialData, vastgoedType: GROND, pandType: "Bouwgrond", grondopp: "800",
  schijven: [{ id: 1, naam: "Eerste 50 meter", opp: "800", prijs: "250" }], ...extra,
});

describe("waardeLigtVast", () => {
  it("vast bij een venale waarde en geen open controlepunten", () => {
    expect(waardeLigtVast({ venaleWaarde: 250000, controlePunten: [] })).toEqual({ vast: true, openPunten: [] });
  });
  it("niet vast zonder waarde, met open punten of zonder berekening", () => {
    expect(waardeLigtVast({ venaleWaarde: 0, controlePunten: [] }).vast).toBe(false);
    const open = waardeLigtVast({ venaleWaarde: 250000, controlePunten: ["bouwtype (open/halfopen/gesloten) is nog niet gekozen"] });
    expect(open.vast).toBe(false);
    expect(open.openPunten).toEqual(["bouwtype (open/halfopen/gesloten) is nog niet gekozen"]);
    expect(waardeLigtVast(undefined).vast).toBe(false);
    expect(waardeLigtVast({}).vast).toBe(false);
  });
  it("met de echte berekening: een leeg dossier ligt niet vast, een volledig ingevulde grond wel", () => {
    const leeg = waardeLigtVast(berekenWaardering(initialData));
    expect(leeg.vast).toBe(false);
    expect(leeg.openPunten).toContain("venale waarde is nog 0");
    const g = berekenWaardering(grond());
    expect(g.venaleWaarde).toBe(200000);
    expect(waardeLigtVast(g)).toEqual({ vast: true, openPunten: [] });
    // tegenproef: zonder grondoppervlakte is er een open punt, ook al is er een waarde
    const zonderOpp = waardeLigtVast(berekenWaardering(grond({ grondopp: "" })));
    expect(zonderOpp.vast).toBe(false);
    expect(zonderOpp.openPunten).toContain("grondoppervlakte ontbreekt");
  });
});

describe("volgorde van de tabbladen", () => {
  const wiz = lees("schermen/DossierWizard.jsx");
  const stappen = wiz.slice(wiz.indexOf("const steps = ["), wiz.indexOf("];", wiz.indexOf("const steps = [")));
  const sleutels = [...stappen.matchAll(/key: "([a-z-]+)"/g)].map((m) => m[1]);
  it("de SWOT komt als laatste vóór het rapport, na de waardering en de foto's", () => {
    expect(sleutels.slice(-4)).toEqual(["waardering", "fotos", "swot", "rapport"]);
    expect(sleutels.filter((k) => k === "swot").length).toBe(1);
  });
  it("de wizard geeft een sprong naar Waardering mee aan het SWOT-tabblad", () => {
    expect(wiz).toContain('naarWaardering={() => gaNaarTab("waardering")}');
  });
});

describe("SWOT-tabblad op slot tot de waarde vastligt", () => {
  const props = (calc, extra = {}) => ({
    d: { ...initialData, sterktes: "Rustige ligging", ...extra }, set: () => () => {}, setD: () => {}, calc, naarWaardering: () => {},
  });
  const nietVast = { venaleWaarde: 0, controlePunten: ["venale waarde is nog 0", "grondoppervlakte ontbreekt"] };
  const vast = { venaleWaarde: 250000, controlePunten: [] };

  it("zonder vaste waarde: melding met de open punten, vakken alleen-lezen, AI-knop uit", () => {
    const html = renderToStaticMarkup(React.createElement(StepSwot, props(nietVast)));
    expect(html).toContain("De SWOT kan pas opgemaakt worden als de waarde vastligt.");
    expect(html).toContain("Nog open bij de waardering: venale waarde is nog 0 · grondoppervlakte ontbreekt.");
    expect(html).toContain("Naar Waardering");
    expect((html.match(/<textarea[^>]*readonly=""/g) || []).length).toBe(4);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*title="Beschikbaar zodra de waarde vastligt"/);
    // een SWOT die al ingevuld was, blijft zichtbaar
    expect(html).toContain("Rustige ligging");
    // verbouwingen, conclusie en notities blijven bewerkbaar
    expect((html.match(/<textarea/g) || []).length).toBe(7);
  });

  it("met vaste waarde: geen melding, alles bewerkbaar (tegenproef)", () => {
    const html = renderToStaticMarkup(React.createElement(StepSwot, props(vast)));
    expect(html).not.toContain("pas opgemaakt worden");
    expect(html).not.toContain("readonly");
    expect(html).not.toMatch(/<button[^>]*disabled=""/);
    expect(html).toContain("AI-voorstel genereren");
  });

  it("het AI-voorstel vertrekt niet zolang de waarde niet vastligt", () => {
    const swot = lees("stappen/StepSwot.jsx");
    expect(swot).toMatch(/const genereerVoorstel = async \(\) => \{\s*if \(!waardeVast\) return;/);
    expect(swot).toContain("const { vast: waardeVast, openPunten } = waardeLigtVast(calc);");
  });
});
