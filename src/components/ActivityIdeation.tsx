import { NoteCell } from './NoteCell';
import { Section } from './Section';

export function ActivityIdeation() {
  return (
    <Section id="section-ideas" title="Activity Ideation" className="band--ideas">
      <NoteCell
        cellId="ideas"
        title="Activity ideas"
        hideTitle
        className="panel ideas"
      />
    </Section>
  );
}
