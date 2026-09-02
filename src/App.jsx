import React, { useState, useRef, useEffect, useContext } from "react";
import {
  Home, MapPin, Ruler, Building2, Trees, Hammer, LineChart, ClipboardList,
  Grid3x3, Calculator, FileText, Plus, Trash2, ChevronLeft, ChevronRight,
  Check, AlertTriangle, Image as ImageIcon, Paperclip, Upload, X, Sparkles,
  Loader2, Layers, Flame, Sofa, Users, BedDouble, Camera, Download, Settings, RefreshCw
} from "lucide-react";
import {
  INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, BRASS, BRASS_SOFT, STAMP, STAMP_SOFT, DANGER,
  HUYZEN_BLAUW, HUYZEN_LOGO_B64, HUISSTIJLEN, kiesHuisstijl, HuisstijlContext,
  KLASSEN, ABEX_INDEX_1998, GEVEL_FACTOR, VERDIEPINGEN, OPTS, RUIMTE_CHECKLISTS,
  emptyRoomState, initialData, maakLeegPand,
} from "./constants.js";
import {
  num, epcRichtwaardePct, eur, pct, nlDate, uid, dash, joinOrDash, unit, isEmptyVal, wEsc,
} from "./lib/format.js";
import {
  isJpegFile, resizeImageBlob, resizeImageBlobBinnenBudget, schatBase64Bytes,
  berekenPandBijlageBytes, fmtMB, EIGEN_OPSLAG_ORIGIN, veiligeAfbeeldingSrc,
} from "./lib/afbeeldingen.js";
import {
  berekenParkeerplaatsenTotaal, berekenWaardering, useCalc,
  rapportVergelijkingspuntRijen, rapportWaarderingsBlokken, rapportVenaleWaardeZin,
} from "./domein/waardering.js";
import { supabase, haalSessieToken } from "./data/supabase.js";
import {
  login, registreer, stuurBevestigingOpnieuw, vraagWachtwoordResetAan, stelNieuwWachtwoordIn,
  uitloggen, haalHuidigeGebruiker, haalProfiel, updateProfiel,
} from "./data/auth.js";

// Google Maps Static API-sleutel — sinds Google geen sleutelloze toegang meer toelaat, MOET deze
// ingesteld zijn (Vercel: Settings → Environment Variables → VITE_GOOGLE_MAPS_API_KEY, lokaal: in
// .env) anders blijft de liggingskaart (zowel in de wizard als in het verslag) leeg. Zie de
// meegeleverde instructies voor hoe je zo'n sleutel gratis aanmaakt.
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
// bouwt een statische kaartafbeelding (Google Static Maps) rond het opgegeven adres — gedeeld
// door zowel de wizard-voorvertoning (StepOpdracht) als het verslag zelf (buildReportData/
// StepRapport), zodat beide altijd exact dezelfde kaart tonen.
const buildStaticMapUrl = (adres, { width = 640, height = 300, scale = 2, zoom = 16 } = {}) =>
  `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(adres)}&zoom=${zoom}&size=${width}x${height}&scale=${scale}&maptype=roadmap&markers=color:0x8C6A2F%7C${encodeURIComponent(adres)}&key=${GOOGLE_MAPS_API_KEY}`;

// CadGIS/kadasterkaart — gratis, publieke WFS/WMS-dienst van Informatie Vlaanderen (Adpf =
// "Administratieve percelen fiscaal"), geen API-sleutel nodig (in tegenstelling tot Google Maps
// hierboven). In stappen: (1) fetchCadgisPerceel zoekt via een CQL-filter op CAPAKEY de
// perceelsgeometrie op via WFS — daaruit wordt zowel een (licht opgevulde) bounding box als de
// buitenrand(en) van het perceel zelf bewaard (zie cadgisBbox/cadgisRingen/
// cadgisCapakeyOpgezocht in initialData) zodat het verslag zelf (buildReportData/StepRapport)
// nadien gewoon kant-en-klare waarden heeft, zonder zelf nog een live opzoeking te moeten doen —
// hetzelfde patroon als voorpaginaFoto/fotos, die ook al vooraf (tijdens het invullen) opgelost
// worden. (2) buildCadgisMapUrl bouwt op basis van die bbox de kale kaartafbeelding via een
// gewone WMS GetMap-aanvraag (Adpf = perceelvlakken, GrAdpf = perceelsgrenzen, LblAdpf =
// perceelnummers) — dit toont alle percelen in de omgeving, zonder onderscheid. (3) fixBboxAspect
// + bboxToPixelPunten + CadgisKaart/buildCadgisKaartHtml tonen daarbovenop het opgezochte perceel
// zelf gemarkeerd — een aparte, door de server aangeleverde stijl per perceel (SLD_BODY) bleek
// niet mogelijk: deze WMS-dienst weigert die expliciet (geteste, bevestigde serverfout), dus wordt
// de markering hier zelf getekend (als een <svg>-veelhoek bovenop de kale kaartafbeelding), aan de
// hand van de eigen perceelsgeometrie uit de WFS-opzoeking.
async function fetchCadgisPerceel(capakey) {
  // .toUpperCase(): CAPAKEY-waarden in deze dataset staan altijd in hoofdletters — dit maakt de
  // opzoeking ongevoelig voor hoe de gebruiker de CaPaKey zelf intypte
  const key = (capakey || "").trim().toUpperCase();
  if (!key) return null;
  const url = `https://geo.api.vlaanderen.be/Adpf/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=Adpf&outputFormat=application/json&CQL_FILTER=${encodeURIComponent(`CAPAKEY='${key}'`)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const feature = json?.features?.[0];
  if (!feature?.geometry?.coordinates) return null;
  // buitenrand(en) van het perceel (het eerste ring van elke polygoon — eventuele "gaten" in het
  // perceel worden genegeerd, die komen bij een gewoon kadastraal perceel zo goed als nooit voor,
  // en zelfs dan blijft een volle markering zonder uitsparing prima leesbaar)
  const geom = feature.geometry;
  const ringen = geom.type === "Polygon" ? [geom.coordinates[0]]
    : geom.type === "MultiPolygon" ? geom.coordinates.map((poly) => poly[0])
    : [];
  if (!ringen.length) return null;
  const punten = ringen.flat();
  const xs = punten.map((p) => p[0]), ys = punten.map((p) => p[1]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  // ruime marge rond het perceel zodat de directe omgeving/buurpercelen ook zichtbaar zijn
  const pad = Math.max(xmax - xmin, ymax - ymin) * 0.4 + 15;
  const bbox = [xmin - pad, ymin - pad, xmax + pad, ymax + pad].join(",");
  return { bbox, ringen };
}

// breidt een bbox uit (rond hetzelfde middelpunt) tot zijn breedte/hoogte-verhouding exact gelijk
// is aan die van de gevraagde afbeelding — zonder dit rekt een WMS-server de kaart altijd
// non-uniform uit tot de opgegeven width×height, wat een zichtbaar vervormd (uitgerokken) resultaat
// geeft zodra de bbox toevallig een andere verhouding heeft dan de afbeelding.
function fixBboxAspect(bbox, width, height) {
  const [xmin, ymin, xmax, ymax] = bbox.split(",").map(Number);
  const bw = xmax - xmin, bh = ymax - ymin;
  const doelRatio = width / height, bboxRatio = bw / bh;
  if (bboxRatio > doelRatio) {
    const nieuweBh = bw / doelRatio, cy = (ymin + ymax) / 2;
    return [xmin, cy - nieuweBh / 2, xmax, cy + nieuweBh / 2].join(",");
  }
  if (bboxRatio < doelRatio) {
    const nieuweBw = bh * doelRatio, cx = (xmin + xmax) / 2;
    return [cx - nieuweBw / 2, ymin, cx + nieuweBw / 2, ymax].join(",");
  }
  return bbox;
}
const buildCadgisMapUrl = (bbox, { width = 640, height = 300 } = {}) =>
  `https://geo.api.vlaanderen.be/Adpf/wms?service=WMS&version=1.3.0&request=GetMap&layers=Adpf,GrAdpf,LblAdpf&styles=,,&bbox=${encodeURIComponent(fixBboxAspect(bbox, width, height))}&width=${width}&height=${height}&crs=EPSG:31370&format=image/png&transparent=false`;

// zet één ring (lijst [x,y]-punten in EPSG:31370) om naar SVG-polygoonpunten in beeldpixels, op
// basis van dezelfde (aspect-gecorrigeerde) bbox als de WMS-afbeelding zelf — anders zou de
// markering niet exact boven het perceel op de afbeelding vallen. Y wordt gespiegeld: een bbox telt
// van onder (ymin) naar boven (ymax), een afbeelding van boven (0) naar onder (height).
const bboxNaarPixelPunten = (ring, fixedBbox, width, height) => {
  const [xmin, ymin, xmax, ymax] = fixedBbox.split(",").map(Number);
  return ring.map(([x, y]) => {
    const px = ((x - xmin) / (xmax - xmin)) * width;
    const py = height - ((y - ymin) / (ymax - ymin)) * height;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(" ");
};
// gedeelde markeringskleur/-stijl voor het gemarkeerde perceel, gebruikt door zowel CadgisKaart
// (React, hieronder) als buildCadgisKaartHtml (print/PDF, zie buildReportData)
const cadgisMarkeringSvg = (ringen, fixedBbox, width, height) =>
  (ringen || []).map((ring) =>
    `<polygon points="${bboxNaarPixelPunten(ring, fixedBbox, width, height)}" fill="#8C6A2F" fill-opacity="0.32" stroke="#8C6A2F" stroke-width="3" />`
  ).join("");
// React-component: kale WMS-kaart + het opgezochte perceel zelf gemarkeerd erbovenop (zie
// toelichting hierboven) — gedeeld door StepOpdracht (invoerstap) en StepRapport (voorvertoning).
function CadgisKaart({ bbox, ringen, width = 640, height = 300, style }) {
  if (!bbox) return null;
  const fixedBbox = fixBboxAspect(bbox, width, height);
  return (
    <div style={{ position: "relative", overflow: "hidden", ...style }}>
      <img src={buildCadgisMapUrl(bbox, { width, height })} alt="Kadasterkaart" style={{ width: "100%", display: "block" }} />
      {ringen?.length > 0 && (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          dangerouslySetInnerHTML={{ __html: cadgisMarkeringSvg(ringen, fixedBbox, width, height) }} />
      )}
    </div>
  );
}
// print/PDF-tegenhanger van CadgisKaart hierboven (bouwt een kant-en-klare HTML-string i.p.v. een
// React-component, zoals de rest van buildReportData al doet) — zie de toelichting bovenaan.
function buildCadgisKaartHtml(bbox, ringen, { width = 640, height = 300 } = {}) {
  if (!bbox) return "";
  const fixedBbox = fixBboxAspect(bbox, width, height);
  const markering = ringen?.length ? cadgisMarkeringSvg(ringen, fixedBbox, width, height) : "";
  return `<div style="position:relative;width:100%;max-width:520px;display:block;border:1px solid #DDD8CA;border-radius:4px;overflow:hidden;margin:0 0 16px 0;">
    <img src="${buildCadgisMapUrl(bbox, { width, height })}" alt="Kadasterkaart" style="width:100%;display:block;" />
    ${markering ? `<svg viewBox="0 0 ${width} ${height}" style="position:absolute;top:0;left:0;width:100%;height:100%;">${markering}</svg>` : ""}
  </div>`;
}


// ---------- foutgrens (React error boundary) ----------
// Vangt een onverwachte render-fout ergens in de boom op (bv. een ouder dossier waarin een later
// toegevoegd veld nog ontbreekt) en toont een vriendelijke melding + herstelknop in plaats van een
// wit scherm zonder enige uitleg midden in het werk van een makelaar (zie audit, punt H6). Wordt in
// main.jsx rond <AppRoot/> gelegd.
export class FoutGrens extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fout: null };
  }
  static getDerivedStateFromError(fout) {
    return { fout };
  }
  componentDidCatch(fout, info) {
    console.error("Onverwachte fout, opgevangen door FoutGrens:", fout, info?.componentStack);
  }
  render() {
    if (!this.state.fout) return this.props.children;
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: PAPER, color: INK, fontFamily: "system-ui, sans-serif", padding: 24,
      }}>
        <div style={{
          maxWidth: 460, background: PAPER_RAISED, border: `1px solid ${LINE}`, borderRadius: 10,
          padding: 32, textAlign: "center",
        }}>
          <AlertTriangle size={32} style={{ color: DANGER, marginBottom: 12 }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Er is iets misgelopen</h1>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 20, lineHeight: 1.5 }}>
            Deze schermweergave liep vast op een onverwachte fout. Uw gegevens zijn niet verloren —
            een tussentijdse opslag gebeurt automatisch tijdens het werken. Ga terug naar het
            overzicht en probeer het opnieuw; blijft dit gebeuren, geef dan gerust door wat u net
            deed toen dit verscheen.
          </p>
          <button type="button" onClick={() => { this.setState({ fout: null }); window.location.href = "/"; }}
            style={{
              background: BRASS, color: "#fff", border: "none", borderRadius: 6,
              padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
            Terug naar overzicht
          </button>
        </div>
      </div>
    );
  }
}




// ---------- persistente opslag (Supabase, gedeeld tussen makelaars, elk dossier gekoppeld aan een ownerId) ----------
// vervangt het vroegere window.storage (dat enkel binnen Claude.ai werkte) 1-op-1 door
// echte databaseaanroepen — zie /supabase/schema.sql voor de tabellen en toegangsregels.

// een geldige uuid nodig voor id's die in de database terechtkomen (dossiers.id); de korte
// uid() hieronder blijft gebruikt voor interne rij-id's binnen een dossier (kamers, eigenaars, ...)
// die nooit als een eigen databasekolom bestaan.
const nieuweDossierId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : uid();

// login, registreer, stuurBevestigingOpnieuw, vraagWachtwoordResetAan, stelNieuwWachtwoordIn,
// uitloggen, haalHuidigeGebruiker, haalProfiel en updateProfiel verhuisden naar src/data/auth.js
// (opsplitsing stap 3).

async function loadIndex() {
  const { data, error } = await supabase
    .from("dossiers")
    .select("id, owner_id, straat, nummer, bus, postcode, gemeente, status, aangemaakt_op, laatst_bewerkt")
    .order("laatst_bewerkt", { ascending: false });
  if (error) { console.error(error); return []; }
  // voor een beheerder geeft de rijregel hierboven (RLS, zie supabase/schema.sql) de dossiers van
  // ALLE makelaars terug i.p.v. enkel de eigen — haal dan ook meteen ieders naam op, zodat het
  // Dashboard in de beheerder-weergave kan tonen van wie elk dossier is. Voor een gewone makelaar
  // bevat "data" hierboven toch al enkel de eigen dossiers (RLS), dus deze query blijft licht.
  const ownerIds = [...new Set(data.map((x) => x.owner_id))];
  let namenPerId = {};
  if (ownerIds.length) {
    const { data: profielen } = await supabase.from("profielen").select("id, naam").in("id", ownerIds);
    namenPerId = Object.fromEntries((profielen || []).map((p) => [p.id, p.naam]));
  }
  // veldnamen omzetten naar wat de React-componenten al verwachten (camelCase)
  return data.map((x) => ({
    id: x.id, ownerId: x.owner_id, makelaarNaam: namenPerId[x.owner_id] || "",
    straat: x.straat, nummer: x.nummer, bus: x.bus,
    postcode: x.postcode, gemeente: x.gemeente, status: x.status,
    aangemaaktOp: x.aangemaakt_op, laatstBewerkt: x.laatst_bewerkt,
  }));
}

async function loadDossier(id) {
  const { data, error } = await supabase.from("dossiers").select("*").eq("id", id).single();
  if (error) { console.error(error); return null; }
  // versie onthouden voor de botsingscontrole bij het opslaan (zie _saveDossierPoging)
  onthoudVerwachteVersie(id, data.laatst_bewerkt);
  // "data.data" bevat de volledige dossier-JSON (alle overige velden) — dat komt overeen
  // met wat het vroegere dossier_<id>-object in window.storage was
  // straat/nummer/bus/postcode/gemeente/aangemaakt_op staan als aparte kolommen in de tabel
  // (niet in de JSON-blob, want saveDossier haalt ze expliciet uit "rest") — dus die moeten
  // hier terug worden meegegeven, anders vallen ze terug op de lege standaardwaarde uit
  // initialData: het adres lijkt dan "vergeten" bij het heropenen van een dossier, en
  // aangemaaktOp als lege string doet elke volgende opslagpoging falen met
  // "invalid input syntax for type timestamp with time zone: ''"
  // "data.media" (fotos/documenten/voorpaginaFoto) staat sinds de bandbreedte-optimalisatie in
  // saveDossier() in een aparte kolom — na "...data.data" gespreid zodat oudere dossiers (van
  // vóór die migratie, met fotos/documenten nog inline in "data.data") gewoon blijven werken
  // zolang de "media"-kolom voor dat dossier nog leeg is
  return {
    ...data.data,
    ...(data.media || {}),
    id: data.id,
    ownerId: data.owner_id,
    status: data.status,
    aangemaaktOp: data.aangemaakt_op,
    straat: data.straat,
    nummer: data.nummer,
    bus: data.bus,
    postcode: data.postcode,
    gemeente: data.gemeente,
  };
}

// onthoudt, per dossier-id, of de laatst effectief opgeslagen foto/document-inhoud (na het
// wissen van de tijdelijke blob-url) intussen gewijzigd is — zo kan saveDossier() de zware
// "media"-kolom overslaan wanneer enkel een gewoon tekstveld wijzigde, in plaats van bij élke
// autosave opnieuw alle foto's/documenten (soms meerdere MB aan base64) naar de database te
// sturen. We bewaren enkel een korte hash (zie eenvoudigeHash), nooit de volledige media-JSON
// zelf — die kan immers precies de meerdere MB groot zijn die we net niet nog eens willen
// vasthouden. Naast het in-memory-geheugen van deze paginasessie staat dezelfde hash ook in
// sessionStorage: zo hoeft een gewone paginaherlaad niet meer automatisch de volledige media
// opnieuw te versturen als die sinds de laatste succesvolle opslag niet gewijzigd is — belangrijk
// juist voor een dossier met veel foto's/documenten, waar zo'n overbodige herverzending net het
// verschil kan maken tussen een opslagbeurt die binnen de tijdslimiet blijft of niet.
const _laatstOpgeslagenMedia = new Map();
// eenvoudige, snelle hash (geen cryptografische sterkte nodig, enkel wijzigingsdetectie)
function eenvoudigeHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return `${h.toString(36)}:${str.length}`;
}
function haalLaatstOpgeslagenMediaHash(id) {
  if (_laatstOpgeslagenMedia.has(id)) return _laatstOpgeslagenMedia.get(id);
  try {
    return sessionStorage.getItem(`dossier_media_hash_${id}`) || undefined;
  } catch {
    return undefined; // sessionStorage niet beschikbaar (bv. privénavigatie) — gewoon zonder verder
  }
}
function onthoudLaatstOpgeslagenMediaHash(id, hash) {
  _laatstOpgeslagenMedia.set(id, hash);
  try { sessionStorage.setItem(`dossier_media_hash_${id}`, hash); } catch {}
}

// Welke versie van een dossier deze browser als "de zijne" beschouwt: de waarde van
// laatst_bewerkt op het moment van inladen of van de laatste geslaagde opslagbeurt. Wordt gebruikt
// voor de botsingscontrole in _saveDossierPoging — zie de toelichting daar.
const _verwachteVersie = new Map();
function haalVerwachteVersie(id) { return _verwachteVersie.get(id); }
function onthoudVerwachteVersie(id, versie) { if (versie) _verwachteVersie.set(id, versie); }
function vergeetVerwachteVersie(id) { _verwachteVersie.delete(id); }

// De rij zoals het dossieroverzicht ze verwacht (camelCase) — gedeeld door beide opslagpaden.
function bouwIndexMeta(dossier, laatstBewerkt) {
  return {
    id: dossier.id, ownerId: dossier.ownerId, straat: dossier.straat, nummer: dossier.nummer,
    bus: dossier.bus, postcode: dossier.postcode, gemeente: dossier.gemeente,
    status: dossier.status, aangemaaktOp: dossier.aangemaaktOp,
    laatstBewerkt: laatstBewerkt || new Date().toISOString(),
  };
}

