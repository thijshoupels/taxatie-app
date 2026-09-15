// ----------------------------------------------------------------------------
// schermen/Dashboard.jsx — dossieroverzicht (concepten/afgewerkt)
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 11) zonder de logica/opmaak zelf te
// wijzigen.
import React, { useState } from "react";
import { Home, Settings, Building2, RefreshCw, Plus, Trash2, Folder, ChevronDown, ChevronRight } from "lucide-react";
import { HUISSTIJLEN, INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, ACCENT, ACCENT_SOFT, STAMP, STAMP_SOFT, DANGER, SANS } from "../constants.js";
import { TextInput } from "../ui/velden.jsx";

// ---------- dashboard ----------
export function Dashboard({ user, index, onOpen, onNew, onDelete, onLogout, onOpenAccount, onOpenKantoorInstellingen, onRefresh, huisstijl }) {
  const hs = huisstijl || HUISSTIJLEN.houpels;
  const [zoek, setZoek] = useState("");
  const [verversen, setVerversen] = useState(false);
  // welke werknemer-mapjes de beheerder heeft opengeklapt (key = ownerId) — zie "mapjes"
  // hieronder. Standaard dichtgeklapt zodat het overzicht meteen kort en overzichtelijk oogt,
  // ook met veel werknemers/dossiers (zie gebruikersvraag: de lijst werd te lang en
  // onoverzichtelijk). Een actieve zoekopdracht klapt een mapje met een match vanzelf open, zie
  // Mapje hieronder — dit stuk state onthoudt enkel de manuele klikken van de beheerder.
  const [opengeklapt, setOpengeklapt] = useState({});
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

  // beheerder-weergave: dossiers per werknemer gegroepeerd in "mapjes" i.p.v. één lange
  // doorlopende lijst van alle makelaars door elkaar (zie gebruikersvraag hierboven). Gegroepeerd
  // op ownerId (niet op naam) zodat twee werknemers met toevallig dezelfde naam nooit
  // samengevoegd worden; "Onbekende makelaar" vangt het randgeval op waarbij een profiel
  // ondertussen verwijderd is (loadIndex geeft dan een lege makelaarNaam terug). Een gewone
  // makelaar ziet, net als voorheen, gewoon de eigen dossiers zonder mapjes — dat zijn toch al
  // enkel de eigen dossiers, groeperen heeft daar geen nut.
  const mapjes = user.isAdmin
    ? Object.values(
        mine.reduce((acc, x) => {
          const key = x.ownerId || "onbekend";
          if (!acc[key]) acc[key] = { ownerId: x.ownerId, naam: x.makelaarNaam || "Onbekende makelaar", dossiers: [] };
          acc[key].dossiers.push(x);
          return acc;
        }, {})
      ).sort((a, b) => a.naam.localeCompare(b.naam, "nl-BE"))
    : null;

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
          {" "}· laatst bewerkt {fmtDatum(x.laatstBewerkt)}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs px-2.5 py-1 rounded-full" style={{
          background: x.status === "afgewerkt" ? STAMP_SOFT : ACCENT_SOFT,
          color: x.status === "afgewerkt" ? STAMP : ACCENT, fontWeight: 500,
        }}>{x.status === "afgewerkt" ? "Afgewerkt" : "Concept"}</span>
        <button onClick={(e) => {
          e.stopPropagation();
          const naam = x.straat ? `${x.straat} ${x.nummer}${x.bus ? "/" + x.bus : ""}` : "dit naamloze dossier";
          if (window.confirm(`Dossier "${naam}" definitief verwijderen? Dit kan niet ongedaan gemaakt worden.`)) onDelete(x.id);
        }}><Trash2 size={14} style={{ color: DANGER }} /></button>
      </div>
    </div>
  );

  const toggleMapje = (ownerId) => setOpengeklapt((o) => ({ ...o, [ownerId]: !o[ownerId] }));

  // Eén "mapje" = alle dossiers van één werknemer. De makelaarnaam staat al in de mapje-titel,
  // dus Row hierboven hoeft die (anders dan vroeger in de platte beheerder-lijst) niet nog eens
  // per rij te herhalen.
  const Mapje = ({ groep }) => {
    const dossiers = groep.dossiers.filter(matches)
      .sort((a, b) => new Date(b.laatstBewerkt || 0) - new Date(a.laatstBewerkt || 0));
    if (dossiers.length === 0) return null;
    const aantalConcept = dossiers.filter((x) => x.status !== "afgewerkt").length;
    const aantalAfgewerkt = dossiers.length - aantalConcept;
    // tijdens een actieve zoekopdracht altijd open tonen, ook als het mapje zelf nog niet
    // aangeklikt is — anders lijkt een zoekresultaat te "verdwijnen" in een dichtgeklapt mapje.
    const isOpen = zoek.trim() !== "" ? true : !!opengeklapt[groep.ownerId];
    return (
      <div className="mb-2 rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
        <button onClick={() => toggleMapje(groep.ownerId)} className="w-full flex items-center justify-between px-4 py-2.5"
          style={{ background: "rgba(0,0,0,0.02)" }}>
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown size={14} style={{ color: INK_SOFT }} /> : <ChevronRight size={14} style={{ color: INK_SOFT }} />}
            <Folder size={14} style={{ color: ACCENT }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: INK }}>{groep.naam}</span>
          </div>
          <span style={{ fontSize: 12, color: INK_SOFT }}>
            {dossiers.length} dossier{dossiers.length === 1 ? "" : "s"} · {aantalConcept} concept{aantalConcept === 1 ? "" : "en"} · {aantalAfgewerkt} afgewerkt
          </span>
        </button>
        {isOpen && (
          <div className="px-3 pt-2.5 pb-3" style={{ background: PAPER }}>
            {dossiers.map((x) => <Row key={x.id} x={x} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full rounded-xl overflow-hidden" style={{ background: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif", minHeight: "100vh" }}>
      {/* kopbalk mag afbreken op een klein scherm i.p.v. alles op één rij te persen */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 md:px-6 py-3 md:py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="flex items-center gap-2">
          <Home size={16} style={{ color: ACCENT }} />
          <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 500 }}>{user.isAdmin ? "Alle dossiers" : "Mijn dossiers"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {user.isAdmin && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#FBEAEA", color: DANGER, fontWeight: 500 }}>
              Beheerder — ziet dossiers van alle makelaars
            </span>
          )}
          {/* toont welke huisstijl actief is voor de ingelogde gebruiker (bepaald door het EIGEN
              kantoor, zie data/kantoren.js) — vooral handig om meteen visueel te kunnen nagaan of
              een account het juiste kantoor/de juiste huisstijl krijgt, zonder een rapport te
              moeten genereren. De achtergrondkleur wordt uit de kantoorkleur zelf afgeleid (i.p.v.
              een vaste "houpels"-uitzondering hiervoor) — zo werkt de badge voor elk kantoor,
              ook een nieuw kantoor dat pas later via het instellingenscherm wordt toegevoegd. */}
          <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${hs.kleur}22`, color: hs.kleur, fontWeight: 500 }}>
            Huisstijl: {hs.naam}
          </span>
          <span className="text-sm" style={{ color: INK_SOFT }}>{user.naam} · {user.email}</span>
          {/* enkel voor een kantoor-beheerder (eigen kantoor) of de platform-beheerder (elk
              kantoor) — de toegangsregel in supabase/schema.sql dwingt dit sowieso ook af, deze
              knop is enkel om de gewone makelaar niet naar een scherm te sturen waar toch niets
              opgeslagen kan worden. */}
          {(user.isAdmin || user.isPlatformBeheerder) && (
            <button onClick={onOpenKantoorInstellingen} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
              <Building2 size={13} /> Kantoor-instellingen
            </button>
          )}
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
          <button onClick={onNew} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg" style={{ background: INK, color: PAPER, fontWeight: 500 }}>
            <Plus size={14} /> Nieuw dossier
          </button>
        </div>

        {user.isAdmin ? (
          <div>
            <div className="text-xs mb-2" style={{ color: INK_SOFT, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Dossiers per werknemer ({mapjes.reduce((s, g) => s + g.dossiers.filter(matches).length, 0)})
            </div>
            {mapjes.length === 0
              ? <div className="text-sm italic" style={{ color: INK_SOFT }}>Nog geen dossiers.</div>
              : mapjes.every((g) => g.dossiers.filter(matches).length === 0)
                ? <div className="text-sm italic" style={{ color: INK_SOFT }}>Geen dossiers gevonden voor deze zoekopdracht.</div>
                : mapjes.map((g) => <Mapje key={g.ownerId || g.naam} groep={g} />)}
          </div>
        ) : (
          <>
            <div className="mb-8">
              <div className="text-xs mb-2" style={{ color: ACCENT, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>
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
          </>
        )}
      </div>
    </div>
  );
}
