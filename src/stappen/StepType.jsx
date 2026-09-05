// ----------------------------------------------------------------------------
// stappen/StepType.jsx — wizardtabblad "Type, staat & kadaster"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React from "react";
import { Building2 } from "lucide-react";
import { OPTS } from "../constants.js";
import { unit } from "../lib/format.js";
import { Field, TextInput, Select, MultiCheck, Section } from "../ui/velden.jsx";

// ---------- step 2: type, staat & kadaster ----------
export function StepType({ d, set }) {
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  return (
    <div>
      <Section title="Type onroerend goed" icon={Building2}>
        <Field label="Vastgoedtype" full hint="Stuurt welke tabbladen en waarderingsvelden verderop getoond worden">
          <Select options={OPTS.vastgoedType} value={d.vastgoedType} onChange={(e) => {
            const val = e && e.target ? e.target.value : e;
            const wasResidentieel = isResidentieel;
            const wordtResidentieel = val !== "KMO-vastgoed" && val !== "Bedrijfsvastgoed";
            set("vastgoedType")(val);
            if (val !== "Bedrijfsvastgoed") set("bedrijfsSubtype")("");
            // "Pand" en "Type huurcontract" volgen mee met een wissel tussen residentieel en
            // bedrijfsmatig, zodat nooit "Woning"/"Woninghuur" blijft staan bij een bedrijfsmatig
            // dossier (of omgekeerd) — enkel wanneer de huidige waarde niet meer in de nieuwe
            // optielijst voorkomt, zodat een reeds bewust gekozen waarde niet zomaar verdwijnt.
            if (wasResidentieel && !wordtResidentieel) {
              if (!OPTS.pandTypeBedrijfsmatig.includes(d.pandType)) set("pandType")("Bedrijfsgebouw");
              if (!OPTS.huurcontractTypeBedrijfsmatig.includes(d.huurderContractType)) set("huurderContractType")("Handelshuur (9 jaar, wet 30/04/1951)");
            } else if (!wasResidentieel && wordtResidentieel) {
              if (!OPTS.pandType.includes(d.pandType)) set("pandType")("Woning");
              if (!OPTS.huurcontractType.includes(d.huurderContractType)) set("huurderContractType")("Woninghuur 9 jaar");
            }
          }} />
        </Field>
        {d.vastgoedType === "Bedrijfsvastgoed" && (
          <Field label="Subtype bedrijfsvastgoed" hint="Bepaalt de subtype-specifieke velden op het tabblad 'Bedrijfskenmerken'">
            <Select options={OPTS.bedrijfsSubtype} value={d.bedrijfsSubtype} onChange={set("bedrijfsSubtype")} />
          </Field>
        )}
        <Field label="Pand">
          <Select options={isResidentieel ? OPTS.pandType : OPTS.pandTypeBedrijfsmatig} value={d.pandType} onChange={set("pandType")} />
        </Field>
        {isResidentieel ? (
          <Field label="Aard van de woning" hint="Bv. bungalow, villa, herenhuis, hoeve, rijwoning, ...">
            <TextInput value={d.aardWoning} onChange={set("aardWoning")} />
          </Field>
        ) : (
          <Field label="Aard van het bedrijfspand" hint="Bv. bedrijfsloods, kantoorgebouw, winkelpand, KMO-unit, showroom, ...">
            <TextInput value={d.aardWoning} onChange={set("aardWoning")} />
          </Field>
        )}
        <Field label="Bouwtype"><Select options={OPTS.bouwtype} value={d.bouwtype} onChange={set("bouwtype")} /></Field>
        <Field label="Verdieping(en)"><TextInput value={d.verdiepingen} onChange={set("verdiepingen")} placeholder="bv. gelijkvloers + 2 verdiepingen" /></Field>
        <Field label="Lift"><Select options={OPTS.jaNee.slice(0, 2)} value={d.lift} onChange={set("lift")} /></Field>
        <Field label="Bouwjaar"><TextInput type="number" value={d.bouwjaar} onChange={set("bouwjaar")} /></Field>
        <Field label="Renovatiejaar"><TextInput type="number" value={d.renovatiejaar} onChange={set("renovatiejaar")} /></Field>
        <Field label="Jaar van aankoop"><TextInput type="number" value={d.jaarVanAankoop} onChange={set("jaarVanAankoop")} /></Field>
        <Field label="Staat" full>
          <MultiCheck options={OPTS.staat} values={d.staat} onChange={(v) => set("staat")(v)} />
        </Field>
      </Section>
      <Section title="Kadastrale gegevens" icon={Building2}>
        <Field label="Kadastrale afdeling"><TextInput value={d.kadAfdeling} onChange={set("kadAfdeling")} /></Field>
        <Field label="Kadastrale sectie"><TextInput value={d.kadSectie} onChange={set("kadSectie")} /></Field>
        <Field label="Perceelnummer"><TextInput value={d.kadPerceelnummer} onChange={set("kadPerceelnummer")} /></Field>
        <Field label="Partitienummer"><TextInput value={d.kadPartitienummer} onChange={set("kadPartitienummer")} /></Field>
        <Field label="Kadastrale oppervlakte (m²)"><TextInput type="number" value={d.kadastraleOpp} onChange={set("kadastraleOpp")} /></Field>
        <Field label="KI (kadastraal inkomen)"><TextInput value={d.ki} onChange={set("ki")} /></Field>
        <Field label="Onroerende voorheffing"><TextInput value={d.onroerendeVoorheffing} onChange={set("onroerendeVoorheffing")} /></Field>
        <Field label="Detail-identificatie privatieve eigendom" hint="Bv. ligging en nummer appartement, garage, kelder — bij mede-eigendom">
          <TextInput value={d.kadDetailPrivatief} onChange={set("kadDetailPrivatief")} />
        </Field>
      </Section>
    </div>
  );
}
