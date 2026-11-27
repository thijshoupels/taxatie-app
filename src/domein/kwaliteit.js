// ----------------------------------------------------------------------------
// domein/kwaliteit.js — kwaliteitsscore van een verslag (0-100 %)
// ----------------------------------------------------------------------------
// Eén getal dat de schatter-expert toont hoe volledig en onderbouwd het verslag is, met per
// onderdeel wat er nog ontbreekt en op welk tabblad dat aangevuld wordt. De score is een
// hulpmiddel, geen keuring: ze blokkeert niets (dat doet enkel valideerDossier in App.jsx).
//
// Opbouw: een vaste lijst criteria, elk met een gewicht. Een criterium dat voor dit dossier niet
// van toepassing is (bv. Vlabel-gegevens buiten een nalatenschap, EPC bij een garage), telt niet
// mee — ook niet in het maximum. Sommige criteria geven een deel van de punten (bv. 4 van de 6
// foto's). Score = behaalde punten / maximum. Zolang het verslag nog niet aangemaakt mag worden
// (blokkerende punten uit valideerDossier, via opties.blokkerend), blijft de score onder 50 %.
//
// Wat telt mee, bewust beperkt tot wat een verslag sterker maakt:
//   - opdracht & partijen: opdrachtgever, datums, schatter-expert, eedformule, eigenaars,
//     Vlabel-gegevens bij een nalatenschap;
//   - pand & kadaster: adres, CaPaKey, kadastrale gegevens, KI, bouwjaar, staat;
//   - ligging & beschrijving: omgeving, constructie, verwarming, EPC;
//   - SWOT & conclusie;
//   - waardering: de berekening zonder controlepunten (calc.controlePunten), de motivering van de
//     methode, vergelijkingspunten bij de vergelijkende methode;
//   - foto's & stukken: voorbladfoto, foto's in bijlage, documenten;
//   - samenhang: de inhoudelijke controles (domein/controles.js) — elke tegenstrijdigheid kost punten.
// Pure functie — apart testbaar (zie __tests__/kwaliteit.test.js).
import { isResidentieelType, isZonderGebouw, isGrond, isLandbouwgrond } from "./vastgoedtypes.js";
import { epcRegime, epcGegevens } from "./epc.js";
import { controlesAllePanden } from "./controles.js";
import { NOG_TE_KIEZEN } from "../constants.js";

// tabbladen van de wizard (sleutel zoals in DossierWizard.jsx) — om naartoe te springen
export const TABBLADEN = {
  documenten: "Documenten (start hier)",
  opdracht: "Opdracht & partijen",
  ligging: "Ligging & omgeving",
  type: "Type, staat & kadaster",
  constructie: "Constructie & isolatie",
  installaties: "Verwarming & installaties",
  bedrijfskenmerken: "Bedrijfskenmerken",
  markt: "Markt, stedenbouw & juridisch",
  swot: "SWOT-analyse",
  afmetingen: "Afmetingen & indeling",
  vergelijkingspunten: "Vergelijkingspunten",
  waardering: "Waardering",
  fotos: "Foto's (bijlage)",
};

export const KWALITEIT_NIVEAUS = [
  { vanaf: 90, label: "Zeer volledig", toon: "goed" },
  { vanaf: 75, label: "Volledig", toon: "goed" },
  { vanaf: 50, label: "Onvolledig", toon: "matig" },
  { vanaf: 0, label: "Sterk onvolledig", toon: "slecht" },
];
export const FOTOS_DOEL = 6;
export const VERGELIJKINGSPUNTEN_DOEL = 3;

const gevuld = (v) => String(v ?? "").trim() !== "";
const deel = (...waarden) => waarden.filter(Boolean).length / waarden.length;

// "… — tabblad Waardering" → "waardering"
export function tabUitTekst(tekst) {
  const m = /tabblad ([^—]+?)(?: (?:en|of) .*)?$/.exec(String(tekst || ""));
  if (!m) return "";
  const label = m[1].trim();
  return Object.keys(TABBLADEN).find((k) => TABBLADEN[k] === label)
    || Object.keys(TABBLADEN).find((k) => TABBLADEN[k].startsWith(label)) || "";
}
// controlepunten van de berekening (zonder tabblad in de tekst) → het juiste tabblad
// (bouwtype en het pandtype staan op "Type, staat & kadaster", niet op Waardering)
export const tabVoorControlepunt = (t) => (/bouwtype/i.test(t) ? "type" : /oppervlakte|ruimte|grond/i.test(t) ? "afmetingen" : "waardering");

