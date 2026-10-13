import type { BlockMinutes, CanvasState, Cell, DraftId, StickyColor, TimeBlock } from './types';

export type Action =
  | { type: 'setText'; cellId: string; text: string }
  | { type: 'addSticky'; cellId: string; id: string; color?: StickyColor }
  | { type: 'editSticky'; cellId: string; id: string; text?: string; color?: StickyColor }
  | { type: 'deleteSticky'; cellId: string; id: string }
  | { type: 'addBlock'; draftId: DraftId; id: string; minutes: BlockMinutes; index?: number }
  | { type: 'moveBlock'; id: string; toDraft: DraftId; toIndex: number }
  | { type: 'editBlock'; id: string; label?: string; notes?: string }
  | { type: 'removeBlock'; id: string }
  | { type: 'reset' };

export const initialState = (): CanvasState => ({
  version: 1,
  cells: {},
  drafts: { d1: [], d2: [] },
});

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

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function totalMinutes(blocks: TimeBlock[]): number {
  return blocks.reduce((sum, b) => sum + b.minutes, 0);
}

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

    case 'addBlock': {
      const list = [...state.drafts[action.draftId]];
      const index = clamp(action.index ?? list.length, 0, list.length);
      list.splice(index, 0, { id: action.id, minutes: action.minutes, label: '', notes: '' });
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

    case 'removeBlock': {
      const loc = findBlock(state, action.id);
      if (!loc) return state;
      const list = state.drafts[loc.draftId].filter((b) => b.id !== action.id);
      return { ...state, drafts: { ...state.drafts, [loc.draftId]: list } };
    }

    case 'reset':
      return initialState();
  }
}
