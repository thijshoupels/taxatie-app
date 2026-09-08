// ----------------------------------------------------------------------------
// schermen/KantoorInstellingen.jsx — huisstijl en contactgegevens van het EIGEN kantoor
// ----------------------------------------------------------------------------
// Fase 2 van de SaaS-uitbreiding: vervangt de vroeger hardcoded HUISSTIJLEN-lijst in constants.js
// door een instellingenscherm per kantoor. Enkel bereikbaar voor een kantoor-beheerder (rol
// "beheerder") of de platform-beheerder — zie de knop in Dashboard.jsx — en de toegangsregel in
// supabase/schema.sql staat updates hoe dan ook enkel toe aan het EIGEN kantoor van die persoon
// (of, voor de platform-beheerder, elk kantoor). "actief" (kantoor blokkeren/deblokkeren) staat
// bewust niet in dit scherm: dat blijft, net als vandaag, iets voor Supabase Dashboard > Table
// Editor (zie de toelichting bij "is_platform_beheerder" in schema.sql).
import React, { useState, useEffect } from "react";
import { ChevronLeft, Building2 } from "lucide-react";
import { INK, INK_SOFT, PAPER, LINE, BRASS } from "../constants.js";
import { Field, TextInput } from "../ui/velden.jsx";
import { haalKantoor, updateKantoor, uploadKantoorLogo } from "../data/kantoren.js";

const TOEGESTANE_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
// gelijk aan de serverzijdige grens op de "kantoor-logos"-bucket (zie schema.sql) — client-side
// controleren voorkomt enkel een onnodige mislukte upload, de échte grens ligt op de server.
const MAX_LOGO_BYTES = 3 * 1024 * 1024;

export function KantoorInstellingen({ user, onBack, onSaved }) {
  const [laden, setLaden] = useState(true);
  const [naam, setNaam] = useState("");
  const [kleur, setKleur] = useState("#8C6A2F");
  const [logo, setLogo] = useState(null);
  const [adres, setAdres] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null); // { type: "ok" | "fout", message }
  const [bezig, setBezig] = useState(false);
  const [logoBezig, setLogoBezig] = useState(false);

  useEffect(() => {
    let actief = true;
    (async () => {
      try {
        const k = await haalKantoor(user.kantoorId);
        if (!actief) return;
        setNaam(k.naam || "");
        setKleur(k.kleur || "#8C6A2F");
        setLogo(k.logo || null);
        setAdres(k.adres || "");
        setTelefoon(k.telefoon || "");
        setEmail(k.email || "");
      } catch (e) {
        if (actief) setStatus({ type: "fout", message: e.message || "Kon de kantoorgegevens niet laden." });
      } finally {
        if (actief) setLaden(false);
      }
    })();
    return () => { actief = false; };
  }, [user.kantoorId]);

  const kiesLogo = async (bestand) => {
    if (!bestand) return;
    if (!TOEGESTANE_LOGO_TYPES.includes(bestand.type)) {
      setStatus({ type: "fout", message: "Enkel PNG, JPEG, WEBP of GIF toegelaten voor het logo." });
      return;
    }
    if (bestand.size > MAX_LOGO_BYTES) {
      setStatus({ type: "fout", message: "Het logo mag maximaal 3MB groot zijn." });
      return;
    }
    setLogoBezig(true);
    setStatus(null);
    try {
      const url = await uploadKantoorLogo(user.kantoorId, bestand);
      setLogo(url);
    } catch (e) {
      setStatus({ type: "fout", message: e.message || "Opladen van het logo is mislukt." });
    } finally {
      setLogoBezig(false);
    }
  };

  const submit = async () => {
    setBezig(true);
    setStatus(null);
    try {
      const gegevens = {
        naam: naam.trim(), kleur, logo, adres: adres.trim(), telefoon: telefoon.trim(), email: email.trim(),
      };
      await updateKantoor(user.kantoorId, gegevens);
      setStatus({ type: "ok", message: "Opgeslagen. De nieuwe huisstijl is meteen actief voor het hele kantoor." });
      // laat AppRoot de lopende sessie meteen bijwerken, zodat het dashboard/een volgend rapport
      // niet pas na het opnieuw aanmelden de nieuwe huisstijl toont (zelfde patroon als
      // handleSaveAccount in App.jsx)
      onSaved?.({ naam: gegevens.naam, kleur: gegevens.kleur, logo: gegevens.logo });
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
        <Building2 size={16} style={{ color: BRASS }} />
        <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 500 }}>Kantoor-instellingen</div>
      </div>

      <div className="p-6" style={{ maxWidth: 480 }}>
        <div className="text-xs mb-6" style={{ color: INK_SOFT }}>
          Deze huisstijl (naam, kleur, logo) en contactgegevens verschijnen voortaan op elk rapport
          en in het dashboard van iedereen bij dit kantoor — wijzigingen zijn meteen zichtbaar voor
          alle collega's.
        </div>

        {laden ? (
          <div className="text-xs" style={{ color: INK_SOFT }}>Laden...</div>
        ) : (
          <div className="grid gap-4 mb-6">
            <Field label="Kantoornaam"><TextInput value={naam} onChange={(e) => setNaam(e.target.value)} /></Field>
            <Field label="Huisstijlkleur" hint="Wordt gebruikt voor titels en accenten in het rapport">
              <div className="flex items-center gap-2">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(kleur) ? kleur : "#8C6A2F"} onChange={(e) => setKleur(e.target.value)}
                  style={{ width: 40, height: 34, border: `1px solid ${LINE}`, borderRadius: 6, padding: 2, background: "none", cursor: "pointer" }} />
                <TextInput value={kleur} onChange={(e) => setKleur(e.target.value)} style={{ fontFamily: "monospace" }} placeholder="#8C6A2F" />
              </div>
            </Field>
            <Field label="Logo" hint="PNG, JPEG, WEBP of GIF, max. 3MB">
              <div className="flex items-center gap-3">
                {logo && (
                  <img src={logo} alt="Logo" style={{ width: 48, height: 48, objectFit: "contain", border: `1px solid ${LINE}`, borderRadius: 6, background: "#fff" }} />
                )}
                <label className="text-xs px-3 py-1.5 rounded-lg cursor-pointer" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
                  {logoBezig ? "Bezig met opladen..." : (logo ? "Logo vervangen" : "Logo opladen")}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden disabled={logoBezig}
                    onChange={(e) => { kiesLogo(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {logo && (
                  <button type="button" onClick={() => setLogo(null)} className="text-xs underline" style={{ color: INK_SOFT, background: "none" }}>
                    Verwijderen
                  </button>
                )}
              </div>
            </Field>
            <Field label="Adres"><TextInput value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="bv. Kerkstraat 1, 9100 Sint-Niklaas" /></Field>
            <Field label="Telefoonnummer"><TextInput value={telefoon} onChange={(e) => setTelefoon(e.target.value)} placeholder="bv. 03/123.45.67" /></Field>
            <Field label="E-mailadres (kantoor)"><TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="bv. info@kantoor.be" /></Field>
          </div>
        )}

        {status && (
          <div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{
            background: status.type === "ok" ? "#DCFCE7" : "#fee2e2",
            color: status.type === "ok" ? "#166534" : "#991b1b",
          }}>
            {status.message}
          </div>
        )}

        {!laden && (
          <button onClick={submit} disabled={bezig || logoBezig} className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg text-white"
            style={{ background: INK, fontWeight: 500, opacity: (bezig || logoBezig) ? 0.6 : 1 }}>
            {bezig ? "Bezig met opslaan..." : "Opslaan"}
          </button>
        )}
      </div>
    </div>
  );
}
