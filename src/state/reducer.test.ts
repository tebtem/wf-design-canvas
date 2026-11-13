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

describe('canvas details and drafts', () => {
  it('sets details and adds up to three drafts, removing the last one', () => {
    let s = reducer(initialState(), { type: 'setDetail', key: 'client', value: 'Acme' });
    expect(s.details.client).toBe('Acme');
    expect(s.draftCount).toBe(1);
    s = reducer(s, { type: 'addDraft' });
    s = reducer(s, { type: 'addDraft' });
    s = reducer(s, { type: 'addDraft' });
    expect(s.draftCount).toBe(3);
    s = reducer(s, { type: 'addBlock', draftId: 'd2', id: 'y', minutes: 10 });
    s = reducer(s, { type: 'addBlock', draftId: 'd3', id: 'z', minutes: 5 });
    s = reducer(s, { type: 'removeDraft' });
    expect(s.draftCount).toBe(2);
    expect(s.drafts.d3).toHaveLength(0);
    expect(s.drafts.d2).toHaveLength(1);
    s = reducer(s, { type: 'removeDraft' });
    s = reducer(s, { type: 'removeDraft' });
    expect(s.draftCount).toBe(1);
  });

  it('turns old cell text into a sticky and keeps draft 2 when it has blocks', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        cells: { 'brief.0': { text: ' Old purpose ', stickies: [{ id: 's', text: 'note', color: 'pink' }] } },
        drafts: { d1: [], d2: [{ id: 'b', minutes: 30, label: '' }] },
      }),
    );
    const s = loadState();
    expect(s.cells['brief.0'].stickies.map((x) => x.text)).toEqual(['Old purpose', 'note']);
    expect(s.cells['brief.0'].text).toBe('');
    expect(s.draftCount).toBe(2);
    expect(s.step).toBe(4);
    expect(s.details).toEqual({ title: '', client: '', participants: '' });
  });
});

describe('solo guide', () => {
  it('starts new canvases at step 0, advances, shows all, and starts over on reset', () => {
    let s = initialState();
    expect(s.step).toBe(0);
    s = reducer(s, { type: 'nextStep' });
    expect(s.step).toBe(1);
    s = reducer(s, { type: 'showAll' });
    expect(s.step).toBe(4);
    s = reducer(s, { type: 'nextStep' });
    expect(s.step).toBe(4);
    expect(reducer(s, { type: 'reset' }).step).toBe(0);
  });

  it('keeps column titles', () => {
    let s = reducer(initialState(), { type: 'setCellTitle', cellId: 'flow.0', title: 'Open' });
    saveState(s);
    s = loadState();
    expect(s.cells['flow.0'].title).toBe('Open');
  });
});

describe('block lengths', () => {
  it('snaps to 5-minute steps between 5 and 180', () => {
    let s = reducer(initialState(), { type: 'addBlock', draftId: 'd1', id: 'a', minutes: 15 });
    s = reducer(s, { type: 'setBlockMinutes', id: 'a', minutes: 23 });
    expect(s.drafts.d1[0].minutes).toBe(25);
    s = reducer(s, { type: 'setBlockMinutes', id: 'a', minutes: 1 });
    expect(s.drafts.d1[0].minutes).toBe(5);
    s = reducer(s, { type: 'setBlockMinutes', id: 'a', minutes: 999 });
    expect(s.drafts.d1[0].minutes).toBe(180);
  });

  it('colors blocks by length band', async () => {
    const { blockTone } = await import('./types');
    expect([5, 10, 15, 20, 25, 30, 40, 45, 60, 75, 90, 120, 180].map(blockTone)).toEqual([
      5, 10, 15, 20, 20, 30, 45, 45, 60, 60, 90, 90, 120,
    ]);
  });
});

describe('session outline', () => {
  it('keeps row text per block and falls back to draft 1 when its draft is removed', () => {
    let s = reducer(initialState(), { type: 'addDraft' });
    s = reducer(s, { type: 'addBlock', draftId: 'd2', id: 'b1', minutes: 15 });
    s = reducer(s, { type: 'setOutlineDraft', draft: 'd2' });
    s = reducer(s, { type: 'setOutlineRow', blockId: 'b1', field: 'moves', value: 'Markers' });
    expect(s.outline.rows.b1).toEqual({ activities: '', moves: 'Markers' });
    saveState(s);
    expect(loadState().outline.draft).toBe('d2');
    s = reducer(s, { type: 'removeDraft' });
    expect(s.outline.draft).toBe('d1');
  });
});

describe('backups', () => {
  it('round-trips a canvas and rejects other files', async () => {
    const { backupJson, readBackup, backupFileName } = await import('./backup');
    let s = reducer(initialState(), { type: 'setDetail', key: 'title', value: 'Q3 Offsite!' });
    s = reducer(s, { type: 'addSticky', cellId: 'ideas', id: 'x' });
    const back = readBackup(backupJson(s));
    expect(back?.state.details.title).toBe('Q3 Offsite!');
    expect(back?.state.cells.ideas.stickies).toHaveLength(1);
    expect(back?.savedAt).toBeTruthy();
    expect(readBackup('{"hello":1}')).toBeNull();
    expect(readBackup('not json')).toBeNull();
    expect(backupFileName(s, new Date('2026-11-12T10:00:00Z'))).toBe('q3-offsite-backup-2026-11-12.json');
  });
});

