import { useCanvas } from '../state/CanvasContext';
import { LAST_STEP } from '../state/cells';
import { Header } from './Header';
import { FacilitatorCenter, ParticipantAfter, ParticipantBefore, ParticipantsCenter, SessionBrief } from './SessionBrief';
import { TimeBlocksSection } from './TimeBlocks/TimeBlocksSection';
import { FlowFunction } from './FlowFunction';
import { StickyDnd } from './StickyDnd';
import { ActivityIdeation } from './ActivityIdeation';

interface Props {
  label?: string;
  /** Guided workshops show sections up to this step (see REVEAL_STEPS). Defaults to everything. */
  step?: number;
}

/** The canvas itself, stacked in one column. Read-only canvases drop the page heading so the host view keeps its own. */
export function CanvasBody({ label, step = LAST_STEP }: Props) {
  const { readOnly } = useCanvas();
  return (
    <div className={`canvas${readOnly ? ' canvas--readonly' : ''}`}>
      <Header asHeading={!readOnly} />
      <main id="canvas" className="canvas-body" tabIndex={-1} aria-label={label}>
        <StickyDnd step={step}>
          <SessionBrief />
          <ParticipantsCenter />
          <ParticipantBefore />
          <ParticipantAfter />
          {step >= 1 && <FacilitatorCenter />}
          {step >= 2 && <TimeBlocksSection />}
          {step >= 3 && <FlowFunction />}
          {step >= 4 && <ActivityIdeation />}
        </StickyDnd>
      </main>
    </div>
  );
}
