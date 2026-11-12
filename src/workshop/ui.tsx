import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { ReadOnlyCanvasProvider } from '../state/CanvasContext';
import { CELL_GROUPS, cellTitle } from '../state/cells';
import { parseState } from '../state/persist';
import { CanvasBody } from '../components/CanvasBody';
import { SpotlightIcon, XIcon } from '../components/Icons';
import type { Comment, RemoteCanvas } from './api';
import { summarize, timeAgo, TOTAL_CELLS } from './summary';

/** Re-renders every so often so "3 minutes ago" stays true. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** A polite live region. Clearing first means repeating a message is still read out. */
export function useAnnouncer() {
  const [message, setMessage] = useState('');
  const announce = (msg: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(msg), 50);
  };
  const region = (
    <p className="sr-only" role="status" aria-live="polite">
      {message}
    </p>
  );
  return [announce, region] as const;
}

export interface GalleryEntry {
  uid: string;
  name: string;
  canvas?: RemoteCanvas;
  comments?: number;
  isYou?: boolean;
}

interface GalleryProps {
  entries: GalleryEntry[];
  onOpen: (uid: string) => void;
  spotlightUid?: string;
  empty: string;
}

export function Gallery({ entries, onOpen, spotlightUid, empty }: GalleryProps) {
  const now = useNow();
  if (!entries.length) return <p className="ws-empty">{empty}</p>;
  return (
    <ul className="ws-gallery">
      {entries.map((e) => {
        const state = parseState(e.canvas?.state);
        const sum = state ? summarize(state) : null;
        const spot = e.uid === spotlightUid;
        return (
          <li key={e.uid} className={`ws-card${spot ? ' is-spotlit' : ''}`} data-uid={e.uid}>
            <h3 className="ws-card__name">
              {e.name}
              {e.isYou && <span className="ws-card__you"> (you)</span>}
            </h3>
            {spot && (
              <p className="ws-badge">
                <SpotlightIcon /> Spotlighted
              </p>
            )}
            <p className="ws-card__time">
              {e.canvas?.updatedAt ? `Updated ${timeAgo(e.canvas.updatedAt, now)}` : 'Has not started yet'}
            </p>
            {sum && (
              <dl className="ws-stats">
                <div>
                  <dt>Sections filled</dt>
                  <dd>
                    {sum.filled} of {TOTAL_CELLS}
                  </dd>
                </div>
                <div>
                  <dt>Sticky notes</dt>
                  <dd>{sum.stickies}</dd>
                </div>
                <div>
                  <dt>Draft 1</dt>
                  <dd>{sum.d1}</dd>
                </div>
                <div>
                  <dt>Draft 2</dt>
                  <dd>{sum.d2}</dd>
                </div>
                {e.comments !== undefined && (
                  <div>
                    <dt>Your comments</dt>
                    <dd>{e.comments}</dd>
                  </div>
                )}
              </dl>
            )}
            <button type="button" className="btn btn--primary ws-card__open" onClick={() => onOpen(e.uid)}>
              Open canvas<span className="sr-only"> of {e.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Someone else's canvas, live and view only. */
export function CanvasView({ canvas, name }: { canvas: RemoteCanvas | null | undefined; name: string }) {
  const state = useMemo(() => parseState(canvas?.state), [canvas?.state]);
  if (canvas === undefined) return <p className="ws-empty">Loading {name}&apos;s canvas…</p>;
  if (!state) return <p className="ws-empty">{name} has not started their canvas yet.</p>;
  return (
    <ReadOnlyCanvasProvider state={state}>
      <CanvasBody label={`${name}'s canvas, view only`} />
    </ReadOnlyCanvasProvider>
  );
}

function CommentItem({ c, onDelete }: { c: Comment; onDelete?: () => void }) {
  return (
    <li className="ws-comment">
      <p className="ws-comment__where">{c.cellId ? cellTitle(c.cellId) : 'Whole canvas'}</p>
      <p className="ws-comment__text">{c.text}</p>
      {onDelete && (
        <button
          type="button"
          className="icon-btn ws-comment__delete"
          aria-label={`Delete comment: ${c.text.slice(0, 40)}`}
          title="Delete comment"
          onClick={onDelete}
        >
          <XIcon />
        </button>
      )}
    </li>
  );
}

/** Comments a participant receives. */
export function CommentList({ comments }: { comments: Comment[] }) {
  if (!comments.length) return <p className="ws-empty">No comments from your facilitator yet.</p>;
  return (
    <ul className="ws-comments">
      {comments.map((c) => (
        <CommentItem key={c.id} c={c} />
      ))}
    </ul>
  );
}

interface PanelProps {
  name: string;
  comments: Comment[];
  onAdd: (text: string, cellId?: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

/** Facilitator's comment box beside a participant's canvas. Only that participant sees these. */
export function CommentsPanel({ name, comments, onAdd, onDelete }: PanelProps) {
  const uid = useId();
  const [text, setText] = useState('');
  const [cellId, setCellId] = useState('');
  const [error, setError] = useState('');
  const [announce, region] = useAnnouncer();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('Write a comment first.');
      document.getElementById(`${uid}-text`)?.focus();
      return;
    }
    setError('');
    try {
      await onAdd(text.trim(), cellId || undefined);
      setText('');
      announce(`Comment sent to ${name}.`);
    } catch {
      setError('Could not send the comment. Check your connection and try again.');
    }
  };

  return (
    <aside className="ws-panel" aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`} className="ws-panel__title">
        Comments for {name}
      </h2>
      <p className="ws-hint">Only {name} sees these.</p>
      <form className="ws-form" onSubmit={submit} noValidate>
        <label htmlFor={`${uid}-cell`}>About</label>
        <select id={`${uid}-cell`} className="ws-input" value={cellId} onChange={(e) => setCellId(e.target.value)}>
          <option value="">Whole canvas</option>
          {CELL_GROUPS.map((g) => (
            <optgroup key={g.section} label={g.section}>
              {g.cells.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullTitle}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <label htmlFor={`${uid}-text`}>Comment</label>
        <textarea
          id={`${uid}-text`}
          className="ws-input ws-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          rows={4}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${uid}-err` : undefined}
        />
        {error && (
          <p id={`${uid}-err`} className="ws-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn--primary">
          Send comment
        </button>
      </form>
      <h3 id={`${uid}-sent`} className="ws-panel__sub" tabIndex={-1}>
        Sent ({comments.length})
      </h3>
      {comments.length ? (
        <ul className="ws-comments">
          {comments.map((c) => (
            <CommentItem
              key={c.id}
              c={c}
              onDelete={() =>
                onDelete(c.id).then(() => {
                  document.getElementById(`${uid}-sent`)?.focus();
                  announce('Comment deleted.');
                })
              }
            />
          ))}
        </ul>
      ) : (
        <p className="ws-empty">No comments yet.</p>
      )}
      {region}
    </aside>
  );
}
