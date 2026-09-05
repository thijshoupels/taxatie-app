// ----------------------------------------------------------------------------
// schermen/AccountScherm.jsx — "Mijn account": eigen contactgegevens, BIV-/Vlabel-nummer
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 11) zonder de logica/opmaak zelf te
// wijzigen.
import React, { useState } from "react";
import { ChevronLeft, Settings } from "lucide-react";
import { INK, INK_SOFT, PAPER, LINE, BRASS } from "../constants.js";
import { Field, TextInput } from "../ui/velden.jsx";
import { VoorwaardenModal, PrivacyverklaringModal } from "./InfoModal.jsx";

// ---------- mijn account: eigen contactgegevens, BIV-/Vlabel-nummer ----------
// deze gegevens worden bij elk NIEUW dossier automatisch ingevuld bij "Identificatie
// schatter-expert" (zie handleNew() in AppRoot), zodat een makelaar dit niet telkens opnieuw
// moet intypen. Bestaande dossiers wijzigen niet met terugwerkende kracht.
export function AccountScherm({ user, onSave, onBack }) {
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
