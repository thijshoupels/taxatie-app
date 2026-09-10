// ----------------------------------------------------------------------------
// stappen/StepDocumenten.jsx — wizardtabblad "Documenten"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen. Bevat ook DOC_CROSS_REFERENCE, dat enkel door StepDocumenten gebruikt wordt.
//
// Bewuste circulaire import naar ../App.jsx voor bouwAiVoorstellen: dat blijft voorlopig in
// App.jsx staan (het wordt ook door de dossier-brede AI-invullogica gebruikt) en wordt hier pas
// effectief aangeroepen binnen een click-handler (verwerkDocumenten), dus lang nadat beide modules
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
import { extractJson, duidAiDocFout, callClaudeWithDocs, splitsDocumentAnalyse } from "../data/ai.js";
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
  const [resultaatPlan, setResultaatPlan] = useState(null);
  const fmtSize = (b) => b ? `${(b / 1024).toFixed(0)} kB` : "";
  // een document is klaar voor AI-uitlezing zodra het ofwel inline als base64 bewaard is, ofwel
  // (voor grotere documenten) permanent naar Storage opgeladen werd (doc.pad — zie
  // uploadDocumentNaarStorage/addDocumenten hierboven); "opladen" sluit een net toegevoegd
  // document uit zolang die upload nog bezig is.
  const pdfDocs = d.documenten.filter((doc) => !doc.opladen && (doc.base64 || doc.pad));
  const bijlageBytes = berekenPandBijlageBytes(d);
  const bijlageMB = bijlageBytes / (1024 * 1024);

  // Vroeger twee aparte AI-aanvragen (juridische/kadastrale velden, en apart de grondplan-
  // oppervlaktes) — elk stuurde ALLE opgeladen documenten opnieuw volledig mee, dus bv. een
  // vastgoedinfo-bundel van 15 pagina's werd tweemaal verwerkt voor twee klikken op dezelfde
  // documenten. Nu ÉÉN gecombineerde aanvraag: de documenten worden nog maar één keer
  // meegestuurd, en het antwoord wordt nadien lokaal gesplitst (splitsDocumentAnalyse, zie
  // data/ai.js) in het voorstellenpaneel (bouwAiVoorstellen) en de oppervlaktes-per-verdieping
  // (addRuimtesBulk) — exact dezelfde twee resultaten als voorheen, uit exact dezelfde
  // brondocumenten, gewoon in één AI-call i.p.v. twee.
  const verwerkDocumenten = async () => {
    setLoading(true);
    setError("");
    setResultaat(null);
    setResultaatPlan(null);
    try {
      const prompt = `Je krijgt één of meerdere documenten mee, als PDF en/of als foto (bv. een vastgoedinfo-bundel met uittreksels van Geopunt/Digitaal Vlaanderen, Onroerend Erfgoed, Vlaamse Milieumaatschappij, Statbel, Mobiscore, ..., en/of een grondplan/bouwplan). Haal er de volgende gegevens uit, indien aanwezig. Verzin nooit een waarde — laat een veld (of lijst) leeg als iets niet met zekerheid in de documenten staat.

Juridische/kadastrale gegevens (typisch uit een vastgoedinfo-bundel):
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

Grondplan/bouwplan (enkel indien aanwezig tussen de documenten): zoek naar een plan waarop per ruimte een oppervlakte in m² vermeld staat. Zit er geen plan bij, of staat er geen enkele oppervlakte op, geef dan een lege "ruimtes"-lijst — verzin nooit een waarde die niet letterlijk op het plan staat.
- ruimtes: lijst van objecten met verdieping/naam/opp voor élke ruimte MET een vermelde oppervlakte:
  - verdieping: gemapt naar exact één van deze sleutels: "kelder" (kelder/souterrain), "gelijkvloers" (gelijkvloers/benedenverdieping), "1everdiep" (1e verdieping), "2everdiep" (2e verdieping of hoger), "zolder", "garage", "berging", "tuinberging", "terras". Gebruik "gelijkvloers" als de bouwlaag niet duidelijk is.
  - naam: de kamernaam exact zoals op het plan (bv. "Living", "Keuken", "Slaapkamer 1", "Badkamer", "Berging")
  - opp: de oppervlakte in m² exact zoals op het plan vermeld (enkel het getal, punt als decimaalteken, bv. "14.2")
- grondopp: de totale grondoppervlakte/perceeloppervlakte in m² — enkel indien apart en expliciet op een plan vermeld (laat anders leeg, dat wordt elders al automatisch berekend uit de ruimtes hierboven)
- bebouwdeOpp: de totale bebouwde oppervlakte in m² — enkel indien apart en expliciet vermeld

Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat (lege string/lijst indien onbekend):
{"capakey":"","kadAfdeling":"","kadSectie":"","kadPerceelnummer":"","straat":"","nummer":"","postcode":"","gemeente":"","gewestplan":"","erfgoed":"","voorkooprecht":"","watertoetsP":"","watertoetsG":"","bouwmisdrijven":"","mobiscore":"","bpaRupVerkaveling":"","ruimtes":[{"verdieping":"","naam":"","opp":""}],"grondopp":"","bebouwdeOpp":""}`;

      const raw = await callClaudeWithDocs(pdfDocs, prompt, d.id);
      const parsed = extractJson(raw);
      const { juridisch, ruimtes, grondopp, bebouwdeOpp } = splitsDocumentAnalyse(parsed);

      // deel 1: juridische/kadastrale velden — niets wordt rechtstreeks weggeschreven, de
      // gecontroleerde voorstellen komen eerst ter bevestiging op het scherm (zie bouwAiVoorstellen
      // en het voorstelpaneel hieronder), exact zoals voorheen.
      const { voorstellen, geweigerd } = bouwAiVoorstellen(juridisch, d);
      setVoorstellen(voorstellen);
      setAangevinkt(Object.fromEntries(voorstellen.map((v) => [v.veld, true])));
      setGeweigerd(geweigerd);
      setResultaat(voorstellen.length ? voorstellen.map((v) => v.veld) : []);

      // deel 2: grondplan-oppervlaktes — per verdieping opgeteld tot ÉÉN rij op tabblad
      // "Afmetingen & indeling" (via addRuimtesBulk, zie bindPand in DossierWizard); dat telt
      // automatisch mee in de berekende bewoonbare/nuttige oppervlakte (berekenWaardering). Bewust
      // samengevat per verdieping i.p.v. één rij per afzonderlijke ruimte: die tabel (en de kolom
      // in het rapport) toont toch geen kamernaam, enkel de verdieping. Bestaande ruimtes blijven
      // altijd staan; dit VOEGT enkel nieuwe rijen toe, het overschrijft niets, zodat een tweede
      // keer verwerken (bv. na een aangepast plan) geen eerder ingevulde gegevens wist.
      const nieuweRuimtes = ruimtes.filter((r) => r && r.opp !== "" && r.opp !== null && r.opp !== undefined && !isNaN(parseFloat(r.opp)));
      const totaalPerVerdieping = new Map();
      nieuweRuimtes.forEach((r) => {
        totaalPerVerdieping.set(r.verdieping, (totaalPerVerdieping.get(r.verdieping) || 0) + parseFloat(r.opp));
      });
      const verdiepingRijen = [...totaalPerVerdieping.entries()].map(([verdieping, opp]) => {
        const v = VERDIEPINGEN.find((x) => x.key === verdieping);
        return { verdieping, naam: v ? v.label : verdieping, opp: opp.toFixed(1) };
      });
      if (verdiepingRijen.length) addRuimtesBulk(verdiepingRijen);
      if (grondopp !== "" && grondopp !== null && grondopp !== undefined) set("grondopp")(String(grondopp));
      if (bebouwdeOpp !== "" && bebouwdeOpp !== null && bebouwdeOpp !== undefined) set("bebouwdeOpp")(String(bebouwdeOpp));
      setResultaatPlan(verdiepingRijen.length);
    } catch (e) {
      setError(`Kon de documenten niet automatisch verwerken (${duidAiDocFout(e)}). Vul de velden manueel aan.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="rounded-lg p-4 mb-6" style={{ background: BRASS_SOFT, border: `1px solid ${BRASS}` }}>
        <div className="text-xs font-medium mb-1" style={{ color: BRASS }}>Tip</div>
        <div className="text-xs" style={{ color: INK }}>
          Laad hier je vastgoedinfo-bundel (bv. van Geopunt/CIB Vastgoedinfo) én, indien beschikbaar, het grondplan/bouwplan op. Eén AI-knop
          hieronder leest alle documenten in één keer en vult zowel de juridische/kadastrale velden als de oppervlaktes per ruimte automatisch
          in op de bijhorende tabbladen verderop — dat bespaart je het overtypen. Elk automatisch ingevuld veld blijft manueel aan te passen of
          te overschrijven op het betreffende tabblad; controleer dus altijd het resultaat.
        </div>
        <div className="text-xs mt-3" style={{ color: INK }}>
          <strong>Sneller en goedkoper verwerken:</strong> laad elk document maar één keer op, en enkel wat je nog nodig hebt — een dubbel
          opgeladen bestand of een niet-relevante bijlage wordt toch integraal meegestuurd naar de AI en kost dus extra. Vul de kernpunten van
          een document meteen in bij "Notities" hieronder: is dat al ingevuld, dan wordt dát document niet nogmaals als bijlage meegestuurd bij
          het AI-voorstel op tabblad "SWOT-analyse" — de tekst die je zelf typte, telt daar dan al mee. Is een document erg lang (tientallen
          pagina's), overweeg dan enkel de relevante pagina's op te laden in plaats van het volledige stuk.
        </div>
        <div className="text-xs mt-3" style={{ color: INK }}>
          <strong>Duidelijk leesbare documenten (minder foute of gemiste velden):</strong> gebruik waar mogelijk een digitale PDF-export in
          plaats van een foto van een afdruk. Fotografeer je toch, doe dat recht van boven, met voldoende licht en zonder schaduw of
          flitsreflectie op het papier, met de volledige pagina in beeld en scherpe, ook ingezoomd leesbare tekst. Eén document per bestand
          werkt beter dan alles samen scannen tot één grote, ongeordende PDF.
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
              <button onClick={verwerkDocumenten} disabled={loading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
                style={{ background: loading ? "#B8B4A8" : STAMP }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {loading ? "Documenten verwerken..." : `Documenten automatisch verwerken (${pdfDocs.length} document${pdfDocs.length === 1 ? "" : "en"})`}
              </button>
              <div className="text-xs mt-1.5" style={{ color: INK_SOFT }}>
                Vult zowel de juridische/kadastrale velden hierboven in (ter bevestiging) als — vindt de AI een grondplan tussen de documenten
                — de oppervlaktes per verdieping op tabblad "Afmetingen & indeling" (bestaande rijen blijven staan, controleer en vul aan waar nodig).
              </div>
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
              {resultaatPlan !== null && !error && (
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
