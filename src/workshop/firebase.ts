import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  deleteUser,
  EmailAuthProvider,
  getAdditionalUserInfo,
  getAuth,
  linkWithCredential,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithEmailLink,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { firebaseConfig, isHostDomain, useEmulator } from './config';
import { track } from '../analytics';
import {
  accountLinkUrl,
  clearAccountSignedIn,
  clearHostSignedIn,
  hostLinkUrl,
  markAccountSignedIn,
  markHostSignedIn,
  pendingHostEmail,
  setPendingHostEmail,
} from './session';

let cached: { auth: Auth; db: Database } | null = null;

export function fb() {
  if (cached) return cached;
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getDatabase(app);
  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(db, '127.0.0.1', 9000);
  }
  cached = { auth, db };
  return cached;
}

/** Participants sign in anonymously, so they never need an account. Hosts sign in with an email link. */
export async function signIn(): Promise<string> {
  const { auth } = fb();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}

export class HostSignInError extends Error {
  name = 'HostSignInError';
}

export const NOT_A_HOST = 'This email is not set up to host workshops. Contact Women Facilitating to be added.';

let claimsRefreshed = false;
/**
 * Approved facilitators: a verified email at an approved domain, or an account marked as a host
 * (`npm run hosts -- add <email>`). The mark is fetched fresh once per page load so new approvals apply.
 */
async function hasHostAccess(u: User | null): Promise<boolean> {
  if (!u?.email || u.isAnonymous) return false;
  if (isHostDomain(u.email)) return true;
  const force = !claimsRefreshed;
  claimsRefreshed = true;
  const result = await u.getIdTokenResult(force).catch(() => u.getIdTokenResult());
  return result.claims.host === true;
}

/** Emails a one-time sign-in link for the facilitator view (whether they may host is checked after sign-in). */
export async function sendHostLink(email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  await sendSignInLinkToEmail(fb().auth, e, { url: hostLinkUrl(), handleCodeInApp: true });
  setPendingHostEmail(e);
}

/** Emails a one-time sign-in link for a free account (anyone can have one). */
export async function sendAccountLink(email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  await sendSignInLinkToEmail(fb().auth, e, { url: accountLinkUrl(), handleCodeInApp: true });
  setPendingHostEmail(e);
}

export const isHostLink = (url: string) => isSignInWithEmailLink(fb().auth, url);

/**
 * Finishes signing in from the emailed link. The email is remembered on the device that asked for the
 * link. Someone in a workshop on this device keeps their participant identity: it is upgraded to the
 * account rather than replaced (unless that email already has an account).
 */
export function completeHostSignIn(url: string, email = pendingHostEmail()): Promise<string> {
  // A link works only once, so a second call for the same link (two parts of the page opening it at
  // once) shares the first sign-in instead of failing with "already used". A failure can be retried.
  let pending = signInsInFlight.get(url);
  if (!pending) {
    pending = signInWithLink(url, email);
    signInsInFlight.set(url, pending);
    pending.catch(() => signInsInFlight.delete(url));
  }
  return pending;
}
const signInsInFlight = new Map<string, Promise<string>>();

async function signInWithLink(url: string, email: string | null): Promise<string> {
  if (!email) throw new HostSignInError('Confirm your email to finish signing in.');
  const e = email.trim().toLowerCase();
  const { auth } = fb();
  await auth.authStateReady();
  // New account (counted as account-created) or a returning sign-in (account-signed-in).
  let isNew = false;
  try {
    const anon = auth.currentUser?.isAnonymous ? auth.currentUser : null;
    if (anon) {
      try {
        await linkWithCredential(anon, EmailAuthProvider.credentialWithLink(e, url));
        isNew = true; // an email was added to someone who had none: a brand-new account
      } catch (err) {
        const code = (err as { code?: string }).code ?? '';
        if (!code.includes('already-in-use')) throw err;
        const cred = await signInWithEmailLink(auth, e, url);
        isNew = getAdditionalUserInfo(cred)?.isNewUser ?? false;
      }
    } else {
      const cred = await signInWithEmailLink(auth, e, url);
      isNew = getAdditionalUserInfo(cred)?.isNewUser ?? false;
    }
  } catch {
    throw new HostSignInError('That sign-in link has expired or was already used. Request a new one.');
  }
  setPendingHostEmail(null);
  track(isNew ? 'account-created' : 'account-signed-in');
  markAccountSignedIn(e);
  if (await hasHostAccess(auth.currentUser)) markHostSignedIn(e);
  return e;
}

/** The signed-in account on this device (anyone with a confirmed email), if any. */
export async function currentAccount(): Promise<{ uid: string; email: string } | null> {
  const { auth } = fb();
  await auth.authStateReady();
  const u = auth.currentUser;
  if (u?.email && !u.isAnonymous) return { uid: u.uid, email: u.email };
  clearAccountSignedIn();
  return null;
}

/** Deletes the signed-in Firebase user (their saved canvases are removed first by the caller). */
export async function deleteSignedInUser(): Promise<void> {
  const u = fb().auth.currentUser;
  if (!u) return;
  try {
    await deleteUser(u);
  } catch (err) {
    if ((err as { code?: string }).code === 'auth/requires-recent-login') {
      throw new HostSignInError('For your security, sign in again with a fresh email link, then delete your account.');
    }
    throw err;
  }
  clearAccountSignedIn();
  clearHostSignedIn();
}

/** The signed-in facilitator on this device, if any. */
export async function currentHost(): Promise<{ uid: string; email: string } | null> {
  const { auth } = fb();
  await auth.authStateReady();
  const u = auth.currentUser;
  if (u?.email && (await hasHostAccess(u))) return { uid: u.uid, email: u.email };
  clearHostSignedIn();
  return null;
}

export async function signOutHost(): Promise<void> {
  await signOut(fb().auth);
  clearHostSignedIn();
  clearAccountSignedIn();
}
