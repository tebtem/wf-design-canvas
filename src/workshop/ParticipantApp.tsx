import { useEffect, useRef, useState } from 'react';
import { CanvasProvider, useCanvas } from '../state/CanvasContext';
import { Toolbar } from '../components/Toolbar';
import { Footer } from '../components/Footer';
import { CanvasBody } from '../components/CanvasBody';
import { BackIcon } from '../components/Icons';
import {
  fetchOwnCanvas,
  pushCanvas,
  signIn,
  watchCanvas,
  watchCanvases,
  watchComments,
  watchConnected,
  watchMembers,
  watchMeta,
  watchRejoinCode,
  ensureRejoinCode,
  type Comment,
  type Member,
  type RemoteCanvas,
  type SessionMeta,
} from './api';
import { formatCode, formatRejoinCode, spellCode } from './code';
import { hasUnsent, setUnsent, workshopCanvasKey, type ActiveWorkshop } from './session';
import { parseState, saveState } from '../state/persist';
import { CanvasView, CommentList, Gallery, useAnnouncer } from './ui';
import { cellTitle, clampStep, LAST_STEP, REVEAL_STEPS, STEP_ANCHORS } from '../state/cells';

type View = { kind: 'mine' } | { kind: 'gallery' } | { kind: 'other'; uid: string; name: string };
type Sync = 'ok' | 'offline' | 'error';

/** Sends this participant's canvas to the workshop shortly after each change. */
function CanvasSync({ code, uid, active, onResult }: { code: string; uid: string; active: boolean; onResult: (ok: boolean) => void }) {
  const { state } = useCanvas();
  const [opened] = useState(state);
  useEffect(() => {
    // Opening the canvas is not a change; only send what the person edits (or unsent work).
    const unsent = hasUnsent(code);
    if (state === opened && !unsent) return;
    if (state !== opened) setUnsent(code, true);
    if (!active) return;
    const t = window.setTimeout(() => {
      pushCanvas(code, uid, state).then(
        () => {
          setUnsent(code, false);
          onResult(true);
        },
        () => onResult(false),
      );
    }, 500);
    return () => window.clearTimeout(t);
  }, [state, opened, code, uid, active, onResult]);
  return null;
}

interface Props {
  workshop: ActiveWorkshop;
  onLeave: (copyToPersonal?: boolean) => void;
}

