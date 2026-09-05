// ----------------------------------------------------------------------------
// schermen/WachtwoordHerstellenScreen.jsx — nieuw wachtwoord instellen na "wachtwoord vergeten"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 11) zonder de logica/opmaak zelf te
// wijzigen.
import React, { useState } from "react";
import { Home, AlertTriangle } from "lucide-react";
import { INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, BRASS, DANGER } from "../constants.js";
import { Field, TextInput } from "../ui/velden.jsx";
import { stelNieuwWachtwoordIn } from "../data/auth.js";

// scherm na het klikken op de "wachtwoord vergeten"-link in de mailbox: enkel nog een nieuw
// wachtwoord kiezen (de link zelf meldt de gebruiker al aan, zie de PASSWORD_RECOVERY-listener
// in AppRoot)
export function WachtwoordHerstellenScreen({ onDone }) {
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState("");
  const [nieuwWachtwoordBevestig, setNieuwWachtwoordBevestig] = useState("");
  const [error, setError] = useState("");
  const [bezig, setBezig] = useState(false);

  const submit = async () => {
    if (bezig) return;
    setError("");
    if (nieuwWachtwoord.length < 6) { setError("Nieuw wachtwoord moet minstens 6 tekens bevatten."); return; }
    if (nieuwWachtwoord !== nieuwWachtwoordBevestig) { setError("De wachtwoorden komen niet overeen."); return; }
    setBezig(true);
    try {
      await stelNieuwWachtwoordIn(nieuwWachtwoord);
      await onDone();
    } catch (err) {
      setError(err.message || "Er ging iets mis bij het wijzigen van je wachtwoord. Probeer opnieuw.");
      setBezig(false);
    }
  };
  const onEnter = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="w-full flex items-center justify-center" style={{ minHeight: 560, background: PAPER, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="rounded-xl p-8" style={{ width: 360, background: PAPER_RAISED, border: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Home size={18} style={{ color: BRASS }} />
          <span style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: INK }}>Houpels Valuation & Real Estate</span>
        </div>
        <div className="text-xs mb-6" style={{ color: INK_SOFT }}>Nieuw wachtwoord instellen</div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Field label="Nieuw wachtwoord"><TextInput type="password" value={nieuwWachtwoord} onChange={(e) => setNieuwWachtwoord(e.target.value)} onKeyDown={onEnter} /></Field>
          <Field label="Bevestig nieuw wachtwoord"><TextInput type="password" value={nieuwWachtwoordBevestig} onChange={(e) => setNieuwWachtwoordBevestig(e.target.value)} onKeyDown={onEnter} /></Field>
          <button type="button" onClick={submit} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
            {bezig ? "Bezig..." : "Wachtwoord wijzigen"}
          </button>
        </div>
      </div>
    </div>
  );
}
