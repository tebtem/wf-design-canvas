import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { parseState, readState, saveState } from '../state/persist';
import { HostPanel } from './HostPanel';
import { normalizeCode, normalizeRejoinCode } from '../workshop/code';
import { RETENTION_DAYS } from '../workshop/config';
import { hostSignedInEmail, workshopCanvasKey, type ActiveWorkshop } from '../workshop/session';

interface Props {
  open: boolean;
  initialCode: string;
  /** Opened from the facilitator link or an emailed sign-in link: show hosting. */
  hostEntry?: boolean;
  emailLink?: boolean;
  onClose: () => void;
  onEnter: (w: ActiveWorkshop) => void;
}

type Field = 'code' | 'name' | 'rejoin' | null;

export function WorkshopDialog({ open, initialCode, hostEntry = false, emailLink = false, onClose, onEnter }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { state } = useCanvas();
  const uid = useId();
  const [mode, setMode] = useState<'join' | 'return' | 'host'>(hostEntry ? 'host' : 'join');
  // Only facilitators see hosting: those signed in on this device, or arriving from the facilitator link.
  const canHost = hostEntry || Boolean(hostSignedInEmail());
  const [rejoin, setRejoin] = useState('');
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [copyCurrent, setCopyCurrent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: Field; text: string } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Start on the selected choice (Host when arriving from the facilitator link).
      d.querySelector<HTMLInputElement>('input[name="ws-mode"]:checked')?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const fail = (field: Field, text: string) => {
    setError({ field, text });
    if (field) document.getElementById(`${uid}-${field}`)?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const c = normalizeCode(code);
    if (!c) return fail('code', 'Enter the 6-character code from your facilitator, like ABC-234.');
    const k = normalizeRejoinCode(rejoin);
    if (mode === 'return' && !k) return fail('rejoin', 'Enter your 8-character rejoin code, like KQ7M-X3PA.');
    setBusy(true);
    try {
      const api = await import('../workshop/api');
      if (mode === 'return') {
        const res = await api.rejoinSession(c!, k!);
        const key = workshopCanvasKey(c!);
        const remote = parseState(await api.fetchOwnCanvas(c!, res.pid));
        if (remote || !readState(key)) saveState(remote ?? state, key);
        onEnter({ code: c!, role: 'participant', uid: res.pid, name: res.name });
        return;
      }
      const res = await api.joinSession(c!, name.trim());
      if (res.role === 'facilitator') {
        onEnter({ code: c!, role: 'facilitator', uid: res.uid });
        return;
      }
      const key = workshopCanvasKey(c!);
      if (!readState(key)) {
        const seed = parseState(await api.fetchOwnCanvas(c!, res.uid)) ?? (copyCurrent ? state : null);
        if (seed) saveState(seed, key);
      }
      onEnter({ code: c!, role: 'participant', uid: res.uid, name: name.trim() });
    } catch (err) {
      console.error(err);
      const known = (err as Error)?.name === 'WorkshopError';
      fail(
        known ? ((err as { field?: Field }).field ?? 'code') : null,
        known ? (err as Error).message : 'Could not connect. Check your internet connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const fieldProps = (field: Exclude<Field, null>) => ({
    id: `${uid}-${field}`,
    'aria-invalid': error?.field === field || undefined,
    'aria-describedby': [`${uid}-${field}-hint`, error?.field === field ? `${uid}-error` : '']
      .filter(Boolean)
      .join(' '),
  });

  return (
    <dialog ref={ref} className="dialog dialog--wide" aria-labelledby={`${uid}-heading`} onClose={onClose}>
      <h2 id={`${uid}-heading`}>Workshop</h2>
      <fieldset className="ws-choice">
        <legend>What would you like to do?</legend>
        <label>
          <input type="radio" name="ws-mode" checked={mode === 'join'} onChange={() => setMode('join')} />
          Join a workshop
        </label>
        <label>
          <input type="radio" name="ws-mode" checked={mode === 'return'} onChange={() => setMode('return')} />
          Return on a new device
        </label>
        {canHost && (
          <label>
            <input type="radio" name="ws-mode" checked={mode === 'host'} onChange={() => setMode('host')} />
            Host a workshop
          </label>
        )}
      </fieldset>
      {mode === 'host' ? (
        <>
          <HostPanel emailLink={emailLink} onEnter={onEnter} />
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              Close
            </button>
          </div>
        </>
      ) : (
        <form className="ws-form" onSubmit={submit} noValidate>
          {error && (
            <p id={`${uid}-error`} className="ws-error" role="alert">
              {error.text}
            </p>
          )}

          <>
            <label htmlFor={`${uid}-code`}>Workshop code</label>
            <input
              {...fieldProps('code')}
              className="ws-input ws-input--code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={9}
            />
            <p id={`${uid}-code-hint`} className="ws-hint">
              6 letters and numbers from your facilitator.
            </p>
            {mode === 'return' ? (
              <>
                <label htmlFor={`${uid}-rejoin`}>Your rejoin code</label>
                <input
                  {...fieldProps('rejoin')}
                  className="ws-input ws-input--code"
                  value={rejoin}
                  onChange={(e) => setRejoin(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={11}
                />
                <p id={`${uid}-rejoin-hint`} className="ws-hint">
                  8 letters and numbers shown in your workshop bar. Your facilitator can look it up for you.
                </p>
              </>
            ) : (
              <>
                <label htmlFor={`${uid}-name`}>Your name</label>
                <input
                  {...fieldProps('name')}
                  className="ws-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={60}
                />
                <p id={`${uid}-name-hint`} className="ws-hint">
                  Shown to your facilitator with your canvas.
                </p>
                <label className="ws-check">
                  <input type="checkbox" checked={copyCurrent} onChange={(e) => setCopyCurrent(e.target.checked)} />
                  Start from the canvas I have open now (otherwise start blank)
                </label>
              </>
            )}
          </>

          <p className="ws-privacy">
            Your name and canvas are shared live with the facilitator, and with other participants if the facilitator
            allows it. Workshop data is deleted after {RETENTION_DAYS} days.{' '}
            <a href="./privacy.html" target="_blank" rel="noopener">
              Privacy notice<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>

          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" aria-disabled={busy}>
              {busy ? 'Connecting…' : mode === 'return' ? 'Return to my canvas' : 'Join'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
