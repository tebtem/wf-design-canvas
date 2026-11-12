import { useSyncExternalStore } from 'react';

/** Canvas layout: one stacked column, or the original two-column canvas. */
export type Layout = 'stacked' | 'canvas';

/** Step at which the guide opens up into the two-column canvas (Time Blocks; the left column is complete). */
export const CANVAS_LAYOUT_STEP = 2;

const KEY = 'wf-design-canvas:layout';
const listeners = new Set<() => void>();

function read(): Layout | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'stacked' || v === 'canvas' ? v : null;
  } catch {
    return null;
  }
}

let current: Layout | null = typeof window === 'undefined' ? null : read();

/** The viewer's own choice, remembered on this device. Null means "follow the guide". */
export function setLayoutPref(layout: Layout) {
  current = layout;
  try {
    window.localStorage.setItem(KEY, layout);
  } catch {
    // Not remembered, but still applied for this visit.
  }
  listeners.forEach((l) => l());
}

export function useLayoutPref(): Layout | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}

/** What to show: the viewer's choice, otherwise two columns once the guide reaches Time Blocks. */
export const effectiveLayout = (pref: Layout | null, step: number): Layout =>
  pref ?? (step >= CANVAS_LAYOUT_STEP ? 'canvas' : 'stacked');
