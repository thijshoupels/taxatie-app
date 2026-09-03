// ----------------------------------------------------------------------------
// ui/velden.jsx — generieke, herbruikbare invoer-/weergavecomponenten
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 7) zonder de logica/opmaak zelf te
// wijzigen: Field/TextInput/Select/QuickChips/MultiCheck/Checkbox/Section/ChipToggle/Slider/Row
// worden door bijna elke wizard-stap gebruikt en horen niet bij één specifieke stap.
import React from "react";
import { INK, INK_SOFT, PAPER_RAISED, LINE, BRASS, BRASS_SOFT } from "../constants.js";

// ---------- generic field components ----------
// "full" = over de volledige breedte. Onder 768px staat alles toch al onder elkaar (zie Section),
// dus geldt die kolomoverspanning pas vanaf md — anders zou een veld op een telefoon proberen twee
// kolommen te overspannen die er niet zijn.
export function Field({ label, children, hint, full }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>{label}</span>
      {children}
      {hint && <span className="block text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.75 }}>{hint}</span>}
    </label>
  );
}

export const inputStyle = {
  border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 10px", fontSize: 14,
  width: "100%", background: PAPER_RAISED, color: INK, outline: "none",
};

export function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
export function Select({ options, ...props }) {
  return (
    <select {...props} style={{ ...inputStyle, ...(props.style || {}) }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
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
              border: `1px solid ${active ? BRASS : LINE}`,
              background: active ? BRASS_SOFT : PAPER_RAISED,
              color: active ? BRASS : INK_SOFT, fontWeight: 500,
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
      style={{ color: checked ? BRASS : INK_SOFT, fontWeight: 500 }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 14, height: 14, accentColor: BRASS }} />
      {label}
    </label>
  );
}

// ---------- step: SectionCard wrapper ----------
export function Section({ title, icon: Icon, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} style={{ color: BRASS }} />
        <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>{title}</h3>
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
              border: `1px solid ${isActive ? BRASS : LINE}`,
              background: isActive ? BRASS_SOFT : PAPER_RAISED,
              color: isActive ? BRASS : INK_SOFT, fontWeight: 500,
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: INK_SOFT, fontWeight: 500 }}>{label}</span>
        <span className="font-mono" style={{ color: BRASS }}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(e.target.value)} className="w-full" />
    </div>
  );
}

export function Row({ label, v }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: INK_SOFT, fontFamily: "system-ui" }}>{label}</span>
      <span style={{ color: INK }}>{v}</span>
    </div>
  );
}
