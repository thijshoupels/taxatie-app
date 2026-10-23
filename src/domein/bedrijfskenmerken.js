// ----------------------------------------------------------------------------
// domein/bedrijfskenmerken.js — kenmerken per bedrijfstype (invoer én verslag uit één bron)
// ----------------------------------------------------------------------------
// Elk bedrijfstype krijgt zijn eigen waardebepalende kenmerken: een kantoor wordt beoordeeld op
// standing, koeling, flexibiliteit en bereikbaarheid; een KMO-unit op poorten, vrije hoogte en het
// aandeel kantoor; industrie & logistiek op vrije hoogte, vloerbelasting, docks, kraanbaan en
// terreinbezetting; retail op ligging, gevelbreedte en zichtbaarheid; horeca op vergunningen,
// afzuiging en brouwerijcontract. Daarnaast hebben alle bedrijfstypes een blok technische
// installaties (verwarming, koeling, ventilatie, krachtstroom, sprinklers, ...).
//
// De definities hieronder sturen zowel het tabblad Bedrijfskenmerken (StepBedrijfskenmerken) als
// het verslag (PDF en voorbeeld): een kenmerk toevoegen = één regel hier. Bestaande velden houden
// hun oude sleutel (kantoorIndeling, winkelGevelbreedte, industrieelVrijeHoogte, ...), zodat oude
// dossiers niets verliezen; een kenmerk dat bij meerdere types hoort (vrije hoogte, poorten,
// vloerbelasting) gebruikt overal dezelfde sleutel, zodat het bij een typewissel blijft staan.
//
// soort: "keuze" (opties: lijst, of de naam van een OPTS-lijst in constants.js), "janee"
// (Ja/Nee/Onbekend — "Onbekend" komt niet in het verslag), "getal" (met eenheid), "tekst", "lang"
// (meerregelig). Pure gegevens + functies, geen import van constants.js (die importeert dit
// bestand voor de standaardwaarden — zie KENMERK_STANDAARD).
import { KANTOOR, KMO, INDUSTRIE, RETAIL, HORECA, bedrijfstypeVan } from "./vastgoedtypes.js";

export const INSTALLATIES = {
  titel: "Installaties & veiligheid",
  velden: [
    { k: "bedrijfsVerwarming", label: "Verwarming", soort: "keuze", opties: ["Centrale verwarming (gas/stookolie)", "Warmtepomp", "HVAC / luchtbehandeling", "Luchtverhitters / heaters", "Stralingspanelen", "Geen", "Andere"] },
    { k: "bedrijfsKoeling", label: "Koeling", soort: "keuze", opties: ["Volledig gekoeld", "Gedeeltelijk gekoeld", "Geen koeling"] },
    { k: "bedrijfsVentilatie", label: "Ventilatie", soort: "keuze", opties: ["Natuurlijke ventilatie", "Mechanische afzuiging (systeem C)", "Balansventilatie met warmterecuperatie (systeem D)"] },
    { k: "bedrijfsKrachtstroom", label: "Krachtstroom (400 V)", soort: "janee" },
    { k: "industrieelElektrischVermogen", label: "Aansluitvermogen", soort: "tekst", hint: "Bv. 160 kVA, hoogspanningscabine" },
    { k: "bedrijfsSprinkler", label: "Sprinklerinstallatie", soort: "janee" },
    { k: "bedrijfsBranddetectie", label: "Branddetectie / brandcentrale", soort: "janee" },
    { k: "bedrijfsAlarm", label: "Inbraakalarm / toegangscontrole", soort: "janee" },
    { k: "bedrijfsZonnepanelenKwp", label: "Zonnepanelen", soort: "getal", eenheid: "kWp" },
    { k: "bedrijfsLaadpunten", label: "Laadpunten elektrische wagens", soort: "getal", eenheid: "st." },
  ],
};

