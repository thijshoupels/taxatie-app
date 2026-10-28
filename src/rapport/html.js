// ----------------------------------------------------------------------------
// rapport/html.js — Word-veilige HTML-bouwstenen + de vaste "voorafgaande opmerkingen"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 8) zonder de logica/opmaak zelf te
// wijzigen. Word ondersteunt geen CSS flex/grid, dus deze generator gebruikt uitsluitend
// <table>-lay-out en inline stijlen, volledig los van de Tailwind-klassen die het scherm gebruikt
// — gebruikt door rapport/bouwers.js (PDF/Word-opbouw) hieronder.
import { isEmptyVal, wEsc, eur, nlDate } from "../lib/format.js";
import { veiligeAfbeeldingSrc } from "../lib/afbeeldingen.js";
import { STAMP, STAMP_SOFT } from "../constants.js";

// ---------- letter en kleuren van het verslag ----------
// Eén schreefloze letter voor het hele verslag. De PDF-server (Chromium op Vercel) kent enkel
// Open Sans: Georgia en Arial bestaan daar niet en vielen dus stil terug. "Schibsted Grotesk"
// wordt mee in de PDF ingesloten zodra public/fonts/ het bestand bevat (zie rapport/lettertypes.js);
// anders wordt het Open Sans op de server en het systeemlettertype in het voorbeeld.
export const RAPPORT_LETTER = "'Schibsted Grotesk','Open Sans',Arial,Helvetica,sans-serif";
export const RAPPORT_INKT = "#1B1F27";
export const RAPPORT_GRIJS = "#4B5160";
export const RAPPORT_LIJN = "#DDD8CA";
// een kantoorkleur komt uit de kantoorinstellingen (vrij invulveld) en belandt in een style-
// attribuut: enkel een geldige hexkleur wordt doorgelaten, anders de standaard Houpels-kleur
export const veiligeKleur = (k) => (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(String(k || "")) ? k : "#8C6A2F");

// ---------- word-export: zelfstandige, Word-veilige HTML-generator ----------
export const wRow = (k, v) => (isEmptyVal(v) ? "" :
  `<tr><td style="padding:6px 16px 6px 0;color:#4B5160;font-size:14px;vertical-align:top;width:42%;">${wEsc(k)}</td><td style="padding:6px 0;font-size:14px;vertical-align:top;">${wEsc(v)}</td></tr>`);
export const wTable = (rows) => {
  const trs = rows.map(([k, v]) => wRow(k, v)).join("");
  return trs ? `<table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">${trs}</table>` : "";
};
// tussenkop binnen een sectie: kapitalen in de huisstijlkleur, met een dunne lijn eronder
export const wKop = (text, kleur) => `<div style="font-size:11.5px;font-weight:700;color:${veiligeKleur(kleur)};text-transform:uppercase;letter-spacing:0.8px;font-family:${RAPPORT_LETTER};margin:20px 0 8px 0;padding-bottom:5px;border-bottom:1px solid #E6E2D8;">${wEsc(text)}</div>`;
export const wH = (text) => wKop(text, "#8C6A2F");
// white-space:pre-line hieronder: een schatter-expert typt in zo'n vrije-tekstveld (bv. "Ligging in
// de omgeving" of "Omschrijving indeling & functionaliteit") vaak met eigen witregels/nieuwe
// zinnen als impliciete structuur — zonder deze eigenschap negeert HTML die newlines gewoon en
// smelt alles samen tot één ononderbroken lopende tekst in het verslag, ook al stond het in het
// invoerveld overzichtelijk in aparte zinnen/alinea's. pre-line behoudt precies die regeleinden
// (en vouwt overtollige spaties samen, net als gewone HTML), zonder dat de invoervelden zelf
// hoeven te veranderen. Betreft enkel de PDF-weergave; dit bestand wordt niet voor een Word-export
// gebruikt (zie de bestandskop hierboven).
export const wPara = (label, value) => (isEmptyVal(value) ? "" :
  `<p style="font-size:14px;margin:0 0 10px 0;line-height:1.7;white-space:pre-line;">${label ? `<strong>${wEsc(label)}: </strong>` : ""}${wEsc(value)}</p>`);
