// Tests voor data/voorkeuren.js: persoonlijke standaarden en bewaarde handtekening (Supabase).
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../data/supabase.js", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../data/supabase.js";
import { haalVoorkeuren, bewaarVoorkeuren, isOntbrekendeTabel } from "../data/voorkeuren.js";

let laatsteUpsert = null;
const opvraging = (antwoord) => ({
  select: () => ({ eq: () => ({ maybeSingle: async () => antwoord }) }),
  upsert: async (rij, opties) => { laatsteUpsert = { rij, opties }; return antwoord; },
});
beforeEach(() => {
  supabase.from.mockReset();
  laatsteUpsert = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("haalVoorkeuren", () => {
  it("geeft gecontroleerde standaarden en een geldige handtekening terug", async () => {
    supabase.from.mockReturnValue(opvraging({ data: { standaarden: { gedwongenFactor: "0.80", onbekend: 1, yieldVan: "99" }, handtekening: "data:image/png;base64,AAA" }, error: null }));
    expect(await haalVoorkeuren("u1")).toEqual({ beschikbaar: true, standaarden: { gedwongenFactor: "0.80" }, handtekening: "data:image/png;base64,AAA" });
    expect(supabase.from).toHaveBeenCalledWith("profiel_voorkeuren");
  });
  it("nog geen rij: leeg", async () => {
    supabase.from.mockReturnValue(opvraging({ data: null, error: null }));
    expect(await haalVoorkeuren("u1")).toEqual({ beschikbaar: true, standaarden: {}, handtekening: "" });
  });
  it("tabel bestaat nog niet (SQL niet uitgevoerd): niet beschikbaar, de app werkt verder", async () => {
    supabase.from.mockReturnValue(opvraging({ data: null, error: { code: "PGRST205", message: "Could not find the table 'public.profiel_voorkeuren' in the schema cache" } }));
    expect(await haalVoorkeuren("u1")).toEqual({ beschikbaar: false, standaarden: {}, handtekening: "" });
  });
  it("een andere fout of geen verbinding: gewoon leeg", async () => {
    supabase.from.mockReturnValue(opvraging({ data: null, error: { code: "500", message: "stuk" } }));
    expect((await haalVoorkeuren("u1")).standaarden).toEqual({});
    supabase.from.mockImplementation(() => { throw new Error("Failed to fetch"); });
    expect((await haalVoorkeuren("u1")).beschikbaar).toBe(true);
  });
  it("een vreemde handtekening wordt genegeerd", async () => {
    supabase.from.mockReturnValue(opvraging({ data: { standaarden: {}, handtekening: "javascript:alert(1)" }, error: null }));
    expect((await haalVoorkeuren("u1")).handtekening).toBe("");
  });
});

describe("bewaarVoorkeuren", () => {
  it("schrijft enkel wat gewijzigd is, gecontroleerd, voor de eigen gebruiker", async () => {
    supabase.from.mockReturnValue(opvraging({ error: null }));
    await bewaarVoorkeuren("u1", { standaarden: { gedwongenFactor: "0,80", rommel: "x" } });
    expect(laatsteUpsert.rij.user_id).toBe("u1");
    expect(laatsteUpsert.rij.standaarden).toEqual({ gedwongenFactor: "0.80" });
    expect("handtekening" in laatsteUpsert.rij).toBe(false);
    expect(laatsteUpsert.opties).toEqual({ onConflict: "user_id" });
    await bewaarVoorkeuren("u1", { handtekening: "data:image/png;base64,BBB" });
    expect(laatsteUpsert.rij.handtekening).toBe("data:image/png;base64,BBB");
    expect("standaarden" in laatsteUpsert.rij).toBe(false);
  });
  it("weigert een ongeldige handtekening, en meldt als de SQL nog niet uitgevoerd is", async () => {
    supabase.from.mockReturnValue(opvraging({ error: null }));
    let f1 = null; try { await bewaarVoorkeuren("u1", { handtekening: "<svg>" }); } catch (e) { f1 = e; }
    expect(f1.message).toBe("Ongeldige handtekening.");
    supabase.from.mockReturnValue(opvraging({ error: { code: "42P01", message: 'relation "public.profiel_voorkeuren" does not exist' } }));
    let f2 = null; try { await bewaarVoorkeuren("u1", { standaarden: {} }); } catch (e) { f2 = e; }
    expect(f2.message).toContain("persoonlijke-voorkeuren.sql");
  });
  it("herkent een ontbrekende tabel", () => {
    expect(isOntbrekendeTabel({ code: "PGRST205" })).toBe(true);
    expect(isOntbrekendeTabel({ code: "42501", message: "permission denied" })).toBe(false);
  });
});
