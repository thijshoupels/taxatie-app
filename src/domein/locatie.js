// ----------------------------------------------------------------------------
// domein/locatie.js — waar ligt het pand: adres, of anders het perceel (CaPaKey)
// ----------------------------------------------------------------------------
// Een grond (bouwgrond, landbouwgrond) heeft vaak geen adres, wel een CaPaKey. Alles wat de ligging
// nodig heeft — de AI-opzoeking van de omgeving, de liggingskaart, de titel van het dossier — kijkt
// daarom eerst naar het adres en valt anders terug op het perceel: het middelpunt van de
// perceelsgeometrie die de app via CadGIS ophaalt zodra een CaPaKey ingevuld is (zie
// fetchCadgisPerceel in kaarten.jsx, bewaard als cadgisRingen in EPSG:31370 / Lambert 72).
// Met een adres verandert er niets. Pure functies — apart testbaar (zie __tests__/locatie.test.js).

const tekst = (v) => String(v ?? "").trim();

// straat en gemeente ingevuld = een bruikbaar adres (zoals de app dat altijd al eiste)
export const heeftAdres = (d) => !!(d && tekst(d.straat) && tekst(d.gemeente));

// het adres zoals de app het altijd schreef: "Straat 12/1, 9140 Temse"
export const adresRegel = (d) => `${d.straat} ${d.nummer}${d.bus ? "/" + d.bus : ""}, ${d.postcode} ${d.gemeente}`;

// middelpunt van de perceelsgeometrie (Lambert 72), of null
export function perceelMiddelpunt(ringen) {
  const punten = (ringen || []).flat().filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!punten.length) return null;
  const x = punten.reduce((s, p) => s + p[0], 0) / punten.length;
  const y = punten.reduce((s, p) => s + p[1], 0) / punten.length;
  return [x, y];
}

// ---- Lambert 72 (EPSG:31370) → WGS84 (breedte/lengte in graden) ----
// Inverse Lambert conform kegelprojectie (2 standaardparallellen) op de Hayford-ellipsoïde
// (International 1924, datum BD72), daarna de datumverschuiving BD72 → WGS84 met de
// 7-parameter Helmert-transformatie van het NGI/EPSG (BD72 to WGS 84 (3), position vector).
// Nauwkeurig tot op ongeveer een meter — ruim voldoende voor een kaart of een omgevingsopzoeking.
const RAD = Math.PI / 180;
const BD72 = { a: 6378388, f: 1 / 297 };
const WGS84 = { a: 6378137, f: 1 / 298.257223563 };
const LAMBERT72 = {
  phi1: (51 + 10 / 60 + 0.00204 / 3600) * RAD,
  phi2: (49 + 50 / 60 + 0.00204 / 3600) * RAD,
  phi0: 90 * RAD,
  lambda0: (4 + 22 / 60 + 2.952 / 3600) * RAD,
  x0: 150000.013,
  y0: 5400088.438,
};
const HELMERT = { tx: -106.8686, ty: 52.2978, tz: -103.7239, rx: 0.3366, ry: -0.457, rz: 1.8422, s: -1.2747 };

function lambert72NaarBd72(x, y) {
  const { a, f } = BD72;
  const e = Math.sqrt(2 * f - f * f);
  const { phi1, phi2, phi0, lambda0, x0, y0 } = LAMBERT72;
  const m = (phi) => Math.cos(phi) / Math.sqrt(1 - e * e * Math.sin(phi) ** 2);
  const t = (phi) => Math.tan(Math.PI / 4 - phi / 2) / ((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi))) ** (e / 2);
  const n = (Math.log(m(phi1)) - Math.log(m(phi2))) / (Math.log(t(phi1)) - Math.log(t(phi2)));
  const F = m(phi1) / (n * t(phi1) ** n);
  const r0 = a * F * (phi0 === Math.PI / 2 ? 0 : t(phi0) ** n);
  const dx = x - x0, dy = r0 - (y - y0);
  const r = Math.sign(n) * Math.sqrt(dx * dx + dy * dy);
  const theta = Math.atan2(dx, dy);
  const tAcc = (r / (a * F)) ** (1 / n);
  let phi = Math.PI / 2 - 2 * Math.atan(tAcc);
  for (let i = 0; i < 10; i++) {
    phi = Math.PI / 2 - 2 * Math.atan(tAcc * ((1 - e * Math.sin(phi)) / (1 + e * Math.sin(phi))) ** (e / 2));
  }
  return { phi, lambda: theta / n + lambda0 };
}

function geografischNaarXyz({ phi, lambda }, { a, f }) {
  const e2 = 2 * f - f * f;
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  return [N * Math.cos(phi) * Math.cos(lambda), N * Math.cos(phi) * Math.sin(lambda), N * (1 - e2) * Math.sin(phi)];
}

function xyzNaarGeografisch([X, Y, Z], { a, f }) {
  const e2 = 2 * f - f * f;
  const p = Math.hypot(X, Y);
  let phi = Math.atan2(Z, p * (1 - e2));
  for (let i = 0; i < 10; i++) {
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    phi = Math.atan2(Z + e2 * N * Math.sin(phi), p);
  }
  return { phi, lambda: Math.atan2(Y, X) };
}

