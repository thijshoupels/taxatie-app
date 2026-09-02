// ----------------------------------------------------------------------------
// data/ai.js — AI-aanroepen (Claude via /api/claude) en het lokale SWOT-vangnet
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 5) zonder wijziging aan de logica
// zelf. Enkel de acht functies die elders in App.jsx (DossierWizard) rechtstreeks aangeroepen
// worden zijn "export": buildPropertySummary, genereerAutomatischeSwot, callClaudeWithSearch,
// extractJson, duidAiDocFout, uploadDocumentNaarStorage, uploadFotoVoorPdf, callClaudeWithDocs.
// De interne helpers (fetchClaudeJson, haalDocumentUrl, uploadDocVoorAnalyse) blijven module-
// privé, precies zoals ze voorheen enkel binnen dit deel van App.jsx zichtbaar waren.
import { supabase, haalSessieToken } from "./supabase.js";
import { num, uid } from "../lib/format.js";

// bouwt een tekstsamenvatting van alle ingevulde tabbladen, gebruikt als context voor de AI-SWOT
export function buildPropertySummary(d) {
  const eig = d.eigenschappen;
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const oppLabel = isResidentieel ? "bewoonbare opp." : "nuttige vloeropp.";
  const lines = [
    `Adres: ${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`,
    `Vastgoedtype: ${d.vastgoedType}${d.vastgoedType === "Bedrijfsvastgoed" && d.bedrijfsSubtype ? " (" + d.bedrijfsSubtype + ")" : ""}`,
    // "klasse" (ABEX-woningklasse) is enkel relevant/ingevuld bij Residentieel — zie berekenWaardering
    `Type: ${d.pandType}, bouwtype: ${d.bouwtype}${isResidentieel ? `, klasse: ${d.klasse}` : ""}, bouwjaar: ${d.bouwjaar || "onbekend"}`,
    `Staat: ${d.staat.join(", ") || "onbekend"}`,
    `Oriëntatie: ${d.orientatie}, breedte gevel: ${d.breedteGevel || "?"} m, grondoppervlakte: ${d.grondopp || "?"} m², ${oppLabel}: ${d.bewoonbareOppSchatting || "?"} m²`,
    `Ruwbouw: ${d.ruwbouw}${d.ruwbouwAndere ? " (" + d.ruwbouwAndere + ")" : ""}, dak: ${d.hoofddakType} in ${d.hoofddakMateriaal}`,
    isResidentieel
      ? `EPC: ${d.epcStatus}${d.epcWaarde ? ", " + d.epcWaarde + " kWh/m²" : ""}`
      : `EPC-regime: ${d.bedrijfsEpcType || "onbekend"}${d.bedrijfsEpcWaarde ? ", " + d.bedrijfsEpcWaarde : ""}`,
    `Isolatie: ${d.isolatie.join(", ") || "niet bepaald"}`,
    `Buitenschrijnwerk: ${d.buitenschrijnwerk.join(", ") || "onbekend"}`,
    `Verwarming: ${d.verwarmingSoort.join(", ") || "onbekend"} op ${d.verwarmingGrondstof.join(", ") || "onbekend"}`,
    `Elektrische keuring: ${d.keuringStatus}`,
    `Overige uitrusting: ${d.allerlei.join(", ") || "geen bijzondere"}`,
    // ruimtes/interieur: residentiële checklists (StepRuimteEigenschappen) vs. bedrijfskenmerken
    // (StepBedrijfskenmerken) — zie de steps-array in DossierWizard
    ...(isResidentieel ? [
      `Aantal slaapkamers: ${d.slaapkamers.length}`,
      `Keuken: ${eig.keuken.items.join(", ") || "niet gespecificeerd"}`,
      `Badkamer: ${eig.badkamer.items.join(", ") || "niet gespecificeerd"}`,
      `Tuin/terras: ${eig.tuinTerras.items.join(", ") || "geen"}${eig.tuinTerras.orientatie ? ", oriëntatie " + eig.tuinTerras.orientatie : ""}`,
      `Andere ruimtes: ${(d.extraRuimtes || []).filter((r) => r.naam).map((r) => r.naam).join(", ") || "geen"}`,
    ] : [
      `Bedrijfskenmerken: bestemmingszone ${d.bedrijfsBestemmingszone || "onbekend"}, milieuvergunning ${d.bedrijfsVergunningMilieu || "onbekend"}, parkeerplaatsen ${d.bedrijfsParkeerplaatsen || "0"}, laadkades ${d.bedrijfsLaadkades || "0"}`,
      `Interne afwerking: vloer ${d.bedrijfsVloerafwerking || "onbekend"}, wand ${d.bedrijfsWandafwerking || "onbekend"}, plafond ${d.bedrijfsPlafondafwerking || "onbekend"}`,
      `Omschrijving indeling: ${d.bedrijfsOmschrijvingIndeling || "geen vermeld"}`,
      ...(d.bedrijfsSubtype === "Industrieel/logistiek" ? [`Industrieel/logistiek: vrije hoogte ${d.industrieelVrijeHoogte || "?"} m, vloerbelasting ${d.industrieelVloerbelasting || "?"} ton/m², dock levellers ${d.industrieelAantalDockLevellers || "0"}`] : []),
      ...(d.bedrijfsSubtype === "Winkel" ? [`Winkel: locatiecategorie ${d.winkelLocatiecategorie || "onbekend"}, gevelbreedte ${d.winkelGevelbreedte || "?"} m`] : []),
      ...(d.bedrijfsSubtype === "Kantoor" ? [`Kantoor: indeling ${d.kantoorIndeling || "onbekend"}, verdiepingen ${d.kantoorVerdiepingen || "?"}`] : []),
      ...(d.bedrijfsSubtype === "Horeca" ? [`Horeca: type ${d.horecaType || "onbekend"}, zitplaatsen ${d.horecaZitplaatsen || "?"}`] : []),
    ]),
    `Verbouwingen/renovaties: ${d.verbouwingen || "geen vermeld"}`,
    `Markt — aanbod te koop: ${d.aanbodTeKoop}, verkoopbaarheid: ${d.verkoopbaarheid}`,
    `Stedenbouw — gewestplan: ${d.gewestplan}, erfgoed: ${d.erfgoed}, voorkooprecht: ${d.voorkooprecht}, vergunning: ${d.vergunning}`,
    `Mobiscore: ${d.mobiscore || "onbekend"}`,
    `Eigendomstoestand: ${d.eigenaars.filter((e) => e.naam).map((e) => `${e.naam} (${e.recht}${e.aandeel ? ", " + e.aandeel : ""})`).join("; ") || "onbekend"}`,
    `Wijze van waardering: ${d.wijzeVanWaardering}${d.wijzeVanWaarderingMotivering ? " — " + d.wijzeVanWaarderingMotivering : ""}`,
    `Aantal vergelijkingspunten: ${d.vergelijkingspunten.length}`,
  ];
  const docNotes = d.documenten.filter((doc) => doc.notities?.trim()).map((doc) => `- ${doc.naam}: ${doc.notities.trim()}`);
  if (docNotes.length) {
    lines.push("Juridische / administratieve documenten (kernpunten):");
    lines.push(...docNotes);
  }
  return lines.join("\n");
}

