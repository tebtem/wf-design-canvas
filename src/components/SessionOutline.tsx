import { useCanvas } from '../state/CanvasContext';
import { breakMinutes, schedule, totalMinutes, totalWithBreaks, visibleDrafts } from '../state/reducer';
import { CupIcon } from './Icons';
import { useState } from 'react';
import { RichNote } from './RichNote';

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

/**
 * Run of show built from a copy of a session draft. Once brought in, it is the outline's own: changing
 * times, lengths or names here never changes Time Blocks, which stays the place to play with drafts.
 */
export function SessionOutline() {
  const { state, dispatch, readOnly } = useCanvas();
  const drafts = visibleDrafts(state);
  const [source, setSource] = useState<DraftId>(drafts.includes(state.outline.draft) ? state.outline.draft : 'd1');
  const from: DraftId = drafts.includes(source) ? source : 'd1';
  const imported = state.outline.blocks !== null;
  const blocks = state.outline.blocks ?? [];
  const draft = state.outline.draft;
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
    dispatch({ type: 'setOutlineMinutes', blockId, minutes: next });
    if (next !== minutes) {
      announce(`Lengths go in ${BLOCK_STEP}-minute steps from ${MIN_BLOCK} to ${MAX_BLOCK}. Set to ${next} minutes.`);
    }
  };

  /** Copies the chosen draft in. Doing it again replaces the outline's times, lengths and names. */
  const bringIn = () => {
    const name = DRAFT_NAMES[from];
    if (
      imported &&
      !window.confirm(
        `Replace the outline with ${name}? Times, lengths and names will match ${name} again. Notes in Activities and Moves + Materials stay with blocks that are still in it; notes on other rows are removed.`,
      )
    )
      return;
    dispatch({ type: 'importOutline', draft: from });
    announce(`${name} brought into the Session Outline. Changes you make here will not change your time blocks.`);
  };
  const fromEmpty = state.drafts[from].length === 0;

  /** Activities allow a title; Moves + Materials and break notes allow bold, italic and bullets. */
  const field = (blockId: string, key: keyof OutlineRow, label: string, value: string, allowTitle = false) => (
    <RichNote
      value={value}
      label={label}
      readOnly={readOnly}
      allowTitle={allowTitle}
      className="outline__rich"
      onChange={(html) => dispatch({ type: 'setOutlineRow', blockId, field: key, value: html })}
    />
  );

  return (
    <Section id="section-outline" title="Session Outline" className="band--outline">
      <div className="panel outline">
        <div className="outline__head">
          <p className="outline__title">
            {title || <span className="outline__untitled">Add a Working Title at the top of the canvas</span>}
          </p>
          {!readOnly && (
            <div className="outline__draft no-print">
              {drafts.length > 1 && (
                <>
                  <label htmlFor="outline-draft">{imported ? 'Draft' : 'Bring in'}</label>
                  <select id="outline-draft" value={from} onChange={(e) => setSource(e.target.value as DraftId)}>
                    {drafts.map((d) => (
                      <option key={d} value={d}>
                        {DRAFT_NAMES[d]}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {!fromEmpty && (
                <button type="button" className={`btn btn--small${imported ? '' : ' btn--primary'}`} onClick={bringIn}>
                  {imported ? `Replace with ${DRAFT_NAMES[from]}` : `Bring in ${DRAFT_NAMES[from]}`}
                </button>
              )}
            </div>
          )}
          {imported && from !== draft && <p className="outline__from">Now from {DRAFT_NAMES[draft]}</p>}
          {blocks.length > 0 && (
            <p className="outline__total">
              {multiDay && `${days.length} days · `}Total {totalWithBreaks(totalMinutes(blocks), breakMinutes(blocks))}
            </p>
          )}
        </div>

        {!imported ? (
          <p className="outline__empty">
            {fromEmpty
              ? `Add time blocks to ${DRAFT_NAMES[from]}, then bring it in here to build your run of show.`
              : `Bring in ${DRAFT_NAMES[from]} to build your run of show. After that, changes you make here stay in the outline, and your time blocks stay as they are.`}
          </p>
        ) : blocks.length === 0 ? (
          <p className="outline__empty">The draft that was brought in had no time blocks.</p>
        ) : (
          // Focusable so keyboard users can scroll the table sideways on narrow screens.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <div className="outline__scroll" role="region" aria-labelledby="outline-caption" tabIndex={0}>
            <table className="outline__table">
              <caption id="outline-caption" className="sr-only">
                Session Outline{title ? ` for ${title}` : ''}, brought in from {DRAFT_NAMES[draft]}. Type the first
                start time, or any end time or length; the rows below adjust. Changes here do not change your time
                blocks.
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
                  if (d.divider) dispatch({ type: 'setOutlineDayStart', blockId: d.divider.id, start: t });
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
                            {brk && (
                              <span className="outline__block outline__block--break">
                                <CupIcon /> {name}
                              </span>
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
                            <td colSpan={2}>
                              {field(b.id, 'activities', `Notes for break, ${spoken}`, row.activities)}
                            </td>
                          ) : (
                            <>
                              <td>
                                {/* The block's name, brought in from Time Blocks. Renaming it here leaves the draft alone. */}
                                {readOnly ? (
                                  b.label && <p className="outline__name">{b.label}</p>
                                ) : (
                                  <input
                                    className="outline__name"
                                    aria-label={`Block name, ${rowName}`}
                                    value={b.label}
                                    placeholder="Name this block"
                                    maxLength={120}
                                    autoComplete="off"
                                    onChange={(e) =>
                                      dispatch({ type: 'setOutlineLabel', blockId: b.id, label: e.target.value })
                                    }
                                  />
                                )}
                                {field(b.id, 'activities', `Activities, ${spoken}`, row.activities, true)}
                              </td>
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
            Type the first start time of a day, or any end time or length. Each row starts when the one above ends.
            Changes here stay in the outline; your time blocks stay as they are.
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {message}
        </p>
      </div>
    </Section>
  );
}
