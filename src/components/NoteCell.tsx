import { useId, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import { newId, useCanvas } from '../state/CanvasContext';
import type { Cell } from '../state/types';
import { StickyNote } from './StickyNote';
import { PlusIcon, StickyIcon } from './Icons';
import { cellDroppableId, type StickyDragData } from './StickyDnd';
import { loadEditor } from './RichNote';

interface Props {
  cellId: string;
  title: string;
  /** Full name for assistive tech when the visible title is short, e.g. "Participant Before: Think". */
  accessibleTitle?: string;
  hideTitle?: boolean;
  className?: string;
  /** Adds a "Name this function" field above the stickies; this is its accessible label. */
  nameLabel?: string;
}

const EMPTY: Cell = { text: '', stickies: [] };

export function NoteCell({ cellId, title, accessibleTitle, hideTitle, className = '', nameLabel }: Props) {
  const { state, dispatch, readOnly } = useCanvas();
  const cell = state.cells[cellId] ?? EMPTY;
  const uid = useId();
  const headingId = `${uid}-h`;
  const fullTitle = accessibleTitle ?? title;
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const dropData: StickyDragData = { type: 'cell', cellId };
  const { setNodeRef, isOver } = useDroppable({ id: cellDroppableId(cellId), data: dropData });

  const addSticky = () => {
    const id = newId();
    setJustAdded(id);
    dispatch({ type: 'addSticky', cellId, id });
  };

  return (
    <div
      ref={setNodeRef}
      data-cell-id={cellId}
      className={`note-cell ${className}${isOver ? ' is-over' : ''}`}
      role="group"
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className={hideTitle ? 'sr-only' : 'note-cell__title'}>
        {hideTitle || !accessibleTitle ? (
          fullTitle
        ) : (
          <>
            <span className="sr-only">{fullTitle.slice(0, fullTitle.length - title.length)}</span>
            {title}
          </>
        )}
      </h3>
      {nameLabel && (
        <div className="note-cell__heading">
          <label htmlFor={`${uid}-title`} className="sr-only">
            {nameLabel}
          </label>
          <input
            id={`${uid}-title`}
            className="note-cell__heading-input"
            value={cell.title ?? ''}
            placeholder={readOnly ? '' : 'Name this function'}
            readOnly={readOnly}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => dispatch({ type: 'setCellTitle', cellId, title: e.target.value })}
          />
          <span className="print-text" aria-hidden="true">
            {cell.title}
          </span>
        </div>
      )}
      <SortableContext items={cell.stickies.map((s) => s.id)} strategy={rectSortingStrategy}>
        {cell.stickies.length > 0 && (
          <ul className="sticky-list" aria-label={`Sticky notes in ${fullTitle}`}>
            {cell.stickies.map((s, i) => (
              <StickyNote
                key={s.id}
                sticky={s}
                cellId={cellId}
                index={i}
                cellTitle={fullTitle}
                focusOnMount={s.id === justAdded}
                onChange={(patch) => dispatch({ type: 'editSticky', cellId, id: s.id, ...patch })}
                onDelete={() => {
                  dispatch({ type: 'deleteSticky', cellId, id: s.id });
                  addRef.current?.focus();
                }}
              />
            ))}
          </ul>
        )}
      </SortableContext>
      {readOnly && cell.stickies.length === 0 && <p className="note-cell__empty">No notes yet</p>}
      {!readOnly && (
        <button
          ref={addRef}
          type="button"
          className="add-sticky no-print"
          onClick={addSticky}
          // Start fetching the note editor before the click, so the first keystrokes are not lost.
          onMouseEnter={() => void loadEditor()}
          onFocus={() => void loadEditor()}
        >
          <PlusIcon />
          <StickyIcon />
          <span className="add-sticky__label">
            Add sticky note<span className="sr-only"> in {fullTitle}</span>
          </span>
        </button>
      )}
    </div>
  );
}
