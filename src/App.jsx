import React, { useState, useMemo, useRef, useEffect, createContext, useContext } from "react";
import {
  Home, MapPin, Ruler, Building2, Trees, Hammer, LineChart, ClipboardList,
  Grid3x3, Calculator, FileText, Plus, Trash2, ChevronLeft, ChevronRight,
  Check, AlertTriangle, Image as ImageIcon, Paperclip, Upload, X, Sparkles,
  Loader2, Layers, Flame, Sofa, Users, BedDouble, Camera
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// echte, permanente opslag via Supabase (zie /supabase/schema.sql voor de databasestructuur) —
// vervangt het window.storage dat enkel binnen Claude.ai bestond.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ---------- design tokens ----------
const INK = "#1B1F27";
const INK_SOFT = "#4B5160";
const PAPER = "#F6F4EF";
const PAPER_RAISED = "#FFFFFF";
const LINE = "#DDD8CA";
const BRASS = "#8C6A2F";
const BRASS_SOFT = "#F1E9D6";
const STAMP = "#2F5B4F";
const STAMP_SOFT = "#E4EEEB";
const DANGER = "#9A3B2E";

// ---------- huisstijl (branding) ----------
// Standaard "Houpels Valuation & Real Estate" (brass-kleur, geen logo-afbeelding — enkel tekst,
// zoals nu al overal in het rapport gebeurt). Gebruikers die met een @huyzen.be-e-mailadres
// inloggen krijgen automatisch de "Huyzen Vastgoed"-huisstijl (eigen kleur + logo) op de
// voorpagina en in de kop-/voettekst van het rapport — geen instelling nodig, gebaseerd op het
// e-mailadres van de ingelogde gebruiker (zie kiesHuisstijl hieronder).
const HUYZEN_BLAUW = "#0093D3";
const HUYZEN_LOGO_B64 = "data:image/png;base64,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";
const HUISSTIJLEN = {
  houpels: { key: "houpels", naam: "Houpels Valuation & Real Estate", kleur: BRASS, logo: null },
  huyzen: { key: "huyzen", naam: "Huyzen Vastgoed", kleur: HUYZEN_BLAUW, logo: HUYZEN_LOGO_B64 },
};
// bepaalt de huisstijl op basis van het e-mailadres van de ingelogde gebruiker
const kiesHuisstijl = (email) =>
  (email && String(email).toLowerCase().endsWith("@huyzen.be")) ? HUISSTIJLEN.huyzen : HUISSTIJLEN.houpels;
// laat rapport-onderdelen (zoals ReportH hieronder) de actieve huisstijl-kleur uitlezen zonder
// die als prop door elke tussenliggende component heen te moeten geven
const HuisstijlContext = createContext(HUISSTIJLEN.houpels);

// ---------- reference data (uit de aangeleverde Excel-bestanden) ----------
const KLASSEN = [
  { key: "bescheiden", label: "Bescheiden woning", basis1998: 420, type: "Woningen" },
  { key: "gewoon", label: "Gewoon huis", basis1998: 495, type: "Woningen" },
  { key: "verzorgd", label: "Verzorgd / comfortabel", basis1998: 620, type: "Woningen" },
  { key: "luxueus", label: "Luxueus", basis1998: 745, type: "Woningen" },
  { key: "gewoon_app", label: "Gewoon appartement", basis1998: 570, type: "Appartementen" },
  { key: "verzorgd_app", label: "Verzorgd appartement", basis1998: 645, type: "Appartementen" },
  { key: "luxueus_app", label: "Luxueus appartement", basis1998: 745, type: "Appartementen" },
];
const ABEX_INDEX_1998 = 475;
const GEVEL_FACTOR = { 2: 1, 3: 1.1, 4: 1.15 };

const VERDIEPINGEN = [
  { key: "gelijkvloers", label: "Gelijkvloers", defCoeff: 1 },
  { key: "1everdiep", label: "1e verdiep", defCoeff: 1 },
  { key: "2everdiep", label: "2e verdiep", defCoeff: 0.7 },
  { key: "zolder", label: "Zolder", defCoeff: 0.5 },
  { key: "garage", label: "Garage", defCoeff: 0.5 },
  { key: "berging", label: "Berging", defCoeff: 0.6 },
  { key: "tuinberging", label: "Tuinberging", defCoeff: 0.6 },
  { key: "terras", label: "Terras", defCoeff: 0.9 },
];

// ---------- dropdown-/checklistopties, exact overgenomen uit de SCHATTINGSFICHE ----------
const OPTS = {
  reden: ["Nalatenschap", "Verkoop", "Hypothecair krediet", "Echtscheiding", "Gerechtelijk", "Andere"],
  pandType: ["Woning", "Appartement", "Handelspand", "Opbrengsteigendom"],
  bouwtype: ["Open", "Halfopen", "Gesloten"],
  orientatie: ["Noord", "Noordoost", "Oost", "Zuidoost", "Zuid", "Zuidwest", "West", "Noordwest"],
  staat: ["Af te werken", "Casco (in te richten)", "Gerenoveerd", "Instapklaar", "Nieuw", "Op te frissen", "Te renoveren", "Te slopen"],
  ruwbouw: ["Traditioneel metselwerk", "Gelijmd metselwerk", "Prefab woning", "Houtskeletbouw", "Houtmassiefbouw", "Staalconstructie", "Andere"],
  hoofddakType: ["Zadeldak", "Plat dak", "Schilddak", "Mansarde", "Puntdak", "Wolfsdak", "Torendak", "Vlinderdak", "Schedddak", "Koepel", "Frans", "Gemengd", "Strodak"],
  hoofddakMateriaal: ["Pannen", "Leien", "Roofing", "EPDM", "Zink", "Koper", "Natuursteen", "Riet", "Glas", "Grindbedekking"],
  epcStatus: ["Aanwezig", "Niet aanwezig", "Aangevraagd"],
  isolatie: ["Dakisolatie", "Gevelisolatie", "Muurisolatie", "Spouwisolatie", "Spouwmuur", "Vloerplaat", "Niet bepaald"],
  buitenschrijnwerk: ["3-dubbele beglazing", "Dubbele beglazing (HR)", "Enkele beglazing", "Superisolerend HR-glas", "Veiligheidsglas", "Aluminium", "Hout", "Metaal", "PVC", "Staal", "Luiken - handmatig", "Luiken - elektrisch"],
  verwarmingSoort: ["Centrale verwarming", "Gemeenschappelijke verwarming", "Individuele verwarming", "Geen verwarming"],
  verwarmingGrondstof: ["Elektriciteit", "Gas", "Hout", "Kolen", "Pellets", "Stookolie", "Warmtepomp", "Zonnepanelen"],
  verwarmingElementen: ["Accumulatie", "Condensatieketel", "Hoogrendementsketel", "Convectoren", "(Gas)kachels", "Plafondverwarming", "Radiatoren", "Vloerverwarming", "Warme lucht", "Calorimeters", "Digitaal"],
  warmWater: ["Boiler elektrisch", "Boiler gas", "Boiler op CV", "Doorstroomsysteem op CV", "Geiser op CV", "Gasgeiser", "Hoogrendementsketel", "Warmtepomp", "Andere"],
  keuringStatus: ["Keuring aanwezig - conform", "Keuring aanwezig - niet conform", "Keuring niet aanwezig"],
  allerlei: ["Airco", "Alarm", "Parlofoon", "Rolluiken", "Luiken", "Screens", "Veiligheidsdeur", "Vliegenramen", "Vloerverwarming", "Zonwering", "Zonnepanelen", "Thuisbatterij", "Laadpaal"],
  hall: ["Alarm", "Authentieke elementen", "Gastentoilet", "Parlofoon", "Veiligheidsdeur", "Videofoon"],
  woonkamer: ["Inbouwcassette", "Open haard", "Alle comfort", "Eenvoudig", "Goed onderhouden", "Ingericht", "In te richten", "L-vorm", "Moderne afwerking", "Rustieke afwerking"],
  keuken: [
    "Alleen leidingen", "Bar-tablet", "Combi-oven", "Dampkap", "Diepvries", "Enkel kasten",
    "Koelkast", "Koelkast met vriesvak", "Koffieautomaat",
    "Kookplaat - elektrisch", "Kookplaat - gas", "Kookplaat - halogeen", "Kookplaat - inductie", "Kookplaat - keramisch",
    "Microgolfoven", "Oven - elektrisch", "Oven - gas", "Oven - stoom", "Oven - hete lucht",
    "Spoelbak enkel", "Spoelbak dubbel", "Vaatwasmachine", "Volledig ingebouwd", "Wijnklimaatkast",
    "Alle comfort", "Eenvoudig", "Goed onderhouden", "Ingericht", "In te richten",
    "Luxueuze afwerking", "Moderne afwerking", "Muren betegeld", "Open keuken", "Rustieke afwerking",
  ],
  badkamer: [
    "Aansluiting droogkast", "Aansluiting wasmachine", "Alleen leidingen", "Bidet", "Douche",
    "Hydrobad", "Inloopdouche", "Jacuzzi", "Ligbad", "Thermostatische kraan", "Toilet", "Voetbad",
    "Wastafel enkel", "Wastafel dubbel", "Wastafel in meubel enkel", "Wastafel in meubel dubbel",
    "Regendouche", "Sauna", "Wellness bad", "Zitbad",
    "Alle comfort", "Eenvoudig", "Goed onderhouden", "Muren betegeld",
  ],
  berging: ["Aansluiting droogkast", "Aansluiting wasmachine"],
  kelder: ["Aansluiting droogkast", "Aansluiting wasmachine", "Individuele private kelder", "Inpandige garage", "Deels kruipkelder", "Deels onderkelderd", "Volledige kruipkelder", "Volledig onderkelderd"],
  garage: ["Aansluiting droogkast", "Aansluiting wasmachine", "Automatische garagepoort", "Sectionele poort", "Draaideuren", "Kantelpoort", "Geïsoleerd", "Verlichting"],
  tuinTerras: ["Buitenkeuken", "Jacuzzi", "Moestuin", "Tuinhuis", "Vijver", "Zandbak", "Zwembad"],
  aanbod: ["Nihil", "Sporadisch", "Normaal", "Ruim"],
  kwaliteit: ["Zeer goed", "Goed", "Matig", "Slecht"],
  gewestplan: ["Woongebied", "Woonuitbreidingsgebied", "Agrarisch gebied", "Industriegebied", "Andere"],
  jaNee: ["Ja", "Nee", "Onbekend"],
  score: ["A", "B", "C", "D"],
  klasse: KLASSEN.map((k) => k.label),
  recht: ["Volle eigendom", "Vruchtgebruik", "Naakte eigendom", "Erfpacht", "Opstalrecht", "Andere"],
  hoogteligging: ["Gelijk met straatniveau", "Verhoogd t.o.v. straat", "Verlaagd t.o.v. straat"],
  wijzeVanWaardering: ["Vergelijkende methode", "Analytische methode", "Redelijke methode"],
  aardTransactie: ["Verkoop uit de hand", "Vrijwillige openbare verkoop", "Gedwongen openbare verkoop", "Gerechtelijke verkoop"],
  huurcontractType: ["Woninghuur 9 jaar", "Woninghuur korte duur", "Handelshuur", "Andere"],
  fotoCategorie: ["Voorgevel", "Zijgevel", "Achtergevel", "Tuin", "Interieur", "Liggingsplan", "Situeringsplan", "Schets indeling", "Andere"],
  omgevingsvoorzieningen: ["Winkels/handelszaken", "Scholen", "Kinderdagverblijf", "Bank/postkantoor", "Apotheek", "Ziekenhuis", "Bejaardentehuis", "Administratie/gemeentehuis", "Horeca", "Groene ruimte/park", "Sportfaciliteiten"],
  bereikbaarheid: ["Vlot bereikbaar met de wagen", "Nabij openbaar vervoer (bus)", "Nabij openbaar vervoer (trein)", "Nabij op-/afrit autosnelweg", "Fietsvriendelijke omgeving", "Beperkte parkeermogelijkheden", "Rustige, verkeersluwe straat"],
};

const RUIMTE_CHECKLISTS = [
  { key: "hall", label: "Hall", icon: Sofa, opts: OPTS.hall },
  { key: "woonkamer", label: "Woonkamer", icon: Sofa, opts: OPTS.woonkamer },
  { key: "keuken", label: "Keuken", icon: Sofa, opts: OPTS.keuken, extraText: { key: "merken", placeholder: "Merken van de toestellen (bv. Bosch, Miele, AEG)..." } },
  { key: "badkamer", label: "Badkamer", icon: Sofa, opts: OPTS.badkamer },
  { key: "berging", label: "Berging", icon: Sofa, opts: OPTS.berging, extraText: { key: "andere", placeholder: "Andere..." } },
  { key: "kelder", label: "Kelder", icon: Sofa, opts: OPTS.kelder, extraText: { key: "andere", placeholder: "Andere..." } },
  { key: "garage", label: "Garage / box / carport / oprit / staanplaats", icon: Sofa, opts: OPTS.garage, extraNumber: { key: "aantal", label: "Aantal" } },
  { key: "tuinTerras", label: "Tuin / terras", icon: Trees, opts: OPTS.tuinTerras, extraSelect: { key: "orientatie", label: "Oriëntatie", opts: OPTS.orientatie } },
];

const emptyRoomState = () => Object.fromEntries(RUIMTE_CHECKLISTS.map((r) => [
  r.key, { vloer: "", items: [], andere: "", merken: "", aantal: "", orientatie: "" },
]));

const initialData = {
  // dossierbeheer
  id: "", ownerId: "", status: "concept", aangemaaktOp: "", laatstBewerkt: "",

  // 1. identificatie schatter-expert (Vlabel-vereiste)
  schatterNaam: "Thijs Houpels", schatterTitel: "Vastgoedmakelaar - Vlabel-erkend schatter", schatterVlabelNummer: "",

  // 1. contactgegevens verkoper + opdracht
  opdrachtgeverNaam: "", opdrachtgeverAdres: "", opdrachtgeverIdNummer: "", opdrachtgeverVertegenwoordiger: "",
  reden: "Nalatenschap",
  // "zelfde als"-vlaggen: zo moet je naam/adres niet meermaals intypen als opdrachtgever, verkoper
  // en/of eigenaar dezelfde persoon zijn, of het pandadres ook het adres van opdrachtgever/verkoper is
  opdrachtgeverIsEigenaar: false, opdrachtgeverAdresZelfde: false, verkoperAdresZelfde: false,
  verkoperNaam: "", verkoperAdres: "", verkoperTelefoon: "", verkoperEmail: "",
  datumBezoek: "", datumVerslag: "", opdrachtgeverAanwezig: "Ja",
  referentiedatum: "",
  straat: "", nummer: "", bus: "", postcode: "", gemeente: "", dorpGehucht: "", crabGegevens: "", capakey: "",
  // optionele voorpagina-foto (Street View-opname of eigen foto ter plaatse) — apart van de
  // bijlage-foto's hieronder, enkel gebruikt op de cover-pagina van het verslag
  voorpaginaFoto: null,

  // 2. type onroerend goed
  pandType: "Woning", aardWoning: "", bouwtype: "Gesloten", verdiepingen: "", lift: "Nee",
  bouwjaar: "", renovatiejaar: "", jaarVanAankoop: "", staat: [],

  // 3. kadastrale gegevens
  kadAfdeling: "", kadSectie: "", kadPerceelnummer: "", kadPartitienummer: "",
  kadastraleOpp: "", kadDetailPrivatief: "",
  ki: "", onroerendeVoorheffing: "",

  // 3b. eigendomstoestand / zakelijke rechten
  eigenaars: [{ id: 1, naam: "", recht: "Volle eigendom", aandeel: "" }],
  aankoopAkteType: "", aankoopAkteDatum: "", basisAkteDatum: "", erfdienstbaarheden: "", zakelijkeRechten: "",

  // 4. algemene beschrijving — ligging & omgeving
  omgevingsvoorzieningen: "", bereikbaarheid: "",
  vormPerceel: "", rooilijnbreedte: "", hoogteligging: "Gelijk met straatniveau",
  bodemoccupatie: "", aantalBijgebouwen: "", inplanting: "", bpaRupVerkaveling: "",

  // 5-6. constructie ruwbouw & dak
  ruwbouw: "Traditioneel metselwerk", ruwbouwAndere: "",
  hoofddakType: "Zadeldak", hoofddakMateriaal: "Pannen", bijgebouwConstructie: "",
  voorgevel: "", zijgevel: "", achtergevel: "", materiaalkwaliteitOmschrijving: "",

  // 7. isolatie
  epcStatus: "Aanwezig", epcWaarde: "", epcCertificaatnummer: "", isolatie: [],

  // 8. buitenschrijnwerk
  buitenschrijnwerk: [],

  // 9-10. verwarming & warm water
  verwarmingSoort: [], verwarmingGrondstof: [], verwarmingElementen: [], ketelMerkType: "",
  warmWater: [], warmWaterAndere: "", warmWaterKetelMerkType: "",

  // 11. technische installaties
  keuringStatus: "Keuring aanwezig - conform", dagNachtTeller: "Nee", allerlei: [],

  // 12. eigenschappen per ruimte
  eigenschappen: emptyRoomState(),
  slaapkamers: [{ id: 1, naam: "Slaapkamer 1", vloer: "", verdieping: "", ingemaaktKasten: "Nee" }],
  extraRuimtes: [],

  // 13. verbouwingen
  verbouwingen: "",

  // 14. huurder
  huurderNaam: "", huurderTelefoon: "", huurderEmail: "", huurderHuurprijs: "",
  huurderContractType: "Woninghuur 9 jaar", huurderDuurtijd: "",

  // 15. afmetingen
  grondopp: "", breedtePerceel: "", breedteGevel: "", orientatie: "Zuid",
  bebouwdeOpp: "", bewoonbareOppSchatting: "",

  // gebouw (algemeen, blijft nodig voor waardering/rapport)
  bewoonbaarheid: "Zeer goed", gebruik: "Normaal", klasse: "Gewoon huis", gevel: "2-gevel",
  nutsvoorzieningen: [],
  afwerkingBuiten: "Aangelegd",

  // markt & stedenbouw
  aanbodTeKoop: "Sporadisch", aanbodTeHuur: "Nihil",
  verkoopbaarheid: "Goed", uitzicht: "Goed", onderhoud: "Goed", inrichting: "Goed",
  gewestplan: "Woongebied", erfgoed: "Nee", voorkooprecht: "Nee",
  watertoetsP: "A", watertoetsG: "A", bouwmisdrijven: "Nee", vergunning: "Ja",
  verkaveling: "Ja", mobiscore: "",

  // swot
  sterktes: "", zwaktes: "", kansen: "", bedreigingen: "", conclusie: "", notities: "",

  // bijlagen
  fotos: [], documenten: [],

  // wijze van waardering & vergelijkingspunten
  wijzeVanWaardering: "Vergelijkende methode", wijzeVanWaarderingMotivering: "",
  vergelijkingspunten: [],

  // eedformule / ondertekening
  eedPlaats: "Beveren",

  // 16. indeling / oppervlaktes (rekenmodule)
  ruimtes: [{ id: 1, verdieping: "gelijkvloers", naam: "Leefruimte", opp: "", coeff: 1, vloer: "" }],
  schijven: [
    { id: 1, naam: "Eerste 50 meter", opp: "", prijs: "" },
    { id: 2, naam: "Van 50 tot 75 meter", opp: "", prijs: "" },
    { id: 3, naam: "Van 75 tot 100 meter", opp: "", prijs: "" },
  ],

  // waardering
  abexIndexHuidig: 1056,
  vetOuderdom: 15, vetFrequentie: 20, vetGebruik: 20, vetKwaliteit: 20,
  huurMaand: "", yieldVan: 3.5, yieldTot: 4.5, yieldStap: 0.5,
  gedwongenFactor: 0.88, venaleWaarde: "",
};

// ---------- helpers ----------
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const eur = (v) => v.toLocaleString("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = (v) => `${v.toFixed(2).replace(".", ",")}%`;
// zet een datum om van het ISO-formaat van <input type="date"> (JJJJ-MM-DD) naar de Vlaamse
// notatie (DD/MM/JJJJ) — enkel voor weergave in het rapport, het onderliggende veld blijft ISO.
const nlDate = (v) => {
  if (!v) return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
};
const uid = () => Math.random().toString(36).slice(2, 9);

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

// ---------- persistente opslag (Supabase, gedeeld tussen makelaars, elk dossier gekoppeld aan een ownerId) ----------
// vervangt het vroegere window.storage (dat enkel binnen Claude.ai werkte) 1-op-1 door
// echte databaseaanroepen — zie /supabase/schema.sql voor de tabellen en toegangsregels.

// een geldige uuid nodig voor id's die in de database terechtkomen (dossiers.id); de korte
// uid() hieronder blijft gebruikt voor interne rij-id's binnen een dossier (kamers, eigenaars, ...)
// die nooit als een eigen databasekolom bestaan.
const nieuweDossierId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : uid();

async function login(email, wachtwoord) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: wachtwoord });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "Ongeldig e-mailadres of wachtwoord." : error.message);
  return data.user;
}

async function registreer(email, wachtwoord, naam) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: wachtwoord,
    options: { data: { naam } }, // komt terecht in de profielen-tabel via de databasetrigger
  });
  if (error) throw new Error(error.message);
  return data; // { user, session } — session is leeg als e-mailbevestiging vereist is
}

async function uitloggen() {
  await supabase.auth.signOut();
}

// bij het opstarten van de app: is er nog een actieve sessie? (Supabase houdt dit zelf bij,
// ook na een paginaherlaad, dus hier is geen eigen timeout/fallback-logica meer nodig)
async function haalHuidigeGebruiker() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

async function haalProfielNaam(userId, fallback) {
  try {
    const { data, error } = await supabase.from("profielen").select("naam").eq("id", userId).single();
    if (error || !data?.naam) return fallback;
    return data.naam;
  } catch (e) {
    return fallback;
  }
}

async function loadIndex() {
  const { data, error } = await supabase
    .from("dossiers")
    .select("id, owner_id, straat, nummer, bus, postcode, gemeente, status, aangemaakt_op, laatst_bewerkt")
    .order("laatst_bewerkt", { ascending: false });
  if (error) { console.error(error); return []; }
  // veldnamen omzetten naar wat de React-componenten al verwachten (camelCase)
  return data.map((x) => ({
    id: x.id, ownerId: x.owner_id, straat: x.straat, nummer: x.nummer, bus: x.bus,
    postcode: x.postcode, gemeente: x.gemeente, status: x.status,
    aangemaaktOp: x.aangemaakt_op, laatstBewerkt: x.laatst_bewerkt,
  }));
}

async function loadDossier(id) {
  const { data, error } = await supabase.from("dossiers").select("*").eq("id", id).single();
  if (error) { console.error(error); return null; }
  // "data.data" bevat de volledige dossier-JSON (alle overige velden) — dat komt overeen
  // met wat het vroegere dossier_<id>-object in window.storage was
  return { ...data.data, id: data.id, ownerId: data.owner_id, status: data.status };
}

async function saveDossier(dossier, index, setIndex) {
  // de tijdelijke blob-url (url) kan niet persisteren over sessies heen en wordt dus niet
  // bewaard — de base64-data (verkleind bij het opladen) blijft wél bewaard, want zonder die
  // data verdwijnen de foto's definitief uit zowel de app-voorbeelden als het rapport zodra een
  // dossier wordt opgeslagen en later heropend. Foto's/documenten blijven, net als vroeger, als
  // base64 in de dossier-JSON zelf bewaard (in plaats van in Supabase Storage) — zo blijft de
  // PDF-export code hieronder ongewijzigd werken en is er geen aparte upload-stap nodig.
  const { id, ownerId, straat, nummer, bus, postcode, gemeente, status, aangemaaktOp, fotos, documenten, voorpaginaFoto, ...rest } = dossier;
  const payload = {
    ...rest,
    fotos: (fotos || []).map(({ url, ...r }) => r),
    documenten: (documenten || []).map(({ base64, ...r }) => r),
    voorpaginaFoto: voorpaginaFoto ? (({ url, ...r }) => r)(voorpaginaFoto) : null,
  };
  const { error } = await supabase.from("dossiers").upsert({
    id,
    owner_id: ownerId,
    straat: straat || "",
    nummer: nummer || "",
    bus: bus || "",
    postcode: postcode || "",
    gemeente: gemeente || "",
    status: status || "concept",
    aangemaakt_op: aangemaaktOp,
    data: payload,
  });
  if (error) { console.error("Opslaan mislukt:", error.message); return; }
  const meta = {
    id, ownerId, straat, nummer, bus, postcode, gemeente, status,
    aangemaaktOp, laatstBewerkt: new Date().toISOString(),
  };
  const next = index.some((x) => x.id === meta.id) ? index.map((x) => (x.id === meta.id ? meta : x)) : [...index, meta];
  setIndex(next);
}
async function deleteDossier(id, index, setIndex) {
  const { error } = await supabase.from("dossiers").delete().eq("id", id);
  if (error) console.error("Verwijderen mislukt:", error.message);
  const next = index.filter((x) => x.id !== id);
  setIndex(next);
}

