// Tests voor "delen met collega's" (data/delen.js en de aanpassingen in data/dossiers.js): wie
// welke dossiers ziet in het overzicht, wie mag delen/verwijderen, de deelinformatie in het
// overzicht, verdraagzaamheid zolang de SQL nog niet uitgevoerd is, en de SQL zelf (staat ook
// onderaan schema.sql, en sluit de deelregels af zoals bedoeld).
//
// De toegangsregels zelf (RLS) worden getest tegen een echte Postgres — zie de toelichting in
// supabase/delen-met-collegas.sql. Hier: de app-kant.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("../data/supabase.js", () => ({
  supabase: {
    from: (...a) => globalThis.__nep.from(...a),
    rpc: (...a) => globalThis.__nep.rpc(...a),
  },
  haalSessieToken: async () => null,
}));

import {
  voegDeelinfoToe, zichtbareDossiers, isGedeeldMetMij, magDelen, magVerwijderen, werkDeelinfoBij,
  isOntbrekendeDeelfunctie, deelFoutTekst, haalToegang, haalKantoorgenoten, deelDossier, stopDelen,
} from "../data/delen.js";
import { zetInIndex, loadIndex } from "../data/dossiers.js";

const EIG = { id: "u-eig", isAdmin: false, isPlatformBeheerder: false };
const COL = { id: "u-col", isAdmin: false, isPlatformBeheerder: false };
const ANDER = { id: "u-ander", isAdmin: false, isPlatformBeheerder: false };
const BEH = { id: "u-beh", isAdmin: true, isPlatformBeheerder: false };

const index = [
  { id: "d1", ownerId: "u-eig", straat: "A", gedeeldMet: ["u-col"] },
  { id: "d2", ownerId: "u-eig", straat: "B", gedeeldMet: [] },
  { id: "d3", ownerId: "u-col", straat: "C", gedeeldMet: [] },
];

// kleine nep-Supabase: houdt bij wat er gevraagd werd en geeft een ingesteld antwoord terug
function nep(antwoorden = {}) {
  const log = [];
  const bouw = (tabel) => {
    const q = { tabel, filters: {} };
    const k = {
      select: (cols) => { q.op = "select"; q.cols = cols; return k; },
      insert: (rij) => { q.op = "insert"; q.rij = rij; return k; },
      delete: () => { q.op = "delete"; return k; },
      eq: (kol, w) => { q.filters[kol] = w; return k; },
      in: (kol, w) => { q.filters[kol] = w; return k; },
      order: () => k,
      then: (ok, nok) => { log.push(q); return Promise.resolve(antwoorden[`${tabel}:${q.op}`] || { data: [], error: null }).then(ok, nok); },
    };
    return k;
  };
  return {
    log,
    from: bouw,
    rpc: async (naam, args) => { log.push({ rpc: naam, args }); return antwoorden[`rpc:${naam}`] || { data: [], error: null }; },
  };
}

describe("wie ziet wat in het dossieroverzicht", () => {
  it("toont een makelaar de eigen dossiers en de dossiers die met hem gedeeld zijn", () => {
    expect(zichtbareDossiers(index, EIG).map((x) => x.id)).toEqual(["d1", "d2"]);
    expect(zichtbareDossiers(index, COL).map((x) => x.id)).toEqual(["d1", "d3"]);
    expect(zichtbareDossiers(index, ANDER).map((x) => x.id)).toEqual([]);
    expect(zichtbareDossiers(index, BEH).map((x) => x.id)).toEqual(["d1", "d2", "d3"]);
  });

  it("herkent een gedeeld dossier en wie mag delen of verwijderen", () => {
    expect(isGedeeldMetMij(index[0], COL)).toBe(true);
    expect(isGedeeldMetMij(index[0], EIG)).toBe(false); // eigen dossier, niet "gedeeld met mij"
    expect(magDelen(index[0], EIG)).toBe(true);
    expect(magDelen(index[0], COL)).toBe(false); // verder delen mag niet
    expect(magDelen(index[0], BEH)).toBe(true);
    expect(magVerwijderen(index[0], COL)).toBe(false);
    expect(magVerwijderen(index[2], COL)).toBe(true);
  });

  it("zonder deelinformatie (SQL nog niet uitgevoerd) blijft het zoals vroeger", () => {
    const oud = index.map(({ gedeeldMet, ...x }) => x);
    expect(zichtbareDossiers(oud, COL).map((x) => x.id)).toEqual(["d3"]);
  });
});

