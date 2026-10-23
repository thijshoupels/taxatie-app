// ----------------------------------------------------------------------------
// stappen/ZonesPaneel.jsx — oppervlakte per functie (bedrijfsvastgoed)
// ----------------------------------------------------------------------------
// Tabel met per zone de functie (kantoor, magazijn, productie, …), de oppervlakte, een
// nieuwbouwprijs per m² en een markthuur per m² per jaar. Daaruit rekent berekenWaardering de
// kostenbenadering per functie en de huurwaardebenadering (zie domein/zones.js). Getoond op het
// tabblad Afmetingen bij elk bedrijfstype, in plaats van de residentiële tabel per woonverdieping.
import React from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { INK, INK_SOFT, LINE, ACCENT, DANGER, PAPER_RAISED } from "../constants.js";
import { eur, uid } from "../lib/format.js";
import { inputStyle, Section } from "../ui/velden.jsx";
import { ZONE_FUNCTIES, STANDAARD_ZONES, eenheidVan } from "../domein/zones.js";
import { typeVan } from "../domein/vastgoedtypes.js";

const leegZone = (functie = "kantoor") => ({ id: uid(), functie, omschrijving: "", opp: "", bouwprijs: "", markthuur: "" });

export function ZonesPaneel({ d, set, calc }) {
  const zones = d.zones || [];
  const zc = calc.zonesCalc;
  const zetZones = (nieuw) => set("zones")(nieuw);
  const wijzig = (id, sleutel, waarde) => zetZones(zones.map((z) => (z.id === id ? { ...z, [sleutel]: waarde } : z)));
  const standaard = STANDAARD_ZONES[typeVan(d)] || ["kantoor"];
  const cel = { ...inputStyle, padding: "5px 8px", fontSize: 13 };
  const th = { textAlign: "left", padding: "8px 8px", fontSize: 11, color: INK_SOFT, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, borderBottom: `1px solid ${LINE}`, whiteSpace: "nowrap" };
  const getal = { fontVariantNumeric: "tabular-nums", textAlign: "right", whiteSpace: "nowrap" };
  const m2 = (v) => `${(Math.round(v * 10) / 10).toLocaleString("nl-BE")} m²`;
  return (
    <Section title="Oppervlakte per functie" icon={Layers}>
      <div className="md:col-span-2">
        <p className="text-xs mb-3" style={{ color: INK_SOFT, lineHeight: 1.55 }}>
          Per functie de oppervlakte, een nieuwbouwprijs per m² (kostenbenadering) en een markthuur per m² per jaar
          (huurwaardebenadering op het tabblad Waardering). Parkeerplaatsen tel je per stuk; buitenopslag/verharding telt mee in
          huur en bouwwaarde maar niet in de overdekte vloeroppervlakte.
        </p>
        {zones.length === 0 ? (
          <button type="button" onClick={() => zetZones(standaard.map((f) => leegZone(f)))}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg" style={{ background: ACCENT, color: "var(--accent-contrast)", fontWeight: 500 }}>
            <Plus size={14} /> Zones voorstellen voor {typeVan(d)}
          </button>
        ) : (
          <div className="rounded-lg" style={{ border: `1px solid ${LINE}`, overflowX: "auto", background: PAPER_RAISED }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse", minWidth: 760 }}>
              <thead><tr>
                <th style={th}>Functie</th><th style={th}>Omschrijving</th><th style={{ ...th, textAlign: "right" }}>Oppervlakte</th>
                <th style={{ ...th, textAlign: "right" }}>Nieuwbouw €/eenh.</th><th style={{ ...th, textAlign: "right" }}>Markthuur €/eenh./jaar</th>
                <th style={{ ...th, textAlign: "right" }}>Nieuwbouw</th><th style={{ ...th, textAlign: "right" }}>Huur/jaar</th><th style={th} />
              </tr></thead>
              <tbody>
                {zones.map((z, i) => {
                  const r = zc.rijen[i] || { nieuwbouw: 0, huurJaar: 0 };
                  return (
                    <tr key={z.id} style={{ borderBottom: `1px solid ${LINE}` }}>
                      <td className="px-2 py-1.5" style={{ minWidth: 170 }}>
                        <select value={z.functie} onChange={(e) => wijzig(z.id, "functie", e.target.value)} style={cel}>
                          {ZONE_FUNCTIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5" style={{ minWidth: 130 }}>
                        <input value={z.omschrijving || ""} onChange={(e) => wijzig(z.id, "omschrijving", e.target.value)} placeholder="optioneel" style={cel} />
                      </td>
                      <td className="px-2 py-1.5" style={{ width: 110 }}>
                        <div className="flex items-center gap-1">
                          <input type="number" value={z.opp} onChange={(e) => wijzig(z.id, "opp", e.target.value)} style={{ ...cel, textAlign: "right" }} />
                          <span className="text-xs" style={{ color: INK_SOFT }}>{eenheidVan(z.functie)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5" style={{ width: 110 }}>
                        <input type="number" value={z.bouwprijs} onChange={(e) => wijzig(z.id, "bouwprijs", e.target.value)} style={{ ...cel, textAlign: "right", color: ACCENT }} />
                      </td>
                      <td className="px-2 py-1.5" style={{ width: 110 }}>
                        <input type="number" value={z.markthuur} onChange={(e) => wijzig(z.id, "markthuur", e.target.value)} style={{ ...cel, textAlign: "right", color: ACCENT }} />
                      </td>
                      <td className="px-2 py-1.5 font-mono" style={{ ...getal, fontSize: 13, color: INK_SOFT }}>{r.nieuwbouw ? eur(r.nieuwbouw) : "—"}</td>
                      <td className="px-2 py-1.5 font-mono" style={{ ...getal, fontSize: 13, color: INK_SOFT }}>{r.huurJaar ? eur(r.huurJaar) : "—"}</td>
                      <td className="px-2 py-1.5">
                        <button type="button" title="Zone verwijderen" onClick={() => zetZones(zones.filter((x) => x.id !== z.id))}><Trash2 size={14} style={{ color: DANGER }} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td className="px-3 py-2 text-sm" colSpan={2} style={{ fontWeight: 600, color: INK }}>
                  Totaal
                  <div className="text-xs" style={{ color: INK_SOFT, fontWeight: 400 }}>
                    overdekt {m2(zc.vloerOpp)}{zc.buitenOpp ? ` · buiten ${m2(zc.buitenOpp)}` : ""}{zc.parkeerplaatsen ? ` · ${zc.parkeerplaatsen} parkeerplaats${zc.parkeerplaatsen === 1 ? "" : "en"}` : ""}
                  </div>
                </td>
                <td className="px-2 py-2 font-mono text-sm" style={{ ...getal, fontWeight: 600 }}>{m2(zc.vloerOpp)}</td>
                <td /><td className="px-2 py-2 text-xs" style={{ ...getal, color: INK_SOFT }}>
                  {zc.vloerOpp > 0 && zc.markthuurJaar > 0 ? `gem. ${eur(zc.markthuurJaar / zc.vloerOpp)}/m²` : ""}
                </td>
                <td className="px-2 py-2 font-mono text-sm" style={{ ...getal, fontWeight: 600 }}>{zc.nieuwbouwwaarde ? eur(zc.nieuwbouwwaarde) : "—"}</td>
                <td className="px-2 py-2 font-mono text-sm" style={{ ...getal, fontWeight: 600 }}>{zc.markthuurJaar ? eur(zc.markthuurJaar) : "—"}</td>
                <td />
              </tr></tfoot>
            </table>
          </div>
        )}
        {zones.length > 0 && (
          <button type="button" onClick={() => zetZones([...zones, leegZone("andere")])}
            className="flex items-center gap-1.5 text-xs mt-2 px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${LINE}`, color: INK }}>
            <Plus size={13} /> Zone toevoegen
          </button>
        )}
        {zc.zonderBouwprijs.length > 0 && zc.metBouwprijs && (
          <div className="text-xs mt-2" style={{ color: DANGER }}>Nog geen nieuwbouwprijs voor: {zc.zonderBouwprijs.join(", ")} — die zones tellen nu voor € 0 mee in de kostenbenadering.</div>
        )}
      </div>
    </Section>
  );
}
