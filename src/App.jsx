import React, { useState, useRef, useEffect, useContext } from "react";
import {
  Trees, Hammer,
  AlertTriangle,
} from "lucide-react";
import {
  INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, BRASS, DANGER,
  HUYZEN_BLAUW, HUYZEN_LOGO_B64, kiesHuisstijl, HuisstijlContext,
  OPTS,
  emptyRoomState, initialData,
} from "./constants.js";
import { supabase, haalSessieToken } from "./data/supabase.js";
import {
  uitloggen, haalHuidigeGebruiker, haalProfiel, updateProfiel,
} from "./data/auth.js";
import {
  nieuweDossierId, loadIndex, loadDossier, saveDossier, deleteDossier, logDossierEvent,
} from "./data/dossiers.js";
import { LoginScreen } from "./schermen/LoginScreen.jsx";
import { Dashboard } from "./schermen/Dashboard.jsx";
import { AccountScherm } from "./schermen/AccountScherm.jsx";
import { WachtwoordHerstellenScreen } from "./schermen/WachtwoordHerstellenScreen.jsx";
import { DossierWizard } from "./schermen/DossierWizard.jsx";

// GOOGLE_MAPS_API_KEY, buildStaticMapUrl, fetchCadgisPerceel, fixBboxAspect, buildCadgisMapUrl,
// bboxNaarPixelPunten, cadgisMarkeringSvg, CadgisKaart en buildCadgisKaartHtml verhuisden naar
// src/kaarten.jsx (opsplitsing stap 6).

// ---------- foutgrens (React error boundary) ----------
// Vangt een onverwachte render-fout ergens in de boom op (bv. een ouder dossier waarin een later
// toegevoegd veld nog ontbreekt) en toont een vriendelijke melding + herstelknop in plaats van een
// wit scherm zonder enige uitleg midden in het werk van een makelaar (zie audit, punt H6). Wordt in
// main.jsx rond <AppRoot/> gelegd.
export class FoutGrens extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fout: null };
  }
  static getDerivedStateFromError(fout) {
    return { fout };
  }
  componentDidCatch(fout, info) {
    console.error("Onverwachte fout, opgevangen door FoutGrens:", fout, info?.componentStack);
  }
  render() {
    if (!this.state.fout) return this.props.children;
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: PAPER, color: INK, fontFamily: "system-ui, sans-serif", padding: 24,
      }}>
        <div style={{
          maxWidth: 460, background: PAPER_RAISED, border: `1px solid ${LINE}`, borderRadius: 10,
          padding: 32, textAlign: "center",
        }}>
          <AlertTriangle size={32} style={{ color: DANGER, marginBottom: 12 }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Er is iets misgelopen</h1>
          <p style={{ fontSize: 14, color: INK_SOFT, marginBottom: 20, lineHeight: 1.5 }}>
            Deze schermweergave liep vast op een onverwachte fout. Uw gegevens zijn niet verloren —
            een tussentijdse opslag gebeurt automatisch tijdens het werken. Ga terug naar het
            overzicht en probeer het opnieuw; blijft dit gebeuren, geef dan gerust door wat u net
            deed toen dit verscheen.
          </p>
          <button type="button" onClick={() => { this.setState({ fout: null }); window.location.href = "/"; }}
            style={{
              background: BRASS, color: "#fff", border: "none", borderRadius: 6,
              padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
            Terug naar overzicht
          </button>
        </div>
      </div>
    );
  }
}




// nieuweDossierId, loadIndex, loadDossier, saveDossier, deleteDossier en logDossierEvent (en
// hun interne helpers: media-/versie-caches, bouwIndexMeta, verwijderDossierBestanden)
// verhuisden naar src/data/dossiers.js (opsplitsing stap 4).

// buildPropertySummary, genereerAutomatischeSwot, callClaudeWithSearch, extractJson,
// duidAiDocFout, uploadDocumentNaarStorage, uploadFotoVoorPdf en callClaudeWithDocs (en hun
// interne helpers fetchClaudeJson/haalDocumentUrl/uploadDocVoorAnalyse) verhuisden naar
// src/data/ai.js (opsplitsing stap 5).
// berekenParkeerplaatsenTotaal, berekenWaardering en useCalc verhuisden naar src/domein/waardering.js (opsplitsing stap 2).

