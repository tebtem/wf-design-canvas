import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { initialState } from '../state/reducer';
import { parseState } from '../state/persist';
import { clearLinkParams, pendingOptIn, setPendingOptIn } from '../workshop/session';
import { timeAgo } from '../workshop/summary';
import { isAllowedHostEmail } from '../workshop/config';
import type { Slot } from './api';
import type { TeamCanvas } from './team';
import { ACCOUNT_READY_EVENT, SIGNED_IN_EVENT } from './AccountSync';
import {
  activeSlot,
  announceAccountChange,
  flushTeam,
  isSlot,
  isTeamKey,
  OPEN_ACCOUNT_EVENT,
  releaseTeam,
  setActiveSlot,
  setUnsentAccountChanges,
  teamKey,
  type CanvasKey,
} from './session';
import { track } from '../analytics';

/** A saved canvas: one of the three account slots, or a facilitator canvas (unlimited, shareable). */
interface Item {
  key: CanvasKey;
  name: string;
  state: string;
  updatedAt: number;
  slot?: Slot;
  team?: TeamCanvas;
  /** Facilitator canvases shared with you belong to someone else. */
  owned: boolean;
}

type View =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | { kind: 'sent'; email: string }
  | { kind: 'confirm' }
  | { kind: 'signedIn'; email: string };

const api = () => import('./api');
const teamApi = () => import('./team');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const reason = (err: unknown) =>
  ['HostSignInError', 'WorkshopError'].includes((err as Error)?.name)
    ? (err as Error).message
    : (err as Error)?.name === 'ShareError'
      ? (err as Error).message
      : 'Something went wrong. Check your internet connection and try again.';

/**
 * Free accounts: create one or sign in by email link, then open, start or delete up to three canvases.
 * Facilitators (the host allowlist) can save as many as they like and share them with each other.
 */
