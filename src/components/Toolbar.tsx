import { LAST_STEP } from '../state/cells';
import { useEffect, useRef, useState, type ChangeEvent, type FocusEvent } from 'react';
import { downloadBackup, markBackedUp, readBackup } from '../state/backup';
import { track } from '../analytics';
import { celebrateMilestone } from './WaitlistCard';
import { useAccountEmail } from '../account/useAccountEmail';
import { openAccountDialog } from '../account/session';
import { effectiveLayout, setLayoutPref, useLayoutPref, type Layout } from '../state/layout';
import { useCanvas } from '../state/CanvasContext';
import { ChevronIcon, DownloadIcon, ExternalIcon, PeopleIcon, PrintIcon, UploadIcon, UserIcon, XIcon } from './Icons';

import { LEARN_URL } from './Footer';

interface ToolbarProps {
  onWorkshop?: () => void;
  guided?: boolean;
  /** Show the free account button (solo canvas, with Firebase set up). */
  accounts?: boolean;
}

export function Toolbar({ onWorkshop, guided = false, accounts = false }: ToolbarProps) {
  const accountEmail = useAccountEmail();
  const { state, dispatch, saveStatus } = useCanvas();
  const layout = effectiveLayout(useLayoutPref());
  const dialogRef = useRef<HTMLDialogElement>(null);
  // "More" disclosure: backup, restore and clear live here to keep the toolbar short.
  const moreBtn = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  // Open toward whichever side has room, so the menu never runs off a narrow screen.
  const [moreAlign, setMoreAlign] = useState<'left' | 'right'>('right');
  const toggleMore = () => {
    const r = moreBtn.current?.getBoundingClientRect();
    if (r) setMoreAlign(r.left + 240 <= window.innerWidth - 16 ? 'left' : 'right');
    setMoreOpen((v) => !v);
  };
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
    track('backup-restored');
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
        <fieldset className="layout-toggle">
          <legend className="sr-only">Canvas layout</legend>
          {(['stacked', 'canvas'] as Layout[]).map((l) => (
            <label key={l} className={`layout-toggle__option${layout === l ? ' is-on' : ''}`}>
              <input
                type="radio"
                name="canvas-layout"
                value={l}
                checked={layout === l}
                onChange={() => setLayoutPref(l)}
              />
              {l === 'stacked' ? 'Stacked' : 'Canvas'}
            </label>
          ))}
        </fieldset>
        {guided && state.step < LAST_STEP && (
          <button type="button" className="btn" onClick={() => {
              dispatch({ type: 'showAll' });
              track('guide-skipped');
            }}>
            Show full canvas
          </button>
        )}
        {accounts && (
          <button type="button" className="btn" onClick={openAccountDialog} aria-haspopup="dialog">
            <UserIcon />
            {accountEmail ? 'My canvases' : 'Create free account'}
          </button>
        )}
        {onWorkshop && (
          <button type="button" className="btn" onClick={onWorkshop} aria-haspopup="dialog">
            <PeopleIcon />
            Workshop
          </button>
        )}
        <a
          className="btn btn--pink"
          href={LEARN_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('learn-clicked', { from: 'learn-button' })}
        >
          Learn<span className="sr-only"> about facilitation design (opens in a new tab)</span>
          <ExternalIcon />
        </a>
        <div className="more" ref={moreRef} onBlur={onMoreBlur}>
          <button
            ref={moreBtn}
            type="button"
            className="btn"
            aria-expanded={moreOpen}
            aria-controls="more-panel"
            onClick={toggleMore}
          >
            More
            <ChevronIcon />
          </button>
          <div id="more-panel" className={`more__panel more__panel--${moreAlign}`} hidden={!moreOpen}>
            <button
              type="button"
              className="more__item"
              onClick={() => {
                setMoreOpen(false);
                moreBtn.current?.focus();
                track('pdf-saved');
                window.print();
                if (guided) celebrateMilestone();
              }}
            >
              <PrintIcon />
              Save as PDF
            </button>
            <button
              type="button"
              className="more__item"
              onClick={() => {
                setMoreOpen(false);
                downloadBackup(state);
                markBackedUp();
                track('backup-downloaded');
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
