// ----------------------------------------------------------------------------
// domein/voortgang.js — voortgang per tabblad (zijbalk van de wizard)
// ----------------------------------------------------------------------------
// Per tabblad één status, afgeleid van de kwaliteitsscore (domein/kwaliteit.js) en de blokkerende
// punten (valideerDossier):
//   "blokkeert" — hier ontbreekt iets zonder het welk het verslag niet gemaakt kan worden;
//   "open"      — er staan nog punten open die het verslag sterker maken;
//   "klaar"     — alles wat de app hier controleert, is ingevuld;
//   null        — de app controleert op dit tabblad niets (bv. Panden, Rapport).
// Pure functie — apart testbaar (zie __tests__/gebruiksvriendelijk.test.js).
import { tabUitTekst } from "./kwaliteit.js";

// blokkerende punten zonder "— tabblad …" in de tekst (datum overlijden, Vlabel-nummer, reden)
// horen allemaal bij Opdracht & partijen
export function tabVanBlokkerendPunt(tekst) {
  return tabUitTekst(tekst) || "opdracht";
}

export function voortgangPerTab(kwaliteit, blokkerend = []) {
  const uit = {};
  const tabs = (kwaliteit && kwaliteit.tabs) || {};
  for (const [tab, t] of Object.entries(tabs)) {
    uit[tab] = { status: t.open > 0 ? "open" : t.criteria > 0 ? "klaar" : null, open: t.open, blokkerend: 0 };
  }
  for (const p of blokkerend || []) {
    const tab = tabVanBlokkerendPunt(p);
    uit[tab] = uit[tab] || { status: null, open: 0, blokkerend: 0 };
    uit[tab].blokkerend++;
    uit[tab].status = "blokkeert";
  }
  return uit;
}

// korte tekst voor de tooltip/schermlezer bij het bolletje in de zijbalk
export function voortgangTekst(v) {
  if (!v || !v.status) return "";
  if (v.status === "blokkeert") return `${v.blokkerend} ${v.blokkerend === 1 ? "punt" : "punten"} nodig om het verslag te maken`;
  if (v.status === "open") return `nog ${v.open} ${v.open === 1 ? "punt" : "punten"} open`;
  return "volledig";
}