export const wSimpleTable = (headers, rows) => {
  if (!rows.length) return "";
  const thead = `<tr>${headers.map((h) => `<th style="text-align:left;padding:6px 10px 6px 0;font-size:12px;color:#4B5160;border-bottom:1px solid #DDD8CA;">${wEsc(h)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 10px 6px 0;font-size:14px;border-bottom:1px dotted #DDD8CA;">${wEsc(c)}</td>`).join("")}</tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">${thead}${tbody}</table>`;
};
export const wList = (title, items) => (!items.length ? "" :
  `<div style="margin:0 0 12px 0;"><strong style="font-size:14px;">${wEsc(title)}</strong><ul style="margin:6px 0 0 20px;padding:0;font-size:14px;line-height:1.7;">${items.map((i) => `<li style="margin-bottom:3px;">${wEsc(i)}</li>`).join("")}</ul></div>`);
// Tabel met per rij een label links en een korte opsomming (bullets) rechts — gebruikt voor
// "Ligging in de omgeving" (zie domein/ligging.js/liggingRubrieken): overzichtelijker dan de
// vroegere lopende alinea per rubriek. rijen = [[label, punten[]], ...]; rijen zonder punten
// vallen weg, en zonder enige rij geeft dit een lege string (dus geen lege tabel in het verslag).
// Labelkolom 42% breed, net als wTable hierboven: zo lijnen de waarden in dezelfde sectie uit.
export const wOpsommingTabel = (rijen) => {
  const trs = rijen.filter(([, punten]) => punten && punten.length).map(([label, punten]) =>
    `<tr><td style="padding:8px 16px 8px 0;color:#4B5160;font-size:14px;vertical-align:top;width:42%;border-bottom:1px dotted #DDD8CA;">${wEsc(label)}</td>` +
    `<td style="padding:8px 0;font-size:14px;vertical-align:top;border-bottom:1px dotted #DDD8CA;"><ul style="margin:0;padding:0 0 0 18px;line-height:1.55;">` +
    punten.map((p) => `<li style="margin:0 0 3px 0;">${wEsc(p)}</li>`).join("") +
    `</ul></td></tr>`).join("");
  return trs ? `<table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">${trs}</table>` : "";
};
// legt de opgeladen foto's als echte, ingesloten afbeeldingen (data-URL) vast — tijdelijke
// bestandslinks (blob-url) zijn buiten deze pagina/dit document niet geldig, een data-URL wel.
// Telkens 6 foto's (3 kolommen × 2 rijen) samen op een eigen, nette bijlagepagina.
export const chunkArray = (arr, size) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; };
export const wPhotoPage = (fotos) => {
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

// classificeert een opgeladen document (zie StepDocumenten) naar een leesbare "soort"-kolom in de
// bijlagenlijst van het verslag — gebruikt door zowel het gewone (één pand) als het gebundelde
// (meerdere panden) bijlagenblok in bouwers.js, zodat beide exact dezelfde indeling tonen.
export const documentSoort = (doc) => {
  const t = String(doc.type || "");
  return /pdf/i.test(t) ? "PDF" : /^image\//i.test(t) ? "Afbeelding" : /text/i.test(t) ? "Tekst" : (t.split("/").pop() || "—");
};

// ---------- cijfertabel (waardering) ----------
// rijen = [[label, waarde, nadruk?], ...] — bedragen rechts uitgelijnd met gelijke cijferbreedte,
// zodat ze netjes onder elkaar staan; een rij met nadruk (bv. "Intrinsieke waarde", "Prijsvork")
// staat vet en krijgt een iets donkerdere lijn erboven. Lege waarden vallen weg, net als in wTable.
export const wCijferTabel = (rijen) => {
  // de eerste rij krijgt geen lijn erboven: daar staat al de lijn onder de tussenkop (wKop)
  const trs = rijen.filter(([, v]) => !isEmptyVal(v)).map(([k, v, nadruk], i) => {
    const lijn = i === 0 ? "none" : `1px solid ${nadruk ? "#CFC9BC" : "#ECE8DF"}`;
    return `<tr><td style="padding:6px 16px 6px 0;font-size:13.5px;vertical-align:top;border-top:${lijn};color:${nadruk ? RAPPORT_INKT : RAPPORT_GRIJS};${nadruk ? "font-weight:700;" : ""}">${wEsc(k)}</td>` +
      `<td style="padding:6px 0;font-size:13.5px;vertical-align:top;text-align:right;border-top:${lijn};font-variant-numeric:tabular-nums;color:${RAPPORT_INKT};${nadruk ? "font-weight:700;" : ""}">${wEsc(v)}</td></tr>`;
  }).join("");
  return trs ? `<table style="width:100%;border-collapse:collapse;margin:0 0 14px 0;font-family:${RAPPORT_LETTER};">${trs}</table>` : "";
};

// posities (in %) van minimum, maximum en waarde op een balk die iets breder loopt dan de vork,
// zodat ook een waarde net op de rand nog zichtbaar blijft — zelfde schaal als de balk in de app
// (stappen/StepWaardering.jsx)
export const vorkPosities = (minimum, maximum, waarde) => {
  const marge = (maximum - minimum) * 0.25;
  const van = Math.min(minimum, waarde || minimum) - marge;
  const tot = Math.max(maximum, waarde || maximum) + marge;
  const pos = (x) => Math.round(((x - van) / (tot - van)) * 1000) / 10;
  return { min: pos(minimum), max: pos(maximum), waarde: pos(waarde) };
};

// ---------- conclusiekader venale waarde ----------
// Het eindresultaat van de waardering: de venale waarde groot, met eronder de prijsvork als balk
// (gevuld stuk = minimum tot maximum, streepje = de venale waarde). Zonder prijsvork blijft enkel
// de waarde staan. Blijft altijd samen op één pagina (break-inside: avoid).
export function wWaardeConclusie({ label = "Venale waarde", waarde, onderschrift = "", prijsvork = null, prijsvorkLabel = "Prijsvork" }) {
  const metVork = prijsvork && prijsvork.maximum > prijsvork.minimum;
  const p = metVork ? vorkPosities(prijsvork.minimum, prijsvork.maximum, waarde) : null;
  return `<div style="break-inside:avoid;page-break-inside:avoid;margin:14px 0 10px 0;border:1px solid #CFDAD5;border-top:3px solid ${STAMP};background:#F7FAF9;padding:16px 20px 14px 20px;font-family:${RAPPORT_LETTER};">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="vertical-align:bottom;padding:0;">
        <div style="font-size:11.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${STAMP};">${wEsc(label)}</div>
        ${onderschrift ? `<div style="font-size:11px;color:${RAPPORT_GRIJS};margin-top:3px;">${wEsc(onderschrift)}</div>` : ""}
      </td>
      <td style="vertical-align:bottom;text-align:right;padding:0;font-size:28px;line-height:1.1;font-weight:700;color:${STAMP};font-variant-numeric:tabular-nums;white-space:nowrap;">${wEsc(eur(waarde))}</td>
    </tr></table>
    ${metVork ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #DCE5E1;">
      <table style="width:100%;border-collapse:collapse;"><tr>
        <td style="padding:0;font-size:10.5px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${RAPPORT_GRIJS};">${wEsc(prijsvorkLabel)}</td>
        <td style="padding:0;text-align:right;font-size:13px;font-weight:600;color:${RAPPORT_INKT};font-variant-numeric:tabular-nums;white-space:nowrap;">${wEsc(eur(prijsvork.minimum))} – ${wEsc(eur(prijsvork.maximum))}</td>
      </tr></table>
      <div style="position:relative;height:6px;margin:14px 0 6px 0;background:${STAMP_SOFT};border-radius:3px;">
        <div style="position:absolute;top:0;bottom:0;left:${p.min}%;width:${Math.max(0, p.max - p.min)}%;background:${STAMP};border-radius:3px;"></div>
        ${waarde > 0 ? `<div style="position:absolute;top:-5px;left:${p.waarde}%;width:2px;height:16px;margin-left:-1px;background:${RAPPORT_INKT};"></div>` : ""}
      </div>
      <div style="position:relative;height:14px;font-size:10px;color:${RAPPORT_GRIJS};font-variant-numeric:tabular-nums;">
        <span style="position:absolute;left:${p.min}%;transform:translateX(-50%);white-space:nowrap;">min.</span>
        <span style="position:absolute;left:${p.max}%;transform:translateX(-50%);white-space:nowrap;">max.</span>
      </div>
    </div>` : ""}
  </div>`;
}

// ---------- prijstabel (loten) ----------
// pt = bouwPrijstabel(...) uit domein/prijstabel.js — zelfde tabel als op het tabblad Waardering:
// per lot verdieping, gewogen oppervlakte, slaapkamers, terras/tuin, venale waarde, €/m² en
// prijsvork, met het totaal onderaan
export function wPrijstabel(pt) {
  if (!pt || !pt.rijen.length) return "";
  const m2 = (v) => (v > 0 ? `${String(Math.round(v * 10) / 10).replace(".", ",")} m²` : "—");
  const th = (t, rechts) => `<th style="text-align:${rechts ? "right" : "left"};padding:6px 6px 6px 0;font-size:9.5px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${RAPPORT_GRIJS};border-bottom:1px solid ${RAPPORT_INKT};white-space:nowrap;">${t}</th>`;
  const td = (t, { rechts = false, vet = false, grijs = false } = {}) =>
    `<td style="padding:7px 6px 7px 0;font-size:11.5px;vertical-align:top;border-bottom:1px solid #ECE8DF;${rechts ? "text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;" : ""}${vet ? "font-weight:700;" : ""}color:${grijs ? RAPPORT_GRIJS : RAPPORT_INKT};">${t}</td>`;
  const rijen = pt.rijen.map((r) => `<tr>` +
    td(`<strong>${wEsc(r.lot)}</strong>${[r.adres, pt.gemengd ? r.type : ""].filter(Boolean).map((t) => `<br><span style="font-size:10px;color:${RAPPORT_GRIJS};">${wEsc(t)}</span>`).join("")}`) +
    td(wEsc(r.verdieping || "—"), { grijs: !r.verdieping }) +
    td(m2(r.gewogenOpp), { rechts: true }) +
    td(r.slaapkamers ? String(r.slaapkamers) : "—", { rechts: true }) +
    td(m2(r.buitenOpp), { rechts: true }) +
    td(wEsc(eur(r.venaleWaarde)), { rechts: true, vet: true }) +
    td(r.perM2 ? wEsc(eur(r.perM2)) : "—", { rechts: true, grijs: true }) +
    td(r.prijsvork ? `${wEsc(eur(r.prijsvork.minimum))} – ${wEsc(eur(r.prijsvork.maximum))}` : "—", { rechts: true, grijs: true }) +
    `</tr>`).join("");
  const parkeer = pt.parkeerTotaal > 0
    ? `<tr><td colspan="5" style="padding:7px 6px 7px 0;font-size:11.5px;border-bottom:1px solid #ECE8DF;">Parkeerplaatsen &amp; garages</td>${td(wEsc(eur(pt.parkeerTotaal)), { rechts: true, vet: true })}<td style="border-bottom:1px solid #ECE8DF;"></td><td style="border-bottom:1px solid #ECE8DF;"></td></tr>` : "";
  const tv = pt.totaleVork;
  const voet = `<tr>
    <td colspan="2" style="padding:9px 6px 4px 0;font-size:12px;font-weight:700;border-top:1px solid ${RAPPORT_INKT};">Totaal (${pt.rijen.length} ${pt.rijen.length === 1 ? "lot" : "loten"})</td>
    <td style="padding:9px 6px 4px 0;font-size:12px;font-weight:700;text-align:right;white-space:nowrap;border-top:1px solid ${RAPPORT_INKT};font-variant-numeric:tabular-nums;">${m2(pt.totaalOpp)}</td>
    <td colspan="2" style="border-top:1px solid ${RAPPORT_INKT};"></td>
    <td style="padding:9px 6px 4px 0;font-size:12px;font-weight:700;text-align:right;white-space:nowrap;border-top:1px solid ${RAPPORT_INKT};color:${STAMP};font-variant-numeric:tabular-nums;">${wEsc(eur(pt.totaal))}</td>
    <td style="border-top:1px solid ${RAPPORT_INKT};"></td>
    <td style="padding:9px 0 4px 0;font-size:12px;font-weight:700;text-align:right;white-space:nowrap;border-top:1px solid ${RAPPORT_INKT};font-variant-numeric:tabular-nums;">${tv && (tv.minimum || tv.maximum) ? `${wEsc(eur(tv.minimum))} – ${wEsc(eur(tv.maximum))}` : "—"}</td>
  </tr>`;
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 14px 0;font-family:${RAPPORT_LETTER};">
    <thead><tr>${th("Lot")}${th("Verdieping")}${th("Gewogen opp.", true)}${th("Slpk.", true)}${th("Terras/tuin", true)}${th("Venale waarde", true)}${th("€/m²", true)}${th("Prijsvork", true)}</tr></thead>
    <tbody>${rijen}${parkeer}</tbody>
    <tfoot>${voet}</tfoot>
  </table>`;
}

