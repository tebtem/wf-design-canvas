import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useCanvas } from '../state/CanvasContext';
import { parseState } from '../state/persist';
import type { CanvasState } from '../state/types';
import type { Lock, Present } from './team';
import { hasUnsentAccountChanges, LOCK_IDLE_MS, setTeamHandle, setUnsentAccountChanges } from './session';

// Firebase code loads on demand, like the rest of the account code.
const team = () => import('./team');
const HEARTBEAT_MS = 10_000;

/** "annie" for annie@example.com. */
export const personName = (email: string) => email.split('@')[0] || email;

const listNames = (names: string[]) =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * Keeps a facilitator canvas saved online and live. When it is shared, one person edits at a time:
 * everyone else sees the canvas view only, updating as the editor works. Shows who is editing and who
 * else has it open, with a button to start or stop editing.
 */
export function TeamSync({ id, onGone }: { id: string; onGone: () => void }) {
  const uid = useId();
  const { state, dispatch, setViewOnly } = useCanvas();
  const [me, setMe] = useState<{ uid: string; email: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const [lock, setLock] = useState<Lock | null>(null);
  const [people, setPeople] = useState<Present[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const offset = useRef(0);
  const latest = useRef(state);
  const fromRemote = useRef<CanvasState | null>(null);
  const pending = useRef(false);
  const editingRef = useRef(false);
  /** Set after "Done editing", so the lock is not taken back automatically. */
  const released = useRef(false);
  const lastActive = useRef(0);
  const firstSnapshot = useRef(true);

  const shared = members.length > 0;
  const editing = Boolean(me && lock?.uid === me.uid);
  const viewOnly = shared && !editing;

  useEffect(() => {
    latest.current = state;
  }, [state]);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  useEffect(() => {
    setViewOnly(viewOnly);
  }, [viewOnly, setViewOnly]);
  useEffect(() => () => setViewOnly(false), [setViewOnly]);

  /** Sends the latest change now, if there is one. */
  const saveNow = useCallback(async () => {
    if (!pending.current) return;
    const t = await team();
    const s = latest.current;
    try {
      await t.saveTeamState(id, s, editingRef.current);
      if (latest.current === s) {
        pending.current = false;
        setUnsentAccountChanges(false);
      }
    } catch {
      // Someone else is editing now: show their version.
      pending.current = false;
      setUnsentAccountChanges(false);
      setError('Your last change was not saved because someone else is editing now.');
      const raw = await t.getTeamState(id).catch(() => null);
      const theirs = parseState(raw);
      if (theirs) {
        fromRemote.current = theirs;
        dispatch({ type: 'load', state: theirs });
      }
    }
  }, [id, dispatch]);

  // Live updates for this canvas.
  useEffect(() => {
    let live = true;
    let stop = () => {};
    firstSnapshot.current = true;
    (async () => {
      const t = await team();
      const acct = await t.myAccount().catch(() => null);
      if (!acct || !live) return;
      setMe(acct);
      const { owner } = await t.teamOwner(id).catch(() => ({ owner: '' }));
      if (!live) return;
      const offOffset = t.watchServerOffset((o) => {
        offset.current = o;
        setServerOffset(o);
      });
      let prevHolder: string | null | undefined;
      const onLock = (l: Lock | null) => {
        setLock(l);
        // Tell screen reader users when the editor changes.
        const holder = l?.uid ?? null;
        const prev = prevHolder;
        prevHolder = holder;
        if (prev === undefined || prev === holder) return;
        if (holder === acct.uid) setAnnounce('You are editing. Everyone else sees your changes as you make them.');
        else if (l) {
          if (prev === acct.uid) void t.forgetLock(id);
          const who = personName(l.email);
          setAnnounce(
            prev === acct.uid
              ? `${who} took over editing. The canvas is view only for you now.`
              : `${who} started editing. The canvas is view only for you.`,
          );
        } else setAnnounce(prev === acct.uid ? 'You stopped editing.' : 'Nobody is editing. You can edit now.');
      };
      const offWatch = t.watchTeamCanvas(id, {
        onState: (raw) => {
          if (!live) return;
          const first = firstSnapshot.current;
          firstSnapshot.current = false;
          if (first && hasUnsentAccountChanges()) {
            // Changes made here while offline: send them (refused if someone else is editing).
            pending.current = true;
            void saveNow();
          } else if (raw !== JSON.stringify(latest.current) && !editingRef.current && !pending.current) {
            const next = parseState(raw);
            if (next) {
              fromRemote.current = next;
              dispatch({ type: 'load', state: next });
            }
          }
          setLoaded(true);
        },
        onLock: (l) => live && onLock(l),
        onMembers: (m) => {
          if (!live) return;
          setMembers(m);
          // Removed by the owner: this canvas is no longer yours to open.
          if (owner && owner !== acct.uid && !m.includes(acct.email)) onGone();
        },
        onPresence: (p) => live && setPeople(p),
        onGone: () => live && onGone(),
      });
      void t.joinPresence(id).catch(() => {});
      stop = () => {
        offOffset();
        offWatch();
      };
    })();
    return () => {
      live = false;
      stop();
      void team().then((t) => {
        void t.leavePresence(id).catch(() => {});
        void t.releaseLock(id).catch(() => {});
      });
    };
  }, [id, dispatch, onGone, saveNow]);

  // Save shortly after each change (sooner when others are watching).
  useEffect(() => {
    if (!loaded || viewOnly || fromRemote.current === state) return;
    pending.current = true;
    setUnsentAccountChanges(true);
    const t = window.setTimeout(() => void saveNow(), shared ? 600 : 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Switching canvases or signing out saves the last change and lets go of the lock first.
  useEffect(() => {
    setTeamHandle({
      flush: saveNow,
      release: async () => {
        const t = await team();
        await t.releaseLock(id).catch(() => {});
        await t.leavePresence(id).catch(() => {});
      },
    });
    return () => setTeamHandle(null);
  }, [id, saveNow]);

  // Typing, clicking or tapping keeps the lock while editing.
  useEffect(() => {
    const mark = () => {
      lastActive.current = Date.now();
    };
    const events = ['keydown', 'pointerdown', 'input'] as const;
    events.forEach((e) => document.addEventListener(e, mark, true));
    return () => events.forEach((e) => document.removeEventListener(e, mark, true));
  }, []);
  // Every 10 seconds, the lock is refreshed if there was activity since the last refresh, so it
  // frees up 30 to 40 seconds after the editor's last activity.
  useEffect(() => {
    if (!editing) return;
    const iv = window.setInterval(() => {
      if (Date.now() - lastActive.current < HEARTBEAT_MS) void team().then((t) => t.touchLock(id).catch(() => {}));
    }, HEARTBEAT_MS);
    return () => window.clearInterval(iv);
  }, [editing, id]);

  // Refresh "has been inactive" while someone else holds the lock.
  const watchingIdle = shared && Boolean(lock) && !editing;
  useEffect(() => {
    if (!watchingIdle) return;
    const iv = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(iv);
  }, [watchingIdle]);

  const others = people.filter((p) => p.uid !== me?.uid);

  const take = useCallback(async () => {
    setBusy(true);
    setError('');
    const t = await team();
    const ok = await t.takeLock(id, offset.current);
    setBusy(false);
    if (ok) {
      released.current = false;
      lastActive.current = Date.now();
    } else {
      setError('Someone else started editing first.');
    }
  }, [id]);

  // Opening a shared canvas nobody else has open starts editing straight away.
  useEffect(() => {
    if (!loaded || !shared || !me || lock || released.current || others.length) return;
    void take();
  }, [loaded, shared, me, lock, others.length, take]);

  const done = async () => {
    setBusy(true);
    setError('');
    released.current = true;
    await saveNow();
    await (await team()).releaseLock(id).catch(() => {});
    setBusy(false);
  };

  if (!me || !shared) return null;

  const holder = lock && lock.uid !== me.uid ? lock : null;
  const idle = holder ? now + serverOffset - holder.at > LOCK_IDLE_MS : false;
  const blocked = Boolean(holder && !idle);
  const statusId = `${uid}-status`;
  const status = editing
    ? 'You are editing. Everyone else sees your changes as you make them.'
    : holder && !idle
      ? `${personName(holder.email)} is editing. You will see their changes as they happen.`
      : holder
        ? `${personName(holder.email)} is editing but has been inactive for a while.`
        : 'View only. Nobody is editing right now.';
  const label = editing ? 'Done editing' : holder && idle ? 'Take over editing' : 'Edit';

  return (
    <section className={`share-bar no-print${editing ? ' is-editing' : ''}`} aria-label="Shared canvas">
      <div className="share-bar__text">
        <p id={statusId} className="share-bar__status">
          {status}
        </p>
        <p className="share-bar__here">
          {others.length
            ? `Also here: ${listNames(others.map((p) => personName(p.email)))}`
            : 'Nobody else has this canvas open.'}
        </p>
        {error && (
          <p className="share-bar__error" role="alert">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        className={`btn${editing ? '' : ' btn--primary'}`}
        aria-disabled={blocked || busy || undefined}
        aria-describedby={blocked ? statusId : undefined}
        onClick={() => {
          if (blocked || busy) return;
          void (editing ? done() : take());
        }}
      >
        {label}
      </button>
      <p className="sr-only" role="status">
        {announce}
      </p>
    </section>
  );
}
