// ----------------------------------------------------------------------------
// data/sessieHerstel.js — een opvraging één keer herhalen na een verlopen aanmeldtoken
// ----------------------------------------------------------------------------
// Aanleiding (logboeken 12/11/2026): bij het openen van de app vroeg de app het profiel op met een
// net verlopen aanmeldtoken. Supabase antwoordde "401", supabase-js vernieuwde het token een
// fractie later vanzelf — maar het profiel was dan al als "niet gevonden" behandeld. Gevolg: geen
// kantoor, dus de standaardhuisstijl (Houpels) bij o.a. dennis@huyzen.be en bert@huyzen.be, en
// geen beheerdersrechten, tot de volgende aanmelding.
//
// metGeldigeSessie voert de opvraging uit; is het antwoord een sessiefout (401 / JWT verlopen),
// dan vernieuwt ze het token en probeert ze precies één keer opnieuw. Blijft het een sessiefout,
// dan geeft ze dat antwoord gewoon terug: de aanroeper beslist (zie SessieVerlopenFout).
import { supabase } from "./supabase.js";

export function isSessieFout(res) {
  const e = res && res.error;
  if (!e) return false;
  return res.status === 401 || e.status === 401 || /^PGRST30[1-3]$/.test(String(e.code || ""))
    || /jwt|token (is )?(expired|invalid)|unauthori[sz]ed|invalid claim/i.test(String(e.message || ""));
}

export async function metGeldigeSessie(vraag) {
  let res = await vraag();
  if (isSessieFout(res)) {
    try {
      if (supabase.auth && typeof supabase.auth.refreshSession === "function") await supabase.auth.refreshSession();
    } catch {
      // vernieuwen mislukt: de tweede poging hieronder geeft dan zelf de sessiefout terug
    }
    res = await vraag();
  }
  return res;
}

// De aanmelding is echt niet meer geldig (ook na vernieuwen): dan mag de app NIET verder met
// standaardwaarden (verkeerde huisstijl, geen beheerdersrechten), maar moet de gebruiker opnieuw
// aanmelden — zie bouwSessie in App.jsx.
export class SessieVerlopenFout extends Error {
  constructor(bericht) {
    super(bericht || "Je aanmelding is verlopen — meld je opnieuw aan.");
    this.name = "SessieVerlopenFout";
  }
}
