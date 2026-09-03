// ----------------------------------------------------------------------------
// rapport/html.js — Word-veilige HTML-bouwstenen + de vaste "voorafgaande opmerkingen"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 8) zonder de logica/opmaak zelf te
// wijzigen. Word ondersteunt geen CSS flex/grid, dus deze generator gebruikt uitsluitend
// <table>-lay-out en inline stijlen, volledig los van de Tailwind-klassen die het scherm gebruikt
// — gebruikt door rapport/bouwers.js (PDF/Word-opbouw) hieronder.
import { isEmptyVal, wEsc } from "../lib/format.js";
import { veiligeAfbeeldingSrc } from "../lib/afbeeldingen.js";

// ---------- word-export: zelfstandige, Word-veilige HTML-generator ----------
export const wRow = (k, v) => (isEmptyVal(v) ? "" :
  `<tr><td style="padding:6px 16px 6px 0;color:#4B5160;font-size:14px;vertical-align:top;width:42%;">${wEsc(k)}</td><td style="padding:6px 0;font-size:14px;vertical-align:top;">${wEsc(v)}</td></tr>`);
export const wTable = (rows) => {
  const trs = rows.map(([k, v]) => wRow(k, v)).join("");
  return trs ? `<table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">${trs}</table>` : "";
};
export const wH = (text) => `<div style="font-size:13px;font-weight:600;color:#8C6A2F;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;margin:16px 0 8px 0;">${wEsc(text)}</div>`;
export const wPara = (label, value) => (isEmptyVal(value) ? "" :
  `<p style="font-size:14px;margin:0 0 10px 0;line-height:1.7;">${label ? `<strong>${wEsc(label)}: </strong>` : ""}${wEsc(value)}</p>`);
export const wSimpleTable = (headers, rows) => {
  if (!rows.length) return "";
  const thead = `<tr>${headers.map((h) => `<th style="text-align:left;padding:6px 10px 6px 0;font-size:12px;color:#4B5160;border-bottom:1px solid #DDD8CA;">${wEsc(h)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 10px 6px 0;font-size:14px;border-bottom:1px dotted #DDD8CA;">${wEsc(c)}</td>`).join("")}</tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">${thead}${tbody}</table>`;
};
export const wList = (title, items) => (!items.length ? "" :
  `<div style="margin:0 0 12px 0;"><strong style="font-size:14px;">${wEsc(title)}</strong><ul style="margin:6px 0 0 20px;padding:0;font-size:14px;line-height:1.7;">${items.map((i) => `<li style="margin-bottom:3px;">${wEsc(i)}</li>`).join("")}</ul></div>`);
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

// ---------- voorafgaande opmerkingen ----------
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

export function voorafgaandeOpmerkingen(d, totalPages) {
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
