// Tests voor de gebruiksvriendelijkheid (november 2026): voortgang per tabblad, het ⓘ-knopje bij
// vakjargon, "— kies —" i.p.v. stilzwijgende feiten bij een nieuw dossier, de vetusteit die eerst
// bepaald moet worden, de eenvoudige weergave ("Geavanceerd"), het startscherm, de volgorde van de
// tabbladen en de startgids op een leeg overzicht.
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { initialData, maakLeegPand, nieuwDossierBasis, NIEUW_NEUTRAAL_PAND } from "../constants.js";
import { berekenWaardering } from "../domein/waardering.js";
import { berekenKwaliteit, tabVoorControlepunt } from "../domein/kwaliteit.js";
import { voortgangPerTab, voortgangTekst, tabVanBlokkerendPunt } from "../domein/voortgang.js";
import { begripVoor } from "../domein/begrippen.js";
import { appStandaard } from "../domein/standaarden.js";
import { GROND } from "../domein/vastgoedtypes.js";
import { valideerDossier } from "../App.jsx";
import { Field, Select } from "../ui/velden.jsx";
import { Geavanceerd, WeergaveProvider } from "../ui/Weergave.jsx";
import { StartScherm, startKlaar } from "../schermen/StartScherm.jsx";
import { StepWaardering } from "../stappen/StepWaardering.jsx";
import { StepOpdracht } from "../stappen/StepOpdracht.jsx";

const lees = (f) => fs.readFileSync(path.join(process.cwd(), "src", f), "utf8");
const html = (el) => renderToStaticMarkup(el);
const h = React.createElement;

describe("fout in het kwaliteitspaneel", () => {
  it("bouwtype stuurt naar Type, staat & kadaster (niet naar Waardering)", () => {
    expect(tabVoorControlepunt("bouwtype (open/halfopen/gesloten) is nog niet gekozen")).toBe("type");
    // tegenproeven: de andere punten blijven waar ze waren
    expect(tabVoorControlepunt("grondoppervlakte ontbreekt")).toBe("afmetingen");
    expect(tabVoorControlepunt("venale waarde is nog 0")).toBe("waardering");
    expect(tabVoorControlepunt("vetusteit is nog niet bepaald — stel de vier factoren in of bevestig ze")).toBe("waardering");
  });
});

describe("voortgang per tabblad", () => {
  it("rood waar het verslag op wacht, een bolletje waar nog iets open staat, een vinkje als het volledig is", () => {
    const kwaliteit = { tabs: { opdracht: { criteria: 5, open: 1 }, type: { criteria: 4, open: 0 }, fotos: { criteria: 2, open: 2 } } };
    const v = voortgangPerTab(kwaliteit, ["Adres van het pand (straat en gemeente) — tabblad Type, staat & kadaster", "Vlabel-identificatienummer van de schatter-expert — vereist bij een nalatenschap"]);
    expect(v.type).toEqual({ status: "blokkeert", open: 0, blokkerend: 1 });
    expect(v.opdracht.status).toBe("blokkeert");
    expect(v.fotos).toEqual({ status: "open", open: 2, blokkerend: 0 });
    expect(voortgangTekst(v.fotos)).toBe("nog 2 punten open");
    expect(voortgangTekst(v.type)).toBe("1 punt nodig om het verslag te maken");
    // tegenproef: zonder blokkerende punten is Type volledig
    expect(voortgangPerTab(kwaliteit, []).type.status).toBe("klaar");
    expect(voortgangTekst({ status: "klaar" })).toBe("volledig");
  });
  it("blokkerende punten zonder tabblad in de tekst horen bij Opdracht & partijen", () => {
    expect(tabVanBlokkerendPunt("Datum overlijden (referentiedatum) — bepaalt de waarde bij een nalatenschap")).toBe("opdracht");
    expect(tabVanBlokkerendPunt("Datum van het verslag — tabblad Opdracht & partijen")).toBe("opdracht");
  });
  it("de kwaliteitsscore geeft per tabblad het aantal criteria en open punten", () => {
    const d = nieuwDossierBasis();
    const k = berekenKwaliteit(d, berekenWaardering(d), { blokkerend: valideerDossier(d).blokkerend });
    expect(k.tabs.opdracht.criteria).toBeGreaterThan(0);
    expect(k.tabs.markt.open).toBe(1); // de juridische keuzes staan nog op "— kies —"
    expect(k.tabs.afmetingen.open).toBeGreaterThan(0);
  });
});