export const KENMERKEN_PER_TYPE = {
  [KANTOOR]: {
    titel: "Kantoor — specifieke kenmerken",
    velden: [
      { k: "kantoorKlasse", label: "Standing", soort: "keuze", opties: ["Klasse A (recent, hoogwaardig afgewerkt)", "Klasse B (courant, gemoderniseerd)", "Klasse C (verouderd)"], hint: "Bepaalt in hoge mate de markthuur per m²" },
      { k: "kantoorIndeling", label: "Indeling", soort: "keuze", opties: "kantoorIndeling" },
      { k: "kantoorVerdiepingen", label: "Aantal verdiepingen", soort: "getal" },
      { k: "kantoorLiftAanwezig", label: "Lift aanwezig", soort: "janee" },
      { k: "kantoorVerhoogdeVloer", label: "Verhoogde technische vloer", soort: "janee" },
      { k: "kantoorServerruimte", label: "Serverruimte / technisch lokaal", soort: "janee" },
      { k: "kantoorBezetting", label: "Gebruik", soort: "keuze", opties: ["Single-tenant (één gebruiker)", "Multi-tenant (meerdere huurders)", "Deelbaar per verdieping"] },
      { k: "kantoorParkeerratio", label: "Parkeerratio", soort: "tekst", hint: "Bv. 1 plaats per 40 m² kantoor" },
      { k: "bedrijfsOpenbaarVervoer", label: "Bereikbaarheid openbaar vervoer", soort: "keuze", opties: ["Uitstekend (station op wandelafstand)", "Goed (tram/bus op wandelafstand)", "Matig", "Beperkt"] },
      { k: "bedrijfsAfstandSnelweg", label: "Afstand tot oprit snelweg", soort: "getal", eenheid: "km" },
      { k: "kantoorCertificering", label: "Certificering", soort: "tekst", hint: "Bv. BREEAM, WELL — indien van toepassing", full: true },
    ],
  },
  [KMO]: {
    titel: "KMO-unit — specifieke kenmerken",
    velden: [
      { k: "industrieelVrijeHoogte", label: "Vrije hoogte", soort: "getal", eenheid: "m", hint: "Onder de laagste dakligger" },
      { k: "kmoPoorten", label: "Aantal sectionale poorten", soort: "getal" },
      { k: "kmoPoortAfmetingen", label: "Afmetingen poort(en)", soort: "tekst", hint: "Breedte × hoogte, bv. 4 × 4,5 m" },
      { k: "kmoKantoorAandeel", label: "Aandeel kantoor / showroom", soort: "getal", eenheid: "%" },
      { k: "kmoMezzanine", label: "Mezzanine / bergzolder", soort: "janee" },
      { k: "industrieelVloerbelasting", label: "Vloerbelasting", soort: "getal", eenheid: "ton/m²" },
      { k: "kmoClusterVme", label: "Deel van een cluster met VME", soort: "janee", hint: "Units in een bedrijfsverzamelgebouw" },
      { k: "kmoVmeBijdrage", label: "VME-bijdrage", soort: "getal", eenheid: "€/maand" },
      { k: "kmoWoonst", label: "Conciërge- of bedrijfswoning", soort: "janee" },
      { k: "bedrijfsAfstandSnelweg", label: "Afstand tot oprit snelweg", soort: "getal", eenheid: "km" },
      { k: "kmoManoeuvreerruimte", label: "Buitenruimte / manoeuvreerruimte", soort: "tekst", full: true, hint: "Bv. eigen voorzone met 6 parkeerplaatsen, bereikbaar voor vrachtwagens" },
    ],
  },
  [INDUSTRIE]: {
    titel: "Industrie & logistiek — specifieke kenmerken",
    velden: [
      { k: "industrieelVrijeHoogte", label: "Vrije hoogte", soort: "getal", eenheid: "m", hint: "Onder de laagste dakligger of kraanbaan" },
      { k: "industrieelVloerbelasting", label: "Vloerbelasting", soort: "getal", eenheid: "ton/m²" },
      { k: "industrieelKolomafstand", label: "Kolomafstand / overspanning", soort: "tekst", hint: "Bv. 12 × 24 m" },
      { k: "industrieelAantalDockLevellers", label: "Aantal laaddocks (dock levellers)", soort: "getal" },
      { k: "kmoPoorten", label: "Aantal gelijkvloerse poorten", soort: "getal" },
      { k: "industrieelKraanbaan", label: "Rolbrug / kraanbaan", soort: "janee" },
      { k: "industrieelKraanCapaciteit", label: "Hijscapaciteit kraan", soort: "getal", eenheid: "ton" },
      { k: "industrieelTerreinbezetting", label: "Terreinbezetting", soort: "getal", eenheid: "%", hint: "Bebouwde oppervlakte / perceeloppervlakte" },
      { k: "industrieelTruckparking", label: "Vrachtwagenparkings", soort: "getal", eenheid: "st." },
      { k: "industrieelRechtsgrond", label: "Rechtsgrond grond", soort: "keuze", opties: ["Volle eigendom", "Erfpacht", "Opstalrecht", "Concessie (havengebied)"] },
      { k: "industrieelRechtsgrondEinde", label: "Einddatum erfpacht / concessie", soort: "tekst" },
      { k: "bedrijfsAfstandSnelweg", label: "Afstand tot oprit snelweg", soort: "getal", eenheid: "km" },
      { k: "industrieelDeelbaarheid", label: "Deelbaarheid", soort: "tekst", hint: "Bv. deelbaar vanaf 500 m² voor meerdere huurders", full: true },
    ],
  },
  [RETAIL]: {
    titel: "Retail — specifieke kenmerken",
    velden: [
      { k: "winkelLocatiecategorie", label: "Locatiecategorie", soort: "keuze", opties: "winkelLocatiecategorie", hint: "De ligging weegt bij een winkelpand doorgaans het zwaarst" },
      { k: "winkelGevelbreedte", label: "Gevelbreedte", soort: "getal", eenheid: "m" },
      { k: "winkelDiepte", label: "Winkeldiepte", soort: "getal", eenheid: "m" },
      { k: "winkelZichtbaarheid", label: "Zichtbaarheid", soort: "keuze", opties: ["Hoekpand", "Uitstekend", "Goed", "Beperkt"] },
      { k: "winkelEtalage", label: "Etalage aanwezig", soort: "janee" },
      { k: "winkelMagazijnAchteraan", label: "Magazijn / opslag achteraan", soort: "janee" },
      { k: "winkelLevering", label: "Leveringsmogelijkheid", soort: "keuze", opties: ["Eigen laad- en loszone", "Via achterzijde / zijstraat", "Enkel via de voorgevel"] },
      { k: "winkelAparteToegang", label: "Aparte toegang tot de bovenverdiepingen", soort: "janee", hint: "Laat afzonderlijke verhuur/bewoning van de verdiepingen toe" },
      { k: "winkelHandelsvergunning", label: "Vergunning handelsvestiging", soort: "keuze", opties: ["Aanwezig", "Niet vereist (kleinhandel < 400 m²)", "Niet aanwezig"] },
      { k: "winkelPasanten", label: "Inschatting voetgangersfrequentie", soort: "tekst", full: true, hint: "Bv. druk, gemiddeld, rustig" },
    ],
  },
  [HORECA]: {
    titel: "Horeca — specifieke kenmerken",
    velden: [
      { k: "horecaType", label: "Type horecazaak", soort: "keuze", opties: "horecaType" },
      { k: "horecaZitplaatsen", label: "Zitplaatsen binnen", soort: "getal" },
      { k: "horecaTerras", label: "Terras aanwezig", soort: "janee" },
      { k: "horecaTerrasPlaatsen", label: "Zitplaatsen terras", soort: "getal" },
      { k: "horecaVergunningUitbating", label: "Uitbatingsvergunning aanwezig", soort: "janee" },
      { k: "horecaBrandattest", label: "Brandveiligheidsattest", soort: "janee" },
      { k: "horecaAfzuiging", label: "Afzuiging tot boven het dak", soort: "janee" },
      { k: "horecaVetvanger", label: "Vetvanger", soort: "janee" },
      { k: "horecaBovenwoning", label: "Uitbaterswoning / bovenwoning", soort: "janee" },
      { k: "horecaBrouwerij", label: "Brouwerijcontract / afnameverplichting", soort: "janee", hint: "Een lopend contract beperkt de vrije keuze van een koper of uitbater" },
      { k: "horecaInrichting", label: "Vaste inrichting in de waardering", soort: "keuze", opties: ["Niet inbegrepen — enkel het onroerend goed", "Inbegrepen"] },
      { k: "horecaKeukenuitrusting", label: "Keukenuitrusting", soort: "tekst", full: true },
    ],
  },
};

