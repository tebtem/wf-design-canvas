import type { BlockMinutes, DraftId } from '../../state/types';

export type DragData =
  | { type: 'bank'; minutes: BlockMinutes; isBreak?: boolean }
  | { type: 'block'; draftId: DraftId; minutes: BlockMinutes; label: string; isDay?: boolean; isBreak?: boolean }
  | { type: 'draft'; draftId: DraftId };

export const draftDroppableId = (d: DraftId) => `draft-${d}`;
export const bankDraggableId = (m: BlockMinutes, isBreak = false) => (isBreak ? 'bank-break' : `bank-${m}`);

export const clock = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