describe("ⓘ bij vakjargon", () => {
  it("vindt de uitleg op basis van het veldlabel", () => {
    expect(begripVoor("CaPaKey").naam).toBe("CaPaKey");
    expect(begripVoor("KI (kadastraal inkomen)").naam).toBe("Kadastraal inkomen");
    expect(begripVoor("Yield van (%)").naam).toBe("Yield");
    expect(begripVoor("Coëff.").naam).toBe("Coëfficiënt");
    expect(begripVoor("Overstromingsgevoeligheid perceel (watertoets P-score)").naam).toBe("Watertoets");
    // tegenproeven: gewone velden krijgen niets
    expect(begripVoor("Straat")).toBeNull();
    expect(begripVoor("Datum plaatsbezoek")).toBeNull();
  });
  it("een veld toont het knopje, een gewoon veld niet; verplichte velden krijgen een sterretje", () => {
    const metUitleg = html(h(Field, { label: "CaPaKey" }, h("input")));
    expect(metUitleg).toContain('aria-label="Wat betekent CaPaKey?"');
    const zonder = html(h(Field, { label: "Straat", verplicht: true }, h("input")));
    expect(zonder).not.toContain("Wat betekent");
    expect(zonder).toContain('aria-label="verplicht"');
    expect(html(h(Field, { label: "CaPaKey", uitleg: false }, h("input")))).not.toContain("Wat betekent");
  });
});

describe("geen stilzwijgende feiten bij een nieuw dossier", () => {
  it("een nieuw dossier en een nieuw pand starten op — kies —, initialData blijft ongewijzigd", () => {
    const nieuw = nieuwDossierBasis();
    for (const k of ["reden", "opdrachtgeverAanwezig", "orientatie", "lift", "watertoetsP", "vergunning", "epcStatus", "gewestplan"]) expect(nieuw[k]).toBe("");
    expect(initialData.orientatie).toBe("Zuid"); // oudere dossiers worden met initialData aangevuld
    expect(initialData.reden).toBe("Nalatenschap");
    const pand = maakLeegPand("Lot 2");
    expect(pand.watertoetsG).toBe("");
    expect(pand.vetusteitBepaald).toBe(false);
    expect("reden" in pand).toBe(false);
    // "Mijn standaarden" toont dezelfde app-standaard als wat een nieuw dossier krijgt
    expect(appStandaard("hoofddakType")).toBe("");
    expect(appStandaard("gedwongenFactor")).toBe(initialData.gedwongenFactor);
  });
  it("een keuzelijst zonder keuze toont — kies — i.p.v. stil de eerste optie", () => {
    expect(html(h(Select, { options: ["Ja", "Nee"], value: "", onChange: () => {} }))).toContain('<option value="" selected="">— kies —</option>');
    expect(html(h(Select, { options: ["Ja", "Nee"], value: "Ja", onChange: () => {} }))).not.toContain("— kies —");
  });
  it("de reden van waardering is nodig voor het verslag, en wat nog op — kies — staat wordt gemeld", () => {
    const nieuw = { ...nieuwDossierBasis(), straat: "Kerkstraat", gemeente: "Temse", datumVerslag: "2026-11-27", referentiedatum: "2026-11-27", handtekening: "x" };
    const v = valideerDossier(nieuw);
    expect(v.blokkerend).toEqual(["Reden van waardering — tabblad Opdracht & partijen"]);
    expect(v.aandachtspunten).toContain("Nog niet gekozen: gewestplan, erfgoed, voorkooprecht, watertoets P-score, watertoets G-score, bouwmisdrijven, vergunning, verkaveling — tabblad Markt, stedenbouw & juridisch");
    expect(v.aandachtspunten).toContain("Nog niet gekozen: EPC — tabblad Constructie & isolatie");
    // tegenproef: een ouder dossier (met de vroegere standaardwaarden) krijgt geen nieuwe meldingen
    const oud = valideerDossier({ ...initialData, straat: "Kerkstraat", gemeente: "Temse", datumVerslag: "d", referentiedatum: "d", handtekening: "x", schatterVlabelNummer: "1" });
    expect(oud.blokkerend).toEqual([]);
    expect(oud.aandachtspunten.join("\n")).not.toContain("Nog niet gekozen");
    // grond: geen vergunning, G-score, EPC of keuring
    const grond = valideerDossier({ ...nieuwDossierBasis(), vastgoedType: GROND });
    const melding = grond.aandachtspunten.find((p) => p.startsWith("Nog niet gekozen")) || "";
    expect(melding).not.toContain("vergunning");
    expect(melding).not.toContain("G-score");
    expect(grond.aandachtspunten.join("\n")).not.toContain("EPC — tabblad");
  });
});

