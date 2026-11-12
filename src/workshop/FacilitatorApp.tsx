import { useEffect, useRef, useState } from 'react';
import { Footer } from '../components/Footer';
import { Logo } from '../components/Header';
import { BackIcon, CopyIcon, SpotlightIcon } from '../components/Icons';
import {
  addComment,
  deleteComment,
  endSession,
  setCanView,
  setSpotlight,
  setStep,
  currentHost,
  watchAllComments,
  watchCanvases,
  watchConnected,
  watchMembers,
  watchMeta,
  watchRejoinCodes,
  type Comment,
  type Member,
  type RemoteCanvas,
  type SessionMeta,
} from './api';
import { formatCode, spellCode } from './code';
import { joinUrl, type ActiveWorkshop } from './session';
import { CanvasView, CommentsPanel, Gallery, useAnnouncer } from './ui';
import { RevealControls } from './RevealControls';
import { clampStep, LAST_STEP, REVEAL_STEPS } from '../state/cells';

interface Props {
  workshop: ActiveWorkshop;
  onExit: () => void;
}

export default function FacilitatorApp({ workshop, onExit }: Props) {
  const { code } = workshop;
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<SessionMeta | null | undefined>(undefined);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [canvases, setCanvases] = useState<Record<string, RemoteCanvas>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [rejoinCodes, setRejoinCodes] = useState<Record<string, string>>({});
  const [connected, setConnected] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const [announce, region] = useAnnouncer();
  const endRef = useRef<HTMLDialogElement>(null);
  const exitRef = useRef<HTMLDialogElement>(null);
  const knownMembers = useRef<Set<string> | null>(null);
  const lastOpened = useRef<string | null>(null);

  // The host view needs this device to be signed in as the facilitator who owns the workshop.
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    let live = true;
    currentHost().then(
      (host) => {
        if (!live) return;
        if (host?.uid === workshop.uid) setReady(true);
        else setSignedOut(true);
      },
      () => live && setMeta(null),
    );
    return () => {
      live = false;
    };
  }, [workshop.uid]);

  useEffect(() => {
    if (!ready) return;
    const offs = [
      watchMeta(code, setMeta),
      watchMembers(code, setMembers),
      watchCanvases(code, setCanvases),
      watchAllComments(code, setComments),
      watchConnected(setConnected),
      watchRejoinCodes(code, setRejoinCodes),
    ];
    return () => offs.forEach((off) => off());
  }, [ready, code]);

  // Announce people joining, but not everyone who was already there on load.
  useEffect(() => {
    const ids = Object.keys(members);
    if (knownMembers.current) {
      const fresh = ids.filter((id) => !knownMembers.current!.has(id));
      if (fresh.length === 1) announce(`${members[fresh[0]].name} joined.`);
      else if (fresh.length > 1) announce(`${fresh.length} people joined.`);
    }
    if (meta !== undefined) knownMembers.current = new Set(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  useEffect(() => {
    if (selected) document.getElementById('ws-view-title')?.focus();
    else if (lastOpened.current) {
      document.querySelector<HTMLElement>(`[data-uid="${lastOpened.current}"] .ws-card__open`)?.focus();
    }
  }, [selected]);

  const run = (p: Promise<unknown>, ok?: string) =>
    p.then(
      () => {
        setError('');
        if (ok) announce(ok);
      },
      () => setError('That did not save. Check your connection and try again.'),
    );

  const open = (uid: string | null) => {
    if (uid) lastOpened.current = uid;
    setSelected(uid);
    window.scrollTo(0, 0);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl(code));
      setCopied('Join link copied.');
    } catch {
      setCopied('Could not copy. Select the link and copy it yourself.');
    }
  };

  const end = async () => {
    try {
      await endSession(code);
      onExit();
    } catch {
      setError('Could not end the workshop. Check your connection and try again.');
    }
  };

  if (signedOut) {
    return (
      <main className="ws-page ws-ended">
        <h1 className="ws-h1">Sign in to open the host view</h1>
        <p>
          This device is no longer signed in as the facilitator for this workshop. Choose Workshop, then Host a
          workshop, and sign in with your facilitator email to reopen it.
        </p>
        <button type="button" className="btn btn--primary" onClick={onExit}>
          Back to my canvas
        </button>
      </main>
    );
  }

  if (meta === null) {
    return (
      <main className="ws-page ws-ended">
        <h1 className="ws-h1">This workshop has ended</h1>
        <p>It was ended or it expired, so its canvases are no longer online.</p>
        <button type="button" className="btn btn--primary" onClick={onExit}>
          Back to my canvas
        </button>
      </main>
    );
  }

  const entries = Object.entries(members)
    .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
    .map(([uid, m]) => ({
      uid,
      name: m.name,
      canvas: canvases[uid],
      comments: comments[uid]?.length ?? 0,
      rejoinCode: rejoinCodes[uid],
    }));
  const spotlight = meta?.spotlight ?? null;
  const step = clampStep(meta?.step);
  const changeStep = (next: number) =>
    run(
      setStep(code, next),
      next >= LAST_STEP
        ? 'All sections revealed.'
        : next > step
          ? `${REVEAL_STEPS[next]} revealed to participants.`
          : `${REVEAL_STEPS[step]} hidden from participants.`,
    );
  const person = selected ? members[selected] : null;

  return (
    <>
      <a className="skip-link" href={selected ? '#canvas' : '#ws-main'}>
        Skip to {selected ? 'canvas' : 'main content'}
      </a>
      <header className="ws-header no-print">
        <div className="ws-header__brand">
          <Logo />
          <p>
            Facilitation Design Canvas <span className="ws-header__role">Host view</span>
          </p>
        </div>
        <p className={`ws-bar__sync ws-bar__sync--${connected ? 'ok' : 'offline'}`} role="status">
          {connected ? 'Live' : 'Offline. Reconnecting…'}
        </p>
        <div className="ws-bar__actions">
          <button type="button" className="btn" onClick={() => exitRef.current?.showModal()}>
            Exit host view
          </button>
          <button type="button" className="btn btn--danger" onClick={() => endRef.current?.showModal()}>
            End workshop
          </button>
        </div>
      </header>
      {error && (
        <p className="ws-notice ws-notice--warn ws-page" role="alert">
          {error}
        </p>
      )}

      {selected ? (
        <div className="ws-page">
          <div className="ws-viewbar">
            <button type="button" className="btn" onClick={() => open(null)}>
              <BackIcon />
              Back to all canvases
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={spotlight?.uid === selected}
              onClick={() =>
                run(
                  setSpotlight(code, spotlight?.uid === selected ? null : { uid: selected, name: person?.name ?? '' }),
                  spotlight?.uid === selected
                    ? 'Spotlight stopped.'
                    : `Spotlighting ${person?.name}. Participants can open this canvas.`,
                )
              }
            >
              <SpotlightIcon />
              Spotlight for everyone
            </button>
          </div>
          <h1 id="ws-view-title" className="ws-h1" tabIndex={-1}>
            {person?.name ?? 'Participant'}&apos;s canvas <span className="ws-h1__note">(view only, live)</span>
          </h1>
          <div className="ws-detail">
            <div className="ws-detail__canvas">
              <CanvasView canvas={canvases[selected] ?? null} name={person?.name ?? 'This participant'} step={step} />
            </div>
            <CommentsPanel
              name={person?.name ?? 'this participant'}
              comments={comments[selected] ?? []}
              onAdd={(text, cellId) => addComment(code, selected, text, cellId)}
              onDelete={(id) => deleteComment(code, selected, id)}
            />
          </div>
        </div>
      ) : (
        <main id="ws-main" className="ws-page" tabIndex={-1}>
          <h1 className="ws-h1">{meta?.title ?? 'Workshop'}</h1>

          <div className="ws-host-grid">
            <section className="ws-join" aria-labelledby="ws-join-h">
              <h2 id="ws-join-h" className="ws-h2">
                Join code
              </h2>
              <p className="ws-code">
                <span aria-hidden="true">{formatCode(code)}</span>
                <span className="sr-only">{spellCode(code)}</span>
              </p>
              <p>Participants open the canvas, choose Workshop, and enter this code. Or send them this link:</p>
              <p className="ws-link">
                <a href={joinUrl(code)}>{joinUrl(code)}</a>
              </p>
              <button type="button" className="btn" onClick={copyLink}>
                <CopyIcon />
                Copy join link
              </button>
              <p className="ws-hint" role="status">
                {copied}
              </p>
            </section>

            <section className="ws-settings" aria-labelledby="ws-set-h">
              <h2 id="ws-set-h" className="ws-h2">
                Sharing
              </h2>
              <label className="ws-check">
                <input
                  type="checkbox"
                  checked={Boolean(meta?.canView)}
                  aria-describedby="ws-canview-hint"
                  onChange={(e) =>
                    run(
                      setCanView(code, e.target.checked),
                      e.target.checked
                        ? 'Participants can now see each other’s canvases.'
                        : 'Participants now see only their own canvas.',
                    )
                  }
                />
                Participants can see each other&apos;s canvases
              </label>
              <p id="ws-canview-hint" className="ws-hint">
                View only. Your comments always stay private to each participant.
              </p>
              <p className="ws-spot">
                {spotlight ? (
                  <>
                    Spotlighting <strong>{spotlight.name}</strong>. Everyone can open this canvas.{' '}
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => run(setSpotlight(code, null), 'Spotlight stopped.')}
                    >
                      Stop spotlight
                    </button>
                  </>
                ) : (
                  'No canvas is spotlighted. Open a canvas to spotlight it for the group.'
                )}
              </p>
            </section>
          </div>

          <RevealControls step={step} onChange={changeStep} />

          <section aria-labelledby="ws-people-h">
            <h2 id="ws-people-h" className="ws-h2">
              Participants ({entries.length})
            </h2>
            <Gallery
              entries={entries}
              spotlightUid={spotlight?.uid}
              onOpen={open}
              empty="Nobody has joined yet. Share the code above to get started."
            />
          </section>
        </main>
      )}
      <Footer />
      {region}

      <dialog ref={endRef} className="dialog" aria-labelledby="ws-end-title" aria-describedby="ws-end-desc">
        <h2 id="ws-end-title">End the workshop for everyone?</h2>
        <p id="ws-end-desc">
          This deletes every participant&apos;s canvas and your comments from the workshop. Participants keep their own
          copy in their browsers. It cannot be undone.
        </p>
        <form method="dialog" className="dialog__actions">
          <button type="submit" className="btn" value="cancel">
            Cancel
          </button>
          <button type="submit" className="btn btn--danger" value="end" onClick={end}>
            End workshop
          </button>
        </form>
      </dialog>

      <dialog ref={exitRef} className="dialog" aria-labelledby="ws-exit-title" aria-describedby="ws-exit-desc">
        <h2 id="ws-exit-title">Exit the host view?</h2>
        <p id="ws-exit-desc">
          The workshop keeps running. To come back on any device, sign in with your facilitator email (Workshop, then
          Host a workshop) and open it from Your workshops. Its code is {formatCode(code)}.
        </p>
        <form method="dialog" className="dialog__actions">
          <button type="submit" className="btn" value="cancel">
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" value="exit" onClick={onExit}>
            Exit host view
          </button>
        </form>
      </dialog>
    </>
  );
}