export function lambert72NaarWgs84(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const [X, Y, Z] = geografischNaarXyz(lambert72NaarBd72(x, y), BD72);
  const sec = RAD / 3600;
  const rx = HELMERT.rx * sec, ry = HELMERT.ry * sec, rz = HELMERT.rz * sec, k = 1 + HELMERT.s / 1e6;
  const X2 = HELMERT.tx + k * (X - rz * Y + ry * Z);
  const Y2 = HELMERT.ty + k * (rz * X + Y - rx * Z);
  const Z2 = HELMERT.tz + k * (-ry * X + rx * Y + Z);
  const { phi, lambda } = xyzNaarGeografisch([X2, Y2, Z2], WGS84);
  return { lat: phi / RAD, lon: lambda / RAD };
}

// ligging van het perceel in WGS84 (enkel als de perceelsgeometrie al opgehaald is)
export function perceelLocatie(d) {
  const c = perceelMiddelpunt(d && d.cadgisRingen);
  return c ? lambert72NaarWgs84(c[0], c[1]) : null;
}

const coordTekst = (l) => `${l.lat.toFixed(6)},${l.lon.toFixed(6)}`;

// Wat Google Maps als middelpunt/markering krijgt: het adres, of anders de coördinaten van het
// perceel ("51.123456,4.123456"). null = geen ligging bekend.
export function kaartLocatie(d) {
  if (heeftAdres(d)) return `${adresRegel(d)}, België`;
  const l = perceelLocatie(d);
  return l ? coordTekst(l) : null;
}

// Omschrijving van de ligging voor de AI-opzoeking van de omgeving (zonder namen van personen)
export function liggingVoorAi(d) {
  if (heeftAdres(d)) return `het adres: ${adresRegel(d)}, België`;
  const l = perceelLocatie(d);
  if (!l) return null;
  const plaats = [tekst(d.postcode), tekst(d.gemeente)].filter(Boolean).join(" ");
  const straat = tekst(d.straat);
  return `een perceel zonder huisadres${plaats ? ` in ${plaats}` : ""}${straat ? ` (langs ${straat})` : ""}, België — kadastraal perceel (CaPaKey) ${tekst(d.capakey)}, middelpunt van het perceel op GPS-coördinaten ${coordTekst(l)} (breedte, lengte; WGS84). Gebruik deze coördinaten als vertrekpunt voor alle afstanden`;
}

// sleutel om te onthouden voor welke ligging de AI-opzoeking al gebeurde
export function liggingSleutel(d) {
  if (heeftAdres(d)) return `${adresRegel(d)}, België`;
  const l = perceelLocatie(d);
  return l ? `CaPaKey ${tekst(d.capakey)}` : "";
}

// korte naam voor het dossier/pand: het adres, of anders het perceel
export function pandNaamKort(d) {
  if (d && tekst(d.straat)) return `${d.straat} ${d.nummer || ""}${d.bus ? "/" + d.bus : ""}`.trim();
  if (d && tekst(d.capakey)) return `Perceel ${tekst(d.capakey)}`;
  return "";
}

// adresregel voor het verslag: het adres, of anders postcode en gemeente met "perceel zonder adres"
export function adresVoorVerslag(d) {
  if (tekst(d.straat)) return adresRegel(d);
  const plaats = [tekst(d.postcode), tekst(d.gemeente)].filter(Boolean).join(" ");
  if (tekst(d.capakey)) return plaats ? `${plaats} (perceel zonder adres — zie CaPaKey)` : "Perceel zonder adres — zie CaPaKey";
  return adresRegel(d);
}

// Kopregel van het verslag (bovenaan ELKE pagina, zie /api/generate-pdf). Bij één pand gewoon het
// adres. Bij meerdere panden stond daar voordien enkel het adres van het hoofdpand — ook boven de
// pagina's van de andere panden. Nu: alle adressen, per straat samengevat
// ("Vlyminckshoek 40A, 40B, 40C, 9100 Sint-Niklaas"). Een extra pand zonder eigen postcode/gemeente
// neemt die van het hoofdpand; een pand zonder straat (bv. een grond) telt als perceel. Wordt de
// regel te lang voor de kopregel, dan het eerste adres met het aantal andere panden.
export const KOPADRES_MAX = 90;
export function kopAdres(d) {
  const extra = (d && Array.isArray(d.extraPanden)) ? d.extraPanden : [];
  if (!extra.length) return adresVoorVerslag(d);
  const groepen = [];
  let percelen = 0;
  for (const p of [d, ...extra]) {
    if (!tekst(p.straat)) { percelen++; continue; }
    const postcode = tekst(p.postcode) || tekst(d.postcode), gemeente = tekst(p.gemeente) || tekst(d.gemeente);
    const sleutel = `${tekst(p.straat).toLowerCase()}|${postcode}|${gemeente.toLowerCase()}`;
    let g = groepen.find((x) => x.sleutel === sleutel);
    if (!g) { g = { sleutel, straat: tekst(p.straat), plaats: `${postcode} ${gemeente}`.trim(), nummers: [] }; groepen.push(g); }
    const nr = `${tekst(p.nummer)}${p.bus ? "/" + tekst(p.bus) : ""}`;
    if (nr && !g.nummers.includes(nr)) g.nummers.push(nr);
  }
  const delen = groepen.map((g) => [`${g.straat} ${g.nummers.join(", ")}`.trim(), g.plaats].filter(Boolean).join(", "));
  if (percelen) delen.push(percelen === 1 ? "1 perceel zonder adres" : `${percelen} percelen zonder adres`);
  const regel = delen.join(" · ");
  if (regel && regel.length <= KOPADRES_MAX) return regel;
  const andere = extra.length;
  return `${adresVoorVerslag(d)} (+ ${andere} ${andere === 1 ? "ander pand" : "andere panden"})`;
}
