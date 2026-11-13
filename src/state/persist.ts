import { emptyDetails, initialState } from './reducer';
import { clampStep } from './cells';
import { clampMinutes, DRAFT_IDS, STICKY_COLORS, type CanvasDetails, type Outline, type CanvasState, type Cell, type TimeBlock } from './types';

/** Blocks saved before notes existed get an empty notes field. */
const migrateBlocks = (blocks: TimeBlock[] = []) =>
  blocks.map((b) =>
    b.kind === 'day'
      ? { id: b.id, kind: 'day' as const, minutes: 0, label: '', notes: '', ...(typeof b.start === 'number' ? { start: b.start } : {}) }
      : (({ isBreak, ...rest }) => ({
          ...rest,
          minutes: clampMinutes(b.minutes),
          notes: b.notes ?? '',
          ...(isBreak === true ? { isBreak: true } : {}),
        }))(b),
  );

/**
 * Keep stickies saved with a color that no longer exists (e.g. the old "green") readable, and turn
 * text typed into a cell before cells became sticky-only into the cell's first sticky note.
 */
function migrateCells(cells: Record<string, Cell>): Record<string, Cell> {
  return Object.fromEntries(
    Object.entries(cells).map(([id, c]) => {
      const stickies = (c.stickies ?? []).map((st) => (STICKY_COLORS.includes(st.color) ? st : { ...st, color: 'orange' as const }));
      const text = (c.text ?? '').trim();
      if (text) stickies.unshift({ id: `text-${id}`, text, color: 'yellow' });
      return [id, c.title ? { text: '', stickies, title: str(c.title) } : { text: '', stickies }];
    }),
  );
}

function migrateOutline(o: Partial<Outline> | undefined, draftCount: number): Outline {
  const draft = o?.draft && DRAFT_IDS.slice(0, draftCount).includes(o.draft) ? o.draft : 'd1';
  const rows = Object.fromEntries(
    Object.entries(o?.rows ?? {}).map(([id, r]) => [id, { activities: str(r?.activities), moves: str(r?.moves) }]),
  );
  const start = typeof o?.start === 'number' && o.start >= 0 && o.start < 1440 ? Math.round(o.start) : 0;
  return { draft, start, rows };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const migrateDetails = (d: Partial<CanvasDetails> | undefined): CanvasDetails =>
  d ? { title: str(d.title), client: str(d.client), participants: str(d.participants) } : emptyDetails();

export const STORAGE_KEY = 'wf-design-canvas:v1';

/** Parse saved canvas JSON. Returns null when it is missing or not a canvas. */
export function parseState(raw: string | null | undefined): CanvasState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CanvasState>;
    if (parsed?.version !== 1 || typeof parsed.cells !== 'object' || !parsed.drafts) return null;
    const d2 = migrateBlocks(parsed.drafts.d2);
    const d3 = migrateBlocks(parsed.drafts.d3);
    const old = parsed as { showDraft2?: boolean };
    const saved = typeof parsed.draftCount === 'number' ? parsed.draftCount : old.showDraft2 ? 2 : 1;
    // Never hide a draft that has blocks in it.
    const draftCount = Math.max(1, Math.min(3, Math.floor(saved)), d3.length ? 3 : d2.length ? 2 : 1);
    return {
      version: 1,
      details: migrateDetails(parsed.details),
      cells: migrateCells(parsed.cells ?? {}),
      drafts: { d1: migrateBlocks(parsed.drafts.d1), d2, d3 },
      draftCount,
      outline: migrateOutline(parsed.outline, draftCount),
      // Canvases saved before the guide existed open fully revealed.
      step: clampStep(parsed.step),
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
