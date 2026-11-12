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
  supabase: { from: vi.fn(), auth: { refreshSession: vi.fn() } },
}));

import { supabase } from "../data/supabase.js";
import { haalKantoorHuisstijl } from "../data/kantoren.js";
import { haalProfiel } from "../data/auth.js";
import { SessieVerlopenFout, isSessieFout } from "../data/sessieHerstel.js";
import { HUISSTIJLEN } from "../constants.js";

// bootst de kettingaanroep supabase.from(...).select(...).eq(...).single() na — "afhandelaar" is
// ofwel een vast resultaat ({ data, error }), ofwel een async functie die zelf een exception mag
// gooien (voor het "netwerk weg"-scenario).
function mockSingleResultaat(afhandelaar) {
  const single = typeof afhandelaar === "function" ? afhandelaar : async () => afhandelaar;
  supabase.from.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });
}

beforeEach(() => {
  supabase.from.mockReset();
  supabase.auth.refreshSession.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("haalKantoorHuisstijl", () => {
  it("geeft de kantoorgegevens terug bij een geslaagde opvraging", async () => {
    mockSingleResultaat({ data: { naam: "Woonvast", kleur: "#204097", logo: null }, error: null });
    const r = await haalKantoorHuisstijl("kantoor-woonvast");
    expect(r).toEqual({ naam: "Woonvast", kleur: "#204097", logo: null });
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
    expect(r.terugval).toBe(true); // geen echte huisstijl: niet in de sessiecache bewaren
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
      kantoorId: null, isPlatformBeheerder: false, terugval: true,
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

// Aanleiding 12/11/2026: dennis@huyzen.be en bert@huyzen.be kregen de Houpels-huisstijl. De
// logboeken tonen telkens een 401 op het profiel bij het opstarten (aanmeldtoken net verlopen);
// de app behandelde dat als "geen profiel" en viel terug op de standaardhuisstijl.
describe("verlopen aanmeldtoken bij het opstarten", () => {
  const profielHuyzen = {
    naam: "Dennis", rol: "makelaar", telefoon: "", titel: "", biv_nummer: "", vlabel_nummer: "",
    kantoor_id: "kantoor-huyzen", is_platform_beheerder: false,
  };
  const verlopen = { data: null, error: { code: "PGRST303", message: "JWT expired" }, status: 401 };

  it("vernieuwt het token en haalt het profiel opnieuw op", async () => {
    let poging = 0;
    mockSingleResultaat(async () => (++poging === 1 ? verlopen : { data: profielHuyzen, error: null, status: 200 }));
    const p = await haalProfiel("dennis", "dennis@huyzen.be");
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(p.kantoorId).toBe("kantoor-huyzen");
    expect(p.terugval).toBe(undefined);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("valt NIET terug op standaardwaarden als de aanmelding ongeldig blijft", async () => {
    const fout = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };
    mockSingleResultaat(async () => verlopen);
    expect((await fout(() => haalProfiel("dennis", "dennis@huyzen.be"))) instanceof SessieVerlopenFout).toBe(true);
    mockSingleResultaat(async () => verlopen);
    expect((await fout(() => haalKantoorHuisstijl("kantoor-huyzen"))) instanceof SessieVerlopenFout).toBe(true);
  });

  it("vernieuwt ook bij de huisstijl het token en geeft dan de echte huisstijl", async () => {
    let poging = 0;
    mockSingleResultaat(async () => (++poging === 1 ? verlopen : { data: { naam: "Huyzen Vastgoed", kleur: "#0093D3", logo: null }, error: null }));
    const r = await haalKantoorHuisstijl("kantoor-huyzen");
    expect(r.naam).toBe("Huyzen Vastgoed");
    expect(r.terugval).toBe(undefined);
  });

  it("herkent een sessiefout aan status, code of boodschap — maar niet een gewone weigering", () => {
    expect(isSessieFout({ error: { message: "x" }, status: 401 })).toBe(true);
    expect(isSessieFout({ error: { code: "PGRST301", message: "JWSError" } })).toBe(true);
    expect(isSessieFout({ error: { message: "JWT expired" } })).toBe(true);
    expect(isSessieFout({ error: { message: "RLS: geen toegang" }, status: 403 })).toBe(false);
    expect(isSessieFout({ error: null, status: 200 })).toBe(false);
  });
});

describe("logo van Huyzen Vastgoed", () => {
  it("gebruikt het vaste Huyzen-logo als er geen eigen logo opgeladen is", async () => {
    mockSingleResultaat({ data: { naam: "Huyzen Vastgoed", kleur: "#0093D3", logo: null }, error: null });
    const r = await haalKantoorHuisstijl("kantoor-huyzen");
    expect(r.logo).toBe(HUISSTIJLEN.huyzen.logo);
    expect(String(r.logo)).toMatch(/^data:image\/png;base64,/);
  });

  it("een opgeladen logo (Kantoor-instellingen) gaat altijd voor", async () => {
    mockSingleResultaat({ data: { naam: "Huyzen Vastgoed", kleur: "#0093D3", logo: "https://x.supabase.co/logo.png" }, error: null });
    expect((await haalKantoorHuisstijl("kantoor-huyzen")).logo).toBe("https://x.supabase.co/logo.png");
  });
});
