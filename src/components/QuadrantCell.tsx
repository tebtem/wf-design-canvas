import { NoteCell } from './NoteCell';

const QUADRANTS = [
  { key: 'think', title: 'Think' },
  { key: 'feel', title: 'Feel' },
  { key: 'say', title: 'Say' },
  { key: 'do', title: 'Do' },
];

export function QuadrantCell({ prefix, title }: { prefix: string; title: string }) {
  return (
    <div className="card quadrant">
      {QUADRANTS.map((q) => (
        <NoteCell
          key={q.key}
          cellId={`${prefix}.${q.key}`}
          title={q.title}
          accessibleTitle={`${title}: ${q.title}`}
          className={`quadrant__cell quadrant__cell--${q.key}`}
          placeholder=""
        />
      ))}
    </div>
  );
}
