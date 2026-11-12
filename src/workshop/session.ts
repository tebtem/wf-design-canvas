/** Which workshop this browser is in, so a refresh reconnects. No Firebase code here. */
export interface ActiveWorkshop {
  code: string;
  role: 'participant' | 'facilitator';
  uid: string;
  /** Participant display name. */
  name?: string;
}

const KEY = 'wf-design-canvas:workshop';

/** Each workshop canvas is saved under its own key so the personal canvas is never overwritten. */
export const workshopCanvasKey = (code: string) => `wf-design-canvas:ws:${code}`;

export function loadWorkshop(): ActiveWorkshop | null {
  try {
    const w = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as ActiveWorkshop | null;
    return w?.code && w.uid && (w.role === 'participant' || w.role === 'facilitator') ? w : null;
  } catch {
    return null;
  }
}

export function saveWorkshop(w: ActiveWorkshop | null) {
  try {
    if (w) window.localStorage.setItem(KEY, JSON.stringify(w));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the workshop still works until the page reloads.
  }
}

/** Reads and removes ?join=CODE from the address so a shared link opens the join form. */
export function takeJoinParam(): string | null {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('join');
  if (!code) return null;
  url.searchParams.delete('join');
  window.history.replaceState(null, '', url);
  return code;
}

export const joinUrl = (code: string) => {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('join', code);
  return url.toString();
};
