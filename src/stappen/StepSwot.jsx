// ----------------------------------------------------------------------------
// stappen/StepSwot.jsx — wizardtabblad "SWOT-analyse"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React, { useState } from "react";
import { ClipboardList, Sparkles, Loader2, Check, AlertTriangle } from "lucide-react";
import { INK, INK_SOFT, LINE, ACCENT, STAMP, STAMP_SOFT, DANGER, SANS, PAPER_RAISED } from "../constants.js";
import { Field, Section, inputStyle } from "../ui/velden.jsx";
import { buildPropertySummary, genereerAutomatischeSwot, extractJson, duidAiDocFout, callClaudeWithDocs } from "../data/ai.js";
import { genereerAiConclusie } from "../data/aiConclusie.js";

// ---------- SWOT ----------
// aiConclusie: toont de knop "AI-voorstel voor de conclusie" — enkel voor de platform-beheerder
// (zie magAiConclusie in data/aiConclusie.js); calc = de berekening van dit pand
export function StepSwot({ d, set, setD, calc, aiConclusie = false }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: "ai" | "fallback", message }
  // AI-voorstel voor de conclusie: eerst tonen, de schatter-expert kiest zelf of hij het overneemt
  const [conclusieBezig, setConclusieBezig] = useState(false);
  const [conclusieVoorstel, setConclusieVoorstel] = useState("");
  const [conclusieFout, setConclusieFout] = useState("");
  const vraagConclusie = async () => {
    setConclusieBezig(true); setConclusieFout(""); setConclusieVoorstel("");
    try {
      setConclusieVoorstel(await genereerAiConclusie(d, calc));
    } catch (e) {
      setConclusieFout(`AI-voorstel mislukt (${duidAiDocFout(e)}). Probeer het later opnieuw.`);
    } finally {
      setConclusieBezig(false);
    }
  };
  const neemConclusieOver = (wijze) => {
    const voorstel = conclusieVoorstel;
    setD((prev) => ({
      ...prev,
      conclusie: wijze === "toevoegen" && String(prev.conclusie || "").trim() ? `${prev.conclusie.trim()}\n\n${voorstel}` : voorstel,
    }));
    setConclusieVoorstel("");
  };

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
    // AI-creditverbruik: een document waarvan de kernpunten al bij "Notities" (tabblad
    // Documenten) ingevuld zijn, zit al als tekst in buildPropertySummary hieronder — het nog eens
    // als bijlage meesturen is dan grotendeels overlap. Enkel documenten ZONDER eigen notities
    // gaan hier nog als bijlage mee, zodat de AI die inhoud toch kan meenemen.
    const pdfDocs = d.documenten.filter((doc) => !doc.opladen && (doc.base64 || doc.pad) && !doc.notities?.trim());
    try {
      const summary = buildPropertySummary(d);
      const prompt = `Je bent een Vlaamse vastgoedschatter-expert. Op basis van onderstaande paneelgegevens van een pand${pdfDocs.length ? " en de meegestuurde bijlagen" : ""}, stel je een SWOT-analyse voor in het Nederlands, in de stijl van een professioneel taxatieverslag (zakelijk, feitelijk, geen overdrijvingen). Geef per categorie precies 3 korte, concrete bullets (max. 1 zin per bullet).

Regels:
- Elke bullet steunt op een gegeven uit de paneelgegevens of bijlagen en zegt wat het betekent voor de waarde of de verkoopbaarheid van DIT pand (bv. "Plat dak en gasverwarming: investering nodig op middellange termijn").
- Geen algemene marktpraat of jargon zonder verband met het pand (geen "recreatieve markt", "consultancy", "kostenmutatie-risico's", "dynamische vastgoedmarkt").
- Spreek de gegevens niet tegen: is iets onbekend, noem het dan onbekend en niet "ontbrekend"; noem hetzelfde gegeven niet tegelijk als kans en als bedreiging.
- Gebruik dezelfde woorden als de paneelgegevens voor afwerking en staat (geen "high-end" als er "modern" staat).

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
          <ClipboardList size={15} style={{ color: ACCENT }} />
          <h3 style={{ fontFamily: SANS, fontSize: 16, color: INK, fontWeight: 500 }}>SWOT-analyse</h3>
        </div>
        <button onClick={genereerVoorstel} disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
          style={{ background: loading ? "var(--ink-faint)" : STAMP }}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {loading ? "Bezig met genereren..." : "AI-voorstel genereren"}
        </button>
      </div>
      <div className="text-xs mb-4" style={{ color: INK_SOFT }}>
        Gebaseerd op alle ingevulde tabbladen. Documenten bij "Documenten" waarvan je nog geen notities invulde, worden bovendien
        rechtstreeks als bijlage meegestuurd — vulde je de notities al in, dan telt die tekst al mee via de tabbladen en wordt het
        document niet nogmaals meegestuurd. Lukt de AI-aanvraag niet, dan valt de app automatisch terug op een lokaal berekend voorstel.
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
        {box("Kansen", "kansen", ACCENT)}
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
        {aiConclusie && (
          <div className="md:col-span-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" onClick={vraagConclusie} disabled={conclusieBezig}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white"
                style={{ background: conclusieBezig ? "var(--ink-faint)" : STAMP }}>
                {conclusieBezig ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {conclusieBezig ? "Bezig met schrijven..." : "AI-voorstel voor de conclusie"}
              </button>
              <span className="text-xs" style={{ color: INK_SOFT }}>
                Enkel zichtbaar voor jou. Op basis van de tabbladen, de SWOT en de waardering — zonder namen, straat of vergelijkingspunten.
              </span>
            </div>
            {conclusieFout && (
              <div role="alert" className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
                <AlertTriangle size={13} /> {conclusieFout}
              </div>
            )}
            {conclusieVoorstel && (
              <div className="mt-2 rounded-lg px-3 py-3" style={{ border: `1px solid ${LINE}`, background: PAPER_RAISED }}>
                <div className="text-xs mb-1.5" style={{ color: STAMP, fontWeight: 600 }}>Voorstel — lees na en pas aan waar nodig</div>
                <p className="text-sm" style={{ color: INK, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{conclusieVoorstel}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button type="button" onClick={() => neemConclusieOver("vervangen")}
                    className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: STAMP, fontWeight: 500 }}>
                    {String(d.conclusie || "").trim() ? "Vervang de huidige conclusie" : "Overnemen"}
                  </button>
                  {String(d.conclusie || "").trim() && (
                    <button type="button" onClick={() => neemConclusieOver("toevoegen")}
                      className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${STAMP}`, color: STAMP, fontWeight: 500 }}>
                      Onderaan toevoegen
                    </button>
                  )}
                  <button type="button" onClick={() => setConclusieVoorstel("")}
                    className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
                    Verwerpen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <Field label="Notities (intern)" full>
          <textarea value={d.notities} onChange={set("notities")} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </Section>
    </div>
  );
}
