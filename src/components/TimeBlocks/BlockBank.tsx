import type { CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { newId, useCanvas } from '../../state/CanvasContext';
import { visibleDrafts } from '../../state/reducer';
import { BANK_MINUTES, BREAK_MINUTES, blockHeight, blockTone, DRAFT_NAMES, type BlockMinutes } from '../../state/types';
import { CupIcon, GripIcon, PlusIcon } from '../Icons';
import { bankDraggableId, type DragData } from './dnd';

function BankItem({ minutes, isBreak = false, announce }: { minutes: BlockMinutes; isBreak?: boolean; announce: (m: string) => void }) {
  const kind = isBreak ? 'break' : 'block';
  const shortName = isBreak ? 'Break' : `${minutes} min`;
  const { state, dispatch } = useCanvas();
  const drafts = visibleDrafts(state);
  const data: DragData = { type: 'bank', minutes, isBreak };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: bankDraggableId(minutes, isBreak),
    data,
  });

  return (
    <li
      ref={setNodeRef}
      className={`bank-item ${isBreak ? 'tblock--break' : `tblock--m${blockTone(minutes)}`}${isDragging ? ' is-source' : ''}`}
      style={{ '--h': `${blockHeight(minutes)}px` } as CSSProperties}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="bank-item__handle"
        {...attributes}
        {...listeners}
        aria-roledescription="draggable time block"
        aria-label={isBreak ? `Break, ${minutes} min. Drag into a session draft.` : `${minutes} min block. Drag into a session draft.`}
        title="Drag into a session draft"
      >
        <span className="tblock__minutes">{isBreak ? <CupIcon /> : minutes}</span>
        <span className="bank-item__name">{shortName}</span>
        <GripIcon />
      </button>
      <div className="bank-item__add no-print">
        {drafts.map((d) => (
          <button
            key={d}
            type="button"
            className="chip-btn"
            aria-label={isBreak ? `Add a break to ${DRAFT_NAMES[d]}` : `Add ${minutes} min block to ${DRAFT_NAMES[d]}`}
            onClick={() => {
              dispatch({ type: 'addBlock', draftId: d, id: newId(), minutes, isBreak });
              announce(`${minutes} minute ${kind} added to the end of ${DRAFT_NAMES[d]}.`);
            }}
          >
            <PlusIcon />
            {drafts.length === 1 ? 'Add' : DRAFT_NAMES[d].replace('Session ', '')}
          </button>
        ))}
      </div>
    </li>
  );
}

export function BlockBank({ announce }: { announce: (m: string) => void }) {
  return (
    <div className="bank" role="group" aria-labelledby="bank-heading">
      <h3 id="bank-heading" className="draft__title">
        Time Block Bank
      </h3>
      <p className="bank__hint no-print">
        Drag a block into a draft, or use the Add buttons. Change a block&apos;s length by typing a new number or
        dragging its bottom edge. The cup button marks any block as a break.
      </p>
      <ul className="bank__list">
        {BANK_MINUTES.map((m) => (
          <BankItem key={m} minutes={m} announce={announce} />
        ))}
        <BankItem minutes={BREAK_MINUTES} isBreak announce={announce} />
      </ul>
    </div>
  );
}
