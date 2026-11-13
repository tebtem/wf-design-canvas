import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { breakMinutes, schedule, totalMinutes, totalWithBreaks } from '../../state/reducer';
import { useCanvas } from '../../state/CanvasContext';
import { DayDivider } from './DayDivider';
import { PlusIcon } from '../Icons';
import { DRAFT_NAMES, hhmm, type DraftId, type TimeBlock } from '../../state/types';
import { TimeBlockCard } from './TimeBlockCard';
import { XIcon } from '../Icons';
import { draftDroppableId, type DragData } from './dnd';

interface Props {
  draftId: DraftId;
  blocks: TimeBlock[];
  announce: (msg: string) => void;
  /** Shown for drafts that can be removed. */
  onRemove?: () => void;
  footer?: ReactNode;
  /** Adds a "Day 2" divider to the end of this draft. */
  onAddDay?: () => void;
}

export function DraftColumn({ draftId, blocks, announce, onRemove, footer, onAddDay }: Props) {
  const { state } = useCanvas();
  const data: DragData = { type: 'draft', draftId };
  const { setNodeRef, isOver } = useDroppable({ id: draftDroppableId(draftId), data });
  const headingId = `draft-${draftId}-heading`;
  const total = totalMinutes(blocks);

  const { slots, days } = schedule(blocks, state.outline.start);
  const multiDay = days.length > 1;
  return (
    <div ref={setNodeRef} className={`draft${isOver ? ' is-over' : ''}`} role="group" aria-labelledby={headingId}>
      <div className="draft__head">
        <h3 id={headingId} className="draft__title" tabIndex={-1}>
          {DRAFT_NAMES[draftId]}
        </h3>
        <p className="draft__total" aria-live="polite">
          {blocks.length
            ? `${multiDay ? `${days.length} days · ` : ''}Total ${totalWithBreaks(total, breakMinutes(blocks))}`
            : 'No blocks yet'}
        </p>
        {onRemove && (
          <button
            type="button"
            className="icon-btn no-print"
            aria-label={`Remove ${DRAFT_NAMES[draftId]}`}
            title={`Remove ${DRAFT_NAMES[draftId]}`}
            onClick={onRemove}
          >
            <XIcon />
          </button>
        )}
      </div>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ol className="draft__list">
          {multiDay && (
            <li className="day-divider day-divider--first">
              <span className="day-divider__name">Day 1</span>
              <span className="day-divider__meta">
                starts {hhmm(days[0].start)}
                {days[0].total > 0 && ` · ${totalWithBreaks(days[0].total, days[0].breaks)}`}
              </span>
            </li>
          )}
          {slots.map(({ block: b, day, start }, i) =>
            b.kind === 'day' ? (
              <DayDivider
                key={b.id}
                divider={b}
                draftId={draftId}
                day={day}
                start={start}
                total={days[day - 1].total}
                breaks={days[day - 1].breaks}
                index={i}
                count={blocks.length}
                announce={announce}
              />
            ) : (
              <TimeBlockCard
                key={b.id}
                block={b}
                draftId={draftId}
                index={i}
                count={blocks.length}
                start={start}
                announce={announce}
              />
            ),
          )}
        </ol>
      </SortableContext>
      {blocks.length === 0 && (
        <p className="draft__empty no-print">Drag blocks here from the Time Block Bank, or use its Add buttons.</p>
      )}
      {onAddDay && blocks.length > 0 && (
        <button type="button" className="btn btn--small draft__add-day no-print" onClick={onAddDay}>
          <PlusIcon />
          Add next day
        </button>
      )}
      {footer}
    </div>
  );
}
