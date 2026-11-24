// ----------------------------------------------------------------------------
// domein/controles.js — inhoudelijke controles vóór aflevering
// ----------------------------------------------------------------------------
// valideerDossier (App.jsx) kijkt of de VERPLICHTE velden ingevuld zijn. Deze controles kijken of
// wat ingevuld is ook KLOPT met elkaar — precies de tegenstrijdigheden die een advocaat van de
// tegenpartij er meteen uithaalt: halfopen bebouwing maar 4 gevels in de berekening, twee
// verschillende bewoonbare oppervlaktes, agrarisch gebied met een verkaveling, een SWOT die een
// gegeven tegelijk kans en bedreiging noemt, een asymmetrische marge zonder uitleg, ...
// Elke controle geeft een korte zin met het tabblad waar het rechtgezet wordt. Ze blokkeren niets.
// Pure functie — apart testbaar (zie __tests__/controles.test.js).
import { isResidentieelType, isZonderGebouw, isGrond, isLandbouwgrond, typeVan, GROND, INDUSTRIE } from "./vastgoedtypes.js";
import { epcConsistentie, epcGegevens, epcRegime } from "./epc.js";
import { berekenWaardering } from "./waardering.js";
import { pandNaamKort } from "./locatie.js";

const getal = (v) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const leeg = (v) => !String(v ?? "").trim();
const nl = (v) => String(Math.round(v * 100) / 100).replace(".", ",");
const euro = (v) => `€ ${Math.round(v).toLocaleString("nl-BE")}`;
// redenen waarbij het pand van eigenaar verandert (of kan veranderen): dan horen de attesten erbij
const MET_OVERDRACHT = ["Verkoop", "Echtscheiding", "Gerechtelijk"];
const SWOT_VELDEN = ["sterktes", "zwaktes", "kansen", "bedreigingen"];

export const GEVELS_PER_BOUWTYPE = { Open: "4-gevel", Halfopen: "3-gevel", Gesloten: "2-gevel" };
// grenzen voor coëfficiënten van niet-bewoonbare ruimtes (KAVEX-bandbreedtes, zie VERDIEPINGEN)
const COEFF_MAX = { tuinberging: 0.4, kelder: 0.6, zolder: 0.7 };
const NIET_WOONZONES = ["Agrarisch gebied", "Industriegebied"];

