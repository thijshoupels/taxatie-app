// ----------------------------------------------------------------------------
// domein/vlabelVgl.js — Vlabel-verkoopprijzenlijst inlezen, beoordelen en per punt motiveren
// ----------------------------------------------------------------------------
// De schatter krijgt van Vlabel per opdracht een lijst verkoopprijzen (.xls). Deze module zet die
// om naar verkopen (één verkoop kan meerdere kadastrale percelen/rijen hebben) en beoordeelt elke
// verkoop t.o.v. het te schatten goed volgens VASTE, controleerbare regels — bewust geen AI: de
// keuze moet tegenover Vlabel of een rechtbank exact te verantwoorden zijn, en dezelfde lijst geeft
// altijd hetzelfde resultaat. Per verkoop wordt ook een geschreven toelichting opgesteld: waarom
// dit punt (niet) in aanmerking komt, met de concrete cijfers.
//
// Afspraken met de schatter (september 2026):
//  - enkel verkopen binnen 2 jaar van de referentiedatum (of vandaag, zolang die niet ingevuld is);
//    tot 30 maanden: "reservepunt", apart getoond en niet meegerekend;
//  - oppervlaktes vergelijken in procenten; de gewogen nuttige oppervlakte van Vlabel ("gewogen
//    vloeroppervlakte", zie tabblad "Toelichting ivm velden") wordt vergeleken met de oppervlakte ná
//    coëfficiënten van het te schatten goed — niet met de ruwe bewoonbare oppervlakte;
//  - de bebouwingsvorm (open/halfopen/gesloten) weegt het zwaarst, maar staat niet in de lijst: ze
//    wordt afgeleid waar dat verantwoord kan en anders door de schatter bevestigd;
//  - geen automatische tijdscorrectie (indexering).
// Pure functies: geen DOM, geen netwerk — apart testbaar (zie __tests__/vlabelVgl.test.js).
import { excelDatumNaarIso } from "../lib/xlsLezen.js";
import { eur } from "../lib/format.js";

export const PERIODE_MAANDEN = 24;
export const RESERVE_MAANDEN = 30;
export const MAX_OPP_AFWIJKING = 0.40;
export const DREMPEL_RELEVANT = 60;

export const GEWICHTEN = {
  bebouwing: 35, nuttigeOpp: 25, afstand: 15, grond: 10, bouwjaar: 10, recentheid: 5,
};

// ---------- 1. inlezen ----------
const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

const KOLOMMEN = {
  nr: (h) => h === "nr verkoopprijs",
  afdeling: (h) => h === "gemeente - afdeling",
  straat: (h) => h.startsWith("straat"),
  huisnr: (h) => h === "huisnr",
  detail: (h) => h === "detail",
  capakey: (h) => h.startsWith("capakey"),
  belastbareOpp: (h) => h.startsWith("belastbare opp"),
  nietBelastbareOpp: (h) => h.startsWith("niet belastbare opp"),
  ki: (h) => h === "ki",
  aard: (h) => h === "aard kadaster",
  constructietype: (h) => h === "constructietype",
  verdiepingen: (h) => h === "verdiepingen",
  dakverdiep: (h) => h === "dakverdiep",
  bouwjaar: (h) => h === "bouwjaar",
  laatsteAanpassing: (h) => h.startsWith("laatste aanp"),
  garages: (h) => h === "garages",
  wooneenheden: (h) => h === "wooneenheden",
  bebouwdeOpp: (h) => h.startsWith("beb. grond"),
  nuttigeOpp: (h) => h.startsWith("nuttige opp"),
  refBronakte: (h) => h === "ref bronakte",
  omschrijving: (h) => h === "omschrijving goed",
  aktedatum: (h) => h.startsWith("aktedatum"),
  oppAkte: (h) => h.startsWith("oppervlakte volgens akte"),
  prijs: (h) => h.startsWith("prijs") && h.includes("lasten"),
  totaleNuttigeOpp: (h) => h.startsWith("totale nuttige opp"),
  totaleOppKad: (h) => h.startsWith("totale opp kad"),
  roBestemming: (h) => h === "ro bestemming",
  opmerking: (h) => h === "opmerking",
};

const getal = (v) => {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s/g, "");
  if (!t) return null;
  // "1.206" (duizendtal) vs "2467,35" (decimaal)
  const n = Number(/,/.test(t) ? t.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t);
  return isFinite(n) ? n : null;
};
const tekst = (v) => (v === null || v === undefined ? "" : typeof v === "number" ? String(v) : String(v).trim());

