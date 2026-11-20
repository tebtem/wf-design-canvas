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
const db = (uid, token) => (uid ? env.authenticatedContext(uid, token) : env.unauthenticatedContext()).database();
const verified = (email) => ({ email, email_verified: true });
const fac = db('fac', verified('host@womenfacilitating.com'));
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
const meta = (extra = {}) => ({ title: 'Test', facilitator: 'fac', createdAt: TS, expiresAt: Date.now() + 89 * DAY, canView: false, step: 0, ...extra });
const canvas = (text) => ({ state: JSON.stringify({ version: 1, text }), updatedAt: TS });

// Only approved hosts (verified email on the allowlist) can start workshops.
const tryCreate = (ctx, uid, code) =>
  ctx.ref().update({ [`sessions/${code}/meta`]: meta({ facilitator: uid }), [`expiries/${code}`]: meta().expiresAt });
await check('anonymous users cannot host', assertFails(tryCreate(db('anon1'), 'anon1', 'HHH234')));
await check('unlisted emails cannot host', assertFails(tryCreate(db('x1', verified('someone@example.com')), 'x1', 'HHH235')));
await check('look-alike domains cannot host', assertFails(tryCreate(db('x2', verified('a@womenfacilitating.com.evil.io')), 'x2', 'HHH236')));
await check('unverified emails cannot host', assertFails(tryCreate(db('x3', { email: 'a@womenfacilitating.com', email_verified: false }), 'x3', 'HHH237')));
await check('listed outside emails can host', assertSucceeds(tryCreate(db('x4', verified('annie@theteamtogether.com')), 'x4', 'HHH238')));
await check('host creates a session with its expiry index and host list entry', assertSucceeds(fac.ref().update({ [`sessions/${S}/meta`]: meta(), [`expiries/${S}`]: meta().expiresAt, [`hosts/fac/${S}`]: Date.now() })));
await check('host reads their workshop list', assertSucceeds(fac.ref('hosts/fac').get()));
await check("others cannot read a host's list", assertFails(eve.ref('hosts/fac').get()));
await check("cannot add someone else's workshop to your list", assertFails(eve.ref(`hosts/eve/${S}`).set(1)));
await check('signed-out users cannot create', assertFails(anon.ref(`sessions/ZZZ234/meta`).set({ ...meta(), facilitator: 'x' })));
await check('nobody can take an existing code', assertFails(eve.ref(`sessions/${S}/meta`).set(meta({ facilitator: 'eve' }))));
await check('codes must use the code alphabet', assertFails(fac.ref('sessions/abc10o/meta').set(meta())));
await check('expiry cannot exceed 90 days', assertFails(fac.ref('sessions/XYZ234/meta').set(meta({ expiresAt: Date.now() + 100 * DAY }))));
const eightWeeks = Date.now() + 85 * DAY;
await check('an 8-week course fits', assertSucceeds(fac.ref().update({ 'sessions/KNG234/meta': meta({ expiresAt: eightWeeks }), 'expiries/KNG234': eightWeeks })));
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
await check('reveal step must be 0 to 4', assertFails(fac.ref(`sessions/${S}/meta/step`).set(5)));
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

// Co-facilitators: any approved, signed-in facilitator gets the host view of a workshop.
const co = db('co', verified('shannon@theteamtogether.com'));
await check('co-facilitator reads members', assertSucceeds(co.ref(`sessions/${S}/members`).get()));
await check('co-facilitator reads every canvas', assertSucceeds(co.ref(`sessions/${S}/canvases`).get()));
await check('co-facilitator reads comments', assertSucceeds(co.ref(`sessions/${S}/comments`).get()));
await check('co-facilitator comments', assertSucceeds(co.ref(`sessions/${S}/comments/bob`).push({ text: 'From co', createdAt: TS })));
await check('co-facilitator reveals steps', assertSucceeds(co.ref(`sessions/${S}/meta/step`).set(2)));
await check('co-facilitator reads rejoin codes', assertSucceeds(co.ref(`sessions/${S}/rejoinKeys`).get()));
await check('co-facilitator adds the workshop to their list', assertSucceeds(co.ref(`hosts/co/${S}`).set(Date.now())));
await check('co-facilitator cannot take over as creator', assertFails(co.ref(`sessions/${S}/meta/facilitator`).set('co')));
await check('co-facilitator cannot list a workshop that does not exist', assertFails(co.ref('hosts/co/NOPE23').set(1)));
await check('unapproved emails get no host view', assertFails(db('z9', verified('someone@example.com')).ref(`sessions/${S}/members`).get()));

