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
}

export type DraftId = 'd1' | 'd2';

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
  /** Session Draft 2 only shows after someone adds it. */
  showDraft2: boolean;
}

export const DRAFT_IDS: DraftId[] = ['d1', 'd2'];
export const DRAFT_NAMES: Record<DraftId, string> = {
  d1: 'Session Draft 1',
  d2: 'Session Draft 2',
};

export const STICKY_COLORS: StickyColor[] = ['yellow', 'pink', 'orange', 'blue'];
