// ----------------------------------------------------------------------------
// ui/Weergave.jsx — eenvoudige weergave of expertweergave
// ----------------------------------------------------------------------------
// In de eenvoudige weergave staan de optionele, technische onderdelen (meerjaren-DCF, kosten koper,
// marktmarge, gedwongen verkoop, energiecorrectie, een tweede Abex-klasse, residuele grondwaarde,
// aandeel gemeenschap) ingeklapt onder "Geavanceerd". Wat in een dossier al gebruikt wordt, staat
// altijd open — er verdwijnt dus nooit een instelling uit het zicht. De expertweergave toont alles
// zoals vroeger. De keuze geldt per gebruiker op dit toestel (localStorage) en verandert niets aan
// het dossier of de berekening.
import React, { createContext, useContext, useState } from "react";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { INK, INK_SOFT, ACCENT, LINE, PAPER_RAISED } from "../constants.js";

const WeergaveContext = createContext({ expert: true, zetExpert: () => {} });
export const useWeergave = () => useContext(WeergaveContext);

export const weergaveSleutel = (userId) => `taxatie-weergave-${userId || "anoniem"}`;

export function leesWeergave(userId) {
  try {
    const v = localStorage.getItem(weergaveSleutel(userId));
    return v === "expert" ? "expert" : "eenvoudig";
  } catch {
    return "eenvoudig";
  }
}

export function WeergaveProvider({ userId, children }) {
  const [expert, setExpert] = useState(() => leesWeergave(userId) === "expert");
  const zetExpert = (aan) => {
    setExpert(aan);
    try { localStorage.setItem(weergaveSleutel(userId), aan ? "expert" : "eenvoudig"); } catch { /* privé-venster */ }
  };
  return <WeergaveContext.Provider value={{ expert, zetExpert }}>{children}</WeergaveContext.Provider>;
}

// schakelaar in de kopbalk van een dossier
export function WeergaveSchakelaar() {
  const { expert, zetExpert } = useWeergave();
  return (
    <button type="button" onClick={() => zetExpert(!expert)} aria-pressed={expert}
      title={expert ? "Alles wordt getoond. Klik voor de eenvoudige weergave." : "Optionele, technische onderdelen staan ingeklapt. Klik om alles te tonen."}
      className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full"
      style={{ border: `1px solid ${LINE}`, color: INK_SOFT, fontWeight: 500 }}>
      <SlidersHorizontal size={12} />
      <span className="verberg-gsm">{expert ? "Expertweergave" : "Eenvoudige weergave"}</span>
      <span className="toon-gsm">{expert ? "Expert" : "Eenvoudig"}</span>
    </button>
  );
}

// Optioneel, technisch onderdeel: in de eenvoudige weergave ingeklapt (tenzij al in gebruik).
export function Geavanceerd({ titel, actief = false, children }) {
  const { expert } = useWeergave();
  const [open, setOpen] = useState(!!actief);
  if (expert) return <>{children}</>;
  return (
    <details className="geavanceerd mb-8 rounded-lg" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}
      style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
      <summary className="flex items-center gap-2 px-4 py-3 text-sm" style={{ color: INK, cursor: "pointer" }}>
        <ChevronRight size={14} className="geavanceerd-pijl" style={{ color: ACCENT }} />
        <span style={{ fontWeight: 500 }}>Geavanceerd</span>
        <span style={{ color: INK_SOFT }}>· {titel}</span>
        {actief && <span className="text-xs px-2 py-0.5 rounded-full ml-auto" style={{ border: `1px solid ${ACCENT}`, color: ACCENT }}>in gebruik</span>}
      </summary>
      <div className="px-4 pt-2">{children}</div>
    </details>
  );
}
