import { createContext, useContext, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  KeyboardCode,
  type Announcements,
  type KeyboardCoordinateGetter,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { newId, useCanvas } from '../../state/CanvasContext';
import { findBlock, visibleDrafts } from '../../state/reducer';
import { DRAFT_IDS, DRAFT_NAMES, MAX_DRAFTS, type CanvasState, type DraftId } from '../../state/types';
import { PlusIcon } from '../Icons';
import { Section } from '../Section';
import { BlockBank } from './BlockBank';
import { DraftColumn } from './DraftColumn';
import { BlockPreview } from './TimeBlockCard';
import type { DragData } from './dnd';

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCorners(args);
};

/**
 * Keyboard movement. dnd-kit's sortable helper only moves items that are themselves
 * droppable, so bank blocks get a simple "jump to the nearest target in that direction".
 */
const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { active, collisionRect, droppableRects, droppableContainers, over } = args.context;
  if ((active?.data.current as DragData | undefined)?.type !== 'bank') {
    return sortableKeyboardCoordinates(event, args);
  }
  if (!collisionRect) return undefined;
  const inDirection = droppableContainers.getEnabled().filter((entry) => {
    const rect = droppableRects.get(entry.id);
    if (!rect) return false;
    switch (event.code) {
      case KeyboardCode.Down:
        return collisionRect.top < rect.top;
      case KeyboardCode.Up:
        return collisionRect.top > rect.top;
      case KeyboardCode.Left:
        return collisionRect.left > rect.left;
      case KeyboardCode.Right:
        return collisionRect.left < rect.left;
      default:
        return false;
    }
  });
  if (!inDirection.length) return undefined;
  event.preventDefault();
  const hits = closestCorners({
    active: active!,
    collisionRect,
    droppableRects,
    droppableContainers: inDirection,
    pointerCoordinates: null,
  });
  const next = hits.find((h) => h.id !== over?.id) ?? hits[0];
  const rect = next && droppableRects.get(next.id);
  return rect ? { x: rect.left, y: rect.top } : undefined;
};

type Over = { id: UniqueIdentifier; data: { current?: unknown } } | null;

/** Resolve which draft, and at which index, a drop target refers to. */
function resolveTarget(state: CanvasState, over: Over): { draftId: DraftId; index: number } | null {
  if (!over) return null;
  const data = over.data.current as DragData | undefined;
  if (data?.type === 'draft') return { draftId: data.draftId, index: state.drafts[data.draftId].length };
  if (data?.type === 'block') {
    const loc = findBlock(state, String(over.id));
    if (loc) return loc;
  }
  return null;
}

const describe = (data: DragData | undefined) =>
  data && data.type !== 'draft'
    ? `${data.minutes} minute block${data.type === 'block' && data.label ? ` "${data.label}"` : ''}`
    : 'block';

/** Opens the "move to another draft" dialog for a block. */
const BlockMoveContext = createContext<(blockId: string) => void>(() => {});
export const useOpenBlockMove = () => useContext(BlockMoveContext);

