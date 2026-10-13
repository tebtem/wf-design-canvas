import { useId, useRef, useState } from 'react';
import { newId, useCanvas } from '../state/CanvasContext';
import type { Cell } from '../state/types';
import { StickyNote } from './StickyNote';
import { PlusIcon, StickyIcon } from './Icons';

interface Props {
  cellId: string;
  title: string;
  /** Full name for assistive tech when the visible title is short, e.g. "Participant Before: Think". */
  accessibleTitle?: string;
  hideTitle?: boolean;
  className?: string;
  placeholder?: string;
}

const EMPTY: Cell = { text: '', stickies: [] };

export function NoteCell({ cellId, title, accessibleTitle, hideTitle, className = '', placeholder = 'Type here' }: Props) {
  const { state, dispatch } = useCanvas();
  const cell = state.cells[cellId] ?? EMPTY;
  const uid = useId();
  const headingId = `${uid}-h`;
  const fullTitle = accessibleTitle ?? title;
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const addSticky = () => {
    const id = newId();
    setJustAdded(id);
    dispatch({ type: 'addSticky', cellId, id });
  };

  return (
    <div className={`note-cell ${className}`} role="group" aria-labelledby={headingId}>
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
      <textarea
        className="note-cell__text"
        aria-labelledby={headingId}
        value={cell.text}
        placeholder={placeholder}
        onChange={(e) => dispatch({ type: 'setText', cellId, text: e.target.value })}
      />
      <div className="print-text" aria-hidden="true">
        {cell.text}
      </div>
      {cell.stickies.length > 0 && (
        <ul className="sticky-list" aria-label={`Sticky notes in ${fullTitle}`}>
          {cell.stickies.map((s, i) => (
            <StickyNote
              key={s.id}
              sticky={s}
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
      <button
        ref={addRef}
        type="button"
        className="add-sticky no-print"
        title="Add sticky note"
        onClick={addSticky}
      >
        <PlusIcon />
        <StickyIcon />
        <span className="sr-only">Add sticky note in {fullTitle}</span>
      </button>
    </div>
  );
}
