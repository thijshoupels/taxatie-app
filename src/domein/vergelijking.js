// ----------------------------------------------------------------------------
// domein/vergelijking.js — vergelijkingsmethode op basis van referentietransacties
// ----------------------------------------------------------------------------
// Tot nu toe werden vergelijkingspunten enkel opgesomd; ze telden nergens mee in de waarde. Hier
// worden ze een volwaardige rekenmethode, zoals een schatter-expert die op papier zou opbouwen:
//
//   per referentie
//     prijs                         (verkoopprijs/belastbare grondslag, of een vraagprijs)
//     × (1 − onderhandelingsmarge)  enkel bij een VRAAGPRIJS: dat is een plafond, geen marktprijs
//     × indexatie naar de referentiedatum   (marktevolutie % per jaar × tijd tussen beide datums)
//     × (1 + correcties)            ligging, staat/afwerking, grootte/perceel, andere — in %, vanuit
//                                   het standpunt van het te schatten pand: is de referentie
//                                   beter gelegen, dan krijgt ze een NEGATIEVE correctie
//     = gecorrigeerde prijs
//     ÷ bewoonbare oppervlakte van de referentie = gecorrigeerde prijs per m²
//     × oppervlakte van het te schatten pand = waarde volgens die referentie
//
//   uitkomst: het gemiddelde van de waarden volgens de meegenomen referenties; als bandbreedte de
//   uiterste waarden (tot 3 referenties) of de middelste helft (P25–P75, vanaf 4 referenties).
//   Heeft het te schatten pand of geen enkele referentie een oppervlakte, dan wordt rechtstreeks
//   met de gecorrigeerde prijzen vergeleken (geheel tegen geheel).
//
// Pure functies — apart testbaar (zie __tests__/vergelijking.test.js).

export const PRIJS_SOORTEN = ["Verkoopprijs (akte / transactie)", "Vraagprijs (te koop aangeboden)"];
export const isVraagprijs = (v) => /^Vraagprijs/i.test(String(v.prijsSoort || ""));
export const CORRECTIES = [
  { k: "corrLiggingPct", label: "Ligging" },
  { k: "corrStaatPct", label: "Staat / afwerking" },
  { k: "corrGroottePct", label: "Grootte / perceel" },
  { k: "corrAnderePct", label: "Andere" },
];
// referentie afkomstig uit een Vlabel-lijst (zie naarVergelijkingspunt in domein/vlabelVgl.js) —
// die gegevens mogen enkel binnen de opdracht (nalatenschap) gebruikt worden
export const isVlabelPunt = (v) => !!(v.vlabelNr || /^Vlabel/i.test(String(v.bron || "")));

