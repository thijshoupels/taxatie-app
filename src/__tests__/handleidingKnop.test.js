// Tests voor de knop naar de handleiding (ui/HandleidingKnop.jsx): de knop staat in de kopbalk van
// het dossieroverzicht én van elk dossier, en alle links naar de handleiding gebruiken hetzelfde
// bestand (zodat een nieuwe versie overal tegelijk verschijnt).
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { HANDLEIDING_URL } from "../ui/HandleidingKnop.jsx";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), "src", f), "utf8");

describe("knop naar de handleiding", () => {
  it("staat in de kopbalk van het dossieroverzicht en van een dossier", () => {
    expect(lees("schermen/Dashboard.jsx")).toContain("<HandleidingKnop />");
    expect(lees("schermen/DossierWizard.jsx")).toContain("<HandleidingKnop />");
  });

  it("opent overal hetzelfde bestand, in een nieuw tabblad", () => {
    expect(HANDLEIDING_URL).toBe("/handleiding-taxatie-app-huyzen.pdf");
    const login = lees("schermen/LoginScreen.jsx");
    expect(login).toContain("href={HANDLEIDING_URL}");
    expect(login).not.toContain('href="/handleiding');
    const knop = lees("ui/HandleidingKnop.jsx");
    expect(knop).toContain('target="_blank"');
    expect(knop).toContain('rel="noopener noreferrer"');
  });

  it("heeft een bron die naar dezelfde PDF verwijst", () => {
    const bron = fs.readFileSync(path.join(process.cwd(), "docs/handleiding.html"), "utf8");
    expect(bron).toContain(HANDLEIDING_URL.slice(1));
  });
});
