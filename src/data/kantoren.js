// ----------------------------------------------------------------------------
// data/kantoren.js — huisstijl en instellingen per kantoor (Fase 2 van de SaaS-uitbreiding)
// ----------------------------------------------------------------------------
// Vervangt de vroegere e-maildomein-gebaseerde kiesHuisstijl() (zie constants.js) door een
// databank-gestuurde versie: elk kantoor heeft een eigen rij in public.kantoren (naam, kleur,
// logo, adres, telefoon, email — zie supabase/schema.sql, onderdeel 6/7), en welk kantoor een
// gebruiker of dossier toebehoort ligt vast via profielen.kantoor_id / dossiers.kantoor_id
// (Fase 1). Elke functie hier geeft in een foutscenario de bestaande Houpels-huisstijl als veilige
// terugval terug, zodat een tijdelijk netwerkprobleem nooit een onherkenbaar/leeg rapport oplevert.
import { supabase } from "./supabase.js";
import { HUISSTIJLEN } from "../constants.js";

const KANTOOR_LOGOS_BUCKET = "kantoor-logos";

// {naam, kleur, logo} — exact dezelfde vorm als de vroegere HUISSTIJLEN.houpels/huyzen, zodat
// Dashboard.jsx, bouwers.js, StepRapport.jsx en api/generate-pdf.js ongewijzigd kunnen blijven.
export async function haalKantoorHuisstijl(kantoorId) {
  if (!kantoorId) return HUISSTIJLEN.houpels;
  try {
    const { data, error } = await supabase.from("kantoren")
      .select("naam, kleur, logo").eq("id", kantoorId).single();
    if (error || !data) return HUISSTIJLEN.houpels;
    return { naam: data.naam, kleur: data.kleur, logo: data.logo || null };
  } catch (e) {
    return HUISSTIJLEN.houpels;
  }
}

// volledige kantoorrij, voor het instellingenscherm van een kantoor-beheerder — gooit (in
// tegenstelling tot haalKantoorHuisstijl hierboven) wél een fout door, zodat het scherm zelf een
// duidelijke foutmelding kan tonen in plaats van stil een lege/verkeerde huisstijl te bewaren.
export async function haalKantoor(kantoorId) {
  const { data, error } = await supabase.from("kantoren")
    .select("id, naam, kleur, logo, adres, telefoon, email, actief").eq("id", kantoorId).single();
  if (error) throw new Error(error.message);
  return data;
}

// werkt de huisstijl/contactgegevens van het EIGEN kantoor bij — de toegangsregel in
// supabase/schema.sql staat dit enkel toe aan een kantoor-beheerder van dát kantoor (of de
// platform-beheerder), en enkel voor deze zes kolommen (nooit "actief" of "id" — die worden
// bewust, net als vandaag, enkel via Supabase Dashboard > Table Editor gewijzigd).
export async function updateKantoor(kantoorId, { naam, kleur, logo, adres, telefoon, email }) {
  const { error } = await supabase.from("kantoren").update({
    naam, kleur, logo, adres, telefoon, email,
  }).eq("id", kantoorId);
  if (error) throw new Error(error.message);
}

// laadt een nieuw logo op naar de publieke "kantoor-logos"-bucket, onder <kantoor_id>/logo.<ext>
// (upsert: true — telkens hetzelfde pad, dus een nieuw logo vervangt gewoon het vorige, zonder
// oude bestanden achter te laten) en geeft de publieke URL terug. Die URL werkt meteen met
// api/generate-pdf.js (magOphalen) en src/lib/afbeeldingen.js (veiligeAfbeeldingSrc) zonder
// wijziging daar: beide staan al elke URL toe die op hetzelfde Supabase-project draait.
export async function uploadKantoorLogo(kantoorId, bestand) {
  const ext = (bestand.name.split(".").pop() || "png").toLowerCase();
  const pad = `${kantoorId}/logo.${ext}`;
  const { error } = await supabase.storage.from(KANTOOR_LOGOS_BUCKET)
    .upload(pad, bestand, { upsert: true, contentType: bestand.type || undefined });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(KANTOOR_LOGOS_BUCKET).getPublicUrl(pad);
  // cache-buster: zonder dit blijft de browser (en het gerenderde rapport) soms de oude, reeds
  // opgehaalde afbeelding tonen na het vervangen van het logo, omdat het bestandspad ongewijzigd
  // blijft (upsert op exact hetzelfde pad hierboven).
  return `${data.publicUrl}?t=${Date.now()}`;
}
