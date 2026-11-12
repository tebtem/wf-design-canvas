import { useState, type KeyboardEvent } from 'react';
import { BLOCK_STEP, hhmm, parseClock } from '../state/types';

interface Props {
  /** Clock time in minutes after midnight, or a length in minutes. */
  value: number;
  kind: 'clock' | 'minutes';
  label: string;
  readOnly?: boolean;
  className?: string;
  /** Called with the typed value; may adjust it (for example snapping to 5 minutes). */
  onCommit: (value: number) => void;
  /** Called when the typed text cannot be used. */
  onInvalid?: (message: string) => void;
}

/** A small typeable time or length. Commits on Enter or leaving the field; arrow keys step by 5 minutes. */
export function TimeField({ value, kind, label, readOnly, className = '', onCommit, onInvalid }: Props) {
  const [typed, setTyped] = useState<string | null>(null);
  const shown = kind === 'clock' ? hhmm(value) : String(value);

  const commit = () => {
    if (typed === null) return;
    const text = typed;
    setTyped(null);
    if (text.trim() === shown) return;
    const n = kind === 'clock' ? parseClock(text) : Number.parseInt(text, 10);
    if (n === null || !Number.isFinite(n)) {
      onInvalid?.(
        kind === 'clock' ? `"${text}" is not a time. Type it like 09:30.` : `"${text}" is not a number of minutes.`,
      );
      return;
    }
    onCommit(n);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setTyped(null);
      onCommit(value + (e.key === 'ArrowUp' ? BLOCK_STEP : -BLOCK_STEP));
    } else if (e.key === 'Escape') {
      setTyped(null);
    }
  };

  if (readOnly) return <span className={className}>{shown}</span>;
  return (
    <input
      className={`time-field ${className}`}
      aria-label={label}
      title={
        kind === 'clock'
          ? 'Type a time like 09:30. Arrow keys change it by 5 minutes.'
          : 'Minutes, in 5-minute steps. Arrow keys change it by 5.'
      }
      inputMode={kind === 'clock' ? 'text' : 'numeric'}
      autoComplete="off"
      maxLength={kind === 'clock' ? 5 : 3}
      value={typed ?? shown}
      onChange={(e) => setTyped(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
    />
  );
}
