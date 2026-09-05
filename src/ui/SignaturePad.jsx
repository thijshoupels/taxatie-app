// ----------------------------------------------------------------------------
// ui/SignaturePad.jsx — canvas-handtekeningveld (eedformule)
// ----------------------------------------------------------------------------
// Uit App.jsx gehaald (opsplitsing in kleinere modules, stap 10, vervroegd omdat StepOpdracht.jsx
// dit rechtstreeks nodig heeft) zonder de logica zelf te wijzigen.
import React, { useRef } from "react";
import { Trash2 } from "lucide-react";
import { LINE, INK_SOFT } from "../constants.js";

export function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const tekenendRef = useRef(false);
  const laatstePuntRef = useRef(null);

  const puntUitEvent = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches && e.touches.length ? e.touches[0] : null;
    const clientX = t ? t.clientX : e.clientX;
    const clientY = t ? t.clientY : e.clientY;
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (e) => {
    e.preventDefault();
    tekenendRef.current = true;
    laatstePuntRef.current = puntUitEvent(e, canvasRef.current);
  };
  const teken = (e) => {
    if (!tekenendRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const punt = puntUitEvent(e, canvas);
    ctx.strokeStyle = "#1B1F27";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(laatstePuntRef.current.x, laatstePuntRef.current.y);
    ctx.lineTo(punt.x, punt.y);
    ctx.stroke();
    laatstePuntRef.current = punt;
  };
  const stop = () => {
    if (!tekenendRef.current) return;
    tekenendRef.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };
  const wis = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  if (value) {
    return (
      <div>
        <div className="rounded-lg p-3 inline-block" style={{ border: `1px solid ${LINE}`, background: "#fff" }}>
          <img src={value} alt="Handtekening" style={{ height: 80, display: "block" }} />
        </div>
        <div>
          <button onClick={wis} type="button" className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg"
            style={{ border: `1px solid ${LINE}`, color: INK_SOFT }}>
            <Trash2 size={13} /> Opnieuw ondertekenen
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <canvas ref={canvasRef} width={500} height={150}
        style={{ border: `1px solid ${LINE}`, background: "#fff", borderRadius: 8, width: "100%", maxWidth: 500, height: 150, cursor: "crosshair", touchAction: "none" }}
        onMouseDown={start} onMouseMove={teken} onMouseUp={stop} onMouseLeave={stop}
        onTouchStart={start} onTouchMove={teken} onTouchEnd={stop} />
      <div className="text-xs mt-1" style={{ color: INK_SOFT }}>Teken hier de handtekening met muis, trackpad of touchscreen.</div>
    </div>
  );
}