// Field, inputStyle, TextInput, Select, QuickChips, MultiCheck, Checkbox, Section, ChipToggle,
// Slider en Row (de generieke, herbruikbare invoer-/weergavecomponenten) verhuisden naar
// src/ui/velden.jsx (opsplitsing stap 7).

// pandLabel, PandenBalk, StepPanden en DossierWizard verhuisden naar
// src/schermen/DossierWizard.jsx (opsplitsing stap 12 — de laatste stap van deze opsplitsing).

// VOORWAARDEN, PRIVACYVERKLARING, InfoModal, VoorwaardenModal en PrivacyverklaringModal
// verhuisden naar src/schermen/InfoModal.jsx; LoginScreen verhuisde naar
// src/schermen/LoginScreen.jsx (opsplitsing stap 11).

// Dashboard verhuisde naar src/schermen/Dashboard.jsx (opsplitsing stap 11).

// AccountScherm verhuisde naar src/schermen/AccountScherm.jsx (opsplitsing stap 11).

// ---------- app root: authenticatie + navigatie ----------
export default function AppRoot() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [index, setIndex] = useState([]);
  const [view, setView] = useState("login"); // login | dashboard | wizard
  const [activeDossier, setActiveDossier] = useState(null);
  // de huisstijl (Houpels/Huyzen) van het dossier dat momenteel open staat — bepaald door het
  // e-mailadres van de EIGENAAR van dat dossier, niet van de ingelogde gebruiker. Voor een gewone
  // makelaar is dat toch altijd hetzelfde (die opent enkel eigen dossiers), maar een beheerder die
  // een dossier van een collega opent, ziet zo de huisstijl van die collega i.p.v. de eigen —
  // zie handleOpen/handleNew hieronder en kiesHuisstijl() bovenaan dit bestand.
  const [activeHuisstijl, setActiveHuisstijl] = useState(null);
  // wordt true zodra de gebruiker op de "wachtwoord vergeten"-link in zijn mailbox klikt — Supabase
  // meldt die gebruiker dan zelf al (tijdelijk) aan en stuurt het "PASSWORD_RECOVERY"-event, zie de
  // listener hieronder. Zolang dit true is, tonen we enkel het "nieuw wachtwoord instellen"-scherm.
  const [herstelModus, setHerstelModus] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHerstelModus(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // bouwt het sessie-object dat de rest van de app gebruikt (session.id, session.naam, ...)
  // op basis van de Supabase auth-gebruiker + diens weergavenaam uit de profielen-tabel
  const bouwSessie = async (user) => {
    const { naam, isAdmin, telefoon, titel, bivNummer, vlabelNummer } = await haalProfiel(user.id, user.email);
    return { id: user.id, naam, email: user.email, isAdmin, telefoon, titel, bivNummer, vlabelNummer };
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
  const handleRefresh = async () => { setIndex(await loadIndex()); };
  // stille dubbelcheck kort na het aanmelden: lost een zeldzaam, kortstondig probleem op waarbij
  // een beheerder net na het inloggen niet meteen alle dossiers van alle makelaars te zien krijgt
  // (enkel de eigen) — een paginaherlaad haalt de volledige lijst wél altijd correct op, dus we
  // doen hier automatisch hetzelfde: de lijst gewoon nog eens ophalen, zonder dat de gebruiker
  // daarvoor zelf iets moet doen. Enkel bij het aanmelden zelf (session?.id als dependency), niet
  // bij elke wijziging van de lijst nadien.
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => { loadIndex().then(setIndex); }, 2000);
    return () => clearTimeout(t);
  }, [session?.id]);
  const handleLogout = async () => {
    await uitloggen();
    setSession(null); setActiveDossier(null); setActiveHuisstijl(null); setIndex([]); setView("login");
  };

  const handleNew = () => {
    const now = new Date().toISOString();
    // een nieuw dossier is altijd van de ingelogde gebruiker zelf, dus diens eigen huisstijl
    setActiveHuisstijl(kiesHuisstijl(session.email));
    const nieuwDossier = {
      ...initialData, id: nieuweDossierId(), ownerId: session.id, status: "concept", aangemaaktOp: now, laatstBewerkt: now,
      // "Naam schatter-expert" (bij Opdracht & partijen) automatisch invullen met de naam van de
      // ingelogde gebruiker zelf i.p.v. steeds de vaste standaardwaarde uit initialData — zo krijgt
      // elke makelaar bij een nieuw dossier meteen zijn/haar eigen naam, niet die van een ander —
      // en de rest van "Identificatie schatter-expert" komt automatisch mee vanuit "Mijn account"
      schatterNaam: session.naam || initialData.schatterNaam,
      schatterTitel: session.titel || initialData.schatterTitel,
      schatterBivNummer: session.bivNummer || "",
      schatterVlabelNummer: session.vlabelNummer || "",
      schatterTelefoon: session.telefoon || "",
    };
    setActiveDossier(nieuwDossier);
    setView("wizard");
    // meteen (niet afgewacht, om de overgang naar de wizard niet te vertragen) een eerste keer
    // opslaan — dus vóór de gewone gedebouncede autosave. Nodig omdat de tijdelijke-bijlage-
    // uploads (AI-documentanalyse, foto's voor de PDF) via de storage-toegangsregels controleren
    // of er al een dossiers-rij met dit id bestaat die van deze gebruiker is; zonder deze meteen-
    // opslag zou dat, in het onwaarschijnlijke maar mogelijke geval dat iemand binnen de eerste
    // seconde na "Nieuw dossier" al een document uploadt, geweigerd worden.
    saveDossier(nieuwDossier, index, setIndex).catch(() => {});
    logDossierEvent(nieuwDossier.id, session.id, "aangemaakt");
  };
  const handleOpen = async (id) => {
    const dossier = await loadDossier(id);
    // samenvoegen met initialData: zo krijgen velden die na het opslaan van dit dossier zijn
    // toegevoegd (zoals extraRuimtes) altijd een geldige standaardwaarde in plaats van undefined
    if (dossier) {
      // eigen dossier: geen extra opzoeking nodig, dat is toch de eigen huisstijl. Enkel voor een
      // dossier van iemand anders (een beheerder die inspringt) zoeken we het e-mailadres van de
      // ÉCHTE eigenaar op, zodat de juiste huisstijl (Houpels/Huyzen) van díe makelaar getoond wordt
      // i.p.v. de huisstijl van de ingelogde beheerder.
      let eigenaarEmail = session.email;
      if (dossier.ownerId && dossier.ownerId !== session.id) {
        const { data: profiel } = await supabase.from("profielen").select("email").eq("id", dossier.ownerId).single();
        if (profiel?.email) eigenaarEmail = profiel.email;
        // een beheerder die in het dossier van een collega inspringt, wordt gelogd — zie audit, punt H4
        logDossierEvent(id, session.id, "geopend_door_beheerder");
      }
      setActiveHuisstijl(kiesHuisstijl(eigenaarEmail));
      setActiveDossier({ ...initialData, ...dossier });
      setView("wizard");
    }
  };
  const handleDelete = async (id) => {
    const res = await deleteDossier(id, index, setIndex);
    if (res && res.ok === false) {
      alert(`Verwijderen mislukt: ${res.error || "onbekende fout"}. Het dossier staat nog steeds in de lijst.`);
    } else {
      logDossierEvent(id, session.id, "verwijderd");
    }
  };
  const handleBackToDashboard = () => { setView("dashboard"); setActiveDossier(null); };
  const handleSave = (dossier) => saveDossier(dossier, index, setIndex);
  const handleOpenAccount = () => setView("account");
  // slaat "Mijn account" op in profielen én werkt meteen de lopende sessie bij, zodat een
  // volgend nieuw dossier (handleNew) zonder opnieuw in te loggen al de nieuwe gegevens gebruikt
  const handleSaveAccount = async (gegevens) => {
    await updateProfiel(session.id, gegevens);
    setSession((s) => ({ ...s, ...gegevens }));
  };
  // nadat het nieuwe wachtwoord is ingesteld: de sessie die de herstellink al aanmaakte is nu een
  // volwaardige sessie, dus meteen doorstromen naar het dashboard zoals na een gewone aanmelding.
  const handleHerstelKlaar = async () => {
    const user = await haalHuidigeGebruiker();
    setHerstelModus(false);
    if (user) await handleLogin(user);
  };

  if (herstelModus) {
    return <WachtwoordHerstellenScreen onDone={handleHerstelKlaar} />;
  }
  if (loading) {
    return <div className="w-full flex items-center justify-center" style={{ minHeight: 400, color: INK_SOFT, fontFamily: "system-ui" }}>Laden...</div>;
  }
  if (view === "login" || !session) {
    return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} />;
  }
  // huisstijl (naam/kleur/logo) wordt bepaald door het e-mailadres van de ingelogde gebruiker —
  // zie kiesHuisstijl hierboven. Standaard Houpels, automatisch Huyzen Vastgoed voor @huyzen.be.
  // Voor het dashboard (overzicht van álle dossiers bij een beheerder) is er geen "eigenaar" van
  // de hele pagina — dat blijft dus de huisstijl van de ingelogde gebruiker zelf.
  const huisstijl = kiesHuisstijl(session?.email);
  if (view === "wizard" && activeDossier) {
    // huisstijl van het GEOPENDE dossier (bepaald in handleOpen/handleNew op basis van de
    // eigenaar) — valt terug op de eigen huisstijl zolang die nog niet gezet is
    return <DossierWizard initialDossier={activeDossier} onBack={handleBackToDashboard} onSave={handleSave} huisstijl={activeHuisstijl || huisstijl} />;
  }
  if (view === "account") {
    return <AccountScherm user={session} onSave={handleSaveAccount} onBack={handleBackToDashboard} />;
  }
  return <Dashboard user={session} index={index} onOpen={handleOpen} onNew={handleNew} onDelete={handleDelete} onLogout={handleLogout} onOpenAccount={handleOpenAccount} onRefresh={handleRefresh} huisstijl={huisstijl} />;
}