// Presence: people mark themselves online; only hosts read the list.
await check('alice marks herself online', assertSucceeds(alice.ref(`sessions/${S}/presence/alice`).set(true)));
await check("bob cannot mark alice online", assertFails(bob.ref(`sessions/${S}/presence/alice`).set(true)));
await check('non-members cannot mark themselves online', assertFails(eve.ref(`sessions/${S}/presence/eve`).set(true)));
await check('participants cannot read who is online', assertFails(bob.ref(`sessions/${S}/presence`).get()));
await check('host reads who is online', assertSucceeds(fac.ref(`sessions/${S}/presence`).get()));
await check('alice goes offline', assertSucceeds(alice.ref(`sessions/${S}/presence/alice`).remove()));

// Accounts: three saved canvas slots per person, private to them.
const acct = db('acct', verified('someone@example.com'));
const saved = { state: JSON.stringify({ version: 1 }), name: 'Retreat', updatedAt: TS };
await check('an account saves a canvas', assertSucceeds(acct.ref('users/acct/canvases/c1').set(saved)));
await check('an account reads its canvases', assertSucceeds(acct.ref('users/acct/canvases').get()));
await check('only three slots', assertFails(acct.ref('users/acct/canvases/c4').set(saved)));
await check("others cannot read someone's canvases", assertFails(eve.ref('users/acct/canvases').get()));
await check("others cannot write someone's canvases", assertFails(eve.ref('users/acct/canvases/c2').set(saved)));
await check('anonymous participants cannot save account canvases', assertFails(alice.ref('users/alice/canvases/c1').set(saved)));
await check('unverified emails cannot save', assertFails(db('uv', { email: 'u@example.com', email_verified: false }).ref('users/uv/canvases/c1').set(saved)));
await check('extra fields are rejected', assertFails(acct.ref('users/acct/canvases/c2').set({ ...saved, x: 1 })));
await check('an account deletes everything', assertSucceeds(acct.ref('users/acct').remove()));

// Facilitator canvases: unlimited, shared between approved facilitators, one editor at a time.
const tay = db('tay', verified('taylor@taylorelyse.com'));
const sha = db('sha', verified('shannon@theteamtogether.com'));
const ann = db('ann', verified('annie@theteamtogether.com'));
const outsider = db('out', verified('someone@example.com'));
const k = (e) => e.replace(/\./g, ',');
const T1 = 'teamCanvas01';
const teamDoc = (owner, ownerEmail) => ({ owner, ownerEmail, name: 'Retreat', state: JSON.stringify({ version: 1 }), updatedAt: TS });
await check('facilitator creates a canvas and lists it', assertSucceeds(tay.ref().update({ [`team/${T1}`]: teamDoc('tay', 'taylor@taylorelyse.com'), [`teamIndex/${k('taylor@taylorelyse.com')}/${T1}`]: true })));
await check('facilitators are not limited to three', assertSucceeds(tay.ref().update({ 'team/teamCanvas02': teamDoc('tay', 't'), 'team/teamCanvas03': teamDoc('tay', 't'), 'team/teamCanvas04': teamDoc('tay', 't'), 'team/teamCanvas05': teamDoc('tay', 't') })));
await check('non-facilitators cannot create facilitator canvases', assertFails(outsider.ref('team/outCanvas01').set(teamDoc('out', 'someone@example.com'))));
await check('cannot create a canvas owned by someone else', assertFails(sha.ref('team/teamCanvas09').set(teamDoc('tay', 'x'))));
await check('owner reads their canvas', assertSucceeds(tay.ref(`team/${T1}`).get()));
await check('unshared: other facilitators cannot read it', assertFails(sha.ref(`team/${T1}`).get()));
await check('owner shares with a facilitator', assertSucceeds(tay.ref().update({ [`team/${T1}/members/${k('shannon@theteamtogether.com')}`]: true, [`teamIndex/${k('shannon@theteamtogether.com')}/${T1}`]: true })));
await check('owner shares with a domain facilitator', assertSucceeds(tay.ref(`team/${T1}/members/${k('a.b@womenfacilitating.com')}`).set(true)));
await check('cannot share with someone off the allowlist', assertFails(tay.ref(`team/${T1}/members/${k('someone@example.com')}`).set(true)));
await check('cannot share with a look-alike domain', assertFails(tay.ref(`team/${T1}/members/${k('a@womenfacilitating.com.evil.io')}`).set(true)));
await check('members cannot share it further', assertFails(sha.ref(`team/${T1}/members/${k('annie@theteamtogether.com')}`).set(true)));
await check('shared: member reads it', assertSucceeds(sha.ref(`team/${T1}`).get()));
await check('member reads their own list', assertSucceeds(sha.ref(`teamIndex/${k('shannon@theteamtogether.com')}`).get()));
await check("cannot read someone else's list", assertFails(ann.ref(`teamIndex/${k('shannon@theteamtogether.com')}`).get()));
await check('cannot add a canvas to someone else\'s list', assertFails(ann.ref(`teamIndex/${k('shannon@theteamtogether.com')}/fakeCanvas1`).set(true)));
await check('still not readable by others', assertFails(ann.ref(`team/${T1}`).get()));
await check('member cannot change the owner', assertFails(sha.ref(`team/${T1}/owner`).set('sha')));
await check('member cannot delete the canvas', assertFails(sha.ref(`team/${T1}`).remove()));

