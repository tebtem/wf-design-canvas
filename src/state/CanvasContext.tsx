import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { reducer, type Action } from './reducer';
import { readState, saveState, STORAGE_KEY } from './persist';
import { initialState } from './reducer';
import type { CanvasState } from './types';

export type SaveStatus = 'idle' | 'saved' | 'error';

interface Ctx {
  state: CanvasState;
  dispatch: Dispatch<Action>;
  saveStatus: SaveStatus;
  /** True when showing someone else's canvas: nothing can be edited. */
  readOnly: boolean;
}

const CanvasContext = createContext<Ctx | null>(null);

interface Props {
  children: ReactNode;
  /** localStorage key. Workshop canvases use their own key so the personal canvas is untouched. */
  storageKey?: string;
  /** Starting canvas when nothing is saved under the key yet. */
  initial?: () => CanvasState | null;
}

export function CanvasProvider({ children, storageKey = STORAGE_KEY, initial }: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, () => readState(storageKey) ?? initial?.() ?? initialState());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const loaded = useRef(state);

  useEffect(() => {
    if (state === loaded.current) return;
    const t = window.setTimeout(() => {
      setSaveStatus(saveState(state, storageKey) ? 'saved' : 'error');
    }, 400);
    return () => window.clearTimeout(t);
  }, [state, storageKey]);

  return (
    <CanvasContext.Provider value={{ state, dispatch, saveStatus, readOnly: false }}>{children}</CanvasContext.Provider>
  );
}

const noop = () => {};

/** Shows a canvas without letting anyone change it. */
export function ReadOnlyCanvasProvider({ state, children }: { state: CanvasState; children: ReactNode }) {
  return (
    <CanvasContext.Provider value={{ state, dispatch: noop, saveStatus: 'idle', readOnly: true }}>
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvas(): Ctx {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error('useCanvas must be used inside CanvasProvider');
  return ctx;
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
