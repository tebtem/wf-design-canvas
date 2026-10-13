import { NoteCell } from './NoteCell';
import { Section } from './Section';

const STEPS = 9;

export function FlowFunction() {
  return (
    <Section title="Flow + Function" className="band--flow">
      <div className="panel">
        <div className="flow-grid">
          {Array.from({ length: STEPS }, (_, i) => (
            <NoteCell
              key={i}
              cellId={`flow.${i}`}
              title={`Flow step ${i + 1}`}
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
