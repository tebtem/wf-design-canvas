/** Every note cell on the canvas, grouped by section. Single source for titles and ids. */
export interface CellDef {
  id: string;
  /** Visible label. */
  title: string;
  /** Full name for assistive tech and the move dialog, e.g. "Participant Before: Think". */
  fullTitle: string;
}

export interface CellGroup {
  section: string;
  cells: CellDef[];
}

const simple = (prefix: string, titles: string[]): CellDef[] =>
  titles.map((title, i) => ({ id: `${prefix}.${i}`, title, fullTitle: title }));

const quadrant = (prefix: string, section: string): CellDef[] =>
  ['Think', 'Feel', 'Say', 'Do'].map((title) => ({
    id: `${prefix}.${title.toLowerCase()}`,
    title,
    fullTitle: `${section}: ${title}`,
  }));

export const CELL_GROUPS: CellGroup[] = [
  { section: 'Session Brief', cells: simple('brief', ['Purpose', 'Outcomes', 'Time', 'Stats']) },
  { section: 'Participant Before', cells: quadrant('before', 'Participant Before') },
  { section: 'Participant After', cells: quadrant('after', 'Participant After') },
  {
    section: 'Participants at the Center',
    cells: simple('participants', [
      'Who is participating?',
      'What is their level of psych safety?',
      'What are the dynamics?',
      'What else do I need to consider?',
    ]),
  },
  {
    section: 'Facilitator at the Center',
    cells: simple('facilitator', [
      'My goals as a facilitator…',
      'What I want to learn…',
      'How I want to feel…',
      'What I want to try…',
    ]),
  },
  {
    section: 'Flow + Function',
    cells: Array.from({ length: 9 }, (_, i) => ({
      id: `flow.${i}`,
      title: `Flow step ${i + 1}`,
      fullTitle: `Flow step ${i + 1}`,
    })),
  },
  { section: 'Activity Ideation', cells: [{ id: 'ideas', title: 'Activity ideas', fullTitle: 'Activity ideas' }] },
];

const byId = new Map(CELL_GROUPS.flatMap((g) => g.cells.map((c) => [c.id, c] as const)));

export const cellsIn = (section: string): CellDef[] =>
  CELL_GROUPS.find((g) => g.section === section)?.cells ?? [];

export const cellTitle = (id: string): string => byId.get(id)?.fullTitle ?? id;
