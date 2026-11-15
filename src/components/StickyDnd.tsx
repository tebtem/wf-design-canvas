import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardCode,
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
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useCanvas } from '../state/CanvasContext';
import { richToText, toRichHtml } from './richText';
import { CELL_GROUPS, cellLabel, cellsInOrder, flowColumnLabel, flowOrder, isCellShown } from '../state/cells';
import { findSticky } from '../state/reducer';
import type { CanvasState, Sticky } from '../state/types';

export type StickyDragData =
  | { type: 'sticky'; cellId: string }
  | { type: 'cell'; cellId: string }
  /** A whole Flow, Function, and Form column, dragged by its grip to reorder. */
  | { type: 'column'; cellId: string };

export const cellDroppableId = (cellId: string) => `cell:${cellId}`;
export const columnDragId = (cellId: string) => `column:${cellId}`;

const dragType = (x: { data: { current?: unknown } } | null | undefined) =>
  (x?.data.current as StickyDragData | undefined)?.type;
/** Columns only land on columns; stickies only on sections and other stickies. */
const sameKind = (active: { data: { current?: unknown } } | null | undefined) => {
  const isColumn = dragType(active) === 'column';
  return (c: { data: { current?: unknown } }) => (dragType(c) === 'column') === isColumn;
};

const collision: CollisionDetection = (args) => {
  const scoped = { ...args, droppableContainers: args.droppableContainers.filter(sameKind(args.active)) };
  if (dragType(args.active) === 'column') return closestCenter(scoped);
  const hits = pointerWithin(scoped);
  return hits.length ? hits : closestCorners(scoped);
};

const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const all = args.context.droppableContainers;
  const keep = sameKind(args.context.active);
  // Only getEnabled() and get() are read, so a light wrapper is enough to scope the targets.
  const droppableContainers = { getEnabled: () => all.getEnabled().filter(keep), get: (id: UniqueIdentifier) => all.get(id) };
  return sortableKeyboardCoordinates(event, {
    ...args,
    context: { ...args.context, droppableContainers: droppableContainers as unknown as typeof all },
  });
};

/** Position a column drag is over, from any droppable in that column. */
function columnTarget(state: CanvasState, over: Over): number | null {
  const data = over?.data.current as StickyDragData | undefined;
  if (!data) return null;
  const n = flowOrder(state).indexOf(Number(data.cellId.replace('flow.', '')));
  return data.cellId.startsWith('flow.') && n !== -1 ? n : null;
}
const columnName = (state: CanvasState, position: number) =>
  flowColumnLabel(position, state.cells[`flow.${flowOrder(state)[position]}`]?.title);

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

export function StickyDnd({ children, step = Infinity }: { children: ReactNode; step?: number }) {
  const { state, dispatch } = useCanvas();
  const [active, setActive] = useState<Sticky | null>(null);
  const [message, setMessage] = useState('');

  const announce = (msg: string) => {
    setMessage('');
    requestAnimationFrame(() => setMessage(msg));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Space picks a note up to move with the arrow keys; Enter on the grip opens the Move dialog instead.
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
      keyboardCodes: { start: [KeyboardCode.Space], cancel: [KeyboardCode.Esc], end: [KeyboardCode.Space, KeyboardCode.Enter] },
    }),
  );

  const where = (over: Over) => {
    const t = resolveTarget(state, over);
    return t ? `${cellLabel(t.cellId, state)}, position ${t.index + 1}` : null;
  };

  const columnFrom = (active: { id: string | number }) =>
    flowOrder(state).indexOf(Number(String(active.id).replace('column:flow.', '')));

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      dragType(active) === 'column' ? `Picked up ${columnName(state, columnFrom(active))}.` : 'Picked up sticky note.',
    onDragOver: ({ active, over }) => {
      if (dragType(active) === 'column') {
        const to = columnTarget(state, over);
        return to === null ? '' : `Over position ${to + 1} of ${state.flowColumns}.`;
      }
      const w = where(over);
      return w ? `Sticky note is over ${w}.` : 'Sticky note is not over a section.';
    },
    onDragEnd: ({ active, over }) => {
      if (dragType(active) === 'column') {
        const to = columnTarget(state, over);
        const name = columnName(state, columnFrom(active));
        return to === null ? `Dropped ${name}. It was not moved.` : `Moved ${name} to position ${to + 1} of ${state.flowColumns}.`;
      }
      const w = where(over);
      return w ? `Dropped sticky note in ${w}.` : 'Dropped sticky note. It was not moved.';
    },
    onDragCancel: ({ active }) =>
      dragType(active) === 'column' ? 'Cancelled. Column was not moved.' : 'Cancelled. Sticky note was not moved.',
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
    lastDragEnd.current = Date.now();
    setActive(null);
    if (dragType(active) === 'column') {
      const from = columnFrom(active);
      const to = columnTarget(state, over);
      if (from !== -1 && to !== null && to !== from) dispatch({ type: 'moveFlowColumn', from, to });
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(`[data-cell-id="${String(active.id).slice(7)}"] .flow-grip`)?.focus(),
      );
      return;
    }
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

  const lastDragEnd = useRef(0);
  const openMove = (stickyId: string) => {
    // A click that ends a drag is not a request for the dialog.
    if (Date.now() - lastDragEnd.current < 400) return;
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
    announce(`Sticky note moved to ${cellLabel(toCell, state)}, position ${toIndex + 1}.`);
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
              'To pick up a sticky note or column, press Space, use the arrow keys to move it, then press Space again to drop it, or Escape to cancel. For a sticky note, press Enter (or click) instead to choose a section and position from a list.',
          },
        }}
      >
        {children}
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className={`sticky sticky--${active.color} sticky--overlay`} aria-hidden="true">
              <p className="sticky__preview">{richToText(toRichHtml(active.text)) || 'Sticky note'}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="move-title"
        onClose={() => moving && focusSticky(moving.id, '.sticky__handle')}
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
            {CELL_GROUPS.filter((g) => g.step <= step).map((g) => (
              <optgroup key={g.section} label={g.section}>
                {cellsInOrder(g.cells, state).filter((c) => isCellShown(c.id, state)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {cellLabel(c.id, state)}
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
