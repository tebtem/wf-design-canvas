import { useSyncExternalStore } from 'react';

/** Canvas layout: one stacked column, or the original two-column canvas. */
export type Layout = 'stacked' | 'canvas';

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

/** What to show: the viewer's choice; stacked unless they picked the two-column canvas. */
export const effectiveLayout = (pref: Layout | null): Layout => pref ?? 'stacked';
