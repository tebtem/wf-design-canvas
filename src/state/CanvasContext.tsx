import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { reducer, type Action } from './reducer';
import { loadState, saveState } from './persist';
import type { CanvasState } from './types';

export type SaveStatus = 'idle' | 'saved' | 'error';

interface Ctx {
  state: CanvasState;
  dispatch: Dispatch<Action>;
  saveStatus: SaveStatus;
}

const CanvasContext = createContext<Ctx | null>(null);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const loaded = useRef(state);

  useEffect(() => {
    if (state === loaded.current) return;
    const t = window.setTimeout(() => {
      setSaveStatus(saveState(state) ? 'saved' : 'error');
    }, 400);
    return () => window.clearTimeout(t);
  }, [state]);

  return (
    <CanvasContext.Provider value={{ state, dispatch, saveStatus }}>{children}</CanvasContext.Provider>
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
