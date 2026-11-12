import { useCanvas } from '../state/CanvasContext';
import { formatMinutes, totalMinutes, visibleDrafts } from '../state/reducer';
import { DRAFT_NAMES, type DraftId, type OutlineRow } from '../state/types';
import { Section } from './Section';

/** 75 -> "01:15", the format facilitators use on run-of-show sheets. */
export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const EMPTY: OutlineRow = { activities: '', moves: '' };

/** Run of show built from a session draft: times come from the blocks, the rest is typed in. */
export function SessionOutline() {
  const { state, dispatch, readOnly } = useCanvas();
  const drafts = visibleDrafts(state);
  const draft: DraftId = drafts.includes(state.outline.draft) ? state.outline.draft : 'd1';
  const blocks = state.drafts[draft];
  const title = state.details.title.trim();

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
                Session Outline{title ? ` for ${title}` : ''}, from {DRAFT_NAMES[draft]}
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
                  const start = totalMinutes(blocks.slice(0, i));
                  const range = `${hhmm(start)} - ${hhmm(start + b.minutes)}`;
                  const spoken = `${hhmm(start)} to ${hhmm(start + b.minutes)}${b.label ? `, ${b.label}` : ''}`;
                  const row = state.outline.rows[b.id] ?? EMPTY;
                  return (
                    <tr key={b.id}>
                      <th scope="row" className="outline__time">
                        {range}
                        {b.label && <span className="outline__block">{b.label}</span>}
                      </th>
                      <td className="outline__len">{b.minutes} min</td>
                      <td>{field(b.id, 'activities', `Activities, ${spoken}`, row.activities)}</td>
                      <td>{field(b.id, 'moves', `Moves and materials, ${spoken}`, row.moves)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}
