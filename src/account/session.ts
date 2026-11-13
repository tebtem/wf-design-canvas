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
export const activeSlot = (): SlotId | null => {
  const v = load(SLOT_KEY);
  return v === 'c1' || v === 'c2' || v === 'c3' ? v : null;
};
export const setActiveSlot = (slot: SlotId | null) => {
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
