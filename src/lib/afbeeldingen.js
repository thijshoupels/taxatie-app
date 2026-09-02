// ============================================================================
// AFBEELDINGSHELPERS
// ============================================================================
// Verkleinen/valideren van foto's en het veilig valideren van afbeeldingsbronnen (data:-URI's of
// links naar de eigen Supabase-opslag) vóór ze in het gerenderde verslag terechtkomen.
// Verplaatst uit App.jsx (zie audit, punt "App.jsx opsplitsen").
// ============================================================================
import { wEsc } from "./format.js";

const isJpegFile = (f) => {
  const naam = (f.name || "").toLowerCase();
  return f.type === "image/jpeg" || naam.endsWith(".jpg") || naam.endsWith(".jpeg");
};
// verkleint een afbeelding (via canvas) tot een maximale breedte/hoogte — een rapportfoto heeft geen
// volledige cameraresolutie (vaak 12+ megapixel) nodig; dit maakt zowel de verwerking als het
// uiteindelijke rapportbestand aanzienlijk kleiner en sneller.
function resizeImageBlob(blob, maxDim = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const schaal = maxDim / Math.max(width, height);
        width = Math.round(width * schaal);
        height = Math.round(height * schaal);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((resized) => resized ? resolve(resized) : reject(new Error("Kon afbeelding niet verkleinen")), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kon afbeelding niet laden voor verkleining")); };
    img.src = url;
  });
}

// Zelfde als resizeImageBlob hierboven, maar herhaalt het verkleinen met een lagere kwaliteit/
// afmeting zolang het resultaat nog boven "maxBytes" uitkomt — vooral bedoeld voor foto's van
// grondplannen (StepDocumenten), waar een ruimere startresolutie (2200px/85%) nodig is voor de
// leesbaarheid van kleine oppervlaktecijfers, maar een detailrijke foto van een moderne telefoon
// (12+ MP) daardoor als base64 alsnog een paar MB kan wegen. Zonder deze begrenzing komt zo'n
// document ongewijzigd in de "media"-kolom terecht, en kan het opslaan van het dossier op de
// server vastlopen ("canceling statement due to statement timeout") in plaats van gewoon iets
// minder scherp te worden. Geeft na een paar pogingen sowieso het laatst behaalde resultaat terug
// (nooit een fout), zodat de gebruiker nooit met een half toegevoegd document blijft zitten.
function resizeImageBlobBinnenBudget(blob, { maxDim = 2200, quality = 0.85, maxBytes = 1.5 * 1024 * 1024 } = {}) {
  const pogingen = [
    { maxDim, quality },
    { maxDim: Math.round(maxDim * 0.75), quality: Math.max(quality - 0.15, 0.5) },
    { maxDim: Math.round(maxDim * 0.55), quality: Math.max(quality - 0.3, 0.4) },
  ];
  const probeerVolgende = (i, beste) =>
    resizeImageBlob(blob, pogingen[i].maxDim, pogingen[i].quality).then((resized) => {
      const nieuwsteBeste = !beste || resized.size < beste.size ? resized : beste;
      if (nieuwsteBeste.size <= maxBytes || i >= pogingen.length - 1) return nieuwsteBeste;
      return probeerVolgende(i + 1, nieuwsteBeste);
    });
  return probeerVolgende(0, null);
}

// Ruwe schatting (geen exacte byte-telling, maar ruim voldoende nauwkeurig als richtwaarde) van
// hoeveel opslagruimte de foto's/documenten van één pand innemen als base64 — samen met de
// tekstvelden is dit precies wat bij élke opslagbeurt in zijn geheel naar de server gestuurd wordt
// (zie media/data in _saveDossierPoging). Gebruikt om de gebruiker in StepDocumenten/StepFotos al
// vooraf te waarschuwen, in plaats van pas achteraf een "opslaan mislukt"-melding te tonen.
const schatBase64Bytes = (s) => {
  if (!s) return 0;
  const payload = s.startsWith("data:") ? s.slice(s.indexOf(",") + 1) : s;
  return Math.ceil((payload.length * 3) / 4);
};
function berekenPandBijlageBytes(d) {
  let totaal = 0;
  (d.documenten || []).forEach((doc) => { totaal += schatBase64Bytes(doc.base64); });
  (d.fotos || []).forEach((f) => { totaal += schatBase64Bytes(f.base64); });
  if (d.voorpaginaFoto) totaal += schatBase64Bytes(d.voorpaginaFoto.base64);
  return totaal;
}
const fmtMB = (bytes) => (bytes / (1024 * 1024)).toFixed(1).replace(".", ",");

// Valideert dat een afbeeldingsbron effectief een data:image/...;base64,... URI is vóór ze
// ongeëscapet als HTML-attribuut in de server-gerenderde rapport-HTML terechtkomt (zie audit,
// punt M3): enkel de app zelf genereert deze URI's vandaag (opgeladen foto's, voorpaginafoto,
// handtekening), maar dit sluit uit dat een onverwachte/toekomstige waarde als vrije HTML in het
// document beland — en wEsc() erbovenop ontsnapt voor de zekerheid ook nog eventuele aanhalingstekens
// binnen de string zelf.
// Vlak vóór de PDF-export worden de foto's van een groot dossier tijdelijk naar Supabase Storage
// geladen en vervangen door een ondertekende https-link (zie handlePrintPdf — nodig om onder de
// 4,5MB-limiet van de printserver te blijven). Zulke links moeten hier dus óók door: liet je enkel
// data:-URI's toe, dan kreeg net het uitgebreide dossier een verslag ZONDER één enkele foto —
// met een lege src, zonder foutmelding, en dus zonder dat iemand het merkte.
const EIGEN_OPSLAG_ORIGIN = (() => {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL).origin; } catch (e) { return ""; }
})();
const veiligeAfbeeldingSrc = (bron) => {
  const v = String(bron ?? "");
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v)) return wEsc(v);
  // enkel links naar de eigen Supabase-opslag — nooit een willekeurig extern adres, zodat een
  // verslag onmogelijk inhoud van elders kan inladen
  if (EIGEN_OPSLAG_ORIGIN) {
    try { if (new URL(v).origin === EIGEN_OPSLAG_ORIGIN) return wEsc(v); } catch (e) { /* geen geldige URL */ }
  }
  return "";
};


export {
  isJpegFile, resizeImageBlob, resizeImageBlobBinnenBudget, schatBase64Bytes,
  berekenPandBijlageBytes, fmtMB, EIGEN_OPSLAG_ORIGIN, veiligeAfbeeldingSrc,
};