async function saveDossier(dossier, index, setIndex) {
  try {
    return await _saveDossierPoging(dossier, index, setIndex);
  } catch (e) {
    // vangt netwerkfouten op (bv. wifi wegviel op een tablet) die supabase-js niet als
    // "{ error }" teruggeeft maar als een echte "throw" — zonder deze try/catch zou zo'n
    // opslagpoging stilzwijgend verdwijnen, zonder dat de gebruiker of de rest van de app
    // ooit te weten komt dat de wijziging niet bewaard werd
    console.error("Opslaan mislukt (netwerk):", e);
    return { ok: false, error: "Geen verbinding — controleer je internetverbinding. Je wijzigingen blijven zichtbaar op dit toestel, maar zijn nog niet bewaard." };
  }
}
async function _saveDossierPoging(dossier, index, setIndex) {
  // de tijdelijke blob-url (url) kan niet persisteren over sessies heen en wordt dus niet
  // bewaard — de base64-data (verkleind bij het opladen) blijft wél bewaard, want zonder die
  // data verdwijnen de foto's definitief uit zowel de app-voorbeelden als het rapport zodra een
  // dossier wordt opgeslagen en later heropend. Foto's/documenten blijven, net als vroeger, als
  // base64 bewaard, maar sinds de "media"-kolom (zie migratie-instructies) in een aparte kolom
  // los van de rest van de dossier-data — zo hoeft een gewone tekstwijziging niet telkens alle
  // foto's/documenten opnieuw mee te sturen.
  const { id, ownerId, straat, nummer, bus, postcode, gemeente, status, aangemaaktOp, fotos, documenten, voorpaginaFoto, ...rest } = dossier;
  // extraPanden (zie extraPanden/maakLeegPand) blijft, anders dan het hoofdpand hierboven, gewoon
  // in "rest"/"data" zitten (bewust geen eigen "media"-optimalisatie voor élk pand — dat zou het
  // laad-/opslagpad nog complexer maken voor iets wat pas relevant wordt bij een dossier met veel
  // panden én veel foto's per pand). Wél nog steeds nodig: dezelfde tijdelijke-blob-url-opkuis als
  // bij het hoofdpand — zonder die opkuis zou elk pand-foto na het heropenen van het dossier een
  // gebroken afbeelding tonen (de blob-url overleeft geen paginaherlaad, en "url || base64" in de
  // weergave zou dan de kapotte url gebruiken i.p.v. terug te vallen op de nog geldige base64).
  if (rest.extraPanden && rest.extraPanden.length) {
    rest.extraPanden = rest.extraPanden.map((p) => ({
      ...p,
      fotos: (p.fotos || []).map(({ url, ...r }) => r),
    }));
  }
  const media = {
    fotos: (fotos || []).map(({ url, ...r }) => r),
    // documenten hebben geen tijdelijke blob-url (die wordt enkel bij PDF's intern gebruikt voor
    // de AI-analyse-upload, niet als veld op het object zelf) — dus base64 hier NIET stripping,
    // anders verdwijnt de PDF-inhoud bij het heropenen van een dossier, terwijl "PDF gereed voor
    // AI-uitlezing" en "Gegevens automatisch invullen" net op die base64 steunen
    documenten: documenten || [],
    voorpaginaFoto: voorpaginaFoto ? (({ url, ...r }) => r)(voorpaginaFoto) : null,
  };
  const mediaJson = JSON.stringify(media);
  const mediaHash = eenvoudigeHash(mediaJson);
  const mediaGewijzigd = haalLaatstOpgeslagenMediaHash(id) !== mediaHash;

  const basisPayload = {
    id,
    owner_id: ownerId,
    straat: straat || "",
    nummer: nummer || "",
    bus: bus || "",
    postcode: postcode || "",
    gemeente: gemeente || "",
    status: status || "concept",
    aangemaakt_op: aangemaaktOp,
    data: rest,
  };
  // ---- botsingscontrole ----
  // Twee mensen in hetzelfde dossier (bv. de eigenaar én een beheerder, die daar volgens de
  // toegangsregels mag werken) overschreven elkaar voordien geruisloos: de laatste opslagbeurt won,
  // zonder melding aan wie dan ook. We schrijven daarom voorwaardelijk weg: enkel als de rij nog
  // exact de versie is die wij hebben ingeladen. Is dat niet zo, dan wordt er NIETS overschreven en
  // krijgt de gebruiker een duidelijke melding.
  // Bewust defensief: kennen we de verwachte versie niet (nieuw dossier, of na een paginaherlaad),
  // dan valt de code terug op het oude, onvoorwaardelijke gedrag — opslaan mag nooit vastlopen door
  // deze controle zelf.
  const verwachteVersie = haalVerwachteVersie(id);
  const payload = mediaGewijzigd ? { ...basisPayload, media } : basisPayload;
  if (verwachteVersie) {
    const { data: bijgewerkt, error: updateFout } = await supabase
      .from("dossiers").update(payload).eq("id", id).eq("laatst_bewerkt", verwachteVersie).select("laatst_bewerkt");
    if (!updateFout && Array.isArray(bijgewerkt) && bijgewerkt.length === 0) {
      // niets bijgewerkt: ofwel is de rij intussen door iemand anders gewijzigd, ofwel bestaat ze
      // niet meer. Even nakijken wélk van de twee, want enkel het eerste is een echte botsing.
      const { data: huidig } = await supabase.from("dossiers").select("laatst_bewerkt").eq("id", id).maybeSingle();
      if (huidig) {
        return {
          ok: false,
          conflict: true,
          error: "Dit dossier is intussen door iemand anders gewijzigd. Je wijzigingen zijn NIET opgeslagen — herlaad de pagina om de recentste versie te zien voor je verder werkt.",
        };
      }
      vergeetVerwachteVersie(id); // rij bestaat niet meer: hieronder gewoon opnieuw aanmaken
    } else if (!updateFout && Array.isArray(bijgewerkt) && bijgewerkt.length > 0) {
      onthoudVerwachteVersie(id, bijgewerkt[0].laatst_bewerkt);
      if (mediaGewijzigd) onthoudLaatstOpgeslagenMediaHash(id, mediaHash);
      // net als het pad hieronder ook het dossieroverzicht bijwerken, anders blijft bv. een
      // gewijzigd adres daar op de oude waarde staan
      const meta = bouwIndexMeta(dossier, bijgewerkt[0].laatst_bewerkt);
      setIndex(index.some((x) => x.id === meta.id) ? index.map((x) => (x.id === meta.id ? meta : x)) : [...index, meta]);
      return { ok: true };
    }
    // bij een fout (bv. de media-kolom bestaat nog niet) valt de code door naar de upsert hieronder
  }

  let { error } = await supabase.from("dossiers").upsert(
    mediaGewijzigd ? { ...basisPayload, media } : basisPayload
  );
  // valt terug op het oude gedrag (media mee in de "data"-kolom) zolang de "media"-kolom nog
  // niet bestaat in Supabase (bv. de migratie is nog niet uitgevoerd) — zo blijft opslaan altijd
  // werken, ongeacht de volgorde waarin code-deploy en databasemigratie gebeuren.
  if (error && /media/i.test(error.message || "") && mediaGewijzigd) {
    ({ error } = await supabase.from("dossiers").upsert({ ...basisPayload, data: { ...rest, ...media } }));
  }
  if (error) {
    console.error("Opslaan mislukt:", error.message);
    // een grote PDF/foto (bv. een uitgebreide RealSmart-bundel of een scherpe grondplan-foto) kan
    // de toegestane omvang van één opslagbeurt overschrijden, of gewoon te lang duren om weg te
    // schrijven — Postgres/Supabase breekt zo'n te trage opslagbeurt zelf af met "canceling
    // statement due to statement timeout" (geen "te groot"-foutmelding, maar in de praktijk
    // meestal dezelfde oorzaak). Dit geeft de gebruiker in beide gevallen een duidelijke,
    // herkenbare melding in plaats van dat het document en de eruit gehaalde gegevens stilzwijgend
    // verdwijnen.
    const teGroot = /too large|payload|exceed|size|request entity|timeout/i.test(error.message || "");
    return {
      ok: false,
      error: teGroot
        ? "Opslaan mislukt: een bijlage (foto of document) is te groot, of het opslaan duurde te lang. Verklein het bestand (bv. via een online PDF-compressor, of een scherpere foto opnieuw nemen met minder detail) en probeer opnieuw."
        : `Opslaan mislukt: ${error.message}`,
    };
  }
  if (mediaGewijzigd) onthoudLaatstOpgeslagenMediaHash(id, mediaHash);
  // versie ophalen zodat de VOLGENDE opslagbeurt wél voorwaardelijk kan schrijven (botsingscontrole
  // hierboven) — een mislukte leesbeurt is niet erg: dan blijft het gedrag zoals het altijd was
  const { data: naSchrijven } = await supabase.from("dossiers").select("laatst_bewerkt").eq("id", id).maybeSingle();
  if (naSchrijven?.laatst_bewerkt) onthoudVerwachteVersie(id, naSchrijven.laatst_bewerkt);
  const meta = bouwIndexMeta(dossier, naSchrijven?.laatst_bewerkt);
  const next = index.some((x) => x.id === meta.id) ? index.map((x) => (x.id === meta.id ? meta : x)) : [...index, meta];
  setIndex(next);
  return { ok: true };
}
// Alle bestanden van één dossier uit Storage halen. Dit MOET gebeuren vóór de dossierrij zelf
// verdwijnt: de toegangsregels op de bucket controleren of het bijhorende dossier nog bestaat (zie
// supabase/schema.sql), dus zodra de rij weg is, zijn de bestanden voor niemand nog leesbaar of
// verwijderbaar — ze bleven permanent achter, mét persoonsgegevens (aktes, attesten), terwijl de
// privacyverklaring in de app belooft dat alles definitief gewist wordt.
async function verwijderDossierBestanden(dossierId) {
  const paden = [];
  const mappen = ["", "/documenten", "/fotos", "/ai-analyse", "/pdf-render"];
  for (const submap of mappen) {
    const { data, error } = await supabase.storage.from("dossier-bijlagen").list(`${dossierId}${submap}`, { limit: 1000 });
    if (error || !data) continue;
    data.forEach((item) => {
      // een "map" komt terug zonder id; enkel echte bestanden verwijderen
      if (item.id) paden.push(`${dossierId}${submap}/${item.name}`.replace(/\/\//g, "/"));
    });
  }
  if (paden.length === 0) return { ok: true, aantal: 0 };
  const { error } = await supabase.storage.from("dossier-bijlagen").remove(paden);
  if (error) return { ok: false, error: error.message };
  return { ok: true, aantal: paden.length };
}

async function deleteDossier(id, index, setIndex) {
  // eerst de bijlagen, dan pas de rij — zie verwijderDossierBestanden hierboven
  const bestanden = await verwijderDossierBestanden(id);
  if (!bestanden.ok) {
    console.error("Bijlagen verwijderen mislukt:", bestanden.error);
    return { ok: false, error: `De bijlagen van dit dossier konden niet verwijderd worden (${bestanden.error}). Het dossier is daarom bewaard gebleven — probeer het later opnieuw.` };
  }
  const { error } = await supabase.from("dossiers").delete().eq("id", id);
  if (error) {
    // bewust NIET meer optimistisch lokaal verwijderen bij een mislukte server-verwijdering —
    // voorheen verdween de rij hier hoe dan ook uit de lijst, ook als de echte verwijdering op
    // de server gefaald was, zodat de gebruiker nooit zag dat het dossier eigenlijk nog bestond.
    console.error("Verwijderen mislukt:", error.message);
    return { ok: false, error: error.message };
  }
  const next = index.filter((x) => x.id !== id);
  setIndex(next);
  return { ok: true };
}

// eenvoudig logboek van wie een dossier aanmaakte, verwijderde, of als beheerder het dossier van
// een collega opende — bij een geschil of vergissing rond een document dat jarenlang juridisch
// relevant kan blijven (Vlabel/nalatenschap), is dit anders achteraf nergens te reconstrueren
// (zie audit, punt H4; tabel + toegangsregels in supabase/schema.sql). Bewust "fire-and-forget":
// een mislukte logregel mag nooit de eigenlijke actie (aanmaken/verwijderen/openen) blokkeren of
// vertragen, vandaar geen "await" op de aanroepplaatsen hieronder.
function logDossierEvent(dossierId, gebruikerId, actie, details) {
  if (!gebruikerId) return;
  supabase.from("dossier_events").insert({
    dossier_id: dossierId, gebruiker_id: gebruikerId, actie, details: details || null,
  }).then(({ error }) => {
    if (error) console.error("Kon logboekregel niet wegschrijven:", error.message);
  });
}

// bouwt een tekstsamenvatting van alle ingevulde tabbladen, gebruikt als context voor de AI-SWOT
function buildPropertySummary(d) {
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
function genereerAutomatischeSwot(d) {
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

async function callClaudeWithSearch(prompt) {
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
function extractJson(raw) {
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
function duidAiDocFout(e) {
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
async function uploadDocumentNaarStorage(file, dossierId, docId) {
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
async function uploadFotoVoorPdf(foto, dossierId) {
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
async function callClaudeWithDocs(pdfDocs, promptText, dossierId) {
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
// berekenParkeerplaatsenTotaal, berekenWaardering en useCalc verhuisden naar src/domein/waardering.js (opsplitsing stap 2).

// ---------- generic field components ----------
// "full" = over de volledige breedte. Onder 768px staat alles toch al onder elkaar (zie Section),
// dus geldt die kolomoverspanning pas vanaf md — anders zou een veld op een telefoon proberen twee
// kolommen te overspannen die er niet zijn.
function Field({ label, children, hint, full }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>{label}</span>
      {children}
      {hint && <span className="block text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.75 }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 10px", fontSize: 14,
  width: "100%", background: PAPER_RAISED, color: INK, outline: "none",
};

function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function Select({ options, ...props }) {
  return (
    <select {...props} style={{ ...inputStyle, ...(props.style || {}) }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
// kleine "snelkeuze"-chips boven een vrij-tekstveld: klik vult het veld in één keer in,
// zonder de vrije-tekst-invoer te beperken (geen "actieve" toestand, want dit is geen
// meerkeuzeveld — gewoon een sneltoets om iets vaak voorkomend niet manueel te moeten typen)
function QuickChips({ options, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {options.map((o) => (
        <button type="button" key={o} onClick={() => onPick(o)}
          className="text-xs px-2 py-0.5 rounded-full transition-colors"
          style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED, color: INK_SOFT, fontWeight: 500 }}>
          {o}
        </button>
      ))}
    </div>
  );
}
function MultiCheck({ options, values, onChange }) {
  const toggle = (o) => {
    const has = values.includes(o);
    onChange(has ? values.filter((v) => v !== o) : [...values, o]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = values.includes(o);
        return (
          <button type="button" key={o} onClick={() => toggle(o)} aria-pressed={active}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={{
              border: `1px solid ${active ? BRASS : LINE}`,
              background: active ? BRASS_SOFT : PAPER_RAISED,
              color: active ? BRASS : INK_SOFT, fontWeight: 500,
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer select-none mb-1"
      style={{ color: checked ? BRASS : INK_SOFT, fontWeight: 500 }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 14, height: 14, accentColor: BRASS }} />
      {label}
    </label>
  );
}

// ---------- step: SectionCard wrapper ----------
function Section({ title, icon: Icon, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} style={{ color: BRASS }} />
        <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>{title}</h3>
      </div>
      {/* één kolom op een telefoon, twee vanaf een tablet: twee kolommen van ~150px naast elkaar
          (wat het voordien werd) maakt elk invoerveld onbruikbaar bij een plaatsbezoek */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

// ---------- meerdere panden in één dossier ----------
// Label voor één pand in de lijsten hieronder — een ingevuld adres krijgt voorrang op het
// (optionele) label dat bij het toevoegen werd meegegeven, zodat de lijst na verloop van tijd
// vanzelf betekenisvoller wordt naarmate de gegevens ingevuld raken.
function pandLabel(pand, fallback) {
  if (pand.straat) return `${pand.straat} ${pand.nummer || ""}${pand.bus ? "/" + pand.bus : ""}`.trim();
  return pand.pandNaam || fallback;
}

// Dunne, altijd-zichtbare balk boven elk pand-gebonden tabblad (Ligging t/m Foto's) — toont welk
// pand er precies bewerkt wordt en laat toe snel te wisselen, zonder terug naar het tabblad
// "Panden" te moeten gaan. Blijft volledig verborgen zolang er geen enkel extra pand is (d.i. elk
// gewoon, bestaand dossier) — dan is er ook niets om tussen te kiezen.
function PandenBalk({ d, veiligePandIndex, setActievePandIndex }) {
  if (!d.extraPanden || d.extraPanden.length === 0) return null;
  const namen = [pandLabel(d, "Hoofdpand"), ...d.extraPanden.map((p, i) => pandLabel(p, `Pand ${i + 2}`))];
  return (
    <div className="no-print flex items-center gap-1.5 flex-wrap mb-5 pb-4" style={{ borderBottom: `1px solid ${LINE}` }}>
      <span style={{ fontSize: 11, color: INK_SOFT, marginRight: 2 }}>Je bewerkt nu:</span>
      {namen.map((naam, i) => (
        <button key={i} type="button" onClick={() => setActievePandIndex(i)}
          className="text-xs px-2.5 py-1 rounded-full"
          style={{
            background: i === veiligePandIndex ? BRASS : "transparent",
            color: i === veiligePandIndex ? "#fff" : INK_SOFT,
            border: `1px solid ${i === veiligePandIndex ? BRASS : LINE}`, fontWeight: 500,
          }}>
          {i === 0 ? "Hoofdpand" : `Pand ${i + 1}`}{naam ? ` — ${naam}` : ""}
        </button>
      ))}
    </div>
  );
}

// Beheer-tabblad: panden toevoegen/verwijderen/kiezen. De eigenlijke gegevens van elk pand (type,
// ligging, constructie, waardering, foto's...) worden NIET hier ingevuld, maar via de andere
// tabbladen — telkens voor het pand dat via de knoppen hieronder (of via PandenBalk hierboven)
// als actief gekozen is. Zie de toelichting bij bindPand() in DossierWizard.
function StepPanden({ d, veiligePandIndex, setActievePandIndex, addPand, removePand }) {
  const [nieuweNaam, setNieuweNaam] = useState("");
  const rijen = [
    { naam: pandLabel(d, "Hoofdpand — nog geen adres ingevuld"), vastgoedType: d.vastgoedType, isHoofdpand: true },
    ...d.extraPanden.map((p, i) => ({ naam: pandLabel(p, `Pand ${i + 2} — nog geen adres ingevuld`), vastgoedType: p.vastgoedType, isHoofdpand: false })),
  ];
  return (
    <div>
      <div className="mb-5">
        <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Panden in dit dossier</div>
        <p style={{ fontSize: 13, color: INK_SOFT, lineHeight: 1.6, maxWidth: 640 }}>
          Bestaat deze opdracht uit meerdere eigendommen — bv. een woning én een apart kadastraal
          perceel, of meerdere appartementen — die samen in één taxatieverslag moeten komen? Voeg ze
          hieronder toe als afzonderlijke panden. Elk pand krijgt via de andere tabbladen hierboven
          zijn eigen volledige gegevens (type, ligging, constructie, waardering, foto's, …) — kies
          met "Bewerk dit pand" welk pand je op dat moment invult. Opdrachtgever, reden van
          waardering en schatter-expert (tabblad "Opdracht & partijen") gelden voor het hele dossier
          en hoef je maar één keer in te vullen. Het verslag toont straks elk pand afzonderlijk, plus
          een samenvattende tabel met de totale waarde van het hele dossier.
        </p>
      </div>
      <div className="flex flex-col gap-2 mb-6">
        {rijen.map((p, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg"
            style={{ border: `1px solid ${i === veiligePandIndex ? BRASS : LINE}`, background: i === veiligePandIndex ? BRASS_SOFT : PAPER_RAISED }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{p.isHoofdpand ? "Hoofdpand" : `Pand ${i + 1}`} — {p.naam}</div>
              <div style={{ fontSize: 12, color: INK_SOFT }}>{p.vastgoedType}</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setActievePandIndex(i)}
                className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK, fontWeight: 500 }}>
                {i === veiligePandIndex ? "Actief" : "Bewerk dit pand"}
              </button>
              {!p.isHoofdpand && (
                <button type="button" title="Pand verwijderen"
                  onClick={() => { if (confirm(`Pand "${p.naam}" en al zijn ingevulde gegevens verwijderen uit dit dossier?`)) removePand(i - 1); }}
                  className="text-xs p-1.5 rounded-lg" style={{ color: "#991b1b" }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <Field label="Naam/label voor het nieuwe pand (optioneel)" hint='bv. "Garage", "Appartement 2" — mag ook leeg blijven'>
          <TextInput placeholder="Bv. Garage" value={nieuweNaam} onChange={(e) => setNieuweNaam(e.target.value)} />
        </Field>
        <button type="button" onClick={() => { addPand(nieuweNaam); setNieuweNaam(""); }}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg whitespace-nowrap"
          style={{ background: BRASS, color: "#fff", fontWeight: 500 }}>
          <Plus size={14} /> Pand toevoegen
        </button>
      </div>
    </div>
  );
}

function DossierWizard({ initialDossier, onBack, onSave, huisstijl }) {
  const [d, setD] = useState(initialDossier);
  const [step, setStep] = useState(0);
  const calc = useCalc(d);
  // opslagstatus, zichtbaar gemaakt zodat een mislukte opslag (bv. door een te grote bijlage of
  // een netwerkprobleem) niet langer stilzwijgend verdwijnt — voorheen zag de gebruiker dit
  // nergens en verscheen het document/de eruit gehaalde gegevens later gewoon niet meer
  const [opslaanStatus, setOpslaanStatus] = useState("opgeslagen"); // "opgeslagen" | "bezig" | "fout"
  const [opslaanFout, setOpslaanFout] = useState("");

  // Twee tellers om elkaar overlappende opslagacties te temmen. Op een trage verbinding duurt één
  // opslagactie van een dossier met foto's makkelijk 5 tot 15 seconden; ondertussen typt de
  // gebruiker verder en start 900 ms later een tweede. Voordien liepen die door elkaar: welke als
  // laatste bij de databank aankwam lag niet vast, en het antwoord van de OUDSTE zette de status
  // alsnog op "opgeslagen" (en wiste een net getoonde foutmelding). Nu wacht een nieuwe opslagactie
  // op de vorige, en tellen enkel de antwoorden van de meest recente mee.
  const opslaanBezigRef = useRef(false);
  const opslaanVolgnrRef = useRef(0);

  // debounced auto-opslaan bij elke wijziging
  useEffect(() => {
    const t = setTimeout(async () => {
      // wachten tot een eventuele vorige opslagbeurt klaar is, met een plafond: blijft die om welke
      // reden ook hangen, dan gaan we na 30 s toch door i.p.v. eeuwig te wachten
      for (let gewacht = 0; opslaanBezigRef.current && gewacht < 30000; gewacht += 150) {
        await new Promise((r) => setTimeout(r, 150));
      }
      const volgnr = ++opslaanVolgnrRef.current;
      opslaanBezigRef.current = true;
      setOpslaanStatus("bezig");
      try {
        const res = await onSave(d);
        if (volgnr !== opslaanVolgnrRef.current) return; // een nieuwere opslagactie is intussen gestart
        if (res && res.ok === false) {
          setOpslaanStatus("fout");
          setOpslaanFout(res.error || "Opslaan mislukt.");
        } else {
          setOpslaanStatus("opgeslagen");
          setOpslaanFout("");
        }
      } finally {
        opslaanBezigRef.current = false;
      }
    }, 900);
    return () => clearTimeout(t);
  }, [d]);

  // Waarschuwing bij het sluiten/herladen van het venster zolang er niet-bewaarde wijzigingen zijn.
  // Er was al een bevestiging bij de knop "Overzicht", maar niets bij het wegklikken van het tabblad
  // — en bij een geïnstalleerde app in een eigen venster is per ongeluk sluiten net waarschijnlijker.
  useEffect(() => {
    if (opslaanStatus === "opgeslagen") return;
    const waarschuw = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", waarschuw);
    return () => window.removeEventListener("beforeunload", waarschuw);
  }, [opslaanStatus]);

  const set = (key) => (e) => {
    const val = e && e.target ? e.target.value : e;
    setD((prev) => ({ ...prev, [key]: val }));
  };
  const setEig = (roomKey, field, val) => setD((p) => ({
    ...p, eigenschappen: { ...p.eigenschappen, [roomKey]: { ...p.eigenschappen[roomKey], [field]: val } },
  }));

  const addRuimte = () => setD((p) => ({
    ...p, ruimtes: [...p.ruimtes, { id: uid(), verdieping: "gelijkvloers", naam: "", opp: "", coeff: 1, vloer: "" }],
  }));
  // bulk-variant van addRuimte hierboven — voegt in één keer meerdere ruimtes tegelijk toe met een
  // reeds gekende naam/verdieping/oppervlakte (i.p.v. telkens een lege rij + een aparte
  // updateRuimte-aanroep per veld); gebruikt voor "Oppervlaktes uit plannen halen" in
  // StepDocumenten hieronder. Bestaande ruimtes blijven altijd ongemoeid — dit VOEGT enkel toe.
  const addRuimtesBulk = (rijen) => setD((p) => ({
    ...p, ruimtes: [...p.ruimtes, ...rijen.map((r) => {
      const v = VERDIEPINGEN.find((x) => x.key === r.verdieping) || VERDIEPINGEN[0];
      return { id: uid(), verdieping: v.key, naam: r.naam || "", opp: r.opp || "", coeff: v.defCoeff, vloer: "" };
    })],
  }));
  const removeRuimte = (id) => setD((p) => ({ ...p, ruimtes: p.ruimtes.filter((r) => r.id !== id) }));
  const updateRuimte = (id, key, val) => setD((p) => ({
    ...p, ruimtes: p.ruimtes.map((r) => r.id === id ? { ...r, [key]: val } : r),
  }));

  const addSchijf = (naam = "", opp = "") => setD((p) => ({
    ...p, schijven: [...p.schijven, { id: uid(), naam, opp, prijs: "" }],
  }));
  const removeSchijf = (id) => setD((p) => ({ ...p, schijven: p.schijven.filter((s) => s.id !== id) }));
  const updateSchijf = (id, key, val) => setD((p) => ({
    ...p, schijven: p.schijven.map((s) => s.id === id ? { ...s, [key]: val } : s),
  }));

  const addSlaapkamer = () => setD((p) => ({
    ...p, slaapkamers: [...p.slaapkamers, { id: uid(), naam: `Slaapkamer ${p.slaapkamers.length + 1}`, vloer: "", verdieping: "", ingemaaktKasten: "Nee", radiator: "Nee" }],
  }));
  const removeSlaapkamer = (id) => setD((p) => ({ ...p, slaapkamers: p.slaapkamers.filter((s) => s.id !== id) }));
  const updateSlaapkamer = (id, key, val) => setD((p) => ({
    ...p, slaapkamers: p.slaapkamers.map((s) => s.id === id ? { ...s, [key]: val } : s),
  }));

  const addExtraRuimte = () => setD((p) => ({
    ...p, extraRuimtes: [...p.extraRuimtes, { id: uid(), naam: "", vloer: "", kenmerken: "" }],
  }));
  const removeExtraRuimte = (id) => setD((p) => ({ ...p, extraRuimtes: p.extraRuimtes.filter((r) => r.id !== id) }));
  const updateExtraRuimte = (id, key, val) => setD((p) => ({
    ...p, extraRuimtes: p.extraRuimtes.map((r) => r.id === id ? { ...r, [key]: val } : r),
  }));

  // vanaf hier duren de twee volledige Chromium-renderbeurten per PDF-aanvraag (zie de pijplijn in
  // de audit) merkbaar langer, en loopt een dossier dichter naar de 60-secondentijdslimiet van
  // /api/generate-pdf toe — louter een waarschuwing, geen harde grens: de schatter-expert beslist
  // zelf of alle foto's relevant zijn (zie audit, punt H2).
  const FOTO_WAARSCHUWING_AANTAL = 40;
  const addFotos = (files, onGeweigerd) => {
    const teAccepteren = [];
    const geweigerd = [];
    Array.from(files).forEach((f) => (isJpegFile(f) ? teAccepteren : geweigerd).push(f));
    if (geweigerd.length && onGeweigerd) onGeweigerd(geweigerd.map((f) => f.name));

    const vorigAantal = d.fotos.length;
    const nieuwAantal = vorigAantal + teAccepteren.length;
    if (teAccepteren.length && vorigAantal < FOTO_WAARSCHUWING_AANTAL && nieuwAantal >= FOTO_WAARSCHUWING_AANTAL) {
      alert(`Dit dossier bevat nu ${nieuwAantal} foto's. Vanaf ongeveer ${FOTO_WAARSCHUWING_AANTAL} foto's kan het genereren van de PDF trager verlopen of, in een uitzonderlijk geval, de tijdslimiet overschrijden. Overweeg enkel de meest relevante foto's te behouden.`);
    }

    // meteen een directe, snelle voorbeeldweergave tonen (los van de verkleining hieronder) —
    // zo is er altijd onmiddellijk een echte preview, ook als de verkleiningsstap traag is of faalt.
    const nieuw = teAccepteren.map((f) => ({ id: uid(), naam: f.name, url: URL.createObjectURL(f), base64: "", categorie: "Andere" }));
    setD((p) => ({ ...p, fotos: [...p.fotos, ...nieuw] }));

    const leesAlsData = (blob, id) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setD((p) => ({ ...p, fotos: p.fotos.map((foto) => foto.id === id ? { ...foto, base64: String(e.target.result) } : foto) }));
      };
      reader.readAsDataURL(blob);
    };
    // verkleint op de achtergrond tot een voor het rapport ruim voldoende formaat (voor de export) —
    // dit beïnvloedt de preview hierboven niet meer, enkel de uiteindelijke bestandsgrootte.
    teAccepteren.forEach((f, i) => {
      const id = nieuw[i].id;
      resizeImageBlob(f)
        .then((klein) => leesAlsData(klein, id))
        .catch(() => leesAlsData(f, id)); // verkleinen mislukt: toch het origineel gebruiken voor de export
    });
  };
  const removeFoto = (id) => setD((p) => ({ ...p, fotos: p.fotos.filter((f) => f.id !== id) }));
  const updateFoto = (id, key, val) => setD((p) => ({
    ...p, fotos: p.fotos.map((f) => f.id === id ? { ...f, [key]: val } : f),
  }));

  // optionele voorpagina-foto (bv. een Street View-schermafbeelding of een eigen foto ter plaatse)
  // — apart van de bijlage-foto's hierboven, dus ook andere beeldformaten (zoals PNG van een
  // schermafbeelding) toegelaten, niet enkel JPEG.
  const setVoorpaginaFoto = (file) => {
    if (!file) return;
    const id = uid();
    setD((p) => ({ ...p, voorpaginaFoto: { id, naam: file.name, url: URL.createObjectURL(file), base64: "" } }));
    const leesAlsData = (blob) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setD((p) => (p.voorpaginaFoto && p.voorpaginaFoto.id === id
          ? { ...p, voorpaginaFoto: { ...p.voorpaginaFoto, base64: String(e.target.result) } } : p));
      };
      reader.readAsDataURL(blob);
    };
    resizeImageBlob(file).then(leesAlsData).catch(() => leesAlsData(file));
  };
  const removeVoorpaginaFoto = () => setD((p) => ({ ...p, voorpaginaFoto: null }));

  const addEigenaar = () => setD((p) => ({
    ...p, eigenaars: [...p.eigenaars, { id: uid(), naam: "", recht: "Volle eigendom", aandeel: "" }],
  }));
  const removeEigenaar = (id) => setD((p) => ({ ...p, eigenaars: p.eigenaars.filter((e) => e.id !== id) }));
  const updateEigenaar = (id, key, val) => setD((p) => ({
    ...p, eigenaars: p.eigenaars.map((e) => e.id === id ? { ...e, [key]: val } : e),
  }));

  const addVergelijkingspunt = () => setD((p) => ({
    ...p, vergelijkingspunten: [...p.vergelijkingspunten, {
      id: uid(), adres: "", kadastraleGegevens: "", bouwjaar: "", aardTransactie: "Verkoop uit de hand",
      datumTransactie: "", belastbareGrondslag: "", ligging: "", bestemming: "", oriëntatie: "",
      externeAfwerking: "", onderhoud: "", rooilijnbreedte: "", gevelbreedte: "", bebouwdeOpp: "", afweging: "",
      // waar het punt vandaan komt (notariële akte, eigen verkoop, Statbel, ...) — een verslag
      // zonder bronvermelding bij de vergelijkingspunten is voor een bank of notaris niet toetsbaar
      bron: "",
    }],
  }));
  const removeVergelijkingspunt = (id) => {
    // een vergelijkingspunt is handmatig opgezocht werk (akte, transactiegegevens, afweging) —
    // per ongeluk wissen betekent dat het volledig opnieuw opgezocht moet worden
    const v = d.vergelijkingspunten.find((x) => x.id === id);
    if (!window.confirm(`Vergelijkingspunt${v?.adres ? ` "${v.adres}"` : ""} verwijderen?`)) return;
    setD((p) => ({ ...p, vergelijkingspunten: p.vergelijkingspunten.filter((x) => x.id !== id) }));
  };
  const updateVergelijkingspunt = (id, key, val) => setD((p) => ({
    ...p, vergelijkingspunten: p.vergelijkingspunten.map((v) => v.id === id ? { ...v, [key]: val } : v),
  }));

  // boven GROOT_DOCUMENT_MB weigeren we een PDF/foto niet, maar waarschuwen we vooraf dat het
  // opladen even kan duren — een PDF/foto wordt sinds uploadDocumentNaarStorage hierboven apart
  // naar Storage opgeladen (niet meer als base64 in het dossier zelf bewaard), dus dit raakt de
  // opslag van het dossier zelf niet meer, enkel de duur van het opladen zelf op een trage
  // verbinding. Boven MAX_DOCUMENT_MB wordt het bestand wél geweigerd (blokkerend, niet enkel een
  // waarschuwing) — die grens ligt gelijk aan de file_size_limit van de "dossier-bijlagen"-
  // Storage-bucket en aan MAX_DOC_BYTES in api/claude.js, waar een groter document sowieso al
  // door de server geweigerd wordt bij een AI-documentanalyse (zie audit, punt H5).
  const GROOT_DOCUMENT_MB = 8;
  const MAX_DOCUMENT_MB = 30;
  const addDocumenten = (files) => {
    Array.from(files).forEach((f) => {
      if (f.size > MAX_DOCUMENT_MB * 1024 * 1024) {
        alert(`"${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB — dat overschrijdt de toegelaten grens van ${MAX_DOCUMENT_MB} MB per document en wordt niet toegevoegd. Verklein het bestand (bv. via een online PDF-compressor) en probeer opnieuw.`);
        return;
      }
      const entry = { id: uid(), naam: f.name, type: f.type || "onbekend", grootte: f.size, notities: "" };
      if (f.size > GROOT_DOCUMENT_MB * 1024 * 1024) {
        alert(`"${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB — dat is vrij groot. Het wordt wel toegevoegd (grote PDF's/foto's worden apart opgeladen, niet in het dossier zelf bewaard), maar dat opladen kan op een trage verbinding even duren — wacht tot "Bezig met opladen…" naast het document verdwijnt vóór je verder werkt.`);
      }
      if (f.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          setD((p) => ({ ...p, documenten: [...p.documenten, { ...entry, notities: String(e.target.result).slice(0, 4000) }] }));
        };
        reader.readAsText(f);
      } else if (f.type === "application/pdf" || f.type.startsWith("image/")) {
        // Een PDF of foto (bv. van een grondplan) wordt voortaan PERMANENT naar Storage opgeladen
        // (zie uploadDocumentNaarStorage) i.p.v. als base64 in het dossier zelf bewaard — zo blijft
        // de dossier-opslag zelf klein, ongeacht hoe groot het document is (zie ook
        // GROOT_DOCUMENT_MB/MAX_DOCUMENT_MB hierboven en _saveDossierPoging). Een foto wordt, net
        // als voorheen, eerst verkleind voor de leesbaarheid/omvang; een PDF gaat ongewijzigd door.
        setD((p) => ({ ...p, documenten: [...p.documenten, { ...entry, opladen: true }] }));
        const teUploaden = f.type.startsWith("image/")
          ? resizeImageBlobBinnenBudget(f).then((klein) => new File([klein], f.name, { type: "image/jpeg" })).catch(() => f)
          : Promise.resolve(f);
        teUploaden
          .then((bestand) => uploadDocumentNaarStorage(bestand, d.id, entry.id).then((pad) => {
            setD((p) => ({ ...p, documenten: p.documenten.map((doc) => doc.id === entry.id ? { ...doc, pad, mediaType: bestand.type || f.type, grootte: bestand.size, opladen: false } : doc) }));
          }))
          .catch((err) => {
            // terugvalscenario: bij een mislukte upload (bv. tijdelijk geen netwerk) toch als
            // base64 inline bewaren, zodat het document niet gewoon verloren gaat — enkel zinvol
            // als het bestand niet te groot is om alsnog inline te bewaren.
            console.error("Document opladen mislukt, val terug op inline opslag:", err.message);
            if (f.size > GROOT_DOCUMENT_MB * 1024 * 1024) {
              setD((p) => ({ ...p, documenten: p.documenten.filter((doc) => doc.id !== entry.id) }));
              alert(`"${f.name}" kon niet opgeladen worden (${err.message}). Probeer het opnieuw met een stabiele internetverbinding.`);
              return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = String(e.target.result).split(",")[1] || "";
              setD((p) => ({ ...p, documenten: p.documenten.map((doc) => doc.id === entry.id ? { ...doc, base64, mediaType: f.type, opladen: false } : doc) }));
            };
            reader.readAsDataURL(f);
          });
      } else {
        setD((p) => ({ ...p, documenten: [...p.documenten, entry] }));
      }
    });
  };
  const removeDocument = (id) => {
    const doc = d.documenten.find((x) => x.id === id);
    // bevestiging: dit wist meteen ook het bestand zelf uit Storage — het duurst te herstellen van
    // alle verwijderacties in de wizard (het document moet dan opnieuw opgezocht en opgeladen worden)
    if (!window.confirm(`"${doc?.naam || "Dit document"}" verwijderen? Het opgeladen bestand wordt daarbij definitief gewist.`)) return;
    // ook het permanent opgeslagen bestand zelf opruimen (best effort — een mislukte verwijdering
    // hier laat enkel een ongebruikt bestand achter in Storage, geen zichtbaar probleem voor de
    // gebruiker) zodat verwijderde documenten niet blijven meetellen voor de opslagruimte.
    if (doc?.pad) supabase.storage.from("dossier-bijlagen").remove([doc.pad]).catch(() => {});
    setD((p) => ({ ...p, documenten: p.documenten.filter((x) => x.id !== id) }));
  };
  const updateDocument = (id, key, val) => setD((p) => ({
    ...p, documenten: p.documenten.map((doc) => doc.id === id ? { ...doc, [key]: val } : doc),
  }));

  // ---------- meerdere panden in één dossier (zie extraPanden/maakLeegPand hierboven) ----------
  // actievePandIndex: 0 = het hoofdpand (de bestaande vlakke dossiervelden hierboven, ongewijzigd),
  // > 0 = extraPanden[index-1]. De schatter-expert schakelt hiertussen via de Panden-balk (zie
  // StepPandenBalk hieronder) — welk pand actief is bepaalt enkel wélke gegevens de stappen
  // "Ligging" t/m "Foto's" tonen/bewerken; "Documenten", "Opdracht & partijen" en "Rapport" blijven
  // altijd dossierbreed (zie de render-switch verderop).
  const [actievePandIndex, setActievePandIndex] = useState(0);
  // veilige index: valt terug op het hoofdpand als het net-actieve pand ondertussen verwijderd werd
  const veiligePandIndex = actievePandIndex > 0 && actievePandIndex > d.extraPanden.length ? 0 : actievePandIndex;

  const addPand = (naam = "") => {
    // index binnen het actievePandIndex-schema (0 = hoofdpand, i+1 = extraPanden[i]) — d.extraPanden.length
    // vóór het toevoegen is exact de index waarop het nieuwe pand terechtkomt, dus dit kan hier al
    // synchroon bepaald worden i.p.v. te moeten wachten tot ná de (asynchrone) setD hieronder.
    const nieuweIndex = d.extraPanden.length + 1;
    setD((p) => ({ ...p, extraPanden: [...p.extraPanden, maakLeegPand(naam)] }));
    // meteen naar het nieuwe pand schakelen — vermijdt dat de gebruiker een pand toevoegt en zich
    // dan afvraagt waarom er ogenschijnlijk niets veranderde
    setActievePandIndex(nieuweIndex);
  };
  const removePand = (i) => {
    setD((p) => ({ ...p, extraPanden: p.extraPanden.filter((_, pi) => pi !== i) }));
    setActievePandIndex(0);
  };

  const updatePandSlice = (i, updater) => setD((p) => ({
    ...p, extraPanden: p.extraPanden.map((pand, pi) => (pi === i ? updater(pand) : pand)),
  }));

  // Levert voor een gegeven pand-index precies dezelfde soort d/set/mutator-set als de wizard al
  // sinds jaar en dag gebruikt (zie hierboven) — voor index 0 zijn dat gewoon de bestaande
  // closures zelf (geen enkele wijziging aan het bestaande, eenpand-gedrag), voor index > 0 gaat
  // elke bewerking via updatePandSlice() naar d.extraPanden[index-1] i.p.v. naar d zelf. Zo kunnen
  // alle bestaande Step-componenten (die toch al generieke {d, set, ...}-props verwachten)
  // ongewijzigd hergebruikt worden voor élk pand.
  function bindPand(idx) {
    if (idx === 0) {
      return {
        pd: d, pcalc: calc, setPd: setD,
        set, setEig,
        addRuimte, addRuimtesBulk, removeRuimte, updateRuimte,
        addSchijf, removeSchijf, updateSchijf,
        addSlaapkamer, removeSlaapkamer, updateSlaapkamer,
        addExtraRuimte, removeExtraRuimte, updateExtraRuimte,
        addFotos, removeFoto, updateFoto,
        addDocumenten, removeDocument, updateDocument,
        addVergelijkingspunt, removeVergelijkingspunt, updateVergelijkingspunt,
      };
    }
    const i = idx - 1;
    // "id" (het databaserij-id van het dossier) bestaat enkel op het dossier zelf, niet op een
    // pand-snede (zie maakLeegPand) — sommige stappen (bv. de AI-analyse in StepSwot) hebben dit
    // wél nodig (louter om tijdelijke Storage-bestanden een naam te geven), vandaar hier expliciet
    // meegegeven vanuit het dossier.
    const pd = { ...d.extraPanden[i], id: d.id };
    const pcalc = berekenWaardering(pd);
    const upd = (updater) => updatePandSlice(i, updater);
    const pSet = (key) => (e) => { const val = e && e.target ? e.target.value : e; upd((prev) => ({ ...prev, [key]: val })); };
    const pSetEig = (roomKey, field, val) => upd((prev) => ({
      ...prev, eigenschappen: { ...prev.eigenschappen, [roomKey]: { ...prev.eigenschappen[roomKey], [field]: val } },
    }));

    const pAddRuimte = () => upd((prev) => ({
      ...prev, ruimtes: [...prev.ruimtes, { id: uid(), verdieping: "gelijkvloers", naam: "", opp: "", coeff: 1, vloer: "" }],
    }));
    const pAddRuimtesBulk = (rijen) => upd((prev) => ({
      ...prev, ruimtes: [...prev.ruimtes, ...rijen.map((r) => {
        const v = VERDIEPINGEN.find((x) => x.key === r.verdieping) || VERDIEPINGEN[0];
        return { id: uid(), verdieping: v.key, naam: r.naam || "", opp: r.opp || "", coeff: v.defCoeff, vloer: "" };
      })],
    }));
    const pRemoveRuimte = (id) => upd((prev) => ({ ...prev, ruimtes: prev.ruimtes.filter((r) => r.id !== id) }));
    const pUpdateRuimte = (id, key, val) => upd((prev) => ({
      ...prev, ruimtes: prev.ruimtes.map((r) => r.id === id ? { ...r, [key]: val } : r),
    }));

    const pAddSchijf = (naam = "", opp = "") => upd((prev) => ({
      ...prev, schijven: [...prev.schijven, { id: uid(), naam, opp, prijs: "" }],
    }));
    const pRemoveSchijf = (id) => upd((prev) => ({ ...prev, schijven: prev.schijven.filter((s) => s.id !== id) }));
    const pUpdateSchijf = (id, key, val) => upd((prev) => ({
      ...prev, schijven: prev.schijven.map((s) => s.id === id ? { ...s, [key]: val } : s),
    }));

    const pAddSlaapkamer = () => upd((prev) => ({
      ...prev, slaapkamers: [...prev.slaapkamers, { id: uid(), naam: `Slaapkamer ${prev.slaapkamers.length + 1}`, vloer: "", verdieping: "", ingemaaktKasten: "Nee", radiator: "Nee" }],
    }));
    const pRemoveSlaapkamer = (id) => upd((prev) => ({ ...prev, slaapkamers: prev.slaapkamers.filter((s) => s.id !== id) }));
    const pUpdateSlaapkamer = (id, key, val) => upd((prev) => ({
      ...prev, slaapkamers: prev.slaapkamers.map((s) => s.id === id ? { ...s, [key]: val } : s),
    }));

    const pAddExtraRuimte = () => upd((prev) => ({
      ...prev, extraRuimtes: [...prev.extraRuimtes, { id: uid(), naam: "", vloer: "", kenmerken: "" }],
    }));
    const pRemoveExtraRuimte = (id) => upd((prev) => ({ ...prev, extraRuimtes: prev.extraRuimtes.filter((r) => r.id !== id) }));
    const pUpdateExtraRuimte = (id, key, val) => upd((prev) => ({
      ...prev, extraRuimtes: prev.extraRuimtes.map((r) => r.id === id ? { ...r, [key]: val } : r),
    }));

    // pand-variant van addFotos: zelfde stappen (JPEG-filter, waarschuwing vanaf
    // FOTO_WAARSCHUWING_AANTAL, meteen een blob-voorbeeld tonen, nadien op de achtergrond
    // verkleinen) maar gericht op upd() i.p.v. rechtstreeks op setD().
    const pAddFotos = (files, onGeweigerd) => {
      const teAccepteren = [];
      const geweigerd = [];
      Array.from(files).forEach((f) => (isJpegFile(f) ? teAccepteren : geweigerd).push(f));
      if (geweigerd.length && onGeweigerd) onGeweigerd(geweigerd.map((f) => f.name));

      const vorigAantal = pd.fotos.length;
      const nieuwAantal = vorigAantal + teAccepteren.length;
      if (teAccepteren.length && vorigAantal < FOTO_WAARSCHUWING_AANTAL && nieuwAantal >= FOTO_WAARSCHUWING_AANTAL) {
        alert(`Dit pand bevat nu ${nieuwAantal} foto's. Vanaf ongeveer ${FOTO_WAARSCHUWING_AANTAL} foto's kan het genereren van de PDF trager verlopen of, in een uitzonderlijk geval, de tijdslimiet overschrijden. Overweeg enkel de meest relevante foto's te behouden.`);
      }

      const nieuw = teAccepteren.map((f) => ({ id: uid(), naam: f.name, url: URL.createObjectURL(f), base64: "", categorie: "Andere" }));
      upd((prev) => ({ ...prev, fotos: [...prev.fotos, ...nieuw] }));

      const leesAlsData = (blob, id) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          upd((prev) => ({ ...prev, fotos: prev.fotos.map((foto) => foto.id === id ? { ...foto, base64: String(e.target.result) } : foto) }));
        };
        reader.readAsDataURL(blob);
      };
      teAccepteren.forEach((f, fi) => {
        const id = nieuw[fi].id;
        resizeImageBlob(f).then((klein) => leesAlsData(klein, id)).catch(() => leesAlsData(f, id));
      });
    };
    const pRemoveFoto = (id) => upd((prev) => ({ ...prev, fotos: prev.fotos.filter((f) => f.id !== id) }));
    const pUpdateFoto = (id, key, val) => upd((prev) => ({ ...prev, fotos: prev.fotos.map((f) => f.id === id ? { ...f, [key]: val } : f) }));

    const pAddDocumenten = (files) => {
      Array.from(files).forEach((f) => {
        if (f.size > MAX_DOCUMENT_MB * 1024 * 1024) {
          alert(`"${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB — dat overschrijdt de toegelaten grens van ${MAX_DOCUMENT_MB} MB per document en wordt niet toegevoegd. Verklein het bestand (bv. via een online PDF-compressor) en probeer opnieuw.`);
          return;
        }
        const entry = { id: uid(), naam: f.name, type: f.type || "onbekend", grootte: f.size, notities: "" };
        if (f.size > GROOT_DOCUMENT_MB * 1024 * 1024) {
          alert(`"${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB — dat is vrij groot. Het wordt wel toegevoegd (grote PDF's/foto's worden apart opgeladen, niet in het dossier zelf bewaard), maar dat opladen kan op een trage verbinding even duren — wacht tot "Bezig met opladen…" naast het document verdwijnt vóór je verder werkt.`);
        }
        if (f.type === "text/plain") {
          const reader = new FileReader();
          reader.onload = (e) => {
            upd((prev) => ({ ...prev, documenten: [...prev.documenten, { ...entry, notities: String(e.target.result).slice(0, 4000) }] }));
          };
          reader.readAsText(f);
        } else if (f.type === "application/pdf" || f.type.startsWith("image/")) {
          // zie addDocumenten hierboven voor de toelichting bij deze permanente Storage-opslag
          upd((prev) => ({ ...prev, documenten: [...prev.documenten, { ...entry, opladen: true }] }));
          const teUploaden = f.type.startsWith("image/")
            ? resizeImageBlobBinnenBudget(f).then((klein) => new File([klein], f.name, { type: "image/jpeg" })).catch(() => f)
            : Promise.resolve(f);
          teUploaden
            .then((bestand) => uploadDocumentNaarStorage(bestand, pd.id, entry.id).then((pad) => {
              upd((prev) => ({ ...prev, documenten: prev.documenten.map((doc) => doc.id === entry.id ? { ...doc, pad, mediaType: bestand.type || f.type, grootte: bestand.size, opladen: false } : doc) }));
            }))
            .catch((err) => {
              console.error("Document opladen mislukt, val terug op inline opslag:", err.message);
              if (f.size > GROOT_DOCUMENT_MB * 1024 * 1024) {
                upd((prev) => ({ ...prev, documenten: prev.documenten.filter((doc) => doc.id !== entry.id) }));
                alert(`"${f.name}" kon niet opgeladen worden (${err.message}). Probeer het opnieuw met een stabiele internetverbinding.`);
                return;
              }
              const reader = new FileReader();
              reader.onload = (e) => {
                const base64 = String(e.target.result).split(",")[1] || "";
                upd((prev) => ({ ...prev, documenten: prev.documenten.map((doc) => doc.id === entry.id ? { ...doc, base64, mediaType: f.type, opladen: false } : doc) }));
              };
              reader.readAsDataURL(f);
            });
        } else {
          upd((prev) => ({ ...prev, documenten: [...prev.documenten, entry] }));
        }
      });
    };
    const pRemoveDocument = (id) => {
      const doc = pd.documenten.find((x) => x.id === id);
      if (doc?.pad) supabase.storage.from("dossier-bijlagen").remove([doc.pad]).catch(() => {});
      upd((prev) => ({ ...prev, documenten: prev.documenten.filter((x) => x.id !== id) }));
    };
    const pUpdateDocument = (id, key, val) => upd((prev) => ({ ...prev, documenten: prev.documenten.map((doc) => doc.id === id ? { ...doc, [key]: val } : doc) }));

    const pAddVergelijkingspunt = () => upd((prev) => ({
      ...prev, vergelijkingspunten: [...prev.vergelijkingspunten, {
        id: uid(), adres: "", kadastraleGegevens: "", bouwjaar: "", aardTransactie: "Verkoop uit de hand",
        datumTransactie: "", belastbareGrondslag: "", ligging: "", bestemming: "", oriëntatie: "",
        externeAfwerking: "", onderhoud: "", rooilijnbreedte: "", gevelbreedte: "", bebouwdeOpp: "", afweging: "",
      }],
    }));
    const pRemoveVergelijkingspunt = (id) => upd((prev) => ({ ...prev, vergelijkingspunten: prev.vergelijkingspunten.filter((v) => v.id !== id) }));
    const pUpdateVergelijkingspunt = (id, key, val) => upd((prev) => ({
      ...prev, vergelijkingspunten: prev.vergelijkingspunten.map((v) => v.id === id ? { ...v, [key]: val } : v),
    }));

    return {
      pd, pcalc, setPd: upd,
      set: pSet, setEig: pSetEig,
      addRuimte: pAddRuimte, addRuimtesBulk: pAddRuimtesBulk, removeRuimte: pRemoveRuimte, updateRuimte: pUpdateRuimte,
      addSchijf: pAddSchijf, removeSchijf: pRemoveSchijf, updateSchijf: pUpdateSchijf,
      addSlaapkamer: pAddSlaapkamer, removeSlaapkamer: pRemoveSlaapkamer, updateSlaapkamer: pUpdateSlaapkamer,
      addExtraRuimte: pAddExtraRuimte, removeExtraRuimte: pRemoveExtraRuimte, updateExtraRuimte: pUpdateExtraRuimte,
      addFotos: pAddFotos, removeFoto: pRemoveFoto, updateFoto: pUpdateFoto,
      addDocumenten: pAddDocumenten, removeDocument: pRemoveDocument, updateDocument: pUpdateDocument,
      addVergelijkingspunt: pAddVergelijkingspunt, removeVergelijkingspunt: pRemoveVergelijkingspunt, updateVergelijkingspunt: pUpdateVergelijkingspunt,
    };
  }
  const actief = bindPand(veiligePandIndex);

  // vastgoedType (zie StepType) bepaalt hier welk tabblad op de 7e plaats staat: de residentiële
  // "Ruimte-eigenschappen" (hall/woonkamer/keuken/badkamer/... checklists) heeft geen zinvolle
  // invulling bij een magazijn of kantoorgebouw — dat tabblad wordt dan vervangen (niet louter
  // verborgen) door "Bedrijfskenmerken". De rest van de wizard (aantal/volgorde van de andere
  // tabbladen) blijft ongewijzigd voor elk vastgoedtype. Sinds de invoering van meerdere panden
  // per dossier geldt dit per ACTIEF pand (actief.pd), niet meer voor het dossier als geheel — twee
  // panden in hetzelfde dossier kunnen dus best een verschillend vastgoedtype hebben en elk hun
  // eigen 7e tabblad tonen zodra ze als actief gekozen worden.
  const isResidentieel = actief.pd.vastgoedType !== "KMO-vastgoed" && actief.pd.vastgoedType !== "Bedrijfsvastgoed";
  const steps = [
    { key: "documenten", label: "Documenten (start hier)", icon: Paperclip },
    { key: "opdracht", label: "Opdracht & partijen", icon: Users },
    { key: "panden", label: "Panden", icon: Home },
    { key: "ligging", label: "Ligging & omgeving", icon: MapPin },
    { key: "type", label: "Type, staat & kadaster", icon: Building2 },
    { key: "constructie", label: "Constructie & isolatie", icon: Layers },
    { key: "installaties", label: "Verwarming & installaties", icon: Flame },
    isResidentieel
      ? { key: "ruimtes-eig", label: "Ruimte-eigenschappen", icon: Sofa }
      : { key: "bedrijfskenmerken", label: "Bedrijfskenmerken", icon: Building2 },
    { key: "markt", label: "Markt, stedenbouw & juridisch", icon: LineChart },
    { key: "swot", label: "SWOT-analyse", icon: ClipboardList },
    { key: "afmetingen", label: "Afmetingen & indeling", icon: Grid3x3 },
    { key: "vergelijkingspunten", label: "Vergelijkingspunten", icon: Ruler },
    { key: "waardering", label: "Waardering", icon: Calculator },
    { key: "fotos", label: "Foto's (bijlage)", icon: ImageIcon },
    { key: "rapport", label: "Rapport", icon: FileText },
  ];

  // parkeerplaatsen & garages (dossierbreed, zie initialData.parkeerplaatsenGarages — bewust niet
  // per pand: één gedeelde lijst voor het hele dossier, met een eigen totaal dat bovenop de som van
  // alle panden geteld wordt, zie berekenParkeerplaatsenTotaal en StepWaardering hieronder)
  const addParkeerplaats = () => setD((p) => ({
    ...p, parkeerplaatsenGarages: [...p.parkeerplaatsenGarages, { id: uid(), type: "Autostaanplaats (buiten)", aantal: 1, waardePerStuk: "", omschrijving: "" }],
  }));
  const removeParkeerplaats = (id) => setD((p) => ({ ...p, parkeerplaatsenGarages: p.parkeerplaatsenGarages.filter((pp) => pp.id !== id) }));
  const updateParkeerplaats = (id, key, val) => setD((p) => ({
    ...p, parkeerplaatsenGarages: p.parkeerplaatsenGarages.map((pp) => pp.id === id ? { ...pp, [key]: val } : pp),
  }));

  // Portefeuille-overzicht voor StepWaardering hieronder: enkel berekend zodra er effectief extra
  // panden zijn (anders blijft dit gewoon "null" en verandert er niets aan het scherm van een
  // gewoon éénpand-dossier). Zelfde optelling als buildMultiPandReportData gebruikt voor het
  // rapport zelf, zodat het scherm hier en het uiteindelijke verslag nooit uit elkaar kunnen lopen.
  const portefeuille = d.extraPanden.length === 0 ? null : (() => {
    const panden = [
      { label: pandLabel(d, "Hoofdpand"), calc },
      ...d.extraPanden.map((p, i) => {
        const pd = { ...d, ...p, extraPanden: [], parkeerplaatsenGarages: [] };
        return { label: pandLabel(p, `Pand ${i + 2}`), calc: berekenWaardering(pd) };
      }),
    ];
    const parkeerTotaal = berekenParkeerplaatsenTotaal(d.parkeerplaatsenGarages);
    const totaal = panden.reduce((som, p) => som + (p.calc.venaleWaarde || 0), 0) + parkeerTotaal;
    return { panden, parkeerTotaal, totaal };
  })();

  return (
    <div style={{ background: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif", minHeight: 600 }}
      className="w-full rounded-xl overflow-hidden">
      <style>{`
        @page { size: A4; margin: 18mm 16mm; }
        @media print {
          .no-print { display: none !important; }
          .report-scroll-area { max-height: none !important; overflow: visible !important; }
          .report-page { box-shadow: none !important; border: none !important; border-radius: 0 !important;
            margin: 0 !important; page-break-after: always; break-after: page; }
          .report-page:last-of-type { page-break-after: auto; break-after: auto; }
          body, html { background: #fff !important; }
        }
      `}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-y-2 px-4 md:px-6 py-3 md:py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // waarschuwt vóór het verlaten van het dossier als de laatste wijziging nog niet
              // (of nog niet bevestigd) bewaard is, zodat een makelaar niet per ongeluk het
              // scherm verlaat terwijl er net iets mislukte of nog aan het opslaan is
              if (opslaanStatus === "fout" && !confirm("Er is een fout bij het opslaan (" + opslaanFout + "). Toch teruggaan naar het overzicht? Niet-opgeslagen wijzigingen gaan dan verloren.")) return;
              if (opslaanStatus === "bezig" && !confirm("Er wordt nog opgeslagen. Toch al teruggaan naar het overzicht?")) return;
              onBack();
            }}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
            style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <ChevronLeft size={13} /> Overzicht
          </button>
          <Home size={16} style={{ color: BRASS }} />
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500 }}>
              {d.straat ? `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}` : "Nieuw dossier"}
            </div>
            <div style={{ fontSize: 12, color: INK_SOFT }}>
              {d.postcode || d.gemeente ? `${d.postcode} ${d.gemeente}` : "Adres nog niet ingevuld"}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          {opslaanStatus === "bezig" && (
            <span className="text-xs" style={{ color: INK_SOFT }}>Bezig met opslaan…</span>
          )}
          {opslaanStatus === "fout" && (
            <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: "#fee2e2", color: "#991b1b", fontWeight: 500 }}>
              <AlertTriangle size={12} /> Niet opgeslagen
            </span>
          )}
          <button onClick={() => setD((p) => ({ ...p, status: p.status === "concept" ? "afgewerkt" : "concept" }))}
            className="text-xs px-3 py-1 rounded-full" style={{
              background: d.status === "afgewerkt" ? STAMP : STAMP_SOFT,
              color: d.status === "afgewerkt" ? "#fff" : STAMP, fontWeight: 500,
            }}>
            {d.status === "afgewerkt" ? "Afgewerkt" : "Concept"} · wordt automatisch bewaard
          </button>
        </div>
      </div>
      {opslaanStatus === "fout" && (
        <div className="no-print flex items-center justify-between gap-3 px-6 py-2.5" style={{ background: "#fee2e2", borderBottom: "1px solid #fecaca" }}>
          <span className="text-xs" style={{ color: "#991b1b" }}>{opslaanFout}</span>
          <button
            onClick={async () => {
              setOpslaanStatus("bezig");
              const res = await onSave(d);
              if (res && res.ok === false) { setOpslaanStatus("fout"); setOpslaanFout(res.error || "Opslaan mislukt."); }
              else { setOpslaanStatus("opgeslagen"); setOpslaanFout(""); }
            }}
            className="text-xs px-3 py-1 rounded-lg flex-shrink-0"
            style={{ background: "#991b1b", color: "#fff", fontWeight: 500 }}>
            Probeer opnieuw
          </button>
          {/* Bij een botsing (iemand anders wijzigde dit dossier intussen) helpt "probeer opnieuw"
              niet: dan moet de recentste versie eerst opgehaald worden. Zie de botsingscontrole in
              _saveDossierPoging. */}
          {/botsing|iemand anders gewijzigd/i.test(opslaanFout) && (
            <button onClick={() => window.location.reload()}
              className="text-xs px-3 py-1 rounded-lg flex-shrink-0"
              style={{ background: "#fff", color: "#991b1b", fontWeight: 500, border: "1px solid #991b1b" }}>
              Pagina herladen
            </button>
          )}
        </div>
      )}

      {/* Op een telefoon staat de stappenlijst als horizontaal schuivende balk bovenaan, vanaf een
          tablet als vaste zijbalk links. Voordien was ze altijd een kolom van 220px, wat op een
          klein scherm nauwelijks ruimte overliet voor de inhoud zelf. */}
      <div className="flex flex-col md:flex-row" style={{ minHeight: 560 }}>
        <div className="no-print py-3 px-3 md:py-4 flex md:block gap-2 overflow-x-auto md:overflow-visible md:flex-shrink-0 md:w-[220px]"
          style={{ borderBottom: `1px solid ${LINE}`, background: "rgba(0,0,0,0.015)" }}>
          {steps.map((s, i) => {
            const active = i === step;
            const Icon = s.icon;
            return (
              <button key={s.key} onClick={() => setStep(i)}
                className="flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg mb-0 md:mb-1 md:w-full flex-shrink-0 transition-colors"
                style={{
                  background: active ? PAPER_RAISED : "transparent",
                  boxShadow: active ? `0 0 0 1px ${LINE}` : "none",
                  color: active ? INK : INK_SOFT,
                }}>
                <Icon size={14} style={{ color: active ? BRASS : INK_SOFT, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, whiteSpace: "nowrap" }}>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* de vaste maxHeight geldt enkel vanaf md: op een telefoon scrollt de pagina zelf, een
            scrollvak-in-een-scrollvak is daar onwerkbaar */}
        <div className="report-scroll-area flex-1 px-4 md:px-8 py-5 md:py-6 overflow-visible md:overflow-auto md:max-h-[700px]">
          {/* sleutel-gebaseerd i.p.v. een vaste numerieke step===N: zo blijft dit correct ook al
              verschuift de 7e plaats hierboven tussen "ruimtes-eig" en "bedrijfskenmerken" — zie
              de toelichting bij de steps-array hierboven. */}
          {steps[step]?.key === "opdracht" && (
            <StepOpdracht d={d} set={set} addEigenaar={addEigenaar} removeEigenaar={removeEigenaar} updateEigenaar={updateEigenaar} />
          )}
          {steps[step]?.key === "panden" && (
            <StepPanden d={d} veiligePandIndex={veiligePandIndex} setActievePandIndex={setActievePandIndex} addPand={addPand} removePand={removePand} />
          )}

          {/* Alle stappen hieronder (Documenten t/m Foto's) werken op het ACTIEVE pand (actief.pd/
              actief.set/...) i.p.v. rechtstreeks op het dossier d/set — ook "Documenten" is
              bewust per pand (zie maakLeegPand): elk pand kan zijn eigen brondocumenten
              (grondplannen, kadastraal uittreksel...) hebben voor de AI-analyse. Voor een dossier
              zonder extra panden is actief.pd exact d zelf (zie bindPand hierboven), dus verandert
              hier niets aan het gedrag van een gewoon, bestaand dossier. PandenBalk hierboven
              blijft om diezelfde reden ook onzichtbaar zolang er geen extra panden zijn. */}
          {["documenten", "ligging", "type", "constructie", "installaties", "ruimtes-eig", "bedrijfskenmerken", "markt", "swot", "afmetingen", "vergelijkingspunten", "waardering", "fotos"].includes(steps[step]?.key) && (
            <PandenBalk d={d} veiligePandIndex={veiligePandIndex} setActievePandIndex={setActievePandIndex} />
          )}
          {steps[step]?.key === "documenten" && (
            <StepDocumenten d={actief.pd} set={actief.set} addDocumenten={actief.addDocumenten} removeDocument={actief.removeDocument} updateDocument={actief.updateDocument} addRuimtesBulk={actief.addRuimtesBulk} />
          )}
          {steps[step]?.key === "ligging" && <StepLigging d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "type" && <StepType d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "constructie" && <StepConstructie d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "installaties" && <StepInstallaties d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "ruimtes-eig" && (
            <StepRuimteEigenschappen d={actief.pd} set={actief.set} setEig={actief.setEig}
              addSlaapkamer={actief.addSlaapkamer} removeSlaapkamer={actief.removeSlaapkamer} updateSlaapkamer={actief.updateSlaapkamer}
              addExtraRuimte={actief.addExtraRuimte} removeExtraRuimte={actief.removeExtraRuimte} updateExtraRuimte={actief.updateExtraRuimte} />
          )}
          {steps[step]?.key === "bedrijfskenmerken" && <StepBedrijfskenmerken d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "markt" && <StepMarkt d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "swot" && <StepSwot d={actief.pd} set={actief.set} setD={actief.setPd} />}
          {steps[step]?.key === "afmetingen" && (
            <StepAfmetingen d={actief.pd} set={actief.set} calc={actief.pcalc}
              addRuimte={actief.addRuimte} removeRuimte={actief.removeRuimte} updateRuimte={actief.updateRuimte}
              addSchijf={actief.addSchijf} removeSchijf={actief.removeSchijf} updateSchijf={actief.updateSchijf} />
          )}
          {steps[step]?.key === "vergelijkingspunten" && (
            <StepVergelijkingspunten d={actief.pd} set={actief.set}
              addVergelijkingspunt={actief.addVergelijkingspunt} removeVergelijkingspunt={actief.removeVergelijkingspunt} updateVergelijkingspunt={actief.updateVergelijkingspunt} />
          )}
          {steps[step]?.key === "waardering" && (
            <StepWaardering d={actief.pd} set={actief.set} calc={actief.pcalc}
              parkeerplaatsenGarages={d.parkeerplaatsenGarages}
              addParkeerplaats={addParkeerplaats} removeParkeerplaats={removeParkeerplaats} updateParkeerplaats={updateParkeerplaats}
              portefeuille={portefeuille} />
          )}
          {/* voorpaginaFoto is dossierbreed (één covers-foto voor het hele verslag, ongeacht welk
              pand actief is — zie initialData/maakLeegPand), en bestaat dus niet op actief.pd zelf
              zodra dat een extra pand is; hier expliciet vanuit het dossier bijgevoegd zodat het
              scherm dat correct blijft tonen ongeacht welk pand net actief is. */}
          {steps[step]?.key === "fotos" && <StepFotos d={{ ...actief.pd, voorpaginaFoto: d.voorpaginaFoto }} addFotos={actief.addFotos} removeFoto={actief.removeFoto} updateFoto={actief.updateFoto}
            setVoorpaginaFoto={setVoorpaginaFoto} removeVoorpaginaFoto={removeVoorpaginaFoto} />}
          {steps[step]?.key === "rapport" && <StepRapport d={d} calc={calc} huisstijl={huisstijl} />}

          <div className="no-print flex justify-between mt-10 pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg"
              style={{ color: step === 0 ? "#B8B4A8" : INK_SOFT, border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
              <ChevronLeft size={14} /> Vorige
            </button>
            <button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step === steps.length - 1}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg text-white"
              style={{ background: step === steps.length - 1 ? "#B8B4A8" : INK }}>
              Volgende <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- gebruiksvoorwaarden & privacyverklaring ----------
// Bewust kort en to-the-point gehouden (eigendom, misbruik, accountbeheer, aansprakelijkheid) —
// géén juridisch nagekeken document, enkel een redelijke basisbescherming, qua opbouw losjes
// afgestemd op de bestaande voorwaarden/privacytekst op huyzen.be / pro.huyzen.be. Bij twijfel
// over de exacte formulering (bv. de precieze verhouding met Huyzen Vastgoed) laat je dit best
// nog eens nalezen door een advocaat, zie ook het gesprek dat tot deze tekst leidde.
const VOORWAARDEN = [
  {
    titel: "1. Eigendom",
    tekst: `Deze applicatie ("de app"), met inbegrip van de broncode, het ontwerp en de onderliggende technologie, is en blijft de exclusieve eigendom van Thijs Houpels. Het gebruik van de app door medewerkers van Huyzen Vastgoed of enige andere partij verleent op zich geen enkel eigendoms- of gebruiksrecht op de app, buiten het gebruiksrecht dat hieronder uitdrukkelijk wordt toegekend. De app en haar inhoud zijn beschermd door het auteursrecht; overname, kopie of nabouw zonder voorafgaande schriftelijke toestemming is niet toegestaan.`,
  },
  {
    titel: "2. Gebruiksrecht",
    tekst: `Elke gebruiker krijgt een persoonlijk, niet-overdraagbaar en te allen tijde herroepbaar recht om de app te gebruiken, uitsluitend voor taxatiewerk in het kader van zijn/haar functie. Het is niet toegestaan om: in te loggen namens iemand anders of accountgegevens (wachtwoord) met anderen te delen; de app of een onderdeel ervan te kopiëren, na te bouwen, te decompileren, of aan derden ter beschikking te stellen; de app te gebruiken voor een ander doel dan waarvoor ze bedoeld is.`,
  },
  {
    titel: "3. Accountbeheer",
    tekst: `De beheerder van de app mag te allen tijde, zonder voorafgaande kennisgeving en zonder opgave van reden, een account beperken, schorsen of definitief verwijderen, en de inhoud van een dossier inzien, aanpassen of verwijderen indien dit nodig wordt geacht — bijvoorbeeld bij (vermoeden van) misbruik, een geschil, of het einde van de samenwerking met de betrokken gebruiker.`,
  },
  {
    titel: "4. Verantwoordelijkheid van de gebruiker",
    tekst: `Elke gebruiker blijft zelf volledig verantwoordelijk voor de juistheid en volledigheid van de gegevens die hij/zij invoert, en voor de uiteindelijke taxatie en het rapport dat daaruit voortvloeit. De app is een hulpmiddel ter ondersteuning van de schatter-expert; ze vervangt nooit diens eigen professioneel oordeel en controleplicht. De gegenereerde taxatierapporten zijn indicatief tot op het moment dat de schatter-expert ze nagekeken en ondertekend heeft.`,
  },
  {
    titel: "5. Aansprakelijkheid",
    tekst: `De aansprakelijkheid van de eigenaar van de app is, voor zover wettelijk toegelaten, beperkt tot de rechtstreekse schade die het bewezen gevolg is van een fout bij het ter beschikking stellen van de app. Onrechtstreekse schade — waaronder gevolgschade, gederfde winst, of verlies van gegevens — komt niet in aanmerking voor vergoeding. De eigenaar is niet aansprakelijk voor storingen, onderbrekingen of gegevensverlies die het gevolg zijn van internetverbindingen, hostingdiensten van derden (o.a. Supabase, Vercel) of overmacht.`,
  },
  {
    titel: "6. Geen garantie",
    tekst: `De app wordt aangeboden "zoals ze is", zonder enige garantie op ononderbroken beschikbaarheid, foutloze werking, of geschiktheid voor een bepaald doel. Het gebruik ervan gebeurt op eigen risico van de gebruiker.`,
  },
  {
    titel: "7. Verwerking van persoonsgegevens",
    tekst: `Bij het gebruik van de app worden persoonsgegevens verwerkt — zowel van de gebruiker zelf (account) als van opdrachtgevers/eigenaars binnen een dossier. Hoe daarmee wordt omgegaan, staat beschreven in de afzonderlijke Privacyverklaring.`,
  },
  {
    titel: "8. Beëindiging",
    tekst: `Het gebruiksrecht eindigt automatisch bij het einde van de samenwerking tussen de gebruiker en Huyzen Vastgoed, en kan daarnaast op elk moment eenzijdig worden beëindigd door de eigenaar van de app.`,
  },
  {
    titel: "9. Toepasselijk recht",
    tekst: `Op deze gebruiksvoorwaarden is Belgisch recht van toepassing. Bij een geschil zijn uitsluitend de rechtbanken van het gerechtelijk arrondissement van de woonplaats van de eigenaar van de app bevoegd.`,
  },
];

// Bondige privacyverklaring (GDPR/AVG) voor de app zelf — qua opbouw losjes afgestemd op
// huyzen.be/privacy, maar inhoudelijk toegespitst op wat déze app effectief verwerkt: geen
// aanname dat Huyzen Vastgoed de verwerkingsverantwoordelijke is, aangezien de app zelf
// eigendom is en blijft van Thijs Houpels (zie Gebruiksvoorwaarden, punt 1). Bij twijfel over
// wie precies als verwerkingsverantwoordelijke moet gelden, best even aftoetsen.
const PRIVACYVERKLARING = [
  {
    titel: "1. Wie is verantwoordelijk",
    tekst: `Deze app wordt beheerd door Thijs Houpels, in het kader van taxatiewerk voor Huyzen Vastgoed. Voor vragen over deze privacyverklaring of over je gegevens kan je terecht op thijs@huyzen.be.`,
  },
  {
    titel: "2. Welke gegevens verwerken we",
    tekst: `Accountgegevens van medewerkers: naam, e-mailadres, telefoonnummer, functietitel, BIV- en Vlabel-nummer. Dossiergegevens die een medewerker invoert: adres en kenmerken van het te taxeren pand, naam en contactgegevens van de opdrachtgever/eigenaar, en de foto's en documenten die bij een dossier worden toegevoegd (bv. eigendomsakte, bodemattest, EPC-certificaat).`,
  },
  {
    titel: "3. Waarvoor gebruiken we deze gegevens",
    tekst: `Uitsluitend om taxatie-opdrachten uit te voeren, schattingsverslagen op te stellen, en accounts van medewerkers te beheren. Er wordt met deze gegevens niet aan marketing gedaan en ze worden niet doorverkocht aan derden.`,
  },
  {
    titel: "4. Hoe lang bewaren we deze gegevens",
    tekst: `Zolang het account actief is, of zolang een dossier relevant is voor de opdracht/het kantoor. Bij verwijdering van een account of dossier (zie Gebruiksvoorwaarden, punt 3) worden de bijhorende gegevens definitief gewist.`,
  },
  {
    titel: "5. Wie heeft er toegang, en doorgifte aan derden",
    tekst: `Enkel ingelogde medewerkers hebben toegang, en enkel tot hun eigen dossiers — een beheerder kan daarnaast alle dossiers inzien voor ondersteuning en kwaliteitscontrole. Gegevens worden verwerkt door onze technische dienstverleners: Supabase (databank, authenticatie en bestandsopslag) en Vercel (hosting), en — enkel voor het genereren van ondersteunende rapporttekst, zonder dat hier identificeerbare persoonsgegevens van de opdrachtgever voor nodig zijn — Anthropic (Claude API). Deze partijen verwerken gegevens in opdracht van en volgens de instructies van de app, niet voor eigen doeleinden.`,
  },
  {
    titel: "6. Beveiliging",
    tekst: `Toegang is enkel mogelijk na inloggen; wachtwoorden worden nooit in leesbare vorm bewaard (dit wordt volledig door Supabase Auth afgehandeld). Elke medewerker ziet en bewerkt in principe enkel de eigen dossiers, dankzij toegangsregels die op databankniveau worden afgedwongen (row-level security).`,
  },
  {
    titel: "7. Jouw rechten",
    tekst: `Je hebt steeds het recht om je gegevens in te kijken, te laten verbeteren, of te laten verwijderen. Je kan dit via het scherm "Mijn account" in de app zelf regelen voor je eigen accountgegevens, of hiervoor contact opnemen via thijs@huyzen.be.`,
  },
  {
    titel: "8. Klachten",
    tekst: `Ben je niet tevreden over hoe met je gegevens wordt omgegaan, dan kan je terecht bij de Gegevensbeschermingsautoriteit (Drukpersstraat 35, 1000 Brussel, www.gegevensbeschermingsautoriteit.be).`,
  },
];

function InfoModal({ title, sections, onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1000 }}>
      <div className="rounded-xl p-6 overflow-y-auto" style={{ width: 560, maxWidth: "100%", maxHeight: "85vh", background: PAPER_RAISED, border: `1px solid ${LINE}` }}>
        <div className="flex items-center justify-between mb-4">
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: INK }}>{title}</div>
          <button onClick={onClose} aria-label="Sluiten"><X size={18} style={{ color: INK_SOFT }} /></button>
        </div>
        <div className="flex flex-col gap-4">
          {sections.map((v) => (
            <div key={v.titel}>
              <div className="text-sm mb-1" style={{ fontWeight: 500, color: INK }}>{v.titel}</div>
              <div className="text-xs" style={{ color: INK_SOFT, lineHeight: 1.6 }}>{v.tekst}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full text-sm py-2 rounded-lg text-white mt-6" style={{ background: INK, fontWeight: 500 }}>
          Sluiten
        </button>
      </div>
    </div>
  );
}

function VoorwaardenModal({ onClose }) {
  return <InfoModal title="Gebruiksvoorwaarden" sections={VOORWAARDEN} onClose={onClose} />;
}

function PrivacyverklaringModal({ onClose }) {
  return <InfoModal title="Privacyverklaring" sections={PRIVACYVERKLARING} onClose={onClose} />;
}

// ---------- login ----------
function LoginScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [naam, setNaam] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [bezig, setBezig] = useState(false);
  // toont een "opnieuw versturen"-knop op het aanmeldscherm zodra dat relevant is (na registratie,
  // of wanneer aanmelden geweigerd werd omdat het account nog niet bevestigd is)
  const [toonHerverzenden, setToonHerverzenden] = useState(false);
  const [akkoordVoorwaarden, setAkkoordVoorwaarden] = useState(false);
  const [toonVoorwaarden, setToonVoorwaarden] = useState(false);
  const [toonPrivacy, setToonPrivacy] = useState(false);

  const submitLogin = async () => {
    if (bezig) return;
    setError(""); setInfo(""); setToonHerverzenden(false);
    if (!email.trim() || !wachtwoord) { setError("Vul e-mail en wachtwoord in."); return; }
    setBezig(true);
    try {
      const user = await login(email.trim(), wachtwoord);
      await onLogin(user);
    } catch (err) {
      if (err.needsVerify) {
        setInfo(err.message);
        setToonHerverzenden(true);
      } else {
        setError(err.message || "Er ging iets mis bij het aanmelden. Probeer opnieuw.");
      }
    } finally {
      setBezig(false);
    }
  };
  const submitRegister = async () => {
    if (bezig) return;
    setError(""); setInfo(""); setToonHerverzenden(false);
    if (!naam.trim() || !email.trim() || !wachtwoord) { setError("Vul alle velden in."); return; }
    if (wachtwoord.length < 6) { setError("Wachtwoord moet minstens 6 tekens bevatten."); return; }
    if (!akkoordVoorwaarden) { setError("Je moet akkoord gaan met de gebruiksvoorwaarden om een account aan te maken."); return; }
    setBezig(true);
    try {
      const { user, session } = await registreer(email.trim(), wachtwoord, naam.trim());
      if (user && session) {
        // e-mailbevestiging staat uit voor dit Supabase-project: meteen ingelogd
        await onRegister(user);
      } else {
        // e-mailbevestiging staat aan: check je mailbox en klik op de bevestigingslink
        setInfo("Account aangemaakt! Check je mailbox en klik op de bevestigingslink om je account te activeren.");
        setToonHerverzenden(true);
        setMode("login");
      }
    } catch (err) {
      setError(err.message || "Er ging iets mis bij het registreren. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  };
  const opnieuwVersturen = async () => {
    if (bezig || !email.trim()) return;
    setError(""); setInfo("");
    setBezig(true);
    try {
      await stuurBevestigingOpnieuw(email.trim());
      setInfo("Bevestigingsmail opnieuw verstuurd.");
    } catch (err) {
      setError(err.message || "Kon de mail niet opnieuw versturen. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  };
  const submitForgot = async () => {
    if (bezig) return;
    setError(""); setInfo("");
    if (!email.trim()) { setError("Vul je e-mailadres in."); return; }
    setBezig(true);
    try {
      await vraagWachtwoordResetAan(email.trim());
      setInfo("Als dit e-mailadres bij ons gekend is, hebben we een link gestuurd om een nieuw wachtwoord in te stellen — klik op die link in je mailbox.");
      setMode("login");
    } catch (err) {
      setError(err.message || "Er ging iets mis. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  };
  const onEnter = (fn) => (e) => { if (e.key === "Enter") fn(); };

  return (
    <div className="w-full flex flex-col items-center justify-center" style={{ minHeight: 560, background: PAPER, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="rounded-xl p-8" style={{ width: 360, background: PAPER_RAISED, border: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Home size={18} style={{ color: BRASS }} />
          <span style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: INK }}>Houpels Valuation & Real Estate</span>
        </div>
        <div className="text-xs mb-6" style={{ color: INK_SOFT }}>Taxatiedossiers — aanmelden</div>

        {(mode === "login" || mode === "register") && (
          <div className="flex mb-5 rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); setToonHerverzenden(false); }}
              className="flex-1 text-xs py-2"
              style={{ background: mode === "login" ? INK : PAPER_RAISED, color: mode === "login" ? "#fff" : INK_SOFT, fontWeight: 500 }}>
              Aanmelden
            </button>
            <button type="button" onClick={() => { setMode("register"); setError(""); setInfo(""); setToonHerverzenden(false); }}
              className="flex-1 text-xs py-2"
              style={{ background: mode === "register" ? INK : PAPER_RAISED, color: mode === "register" ? "#fff" : INK_SOFT, fontWeight: 500 }}>
              Nieuwe makelaar
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        {info && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: STAMP_SOFT, color: STAMP }}>
            <Check size={13} /> {info}
          </div>
        )}

        {mode === "login" && (
          <div className="flex flex-col gap-3">
            <Field label="E-mail"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(submitLogin)} /></Field>
            <Field label="Wachtwoord"><TextInput type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} onKeyDown={onEnter(submitLogin)} /></Field>
            <button type="button" onClick={submitLogin} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig..." : "Aanmelden"}
            </button>
            {toonHerverzenden && (
              <button type="button" onClick={opnieuwVersturen} disabled={bezig} className="text-xs text-center" style={{ color: BRASS, background: "none", fontWeight: 500 }}>
                Bevestigingsmail opnieuw versturen
              </button>
            )}
            <button type="button" onClick={() => { setMode("forgot"); setError(""); setInfo(""); setToonHerverzenden(false); }}
              className="text-xs text-center" style={{ color: BRASS, background: "none", fontWeight: 500 }}>
              Wachtwoord vergeten?
            </button>
          </div>
        )}
        {mode === "register" && (
          <div className="flex flex-col gap-3">
            <Field label="Naam"><TextInput value={naam} onChange={(e) => setNaam(e.target.value)} onKeyDown={onEnter(submitRegister)} /></Field>
            <Field label="E-mail"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(submitRegister)} /></Field>
            <Field label="Wachtwoord"><TextInput type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} onKeyDown={onEnter(submitRegister)} /></Field>
            <label className="flex items-start gap-2 text-xs cursor-pointer select-none" style={{ color: INK_SOFT }}>
              <input type="checkbox" checked={akkoordVoorwaarden} onChange={(e) => setAkkoordVoorwaarden(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: BRASS, marginTop: 1 }} />
              <span>
                Ik heb de{" "}
                <button type="button" onClick={() => setToonVoorwaarden(true)} className="underline" style={{ color: BRASS, background: "none" }}>
                  gebruiksvoorwaarden
                </button>{" "}
                en de{" "}
                <button type="button" onClick={() => setToonPrivacy(true)} className="underline" style={{ color: BRASS, background: "none" }}>
                  privacyverklaring
                </button>{" "}
                gelezen en ga ermee akkoord.
              </span>
            </label>
            <button type="button" onClick={submitRegister} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig..." : "Account aanmaken"}
            </button>
          </div>
        )}
        {mode === "forgot" && (
          <div className="flex flex-col gap-3">
            <div className="text-xs" style={{ color: INK_SOFT }}>Vul je e-mailadres in — we sturen je een link om een nieuw wachtwoord in te stellen.</div>
            <Field label="E-mail"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(submitForgot)} /></Field>
            <button type="button" onClick={submitForgot} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig..." : "Verstuur link"}
            </button>
            <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); }}
              className="text-xs text-center" style={{ color: INK_SOFT, background: "none" }}>
              Terug naar aanmelden
            </button>
          </div>
        )}
      </div>
      <a href="/handleiding-taxatie-app-huyzen.pdf" target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs mt-4" style={{ width: 360, color: INK_SOFT, textDecoration: "none" }}>
        <Download size={13} /> Handleiding taxatie-app (PDF)
      </a>
      <div className="flex items-center gap-3 mt-2" style={{ width: 360 }}>
        <button type="button" onClick={() => setToonVoorwaarden(true)}
          className="text-xs underline" style={{ textAlign: "left", color: INK_SOFT, background: "none" }}>
          Gebruiksvoorwaarden
        </button>
        <button type="button" onClick={() => setToonPrivacy(true)}
          className="text-xs underline" style={{ textAlign: "left", color: INK_SOFT, background: "none" }}>
          Privacyverklaring
        </button>
      </div>
      {toonVoorwaarden && <VoorwaardenModal onClose={() => setToonVoorwaarden(false)} />}
      {toonPrivacy && <PrivacyverklaringModal onClose={() => setToonPrivacy(false)} />}
    </div>
  );
}

// ---------- dashboard ----------
function Dashboard({ user, index, onOpen, onNew, onDelete, onLogout, onOpenAccount, onRefresh, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  const [zoek, setZoek] = useState("");
  const [verversen, setVerversen] = useState(false);
  const handleRefreshClick = async () => {
    if (verversen) return;
    setVerversen(true);
    try { await onRefresh(); } finally { setVerversen(false); }
  };
  // een beheerder ziet ALLE dossiers (de rijregels op de databank geven die al mee terug, zie
  // loadIndex/schema.sql) — een gewone makelaar blijft, ook client-side, tot de eigen dossiers
  // beperkt als extra veiligheidsmarge bovenop de databank-regels.
  const mine = user.isAdmin ? index : index.filter((x) => x.ownerId === user.id);
  const matches = (x) => {
    const t = `${x.straat} ${x.nummer} ${x.gemeente} ${x.postcode} ${x.makelaarNaam || ""}`.toLowerCase();
    return t.includes(zoek.toLowerCase());
  };
  const concepten = mine.filter((x) => x.status !== "afgewerkt" && matches(x))
    .sort((a, b) => new Date(b.laatstBewerkt || 0) - new Date(a.laatstBewerkt || 0));
  const afgewerkt = mine.filter((x) => x.status === "afgewerkt" && matches(x))
    .sort((a, b) => new Date(b.laatstBewerkt || 0) - new Date(a.laatstBewerkt || 0));

  const fmtDatum = (iso) => {
    if (!iso) return "";
    const dt = new Date(iso);
    return dt.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
  };

  const Row = ({ x }) => (
    <div onClick={() => onOpen(x.id)} className="flex items-center justify-between px-4 py-3 rounded-lg mb-2 cursor-pointer transition-colors"
      style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: INK }}>
          {x.straat ? `${x.straat} ${x.nummer}${x.bus ? "/" + x.bus : ""}` : "Naamloos dossier"}
        </div>
        <div style={{ fontSize: 12, color: INK_SOFT }}>
          {x.postcode} {x.gemeente}
          {user.isAdmin && x.makelaarNaam && <> · <strong style={{ color: INK_SOFT, fontWeight: 600 }}>{x.makelaarNaam}</strong></>}
          {" "}· laatst bewerkt {fmtDatum(x.laatstBewerkt)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs px-2.5 py-1 rounded-full" style={{
          background: x.status === "afgewerkt" ? STAMP_SOFT : BRASS_SOFT,
          color: x.status === "afgewerkt" ? STAMP : BRASS, fontWeight: 500,
        }}>{x.status === "afgewerkt" ? "Afgewerkt" : "Concept"}</span>
        <button onClick={(e) => {
          e.stopPropagation();
          const naam = x.straat ? `${x.straat} ${x.nummer}${x.bus ? "/" + x.bus : ""}` : "dit naamloze dossier";
          if (window.confirm(`Dossier "${naam}" definitief verwijderen? Dit kan niet ongedaan gemaakt worden.`)) onDelete(x.id);
        }}><Trash2 size={14} style={{ color: DANGER }} /></button>
      </div>
    </div>
  );

  return (
    <div className="w-full rounded-xl overflow-hidden" style={{ background: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif", minHeight: 600 }}>
      {/* kopbalk mag afbreken op een klein scherm i.p.v. alles op één rij te persen */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 md:px-6 py-3 md:py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2">
          <Home size={16} style={{ color: BRASS }} />
          <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500 }}>{user.isAdmin ? "Alle dossiers" : "Mijn dossiers"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {user.isAdmin && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#FBEAEA", color: DANGER, fontWeight: 500 }}>
              Beheerder — ziet dossiers van alle makelaars
            </span>
          )}
          {/* toont welke huisstijl actief is voor de ingelogde gebruiker (bepaald door e-mailadres,
              zie kiesHuisstijl) — vooral handig om meteen visueel te kunnen nagaan of bv. een
              @huyzen.be-account effectief de Huyzen-huisstijl krijgt, zonder een rapport te moeten
              genereren. */}
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: hs.key === "houpels" ? BRASS_SOFT : `${hs.kleur}22`, color: hs.kleur, fontWeight: 500 }}>
            Huisstijl: {hs.naam}
          </span>
          <span className="text-sm" style={{ color: INK_SOFT }}>{user.naam} · {user.email}</span>
          <button onClick={onOpenAccount} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <Settings size={13} /> Mijn account
          </button>
          <button onClick={handleRefreshClick} disabled={verversen} title="Lijst opnieuw ophalen"
            className="p-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <RefreshCw size={14} className={verversen ? "animate-spin" : ""} />
          </button>
          <button onClick={onLogout} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>Afmelden</button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6 gap-3">
          <TextInput placeholder={user.isAdmin ? "Zoek op adres, gemeente of makelaar..." : "Zoek op adres of gemeente..."} value={zoek} onChange={(e) => setZoek(e.target.value)} style={{ maxWidth: 320 }} />
          <button onClick={onNew} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg text-white" style={{ background: INK, fontWeight: 500 }}>
            <Plus size={14} /> Nieuw dossier
          </button>
        </div>

        <div className="mb-8">
          <div className="text-xs mb-2" style={{ color: BRASS, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Conceptdossiers ({concepten.length})
          </div>
          {concepten.length === 0
            ? <div className="text-sm italic" style={{ color: INK_SOFT }}>Geen conceptdossiers.</div>
            : concepten.map((x) => <Row key={x.id} x={x} />)}
        </div>

        <div>
          <div className="text-xs mb-2" style={{ color: STAMP, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Afgewerkte dossiers ({afgewerkt.length})
          </div>
          {afgewerkt.length === 0
            ? <div className="text-sm italic" style={{ color: INK_SOFT }}>Geen afgewerkte dossiers.</div>
            : afgewerkt.map((x) => <Row key={x.id} x={x} />)}
        </div>
      </div>
    </div>
  );
}

// ---------- mijn account: eigen contactgegevens, BIV-/Vlabel-nummer ----------
// deze gegevens worden bij elk NIEUW dossier automatisch ingevuld bij "Identificatie
// schatter-expert" (zie handleNew() in AppRoot), zodat een makelaar dit niet telkens opnieuw
// moet intypen. Bestaande dossiers wijzigen niet met terugwerkende kracht.
function AccountScherm({ user, onSave, onBack }) {
  const [naam, setNaam] = useState(user.naam || "");
  const [telefoon, setTelefoon] = useState(user.telefoon || "");
  const [titel, setTitel] = useState(user.titel || "");
  const [bivNummer, setBivNummer] = useState(user.bivNummer || "");
  const [vlabelNummer, setVlabelNummer] = useState(user.vlabelNummer || "");
  const [status, setStatus] = useState(null); // { type: "ok" | "fout", message }
  const [bezig, setBezig] = useState(false);
  const [toonVoorwaarden, setToonVoorwaarden] = useState(false);
  const [toonPrivacy, setToonPrivacy] = useState(false);

  const submit = async () => {
    setBezig(true);
    setStatus(null);
    try {
      await onSave({ naam: naam.trim(), telefoon: telefoon.trim(), titel: titel.trim(), bivNummer: bivNummer.trim(), vlabelNummer: vlabelNummer.trim() });
      setStatus({ type: "ok", message: "Opgeslagen. Deze gegevens worden vanaf nu automatisch ingevuld bij elk nieuw dossier." });
    } catch (e) {
      setStatus({ type: "fout", message: e.message || "Opslaan mislukt." });
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="w-full rounded-xl overflow-hidden" style={{ background: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif", minHeight: 600 }}>
      <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <button onClick={onBack} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <ChevronLeft size={13} /> Overzicht
        </button>
        <Settings size={16} style={{ color: BRASS }} />
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500 }}>Mijn account</div>
      </div>

      <div className="p-6" style={{ maxWidth: 480 }}>
        <div className="text-xs mb-6" style={{ color: INK_SOFT }}>
          Deze gegevens worden automatisch ingevuld bij "Identificatie schatter-expert" telkens je een nieuw dossier aanmaakt — je hoeft ze dan niet meer telkens opnieuw in te typen. Bestaande dossiers passen niet met terugwerkende kracht aan.
        </div>

        <div className="grid gap-4 mb-6">
          <Field label="E-mailadres" hint="Kan hier niet gewijzigd worden — dit is het adres waarmee je aanmeldt.">
            <TextInput value={user.email} disabled style={{ opacity: 0.6 }} />
          </Field>
          <Field label="Naam"><TextInput value={naam} onChange={(e) => setNaam(e.target.value)} /></Field>
          <Field label="Telefoonnummer"><TextInput value={telefoon} onChange={(e) => setTelefoon(e.target.value)} placeholder="bv. 0470 12 34 56" /></Field>
          <Field label="(Beroeps)titel"><TextInput value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="bv. Vastgoedmakelaar - Vlabel-erkend schatter" /></Field>
          <Field label="BIV-nummer" hint="Erkenningsnummer bij het Beroepsinstituut van Vastgoedmakelaars">
            <TextInput value={bivNummer} onChange={(e) => setBivNummer(e.target.value)} />
          </Field>
          <Field label="Vlabel-identificatienummer" hint="Door de Vlaamse Belastingdienst toegekend identificatienummer voor schatters-experten">
            <TextInput value={vlabelNummer} onChange={(e) => setVlabelNummer(e.target.value)} />
          </Field>
        </div>

        {status && (
          <div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{
            background: status.type === "ok" ? "#DCFCE7" : "#fee2e2",
            color: status.type === "ok" ? "#166534" : "#991b1b",
          }}>
            {status.message}
          </div>
        )}

        <button onClick={submit} disabled={bezig} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg text-white"
          style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
          {bezig ? "Bezig met opslaan..." : "Opslaan"}
        </button>

        <div className="flex items-center gap-3 mt-6">
          <button type="button" onClick={() => setToonVoorwaarden(true)} className="text-xs underline" style={{ color: INK_SOFT, background: "none" }}>
            Gebruiksvoorwaarden bekijken
          </button>
          <button type="button" onClick={() => setToonPrivacy(true)} className="text-xs underline" style={{ color: INK_SOFT, background: "none" }}>
            Privacyverklaring bekijken
          </button>
        </div>
      </div>
      {toonVoorwaarden && <VoorwaardenModal onClose={() => setToonVoorwaarden(false)} />}
      {toonPrivacy && <PrivacyverklaringModal onClose={() => setToonPrivacy(false)} />}
    </div>
  );
}

// ---------- app root: authenticatie + navigatie ----------
export default function AppRoot() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState([]);
  const [view, setView] = useState("login"); // login | dashboard | wizard
  const [activeDossier, setActiveDossier] = useState(null);
  // de huisstijl (Houpels/Huyzen) van het dossier dat momenteel open staat — bepaald door het
  // e-mailadres van de EIGENAAR van dat dossier, niet van de ingelogde gebruiker. Voor een gewone
  // makelaar is dat toch altijd hetzelfde (die opent enkel eigen dossiers), maar een beheerder die
  // een dossier van een collega opent, ziet zo de huisstijl van die collega i.p.v. de eigen —
  // zie handleOpen/handleNew hieronder en kiesHuisstijl() bovenaan dit bestand.
  const [activeHuisstijl, setActiveHuisstijl] = useState(null);
  // wordt true zodra de gebruiker op de "wachtwoord vergeten"-link in zijn mailbox klikt — Supabase
  // meldt die gebruiker dan zelf al (tijdelijk) aan en stuurt het "PASSWORD_RECOVERY"-event, zie de
  // listener hieronder. Zolang dit true is, tonen we enkel het "nieuw wachtwoord instellen"-scherm.
  const [herstelModus, setHerstelModus] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHerstelModus(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // bouwt het sessie-object dat de rest van de app gebruikt (session.id, session.naam, ...)
  // op basis van de Supabase auth-gebruiker + diens weergavenaam uit de profielen-tabel
  const bouwSessie = async (user) => {
    const { naam, isAdmin, telefoon, titel, bivNummer, vlabelNummer } = await haalProfiel(user.id, user.email);
    return { id: user.id, naam, email: user.email, isAdmin, telefoon, titel, bivNummer, vlabelNummer };
  };

  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        const user = await haalHuidigeGebruiker();
        if (!actief) return;
        if (user) {
          const [s, idx] = await Promise.all([bouwSessie(user), loadIndex()]);
          if (!actief) return;
          setSession(s);
          setIndex(idx);
          setView("dashboard");
        }
      } catch (e) {
        // geen actieve sessie, of Supabase (nog) niet bereikbaar — gewoon het aanmeldscherm tonen
      } finally {
        if (actief) setLoading(false);
      }
    })();
    return () => { actief = false; };
  }, []);

  const handleLogin = async (user) => {
    const [s, idx] = await Promise.all([bouwSessie(user), loadIndex()]);
    setSession(s);
    setIndex(idx);
    setView("dashboard");
  };
  const handleRegister = async (user) => { await handleLogin(user); };
  const handleRefresh = async () => { setIndex(await loadIndex()); };
  // stille dubbelcheck kort na het aanmelden: lost een zeldzaam, kortstondig probleem op waarbij
  // een beheerder net na het inloggen niet meteen alle dossiers van alle makelaars te zien krijgt
  // (enkel de eigen) — een paginaherlaad haalt de volledige lijst wél altijd correct op, dus we
  // doen hier automatisch hetzelfde: de lijst gewoon nog eens ophalen, zonder dat de gebruiker
  // daarvoor zelf iets moet doen. Enkel bij het aanmelden zelf (session?.id als dependency), niet
  // bij elke wijziging van de lijst nadien.
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => { loadIndex().then(setIndex); }, 2000);
    return () => clearTimeout(t);
  }, [session?.id]);
  const handleLogout = async () => {
    await uitloggen();
    setSession(null); setActiveDossier(null); setActiveHuisstijl(null); setIndex([]); setView("login");
  };

  const handleNew = () => {
    const now = new Date().toISOString();
    // een nieuw dossier is altijd van de ingelogde gebruiker zelf, dus diens eigen huisstijl
    setActiveHuisstijl(kiesHuisstijl(session.email));
    const nieuwDossier = {
      ...initialData, id: nieuweDossierId(), ownerId: session.id, status: "concept", aangemaaktOp: now, laatstBewerkt: now,
      // "Naam schatter-expert" (bij Opdracht & partijen) automatisch invullen met de naam van de
      // ingelogde gebruiker zelf i.p.v. steeds de vaste standaardwaarde uit initialData — zo krijgt
      // elke makelaar bij een nieuw dossier meteen zijn/haar eigen naam, niet die van een ander —
      // en de rest van "Identificatie schatter-expert" komt automatisch mee vanuit "Mijn account"
      schatterNaam: session.naam || initialData.schatterNaam,
      schatterTitel: session.titel || initialData.schatterTitel,
      schatterBivNummer: session.bivNummer || "",
      schatterVlabelNummer: session.vlabelNummer || "",
      schatterTelefoon: session.telefoon || "",
    };
    setActiveDossier(nieuwDossier);
    setView("wizard");
    // meteen (niet afgewacht, om de overgang naar de wizard niet te vertragen) een eerste keer
    // opslaan — dus vóór de gewone gedebouncede autosave. Nodig omdat de tijdelijke-bijlage-
    // uploads (AI-documentanalyse, foto's voor de PDF) via de storage-toegangsregels controleren
    // of er al een dossiers-rij met dit id bestaat die van deze gebruiker is; zonder deze meteen-
    // opslag zou dat, in het onwaarschijnlijke maar mogelijke geval dat iemand binnen de eerste
    // seconde na "Nieuw dossier" al een document uploadt, geweigerd worden.
    saveDossier(nieuwDossier, index, setIndex).catch(() => {});
    logDossierEvent(nieuwDossier.id, session.id, "aangemaakt");
  };
  const handleOpen = async (id) => {
    const dossier = await loadDossier(id);
    // samenvoegen met initialData: zo krijgen velden die na het opslaan van dit dossier zijn
    // toegevoegd (zoals extraRuimtes) altijd een geldige standaardwaarde in plaats van undefined
    if (dossier) {
      // eigen dossier: geen extra opzoeking nodig, dat is toch de eigen huisstijl. Enkel voor een
      // dossier van iemand anders (een beheerder die inspringt) zoeken we het e-mailadres van de
      // ÉCHTE eigenaar op, zodat de juiste huisstijl (Houpels/Huyzen) van díe makelaar getoond wordt
      // i.p.v. de huisstijl van de ingelogde beheerder.
      let eigenaarEmail = session.email;
      if (dossier.ownerId && dossier.ownerId !== session.id) {
        const { data: profiel } = await supabase.from("profielen").select("email").eq("id", dossier.ownerId).single();
        if (profiel?.email) eigenaarEmail = profiel.email;
        // een beheerder die in het dossier van een collega inspringt, wordt gelogd — zie audit, punt H4
        logDossierEvent(id, session.id, "geopend_door_beheerder");
      }
      setActiveHuisstijl(kiesHuisstijl(eigenaarEmail));
      setActiveDossier({ ...initialData, ...dossier });
      setView("wizard");
    }
  };
  const handleDelete = async (id) => {
    const res = await deleteDossier(id, index, setIndex);
    if (res && res.ok === false) {
      alert(`Verwijderen mislukt: ${res.error || "onbekende fout"}. Het dossier staat nog steeds in de lijst.`);
    } else {
      logDossierEvent(id, session.id, "verwijderd");
    }
  };
  const handleBackToDashboard = () => { setView("dashboard"); setActiveDossier(null); };
  const handleSave = (dossier) => saveDossier(dossier, index, setIndex);
  const handleOpenAccount = () => setView("account");
  // slaat "Mijn account" op in profielen én werkt meteen de lopende sessie bij, zodat een
  // volgend nieuw dossier (handleNew) zonder opnieuw in te loggen al de nieuwe gegevens gebruikt
  const handleSaveAccount = async (gegevens) => {
    await updateProfiel(session.id, gegevens);
    setSession((s) => ({ ...s, ...gegevens }));
  };
  // nadat het nieuwe wachtwoord is ingesteld: de sessie die de herstellink al aanmaakte is nu een
  // volwaardige sessie, dus meteen doorstromen naar het dashboard zoals na een gewone aanmelding.
  const handleHerstelKlaar = async () => {
    const user = await haalHuidigeGebruiker();
    setHerstelModus(false);
    if (user) await handleLogin(user);
  };

  if (herstelModus) {
    return <WachtwoordHerstellenScreen onDone={handleHerstelKlaar} />;
  }
  if (loading) {
    return <div className="w-full flex items-center justify-center" style={{ minHeight: 400, color: INK_SOFT, fontFamily: "system-ui" }}>Laden...</div>;
  }
  if (view === "login" || !session) {
    return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }
  // huisstijl (naam/kleur/logo) wordt bepaald door het e-mailadres van de ingelogde gebruiker —
  // zie kiesHuisstijl hierboven. Standaard Houpels, automatisch Huyzen Vastgoed voor @huyzen.be.
  // Voor het dashboard (overzicht van álle dossiers bij een beheerder) is er geen "eigenaar" van
  // de hele pagina — dat blijft dus de huisstijl van de ingelogde gebruiker zelf.
  const huisstijl = kiesHuisstijl(session?.email);
  if (view === "wizard" && activeDossier) {
    // huisstijl van het GEOPENDE dossier (bepaald in handleOpen/handleNew op basis van de
    // eigenaar) — valt terug op de eigen huisstijl zolang die nog niet gezet is
    return <DossierWizard initialDossier={activeDossier} onBack={handleBackToDashboard} onSave={handleSave} huisstijl={activeHuisstijl || huisstijl} />;
  }
  if (view === "account") {
    return <AccountScherm user={session} onSave={handleSaveAccount} onBack={handleBackToDashboard} />;
  }
  return <Dashboard user={session} index={index} onOpen={handleOpen} onNew={handleNew} onDelete={handleDelete} onLogout={handleLogout} onOpenAccount={handleOpenAccount} onRefresh={handleRefresh} huisstijl={huisstijl} />;
}

// scherm na het klikken op de "wachtwoord vergeten"-link in de mailbox: enkel nog een nieuw
// wachtwoord kiezen (de link zelf meldt de gebruiker al aan, zie de PASSWORD_RECOVERY-listener
// in AppRoot hierboven)
function WachtwoordHerstellenScreen({ onDone }) {
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState("");
  const [nieuwWachtwoordBevestig, setNieuwWachtwoordBevestig] = useState("");
  const [error, setError] = useState("");
  const [bezig, setBezig] = useState(false);

  const submit = async () => {
    if (bezig) return;
    setError("");
    if (nieuwWachtwoord.length < 6) { setError("Nieuw wachtwoord moet minstens 6 tekens bevatten."); return; }
    if (nieuwWachtwoord !== nieuwWachtwoordBevestig) { setError("De wachtwoorden komen niet overeen."); return; }
    setBezig(true);
    try {
      await stelNieuwWachtwoordIn(nieuwWachtwoord);
      await onDone();
    } catch (err) {
      setError(err.message || "Er ging iets mis bij het wijzigen van je wachtwoord. Probeer opnieuw.");
      setBezig(false);
    }
  };
  const onEnter = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="w-full flex items-center justify-center" style={{ minHeight: 560, background: PAPER, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="rounded-xl p-8" style={{ width: 360, background: PAPER_RAISED, border: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Home size={18} style={{ color: BRASS }} />
          <span style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: INK }}>Houpels Valuation & Real Estate</span>
        </div>
        <div className="text-xs mb-6" style={{ color: INK_SOFT }}>Nieuw wachtwoord instellen</div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Field label="Nieuw wachtwoord"><TextInput type="password" value={nieuwWachtwoord} onChange={(e) => setNieuwWachtwoord(e.target.value)} onKeyDown={onEnter} /></Field>
          <Field label="Bevestig nieuw wachtwoord"><TextInput type="password" value={nieuwWachtwoordBevestig} onChange={(e) => setNieuwWachtwoordBevestig(e.target.value)} onKeyDown={onEnter} /></Field>
          <button type="button" onClick={submit} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
            {bezig ? "Bezig..." : "Wachtwoord wijzigen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// tekencomponent voor de handtekening bij de eedformule — canvas met muis/touch-ondersteuning,
// slaat het resultaat als base64 PNG op via onChange (hetzelfde patroon als de andere velden:
// een rauwe stringwaarde, geen event, wat de bestaande set()-helper al correct afhandelt)
function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const tekenendRef = useRef(false);
  const laatstePuntRef = useRef(null);

  const puntUitEvent = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches && e.touches.length ? e.touches[0] : null;
    const clientX = t ? t.clientX : e.clientX;
    const clientY = t ? t.clientY : e.clientY;
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (e) => {
    e.preventDefault();
    tekenendRef.current = true;
    laatstePuntRef.current = puntUitEvent(e, canvasRef.current);
  };
  const teken = (e) => {
    if (!tekenendRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const punt = puntUitEvent(e, canvas);
    ctx.strokeStyle = "#1B1F27";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(laatstePuntRef.current.x, laatstePuntRef.current.y);
    ctx.lineTo(punt.x, punt.y);
    ctx.stroke();
    laatstePuntRef.current = punt;
  };
  const stop = () => {
    if (!tekenendRef.current) return;
    tekenendRef.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };
  const wis = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  if (value) {
    return (
      <div>
        <div className="rounded-lg p-3 inline-block" style={{ border: `1px solid ${LINE}`, background: "#fff" }}>
          <img src={value} alt="Handtekening" style={{ height: 80, display: "block" }} />
        </div>
        <div>
          <button onClick={wis} type="button" className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
            style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <Trash2 size={13} /> Opnieuw ondertekenen
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <canvas ref={canvasRef} width={500} height={150}
        style={{ border: `1px solid ${LINE}`, background: "#fff", borderRadius: 8, width: "100%", maxWidth: 500, height: 150, cursor: "crosshair", touchAction: "none" }}
        onMouseDown={start} onMouseMove={teken} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={teken} onTouchEnd={stop} />
      <div className="text-xs mt-1" style={{ color: INK_SOFT }}>Teken hier de handtekening met muis, trackpad of touchscreen.</div>
    </div>
  );
}

// ---------- step 0: opdracht & verkoper ----------
function StepOpdracht({ d, set, addEigenaar, removeEigenaar, updateEigenaar }) {
  const [mapError, setMapError] = useState(false);
  const [cadgisLoading, setCadgisLoading] = useState(false);
  const [cadgisError, setCadgisError] = useState(false);
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}, België`;
  const adresVolledig = d.straat && d.gemeente;
  const mapSrc = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;
  const staticMapUrl = buildStaticMapUrl(adres);

  // zoekt automatisch de perceelsgeometrie (bbox + de buitenrand van het perceel zelf, voor de
  // markering) op zodra een CaPaKey is ingevuld of gewijzigd — het resultaat wordt in het dossier
  // bewaard (zie cadgisBbox/cadgisRingen hierboven) zodat het verslag zelf nadien geen live
  // opzoeking meer hoeft te doen.
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
  }, [d.capakey]);

  // pandadres zonder ", België" — het formaat dat in het verslag zelf gebruikt wordt, zie ook
  // buildReportData's "adres"-opbouw
  const pandAdresKort = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`.trim();

  // "zelfde als"-vlaggen automatisch doorvoeren: zo moet de gebruiker adres/naam niet meermaals
  // intypen wanneer opdrachtgever, verkoper en/of eigenaar in werkelijkheid dezelfde persoon of
  // hetzelfde adres betreffen — zie ook de checkboxen verderop in deze stap.
  useEffect(() => {
    if (d.opdrachtgeverAdresZelfde && d.opdrachtgeverAdres !== pandAdresKort) set("opdrachtgeverAdres")(pandAdresKort);
  }, [d.opdrachtgeverAdresZelfde, pandAdresKort]);
  useEffect(() => {
    if (d.verkoperAdresZelfde && d.verkoperAdres !== pandAdresKort) set("verkoperAdres")(pandAdresKort);
  }, [d.verkoperAdresZelfde, pandAdresKort]);
  useEffect(() => {
    if (!d.opdrachtgeverIsEigenaar) return;
    if (d.eigenaars.length === 0) { addEigenaar(); return; }
    if (d.eigenaars[0].naam !== d.opdrachtgeverNaam) updateEigenaar(d.eigenaars[0].id, "naam", d.opdrachtgeverNaam);
  }, [d.opdrachtgeverIsEigenaar, d.opdrachtgeverNaam, d.eigenaars]);

  return (
    <div>
      <Section title="Identificatie schatter-expert" icon={ClipboardList}>
        <Field label="Naam schatter-expert"><TextInput value={d.schatterNaam} onChange={set("schatterNaam")} /></Field>
        <Field label="(Beroeps)titel"><TextInput value={d.schatterTitel} onChange={set("schatterTitel")} /></Field>
        <Field label="Vlabel-identificatienummer" hint="Door de Vlaamse Belastingdienst toegekend identificatienummer voor schatters-experten">
          <TextInput value={d.schatterVlabelNummer} onChange={set("schatterVlabelNummer")} />
        </Field>
        <Field label="BIV-nummer" hint="Erkenningsnummer bij het Beroepsinstituut van Vastgoedmakelaars">
          <TextInput value={d.schatterBivNummer} onChange={set("schatterBivNummer")} />
        </Field>
        <Field label="Telefoon schatter-expert"><TextInput value={d.schatterTelefoon} onChange={set("schatterTelefoon")} /></Field>
        <Field label="Handtekening" full hint="Verschijnt bij de eedformule onderaan het verslag">
          <SignaturePad value={d.handtekening} onChange={set("handtekening")} />
        </Field>
      </Section>
      <Section title="Opdracht" icon={ClipboardList}>
        <Field label="Opdrachtgever (naam of benaming)"><TextInput value={d.opdrachtgeverNaam} onChange={set("opdrachtgeverNaam")} /></Field>
        <div>
          <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>Adres opdrachtgever</span>
          <TextInput value={d.opdrachtgeverAdres} onChange={set("opdrachtgeverAdres")} disabled={d.opdrachtgeverAdresZelfde} />
          <Checkbox label="Zelfde als adres pand" checked={d.opdrachtgeverAdresZelfde} onChange={set("opdrachtgeverAdresZelfde")} />
        </div>
        <Field label="Rijksregisternummer / ondernemingsnummer"><TextInput value={d.opdrachtgeverIdNummer} onChange={set("opdrachtgeverIdNummer")} /></Field>
        <Field label="Wettelijke vertegenwoordiger" hint="Indien opdrachtgevende overheidsinstantie"><TextInput value={d.opdrachtgeverVertegenwoordiger} onChange={set("opdrachtgeverVertegenwoordiger")} /></Field>
        <Field label="Reden van waardering"><Select options={OPTS.reden} value={d.reden} onChange={set("reden")} /></Field>
        <Field label="Opdrachtgever aanwezig bij bezoek"><Select options={OPTS.jaNee.slice(0, 2)} value={d.opdrachtgeverAanwezig} onChange={set("opdrachtgeverAanwezig")} /></Field>
        <Field label="Datum plaatsbezoek"><TextInput type="date" value={d.datumBezoek} onChange={set("datumBezoek")} /></Field>
        <Field label="Datum verslag"><TextInput type="date" value={d.datumVerslag} onChange={set("datumVerslag")} /></Field>
        {/* stond voordien vast in de code ("Beveren"), waardoor élk verslag met die plaats afsloot,
            ook een schatting elders */}
        <Field label="Plaats eedformule" hint='Verschijnt onderaan het verslag als "Gedaan te …"'>
          <TextInput value={d.eedPlaats} onChange={set("eedPlaats")} />
        </Field>
        {d.reden !== "Nalatenschap" && (
          <Field label="Referentiedatum schatting" full
            hint="Datum waarop de waarde van het onroerend goed wordt bepaald">
            <TextInput type="date" value={d.referentiedatum} onChange={set("referentiedatum")} />
          </Field>
        )}
        {d.reden === "Nalatenschap" && (
          <div className="col-span-2 rounded-lg p-4" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
            <div className="flex items-center gap-2 mb-3">
              <Users size={15} style={{ color: BRASS }} />
              <h4 style={{ fontFamily: "Georgia, serif", fontSize: 14, color: INK, fontWeight: 500 }}>Nalatenschap — overleden persoon (Vlabel-schatting)</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Naam overleden persoon"><TextInput value={d.overledenNaam} onChange={set("overledenNaam")} /></Field>
              <Field label="Rijksregisternummer overleden persoon"><TextInput value={d.overledenRijksregisternummer} onChange={set("overledenRijksregisternummer")} /></Field>
              <Field label="Dossiernummer Vlabel"><TextInput value={d.vlabelDossiernummer} onChange={set("vlabelDossiernummer")} /></Field>
              <Field label="Datum overlijden (referentiedatum)" hint="Datum waarop de waarde van het onroerend goed wordt bepaald">
                <TextInput type="date" value={d.referentiedatum} onChange={set("referentiedatum")} />
              </Field>
            </div>
          </div>
        )}
      </Section>
      <Section title="Contactgegevens verkoper" icon={Users}>
        <Field label="Naam"><TextInput value={d.verkoperNaam} onChange={set("verkoperNaam")} /></Field>
        <div>
          <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>Adres</span>
          <TextInput value={d.verkoperAdres} onChange={set("verkoperAdres")} disabled={d.verkoperAdresZelfde} />
          <Checkbox label="Zelfde als adres pand" checked={d.verkoperAdresZelfde} onChange={set("verkoperAdresZelfde")} />
        </div>
        <Field label="Telefoonnummer"><TextInput value={d.verkoperTelefoon} onChange={set("verkoperTelefoon")} /></Field>
        <Field label="E-mail"><TextInput type="email" value={d.verkoperEmail} onChange={set("verkoperEmail")} /></Field>
      </Section>
      <Section title="Adres" icon={MapPin}>
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
          <MapPin size={15} style={{ color: BRASS }} />
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>Kadastrale identificatie</h3>
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
              <a href={mapSrc} target="_blank" rel="noopener noreferrer" style={{ color: BRASS, textDecoration: "none", fontWeight: 500 }}>Open in Google Maps</a>
            </div>
          </div>
        )}
        {adresVolledig && GOOGLE_MAPS_API_KEY && mapError && (
          <div className="rounded-lg p-5 flex items-center justify-between" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: BRASS_SOFT }}>
                <MapPin size={17} style={{ color: BRASS }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: INK }}>{d.straat} {d.nummer}{d.bus ? "/" + d.bus : ""}</div>
                <div style={{ fontSize: 12, color: INK_SOFT }}>{d.postcode} {d.gemeente}</div>
              </div>
            </div>
            <a href={mapSrc} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
              style={{ background: INK, textDecoration: "none" }}>
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
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} style={{ color: BRASS }} />
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>Eigendomstoestand — zakelijke rechten</h3>
        </div>
        <div className="text-xs mb-2" style={{ color: INK_SOFT }}>Elke houder van een zakelijk recht, met zijn aandeel (quotiteit) in de volledige eigendom.</div>
        <Checkbox label="Eigenaar(s) = opdrachtgever" checked={d.opdrachtgeverIsEigenaar} onChange={set("opdrachtgeverIsEigenaar")} />
        <div className="flex flex-col gap-2 mt-1">
          {d.eigenaars.map((e, i) => (
            <div key={e.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 1fr 120px 32px" }}>
              <TextInput placeholder="Naam" value={e.naam} onChange={(ev) => updateEigenaar(e.id, "naam", ev.target.value)}
                disabled={i === 0 && d.opdrachtgeverIsEigenaar} />
              <Select options={OPTS.recht} value={e.recht} onChange={(ev) => updateEigenaar(e.id, "recht", ev.target.value)} />
              <TextInput placeholder="Aandeel (bv. 1/2)" value={e.aandeel} onChange={(ev) => updateEigenaar(e.id, "aandeel", ev.target.value)} />
              <button onClick={() => removeEigenaar(e.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
            </div>
          ))}
        </div>
        <button onClick={addEigenaar} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <Plus size={13} /> Rechthebbende toevoegen
        </button>
      </div>
    </div>
  );
}

function ChipToggle({ options, text, onToggle }) {
  const active = (opt) => (text || "").toLowerCase().includes(opt.toLowerCase());
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const isActive = active(o);
        return (
          <button type="button" key={o} onClick={() => onToggle(o)}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={{
              border: `1px solid ${isActive ? BRASS : LINE}`,
              background: isActive ? BRASS_SOFT : PAPER_RAISED,
              color: isActive ? BRASS : INK_SOFT, fontWeight: 500,
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

// ---------- step: ligging & omgeving ----------
function StepLigging({ d, set }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const adresVolledig = d.straat && d.gemeente;

  const mergeText = (existing, addition) => {
    const have = existing.toLowerCase();
    if (have.includes(addition.toLowerCase())) return existing;
    return existing.trim() ? `${existing.trim()}, ${addition}` : addition;
  };
  const toggleChip = (field, phrase) => {
    const current = d[field] || "";
    if (current.toLowerCase().includes(phrase.toLowerCase())) {
      const cleaned = current.split(/,\s*/).filter((p) => p.trim().toLowerCase() !== phrase.toLowerCase()).join(", ");
      set(field)(cleaned);
    } else {
      set(field)(mergeText(current, phrase));
    }
  };

  const zoekOmgeving = async () => {
    setLoading(true);
    setError("");
    try {
      const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}, België`;
      const prompt = `Zoek op het internet de werkelijke, actuele omgeving en bereikbaarheid op voor het adres: ${adres}.
Geef beknopt en feitelijk (geen overdrijvingen) weer:
1. Voorzieningen in de ruimere omgeving: reële, nabijgelegen handelszaken, scholen, banken, ziekenhuizen, administraties, ontspanning — noem waar mogelijk concrete namen/afstanden.
2. Bereikbaarheid: reële afstand/verbinding met openbaar vervoer (bus/trein) en met de auto (op-/afrit autosnelweg), fietsbereikbaarheid.
Schrijf in het Nederlands, in de stijl van een professioneel taxatieverslag.
Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat:
{"omgevingsvoorzieningen": "...", "bereikbaarheid": "..."}`;

      const raw = await callClaudeWithSearch(prompt);
      const parsed = extractJson(raw);
      if (parsed.omgevingsvoorzieningen) set("omgevingsvoorzieningen")(mergeText(d.omgevingsvoorzieningen, parsed.omgevingsvoorzieningen));
      if (parsed.bereikbaarheid) set("bereikbaarheid")(mergeText(d.bereikbaarheid, parsed.bereikbaarheid));
    } catch (e) {
      setError(`Kon de omgeving niet opzoeken (${e.message || "onbekende fout"}). Probeer opnieuw.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin size={15} style={{ color: BRASS }} />
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>Ligging in de omgeving</h3>
          </div>
          <button onClick={zoekOmgeving} disabled={loading || !adresVolledig}
            title={!adresVolledig ? "Vul eerst straat en gemeente in (stap Opdracht & partijen)" : ""}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
            style={{ background: loading || !adresVolledig ? "#B8B4A8" : STAMP }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {loading ? "Omgeving opzoeken..." : "Opzoeken via AI (op basis van adres)"}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Voorzieningen in de ruimere omgeving" full hint="Handelszaken, banken, scholen, bejaardentehuizen, administraties, ziekenhuizen, ontspanning...">
            <div className="mb-2"><ChipToggle options={OPTS.omgevingsvoorzieningen} text={d.omgevingsvoorzieningen} onToggle={(p) => toggleChip("omgevingsvoorzieningen", p)} /></div>
            <textarea value={d.omgevingsvoorzieningen} onChange={set("omgevingsvoorzieningen")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Bereikbaarheid" full hint="Via openbaar of privaat vervoer">
            <div className="mb-2"><ChipToggle options={OPTS.bereikbaarheid} text={d.bereikbaarheid} onToggle={(p) => toggleChip("bereikbaarheid", p)} /></div>
            <textarea value={d.bereikbaarheid} onChange={set("bereikbaarheid")} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Toestand & uitrusting van de straat" full hint="Nutsvoorzieningen — Vlabel-kwaliteitseis bij een schattingsverslag">
            <div className="mb-2"><ChipToggle options={OPTS.straatuitrusting} text={d.straatuitrusting} onToggle={(p) => toggleChip("straatuitrusting", p)} /></div>
            <textarea value={d.straatuitrusting} onChange={set("straatuitrusting")} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Stedenbouwkundige voorschriften" full hint="Gewestplan, BPA, RUP of verkavelingsplan">
            <TextInput value={d.bpaRupVerkaveling} onChange={set("bpaRupVerkaveling")} />
          </Field>
        </div>
      </div>
      <Section title="Terrein" icon={Ruler}>
        <Field label="Vorm van het perceel"><TextInput value={d.vormPerceel} onChange={set("vormPerceel")} /></Field>
        <Field label="Rooilijnbreedte (m)"><TextInput type="number" value={d.rooilijnbreedte} onChange={set("rooilijnbreedte")} /></Field>
        <Field label="Relatieve hoogteligging"><Select options={OPTS.hoogteligging} value={d.hoogteligging} onChange={set("hoogteligging")} /></Field>
        <Field label="Bodemoccupatie (%)"><TextInput type="number" value={d.bodemoccupatie} onChange={set("bodemoccupatie")} /></Field>
      </Section>
      <Section title="Gebouw — inplanting" icon={Building2}>
        <Field label="Aantal bijgebouwen"><TextInput type="number" value={d.aantalBijgebouwen} onChange={set("aantalBijgebouwen")} /></Field>
        <Field label="Inplanting op het terrein" full><TextInput value={d.inplanting} onChange={set("inplanting")} /></Field>
      </Section>
    </div>
  );
}

// ---------- step 2: type, staat & kadaster ----------
function StepType({ d, set }) {
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

// ---------- step 2: constructie & isolatie ----------
function StepConstructie({ d, set }) {
  // "EPC" hieronder (kWh/m²) is de residentiële berekeningswijze — bij KMO-vastgoed/
  // Bedrijfsvastgoed geldt een ander EPC-regime (kNR/NR, zie epccertificaat.vlaanderen), dat al
  // apart op het tabblad "Bedrijfskenmerken" wordt bevraagd (bedrijfsEpcType) — vandaar hier
  // verborgen i.p.v. dubbele/tegenstrijdige EPC-gegevens te riskeren. De isolatiematerialen
  // zelf (dakisolatie, spouwmuur, ...) blijven wél voor elk vastgoedtype relevant.
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  return (
    <div>
      <Section title="Ruwbouw en vloerplaat" icon={Layers}>
        <Field label="Ruwbouw"><Select options={OPTS.ruwbouw} value={d.ruwbouw} onChange={set("ruwbouw")} /></Field>
        {d.ruwbouw === "Andere" && (
          <Field label="Omschrijving"><TextInput value={d.ruwbouwAndere} onChange={set("ruwbouwAndere")} /></Field>
        )}
        <Field label="Voorgevel">
          <TextInput value={d.voorgevel} onChange={set("voorgevel")} placeholder="bv. gemetste gevelsteen" />
          <QuickChips options={OPTS.gevelmateriaal} onPick={(v) => set("voorgevel")(v)} />
        </Field>
        <Field label="Zijgevel">
          <TextInput value={d.zijgevel} onChange={set("zijgevel")} />
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <QuickChips options={OPTS.gevelmateriaal} onPick={(v) => set("zijgevel")(v)} />
            {d.voorgevel && (
              <button type="button" onClick={() => set("zijgevel")(d.voorgevel)}
                className="text-xs underline mt-1.5" style={{ color: BRASS }}>
                zelfde als voorgevel
              </button>
            )}
          </div>
        </Field>
        <Field label="Achtergevel">
          <TextInput value={d.achtergevel} onChange={set("achtergevel")} />
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <QuickChips options={OPTS.gevelmateriaal} onPick={(v) => set("achtergevel")(v)} />
            {d.voorgevel && (
              <button type="button" onClick={() => set("achtergevel")(d.voorgevel)}
                className="text-xs underline mt-1.5" style={{ color: BRASS }}>
                zelfde als voorgevel
              </button>
            )}
          </div>
        </Field>
        <Field label="Materiaalkwaliteit muren & plafonds" full hint="Vlabel-kwaliteitseis: type constructie en gebruikte materialen — vloeren komen aan bod bij 'Bouwlaag'">
          <TextInput value={d.materiaalkwaliteitOmschrijving} onChange={set("materiaalkwaliteitOmschrijving")} placeholder="bv. binnenmuren gepleisterd, plafonds gipskarton geschilderd" />
        </Field>
      </Section>
      <Section title="Dak" icon={Layers}>
        <Field label="Hoofddak"><Select options={OPTS.hoofddakType} value={d.hoofddakType} onChange={set("hoofddakType")} /></Field>
        <Field label="Materiaal hoofddak"><Select options={OPTS.hoofddakMateriaal} value={d.hoofddakMateriaal} onChange={set("hoofddakMateriaal")} /></Field>
        <Field label="Constructie & materiaal bijgebouw" full>
          <TextInput value={d.bijgebouwConstructie} onChange={set("bijgebouwConstructie")} placeholder="bv. Beton" />
          <QuickChips options={OPTS.bijgebouwConstructieType} onPick={(v) => set("bijgebouwConstructie")(v)} />
        </Field>
      </Section>
      <Section title="Isolatie" icon={Layers}>
        {isResidentieel && (
          <>
            <Field label="EPC"><Select options={OPTS.epcStatus} value={d.epcStatus} onChange={set("epcStatus")} /></Field>
            <Field label="EPC-waarde (kWh/m²)"><TextInput type="number" value={d.epcWaarde} onChange={set("epcWaarde")} /></Field>
            <Field label="EPC-certificaatnummer" full><TextInput value={d.epcCertificaatnummer} onChange={set("epcCertificaatnummer")} /></Field>
          </>
        )}
        <Field label="Isolatie" full>
          <MultiCheck options={OPTS.isolatie} values={d.isolatie} onChange={(v) => set("isolatie")(v)} />
        </Field>
      </Section>
      <Section title="Buitenschrijnwerk" icon={Layers}>
        <Field label="Buitenschrijnwerk" full>
          <MultiCheck options={OPTS.buitenschrijnwerk} values={d.buitenschrijnwerk} onChange={(v) => set("buitenschrijnwerk")(v)} />
        </Field>
      </Section>
    </div>
  );
}

// ---------- step 3: verwarming & installaties ----------
function StepInstallaties({ d, set }) {
  return (
    <div>
      <Section title="Verwarming" icon={Flame}>
        <Field label="Soort" full><MultiCheck options={OPTS.verwarmingSoort} values={d.verwarmingSoort} onChange={(v) => set("verwarmingSoort")(v)} /></Field>
        <Field label="Grondstof" full><MultiCheck options={OPTS.verwarmingGrondstof} values={d.verwarmingGrondstof} onChange={(v) => set("verwarmingGrondstof")(v)} /></Field>
        <Field label="Verwarmingselementen" full><MultiCheck options={OPTS.verwarmingElementen} values={d.verwarmingElementen} onChange={(v) => set("verwarmingElementen")(v)} /></Field>
        <Field label="Merk en type ketel" full><TextInput value={d.ketelMerkType} onChange={set("ketelMerkType")} /></Field>
      </Section>
      <Section title="Warm water" icon={Flame}>
        <Field label="Warm water" full><MultiCheck options={OPTS.warmWater} values={d.warmWater} onChange={(v) => set("warmWater")(v)} /></Field>
        {d.warmWater.includes("Andere") && (
          <Field label="Omschrijving"><TextInput value={d.warmWaterAndere} onChange={set("warmWaterAndere")} /></Field>
        )}
        <Field label="Merk en type ketel" full><TextInput value={d.warmWaterKetelMerkType} onChange={set("warmWaterKetelMerkType")} /></Field>
      </Section>
      <Section title="Technische installaties" icon={Flame}>
        <Field label="Elektrische keuring"><Select options={OPTS.keuringStatus} value={d.keuringStatus} onChange={set("keuringStatus")} /></Field>
        <Field label="Dag + nacht teller"><Select options={OPTS.jaNee.slice(0, 2)} value={d.dagNachtTeller} onChange={set("dagNachtTeller")} /></Field>
        <Field label="Allerlei" full><MultiCheck options={OPTS.allerlei} values={d.allerlei} onChange={(v) => set("allerlei")(v)} /></Field>
      </Section>
    </div>
  );
}

// ---------- step 4: eigenschappen per ruimte ----------
function RoomChecklist({ cfg, state, onChange }) {
  const Icon = cfg.icon;
  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: BRASS }} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>{cfg.label}</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "160px 1fr" }}>
        <TextInput placeholder="Vloer" value={state.vloer} onChange={(e) => onChange("vloer", e.target.value)} />
        {cfg.extraNumber && (
          <TextInput type="number" placeholder={cfg.extraNumber.label} value={state[cfg.extraNumber.key]}
            onChange={(e) => onChange(cfg.extraNumber.key, e.target.value)} style={{ maxWidth: 140 }} />
        )}
        {cfg.extraSelect && (
          <Select options={cfg.extraSelect.opts} value={state[cfg.extraSelect.key]}
            onChange={(e) => onChange(cfg.extraSelect.key, e.target.value)} style={{ maxWidth: 200 }} />
        )}
      </div>
      {cfg.extraMultiCheck && (
        <div className="mt-2">
          <div className="mb-1" style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}>{cfg.extraMultiCheck.label}</div>
          <MultiCheck options={cfg.extraMultiCheck.opts} values={state[cfg.extraMultiCheck.key] || []}
            onChange={(v) => onChange(cfg.extraMultiCheck.key, v)} />
        </div>
      )}
      {cfg.optGroups ? (
        cfg.optGroups.map((g) => (
          <div className="mt-2" key={g.key}>
            <div className="mb-1" style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}>{g.label}</div>
            <MultiCheck options={g.opts} values={state.items} onChange={(v) => onChange("items", v)} />
          </div>
        ))
      ) : (
        <div className="mt-2">
          <MultiCheck options={cfg.opts} values={state.items} onChange={(v) => onChange("items", v)} />
        </div>
      )}
      {cfg.extraText && (
        <TextInput className="mt-2" placeholder={cfg.extraText.placeholder} value={state[cfg.extraText.key]}
          onChange={(e) => onChange(cfg.extraText.key, e.target.value)} />
      )}
    </div>
  );
}

function StepRuimteEigenschappen({ d, setEig, addSlaapkamer, removeSlaapkamer, updateSlaapkamer, addExtraRuimte, removeExtraRuimte, updateExtraRuimte }) {
  return (
    <div>
      <div className="mb-6">
        {RUIMTE_CHECKLISTS.slice(0, 4).map((cfg) => (
          <RoomChecklist key={cfg.key} cfg={cfg} state={d.eigenschappen[cfg.key]}
            onChange={(field, val) => setEig(cfg.key, field, val)} />
        ))}
      </div>

      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <BedDouble size={14} style={{ color: BRASS }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Slaapkamers</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr 110px 90px 32px" }}>
            {["Naam", "Vloer", "Verdieping", "Ingemaakte kast", "Radiator", ""].map((h, i) => (
              <span key={i} className="text-xs" style={{ color: INK_SOFT, fontWeight: 500 }}>{h}</span>
            ))}
          </div>
          {d.slaapkamers.map((s) => (
            <div key={s.id} className="grid gap-2 items-start" style={{ gridTemplateColumns: "1fr 1fr 1fr 110px 90px 32px" }}>
              <TextInput value={s.naam} onChange={(e) => updateSlaapkamer(s.id, "naam", e.target.value)} />
              <TextInput placeholder="Vloer" value={s.vloer} onChange={(e) => updateSlaapkamer(s.id, "vloer", e.target.value)} />
              <TextInput placeholder="Verdieping" value={s.verdieping} onChange={(e) => updateSlaapkamer(s.id, "verdieping", e.target.value)} />
              <div>
                <span className="block text-xs mb-1" style={{ color: INK_SOFT }}>Ingemaakte kast</span>
                <Select options={["Ja", "Nee"]} value={s.ingemaaktKasten}
                  aria-label="Ingemaakte kast" title="Ingemaakte kast"
                  onChange={(e) => updateSlaapkamer(s.id, "ingemaaktKasten", e.target.value)} />
              </div>
              <div>
                <span className="block text-xs mb-1" style={{ color: INK_SOFT }}>Radiator</span>
                <Select options={["Ja", "Nee"]} value={s.radiator || "Nee"}
                  aria-label="Radiator" title="Radiator"
                  onChange={(e) => updateSlaapkamer(s.id, "radiator", e.target.value)} />
              </div>
              <button onClick={() => removeSlaapkamer(s.id)} className="mt-1"><Trash2 size={14} style={{ color: DANGER }} /></button>
            </div>
          ))}
        </div>
        <button onClick={addSlaapkamer} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <Plus size={13} /> Slaapkamer toevoegen
        </button>
      </div>

      {RUIMTE_CHECKLISTS.slice(4).map((cfg) => (
        <RoomChecklist key={cfg.key} cfg={cfg} state={d.eigenschappen[cfg.key]}
          onChange={(field, val) => setEig(cfg.key, field, val)} />
      ))}

      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <Sofa size={14} style={{ color: BRASS }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Andere ruimtes</span>
        </div>
        <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
          Voor ruimtes die hierboven niet voorzien zijn (bv. bureau, wasplaats, veranda, wellness, atelier, ...).
        </div>
        <div className="flex flex-col gap-3">
          {(d.extraRuimtes || []).map((r) => (
            <div key={r.id} className="rounded-lg p-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
              <div className="grid gap-2 items-center mb-2" style={{ gridTemplateColumns: "1fr 1fr 32px" }}>
                <TextInput placeholder="Naam ruimte (bv. bureau)" value={r.naam} onChange={(e) => updateExtraRuimte(r.id, "naam", e.target.value)} />
                <TextInput placeholder="Vloer" value={r.vloer} onChange={(e) => updateExtraRuimte(r.id, "vloer", e.target.value)} />
                <button onClick={() => removeExtraRuimte(r.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
              </div>
              <TextInput placeholder="Kenmerken / uitrusting (vrije tekst)" value={r.kenmerken} onChange={(e) => updateExtraRuimte(r.id, "kenmerken", e.target.value)} />
            </div>
          ))}
        </div>
        <button onClick={addExtraRuimte} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <Plus size={13} /> Ruimte toevoegen
        </button>
      </div>
    </div>
  );
}

// ---------- step 5: markt & stedenbouw ----------
// ---------- step (conditioneel, i.p.v. "Ruimte-eigenschappen"): bedrijfskenmerken ----------
// Getoond bij vastgoedType "KMO-vastgoed" of "Bedrijfsvastgoed" (zie StepType en de steps-array
// in DossierWizard) i.p.v. de residentiële ruimte-checklists hierboven, die voor een magazijn,
// kantoorgebouw of winkelpand geen zinvolle invulling hebben. De generieke sectie geldt voor
// beide vastgoedtypes; bij "Bedrijfsvastgoed" komt daar, afhankelijk van het gekozen subtype (zie
// StepType), nog een subtype-specifieke sectie bij — op basis van de kenmerkende parameters per
// vastgoedcategorie (Belgische bronnen: aximas.com, kmoschatter.be, lacara.be voor industrieel/
// logistiek, epccertificaat.vlaanderen voor de niet-residentiële EPC-regeling hieronder).
function StepBedrijfskenmerken({ d, set }) {
  const subtype = d.vastgoedType === "Bedrijfsvastgoed" ? d.bedrijfsSubtype : "";
  return (
    <div>
      <Section title="Algemene bedrijfskenmerken" icon={Building2}>
        <Field label="Vervangingswaarde (nieuwbouw, na veroudering)" full
          hint="Manuele inschatting door de schatter-expert — vervangt in de waardering de ABEX-woningindex, die enkel op residentieel vastgoed is gekalibreerd">
          <TextInput type="number" value={d.bedrijfsVervangingswaarde} onChange={set("bedrijfsVervangingswaarde")} />
        </Field>
        <Field label="Bestemmingszone"><Select options={OPTS.bedrijfsBestemmingszone} value={d.bedrijfsBestemmingszone} onChange={set("bedrijfsBestemmingszone")} /></Field>
        <Field label="Omgevingsvergunning milieu"><Select options={OPTS.bedrijfsVergunningMilieu} value={d.bedrijfsVergunningMilieu} onChange={set("bedrijfsVergunningMilieu")} /></Field>
        <Field label="Aantal parkeerplaatsen"><TextInput type="number" value={d.bedrijfsParkeerplaatsen} onChange={set("bedrijfsParkeerplaatsen")} /></Field>
        <Field label="Aantal laadkades"><TextInput type="number" value={d.bedrijfsLaadkades} onChange={set("bedrijfsLaadkades")} /></Field>
        <Field label="EPC-regime" hint="Niet-residentiële EPC-regeling — kies het type dat van toepassing is, of 'in onderzoek' bij twijfel over de precieze verplichting voor dit pand">
          <Select options={OPTS.bedrijfsEpcType} value={d.bedrijfsEpcType} onChange={set("bedrijfsEpcType")} />
        </Field>
        <Field label="EPC-waarde"><TextInput value={d.bedrijfsEpcWaarde} onChange={set("bedrijfsEpcWaarde")} /></Field>
        <Field label="EPC-certificaatnummer" full><TextInput value={d.bedrijfsEpcCertificaatnummer} onChange={set("bedrijfsEpcCertificaatnummer")} /></Field>
        <Field label="Omschrijving indeling & functionaliteit" full hint="Bv. 60% magazijn / 40% kantoor, showroom vooraan, ...">
          <textarea value={d.bedrijfsOmschrijvingIndeling} onChange={set("bedrijfsOmschrijvingIndeling")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </Section>

      <Section title="Interne afwerking" icon={Layers}>
        <Field label="Vloerafwerking"><Select options={OPTS.bedrijfsVloerafwerking} value={d.bedrijfsVloerafwerking} onChange={set("bedrijfsVloerafwerking")} /></Field>
        <Field label="Wandafwerking" hint="Bv. gepleisterd/geschilderd, sandwichpanelen, sichtbeton"><TextInput value={d.bedrijfsWandafwerking} onChange={set("bedrijfsWandafwerking")} /></Field>
        <Field label="Plafondafwerking" hint="Bv. systeemplafond, zichtbare dakconstructie, spanplafond"><TextInput value={d.bedrijfsPlafondafwerking} onChange={set("bedrijfsPlafondafwerking")} /></Field>
      </Section>

      {subtype === "Kantoor" && (
        <Section title="Kantoor — specifieke kenmerken" icon={Building2}>
          <Field label="Indeling"><Select options={OPTS.kantoorIndeling} value={d.kantoorIndeling} onChange={set("kantoorIndeling")} /></Field>
          <Field label="Aantal verdiepingen"><TextInput type="number" value={d.kantoorVerdiepingen} onChange={set("kantoorVerdiepingen")} /></Field>
          <Field label="Lift aanwezig"><Select options={OPTS.jaNee} value={d.kantoorLiftAanwezig} onChange={set("kantoorLiftAanwezig")} /></Field>
          <Field label="Serverruimte/technisch lokaal"><Select options={OPTS.jaNee} value={d.kantoorServerruimte} onChange={set("kantoorServerruimte")} /></Field>
          <Field label="Certificering" full hint="Bv. BREEAM, WELL — indien van toepassing"><TextInput value={d.kantoorCertificering} onChange={set("kantoorCertificering")} /></Field>
        </Section>
      )}

      {subtype === "Winkel" && (
        <Section title="Winkel — specifieke kenmerken" icon={Building2}>
          <Field label="Locatiecategorie" hint="Ligging is doorgaans de belangrijkste waardebepalende factor bij een winkelpand">
            <Select options={OPTS.winkelLocatiecategorie} value={d.winkelLocatiecategorie} onChange={set("winkelLocatiecategorie")} />
          </Field>
          <Field label="Gevelbreedte (m)"><TextInput type="number" value={d.winkelGevelbreedte} onChange={set("winkelGevelbreedte")} /></Field>
          <Field label="Etalage aanwezig"><Select options={OPTS.jaNee} value={d.winkelEtalage} onChange={set("winkelEtalage")} /></Field>
          <Field label="Magazijn/opslag achteraan"><Select options={OPTS.jaNee} value={d.winkelMagazijnAchteraan} onChange={set("winkelMagazijnAchteraan")} /></Field>
          <Field label="Inschatting voetgangersfrequentie" full><TextInput value={d.winkelPasanten} onChange={set("winkelPasanten")} placeholder="bv. druk, gemiddeld, rustig" /></Field>
        </Section>
      )}

      {subtype === "Industrieel/logistiek" && (
        <Section title="Industrieel/logistiek — specifieke kenmerken" icon={Building2}>
          <Field label="Vrije hoogte (m)" hint="Onder dak/kraanbaan"><TextInput type="number" value={d.industrieelVrijeHoogte} onChange={set("industrieelVrijeHoogte")} /></Field>
          <Field label="Vloerbelasting (ton/m²)"><TextInput type="number" value={d.industrieelVloerbelasting} onChange={set("industrieelVloerbelasting")} /></Field>
          <Field label="Aantal dock levellers"><TextInput type="number" value={d.industrieelAantalDockLevellers} onChange={set("industrieelAantalDockLevellers")} /></Field>
          <Field label="Elektrisch vermogen" hint="Bv. in kVA"><TextInput value={d.industrieelElektrischVermogen} onChange={set("industrieelElektrischVermogen")} /></Field>
          <Field label="Deelbaarheid" full hint="Bv. deelbaar vanaf 500 m² voor meerdere huurders"><TextInput value={d.industrieelDeelbaarheid} onChange={set("industrieelDeelbaarheid")} /></Field>
        </Section>
      )}

      {subtype === "Horeca" && (
        <Section title="Horeca — specifieke kenmerken" icon={Building2}>
          <Field label="Type horecazaak"><Select options={OPTS.horecaType} value={d.horecaType} onChange={set("horecaType")} /></Field>
          <Field label="Uitbatingsvergunning aanwezig"><Select options={OPTS.jaNee} value={d.horecaVergunningUitbating} onChange={set("horecaVergunningUitbating")} /></Field>
          <Field label="Terras aanwezig"><Select options={OPTS.jaNee} value={d.horecaTerras} onChange={set("horecaTerras")} /></Field>
          <Field label="Aantal zitplaatsen"><TextInput type="number" value={d.horecaZitplaatsen} onChange={set("horecaZitplaatsen")} /></Field>
          <Field label="Keukenuitrusting" full><TextInput value={d.horecaKeukenuitrusting} onChange={set("horecaKeukenuitrusting")} /></Field>
        </Section>
      )}
    </div>
  );
}

function StepMarkt({ d, set }) {
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

function StepDocumenten({ d, set, addDocumenten, removeDocument, updateDocument, addRuimtesBulk }) {
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

// ---------- foto's ----------
function StepFotos({ d, addFotos, removeFoto, updateFoto, setVoorpaginaFoto, removeVoorpaginaFoto }) {
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const voorpaginaInputRef = useRef(null);
  const voorpaginaCameraInputRef = useRef(null);
  const [geweigerd, setGeweigerd] = useState([]);
  const bijlageBytes = berekenPandBijlageBytes(d);
  const bijlageMB = bijlageBytes / (1024 * 1024);
  return (
    <div>
      <Section title="Voorpagina-foto (optioneel)" icon={ImageIcon}>
        <div className="col-span-2">
          <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
            Een sfeerbeeld voor de cover-pagina van het verslag — bv. een mooie Street View-opname of een eigen foto ter plaatse. Los van de bijlage-foto's hieronder.
          </div>
          {d.voorpaginaFoto ? (
            <div className="rounded-lg overflow-hidden relative" style={{ border: `1px solid ${LINE}`, maxWidth: 360 }}>
              <div className="relative flex items-center justify-center" style={{ aspectRatio: "4/3", background: "rgba(0,0,0,0.03)" }}>
                {!d.voorpaginaFoto.url && !d.voorpaginaFoto.base64 && <Loader2 size={18} className="animate-spin" style={{ color: INK_SOFT }} />}
                {(d.voorpaginaFoto.url || d.voorpaginaFoto.base64) && (
                  <img src={d.voorpaginaFoto.url || d.voorpaginaFoto.base64} alt="Voorpagina" className="w-full h-full object-cover" />
                )}
                <button onClick={removeVoorpaginaFoto}
                  className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
                  style={{ width: 22, height: 22, background: "rgba(27,31,39,0.65)" }}>
                  <X size={12} color="#fff" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3" style={{ maxWidth: 360 }}>
              <div onClick={() => voorpaginaInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
                style={{ border: `1.5px dashed ${LINE}`, padding: "20px 12px", background: PAPER_RAISED }}>
                <Upload size={18} style={{ color: BRASS }} />
                <span className="text-xs text-center" style={{ color: INK_SOFT }}>Kies bestand</span>
                <input ref={voorpaginaInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { if (e.target.files[0]) setVoorpaginaFoto(e.target.files[0]); e.target.value = ""; }} />
              </div>
              <div onClick={() => voorpaginaCameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
                style={{ border: `1.5px dashed ${LINE}`, padding: "20px 12px", background: PAPER_RAISED }}>
                <Camera size={18} style={{ color: BRASS }} />
                <span className="text-xs text-center" style={{ color: INK_SOFT }}>Foto nemen</span>
                <input ref={voorpaginaCameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { if (e.target.files[0]) setVoorpaginaFoto(e.target.files[0]); e.target.value = ""; }} />
              </div>
            </div>
          )}
        </div>
      </Section>
      <Section title="Foto's" icon={ImageIcon}>
        <div className="col-span-2">
          <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
            Vereist: frontzicht en zijdelingse zichten vanop straat (incl. straatuitrusting), zo mogelijk achtergevel en tuin, en interieurfoto's van inrichting/installaties.
            Enkel JPG/JPEG-bestanden worden aanvaard.
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
              <span className="text-sm" style={{ color: INK_SOFT }}>Klik om foto's toe te voegen (JPG/JPEG)</span>
              <input ref={inputRef} type="file" multiple accept="image/jpeg,.jpg,.jpeg" className="hidden"
                onChange={(e) => { addFotos(e.target.files, setGeweigerd); e.target.value = ""; }} />
            </div>
            <div onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
              style={{ border: `1.5px dashed ${LINE}`, padding: "28px 16px", background: PAPER_RAISED }}>
              <Camera size={18} style={{ color: BRASS }} />
              <span className="text-sm" style={{ color: INK_SOFT }}>Foto nemen met camera</span>
              <input ref={cameraInputRef} type="file" multiple accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { addFotos(e.target.files, setGeweigerd); e.target.value = ""; }} />
            </div>
          </div>
          {geweigerd.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
              <AlertTriangle size={13} /> Niet toegevoegd (enkel JPG/JPEG toegelaten): {geweigerd.join(", ")}
            </div>
          )}
          {d.fotos.length === 0 ? (
            <div className="text-sm italic mt-4" style={{ color: INK_SOFT }}>Nog geen foto's toegevoegd.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {d.fotos.map((f) => (
                <div key={f.id} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
                  <div className="relative flex items-center justify-center" style={{ aspectRatio: "4/3", background: "rgba(0,0,0,0.03)" }}>
                    {!f.url && !f.base64 && <Loader2 size={18} className="animate-spin" style={{ color: INK_SOFT }} />}
                    {(f.url || f.base64) && <img src={f.url || f.base64} alt={f.naam} className="w-full h-full object-cover" />}
                    <button onClick={() => removeFoto(f.id)}
                      className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
                      style={{ width: 22, height: 22, background: "rgba(27,31,39,0.65)" }}>
                      <X size={12} color="#fff" />
                    </button>
                  </div>
                  <select value={f.categorie || "Andere"} onChange={(e) => updateFoto(f.id, "categorie", e.target.value)}
                    style={{ ...inputStyle, borderRadius: 0, border: "none", borderTop: `1px solid ${LINE}`, fontSize: 12, padding: "6px 8px" }}>
                    {OPTS.fotoCategorie.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {/* helpt de gebruiker om, bij een dossier met een te grote totale bijlage-omvang
                      (zie de waarschuwing hierboven), zelf de zwaarste foto's te herkennen om te
                      verwijderen — dus bewust op de echte, huidige base64-omvang gebaseerd, niet op
                      de oorspronkelijke bestandsgrootte vóór verkleining. */}
                  {f.base64 && (
                    <div className="text-center" style={{ fontSize: 10, color: INK_SOFT, padding: "2px 0 4px" }}>
                      ~{Math.round(schatBase64Bytes(f.base64) / 1024)} kB
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ---------- SWOT ----------
function StepSwot({ d, set, setD }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: "ai" | "fallback", message }

  const mergeLines = (existing, nieuw) => {
    const have = new Set(existing.split("\n").map((l) => l.trim()).filter(Boolean));
    const toAdd = nieuw.filter((l) => l && !have.has(l.trim()));
    return [existing.trim(), ...toAdd].filter(Boolean).join("\n");
  };

  const toevoegenAanSwot = (voorstel) => {
    setD((prev) => ({
      ...prev,
      sterktes: mergeLines(prev.sterktes, voorstel.sterktes || []),
      zwaktes: mergeLines(prev.zwaktes, voorstel.zwaktes || []),
      kansen: mergeLines(prev.kansen, voorstel.kansen || []),
      bedreigingen: mergeLines(prev.bedreigingen, voorstel.bedreigingen || []),
    }));
  };

  const genereerVoorstel = async () => {
    setLoading(true);
    setStatus(null);
    const pdfDocs = d.documenten.filter((doc) => !doc.opladen && (doc.base64 || doc.pad));
    try {
      const summary = buildPropertySummary(d);
      const prompt = `Je bent een Vlaamse vastgoedschatter-expert. Op basis van onderstaande paneelgegevens van een pand${pdfDocs.length ? " en de meegestuurde bijlagen" : ""}, stel je een SWOT-analyse voor in het Nederlands, in de stijl van een professioneel taxatieverslag (zakelijk, feitelijk, geen overdrijvingen). Geef per categorie 3 tot 5 korte, concrete bullets (max. 1 zin per bullet).

Paneelgegevens:
${summary}

Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat:
{"sterktes": ["...", "..."], "zwaktes": ["...", "..."], "kansen": ["...", "..."], "bedreigingen": ["...", "..."]}`;

      const raw = await callClaudeWithDocs(pdfDocs, prompt, d.id);
      const parsed = extractJson(raw);
      toevoegenAanSwot(parsed);
      setStatus({ type: "ai", message: `AI-voorstel toegevoegd${pdfDocs.length ? ` op basis van de tabbladen en ${pdfDocs.length} bijlage${pdfDocs.length === 1 ? "" : "n"}` : " op basis van de ingevulde tabbladen"}.` });
    } catch (e) {
      // vangnet: bij een netwerk-/serverfout toch een bruikbaar voorstel geven, lokaal berekend
      const fallback = genereerAutomatischeSwot(d);
      toevoegenAanSwot(fallback);
      setStatus({ type: "fallback", message: `AI-aanvraag mislukt (${duidAiDocFout(e)}) — lokaal voorstel toegevoegd op basis van de ingevulde tabbladen.` });
    } finally {
      setLoading(false);
    }
  };

  const box = (label, key, color) => (
    <div>
      <div className="text-xs mb-1.5" style={{ color, fontWeight: 500 }}>{label}</div>
      <textarea value={d[key]} onChange={set(key)} rows={6} placeholder="Eén punt per lijn..."
        style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={15} style={{ color: BRASS }} />
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>SWOT-analyse</h3>
        </div>
        <button onClick={genereerVoorstel} disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
          style={{ background: loading ? "#B8B4A8" : STAMP }}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {loading ? "Bezig met genereren..." : "AI-voorstel genereren"}
        </button>
      </div>
      <div className="text-xs mb-4" style={{ color: INK_SOFT }}>
        Gebaseerd op alle ingevulde tabbladen én de opgeladen documenten (bijlagen) bij "Documenten" — die worden rechtstreeks
        als bijlage meegestuurd. Lukt de AI-aanvraag niet, dan valt de app automatisch terug op een lokaal berekend voorstel.
        Voorstellen worden toegevoegd naast wat je al schreef — pas gerust aan of verwijder wat niet klopt.
      </div>
      {status && (
        <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg"
          style={{ background: status.type === "ai" ? STAMP_SOFT : "#FBEAEA", color: status.type === "ai" ? STAMP : DANGER }}>
          {status.type === "ai" ? <Check size={13} /> : <AlertTriangle size={13} />} {status.message}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {box("Sterktes", "sterktes", STAMP)}
        {box("Zwaktes", "zwaktes", DANGER)}
        {box("Kansen", "kansen", BRASS)}
        {box("Bedreigingen", "bedreigingen", DANGER)}
      </div>
      <Section title="Verbouwingen / renovaties" icon={ClipboardList}>
        <Field label="Verbouwingen/renovaties" full>
          <textarea value={d.verbouwingen} onChange={set("verbouwingen")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </Section>
      <Section title="Conclusie & notities" icon={ClipboardList}>
        <Field label="Conclusie" full>
          <textarea value={d.conclusie} onChange={set("conclusie")} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
        <Field label="Notities (intern)" full>
          <textarea value={d.notities} onChange={set("notities")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </Section>
    </div>
  );
}

// ---------- afmetingen & indeling ----------
function StepAfmetingen({ d, set, calc, addRuimte, removeRuimte, updateRuimte, addSchijf, removeSchijf, updateSchijf }) {
  // "Bewoonbare oppervlakte" is een residentieel begrip — bij KMO-vastgoed/Bedrijfsvastgoed is
  // "nuttige vloeroppervlakte" de courante term (het onderliggende veld bewoonbareOppSchatting
  // blijft ongewijzigd, dit is enkel het label/de weergave).
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const oppLabel = isResidentieel ? "Bewoonbare oppervlakte" : "Nuttige vloeroppervlakte";
  return (
    <div>
      <Section title="Afmetingen" icon={Ruler}>
        <Field label="Gevelbreedte (m)"><TextInput type="number" value={d.breedteGevel} onChange={set("breedteGevel")} /></Field>
        <Field label="Perceelbreedte (m)"><TextInput type="number" value={d.breedtePerceel} onChange={set("breedtePerceel")} /></Field>
        <Field label="Grondoppervlakte (m²)"><TextInput type="number" value={d.grondopp} onChange={set("grondopp")} /></Field>
        <Field label="Bebouwde oppervlakte (m²)"><TextInput type="number" value={d.bebouwdeOpp} onChange={set("bebouwdeOpp")} /></Field>
        <Field label={`${oppLabel} — schatting (m²)`} hint="Manuele inschatting; wordt vergeleken met de berekende oppervlakte hieronder">
          <TextInput type="number" value={d.bewoonbareOppSchatting} onChange={set("bewoonbareOppSchatting")} />
        </Field>
        <Field label="Oriëntatie"><Select options={OPTS.orientatie} value={d.orientatie} onChange={set("orientatie")} /></Field>
      </Section>

      <Section title="Oppervlakte per bouweenheid" icon={Grid3x3}>
        <div className="col-span-2">
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                  {["Verdieping", "Opp. (m²)", "Coëff.", "Na coëff.", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calc.ruimteRows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td className="px-2 py-1.5">
                      <select value={r.verdieping} onChange={(e) => {
                        updateRuimte(r.id, "verdieping", e.target.value);
                        const v = VERDIEPINGEN.find((x) => x.key === e.target.value);
                        if (v) updateRuimte(r.id, "coeff", v.defCoeff);
                      }} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }}>
                        {VERDIEPINGEN.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 90 }}>
                      <input type="number" value={r.opp} onChange={(e) => updateRuimte(r.id, "opp", e.target.value)}
                        style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 80 }}>
                      <input type="number" step="0.05" value={r.coeff} onChange={(e) => updateRuimte(r.id, "coeff", e.target.value)}
                        style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                    </td>
                    <td className="px-3 py-1.5 font-mono" style={{ fontSize: 13, color: INK_SOFT }}>{r.oppNaCoeff.toFixed(2)} m²</td>
                    <td className="px-2 py-1.5"><button onClick={() => removeRuimte(r.id)}><Trash2 size={14} style={{ color: DANGER }} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: STAMP_SOFT }}>
                  <td className="px-3 py-2 text-sm" style={{ fontWeight: 500, color: STAMP }}>Totaal</td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP, fontWeight: 500 }}>{calc.totOpp.toFixed(2)} m²</td>
                  <td></td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP, fontWeight: 500 }}>{calc.totOppNaCoeff.toFixed(2)} m²</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button onClick={addRuimte} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
            style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <Plus size={13} /> Ruimte toevoegen
          </button>
          {d.pandType === "Appartement" && (
            <div className="mt-3 max-w-xs">
              <Field label="Aandeel gemeenschappelijke delen (m²)"
                hint="Aandeel van deze kavel in de gemeenschappelijke binnendelen van het gebouw (traphal, gangen, technische lokalen, ...) — telt volledig mee in de te taxeren oppervlakte hierboven.">
                <TextInput type="number" value={d.gemeenschappelijkeDelenOpp} onChange={set("gemeenschappelijkeDelenOpp")} />
              </Field>
            </div>
          )}
          <div className="text-xs mt-2" style={{ color: INK_SOFT }}>
            Ratio gecorrigeerde / nuttige oppervlakte: <span className="font-mono">{(calc.ratio * 100).toFixed(1)}%</span>
            {d.bewoonbareOppSchatting && (
              <> · schatting vs. berekend:{" "}
                <span className="font-mono" style={{ color: Math.abs(num(d.bewoonbareOppSchatting) - calc.totOppNaCoeff) > 5 ? DANGER : STAMP }}>
                  {d.bewoonbareOppSchatting} m² vs. {calc.totOppNaCoeff.toFixed(1)} m²
                </span>
              </>
            )}
          </div>
        </div>
      </Section>

      {d.pandType === "Appartement" && (
        <Section title="Aandeel in de gemeenschap" icon={Ruler}>
          <Field label="Aandeel in de gemeenschap (in 1000sten)" hint="Quotiteit van deze kavel in de mede-eigendom, zoals vermeld in de statuten/basisakte.">
            <TextInput type="number" value={d.aandeelDuizendsten} onChange={set("aandeelDuizendsten")} placeholder="bv. 137" />
          </Field>
          <Field label="Effectief grondaandeel" hint="Berekend als: Grondoppervlakte (hierboven, = totale grondoppervlakte van de residentie) × aandeel / 1000.">
            <div className="flex items-center gap-2">
              <div style={{ ...inputStyle, background: "rgba(0,0,0,0.02)", color: STAMP, fontWeight: 500 }} className="font-mono">
                {calc.effectiefGrondaandeel.toFixed(2)} m²
              </div>
              {calc.effectiefGrondaandeel > 0 && (
                <button type="button" onClick={() => addSchijf("Aandeel in gemeenschappelijke grond", calc.effectiefGrondaandeel.toFixed(2))}
                  className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ border: `1px solid ${BRASS}`, color: BRASS, background: BRASS_SOFT }}>
                  <Plus size={13} /> Als schijf
                </button>
              )}
            </div>
          </Field>
          {!d.grondopp && (
            <div className="col-span-2 text-xs" style={{ color: INK_SOFT }}>
              Vul hierboven bij "Grondoppervlakte" de totale grondoppervlakte van de residentie/het complex in om het effectief grondaandeel te berekenen.
            </div>
          )}
        </Section>
      )}

      <Section title="Grondwaarde per schijf" icon={Ruler}>
        <div className="col-span-2">
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                  {["Omschrijving", "Opp. (m²)", "Prijs/m²", "Waarde", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.schijven.map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td className="px-2 py-1.5">
                      <input value={s.naam} onChange={(e) => updateSchijf(s.id, "naam", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 110 }}>
                      <input type="number" value={s.opp} onChange={(e) => updateSchijf(s.id, "opp", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 110 }}>
                      <input type="number" value={s.prijs} onChange={(e) => updateSchijf(s.id, "prijs", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                    </td>
                    <td className="px-3 py-1.5 font-mono" style={{ fontSize: 13, color: INK_SOFT }}>{eur(num(s.opp) * num(s.prijs))}</td>
                    <td className="px-2 py-1.5"><button onClick={() => removeSchijf(s.id)}><Trash2 size={14} style={{ color: DANGER }} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: STAMP_SOFT }}>
                  <td className="px-3 py-2 text-sm" style={{ fontWeight: 500, color: STAMP }}>Totaal grondwaarde</td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP }}>{calc.totaleGrondopp.toFixed(0)} m²</td>
                  <td></td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.grondwaarde)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={() => addSchijf()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
              <Plus size={13} /> Schijf toevoegen
            </button>
            <button onClick={() => addSchijf("Landbouwgrond")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${BRASS}`, color: BRASS, background: BRASS_SOFT }}>
              <Plus size={13} /> Landbouwgrond toevoegen
            </button>
            <button onClick={() => addSchijf("Bosgrond")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${BRASS}`, color: BRASS, background: BRASS_SOFT }}>
              <Plus size={13} /> Bosgrond toevoegen
            </button>
          </div>
        </div>
      </Section>

      <Section title="Residuele grondwaarde (optioneel)" icon={Ruler}>
        <div className="col-span-2">
          <Checkbox label="Residuele methode toepassen — enkel relevant bij een reëel sloop-/herontwikkelingspotentieel"
            checked={d.residueelActief} onChange={set("residueelActief")} />
          <div className="text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.85 }}>
            Optionele extra, staat standaard uit. Vervangt de gewone grondwaarde per schijf hierboven niet — verschijnt er enkel naast in het waarderingsoverzicht, zodat u zelf kiest welke van de twee het best bij dit dossier past.
          </div>
        </div>
        {d.residueelActief && (
          <>
            <Field label="Verwachte eindwaarde na (her)ontwikkeling (€)" hint="Geschatte verkoopwaarde van het pand/project ná realisatie">
              <TextInput type="number" value={d.residueelEindwaarde} onChange={set("residueelEindwaarde")} style={{ color: BRASS }} />
            </Field>
            <Field label="Geraamde bouw-/sloopkost (€)">
              <TextInput type="number" value={d.residueelBouwkost} onChange={set("residueelBouwkost")} style={{ color: BRASS }} />
            </Field>
            <Field label="Bijkomende kosten (%)" hint="Ereloon architect, vergunningen, financiering e.d., als % op de bouwkost">
              <TextInput type="number" step="0.5" value={d.residueelBijkomendeKostenPct} onChange={set("residueelBijkomendeKostenPct")} style={{ color: BRASS }} />
            </Field>
            <Field label="Ontwikkelaarswinst/risico (%)" hint="Als % op de eindwaarde">
              <TextInput type="number" step="0.5" value={d.residueelWinstmargePct} onChange={set("residueelWinstmargePct")} style={{ color: BRASS }} />
            </Field>
            <Field label="Residuele grondwaarde (berekend)" full>
              <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.residueleGrondwaarde)}</div>
            </Field>
            <Field label="Motivering / toelichting" full>
              <textarea value={d.residueelMotivering} onChange={set("residueelMotivering")} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        )}
      </Section>
    </div>
  );
}

// ---------- vergelijkingspunten & waarderingsmethode ----------
function StepVergelijkingspunten({ d, set, addVergelijkingspunt, removeVergelijkingspunt, updateVergelijkingspunt }) {
  const vergelijkend = d.wijzeVanWaardering === "Vergelijkende methode";
  return (
    <div>
      <Section title="Wijze van waardering" icon={Ruler}>
        <Field label="Methode" hint="Vergelijkende methode is de regel; analytische/redelijke methode enkel bij ontbreken van directe vergelijkingspunten, gemotiveerd">
          <Select options={OPTS.wijzeVanWaardering} value={d.wijzeVanWaardering} onChange={set("wijzeVanWaardering")} />
        </Field>
        {!vergelijkend && (
          <Field label="Motivering van de afwijking" full>
            <textarea value={d.wijzeVanWaarderingMotivering} onChange={set("wijzeVanWaarderingMotivering")} rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
        )}
      </Section>

      {/* Deze melding stond er voordien onvoorwaardelijk ("worden niet weergegeven in het verslag"),
          terwijl de vergelijkingspunten bij een nalatenschap net wél volledig worden afgedrukt (zie
          vglPuntenHtml in buildPandSections). De schatter kreeg dus een onjuiste geruststelling over
          wat er in een document staat dat naar Vlabel vertrekt. */}
      <div className="text-xs mb-4 p-3 rounded-lg" style={{ background: BRASS_SOFT, color: BRASS }}>
        {d.reden === "Nalatenschap" && vergelijkend
          ? "Let op: bij een nalatenschap met de vergelijkende methode worden deze VGL-punten volledig in het verslag opgenomen (adres, kadastrale gegevens, transactiegegevens en afweging) — dat is een Vlabel-vereiste. Vul ze dus in met de wetenschap dat ze meegaan naar de opdrachtgever en naar Vlabel."
          : "VGL-punten worden hier intern bijgehouden ter staving van de waardering; in dit dossier verschijnt enkel het aantal in het verslag, niet de gegevens zelf."}
      </div>

      {d.vergelijkingspunten.map((v, idx) => (
        <div key={v.id} className="rounded-lg p-4 mb-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 14, fontWeight: 500 }}>Vergelijkingspunt {idx + 1}</span>
            <button onClick={() => removeVergelijkingspunt(v.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Adres (postcode, gemeente, straat, nr.)" full>
              <TextInput value={v.adres} onChange={(e) => updateVergelijkingspunt(v.id, "adres", e.target.value)} />
            </Field>
            <Field label="Kadastrale gegevens" hint="Afdeling, sectie, perceelnr., partitienr., opp., KI, detail-ID">
              <TextInput value={v.kadastraleGegevens} onChange={(e) => updateVergelijkingspunt(v.id, "kadastraleGegevens", e.target.value)} />
            </Field>
            <Field label="Bouwjaar">
              <TextInput type="number" value={v.bouwjaar} onChange={(e) => updateVergelijkingspunt(v.id, "bouwjaar", e.target.value)} />
            </Field>
            <Field label="Aard van de transactie">
              <Select options={OPTS.aardTransactie} value={v.aardTransactie} onChange={(e) => updateVergelijkingspunt(v.id, "aardTransactie", e.target.value)} />
            </Field>
            <Field label="Datum transactie">
              <TextInput type="date" value={v.datumTransactie} onChange={(e) => updateVergelijkingspunt(v.id, "datumTransactie", e.target.value)} />
            </Field>
            <Field label="Belastbare grondslag (€)">
              <TextInput type="number" value={v.belastbareGrondslag} onChange={(e) => updateVergelijkingspunt(v.id, "belastbareGrondslag", e.target.value)} />
            </Field>
            <Field label="Bron" hint="Bv. notariële akte, eigen verkoopdossier, Statbel, vastgoedinfo">
              <TextInput value={v.bron || ""} onChange={(e) => updateVergelijkingspunt(v.id, "bron", e.target.value)} />
            </Field>
            <Field label="Ligging">
              <TextInput value={v.ligging} onChange={(e) => updateVergelijkingspunt(v.id, "ligging", e.target.value)} />
            </Field>
            <Field label="Bestemming">
              <TextInput value={v.bestemming} onChange={(e) => updateVergelijkingspunt(v.id, "bestemming", e.target.value)} />
            </Field>
            <Field label="Oriëntatie">
              <Select options={OPTS.orientatie} value={v.oriëntatie} onChange={(e) => updateVergelijkingspunt(v.id, "oriëntatie", e.target.value)} />
            </Field>
            <Field label="Externe afwerking">
              <TextInput value={v.externeAfwerking} onChange={(e) => updateVergelijkingspunt(v.id, "externeAfwerking", e.target.value)} />
            </Field>
            <Field label="Onderhoud">
              <TextInput value={v.onderhoud} onChange={(e) => updateVergelijkingspunt(v.id, "onderhoud", e.target.value)} />
            </Field>
            <Field label="Rooilijnbreedte (m)">
              <TextInput type="number" value={v.rooilijnbreedte} onChange={(e) => updateVergelijkingspunt(v.id, "rooilijnbreedte", e.target.value)} />
            </Field>
            <Field label="Gevelbreedte (m)">
              <TextInput type="number" value={v.gevelbreedte} onChange={(e) => updateVergelijkingspunt(v.id, "gevelbreedte", e.target.value)} />
            </Field>
            <Field label="Bebouwde oppervlakte (m²)">
              <TextInput type="number" value={v.bebouwdeOpp} onChange={(e) => updateVergelijkingspunt(v.id, "bebouwdeOpp", e.target.value)} />
            </Field>
            <Field label="Afweging t.o.v. het te schatten goed" full>
              <textarea value={v.afweging} onChange={(e) => updateVergelijkingspunt(v.id, "afweging", e.target.value)} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </div>
        </div>
      ))}
      <button onClick={addVergelijkingspunt} className="flex items-center gap-1.5 text-xs mt-1 px-3 py-1.5 rounded-lg"
        style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
        <Plus size={13} /> Vergelijkingspunt toevoegen
      </button>
    </div>
  );
}

// ---------- waardering ----------
function Slider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: INK_SOFT, fontWeight: 500 }}>{label}</span>
        <span className="font-mono" style={{ color: BRASS }}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(e.target.value)} className="w-full" />
    </div>
  );
}

// Types voor de parkeerplaatsen/garages-lijst (StepWaardering hieronder) — een vaste lijst i.p.v.
// vrije tekst, consistent met de rest van de app, maar met "Andere" als vangnet.
const PARKEER_TYPES = ["Autostaanplaats (buiten)", "Autostaanplaats (ondergronds/binnen)", "Garage (afgesloten box)", "Carport", "Fietsenberging", "Andere"];

function StepWaardering({ d, set, calc, parkeerplaatsenGarages, addParkeerplaats, removeParkeerplaats, updateParkeerplaats, portefeuille }) {
  // de ABEX-woningindex/vetusiteitscalculator hieronder is opgemaakt voor residentieel vastgoed
  // (de KLASSEN-tabel = woning-/appartementstypes) — bij KMO-vastgoed/Bedrijfsvastgoed wordt de
  // vervangingswaarde in de plaats daarvan manueel ingeschat op het tabblad "Bedrijfskenmerken"
  // (zie berekenWaardering), dus tonen we hier enkel een doorverwijzing i.p.v. een niet-relevante
  // rekentool.
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  return (
    <div>
      {isResidentieel ? (
        <>
          <Section title="Vervangingswaarde (Abex)" icon={Calculator}>
            <Field label="Abex-index vandaag" hint="Periodiek te updaten">
              <TextInput type="number" value={d.abexIndexHuidig} onChange={set("abexIndexHuidig")} style={{ color: BRASS }} />
            </Field>
            <Field label="Abex-waarde / m² (geselecteerd)" hint="Klik een cel in de tabel hieronder om te selecteren">
              <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.abexPerM2)} / m²</div>
            </Field>
          </Section>

          <div className="col-span-2 mb-8">
            <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
              Abex-referentietabel — klik een cel om die waarde te gebruiken (herberekend op basis van Abex-index {d.abexIndexHuidig})
            </div>
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
                  {["Woningen", "Appartementen"].map((groep) => (
                    <React.Fragment key={groep}>
                      <tr><td colSpan={5} className="px-3 py-1.5" style={{ fontSize: 11, fontWeight: 500, color: BRASS, background: BRASS_SOFT }}>{groep}</td></tr>
                      {KLASSEN.filter((k) => k.type === groep).map((k) => (
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
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
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

      <Section title="Meerjaren-DCF (optioneel)" icon={Calculator}>
        <div className="col-span-2">
          <Checkbox label="Meerjaren-DCF berekenen — naast (niet in plaats van) de directe kapitalisatie hierboven"
            checked={d.dcfMeerjarenActief} onChange={set("dcfMeerjarenActief")} />
          <div className="text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.85 }}>
            Optionele extra, staat standaard uit. Rekent met een reeks jaarlijkse huurinkomsten (met groei en eventuele leegstand) verdisconteerd tegen een zelf te kiezen discontovoet, plus een eindwaarde na het laatste jaar — rigoureuzer dan de directe kapitalisatie bij een pand met een reëel verhuurluik, maar puur ter informatie/onderbouwing: de venale waarde hieronder wordt hier niet automatisch door aangepast.
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
        <Field label="Venale waarde" full hint={`Standaard voorgesteld gelijk aan de intrinsieke waarde${calc.energiecorrectieBedrag ? " + energiecorrectie" : ""} — manueel te overschrijven`}>
          <TextInput type="number" value={d.venaleWaarde} onChange={set("venaleWaarde")} placeholder={(calc.intrinsiek + calc.energiecorrectieBedrag).toFixed(0)} style={{ color: BRASS, fontWeight: 500 }} />
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
          <Row label="Nieuwbouwwaarde gebouw" v={eur(calc.nieuwbouwwaarde)} />
          <Row label="Actuele waarde gebouw" v={eur(calc.actueleWaardeGebouw)} />
          {d.pandType === "Appartement" && calc.effectiefGrondaandeel > 0 && (
            <Row label="Effectief grondaandeel" v={`${calc.effectiefGrondaandeel.toFixed(2)} m²`} />
          )}
          <Row label="Grondwaarde" v={eur(calc.grondwaarde)} />
          <Row label="Intrinsieke waarde" v={eur(calc.intrinsiek)} />
          <Row label={`Marktwaarde -${pct(calc.marktMargeOnderPct)}`} v={eur(calc.marktOnder)} />
          <Row label={`Marktwaarde +${pct(calc.marktMargeBovenPct)}`} v={eur(calc.marktBoven)} />
          <Row label="DCF-waarde" v={calc.dcfWaarde ? eur(calc.dcfWaarde) : "n.v.t."} />
          {d.dcfMeerjarenActief && (
            <Row label="Meerjaren-DCF (optioneel)" v={calc.dcfMeerjarenWaarde ? eur(calc.dcfMeerjarenWaarde) : "n.v.t."} />
          )}
          {d.residueelActief && (
            <Row label="Residuele grondwaarde (optioneel)" v={eur(calc.residueleGrondwaarde)} />
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
function Row({ label, v }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: INK_SOFT, fontFamily: "system-ui" }}>{label}</span>
      <span style={{ color: INK }}>{v}</span>
    </div>
  );
}

// ---------- rapport: helpers ----------
const NL_NUM = ["nul", "een", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien",
  "elf", "twaalf", "dertien", "veertien", "vijftien", "zestien", "zeventien", "achttien", "negentien", "twintig",
  "eenentwintig", "tweeëntwintig", "drieëntwintig", "vierentwintig", "vijfentwintig", "zesentwintig", "zevenentwintig", "achtentwintig", "negenentwintig", "dertig"];
const nlNumber = (n) => NL_NUM[n] || String(n);

const REDEN_ZINSNEDE = {
  "Nalatenschap": "de aangifte van nalatenschap",
  "Verkoop": "een verkoop",
  "Boekhoudkundige waardering": "boekhoudkundige doeleinden (o.a. jaarrekening, herwaardering van vaste activa)",
  "Hypothecair krediet": "een hypothecair krediet",
  "Echtscheiding": "een echtscheiding",
  "Gerechtelijk": "een gerechtelijke procedure",
  "Andere": "de opgegeven reden",
};

// rapportVergelijkingspuntRijen, rapportWaarderingsBlokken en rapportVenaleWaardeZin ("GEDEELD RAPPORTMODEL") verhuisden naar src/domein/waardering.js (opsplitsing stap 2).

// ----------------------------------------------------------------------------
// AI-VOORSTELLEN — witte lijst + controle
// ----------------------------------------------------------------------------
// Voordien schreef het uitlezen van documenten ELKE sleutel die het model teruggaf rechtstreeks in
// het dossier: geen beperking tot bestaande velden, geen controle tegen de keuzelijsten, geen
// vergelijking met wat er al stond, en geen weg terug. Een gehallucineerde sleutel, of een waarde
// die niet in de bijhorende keuzelijst voorkomt, belandde zo stil in een verslag dat onder eed
// vertrekt. Hieronder staat wat AI mag invullen, en hoe elke waarde gecontroleerd wordt.
const AI_VELDEN = {
  capakey: { label: "CaPaKey", soort: "tekst", max: 40 },
  kadAfdeling: { label: "Kadastrale afdeling", soort: "tekst", max: 20 },
  kadSectie: { label: "Kadastrale sectie", soort: "tekst", max: 10 },
  kadPerceelnummer: { label: "Perceelnummer", soort: "tekst", max: 30 },
  straat: { label: "Straat", soort: "tekst", max: 80 },
  nummer: { label: "Huisnummer", soort: "tekst", max: 12 },
  postcode: { label: "Postcode", soort: "tekst", max: 10 },
  gemeente: { label: "Gemeente", soort: "tekst", max: 60 },
  gewestplan: { label: "Gewestplan", soort: "keuze", opties: () => OPTS.gewestplan },
  erfgoed: { label: "Onroerend erfgoed", soort: "keuze", opties: () => OPTS.jaNee },
  voorkooprecht: { label: "Voorkooprecht", soort: "keuze", opties: () => OPTS.jaNee },
  bouwmisdrijven: { label: "Bouwmisdrijven", soort: "keuze", opties: () => OPTS.jaNee },
  watertoetsP: { label: "Watertoets perceelscore", soort: "keuze", opties: () => ["A", "B", "C", "D"] },
  watertoetsG: { label: "Watertoets gebouwscore", soort: "keuze", opties: () => ["A", "B", "C", "D"] },
  mobiscore: { label: "Mobiscore", soort: "getal", min: 0, max: 10 },
  bpaRupVerkaveling: { label: "BPA / RUP / verkaveling", soort: "tekst", max: 500 },
};

// Zet het antwoord van het model om in een lijst voorstellen. Geeft nooit een veld terug dat niet
// in AI_VELDEN staat, en nooit een waarde die de controle niet doorstaat.
export function bouwAiVoorstellen(parsed, huidig) {
  const voorstellen = [];
  const geweigerd = [];
  Object.entries(parsed || {}).forEach(([veld, ruweWaarde]) => {
    const regel = AI_VELDEN[veld];
    if (!regel) { geweigerd.push({ veld, reden: "wordt niet automatisch ingevuld" }); return; }
    if (ruweWaarde === "" || ruweWaarde === null || ruweWaarde === undefined) return;
    let waarde = String(ruweWaarde).trim();
    if (!waarde) return;

    if (regel.soort === "keuze") {
      const opties = regel.opties();
      const treffer = opties.find((o) => o.toLowerCase() === waarde.toLowerCase());
      if (!treffer) { geweigerd.push({ veld, reden: `"${waarde}" staat niet in de keuzelijst` }); return; }
      waarde = treffer; // exacte schrijfwijze uit de lijst, anders klopt het keuzeveld niet meer
    } else if (regel.soort === "getal") {
      const n = parseFloat(waarde.replace(",", "."));
      if (isNaN(n) || n < regel.min || n > regel.max) {
        geweigerd.push({ veld, reden: `"${waarde}" is geen geldig getal tussen ${regel.min} en ${regel.max}` });
        return;
      }
      waarde = String(n);
    } else if (waarde.length > regel.max) {
      geweigerd.push({ veld, reden: "waarde is onwaarschijnlijk lang" });
      return;
    }

    const oud = String(huidig?.[veld] ?? "");
    if (oud === waarde) return; // niets te beslissen
    voorstellen.push({ veld, label: regel.label, oud, nieuw: waarde });
  });
  return { voorstellen, geweigerd };
}

// Controle vóór het afleveren van een verslag. Voordien kon een verslag zonder referentiedatum,
// zonder Vlabel-nummer en zonder handtekening gegenereerd worden zonder één waarschuwing — en
// omdat een leeg veld in de PDF gewoon WEGGELATEN wordt (zie wRow), ziet zo'n verslag er volkomen
// normaal uit: de ontbrekende regels zijn onzichtbaar, ook voor de ontvanger. Vandaar twee
// niveaus: "blokkerend" verhindert de export, "aandachtspunt" laat ze toe maar wordt getoond.
export function valideerDossier(d) {
  const leeg = (v) => !String(v ?? "").trim();
  const blokkerend = [];
  const aandachtspunten = [];
  const isNalatenschap = d.reden === "Nalatenschap";

  if (leeg(d.straat) || leeg(d.gemeente)) blokkerend.push("Adres van het pand (straat en gemeente) — tabblad Opdracht & partijen");
  if (leeg(d.datumVerslag)) blokkerend.push("Datum van het verslag — tabblad Opdracht & partijen");
  if (leeg(d.referentiedatum)) {
    blokkerend.push(isNalatenschap
      ? "Datum overlijden (referentiedatum) — bepaalt de waarde bij een nalatenschap"
      : "Referentiedatum van de schatting — tabblad Opdracht & partijen");
  }
  if (leeg(d.schatterNaam)) blokkerend.push("Naam van de schatter-expert — tabblad Opdracht & partijen");
  if (leeg(d.handtekening)) blokkerend.push("Handtekening bij de eedformule — tabblad Opdracht & partijen");
  if (isNalatenschap && leeg(d.schatterVlabelNummer)) {
    blokkerend.push("Vlabel-identificatienummer van de schatter-expert — vereist bij een nalatenschap");
  }

  if (leeg(d.eedPlaats)) aandachtspunten.push('Plaats bij de eedformule ("Gedaan te …") is niet ingevuld');
  if (leeg(d.opdrachtgeverNaam)) aandachtspunten.push("Opdrachtgever is niet ingevuld");
  if (leeg(d.capakey)) aandachtspunten.push("CaPaKey (kadastrale identificatie) is niet ingevuld");
  if ((d.fotos || []).length === 0) aandachtspunten.push("Er zijn nog geen foto's toegevoegd");
  if (d.wijzeVanWaardering === "Vergelijkende methode" && (d.vergelijkingspunten || []).length === 0) {
    aandachtspunten.push("De vergelijkende methode is gekozen, maar er zijn geen vergelijkingspunten ingevoerd");
  }
  if (isNalatenschap) {
    if (leeg(d.overledenNaam)) aandachtspunten.push("Naam van de overleden persoon is niet ingevuld");
    if (leeg(d.vlabelDossiernummer)) aandachtspunten.push("Vlabel-dossiernummer is niet ingevuld");
  }
  if (d.status !== "afgewerkt") aandachtspunten.push('Dit dossier staat nog op "concept" — het verslag krijgt een ONTWERP-watermerk');

  return { blokkerend, aandachtspunten };
}

function voorafgaandeOpmerkingen(d, totalPages) {
  return [
    // letterlijke, door Vlabel voorgeschreven formulering (kwaliteitseisen schattingsverslagen,
    // punt 2.1.d) — bij "Nalatenschap" moet deze zin exact zo voorkomen; voor elke andere reden
    // van waardering wordt enkel het slot aangepast aan die reden.
    `Dit schattingsverslag is opgemaakt met naleving van de kwaliteitseisen voor schatters-experten, om te dienen als waardering bij ${REDEN_ZINSNEDE[d.reden] || "de opgegeven reden"}.`,
    `Ten tijde van onderhavig onderzoek was het eigendom ${d.gebruik === "Leegstaand" ? "niet in gebruik (leegstaand)" : "in gebruik"}.`,
    `Het verslag bestaat uit ${nlNumber(totalPages)} (${totalPages}) bladzijden.`,
    `Verklaart dat het taxatieverslag is opgemaakt ${d.opdrachtgeverAanwezig === "Nee" ? "buiten aanwezigheid van de OPDRACHTGEVER" : "in aanwezigheid van de OPDRACHTGEVER"}.`,
    `De referentiegevel is bij overeenkomst de straatzijde, waarbij de tegenoverliggende gevel achterzijde of tuinzijde wordt genoemd. Door "links" of "rechts" moet worden verstaan wat zich links of rechts bevindt wanneer men de referentiegevel aankijkt.`,
    `Er is geen onderzoek gedaan onder het behang, schilderwerk of vloerbekleding.`,
    `De leidingen van gas, stookolie, water, elektriciteit, rookkanalen of schoorstenen zijn niet onderzocht.`,
    `De funderingen, de riolering, de septische putten of waterputten zijn niet onderzocht.`,
    `De waardering is gebaseerd op visuele inspectie en opname door een deskundige.`,
    `Deze studie is mede gebaseerd op door de opdrachtgever of derden verstrekte gegevens.`,
    `C.V. of andere apparaten worden niet gecontroleerd tenzij specifiek vermeld.`,
    `Tevens is ervan uitgegaan dat uit toepasselijke wetten, maatregelen, regelingen of verordeningen, geen bijzondere publiekrechtelijke noch privaatrechtelijke beperkingen voortvloeien, die de waarde kunnen beïnvloeden.`,
    `Er is geen rekening gehouden met eventueel te verkrijgen, dan wel te restitueren premies, subsidies of overheidsbijdragen in welke vorm dan ook of hoe ook genoemd, tenzij anders vermeld.`,
    `Tenzij anders vermeld, is ter zake geen bijzondere informatie ingewonnen, en is geen uitgebreid onderzoek verricht naar voorgaande verwervingstitels, waaruit eventuele zakelijke rechten van derden anders dan opgegeven zouden blijken. Er is evenmin onderzoek gedaan naar mogelijke andere rechten van derden uit overeenkomst die op de desbetreffende zaken zouden kunnen rusten.`,
    `De waardebepaling gaat uit van de getaxeerde zaken als één geheel. Indien zaken afzonderlijk of binnen een andere samenstelling worden gewaardeerd, kan de waarde afwijken van de in het rapport vermelde waarde.`,
    `We gaan ervan uit dat, indien de informatie zoals vermeld in de vorige 2 punten niet correct is, dit implicaties geeft op de waarde en dat de ondergetekende niet aansprakelijk kan gesteld worden.`,
    `Een waardering is geen resultaatsverbintenis en houdt bijgevolg geen garanties in bij eventuele verkoop.`,
    `Deze studie is gebaseerd op een theoretische benadering door ondergetekende, zonder een technische inspectie te zijn; alle materialen en installaties worden als optimaal functioneel beschouwd, tenzij expliciet anders vermeld.`,
    `Abnormale omstandigheden die de markt plots kunnen beïnvloeden worden uitgesloten.`,
    `Met betrekking tot de expertises die afhankelijk zijn van het voltooien van de werken of veranderingen aan het pand, worden de waardebepalingen gebaseerd op de vakkundige voltooiing van deze werken in overeenstemming met de plannen en opgegeven werken. Een slechte uitvoering van de werken kan de prijs beïnvloeden in de negatieve zin.`,
    `De opgegeven waarden in dit verslag zijn van toepassing indien voor het betrokken perceel een geldig bodemattest en een stedenbouwkundige vergunning kunnen worden voorgelegd.`,
    `Alle afmetingen zijn benaderend en werden geraamd na een vluchtige meting.`,
  ];
}


// ---------- word-export: zelfstandige, Word-veilige HTML-generator ----------
// Word ondersteunt geen CSS flex/grid, dus deze generator gebruikt uitsluitend <table>-lay-out
// en inline stijlen, volledig los van de Tailwind-klassen die het scherm gebruikt.
const wRow = (k, v) => (isEmptyVal(v) ? "" :
  `<tr><td style="padding:6px 16px 6px 0;color:#4B5160;font-size:14px;vertical-align:top;width:42%;">${wEsc(k)}</td><td style="padding:6px 0;font-size:14px;vertical-align:top;">${wEsc(v)}</td></tr>`);
const wTable = (rows) => {
  const trs = rows.map(([k, v]) => wRow(k, v)).join("");
  return trs ? `<table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">${trs}</table>` : "";
};
const wH = (text) => `<div style="font-size:13px;font-weight:600;color:#8C6A2F;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;margin:16px 0 8px 0;">${wEsc(text)}</div>`;
const wPara = (label, value) => (isEmptyVal(value) ? "" :
  `<p style="font-size:14px;margin:0 0 10px 0;line-height:1.7;">${label ? `<strong>${wEsc(label)}: </strong>` : ""}${wEsc(value)}</p>`);
const wSimpleTable = (headers, rows) => {
  if (!rows.length) return "";
  const thead = `<tr>${headers.map((h) => `<th style="text-align:left;padding:6px 10px 6px 0;font-size:12px;color:#4B5160;border-bottom:1px solid #DDD8CA;">${wEsc(h)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 10px 6px 0;font-size:14px;border-bottom:1px dotted #DDD8CA;">${wEsc(c)}</td>`).join("")}</tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">${thead}${tbody}</table>`;
};
const wList = (title, items) => (!items.length ? "" :
  `<div style="margin:0 0 12px 0;"><strong style="font-size:14px;">${wEsc(title)}</strong><ul style="margin:6px 0 0 20px;padding:0;font-size:14px;line-height:1.7;">${items.map((i) => `<li style="margin-bottom:3px;">${wEsc(i)}</li>`).join("")}</ul></div>`);
// legt de opgeladen foto's als echte, ingesloten afbeeldingen (data-URL) vast — tijdelijke
// bestandslinks (blob-url) zijn buiten deze pagina/dit document niet geldig, een data-URL wel.
// Telkens 6 foto's (3 kolommen × 2 rijen) samen op een eigen, nette bijlagepagina.
const chunkArray = (arr, size) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; };
const wPhotoPage = (fotos) => {
  const cols = 3;
  const rows = [];
  for (let i = 0; i < fotos.length; i += cols) {
    const rowFotos = fotos.slice(i, i + cols);
    const cells = rowFotos.map((f) => `<td style="width:${100 / cols}%;padding:8px;vertical-align:top;">
      <img src="${veiligeAfbeeldingSrc(f.base64)}" style="width:100%;height:auto;display:block;border:1px solid #DDD8CA;" />
      <div style="font-size:10px;color:#4B5160;margin-top:4px;text-align:center;">${wEsc(f.categorie || "Andere")}</div>
    </td>`).join("");
    const leeg = Array(cols - rowFotos.length).fill(`<td style="width:${100 / cols}%;"></td>`).join("");
    rows.push(`<tr>${cells}${leeg}</tr>`);
  }
  return `<table style="width:100%;border-collapse:collapse;">${rows.join("")}</table>`;
};

// Bouwt enkel de pand-specifieke inhoud (secties 1..N + adres) op basis van één "eenpand-vormig"
// dossierobject — d.i. een dossier zoals het er al sinds jaar en dag uitziet (alle pand-velden op
// het hoogste niveau). Voor een gewoon dossier zonder extra panden is dit exact de volledige
// rapportinhoud; bij een multi-pand dossier (zie extraPanden/maakLeegPand) wordt deze functie
// hieronder eenmaal per pand aangeroepen — telkens op een tijdelijk samengesteld object dat het
// dossier overlapt met de eigen velden van dát pand (zie buildMultiPandReportData) — zodat elk
// pand exact dezelfde, al geteste sectie-opbouw krijgt zonder dat deze functie zelf iets over
// meerdere panden moet weten.
function buildPandSections(d, calc, huisstijl) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  // overschaduwt de module-brede wH(): sectiekopjes in de geëxporteerde PDF volgen zo de kleur
  // van de actieve huisstijl (Houpels brass of Huyzen blauw) i.p.v. altijd brass te zijn.
  const wH = (text) => `<div style="font-size:13px;font-weight:600;color:${hs.kleur};text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;margin:16px 0 8px 0;">${wEsc(text)}</div>`;
  const eig = d.eigenschappen;
  // vastgoedType (zie StepType) bepaalt hier welke secties in het verslag komen — zie de
  // toelichting bij de steps-array in DossierWizard voor dezelfde conditie in de wizard zelf.
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`;
  const bullets = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);
  const roomText = (room, cfg) => {
    if (!room) return "";
    const parts = [];
    if (room.type?.length) parts.push(`Type: ${room.type.join(", ")}`);
    if (room.vloer) parts.push(`Vloer: ${room.vloer}`);
    if (room.aantal) parts.push(`Aantal: ${room.aantal}`);
    if (room.orientatie) parts.push(`Oriëntatie: ${room.orientatie}`);
    if (room.items.length) {
      if (cfg?.optGroups) {
        cfg.optGroups.forEach((g) => {
          const sel = room.items.filter((it) => g.opts.includes(it));
          if (sel.length) parts.push(`${g.label}: ${sel.join(", ")}`);
        });
        const overig = room.items.filter((it) => !cfg.optGroups.some((g) => g.opts.includes(it)));
        if (overig.length) parts.push(overig.join(", "));
      } else {
        parts.push(room.items.join(", "));
      }
    }
    if (room.merken) parts.push(`Merken: ${room.merken}`);
    if (room.andere) parts.push(`Andere: ${room.andere}`);
    return parts.join(" — ");
  };
  const wRoomBlock = (label, room, cfg) => wPara(label, roomText(room, cfg));

  const sections = [];

  sections.push({ title: "Opdracht & partijen", html:
    wH("Identificatie schatter-expert") +
    wTable([["Naam", d.schatterNaam], ["Titel", d.schatterTitel], ["BIV-nummer", d.schatterBivNummer], ["Vlabel-identificatienummer", d.schatterVlabelNummer], ["Telefoon", d.schatterTelefoon]]) +
    wH("Opdracht") +
    wTable([
      ["Opdrachtgever", d.opdrachtgeverNaam], ["Adres opdrachtgever", d.opdrachtgeverAdres],
      ["Rijksregister-/ondernemingsnummer", d.opdrachtgeverIdNummer],
      ["Wettelijke vertegenwoordiger", d.opdrachtgeverVertegenwoordiger],
      ["Reden van waardering", d.reden], ["Opdrachtgever aanwezig", d.opdrachtgeverAanwezig],
      ["Datum plaatsbezoek", nlDate(d.datumBezoek)], ["Datum verslag", nlDate(d.datumVerslag)],
      [d.reden === "Nalatenschap" ? "Referentiedatum (overlijden)" : "Referentiedatum schatting", nlDate(d.referentiedatum)],
    ]) +
    (d.reden === "Nalatenschap" ? wH("Nalatenschap — overleden persoon") + wTable([
      ["Naam overleden persoon", d.overledenNaam],
      ["Rijksregisternummer overleden persoon", d.overledenRijksregisternummer],
      ["Dossiernummer Vlabel", d.vlabelDossiernummer],
      ["Datum overlijden", nlDate(d.referentiedatum)],
    ]) : "") +
    wH("Contactgegevens verkoper") +
    wTable([["Naam", d.verkoperNaam], ["Adres", d.verkoperAdres], ["Telefoon", d.verkoperTelefoon], ["E-mail", d.verkoperEmail]]) +
    (d.gebruik === "Verhuurd" ? wH("Huurder") + wTable([
      ["Naam", d.huurderNaam], ["Telefoon", d.huurderTelefoon], ["E-mail", d.huurderEmail],
      ["Huurprijs", d.huurderHuurprijs], ["Type huurcontract", d.huurderContractType], ["Duurtijd", d.huurderDuurtijd],
      // Handelshuurwet-gegevens: enkel relevant/ingevuld bij een niet-residentieel verhuurd pand —
      // zie de toelichting bij de uitbreiding van de Huurder-sectie in StepMarkt.
      ...(!isResidentieel ? [
        ["Aanvangsdatum huurovereenkomst", nlDate(d.huurderAanvangsdatum)],
        ["Eerstvolgende opzegmogelijkheid", d.huurderEersteOpzegmogelijkheid],
        ["Hernieuwingsrecht", d.huurderHernieuwingsrecht !== "Onbekend" ? d.huurderHernieuwingsrecht : ""],
        ["Indexatie", d.huurderIndexatie], ["Huurwaarborg", d.huurderWaarborg],
        ["Bijzonderheden opzegtermijn/-beding", d.huurderOpzegtermijnBijzonderheden],
      ] : []),
    ]) : "") });

  sections.push({ title: "Aard en ligging", html:
    wH("Adres & kadaster") +
    wTable([
      ["Adres", adres], ["Dorp/gehucht", d.dorpGehucht], ["CaPaKey", d.capakey],
      ["Kadastrale afdeling", d.kadAfdeling], ["Kadastrale sectie", d.kadSectie],
      ["Perceelnummer", d.kadPerceelnummer], ["Partitienummer", d.kadPartitienummer],
      ["Kadastrale oppervlakte", d.kadastraleOpp ? `${d.kadastraleOpp} m²` : ""],
      ["KI", d.ki], ["Onroerende voorheffing", d.onroerendeVoorheffing],
      ["Detail privatieve eigendom", d.kadDetailPrivatief],
    ]) +
    // liggingskaart — enkel als er een adres én een Google Maps API-sleutel is (zie
    // GOOGLE_MAPS_API_KEY hierboven); ontbreekt de sleutel, dan laten we de kaart gewoon weg
    // i.p.v. een gebroken afbeelding in het verslag te tonen.
    ((d.straat && d.gemeente && GOOGLE_MAPS_API_KEY) ?
      `<img src="${wEsc(buildStaticMapUrl(adres + ", België"))}" alt="Liggingskaart" style="width:100%;max-width:520px;display:block;border:1px solid #DDD8CA;border-radius:4px;margin:0 0 16px 0;" />` : "") +
    // kadasterkaart (CadGIS), met het opgezochte perceel zelf gemarkeerd — enkel als de bbox al
    // vooraf opgelost is (zie fetchCadgisPerceel/cadgisBbox hierboven), wat gebeurt zodra een
    // geldige CaPaKey werd ingevuld
    buildCadgisKaartHtml(d.cadgisBbox, d.cadgisRingen) +
    // leeg gelaten velden/secties worden helemaal weggelaten uit het verslag i.p.v. "niet ingevuld"
    // of een misleidende schijnwaarde (zoals "0%") te tonen — vandaar de expliciete lege-checks
    // hieronder in plaats van de wTable/wRow-waarde gewoon altijd door te geven.
    (d.eigenaars.filter((e) => e.naam).length === 0 ? "" :
      wH("Eigendomstoestand — zakelijke rechten") +
      wTable(d.eigenaars.filter((e) => e.naam).map((e) => [e.naam, `${e.recht}${e.aandeel ? " — " + e.aandeel : ""}`]))) +
    wH("Type onroerend goed") +
    wTable([
      ["Vastgoedtype", d.vastgoedType + (d.vastgoedType === "Bedrijfsvastgoed" && d.bedrijfsSubtype ? ` — ${d.bedrijfsSubtype}` : "")],
      ["Pand", d.pandType], ["Aard", d.aardWoning], ["Bouwtype", d.bouwtype], ["Verdieping(en)", d.verdiepingen],
      ["Lift", d.lift], ["Bouwjaar", d.bouwjaar], ["Renovatiejaar", d.renovatiejaar],
      ["Jaar van aankoop", d.jaarVanAankoop], ["Staat", d.staat.join(", ")],
    ]) });

  sections.push({ title: "Ligging, omgeving & terrein", html:
    ((d.omgevingsvoorzieningen || d.bereikbaarheid || d.straatuitrusting || d.bpaRupVerkaveling) ? (
      wH("Ligging in de omgeving") + wPara("Voorzieningen", d.omgevingsvoorzieningen) +
      wPara("Bereikbaarheid", d.bereikbaarheid) + wPara("Toestand & uitrusting van de straat", d.straatuitrusting) +
      wTable([["Stedenbouwkundige voorschriften", d.bpaRupVerkaveling]])
    ) : "") +
    wH("Terrein & inplanting") +
    wTable([
      ["Vorm van het perceel", d.vormPerceel], ["Rooilijnbreedte", d.rooilijnbreedte ? `${d.rooilijnbreedte} m` : ""],
      // "0%" is voor bodemoccupatie in de praktijk nooit een echt ingevulde waarde, enkel het
      // resultaat van een leeggelaten veld — daarom hier ook expliciet als leeg behandeld
      ["Relatieve hoogteligging", d.hoogteligging],
      ["Bodemoccupatie", (d.bodemoccupatie && Number(d.bodemoccupatie) !== 0) ? `${d.bodemoccupatie}%` : ""],
      ["Aantal bijgebouwen", d.aantalBijgebouwen], ["Inplanting op het terrein", d.inplanting],
    ]) });

  sections.push({ title: "Afmetingen & indeling", html:
    wH("Afmetingen") +
    wTable([
      ["Gevelbreedte", d.breedteGevel ? `${d.breedteGevel} m` : ""], ["Perceelbreedte", d.breedtePerceel ? `${d.breedtePerceel} m` : ""],
      ["Grondoppervlakte", d.grondopp ? `${d.grondopp} m²` : ""], ["Bebouwde oppervlakte", d.bebouwdeOpp ? `${d.bebouwdeOpp} m²` : ""],
      [`${isResidentieel ? "Bewoonbare" : "Nuttige vloer"} oppervlakte (schatting)`, d.bewoonbareOppSchatting ? `${d.bewoonbareOppSchatting} m²` : ""],
      [`${isResidentieel ? "Bewoonbare" : "Nuttige vloer"} oppervlakte (berekend)`, `${calc.totOppNaCoeff.toFixed(1)} m²`],
      ["Oriëntatie", d.orientatie],
      ...(d.pandType === "Appartement" ? [
        ["Aandeel gemeenschappelijke delen", d.gemeenschappelijkeDelenOpp ? `${d.gemeenschappelijkeDelenOpp} m²` : ""],
        ["Aandeel in de gemeenschap", d.aandeelDuizendsten ? `${d.aandeelDuizendsten}/1000` : ""],
        ["Effectief grondaandeel", calc.effectiefGrondaandeel > 0 ? `${calc.effectiefGrondaandeel.toFixed(2)} m²` : ""],
      ] : []),
    ]) +
    // Coëfficiënt en oppervlakte ná coëfficiënt horen hier expliciet bij: die coëfficiënt (zolder
    // 0,5; terras 0,9; ...) stuurt de volledige ABEX-waarde, en zonder die twee kolommen kan een
    // lezer de "berekende bewoonbare oppervlakte" onmogelijk narekenen.
    wH("Bouwlaag") +
    wSimpleTable(["Verdieping", "Opp. (m²)", "Coëff.", "Na coëff. (m²)"], d.ruimtes.map((r) => {
      const v = VERDIEPINGEN.find((x) => x.key === r.verdieping);
      const opp = num(r.opp), coeff = num(r.coeff);
      return [v ? v.label : r.verdieping, r.opp || "—", r.coeff ?? "—", opp && coeff ? (opp * coeff).toFixed(1) : "—"];
    })) +
    wTable([
      ["Totale oppervlakte", calc.totOpp > 0 ? `${calc.totOpp.toFixed(1)} m²` : ""],
      ["Berekende oppervlakte na coëfficiënten", calc.totOppNaCoeff > 0 ? `${calc.totOppNaCoeff.toFixed(1)} m²` : ""],
    ]) });

  sections.push({ title: "Constructie & isolatie", html:
    wH("Ruwbouw, gevels & dak") +
    wTable([
      ["Ruwbouw", d.ruwbouw === "Andere" ? d.ruwbouwAndere : d.ruwbouw],
      ["Voorgevel", d.voorgevel], ["Zijgevel", d.zijgevel], ["Achtergevel", d.achtergevel],
      ["Materiaalkwaliteit muren & plafonds", d.materiaalkwaliteitOmschrijving],
      ["Hoofddak", d.hoofddakType], ["Materiaal hoofddak", d.hoofddakMateriaal],
      ["Bijgebouw", d.bijgebouwConstructie],
    ]) +
    wH("Isolatie") +
    // het residentiële EPC (kWh/m²) hieronder is enkel zinvol/ingevuld bij Residentieel — het
    // niet-residentiële EPC-regime (kNR/NR) staat in de Bedrijfskenmerken-sectie hierboven
    wTable([
      ...(isResidentieel ? [["EPC", d.epcStatus], ["EPC-waarde", d.epcWaarde ? `${d.epcWaarde} kWh/m²` : ""],
        ["EPC-certificaatnummer", d.epcCertificaatnummer]] : []),
      ["Isolatie", d.isolatie.join(", ")],
    ]) +
    wH("Buitenschrijnwerk") + wPara("", d.buitenschrijnwerk.join(", ")) });

  sections.push({ title: "Verwarming & technische installaties", html:
    wH("Verwarming") +
    wTable([
      ["Soort", d.verwarmingSoort.join(", ")], ["Grondstof", d.verwarmingGrondstof.join(", ")],
      ["Verwarmingselementen", d.verwarmingElementen.join(", ")], ["Merk/type ketel", d.ketelMerkType],
    ]) +
    wH("Warm water") +
    wTable([["Warm water", d.warmWater.join(", ")], ["Merk/type ketel", d.warmWaterKetelMerkType]]) +
    wH("Technische installaties") +
    wTable([["Elektrische keuring", d.keuringStatus], ["Dag + nacht teller", d.dagNachtTeller]]) +
    wPara("Allerlei", d.allerlei.join(", ")) });

  // de drie residentiële ruimte-secties hieronder (hall/woonkamer/keuken, slaapkamers/badkamer,
  // berging/kelder/garage/tuin) komen uit de checklists van StepRuimteEigenschappen, die bij
  // KMO-vastgoed/Bedrijfsvastgoed vervangen is door StepBedrijfskenmerken (zie de steps-array in
  // DossierWizard) — dus verschijnen ze hier ook enkel bij Residentieel, en komt daarvoor in de
  // plaats één "Bedrijfskenmerken"-sectie op basis van de gegevens uit dat tabblad.
  if (isResidentieel) {
    sections.push({ title: "Interieur — eigenschappen per ruimte", html:
      wRoomBlock("Hall", eig.hall) + wRoomBlock("Woonkamer", eig.woonkamer) + wRoomBlock("Keuken", eig.keuken) });

    sections.push({ title: "Interieur — slaapkamers & badkamer", html:
      wH("Interieur") +
      wSimpleTable(["Naam", "Vloer", "Verdieping", "Ingemaakte kasten", "Radiator"], d.slaapkamers.map((s) => [s.naam, s.vloer || "—", s.verdieping || "—", s.ingemaaktKasten, s.radiator || "Nee"])) +
      wRoomBlock("Badkamer", eig.badkamer) });

    const extraRuimtesText = (d.extraRuimtes || []).filter((r) => r.naam)
      .map((r) => `${r.naam}${r.vloer ? " — vloer: " + r.vloer : ""}${r.kenmerken ? " — " + r.kenmerken : ""}`).join("; ");

    sections.push({ title: "Exterieur — berging, kelder, garage & tuin", html:
      wRoomBlock("Berging", eig.berging) + wRoomBlock("Kelder", eig.kelder) +
      wRoomBlock("Garage / box / carport / oprit / staanplaats", eig.garage, RUIMTE_CHECKLISTS.find((c) => c.key === "garage")) + wRoomBlock("Tuin / terras", eig.tuinTerras) +
      wPara("Andere ruimtes", extraRuimtesText) +
      (d.verbouwingen ? wH("Verbouwingen / renovaties") + wPara("", d.verbouwingen) : "") });
  } else {
    const subtype = d.vastgoedType === "Bedrijfsvastgoed" ? d.bedrijfsSubtype : "";
    sections.push({ title: "Bedrijfskenmerken", html:
      wH("Algemene bedrijfskenmerken") +
      wTable([
        ["Vervangingswaarde (nieuwbouw, na veroudering)", d.bedrijfsVervangingswaarde ? eur(num(d.bedrijfsVervangingswaarde)) : ""],
        ["Bestemmingszone", d.bedrijfsBestemmingszone], ["Omgevingsvergunning milieu", d.bedrijfsVergunningMilieu],
        ["Aantal parkeerplaatsen", d.bedrijfsParkeerplaatsen], ["Aantal laadkades", d.bedrijfsLaadkades],
        ["EPC-regime", d.bedrijfsEpcType], ["EPC-waarde", d.bedrijfsEpcWaarde], ["EPC-certificaatnummer", d.bedrijfsEpcCertificaatnummer],
      ]) +
      wPara("Omschrijving indeling & functionaliteit", d.bedrijfsOmschrijvingIndeling) +
      wH("Interne afwerking") +
      wTable([
        ["Vloerafwerking", d.bedrijfsVloerafwerking], ["Wandafwerking", d.bedrijfsWandafwerking], ["Plafondafwerking", d.bedrijfsPlafondafwerking],
      ]) +
      (subtype === "Kantoor" ? wH("Kantoor — specifieke kenmerken") + wTable([
        ["Indeling", d.kantoorIndeling], ["Aantal verdiepingen", d.kantoorVerdiepingen],
        ["Lift aanwezig", d.kantoorLiftAanwezig !== "Onbekend" ? d.kantoorLiftAanwezig : ""],
        ["Serverruimte/technisch lokaal", d.kantoorServerruimte !== "Onbekend" ? d.kantoorServerruimte : ""],
        ["Certificering", d.kantoorCertificering],
      ]) : "") +
      (subtype === "Winkel" ? wH("Winkel — specifieke kenmerken") + wTable([
        ["Locatiecategorie", d.winkelLocatiecategorie], ["Gevelbreedte", d.winkelGevelbreedte ? `${d.winkelGevelbreedte} m` : ""],
        ["Etalage aanwezig", d.winkelEtalage !== "Onbekend" ? d.winkelEtalage : ""],
        ["Magazijn/opslag achteraan", d.winkelMagazijnAchteraan !== "Onbekend" ? d.winkelMagazijnAchteraan : ""],
        ["Inschatting voetgangersfrequentie", d.winkelPasanten],
      ]) : "") +
      (subtype === "Industrieel/logistiek" ? wH("Industrieel/logistiek — specifieke kenmerken") + wTable([
        ["Vrije hoogte", d.industrieelVrijeHoogte ? `${d.industrieelVrijeHoogte} m` : ""],
        ["Vloerbelasting", d.industrieelVloerbelasting ? `${d.industrieelVloerbelasting} ton/m²` : ""],
        ["Aantal dock levellers", d.industrieelAantalDockLevellers], ["Elektrisch vermogen", d.industrieelElektrischVermogen],
        ["Deelbaarheid", d.industrieelDeelbaarheid],
      ]) : "") +
      (subtype === "Horeca" ? wH("Horeca — specifieke kenmerken") + wTable([
        ["Type horecazaak", d.horecaType],
        ["Uitbatingsvergunning aanwezig", d.horecaVergunningUitbating !== "Onbekend" ? d.horecaVergunningUitbating : ""],
        ["Terras aanwezig", d.horecaTerras !== "Onbekend" ? d.horecaTerras : ""],
        ["Aantal zitplaatsen", d.horecaZitplaatsen], ["Keukenuitrusting", d.horecaKeukenuitrusting],
      ]) : "") +
      (d.verbouwingen ? wH("Verbouwingen / renovaties") + wPara("", d.verbouwingen) : "") });
  }

  sections.push({ title: "Markt & stedenbouwkundige gegevens", html:
    wH("Markt & algemeen gebruik") +
    wTable([
      ["Gebruik", d.gebruik], [isResidentieel ? "Bewoonbaarheid" : "Functionele geschiktheid", d.bewoonbaarheid],
      ["Aanbod te koop", d.aanbodTeKoop], ["Aanbod te huur", d.aanbodTeHuur],
      ["Verkoopbaarheid", d.verkoopbaarheid], ["Uitzicht", d.uitzicht],
      ["Onderhoud", d.onderhoud], ["Inrichting", d.inrichting],
    ]) +
    wH("Stedenbouwkundige gegevens") +
    wTable([
      ["Gewestplan hoofdbestemming", d.gewestplan], ["Erfgoed", d.erfgoed],
      ["Voorkooprecht", d.voorkooprecht], ["Bouwmisdrijven", d.bouwmisdrijven],
      ["Vergunning", d.vergunning], ["Verkaveling", d.verkaveling],
      ["Watertoets P-score", d.watertoetsP], ["Watertoets G-score", d.watertoetsG],
      ["Mobiscore", d.mobiscore ? `${d.mobiscore}/10` : ""],
    ]) +
    wH("Juridische gegevens") +
    wTable([
      ["Type verwervingsakte", d.aankoopAkteType], ["Datum verwervingsakte", nlDate(d.aankoopAkteDatum)],
      ["Datum basisakte", nlDate(d.basisAkteDatum)], ["Erfdienstbaarheden", d.erfdienstbaarheden],
      ["Overige zakelijke rechten", d.zakelijkeRechten],
    ]) });

  sections.push({ title: "SWOT-analyse", html:
    wList("Sterktes", bullets(d.sterktes)) + wList("Zwaktes", bullets(d.zwaktes)) +
    wList("Kansen", bullets(d.kansen)) + wList("Bedreigingen", bullets(d.bedreigingen)) +
    (d.conclusie ? wH("Conclusie") + `<p style="font-size:12px;line-height:1.5;">${wEsc(d.conclusie)}</p>` : "") });

  // vergelijkingspunten in het verslag zelf tonen — enkel bij "Nalatenschap": de Vlabel-
  // kwaliteitseisen (schattingsverslagen in het kader van een aangifte van nalatenschap) vereisen
  // net dat deze gegevens (adres, kadaster, transactiegegevens, afweging) wél in het verslag
  // staan (punt 2.3.b) — voor elke andere reden (bv. een gewone verkoopschatting) blijft de
  // bestaande GDPR-vermelding gelden.
  const vglPuntenHtml = (() => {
    if (d.wijzeVanWaardering !== "Vergelijkende methode") return "";
    if (d.reden !== "Nalatenschap") {
      return `<p style="font-size:12px;font-style:italic;color:#4B5160;margin:0 0 10px 0;">VGL-punten (${d.vergelijkingspunten.length}) — Omwille van de GDPR-wetgeving kunnen de VGL-punten niet worden weergegeven in het verslag.</p>`;
    }
    if (d.vergelijkingspunten.length === 0) return "";
    // rijen komen uit rapportVergelijkingspuntRijen (zie "GEDEELD RAPPORTMODEL" hierboven) — exact
    // dezelfde functie die ook de scherm-voorvertoning in StepRapport voedt.
    return d.vergelijkingspunten.map((v, i) => wH(`Vergelijkingspunt ${i + 1}`) + wTable(rapportVergelijkingspuntRijen(v))).join("");
  })();

  const methodeLine = `${d.wijzeVanWaardering}${d.wijzeVanWaarderingMotivering ? " — " + d.wijzeVanWaarderingMotivering : ""}`;
  // waarderingsblokken komen uit rapportWaarderingsBlokken (zie "GEDEELD RAPPORTMODEL" hierboven)
  // — exact dezelfde volgorde, voorwaarden en cijfers als de scherm-voorvertoning in StepRapport.
  const waarderingsBlokkenHtml = rapportWaarderingsBlokken(d, calc).map((blok) =>
    wH(blok.titel) + wTable(blok.rijen) +
    (blok.motivering ? `<p style="font-size:11px;color:#4B5160;margin:4px 0 8px 0;">${wEsc(blok.motivering)}</p>` : "")
  ).join("");
  sections.push({ title: "Waardering", html:
    wH("Wijze van waardering") +
    `<p style="font-size:12px;margin:0 0 8px 0;">${wEsc(methodeLine)}</p>` +
    vglPuntenHtml +
    waarderingsBlokkenHtml +
    `<p style="font-size:11px;color:#4B5160;margin:12px 0 8px 0;">${wEsc(rapportVenaleWaardeZin(d))}</p>` +
    `<table style="width:100%;background:#E4EEEB;margin-top:6px;"><tr><td style="padding:10px;font-family:Georgia,serif;font-weight:bold;color:#2F5B4F;">Venale waarde</td><td style="padding:10px;text-align:right;font-size:16px;font-weight:bold;color:#2F5B4F;">${eur(calc.venaleWaarde)}</td></tr></table>` });

  const eedLine = d.eedPlaats && d.datumVerslag ? `Gedaan te ${d.eedPlaats} op ${nlDate(d.datumVerslag)}`
    : d.eedPlaats ? `Gedaan te ${d.eedPlaats}` : d.datumVerslag ? `Gedaan op ${nlDate(d.datumVerslag)}` : "";
  sections.push({ title: "Eedformule", html:
    `<div style="text-align:center;padding:40px 0;">
      <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;margin-bottom:40px;">"Ik zweer dat ik mijn opdracht in eer en geweten getrouw heb vervuld."</p>
      ${eedLine ? `<p style="font-size:12px;color:#4B5160;">${wEsc(eedLine)}</p>` : ""}
      ${d.handtekening ? `<img src="${veiligeAfbeeldingSrc(d.handtekening)}" style="height:70px;display:block;margin:24px auto 0;" />` : ""}
      ${d.schatterNaam ? `<p style="font-size:12px;margin-top:${d.handtekening ? 8 : 30}px;">${wEsc(d.schatterNaam)}</p>` : ""}
      ${d.schatterTitel ? `<p style="font-size:11px;color:#4B5160;">${wEsc(d.schatterTitel)}</p>` : ""}
    </div>` });

  // "Notities" staat in de wizard uitdrukkelijk als INTERN veld ("Notities (intern)") en hoort dus
  // niet in het afgeleverde verslag: wat een schatter daar voor zichzelf noteert (over een eigenaar,
  // een gebrek, een afspraak) ging voordien gewoon mee naar de opdrachtgever, de notaris of Vlabel.
  sections.push({ title: "Bijlagen", html:
    `<p style="font-size:12px;margin:0 0 6px 0;">${d.fotos.length} foto${d.fotos.length === 1 ? "" : "'s"}</p>` +
    // Geraadpleegde stukken: de opgeladen documenten (bodemattest, EPC, akte, kadastraal uittreksel)
    // kwamen voordien nergens in het verslag voor, terwijl een bank of notaris net wil zien waarop
    // de schatting steunt.
    ((d.documenten || []).length > 0
      ? wH("Geraadpleegde stukken") + wSimpleTable(["Document", "Soort"],
          d.documenten.map((doc) => {
            const t = String(doc.type || "");
            const soort = /pdf/i.test(t) ? "PDF" : /^image\//i.test(t) ? "Afbeelding" : /text/i.test(t) ? "Tekst" : (t.split("/").pop() || "—");
            return [doc.naam || "—", soort];
          }))
      : "") });

  return { sections, adres };
}

// Ongewijzigd t.o.v. vóór de invoering van buildPandSections hierboven (zie audit-toelichting
// daarbij): een gewoon éénpand-dossier doorloopt exact dezelfde stappen als voorheen, dus levert
// dit voor elk bestaand dossier (en elk nieuw dossier zonder extra panden) een identiek verslag op.
function buildReportData(d, calc, huisstijl) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  const { sections, adres } = buildPandSections(d, calc, huisstijl);
  // Parkeerplaatsen & garages horen bij het dossier als geheel (niet bij één pand), en werden
  // daardoor tot nog toe enkel in het meerdere-panden-verslag opgenomen (buildMultiPandReportData).
  // Bij een gewoon dossier met één pand stonden ze wél op het scherm (StepWaardering toont er een
  // subtotaal) maar niet in de PDF, en telden ze dus ook niet mee in het eindbedrag. Hier komen ze
  // nu op exact dezelfde manier in het verslag terecht.
  const parkeerTotaal = berekenParkeerplaatsenTotaal(d.parkeerplaatsenGarages);
  if ((d.parkeerplaatsenGarages || []).length > 0) {
    sections.push({ title: "Parkeerplaatsen & garages", html:
      wSimpleTable(
        ["Type", "Aantal", "Waarde/stuk", "Subtotaal"],
        d.parkeerplaatsenGarages.map((p) => [
          p.type, p.aantal || "—", p.waardePerStuk ? eur(num(p.waardePerStuk)) : "—", eur(num(p.aantal) * num(p.waardePerStuk)),
        ])
      ) +
      `<table style="width:100%;background:#E4EEEB;margin-top:6px;"><tr><td style="padding:10px;font-family:Georgia,serif;font-weight:bold;color:#2F5B4F;">Totale venale waarde (pand + parkeerplaatsen/garages)</td><td style="padding:10px;text-align:right;font-size:16px;font-weight:bold;color:#2F5B4F;">${eur((calc.venaleWaarde || 0) + parkeerTotaal)}</td></tr></table>` });
  }
  const fotoChunks = chunkArray(d.fotos.filter((f) => f.base64), 6);
  // enkel gebruikt voor de openingszin "dit verslag telt N bladzijden" — een ruwe schatting
  // volstaat daar, want dat is louter een tekstuele vermelding. De écht-kloppende paginanummers
  // (voettekst + inhoudstafel hieronder) hangen hier NIET van af: die worden op de server exact
  // opgemeten na een eerste render, zie /api/generate-pdf. Het voorblad telt niet mee (2 =
  // voorafgaande opmerkingen + inhoudstafel), consistent met de paginanummering elders.
  const totalPagesEstimate = 2 + sections.length + fotoChunks.length;
  const opmerkingen = voorafgaandeOpmerkingen(d, totalPagesEstimate);

  const coverHtml = `<div>
    ${hs.logo ? `<img src="${veiligeAfbeeldingSrc(hs.logo)}" style="width:64px;height:64px;object-fit:contain;margin-bottom:14px;" />` : ""}
    <p style="font-size:15px;letter-spacing:2px;color:${hs.kleur};margin-bottom:34px;">${wEsc(hs.naam.toUpperCase())}</p>
    ${d.voorpaginaFoto?.base64 ? `<img src="${veiligeAfbeeldingSrc(d.voorpaginaFoto.base64)}" style="width:380px;max-width:80%;height:260px;object-fit:cover;border-radius:6px;border:1px solid #DDD8CA;margin-bottom:26px;" />` : ""}
    <p style="font-size:15px;letter-spacing:1px;color:#4B5160;text-transform:uppercase;margin-bottom:10px;">Taxatieverslag</p>
    <h1 style="font-family:Georgia,serif;font-size:36px;font-weight:normal;margin-bottom:18px;">${wEsc(adres)}</h1>
    <p style="font-size:16px;color:#4B5160;">${d.opdrachtgeverNaam ? `Opgemaakt voor ${wEsc(d.opdrachtgeverNaam)} · ` : ""}reden: ${wEsc(d.reden.toLowerCase())}</p>
    ${d.datumVerslag ? `<p style="font-size:16px;color:#4B5160;">Datum verslag: ${wEsc(nlDate(d.datumVerslag))}</p>` : ""}
    ${(d.schatterNaam || d.schatterTitel || d.schatterBivNummer || d.schatterVlabelNummer || d.schatterTelefoon) ? `<div style="margin-top:40px;padding-top:18px;border-top:1px solid #DDD8CA;">
      ${d.schatterNaam ? `<p style="font-size:14px;margin-bottom:2px;">${wEsc(d.schatterNaam)}</p>` : ""}
      ${d.schatterTitel ? `<p style="font-size:12px;color:#4B5160;margin-bottom:2px;">${wEsc(d.schatterTitel)}</p>` : ""}
      ${d.schatterBivNummer ? `<p style="font-size:11px;color:#4B5160;margin-bottom:1px;">BIV-nummer: ${wEsc(d.schatterBivNummer)}</p>` : ""}
      ${d.schatterVlabelNummer ? `<p style="font-size:11px;color:#4B5160;margin-bottom:1px;">Vlabel-identificatienummer: ${wEsc(d.schatterVlabelNummer)}</p>` : ""}
      ${d.schatterTelefoon ? `<p style="font-size:11px;color:#4B5160;">Tel.: ${wEsc(d.schatterTelefoon)}</p>` : ""}
    </div>` : ""}
  </div>`;

  // ---- inhoudstafel met écht kloppende paginanummers ----
  // elk onderdeel dat een eigen regel in de inhoudstafel krijgt, staat hier op volgorde met een
  // vast volgnummer (tocIndex). Vlak vóór dat onderdeel plaatsen we een onzichtbare tekstmerker
  // (tocMark) — de server rendert de pagina één keer, zoekt op welke fysieke bladzijde elke
  // merker terechtkwam, en vult pas dán het bijhorende TOCPAGE_i-plaatshoudertje in de
  // inhoudstafel in met het echte nummer, vóór de definitieve PDF gegenereerd wordt. Zo klopt de
  // inhoudstafel altijd, ongeacht hoe de secties zich natuurlijk over de pagina's verdelen.
  const tocTitles = ["Voorafgaande opmerkingen", "Inhoud",
    ...sections.map((s, i) => `${i + 1}. ${s.title}`),
    ...fotoChunks.map((_, i) => fotoChunks.length > 1 ? `Bijlagen — foto's (${i + 1}/${fotoChunks.length})` : "Bijlagen — foto's")];
  // let op het dubbele vierkante-haakjesformaat "[[TOCMARK:i]]" (i.p.v. simpelweg "TOCMARK_i"):
  // deze merker staat vlak vóór een sectietitel die zelf met een cijfer begint (bv. "1. Aard en
  // ligging" door de sectienummering hieronder) — bij het uitlezen van de PDF-tekstlaag kunnen
  // twee opeenvolgende tekstelementen zonder tussenruimte aan elkaar geplakt worden, waardoor
  // bv. "TOCMARK_2" gevolgd door "1. Aard..." zou lezen als "TOCMARK_21" (verkeerd nummer!). De
  // afsluitende "]]" bakent de merker ondubbelzinnig af, ongeacht wat erna volgt.
  const tocMark = (i) => `<span class="tocmark">[[TOCMARK:${i}]]</span>`;

  const opmerkingenBlockHtml = `<section class="opm-block">
    ${tocMark(0)}
    <h2 style="font-size:12px;letter-spacing:0.5px;margin-bottom:10px;">VOORAFGAANDE OPMERKINGEN</h2>
    <ul style="font-size:9px;line-height:1.4;margin:0;padding-left:14px;">
      ${opmerkingen.map((o) => `<li style="margin-bottom:4px;">${wEsc(o)}</li>`).join("")}
    </ul>
  </section>`;

  const tocBlockHtml = `<section class="toc-block">
    ${tocMark(1)}
    <h2 style="font-size:14px;letter-spacing:0.5px;margin-bottom:14px;">INHOUD</h2>
    <table style="width:100%;border-collapse:collapse;">
      ${tocTitles.map((t, i) => `<tr><td style="padding:5px 0;font-size:12px;border-bottom:1px dotted #DDD8CA;">${wEsc(t)}</td><td style="padding:5px 0;font-size:12px;text-align:right;white-space:nowrap;border-bottom:1px dotted #DDD8CA;">TOCPAGE_${i}</td></tr>`).join("")}
    </table>
  </section>`;

  const sectionsBlockHtml = sections.map((s, i) => `<section class="rsec">
    ${tocMark(2 + i)}
    <h2 class="rsec-title">${i + 1}. ${wEsc(s.title)}</h2>
    ${s.html}
  </section>`).join("");

  const fotoBlockHtml = fotoChunks.map((chunk, i) => `<section class="foto-block">
    ${tocMark(2 + sections.length + i)}
    <h2 class="rsec-title">Bijlagen — foto's${fotoChunks.length > 1 ? ` (${i + 1}/${fotoChunks.length})` : ""}</h2>
    ${wPhotoPage(chunk)}
  </section>`).join("");

  return { coverHtml, opmerkingenBlockHtml, tocBlockHtml, sectionsBlockHtml, fotoBlockHtml, adres };
}

// ---------- PDF-export: meerdere panden in één verslag (zie StepPanden/extraPanden) ----------
// Wordt enkel gebruikt zodra d.extraPanden minstens één pand bevat (zie buildPrintHtml hieronder)
// — elk gewoon dossier zonder extra panden blijft het bestaande, volledig ongewijzigde
// buildReportData-pad volgen. Deze functie hergebruikt buildPandSections() voor élk pand
// afzonderlijk (dus exact dezelfde, allang bestaande sectie-opbouw per pand — inclusief foto's,
// SWOT, waardering enz.) en voegt er vooraan één "Portefeuille — overzicht en totaalwaarde"-sectie
// aan toe met de samenvattende tabel + totaalsom die hiervoor expliciet gekozen werd. Er is precies
// één voorblad, één blok "voorafgaande opmerkingen" en één inhoudstafel voor het hele verslag —
// géén aparte kaftpagina per pand — zodat het resultaat leest als één samenhangend rapport i.p.v.
// een aantal aan elkaar geplakte, op zichzelf staande documenten.
function buildMultiPandReportData(d, calc, huisstijl) {
  const hs = huisstijl || HUISSTIJLEN.houpels;

  // pand 0 = het hoofdpand, d.w.z. de bestaande vlakke velden op het dossier zelf (calc is hier al
  // berekend, zie useCalc(d) in DossierWizard) — elk pand uit extraPanden krijgt zijn eigen,
  // opnieuw berekende calc, via hetzelfde berekenWaardering() dat ook voor een gewoon dossier
  // gebruikt wordt (geen aparte/parallelle rekenlogica dus).
  const alleP = [
    { pd: d, pcalc: calc },
    ...d.extraPanden.map((pand) => {
      const pd = { ...d, ...pand, extraPanden: [], parkeerplaatsenGarages: [] };
      return { pd, pcalc: berekenWaardering(pd) };
    }),
  ];
  const pandenData = alleP.map(({ pd, pcalc }) => ({ ...buildPandSections(pd, pcalc, huisstijl), pd, pcalc }));

  const parkeerTotaal = berekenParkeerplaatsenTotaal(d.parkeerplaatsenGarages);
  const totaalVenaleWaarde = pandenData.reduce((som, p) => som + (p.pcalc.venaleWaarde || 0), 0) + parkeerTotaal;
  const heeftParkeer = (d.parkeerplaatsenGarages || []).length > 0;
  const portefeuilleHtml =
    wH("Panden in dit dossier") +
    wSimpleTable(
      ["Pand", "Adres", "Vastgoedtype", "Venale waarde"],
      pandenData.map((p, i) => [
        `Pand ${i + 1}`, p.adres,
        p.pd.vastgoedType + (p.pd.vastgoedType === "Bedrijfsvastgoed" && p.pd.bedrijfsSubtype ? ` — ${p.pd.bedrijfsSubtype}` : ""),
        eur(p.pcalc.venaleWaarde || 0),
      ])
    ) +
    (heeftParkeer ? wH("Parkeerplaatsen & garages") + wSimpleTable(
      ["Type", "Aantal", "Waarde/stuk", "Subtotaal"],
      d.parkeerplaatsenGarages.map((p) => [
        p.type, p.aantal || "—", p.waardePerStuk ? eur(num(p.waardePerStuk)) : "—", eur(num(p.aantal) * num(p.waardePerStuk)),
      ])
    ) : "") +
    `<table style="width:100%;background:#E4EEEB;margin-top:6px;"><tr><td style="padding:10px;font-family:Georgia,serif;font-weight:bold;color:#2F5B4F;">Totale venale waarde (alle panden${heeftParkeer ? " + parkeerplaatsen/garages" : ""})</td><td style="padding:10px;text-align:right;font-size:16px;font-weight:bold;color:#2F5B4F;">${eur(totaalVenaleWaarde)}</td></tr></table>`;

  // samengevoegde sectielijst: eerst het overzicht, dan per pand al zijn secties — elk voorzien
  // van een "Pand N —"-voorvoegsel zodat in de inhoudstafel en de sectietitels zelf altijd
  // duidelijk blijft bij welk pand een sectie hoort (het volledige adres staat sowieso al zowel in
  // de overzichtstabel hierboven als in elk pand se eigen sectie "Aard en ligging").
  const sections = [
    { title: "Portefeuille — overzicht en totaalwaarde", html: portefeuilleHtml },
    ...pandenData.flatMap((p, i) => p.sections.map((s) => ({ title: `Pand ${i + 1} — ${s.title}`, html: s.html }))),
  ];

  // ook de foto's van élk pand komen in het verslag terecht (niet enkel die van het hoofdpand) —
  // elke foto krijgt de bijhorende pandlabel als onderschrift, i.p.v. enkel de categorie.
  const alleFotos = pandenData.flatMap((p, i) =>
    p.pd.fotos.filter((f) => f.base64).map((f) => ({ ...f, categorie: `Pand ${i + 1} — ${f.categorie || "Andere"}` }))
  );
  const fotoChunks = chunkArray(alleFotos, 6);

  const totalPagesEstimate = 2 + sections.length + fotoChunks.length;
  const opmerkingen = voorafgaandeOpmerkingen(d, totalPagesEstimate);

  const overigeAantal = pandenData.length - 1;
  const titelAdres = `${pandenData[0].adres} (+ ${overigeAantal} ${overigeAantal === 1 ? "ander pand" : "andere panden"})`;

  const coverHtml = `<div>
    ${hs.logo ? `<img src="${veiligeAfbeeldingSrc(hs.logo)}" style="width:64px;height:64px;object-fit:contain;margin-bottom:14px;" />` : ""}
    <p style="font-size:15px;letter-spacing:2px;color:${hs.kleur};margin-bottom:34px;">${wEsc(hs.naam.toUpperCase())}</p>
    ${d.voorpaginaFoto?.base64 ? `<img src="${veiligeAfbeeldingSrc(d.voorpaginaFoto.base64)}" style="width:380px;max-width:80%;height:260px;object-fit:cover;border-radius:6px;border:1px solid #DDD8CA;margin-bottom:26px;" />` : ""}
    <p style="font-size:15px;letter-spacing:1px;color:#4B5160;text-transform:uppercase;margin-bottom:10px;">Taxatieverslag — meerdere panden</p>
    <h1 style="font-family:Georgia,serif;font-size:30px;font-weight:normal;margin-bottom:18px;">${wEsc(titelAdres)}</h1>
    <p style="font-size:16px;color:#4B5160;">${d.opdrachtgeverNaam ? `Opgemaakt voor ${wEsc(d.opdrachtgeverNaam)} · ` : ""}reden: ${wEsc(d.reden.toLowerCase())}</p>
    ${d.datumVerslag ? `<p style="font-size:16px;color:#4B5160;">Datum verslag: ${wEsc(nlDate(d.datumVerslag))}</p>` : ""}
    ${(d.schatterNaam || d.schatterTitel || d.schatterBivNummer || d.schatterVlabelNummer || d.schatterTelefoon) ? `<div style="margin-top:40px;padding-top:18px;border-top:1px solid #DDD8CA;">
      ${d.schatterNaam ? `<p style="font-size:14px;margin-bottom:2px;">${wEsc(d.schatterNaam)}</p>` : ""}
      ${d.schatterTitel ? `<p style="font-size:12px;color:#4B5160;margin-bottom:2px;">${wEsc(d.schatterTitel)}</p>` : ""}
      ${d.schatterBivNummer ? `<p style="font-size:11px;color:#4B5160;margin-bottom:1px;">BIV-nummer: ${wEsc(d.schatterBivNummer)}</p>` : ""}
      ${d.schatterVlabelNummer ? `<p style="font-size:11px;color:#4B5160;margin-bottom:1px;">Vlabel-identificatienummer: ${wEsc(d.schatterVlabelNummer)}</p>` : ""}
      ${d.schatterTelefoon ? `<p style="font-size:11px;color:#4B5160;">Tel.: ${wEsc(d.schatterTelefoon)}</p>` : ""}
    </div>` : ""}
  </div>`;

  const tocTitles = ["Voorafgaande opmerkingen", "Inhoud",
    ...sections.map((s, i) => `${i + 1}. ${s.title}`),
    ...fotoChunks.map((_, i) => fotoChunks.length > 1 ? `Bijlagen — foto's (${i + 1}/${fotoChunks.length})` : "Bijlagen — foto's")];
  const tocMark = (i) => `<span class="tocmark">[[TOCMARK:${i}]]</span>`;

  const opmerkingenBlockHtml = `<section class="opm-block">
    ${tocMark(0)}
    <h2 style="font-size:12px;letter-spacing:0.5px;margin-bottom:10px;">VOORAFGAANDE OPMERKINGEN</h2>
    <ul style="font-size:9px;line-height:1.4;margin:0;padding-left:14px;">
      ${opmerkingen.map((o) => `<li style="margin-bottom:4px;">${wEsc(o)}</li>`).join("")}
    </ul>
  </section>`;

  const tocBlockHtml = `<section class="toc-block">
    ${tocMark(1)}
    <h2 style="font-size:14px;letter-spacing:0.5px;margin-bottom:14px;">INHOUD</h2>
    <table style="width:100%;border-collapse:collapse;">
      ${tocTitles.map((t, i) => `<tr><td style="padding:5px 0;font-size:12px;border-bottom:1px dotted #DDD8CA;">${wEsc(t)}</td><td style="padding:5px 0;font-size:12px;text-align:right;white-space:nowrap;border-bottom:1px dotted #DDD8CA;">TOCPAGE_${i}</td></tr>`).join("")}
    </table>
  </section>`;

  const sectionsBlockHtml = sections.map((s, i) => `<section class="rsec">
    ${tocMark(2 + i)}
    <h2 class="rsec-title">${i + 1}. ${wEsc(s.title)}</h2>
    ${s.html}
  </section>`).join("");

  const fotoBlockHtml = fotoChunks.map((chunk, i) => `<section class="foto-block">
    ${tocMark(2 + sections.length + i)}
    <h2 class="rsec-title">Bijlagen — foto's${fotoChunks.length > 1 ? ` (${i + 1}/${fotoChunks.length})` : ""}</h2>
    ${wPhotoPage(chunk)}
  </section>`).join("");

  return { coverHtml, opmerkingenBlockHtml, tocBlockHtml, sectionsBlockHtml, fotoBlockHtml, adres: titelAdres };
}

// ---------- PDF-export: doorlopende opmaak, échte automatische paginering ----------
// Geen vaste "1 pagina per sectie" meer: secties vloeien natuurlijk door (break-inside: avoid
// voorkomt enkel een lelijke afbreking mid-sectie), en de fysieke marges + paginanummers worden
// op de server door Puppeteer zelf toegepast op de uiteindelijke, écht gerenderde pagina's — zie
// /api/generate-pdf. Dat garandeert correcte marges en nummering ongeacht hoeveel er precies op
// elke pagina past, in plaats van dat hier vooraf te moeten raden.
function buildPrintHtml(d, calc, huisstijl) {
  // een dossier zonder extra panden (verreweg de meeste — en elk dossier van vóór deze
  // functionaliteit) doorloopt exact het bestaande, ongewijzigde pad; enkel zodra er via de
  // Panden-lijst effectief extra panden zijn toegevoegd, wordt het gecombineerde portefeuille-pad
  // gebruikt (zie buildMultiPandReportData hierboven).
  const { coverHtml, opmerkingenBlockHtml, tocBlockHtml, sectionsBlockHtml, fotoBlockHtml, adres } =
    (d.extraPanden && d.extraPanden.length > 0)
      ? buildMultiPandReportData(d, calc, huisstijl)
      : buildReportData(d, calc, huisstijl);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Taxatieverslag ${wEsc(adres)}</title>
<style>
  /* BELANGRIJK — geen "margin" in deze @page-regel zetten (ook niet margin:0): getest en
     bevestigd dat een expliciete @page-marge (zelfs @page{margin:0}) in deze Chromium-versie
     stilzwijgend Puppeteer's eigen page.pdf({margin}) (zie /api/generate-pdf) buiten werking
     zet — de fysieke afdrukmarge viel daardoor helemaal weg (links/rechts/boven zo goed als 0),
     wat de "afdrukmarges links/rechts zijn helemaal niet goed"-klacht verklaarde. Zonder een
     margin-eigenschap op @page (enkel het papierformaat) past Chromium Puppeteer's eigen
     marge-optie wél correct toe — dát is nu de enige plek die de marge bepaalt. Open je dit
     bestand zelf rechtstreeks in je browser (terugvaloptie zonder server), dan gebruikt de
     browser bij het afdrukken zijn eigen standaardmarges. */
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Georgia', 'Times New Roman', serif; color: #1B1F27; background: #fff; }
  table { border-collapse: collapse; }
  .tocmark { font-size: 1px; line-height: 0; color: #ffffff; }
  .cover-page { min-height: 255mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; break-after: page; }
  .opm-block, .toc-block { break-after: page; }
  /* elke sectie en elke foto-pagina begint bewust op een eigen, verse pagina (break-before) i.p.v.
     tegen elkaar aan te schuiven wanneer ze toevallig samen op een bladzijde passen — dat gaf een
     rommelig, "niet ordelijk" ogend resultaat. break-inside:avoid blijft daarnaast bestaan voor
     het (zeldzame) geval dat een sectie net iets te lang is en toch over twee pagina's zou vallen. */
  .rsec, .foto-block { break-inside: avoid; break-before: page; margin: 0 0 22px 0; }
  .rsec-title { font-family: 'Georgia', 'Times New Roman', serif; font-size: 16px; font-weight: 500; color: #1B1F27; margin-bottom: 10px; }
  @media screen {
    body { background: #E5E5E5; padding: 20px 0; }
    .sheet { max-width: 210mm; margin: 0 auto 20px auto; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.15); padding: 20mm 16mm; }
  }
  /* Watermerk zolang het dossier op "concept" staat. Een element met position:fixed herhaalt
     Chromium bij het afdrukken op ELKE pagina — precies wat hier nodig is, zodat een ontwerp
     nooit als afgewerkt verslag kan circuleren. Zodra de status op "afgewerkt" staat, wordt dit
     blok niet meegegeven en is de PDF volledig schoon. */
  .ontwerp-merk {
    position: fixed; top: 44%; left: 0; right: 0; text-align: center;
    font-family: 'Georgia', serif; font-size: 90px; letter-spacing: 14px; font-weight: bold;
    color: rgba(150, 35, 28, 0.13); transform: rotate(-24deg); pointer-events: none; z-index: 999;
  }
</style>
</head>
<body>
${d.status !== "afgewerkt" ? `<div class="ontwerp-merk">ONTWERP</div>` : ""}
<div class="sheet">
  <div class="cover-page">${coverHtml}</div>
  ${opmerkingenBlockHtml}
  ${tocBlockHtml}
  ${sectionsBlockHtml}
  ${fotoBlockHtml}
</div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body>
</html>`;
}

// ---------- rapport: page chrome ----------
function Page({ n, total, children, noFooter, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  return (
    <div className="rounded-lg mb-6 report-page" style={{ background: PAPER_RAISED, border: `1px solid ${LINE}`, fontFamily: "Georgia, serif", boxShadow: "0 1px 2px rgba(0,0,0,0.03)", position: "relative", minHeight: "261mm" }}>
      <div className="p-8" style={{ paddingBottom: noFooter ? 32 : 68 }}>{children}</div>
      {!noFooter && (
        <div className="flex justify-between items-center px-8 py-3 text-xs"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTop: `1px dotted ${LINE}`, color: INK_SOFT, fontFamily: "system-ui", background: PAPER_RAISED }}>
          <span>{hs.naam}</span>
          <span>Pagina {n} van {total}</span>
        </div>
      )}
    </div>
  );
}
function ReportH({ children }) {
  const hs = useContext(HuisstijlContext);
  return <h2 style={{ fontSize: 13, fontWeight: 600, color: hs.kleur, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 8, fontFamily: "Arial, sans-serif" }}>{children}</h2>;
}
function ReportGrid({ rows }) {
  const filled = rows.filter(([, v]) => !isEmptyVal(v));
  if (filled.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-2" style={{ fontFamily: "system-ui", fontSize: 15 }}>
      {filled.map(([k, v], i) => (
        <div key={k + i} className="flex justify-between" style={{ borderBottom: `1px dotted ${LINE}`, paddingBottom: 4, gap: 12 }}>
          <span style={{ color: INK_SOFT, flexShrink: 0 }}>{k}</span>
          <span style={{ textAlign: "right", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
function ReportList({ title, items }) {
  if (items.length === 0) return null;
  return (
    <div style={{ fontSize: 15 }}>
      <div className="font-medium mb-1">{title}</div>
      <ul className="list-disc pl-5" style={{ color: INK_SOFT, lineHeight: 1.7 }}>{items.map((it, i) => <li key={i} className="mb-0.5">{it}</li>)}</ul>
    </div>
  );
}
function RoomBlock({ label, room, cfg }) {
  if (!room) return null;
  const hasContent = room.vloer || room.items.length || room.andere || room.merken || room.aantal || room.orientatie || room.type?.length;
  if (!hasContent) return null;
  const overigeItems = cfg?.optGroups ? room.items.filter((it) => !cfg.optGroups.some((g) => g.opts.includes(it))) : room.items;
  return (
    <div className="mb-3">
      <div className="font-medium mb-1" style={{ fontFamily: "system-ui", fontSize: 15 }}>{label}</div>
      <div style={{ color: INK_SOFT, fontFamily: "system-ui", fontSize: 15, lineHeight: 1.7 }}>
        {room.type?.length > 0 && <div>Type: {room.type.join(", ")}</div>}
        {room.vloer && <div>Vloer: {room.vloer}</div>}
        {room.aantal && <div>Aantal: {room.aantal}</div>}
        {room.orientatie && <div>Oriëntatie: {room.orientatie}</div>}
        {cfg?.optGroups ? (
          cfg.optGroups.map((g) => {
            const sel = room.items.filter((it) => g.opts.includes(it));
            return sel.length > 0 ? <div key={g.key}>{g.label}: {sel.join(", ")}</div> : null;
          })
        ) : (
          room.items.length > 0 && <div>{room.items.join(", ")}</div>
        )}
        {cfg?.optGroups && overigeItems.length > 0 && <div>{overigeItems.join(", ")}</div>}
        {room.merken && <div>Merken: {room.merken}</div>}
        {room.andere && <div>Andere: {room.andere}</div>}
      </div>
    </div>
  );
}

// ---------- rapport preview ----------
function StepRapport({ d, calc, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  const bullets = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);
  const eig = d.eigenschappen;
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const bedrijfsSubtype = d.vastgoedType === "Bedrijfsvastgoed" ? d.bedrijfsSubtype : "";
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`;
  const reportRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  // controle vóór aflevering — zie valideerDossier hierboven
  const controle = valideerDossier(d);

  // content pages (elk item = 1 pagina), na voorblad + voorafgaande opmerkingen + inhoudstafel
  const contentPages = [
    {
      title: "Opdracht & partijen",
      body: (
        <>
          <ReportH>Identificatie schatter-expert</ReportH>
          <ReportGrid rows={[
            ["Naam", dash(d.schatterNaam)], ["Titel", dash(d.schatterTitel)],
            ["BIV-nummer", dash(d.schatterBivNummer)],
            ["Vlabel-identificatienummer", dash(d.schatterVlabelNummer)],
            ["Telefoon", dash(d.schatterTelefoon)],
          ]} />
          <ReportH>Opdracht</ReportH>
          <ReportGrid rows={[
            ["Opdrachtgever", dash(d.opdrachtgeverNaam)], ["Adres opdrachtgever", dash(d.opdrachtgeverAdres)],
            ["Rijksregister-/ondernemingsnummer", dash(d.opdrachtgeverIdNummer)],
            ["Wettelijke vertegenwoordiger", dash(d.opdrachtgeverVertegenwoordiger)],
            ["Reden van waardering", d.reden], ["Opdrachtgever aanwezig", d.opdrachtgeverAanwezig],
            ["Datum plaatsbezoek", nlDate(dash(d.datumBezoek))], ["Datum verslag", nlDate(dash(d.datumVerslag))],
            [d.reden === "Nalatenschap" ? "Referentiedatum (overlijden)" : "Referentiedatum schatting", nlDate(dash(d.referentiedatum))],
          ]} />
          {d.reden === "Nalatenschap" && (
            <>
              <ReportH>Nalatenschap — overleden persoon</ReportH>
              <ReportGrid rows={[
                ["Naam overleden persoon", dash(d.overledenNaam)],
                ["Rijksregisternummer overleden persoon", dash(d.overledenRijksregisternummer)],
                ["Dossiernummer Vlabel", dash(d.vlabelDossiernummer)],
                ["Datum overlijden", nlDate(dash(d.referentiedatum))],
              ]} />
            </>
          )}
          <ReportH>Contactgegevens verkoper</ReportH>
          <ReportGrid rows={[
            ["Naam", dash(d.verkoperNaam)], ["Adres", dash(d.verkoperAdres)],
            ["Telefoon", dash(d.verkoperTelefoon)], ["E-mail", dash(d.verkoperEmail)],
          ]} />
          {d.gebruik === "Verhuurd" && (
            <>
              <ReportH>Huurder</ReportH>
              <ReportGrid rows={[
                ["Naam", dash(d.huurderNaam)], ["Telefoon", dash(d.huurderTelefoon)],
                ["E-mail", dash(d.huurderEmail)], ["Huurprijs", dash(d.huurderHuurprijs)],
                ["Type huurcontract", dash(d.huurderContractType)], ["Duurtijd", dash(d.huurderDuurtijd)],
                ...(!isResidentieel ? [
                  ["Aanvangsdatum huurovereenkomst", nlDate(dash(d.huurderAanvangsdatum))],
                  ["Eerstvolgende opzegmogelijkheid", dash(d.huurderEersteOpzegmogelijkheid)],
                  ["Hernieuwingsrecht", d.huurderHernieuwingsrecht !== "Onbekend" ? d.huurderHernieuwingsrecht : "—"],
                  ["Indexatie", dash(d.huurderIndexatie)], ["Huurwaarborg", dash(d.huurderWaarborg)],
                  ["Bijzonderheden opzegtermijn/-beding", dash(d.huurderOpzegtermijnBijzonderheden)],
                ] : []),
              ]} />
            </>
          )}
        </>
      ),
    },
    {
      title: "Aard en ligging",
      body: (
        <>
          <ReportH>Adres & kadaster</ReportH>
          <ReportGrid rows={[
            ["Adres", adres], ["Dorp/gehucht", dash(d.dorpGehucht)], ["CaPaKey", dash(d.capakey)],
            ["Kadastrale afdeling", dash(d.kadAfdeling)], ["Kadastrale sectie", dash(d.kadSectie)],
            ["Perceelnummer", dash(d.kadPerceelnummer)], ["Partitienummer", dash(d.kadPartitienummer)],
            ["Kadastrale oppervlakte", d.kadastraleOpp ? `${d.kadastraleOpp} m²` : "—"],
            ["KI", dash(d.ki)], ["Onroerende voorheffing", dash(d.onroerendeVoorheffing)],
            ["Detail privatieve eigendom", dash(d.kadDetailPrivatief)],
          ]} />
          {d.straat && d.gemeente && GOOGLE_MAPS_API_KEY && (
            <img src={buildStaticMapUrl(adres + ", België")} alt="Liggingskaart"
              style={{ width: "100%", maxWidth: 520, display: "block", border: `1px solid ${LINE}`, borderRadius: 4, marginBottom: 16 }} />
          )}
          {d.cadgisBbox && (
            <CadgisKaart bbox={d.cadgisBbox} ringen={d.cadgisRingen}
              style={{ maxWidth: 520, border: `1px solid ${LINE}`, borderRadius: 4, marginBottom: 16 }} />
          )}
          {d.eigenaars.filter((e) => e.naam).length > 0 && (
            <>
              <ReportH>Eigendomstoestand — zakelijke rechten</ReportH>
              <ReportGrid rows={d.eigenaars.filter((e) => e.naam).map((e) => [e.naam, `${e.recht}${e.aandeel ? " — " + e.aandeel : ""}`])} />
            </>
          )}
          <ReportH>Type onroerend goed</ReportH>
          <ReportGrid rows={[
            ["Vastgoedtype", d.vastgoedType + (d.vastgoedType === "Bedrijfsvastgoed" && d.bedrijfsSubtype ? ` — ${d.bedrijfsSubtype}` : "")],
            ["Pand", d.pandType], ["Aard", dash(d.aardWoning)], ["Bouwtype", d.bouwtype], ["Verdieping(en)", dash(d.verdiepingen)],
            ["Lift", d.lift], ["Bouwjaar", dash(d.bouwjaar)], ["Renovatiejaar", dash(d.renovatiejaar)],
            ["Jaar van aankoop", dash(d.jaarVanAankoop)], ["Staat", joinOrDash(d.staat)],
          ]} />
        </>
      ),
    },
    {
      title: "Ligging, omgeving & terrein",
      body: (
        <>
          {(d.omgevingsvoorzieningen || d.bereikbaarheid || d.straatuitrusting || d.bpaRupVerkaveling) && (
            <>
              <ReportH>Ligging in de omgeving</ReportH>
              {d.omgevingsvoorzieningen && (
                <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  <strong style={{ color: INK }}>Voorzieningen: </strong>{d.omgevingsvoorzieningen}
                </div>
              )}
              {d.bereikbaarheid && (
                <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  <strong style={{ color: INK }}>Bereikbaarheid: </strong>{d.bereikbaarheid}
                </div>
              )}
              {d.straatuitrusting && (
                <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  <strong style={{ color: INK }}>Toestand & uitrusting van de straat: </strong>{d.straatuitrusting}
                </div>
              )}
              <ReportGrid rows={[
                ["Stedenbouwkundige voorschriften", dash(d.bpaRupVerkaveling)],
              ]} />
            </>
          )}
          <ReportH>Terrein & inplanting</ReportH>
          <ReportGrid rows={[
            ["Vorm van het perceel", dash(d.vormPerceel)], ["Rooilijnbreedte", unit(d.rooilijnbreedte, "m")],
            ["Relatieve hoogteligging", d.hoogteligging],
            ["Bodemoccupatie", (d.bodemoccupatie && Number(d.bodemoccupatie) !== 0) ? unit(d.bodemoccupatie, "%") : "—"],
            ["Aantal bijgebouwen", dash(d.aantalBijgebouwen)], ["Inplanting op het terrein", dash(d.inplanting)],
          ]} />
        </>
      ),
    },
    {
      title: "Afmetingen & indeling",
      body: (
        <>
          <ReportH>Afmetingen</ReportH>
          <ReportGrid rows={[
            ["Gevelbreedte", unit(d.breedteGevel, "m")], ["Perceelbreedte", unit(d.breedtePerceel, "m")],
            ["Grondoppervlakte", unit(d.grondopp, "m²")], ["Bebouwde oppervlakte", unit(d.bebouwdeOpp, "m²")],
            [`${isResidentieel ? "Bewoonbare" : "Nuttige vloer"} oppervlakte (schatting)`, unit(d.bewoonbareOppSchatting, "m²")],
            [`${isResidentieel ? "Bewoonbare" : "Nuttige vloer"} oppervlakte (berekend)`, `${calc.totOppNaCoeff.toFixed(1)} m²`],
            ["Oriëntatie", d.orientatie],
            ...(d.pandType === "Appartement" ? [
              ["Aandeel gemeenschappelijke delen", unit(d.gemeenschappelijkeDelenOpp, "m²")],
              ["Aandeel in de gemeenschap", d.aandeelDuizendsten ? `${d.aandeelDuizendsten}/1000` : "—"],
              ["Effectief grondaandeel", calc.effectiefGrondaandeel > 0 ? `${calc.effectiefGrondaandeel.toFixed(2)} m²` : "—"],
            ] : []),
          ]} />
          <ReportH>Bouwlaag</ReportH>
          <table className="w-full text-sm" style={{ fontFamily: "system-ui", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                {["Verdieping", "Opp. (m²)"].map((h) => (
                  <th key={h} className="text-left py-1" style={{ color: INK_SOFT, fontSize: 12, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.ruimtes.map((r) => {
                const v = VERDIEPINGEN.find((x) => x.key === r.verdieping);
                return (
                  <tr key={r.id} style={{ borderBottom: `1px dotted ${LINE}` }}>
                    <td className="py-1">{v ? v.label : r.verdieping}</td>
                    <td className="py-1">{dash(r.opp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ),
    },
    {
      title: "Constructie & isolatie",
      body: (
        <>
          <ReportH>Ruwbouw, gevels & dak</ReportH>
          <ReportGrid rows={[
            ["Ruwbouw", d.ruwbouw === "Andere" ? dash(d.ruwbouwAndere) : d.ruwbouw],
            ["Voorgevel", dash(d.voorgevel)], ["Zijgevel", dash(d.zijgevel)], ["Achtergevel", dash(d.achtergevel)],
            ["Materiaalkwaliteit muren & plafonds", dash(d.materiaalkwaliteitOmschrijving)],
            ["Hoofddak", d.hoofddakType], ["Materiaal hoofddak", d.hoofddakMateriaal],
            ["Bijgebouw", dash(d.bijgebouwConstructie)],
          ]} />
          <ReportH>Isolatie</ReportH>
          <ReportGrid rows={[
            ...(isResidentieel ? [["EPC", d.epcStatus], ["EPC-waarde", d.epcWaarde ? `${d.epcWaarde} kWh/m²` : "—"],
              ["EPC-certificaatnummer", dash(d.epcCertificaatnummer)]] : []),
            ["Isolatie", joinOrDash(d.isolatie)],
          ]} />
          <ReportH>Buitenschrijnwerk</ReportH>
          <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{joinOrDash(d.buitenschrijnwerk)}</div>
        </>
      ),
    },
    {
      title: "Verwarming & technische installaties",
      body: (
        <>
          <ReportH>Verwarming</ReportH>
          <ReportGrid rows={[
            ["Soort", joinOrDash(d.verwarmingSoort)], ["Grondstof", joinOrDash(d.verwarmingGrondstof)],
            ["Verwarmingselementen", joinOrDash(d.verwarmingElementen)], ["Merk/type ketel", dash(d.ketelMerkType)],
          ]} />
          <ReportH>Warm water</ReportH>
          <ReportGrid rows={[
            ["Warm water", joinOrDash(d.warmWater)], ["Merk/type ketel", dash(d.warmWaterKetelMerkType)],
          ]} />
          <ReportH>Technische installaties</ReportH>
          <ReportGrid rows={[
            ["Elektrische keuring", d.keuringStatus], ["Dag + nacht teller", d.dagNachtTeller],
          ]} />
          <div className="text-sm mt-1" style={{ fontFamily: "system-ui", color: INK_SOFT }}>Allerlei: {joinOrDash(d.allerlei)}</div>
        </>
      ),
    },
    // de drie residentiële ruimte-pagina's hieronder horen bij StepRuimteEigenschappen, dat bij
    // KMO-vastgoed/Bedrijfsvastgoed vervangen is door StepBedrijfskenmerken (zie de steps-array in
    // DossierWizard) — dus verschijnen ze hier ook enkel bij Residentieel; anders komt in de plaats
    // één "Bedrijfskenmerken"-pagina, mét de subtype-specifieke kenmerken (Kantoor/Winkel/
    // Industrieel-logistiek/Horeca) indien van toepassing.
    ...(isResidentieel ? [
      {
        title: "Interieur — eigenschappen per ruimte",
        body: (
          <>
            <RoomBlock label="Hall" room={eig.hall} />
            <RoomBlock label="Woonkamer" room={eig.woonkamer} />
            <RoomBlock label="Keuken" room={eig.keuken} />
          </>
        ),
      },
      {
        title: "Interieur — slaapkamers & badkamer",
        body: (
          <>
            <ReportH>Interieur</ReportH>
            <table className="w-full text-sm mb-4" style={{ fontFamily: "system-ui", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                  {["Naam", "Vloer", "Verdieping", "Ingemaakte kasten", "Radiator"].map((h) => (
                    <th key={h} className="text-left py-1" style={{ color: INK_SOFT, fontSize: 12, fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.slaapkamers.map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px dotted ${LINE}` }}>
                    <td className="py-1">{s.naam}</td><td className="py-1">{dash(s.vloer)}</td>
                    <td className="py-1">{dash(s.verdieping)}</td><td className="py-1">{s.ingemaaktKasten}</td>
                    <td className="py-1">{s.radiator || "Nee"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <RoomBlock label="Badkamer" room={eig.badkamer} />
          </>
        ),
      },
      {
        title: "Exterieur — berging, kelder, garage & tuin",
        body: (
          <>
            <RoomBlock label="Berging" room={eig.berging} />
            <RoomBlock label="Kelder" room={eig.kelder} />
            <RoomBlock label="Garage / box / carport / oprit / staanplaats" room={eig.garage} cfg={RUIMTE_CHECKLISTS.find((c) => c.key === "garage")} />
            <RoomBlock label="Tuin / terras" room={eig.tuinTerras} />
            {(d.extraRuimtes || []).filter((r) => r.naam).map((r) => (
              <div key={r.id} className="mb-3">
                <div className="text-sm font-medium mb-1" style={{ fontFamily: "system-ui" }}>{r.naam}</div>
                <div className="text-sm" style={{ color: INK_SOFT, fontFamily: "system-ui" }}>
                  {r.vloer && <div>Vloer: {r.vloer}</div>}
                  {r.kenmerken && <div>{r.kenmerken}</div>}
                </div>
              </div>
            ))}
            {d.verbouwingen && (
              <>
                <ReportH>Verbouwingen / renovaties</ReportH>
                <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.verbouwingen}</div>
              </>
            )}
          </>
        ),
      },
    ] : [
      {
        title: "Bedrijfskenmerken",
        body: (
          <>
            <ReportH>Algemene bedrijfskenmerken</ReportH>
            <ReportGrid rows={[
              ["Vervangingswaarde (nieuwbouw, na veroudering)", d.bedrijfsVervangingswaarde ? eur(num(d.bedrijfsVervangingswaarde)) : "—"],
              ["Bestemmingszone", dash(d.bedrijfsBestemmingszone)], ["Omgevingsvergunning milieu", dash(d.bedrijfsVergunningMilieu)],
              ["Aantal parkeerplaatsen", dash(d.bedrijfsParkeerplaatsen)], ["Aantal laadkades", dash(d.bedrijfsLaadkades)],
              ["EPC-regime", dash(d.bedrijfsEpcType)], ["EPC-waarde", dash(d.bedrijfsEpcWaarde)], ["EPC-certificaatnummer", dash(d.bedrijfsEpcCertificaatnummer)],
            ]} />
            {d.bedrijfsOmschrijvingIndeling && (
              <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT, whiteSpace: "pre-wrap" }}>
                <strong style={{ color: INK }}>Omschrijving indeling & functionaliteit: </strong>{d.bedrijfsOmschrijvingIndeling}
              </div>
            )}
            <ReportH>Interne afwerking</ReportH>
            <ReportGrid rows={[
              ["Vloerafwerking", dash(d.bedrijfsVloerafwerking)], ["Wandafwerking", dash(d.bedrijfsWandafwerking)], ["Plafondafwerking", dash(d.bedrijfsPlafondafwerking)],
            ]} />
            {bedrijfsSubtype === "Kantoor" && (
              <>
                <ReportH>Kantoor — specifieke kenmerken</ReportH>
                <ReportGrid rows={[
                  ["Indeling", dash(d.kantoorIndeling)], ["Aantal verdiepingen", dash(d.kantoorVerdiepingen)],
                  ["Lift aanwezig", d.kantoorLiftAanwezig !== "Onbekend" ? d.kantoorLiftAanwezig : "—"],
                  ["Serverruimte/technisch lokaal", d.kantoorServerruimte !== "Onbekend" ? d.kantoorServerruimte : "—"],
                  ["Certificering", dash(d.kantoorCertificering)],
                ]} />
              </>
            )}
            {bedrijfsSubtype === "Winkel" && (
              <>
                <ReportH>Winkel — specifieke kenmerken</ReportH>
                <ReportGrid rows={[
                  ["Locatiecategorie", dash(d.winkelLocatiecategorie)], ["Gevelbreedte", unit(d.winkelGevelbreedte, "m")],
                  ["Etalage aanwezig", d.winkelEtalage !== "Onbekend" ? d.winkelEtalage : "—"],
                  ["Magazijn/opslag achteraan", d.winkelMagazijnAchteraan !== "Onbekend" ? d.winkelMagazijnAchteraan : "—"],
                  ["Inschatting voetgangersfrequentie", dash(d.winkelPasanten)],
                ]} />
              </>
            )}
            {bedrijfsSubtype === "Industrieel/logistiek" && (
              <>
                <ReportH>Industrieel/logistiek — specifieke kenmerken</ReportH>
                <ReportGrid rows={[
                  ["Vrije hoogte", unit(d.industrieelVrijeHoogte, "m")], ["Vloerbelasting", unit(d.industrieelVloerbelasting, "ton/m²")],
                  ["Aantal dock levellers", dash(d.industrieelAantalDockLevellers)], ["Elektrisch vermogen", dash(d.industrieelElektrischVermogen)],
                  ["Deelbaarheid", dash(d.industrieelDeelbaarheid)],
                ]} />
              </>
            )}
            {bedrijfsSubtype === "Horeca" && (
              <>
                <ReportH>Horeca — specifieke kenmerken</ReportH>
                <ReportGrid rows={[
                  ["Type horecazaak", dash(d.horecaType)],
                  ["Uitbatingsvergunning aanwezig", d.horecaVergunningUitbating !== "Onbekend" ? d.horecaVergunningUitbating : "—"],
                  ["Terras aanwezig", d.horecaTerras !== "Onbekend" ? d.horecaTerras : "—"],
                  ["Aantal zitplaatsen", dash(d.horecaZitplaatsen)], ["Keukenuitrusting", dash(d.horecaKeukenuitrusting)],
                ]} />
              </>
            )}
            {d.verbouwingen && (
              <>
                <ReportH>Verbouwingen / renovaties</ReportH>
                <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.verbouwingen}</div>
              </>
            )}
          </>
        ),
      },
    ]),
    {
      title: "Markt & stedenbouwkundige gegevens",
      body: (
        <>
          <ReportH>Markt & algemeen gebruik</ReportH>
          <ReportGrid rows={[
            ["Gebruik", d.gebruik], [isResidentieel ? "Bewoonbaarheid" : "Functionele geschiktheid", d.bewoonbaarheid],
            ["Aanbod te koop", d.aanbodTeKoop], ["Aanbod te huur", d.aanbodTeHuur],
            ["Verkoopbaarheid", d.verkoopbaarheid], ["Uitzicht", d.uitzicht],
            ["Onderhoud", d.onderhoud], ["Inrichting", d.inrichting],
          ]} />
          <ReportH>Stedenbouwkundige gegevens</ReportH>
          <ReportGrid rows={[
            ["Gewestplan hoofdbestemming", d.gewestplan], ["Erfgoed", d.erfgoed],
            ["Voorkooprecht", d.voorkooprecht], ["Bouwmisdrijven", d.bouwmisdrijven],
            ["Vergunning", d.vergunning], ["Verkaveling", d.verkaveling],
            ["Watertoets P-score", d.watertoetsP], ["Watertoets G-score", d.watertoetsG],
            ["Mobiscore", d.mobiscore ? `${d.mobiscore}/10` : "—"],
          ]} />
          <ReportH>Juridische gegevens</ReportH>
          <ReportGrid rows={[
            ["Type verwervingsakte", dash(d.aankoopAkteType)], ["Datum verwervingsakte", nlDate(dash(d.aankoopAkteDatum))],
            ["Datum basisakte", nlDate(dash(d.basisAkteDatum))], ["Erfdienstbaarheden", dash(d.erfdienstbaarheden)],
            ["Overige zakelijke rechten", dash(d.zakelijkeRechten)],
          ]} />
        </>
      ),
    },
    {
      title: "SWOT-analyse",
      body: (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4" style={{ fontFamily: "system-ui" }}>
            <ReportList title="Sterktes" items={bullets(d.sterktes)} />
            <ReportList title="Zwaktes" items={bullets(d.zwaktes)} />
            <ReportList title="Kansen" items={bullets(d.kansen)} />
            <ReportList title="Bedreigingen" items={bullets(d.bedreigingen)} />
          </div>
          {d.conclusie && (
            <>
              <ReportH>Conclusie</ReportH>
              <p className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.conclusie}</p>
            </>
          )}
        </>
      ),
    },
    {
      title: "Waardering",
      body: (
        <>
          <ReportH>Wijze van waardering</ReportH>
          <div className="text-sm mb-2" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
            {d.wijzeVanWaardering}{d.wijzeVanWaarderingMotivering ? ` — ${d.wijzeVanWaarderingMotivering}` : ""}
          </div>
          {/* vergelijkingspunten enkel volledig tonen bij "Nalatenschap" — zie toelichting bij
              vglPuntenHtml in buildReportData (dezelfde regel geldt hier voor de voorvertoning) */}
          {d.wijzeVanWaardering === "Vergelijkende methode" && d.reden !== "Nalatenschap" && (
            <div className="text-sm mb-4 italic" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
              VGL-punten ({d.vergelijkingspunten.length}) — Omwille van de GDPR-wetgeving kunnen de VGL-punten niet worden weergegeven in het verslag.
            </div>
          )}
          {/* rijen komen uit rapportVergelijkingspuntRijen (zie "GEDEELD RAPPORTMODEL") — exact
              dezelfde functie die ook de PDF (buildPandSections) voedt, inclusief de "Bron"-rij */}
          {d.wijzeVanWaardering === "Vergelijkende methode" && d.reden === "Nalatenschap" && d.vergelijkingspunten.map((v, i) => (
            <React.Fragment key={v.id}>
              <ReportH>Vergelijkingspunt {i + 1}</ReportH>
              <ReportGrid rows={rapportVergelijkingspuntRijen(v)} />
            </React.Fragment>
          ))}
          {/* waarderingsblokken komen uit rapportWaarderingsBlokken (zie "GEDEELD RAPPORTMODEL") —
              exact dezelfde volgorde, voorwaarden en cijfers als de PDF hierboven. */}
          {rapportWaarderingsBlokken(d, calc).map((blok) => (
            <React.Fragment key={blok.titel}>
              <ReportH>{blok.titel}</ReportH>
              <ReportGrid rows={blok.rijen} />
              {blok.motivering && <div className="text-xs mb-2" style={{ color: INK_SOFT }}>{blok.motivering}</div>}
            </React.Fragment>
          ))}
          <div className="text-sm mt-4 mb-1" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
            {rapportVenaleWaardeZin(d)}
          </div>
          <div className="mt-2 p-4 rounded flex justify-between items-center" style={{ background: STAMP_SOFT }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 500, color: STAMP }}>Venale waarde</span>
            <span className="font-mono" style={{ fontSize: 20, fontWeight: 500, color: STAMP }}>{eur(calc.venaleWaarde)}</span>
          </div>
        </>
      ),
    },
    {
      title: "Eedformule",
      body: (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 280 }}>
          <p className="text-sm mb-10" style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: INK }}>
            "Ik zweer dat ik mijn opdracht in eer en geweten getrouw heb vervuld."
          </p>
          {(d.eedPlaats || d.datumVerslag) && (
            <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
              {d.eedPlaats && `Gedaan te ${d.eedPlaats}`}{d.eedPlaats && d.datumVerslag && " op "}{!d.eedPlaats && d.datumVerslag && "Gedaan op "}{nlDate(d.datumVerslag)}
            </div>
          )}
          {d.handtekening && <img src={d.handtekening} alt="Handtekening" style={{ height: 70, marginTop: 24 }} />}
          {d.schatterNaam && <div className="text-sm" style={{ fontFamily: "system-ui", marginTop: d.handtekening ? 8 : 32 }}>{d.schatterNaam}</div>}
          {d.schatterTitel && <div className="text-xs" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.schatterTitel}</div>}
        </div>
      ),
    },
    {
      title: "Bijlagen",
      body: (
        <>
          <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
            {d.fotos.length} foto{d.fotos.length === 1 ? "" : "'s"}
          </div>
          {/* het interne notitieveld verschijnt bewust niet in het verslag — zie de toelichting bij
              de gelijkaardige sectie in buildPandSections hierboven */}
        </>
      ),
    },
  ];

  // paginanummering: voorblad telt niet mee (geen paginanummer, niet inbegrepen in "van X") —
  // nummering start pas bij 1 voor voorafgaande opmerkingen, 2 inhoudstafel, 3.. inhoud
  // (dit is enkel de on-scherm voorvertoning — elke sectie krijgt hier voor de duidelijkheid een
  // eigen kaartje; de échte, gedownloade PDF pakt secties waar mogelijk natuurlijk samen op één
  // pagina, zie buildPrintHtml/handlePrintPdf hieronder)
  const FIXED_PAGES = 2;
  const contentPageGroups = contentPages.map((p) => [p]);
  const totalPages = FIXED_PAGES + contentPageGroups.length;
  const opmerkingen = voorafgaandeOpmerkingen(d, totalPages);

  const handlePrintPdf = async () => {
    setError("");
    setExporting(true);
    // volwaardige versie met alle foto's als (blijvend geldige) base64-data — dit is wat de
    // terugval-HTML hieronder gebruikt, want een gedownload HTML-bestand kan de gebruiker later
    // pas openen, wanneer een tijdelijke Storage-link (zie verderop) al lang verlopen kan zijn.
    const htmlVolledig = buildPrintHtml(d, calc, hs);
    const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`;
    const bestandsnaam = `Taxatieverslag_${(d.straat || "verslag").replace(/\s+/g, "_")}`;
    // paden van foto's die hieronder eventueel tijdelijk naar Storage worden opgeladen (enkel om
    // de aanvraaglimiet te omzeilen) — worden aan het einde altijd opgeruimd
    let tijdelijkeFotoPaden = [];
    try {
      let htmlVoorServer = htmlVolledig;
      // Vercel laat een serverless-functie-aanvraag van max. 4,5MB toe (niet-configureerbaar,
      // zie ook uploadDocVoorAnalyse hierboven voor hetzelfde probleem bij de AI-analyse) — bij
      // dossiers met veel/grote foto's overschrijdt de HTML (met alle foto's als base64 erin)
      // die grens, wat /api/generate-pdf laat falen met status 413
      // (FUNCTION_PAYLOAD_TOO_LARGE). Ruime marge (3,5MB) t.o.v. de 4,5MB-limiet voor de
      // JSON-overhead (adres/huisstijl-velden) en de rest van de HTML.
      if (htmlVolledig.length > 3.5 * 1024 * 1024) {
        const fotosMetBase64 = (d.fotos || []).filter((f) => f.base64);
        const geuploadeFotos = await Promise.all(
          fotosMetBase64.map(async (f) => ({ id: f.id, ...(await uploadFotoVoorPdf(f, d.id)) }))
        );
        tijdelijkeFotoPaden = geuploadeFotos.map((g) => g.pad);
        const urlPerFotoId = new Map(geuploadeFotos.map((g) => [g.id, g.url]));
        let dVoorServer = {
          ...d,
          fotos: d.fotos.map((f) => (urlPerFotoId.has(f.id) ? { ...f, base64: urlPerFotoId.get(f.id) } : f)),
        };
        if (d.voorpaginaFoto?.base64) {
          const geuploadeVoorpagina = await uploadFotoVoorPdf(d.voorpaginaFoto, d.id);
          tijdelijkeFotoPaden.push(geuploadeVoorpagina.pad);
          dVoorServer = { ...dVoorServer, voorpaginaFoto: { ...d.voorpaginaFoto, base64: geuploadeVoorpagina.url } };
        }
        htmlVoorServer = buildPrintHtml(dVoorServer, calc, hs);
      }

      // echte, rechtstreekse PDF-omzetting op de server — garandeert 100% dezelfde lay-out
      // als de HTML, want dezelfde HTML wordt via een headless Chromium-browser omgezet
      // (zie /api/generate-pdf in het hostingpakket). Enkel beschikbaar zodra de app
      // effectief gehost is met die server-functie; binnen Claude.ai zelf bestaat dat adres
      // niet en valt de app automatisch terug op de HTML-download hieronder.
      // "adres" wordt apart meegestuurd zodat de server een kopregel met adres kan tonen op elke
      // pagina (via Puppeteers headerTemplate) — dat hoort niet in de HTML zelf thuis, want de
      // kopregel moet op élke fysiek gerenderde pagina verschijnen, ongeacht waar de inhoud
      // natuurlijk afbreekt. "huisstijl" wordt om dezelfde reden apart meegestuurd — de
      // kop-/voettekst tonen de firmanaam op élke pagina, ongeacht de huisstijl van de ingelogde
      // gebruiker (zie kiesHuisstijl hierboven).
      const pdfToken = await haalSessieToken();
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(pdfToken ? { Authorization: `Bearer ${pdfToken}` } : {}) },
        body: JSON.stringify({ html: htmlVoorServer, adres, huisstijl: hs }),
      });
      if (!response.ok) {
        // de échte foutmelding van de server tonen (i.p.v. ze te verbergen achter een generieke
        // "niet beschikbaar") — cruciaal om een falende Chromium-render op de server te kunnen
        // onderscheiden van het geval waarin /api/generate-pdf helemaal niet bestaat (bv. binnen
        // Claude.ai zelf, of vóór hosting).
        let detail = `status ${response.status}`;
        try {
          const body = await response.json();
          if (body?.error) detail = body.error;
        } catch (e3) { /* antwoord was geen JSON, hou de status-tekst aan */ }
        throw new Error(detail);
      }
      // "0" = de server kon de paginanummers voor de inhoudstafel niet betrouwbaar opmeten (zie
      // tocMetingOk in api/generate-pdf.js) — het document zelf is verder volledig in orde en wordt
      // gewoon gedownload, maar de gebruiker moet dit wél zichtbaar te zien krijgen (audit, punt H3).
      const tocMetingOk = response.headers.get("X-Toc-Meting-Ok") !== "0";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bestandsnaam}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (!tocMetingOk) {
        setError("Let op: de paginanummering in de inhoudstafel kon niet automatisch berekend worden voor dit document (de rest van het verslag is wel volledig in orde). Open de gedownloade PDF en controleer de paginanummers in de inhoudstafel vóór u ze doorgeeft.");
      }
    } catch (e) {
      // terugval zonder server: HTML-bestand downloaden, zelf te openen en als PDF op te slaan —
      // altijd de volledige (base64) versie, nooit htmlVoorServer: die kan verlopen Storage-links
      // bevatten tegen de tijd dat de gebruiker dit bestand opent.
      try {
        const blob = new Blob([htmlVolledig], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${bestandsnaam}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setError(`Server-PDF mislukt (${e.message || "onbekende fout"}) — een HTML-bestand is in de plaats gedownload; open het en kies "Opslaan als PDF". Blijft dit gebeuren, controleer de functielogs van /api/generate-pdf op Vercel.`);
      } catch (e2) {
        setError("Kon het rapport niet voorbereiden. Probeer opnieuw.");
      }
    } finally {
      setExporting(false);
      // de tijdelijke foto-kopieën in Storage waren enkel nodig om deze ene aanvraag onder de
      // limiet te krijgen — nooit bedoeld om te blijven bestaan (de "echte" foto's blijven, zoals
      // altijd, als base64 in het dossier zelf bewaard)
      if (tijdelijkeFotoPaden.length) {
        supabase.storage.from("dossier-bijlagen").remove(tijdelijkeFotoPaden).catch(() => {});
      }
    }
  };

  return (
    <HuisstijlContext.Provider value={hs}>
    <div>
      <div className="no-print flex items-center justify-between mb-4">
        <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 500 }}>Rapportvoorbeeld</div>
        <div className="flex gap-2">
          <button onClick={handlePrintPdf} disabled={exporting || controle.blokkerend.length > 0}
            title={controle.blokkerend.length > 0 ? "Vul eerst de ontbrekende verplichte gegevens aan" : ""}
            className="text-xs px-3 py-1.5 rounded-lg text-white"
            style={{ background: controle.blokkerend.length > 0 ? INK_SOFT : INK, opacity: controle.blokkerend.length > 0 ? 0.6 : 1 }}>
            {exporting ? "Bezig..." : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Controle vóór aflevering (zie valideerDossier): ontbrekende velden verdwijnen anders
          geruisloos uit de PDF, waardoor een onvolledig verslag er volkomen normaal uitziet. */}
      {controle.blokkerend.length > 0 && (
        <div className="no-print mb-4 px-4 py-3 rounded-lg" style={{ background: "#FBEAEA", border: `1px solid ${DANGER}` }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: DANGER, fontWeight: 600, fontSize: 13 }}>
            <AlertTriangle size={14} /> Nog niet klaar om af te leveren
          </div>
          <ul className="text-xs" style={{ color: INK, lineHeight: 1.7, paddingLeft: 18, listStyle: "disc" }}>
            {controle.blokkerend.map((punt) => <li key={punt}>{punt}</li>)}
          </ul>
        </div>
      )}
      {controle.aandachtspunten.length > 0 && (
        <div className="no-print mb-4 px-4 py-3 rounded-lg" style={{ background: BRASS_SOFT, border: `1px solid ${BRASS}` }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: BRASS, fontWeight: 600, fontSize: 13 }}>
            <AlertTriangle size={14} /> Aandachtspunten — je kan het verslag wel aanmaken
          </div>
          <ul className="text-xs" style={{ color: INK, lineHeight: 1.7, paddingLeft: 18, listStyle: "disc" }}>
            {controle.aandachtspunten.map((punt) => <li key={punt}>{punt}</li>)}
          </ul>
        </div>
      )}
      {error && (
        <div className="no-print flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}
      <div className="no-print text-xs mb-4" style={{ color: INK_SOFT }}>
        "Download PDF" vraagt een rechtstreeks PDF-bestand op bij de server — dat is enkel actief zodra de app gehost is met de meegeleverde server-functie (zie hostingpakket). Wordt die niet gevonden (zoals hier, binnen Claude.ai), dan downloadt de app in de plaats een HTML-bestand dat je zelf opent; het printvenster start dan automatisch — kies daar "Opslaan als PDF".
      </div>

      {/* dit on-scherm voorbeeld toont enkel het hoofdpand (zie StepRapport hierboven — het blijft
          bewust een JSX-weergave van d zelf, los van buildReportData/buildMultiPandReportData) —
          de effectief gedownloade PDF is wél altijd volledig: die doorloopt bij meerdere panden
          buildMultiPandReportData (zie handlePrintPdf/buildPrintHtml hierboven) en bevat dan élk
          pand plus de portefeuille-samenvatting met totaalsom. Deze melding voorkomt dat een
          schatter-expert dit onvolledige scherm per ongeluk voor het volledige verslag aanziet. */}
      {d.extraPanden && d.extraPanden.length > 0 && (
        <div className="no-print flex items-start gap-2 text-xs mb-4 px-3 py-2.5 rounded-lg" style={{ background: BRASS_SOFT, color: INK, border: `1px solid ${BRASS}` }}>
          <AlertTriangle size={14} style={{ color: BRASS, flexShrink: 0, marginTop: 1 }} />
          <span>Dit dossier bevat {d.extraPanden.length + 1} panden. Dit voorbeeld hieronder toont enkel het hoofdpand — de gedownloade PDF bevat wel elk pand afzonderlijk, plus een samenvattende tabel met de totale waarde van het hele dossier (zie tabblad "Panden").</span>
        </div>
      )}

      <div ref={reportRef}>
      {/* voorblad — telt niet mee in de paginanummering (geen paginanummer, geen deel van "van X") */}
      <Page n={1} total={totalPages} noFooter huisstijl={huisstijl}>
        <div className="flex flex-col items-center justify-center text-center" style={{ height: "100%" }}>
          {hs.logo && <img src={hs.logo} alt={hs.naam} style={{ width: 64, height: 64, objectFit: "contain", marginBottom: 14 }} />}
          <div className="mb-8" style={{ fontSize: 15, color: hs.kleur, letterSpacing: 2, fontFamily: "system-ui" }}>{hs.naam.toUpperCase()}</div>
          {(d.voorpaginaFoto?.url || d.voorpaginaFoto?.base64) && (
            <img src={d.voorpaginaFoto.url || d.voorpaginaFoto.base64} alt="Voorpagina"
              style={{ width: 380, maxWidth: "80%", height: 260, objectFit: "cover", borderRadius: 6, border: `1px solid ${LINE}`, marginBottom: 26 }} />
          )}
          <div className="mb-3" style={{ fontSize: 15, color: INK_SOFT, letterSpacing: 1, fontFamily: "system-ui", textTransform: "uppercase" }}>Taxatieverslag</div>
          <h1 style={{ fontSize: 40, fontWeight: 500, marginBottom: 18 }}>{adres}</h1>
          <div style={{ fontSize: 17, color: INK_SOFT, fontFamily: "system-ui" }}>
            {d.opdrachtgeverNaam && <>Opgemaakt voor {d.opdrachtgeverNaam} · </>}reden: {d.reden.toLowerCase()}
          </div>
          {d.datumVerslag && <div className="mt-1" style={{ fontSize: 17, color: INK_SOFT, fontFamily: "system-ui" }}>Datum verslag: {nlDate(d.datumVerslag)}</div>}
          {(d.schatterNaam || d.schatterTitel || d.schatterBivNummer || d.schatterVlabelNummer || d.schatterTelefoon) && (
            <div className="mt-10 pt-4" style={{ borderTop: `1px solid ${LINE}` }}>
              {d.schatterNaam && <div style={{ fontSize: 14 }}>{d.schatterNaam}</div>}
              {d.schatterTitel && <div style={{ fontSize: 12, color: INK_SOFT }}>{d.schatterTitel}</div>}
              {d.schatterBivNummer && <div style={{ fontSize: 11, color: INK_SOFT }}>BIV-nummer: {d.schatterBivNummer}</div>}
              {d.schatterVlabelNummer && <div style={{ fontSize: 11, color: INK_SOFT }}>Vlabel-identificatienummer: {d.schatterVlabelNummer}</div>}
              {d.schatterTelefoon && <div style={{ fontSize: 11, color: INK_SOFT }}>Tel.: {d.schatterTelefoon}</div>}
            </div>
          )}
        </div>
      </Page>

      {/* pagina 1: voorafgaande opmerkingen (voorblad telt niet mee in de paginanummering) */}
      <Page n={1} total={totalPages} huisstijl={huisstijl}>
        <h2 style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0.5, marginBottom: 14, fontFamily: "Georgia, serif" }}>VOORAFGAANDE OPMERKINGEN</h2>
        <ul className="text-sm" style={{ fontFamily: "Georgia, serif", color: INK_SOFT, lineHeight: 1.7 }}>
          {opmerkingen.map((o, i) => <li key={i} className="mb-2 pl-4" style={{ textIndent: "-1em" }}>• {o}</li>)}
        </ul>
      </Page>

      {/* pagina 2: inhoudstafel */}
      <Page n={2} total={totalPages} huisstijl={huisstijl}>
        <h2 style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0.5, marginBottom: 14, fontFamily: "Georgia, serif" }}>INHOUD</h2>
        <div style={{ fontFamily: "Georgia, serif" }}>
          {["Voorafgaande opmerkingen", "Inhoud"].map((t, i) => (
            <div key={t} className="flex justify-between text-sm py-1.5" style={{ borderBottom: `1px dotted ${LINE}` }}>
              <span>{t}</span><span className="font-mono" style={{ color: INK_SOFT }}>{i + 1}</span>
            </div>
          ))}
          {contentPageGroups.map((group, i) => group.map((p) => (
            <div key={p.title} className="flex justify-between text-sm py-1.5" style={{ borderBottom: `1px dotted ${LINE}` }}>
              <span>{p.title}</span><span className="font-mono" style={{ color: INK_SOFT }}>{FIXED_PAGES + i + 1}</span>
            </div>
          )))}
        </div>
      </Page>

      {/* inhoudspagina's */}
      {contentPageGroups.map((group, i) => (
        <Page key={group[0].title} n={FIXED_PAGES + i + 1} total={totalPages} huisstijl={huisstijl}>
          {group.map((p, gi) => (
            <div key={p.title} style={{ marginTop: gi > 0 ? 24 : 0 }}>
              <div className="mb-4" style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 500, color: INK }}>{p.title}</div>
              {p.body}
            </div>
          ))}
        </Page>
      ))}
      </div>
    </div>
    </HuisstijlContext.Provider>
  );
}
