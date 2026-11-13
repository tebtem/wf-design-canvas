import { useEffect, useRef } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { parseState } from '../state/persist';
import { workAmount } from '../state/backup';
import { accountSignedInEmail } from '../workshop/session';
import {
  activeSlot,
  hasUnsentAccountChanges,
  setActiveSlot,
  setUnsentAccountChanges,
  SLOT_EVENT,
  type SlotId,
} from './session';

/** Fired after signing in, so the canvas starts saving to the account. */
export const SIGNED_IN_EVENT = 'wf:account-signed-in';
/** Fired once the canvas on screen is connected to the account (so My canvases can list it). */
export const ACCOUNT_READY_EVENT = 'wf:account-ready';

/**
 * For signed-in accounts, keeps the solo canvas saved online (about 1.5 seconds after each change)
 * and loads the newest copy when the page opens. Does nothing, and loads nothing, for everyone else.
 */
export function AccountSync() {
  const { state, dispatch } = useCanvas();
  const ready = useRef(false);
  const slot = useRef<SlotId | null>(null);
  const loaded = useRef<unknown>(null);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    let live = true;
    const start = async () => {
      ready.current = false;
      if (!accountSignedInEmail()) return;
      const api = await import('./api');
      const acct = await api.currentAccount().catch(() => null);
      if (!acct || !live) return;
      const list = await api.listCanvases().catch(() => null);
      if (!list || !live) return;
      const local = latest.current;
      let s = activeSlot();
      const remote = s ? list.find((c) => c.slot === s) : undefined;
      if (s && remote) {
        const theirs = parseState(remote.state);
        if (hasUnsentAccountChanges()) await api.saveCanvas(s, local).catch(() => {});
        else if (theirs && remote.state !== JSON.stringify(local)) {
          loaded.current = theirs;
          dispatch({ type: 'load', state: theirs });
        }
      } else if (workAmount(local) > 0) {
        // First sign-in with work in this browser: keep it in a free slot.
        const free = api.SLOTS.find((x) => !list.some((c) => c.slot === x)) ?? null;
        if (free) await api.saveCanvas(free, local).catch(() => {});
        s = free;
      } else if (list.length) {
        const newest = parseState(list[0].state);
        if (newest) {
          loaded.current = newest;
          dispatch({ type: 'load', state: newest });
        }
        s = list[0].slot;
      } else {
        s = 'c1';
      }
      if (!live) return;
      slot.current = s;
      if (s !== activeSlot()) setActiveSlot(s);
      setUnsentAccountChanges(false);
      ready.current = true;
      window.dispatchEvent(new Event(ACCOUNT_READY_EVENT));
    };
    void start();
    const onSignedIn = () => void start();
    const onSlot = () => {
      slot.current = activeSlot();
    };
    window.addEventListener(SIGNED_IN_EVENT, onSignedIn);
    window.addEventListener(SLOT_EVENT, onSlot);
    return () => {
      live = false;
      window.removeEventListener(SIGNED_IN_EVENT, onSignedIn);
      window.removeEventListener(SLOT_EVENT, onSlot);
    };
  }, [dispatch]);

  // Save changes to the account shortly after they are made.
  useEffect(() => {
    if (!ready.current || !slot.current) return;
    if (loaded.current === state) return; // just loaded from the account; nothing new to save
    setUnsentAccountChanges(true);
    const target = slot.current;
    const t = window.setTimeout(async () => {
      const api = await import('./api');
      api.saveCanvas(target, state).then(
        () => setUnsentAccountChanges(false),
        () => {},
      );
    }, 1500);
    return () => window.clearTimeout(t);
  }, [state]);

  return null;
}