describe("deelinformatie in het overzicht", () => {
  it("voegt gedeeldMet toe en vult de naam van de eigenaar aan", () => {
    const uit = voegDeelinfoToe(
      [{ id: "d1", ownerId: "u-eig", makelaarNaam: "" }, { id: "d2", ownerId: "u-eig", makelaarNaam: "Al gekend" }, { id: "d9", ownerId: "u-x" }],
      [{ dossier_id: "d1", gebruiker_id: "u-col" }, { dossier_id: "d1", gebruiker_id: "u-ander" }],
      [{ id: "u-eig", naam: "Thijs" }],
    );
    expect(uit[0]).toMatchObject({ gedeeldMet: ["u-col", "u-ander"], makelaarNaam: "Thijs" });
    expect(uit[1]).toMatchObject({ gedeeldMet: [], makelaarNaam: "Al gekend" });
    expect(uit[2]).toMatchObject({ gedeeldMet: [], makelaarNaam: "" });
  });

  it("werkt gedeeldMet bij na een klik, zonder dubbels en zonder de rest van de rij te raken", () => {
    let i = werkDeelinfoBij(index, "d2", "u-col", true);
    i = werkDeelinfoBij(i, "d2", "u-col", true);
    expect(i[1].gedeeldMet).toEqual(["u-col"]);
    expect(i[1].straat).toBe("B");
    expect(werkDeelinfoBij(i, "d1", "u-col", false)[0].gedeeldMet).toEqual([]);
    expect(i[0]).toBe(index[0]); // andere rijen ongewijzigd
  });

  it("houdt na het opslaan de naam, het kantoor en gedeeldMet in de rij", () => {
    const rij = { id: "d1", ownerId: "u-eig", straat: "A", makelaarNaam: "Thijs", kantoorNaam: "Houpels", gedeeldMet: ["u-col"] };
    const uit = zetInIndex([rij], { id: "d1", ownerId: "u-eig", straat: "Nieuw", laatstBewerkt: "2026-11-10" });
    expect(uit[0]).toEqual({ ...rij, straat: "Nieuw", laatstBewerkt: "2026-11-10" });
    // een nieuw dossier komt er gewoon bij
    expect(zetInIndex([rij], { id: "d2" }).map((x) => x.id)).toEqual(["d1", "d2"]);
    // zonder deze samenvoeging verdween een gedeeld dossier na het opslaan uit het overzicht van de collega
    expect(zichtbareDossiers(uit, COL).map((x) => x.id)).toEqual(["d1"]);
  });
});

