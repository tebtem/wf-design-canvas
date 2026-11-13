import { useState } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { cellsIn, FLOW_MAX, FLOW_ROW, FLOW_SECTION } from '../state/cells';
import { NoteCell } from './NoteCell';
import { Section } from './Section';
import { PlusIcon, XIcon } from './Icons';

/** Columns read left to right, six to a row. "Add more columns" adds a row of six, up to four rows. */
export function FlowFunction() {
  const { state, dispatch, readOnly } = useCanvas();
  const columns = cellsIn(FLOW_SECTION).slice(0, state.flowColumns);
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
        {rows.map((row, r) => (
          <div key={r} className="flow-grid" role="group" aria-label={`Columns ${r * FLOW_ROW + 1} to ${r * FLOW_ROW + row.length}`}>
            {row.map((c, i) => {
              const n = r * FLOW_ROW + i;
              return (
                <NoteCell
                  key={c.id}
                  cellId={c.id}
                  title={c.title}
                  hideTitle
                  nameLabel={`Name of function ${n + 1}`}
                  nameId={`flow-name-${n}`}
                  className={`flow-col flow-col--${i}`}
                />
              );
            })}
          </div>
        ))}
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