// ---------- voorblad ----------
// Links uitgelijnd: kantoornaam bovenaan, de voorpaginafoto over de volle breedte, het soort
// verslag + de reden in de huisstijlkleur, het adres groot, een rij kerngegevens en onderaan de
// schatter-expert. Werkt ook zonder foto, logo of kerngegevens. "fotoSrc" mag een data-URL of een
// link naar de eigen opslag zijn (zie veiligeAfbeeldingSrc) — al het andere wordt weggelaten.
export function wVoorblad({ hs, d, soort = "Taxatieverslag", titel, subtitel = "", fotoSrc = "" }) {
  const kleur = veiligeKleur(hs.kleur);
  const foto = fotoSrc ? veiligeAfbeeldingSrc(fotoSrc) : "";
  const logo = hs.logo ? veiligeAfbeeldingSrc(hs.logo) : "";
  const label = [soort, d.reden].filter(Boolean).join(" · ");
  const feiten = [
    ["Opdrachtgever", d.opdrachtgeverNaam],
    ["Referentiedatum", d.referentiedatum ? nlDate(d.referentiedatum) : ""],
    ["Datum verslag", d.datumVerslag ? nlDate(d.datumVerslag) : ""],
  ].filter(([, v]) => !isEmptyVal(v));
  const kenmerken = [
    d.schatterBivNummer ? `BIV-nummer ${wEsc(d.schatterBivNummer)}` : "",
    d.schatterVlabelNummer ? `Vlabel-identificatienummer ${wEsc(d.schatterVlabelNummer)}` : "",
    d.schatterTelefoon ? `Tel. ${wEsc(d.schatterTelefoon)}` : "",
  ].filter(Boolean);
  const metSchatter = d.schatterNaam || d.schatterTitel || kenmerken.length;
  // vennootschap, adres en KBO-nummer van het kantoor (zie HUISSTIJLEN in constants.js)
  const firma = [hs.juridischeNaam && hs.juridischeNaam !== hs.naam ? hs.juridischeNaam : "", hs.adres || "", hs.kbo ? `KBO ${hs.kbo}` : ""].filter(Boolean);
  return `<div style="font-family:${RAPPORT_LETTER};color:${RAPPORT_INKT};">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="padding:0;vertical-align:middle;">
        ${logo ? `<img src="${logo}" alt="" style="height:34px;width:auto;max-width:120px;object-fit:contain;vertical-align:middle;margin-right:12px;" />` : ""}
        <span style="font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${kleur};vertical-align:middle;">${wEsc(hs.naam)}</span>
        ${firma.length ? `<div style="font-size:10px;color:${RAPPORT_GRIJS};margin-top:5px;letter-spacing:0.2px;">${firma.map(wEsc).join(" &nbsp;·&nbsp; ")}</div>` : ""}
      </td>
    </tr></table>
    <div style="height:3px;width:30mm;background:${kleur};margin:12px 0 0 0;"></div>
  </div>
  <div style="font-family:${RAPPORT_LETTER};color:${RAPPORT_INKT};">
    ${foto ? `<img src="${foto}" alt="" style="display:block;width:100%;height:96mm;object-fit:cover;margin:0 0 24px 0;" />` : ""}
    <div style="font-size:11.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${kleur};margin-bottom:10px;">${wEsc(label)}</div>
    <div style="font-size:36px;line-height:1.12;font-weight:700;letter-spacing:-0.5px;margin:0;">${wEsc(titel)}</div>
    ${subtitel ? `<div style="font-size:19px;color:${RAPPORT_GRIJS};margin-top:6px;">${wEsc(subtitel)}</div>` : ""}
    ${feiten.length ? `<table style="width:100%;border-collapse:collapse;margin-top:26px;border-top:1px solid ${RAPPORT_INKT};"><tr>
      ${feiten.map(([k, v]) => `<td style="padding:10px 14px 0 0;vertical-align:top;width:${Math.floor(100 / feiten.length)}%;">
        <div style="font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${RAPPORT_GRIJS};">${wEsc(k)}</div>
        <div style="font-size:14px;font-weight:600;margin-top:3px;">${wEsc(v)}</div>
      </td>`).join("")}
    </tr></table>` : ""}
  </div>
  <div style="font-family:${RAPPORT_LETTER};color:${RAPPORT_INKT};">
    ${metSchatter ? `<div style="border-top:1px solid ${RAPPORT_LIJN};padding-top:14px;">
      <div style="font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${RAPPORT_GRIJS};margin-bottom:4px;">Schatter-expert</div>
      ${d.schatterNaam ? `<div style="font-size:15px;font-weight:700;">${wEsc(d.schatterNaam)}</div>` : ""}
      ${d.schatterTitel ? `<div style="font-size:12px;color:${RAPPORT_GRIJS};margin-top:1px;">${wEsc(d.schatterTitel)}</div>` : ""}
      ${kenmerken.length ? `<div style="font-size:11px;color:${RAPPORT_GRIJS};margin-top:6px;">${kenmerken.join(" &nbsp;·&nbsp; ")}</div>` : ""}
    </div>` : ""}
  </div>`;
}

