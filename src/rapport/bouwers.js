// ----------------------------------------------------------------------------
// rapport/bouwers.js — bouwt het volledige verslag (PDF/Word) op uit een dossier + berekening
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 8) zonder de logica zelf te wijzigen.
import { HUISSTIJLEN, RUIMTE_CHECKLISTS, VERDIEPINGEN } from "../constants.js";
import { num, eur, nlDate, wEsc } from "../lib/format.js";
import { veiligeAfbeeldingSrc } from "../lib/afbeeldingen.js";
import { GOOGLE_MAPS_API_KEY, buildStaticMapUrl, buildCadgisKaartHtml } from "../kaarten.jsx";
import {
  berekenWaardering, berekenParkeerplaatsenTotaal,
  rapportVergelijkingspuntRijen, rapportWaarderingsBlokken, rapportVenaleWaardeZin,
} from "../domein/waardering.js";
import { wTable, wH, wPara, wSimpleTable, wList, chunkArray, wPhotoPage, voorafgaandeOpmerkingen } from "./html.js";

// Bouwt enkel de pand-specifieke inhoud (secties 1..N + adres) op basis van één "eenpand-vormig"
// dossierobject — d.i. een dossier zoals het er al sinds jaar en dag uitziet (alle pand-velden op
// het hoogste niveau). Voor een gewoon dossier zonder extra panden is dit exact de volledige
// rapportinhoud; bij een multi-pand dossier (zie extraPanden/maakLeegPand) wordt deze functie
// hieronder eenmaal per pand aangeroepen — telkens op een tijdelijk samengesteld object dat het
// dossier overlapt met de eigen velden van dát pand (zie buildMultiPandReportData) — zodat elk
// pand exact dezelfde, al geteste sectie-opbouw krijgt zonder dat deze functie zelf iets over
// meerdere panden moet weten.
export function buildPandSections(d, calc, huisstijl) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  // overschaduwt de module-brede wH(): sectiekopjes in de geëxporteerde PDF volgen zo de kleur
  // van de actieve huisstijl (Houpels brass of Huyzen blauw) i.p.v. altijd brass te zijn.
  const wH = (text) => `<div style="font-size:13px;font-weight:600;color:${hs.kleur};text-transform:uppercase;letter-spacing:0.5px;font-family:Arial,sans-serif;margin:16px 0 8px 0;">${wEsc(text)}</div>`;
  const eig = d.eigenschappen;
  // vastgoedType (zie StepType) bepaalt hier welke secties in het verslag komen — zie de
  // toelichting bij de steps-array in DossierWizard voor dezelfde conditie in de wizard zelf.
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const adres = `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`;
  const bullets = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean);
  const roomText = (room, cfg) => {
    if (!room) return "";
    const parts = [];
    if (room.type?.length) parts.push(`Type: ${room.type.join(", ")}`);
    if (room.vloer) parts.push(`Vloer: ${room.vloer}`);
    if (room.aantal) parts.push(`Aantal: ${room.aantal}`);
    if (room.orientatie) parts.push(`Oriëntatie: ${room.orientatie}`);
    if (room.items.length) {
      if (cfg?.optGroups) {
        cfg.optGroups.forEach((g) => {
          const sel = room.items.filter((it) => g.opts.includes(it));
          if (sel.length) parts.push(`${g.label}: ${sel.join(", ")}`);
        });
        const overig = room.items.filter((it) => !cfg.optGroups.some((g) => g.opts.includes(it)));
        if (overig.length) parts.push(overig.join(", "));
      } else {
        parts.push(room.items.join(", "));
      }
    }
    if (room.merken) parts.push(`Merken: ${room.merken}`);
    if (room.andere) parts.push(`Andere: ${room.andere}`);
    return parts.join(" — ");
  };
  const wRoomBlock = (label, room, cfg) => wPara(label, roomText(room, cfg));

  const sections = [];

  sections.push({ title: "Opdracht & partijen", html:
    wH("Identificatie schatter-expert") +
    wTable([["Naam", d.schatterNaam], ["Titel", d.schatterTitel], ["BIV-nummer", d.schatterBivNummer], ["Vlabel-identificatienummer", d.schatterVlabelNummer], ["Telefoon", d.schatterTelefoon]]) +
    wH("Opdracht") +
    wTable([
      ["Opdrachtgever", d.opdrachtgeverNaam], ["Adres opdrachtgever", d.opdrachtgeverAdres],
      ["Rijksregister-/ondernemingsnummer", d.opdrachtgeverIdNummer],
      ["Wettelijke vertegenwoordiger", d.opdrachtgeverVertegenwoordiger],
      ["Reden van waardering", d.reden], ["Opdrachtgever aanwezig", d.opdrachtgeverAanwezig],
      ["Datum plaatsbezoek", nlDate(d.datumBezoek)], ["Datum verslag", nlDate(d.datumVerslag)],
      [d.reden === "Nalatenschap" ? "Referentiedatum (overlijden)" : "Referentiedatum schatting", nlDate(d.referentiedatum)],
    ]) +
    (d.reden === "Nalatenschap" ? wH("Nalatenschap — overleden persoon") + wTable([
      ["Naam overleden persoon", d.overledenNaam],
      ["Rijksregisternummer overleden persoon", d.overledenRijksregisternummer],
      ["Dossiernummer Vlabel", d.vlabelDossiernummer],
      ["Datum overlijden", nlDate(d.referentiedatum)],
    ]) : "") +
    wH("Contactgegevens verkoper") +
    wTable([["Naam", d.verkoperNaam], ["Adres", d.verkoperAdres], ["Telefoon", d.verkoperTelefoon], ["E-mail", d.verkoperEmail]]) +
    (d.gebruik === "Verhuurd" ? wH("Huurder") + wTable([
      ["Naam", d.huurderNaam], ["Telefoon", d.huurderTelefoon], ["E-mail", d.huurderEmail],
      ["Huurprijs", d.huurderHuurprijs], ["Type huurcontract", d.huurderContractType], ["Duurtijd", d.huurderDuurtijd],
      // Handelshuurwet-gegevens: enkel relevant/ingevuld bij een niet-residentieel verhuurd pand —
      // zie de toelichting bij de uitbreiding van de Huurder-sectie in StepMarkt.
      ...(!isResidentieel ? [
        ["Aanvangsdatum huurovereenkomst", nlDate(d.huurderAanvangsdatum)],
        ["Eerstvolgende opzegmogelijkheid", d.huurderEersteOpzegmogelijkheid],
        ["Hernieuwingsrecht", d.huurderHernieuwingsrecht !== "Onbekend" ? d.huurderHernieuwingsrecht : ""],
        ["Indexatie", d.huurderIndexatie], ["Huurwaarborg", d.huurderWaarborg],
        ["Bijzonderheden opzegtermijn/-beding", d.huurderOpzegtermijnBijzonderheden],
      ] : []),
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
    // liggingskaart — enkel als er een adres én een Google Maps API-sleutel is (zie
    // GOOGLE_MAPS_API_KEY hierboven); ontbreekt de sleutel, dan laten we de kaart gewoon weg
    // i.p.v. een gebroken afbeelding in het verslag te tonen.
    ((d.straat && d.gemeente && GOOGLE_MAPS_API_KEY) ?
      `<img src="${wEsc(buildStaticMapUrl(adres + ", België"))}" alt="Liggingskaart" style="width:100%;max-width:520px;display:block;border:1px solid #DDD8CA;border-radius:4px;margin:0 0 16px 0;" />` : "") +
    // kadasterkaart (CadGIS), met het opgezochte perceel zelf gemarkeerd — enkel als de bbox al
    // vooraf opgelost is (zie fetchCadgisPerceel/cadgisBbox hierboven), wat gebeurt zodra een
    // geldige CaPaKey werd ingevuld
    buildCadgisKaartHtml(d.cadgisBbox, d.cadgisRingen) +
    // leeg gelaten velden/secties worden helemaal weggelaten uit het verslag i.p.v. "niet ingevuld"
    // of een misleidende schijnwaarde (zoals "0%") te tonen — vandaar de expliciete lege-checks
    // hieronder in plaats van de wTable/wRow-waarde gewoon altijd door te geven.
    (d.eigenaars.filter((e) => e.naam).length === 0 ? "" :
      wH("Eigendomstoestand — zakelijke rechten") +
      wTable(d.eigenaars.filter((e) => e.naam).map((e) => [e.naam, `${e.recht}${e.aandeel ? " — " + e.aandeel : ""}`]))) +
    wH("Type onroerend goed") +
    wTable([
      ["Vastgoedtype", d.vastgoedType + (d.vastgoedType === "Bedrijfsvastgoed" && d.bedrijfsSubtype ? ` — ${d.bedrijfsSubtype}` : "")],
      ["Pand", d.pandType], ["Aard", d.aardWoning], ["Bouwtype", d.bouwtype], ["Verdieping(en)", d.verdiepingen],
      ["Lift", d.lift], ["Bouwjaar", d.bouwjaar], ["Renovatiejaar", d.renovatiejaar],
      ["Jaar van aankoop", d.jaarVanAankoop], ["Staat", d.staat.join(", ")],
    ]) });

  sections.push({ title: "Ligging, omgeving & terrein", html:
    ((d.omgevingsvoorzieningen || d.bereikbaarheid || d.straatuitrusting || d.bpaRupVerkaveling) ? (
      wH("Ligging in de omgeving") + wPara("Voorzieningen", d.omgevingsvoorzieningen) +
      wPara("Bereikbaarheid", d.bereikbaarheid) + wPara("Toestand & uitrusting van de straat", d.straatuitrusting) +
      wTable([["Stedenbouwkundige voorschriften", d.bpaRupVerkaveling]])
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
      [`${isResidentieel ? "Bewoonbare" : "Nuttige vloer"} oppervlakte (schatting)`, d.bewoonbareOppSchatting ? `${d.bewoonbareOppSchatting} m²` : ""],
      [`${isResidentieel ? "Bewoonbare" : "Nuttige vloer"} oppervlakte (berekend)`, `${calc.totOppNaCoeff.toFixed(1)} m²`],
      ["Oriëntatie", d.orientatie],
      ...(d.pandType === "Appartement" ? [
        ["Aandeel gemeenschappelijke delen", d.gemeenschappelijkeDelenOpp ? `${d.gemeenschappelijkeDelenOpp} m²` : ""],
        ["Aandeel in de gemeenschap", d.aandeelDuizendsten ? `${d.aandeelDuizendsten}/1000` : ""],
        ["Effectief grondaandeel", calc.effectiefGrondaandeel > 0 ? `${calc.effectiefGrondaandeel.toFixed(2)} m²` : ""],
      ] : []),
    ]) +
    // Coëfficiënt en oppervlakte ná coëfficiënt horen hier expliciet bij: die coëfficiënt (zolder
    // 0,5; terras 0,9; ...) stuurt de volledige ABEX-waarde, en zonder die twee kolommen kan een
    // lezer de "berekende bewoonbare oppervlakte" onmogelijk narekenen.
    wH("Bouwlaag") +
    wSimpleTable(["Verdieping", "Opp. (m²)", "Coëff.", "Na coëff. (m²)"], d.ruimtes.map((r) => {
      const v = VERDIEPINGEN.find((x) => x.key === r.verdieping);
      const opp = num(r.opp), coeff = num(r.coeff);
      return [v ? v.label : r.verdieping, r.opp || "—", r.coeff ?? "—", opp && coeff ? (opp * coeff).toFixed(1) : "—"];
    })) +
    wTable([
      ["Totale oppervlakte", calc.totOpp > 0 ? `${calc.totOpp.toFixed(1)} m²` : ""],
      ["Berekende oppervlakte na coëfficiënten", calc.totOppNaCoeff > 0 ? `${calc.totOppNaCoeff.toFixed(1)} m²` : ""],
    ]) });

  sections.push({ title: "Constructie & isolatie", html:
    wH("Ruwbouw, gevels & dak") +
    wTable([
      ["Ruwbouw", d.ruwbouw === "Andere" ? d.ruwbouwAndere : d.ruwbouw],
      ["Voorgevel", d.voorgevel], ["Zijgevel", d.zijgevel], ["Achtergevel", d.achtergevel],
      ["Materiaalkwaliteit muren & plafonds", d.materiaalkwaliteitOmschrijving],
      ["Hoofddak", d.hoofddakType], ["Materiaal hoofddak", d.hoofddakMateriaal],
      ["Bijgebouw", d.bijgebouwConstructie],
    ]) +
    wH("Isolatie") +
    // het residentiële EPC (kWh/m²) hieronder is enkel zinvol/ingevuld bij Residentieel — het
    // niet-residentiële EPC-regime (kNR/NR) staat in de Bedrijfskenmerken-sectie hierboven
    wTable([
      ...(isResidentieel ? [["EPC", d.epcStatus], ["EPC-waarde", d.epcWaarde ? `${d.epcWaarde} kWh/m²` : ""],
        ["EPC-certificaatnummer", d.epcCertificaatnummer]] : []),
      ["Isolatie", d.isolatie.join(", ")],
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

  // de drie residentiële ruimte-secties hieronder (hall/woonkamer/keuken, slaapkamers/badkamer,
  // berging/kelder/garage/tuin) komen uit de checklists van StepRuimteEigenschappen, die bij
  // KMO-vastgoed/Bedrijfsvastgoed vervangen is door StepBedrijfskenmerken (zie de steps-array in
  // DossierWizard) — dus verschijnen ze hier ook enkel bij Residentieel, en komt daarvoor in de
  // plaats één "Bedrijfskenmerken"-sectie op basis van de gegevens uit dat tabblad.
  if (isResidentieel) {
    sections.push({ title: "Interieur — eigenschappen per ruimte", html:
      wRoomBlock("Hall", eig.hall) + wRoomBlock("Woonkamer", eig.woonkamer) + wRoomBlock("Keuken", eig.keuken) });

    sections.push({ title: "Interieur — slaapkamers & badkamer", html:
      wH("Interieur") +
      wSimpleTable(["Naam", "Vloer", "Verdieping", "Ingemaakte kasten", "Radiator"], d.slaapkamers.map((s) => [s.naam, s.vloer || "—", s.verdieping || "—", s.ingemaaktKasten, s.radiator || "Nee"])) +
      wRoomBlock("Badkamer", eig.badkamer) });

    const extraRuimtesText = (d.extraRuimtes || []).filter((r) => r.naam)
      .map((r) => `${r.naam}${r.vloer ? " — vloer: " + r.vloer : ""}${r.kenmerken ? " — " + r.kenmerken : ""}`).join("; ");

    sections.push({ title: "Exterieur — berging, kelder, garage & tuin", html:
      wRoomBlock("Berging", eig.berging) + wRoomBlock("Kelder", eig.kelder) +
      wRoomBlock("Garage / box / carport / oprit / staanplaats", eig.garage, RUIMTE_CHECKLISTS.find((c) => c.key === "garage")) + wRoomBlock("Tuin / terras", eig.tuinTerras) +
      wPara("Andere ruimtes", extraRuimtesText) +
      (d.verbouwingen ? wH("Verbouwingen / renovaties") + wPara("", d.verbouwingen) : "") });
  } else {
    const subtype = d.vastgoedType === "Bedrijfsvastgoed" ? d.bedrijfsSubtype : "";
    sections.push({ title: "Bedrijfskenmerken", html:
      wH("Algemene bedrijfskenmerken") +
      wTable([
        ["Vervangingswaarde (nieuwbouw, na veroudering)", d.bedrijfsVervangingswaarde ? eur(num(d.bedrijfsVervangingswaarde)) : ""],
        ["Bestemmingszone", d.bedrijfsBestemmingszone], ["Omgevingsvergunning milieu", d.bedrijfsVergunningMilieu],
        ["Aantal parkeerplaatsen", d.bedrijfsParkeerplaatsen], ["Aantal laadkades", d.bedrijfsLaadkades],
        ["EPC-regime", d.bedrijfsEpcType], ["EPC-waarde", d.bedrijfsEpcWaarde], ["EPC-certificaatnummer", d.bedrijfsEpcCertificaatnummer],
      ]) +
      wPara("Omschrijving indeling & functionaliteit", d.bedrijfsOmschrijvingIndeling) +
      wH("Interne afwerking") +
      wTable([
        ["Vloerafwerking", d.bedrijfsVloerafwerking], ["Wandafwerking", d.bedrijfsWandafwerking], ["Plafondafwerking", d.bedrijfsPlafondafwerking],
      ]) +
      (subtype === "Kantoor" ? wH("Kantoor — specifieke kenmerken") + wTable([
        ["Indeling", d.kantoorIndeling], ["Aantal verdiepingen", d.kantoorVerdiepingen],
        ["Lift aanwezig", d.kantoorLiftAanwezig !== "Onbekend" ? d.kantoorLiftAanwezig : ""],
        ["Serverruimte/technisch lokaal", d.kantoorServerruimte !== "Onbekend" ? d.kantoorServerruimte : ""],
        ["Certificering", d.kantoorCertificering],
      ]) : "") +
      (subtype === "Winkel" ? wH("Winkel — specifieke kenmerken") + wTable([
        ["Locatiecategorie", d.winkelLocatiecategorie], ["Gevelbreedte", d.winkelGevelbreedte ? `${d.winkelGevelbreedte} m` : ""],
        ["Etalage aanwezig", d.winkelEtalage !== "Onbekend" ? d.winkelEtalage : ""],
        ["Magazijn/opslag achteraan", d.winkelMagazijnAchteraan !== "Onbekend" ? d.winkelMagazijnAchteraan : ""],
        ["Inschatting voetgangersfrequentie", d.winkelPasanten],
      ]) : "") +
      (subtype === "Industrieel/logistiek" ? wH("Industrieel/logistiek — specifieke kenmerken") + wTable([
        ["Vrije hoogte", d.industrieelVrijeHoogte ? `${d.industrieelVrijeHoogte} m` : ""],
        ["Vloerbelasting", d.industrieelVloerbelasting ? `${d.industrieelVloerbelasting} ton/m²` : ""],
        ["Aantal dock levellers", d.industrieelAantalDockLevellers], ["Elektrisch vermogen", d.industrieelElektrischVermogen],
        ["Deelbaarheid", d.industrieelDeelbaarheid],
      ]) : "") +
      (subtype === "Horeca" ? wH("Horeca — specifieke kenmerken") + wTable([
        ["Type horecazaak", d.horecaType],
        ["Uitbatingsvergunning aanwezig", d.horecaVergunningUitbating !== "Onbekend" ? d.horecaVergunningUitbating : ""],
        ["Terras aanwezig", d.horecaTerras !== "Onbekend" ? d.horecaTerras : ""],
        ["Aantal zitplaatsen", d.horecaZitplaatsen], ["Keukenuitrusting", d.horecaKeukenuitrusting],
      ]) : "") +
      (d.verbouwingen ? wH("Verbouwingen / renovaties") + wPara("", d.verbouwingen) : "") });
  }

  sections.push({ title: "Markt & stedenbouwkundige gegevens", html:
    wH("Markt & algemeen gebruik") +
    wTable([
      ["Gebruik", d.gebruik], [isResidentieel ? "Bewoonbaarheid" : "Functionele geschiktheid", d.bewoonbaarheid],
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

  // vergelijkingspunten in het verslag zelf tonen — enkel bij "Nalatenschap": de Vlabel-
  // kwaliteitseisen (schattingsverslagen in het kader van een aangifte van nalatenschap) vereisen
  // net dat deze gegevens (adres, kadaster, transactiegegevens, afweging) wél in het verslag
  // staan (punt 2.3.b) — voor elke andere reden (bv. een gewone verkoopschatting) blijft de
  // bestaande GDPR-vermelding gelden.
  const vglPuntenHtml = (() => {
    if (d.wijzeVanWaardering !== "Vergelijkende methode") return "";
    if (d.reden !== "Nalatenschap") {
      return `<p style="font-size:12px;font-style:italic;color:#4B5160;margin:0 0 10px 0;">VGL-punten (${d.vergelijkingspunten.length}) — Omwille van de GDPR-wetgeving kunnen de VGL-punten niet worden weergegeven in het verslag.</p>`;
    }
    if (d.vergelijkingspunten.length === 0) return "";
    // rijen komen uit rapportVergelijkingspuntRijen (zie "GEDEELD RAPPORTMODEL" hierboven) — exact
    // dezelfde functie die ook de scherm-voorvertoning in StepRapport voedt.
    return d.vergelijkingspunten.map((v, i) => wH(`Vergelijkingspunt ${i + 1}`) + wTable(rapportVergelijkingspuntRijen(v))).join("");
  })();

  const methodeLine = `${d.wijzeVanWaardering}${d.wijzeVanWaarderingMotivering ? " — " + d.wijzeVanWaarderingMotivering : ""}`;
  // waarderingsblokken komen uit rapportWaarderingsBlokken (zie "GEDEELD RAPPORTMODEL" hierboven)
  // — exact dezelfde volgorde, voorwaarden en cijfers als de scherm-voorvertoning in StepRapport.
  const waarderingsBlokkenHtml = rapportWaarderingsBlokken(d, calc).map((blok) =>
    wH(blok.titel) + wTable(blok.rijen) +
    (blok.motivering ? `<p style="font-size:11px;color:#4B5160;margin:4px 0 8px 0;">${wEsc(blok.motivering)}</p>` : "")
  ).join("");
  sections.push({ title: "Waardering", html:
    wH("Wijze van waardering") +
    `<p style="font-size:12px;margin:0 0 8px 0;">${wEsc(methodeLine)}</p>` +
    vglPuntenHtml +
    waarderingsBlokkenHtml +
    `<p style="font-size:11px;color:#4B5160;margin:12px 0 8px 0;">${wEsc(rapportVenaleWaardeZin(d))}</p>` +
    `<table style="width:100%;background:#E4EEEB;margin-top:6px;"><tr><td style="padding:10px;font-family:Georgia,serif;font-weight:bold;color:#2F5B4F;">Venale waarde</td><td style="padding:10px;text-align:right;font-size:16px;font-weight:bold;color:#2F5B4F;">${eur(calc.venaleWaarde)}</td></tr></table>` });

  const eedLine = d.eedPlaats && d.datumVerslag ? `Gedaan te ${d.eedPlaats} op ${nlDate(d.datumVerslag)}`
    : d.eedPlaats ? `Gedaan te ${d.eedPlaats}` : d.datumVerslag ? `Gedaan op ${nlDate(d.datumVerslag)}` : "";
  sections.push({ title: "Eedformule", html:
    `<div style="text-align:center;padding:40px 0;">
      <p style="font-family:Georgia,serif;font-style:italic;font-size:14px;margin-bottom:40px;">"Ik zweer dat ik mijn opdracht in eer en geweten getrouw heb vervuld."</p>
      ${eedLine ? `<p style="font-size:12px;color:#4B5160;">${wEsc(eedLine)}</p>` : ""}
      ${d.handtekening ? `<img src="${veiligeAfbeeldingSrc(d.handtekening)}" style="height:70px;display:block;margin:24px auto 0;" />` : ""}
      ${d.schatterNaam ? `<p style="font-size:12px;margin-top:${d.handtekening ? 8 : 30}px;">${wEsc(d.schatterNaam)}</p>` : ""}
      ${d.schatterTitel ? `<p style="font-size:11px;color:#4B5160;">${wEsc(d.schatterTitel)}</p>` : ""}
    </div>` });

  // "Notities" staat in de wizard uitdrukkelijk als INTERN veld ("Notities (intern)") en hoort dus
  // niet in het afgeleverde verslag: wat een schatter daar voor zichzelf noteert (over een eigenaar,
  // een gebrek, een afspraak) ging voordien gewoon mee naar de opdrachtgever, de notaris of Vlabel.
  sections.push({ title: "Bijlagen", html:
    `<p style="font-size:12px;margin:0 0 6px 0;">${d.fotos.length} foto${d.fotos.length === 1 ? "" : "'s"}</p>` +
    // Geraadpleegde stukken: de opgeladen documenten (bodemattest, EPC, akte, kadastraal uittreksel)
    // kwamen voordien nergens in het verslag voor, terwijl een bank of notaris net wil zien waarop
    // de schatting steunt.
    ((d.documenten || []).length > 0
      ? wH("Geraadpleegde stukken") + wSimpleTable(["Document", "Soort"],
          d.documenten.map((doc) => {
            const t = String(doc.type || "");
            const soort = /pdf/i.test(t) ? "PDF" : /^image\//i.test(t) ? "Afbeelding" : /text/i.test(t) ? "Tekst" : (t.split("/").pop() || "—");
            return [doc.naam || "—", soort];
          }))
      : "") });

  return { sections, adres };
}

// Ongewijzigd t.o.v. vóór de invoering van buildPandSections hierboven (zie audit-toelichting
// daarbij): een gewoon éénpand-dossier doorloopt exact dezelfde stappen als voorheen, dus levert
// dit voor elk bestaand dossier (en elk nieuw dossier zonder extra panden) een identiek verslag op.
export function buildReportData(d, calc, huisstijl) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  const { sections, adres } = buildPandSections(d, calc, huisstijl);
  // Parkeerplaatsen & garages staan niet langer als aparte sectie/pagina hier: ze zitten nu
  // rechtstreeks verwerkt in de venale waarde (berekenWaardering) en verschijnen als onderdeel van
  // de gewone "Waardering"-sectie hierboven (via rapportWaarderingsBlokken in buildPandSections) —
  // exact zoals ze ook op het scherm (StepRapport/StepWaardering) getoond worden.
  const fotoChunks = chunkArray(d.fotos.filter((f) => f.base64), 6);
  // enkel gebruikt voor de openingszin "dit verslag telt N bladzijden" — een ruwe schatting
  // volstaat daar, want dat is louter een tekstuele vermelding. De écht-kloppende paginanummers
  // (voettekst + inhoudstafel hieronder) hangen hier NIET van af: die worden op de server exact
  // opgemeten na een eerste render, zie /api/generate-pdf. Het voorblad telt niet mee (2 =
  // voorafgaande opmerkingen + inhoudstafel), consistent met de paginanummering elders.
  const totalPagesEstimate = 2 + sections.length + fotoChunks.length;
  const opmerkingen = voorafgaandeOpmerkingen(d, totalPagesEstimate);

  const coverHtml = `<div>
    ${hs.logo ? `<img src="${veiligeAfbeeldingSrc(hs.logo)}" style="width:64px;height:64px;object-fit:contain;margin-bottom:14px;" />` : ""}
    <p style="font-size:15px;letter-spacing:2px;color:${hs.kleur};margin-bottom:34px;">${wEsc(hs.naam.toUpperCase())}</p>
    ${d.voorpaginaFoto?.base64 ? `<img src="${veiligeAfbeeldingSrc(d.voorpaginaFoto.base64)}" style="width:380px;max-width:80%;height:260px;object-fit:cover;border-radius:6px;border:1px solid #DDD8CA;margin-bottom:26px;" />` : ""}
    <p style="font-size:15px;letter-spacing:1px;color:#4B5160;text-transform:uppercase;margin-bottom:10px;">Taxatieverslag</p>
    <h1 style="font-family:Georgia,serif;font-size:36px;font-weight:normal;margin-bottom:18px;">${wEsc(adres)}</h1>
    <p style="font-size:16px;color:#4B5160;">${d.opdrachtgeverNaam ? `Opgemaakt voor ${wEsc(d.opdrachtgeverNaam)} · ` : ""}reden: ${wEsc(d.reden.toLowerCase())}</p>
    ${d.datumVerslag ? `<p style="font-size:16px;color:#4B5160;">Datum verslag: ${wEsc(nlDate(d.datumVerslag))}</p>` : ""}
    ${(d.schatterNaam || d.schatterTitel || d.schatterBivNummer || d.schatterVlabelNummer || d.schatterTelefoon) ? `<div style="margin-top:40px;padding-top:18px;border-top:1px solid #DDD8CA;">
      ${d.schatterNaam ? `<p style="font-size:14px;margin-bottom:2px;">${wEsc(d.schatterNaam)}</p>` : ""}
      ${d.schatterTitel ? `<p style="font-size:12px;color:#4B5160;margin-bottom:2px;">${wEsc(d.schatterTitel)}</p>` : ""}
      ${d.schatterBivNummer ? `<p style="font-size:11px;color:#4B5160;margin-bottom:1px;">BIV-nummer: ${wEsc(d.schatterBivNummer)}</p>` : ""}
      ${d.schatterVlabelNummer ? `<p style="font-size:11px;color:#4B5160;margin-bottom:1px;">Vlabel-identificatienummer: ${wEsc(d.schatterVlabelNummer)}</p>` : ""}
      ${d.schatterTelefoon ? `<p style="font-size:11px;color:#4B5160;">Tel.: ${wEsc(d.schatterTelefoon)}</p>` : ""}
    </div>` : ""}
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

// ---------- PDF-export: meerdere panden in één verslag (zie StepPanden/extraPanden) ----------
// Wordt enkel gebruikt zodra d.extraPanden minstens één pand bevat (zie buildPrintHtml hieronder)
// — elk gewoon dossier zonder extra panden blijft het bestaande, volledig ongewijzigde
// buildReportData-pad volgen. Deze functie hergebruikt buildPandSections() voor élk pand
// afzonderlijk (dus exact dezelfde, allang bestaande sectie-opbouw per pand — inclusief foto's,
// SWOT, waardering enz.) en voegt er vooraan één "Portefeuille — overzicht en totaalwaarde"-sectie
// aan toe met de samenvattende tabel + totaalsom die hiervoor expliciet gekozen werd. Er is precies
// één voorblad, één blok "voorafgaande opmerkingen" en één inhoudstafel voor het hele verslag —
// géén aparte kaftpagina per pand — zodat het resultaat leest als één samenhangend rapport i.p.v.
// een aantal aan elkaar geplakte, op zichzelf staande documenten.
export function buildMultiPandReportData(d, calc, huisstijl) {
  const hs = huisstijl || HUISSTIJLEN.houpels;

  // pand 0 = het hoofdpand, d.w.z. de bestaande vlakke velden op het dossier zelf (calc is hier al
  // berekend, zie useCalc(d) in DossierWizard) — elk pand uit extraPanden krijgt zijn eigen,
  // opnieuw berekende calc, via hetzelfde berekenWaardering() dat ook voor een gewoon dossier
  // gebruikt wordt (geen aparte/parallelle rekenlogica dus).
  const alleP = [
    { pd: d, pcalc: calc },
    ...d.extraPanden.map((pand) => {
      const pd = { ...d, ...pand, extraPanden: [], parkeerplaatsenGarages: [] };
      return { pd, pcalc: berekenWaardering(pd) };
    }),
  ];
  const pandenData = alleP.map(({ pd, pcalc }) => ({ ...buildPandSections(pd, pcalc, huisstijl), pd, pcalc }));

  // parkeerTotaal zit al verrekend in pandenData[0].pcalc.venaleWaarde (hoofdpand, pcalc === calc
  // hierboven — berekenWaardering telt d.parkeerplaatsenGarages nu zelf bij de venale waarde op),
  // dus NIET nogmaals optellen bij het portefeuilletotaal. Blijft hier enkel nog bestaan voor de
  // itemlijst in de overzichtstabel hieronder.
  const parkeerTotaal = berekenParkeerplaatsenTotaal(d.parkeerplaatsenGarages);
  const totaalVenaleWaarde = pandenData.reduce((som, p) => som + (p.pcalc.venaleWaarde || 0), 0);
  const heeftParkeer = (d.parkeerplaatsenGarages || []).length > 0;
  const portefeuilleHtml =
    wH("Panden in dit dossier") +
    wSimpleTable(
      ["Pand", "Adres", "Vastgoedtype", "Venale waarde"],
      pandenData.map((p, i) => [
        `Pand ${i + 1}`, p.adres,
        p.pd.vastgoedType + (p.pd.vastgoedType === "Bedrijfsvastgoed" && p.pd.bedrijfsSubtype ? ` — ${p.pd.bedrijfsSubtype}` : ""),
        eur(p.pcalc.venaleWaarde || 0),
      ])
    ) +
    (heeftParkeer ? wH("Parkeerplaatsen & garages") + wSimpleTable(
      ["Type", "Aantal", "Waarde/stuk", "Subtotaal"],
      d.parkeerplaatsenGarages.map((p) => [
        p.type, p.aantal || "—", p.waardePerStuk ? eur(num(p.waardePerStuk)) : "—", eur(num(p.aantal) * num(p.waardePerStuk)),
      ])
    ) : "") +
    `<table style="width:100%;background:#E4EEEB;margin-top:6px;"><tr><td style="padding:10px;font-family:Georgia,serif;font-weight:bold;color:#2F5B4F;">Totale venale waarde (alle panden${heeftParkeer ? " + parkeerplaatsen/garages" : ""})</td><td style="padding:10px;text-align:right;font-size:16px;font-weight:bold;color:#2F5B4F;">${eur(totaalVenaleWaarde)}</td></tr></table>`;

  // samengevoegde sectielijst: eerst het overzicht, dan per pand al zijn secties — elk voorzien
  // van een "Pand N —"-voorvoegsel zodat in de inhoudstafel en de sectietitels zelf altijd
  // duidelijk blijft bij welk pand een sectie hoort (het volledige adres staat sowieso al zowel in
  // de overzichtstabel hierboven als in elk pand se eigen sectie "Aard en ligging").
  const sections = [
    { title: "Portefeuille — overzicht en totaalwaarde", html: portefeuilleHtml },
    ...pandenData.flatMap((p, i) => p.sections.map((s) => ({ title: `Pand ${i + 1} — ${s.title}`, html: s.html }))),
  ];

  // ook de foto's van élk pand komen in het verslag terecht (niet enkel die van het hoofdpand) —
  // elke foto krijgt de bijhorende pandlabel als onderschrift, i.p.v. enkel de categorie.
  const alleFotos = pandenData.flatMap((p, i) =>
    p.pd.fotos.filter((f) => f.base64).map((f) => ({ ...f, categorie: `Pand ${i + 1} — ${f.categorie || "Andere"}` }))
  );
  const fotoChunks = chunkArray(alleFotos, 6);

  const totalPagesEstimate = 2 + sections.length + fotoChunks.length;
  const opmerkingen = voorafgaandeOpmerkingen(d, totalPagesEstimate);

  const overigeAantal = pandenData.length - 1;
  const titelAdres = `${pandenData[0].adres} (+ ${overigeAantal} ${overigeAantal === 1 ? "ander pand" : "andere panden"})`;

  const coverHtml = `<div>
    ${hs.logo ? `<img src="${veiligeAfbeeldingSrc(hs.logo)}" style="width:64px;height:64px;object-fit:contain;margin-bottom:14px;" />` : ""}
    <p style="font-size:15px;letter-spacing:2px;color:${hs.kleur};margin-bottom:34px;">${wEsc(hs.naam.toUpperCase())}</p>
    ${d.voorpaginaFoto?.base64 ? `<img src="${veiligeAfbeeldingSrc(d.voorpaginaFoto.base64)}" style="width:380px;max-width:80%;height:260px;object-fit:cover;border-radius:6px;border:1px solid #DDD8CA;margin-bottom:26px;" />` : ""}
    <p style="font-size:15px;letter-spacing:1px;color:#4B5160;text-transform:uppercase;margin-bottom:10px;">Taxatieverslag — meerdere panden</p>
    <h1 style="font-family:Georgia,serif;font-size:30px;font-weight:normal;margin-bottom:18px;">${wEsc(titelAdres)}</h1>
    <p style="font-size:16px;color:#4B5160;">${d.opdrachtgeverNaam ? `Opgemaakt voor ${wEsc(d.opdrachtgeverNaam)} · ` : ""}reden: ${wEsc(d.reden.toLowerCase())}</p>
    ${d.datumVerslag ? `<p style="font-size:16px;color:#4B5160;">Datum verslag: ${wEsc(nlDate(d.datumVerslag))}</p>` : ""}
    ${(d.schatterNaam || d.schatterTitel || d.schatterBivNummer || d.schatterVlabelNummer || d.schatterTelefoon) ? `<div style="margin-top:40px;padding-top:18px;border-top:1px solid #DDD8CA;">
      ${d.schatterNaam ? `<p style="font-size:14px;margin-bottom:2px;">${wEsc(d.schatterNaam)}</p>` : ""}
      ${d.schatterTitel ? `<p style="font-size:12px;color:#4B5160;margin-bottom:2px;">${wEsc(d.schatterTitel)}</p>` : ""}
      ${d.schatterBivNummer ? `<p style="font-size:11px;color:#4B5160;margin-bottom:1px;">BIV-nummer: ${wEsc(d.schatterBivNummer)}</p>` : ""}
      ${d.schatterVlabelNummer ? `<p style="font-size:11px;color:#4B5160;margin-bottom:1px;">Vlabel-identificatienummer: ${wEsc(d.schatterVlabelNummer)}</p>` : ""}
      ${d.schatterTelefoon ? `<p style="font-size:11px;color:#4B5160;">Tel.: ${wEsc(d.schatterTelefoon)}</p>` : ""}
    </div>` : ""}
  </div>`;

  const tocTitles = ["Voorafgaande opmerkingen", "Inhoud",
    ...sections.map((s, i) => `${i + 1}. ${s.title}`),
    ...fotoChunks.map((_, i) => fotoChunks.length > 1 ? `Bijlagen — foto's (${i + 1}/${fotoChunks.length})` : "Bijlagen — foto's")];
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

  return { coverHtml, opmerkingenBlockHtml, tocBlockHtml, sectionsBlockHtml, fotoBlockHtml, adres: titelAdres };
}

// ---------- PDF-export: doorlopende opmaak, échte automatische paginering ----------
// Geen vaste "1 pagina per sectie" meer: secties vloeien natuurlijk door (break-inside: avoid
// voorkomt enkel een lelijke afbreking mid-sectie), en de fysieke marges + paginanummers worden
// op de server door Puppeteer zelf toegepast op de uiteindelijke, écht gerenderde pagina's — zie
// /api/generate-pdf. Dat garandeert correcte marges en nummering ongeacht hoeveel er precies op
// elke pagina past, in plaats van dat hier vooraf te moeten raden.
export function buildPrintHtml(d, calc, huisstijl) {
  // een dossier zonder extra panden (verreweg de meeste — en elk dossier van vóór deze
  // functionaliteit) doorloopt exact het bestaande, ongewijzigde pad; enkel zodra er via de
  // Panden-lijst effectief extra panden zijn toegevoegd, wordt het gecombineerde portefeuille-pad
  // gebruikt (zie buildMultiPandReportData hierboven).
  const { coverHtml, opmerkingenBlockHtml, tocBlockHtml, sectionsBlockHtml, fotoBlockHtml, adres } =
    (d.extraPanden && d.extraPanden.length > 0)
      ? buildMultiPandReportData(d, calc, huisstijl)
      : buildReportData(d, calc, huisstijl);

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
  /* Watermerk zolang het dossier op "concept" staat. Een element met position:fixed herhaalt
     Chromium bij het afdrukken op ELKE pagina — precies wat hier nodig is, zodat een ontwerp
     nooit als afgewerkt verslag kan circuleren. Zodra de status op "afgewerkt" staat, wordt dit
     blok niet meegegeven en is de PDF volledig schoon. */
  .ontwerp-merk {
    position: fixed; top: 44%; left: 0; right: 0; text-align: center;
    font-family: 'Georgia', serif; font-size: 90px; letter-spacing: 14px; font-weight: bold;
    color: rgba(150, 35, 28, 0.13); transform: rotate(-24deg); pointer-events: none; z-index: 999;
  }
</style>
</head>
<body>
${d.status !== "afgewerkt" ? `<div class="ontwerp-merk">ONTWERP</div>` : ""}
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