const getal = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : null;
};
const jarenTussen = (van, tot) => {
  const a = Date.parse(van), b = Date.parse(tot);
  return isFinite(a) && isFinite(b) ? (b - a) / (365.25 * 24 * 3600 * 1000) : null;
};
const kwantiel = (gesorteerd, q) => {
  const pos = (gesorteerd.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return gesorteerd[lo] + (gesorteerd[hi] - gesorteerd[lo]) * (pos - lo);
};

export function berekenVergelijking(punten, { oppTeSchatten = 0, referentiedatum = "", onderhandelingsmargePct = 5, indexPctPerJaar = 0 } = {}) {
  const marge = getal(onderhandelingsmargePct) ?? 0;
  const index = getal(indexPctPerJaar) ?? 0;
  const opp = getal(oppTeSchatten) || 0;
  const alle = (punten || []).map((v, i) => {
    const prijs = getal(v.belastbareGrondslag);
    const vraag = isVraagprijs(v);
    const jaren = v.datumTransactie && referentiedatum ? jarenTussen(v.datumTransactie, referentiedatum) : null;
    const factorMarge = vraag ? 1 - marge / 100 : 1;
    const factorIndex = index && jaren !== null ? Math.pow(1 + index / 100, jaren) : 1;
    const correctiePct = CORRECTIES.reduce((s, c) => s + (getal(v[c.k]) || 0), 0);
    const gecorrigeerd = prijs ? prijs * factorMarge * factorIndex * (1 + correctiePct / 100) : 0;
    const refOpp = getal(v.bewoonbareOpp) || 0;
    return { id: v.id, nr: i + 1, punt: v, prijs: prijs || 0, vraagprijs: vraag, jaren, factorMarge, factorIndex, correctiePct, gecorrigeerd, refOpp, meetellen: v.meetellen !== false };
  });
  const bruikbaar = alle.filter((r) => r.meetellen && r.prijs > 0);
  const basis = opp > 0 && bruikbaar.some((r) => r.refOpp > 0) ? "m2" : "geheel";
  const rijen = alle.map((r) => {
    let reden = "";
    if (!r.meetellen) reden = "niet meegenomen";
    else if (!(r.prijs > 0)) reden = "geen prijs";
    else if (basis === "m2" && !(r.refOpp > 0)) reden = "geen oppervlakte";
    const perM2 = basis === "m2" && r.refOpp > 0 ? r.gecorrigeerd / r.refOpp : null;
    const waarde = reden ? 0 : basis === "m2" ? perM2 * opp : r.gecorrigeerd;
    return { ...r, perM2, waarde, telt: !reden, reden };
  });
  const tellend = rijen.filter((r) => r.telt);
  const waarden = tellend.map((r) => r.waarde).sort((a, b) => a - b);
  const n = waarden.length;
  const waarde = n ? waarden.reduce((s, w) => s + w, 0) / n : 0;
  const onder = !n ? 0 : n >= 4 ? kwantiel(waarden, 0.25) : waarden[0];
  const boven = !n ? 0 : n >= 4 ? kwantiel(waarden, 0.75) : waarden[n - 1];
  const perM2s = tellend.filter((r) => r.perM2).map((r) => r.perM2);
  const gemPerM2 = perM2s.length ? perM2s.reduce((s, x) => s + x, 0) / perM2s.length : null;
  const aantalVraag = tellend.filter((r) => r.vraagprijs).length;

  const waarschuwingen = [];
  if (n > 0 && n < 3) waarschuwingen.push(`Slechts ${n} bruikbare referentie${n === 1 ? "" : "s"} — voor een betrouwbare vergelijking zijn er minstens 3, liefst 4 tot 6 nodig.`);
  if (n > 0 && aantalVraag === n) waarschuwingen.push("Enkel vraagprijzen: dat zijn plafonds, geen marktprijzen. Bevestig met effectief verkochte panden.");
  else if (aantalVraag > 0) waarschuwingen.push(`${aantalVraag} van de ${n} referenties ${aantalVraag === 1 ? "is een vraagprijs" : "zijn vraagprijzen"} (met ${String(marge).replace(".", ",")}% onderhandelingsmarge verrekend).`);
  const oud = tellend.filter((r) => r.jaren !== null && r.jaren > 3).map((r) => r.nr);
  if (oud.length) waarschuwingen.push(`Referentie${oud.length > 1 ? "s" : ""} ${oud.join(", ")} ${oud.length > 1 ? "zijn" : "is"} meer dan 3 jaar oud t.o.v. de referentiedatum${index ? "" : " — overweeg een marktindexatie"}.`);
  if (perM2s.length >= 2 && Math.max(...perM2s) / Math.min(...perM2s) > 1.5) waarschuwingen.push("De gecorrigeerde prijzen per m² lopen sterk uiteen (meer dan 50%) — controleer de correcties of laat een afwijkende referentie weg.");
  const zonderOpp = rijen.filter((r) => r.reden === "geen oppervlakte").map((r) => r.nr);
  if (zonderOpp.length) waarschuwingen.push(`Referentie${zonderOpp.length > 1 ? "s" : ""} ${zonderOpp.join(", ")} ${zonderOpp.length > 1 ? "tellen" : "telt"} niet mee: geen bewoonbare oppervlakte ingevuld.`);

  return { rijen, aantal: n, aantalVraag, basis, oppTeSchatten: opp, gemPerM2, waarde, onder, boven, waarschuwingen, onderhandelingsmargePct: marge, indexPctPerJaar: index };
}
