// Security rules checks. Run with `npm run test:rules` (starts the emulators for you).
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

const [host, port] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9000').split(':');
const env = await initializeTestEnvironment({
  projectId: 'demo-wf-canvas',
  database: { host, port: Number(port), rules: readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8') },
});
await env.clearDatabase();

const TS = { '.sv': 'timestamp' };
const DAY = 86_400_000;
const db = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).database();
const fac = db('fac');
const alice = db('alice');
const bob = db('bob');
const eve = db('eve');
const anon = db(null);

let failures = 0;
const check = async (name, p) => {
  try {
    await p;
    console.log('ok  ', name);
  } catch (e) {
    failures++;
    console.log('FAIL', name, '\n     ', e.message.split('\n')[0]);
  }
};

const S = 'ABC234';
const meta = (extra = {}) => ({ title: 'Test', facilitator: 'fac', createdAt: TS, expiresAt: Date.now() + 29 * DAY, canView: false, step: 0, ...extra });
const canvas = (text) => ({ state: JSON.stringify({ version: 1, text }), updatedAt: TS });

await check('host creates a session with its expiry index', assertSucceeds(fac.ref().update({ [`sessions/${S}/meta`]: meta(), [`expiries/${S}`]: meta().expiresAt })));
await check('signed-out users cannot create', assertFails(anon.ref(`sessions/ZZZ234/meta`).set({ ...meta(), facilitator: 'x' })));
await check('nobody can take an existing code', assertFails(eve.ref(`sessions/${S}/meta`).set(meta({ facilitator: 'eve' }))));
await check('codes must use the code alphabet', assertFails(fac.ref('sessions/abc10o/meta').set(meta())));
await check('expiry cannot exceed 30 days', assertFails(fac.ref('sessions/XYZ234/meta').set(meta({ expiresAt: Date.now() + 40 * DAY }))));
await check('cannot host as someone else', assertFails(eve.ref('sessions/XYZ235/meta').set(meta())));
await check('expiry index must match the session', assertFails(fac.ref().update({ 'sessions/QRS234/meta': meta(), 'expiries/QRS234': 1 })));

await check('anyone signed in can read live meta to join', assertSucceeds(alice.ref(`sessions/${S}/meta`).get()));
await check('alice joins', assertSucceeds(alice.ref(`sessions/${S}/members/alice`).set({ name: 'Alice', joinedAt: TS })));
await check('bob joins', assertSucceeds(bob.ref(`sessions/${S}/members/bob`).set({ name: 'Bob', joinedAt: TS })));
await check('cannot join as someone else', assertFails(eve.ref(`sessions/${S}/members/alice`).set({ name: 'Eve', joinedAt: TS })));
await check('host cannot be a member', assertFails(fac.ref(`sessions/${S}/members/fac`).set({ name: 'Host', joinedAt: TS })));
await check('cannot join a session that does not exist', assertFails(eve.ref('sessions/NNN234/members/eve').set({ name: 'Eve', joinedAt: TS })));

await check('alice writes her canvas', assertSucceeds(alice.ref(`sessions/${S}/canvases/alice`).set(canvas('a'))));
await check('bob writes his canvas', assertSucceeds(bob.ref(`sessions/${S}/canvases/bob`).set(canvas('b'))));
await check("bob cannot write alice's canvas", assertFails(bob.ref(`sessions/${S}/canvases/alice`).set(canvas('x'))));
await check('non-members cannot write a canvas', assertFails(eve.ref(`sessions/${S}/canvases/eve`).set(canvas('e'))));
await check('extra canvas fields are rejected', assertFails(alice.ref(`sessions/${S}/canvases/alice`).set({ ...canvas('a'), x: 1 })));
await check('host reads all canvases', assertSucceeds(fac.ref(`sessions/${S}/canvases`).get()));
await check('host reads members', assertSucceeds(fac.ref(`sessions/${S}/members`).get()));
await check('alice reads her own canvas', assertSucceeds(alice.ref(`sessions/${S}/canvases/alice`).get()));
await check("sharing off: bob cannot read alice's canvas", assertFails(bob.ref(`sessions/${S}/canvases/alice`).get()));
await check('sharing off: bob cannot list canvases', assertFails(bob.ref(`sessions/${S}/canvases`).get()));
await check('sharing off: bob cannot list members', assertFails(bob.ref(`sessions/${S}/members`).get()));

