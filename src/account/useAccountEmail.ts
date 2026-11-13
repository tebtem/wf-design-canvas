import { useSyncExternalStore } from 'react';
import { accountSignedInEmail } from '../workshop/session';
import { ACCOUNT_CHANGED_EVENT } from './session';

/** The email signed in on this device (remembered locally), updating when people sign in or out. */
export function useAccountEmail(): string | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(ACCOUNT_CHANGED_EVENT, onChange);
      window.addEventListener('storage', onChange);
      return () => {
        window.removeEventListener(ACCOUNT_CHANGED_EVENT, onChange);
        window.removeEventListener('storage', onChange);
      };
    },
    accountSignedInEmail,
    () => null,
  );
}