describe("vetusteit eerst bepalen", () => {
  it("een nieuw dossier: 0% en een open punt tot de vetusteit bepaald is", () => {
    const d = nieuwDossierBasis();
    const c = berekenWaardering(d);
    expect(c.totaalVetusiteit).toBe(0);
    expect(c.controlePunten).toContain("vetusteit is nog niet bepaald — stel de vier factoren in of bevestig ze");
    expect(berekenWaardering({ ...d, vetusteitBepaald: true }).controlePunten.join()).not.toContain("vetusteit");
    // tegenproeven: een ouder dossier (geen veld) en een grond krijgen het punt niet
    expect(berekenWaardering(initialData).controlePunten.join()).not.toContain("vetusteit");
    expect(berekenWaardering({ ...d, vastgoedType: GROND }).controlePunten.join()).not.toContain("vetusteit");
  });
  it("het tabblad Waardering toont de melding met een bevestigknop, en de uitkomst bovenaan", () => {
    const d = { ...nieuwDossierBasis(), extraPanden: [], parkeerplaatsenGarages: [] };
    const props = { d, set: () => () => {}, calc: berekenWaardering(d), parkeerplaatsenGarages: [], addParkeerplaats() {}, removeParkeerplaats() {}, updateParkeerplaats() {}, portefeuille: null };
    const scherm = html(h(StepWaardering, props));
    expect(scherm).toContain("De vetusteit is nog niet bepaald.");
    expect(scherm).toContain("Huidige waarden bevestigen");
    expect(scherm).toMatch(/class="waarde-balk[^"]*"/);
    expect(scherm.indexOf("waarde-balk")).toBeLessThan(scherm.indexOf("Vervangingswaarde (Abex)"));
    const bevestigd = html(h(StepWaardering, { ...props, d: { ...d, vetusteitBepaald: true } }));
    expect(bevestigd).not.toContain("De vetusteit is nog niet bepaald.");
    const bron = lees("stappen/StepWaardering.jsx");
    expect(bron).toContain('if (vetNietBepaald) set("vetusteitBepaald")(true);');
    for (const k of ["vetOuderdom", "vetFrequentie", "vetGebruik", "vetKwaliteit"]) expect(bron).toContain(`onChange={zetVet("${k}")}`);
  });
});

describe("eenvoudige weergave", () => {
  const kind = h("p", null, "DCF-velden");
  it("in de eenvoudige weergave ingeklapt, open als het al gebruikt wordt; de expertweergave toont alles", () => {
    const dicht = html(h(WeergaveProvider, { userId: "u1" }, h(Geavanceerd, { titel: "meerjaren-DCF" }, kind)));
    expect(dicht).toMatch(/<details class="geavanceerd[^"]*"/);
    expect(dicht).not.toMatch(/<details[^>]* open=""/);
    expect(dicht).toContain("DCF-velden"); // de inhoud blijft in de pagina, enkel ingeklapt
    const open = html(h(WeergaveProvider, { userId: "u1" }, h(Geavanceerd, { titel: "meerjaren-DCF", actief: true }, kind)));
    expect(open).toMatch(/<details[^>]* open=""/);
    expect(open).toContain("in gebruik");
    // zonder weergave-instelling (bv. buiten de wizard): alles zichtbaar zoals vroeger
    expect(html(h(Geavanceerd, { titel: "x" }, kind))).toBe("<p>DCF-velden</p>");
  });
  it("de optionele onderdelen van Waardering en Afmetingen staan onder Geavanceerd", () => {
    const w = lees("stappen/StepWaardering.jsx");
    expect(w).toContain('<Geavanceerd titel="kosten koper en meerjaren-DCF bij de rendementsbenadering"');
    expect(w).toContain('<Geavanceerd titel="marktmarge, gedwongen verkoop en energiecorrectie"');
    expect(w).toContain('<Geavanceerd titel="tweede klasse (mengen van twee Abex-klassen)" actief={!!d.klasse2}>');
    const a = lees("stappen/StepAfmetingen.jsx");
    expect(a).toContain('<Geavanceerd titel="residuele grondwaarde (sloop of herontwikkeling)" actief={!!d.residueelActief}>');
    expect(a).toContain('<Geavanceerd titel="aandeel gemeenschap (+12%)" actief={!!d.grondAandeelGemeenschapActief}>');
    // evenveel openende als sluitende tags
    for (const bron of [w, a]) expect((bron.match(/<Geavanceerd /g) || []).length).toBe((bron.match(/<\/Geavanceerd>/g) || []).length);
  });
});