export function niveauVoorScore(score) {
  return KWALITEIT_NIVEAUS.find((n) => score >= n.vanaf) || KWALITEIT_NIVEAUS[KWALITEIT_NIVEAUS.length - 1];
}

export function berekenKwaliteit(d, calc, opties = {}) {
  const blokkerend = opties.blokkerend || [];
  // garage en grond: geen bouwjaar, staat, constructie of EPC
  const garage = isZonderGebouw(d);
  const residentieel = isResidentieelType(d);
  const criteria = [];
  // groep, tabblad, omschrijving, gewicht, behaald (0-1), tip (wat ontbreekt — enkel als niet volledig)
  const voeg = (groep, tab, label, gewicht, behaald, tip) =>
    criteria.push({ groep, tab, label, gewicht, behaald: Math.max(0, Math.min(1, behaald)), tip: tip || label });

  // ---- opdracht & partijen ----
  const G1 = "Opdracht & partijen";
  voeg(G1, "opdracht", "Opdrachtgever", 2, gevuld(d.opdrachtgeverNaam) ? 1 : 0, "Naam van de opdrachtgever");
  voeg(G1, "opdracht", "Datum plaatsbezoek", 2, gevuld(d.datumBezoek) ? 1 : 0);
  voeg(G1, "opdracht", "Datum verslag en referentiedatum", 3, deel(gevuld(d.datumVerslag), gevuld(d.referentiedatum)),
    [!gevuld(d.datumVerslag) && "datum verslag", !gevuld(d.referentiedatum) && "referentiedatum"].filter(Boolean).join(" en ").replace(/^./, (c) => c.toUpperCase()));
  voeg(G1, "opdracht", "Schatter-expert (naam en BIV-nummer)", 2, deel(gevuld(d.schatterNaam), gevuld(d.schatterBivNummer)),
    !gevuld(d.schatterNaam) && !gevuld(d.schatterBivNummer) ? "Naam en BIV-nummer van de schatter-expert"
      : !gevuld(d.schatterNaam) ? "Naam van de schatter-expert" : "BIV-nummer van de schatter-expert");
  voeg(G1, "opdracht", "Eedformule (handtekening en plaats)", 3, deel(gevuld(d.handtekening), gevuld(d.eedPlaats)),
    !gevuld(d.handtekening) && !gevuld(d.eedPlaats) ? 'Handtekening en plaats ("Gedaan te …") bij de eedformule'
      : !gevuld(d.handtekening) ? "Handtekening bij de eedformule" : 'Plaats bij de eedformule ("Gedaan te …")');
  voeg(G1, "opdracht", "Eigenaar(s)", 2, (d.eigenaars || []).some((e) => e && gevuld(e.naam)) ? 1 : 0, "Naam van de eigenaar(s)");
  if (d.reden === "Nalatenschap") {
    const vl = [gevuld(d.overledenNaam), gevuld(d.vlabelDossiernummer), gevuld(d.schatterVlabelNummer)];
    voeg(G1, "opdracht", "Vlabel-gegevens", 3, deel(...vl),
      ["naam overledene", "Vlabel-dossiernummer", "Vlabel-identificatienummer schatter-expert"].filter((_, i) => !vl[i]).join(", ").replace(/^./, (c) => c.toUpperCase()));
  }

  // ---- pand & kadaster ----
  const G2 = "Pand & kadaster";
  // grond heeft vaak geen adres: daar volstaan postcode, gemeente en de straat óf de CaPaKey
  const adres = isGrond(d)
    ? [gevuld(d.straat) || gevuld(d.capakey), gevuld(d.postcode), gevuld(d.gemeente)]
    : [gevuld(d.straat), gevuld(d.nummer), gevuld(d.postcode), gevuld(d.gemeente)];
  voeg(G2, "type", "Volledig adres", 3, deel(...adres), isGrond(d) ? "Ligging (straat of CaPaKey, postcode en gemeente)" : "Volledig adres (straat, nummer, postcode en gemeente)");
  voeg(G2, "type", "CaPaKey", 2, gevuld(d.capakey) ? 1 : 0, "CaPaKey (kadastrale identificatie)");
  voeg(G2, "type", "Kadastrale gegevens", 2, deel(gevuld(d.kadAfdeling), gevuld(d.kadSectie), gevuld(d.kadPerceelnummer)),
    "Kadastrale afdeling, sectie en perceelnummer");
  voeg(G2, "type", "Kadastraal inkomen", 1, gevuld(d.ki) ? 1 : 0, "Kadastraal inkomen (KI)");
  if (!garage) {
    voeg(G2, "type", "Bouwjaar", 2, gevuld(d.bouwjaar) ? 1 : 0, "Bouwjaar (of een schatting)");
    voeg(G2, "type", "Staat van het pand", 1, (d.staat || []).length ? 1 : 0, "Staat van het pand");
  }
  if (isLandbouwgrond(d)) {
    voeg(G2, "type", "Pachtsituatie", 2, gevuld(d.pachtSituatie) && d.pachtSituatie !== "Onbekend" ? 1 : 0, "Pachtsituatie (vrij van pacht of verpacht)");
  }

  // ---- ligging & beschrijving ----
  const G3 = "Ligging & beschrijving";
  voeg(G3, "ligging", "Omgeving en bereikbaarheid", 2, deel(gevuld(d.omgevingsvoorzieningen), gevuld(d.bereikbaarheid)),
    !gevuld(d.omgevingsvoorzieningen) && !gevuld(d.bereikbaarheid) ? "Omgevingsvoorzieningen en bereikbaarheid"
      : !gevuld(d.omgevingsvoorzieningen) ? "Omgevingsvoorzieningen" : "Bereikbaarheid");
  if (residentieel && !garage) {
    voeg(G3, "constructie", "Beschrijving van de constructie", 2, gevuld(d.voorgevel) || gevuld(d.materiaalkwaliteitOmschrijving) ? 1 : 0,
      "Beschrijving van de gevels of de materiaalkwaliteit");
    voeg(G3, "installaties", "Verwarming", 1, (d.verwarmingSoort || []).length ? 1 : 0, "Soort verwarming");
  }
  if (!garage) {
    const regime = epcRegime(d);
    const epcTab = residentieel ? "constructie" : "bedrijfskenmerken";
    if (regime === "residentieel") {
      if (d.epcStatus === "Aanwezig") {
        const e = epcGegevens(d);
        voeg(G3, epcTab, "EPC", 2, gevuld(e.label) || e.score > 0 ? 1 : 0, "EPC-label of -score (het EPC staat op \"Aanwezig\")");
      }
    } else if (regime !== "geen") {
      const e = epcGegevens(d);
      voeg(G3, epcTab, "EPC", 2, regime === "onbekend" ? 0 : (gevuld(e.label) || e.score > 0 ? 1 : 0.5),
        regime === "onbekend" ? "EPC-regime" : "EPC-label of -score");
    }
  }

  // keuzes die in het verslag een feit vermelden (gewestplan, watertoets, EPC, keuring, ...): bij
  // een nieuw dossier staan ze op "— kies —" en tellen ze hier per tabblad
  for (const tab of ["markt", "constructie", "installaties"]) {
    const velden = NOG_TE_KIEZEN.filter((v) => v.tab === tab
      && !(v.metGebouw && garage) && !(v.residentieelMetGebouw && (garage || !residentieel)));
    if (!velden.length) continue;
    const open = velden.filter((v) => !gevuld(d[v.k]));
    voeg(G3, tab, `Keuzes op ${TABBLADEN[tab]}`, 1, 1 - open.length / velden.length,
      `Nog niet gekozen: ${open.map((v) => v.label).join(", ")}`);
  }

  // ---- SWOT & conclusie ----
  const G4 = "SWOT & conclusie";
  const swot = [gevuld(d.sterktes), gevuld(d.zwaktes), gevuld(d.kansen), gevuld(d.bedreigingen)];
  voeg(G4, "swot", "SWOT-analyse", 3, deel(...swot),
    ["sterktes", "zwaktes", "kansen", "bedreigingen"].filter((_, i) => !swot[i]).join(", ").replace(/^./, (c) => c.toUpperCase()));
  voeg(G4, "swot", "Conclusie", 2, gevuld(d.conclusie) ? 1 : 0, "Conclusie");

  // ---- waardering ----
  const G5 = "Waardering";
  const punten = (calc && calc.controlePunten) || [];
  voeg(G5, "waardering", "Berekening volledig", 8, 1 - punten.length / 3, "");
  criteria[criteria.length - 1].punten = punten.map((t) => ({ tekst: t.replace(/^./, (c) => c.toUpperCase()), tab: tabVoorControlepunt(t) }));
  // de motivering (veld "Motivering van de afwijking") bestaat enkel als NIET de vergelijkende
  // methode gekozen is; bij de vergelijkende methode tellen de vergelijkingspunten zelf
  if (d.wijzeVanWaardering !== "Vergelijkende methode") {
    voeg(G5, "vergelijkingspunten", "Motivering van de waarderingsmethode", 2, gevuld(d.wijzeVanWaarderingMotivering) ? 1 : 0,
      "Motivering waarom niet de vergelijkende methode gebruikt werd");
  } else {
    const n = (d.vergelijkingspunten || []).filter((v) => v && v.meetellen !== false).length;
    voeg(G5, "vergelijkingspunten", "Vergelijkingspunten", 4, n / VERGELIJKINGSPUNTEN_DOEL,
      `Vergelijkingspunten: ${n} van minstens ${VERGELIJKINGSPUNTEN_DOEL} (vergelijkende methode)`);
  }

  // ---- foto's & stukken ----
  const G6 = "Foto's & stukken";
  voeg(G6, "fotos", "Voorbladfoto", 2, d.voorpaginaFoto ? 1 : 0, "Foto op het voorblad");
  const nFotos = (d.fotos || []).length;
  voeg(G6, "fotos", "Foto's in bijlage", 3, nFotos / FOTOS_DOEL, `Foto's in bijlage: ${nFotos} van minstens ${FOTOS_DOEL}`);
  voeg(G6, "documenten", "Documenten", 2, (d.documenten || []).length ? 1 : 0, garage ? "Stukken (bv. kadastrale legger, plannen)" : "Stukken (bv. kadastrale legger, EPC, plannen)");

  // ---- samenhang ----
  const G7 = "Samenhang";
  // alle panden van het dossier, niet enkel het hoofdpand (zie controlesAllePanden)
  const tegenstrijdig = calc ? controlesAllePanden(d, calc) : [];
  voeg(G7, "", "Geen tegenstrijdigheden", 6, 1 - tegenstrijdig.length / 4, "");
  criteria[criteria.length - 1].punten = tegenstrijdig.map((t) => ({ tekst: t, tab: tabUitTekst(t) }));

  // ---- totaal ----
  const max = criteria.reduce((s, c) => s + c.gewicht, 0);
  const behaald = criteria.reduce((s, c) => s + c.gewicht * c.behaald, 0);
  let score = max > 0 ? Math.round((behaald / max) * 100) : 0;
  const geblokkeerd = blokkerend.length > 0;
  if (geblokkeerd) score = Math.min(score, 49);

  // wat ontbreekt, per groep (in de volgorde hierboven), met het tabblad om het aan te vullen
  const groepen = [];
  for (const c of criteria) {
    let g = groepen.find((x) => x.naam === c.groep);
    if (!g) { g = { naam: c.groep, behaald: 0, max: 0, ontbreekt: [] }; groepen.push(g); }
    g.behaald += c.gewicht * c.behaald;
    g.max += c.gewicht;
    if (c.punten) c.punten.forEach((p) => g.ontbreekt.push({ tekst: p.tekst, tab: p.tab, gewicht: c.gewicht / Math.max(c.punten.length, 1) }));
    else if (c.behaald < 1) g.ontbreekt.push({ tekst: c.tip, tab: c.tab, gewicht: c.gewicht * (1 - c.behaald) });
  }
  groepen.forEach((g) => { g.pct = g.max > 0 ? Math.round((g.behaald / g.max) * 100) : 100; });

  // per tabblad: hoeveel criteria er gelden en hoeveel punten er nog open staan (voor de
  // voortgang in de zijbalk, zie domein/voortgang.js). De berekening controleert ook Afmetingen.
  const tabs = {};
  const tel = (tab, sleutel) => { if (!tab) return; tabs[tab] = tabs[tab] || { criteria: 0, open: 0 }; tabs[tab][sleutel]++; };
  criteria.forEach((c) => tel(c.tab, "criteria"));
  if (calc && !garage) tel("afmetingen", "criteria");
  groepen.forEach((g) => g.ontbreekt.forEach((o) => tel(o.tab, "open")));

  return {
    score, niveau: niveauVoorScore(score), geblokkeerd, blokkerend,
    groepen, aantalOntbrekend: groepen.reduce((s, g) => s + g.ontbreekt.length, 0), tabs,
  };
}
