// ----------------------------------------------------------------------------
// data/delen.js — een dossier delen met collega's van hetzelfde kantoor
// ----------------------------------------------------------------------------
// Een dossier heeft één eigenaar (owner_id), maar kan via de tabel "dossier_toegang" gedeeld
// worden met collega's van hetzelfde kantoor. Die mogen het dan bekijken en bewerken, niet
// verwijderen of verder delen. De eigenlijke afscherming gebeurt in de databank (toegangsregels,
// zie supabase/delen-met-collegas.sql); deze module haalt enkel op, voegt toe en verwijdert.
//
// Alles is bewust verdraagzaam: zolang de SQL van het delen nog niet in Supabase uitgevoerd is,
// bestaan de tabel en de functie "kantoorgenoten" niet. Dan werkt de rest van de app gewoon
// verder zoals vroeger (geen deelinformatie), en geeft enkel de knop "Delen" een duidelijke melding.
import { supabase } from "./supabase.js";
import { isNetwerkFout } from "../lib/online.js";

// de deelfunctie is nog niet in de databank aangemaakt (tabel/functie ontbreekt)
export function isOntbrekendeDeelfunctie(fout) {
  const t = `${fout?.code || ""} ${fout?.message || ""}`;
  // bewust niet op de tabelnaam zelf zoeken: ook een gewone weigering ("violates row-level security
  // policy for table dossier_toegang") noemt die naam
  return /42P01|42883|PGRST202|PGRST205|schema cache|does not exist/i.test(t);
}

// begrijpelijke melding voor de gebruiker bij een mislukte deelactie
export function deelFoutTekst(fout) {
  if (isNetwerkFout(fout)) return "Geen verbinding met de server — probeer opnieuw zodra je weer online bent.";
  if (isOntbrekendeDeelfunctie(fout)) return "Delen is nog niet geactiveerd in de databank: voer eerst supabase/delen-met-collegas.sql uit in Supabase (SQL Editor).";
  if (/row-level security|42501|permission denied/i.test(`${fout?.code || ""} ${fout?.message || ""}`)) {
    return "Dit lukt niet: enkel de eigenaar of een beheerder kan een dossier delen, en enkel met collega's van hetzelfde kantoor.";
  }
  return `Delen mislukt: ${fout?.message || fout || "onbekende fout"}`;
}

// alle deelregels die de ingelogde gebruiker mag zien: van de eigen dossiers (eigenaar/beheerder)
// en de eigen regels (dossiers die met mij gedeeld zijn) → [{ dossier_id, gebruiker_id }] of null
export async function haalToegang() {
  try {
    const { data, error } = await supabase.from("dossier_toegang").select("dossier_id, gebruiker_id");
    if (error) {
      if (!isOntbrekendeDeelfunctie(error) && !isNetwerkFout(error)) console.error("Kon deelinformatie niet ophalen:", error.message);
      return null;
    }
    return data || [];
  } catch (e) {
    if (!isNetwerkFout(e)) console.error("Kon deelinformatie niet ophalen:", e.message);
    return null;
  }
}

// collega's (id + naam) van een kantoor — zonder kantoorId: het eigen kantoor
// → { ok: true, collegas } of { ok: false, error, ontbreekt }
export async function haalKantoorgenoten(kantoorId) {
  try {
    const { data, error } = await supabase.rpc("kantoorgenoten", kantoorId ? { doel_kantoor: kantoorId } : {});
    if (error) return { ok: false, error: deelFoutTekst(error), ontbreekt: isOntbrekendeDeelfunctie(error) };
    return { ok: true, collegas: (data || []).map((p) => ({ id: p.id, naam: p.naam || "" })) };
  } catch (e) {
    return { ok: false, error: deelFoutTekst(e), ontbreekt: false };
  }
}

export async function deelDossier(dossierId, gebruikerId, gedeeldDoor) {
  try {
    const { error } = await supabase.from("dossier_toegang").insert({ dossier_id: dossierId, gebruiker_id: gebruikerId, gedeeld_door: gedeeldDoor });
    // al gedeeld (bv. in een ander venster): geen fout, het resultaat is wat gevraagd werd
    if (error && error.code !== "23505") return { ok: false, error: deelFoutTekst(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: deelFoutTekst(e) };
  }
}

export async function stopDelen(dossierId, gebruikerId) {
  try {
    const { error } = await supabase.from("dossier_toegang").delete().eq("dossier_id", dossierId).eq("gebruiker_id", gebruikerId);
    if (error) return { ok: false, error: deelFoutTekst(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: deelFoutTekst(e) };
  }
}

// ---------- pure functies (apart testbaar, zie __tests__/delen.test.js) ----------

// voegt aan elke rij van het dossieroverzicht toe met wie ze gedeeld is ("gedeeldMet": lijst van
// gebruikers-id's), en vult een ontbrekende makelaarnaam aan met de naam van een kantoorgenoot:
// een gewone makelaar mag de profielen van collega's niet lezen, dus zonder dit zou bij een
// gedeeld dossier niet te zien zijn van wie het is
export function voegDeelinfoToe(index, toegang, collegas) {
  const perDossier = new Map();
  for (const t of toegang || []) {
    if (!perDossier.has(t.dossier_id)) perDossier.set(t.dossier_id, []);
    perDossier.get(t.dossier_id).push(t.gebruiker_id);
  }
  const naamPerId = new Map((collegas || []).map((c) => [c.id, c.naam]));
  return (index || []).map((x) => ({
    ...x,
    gedeeldMet: perDossier.get(x.id) || [],
    makelaarNaam: x.makelaarNaam || naamPerId.get(x.ownerId) || "",
  }));
}

export const isGedeeldMetMij = (x, user) => !!user && x.ownerId !== user.id && (x.gedeeldMet || []).includes(user.id);

// mag deze gebruiker dit dossier delen (en dus het deelvenster openen)? de eigenaar of een beheerder
export const magDelen = (x, user) => !!user && (x.ownerId === user.id || !!user.isAdmin || !!user.isPlatformBeheerder);

// mag deze gebruiker dit dossier verwijderen? de eigenaar of een beheerder — niet wie het enkel
// gedeeld kreeg (de databank weigert dat sowieso, dit verbergt enkel de knop)
export const magVerwijderen = magDelen;

// welke dossiers het dashboard toont: alles voor een beheerder, anders de eigen dossiers én de
// dossiers die met deze gebruiker gedeeld zijn. Zonder verbinding is niet na te gaan wat gedeeld
// is: dan toont het dashboard (zoals vroeger) enkel de eigen dossiers. De lokale opslag is niet per
// gebruiker gescheiden, dus "alles wat op dit toestel staat" tonen zou dossiers van iemand anders
// die op dezelfde browser werkte zichtbaar maken.
export function zichtbareDossiers(index, user) {
  if (user.isAdmin || user.isPlatformBeheerder) return index;
  return index.filter((x) => x.ownerId === user.id || isGedeeldMetMij(x, user));
}

// de lijst "gedeeldMet" na een geslaagde deelactie bijwerken, zonder de rest van de rij te raken
export function werkDeelinfoBij(index, dossierId, gebruikerId, gedeeld) {
  return index.map((x) => {
    if (x.id !== dossierId) return x;
    const huidig = x.gedeeldMet || [];
    const gedeeldMet = gedeeld ? (huidig.includes(gebruikerId) ? huidig : [...huidig, gebruikerId]) : huidig.filter((g) => g !== gebruikerId);
    return { ...x, gedeeldMet };
  });
}
