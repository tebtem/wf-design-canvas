import { useCanvas } from '../state/CanvasContext';
import { breakMinutes, schedule, totalMinutes, totalWithBreaks, visibleDrafts } from '../state/reducer';
import { CupIcon } from './Icons';
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
  const { slots, days } = schedule(blocks, state.outline.start);
  const multiDay = days.length > 1;
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
          {blocks.length > 0 && (
            <p className="outline__total">
              {multiDay && `${days.length} days · `}Total {totalWithBreaks(totalMinutes(blocks), breakMinutes(blocks))}
            </p>
          )}
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
              {days.map((d) => {
                const rows = slots.filter((x) => x.day === d.day && x.block.kind !== 'day');
                const dayLabel = multiDay ? `Day ${d.day}, ` : '';
                const setStart = (t: number) => {
                  if (d.divider) dispatch({ type: 'setDayStart', id: d.divider.id, start: t });
                  else dispatch({ type: 'setOutlineStart', start: t });
                  announce(`${multiDay ? `Day ${d.day}` : 'Session'} starts at ${hhmm(t)}. Times updated.`);
                };
                return (
                  <tbody key={d.day} className="outline__daygroup">
                    {multiDay && (
                      <tr className="outline__day">
                        <th scope="colgroup" colSpan={4}>
                          Day {d.day}
                          <span className="outline__day-meta">
                            {' '}
                            · starts {hhmm(d.start)}
                            {d.total > 0 && ` · ${totalWithBreaks(d.total, d.breaks)}`}
                          </span>
                        </th>
                      </tr>
                    )}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="outline__empty-day">
                          No time blocks in Day {d.day} yet.
                        </td>
                      </tr>
                    )}
                    {rows.map(({ block: b, start }, i) => {
                      const end = start + b.minutes;
                      const brk = b.isBreak === true;
                      const name = b.label || (brk ? 'Break' : '');
                      const spoken = `${dayLabel}${hhmm(start)} to ${hhmm(end)}${name ? `, ${name}` : ''}`;
                      const rowName = `${dayLabel}row ${i + 1}${name ? `, ${name}` : ''}`;
                      const row = state.outline.rows[b.id] ?? EMPTY;
                      return (
                        <tr key={b.id} className={brk ? 'outline__break' : undefined}>
                          <td className="outline__time">
                            <span className="outline__range">
                              {i === 0 ? (
                                <TimeField
                                  kind="clock"
                                  value={start}
                                  label={multiDay ? `Day ${d.day} start time` : 'Session start time'}
                                  readOnly={readOnly}
                                  onCommit={setStart}
                                  onInvalid={announce}
                                />
                              ) : (
                                <span className="outline__start">{hhmm(start)}</span>
                              )}
                              <span aria-hidden="true">-</span>
                              <TimeField
                                kind="clock"
                                value={end}
                                label={`End time, ${rowName}`}
                                readOnly={readOnly}
                                onCommit={(t) => {
                                  // Allow ending after midnight: 23:30 to 00:15 is 45 minutes.
                                  const length = (((t - start) % 1440) + 1440) % 1440;
                                  setLength(b.id, length || MIN_BLOCK);
                                }}
                                onInvalid={announce}
                              />
                            </span>
                            {brk ? (
                              <span className="outline__block outline__block--break">
                                <CupIcon /> {name}
                              </span>
                            ) : (
                              b.label && <span className="outline__block">{b.label}</span>
                            )}
                          </td>
                          <td className="outline__len">
                            <TimeField
                              kind="minutes"
                              value={b.minutes}
                              label={`Length in minutes, ${rowName}`}
                              readOnly={readOnly}
                              onCommit={(m) => setLength(b.id, m)}
                              onInvalid={announce}
                            />{' '}
                            min
                          </td>
                          {brk ? (
                            // Breaks rarely need both columns: one quiet notes cell.
                            <td colSpan={2}>{field(b.id, 'activities', `Notes for break, ${spoken}`, row.activities)}</td>
                          ) : (
                            <>
                              <td>{field(b.id, 'activities', `Activities, ${spoken}`, row.activities)}</td>
                              <td>{field(b.id, 'moves', `Moves and materials, ${spoken}`, row.moves)}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
        {blocks.length > 0 && !readOnly && (
          <p className="outline__hint no-print">
            Type the first start time of a day, or any end time or length. Each row starts when the one above ends, and
            changes update your time blocks too.
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </Section>
  );
}
