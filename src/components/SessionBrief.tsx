import { cellsIn } from '../state/cells';
import { NoteCell } from './NoteCell';
import { QuadrantCell } from './QuadrantCell';
import { Section } from './Section';

const grid = (section: string) => (
  <div className="card-grid">
    {cellsIn(section).map((c) => (
      <NoteCell key={c.id} cellId={c.id} title={c.title} className="card" />
    ))}
  </div>
);

export const SessionBrief = () => (
  <Section id="section-brief" title="Session Brief">
    {grid('Session Brief')}
  </Section>
);

export const ParticipantsCenter = () => (
  <Section id="section-participants" title="Participants at the Center">
    {grid('Participants at the Center')}
  </Section>
);

export const ParticipantBefore = () => (
  <Section id="section-before" title="Participant Before">
    <QuadrantCell section="Participant Before" />
  </Section>
);

export const ParticipantAfter = () => (
  <Section id="section-after" title="Participant After">
    <QuadrantCell section="Participant After" />
  </Section>
);

export const FacilitatorCenter = () => (
  <Section id="section-facilitator" title="Facilitator at the Center">
    {grid('Facilitator at the Center')}
  </Section>
);
