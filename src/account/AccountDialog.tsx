import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { initialState } from '../state/reducer';
import { parseState } from '../state/persist';
import { clearLinkParams, pendingOptIn, setPendingOptIn } from '../workshop/session';
import { timeAgo } from '../workshop/summary';
import type { SavedCanvas } from './api';
import { ACCOUNT_READY_EVENT, SIGNED_IN_EVENT } from './AccountSync';
import {
  activeSlot,
  announceAccountChange,
  OPEN_ACCOUNT_EVENT,
  setActiveSlot,
  setUnsentAccountChanges,
  type SlotId,
} from './session';
import { track } from '../analytics';

type View =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | { kind: 'sent'; email: string }
  | { kind: 'confirm' }
  | { kind: 'signedIn'; email: string };

const api = () => import('./api');
const reason = (err: unknown) =>
  ['HostSignInError', 'WorkshopError'].includes((err as Error)?.name)
    ? (err as Error).message
    : 'Something went wrong. Check your internet connection and try again.';

/** Free accounts: create one or sign in by email link, then open, start or delete up to three canvases. */
export function AccountDialog({ emailLink = false }: { emailLink?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const { state, dispatch } = useCanvas();
  const [view, setView] = useState<View>({ kind: 'checking' });
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [canvases, setCanvases] = useState<SavedCanvas[] | null>(null);
  const [current, setCurrent] = useState<SlotId | null>(activeSlot());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [now, setNow] = useState(0);

  const refresh = async (signedInEmail: string) => {
    setView({ kind: 'signedIn', email: signedInEmail });
    setCurrent(activeSlot());
    setCanvases(await (await api()).listCanvases().catch(() => []));
    setNow(Date.now());
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
    track('account-signed-in');
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
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

  /** Saves what is on screen to its slot before switching away. */
  const flush = async () => {
    const slot = activeSlot();
    if (slot) await (await api()).saveCanvas(slot, state);
    setUnsentAccountChanges(false);
  };

  const openCanvas = (c: SavedCanvas) =>
    run(async () => {
      if (c.slot === activeSlot()) return ref.current?.close();
      await flush();
      const next = parseState(c.state);
      if (next) dispatch({ type: 'load', state: next });
      setActiveSlot(c.slot);
      ref.current?.close();
      window.scrollTo(0, 0);
    });

  const newCanvas = () =>
    run(async () => {
      const a = await api();
      const free = a.SLOTS.find((s) => !canvases?.some((c) => c.slot === s));
      if (!free) return;
      await flush();
      const fresh = initialState();
      dispatch({ type: 'load', state: fresh });
      setActiveSlot(free);
      await a.saveCanvas(free, fresh);
      ref.current?.close();
      window.scrollTo(0, 0);
    });

  const removeCanvas = (c: SavedCanvas) =>
    run(async () => {
      const name = c.name || 'Untitled canvas';
      if (!window.confirm(`Delete "${name}" from your account? This cannot be undone.`)) return;
      const a = await api();
      await a.deleteCanvas(c.slot);
      if (c.slot === activeSlot()) {
        const rest = (canvases ?? []).filter((x) => x.slot !== c.slot);
        const next = rest[0] ? parseState(rest[0].state) : null;
        dispatch({ type: 'load', state: next ?? initialState() });
        setActiveSlot(rest[0]?.slot ?? c.slot);
      }
      setNote(`"${name}" deleted.`);
      await refresh((view as { email: string }).email);
    });

  const signOut = () =>
    run(async () => {
      await flush();
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
          ) : (
            <>
              <ul className="ws-host__list" aria-label="Saved canvases">
                {canvases.map((c) => (
                  <li key={c.slot}>
                    <span className="ws-host__title">
                      {c.name || 'Untitled canvas'}
                      {c.slot === current && <span className="acct__current"> (open now)</span>}
                    </span>
                    <span className="ws-hint">Saved {timeAgo(c.updatedAt, now)}</span>
                    <span className="acct__actions">
                      <button type="button" className="btn btn--small" onClick={() => openCanvas(c)}>
                        {c.slot === current ? 'Keep working' : 'Open'}
                        <span className="sr-only"> {c.name || 'Untitled canvas'}</span>
                      </button>
                      <button type="button" className="btn btn--small" onClick={() => removeCanvas(c)}>
                        Delete<span className="sr-only"> {c.name || 'Untitled canvas'}</span>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="ws-hint">
                {canvases.length} of 3 canvases saved.
                {!current &&
                  canvases.length >= 3 &&
                  ' The canvas on screen is not saved to your account. Delete one to save it.'}
              </p>
              {canvases.length < 3 && (
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
