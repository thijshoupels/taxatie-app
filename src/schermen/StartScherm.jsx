// ----------------------------------------------------------------------------
// schermen/StartScherm.jsx — eerste scherm van een nieuw dossier
// ----------------------------------------------------------------------------
// Vroeger opende een nieuw dossier op "Documenten", terwijl het vastgoedtype (dat bepaalt welke
// tabbladen er zijn) en het adres (nodig voor de kaarten en de AI-opzoeking van de ligging) pas op
// tabblad 5 stonden. Hier vraagt de app eerst de vijf dingen die alles verderop sturen. Alles blijft
// achteraf aan te passen op de gewone tabbladen; "Overslaan" opent meteen de wizard.
import React from "react";
import { Building2, MapPin, ClipboardList, ArrowRight } from "lucide-react";
import { INK, INK_SOFT, LINE, PAPER, PAPER_RAISED, ACCENT, SANS, OPTS } from "../constants.js";
import { Field, TextInput, Select } from "../ui/velden.jsx";
import { typeVan, isGrond } from "../domein/vastgoedtypes.js";
import { zetVastgoedtype, pandOptiesVoor } from "../stappen/StepType.jsx";

export function startKlaar(d) {
  const adresOk = (String(d.straat || "").trim() || (isGrond(d) && String(d.capakey || "").trim())) && String(d.gemeente || "").trim();
  return !!(adresOk && String(d.reden || "").trim());
}

export function StartScherm({ d, set, onStart, onOverslaan }) {
  const grond = isGrond(d);
  const klaar = startKlaar(d);
  const blok = (Icon, titel, kinderen) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} style={{ color: ACCENT }} />
        <h3 style={{ fontFamily: SANS, fontSize: 15, color: INK, fontWeight: 600 }}>{titel}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{kinderen}</div>
    </div>
  );
  return (
    <div className="start-scherm" style={{ maxWidth: 760 }}>
      <h2 style={{ fontFamily: SANS, fontSize: 20, color: INK, fontWeight: 600, letterSpacing: "-0.01em" }}>Nieuw dossier</h2>
      <p className="text-sm mt-1 mb-6" style={{ color: INK_SOFT }}>
        Eerst de basis: wat schat je, waar ligt het en waarom. Daarmee kiest de app de juiste tabbladen en kan ze de kaarten en de
        omgeving opzoeken. Alles blijft achteraf aan te passen.
      </p>

      {blok(Building2, "Wat schat je?", <>
        <Field label="Vastgoedtype" hint="Bepaalt welke tabbladen je krijgt">
          <Select zonderOnbekend options={OPTS.vastgoedType} value={typeVan(d)} onChange={(e) => zetVastgoedtype(d, set, e.target.value)} />
        </Field>
        <Field label="Pand">
          <Select zonderOnbekend options={pandOptiesVoor(d)} value={d.pandType} onChange={set("pandType")} />
        </Field>
      </>)}

      {blok(MapPin, "Waar ligt het?", <>
        <Field label="Straat" verplicht={!grond}><TextInput value={d.straat} onChange={set("straat")} autoComplete="off" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nummer"><TextInput value={d.nummer} onChange={set("nummer")} /></Field>
          <Field label="Bus"><TextInput value={d.bus} onChange={set("bus")} /></Field>
        </div>
        <Field label="Postcode"><TextInput value={d.postcode} onChange={set("postcode")} inputMode="numeric" /></Field>
        <Field label="Gemeente" verplicht><TextInput value={d.gemeente} onChange={set("gemeente")} /></Field>
        {grond && (
          <Field label="CaPaKey" full hint="Voor een grond zonder adres volstaan gemeente en CaPaKey">
            <TextInput value={d.capakey} onChange={set("capakey")} />
          </Field>
        )}
      </>)}

      {blok(ClipboardList, "Waarom en voor wie?", <>
        <Field label="Reden van waardering" verplicht hint="Bij een nalatenschap vraagt de app ook de Vlabel-gegevens">
          <Select zonderOnbekend options={OPTS.reden} value={d.reden} onChange={set("reden")} />
        </Field>
        <Field label="Opdrachtgever (naam of benaming)"><TextInput value={d.opdrachtgeverNaam} onChange={set("opdrachtgeverNaam")} /></Field>
      </>)}

      <div className="flex flex-wrap items-center gap-3 pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
        <button type="button" onClick={onStart} disabled={!klaar}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg"
          style={{ background: klaar ? INK : "var(--ink-faint)", color: klaar ? PAPER : "#fff", fontWeight: 500, cursor: klaar ? "pointer" : "not-allowed" }}>
          Dossier starten <ArrowRight size={14} />
        </button>
        {!klaar && (
          <span className="text-xs" style={{ color: INK_SOFT }}>
            Vul {grond ? "straat of CaPaKey" : "straat"}, gemeente en de reden in.
          </span>
        )}
        <button type="button" onClick={onOverslaan} className="text-xs ml-auto underline" style={{ color: INK_SOFT, background: "none" }}>
          Overslaan — later invullen
        </button>
      </div>
      <div className="text-xs mt-4 px-3 py-2 rounded" style={{ background: PAPER_RAISED, color: INK_SOFT, border: `1px solid ${LINE}` }}>
        Daarna start je met <strong>Documenten</strong>: laad de vastgoedinformatie, het kadastraal uittreksel en het EPC op, en
        de AI vult de meeste velden voor je in.
      </div>
    </div>
  );
}
