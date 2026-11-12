import { useState, type ReactNode } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { LAST_STEP, REVEAL_STEPS, STEP_ANCHORS } from '../state/cells';
import { Header } from './Header';
import { FacilitatorCenter, ParticipantAfter, ParticipantBefore, ParticipantsCenter, SessionBrief } from './SessionBrief';
import { TimeBlocksSection } from './TimeBlocks/TimeBlocksSection';
import { FlowFunction } from './FlowFunction';
import { StickyDnd } from './StickyDnd';
import { ActivityIdeation } from './ActivityIdeation';

interface Props {
  label?: string;
  /** Workshops: the step the facilitator has revealed. Overrides the canvas's own guide step. */
  step?: number;
  /** Solo canvas: show the Next button and follow the canvas's own guide step. */
  guided?: boolean;
}

/**
 * Sections past the current step stay in the page but hidden on screen, so printing always
 * shows the full canvas.
 */
function Step({ shown, children }: { shown: boolean; children: ReactNode }) {
  return shown ? <>{children}</> : <div className="step-hidden">{children}</div>;
}

/** The canvas itself, stacked in one column. Read-only canvases drop the page heading so the host view keeps its own. */
export function CanvasBody({ label, step: forcedStep, guided = false }: Props) {
  const { state, dispatch, readOnly } = useCanvas();
  const step = forcedStep ?? (guided ? state.step : LAST_STEP);
  const [message, setMessage] = useState('');

  const next = () => {
    const to = Math.min(LAST_STEP, step + 1);
    dispatch({ type: 'nextStep' });
    setMessage('');
    window.setTimeout(() => {
      setMessage(`${REVEAL_STEPS[to]} added. Step ${to + 1} of ${LAST_STEP + 1}.`);
      const section = document.getElementById(STEP_ANCHORS[to]);
      section?.scrollIntoView({ block: 'start' });
      section?.querySelector<HTMLElement>('h2')?.focus();
    }, 50);
  };

  return (
    <div className={`canvas${readOnly ? ' canvas--readonly' : ''}`}>
      <Header asHeading={!readOnly} />
      <main id="canvas" className="canvas-body" tabIndex={-1} aria-label={label}>
        <StickyDnd step={step}>
          <SessionBrief />
          <ParticipantsCenter />
          <ParticipantBefore />
          <ParticipantAfter />
          <Step shown={step >= 1}>
            <FacilitatorCenter />
          </Step>
          <Step shown={step >= 2}>
            <TimeBlocksSection />
          </Step>
          <Step shown={step >= 3}>
            <FlowFunction />
            <ActivityIdeation />
          </Step>
        </StickyDnd>
        {guided && !readOnly && forcedStep === undefined && step < LAST_STEP && (
          <div className="guide-next no-print">
            <p className="guide-next__progress">
              Step {step + 1} of {LAST_STEP + 1}
            </p>
            <button type="button" className="btn btn--primary guide-next__btn" onClick={next}>
              Next: {REVEAL_STEPS[step + 1]}
            </button>
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {message}
        </p>
      </main>
    </div>
  );
}
