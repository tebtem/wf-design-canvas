import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { parseState } from '../state/persist';
import { workAmount } from '../state/backup';
import { accountSignedInEmail } from '../workshop/session';
import { isAllowedHostEmail } from '../workshop/config';
import { TeamSync } from './TeamSync';
import {
  activeSlot,
  hasUnsentAccountChanges,
  isSlot,
  isTeamKey,
  setActiveSlot,
  setUnsentAccountChanges,
  SLOT_EVENT,
  teamIdOf,
  teamKey,
  type CanvasKey,
} from './session';

/** Fired after signing in, so the canvas starts saving to the account. */
export const SIGNED_IN_EVENT = 'wf:account-signed-in';
/** Fired once the canvas on screen is connected to the account (so My canvases can list it). */
export const ACCOUNT_READY_EVENT = 'wf:account-ready';

const teamOf = (k: CanvasKey | null) => (isTeamKey(k) ? teamIdOf(k) : null);

/**
 * For signed-in accounts, keeps the solo canvas saved online (about 1.5 seconds after each change)
 * and loads the newest copy when the page opens. Facilitator canvases (unlimited, shareable) are
 * kept live by TeamSync. Does nothing, and loads nothing, for everyone else.
 */
export function AccountSync() {
  const { state, dispatch } = useCanvas();
  const ready = useRef(false);
  const slot = useRef<CanvasKey | null>(null);
  const loaded = useRef<unknown>(null);
  const latest = useRef(state);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [goneNote, setGoneNote] = useState(false);
  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    let live = true;
    const finish = (s: CanvasKey | null) => {
      slot.current = s;
      if (s !== activeSlot()) setActiveSlot(s);
      setTeamId(teamOf(s));
      // A facilitator canvas checks for unsent changes itself when it connects.
      if (!isTeamKey(s)) setUnsentAccountChanges(false);
      ready.current = true;
      window.dispatchEvent(new Event(ACCOUNT_READY_EVENT));
    };
    const start = async () => {
      ready.current = false;
      if (!accountSignedInEmail()) return;
      const api = await import('./api');
      const acct = await api.currentAccount().catch(() => null);
      if (!acct || !live) return;
      const list = await api.listCanvases().catch(() => null);
      if (!list || !live) return;
      const t = isAllowedHostEmail(acct.email) ? await import('./team') : null;
      const teamList = t ? await t.listTeamCanvases().catch(() => []) : [];
      if (!live) return;
      const local = latest.current;
      let s = activeSlot();
      const remote = isSlot(s) ? list.find((c) => c.slot === s) : undefined;
      const openTeam = teamOf(s);
      if (openTeam && teamList.some((c) => c.id === openTeam)) {
        // TeamSync loads it and keeps it live.
      } else if (isSlot(s) && remote) {
        const theirs = parseState(remote.state);
        if (hasUnsentAccountChanges()) await api.saveCanvas(s, local).catch(() => {});
        else if (theirs && remote.state !== JSON.stringify(local)) {
          loaded.current = theirs;
          dispatch({ type: 'load', state: theirs });
        }
      } else if (workAmount(local) > 0) {
        // First sign-in with work in this browser: keep it in a free slot (facilitators: always room).
        const free = api.SLOTS.find((x) => !list.some((c) => c.slot === x)) ?? null;
        if (free) {
          await api.saveCanvas(free, local).catch(() => {});
          s = free;
        } else if (t) {
          s = await t.createTeamCanvas(local).then(teamKey, () => null);
        } else s = null;
      } else {
        // Open the most recently changed canvas.
        const newest = [
          ...list.map((c) => ({ key: c.slot as CanvasKey, state: c.state, at: c.updatedAt })),
          ...teamList.map((c) => ({ key: teamKey(c.id) as CanvasKey, state: c.state, at: c.updatedAt })),
        ].sort((a, b) => b.at - a.at)[0];
        const next = newest ? parseState(newest.state) : null;
        if (newest && next) {
          loaded.current = next;
          dispatch({ type: 'load', state: next });
        }
        s = newest?.key ?? 'c1';
      }
      if (!live) return;
      finish(s);
    };
    void start();
    const onSignedIn = () => void start();
    const onSlot = () => {
      slot.current = activeSlot();
      setTeamId(teamOf(slot.current));
      if (slot.current) setGoneNote(false);
    };
    window.addEventListener(SIGNED_IN_EVENT, onSignedIn);
    window.addEventListener(SLOT_EVENT, onSlot);
    return () => {
      live = false;
      window.removeEventListener(SIGNED_IN_EVENT, onSignedIn);
      window.removeEventListener(SLOT_EVENT, onSlot);
    };
  }, [dispatch]);

  // Save changes to the account shortly after they are made (facilitator canvases save in TeamSync).
  useEffect(() => {
    const target = slot.current;
    if (!ready.current || !isSlot(target)) return;
    if (loaded.current === state) return; // just loaded from the account; nothing new to save
    setUnsentAccountChanges(true);
    const t = window.setTimeout(async () => {
      if (slot.current !== target) return; // switched to another canvas meanwhile
      const api = await import('./api');
      api.saveCanvas(target, state).then(
        () => setUnsentAccountChanges(false),
        () => {},
      );
    }, 1500);
    return () => window.clearTimeout(t);
  }, [state]);

  // The open canvas was deleted, or its owner stopped sharing it: keep what is on screen locally.
  const onGone = useCallback(() => {
    setActiveSlot(null);
    setGoneNote(true);
  }, []);

  return (
    <>
      {teamId && <TeamSync key={teamId} id={teamId} onGone={onGone} />}
      {goneNote && (
        <div className="ws-notice ws-notice--warn share-gone no-print" role="alert">
          <span>
            This canvas was deleted or is no longer shared with you. What is on screen is saved only in this
            browser.
          </span>
          <button type="button" className="btn btn--small" onClick={() => setGoneNote(false)}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
