// ----------------------------------------------------------------------------
// stappen/StepRuimteEigenschappen.jsx — wizardtabblad "Eigenschappen per ruimte"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen. Bevat ook RoomChecklist, dat enkel door StepRuimteEigenschappen gebruikt wordt.
import React from "react";
import { Plus, Trash2, BedDouble, Sofa } from "lucide-react";
import { INK_SOFT, PAPER_RAISED, LINE, BRASS, DANGER, RUIMTE_CHECKLISTS } from "../constants.js";
import { TextInput, Select, MultiCheck } from "../ui/velden.jsx";

// ---------- step 4: eigenschappen per ruimte ----------
export function RoomChecklist({ cfg, state, onChange }) {
  const Icon = cfg.icon;
  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: BRASS }} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>{cfg.label}</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "160px 1fr" }}>
        <TextInput placeholder="Vloer" value={state.vloer} onChange={(e) => onChange("vloer", e.target.value)} />
        {cfg.extraNumber && (
          <TextInput type="number" placeholder={cfg.extraNumber.label} value={state[cfg.extraNumber.key]}
            onChange={(e) => onChange(cfg.extraNumber.key, e.target.value)} style={{ maxWidth: 140 }} />
        )}
        {cfg.extraSelect && (
          <Select options={cfg.extraSelect.opts} value={state[cfg.extraSelect.key]}
            onChange={(e) => onChange(cfg.extraSelect.key, e.target.value)} style={{ maxWidth: 200 }} />
        )}
      </div>
      {cfg.extraMultiCheck && (
        <div className="mt-2">
          <div className="mb-1" style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}>{cfg.extraMultiCheck.label}</div>
          <MultiCheck options={cfg.extraMultiCheck.opts} values={state[cfg.extraMultiCheck.key] || []}
            onChange={(v) => onChange(cfg.extraMultiCheck.key, v)} />
        </div>
      )}
      {cfg.optGroups ? (
        cfg.optGroups.map((g) => (
          <div className="mt-2" key={g.key}>
            <div className="mb-1" style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}>{g.label}</div>
            <MultiCheck options={g.opts} values={state.items} onChange={(v) => onChange("items", v)} />
          </div>
        ))
      ) : (
        <div className="mt-2">
          <MultiCheck options={cfg.opts} values={state.items} onChange={(v) => onChange("items", v)} />
        </div>
      )}
      {cfg.extraText && (
        <TextInput className="mt-2" placeholder={cfg.extraText.placeholder} value={state[cfg.extraText.key]}
          onChange={(e) => onChange(cfg.extraText.key, e.target.value)} />
      )}
    </div>
  );
}

export function StepRuimteEigenschappen({ d, setEig, addSlaapkamer, removeSlaapkamer, updateSlaapkamer, addExtraRuimte, removeExtraRuimte, updateExtraRuimte }) {
  return (
    <div>
      <div className="mb-6">
        {RUIMTE_CHECKLISTS.slice(0, 4).map((cfg) => (
          <RoomChecklist key={cfg.key} cfg={cfg} state={d.eigenschappen[cfg.key]}
            onChange={(field, val) => setEig(cfg.key, field, val)} />
        ))}
      </div>

      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <BedDouble size={14} style={{ color: BRASS }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Slaapkamers</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr 110px 90px 32px" }}>
            {["Naam", "Vloer", "Verdieping", "Ingemaakte kast", "Radiator", ""].map((h, i) => (
              <span key={i} className="text-xs" style={{ color: INK_SOFT, fontWeight: 500 }}>{h}</span>
            ))}
          </div>
          {d.slaapkamers.map((s) => (
            <div key={s.id} className="grid gap-2 items-start" style={{ gridTemplateColumns: "1fr 1fr 1fr 110px 90px 32px" }}>
              <TextInput value={s.naam} onChange={(e) => updateSlaapkamer(s.id, "naam", e.target.value)} />
              <TextInput placeholder="Vloer" value={s.vloer} onChange={(e) => updateSlaapkamer(s.id, "vloer", e.target.value)} />
              <TextInput placeholder="Verdieping" value={s.verdieping} onChange={(e) => updateSlaapkamer(s.id, "verdieping", e.target.value)} />
              <div>
                <span className="block text-xs mb-1" style={{ color: INK_SOFT }}>Ingemaakte kast</span>
                <Select options={["Ja", "Nee"]} value={s.ingemaaktKasten}
                  aria-label="Ingemaakte kast" title="Ingemaakte kast"
                  onChange={(e) => updateSlaapkamer(s.id, "ingemaaktKasten", e.target.value)} />
              </div>
              <div>
                <span className="block text-xs mb-1" style={{ color: INK_SOFT }}>Radiator</span>
                <Select options={["Ja", "Nee"]} value={s.radiator || "Nee"}
                  aria-label="Radiator" title="Radiator"
                  onChange={(e) => updateSlaapkamer(s.id, "radiator", e.target.value)} />
              </div>
              <button onClick={() => removeSlaapkamer(s.id)} className="mt-1"><Trash2 size={14} style={{ color: DANGER }} /></button>
            </div>
          ))}
        </div>
        <button onClick={addSlaapkamer} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <Plus size={13} /> Slaapkamer toevoegen
        </button>
      </div>

      {RUIMTE_CHECKLISTS.slice(4).map((cfg) => (
        <RoomChecklist key={cfg.key} cfg={cfg} state={d.eigenschappen[cfg.key]}
          onChange={(field, val) => setEig(cfg.key, field, val)} />
      ))}

      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <Sofa size={14} style={{ color: BRASS }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Andere ruimtes</span>
        </div>
        <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
          Voor ruimtes die hierboven niet voorzien zijn (bv. bureau, wasplaats, veranda, wellness, atelier, ...).
        </div>
        <div className="flex flex-col gap-3">
          {(d.extraRuimtes || []).map((r) => (
            <div key={r.id} className="rounded-lg p-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
              <div className="grid gap-2 items-center mb-2" style={{ gridTemplateColumns: "1fr 1fr 32px" }}>
                <TextInput placeholder="Naam ruimte (bv. bureau)" value={r.naam} onChange={(e) => updateExtraRuimte(r.id, "naam", e.target.value)} />
                <TextInput placeholder="Vloer" value={r.vloer} onChange={(e) => updateExtraRuimte(r.id, "vloer", e.target.value)} />
                <button onClick={() => removeExtraRuimte(r.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
              </div>
              <TextInput placeholder="Kenmerken / uitrusting (vrije tekst)" value={r.kenmerken} onChange={(e) => updateExtraRuimte(r.id, "kenmerken", e.target.value)} />
            </div>
          ))}
        </div>
        <button onClick={addExtraRuimte} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <Plus size={13} /> Ruimte toevoegen
        </button>
      </div>
    </div>
  );
}
