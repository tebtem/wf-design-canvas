/** Session codes skip look-alike characters (0/O, 1/I/L) so they are easy to read aloud and type. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function generateCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

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
