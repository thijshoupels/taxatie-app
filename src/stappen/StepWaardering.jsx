// ----------------------------------------------------------------------------
// stappen/StepWaardering.jsx — wizardtabblad "Waardering"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React from "react";
import { Calculator, Grid3x3, Trash2, Plus, Check, AlertTriangle } from "lucide-react";
import {
  OPTS, KLASSEN, ABEX_INDEX_1998, GEVEL_FACTOR, STAMP, STAMP_SOFT, BRASS, BRASS_SOFT,
  INK_SOFT, LINE, DANGER, PAPER_RAISED,
} from "../constants.js";
import { num, eur, pct, epcRichtwaardePct } from "../lib/format.js";
import { berekenParkeerplaatsenTotaal } from "../domein/waardering.js";
import { Section, Field, TextInput, Select, Checkbox, Slider, Row, inputStyle } from "../ui/velden.jsx";

// ---------- waardering ----------
// Slider verhuisde naar src/ui/velden.jsx (opsplitsing stap 7).

// Types voor de parkeerplaatsen/garages-lijst (StepWaardering hieronder) — een vaste lijst i.p.v.
// vrije tekst, consistent met de rest van de app, maar met "Andere" als vangnet.
const PARKEER_TYPES = ["Autostaanplaats (buiten)", "Autostaanplaats (ondergronds/binnen)", "Garage (afgesloten box)", "Carport", "Fietsenberging", "Andere"];