// WachtwoordHerstellenScreen verhuisde naar src/schermen/WachtwoordHerstellenScreen.jsx
// (opsplitsing stap 11).

// tekencomponent voor de handtekening bij de eedformule — canvas met muis/touch-ondersteuning,
// slaat het resultaat als base64 PNG op via onChange (hetzelfde patroon als de andere velden:
// een rauwe stringwaarde, geen event, wat de bestaande set()-helper al correct afhandelt)
// SignaturePad verhuisde naar src/ui/SignaturePad.jsx (opsplitsing stap 10).


// StepOpdracht, StepLigging, StepType en StepConstructie verhuisden naar
// src/stappen/StepOpdracht.jsx, StepLigging.jsx, StepType.jsx en StepConstructie.jsx
// (opsplitsing stap 10).

// ChipToggle verhuisde naar src/ui/velden.jsx (opsplitsing stap 7).

// StepInstallaties, StepRuimteEigenschappen (incl. RoomChecklist), StepBedrijfskenmerken en
// StepMarkt verhuisden naar src/stappen/StepInstallaties.jsx, StepRuimteEigenschappen.jsx,
// StepBedrijfskenmerken.jsx en StepMarkt.jsx (opsplitsing stap 10).

// DOC_CROSS_REFERENCE, StepDocumenten, StepFotos en StepSwot verhuisden naar
// src/stappen/StepDocumenten.jsx, StepFotos.jsx en StepSwot.jsx (opsplitsing stap 10).

