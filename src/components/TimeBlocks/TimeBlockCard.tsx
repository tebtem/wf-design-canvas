import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCanvas } from '../../state/CanvasContext';
import { DRAFT_NAMES, type DraftId, type TimeBlock } from '../../state/types';
import { DownIcon, GripIcon, SwapIcon, UpIcon, XIcon } from '../Icons';
import { clock, type DragData } from './dnd';

interface Props {
  block: TimeBlock;
  draftId: DraftId;
  index: number;
  count: number;
  start: number;
  announce: (msg: string) => void;
}

export function TimeBlockCard({ block, draftId, index, count, start, announce }: Props) {
  const { dispatch } = useCanvas();
  const data: DragData = { type: 'block', draftId, minutes: block.minutes, label: block.label };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id, data });

  const other: DraftId = draftId === 'd1' ? 'd2' : 'd1';
  const name = `${block.minutes} minute block${block.label ? ` "${block.label}"` : ''}`;
  const where = `position ${index + 1} of ${count} in ${DRAFT_NAMES[draftId]}`;
  const inputId = `label-${block.id}`;

  const move = (toIndex: number) => {
    if (toIndex < 0 || toIndex >= count) return;
    dispatch({ type: 'moveBlock', id: block.id, toDraft: draftId, toIndex });
    announce(`${name} moved to position ${toIndex + 1} of ${count} in ${DRAFT_NAMES[draftId]}.`);
  };

  const moveToOther = () => {
    dispatch({ type: 'moveBlock', id: block.id, toDraft: other, toIndex: Number.MAX_SAFE_INTEGER });
    announce(`${name} moved to the end of ${DRAFT_NAMES[other]}.`);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-block-id="${block.id}"] .js-move-other`)?.focus(),
    );
  };

  const remove = () => {
    dispatch({ type: 'removeBlock', id: block.id });
    announce(`${name} removed from ${DRAFT_NAMES[draftId]}.`);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`#draft-${draftId}-heading`)?.focus(),
    );
  };

  return (
    <li
      ref={setNodeRef}
      data-block-id={block.id}
      className={`tblock tblock--m${block.minutes}${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="tblock__handle"
        {...attributes}
        {...listeners}
        aria-roledescription="draggable time block"
        aria-label={`${block.minutes} min, ${name}, ${where}. Drag to reorder.`}
        title="Drag to reorder"
      >
        <span className="tblock__minutes">{block.minutes}</span>
        <GripIcon />
      </button>
      <div className="tblock__body">
        <label htmlFor={inputId} className="sr-only">
          Activity for {name}, {where}
        </label>
        <input
          id={inputId}
          className="tblock__label"
          value={block.label}
          placeholder="Name this block"
          onChange={(e) => dispatch({ type: 'editBlockLabel', id: block.id, label: e.target.value })}
        />
        <span className="print-text" aria-hidden="true">
          {block.label}
        </span>
        <span className="tblock__time">
          <span className="sr-only">Runs from </span>
          {clock(start)}
          <span aria-hidden="true"> – </span>
          <span className="sr-only"> to </span>
          {clock(start + block.minutes)}
        </span>
      </div>
      <div className="tblock__actions no-print">
        <button
          type="button"
          className="icon-btn"
          aria-label={`Move ${name} up`}
          aria-disabled={index === 0}
          title="Move up"
          onClick={() => move(index - 1)}
        >
          <UpIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Move ${name} down`}
          aria-disabled={index === count - 1}
          title="Move down"
          onClick={() => move(index + 1)}
        >
          <DownIcon />
        </button>
        <button
          type="button"
          className="icon-btn js-move-other"
          aria-label={`Move ${name} to ${DRAFT_NAMES[other]}`}
          title={`Move to ${DRAFT_NAMES[other]}`}
          onClick={moveToOther}
        >
          <SwapIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Remove ${name}`}
          title="Remove"
          onClick={remove}
        >
          <XIcon />
        </button>
      </div>
    </li>
  );
}

export function BlockPreview({ minutes, label }: { minutes: number; label?: string }) {
  return (
    <div className={`tblock tblock--m${minutes} tblock--overlay`} aria-hidden="true">
      <span className="tblock__handle">
        <span className="tblock__minutes">{minutes}</span>
      </span>
      <div className="tblock__body">
        <span className="tblock__preview-label">{label || `${minutes} min block`}</span>
      </div>
    </div>
  );
}
