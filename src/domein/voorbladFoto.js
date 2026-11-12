// ----------------------------------------------------------------------------
// domein/voorbladFoto.js — uitsnede van de foto op het voorblad
// ----------------------------------------------------------------------------
// De voorbladfoto staat in een vast kader over de volle breedte van de pagina (178 mm breed, 96 mm
// hoog in de PDF: A4 min de marges van 16 mm links en rechts, zie api/generate-pdf.js). De
// schatter-expert kiest zelf hoe de foto in dat kader komt (tabblad Foto's):
//
//   modus "bijsnijden" — de foto vult het kader; x/y (0-100 %) bepalen welk deel zichtbaar blijft
//                        (CSS object-position) en zoom (1-4) vergroot rond datzelfde punt;
//   modus "volledig"   — de hele foto staat in het kader, gecentreerd; de rest blijft wit.
//
// Zonder instelling (oudere dossiers): bijsnijden, gecentreerd, zonder zoom — exact het
// voorblad van vroeger. De uitsnede staat in d.voorpaginaUitsnede (dossierbreed, net als de foto
// zelf), los van de foto: een verschuiving hoeft zo niet telkens de zware foto mee op te slaan.
//
// Dezelfde stijl wordt gebruikt in de PDF/het voorbeeld (rapport/html.js, wVoorblad) én in het
// kader om bij te snijden (stappen/StepFotos.jsx) — wat je daar ziet, staat zo in het verslag.
// Pure functies — apart testbaar (zie __tests__/voorbladFoto.test.js).

export const KADER_BREEDTE_MM = 178;
export const KADER_HOOGTE_MM = 96;
export const ZOOM_MAX = 4;
export const UITSNEDE_STANDAARD = Object.freeze({ modus: "bijsnijden", x: 50, y: 50, zoom: 1 });

const begrens = (v, min, max, standaard) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : standaard;
};
const rond = (v, dec = 1) => Math.round(v * 10 ** dec) / 10 ** dec;

export function normaliseerUitsnede(u) {
  if (!u || typeof u !== "object") return { ...UITSNEDE_STANDAARD };
  return {
    modus: u.modus === "volledig" ? "volledig" : "bijsnijden",
    x: rond(begrens(u.x, 0, 100, 50)),
    y: rond(begrens(u.y, 0, 100, 50)),
    zoom: rond(begrens(u.zoom, 1, ZOOM_MAX, 1), 2),
  };
}

// Stijl van het kader en de foto erin. Het kader krijgt een vaste verhouding i.p.v. een vaste
// hoogte, zodat het bijsnijkader in de app en het voorbeeld exact dezelfde uitsnede tonen als de
// PDF (daar: 178 mm breed → 96 mm hoog, zoals vroeger). voorbladFotoStijl geeft React-stijlen
// (tabblad Foto's), voorbladFotoCss dezelfde stijl als tekst (verslag-HTML) — één bron.
export function voorbladFotoStijl(u) {
  const s = normaliseerUitsnede(u);
  const kader = { position: "relative", overflow: "hidden", width: "100%", aspectRatio: `${KADER_BREEDTE_MM}/${KADER_HOOGTE_MM}`, background: "#FFFFFF" };
  const basis = { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "block" };
  const foto = s.modus === "volledig"
    ? { ...basis, objectFit: "contain", objectPosition: "50% 50%" }
    : { ...basis, objectFit: "cover", objectPosition: `${s.x}% ${s.y}%`,
        ...(s.zoom > 1 ? { transform: `scale(${s.zoom})`, transformOrigin: `${s.x}% ${s.y}%` } : {}) };
  return { kader, foto };
}

const naarCss = (stijl) => Object.entries(stijl)
  .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${typeof v === "number" && v !== 0 ? v + "px" : v};`).join("");

export function voorbladFotoCss(u) {
  const { kader, foto } = voorbladFotoStijl(u);
  return { kader: naarCss(kader), foto: naarCss(foto) };
}

// Hoeveel verschuift de positie (in %-punten) als je de foto dx pixels versleept? Voor een foto
// die het kader vult, schaalt object-fit:cover de foto zo dat ze langs één as uitsteekt ("uitsteek",
// in px); de zoom (rond hetzelfde punt) voegt langs beide assen kader × (zoom − 1) toe. Slepen naar
// rechts toont meer van de linkerkant, dus de positie daalt. Geen uitsteek en geen zoom: niets te
// verschuiven langs die as (0).
export function verschuiving(dPx, kaderPx, fotoPx, kaderAndereAsPx, fotoAndereAsPx, zoom) {
  if (!(kaderPx > 0) || !(fotoPx > 0) || !(kaderAndereAsPx > 0) || !(fotoAndereAsPx > 0)) return 0;
  const schaal = Math.max(kaderPx / fotoPx, kaderAndereAsPx / fotoAndereAsPx);
  const uitsteek = fotoPx * schaal - kaderPx;
  const bereik = uitsteek * zoom + kaderPx * (zoom - 1);
  return bereik > 0.5 ? (-dPx / bereik) * 100 : 0;
}
