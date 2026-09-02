// ----------------------------------------------------------------------------
// data/supabase.js — de Supabase-client + het sessietoken
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 3) zonder wijziging: alle overige
// Supabase-aanroepen (dossiers, profielen, opslag) blijven voorlopig in App.jsx en importeren
// "supabase" hiervandaan, net als data/auth.js hiernaast.
import { createClient } from "@supabase/supabase-js";

// echte, permanente opslag via Supabase (zie /supabase/schema.sql voor de databasestructuur) —
// vervangt het window.storage dat enkel binnen Claude.ai bestond.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// het huidige sessietoken, nodig om onze eigen serverless functies (/api/claude,
// /api/generate-pdf) te bewijzen dat de aanvraag van een ingelogde gebruiker komt — zonder dit
// zouden die twee functies (een betaalde AI-aanroep, en een zware PDF-render) door om het even
// wie buiten de app om aan te roepen zijn, zie api/claude.js en api/generate-pdf.js.
export async function haalSessieToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}
