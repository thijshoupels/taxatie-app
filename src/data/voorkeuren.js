// ----------------------------------------------------------------------------
// data/voorkeuren.js — persoonlijke standaardwaarden en bewaarde handtekening (Supabase)
// ----------------------------------------------------------------------------
// Eén rij per gebruiker in "profiel_voorkeuren" (zie supabase/persoonlijke-voorkeuren.sql): enkel
// de gebruiker zelf kan ze lezen of wijzigen. Bestaat de tabel nog niet (de SQL is nog niet
// uitgevoerd), dan werkt de app gewoon zoals voorheen en meldt het scherm dat de functie nog niet
// beschikbaar is (beschikbaar: false).
import { supabase } from "./supabase.js";
import { schoonStandaarden } from "../domein/standaarden.js";

export const LEGE_VOORKEUREN = Object.freeze({ beschikbaar: true, standaarden: {}, handtekening: "" });

// tabel bestaat (nog) niet: PostgREST "PGRST205"/"42P01", of een melding die dat zegt
export function isOntbrekendeTabel(error) {
  if (!error) return false;
  return ["PGRST205", "42P01"].includes(String(error.code || ""))
    || /profiel_voorkeuren/.test(String(error.message || "")) && /does not exist|could not find|schema cache/i.test(String(error.message || ""));
}

export async function haalVoorkeuren(userId) {
  if (!userId) return { ...LEGE_VOORKEUREN };
  try {
    const { data, error } = await supabase.from("profiel_voorkeuren").select("standaarden, handtekening").eq("user_id", userId).maybeSingle();
    if (error) {
      if (isOntbrekendeTabel(error)) return { ...LEGE_VOORKEUREN, beschikbaar: false };
      console.error("Persoonlijke voorkeuren ophalen mislukt:", error.message);
      return { ...LEGE_VOORKEUREN };
    }
    return {
      beschikbaar: true,
      standaarden: schoonStandaarden(data && data.standaarden),
      handtekening: (data && typeof data.handtekening === "string" && data.handtekening.startsWith("data:image/png;base64,")) ? data.handtekening : "",
    };
  } catch (e) {
    console.error("Persoonlijke voorkeuren ophalen mislukt:", e.message);
    return { ...LEGE_VOORKEUREN };
  }
}

// wijziging = { standaarden } en/of { handtekening } — de rest blijft ongemoeid
export async function bewaarVoorkeuren(userId, wijziging) {
  const rij = { user_id: userId, bijgewerkt_op: new Date().toISOString() };
  if ("standaarden" in wijziging) rij.standaarden = schoonStandaarden(wijziging.standaarden);
  if ("handtekening" in wijziging) {
    const h = String(wijziging.handtekening || "");
    if (h && !h.startsWith("data:image/png;base64,")) throw new Error("Ongeldige handtekening.");
    rij.handtekening = h;
  }
  const { error } = await supabase.from("profiel_voorkeuren").upsert(rij, { onConflict: "user_id" });
  if (error) {
    if (isOntbrekendeTabel(error)) {
      throw new Error("Deze functie is nog niet geactiveerd: voer eerst supabase/persoonlijke-voorkeuren.sql uit in Supabase.");
    }
    throw new Error(error.message || "Opslaan mislukt.");
  }
  return rij;
}
