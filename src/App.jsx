import React, { useState, useRef, useEffect, useContext } from "react";
import {
  Home, MapPin, Ruler, Building2, Trees, Hammer, LineChart, ClipboardList,
  Grid3x3, Calculator, FileText, Plus, Trash2, ChevronLeft, ChevronRight,
  Check, AlertTriangle, Image as ImageIcon, Paperclip, X,
  Layers, Flame, Sofa, Users, Download, Settings, RefreshCw
} from "lucide-react";
import {
  INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, BRASS, BRASS_SOFT, STAMP, STAMP_SOFT, DANGER,
  HUYZEN_BLAUW, HUYZEN_LOGO_B64, HUISSTIJLEN, kiesHuisstijl, HuisstijlContext,
  VERDIEPINGEN, OPTS,
  emptyRoomState, initialData, maakLeegPand,
} from "./constants.js";
import {
  num, epcRichtwaardePct, eur, pct, nlDate, uid, dash, joinOrDash, isEmptyVal, wEsc,
} from "./lib/format.js";
import {
  isJpegFile, resizeImageBlob, resizeImageBlobBinnenBudget,
  EIGEN_OPSLAG_ORIGIN, veiligeAfbeeldingSrc,
} from "./lib/afbeeldingen.js";
import { berekenParkeerplaatsenTotaal, berekenWaardering, useCalc } from "./domein/waardering.js";
import { supabase, haalSessieToken } from "./data/supabase.js";
import {
  login, registreer, stuurBevestigingOpnieuw, vraagWachtwoordResetAan, stelNieuwWachtwoordIn,
  uitloggen, haalHuidigeGebruiker, haalProfiel, updateProfiel,
} from "./data/auth.js";
import {
  nieuweDossierId, loadIndex, loadDossier, saveDossier, deleteDossier, logDossierEvent,
} from "./data/dossiers.js";
import { uploadDocumentNaarStorage } from "./data/ai.js";
import {
  Field, inputStyle, TextInput, Select, Section,
} from "./ui/velden.jsx";
import { StepRapport } from "./rapport/StepRapport.jsx";
import { StepOpdracht } from "./stappen/StepOpdracht.jsx";
import { StepLigging } from "./stappen/StepLigging.jsx";
import { StepType } from "./stappen/StepType.jsx";
import { StepConstructie } from "./stappen/StepConstructie.jsx";
import { StepInstallaties } from "./stappen/StepInstallaties.jsx";
import { StepRuimteEigenschappen } from "./stappen/StepRuimteEigenschappen.jsx";
import { StepBedrijfskenmerken } from "./stappen/StepBedrijfskenmerken.jsx";
import { StepMarkt } from "./stappen/StepMarkt.jsx";
import { StepDocumenten } from "./stappen/StepDocumenten.jsx";
import { StepFotos } from "./stappen/StepFotos.jsx";
import { StepSwot } from "./stappen/StepSwot.jsx";
import { StepAfmetingen } from "./stappen/StepAfmetingen.jsx";
import { StepVergelijkingspunten } from "./stappen/StepVergelijkingspunten.jsx";
import { StepWaardering } from "./stappen/StepWaardering.jsx";

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

// ---------- meerdere panden in één dossier ----------
// Label voor één pand in de lijsten hieronder — een ingevuld adres krijgt voorrang op het
// (optionele) label dat bij het toevoegen werd meegegeven, zodat de lijst na verloop van tijd
// vanzelf betekenisvoller wordt naarmate de gegevens ingevuld raken.
function pandLabel(pand, fallback) {
  if (pand.straat) return `${pand.straat} ${pand.nummer || ""}${pand.bus ? "/" + pand.bus : ""}`.trim();
  return pand.pandNaam || fallback;
}

// Dunne, altijd-zichtbare balk boven elk pand-gebonden tabblad (Ligging t/m Foto's) — toont welk
// pand er precies bewerkt wordt en laat toe snel te wisselen, zonder terug naar het tabblad
// "Panden" te moeten gaan. Blijft volledig verborgen zolang er geen enkel extra pand is (d.i. elk
// gewoon, bestaand dossier) — dan is er ook niets om tussen te kiezen.
function PandenBalk({ d, veiligePandIndex, setActievePandIndex }) {
  if (!d.extraPanden || d.extraPanden.length === 0) return null;
  const namen = [pandLabel(d, "Hoofdpand"), ...d.extraPanden.map((p, i) => pandLabel(p, `Pand ${i + 2}`))];
  return (
    <div className="no-print flex items-center gap-1.5 flex-wrap mb-5 pb-4" style={{ borderBottom: `1px solid ${LINE}` }}>
      <span style={{ fontSize: 11, color: INK_SOFT, marginRight: 2 }}>Je bewerkt nu:</span>
      {namen.map((naam, i) => (
        <button key={i} type="button" onClick={() => setActievePandIndex(i)}
          className="text-xs px-2.5 py-1 rounded-full"
          style={{
            background: i === veiligePandIndex ? BRASS : "transparent",
            color: i === veiligePandIndex ? "#fff" : INK_SOFT,
            border: `1px solid ${i === veiligePandIndex ? BRASS : LINE}`, fontWeight: 500,
          }}>
          {i === 0 ? "Hoofdpand" : `Pand ${i + 1}`}{naam ? ` — ${naam}` : ""}
        </button>
      ))}
    </div>
  );
}