describe("praten met de databank", () => {
  beforeEach(() => { globalThis.__nep = nep(); });

  it("deelt, stopt en vraagt de collega's van het kantoor van het dossier op", async () => {
    globalThis.__nep = nep({ "rpc:kantoorgenoten": { data: [{ id: "u-col", naam: "Roger" }], error: null } });
    expect(await deelDossier("d1", "u-col", "u-eig")).toEqual({ ok: true });
    expect(await stopDelen("d1", "u-col")).toEqual({ ok: true });
    expect(await haalKantoorgenoten("k1")).toEqual({ ok: true, collegas: [{ id: "u-col", naam: "Roger" }] });
    expect(await haalKantoorgenoten()).toMatchObject({ ok: true });
    const [ins, del, rpc1, rpc2] = globalThis.__nep.log;
    expect(ins).toMatchObject({ tabel: "dossier_toegang", op: "insert", rij: { dossier_id: "d1", gebruiker_id: "u-col", gedeeld_door: "u-eig" } });
    expect(del).toMatchObject({ tabel: "dossier_toegang", op: "delete", filters: { dossier_id: "d1", gebruiker_id: "u-col" } });
    expect(rpc1).toEqual({ rpc: "kantoorgenoten", args: { doel_kantoor: "k1" } });
    expect(rpc2).toEqual({ rpc: "kantoorgenoten", args: {} });
  });

  it("ziet 'al gedeeld' niet als een fout", async () => {
    globalThis.__nep = nep({ "dossier_toegang:insert": { data: null, error: { code: "23505", message: "duplicate key value" } } });
    expect(await deelDossier("d1", "u-col", "u-eig")).toEqual({ ok: true });
  });

  it("geeft een duidelijke melding bij een weigering", async () => {
    globalThis.__nep = nep({ "dossier_toegang:insert": { data: null, error: { code: "42501", message: 'new row violates row-level security policy for table "dossier_toegang"' } } });
    const r = await deelDossier("d1", "u-x", "u-col");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("enkel de eigenaar of een beheerder");
  });

  it("blijft werken zolang de SQL nog niet uitgevoerd is", async () => {
    const tabelOntbreekt = { code: "PGRST205", message: "Could not find the table 'public.dossier_toegang' in the schema cache" };
    const functieOntbreekt = { code: "PGRST202", message: "Could not find the function public.kantoorgenoten without parameters in the schema cache" };
    globalThis.__nep = nep({ "dossier_toegang:select": { data: null, error: tabelOntbreekt }, "rpc:kantoorgenoten": { data: null, error: functieOntbreekt } });
    expect(await haalToegang()).toBe(null);
    const g = await haalKantoorgenoten();
    expect(g).toMatchObject({ ok: false, ontbreekt: true });
    expect(g.error).toContain("delen-met-collegas.sql");
    expect(isOntbrekendeDeelfunctie(tabelOntbreekt)).toBe(true);
    expect(isOntbrekendeDeelfunctie({ code: "42P01", message: 'relation "public.dossier_toegang" does not exist' })).toBe(true);
    // een gewone weigering noemt ook de tabelnaam, maar is GEEN ontbrekende functie
    expect(isOntbrekendeDeelfunctie({ code: "42501", message: 'new row violates row-level security policy for table "dossier_toegang"' })).toBe(false);
    expect(deelFoutTekst({ message: "iets anders" })).toBe("Delen mislukt: iets anders");
  });

  it("laadt het overzicht mét deelinformatie, en zonder als de SQL nog ontbreekt", async () => {
    const rijen = [
      { id: "d1", owner_id: "u-eig", straat: "A", status: "concept", laatst_bewerkt: "2026-11-10", kantoor_id: "k1", kantoren: { naam: "Houpels" } },
      { id: "d3", owner_id: "u-col", straat: "C", status: "concept", laatst_bewerkt: "2026-11-09", kantoor_id: "k1", kantoren: { naam: "Houpels" } },
    ];
    // zoals voor een gewone makelaar (u-col): enkel het eigen profiel is leesbaar
    const basis = {
      "dossiers:select": { data: rijen, error: null },
      "profielen:select": { data: [{ id: "u-col", naam: "Roger" }], error: null },
    };
    globalThis.__nep = nep({
      ...basis,
      "dossier_toegang:select": { data: [{ dossier_id: "d1", gebruiker_id: "u-col" }], error: null },
      "rpc:kantoorgenoten": { data: [{ id: "u-eig", naam: "Thijs" }, { id: "u-col", naam: "Roger" }], error: null },
    });
    const idx = await loadIndex();
    expect(idx.find((x) => x.id === "d1")).toMatchObject({ gedeeldMet: ["u-col"], makelaarNaam: "Thijs", kantoorNaam: "Houpels" });
    expect(zichtbareDossiers(idx, COL).map((x) => x.id).sort()).toEqual(["d1", "d3"]);

    globalThis.__nep = nep({ ...basis, "dossier_toegang:select": { data: null, error: { code: "PGRST205", message: "Could not find the table in the schema cache" } } });
    const oud = await loadIndex();
    expect(oud.map((x) => x.id)).toEqual(["d1", "d3"]); // het overzicht zelf blijft gewoon werken
    expect(oud[0].gedeeldMet).toBe(undefined);
  });

  it("valt niet om als supabase zelf een fout gooit", async () => {
    globalThis.__nep = { from: () => { throw new Error("stuk"); }, rpc: () => { throw new Error("stuk"); } };
    expect(await haalToegang()).toBe(null);
    expect((await haalKantoorgenoten()).ok).toBe(false);
    expect((await deelDossier("d1", "u", "v")).ok).toBe(false);
    expect((await stopDelen("d1", "u")).ok).toBe(false);
  });
});

