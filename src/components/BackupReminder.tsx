import { useEffect, useState } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { downloadBackup, markBackedUp, shouldRemindBackup, snoozeBackupReminder } from '../state/backup';

/**
 * A gentle corner card once someone has put real work into a canvas that lives only in this browser:
 * suggests downloading a backup, then stays quiet for a week (or 3 days after "Remind me later").
 */
export function BackupReminder() {
  const { state } = useCanvas();
  const [dismissed, setDismissed] = useState(false);
  const [message, setMessage] = useState('');
  const show = !dismissed && shouldRemindBackup(state);

  useEffect(() => {
    document.body.classList.toggle('has-toasts', show);
    return () => document.body.classList.remove('has-toasts');
  }, [show]);

  return (
    <>
      <p className="sr-only" role="status">
        {show ? 'Tip: your canvas is saved only in this browser. You can download a backup.' : message}
      </p>
      {show && (
        <section className="ws-toasts no-print" aria-label="Notifications">
          <div className="ws-toast ws-toast--backup">
            <p className="ws-toast__title">Keep your work safe</p>
            <p>
              Your canvas is saved only in this browser. Download a backup so you don&apos;t lose it if your browser
              data is cleared, or to open it on another device.
            </p>
            <div className="ws-toast__actions">
              <button
                type="button"
                className="btn btn--small btn--primary"
                onClick={() => {
                  downloadBackup(state);
                  markBackedUp();
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
        </section>
      )}
    </>
  );
}