await check('participants cannot change settings', assertFails(alice.ref(`sessions/${S}/meta/canView`).set(true)));
await check('participants cannot spotlight', assertFails(alice.ref(`sessions/${S}/meta/spotlight`).set({ uid: 'alice', name: 'A' })));
await check('host spotlights alice', assertSucceeds(fac.ref(`sessions/${S}/meta/spotlight`).set({ uid: 'alice', name: 'Alice' })));
await check("spotlight: bob reads alice's canvas", assertSucceeds(bob.ref(`sessions/${S}/canvases/alice`).get()));
await check("spotlight: alice still cannot read bob's", assertFails(alice.ref(`sessions/${S}/canvases/bob`).get()));
await check('spotlight: non-members still cannot read', assertFails(eve.ref(`sessions/${S}/canvases/alice`).get()));
await check('host cannot change the expiry', assertFails(fac.ref(`sessions/${S}/meta/expiresAt`).set(Date.now() + 2 * DAY)));
await check('host reveals the next step', assertSucceeds(fac.ref(`sessions/${S}/meta/step`).set(1)));
await check('reveal step must be 0 to 3', assertFails(fac.ref(`sessions/${S}/meta/step`).set(4)));
await check('reveal step must be a whole number', assertFails(fac.ref(`sessions/${S}/meta/step`).set(1.5)));
await check('participants cannot reveal steps', assertFails(alice.ref(`sessions/${S}/meta/step`).set(3)));
await check('host turns sharing on', assertSucceeds(fac.ref(`sessions/${S}/meta/canView`).set(true)));
await check('sharing on: bob lists canvases', assertSucceeds(bob.ref(`sessions/${S}/canvases`).get()));
await check('sharing on: bob lists members', assertSucceeds(bob.ref(`sessions/${S}/members`).get()));
await check('sharing on: non-members still cannot read', assertFails(eve.ref(`sessions/${S}/canvases`).get()));

await check('host comments on alice', assertSucceeds(fac.ref(`sessions/${S}/comments/alice`).push({ text: 'Nice', cellId: 'brief.0', createdAt: TS })));
await check('participants cannot comment', assertFails(bob.ref(`sessions/${S}/comments/alice`).push({ text: 'Hi', createdAt: TS })));
await check('alice reads her comments', assertSucceeds(alice.ref(`sessions/${S}/comments/alice`).get()));
await check("bob cannot read alice's comments even with sharing on", assertFails(bob.ref(`sessions/${S}/comments/alice`).get()));
await check('host reads all comments', assertSucceeds(fac.ref(`sessions/${S}/comments`).get()));

