// ----------------------------------------------------------------------------
// lib/opslagWachtrij.js — hooguit één opslagbeurt tegelijk, en enkel de NIEUWSTE wachtende
// ----------------------------------------------------------------------------
// Waarom: bij een dossier met veel foto's/documenten (5-8 MB aan base64) duurt één opslagbeurt op
// een gewone verbinding al snel 10-30 s. De wizard bewaart automatisch ~1 s na elke wijziging, dus
// tijdens zo'n trage opslagbeurt stapelden de volgende zich op. Vroeger wachtte elke opgestapelde
// beurt in een lus op de vorige, maar met een plafond van 30 s: daarna liepen ze tóch tegelijk.
// Meerdere gelijktijdige UPDATE's op dezelfde dossierrij blokkeren elkaar in de databank (rij-slot),
// lopen dan tegen de lock-/statement-timeout aan (HTTP 500) en elke mislukte beurt stuurde daarna
// nóg eens de volledige 5 MB via de upsert-terugval — een sneeuwbal die het opslaan minutenlang
// blokkeerde (vastgesteld in de Supabase-logboeken op 29/09/2026: tientallen 500's op één dossier
// van 5,4 MB binnen 4 minuten).
//
// Nu: loopt er al een opslagbeurt, dan wordt de nieuwe aanvraag geparkeerd; komt er nog een, dan
// vervangt die de geparkeerde (enkel de recentste toestand van het dossier moet immers naar de
// server — tussenliggende toestanden opnieuw versturen is verspilde tijd en bandbreedte). Zodra de
// lopende beurt klaar is, start de geparkeerde. Alle aanroepers die door een recentere aanvraag
// "ingehaald" werden, krijgen het resultaat van die recentere beurt terug (hun wijzigingen zitten
// daar immers in).
//
// Vangnet: blijft een opslagbeurt hangen (bv. een netwerkaanvraag die nooit antwoordt), dan mag de
// geparkeerde na maxWachtMs toch starten — anders zou er nooit meer iets bewaard worden. Dat plafond
// ligt bewust ruim boven de server-limieten (statement-timeout 30 s, gateway ~60 s), zodat het in
// de praktijk enkel bij een écht hangende verbinding speelt en niet meer bij een gewone trage upload.
export function maakOpslagWachtrij(voerUit, { maxWachtMs = 120000 } = {}) {
  let bezig = false;
  let wachtend = null; // { snapshot, promise, resolve, reject }

  const start = (snapshot) => {
    bezig = true;
    const resultaat = Promise.resolve().then(() => voerUit(snapshot));
    let vrijgegeven = false;
    let timer = null;
    const geefVrij = () => {
      if (vrijgegeven) return;
      vrijgegeven = true;
      if (timer) clearTimeout(timer);
      bezig = false;
      if (wachtend) {
        const w = wachtend;
        wachtend = null;
        start(w.snapshot).then(w.resolve, w.reject);
      }
    };
    timer = setTimeout(geefVrij, maxWachtMs);
    resultaat.then(geefVrij, geefVrij);
    return resultaat;
  };

  const bewaar = (snapshot) => {
    if (!bezig) return start(snapshot);
    if (wachtend) {
      wachtend.snapshot = snapshot; // de recentste toestand wint
      return wachtend.promise;
    }
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    wachtend = { snapshot, promise, resolve, reject };
    return promise;
  };
  // true zolang er na de lopende beurt nog een recentere toestand klaarstaat — de wizard gebruikt
  // dit om niet voortijdig "opgeslagen" te tonen terwijl er nog een wijziging moet vertrekken
  bewaar.heeftWachtende = () => wachtend !== null;
  return bewaar;
}
