// ----------------------------------------------------------------------------
// domein/ligging.js — "Ligging in de omgeving" omzetten naar korte opsommingspunten
// ----------------------------------------------------------------------------
// De velden omgevingsvoorzieningen/bereikbaarheid/straatuitrusting (zie StepLigging) bevatten een
// mengeling van aangeklikte chips ("Scholen, Apotheek, ...") en vrije of door de AI opgezochte tekst,
// vroeger met komma's aan elkaar geplakt. In het verslag gaf dat één lange, onoverzichtelijke
// alinea per rubriek. Deze module haalt daar losse, korte punten uit — één bullet per
// voorziening/verbinding/zin — zodat het verslag enkel een beknopte opsomming toont.
// Pure functies (geen React/DOM): gedeeld door het PDF-verslag (rapport/bouwers.js) en de
// voorvertoning (rapport/StepRapport.jsx), en apart testbaar (zie __tests__/ligging.test.js).
import { OPTS } from "../constants.js";

// afkortingen waarna een punt GEEN zinseinde is ("ca. 2 km", "o.a. De Lijn", "bv. Colruyt")
const AFKORTINGEN = new Set([
  "ca", "bv", "bijv", "o.a", "nr", "st", "sint", "dr", "resp", "incl", "excl", "vnl", "m.a.w", "t.o.v",
  "i.p.v", "min", "max", "ong", "evt", "enz", "a.d", "d.w.z", "e.a", "z.g",
]);

const eindigtOpAfkorting = (stuk) => {
  const m = stuk.match(/([A-Za-zÀ-ÿ.]+)\.$/);
  return !!m && AFKORTINGEN.has(m[1].toLowerCase());
};

// splitst één stuk vrije tekst in zinnen: na ";" altijd, na "." / "!" / "?" enkel als er een
// hoofdletter volgt en het geen afkorting is. "1,2 km" (decimale komma) en "ca. 2 km" blijven heel.
function splitsInZinnen(tekst) {
  const zinnen = [];
  let start = 0;
  const re = /[.!?;]+\s+/g;
  let m;
  while ((m = re.exec(tekst))) {
    const eind = m.index + m[0].trimEnd().length;
    const stuk = tekst.slice(start, eind);
    const volgend = tekst.charAt(re.lastIndex);
    const isPuntkomma = m[0].includes(";");
    if (isPuntkomma || (/[A-ZÀ-Þ]/.test(volgend) && !eindigtOpAfkorting(stuk))) {
      zinnen.push(stuk);
      start = re.lastIndex;
    }
  }
  zinnen.push(tekst.slice(start));
  return zinnen;
}

// één opsommingspunt netjes maken: opsommingstekens vooraan weg, afsluitend leesteken weg (tenzij
// afkorting), eerste letter hoofdletter
function netPunt(p) {
  let s = p.replace(/^\s*(?:[-•*·–—]|\d+[.)])\s+/, "").replace(/\s+/g, " ").trim();
  s = s.replace(/[,;:]+$/, "").trim();
  if (/\.$/.test(s) && !eindigtOpAfkorting(s)) s = s.slice(0, -1).trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

