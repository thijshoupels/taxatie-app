// Tests voor de pure helpers in data/dossiers.js. Focus hier op verwijderNulBytes: de sanitizer
// die voorkomt dat een letterlijk NUL-teken (\u0000) — bv. afkomstig uit een door de AI uitgelezen
// PDF, of geplakte tekst uit een ander programma — de opslag naar Supabase laat mislukken met
// "Opslaan mislukt: unsupported Unicode escape sequence" (de Postgres-foutmelding voor precies dit
// teken in tekst-/jsonb-kolommen).
//
// Draai met: npm test (of "npx vitest" tijdens het ontwikkelen, voor een watch-modus).
import { describe, it, expect } from "vitest";
import { verwijderNulBytes, magTerugvallenOpUpsert } from "../data/dossiers.js";

describe("verwijderNulBytes", () => {
  it("verwijdert een NUL-teken uit een gewone string", () => {
    expect(verwijderNulBytes("Voorgevel\u0000 in goede staat")).toBe("Voorgevel in goede staat");
  });

  it("verwijdert meerdere NUL-tekens uit dezelfde string", () => {
    expect(verwijderNulBytes("a\u0000b\u0000c")).toBe("abc");
  });

  it("laat een gewone string zonder NUL-teken ongewijzigd", () => {
    expect(verwijderNulBytes("Kadastraal inkomen: 850 euro")).toBe("Kadastraal inkomen: 850 euro");
  });

  it("laat getallen, booleans, null en undefined ongewijzigd", () => {
    expect(verwijderNulBytes(1234)).toBe(1234);
    expect(verwijderNulBytes(true)).toBe(true);
    expect(verwijderNulBytes(false)).toBe(false);
    expect(verwijderNulBytes(null)).toBeNull();
    expect(verwijderNulBytes(undefined)).toBeUndefined();
  });

  it("verwijdert NUL-tekens diep genest in een array van objecten", () => {
    const input = [
      { naam: "Woonkamer", omschrijving: "Ruime living\u0000 met haard" },
      { naam: "Keuken", omschrijving: "Recent gerenoveerd" },
    ];
    const resultaat = verwijderNulBytes(input);
    expect(resultaat[0].omschrijving).toBe("Ruime living met haard");
    expect(resultaat[1].omschrijving).toBe("Recent gerenoveerd");
  });

  it("verwijdert NUL-tekens in extraPanden-achtige, meervoudig geneste structuren", () => {
    const input = {
      extraPanden: [
        { naam: "Pand 2", notitie: "AI-uitlezing:\u0000 garage met poort", kamers: [{ label: "Garage\u0000" }] },
      ],
    };
    const resultaat = verwijderNulBytes(input);
    expect(resultaat.extraPanden[0].notitie).toBe("AI-uitlezing: garage met poort");
    expect(resultaat.extraPanden[0].kamers[0].label).toBe("Garage");
  });

  it("saneert een dossier-achtige payload (zoals basisPayload/media) klaar voor Supabase", () => {
    const payload = {
      id: "abc-123",
      straat: "Kerkstraat",
      data: {
        notities: "Bijkomende opmerking\u0000 van de schatter",
        aiVoorstellen: { samenvatting: "Samenvatting\u0000 uit PDF" },
      },
    };
    const resultaat = verwijderNulBytes(payload);
    expect(resultaat.id).toBe("abc-123");
    expect(resultaat.data.notities).toBe("Bijkomende opmerking van de schatter");
    expect(resultaat.data.aiVoorstellen.samenvatting).toBe("Samenvatting uit PDF");
  });

  it("verandert niets aan een structuur die toch al geen NUL-tekens bevat", () => {
    const payload = { id: "1", data: { straat: "Dorpsstraat", nummer: "5" } };
    expect(verwijderNulBytes(payload)).toEqual(payload);
  });
});

describe("magTerugvallenOpUpsert", () => {
  // De onvoorwaardelijke upsert na een mislukte voorwaardelijke UPDATE is enkel bedoeld voor een
  // nog ontbrekende "media"-kolom. Bij een time-out of serverfout mag het (tot 5 MB+ grote) dossier
  // NIET meteen een tweede keer vertrekken — dat verergerde de overbelasting en omzeilde de
  // botsingscontrole.
  it("valt terug bij een fout over de ontbrekende media-kolom", () => {
    expect(magTerugvallenOpUpsert({ message: 'column "media" of relation "dossiers" does not exist' })).toBe(true);
  });
  it("valt NIET terug bij een statement- of lock-time-out", () => {
    expect(magTerugvallenOpUpsert({ message: "canceling statement due to statement timeout" })).toBe(false);
    expect(magTerugvallenOpUpsert({ message: "canceling statement due to lock timeout" })).toBe(false);
  });
  it("valt NIET terug bij een andere serverfout", () => {
    expect(magTerugvallenOpUpsert({ message: "Internal Server Error" })).toBe(false);
  });
  it("valt wel terug zonder fout (rij bestaat niet meer → opnieuw aanmaken)", () => {
    expect(magTerugvallenOpUpsert(null)).toBe(true);
  });
});
