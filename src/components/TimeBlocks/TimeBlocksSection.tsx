import { useState } from 'react';
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
import { findBlock } from '../../state/reducer';
import { DRAFT_IDS, DRAFT_NAMES, type CanvasState, type DraftId } from '../../state/types';
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

export function TimeBlocksSection() {
  const { state, dispatch } = useCanvas();
  const [active, setActive] = useState<DragData | null>(null);
  const [message, setMessage] = useState('');

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
    <Section title="Time Blocks" className="band--time">
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
        <div className="panel time-grid">
          {DRAFT_IDS.map((d) => (
            <DraftColumn key={d} draftId={d} blocks={state.drafts[d]} announce={announce} />
          ))}
          <BlockBank announce={announce} />
        </div>
        <DragOverlay dropAnimation={null}>
          {active && active.type !== 'draft' ? (
            <BlockPreview minutes={active.minutes} label={active.type === 'block' ? active.label : undefined} />
          ) : null}
        </DragOverlay>
      </DndContext>
      <p className="sr-only" role="status" aria-live="polite">
        {message}
      </p>
    </Section>
  );
}
