import { useEffect, useId, useState, type FormEvent } from 'react';
import { LAST_STEP } from '../state/cells';
import { formatCode, normalizeCode, spellCode } from '../workshop/code';
import { clearLinkParams, hostSignedInEmail, type ActiveWorkshop } from '../workshop/session';
import type { HostedWorkshop } from '../workshop/api';

interface Props {
  /** The page was opened from an emailed sign-in link. */
  emailLink: boolean;
  onEnter: (w: ActiveWorkshop) => void;
}

type View =
  | { kind: 'checking' }
  | { kind: 'signedOut' }
  | { kind: 'sent'; email: string }
  | { kind: 'confirm' }
  | { kind: 'signedIn'; uid: string; email: string };

const api = () => import('../workshop/api');
/** Firebase's reasons, in plain words, so a setup problem says what to fix. */
const FIREBASE_REASONS: Record<string, string> = {
  'auth/unauthorized-continue-uri': `This site's address (${window.location.hostname}) is not approved in Firebase. Add it under Authentication > Settings > Authorized domains.`,
  'auth/unauthorized-domain': `This site's address (${window.location.hostname}) is not approved in Firebase. Add it under Authentication > Settings > Authorized domains.`,
  'auth/operation-not-allowed': 'Email link sign-in is turned off in Firebase. Turn on Email/Password with Email link (passwordless sign-in) under Authentication > Sign-in method.',
  'auth/admin-restricted-operation': 'Anonymous sign-in is turned off in Firebase. Turn it on under Authentication > Sign-in method.',
  'auth/invalid-api-key': 'The Firebase API key in the site settings is wrong. Check VITE_FIREBASE_API_KEY in Vercel and redeploy.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'The Firebase API key in the site settings is wrong. Check VITE_FIREBASE_API_KEY in Vercel and redeploy.',
  'auth/invalid-email': 'That email address does not look right. Check it and try again.',
  'auth/quota-exceeded': 'Firebase has sent its daily limit of sign-in emails. Try again tomorrow.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Could not reach Firebase. Check your internet connection and try again.',
  'auth/invalid-action-code': 'That sign-in link has expired or was already used. Request a new one.',
  'auth/expired-action-code': 'That sign-in link has expired. Request a new one.',
};

const errorText = (err: unknown) => {
  const e = err as { name?: string; message?: string; code?: string };
  if (e?.name === 'HostSignInError' || e?.name === 'WorkshopError') return e.message ?? '';
  console.error(err);
  if (e?.code && FIREBASE_REASONS[e.code]) return FIREBASE_REASONS[e.code];
  if (e?.code?.startsWith('auth/requests-from-referer')) {
    return `The Firebase API key is restricted to other websites. In Google Cloud Console > APIs & Services > Credentials, allow ${window.location.hostname} on the Browser key.`;
  }
  if (e?.code?.startsWith('auth/')) return `Sign-in failed (${e.code}). Check the Firebase sign-in settings.`;
  if (String(e?.message).toLowerCase().includes('permission')) {
    return 'The database refused this. Check that the latest rules from database.rules.json are published in Firebase.';
  }
  return 'Could not connect. Check your internet connection and try again.';
};

