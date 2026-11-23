// ----------------------------------------------------------------------------
// ui/AccountWissel.jsx — snel wisselen tussen accounts op dit toestel
// ----------------------------------------------------------------------------
// In de kopbalk van het dossieroverzicht: de naam en het e-mailadres van wie aangemeld is. Een klik
// opent een lijstje met de andere accounts die op dit toestel aangemeld werden (één klik om te
// wisselen) en "Ander account toevoegen" (e-mail + wachtwoord, zonder het huidige af te melden).
// De logica staat in data/accounts.js en App.jsx; hier enkel het scherm.
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, X, Loader2, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { INK, INK_SOFT, LINE, ACCENT, ACCENT_CONTRAST, PAPER_RAISED, DANGER } from "../constants.js";
import { inputStyle } from "./velden.jsx";

export function AccountWissel({ user, accounts = [], onWissel, onToevoegen, onVergeet }) {
  const [open, setOpen] = useState(false);
  const [toevoegen, setToevoegen] = useState(false);
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(null); // account-id of "toevoegen"
  const [fout, setFout] = useState("");
  const kader = useRef(null);

  // sluiten bij een klik ernaast of Escape
  useEffect(() => {
    if (!open) return undefined;
    const klik = (e) => { if (kader.current && !kader.current.contains(e.target) && !bezig) setOpen(false); };
    const toets = (e) => { if (e.key === "Escape" && !bezig) setOpen(false); };
    document.addEventListener("mousedown", klik);
    document.addEventListener("keydown", toets);
    return () => { document.removeEventListener("mousedown", klik); document.removeEventListener("keydown", toets); };
  }, [open, bezig]);

  const sluit = () => { setOpen(false); setToevoegen(false); setFout(""); setWachtwoord(""); };
  const voerUit = async (sleutel, actie) => {
    setBezig(sleutel); setFout("");
    try {
      await actie();
      sluit();
      setEmail("");
    } catch (e) {
      setFout(e.message || "Wisselen van account mislukt — probeer opnieuw.");
    } finally {
      setBezig(null);
    }
  };
  const verstuur = () => {
    if (!email.trim() || !wachtwoord) { setFout("Vul e-mail en wachtwoord in."); return; }
    voerUit("toevoegen", () => onToevoegen(email.trim(), wachtwoord));
  };

  return (
    <div ref={kader} className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); setFout(""); }} aria-expanded={open} aria-haspopup="true"
        title="Wissel van account" className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg" style={{ color: INK_SOFT }}>
        <span>{user.naam} · {user.email}</span>
        {accounts.length > 0 && (
          <span className="text-xs px-1.5 rounded-full" style={{ border: `1px solid ${LINE}`, fontVariantNumeric: "tabular-nums" }}
            aria-label={`${accounts.length} ander${accounts.length === 1 ? "" : "e"} account${accounts.length === 1 ? "" : "s"}`}>
            +{accounts.length}
          </span>
        )}
        <ChevronDown size={13} />
      </button>

      {open && (
        // op een telefoon over de volle breedte (met 16px marge), vanaf een tablet onder de knop
        <div role="menu" className="fixed inset-x-4 md:absolute md:inset-x-auto md:right-0 mt-1 z-30 rounded-lg p-2 md:w-[320px]"
          style={{ background: PAPER_RAISED, border: `1px solid ${LINE}`, boxShadow: "var(--shadow-card, 0 8px 24px rgba(0,0,0,.12))" }}>
          <div className="px-2 pt-1 pb-2 text-xs" style={{ color: INK_SOFT }}>
            Aangemeld als <strong style={{ color: INK, fontWeight: 600 }}>{user.email}</strong>
            {user.huisstijl && user.huisstijl.naam ? <> · {user.huisstijl.naam}</> : null}
          </div>

          {accounts.length > 0 && (
            <div className="grid gap-0.5 pb-1" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 6 }}>
              <div className="px-2 text-xs" style={{ color: INK_SOFT, fontWeight: 500 }}>Wissel naar</div>
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center gap-1">
                  <button type="button" role="menuitem" disabled={!!bezig} onClick={() => voerUit(a.id, () => onWissel(a.id))}
                    className="flex-1 flex items-center gap-2 text-left px-2 py-1.5 rounded-md" style={{ minWidth: 0 }}>
                    {bezig === a.id ? <Loader2 size={14} className="animate-spin" style={{ color: ACCENT, flexShrink: 0 }} /> : <ArrowLeftRight size={14} style={{ color: ACCENT, flexShrink: 0 }} />}
                    <span style={{ minWidth: 0 }}>
                      <span className="block text-sm" style={{ color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</span>
                      {(a.naam || a.kantoorNaam) && (
                        <span className="block text-xs" style={{ color: INK_SOFT }}>{[a.naam, a.kantoorNaam].filter(Boolean).join(" · ")}</span>
                      )}
                    </span>
                  </button>
                  <button type="button" disabled={!!bezig} onClick={() => onVergeet(a.id)} title={`${a.email} vergeten op dit toestel`}
                    aria-label={`${a.email} vergeten op dit toestel`} className="p-1 rounded" style={{ color: INK_SOFT }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 6 }}>
            {!toevoegen ? (
              <button type="button" role="menuitem" onClick={() => { setToevoegen(true); setFout(""); }}
                className="w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded-md" style={{ color: ACCENT, fontWeight: 500 }}>
                <Plus size={14} /> Ander account toevoegen
              </button>
            ) : (
              <form className="grid gap-2 px-1 pt-1" onSubmit={(e) => { e.preventDefault(); verstuur(); }}>
                <div className="text-xs" style={{ color: INK_SOFT }}>
                  Meld een tweede account aan zonder het huidige af te melden — daarna wissel je met één klik.
                </div>
                <input type="email" autoComplete="username" placeholder="E-mailadres" value={email} onChange={(e) => setEmail(e.target.value)}
                  aria-label="E-mailadres" style={{ ...inputStyle, fontSize: 13 }} autoFocus />
                <input type="password" autoComplete="current-password" placeholder="Wachtwoord" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)}
                  aria-label="Wachtwoord" style={{ ...inputStyle, fontSize: 13 }} />
                <div className="flex gap-2">
                  <button type="submit" disabled={!!bezig} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: ACCENT, color: ACCENT_CONTRAST, fontWeight: 500 }}>
                    {bezig === "toevoegen" && <Loader2 size={13} className="animate-spin" />} Aanmelden en wisselen
                  </button>
                  <button type="button" disabled={!!bezig} onClick={() => { setToevoegen(false); setFout(""); }}
                    className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
                    Annuleren
                  </button>
                </div>
              </form>
            )}
          </div>

          {fout && (
            <div role="alert" className="flex items-start gap-1.5 text-xs mt-2 px-2 py-2 rounded-md" style={{ background: "#FBEAEA", color: DANGER }}>
              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{fout}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
