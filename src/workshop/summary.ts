import { CELL_GROUPS } from '../state/cells';
import { formatMinutes, totalMinutes, visibleDrafts } from '../state/reducer';
import type { CanvasState } from '../state/types';

export const TOTAL_CELLS = CELL_GROUPS.reduce((n, g) => n + g.cells.length, 0);

export interface CanvasSummary {
  filled: number;
  stickies: number;
  /** Total time of each visible draft, e.g. ["1 hr", "Empty"]. */
  drafts: string[];
}

/** A quick read of how far along a canvas is, for the gallery cards. */
export function summarize(state: CanvasState): CanvasSummary {
  const cells = Object.values(state.cells);
  const draft = (blocks: CanvasState['drafts']['d1']) =>
    blocks.length ? formatMinutes(totalMinutes(blocks)) : 'Empty';
  return {
    filled: cells.filter((c) => c.text.trim() || c.stickies.length).length,
    stickies: cells.reduce((n, c) => n + c.stickies.length, 0),
    drafts: visibleDrafts(state).map((d) => draft(state.drafts[d])),
  };
}

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

/** "just now", "3 minutes ago", "2 hours ago". */
export function timeAgo(then: number, now: number): string {
  const s = Math.round((now - then) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return rtf ? rtf.format(-m, 'minute') : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return rtf ? rtf.format(-h, 'hour') : `${h} hr ago`;
  const d = Math.round(h / 24);
  return rtf ? rtf.format(-d, 'day') : `${d} days ago`;
}
