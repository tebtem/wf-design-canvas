import { clampMinutes, DRAFT_IDS, MAX_DRAFTS } from './types';
import { FLOW_MAX, FLOW_ROW, LAST_STEP } from './cells';
import type { BlockMinutes, CanvasDetails, CanvasState, Cell, DraftId, OutlineRow, StickyColor, TimeBlock } from './types';

export type Action =
  | { type: 'setText'; cellId: string; text: string }
  | { type: 'addSticky'; cellId: string; id: string; color?: StickyColor }
  | { type: 'editSticky'; cellId: string; id: string; text?: string; color?: StickyColor }
  | { type: 'deleteSticky'; cellId: string; id: string }
  | { type: 'moveSticky'; id: string; toCell: string; toIndex: number }
  | { type: 'addBlock'; draftId: DraftId; id: string; minutes: BlockMinutes; index?: number; isBreak?: boolean }
  | { type: 'moveBlock'; id: string; toDraft: DraftId; toIndex: number }
  | { type: 'editBlock'; id: string; label?: string; notes?: string }
  | { type: 'removeBlock'; id: string }
  | { type: 'setBlockMinutes'; id: string; minutes: number }
  | { type: 'setBreak'; id: string; isBreak: boolean }
  | { type: 'addDay'; draftId: DraftId; id: string }
  | { type: 'setDayStart'; id: string; start: number }
  | { type: 'setDetail'; key: keyof CanvasDetails; value: string }
  | { type: 'setCellTitle'; cellId: string; title: string }
  | { type: 'nextStep' }
  | { type: 'showAll' }
  | { type: 'setOutlineDraft'; draft: DraftId }
  | { type: 'setOutlineStart'; start: number }
  | { type: 'setOutlineRow'; blockId: string; field: keyof OutlineRow; value: string }
  | { type: 'load'; state: CanvasState }
  | { type: 'addFlowRow' }
  | { type: 'removeFlowRow' }
  | { type: 'addDraft' }
  | { type: 'removeDraft' }
  | { type: 'reset' };

export const emptyDetails = (): CanvasDetails => ({ title: '', client: '', participants: '' });

export const initialState = (): CanvasState => ({
  version: 1,
  details: emptyDetails(),
  cells: {},
  drafts: { d1: [], d2: [], d3: [] },
  draftCount: 1,
  outline: { draft: 'd1', start: 0, rows: {} },
  flowColumns: FLOW_ROW,
  // A brand-new canvas starts guided; Clear canvas starts the guide over.
  step: 0,
});

/** Drafts currently on screen. */
export const visibleDrafts = (state: CanvasState): DraftId[] => DRAFT_IDS.slice(0, state.draftCount);

const emptyCell: Cell = { text: '', stickies: [] };

function updateCell(state: CanvasState, cellId: string, fn: (c: Cell) => Cell): CanvasState {
  const current = state.cells[cellId] ?? emptyCell;
  return { ...state, cells: { ...state.cells, [cellId]: fn(current) } };
}

export function findBlock(state: CanvasState, id: string): { draftId: DraftId; index: number } | null {
  for (const draftId of Object.keys(state.drafts) as DraftId[]) {
    const index = state.drafts[draftId].findIndex((b) => b.id === id);
    if (index !== -1) return { draftId, index };
  }
  return null;
}

