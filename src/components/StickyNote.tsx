import { useEffect, useRef } from 'react';
import { STICKY_COLORS, type Sticky } from '../state/types';
import { PaletteIcon, XIcon } from './Icons';

interface Props {
  sticky: Sticky;
  index: number;
  cellTitle: string;
  focusOnMount: boolean;
  onChange: (patch: Partial<Pick<Sticky, 'text' | 'color'>>) => void;
  onDelete: () => void;
}

export function StickyNote({ sticky, index, cellTitle, focusOnMount, onChange, onDelete }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
  }, [focusOnMount]);

  const nextColor = STICKY_COLORS[(STICKY_COLORS.indexOf(sticky.color) + 1) % STICKY_COLORS.length];
  const name = `Sticky note ${index + 1} in ${cellTitle}`;

  return (
    <li className={`sticky sticky--${sticky.color}`}>
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