// bouwt een tekstsamenvatting van alle ingevulde tabbladen, gebruikt als context voor de AI-SWOT
function buildPropertySummary(d) {
  const eig = d.eigenschappen;
  const lines = [
    `Adres: ${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`,
    `Type: ${d.pandType}, bouwtype: ${d.bouwtype}, klasse: ${d.klasse}, bouwjaar: ${d.bouwjaar || "onbekend"}`,
    `Staat: ${d.staat.join(", ") || "onbekend"}`,
    `Oriëntatie: ${d.orientatie}, breedte gevel: ${d.breedteGevel || "?"} m, grondoppervlakte: ${d.grondopp || "?"} m², bewoonbare opp.: ${d.bewoonbareOppSchatting || "?"} m²`,
    `Ruwbouw: ${d.ruwbouw}${d.ruwbouwAndere ? " (" + d.ruwbouwAndere + ")" : ""}, dak: ${d.hoofddakType} in ${d.hoofddakMateriaal}`,
    `EPC: ${d.epcStatus}${d.epcWaarde ? ", " + d.epcWaarde + " kWh/m²" : ""}`,
    `Isolatie: ${d.isolatie.join(", ") || "niet bepaald"}`,
    `Buitenschrijnwerk: ${d.buitenschrijnwerk.join(", ") || "onbekend"}`,
    `Verwarming: ${d.verwarmingSoort.join(", ") || "onbekend"} op ${d.verwarmingGrondstof.join(", ") || "onbekend"}`,
    `Elektrische keuring: ${d.keuringStatus}`,
    `Overige uitrusting: ${d.allerlei.join(", ") || "geen bijzondere"}`,
    `Aantal slaapkamers: ${d.slaapkamers.length}`,
    `Keuken: ${eig.keuken.items.join(", ") || "niet gespecificeerd"}`,
    `Badkamer: ${eig.badkamer.items.join(", ") || "niet gespecificeerd"}`,
    `Tuin/terras: ${eig.tuinTerras.items.join(", ") || "geen"}${eig.tuinTerras.orientatie ? ", oriëntatie " + eig.tuinTerras.orientatie : ""}`,
    `Andere ruimtes: ${(d.extraRuimtes || []).filter((r) => r.naam).map((r) => r.naam).join(", ") || "geen"}`,
    `Verbouwingen/renovaties: ${d.verbouwingen || "geen vermeld"}`,
    `Markt — aanbod te koop: ${d.aanbodTeKoop}, verkoopbaarheid: ${d.verkoopbaarheid}`,
    `Stedenbouw — gewestplan: ${d.gewestplan}, erfgoed: ${d.erfgoed}, voorkooprecht: ${d.voorkooprecht}, vergunning: ${d.vergunning}`,
    `Mobiscore: ${d.mobiscore || "onbekend"}`,
    `Eigendomstoestand: ${d.eigenaars.filter((e) => e.naam).map((e) => `${e.naam} (${e.recht}${e.aandeel ? ", " + e.aandeel : ""})`).join("; ") || "onbekend"}`,
    `Wijze van waardering: ${d.wijzeVanWaardering}${d.wijzeVanWaarderingMotivering ? " — " + d.wijzeVanWaarderingMotivering : ""}`,
    `Aantal vergelijkingspunten: ${d.vergelijkingspunten.length}`,
  ];
  const docNotes = d.documenten.filter((doc) => doc.notities?.trim()).map((doc) => `- ${doc.naam}: ${doc.notities.trim()}`);
  if (docNotes.length) {
    lines.push("Juridische / administratieve documenten (kernpunten):");
    lines.push(...docNotes);
  }
  return lines.join("\n");
}

// volledig lokale, regelgebaseerde SWOT-generator — vangnet als de AI-aanroep faalt.
function genereerAutomatischeSwot(d) {
  const eig = d.eigenschappen;
  const sterktes = [];
  const zwaktes = [];
  const kansen = [];
  const bedreigingen = [];

  // staat van het pand
  if (d.staat.includes("Instapklaar")) sterktes.push("Pand is instapklaar.");
  if (d.staat.includes("Gerenoveerd")) sterktes.push("Pand werd reeds gerenoveerd.");
  if (d.staat.includes("Nieuw")) sterktes.push("Nieuwbouwwoning.");
  if (d.staat.includes("Te renoveren")) { zwaktes.push("Pand is te renoveren."); kansen.push("Renovatiepotentieel naar eigen wens en smaak."); }
  if (d.staat.includes("Op te frissen")) zwaktes.push("Pand is op te frissen.");
  if (d.staat.includes("Casco (in te richten)")) { zwaktes.push("Pand is casco en dient volledig ingericht te worden."); kansen.push("Volledige vrijheid bij de inrichting."); }
  if (d.staat.includes("Af te werken")) zwaktes.push("Afwerking van het pand is nog niet voltooid.");
  if (d.staat.includes("Te slopen")) { zwaktes.push("Bestaande opstal is te slopen."); kansen.push("Perceel biedt herbouwmogelijkheden."); }

  // EPC / energie
  if (d.epcStatus === "Aanwezig" && d.epcWaarde) {
    const epc = num(d.epcWaarde);
    if (epc > 0 && epc <= 200) sterktes.push(`Gunstig EPC-label (${d.epcWaarde} kWh/m²).`);
    else if (epc > 400) zwaktes.push(`Hoog energieverbruik volgens EPC (${d.epcWaarde} kWh/m²) — renovatie aan te raden.`);
  }
  if (d.epcStatus === "Niet aanwezig") zwaktes.push("Geen geldig EPC-certificaat beschikbaar.");
  if (d.isolatie.length >= 3 && !d.isolatie.includes("Niet bepaald")) sterktes.push(`Goed geïsoleerd (${d.isolatie.join(", ").toLowerCase()}).`);
  if (d.isolatie.includes("Niet bepaald") || d.isolatie.length === 0) zwaktes.push("Isolatiegraad onbekend of niet bepaald.");
  if (d.verwarmingGrondstof.includes("Warmtepomp")) sterktes.push("Energiezuinige verwarming via warmtepomp.");
  if (d.allerlei.includes("Zonnepanelen")) sterktes.push("Voorzien van zonnepanelen.");
  if (!d.allerlei.includes("Zonnepanelen")) kansen.push("Mogelijkheid tot plaatsing van zonnepanelen.");

  // elektriciteit
  if (d.keuringStatus === "Keuring aanwezig - conform") sterktes.push("Elektrische installatie conform gekeurd.");
  if (d.keuringStatus === "Keuring aanwezig - niet conform") zwaktes.push("Elektrische installatie niet conform bevonden bij keuring.");
  if (d.keuringStatus === "Keuring niet aanwezig") zwaktes.push("Geen keuring van de elektrische installatie beschikbaar.");

  // buitenschrijnwerk
  if (d.buitenschrijnwerk.some((b) => b.includes("HR") || b.includes("3-dubbele"))) sterktes.push("Hoogrendementsbeglazing aanwezig.");
  if (d.buitenschrijnwerk.includes("Enkele beglazing")) zwaktes.push("Enkele beglazing aanwezig — energieverlies.");

  // ruimtes
  if (d.slaapkamers.length >= 3) sterktes.push(`Ruim aantal slaapkamers (${d.slaapkamers.length}) — geschikt voor gezinnen.`);
  if (eig.keuken.items.includes("Volledig ingebouwd")) sterktes.push("Volledig ingebouwde keuken.");
  if (eig.tuinTerras.items.length > 0) sterktes.push(`Aangename buitenruimte (${eig.tuinTerras.items.join(", ").toLowerCase()}).`);
  if (eig.garage.items.length > 0 || num(eig.garage.aantal) > 0) sterktes.push("Garage/parkeergelegenheid aanwezig.");
  if (!eig.garage.items.length && !num(eig.garage.aantal)) kansen.push("Mogelijkheid tot aanleg van bijkomende parkeergelegenheid.");

  // ligging & bereikbaarheid
  if (d.mobiscore && num(d.mobiscore) >= 7) sterktes.push(`Uitstekende mobiscore (${d.mobiscore}/10) — vlot bereikbaar te voet/fiets/OV.`);
  if (d.mobiscore && num(d.mobiscore) < 4) zwaktes.push(`Beperkte mobiscore (${d.mobiscore}/10) — minder vlot bereikbaar zonder wagen.`);
  if (d.omgevingsvoorzieningen) sterktes.push("Goede nabijheid van voorzieningen in de omgeving.");

  // markt
  if (d.aanbodTeKoop === "Nihil" || d.aanbodTeKoop === "Sporadisch") sterktes.push("Beperkt aanbod van vergelijkbare panden in de omgeving.");
  if (d.aanbodTeKoop === "Ruim") bedreigingen.push("Ruim aanbod van vergelijkbare panden kan de verkoopbaarheid beïnvloeden.");
  if (d.verkoopbaarheid === "Zeer goed" || d.verkoopbaarheid === "Goed") sterktes.push("Goede verkoopbaarheid van het pand.");
  if (d.verkoopbaarheid === "Matig" || d.verkoopbaarheid === "Slecht") zwaktes.push("Beperkte verkoopbaarheid van het pand.");

  // stedenbouw & juridisch
  if (d.gewestplan === "Woonuitbreidingsgebied") kansen.push("Ligging in woonuitbreidingsgebied biedt mogelijke ontwikkelingskansen.");
  if (d.erfgoed === "Ja") bedreigingen.push("Erfgoedstatus kan verbouwings- of renovatiemogelijkheden beperken.");
  if (d.voorkooprecht === "Ja") bedreigingen.push("Voorkooprecht van toepassing — kan het verkoopproces beïnvloeden.");
  if (d.bouwmisdrijven === "Ja") bedreigingen.push("Mogelijke bouwovertreding vastgesteld op het perceel.");
  if (d.vergunning === "Nee") bedreigingen.push("Geen stedenbouwkundige vergunning teruggevonden voor het pand.");
  if (["C", "D"].includes(d.watertoetsP) || ["C", "D"].includes(d.watertoetsG)) bedreigingen.push("Verhoogd overstromingsrisico volgens de watertoets.");
  if (d.watertoetsP === "A" && d.watertoetsG === "A") sterktes.push("Geen overstromingsrisico volgens de watertoets.");

  // grond
  if (num(d.grondopp) > 0 && num(d.bebouwdeOpp) > 0 && num(d.grondopp) > num(d.bebouwdeOpp) * 3) {
    kansen.push("Ruim perceel ten opzichte van de bebouwde oppervlakte — mogelijke uitbreidings- of verkavelingskansen.");
  }

  // documentnotities
  const docNotes = d.documenten.filter((doc) => doc.notities?.trim());
  if (docNotes.length) {
    bedreigingen.push(`Bijzondere aandachtspunten uit de opgeladen documenten: ${docNotes.map((doc) => doc.notities.trim().split(/[.\n]/)[0]).join("; ")}.`);
  }

  return { sterktes, zwaktes, kansen, bedreigingen };
}