export function AccountDialog({ emailLink = false }: { emailLink?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const { state, dispatch } = useCanvas();
  const [view, setView] = useState<View>({ kind: 'checking' });
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [canvases, setCanvases] = useState<Item[] | null>(null);
  const [current, setCurrent] = useState<CanvasKey | null>(activeSlot());
  const [host, setHost] = useState(false);
  const [sharing, setSharing] = useState<Item | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [shareError, setShareError] = useState('');
  const shareHeading = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [now, setNow] = useState(0);

  const loadItems = async (signedInEmail: string): Promise<Item[]> => {
    const a = await api();
    const slots = await a.listCanvases().catch(() => []);
    const items: Item[] = slots.map((c) => ({ key: c.slot, name: c.name, state: c.state, updatedAt: c.updatedAt, slot: c.slot, owned: true }));
    if (isAllowedHostEmail(signedInEmail)) {
      const t = await teamApi();
      const me = await a.currentAccount();
      const shared = await t.listTeamCanvases().catch(() => []);
      items.push(
        ...shared.map((c) => ({ key: teamKey(c.id), name: c.name, state: c.state, updatedAt: c.updatedAt, team: c, owned: c.owner === me?.uid })),
      );
    }
    return items.sort((x, y) => y.updatedAt - x.updatedAt);
  };

  const refresh = async (signedInEmail: string) => {
    setView({ kind: 'signedIn', email: signedInEmail });
    setHost(isAllowedHostEmail(signedInEmail));
    setCurrent(activeSlot());
    const items = await loadItems(signedInEmail);
    setCanvases(items);
    setNow(Date.now());
    return items;
  };

  const check = async () => {
    const a = await api();
    const acct = await a.currentAccount().catch(() => null);
    if (acct) await refresh(acct.email);
    else setView({ kind: 'signedOut' });
  };

  const finishSignIn = async (confirmEmail?: string) => {
    const a = await api();
    const signedIn = await a.completeEmailSignIn(window.location.href, confirmEmail);
    clearLinkParams();
    if (pendingOptIn()) {
      await a.subscribeToUpdates(signedIn);
      setPendingOptIn(false);
      track('updates-opt-in');
    }
    announceAccountChange();
    // List the canvases once the one on screen has moved into the account.
    window.addEventListener(ACCOUNT_READY_EVENT, () => void refresh(signedIn), { once: true });
    window.dispatchEvent(new Event(SIGNED_IN_EVENT));
    setNote('You are signed in. Your canvas now saves to your account.');
  };

  const show = () => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    setError('');
    setNote('');
    setSharing(null);
    void check();
  };

  useEffect(() => {
    window.addEventListener(OPEN_ACCOUNT_EVENT, show);
    if (emailLink) {
      ref.current?.showModal();
      (async () => {
        const a = await api();
        if (!a.isEmailLink(window.location.href)) return check();
        try {
          await finishSignIn();
        } catch (err) {
          if ((err as Error).message.startsWith('Confirm')) return setView({ kind: 'confirm' });
          clearLinkParams();
          setError(reason(err));
          setView({ kind: 'signedOut' });
        }
      })();
    }
    return () => window.removeEventListener(OPEN_ACCOUNT_EVENT, show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(reason(err));
    } finally {
      setBusy(false);
    }
  };

  const sendLink = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      document.getElementById(`${uid}-email`)?.focus();
      return;
    }
    void run(async () => {
      setPendingOptIn(optIn);
      await (await api()).sendAccountLink(email);
      setView({ kind: 'sent', email: email.trim().toLowerCase() });
    });
  };

  /** Saves what is on screen before switching away. */
  const flush = async () => {
    const slot = activeSlot();
    if (isSlot(slot)) await (await api()).saveCanvas(slot, state);
    else if (isTeamKey(slot)) await flushTeam();
    setUnsentAccountChanges(false);
  };

  const signedInEmail = () => (view as { email: string }).email;
  const title = (c: Item) => c.name || 'Untitled canvas';

  const openCanvas = (c: Item) =>
    run(async () => {
      if (c.key === activeSlot()) return ref.current?.close();
      await flush();
      const next = parseState(c.state);
      if (next) dispatch({ type: 'load', state: next });
      setActiveSlot(c.key);
      ref.current?.close();
      window.scrollTo(0, 0);
    });

  const newCanvas = () =>
    run(async () => {
      const a = await api();
      const fresh = initialState();
      if (host) {
        // Facilitators: no limit, and every new canvas can be shared.
        await flush();
        const id = await (await teamApi()).createTeamCanvas(fresh);
        dispatch({ type: 'load', state: fresh });
        setActiveSlot(teamKey(id));
      } else {
        const free = a.SLOTS.find((s) => !canvases?.some((c) => c.slot === s));
        if (!free) return;
        await flush();
        dispatch({ type: 'load', state: fresh });
        setActiveSlot(free);
        await a.saveCanvas(free, fresh);
      }
      ref.current?.close();
      window.scrollTo(0, 0);
    });

  /** Before removing the open canvas from this list, switch to the next one (or a blank canvas). */
  const switchAwayFrom = (c: Item) => {
    if (c.key !== activeSlot()) return;
    const rest = (canvases ?? []).filter((x) => x.key !== c.key);
    const next = rest[0] ? parseState(rest[0].state) : null;
    dispatch({ type: 'load', state: next ?? initialState() });
    setActiveSlot(rest[0]?.key ?? (c.slot ?? null));
  };

  const removeCanvas = (c: Item) =>
    run(async () => {
      const shared = (c.team?.members.length ?? 0) > 0;
      const msg = shared
        ? `Delete "${title(c)}"? It is also removed for everyone you shared it with. This cannot be undone.`
        : `Delete "${title(c)}" from your account? This cannot be undone.`;
      if (!window.confirm(msg)) return;
      if (c.team) {
        switchAwayFrom(c);
        await (await teamApi()).deleteTeamCanvas(c.team);
      } else if (c.slot) {
        await (await api()).deleteCanvas(c.slot);
        switchAwayFrom(c);
      }
      setNote(`"${title(c)}" deleted.`);
      await refresh(signedInEmail());
    });

  const leaveCanvas = (c: Item) =>
    run(async () => {
      if (!c.team) return;
      const owner = c.team.ownerEmail;
      if (!window.confirm(`Remove "${title(c)}" from your canvases? ${owner} can share it with you again.`)) return;
      switchAwayFrom(c);
      await (await teamApi()).leaveTeamCanvas(c.team.id);
      setNote(`"${title(c)}" removed from your canvases.`);
      await refresh(signedInEmail());
    });

  const openShare = (c: Item) => {
    setSharing(c);
    setShareEmail('');
    setShareError('');
    setNote('');
    setError('');
    window.setTimeout(() => shareHeading.current?.focus(), 0);
  };

  const closeShare = () => {
    const key = sharing?.key;
    setSharing(null);
    setShareError('');
    // Back to the Share button of the canvas that was being shared.
    window.setTimeout(() => document.getElementById(`${uid}-share-${key}`)?.focus(), 0);
  };

  const shareInvalid = (msg: string) => {
    setShareError(msg);
    document.getElementById(`${uid}-share-email`)?.focus();
  };

  const share = (e: FormEvent) => {
    e.preventDefault();
    if (!sharing) return;
    const to = shareEmail.trim().toLowerCase();
    const me = signedInEmail().toLowerCase();
    if (!EMAIL_RE.test(to)) return shareInvalid('Enter a valid email address.');
    if (!isAllowedHostEmail(to)) return shareInvalid('Canvases can only be shared with approved facilitators.');
    if (to === me) return shareInvalid('That is your own email. Enter the email of the person to share with.');
    if (sharing.team?.members.includes(to)) return shareInvalid(`Already shared with ${to}.`);
    setShareError('');
    void run(async () => {
      const t = await teamApi();
      let id = sharing.team?.id;
      if (!id && sharing.slot) {
        // Saved in one of the three account slots: move it to facilitator canvases so it can be shared.
        const open = sharing.key === activeSlot();
        if (open) await flush();
        const s = open ? state : parseState(sharing.state);
        if (!s) return;
        id = await t.createTeamCanvas(s);
        await (await api()).deleteCanvas(sharing.slot);
        if (open) setActiveSlot(teamKey(id));
      }
      if (!id) return;
      await t.shareTeamCanvas(id, to);
      const items = await refresh(signedInEmail());
      setSharing(items.find((c) => c.key === teamKey(id!)) ?? null);
      setShareEmail('');
      setNote(`Shared with ${to}. It appears in their canvases next time they open My canvases.`);
    });
  };

  const unshare = (email: string) =>
    run(async () => {
      if (!sharing?.team) return;
      await (await teamApi()).unshareTeamCanvas(sharing.team.id, email);
      const items = await refresh(signedInEmail());
      setSharing(items.find((c) => c.key === sharing.key) ?? null);
      setNote(`Stopped sharing with ${email}.`);
    });

  const signOut = () =>
    run(async () => {
      await flush();
      await releaseTeam();
      await (await api()).signOut();
      // Your canvases stay in your account; this browser no longer keeps a copy.
      setActiveSlot(null);
      dispatch({ type: 'reset' });
      announceAccountChange();
      setView({ kind: 'signedOut' });
      setNote('Signed out. Your canvases are saved in your account.');
    });

  const deleteAccount = () =>
    run(async () => {
      if (
        !window.confirm(
          'Delete your account and all your saved canvases? This cannot be undone. (To stop emails, use the unsubscribe link in any email from us.)',
        )
      )
        return;
      await releaseTeam();
      await (await api()).deleteAccount();
      setActiveSlot(null);
      dispatch({ type: 'reset' });
      announceAccountChange();
      setView({ kind: 'signedOut' });
      setNote('Your account and saved canvases were deleted.');
    });

  const titleText = view.kind === 'signedIn' ? 'My canvases' : 'Save your canvas, and open it anywhere';

  return (
    <dialog ref={ref} className="dialog dialog--wide" aria-labelledby={`${uid}-h`}>
      <h2 id={`${uid}-h`}>{titleText}</h2>
      {note && (
        <p className="ws-notice acct__note" role="status">
          {note}
        </p>
      )}
      {error && (
        <p id={`${uid}-err`} className="ws-error" role="alert">
          {error}
        </p>
      )}

      {view.kind === 'checking' && (
        <p className="ws-hint" role="status">
          Checking…
        </p>
      )}

      {(view.kind === 'signedOut' || view.kind === 'confirm') && (
        <form
          className="ws-form"
          noValidate
          onSubmit={
            view.kind === 'confirm'
              ? (e) => {
                  e.preventDefault();
                  void run(() => finishSignIn(email));
                }
              : sendLink
          }
        >
          <p>
            {view.kind === 'confirm'
              ? 'Confirm the email you used to request this link.'
              : 'Create a free account, or sign in. No password needed.'}
          </p>
          <label htmlFor={`${uid}-email`}>Email</label>
          <input
            id={`${uid}-email`}
            className="ws-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${uid}-err` : undefined}
          />
          {view.kind === 'signedOut' && (
            <label className="ws-check">
              <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
              Email me about upcoming facilitation courses and bootcamps
            </label>
          )}
          <p className="ws-hint">
            Your saved canvases are private to you.{' '}
            <a href="./privacy.html" target="_blank" rel="noopener">
              Privacy notice<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              Close
            </button>
            <button type="submit" className="btn btn--primary" aria-disabled={busy}>
              {busy ? 'Working…' : view.kind === 'confirm' ? 'Finish signing in' : 'Email me a sign-in link'}
            </button>
          </div>
        </form>
      )}

      {view.kind === 'sent' && (
        <div className="ws-form" role="status">
          <p>
            Check your inbox at <strong>{view.email}</strong> for a sign-in link. Open it in this browser on this
            device.
          </p>
          <p className="ws-hint">It can take a minute to arrive. Check spam if you don&apos;t see it.</p>
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => setView({ kind: 'signedOut' })}>
              Use a different email
            </button>
            <button type="button" className="btn btn--primary" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
        </div>
      )}

      {view.kind === 'signedIn' && (
        <div className="ws-host">
          <p className="ws-host__who">
            Signed in as <strong>{view.email}</strong>
          </p>
          {canvases === null ? (
            <p className="ws-hint">Loading your canvases…</p>
          ) : sharing ? (
            <div className="acct-share">
              <h3 ref={shareHeading} tabIndex={-1} className="acct-share__title">
                Share “{title(sharing)}”
              </h3>
              <p className="ws-hint">
                Share with other facilitators. One person edits at a time, and everyone else sees the changes as they
                happen.
              </p>
              <ul className="acct-share__list" aria-label="People with access">
                <li>
                  <span>{view.email}</span>
                  <span className="ws-hint">Owner (you)</span>
                </li>
                {(sharing.team?.members ?? []).map((m) => (
                  <li key={m}>
                    <span>{m}</span>
                    <button type="button" className="btn btn--small" onClick={() => unshare(m)}>
                      Stop sharing<span className="sr-only"> with {m}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <form className="ws-form" noValidate onSubmit={share}>
                <label htmlFor={`${uid}-share-email`}>Facilitator&apos;s email</label>
                <div className="acct-share__row">
                  <input
                    id={`${uid}-share-email`}
                    className="ws-input"
                    type="email"
                    autoComplete="off"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    aria-invalid={Boolean(shareError) || undefined}
                    aria-describedby={shareError ? `${uid}-share-err` : `${uid}-share-hint`}
                  />
                  <button type="submit" className="btn btn--primary" aria-disabled={busy}>
                    {busy ? 'Sharing…' : 'Share'}
                  </button>
                </div>
                {shareError ? (
                  <p id={`${uid}-share-err`} className="ws-error" role="alert">
                    {shareError}
                  </p>
                ) : (
                  <p id={`${uid}-share-hint`} className="ws-hint">
                    Only facilitators approved to host workshops can be added.
                  </p>
                )}
              </form>
              <button type="button" className="btn" onClick={closeShare}>
                Back to my canvases
              </button>
            </div>
          ) : (
            <>
              <ul className="ws-host__list" aria-label="Saved canvases">
                {canvases.map((c) => {
                  const shareInfo = c.team
                    ? c.owned
                      ? c.team.members.length
                        ? `Shared with ${c.team.members.join(', ')}`
                        : ''
                      : `Shared by ${c.team.ownerEmail}`
                    : '';
                  return (
                    <li key={c.key}>
                      <span className="ws-host__title">
                        {title(c)}
                        {c.key === current && <span className="acct__current"> (open now)</span>}
                      </span>
                      <span className="ws-hint">
                        Saved {timeAgo(c.updatedAt, now)}
                        {shareInfo && <span className="acct__shared">{shareInfo}</span>}
                      </span>
                      <span className="acct__actions">
                        <button type="button" className="btn btn--small" onClick={() => openCanvas(c)}>
                          {c.key === current ? 'Keep working' : 'Open'}
                          <span className="sr-only"> {title(c)}</span>
                        </button>
                        {host && c.owned && (
                          <button
                            type="button"
                            id={`${uid}-share-${c.key}`}
                            className="btn btn--small"
                            onClick={() => openShare(c)}
                          >
                            Share<span className="sr-only"> {title(c)}</span>
                          </button>
                        )}
                        {c.owned ? (
                          <button type="button" className="btn btn--small" onClick={() => removeCanvas(c)}>
                            Delete<span className="sr-only"> {title(c)}</span>
                          </button>
                        ) : (
                          <button type="button" className="btn btn--small" onClick={() => leaveCanvas(c)}>
                            Remove<span className="sr-only"> {title(c)} from my canvases</span>
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {host ? (
                <p className="ws-hint">
                  {canvases.length} {canvases.length === 1 ? 'canvas' : 'canvases'}. As a facilitator you can save as
                  many as you like and share them with other facilitators.
                </p>
              ) : (
                <p className="ws-hint">
                  {canvases.length} of 3 canvases saved.
                  {!current &&
                    canvases.length >= 3 &&
                    ' The canvas on screen is not saved to your account. Delete one to save it.'}
                </p>
              )}
              {(host || canvases.length < 3) && (
                <button type="button" className="btn" onClick={newCanvas}>
                  Start a new canvas
                </button>
              )}
            </>
          )}
          <div className="dialog__actions acct__footer">
            <button type="button" className="btn btn--small" onClick={deleteAccount}>
              Delete my account
            </button>
            <button type="button" className="btn btn--small" onClick={signOut}>
              Sign out
            </button>
            <button type="button" className="btn btn--primary" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
