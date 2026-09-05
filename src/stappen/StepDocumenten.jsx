// ----------------------------------------------------------------------------
// stappen/StepDocumenten.jsx — wizardtabblad "Documenten"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen. Bevat ook DOC_CROSS_REFERENCE, dat enkel door StepDocumenten gebruikt wordt.
//
// Bewuste circulaire import naar ../App.jsx voor bouwAiVoorstellen: dat blijft voorlopig in
// App.jsx staan (het wordt ook door de dossier-brede AI-invullogica gebruikt) en wordt hier pas
// effectief aangeroepen binnen een click-handler (vulUitDocumenten), dus lang nadat beide modules
// volledig geladen zijn — zie ook StepRapport.jsx (opsplitsing stap 9) voor hetzelfde patroon met
// valideerDossier, daar met een test die dit expliciet aantoont.
import React, { useState, useRef } from "react";
import {
  Check, AlertTriangle, Image as ImageIcon, Paperclip, Upload, Sparkles, Loader2, FileText,
  Trash2, Camera,
} from "lucide-react";
import { INK, INK_SOFT, PAPER_RAISED, LINE, BRASS, BRASS_SOFT, STAMP, STAMP_SOFT, DANGER, VERDIEPINGEN } from "../constants.js";
import { berekenPandBijlageBytes, fmtMB } from "../lib/afbeeldingen.js";
import { Section, inputStyle } from "../ui/velden.jsx";
import { extractJson, duidAiDocFout, callClaudeWithDocs } from "../data/ai.js";
import { bouwAiVoorstellen } from "../App.jsx";

// ---------- documenten ----------
// kruisverwijzing: welk appveld kan uit welk typisch brondocument gehaald worden
const DOC_CROSS_REFERENCE = [
  { veld: "CaPaKey", tabblad: "Type, staat & kadaster", bron: "Elk uittreksel — bovenaan bij \"Perceel\"" },
  { veld: "Kadastrale afdeling / sectie / perceelnr.", tabblad: "Type, staat & kadaster", bron: "Bv. \"afdeling SINT-GILLIS-WAAS 1 ... sectie B ... perceelnummer 0127\"" },
  { veld: "Straat, postcode, gemeente", tabblad: "Opdracht & partijen", bron: "\"Referentienummer\" / adresvermelding op elk uittreksel" },
  { veld: "Gewestplan hoofdbestemming", tabblad: "Markt, stedenbouw & juridisch", bron: "Informatieaanvraag Gewestinfo — \"Hoofdbestemming\"" },
  { veld: "Erfgoed", tabblad: "Markt, stedenbouw & juridisch", bron: "Informatievraag Onroerend erfgoed — \"Resultaat\"" },
  { veld: "Voorkooprecht", tabblad: "Markt, stedenbouw & juridisch", bron: "Informatievraag Vlaamse Voorkooprechten — \"Resultaat\"" },
  { veld: "Watertoets P-score / G-score", tabblad: "Markt, stedenbouw & juridisch", bron: "Overstromingsrapport — \"Perceelscore\" / \"Gebouwenscore\"" },
  { veld: "Bouwmisdrijven", tabblad: "Markt, stedenbouw & juridisch", bron: "Herstelvorderingen / ongeschikt-onbewoonbaar — \"Resultaat\"" },
  { veld: "Mobiscore", tabblad: "Markt, stedenbouw & juridisch", bron: "Mobiscore-uittreksel" },
];