// volledig lokale, regelgebaseerde SWOT-generator — vangnet als de AI-aanroep faalt.
export function genereerAutomatischeSwot(d) {
  const eig = d.eigenschappen;
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const sterktes = [];
  const zwaktes = [];
  const kansen = [];
  const bedreigingen = [];

  // staat van het pand
  if (d.staat.includes("Instapklaar")) sterktes.push("Pand is instapklaar.");
  if (d.staat.includes("Gerenoveerd")) sterktes.push("Pand werd reeds gerenoveerd.");
  if (d.staat.includes("Nieuw")) sterktes.push(isResidentieel ? "Nieuwbouwwoning." : "Nieuwbouwpand.");
  if (d.staat.includes("Te renoveren")) { zwaktes.push("Pand is te renoveren."); kansen.push("Renovatiepotentieel naar eigen wens en smaak."); }
  if (d.staat.includes("Op te frissen")) zwaktes.push("Pand is op te frissen.");
  if (d.staat.includes("Casco (in te richten)")) { zwaktes.push("Pand is casco en dient volledig ingericht te worden."); kansen.push("Volledige vrijheid bij de inrichting."); }
  if (d.staat.includes("Af te werken")) zwaktes.push("Afwerking van het pand is nog niet voltooid.");
  if (d.staat.includes("Te slopen")) { zwaktes.push("Bestaande opstal is te slopen."); kansen.push("Perceel biedt herbouwmogelijkheden."); }

  // EPC / energie
  if (d.epcStatus === "Aanwezig" && d.epcWaarde) {
    const epc = num(d.epcWaarde);
    if (epc > 0 && epc <= 200) sterktes.push(`Gunstig EPC-label (${d.epcWaarde} kWh/m²).`);
    else if (epc > 400) zwaktes.push(`Hoog energieverbruik volgens EPC (${d.epcWaarde} kWh/m²) — renovatie aan te raden.`);
  }
  if (d.epcStatus === "Niet aanwezig") zwaktes.push("Geen geldig EPC-certificaat beschikbaar.");
  if (d.isolatie.length >= 3 && !d.isolatie.includes("Niet bepaald")) sterktes.push(`Goed geïsoleerd (${d.isolatie.join(", ").toLowerCase()}).`);
  if (d.isolatie.includes("Niet bepaald") || d.isolatie.length === 0) zwaktes.push("Isolatiegraad onbekend of niet bepaald.");
  if (d.verwarmingGrondstof.includes("Warmtepomp")) sterktes.push("Energiezuinige verwarming via warmtepomp.");
  if (d.allerlei.includes("Zonnepanelen")) sterktes.push("Voorzien van zonnepanelen.");
  if (!d.allerlei.includes("Zonnepanelen")) kansen.push("Mogelijkheid tot plaatsing van zonnepanelen.");

  // elektriciteit
  if (d.keuringStatus === "Keuring aanwezig - conform") sterktes.push("Elektrische installatie conform gekeurd.");
  if (d.keuringStatus === "Keuring aanwezig - niet conform") zwaktes.push("Elektrische installatie niet conform bevonden bij keuring.");
  if (d.keuringStatus === "Keuring niet aanwezig") zwaktes.push("Geen keuring van de elektrische installatie beschikbaar.");

  // buitenschrijnwerk
  if (d.buitenschrijnwerk.some((b) => b.includes("HR") || b.includes("3-dubbele"))) sterktes.push("Hoogrendementsbeglazing aanwezig.");
  if (d.buitenschrijnwerk.includes("Enkele beglazing")) zwaktes.push("Enkele beglazing aanwezig — energieverlies.");

  // ruimtes — residentiële ruimte-checklists (StepRuimteEigenschappen) vs. bedrijfskenmerken
  // (StepBedrijfskenmerken), naargelang vastgoedType (zie de steps-array in DossierWizard)
  if (isResidentieel) {
    if (d.slaapkamers.length >= 3) sterktes.push(`Ruim aantal slaapkamers (${d.slaapkamers.length}) — geschikt voor gezinnen.`);
    if (eig.keuken.items.includes("Volledig ingebouwd")) sterktes.push("Volledig ingebouwde keuken.");
    if (eig.tuinTerras.items.length > 0) sterktes.push(`Aangename buitenruimte (${eig.tuinTerras.items.join(", ").toLowerCase()}).`);
    if (eig.garage.items.length > 0 || num(eig.garage.aantal) > 0) sterktes.push("Garage/parkeergelegenheid aanwezig.");
    if (!eig.garage.items.length && !num(eig.garage.aantal)) kansen.push("Mogelijkheid tot aanleg van bijkomende parkeergelegenheid.");
  } else {
    if (num(d.bedrijfsParkeerplaatsen) > 0) sterktes.push(`Voldoende parkeergelegenheid aanwezig (${d.bedrijfsParkeerplaatsen} plaatsen).`);
    else kansen.push("Mogelijkheid tot uitbreiding van het aantal parkeerplaatsen.");
    if (num(d.bedrijfsLaadkades) > 0) sterktes.push(`Laadkades aanwezig (${d.bedrijfsLaadkades}) — geschikt voor logistieke activiteiten.`);
    if (d.bedrijfsVergunningMilieu && d.bedrijfsVergunningMilieu.startsWith("Aanwezig")) sterktes.push(`Omgevingsvergunning milieu reeds aanwezig (${d.bedrijfsVergunningMilieu.toLowerCase()}).`);
    if (d.bedrijfsVergunningMilieu === "In aanvraag") bedreigingen.push("Omgevingsvergunning milieu nog in aanvraag.");
    if (d.vastgoedType === "Bedrijfsvastgoed" && d.bedrijfsSubtype === "Industrieel/logistiek" && num(d.industrieelVrijeHoogte) >= 8) {
      sterktes.push(`Ruime vrije hoogte (${d.industrieelVrijeHoogte} m) — geschikt voor stapeling/racking.`);
    }
  }

  // ligging & bereikbaarheid
  if (d.mobiscore && num(d.mobiscore) >= 7) sterktes.push(`Uitstekende mobiscore (${d.mobiscore}/10) — vlot bereikbaar te voet/fiets/OV.`);
  if (d.mobiscore && num(d.mobiscore) < 4) zwaktes.push(`Beperkte mobiscore (${d.mobiscore}/10) — minder vlot bereikbaar zonder wagen.`);
  if (d.omgevingsvoorzieningen) sterktes.push("Goede nabijheid van voorzieningen in de omgeving.");

  // markt
  if (d.aanbodTeKoop === "Nihil" || d.aanbodTeKoop === "Sporadisch") sterktes.push("Beperkt aanbod van vergelijkbare panden in de omgeving.");
  if (d.aanbodTeKoop === "Ruim") bedreigingen.push("Ruim aanbod van vergelijkbare panden kan de verkoopbaarheid beïnvloeden.");
  if (d.verkoopbaarheid === "Zeer goed" || d.verkoopbaarheid === "Goed") sterktes.push("Goede verkoopbaarheid van het pand.");
  if (d.verkoopbaarheid === "Matig" || d.verkoopbaarheid === "Slecht") zwaktes.push("Beperkte verkoopbaarheid van het pand.");

  // stedenbouw & juridisch
  if (d.gewestplan === "Woonuitbreidingsgebied") kansen.push("Ligging in woonuitbreidingsgebied biedt mogelijke ontwikkelingskansen.");
  if (d.erfgoed === "Ja") bedreigingen.push("Erfgoedstatus kan verbouwings- of renovatiemogelijkheden beperken.");
  if (d.voorkooprecht === "Ja") bedreigingen.push("Voorkooprecht van toepassing — kan het verkoopproces beïnvloeden.");
  if (d.bouwmisdrijven === "Ja") bedreigingen.push("Mogelijke bouwovertreding vastgesteld op het perceel.");
  if (d.vergunning === "Nee") bedreigingen.push("Geen stedenbouwkundige vergunning teruggevonden voor het pand.");
  if (["C", "D"].includes(d.watertoetsP) || ["C", "D"].includes(d.watertoetsG)) bedreigingen.push("Verhoogd overstromingsrisico volgens de watertoets.");
  if (d.watertoetsP === "A" && d.watertoetsG === "A") sterktes.push("Geen overstromingsrisico volgens de watertoets.");

  // grond
  if (num(d.grondopp) > 0 && num(d.bebouwdeOpp) > 0 && num(d.grondopp) > num(d.bebouwdeOpp) * 3) {
    kansen.push("Ruim perceel ten opzichte van de bebouwde oppervlakte — mogelijke uitbreidings- of verkavelingskansen.");
  }

  // documentnotities
  const docNotes = d.documenten.filter((doc) => doc.notities?.trim());
  if (docNotes.length) {
    bedreigingen.push(`Bijzondere aandachtspunten uit de opgeladen documenten: ${docNotes.map((doc) => doc.notities.trim().split(/[.\n]/)[0]).join("; ")}.`);
  }

  return { sterktes, zwaktes, kansen, bedreigingen };
}

