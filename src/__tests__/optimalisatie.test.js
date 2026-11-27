// Tests voor de optimalisatie van november 2026: snellere start (schermen pas laden wanneer
// nodig), het publicatiescript, de automatische controle op GitHub en het SQL-pakket.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), f), "utf8");

describe("snellere start", () => {
  const app = lees("src/App.jsx");
  it("wizard, account en kantoor-instellingen worden pas geladen wanneer nodig", () => {
    expect(app).not.toMatch(/^import \{ DossierWizard \}/m);
    expect(app).toMatch(/const laadWizard = \(\) => import\("\.\/schermen\/DossierWizard\.jsx"\);/);
    expect(app).toMatch(/const DossierWizard = lazy\(/);
    expect(app).toMatch(/const AccountScherm = lazy\(/);
    expect(app).toMatch(/const KantoorInstellingen = lazy\(/);
    expect(app).toMatch(/<Suspense fallback=\{laadScherm\}><DossierWizard /);
  });
  it("de wizard wordt voorgeladen zodra het overzicht klaar staat", () => {
    expect(app).toMatch(/if \(!session \|\| view !== "dashboard"\) return undefined;\s*const laad = \(\) => \{ laadWizard\(\)\.catch\(\(\) => \{\}\); \};/);
  });
  it("na een nieuwe versie wordt de pagina hoogstens één keer herladen", () => {
    const main = lees("src/main.jsx");
    expect(main).toMatch(/addEventListener\("vite:preloadError"/);
    expect(main).toMatch(/if \(sessionStorage\.getItem\("herladenNaUpdate"\)\) return;/);
  });
});

describe("publiceren", () => {
  const script = lees("publiceer.sh");
  it("tests en build vóór commit en push, nooit git add -A", () => {
    expect(script).not.toMatch(/git add (-A|--all|\.)(\s|$)/);
    const i = (t) => script.indexOf(t);
    expect(i("if ! git pull --ff-only")).toBeGreaterThan(-1);
    expect(i("if ! npm test")).toBeGreaterThan(i("if ! git pull --ff-only"));
    expect(i("if ! npm run build")).toBeGreaterThan(i("if ! npm test"));
    expect(i("git commit --quiet")).toBeGreaterThan(i("if ! npm run build"));
    expect(i("if git push --quiet")).toBeGreaterThan(i("git commit --quiet"));
    expect(script).toMatch(/read -r -p "Publiceren/);
  });
  it(".env-bestanden en dossierbackups worden genegeerd", () => {
    const gi = lees(".gitignore");
    expect(gi).toMatch(/^\.env\*$/m);
    expect(gi).toMatch(/^!\.env\.example$/m);
    expect(gi).toMatch(/^!\.env\.test$/m);
    expect(gi).toMatch(/^_dossierbackup\/$/m);
  });
  // de controle op GitHub (.github/workflows/tests.yml) wordt rechtstreeks op GitHub aangemaakt
  it("GitHub draait de tests en de build bij elke push (zodra het bestand er staat)", () => {
    if (!fs.existsSync(path.join(process.cwd(), ".github/workflows/tests.yml"))) return;
    const wf = lees(".github/workflows/tests.yml");
    expect(wf).toMatch(/- run: npm test/);
    expect(wf).toMatch(/- run: npm run build/);
  });
  it("unpdf is weg uit de pakketten (werd nergens gebruikt)", () => {
    expect(JSON.parse(lees("package.json")).dependencies.unpdf).toBeUndefined();
    expect(JSON.parse(lees("package-lock.json")).packages["node_modules/unpdf"]).toBeUndefined();
  });
});

describe("SQL-pakket", () => {
  const sql = lees("supabase/optimalisatie-2026-11.sql");
  it("niet-aangemelde bezoekers verliezen alle rechten", () => {
    expect(sql).toMatch(/revoke all on all tables in schema public from anon;/);
    expect(sql).toMatch(/revoke execute on all functions in schema public from public, anon;/);
    expect(sql).toMatch(/alter default privileges in schema public revoke all on tables from anon;/);
  });
  it("elke toegangsregel leest de gebruiker één keer per opvraging", () => {
    const regels = sql.split(/;\s*\n/).filter((b) => /alter policy/.test(b));
    expect(regels.length).toBe(19);
    for (const r of regels) expect(r.replace(/\(select auth\.uid\(\)\)/g, "")).not.toMatch(/auth\.uid\(\)/);
  });
  it("indexen op de koppelingen zonder index", () => {
    for (const ix of ["dossier_events_gebruiker_idx", "dossier_events_kantoor_idx", "dossier_toegang_gedeeld_door_idx"]) {
      expect(sql).toContain(`create index if not exists ${ix}`);
    }
  });
});

describe("één verslag", () => {
  const stap = lees("src/rapport/StepRapport.jsx");
  it("het voorbeeld op het tabblad Rapport is exact de HTML van de PDF, zonder scripts", () => {
    expect(stap).toMatch(/const voorbeeldHtml = useMemo\(\(\) => \{\s*try \{\s*return buildPrintHtml\(d, calc, hs, \{ lettertypeCss \}\);/);
    expect(stap).toMatch(/<iframe ref=\{kaderRef\} title="Voorbeeld van het verslag" srcDoc=\{voorbeeldHtml\} sandbox="allow-same-origin"/);
    // geen tweede, aparte schermversie van het verslag meer
    expect(stap).not.toMatch(/ReportGrid|RoomBlock|contentPages/);
    // de PDF gebruikt dezelfde functie
    expect(stap).toMatch(/const htmlVolledig = buildPrintHtml\(d, calc, hs, \{ lettertypeCss \}\);/);
  });
});

describe("standaardwaarden maar één keer", () => {
  it("een extra pand krijgt alle pandvelden van initialData, niet de dossiervelden", async () => {
    const { initialData, maakLeegPand } = await import("../constants.js");
    const p1 = maakLeegPand("Lot A"), p2 = maakLeegPand();
    expect(p1.pandNaam).toBe("Lot A");
    expect(p1.pandId).not.toBe(p2.pandId);
    expect(p1.ruimtes).not.toBe(p2.ruimtes);
    expect(p1.ruimtes).toEqual(initialData.ruimtes);
    for (const k of ["opdrachtgeverNaam", "handtekening", "eigenaars", "extraPanden", "voorpaginaFoto", "datumVerslag"]) expect(k in p1).toBe(false);
    for (const k of ["vastgoedType", "schijven", "pachtSituatie", "fotos", "documenten", "venaleWaarde"]) expect(k in p1).toBe(true);
    const pandVelden = Object.keys(initialData).filter((k) => !(k in p1));
    expect(pandVelden.length).toBe(46);
  });
});
