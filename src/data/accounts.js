// ----------------------------------------------------------------------------
// data/accounts.js — snel wisselen tussen meerdere accounts op hetzelfde toestel
// ----------------------------------------------------------------------------
// Aanleiding: een schatter-expert met twee accounts (bv. tim@huyzen.be bij Huyzen en een eigen
// account voor zijn vennootschap Audentra) moest telkens afmelden en opnieuw aanmelden. De twee
// accounts blijven bewust APART (eigen kantoor, eigen huisstijl, eigen dossiers, eigen
// beheerders): we onthouden enkel per account de aanmelding op dit toestel, zodat de gebruiker met
// één klik wisselt — zoals bij Gmail.
//
// Hoe: Supabase houdt één actieve sessie bij. Per account bewaren we hier het "refresh token" van
// de laatste sessie (in localStorage, net zoals Supabase zelf de actieve sessie bewaart). Wisselen
// = met het bewaarde token van het andere account een nieuwe sessie ophalen (via een tijdelijke
// client) en die actief maken (setSession). We melden het vorige account daarbij NIET af:
// afmelden trekt bij Supabase het token in, en dan zou je bij het terugwisselen opnieuw moeten
// aanmelden.
//
// Supabase vervangt het refresh token bij elke vernieuwing ("rotatie"). Daarom werkt App.jsx dit
// lijstje bij bij elke aanmeld- of vernieuwingsgebeurtenis (onthoudAccount) — anders zou het
// bewaarde token van het actieve account na een uur niet meer geldig zijn.
//
// Bij "Afmelden" verdwijnt het account uit deze lijst (vergeetAccount). Een ander account
// toevoegen gebeurt via een aparte, tijdelijke Supabase-client die niets bewaart: zo blijft de
// huidige aanmelding geldig tot we effectief wisselen.
import { supabase, maakTijdelijkeClient } from "./supabase.js";

export const ACCOUNTS_SLEUTEL = "taxatie-app-accounts";

function lees() {
  try {
    const v = JSON.parse(localStorage.getItem(ACCOUNTS_SLEUTEL) || "[]");
    return Array.isArray(v) ? v.filter((a) => a && a.id && a.refreshToken) : [];
  } catch {
    return [];
  }
}
function schrijf(lijst) {
  try {
    if (lijst.length) localStorage.setItem(ACCOUNTS_SLEUTEL, JSON.stringify(lijst));
    else localStorage.removeItem(ACCOUNTS_SLEUTEL);
  } catch {
    // geen opslag beschikbaar (privévenster, ...): wisselen werkt dan gewoon niet, aanmelden wel
  }
}

// de bewaarde accounts, zonder tokens (voor het scherm)
export function bewaardeAccounts() {
  return lees().map(({ refreshToken, ...a }) => a);
}

// account (her)onthouden met het refresh token van deze sessie; extra = { naam, kantoorNaam }
export function onthoudAccount(sessie, extra = {}) {
  const user = sessie && sessie.user;
  if (!user || !user.id || !sessie.refresh_token) return;
  const lijst = lees();
  const i = lijst.findIndex((a) => a.id === user.id);
  const vorige = i >= 0 ? lijst[i] : {};
  const nieuw = {
    ...vorige,
    id: user.id,
    email: user.email || vorige.email || "",
    ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined && v !== null && v !== "")),
    refreshToken: sessie.refresh_token,
  };
  if (i >= 0) lijst[i] = nieuw; else lijst.push(nieuw);
  schrijf(lijst);
}

export function vergeetAccount(id) {
  schrijf(lees().filter((a) => a.id !== id));
}

// de actieve sessie (nog eens) onthouden vlak vóór een wissel — met het allerlaatste token
export async function onthoudHuidigAccount(extra = {}) {
  const { data } = await supabase.auth.getSession();
  if (data && data.session) onthoudAccount(data.session, extra);
  return data && data.session ? data.session.user.id : null;
}

// Een aparte client zonder opslag: een mislukte vernieuwing of aanmelding raakt zo nooit de actieve
// sessie (supabase-js wist bij een ongeldig token anders meteen de huidige aanmelding).
const tijdelijkeClient = () => maakTijdelijkeClient();

// de (geldige) sessie van een ander account actief maken in de app
async function maakActief(sessie) {
  const { data, error } = await supabase.auth.setSession({ access_token: sessie.access_token, refresh_token: sessie.refresh_token });
  if (error || !data || !data.session || !data.user) throw new Error((error && error.message) || "Wisselen van account mislukt — probeer opnieuw.");
  onthoudAccount(data.session);
  return data.user;
}

// wisselen naar een bewaard account; geeft de Supabase-gebruiker terug
export async function wisselNaarAccount(id) {
  const account = lees().find((a) => a.id === id);
  if (!account) throw new Error("Dit account staat niet (meer) op dit toestel — meld het opnieuw aan via \"Ander account toevoegen\".");
  const { data, error } = await tijdelijkeClient().auth.refreshSession({ refresh_token: account.refreshToken });
  if (error || !data || !data.session || !data.user) {
    // token ingetrokken of verlopen (bv. elders afgemeld of het wachtwoord gewijzigd) — de huidige
    // aanmelding blijft gewoon actief
    vergeetAccount(id);
    const err = new Error(`De aanmelding van ${account.email || "dit account"} is verlopen — meld dat account opnieuw aan via "Ander account toevoegen".`);
    err.verlopen = true;
    throw err;
  }
  return maakActief(data.session);
}

// een ander account aanmelden zonder het huidige af te melden, en er meteen naartoe wisselen
export async function voegAccountToe(email, wachtwoord, huidigeId) {
  const tijdelijk = tijdelijkeClient();
  const { data, error } = await tijdelijk.auth.signInWithPassword({ email, password: wachtwoord });
  if (error) throw new Error(error.message === "Invalid login credentials" ? "Ongeldig e-mailadres of wachtwoord." : error.message);
  if (!data || !data.session || !data.user) throw new Error("Aanmelden mislukt — probeer opnieuw.");
  if (!data.user.email_confirmed_at) {
    // zelfde beveiliging als login() in data/auth.js
    await tijdelijk.auth.signOut({ scope: "local" }).catch(() => {});
    throw new Error("Dit e-mailadres is nog niet bevestigd. Klik op de bevestigingslink die je per e-mail ontving.");
  }
  if (huidigeId && data.user.id === huidigeId) {
    await tijdelijk.auth.signOut({ scope: "local" }).catch(() => {});
    throw new Error("Met dit account ben je al aangemeld.");
  }
  return maakActief(data.session);
}
