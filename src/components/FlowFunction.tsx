import { cellsIn } from '../state/cells';
import { NoteCell } from './NoteCell';
import { Section } from './Section';

export function FlowFunction() {
  return (
    <Section title="Flow + Function" className="band--flow">
      <div className="panel">
        <div className="flow-grid">
          {cellsIn('Flow + Function').map((c, i) => (
            <NoteCell
              key={c.id}
              cellId={c.id}
              title={c.title}
              hideTitle
              className={`flow-col flow-col--${i}`}
              placeholder=""
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
