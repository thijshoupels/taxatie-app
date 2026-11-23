// ----------------------------------------------------------------------------
// domein/status.js — status van een dossier wisselen (concept ⇄ afgewerkt)
// ----------------------------------------------------------------------------
// Bij "afgewerkt" krijgt een nog lege datum van het verslag de datum van vandaag (lokale datum,
// niet UTC: om 00:30 in België is het in UTC nog gisteren). Een ingevulde datum blijft altijd
// staan, en terug naar "concept" verandert niets aan de datum. Gebruikt door de statusknop in de
// kopbalk van een dossier (schermen/DossierWizard.jsx).
export function vandaagIso(nu = new Date()) {
  return new Date(nu.getTime() - nu.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function naStatusWissel(p, nu = new Date()) {
  const status = p.status === "concept" ? "afgewerkt" : "concept";
  return {
    ...p, status,
    ...(status === "afgewerkt" && !String(p.datumVerslag || "").trim() ? { datumVerslag: vandaagIso(nu) } : {}),
  };
}
