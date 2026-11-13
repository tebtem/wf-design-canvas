import { lazy, Suspense, useState } from 'react';
import { CanvasProvider } from './state/CanvasContext';
import { readState, saveState } from './state/persist';
import { Toolbar } from './components/Toolbar';
import { Footer } from './components/Footer';
import { CanvasBody } from './components/CanvasBody';
import { WorkshopDialog } from './components/WorkshopDialog';
import { BackupReminder } from './components/BackupReminder';
import { workshopsEnabled } from './workshop/config';
import { LAST_STEP } from './state/cells';
import { track } from './analytics';
import {
  loadWorkshop,
  looksLikeHostLink,
  saveWorkshop,
  takeHostParam,
  takeJoinParam,
  workshopCanvasKey,
  type ActiveWorkshop,
} from './workshop/session';

// Firebase only downloads for people who join or host a workshop.
const ParticipantApp = lazy(() => import('./workshop/ParticipantApp'));
const FacilitatorApp = lazy(() => import('./workshop/FacilitatorApp'));

const initialJoin = workshopsEnabled ? takeJoinParam() : null;
// Facilitators reach hosting from a private link (?host) or the emailed sign-in link.
const emailLink = workshopsEnabled && looksLikeHostLink(window.location.href);
const hostEntry = workshopsEnabled && (takeHostParam() || emailLink);

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
      <Toolbar guided onWorkshop={workshopsEnabled ? () => setDialogOpen(true) : undefined} />
      <CanvasBody guided />
      <Footer />
      <BackupReminder />
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
