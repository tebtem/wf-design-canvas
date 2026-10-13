import { initialState } from './reducer';
import type { CanvasState } from './types';

export const STORAGE_KEY = 'wf-design-canvas:v1';

export function loadState(): CanvasState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<CanvasState>;
    if (parsed?.version !== 1 || typeof parsed.cells !== 'object' || !parsed.drafts) {
      return initialState();
    }
    return {
      version: 1,
      cells: parsed.cells ?? {},
      drafts: { d1: parsed.drafts.d1 ?? [], d2: parsed.drafts.d2 ?? [] },
    };
  } catch {
    return initialState();
  }
}

/** Returns true when the save succeeded. */
export function saveState(state: CanvasState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