// StepAfmetingen, StepVergelijkingspunten en StepWaardering (incl. de lokale constante
// PARKEER_TYPES) verhuisden naar src/stappen/StepAfmetingen.jsx, StepVergelijkingspunten.jsx
// en StepWaardering.jsx (opsplitsing stap 10).

// Row verhuisde naar src/ui/velden.jsx (opsplitsing stap 7).

// NL_NUM/nlNumber en REDEN_ZINSNEDE verhuisden naar src/rapport/html.js (opsplitsing stap 8, zie
// voorafgaandeOpmerkingen aldaar).
// rapportVergelijkingspuntRijen, rapportWaarderingsBlokken en rapportVenaleWaardeZin ("GEDEELD RAPPORTMODEL") verhuisden naar src/domein/waardering.js (opsplitsing stap 2).

// ----------------------------------------------------------------------------
// AI-VOORSTELLEN — witte lijst + controle
// ----------------------------------------------------------------------------
// Voordien schreef het uitlezen van documenten ELKE sleutel die het model teruggaf rechtstreeks in
// het dossier: geen beperking tot bestaande velden, geen controle tegen de keuzelijsten, geen
// vergelijking met wat er al stond, en geen weg terug. Een gehallucineerde sleutel, of een waarde
// die niet in de bijhorende keuzelijst voorkomt, belandde zo stil in een verslag dat onder eed
// vertrekt. Hieronder staat wat AI mag invullen, en hoe elke waarde gecontroleerd wordt.
const AI_VELDEN = {
  capakey: { label: "CaPaKey", soort: "tekst", max: 40 },
  kadAfdeling: { label: "Kadastrale afdeling", soort: "tekst", max: 20 },
  kadSectie: { label: "Kadastrale sectie", soort: "tekst", max: 10 },
  kadPerceelnummer: { label: "Perceelnummer", soort: "tekst", max: 30 },
  straat: { label: "Straat", soort: "tekst", max: 80 },
  nummer: { label: "Huisnummer", soort: "tekst", max: 12 },
  postcode: { label: "Postcode", soort: "tekst", max: 10 },
  gemeente: { label: "Gemeente", soort: "tekst", max: 60 },
  gewestplan: { label: "Gewestplan", soort: "keuze", opties: () => OPTS.gewestplan },
  erfgoed: { label: "Onroerend erfgoed", soort: "keuze", opties: () => OPTS.jaNee },
  voorkooprecht: { label: "Voorkooprecht", soort: "keuze", opties: () => OPTS.jaNee },
  bouwmisdrijven: { label: "Bouwmisdrijven", soort: "keuze", opties: () => OPTS.jaNee },
  watertoetsP: { label: "Watertoets perceelscore", soort: "keuze", opties: () => ["A", "B", "C", "D"] },
  watertoetsG: { label: "Watertoets gebouwscore", soort: "keuze", opties: () => ["A", "B", "C", "D"] },
  mobiscore: { label: "Mobiscore", soort: "getal", min: 0, max: 10 },
  bpaRupVerkaveling: { label: "BPA / RUP / verkaveling", soort: "tekst", max: 500 },
};

