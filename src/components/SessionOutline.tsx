import { useCanvas } from '../state/CanvasContext';
import { formatMinutes, totalMinutes, visibleDrafts } from '../state/reducer';
import { useState } from 'react';
import {
  BLOCK_STEP,
  clampMinutes,
  DRAFT_NAMES,
  hhmm,
  MAX_BLOCK,
  MIN_BLOCK,
  type DraftId,
  type OutlineRow,
} from '../state/types';
import { Section } from './Section';
import { TimeField } from './TimeField';

const EMPTY: OutlineRow = { activities: '', moves: '' };

/** Run of show built from a session draft: times come from the blocks, the rest is typed in. */
export function SessionOutline() {
  const { state, dispatch, readOnly } = useCanvas();
  const drafts = visibleDrafts(state);
  const draft: DraftId = drafts.includes(state.outline.draft) ? state.outline.draft : 'd1';
  const blocks = state.drafts[draft];
  const title = state.details.title.trim();
  const sessionStart = state.outline.start;
  const [message, setMessage] = useState('');
  const announce = (msg: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(msg), 50);
  };

  /** Lengths snap to 5-minute steps; say so when the typed value changed. */
  const setLength = (blockId: string, minutes: number) => {
    const next = clampMinutes(minutes);
    dispatch({ type: 'setBlockMinutes', id: blockId, minutes: next });
    if (next !== minutes) {
      announce(`Lengths go in ${BLOCK_STEP}-minute steps from ${MIN_BLOCK} to ${MAX_BLOCK}. Set to ${next} minutes.`);
    }
  };

  const field = (blockId: string, key: keyof OutlineRow, label: string, value: string) => (
    <>
      <textarea
        className="outline__input"
        aria-label={label}
        value={value}
        readOnly={readOnly}
        rows={2}
        onChange={(e) => dispatch({ type: 'setOutlineRow', blockId, field: key, value: e.target.value })}
      />
      <div className="print-text" aria-hidden="true">
        {value}
      </div>
    </>
  );

  return (
    <Section id="section-outline" title="Session Outline" className="band--outline">
      <div className="panel outline">
        <div className="outline__head">
          <p className="outline__title">
            {title || <span className="outline__untitled">Add a Working Title at the top of the canvas</span>}
          </p>
          {drafts.length > 1 && (
            <div className="outline__draft">
              <label htmlFor="outline-draft">Based on</label>
              <select
                id="outline-draft"
                value={draft}
                disabled={readOnly}
                onChange={(e) => dispatch({ type: 'setOutlineDraft', draft: e.target.value as DraftId })}
              >
                {drafts.map((d) => (
                  <option key={d} value={d}>
                    {DRAFT_NAMES[d]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {blocks.length > 0 && <p className="outline__total">Total {formatMinutes(totalMinutes(blocks))}</p>}
        </div>

        {blocks.length === 0 ? (
          <p className="outline__empty">
            Add time blocks to {DRAFT_NAMES[draft]} and they will appear here as the rows of your outline.
          </p>
        ) : (
          // Focusable so keyboard users can scroll the table sideways on narrow screens.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <div className="outline__scroll" role="region" aria-labelledby="outline-caption" tabIndex={0}>
            <table className="outline__table">
              <caption id="outline-caption" className="sr-only">
                Session Outline{title ? ` for ${title}` : ''}, from {DRAFT_NAMES[draft]}. Type the first start time, or
                any end time or length; the rows below adjust.
              </caption>
              <thead>
                <tr>
                  <th scope="col" colSpan={2}>
                    Time
                  </th>
                  <th scope="col">Activities</th>
                  <th scope="col">Moves + Materials</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((b, i) => {
                  const start = sessionStart + totalMinutes(blocks.slice(0, i));
                  const end = start + b.minutes;
                  const spoken = `${hhmm(start)} to ${hhmm(end)}${b.label ? `, ${b.label}` : ''}`;
                  const row = state.outline.rows[b.id] ?? EMPTY;
                  return (
                    <tr key={b.id}>
                      <td className="outline__time">
                        <span className="outline__range">
                          {i === 0 ? (
                            <TimeField
                              kind="clock"
                              value={start}
                              label="Session start time"
                              readOnly={readOnly}
                              onCommit={(t) => {
                                dispatch({ type: 'setOutlineStart', start: t });
                                announce(`Session starts at ${hhmm(t)}. All times updated.`);
                              }}
                              onInvalid={announce}
                            />
                          ) : (
                            <span className="outline__start">{hhmm(start)}</span>
                          )}
                          <span aria-hidden="true">-</span>
                          <TimeField
                            kind="clock"
                            value={end}
                            label={`End time, row ${i + 1}${b.label ? `, ${b.label}` : ''}`}
                            readOnly={readOnly}
                            onCommit={(t) => {
                              // Allow ending after midnight: 23:30 to 00:15 is 45 minutes.
                              const length = (((t - start) % 1440) + 1440) % 1440;
                              setLength(b.id, length || MIN_BLOCK);
                            }}
                            onInvalid={announce}
                          />
                        </span>
                        {b.label && <span className="outline__block">{b.label}</span>}
                      </td>
                      <td className="outline__len">
                        <TimeField
                          kind="minutes"
                          value={b.minutes}
                          label={`Length in minutes, row ${i + 1}${b.label ? `, ${b.label}` : ''}`}
                          readOnly={readOnly}
                          onCommit={(m) => setLength(b.id, m)}
                          onInvalid={announce}
                        />{' '}
                        min
                      </td>
                      <td>{field(b.id, 'activities', `Activities, ${spoken}`, row.activities)}</td>
                      <td>{field(b.id, 'moves', `Moves and materials, ${spoken}`, row.moves)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {blocks.length > 0 && !readOnly && (
          <p className="outline__hint no-print">
            Type the first start time, or any end time or length. Each row starts when the one above ends, and changes
            update your time blocks too.
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </Section>
  );
}
