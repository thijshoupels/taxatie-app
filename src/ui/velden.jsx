// ----------------------------------------------------------------------------
// ui/velden.jsx — generieke, herbruikbare invoer-/weergavecomponenten
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 7) zonder de logica/opmaak zelf te
// wijzigen: Field/TextInput/Select/QuickChips/MultiCheck/Checkbox/Section/ChipToggle/Slider/Row
// worden door bijna elke wizard-stap gebruikt en horen niet bij één specifieke stap.
import React from "react";
import { INK, INK_SOFT, PAPER_RAISED, LINE, ACCENT, ACCENT_SOFT, SANS } from "../constants.js";

// ---------- generic field components ----------
// "full" = over de volledige breedte. Onder 768px staat alles toch al onder elkaar (zie Section),
// dus geldt die kolomoverspanning pas vanaf md — anders zou een veld op een telefoon proberen twee
// kolommen te overspannen die er niet zijn.
export function Field({ label, children, hint, full }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500, letterSpacing: "0.01em" }}>{label}</span>
      {children}
      {hint && <span className="block text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.75 }}>{hint}</span>}
    </label>
  );
}

export const inputStyle = {
  border: `1px solid ${LINE}`, borderRadius: 4, padding: "8px 10px", fontSize: 14,
  width: "100%", background: PAPER_RAISED, color: INK, outline: "none",
};

// tekstvelden met spellingscontrole in het Nederlands (lang="nl-BE"): tikfouten zoals "wonig" of
// "Zonnepannelen" worden onderlijnd vóór ze in het verslag belanden — getallen en datums niet
export function TextInput(props) {
  const tekst = !props.type || props.type === "text";
  return <input {...(tekst ? { spellCheck: true, lang: "nl-BE" } : {})} {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
// "leeg" (optioneel): tekst voor een lege eerste keuze (waarde ""), bv. "— kies —", voor velden
// zonder stilzwijgende standaardwaarde.
// Elke keuzelijst krijgt achteraan de optie "Onbekend": bij een plaatsbezoek of op basis van de
// beschikbare stukken is lang niet alles vast te stellen (watertoets, dakmateriaal, huurcontract,
// ...), en dan moet de schatter-expert dat ook zo kunnen invullen i.p.v. een gok te doen. Een
// gekozen "Onbekend" komt zo ook in het verslag. Uitzondering ("zonderOnbekend"): keuzes die de
// schatter-expert zelf maakt of die de berekening sturen (vastgoedtype, reden van de schatting,
// waarderingsmethode, ABEX-klasse/gevels, ...) — daar heeft "Onbekend" geen betekenis.
export const ONBEKEND = "Onbekend";
export const metOnbekend = (opties) => (opties.includes(ONBEKEND) ? opties : [...opties, ONBEKEND]);
export function Select({ options, leeg, zonderOnbekend, ...props }) {
  const opties = zonderOnbekend ? options : metOnbekend(options);
  return (
    <select {...props} style={{ ...inputStyle, ...(props.style || {}) }}>
      {leeg !== undefined && <option value="">{leeg}</option>}
      {opties.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
// kleine "snelkeuze"-chips boven een vrij-tekstveld: klik vult het veld in één keer in,
// zonder de vrije-tekst-invoer te beperken (geen "actieve" toestand, want dit is geen
// meerkeuzeveld — gewoon een sneltoets om iets vaak voorkomend niet manueel te moeten typen)
export function QuickChips({ options, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {options.map((o) => (
        <button type="button" key={o} onClick={() => onPick(o)}
          className="text-xs px-2 py-0.5 rounded-full transition-colors"
          style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED, color: INK_SOFT, fontWeight: 500 }}>
          {o}
        </button>
      ))}
    </div>
  );
}
export function MultiCheck({ options, values, onChange }) {
  const toggle = (o) => {
    const has = values.includes(o);
    onChange(has ? values.filter((v) => v !== o) : [...values, o]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = values.includes(o);
        return (
          <button type="button" key={o} onClick={() => toggle(o)} aria-pressed={active}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={{
              border: `1px solid ${active ? ACCENT : LINE}`,
              background: active ? ACCENT_SOFT : PAPER_RAISED,
              color: active ? ACCENT : INK_SOFT, fontWeight: 500,
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer select-none mb-1"
      style={{ color: checked ? ACCENT : INK_SOFT, fontWeight: 500 }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 14, height: 14, accentColor: ACCENT }} />
      {label}
    </label>
  );
}

// ---------- step: SectionCard wrapper ----------
export function Section({ title, icon: Icon, children }) {
  return (
    <div className="mb-8">
      {/* kop: messing icoon, titel, en een dunne lijn die de rest van de breedte vult */}
      <div className="flex items-center gap-2.5 mb-4">
        <Icon size={15} style={{ color: ACCENT, flexShrink: 0 }} />
        <h3 style={{ fontFamily: SANS, fontSize: 16, color: INK, fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{title}</h3>
        <span aria-hidden="true" style={{ flex: 1, height: 1, background: LINE, marginLeft: 4 }} />
      </div>
      {/* één kolom op een telefoon, twee vanaf een tablet: twee kolommen van ~150px naast elkaar
          (wat het voordien werd) maakt elk invoerveld onbruikbaar bij een plaatsbezoek */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

// toggle-chips die hun "actieve" toestand afleiden uit of hun label al in een vrij-tekstveld
// voorkomt (i.p.v. een eigen losse state bij te houden) — zie StepLigging voor het gebruik.
export function ChipToggle({ options, text, onToggle }) {
  const active = (opt) => (text || "").toLowerCase().includes(opt.toLowerCase());
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const isActive = active(o);
        return (
          <button type="button" key={o} onClick={() => onToggle(o)}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={{
              border: `1px solid ${isActive ? ACCENT : LINE}`,
              background: isActive ? ACCENT_SOFT : PAPER_RAISED,
              color: isActive ? ACCENT : INK_SOFT, fontWeight: 500,
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({ label, value, onChange, hint }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: INK_SOFT, fontWeight: 500 }}>{label}</span>
        <span className="font-mono" style={{ color: ACCENT }}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(e.target.value)} className="w-full" />
      {hint && <span className="block text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.75 }}>{hint}</span>}
    </div>
  );
}

export function Row({ label, v }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: INK_SOFT, fontFamily: SANS }}>{label}</span>
      <span style={{ color: INK }}>{v}</span>
    </div>
  );
}
