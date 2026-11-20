/** Which saved canvas this browser is working on, and whether it has changes not yet saved online. */
const SLOT_KEY = 'wf-design-canvas:account-slot';
const UNSENT_KEY = 'wf-design-canvas:account-unsent';
export const SLOT_EVENT = 'wf:account-slot';

const load = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const store = (k: string, v: string | null) => {
  try {
    if (v) window.localStorage.setItem(k, v);
    else window.localStorage.removeItem(k);
  } catch {
    // Storage blocked.
  }
};

export type SlotId = 'c1' | 'c2' | 'c3';
/** A facilitator canvas (unlimited, shareable): "t:" plus its id under team/ in the database. */
export type TeamKey = `t:${string}`;
export type CanvasKey = SlotId | TeamKey;
export const isSlot = (k: CanvasKey | null): k is SlotId => k === 'c1' || k === 'c2' || k === 'c3';
export const isTeamKey = (k: CanvasKey | null): k is TeamKey => Boolean(k && /^t:[A-Za-z0-9_-]{6,40}$/.test(k));
export const teamKey = (id: string): TeamKey => `t:${id}`;
export const teamIdOf = (k: TeamKey) => k.slice(2);

export const activeSlot = (): CanvasKey | null => {
  const v = load(SLOT_KEY) as CanvasKey | null;
  return isSlot(v) || isTeamKey(v) ? v : null;
};
export const setActiveSlot = (slot: CanvasKey | null) => {
  store(SLOT_KEY, slot);
  window.dispatchEvent(new Event(SLOT_EVENT));
};
export const hasUnsentAccountChanges = () => load(UNSENT_KEY) === '1';
export const setUnsentAccountChanges = (v: boolean) => store(UNSENT_KEY, v ? '1' : null);

/** Opens the account dialog from anywhere (toolbar, backup reminder). */
export const OPEN_ACCOUNT_EVENT = 'wf:open-account';
export const openAccountDialog = () => window.dispatchEvent(new Event(OPEN_ACCOUNT_EVENT));

/** Fired when someone signs in or out, so labels like "My canvases" update. */
export const ACCOUNT_CHANGED_EVENT = 'wf:account-changed';
export const announceAccountChange = () => window.dispatchEvent(new Event(ACCOUNT_CHANGED_EVENT));

/**
 * The open facilitator canvas registers how to save its last change and how to let go of the edit
 * lock, so switching canvases or signing out can finish both first.
 */
export interface TeamHandle {
  flush: () => Promise<void>;
  release: () => Promise<void>;
}
let teamHandle: TeamHandle | null = null;
export const setTeamHandle = (h: TeamHandle | null) => {
  teamHandle = h;
};
export const flushTeam = async () => teamHandle?.flush();
export const releaseTeam = async () => teamHandle?.release();

/** A shared canvas's edit lock can be taken over after this long without activity. */
export const LOCK_IDLE_MS = 30_000;
