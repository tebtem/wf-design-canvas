import { useEffect, useId, useState, type FormEvent } from 'react';
import { track } from '../analytics';
import { XIcon } from './Icons';

const KEY = 'wf-design-canvas:waitlist';
/** Fired after a milestone (finishing the guide, saving a PDF) to offer the waitlist once. */
export const MILESTONE_EVENT = 'wf:milestone';
export const celebrateMilestone = () => window.dispatchEvent(new Event(MILESTONE_EVENT));

const done = () => {
  try {
    return Boolean(window.localStorage.getItem(KEY));
  } catch {
    return false;
  }
};
const remember = (value: 'joined' | 'dismissed') => {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Not remembered; the card may show again after the next milestone.
  }
};

/** Corner card inviting people to the course and bootcamp waitlist (MailerLite "Canvas" group). */
export function WaitlistCard() {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'joined' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const show = () => {
      if (done()) return;
      setOpen(true);
      track('waitlist-shown');
    };
    window.addEventListener(MILESTONE_EVENT, show);
    return () => window.removeEventListener(MILESTONE_EVENT, show);
  }, []);

  const close = () => {
    if (status !== 'joined') remember('dismissed');
    setOpen(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Enter a valid email address.');
      setStatus('error');
      document.getElementById(`${uid}-email`)?.focus();
      return;
    }
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), company }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not join the waitlist right now. Please try again later.');
      remember('joined');
      setStatus('joined');
      track('waitlist-joined');
    } catch (err) {
      setError((err as Error).message);
      setStatus('error');
    }
  };

  if (!open) return null;
  return (
    <div className="ws-toast ws-toast--waitlist" role="region" aria-labelledby={`${uid}-title`}>
      <button type="button" className="icon-btn ws-toast__close" aria-label="Close waitlist invitation" onClick={close}>
        <XIcon />
      </button>
      <p id={`${uid}-title`} className="ws-toast__heading">
        Want to uplevel your facilitation design skills?
      </p>
      {status === 'joined' ? (
        <p role="status">You&apos;re on the waitlist! We&apos;ll be in touch.</p>
      ) : (
        <form className="waitlist" onSubmit={submit} noValidate>
          <label htmlFor={`${uid}-email`}>Email</label>
          <div className="waitlist__row">
            <input
              id={`${uid}-email`}
              className="ws-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={status === 'error' || undefined}
              aria-describedby={`${uid}-note${error ? ` ${uid}-err` : ''}`}
            />
            <button type="submit" className="btn btn--primary" aria-disabled={status === 'sending'}>
              {status === 'sending' ? 'Joining…' : 'Join the waitlist'}
            </button>
          </div>
          {/* Hidden from people; only bots fill it in. */}
          <input
            className="waitlist__trap"
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            name="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          {error && (
            <p id={`${uid}-err`} className="ws-error" role="alert">
              {error}
            </p>
          )}
          <p id={`${uid}-note`} className="ws-hint">
            Hear first about our facilitation design course and bootcamp. Unsubscribe anytime.{' '}
            <a href="./privacy.html" target="_blank" rel="noopener">
              Privacy notice<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </form>
      )}
    </div>
  );
}