describe('clock times', () => {
  it('parses typed times and formats them', async () => {
    const { parseClock, hhmm } = await import('./types');
    expect(['9', '9:30', '09.30', '930', '1415', '0:05'].map(parseClock)).toEqual([540, 570, 570, 570, 855, 5]);
    expect(['', 'abc', '25:00', '9:75', '12345'].map(parseClock)).toEqual([null, null, null, null, null]);
    expect(hhmm(75)).toBe('01:15');
    expect(hhmm(1440 + 30)).toBe('00:30');
  });

  it('stores the session start time', () => {
    const s = reducer(initialState(), { type: 'setOutlineStart', start: 540 });
    expect(s.outline.start).toBe(540);
  });
});

describe('multi-day schedules', () => {
  it('starts each day fresh and totals days separately', async () => {
    const { schedule } = await import('./reducer');
    let s = initialState();
    s = reducer(s, { type: 'addBlock', draftId: 'd1', id: 'a', minutes: 60 });
    s = reducer(s, { type: 'addDay', draftId: 'd1', id: 'day2' });
    s = reducer(s, { type: 'addBlock', draftId: 'd1', id: 'b', minutes: 30 });
    s = reducer(s, { type: 'addBlock', draftId: 'd1', id: 'c', minutes: 15 });
    s = reducer(s, { type: 'setDayStart', id: 'day2', start: 510 });
    s = reducer(s, { type: 'setBlockMinutes', id: 'day2', minutes: 45 });
    const { slots, days } = schedule(s.drafts.d1, 540);
    expect(days.map((d) => [d.day, d.start, d.total])).toEqual([[1, 540, 60], [2, 510, 45]]);
    expect(slots.map((x) => [x.block.id, x.day, x.start])).toEqual([['a', 1, 540], ['day2', 2, 510], ['b', 2, 510], ['c', 2, 540]]);
    expect(totalMinutes(s.drafts.d1)).toBe(105);
    saveState(s);
    const back = loadState().drafts.d1;
    expect(back[1]).toEqual({ id: 'day2', kind: 'day', minutes: 0, label: '', notes: '', start: 510 });
  });
});

describe('rich text', () => {
  it('turns old plain text into paragraphs and bullets, safely', async () => {
    const { toRichHtml, richToText } = await import('../components/richText');
    expect(toRichHtml('Kickoff\n• Pairs <talk>\n• Share out')).toBe(
      '<p>Kickoff</p><ul><li><p>Pairs &lt;talk&gt;</p></li><li><p>Share out</p></li></ul>',
    );
    expect(toRichHtml('<h3>Title</h3>')).toBe('<h3>Title</h3>');
    expect(toRichHtml('  ')).toBe('');
    expect(richToText('<h3>Title</h3><ul><li><p>One</p></li></ul>')).toBe('Title\nOne');
  });
});

describe('backup reminder', () => {
  it('waits for real work, then reminds weekly unless snoozed', async () => {
    const { shouldRemindBackup, markBackedUp, snoozeBackupReminder, workAmount } = await import('./backup');
    window.localStorage.clear();
    let s = initialState();
    expect(shouldRemindBackup(s)).toBe(false);
    for (let i = 0; i < 8; i++) s = reducer(s, { type: 'addSticky', cellId: 'ideas', id: `s${i}` });
    expect(workAmount(s)).toBe(8);
    expect(shouldRemindBackup(s)).toBe(true);
    markBackedUp();
    expect(shouldRemindBackup(s)).toBe(false);
    expect(shouldRemindBackup(s, Date.now() + 8 * 86_400_000)).toBe(true);
    snoozeBackupReminder();
    expect(shouldRemindBackup(s, Date.now() + 8 * 86_400_000)).toBe(true);
    expect(shouldRemindBackup(s, Date.now() + 86_400_000)).toBe(false);
  });
});

describe('flow columns', () => {
  it('start at six, add and remove rows of six, and keep older canvases whole', () => {
    let s = initialState();
    expect(s.flowColumns).toBe(6);
    s = reducer(s, { type: 'addFlowRow' });
    expect(s.flowColumns).toBe(12);
    s = reducer(s, { type: 'addSticky', cellId: 'flow.8', id: 'x' });
    s = reducer(s, { type: 'removeFlowRow' });
    expect(s.flowColumns).toBe(6);
    expect(s.cells['flow.8']).toBeUndefined();
    for (let i = 0; i < 5; i++) s = reducer(s, { type: 'addFlowRow' });
    expect(s.flowColumns).toBe(24);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, cells: { 'flow.7': { text: '', stickies: [{ id: 'a', text: 'hi', color: 'yellow' }] } }, drafts: { d1: [], d2: [] } }),
    );
    expect(loadState().flowColumns).toBe(12);
  });
});
