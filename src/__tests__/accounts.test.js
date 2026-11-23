// Tests voor snel wisselen tussen accounts op hetzelfde toestel (data/accounts.js) en waar dat in
// de app zit (App.jsx, Dashboard, aanmeldscherm).
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

vi.mock("../data/supabase.js", () => ({
  supabase: { auth: { getSession: vi.fn(), setSession: vi.fn(), refreshSession: vi.fn(), signOut: vi.fn() } },
  maakTijdelijkeClient: vi.fn(),
}));

import { supabase, maakTijdelijkeClient } from "../data/supabase.js";
import {
  ACCOUNTS_SLEUTEL, bewaardeAccounts, onthoudAccount, vergeetAccount, onthoudHuidigAccount, wisselNaarAccount, voegAccountToe,
} from "../data/accounts.js";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), "src", f), "utf8");
const geheugen = new Map();
globalThis.localStorage = {
  getItem: (k) => (geheugen.has(k) ? geheugen.get(k) : null),
  setItem: (k, v) => geheugen.set(k, String(v)),
  removeItem: (k) => geheugen.delete(k),
};
const sessie = (id, email, rt) => ({ user: { id, email, email_confirmed_at: "2026-01-01" }, access_token: `at-${rt}`, refresh_token: rt });
const opgeslagen = () => JSON.parse(localStorage.getItem(ACCOUNTS_SLEUTEL) || "[]");

let tijdelijk;
beforeEach(() => {
  geheugen.clear();
  for (const f of Object.values(supabase.auth)) f.mockReset();
  tijdelijk = { auth: { refreshSession: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn(async () => ({})) } };
  maakTijdelijkeClient.mockReset();
  maakTijdelijkeClient.mockReturnValue(tijdelijk);
  supabase.auth.setSession.mockImplementation(async ({ access_token, refresh_token }) => {
    const id = access_token === "at-b2" || access_token === "at-n1" ? (access_token === "at-b2" ? "u-b" : "u-n") : "u-a";
    return { data: { session: sessie(id, `${id}@x.be`, refresh_token), user: { id } }, error: null };
  });
});

describe("accounts onthouden", () => {
  it("bewaart per account het laatste refresh token, met naam en kantoor", () => {
    onthoudAccount(sessie("u-a", "tim@huyzen.be", "a1"), { naam: "Tim Audenaert", kantoorNaam: "Huyzen Vastgoed" });
    onthoudAccount(sessie("u-a", "tim@huyzen.be", "a2")); // vernieuwd token: naam/kantoor blijven
    onthoudAccount(sessie("u-b", "tim.audenaert@icloud.com", "b1"), { kantoorNaam: "Audentra" });
    expect(opgeslagen().map((a) => [a.id, a.refreshToken])).toEqual([["u-a", "a2"], ["u-b", "b1"]]);
    expect(bewaardeAccounts()).toEqual([
      { id: "u-a", email: "tim@huyzen.be", naam: "Tim Audenaert", kantoorNaam: "Huyzen Vastgoed" },
      { id: "u-b", email: "tim.audenaert@icloud.com", kantoorNaam: "Audentra" },
    ]);
    // het scherm krijgt nooit een token te zien
    expect(JSON.stringify(bewaardeAccounts())).not.toContain("refreshToken");
    vergeetAccount("u-a");
    expect(bewaardeAccounts().map((a) => a.id)).toEqual(["u-b"]);
    vergeetAccount("u-b");
    expect(localStorage.getItem(ACCOUNTS_SLEUTEL)).toBe(null);
  });

  it("onthoudt het huidige account met de actieve sessie", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: sessie("u-a", "tim@huyzen.be", "a9") } });
    expect(await onthoudHuidigAccount({ naam: "Tim" })).toBe("u-a");
    expect(opgeslagen()[0]).toMatchObject({ id: "u-a", refreshToken: "a9", naam: "Tim" });
  });
});

