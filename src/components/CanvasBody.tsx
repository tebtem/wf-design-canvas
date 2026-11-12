import { useCanvas } from '../state/CanvasContext';
import { Header } from './Header';
import { SessionBrief } from './SessionBrief';
import { TimeBlocksSection } from './TimeBlocks/TimeBlocksSection';
import { FlowFunction } from './FlowFunction';
import { StickyDnd } from './StickyDnd';
import { ActivityIdeation } from './ActivityIdeation';

/** The canvas itself. Read-only canvases drop the page heading so the host view keeps its own. */
export function CanvasBody({ label }: { label?: string }) {
  const { readOnly } = useCanvas();
  return (
    <div className={`canvas${readOnly ? ' canvas--readonly' : ''}`}>
      <Header asHeading={!readOnly} />
      <main id="canvas" className="canvas-body" tabIndex={-1} aria-label={label}>
        <StickyDnd>
          <SessionBrief />
          <div className="right-col">
            <TimeBlocksSection />
            <FlowFunction />
            <ActivityIdeation />
          </div>
        </StickyDnd>
      </main>
    </div>
  );
}
