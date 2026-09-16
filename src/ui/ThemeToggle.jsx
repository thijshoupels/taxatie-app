// ----------------------------------------------------------------------------
// ui/ThemeToggle.jsx — knop om de donkere/lichte modus van de app-schil manueel te kiezen
// ----------------------------------------------------------------------------
// Voordien volgde de app-schil (wizard, dashboard, instellingen, aanmelden) enkel de
// systeeminstelling van het toestel (prefers-color-scheme, zie de tokens in src/index.css) —
// geen manuele keuze mogelijk. Deze knop (in het dashboard) legt een expliciete keuze vast in
// localStorage én op <html data-theme="light|dark">, die voortaan voorrang krijgt op de
// systeeminstelling (zie de bijhorende regels in index.css). Zolang niemand op de knop klikt (of
// localStorage niet beschikbaar is, bv. privénavigatie) blijft de app gewoon de systeeminstelling
// volgen, exact zoals voorheen. Losstaand van de per-kantoor rapport-huisstijl, die hier niet aan
// raakt.
import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { INK_SOFT, LINE } from "../constants.js";

const OPSLAGSLEUTEL = "taxatie-thema";

function leesOpgeslagenThema() {
  try {
    const waarde = window.localStorage.getItem(OPSLAGSLEUTEL);
    return waarde === "light" || waarde === "dark" ? waarde : null;
  } catch {
    return null;
  }
}

function volgtSysteemDonkereModus() {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Bepaalt de actieve modus (opgeslagen keuze, anders de systeeminstelling) en zet die op <html>.
// Wordt zowel bij het opstarten van de app aangeroepen (main.jsx, vóór de eerste render — zodat
// een eerder gekozen modus meteen klopt, zonder kort in de systeeminstelling te "flitsen") als
// door deze knop zelf bij elke klik.
export function pasOpgeslagenThemaToe() {
  const thema = leesOpgeslagenThema() || (volgtSysteemDonkereModus() ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", thema);
  return thema === "dark";
}

export function ThemeToggle() {
  const [donker, setDonker] = useState(() => {
    const opgeslagen = leesOpgeslagenThema();
    return opgeslagen ? opgeslagen === "dark" : volgtSysteemDonkereModus();
  });

  const wissel = () => {
    const nieuweWaarde = !donker;
    setDonker(nieuweWaarde);
    document.documentElement.setAttribute("data-theme", nieuweWaarde ? "dark" : "light");
    try {
      window.localStorage.setItem(OPSLAGSLEUTEL, nieuweWaarde ? "dark" : "light");
    } catch {
      // kan niet opgeslagen worden (bv. privénavigatie) — de keuze geldt dan enkel voor dit bezoek
    }
  };

  return (
    <button onClick={wissel} title={donker ? "Lichte modus" : "Donkere modus"}
      aria-label={donker ? "Zet lichte modus aan" : "Zet donkere modus aan"}
      className="p-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
      {donker ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
