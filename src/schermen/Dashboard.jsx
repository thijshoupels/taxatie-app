// ----------------------------------------------------------------------------
// schermen/Dashboard.jsx — dossieroverzicht (concepten/afgewerkt)
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 11) zonder de logica/opmaak zelf te
// wijzigen.
import React, { useState } from "react";
import { Home, Settings, RefreshCw, Plus, Trash2 } from "lucide-react";
import { HUISSTIJLEN, INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, BRASS, BRASS_SOFT, STAMP, STAMP_SOFT, DANGER } from "../constants.js";
import { TextInput } from "../ui/velden.jsx";

// ---------- dashboard ----------
export function Dashboard({ user, index, onOpen, onNew, onDelete, onLogout, onOpenAccount, onRefresh, huisstijl }) {
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