// Rejoin codes: alice gets one; a new device ("alice2") uses it to act as alice.
const KEY = 'KQ7MX3PA';
const alice2 = db('alice2');
await check('alice saves her rejoin code', assertSucceeds(alice.ref(`sessions/${S}`).update({ [`rejoinKeys/alice`]: KEY, [`rejoin/${KEY}`]: 'alice' })));
await check('rejoin codes cannot be overwritten', assertFails(eve.ref(`sessions/${S}/rejoin/${KEY}`).set('eve')));
await check('cannot point a rejoin code at someone else', assertFails(bob.ref(`sessions/${S}`).update({ [`rejoinKeys/bob`]: 'ZZZZZZZZ', [`rejoin/ZZZZZZZZ`]: 'alice' })));
await check('non-members cannot create rejoin codes', assertFails(eve.ref(`sessions/${S}`).update({ [`rejoinKeys/eve`]: 'YYYYYYYY', [`rejoin/YYYYYYYY`]: 'eve' })));
await check('rejoin codes cannot be listed', assertFails(eve.ref(`sessions/${S}/rejoin`).get()));
await check('a known rejoin code can be looked up', assertSucceeds(alice2.ref(`sessions/${S}/rejoin/${KEY}`).get()));
await check('host reads everyone\'s rejoin codes', assertSucceeds(fac.ref(`sessions/${S}/rejoinKeys`).get()));
await check('participants cannot list rejoin codes', assertFails(bob.ref(`sessions/${S}/rejoinKeys`).get()));
await check("bob cannot read alice's rejoin code", assertFails(bob.ref(`sessions/${S}/rejoinKeys/alice`).get()));
await check('wrong code cannot create an alias', assertFails(eve.ref(`sessions/${S}/aliases/eve`).set({ pid: 'alice', key: 'ZZZZZZZZ' })));
await check('right code for the wrong person fails', assertFails(eve.ref(`sessions/${S}/aliases/eve`).set({ pid: 'bob', key: KEY })));
await check("before aliasing, a new device cannot read alice's canvas", assertFails(alice2.ref(`sessions/${S}/canvases/alice`).get()));
await check('new device aliases with the right code', assertSucceeds(alice2.ref(`sessions/${S}/aliases/alice2`).set({ pid: 'alice', key: KEY })));
await check("new device reads alice's canvas", assertSucceeds(alice2.ref(`sessions/${S}/canvases/alice`).get()));
await check("new device writes alice's canvas", assertSucceeds(alice2.ref(`sessions/${S}/canvases/alice`).set(canvas('from new device'))));
await check("new device reads alice's comments", assertSucceeds(alice2.ref(`sessions/${S}/comments/alice`).get()));
await check("new device reads alice's member record", assertSucceeds(alice2.ref(`sessions/${S}/members/alice`).get()));
await check("new device reads alice's rejoin code", assertSucceeds(alice2.ref(`sessions/${S}/rejoinKeys/alice`).get()));
await check("new device cannot write bob's canvas", assertFails(alice2.ref(`sessions/${S}/canvases/bob`).set(canvas('x'))));
await check('aliased device counts as a member when sharing is on', assertSucceeds(alice2.ref(`sessions/${S}/canvases`).get()));
await check('host cannot alias into a participant', assertFails(fac.ref(`sessions/${S}/aliases/fac`).set({ pid: 'alice', key: KEY })));

await check('participants cannot end the session', assertFails(alice.ref(`sessions/${S}`).remove()));
await check('participants cannot remove the expiry entry', assertFails(alice.ref(`expiries/${S}`).remove()));
await check('expiry index cannot be listed freely', assertFails(alice.ref('expiries').get()));

// Expired sessions: unreadable, and anyone signed in may delete them.
const OLD = 'OLD234';
await env.withSecurityRulesDisabled(async (c) => {
  const d = c.database();
  await d.ref(`sessions/${OLD}`).set({ meta: { title: 'Old', facilitator: 'fac', createdAt: 1, expiresAt: Date.now() - DAY, canView: true }, members: { alice: { name: 'A', joinedAt: 1 } } });
  await d.ref(`expiries/${OLD}`).set(Date.now() - DAY);
});
await check('expired meta is unreadable', assertFails(alice.ref(`sessions/${OLD}/meta`).get()));
await check('expired sessions cannot be joined', assertFails(bob.ref(`sessions/${OLD}/members/bob`).set({ name: 'B', joinedAt: TS })));
await check('expired members are unreadable even by the host', assertFails(fac.ref(`sessions/${OLD}/members`).get()));
await check('a live session cannot be deleted by others', assertFails(eve.ref().update({ [`sessions/${S}`]: null, [`expiries/${S}`]: null })));
await check('anyone signed in can delete an expired session', assertSucceeds(eve.ref().update({ [`sessions/${OLD}`]: null, [`expiries/${OLD}`]: null })));
await check('host ends the session', assertSucceeds(fac.ref().update({ [`sessions/${S}`]: null, [`expiries/${S}`]: null })));

await env.cleanup();
console.log(failures ? `${failures} rule checks failed` : 'All rule checks passed');
process.exit(failures ? 1 : 0);