export default function ParticipantApp({ workshop, onLeave }: Props) {
  const { code, uid, name = '' } = workshop;
  const [ready, setReady] = useState(false);
  // The canvas mounts once this device has the newest copy (or knows it is offline).
  const [loaded, setLoaded] = useState(false);
  const [meta, setMeta] = useState<SessionMeta | null | undefined>(undefined);
  const [connected, setConnected] = useState(true);
  const [pushOk, setPushOk] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [rejoinCode, setRejoinCode] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [canvases, setCanvases] = useState<Record<string, RemoteCanvas>>({});
  const [viewed, setViewed] = useState<{ uid: string; canvas: RemoteCanvas | null } | null>(null);
  const [view, setView] = useState<View>({ kind: 'mine' });
  const [revoked, setRevoked] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [announce, region] = useAnnouncer();
  const leaveRef = useRef<HTMLDialogElement>(null);
  const [copyOnLeave, setCopyOnLeave] = useState(false);
  const seenComments = useRef<Set<string> | null>(null);
  // Notifications that float in the bottom-right corner so they are seen wherever you have scrolled.
  const [commentToasts, setCommentToasts] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const returnFocus = useRef<string | null>(null);

  const ended = meta === null;
  const canView = Boolean(meta?.canView);
  const spotlight = meta?.spotlight ?? null;
  // Spotlight card in the corner: shown for each new spotlight until dismissed, gone when it ends.
  const [spotDismissed, setSpotDismissed] = useState<string | null>(null);
  const spotKey = spotlight && !ended ? spotlight.uid : null;
  const showSpotToast = spotKey !== null && spotDismissed !== spotKey;
  // Show only the first step until the workshop settings load; an ended workshop shows everything.
  const step = meta === undefined ? 0 : meta === null ? LAST_STEP : clampStep(meta.step);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [lastStep, setLastStep] = useState(step);
  if (step !== lastStep) {
    setLastStep(step);
    if (meta !== undefined && meta !== null && step > lastStep) setRevealed(step);
    if (step < lastStep) setRevealed(null);
  }

  // Restore the anonymous sign-in before reading anything.
  useEffect(() => {
    let live = true;
    signIn().then(
      async () => {
        if (!hasUnsent(code)) {
          const remote = parseState(await fetchOwnCanvas(code, uid).catch(() => null));
          if (remote) saveState(remote, workshopCanvasKey(code));
        }
        if (!live) return;
        setLoaded(true);
        setReady(true);
      },
      () => {
        if (!live) return;
        setLoaded(true);
        setMeta(null);
      },
    );
    return () => {
      live = false;
    };
  }, [code, uid]);

  useEffect(() => {
    if (!ready) return;
    void ensureRejoinCode(code, uid);
    const offs = [
      watchMeta(code, setMeta),
      watchConnected(setConnected),
      watchComments(code, uid, (list) => {
        setComments(list);
        setCommentsLoaded(true);
      }),
      watchRejoinCode(code, uid, setRejoinCode),
    ];
    return () => offs.forEach((off) => off());
  }, [ready, code, uid]);

  // Other people's canvases are only readable while the facilitator allows it.
  useEffect(() => {
    if (!ready || !canView) return;
    const offs = [watchMembers(code, setMembers), watchCanvases(code, setCanvases)];
    return () => offs.forEach((off) => off());
  }, [ready, canView, code]);

  // Leave views that are no longer allowed (adjusting state during render, not in an effect).
  const allowed =
    view.kind === 'mine' || (!ended && (canView || (view.kind === 'other' && spotlight?.uid === view.uid)));
  if (!allowed) {
    setView({ kind: 'mine' });
    setRevoked((n) => n + 1);
  }
  useEffect(() => {
    if (revoked) announce('That canvas is no longer shared. You are back on your own canvas.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revoked]);

  const viewedUid = view.kind === 'other' ? view.uid : null;
  useEffect(() => {
    if (!ready || !viewedUid) return;
    return watchCanvas(code, viewedUid, (canvas) => setViewed({ uid: viewedUid, canvas }));
  }, [ready, code, viewedUid]);
  const viewedCanvas = viewed && viewed.uid === viewedUid ? viewed.canvas : undefined;

  useEffect(() => {
    if (revealed === null) return;
    announce(
      revealed >= LAST_STEP
        ? `Your facilitator revealed ${REVEAL_STEPS[revealed]}. You can now see the full canvas.`
        : `Your facilitator revealed ${REVEAL_STEPS[revealed]}.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const goToRevealed = () => {
    if (revealed === null) return;
    if (view.kind !== 'mine') setView({ kind: 'mine' });
    window.setTimeout(() => {
      const section = document.getElementById(STEP_ANCHORS[revealed]);
      section?.scrollIntoView({ block: 'start' });
      section?.querySelector<HTMLElement>('h2')?.focus();
      setRevealed(null);
    }, 50);
  };

  /** Jumps to the section a comment is about and briefly highlights it. */
  const goToCell = (c: Comment) => {
    if (view.kind !== 'mine') setView({ kind: 'mine' });
    setCommentToasts((list) => list.filter((x) => x.id !== c.id));
    window.setTimeout(() => {
      const cell = c.cellId ? document.querySelector<HTMLElement>(`[data-cell-id="${c.cellId}"]`) : null;
      if (!cell || cell.offsetParent === null) {
        // Whole-canvas comments (or a section not revealed yet) open the comments list instead.
        setShowComments(true);
        window.scrollTo({ top: 0 });
        document.getElementById('ws-comments-btn')?.focus();
        return;
      }
      cell.scrollIntoView({ block: 'center' });
      cell.classList.add('is-flagged');
      window.setTimeout(() => cell.classList.remove('is-flagged'), 2500);
      cell.querySelector<HTMLElement>('textarea, button')?.focus();
    }, 50);
  };

  // New comments (not the ones already there on load) pop up in the corner and are announced.
  useEffect(() => {
    if (seenComments.current === null) {
      // The first batch is what was already there; only later ones are new.
      if (commentsLoaded) seenComments.current = new Set(comments.map((c) => c.id));
      return;
    }
    const fresh = comments.filter((c) => !seenComments.current!.has(c.id));
    fresh.forEach((c) => seenComments.current!.add(c.id));
    if (!fresh.length) return;
    setCommentToasts((list) => [...list, ...fresh].slice(-3));
    const last = fresh[fresh.length - 1];
    announce(`New comment from your facilitator${last.cellId ? ` about ${cellTitle(last.cellId)}` : ''}: ${last.text}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, commentsLoaded]);

  useEffect(() => {
    if (!spotlight || ended) return;
    announce(
      spotlight.uid === uid
        ? 'Your facilitator is spotlighting your canvas for the group.'
        : `Your facilitator is spotlighting ${spotlight.name}'s canvas.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotKey]);

  const hasToasts = revealed !== null || commentToasts.length > 0 || showSpotToast;
  // Leave room at the bottom so the notifications never cover what you are typing in.
  useEffect(() => {
    document.body.classList.toggle('has-toasts', hasToasts);
    return () => document.body.classList.remove('has-toasts');
  }, [hasToasts]);

  useEffect(() => {
    if (view.kind !== 'mine') document.getElementById('ws-view-title')?.focus();
    else if (returnFocus.current) {
      document.getElementById(returnFocus.current)?.focus();
      returnFocus.current = null;
    }
  }, [view]);

  const open = (next: View, from?: string) => {
    if (from) returnFocus.current = from;
    setView(next);
    window.scrollTo(0, 0);
  };

  const sync: Sync = !connected ? 'offline' : pushOk ? 'ok' : 'error';
  const syncText = ended
    ? 'Not syncing: this workshop has ended.'
    : sync === 'offline'
      ? 'Offline. Your changes will sync when you reconnect.'
      : sync === 'error'
        ? 'Changes are not reaching the workshop. Your work is still saved in this browser.'
        : 'Live: your facilitator sees changes as you make them.';

  const others = Object.entries(members)
    .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
    .map(([id, m]) => ({ uid: id, name: m.name, canvas: canvases[id], isYou: id === uid }));

  return (
    <>
      <a className="skip-link" href={view.kind === 'mine' ? '#canvas' : '#ws-view'}>
        Skip to {view.kind === 'mine' ? 'canvas' : 'main content'}
      </a>
      <section className="ws-bar no-print" aria-labelledby="ws-bar-title">
        <div className="ws-bar__row">
          <div className="ws-bar__info">
            <h2 id="ws-bar-title" className="ws-bar__title">
              {meta?.title ?? 'Workshop'}
            </h2>
            <p className="ws-bar__meta">
              Code <span aria-hidden="true">{formatCode(code)}</span>
              <span className="sr-only">{spellCode(code)}</span> · You are {name}
            </p>
            {rejoinCode && (
              <p className="ws-bar__meta">
                Your rejoin code: <strong aria-hidden="true">{formatRejoinCode(rejoinCode)}</strong>
                <span className="sr-only">{spellCode(rejoinCode)}</span>{' '}
                <span className="ws-bar__tip">(use it to get back to your canvas on another device)</span>
              </p>
            )}
            <p className={`ws-bar__sync ws-bar__sync--${ended ? 'error' : sync}`} role="status">
              {syncText}
            </p>
          </div>
          <div className="ws-bar__actions">
            <button
              id="ws-comments-btn"
              type="button"
              className="btn"
              aria-expanded={showComments}
              aria-controls="ws-comments"
              onClick={() => setShowComments((v) => !v)}
            >
              Facilitator comments ({comments.length})
            </button>
            {canView && view.kind === 'mine' && (
              <button
                id="ws-browse-btn"
                type="button"
                className="btn"
                onClick={() => open({ kind: 'gallery' }, 'ws-browse-btn')}
              >
                See everyone&apos;s canvases
              </button>
            )}
            <button type="button" className="btn" onClick={() => leaveRef.current?.showModal()}>
              Leave workshop
            </button>
          </div>
        </div>

        {ended && (
          <p className="ws-notice ws-notice--warn">
            This workshop has ended. Your canvas is still saved in this browser. Leave the workshop to go back to your
            own canvas, and choose whether to keep this one.
          </p>
        )}
        <div>
          {spotlight && !ended && (
            <p className="ws-notice">
              {spotlight.uid === uid ? (
                'Your facilitator is spotlighting your canvas for the group.'
              ) : (
                <>
                  Your facilitator is spotlighting {spotlight.name}&apos;s canvas.{' '}
                  <button
                    id="ws-spot-btn"
                    type="button"
                    className="btn btn--small"
                    onClick={() => open({ kind: 'other', uid: spotlight.uid, name: spotlight.name }, 'ws-spot-btn')}
                  >
                    View it
                  </button>
                </>
              )}
            </p>
          )}
        </div>
        <div id="ws-comments" className="ws-bar__comments" hidden={!showComments}>
          <CommentList comments={comments} />
        </div>
      </section>

      {view.kind !== 'mine' && (
        <div id="ws-view" className="ws-page">
          <div className="ws-viewbar">
            <button
              type="button"
              className="btn"
              onClick={() => (view.kind === 'other' && canView ? open({ kind: 'gallery' }) : open({ kind: 'mine' }))}
            >
              <BackIcon />
              {view.kind === 'other' && canView ? 'Back to all canvases' : 'Back to my canvas'}
            </button>
            {view.kind === 'other' && canView && (
              <button type="button" className="btn" onClick={() => open({ kind: 'mine' })}>
                My canvas
              </button>
            )}
          </div>
          {view.kind === 'gallery' ? (
            <main>
              <h1 id="ws-view-title" className="ws-h1" tabIndex={-1}>
                Everyone&apos;s canvases
              </h1>
              <p className="ws-hint">View only. These update live.</p>
              <Gallery
                compact
                entries={others}
                spotlightUid={spotlight?.uid}
                empty="Nobody else has joined yet."
                onOpen={(id) =>
                  id === uid
                    ? open({ kind: 'mine' })
                    : open({ kind: 'other', uid: id, name: members[id]?.name ?? 'Participant' })
                }
              />
            </main>
          ) : (
            <>
              <h1 id="ws-view-title" className="ws-h1" tabIndex={-1}>
                {view.name}&apos;s canvas <span className="ws-h1__note">(view only)</span>
              </h1>
              <CanvasView canvas={viewedCanvas} name={view.name} step={step} />
            </>
          )}
        </div>
      )}

      <div hidden={view.kind !== 'mine'}>
        {loaded ? (
          <CanvasProvider storageKey={workshopCanvasKey(code)}>
            <Toolbar />
            <CanvasSync code={code} uid={uid} active={ready && !ended} onResult={setPushOk} />
            {view.kind === 'mine' && <CanvasBody step={step} />}
          </CanvasProvider>
        ) : (
          <p className="ws-loading" role="status">
            Loading your canvas…
          </p>
        )}
      </div>
      <Footer />
      {hasToasts && (
        <section className="ws-toasts no-print" aria-label="Notifications">
          {showSpotToast && spotlight && (
            <div className="ws-toast ws-toast--spotlight">
              <p className="ws-toast__title">Spotlight</p>
              <p>
                {spotlight.uid === uid ? (
                  <>
                    Your facilitator is spotlighting <strong>your canvas</strong> for the group.
                  </>
                ) : (
                  <>
                    Your facilitator is spotlighting <strong>{spotlight.name}&apos;s canvas</strong>.
                  </>
                )}
              </p>
              <div className="ws-toast__actions">
                {spotlight.uid !== uid && (
                  <button
                    type="button"
                    className="btn btn--small btn--primary"
                    onClick={() => {
                      setSpotDismissed(spotlight.uid);
                      open({ kind: 'other', uid: spotlight.uid, name: spotlight.name }, 'ws-spot-btn');
                    }}
                  >
                    View it<span className="sr-only"> ({spotlight.name}&apos;s canvas)</span>
                  </button>
                )}
                <button type="button" className="btn btn--small" onClick={() => setSpotDismissed(spotlight.uid)}>
                  Dismiss<span className="sr-only"> spotlight notice</span>
                </button>
              </div>
            </div>
          )}
          {revealed !== null && (
            <div className="ws-toast">
              <p className="ws-toast__title">Newly revealed</p>
              <p>
                <strong>{REVEAL_STEPS[revealed]}</strong>
                {revealed >= LAST_STEP && '. You can now see the full canvas.'}
              </p>
              <div className="ws-toast__actions">
                <button type="button" className="btn btn--small btn--primary" onClick={goToRevealed}>
                  Go to it
                </button>
                <button type="button" className="btn btn--small" onClick={() => setRevealed(null)}>
                  Dismiss<span className="sr-only"> newly revealed notice</span>
                </button>
              </div>
            </div>
          )}
          {commentToasts.map((c) => (
            <div key={c.id} className="ws-toast ws-toast--comment">
              <p className="ws-toast__title">
                Comment from your facilitator{c.cellId ? ` on ${cellTitle(c.cellId)}` : ''}
              </p>
              <p className="ws-toast__text">{c.text}</p>
              <div className="ws-toast__actions">
                <button type="button" className="btn btn--small btn--primary" onClick={() => goToCell(c)}>
                  {c.cellId ? `Go to ${cellTitle(c.cellId)}` : 'See all comments'}
                </button>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => setCommentToasts((list) => list.filter((x) => x.id !== c.id))}
                >
                  Dismiss<span className="sr-only"> comment</span>
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      {region}

      <dialog ref={leaveRef} className="dialog" aria-labelledby="ws-leave-title" aria-describedby="ws-leave-desc">
        <h2 id="ws-leave-title">Leave this workshop?</h2>
        <p id="ws-leave-desc">
          {ended
            ? 'Your workshop canvas stays in this browser until you clear it.'
            : `Your workshop canvas stays saved online and in this browser. To come back on any device, choose Workshop, then Return on a new device, and enter workshop code ${formatCode(code)}${rejoinCode ? ` and your rejoin code ${formatRejoinCode(rejoinCode)}` : ''}.`}
        </p>
        <form method="dialog" className="ws-form">
          <label className="ws-check">
            <input type="checkbox" checked={copyOnLeave} onChange={(e) => setCopyOnLeave(e.target.checked)} />
            Copy this canvas to my personal canvas (replaces what is there now)
          </label>
          <div className="dialog__actions">
            <button type="submit" className="btn" value="cancel">
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" value="leave" onClick={() => onLeave(copyOnLeave)}>
              Leave
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