export function findSticky(state: CanvasState, id: string): { cellId: string; index: number } | null {
  for (const [cellId, cell] of Object.entries(state.cells)) {
    const index = cell.stickies.findIndex((s) => s.id === id);
    if (index !== -1) return { cellId, index };
  }
  return null;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function totalMinutes(blocks: TimeBlock[]): number {
  return blocks.reduce((sum, b) => sum + b.minutes, 0);
}

export { hhmm as hhmmOf } from './types';

export interface Slot {
  block: TimeBlock;
  /** 1-based day number. */
  day: number;
  /** Clock time in minutes after midnight (may pass 24:00 on very long days). */
  start: number;
}

export interface DayInfo {
  day: number;
  start: number;
  total: number;
  /** Minutes of that day spent on breaks. */
  breaks: number;
  /** The divider that starts this day (none for Day 1). */
  divider?: TimeBlock;
}

/**
 * Works out each block's day and clock time. Day dividers start a new day whose clock begins at the
 * divider's start time (or Day 1's start when none is set).
 */
export function schedule(blocks: TimeBlock[], day1Start: number): { slots: Slot[]; days: DayInfo[] } {
  const days: DayInfo[] = [{ day: 1, start: day1Start, total: 0, breaks: 0 }];
  const slots: Slot[] = [];
  let clock = day1Start;
  for (const b of blocks) {
    if (b.kind === 'day') {
      const start = b.start ?? day1Start;
      days.push({ day: days.length + 1, start, total: 0, breaks: 0, divider: b });
      clock = start;
      slots.push({ block: b, day: days.length, start });
      continue;
    }
    slots.push({ block: b, day: days.length, start: clock });
    days[days.length - 1].total += b.minutes;
    if (b.isBreak) days[days.length - 1].breaks += b.minutes;
    clock += b.minutes;
  }
  return { slots, days };
}

export const breakMinutes = (blocks: TimeBlock[]) =>
  blocks.reduce((sum, b) => sum + (b.isBreak && b.kind !== 'day' ? b.minutes : 0), 0);

/** "3 hr" or "3 hr · 45 min of breaks". */
export const totalWithBreaks = (total: number, breaks: number) =>
  breaks > 0 ? `${formatMinutes(total)} · ${formatMinutes(breaks)} of breaks` : formatMinutes(total);

export function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function reducer(state: CanvasState, action: Action): CanvasState {
  switch (action.type) {
    case 'setText':
      return updateCell(state, action.cellId, (c) => ({ ...c, text: action.text }));

    case 'addSticky':
      return updateCell(state, action.cellId, (c) => ({
        ...c,
        stickies: [...c.stickies, { id: action.id, text: '', color: action.color ?? 'yellow' }],
      }));

    case 'editSticky':
      return updateCell(state, action.cellId, (c) => ({
        ...c,
        stickies: c.stickies.map((s) =>
          s.id === action.id
            ? { ...s, text: action.text ?? s.text, color: action.color ?? s.color }
            : s,
        ),
      }));

    case 'deleteSticky':
      return updateCell(state, action.cellId, (c) => ({
        ...c,
        stickies: c.stickies.filter((s) => s.id !== action.id),
      }));

    case 'moveSticky': {
      const loc = findSticky(state, action.id);
      if (!loc) return state;
      const sticky = state.cells[loc.cellId].stickies[loc.index];
      const removed = updateCell(state, loc.cellId, (c) => ({
        ...c,
        stickies: c.stickies.filter((s) => s.id !== action.id),
      }));
      return updateCell(removed, action.toCell, (c) => {
        const list = [...c.stickies];
        list.splice(clamp(action.toIndex, 0, list.length), 0, sticky);
        return { ...c, stickies: list };
      });
    }

    case 'addBlock': {
      const list = [...state.drafts[action.draftId]];
      const index = clamp(action.index ?? list.length, 0, list.length);
      const block: TimeBlock = { id: action.id, minutes: clampMinutes(action.minutes), label: '', notes: '' };
      if (action.isBreak) block.isBreak = true;
      list.splice(index, 0, block);
      return { ...state, drafts: { ...state.drafts, [action.draftId]: list } };
    }

    case 'moveBlock': {
      const loc = findBlock(state, action.id);
      if (!loc) return state;
      const drafts = { ...state.drafts, [loc.draftId]: [...state.drafts[loc.draftId]] };
      const [block] = drafts[loc.draftId].splice(loc.index, 1);
      const target = loc.draftId === action.toDraft ? drafts[loc.draftId] : [...drafts[action.toDraft]];
      target.splice(clamp(action.toIndex, 0, target.length), 0, block);
      drafts[action.toDraft] = target;
      return { ...state, drafts };
    }

    case 'editBlock': {
      const loc = findBlock(state, action.id);
      if (!loc) return state;
      const list = state.drafts[loc.draftId].map((b) =>
        b.id === action.id
          ? { ...b, label: action.label ?? b.label, notes: action.notes ?? b.notes }
          : b,
      );
      return { ...state, drafts: { ...state.drafts, [loc.draftId]: list } };
    }

    case 'setBlockMinutes': {
      const loc = findBlock(state, action.id);
      if (!loc) return state;
      const minutes = clampMinutes(action.minutes);
      const list = state.drafts[loc.draftId].map((b) => (b.id === action.id && b.kind !== 'day' ? { ...b, minutes } : b));
      return { ...state, drafts: { ...state.drafts, [loc.draftId]: list } };
    }

    case 'setBreak': {
      const loc = findBlock(state, action.id);
      if (!loc) return state;
      const list = state.drafts[loc.draftId].map((b) => {
        if (b.id !== action.id || b.kind === 'day') return b;
        const next = { ...b };
        if (action.isBreak) next.isBreak = true;
        else delete next.isBreak;
        return next;
      });
      return { ...state, drafts: { ...state.drafts, [loc.draftId]: list } };
    }

    case 'addDay': {
      const list = [...state.drafts[action.draftId], { id: action.id, kind: 'day' as const, minutes: 0, label: '', notes: '' }];
      return { ...state, drafts: { ...state.drafts, [action.draftId]: list } };
    }

    case 'setDayStart': {
      const loc = findBlock(state, action.id);
      if (!loc) return state;
      const start = ((Math.round(action.start) % 1440) + 1440) % 1440;
      const list = state.drafts[loc.draftId].map((b) => (b.id === action.id ? { ...b, start } : b));
      return { ...state, drafts: { ...state.drafts, [loc.draftId]: list } };
    }

    case 'removeBlock': {
      const loc = findBlock(state, action.id);
      if (!loc) return state;
      const list = state.drafts[loc.draftId].filter((b) => b.id !== action.id);
      return { ...state, drafts: { ...state.drafts, [loc.draftId]: list } };
    }

    case 'setDetail':
      return { ...state, details: { ...state.details, [action.key]: action.value } };

    case 'setCellTitle':
      return updateCell(state, action.cellId, (c) => ({ ...c, title: action.title }));

    case 'nextStep':
      return { ...state, step: Math.min(LAST_STEP, state.step + 1) };

    case 'showAll':
      return { ...state, step: LAST_STEP };

    case 'setOutlineDraft':
      return { ...state, outline: { ...state.outline, draft: action.draft } };

    case 'setOutlineStart':
      return { ...state, outline: { ...state.outline, start: ((Math.round(action.start) % 1440) + 1440) % 1440 } };

    case 'setOutlineRow': {
      const row = state.outline.rows[action.blockId] ?? { activities: '', moves: '' };
      return {
        ...state,
        outline: { ...state.outline, rows: { ...state.outline.rows, [action.blockId]: { ...row, [action.field]: action.value } } },
      };
    }

    case 'load':
      return action.state;

    case 'addFlowRow':
      return { ...state, flowColumns: Math.min(FLOW_MAX, state.flowColumns + FLOW_ROW) };

    case 'removeFlowRow': {
      if (state.flowColumns <= FLOW_ROW) return state;
      const next = state.flowColumns - FLOW_ROW;
      // Clear the removed columns so they come back empty if added again.
      const cells = Object.fromEntries(
        Object.entries(state.cells).filter(([id]) => !(id.startsWith('flow.') && Number(id.slice(5)) >= next)),
      );
      return { ...state, flowColumns: next, cells };
    }

    case 'addDraft':
      return { ...state, draftCount: Math.min(MAX_DRAFTS, state.draftCount + 1) };

    case 'removeDraft':
    {
      // Only the last draft can be removed, so the remaining drafts keep their numbers.
      if (state.draftCount <= 1) return state;
      const last = DRAFT_IDS[state.draftCount - 1];
      const outline = state.outline.draft === last ? { ...state.outline, draft: 'd1' as DraftId } : state.outline;
      return { ...state, draftCount: state.draftCount - 1, drafts: { ...state.drafts, [last]: [] }, outline };
    }

    case 'reset':
      return initialState();
  }
}
