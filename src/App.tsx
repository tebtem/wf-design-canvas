import { CanvasProvider } from './state/CanvasContext';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { SessionBrief } from './components/SessionBrief';
import { TimeBlocksSection } from './components/TimeBlocks/TimeBlocksSection';
import { FlowFunction } from './components/FlowFunction';
import { Footer } from './components/Footer';
import { ActivityIdeation } from './components/ActivityIdeation';

export default function App() {
  return (
    <CanvasProvider>
      <a className="skip-link" href="#canvas">
        Skip to canvas
      </a>
      <Toolbar />
      <div className="canvas">
        <Header />
        <main id="canvas" className="canvas-body" tabIndex={-1}>
          <SessionBrief />
          <div className="right-col">
            <TimeBlocksSection />
            <FlowFunction />
            <ActivityIdeation />
          </div>
        </main>
      </div>
      <Footer />
    </CanvasProvider>
  );
}