// Zet het antwoord van het model om in een lijst voorstellen. Geeft nooit een veld terug dat niet
// in AI_VELDEN staat, en nooit een waarde die de controle niet doorstaat.
export function bouwAiVoorstellen(parsed, huidig) {
  const voorstellen = [];
  const geweigerd = [];
  Object.entries(parsed || {}).forEach(([veld, ruweWaarde]) => {
    const regel = AI_VELDEN[veld];
    if (!regel) { geweigerd.push({ veld, reden: "wordt niet automatisch ingevuld" }); return; }
    if (ruweWaarde === "" || ruweWaarde === null || ruweWaarde === undefined) return;
    let waarde = String(ruweWaarde).trim();
    if (!waarde) return;

    if (regel.soort === "keuze") {
      const opties = regel.opties();
      const treffer = opties.find((o) => o.toLowerCase() === waarde.toLowerCase());
      if (!treffer) { geweigerd.push({ veld, reden: `"${waarde}" staat niet in de keuzelijst` }); return; }
      waarde = treffer; // exacte schrijfwijze uit de lijst, anders klopt het keuzeveld niet meer
    } else if (regel.soort === "getal") {
      const n = parseFloat(waarde.replace(",", "."));
      if (isNaN(n) || n < regel.min || n > regel.max) {
        geweigerd.push({ veld, reden: `"${waarde}" is geen geldig getal tussen ${regel.min} en ${regel.max}` });
        return;
      }
      waarde = String(n);
    } else if (waarde.length > regel.max) {
      geweigerd.push({ veld, reden: "waarde is onwaarschijnlijk lang" });
      return;
    }

    const oud = String(huidig?.[veld] ?? "");
    if (oud === waarde) return; // niets te beslissen
    voorstellen.push({ veld, label: regel.label, oud, nieuw: waarde });
  });
  return { voorstellen, geweigerd };
}

