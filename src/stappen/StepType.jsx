// ----------------------------------------------------------------------------
// stappen/StepType.jsx — wizardtabblad "Type, staat & kadaster"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React, { useState, useEffect } from "react";
import { Building2, MapPin, AlertTriangle, Loader2 } from "lucide-react";
import { INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, ACCENT, ACCENT_SOFT, DANGER, OPTS, SANS } from "../constants.js";
import { unit } from "../lib/format.js";
import { GOOGLE_MAPS_API_KEY, buildStaticMapUrl, fetchCadgisPerceel, CadgisKaart } from "../kaarten.jsx";
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

  // Adres, CaPaKey en beide kaarten horen bij één welbepaald pand, niet bij het dossier: een
  // dossier kan meerdere eigendommen bevatten (zie extraPanden/maakLeegPand), en het verslag toont
  // per pand zijn eigen adres, CaPaKey en kadasterkaart. Voorheen stond dit blok op het tabblad
  // "Opdracht & partijen" — dat werkt uitsluitend op het dossier zelf, waardoor een extra pand nooit
  // een eigen adres of perceel kon krijgen. Hier werkt het op het ACTIEVE pand (zie bindPand in
  // DossierWizard); voor het hoofdpand is dat het dossier zelf, dus daar verandert er niets aan de
  // gegevens — enkel aan het tabblad waar je ze invult.
  const [mapError, setMapError] = useState(false);
  const [cadgisLoading, setCadgisLoading] = useState(false);
  const [cadgisError, setCadgisError] = useState(false);
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}, België`;
  const adresVolledig = d.straat && d.gemeente;
  const mapSrc = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;
  const staticMapUrl = buildStaticMapUrl(adres);

  // zoekt automatisch de perceelsgeometrie (bbox + de buitenrand van het perceel zelf, voor de
  // markering) op zodra een CaPaKey is ingevuld of gewijzigd — het resultaat wordt bij het pand
  // bewaard (zie cadgisBbox/cadgisRingen) zodat het verslag zelf nadien geen live opzoeking meer
  // hoeft te doen.
  useEffect(() => {
    const key = (d.capakey || "").trim();
    if (!key) { setCadgisError(false); return; }
    // migratiegeval: een dossier dat zijn bbox al opzocht vóór de perceelsmarkering bestond, heeft
    // wel een cadgisCapakeyOpgezocht die al overeenkomt én een cadgisBbox, maar nog geen
    // cadgisRingen — dat moet hier alsnog (eenmalig) opnieuw opgezocht worden. Een capakey die
    // eerder gewoon niet gevonden werd (geen bbox, geen ringen) mag daarentegen niet bij elke
    // render opnieuw geprobeerd worden — vandaar de onderscheiden check hieronder i.p.v. gewoon op
    // "geen ringen" te controleren.
    const migratiegeval = d.cadgisBbox && !d.cadgisRingen?.length;
    if (key === d.cadgisCapakeyOpgezocht && !migratiegeval) return;
    let cancelled = false;
    setCadgisLoading(true); setCadgisError(false);
    fetchCadgisPerceel(key).then((perceel) => {
      if (cancelled) return;
      if (perceel) { set("cadgisBbox")(perceel.bbox); set("cadgisRingen")(perceel.ringen); set("cadgisCapakeyOpgezocht")(key); }
      else { setCadgisError(true); set("cadgisCapakeyOpgezocht")(key); }
    }).catch(() => { if (!cancelled) { setCadgisError(true); set("cadgisCapakeyOpgezocht")(key); } })
      .finally(() => { if (!cancelled) setCadgisLoading(false); });
    return () => { cancelled = true; };
    // d.pandId hoort bij de afhankelijkheden: wissel je van pand terwijl beide dezelfde (of een
    // lege) CaPaKey hebben, dan moet deze opzoeking opnieuw beoordeeld worden voor het nieuwe pand
    // i.p.v. op het resultaat van het vorige te blijven staan.
  }, [d.capakey, d.pandId]);

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
      <Section title="Adres van dit pand" icon={MapPin}>
        <Field label="Straat"><TextInput value={d.straat} onChange={set("straat")} /></Field>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field label="Nummer"><TextInput value={d.nummer} onChange={set("nummer")} /></Field>
          <Field label="Bus"><TextInput value={d.bus} onChange={set("bus")} /></Field>
        </div>
        <Field label="Postcode"><TextInput value={d.postcode} onChange={set("postcode")} /></Field>
        <Field label="Gemeente"><TextInput value={d.gemeente} onChange={set("gemeente")} /></Field>
        <Field label="Dorp / gehucht"><TextInput value={d.dorpGehucht} onChange={set("dorpGehucht")} /></Field>
        <Field label="CRAB-gegevens"><TextInput value={d.crabGegevens} onChange={set("crabGegevens")} /></Field>
      </Section>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={15} style={{ color: ACCENT }} />
          <h3 style={{ fontFamily: SANS, fontSize: 16, color: INK, fontWeight: 500 }}>Kadastrale identificatie</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
          <Field label="CaPaKey" full hint="Manueel op te zoeken via geopunt.be of cadgis.be"><TextInput value={d.capakey} onChange={set("capakey")} /></Field>
        </div>
        {adresVolledig && !GOOGLE_MAPS_API_KEY && (
          <div className="rounded-lg p-4 text-xs flex items-center gap-2" style={{ border: `1px solid ${LINE}`, background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={14} /> Geen Google Maps API-sleutel ingesteld (VITE_GOOGLE_MAPS_API_KEY) — de kaart kan hierdoor niet getoond worden, ook niet in het verslag.
          </div>
        )}
        {adresVolledig && GOOGLE_MAPS_API_KEY && !mapError && (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <img src={staticMapUrl} alt={`Kaart van ${adres}`} style={{ width: "100%", display: "block" }}
              onError={() => setMapError(true)} />
            <div className="px-3 py-2 text-xs flex justify-between items-center" style={{ borderTop: `1px solid ${LINE}`, color: INK_SOFT }}>
              <span>{d.straat} {d.nummer}{d.bus ? "/" + d.bus : ""}, {d.postcode} {d.gemeente}</span>
              <a href={mapSrc} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: "none", fontWeight: 500 }}>Open in Google Maps</a>
            </div>
          </div>
        )}
        {adresVolledig && GOOGLE_MAPS_API_KEY && mapError && (
          <div className="rounded-lg p-5 flex items-center justify-between" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: ACCENT_SOFT }}>
                <MapPin size={17} style={{ color: ACCENT }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: INK }}>{d.straat} {d.nummer}{d.bus ? "/" + d.bus : ""}</div>
                <div style={{ fontSize: 12, color: INK_SOFT }}>{d.postcode} {d.gemeente}</div>
              </div>
            </div>
            <a href={mapSrc} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: INK, color: PAPER, textDecoration: "none" }}>
              <MapPin size={13} /> Open kaart
            </a>
          </div>
        )}
        {!adresVolledig && (
          <div className="text-xs italic p-4 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            Vul straat en gemeente in om de kaart te tonen.
          </div>
        )}

        <div className="text-xs mt-4 mb-2" style={{ color: INK_SOFT, fontWeight: 500 }}>Kadasterkaart (CadGIS)</div>
        {!d.capakey && (
          <div className="text-xs italic p-4 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            Vul de CaPaKey hierboven in om de kadasterkaart te tonen.
          </div>
        )}
        {d.capakey && cadgisLoading && (
          <div className="rounded-lg p-4 text-xs flex items-center gap-2" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <Loader2 size={14} className="animate-spin" /> Perceel opzoeken...
          </div>
        )}
        {d.capakey && !cadgisLoading && cadgisError && (
          <div className="rounded-lg p-4 text-xs flex items-center justify-between gap-2" style={{ border: `1px solid ${LINE}`, background: "#FBEAEA", color: DANGER }}>
            <span className="flex items-center gap-2"><AlertTriangle size={14} /> Geen perceel gevonden voor deze CaPaKey — controleer de schrijfwijze (bv. "46020B0127/00Z000").</span>
            <button type="button" onClick={() => set("cadgisCapakeyOpgezocht")("")}
              className="text-xs px-2 py-1 rounded flex-shrink-0" style={{ border: `1px solid ${DANGER}`, color: DANGER, background: "transparent" }}>
              Opnieuw proberen
            </button>
          </div>
        )}
        {d.capakey && !cadgisLoading && !cadgisError && d.cadgisBbox && (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <CadgisKaart bbox={d.cadgisBbox} ringen={d.cadgisRingen} />
            <div className="px-3 py-2 text-xs flex justify-between items-center" style={{ borderTop: `1px solid ${LINE}`, color: INK_SOFT }}>
              <span>CaPaKey {d.capakey}</span>
              <span>Bron: CadGIS Vlaanderen (Informatie Vlaanderen)</span>
            </div>
          </div>
        )}
      </div>
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
