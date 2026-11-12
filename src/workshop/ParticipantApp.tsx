import { useEffect, useRef, useState } from 'react';
import { CanvasProvider, useCanvas } from '../state/CanvasContext';
import { Toolbar } from '../components/Toolbar';
import { Footer } from '../components/Footer';
import { CanvasBody } from '../components/CanvasBody';
import { BackIcon } from '../components/Icons';
import {
  pushCanvas,
  signIn,
  watchCanvas,
  watchCanvases,
  watchComments,
  watchConnected,
  watchMembers,
  watchMeta,
  type Comment,
  type Member,
  type RemoteCanvas,
  type SessionMeta,
} from './api';
import { formatCode, spellCode } from './code';
import { workshopCanvasKey, type ActiveWorkshop } from './session';
import { CanvasView, CommentList, Gallery, useAnnouncer } from './ui';
import { clampStep, LAST_STEP, REVEAL_STEPS, STEP_ANCHORS } from '../state/cells';

type View = { kind: 'mine' } | { kind: 'gallery' } | { kind: 'other'; uid: string; name: string };
type Sync = 'ok' | 'offline' | 'error';

/** Sends this participant's canvas to the workshop shortly after each change. */
function CanvasSync({ code, uid, active, onResult }: { code: string; uid: string; active: boolean; onResult: (ok: boolean) => void }) {
  const { state } = useCanvas();
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => {
      pushCanvas(code, uid, state).then(
        () => onResult(true),
        () => onResult(false),
      );
    }, 500);
    return () => window.clearTimeout(t);
  }, [state, code, uid, active, onResult]);
  return null;
}

interface Props {
  workshop: ActiveWorkshop;
  onLeave: (copyToPersonal?: boolean) => void;
}

export default function ParticipantApp({ workshop, onLeave }: Props) {
  const { code, uid, name = '' } = workshop;
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<SessionMeta | null | undefined>(undefined);
  const [connected, setConnected] = useState(true);
  const [pushOk, setPushOk] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [canvases, setCanvases] = useState<Record<string, RemoteCanvas>>({});
  const [viewed, setViewed] = useState<{ uid: string; canvas: RemoteCanvas | null } | null>(null);
  const [view, setView] = useState<View>({ kind: 'mine' });
  const [revoked, setRevoked] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [announce, region] = useAnnouncer();
  const leaveRef = useRef<HTMLDialogElement>(null);
  const [copyOnLeave, setCopyOnLeave] = useState(false);
  const seenComments = useRef<number | null>(null);
  const returnFocus = useRef<string | null>(null);

  const ended = meta === null;
  const canView = Boolean(meta?.canView);
  const spotlight = meta?.spotlight ?? null;
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
      () => live && setReady(true),
      () => live && setMeta(null),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const offs = [watchMeta(code, setMeta), watchConnected(setConnected), watchComments(code, uid, setComments)];
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

  // Tell screen reader users about new comments, but not the ones already there on load.
  useEffect(() => {
    if (seenComments.current !== null && comments.length > seenComments.current) {
      announce('New comment from your facilitator.');
    }
    seenComments.current = comments.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length]);

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
        {revealed !== null && (
          <p className="ws-notice">
            New section revealed: <strong>{REVEAL_STEPS[revealed]}</strong>
            {revealed >= LAST_STEP && '. You can now see the full canvas.'}
            <button type="button" className="btn btn--small" onClick={goToRevealed}>
              Go to it
            </button>
            <button type="button" className="btn btn--small" onClick={() => setRevealed(null)}>
              Dismiss
            </button>
          </p>
        )}
        <div aria-live="polite">
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
        <CanvasProvider storageKey={workshopCanvasKey(code)}>
          <Toolbar />
          <CanvasSync code={code} uid={uid} active={ready && !ended} onResult={setPushOk} />
          {view.kind === 'mine' && <CanvasBody step={step} />}
        </CanvasProvider>
      </div>
      <Footer />
      {region}

      <dialog ref={leaveRef} className="dialog" aria-labelledby="ws-leave-title" aria-describedby="ws-leave-desc">
        <h2 id="ws-leave-title">Leave this workshop?</h2>
        <p id="ws-leave-desc">
          {ended
            ? 'Your workshop canvas stays in this browser until you clear it.'
            : `Your workshop canvas stays saved in this browser. You can rejoin with code ${formatCode(code)} while the workshop is running.`}
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
