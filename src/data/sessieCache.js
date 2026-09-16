// ----------------------------------------------------------------------------
// data/sessieCache.js — bewaart de laatst gekende sessiegegevens voor een offline koude start
// ----------------------------------------------------------------------------
// haalHuidigeGebruiker() (data/auth.js) valt bij een netwerkfout terug op supabase.auth.getSession()
// (leest de ingelogde gebruiker uit localStorage, geen netwerk nodig) — dat geeft de gebruiker zelf
// terug, maar niet het profiel (naam/rol/kantoor) of de huisstijl, want haalProfiel()/
// haalKantoorHuisstijl() (auth.js/kantoren.js) gooien bij een netwerkfout net bewust een fout door
// i.p.v. de vroegere stille terugval, zodat een écht backend-probleem zichtbaar blijft (zie aldaar).
// Dit bestand is de plek waar de LAATST GEKENDE (dus zeker niet fout, want ooit succesvol
// opgehaald) combinatie van profiel + huisstijl bewaard wordt, per gebruiker-id, zodat
// bouwSessie() (App.jsx) die bij een netwerkfout kan hergebruiken i.p.v. de gebruiker gewoon uit te
// loggen bij een koude start zonder internet.
//
// localStorage i.p.v. IndexedDB: dit is een kleine, synchrone hoeveelheid tekst (geen foto's), en
// moet meteen (zonder wachten op een Promise) beschikbaar zijn bij het opstarten van de app.
const SLEUTEL_PREFIX = "taxatie-sessiecache:";

export function bewaarSessieCache(userId, sessieData) {
  if (typeof localStorage === "undefined" || !userId) return;
  try {
    localStorage.setItem(SLEUTEL_PREFIX + userId, JSON.stringify({ ...sessieData, bewaardOp: Date.now() }));
  } catch (e) {
    // bv. Safari-privénavigatie of een volle opslagquota — geen kritiek pad, gewoon negeren zoals
    // ook elders in de app bij niet-essentiële opslag gebeurt.
    console.error("Kon sessiecache niet bewaren:", e.message);
  }
}

export function haalSessieCache(userId) {
  if (typeof localStorage === "undefined" || !userId) return null;
  try {
    const ruw = localStorage.getItem(SLEUTEL_PREFIX + userId);
    return ruw ? JSON.parse(ruw) : null;
  } catch (e) {
    console.error("Kon sessiecache niet lezen:", e.message);
    return null;
  }
}