const titel = (s) => s.toLowerCase().replace(/(^|[\s\-/(])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
// "TEMSE  3 AFD/STEENDORP/" -> "Steendorp (Temse, afd. 3)"; "TEMSE  2 AFD" -> "Temse (afd. 2)"
export function leesbareAfdeling(afdeling) {
  const t = tekst(afdeling).replace(/\s+/g, " ");
  const m = t.match(/^(.*?)\s+(\d+)\s*AFD\.?(?:\/([^/]+)\/?)?$/i);
  if (!m) return titel(t);
  const gemeente = titel(m[1].trim());
  return m[3] ? `${titel(m[3].trim())} (${gemeente}, afd. ${m[2]})` : `${gemeente} (afd. ${m[2]})`;
}

const RESIDENTIEEL = /HUIS|WONING|VILLA|HOEVE|APPART|BUILDING|KAMER|STUDIO/i;
const NIET_RESIDENTIEEL_GEBOUW = /MAGAZIJN|NIJVERHEID|HANDELSHUIS|KANTOOR|WERKPLAATS|FABRIEK|LOODS|HANGAR|BEDRIJF|WINKEL|HOTEL|CAFE|RESTAURANT|SERRE|STAL|SCHUUR/i;
const GROND = /BOOMGAARD|WEILAND|BOUWLAND|AKKER|BOS|BOUWGROND|GRASLAND|HOOILAND|WEIDE|VIJVER|MOERAS|HEIDE/i;

// Oppervlaktes die in de omschrijving van het goed staan ("26a 05ca", "556m²", "1.206m²",
// "2467,35m²", "112m² en 558m²") — Vlabel vult "Oppervlakte volgens akte" standaard niet in, maar
// vermeldt ze soms wel in de omschrijving (zie tabblad "Toelichting ivm velden"). Som van alle
// vermelde oppervlaktes, of null als er geen staat.
// Een spatie als duizendtalscheiding ("10 202m²") is niet te onderscheiden van een huisnummer vlak
// vóór de oppervlakte ("Daalstraat 4 556m²"). Daarom twee lezingen: zonder én met spatie-groepering.
// Met een referentie (de kadastrale totale oppervlakte) wordt de lezing gekozen die er het dichtst
// bij ligt — zo geeft een huisnummer nooit een vals signaal "mogelijk gedeeltelijke verkoop".
export function oppervlakteUitOmschrijving(omschrijving, referentie = null) {
  const s = tekst(omschrijving);
  if (!s) return null;
  const lees = (metSpatieGroepering) => {
    let som = 0, gevonden = false;
    let rest = s.replace(/(?<![\d])(\d{1,3})\s*a\s*(\d{1,2})\s*ca\b/gi, (m, a, ca) => { som += Number(a) * 100 + Number(ca); gevonden = true; return " "; });
    rest = rest.replace(/(?<![\d])(\d{1,3})\s*a\b(?!\s*\d)/gi, (m, a) => { som += Number(a) * 100; gevonden = true; return " "; });
    rest = rest.replace(/(?<![\d])(\d{1,4})\s*ca\b/gi, (m, ca) => { som += Number(ca); gevonden = true; return " "; });
    const re = metSpatieGroepering
      ? /(?<![\d.,])(\d+(?:[ .]\d{3})*(?:,\d+)?)\s*m(?:²|2)(?![\d])/gi
      : /(?<![\d.,])(\d+(?:\.\d{3})*(?:,\d+)?)\s*m(?:²|2)(?![\d])/gi;
    rest.replace(re, (m, g) => {
      const n = getal(g.replace(/ /g, ""));
      if (n !== null) { som += n; gevonden = true; }
      return " ";
    });
    return gevonden ? Math.round(som * 100) / 100 : null;
  };
  const zonder = lees(false);
  const met = lees(true);
  if (referentie && zonder !== null && met !== null) {
    return Math.abs(met - referentie) < Math.abs(zonder - referentie) ? met : zonder;
  }
  return zonder;
}

// bladen (uit leesXls) -> { verkopen, afgeleverdOp, opmerkingAflevering } of een fout
export function leesVlabelLijst(bladen) {
  const blad = bladen.find((b) => /verkoopprijzen/i.test(b.naam)) || bladen[0];
  if (!blad) throw new Error("Het Excel-bestand bevat geen werkblad.");
  const rijen = blad.rijen;
  const kopIdx = rijen.findIndex((r) => r.some((c) => norm(c) === "nr verkoopprijs"));
  if (kopIdx < 0) throw new Error('Dit lijkt geen Vlabel-verkoopprijzenlijst: de kolom "Nr verkoopprijs" ontbreekt.');
  const kop = rijen[kopIdx].map(norm);
  const kol = {};
  for (const [sleutel, past] of Object.entries(KOLOMMEN)) {
    const i = kop.findIndex((h) => h && past(h));
    if (i >= 0) kol[sleutel] = i;
  }
  for (const verplicht of ["nr", "straat", "capakey", "aard", "prijs", "aktedatum"]) {
    if (kol[verplicht] === undefined) throw new Error(`Kolom "${verplicht}" niet gevonden in de Vlabel-lijst.`);
  }
  const waarde = (rij, sleutel) => (kol[sleutel] === undefined ? null : rij[kol[sleutel]]);

  // "afgeleverd op:" + eventuele opmerking bij aflevering (rijen net onder de kop)
  let afgeleverdOp = "", opmerkingAflevering = "";
  for (const rij of rijen.slice(kopIdx + 1, kopIdx + 4)) {
    rij.forEach((c, i) => {
      if (norm(c).startsWith("afgeleverd op")) {
        const volgende = rij.slice(i + 1).find((x) => x !== null && x !== "");
        afgeleverdOp = excelDatumNaarIso(volgende) || afgeleverdOp;
      }
      if (norm(c).startsWith("opmerking bij aflevering")) {
        opmerkingAflevering = tekst(rij.slice(i + 1).find((x) => typeof x === "string" && x.trim()) || "");
      }
    });
  }

  const perNr = new Map();
  for (const rij of rijen.slice(kopIdx + 1)) {
    const nr = tekst(waarde(rij, "nr"));
    if (!nr || getal(nr) === null) continue;
    const perceel = {
      afdeling: tekst(waarde(rij, "afdeling")),
      straat: tekst(waarde(rij, "straat")),
      huisnr: tekst(waarde(rij, "huisnr")).replace(/\s*\+$/, "").trim(),
      detail: tekst(waarde(rij, "detail")),
      capakey: tekst(waarde(rij, "capakey")),
      opp: getal(waarde(rij, "belastbareOpp")),
      nietBelastbareOpp: getal(waarde(rij, "nietBelastbareOpp")),
      ki: getal(waarde(rij, "ki")),
      aard: tekst(waarde(rij, "aard")),
      constructietype: tekst(waarde(rij, "constructietype")),
      verdiepingen: getal(waarde(rij, "verdiepingen")),
      dakverdiep: tekst(waarde(rij, "dakverdiep")),
      bouwjaar: tekst(waarde(rij, "bouwjaar")),
      laatsteAanpassing: tekst(waarde(rij, "laatsteAanpassing")),
      garages: getal(waarde(rij, "garages")),
      wooneenheden: getal(waarde(rij, "wooneenheden")),
      bebouwdeOpp: getal(waarde(rij, "bebouwdeOpp")),
      nuttigeOpp: getal(waarde(rij, "nuttigeOpp")),
    };
    if (!perNr.has(nr)) {
      const prijsRuw = waarde(rij, "prijs");
      perNr.set(nr, {
        nr,
        refBronakte: tekst(waarde(rij, "refBronakte")),
        omschrijving: tekst(waarde(rij, "omschrijving")),
        datum: excelDatumNaarIso(waarde(rij, "aktedatum")),
        prijs: getal(prijsRuw),
        prijsTekst: tekst(prijsRuw),
        oppAkte: getal(waarde(rij, "oppAkte")),
        totaleNuttigeOpp: getal(waarde(rij, "totaleNuttigeOpp")),
        totaleOppKad: getal(waarde(rij, "totaleOppKad")),
        roBestemming: tekst(waarde(rij, "roBestemming")),
        opmerking: tekst(waarde(rij, "opmerking")),
        percelen: [],
      });
    }
    const v = perNr.get(nr);
    // totalen staan soms enkel op één van de rijen van een verkoop
    if (v.totaleNuttigeOpp === null) v.totaleNuttigeOpp = getal(waarde(rij, "totaleNuttigeOpp"));
    if (v.totaleOppKad === null) v.totaleOppKad = getal(waarde(rij, "totaleOppKad"));
    if (!v.omschrijving) v.omschrijving = tekst(waarde(rij, "omschrijving"));
    v.percelen.push(perceel);
  }

  const verkopen = [...perNr.values()].map((v) => {
    const hoofdIdx = Math.max(0, v.percelen.findIndex((p) => RESIDENTIEEL.test(p.aard)));
    const hoofd = v.percelen[hoofdIdx];
    const somGrond = v.percelen.reduce((s, p) => s + (p.opp || 0), 0);
    const somNuttig = v.percelen.reduce((s, p) => s + (p.nuttigeOpp || 0), 0);
    return {
      ...v,
      hoofdIdx,
      adres: [hoofd.straat, hoofd.huisnr].filter(Boolean).join(" "),
      plaats: leesbareAfdeling(hoofd.afdeling),
      afdelingscode: hoofd.capakey.slice(0, 5),
      nuttigeOpp: v.totaleNuttigeOpp || somNuttig || null,
      grondOpp: v.totaleOppKad || somGrond || null,
      oppOmschrijving: oppervlakteUitOmschrijving(v.omschrijving, v.totaleOppKad || somGrond || null),
    };
  });
  return { verkopen, afgeleverdOp, opmerkingAflevering };
}

// ---------- 2. het te schatten goed ----------
export function onderwerpUitDossier(d, calc, vandaagIso) {
  const n = (v) => { const x = parseFloat(v); return isFinite(x) && x > 0 ? x : null; };
  const pandType = d.pandType || "Woning";
  const hoofdtype = pandType === "Appartement" ? "appartement" : pandType === "Woning" ? "woning" : "ander";
  const gewogen = calc && calc.totOppNaCoeff > 0 ? calc.totOppNaCoeff : null;
  return {
    hoofdtype,
    bebouwing: hoofdtype === "woning" && ["Open", "Halfopen", "Gesloten"].includes(d.bouwtype) ? d.bouwtype : null,
    nuttigeOpp: gewogen || n(d.bewoonbareOppSchatting),
    nuttigeOppBron: gewogen ? "berekend na coëfficiënten" : n(d.bewoonbareOppSchatting) ? "schatting" : null,
    grondOpp: hoofdtype === "appartement" ? null : (n(d.grondopp) || n(d.kadastraleOpp)),
    bouwjaar: n(d.bouwjaar),
    renovatiejaar: n(d.renovatiejaar),
    referentiedatum: d.referentiedatum || vandaagIso,
    referentieIsVandaag: !d.referentiedatum,
    afdelingscode: tekst(d.capakey).toUpperCase().slice(0, 5),
  };
}

// ---------- 3. beoordelen ----------
const maandenTussen = (a, b) => {
  const da = new Date(a + "T00:00:00Z"), db = new Date(b + "T00:00:00Z");
  return (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + (db.getUTCMonth() - da.getUTCMonth()) + (db.getUTCDate() - da.getUTCDate()) / 31;
};
const lineair = (x, vol, nul, gewicht) => (x <= vol ? gewicht : x >= nul ? 0 : gewicht * (nul - x) / (nul - vol));
const rond = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;
const m2 = (x) => `${rond(x).toLocaleString("nl-BE")} m²`;
const procent = (x) => `${rond(Math.abs(x) * 100)}%`;
const datumNl = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
const geldigJaar = (s, huidig) => { const j = parseInt(s, 10); return j >= 1800 && j <= huidig ? j : null; };

export function afgeleideBebouwing(verkoop) {
  const hoofd = verkoop.percelen[verkoop.hoofdIdx];
  if (/villa/i.test(hoofd.constructietype)) return { waarde: "Open", reden: "kadastrale constructieklasse 'villa'" };
  if (verkoop.grondOpp !== null && verkoop.grondOpp <= 200) return { waarde: "Gesloten", reden: `perceel van slechts ${m2(verkoop.grondOpp)}` };
  return null;
}

const NABUUR = { "Open|Halfopen": true, "Halfopen|Open": true, "Halfopen|Gesloten": true, "Gesloten|Halfopen": true };

// afstand in km tussen twee punten: Lambert 72 (meter) of — als de dienst toch graden terugeeft — lon/lat
export function afstandKm(a, b) {
  if (!a || !b) return null;
  if (Math.abs(a[0]) <= 180 && Math.abs(a[1]) <= 90 && Math.abs(b[0]) <= 180 && Math.abs(b[1]) <= 90) {
    const r = Math.PI / 180;
    const dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }
  return Math.hypot(a[0] - b[0], a[1] - b[1]) / 1000;
}

// Beoordeelt één verkoop. extra = { bevestigdeBebouwing, coordinaat, onderwerpCoordinaat, vandaagIso }
export function beoordeelVerkoop(v, o, extra = {}) {
  const huidigJaar = parseInt((extra.vandaagIso || new Date().toISOString()).slice(0, 4), 10);
  const hoofd = v.percelen[v.hoofdIdx];
  const uitsluitingen = [];
  const aandachtspunten = [];
  const criteria = [];

  // --- harde uitsluitingen ---
  if (v.prijs === null || v.prijs <= 0) {
    uitsluitingen.push(/foute waarde/i.test(v.prijsTekst)
      ? 'Vlabel markeert de prijs als "FOUTE WAARDE": de overeengekomen waarde is mogelijk niet de verkoopwaarde.'
      : "geen bruikbare verkoopprijs in de lijst.");
  }
  const nietResidentieel = v.percelen.filter((p) => NIET_RESIDENTIEEL_GEBOUW.test(p.aard) || /nijverheid/i.test(p.constructietype));
  if (nietResidentieel.length) {
    const p = nietResidentieel[0];
    uitsluitingen.push(`gemengde verkoop: de prijs omvat ook een ${p.aard.toLowerCase()}${p.opp ? ` op ${m2(p.opp)}` : ""}, en heeft dus niet uitsluitend betrekking op de woning.`);
  }
  const kType = /APPART/i.test(hoofd.aard) ? "appartement" : RESIDENTIEEL.test(hoofd.aard) ? "woning" : "ander";
  if (o.hoofdtype !== "ander" && kType !== "ander" && kType !== o.hoofdtype) {
    uitsluitingen.push(`ander type goed (${kType}) dan het te schatten goed (${o.hoofdtype}).`);
  } else if (kType === "ander" && !nietResidentieel.length) {
    uitsluitingen.push(`geen woongelegenheid in de verkoop (kadastrale aard: ${hoofd.aard.toLowerCase() || "onbekend"}).`);
  }
  const eenheden = v.percelen.reduce((s, p) => s + (p.wooneenheden || 0), 0);
  if (o.hoofdtype === "woning" && eenheden > 1) uitsluitingen.push(`de verkoop omvat ${eenheden} wooneenheden (meergezinswoning).`);

  let maanden = null;
  let reserve = false;
  if (!v.datum) {
    uitsluitingen.push("geen aktedatum in de lijst.");
  } else {
    maanden = maandenTussen(v.datum, o.referentiedatum);
    const afstandInTijd = Math.abs(maanden);
    if (afstandInTijd > RESERVE_MAANDEN) {
      uitsluitingen.push(`verkocht op ${datumNl(v.datum)}, meer dan ${PERIODE_MAANDEN} maanden van de referentiedatum.`);
    } else if (afstandInTijd > PERIODE_MAANDEN) {
      reserve = true;
    }
  }

  let oppVerschil = null;
  if (v.nuttigeOpp && o.nuttigeOpp) {
    oppVerschil = (v.nuttigeOpp - o.nuttigeOpp) / o.nuttigeOpp;
    if (Math.abs(oppVerschil) > MAX_OPP_AFWIJKING) {
      uitsluitingen.push(`gewogen nuttige oppervlakte van ${m2(v.nuttigeOpp)} wijkt ${procent(oppVerschil)} af van die van het te schatten goed (${m2(o.nuttigeOpp)}); de grens is ${procent(MAX_OPP_AFWIJKING)}.`);
    }
  }

  // --- criteria (score) ---
  // bebouwingsvorm
  let bebouwing = null;
  if (o.hoofdtype === "woning") {
    if (extra.bevestigdeBebouwing) bebouwing = { waarde: extra.bevestigdeBebouwing, bron: "bevestigd", reden: "bevestigd door de schatter-expert" };
    else { const a = afgeleideBebouwing(v); if (a) bebouwing = { waarde: a.waarde, bron: "afgeleid", reden: `afgeleid uit de ${a.reden}` }; }
    let punten = null, tekstB;
    if (!o.bebouwing) tekstB = "bebouwingsvorm van het te schatten goed niet ingevuld";
    else if (!bebouwing) tekstB = "bebouwingsvorm staat niet in de Vlabel-lijst — te bevestigen";
    else if (bebouwing.waarde === o.bebouwing) { punten = GEWICHTEN.bebouwing; tekstB = `${bebouwing.waarde.toLowerCase()} bebouwing, zoals het te schatten goed`; }
    else if (NABUUR[`${bebouwing.waarde}|${o.bebouwing}`]) { punten = 10; tekstB = `${bebouwing.waarde.toLowerCase()} i.p.v. ${o.bebouwing.toLowerCase()} bebouwing`; }
    else { punten = 0; tekstB = `${bebouwing.waarde.toLowerCase()} i.p.v. ${o.bebouwing.toLowerCase()} bebouwing`; }
    criteria.push({ sleutel: "bebouwing", label: "Bebouwingsvorm", gewicht: GEWICHTEN.bebouwing, punten, tekst: tekstB });
  }
  // nuttige oppervlakte
  criteria.push({
    sleutel: "nuttigeOpp", label: "Gewogen nuttige opp.", gewicht: GEWICHTEN.nuttigeOpp,
    punten: oppVerschil === null ? null : lineair(Math.abs(oppVerschil), 0.10, MAX_OPP_AFWIJKING, GEWICHTEN.nuttigeOpp),
    tekst: oppVerschil === null
      ? (!v.nuttigeOpp ? "geen nuttige oppervlakte in de lijst" : "oppervlakte van het te schatten goed nog niet ingevuld")
      : `${m2(v.nuttigeOpp)} (${oppVerschil >= 0 ? "+" : "−"}${procent(oppVerschil)} t.o.v. ${m2(o.nuttigeOpp)})`,
  });
  // afstand
  const km = afstandKm(extra.coordinaat, extra.onderwerpCoordinaat);
  let afstandPunten = null, afstandTekst;
  if (km !== null) {
    afstandPunten = lineair(km, 1, 5, GEWICHTEN.afstand);
    afstandTekst = `ca. ${rond(km, 1).toLocaleString("nl-BE")} km`;
  } else if (o.afdelingscode && v.afdelingscode) {
    const zelfde = o.afdelingscode === v.afdelingscode;
    afstandPunten = zelfde ? 10 : 0;
    afstandTekst = zelfde ? "zelfde kadastrale afdeling (afstand niet opgezocht)" : "andere kadastrale afdeling (afstand niet opgezocht)";
  } else {
    afstandTekst = "afstand niet te bepalen";
  }
  criteria.push({ sleutel: "afstand", label: "Afstand", gewicht: GEWICHTEN.afstand, punten: afstandPunten, tekst: afstandTekst, km });
  // grond
  if (o.hoofdtype !== "appartement") {
    const gv = v.grondOpp && o.grondOpp ? (v.grondOpp - o.grondOpp) / o.grondOpp : null;
    criteria.push({
      sleutel: "grond", label: "Grondoppervlakte", gewicht: GEWICHTEN.grond,
      punten: gv === null ? null : lineair(Math.abs(gv), 0.15, 0.60, GEWICHTEN.grond),
      tekst: gv === null ? (!v.grondOpp ? "geen perceeloppervlakte in de lijst" : "grondoppervlakte van het te schatten goed nog niet ingevuld")
        : `${m2(v.grondOpp)} (${gv >= 0 ? "+" : "−"}${procent(gv)} t.o.v. ${m2(o.grondOpp)})`,
      verschil: gv,
    });
  }
  // bouwjaar
  const bj = geldigJaar(hoofd.bouwjaar, huidigJaar);
  const aanp = geldigJaar(hoofd.laatsteAanpassing, huidigJaar);
  if (hoofd.bouwjaar && !bj) aandachtspunten.push(`het bouwjaar in de lijst ("${hoofd.bouwjaar}") is onbruikbaar en werd niet meegewogen.`);
  const bjVerschil = bj && o.bouwjaar ? bj - o.bouwjaar : null;
  criteria.push({
    sleutel: "bouwjaar", label: "Bouwjaar", gewicht: GEWICHTEN.bouwjaar,
    punten: bjVerschil === null ? null : lineair(Math.abs(bjVerschil), 10, 30, GEWICHTEN.bouwjaar),
    tekst: bjVerschil === null ? (!bj ? "bouwjaar onbekend of onbruikbaar" : "bouwjaar van het te schatten goed nog niet ingevuld")
      : `${bj}${aanp ? ` (laatste aanpassing ${aanp})` : ""} t.o.v. ${o.bouwjaar}`,
    verschil: bjVerschil, bouwjaar: bj, aanpassing: aanp,
  });
  // recentheid
  criteria.push({
    sleutel: "recentheid", label: "Recentheid", gewicht: GEWICHTEN.recentheid,
    punten: maanden === null ? null : lineair(Math.abs(maanden), 0, PERIODE_MAANDEN, GEWICHTEN.recentheid),
    tekst: maanden === null ? "datum onbekend" : `${datumNl(v.datum)} (${rond(Math.abs(maanden))} maanden ${maanden >= 0 ? "vóór" : "na"} de referentiedatum)`,
  });

  // --- aandachtspunten ---
  const grondstukken = v.percelen.filter((p) => GROND.test(p.aard));
  for (const p of grondstukken) aandachtspunten.push(`de verkoop omvat ook ${p.opp ? m2(p.opp) + " " : ""}${p.aard.toLowerCase()}; de prijs slaat dus niet uitsluitend op de woning met tuin.`);
  if (v.oppOmschrijving && v.grondOpp && Math.abs(v.oppOmschrijving - v.grondOpp) / v.grondOpp > 0.10) {
    aandachtspunten.push(`de omschrijving in de akte vermeldt ${m2(v.oppOmschrijving)}, terwijl de kadastrale percelen samen ${m2(v.grondOpp)} tellen — mogelijk een gedeeltelijke verkoop van het bronperceel of een bijkomend perceel.`);
  }
  if (v.roBestemming) aandachtspunten.push(`bestemming volgens het gewestplan: ${v.roBestemming}.`);
  if (v.opmerking) aandachtspunten.push(`opmerking Vlabel: ${v.opmerking}`);

  const beoordeeld = criteria.filter((c) => c.punten !== null);
  const somGewicht = beoordeeld.reduce((s, c) => s + c.gewicht, 0);
  const score = somGewicht ? Math.round(beoordeeld.reduce((s, c) => s + c.punten, 0) / somGewicht * 100) : null;
  const bebouwingCrit = criteria.find((c) => c.sleutel === "bebouwing");

  let status;
  if (uitsluitingen.length) status = "uitgesloten";
  else if (reserve) status = "reserve";
  else if (bebouwingCrit && bebouwingCrit.punten === null && o.bebouwing) status = "bevestigen";
  else status = score !== null && score >= DREMPEL_RELEVANT ? "relevant" : "minder";

  const resultaat = {
    nr: v.nr, status, score, criteria, uitsluitingen, aandachtspunten, bebouwing, maanden,
    prijsPerM2Nuttig: v.prijs && v.nuttigeOpp ? v.prijs / v.nuttigeOpp : null,
    nietBeoordeeld: criteria.filter((c) => c.punten === null).map((c) => c.label.toLowerCase()),
  };
  resultaat.toelichting = schrijfToelichting(v, resultaat, o);
  return resultaat;
}

// ---------- 4. geschreven toelichting ----------
const opsomming = (delen) => (delen.length <= 1 ? delen.join("") : `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`);

export function schrijfToelichting(v, b, o) {
  const kop = `${v.adres}, ${v.plaats} — verkocht op ${datumNl(v.datum)}${v.prijs ? ` voor een overeengekomen waarde van ${eur(v.prijs)}${b.prijsPerM2Nuttig ? ` (${eur(b.prijsPerM2Nuttig)} per m² gewogen nuttige oppervlakte)` : ""}` : ""}.`;
  if (b.status === "uitgesloten") {
    return `${kop} Niet weerhouden als vergelijkingspunt: ${b.uitsluitingen.join(" Bovendien: ")}`;
  }
  const c = Object.fromEntries(b.criteria.map((x) => [x.sleutel, x]));
  const plus = [], min = [];

  if (c.bebouwing && c.bebouwing.punten !== null) {
    if (c.bebouwing.punten === GEWICHTEN.bebouwing) plus.push(`het, net als het te schatten goed, een woning in ${o.bebouwing.toLowerCase()} bebouwing is (${b.bebouwing.reden})`);
    else min.push(`het een woning in ${b.bebouwing.waarde.toLowerCase()} bebouwing is, terwijl het te schatten goed ${o.bebouwing.toLowerCase()} bebouwd is (${b.bebouwing.reden})`);
  }
  if (c.nuttigeOpp.punten !== null) {
    const d = (v.nuttigeOpp - o.nuttigeOpp) / o.nuttigeOpp;
    const zin = Math.abs(d) < 0.005
      ? `de gewogen nuttige oppervlakte (${m2(v.nuttigeOpp)}) gelijk is aan die van het te schatten goed`
      : `de gewogen nuttige oppervlakte ${m2(v.nuttigeOpp)} bedraagt, ${procent(d)} ${d >= 0 ? "meer" : "minder"} dan de ${m2(o.nuttigeOpp)} van het te schatten goed`;
    (Math.abs(d) <= 0.25 ? plus : min).push(Math.abs(d) <= 0.10 && Math.abs(d) >= 0.005 ? `${zin} (nagenoeg gelijk)` : zin);
  }
  if (c.grond && c.grond.punten !== null) {
    const zin = Math.abs(c.grond.verschil) < 0.005
      ? `het perceel (${m2(v.grondOpp)}) even groot is als dat van het te schatten goed`
      : `het perceel ${m2(v.grondOpp)} groot is, ${procent(c.grond.verschil)} ${c.grond.verschil >= 0 ? "groter" : "kleiner"} dan dat van het te schatten goed (${m2(o.grondOpp)})`;
    (Math.abs(c.grond.verschil) <= 0.30 ? plus : min).push(zin);
  }
  if (c.bouwjaar.punten !== null) {
    const d = c.bouwjaar.verschil;
    const reno = c.bouwjaar.aanpassing ? `, met een laatste gekende aanpassing in ${c.bouwjaar.aanpassing}` : "";
    const zin = d === 0 ? `het in hetzelfde jaar gebouwd werd (${c.bouwjaar.bouwjaar})${reno}`
      : `het gebouwd werd in ${c.bouwjaar.bouwjaar}, ${Math.abs(d)} jaar ${d > 0 ? "later" : "vroeger"} dan het te schatten goed (${o.bouwjaar})${reno}`;
    (Math.abs(d) <= 15 ? plus : min).push(zin);
  }
  if (c.afstand.punten !== null) {
    if (c.afstand.km !== null) (c.afstand.km <= 2 ? plus : min).push(`het op ${c.afstand.tekst} van het te schatten goed ligt`);
    else (c.afstand.punten > 0 ? plus : min).push(c.afstand.punten > 0 ? "het in dezelfde kadastrale afdeling ligt" : "het in een andere kadastrale afdeling ligt");
  }
  if (b.maanden !== null) {
    const zin = `de verkoop ${rond(Math.abs(b.maanden))} maanden ${b.maanden >= 0 ? "vóór" : "na"} de referentiedatum plaatsvond`;
    (Math.abs(b.maanden) <= 12 ? plus : min).push(zin);
  }

  const delen = [kop];
  if (b.status === "reserve") {
    delen.push(`Reservepunt: de verkoop ligt iets meer dan ${PERIODE_MAANDEN} maanden ${b.maanden >= 0 ? "vóór" : "na"} de referentiedatum, net buiten de gehanteerde periode; enkel te gebruiken met bijkomende motivering.`);
  }
  if (plus.length) delen.push(`Dit vergelijkingspunt komt in aanmerking omdat ${opsomming(plus)}.`);
  if (min.length) delen.push(`${plus.length ? "Er moet wel rekening gehouden worden met het feit dat" : "Het is slechts beperkt vergelijkbaar omdat"} ${opsomming(min)}.`);
  if (b.aandachtspunten.length) delen.push(`Aandachtspunten: ${b.aandachtspunten.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(" ")}`);
  if (b.bebouwing && b.bebouwing.bron === "afgeleid") delen.push("De bebouwingsvorm staat niet in de Vlabel-gegevens en werd afgeleid; te bevestigen door de schatter-expert.");
  return delen.join(" ");
}

// ---------- 5. alles samen ----------
export function beoordeelLijst(lijst, o, { bevestigdeBebouwing = {}, coordinaten = {}, onderwerpCoordinaat = null, vandaagIso } = {}) {
  const uit = lijst.verkopen.map((v) => ({
    verkoop: v,
    beoordeling: beoordeelVerkoop(v, o, {
      bevestigdeBebouwing: bevestigdeBebouwing[v.nr], coordinaat: coordinaten[v.nr] || null, onderwerpCoordinaat, vandaagIso,
    }),
  }));
  const volgorde = { relevant: 0, bevestigen: 1, minder: 2, reserve: 3, uitgesloten: 4 };
  return uit.sort((a, b) => volgorde[a.beoordeling.status] - volgorde[b.beoordeling.status]
    || (b.beoordeling.score ?? -1) - (a.beoordeling.score ?? -1)
    || (b.verkoop.datum || "").localeCompare(a.verkoop.datum || ""));
}

// Een beoordeelde verkoop omzetten naar een vergelijkingspunt in de bestaande velden van het dossier
export function naarVergelijkingspunt(v, b, { afgeleverdOp = "" } = {}) {
  const hoofd = v.percelen[v.hoofdIdx];
  const huidigJaar = new Date().getFullYear();
  const percelen = v.percelen.map((p) => `${p.capakey} (${p.aard.toLowerCase()}${p.opp ? `, ${m2(p.opp)}` : ""})`).join("; ");
  const ki = v.percelen.reduce((s, p) => s + (p.ki || 0), 0);
  return {
    adres: `${v.adres}, ${v.plaats}`,
    kadastraleGegevens: `${percelen}${ki ? ` — KI ${eur(ki)}` : ""}`,
    bouwjaar: String(geldigJaar(hoofd.bouwjaar, huidigJaar) || ""),
    aardTransactie: "Verkoop uit de hand",
    datumTransactie: v.datum,
    belastbareGrondslag: v.prijs ? String(v.prijs) : "",
    bron: `Vlabel — verkoopprijzen Patrimoniumdocumentatie${afgeleverdOp ? ` (lijst afgeleverd op ${datumNl(afgeleverdOp)})` : ""}${v.refBronakte ? `, ref. bronakte ${v.refBronakte}` : ""}`,
    bebouwdeOpp: hoofd.bebouwdeOpp ? String(hoofd.bebouwdeOpp) : "",
    afweging: b.toelichting,
    vlabelNr: v.nr,
    vlabelRef: v.refBronakte,
  };
}
