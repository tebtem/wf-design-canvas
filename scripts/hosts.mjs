// Approves facilitators outside the approved domains to host workshops, by marking their Firebase
// account (a "host" custom claim). Keeps personal emails out of the app and the database rules.
//
//   npm run hosts -- add someone@example.com
//   npm run hosts -- remove someone@example.com
//   npm run hosts -- list
//
// Needs FIREBASE_SERVICE_ACCOUNT (the service account JSON, as for the cleanup job), or
// FIREBASE_AUTH_EMULATOR_HOST for local testing. Changes apply the next time they open the canvas.
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const { FIREBASE_SERVICE_ACCOUNT, FIREBASE_AUTH_EMULATOR_HOST } = process.env;
const [command, rawEmail] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

if (FIREBASE_AUTH_EMULATOR_HOST) initializeApp({ projectId: 'demo-wf-canvas' });
else if (FIREBASE_SERVICE_ACCOUNT) initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
else {
  console.error('Set FIREBASE_SERVICE_ACCOUNT to the service account JSON first.');
  process.exit(1);
}
const auth = getAuth();

async function userFor(e) {
  try {
    return await auth.getUserByEmail(e);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    // Not signed in yet: create the account now; their first email-link sign-in uses it.
    return auth.createUser({ email: e });
  }
}

if (command === 'add' && email) {
  const u = await userFor(email);
  await auth.setCustomUserClaims(u.uid, { ...u.customClaims, host: true });
  console.log(`${email} can now host workshops.`);
} else if (command === 'remove' && email) {
  const u = await auth.getUserByEmail(email);
  const { host: _removed, ...rest } = u.customClaims ?? {};
  await auth.setCustomUserClaims(u.uid, rest);
  // Sign them out everywhere so the change applies right away (rules accept old sign-ins for up to an hour).
  await auth.revokeRefreshTokens(u.uid);
  console.log(`${email} can no longer host workshops.`);
} else if (command === 'list') {
  let page;
  do {
    page = await auth.listUsers(1000, page?.pageToken);
    for (const u of page.users) if (u.customClaims?.host === true) console.log(u.email);
  } while (page.pageToken);
} else {
  console.error('Usage: npm run hosts -- add <email> | remove <email> | list');
  process.exit(1);
}
process.exit(0);