// de blokken voor een dossier: eerst het type-eigen blok, dan de technische installaties
export function kenmerkGroepen(d) {
  const eigen = KENMERKEN_PER_TYPE[bedrijfstypeVan(d)];
  return [...(eigen ? [eigen] : []), INSTALLATIES];
}

// standaardwaarden voor initialData / maakLeegPand: janee → "Onbekend", de rest leeg
export const KENMERK_STANDAARD = Object.fromEntries(
  [INSTALLATIES, ...Object.values(KENMERKEN_PER_TYPE)].flatMap((g) => g.velden)
    .map((v) => [v.k, v.soort === "janee" ? "Onbekend" : ""]),
);

// opmaak van één waarde voor het verslag ("" = weglaten)
export function kenmerkWaarde(veld, waarde) {
  const w = String(waarde ?? "").trim();
  if (!w || (veld.soort === "janee" && w === "Onbekend")) return "";
  if (veld.soort === "getal" && veld.eenheid) {
    const tekst = w.replace(".", ",");
    if (veld.eenheid === "€/maand") return `€ ${tekst} per maand`;
    return veld.eenheid === "%" ? `${tekst}%` : `${tekst} ${veld.eenheid}`;
  }
  return w;
}

// [[label, waarde], ...] per groep voor het verslag
export function kenmerkRapportGroepen(d) {
  return kenmerkGroepen(d)
    .map((g) => ({ titel: g.titel, rijen: g.velden.map((v) => [v.label, kenmerkWaarde(v, d[v.k])]).filter(([, w]) => w) }))
    .filter((g) => g.rijen.length > 0);
}