// tekst -> opsommingspunten.
//  chips:       de keuzes uit OPTS die in dit veld als chip aangeklikt kunnen worden
//  chipsSamen:  alle herkende chips samen in één punt ("Winkels/handelszaken, scholen, apotheek")
//               i.p.v. elk apart — handig voor korte checklist-woorden (voorzieningen, nutsleidingen)
export function liggingPunten(tekst, { chips = [], chipsSamen = false } = {}) {
  if (tekst == null || !String(tekst).trim()) return [];
  const chipPerNaam = new Map(chips.map((c) => [c.toLowerCase(), c]));
  // een chip die zelf een komma bevat ("Rustige, verkeersluwe straat") mag niet door de
  // komma-splitsing hieronder in twee vallen
  const BESCHERMD = "\u0001";
  let s = String(tekst).replace(/\r/g, "");
  for (const c of chips) {
    if (!c.includes(",")) continue;
    const re = new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    s = s.replace(re, (x) => x.replace(/,/g, BESCHERMD));
  }
  const herstel = (x) => x.split(BESCHERMD).join(",");

  const gevondenChips = [];
  const vrijeStukken = [];
  for (const regel of s.split("\n")) {
    const schoon = regel.replace(/^\s*(?:[-•*·–—]|\d+[.)])\s+/, "").trim();
    if (!schoon) continue;
    // chips staan telkens als volledig, door ", " gescheiden stuk in de tekst (zie mergeText in
    // StepLigging) — enkel zo'n volledig stuk telt als chip, nooit een woord midden in een zin
    let buffer = [];
    const leegBuffer = () => { if (buffer.length) { vrijeStukken.push(buffer.join(", ")); buffer = []; } };
    for (const deel of schoon.split(/,\s+/)) {
      const kaal = herstel(deel).trim().replace(/[.;]+$/, "").trim();
      const chip = chipPerNaam.get(kaal.toLowerCase());
      if (chip) { leegBuffer(); gevondenChips.push(chip); } else buffer.push(herstel(deel));
    }
    leegBuffer();
  }

  const punten = [];
  const uniekeChips = [...new Set(gevondenChips)];
  if (uniekeChips.length) {
    if (chipsSamen) {
      punten.push(uniekeChips.map((c, i) => (i === 0 ? c : c.charAt(0).toLowerCase() + c.slice(1))).join(", "));
    } else {
      punten.push(...uniekeChips);
    }
  }
  for (const stuk of vrijeStukken) {
    for (const zin of splitsInZinnen(stuk)) punten.push(netPunt(zin));
  }
  // dubbels (bv. dezelfde voorziening zowel aangeklikt als door de AI vermeld) en lege punten weg
  const gezien = new Set();
  return punten.filter((p) => {
    const sleutel = p.toLowerCase();
    if (!p || gezien.has(sleutel)) return false;
    gezien.add(sleutel);
    return true;
  });
}

// De rubrieken van "Ligging in de omgeving" zoals ze in het verslag komen: [label, punten[]],
// enkel rubrieken met minstens één punt. Mobiscore hoort inhoudelijk bij de bereikbaarheid (niet
// bij de stedenbouwkundige gegevens, waar hij vroeger stond) en komt daarom als eerste punt daar.
export function liggingRubrieken(d) {
  const mobiscore = d.mobiscore !== undefined && d.mobiscore !== null && String(d.mobiscore).trim() !== ""
    ? [`Mobiscore ${String(d.mobiscore).replace(".", ",")}/10`] : [];
  // Een algemene chip ("Nabij openbaar vervoer (bus)") is overbodig zodra een concreet punt
  // hetzelfde al preciezer zegt ("Bushalte De Lijn (lijn 94) op 250 m") — dan valt de chip weg.
  const bereik = liggingPunten(d.bereikbaarheid, { chips: OPTS.bereikbaarheid });
  const concreet = bereik.filter((p) => !OPTS.bereikbaarheid.includes(p));
  const overbodig = (chip, re) => chip && concreet.some((p) => re.test(p));
  const bereikZonderDubbel = bereik.filter((p) => !(
    (p === "Nabij openbaar vervoer (bus)" && overbodig(p, /\bbus|\blijn\s*\d|\bhalte\b/i)) ||
    (p === "Nabij openbaar vervoer (trein)" && overbodig(p, /\bstation\b|\btrein/i)) ||
    (p === "Nabij op-/afrit autosnelweg" && overbodig(p, /afrit|oprit|\b[EAR]\s?\d{1,3}\b/i))
  ));
  return [
    ["Omgeving & voorzieningen", liggingPunten(d.omgevingsvoorzieningen, { chips: OPTS.omgevingsvoorzieningen, chipsSamen: true })],
    ["Bereikbaarheid", [...mobiscore, ...bereikZonderDubbel]],
    ["Toestand & uitrusting straat", liggingPunten(d.straatuitrusting, { chips: OPTS.straatuitrusting, chipsSamen: true })],
  ].filter(([, punten]) => punten.length > 0);
}
