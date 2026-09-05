import React, { useState, useRef, useEffect, useContext } from "react";
import {
  Home, MapPin, Ruler, Building2, Trees, Hammer, LineChart, ClipboardList,
  Grid3x3, Calculator, FileText, Plus, Trash2, ChevronLeft, ChevronRight,
  Check, AlertTriangle, Image as ImageIcon, Paperclip, Upload, X, Sparkles,
  Loader2, Layers, Flame, Sofa, Users, BedDouble, Camera, Download, Settings, RefreshCw
} from "lucide-react";
import {
  INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, BRASS, BRASS_SOFT, STAMP, STAMP_SOFT, DANGER,
  HUYZEN_BLAUW, HUYZEN_LOGO_B64, HUISSTIJLEN, kiesHuisstijl, HuisstijlContext,
  KLASSEN, ABEX_INDEX_1998, GEVEL_FACTOR, VERDIEPINGEN, OPTS, RUIMTE_CHECKLISTS,
  emptyRoomState, initialData, maakLeegPand,
} from "./constants.js";
import {
  num, epcRichtwaardePct, eur, pct, nlDate, uid, dash, joinOrDash, isEmptyVal, wEsc,
} from "./lib/format.js";
import {
  isJpegFile, resizeImageBlob, resizeImageBlobBinnenBudget, schatBase64Bytes,
  berekenPandBijlageBytes, fmtMB, EIGEN_OPSLAG_ORIGIN, veiligeAfbeeldingSrc,
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
import {
  buildPropertySummary, genereerAutomatischeSwot, extractJson,
  duidAiDocFout, uploadDocumentNaarStorage, callClaudeWithDocs,
} from "./data/ai.js";
import {
  Field, inputStyle, TextInput, Select, MultiCheck, Checkbox, Section, Slider, Row,
} from "./ui/velden.jsx";
import { StepRapport } from "./rapport/StepRapport.jsx";
import { StepOpdracht } from "./stappen/StepOpdracht.jsx";
import { StepLigging } from "./stappen/StepLigging.jsx";
import { StepType } from "./stappen/StepType.jsx";
import { StepConstructie } from "./stappen/StepConstructie.jsx";

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
      {cfg.extraMultiCheck && (
        <div className="mt-2">
          <div className="mb-1" style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}>{cfg.extraMultiCheck.label}</div>
          <MultiCheck options={cfg.extraMultiCheck.opts} values={state[cfg.extraMultiCheck.key] || []}
            onChange={(v) => onChange(cfg.extraMultiCheck.key, v)} />
        </div>
      )}
      {cfg.optGroups ? (
        cfg.optGroups.map((g) => (
          <div className="mt-2" key={g.key}>
            <div className="mb-1" style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}>{g.label}</div>
            <MultiCheck options={g.opts} values={state.items} onChange={(v) => onChange("items", v)} />
          </div>
        ))
      ) : (
        <div className="mt-2">
          <MultiCheck options={cfg.opts} values={state.items} onChange={(v) => onChange("items", v)} />
        </div>
      )}
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
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr 110px 90px 32px" }}>
            {["Naam", "Vloer", "Verdieping", "Ingemaakte kast", "Radiator", ""].map((h, i) => (
              <span key={i} className="text-xs" style={{ color: INK_SOFT, fontWeight: 500 }}>{h}</span>
            ))}
          </div>
          {d.slaapkamers.map((s) => (
            <div key={s.id} className="grid gap-2 items-start" style={{ gridTemplateColumns: "1fr 1fr 1fr 110px 90px 32px" }}>
              <TextInput value={s.naam} onChange={(e) => updateSlaapkamer(s.id, "naam", e.target.value)} />
              <TextInput placeholder="Vloer" value={s.vloer} onChange={(e) => updateSlaapkamer(s.id, "vloer", e.target.value)} />
              <TextInput placeholder="Verdieping" value={s.verdieping} onChange={(e) => updateSlaapkamer(s.id, "verdieping", e.target.value)} />
              <div>
                <span className="block text-xs mb-1" style={{ color: INK_SOFT }}>Ingemaakte kast</span>
                <Select options={["Ja", "Nee"]} value={s.ingemaaktKasten}
                  aria-label="Ingemaakte kast" title="Ingemaakte kast"
                  onChange={(e) => updateSlaapkamer(s.id, "ingemaaktKasten", e.target.value)} />
              </div>
              <div>
                <span className="block text-xs mb-1" style={{ color: INK_SOFT }}>Radiator</span>
                <Select options={["Ja", "Nee"]} value={s.radiator || "Nee"}
                  aria-label="Radiator" title="Radiator"
                  onChange={(e) => updateSlaapkamer(s.id, "radiator", e.target.value)} />
              </div>
              <button onClick={() => removeSlaapkamer(s.id)} className="mt-1"><Trash2 size={14} style={{ color: DANGER }} /></button>
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
// ---------- step (conditioneel, i.p.v. "Ruimte-eigenschappen"): bedrijfskenmerken ----------
// Getoond bij vastgoedType "KMO-vastgoed" of "Bedrijfsvastgoed" (zie StepType en de steps-array
// in DossierWizard) i.p.v. de residentiële ruimte-checklists hierboven, die voor een magazijn,
// kantoorgebouw of winkelpand geen zinvolle invulling hebben. De generieke sectie geldt voor
// beide vastgoedtypes; bij "Bedrijfsvastgoed" komt daar, afhankelijk van het gekozen subtype (zie
// StepType), nog een subtype-specifieke sectie bij — op basis van de kenmerkende parameters per
// vastgoedcategorie (Belgische bronnen: aximas.com, kmoschatter.be, lacara.be voor industrieel/
// logistiek, epccertificaat.vlaanderen voor de niet-residentiële EPC-regeling hieronder).
function StepBedrijfskenmerken({ d, set }) {
  const subtype = d.vastgoedType === "Bedrijfsvastgoed" ? d.bedrijfsSubtype : "";
  return (
    <div>
      <Section title="Algemene bedrijfskenmerken" icon={Building2}>
        <Field label="Vervangingswaarde (nieuwbouw, na veroudering)" full
          hint="Manuele inschatting door de schatter-expert — vervangt in de waardering de ABEX-woningindex, die enkel op residentieel vastgoed is gekalibreerd">
          <TextInput type="number" value={d.bedrijfsVervangingswaarde} onChange={set("bedrijfsVervangingswaarde")} />
        </Field>
        <Field label="Bestemmingszone"><Select options={OPTS.bedrijfsBestemmingszone} value={d.bedrijfsBestemmingszone} onChange={set("bedrijfsBestemmingszone")} /></Field>
        <Field label="Omgevingsvergunning milieu"><Select options={OPTS.bedrijfsVergunningMilieu} value={d.bedrijfsVergunningMilieu} onChange={set("bedrijfsVergunningMilieu")} /></Field>
        <Field label="Aantal parkeerplaatsen"><TextInput type="number" value={d.bedrijfsParkeerplaatsen} onChange={set("bedrijfsParkeerplaatsen")} /></Field>
        <Field label="Aantal laadkades"><TextInput type="number" value={d.bedrijfsLaadkades} onChange={set("bedrijfsLaadkades")} /></Field>
        <Field label="EPC-regime" hint="Niet-residentiële EPC-regeling — kies het type dat van toepassing is, of 'in onderzoek' bij twijfel over de precieze verplichting voor dit pand">
          <Select options={OPTS.bedrijfsEpcType} value={d.bedrijfsEpcType} onChange={set("bedrijfsEpcType")} />
        </Field>
        <Field label="EPC-waarde"><TextInput value={d.bedrijfsEpcWaarde} onChange={set("bedrijfsEpcWaarde")} /></Field>
        <Field label="EPC-certificaatnummer" full><TextInput value={d.bedrijfsEpcCertificaatnummer} onChange={set("bedrijfsEpcCertificaatnummer")} /></Field>
        <Field label="Omschrijving indeling & functionaliteit" full hint="Bv. 60% magazijn / 40% kantoor, showroom vooraan, ...">
          <textarea value={d.bedrijfsOmschrijvingIndeling} onChange={set("bedrijfsOmschrijvingIndeling")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </Section>

      <Section title="Interne afwerking" icon={Layers}>
        <Field label="Vloerafwerking"><Select options={OPTS.bedrijfsVloerafwerking} value={d.bedrijfsVloerafwerking} onChange={set("bedrijfsVloerafwerking")} /></Field>
        <Field label="Wandafwerking" hint="Bv. gepleisterd/geschilderd, sandwichpanelen, sichtbeton"><TextInput value={d.bedrijfsWandafwerking} onChange={set("bedrijfsWandafwerking")} /></Field>
        <Field label="Plafondafwerking" hint="Bv. systeemplafond, zichtbare dakconstructie, spanplafond"><TextInput value={d.bedrijfsPlafondafwerking} onChange={set("bedrijfsPlafondafwerking")} /></Field>
      </Section>

      {subtype === "Kantoor" && (
        <Section title="Kantoor — specifieke kenmerken" icon={Building2}>
          <Field label="Indeling"><Select options={OPTS.kantoorIndeling} value={d.kantoorIndeling} onChange={set("kantoorIndeling")} /></Field>
          <Field label="Aantal verdiepingen"><TextInput type="number" value={d.kantoorVerdiepingen} onChange={set("kantoorVerdiepingen")} /></Field>
          <Field label="Lift aanwezig"><Select options={OPTS.jaNee} value={d.kantoorLiftAanwezig} onChange={set("kantoorLiftAanwezig")} /></Field>
          <Field label="Serverruimte/technisch lokaal"><Select options={OPTS.jaNee} value={d.kantoorServerruimte} onChange={set("kantoorServerruimte")} /></Field>
          <Field label="Certificering" full hint="Bv. BREEAM, WELL — indien van toepassing"><TextInput value={d.kantoorCertificering} onChange={set("kantoorCertificering")} /></Field>
        </Section>
      )}

      {subtype === "Winkel" && (
        <Section title="Winkel — specifieke kenmerken" icon={Building2}>
          <Field label="Locatiecategorie" hint="Ligging is doorgaans de belangrijkste waardebepalende factor bij een winkelpand">
            <Select options={OPTS.winkelLocatiecategorie} value={d.winkelLocatiecategorie} onChange={set("winkelLocatiecategorie")} />
          </Field>
          <Field label="Gevelbreedte (m)"><TextInput type="number" value={d.winkelGevelbreedte} onChange={set("winkelGevelbreedte")} /></Field>
          <Field label="Etalage aanwezig"><Select options={OPTS.jaNee} value={d.winkelEtalage} onChange={set("winkelEtalage")} /></Field>
          <Field label="Magazijn/opslag achteraan"><Select options={OPTS.jaNee} value={d.winkelMagazijnAchteraan} onChange={set("winkelMagazijnAchteraan")} /></Field>
          <Field label="Inschatting voetgangersfrequentie" full><TextInput value={d.winkelPasanten} onChange={set("winkelPasanten")} placeholder="bv. druk, gemiddeld, rustig" /></Field>
        </Section>
      )}

      {subtype === "Industrieel/logistiek" && (
        <Section title="Industrieel/logistiek — specifieke kenmerken" icon={Building2}>
          <Field label="Vrije hoogte (m)" hint="Onder dak/kraanbaan"><TextInput type="number" value={d.industrieelVrijeHoogte} onChange={set("industrieelVrijeHoogte")} /></Field>
          <Field label="Vloerbelasting (ton/m²)"><TextInput type="number" value={d.industrieelVloerbelasting} onChange={set("industrieelVloerbelasting")} /></Field>
          <Field label="Aantal dock levellers"><TextInput type="number" value={d.industrieelAantalDockLevellers} onChange={set("industrieelAantalDockLevellers")} /></Field>
          <Field label="Elektrisch vermogen" hint="Bv. in kVA"><TextInput value={d.industrieelElektrischVermogen} onChange={set("industrieelElektrischVermogen")} /></Field>
          <Field label="Deelbaarheid" full hint="Bv. deelbaar vanaf 500 m² voor meerdere huurders"><TextInput value={d.industrieelDeelbaarheid} onChange={set("industrieelDeelbaarheid")} /></Field>
        </Section>
      )}

      {subtype === "Horeca" && (
        <Section title="Horeca — specifieke kenmerken" icon={Building2}>
          <Field label="Type horecazaak"><Select options={OPTS.horecaType} value={d.horecaType} onChange={set("horecaType")} /></Field>
          <Field label="Uitbatingsvergunning aanwezig"><Select options={OPTS.jaNee} value={d.horecaVergunningUitbating} onChange={set("horecaVergunningUitbating")} /></Field>
          <Field label="Terras aanwezig"><Select options={OPTS.jaNee} value={d.horecaTerras} onChange={set("horecaTerras")} /></Field>
          <Field label="Aantal zitplaatsen"><TextInput type="number" value={d.horecaZitplaatsen} onChange={set("horecaZitplaatsen")} /></Field>
          <Field label="Keukenuitrusting" full><TextInput value={d.horecaKeukenuitrusting} onChange={set("horecaKeukenuitrusting")} /></Field>
        </Section>
      )}
    </div>
  );
}

function StepMarkt({ d, set }) {
  return (
    <div>
      <Section title="Markt & algemeen gebruik" icon={LineChart}>
        <Field label="Gebruik">
          <Select options={["Normaal", "Verhuurd", "Leegstaand"]} value={d.gebruik} onChange={set("gebruik")} />
        </Field>
        <Field label={d.vastgoedType === "Residentieel" ? "Bewoonbaarheid" : "Functionele geschiktheid"}
          hint={d.vastgoedType === "Residentieel" ? undefined : "Geschiktheid van het pand voor het beoogde bedrijfsmatige gebruik"}>
          <Select options={OPTS.kwaliteit} value={d.bewoonbaarheid} onChange={set("bewoonbaarheid")} />
        </Field>
        <Field label="Aanbod te koop"><Select options={OPTS.aanbod} value={d.aanbodTeKoop} onChange={set("aanbodTeKoop")} /></Field>
        <Field label="Aanbod te huur"><Select options={OPTS.aanbod} value={d.aanbodTeHuur} onChange={set("aanbodTeHuur")} /></Field>
        <Field label="Verkoopbaarheid"><Select options={OPTS.kwaliteit} value={d.verkoopbaarheid} onChange={set("verkoopbaarheid")} /></Field>
        <Field label="Uitzicht"><Select options={OPTS.kwaliteit} value={d.uitzicht} onChange={set("uitzicht")} /></Field>
        <Field label="Onderhoud"><Select options={OPTS.kwaliteit} value={d.onderhoud} onChange={set("onderhoud")} /></Field>
        <Field label="Inrichting"><Select options={OPTS.kwaliteit} value={d.inrichting} onChange={set("inrichting")} /></Field>
        {/* Klasse/Gevel sturen de ABEX-woningindex in de waarderingsmodule (zie berekenWaardering)
            — enkel zinvol bij Residentieel; bij KMO-/Bedrijfsvastgoed wordt de vervangingswaarde
            manueel ingeschat op het tabblad "Bedrijfskenmerken" (bedrijfsVervangingswaarde) */}
        {d.vastgoedType === "Residentieel" && (
          <>
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
          </>
        )}
      </Section>

      {d.gebruik === "Verhuurd" && (
        <Section title="Huurder" icon={Users}>
          <Field label="Naam"><TextInput value={d.huurderNaam} onChange={set("huurderNaam")} /></Field>
          <Field label="Telefoon"><TextInput value={d.huurderTelefoon} onChange={set("huurderTelefoon")} /></Field>
          <Field label="E-mail"><TextInput type="email" value={d.huurderEmail} onChange={set("huurderEmail")} /></Field>
          <Field label="Huurprijs"><TextInput type="number" value={d.huurderHuurprijs} onChange={set("huurderHuurprijs")} /></Field>
          <Field label="Type huurcontract">
            <Select options={d.vastgoedType === "Residentieel" ? OPTS.huurcontractType : OPTS.huurcontractTypeBedrijfsmatig} value={d.huurderContractType} onChange={set("huurderContractType")} />
          </Field>
          <Field label="Duurtijd"><TextInput value={d.huurderDuurtijd} onChange={set("huurderDuurtijd")} placeholder="bv. 9 jaar, start 01/2023" /></Field>
          {/* uitbreiding voor KMO-vastgoed/Bedrijfsvastgoed — kernbegrippen uit de Handelshuurwet
              (wet van 30 april 1951): minimumduur 9 jaar, driejaarlijkse opzegmogelijkheid voor de
              huurder, hernieuwingsrecht (tot 3x), en de gebruikelijke waarborg-/indexatieclausules.
              Residentieel/Woninghuur blijft ongewijzigd bij de zes velden hierboven. */}
          {d.vastgoedType !== "Residentieel" && (
            <>
              <Field label="Aanvangsdatum huurovereenkomst"><TextInput type="date" value={d.huurderAanvangsdatum} onChange={set("huurderAanvangsdatum")} /></Field>
              <Field label="Eerstvolgende opzegmogelijkheid" hint="Handelshuur: in principe elke 3 jaar, mits 6 maanden opzeg per aangetekend schrijven of deurwaardersexploot">
                <TextInput value={d.huurderEersteOpzegmogelijkheid} onChange={set("huurderEersteOpzegmogelijkheid")} placeholder="bv. 01/2027" />
              </Field>
              <Field label="Hernieuwingsrecht"><Select options={OPTS.huurderHernieuwingsrecht} value={d.huurderHernieuwingsrecht} onChange={set("huurderHernieuwingsrecht")} /></Field>
              <Field label="Indexatie"><TextInput value={d.huurderIndexatie} onChange={set("huurderIndexatie")} placeholder="bv. jaarlijks, gezondheidsindex" /></Field>
              <Field label="Huurwaarborg"><TextInput value={d.huurderWaarborg} onChange={set("huurderWaarborg")} placeholder="bv. 3 maanden huur, bankwaarborg" /></Field>
              <Field label="Bijzonderheden opzegtermijn / -beding" full hint="Afwijkende bedingen t.o.v. de standaard Handelshuurwet-regeling">
                <textarea value={d.huurderOpzegtermijnBijzonderheden} onChange={set("huurderOpzegtermijnBijzonderheden")} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
              </Field>
            </>
          )}
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

function StepDocumenten({ d, set, addDocumenten, removeDocument, updateDocument, addRuimtesBulk }) {
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultaat, setResultaat] = useState(null);
  // voorstellen die wachten op bevestiging (zie bouwAiVoorstellen) + wat het model teruggaf maar
  // de controle niet doorstond
  const [voorstellen, setVoorstellen] = useState([]);
  const [aangevinkt, setAangevinkt] = useState({});
  const [geweigerd, setGeweigerd] = useState([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [errorPlan, setErrorPlan] = useState("");
  const [resultaatPlan, setResultaatPlan] = useState(null);
  const fmtSize = (b) => b ? `${(b / 1024).toFixed(0)} kB` : "";
  // een document is klaar voor AI-uitlezing zodra het ofwel inline als base64 bewaard is, ofwel
  // (voor grotere documenten) permanent naar Storage opgeladen werd (doc.pad — zie
  // uploadDocumentNaarStorage/addDocumenten hierboven); "opladen" sluit een net toegevoegd
  // document uit zolang die upload nog bezig is.
  const pdfDocs = d.documenten.filter((doc) => !doc.opladen && (doc.base64 || doc.pad));
  const bijlageBytes = berekenPandBijlageBytes(d);
  const bijlageMB = bijlageBytes / (1024 * 1024);

  const vulUitDocumenten = async () => {
    setLoading(true);
    setError("");
    setResultaat(null);
    try {
      const prompt = `Je krijgt één of meerdere documenten mee, als PDF en/of als foto (bv. een vastgoedinfo-bundel met uittreksels van Geopunt/Digitaal Vlaanderen, Onroerend Erfgoed, Vlaamse Milieumaatschappij, Statbel, Mobiscore, ...). Haal er de volgende gegevens uit, indien aanwezig. Verzin nooit een waarde — laat een veld leeg als het niet met zekerheid in het document staat.
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
      // niets wordt nog rechtstreeks weggeschreven: de gecontroleerde voorstellen komen eerst ter
      // bevestiging op het scherm (zie bouwAiVoorstellen en het voorstelpaneel hieronder)
      const { voorstellen, geweigerd } = bouwAiVoorstellen(parsed, d);
      setVoorstellen(voorstellen);
      setAangevinkt(Object.fromEntries(voorstellen.map((v) => [v.veld, true])));
      setGeweigerd(geweigerd);
      setResultaat(voorstellen.length ? voorstellen.map((v) => v.veld) : []);
    } catch (e) {
      setError(`Kon de gegevens niet automatisch invullen (${duidAiDocFout(e)}). Vul de velden manueel aan.`);
    } finally {
      setLoading(false);
    }
  };

  // Leest een grondplan/bouwplan (als PDF/foto bij de documenten hierboven toegevoegd) en telt de
  // per ruimte op het plan vermelde oppervlaktes op tot ÉÉN rij per verdieping op het tabblad
  // "Afmetingen & indeling" (via addRuimtesBulk, zie bindPand in DossierWizard) — dat telt
  // automatisch mee in de berekende bewoonbare/nuttige oppervlakte (berekenWaardering). Bewust
  // samengevat per verdieping i.p.v. één rij per afzonderlijke ruimte: die tabel (en de kolom in
  // het rapport) toont toch geen kamernaam, enkel de verdieping, dus een rij per kamer gaf enkel
  // een lange lijst onderling niet te onderscheiden rijen. Bestaande ruimtes blijven altijd staan;
  // dit VOEGT enkel nieuwe rijen toe, het overschrijft niets, zodat een tweede keer uitlezen (bv.
  // na een aangepast plan) geen eerder ingevulde gegevens wist.
  const vulOppervlaktesUitPlannen = async () => {
    setLoadingPlan(true);
    setErrorPlan("");
    setResultaatPlan(null);
    try {
      const prompt = `Je krijgt één of meerdere documenten mee. Zoek ertussen naar een grondplan of bouwplan (architectenplan) van een woning of pand, waarop per ruimte een oppervlakte in m² vermeld staat. Zit er geen plan bij, of staat er geen enkele oppervlakte op, antwoord dan met een lege "ruimtes"-lijst — verzin nooit een waarde die niet letterlijk op het plan staat.

Lees voor élke ruimte die je op het plan terugvindt MET een vermelde oppervlakte:
- verdieping: de bouwlaag, gemapt naar exact één van deze sleutels: "gelijkvloers" (gelijkvloers/benedenverdieping), "1everdiep" (1e verdieping), "2everdiep" (2e verdieping of hoger), "zolder", "garage", "berging", "tuinberging", "terras". Kies de dichtstbijzijnde match; gebruik "gelijkvloers" als de bouwlaag niet duidelijk is.
- naam: de kamernaam exact zoals op het plan (bv. "Living", "Keuken", "Slaapkamer 1", "Badkamer", "Berging")
- opp: de oppervlakte in m² exact zoals op het plan vermeld (enkel het getal, punt als decimaalteken, bv. "14.2")

Vul daarnaast enkel in indien een TOTALE oppervlakte apart en expliciet op een plan vermeld staat (laat anders leeg — dat wordt elders al automatisch berekend uit de ruimtes hierboven):
- grondopp: de totale grondoppervlakte/perceeloppervlakte in m² (bv. van een opmetingsplan/perceelplan)
- bebouwdeOpp: de totale bebouwde oppervlakte in m²

Antwoord UITSLUITEND met geldige JSON, zonder toelichting, in dit exacte formaat:
{"ruimtes":[{"verdieping":"","naam":"","opp":""}],"grondopp":"","bebouwdeOpp":""}`;

      const raw = await callClaudeWithDocs(pdfDocs, prompt, d.id);
      const parsed = extractJson(raw);
      const nieuweRuimtes = (Array.isArray(parsed.ruimtes) ? parsed.ruimtes : [])
        .filter((r) => r && r.opp !== "" && r.opp !== null && r.opp !== undefined && !isNaN(parseFloat(r.opp)));
      // per verdieping optellen (zie toelichting hierboven) i.p.v. per afzonderlijke ruimte toevoegen
      const totaalPerVerdieping = new Map();
      nieuweRuimtes.forEach((r) => {
        totaalPerVerdieping.set(r.verdieping, (totaalPerVerdieping.get(r.verdieping) || 0) + parseFloat(r.opp));
      });
      const verdiepingRijen = [...totaalPerVerdieping.entries()].map(([verdieping, opp]) => {
        const v = VERDIEPINGEN.find((x) => x.key === verdieping);
        return { verdieping, naam: v ? v.label : verdieping, opp: opp.toFixed(1) };
      });
      if (verdiepingRijen.length) addRuimtesBulk(verdiepingRijen);
      ["grondopp", "bebouwdeOpp"].forEach((veld) => {
        const waarde = parsed[veld];
        if (waarde !== "" && waarde !== null && waarde !== undefined) set(veld)(String(waarde));
      });
      setResultaatPlan(verdiepingRijen.length);
    } catch (e) {
      setErrorPlan(`Kon geen oppervlaktes uit een plan halen (${duidAiDocFout(e)}). Vul de oppervlaktes manueel in op tabblad "Afmetingen & indeling".`);
    } finally {
      setLoadingPlan(false);
    }
  };

  return (
    <div>
      <div className="rounded-lg p-4 mb-6" style={{ background: BRASS_SOFT, border: `1px solid ${BRASS}` }}>
        <div className="text-xs font-medium mb-1" style={{ color: BRASS }}>Tip</div>
        <div className="text-xs" style={{ color: INK }}>
          Laad hier eerst je vastgoedinfo-bundel (bv. van Geopunt/CIB Vastgoedinfo) op. De AI-knop hieronder leest de documenten rechtstreeks
          en vult automatisch herkende gegevens in op de bijhorende tabbladen verderop — dat bespaart je het overtypen. Elk automatisch
          ingevuld veld blijft manueel aan te passen of te overschrijven op het betreffende tabblad; controleer dus altijd het resultaat.
          Voeg je hier ook het grondplan/bouwplan toe — als PDF of als foto — dan kan een aparte knop verderop de oppervlaktes per ruimte er rechtstreeks uit overnemen naar tabblad "Afmetingen & indeling".
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
            Vergunningen, bodemattest, stedenbouwkundige uittreksels, eigendomsakte, EPC-attest, verkavelingsvergunning, vastgoedinfo-bundel, grondplan/bouwplan, ...
            Voeg bij elk document kort de kernpunten toe — die tekst wordt gebruikt om de SWOT-analyse te onderbouwen.
          </div>
          {bijlageMB > 3 && (
            <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg"
              style={{
                background: bijlageMB > 12 ? "#FBEAEA" : bijlageMB > 6 ? BRASS_SOFT : PAPER_RAISED,
                color: bijlageMB > 12 ? DANGER : bijlageMB > 6 ? BRASS : INK_SOFT,
              }}>
              {bijlageMB > 6 && <AlertTriangle size={13} />}
              Foto's en documenten in dit pand wegen samen ongeveer {fmtMB(bijlageBytes)} MB.
              {bijlageMB > 6 ? " Hoe meer, hoe trager (en foutgevoeliger) het opslaan — verwijder oudere of onnodige bijlagen indien mogelijk." : ""}
            </div>
          )}
          <div className="flex gap-3">
            <div onClick={() => inputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
              style={{ border: `1.5px dashed ${LINE}`, padding: "28px 16px", background: PAPER_RAISED }}>
              <Upload size={18} style={{ color: BRASS }} />
              <span className="text-sm text-center" style={{ color: INK_SOFT }}>Klik om documenten toe te voegen (PDF, foto, Word, tekst)</span>
              <input ref={inputRef} type="file" multiple className="hidden"
                accept=".pdf,.doc,.docx,.txt,image/*" onChange={(e) => { addDocumenten(e.target.files); e.target.value = ""; }} />
            </div>
            <div onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
              style={{ border: `1.5px dashed ${LINE}`, padding: "28px 16px", background: PAPER_RAISED }}>
              <Camera size={18} style={{ color: BRASS }} />
              <span className="text-sm text-center" style={{ color: INK_SOFT }}>Foto nemen (bv. van een grondplan)</span>
              <input ref={cameraInputRef} type="file" multiple accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { addDocumenten(e.target.files); e.target.value = ""; }} />
            </div>
          </div>

          {pdfDocs.length > 0 && (
            <div className="mt-3">
              <button onClick={vulUitDocumenten} disabled={loading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
                style={{ background: loading ? "#B8B4A8" : STAMP }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {loading ? "Gegevens uitlezen..." : `Gegevens automatisch invullen uit ${pdfDocs.length} document${pdfDocs.length === 1 ? "" : "en"}`}
              </button>
              {error && (
                <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
                  <AlertTriangle size={13} /> {error}
                </div>
              )}
              {resultaat !== null && !error && voorstellen.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: STAMP_SOFT, color: STAMP }}>
                  <Check size={13} />
                  {geweigerd.length
                    ? "Geen bruikbare gegevens gevonden in dit document."
                    : "Geen nieuwe gegevens gevonden — alles wat het document vermeldt, staat al ingevuld."}
                </div>
              )}

              {/* Voorstelscherm: de schatter-expert beslist zelf wat overgenomen wordt. Voordien
                  schreef de AI rechtstreeks in het dossier, zonder te tonen wélke velden, zonder
                  bestaande invoer te sparen en zonder weg terug. */}
              {voorstellen.length > 0 && !error && (
                <div className="mt-3 rounded-lg overflow-hidden" style={{ border: `1px solid ${BRASS}` }}>
                  <div className="px-3 py-2 text-xs" style={{ background: BRASS_SOFT, color: INK, fontWeight: 600 }}>
                    {voorstellen.length} voorstel{voorstellen.length === 1 ? "" : "len"} uit het document — vink aan wat je overneemt
                  </div>
                  <div className="px-3 py-2" style={{ background: PAPER_RAISED }}>
                    {voorstellen.map((v) => (
                      <label key={v.veld} className="flex items-start gap-2 py-1.5 cursor-pointer" style={{ borderBottom: `1px dotted ${LINE}` }}>
                        <input type="checkbox" checked={!!aangevinkt[v.veld]} style={{ marginTop: 3, accentColor: BRASS }}
                          onChange={(e) => setAangevinkt((p) => ({ ...p, [v.veld]: e.target.checked }))} />
                        <span className="text-xs" style={{ color: INK }}>
                          <strong>{v.label}</strong>{" "}
                          {v.oud
                            ? <>— nu <span style={{ color: DANGER, textDecoration: "line-through" }}>{v.oud}</span> wordt <span style={{ color: STAMP, fontWeight: 600 }}>{v.nieuw}</span></>
                            : <>— <span style={{ color: STAMP, fontWeight: 600 }}>{v.nieuw}</span></>}
                          {v.oud && <span style={{ color: DANGER }}> (overschrijft wat er staat)</span>}
                        </span>
                      </label>
                    ))}
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button
                        onClick={() => {
                          voorstellen.filter((v) => aangevinkt[v.veld]).forEach((v) => set(v.veld)(v.nieuw));
                          setResultaat(voorstellen.filter((v) => aangevinkt[v.veld]).map((v) => v.veld));
                          setVoorstellen([]);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: INK }}>
                        Aangevinkte overnemen
                      </button>
                      <button onClick={() => { setVoorstellen([]); setResultaat([]); }}
                        className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
                        Niets overnemen
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {geweigerd.length > 0 && !error && (
                <div className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: INK }}>
                  <strong style={{ color: DANGER }}>Niet overgenomen:</strong>{" "}
                  {geweigerd.map((g) => `${g.veld} (${g.reden})`).join(" · ")}
                </div>
              )}

              {/* apart van "Gegevens automatisch invullen" hierboven: leest specifiek een
                  grondplan/bouwplan (indien als PDF bij de documenten hierboven toegevoegd) en zet
                  elke ruimte met een vermelde oppervlakte om in een rij op tabblad "Afmetingen &
                  indeling" — zie vulOppervlaktesUitPlannen/addRuimtesBulk hierboven. */}
              <button onClick={vulOppervlaktesUitPlannen} disabled={loadingPlan}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white mt-2"
                style={{ background: loadingPlan ? "#B8B4A8" : STAMP }}>
                {loadingPlan ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {loadingPlan ? "Plan uitlezen..." : `Oppervlaktes uit plannen halen (${pdfDocs.length} document${pdfDocs.length === 1 ? "" : "en"})`}
              </button>
              <div className="text-xs mt-1.5" style={{ color: INK_SOFT }}>
                Vindt de AI een grondplan tussen de hierboven toegevoegde documenten (PDF of foto), dan worden de oppervlaktes per verdieping opgeteld en als één rij per verdieping toegevoegd op tabblad "Afmetingen & indeling" — bestaande rijen blijven staan, controleer en vul aan waar nodig.
              </div>
              {errorPlan && (
                <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
                  <AlertTriangle size={13} /> {errorPlan}
                </div>
              )}
              {resultaatPlan !== null && !errorPlan && (
                <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: STAMP_SOFT, color: STAMP }}>
                  <Check size={13} />
                  {resultaatPlan > 0
                    ? `${resultaatPlan} verdiepingtotaal${resultaatPlan === 1 ? "" : "en"} toegevoegd op tabblad "Afmetingen & indeling" — controleer het resultaat.`
                    : "Geen grondplan met oppervlaktes herkend in de toegevoegde documenten."}
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
                    {doc.type?.startsWith("image/") ? <ImageIcon size={14} style={{ color: BRASS }} /> : <FileText size={14} style={{ color: BRASS }} />}
                    <span className="text-sm" style={{ fontWeight: 500 }}>{doc.naam}</span>
                    <span className="text-xs" style={{ color: INK_SOFT }}>{fmtSize(doc.grootte)}</span>
                    {doc.opladen && <span className="text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: PAPER_RAISED, color: INK_SOFT, border: `1px solid ${LINE}` }}><Loader2 size={11} className="animate-spin" /> Bezig met opladen…</span>}
                    {!doc.opladen && (doc.base64 || doc.pad) && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: STAMP_SOFT, color: STAMP }}>Gereed voor AI-uitlezing</span>}
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
  const bijlageBytes = berekenPandBijlageBytes(d);
  const bijlageMB = bijlageBytes / (1024 * 1024);
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
          {bijlageMB > 3 && (
            <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg"
              style={{
                background: bijlageMB > 12 ? "#FBEAEA" : bijlageMB > 6 ? BRASS_SOFT : PAPER_RAISED,
                color: bijlageMB > 12 ? DANGER : bijlageMB > 6 ? BRASS : INK_SOFT,
              }}>
              {bijlageMB > 6 && <AlertTriangle size={13} />}
              Foto's en documenten in dit pand wegen samen ongeveer {fmtMB(bijlageBytes)} MB.
              {bijlageMB > 6 ? " Hoe meer, hoe trager (en foutgevoeliger) het opslaan — verwijder oudere of onnodige bijlagen indien mogelijk." : ""}
            </div>
          )}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
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
                  {/* helpt de gebruiker om, bij een dossier met een te grote totale bijlage-omvang
                      (zie de waarschuwing hierboven), zelf de zwaarste foto's te herkennen om te
                      verwijderen — dus bewust op de echte, huidige base64-omvang gebaseerd, niet op
                      de oorspronkelijke bestandsgrootte vóór verkleining. */}
                  {f.base64 && (
                    <div className="text-center" style={{ fontSize: 10, color: INK_SOFT, padding: "2px 0 4px" }}>
                      ~{Math.round(schatBase64Bytes(f.base64) / 1024)} kB
                    </div>
                  )}
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
    const pdfDocs = d.documenten.filter((doc) => !doc.opladen && (doc.base64 || doc.pad));
    try {
      const summary = buildPropertySummary(d);
      const prompt = `Je bent een Vlaamse vastgoedschatter-expert. Op basis van onderstaande paneelgegevens van een pand${pdfDocs.length ? " en de meegestuurde bijlagen" : ""}, stel je een SWOT-analyse voor in het Nederlands, in de stijl van een professioneel taxatieverslag (zakelijk, feitelijk, geen overdrijvingen). Geef per categorie 3 tot 5 korte, concrete bullets (max. 1 zin per bullet).

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
      setStatus({ type: "fallback", message: `AI-aanvraag mislukt (${duidAiDocFout(e)}) — lokaal voorstel toegevoegd op basis van de ingevulde tabbladen.` });
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
  // "Bewoonbare oppervlakte" is een residentieel begrip — bij KMO-vastgoed/Bedrijfsvastgoed is
  // "nuttige vloeroppervlakte" de courante term (het onderliggende veld bewoonbareOppSchatting
  // blijft ongewijzigd, dit is enkel het label/de weergave).
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  const oppLabel = isResidentieel ? "Bewoonbare oppervlakte" : "Nuttige vloeroppervlakte";
  return (
    <div>
      <Section title="Afmetingen" icon={Ruler}>
        <Field label="Gevelbreedte (m)"><TextInput type="number" value={d.breedteGevel} onChange={set("breedteGevel")} /></Field>
        <Field label="Perceelbreedte (m)"><TextInput type="number" value={d.breedtePerceel} onChange={set("breedtePerceel")} /></Field>
        <Field label="Grondoppervlakte (m²)"><TextInput type="number" value={d.grondopp} onChange={set("grondopp")} /></Field>
        <Field label="Bebouwde oppervlakte (m²)"><TextInput type="number" value={d.bebouwdeOpp} onChange={set("bebouwdeOpp")} /></Field>
        <Field label={`${oppLabel} — schatting (m²)`} hint="Manuele inschatting; wordt vergeleken met de berekende oppervlakte hieronder">
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
          {d.pandType === "Appartement" && (
            <div className="mt-3 max-w-xs">
              <Field label="Aandeel gemeenschappelijke delen (m²)"
                hint="Aandeel van deze kavel in de gemeenschappelijke binnendelen van het gebouw (traphal, gangen, technische lokalen, ...) — telt volledig mee in de te taxeren oppervlakte hierboven.">
                <TextInput type="number" value={d.gemeenschappelijkeDelenOpp} onChange={set("gemeenschappelijkeDelenOpp")} />
              </Field>
            </div>
          )}
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

      {d.pandType === "Appartement" && (
        <Section title="Aandeel in de gemeenschap" icon={Ruler}>
          <Field label="Aandeel in de gemeenschap (in 1000sten)" hint="Quotiteit van deze kavel in de mede-eigendom, zoals vermeld in de statuten/basisakte.">
            <TextInput type="number" value={d.aandeelDuizendsten} onChange={set("aandeelDuizendsten")} placeholder="bv. 137" />
          </Field>
          <Field label="Effectief grondaandeel" hint="Berekend als: Grondoppervlakte (hierboven, = totale grondoppervlakte van de residentie) × aandeel / 1000.">
            <div className="flex items-center gap-2">
              <div style={{ ...inputStyle, background: "rgba(0,0,0,0.02)", color: STAMP, fontWeight: 500 }} className="font-mono">
                {calc.effectiefGrondaandeel.toFixed(2)} m²
              </div>
              {calc.effectiefGrondaandeel > 0 && (
                <button type="button" onClick={() => addSchijf("Aandeel in gemeenschappelijke grond", calc.effectiefGrondaandeel.toFixed(2))}
                  className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ border: `1px solid ${BRASS}`, color: BRASS, background: BRASS_SOFT }}>
                  <Plus size={13} /> Als schijf
                </button>
              )}
            </div>
          </Field>
          {!d.grondopp && (
            <div className="col-span-2 text-xs" style={{ color: INK_SOFT }}>
              Vul hierboven bij "Grondoppervlakte" de totale grondoppervlakte van de residentie/het complex in om het effectief grondaandeel te berekenen.
            </div>
          )}
        </Section>
      )}

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

      <Section title="Residuele grondwaarde (optioneel)" icon={Ruler}>
        <div className="col-span-2">
          <Checkbox label="Residuele methode toepassen — enkel relevant bij een reëel sloop-/herontwikkelingspotentieel"
            checked={d.residueelActief} onChange={set("residueelActief")} />
          <div className="text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.85 }}>
            Optionele extra, staat standaard uit. Vervangt de gewone grondwaarde per schijf hierboven niet — verschijnt er enkel naast in het waarderingsoverzicht, zodat u zelf kiest welke van de twee het best bij dit dossier past.
          </div>
        </div>
        {d.residueelActief && (
          <>
            <Field label="Verwachte eindwaarde na (her)ontwikkeling (€)" hint="Geschatte verkoopwaarde van het pand/project ná realisatie">
              <TextInput type="number" value={d.residueelEindwaarde} onChange={set("residueelEindwaarde")} style={{ color: BRASS }} />
            </Field>
            <Field label="Geraamde bouw-/sloopkost (€)">
              <TextInput type="number" value={d.residueelBouwkost} onChange={set("residueelBouwkost")} style={{ color: BRASS }} />
            </Field>
            <Field label="Bijkomende kosten (%)" hint="Ereloon architect, vergunningen, financiering e.d., als % op de bouwkost">
              <TextInput type="number" step="0.5" value={d.residueelBijkomendeKostenPct} onChange={set("residueelBijkomendeKostenPct")} style={{ color: BRASS }} />
            </Field>
            <Field label="Ontwikkelaarswinst/risico (%)" hint="Als % op de eindwaarde">
              <TextInput type="number" step="0.5" value={d.residueelWinstmargePct} onChange={set("residueelWinstmargePct")} style={{ color: BRASS }} />
            </Field>
            <Field label="Residuele grondwaarde (berekend)" full>
              <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.residueleGrondwaarde)}</div>
            </Field>
            <Field label="Motivering / toelichting" full>
              <textarea value={d.residueelMotivering} onChange={set("residueelMotivering")} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        )}
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

      {/* Deze melding stond er voordien onvoorwaardelijk ("worden niet weergegeven in het verslag"),
          terwijl de vergelijkingspunten bij een nalatenschap net wél volledig worden afgedrukt (zie
          vglPuntenHtml in buildPandSections). De schatter kreeg dus een onjuiste geruststelling over
          wat er in een document staat dat naar Vlabel vertrekt. */}
      <div className="text-xs mb-4 p-3 rounded-lg" style={{ background: BRASS_SOFT, color: BRASS }}>
        {d.reden === "Nalatenschap" && vergelijkend
          ? "Let op: bij een nalatenschap met de vergelijkende methode worden deze VGL-punten volledig in het verslag opgenomen (adres, kadastrale gegevens, transactiegegevens en afweging) — dat is een Vlabel-vereiste. Vul ze dus in met de wetenschap dat ze meegaan naar de opdrachtgever en naar Vlabel."
          : "VGL-punten worden hier intern bijgehouden ter staving van de waardering; in dit dossier verschijnt enkel het aantal in het verslag, niet de gegevens zelf."}
      </div>

      {d.vergelijkingspunten.map((v, idx) => (
        <div key={v.id} className="rounded-lg p-4 mb-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: 14, fontWeight: 500 }}>Vergelijkingspunt {idx + 1}</span>
            <button onClick={() => removeVergelijkingspunt(v.id)}><Trash2 size={14} style={{ color: DANGER }} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <Field label="Bron" hint="Bv. notariële akte, eigen verkoopdossier, Statbel, vastgoedinfo">
              <TextInput value={v.bron || ""} onChange={(e) => updateVergelijkingspunt(v.id, "bron", e.target.value)} />
            </Field>
            <Field label="Ligging">
              <TextInput value={v.ligging} onChange={(e) => updateVergelijkingspunt(v.id, "ligging", e.target.value)} />
            </Field>
            <Field label="Bestemming">
              <TextInput value={v.bestemming} onChange={(e) => updateVergelijkingspunt(v.id, "bestemming", e.target.value)} />
            </Field>
            <Field label="Oriëntatie">
              <Select options={OPTS.orientatie} value={v.oriëntatie} onChange={(e) => updateVergelijkingspunt(v.id, "oriëntatie", e.target.value)} />
            </Field>
            <Field label="Externe afwerking">
              <TextInput value={v.externeAfwerking} onChange={(e) => updateVergelijkingspunt(v.id, "externeAfwerking", e.target.value)} />
            </Field>
            <Field label="Onderhoud">
              <TextInput value={v.onderhoud} onChange={(e) => updateVergelijkingspunt(v.id, "onderhoud", e.target.value)} />
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
// Slider verhuisde naar src/ui/velden.jsx (opsplitsing stap 7).

// Types voor de parkeerplaatsen/garages-lijst (StepWaardering hieronder) — een vaste lijst i.p.v.
// vrije tekst, consistent met de rest van de app, maar met "Andere" als vangnet.
const PARKEER_TYPES = ["Autostaanplaats (buiten)", "Autostaanplaats (ondergronds/binnen)", "Garage (afgesloten box)", "Carport", "Fietsenberging", "Andere"];

function StepWaardering({ d, set, calc, parkeerplaatsenGarages, addParkeerplaats, removeParkeerplaats, updateParkeerplaats, portefeuille }) {
  // de ABEX-woningindex/vetusiteitscalculator hieronder is opgemaakt voor residentieel vastgoed
  // (de KLASSEN-tabel = woning-/appartementstypes) — bij KMO-vastgoed/Bedrijfsvastgoed wordt de
  // vervangingswaarde in de plaats daarvan manueel ingeschat op het tabblad "Bedrijfskenmerken"
  // (zie berekenWaardering), dus tonen we hier enkel een doorverwijzing i.p.v. een niet-relevante
  // rekentool.
  const isResidentieel = d.vastgoedType !== "KMO-vastgoed" && d.vastgoedType !== "Bedrijfsvastgoed";
  return (
    <div>
      {isResidentieel ? (
        <>
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
        </>
      ) : (
        <Section title="Vervangingswaarde (bedrijfsmatig)" icon={Calculator}>
          <div className="col-span-2 text-xs mb-2" style={{ color: INK_SOFT }}>
            De ABEX-woningindex is niet van toepassing op KMO-vastgoed/Bedrijfsvastgoed. Vul de reeds-afgeschreven vervangingswaarde manueel in op het tabblad "Bedrijfskenmerken" — die waarde wordt hieronder in de waardering gebruikt.
          </div>
          <Field label="Vervangingswaarde (ingevuld op 'Bedrijfskenmerken')">
            <div className="font-mono text-sm py-2" style={{ color: d.bedrijfsVervangingswaarde ? STAMP : DANGER, fontWeight: 500 }}>
              {d.bedrijfsVervangingswaarde ? eur(num(d.bedrijfsVervangingswaarde)) : "Nog niet ingevuld"}
            </div>
          </Field>
        </Section>
      )}

      <Section title="Rendementsbenadering (DCF)" icon={Calculator}>
        <Field label="Maandelijkse huurprijs (€)"><TextInput type="number" value={d.huurMaand} onChange={set("huurMaand")} style={{ color: BRASS }} /></Field>
        <Field label="Yield van (%)"><TextInput type="number" step="0.05" value={d.yieldVan} onChange={set("yieldVan")} style={{ color: BRASS }} /></Field>
        <Field label="Yield tot (%)"><TextInput type="number" step="0.05" value={d.yieldTot} onChange={set("yieldTot")} style={{ color: BRASS }} /></Field>
        <Field label="Yield stap (%)"><TextInput type="number" step="0.05" min="0.05" value={d.yieldStap} onChange={set("yieldStap")} style={{ color: BRASS }} /></Field>
        <Field label="Jaarhuur (10 maanden, berekend)"><div className="font-mono text-sm py-2" style={{ color: INK_SOFT }}>{eur(calc.jaarhuur)}</div></Field>
      </Section>

      <Section title="Meerjaren-DCF (optioneel)" icon={Calculator}>
        <div className="col-span-2">
          <Checkbox label="Meerjaren-DCF berekenen — naast (niet in plaats van) de directe kapitalisatie hierboven"
            checked={d.dcfMeerjarenActief} onChange={set("dcfMeerjarenActief")} />
          <div className="text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.85 }}>
            Optionele extra, staat standaard uit. Rekent met een reeks jaarlijkse huurinkomsten (met groei en eventuele leegstand) verdisconteerd tegen een zelf te kiezen discontovoet, plus een eindwaarde na het laatste jaar — rigoureuzer dan de directe kapitalisatie bij een pand met een reëel verhuurluik, maar puur ter informatie/onderbouwing: de venale waarde hieronder wordt hier niet automatisch door aangepast.
          </div>
        </div>
        {d.dcfMeerjarenActief && (
          <>
            <Field label="Aantal jaren"><TextInput type="number" value={d.dcfJaren} onChange={set("dcfJaren")} style={{ color: BRASS }} /></Field>
            <Field label="Jaarlijkse huurgroei (%)"><TextInput type="number" step="0.5" value={d.dcfHuurgroeiPct} onChange={set("dcfHuurgroeiPct")} style={{ color: BRASS }} /></Field>
            <Field label="Leegstand (%)"><TextInput type="number" step="0.5" value={d.dcfLeegstandPct} onChange={set("dcfLeegstandPct")} style={{ color: BRASS }} /></Field>
            <Field label="Discontovoet (%)"><TextInput type="number" step="0.5" value={d.dcfDiscontovoetPct} onChange={set("dcfDiscontovoetPct")} style={{ color: BRASS }} /></Field>
            <Field label="Exit-yield bij eindwaarde (%)" hint="Leeg = gemiddelde van yield van/tot hierboven">
              <TextInput type="number" step="0.05" value={d.dcfExitYieldPct} onChange={set("dcfExitYieldPct")} placeholder={calc.dcfExitYieldPct ? calc.dcfExitYieldPct.toFixed(2) : ""} style={{ color: BRASS }} />
            </Field>
            <Field label="Meerjaren-DCF-waarde (berekend)">
              <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{calc.dcfMeerjarenWaarde ? eur(calc.dcfMeerjarenWaarde) : "n.v.t."}</div>
            </Field>
            <Field label="Motivering / toelichting" full>
              <textarea value={d.dcfMotivering} onChange={set("dcfMotivering")} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Marktwaardebandbreedte" icon={Calculator}>
        <Field label="Ondergrens t.o.v. intrinsieke waarde (%)" hint="Standaard 5% — naar wens aan te passen">
          <TextInput type="number" step="0.5" value={d.marktMargeOnderPct} onChange={set("marktMargeOnderPct")} style={{ color: BRASS }} />
        </Field>
        <Field label="Bovengrens t.o.v. intrinsieke waarde (%)" hint="Standaard 5% — naar wens aan te passen">
          <TextInput type="number" step="0.5" value={d.marktMargeBovenPct} onChange={set("marktMargeBovenPct")} style={{ color: BRASS }} />
        </Field>
      </Section>

      <Section title="Gedwongen verkoop" icon={Calculator}>
        <Field label="Gedwongen-verkoopfactor" hint="Toegepast op de venale waarde, los van de rendementsbenadering (DCF)">
          <TextInput type="number" step="0.01" value={d.gedwongenFactor} onChange={set("gedwongenFactor")} style={{ color: BRASS }} />
        </Field>
      </Section>

      <Section title="Energiecorrectie (optioneel)" icon={Calculator}>
        <div className="col-span-2">
          <Checkbox label="Energiecorrectie toepassen op de waardering"
            checked={d.energiecorrectieActief} onChange={set("energiecorrectieActief")} />
          <div className="text-xs mt-1" style={{ color: INK_SOFT, opacity: 0.85 }}>
            Optionele extra, staat standaard uit. Bepaalt u hier een percentage, dan telt dat mee in de VOORGESTELDE venale waarde bij "Eindconclusie" hieronder — dat veld blijft evenwel altijd manueel overschrijfbaar, dus u houdt zelf het laatste woord.{d.epcStatus === "Aanwezig" && d.epcWaarde ? ` Ter info, louter indicatief: EPC ${d.epcWaarde} kWh/m² → richtwaarde ${pct(epcRichtwaardePct(d.epcWaarde))}.` : ""}
          </div>
        </div>
        {d.energiecorrectieActief && (
          <>
            <Field label="Correctie (%)" hint="Negatief bij een ongunstig energielabel, positief bij een gunstig label — zelf te bepalen">
              <TextInput type="number" step="0.5" value={d.energiecorrectiePct} onChange={set("energiecorrectiePct")} style={{ color: BRASS }} />
            </Field>
            <Field label="Correctiebedrag (berekend)">
              <div className="font-mono text-sm py-2" style={{ color: STAMP, fontWeight: 500 }}>{eur(calc.energiecorrectieBedrag)}</div>
            </Field>
            <Field label="Motivering / toelichting" full>
              <textarea value={d.energiecorrectieMotivering} onChange={set("energiecorrectieMotivering")} rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
            </Field>
          </>
        )}
      </Section>

      <Section title="Eindconclusie" icon={Calculator}>
        <Field label="Venale waarde" full hint={`Standaard voorgesteld gelijk aan de intrinsieke waarde${calc.energiecorrectieBedrag ? " + energiecorrectie" : ""} — manueel te overschrijven`}>
          <TextInput type="number" value={d.venaleWaarde} onChange={set("venaleWaarde")} placeholder={(calc.intrinsiek + calc.energiecorrectieBedrag).toFixed(0)} style={{ color: BRASS, fontWeight: 500 }} />
        </Field>
      </Section>

      {/* Parkeerplaatsen & garages: dossierbreed (niet per pand, zie initialData.parkeerplaatsenGarages)
          — elk item telt afzonderlijk mee bovenop de venale waarde(n) hierboven, zie
          berekenParkeerplaatsenTotaal en het "Totale venale waarde"-veld in het rapport zelf. */}
      {parkeerplaatsenGarages && (
        <Section title="Parkeerplaatsen & garages" icon={Grid3x3}>
          <div className="col-span-2">
            <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
              Apart te verkopen/verhuren parkeerplaatsen, garages of bergingen die bij deze opdracht horen — bv. een garagebox met een eigen kadastraal perceel. Geldt voor het hele dossier (niet per pand hierboven).
            </p>
            {parkeerplaatsenGarages.length > 0 && (
              <div className="rounded-lg overflow-hidden mb-3" style={{ border: `1px solid ${LINE}` }}>
                <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.02)" }}>
                      {["Type", "Aantal", "Waarde/stuk", "Omschrijving (optioneel)", "Subtotaal", ""].map((h) => (
                        <th key={h} className="text-left px-3 py-2" style={{ fontSize: 12, color: INK_SOFT, fontWeight: 500, borderBottom: `1px solid ${LINE}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parkeerplaatsenGarages.map((p) => (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                        <td className="px-2 py-1.5" style={{ width: 220 }}>
                          <select value={p.type} onChange={(e) => updateParkeerplaats(p.id, "type", e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }}>
                            {PARKEER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5" style={{ width: 80 }}>
                          <input type="number" min="1" value={p.aantal} onChange={(e) => updateParkeerplaats(p.id, "aantal", e.target.value)}
                            style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                        </td>
                        <td className="px-2 py-1.5" style={{ width: 130 }}>
                          <input type="number" placeholder="€" value={p.waardePerStuk} onChange={(e) => updateParkeerplaats(p.id, "waardePerStuk", e.target.value)}
                            style={{ ...inputStyle, padding: "5px 8px", fontSize: 13, color: BRASS }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="text" value={p.omschrijving} onChange={(e) => updateParkeerplaats(p.id, "omschrijving", e.target.value)}
                            style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }} />
                        </td>
                        <td className="px-3 py-1.5 font-mono" style={{ fontSize: 13, color: INK_SOFT, whiteSpace: "nowrap" }}>{eur(num(p.aantal) * num(p.waardePerStuk))}</td>
                        <td className="px-2 py-1.5"><button onClick={() => removeParkeerplaats(p.id)}><Trash2 size={14} style={{ color: DANGER }} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button onClick={addParkeerplaats} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ border: `1px solid ${LINE}`, color: INK_SOFT, fontWeight: 500 }}>
              <Plus size={13} /> Parkeerplaats/garage toevoegen
            </button>
            {parkeerplaatsenGarages.length > 0 && (
              <div className="mt-3 flex justify-between items-center px-3 py-2 rounded-lg" style={{ background: "rgba(0,0,0,0.02)" }}>
                <span className="text-xs" style={{ color: INK_SOFT }}>Subtotaal parkeerplaatsen/garages</span>
                <span className="font-mono text-sm" style={{ fontWeight: 500 }}>{eur(berekenParkeerplaatsenTotaal(parkeerplaatsenGarages))}</span>
              </div>
            )}
          </div>
        </Section>
      )}

      <div className="mt-8 rounded-lg p-6" style={{ background: PAPER_RAISED, border: `1px solid ${LINE}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
        <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 500 }}>Waarderingsoverzicht</span>
          {calc.oppCheck
            ? <span className="flex items-center gap-1 text-xs" style={{ color: STAMP }}><Check size={13} /> gegevens volledig</span>
            : <span className="flex items-center gap-1 text-xs" style={{ color: DANGER }} title={(calc.controlePunten || []).join(" · ")}>
                <AlertTriangle size={13} /> {(calc.controlePunten || []).length === 1 ? (calc.controlePunten || [])[0] : `${(calc.controlePunten || []).length} punten onvolledig`}
              </span>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 font-mono text-sm">
          <Row label="Nieuwbouwwaarde gebouw" v={eur(calc.nieuwbouwwaarde)} />
          <Row label="Actuele waarde gebouw" v={eur(calc.actueleWaardeGebouw)} />
          {d.pandType === "Appartement" && calc.effectiefGrondaandeel > 0 && (
            <Row label="Effectief grondaandeel" v={`${calc.effectiefGrondaandeel.toFixed(2)} m²`} />
          )}
          <Row label="Grondwaarde" v={eur(calc.grondwaarde)} />
          <Row label="Intrinsieke waarde" v={eur(calc.intrinsiek)} />
          <Row label={`Marktwaarde -${pct(calc.marktMargeOnderPct)}`} v={eur(calc.marktOnder)} />
          <Row label={`Marktwaarde +${pct(calc.marktMargeBovenPct)}`} v={eur(calc.marktBoven)} />
          <Row label="DCF-waarde" v={calc.dcfWaarde ? eur(calc.dcfWaarde) : "n.v.t."} />
          {d.dcfMeerjarenActief && (
            <Row label="Meerjaren-DCF (optioneel)" v={calc.dcfMeerjarenWaarde ? eur(calc.dcfMeerjarenWaarde) : "n.v.t."} />
          )}
          {d.residueelActief && (
            <Row label="Residuele grondwaarde (optioneel)" v={eur(calc.residueleGrondwaarde)} />
          )}
          {calc.parkeerTotaal > 0 && (
            <Row label="Parkeerplaatsen/garages" v={eur(calc.parkeerTotaal)} />
          )}
          <Row label="Gedwongen verkoopwaarde" v={eur(calc.gedwongenVerkoop)} />
          {d.energiecorrectieActief && calc.energiecorrectiePct !== 0 && (
            <Row label={`Energiecorrectie (${pct(calc.energiecorrectiePct)})`} v={eur(calc.energiecorrectieBedrag)} />
          )}
        </div>
        <div className="mt-4 pt-4 flex items-center justify-between" style={{ borderTop: `1px dashed ${LINE}` }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 14, color: STAMP, fontWeight: 500 }}>Venale waarde</span>
          <span className="font-mono" style={{ fontSize: 22, color: STAMP, fontWeight: 500 }}>{eur(calc.venaleWaarde)}</span>
        </div>
      </div>

      {/* Portefeuille-overzicht: enkel zichtbaar zodra dit dossier meer dan één pand bevat (zie
          extraPanden/StepPanden) — het bovenstaande "Waarderingsoverzicht" blijft altijd tonen wat
          het ACTIEVE pand alleen waard is; dit kader eronder telt alle panden (+ eventuele
          parkeerplaatsen/garages hierboven) samen, exact zoals dat straks ook in het
          samengevoegde rapport verschijnt (zie buildMultiPandReportData). */}
      {portefeuille && (
        <div className="mt-6 rounded-lg p-6" style={{ background: "#F3F0E4", border: `1px solid ${BRASS}` }}>
          <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 500 }}>Portefeuille-overzicht — alle panden</span>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {portefeuille.panden.map((p, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span style={{ color: INK_SOFT }}>{i === 0 ? "Hoofdpand" : `Pand ${i + 1}`} — {p.label}</span>
                <span className="font-mono">{eur(p.calc.venaleWaarde || 0)}</span>
              </div>
            ))}
            {portefeuille.parkeerTotaal > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: INK_SOFT }}>Parkeerplaatsen & garages</span>
                <span className="font-mono">{eur(portefeuille.parkeerTotaal)}</span>
              </div>
            )}
          </div>
          <div className="pt-3 flex items-center justify-between" style={{ borderTop: `1px dashed ${LINE}` }}>
            <span style={{ fontFamily: "Georgia, serif", fontSize: 14, color: STAMP, fontWeight: 500 }}>Totale venale waarde (alle panden)</span>
            <span className="font-mono" style={{ fontSize: 22, color: STAMP, fontWeight: 500 }}>{eur(portefeuille.totaal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
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
