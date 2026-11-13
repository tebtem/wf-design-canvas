import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCanvas } from '../state/CanvasContext';
import { STICKY_COLORS, type Sticky } from '../state/types';
import { GripIcon, PaletteIcon, XIcon } from './Icons';
import { useOpenStickyMove, type StickyDragData } from './StickyDnd';
import { RichNote } from './RichNote';

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
  const openMove = useOpenStickyMove();
  const { readOnly } = useCanvas();
  const data: StickyDragData = { type: 'sticky', cellId };
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: sticky.id, data, disabled: readOnly });

  const nextColor = STICKY_COLORS[(STICKY_COLORS.indexOf(sticky.color) + 1) % STICKY_COLORS.length];
  const name = `Sticky note ${index + 1} in ${cellTitle}`;

  return (
    <li
      ref={setNodeRef}
      data-sticky-id={sticky.id}
      className={`sticky sticky--${sticky.color}${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {/* Bold (Ctrl/Cmd+B), italic (Ctrl/Cmd+I) and "- " bullets; Escape finishes editing. */}
      <RichNote
        value={sticky.text}
        label={name}
        readOnly={readOnly}
        className="sticky__text"
        placeholder="Write a note"
        autoEdit={focusOnMount}
        onChange={(text) => onChange({ text })}
      />
      {!readOnly && (
        <div className="sticky__actions no-print">
          <button
            type="button"
            ref={setActivatorNodeRef}
            className="icon-btn icon-btn--sm sticky__handle"
            {...attributes}
            {...listeners}
            aria-roledescription="draggable sticky note"
            aria-label={`Move ${name}`}
            aria-haspopup="dialog"
            title="Drag to move, or click to choose where it goes"
            onClick={() => openMove(sticky.id)}
          >
            <GripIcon />
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
      )}
    </li>
  );
}