// Klassieke Abex-tabel (Klasse/1998/2-3-4-gevel) — hergebruikt voor zowel de woningen-tabel als de
// klassieke-Abex-tabel bij appartementen (zie StepWaardering hieronder), die nu telkens apart
// getoond worden i.p.v. samengevoegd in één tabel.
function AbexTabel({ rows, d, set }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "rgba(0,0,0,0.02)" }}>
            <th className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>Klasse</th>
            <th className="text-right px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>1998</th>
            {[2, 3, 4].map((g) => (
              <th key={g} className="text-right px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>{g}-gevel</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((k) => (
            <tr key={k.key} style={{ borderBottom: `1px solid ${LINE}` }}>
              <td className="px-3 py-1.5" style={{ color: INK_SOFT }}>{k.label}</td>
              <td className="px-3 py-1.5 text-right font-mono" style={{ color: INK_SOFT }}>{k.basis1998.toFixed(2)}</td>
              {[2, 3, 4].map((g) => {
                const val = (k.basis1998 * GEVEL_FACTOR[g]) / ABEX_INDEX_1998 * num(d.abexIndexHuidig);
                const active = k.label === d.klasse && String(g) === d.gevel.charAt(0);
                return (
                  <td key={g} className="px-3 py-1.5 text-right font-mono"
                    onClick={() => { set("klasse")(k.label); set("gevel")(`${g}-gevel`); }}
                    style={{ color: active ? STAMP : INK_SOFT, background: active ? STAMP_SOFT : "transparent", fontWeight: active ? 500 : 400, cursor: "pointer" }}
                    title="Klik om deze Abex-waarde te gebruiken">
                    {val.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StepWaardering({ d, set, calc, parkeerplaatsenGarages, addParkeerplaats, removeParkeerplaats, updateParkeerplaats, portefeuille }) {
  // de ABEX-woningindex/vetusiteitscalculator hieronder is opgemaakt voor residentieel vastgoed
  // (de KLASSEN-tabel = woning-/appartementstypes) — bij KMO-vastgoed/Bedrijfsvastgoed wordt de
  // vervangingswaarde in de plaats daarvan manueel ingeschat op het tabblad "Bedrijfskenmerken"
  // (zie berekenWaardering), dus tonen we hier enkel een doorverwijzing i.p.v. een niet-relevante
  // rekentool.
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed" && d.vastgoedType !== "Garage / Staanplaats";
  const isGarageStaanplaats = d.vastgoedType === "Garage / Staanplaats";
  // voor de klasse-mix hieronder: de "tweede klasse" moet binnen dezelfde groep (Woningen/
  // Appartementen) blijven als de eerste — een woning mengen met een appartementsklasse levert
  // geen zinvolle tussenwaarde op. Valt d.klasse (nog) niet op een KLASSEN-rij (nieuw dossier vóór
  // enige keuze), dan valt dit terug op "Woningen" als standaardgroep.
  const klasseObj1 = KLASSEN.find((k) => k.label === d.klasse);
  const klasseGroep = klasseObj1 ? klasseObj1.type : "Woningen";
  // een klasse uit de nieuwbouwprijzen-tabel (appartementen) mag enkel gemengd worden met een
  // andere klasse uit diezelfde tabel, nooit met een klassieke Abex-klasse (andere grootorde/
  // rekenwijze, zie berekenWaardering) — vandaar dit tweede filtercriterium naast klasseGroep.
  const klasseObj1IsNieuwbouwtabel = klasseObj1 ? typeof klasseObj1.waardePerM2Nieuwbouw === "number" : false;
  return (
    <div>
      {isGarageStaanplaats ? (
        <Section title="Waarde garage/staanplaats" icon={Calculator}>
          <div className="col-span-2 text-xs mb-2" style={{ color: INK_SOFT }}>
            De ABEX-woningindex en de bedrijfsmatige vervangingswaarde zijn niet van toepassing op een
            garage/staanplaats. Kies hieronder de methode die het best bij dit dossier past.
          </div>
          <Field label="Waarderingsmethode" full hint="Zelf te kiezen, per dossier verschillend">
            <Select options={OPTS.garageWaarderingsMethode} value={d.garageWaarderingsMethode} onChange={set("garageWaarderingsMethode")} />
          </Field>
          {calc.garageMethodeM2 ? (
            <>
              <Field label="Prijs per m² (€)">
                <TextInput type="number" value={d.garagePrijsPerM2} onChange={set("garagePrijsPerM2")} style={{ color: BRASS }} />
              </Field>
              <Field label="Oppervlakte" hint="Uit de tabel 'Oppervlakte per bouweenheid' op het tabblad Afmetingen">
                <div className="font-mono text-sm py-2" style={{ color: INK_SOFT }}>{calc.totOppNaCoeff.toFixed(1)} m²</div>
              </Field>
            </>
          ) : (
            <>
              <Field label="Aantal">
                <TextInput type="number" min="1" value={d.garageAantal} onChange={set("garageAantal")} style={{ color: BRASS }} />
              </Field>
              <Field label="Prijs per stuk (€)">
                <TextInput type="number" value={d.garagePrijsPerStuk} onChange={set("garagePrijsPerStuk")} style={{ color: BRASS }} />
              </Field>
            </>
          )}
          <Field label="Waarde garage/staanplaats (berekend)" full>
            <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.garageWaarde)}</div>
          </Field>
        </Section>
      ) : isResidentieel ? (
        <>
          <Section title="Vervangingswaarde (Abex)" icon={Calculator}>
            <Field label="Abex-index vandaag" hint="Periodiek te updaten">
              <TextInput type="number" value={d.abexIndexHuidig} onChange={set("abexIndexHuidig")} style={{ color: BRASS }} />
            </Field>
            <Field label={klasseObj1IsNieuwbouwtabel ? "Prijs / m² (geselecteerd)" : "Abex-waarde / m² (geselecteerd)"}
              hint="Klik een cel in de tabel hieronder, combineer met een tweede klasse, of vul rechts een eigen waarde in">
              <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.abexPerM2)} / m²</div>
            </Field>
            <Field label={klasseObj1IsNieuwbouwtabel ? "Eigen prijs / m² (optioneel)" : "Eigen Abex-waarde / m² (optioneel)"}
              hint="Overschrijft de tabel/mix hieronder volledig — vetusiteit blijft wel verrekend">
              <TextInput type="number" value={d.abexPerM2Override} onChange={set("abexPerM2Override")} placeholder="Leeg = uit de tabel/mix hieronder" style={{ color: BRASS }} />
            </Field>
          </Section>

          {/* Referentietabel(len): woningen en appartementen tonen elkaars tabel niet — een woning
              heeft niets aan de appartementen-tabellen en omgekeerd. Bij een appartement staan de
              nieuwbouwprijzen (geen gevel-uitsplitsing, zie berekenWaardering: gevelfactor = 1 voor
              die klassen) en de klassieke Abex-tabel bewust in twee aparte tabellen naast elkaar,
              i.p.v. samengevoegd — dat maakt duidelijker dat het om twee verschillende, niet onderling
              te vergelijken rekenwijzen gaat. */}
          {d.pandType !== "Appartement" ? (
            <div className="col-span-2 mb-8">
              <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
                Abex-referentietabel — klik een cel om die waarde te gebruiken (herberekend op basis van Abex-index {d.abexIndexHuidig})
              </div>
              <AbexTabel rows={KLASSEN.filter((k) => k.type === "Woningen")} d={d} set={set} />
            </div>
          ) : (
            <div className="col-span-2 mb-8">
              <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
                Nieuwbouwprijzen — klik een cel om die waarde te gebruiken. Dit zijn al actuele prijzen per m² (herrekend uit reële verkooppublicaties); een gevel-uitsplitsing is hier niet van toepassing.
              </div>
              <div className="rounded-lg overflow-hidden mb-6" style={{ border: `1px solid ${LINE}` }}>
                <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                      <th className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>Klasse</th>
                      <th className="text-right px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>€ / m²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KLASSEN.filter((k) => k.type === "Appartementen" && typeof k.waardePerM2Nieuwbouw === "number").map((k) => {
                      const active = k.label === d.klasse;
                      return (
                        <tr key={k.key} style={{ borderBottom: `1px solid ${LINE}` }}>
                          <td className="px-3 py-1.5" style={{ color: INK_SOFT }}>{k.label}</td>
                          <td className="px-3 py-1.5 text-right font-mono"
                            onClick={() => set("klasse")(k.label)}
                            style={{ color: active ? STAMP : INK_SOFT, background: active ? STAMP_SOFT : "transparent", fontWeight: active ? 500 : 400, cursor: "pointer" }}
                            title="Klik om deze prijs te gebruiken">
                            {k.waardePerM2Nieuwbouw.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
                Klassieke Abex-tabel — klik een cel om die waarde te gebruiken (herberekend op basis van Abex-index {d.abexIndexHuidig})
              </div>
              <AbexTabel rows={KLASSEN.filter((k) => k.type === "Appartementen" && typeof k.waardePerM2Nieuwbouw !== "number")} d={d} set={set} />
            </div>
          )}

          <div className="col-span-2 mb-8">
            <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
              Valt de afwerking van dit pand tussen twee klassen in? Combineer de geselecteerde klasse hierboven met een tweede klasse uit dezelfde groep ({klasseGroep}) — de twee basiswaarden worden dan naar verhouding gemengd i.p.v. dat je verplicht één van de twee moet kiezen.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Tweede klasse (optioneel)" hint="Leeg = geen mix, enkel de geselecteerde klasse hierboven telt">
                <select value={d.klasse2} onChange={(e) => set("klasse2")(e.target.value)} style={inputStyle}>
                  <option value="">— geen (enkel de klasse hierboven) —</option>
                  {KLASSEN.filter((k) => k.type === klasseGroep && k.label !== d.klasse
                    && (typeof k.waardePerM2Nieuwbouw === "number") === klasseObj1IsNieuwbouwtabel).map((k) => (
                    <option key={k.key} value={k.label}>{k.label}</option>
                  ))}
                </select>
              </Field>
              {d.klasse2 && (
                <Field label="Mengverhouding" hint={`${100 - (num(d.klasseMixPct) || 0)}% "${d.klasse}" / ${num(d.klasseMixPct) || 0}% "${d.klasse2}"`}>
                  <Slider label={`Gewicht "${d.klasse2}"`} value={d.klasseMixPct} onChange={set("klasseMixPct")} />
                </Field>
              )}
            </div>
          </div>

          <Section title="Vetusiteit" icon={Calculator}>
            <div className="col-span-2 grid grid-cols-2 gap-5">
              <Slider label="Ouderdom" value={d.vetOuderdom} onChange={set("vetOuderdom")} />
              <Slider label="Frequentie van onderhoud" value={d.vetFrequentie} onChange={set("vetFrequentie")} />
              <Slider label="Gebruik" value={d.vetGebruik} onChange={set("vetGebruik")} />
              <Slider label="Kwaliteit van onderhoud" value={d.vetKwaliteit} onChange={set("vetKwaliteit")} />
            </div>
            <div className="col-span-2 text-sm mt-1" style={{ color: STAMP }}>
              Gemiddelde vetusiteit: <span className="font-mono font-medium">{pct(calc.gemVetusiteit)}</span>
            </div>
          </Section>
        </>
      ) : (
        <Section title="Vervangingswaarde (bedrijfsmatig)" icon={Calculator}>
          <div className="col-span-2 text-xs mb-2" style={{ color: INK_SOFT }}>
            De ABEX-woningindex is niet van toepassing op KMO-vastgoed/Bedrijfsvastgoed. Vul de reeds-afgeschreven vervangingswaarde manueel in op het tabblad "Bedrijfskenmerken" — die waarde wordt hieronder in de waardering gebruikt.
          </div>
          <Field label="Vervangingswaarde (ingevuld op 'Bedrijfskenmerken')">
            <div className="font-mono text-sm py-2" style={{ color: d.bedrijfsVervangingswaarde ? STAMP : DANGER, fontWeight: 500 }}>
              {d.bedrijfsVervangingswaarde ? eur(num(d.bedrijfsVervangingswaarde)) : "Nog niet ingevuld"}
            </div>
          </Field>
        </Section>
      )}

      <Section title="Rendementsbenadering (DCF)" icon={Calculator}>
        <Field label="Maandelijkse huurprijs (€)"><TextInput type="number" value={d.huurMaand} onChange={set("huurMaand")} style={{ color: BRASS }} /></Field>
        <Field label="Yield van (%)"><TextInput type="number" step="0.05" value={d.yieldVan} onChange={set("yieldVan")} style={{ color: BRASS }} /></Field>
        <Field label="Yield tot (%)"><TextInput type="number" step="0.05" value={d.yieldTot} onChange={set("yieldTot")} style={{ color: BRASS }} /></Field>
        <Field label="Yield stap (%)"><TextInput type="number" step="0.05" min="0.05" value={d.yieldStap} onChange={set("yieldStap")} style={{ color: BRASS }} /></Field>
        <Field label="Jaarhuur (10 maanden, berekend)"><div className="font-mono text-sm py-2" style={{ color: INK_SOFT }}>{eur(calc.jaarhuur)}</div></Field>
      </Section>

      <Section title="Transactiekosten bij DCF (optioneel)" icon={Calculator}>
        <div className="col-span-2">
          <Checkbox label="Minwaarde voor transactiekosten toepassen op de DCF-waarde hierboven"
            checked={d.dcfTransactiekostenActief} onChange={set("dcfTransactiekostenActief")} />
          <div className="text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.85 }}>
            Optionele extra, staat standaard uit. Richtwaarde: 12%-14% registratierechten, notariskosten, hypotheekkosten — zelf te bepalen. Verrekend als minwaarde op de DCF-waarde hierboven — telt, samen met een eventuele meerjaren-DCF, mee in de voorgestelde venale waarde bij "Eindconclusie" hieronder.
          </div>
        </div>
        {d.dcfTransactiekostenActief && (
          <>
            <Field label="Transactiekosten (%)" hint="Richtwaarde: 12%-14% registratierechten, notariskosten, hypotheekkosten">
              <TextInput type="number" step="0.5" value={d.dcfTransactiekostenPct} onChange={set("dcfTransactiekostenPct")} style={{ color: BRASS }} />
            </Field>
            <Field label="Transactiekosten (bedrag, berekend)">
              <div className="font-mono text-sm py-2" style={{ color: DANGER, fontWeight: 500 }}>
                {calc.dcfTransactiekostenBedrag ? `-${eur(calc.dcfTransactiekostenBedrag)}` : eur(0)}
              </div>
            </Field>
            <Field label="DCF-waarde na transactiekosten (berekend)">
              <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.dcfWaardeNaTransactiekosten)}</div>
            </Field>
            <Field label="Motivering / toelichting" full>
              <textarea value={d.dcfTransactiekostenMotivering} onChange={set("dcfTransactiekostenMotivering")} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Meerjaren-DCF (optioneel)" icon={Calculator}>
        <div className="col-span-2">
          <Checkbox label="Meerjaren-DCF berekenen — naast (niet in plaats van) de directe kapitalisatie hierboven"
            checked={d.dcfMeerjarenActief} onChange={set("dcfMeerjarenActief")} />
          <div className="text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.85 }}>
            Optionele extra, staat standaard uit. Rekent met een reeks jaarlijkse huurinkomsten (met groei en eventuele leegstand) verdisconteerd tegen een zelf te kiezen discontovoet, plus een eindwaarde na het laatste jaar — rigoureuzer dan de directe kapitalisatie bij een pand met een reëel verhuurluik. Telt, samen met de rendementsbenadering hierboven, mee in de voorgestelde venale waarde bij "Eindconclusie" hieronder.
          </div>
        </div>
        {d.dcfMeerjarenActief && (
          <>
            <Field label="Aantal jaren"><TextInput type="number" value={d.dcfJaren} onChange={set("dcfJaren")} style={{ color: BRASS }} /></Field>
            <Field label="Jaarlijkse huurgroei (%)"><TextInput type="number" step="0.5" value={d.dcfHuurgroeiPct} onChange={set("dcfHuurgroeiPct")} style={{ color: BRASS }} /></Field>
            <Field label="Leegstand (%)"><TextInput type="number" step="0.5" value={d.dcfLeegstandPct} onChange={set("dcfLeegstandPct")} style={{ color: BRASS }} /></Field>
            <Field label="Discontovoet (%)"><TextInput type="number" step="0.5" value={d.dcfDiscontovoetPct} onChange={set("dcfDiscontovoetPct")} style={{ color: BRASS }} /></Field>
            <Field label="Exit-yield bij eindwaarde (%)" hint="Leeg = gemiddelde van yield van/tot hierboven">
              <TextInput type="number" step="0.05" value={d.dcfExitYieldPct} onChange={set("dcfExitYieldPct")} placeholder={calc.dcfExitYieldPct ? calc.dcfExitYieldPct.toFixed(2) : ""} style={{ color: BRASS }} />
            </Field>
            <Field label="Meerjaren-DCF-waarde (berekend)">
              <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{calc.dcfMeerjarenWaarde ? eur(calc.dcfMeerjarenWaarde) : "n.v.t."}</div>
            </Field>
            <Field label="Motivering / toelichting" full>
              <textarea value={d.dcfMotivering} onChange={set("dcfMotivering")} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Marktwaardebandbreedte" icon={Calculator}>
        <Field label="Ondergrens t.o.v. intrinsieke waarde (%)" hint="Standaard 5% — naar wens aan te passen">
          <TextInput type="number" step="0.5" value={d.marktMargeOnderPct} onChange={set("marktMargeOnderPct")} style={{ color: BRASS }} />
        </Field>
        <Field label="Bovengrens t.o.v. intrinsieke waarde (%)" hint="Standaard 5% — naar wens aan te passen">
          <TextInput type="number" step="0.5" value={d.marktMargeBovenPct} onChange={set("marktMargeBovenPct")} style={{ color: BRASS }} />
        </Field>
      </Section>

      <Section title="Gedwongen verkoop" icon={Calculator}>
        <Field label="Gedwongen-verkoopfactor" hint="Toegepast op de venale waarde, los van de rendementsbenadering (DCF)">
          <TextInput type="number" step="0.01" value={d.gedwongenFactor} onChange={set("gedwongenFactor")} style={{ color: BRASS }} />
        </Field>
      </Section>

      <Section title="Energiecorrectie (optioneel)" icon={Calculator}>
        <div className="col-span-2">
          <Checkbox label="Energiecorrectie toepassen op de waardering"
            checked={d.energiecorrectieActief} onChange={set("energiecorrectieActief")} />
          <div className="text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.85 }}>
            Optionele extra, staat standaard uit. Bepaalt u hier een percentage, dan telt dat mee in de VOORGESTELDE venale waarde bij "Eindconclusie" hieronder — dat veld blijft evenwel altijd manueel overschrijfbaar, dus u houdt zelf het laatste woord.{d.epcStatus === "Aanwezig" && d.epcWaarde ? ` Ter info, louter indicatief: EPC ${d.epcWaarde} kWh/m² → richtwaarde ${pct(epcRichtwaardePct(d.epcWaarde))}.` : ""}
          </div>
        </div>
        {d.energiecorrectieActief && (
          <>
            <Field label="Correctie (%)" hint="Negatief bij een ongunstig energielabel, positief bij een gunstig label — zelf te bepalen">
              <TextInput type="number" step="0.5" value={d.energiecorrectiePct} onChange={set("energiecorrectiePct")} style={{ color: BRASS }} />
            </Field>
            <Field label="Correctiebedrag (berekend)">
              <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.energiecorrectieBedrag)}</div>
            </Field>
            <Field label="Motivering / toelichting" full>
              <textarea value={d.energiecorrectieMotivering} onChange={set("energiecorrectieMotivering")} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Eindconclusie" icon={Calculator}>
        <Field label="Venale waarde" full hint={
          calc.dcfSamengesteld > 0
            ? `Standaard voorgesteld als gemiddelde van de intrinsieke waarde${calc.energiecorrectieBedrag ? " + energiecorrectie" : ""} (${eur(calc.intrinsiek + calc.energiecorrectieBedrag)}) en de samengestelde DCF-waarde (${eur(calc.dcfSamengesteld)}) — manueel te overschrijven`
            : `Standaard voorgesteld gelijk aan de intrinsieke waarde${calc.energiecorrectieBedrag ? " + energiecorrectie" : ""} — manueel te overschrijven`
        }>
          <TextInput type="number" value={d.venaleWaarde} onChange={set("venaleWaarde")} placeholder={calc.voorgesteldeVenaleWaarde.toFixed(0)} style={{ color: BRASS, fontWeight: 500 }} />
        </Field>
      </Section>

      {/* Parkeerplaatsen & garages: dossierbreed (niet per pand, zie initialData.parkeerplaatsenGarages)
          — elk item telt afzonderlijk mee bovenop de venale waarde(n) hierboven, zie
          berekenParkeerplaatsenTotaal en het "Totale venale waarde"-veld in het rapport zelf. */}
      {parkeerplaatsenGarages && (
        <Section title="Parkeerplaatsen & garages" icon={Grid3x3}>
          <div className="col-span-2">
            <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
              Apart te verkopen/verhuren parkeerplaatsen, garages of bergingen die bij deze opdracht horen — bv. een garagebox met een eigen kadastraal perceel. Geldt voor het hele dossier (niet per pand hierboven).
            </p>
            {parkeerplaatsenGarages.length > 0 && (
              <div className="rounded-lg overflow-hidden mb-3" style={{ border: `1px solid ${LINE}` }}>
                <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                      {["Type", "Aantal", "Waarde/stuk", "Omschrijving (optioneel)", "Subtotaal", ""].map((h) => (
                        <th key={h} className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parkeerplaatsenGarages.map((p) => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                        <td className="px-2 py-1.5" style={{ width: 220 }}>
                          <select value={p.type} onChange={(e) => updateParkeerplaats(p.id, "type", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }}>
                            {PARKEER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5" style={{ width: 80 }}>
                          <input type="number" min="1" value={p.aantal} onChange={(e) => updateParkeerplaats(p.id, "aantal", e.target.value)}
                            style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                        </td>
                        <td className="px-2 py-1.5" style={{ width: 130 }}>
                          <input type="number" placeholder="€" value={p.waardePerStuk} onChange={(e) => updateParkeerplaats(p.id, "waardePerStuk", e.target.value)}
                            style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={p.omschrijving} onChange={(e) => updateParkeerplaats(p.id, "omschrijving", e.target.value)}
                            style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                        </td>
                        <td className="px-3 py-1.5 font-mono" style={{ fontSize: 13, color: INK_SOFT, whiteSpace: "nowrap" }}>{eur(num(p.aantal) * num(p.waardePerStuk))}</td>
                        <td className="px-2 py-1.5"><button onClick={() => removeParkeerplaats(p.id)}><Trash2 size={14} style={{ color: DANGER }} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button onClick={addParkeerplaats} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${LINE}`, color: INK_SOFT, fontWeight: 500 }}>
              <Plus size={13} /> Parkeerplaats/garage toevoegen
            </button>
            {parkeerplaatsenGarages.length > 0 && (
              <div className="mt-3 flex justify-between items-center px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.02)" }}>
                <span className="text-xs" style={{ color: INK_SOFT }}>Subtotaal parkeerplaatsen/garages</span>
                <span className="font-mono text-sm" style={{ fontWeight: 500 }}>{eur(berekenParkeerplaatsenTotaal(parkeerplaatsenGarages))}</span>
              </div>
            )}
          </div>
        </Section>
      )}

      <div className="mt-8 rounded-lg p-6" style={{ background: PAPER_RAISED, border: `1px solid ${LINE}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 500 }}>Waarderingsoverzicht</span>
          {calc.oppCheck
            ? <span className="flex items-center gap-1 text-xs" style={{ color: STAMP }}><Check size={13} /> gegevens volledig</span>
            : <span className="flex items-center gap-1 text-xs" style={{ color: DANGER }} title={(calc.controlePunten || []).join(" · ")}>
                <AlertTriangle size={13} /> {(calc.controlePunten || []).length === 1 ? (calc.controlePunten || [])[0] : `${(calc.controlePunten || []).length} punten onvolledig`}
              </span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 font-mono text-sm">
          {isGarageStaanplaats ? (
            // bij een garage/staanplaats zijn "Nieuwbouwwaarde"/"Actuele waarde" hetzelfde bedrag
            // (geen vetusiteit-afschrijving in die berekening, zie berekenWaardering) — één rij
            // i.p.v. twee identieke rijen is dan duidelijker.
            <Row label="Waarde garage/staanplaats" v={eur(calc.garageWaarde)} />
          ) : (
            <>
              <Row label="Nieuwbouwwaarde gebouw" v={eur(calc.nieuwbouwwaarde)} />
              <Row label="Actuele waarde gebouw" v={eur(calc.actueleWaardeGebouw)} />
            </>
          )}
          {d.pandType === "Appartement" && calc.effectiefGrondaandeel > 0 && (
            <Row label="Effectief grondaandeel" v={`${calc.effectiefGrondaandeel.toFixed(2)} m²`} />
          )}
          <Row label={
            calc.grondwaardeMeetellen === false
              ? "Grondwaarde (niet meegeteld — zie nieuwbouwprijzen-tabel)"
              : (d.grondAandeelGemeenschapActief ? "Grondwaarde (incl. aandeel gemeenschap +12%)" : "Grondwaarde")
          } v={eur(calc.grondwaarde)} />
          <Row label="Intrinsieke waarde" v={eur(calc.intrinsiek)} />
          <Row label={`Marktwaarde -${pct(calc.marktMargeOnderPct)}`} v={eur(calc.marktOnder)} />
          <Row label={`Marktwaarde +${pct(calc.marktMargeBovenPct)}`} v={eur(calc.marktBoven)} />
          <Row label="DCF-waarde" v={calc.dcfWaarde ? eur(calc.dcfWaarde) : "n.v.t."} />
          {d.dcfTransactiekostenActief && calc.dcfWaarde > 0 && (
            <Row label="DCF-waarde na transactiekosten (optioneel)" v={eur(calc.dcfWaardeNaTransactiekosten)} />
          )}
          {d.dcfMeerjarenActief && (
            <Row label="Meerjaren-DCF (optioneel)" v={calc.dcfMeerjarenWaarde ? eur(calc.dcfMeerjarenWaarde) : "n.v.t."} />
          )}
          {d.residueelActief && (
            <Row label="Residuele grondwaarde (optioneel)" v={eur(calc.residueleGrondwaarde)} />
          )}
          {calc.parkeerTotaal > 0 && (
            <Row label="Parkeerplaatsen/garages" v={eur(calc.parkeerTotaal)} />
          )}
          <Row label="Gedwongen verkoopwaarde" v={eur(calc.gedwongenVerkoop)} />
          {d.energiecorrectieActief && calc.energiecorrectiePct !== 0 && (
            <Row label={`Energiecorrectie (${pct(calc.energiecorrectiePct)})`} v={eur(calc.energiecorrectieBedrag)} />
          )}
        </div>
        <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: `1px dashed ${LINE}` }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 14, color: STAMP, fontWeight: 500 }}>Venale waarde</span>
          <span className="font-mono" style={{ fontSize: 22, color: STAMP, fontWeight: 500 }}>{eur(calc.venaleWaarde)}</span>
        </div>
      </div>

      {/* Portefeuille-overzicht: enkel zichtbaar zodra dit dossier meer dan één pand bevat (zie
          extraPanden/StepPanden) — het bovenstaande "Waarderingsoverzicht" blijft altijd tonen wat
          het ACTIEVE pand alleen waard is; dit kader eronder telt alle panden (+ eventuele
          parkeerplaatsen/garages hierboven) samen, exact zoals dat straks ook in het
          samengevoegde rapport verschijnt (zie buildMultiPandReportData). */}
      {portefeuille && (
        <div className="mt-6 rounded-lg p-6" style={{ background: "#F3F0E4", border: `1px solid ${BRASS}` }}>
          <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 500 }}>Portefeuille-overzicht — alle panden</span>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {portefeuille.panden.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span style={{ color: INK_SOFT }}>{i === 0 ? "Hoofdpand" : `Pand ${i + 1}`} — {p.label}</span>
                <span className="font-mono">{eur(p.calc.venaleWaarde || 0)}</span>
              </div>
            ))}
            {portefeuille.parkeerTotaal > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: INK_SOFT }}>Parkeerplaatsen & garages</span>
                <span className="font-mono">{eur(portefeuille.parkeerTotaal)}</span>
              </div>
            )}
          </div>
          <div className="pt-3 flex items-center justify-between" style={{ borderTop: `1px dashed ${LINE}` }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 14, color: STAMP, fontWeight: 500 }}>Totale venale waarde (alle panden)</span>
            <span className="font-mono" style={{ fontSize: 22, color: STAMP, fontWeight: 500 }}>{eur(portefeuille.totaal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
