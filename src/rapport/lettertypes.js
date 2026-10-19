// ----------------------------------------------------------------------------
// rapport/lettertypes.js — het lettertype van het verslag mee insluiten in de PDF
// ----------------------------------------------------------------------------
// De PDF-server (Chromium op Vercel) heeft zelf enkel Open Sans aan boord en mag niets van buiten
// ophalen. Daarom leest de app het lettertype van het verslag uit de eigen public/fonts/ en geeft
// het als @font-face met een ingesloten data-URL mee in de HTML (zie buildPrintHtml, opties.
// lettertypeCss). Ontbreekt het bestand (nog niet toegevoegd), dan blijft dit leeg en valt het
// verslag terug op Open Sans — er gaat niets mis.

export const RAPPORT_LETTERTYPE_URL = "/fonts/SchibstedGrotesk-VariableFont_wght.ttf";

// herkent een TrueType/OpenType-bestand aan de eerste 4 bytes — zo wordt bv. een HTML-foutpagina
// die toevallig met status 200 terugkomt nooit als lettertype ingesloten
export function isLettertypeBestand(bytes) {
  if (!bytes || bytes.length < 4) return false;
  const m = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  return m === "\u0000\u0001\u0000\u0000" || m === "OTTO" || m === "true";
}

// bytes (Uint8Array) -> @font-face-regel met data-URL, of "" als het geen lettertypebestand is
export function lettertypeCssUitBytes(bytes, familie = "Schibsted Grotesk") {
  if (!isLettertypeBestand(bytes)) return "";
  let binair = "";
  const stuk = 0x8000;
  for (let i = 0; i < bytes.length; i += stuk) binair += String.fromCharCode.apply(null, bytes.subarray(i, i + stuk));
  const b64 = typeof btoa === "function" ? btoa(binair) : Buffer.from(bytes).toString("base64");
  return `@font-face { font-family: '${familie}'; src: url(data:font/ttf;base64,${b64}) format('truetype'); font-weight: 400 900; font-style: normal; }`;
}

let gelukt = null; // enkel een geslaagde lading wordt onthouden — zo werkt een later toegevoegd bestand meteen
export async function laadRapportLettertypeCss() {
  if (gelukt) return gelukt;
  try {
    const antwoord = await fetch(RAPPORT_LETTERTYPE_URL);
    if (!antwoord.ok) return "";
    const css = lettertypeCssUitBytes(new Uint8Array(await antwoord.arrayBuffer()));
    if (css) gelukt = css;
    return css;
  } catch (e) {
    return "";
  }
}
