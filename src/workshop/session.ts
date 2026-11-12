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

/**
 * Marks a workshop canvas as having changes this device has not sent yet. On opening, a device
 * without unsent changes takes the online copy, so an old laptop never overwrites newer work done
 * on another device.
 */
const dirtyKey = (code: string) => `${workshopCanvasKey(code)}:unsent`;
export function setUnsent(code: string, unsent: boolean) {
  try {
    if (unsent) window.localStorage.setItem(dirtyKey(code), '1');
    else window.localStorage.removeItem(dirtyKey(code));
  } catch {
    // Storage blocked: nothing to remember.
  }
}
export function hasUnsent(code: string): boolean {
  try {
    return window.localStorage.getItem(dirtyKey(code)) === '1';
  } catch {
    return false;
  }
}

// ---------- Facilitator sign-in (no Firebase code here, so the solo canvas stays light) ----------
const HOST_KEY = 'wf-design-canvas:host';
const PENDING_KEY = 'wf-design-canvas:host-pending';

const store = (key: string, value: string | null) => {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Storage blocked.
  }
};
const load = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Remembers that a facilitator signed in here, so the Host option shows without loading Firebase. */
export const markHostSignedIn = (email: string) => store(HOST_KEY, email);
export const clearHostSignedIn = () => store(HOST_KEY, null);
export const hostSignedInEmail = () => load(HOST_KEY);
export const setPendingHostEmail = (email: string | null) => store(PENDING_KEY, email);
export const pendingHostEmail = () => load(PENDING_KEY);

/** Where the emailed sign-in link returns to. */
export const hostLinkUrl = () => {
  const url = new URL(window.location.href);
  url.search = '?host';
  url.hash = '';
  return url.toString();
};

/** Reads and removes ?host (the facilitator link). Returns true if it was there. */
export function takeHostParam(): boolean {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('host')) return false;
  url.searchParams.delete('host');
  window.history.replaceState(null, '', url);
  return true;
}

/** True when the address is an emailed sign-in link (checked again by Firebase before use). */
export const looksLikeHostLink = (href: string) => {
  const p = new URL(href).searchParams;
  return p.get('mode') === 'signIn' && p.has('oobCode');
};

/** Removes the sign-in link parameters once used. */
export function clearLinkParams() {
  const url = new URL(window.location.href);
  url.search = '';
  window.history.replaceState(null, '', url);
}

export const joinUrl = (code: string) => {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('join', code);
  return url.toString();
};
