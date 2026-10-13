import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCanvas } from '../state/CanvasContext';
import { CELL_GROUPS, cellTitle } from '../state/cells';
import { findSticky } from '../state/reducer';
import type { CanvasState, Sticky } from '../state/types';

export type StickyDragData = { type: 'sticky'; cellId: string } | { type: 'cell'; cellId: string };

export const cellDroppableId = (cellId: string) => `cell:${cellId}`;

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCorners(args);
};

type Over = { id: string | number; data: { current?: unknown } } | null;

function resolveTarget(state: CanvasState, over: Over): { cellId: string; index: number } | null {
  const data = over?.data.current as StickyDragData | undefined;
  if (!over || !data) return null;
  if (data.type === 'cell') return { cellId: data.cellId, index: state.cells[data.cellId]?.stickies.length ?? 0 };
  return findSticky(state, String(over.id));
}

const focusSticky = (id: string, selector: string) =>
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>(`[data-sticky-id="${id}"] ${selector}`)?.focus(),
  );

const StickyMoveContext = createContext<(stickyId: string) => void>(() => {});
export const useOpenStickyMove = () => useContext(StickyMoveContext);

export function StickyDnd({ children }: { children: ReactNode }) {
  const { state, dispatch } = useCanvas();
  const [active, setActive] = useState<Sticky | null>(null);
  const [message, setMessage] = useState('');

  const announce = (msg: string) => {
    setMessage('');
    requestAnimationFrame(() => setMessage(msg));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const where = (over: Over) => {
    const t = resolveTarget(state, over);
    return t ? `${cellTitle(t.cellId)}, position ${t.index + 1}` : null;
  };

  const announcements: Announcements = {
    onDragStart: () => 'Picked up sticky note.',
    onDragOver: ({ over }) => {
      const w = where(over);
      return w ? `Sticky note is over ${w}.` : 'Sticky note is not over a section.';
    },
    onDragEnd: ({ over }) => {
      const w = where(over);
      return w ? `Dropped sticky note in ${w}.` : 'Dropped sticky note. It was not moved.';
    },
    onDragCancel: () => 'Cancelled. Sticky note was not moved.',
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const loc = findSticky(state, String(active.id));
    setActive(loc ? state.cells[loc.cellId].stickies[loc.index] : null);
  };

  // Move between cells while dragging so the destination list previews the result.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    const from = findSticky(state, String(active.id));
    const to = resolveTarget(state, over);
    if (!from || !to || from.cellId === to.cellId) return;
    dispatch({ type: 'moveSticky', id: String(active.id), toCell: to.cellId, toIndex: to.index });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActive(null);
    const id = String(active.id);
    const from = findSticky(state, id);
    const to = resolveTarget(state, over);
    if (from && to && over && over.id !== active.id) {
      dispatch({ type: 'moveSticky', id, toCell: to.cellId, toIndex: to.index });
    }
    focusSticky(id, '.sticky__handle');
  };

  // ---------- Move dialog (keyboard and screen reader alternative to dragging) ----------
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [moving, setMoving] = useState<{ id: string; fromCell: string } | null>(null);
  const [toCell, setToCell] = useState('');
  const [toIndex, setToIndex] = useState(0);

  const openMove = (stickyId: string) => {
    const loc = findSticky(state, stickyId);
    if (!loc) return;
    setMoving({ id: stickyId, fromCell: loc.cellId });
    setToCell(loc.cellId);
    setToIndex(loc.index);
    dialogRef.current?.showModal();
  };

  const targetCount = state.cells[toCell]?.stickies.length ?? 0;
  const positions = moving && toCell === moving.fromCell ? targetCount : targetCount + 1;

  const confirmMove = () => {
    if (!moving) return;
    dispatch({ type: 'moveSticky', id: moving.id, toCell, toIndex });
    announce(`Sticky note moved to ${cellTitle(toCell)}, position ${toIndex + 1}.`);
  };

  return (
    <StickyMoveContext.Provider value={openMove}>
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
              'To pick up a sticky note, press Space or Enter. Use the arrow keys to move it, then press Space or Enter to drop it, or Escape to cancel. You can also use the Move button.',
          },
        }}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className={`sticky sticky--${active.color} sticky--overlay`} aria-hidden="true">
              <p className="sticky__preview">{active.text || 'Sticky note'}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="move-title"
        onClose={() => moving && focusSticky(moving.id, '.js-sticky-move')}
      >
        <h2 id="move-title">Move sticky note</h2>
        <form method="dialog" className="move-form" onSubmit={confirmMove}>
          <label htmlFor="move-cell">Section</label>
          <select
            id="move-cell"
            value={toCell}
            onChange={(e) => {
              setToCell(e.target.value);
              setToIndex(state.cells[e.target.value]?.stickies.length ?? 0);
            }}
          >
            {CELL_GROUPS.map((g) => (
              <optgroup key={g.section} label={g.section}>
                {g.cells.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullTitle}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <label htmlFor="move-pos">Position</label>
          <select id="move-pos" value={toIndex} onChange={(e) => setToIndex(Number(e.target.value))}>
            {Array.from({ length: Math.max(positions, 1) }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? '1 (first)' : i === positions - 1 ? `${i + 1} (last)` : i + 1}
              </option>
            ))}
          </select>
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
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
    </StickyMoveContext.Provider>
  );
}
