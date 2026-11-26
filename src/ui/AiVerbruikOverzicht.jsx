// ----------------------------------------------------------------------------
// ui/AiVerbruikOverzicht.jsx — AI-verbruik per account (scherm Mijn account, platform-beheerder)
// ----------------------------------------------------------------------------
// De Anthropic Console ziet enkel de ene API-sleutel van de app; dit overzicht toont WIE het
// verbruik veroorzaakt, per week en per functie. Gegevens: tabel ai_verbruik (zie
// supabase/ai-verbruik.sql), weggeschreven door api/claude.js. Bedragen zijn een schatting aan
// catalogusprijs (USD, excl. btw) — de echte factuur blijft die in de Anthropic Console.
import React, { useEffect, useState } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { INK, INK_SOFT, LINE, PAPER, SANS } from "../constants.js";
import { haalAiVerbruik } from "../data/aiVerbruik.js";

const PERIODES = [7, 30, 90];
const FUNCTIE_LABELS = {
  ligging: "Ligging (omgeving opzoeken)",
  documenten: "Documenten uitlezen",
  swot: "SWOT-voorstel",
  conclusie: "Conclusie",
  motivering: "Motivering waardering",
  tekst: "Andere tekst",
  onbekend: "Onbekend",
};

const usd = (n) => `US$ ${(n || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const getal = (n) => (n || 0).toLocaleString("nl-BE");
const pct = (n) => `${Math.round((n || 0) * 100)}%`;
const datumKort = (iso) => (iso ? new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }) : "—");

const th = { textAlign: "left", fontWeight: 500, color: INK_SOFT, padding: "6px 8px", borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap" };
const thR = { ...th, textAlign: "right" };
const td = { padding: "6px 8px", borderBottom: `1px solid ${LINE}` };
const tdR = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

function Tabel({ kop, children }) {
  return (
    <div className="overflow-x-auto mb-6">
      <table className="w-full text-xs" style={{ borderCollapse: "collapse", color: INK }}>
        <thead><tr>{kop}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AiVerbruikOverzicht() {
  const [dagen, setDagen] = useState(30);
  const [data, setData] = useState(null);
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);

  const laad = async (aantal) => {
    setBezig(true);
    setFout("");
    try {
      setData(await haalAiVerbruik(aantal));
    } catch (e) {
      setFout(e.message || "Kon het AI-verbruik niet ophalen.");
    } finally {
      setBezig(false);
    }
  };

  useEffect(() => { laad(dagen); }, [dagen]);

  const t = data?.totaal;
  const perWeekGem = t ? (t.kostenUsd / dagen) * 7 : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} style={{ color: INK_SOFT }} />
          <h3 style={{ fontFamily: SANS, fontSize: 16, color: INK, fontWeight: 500 }}>AI-verbruik per account</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {PERIODES.map((p) => (
            <button key={p} type="button" onClick={() => setDagen(p)} className="text-xs px-2.5 py-1 rounded-lg"
              style={{ border: `1px solid ${LINE}`, color: p === dagen ? PAPER : INK_SOFT, background: p === dagen ? INK : "transparent" }}>
              {p} dagen
            </button>
          ))}
          <button type="button" onClick={() => laad(dagen)} disabled={bezig} title="Vernieuwen" className="text-xs px-2 py-1 rounded-lg"
            style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            {bezig ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          </button>
        </div>
      </div>
      <div className="text-xs mb-5" style={{ color: INK_SOFT }}>
        Geschatte kosten aan catalogusprijs, in USD en zonder btw. De factuur zelf staat in de Anthropic Console.
      </div>

      {fout && (
        <div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: "#fee2e2", color: "#991b1b" }}>{fout}</div>
      )}

      {t && !fout && (
        t.aanroepen === 0 ? (
          <div className="text-xs mb-6" style={{ color: INK_SOFT }}>Nog geen AI-aanroepen gelogd in deze periode.</div>
        ) : (
          <>
            <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              {[
                ["Totaal", usd(t.kostenUsd)],
                ["Gemiddeld per week", usd(perWeekGem)],
                ["AI-aanroepen", getal(t.aanroepen)],
                ["Webzoekopdrachten", getal(t.webzoekopdrachten)],
              ].map(([label, waarde]) => (
                <div key={label} className="rounded-lg px-3 py-2.5" style={{ border: `1px solid ${LINE}` }}>
                  <div className="text-xs" style={{ color: INK_SOFT }}>{label}</div>
                  <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 500, color: INK, fontVariantNumeric: "tabular-nums" }}>{waarde}</div>
                </div>
              ))}
            </div>

            <div className="text-xs mb-1" style={{ color: INK, fontWeight: 500 }}>Per account</div>
            <Tabel kop={<><th style={th}>Account</th><th style={thR}>Aanroepen</th><th style={thR}>Zoekopdr.</th><th style={thR}>Tokens in</th><th style={thR}>Kosten</th><th style={thR}>Aandeel</th><th style={thR}>Laatst</th></>}>
              {data.perAccount.map((a) => (
                <tr key={a.gebruikerId || a.email}>
                  <td style={td}>{a.email}</td>
                  <td style={tdR}>{getal(a.aanroepen)}</td>
                  <td style={tdR}>{getal(a.webzoekopdrachten)}</td>
                  <td style={tdR}>{getal(a.invoerTokens)}</td>
                  <td style={tdR}>{usd(a.kostenUsd)}</td>
                  <td style={tdR}>{pct(a.aandeel)}</td>
                  <td style={tdR}>{datumKort(a.laatste)}</td>
                </tr>
              ))}
            </Tabel>

            <div className="text-xs mb-1" style={{ color: INK, fontWeight: 500 }}>Per week</div>
            <Tabel kop={<><th style={th}>Week van</th><th style={thR}>Aanroepen</th><th style={thR}>Zoekopdr.</th><th style={thR}>Kosten</th></>}>
              {data.perWeek.map((w) => (
                <tr key={w.week}>
                  <td style={td}>{datumKort(w.week + "T12:00:00")}</td>
                  <td style={tdR}>{getal(w.aanroepen)}</td>
                  <td style={tdR}>{getal(w.webzoekopdrachten)}</td>
                  <td style={tdR}>{usd(w.kostenUsd)}</td>
                </tr>
              ))}
            </Tabel>

            <div className="text-xs mb-1" style={{ color: INK, fontWeight: 500 }}>Per functie</div>
            <Tabel kop={<><th style={th}>Functie</th><th style={thR}>Aanroepen</th><th style={thR}>Kosten</th><th style={thR}>Aandeel</th></>}>
              {data.perFunctie.map((f) => (
                <tr key={f.functie}>
                  <td style={td}>{FUNCTIE_LABELS[f.functie] || f.functie}</td>
                  <td style={tdR}>{getal(f.aanroepen)}</td>
                  <td style={tdR}>{usd(f.kostenUsd)}</td>
                  <td style={tdR}>{pct(f.aandeel)}</td>
                </tr>
              ))}
            </Tabel>
          </>
        )
      )}
    </div>
  );
}