// Beheer-tabblad: panden toevoegen/verwijderen/kiezen. De eigenlijke gegevens van elk pand (type,
// ligging, constructie, waardering, foto's...) worden NIET hier ingevuld, maar via de andere
// tabbladen — telkens voor het pand dat via de knoppen hieronder (of via PandenBalk hierboven)
// als actief gekozen is. Zie de toelichting bij bindPand() in DossierWizard.
function StepPanden({ d, veiligePandIndex, setActievePandIndex, addPand, removePand }) {
  const [nieuweNaam, setNieuweNaam] = useState("");
  const rijen = [
    { naam: pandLabel(d, "Hoofdpand — nog geen adres ingevuld"), vastgoedType: d.vastgoedType, isHoofdpand: true },
    ...d.extraPanden.map((p, i) => ({ naam: pandLabel(p, `Pand ${i + 2} — nog geen adres ingevuld`), vastgoedType: p.vastgoedType, isHoofdpand: false })),
  ];
  return (
    <div>
      <div className="mb-5">
        <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Panden in dit dossier</div>
        <p style={{ fontSize: 13, color: INK_SOFT, lineHeight: 1.6, maxWidth: 640 }}>
          Bestaat deze opdracht uit meerdere eigendommen — bv. een woning én een apart kadastraal
          perceel, of meerdere appartementen — die samen in één taxatieverslag moeten komen? Voeg ze
          hieronder toe als afzonderlijke panden. Elk pand krijgt via de andere tabbladen hierboven
          zijn eigen volledige gegevens (type, ligging, constructie, waardering, foto's, …) — kies
          met "Bewerk dit pand" welk pand je op dat moment invult. Opdrachtgever, reden van
          waardering en schatter-expert (tabblad "Opdracht & partijen") gelden voor het hele dossier
          en hoef je maar één keer in te vullen. Het verslag toont straks elk pand afzonderlijk, plus
          een samenvattende tabel met de totale waarde van het hele dossier.
        </p>
      </div>
      <div className="flex flex-col gap-2 mb-6">
        {rijen.map((p, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg"
            style={{ border: `1px solid ${i === veiligePandIndex ? BRASS : LINE}`, background: i === veiligePandIndex ? BRASS_SOFT : PAPER_RAISED }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{p.isHoofdpand ? "Hoofdpand" : `Pand ${i + 1}`} — {p.naam}</div>
              <div style={{ fontSize: 12, color: INK_SOFT }}>{p.vastgoedType}</div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setActievePandIndex(i)}
                className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK, fontWeight: 500 }}>
                {i === veiligePandIndex ? "Actief" : "Bewerk dit pand"}
              </button>
              {!p.isHoofdpand && (
                <button type="button" title="Pand verwijderen"
                  onClick={() => { if (confirm(`Pand "${p.naam}" en al zijn ingevulde gegevens verwijderen uit dit dossier?`)) removePand(i - 1); }}
                  className="text-xs p-1.5 rounded-lg" style={{ color: "#991b1b" }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <Field label="Naam/label voor het nieuwe pand (optioneel)" hint='bv. "Garage", "Appartement 2" — mag ook leeg blijven'>
          <TextInput placeholder="Bv. Garage" value={nieuweNaam} onChange={(e) => setNieuweNaam(e.target.value)} />
        </Field>
        <button type="button" onClick={() => { addPand(nieuweNaam); setNieuweNaam(""); }}
          className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg whitespace-nowrap"
          style={{ background: BRASS, color: "#fff", fontWeight: 500 }}>
          <Plus size={14} /> Pand toevoegen
        </button>
      </div>
    </div>
  );
}

function DossierWizard({ initialDossier, onBack, onSave, huisstijl }) {
  const [d, setD] = useState(initialDossier);
  const [step, setStep] = useState(0);
  const calc = useCalc(d);
  // opslagstatus, zichtbaar gemaakt zodat een mislukte opslag (bv. door een te grote bijlage of
  // een netwerkprobleem) niet langer stilzwijgend verdwijnt — voorheen zag de gebruiker dit
  // nergens en verscheen het document/de eruit gehaalde gegevens later gewoon niet meer
  const [opslaanStatus, setOpslaanStatus] = useState("opgeslagen"); // "opgeslagen" | "bezig" | "fout"
  const [opslaanFout, setOpslaanFout] = useState("");

  // Twee tellers om elkaar overlappende opslagacties te temmen. Op een trage verbinding duurt één
  // opslagactie van een dossier met foto's makkelijk 5 tot 15 seconden; ondertussen typt de
  // gebruiker verder en start 900 ms later een tweede. Voordien liepen die door elkaar: welke als
  // laatste bij de databank aankwam lag niet vast, en het antwoord van de OUDSTE zette de status
  // alsnog op "opgeslagen" (en wiste een net getoonde foutmelding). Nu wacht een nieuwe opslagactie
  // op de vorige, en tellen enkel de antwoorden van de meest recente mee.
  const opslaanBezigRef = useRef(false);
  const opslaanVolgnrRef = useRef(0);

  // debounced auto-opslaan bij elke wijziging
  useEffect(() => {
    const t = setTimeout(async () => {
      // wachten tot een eventuele vorige opslagbeurt klaar is, met een plafond: blijft die om welke
      // reden ook hangen, dan gaan we na 30 s toch door i.p.v. eeuwig te wachten
      for (let gewacht = 0; opslaanBezigRef.current && gewacht < 30000; gewacht += 150) {
        await new Promise((r) => setTimeout(r, 150));
      }
      const volgnr = ++opslaanVolgnrRef.current;
      opslaanBezigRef.current = true;
      setOpslaanStatus("bezig");
      try {
        const res = await onSave(d);
        if (volgnr !== opslaanVolgnrRef.current) return; // een nieuwere opslagactie is intussen gestart
        if (res && res.ok === false) {
          setOpslaanStatus("fout");
          setOpslaanFout(res.error || "Opslaan mislukt.");
        } else {
          setOpslaanStatus("opgeslagen");
          setOpslaanFout("");
        }
      } finally {
        opslaanBezigRef.current = false;
      }
    }, 900);
    return () => clearTimeout(t);
  }, [d]);

  // Waarschuwing bij het sluiten/herladen van het venster zolang er niet-bewaarde wijzigingen zijn.
  // Er was al een bevestiging bij de knop "Overzicht", maar niets bij het wegklikken van het tabblad
  // — en bij een geïnstalleerde app in een eigen venster is per ongeluk sluiten net waarschijnlijker.
  useEffect(() => {
    if (opslaanStatus === "opgeslagen") return;
    const waarschuw = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", waarschuw);
    return () => window.removeEventListener("beforeunload", waarschuw);
  }, [opslaanStatus]);

  const set = (key) => (e) => {
    const val = e && e.target ? e.target.value : e;
    setD((prev) => ({ ...prev, [key]: val }));
  };
  const setEig = (roomKey, field, val) => setD((p) => ({
    ...p, eigenschappen: { ...p.eigenschappen, [roomKey]: { ...p.eigenschappen[roomKey], [field]: val } },
  }));

  const addRuimte = () => setD((p) => ({
    ...p, ruimtes: [...p.ruimtes, { id: uid(), verdieping: "gelijkvloers", naam: "", opp: "", coeff: 1, vloer: "" }],
  }));
  // bulk-variant van addRuimte hierboven — voegt in één keer meerdere ruimtes tegelijk toe met een
  // reeds gekende naam/verdieping/oppervlakte (i.p.v. telkens een lege rij + een aparte
  // updateRuimte-aanroep per veld); gebruikt voor "Oppervlaktes uit plannen halen" in
  // StepDocumenten hieronder. Bestaande ruimtes blijven altijd ongemoeid — dit VOEGT enkel toe.
  const addRuimtesBulk = (rijen) => setD((p) => ({
    ...p, ruimtes: [...p.ruimtes, ...rijen.map((r) => {
      const v = VERDIEPINGEN.find((x) => x.key === r.verdieping) || VERDIEPINGEN[0];
      return { id: uid(), verdieping: v.key, naam: r.naam || "", opp: r.opp || "", coeff: v.defCoeff, vloer: "" };
    })],
  }));
  const removeRuimte = (id) => setD((p) => ({ ...p, ruimtes: p.ruimtes.filter((r) => r.id !== id) }));
  const updateRuimte = (id, key, val) => setD((p) => ({
    ...p, ruimtes: p.ruimtes.map((r) => r.id === id ? { ...r, [key]: val } : r),
  }));

  const addSchijf = (naam = "", opp = "") => setD((p) => ({
    ...p, schijven: [...p.schijven, { id: uid(), naam, opp, prijs: "" }],
  }));
  const removeSchijf = (id) => setD((p) => ({ ...p, schijven: p.schijven.filter((s) => s.id !== id) }));
  const updateSchijf = (id, key, val) => setD((p) => ({
    ...p, schijven: p.schijven.map((s) => s.id === id ? { ...s, [key]: val } : s),
  }));

  const addSlaapkamer = () => setD((p) => ({
    ...p, slaapkamers: [...p.slaapkamers, { id: uid(), naam: `Slaapkamer ${p.slaapkamers.length + 1}`, vloer: "", verdieping: "", ingemaaktKasten: "Nee", radiator: "Nee" }],
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

  // vanaf hier duren de twee volledige Chromium-renderbeurten per PDF-aanvraag (zie de pijplijn in
  // de audit) merkbaar langer, en loopt een dossier dichter naar de 60-secondentijdslimiet van
  // /api/generate-pdf toe — louter een waarschuwing, geen harde grens: de schatter-expert beslist
  // zelf of alle foto's relevant zijn (zie audit, punt H2).
  const FOTO_WAARSCHUWING_AANTAL = 40;
  const addFotos = (files, onGeweigerd) => {
    const teAccepteren = [];
    const geweigerd = [];
    Array.from(files).forEach((f) => (isJpegFile(f) ? teAccepteren : geweigerd).push(f));
    if (geweigerd.length && onGeweigerd) onGeweigerd(geweigerd.map((f) => f.name));

    const vorigAantal = d.fotos.length;
    const nieuwAantal = vorigAantal + teAccepteren.length;
    if (teAccepteren.length && vorigAantal < FOTO_WAARSCHUWING_AANTAL && nieuwAantal >= FOTO_WAARSCHUWING_AANTAL) {
      alert(`Dit dossier bevat nu ${nieuwAantal} foto's. Vanaf ongeveer ${FOTO_WAARSCHUWING_AANTAL} foto's kan het genereren van de PDF trager verlopen of, in een uitzonderlijk geval, de tijdslimiet overschrijden. Overweeg enkel de meest relevante foto's te behouden.`);
    }

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
      // waar het punt vandaan komt (notariële akte, eigen verkoop, Statbel, ...) — een verslag
      // zonder bronvermelding bij de vergelijkingspunten is voor een bank of notaris niet toetsbaar
      bron: "",
    }],
  }));
  const removeVergelijkingspunt = (id) => {
    // een vergelijkingspunt is handmatig opgezocht werk (akte, transactiegegevens, afweging) —
    // per ongeluk wissen betekent dat het volledig opnieuw opgezocht moet worden
    const v = d.vergelijkingspunten.find((x) => x.id === id);
    if (!window.confirm(`Vergelijkingspunt${v?.adres ? ` "${v.adres}"` : ""} verwijderen?`)) return;
    setD((p) => ({ ...p, vergelijkingspunten: p.vergelijkingspunten.filter((x) => x.id !== id) }));
  };
  const updateVergelijkingspunt = (id, key, val) => setD((p) => ({
    ...p, vergelijkingspunten: p.vergelijkingspunten.map((v) => v.id === id ? { ...v, [key]: val } : v),
  }));

  // boven GROOT_DOCUMENT_MB weigeren we een PDF/foto niet, maar waarschuwen we vooraf dat het
  // opladen even kan duren — een PDF/foto wordt sinds uploadDocumentNaarStorage hierboven apart
  // naar Storage opgeladen (niet meer als base64 in het dossier zelf bewaard), dus dit raakt de
  // opslag van het dossier zelf niet meer, enkel de duur van het opladen zelf op een trage
  // verbinding. Boven MAX_DOCUMENT_MB wordt het bestand wél geweigerd (blokkerend, niet enkel een
  // waarschuwing) — die grens ligt gelijk aan de file_size_limit van de "dossier-bijlagen"-
  // Storage-bucket en aan MAX_DOC_BYTES in api/claude.js, waar een groter document sowieso al
  // door de server geweigerd wordt bij een AI-documentanalyse (zie audit, punt H5).
  const GROOT_DOCUMENT_MB = 8;
  const MAX_DOCUMENT_MB = 30;
  const addDocumenten = (files) => {
    Array.from(files).forEach((f) => {
      if (f.size > MAX_DOCUMENT_MB * 1024 * 1024) {
        alert(`"${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB — dat overschrijdt de toegelaten grens van ${MAX_DOCUMENT_MB} MB per document en wordt niet toegevoegd. Verklein het bestand (bv. via een online PDF-compressor) en probeer opnieuw.`);
        return;
      }
      const entry = { id: uid(), naam: f.name, type: f.type || "onbekend", grootte: f.size, notities: "" };
      if (f.size > GROOT_DOCUMENT_MB * 1024 * 1024) {
        alert(`"${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB — dat is vrij groot. Het wordt wel toegevoegd (grote PDF's/foto's worden apart opgeladen, niet in het dossier zelf bewaard), maar dat opladen kan op een trage verbinding even duren — wacht tot "Bezig met opladen…" naast het document verdwijnt vóór je verder werkt.`);
      }
      if (f.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => {
          setD((p) => ({ ...p, documenten: [...p.documenten, { ...entry, notities: String(e.target.result).slice(0, 4000) }] }));
        };
        reader.readAsText(f);
      } else if (f.type === "application/pdf" || f.type.startsWith("image/")) {
        // Een PDF of foto (bv. van een grondplan) wordt voortaan PERMANENT naar Storage opgeladen
        // (zie uploadDocumentNaarStorage) i.p.v. als base64 in het dossier zelf bewaard — zo blijft
        // de dossier-opslag zelf klein, ongeacht hoe groot het document is (zie ook
        // GROOT_DOCUMENT_MB/MAX_DOCUMENT_MB hierboven en _saveDossierPoging). Een foto wordt, net
        // als voorheen, eerst verkleind voor de leesbaarheid/omvang; een PDF gaat ongewijzigd door.
        setD((p) => ({ ...p, documenten: [...p.documenten, { ...entry, opladen: true }] }));
        const teUploaden = f.type.startsWith("image/")
          ? resizeImageBlobBinnenBudget(f).then((klein) => new File([klein], f.name, { type: "image/jpeg" })).catch(() => f)
          : Promise.resolve(f);
        teUploaden
          .then((bestand) => uploadDocumentNaarStorage(bestand, d.id, entry.id).then((pad) => {
            setD((p) => ({ ...p, documenten: p.documenten.map((doc) => doc.id === entry.id ? { ...doc, pad, mediaType: bestand.type || f.type, grootte: bestand.size, opladen: false } : doc) }));
          }))
          .catch((err) => {
            // terugvalscenario: bij een mislukte upload (bv. tijdelijk geen netwerk) toch als
            // base64 inline bewaren, zodat het document niet gewoon verloren gaat — enkel zinvol
            // als het bestand niet te groot is om alsnog inline te bewaren.
            console.error("Document opladen mislukt, val terug op inline opslag:", err.message);
            if (f.size > GROOT_DOCUMENT_MB * 1024 * 1024) {
              setD((p) => ({ ...p, documenten: p.documenten.filter((doc) => doc.id !== entry.id) }));
              alert(`"${f.name}" kon niet opgeladen worden (${err.message}). Probeer het opnieuw met een stabiele internetverbinding.`);
              return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = String(e.target.result).split(",")[1] || "";
              setD((p) => ({ ...p, documenten: p.documenten.map((doc) => doc.id === entry.id ? { ...doc, base64, mediaType: f.type, opladen: false } : doc) }));
            };
            reader.readAsDataURL(f);
          });
      } else {
        setD((p) => ({ ...p, documenten: [...p.documenten, entry] }));
      }
    });
  };
  const removeDocument = (id) => {
    const doc = d.documenten.find((x) => x.id === id);
    // bevestiging: dit wist meteen ook het bestand zelf uit Storage — het duurst te herstellen van
    // alle verwijderacties in de wizard (het document moet dan opnieuw opgezocht en opgeladen worden)
    if (!window.confirm(`"${doc?.naam || "Dit document"}" verwijderen? Het opgeladen bestand wordt daarbij definitief gewist.`)) return;
    // ook het permanent opgeslagen bestand zelf opruimen (best effort — een mislukte verwijdering
    // hier laat enkel een ongebruikt bestand achter in Storage, geen zichtbaar probleem voor de
    // gebruiker) zodat verwijderde documenten niet blijven meetellen voor de opslagruimte.
    if (doc?.pad) supabase.storage.from("dossier-bijlagen").remove([doc.pad]).catch(() => {});
    setD((p) => ({ ...p, documenten: p.documenten.filter((x) => x.id !== id) }));
  };
  const updateDocument = (id, key, val) => setD((p) => ({
    ...p, documenten: p.documenten.map((doc) => doc.id === id ? { ...doc, [key]: val } : doc),
  }));

  // ---------- meerdere panden in één dossier (zie extraPanden/maakLeegPand hierboven) ----------
  // actievePandIndex: 0 = het hoofdpand (de bestaande vlakke dossiervelden hierboven, ongewijzigd),
  // > 0 = extraPanden[index-1]. De schatter-expert schakelt hiertussen via de Panden-balk (zie
  // StepPandenBalk hieronder) — welk pand actief is bepaalt enkel wélke gegevens de stappen
  // "Ligging" t/m "Foto's" tonen/bewerken; "Documenten", "Opdracht & partijen" en "Rapport" blijven
  // altijd dossierbreed (zie de render-switch verderop).
  const [actievePandIndex, setActievePandIndex] = useState(0);
  // veilige index: valt terug op het hoofdpand als het net-actieve pand ondertussen verwijderd werd
  const veiligePandIndex = actievePandIndex > 0 && actievePandIndex > d.extraPanden.length ? 0 : actievePandIndex;

  const addPand = (naam = "") => {
    // index binnen het actievePandIndex-schema (0 = hoofdpand, i+1 = extraPanden[i]) — d.extraPanden.length
    // vóór het toevoegen is exact de index waarop het nieuwe pand terechtkomt, dus dit kan hier al
    // synchroon bepaald worden i.p.v. te moeten wachten tot ná de (asynchrone) setD hieronder.
    const nieuweIndex = d.extraPanden.length + 1;
    setD((p) => ({ ...p, extraPanden: [...p.extraPanden, maakLeegPand(naam)] }));
    // meteen naar het nieuwe pand schakelen — vermijdt dat de gebruiker een pand toevoegt en zich
    // dan afvraagt waarom er ogenschijnlijk niets veranderde
    setActievePandIndex(nieuweIndex);
  };
  const removePand = (i) => {
    setD((p) => ({ ...p, extraPanden: p.extraPanden.filter((_, pi) => pi !== i) }));
    setActievePandIndex(0);
  };

  const updatePandSlice = (i, updater) => setD((p) => ({
    ...p, extraPanden: p.extraPanden.map((pand, pi) => (pi === i ? updater(pand) : pand)),
  }));

  // Levert voor een gegeven pand-index precies dezelfde soort d/set/mutator-set als de wizard al
  // sinds jaar en dag gebruikt (zie hierboven) — voor index 0 zijn dat gewoon de bestaande
  // closures zelf (geen enkele wijziging aan het bestaande, eenpand-gedrag), voor index > 0 gaat
  // elke bewerking via updatePandSlice() naar d.extraPanden[index-1] i.p.v. naar d zelf. Zo kunnen
  // alle bestaande Step-componenten (die toch al generieke {d, set, ...}-props verwachten)
  // ongewijzigd hergebruikt worden voor élk pand.
  function bindPand(idx) {
    if (idx === 0) {
      return {
        pd: d, pcalc: calc, setPd: setD,
        set, setEig,
        addRuimte, addRuimtesBulk, removeRuimte, updateRuimte,
        addSchijf, removeSchijf, updateSchijf,
        addSlaapkamer, removeSlaapkamer, updateSlaapkamer,
        addExtraRuimte, removeExtraRuimte, updateExtraRuimte,
        addFotos, removeFoto, updateFoto,
        addDocumenten, removeDocument, updateDocument,
        addVergelijkingspunt, removeVergelijkingspunt, updateVergelijkingspunt,
      };
    }
    const i = idx - 1;
    // "id" (het databaserij-id van het dossier) bestaat enkel op het dossier zelf, niet op een
    // pand-snede (zie maakLeegPand) — sommige stappen (bv. de AI-analyse in StepSwot) hebben dit
    // wél nodig (louter om tijdelijke Storage-bestanden een naam te geven), vandaar hier expliciet
    // meegegeven vanuit het dossier.
    const pd = { ...d.extraPanden[i], id: d.id };
    const pcalc = berekenWaardering(pd);
    const upd = (updater) => updatePandSlice(i, updater);
    const pSet = (key) => (e) => { const val = e && e.target ? e.target.value : e; upd((prev) => ({ ...prev, [key]: val })); };
    const pSetEig = (roomKey, field, val) => upd((prev) => ({
      ...prev, eigenschappen: { ...prev.eigenschappen, [roomKey]: { ...prev.eigenschappen[roomKey], [field]: val } },
    }));

    const pAddRuimte = () => upd((prev) => ({
      ...prev, ruimtes: [...prev.ruimtes, { id: uid(), verdieping: "gelijkvloers", naam: "", opp: "", coeff: 1, vloer: "" }],
    }));
    const pAddRuimtesBulk = (rijen) => upd((prev) => ({
      ...prev, ruimtes: [...prev.ruimtes, ...rijen.map((r) => {
        const v = VERDIEPINGEN.find((x) => x.key === r.verdieping) || VERDIEPINGEN[0];
        return { id: uid(), verdieping: v.key, naam: r.naam || "", opp: r.opp || "", coeff: v.defCoeff, vloer: "" };
      })],
    }));
    const pRemoveRuimte = (id) => upd((prev) => ({ ...prev, ruimtes: prev.ruimtes.filter((r) => r.id !== id) }));
    const pUpdateRuimte = (id, key, val) => upd((prev) => ({
      ...prev, ruimtes: prev.ruimtes.map((r) => r.id === id ? { ...r, [key]: val } : r),
    }));

    const pAddSchijf = (naam = "", opp = "") => upd((prev) => ({
      ...prev, schijven: [...prev.schijven, { id: uid(), naam, opp, prijs: "" }],
    }));
    const pRemoveSchijf = (id) => upd((prev) => ({ ...prev, schijven: prev.schijven.filter((s) => s.id !== id) }));
    const pUpdateSchijf = (id, key, val) => upd((prev) => ({
      ...prev, schijven: prev.schijven.map((s) => s.id === id ? { ...s, [key]: val } : s),
    }));

    const pAddSlaapkamer = () => upd((prev) => ({
      ...prev, slaapkamers: [...prev.slaapkamers, { id: uid(), naam: `Slaapkamer ${prev.slaapkamers.length + 1}`, vloer: "", verdieping: "", ingemaaktKasten: "Nee", radiator: "Nee" }],
    }));
    const pRemoveSlaapkamer = (id) => upd((prev) => ({ ...prev, slaapkamers: prev.slaapkamers.filter((s) => s.id !== id) }));
    const pUpdateSlaapkamer = (id, key, val) => upd((prev) => ({
      ...prev, slaapkamers: prev.slaapkamers.map((s) => s.id === id ? { ...s, [key]: val } : s),
    }));

    const pAddExtraRuimte = () => upd((prev) => ({
      ...prev, extraRuimtes: [...prev.extraRuimtes, { id: uid(), naam: "", vloer: "", kenmerken: "" }],
    }));
    const pRemoveExtraRuimte = (id) => upd((prev) => ({ ...prev, extraRuimtes: prev.extraRuimtes.filter((r) => r.id !== id) }));
    const pUpdateExtraRuimte = (id, key, val) => upd((prev) => ({
      ...prev, extraRuimtes: prev.extraRuimtes.map((r) => r.id === id ? { ...r, [key]: val } : r),
    }));

    // pand-variant van addFotos: zelfde stappen (JPEG-filter, waarschuwing vanaf
    // FOTO_WAARSCHUWING_AANTAL, meteen een blob-voorbeeld tonen, nadien op de achtergrond
    // verkleinen) maar gericht op upd() i.p.v. rechtstreeks op setD().
    const pAddFotos = (files, onGeweigerd) => {
      const teAccepteren = [];
      const geweigerd = [];
      Array.from(files).forEach((f) => (isJpegFile(f) ? teAccepteren : geweigerd).push(f));
      if (geweigerd.length && onGeweigerd) onGeweigerd(geweigerd.map((f) => f.name));

      const vorigAantal = pd.fotos.length;
      const nieuwAantal = vorigAantal + teAccepteren.length;
      if (teAccepteren.length && vorigAantal < FOTO_WAARSCHUWING_AANTAL && nieuwAantal >= FOTO_WAARSCHUWING_AANTAL) {
        alert(`Dit pand bevat nu ${nieuwAantal} foto's. Vanaf ongeveer ${FOTO_WAARSCHUWING_AANTAL} foto's kan het genereren van de PDF trager verlopen of, in een uitzonderlijk geval, de tijdslimiet overschrijden. Overweeg enkel de meest relevante foto's te behouden.`);
      }

      const nieuw = teAccepteren.map((f) => ({ id: uid(), naam: f.name, url: URL.createObjectURL(f), base64: "", categorie: "Andere" }));
      upd((prev) => ({ ...prev, fotos: [...prev.fotos, ...nieuw] }));

      const leesAlsData = (blob, id) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          upd((prev) => ({ ...prev, fotos: prev.fotos.map((foto) => foto.id === id ? { ...foto, base64: String(e.target.result) } : foto) }));
        };
        reader.readAsDataURL(blob);
      };
      teAccepteren.forEach((f, fi) => {
        const id = nieuw[fi].id;
        resizeImageBlob(f).then((klein) => leesAlsData(klein, id)).catch(() => leesAlsData(f, id));
      });
    };
    const pRemoveFoto = (id) => upd((prev) => ({ ...prev, fotos: prev.fotos.filter((f) => f.id !== id) }));
    const pUpdateFoto = (id, key, val) => upd((prev) => ({ ...prev, fotos: prev.fotos.map((f) => f.id === id ? { ...f, [key]: val } : f) }));

    const pAddDocumenten = (files) => {
      Array.from(files).forEach((f) => {
        if (f.size > MAX_DOCUMENT_MB * 1024 * 1024) {
          alert(`"${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB — dat overschrijdt de toegelaten grens van ${MAX_DOCUMENT_MB} MB per document en wordt niet toegevoegd. Verklein het bestand (bv. via een online PDF-compressor) en probeer opnieuw.`);
          return;
        }
        const entry = { id: uid(), naam: f.name, type: f.type || "onbekend", grootte: f.size, notities: "" };
        if (f.size > GROOT_DOCUMENT_MB * 1024 * 1024) {
          alert(`"${f.name}" is ${(f.size / (1024 * 1024)).toFixed(1)} MB — dat is vrij groot. Het wordt wel toegevoegd (grote PDF's/foto's worden apart opgeladen, niet in het dossier zelf bewaard), maar dat opladen kan op een trage verbinding even duren — wacht tot "Bezig met opladen…" naast het document verdwijnt vóór je verder werkt.`);
        }
        if (f.type === "text/plain") {
          const reader = new FileReader();
          reader.onload = (e) => {
            upd((prev) => ({ ...prev, documenten: [...prev.documenten, { ...entry, notities: String(e.target.result).slice(0, 4000) }] }));
          };
          reader.readAsText(f);
        } else if (f.type === "application/pdf" || f.type.startsWith("image/")) {
          // zie addDocumenten hierboven voor de toelichting bij deze permanente Storage-opslag
          upd((prev) => ({ ...prev, documenten: [...prev.documenten, { ...entry, opladen: true }] }));
          const teUploaden = f.type.startsWith("image/")
            ? resizeImageBlobBinnenBudget(f).then((klein) => new File([klein], f.name, { type: "image/jpeg" })).catch(() => f)
            : Promise.resolve(f);
          teUploaden
            .then((bestand) => uploadDocumentNaarStorage(bestand, pd.id, entry.id).then((pad) => {
              upd((prev) => ({ ...prev, documenten: prev.documenten.map((doc) => doc.id === entry.id ? { ...doc, pad, mediaType: bestand.type || f.type, grootte: bestand.size, opladen: false } : doc) }));
            }))
            .catch((err) => {
              console.error("Document opladen mislukt, val terug op inline opslag:", err.message);
              if (f.size > GROOT_DOCUMENT_MB * 1024 * 1024) {
                upd((prev) => ({ ...prev, documenten: prev.documenten.filter((doc) => doc.id !== entry.id) }));
                alert(`"${f.name}" kon niet opgeladen worden (${err.message}). Probeer het opnieuw met een stabiele internetverbinding.`);
                return;
              }
              const reader = new FileReader();
              reader.onload = (e) => {
                const base64 = String(e.target.result).split(",")[1] || "";
                upd((prev) => ({ ...prev, documenten: prev.documenten.map((doc) => doc.id === entry.id ? { ...doc, base64, mediaType: f.type, opladen: false } : doc) }));
              };
              reader.readAsDataURL(f);
            });
        } else {
          upd((prev) => ({ ...prev, documenten: [...prev.documenten, entry] }));
        }
      });
    };
    const pRemoveDocument = (id) => {
      const doc = pd.documenten.find((x) => x.id === id);
      if (doc?.pad) supabase.storage.from("dossier-bijlagen").remove([doc.pad]).catch(() => {});
      upd((prev) => ({ ...prev, documenten: prev.documenten.filter((x) => x.id !== id) }));
    };
    const pUpdateDocument = (id, key, val) => upd((prev) => ({ ...prev, documenten: prev.documenten.map((doc) => doc.id === id ? { ...doc, [key]: val } : doc) }));

    const pAddVergelijkingspunt = () => upd((prev) => ({
      ...prev, vergelijkingspunten: [...prev.vergelijkingspunten, {
        id: uid(), adres: "", kadastraleGegevens: "", bouwjaar: "", aardTransactie: "Verkoop uit de hand",
        datumTransactie: "", belastbareGrondslag: "", ligging: "", bestemming: "", oriëntatie: "",
        externeAfwerking: "", onderhoud: "", rooilijnbreedte: "", gevelbreedte: "", bebouwdeOpp: "", afweging: "",
      }],
    }));
    const pRemoveVergelijkingspunt = (id) => upd((prev) => ({ ...prev, vergelijkingspunten: prev.vergelijkingspunten.filter((v) => v.id !== id) }));
    const pUpdateVergelijkingspunt = (id, key, val) => upd((prev) => ({
      ...prev, vergelijkingspunten: prev.vergelijkingspunten.map((v) => v.id === id ? { ...v, [key]: val } : v),
    }));

    return {
      pd, pcalc, setPd: upd,
      set: pSet, setEig: pSetEig,
      addRuimte: pAddRuimte, addRuimtesBulk: pAddRuimtesBulk, removeRuimte: pRemoveRuimte, updateRuimte: pUpdateRuimte,
      addSchijf: pAddSchijf, removeSchijf: pRemoveSchijf, updateSchijf: pUpdateSchijf,
      addSlaapkamer: pAddSlaapkamer, removeSlaapkamer: pRemoveSlaapkamer, updateSlaapkamer: pUpdateSlaapkamer,
      addExtraRuimte: pAddExtraRuimte, removeExtraRuimte: pRemoveExtraRuimte, updateExtraRuimte: pUpdateExtraRuimte,
      addFotos: pAddFotos, removeFoto: pRemoveFoto, updateFoto: pUpdateFoto,
      addDocumenten: pAddDocumenten, removeDocument: pRemoveDocument, updateDocument: pUpdateDocument,
      addVergelijkingspunt: pAddVergelijkingspunt, removeVergelijkingspunt: pRemoveVergelijkingspunt, updateVergelijkingspunt: pUpdateVergelijkingspunt,
    };
  }
  const actief = bindPand(veiligePandIndex);

  // vastgoedType (zie StepType) bepaalt hier welk tabblad op de 7e plaats staat: de residentiële
  // "Ruimte-eigenschappen" (hall/woonkamer/keuken/badkamer/... checklists) heeft geen zinvolle
  // invulling bij een magazijn of kantoorgebouw — dat tabblad wordt dan vervangen (niet louter
  // verborgen) door "Bedrijfskenmerken". De rest van de wizard (aantal/volgorde van de andere
  // tabbladen) blijft ongewijzigd voor elk vastgoedtype. Sinds de invoering van meerdere panden
  // per dossier geldt dit per ACTIEF pand (actief.pd), niet meer voor het dossier als geheel — twee
  // panden in hetzelfde dossier kunnen dus best een verschillend vastgoedtype hebben en elk hun
  // eigen 7e tabblad tonen zodra ze als actief gekozen worden.
  const isResidentieel = actief.pd.vastgoedType !== "KMO-vastgoed" && actief.pd.vastgoedType !== "Bedrijfsvastgoed";
  const steps = [
    { key: "documenten", label: "Documenten (start hier)", icon: Paperclip },
    { key: "opdracht", label: "Opdracht & partijen", icon: Users },
    { key: "panden", label: "Panden", icon: Home },
    { key: "ligging", label: "Ligging & omgeving", icon: MapPin },
    { key: "type", label: "Type, staat & kadaster", icon: Building2 },
    { key: "constructie", label: "Constructie & isolatie", icon: Layers },
    { key: "installaties", label: "Verwarming & installaties", icon: Flame },
    isResidentieel
      ? { key: "ruimtes-eig", label: "Ruimte-eigenschappen", icon: Sofa }
      : { key: "bedrijfskenmerken", label: "Bedrijfskenmerken", icon: Building2 },
    { key: "markt", label: "Markt, stedenbouw & juridisch", icon: LineChart },
    { key: "swot", label: "SWOT-analyse", icon: ClipboardList },
    { key: "afmetingen", label: "Afmetingen & indeling", icon: Grid3x3 },
    { key: "vergelijkingspunten", label: "Vergelijkingspunten", icon: Ruler },
    { key: "waardering", label: "Waardering", icon: Calculator },
    { key: "fotos", label: "Foto's (bijlage)", icon: ImageIcon },
    { key: "rapport", label: "Rapport", icon: FileText },
  ];

  // parkeerplaatsen & garages (dossierbreed, zie initialData.parkeerplaatsenGarages — bewust niet
  // per pand: één gedeelde lijst voor het hele dossier, met een eigen totaal dat bovenop de som van
  // alle panden geteld wordt, zie berekenParkeerplaatsenTotaal en StepWaardering hieronder)
  const addParkeerplaats = () => setD((p) => ({
    ...p, parkeerplaatsenGarages: [...p.parkeerplaatsenGarages, { id: uid(), type: "Autostaanplaats (buiten)", aantal: 1, waardePerStuk: "", omschrijving: "" }],
  }));
  const removeParkeerplaats = (id) => setD((p) => ({ ...p, parkeerplaatsenGarages: p.parkeerplaatsenGarages.filter((pp) => pp.id !== id) }));
  const updateParkeerplaats = (id, key, val) => setD((p) => ({
    ...p, parkeerplaatsenGarages: p.parkeerplaatsenGarages.map((pp) => pp.id === id ? { ...pp, [key]: val } : pp),
  }));

  // Portefeuille-overzicht voor StepWaardering hieronder: enkel berekend zodra er effectief extra
  // panden zijn (anders blijft dit gewoon "null" en verandert er niets aan het scherm van een
  // gewoon éénpand-dossier). Zelfde optelling als buildMultiPandReportData gebruikt voor het
  // rapport zelf, zodat het scherm hier en het uiteindelijke verslag nooit uit elkaar kunnen lopen.
  const portefeuille = d.extraPanden.length === 0 ? null : (() => {
    const panden = [
      { label: pandLabel(d, "Hoofdpand"), calc },
      ...d.extraPanden.map((p, i) => {
        const pd = { ...d, ...p, extraPanden: [], parkeerplaatsenGarages: [] };
        return { label: pandLabel(p, `Pand ${i + 2}`), calc: berekenWaardering(pd) };
      }),
    ];
    // parkeerTotaal zit al verrekend in panden[0].calc.venaleWaarde (hoofdpand — berekenWaardering
    // telt d.parkeerplaatsenGarages nu zelf bij de venale waarde op), dus NIET nogmaals optellen bij
    // het portefeuilletotaal. Wordt hier enkel nog bijgehouden voor de informatieve regel hieronder.
    const parkeerTotaal = berekenParkeerplaatsenTotaal(d.parkeerplaatsenGarages);
    const totaal = panden.reduce((som, p) => som + (p.calc.venaleWaarde || 0), 0);
    return { panden, parkeerTotaal, totaal };
  })();

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
      <div className="no-print flex flex-wrap items-center justify-between gap-y-2 px-4 md:px-6 py-3 md:py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // waarschuwt vóór het verlaten van het dossier als de laatste wijziging nog niet
              // (of nog niet bevestigd) bewaard is, zodat een makelaar niet per ongeluk het
              // scherm verlaat terwijl er net iets mislukte of nog aan het opslaan is
              if (opslaanStatus === "fout" && !confirm("Er is een fout bij het opslaan (" + opslaanFout + "). Toch teruggaan naar het overzicht? Niet-opgeslagen wijzigingen gaan dan verloren.")) return;
              if (opslaanStatus === "bezig" && !confirm("Er wordt nog opgeslagen. Toch al teruggaan naar het overzicht?")) return;
              onBack();
            }}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
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
        <div className="flex flex-wrap items-center gap-2 no-print">
          {opslaanStatus === "bezig" && (
            <span className="text-xs" style={{ color: INK_SOFT }}>Bezig met opslaan…</span>
          )}
          {opslaanStatus === "fout" && (
            <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: "#fee2e2", color: "#991b1b", fontWeight: 500 }}>
              <AlertTriangle size={12} /> Niet opgeslagen
            </span>
          )}
          <button onClick={() => setD((p) => ({ ...p, status: p.status === "concept" ? "afgewerkt" : "concept" }))}
            className="text-xs px-3 py-1 rounded-full" style={{
              background: d.status === "afgewerkt" ? STAMP : STAMP_SOFT,
              color: d.status === "afgewerkt" ? "#fff" : STAMP, fontWeight: 500,
            }}>
            {d.status === "afgewerkt" ? "Afgewerkt" : "Concept"} · wordt automatisch bewaard
          </button>
        </div>
      </div>
      {opslaanStatus === "fout" && (
        <div className="no-print flex items-center justify-between gap-3 px-6 py-2.5" style={{ background: "#fee2e2", borderBottom: "1px solid #fecaca" }}>
          <span className="text-xs" style={{ color: "#991b1b" }}>{opslaanFout}</span>
          <button
            onClick={async () => {
              setOpslaanStatus("bezig");
              const res = await onSave(d);
              if (res && res.ok === false) { setOpslaanStatus("fout"); setOpslaanFout(res.error || "Opslaan mislukt."); }
              else { setOpslaanStatus("opgeslagen"); setOpslaanFout(""); }
            }}
            className="text-xs px-3 py-1 rounded-lg flex-shrink-0"
            style={{ background: "#991b1b", color: "#fff", fontWeight: 500 }}>
            Probeer opnieuw
          </button>
          {/* Bij een botsing (iemand anders wijzigde dit dossier intussen) helpt "probeer opnieuw"
              niet: dan moet de recentste versie eerst opgehaald worden. Zie de botsingscontrole in
              _saveDossierPoging. */}
          {/botsing|iemand anders gewijzigd/i.test(opslaanFout) && (
            <button onClick={() => window.location.reload()}
              className="text-xs px-3 py-1 rounded-lg flex-shrink-0"
              style={{ background: "#fff", color: "#991b1b", fontWeight: 500, border: "1px solid #991b1b" }}>
              Pagina herladen
            </button>
          )}
        </div>
      )}

      {/* Op een telefoon staat de stappenlijst als horizontaal schuivende balk bovenaan, vanaf een
          tablet als vaste zijbalk links. Voordien was ze altijd een kolom van 220px, wat op een
          klein scherm nauwelijks ruimte overliet voor de inhoud zelf. */}
      <div className="flex flex-col md:flex-row" style={{ minHeight: 560 }}>
        <div className="no-print py-3 px-3 md:py-4 flex md:block gap-2 overflow-x-auto md:overflow-visible md:flex-shrink-0 md:w-[220px]"
          style={{ borderBottom: `1px solid ${LINE}`, background: "rgba(0,0,0,0.015)" }}>
          {steps.map((s, i) => {
            const active = i === step;
            const Icon = s.icon;
            return (
              <button key={s.key} onClick={() => setStep(i)}
                className="flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg mb-0 md:mb-1 md:w-full flex-shrink-0 transition-colors"
                style={{
                  background: active ? PAPER_RAISED : "transparent",
                  boxShadow: active ? `0 0 0 1px ${LINE}` : "none",
                  color: active ? INK : INK_SOFT,
                }}>
                <Icon size={14} style={{ color: active ? BRASS : INK_SOFT, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, whiteSpace: "nowrap" }}>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* de vaste maxHeight geldt enkel vanaf md: op een telefoon scrollt de pagina zelf, een
            scrollvak-in-een-scrollvak is daar onwerkbaar */}
        <div className="report-scroll-area flex-1 px-4 md:px-8 py-5 md:py-6 overflow-visible md:overflow-auto md:max-h-[700px]">
          {/* sleutel-gebaseerd i.p.v. een vaste numerieke step===N: zo blijft dit correct ook al
              verschuift de 7e plaats hierboven tussen "ruimtes-eig" en "bedrijfskenmerken" — zie
              de toelichting bij de steps-array hierboven. */}
          {steps[step]?.key === "opdracht" && (
            <StepOpdracht d={d} set={set} addEigenaar={addEigenaar} removeEigenaar={removeEigenaar} updateEigenaar={updateEigenaar} />
          )}
          {steps[step]?.key === "panden" && (
            <StepPanden d={d} veiligePandIndex={veiligePandIndex} setActievePandIndex={setActievePandIndex} addPand={addPand} removePand={removePand} />
          )}

          {/* Alle stappen hieronder (Documenten t/m Foto's) werken op het ACTIEVE pand (actief.pd/
              actief.set/...) i.p.v. rechtstreeks op het dossier d/set — ook "Documenten" is
              bewust per pand (zie maakLeegPand): elk pand kan zijn eigen brondocumenten
              (grondplannen, kadastraal uittreksel...) hebben voor de AI-analyse. Voor een dossier
              zonder extra panden is actief.pd exact d zelf (zie bindPand hierboven), dus verandert
              hier niets aan het gedrag van een gewoon, bestaand dossier. PandenBalk hierboven
              blijft om diezelfde reden ook onzichtbaar zolang er geen extra panden zijn. */}
          {["documenten", "ligging", "type", "constructie", "installaties", "ruimtes-eig", "bedrijfskenmerken", "markt", "swot", "afmetingen", "vergelijkingspunten", "waardering", "fotos"].includes(steps[step]?.key) && (
            <PandenBalk d={d} veiligePandIndex={veiligePandIndex} setActievePandIndex={setActievePandIndex} />
          )}
          {steps[step]?.key === "documenten" && (
            <StepDocumenten d={actief.pd} set={actief.set} addDocumenten={actief.addDocumenten} removeDocument={actief.removeDocument} updateDocument={actief.updateDocument} addRuimtesBulk={actief.addRuimtesBulk} />
          )}
          {steps[step]?.key === "ligging" && <StepLigging d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "type" && <StepType d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "constructie" && <StepConstructie d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "installaties" && <StepInstallaties d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "ruimtes-eig" && (
            <StepRuimteEigenschappen d={actief.pd} set={actief.set} setEig={actief.setEig}
              addSlaapkamer={actief.addSlaapkamer} removeSlaapkamer={actief.removeSlaapkamer} updateSlaapkamer={actief.updateSlaapkamer}
              addExtraRuimte={actief.addExtraRuimte} removeExtraRuimte={actief.removeExtraRuimte} updateExtraRuimte={actief.updateExtraRuimte} />
          )}
          {steps[step]?.key === "bedrijfskenmerken" && <StepBedrijfskenmerken d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "markt" && <StepMarkt d={actief.pd} set={actief.set} />}
          {steps[step]?.key === "swot" && <StepSwot d={actief.pd} set={actief.set} setD={actief.setPd} />}
          {steps[step]?.key === "afmetingen" && (
            <StepAfmetingen d={actief.pd} set={actief.set} calc={actief.pcalc}
              addRuimte={actief.addRuimte} removeRuimte={actief.removeRuimte} updateRuimte={actief.updateRuimte}
              addSchijf={actief.addSchijf} removeSchijf={actief.removeSchijf} updateSchijf={actief.updateSchijf} />
          )}
          {steps[step]?.key === "vergelijkingspunten" && (
            <StepVergelijkingspunten d={actief.pd} set={actief.set}
              addVergelijkingspunt={actief.addVergelijkingspunt} removeVergelijkingspunt={actief.removeVergelijkingspunt} updateVergelijkingspunt={actief.updateVergelijkingspunt} />
          )}
          {steps[step]?.key === "waardering" && (
            <StepWaardering d={actief.pd} set={actief.set} calc={actief.pcalc}
              parkeerplaatsenGarages={d.parkeerplaatsenGarages}
              addParkeerplaats={addParkeerplaats} removeParkeerplaats={removeParkeerplaats} updateParkeerplaats={updateParkeerplaats}
              portefeuille={portefeuille} />
          )}
          {/* voorpaginaFoto is dossierbreed (één covers-foto voor het hele verslag, ongeacht welk
              pand actief is — zie initialData/maakLeegPand), en bestaat dus niet op actief.pd zelf
              zodra dat een extra pand is; hier expliciet vanuit het dossier bijgevoegd zodat het
              scherm dat correct blijft tonen ongeacht welk pand net actief is. */}
          {steps[step]?.key === "fotos" && <StepFotos d={{ ...actief.pd, voorpaginaFoto: d.voorpaginaFoto }} addFotos={actief.addFotos} removeFoto={actief.removeFoto} updateFoto={actief.updateFoto}
            setVoorpaginaFoto={setVoorpaginaFoto} removeVoorpaginaFoto={removeVoorpaginaFoto} />}
          {steps[step]?.key === "rapport" && <StepRapport d={d} calc={calc} huisstijl={huisstijl} />}

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

function InfoModal({ title, sections, onClose }) {
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

function VoorwaardenModal({ onClose }) {
  return <InfoModal title="Gebruiksvoorwaarden" sections={VOORWAARDEN} onClose={onClose} />;
}

function PrivacyverklaringModal({ onClose }) {
  return <InfoModal title="Privacyverklaring" sections={PRIVACYVERKLARING} onClose={onClose} />;
}

// ---------- login ----------
function LoginScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [naam, setNaam] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [bezig, setBezig] = useState(false);
  // toont een "opnieuw versturen"-knop op het aanmeldscherm zodra dat relevant is (na registratie,
  // of wanneer aanmelden geweigerd werd omdat het account nog niet bevestigd is)
  const [toonHerverzenden, setToonHerverzenden] = useState(false);
  const [akkoordVoorwaarden, setAkkoordVoorwaarden] = useState(false);
  const [toonVoorwaarden, setToonVoorwaarden] = useState(false);
  const [toonPrivacy, setToonPrivacy] = useState(false);

  const submitLogin = async () => {
    if (bezig) return;
    setError(""); setInfo(""); setToonHerverzenden(false);
    if (!email.trim() || !wachtwoord) { setError("Vul e-mail en wachtwoord in."); return; }
    setBezig(true);
    try {
      const user = await login(email.trim(), wachtwoord);
      await onLogin(user);
    } catch (err) {
      if (err.needsVerify) {
        setInfo(err.message);
        setToonHerverzenden(true);
      } else {
        setError(err.message || "Er ging iets mis bij het aanmelden. Probeer opnieuw.");
      }
    } finally {
      setBezig(false);
    }
  };
  const submitRegister = async () => {
    if (bezig) return;
    setError(""); setInfo(""); setToonHerverzenden(false);
    if (!naam.trim() || !email.trim() || !wachtwoord) { setError("Vul alle velden in."); return; }
    if (wachtwoord.length < 6) { setError("Wachtwoord moet minstens 6 tekens bevatten."); return; }
    if (!akkoordVoorwaarden) { setError("Je moet akkoord gaan met de gebruiksvoorwaarden om een account aan te maken."); return; }
    setBezig(true);
    try {
      const { user, session } = await registreer(email.trim(), wachtwoord, naam.trim());
      if (user && session) {
        // e-mailbevestiging staat uit voor dit Supabase-project: meteen ingelogd
        await onRegister(user);
      } else {
        // e-mailbevestiging staat aan: check je mailbox en klik op de bevestigingslink
        setInfo("Account aangemaakt! Check je mailbox en klik op de bevestigingslink om je account te activeren.");
        setToonHerverzenden(true);
        setMode("login");
      }
    } catch (err) {
      setError(err.message || "Er ging iets mis bij het registreren. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  };
  const opnieuwVersturen = async () => {
    if (bezig || !email.trim()) return;
    setError(""); setInfo("");
    setBezig(true);
    try {
      await stuurBevestigingOpnieuw(email.trim());
      setInfo("Bevestigingsmail opnieuw verstuurd.");
    } catch (err) {
      setError(err.message || "Kon de mail niet opnieuw versturen. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  };
  const submitForgot = async () => {
    if (bezig) return;
    setError(""); setInfo("");
    if (!email.trim()) { setError("Vul je e-mailadres in."); return; }
    setBezig(true);
    try {
      await vraagWachtwoordResetAan(email.trim());
      setInfo("Als dit e-mailadres bij ons gekend is, hebben we een link gestuurd om een nieuw wachtwoord in te stellen — klik op die link in je mailbox.");
      setMode("login");
    } catch (err) {
      setError(err.message || "Er ging iets mis. Probeer opnieuw.");
    } finally {
      setBezig(false);
    }
  };
  const onEnter = (fn) => (e) => { if (e.key === "Enter") fn(); };

  return (
    <div className="w-full flex flex-col items-center justify-center" style={{ minHeight: 560, background: PAPER, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="rounded-xl p-8" style={{ width: 360, background: PAPER_RAISED, border: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Home size={18} style={{ color: BRASS }} />
          <span style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: INK }}>Houpels Valuation & Real Estate</span>
        </div>
        <div className="text-xs mb-6" style={{ color: INK_SOFT }}>Taxatiedossiers — aanmelden</div>

        {(mode === "login" || mode === "register") && (
          <div className="flex mb-5 rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); setToonHerverzenden(false); }}
              className="flex-1 text-xs py-2"
              style={{ background: mode === "login" ? INK : PAPER_RAISED, color: mode === "login" ? "#fff" : INK_SOFT, fontWeight: 500 }}>
              Aanmelden
            </button>
            <button type="button" onClick={() => { setMode("register"); setError(""); setInfo(""); setToonHerverzenden(false); }}
              className="flex-1 text-xs py-2"
              style={{ background: mode === "register" ? INK : PAPER_RAISED, color: mode === "register" ? "#fff" : INK_SOFT, fontWeight: 500 }}>
              Nieuwe makelaar
            </button>
          </div>
        )}

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

        {mode === "login" && (
          <div className="flex flex-col gap-3">
            <Field label="E-mail"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(submitLogin)} /></Field>
            <Field label="Wachtwoord"><TextInput type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} onKeyDown={onEnter(submitLogin)} /></Field>
            <button type="button" onClick={submitLogin} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig..." : "Aanmelden"}
            </button>
            {toonHerverzenden && (
              <button type="button" onClick={opnieuwVersturen} disabled={bezig} className="text-xs text-center" style={{ color: BRASS, background: "none", fontWeight: 500 }}>
                Bevestigingsmail opnieuw versturen
              </button>
            )}
            <button type="button" onClick={() => { setMode("forgot"); setError(""); setInfo(""); setToonHerverzenden(false); }}
              className="text-xs text-center" style={{ color: BRASS, background: "none", fontWeight: 500 }}>
              Wachtwoord vergeten?
            </button>
          </div>
        )}
        {mode === "register" && (
          <div className="flex flex-col gap-3">
            <Field label="Naam"><TextInput value={naam} onChange={(e) => setNaam(e.target.value)} onKeyDown={onEnter(submitRegister)} /></Field>
            <Field label="E-mail"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(submitRegister)} /></Field>
            <Field label="Wachtwoord"><TextInput type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} onKeyDown={onEnter(submitRegister)} /></Field>
            <label className="flex items-start gap-2 text-xs cursor-pointer select-none" style={{ color: INK_SOFT }}>
              <input type="checkbox" checked={akkoordVoorwaarden} onChange={(e) => setAkkoordVoorwaarden(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: BRASS, marginTop: 1 }} />
              <span>
                Ik heb de{" "}
                <button type="button" onClick={() => setToonVoorwaarden(true)} className="underline" style={{ color: BRASS, background: "none" }}>
                  gebruiksvoorwaarden
                </button>{" "}
                en de{" "}
                <button type="button" onClick={() => setToonPrivacy(true)} className="underline" style={{ color: BRASS, background: "none" }}>
                  privacyverklaring
                </button>{" "}
                gelezen en ga ermee akkoord.
              </span>
            </label>
            <button type="button" onClick={submitRegister} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig..." : "Account aanmaken"}
            </button>
          </div>
        )}
        {mode === "forgot" && (
          <div className="flex flex-col gap-3">
            <div className="text-xs" style={{ color: INK_SOFT }}>Vul je e-mailadres in — we sturen je een link om een nieuw wachtwoord in te stellen.</div>
            <Field label="E-mail"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(submitForgot)} /></Field>
            <button type="button" onClick={submitForgot} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig..." : "Verstuur link"}
            </button>
            <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); }}
              className="text-xs text-center" style={{ color: INK_SOFT, background: "none" }}>
              Terug naar aanmelden
            </button>
          </div>
        )}
      </div>
      <a href="/handleiding-taxatie-app-huyzen.pdf" target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs mt-4" style={{ width: 360, color: INK_SOFT, textDecoration: "none" }}>
        <Download size={13} /> Handleiding taxatie-app (PDF)
      </a>
      <div className="flex items-center gap-3 mt-2" style={{ width: 360 }}>
        <button type="button" onClick={() => setToonVoorwaarden(true)}
          className="text-xs underline" style={{ textAlign: "left", color: INK_SOFT, background: "none" }}>
          Gebruiksvoorwaarden
        </button>
        <button type="button" onClick={() => setToonPrivacy(true)}
          className="text-xs underline" style={{ textAlign: "left", color: INK_SOFT, background: "none" }}>
          Privacyverklaring
        </button>
      </div>
      {toonVoorwaarden && <VoorwaardenModal onClose={() => setToonVoorwaarden(false)} />}
      {toonPrivacy && <PrivacyverklaringModal onClose={() => setToonPrivacy(false)} />}
    </div>
  );
}

// ---------- dashboard ----------
function Dashboard({ user, index, onOpen, onNew, onDelete, onLogout, onOpenAccount, onRefresh, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  const [zoek, setZoek] = useState("");
  const [verversen, setVerversen] = useState(false);
  const handleRefreshClick = async () => {
    if (verversen) return;
    setVerversen(true);
    try { await onRefresh(); } finally { setVerversen(false); }
  };
  // een beheerder ziet ALLE dossiers (de rijregels op de databank geven die al mee terug, zie
  // loadIndex/schema.sql) — een gewone makelaar blijft, ook client-side, tot de eigen dossiers
  // beperkt als extra veiligheidsmarge bovenop de databank-regels.
  const mine = user.isAdmin ? index : index.filter((x) => x.ownerId === user.id);
  const matches = (x) => {
    const t = `${x.straat} ${x.nummer} ${x.gemeente} ${x.postcode} ${x.makelaarNaam || ""}`.toLowerCase();
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
        <div style={{ fontSize: 12, color: INK_SOFT }}>
          {x.postcode} {x.gemeente}
          {user.isAdmin && x.makelaarNaam && <> · <strong style={{ color: INK_SOFT, fontWeight: 600 }}>{x.makelaarNaam}</strong></>}
          {" "}· laatst bewerkt {fmtDatum(x.laatstBewerkt)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs px-2.5 py-1 rounded-full" style={{
          background: x.status === "afgewerkt" ? STAMP_SOFT : BRASS_SOFT,
          color: x.status === "afgewerkt" ? STAMP : BRASS, fontWeight: 500,
        }}>{x.status === "afgewerkt" ? "Afgewerkt" : "Concept"}</span>
        <button onClick={(e) => {
          e.stopPropagation();
          const naam = x.straat ? `${x.straat} ${x.nummer}${x.bus ? "/" + x.bus : ""}` : "dit naamloze dossier";
          if (window.confirm(`Dossier "${naam}" definitief verwijderen? Dit kan niet ongedaan gemaakt worden.`)) onDelete(x.id);
        }}><Trash2 size={14} style={{ color: DANGER }} /></button>
      </div>
    </div>
  );

  return (
    <div className="w-full rounded-xl overflow-hidden" style={{ background: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif", minHeight: 600 }}>
      {/* kopbalk mag afbreken op een klein scherm i.p.v. alles op één rij te persen */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 md:px-6 py-3 md:py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2">
          <Home size={16} style={{ color: BRASS }} />
          <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500 }}>{user.isAdmin ? "Alle dossiers" : "Mijn dossiers"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {user.isAdmin && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#FBEAEA", color: DANGER, fontWeight: 500 }}>
              Beheerder — ziet dossiers van alle makelaars
            </span>
          )}
          {/* toont welke huisstijl actief is voor de ingelogde gebruiker (bepaald door e-mailadres,
              zie kiesHuisstijl) — vooral handig om meteen visueel te kunnen nagaan of bv. een
              @huyzen.be-account effectief de Huyzen-huisstijl krijgt, zonder een rapport te moeten
              genereren. */}
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: hs.key === "houpels" ? BRASS_SOFT : `${hs.kleur}22`, color: hs.kleur, fontWeight: 500 }}>
            Huisstijl: {hs.naam}
          </span>
          <span className="text-sm" style={{ color: INK_SOFT }}>{user.naam} · {user.email}</span>
          <button onClick={onOpenAccount} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <Settings size={13} /> Mijn account
          </button>
          <button onClick={handleRefreshClick} disabled={verversen} title="Lijst opnieuw ophalen"
            className="p-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <RefreshCw size={14} className={verversen ? "animate-spin" : ""} />
          </button>
          <button onClick={onLogout} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>Afmelden</button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6 gap-3">
          <TextInput placeholder={user.isAdmin ? "Zoek op adres, gemeente of makelaar..." : "Zoek op adres of gemeente..."} value={zoek} onChange={(e) => setZoek(e.target.value)} style={{ maxWidth: 320 }} />
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

// ---------- mijn account: eigen contactgegevens, BIV-/Vlabel-nummer ----------
// deze gegevens worden bij elk NIEUW dossier automatisch ingevuld bij "Identificatie
// schatter-expert" (zie handleNew() in AppRoot), zodat een makelaar dit niet telkens opnieuw
// moet intypen. Bestaande dossiers wijzigen niet met terugwerkende kracht.
function AccountScherm({ user, onSave, onBack }) {
  const [naam, setNaam] = useState(user.naam || "");
  const [telefoon, setTelefoon] = useState(user.telefoon || "");
  const [titel, setTitel] = useState(user.titel || "");
  const [bivNummer, setBivNummer] = useState(user.bivNummer || "");
  const [vlabelNummer, setVlabelNummer] = useState(user.vlabelNummer || "");
  const [status, setStatus] = useState(null); // { type: "ok" | "fout", message }
  const [bezig, setBezig] = useState(false);
  const [toonVoorwaarden, setToonVoorwaarden] = useState(false);
  const [toonPrivacy, setToonPrivacy] = useState(false);

  const submit = async () => {
    setBezig(true);
    setStatus(null);
    try {
      await onSave({ naam: naam.trim(), telefoon: telefoon.trim(), titel: titel.trim(), bivNummer: bivNummer.trim(), vlabelNummer: vlabelNummer.trim() });
      setStatus({ type: "ok", message: "Opgeslagen. Deze gegevens worden vanaf nu automatisch ingevuld bij elk nieuw dossier." });
    } catch (e) {
      setStatus({ type: "fout", message: e.message || "Opslaan mislukt." });
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="w-full rounded-xl overflow-hidden" style={{ background: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif", minHeight: 600 }}>
      <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <button onClick={onBack} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
          style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
          <ChevronLeft size={13} /> Overzicht
        </button>
        <Settings size={16} style={{ color: BRASS }} />
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500 }}>Mijn account</div>
      </div>

      <div className="p-6" style={{ maxWidth: 480 }}>
        <div className="text-xs mb-6" style={{ color: INK_SOFT }}>
          Deze gegevens worden automatisch ingevuld bij "Identificatie schatter-expert" telkens je een nieuw dossier aanmaakt — je hoeft ze dan niet meer telkens opnieuw in te typen. Bestaande dossiers passen niet met terugwerkende kracht aan.
        </div>

        <div className="grid gap-4 mb-6">
          <Field label="E-mailadres" hint="Kan hier niet gewijzigd worden — dit is het adres waarmee je aanmeldt.">
            <TextInput value={user.email} disabled style={{ opacity: 0.6 }} />
          </Field>
          <Field label="Naam"><TextInput value={naam} onChange={(e) => setNaam(e.target.value)} /></Field>
          <Field label="Telefoonnummer"><TextInput value={telefoon} onChange={(e) => setTelefoon(e.target.value)} placeholder="bv. 0470 12 34 56" /></Field>
          <Field label="(Beroeps)titel"><TextInput value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="bv. Vastgoedmakelaar - Vlabel-erkend schatter" /></Field>
          <Field label="BIV-nummer" hint="Erkenningsnummer bij het Beroepsinstituut van Vastgoedmakelaars">
            <TextInput value={bivNummer} onChange={(e) => setBivNummer(e.target.value)} />
          </Field>
          <Field label="Vlabel-identificatienummer" hint="Door de Vlaamse Belastingdienst toegekend identificatienummer voor schatters-experten">
            <TextInput value={vlabelNummer} onChange={(e) => setVlabelNummer(e.target.value)} />
          </Field>
        </div>

        {status && (
          <div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{
            background: status.type === "ok" ? "#DCFCE7" : "#fee2e2",
            color: status.type === "ok" ? "#166534" : "#991b1b",
          }}>
            {status.message}
          </div>
        )}

        <button onClick={submit} disabled={bezig} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg text-white"
          style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
          {bezig ? "Bezig met opslaan..." : "Opslaan"}
        </button>

        <div className="flex items-center gap-3 mt-6">
          <button type="button" onClick={() => setToonVoorwaarden(true)} className="text-xs underline" style={{ color: INK_SOFT, background: "none" }}>
            Gebruiksvoorwaarden bekijken
          </button>
          <button type="button" onClick={() => setToonPrivacy(true)} className="text-xs underline" style={{ color: INK_SOFT, background: "none" }}>
            Privacyverklaring bekijken
          </button>
        </div>
      </div>
      {toonVoorwaarden && <VoorwaardenModal onClose={() => setToonVoorwaarden(false)} />}
      {toonPrivacy && <PrivacyverklaringModal onClose={() => setToonPrivacy(false)} />}
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

// scherm na het klikken op de "wachtwoord vergeten"-link in de mailbox: enkel nog een nieuw
// wachtwoord kiezen (de link zelf meldt de gebruiker al aan, zie de PASSWORD_RECOVERY-listener
// in AppRoot hierboven)
function WachtwoordHerstellenScreen({ onDone }) {
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState("");
  const [nieuwWachtwoordBevestig, setNieuwWachtwoordBevestig] = useState("");
  const [error, setError] = useState("");
  const [bezig, setBezig] = useState(false);

  const submit = async () => {
    if (bezig) return;
    setError("");
    if (nieuwWachtwoord.length < 6) { setError("Nieuw wachtwoord moet minstens 6 tekens bevatten."); return; }
    if (nieuwWachtwoord !== nieuwWachtwoordBevestig) { setError("De wachtwoorden komen niet overeen."); return; }
    setBezig(true);
    try {
      await stelNieuwWachtwoordIn(nieuwWachtwoord);
      await onDone();
    } catch (err) {
      setError(err.message || "Er ging iets mis bij het wijzigen van je wachtwoord. Probeer opnieuw.");
      setBezig(false);
    }
  };
  const onEnter = (e) => { if (e.key === "Enter") submit(); };

  return (
    <div className="w-full flex items-center justify-center" style={{ minHeight: 560, background: PAPER, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="rounded-xl p-8" style={{ width: 360, background: PAPER_RAISED, border: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2 mb-1">
          <Home size={18} style={{ color: BRASS }} />
          <span style={{ fontFamily: "Georgia, serif", fontSize: 18, fontWeight: 500, color: INK }}>Houpels Valuation & Real Estate</span>
        </div>
        <div className="text-xs mb-6" style={{ color: INK_SOFT }}>Nieuw wachtwoord instellen</div>
        {error && (
          <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Field label="Nieuw wachtwoord"><TextInput type="password" value={nieuwWachtwoord} onChange={(e) => setNieuwWachtwoord(e.target.value)} onKeyDown={onEnter} /></Field>
          <Field label="Bevestig nieuw wachtwoord"><TextInput type="password" value={nieuwWachtwoordBevestig} onChange={(e) => setNieuwWachtwoordBevestig(e.target.value)} onKeyDown={onEnter} /></Field>
          <button type="button" onClick={submit} disabled={bezig} className="text-sm py-2 rounded-lg text-white mt-1" style={{ background: INK, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
            {bezig ? "Bezig..." : "Wachtwoord wijzigen"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
