/**
 * Everything that talks to Firebase. Loaded on demand so the solo canvas never downloads it.
 * Data layout and access rules are in database.rules.json at the repo root. Expired workshops are
 * unreadable straight away and deleted daily by .github/workflows/cleanup.yml.
 */
import {
  get,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import type { CanvasState } from '../state/types';
import { generateCode, generateRejoinCode } from './code';
import { RETENTION_DAYS } from './config';
import { fb, signIn } from './firebase';

export { signIn };

export interface SessionMeta {
  title: string;
  facilitator: string;
  createdAt: number;
  expiresAt: number;
  canView: boolean;
  /** Guided reveal: how many sections participants see (see REVEAL_STEPS). Missing means all. */
  step?: number;
  spotlight?: { uid: string; name: string } | null;
}
export interface Member {
  name: string;
  joinedAt: number;
}
export interface RemoteCanvas {
  /** Canvas JSON. Stored as a string because cell ids contain dots, which database keys cannot. */
  state: string;
  updatedAt: number;
}
export interface Comment {
  id: string;
  text: string;
  cellId?: string;
  createdAt: number;
}

type Unsub = () => void;

const DAY = 24 * 60 * 60 * 1000;
const p = (code: string, ...rest: string[]) => ['sessions', code, ...rest].join('/');
const r = (path?: string) => ref(fb().db, path);

export class WorkshopError extends Error {
  name = 'WorkshopError';
  constructor(
    message: string,
    /** The form field the message is about. */
    readonly field: 'code' | 'name' | 'rejoin' = 'code',
  ) {
    super(message);
  }
}

const isDenied = (e: unknown) => String((e as Error)?.message ?? e).toLowerCase().includes('permission');

/** Milliseconds between this device's clock and the server's. */
function serverOffset(): Promise<number> {
  return new Promise((resolve) => {
    onValue(r('.info/serverTimeOffset'), (s) => resolve(Number(s.val()) || 0), () => resolve(0), { onlyOnce: true });
  });
}

export async function createSession(title: string, step: number): Promise<{ code: string; uid: string }> {
  const uid = await signIn();
  const offset = await serverOffset();
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateCode();
    const expiresAt = Date.now() + offset + RETENTION_DAYS * DAY - 10 * 60 * 1000;
    const meta = { title, facilitator: uid, createdAt: serverTimestamp(), expiresAt, canView: false, step };
    try {
      await update(r(), { [p(code, 'meta')]: meta, [`expiries/${code}`]: expiresAt });
      return { code, uid };
    } catch (e) {
      // A taken code is refused by the rules, so try another.
      if (!isDenied(e)) throw e;
    }
  }
  throw new WorkshopError('Could not create a workshop code. Please try again.');
}

export type JoinResult = { uid: string; meta: SessionMeta; role: 'participant' | 'facilitator' };

export async function joinSession(code: string, name: string): Promise<JoinResult> {
  const uid = await signIn();
  const snap = await get(r(p(code, 'meta'))).catch((e) => {
    if (isDenied(e)) return null;
    throw e;
  });
  const meta = snap?.val() as SessionMeta | null;
  if (!meta) throw new WorkshopError('No active workshop uses that code. Check the code with your facilitator.');
  // The host re-entering their own code gets the host view back.
  if (meta.facilitator === uid) return { uid, meta, role: 'facilitator' };
  if (!name) throw new WorkshopError('Enter your name so your facilitator knows whose canvas is whose.', 'name');
  const existing = await get(r(p(code, 'rejoinKeys', uid))).catch(() => null);
  if (existing?.exists()) {
    await set(r(p(code, 'members', uid)), { name, joinedAt: serverTimestamp() });
  } else {
    await joinWithNewRejoinCode(code, uid, { name, joinedAt: serverTimestamp() });
  }
  return { uid, meta, role: 'participant' };
}

/** Joins and saves a fresh rejoin code in one write. Retries if the random code is taken. */
async function joinWithNewRejoinCode(code: string, uid: string, member?: object) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateRejoinCode();
    const updates: Record<string, unknown> = {
      [p(code, 'rejoinKeys', uid)]: key,
      [p(code, 'rejoin', key)]: uid,
    };
    if (member) updates[p(code, 'members', uid)] = member;
    try {
      await update(r(), updates);
      return key;
    } catch (e) {
      if (!isDenied(e)) throw e;
    }
  }
  throw new WorkshopError('Could not join the workshop. Please try again.');
}

/** Participants who joined before rejoin codes existed get one the next time they open the workshop. */
export async function ensureRejoinCode(code: string, pid: string): Promise<void> {
  const uid = await signIn();
  if (uid !== pid) return;
  const snap = await get(r(p(code, 'rejoinKeys', pid))).catch(() => null);
  if (snap && !snap.exists()) await joinWithNewRejoinCode(code, pid).catch(() => {});
}

