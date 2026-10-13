import { useDraggable } from '@dnd-kit/core';
import { newId, useCanvas } from '../../state/CanvasContext';
import { BLOCK_MINUTES, DRAFT_IDS, DRAFT_NAMES, type BlockMinutes } from '../../state/types';
import { GripIcon, PlusIcon } from '../Icons';
import { bankDraggableId, type DragData } from './dnd';

function BankItem({ minutes, announce }: { minutes: BlockMinutes; announce: (m: string) => void }) {
  const { dispatch } = useCanvas();
  const data: DragData = { type: 'bank', minutes };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: bankDraggableId(minutes),
    data,
  });

  return (
    <li ref={setNodeRef} className={`bank-item tblock--m${minutes}${isDragging ? ' is-source' : ''}`}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="bank-item__handle"
        {...attributes}
        {...listeners}
        aria-roledescription="draggable time block"
        aria-label={`${minutes} min block. Drag into a session draft.`}
        title="Drag into a session draft"
      >
        <span className="tblock__minutes">{minutes}</span>
        <span className="bank-item__name">{minutes} min</span>
        <GripIcon />
      </button>
      <div className="bank-item__add no-print">
        {DRAFT_IDS.map((d) => (
          <button
            key={d}
            type="button"
            className="chip-btn"
            aria-label={`Add ${minutes} min block to ${DRAFT_NAMES[d]}`}
            onClick={() => {
              dispatch({ type: 'addBlock', draftId: d, id: newId(), minutes });
              announce(`${minutes} minute block added to the end of ${DRAFT_NAMES[d]}.`);
            }}
          >
            <PlusIcon />
            {DRAFT_NAMES[d].replace('Session ', '')}
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
      <p className="bank__hint no-print">Drag a block into a draft, or use the Add buttons. The bank never runs out.</p>
      <ul className="bank__list">
        {BLOCK_MINUTES.map((m) => (
          <BankItem key={m} minutes={m} announce={announce} />
        ))}
      </ul>
    </div>
  );
}