describe("wisselen", () => {
  it("vernieuwt het bewaarde token via een losse client en maakt die sessie actief, zonder af te melden", async () => {
    onthoudAccount(sessie("u-a", "tim@huyzen.be", "a1"));
    onthoudAccount(sessie("u-b", "tim.audenaert@icloud.com", "b1"));
    tijdelijk.auth.refreshSession.mockResolvedValue({ data: { session: sessie("u-b", "tim.audenaert@icloud.com", "b2"), user: { id: "u-b" } }, error: null });
    const user = await wisselNaarAccount("u-b");
    expect(user.id).toBe("u-b");
    expect(tijdelijk.auth.refreshSession).toHaveBeenCalledWith({ refresh_token: "b1" });
    expect(supabase.auth.setSession).toHaveBeenCalledWith({ access_token: "at-b2", refresh_token: "b2" });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled(); // de actieve client raakt een fout token nooit aan
    expect(opgeslagen().find((a) => a.id === "u-b").refreshToken).toBe("b2");
    expect(opgeslagen().find((a) => a.id === "u-a").refreshToken).toBe("a1"); // het vorige account blijft bruikbaar
  });

  it("een verlopen aanmelding laat de huidige sessie ongemoeid en vergeet enkel dat account", async () => {
    onthoudAccount(sessie("u-b", "tim.audenaert@icloud.com", "b1"));
    tijdelijk.auth.refreshSession.mockResolvedValue({ data: { session: null, user: null }, error: { message: "Invalid Refresh Token" } });
    let fout = null;
    try { await wisselNaarAccount("u-b"); } catch (e) { fout = e; }
    expect(fout && fout.verlopen).toBe(true);
    expect(fout.message).toContain("tim.audenaert@icloud.com is verlopen");
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
    expect(bewaardeAccounts()).toEqual([]);
  });

  it("een onbekend account geeft een duidelijke fout", async () => {
    let fout = null;
    try { await wisselNaarAccount("bestaat-niet"); } catch (e) { fout = e; }
    expect(fout.message).toContain("Ander account toevoegen");
  });
});

describe("ander account toevoegen", () => {
  it("meldt aan via een losse client en wisselt, zonder het huidige af te melden", async () => {
    tijdelijk.auth.signInWithPassword.mockResolvedValue({ data: { session: sessie("u-n", "nieuw@x.be", "n1"), user: { id: "u-n", email_confirmed_at: "2026-01-01" } }, error: null });
    const user = await voegAccountToe("nieuw@x.be", "geheim", "u-a");
    expect(user.id).toBe("u-n");
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(opgeslagen().map((a) => a.id)).toEqual(["u-n"]);
  });
  it("weigert een fout wachtwoord, een onbevestigd adres en het account waarmee je al aangemeld bent", async () => {
    tijdelijk.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
    let f1 = null; try { await voegAccountToe("x@x.be", "fout", "u-a"); } catch (e) { f1 = e; }
    expect(f1.message).toBe("Ongeldig e-mailadres of wachtwoord.");

    tijdelijk.auth.signInWithPassword.mockResolvedValue({ data: { session: sessie("u-n", "n@x.be", "n1"), user: { id: "u-n", email_confirmed_at: null } }, error: null });
    let f2 = null; try { await voegAccountToe("n@x.be", "pw", "u-a"); } catch (e) { f2 = e; }
    expect(f2.message).toContain("nog niet bevestigd");

    tijdelijk.auth.signInWithPassword.mockResolvedValue({ data: { session: sessie("u-a", "a@x.be", "a5"), user: { id: "u-a", email_confirmed_at: "2026-01-01" } }, error: null });
    let f3 = null; try { await voegAccountToe("a@x.be", "pw", "u-a"); } catch (e) { f3 = e; }
    expect(f3.message).toBe("Met dit account ben je al aangemeld.");

    expect(supabase.auth.setSession).not.toHaveBeenCalled();
    // enkel de losse sessie wordt lokaal beëindigd — nooit "global" (dat zou overal afmelden)
    for (const [arg] of tijdelijk.auth.signOut.mock.calls) expect(arg).toEqual({ scope: "local" });
  });
});

describe("in de app", () => {
  const app = lees("App.jsx");
  it("houdt het token bij bij elke aanmelding of vernieuwing", () => {
    expect(app).toMatch(/\["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION", "USER_UPDATED"\]\.includes\(event\)/);
    expect(app).toContain("onthoudAccount(sessie);");
  });
  it("vergeet een account bij afmelden", () => {
    expect(app).toMatch(/await uitloggen\(\);\s+\/\/[^\n]*\n\s+if \(id\) vergeetAccount\(id\);/);
  });
  it("wisselt niet zolang er nog niet verzonden dossiers op het toestel staan", () => {
    expect(app).toContain("const wachtend = await haalWachtendeDossiers().catch(() => []);");
    expect(app).toMatch(/handleWisselAccount = async \(id\) => \{\s+await controleerVoorWissel\(\);/);
    expect(app).toMatch(/handleAccountToevoegen = async \(email, wachtwoord\) => \{\s+await controleerVoorWissel\(\);/);
  });
  it("herlaadt een tabblad dat nog een ander account toont", () => {
    expect(app).toContain("if (!wisselRef.current && sessieIdRef.current && sessie.user.id !== sessieIdRef.current) window.location.reload();");
  });
  it("toont de wissel in het overzicht en de bewaarde accounts op het aanmeldscherm", () => {
    expect(lees("schermen/Dashboard.jsx")).toContain("<AccountWissel user={user} accounts={accounts}");
    expect(app).toContain("accounts={accounts.filter((a) => a.id !== session.id)}");
    expect(app).toContain("bewaardeAccounts={accounts} onDoorgaanAls={handleDoorgaanAls}");
    expect(lees("schermen/LoginScreen.jsx")).toContain("Verder als");
  });
});
