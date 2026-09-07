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
// bepaalt tot welke van de drie "Pand"-optielijsten (en de bijbehorende wizardtabbladen, zie
// DossierWizard) een vastgoedType behoort — hergebruikt in de vastgoedType-switch hieronder om
// "Pand"/"Type huurcontract" mee te laten volgen bij een wissel, ongeacht welke twee categorieën
// het precies zijn.
const vastgoedCategorie = (vastgoedType) =>
  vastgoedType === "KMO-vastgoed" || vastgoedType === "Bedrijfsvastgoed" ? "bedrijfsmatig"
  : vastgoedType === "Garage / Staanplaats" ? "garage"
  : "residentieel";

export function StepType({ d, set }) {
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed" && d.vastgoedType !== "Garage / Staanplaats";
  const isGarageStaanplaats = d.vastgoedType === "Garage / Staanplaats";
  return (
    <div>
      <Section title="Type onroerend goed" icon={Building2}>
        <Field label="Vastgoedtype" full hint="Stuurt welke tabbladen en waarderingsvelden verderop getoond worden">
          <Select options={OPTS.vastgoedType} value={d.vastgoedType} onChange={(e) => {
            const val = e && e.target ? e.target.value : e;
            const vorigeCategorie = vastgoedCategorie(d.vastgoedType);
            const nieuweCategorie = vastgoedCategorie(val);
            set("vastgoedType")(val);
            if (val !== "Bedrijfsvastgoed") set("bedrijfsSubtype")("");
            // "Pand" en "Type huurcontract" volgen mee met een wissel tussen categorieën
            // (residentieel/bedrijfsmatig/garage), zodat nooit "Woning"/"Woninghuur" blijft staan bij
            // een bedrijfsmatig of garage-dossier (of omgekeerd) — enkel wanneer de huidige waarde
            // niet meer in de nieuwe optielijst voorkomt, zodat een reeds bewust gekozen waarde niet
            // zomaar verdwijnt.
            if (vorigeCategorie !== nieuweCategorie) {
              const pandOpties = nieuweCategorie === "bedrijfsmatig" ? OPTS.pandTypeBedrijfsmatig
                : nieuweCategorie === "garage" ? OPTS.pandTypeGarage
                : OPTS.pandType;
              if (!pandOpties.includes(d.pandType)) {
                set("pandType")(nieuweCategorie === "bedrijfsmatig" ? "Bedrijfsgebouw" : nieuweCategorie === "garage" ? "Garage (afgesloten box)" : "Woning");
              }
              // "Type huurcontract" bestaat enkel als residentiële/bedrijfsmatige lijst — een
              // garage-dossier toont het tabblad "Markt" (waar dit veld staat) sowieso niet meer
              // (zie de steps-array in DossierWizard), dus bij/vanaf "garage" laten we dit veld
              // gewoon op zijn huidige waarde staan i.p.v. een derde lijst te verzinnen voor een
              // veld dat voor dit vastgoedtype toch nergens getoond wordt.
              if (nieuweCategorie === "bedrijfsmatig" && !OPTS.huurcontractTypeBedrijfsmatig.includes(d.huurderContractType)) {
                set("huurderContractType")("Handelshuur (9 jaar, wet 30/04/1951)");
              } else if (nieuweCategorie === "residentieel" && !OPTS.huurcontractType.includes(d.huurderContractType)) {
                set("huurderContractType")("Woninghuur 9 jaar");
              }
            }
          }} />
        </Field>
        {d.vastgoedType === "Bedrijfsvastgoed" && (
          <Field label="Subtype bedrijfsvastgoed" hint="Bepaalt de subtype-specifieke velden op het tabblad 'Bedrijfskenmerken'">
            <Select options={OPTS.bedrijfsSubtype} value={d.bedrijfsSubtype} onChange={set("bedrijfsSubtype")} />
          </Field>
        )}
        <Field label="Pand">
          <Select options={isResidentieel ? OPTS.pandType : isGarageStaanplaats ? OPTS.pandTypeGarage : OPTS.pandTypeBedrijfsmatig} value={d.pandType} onChange={set("pandType")} />
        </Field>
        {isResidentieel ? (
          <Field label="Aard van de woning" hint="Bv. bungalow, villa, herenhuis, hoeve, rijwoning, ...">
            <TextInput value={d.aardWoning} onChange={set("aardWoning")} />
          </Field>
        ) : isGarageStaanplaats ? (
          <Field label="Aard van de garage/staanplaats" hint="Bv. afgesloten garagebox, open carport, ondergrondse staanplaats, buitenstaanplaats, fietsenberging, ...">
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
