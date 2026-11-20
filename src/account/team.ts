/**
 * Facilitator canvases: unlimited for anyone on the host allowlist, and shareable with other
 * facilitators. One person edits at a time (the lock); everyone else sees changes live.
 * Stored at team/<id>, listed per person at teamIndex/<email key>. Rules: database.rules.json.
 */
import {
  get,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
  type Unsubscribe,
} from 'firebase/database';
import type { CanvasState } from '../state/types';
import { currentAccount, fb } from '../workshop/firebase';
import { isAllowedHostEmail } from '../workshop/config';
import { LOCK_IDLE_MS } from './session';


/** Emails become database keys with "." written as "," (keys cannot contain dots). */
export const emailKey = (email: string) => email.trim().toLowerCase().replace(/\./g, ',');
export const keyEmail = (key: string) => key.replace(/,/g, '.');

export interface TeamCanvas {
  id: string;
  name: string;
  state: string;
  updatedAt: number;
  owner: string;
  ownerEmail: string;
  /** Emails it is shared with (not including the owner). */
  members: string[];
}

export interface Lock {
  uid: string;
  email: string;
  at: number;
}

export interface Present {
  uid: string;
  email: string;
}

interface Raw {
  name?: string;
  state?: string;
  updatedAt?: number;
  owner?: string;
  ownerEmail?: string;
  members?: Record<string, true>;
}

const db = () => fb().db;
const TS = serverTimestamp();

async function me(): Promise<{ uid: string; email: string }> {
  const a = await currentAccount();
  if (!a) throw new Error('Not signed in');
  return { uid: a.uid, email: a.email.toLowerCase() };
}

const toCanvas = (id: string, r: Raw): TeamCanvas => ({
  id,
  name: r.name ?? '',
  state: r.state ?? '',
  updatedAt: r.updatedAt ?? 0,
  owner: r.owner ?? '',
  ownerEmail: r.ownerEmail ?? '',
  members: Object.keys(r.members ?? {}).map(keyEmail),
});

/** Every facilitator canvas this person owns or has been shared on, newest first. */
export async function listTeamCanvases(): Promise<TeamCanvas[]> {
  const a = await me();
  const mine = emailKey(a.email);
  const idx = await get(ref(db(), `teamIndex/${mine}`));
  const ids = Object.keys((idx.val() as Record<string, true> | null) ?? {});
  const found = await Promise.all(
    ids.map(async (id) => {
      try {
        const s = await get(ref(db(), `team/${id}`));
        return s.exists() ? toCanvas(id, s.val() as Raw) : null;
      } catch {
        return null; // no longer shared with this person
      }
    }),
  );
  // Tidy up entries for canvases that were deleted or unshared.
  const gone = ids.filter((_, i) => !found[i]);
  if (gone.length) {
    void update(ref(db(), `teamIndex/${mine}`), Object.fromEntries(gone.map((id) => [id, null]))).catch(() => {});
  }
  return found.filter((c): c is TeamCanvas => c !== null).sort((x, y) => y.updatedAt - x.updatedAt);
}

/** Who owns a canvas (small reads, without downloading the canvas itself). */
export async function teamOwner(id: string): Promise<{ owner: string; ownerEmail: string }> {
  const [o, e] = await Promise.all([get(ref(db(), `team/${id}/owner`)), get(ref(db(), `team/${id}/ownerEmail`))]);
  return { owner: (o.val() as string | null) ?? '', ownerEmail: (e.val() as string | null) ?? '' };
}

/** The canvas as saved online right now. */
export async function getTeamState(id: string): Promise<string | null> {
  return ((await get(ref(db(), `team/${id}/state`))).val() as string | null) ?? null;
}

const nameOf = (state: CanvasState) => state.details.title.trim().slice(0, 120);

/** Creates a new facilitator canvas owned by the signed-in person. Returns its id. */
export async function createTeamCanvas(state: CanvasState): Promise<string> {
  const a = await me();
  const id = push(ref(db(), 'team')).key!;
  await update(ref(db()), {
    [`team/${id}`]: { owner: a.uid, ownerEmail: a.email, name: nameOf(state), state: JSON.stringify(state), updatedAt: TS },
    [`teamIndex/${emailKey(a.email)}/${id}`]: true,
  });
  return id;
}

/** Saves the canvas. While holding the edit lock, saving also counts as activity. */
export async function saveTeamState(id: string, state: CanvasState, holdingLock: boolean): Promise<void> {
  await update(ref(db(), `team/${id}`), {
    state: JSON.stringify(state),
    name: nameOf(state),
    updatedAt: TS,
    ...(holdingLock ? { 'lock/at': TS } : {}),
  });
}

export class ShareError extends Error {
  name = 'ShareError';
}

export async function shareTeamCanvas(id: string, email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!isAllowedHostEmail(e)) {
    throw new ShareError('Canvases can only be shared with approved facilitators. Check the email, or ask to have it added.');
  }
  const k = emailKey(e);
  await update(ref(db()), { [`team/${id}/members/${k}`]: true, [`teamIndex/${k}/${id}`]: true });
}

