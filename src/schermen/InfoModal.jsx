// ----------------------------------------------------------------------------
// schermen/InfoModal.jsx — generieke infomodal + gebruiksvoorwaarden/privacyverklaring
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 11) zonder de logica/opmaak zelf te
// wijzigen.
import React from "react";
import { X } from "lucide-react";
import { INK, INK_SOFT, PAPER_RAISED, LINE } from "../constants.js";

// ---------- gebruiksvoorwaarden & privacyverklaring ----------
// Bewust kort en to-the-point gehouden (eigendom, misbruik, accountbeheer, aansprakelijkheid) —
// géén juridisch nagekeken document, enkel een redelijke basisbescherming, qua opbouw losjes
// afgestemd op de bestaande voorwaarden/privacytekst op huyzen.be / pro.huyzen.be. Bij twijfel
// over de exacte formulering (bv. de precieze verhouding met Huyzen Vastgoed) laat je dit best
// nog eens nalezen door een advocaat, zie ook het gesprek dat tot deze tekst leidde.
const VOORWAARDEN = [
  {
    titel: "1. Eigendom",
    tekst: `Deze applicatie ("de app"), met inbegrip van de broncode, het ontwerp en de onderliggende technologie, is en blijft de exclusieve eigendom van Thijs Houpels. Het gebruik van de app door medewerkers van Huyzen Vastgoed of enige andere partij verleent op zich geen enkel eigendoms- of gebruiksrecht op de app, buiten het gebruiksrecht dat hieronder uitdrukkelijk wordt toegekend. De app en haar inhoud zijn beschermd door het auteursrecht; overname, kopie of nabouw zonder voorafgaande schriftelijke toestemming is niet toegestaan.`,
  },
  {
    titel: "2. Gebruiksrecht",
    tekst: `Elke gebruiker krijgt een persoonlijk, niet-overdraagbaar en te allen tijde herroepbaar recht om de app te gebruiken, uitsluitend voor taxatiewerk in het kader van zijn/haar functie. Het is niet toegestaan om: in te loggen namens iemand anders of accountgegevens (wachtwoord) met anderen te delen; de app of een onderdeel ervan te kopiëren, na te bouwen, te decompileren, of aan derden ter beschikking te stellen; de app te gebruiken voor een ander doel dan waarvoor ze bedoeld is.`,
  },
  {
    titel: "3. Accountbeheer",
    tekst: `De beheerder van de app mag te allen tijde, zonder voorafgaande kennisgeving en zonder opgave van reden, een account beperken, schorsen of definitief verwijderen, en de inhoud van een dossier inzien, aanpassen of verwijderen indien dit nodig wordt geacht — bijvoorbeeld bij (vermoeden van) misbruik, een geschil, of het einde van de samenwerking met de betrokken gebruiker.`,
  },
  {
    titel: "4. Verantwoordelijkheid van de gebruiker",
    tekst: `Elke gebruiker blijft zelf volledig verantwoordelijk voor de juistheid en volledigheid van de gegevens die hij/zij invoert, en voor de uiteindelijke taxatie en het rapport dat daaruit voortvloeit. De app is een hulpmiddel ter ondersteuning van de schatter-expert; ze vervangt nooit diens eigen professioneel oordeel en controleplicht. De gegenereerde taxatierapporten zijn indicatief tot op het moment dat de schatter-expert ze nagekeken en ondertekend heeft.`,
  },
  {
    titel: "5. Aansprakelijkheid",
    tekst: `De aansprakelijkheid van de eigenaar van de app is, voor zover wettelijk toegelaten, beperkt tot de rechtstreekse schade die het bewezen gevolg is van een fout bij het ter beschikking stellen van de app. Onrechtstreekse schade — waaronder gevolgschade, gederfde winst, of verlies van gegevens — komt niet in aanmerking voor vergoeding. De eigenaar is niet aansprakelijk voor storingen, onderbrekingen of gegevensverlies die het gevolg zijn van internetverbindingen, hostingdiensten van derden (o.a. Supabase, Vercel) of overmacht.`,
  },
  {
    titel: "6. Geen garantie",
    tekst: `De app wordt aangeboden "zoals ze is", zonder enige garantie op ononderbroken beschikbaarheid, foutloze werking, of geschiktheid voor een bepaald doel. Het gebruik ervan gebeurt op eigen risico van de gebruiker.`,
  },
  {
    titel: "7. Verwerking van persoonsgegevens",
    tekst: `Bij het gebruik van de app worden persoonsgegevens verwerkt — zowel van de gebruiker zelf (account) als van opdrachtgevers/eigenaars binnen een dossier. Hoe daarmee wordt omgegaan, staat beschreven in de afzonderlijke Privacyverklaring.`,
  },
  {
    titel: "8. Beëindiging",
    tekst: `Het gebruiksrecht eindigt automatisch bij het einde van de samenwerking tussen de gebruiker en Huyzen Vastgoed, en kan daarnaast op elk moment eenzijdig worden beëindigd door de eigenaar van de app.`,
  },
  {
    titel: "9. Toepasselijk recht",
    tekst: `Op deze gebruiksvoorwaarden is Belgisch recht van toepassing. Bij een geschil zijn uitsluitend de rechtbanken van het gerechtelijk arrondissement van de woonplaats van de eigenaar van de app bevoegd.`,
  },
];

