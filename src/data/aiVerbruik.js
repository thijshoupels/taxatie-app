// ----------------------------------------------------------------------------
// data/aiVerbruik.js — AI-verbruik per account ophalen uit Supabase
// ----------------------------------------------------------------------------
// De rijen schrijft api/claude.js weg na elke AI-aanroep (tabel + toegangsregels in
// supabase/ai-verbruik.sql). Wat je hier terugkrijgt, bepaalt de toegangsregel: de
// platform-beheerder ziet alle accounts, een gewone gebruiker enkel zichzelf.
import { supabase } from "./supabase.js";
import { vatVerbruikSamen } from "../domein/aiVerbruik.js";

export async function haalAiVerbruik(dagen = 30) {
  const sinds = new Date(Date.now() - dagen * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ai_verbruik")
    .select("gebruiker_id, email, functie, model, invoer_tokens, uitvoer_tokens, webzoekopdrachten, kosten_usd, aangemaakt_op")
    .gte("aangemaakt_op", sinds)
    .order("aangemaakt_op", { ascending: false })
    .limit(10000);
  if (error) {
    // tabel nog niet aangemaakt (supabase/ai-verbruik.sql nog niet uitgevoerd)
    if (/ai_verbruik/.test(error.message || "") && /(does not exist|schema cache|not find)/i.test(error.message || "")) {
      throw new Error("De verbruikstabel bestaat nog niet — voer eerst supabase/ai-verbruik.sql uit in Supabase (SQL Editor).");
    }
    throw new Error(error.message || "Kon het AI-verbruik niet ophalen.");
  }
  return vatVerbruikSamen(data || []);
}
