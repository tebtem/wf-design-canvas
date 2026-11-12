import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, formatCode, generateCode, normalizeCode, spellCode } from './code';
import { summarize, timeAgo } from './summary';
import { initialState, reducer } from '../state/reducer';

describe('session codes', () => {
  it('generates 6 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
      expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    }
  });

  it('accepts lower case, spaces and dashes', () => {
    expect(normalizeCode(' abc-234 ')).toBe('ABC234');
    expect(normalizeCode('ab c2 34')).toBe('ABC234');
  });

  it('rejects wrong lengths and look-alike characters', () => {
    expect(normalizeCode('ABC23')).toBeNull();
    expect(normalizeCode('ABC2345')).toBeNull();
    expect(normalizeCode('ABC10O')).toBeNull();
  });

  it('formats for display and screen readers', () => {
    expect(formatCode('ABC234')).toBe('ABC-234');
    expect(spellCode('AB2')).toBe('A B 2');
  });
});

describe('summarize', () => {
  it('counts filled sections, stickies and draft totals', () => {
    let s = initialState();
    s = reducer(s, { type: 'setText', cellId: 'brief.0', text: 'Purpose' });
    s = reducer(s, { type: 'setText', cellId: 'brief.1', text: '   ' });
    s = reducer(s, { type: 'addSticky', cellId: 'ideas', id: 'a' });
    s = reducer(s, { type: 'addSticky', cellId: 'ideas', id: 'b' });
    s = reducer(s, { type: 'addBlock', draftId: 'd1', id: 'x', minutes: 45 });
    s = reducer(s, { type: 'addBlock', draftId: 'd1', id: 'y', minutes: 30 });
    expect(summarize(s)).toEqual({ filled: 2, stickies: 2, drafts: ['1 hr 15 min'] });
  });
});

describe('timeAgo', () => {
  it('describes recent times in words', () => {
    const now = 1_000_000_000;
    expect(timeAgo(now - 10_000, now)).toBe('just now');
    expect(timeAgo(now - 3 * 60_000, now)).toBe('3 minutes ago');
    expect(timeAgo(now - 2 * 3_600_000, now)).toBe('2 hours ago');
  });
});

describe('rejoin codes', () => {
  it('generates and normalizes 8-character codes', async () => {
    const { generateRejoinCode, normalizeRejoinCode, formatRejoinCode } = await import('./code');
    const k = generateRejoinCode();
    expect(k).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    expect(normalizeRejoinCode(` ${formatRejoinCode(k).toLowerCase()} `)).toBe(k);
    expect(normalizeRejoinCode('ABC')).toBeNull();
    expect(formatRejoinCode('KQ7MX3PA')).toBe('KQ7M-X3PA');
  });
});