// haalt het antwoord op als ruwe tekst en parset die zelf — zo kunnen we bij een parseerfout
// altijd de werkelijke inhoud van het antwoord tonen, in plaats van een lege foutmelding.
// Loopt via /api/claude (zie api/claude.js) in plaats van rechtstreeks naar Anthropic: die
// serverless functie voegt de geheime ANTHROPIC_API_KEY toe, die nooit in de browser mag staan.
async function fetchClaudeJson(body, attempt = 1) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const raw = await response.text();

  // een status 200 met een écht leeg antwoord wijst op een tijdelijke hapering in het netwerk
  // (niet op een fout in de aanvraag) — dat proberen we automatisch één keer opnieuw.
  if (!raw && attempt < 3) {
    await new Promise((r) => setTimeout(r, 600 * attempt));
    return fetchClaudeJson(body, attempt + 1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Server gaf geen geldige JSON terug (status ${response.status}) na ${attempt} poging(en): ${raw.slice(0, 300) || "(leeg antwoord)"}`);
  }
  if (!response.ok || data.type === "error") {
    const detail = data?.error?.message || data?.error?.type || JSON.stringify(data).slice(0, 300);
    throw new Error(`${detail} (status ${response.status})`);
  }
  return data;
}

async function callClaudeWithSearch(prompt) {
  const data = await fetchClaudeJson({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
  });
  const text = (data.content || []).map((b) => b.text || "").join("\n");
  return text.replace(/```json|```/g, "").trim();
}

// haalt een JSON-object uit de AI-tekst, ook als er (ondanks instructie) nog wat proza omheen staat
function extractJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { /* val door */ }
    }
    throw new Error("Kon het AI-antwoord niet verwerken");
  }
}

// laadt één document tijdelijk op naar de private Supabase Storage-bucket "dossier-bijlagen"
// en geeft er een kortlevende signed URL van terug. Nodig omdat een PDF rechtstreeks als
// base64 meesturen in de AI-aanvraag tegen Vercel's vaste limiet van 4,5MB per aanvraag
// aanloopt (FUNCTION_PAYLOAD_TOO_LARGE) — de serverless functie haalt het document zelf op
// via die URL, wat niet onder diezelfde inkomende-aanvraaglimiet valt.
async function uploadDocVoorAnalyse(doc, dossierId) {
  // base64 kan door de dataURL-omzetting soms newlines/witruimte bevatten — die strippen we eerst.
  const schoneBase64 = (doc.base64 || "").replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(schoneBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: doc.mediaType || "application/pdf" });
  const pad = `${dossierId || "onbekend"}/ai-analyse/${Date.now()}-${uid()}.pdf`;
  const { error: upErr } = await supabase.storage.from("dossier-bijlagen").upload(pad, blob, {
    contentType: doc.mediaType || "application/pdf",
    upsert: true,
  });
  if (upErr) throw new Error(`Kon document niet tijdelijk opladen: ${upErr.message}`);
  const { data: signed, error: signErr } = await supabase.storage.from("dossier-bijlagen").createSignedUrl(pad, 120);
  if (signErr) throw new Error(`Kon geen tijdelijke link maken: ${signErr.message}`);
  return { url: signed.signedUrl, mediaType: doc.mediaType || "application/pdf", pad };
}

// stuurt de opgeladen PDF's als bijlage mee naar Claude, via een tijdelijke Storage-link
// (zie uploadDocVoorAnalyse hierboven) in plaats van rechtstreeks als base64 in de aanvraag
async function callClaudeWithDocs(pdfDocs, promptText, dossierId) {
  const uploads = await Promise.all(pdfDocs.map((doc) => uploadDocVoorAnalyse(doc, dossierId)));
  let data;
  try {
    data = await fetchClaudeJson({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      documentUrls: uploads.map(({ url, mediaType }) => ({ url, mediaType })),
      promptText,
    });
  } finally {
    // opruimen: dit zijn enkel tijdelijke bestanden om de 4,5MB-aanvraaglimiet te omzeilen
    supabase.storage.from("dossier-bijlagen").remove(uploads.map((u) => u.pad)).catch(() => {});
  }
  const text = (data.content || []).map((b) => b.text || "").join("\n");
  return text.replace(/```json|```/g, "").trim();
}

function useCalc(d) {
  return useMemo(() => {
    const ruimteRows = d.ruimtes.map((r) => ({ ...r, oppNaCoeff: num(r.opp) * num(r.coeff) }));
    const totOpp = ruimteRows.reduce((s, r) => s + num(r.opp), 0);
    const totOppNaCoeff = ruimteRows.reduce((s, r) => s + r.oppNaCoeff, 0);
    const ratio = totOpp > 0 ? totOppNaCoeff / totOpp : 0;

    const klasseObj = KLASSEN.find((k) => k.label === d.klasse) || KLASSEN[0];
    const gevelN = parseInt(d.gevel) || 2;
    const gevelFactor = GEVEL_FACTOR[gevelN] || 1;
    const abexPerM2 = (klasseObj.basis1998 * gevelFactor) / ABEX_INDEX_1998 * num(d.abexIndexHuidig);
    const nieuwbouwwaarde = abexPerM2 * totOppNaCoeff;

    const gemVetusiteit = (num(d.vetOuderdom) + num(d.vetFrequentie) + num(d.vetGebruik) + num(d.vetKwaliteit)) / 4;
    const actueleWaardeGebouw = nieuwbouwwaarde * (1 - gemVetusiteit / 100);

    const grondwaarde = d.schijven.reduce((s, sc) => s + num(sc.opp) * num(sc.prijs), 0);
    const totaleGrondopp = d.schijven.reduce((s, sc) => s + num(sc.opp), 0);

    const intrinsiek = actueleWaardeGebouw + grondwaarde;
    const marktOnder = intrinsiek * 0.95;
    const marktBoven = intrinsiek * 1.05;

    const yieldRows = [];
    const jaarhuur = num(d.huurMaand) * 10; // conform Excel: "Jaarlijkse huurprijs (10m huur)"
    const van = num(d.yieldVan), tot = num(d.yieldTot), stap = num(d.yieldStap) || 0.5;
    if (van > 0 && tot >= van && jaarhuur > 0) {
      for (let y = van; y <= tot + 1e-9; y += stap) {
        yieldRows.push({ yield: y, waarde: jaarhuur / (y / 100) });
      }
    }
    const dcfWaarde = yieldRows.length ? yieldRows.reduce((s, r) => s + r.waarde, 0) / yieldRows.length : 0;
    const gedwongenVerkoop = dcfWaarde * num(d.gedwongenFactor);

    const venaleWaarde = d.venaleWaarde !== "" ? num(d.venaleWaarde) : intrinsiek;

    const oppCheck = totOpp > 0 && num(d.grondopp) >= 0;

    return {
      ruimteRows, totOpp, totOppNaCoeff, ratio,
      klasseObj, gevelFactor, abexPerM2, nieuwbouwwaarde,
      gemVetusiteit, actueleWaardeGebouw,
      grondwaarde, totaleGrondopp, intrinsiek, marktOnder, marktBoven,
      yieldRows, jaarhuur, dcfWaarde, gedwongenVerkoop, venaleWaarde, oppCheck,
    };
  }, [d]);
}

// ---------- generic field components ----------
function Field({ label, children, hint, full }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>{label}</span>
      {children}
      {hint && <span className="block text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.75 }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  border: `1px solid ${LINE}`, borderRadius: 6, padding: "8px 10px", fontSize: 14,
  width: "100%", background: PAPER_RAISED, color: INK, outline: "none",
};

function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function Select({ options, ...props }) {
  return (
    <select {...props} style={{ ...inputStyle, ...(props.style || {}) }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
function MultiCheck({ options, values, onChange }) {
  const toggle = (o) => {
    const has = values.includes(o);
    onChange(has ? values.filter((v) => v !== o) : [...values, o]);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = values.includes(o);
        return (
          <button type="button" key={o} onClick={() => toggle(o)}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={{
              border: `1px solid ${active ? BRASS : LINE}`,
              background: active ? BRASS_SOFT : PAPER_RAISED,
              color: active ? BRASS : INK_SOFT, fontWeight: 500,
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer select-none mb-1"
      style={{ color: checked ? BRASS : INK_SOFT, fontWeight: 500 }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 14, height: 14, accentColor: BRASS }} />
      {label}
    </label>
  );
}

// ---------- step: SectionCard wrapper ----------
function Section({ title, icon: Icon, children }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} style={{ color: BRASS }} />
        <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function DossierWizard({ initialDossier, onBack, onSave, huisstijl }) {
  const [d, setD] = useState(initialDossier);
  const [step, setStep] = useState(0);
  const calc = useCalc(d);

  // debounced auto-opslaan bij elke wijziging
  useEffect(() => {
    const t = setTimeout(() => { onSave(d); }, 900);
    return () => clearTimeout(t);
  }, [d]);

  const set = (key) => (e) => {
    const val = e && e.target ? e.target.value : e;
    setD((prev) => ({ ...prev, [key]: val }));
  };
  const setEig = (roomKey, field, val) => setD((p) => ({
    ...p, eigenschappen: { ...p.eigenschappen, [roomKey]: { ...p.eigenschappen[roomKey], [field]: val } },
  }));

  const steps = [
    { key: "documenten", label: "Documenten (start hier)", icon: Paperclip },
    { key: "opdracht", label: "Opdracht & partijen", icon: Users },
    { key: "ligging", label: "Ligging & omgeving", icon: MapPin },
    { key: "type", label: "Type, staat & kadaster", icon: Building2 },
    { key: "constructie", label: "Constructie & isolatie", icon: Layers },
    { key: "installaties", label: "Verwarming & installaties", icon: Flame },
    { key: "ruimtes-eig", label: "Ruimte-eigenschappen", icon: Sofa },
    { key: "markt", label: "Markt, stedenbouw & juridisch", icon: LineChart },
    { key: "swot", label: "SWOT-analyse", icon: ClipboardList },
    { key: "afmetingen", label: "Afmetingen & indeling", icon: Grid3x3 },
    { key: "vergelijkingspunten", label: "Vergelijkingspunten", icon: Ruler },
    { key: "waardering", label: "Waardering", icon: Calculator },
    { key: "fotos", label: "Foto's (bijlage)", icon: ImageIcon },
    { key: "rapport", label: "Rapport", icon: FileText },
  ];

  const addRuimte = () => setD((p) => ({
    ...p, ruimtes: [...p.ruimtes, { id: uid(), verdieping: "gelijkvloers", naam: "", opp: "", coeff: 1, vloer: "" }],
  }));
  const removeRuimte = (id) => setD((p) => ({ ...p, ruimtes: p.ruimtes.filter((r) => r.id !== id) }));
  const updateRuimte = (id, key, val) => setD((p) => ({
    ...p, ruimtes: p.ruimtes.map((r) => r.id === id ? { ...r, [key]: val } : r),
  }));

  const addSchijf = (naam = "") => setD((p) => ({
    ...p, schijven: [...p.schijven, { id: uid(), naam, opp: "", prijs: "" }],
  }));
  const removeSchijf = (id) => setD((p) => ({ ...p, schijven: p.schijven.filter((s) => s.id !== id) }));
  const updateSchijf = (id, key, val) => setD((p) => ({
    ...p, schijven: p.schijven.map((s) => s.id === id ? { ...s, [key]: val } : s),
  }));

  const addSlaapkamer = () => setD((p) => ({
    ...p, slaapkamers: [...p.slaapkamers, { id: uid(), naam: `Slaapkamer ${p.slaapkamers.length + 1}`, vloer: "", verdieping: "", ingemaaktKasten: "Nee" }],
  }));
  const removeSlaapkamer = (id) => setD((p) => ({ ...p, slaapkamers: p.slaapkamers.filter((s) => s.id !== id) }));
  const updateSlaapkamer = (id, key, val) => setD((p) => ({
    ...p, slaapkamers: p.slaapkamers.map((s) => s.id === id ? { ...s, [key]: val } : s),
  }));

  const addExtraRuimte = () => setD((p) => ({
    ...p, extraRuimtes: [...p.extraRuimtes, { id: uid(), naam: "", vloer: "", kenmerken: "" }],
  }));
  const removeExtraRuimte = (id) => setD((p) => ({ ...p, extraRuimtes: p.extraRuimtes.filter((r) => r.id !== id) }));
  const updateExtraRuimte = (id, key, val) => setD((p) => ({
    ...p, extraRuimtes: p.extraRuimtes.map((r) => r.id === id ? { ...r, [key]: val } : r),
  }));

  const addFotos = (files, onGeweigerd) => {
    const teAccepteren = [];
    const geweigerd = [];
    Array.from(files).forEach((f) => (isJpegFile(f) ? teAccepteren : geweigerd).push(f));
    if (geweigerd.length && onGeweigerd) onGeweigerd(geweigerd.map((f) => f.name));

    // meteen een directe, snelle voorbeeldweergave tonen (los van de verkleining hieronder) —
    // zo is er altijd onmiddellijk een echte preview, ook als de verkleiningsstap traag is of faalt.
    const nieuw = teAccepteren.map((f) => ({ id: uid(), naam: f.name, url: URL.createObjectURL(f), base64: "", categorie: "Andere" }));
    setD((p) => ({ ...p, fotos: [...p.fotos, ...nieuw] }));

    const leesAlsData = (blob, id) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setD((p) => ({ ...p, fotos: p.fotos.map((foto) => foto.id === id ? { ...foto, base64: String(e.target.result) } : foto) }));
      };
      reader.readAsDataURL(blob);
    };
    // verkleint op de achtergrond tot een voor het rapport ruim voldoende formaat (voor de export) —
    // dit beïnvloedt de preview hierboven niet meer, enkel de uiteindelijke bestandsgrootte.
    teAccepteren.forEach((f, i) => {
      const id = nieuw[i].id;
      resizeImageBlob(f)
        .then((klein) => leesAlsData(klein, id))
        .catch(() => leesAlsData(f, id)); // verkleinen mislukt: toch het origineel gebruiken voor de export
    });
  };
  const removeFoto = (id) => setD((p) => ({ ...p, fotos: p.fotos.filter((f) => f.id !== id) }));
  const updateFoto = (id, key, val) => setD((p) => ({
    ...p, fotos: p.fotos.map((f) => f.id === id ? { ...f, [key]: val } : f),
  }));

  // optionele voorpagina-foto (bv. een Street View-schermafbeelding of een eigen foto ter plaatse)
  // — apart van de bijlage-foto's hierboven, dus ook andere beeldformaten (zoals PNG van een
  // schermafbeelding) toegelaten, niet enkel JPEG.
  const setVoorpaginaFoto = (file) => {
    if (!file) return;
    const id = uid();
    setD((p) => ({ ...p, voorpaginaFoto: { id, naam: file.name, url: URL.createObjectURL(file), base64: "" } }));
    const leesAlsData = (blob) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setD((p) => (p.voorpaginaFoto && p.voorpaginaFoto.id === id
          ? { ...p, voorpaginaFoto: { ...p.voorpaginaFoto, base64: String(e.target.result) } } : p));
      };
      reader.readAsDataURL(blob);
    };
    resizeImageBlob(file).then(leesAlsData).catch(() => leesAlsData(file));
  };
  const removeVoorpaginaFoto = () => setD((p) => ({ ...p, voorpaginaFoto: null }));

  const addEigenaar = () => setD((p) => ({
    ...p, eigenaars: [...p.eigenaars, { id: uid(), naam: "", recht: "Volle eigendom", aandeel: "" }],
  }));
  const removeEigenaar = (id) => setD((p) => ({ ...p, eigenaars: p.eigenaars.filter((e) => e.id !== id) }));
  const updateEigenaar = (id, key, val) => setD((p) => ({
    ...p, eigenaars: p.eigenaars.map((e) => e.id === id ? { ...e, [key]: val } : e),
  }));

  const addVergelijkingspunt = () => setD((p) => ({
    ...p, vergelijkingspunten: [...p.vergelijkingspunten, {
      id: uid(), adres: "", kadastraleGegevens: "", bouwjaar: "", aardTransactie: "Verkoop uit de hand",
      datumTransactie: "", belastbareGrondslag: "", ligging: "", bestemming: "", oriëntatie: "",
      externeAfwerking: "", onderhoud: "", rooilijnbreedte: "", gevelbreedte: "", bebouwdeOpp: "", afweging: "",
    }],
  }));
  const removeVergelijkingspunt = (id) => setD((p) => ({ ...p, vergelijkingspunten: p.vergelijkingspunten.filter((v) => v.id !== id) }));
  const updateVergelijkingspunt = (id, key, val) => setD((p) => ({
    ...p, vergelijkingspunten: p.vergelijkingspunten.map((v) => v.id === id ? { ...v, [key]: val } : v),
  }));

  const addDocumenten = (files) => {
    Array.from(files).forEach((f) => {
      const entry = { id: uid(), naam: f.name, type: f.type || "onbekend", grootte: f.size, notities: "" };
      if (f.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          setD((p) => ({ ...p, documenten: [...p.documenten, { ...entry, notities: String(e.target.result).slice(0, 4000) }] }));
        };
        reader.readAsText(f);
      } else if (f.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = String(e.target.result).split(",")[1] || "";
          setD((p) => ({ ...p, documenten: [...p.documenten, { ...entry, base64, mediaType: "application/pdf" }] }));
        };
        reader.readAsDataURL(f);
      } else {
        setD((p) => ({ ...p, documenten: [...p.documenten, entry] }));
      }
    });
  };
  const removeDocument = (id) => setD((p) => ({ ...p, documenten: p.documenten.filter((doc) => doc.id !== id) }));
  const updateDocument = (id, key, val) => setD((p) => ({
    ...p, documenten: p.documenten.map((doc) => doc.id === id ? { ...doc, [key]: val } : doc),
  }));

  return (
    <div style={{ background: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif", minHeight: 600 }}
      className="w-full rounded-xl overflow-hidden">
      <style>{`
        @page { size: A4; margin: 18mm 16mm; }
        @media print {
          .no-print { display: none !important; }
          .report-scroll-area { max-height: none !important; overflow: visible !important; }
          .report-page { box-shadow: none !important; border: none !important; border-radius: 0 !important;
            margin: 0 !important; page-break-after: always; break-after: page; }
          .report-page:last-of-type { page-break-after: auto; break-after: auto; }
          body, html { background: #fff !important; }
        }
      `}</style>
      <div className="no-print flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
            style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <ChevronLeft size={13} /> Overzicht
          </button>
          <Home size={16} style={{ color: BRASS }} />
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500 }}>
              {d.straat ? `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}` : "Nieuw dossier"}
            </div>
            <div style={{ fontSize: 12, color: INK_SOFT }}>
              {d.postcode || d.gemeente ? `${d.postcode} ${d.gemeente}` : "Adres nog niet ingevuld"}
            </div>
          </div>
        </div>
        <button onClick={() => setD((p) => ({ ...p, status: p.status === "concept" ? "afgewerkt" : "concept" }))}
          className="text-xs px-3 py-1 rounded-full" style={{
            background: d.status === "afgewerkt" ? STAMP : STAMP_SOFT,
            color: d.status === "afgewerkt" ? "#fff" : STAMP, fontWeight: 500,
          }}>
          {d.status === "afgewerkt" ? "Afgewerkt" : "Concept"} · wordt automatisch bewaard
        </button>
      </div>

      <div className="flex" style={{ minHeight: 560 }}>
        <div style={{ width: 220, borderRight: `1px solid ${LINE}`, background: "rgba(0,0,0,0.015)" }} className="no-print py-4 px-3 flex-shrink-0">
          {steps.map((s, i) => {
            const active = i === step;
            const Icon = s.icon;
            return (
              <button key={s.key} onClick={() => setStep(i)}
                className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg mb-1 transition-colors"
                style={{
                  background: active ? PAPER_RAISED : "transparent",
                  boxShadow: active ? `0 0 0 1px ${LINE}` : "none",
                  color: active ? INK : INK_SOFT,
                }}>
                <Icon size={14} style={{ color: active ? BRASS : INK_SOFT, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: active ? 500 : 400 }}>{s.label}</span>
              </button>
            );
          })}
        </div>

        <div className="report-scroll-area flex-1 px-8 py-6 overflow-auto" style={{ maxHeight: 700 }}>
          {step === 0 && (
            <StepDocumenten d={d} set={set} addDocumenten={addDocumenten} removeDocument={removeDocument} updateDocument={updateDocument} />
          )}
          {step === 1 && (
            <StepOpdracht d={d} set={set} addEigenaar={addEigenaar} removeEigenaar={removeEigenaar} updateEigenaar={updateEigenaar} />
          )}
          {step === 2 && <StepLigging d={d} set={set} />}
          {step === 3 && <StepType d={d} set={set} />}
          {step === 4 && <StepConstructie d={d} set={set} />}
          {step === 5 && <StepInstallaties d={d} set={set} />}
          {step === 6 && (
            <StepRuimteEigenschappen d={d} set={set} setEig={setEig}
              addSlaapkamer={addSlaapkamer} removeSlaapkamer={removeSlaapkamer} updateSlaapkamer={updateSlaapkamer}
              addExtraRuimte={addExtraRuimte} removeExtraRuimte={removeExtraRuimte} updateExtraRuimte={updateExtraRuimte} />
          )}
          {step === 7 && <StepMarkt d={d} set={set} />}
          {step === 8 && <StepSwot d={d} set={set} setD={setD} />}
          {step === 9 && (
            <StepAfmetingen d={d} set={set} calc={calc}
              addRuimte={addRuimte} removeRuimte={removeRuimte} updateRuimte={updateRuimte}
              addSchijf={addSchijf} removeSchijf={removeSchijf} updateSchijf={updateSchijf} />
          )}
          {step === 10 && (
            <StepVergelijkingspunten d={d} set={set}
              addVergelijkingspunt={addVergelijkingspunt} removeVergelijkingspunt={removeVergelijkingspunt} updateVergelijkingspunt={updateVergelijkingspunt} />
          )}
          {step === 11 && <StepWaardering d={d} set={set} calc={calc} />}
          {step === 12 && <StepFotos d={d} addFotos={addFotos} removeFoto={removeFoto} updateFoto={updateFoto}
            setVoorpaginaFoto={setVoorpaginaFoto} removeVoorpaginaFoto={removeVoorpaginaFoto} />}
          {step === 13 && <StepRapport d={d} calc={calc} huisstijl={huisstijl} />}

          <div className="no-print flex justify-between mt-10 pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg"
              style={{ color: step === 0 ? "#B8B4A8" : INK_SOFT, border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
              <ChevronLeft size={14} /> Vorige
            </button>
            <button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step === steps.length - 1}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg text-white"
              style={{ background: step === steps.length - 1 ? "#B8B4A8" : INK }}>
              Volgende <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- login ----------
function LoginScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [naam, setNaam] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [bezig, setBezig] = useState(false);

  const submitLogin = async () => {
    if (bezig) return;
    setError(""); setInfo("");
    if (!email.trim() || !wachtwoord) { setError("Vul e-mail en wachtwoord in."); return; }
    setBezig(true);
    try {
      const user = await login(email.trim(), wachtwoord);
      await onLogin(user);
    } catch (err) {
      setError(err.message || "Er ging iets mis bij het aanmelden. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  };
  const submitRegister = async () => {
    if (bezig) return;
    setError(""); setInfo("");
    if (!naam.trim() || !email.trim() || !wachtwoord) { setError("Vul alle velden in."); return; }
    if (wachtwoord.length < 6) { setError("Wachtwoord moet minstens 6 tekens bevatten."); return; }
    setBezig(true);
    try {
      const { user, session } = await registreer(email.trim(), wachtwoord, naam.trim());
      if (user && session) {
        // e-mailbevestiging staat uit voor dit Supabase-project: meteen ingelogd
        await onRegister(user);
      } else {
        // e-mailbevestiging staat aan: eerst de bevestigingslink volgen, dan pas aanmelden
        setInfo("Account aangemaakt. Bevestig je e-mailadres via de link die we net stuurden, en meld je daarna hier aan.");
        setMode("login");
      }
    } catch (err) {
      setError(err.message || "Er ging iets mis bij het registreren. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  };
  const onEnter = (fn) => (e) => { if (e.key === "Enter") fn(); };

  return (
    <div className="w-full flex items-center justify-center" style={{ minHeight: 560, background: PAPER, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="rounded-xl p-8" style={{ width: 360, background: PAPER_RAISED, border: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Home size={18} style={{ color: BRASS }} />
          <span style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: INK }}>Houpels Valuation & Real Estate</span>
        </div>
        <div className="text-xs mb-6" style={{ color: INK_SOFT }}>Taxatiedossiers — aanmelden</div>

        <div className="flex mb-5 rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
          <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); }}
            className="flex-1 text-xs py-2"
            style={{ background: mode === "login" ? INK : PAPER_RAISED, color: mode === "login" ? "#fff" : INK_SOFT, fontWeight: 500 }}>
            Aanmelden
          </button>
          <button type="button" onClick={() => { setMode("register"); setError(""); setInfo(""); }}
            className="flex-1 text-xs py-2"
            style={{ background: mode === "register" ? INK : PAPER_RAISED, color: mode === "register" ? "#fff" : INK_SOFT, fontWeight: 500 }}>
            Nieuwe makelaar
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        {info && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: STAMP_SOFT, color: STAMP }}>
            <Check size={13} /> {info}
          </div>
        )}

        {mode === "login" ? (
          <div className="flex flex-col gap-3">
            <Field label="E-mail"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(submitLogin)} /></Field>
            <Field label="Wachtwoord"><TextInput type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} onKeyDown={onEnter(submitLogin)} /></Field>
            <button type="button" onClick={submitLogin} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig..." : "Aanmelden"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Field label="Naam"><TextInput value={naam} onChange={(e) => setNaam(e.target.value)} onKeyDown={onEnter(submitRegister)} /></Field>
            <Field label="E-mail"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(submitRegister)} /></Field>
            <Field label="Wachtwoord"><TextInput type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} onKeyDown={onEnter(submitRegister)} /></Field>
            <button type="button" onClick={submitRegister} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig..." : "Account aanmaken"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- dashboard ----------
function Dashboard({ user, index, onOpen, onNew, onDelete, onLogout, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  const [zoek, setZoek] = useState("");
  const mine = index.filter((x) => x.ownerId === user.id);
  const matches = (x) => {
    const t = `${x.straat} ${x.nummer} ${x.gemeente} ${x.postcode}`.toLowerCase();
    return t.includes(zoek.toLowerCase());
  };
  const concepten = mine.filter((x) => x.status !== "afgewerkt" && matches(x))
    .sort((a, b) => new Date(b.laatstBewerkt || 0) - new Date(a.laatstBewerkt || 0));
  const afgewerkt = mine.filter((x) => x.status === "afgewerkt" && matches(x))
    .sort((a, b) => new Date(b.laatstBewerkt || 0) - new Date(a.laatstBewerkt || 0));

  const fmtDatum = (iso) => {
    if (!iso) return "";
    const dt = new Date(iso);
    return dt.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
  };

  const Row = ({ x }) => (
    <div onClick={() => onOpen(x.id)} className="flex items-center justify-between px-4 py-3 rounded-lg mb-2 cursor-pointer transition-colors"
      style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: INK }}>
          {x.straat ? `${x.straat} ${x.nummer}${x.bus ? "/" + x.bus : ""}` : "Naamloos dossier"}
        </div>
        <div style={{ fontSize: 12, color: INK_SOFT }}>{x.postcode} {x.gemeente} · laatst bewerkt {fmtDatum(x.laatstBewerkt)}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs px-2.5 py-1 rounded-full" style={{
          background: x.status === "afgewerkt" ? STAMP_SOFT : BRASS_SOFT,
          color: x.status === "afgewerkt" ? STAMP : BRASS, fontWeight: 500,
        }}>{x.status === "afgewerkt" ? "Afgewerkt" : "Concept"}</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(x.id); }}><Trash2 size={14} style={{ color: DANGER }} /></button>
      </div>
    </div>
  );

  return (
    <div className="w-full rounded-xl overflow-hidden" style={{ background: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif", minHeight: 600 }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2">
          <Home size={16} style={{ color: BRASS }} />
          <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500 }}>Mijn dossiers</div>
        </div>
        <div className="flex items-center gap-3">
          {/* toont welke huisstijl actief is voor de ingelogde gebruiker (bepaald door e-mailadres,
              zie kiesHuisstijl) — vooral handig om meteen visueel te kunnen nagaan of bv. een
              @huyzen.be-account effectief de Huyzen-huisstijl krijgt, zonder een rapport te moeten
              genereren. */}
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: hs.key === "houpels" ? BRASS_SOFT : `${hs.kleur}22`, color: hs.kleur, fontWeight: 500 }}>
            Huisstijl: {hs.naam}
          </span>
          <span className="text-sm" style={{ color: INK_SOFT }}>{user.naam} · {user.email}</span>
          <button onClick={onLogout} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>Afmelden</button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6 gap-3">
          <TextInput placeholder="Zoek op adres of gemeente..." value={zoek} onChange={(e) => setZoek(e.target.value)} style={{ maxWidth: 320 }} />
          <button onClick={onNew} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg text-white" style={{ background: INK, fontWeight: 500 }}>
            <Plus size={14} /> Nieuw dossier
          </button>
        </div>

        <div className="mb-8">
          <div className="text-xs mb-2" style={{ color: BRASS, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Conceptdossiers ({concepten.length})
          </div>
          {concepten.length === 0
            ? <div className="text-sm italic" style={{ color: INK_SOFT }}>Geen conceptdossiers.</div>
            : concepten.map((x) => <Row key={x.id} x={x} />)}
        </div>

        <div>
          <div className="text-xs mb-2" style={{ color: STAMP, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Afgewerkte dossiers ({afgewerkt.length})
          </div>
          {afgewerkt.length === 0
            ? <div className="text-sm italic" style={{ color: INK_SOFT }}>Geen afgewerkte dossiers.</div>
            : afgewerkt.map((x) => <Row key={x.id} x={x} />)}
        </div>
      </div>
    </div>
  );
}

// ---------- app root: authenticatie + navigatie ----------
export default function AppRoot() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState([]);
  const [view, setView] = useState("login"); // login | dashboard | wizard
  const [activeDossier, setActiveDossier] = useState(null);

  // bouwt het sessie-object dat de rest van de app gebruikt (session.id, session.naam, ...)
  // op basis van de Supabase auth-gebruiker + diens weergavenaam uit de profielen-tabel
  const bouwSessie = async (user) => {
    const naam = await haalProfielNaam(user.id, user.email);
    return { id: user.id, naam, email: user.email };
  };

  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        const user = await haalHuidigeGebruiker();
        if (!actief) return;
        if (user) {
          const [s, idx] = await Promise.all([bouwSessie(user), loadIndex()]);
          if (!actief) return;
          setSession(s);
          setIndex(idx);
          setView("dashboard");
        }
      } catch (e) {
        // geen actieve sessie, of Supabase (nog) niet bereikbaar — gewoon het aanmeldscherm tonen
      } finally {
        if (actief) setLoading(false);
      }
    })();
    return () => { actief = false; };
  }, []);

  const handleLogin = async (user) => {
    const [s, idx] = await Promise.all([bouwSessie(user), loadIndex()]);
    setSession(s);
    setIndex(idx);
    setView("dashboard");
  };
  const handleRegister = async (user) => { await handleLogin(user); };
  const handleLogout = async () => {
    await uitloggen();
    setSession(null); setActiveDossier(null); setIndex([]); setView("login");
  };

  const handleNew = () => {
    const now = new Date().toISOString();
    setActiveDossier({ ...initialData, id: nieuweDossierId(), ownerId: session.id, status: "concept", aangemaaktOp: now, laatstBewerkt: now });
    setView("wizard");
  };
  const handleOpen = async (id) => {
    const dossier = await loadDossier(id);
    // samenvoegen met initialData: zo krijgen velden die na het opslaan van dit dossier zijn
    // toegevoegd (zoals extraRuimtes) altijd een geldige standaardwaarde in plaats van undefined
    if (dossier) { setActiveDossier({ ...initialData, ...dossier }); setView("wizard"); }
  };
  const handleDelete = async (id) => { await deleteDossier(id, index, setIndex); };
  const handleBackToDashboard = () => { setView("dashboard"); setActiveDossier(null); };
  const handleSave = (dossier) => { saveDossier(dossier, index, setIndex); };

  if (loading) {
    return <div className="w-full flex items-center justify-center" style={{ minHeight: 400, color: INK_SOFT, fontFamily: "system-ui" }}>Laden...</div>;
  }
  if (view === "login" || !session) {
    return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }
  // huisstijl (naam/kleur/logo) wordt bepaald door het e-mailadres van de ingelogde gebruiker —
  // zie kiesHuisstijl hierboven. Standaard Houpels, automatisch Huyzen Vastgoed voor @huyzen.be.
  const huisstijl = kiesHuisstijl(session?.email);
  if (view === "wizard" && activeDossier) {
    return <DossierWizard initialDossier={activeDossier} onBack={handleBackToDashboard} onSave={handleSave} huisstijl={huisstijl} />;
  }
  return <Dashboard user={session} index={index} onOpen={handleOpen} onNew={handleNew} onDelete={handleDelete} onLogout={handleLogout} huisstijl={huisstijl} />;
}

// ---------- step 0: opdracht & verkoper ----------
function StepOpdracht({ d, set, addEigenaar, removeEigenaar, updateEigenaar }) {
  const [mapError, setMapError] = useState(false);
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}, België`;
  const adresVolledig = d.straat && d.gemeente;
  const mapSrc = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(adres)}&zoom=16&size=640x300&scale=2&maptype=roadmap&markers=color:0x8C6A2F%7C${encodeURIComponent(adres)}`;

  // pandadres zonder ", België" — het formaat dat in het verslag zelf gebruikt wordt, zie ook
  // buildReportData's "adres"-opbouw
  const pandAdresKort = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`.trim();

  // "zelfde als"-vlaggen automatisch doorvoeren: zo moet de gebruiker adres/naam niet meermaals
  // intypen wanneer opdrachtgever, verkoper en/of eigenaar in werkelijkheid dezelfde persoon of
  // hetzelfde adres betreffen — zie ook de checkboxen verderop in deze stap.
  useEffect(() => {
    if (d.opdrachtgeverAdresZelfde && d.opdrachtgeverAdres !== pandAdresKort) set("opdrachtgeverAdres")(pandAdresKort);
  }, [d.opdrachtgeverAdresZelfde, pandAdresKort]);
  useEffect(() => {
    if (d.verkoperAdresZelfde && d.verkoperAdres !== pandAdresKort) set("verkoperAdres")(pandAdresKort);
  }, [d.verkoperAdresZelfde, pandAdresKort]);
  useEffect(() => {
    if (!d.opdrachtgeverIsEigenaar) return;
    if (d.eigenaars.length === 0) { addEigenaar(); return; }
    if (d.eigenaars[0].naam !== d.opdrachtgeverNaam) updateEigenaar(d.eigenaars[0].id, "naam", d.opdrachtgeverNaam);
  }, [d.opdrachtgeverIsEigenaar, d.opdrachtgeverNaam, d.eigenaars]);

  return (
    <div>
      <Section title="Identificatie schatter-expert" icon={ClipboardList}>
        <Field label="Naam schatter-expert"><TextInput value={d.schatterNaam} onChange={set("schatterNaam")} /></Field>
        <Field label="(Beroeps)titel"><TextInput value={d.schatterTitel} onChange={set("schatterTitel")} /></Field>
        <Field label="Vlabel-identificatienummer" full hint="Door de Vlaamse Belastingdienst toegekend identificatienummer voor schatters-experten">
          <TextInput value={d.schatterVlabelNummer} onChange={set("schatterVlabelNummer")} />
        </Field>
      </Section>
      <Section title="Opdracht" icon={ClipboardList}>
        <Field label="Opdrachtgever (naam of benaming)"><TextInput value={d.opdrachtgeverNaam} onChange={set("opdrachtgeverNaam")} /></Field>
        <div>
          <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>Adres opdrachtgever</span>
          <TextInput value={d.opdrachtgeverAdres} onChange={set("opdrachtgeverAdres")} disabled={d.opdrachtgeverAdresZelfde} />
          <Checkbox label="Zelfde als adres pand" checked={d.opdrachtgeverAdresZelfde} onChange={set("opdrachtgeverAdresZelfde")} />
        </div>
        <Field label="Rijksregisternummer / ondernemingsnummer"><TextInput value={d.opdrachtgeverIdNummer} onChange={set("opdrachtgeverIdNummer")} /></Field>
        <Field label="Wettelijke vertegenwoordiger" hint="Indien opdrachtgevende overheidsinstantie"><TextInput value={d.opdrachtgeverVertegenwoordiger} onChange={set("opdrachtgeverVertegenwoordiger")} /></Field>
        <Field label="Reden van waardering"><Select options={OPTS.reden} value={d.reden} onChange={set("reden")} /></Field>
        <Field label="Opdrachtgever aanwezig bij bezoek"><Select options={OPTS.jaNee.slice(0, 2)} value={d.opdrachtgeverAanwezig} onChange={set("opdrachtgeverAanwezig")} /></Field>
        <Field label="Datum plaatsbezoek"><TextInput type="date" value={d.datumBezoek} onChange={set("datumBezoek")} /></Field>
        <Field label="Datum verslag"><TextInput type="date" value={d.datumVerslag} onChange={set("datumVerslag")} /></Field>
        <Field label={d.reden === "Nalatenschap" ? "Datum overlijden (referentiedatum)" : "Referentiedatum schatting"} full
          hint="Datum waarop de waarde van het onroerend goed wordt bepaald">
          <TextInput type="date" value={d.referentiedatum} onChange={set("referentiedatum")} />
        </Field>
      </Section>
      <Section title="Contactgegevens verkoper" icon={Users}>
        <Field label="Naam"><TextInput value={d.verkoperNaam} onChange={set("verkoperNaam")} /></Field>
        <div>
          <span className="block text-xs mb-1" style={{ color: INK_SOFT, fontWeight: 500 }}>Adres</span>
          <TextInput value={d.verkoperAdres} onChange={set("verkoperAdres")} disabled={d.verkoperAdresZelfde} />
          <Checkbox label="Zelfde als adres pand" checked={d.verkoperAdresZelfde} onChange={set("verkoperAdresZelfde")} />
        </div>
        <Field label="Telefoonnummer"><TextInput value={d.verkoperTelefoon} onChange={set("verkoperTelefoon")} /></Field>
        <Field label="E-mail"><TextInput type="email" value={d.verkoperEmail} onChange={set("verkoperEmail")} /></Field>
      </Section>
      <Section title="Adres" icon={MapPin}>
        <Field label="Straat"><TextInput value={d.straat} onChange={set("straat")} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nummer"><TextInput value={d.nummer} onChange={set("nummer")} /></Field>
          <Field label="Bus"><TextInput value={d.bus} onChange={set("bus")} /></Field>
        </div>
        <Field label="Postcode"><TextInput value={d.postcode} onChange={set("postcode")} /></Field>
        <Field label="Gemeente"><TextInput value={d.gemeente} onChange={set("gemeente")} /></Field>
        <Field label="Dorp / gehucht"><TextInput value={d.dorpGehucht} onChange={set("dorpGehucht")} /></Field>
        <Field label="CRAB-gegevens"><TextInput value={d.crabGegevens} onChange={set("crabGegevens")} /></Field>
      </Section>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={15} style={{ color: BRASS }} />
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>Kadastrale identificatie</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <Field label="CaPaKey" full hint="Manueel op te zoeken via geopunt.be of cadgis.be"><TextInput value={d.capakey} onChange={set("capakey")} /></Field>
        </div>
        {adresVolledig && !mapError && (
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <img src={staticMapUrl} alt={`Kaart van ${adres}`} style={{ width: "100%", display: "block" }}
              onError={() => setMapError(true)} />
            <div className="px-3 py-2 text-xs flex justify-between items-center" style={{ borderTop: `1px solid ${LINE}`, color: INK_SOFT }}>
              <span>{d.straat} {d.nummer}{d.bus ? "/" + d.bus : ""}, {d.postcode} {d.gemeente}</span>
              <a href={mapSrc} target="_blank" rel="noopener noreferrer" style={{ color: BRASS, textDecoration: "none", fontWeight: 500 }}>Open in Google Maps</a>
            </div>
          </div>
        )}
        {adresVolledig && mapError && (
          <div className="rounded-lg p-5 flex items-center justify-between" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, background: BRASS_SOFT }}>
                <MapPin size={17} style={{ color: BRASS }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: INK }}>{d.straat} {d.nummer}{d.bus ? "/" + d.bus : ""}</div>
                <div style={{ fontSize: 12, color: INK_SOFT }}>{d.postcode} {d.gemeente}</div>
              </div>
            </div>
            <a href={mapSrc} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
              style={{ background: INK, textDecoration: "none" }}>
              <MapPin size={13} /> Open kaart
            </a>
          </div>
        )}
        {!adresVolledig && (
          <div className="text-xs italic p-4 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            Vul straat en gemeente in om de kaart te tonen.
          </div>
        )}
      </div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Users size={15} style={{ color: BRASS }} />
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>Eigendomstoestand — zakelijke rechten</h3>
        </div>
        <div className="text-xs mb-2" style={{ color: INK_SOFT }}>Elke houder van een zakelijk recht, met zijn aandeel (quotiteit) in de volledige eigendom.</div>
        <Checkbox label="Eigenaar(s) = opdrachtgever" checked={d.opdrachtgeverIsEigenaar} onChange={set("opdrachtgeverIsEigenaar")} />
        <div className="flex flex-col gap-2 mt-1">
          {d.eigenaars.map((e, i) => (
            <div key={e.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 1fr 120px 32px" }}>
              <TextInput placeholder="Naam" value={e.naam} onChange={(ev) => updateEigenaar(e.id, "naam", ev.target.value)}
                disabled={i === 0 && d.opdrachtgeverIsEigenaar} />
              <Select options={OPTS.recht} value={e.recht} onChange={(ev) => updateEigenaar(e.id, "recht", ev.target.value)} />
              <TextInput placeholder="Aandeel (bv. 1/2)" value={e.aandeel} onChange={(ev) => updateEigenaar(e.id, "aandeel", ev.target.value)} />
              <button onClick={() => removeEigenaar(e.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
            </div>
          ))}
        </div>
        <button onClick={addEigenaar} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <Plus size={13} /> Rechthebbende toevoegen
        </button>
      </div>
    </div>
  );
}

function ChipToggle({ options, text, onToggle }) {
  const active = (opt) => (text || "").toLowerCase().includes(opt.toLowerCase());
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const isActive = active(o);
        return (
          <button type="button" key={o} onClick={() => onToggle(o)}
            className="text-xs px-2.5 py-1 rounded-full transition-colors"
            style={{
              border: `1px solid ${isActive ? BRASS : LINE}`,
              background: isActive ? BRASS_SOFT : PAPER_RAISED,
              color: isActive ? BRASS : INK_SOFT, fontWeight: 500,
            }}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

// ---------- step: ligging & omgeving ----------
function StepLigging({ d, set }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const adresVolledig = d.straat && d.gemeente;

  const mergeText = (existing, addition) => {
    const have = existing.toLowerCase();
    if (have.includes(addition.toLowerCase())) return existing;
    return existing.trim() ? `${existing.trim()}, ${addition}` : addition;
  };
  const toggleChip = (field, phrase) => {
    const current = d[field] || "";
    if (current.toLowerCase().includes(phrase.toLowerCase())) {
      const cleaned = current.split(/,\s*/).filter((p) => p.trim().toLowerCase() !== phrase.toLowerCase()).join(", ");
      set(field)(cleaned);
    } else {
      set(field)(mergeText(current, phrase));
    }
  };

  const zoekOmgeving = async () => {
    setLoading(true);
    setError("");
    try {
      const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}, België`;
      const prompt = `Zoek op het internet de werkelijke, actuele omgeving en bereikbaarheid op voor het adres: ${adres}.
Geef beknopt en feitelijk (geen overdrijvingen) weer:
1. Voorzieningen in de ruimere omgeving: reële, nabijgelegen handelszaken, scholen, banken, ziekenhuizen, administraties, ontspanning — noem waar mogelijk concrete namen/afstanden.
2. Bereikbaarheid: reële afstand/verbinding met openbaar vervoer (bus/trein) en met de auto (op-/afrit autosnelweg), fietsbereikbaarheid.
Schrijf in het Nederlands, in de stijl van een professioneel taxatieverslag.
Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat:
{"omgevingsvoorzieningen": "...", "bereikbaarheid": "..."}`;

      const raw = await callClaudeWithSearch(prompt);
      const parsed = extractJson(raw);
      if (parsed.omgevingsvoorzieningen) set("omgevingsvoorzieningen")(mergeText(d.omgevingsvoorzieningen, parsed.omgevingsvoorzieningen));
      if (parsed.bereikbaarheid) set("bereikbaarheid")(mergeText(d.bereikbaarheid, parsed.bereikbaarheid));
    } catch (e) {
      setError(`Kon de omgeving niet opzoeken (${e.message || "onbekende fout"}). Probeer opnieuw.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin size={15} style={{ color: BRASS }} />
            <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>Ligging in de omgeving</h3>
          </div>
          <button onClick={zoekOmgeving} disabled={loading || !adresVolledig}
            title={!adresVolledig ? "Vul eerst straat en gemeente in (stap Opdracht & partijen)" : ""}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
            style={{ background: loading || !adresVolledig ? "#B8B4A8" : STAMP }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {loading ? "Omgeving opzoeken..." : "Opzoeken via AI (op basis van adres)"}
          </button>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Voorzieningen in de ruimere omgeving" full hint="Handelszaken, banken, scholen, bejaardentehuizen, administraties, ziekenhuizen, ontspanning...">
            <div className="mb-2"><ChipToggle options={OPTS.omgevingsvoorzieningen} text={d.omgevingsvoorzieningen} onToggle={(p) => toggleChip("omgevingsvoorzieningen", p)} /></div>
            <textarea value={d.omgevingsvoorzieningen} onChange={set("omgevingsvoorzieningen")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Bereikbaarheid" full hint="Via openbaar of privaat vervoer">
            <div className="mb-2"><ChipToggle options={OPTS.bereikbaarheid} text={d.bereikbaarheid} onToggle={(p) => toggleChip("bereikbaarheid", p)} /></div>
            <textarea value={d.bereikbaarheid} onChange={set("bereikbaarheid")} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <Field label="Stedenbouwkundige voorschriften" full hint="Gewestplan, BPA, RUP of verkavelingsplan">
            <TextInput value={d.bpaRupVerkaveling} onChange={set("bpaRupVerkaveling")} />
          </Field>
        </div>
      </div>
      <Section title="Terrein" icon={Ruler}>
        <Field label="Vorm van het perceel"><TextInput value={d.vormPerceel} onChange={set("vormPerceel")} /></Field>
        <Field label="Rooilijnbreedte (m)"><TextInput type="number" value={d.rooilijnbreedte} onChange={set("rooilijnbreedte")} /></Field>
        <Field label="Relatieve hoogteligging"><Select options={OPTS.hoogteligging} value={d.hoogteligging} onChange={set("hoogteligging")} /></Field>
        <Field label="Bodemoccupatie (%)"><TextInput type="number" value={d.bodemoccupatie} onChange={set("bodemoccupatie")} /></Field>
      </Section>
      <Section title="Gebouw — inplanting" icon={Building2}>
        <Field label="Aantal bijgebouwen"><TextInput type="number" value={d.aantalBijgebouwen} onChange={set("aantalBijgebouwen")} /></Field>
        <Field label="Inplanting op het terrein" full><TextInput value={d.inplanting} onChange={set("inplanting")} /></Field>
      </Section>
    </div>
  );
}

// ---------- step 2: type, staat & kadaster ----------
function StepType({ d, set }) {
  return (
    <div>
      <Section title="Type onroerend goed" icon={Building2}>
        <Field label="Pand"><Select options={OPTS.pandType} value={d.pandType} onChange={set("pandType")} /></Field>
        <Field label="Aard van de woning" hint="Bv. bungalow, villa, herenhuis, hoeve, rijwoning, ..."><TextInput value={d.aardWoning} onChange={set("aardWoning")} /></Field>
        <Field label="Bouwtype"><Select options={OPTS.bouwtype} value={d.bouwtype} onChange={set("bouwtype")} /></Field>
        <Field label="Verdieping(en)"><TextInput value={d.verdiepingen} onChange={set("verdiepingen")} placeholder="bv. gelijkvloers + 2 verdiepingen" /></Field>
        <Field label="Lift"><Select options={OPTS.jaNee.slice(0, 2)} value={d.lift} onChange={set("lift")} /></Field>
        <Field label="Bouwjaar"><TextInput type="number" value={d.bouwjaar} onChange={set("bouwjaar")} /></Field>
        <Field label="Renovatiejaar"><TextInput type="number" value={d.renovatiejaar} onChange={set("renovatiejaar")} /></Field>
        <Field label="Jaar van aankoop"><TextInput type="number" value={d.jaarVanAankoop} onChange={set("jaarVanAankoop")} /></Field>
        <Field label="Staat" full>
          <MultiCheck options={OPTS.staat} values={d.staat} onChange={(v) => set("staat")(v)} />
        </Field>
      </Section>
      <Section title="Kadastrale gegevens" icon={Building2}>
        <Field label="Kadastrale afdeling"><TextInput value={d.kadAfdeling} onChange={set("kadAfdeling")} /></Field>
        <Field label="Kadastrale sectie"><TextInput value={d.kadSectie} onChange={set("kadSectie")} /></Field>
        <Field label="Perceelnummer"><TextInput value={d.kadPerceelnummer} onChange={set("kadPerceelnummer")} /></Field>
        <Field label="Partitienummer"><TextInput value={d.kadPartitienummer} onChange={set("kadPartitienummer")} /></Field>
        <Field label="Kadastrale oppervlakte (m²)"><TextInput type="number" value={d.kadastraleOpp} onChange={set("kadastraleOpp")} /></Field>
        <Field label="KI (kadastraal inkomen)"><TextInput value={d.ki} onChange={set("ki")} /></Field>
        <Field label="Onroerende voorheffing"><TextInput value={d.onroerendeVoorheffing} onChange={set("onroerendeVoorheffing")} /></Field>
        <Field label="Detail-identificatie privatieve eigendom" hint="Bv. ligging en nummer appartement, garage, kelder — bij mede-eigendom">
          <TextInput value={d.kadDetailPrivatief} onChange={set("kadDetailPrivatief")} />
        </Field>
      </Section>
    </div>
  );
}

// ---------- step 2: constructie & isolatie ----------
function StepConstructie({ d, set }) {
  return (
    <div>
      <Section title="Ruwbouw en vloerplaat" icon={Layers}>
        <Field label="Ruwbouw"><Select options={OPTS.ruwbouw} value={d.ruwbouw} onChange={set("ruwbouw")} /></Field>
        {d.ruwbouw === "Andere" && (
          <Field label="Omschrijving"><TextInput value={d.ruwbouwAndere} onChange={set("ruwbouwAndere")} /></Field>
        )}
        <Field label="Voorgevel"><TextInput value={d.voorgevel} onChange={set("voorgevel")} placeholder="bv. gemetste gevelsteen" /></Field>
        <Field label="Zijgevel"><TextInput value={d.zijgevel} onChange={set("zijgevel")} /></Field>
        <Field label="Achtergevel"><TextInput value={d.achtergevel} onChange={set("achtergevel")} /></Field>
      </Section>
      <Section title="Dak" icon={Layers}>
        <Field label="Hoofddak"><Select options={OPTS.hoofddakType} value={d.hoofddakType} onChange={set("hoofddakType")} /></Field>
        <Field label="Materiaal hoofddak"><Select options={OPTS.hoofddakMateriaal} value={d.hoofddakMateriaal} onChange={set("hoofddakMateriaal")} /></Field>
        <Field label="Constructie & materiaal bijgebouw" full><TextInput value={d.bijgebouwConstructie} onChange={set("bijgebouwConstructie")} /></Field>
      </Section>
      <Section title="Isolatie" icon={Layers}>
        <Field label="EPC"><Select options={OPTS.epcStatus} value={d.epcStatus} onChange={set("epcStatus")} /></Field>
        <Field label="EPC-waarde (kWh/m²)"><TextInput type="number" value={d.epcWaarde} onChange={set("epcWaarde")} /></Field>
        <Field label="EPC-certificaatnummer" full><TextInput value={d.epcCertificaatnummer} onChange={set("epcCertificaatnummer")} /></Field>
        <Field label="Isolatie" full>
          <MultiCheck options={OPTS.isolatie} values={d.isolatie} onChange={(v) => set("isolatie")(v)} />
        </Field>
      </Section>
      <Section title="Buitenschrijnwerk" icon={Layers}>
        <Field label="Buitenschrijnwerk" full>
          <MultiCheck options={OPTS.buitenschrijnwerk} values={d.buitenschrijnwerk} onChange={(v) => set("buitenschrijnwerk")(v)} />
        </Field>
      </Section>
    </div>
  );
}

// ---------- step 3: verwarming & installaties ----------
function StepInstallaties({ d, set }) {
  return (
    <div>
      <Section title="Verwarming" icon={Flame}>
        <Field label="Soort" full><MultiCheck options={OPTS.verwarmingSoort} values={d.verwarmingSoort} onChange={(v) => set("verwarmingSoort")(v)} /></Field>
        <Field label="Grondstof" full><MultiCheck options={OPTS.verwarmingGrondstof} values={d.verwarmingGrondstof} onChange={(v) => set("verwarmingGrondstof")(v)} /></Field>
        <Field label="Verwarmingselementen" full><MultiCheck options={OPTS.verwarmingElementen} values={d.verwarmingElementen} onChange={(v) => set("verwarmingElementen")(v)} /></Field>
        <Field label="Merk en type ketel" full><TextInput value={d.ketelMerkType} onChange={set("ketelMerkType")} /></Field>
      </Section>
      <Section title="Warm water" icon={Flame}>
        <Field label="Warm water" full><MultiCheck options={OPTS.warmWater} values={d.warmWater} onChange={(v) => set("warmWater")(v)} /></Field>
        {d.warmWater.includes("Andere") && (
          <Field label="Omschrijving"><TextInput value={d.warmWaterAndere} onChange={set("warmWaterAndere")} /></Field>
        )}
        <Field label="Merk en type ketel" full><TextInput value={d.warmWaterKetelMerkType} onChange={set("warmWaterKetelMerkType")} /></Field>
      </Section>
      <Section title="Technische installaties" icon={Flame}>
        <Field label="Elektrische keuring"><Select options={OPTS.keuringStatus} value={d.keuringStatus} onChange={set("keuringStatus")} /></Field>
        <Field label="Dag + nacht teller"><Select options={OPTS.jaNee.slice(0, 2)} value={d.dagNachtTeller} onChange={set("dagNachtTeller")} /></Field>
        <Field label="Allerlei" full><MultiCheck options={OPTS.allerlei} values={d.allerlei} onChange={(v) => set("allerlei")(v)} /></Field>
      </Section>
    </div>
  );
}

// ---------- step 4: eigenschappen per ruimte ----------
function RoomChecklist({ cfg, state, onChange }) {
  const Icon = cfg.icon;
  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: BRASS }} />
        <span style={{ fontSize: 14, fontWeight: 500 }}>{cfg.label}</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "160px 1fr" }}>
        <TextInput placeholder="Vloer" value={state.vloer} onChange={(e) => onChange("vloer", e.target.value)} />
        {cfg.extraNumber && (
          <TextInput type="number" placeholder={cfg.extraNumber.label} value={state[cfg.extraNumber.key]}
            onChange={(e) => onChange(cfg.extraNumber.key, e.target.value)} style={{ maxWidth: 140 }} />
        )}
        {cfg.extraSelect && (
          <Select options={cfg.extraSelect.opts} value={state[cfg.extraSelect.key]}
            onChange={(e) => onChange(cfg.extraSelect.key, e.target.value)} style={{ maxWidth: 200 }} />
        )}
      </div>
      <div className="mt-2">
        <MultiCheck options={cfg.opts} values={state.items} onChange={(v) => onChange("items", v)} />
      </div>
      {cfg.extraText && (
        <TextInput className="mt-2" placeholder={cfg.extraText.placeholder} value={state[cfg.extraText.key]}
          onChange={(e) => onChange(cfg.extraText.key, e.target.value)} />
      )}
    </div>
  );
}

