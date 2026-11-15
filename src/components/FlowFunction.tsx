import { useState } from 'react';
import { rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCanvas } from '../state/CanvasContext';
import { cellsIn, FLOW_MAX, FLOW_ROW, FLOW_SECTION, flowColumnLabel, flowOrder } from '../state/cells';
import { NoteCell } from './NoteCell';
import { Section } from './Section';
import { GripIcon, PlusIcon, XIcon } from './Icons';
import { columnDragId, type StickyDragData } from './StickyDnd';

/** Columns read left to right, six to a row. "Add more columns" adds a row of six, up to four rows. */
export function FlowFunction() {
  const { state, dispatch, readOnly } = useCanvas();
  const defs = cellsIn(FLOW_SECTION);
  const columns = flowOrder(state).map((n) => defs[n]);
  const rows = Array.from({ length: Math.ceil(columns.length / FLOW_ROW) }, (_, r) =>
    columns.slice(r * FLOW_ROW, r * FLOW_ROW + FLOW_ROW),
  );
  const [message, setMessage] = useState('');
  const say = (msg: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(msg), 50);
  };

  const addRow = () => {
    const first = state.flowColumns;
    dispatch({ type: 'addFlowRow' });
    say(`Columns ${first + 1} to ${first + FLOW_ROW} added.`);
    window.setTimeout(() => document.getElementById(`flow-name-${first}`)?.focus(), 60);
  };

  const removeRow = () => {
    const from = state.flowColumns - FLOW_ROW;
    const used = columns.slice(from).some((c) => {
      const cell = state.cells[c.id];
      return cell && (cell.stickies.length > 0 || (cell.title ?? '').trim());
    });
    if (used && !window.confirm(`Remove columns ${from + 1} to ${state.flowColumns} and everything in them?`)) return;
    dispatch({ type: 'removeFlowRow' });
    say(`Columns ${from + 1} to ${from + FLOW_ROW} removed.`);
    window.setTimeout(() => document.getElementById('flow-add-row')?.focus(), 60);
  };

  return (
    <Section id="section-flow" title="Flow, Function, and Form" className="band--flow">
      <div className="panel">
        <SortableContext items={columns.map((c) => columnDragId(c.id))} strategy={rectSortingStrategy}>
          {rows.map((row, r) => (
            <div key={r} className="flow-grid" role="group" aria-label={`Columns ${r * FLOW_ROW + 1} to ${r * FLOW_ROW + row.length}`}>
              {row.map((c, i) => (
                <FlowColumn key={c.id} cellId={c.id} position={r * FLOW_ROW + i} tone={i} />
              ))}
            </div>
          ))}
        </SortableContext>
        {!readOnly && (
          <div className="flow-actions no-print">
            {state.flowColumns < FLOW_MAX && (
              <button id="flow-add-row" type="button" className="btn btn--small" onClick={addRow}>
                <PlusIcon />
                Add more columns
              </button>
            )}
            {state.flowColumns > FLOW_ROW && (
              <button type="button" className="btn btn--small" onClick={removeRow}>
                <XIcon />
                Remove last row
              </button>
            )}
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </Section>
  );
}

/** One column. Drag it by the grip at the top to reorder; the column's colour stays with its position. */
function FlowColumn({ cellId, position, tone }: { cellId: string; position: number; tone: number }) {
  const { state, readOnly } = useCanvas();
  const data: StickyDragData = { type: 'column', cellId };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: columnDragId(cellId),
    data,
    disabled: readOnly,
  });
  const label = flowColumnLabel(position, state.cells[cellId]?.title);

  return (
    <div
      ref={setNodeRef}
      className={`flow-slot${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <NoteCell
        cellId={cellId}
        title={label}
        hideTitle
        nameLabel={`Name of function ${position + 1}`}
        nameId={`flow-name-${position}`}
        className={`flow-col flow-col--${tone}`}
        headingControls={
          !readOnly && (
            <button
              type="button"
              ref={setActivatorNodeRef}
              className="flow-grip no-print"
              {...attributes}
              {...listeners}
              aria-roledescription="draggable column"
              aria-label={`Reorder ${label}, ${position + 1} of ${state.flowColumns}`}
              title="Drag to reorder"
            >
              <GripIcon />
            </button>
          )
        }
      />
    </div>
  );
}
