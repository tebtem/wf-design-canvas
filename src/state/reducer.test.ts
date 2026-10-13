import { describe, expect, it } from 'vitest';
import { formatMinutes, initialState, reducer, totalMinutes } from './reducer';
import { loadState, saveState, STORAGE_KEY } from './persist';

const withBlocks = () => {
  let s = initialState();
  s = reducer(s, { type: 'addBlock', draftId: 'd1', id: 'a', minutes: 15 });
  s = reducer(s, { type: 'addBlock', draftId: 'd1', id: 'b', minutes: 30 });
  s = reducer(s, { type: 'addBlock', draftId: 'd1', id: 'c', minutes: 60, index: 0 });
  return s;
};

describe('time blocks', () => {
  it('adds blocks at the end or at an index', () => {
    expect(withBlocks().drafts.d1.map((b) => b.id)).toEqual(['c', 'a', 'b']);
  });

  it('reorders within a draft', () => {
    const s = reducer(withBlocks(), { type: 'moveBlock', id: 'c', toDraft: 'd1', toIndex: 2 });
    expect(s.drafts.d1.map((b) => b.id)).toEqual(['a', 'b', 'c']);
  });

  it('moves between drafts', () => {
    const s = reducer(withBlocks(), { type: 'moveBlock', id: 'a', toDraft: 'd2', toIndex: 99 });
    expect(s.drafts.d1.map((b) => b.id)).toEqual(['c', 'b']);
    expect(s.drafts.d2.map((b) => b.id)).toEqual(['a']);
  });

  it('labels and removes blocks', () => {
    let s = reducer(withBlocks(), { type: 'editBlockLabel', id: 'b', label: 'Check-in' });
    expect(s.drafts.d1[2].label).toBe('Check-in');
    s = reducer(s, { type: 'removeBlock', id: 'b' });
    expect(s.drafts.d1).toHaveLength(2);
  });

  it('totals and formats minutes', () => {
    expect(totalMinutes(withBlocks().drafts.d1)).toBe(105);
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(105)).toBe('1 hr 45 min');
    expect(formatMinutes(120)).toBe('2 hr');
  });
});

describe('cells and stickies', () => {
  it('sets text and manages stickies', () => {
    let s = reducer(initialState(), { type: 'setText', cellId: 'brief.0', text: 'Hello' });
    s = reducer(s, { type: 'addSticky', cellId: 'brief.0', id: 's1' });
    s = reducer(s, { type: 'editSticky', cellId: 'brief.0', id: 's1', text: 'Note', color: 'pink' });
    expect(s.cells['brief.0']).toEqual({ text: 'Hello', stickies: [{ id: 's1', text: 'Note', color: 'pink' }] });
    s = reducer(s, { type: 'deleteSticky', cellId: 'brief.0', id: 's1' });
    expect(s.cells['brief.0'].stickies).toEqual([]);
  });
});

describe('persistence', () => {
  it('round-trips through localStorage', () => {
    const s = withBlocks();
    expect(saveState(s)).toBe(true);
    expect(loadState()).toEqual(s);
  });

  it('falls back to an empty canvas on bad data', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toEqual(initialState());
  });
});
