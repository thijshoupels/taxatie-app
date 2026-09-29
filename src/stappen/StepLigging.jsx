// ----------------------------------------------------------------------------
// stappen/StepLigging.jsx — wizardtabblad "Ligging & omgeving"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React, { useState } from "react";
import { MapPin, Ruler, Building2, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { INK, ACCENT, STAMP, DANGER, OPTS, SANS } from "../constants.js";
import { Field, inputStyle, TextInput, Select, Section, ChipToggle } from "../ui/velden.jsx";
import { callClaudeWithSearch, extractJson } from "../data/ai.js";

// ---------- step: ligging & omgeving ----------
export function StepLigging({ d, set }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const adresVolledig = d.straat && d.gemeente;
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}, België`;
  // AI-creditverbruik: zolang het adres niet wijzigde sinds de laatste succesvolle opzoeking
  // (bijgehouden in d.liggingOpgezochtAdres, zie constants.js), levert een nieuwe AI+web-search-
  // aanvraag toch weer hetzelfde resultaat op — de knop hieronder slaat die dan over, tenzij de
  // schatter-expert bewust "Toch opnieuw opzoeken" gebruikt.
  const alOpgezocht = adresVolledig && d.liggingOpgezochtAdres === adres;

  // Aangeklikte chips staan samen op de EERSTE regel ("Scholen, Apotheek, Horeca"); vrije tekst en
  // AI-punten elk op een eigen regel daaronder. Zo blijft het invoerveld leesbaar én kan
  // domein/ligging.js de chips in het verslag netjes als één opsommingspunt groeperen.
  const isChipRegel = (field, regel) => {
    const opties = (OPTS[field] || []).map((o) => o.toLowerCase());
    return regel.trim() !== "" && regel.split(/,\s+/).every((p) => opties.includes(p.trim().toLowerCase()));
  };
  const mergeText = (field, existing, addition) => {
    const huidig = (existing || "").trim();
    if (!huidig) return addition;
    if (huidig.toLowerCase().includes(addition.toLowerCase())) return existing;
    const regels = huidig.split("\n");
    if (isChipRegel(field, regels[0])) {
      regels[0] = `${regels[0].trim()}, ${addition}`;
      return regels.join("\n");
    }
    return [addition, ...regels].join("\n");
  };
  // AI-resultaat: elk punt op een eigen regel toevoegen (i.p.v. met komma's achter de chips te
  // plakken, wat in het verslag één onleesbare alinea gaf) — regels die er al staan niet opnieuw
  const voegRegelsToe = (existing, regels) => {
    const huidig = (existing || "").trim();
    const have = huidig.toLowerCase();
    const nieuw = regels.filter((r) => !have.includes(r.toLowerCase()));
    if (!nieuw.length) return existing;
    return huidig ? `${huidig}\n${nieuw.join("\n")}` : nieuw.join("\n");
  };
  const toggleChip = (field, phrase) => {
    const current = d[field] || "";
    if (current.toLowerCase().includes(phrase.toLowerCase())) {
      // per regel, en enkel splitsen op ", " (komma + spatie): een decimale komma zoals in
      // "ca. 1,2 km" mag hierbij niet in twee vallen
      const cleaned = current.split("\n")
        .map((regel) => regel.split(/,\s+/).filter((p) => p.trim().toLowerCase() !== phrase.toLowerCase()).join(", "))
        .filter((regel) => regel.trim())
        .join("\n");
      set(field)(cleaned);
    } else {
      set(field)(mergeText(field, current, phrase));
    }
  };

  const zoekOmgeving = async (forceer = false) => {
    if (alOpgezocht && !forceer) return;
    setLoading(true);
    setError("");
    try {
      // Bewust kritisch en beknopt: het resultaat komt (via domein/ligging.js) als losse
      // opsommingspunten in het verslag — enkel concrete, waardebepalende feiten met naam en
      // afstand, geen algemene/wervende zinnen, en ook de negatieve omgevingsfactoren.
      const prompt = `Zoek op het internet de werkelijke, actuele omgeving en bereikbaarheid op voor het adres: ${adres}.
Het resultaat komt als opsomming in de rubriek "Ligging in de omgeving" van een schattingsverslag. Wees kritisch en beknopt:
- Enkel concrete, verifieerbare punten die de waarde van het pand beïnvloeden, telkens met naam en (hemelsbrede of rij-)afstand. Voorbeeld: "Supermarkt Colruyt — ca. 1,2 km".
- Geen algemene of wervende zinnen (dus NIET: "aangename woonomgeving", "alle voorzieningen op korte afstand", "ideaal voor gezinnen").
- Laat weg wat niet onderscheidend is of verder dan ca. 5 km ligt — behalve ziekenhuis, treinstation en op-/afrit autosnelweg.
- Elk punt maximaal ca. 12 woorden, zonder afsluitend punt.
Rubrieken:
1. "omgevingsvoorzieningen": max. 6 punten — dagelijkse boodschappen, basis-/secundair onderwijs, kinderopvang, huisarts/apotheek, ziekenhuis, groen/sport.
2. "bereikbaarheid": max. 4 punten — dichtstbijzijnde bushalte (lijn), treinstation, op-/afrit autosnelweg (met nummer), fietsinfrastructuur.
3. "aandachtspunten": enkel als ze er echt zijn, max. 3 punten — negatieve omgevingsfactoren zoals een drukke gewestweg, spoorlijn, industrie, luchthavenhinder of overstromingsgevoelig gebied. Anders een lege lijst.
Schrijf in het Nederlands.
Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat:
{"omgevingsvoorzieningen": ["..."], "bereikbaarheid": ["..."], "aandachtspunten": []}`;

      const raw = await callClaudeWithSearch(prompt);
      const parsed = extractJson(raw);
      const alsLijst = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [])
        .map((x) => String(x).trim()).filter(Boolean);
      const voorzieningen = [
        ...alsLijst(parsed.omgevingsvoorzieningen),
        ...alsLijst(parsed.aandachtspunten).map((x) => `Aandachtspunt: ${x}`),
      ];
      const bereikbaarheid = alsLijst(parsed.bereikbaarheid);
      if (voorzieningen.length) set("omgevingsvoorzieningen")(voegRegelsToe(d.omgevingsvoorzieningen, voorzieningen));
      if (bereikbaarheid.length) set("bereikbaarheid")(voegRegelsToe(d.bereikbaarheid, bereikbaarheid));
      set("liggingOpgezochtAdres")(adres);
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
            <MapPin size={15} style={{ color: ACCENT }} />
            <h3 style={{ fontFamily: SANS, fontSize: 16, color: INK, fontWeight: 500 }}>Ligging in de omgeving</h3>
          </div>
          <button onClick={() => zoekOmgeving(false)} disabled={loading || !adresVolledig || alOpgezocht}
            title={!adresVolledig ? "Vul eerst straat en gemeente in (stap Opdracht & partijen)" : ""}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
            style={{ background: loading || !adresVolledig || alOpgezocht ? "#B8B4A8" : STAMP }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {loading ? "Omgeving opzoeken..." : alOpgezocht ? "Al opgezocht voor dit adres" : "Opzoeken via AI (op basis van adres)"}
          </button>
        </div>
        {alOpgezocht && !loading && (
          <div className="text-xs mb-3" style={{ color: INK }}>
            Dit adres werd al via AI opgezocht — resultaat staat hieronder verwerkt. Wijzig het adres (tabblad "Opdracht & partijen")
            voor een nieuwe zoekopdracht, of{" "}
            <button onClick={() => zoekOmgeving(true)} className="underline" style={{ color: ACCENT }}>toch opnieuw opzoeken</button>.
          </div>
        )}
        {error && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Voorzieningen in de ruimere omgeving" full hint="Eén punt per regel, met naam en afstand (bv. Supermarkt Colruyt — ca. 1,2 km) — verschijnt als opsomming in het verslag">
            <div className="mb-2"><ChipToggle options={OPTS.omgevingsvoorzieningen} text={d.omgevingsvoorzieningen} onToggle={(p) => toggleChip("omgevingsvoorzieningen", p)} /></div>
            <textarea value={d.omgevingsvoorzieningen} onChange={set("omgevingsvoorzieningen")} rows={5} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Bereikbaarheid" full hint="Eén punt per regel: bus/trein, op-/afrit autosnelweg, fiets — verschijnt als opsomming in het verslag">
            <div className="mb-2"><ChipToggle options={OPTS.bereikbaarheid} text={d.bereikbaarheid} onToggle={(p) => toggleChip("bereikbaarheid", p)} /></div>
            <textarea value={d.bereikbaarheid} onChange={set("bereikbaarheid")} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Toestand & uitrusting van de straat" full hint="Nutsvoorzieningen — Vlabel-kwaliteitseis bij een schattingsverslag">
            <div className="mb-2"><ChipToggle options={OPTS.straatuitrusting} text={d.straatuitrusting} onToggle={(p) => toggleChip("straatuitrusting", p)} /></div>
            <textarea value={d.straatuitrusting} onChange={set("straatuitrusting")} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Stedenbouwkundige voorschriften" full hint="BPA, RUP of verkavelingsplan — staat in het verslag bij de stedenbouwkundige gegevens">
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
