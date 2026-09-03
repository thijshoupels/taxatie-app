// ----------------------------------------------------------------------------
// kaarten.jsx — de liggingskaart (Google Static Maps) + de CadGIS/kadasterkaart
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 6) zonder de logica zelf te wijzigen:
// gedeeld door zowel de wizard-invoerstap (StepOpdracht) als de verslag-opbouw/voorvertoning
// (buildPandSections/StepRapport), zodat beide altijd exact dezelfde kaarten tonen.
// "import React" hieronder stond in App.jsx niet apart bij deze code (het gold daar al voor het
// hele bestand) — hier wél expliciet toegevoegd zodat de JSX in CadgisKaart hieronder correct blijft
// werken ongeacht de JSX-transform-instelling van het build-systeem.
import React from "react";

// Google Maps Static API-sleutel — sinds Google geen sleutelloze toegang meer toelaat, MOET deze
// ingesteld zijn (Vercel: Settings → Environment Variables → VITE_GOOGLE_MAPS_API_KEY, lokaal: in
// .env) anders blijft de liggingskaart (zowel in de wizard als in het verslag) leeg. Zie de
// meegeleverde instructies voor hoe je zo'n sleutel gratis aanmaakt.
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
// bouwt een statische kaartafbeelding (Google Static Maps) rond het opgegeven adres — gedeeld
// door zowel de wizard-voorvertoning (StepOpdracht) als het verslag zelf (buildReportData/
// StepRapport), zodat beide altijd exact dezelfde kaart tonen.
export const buildStaticMapUrl = (adres, { width = 640, height = 300, scale = 2, zoom = 16 } = {}) =>
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
export async function fetchCadgisPerceel(capakey) {
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
export function fixBboxAspect(bbox, width, height) {
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
export const buildCadgisMapUrl = (bbox, { width = 640, height = 300 } = {}) =>
  `https://geo.api.vlaanderen.be/Adpf/wms?service=WMS&version=1.3.0&request=GetMap&layers=Adpf,GrAdpf,LblAdpf&styles=,,&bbox=${encodeURIComponent(fixBboxAspect(bbox, width, height))}&width=${width}&height=${height}&crs=EPSG:31370&format=image/png&transparent=false`;

// zet één ring (lijst [x,y]-punten in EPSG:31370) om naar SVG-polygoonpunten in beeldpixels, op
// basis van dezelfde (aspect-gecorrigeerde) bbox als de WMS-afbeelding zelf — anders zou de
// markering niet exact boven het perceel op de afbeelding vallen. Y wordt gespiegeld: een bbox telt
// van onder (ymin) naar boven (ymax), een afbeelding van boven (0) naar onder (height).
export const bboxNaarPixelPunten = (ring, fixedBbox, width, height) => {
  const [xmin, ymin, xmax, ymax] = fixedBbox.split(",").map(Number);
  return ring.map(([x, y]) => {
    const px = ((x - xmin) / (xmax - xmin)) * width;
    const py = height - ((y - ymin) / (ymax - ymin)) * height;
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  }).join(" ");
};
// gedeelde markeringskleur/-stijl voor het gemarkeerde perceel, gebruikt door zowel CadgisKaart
// (React, hieronder) als buildCadgisKaartHtml (print/PDF, zie buildReportData)
export const cadgisMarkeringSvg = (ringen, fixedBbox, width, height) =>
  (ringen || []).map((ring) =>
    `<polygon points="${bboxNaarPixelPunten(ring, fixedBbox, width, height)}" fill="#8C6A2F" fill-opacity="0.32" stroke="#8C6A2F" stroke-width="3" />`
  ).join("");
// React-component: kale WMS-kaart + het opgezochte perceel zelf gemarkeerd erbovenop (zie
// toelichting hierboven) — gedeeld door StepOpdracht (invoerstap) en StepRapport (voorvertoning).
export function CadgisKaart({ bbox, ringen, width = 640, height = 300, style }) {
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
export function buildCadgisKaartHtml(bbox, ringen, { width = 640, height = 300 } = {}) {
  if (!bbox) return "";
  const fixedBbox = fixBboxAspect(bbox, width, height);
  const markering = ringen?.length ? cadgisMarkeringSvg(ringen, fixedBbox, width, height) : "";
  return `<div style="position:relative;width:100%;max-width:520px;display:block;border:1px solid #DDD8CA;border-radius:4px;overflow:hidden;margin:0 0 16px 0;">
    <img src="${buildCadgisMapUrl(bbox, { width, height })}" alt="Kadasterkaart" style="width:100%;display:block;" />
    ${markering ? `<svg viewBox="0 0 ${width} ${height}" style="position:absolute;top:0;left:0;width:100%;height:100%;">${markering}</svg>` : ""}
  </div>`;
}