/**
 * Returning on a new device: the rejoin code links this device to the participant's original id,
 * which is what the app then uses as their id.
 */
export async function rejoinSession(code: string, key: string): Promise<{ pid: string; name: string; meta: SessionMeta }> {
  const uid = await signIn();
  const metaSnap = await get(r(p(code, 'meta'))).catch(() => null);
  const meta = metaSnap?.val() as SessionMeta | null;
  if (!meta) throw new WorkshopError('No active workshop uses that code. Check the code with your facilitator.');
  const pidSnap = await get(r(p(code, 'rejoin', key))).catch(() => null);
  const pid = pidSnap?.val() as string | null;
  if (!pid) throw new WorkshopError('That rejoin code does not match this workshop. Your facilitator can look it up for you.', 'rejoin');
  if (pid !== uid) await set(r(p(code, 'aliases', uid)), { pid, key });
  const member = (await get(r(p(code, 'members', pid)))).val() as Member | null;
  return { pid, name: member?.name ?? 'Participant', meta };
}

export function watchRejoinCode(code: string, pid: string, cb: (key: string | null) => void): Unsub {
  return onValue(
    r(p(code, 'rejoinKeys', pid)),
    (s) => cb((s.val() as string | null) ?? null),
    () => cb(null),
  );
}

export const watchRejoinCodes = (code: string, cb: (keys: Record<string, string>) => void) =>
  watchMap<string>(p(code, 'rejoinKeys'), cb);

export async function fetchOwnCanvas(code: string, uid: string): Promise<string | null> {
  const snap = await get(r(p(code, 'canvases', uid))).catch(() => null);
  return (snap?.val() as RemoteCanvas | null)?.state ?? null;
}

export function pushCanvas(code: string, uid: string, state: CanvasState) {
  return set(r(p(code, 'canvases', uid)), { state: JSON.stringify(state), updatedAt: serverTimestamp() });
}

/** Calls back with null when the workshop ends, expires, or cannot be read. */
export function watchMeta(code: string, cb: (meta: SessionMeta | null) => void): Unsub {
  return onValue(r(p(code, 'meta')), (s) => cb(s.val() as SessionMeta | null), () => cb(null));
}

export function watchConnected(cb: (connected: boolean) => void): Unsub {
  return onValue(r('.info/connected'), (s) => cb(s.val() === true));
}

function watchMap<T>(path: string, cb: (v: Record<string, T>) => void, onDenied?: () => void): Unsub {
  return onValue(
    r(path),
    (s) => cb((s.val() as Record<string, T> | null) ?? {}),
    () => {
      cb({});
      onDenied?.();
    },
  );
}

export const watchMembers = (code: string, cb: (m: Record<string, Member>) => void, onDenied?: () => void) =>
  watchMap<Member>(p(code, 'members'), cb, onDenied);

export const watchCanvases = (code: string, cb: (c: Record<string, RemoteCanvas>) => void, onDenied?: () => void) =>
  watchMap<RemoteCanvas>(p(code, 'canvases'), cb, onDenied);

export function watchCanvas(code: string, uid: string, cb: (c: RemoteCanvas | null) => void): Unsub {
  return onValue(
    r(p(code, 'canvases', uid)),
    (s) => cb(s.val() as RemoteCanvas | null),
    () => cb(null),
  );
}

const toList = (m: Record<string, Omit<Comment, 'id'>>): Comment[] =>
  Object.entries(m)
    .map(([id, c]) => ({ id, ...c }))
    .sort((a, b) => a.createdAt - b.createdAt);

export const watchComments = (code: string, uid: string, cb: (c: Comment[]) => void) =>
  watchMap<Omit<Comment, 'id'>>(p(code, 'comments', uid), (m) => cb(toList(m)));

export const watchAllComments = (code: string, cb: (c: Record<string, Comment[]>) => void) =>
  watchMap<Record<string, Omit<Comment, 'id'>>>(p(code, 'comments'), (m) =>
    cb(Object.fromEntries(Object.entries(m).map(([uid, list]) => [uid, toList(list)]))),
  );

export function addComment(code: string, uid: string, text: string, cellId?: string) {
  const data: Record<string, unknown> = { text, createdAt: serverTimestamp() };
  if (cellId) data.cellId = cellId;
  return push(r(p(code, 'comments', uid)), data).then(() => undefined);
}

export const deleteComment = (code: string, uid: string, id: string) => remove(r(p(code, 'comments', uid, id)));

export const setStep = (code: string, step: number) => set(r(p(code, 'meta', 'step')), step);

export const setCanView = (code: string, canView: boolean) => set(r(p(code, 'meta', 'canView')), canView);

export const setSpotlight = (code: string, spotlight: { uid: string; name: string } | null) =>
  set(r(p(code, 'meta', 'spotlight')), spotlight);

/** Deletes the workshop and every canvas and comment in it. */
export const endSession = (code: string) => update(r(), { [p(code)]: null, [`expiries/${code}`]: null });
