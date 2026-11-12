import { cellsIn } from '../state/cells';
import { NoteCell } from './NoteCell';
import { Section } from './Section';

export function FlowFunction() {
  return (
    <Section id="section-flow" title="Flow, Function, and Form" className="band--flow">
      <div className="panel">
        <div className="flow-grid">
          {cellsIn('Flow, Function, and Form').map((c, i) => (
            <NoteCell
              key={c.id}
              cellId={c.id}
              title={c.title}
              hideTitle
              columnTitle={`Column ${i + 1} title`}
              className={`flow-col flow-col--${i}`}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
