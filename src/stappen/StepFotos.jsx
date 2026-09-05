// ----------------------------------------------------------------------------
// stappen/StepFotos.jsx — wizardtabblad "Foto's"
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10) zonder de logica/opmaak zelf te
// wijzigen.
import React, { useState, useRef } from "react";
import { Image as ImageIcon, Upload, Camera, AlertTriangle, Loader2, X } from "lucide-react";
import { INK_SOFT, PAPER_RAISED, LINE, BRASS, BRASS_SOFT, DANGER, OPTS } from "../constants.js";
import { berekenPandBijlageBytes, fmtMB, schatBase64Bytes } from "../lib/afbeeldingen.js";
import { Section, inputStyle } from "../ui/velden.jsx";

// ---------- foto's ----------
export function StepFotos({ d, addFotos, removeFoto, updateFoto, setVoorpaginaFoto, removeVoorpaginaFoto }) {
  const inputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const voorpaginaInputRef = useRef(null);
  const voorpaginaCameraInputRef = useRef(null);
  const [geweigerd, setGeweigerd] = useState([]);
  const bijlageBytes = berekenPandBijlageBytes(d);
  const bijlageMB = bijlageBytes / (1024 * 1024);
  return (
    <div>
      <Section title="Voorpagina-foto (optioneel)" icon={ImageIcon}>
        <div className="col-span-2">
          <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
            Een sfeerbeeld voor de cover-pagina van het verslag — bv. een mooie Street View-opname of een eigen foto ter plaatse. Los van de bijlage-foto's hieronder.
          </div>
          {d.voorpaginaFoto ? (
            <div className="rounded-lg overflow-hidden relative" style={{ border: `1px solid ${LINE}`, maxWidth: 360 }}>
              <div className="relative flex items-center justify-center" style={{ aspectRatio: "4/3", background: "rgba(0,0,0,0.03)" }}>
                {!d.voorpaginaFoto.url && !d.voorpaginaFoto.base64 && <Loader2 size={18} className="animate-spin" style={{ color: INK_SOFT }} />}
                {(d.voorpaginaFoto.url || d.voorpaginaFoto.base64) && (
                  <img src={d.voorpaginaFoto.url || d.voorpaginaFoto.base64} alt="Voorpagina" className="w-full h-full object-cover" />
                )}
                <button onClick={removeVoorpaginaFoto}
                  className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
                  style={{ width: 22, height: 22, background: "rgba(27,31,39,0.65)" }}>
                  <X size={12} color="#fff" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3" style={{ maxWidth: 360 }}>
              <div onClick={() => voorpaginaInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
                style={{ border: `1.5px dashed ${LINE}`, padding: "20px 12px", background: PAPER_RAISED }}>
                <Upload size={18} style={{ color: BRASS }} />
                <span className="text-xs text-center" style={{ color: INK_SOFT }}>Kies bestand</span>
                <input ref={voorpaginaInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { if (e.target.files[0]) setVoorpaginaFoto(e.target.files[0]); e.target.value = ""; }} />
              </div>
              <div onClick={() => voorpaginaCameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
                style={{ border: `1.5px dashed ${LINE}`, padding: "20px 12px", background: PAPER_RAISED }}>
                <Camera size={18} style={{ color: BRASS }} />
                <span className="text-xs text-center" style={{ color: INK_SOFT }}>Foto nemen</span>
                <input ref={voorpaginaCameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { if (e.target.files[0]) setVoorpaginaFoto(e.target.files[0]); e.target.value = ""; }} />
              </div>
            </div>
          )}
        </div>
      </Section>
      <Section title="Foto's" icon={ImageIcon}>
        <div className="col-span-2">
          <div className="text-xs mb-3" style={{ color: INK_SOFT }}>
            Vereist: frontzicht en zijdelingse zichten vanop straat (incl. straatuitrusting), zo mogelijk achtergevel en tuin, en interieurfoto's van inrichting/installaties.
            Enkel JPG/JPEG-bestanden worden aanvaard.
          </div>
          {bijlageMB > 3 && (
            <div className="flex items-center gap-1.5 text-xs mb-3 px-3 py-2 rounded-lg"
              style={{
                background: bijlageMB > 12 ? "#FBEAEA" : bijlageMB > 6 ? BRASS_SOFT : PAPER_RAISED,
                color: bijlageMB > 12 ? DANGER : bijlageMB > 6 ? BRASS : INK_SOFT,
              }}>
              {bijlageMB > 6 && <AlertTriangle size={13} />}
              Foto's en documenten in dit pand wegen samen ongeveer {fmtMB(bijlageBytes)} MB.
              {bijlageMB > 6 ? " Hoe meer, hoe trager (en foutgevoeliger) het opslaan — verwijder oudere of onnodige bijlagen indien mogelijk." : ""}
            </div>
          )}
          <div className="flex gap-3">
            <div onClick={() => inputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
              style={{ border: `1.5px dashed ${LINE}`, padding: "28px 16px", background: PAPER_RAISED }}>
              <Upload size={18} style={{ color: BRASS }} />
              <span className="text-sm" style={{ color: INK_SOFT }}>Klik om foto's toe te voegen (JPG/JPEG)</span>
              <input ref={inputRef} type="file" multiple accept="image/jpeg,.jpg,.jpeg" className="hidden"
                onChange={(e) => { addFotos(e.target.files, setGeweigerd); e.target.value = ""; }} />
            </div>
            <div onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer"
              style={{ border: `1.5px dashed ${LINE}`, padding: "28px 16px", background: PAPER_RAISED }}>
              <Camera size={18} style={{ color: BRASS }} />
              <span className="text-sm" style={{ color: INK_SOFT }}>Foto nemen met camera</span>
              <input ref={cameraInputRef} type="file" multiple accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { addFotos(e.target.files, setGeweigerd); e.target.value = ""; }} />
            </div>
          </div>
          {geweigerd.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: "#FBEAEA", color: DANGER }}>
              <AlertTriangle size={13} /> Niet toegevoegd (enkel JPG/JPEG toegelaten): {geweigerd.join(", ")}
            </div>
          )}
          {d.fotos.length === 0 ? (
            <div className="text-sm italic mt-4" style={{ color: INK_SOFT }}>Nog geen foto's toegevoegd.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {d.fotos.map((f) => (
                <div key={f.id} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${LINE}` }}>
                  <div className="relative flex items-center justify-center" style={{ aspectRatio: "4/3", background: "rgba(0,0,0,0.03)" }}>
                    {!f.url && !f.base64 && <Loader2 size={18} className="animate-spin" style={{ color: INK_SOFT }} />}
                    {(f.url || f.base64) && <img src={f.url || f.base64} alt={f.naam} className="w-full h-full object-cover" />}
                    <button onClick={() => removeFoto(f.id)}
                      className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
                      style={{ width: 22, height: 22, background: "rgba(27,31,39,0.65)" }}>
                      <X size={12} color="#fff" />
                    </button>
                  </div>
                  <select value={f.categorie || "Andere"} onChange={(e) => updateFoto(f.id, "categorie", e.target.value)}
                    style={{ ...inputStyle, borderRadius: 0, border: "none", borderTop: `1px solid ${LINE}`, fontSize: 12, padding: "6px 8px" }}>
                    {OPTS.fotoCategorie.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {/* helpt de gebruiker om, bij een dossier met een te grote totale bijlage-omvang
                      (zie de waarschuwing hierboven), zelf de zwaarste foto's te herkennen om te
                      verwijderen — dus bewust op de echte, huidige base64-omvang gebaseerd, niet op
                      de oorspronkelijke bestandsgrootte vóór verkleining. */}
                  {f.base64 && (
                    <div className="text-center" style={{ fontSize: 10, color: INK_SOFT, padding: "2px 0 4px" }}>
                      ~{Math.round(schatBase64Bytes(f.base64) / 1024)} kB
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}
