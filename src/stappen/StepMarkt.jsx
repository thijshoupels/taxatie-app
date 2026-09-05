// ----------------------------------------------------------------------------
// stappen/StepMarkt.jsx — wizardtabblad "Markt, stedenbouw & juridisch"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React from "react";
import { LineChart, Users, ClipboardList } from "lucide-react";
import { OPTS, KLASSEN } from "../constants.js";
import { Field, inputStyle, TextInput, Select, Section } from "../ui/velden.jsx";

// ---------- step 5: markt & stedenbouw ----------
export function StepMarkt({ d, set }) {
  return (
    <div>
      <Section title="Markt & algemeen gebruik" icon={LineChart}>
        <Field label="Gebruik">
          <Select options={["Normaal", "Verhuurd", "Leegstaand"]} value={d.gebruik} onChange={set("gebruik")} />
        </Field>
        <Field label={d.vastgoedType === "Residentieel" ? "Bewoonbaarheid" : "Functionele geschiktheid"}
          hint={d.vastgoedType === "Residentieel" ? undefined : "Geschiktheid van het pand voor het beoogde bedrijfsmatige gebruik"}>
          <Select options={OPTS.kwaliteit} value={d.bewoonbaarheid} onChange={set("bewoonbaarheid")} />
        </Field>
        <Field label="Aanbod te koop"><Select options={OPTS.aanbod} value={d.aanbodTeKoop} onChange={set("aanbodTeKoop")} /></Field>
        <Field label="Aanbod te huur"><Select options={OPTS.aanbod} value={d.aanbodTeHuur} onChange={set("aanbodTeHuur")} /></Field>
        <Field label="Verkoopbaarheid"><Select options={OPTS.kwaliteit} value={d.verkoopbaarheid} onChange={set("verkoopbaarheid")} /></Field>
        <Field label="Uitzicht"><Select options={OPTS.kwaliteit} value={d.uitzicht} onChange={set("uitzicht")} /></Field>
        <Field label="Onderhoud"><Select options={OPTS.kwaliteit} value={d.onderhoud} onChange={set("onderhoud")} /></Field>
        <Field label="Inrichting"><Select options={OPTS.kwaliteit} value={d.inrichting} onChange={set("inrichting")} /></Field>
        {/* Klasse/Gevel sturen de ABEX-woningindex in de waarderingsmodule (zie berekenWaardering)
            — enkel zinvol bij Residentieel; bij KMO-/Bedrijfsvastgoed wordt de vervangingswaarde
            manueel ingeschat op het tabblad "Bedrijfskenmerken" (bedrijfsVervangingswaarde) */}
        {d.vastgoedType === "Residentieel" && (
          <>
            <Field label="Klasse" hint="Stuurt de Abex-waarde/m² in de waarderingsmodule">
              <select value={d.klasse} onChange={set("klasse")} style={inputStyle}>
                {["Woningen", "Appartementen"].map((groep) => (
                  <optgroup key={groep} label={groep}>
                    {KLASSEN.filter((k) => k.type === groep).map((k) => <option key={k.key} value={k.label}>{k.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Gevel"><Select options={["2-gevel", "3-gevel", "4-gevel"]} value={d.gevel} onChange={set("gevel")} /></Field>
          </>
        )}
      </Section>

      {d.gebruik === "Verhuurd" && (
        <Section title="Huurder" icon={Users}>
          <Field label="Naam"><TextInput value={d.huurderNaam} onChange={set("huurderNaam")} /></Field>
          <Field label="Telefoon"><TextInput value={d.huurderTelefoon} onChange={set("huurderTelefoon")} /></Field>
          <Field label="E-mail"><TextInput type="email" value={d.huurderEmail} onChange={set("huurderEmail")} /></Field>
          <Field label="Huurprijs"><TextInput type="number" value={d.huurderHuurprijs} onChange={set("huurderHuurprijs")} /></Field>
          <Field label="Type huurcontract">
            <Select options={d.vastgoedType === "Residentieel" ? OPTS.huurcontractType : OPTS.huurcontractTypeBedrijfsmatig} value={d.huurderContractType} onChange={set("huurderContractType")} />
          </Field>
          <Field label="Duurtijd"><TextInput value={d.huurderDuurtijd} onChange={set("huurderDuurtijd")} placeholder="bv. 9 jaar, start 01/2023" /></Field>
          {/* uitbreiding voor KMO-vastgoed/Bedrijfsvastgoed — kernbegrippen uit de Handelshuurwet
              (wet van 30 april 1951): minimumduur 9 jaar, driejaarlijkse opzegmogelijkheid voor de
              huurder, hernieuwingsrecht (tot 3x), en de gebruikelijke waarborg-/indexatieclausules.
              Residentieel/Woninghuur blijft ongewijzigd bij de zes velden hierboven. */}
          {d.vastgoedType !== "Residentieel" && (
            <>
              <Field label="Aanvangsdatum huurovereenkomst"><TextInput type="date" value={d.huurderAanvangsdatum} onChange={set("huurderAanvangsdatum")} /></Field>
              <Field label="Eerstvolgende opzegmogelijkheid" hint="Handelshuur: in principe elke 3 jaar, mits 6 maanden opzeg per aangetekend schrijven of deurwaardersexploot">
                <TextInput value={d.huurderEersteOpzegmogelijkheid} onChange={set("huurderEersteOpzegmogelijkheid")} placeholder="bv. 01/2027" />
              </Field>
              <Field label="Hernieuwingsrecht"><Select options={OPTS.huurderHernieuwingsrecht} value={d.huurderHernieuwingsrecht} onChange={set("huurderHernieuwingsrecht")} /></Field>
              <Field label="Indexatie"><TextInput value={d.huurderIndexatie} onChange={set("huurderIndexatie")} placeholder="bv. jaarlijks, gezondheidsindex" /></Field>
              <Field label="Huurwaarborg"><TextInput value={d.huurderWaarborg} onChange={set("huurderWaarborg")} placeholder="bv. 3 maanden huur, bankwaarborg" /></Field>
              <Field label="Bijzonderheden opzegtermijn / -beding" full hint="Afwijkende bedingen t.o.v. de standaard Handelshuurwet-regeling">
                <textarea value={d.huurderOpzegtermijnBijzonderheden} onChange={set("huurderOpzegtermijnBijzonderheden")} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
              </Field>
            </>
          )}
        </Section>
      )}

      <Section title="Juridische gegevens" icon={ClipboardList}>
        <Field label="Type verwervingsakte"><TextInput value={d.aankoopAkteType} onChange={set("aankoopAkteType")} placeholder="bv. akte van aankoop, schenking, erfenis" /></Field>
        <Field label="Datum verwervingsakte"><TextInput type="date" value={d.aankoopAkteDatum} onChange={set("aankoopAkteDatum")} /></Field>
        <Field label="Datum basisakte" hint="Bij mede-eigendom / appartementen"><TextInput type="date" value={d.basisAkteDatum} onChange={set("basisAkteDatum")} /></Field>
        <Field label="Erfdienstbaarheden"><TextInput value={d.erfdienstbaarheden} onChange={set("erfdienstbaarheden")} placeholder="wettelijk of conventioneel" /></Field>
        <Field label="Overige zakelijke rechten" full><TextInput value={d.zakelijkeRechten} onChange={set("zakelijkeRechten")} /></Field>
      </Section>

      <Section title="Stedenbouwkundige gegevens" icon={ClipboardList}>
        <Field label="Gewestplan hoofdbestemming"><Select options={OPTS.gewestplan} value={d.gewestplan} onChange={set("gewestplan")} /></Field>
        <Field label="Erfgoed"><Select options={OPTS.jaNee} value={d.erfgoed} onChange={set("erfgoed")} /></Field>
        <Field label="Voorkooprecht"><Select options={OPTS.jaNee} value={d.voorkooprecht} onChange={set("voorkooprecht")} /></Field>
        <Field label="Bouwmisdrijven"><Select options={OPTS.jaNee} value={d.bouwmisdrijven} onChange={set("bouwmisdrijven")} /></Field>
        <Field label="Vergunning"><Select options={OPTS.jaNee} value={d.vergunning} onChange={set("vergunning")} /></Field>
        <Field label="Verkaveling"><Select options={OPTS.jaNee} value={d.verkaveling} onChange={set("verkaveling")} /></Field>
        <Field label="Watertoets P-score"><Select options={OPTS.score} value={d.watertoetsP} onChange={set("watertoetsP")} /></Field>
        <Field label="Watertoets G-score"><Select options={OPTS.score} value={d.watertoetsG} onChange={set("watertoetsG")} /></Field>
        <Field label="Mobiscore (0-10)"><TextInput type="number" value={d.mobiscore} onChange={set("mobiscore")} /></Field>
      </Section>
    </div>
  );
}