export function inhoudelijkeControles(d, calc) {
  const uit = [];
  const residentieel = isResidentieelType(d);
  const woning = residentieel && (d.pandType || "Woning") === "Woning";

  // 1. bouwtype en gevels (de gevels sturen de ABEX-berekening)
  const verwacht = GEVELS_PER_BOUWTYPE[d.bouwtype];
  if (woning && verwacht && d.gevel && d.gevel !== verwacht && !(calc && calc.isNieuwbouwtabel)) {
    uit.push(`Bouwtype "${d.bouwtype}" en "${d.gevel}" in de berekening spreken elkaar tegen (${d.bouwtype.toLowerCase()} = ${verwacht}) — tabblad Type, staat & kadaster en Markt`);
  }

  // 2. twee bewoonbare oppervlaktes
  const schatting = getal(d.bewoonbareOppSchatting);
  const berekend = calc ? calc.totOppNaCoeff : 0;
  if (residentieel && schatting > 0 && berekend > 0 && Math.abs(schatting - berekend) / berekend > 0.1) {
    uit.push(`Twee bewoonbare oppervlaktes: ${nl(schatting)} m² (schatting) en ${nl(berekend)} m² (berekend, basis van de waardering) — pas de schatting aan of licht het verschil toe — tabblad Afmetingen`);
  }

  // 3. bestemming
  if (d.gewestplan === "Andere" && leeg(d.gewestplanAndere)) {
    uit.push('Gewestplan "Andere" zonder omschrijving: vul de bestemming in (bv. uit het stedenbouwkundig uittreksel) — tabblad Markt');
  }
  if (residentieel && NIET_WOONZONES.includes(d.gewestplan)) {
    if (d.verkaveling === "Ja") uit.push(`${d.gewestplan} én een verkaveling: dat gaat zelden samen — controleer op Geopunt of er een RUP of BPA geldt — tabblad Markt`);
    if (!["Ja", "Nee"].includes(d.zonevreemd)) uit.push(`Woning in ${d.gewestplan.toLowerCase()}: geef aan of ze zonevreemd is — tabblad Markt`);
  }
  if (d.zonevreemd === "Ja" && leeg(d.zonevreemdToelichting)) {
    uit.push("Zonevreemde woning: licht de gevolgen toe (uitbreidingsmogelijkheden, herbouw, vergunningen van bijgebouwen en zwembad) — tabblad Markt");
  }

  // 4. coëfficiënten van niet-bewoonbare ruimtes en een ontbrekende garage
  for (const r of d.ruimtes || []) {
    const max = COEFF_MAX[r.verdieping];
    if (max && getal(r.coeff) > max) uit.push(`Coëfficiënt ${nl(getal(r.coeff))} voor ${r.naam || r.verdieping} ligt hoog (gangbaar tot ${nl(max)}) — tabblad Afmetingen`);
  }
  const garageEig = d.eigenschappen && d.eigenschappen.garage;
  const garageVermeld = garageEig && ((garageEig.items || []).some((x) => /garage/i.test(x)) || getal(garageEig.aantal) > 0);
  if (residentieel && garageVermeld && !(d.ruimtes || []).some((r) => r.verdieping === "garage") && !(d.parkeerplaatsenGarages || []).length) {
    uit.push("Er is een garage vermeld, maar ze staat niet in de oppervlaktetabel en niet bij de parkeerplaatsen/garages — tabblad Afmetingen");
  }

  // 4b. attesten bij een overdracht: asbestattest (gebouw van vóór 2001) en bodemattest
  if (MET_OVERDRACHT.includes(d.reden)) {
    const bouwjaar = parseInt(String(d.bouwjaar || "").trim(), 10);
    if (!isGrond(d) && Number.isFinite(bouwjaar) && bouwjaar < 2001 && leeg(d.asbestattest)) {
      uit.push(`Gebouwd in ${bouwjaar}, dus vóór 2001: bij een ${String(d.reden).toLowerCase()} is een asbestattest verplicht — vermeld het (of dat het ontbreekt) — tabblad Markt`);
    }
    if (leeg(d.bodemattest)) uit.push("Bij een overdracht is een bodemattest verplicht — vermeld het (of dat het ontbreekt) — tabblad Markt");
  }

  // 4c. EPC: label ↔ energiescore, datum ↔ certificaatnummer, EPC van vóór 2019 bij een verkoop,
  // verlopen EPC — zie domein/epc.js
  if (!isZonderGebouw(d)) {
    const epcTab = residentieel ? "tabblad Constructie & isolatie" : "tabblad Bedrijfskenmerken";
    for (const w of epcConsistentie(d)) uit.push(`${w.replace(/\.$/, "")} — ${epcTab}`);
    const e = epcGegevens(d);
    if (e.verlopen) uit.push(`Het EPC is verlopen (geldig tot ${e.geldigTot.split("-").reverse().join("/")}) — laat een nieuw EPC opmaken — ${epcTab}`);
  }

  // 4d. de grondwaarde rekent met een andere oppervlakte dan het perceel (bv. de bebouwde oppervlakte
  // overgenomen als grondschijf): de grondwaarde zelf staat niet in het verslag, dus enkel hier te zien
  if (calc && d.pandType !== "Appartement" && calc.grondwaardeMeetellen !== false && calc.totaleGrondopp > 0) {
    const perceel = getal(d.grondopp) || getal(d.kadastraleOpp);
    if (perceel > 0 && Math.abs(calc.totaleGrondopp - perceel) / perceel > 0.05) {
      uit.push(`De grondwaarde rekent met ${nl(calc.totaleGrondopp)} m² (grondschijven), maar het perceel is ${nl(perceel)} m² — pas de grondschijven aan of licht het verschil toe — tabblad Afmetingen`);
    }
  }

  // 5. onderbouwing van de kostenbenadering
  if (calc && residentieel && !(calc.isGarageStaanplaats) && leeg(d.bouwprijsBasis)) {
    uit.push("Vermeld of de eenheidsprijs per m² inclusief of exclusief btw en erelonen is — tabblad Waardering");
  }
  const bouwjaarOnbekend = leeg(d.bouwjaar) || d.bouwjaar === "Onbekend";
  // bij garage en grond telt de vetusteit niet mee in de waardering (geen afschrijving van een gebouw)
  if (calc && !isZonderGebouw(d) && calc.totaalVetusiteit > 0 && bouwjaarOnbekend && leeg(d.vetusteitMotivering)) {
    uit.push(`Vetusteit van ${nl(calc.totaalVetusiteit)}% terwijl het bouwjaar onbekend is: motiveer de vetusteit (bv. per bouwdeel: schil, technieken, afwerking) — tabblad Waardering`);
  }
  if (calc && calc.marktMargeOnderPct !== calc.marktMargeBovenPct && leeg(d.marktMargeMotivering)) {
    uit.push(`Asymmetrische marktmarge (−${nl(calc.marktMargeOnderPct)}% / +${nl(calc.marktMargeBovenPct)}%) zonder toelichting — tabblad Waardering`);
  }

  // 5a. grond: bestemming en pacht
  if (isGrond(d)) {
    const bouwgrond = typeVan(d) === GROND && /bouwgrond|kavel|projectgrond/i.test(d.pandType || "");
    if (bouwgrond && NIET_WOONZONES.includes(d.gewestplan)) {
      uit.push(`Bouwgrond in ${String(d.gewestplan).toLowerCase()}: controleer de bestemming (RUP, BPA, verkaveling) — tabblad Markt`);
    }
    if (isLandbouwgrond(d) && d.pachtSituatie === "Verpacht" && leeg(d.pachtcorrectiePct) && leeg(d.pachtToelichting)) {
      uit.push("Verpachte landbouwgrond: verantwoord de invloed van de pacht op de waarde (pachtcorrectie of toelichting) — tabblad Type, staat & kadaster of Waardering");
    }
  }

  // 5b. rendementsbenadering: een verkeerd yieldbereik (bv. "van" hoger dan "tot") gaf voorheen stil
  // een rendementswaarde van 0 — zie yieldFout in domein/waardering.js
  if (calc && calc.yieldFout) uit.push(`${calc.yieldFout.replace(/\.$/, "")} — tabblad Waardering`);
  // 5c. kostenbenadering en rendementsbenadering lopen ver uiteen: meestal een te hoge huur of een te
  // scherp rendement (bv. het rendement van nieuwbouw in een bedrijvenzone voor een oude loods)
  if (calc && calc.dcfSamengesteld > 0 && calc.intrinsiek > 0) {
    const kosten = calc.intrinsiek + (calc.energiecorrectieBedrag || 0), rendement = calc.dcfSamengesteld;
    const verschil = Math.abs(kosten - rendement) / ((kosten + rendement) / 2);
    if (verschil > 0.2) {
      uit.push(`De kostenbenadering (${euro(kosten)}) en de ${calc.huurwaardeActief ? "huurwaardebenadering" : "rendementsbenadering"} (${euro(rendement)}) liggen ${Math.round(verschil * 100)}% uit elkaar — controleer huur en rendement (passen ze bij de ouderdom en de ligging?) of motiveer welke methode doorweegt — tabblad Waardering`);
    }
  }

  // 6. SWOT die zichzelf of de invoer tegenspreekt
  const swot = { sterktes: d.sterktes, zwaktes: d.zwaktes, kansen: d.kansen, bedreigingen: d.bedreigingen };
  const tekst = (k) => String(swot[k] || "").toLowerCase();
  for (const term of ["agrarisch", "zonevreemd", "bestemming", "verhuur", "renovatie"]) {
    const positief = ["sterktes", "kansen"].filter((k) => tekst(k).includes(term));
    const negatief = ["zwaktes", "bedreigingen"].filter((k) => tekst(k).includes(term));
    if (positief.length && negatief.length) uit.push(`De SWOT noemt "${term}" zowel bij ${positief.join("/")} als bij ${negatief.join("/")} — kies één kant of verwoord het verschil — tabblad SWOT`);
  }
  // 6b. cijfers en gegevens in de SWOT die niet (meer) kloppen met het dossier — typisch een AI-voorstel
  // dat gemaakt werd vóór een oppervlakte of de eigenaars ingevuld/aangepast werden
  const swotAlles = SWOT_VELDEN.map((k) => String(swot[k] || "")).join("\n");
  if (swotAlles.trim()) {
    const bekend = [calc && calc.totOppNaCoeff, calc && calc.totOpp, calc && calc.totaleGrondopp, d.bewoonbareOppSchatting, d.grondopp, d.kadastraleOpp, d.bebouwdeOpp,
      ...(d.ruimtes || []).map((r) => r.opp), ...(d.schijven || []).map((s) => s.opp)].map(getal).filter((x) => x > 0);
    const vreemd = [];
    for (const m of swotAlles.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)\s*m(?:²|2)(?![a-z0-9])/gi)) {
      const v = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (v > 0 && !bekend.some((b) => Math.abs(b - v) / b <= 0.02) && !vreemd.includes(v)) vreemd.push(v);
    }
    if (vreemd.length) {
      uit.push(`De SWOT vermeldt ${vreemd.map((v) => `${nl(v)} m²`).join(", ")}, een oppervlakte die nergens in het dossier staat${calc && calc.totOppNaCoeff > 0 ? ` (berekend: ${nl(calc.totOppNaCoeff)} m²)` : ""} — tabblad SWOT`);
    }
    const mob = /mobiscore\s*(?:van\s*)?(\d+(?:[.,]\d+)?)/i.exec(swotAlles);
    if (mob && getal(d.mobiscore) > 0 && Math.abs(getal(mob[1]) - getal(d.mobiscore)) > 0.05) {
      uit.push(`De SWOT vermeldt Mobiscore ${mob[1]}, bij de ligging staat ${nl(getal(d.mobiscore))} — tabblad SWOT`);
    }
    if (/eigendom[a-z ]{0,30}onbekend|onbekend[a-z ]{0,30}eigendom/i.test(swotAlles) && (d.eigenaars || []).some((e) => e && !leeg(e.naam))) {
      uit.push("De SWOT noemt de eigendomstoestand onbekend, maar de eigenaar(s) zijn ingevuld — tabblad SWOT");
    }
    if (/vergelijkingspunt|taxatiemethod|waarderingsmethod/i.test(swotAlles)) {
      uit.push("De SWOT bespreekt de waarderingsmethode of de vergelijkingspunten: een SWOT gaat over het pand zelf, niet over het verslag — tabblad SWOT");
    }
  }
  const tuinItems = (d.eigenschappen && d.eigenschappen.tuinTerras && d.eigenschappen.tuinTerras.items) || [];
  if (String(d.aantalBijgebouwen ?? "").trim() === "0" && tuinItems.some((x) => /tuinhuis|poolhouse/i.test(x))) {
    uit.push(`"Aantal bijgebouwen: 0", maar bij de tuin staat een ${tuinItems.find((x) => /tuinhuis|poolhouse/i.test(x)).toLowerCase()} — tabblad Ligging & omgeving`);
  }
  const negatieveKeuring = /(ontbrek|geen)[a-z ]{0,20}keuring|keuring[a-z ]{0,20}(ontbreekt|ontbrekend)/;
  if (d.keuringStatus !== "Keuring niet aanwezig" && (negatieveKeuring.test(tekst("zwaktes")) || negatieveKeuring.test(tekst("bedreigingen")))) {
    uit.push(`De SWOT spreekt van een ontbrekende elektrische keuring, maar bij de installaties staat "${d.keuringStatus || "niets"}" — tabblad SWOT of Verwarming & installaties`);
  }
  // 7. vorm: stukken zonder omschrijving, AI-omgevingsgegevens niet nagekeken, echtscheiding
  const zonderOmschrijving = (d.documenten || []).filter((x) => leeg(x.omschrijving)).length;
  if (zonderOmschrijving) uit.push(`${zonderOmschrijving} geraadpleegd${zonderOmschrijving > 1 ? "e stukken hebben" : " stuk heeft"} geen omschrijving — in het verslag staat dan enkel de bestandsnaam — tabblad Documenten`);
  if (d.liggingOpgezochtAdres && !d.liggingNagekeken) uit.push("De omgevingsgegevens werden via AI opgezocht en zijn nog niet als nagekeken bevestigd — tabblad Ligging & omgeving");
  if (d.reden === "Echtscheiding") {
    if (leeg(d.echtAnderePartij)) uit.push("Echtscheiding: vermeld of de andere partij op de hoogte was van het plaatsbezoek — tabblad Opdracht & partijen");
    if (leeg(d.echtVraagstelling)) uit.push("Echtscheiding: noteer de exacte vraagstelling van notaris of advocaat (bv. ook de waarde zonder de werken?) — tabblad Opdracht & partijen");
    if (d.echtEigendom === "Eigen goed van één partner" && !(getal(d.echtWaardeZonderWerken) > 0)) uit.push("Echtscheiding met een eigen goed: de notaris-vereffenaar kan ook de waarde zonder de (met gemeenschapsgeld uitgevoerde) werken nodig hebben — tabblad Opdracht & partijen");
    if (calc && calc.toonGedwongenVerkoop) uit.push("Echtscheiding: de gedwongen verkoopwaarde staat in het verslag — dat geeft de partij die het pand overneemt een lager ankerpunt — tabblad Waardering");
  }
  return uit;
}

