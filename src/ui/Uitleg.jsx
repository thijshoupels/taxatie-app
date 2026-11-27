// ----------------------------------------------------------------------------
// ui/Uitleg.jsx — korte uitleg met "Meer uitleg" om open te klappen, en het ⓘ-knopje voor vakjargon
// ----------------------------------------------------------------------------
// Lange uitleg stond vroeger altijd volledig open boven de eigenlijke invoer (bv. drie alinea's en
// een tabel boven de uploadknop op het tabblad Documenten). Nu: één zin die altijd zichtbaar is, de
// rest achter "Meer uitleg". Een professional ziet meteen de knop; een leek vindt de uitleg nog
// steeds op dezelfde plaats.
import React, { useState } from "react";
import { Info } from "lucide-react";
import { INK, INK_SOFT, ACCENT, ACCENT_SOFT, PAPER_RAISED, LINE } from "../constants.js";

export function Uitleg({ kort, titel = "Meer uitleg", children, toon = "accent" }) {
  const accent = toon === "accent";
  return (
    <div className="uitleg rounded-lg px-4 py-3 mb-6"
      style={{ background: accent ? ACCENT_SOFT : PAPER_RAISED, border: `1px solid ${accent ? "var(--accent-soft-line, " + ACCENT + ")" : LINE}` }}>
      {kort && <div className="text-xs" style={{ color: INK }}>{kort}</div>}
      <details className="uitleg-meer">
        <summary className="text-xs" style={{ color: ACCENT, fontWeight: 500 }}>{titel}</summary>
        <div className="mt-2">{children}</div>
      </details>
    </div>
  );
}

// ⓘ naast een veldlabel: klik toont één zin uitleg (en klik nogmaals om te sluiten). Binnen een
// <label> zou een klik het invoerveld activeren — vandaar preventDefault.
export function BegripKnop({ tekst, naam }) {
  const [open, setOpen] = useState(false);
  if (!tekst) return null;
  return (
    <>
      <button type="button" className="begrip-knop" aria-expanded={open} aria-label={`Wat betekent ${naam || "dit"}?`} title={tekst}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        style={{ color: open ? ACCENT : INK_SOFT }}>
        <Info size={12} />
      </button>
      {open && (
        <span role="note" className="begrip-uitleg block text-xs mt-1 mb-1.5 px-2.5 py-1.5 rounded"
          style={{ background: ACCENT_SOFT, color: INK, fontWeight: 400, letterSpacing: 0 }}>
          {tekst}
        </span>
      )}
    </>
  );
}

// begrip in een tabelkop of lopende tekst (bv. "Coëff.") met dezelfde uitleg
export function Begrip({ naam, tekst, children }) {
  return (
    <span className="begrip-inline">
      {children || naam}
      <BegripKnop naam={naam} tekst={tekst} />
    </span>
  );
}
