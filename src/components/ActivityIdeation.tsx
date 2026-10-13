import { NoteCell } from './NoteCell';
import { Section } from './Section';

export function ActivityIdeation() {
  return (
    <Section title="Activity Ideation" className="band--ideas">
      <NoteCell
        cellId="ideas"
        title="Activity ideas"
        hideTitle
        className="panel ideas"
        placeholder="Brainstorm activities here, or add sticky notes"
      />
    </Section>
  );
}
