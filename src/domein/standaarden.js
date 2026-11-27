// ----------------------------------------------------------------------------
// domein/standaarden.js — persoonlijke standaardwaarden voor een nieuw dossier
// ----------------------------------------------------------------------------
// Waarden die een schatter-expert in (bijna) elk dossier anders zet dan de algemene standaard van
// de app — bv. een gedwongen verkoopfactor van 0,80 i.p.v. 0,88, of altijd transactiekosten in de
// DCF. Hij stelt ze één keer in bij "Mijn account"; elk NIEUW dossier start daarmee (zie
// handleNew in App.jsx). Bestaande dossiers veranderen nooit, en in elk dossier blijft alles
// gewoon aan te passen.
//
// Enkel de velden hieronder kunnen een persoonlijke standaard krijgen, en elke waarde wordt bij
// het toepassen opnieuw gecontroleerd (een ongeldige of onbekende waarde wordt genegeerd) — de
// opgeslagen standaarden komen uit de databank en mogen een dossier nooit in een ongeldige
// toestand brengen. Pure functies — apart testbaar (zie __tests__/standaarden.test.js).
import { OPTS, nieuwDossierBasis } from "../constants.js";
import { normaliseerGetalInvoer } from "../lib/format.js";

// soort: getal (min/max), keuze (opties), janee (true/false), tekst (max lengte)
export const STANDAARD_VELDEN = [
  { k: "wijzeVanWaardering", groep: "Waardering", label: "Wijze van waardering", soort: "keuze", opties: () => OPTS.wijzeVanWaardering },
  { k: "gedwongenFactor", groep: "Waardering", label: "Gedwongen verkoopfactor", soort: "getal", min: 0.5, max: 1, hint: "bv. 0,80" },
  { k: "marktMargeOnderPct", groep: "Waardering", label: "Marktmarge onder (%)", soort: "getal", min: 0, max: 30 },
  { k: "marktMargeBovenPct", groep: "Waardering", label: "Marktmarge boven (%)", soort: "getal", min: 0, max: 30 },
  { k: "yieldVan", groep: "Rendement (directe kapitalisatie)", label: "Yield van (%)", soort: "getal", min: 0.1, max: 20 },
  { k: "yieldTot", groep: "Rendement (directe kapitalisatie)", label: "Yield tot (%)", soort: "getal", min: 0.1, max: 20 },
  { k: "yieldStap", groep: "Rendement (directe kapitalisatie)", label: "Yield stap (%)", soort: "getal", min: 0.05, max: 10 },
  { k: "dcfTransactiekostenActief", groep: "Rendement (directe kapitalisatie)", label: "Kosten koper toepassen", soort: "janee" },
  { k: "dcfTransactiekostenPct", groep: "Rendement (directe kapitalisatie)", label: "Kosten koper (%)", soort: "getal", min: 0, max: 30 },
  { k: "voorgevel", groep: "Beschrijving", label: "Voorgevel (zij- en achtergevel volgen)", soort: "tekst", max: 120, snelkeuze: () => OPTS.gevelmateriaal },
  { k: "hoofddakType", groep: "Beschrijving", label: "Hoofddak", soort: "keuze", opties: () => OPTS.hoofddakType },
  { k: "hoofddakMateriaal", groep: "Beschrijving", label: "Materiaal hoofddak", soort: "keuze", opties: () => OPTS.hoofddakMateriaal },
  { k: "bijgebouwConstructie", groep: "Beschrijving", label: "Constructie bijgebouw", soort: "tekst", max: 120, snelkeuze: () => OPTS.bijgebouwConstructieType },
  { k: "eedPlaats", groep: "Opdracht", label: "Plaats bij de eedformule (\"Gedaan te\")", soort: "tekst", max: 80 },
];

const VELD = Object.fromEntries(STANDAARD_VELDEN.map((v) => [v.k, v]));

// één waarde controleren en in de vorm brengen waarin het dossier ze bewaart; undefined = negeren
export function controleerStandaard(sleutel, waarde) {
  const v = VELD[sleutel];
  if (!v || waarde === undefined || waarde === null) return undefined;
  if (v.soort === "janee") return typeof waarde === "boolean" ? waarde : waarde === "true" ? true : waarde === "false" ? false : undefined;
  const tekst = String(waarde).trim();
  if (tekst === "") return undefined;
  if (v.soort === "getal") {
    const genormaliseerd = normaliseerGetalInvoer(tekst);
    const n = parseFloat(genormaliseerd);
    if (!Number.isFinite(n) || n < v.min || n > v.max) return undefined;
    return genormaliseerd;
  }
  if (v.soort === "keuze") return v.opties().includes(tekst) ? tekst : undefined;
  if (v.soort === "tekst") return tekst.length <= v.max ? tekst : undefined;
  return undefined;
}

// alleen de geldige, gekende standaarden (om op te slaan of toe te passen)
export function schoonStandaarden(standaarden) {
  const uit = {};
  if (!standaarden || typeof standaarden !== "object") return uit;
  for (const [k, w] of Object.entries(standaarden)) {
    const goed = controleerStandaard(k, w);
    if (goed !== undefined) uit[k] = goed;
  }
  return uit;
}

// een nieuw dossier met de persoonlijke standaarden; zij- en achtergevel volgen de voorgevel
export function pasStandaardenToe(dossier, standaarden) {
  const s = schoonStandaarden(standaarden);
  const uit = { ...dossier, ...s };
  if (s.voorgevel) {
    if (!String(dossier.zijgevel || "").trim()) uit.zijgevel = s.voorgevel;
    if (!String(dossier.achtergevel || "").trim()) uit.achtergevel = s.voorgevel;
  }
  return uit;
}

// de algemene standaard van de app voor een veld (om naast het invulveld te tonen)
export const appStandaard = (sleutel) => nieuwDossierBasis()[sleutel];
