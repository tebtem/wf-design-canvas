import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { parseState, readState, saveState } from '../state/persist';
import { LAST_STEP } from '../state/cells';
import { normalizeCode } from '../workshop/code';
import { RETENTION_DAYS } from '../workshop/config';
import { workshopCanvasKey, type ActiveWorkshop } from '../workshop/session';

interface Props {
  open: boolean;
  initialCode: string;
  onClose: () => void;
  onEnter: (w: ActiveWorkshop) => void;
}

type Field = 'code' | 'name' | 'title' | null;

export function WorkshopDialog({ open, initialCode, onClose, onEnter }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { state } = useCanvas();
  const uid = useId();
  const [mode, setMode] = useState<'join' | 'host'>('join');
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [copyCurrent, setCopyCurrent] = useState(false);
  const [guided, setGuided] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: Field; text: string } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
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
    if (mode === 'join') {
      if (!c) return fail('code', 'Enter the 6-character code from your facilitator, like ABC-234.');
    }
    setBusy(true);
    try {
      const api = await import('../workshop/api');
      if (mode === 'host') {
        const res = await api.createSession(title.trim() || 'Workshop', guided ? 0 : LAST_STEP);
        onEnter({ code: res.code, role: 'facilitator', uid: res.uid });
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
    'aria-describedby': [`${uid}-${field}-hint`, error?.field === field ? `${uid}-error` : ''].filter(Boolean).join(' '),
  });

  return (
    <dialog ref={ref} className="dialog dialog--wide" aria-labelledby={`${uid}-heading`} onClose={onClose}>
      <h2 id={`${uid}-heading`}>Workshop</h2>
      <form className="ws-form" onSubmit={submit} noValidate>
        <fieldset className="ws-choice">
          <legend>What would you like to do?</legend>
          <label>
            <input type="radio" name="ws-mode" checked={mode === 'join'} onChange={() => setMode('join')} />
            Join a workshop
          </label>
          <label>
            <input type="radio" name="ws-mode" checked={mode === 'host'} onChange={() => setMode('host')} />
            Host a workshop
          </label>
        </fieldset>

        {error && (
          <p id={`${uid}-error`} className="ws-error" role="alert">
            {error.text}
          </p>
        )}

        {mode === 'join' ? (
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
        ) : (
          <>
            <label htmlFor={`${uid}-title`}>Workshop name</label>
            <input
              {...fieldProps('title')}
              className="ws-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Workshop"
              maxLength={80}
            />
            <p id={`${uid}-title-hint`} className="ws-hint">
              You get a code to share. You will see every participant&apos;s canvas live.
            </p>
            <label className="ws-check">
              <input type="checkbox" checked={guided} onChange={(e) => setGuided(e.target.checked)} />
              Guide participants through the canvas one section at a time (you can reveal everything at any point)
            </label>
          </>
        )}

        <p className="ws-privacy">
          {mode === 'join'
            ? 'Your name and canvas are shared live with the facilitator, and with other participants if the facilitator allows it. '
            : 'Participant names and canvases are stored online for this workshop. '}
          Workshop data is deleted after {RETENTION_DAYS} days.
        </p>

        <div className="dialog__actions">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" aria-disabled={busy}>
            {busy ? 'Connecting…' : mode === 'join' ? 'Join' : 'Start workshop'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
