import { initialState } from './reducer';
import { STICKY_COLORS, type CanvasState, type Cell, type TimeBlock } from './types';

/** Blocks saved before notes existed get an empty notes field. */
const migrateBlocks = (blocks: TimeBlock[] = []) => blocks.map((b) => ({ ...b, notes: b.notes ?? '' }));

/** Keep stickies saved with a color that no longer exists (e.g. the old "green") readable. */
function migrateCells(cells: Record<string, Cell>): Record<string, Cell> {
  return Object.fromEntries(
    Object.entries(cells).map(([id, c]) => [
      id,
      { ...c, stickies: c.stickies.map((st) => (STICKY_COLORS.includes(st.color) ? st : { ...st, color: 'orange' })) },
    ]),
  );
}

export const STORAGE_KEY = 'wf-design-canvas:v1';

/** Parse saved canvas JSON. Returns null when it is missing or not a canvas. */
export function parseState(raw: string | null | undefined): CanvasState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CanvasState>;
    if (parsed?.version !== 1 || typeof parsed.cells !== 'object' || !parsed.drafts) return null;
    return {
      version: 1,
      cells: migrateCells(parsed.cells ?? {}),
      drafts: { d1: migrateBlocks(parsed.drafts.d1), d2: migrateBlocks(parsed.drafts.d2) },
    };
  } catch {
    return null;
  }
}

/** The saved canvas for this key, or null if there is none. */
export function readState(key = STORAGE_KEY): CanvasState | null {
  try {
    return parseState(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function loadState(key = STORAGE_KEY): CanvasState {
  return readState(key) ?? initialState();
}

/** Returns true when the save succeeded. */
export function saveState(state: CanvasState, key = STORAGE_KEY): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
