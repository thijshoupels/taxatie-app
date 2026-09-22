// ----------------------------------------------------------------------------
// stappen/StepVerhuring.jsx — wizardtabblad "Verhuring" (huurder, huurcontract, kosten & voorwaarden)
// ----------------------------------------------------------------------------
// Voorheen stond dit als één "Huurder"-sectie onderaan StepMarkt.jsx, tussen de markt- en
// stedenbouwkundige velden in — enkel zichtbaar zodra "Gebruik" (óók op dat tabblad) op "Verhuurd"
// stond. Dat maakte de huurgegevens makkelijk over het hoofd te zien tussen de vele andere velden.
// Nu een eigen tabblad: het verschijnt in de tabbladenlijst (zie de steps-array in DossierWizard)
// zodra het ACTIEVE pand op "Verhuurd" staat, en verdwijnt weer zodra dat niet meer zo is — net als
// de bestaande wissel tussen "Ruimte-eigenschappen" en "Bedrijfskenmerken" op basis van vastgoedType.
// De velden zelf, hun opties en hun voorwaarden (de Handelshuurwet-uitbreiding bij niet-residentieel
// vastgoed) zijn ongewijzigd t.o.v. voorheen — enkel opnieuw ingedeeld in 3 duidelijke groepen i.p.v.
// alles onder 1 kopje "Huurder": wie de huurder is, wat het huurcontract zelf inhoudt, en wat de
// kosten/voorwaarden zijn. Dit tabblad werkt, net als Documenten t/m Foto's, op het ACTIEVE pand
// (actief.pd/actief.set) — bij een dossier zonder extra panden is dat gewoon het dossier zelf.
import React from "react";
import { Users, FileText, Euro } from "lucide-react";
import { OPTS } from "../constants.js";
import { Field, inputStyle, TextInput, Select, Section } from "../ui/velden.jsx";

export function StepVerhuring({ d, set }) {
  const isResidentieel = d.vastgoedType === "Residentieel";
  return (
    <div>
      <Section title="Huurder" icon={Users}>
        <Field label="Naam"><TextInput value={d.huurderNaam} onChange={set("huurderNaam")} /></Field>
        <Field label="Telefoon"><TextInput value={d.huurderTelefoon} onChange={set("huurderTelefoon")} /></Field>
        <Field label="E-mail"><TextInput type="email" value={d.huurderEmail} onChange={set("huurderEmail")} /></Field>
      </Section>

      <Section title="Huurcontract" icon={FileText}>
        <Field label="Type huurcontract">
          <Select options={isResidentieel ? OPTS.huurcontractType : OPTS.huurcontractTypeBedrijfsmatig} value={d.huurderContractType} onChange={set("huurderContractType")} />
        </Field>
        <Field label="Duurtijd"><TextInput value={d.huurderDuurtijd} onChange={set("huurderDuurtijd")} placeholder="bv. 9 jaar, start 01/2023" /></Field>
        {/* uitbreiding voor KMO-vastgoed/Bedrijfsvastgoed — kernbegrippen uit de Handelshuurwet (wet
            van 30 april 1951): minimumduur 9 jaar, driejaarlijkse opzegmogelijkheid voor de huurder,
            hernieuwingsrecht (tot 3x). Residentieel/Woninghuur blijft ongewijzigd bij de velden
            hierboven. */}
        {!isResidentieel && (
          <>
            <Field label="Aanvangsdatum huurovereenkomst"><TextInput type="date" value={d.huurderAanvangsdatum} onChange={set("huurderAanvangsdatum")} /></Field>
            <Field label="Eerstvolgende opzegmogelijkheid" hint="Handelshuur: in principe elke 3 jaar, mits 6 maanden opzeg per aangetekend schrijven of deurwaardersexploot">
              <TextInput value={d.huurderEersteOpzegmogelijkheid} onChange={set("huurderEersteOpzegmogelijkheid")} placeholder="bv. 01/2027" />
            </Field>
            <Field label="Hernieuwingsrecht"><Select options={OPTS.huurderHernieuwingsrecht} value={d.huurderHernieuwingsrecht} onChange={set("huurderHernieuwingsrecht")} /></Field>
          </>
        )}
      </Section>

      <Section title="Kosten & voorwaarden" icon={Euro}>
        <Field label="Huurprijs"><TextInput type="number" value={d.huurderHuurprijs} onChange={set("huurderHuurprijs")} /></Field>
        {!isResidentieel && (
          <>
            <Field label="Indexatie"><TextInput value={d.huurderIndexatie} onChange={set("huurderIndexatie")} placeholder="bv. jaarlijks, gezondheidsindex" /></Field>
            <Field label="Huurwaarborg"><TextInput value={d.huurderWaarborg} onChange={set("huurderWaarborg")} placeholder="bv. 3 maanden huur, bankwaarborg" /></Field>
            <Field label="Bijzonderheden opzegtermijn / -beding" full hint="Afwijkende bedingen t.o.v. de standaard Handelshuurwet-regeling">
              <textarea value={d.huurderOpzegtermijnBijzonderheden} onChange={set("huurderOpzegtermijnBijzonderheden")} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        )}
      </Section>
    </div>
  );
}
