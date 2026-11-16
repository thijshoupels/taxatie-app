// ----------------------------------------------------------------------------
// domein/kbo.js — ondernemingsnummer (KBO) schrijven en nakijken
// ----------------------------------------------------------------------------
// Een Belgisch ondernemingsnummer heeft 10 cijfers (oudere nummers met 9 cijfers krijgen een 0
// vooraan), geschreven als 0123.456.789; de laatste twee cijfers zijn een controlegetal:
// 97 − (de eerste 8 cijfers modulo 97). "BE" vooraan (btw-nummer) mag, spaties en punten ook.
// Pure functies — apart testbaar (zie __tests__/kbo.test.js).

export function kboCijfers(invoer) {
  const c = String(invoer || "").toUpperCase().replace(/^BE/, "").replace(/[^0-9]/g, "");
  return c.length === 9 ? "0" + c : c;
}

export function isGeldigKbo(invoer) {
  const c = kboCijfers(invoer);
  if (c.length !== 10) return false;
  return 97 - (Number(c.slice(0, 8)) % 97) === Number(c.slice(8));
}

// netjes geschreven (0123.456.789) als het een geldig nummer is, anders de invoer ongewijzigd
export function schrijfKbo(invoer) {
  if (!isGeldigKbo(invoer)) return String(invoer || "").trim();
  const c = kboCijfers(invoer);
  return `${c.slice(0, 4)}.${c.slice(4, 7)}.${c.slice(7)}`;
}
