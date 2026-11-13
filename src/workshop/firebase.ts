import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  linkWithCredential,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithEmailLink,
  signOut,
  type Auth,
} from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { firebaseConfig, isAllowedHostEmail, useEmulator } from './config';
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

/** Emails a one-time sign-in link to an approved facilitator. */
export async function sendHostLink(email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!isAllowedHostEmail(e)) {
    throw new HostSignInError('This email is not set up to host workshops. Contact Women Facilitating to be added.');
  }
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
export async function completeHostSignIn(url: string, email = pendingHostEmail()): Promise<string> {
  if (!email) throw new HostSignInError('Confirm your email to finish signing in.');
  const e = email.trim().toLowerCase();
  const { auth } = fb();
  await auth.authStateReady();
  try {
    const anon = auth.currentUser?.isAnonymous ? auth.currentUser : null;
    if (anon) {
      try {
        await linkWithCredential(anon, EmailAuthProvider.credentialWithLink(e, url));
      } catch (err) {
        const code = (err as { code?: string }).code ?? '';
        if (!code.includes('already-in-use')) throw err;
        await signInWithEmailLink(auth, e, url);
      }
    } else {
      await signInWithEmailLink(auth, e, url);
    }
  } catch {
    throw new HostSignInError('That sign-in link has expired or was already used. Request a new one.');
  }
  setPendingHostEmail(null);
  markAccountSignedIn(e);
  if (isAllowedHostEmail(e)) markHostSignedIn(e);
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
  if (u?.email && !u.isAnonymous && isAllowedHostEmail(u.email)) return { uid: u.uid, email: u.email };
  clearHostSignedIn();
  return null;
}

export async function signOutHost(): Promise<void> {
  await signOut(fb().auth);
  clearHostSignedIn();
  clearAccountSignedIn();
}
