import { useState } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { downloadBackup, markBackedUp, shouldRemindBackup, snoozeBackupReminder } from '../state/backup';
import { track } from '../analytics';
import { useAccountEmail } from '../account/useAccountEmail';
import { openAccountDialog } from '../account/session';

/**
 * A gentle corner card once someone has put real work into a canvas that lives only in this browser:
 * suggests downloading a backup, then stays quiet for a week (or 3 days after "Remind me later").
 */
export function BackupReminder({ accounts = false }: { accounts?: boolean }) {
  const { state } = useCanvas();
  // Signed-in canvases save to the account, so no reminder is needed.
  const signedIn = Boolean(useAccountEmail());
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState('');
  const show = !dismissed && !signedIn && shouldRemindBackup(state);

  return (
    <>
      <p className="sr-only" role="status">
        {show
          ? 'Your canvas is only saved in this browser. Download a backup so you don’t lose your good work.'
          : message}
      </p>
      {show && (
        <div className="ws-toast ws-toast--backup">
          <p className="ws-toast__title">Keep your work safe</p>
          <p>Your canvas is only saved in this browser. Download a backup so you don&apos;t lose your good work.</p>
          {accounts && <p className="ws-toast__cta">Save your canvas, and open it anywhere.</p>}
          <div className="ws-toast__actions">
            {accounts && (
              <button
                type="button"
                className="btn btn--small btn--primary"
                onClick={() => {
                  setDismissed(true);
                  openAccountDialog();
                }}
              >
                Create a free account
              </button>
            )}
            <button
              type="button"
              className={`btn btn--small${accounts ? '' : ' btn--primary'}`}
              onClick={() => {
                downloadBackup(state);
                markBackedUp();
                track('backup-downloaded', { from: 'reminder' });
                setDismissed(true);
                setMessage('Backup downloaded.');
              }}
            >
              Download backup
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => {
                snoozeBackupReminder();
                setDismissed(true);
              }}
            >
              Remind me later
            </button>
          </div>
        </div>
      )}
    </>
  );
}
