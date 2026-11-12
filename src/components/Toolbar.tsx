import { LAST_STEP } from '../state/cells';
import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent } from 'react';
import { downloadBackup, readBackup } from '../state/backup';
import { useCanvas } from '../state/CanvasContext';
import { ChevronIcon, DownloadIcon, ExternalIcon, PeopleIcon, PrintIcon, UploadIcon, XIcon } from './Icons';

const LEARN_URL = 'https://www.womenfacilitating.com/facilitation-design';

export function Toolbar({ onWorkshop, guided = false }: { onWorkshop?: () => void; guided?: boolean }) {
  const { state, dispatch, saveStatus } = useCanvas();
  const dialogRef = useRef<HTMLDialogElement>(null);
  // "More" disclosure: backup, restore and clear live here to keep the toolbar short.
  const moreBtn = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const onMoreBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!moreRef.current?.contains(e.relatedTarget as Node | null)) setMoreOpen(false);
  };
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMoreOpen(false);
      moreBtn.current?.focus();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [moreOpen]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);

  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const backup = readBackup(await file.text());
    if (!backup) {
      setNotice({ text: 'That file is not a canvas backup. Choose a file saved with Download backup.', error: true });
      return;
    }
    const when = backup.savedAt ? ` from ${new Date(backup.savedAt).toLocaleString()}` : '';
    if (!window.confirm(`Replace everything on this canvas with the backup${when}? This cannot be undone.`)) return;
    dispatch({ type: 'load', state: backup.state });
    setNotice({ text: `Backup${when} restored.` });
  };

  const status =
    notice?.text ??
    (saveStatus === 'error'
      ? 'Could not save. Your browser is blocking storage, so use Download backup or Save as PDF to keep your work.'
      : 'Changes save automatically in this browser.');
  const isError = notice ? notice.error : saveStatus === 'error';

  return (
    <aside className="toolbar no-print" aria-label="Canvas tools">
      <p className={`toolbar__status${isError ? ' is-error' : ''}`} role="status">
        {status}
      </p>
      <div className="toolbar__actions">
        {guided && state.step < LAST_STEP && (
          <button type="button" className="btn" onClick={() => dispatch({ type: 'showAll' })}>
            Show full canvas
          </button>
        )}
        {onWorkshop && (
          <button type="button" className="btn" onClick={onWorkshop} aria-haspopup="dialog">
            <PeopleIcon />
            Workshop
          </button>
        )}
        <a className="btn btn--pink" href={LEARN_URL} target="_blank" rel="noopener noreferrer">
          Learn<span className="sr-only"> about facilitation design (opens in a new tab)</span>
          <ExternalIcon />
        </a>
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>
          <PrintIcon />
          Save as PDF
        </button>
        <div className="more" ref={moreRef} onBlur={onMoreBlur}>
          <button
            ref={moreBtn}
            type="button"
            className="btn"
            aria-expanded={moreOpen}
            aria-controls="more-panel"
            onClick={() => setMoreOpen((v) => !v)}
          >
            More
            <ChevronIcon />
          </button>
          <div id="more-panel" className="more__panel" hidden={!moreOpen}>
            <button
              type="button"
              className="more__item"
              onClick={() => {
                setMoreOpen(false);
                downloadBackup(state);
                setNotice({ text: 'Backup downloaded. Keep the file to restore this canvas on any device.' });
                moreBtn.current?.focus();
              }}
            >
              <DownloadIcon />
              Download backup
            </button>
            <button
              type="button"
              className="more__item"
              onClick={() => {
                setMoreOpen(false);
                moreBtn.current?.focus();
                fileRef.current?.click();
              }}
            >
              <UploadIcon />
              Restore backup
            </button>
            <button
              type="button"
              className="more__item more__item--danger"
              onClick={() => {
                setMoreOpen(false);
                dialogRef.current?.showModal();
              }}
            >
              <XIcon />
              Clear canvas
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={restore}
        />
      </div>
      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="clear-title"
        aria-describedby="clear-desc"
        onClose={() => moreBtn.current?.focus()}
      >
        <h2 id="clear-title">Clear the whole canvas?</h2>
        <p id="clear-desc">This removes all text, sticky notes and time blocks saved in this browser, and starts the step-by-step guide again. It cannot be undone.</p>
        <form method="dialog" className="dialog__actions">
          <button type="submit" className="btn" value="cancel">
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--danger"
            value="clear"
            onClick={() => dispatch({ type: 'reset' })}
          >
            Clear everything
          </button>
        </form>
      </dialog>
    </aside>
  );
}
