/** Session codes skip look-alike characters (0/O, 1/I/L) so they are easy to read aloud and type. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function generateCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

export const REJOIN_LENGTH = 8;

/** A participant's personal code for getting back to their canvas on another device. */
export const generateRejoinCode = (random: () => number = Math.random) =>
  Array.from({ length: REJOIN_LENGTH }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('');

/** Accepts "kq7m-x3pa" and similar; returns "KQ7MX3PA" or null. */
export function normalizeRejoinCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  return code.length === REJOIN_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

/** "KQ7MX3PA" -> "KQ7M-X3PA". */
export const formatRejoinCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Accepts what people type ("abc-234", "ABC 234") and returns the canonical code, or null. */
export function normalizeCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  return [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

/** "ABC234" -> "ABC-234" for display. */
export const formatCode = (code: string) => `${code.slice(0, 3)}-${code.slice(3)}`;

/** "ABC234" -> "A B C 2 3 4" so screen readers spell it out. */
export const spellCode = (code: string) => [...code].join(' ');
