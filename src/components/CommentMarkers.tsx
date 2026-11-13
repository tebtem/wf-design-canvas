import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { CommentIcon } from './Icons';

export interface MarkerComment {
  id: string;
  text: string;
  cellId?: string;
}

interface Ctx {
  byCell: Record<string, MarkerComment[]>;
  dismiss: (id: string) => void;
}

const MarkersContext = createContext<Ctx>({ byCell: {}, dismiss: () => {} });

/** Workshop participants: facilitator comments shown as a small icon in the section they are about. */
export function CommentMarkersProvider({
  comments,
  storageKey,
  children,
}: {
  comments: MarkerComment[];
  /** Where dismissed comment ids are remembered on this device. */
  storageKey: string;
  children: ReactNode;
}) {
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Not remembered after a reload.
    }
  };
  const byCell: Record<string, MarkerComment[]> = {};
  for (const c of comments) {
    if (!c.cellId || dismissed.includes(c.id)) continue;
    (byCell[c.cellId] ??= []).push(c);
  }
  return <MarkersContext.Provider value={{ byCell, dismiss }}>{children}</MarkersContext.Provider>;
}

/** The marker inside a section: a comment icon with a count; opens to show the comments with Dismiss. */
export function CellComments({ cellId, cellTitle }: { cellId: string; cellTitle: string }) {
  const { byCell, dismiss } = useContext(MarkersContext);
  const list = byCell[cellId] ?? [];
  const [open, setOpen] = useState(false);
  const uid = useId();
  if (!list.length) return null;
  const label = `${list.length} facilitator comment${list.length === 1 ? '' : 's'} on ${cellTitle}`;
  return (
    <div className="cell-comments no-print">
      <button
        type="button"
        className="cell-comments__marker"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <CommentIcon />
        <span aria-hidden="true">{list.length}</span>
      </button>
      <ul id={`${uid}-list`} className="cell-comments__list" hidden={!open}>
        {list.map((c) => (
          <li key={c.id} className="cell-comments__item">
            <p className="cell-comments__text">{c.text}</p>
            <button type="button" className="btn btn--small" onClick={() => dismiss(c.id)}>
              Dismiss<span className="sr-only"> comment: {c.text.slice(0, 40)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
