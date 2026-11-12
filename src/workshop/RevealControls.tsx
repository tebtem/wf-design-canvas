import { LAST_STEP, REVEAL_STEPS, STEP_DETAIL } from '../state/cells';

interface Props {
  step: number;
  onChange: (step: number) => void;
}

/** Host controls for revealing the canvas one section at a time. */
export function RevealControls({ step, onChange }: Props) {
  const done = step >= LAST_STEP;
  return (
    <section className="ws-reveal" aria-labelledby="ws-reveal-h">
      <h2 id="ws-reveal-h" className="ws-h2">
        Reveal sections
      </h2>
      <p className="ws-hint">Participants only see the sections you have revealed.</p>
      <ol className="ws-steps">
        {REVEAL_STEPS.map((name, i) => {
          const shown = i <= step;
          return (
            <li key={name} className={`ws-step${shown ? ' is-shown' : ''}${i === step ? ' is-current' : ''}`}>
              <span className="ws-step__num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="ws-step__body">
                <span className="ws-step__name">{STEP_DETAIL[i]}</span>
                <span className="ws-step__state">{shown ? 'Revealed' : 'Hidden'}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="ws-reveal__actions">
        {!done && (
          <button type="button" className="btn btn--primary" onClick={() => onChange(step + 1)}>
            Reveal next: {REVEAL_STEPS[step + 1]}
          </button>
        )}
        {!done && step + 1 < LAST_STEP && (
          <button type="button" className="btn" onClick={() => onChange(LAST_STEP)}>
            Reveal all
          </button>
        )}
        {step > 0 && (
          <button type="button" className="btn" onClick={() => onChange(step - 1)}>
            Hide {REVEAL_STEPS[step]}
          </button>
        )}
      </div>
      {done && <p className="ws-hint">Everything is revealed. Participants see the full canvas.</p>}
    </section>
  );
}
