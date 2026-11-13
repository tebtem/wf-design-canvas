export type StickyColor = 'yellow' | 'pink' | 'orange' | 'blue';

export interface Sticky {
  id: string;
  text: string;
  color: StickyColor;
}

export interface Cell {
  /** Legacy free text. Cells now hold only sticky notes; old text is turned into a sticky on load. */
  text: string;
  stickies: Sticky[];
  /** Column title, used by the Flow, Function, and Form columns. */
  title?: string;
}

export type DraftId = 'd1' | 'd2' | 'd3';

/** Starter blocks in the bank. Placed blocks can be resized in 5-minute steps. */
export const BANK_MINUTES = [15, 30, 60] as const;
/** Default length of a Break block from the bank. */
export const BREAK_MINUTES = 15;
export const MIN_BLOCK = 5;
export const MAX_BLOCK = 180;
export const BLOCK_STEP = 5;
export type BlockMinutes = number;

/** Snap any length to the 5-minute grid within the allowed range. */
export const clampMinutes = (m: number) =>
  Math.max(MIN_BLOCK, Math.min(MAX_BLOCK, Math.round((Number.isFinite(m) ? m : MIN_BLOCK) / BLOCK_STEP) * BLOCK_STEP));

/** Color band for a length, so blocks of similar length share a color. */
export function blockTone(m: number): number {
  for (const [max, tone] of [[5, 5], [10, 10], [15, 15], [25, 20], [35, 30], [50, 45], [75, 60], [120, 90]] as const) {
    if (m <= max) return tone;
  }
  return 120;
}

/** Block height grows with its length. */
export const blockHeight = (m: number) => Math.round(30 + m * 1.5);
/** Pixels of drag per minute when resizing, matching blockHeight. */
export const PX_PER_MINUTE = 1.5;

export interface TimeBlock {
  id: string;
  minutes: BlockMinutes;
  label: string;
  /** Free-form details, e.g. bullet points about what happens in this block. */
  notes: string;
  /** A break (lunch, coffee): shown quieter than activities and totaled separately. */
  isBreak?: boolean;
  /** A day divider ("Day 2"): the blocks after it are the next day and the clock starts again. */
  kind?: 'day';
  /** Day dividers only: when that day starts, in minutes after midnight. Defaults to Day 1's start. */
  start?: number;
}

export interface CanvasDetails {
  title: string;
  client: string;
  participants: string;
}

export const DETAIL_FIELDS: { key: keyof CanvasDetails; label: string }[] = [
  { key: 'title', label: 'Working Title' },
  { key: 'client', label: 'Client Name' },
  { key: 'participants', label: 'Number of Participants' },
];

export interface OutlineRow {
  activities: string;
  moves: string;
}

/** Session Outline: rows come from one draft's time blocks; text is kept per block id. */
export interface Outline {
  draft: DraftId;
  /** Session start time, in minutes after midnight (0 means times read 00:00, 00:15...). */
  start: number;
  rows: Record<string, OutlineRow>;
}

export interface CanvasState {
  version: 1;
  details: CanvasDetails;
  cells: Record<string, Cell>;
  drafts: Record<DraftId, TimeBlock[]>;
  /** Solo guided mode: sections are revealed up to this step (see REVEAL_STEPS). */
  step: number;
  outline: Outline;
  /** How many Flow, Function, and Form columns are shown: rows of six (6, 12, 18 or 24). */
  flowColumns: number;
  /** How many drafts are on screen (1 to 3). Drafts are added with Add another draft. */
  draftCount: number;
}

export const DRAFT_IDS: DraftId[] = ['d1', 'd2', 'd3'];
export const MAX_DRAFTS = DRAFT_IDS.length;
export const DRAFT_NAMES: Record<DraftId, string> = {
  d1: 'Session Draft 1',
  d2: 'Session Draft 2',
  d3: 'Session Draft 3',
};

export const STICKY_COLORS: StickyColor[] = ['yellow', 'pink', 'orange', 'blue'];

/** 75 -> "01:15". Times past midnight wrap around. */
export const hhmm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * Reads a typed clock time: "9", "9:30", "09.30", "930", "1415". Returns minutes after midnight,
 * or null if it is not a time.
 */
export function parseClock(text: string): number | null {
  const t = text.trim().replace(/\s+/g, '');
  let h: number;
  let m: number;
  const sep = t.match(/^(\d{1,2})[:.h](\d{1,2})$/);
  if (sep) {
    h = Number(sep[1]);
    m = Number(sep[2]);
  } else if (/^\d{1,4}$/.test(t)) {
    if (t.length <= 2) {
      h = Number(t);
      m = 0;
    } else {
      h = Number(t.slice(0, t.length - 2));
      m = Number(t.slice(-2));
    }
  } else {
    return null;
  }
  return h <= 23 && m <= 59 ? h * 60 + m : null;
}
