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
