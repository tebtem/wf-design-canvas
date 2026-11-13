import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCanvas } from '../../state/CanvasContext';
import { hhmmOf, totalWithBreaks } from '../../state/reducer';
import { DRAFT_NAMES, type DraftId, type TimeBlock } from '../../state/types';
import { DownIcon, GripIcon, UpIcon, XIcon } from '../Icons';
import type { DragData } from './dnd';

interface Props {
  divider: TimeBlock;
  draftId: DraftId;
  day: number;
  start: number;
  total: number;
  breaks: number;
  index: number;
  count: number;
  announce: (msg: string) => void;
}

/** "Day 2" divider in a draft: blocks after it are the next day. Moves like a block. */
export function DayDivider({ divider, draftId, day, start, total, breaks, index, count, announce }: Props) {
  const { dispatch, readOnly } = useCanvas();
  const name = `Day ${day}`;
  const data: DragData = { type: 'block', draftId, minutes: 0, label: name, isDay: true };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: divider.id,
    data,
    disabled: readOnly,
  });

  const move = (toIndex: number) => {
    if (toIndex < 0 || toIndex >= count) return;
    dispatch({ type: 'moveBlock', id: divider.id, toDraft: draftId, toIndex });
    announce(`Start of ${name} moved to position ${toIndex + 1} of ${count} in ${DRAFT_NAMES[draftId]}.`);
  };
  const remove = () => {
    dispatch({ type: 'removeBlock', id: divider.id });
    announce(`${name} removed. Its blocks are now part of the day before.`);
    requestAnimationFrame(() => document.getElementById(`draft-${draftId}-heading`)?.focus());
  };

  return (
    <li
      ref={setNodeRef}
      data-block-id={divider.id}
      className={`day-divider${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {!readOnly && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="icon-btn icon-btn--sm day-divider__handle"
          {...attributes}
          {...listeners}
          aria-roledescription="draggable day divider"
          aria-label={`Drag start of ${name}, position ${index + 1} of ${count} in ${DRAFT_NAMES[draftId]}.`}
          title="Drag to move where this day starts"
        >
          <GripIcon />
        </button>
      )}
      <span className="day-divider__name">{name}</span>
      <span className="day-divider__meta">
        starts {hhmmOf(start)}
        {total > 0 && ` · ${totalWithBreaks(total, breaks)}`}
      </span>
      {!readOnly && (
        <span className="day-divider__actions no-print">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            aria-label={`Move start of ${name} up`}
            aria-disabled={index === 0}
            title="Move up"
            onClick={() => move(index - 1)}
          >
            <UpIcon />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            aria-label={`Move start of ${name} down`}
            aria-disabled={index === count - 1}
            title="Move down"
            onClick={() => move(index + 1)}
          >
            <DownIcon />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            aria-label={`Remove ${name}`}
            title={`Remove ${name}`}
            onClick={remove}
          >
            <XIcon />
          </button>
        </span>
      )}
    </li>
  );
}