describe("de SQL", () => {
  const SQL = fs.readFileSync(path.join(process.cwd(), "supabase/delen-met-collegas.sql"), "utf8");
  const SCHEMA = fs.readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8");

  it("staat ook letterlijk in schema.sql", () => {
    expect(SCHEMA.includes(SQL.trimEnd())).toBe(true);
  });

  it("breidt de vier dossierregels uit, maar laat verwijderen bij de eigenaar en beheerder", () => {
    for (const regel of ["eigen dossiers of beheerder ziet alles", "ingelogde medewerkers maken dossiers aan", "eigen dossiers bewerken of beheerder"]) {
      const blok = SQL.slice(SQL.indexOf(`create policy "${regel}"`)).split(";")[0];
      expect(blok).toContain("heeft_dossier_toegang(id)");
    }
    expect(SQL).not.toContain('create policy "eigen dossiers verwijderen of beheerder"');
  });

  it("geeft alle vier de bijlageregels toegang voor gedeelde dossiers", () => {
    for (const regel of ["medewerkers lezen bijlagen", "medewerkers uploaden bijlagen", "medewerkers verwijderen bijlagen", "medewerkers overschrijven bijlagen"]) {
      const blok = SQL.slice(SQL.indexOf(`create policy "${regel}"`)).split(";")[0];
      expect(blok).toContain("heeft_dossier_toegang(d.id)");
    }
  });

  it("deelt enkel binnen het kantoor en laat een collega zich geen eigenaar maken", () => {
    expect(SQL).toMatch(/p\.kantoor_id = d\.kantoor_id/);
    expect(SQL).toContain("kan_dossier_krijgen(gebruiker_id, dossier_id)");
    expect(SQL).toContain("create trigger dossiers_bewaak_eigenaar_trigger");
    expect(SQL).toContain("'geopend_door_collega'");
  });
});

describe("SQL: kantoor per e-mailadres", () => {
  const SQL = fs.readFileSync(path.join(process.cwd(), "supabase/kantoor-per-emailadres.sql"), "utf8");
  const SCHEMA = fs.readFileSync(path.join(process.cwd(), "supabase/schema.sql"), "utf8");
  it("staat onderaan schema.sql, na het delen", () => {
    expect(SCHEMA.trimEnd().endsWith(SQL.trimEnd())).toBe(true);
    expect(SCHEMA.indexOf("9. DOSSIERS DELEN")).toBeLessThan(SCHEMA.indexOf("10. KANTOOR PER E-MAILADRES"));
  });
  it("gaat bij registratie eerst op het exacte adres, dan het domein, dan het standaardkantoor", () => {
    const f = SQL.slice(SQL.indexOf("create or replace function public.handle_new_user"));
    const i = (t) => f.indexOf(t);
    expect(i("unnest(email_adressen)")).toBeGreaterThan(0);
    expect(i("unnest(email_adressen)")).toBeLessThan(i("email_domein"));
    expect(i("email_domein")).toBeLessThan(i("is_standaardkantoor"));
    expect(SQL).not.toMatch(/grant update[^;]*email_adressen/i); // enkel de platform-beheerder
  });
});
