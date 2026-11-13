import { lazy, Suspense, useState } from 'react';
import { CanvasProvider } from './state/CanvasContext';
import { readState, saveState } from './state/persist';
import { Toolbar } from './components/Toolbar';
import { Footer } from './components/Footer';
import { CanvasBody } from './components/CanvasBody';
import { WorkshopDialog } from './components/WorkshopDialog';
import { BackupReminder } from './components/BackupReminder';
import { WaitlistCard } from './components/WaitlistCard';
import { AccountSync } from './account/AccountSync';
import { AccountDialog } from './account/AccountDialog';
import { workshopsEnabled } from './workshop/config';
import { LAST_STEP } from './state/cells';
import { track } from './analytics';
import {
  loadWorkshop,
  looksLikeHostLink,
  saveWorkshop,
  takeAccountParam,
  takeHostParam,
  takeJoinParam,
  workshopCanvasKey,
  type ActiveWorkshop,
} from './workshop/session';

// Firebase only downloads for people who join or host a workshop.
const ParticipantApp = lazy(() => import('./workshop/ParticipantApp'));
const FacilitatorApp = lazy(() => import('./workshop/FacilitatorApp'));

const initialJoin = workshopsEnabled ? takeJoinParam() : null;
// Sign-in links come back with ?host (facilitators) or ?account (free accounts).
const emailLink = workshopsEnabled && looksLikeHostLink(window.location.href);
const accountEntry = workshopsEnabled && takeAccountParam();
const hostEntry = workshopsEnabled && (takeHostParam() || (emailLink && !accountEntry));

function Loading() {
  return (
    <p className="ws-loading" role="status">
      Connecting to the workshop…
    </p>
  );
}

export default function App() {
  const [workshop, setWorkshop] = useState<ActiveWorkshop | null>(() => (workshopsEnabled ? loadWorkshop() : null));
  const [dialogOpen, setDialogOpen] = useState((initialJoin !== null || hostEntry) && !workshop);

  const enter = (w: ActiveWorkshop) => {
    track(w.role === 'facilitator' ? 'workshop-hosted' : 'workshop-joined');
    saveWorkshop(w);
    setWorkshop(w);
    setDialogOpen(false);
    window.scrollTo(0, 0);
  };

  const leave = (copyToPersonal = false) => {
    if (workshop && copyToPersonal) {
      const s = readState(workshopCanvasKey(workshop.code));
      if (s) saveState({ ...s, step: LAST_STEP });
    }
    saveWorkshop(null);
    setWorkshop(null);
    window.scrollTo(0, 0);
  };

  if (workshop?.role === 'facilitator') {
    return (
      <Suspense fallback={<Loading />}>
        <FacilitatorApp workshop={workshop} onExit={() => leave()} />
      </Suspense>
    );
  }

  if (workshop?.role === 'participant') {
    return (
      <Suspense fallback={<Loading />}>
        <ParticipantApp workshop={workshop} onLeave={leave} />
      </Suspense>
    );
  }

  return (
    <CanvasProvider>
      <a className="skip-link" href="#canvas">
        Skip to canvas
      </a>
      <Toolbar
        guided
        accounts={workshopsEnabled}
        onWorkshop={workshopsEnabled ? () => setDialogOpen(true) : undefined}
      />
      {workshopsEnabled && (
        <>
          <AccountSync />
          <AccountDialog emailLink={accountEntry && emailLink} />
        </>
      )}
      <CanvasBody guided />
      <Footer />
      <section className="ws-toasts no-print" aria-label="Notifications">
        <BackupReminder accounts={workshopsEnabled} />
        <WaitlistCard />
      </section>
      {workshopsEnabled && (
        <WorkshopDialog
          open={dialogOpen}
          initialCode={initialJoin ?? ''}
          hostEntry={hostEntry}
          emailLink={emailLink}
          onClose={() => setDialogOpen(false)}
          onEnter={enter}
        />
      )}
    </CanvasProvider>
  );
}