// ---------- voorafgaande opmerkingen ----------
const NL_NUM = ["nul", "een", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien",
  "elf", "twaalf", "dertien", "veertien", "vijftien", "zestien", "zeventien", "achttien", "negentien", "twintig",
  "eenentwintig", "tweeëntwintig", "drieëntwintig", "vierentwintig", "vijfentwintig", "zesentwintig", "zevenentwintig", "achtentwintig", "negenentwintig", "dertig"];
const nlNumber = (n) => NL_NUM[n] || String(n);
// "vijftien (15)" — het aantal bladzijden in de voorafgaande opmerkingen. In de PDF staat het in een
// <span data-paginatotaal>, zodat /api/generate-pdf het na de meetronde vervangt door het écht
// gerenderde aantal (een sectie die over twee pagina's loopt telt in de schatting maar één keer).
export const paginaTotaalTekst = (n) => `${nlNumber(n)} (${n})`;

const REDEN_ZINSNEDE = {
  "Nalatenschap": "de aangifte van nalatenschap",
  "Verkoop": "een verkoop",
  "Boekhoudkundige waardering": "boekhoudkundige doeleinden (o.a. jaarrekening, herwaardering van vaste activa)",
  "Hypothecair krediet": "een hypothecair krediet",
  "Echtscheiding": "een echtscheiding",
  "Gerechtelijk": "een gerechtelijke procedure",
  "Andere": "de opgegeven reden",
};

