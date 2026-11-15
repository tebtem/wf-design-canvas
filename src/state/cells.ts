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
      title: `Function ${i + 1}`,
      fullTitle: `Function ${i + 1}`,
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

type FlowLayout = { flowColumns: number; flowOrder?: number[] };

/** A saved order is used only if it lists each of the canvas's columns exactly once. */
export const isValidFlowOrder = (order: unknown, flowColumns: number): order is number[] =>
  Array.isArray(order) &&
  order.length === flowColumns &&
  new Set(order).size === order.length &&
  order.every((n) => Number.isInteger(n) && n >= 0 && n < FLOW_MAX);

/** Flow cell numbers in display order: position 0 shows flow.<order[0]>, and so on. */
export const flowOrder = (s: FlowLayout): number[] =>
  isValidFlowOrder(s.flowOrder, s.flowColumns) ? s.flowOrder : Array.from({ length: s.flowColumns }, (_, i) => i);

/** A Flow column's label from where it sits now and what it is called, e.g. "Function 2: Explore". */
export const flowColumnLabel = (position: number, name?: string) =>
  `Function ${position + 1}${(name ?? '').trim() ? `: ${(name ?? '').trim()}` : ''}`;

/**
 * A cell's label. With the canvas, Flow columns are named by their current position and name, since
 * columns can be reordered; without it they fall back to the fixed "Function N".
 */
export function cellLabel(id: string, s?: (FlowLayout & { cells: Record<string, { title?: string }> }) | null): string {
  if (!s || !id.startsWith('flow.')) return cellTitle(id);
  const position = flowOrder(s).indexOf(Number(id.slice(5)));
  return position === -1 ? cellTitle(id) : flowColumnLabel(position, s.cells[id]?.title);
}

/** A section's cells in screen order: Flow columns as the canvas arranges them, only those it shows. */
export function cellsInOrder<C extends { id: string }>(cells: C[], s?: FlowLayout | null): C[] {
  if (!s || !cells[0]?.id.startsWith('flow.')) return cells;
  return flowOrder(s).map((n) => cells.find((c) => c.id === `flow.${n}`)!).filter(Boolean);
}

/** Cells on screen for a canvas: only the Flow columns it has added. */
export const isCellShown = (cellId: string, s: FlowLayout) =>
  !cellId.startsWith('flow.') || flowOrder(s).includes(Number(cellId.slice(5)));

const byId = new Map(CELL_GROUPS.flatMap((g) => g.cells.map((c) => [c.id, c] as const)));

export const cellsIn = (section: string): CellDef[] =>
  CELL_GROUPS.find((g) => g.section === section)?.cells ?? [];

export const cellTitle = (id: string): string => byId.get(id)?.fullTitle ?? id;