// Bondige privacyverklaring (GDPR/AVG) voor de app zelf — qua opbouw losjes afgestemd op
// huyzen.be/privacy, maar inhoudelijk toegespitst op wat déze app effectief verwerkt: geen
// aanname dat Huyzen Vastgoed de verwerkingsverantwoordelijke is, aangezien de app zelf
// eigendom is en blijft van Thijs Houpels (zie Gebruiksvoorwaarden, punt 1). Bij twijfel over
// wie precies als verwerkingsverantwoordelijke moet gelden, best even aftoetsen.
const PRIVACYVERKLARING = [
  {
    titel: "1. Wie is verantwoordelijk",
    tekst: `Deze app wordt beheerd door Thijs Houpels, in het kader van taxatiewerk voor Huyzen Vastgoed. Voor vragen over deze privacyverklaring of over je gegevens kan je terecht op thijs@huyzen.be.`,
  },
  {
    titel: "2. Welke gegevens verwerken we",
    tekst: `Accountgegevens van medewerkers: naam, e-mailadres, telefoonnummer, functietitel, BIV- en Vlabel-nummer. Dossiergegevens die een medewerker invoert: adres en kenmerken van het te taxeren pand, naam en contactgegevens van de opdrachtgever/eigenaar, en de foto's en documenten die bij een dossier worden toegevoegd (bv. eigendomsakte, bodemattest, EPC-certificaat).`,
  },
  {
    titel: "3. Waarvoor gebruiken we deze gegevens",
    tekst: `Uitsluitend om taxatie-opdrachten uit te voeren, schattingsverslagen op te stellen, en accounts van medewerkers te beheren. Er wordt met deze gegevens niet aan marketing gedaan en ze worden niet doorverkocht aan derden.`,
  },
  {
    titel: "4. Hoe lang bewaren we deze gegevens",
    tekst: `Zolang het account actief is, of zolang een dossier relevant is voor de opdracht/het kantoor. Bij verwijdering van een account of dossier (zie Gebruiksvoorwaarden, punt 3) worden de bijhorende gegevens definitief gewist.`,
  },
  {
    titel: "5. Wie heeft er toegang, en doorgifte aan derden",
    tekst: `Enkel ingelogde medewerkers hebben toegang, en enkel tot hun eigen dossiers — een beheerder kan daarnaast alle dossiers inzien voor ondersteuning en kwaliteitscontrole. Gegevens worden verwerkt door onze technische dienstverleners: Supabase (databank, authenticatie en bestandsopslag) en Vercel (hosting), en — enkel voor het genereren van ondersteunende rapporttekst, zonder dat hier identificeerbare persoonsgegevens van de opdrachtgever voor nodig zijn — Anthropic (Claude API). Deze partijen verwerken gegevens in opdracht van en volgens de instructies van de app, niet voor eigen doeleinden.`,
  },
  {
    titel: "6. Beveiliging",
    tekst: `Toegang is enkel mogelijk na inloggen; wachtwoorden worden nooit in leesbare vorm bewaard (dit wordt volledig door Supabase Auth afgehandeld). Elke medewerker ziet en bewerkt in principe enkel de eigen dossiers, dankzij toegangsregels die op databankniveau worden afgedwongen (row-level security).`,
  },
  {
    titel: "7. Jouw rechten",
    tekst: `Je hebt steeds het recht om je gegevens in te kijken, te laten verbeteren, of te laten verwijderen. Je kan dit via het scherm "Mijn account" in de app zelf regelen voor je eigen accountgegevens, of hiervoor contact opnemen via thijs@huyzen.be.`,
  },
  {
    titel: "8. Klachten",
    tekst: `Ben je niet tevreden over hoe met je gegevens wordt omgegaan, dan kan je terecht bij de Gegevensbeschermingsautoriteit (Drukpersstraat 35, 1000 Brussel, www.gegevensbeschermingsautoriteit.be).`,
  },
];

export function InfoModal({ title, sections, onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)", zIndex: 1000 }}>
      <div className="rounded-xl p-6 overflow-y-auto" style={{ width: 560, maxWidth: "100%", maxHeight: "85vh", background: PAPER_RAISED, border: `1px solid ${LINE}` }}>
        <div className="flex items-center justify-between mb-4">
          <div style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: INK }}>{title}</div>
          <button onClick={onClose} aria-label="Sluiten"><X size={18} style={{ color: INK_SOFT }} /></button>
        </div>
        <div className="flex flex-col gap-4">
          {sections.map((v) => (
            <div key={v.titel}>
              <div className="text-sm mb-1" style={{ fontWeight: 500, color: INK }}>{v.titel}</div>
              <div className="text-xs" style={{ color: INK_SOFT, lineHeight: 1.6 }}>{v.tekst}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full text-sm py-2 rounded-lg text-white mt-6" style={{ background: INK, fontWeight: 500 }}>
          Sluiten
        </button>
      </div>
    </div>
  );
}

export function VoorwaardenModal({ onClose }) {
  return <InfoModal title="Gebruiksvoorwaarden" sections={VOORWAARDEN} onClose={onClose} />;
}

export function PrivacyverklaringModal({ onClose }) {
  return <InfoModal title="Privacyverklaring" sections={PRIVACYVERKLARING} onClose={onClose} />;
}
