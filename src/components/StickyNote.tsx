import { useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { STICKY_COLORS, type Sticky } from '../state/types';
import { GripIcon, MoveIcon, PaletteIcon, XIcon } from './Icons';
import { useOpenStickyMove, type StickyDragData } from './StickyDnd';

interface Props {
  sticky: Sticky;
  cellId: string;
  index: number;
  cellTitle: string;
  focusOnMount: boolean;
  onChange: (patch: Partial<Pick<Sticky, 'text' | 'color'>>) => void;
  onDelete: () => void;
}

export function StickyNote({ sticky, cellId, index, cellTitle, focusOnMount, onChange, onDelete }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const openMove = useOpenStickyMove();
  const data: StickyDragData = { type: 'sticky', cellId };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: sticky.id, data });
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  const nextColor = STICKY_COLORS[(STICKY_COLORS.indexOf(sticky.color) + 1) % STICKY_COLORS.length];
  const name = `Sticky note ${index + 1} in ${cellTitle}`;

  return (
    <li
      ref={setNodeRef}
      data-sticky-id={sticky.id}
      className={`sticky sticky--${sticky.color}${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <textarea
        ref={ref}
        className="sticky__text"
        aria-label={name}
        value={sticky.text}
        placeholder="Write a note"
        rows={3}
        onChange={(e) => onChange({ text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.currentTarget.blur();
        }}
      />
      <div className="print-text" aria-hidden="true">
        {sticky.text}
      </div>
      <div className="sticky__actions no-print">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="icon-btn icon-btn--sm sticky__handle"
          {...attributes}
          {...listeners}
          aria-roledescription="draggable sticky note"
          aria-label={`Drag ${name}`}
          title="Drag to move"
        >
          <GripIcon />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm js-sticky-move"
          aria-label={`Move ${name} to another section or position`}
          title="Move to…"
          onClick={() => openMove(sticky.id)}
        >
          <MoveIcon />
        </button>
        <span className="sticky__spacer" />
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label={`Change color of ${name}. Current color ${sticky.color}`}
          title={`Color: ${sticky.color}`}
          onClick={() => onChange({ color: nextColor })}
        >
          <PaletteIcon />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label={`Delete ${name}`}
          title="Delete sticky note"
          onClick={onDelete}
        >
          <XIcon />
        </button>
      </div>
    </li>
  );
}
