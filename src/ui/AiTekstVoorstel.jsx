// ----------------------------------------------------------------------------
// ui/AiTekstVoorstel.jsx — knop "AI-voorstel" + voorstel dat je eerst naleest
// ----------------------------------------------------------------------------
// Vraagt via "genereer" een tekstvoorstel en toont het in een kader. De schatter-expert kiest:
// overnemen (of de huidige tekst vervangen), onderaan toevoegen, of verwerpen — er wordt nooit iets
// stil overschreven. Gebruikt voor de motivering van de waarderingsmethode (tabblad
// Vergelijkingspunten); enkel zichtbaar voor de platform-beheerder (zie data/aiConclusie.js).
import React, { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { INK, INK_SOFT, LINE, STAMP, DANGER, PAPER_RAISED } from "../constants.js";
import { duidAiDocFout } from "../data/ai.js";

export function AiTekstVoorstel({ knopTekst, uitleg, huidig, genereer, onOvernemen }) {
  const [bezig, setBezig] = useState(false);
  const [voorstel, setVoorstel] = useState("");
  const [fout, setFout] = useState("");
  const heeftTekst = !!String(huidig || "").trim();
  const vraag = async () => {
    setBezig(true); setFout(""); setVoorstel("");
    try {
      setVoorstel(await genereer());
    } catch (e) {
      setFout(`AI-voorstel mislukt (${duidAiDocFout(e)}). Probeer het later opnieuw.`);
    } finally {
      setBezig(false);
    }
  };
  const neemOver = (toevoegen) => {
    onOvernemen(toevoegen && heeftTekst ? `${String(huidig).trim()}\n\n${voorstel}` : voorstel);
    setVoorstel("");
  };
  return (
    <div className="md:col-span-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={vraag} disabled={bezig}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
          style={{ background: bezig ? "var(--ink-faint)" : STAMP }}>
          {bezig ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {bezig ? "Bezig met schrijven..." : knopTekst}
        </button>
        {uitleg && <span className="text-xs" style={{ color: INK_SOFT }}>{uitleg}</span>}
      </div>
      {fout && (
        <div role="alert" className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
          <AlertTriangle size={13} /> {fout}
        </div>
      )}
      {voorstel && (
        <div className="mt-2 rounded-lg px-3 py-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
          <div className="text-xs mb-1.5" style={{ color: STAMP, fontWeight: 600 }}>Voorstel — lees na en pas aan waar nodig</div>
          <p className="text-sm" style={{ color: INK, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{voorstel}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" onClick={() => neemOver(false)} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: STAMP, fontWeight: 500 }}>
              {heeftTekst ? "Vervang de huidige tekst" : "Overnemen"}
            </button>
            {heeftTekst && (
              <button type="button" onClick={() => neemOver(true)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${STAMP}`, color: STAMP, fontWeight: 500 }}>
                Onderaan toevoegen
              </button>
            )}
            <button type="button" onClick={() => setVoorstel("")} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
              Verwerpen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
