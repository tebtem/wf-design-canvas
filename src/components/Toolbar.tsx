import { useRef } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { ExternalIcon, PrintIcon } from './Icons';

const LEARN_URL = 'https://www.womenfacilitating.com/facilitation-design';

export function Toolbar() {
  const { dispatch, saveStatus } = useCanvas();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const clearBtn = useRef<HTMLButtonElement>(null);

  const status =
    saveStatus === 'error'
      ? 'Could not save. Your browser is blocking storage, so use Save as PDF to keep your work.'
      : 'Changes save automatically in this browser.';

  return (
    <aside className="toolbar no-print" aria-label="Canvas tools">
      <div className="toolbar__start">
        <a className="btn btn--pink" href={LEARN_URL} target="_blank" rel="noopener noreferrer">
          Learn<span className="sr-only"> about facilitation design (opens in a new tab)</span>
          <ExternalIcon />
        </a>
        <p className={`toolbar__status${saveStatus === 'error' ? ' is-error' : ''}`} role="status">
          {status}
        </p>
      </div>
      <div className="toolbar__actions">
        <button type="button" className="btn btn--primary" onClick={() => window.print()}>
          <PrintIcon />
          Save as PDF
        </button>
        <button ref={clearBtn} type="button" className="btn" onClick={() => dialogRef.current?.showModal()}>
          Clear canvas
        </button>
      </div>
      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="clear-title"
        aria-describedby="clear-desc"
        onClose={() => clearBtn.current?.focus()}
      >
        <h2 id="clear-title">Clear the whole canvas?</h2>
        <p id="clear-desc">This removes all text, sticky notes and time blocks saved in this browser. It cannot be undone.</p>
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
