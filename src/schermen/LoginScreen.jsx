// ----------------------------------------------------------------------------
// schermen/LoginScreen.jsx — aanmeldscherm (login/registreren/wachtwoord vergeten)
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 11) zonder de logica/opmaak zelf te
// wijzigen.
import React, { useState } from "react";
import { Home, AlertTriangle, Check, Download } from "lucide-react";
import { INK, INK_SOFT, PAPER, PAPER_RAISED, LINE, ACCENT, STAMP, STAMP_SOFT, DANGER, SANS } from "../constants.js";
import { Field, TextInput } from "../ui/velden.jsx";
import { login, registreer, stuurBevestigingOpnieuw, vraagWachtwoordResetAan } from "../data/auth.js";
import { VoorwaardenModal, PrivacyverklaringModal } from "./InfoModal.jsx";

// ---------- login ----------
export function LoginScreen({ onLogin, onRegister }) {
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
    // twee vlakken: links een grafiet merkpaneel (zie .schil in index.css), rechts het formulier —
    // op een telefoon staan ze onder elkaar en blijft het paneel een smalle kopbalk
    <div className="w-full grid grid-cols-1 grid-rows-[auto_1fr] md:grid-rows-1 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" style={{ minHeight: "100vh", background: PAPER, fontFamily: "var(--font-sans)" }}>
      <div className="schil flex flex-col justify-between gap-10 px-6 py-5 md:p-12" style={{ background: PAPER }}>
        <div className="flex items-center gap-2">
          <Home size={18} style={{ color: ACCENT }} />
          <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>Houpels Valuation & Real Estate</span>
        </div>
        <div className="hidden md:block" style={{ maxWidth: 440 }}>
          <div style={{ fontFamily: SANS, fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: INK, textWrap: "balance" }}>
            Taxatiedossiers opmaken, beheren en als verslag exporteren.
          </div>
          {/* beeldmerk: de prijsvork rond de venale waarde — het hart van elk verslag */}
          <div aria-hidden="true" style={{ marginTop: 36 }}>
            <div style={{ position: "relative", height: 6, borderRadius: 3, background: LINE }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: "22%", right: "26%", borderRadius: 3, background: `linear-gradient(90deg, #8C6A2F, ${ACCENT})` }} />
              <div style={{ position: "absolute", top: -5, left: "49%", width: 2, height: 16, background: INK }} />
            </div>
            <div className="flex justify-between" style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: INK_SOFT, letterSpacing: "0.04em", padding: "0 20% 0 18%" }}>
              <span>minimum</span><span style={{ color: INK }}>venale waarde</span><span>maximum</span>
            </div>
          </div>
        </div>
        <div className="hidden md:block text-xs" style={{ color: INK_SOFT }}>Schattingsverslagen voor residentieel en bedrijfsvastgoed</div>
      </div>

      <div className="flex flex-col items-center justify-start md:justify-center px-4 py-8 md:py-10">
      <div className="rounded-lg p-8" style={{ width: "100%", maxWidth: 380, background: PAPER_RAISED, border: `1px solid ${LINE}`, boxShadow: "var(--shadow-card)" }}>
        <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>
          {mode === "forgot" ? "Wachtwoord vergeten" : mode === "register" ? "Nieuwe makelaar" : "Aanmelden"}
        </div>
        <div className="text-xs mb-6" style={{ color: INK_SOFT }}>Taxatiedossiers</div>

        {(mode === "login" || mode === "register") && (
          <div className="flex mb-5 rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
            <button type="button" onClick={() => { setMode("login"); setError(""); setInfo(""); setToonHerverzenden(false); }}
              className="flex-1 text-xs py-2"
              style={{ background: mode === "login" ? INK : PAPER_RAISED, color: mode === "login" ? PAPER : INK_SOFT, fontWeight: 500 }}>
              Aanmelden
            </button>
            <button type="button" onClick={() => { setMode("register"); setError(""); setInfo(""); setToonHerverzenden(false); }}
              className="flex-1 text-xs py-2"
              style={{ background: mode === "register" ? INK : PAPER_RAISED, color: mode === "register" ? PAPER : INK_SOFT, fontWeight: 500 }}>
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
            <button type="button" onClick={submitLogin} disabled={bezig} className="text-sm py-2 rounded-lg mt-1" style={{ background: INK, color: PAPER, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig..." : "Aanmelden"}
            </button>
            {toonHerverzenden && (
              <button type="button" onClick={opnieuwVersturen} disabled={bezig} className="text-xs text-center" style={{ color: ACCENT, background: "none", fontWeight: 500 }}>
                Bevestigingsmail opnieuw versturen
              </button>
            )}
            <button type="button" onClick={() => { setMode("forgot"); setError(""); setInfo(""); setToonHerverzenden(false); }}
              className="text-xs text-center" style={{ color: ACCENT, background: "none", fontWeight: 500 }}>
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
                style={{ width: 14, height: 14, accentColor: ACCENT, marginTop: 1 }} />
              <span>
                Ik heb de{" "}
                <button type="button" onClick={() => setToonVoorwaarden(true)} className="underline" style={{ color: ACCENT, background: "none" }}>
                  gebruiksvoorwaarden
                </button>{" "}
                en de{" "}
                <button type="button" onClick={() => setToonPrivacy(true)} className="underline" style={{ color: ACCENT, background: "none" }}>
                  privacyverklaring
                </button>{" "}
                gelezen en ga ermee akkoord.
              </span>
            </label>
            <button type="button" onClick={submitRegister} disabled={bezig} className="text-sm py-2 rounded-lg mt-1" style={{ background: INK, color: PAPER, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
              {bezig ? "Bezig..." : "Account aanmaken"}
            </button>
          </div>
        )}
        {mode === "forgot" && (
          <div className="flex flex-col gap-3">
            <div className="text-xs" style={{ color: INK_SOFT }}>Vul je e-mailadres in — we sturen je een link om een nieuw wachtwoord in te stellen.</div>
            <Field label="E-mail"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onEnter(submitForgot)} /></Field>
            <button type="button" onClick={submitForgot} disabled={bezig} className="text-sm py-2 rounded-lg mt-1" style={{ background: INK, color: PAPER, fontWeight: 500, opacity: bezig ? 0.6 : 1 }}>
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
        className="flex items-center gap-1.5 text-xs mt-4" style={{ width: "100%", maxWidth: 380, color: INK_SOFT, textDecoration: "none" }}>
        <Download size={13} /> Handleiding taxatie-app (PDF)
      </a>
      <div className="flex items-center gap-3 mt-2" style={{ width: "100%", maxWidth: 380 }}>
        <button type="button" onClick={() => setToonVoorwaarden(true)}
          className="text-xs underline" style={{ textAlign: "left", color: INK_SOFT, background: "none" }}>
          Gebruiksvoorwaarden
        </button>
        <button type="button" onClick={() => setToonPrivacy(true)}
          className="text-xs underline" style={{ textAlign: "left", color: INK_SOFT, background: "none" }}>
          Privacyverklaring
        </button>
      </div>
      </div>
      {toonVoorwaarden && <VoorwaardenModal onClose={() => setToonVoorwaarden(false)} />}
      {toonPrivacy && <PrivacyverklaringModal onClose={() => setToonPrivacy(false)} />}
    </div>
  );
}
