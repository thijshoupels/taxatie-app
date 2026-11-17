// ----------------------------------------------------------------------------
// ui/Kwaliteit.jsx — kwaliteitsscore van het verslag op het scherm
// ----------------------------------------------------------------------------
// KwaliteitsBadge: compacte score in de kopbalk van het dossier (altijd zichtbaar), een klik
// opent het tabblad Rapport. KwaliteitsPaneel: de uitleg op het tabblad Rapport — score per
// onderdeel en wat er nog ontbreekt, met een knop naar het juiste tabblad. De berekening zelf
// staat in domein/kwaliteit.js. Enkel op het scherm: niets hiervan komt in het verslag.
import React from "react";
import { Gauge, ChevronRight } from "lucide-react";
import { INK, INK_SOFT, LINE, ACCENT, PAPER_RAISED, SANS, DANGER, OK } from "../constants.js";
import { TABBLADEN } from "../domein/kwaliteit.js";

const kleurVoor = (toon) => (toon === "goed" ? OK : toon === "matig" ? ACCENT : DANGER);

export function KwaliteitsBadge({ kwaliteit, onClick }) {
  const kleur = kleurVoor(kwaliteit.niveau.toon);
  return (
    <button type="button" onClick={onClick}
      title={`Kwaliteitsscore van het verslag: ${kwaliteit.niveau.label.toLowerCase()} — klik voor wat er nog ontbreekt`}
      aria-label={`Kwaliteitsscore ${kwaliteit.score} procent, ${kwaliteit.niveau.label.toLowerCase()}. Toon details`}
      className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
      style={{ border: `1px solid ${kleur}`, color: kleur, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
      <Gauge size={12} /> Kwaliteit {kwaliteit.score}%
    </button>
  );
}

function Balk({ pct, kleur, hoogte = 6 }) {
  return (
    <div style={{ height: hoogte, borderRadius: hoogte, background: LINE, overflow: "hidden" }} aria-hidden="true">
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", background: kleur, borderRadius: hoogte }} />
    </div>
  );
}

// beschikbareTabs: sleutels van de tabbladen die dit dossier heeft (bv. geen "constructie" bij
// een garage) — enkel daarvoor verschijnt een knop
export function KwaliteitsPaneel({ kwaliteit, onGaNaar, beschikbareTabs = [] }) {
  const kleur = kleurVoor(kwaliteit.niveau.toon);
  return (
    <section className="no-print mb-6 rounded-lg" aria-label="Kwaliteitsscore van het verslag"
      style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="flex items-baseline gap-2">
          <span style={{ fontFamily: SANS, fontSize: 34, fontWeight: 650, color: kleur, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {kwaliteit.score}%
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: kleur }}>{kwaliteit.niveau.label}</span>
        </div>
        <div className="flex-1" style={{ minWidth: 200 }}>
          <div className="flex items-center gap-1.5 text-xs mb-1.5" style={{ color: INK, fontWeight: 600 }}>
            <Gauge size={13} style={{ color: kleur }} /> Kwaliteitsscore van het verslag
          </div>
          <Balk pct={kwaliteit.score} kleur={kleur} hoogte={8} />
          <div className="text-xs mt-1.5" style={{ color: INK_SOFT }}>
            {kwaliteit.geblokkeerd
              ? "Het verslag kan nog niet aangemaakt worden (zie hieronder) — tot dan blijft de score onder 50%."
              : kwaliteit.aantalOntbrekend === 0
                ? "Alles wat de score meet, is ingevuld en sluit op elkaar aan."
                : `Nog ${kwaliteit.aantalOntbrekend} punt${kwaliteit.aantalOntbrekend === 1 ? "" : "en"} om het verslag vollediger en beter onderbouwd te maken. De score is een hulpmiddel: ze blokkeert niets.`}
          </div>
        </div>
      </div>

      <div className="px-5 py-3">
        {kwaliteit.groepen.map((g) => {
          const gKleur = g.pct >= 90 ? OK : g.pct >= 50 ? ACCENT : DANGER;
          return (
            <div key={g.naam} className="py-2" style={{ borderBottom: `1px dotted ${LINE}` }}>
              <div className="grid items-center gap-3" style={{ gridTemplateColumns: "minmax(140px, 220px) 1fr 44px" }}>
                <span className="text-sm" style={{ color: INK, fontWeight: 500 }}>{g.naam}</span>
                <Balk pct={g.pct} kleur={gKleur} />
                <span className="text-xs text-right" style={{ color: INK_SOFT, fontVariantNumeric: "tabular-nums" }}>{g.pct}%</span>
              </div>
              {g.ontbreekt.length > 0 && (
                <ul className="mt-1.5 grid gap-1" style={{ paddingLeft: 0, listStyle: "none" }}>
                  {g.ontbreekt.map((o) => (
                    <li key={o.tekst} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs" style={{ color: INK_SOFT, lineHeight: 1.5 }}>
                      <span style={{ minWidth: 0, flex: "1 1 260px" }}>{o.tekst}</span>
                      {o.tab && onGaNaar && beschikbareTabs.includes(o.tab) && (
                        <button type="button" onClick={() => onGaNaar(o.tab)}
                          className="flex items-center gap-0.5 whitespace-nowrap" style={{ color: ACCENT, fontWeight: 500 }}>
                          {TABBLADEN[o.tab]} <ChevronRight size={12} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
