// Tests voor haalKantoorHuisstijl (data/kantoren.js) en haalProfiel (data/auth.js) — twee
// functies die bij een Supabase-fout stil terugvielen op standaardwaarden (zie de git-
// commitboodschap "Huisstijl/profiel: fout loggen i.p.v. stil terugvallen op standaardwaarden").
// Deze test dekt precies dat gedrag: het teruggegeven resultaat moet in élk geval (succes, een
// foutantwoord van Supabase, of een exception) exact hetzelfde blijven, en het foutpad moet nu
// via console.error zichtbaar zijn i.p.v. volledig stil.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../data/supabase.js", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../data/supabase.js";
import { haalKantoorHuisstijl } from "../data/kantoren.js";
import { haalProfiel } from "../data/auth.js";

// bootst de kettingaanroep supabase.from(...).select(...).eq(...).single() na — "afhandelaar" is
// ofwel een vast resultaat ({ data, error }), ofwel een async functie die zelf een exception mag
// gooien (voor het "netwerk weg"-scenario).
function mockSingleResultaat(afhandelaar) {
  const single = typeof afhandelaar === "function" ? afhandelaar : async () => afhandelaar;
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });
}

beforeEach(() => {
  supabase.from.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("haalKantoorHuisstijl", () => {
  it("geeft de kantoorgegevens terug bij een geslaagde opvraging", async () => {
    mockSingleResultaat({ data: { naam: "Huyzen Vastgoed", kleur: "#0093D3", logo: null }, error: null });
    const r = await haalKantoorHuisstijl("kantoor-huyzen");
    expect(r).toEqual({ naam: "Huyzen Vastgoed", kleur: "#0093D3", logo: null });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("valt terug op Houpels zónder te loggen wanneer er geen kantoorId is (normale situatie)", async () => {
    const r = await haalKantoorHuisstijl(null);
    expect(r.naam).toBe("Houpels Valuation & Real Estate");
    expect(console.error).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled(); // geen onnodige Supabase-aanroep
  });

  it("valt terug op Houpels en logt de fout wanneer Supabase een foutantwoord geeft", async () => {
    mockSingleResultaat({ data: null, error: { message: "RLS: geen toegang" } });
    const r = await haalKantoorHuisstijl("kantoor-123");
    expect(r.naam).toBe("Houpels Valuation & Real Estate");
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error.mock.calls[0].join(" ")).toContain("RLS: geen toegang");
  });

  it("valt terug op Houpels en logt de fout wanneer de Supabase-aanroep een exception gooit", async () => {
    mockSingleResultaat(async () => { throw new Error("netwerk weg"); });
    const r = await haalKantoorHuisstijl("kantoor-123");
    expect(r.naam).toBe("Houpels Valuation & Real Estate");
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error.mock.calls[0].join(" ")).toContain("netwerk weg");
  });
});

describe("haalProfiel", () => {
  it("geeft het profiel terug bij een geslaagde opvraging", async () => {
    mockSingleResultaat({
      data: {
        naam: "Dorien Van Leemput", rol: "makelaar", telefoon: "", titel: "", biv_nummer: "",
        vlabel_nummer: "", kantoor_id: "kantoor-huyzen", is_platform_beheerder: false,
      },
      error: null,
    });
    const p = await haalProfiel("user-1", "Fallback");
    expect(p.naam).toBe("Dorien Van Leemput");
    expect(p.isAdmin).toBe(false);
    expect(p.kantoorId).toBe("kantoor-huyzen");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("herkent de rol 'beheerder' als isAdmin", async () => {
    mockSingleResultaat({
      data: { naam: "x", rol: "beheerder", kantoor_id: null, is_platform_beheerder: false },
      error: null,
    });
    const p = await haalProfiel("user-2", "Fallback");
    expect(p.isAdmin).toBe(true);
  });

  it("valt terug op lege standaardwaarden en logt de fout bij een foutantwoord van Supabase", async () => {
    mockSingleResultaat({ data: null, error: { message: "geen rijen" } });
    const p = await haalProfiel("user-3", "Fallback Naam");
    expect(p).toEqual({
      naam: "Fallback Naam", isAdmin: false, telefoon: "", titel: "", bivNummer: "", vlabelNummer: "",
      kantoorId: null, isPlatformBeheerder: false,
    });
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error.mock.calls[0].join(" ")).toContain("geen rijen");
  });

  it("valt terug op lege standaardwaarden en logt de fout bij een exception", async () => {
    mockSingleResultaat(async () => { throw new Error("timeout"); });
    const p = await haalProfiel("user-4", "Fallback Naam");
    expect(p.isAdmin).toBe(false);
    expect(p.kantoorId).toBe(null);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error.mock.calls[0].join(" ")).toContain("timeout");
  });
});
