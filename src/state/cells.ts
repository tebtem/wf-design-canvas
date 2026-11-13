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
  /** Guided workshops reveal sections in steps. This is the step that shows the section. */
  step: number;
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
  {
    section: 'Session Brief',
    step: 0,
    cells: simple('brief', ['Purpose', 'Outcomes', 'Timing + Logistics', 'Space + Materials']),
  },
  {
    section: 'Participants at the Center',
    step: 0,
    cells: simple('participants', [
      'Who is participating?',
      'What is their level of psych safety?',
      'What are the dynamics?',
      'What else do I need to consider?',
    ]),
  },
  { section: 'Participant Before', step: 0, cells: quadrant('before', 'Participant Before') },
  { section: 'Participant After', step: 0, cells: quadrant('after', 'Participant After') },
  {
    section: 'Facilitator at the Center',
    step: 1,
    cells: simple('facilitator', [
      'My goals as a facilitator…',
      'What I want to learn…',
      'How I want to feel…',
      'What I want to try…',
    ]),
  },
  {
    section: 'Flow, Function, and Form',
    step: 3,
    // Up to four rows of six; a canvas shows state.flowColumns of them (see FLOW_ROW).
    cells: Array.from({ length: 24 }, (_, i) => ({
      id: `flow.${i}`,
      title: `Flow step ${i + 1}`,
      fullTitle: `Flow step ${i + 1}`,
    })),
  },
  { section: 'Activity Ideation', step: 3, cells: [{ id: 'ideas', title: 'Activity ideas', fullTitle: 'Activity ideas' }] },
];

/** Guided reveal steps, in order. Step 2 is Time Blocks, which has no note cells. */
export const REVEAL_STEPS = [
  'Session Brief',
  'Facilitator at the Center',
  'Time Blocks',
  'Flow, Function, and Form + Activity Ideation',
  'Session Outline',
] as const;
export const LAST_STEP = REVEAL_STEPS.length - 1;
/** What each step adds, for the host's controls. */
export const STEP_DETAIL = [
  'Session Brief, Participants at the Center, Participant Before and After',
  'Facilitator at the Center',
  'Time Blocks',
  'Flow, Function, and Form, and Activity Ideation',
  'Session Outline',
];
/** Section anchor for each step (matches the Section ids in the canvas). */
export const STEP_ANCHORS = ['section-brief', 'section-facilitator', 'section-time', 'section-flow', 'section-outline'];

/** A step value from the database, clamped. Missing means everything is shown. */
export const clampStep = (step: number | undefined | null) =>
  typeof step === 'number' ? Math.max(0, Math.min(LAST_STEP, Math.floor(step))) : LAST_STEP;

/** Flow, Function, and Form columns come in rows of six, up to four rows. */
export const FLOW_ROW = 6;
export const FLOW_MAX = 24;
export const FLOW_SECTION = 'Flow, Function, and Form';

/** Cells on screen for a canvas: only the Flow columns it has added. */
export const isCellShown = (cellId: string, flowColumns: number) =>
  !cellId.startsWith('flow.') || Number(cellId.slice(5)) < flowColumns;

const byId = new Map(CELL_GROUPS.flatMap((g) => g.cells.map((c) => [c.id, c] as const)));

export const cellsIn = (section: string): CellDef[] =>
  CELL_GROUPS.find((g) => g.section === section)?.cells ?? [];

export const cellTitle = (id: string): string => byId.get(id)?.fullTitle ?? id;
