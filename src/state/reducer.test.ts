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
    let s = reducer(withBlocks(), { type: 'editBlock', id: 'b', label: 'Check-in' });
    s = reducer(s, { type: 'editBlock', id: 'b', notes: '• Pairs\n• Share out' });
    expect(s.drafts.d1[2]).toMatchObject({ label: 'Check-in', notes: '• Pairs\n• Share out' });
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

describe('moving stickies', () => {
  const twoCells = () => {
    let s = initialState();
    for (const id of ['a', 'b', 'c']) s = reducer(s, { type: 'addSticky', cellId: 'x', id });
    return reducer(s, { type: 'addSticky', cellId: 'y', id: 'd' });
  };
  const ids = (s: ReturnType<typeof initialState>, cell: string) => s.cells[cell].stickies.map((st) => st.id);

  it('reorders within a cell', () => {
    const s = reducer(twoCells(), { type: 'moveSticky', id: 'a', toCell: 'x', toIndex: 2 });
    expect(ids(s, 'x')).toEqual(['b', 'c', 'a']);
  });

  it('moves to another cell, including an empty one', () => {
    let s = reducer(twoCells(), { type: 'moveSticky', id: 'b', toCell: 'y', toIndex: 0 });
    expect(ids(s, 'x')).toEqual(['a', 'c']);
    expect(ids(s, 'y')).toEqual(['b', 'd']);
    s = reducer(s, { type: 'moveSticky', id: 'd', toCell: 'z', toIndex: 5 });
    expect(ids(s, 'z')).toEqual(['d']);
  });

  it('keeps text and color when moving', () => {
    let s = reducer(twoCells(), { type: 'editSticky', cellId: 'x', id: 'a', text: 'Hi', color: 'blue' });
    s = reducer(s, { type: 'moveSticky', id: 'a', toCell: 'y', toIndex: 1 });
    expect(s.cells.y.stickies[1]).toEqual({ id: 'a', text: 'Hi', color: 'blue' });
  });
});

describe('persistence', () => {
  it('round-trips through localStorage', () => {
    const s = withBlocks();
    expect(saveState(s)).toBe(true);
    expect(loadState()).toEqual(s);
  });

  it('adds empty notes to blocks saved before notes existed', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, cells: {}, drafts: { d1: [{ id: 'a', minutes: 15, label: 'x' }], d2: [] } }),
    );
    expect(loadState().drafts.d1[0].notes).toBe('');
  });

  it('migrates retired sticky colors', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, drafts: { d1: [], d2: [] }, cells: { x: { text: '', stickies: [{ id: 's', text: '', color: 'green' }] } } }),
    );
    expect(loadState().cells.x.stickies[0].color).toBe('orange');
  });

  it('falls back to an empty canvas on bad data', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadState()).toEqual(initialState());
  });
});