/** Facilitator sign-in (email link), their workshops, and starting a new one. */
export function HostPanel({ emailLink, onEnter }: Props) {
  const uid = useId();
  const [view, setView] = useState<View>({ kind: 'checking' });
  const [email, setEmail] = useState(hostSignedInEmail() ?? '');
  const [title, setTitle] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [guided, setGuided] = useState(true);
  const [workshops, setWorkshops] = useState<HostedWorkshop[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const showSignedIn = async (host: { uid: string; email: string }) => {
    setView({ kind: 'signedIn', ...host });
    setWorkshops(await (await api()).listMyWorkshops().catch(() => []));
  };

  useEffect(() => {
    let live = true;
    (async () => {
      const a = await api();
      if (emailLink && a.isHostLink(window.location.href)) {
        try {
          await a.completeHostSignIn(window.location.href);
          clearLinkParams();
        } catch (err) {
          if (!live) return;
          if ((err as Error).message.startsWith('Confirm')) return setView({ kind: 'confirm' });
          clearLinkParams();
          setError(errorText(err));
        }
      }
      const host = await a.currentHost();
      if (!live) return;
      if (host) await showSignedIn(host);
      else setView((v) => (v.kind === 'checking' ? { kind: 'signedOut' } : v));
    })();
    return () => {
      live = false;
    };
     
  }, [emailLink]);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const sendLink = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError('Enter your email.');
    void run(async () => {
      await (await api()).sendHostLink(email);
      setView({ kind: 'sent', email: email.trim().toLowerCase() });
    });
  };

  const confirm = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const a = await api();
      await a.completeHostSignIn(window.location.href, email);
      clearLinkParams();
      const host = await a.currentHost();
      if (host) await showSignedIn(host);
    });
  };

  /** Co-facilitating: open someone else's workshop in the host view by its code. */
  const openByCode = (e: FormEvent) => {
    e.preventDefault();
    const c = normalizeCode(joinCode);
    if (!c) return setError('Enter the 6-character workshop code, like ABC-234.');
    void run(async () => {
      const res = await (await api()).joinSession(c, '');
      onEnter({ code: c, role: 'facilitator', uid: res.uid });
    });
  };

  const start = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await (await api()).createSession(title.trim() || 'Workshop', guided ? 0 : LAST_STEP);
      onEnter({ code: res.code, role: 'facilitator', uid: res.uid });
    });
  };

  const errorBox = error && (
    <p id={`${uid}-error`} className="ws-error" role="alert">
      {error}
    </p>
  );

  if (view.kind === 'checking') {
    return (
      <p className="ws-hint" role="status">
        Checking your facilitator sign-in…
      </p>
    );
  }

  if (view.kind === 'signedOut' || view.kind === 'confirm') {
    const confirming = view.kind === 'confirm';
    return (
      <form className="ws-form" onSubmit={confirming ? confirm : sendLink} noValidate>
        <p>
          {confirming
            ? 'Confirm the email you used to request this sign-in link.'
            : 'Facilitators sign in with a link sent to their email. No password needed.'}
        </p>
        {errorBox}
        <label htmlFor={`${uid}-email`}>Facilitator email</label>
        <input
          id={`${uid}-email`}
          className="ws-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${uid}-error` : undefined}
        />
        <div className="dialog__actions">
          <button type="submit" className="btn btn--primary" aria-disabled={busy}>
            {busy ? 'Working…' : confirming ? 'Finish signing in' : 'Email me a sign-in link'}
          </button>
        </div>
      </form>
    );
  }

  if (view.kind === 'sent') {
    return (
      <div className="ws-form" role="status">
        <p>
          Check your inbox at <strong>{view.email}</strong> for a sign-in link. Open it in this browser on this device.
        </p>
        <p className="ws-hint">It can take a minute to arrive. Check spam if you don&apos;t see it.</p>
        <button type="button" className="btn btn--small" onClick={() => setView({ kind: 'signedOut' })}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="ws-host">
      <p className="ws-host__who">
        Signed in as <strong>{view.email}</strong>{' '}
        <button
          type="button"
          className="btn btn--small"
          onClick={() =>
            void run(async () => {
              await (await api()).signOutHost();
              setView({ kind: 'signedOut' });
            })
          }
        >
          Sign out
        </button>
      </p>
      {errorBox}

      <section aria-labelledby={`${uid}-mine`}>
        <h3 id={`${uid}-mine`} className="ws-host__h">
          Your workshops
        </h3>
        {workshops === null ? (
          <p className="ws-hint">Loading…</p>
        ) : workshops.length === 0 ? (
          <p className="ws-hint">No active workshops.</p>
        ) : (
          <ul className="ws-host__list">
            {workshops.map((w) => (
              <li key={w.code}>
                <span className="ws-host__title">{w.title}</span>
                <span className="ws-hint">
                  <span aria-hidden="true">{formatCode(w.code)}</span>
                  <span className="sr-only">code {spellCode(w.code)}</span> · ends{' '}
                  {new Date(w.expiresAt).toLocaleDateString()}
                </span>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => onEnter({ code: w.code, role: 'facilitator', uid: view.uid })}
                >
                  Open<span className="sr-only"> {w.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="ws-form" onSubmit={openByCode} noValidate>
        <h3 className="ws-host__h">Co-facilitating?</h3>
        <label htmlFor={`${uid}-code`}>Workshop code</label>
        <div className="ws-inline">
          <input
            id={`${uid}-code`}
            className="ws-input ws-input--code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={9}
          />
          <button type="submit" className="btn" aria-disabled={busy}>
            Open host view
          </button>
        </div>
      </form>

      <form className="ws-form" onSubmit={start} noValidate>
        <h3 className="ws-host__h">Start a new workshop</h3>
        <label htmlFor={`${uid}-title`}>Workshop name</label>
        <input
          id={`${uid}-title`}
          className="ws-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Workshop"
          maxLength={80}
        />
        <label className="ws-check">
          <input type="checkbox" checked={guided} onChange={(e) => setGuided(e.target.checked)} />
          Guide participants through the canvas one section at a time (you can reveal everything at any point)
        </label>
        <div className="dialog__actions">
          <button type="submit" className="btn btn--primary" aria-disabled={busy}>
            {busy ? 'Starting…' : 'Start workshop'}
          </button>
        </div>
      </form>
    </div>
  );
}
