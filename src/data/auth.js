// ----------------------------------------------------------------------------
// data/auth.js — aanmelden, registreren en accountbeheer via Supabase Auth
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 3) zonder wijziging aan de logica
// zelf. Alle functies hieronder gebruiken enkel de gedeelde "supabase"-client (zie
// data/supabase.js) — geen React, geen JSX, dus rechtstreeks testbaar buiten de wizard om.
import { supabase } from "./supabase.js";

export async function login(email, wachtwoord) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "Ongeldig e-mailadres of wachtwoord." : error.message);
  if (!data.user?.email_confirmed_at) {
    // beveiliging: een e-mailadres dat nog niet bevestigd is (bv. de bevestigingslink nog niet
    // aangeklikt) mag nooit toegang krijgen — ook niet als Supabase zelf toch een geldige sessie
    // teruggeeft. We verbreken die sessie dus meteen weer zelf.
    await supabase.auth.signOut();
    const err = new Error("Dit e-mailadres is nog niet bevestigd. Klik op de bevestigingslink die je per e-mail ontving.");
    err.needsVerify = true;
    throw err;
  }
  return data.user;
}

export async function registreer(email, wachtwoord, naam) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: wachtwoord,
    options: {
      data: { naam }, // komt terecht in de profielen-tabel via de databasetrigger
      emailRedirectTo: window.location.origin, // waar de bevestigingslink in de mail naar terugstuurt
    },
  });
  if (error) throw new Error(error.message);
  return data; // { user, session } — session is leeg als e-mailbevestiging vereist is
}

// verstuurt de bevestigingsmail opnieuw (bv. wanneer de vorige niet toekwam) — op uitdrukkelijke
// vraag terug een klikbare link i.p.v. een intyp-code: eenvoud primeert hier. Let op: een
// e-mailbeveiligingsscanner (Outlook Safe Links, Gmail, ...) kan zo'n link soms zelf al "bezoeken"
// om hem te scannen vóór de gebruiker hem aanklikt — dat verbruikt de eenmalige link, waardoor de
// gebruiker zelf een foutmelding krijgt terwijl het adres eigenlijk al bevestigd werd door de
// scanner. Gebeurt dat, dan lukt gewoon aanmelden meestal toch al.
export async function stuurBevestigingOpnieuw(email) {
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: window.location.origin } });
  if (error) throw new Error(error.message);
}

// "wachtwoord vergeten" — stuurt een klikbare link om een nieuw wachtwoord in te stellen. Supabase
// bevestigt dit altijd zonder fout terug te geven, ook als het e-mailadres niet bestaat (voorkomt
// dat iemand via deze weg kan aftoetsen welke e-mailadressen wel/niet geregistreerd zijn) — vandaar
// de neutrale infotekst in LoginScreen hieronder i.p.v. een expliciete bevestiging dat het adres
// gekend is.
export async function vraagWachtwoordResetAan(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw new Error(error.message);
}

// wordt aangeroepen NADAT de gebruiker op de herstellink in de e-mail heeft geklikt — die link meldt
// de gebruiker zelf al (tijdelijk) aan, zie de "PASSWORD_RECOVERY"-listener in AppRoot hieronder —
// en stelt dan enkel nog het nieuwe wachtwoord in op die sessie.
export async function stelNieuwWachtwoordIn(nieuwWachtwoord) {
  const { error } = await supabase.auth.updateUser({ password: nieuwWachtwoord });
  if (error) throw new Error(error.message);
}

export async function uitloggen() {
  await supabase.auth.signOut();
}

// bij het opstarten van de app: is er nog een actieve sessie? (Supabase houdt dit zelf bij,
// ook na een paginaherlaad, dus hier is geen eigen timeout/fallback-logica meer nodig)
export async function haalHuidigeGebruiker() {
  const { data } = await supabase.auth.getUser();
  const user = data?.user || null;
  if (user && !user.email_confirmed_at) {
    // zelfde beveiliging als in login(): ook een bewaarde sessie van een niet-bevestigd account
    // mag na een paginaherlaad niet gewoon binnen blijven — behandel dit dan als "niet aangemeld".
    await supabase.auth.signOut();
    return null;
  }
  return user;
}

// haalt zowel de weergavenaam als de rol ("makelaar"/"beheerder") van de ingelogde gebruiker op —
// de rol bepaalt of het Dashboard de beheerder-weergave toont (alle dossiers i.p.v. enkel de
// eigen). Beheerder word je door in Supabase Dashboard > Table Editor > profielen de kolom "rol"
// van je eigen rij op "beheerder" te zetten (zie ook de toelichting in supabase/schema.sql).
// "telefoon", "titel", "bivNummer" en "vlabelNummer" komen uit het "Mijn account"-scherm (zie
// AccountScherm hieronder) en worden bij een nieuw dossier automatisch ingevuld bij "Identificatie
// schatter-expert" — zie handleNew() in AppRoot.
export async function haalProfiel(userId, fallbackNaam) {
  try {
    const { data, error } = await supabase.from("profielen")
      .select("naam, rol, telefoon, titel, biv_nummer, vlabel_nummer").eq("id", userId).single();
    if (error || !data) return { naam: fallbackNaam, isAdmin: false, telefoon: "", titel: "", bivNummer: "", vlabelNummer: "" };
    return {
      naam: data.naam || fallbackNaam, isAdmin: data.rol === "beheerder",
      telefoon: data.telefoon || "", titel: data.titel || "", bivNummer: data.biv_nummer || "", vlabelNummer: data.vlabel_nummer || "",
    };
  } catch (e) {
    return { naam: fallbackNaam, isAdmin: false, telefoon: "", titel: "", bivNummer: "", vlabelNummer: "" };
  }
}

// werkt de eigen profielrij bij vanuit het "Mijn account"-scherm
export async function updateProfiel(userId, { naam, telefoon, titel, bivNummer, vlabelNummer }) {
  const { error } = await supabase.from("profielen").update({
    naam, telefoon, titel, biv_nummer: bivNummer, vlabel_nummer: vlabelNummer,
  }).eq("id", userId);
  if (error) throw new Error(error.message);
}
