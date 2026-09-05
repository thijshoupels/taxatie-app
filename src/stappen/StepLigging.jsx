// ----------------------------------------------------------------------------
// stappen/StepLigging.jsx — wizardtabblad "Ligging & omgeving"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React, { useState } from "react";
import { MapPin, Ruler, Building2, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { INK, BRASS, STAMP, DANGER, OPTS } from "../constants.js";
import { Field, inputStyle, TextInput, Select, Section, ChipToggle } from "../ui/velden.jsx";
import { callClaudeWithSearch, extractJson } from "../data/ai.js";

// ---------- step: ligging & omgeving ----------
export function StepLigging({ d, set }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const adresVolledig = d.straat && d.gemeente;

  const mergeText = (existing, addition) => {
    const have = existing.toLowerCase();
    if (have.includes(addition.toLowerCase())) return existing;
    return existing.trim() ? `${existing.trim()}, ${addition}` : addition;
  };
  const toggleChip = (field, phrase) => {
    const current = d[field] || "";
    if (current.toLowerCase().includes(phrase.toLowerCase())) {
      const cleaned = current.split(/,\s*/).filter((p) => p.trim().toLowerCase() !== phrase.toLowerCase()).join(", ");
      set(field)(cleaned);
    } else {
      set(field)(mergeText(current, phrase));
    }
  };

  const zoekOmgeving = async () => {
    setLoading(true);
    setError("");
    try {
      const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}, België`;
      const prompt = `Zoek op het internet de werkelijke, actuele omgeving en bereikbaarheid op voor het adres: ${adres}.
Geef beknopt en feitelijk (geen overdrijvingen) weer:
1. Voorzieningen in de ruimere omgeving: reële, nabijgelegen handelszaken, scholen, banken, ziekenhuizen, administraties, ontspanning — noem waar mogelijk concrete namen/afstanden.
2. Bereikbaarheid: reële afstand/verbinding met openbaar vervoer (bus/trein) en met de auto (op-/afrit autosnelweg), fietsbereikbaarheid.
Schrijf in het Nederlands, in de stijl van een professioneel taxatieverslag.
Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat:
{"omgevingsvoorzieningen": "...", "bereikbaarheid": "..."}`;

      const raw = await callClaudeWithSearch(prompt);
      const parsed = extractJson(raw);
      if (parsed.omgevingsvoorzieningen) set("omgevingsvoorzieningen")(mergeText(d.omgevingsvoorzieningen, parsed.omgevingsvoorzieningen));
      if (parsed.bereikbaarheid) set("bereikbaarheid")(mergeText(d.bereikbaarheid, parsed.bereikbaarheid));
    } catch (e) {
      setError(`Kon de omgeving niet opzoeken (${e.message || "onbekende fout"}). Probeer opnieuw.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin size={15} style={{ color: BRASS }} />
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>Ligging in de omgeving</h3>
          </div>
          <button onClick={zoekOmgeving} disabled={loading || !adresVolledig}
            title={!adresVolledig ? "Vul eerst straat en gemeente in (stap Opdracht & partijen)" : ""}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
            style={{ background: loading || !adresVolledig ? "#B8B4A8" : STAMP }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {loading ? "Omgeving opzoeken..." : "Opzoeken via AI (op basis van adres)"}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Voorzieningen in de ruimere omgeving" full hint="Handelszaken, banken, scholen, bejaardentehuizen, administraties, ziekenhuizen, ontspanning...">
            <div className="mb-2"><ChipToggle options={OPTS.omgevingsvoorzieningen} text={d.omgevingsvoorzieningen} onToggle={(p) => toggleChip("omgevingsvoorzieningen", p)} /></div>
            <textarea value={d.omgevingsvoorzieningen} onChange={set("omgevingsvoorzieningen")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Bereikbaarheid" full hint="Via openbaar of privaat vervoer">
            <div className="mb-2"><ChipToggle options={OPTS.bereikbaarheid} text={d.bereikbaarheid} onToggle={(p) => toggleChip("bereikbaarheid", p)} /></div>
            <textarea value={d.bereikbaarheid} onChange={set("bereikbaarheid")} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Toestand & uitrusting van de straat" full hint="Nutsvoorzieningen — Vlabel-kwaliteitseis bij een schattingsverslag">
            <div className="mb-2"><ChipToggle options={OPTS.straatuitrusting} text={d.straatuitrusting} onToggle={(p) => toggleChip("straatuitrusting", p)} /></div>
            <textarea value={d.straatuitrusting} onChange={set("straatuitrusting")} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Stedenbouwkundige voorschriften" full hint="Gewestplan, BPA, RUP of verkavelingsplan">
            <TextInput value={d.bpaRupVerkaveling} onChange={set("bpaRupVerkaveling")} />
          </Field>
        </div>
      </div>
      <Section title="Terrein" icon={Ruler}>
        <Field label="Vorm van het perceel"><TextInput value={d.vormPerceel} onChange={set("vormPerceel")} /></Field>
        <Field label="Rooilijnbreedte (m)"><TextInput type="number" value={d.rooilijnbreedte} onChange={set("rooilijnbreedte")} /></Field>
        <Field label="Relatieve hoogteligging"><Select options={OPTS.hoogteligging} value={d.hoogteligging} onChange={set("hoogteligging")} /></Field>
        <Field label="Bodemoccupatie (%)"><TextInput type="number" value={d.bodemoccupatie} onChange={set("bodemoccupatie")} /></Field>
      </Section>
      <Section title="Gebouw — inplanting" icon={Building2}>
        <Field label="Aantal bijgebouwen"><TextInput type="number" value={d.aantalBijgebouwen} onChange={set("aantalBijgebouwen")} /></Field>
        <Field label="Inplanting op het terrein" full><TextInput value={d.inplanting} onChange={set("inplanting")} /></Field>
      </Section>
    </div>
  );
}
