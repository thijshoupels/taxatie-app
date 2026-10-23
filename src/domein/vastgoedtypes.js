// ----------------------------------------------------------------------------
// domein/vastgoedtypes.js — de vastgoedtypes en alles wat ervan afhangt
// ----------------------------------------------------------------------------
// Residentieel, vijf bedrijfstypes (Kantoor, KMO-unit / gemengd, Industrie & logistiek, Retail,
// Horeca) en Garage / Staanplaats. Elke controle "is dit residentieel/bedrijfsmatig/…?" in de app
// loopt via deze functies, zodat een nieuw type of een andere indeling op één plek wordt geregeld.
//
// Oudere dossiers gebruikten "KMO-vastgoed" en "Bedrijfsvastgoed" met een subtype (Kantoor,
// Winkel, Industrieel/logistiek, Horeca). typeVan() zet die altijd om naar het nieuwe type, ook
// als het dossier zelf (nog) niet omgezet werd — zie ook normaliseerVastgoedtype(), dat App.jsx
// bij het openen van een dossier toepast zodat de keuzelijst de juiste waarde toont.
// Pure functies — apart testbaar (zie __tests__/vastgoedtypes.test.js).

export const RESIDENTIEEL = "Residentieel";
export const KANTOOR = "Kantoor";
export const KMO = "KMO-unit / gemengd";
export const INDUSTRIE = "Industrie & logistiek";
export const RETAIL = "Retail";
export const HORECA = "Horeca";
export const GARAGE = "Garage / Staanplaats";

export const BEDRIJFSTYPES = [KANTOOR, KMO, INDUSTRIE, RETAIL, HORECA];
export const VASTGOEDTYPES = [RESIDENTIEEL, ...BEDRIJFSTYPES, GARAGE];

const OUD_SUBTYPE = { Kantoor: KANTOOR, Winkel: RETAIL, "Industrieel/logistiek": INDUSTRIE, Horeca: HORECA };

// oud of nieuw type (+ eventueel oud subtype) → nieuw type; onbekend/leeg → Residentieel (zoals
// de app een dossier zonder vastgoedType altijd al als residentieel behandelde)
export function normaliseerType(type, subtype) {
  if (VASTGOEDTYPES.includes(type)) return type;
  if (type === "KMO-vastgoed") return KMO;
  if (type === "Bedrijfsvastgoed") return OUD_SUBTYPE[subtype] || KMO;
  return RESIDENTIEEL;
}

export const typeVan = (d) => normaliseerType(d && d.vastgoedType, d && d.bedrijfsSubtype);
export const isBedrijfsmatig = (d) => BEDRIJFSTYPES.includes(typeVan(d));
export const isGarage = (d) => typeVan(d) === GARAGE;
export const isResidentieelType = (d) => typeVan(d) === RESIDENTIEEL;
// het bedrijfstype, of "" bij residentieel/garage
export const bedrijfstypeVan = (d) => (isBedrijfsmatig(d) ? typeVan(d) : "");
// residentieel / bedrijfsmatig / garage — bepaalt de tabbladen en de "Pand"-lijst
export const categorieVan = (d) => (isBedrijfsmatig(d) ? "bedrijfsmatig" : isGarage(d) ? "garage" : "residentieel");

// "Pand"-keuzelijst per bedrijfstype (residentieel en garage hebben hun eigen lijst in OPTS)
export const PAND_PER_BEDRIJFSTYPE = {
  [KANTOOR]: ["Kantoorgebouw", "Kantoorverdieping / -unit", "Kantoorvilla", "Bedrijfscentrum (kantoren)", "Gemengd (kantoor/wonen)", "Andere"],
  [KMO]: ["KMO-unit", "Gemengd (kantoor/magazijn)", "Bedrijfsgebouw", "Bedrijfswoning (gecombineerd)", "Andere"],
  [INDUSTRIE]: ["Bedrijfsloods/magazijn", "Productiehal", "Logistiek distributiecentrum", "Opslag / stockage", "Andere"],
  [RETAIL]: ["Winkelpand", "Winkel met bovenwoning", "Baanwinkel / retailpark", "Showroom", "Andere"],
  [HORECA]: ["Horecapand", "Café/restaurant met bovenwoning", "Hotel / B&B", "Andere"],
};

// sleutel in BEDRIJFS_RICHTWAARDEN (constants.js) — die gebruikt nog de oude subtype-namen
export const RICHTWAARDE_SLEUTEL = { [KANTOOR]: "Kantoor", [RETAIL]: "Winkel", [INDUSTRIE]: "Industrieel/logistiek", [HORECA]: "Horeca", [KMO]: "" };

// zet een (pand)dossier om naar de nieuwe typenamen; laat een reeds omgezet dossier ongemoeid
export function normaliseerVastgoedtype(pd) {
  if (!pd || typeof pd !== "object") return pd;
  const nieuw = normaliseerType(pd.vastgoedType, pd.bedrijfsSubtype);
  if (nieuw === pd.vastgoedType && !pd.bedrijfsSubtype) return pd;
  return { ...pd, vastgoedType: nieuw, bedrijfsSubtype: "" };
}