function StepRuimteEigenschappen({ d, setEig, addSlaapkamer, removeSlaapkamer, updateSlaapkamer, addExtraRuimte, removeExtraRuimte, updateExtraRuimte }) {
  return (
    <div>
      <div className="mb-6">
        {RUIMTE_CHECKLISTS.slice(0, 4).map((cfg) => (
          <RoomChecklist key={cfg.key} cfg={cfg} state={d.eigenschappen[cfg.key]}
            onChange={(field, val) => setEig(cfg.key, field, val)} />
        ))}
      </div>

      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <BedDouble size={14} style={{ color: BRASS }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Slaapkamers</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr 110px 32px" }}>
            {["Naam", "Vloer", "Verdieping", "Inbouwkasten", ""].map((h, i) => (
              <span key={i} className="text-xs" style={{ color: INK_SOFT, fontWeight: 500 }}>{h}</span>
            ))}
          </div>
          {d.slaapkamers.map((s) => (
            <div key={s.id} className="grid gap-2 items-center" style={{ gridTemplateColumns: "1fr 1fr 1fr 110px 32px" }}>
              <TextInput value={s.naam} onChange={(e) => updateSlaapkamer(s.id, "naam", e.target.value)} />
              <TextInput placeholder="Vloer" value={s.vloer} onChange={(e) => updateSlaapkamer(s.id, "vloer", e.target.value)} />
              <TextInput placeholder="Verdieping" value={s.verdieping} onChange={(e) => updateSlaapkamer(s.id, "verdieping", e.target.value)} />
              <Select options={["Ja", "Nee"]} value={s.ingemaaktKasten} onChange={(e) => updateSlaapkamer(s.id, "ingemaaktKasten", e.target.value)} />
              <button onClick={() => removeSlaapkamer(s.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
            </div>
          ))}
        </div>
        <button onClick={addSlaapkamer} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <Plus size={13} /> Slaapkamer toevoegen
        </button>
      </div>

      {RUIMTE_CHECKLISTS.slice(4).map((cfg) => (
        <RoomChecklist key={cfg.key} cfg={cfg} state={d.eigenschappen[cfg.key]}
          onChange={(field, val) => setEig(cfg.key, field, val)} />
      ))}

      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <Sofa size={14} style={{ color: BRASS }} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Andere ruimtes</span>
        </div>
        <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
          Voor ruimtes die hierboven niet voorzien zijn (bv. bureau, wasplaats, veranda, wellness, atelier, ...).
        </div>
        <div className="flex flex-col gap-3">
          {(d.extraRuimtes || []).map((r) => (
            <div key={r.id} className="rounded-lg p-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
              <div className="grid gap-2 items-center mb-2" style={{ gridTemplateColumns: "1fr 1fr 32px" }}>
                <TextInput placeholder="Naam ruimte (bv. bureau)" value={r.naam} onChange={(e) => updateExtraRuimte(r.id, "naam", e.target.value)} />
                <TextInput placeholder="Vloer" value={r.vloer} onChange={(e) => updateExtraRuimte(r.id, "vloer", e.target.value)} />
                <button onClick={() => removeExtraRuimte(r.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
              </div>
              <TextInput placeholder="Kenmerken / uitrusting (vrije tekst)" value={r.kenmerken} onChange={(e) => updateExtraRuimte(r.id, "kenmerken", e.target.value)} />
            </div>
          ))}
        </div>
        <button onClick={addExtraRuimte} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <Plus size={13} /> Ruimte toevoegen
        </button>
      </div>
    </div>
  );
}

// ---------- step 5: markt & stedenbouw ----------
function StepMarkt({ d, set }) {
  return (
    <div>
      <Section title="Markt & algemeen gebruik" icon={LineChart}>
        <Field label="Gebruik">
          <Select options={["Normaal", "Verhuurd", "Leegstaand"]} value={d.gebruik} onChange={set("gebruik")} />
        </Field>
        <Field label="Bewoonbaarheid"><Select options={OPTS.kwaliteit} value={d.bewoonbaarheid} onChange={set("bewoonbaarheid")} /></Field>
        <Field label="Aanbod te koop"><Select options={OPTS.aanbod} value={d.aanbodTeKoop} onChange={set("aanbodTeKoop")} /></Field>
        <Field label="Aanbod te huur"><Select options={OPTS.aanbod} value={d.aanbodTeHuur} onChange={set("aanbodTeHuur")} /></Field>
        <Field label="Verkoopbaarheid"><Select options={OPTS.kwaliteit} value={d.verkoopbaarheid} onChange={set("verkoopbaarheid")} /></Field>
        <Field label="Uitzicht"><Select options={OPTS.kwaliteit} value={d.uitzicht} onChange={set("uitzicht")} /></Field>
        <Field label="Onderhoud"><Select options={OPTS.kwaliteit} value={d.onderhoud} onChange={set("onderhoud")} /></Field>
        <Field label="Inrichting"><Select options={OPTS.kwaliteit} value={d.inrichting} onChange={set("inrichting")} /></Field>
        <Field label="Klasse" hint="Stuurt de Abex-waarde/m² in de waarderingsmodule">
          <select value={d.klasse} onChange={set("klasse")} style={inputStyle}>
            {["Woningen", "Appartementen"].map((groep) => (
              <optgroup key={groep} label={groep}>
                {KLASSEN.filter((k) => k.type === groep).map((k) => <option key={k.key} value={k.label}>{k.label}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Gevel"><Select options={["2-gevel", "3-gevel", "4-gevel"]} value={d.gevel} onChange={set("gevel")} /></Field>
      </Section>

      {d.gebruik === "Verhuurd" && (
        <Section title="Huurder" icon={Users}>
          <Field label="Naam"><TextInput value={d.huurderNaam} onChange={set("huurderNaam")} /></Field>
          <Field label="Telefoon"><TextInput value={d.huurderTelefoon} onChange={set("huurderTelefoon")} /></Field>
          <Field label="E-mail"><TextInput type="email" value={d.huurderEmail} onChange={set("huurderEmail")} /></Field>
          <Field label="Huurprijs"><TextInput type="number" value={d.huurderHuurprijs} onChange={set("huurderHuurprijs")} /></Field>
          <Field label="Type huurcontract"><Select options={OPTS.huurcontractType} value={d.huurderContractType} onChange={set("huurderContractType")} /></Field>
          <Field label="Duurtijd"><TextInput value={d.huurderDuurtijd} onChange={set("huurderDuurtijd")} placeholder="bv. 9 jaar, start 01/2023" /></Field>
        </Section>
      )}

      <Section title="Juridische gegevens" icon={ClipboardList}>
        <Field label="Type verwervingsakte"><TextInput value={d.aankoopAkteType} onChange={set("aankoopAkteType")} placeholder="bv. akte van aankoop, schenking, erfenis" /></Field>
        <Field label="Datum verwervingsakte"><TextInput type="date" value={d.aankoopAkteDatum} onChange={set("aankoopAkteDatum")} /></Field>
        <Field label="Datum basisakte" hint="Bij mede-eigendom / appartementen"><TextInput type="date" value={d.basisAkteDatum} onChange={set("basisAkteDatum")} /></Field>
        <Field label="Erfdienstbaarheden"><TextInput value={d.erfdienstbaarheden} onChange={set("erfdienstbaarheden")} placeholder="wettelijk of conventioneel" /></Field>
        <Field label="Overige zakelijke rechten" full><TextInput value={d.zakelijkeRechten} onChange={set("zakelijkeRechten")} /></Field>
      </Section>

      <Section title="Stedenbouwkundige gegevens" icon={ClipboardList}>
        <Field label="Gewestplan hoofdbestemming"><Select options={OPTS.gewestplan} value={d.gewestplan} onChange={set("gewestplan")} /></Field>
        <Field label="Erfgoed"><Select options={OPTS.jaNee} value={d.erfgoed} onChange={set("erfgoed")} /></Field>
        <Field label="Voorkooprecht"><Select options={OPTS.jaNee} value={d.voorkooprecht} onChange={set("voorkooprecht")} /></Field>
        <Field label="Bouwmisdrijven"><Select options={OPTS.jaNee} value={d.bouwmisdrijven} onChange={set("bouwmisdrijven")} /></Field>
        <Field label="Vergunning"><Select options={OPTS.jaNee} value={d.vergunning} onChange={set("vergunning")} /></Field>
        <Field label="Verkaveling"><Select options={OPTS.jaNee} value={d.verkaveling} onChange={set("verkaveling")} /></Field>
        <Field label="Watertoets P-score"><Select options={OPTS.score} value={d.watertoetsP} onChange={set("watertoetsP")} /></Field>
        <Field label="Watertoets G-score"><Select options={OPTS.score} value={d.watertoetsG} onChange={set("watertoetsG")} /></Field>
        <Field label="Mobiscore (0-10)"><TextInput type="number" value={d.mobiscore} onChange={set("mobiscore")} /></Field>
      </Section>
    </div>
  );
}

// ---------- documenten ----------
// kruisverwijzing: welk appveld kan uit welk typisch brondocument gehaald worden
const DOC_CROSS_REFERENCE = [
  { veld: "CaPaKey", tabblad: "Type, staat & kadaster", bron: "Elk uittreksel — bovenaan bij \"Perceel\"" },
  { veld: "Kadastrale afdeling / sectie / perceelnr.", tabblad: "Type, staat & kadaster", bron: "Bv. \"afdeling SINT-GILLIS-WAAS 1 ... sectie B ... perceelnummer 0127\"" },
  { veld: "Straat, postcode, gemeente", tabblad: "Opdracht & partijen", bron: "\"Referentienummer\" / adresvermelding op elk uittreksel" },
  { veld: "Gewestplan hoofdbestemming", tabblad: "Markt, stedenbouw & juridisch", bron: "Informatieaanvraag Gewestinfo — \"Hoofdbestemming\"" },
  { veld: "Erfgoed", tabblad: "Markt, stedenbouw & juridisch", bron: "Informatievraag Onroerend erfgoed — \"Resultaat\"" },
  { veld: "Voorkooprecht", tabblad: "Markt, stedenbouw & juridisch", bron: "Informatievraag Vlaamse Voorkooprechten — \"Resultaat\"" },
  { veld: "Watertoets P-score / G-score", tabblad: "Markt, stedenbouw & juridisch", bron: "Overstromingsrapport — \"Perceelscore\" / \"Gebouwenscore\"" },
  { veld: "Bouwmisdrijven", tabblad: "Markt, stedenbouw & juridisch", bron: "Herstelvorderingen / ongeschikt-onbewoonbaar — \"Resultaat\"" },
  { veld: "Mobiscore", tabblad: "Markt, stedenbouw & juridisch", bron: "Mobiscore-uittreksel" },
];

function StepDocumenten({ d, set, addDocumenten, removeDocument, updateDocument }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultaat, setResultaat] = useState(null);
  const fmtSize = (b) => b ? `${(b / 1024).toFixed(0)} kB` : "";
  const pdfDocs = d.documenten.filter((doc) => doc.base64);

  const vulUitDocumenten = async () => {
    setLoading(true);
    setError("");
    setResultaat(null);
    try {
      const prompt = `Je krijgt één of meerdere PDF-documenten mee (bv. een vastgoedinfo-bundel met uittreksels van Geopunt/Digitaal Vlaanderen, Onroerend Erfgoed, Vlaamse Milieumaatschappij, Statbel, Mobiscore, ...). Haal er de volgende gegevens uit, indien aanwezig. Verzin nooit een waarde — laat een veld leeg als het niet met zekerheid in het document staat.
- capakey: de volledige CaPaKey/perceelcode (bv. "46020B0127/00Z000"), meestal bovenaan bij "Perceel"
- kadAfdeling: het afdelingsnummer (bv. "1")
- kadSectie: de sectieletter (bv. "B")
- kadPerceelnummer: het perceelnummer (bv. "0127/00Z000")
- straat, nummer, postcode, gemeente: het adres van het perceel
- gewestplan: de hoofdbestemming volgens het gewestplan, gemapt naar exact één van: "Woongebied", "Woonuitbreidingsgebied", "Agrarisch gebied", "Industriegebied", "Andere"
- erfgoed: "Ja" als het pand beschermd of vastgesteld onroerend erfgoed is, anders "Nee"
- voorkooprecht: "Ja" als er een voorkooprecht van toepassing is, anders "Nee"
- watertoetsP: de perceelscore/P-score (A, B, C of D)
- watertoetsG: de gebouwenscore/G-score (A, B, C of D)
- bouwmisdrijven: "Ja" als er een herstelvordering of ongeschikt-/onbewoonbaarverklaring gevonden werd, anders "Nee"
- mobiscore: de Mobiscore als getal (bv. 5.7)
- bpaRupVerkaveling: korte samenvatting van eventuele bijzondere stedenbouwkundige info (RUP, verkaveling, WORG) indien vermeld

Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat (lege string indien onbekend):
{"capakey":"","kadAfdeling":"","kadSectie":"","kadPerceelnummer":"","straat":"","nummer":"","postcode":"","gemeente":"","gewestplan":"","erfgoed":"","voorkooprecht":"","watertoetsP":"","watertoetsG":"","bouwmisdrijven":"","mobiscore":"","bpaRupVerkaveling":""}`;

      const raw = await callClaudeWithDocs(pdfDocs, prompt, d.id);
      const parsed = extractJson(raw);
      const ingevuld = [];
      Object.entries(parsed).forEach(([veld, waarde]) => {
        if (waarde !== "" && waarde !== null && waarde !== undefined) {
          set(veld)(String(waarde));
          ingevuld.push(veld);
        }
      });
      setResultaat(ingevuld.length ? ingevuld : []);
    } catch (e) {
      setError(`Kon de gegevens niet automatisch invullen (${e.message || "onbekende fout"}). Vul de velden manueel aan.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="rounded-lg p-4 mb-6" style={{ background: BRASS_SOFT, border: `1px solid ${BRASS}` }}>
        <div className="text-xs font-medium mb-1" style={{ color: BRASS }}>Tip</div>
        <div className="text-xs" style={{ color: INK }}>
          Laad hier eerst je vastgoedinfo-bundel (bv. van Geopunt/CIB Vastgoedinfo) op. De AI-knop hieronder leest de PDF's rechtstreeks
          en vult automatisch herkende gegevens in op de bijhorende tabbladen verderop — dat bespaart je het overtypen. Elk automatisch
          ingevuld veld blijft manueel aan te passen of te overschrijven op het betreffende tabblad; controleer dus altijd het resultaat.
        </div>
        <table className="w-full text-xs mt-3" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Veld", "Terug te vinden op tabblad", "Typische bron in het document"].map((h) => (
                <th key={h} className="text-left py-1 pr-3" style={{ color: BRASS, fontWeight: 600, borderBottom: `1px solid ${BRASS}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOC_CROSS_REFERENCE.map((r) => (
              <tr key={r.veld} style={{ borderBottom: `1px dotted ${BRASS}` }}>
                <td className="py-1 pr-3" style={{ color: INK }}>{r.veld}</td>
                <td className="py-1 pr-3" style={{ color: INK_SOFT }}>{r.tabblad}</td>
                <td className="py-1 pr-3" style={{ color: INK_SOFT }}>{r.bron}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title="Juridische info & documenten" icon={Paperclip}>
        <div className="col-span-2">
          <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
            Vergunningen, bodemattest, stedenbouwkundige uittreksels, eigendomsakte, EPC-attest, verkavelingsvergunning, vastgoedinfo-bundel, ...
            Voeg bij elk document kort de kernpunten toe — die tekst wordt gebruikt om de SWOT-analyse te onderbouwen.
          </div>
          <div onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
            style={{ border: `1.5px dashed ${LINE}`, padding: "28px 16px", background: PAPER_RAISED }}>
            <Upload size={18} style={{ color: BRASS }} />
            <span className="text-sm" style={{ color: INK_SOFT }}>Klik om documenten toe te voegen (PDF, Word, tekst)</span>
            <input ref={inputRef} type="file" multiple className="hidden"
              accept=".pdf,.doc,.docx,.txt" onChange={(e) => { addDocumenten(e.target.files); e.target.value = ""; }} />
          </div>

          {pdfDocs.length > 0 && (
            <div className="mt-3">
              <button onClick={vulUitDocumenten} disabled={loading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
                style={{ background: loading ? "#B8B4A8" : STAMP }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {loading ? "Gegevens uitlezen..." : `Gegevens automatisch invullen uit ${pdfDocs.length} PDF${pdfDocs.length === 1 ? "" : "'s"}`}
              </button>
              {error && (
                <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
                  <AlertTriangle size={13} /> {error}
                </div>
              )}
              {resultaat !== null && !error && (
                <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: STAMP_SOFT, color: STAMP }}>
                  <Check size={13} />
                  {resultaat.length
                    ? `${resultaat.length} veld${resultaat.length === 1 ? "" : "en"} automatisch ingevuld — controleer op de bijhorende tabbladen.`
                    : "Geen herkenbare gegevens gevonden in dit document."}
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {d.documenten.length === 0 && <div className="text-sm italic" style={{ color: INK_SOFT }}>Nog geen documenten toegevoegd.</div>}
            {d.documenten.map((doc) => (
              <div key={doc.id} className="rounded-lg p-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText size={14} style={{ color: BRASS }} />
                    <span className="text-sm" style={{ fontWeight: 500 }}>{doc.naam}</span>
                    <span className="text-xs" style={{ color: INK_SOFT }}>{fmtSize(doc.grootte)}</span>
                    {doc.base64 && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: STAMP_SOFT, color: STAMP }}>PDF gereed voor AI-uitlezing</span>}
                  </div>
                  <button onClick={() => removeDocument(doc.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
                </div>
                <textarea value={doc.notities} onChange={(e) => updateDocument(doc.id, "notities", e.target.value)}
                  rows={2} placeholder="Kernpunten uit dit document (bv. beperkingen, erfdienstbaarheden, bouwovertredingen, geldigheid vergunning...)"
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: 13 }} />
              </div>
            ))}
          </div>
        </div>

      </Section>
    </div>
  );
}

// ---------- foto's ----------
function StepFotos({ d, addFotos, removeFoto, updateFoto, setVoorpaginaFoto, removeVoorpaginaFoto }) {
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const voorpaginaInputRef = useRef(null);
  const voorpaginaCameraInputRef = useRef(null);
  const [geweigerd, setGeweigerd] = useState([]);
  return (
    <div>
      <Section title="Voorpagina-foto (optioneel)" icon={ImageIcon}>
        <div className="col-span-2">
          <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
            Een sfeerbeeld voor de cover-pagina van het verslag — bv. een mooie Street View-opname of een eigen foto ter plaatse. Los van de bijlage-foto's hieronder.
          </div>
          {d.voorpaginaFoto ? (
            <div className="rounded-lg overflow-hidden relative" style={{ border: `1px solid ${LINE}`, maxWidth: 360 }}>
              <div className="relative flex items-center justify-center" style={{ aspectRatio: "4/3", background: "rgba(0,0,0,0.03)" }}>
                {!d.voorpaginaFoto.url && !d.voorpaginaFoto.base64 && <Loader2 size={18} className="animate-spin" style={{ color: INK_SOFT }} />}
                {(d.voorpaginaFoto.url || d.voorpaginaFoto.base64) && (
                  <img src={d.voorpaginaFoto.url || d.voorpaginaFoto.base64} alt="Voorpagina" className="w-full h-full object-cover" />
                )}
                <button onClick={removeVoorpaginaFoto}
                  className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
                  style={{ width: 22, height: 22, background: "rgba(27,31,39,0.65)" }}>
                  <X size={12} color="#fff" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3" style={{ maxWidth: 360 }}>
              <div onClick={() => voorpaginaInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
                style={{ border: `1.5px dashed ${LINE}`, padding: "20px 12px", background: PAPER_RAISED }}>
                <Upload size={18} style={{ color: BRASS }} />
                <span className="text-xs text-center" style={{ color: INK_SOFT }}>Kies bestand</span>
                <input ref={voorpaginaInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { if (e.target.files[0]) setVoorpaginaFoto(e.target.files[0]); e.target.value = ""; }} />
              </div>
              <div onClick={() => voorpaginaCameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
                style={{ border: `1.5px dashed ${LINE}`, padding: "20px 12px", background: PAPER_RAISED }}>
                <Camera size={18} style={{ color: BRASS }} />
                <span className="text-xs text-center" style={{ color: INK_SOFT }}>Foto nemen</span>
                <input ref={voorpaginaCameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { if (e.target.files[0]) setVoorpaginaFoto(e.target.files[0]); e.target.value = ""; }} />
              </div>
            </div>
          )}
        </div>
      </Section>
      <Section title="Foto's" icon={ImageIcon}>
        <div className="col-span-2">
          <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
            Vereist: frontzicht en zijdelingse zichten vanop straat (incl. straatuitrusting), zo mogelijk achtergevel en tuin, en interieurfoto's van inrichting/installaties.
            Enkel JPG/JPEG-bestanden worden aanvaard.
          </div>
          <div className="flex gap-3">
            <div onClick={() => inputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
              style={{ border: `1.5px dashed ${LINE}`, padding: "28px 16px", background: PAPER_RAISED }}>
              <Upload size={18} style={{ color: BRASS }} />
              <span className="text-sm" style={{ color: INK_SOFT }}>Klik om foto's toe te voegen (JPG/JPEG)</span>
              <input ref={inputRef} type="file" multiple accept="image/jpeg,.jpg,.jpeg" className="hidden"
                onChange={(e) => { addFotos(e.target.files, setGeweigerd); e.target.value = ""; }} />
            </div>
            <div onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
              style={{ border: `1.5px dashed ${LINE}`, padding: "28px 16px", background: PAPER_RAISED }}>
              <Camera size={18} style={{ color: BRASS }} />
              <span className="text-sm" style={{ color: INK_SOFT }}>Foto nemen met camera</span>
              <input ref={cameraInputRef} type="file" multiple accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { addFotos(e.target.files, setGeweigerd); e.target.value = ""; }} />
            </div>
          </div>
          {geweigerd.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
              <AlertTriangle size={13} /> Niet toegevoegd (enkel JPG/JPEG toegelaten): {geweigerd.join(", ")}
            </div>
          )}
          {d.fotos.length === 0 ? (
            <div className="text-sm italic mt-4" style={{ color: INK_SOFT }}>Nog geen foto's toegevoegd.</div>
          ) : (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {d.fotos.map((f) => (
                <div key={f.id} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
                  <div className="relative flex items-center justify-center" style={{ aspectRatio: "4/3", background: "rgba(0,0,0,0.03)" }}>
                    {!f.url && !f.base64 && <Loader2 size={18} className="animate-spin" style={{ color: INK_SOFT }} />}
                    {(f.url || f.base64) && <img src={f.url || f.base64} alt={f.naam} className="w-full h-full object-cover" />}
                    <button onClick={() => removeFoto(f.id)}
                      className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
                      style={{ width: 22, height: 22, background: "rgba(27,31,39,0.65)" }}>
                      <X size={12} color="#fff" />
                    </button>
                  </div>
                  <select value={f.categorie || "Andere"} onChange={(e) => updateFoto(f.id, "categorie", e.target.value)}
                    style={{ ...inputStyle, borderRadius: 0, border: "none", borderTop: `1px solid ${LINE}`, fontSize: 12, padding: "6px 8px" }}>
                    {OPTS.fotoCategorie.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ---------- SWOT ----------
function StepSwot({ d, set, setD }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: "ai" | "fallback", message }

  const mergeLines = (existing, nieuw) => {
    const have = new Set(existing.split("\n").map((l) => l.trim()).filter(Boolean));
    const toAdd = nieuw.filter((l) => l && !have.has(l.trim()));
    return [existing.trim(), ...toAdd].filter(Boolean).join("\n");
  };

  const toevoegenAanSwot = (voorstel) => {
    setD((prev) => ({
      ...prev,
      sterktes: mergeLines(prev.sterktes, voorstel.sterktes || []),
      zwaktes: mergeLines(prev.zwaktes, voorstel.zwaktes || []),
      kansen: mergeLines(prev.kansen, voorstel.kansen || []),
      bedreigingen: mergeLines(prev.bedreigingen, voorstel.bedreigingen || []),
    }));
  };

  const genereerVoorstel = async () => {
    setLoading(true);
    setStatus(null);
    const pdfDocs = d.documenten.filter((doc) => doc.base64);
    try {
      const summary = buildPropertySummary(d);
      const prompt = `Je bent een Vlaamse vastgoedschatter-expert. Op basis van onderstaande paneelgegevens van een pand${pdfDocs.length ? " en de meegestuurde bijlagen (PDF-documenten)" : ""}, stel je een SWOT-analyse voor in het Nederlands, in de stijl van een professioneel taxatieverslag (zakelijk, feitelijk, geen overdrijvingen). Geef per categorie 3 tot 5 korte, concrete bullets (max. 1 zin per bullet).

Paneelgegevens:
${summary}

Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat:
{"sterktes": ["...", "..."], "zwaktes": ["...", "..."], "kansen": ["...", "..."], "bedreigingen": ["...", "..."]}`;

      const raw = await callClaudeWithDocs(pdfDocs, prompt, d.id);
      const parsed = extractJson(raw);
      toevoegenAanSwot(parsed);
      setStatus({ type: "ai", message: `AI-voorstel toegevoegd${pdfDocs.length ? ` op basis van de tabbladen en ${pdfDocs.length} bijlage${pdfDocs.length === 1 ? "" : "n"}` : " op basis van de ingevulde tabbladen"}.` });
    } catch (e) {
      // vangnet: bij een netwerk-/serverfout toch een bruikbaar voorstel geven, lokaal berekend
      const fallback = genereerAutomatischeSwot(d);
      toevoegenAanSwot(fallback);
      setStatus({ type: "fallback", message: `AI-aanvraag mislukt (${e.message || "onbekende fout"}) — lokaal voorstel toegevoegd op basis van de ingevulde tabbladen.` });
    } finally {
      setLoading(false);
    }
  };

  const box = (label, key, color) => (
    <div>
      <div className="text-xs mb-1.5" style={{ color, fontWeight: 500 }}>{label}</div>
      <textarea value={d[key]} onChange={set(key)} rows={6} placeholder="Eén punt per lijn..."
        style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={15} style={{ color: BRASS }} />
          <h3 style={{ fontFamily: "Georgia, serif", fontSize: 16, color: INK, fontWeight: 500 }}>SWOT-analyse</h3>
        </div>
        <button onClick={genereerVoorstel} disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
          style={{ background: loading ? "#B8B4A8" : STAMP }}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {loading ? "Bezig met genereren..." : "AI-voorstel genereren"}
        </button>
      </div>
      <div className="text-xs mb-4" style={{ color: INK_SOFT }}>
        Gebaseerd op alle ingevulde tabbladen én de opgeladen documenten (bijlagen) bij "Documenten" — die worden rechtstreeks
        als bijlage meegestuurd. Lukt de AI-aanvraag niet, dan valt de app automatisch terug op een lokaal berekend voorstel.
        Voorstellen worden toegevoegd naast wat je al schreef — pas gerust aan of verwijder wat niet klopt.
      </div>
      {status && (
        <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg"
          style={{ background: status.type === "ai" ? STAMP_SOFT : "#FBEAEA", color: status.type === "ai" ? STAMP : DANGER }}>
          {status.type === "ai" ? <Check size={13} /> : <AlertTriangle size={13} />} {status.message}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {box("Sterktes", "sterktes", STAMP)}
        {box("Zwaktes", "zwaktes", DANGER)}
        {box("Kansen", "kansen", BRASS)}
        {box("Bedreigingen", "bedreigingen", DANGER)}
      </div>
      <Section title="Verbouwingen / renovaties" icon={ClipboardList}>
        <Field label="Verbouwingen/renovaties" full>
          <textarea value={d.verbouwingen} onChange={set("verbouwingen")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </Section>
      <Section title="Conclusie & notities" icon={ClipboardList}>
        <Field label="Conclusie" full>
          <textarea value={d.conclusie} onChange={set("conclusie")} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
        <Field label="Notities (intern)" full>
          <textarea value={d.notities} onChange={set("notities")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </Section>
    </div>
  );
}

// ---------- afmetingen & indeling ----------
function StepAfmetingen({ d, set, calc, addRuimte, removeRuimte, updateRuimte, addSchijf, removeSchijf, updateSchijf }) {
  return (
    <div>
      <Section title="Afmetingen" icon={Ruler}>
        <Field label="Gevelbreedte (m)"><TextInput type="number" value={d.breedteGevel} onChange={set("breedteGevel")} /></Field>
        <Field label="Perceelbreedte (m)"><TextInput type="number" value={d.breedtePerceel} onChange={set("breedtePerceel")} /></Field>
        <Field label="Grondoppervlakte (m²)"><TextInput type="number" value={d.grondopp} onChange={set("grondopp")} /></Field>
        <Field label="Bebouwde oppervlakte (m²)"><TextInput type="number" value={d.bebouwdeOpp} onChange={set("bebouwdeOpp")} /></Field>
        <Field label="Bewoonbare oppervlakte — schatting (m²)" hint="Manuele inschatting; wordt vergeleken met de berekende oppervlakte hieronder">
          <TextInput type="number" value={d.bewoonbareOppSchatting} onChange={set("bewoonbareOppSchatting")} />
        </Field>
        <Field label="Oriëntatie"><Select options={OPTS.orientatie} value={d.orientatie} onChange={set("orientatie")} /></Field>
      </Section>

      <Section title="Oppervlakte per bouweenheid" icon={Grid3x3}>
        <div className="col-span-2">
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                  {["Verdieping", "Opp. (m²)", "Coëff.", "Na coëff.", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calc.ruimteRows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td className="px-2 py-1.5">
                      <select value={r.verdieping} onChange={(e) => {
                        updateRuimte(r.id, "verdieping", e.target.value);
                        const v = VERDIEPINGEN.find((x) => x.key === e.target.value);
                        if (v) updateRuimte(r.id, "coeff", v.defCoeff);
                      }} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }}>
                        {VERDIEPINGEN.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 90 }}>
                      <input type="number" value={r.opp} onChange={(e) => updateRuimte(r.id, "opp", e.target.value)}
                        style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 80 }}>
                      <input type="number" step="0.05" value={r.coeff} onChange={(e) => updateRuimte(r.id, "coeff", e.target.value)}
                        style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                    </td>
                    <td className="px-3 py-1.5 font-mono" style={{ fontSize: 13, color: INK_SOFT }}>{r.oppNaCoeff.toFixed(2)} m²</td>
                    <td className="px-2 py-1.5"><button onClick={() => removeRuimte(r.id)}><Trash2 size={14} style={{ color: DANGER }} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: STAMP_SOFT }}>
                  <td className="px-3 py-2 text-sm" style={{ fontWeight: 500, color: STAMP }}>Totaal</td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP, fontWeight: 500 }}>{calc.totOpp.toFixed(2)} m²</td>
                  <td></td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP, fontWeight: 500 }}>{calc.totOppNaCoeff.toFixed(2)} m²</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <button onClick={addRuimte} className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
            style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <Plus size={13} /> Ruimte toevoegen
          </button>
          <div className="text-xs mt-2" style={{ color: INK_SOFT }}>
            Ratio gecorrigeerde / nuttige oppervlakte: <span className="font-mono">{(calc.ratio * 100).toFixed(1)}%</span>
            {d.bewoonbareOppSchatting && (
              <> · schatting vs. berekend:{" "}
                <span className="font-mono" style={{ color: Math.abs(num(d.bewoonbareOppSchatting) - calc.totOppNaCoeff) > 5 ? DANGER : STAMP }}>
                  {d.bewoonbareOppSchatting} m² vs. {calc.totOppNaCoeff.toFixed(1)} m²
                </span>
              </>
            )}
          </div>
        </div>
      </Section>

      <Section title="Grondwaarde per schijf" icon={Ruler}>
        <div className="col-span-2">
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                  {["Omschrijving", "Opp. (m²)", "Prijs/m²", "Waarde", ""].map((h) => (
                    <th key={h} className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.schijven.map((s) => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                    <td className="px-2 py-1.5">
                      <input value={s.naam} onChange={(e) => updateSchijf(s.id, "naam", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 110 }}>
                      <input type="number" value={s.opp} onChange={(e) => updateSchijf(s.id, "opp", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                    </td>
                    <td className="px-2 py-1.5" style={{ width: 110 }}>
                      <input type="number" value={s.prijs} onChange={(e) => updateSchijf(s.id, "prijs", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                    </td>
                    <td className="px-3 py-1.5 font-mono" style={{ fontSize: 13, color: INK_SOFT }}>{eur(num(s.opp) * num(s.prijs))}</td>
                    <td className="px-2 py-1.5"><button onClick={() => removeSchijf(s.id)}><Trash2 size={14} style={{ color: DANGER }} /></button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: STAMP_SOFT }}>
                  <td className="px-3 py-2 text-sm" style={{ fontWeight: 500, color: STAMP }}>Totaal grondwaarde</td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP }}>{calc.totaleGrondopp.toFixed(0)} m²</td>
                  <td></td>
                  <td className="px-3 py-2 font-mono text-sm" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.grondwaarde)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={() => addSchijf()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
              <Plus size={13} /> Schijf toevoegen
            </button>
            <button onClick={() => addSchijf("Landbouwgrond")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${BRASS}`, color: BRASS, background: BRASS_SOFT }}>
              <Plus size={13} /> Landbouwgrond toevoegen
            </button>
            <button onClick={() => addSchijf("Bosgrond")} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${BRASS}`, color: BRASS, background: BRASS_SOFT }}>
              <Plus size={13} /> Bosgrond toevoegen
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ---------- vergelijkingspunten & waarderingsmethode ----------
function StepVergelijkingspunten({ d, set, addVergelijkingspunt, removeVergelijkingspunt, updateVergelijkingspunt }) {
  const vergelijkend = d.wijzeVanWaardering === "Vergelijkende methode";
  return (
    <div>
      <Section title="Wijze van waardering" icon={Ruler}>
        <Field label="Methode" hint="Vergelijkende methode is de regel; analytische/redelijke methode enkel bij ontbreken van directe vergelijkingspunten, gemotiveerd">
          <Select options={OPTS.wijzeVanWaardering} value={d.wijzeVanWaardering} onChange={set("wijzeVanWaardering")} />
        </Field>
        {!vergelijkend && (
          <Field label="Motivering van de afwijking" full>
            <textarea value={d.wijzeVanWaarderingMotivering} onChange={set("wijzeVanWaarderingMotivering")} rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
        )}
      </Section>

      <div className="text-xs mb-4 p-3 rounded-lg" style={{ background: BRASS_SOFT, color: BRASS }}>
        VGL-punten worden intern bijgehouden ter staving van de waardering, maar omwille van de GDPR-wetgeving niet weergegeven in het uiteindelijke verslag.
      </div>

      {d.vergelijkingspunten.map((v, idx) => (
        <div key={v.id} className="rounded-lg p-4 mb-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 14, fontWeight: 500 }}>Vergelijkingspunt {idx + 1}</span>
            <button onClick={() => removeVergelijkingspunt(v.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Adres (postcode, gemeente, straat, nr.)" full>
              <TextInput value={v.adres} onChange={(e) => updateVergelijkingspunt(v.id, "adres", e.target.value)} />
            </Field>
            <Field label="Kadastrale gegevens" hint="Afdeling, sectie, perceelnr., partitienr., opp., KI, detail-ID">
              <TextInput value={v.kadastraleGegevens} onChange={(e) => updateVergelijkingspunt(v.id, "kadastraleGegevens", e.target.value)} />
            </Field>
            <Field label="Bouwjaar">
              <TextInput type="number" value={v.bouwjaar} onChange={(e) => updateVergelijkingspunt(v.id, "bouwjaar", e.target.value)} />
            </Field>
            <Field label="Aard van de transactie">
              <Select options={OPTS.aardTransactie} value={v.aardTransactie} onChange={(e) => updateVergelijkingspunt(v.id, "aardTransactie", e.target.value)} />
            </Field>
            <Field label="Datum transactie">
              <TextInput type="date" value={v.datumTransactie} onChange={(e) => updateVergelijkingspunt(v.id, "datumTransactie", e.target.value)} />
            </Field>
            <Field label="Belastbare grondslag (€)">
              <TextInput type="number" value={v.belastbareGrondslag} onChange={(e) => updateVergelijkingspunt(v.id, "belastbareGrondslag", e.target.value)} />
            </Field>
            <Field label="Ligging / bestemming">
              <TextInput value={v.ligging} onChange={(e) => updateVergelijkingspunt(v.id, "ligging", e.target.value)} />
            </Field>
            <Field label="Oriëntatie">
              <Select options={OPTS.orientatie} value={v.oriëntatie} onChange={(e) => updateVergelijkingspunt(v.id, "oriëntatie", e.target.value)} />
            </Field>
            <Field label="Externe afwerking / onderhoud" full>
              <TextInput value={v.externeAfwerking} onChange={(e) => updateVergelijkingspunt(v.id, "externeAfwerking", e.target.value)} />
            </Field>
            <Field label="Rooilijnbreedte (m)">
              <TextInput type="number" value={v.rooilijnbreedte} onChange={(e) => updateVergelijkingspunt(v.id, "rooilijnbreedte", e.target.value)} />
            </Field>
            <Field label="Gevelbreedte (m)">
              <TextInput type="number" value={v.gevelbreedte} onChange={(e) => updateVergelijkingspunt(v.id, "gevelbreedte", e.target.value)} />
            </Field>
            <Field label="Bebouwde oppervlakte (m²)">
              <TextInput type="number" value={v.bebouwdeOpp} onChange={(e) => updateVergelijkingspunt(v.id, "bebouwdeOpp", e.target.value)} />
            </Field>
            <Field label="Afweging t.o.v. het te schatten goed" full>
              <textarea value={v.afweging} onChange={(e) => updateVergelijkingspunt(v.id, "afweging", e.target.value)} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </div>
        </div>
      ))}
      <button onClick={addVergelijkingspunt} className="flex items-center gap-1.5 text-xs mt-1 px-3 py-1.5 rounded-lg"
        style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
        <Plus size={13} /> Vergelijkingspunt toevoegen
      </button>
    </div>
  );
}

// ---------- waardering ----------
function Slider({ label, value, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: INK_SOFT, fontWeight: 500 }}>{label}</span>
        <span className="font-mono" style={{ color: BRASS }}>{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(e.target.value)} className="w-full" />
    </div>
  );
}

function StepWaardering({ d, set, calc }) {
  return (
    <div>
      <Section title="Vervangingswaarde (Abex)" icon={Calculator}>
        <Field label="Abex-index vandaag" hint="Periodiek te updaten">
          <TextInput type="number" value={d.abexIndexHuidig} onChange={set("abexIndexHuidig")} style={{ color: BRASS }} />
        </Field>
        <Field label="Abex-waarde / m² (geselecteerd)" hint="Klik een cel in de tabel hieronder om te selecteren">
          <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.abexPerM2)} / m²</div>
        </Field>
      </Section>

      <div className="col-span-2 mb-8">
        <div className="text-xs mb-2" style={{ color: INK_SOFT }}>
          Abex-referentietabel — klik een cel om die waarde te gebruiken (herberekend op basis van Abex-index {d.abexIndexHuidig})
        </div>
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                <th className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>Klasse</th>
                <th className="text-right px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>1998</th>
                {[2, 3, 4].map((g) => (
                  <th key={g} className="text-right px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>{g}-gevel</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {["Woningen", "Appartementen"].map((groep) => (
                <React.Fragment key={groep}>
                  <tr><td colSpan={5} className="px-3 py-1.5" style={{ fontSize: 11, fontWeight: 500, color: BRASS, background: BRASS_SOFT }}>{groep}</td></tr>
                  {KLASSEN.filter((k) => k.type === groep).map((k) => (
                    <tr key={k.key} style={{ borderBottom: `1px solid ${LINE}` }}>
                      <td className="px-3 py-1.5" style={{ color: INK_SOFT }}>{k.label}</td>
                      <td className="px-3 py-1.5 text-right font-mono" style={{ color: INK_SOFT }}>{k.basis1998.toFixed(2)}</td>
                      {[2, 3, 4].map((g) => {
                        const val = (k.basis1998 * GEVEL_FACTOR[g]) / ABEX_INDEX_1998 * num(d.abexIndexHuidig);
                        const active = k.label === d.klasse && String(g) === d.gevel.charAt(0);
                        return (
                          <td key={g} className="px-3 py-1.5 text-right font-mono"
                            onClick={() => { set("klasse")(k.label); set("gevel")(`${g}-gevel`); }}
                            style={{ color: active ? STAMP : INK_SOFT, background: active ? STAMP_SOFT : "transparent", fontWeight: active ? 500 : 400, cursor: "pointer" }}
                            title="Klik om deze Abex-waarde te gebruiken">
                            {val.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Section title="Vetusiteit" icon={Calculator}>
        <div className="col-span-2 grid grid-cols-2 gap-5">
          <Slider label="Ouderdom" value={d.vetOuderdom} onChange={set("vetOuderdom")} />
          <Slider label="Frequentie van onderhoud" value={d.vetFrequentie} onChange={set("vetFrequentie")} />
          <Slider label="Gebruik" value={d.vetGebruik} onChange={set("vetGebruik")} />
          <Slider label="Kwaliteit van onderhoud" value={d.vetKwaliteit} onChange={set("vetKwaliteit")} />
        </div>
        <div className="col-span-2 text-sm mt-1" style={{ color: STAMP }}>
          Gemiddelde vetusiteit: <span className="font-mono font-medium">{pct(calc.gemVetusiteit)}</span>
        </div>
      </Section>

      <Section title="Rendementsbenadering (DCF)" icon={Calculator}>
        <Field label="Maandelijkse huurprijs (€)"><TextInput type="number" value={d.huurMaand} onChange={set("huurMaand")} style={{ color: BRASS }} /></Field>
        <Field label="Gedwongen-verkoopfactor"><TextInput type="number" step="0.01" value={d.gedwongenFactor} onChange={set("gedwongenFactor")} style={{ color: BRASS }} /></Field>
        <Field label="Yield van (%)"><TextInput type="number" step="0.05" value={d.yieldVan} onChange={set("yieldVan")} style={{ color: BRASS }} /></Field>
        <Field label="Yield tot (%)"><TextInput type="number" step="0.05" value={d.yieldTot} onChange={set("yieldTot")} style={{ color: BRASS }} /></Field>
        <Field label="Yield stap (%)"><TextInput type="number" step="0.05" value={d.yieldStap} onChange={set("yieldStap")} style={{ color: BRASS }} /></Field>
        <Field label="Jaarhuur (10 maanden, berekend)"><div className="font-mono text-sm py-2" style={{ color: INK_SOFT }}>{eur(calc.jaarhuur)}</div></Field>
      </Section>

      <Section title="Eindconclusie" icon={Calculator}>
        <Field label="Venale waarde" full hint="Standaard voorgesteld gelijk aan de intrinsieke waarde — manueel te overschrijven">
          <TextInput type="number" value={d.venaleWaarde} onChange={set("venaleWaarde")} placeholder={calc.intrinsiek.toFixed(0)} style={{ color: BRASS, fontWeight: 500 }} />
        </Field>
      </Section>

      <div className="mt-8 rounded-lg p-6" style={{ background: PAPER_RAISED, border: `1px solid ${LINE}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 500 }}>Waarderingsoverzicht</span>
          {calc.oppCheck
            ? <span className="flex items-center gap-1 text-xs" style={{ color: STAMP }}><Check size={13} /> gegevens consistent</span>
            : <span className="flex items-center gap-1 text-xs" style={{ color: DANGER }}><AlertTriangle size={13} /> gegevens onvolledig</span>}
        </div>
        <div className="grid grid-cols-2 gap-y-3 gap-x-8 font-mono text-sm">
          <Row label="Nieuwbouwwaarde gebouw" v={eur(calc.nieuwbouwwaarde)} />
          <Row label="Actuele waarde gebouw" v={eur(calc.actueleWaardeGebouw)} />
          <Row label="Grondwaarde" v={eur(calc.grondwaarde)} />
          <Row label="Intrinsieke waarde" v={eur(calc.intrinsiek)} />
          <Row label="Marktwaarde -5%" v={eur(calc.marktOnder)} />
          <Row label="Marktwaarde +5%" v={eur(calc.marktBoven)} />
          <Row label="DCF-waarde" v={calc.dcfWaarde ? eur(calc.dcfWaarde) : "n.v.t."} />
          <Row label="Gedwongen verkoopwaarde" v={calc.dcfWaarde ? eur(calc.gedwongenVerkoop) : "n.v.t."} />
        </div>
        <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: `1px dashed ${LINE}` }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 14, color: STAMP, fontWeight: 500 }}>Venale waarde</span>
          <span className="font-mono" style={{ fontSize: 22, color: STAMP, fontWeight: 500 }}>{eur(calc.venaleWaarde)}</span>
        </div>
      </div>
    </div>
  );
}
function Row({ label, v }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: INK_SOFT, fontFamily: "system-ui" }}>{label}</span>
      <span style={{ color: INK }}>{v}</span>
    </div>
  );
}

// ---------- rapport: helpers ----------
const NL_NUM = ["nul", "een", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien",
  "elf", "twaalf", "dertien", "veertien", "vijftien", "zestien", "zeventien", "achttien", "negentien", "twintig",
  "eenentwintig", "tweeëntwintig", "drieëntwintig", "vierentwintig", "vijfentwintig", "zesentwintig", "zevenentwintig", "achtentwintig", "negenentwintig", "dertig"];
const nlNumber = (n) => NL_NUM[n] || String(n);

const REDEN_ZINSNEDE = {
  "Nalatenschap": "de aangifte van nalatenschap",
  "Verkoop": "een verkoop",
  "Hypothecair krediet": "een hypothecair krediet",
  "Echtscheiding": "een echtscheiding",
  "Gerechtelijk": "een gerechtelijke procedure",
  "Andere": "de opgegeven reden",
};

function voorafgaandeOpmerkingen(d, totalPages) {
  return [
    `Dit schattingsverslag is opgemaakt met naleving van de kwaliteitsvereisten voor schatter-experten, om te dienen als waardering bij ${REDEN_ZINSNEDE[d.reden] || "de opgegeven reden"}.`,
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

const dash = (v) => (v === "" || v === null || v === undefined ? "—" : v);
const joinOrDash = (arr) => (arr && arr.length ? arr.join(", ") : "—");
const unit = (v, u) => (v === "" || v === null || v === undefined ? "—" : `${v} ${u}`);
const isEmptyVal = (v) => v === "" || v === null || v === undefined || v === "—";

// ---------- word-export: zelfstandige, Word-veilige HTML-generator ----------
// Word ondersteunt geen CSS flex/grid, dus deze generator gebruikt uitsluitend <table>-lay-out
// en inline stijlen, volledig los van de Tailwind-klassen die het scherm gebruikt.
const wEsc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const wRow = (k, v) => (isEmptyVal(v) ? "" :
  `<tr><td style="padding:6px 16px 6px 0;color:#4B5160;font-size:14px;vertical-align:top;width:42%;">${wEsc(k)}</td><td style="padding:6px 0;font-size:14px;vertical-align:top;">${wEsc(v)}</td></tr>`);
const wTable = (rows) => {
  const trs = rows.map(([k, v]) => wRow(k, v)).join("");
  return trs ? `<table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">${trs}</table>` : "";
};
const wH = (text) => `<div style="font-size:13px;font-weight:600;color:#8C6A2F;text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;margin:16px 0 8px 0;">${wEsc(text)}</div>`;
const wPara = (label, value) => (isEmptyVal(value) ? "" :
  `<p style="font-size:14px;margin:0 0 10px 0;line-height:1.7;">${label ? `<strong>${wEsc(label)}: </strong>` : ""}${wEsc(value)}</p>`);
const wSimpleTable = (headers, rows) => {
  if (!rows.length) return "";
  const thead = `<tr>${headers.map((h) => `<th style="text-align:left;padding:6px 10px 6px 0;font-size:12px;color:#4B5160;border-bottom:1px solid #DDD8CA;">${wEsc(h)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 10px 6px 0;font-size:14px;border-bottom:1px dotted #DDD8CA;">${wEsc(c)}</td>`).join("")}</tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 16px 0;">${thead}${tbody}</table>`;
};
const wList = (title, items) => (!items.length ? "" :
  `<div style="margin:0 0 12px 0;"><strong style="font-size:14px;">${wEsc(title)}</strong><ul style="margin:6px 0 0 20px;padding:0;font-size:14px;line-height:1.7;">${items.map((i) => `<li style="margin-bottom:3px;">${wEsc(i)}</li>`).join("")}</ul></div>`);
// legt de opgeladen foto's als echte, ingesloten afbeeldingen (data-URL) vast — tijdelijke
// bestandslinks (blob-url) zijn buiten deze pagina/dit document niet geldig, een data-URL wel.
// Telkens 6 foto's (3 kolommen × 2 rijen) samen op een eigen, nette bijlagepagina.
const chunkArray = (arr, size) => { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; };
const wPhotoPage = (fotos) => {
  const cols = 3;
  const rows = [];
  for (let i = 0; i < fotos.length; i += cols) {
    const rowFotos = fotos.slice(i, i + cols);
    const cells = rowFotos.map((f) => `<td style="width:${100 / cols}%;padding:8px;vertical-align:top;">
      <img src="${f.base64}" style="width:100%;height:auto;display:block;border:1px solid #DDD8CA;" />
      <div style="font-size:10px;color:#4B5160;margin-top:4px;text-align:center;">${wEsc(f.categorie || "Andere")}</div>
    </td>`).join("");
    const leeg = Array(cols - rowFotos.length).fill(`<td style="width:${100 / cols}%;"></td>`).join("");
    rows.push(`<tr>${cells}${leeg}</tr>`);
  }
  return `<table style="width:100%;border-collapse:collapse;">${rows.join("")}</table>`;
};

function buildReportData(d, calc, huisstijl) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  // overschaduwt de module-brede wH(): sectiekopjes in de geëxporteerde PDF volgen zo de kleur
  // van de actieve huisstijl (Houpels brass of Huyzen blauw) i.p.v. altijd brass te zijn.
  const wH = (text) => `<div style="font-size:13px;font-weight:600;color:${hs.kleur};text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;margin:16px 0 8px 0;">${wEsc(text)}</div>`;
  const eig = d.eigenschappen;
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`;
  const bullets = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);
  const roomText = (room) => {
    if (!room) return "";
    const parts = [];
    if (room.vloer) parts.push(`Vloer: ${room.vloer}`);
    if (room.aantal) parts.push(`Aantal: ${room.aantal}`);
    if (room.orientatie) parts.push(`Oriëntatie: ${room.orientatie}`);
    if (room.items.length) parts.push(room.items.join(", "));
    if (room.merken) parts.push(`Merken: ${room.merken}`);
    if (room.andere) parts.push(`Andere: ${room.andere}`);
    return parts.join(" — ");
  };
  const wRoomBlock = (label, room) => wPara(label, roomText(room));

  const sections = [];

  sections.push({ title: "Opdracht & partijen", html:
    wH("Identificatie schatter-expert") +
    wTable([["Naam", d.schatterNaam], ["Titel", d.schatterTitel], ["Vlabel-identificatienummer", d.schatterVlabelNummer]]) +
    wH("Opdracht") +
    wTable([
      ["Opdrachtgever", d.opdrachtgeverNaam], ["Adres opdrachtgever", d.opdrachtgeverAdres],
      ["Rijksregister-/ondernemingsnummer", d.opdrachtgeverIdNummer],
      ["Wettelijke vertegenwoordiger", d.opdrachtgeverVertegenwoordiger],
      ["Reden van waardering", d.reden], ["Opdrachtgever aanwezig", d.opdrachtgeverAanwezig],
      ["Datum plaatsbezoek", nlDate(d.datumBezoek)], ["Datum verslag", nlDate(d.datumVerslag)],
      [d.reden === "Nalatenschap" ? "Referentiedatum (overlijden)" : "Referentiedatum schatting", nlDate(d.referentiedatum)],
    ]) +
    wH("Contactgegevens verkoper") +
    wTable([["Naam", d.verkoperNaam], ["Adres", d.verkoperAdres], ["Telefoon", d.verkoperTelefoon], ["E-mail", d.verkoperEmail]]) +
    (d.gebruik === "Verhuurd" ? wH("Huurder") + wTable([
      ["Naam", d.huurderNaam], ["Telefoon", d.huurderTelefoon], ["E-mail", d.huurderEmail],
      ["Huurprijs", d.huurderHuurprijs], ["Type huurcontract", d.huurderContractType], ["Duurtijd", d.huurderDuurtijd],
    ]) : "") });

  sections.push({ title: "Aard en ligging", html:
    wH("Adres & kadaster") +
    wTable([
      ["Adres", adres], ["Dorp/gehucht", d.dorpGehucht], ["CaPaKey", d.capakey],
      ["Kadastrale afdeling", d.kadAfdeling], ["Kadastrale sectie", d.kadSectie],
      ["Perceelnummer", d.kadPerceelnummer], ["Partitienummer", d.kadPartitienummer],
      ["Kadastrale oppervlakte", d.kadastraleOpp ? `${d.kadastraleOpp} m²` : ""],
      ["KI", d.ki], ["Onroerende voorheffing", d.onroerendeVoorheffing],
      ["Detail privatieve eigendom", d.kadDetailPrivatief],
    ]) +
    // leeg gelaten velden/secties worden helemaal weggelaten uit het verslag i.p.v. "niet ingevuld"
    // of een misleidende schijnwaarde (zoals "0%") te tonen — vandaar de expliciete lege-checks
    // hieronder in plaats van de wTable/wRow-waarde gewoon altijd door te geven.
    (d.eigenaars.filter((e) => e.naam).length === 0 ? "" :
      wH("Eigendomstoestand — zakelijke rechten") +
      wTable(d.eigenaars.filter((e) => e.naam).map((e) => [e.naam, `${e.recht}${e.aandeel ? " — " + e.aandeel : ""}`]))) +
    wH("Type onroerend goed") +
    wTable([
      ["Pand", d.pandType], ["Aard", d.aardWoning], ["Bouwtype", d.bouwtype], ["Verdieping(en)", d.verdiepingen],
      ["Lift", d.lift], ["Bouwjaar", d.bouwjaar], ["Renovatiejaar", d.renovatiejaar],
      ["Jaar van aankoop", d.jaarVanAankoop], ["Staat", d.staat.join(", ")],
    ]) });

  sections.push({ title: "Ligging, omgeving & terrein", html:
    ((d.omgevingsvoorzieningen || d.bereikbaarheid || d.bpaRupVerkaveling) ? (
      wH("Ligging in de omgeving") + wPara("Voorzieningen", d.omgevingsvoorzieningen) +
      wPara("Bereikbaarheid", d.bereikbaarheid) + wTable([["Stedenbouwkundige voorschriften", d.bpaRupVerkaveling]])
    ) : "") +
    wH("Terrein & inplanting") +
    wTable([
      ["Vorm van het perceel", d.vormPerceel], ["Rooilijnbreedte", d.rooilijnbreedte ? `${d.rooilijnbreedte} m` : ""],
      // "0%" is voor bodemoccupatie in de praktijk nooit een echt ingevulde waarde, enkel het
      // resultaat van een leeggelaten veld — daarom hier ook expliciet als leeg behandeld
      ["Relatieve hoogteligging", d.hoogteligging],
      ["Bodemoccupatie", (d.bodemoccupatie && Number(d.bodemoccupatie) !== 0) ? `${d.bodemoccupatie}%` : ""],
      ["Aantal bijgebouwen", d.aantalBijgebouwen], ["Inplanting op het terrein", d.inplanting],
    ]) });

  sections.push({ title: "Afmetingen & indeling", html:
    wH("Afmetingen") +
    wTable([
      ["Gevelbreedte", d.breedteGevel ? `${d.breedteGevel} m` : ""], ["Perceelbreedte", d.breedtePerceel ? `${d.breedtePerceel} m` : ""],
      ["Grondoppervlakte", d.grondopp ? `${d.grondopp} m²` : ""], ["Bebouwde oppervlakte", d.bebouwdeOpp ? `${d.bebouwdeOpp} m²` : ""],
      ["Bewoonbare oppervlakte (schatting)", d.bewoonbareOppSchatting ? `${d.bewoonbareOppSchatting} m²` : ""],
      ["Bewoonbare oppervlakte (berekend)", `${calc.totOppNaCoeff.toFixed(1)} m²`],
      ["Oriëntatie", d.orientatie],
    ]) +
    wH("Indeling per ruimte") +
    wSimpleTable(["Verdieping", "Opp. (m²)"], d.ruimtes.map((r) => {
      const v = VERDIEPINGEN.find((x) => x.key === r.verdieping);
      return [v ? v.label : r.verdieping, r.opp || "—"];
    })) });

  sections.push({ title: "Constructie & isolatie", html:
    wH("Ruwbouw, gevels & dak") +
    wTable([
      ["Ruwbouw", d.ruwbouw === "Andere" ? d.ruwbouwAndere : d.ruwbouw],
      ["Voorgevel", d.voorgevel], ["Zijgevel", d.zijgevel], ["Achtergevel", d.achtergevel],
      ["Hoofddak", d.hoofddakType], ["Materiaal hoofddak", d.hoofddakMateriaal],
      ["Bijgebouw", d.bijgebouwConstructie],
    ]) +
    wH("Isolatie") +
    wTable([
      ["EPC", d.epcStatus], ["EPC-waarde", d.epcWaarde ? `${d.epcWaarde} kWh/m²` : ""],
      ["EPC-certificaatnummer", d.epcCertificaatnummer], ["Isolatie", d.isolatie.join(", ")],
    ]) +
    wH("Buitenschrijnwerk") + wPara("", d.buitenschrijnwerk.join(", ")) });

  sections.push({ title: "Verwarming & technische installaties", html:
    wH("Verwarming") +
    wTable([
      ["Soort", d.verwarmingSoort.join(", ")], ["Grondstof", d.verwarmingGrondstof.join(", ")],
      ["Verwarmingselementen", d.verwarmingElementen.join(", ")], ["Merk/type ketel", d.ketelMerkType],
    ]) +
    wH("Warm water") +
    wTable([["Warm water", d.warmWater.join(", ")], ["Merk/type ketel", d.warmWaterKetelMerkType]]) +
    wH("Technische installaties") +
    wTable([["Elektrische keuring", d.keuringStatus], ["Dag + nacht teller", d.dagNachtTeller]]) +
    wPara("Allerlei", d.allerlei.join(", ")) });

  sections.push({ title: "Interieur — eigenschappen per ruimte", html:
    wRoomBlock("Hall", eig.hall) + wRoomBlock("Woonkamer", eig.woonkamer) + wRoomBlock("Keuken", eig.keuken) });

  sections.push({ title: "Interieur — slaapkamers & badkamer", html:
    wH("Interieur") +
    wSimpleTable(["Naam", "Vloer", "Verdieping", "Ingemaakte kasten"], d.slaapkamers.map((s) => [s.naam, s.vloer || "—", s.verdieping || "—", s.ingemaaktKasten])) +
    wRoomBlock("Badkamer", eig.badkamer) });

  const extraRuimtesText = (d.extraRuimtes || []).filter((r) => r.naam)
    .map((r) => `${r.naam}${r.vloer ? " — vloer: " + r.vloer : ""}${r.kenmerken ? " — " + r.kenmerken : ""}`).join("; ");

  sections.push({ title: "Interieur — berging, kelder, garage & tuin", html:
    wRoomBlock("Berging", eig.berging) + wRoomBlock("Kelder", eig.kelder) +
    wRoomBlock("Garage / box / carport / oprit / staanplaats", eig.garage) + wRoomBlock("Tuin / terras", eig.tuinTerras) +
    wPara("Andere ruimtes", extraRuimtesText) +
    (d.verbouwingen ? wH("Verbouwingen / renovaties") + wPara("", d.verbouwingen) : "") });

  sections.push({ title: "Markt & stedenbouwkundige gegevens", html:
    wH("Markt & algemeen gebruik") +
    wTable([
      ["Gebruik", d.gebruik], ["Bewoonbaarheid", d.bewoonbaarheid],
      ["Aanbod te koop", d.aanbodTeKoop], ["Aanbod te huur", d.aanbodTeHuur],
      ["Verkoopbaarheid", d.verkoopbaarheid], ["Uitzicht", d.uitzicht],
      ["Onderhoud", d.onderhoud], ["Inrichting", d.inrichting],
    ]) +
    wH("Stedenbouwkundige gegevens") +
    wTable([
      ["Gewestplan hoofdbestemming", d.gewestplan], ["Erfgoed", d.erfgoed],
      ["Voorkooprecht", d.voorkooprecht], ["Bouwmisdrijven", d.bouwmisdrijven],
      ["Vergunning", d.vergunning], ["Verkaveling", d.verkaveling],
      ["Watertoets P-score", d.watertoetsP], ["Watertoets G-score", d.watertoetsG],
      ["Mobiscore", d.mobiscore ? `${d.mobiscore}/10` : ""],
    ]) +
    wH("Juridische gegevens") +
    wTable([
      ["Type verwervingsakte", d.aankoopAkteType], ["Datum verwervingsakte", nlDate(d.aankoopAkteDatum)],
      ["Datum basisakte", nlDate(d.basisAkteDatum)], ["Erfdienstbaarheden", d.erfdienstbaarheden],
      ["Overige zakelijke rechten", d.zakelijkeRechten],
    ]) });

  sections.push({ title: "SWOT-analyse", html:
    wList("Sterktes", bullets(d.sterktes)) + wList("Zwaktes", bullets(d.zwaktes)) +
    wList("Kansen", bullets(d.kansen)) + wList("Bedreigingen", bullets(d.bedreigingen)) +
    (d.conclusie ? wH("Conclusie") + `<p style="font-size:12px;line-height:1.5;">${wEsc(d.conclusie)}</p>` : "") });

  const methodeLine = `${d.wijzeVanWaardering}${d.wijzeVanWaarderingMotivering ? " — " + d.wijzeVanWaarderingMotivering : ""}`;
  sections.push({ title: "Waardering", html:
    wH("Wijze van waardering") +
    `<p style="font-size:12px;margin:0 0 8px 0;">${wEsc(methodeLine)}</p>` +
    (d.wijzeVanWaardering === "Vergelijkende methode" ?
      `<p style="font-size:12px;font-style:italic;color:#4B5160;margin:0 0 10px 0;">VGL-punten (${d.vergelijkingspunten.length}) — Omwille van de GDPR-wetgeving kunnen de VGL-punten niet worden weergegeven in het verslag.</p>` : "") +
    wH("Waardering op basis van vervangingswaarde") +
    wTable([
      ["Klasse", d.klasse], ["Gevel", d.gevel], ["Abex-waarde/m²", eur(calc.abexPerM2)],
      ["Gemiddelde vetusiteit", pct(calc.gemVetusiteit)],
      ["Intrinsieke waarde", eur(calc.intrinsiek)],
      ["Geschatte marktwaarde", `${eur(calc.marktOnder)} – ${eur(calc.marktBoven)}`],
    ]) +
    (calc.dcfWaarde > 0 ? wH("Rendementsbenadering (DCF)") + wTable([
      ["DCF-waarde", eur(calc.dcfWaarde)], ["Gedwongen verkoopwaarde", eur(calc.gedwongenVerkoop)],
    ]) : "") +
    `<p style="font-size:11px;color:#4B5160;margin:12px 0 8px 0;">${(d.referentiedatum || d.datumVerslag) ? `Referentiedatum: ${wEsc(nlDate(d.referentiedatum || d.datumVerslag))} — ` : ""}De geschatte waarde is de normale venale waarde, zijnde de prijs die vermoedelijk kan worden bekomen bij een normale verkoop onder normale omstandigheden.</p>` +
    `<table style="width:100%;background:#E4EEEB;margin-top:6px;"><tr><td style="padding:10px;font-family:Georgia,serif;font-weight:bold;color:#2F5B4F;">Venale waarde</td><td style="padding:10px;text-align:right;font-size:16px;font-weight:bold;color:#2F5B4F;">${eur(calc.venaleWaarde)}</td></tr></table>` });

  const eedLine = d.eedPlaats && d.datumVerslag ? `Gedaan te ${d.eedPlaats} op ${nlDate(d.datumVerslag)}`
    : d.eedPlaats ? `Gedaan te ${d.eedPlaats}` : d.datumVerslag ? `Gedaan op ${nlDate(d.datumVerslag)}` : "";
  sections.push({ title: "Eedformule", html:
    `<div style="text-align:center;padding:40px 0;">
      <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;margin-bottom:40px;">"Ik zweer dat ik mijn opdracht in eer en geweten getrouw heb vervuld."</p>
      ${eedLine ? `<p style="font-size:12px;color:#4B5160;">${wEsc(eedLine)}</p>` : ""}
      ${d.schatterNaam ? `<p style="font-size:12px;margin-top:30px;">${wEsc(d.schatterNaam)}</p>` : ""}
      ${d.schatterTitel ? `<p style="font-size:11px;color:#4B5160;">${wEsc(d.schatterTitel)}</p>` : ""}
    </div>` });

  sections.push({ title: "Bijlagen", html:
    `<p style="font-size:12px;margin:0 0 6px 0;">${d.fotos.length} foto${d.fotos.length === 1 ? "" : "'s"}</p>` +
    (d.notities ? wH("Notities") + `<p style="font-size:12px;line-height:1.4;">${wEsc(d.notities)}</p>` : "") });

  const fotoChunks = chunkArray(d.fotos.filter((f) => f.base64), 6);
  // enkel gebruikt voor de openingszin "dit verslag telt N bladzijden" — een ruwe schatting
  // volstaat daar, want dat is louter een tekstuele vermelding. De écht-kloppende paginanummers
  // (voettekst + inhoudstafel hieronder) hangen hier NIET van af: die worden op de server exact
  // opgemeten na een eerste render, zie /api/generate-pdf.
  const totalPagesEstimate = 3 + sections.length + fotoChunks.length;
  const opmerkingen = voorafgaandeOpmerkingen(d, totalPagesEstimate);

  const coverHtml = `<div>
    ${hs.logo ? `<img src="${hs.logo}" style="width:64px;height:64px;object-fit:contain;margin-bottom:14px;" />` : ""}
    <p style="font-size:15px;letter-spacing:2px;color:${hs.kleur};margin-bottom:34px;">${wEsc(hs.naam.toUpperCase())}</p>
    ${d.voorpaginaFoto?.base64 ? `<img src="${d.voorpaginaFoto.base64}" style="width:380px;max-width:80%;height:260px;object-fit:cover;border-radius:6px;border:1px solid #DDD8CA;margin-bottom:26px;" />` : ""}
    <p style="font-size:15px;letter-spacing:1px;color:#4B5160;text-transform:uppercase;margin-bottom:10px;">Taxatieverslag</p>
    <h1 style="font-family:Georgia,serif;font-size:36px;font-weight:normal;margin-bottom:18px;">${wEsc(adres)}</h1>
    <p style="font-size:16px;color:#4B5160;">${d.opdrachtgeverNaam ? `Opgemaakt voor ${wEsc(d.opdrachtgeverNaam)} · ` : ""}reden: ${wEsc(d.reden.toLowerCase())}</p>
    ${d.datumVerslag ? `<p style="font-size:16px;color:#4B5160;">Datum verslag: ${wEsc(nlDate(d.datumVerslag))}</p>` : ""}
  </div>`;

  // ---- inhoudstafel met écht kloppende paginanummers ----
  // elk onderdeel dat een eigen regel in de inhoudstafel krijgt, staat hier op volgorde met een
  // vast volgnummer (tocIndex). Vlak vóór dat onderdeel plaatsen we een onzichtbare tekstmerker
  // (tocMark) — de server rendert de pagina één keer, zoekt op welke fysieke bladzijde elke
  // merker terechtkwam, en vult pas dán het bijhorende TOCPAGE_i-plaatshoudertje in de
  // inhoudstafel in met het echte nummer, vóór de definitieve PDF gegenereerd wordt. Zo klopt de
  // inhoudstafel altijd, ongeacht hoe de secties zich natuurlijk over de pagina's verdelen.
  const tocTitles = ["Voorafgaande opmerkingen", "Inhoud",
    ...sections.map((s, i) => `${i + 1}. ${s.title}`),
    ...fotoChunks.map((_, i) => fotoChunks.length > 1 ? `Bijlagen — foto's (${i + 1}/${fotoChunks.length})` : "Bijlagen — foto's")];
  // let op het dubbele vierkante-haakjesformaat "[[TOCMARK:i]]" (i.p.v. simpelweg "TOCMARK_i"):
  // deze merker staat vlak vóór een sectietitel die zelf met een cijfer begint (bv. "1. Aard en
  // ligging" door de sectienummering hieronder) — bij het uitlezen van de PDF-tekstlaag kunnen
  // twee opeenvolgende tekstelementen zonder tussenruimte aan elkaar geplakt worden, waardoor
  // bv. "TOCMARK_2" gevolgd door "1. Aard..." zou lezen als "TOCMARK_21" (verkeerd nummer!). De
  // afsluitende "]]" bakent de merker ondubbelzinnig af, ongeacht wat erna volgt.
  const tocMark = (i) => `<span class="tocmark">[[TOCMARK:${i}]]</span>`;

  const opmerkingenBlockHtml = `<section class="opm-block">
    ${tocMark(0)}
    <h2 style="font-size:12px;letter-spacing:0.5px;margin-bottom:10px;">VOORAFGAANDE OPMERKINGEN</h2>
    <ul style="font-size:9px;line-height:1.4;margin:0;padding-left:14px;">
      ${opmerkingen.map((o) => `<li style="margin-bottom:4px;">${wEsc(o)}</li>`).join("")}
    </ul>
  </section>`;

  const tocBlockHtml = `<section class="toc-block">
    ${tocMark(1)}
    <h2 style="font-size:14px;letter-spacing:0.5px;margin-bottom:14px;">INHOUD</h2>
    <table style="width:100%;border-collapse:collapse;">
      ${tocTitles.map((t, i) => `<tr><td style="padding:5px 0;font-size:12px;border-bottom:1px dotted #DDD8CA;">${wEsc(t)}</td><td style="padding:5px 0;font-size:12px;text-align:right;white-space:nowrap;border-bottom:1px dotted #DDD8CA;">TOCPAGE_${i}</td></tr>`).join("")}
    </table>
  </section>`;

  const sectionsBlockHtml = sections.map((s, i) => `<section class="rsec">
    ${tocMark(2 + i)}
    <h2 class="rsec-title">${i + 1}. ${wEsc(s.title)}</h2>
    ${s.html}
  </section>`).join("");

  const fotoBlockHtml = fotoChunks.map((chunk, i) => `<section class="foto-block">
    ${tocMark(2 + sections.length + i)}
    <h2 class="rsec-title">Bijlagen — foto's${fotoChunks.length > 1 ? ` (${i + 1}/${fotoChunks.length})` : ""}</h2>
    ${wPhotoPage(chunk)}
  </section>`).join("");

  return { coverHtml, opmerkingenBlockHtml, tocBlockHtml, sectionsBlockHtml, fotoBlockHtml, adres };
}

// ---------- PDF-export: doorlopende opmaak, échte automatische paginering ----------
// Geen vaste "1 pagina per sectie" meer: secties vloeien natuurlijk door (break-inside: avoid
// voorkomt enkel een lelijke afbreking mid-sectie), en de fysieke marges + paginanummers worden
// op de server door Puppeteer zelf toegepast op de uiteindelijke, écht gerenderde pagina's — zie
// /api/generate-pdf. Dat garandeert correcte marges en nummering ongeacht hoeveel er precies op
// elke pagina past, in plaats van dat hier vooraf te moeten raden.
function buildPrintHtml(d, calc, huisstijl) {
  const { coverHtml, opmerkingenBlockHtml, tocBlockHtml, sectionsBlockHtml, fotoBlockHtml, adres } = buildReportData(d, calc, huisstijl);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Taxatieverslag ${wEsc(adres)}</title>
<style>
  /* BELANGRIJK — geen "margin" in deze @page-regel zetten (ook niet margin:0): getest en
     bevestigd dat een expliciete @page-marge (zelfs @page{margin:0}) in deze Chromium-versie
     stilzwijgend Puppeteer's eigen page.pdf({margin}) (zie /api/generate-pdf) buiten werking
     zet — de fysieke afdrukmarge viel daardoor helemaal weg (links/rechts/boven zo goed als 0),
     wat de "afdrukmarges links/rechts zijn helemaal niet goed"-klacht verklaarde. Zonder een
     margin-eigenschap op @page (enkel het papierformaat) past Chromium Puppeteer's eigen
     marge-optie wél correct toe — dát is nu de enige plek die de marge bepaalt. Open je dit
     bestand zelf rechtstreeks in je browser (terugvaloptie zonder server), dan gebruikt de
     browser bij het afdrukken zijn eigen standaardmarges. */
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Georgia', 'Times New Roman', serif; color: #1B1F27; background: #fff; }
  table { border-collapse: collapse; }
  .tocmark { font-size: 1px; line-height: 0; color: #ffffff; }
  .cover-page { min-height: 255mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; break-after: page; }
  .opm-block, .toc-block { break-after: page; }
  /* elke sectie en elke foto-pagina begint bewust op een eigen, verse pagina (break-before) i.p.v.
     tegen elkaar aan te schuiven wanneer ze toevallig samen op een bladzijde passen — dat gaf een
     rommelig, "niet ordelijk" ogend resultaat. break-inside:avoid blijft daarnaast bestaan voor
     het (zeldzame) geval dat een sectie net iets te lang is en toch over twee pagina's zou vallen. */
  .rsec, .foto-block { break-inside: avoid; break-before: page; margin: 0 0 22px 0; }
  .rsec-title { font-family: 'Georgia', 'Times New Roman', serif; font-size: 16px; font-weight: 500; color: #1B1F27; margin-bottom: 10px; }
  @media screen {
    body { background: #E5E5E5; padding: 20px 0; }
    .sheet { max-width: 210mm; margin: 0 auto 20px auto; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.15); padding: 20mm 16mm; }
  }
</style>
</head>
<body>
<div class="sheet">
  <div class="cover-page">${coverHtml}</div>
  ${opmerkingenBlockHtml}
  ${tocBlockHtml}
  ${sectionsBlockHtml}
  ${fotoBlockHtml}
</div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body>
</html>`;
}

// ---------- rapport: page chrome ----------
function Page({ n, total, children, noFooter, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  return (
    <div className="rounded-lg mb-6 report-page" style={{ background: PAPER_RAISED, border: `1px solid ${LINE}`, fontFamily: "Georgia, serif", boxShadow: "0 1px 2px rgba(0,0,0,0.03)", position: "relative", minHeight: "261mm" }}>
      <div className="p-8" style={{ paddingBottom: noFooter ? 32 : 68 }}>{children}</div>
      {!noFooter && (
        <div className="flex justify-between items-center px-8 py-3 text-xs"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, borderTop: `1px dotted ${LINE}`, color: INK_SOFT, fontFamily: "system-ui", background: PAPER_RAISED }}>
          <span>{hs.naam}</span>
          <span>Pagina {n} van {total}</span>
        </div>
      )}
    </div>
  );
}
function ReportH({ children }) {
  const hs = useContext(HuisstijlContext);
  return <h2 style={{ fontSize: 13, fontWeight: 600, color: hs.kleur, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 8, fontFamily: "Arial, sans-serif" }}>{children}</h2>;
}
function ReportGrid({ rows }) {
  const filled = rows.filter(([, v]) => !isEmptyVal(v));
  if (filled.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-2" style={{ fontFamily: "system-ui", fontSize: 15 }}>
      {filled.map(([k, v], i) => (
        <div key={k + i} className="flex justify-between" style={{ borderBottom: `1px dotted ${LINE}`, paddingBottom: 4, gap: 12 }}>
          <span style={{ color: INK_SOFT, flexShrink: 0 }}>{k}</span>
          <span style={{ textAlign: "right", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
function ReportList({ title, items }) {
  if (items.length === 0) return null;
  return (
    <div style={{ fontSize: 15 }}>
      <div className="font-medium mb-1">{title}</div>
      <ul className="list-disc pl-5" style={{ color: INK_SOFT, lineHeight: 1.7 }}>{items.map((it, i) => <li key={i} className="mb-0.5">{it}</li>)}</ul>
    </div>
  );
}
function RoomBlock({ label, room }) {
  if (!room) return null;
  const hasContent = room.vloer || room.items.length || room.andere || room.merken || room.aantal || room.orientatie;
  if (!hasContent) return null;
  return (
    <div className="mb-3">
      <div className="font-medium mb-1" style={{ fontFamily: "system-ui", fontSize: 15 }}>{label}</div>
      <div style={{ color: INK_SOFT, fontFamily: "system-ui", fontSize: 15, lineHeight: 1.7 }}>
        {room.vloer && <div>Vloer: {room.vloer}</div>}
        {room.aantal && <div>Aantal: {room.aantal}</div>}
        {room.orientatie && <div>Oriëntatie: {room.orientatie}</div>}
        {room.items.length > 0 && <div>{room.items.join(", ")}</div>}
        {room.merken && <div>Merken: {room.merken}</div>}
        {room.andere && <div>Andere: {room.andere}</div>}
      </div>
    </div>
  );
}

// ---------- rapport preview ----------
function StepRapport({ d, calc, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  const bullets = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);
  const eig = d.eigenschappen;
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`;
  const reportRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  // content pages (elk item = 1 pagina), na voorblad + voorafgaande opmerkingen + inhoudstafel
  const contentPages = [
    {
      title: "Opdracht & partijen",
      body: (
        <>
          <ReportH>Identificatie schatter-expert</ReportH>
          <ReportGrid rows={[
            ["Naam", dash(d.schatterNaam)], ["Titel", dash(d.schatterTitel)],
            ["Vlabel-identificatienummer", dash(d.schatterVlabelNummer)],
          ]} />
          <ReportH>Opdracht</ReportH>
          <ReportGrid rows={[
            ["Opdrachtgever", dash(d.opdrachtgeverNaam)], ["Adres opdrachtgever", dash(d.opdrachtgeverAdres)],
            ["Rijksregister-/ondernemingsnummer", dash(d.opdrachtgeverIdNummer)],
            ["Wettelijke vertegenwoordiger", dash(d.opdrachtgeverVertegenwoordiger)],
            ["Reden van waardering", d.reden], ["Opdrachtgever aanwezig", d.opdrachtgeverAanwezig],
            ["Datum plaatsbezoek", nlDate(dash(d.datumBezoek))], ["Datum verslag", nlDate(dash(d.datumVerslag))],
            [d.reden === "Nalatenschap" ? "Referentiedatum (overlijden)" : "Referentiedatum schatting", nlDate(dash(d.referentiedatum))],
          ]} />
          <ReportH>Contactgegevens verkoper</ReportH>
          <ReportGrid rows={[
            ["Naam", dash(d.verkoperNaam)], ["Adres", dash(d.verkoperAdres)],
            ["Telefoon", dash(d.verkoperTelefoon)], ["E-mail", dash(d.verkoperEmail)],
          ]} />
          {d.gebruik === "Verhuurd" && (
            <>
              <ReportH>Huurder</ReportH>
              <ReportGrid rows={[
                ["Naam", dash(d.huurderNaam)], ["Telefoon", dash(d.huurderTelefoon)],
                ["E-mail", dash(d.huurderEmail)], ["Huurprijs", dash(d.huurderHuurprijs)],
                ["Type huurcontract", dash(d.huurderContractType)], ["Duurtijd", dash(d.huurderDuurtijd)],
              ]} />
            </>
          )}
        </>
      ),
    },
    {
      title: "Aard en ligging",
      body: (
        <>
          <ReportH>Adres & kadaster</ReportH>
          <ReportGrid rows={[
            ["Adres", adres], ["Dorp/gehucht", dash(d.dorpGehucht)], ["CaPaKey", dash(d.capakey)],
            ["Kadastrale afdeling", dash(d.kadAfdeling)], ["Kadastrale sectie", dash(d.kadSectie)],
            ["Perceelnummer", dash(d.kadPerceelnummer)], ["Partitienummer", dash(d.kadPartitienummer)],
            ["Kadastrale oppervlakte", d.kadastraleOpp ? `${d.kadastraleOpp} m²` : "—"],
            ["KI", dash(d.ki)], ["Onroerende voorheffing", dash(d.onroerendeVoorheffing)],
            ["Detail privatieve eigendom", dash(d.kadDetailPrivatief)],
          ]} />
          {d.eigenaars.filter((e) => e.naam).length > 0 && (
            <>
              <ReportH>Eigendomstoestand — zakelijke rechten</ReportH>
              <ReportGrid rows={d.eigenaars.filter((e) => e.naam).map((e) => [e.naam, `${e.recht}${e.aandeel ? " — " + e.aandeel : ""}`])} />
            </>
          )}
          <ReportH>Type onroerend goed</ReportH>
          <ReportGrid rows={[
            ["Pand", d.pandType], ["Aard", dash(d.aardWoning)], ["Bouwtype", d.bouwtype], ["Verdieping(en)", dash(d.verdiepingen)],
            ["Lift", d.lift], ["Bouwjaar", dash(d.bouwjaar)], ["Renovatiejaar", dash(d.renovatiejaar)],
            ["Jaar van aankoop", dash(d.jaarVanAankoop)], ["Staat", joinOrDash(d.staat)],
          ]} />
        </>
      ),
    },
    {
      title: "Ligging, omgeving & terrein",
      body: (
        <>
          {(d.omgevingsvoorzieningen || d.bereikbaarheid || d.bpaRupVerkaveling) && (
            <>
              <ReportH>Ligging in de omgeving</ReportH>
              {d.omgevingsvoorzieningen && (
                <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  <strong style={{ color: INK }}>Voorzieningen: </strong>{d.omgevingsvoorzieningen}
                </div>
              )}
              {d.bereikbaarheid && (
                <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  <strong style={{ color: INK }}>Bereikbaarheid: </strong>{d.bereikbaarheid}
                </div>
              )}
              <ReportGrid rows={[
                ["Stedenbouwkundige voorschriften", dash(d.bpaRupVerkaveling)],
              ]} />
            </>
          )}
          <ReportH>Terrein & inplanting</ReportH>
          <ReportGrid rows={[
            ["Vorm van het perceel", dash(d.vormPerceel)], ["Rooilijnbreedte", unit(d.rooilijnbreedte, "m")],
            ["Relatieve hoogteligging", d.hoogteligging],
            ["Bodemoccupatie", (d.bodemoccupatie && Number(d.bodemoccupatie) !== 0) ? unit(d.bodemoccupatie, "%") : "—"],
            ["Aantal bijgebouwen", dash(d.aantalBijgebouwen)], ["Inplanting op het terrein", dash(d.inplanting)],
          ]} />
        </>
      ),
    },
    {
      title: "Afmetingen & indeling",
      body: (
        <>
          <ReportH>Afmetingen</ReportH>
          <ReportGrid rows={[
            ["Gevelbreedte", unit(d.breedteGevel, "m")], ["Perceelbreedte", unit(d.breedtePerceel, "m")],
            ["Grondoppervlakte", unit(d.grondopp, "m²")], ["Bebouwde oppervlakte", unit(d.bebouwdeOpp, "m²")],
            ["Bewoonbare oppervlakte (schatting)", unit(d.bewoonbareOppSchatting, "m²")],
            ["Bewoonbare oppervlakte (berekend)", `${calc.totOppNaCoeff.toFixed(1)} m²`],
            ["Oriëntatie", d.orientatie],
          ]} />
          <ReportH>Indeling per ruimte</ReportH>
          <table className="w-full text-sm" style={{ fontFamily: "system-ui", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                {["Verdieping", "Opp. (m²)"].map((h) => (
                  <th key={h} className="text-left py-1" style={{ color: INK_SOFT, fontSize: 12, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.ruimtes.map((r) => {
                const v = VERDIEPINGEN.find((x) => x.key === r.verdieping);
                return (
                  <tr key={r.id} style={{ borderBottom: `1px dotted ${LINE}` }}>
                    <td className="py-1">{v ? v.label : r.verdieping}</td>
                    <td className="py-1">{dash(r.opp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ),
    },
    {
      title: "Constructie & isolatie",
      body: (
        <>
          <ReportH>Ruwbouw, gevels & dak</ReportH>
          <ReportGrid rows={[
            ["Ruwbouw", d.ruwbouw === "Andere" ? dash(d.ruwbouwAndere) : d.ruwbouw],
            ["Voorgevel", dash(d.voorgevel)], ["Zijgevel", dash(d.zijgevel)], ["Achtergevel", dash(d.achtergevel)],
            ["Hoofddak", d.hoofddakType], ["Materiaal hoofddak", d.hoofddakMateriaal],
            ["Bijgebouw", dash(d.bijgebouwConstructie)],
          ]} />
          <ReportH>Isolatie</ReportH>
          <ReportGrid rows={[
            ["EPC", d.epcStatus], ["EPC-waarde", d.epcWaarde ? `${d.epcWaarde} kWh/m²` : "—"],
            ["EPC-certificaatnummer", dash(d.epcCertificaatnummer)], ["Isolatie", joinOrDash(d.isolatie)],
          ]} />
          <ReportH>Buitenschrijnwerk</ReportH>
          <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{joinOrDash(d.buitenschrijnwerk)}</div>
        </>
      ),
    },
    {
      title: "Verwarming & technische installaties",
      body: (
        <>
          <ReportH>Verwarming</ReportH>
          <ReportGrid rows={[
            ["Soort", joinOrDash(d.verwarmingSoort)], ["Grondstof", joinOrDash(d.verwarmingGrondstof)],
            ["Verwarmingselementen", joinOrDash(d.verwarmingElementen)], ["Merk/type ketel", dash(d.ketelMerkType)],
          ]} />
          <ReportH>Warm water</ReportH>
          <ReportGrid rows={[
            ["Warm water", joinOrDash(d.warmWater)], ["Merk/type ketel", dash(d.warmWaterKetelMerkType)],
          ]} />
          <ReportH>Technische installaties</ReportH>
          <ReportGrid rows={[
            ["Elektrische keuring", d.keuringStatus], ["Dag + nacht teller", d.dagNachtTeller],
          ]} />
          <div className="text-sm mt-1" style={{ fontFamily: "system-ui", color: INK_SOFT }}>Allerlei: {joinOrDash(d.allerlei)}</div>
        </>
      ),
    },
    {
      title: "Interieur — eigenschappen per ruimte",
      body: (
        <>
          <RoomBlock label="Hall" room={eig.hall} />
          <RoomBlock label="Woonkamer" room={eig.woonkamer} />
          <RoomBlock label="Keuken" room={eig.keuken} />
        </>
      ),
    },
    {
      title: "Interieur — slaapkamers & badkamer",
      body: (
        <>
          <ReportH>Interieur</ReportH>
          <table className="w-full text-sm mb-4" style={{ fontFamily: "system-ui", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                {["Naam", "Vloer", "Verdieping", "Ingemaakte kasten"].map((h) => (
                  <th key={h} className="text-left py-1" style={{ color: INK_SOFT, fontSize: 12, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.slaapkamers.map((s) => (
                <tr key={s.id} style={{ borderBottom: `1px dotted ${LINE}` }}>
                  <td className="py-1">{s.naam}</td><td className="py-1">{dash(s.vloer)}</td>
                  <td className="py-1">{dash(s.verdieping)}</td><td className="py-1">{s.ingemaaktKasten}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <RoomBlock label="Badkamer" room={eig.badkamer} />
        </>
      ),
    },
    {
      title: "Interieur — berging, kelder, garage & tuin",
      body: (
        <>
          <RoomBlock label="Berging" room={eig.berging} />
          <RoomBlock label="Kelder" room={eig.kelder} />
          <RoomBlock label="Garage / box / carport / oprit / staanplaats" room={eig.garage} />
          <RoomBlock label="Tuin / terras" room={eig.tuinTerras} />
          {(d.extraRuimtes || []).filter((r) => r.naam).map((r) => (
            <div key={r.id} className="mb-3">
              <div className="text-sm font-medium mb-1" style={{ fontFamily: "system-ui" }}>{r.naam}</div>
              <div className="text-sm" style={{ color: INK_SOFT, fontFamily: "system-ui" }}>
                {r.vloer && <div>Vloer: {r.vloer}</div>}
                {r.kenmerken && <div>{r.kenmerken}</div>}
              </div>
            </div>
          ))}
          {d.verbouwingen && (
            <>
              <ReportH>Verbouwingen / renovaties</ReportH>
              <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.verbouwingen}</div>
            </>
          )}
        </>
      ),
    },
    {
      title: "Markt & stedenbouwkundige gegevens",
      body: (
        <>
          <ReportH>Markt & algemeen gebruik</ReportH>
          <ReportGrid rows={[
            ["Gebruik", d.gebruik], ["Bewoonbaarheid", d.bewoonbaarheid],
            ["Aanbod te koop", d.aanbodTeKoop], ["Aanbod te huur", d.aanbodTeHuur],
            ["Verkoopbaarheid", d.verkoopbaarheid], ["Uitzicht", d.uitzicht],
            ["Onderhoud", d.onderhoud], ["Inrichting", d.inrichting],
          ]} />
          <ReportH>Stedenbouwkundige gegevens</ReportH>
          <ReportGrid rows={[
            ["Gewestplan hoofdbestemming", d.gewestplan], ["Erfgoed", d.erfgoed],
            ["Voorkooprecht", d.voorkooprecht], ["Bouwmisdrijven", d.bouwmisdrijven],
            ["Vergunning", d.vergunning], ["Verkaveling", d.verkaveling],
            ["Watertoets P-score", d.watertoetsP], ["Watertoets G-score", d.watertoetsG],
            ["Mobiscore", d.mobiscore ? `${d.mobiscore}/10` : "—"],
          ]} />
          <ReportH>Juridische gegevens</ReportH>
          <ReportGrid rows={[
            ["Type verwervingsakte", dash(d.aankoopAkteType)], ["Datum verwervingsakte", nlDate(dash(d.aankoopAkteDatum))],
            ["Datum basisakte", nlDate(dash(d.basisAkteDatum))], ["Erfdienstbaarheden", dash(d.erfdienstbaarheden)],
            ["Overige zakelijke rechten", dash(d.zakelijkeRechten)],
          ]} />
        </>
      ),
    },
    {
      title: "SWOT-analyse",
      body: (
        <>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4" style={{ fontFamily: "system-ui" }}>
            <ReportList title="Sterktes" items={bullets(d.sterktes)} />
            <ReportList title="Zwaktes" items={bullets(d.zwaktes)} />
            <ReportList title="Kansen" items={bullets(d.kansen)} />
            <ReportList title="Bedreigingen" items={bullets(d.bedreigingen)} />
          </div>
          {d.conclusie && (
            <>
              <ReportH>Conclusie</ReportH>
              <p className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.conclusie}</p>
            </>
          )}
        </>
      ),
    },
    {
      title: "Waardering",
      body: (
        <>
          <ReportH>Wijze van waardering</ReportH>
          <div className="text-sm mb-2" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
            {d.wijzeVanWaardering}{d.wijzeVanWaarderingMotivering ? ` — ${d.wijzeVanWaarderingMotivering}` : ""}
          </div>
          {d.wijzeVanWaardering === "Vergelijkende methode" && (
            <div className="text-sm mb-4 italic" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
              VGL-punten ({d.vergelijkingspunten.length}) — Omwille van de GDPR-wetgeving kunnen de VGL-punten niet worden weergegeven in het verslag.
            </div>
          )}
          <ReportH>Waardering op basis van vervangingswaarde</ReportH>
          <ReportGrid rows={[
            ["Klasse", d.klasse], ["Gevel", d.gevel], ["Abex-waarde/m²", eur(calc.abexPerM2)],
            ["Gemiddelde vetusiteit", pct(calc.gemVetusiteit)],
            ["Intrinsieke waarde", eur(calc.intrinsiek)],
            ["Geschatte marktwaarde", `${eur(calc.marktOnder)} – ${eur(calc.marktBoven)}`],
          ]} />
          {calc.dcfWaarde > 0 && (
            <>
              <ReportH>Rendementsbenadering (DCF)</ReportH>
              <ReportGrid rows={[
                ["DCF-waarde", eur(calc.dcfWaarde)], ["Gedwongen verkoopwaarde", eur(calc.gedwongenVerkoop)],
              ]} />
            </>
          )}
          <div className="text-sm mt-4 mb-1" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
            {(d.referentiedatum || d.datumVerslag) && <>Referentiedatum: {nlDate(d.referentiedatum || d.datumVerslag)} — </>}
            De geschatte waarde is de normale venale waarde, zijnde de prijs die vermoedelijk kan worden bekomen bij een normale verkoop onder normale omstandigheden.
          </div>
          <div className="mt-2 p-4 rounded flex justify-between items-center" style={{ background: STAMP_SOFT }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 500, color: STAMP }}>Venale waarde</span>
            <span className="font-mono" style={{ fontSize: 20, fontWeight: 500, color: STAMP }}>{eur(calc.venaleWaarde)}</span>
          </div>
        </>
      ),
    },
    {
      title: "Eedformule",
      body: (
        <div className="flex flex-col items-center justify-center text-center" style={{ minHeight: 280 }}>
          <p className="text-sm mb-10" style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: INK }}>
            "Ik zweer dat ik mijn opdracht in eer en geweten getrouw heb vervuld."
          </p>
          {(d.eedPlaats || d.datumVerslag) && (
            <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
              {d.eedPlaats && `Gedaan te ${d.eedPlaats}`}{d.eedPlaats && d.datumVerslag && " op "}{!d.eedPlaats && d.datumVerslag && "Gedaan op "}{nlDate(d.datumVerslag)}
            </div>
          )}
          {d.schatterNaam && <div className="text-sm mt-8" style={{ fontFamily: "system-ui" }}>{d.schatterNaam}</div>}
          {d.schatterTitel && <div className="text-xs" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.schatterTitel}</div>}
        </div>
      ),
    },
    {
      title: "Bijlagen",
      body: (
        <>
          <div className="text-sm mb-3" style={{ fontFamily: "system-ui", color: INK_SOFT }}>
            {d.fotos.length} foto{d.fotos.length === 1 ? "" : "'s"}
          </div>
          {d.notities && (
            <>
              <ReportH>Notities</ReportH>
              <div className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT }}>{d.notities}</div>
            </>
          )}
        </>
      ),
    },
  ];

  // paginanummering: 1 voorblad, 2 voorafgaande opmerkingen, 3 inhoudstafel, 4.. inhoud
  // (dit is enkel de on-scherm voorvertoning — elke sectie krijgt hier voor de duidelijkheid een
  // eigen kaartje; de échte, gedownloade PDF pakt secties waar mogelijk natuurlijk samen op één
  // pagina, zie buildPrintHtml/handlePrintPdf hieronder)
  const FIXED_PAGES = 3;
  const contentPageGroups = contentPages.map((p) => [p]);
  const totalPages = FIXED_PAGES + contentPageGroups.length;
  const opmerkingen = voorafgaandeOpmerkingen(d, totalPages);

  const handlePrintPdf = async () => {
    setError("");
    setExporting(true);
    const html = buildPrintHtml(d, calc, hs);
    const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`;
    const bestandsnaam = `Taxatieverslag_${(d.straat || "verslag").replace(/\s+/g, "_")}`;
    try {
      // echte, rechtstreekse PDF-omzetting op de server — garandeert 100% dezelfde lay-out
      // als de HTML, want dezelfde HTML wordt via een headless Chromium-browser omgezet
      // (zie /api/generate-pdf in het hostingpakket). Enkel beschikbaar zodra de app
      // effectief gehost is met die server-functie; binnen Claude.ai zelf bestaat dat adres
      // niet en valt de app automatisch terug op de HTML-download hieronder.
      // "adres" wordt apart meegestuurd zodat de server een kopregel met adres kan tonen op elke
      // pagina (via Puppeteers headerTemplate) — dat hoort niet in de HTML zelf thuis, want de
      // kopregel moet op élke fysiek gerenderde pagina verschijnen, ongeacht waar de inhoud
      // natuurlijk afbreekt. "huisstijl" wordt om dezelfde reden apart meegestuurd — de
      // kop-/voettekst tonen de firmanaam op élke pagina, ongeacht de huisstijl van de ingelogde
      // gebruiker (zie kiesHuisstijl hierboven).
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, adres, huisstijl: hs }),
      });
      if (!response.ok) {
        // de échte foutmelding van de server tonen (i.p.v. ze te verbergen achter een generieke
        // "niet beschikbaar") — cruciaal om een falende Chromium-render op de server te kunnen
        // onderscheiden van het geval waarin /api/generate-pdf helemaal niet bestaat (bv. binnen
        // Claude.ai zelf, of vóór hosting).
        let detail = `status ${response.status}`;
        try {
          const body = await response.json();
          if (body?.error) detail = body.error;
        } catch (e3) { /* antwoord was geen JSON, hou de status-tekst aan */ }
        throw new Error(detail);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bestandsnaam}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      // terugval zonder server: HTML-bestand downloaden, zelf te openen en als PDF op te slaan
      try {
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${bestandsnaam}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setError(`Server-PDF mislukt (${e.message || "onbekende fout"}) — een HTML-bestand is in de plaats gedownload; open het en kies "Opslaan als PDF". Blijft dit gebeuren, controleer de functielogs van /api/generate-pdf op Vercel.`);
      } catch (e2) {
        setError("Kon het rapport niet voorbereiden. Probeer opnieuw.");
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <HuisstijlContext.Provider value={hs}>
    <div>
      <div className="no-print flex items-center justify-between mb-4">
        <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 500 }}>Rapportvoorbeeld</div>
        <div className="flex gap-2">
          <button onClick={handlePrintPdf} disabled={exporting}
            className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: INK }}>
            {exporting ? "Bezig..." : "Download PDF"}
          </button>
        </div>
      </div>
      {error && (
        <div className="no-print flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}
      <div className="no-print text-xs mb-4" style={{ color: INK_SOFT }}>
        "Download PDF" vraagt een rechtstreeks PDF-bestand op bij de server — dat is enkel actief zodra de app gehost is met de meegeleverde server-functie (zie hostingpakket). Wordt die niet gevonden (zoals hier, binnen Claude.ai), dan downloadt de app in de plaats een HTML-bestand dat je zelf opent; het printvenster start dan automatisch — kies daar "Opslaan als PDF".
      </div>

      <div ref={reportRef}>
      {/* pagina 1: voorblad */}
      <Page n={1} total={totalPages} noFooter huisstijl={huisstijl}>
        <div className="flex flex-col items-center justify-center text-center" style={{ height: "100%" }}>
          {hs.logo && <img src={hs.logo} alt={hs.naam} style={{ width: 64, height: 64, objectFit: "contain", marginBottom: 14 }} />}
          <div className="mb-8" style={{ fontSize: 15, color: hs.kleur, letterSpacing: 2, fontFamily: "system-ui" }}>{hs.naam.toUpperCase()}</div>
          {(d.voorpaginaFoto?.url || d.voorpaginaFoto?.base64) && (
            <img src={d.voorpaginaFoto.url || d.voorpaginaFoto.base64} alt="Voorpagina"
              style={{ width: 380, maxWidth: "80%", height: 260, objectFit: "cover", borderRadius: 6, border: `1px solid ${LINE}`, marginBottom: 26 }} />
          )}
          <div className="mb-3" style={{ fontSize: 15, color: INK_SOFT, letterSpacing: 1, fontFamily: "system-ui", textTransform: "uppercase" }}>Taxatieverslag</div>
          <h1 style={{ fontSize: 40, fontWeight: 500, marginBottom: 18 }}>{adres}</h1>
          <div style={{ fontSize: 17, color: INK_SOFT, fontFamily: "system-ui" }}>
            {d.opdrachtgeverNaam && <>Opgemaakt voor {d.opdrachtgeverNaam} · </>}reden: {d.reden.toLowerCase()}
          </div>
          {d.datumVerslag && <div className="mt-1" style={{ fontSize: 17, color: INK_SOFT, fontFamily: "system-ui" }}>Datum verslag: {nlDate(d.datumVerslag)}</div>}
        </div>
      </Page>

      {/* pagina 2: voorafgaande opmerkingen */}
      <Page n={2} total={totalPages} huisstijl={huisstijl}>
        <h2 style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0.5, marginBottom: 14, fontFamily: "system-ui" }}>VOORAFGAANDE OPMERKINGEN</h2>
        <ul className="text-sm" style={{ fontFamily: "system-ui", color: INK_SOFT, lineHeight: 1.7 }}>
          {opmerkingen.map((o, i) => <li key={i} className="mb-2 pl-4" style={{ textIndent: "-1em" }}>• {o}</li>)}
        </ul>
      </Page>

      {/* pagina 3: inhoudstafel */}
      <Page n={3} total={totalPages} huisstijl={huisstijl}>
        <h2 style={{ fontSize: 15, fontWeight: 500, letterSpacing: 0.5, marginBottom: 14, fontFamily: "system-ui" }}>INHOUD</h2>
        <div style={{ fontFamily: "system-ui" }}>
          {["Voorafgaande opmerkingen", "Inhoud"].map((t, i) => (
            <div key={t} className="flex justify-between text-sm py-1.5" style={{ borderBottom: `1px dotted ${LINE}` }}>
              <span>{t}</span><span className="font-mono" style={{ color: INK_SOFT }}>{i + 2}</span>
            </div>
          ))}
          {contentPageGroups.map((group, i) => group.map((p) => (
            <div key={p.title} className="flex justify-between text-sm py-1.5" style={{ borderBottom: `1px dotted ${LINE}` }}>
              <span>{p.title}</span><span className="font-mono" style={{ color: INK_SOFT }}>{FIXED_PAGES + i + 1}</span>
            </div>
          )))}
        </div>
      </Page>

      {/* inhoudspagina's */}
      {contentPageGroups.map((group, i) => (
        <Page key={group[0].title} n={FIXED_PAGES + i + 1} total={totalPages} huisstijl={huisstijl}>
          {group.map((p, gi) => (
            <div key={p.title} style={{ marginTop: gi > 0 ? 24 : 0 }}>
              <div className="mb-4" style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 500, color: INK }}>{p.title}</div>
              {p.body}
            </div>
          ))}
        </Page>
      ))}
      </div>
    </div>
    </HuisstijlContext.Provider>
  );
}
