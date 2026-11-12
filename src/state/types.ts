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

export const BLOCK_MINUTES = [5, 10, 15, 20, 30, 45, 60] as const;
export type BlockMinutes = (typeof BLOCK_MINUTES)[number];

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

export interface CanvasState {
  version: 1;
  details: CanvasDetails;
  cells: Record<string, Cell>;
  drafts: Record<DraftId, TimeBlock[]>;
  /** Solo guided mode: sections are revealed up to this step (see REVEAL_STEPS). */
  step: number;
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
