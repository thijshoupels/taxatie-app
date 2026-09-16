// ----------------------------------------------------------------------------
// lib/online.js — detecteert of de browser momenteel een netwerkverbinding heeft
// ----------------------------------------------------------------------------
// Gebruikt voor UI-weergave (offline-banners, AI-knoppen tijdelijk uitschakelen) én om een
// automatische synchronisatie te starten zodra de verbinding terugkomt (zie
// data/dossiers.js/synchroniseerWachtendeDossiers, aangeroepen vanuit het "online"-event in
// App.jsx). navigator.onLine/de online-offline-events zijn geen garantie dat elke server ook
// écht bereikbaar is (bv. een captive portal meldt zich soms nog als "online"), maar wel het enige
// signaal dat een browser hiervoor rechtstreeks geeft; de eigenlijke opslagpogingen (saveDossier)
// blijven zelf ook altijd hun eigen mislukking afhandelen, ongeacht wat dit signaal zegt — zie
// isNetwerkFout hieronder, dat net dáárom als tweede, betrouwbaardere vangnet dient.
import { useState, useEffect } from "react";

export function isOnline() {
  // "navigator" ontbreekt bij een server-side render (hier niet van toepassing, maar defensief) —
  // ga dan uit van "online" i.p.v. alles onnodig te blokkeren.
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

// React-hook die meteen (via de online/offline-events) meebeweegt met wijzigingen in de
// netwerkstatus — gebruikt voor de offline-banners in Dashboard.jsx/DossierWizard.jsx en om een
// AI-knop (StepDocumenten.jsx) tijdelijk uit te schakelen zolang er geen verbinding is.
export function useOnline() {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => {
    const opOnline = () => setOnline(true);
    const opOffline = () => setOnline(false);
    window.addEventListener("online", opOnline);
    window.addEventListener("offline", opOffline);
    return () => {
      window.removeEventListener("online", opOnline);
      window.removeEventListener("offline", opOffline);
    };
  }, []);
  return online;
}

// Onderscheidt een netwerkfout (geen verbinding, DNS mislukt, verbinding tijdens de aanvraag
// weggevallen, ...) van een gewone fout die Supabase zelf inhoudelijk teruggeeft (bv. een
// toegangsregel die iets weigert, of een écht ongeldige aanvraag) — enkel de eerste categorie mag
// een opslag-/laadpoging naar de lokale offline-opslag laten terugvallen (zie data/dossiers.js);
// de tweede is een echt probleem dat een hernieuwde poging toch weer zal weigeren, en moet dus
// gewoon zichtbaar blijven als foutmelding zoals voorheen.
export function isNetwerkFout(e) {
  if (!e) return false;
  if (!isOnline()) return true;
  const bericht = String((e && e.message) || e).toLowerCase();
  return (
    bericht.includes("failed to fetch") // Chrome/Edge
    || bericht.includes("networkerror") // Firefox
    || bericht.includes("load failed") // Safari
    || bericht.includes("network request failed")
    || bericht.includes("the internet connection appears to be offline")
  );
}
