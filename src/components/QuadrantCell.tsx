import { cellsIn } from '../state/cells';
import { NoteCell } from './NoteCell';

export function QuadrantCell({ section }: { section: string }) {
  return (
    <div className="card quadrant">
      {cellsIn(section).map((c) => (
        <NoteCell
          key={c.id}
          cellId={c.id}
          title={c.title}
          accessibleTitle={c.fullTitle}
          className={`quadrant__cell quadrant__cell--${c.title.toLowerCase()}`}
          placeholder=""
        />
      ))}
    </div>
  );
}