describe("startscherm en volgorde", () => {
  it("een nieuw dossier vraagt eerst type, adres en reden", () => {
    const d = nieuwDossierBasis();
    expect(startKlaar(d)).toBe(false);
    expect(startKlaar({ ...d, straat: "Kerkstraat", gemeente: "Temse" })).toBe(false); // nog geen reden
    expect(startKlaar({ ...d, straat: "Kerkstraat", gemeente: "Temse", reden: "Verkoop" })).toBe(true);
    // grond zonder adres: CaPaKey + gemeente volstaan
    expect(startKlaar({ ...d, vastgoedType: GROND, capakey: "46021B0127/00A000", gemeente: "Temse", reden: "Verkoop" })).toBe(true);
    const scherm = html(h(StartScherm, { d, set: () => () => {}, onStart() {}, onOverslaan() {} }));
    for (const t of ["Wat schat je?", "Waar ligt het?", "Waarom en voor wie?", "Dossier starten", "Overslaan — later invullen"]) expect(scherm).toContain(t);
    expect(scherm).toMatch(/<button[^>]*disabled=""[^>]*>Dossier starten/);
  });
  it("de wizard toont het startscherm enkel bij een nieuw dossier, en Type staat vóór Ligging", () => {
    const wiz = lees("schermen/DossierWizard.jsx");
    expect(wiz).toContain("const [toonStart, setToonStart] = useState(!!nieuw);");
    const app = lees("App.jsx");
    expect(app).toContain("nieuw={activeDossier.id === nieuwDossierId}");
    expect(app).toContain("setNieuwDossierId(nieuwDossier.id);");
    const stappen = wiz.slice(wiz.indexOf("const steps = ["), wiz.indexOf("];", wiz.indexOf("const steps = [")));
    const sleutels = [...stappen.matchAll(/key: "([a-z-]+)"/g)].map((m) => m[1]);
    expect(sleutels.indexOf("type")).toBeLessThan(sleutels.indexOf("ligging"));
    expect(sleutels.slice(0, 5)).toEqual(["documenten", "opdracht", "panden", "type", "ligging"]);
  });
  it("de zijbalk toont de voortgang en de stap", () => {
    const wiz = lees("schermen/DossierWizard.jsx");
    expect(wiz).toContain("const voortgang = useMemo(() => voortgangPerTab(kwaliteit, blokkerend), [kwaliteit, blokkerend]);");
    expect(wiz).toContain('{v && v.status && v.status !== "klaar" && <span className={`stap-status stap-status-${v.status}`} />}');
    expect(wiz).toContain('{vTekst && <span className="sr-only">({vTekst})</span>}');
    expect(wiz).toContain("<span>Stap {step + 1} van {steps.length}</span>");
    expect(wiz).not.toMatch(/fontWeight: active \? 500 : 400, whiteSpace: "nowrap"/); // lange namen lopen niet meer buiten de balk
  });
});

describe("minder dubbel werk en minder tekst vóór de actie", () => {
  it("de gegevens van de schatter-expert staan samengevat als ze ingevuld zijn", () => {
    const props = { set: () => () => {}, addEigenaar() {}, removeEigenaar() {}, updateEigenaar() {} };
    const d = { ...initialData, reden: "Verkoop", schatterNaam: "Thijs Houpels", schatterTitel: "Schatter-expert", schatterBivNummer: "516660" };
    const samengevat = html(h(StepOpdracht, { ...props, d }));
    expect(samengevat).toContain("Thijs Houpels · Schatter-expert · BIV 516660");
    expect(samengevat).toContain("Wijzigen");
    expect(samengevat).not.toContain("Naam schatter-expert");
    // tegenproef: bij een nalatenschap zonder Vlabel-nummer staat alles open
    const open = html(h(StepOpdracht, { ...props, d: { ...d, reden: "Nalatenschap", schatterVlabelNummer: "" } }));
    expect(open).toContain("Naam schatter-expert");
    expect(open).not.toContain("Wijzigen");
  });
  it("de kadastrale oppervlakte kan overgenomen worden als grondoppervlakte", () => {
    const a = lees("stappen/StepAfmetingen.jsx");
    expect(a).toContain('set("grondopp")(String(d.kadastraleOpp));');
    expect(a).toContain("Kadastrale oppervlakte overnemen (");
  });
  it("Documenten: één zin uitleg, de rest achter Meer uitleg", () => {
    const docs = lees("stappen/StepDocumenten.jsx");
    expect(docs).toContain("<Uitleg kort={<>");
    expect(docs.indexOf("<Uitleg kort")).toBeLessThan(docs.indexOf("Sneller en goedkoper verwerken"));
  });
  it("een leeg overzicht toont een startgids", () => {
    const dash = lees("schermen/Dashboard.jsx");
    expect(dash).toContain("{index.length === 0 && <StartGids onNew={onNew} />}");
  });
});