// haalt het antwoord op als ruwe tekst en parset die zelf — zo kunnen we bij een parseerfout
// altijd de werkelijke inhoud van het antwoord tonen, in plaats van een lege foutmelding.
// Loopt via /api/claude (zie api/claude.js) in plaats van rechtstreeks naar Anthropic: die
// serverless functie voegt de geheime ANTHROPIC_API_KEY toe, die nooit in de browser mag staan.
async function fetchClaudeJson(body, attempt = 1) {
  const token = await haalSessieToken();
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const raw = await response.text();

  // een status 200 met een écht leeg antwoord wijst op een tijdelijke hapering in het netwerk
  // (niet op een fout in de aanvraag) — dat proberen we automatisch één keer opnieuw.
  if (!raw && attempt < 3) {
    await new Promise((r) => setTimeout(r, 600 * attempt));
    return fetchClaudeJson(body, attempt + 1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Server gaf geen geldige JSON terug (status ${response.status}) na ${attempt} poging(en): ${raw.slice(0, 300) || "(leeg antwoord)"}`);
  }
  if (!response.ok || data.type === "error") {
    const detail = data?.error?.message || data?.error?.type || JSON.stringify(data).slice(0, 300);
    throw new Error(`${detail} (status ${response.status})`);
  }
  return data;
}

export async function callClaudeWithSearch(prompt) {
  const data = await fetchClaudeJson({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });
  const text = (data.content || []).map((b) => b.text || "").join("\n");
  return text.replace(/```json|```/g, "").trim();
}

// haalt een JSON-object uit de AI-tekst, ook als er (ondanks instructie) nog wat proza omheen staat
export function extractJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { /* val door */ }
    }
    throw new Error("Kon het AI-antwoord niet verwerken");
  }
}

// Zet een aantal courante, cryptische AI/API-foutmeldingen om naar een duidelijke, bruikbare
// melding — gebruikt in de catch-blokken rond callClaudeWithDocs (documenten-uitlezen, plan-
// uitlezen, SWOT-voorstel), waar dit soort fouten typisch opduiken. Onbekende fouten komen
// gewoon ongewijzigd door, zodat er nooit informatie verloren gaat.
export function duidAiDocFout(e) {
  const msg = e?.message || "";
  if (/maximum of \d+ pdf pages/i.test(msg)) {
    return "een van de documenten (of de documenten samen) telt te veel pagina's voor AI-uitlezing (max. 100 pagina's per aanvraag) — verwijder overbodige pagina's, splits het bestand, of selecteer tijdelijk minder documenten tegelijk";
  }
  if (/credit balance is too low/i.test(msg)) {
    return "onvoldoende AI-tegoed — vul dit aan via Plans & Billing op console.anthropic.com";
  }
  return msg || "onbekende fout";
}

// Laadt een document PERMANENT op naar de private Storage-bucket "dossier-bijlagen" (zelfde
// bucket/toegangsregels als de tijdelijke AI-analyse-/PDF-render-uploads hieronder), i.p.v. het
// als base64 in de dossier-data zelf te bewaren (zie addDocumenten/pAddDocumenten in
// DossierWizard). Nodig sinds een gewoon document (bv. een uitgebreide vastgoedinfo-bundel of een
// scherpe foto van een grondplan) al snel enkele tot tientallen MB kan wegen — rechtstreeks als
// base64 in de "media"-kolom zou élke opslagbeurt van het volledige dossier even zwaar maken,
// ongeacht of er verder iets wijzigde, en liep zo tegen de tijdslimiet van de database aan (zie
// _saveDossierPoging hieronder). We bewaren voortaan enkel het pad; bij effectief gebruik (AI-
// analyse) wordt telkens een kortlevende signed URL aangemaakt via haalDocumentUrl.
export async function uploadDocumentNaarStorage(file, dossierId, docId) {
  const ext = (file.name || "").split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
  const pad = `${dossierId || "onbekend"}/documenten/${docId}.${ext}`;
  const { error } = await supabase.storage.from("dossier-bijlagen").upload(pad, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`Kon document niet opladen: ${error.message}`);
  return pad;
}
async function haalDocumentUrl(pad, geldigheidSec = 120) {
  const { data, error } = await supabase.storage.from("dossier-bijlagen").createSignedUrl(pad, geldigheidSec);
  if (error) throw new Error(`Kon geen link maken naar document: ${error.message}`);
  return data.signedUrl;
}

// laadt één document tijdelijk op naar de private Supabase Storage-bucket "dossier-bijlagen"
// en geeft er een kortlevende signed URL van terug. Nodig omdat een PDF rechtstreeks als
// base64 meesturen in de AI-aanvraag tegen Vercel's vaste limiet van 4,5MB per aanvraag
// aanloopt (FUNCTION_PAYLOAD_TOO_LARGE) — de serverless functie haalt het document zelf op
// via die URL, wat niet onder diezelfde inkomende-aanvraaglimiet valt.
async function uploadDocVoorAnalyse(doc, dossierId) {
  // een document dat al permanent in Storage staat (zie uploadDocumentNaarStorage hierboven) hoeft
  // niet nog eens als tijdelijke kopie geüpload te worden — enkel een signed URL van het bestaande
  // pad is dan nodig, en "pad" hieronder wijst bewust niet naar een ai-analyse/-map, zodat de
  // opruiming in callClaudeWithDocs dit permanente bestand nooit per ongeluk verwijdert.
  if (doc.pad) {
    const url = await haalDocumentUrl(doc.pad, 120);
    return { url, mediaType: doc.mediaType || "application/pdf", pad: null };
  }
  // base64 kan door de dataURL-omzetting soms newlines/witruimte bevatten — die strippen we eerst.
  const schoneBase64 = (doc.base64 || "").replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(schoneBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: doc.mediaType || "application/pdf" });
  const pad = `${dossierId || "onbekend"}/ai-analyse/${Date.now()}-${uid()}.pdf`;
  const { error: upErr } = await supabase.storage.from("dossier-bijlagen").upload(pad, blob, {
    contentType: doc.mediaType || "application/pdf",
    upsert: true,
  });
  if (upErr) throw new Error(`Kon document niet tijdelijk opladen: ${upErr.message}`);
  const { data: signed, error: signErr } = await supabase.storage.from("dossier-bijlagen").createSignedUrl(pad, 120);
  if (signErr) throw new Error(`Kon geen tijdelijke link maken: ${signErr.message}`);
  return { url: signed.signedUrl, mediaType: doc.mediaType || "application/pdf", pad };
}

// zelfde patroon/reden als uploadDocVoorAnalyse hierboven, maar dan voor een foto/voorpaginaFoto
// die in het PDF-rapport verschijnt: bij dossiers met veel foto's zou de volledige HTML (met alle
// base64-afbeeldingen erin) anders Vercel's vaste 4,5MB-aanvraaglimiet overschrijden bij het
// aanroepen van /api/generate-pdf (FUNCTION_PAYLOAD_TOO_LARGE / status 413) — zie handlePrintPdf
// in StepRapport, die deze functie enkel gebruikt wanneer de opgebouwde HTML te groot dreigt te
// worden, niet bij elke afdruk.
export async function uploadFotoVoorPdf(foto, dossierId) {
  const dataUrl = foto.base64 || "";
  const mediaType = dataUrl.match(/^data:([^;]+);base64,/)?.[1] || "image/jpeg";
  const schoneBase64 = dataUrl.replace(/^data:[^;]+;base64,/, "").replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(schoneBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mediaType });
  const ext = mediaType.split("/")[1] || "jpg";
  const pad = `${dossierId || "onbekend"}/pdf-render/${Date.now()}-${uid()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("dossier-bijlagen").upload(pad, blob, {
    contentType: mediaType,
    upsert: true,
  });
  if (upErr) throw new Error(`Kon foto niet tijdelijk opladen: ${upErr.message}`);
  const { data: signed, error: signErr } = await supabase.storage.from("dossier-bijlagen").createSignedUrl(pad, 180);
  if (signErr) throw new Error(`Kon geen tijdelijke link maken: ${signErr.message}`);
  return { url: signed.signedUrl, pad };
}

// stuurt de opgeladen PDF's als bijlage mee naar Claude, via een tijdelijke Storage-link
// (zie uploadDocVoorAnalyse hierboven) in plaats van rechtstreeks als base64 in de aanvraag.
// Gebruikt bewust het veel goedkopere Haiku-model i.p.v. Sonnet (zie callClaudeWithSearch
// hierboven, dat wél Sonnet gebruikt): dit zijn stuk voor stuk eenvoudige, sterk gestructureerde
// uitlees-/samenvattingstaken (velden uit een document halen, oppervlaktes van een grondplan,
// een SWOT-voorstel op basis van al ingevulde paneelgegevens) zonder nood aan het zwaarste model.
export async function callClaudeWithDocs(pdfDocs, promptText, dossierId) {
  const uploads = await Promise.all(pdfDocs.map((doc) => uploadDocVoorAnalyse(doc, dossierId)));
  let data;
  try {
    data = await fetchClaudeJson({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      documentUrls: uploads.map(({ url, mediaType }) => ({ url, mediaType })),
      promptText,
    });
  } finally {
    // opruimen: enkel de effectief tijdelijke bestanden (om de 4,5MB-aanvraaglimiet te omzeilen) —
    // een permanent document (doc.pad, zie uploadDocumentNaarStorage) geeft hierboven bewust
    // pad: null terug, zodat het hier nooit meeverwijderd wordt.
    const tijdelijkePaden = uploads.map((u) => u.pad).filter(Boolean);
    if (tijdelijkePaden.length) supabase.storage.from("dossier-bijlagen").remove(tijdelijkePaden).catch(() => {});
  }
  const text = (data.content || []).map((b) => b.text || "").join("\n");
  return text.replace(/```json|```/g, "").trim();
}
