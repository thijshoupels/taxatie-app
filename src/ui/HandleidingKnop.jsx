// ----------------------------------------------------------------------------
// ui/HandleidingKnop.jsx — opvallende knop naar de handleiding (PDF), altijd bereikbaar
// ----------------------------------------------------------------------------
// Staat in de kopbalk van het dossieroverzicht en van elk dossier, zodat een gebruiker met een
// vraag de handleiding altijd met één klik kan openen — ook midden in een dossier. Opent in een
// nieuw tabblad: het dossier blijft gewoon open (en wordt intussen verder bewaard).
// Messing vlak (ACCENT) met de grafietkleur als tekst (--accent-contrast) — binnen de kopbalk
// (.schil, zie index.css) is dat goed leesbaar in zowel de lichte als de donkere weergave.
import React from "react";
import { BookOpen } from "lucide-react";
import { ACCENT } from "../constants.js";

// zelfde bestand als de link op het aanmeldscherm (LoginScreen.jsx) en in public/; de bron staat
// in docs/handleiding.html
export const HANDLEIDING_URL = "/handleiding-taxatie-app-huyzen.pdf";

export function HandleidingKnop({ label = "Handleiding" }) {
  return (
    <a href={HANDLEIDING_URL} target="_blank" rel="noopener noreferrer"
      title="Handleiding openen (PDF, in een nieuw tabblad)" aria-label="Handleiding openen (PDF, in een nieuw tabblad)"
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
      style={{ background: ACCENT, color: "var(--accent-contrast)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
      <BookOpen size={13} /> {label}
    </a>
  );
}