const lock = (uid, email) => ({ uid, email, at: TS });
await check('member takes the free edit lock', assertSucceeds(sha.ref(`team/${T1}/lock`).set(lock('sha', 'shannon@theteamtogether.com'))));
await check('editor saves', assertSucceeds(sha.ref(`team/${T1}`).update({ state: JSON.stringify({ version: 1, by: 'sha' }), name: 'X', updatedAt: TS, 'lock/at': TS })));
await check('owner cannot save while someone else edits', assertFails(tay.ref(`team/${T1}`).update({ state: JSON.stringify({ version: 1, by: 'tay' }), updatedAt: TS })));
await check('owner cannot take an active lock', assertFails(tay.ref(`team/${T1}/lock`).set(lock('tay', 'taylor@taylorelyse.com'))));
await check('cannot take the lock as someone else', assertFails(sha.ref(`team/${T1}/lock`).set(lock('tay', 'x'))));
await check('editor refreshes the lock', assertSucceeds(sha.ref(`team/${T1}/lock/at`).set(TS)));
await check('editor lets go', assertSucceeds(sha.ref(`team/${T1}/lock`).remove()));
await check('owner takes the lock once free', assertSucceeds(tay.ref(`team/${T1}/lock`).set(lock('tay', 'taylor@taylorelyse.com'))));
await check('owner saves holding the lock', assertSucceeds(tay.ref(`team/${T1}`).update({ state: JSON.stringify({ version: 1, by: 'tay' }), updatedAt: TS })));
await check('member cannot release the owner\'s active lock', assertFails(sha.ref(`team/${T1}/lock`).remove()));
await env.withSecurityRulesDisabled((c) => c.database().ref(`team/${T1}/lock/at`).set(Date.now() - 60_000));
await check('a lock idle for 30 seconds can be taken over', assertSucceeds(sha.ref(`team/${T1}/lock`).set(lock('sha', 'shannon@theteamtogether.com'))));
await check('outsiders cannot take the lock', assertFails(ann.ref(`team/${T1}/lock`).set(lock('ann', 'annie@theteamtogether.com'))));

await check('member marks themselves here', assertSucceeds(sha.ref(`team/${T1}/presence/sha`).set({ email: 'shannon@theteamtogether.com', at: TS })));
await check('cannot mark someone else here', assertFails(sha.ref(`team/${T1}/presence/tay`).set({ email: 'x', at: TS })));
await check('non-members cannot mark themselves here', assertFails(ann.ref(`team/${T1}/presence/ann`).set({ email: 'x', at: TS })));
await check('extra canvas fields are rejected', assertFails(tay.ref(`team/${T1}/extra`).set(1)));

await check('member leaves the canvas', assertSucceeds(sha.ref().update({ [`team/${T1}/members/${k('shannon@theteamtogether.com')}`]: null, [`teamIndex/${k('shannon@theteamtogether.com')}/${T1}`]: null })));
await check('after leaving, it is unreadable', assertFails(sha.ref(`team/${T1}`).get()));
await check('cannot remove someone else from a canvas', assertFails(ann.ref(`team/${T1}/members/${k('a.b@womenfacilitating.com')}`).remove()));
await check('owner deletes the canvas and its list entries', assertSucceeds(tay.ref().update({ [`team/${T1}`]: null, [`teamIndex/${k('taylor@taylorelyse.com')}/${T1}`]: null })));

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
