import { cellsIn } from '../state/cells';
import { NoteCell } from './NoteCell';
import { QuadrantCell } from './QuadrantCell';

const grid = (section: string) => (
  <div className="card-grid">
    {cellsIn(section).map((c) => (
      <NoteCell key={c.id} cellId={c.id} title={c.title} className="card" />
    ))}
  </div>
);

export function SessionBrief() {
  return (
    <div className="left-col">
      <section className="band band--left" aria-labelledby="brief-h">
        <h2 id="brief-h" className="band__title band__title--center">
          Session Brief
        </h2>
        {grid('Session Brief')}
      </section>

      <div className="band band--left participant-grid">
        <section aria-labelledby="before-h">
          <h2 id="before-h" className="sub-heading">
            Participant Before
          </h2>
          <QuadrantCell section="Participant Before" />
        </section>
        <section aria-labelledby="after-h">
          <h2 id="after-h" className="sub-heading">
            Participant After
          </h2>
          <QuadrantCell section="Participant After" />
        </section>
      </div>

      <section className="band band--left" aria-labelledby="pc-h">
        <h2 id="pc-h" className="sub-heading">
          Participants at the Center
        </h2>
        {grid('Participants at the Center')}
      </section>

      <section className="band band--left" aria-labelledby="fc-h">
        <h2 id="fc-h" className="sub-heading">
          Facilitator at the Center
        </h2>
        {grid('Facilitator at the Center')}
      </section>
    </div>
  );
}