// Alle panden van een dossier: de controles van het hoofdpand, die van elk extra pand (met de naam van
// het pand ervoor) en enkele controles over de panden heen. Voordien keken de controles en de
// kwaliteitsscore enkel naar het hoofdpand: een extra pand met een lege SWOT, de vergelijkende methode
// zonder één vergelijkingspunt of een verlopen EPC bleef onopgemerkt.
const naamVan = (p, standaard) => {
  const kort = pandNaamKort(p);
  return p.pandNaam ? `${p.pandNaam}${kort ? ` (${kort})` : ""}` : (kort || standaard);
};
export function controlesAllePanden(d, calc) {
  const uit = calc ? [...inhoudelijkeControles(d, calc)] : [];
  const extra = Array.isArray(d.extraPanden) ? d.extraPanden : [];
  if (!extra.length) return uit;
  const panden = [
    { pd: d, calc, naam: naamVan(d, "Hoofdpand") },
    ...extra.map((p, i) => {
      // zelfde samenstelling als de waardering en het verslag (zie buildMultiPandReportData)
      const pd = { ...d, ...p, extraPanden: [], parkeerplaatsenGarages: [] };
      return { pd, calc: berekenWaardering(pd), naam: naamVan(p, `Pand ${i + 2}`) };
    }),
  ];
  for (const p of panden.slice(1)) {
    const eigen = [
      ...inhoudelijkeControles(p.pd, p.calc),
      ...(p.pd.wijzeVanWaardering === "Vergelijkende methode" && !(p.pd.vergelijkingspunten || []).length
        ? ["De vergelijkende methode staat als wijze van waardering, maar er zijn geen vergelijkingspunten — kies de methode die je effectief toepast en motiveer ze — tabblad Vergelijkingspunten"] : []),
      ...(SWOT_VELDEN.every((k) => leeg(p.pd[k])) ? ["De SWOT-analyse is leeg — tabblad SWOT"] : []),
    ];
    uit.push(...eigen.map((t) => `${p.naam}: ${t}`));
  }
  // over de panden heen: kosten koper, ligging in dezelfde straat, EPC-regime van gelijkaardige panden
  const kk = [...new Set(panden.map((p) => p.calc && p.calc.dcfTransactiekostenPct).filter((x) => x > 0))];
  if (kk.length > 1) {
    uit.push(`De kosten koper verschillen tussen de panden (${kk.map((x) => `${nl(x)}%`).join(" / ")}) — gebruik hetzelfde percentage of motiveer het verschil — tabblad Waardering`);
  }
  const perStraat = new Map();
  for (const p of panden) {
    if (leeg(p.pd.straat)) continue;
    const sleutel = `${String(p.pd.straat).trim().toLowerCase()}|${String(p.pd.gemeente || "").trim().toLowerCase()}`;
    if (!perStraat.has(sleutel)) perStraat.set(sleutel, []);
    perStraat.get(sleutel).push(p);
  }
  for (const groep of perStraat.values()) {
    const scores = [...new Set(groep.map((p) => getal(p.pd.mobiscore)).filter((x) => x > 0))];
    if (groep.length > 1 && scores.length > 1) {
      uit.push(`Panden in dezelfde straat met een verschillende Mobiscore (${scores.map(nl).join(" / ")}) — neem de ligging over van één pand of verklaar het verschil — tabblad Ligging & omgeving`);
    }
  }
  const industrie = panden.filter((p) => typeVan(p.pd) === INDUSTRIE);
  const regimes = new Set(industrie.map((p) => epcRegime(p.pd)));
  if (industrie.length > 1 && regimes.size > 1) {
    uit.push("Het EPC-regime van de industriële panden is verschillend bepaald (het ene pand valt buiten het EPC NR, het andere niet of nog niet bepaald) — stel het voor elk pand op dezelfde manier vast — tabblad Bedrijfskenmerken");
  }
  return uit;
}