export function StepDocumenten({ d, set, addDocumenten, removeDocument, updateDocument, addRuimtesBulk }) {
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultaat, setResultaat] = useState(null);
  // voorstellen die wachten op bevestiging (zie bouwAiVoorstellen) + wat het model teruggaf maar
  // de controle niet doorstond
  const [voorstellen, setVoorstellen] = useState([]);
  const [aangevinkt, setAangevinkt] = useState({});
  const [geweigerd, setGeweigerd] = useState([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState("");
  const [resultaatPlan, setResultaatPlan] = useState(null);
  const fmtSize = (b) => b ? `${(b / 1024).toFixed(0)} kB` : "";
  // een document is klaar voor AI-uitlezing zodra het ofwel inline als base64 bewaard is, ofwel
  // (voor grotere documenten) permanent naar Storage opgeladen werd (doc.pad — zie
  // uploadDocumentNaarStorage/addDocumenten hierboven); "opladen" sluit een net toegevoegd
  // document uit zolang die upload nog bezig is.
  const pdfDocs = d.documenten.filter((doc) => !doc.opladen && (doc.base64 || doc.pad));
  const bijlageBytes = berekenPandBijlageBytes(d);
  const bijlageMB = bijlageBytes / (1024 * 1024);

  const vulUitDocumenten = async () => {
    setLoading(true);
    setError("");
    setResultaat(null);
    try {
      const prompt = `Je krijgt één of meerdere documenten mee, als PDF en/of als foto (bv. een vastgoedinfo-bundel met uittreksels van Geopunt/Digitaal Vlaanderen, Onroerend Erfgoed, Vlaamse Milieumaatschappij, Statbel, Mobiscore, ...). Haal er de volgende gegevens uit, indien aanwezig. Verzin nooit een waarde — laat een veld leeg als het niet met zekerheid in het document staat.
- capakey: de volledige CaPaKey/perceelcode (bv. "46020B0127/00Z000"), meestal bovenaan bij "Perceel"
- kadAfdeling: het afdelingsnummer (bv. "1")
- kadSectie: de sectieletter (bv. "B")
- kadPerceelnummer: het perceelnummer (bv. "0127/00Z000")
- straat, nummer, postcode, gemeente: het adres van het perceel
- gewestplan: de hoofdbestemming volgens het gewestplan, gemapt naar exact één van: "Woongebied", "Woonuitbreidingsgebied", "Agrarisch gebied", "Industriegebied", "Andere"
- erfgoed: "Ja" als het pand beschermd of vastgesteld onroerend erfgoed is, anders "Nee"
- voorkooprecht: "Ja" als er een voorkooprecht van toepassing is, anders "Nee"
- watertoetsP: de perceelscore/P-score (A, B, C of D)
- watertoetsG: de gebouwenscore/G-score (A, B, C of D)
- bouwmisdrijven: "Ja" als er een herstelvordering of ongeschikt-/onbewoonbaarverklaring gevonden werd, anders "Nee"
- mobiscore: de Mobiscore als getal (bv. 5.7)
- bpaRupVerkaveling: korte samenvatting van eventuele bijzondere stedenbouwkundige info (RUP, verkaveling, WORG) indien vermeld

Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat (lege string indien onbekend):
{"capakey":"","kadAfdeling":"","kadSectie":"","kadPerceelnummer":"","straat":"","nummer":"","postcode":"","gemeente":"","gewestplan":"","erfgoed":"","voorkooprecht":"","watertoetsP":"","watertoetsG":"","bouwmisdrijven":"","mobiscore":"","bpaRupVerkaveling":""}`;

      const raw = await callClaudeWithDocs(pdfDocs, prompt, d.id);
      const parsed = extractJson(raw);
      // niets wordt nog rechtstreeks weggeschreven: de gecontroleerde voorstellen komen eerst ter
      // bevestiging op het scherm (zie bouwAiVoorstellen en het voorstelpaneel hieronder)
      const { voorstellen, geweigerd } = bouwAiVoorstellen(parsed, d);
      setVoorstellen(voorstellen);
      setAangevinkt(Object.fromEntries(voorstellen.map((v) => [v.veld, true])));
      setGeweigerd(geweigerd);
      setResultaat(voorstellen.length ? voorstellen.map((v) => v.veld) : []);
    } catch (e) {
      setError(`Kon de gegevens niet automatisch invullen (${duidAiDocFout(e)}). Vul de velden manueel aan.`);
    } finally {
      setLoading(false);
    }
  };

  // Leest een grondplan/bouwplan (als PDF/foto bij de documenten hierboven toegevoegd) en telt de
  // per ruimte op het plan vermelde oppervlaktes op tot ÉÉN rij per verdieping op het tabblad
  // "Afmetingen & indeling" (via addRuimtesBulk, zie bindPand in DossierWizard) — dat telt
  // automatisch mee in de berekende bewoonbare/nuttige oppervlakte (berekenWaardering). Bewust
  // samengevat per verdieping i.p.v. één rij per afzonderlijke ruimte: die tabel (en de kolom in
  // het rapport) toont toch geen kamernaam, enkel de verdieping, dus een rij per kamer gaf enkel
  // een lange lijst onderling niet te onderscheiden rijen. Bestaande ruimtes blijven altijd staan;
  // dit VOEGT enkel nieuwe rijen toe, het overschrijft niets, zodat een tweede keer uitlezen (bv.
  // na een aangepast plan) geen eerder ingevulde gegevens wist.
  const vulOppervlaktesUitPlannen = async () => {
    setLoadingPlan(true);
    setErrorPlan("");
    setResultaatPlan(null);
    try {
      const prompt = `Je krijgt één of meerdere documenten mee. Zoek ertussen naar een grondplan of bouwplan (architectenplan) van een woning of pand, waarop per ruimte een oppervlakte in m² vermeld staat. Zit er geen plan bij, of staat er geen enkele oppervlakte op, antwoord dan met een lege "ruimtes"-lijst — verzin nooit een waarde die niet letterlijk op het plan staat.

Lees voor élke ruimte die je op het plan terugvindt MET een vermelde oppervlakte:
- verdieping: de bouwlaag, gemapt naar exact één van deze sleutels: "gelijkvloers" (gelijkvloers/benedenverdieping), "1everdiep" (1e verdieping), "2everdiep" (2e verdieping of hoger), "zolder", "garage", "berging", "tuinberging", "terras". Kies de dichtstbijzijnde match; gebruik "gelijkvloers" als de bouwlaag niet duidelijk is.
- naam: de kamernaam exact zoals op het plan (bv. "Living", "Keuken", "Slaapkamer 1", "Badkamer", "Berging")
- opp: de oppervlakte in m² exact zoals op het plan vermeld (enkel het getal, punt als decimaalteken, bv. "14.2")

Vul daarnaast enkel in indien een TOTALE oppervlakte apart en expliciet op een plan vermeld staat (laat anders leeg — dat wordt elders al automatisch berekend uit de ruimtes hierboven):
- grondopp: de totale grondoppervlakte/perceeloppervlakte in m² (bv. van een opmetingsplan/perceelplan)
- bebouwdeOpp: de totale bebouwde oppervlakte in m²

Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat:
{"ruimtes":[{"verdieping":"","naam":"","opp":""}],"grondopp":"","bebouwdeOpp":""}`;

      const raw = await callClaudeWithDocs(pdfDocs, prompt, d.id);
      const parsed = extractJson(raw);
      const nieuweRuimtes = (Array.isArray(parsed.ruimtes) ? parsed.ruimtes : [])
        .filter((r) => r && r.opp !== "" && r.opp !== null && r.opp !== undefined && !isNaN(parseFloat(r.opp)));
      // per verdieping optellen (zie toelichting hierboven) i.p.v. per afzonderlijke ruimte toevoegen
      const totaalPerVerdieping = new Map();
      nieuweRuimtes.forEach((r) => {
        totaalPerVerdieping.set(r.verdieping, (totaalPerVerdieping.get(r.verdieping) || 0) + parseFloat(r.opp));
      });
      const verdiepingRijen = [...totaalPerVerdieping.entries()].map(([verdieping, opp]) => {
        const v = VERDIEPINGEN.find((x) => x.key === verdieping);
        return { verdieping, naam: v ? v.label : verdieping, opp: opp.toFixed(1) };
      });
      if (verdiepingRijen.length) addRuimtesBulk(verdiepingRijen);
      ["grondopp", "bebouwdeOpp"].forEach((veld) => {
        const waarde = parsed[veld];
        if (waarde !== "" && waarde !== null && waarde !== undefined) set(veld)(String(waarde));
      });
      setResultaatPlan(verdiepingRijen.length);
    } catch (e) {
      setErrorPlan(`Kon geen oppervlaktes uit een plan halen (${duidAiDocFout(e)}). Vul de oppervlaktes manueel in op tabblad "Afmetingen & indeling".`);
    } finally {
      setLoadingPlan(false);
    }
  };

  return (
    <div>
      <div className="rounded-lg p-4 mb-6" style={{ background: BRASS_SOFT, border: `1px solid ${BRASS}` }}>
        <div className="text-xs font-medium mb-1" style={{ color: BRASS }}>Tip</div>
        <div className="text-xs" style={{ color: INK }}>
          Laad hier eerst je vastgoedinfo-bundel (bv. van Geopunt/CIB Vastgoedinfo) op. De AI-knop hieronder leest de documenten rechtstreeks
          en vult automatisch herkende gegevens in op de bijhorende tabbladen verderop — dat bespaart je het overtypen. Elk automatisch
          ingevuld veld blijft manueel aan te passen of te overschrijven op het betreffende tabblad; controleer dus altijd het resultaat.
          Voeg je hier ook het grondplan/bouwplan toe — als PDF of als foto — dan kan een aparte knop verderop de oppervlaktes per ruimte er rechtstreeks uit overnemen naar tabblad "Afmetingen & indeling".
        </div>
        <table className="w-full text-xs mt-3" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Veld", "Terug te vinden op tabblad", "Typische bron in het document"].map((h) => (
                <th key={h} className="text-left py-1 pr-3" style={{ color: BRASS, fontWeight: 600, borderBottom: `1px solid ${BRASS}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOC_CROSS_REFERENCE.map((r) => (
              <tr key={r.veld} style={{ borderBottom: `1px dotted ${BRASS}` }}>
                <td className="py-1 pr-3" style={{ color: INK }}>{r.veld}</td>
                <td className="py-1 pr-3" style={{ color: INK_SOFT }}>{r.tabblad}</td>
                <td className="py-1 pr-3" style={{ color: INK_SOFT }}>{r.bron}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title="Juridische info & documenten" icon={Paperclip}>
        <div className="col-span-2">
          <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
            Vergunningen, bodemattest, stedenbouwkundige uittreksels, eigendomsakte, EPC-attest, verkavelingsvergunning, vastgoedinfo-bundel, grondplan/bouwplan, ...
            Voeg bij elk document kort de kernpunten toe — die tekst wordt gebruikt om de SWOT-analyse te onderbouwen.
          </div>
          {bijlageMB > 3 && (
            <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg"
              style={{
                background: bijlageMB > 12 ? "#FBEAEA" : bijlageMB > 6 ? BRASS_SOFT : PAPER_RAISED,
                color: bijlageMB > 12 ? DANGER : bijlageMB > 6 ? BRASS : INK_SOFT,
              }}>
              {bijlageMB > 6 && <AlertTriangle size={13} />}
              Foto's en documenten in dit pand wegen samen ongeveer {fmtMB(bijlageBytes)} MB.
              {bijlageMB > 6 ? " Hoe meer, hoe trager (en foutgevoeliger) het opslaan — verwijder oudere of onnodige bijlagen indien mogelijk." : ""}
            </div>
          )}
          <div className="flex gap-3">
            <div onClick={() => inputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
              style={{ border: `1.5px dashed ${LINE}`, padding: "28px 16px", background: PAPER_RAISED }}>
              <Upload size={18} style={{ color: BRASS }} />
              <span className="text-sm text-center" style={{ color: INK_SOFT }}>Klik om documenten toe te voegen (PDF, foto, Word, tekst)</span>
              <input ref={inputRef} type="file" multiple className="hidden"
                accept=".pdf,.doc,.docx,.txt,image/*" onChange={(e) => { addDocumenten(e.target.files); e.target.value = ""; }} />
            </div>
            <div onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
              style={{ border: `1.5px dashed ${LINE}`, padding: "28px 16px", background: PAPER_RAISED }}>
              <Camera size={18} style={{ color: BRASS }} />
              <span className="text-sm text-center" style={{ color: INK_SOFT }}>Foto nemen (bv. van een grondplan)</span>
              <input ref={cameraInputRef} type="file" multiple accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { addDocumenten(e.target.files); e.target.value = ""; }} />
            </div>
          </div>

          {pdfDocs.length > 0 && (
            <div className="mt-3">
              <button onClick={vulUitDocumenten} disabled={loading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
                style={{ background: loading ? "#B8B4A8" : STAMP }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {loading ? "Gegevens uitlezen..." : `Gegevens automatisch invullen uit ${pdfDocs.length} document${pdfDocs.length === 1 ? "" : "en"}`}
              </button>
              {error && (
                <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
                  <AlertTriangle size={13} /> {error}
                </div>
              )}
              {resultaat !== null && !error && voorstellen.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: STAMP_SOFT, color: STAMP }}>
                  <Check size={13} />
                  {geweigerd.length
                    ? "Geen bruikbare gegevens gevonden in dit document."
                    : "Geen nieuwe gegevens gevonden — alles wat het document vermeldt, staat al ingevuld."}
                </div>
              )}

              {/* Voorstelscherm: de schatter-expert beslist zelf wat overgenomen wordt. Voordien
                  schreef de AI rechtstreeks in het dossier, zonder te tonen wélke velden, zonder
                  bestaande invoer te sparen en zonder weg terug. */}
              {voorstellen.length > 0 && !error && (
                <div className="mt-3 rounded-lg overflow-hidden" style={{ border: `1px solid ${BRASS}` }}>
                  <div className="px-3 py-2 text-xs" style={{ background: BRASS_SOFT, color: INK, fontWeight: 600 }}>
                    {voorstellen.length} voorstel{voorstellen.length === 1 ? "" : "len"} uit het document — vink aan wat je overneemt
                  </div>
                  <div className="px-3 py-2" style={{ background: PAPER_RAISED }}>
                    {voorstellen.map((v) => (
                      <label key={v.veld} className="flex items-start gap-2 py-1.5 cursor-pointer" style={{ borderBottom: `1px dotted ${LINE}` }}>
                        <input type="checkbox" checked={!!aangevinkt[v.veld]} style={{ marginTop: 3, accentColor: BRASS }}
                          onChange={(e) => setAangevinkt((p) => ({ ...p, [v.veld]: e.target.checked }))} />
                        <span className="text-xs" style={{ color: INK }}>
                          <strong>{v.label}</strong>{" "}
                          {v.oud
                            ? <>— nu <span style={{ color: DANGER, textDecoration: "line-through" }}>{v.oud}</span> wordt <span style={{ color: STAMP, fontWeight: 600 }}>{v.nieuw}</span></>
                            : <>— <span style={{ color: STAMP, fontWeight: 600 }}>{v.nieuw}</span></>}
                          {v.oud && <span style={{ color: DANGER }}> (overschrijft wat er staat)</span>}
                        </span>
                      </label>
                    ))}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => {
                          voorstellen.filter((v) => aangevinkt[v.veld]).forEach((v) => set(v.veld)(v.nieuw));
                          setResultaat(voorstellen.filter((v) => aangevinkt[v.veld]).map((v) => v.veld));
                          setVoorstellen([]);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: INK }}>
                        Aangevinkte overnemen
                      </button>
                      <button onClick={() => { setVoorstellen([]); setResultaat([]); }}
                        className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
                        Niets overnemen
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {geweigerd.length > 0 && !error && (
                <div className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: INK }}>
                  <strong style={{ color: DANGER }}>Niet overgenomen:</strong>{" "}
                  {geweigerd.map((g) => `${g.veld} (${g.reden})`).join(" · ")}
                </div>
              )}

              {/* apart van "Gegevens automatisch invullen" hierboven: leest specifiek een
                  grondplan/bouwplan (indien als PDF bij de documenten hierboven toegevoegd) en zet
                  elke ruimte met een vermelde oppervlakte om in een rij op tabblad "Afmetingen &
                  indeling" — zie vulOppervlaktesUitPlannen/addRuimtesBulk hierboven. */}
              <button onClick={vulOppervlaktesUitPlannen} disabled={loadingPlan}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white mt-2"
                style={{ background: loadingPlan ? "#B8B4A8" : STAMP }}>
                {loadingPlan ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {loadingPlan ? "Plan uitlezen..." : `Oppervlaktes uit plannen halen (${pdfDocs.length} document${pdfDocs.length === 1 ? "" : "en"})`}
              </button>
              <div className="text-xs mt-1.5" style={{ color: INK_SOFT }}>
                Vindt de AI een grondplan tussen de hierboven toegevoegde documenten (PDF of foto), dan worden de oppervlaktes per verdieping opgeteld en als één rij per verdieping toegevoegd op tabblad "Afmetingen & indeling" — bestaande rijen blijven staan, controleer en vul aan waar nodig.
              </div>
              {errorPlan && (
                <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
                  <AlertTriangle size={13} /> {errorPlan}
                </div>
              )}
              {resultaatPlan !== null && !errorPlan && (
                <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: STAMP_SOFT, color: STAMP }}>
                  <Check size={13} />
                  {resultaatPlan > 0
                    ? `${resultaatPlan} verdiepingtotaal${resultaatPlan === 1 ? "" : "en"} toegevoegd op tabblad "Afmetingen & indeling" — controleer het resultaat.`
                    : "Geen grondplan met oppervlaktes herkend in de toegevoegde documenten."}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {d.documenten.length === 0 && <div className="text-sm italic" style={{ color: INK_SOFT }}>Nog geen documenten toegevoegd.</div>}
            {d.documenten.map((doc) => (
              <div key={doc.id} className="rounded-lg p-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {doc.type?.startsWith("image/") ? <ImageIcon size={14} style={{ color: BRASS }} /> : <FileText size={14} style={{ color: BRASS }} />}
                    <span className="text-sm" style={{ fontWeight: 500 }}>{doc.naam}</span>
                    <span className="text-xs" style={{ color: INK_SOFT }}>{fmtSize(doc.grootte)}</span>
                    {doc.opladen && <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: PAPER_RAISED, color: INK_SOFT, border: `1px solid ${LINE}` }}><Loader2 size={11} className="animate-spin" /> Bezig met opladen…</span>}
                    {!doc.opladen && (doc.base64 || doc.pad) && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: STAMP_SOFT, color: STAMP }}>Gereed voor AI-uitlezing</span>}
                  </div>
                  <button onClick={() => removeDocument(doc.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
                </div>
                <textarea value={doc.notities} onChange={(e) => updateDocument(doc.id, "notities", e.target.value)}
                  rows={2} placeholder="Kernpunten uit dit document (bv. beperkingen, erfdienstbaarheden, bouwovertredingen, geldigheid vergunning...)"
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: 13 }} />
              </div>
            ))}
          </div>
        </div>

      </Section>
    </div>
  );
}
