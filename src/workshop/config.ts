import allowlist from './host-allowlist.json';

/** Workshop mode only appears when the build has Firebase settings (see README). */
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const useEmulator = env.VITE_FIREBASE_EMULATOR === 'true';

export const workshopsEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL);

/** Days a workshop stays online before it expires and is deleted. */
export const RETENTION_DAYS = 30;

/** Whether an email may host workshops. The database rules enforce the same list. */
export function isAllowedHostEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  const domain = e.split('@')[1] ?? '';
  return allowlist.emails.includes(e) || allowlist.domains.includes(domain);
}
