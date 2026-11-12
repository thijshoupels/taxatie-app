// ----------------------------------------------------------------------------
// ui/VoorbladFotoKader.jsx — de voorbladfoto bijsnijden, verschuiven of volledig tonen
// ----------------------------------------------------------------------------
// Toont het kader van het voorblad op schaal (zelfde verhouding als in de PDF, zie
// domein/voorbladFoto.js) met de foto erin zoals ze in het verslag komt. De schatter-expert:
//   - kiest "Bijsnijden" (de foto vult het kader) of "Hele foto tonen";
//   - versleept bij bijsnijden de foto om te kiezen welk deel zichtbaar blijft (muis, vinger of
//     pijltjestoetsen), en zoomt in met de schuifregelaar (of + en −);
//   - zet met "Centreren" alles terug zoals standaard.
// Elke wijziging gaat via onChange naar d.voorpaginaUitsnede (wordt automatisch bewaard).
import React, { useRef, useState } from "react";
import { X, Loader2, Move, Maximize2, Crop } from "lucide-react";
import { INK, INK_SOFT, LINE, ACCENT, ACCENT_SOFT, PAPER_RAISED } from "../constants.js";
import { normaliseerUitsnede, voorbladFotoStijl, verschuiving, UITSNEDE_STANDAARD, ZOOM_MAX } from "../domein/voorbladFoto.js";

export function VoorbladFotoKader({ src, uitsnede, onChange, onVerwijder }) {
  const u = normaliseerUitsnede(uitsnede);
  const stijl = voorbladFotoStijl(u);
  const kaderRef = useRef(null);
  const fotoRef = useRef(null);
  const sleep = useRef(null);
  const [sleept, setSleept] = useState(false);
  const bijsnijden = u.modus === "bijsnijden";

  const zet = (wijziging) => onChange(normaliseerUitsnede({ ...u, ...wijziging }));

  // nieuwe positie na een verschuiving van (dx, dy) pixels t.o.v. de positie bij het begin van het slepen
  const positieNa = (start, dx, dy) => {
    const kader = kaderRef.current && kaderRef.current.getBoundingClientRect();
    const foto = fotoRef.current;
    if (!kader || !foto || !foto.naturalWidth) return null;
    return {
      x: start.x + verschuiving(dx, kader.width, foto.naturalWidth, kader.height, foto.naturalHeight, start.zoom),
      y: start.y + verschuiving(dy, kader.height, foto.naturalHeight, kader.width, foto.naturalWidth, start.zoom),
    };
  };

  const onPointerDown = (e) => {
    if (!bijsnijden || !src) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    sleep.current = { px: e.clientX, py: e.clientY, x: u.x, y: u.y, zoom: u.zoom };
    setSleept(true);
  };
  const onPointerMove = (e) => {
    if (!sleep.current) return;
    const nieuw = positieNa(sleep.current, e.clientX - sleep.current.px, e.clientY - sleep.current.py);
    if (nieuw) zet(nieuw);
  };
  const stopSlepen = () => { sleep.current = null; setSleept(false); };

  const onKeyDown = (e) => {
    if (!bijsnijden) return;
    const stap = e.shiftKey ? 10 : 2;
    const acties = {
      ArrowLeft: () => zet({ x: u.x - stap }), ArrowRight: () => zet({ x: u.x + stap }),
      ArrowUp: () => zet({ y: u.y - stap }), ArrowDown: () => zet({ y: u.y + stap }),
      "+": () => zet({ zoom: u.zoom + 0.1 }), "=": () => zet({ zoom: u.zoom + 0.1 }), "-": () => zet({ zoom: u.zoom - 0.1 }),
    };
    if (acties[e.key]) { e.preventDefault(); acties[e.key](); }
  };

  const knop = (actief) => ({
    border: `1px solid ${actief ? ACCENT : LINE}`, background: actief ? ACCENT_SOFT : PAPER_RAISED,
    color: actief ? ACCENT : INK_SOFT, fontWeight: actief ? 600 : 500,
  });

  return (
    <div style={{ maxWidth: 520 }}>
      <div className="flex flex-wrap items-center gap-2 mb-2" role="group" aria-label="Hoe staat de foto op het voorblad?">
        <button type="button" aria-pressed={bijsnijden} onClick={() => zet({ modus: "bijsnijden" })}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={knop(bijsnijden)}>
          <Crop size={13} /> Bijsnijden
        </button>
        <button type="button" aria-pressed={!bijsnijden} onClick={() => zet({ modus: "volledig" })}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={knop(!bijsnijden)}>
          <Maximize2 size={13} /> Hele foto tonen
        </button>
      </div>

      <div className="rounded-lg overflow-hidden relative" style={{ border: `1px solid ${LINE}` }}>
        <div ref={kaderRef} tabIndex={bijsnijden && src ? 0 : -1}
          role={bijsnijden ? "application" : undefined}
          aria-label={bijsnijden ? "Uitsnede van de voorbladfoto: sleep, of gebruik de pijltjestoetsen en + en −" : "Voorbladfoto"}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={stopSlepen} onPointerCancel={stopSlepen}
          onKeyDown={onKeyDown}
          style={{ ...stijl.kader, cursor: bijsnijden && src ? (sleept ? "grabbing" : "grab") : "default", touchAction: bijsnijden ? "none" : "auto", userSelect: "none" }}>
          {src ? (
            <img ref={fotoRef} src={src} alt="Voorbladfoto" draggable={false} style={{ ...stijl.foto, pointerEvents: "none" }} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"><Loader2 size={18} className="animate-spin" style={{ color: INK_SOFT }} /></div>
          )}
        </div>
        <button type="button" onClick={onVerwijder} aria-label="Voorbladfoto verwijderen" title="Voorbladfoto verwijderen"
          className="absolute top-1.5 right-1.5 rounded-full flex items-center justify-center"
          style={{ width: 22, height: 22, background: "rgba(27,31,39,0.65)" }}>
          <X size={12} color="#fff" />
        </button>
      </div>

      {bijsnijden ? (
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-xs" style={{ color: INK_SOFT }}><Move size={12} /> Sleep de foto om te kiezen wat zichtbaar is</span>
          <label className="flex items-center gap-2 text-xs" style={{ color: INK }}>
            Zoom
            <input type="range" min={100} max={ZOOM_MAX * 100} step={5} value={Math.round(u.zoom * 100)}
              onChange={(e) => zet({ zoom: Number(e.target.value) / 100 })} aria-label="Zoom" style={{ width: 120, accentColor: ACCENT }} />
            <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 34, color: INK_SOFT }}>{Math.round(u.zoom * 100)}%</span>
          </label>
          <button type="button" onClick={() => zet({ x: UITSNEDE_STANDAARD.x, y: UITSNEDE_STANDAARD.y, zoom: UITSNEDE_STANDAARD.zoom })}
            className="text-xs px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            Centreren
          </button>
        </div>
      ) : (
        <div className="text-xs mt-2" style={{ color: INK_SOFT }}>De hele foto staat in het kader; wat overblijft, blijft wit.</div>
      )}
      <div className="text-xs mt-1" style={{ color: INK_SOFT }}>Zo staat de foto op het voorblad van het verslag.</div>
    </div>
  );
}
