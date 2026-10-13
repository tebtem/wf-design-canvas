import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { formatMinutes, totalMinutes } from '../../state/reducer';
import { DRAFT_NAMES, type DraftId, type TimeBlock } from '../../state/types';
import { TimeBlockCard } from './TimeBlockCard';
import { draftDroppableId, type DragData } from './dnd';

interface Props {
  draftId: DraftId;
  blocks: TimeBlock[];
  announce: (msg: string) => void;
}

export function DraftColumn({ draftId, blocks, announce }: Props) {
  const data: DragData = { type: 'draft', draftId };
  const { setNodeRef, isOver } = useDroppable({ id: draftDroppableId(draftId), data });
  const headingId = `draft-${draftId}-heading`;
  const total = totalMinutes(blocks);

  const starts = blocks.map((_, i) => totalMinutes(blocks.slice(0, i)));
  return (
    <div
      ref={setNodeRef}
      className={`draft${isOver ? ' is-over' : ''}`}
      role="group"
      aria-labelledby={headingId}
    >
      <div className="draft__head">
        <h3 id={headingId} className="draft__title" tabIndex={-1}>
          {DRAFT_NAMES[draftId]}
        </h3>
        <p className="draft__total" aria-live="polite">
          {blocks.length ? `Total ${formatMinutes(total)}` : 'No blocks yet'}
        </p>
      </div>
      <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
        <ol className="draft__list">
          {blocks.map((b, i) => (
            <TimeBlockCard
              key={b.id}
              block={b}
              draftId={draftId}
              index={i}
              count={blocks.length}
              start={starts[i]}
              announce={announce}
            />
          ))}
        </ol>
      </SortableContext>
      {blocks.length === 0 && (
        <p className="draft__empty no-print">Drag blocks here from the Time Block Bank, or use its Add buttons.</p>
      )}
    </div>
  );
}
