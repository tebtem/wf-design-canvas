import type { BlockMinutes, DraftId } from '../../state/types';

export type DragData =
  | { type: 'bank'; minutes: BlockMinutes }
  | { type: 'block'; draftId: DraftId; minutes: BlockMinutes; label: string }
  | { type: 'draft'; draftId: DraftId };

export const draftDroppableId = (d: DraftId) => `draft-${d}`;
export const bankDraggableId = (m: BlockMinutes) => `bank-${m}`;

export const clock = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
