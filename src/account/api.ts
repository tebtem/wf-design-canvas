/**
 * Free accounts: up to three canvases saved online (users/<uid>/canvases/c1..c3). Loaded on demand,
 * so people who never sign in never download Firebase. Rules: database.rules.json ("users").
 */
import { get, ref, remove, serverTimestamp, set } from 'firebase/database';
import type { CanvasState } from '../state/types';
import { currentAccount, fb } from '../workshop/firebase';

export {
  completeHostSignIn as completeEmailSignIn,
  currentAccount,
  deleteSignedInUser,
  isHostLink as isEmailLink,
  sendAccountLink,
  signOutHost as signOut,
} from '../workshop/firebase';

export const SLOTS = ['c1', 'c2', 'c3'] as const;
export type Slot = (typeof SLOTS)[number];
export const MAX_CANVASES = SLOTS.length;

export interface SavedCanvas {
  slot: Slot;
  name: string;
  state: string;
  updatedAt: number;
}

const path = (uid: string, slot?: Slot) => `users/${uid}/canvases${slot ? `/${slot}` : ''}`;

async function uid(): Promise<string> {
  const a = await currentAccount();
  if (!a) throw new Error('Not signed in');
  return a.uid;
}

/** The account's saved canvases, most recently changed first. */
export async function listCanvases(): Promise<SavedCanvas[]> {
  const snap = await get(ref(fb().db, path(await uid())));
  const all = (snap.val() as Record<string, Omit<SavedCanvas, 'slot'>> | null) ?? {};
  return Object.entries(all)
    .filter(([slot]) => (SLOTS as readonly string[]).includes(slot))
    .map(([slot, c]) => ({ slot: slot as Slot, name: c.name ?? '', state: c.state, updatedAt: c.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveCanvas(slot: Slot, state: CanvasState): Promise<void> {
  await set(ref(fb().db, path(await uid(), slot)), {
    state: JSON.stringify(state),
    name: state.details.title.trim().slice(0, 120),
    updatedAt: serverTimestamp(),
  });
}

export const deleteCanvas = async (slot: Slot) => remove(ref(fb().db, path(await uid(), slot)));

/** Removes all saved canvases, then the account itself. */
export async function deleteAccount(): Promise<void> {
  const { deleteSignedInUser } = await import('../workshop/firebase');
  await remove(ref(fb().db, `users/${await uid()}`));
  await deleteSignedInUser();
}

/** Adds a confirmed email to the MailerLite "Canvas" group (only if they ticked the box). */
export async function subscribeToUpdates(email: string): Promise<void> {
  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}
