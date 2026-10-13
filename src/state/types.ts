export type StickyColor = 'yellow' | 'pink' | 'orange' | 'blue';

export interface Sticky {
  id: string;
  text: string;
  color: StickyColor;
}

export interface Cell {
  text: string;
  stickies: Sticky[];
}

export type DraftId = 'd1' | 'd2';

export const BLOCK_MINUTES = [15, 20, 30, 45, 60] as const;
export type BlockMinutes = (typeof BLOCK_MINUTES)[number];

export interface TimeBlock {
  id: string;
  minutes: BlockMinutes;
  label: string;
}

export interface CanvasState {
  version: 1;
  cells: Record<string, Cell>;
  drafts: Record<DraftId, TimeBlock[]>;
}

export const DRAFT_IDS: DraftId[] = ['d1', 'd2'];
export const DRAFT_NAMES: Record<DraftId, string> = {
  d1: 'Session Draft 1',
  d2: 'Session Draft 2',
};

export const STICKY_COLORS: StickyColor[] = ['yellow', 'pink', 'orange', 'blue'];
