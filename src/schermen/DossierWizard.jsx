// ----------------------------------------------------------------------------
// schermen/DossierWizard.jsx — de volledige taxatiewizard (alle tabbladen + opslaglogica)
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 12 — de laatste stap van deze
// opsplitsing) zonder de logica/opmaak zelf te wijzigen.
import React, { useState, useRef, useEffect } from "react";
import {
  Home, MapPin, Building2, Layers, Flame, Sofa, LineChart, ClipboardList,
  Grid3x3, Ruler, Calculator, Image as ImageIcon, FileText, Paperclip, Users,
  ChevronLeft, ChevronRight, AlertTriangle, Trash2, Plus,
} from "lucide-react";
import {
  INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, BRASS, BRASS_SOFT, STAMP, STAMP_SOFT,
  VERDIEPINGEN, maakLeegPand,
} from "../constants.js";
import { uid } from "../lib/format.js";
import { isJpegFile, resizeImageBlob, resizeImageBlobBinnenBudget } from "../lib/afbeeldingen.js";
import { berekenParkeerplaatsenTotaal, berekenWaardering, useCalc } from "../domein/waardering.js";
import { supabase } from "../data/supabase.js";
import { uploadDocumentNaarStorage } from "../data/ai.js";
import { Field, TextInput } from "../ui/velden.jsx";
import { StepRapport } from "../rapport/StepRapport.jsx";
import { StepOpdracht } from "../stappen/StepOpdracht.jsx";
import { StepLigging } from "../stappen/StepLigging.jsx";
import { StepType } from "../stappen/StepType.jsx";
import { StepConstructie } from "../stappen/StepConstructie.jsx";
import { StepInstallaties } from "../stappen/StepInstallaties.jsx";
import { StepRuimteEigenschappen } from "../stappen/StepRuimteEigenschappen.jsx";
import { StepBedrijfskenmerken } from "../stappen/StepBedrijfskenmerken.jsx";
import { StepMarkt } from "../stappen/StepMarkt.jsx";
import { StepDocumenten } from "../stappen/StepDocumenten.jsx";
import { StepFotos } from "../stappen/StepFotos.jsx";
import { StepSwot } from "../stappen/StepSwot.jsx";
import { StepAfmetingen } from "../stappen/StepAfmetingen.jsx";
import { StepVergelijkingspunten } from "../stappen/StepVergelijkingspunten.jsx";
import { StepWaardering } from "../stappen/StepWaardering.jsx";

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

export function DossierWizard({ initialDossier, onBack, onSave, huisstijl }) {
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