export function TimeBlocksSection() {
  const { state, dispatch, readOnly } = useCanvas();
  const [active, setActive] = useState<DragData | null>(null);
  const [message, setMessage] = useState('');

  const drafts = visibleDrafts(state);

  const lastDraft = drafts[drafts.length - 1];

  const addDraft = () => {
    const next = DRAFT_IDS[drafts.length];
    dispatch({ type: 'addDraft' });
    announce(`${DRAFT_NAMES[next]} added.`);
    requestAnimationFrame(() => document.getElementById(`draft-${next}-heading`)?.focus());
  };

  const removeDraft = () => {
    const n = state.drafts[lastDraft].length;
    if (n && !window.confirm(`Remove ${DRAFT_NAMES[lastDraft]} and its ${n} time block${n === 1 ? '' : 's'}?`)) return;
    dispatch({ type: 'removeDraft' });
    announce(`${DRAFT_NAMES[lastDraft]} removed.`);
    requestAnimationFrame(() => document.getElementById('add-draft')?.focus());
  };

  // ---------- Move a block to another draft (button alternative to dragging) ----------
  const moveDialog = useRef<HTMLDialogElement>(null);
  const [moving, setMoving] = useState<{ id: string; from: DraftId } | null>(null);
  const [moveTo, setMoveTo] = useState<DraftId>('d1');
  const openMove = (blockId: string) => {
    const loc = findBlock(state, blockId);
    if (!loc) return;
    setMoving({ id: blockId, from: loc.draftId });
    setMoveTo(drafts.find((d) => d !== loc.draftId) ?? 'd1');
    moveDialog.current?.showModal();
  };
  const confirmMove = () => {
    if (!moving) return;
    const block = state.drafts[moving.from].find((b) => b.id === moving.id);
    dispatch({ type: 'moveBlock', id: moving.id, toDraft: moveTo, toIndex: Number.MAX_SAFE_INTEGER });
    announce(
      `${describe(block && { type: 'block', draftId: moving.from, minutes: block.minutes, label: block.label })} moved to the end of ${DRAFT_NAMES[moveTo]}.`,
    );
  };

  const announce = (msg: string) => {
    // Clear first so repeating the same message is still announced.
    setMessage('');
    requestAnimationFrame(() => setMessage(msg));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );

  const whereText = (over: Over) => {
    const t = resolveTarget(state, over);
    return t ? `${DRAFT_NAMES[t.draftId]}, position ${t.index + 1}` : null;
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active.data.current as DragData)}.`,
    onDragOver: ({ active, over }) => {
      const where = whereText(over);
      return where
        ? `${describe(active.data.current as DragData)} is over ${where}.`
        : `${describe(active.data.current as DragData)} is not over a session draft.`;
    },
    onDragEnd: ({ active, over }) => {
      const where = whereText(over);
      return where
        ? `Dropped ${describe(active.data.current as DragData)} in ${where}.`
        : `Dropped ${describe(active.data.current as DragData)}. It was not placed in a draft.`;
    },
    onDragCancel: ({ active }) => `Cancelled. ${describe(active.data.current as DragData)} was not moved.`,
  };

  const onDragStart = ({ active }: DragStartEvent) => setActive(active.data.current as DragData);

  // Move existing blocks between drafts while dragging so the list previews the result.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    const data = active.data.current as DragData | undefined;
    if (data?.type !== 'block') return;
    const from = findBlock(state, String(active.id));
    const to = resolveTarget(state, over);
    if (!from || !to || from.draftId === to.draftId) return;
    dispatch({ type: 'moveBlock', id: String(active.id), toDraft: to.draftId, toIndex: to.index });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    const data = active.data.current as DragData | undefined;
    const to = resolveTarget(state, over);
    if (!data || !to) return;
    if (data.type === 'bank') {
      dispatch({ type: 'addBlock', draftId: to.draftId, id: newId(), minutes: data.minutes, index: to.index });
    } else if (data.type === 'block' && over && over.id !== active.id) {
      dispatch({ type: 'moveBlock', id: String(active.id), toDraft: to.draftId, toIndex: to.index });
    }
  };

  return (
    <BlockMoveContext.Provider value={openMove}>
      <Section id="section-time" title="Time Blocks" className="band--time">
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActive(null)}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                'To pick up a time block, press Space or Enter. Use the arrow keys to move it over a session draft. Press Space or Enter again to drop it, or Escape to cancel. Buttons are also available to add, move and remove blocks.',
            },
          }}
        >
          <div className={`panel time-grid time-grid--${drafts.length}${readOnly ? ' time-grid--readonly' : ''}`}>
            {drafts.map((d) => (
              <DraftColumn
                key={d}
                draftId={d}
                blocks={state.drafts[d]}
                announce={announce}
                onRemove={d === lastDraft && d !== 'd1' && !readOnly ? removeDraft : undefined}
                footer={
                  d === lastDraft && drafts.length < MAX_DRAFTS && !readOnly ? (
                    <button id="add-draft" type="button" className="btn draft__add no-print" onClick={addDraft}>
                      <PlusIcon />
                      Add another draft
                    </button>
                  ) : null
                }
              />
            ))}
            {!readOnly && <BlockBank announce={announce} />}
          </div>
          <DragOverlay dropAnimation={null}>
            {active && active.type !== 'draft' ? (
              <BlockPreview minutes={active.minutes} label={active.type === 'block' ? active.label : undefined} />
            ) : null}
          </DragOverlay>
        </DndContext>
        <dialog
          ref={moveDialog}
          className="dialog"
          aria-labelledby="block-move-title"
          onClose={() =>
            moving &&
            requestAnimationFrame(() =>
              document.querySelector<HTMLElement>(`[data-block-id="${moving.id}"] .js-move-other`)?.focus(),
            )
          }
        >
          <h2 id="block-move-title">Move time block</h2>
          <form method="dialog" className="move-form" onSubmit={confirmMove}>
            <label htmlFor="block-move-to">Move to the end of</label>
            <select id="block-move-to" value={moveTo} onChange={(e) => setMoveTo(e.target.value as DraftId)}>
              {drafts
                .filter((d) => d !== moving?.from)
                .map((d) => (
                  <option key={d} value={d}>
                    {DRAFT_NAMES[d]}
                  </option>
                ))}
            </select>
            <div className="dialog__actions">
              <button type="button" className="btn" onClick={() => moveDialog.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary">
                Move
              </button>
            </div>
          </form>
        </dialog>
        <p className="sr-only" role="status" aria-live="polite">
          {message}
        </p>
      </Section>
    </BlockMoveContext.Provider>
  );
}
