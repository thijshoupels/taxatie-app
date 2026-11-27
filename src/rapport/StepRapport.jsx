// ----------------------------------------------------------------------------
// rapport/StepRapport.jsx — tabblad Rapport: controle, voorbeeld en "Download PDF"
// ----------------------------------------------------------------------------
// Het voorbeeld is exact dezelfde HTML als de PDF (buildPrintHtml in rapport/bouwers.js), getoond in
// een afgeschermd kader. Voordien bestond het verslag twee keer: een aparte schermversie hier en de
// PDF-versie in bouwers.js — elke aanpassing moest dubbel, en het voorbeeld toonde bij meerdere
// panden enkel het hoofdpand. Nu is er één verslag: wat je hier ziet, is wat de PDF wordt (enkel de
// paginering en de kopregel per pagina voegt de PDF-server nog toe).
import React, { useState, useEffect, useMemo, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { INK, INK_SOFT, PAPER, LINE, ACCENT, ACCENT_SOFT, DANGER, HUISSTIJLEN } from "../constants.js";
import { kopAdres } from "../domein/locatie.js";
import { supabase, haalSessieToken } from "../data/supabase.js";
import { uploadFotoVoorPdf } from "../data/ai.js";
import { laadRapportLettertypeCss } from "./lettertypes.js";
import { buildPrintHtml } from "./bouwers.js";
// valideerDossier blijft (voorlopig) in App.jsx staan — een bewuste, in ES-modules onschuldige
// circulaire import (valideerDossier is een gehesen function declaration).
import { valideerDossier } from "../App.jsx";

// past de hoogte van het voorbeeldkader aan de inhoud aan (ook nadat de foto's geladen zijn)
function pasHoogteAan(kader) {
  const doc = kader && kader.contentDocument;
  if (!doc || !doc.documentElement) return;
  const zet = () => { kader.style.height = `${doc.documentElement.scrollHeight + 8}px`; };
  zet();
  doc.querySelectorAll("img").forEach((img) => { if (!img.complete) img.addEventListener("load", zet, { once: true }); });
}

export function StepRapport({ d, calc, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const kaderRef = useRef(null);
  // controle vóór aflevering — zie valideerDossier in App.jsx
  const controle = valideerDossier(d, calc);

  // het lettertype van het verslag (zelfde als in de PDF), één keer ophalen
  const [lettertypeCss, setLettertypeCss] = useState("");
  useEffect(() => {
    let actief = true;
    laadRapportLettertypeCss().then((css) => { if (actief) setLettertypeCss(css || ""); }).catch(() => {});
    return () => { actief = false; };
  }, []);
  const voorbeeldHtml = useMemo(() => {
    try {
      return buildPrintHtml(d, calc, hs, { lettertypeCss });
    } catch (e) {
      console.error("Voorbeeld van het verslag mislukt:", e);
      return "";
    }
  }, [d, calc, hs, lettertypeCss]);

  const handlePrintPdf = async () => {
    setError("");
    setExporting(true);
    // volwaardige versie met alle foto's als (blijvend geldige) base64-data — dit is wat de
    // terugval-HTML hieronder gebruikt, want een gedownload HTML-bestand kan de gebruiker later
    // pas openen, wanneer een tijdelijke Storage-link (zie verderop) al lang verlopen kan zijn.
    // lettertype van het verslag mee insluiten (leeg als public/fonts/ het bestand nog niet heeft)
    const lettertypeCss = await laadRapportLettertypeCss();
    const htmlVolledig = buildPrintHtml(d, calc, hs, { lettertypeCss });
    // kopregel op elke pagina: bij meerdere panden alle adressen (zie kopAdres in domein/locatie.js)
    const adres = kopAdres(d);
    // zonder straat: het perceel (een CaPaKey bevat een "/", die mag niet in een bestandsnaam)
    const bestandsnaam = `Taxatieverslag_${(d.straat || (d.capakey ? `Perceel_${d.capakey}` : "verslag")).replace(/\s+/g, "_").replace(/[\/\\]/g, "-")}`;
    // paden van foto's die hieronder eventueel tijdelijk naar Storage worden opgeladen (enkel om
    // de aanvraaglimiet te omzeilen) — worden aan het einde altijd opgeruimd
    let tijdelijkeFotoPaden = [];
    try {
      let htmlVoorServer = htmlVolledig;
      // Vercel laat een serverless-functie-aanvraag van max. 4,5MB toe (niet-configureerbaar,
      // zie ook uploadDocVoorAnalyse hierboven voor hetzelfde probleem bij de AI-analyse) — bij
      // dossiers met veel/grote foto's overschrijdt de HTML (met alle foto's als base64 erin)
      // die grens, wat /api/generate-pdf laat falen met status 413
      // (FUNCTION_PAYLOAD_TOO_LARGE). Ruime marge (3,5MB) t.o.v. de 4,5MB-limiet voor de
      // JSON-overhead (adres/huisstijl-velden) en de rest van de HTML.
      if (htmlVolledig.length > 3.5 * 1024 * 1024) {
        const fotosMetBase64 = (d.fotos || []).filter((f) => f.base64);
        const geuploadeFotos = await Promise.all(
          fotosMetBase64.map(async (f) => ({ id: f.id, ...(await uploadFotoVoorPdf(f, d.id)) }))
        );
        tijdelijkeFotoPaden = geuploadeFotos.map((g) => g.pad);
        const urlPerFotoId = new Map(geuploadeFotos.map((g) => [g.id, g.url]));
        let dVoorServer = {
          ...d,
          fotos: d.fotos.map((f) => (urlPerFotoId.has(f.id) ? { ...f, base64: urlPerFotoId.get(f.id) } : f)),
        };
        if (d.voorpaginaFoto?.base64) {
          const geuploadeVoorpagina = await uploadFotoVoorPdf(d.voorpaginaFoto, d.id);
          tijdelijkeFotoPaden.push(geuploadeVoorpagina.pad);
          dVoorServer = { ...dVoorServer, voorpaginaFoto: { ...d.voorpaginaFoto, base64: geuploadeVoorpagina.url } };
        }
        htmlVoorServer = buildPrintHtml(dVoorServer, calc, hs, { lettertypeCss });
      }

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
      const pdfToken = await haalSessieToken();
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(pdfToken ? { Authorization: `Bearer ${pdfToken}` } : {}) },
        body: JSON.stringify({ html: htmlVoorServer, adres, huisstijl: hs }),
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
      // "0" = de server kon de paginanummers voor de inhoudstafel niet betrouwbaar opmeten (zie
      // tocMetingOk in api/generate-pdf.js) — het document zelf is verder volledig in orde en wordt
      // gewoon gedownload, maar de gebruiker moet dit wél zichtbaar te zien krijgen (audit, punt H3).
      const tocMetingOk = response.headers.get("X-Toc-Meting-Ok") !== "0";
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bestandsnaam}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (!tocMetingOk) {
        setError("Let op: de paginanummering in de inhoudstafel kon niet automatisch berekend worden voor dit document (de rest van het verslag is wel volledig in orde). Open de gedownloade PDF en controleer de paginanummers in de inhoudstafel vóór u ze doorgeeft.");
      }
    } catch (e) {
      // terugval zonder server: HTML-bestand downloaden, zelf te openen en als PDF op te slaan —
      // altijd de volledige (base64) versie, nooit htmlVoorServer: die kan verlopen Storage-links
      // bevatten tegen de tijd dat de gebruiker dit bestand opent.
      try {
        const blob = new Blob([htmlVolledig], { type: "text/html" });
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
      // de tijdelijke foto-kopieën in Storage waren enkel nodig om deze ene aanvraag onder de
      // limiet te krijgen — nooit bedoeld om te blijven bestaan (de "echte" foto's blijven, zoals
      // altijd, als base64 in het dossier zelf bewaard)
      if (tijdelijkeFotoPaden.length) {
        supabase.storage.from("dossier-bijlagen").remove(tijdelijkeFotoPaden).catch(() => {});
      }
    }
  };

  return (
    <div>
      <div className="no-print flex items-center justify-between mb-4">
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600 }}>Rapportvoorbeeld</div>
        <div className="flex gap-2">
          <button onClick={handlePrintPdf} disabled={exporting || controle.blokkerend.length > 0}
            title={controle.blokkerend.length > 0 ? "Vul eerst de ontbrekende verplichte gegevens aan" : ""}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: controle.blokkerend.length > 0 ? INK_SOFT : INK, color: PAPER, opacity: controle.blokkerend.length > 0 ? 0.6 : 1 }}>
            {exporting ? "Bezig..." : "Download PDF"}
          </button>
        </div>
      </div>

      {/* Controle vóór aflevering (zie valideerDossier): ontbrekende velden verdwijnen anders
          geruisloos uit de PDF, waardoor een onvolledig verslag er volkomen normaal uitziet. */}
      {controle.blokkerend.length > 0 && (
        <div className="no-print mb-4 px-4 py-3 rounded-lg" style={{ background: "#FBEAEA", border: `1px solid ${DANGER}` }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: DANGER, fontWeight: 600, fontSize: 13 }}>
            <AlertTriangle size={14} /> Nog niet klaar om af te leveren
          </div>
          <ul className="text-xs" style={{ color: INK, lineHeight: 1.7, paddingLeft: 18, listStyle: "disc" }}>
            {controle.blokkerend.map((punt) => <li key={punt}>{punt}</li>)}
          </ul>
        </div>
      )}
      {controle.aandachtspunten.length > 0 && (
        <div className="no-print mb-4 px-4 py-3 rounded-lg" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}` }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: INK, fontWeight: 600, fontSize: 13 }}>
            <AlertTriangle size={14} /> Aandachtspunten — je kan het verslag wel aanmaken
          </div>
          <ul className="text-xs" style={{ color: INK, lineHeight: 1.7, paddingLeft: 18, listStyle: "disc" }}>
            {controle.aandachtspunten.map((punt) => <li key={punt}>{punt}</li>)}
          </ul>
        </div>
      )}
      {error && (
        <div className="no-print flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* het verslag zelf: exact de HTML van de PDF, zonder scripts (sandbox) */}
      {voorbeeldHtml ? (
        <iframe ref={kaderRef} title="Voorbeeld van het verslag" srcDoc={voorbeeldHtml} sandbox="allow-same-origin"
          onLoad={(e) => pasHoogteAan(e.currentTarget)}
          style={{ width: "100%", height: 1200, border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", display: "block" }} />
      ) : (
        <div className="text-sm px-4 py-3 rounded-lg" style={{ border: `1px solid ${LINE}`, color: DANGER }}>
          Het voorbeeld kon niet opgebouwd worden. "Download PDF" probeert het opnieuw en toont dan de foutmelding.
        </div>
      )}
    </div>
  );
}
