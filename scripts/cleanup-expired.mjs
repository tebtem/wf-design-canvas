// Deletes workshops past their expiry date. Run daily by .github/workflows/cleanup.yml.
// Needs FIREBASE_SERVICE_ACCOUNT (service account JSON) and FIREBASE_DATABASE_URL,
// or FIREBASE_DATABASE_EMULATOR_HOST for local testing.
import { cert, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const { FIREBASE_SERVICE_ACCOUNT, FIREBASE_DATABASE_URL, FIREBASE_DATABASE_EMULATOR_HOST } = process.env;

if (FIREBASE_DATABASE_EMULATOR_HOST) {
  initializeApp({ projectId: 'demo-wf-canvas', databaseURL: `http://${FIREBASE_DATABASE_EMULATOR_HOST}?ns=demo-wf-canvas` });
} else if (FIREBASE_SERVICE_ACCOUNT && FIREBASE_DATABASE_URL) {
  initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)), databaseURL: FIREBASE_DATABASE_URL });
} else {
  console.log('Workshop cleanup skipped: Firebase is not configured.');
  process.exit(0);
}

const db = getDatabase();
const now = Date.now();
const [byIndex, bySession] = await Promise.all([
  db.ref('expiries').orderByValue().endAt(now).once('value'),
  // Also catch any session whose index entry went missing.
  db.ref('sessions').orderByChild('meta/expiresAt').endAt(now).once('value'),
]);
const codes = new Set([...Object.keys(byIndex.val() ?? {}), ...Object.keys(bySession.val() ?? {})]);
const updates = {};
for (const code of codes) {
  updates[`sessions/${code}`] = null;
  updates[`expiries/${code}`] = null;
  // Also drop it from the host's "Your workshops" list.
  const host = (await db.ref(`sessions/${code}/meta/facilitator`).once('value')).val();
  if (host) updates[`hosts/${host}/${code}`] = null;
}
if (codes.size) await db.ref().update(updates);
console.log(`Deleted ${codes.size} expired workshop${codes.size === 1 ? '' : 's'}.`);
process.exit(0);