export async function unshareTeamCanvas(id: string, email: string): Promise<void> {
  const k = emailKey(email);
  await update(ref(db()), { [`team/${id}/members/${k}`]: null, [`teamIndex/${k}/${id}`]: null });
}

/** Removes yourself from a canvas someone shared with you. */
export async function leaveTeamCanvas(id: string): Promise<void> {
  const k = emailKey((await me()).email);
  await update(ref(db()), { [`team/${id}/members/${k}`]: null, [`teamIndex/${k}/${id}`]: null });
}

/** Deletes a canvas you own, and removes it from everyone's list. */
export async function deleteTeamCanvas(c: TeamCanvas): Promise<void> {
  const keys = [c.ownerEmail, ...c.members].map(emailKey);
  await update(ref(db()), {
    [`team/${c.id}`]: null,
    ...Object.fromEntries(keys.map((k) => [`teamIndex/${k}/${c.id}`, null])),
  });
}

/** For deleting an account: deletes the canvases you own and leaves the ones shared with you. */
export async function removeAllTeamCanvases(): Promise<void> {
  const a = await me();
  for (const c of await listTeamCanvases()) {
    if (c.owner === a.uid) await deleteTeamCanvas(c);
    else await leaveTeamCanvas(c.id);
  }
}

/** Milliseconds to add to this device's clock to match the database's. */
export function watchServerOffset(cb: (offset: number) => void): Unsubscribe {
  return onValue(ref(db(), '.info/serverTimeOffset'), (s) => cb((s.val() as number) ?? 0));
}

export interface TeamWatch {
  onState: (raw: string) => void;
  onLock: (lock: Lock | null) => void;
  onMembers: (members: string[]) => void;
  onPresence: (people: Present[]) => void;
  /** The canvas was deleted, or this person was removed from it. */
  onGone: () => void;
}

/** Live updates for one canvas. Returns a function that stops them. */
export function watchTeamCanvas(id: string, w: TeamWatch): Unsubscribe {
  const base = `team/${id}`;
  let gone = false;
  const lost = () => {
    if (gone) return;
    gone = true;
    w.onGone();
  };
  const offs = [
    onValue(
      ref(db(), `${base}/state`),
      (s) => (s.exists() ? w.onState(s.val() as string) : lost()),
      lost,
    ),
    onValue(ref(db(), `${base}/lock`), (s) => w.onLock((s.val() as Lock | null) ?? null), () => {}),
    onValue(
      ref(db(), `${base}/members`),
      (s) => w.onMembers(Object.keys((s.val() as Record<string, true> | null) ?? {}).map(keyEmail)),
      lost,
    ),
    onValue(
      ref(db(), `${base}/presence`),
      (s) => {
        const all = (s.val() as Record<string, { email: string }> | null) ?? {};
        w.onPresence(Object.entries(all).map(([uid, p]) => ({ uid, email: p.email })));
      },
      () => {},
    ),
  ];
  return () => offs.forEach((off) => off());
}

/**
 * Takes the edit lock if nobody holds it, it is already yours, or its holder has been idle for
 * LOCK_IDLE_MS. Returns false if someone else is editing.
 */
export async function takeLock(id: string, serverOffset: number): Promise<boolean> {
  const a = await me();
  const r = ref(db(), `team/${id}/lock`);
  try {
    const res = await runTransaction(r, (cur: Lock | null) => {
      if (cur && cur.uid !== a.uid && cur.at > Date.now() + serverOffset - LOCK_IDLE_MS) return undefined;
      return { uid: a.uid, email: a.email, at: TS };
    });
    if (!res.committed) return false;
    // Closing the tab or losing the connection lets go of the lock.
    await onDisconnect(r).remove();
    return true;
  } catch {
    return false;
  }
}

/** Marks the lock holder as still active. */
export async function touchLock(id: string): Promise<void> {
  await set(ref(db(), `team/${id}/lock/at`), TS);
}

/** Lets go of the lock if this person holds it. */
export async function releaseLock(id: string): Promise<void> {
  const a = await me();
  const r = ref(db(), `team/${id}/lock`);
  await onDisconnect(r).cancel().catch(() => {});
  await runTransaction(r, (cur: Lock | null) => (cur?.uid === a.uid ? null : undefined)).catch(() => {});
}

/** Stops this device from removing the lock on disconnect (after someone else took it over). */
export const forgetLock = (id: string) => onDisconnect(ref(db(), `team/${id}/lock`)).cancel().catch(() => {});

export async function joinPresence(id: string): Promise<void> {
  const a = await me();
  const r = ref(db(), `team/${id}/presence/${a.uid}`);
  await set(r, { email: a.email, at: TS });
  await onDisconnect(r).remove();
}

export async function leavePresence(id: string): Promise<void> {
  const a = await me();
  const r = ref(db(), `team/${id}/presence/${a.uid}`);
  await onDisconnect(r).cancel().catch(() => {});
  await remove(r).catch(() => {});
}

export const myAccount = me;