const ECHT_ANDERE_PARTIJ_ZIN = {
  "Aanwezig bij het plaatsbezoek": "De andere partij was aanwezig bij het plaatsbezoek.",
  "Op de hoogte, niet aanwezig": "De andere partij was op de hoogte van het plaatsbezoek, maar was niet aanwezig.",
  "Niet op de hoogte gebracht": "De andere partij werd niet op de hoogte gebracht van het plaatsbezoek; dit verslag werd eenzijdig opgemaakt in opdracht van de opdrachtgever.",
  Onbekend: "Het is de schatter-expert niet bekend of de andere partij op de hoogte was van het plaatsbezoek.",
};
export function voorafgaandeOpmerkingen(d, totalPages) {
  return [
    // letterlijke, door Vlabel voorgeschreven formulering (kwaliteitseisen schattingsverslagen,
    // punt 2.1.d) — bij "Nalatenschap" moet deze zin exact zo voorkomen; voor elke andere reden
    // van waardering wordt enkel het slot aangepast aan die reden.
    `Dit schattingsverslag is opgemaakt met naleving van de kwaliteitseisen voor schatters-experten, om te dienen als waardering bij ${REDEN_ZINSNEDE[d.reden] || "de opgegeven reden"}.`,
    // gebruik "Onbekend": geen uitspraak doen i.p.v. stilzwijgend "in gebruik" te vermelden
    d.gebruik === "Onbekend"
      ? "Het gebruik van het eigendom ten tijde van onderhavig onderzoek kon niet worden vastgesteld."
      : `Ten tijde van onderhavig onderzoek was het eigendom ${d.gebruik === "Leegstaand" ? "niet in gebruik (leegstaand)" : "in gebruik"}.`,
    `Het verslag bestaat uit ${nlNumber(totalPages)} (${totalPages}) bladzijden.`,
    `De schatter-expert verklaart dat het taxatieverslag is opgemaakt ${d.opdrachtgeverAanwezig === "Nee" ? "buiten aanwezigheid van de OPDRACHTGEVER" : "in aanwezigheid van de OPDRACHTGEVER"}.`,
    // echtscheiding: de positie van de andere partij hoort bij de voorwaarden van het onderzoek
    ...(d.reden === "Echtscheiding" && ECHT_ANDERE_PARTIJ_ZIN[d.echtAnderePartij] ? [ECHT_ANDERE_PARTIJ_ZIN[d.echtAnderePartij]] : []),
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