// Controle vóór het afleveren van een verslag. Voordien kon een verslag zonder referentiedatum,
// zonder Vlabel-nummer en zonder handtekening gegenereerd worden zonder één waarschuwing — en
// omdat een leeg veld in de PDF gewoon WEGGELATEN wordt (zie wRow), ziet zo'n verslag er volkomen
// normaal uit: de ontbrekende regels zijn onzichtbaar, ook voor de ontvanger. Vandaar twee
// niveaus: "blokkerend" verhindert de export, "aandachtspunt" laat ze toe maar wordt getoond.
export function valideerDossier(d) {
  const leeg = (v) => !String(v ?? "").trim();
  const blokkerend = [];
  const aandachtspunten = [];
  const isNalatenschap = d.reden === "Nalatenschap";

  if (leeg(d.straat) || leeg(d.gemeente)) blokkerend.push("Adres van het pand (straat en gemeente) — tabblad Opdracht & partijen");
  if (leeg(d.datumVerslag)) blokkerend.push("Datum van het verslag — tabblad Opdracht & partijen");
  if (leeg(d.referentiedatum)) {
    blokkerend.push(isNalatenschap
      ? "Datum overlijden (referentiedatum) — bepaalt de waarde bij een nalatenschap"
      : "Referentiedatum van de schatting — tabblad Opdracht & partijen");
  }
  if (leeg(d.schatterNaam)) blokkerend.push("Naam van de schatter-expert — tabblad Opdracht & partijen");
  if (leeg(d.handtekening)) blokkerend.push("Handtekening bij de eedformule — tabblad Opdracht & partijen");
  if (isNalatenschap && leeg(d.schatterVlabelNummer)) {
    blokkerend.push("Vlabel-identificatienummer van de schatter-expert — vereist bij een nalatenschap");
  }

  if (leeg(d.eedPlaats)) aandachtspunten.push('Plaats bij de eedformule ("Gedaan te …") is niet ingevuld');
  if (leeg(d.opdrachtgeverNaam)) aandachtspunten.push("Opdrachtgever is niet ingevuld");
  if (leeg(d.capakey)) aandachtspunten.push("CaPaKey (kadastrale identificatie) is niet ingevuld");
  if ((d.fotos || []).length === 0) aandachtspunten.push("Er zijn nog geen foto's toegevoegd");
  if (d.wijzeVanWaardering === "Vergelijkende methode" && (d.vergelijkingspunten || []).length === 0) {
    aandachtspunten.push("De vergelijkende methode is gekozen, maar er zijn geen vergelijkingspunten ingevoerd");
  }
  if (isNalatenschap) {
    if (leeg(d.overledenNaam)) aandachtspunten.push("Naam van de overleden persoon is niet ingevuld");
    if (leeg(d.vlabelDossiernummer)) aandachtspunten.push("Vlabel-dossiernummer is niet ingevuld");
  }
  if (d.status !== "afgewerkt") aandachtspunten.push('Dit dossier staat nog op "concept" — het verslag krijgt een ONTWERP-watermerk');

  return { blokkerend, aandachtspunten };
}

// voorafgaandeOpmerkingen verhuisde naar src/rapport/html.js (opsplitsing stap 8).

// wRow, wTable, wH, wPara, wSimpleTable, wList, chunkArray en wPhotoPage (de Word-veilige
// HTML-bouwstenen) verhuisden naar src/rapport/html.js (opsplitsing stap 8).

// buildPandSections, buildReportData, buildMultiPandReportData en buildPrintHtml verhuisden naar
// src/rapport/bouwers.js (opsplitsing stap 8).


// ---------- rapport: page chrome ----------
// Page, ReportH, ReportGrid, ReportList, RoomBlock en StepRapport (rapport-voorvertoning +
// PDF-downloadlogica) verhuisden naar src/rapport/StepRapport.jsx (opsplitsing stap 9).
