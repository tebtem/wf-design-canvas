// Workshop mode end to end, against the Firebase emulators.
//   npm run emulators                                  (terminal 1)
//   npx vite build --mode emulator --outDir dist-emu
//   npx vite preview --outDir dist-emu --port 4174     (terminal 2)
//   npm run e2e:workshop
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const APP_URL = process.env.URL ?? 'http://localhost:4174/';
const out = new URL('./out/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const fail = (m) => {
  console.error('FAIL:', m);
  process.exitCode = 1;
};
const step = (m) => console.log('-', m);
const newPage = async () => (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const axe = async (page, label) => {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of res.violations) console.log('AXE', label, v.id, v.impact, v.nodes.length, v.nodes[0]?.target);
  if (res.violations.length) fail(`${res.violations.length} axe violations on ${label}`);
};
const until = async (fn, label, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch {
      // keep waiting
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  fail(`timed out: ${label}`);
};

// Host starts a workshop.
// Facilitator sign-in uses an emailed link; the auth emulator exposes the codes it would send.
const AUTH_EMU = 'http://127.0.0.1:9099/emulator/v1/projects/demo-wf-canvas/oobCodes';
async function hostSignIn(page, email) {
  await page.goto(`${APP_URL}?host`);
  await page.getByLabel('Facilitator email').fill(email);
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await page.getByText('Check your inbox').waitFor();
  const { oobCodes } = await (await fetch(AUTH_EMU)).json();
  const latest = oobCodes.filter((c) => c.email === email && c.requestType === 'EMAIL_SIGNIN').pop();
  await page.goto(`${APP_URL}?apiKey=demo-key&oobCode=${latest.oobCode}&mode=signIn&lang=en`);
  await page.getByText(`Signed in as ${email}`).waitFor();
}

// Participants never see hosting.
const visitor = await newPage();
await visitor.goto(APP_URL);
await visitor.getByRole('button', { name: 'Workshop' }).click();
if (await visitor.getByRole('radio', { name: 'Host a workshop' }).count()) fail('participants should not see Host a workshop');
await axe(visitor, 'workshop dialog');
// Unapproved emails cannot get a sign-in link.
await visitor.goto(`${APP_URL}?host`);
await visitor.getByLabel('Facilitator email').fill('someone@example.com');
await visitor.getByRole('button', { name: 'Email me a sign-in link' }).click();
await until(async () => (await visitor.getByRole('alert').textContent())?.includes('not set up to host'), 'unapproved email error');
await axe(visitor, 'facilitator sign-in');
await visitor.close();

const host = await newPage();
await hostSignIn(host, 'host@womenfacilitating.com');
if (new URL(host.url()).search) fail('sign-in link parameters should be removed from the address');
await axe(host, 'signed-in host panel');
await host.getByLabel('Workshop name').fill('Team offsite');
await host.getByRole('button', { name: 'Start workshop' }).click();
await host.getByRole('heading', { level: 1, name: 'Team offsite' }).waitFor();
const code = (await host.locator('.ws-code [aria-hidden]').textContent()).replace('-', '');
step(`host started workshop ${code}`);
await axe(host, 'host dashboard (empty)');
if (!(await host.getByText('Hidden').count())) fail('guided workshop should start with hidden sections');

// Alice joins with the link.
const alice = await newPage();
await alice.goto(`${APP_URL}?join=${code}`);
if ((await alice.getByLabel('Workshop code').inputValue()) !== code) fail('join link did not prefill the code');
await alice.getByRole('button', { name: 'Join' }).click();
await until(async () => (await alice.getByRole('alert').textContent())?.includes('Enter your name'), 'name required error');
await alice.getByLabel('Your name').fill('Alice');
await alice.getByRole('button', { name: 'Join' }).click();
await alice.getByRole('heading', { name: 'Team offsite' }).waitFor();
await alice.getByRole('textbox', { name: 'Working Title', exact: true }).fill('Alice purpose');
await alice.getByRole('button', { name: 'Add sticky note in Purpose' }).click();
await alice.keyboard.type('World cafe');
step('alice joined and typed');

// Bob joins by typing the code, with a dash and lower case.
const bob = await newPage();
await bob.goto(APP_URL);
await bob.getByRole('textbox', { name: 'Working Title', exact: true }).fill('Personal canvas text');
await bob.waitForTimeout(500);
await bob.getByRole('button', { name: 'Workshop' }).click();
await bob.getByLabel('Workshop code').fill('zzz-zzz');
await bob.getByLabel('Your name').fill('Bob');
await bob.getByRole('button', { name: 'Join' }).click();
await until(async () => (await bob.getByRole('alert').textContent())?.includes('No active workshop'), 'unknown code error');
await bob.getByLabel('Workshop code').fill(`${code.slice(0, 3).toLowerCase()}-${code.slice(3).toLowerCase()}`);
await bob.getByRole('button', { name: 'Join' }).click();
await bob.getByRole('heading', { name: 'Team offsite' }).waitFor();
if ((await bob.getByRole('textbox', { name: 'Working Title', exact: true }).inputValue()) !== '') fail('bob should start blank');
await bob.getByRole('textbox', { name: 'Client Name', exact: true }).fill('Bob outcome');
step('bob joined');

// Guided reveal: participants start with the Session Brief group only.
const headings = (page) => page.locator('#canvas .band__title:visible').allTextContents();
const startSections = ['Session Brief', 'Participants at the Center', 'Participant Before', 'Participant After'];
if ((await headings(alice)).join('|') !== startSections.join('|')) fail(`alice start sections: ${await headings(alice)}`);
await axe(host, 'host dashboard with reveal controls');
await host.getByRole('button', { name: 'Reveal next: Facilitator at the Center' }).click();
await until(async () => (await headings(alice)).includes('Facilitator at the Center'), 'alice sees facilitator section');
await until(async () => (await alice.getByText('Newly revealed').count()) === 1, 'alice reveal notice');
await alice.getByRole('button', { name: 'Go to it' }).click();
await until(async () => alice.evaluate(() => document.activeElement?.textContent === 'Facilitator at the Center'), 'focus moves to new section');
await host.getByRole('button', { name: 'Reveal next: Time Blocks' }).click();
await until(async () => (await headings(bob)).includes('Time Blocks'), 'bob sees time blocks');
if ((await headings(bob)).includes('Flow, Function, and Form')) fail('flow revealed too early');
await host.getByRole('button', { name: 'Hide Time Blocks' }).click();
await until(async () => !(await headings(bob)).includes('Time Blocks'), 'hide works');
await host.getByRole('button', { name: 'Reveal all' }).click();
await until(async () => (await headings(alice)).length === 9, 'alice sees full canvas');
if (await host.getByRole('button', { name: /^Reveal next/ }).count()) fail('reveal next shown after all revealed');
await alice.screenshot({ path: out + 'ws-revealed.png' });
step('guided reveal works');

// Host sees both, live.
await until(async () => (await host.locator('.ws-card').count()) === 2, 'host sees 2 cards');
await until(async () => (await host.locator('.ws-card[data-uid]').first().textContent()).includes('1 of'), 'alice card shows progress');
await axe(host, 'host dashboard (2 people)');
await host.screenshot({ path: out + 'ws-host.png', fullPage: true });
await host.getByRole('button', { name: 'Open canvas of Alice' }).click();
const hostPurpose = host.getByRole('textbox', { name: 'Working Title', exact: true });
await until(async () => (await hostPurpose.inputValue()) === 'Alice purpose', 'host sees alice purpose');
if ((await hostPurpose.getAttribute('readonly')) === null) fail('host view should be read-only');
if (await host.getByRole('button', { name: /Add sticky note/ }).count()) fail('read-only canvas shows add buttons');
await alice.getByRole('textbox', { name: 'Working Title', exact: true }).fill('Alice purpose, edited');
await until(async () => (await hostPurpose.inputValue()) === 'Alice purpose, edited', 'host sees live edit');
step('host sees live edits');
await host.getByLabel('About').selectOption('brief.0');
await host.getByLabel('Comment', { exact: true }).fill('Try naming the decision you need.');
await host.getByRole('button', { name: 'Send comment' }).click();
await host.locator('.ws-comment').first().waitFor();
await axe(host, 'host canvas view');
await host.screenshot({ path: out + 'ws-host-detail.png', fullPage: true });

// Alice gets the comment.
await until(async () => (await alice.getByRole('button', { name: /Facilitator comments \(1\)/ }).count()) === 1, 'alice comment count');
await alice.getByRole('button', { name: /Facilitator comments/ }).click();
if (!(await alice.locator('#ws-comments').textContent()).includes('Try naming the decision')) fail('alice cannot read comment');
await axe(alice, 'participant view');
await alice.screenshot({ path: out + 'ws-participant.png' });

// Sharing off: Bob cannot browse. Sharing on: he can.
if (await bob.getByRole('button', { name: /See everyone/ }).count()) fail('bob can browse while sharing is off');
await host.getByRole('button', { name: 'Back to all canvases' }).click();
await host.getByLabel("Participants can see each other's canvases").check();
await until(async () => (await bob.getByRole('button', { name: /See everyone/ }).count()) === 1, 'bob gets browse button');
await bob.getByRole('button', { name: /See everyone/ }).click();
await bob.getByRole('heading', { level: 1, name: "Everyone's canvases" }).waitFor();
if (await bob.locator('.ws-stats').count()) fail("participants' gallery should show names only");
await axe(bob, 'participant gallery');
await bob.getByRole('button', { name: 'Open canvas of Alice' }).click();
await until(async () => (await bob.getByRole('textbox', { name: 'Working Title', exact: true }).inputValue()) === 'Alice purpose, edited', 'bob sees alice');
if (await bob.getByText('Try naming the decision').count()) fail("bob can see alice's comments");
step('sharing toggles work');

// Turning sharing off sends Bob back to his own canvas.
await host.getByLabel("Participants can see each other's canvases").uncheck();
await until(async () => (await bob.getByRole('textbox', { name: 'Client Name', exact: true }).inputValue()) === 'Bob outcome', 'bob back on own canvas');

// Spotlight Bob for everyone.
await host.getByRole('button', { name: 'Open canvas of Bob' }).click();
await host.getByRole('button', { name: 'Spotlight for everyone' }).click();
await until(async () => (await alice.getByText("spotlighting Bob's canvas").count()) === 1, 'alice sees spotlight');
await alice.getByRole('button', { name: 'View it' }).click();
await until(async () => (await alice.getByRole('textbox', { name: 'Client Name', exact: true }).inputValue()) === 'Bob outcome', 'alice sees bob via spotlight');
await alice.screenshot({ path: out + 'ws-spotlight.png' });
await host.getByRole('button', { name: 'Spotlight for everyone' }).click();
await until(async () => (await alice.getByRole('textbox', { name: 'Working Title', exact: true }).inputValue()) === 'Alice purpose, edited', 'alice back after spotlight ends');
step('spotlight works');

// Reloads reconnect.
await host.reload();
await host.getByRole('heading', { level: 1, name: 'Team offsite' }).waitFor();

// The facilitator reopens the host view on a second device by signing in there.
const host2 = await newPage();
await hostSignIn(host2, 'host@womenfacilitating.com');
await host2.getByRole('button', { name: 'Open Team offsite' }).click();
await host2.getByRole('heading', { level: 1, name: 'Team offsite' }).waitFor();
await until(async () => (await host2.locator('.ws-card').count()) === 2, 'second device sees participants');
await host2.close();
step('host view works on a second device');

// A co-founder co-facilitates by entering the code in their facilitator panel.
const cohost = await newPage();
await hostSignIn(cohost, 'taylor@taylorelyse.com');
await cohost.getByLabel('Workshop code').fill(code.toLowerCase());
await cohost.getByRole('button', { name: 'Open host view' }).click();
await cohost.getByRole('heading', { level: 1, name: 'Team offsite' }).waitFor();
await until(async () => (await cohost.locator('.ws-card').count()) === 2, 'co-facilitator sees participants');
await cohost.reload();
await cohost.getByRole('heading', { level: 1, name: 'Team offsite' }).waitFor();
await cohost.getByRole('button', { name: 'Exit host view' }).click();
await cohost.getByRole('dialog').getByRole('button', { name: 'Exit host view' }).click();
await cohost.goto(`${APP_URL}?host`);
await cohost.getByRole('button', { name: 'Open Team offsite' }).waitFor();
await cohost.close();
step('co-facilitating works');
await alice.reload();
await until(async () => (await alice.getByRole('textbox', { name: 'Working Title', exact: true }).inputValue()) === 'Alice purpose, edited', 'alice reload');

// Day 2 on a different device: Alice returns with her rejoin code.
const rejoinCode = (await alice.locator('.ws-bar__meta strong').textContent()).trim();
if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(rejoinCode)) fail(`rejoin code shown to alice: ${rejoinCode}`);
await host.getByRole('button', { name: 'Back to all canvases' }).click().catch(() => {});
await until(async () => (await host.locator('.ws-card').first().textContent()).includes(rejoinCode), 'host sees rejoin code');
const alice2 = await newPage();
await alice2.goto(APP_URL);
await alice2.getByRole('button', { name: 'Workshop' }).click();
await alice2.getByRole('radio', { name: 'Return on a new device' }).check();
await alice2.getByLabel('Workshop code').fill(code);
await alice2.getByLabel('Your rejoin code').fill('ZZZZ-ZZZZ');
await alice2.getByRole('button', { name: 'Return to my canvas' }).click();
await until(async () => (await alice2.getByRole('alert').textContent())?.includes('does not match'), 'wrong rejoin code error');
await axe(alice2, 'return dialog');
await alice2.getByLabel('Your rejoin code').fill(rejoinCode.toLowerCase());
await alice2.getByRole('button', { name: 'Return to my canvas' }).click();
await alice2.getByRole('heading', { name: 'Team offsite' }).waitFor();
await until(async () => (await alice2.getByRole('textbox', { name: 'Working Title', exact: true }).inputValue()) === 'Alice purpose, edited', 'canvas restored on new device');
if (!(await alice2.getByText('You are Alice').count())) fail('name not restored');
await until(async () => (await alice2.getByRole('button', { name: /Facilitator comments \(1\)/ }).count()) === 1, 'comments restored');
await alice2.getByRole('textbox', { name: 'Client Name', exact: true }).fill('Day 2 client');
await host.getByRole('button', { name: 'Open canvas of Alice' }).click();
await until(async () => (await host.getByRole('textbox', { name: 'Client Name', exact: true }).inputValue()) === 'Day 2 client', 'host sees new-device edits on the same card');
await host.getByRole('button', { name: 'Back to all canvases' }).click();
if ((await host.locator('.ws-card').count()) !== 2) fail('returning should not create a second card');
// Day 3 back on the first laptop: it picks up the newer work instead of overwriting it.
await alice.reload();
await until(async () => (await alice.getByRole('textbox', { name: 'Client Name', exact: true }).inputValue()) === 'Day 2 client', 'old device loads newer work');
await alice.waitForTimeout(1200);
await host.getByRole('button', { name: 'Open canvas of Alice' }).click();
await until(async () => (await host.getByRole('textbox', { name: 'Client Name', exact: true }).inputValue()) === 'Day 2 client', 'newer work not overwritten');
await host.getByRole('button', { name: 'Back to all canvases' }).click();
step('rejoin on a new device works');

// Alice leaves and keeps a copy.
await alice.getByRole('button', { name: 'Leave workshop' }).click();
await alice.getByLabel(/Copy this canvas to my personal canvas/).check();
await alice.getByRole('button', { name: 'Leave', exact: true }).click();
await until(async () => (await alice.getByRole('button', { name: 'Workshop' }).count()) === 1, 'alice back to solo');
if ((await alice.getByRole('textbox', { name: 'Working Title', exact: true }).inputValue()) !== 'Alice purpose, edited') fail('copy to personal failed');

// Host ends; Bob is told, and his personal canvas is untouched.
await host.getByRole('button', { name: 'End workshop' }).click();
await host.getByRole('dialog').getByRole('button', { name: 'End workshop' }).click();
await until(async () => (await host.getByRole('button', { name: 'Workshop' }).count()) === 1, 'host back to solo');
await until(async () => (await bob.locator('.ws-notice--warn').textContent()).startsWith('This workshop has ended'), 'bob told it ended');
await bob.screenshot({ path: out + 'ws-ended.png' });
await bob.getByRole('button', { name: 'Leave workshop' }).click();
await bob.getByRole('button', { name: 'Leave', exact: true }).click();
await until(async () => (await bob.getByRole('textbox', { name: 'Working Title', exact: true }).inputValue()) === 'Personal canvas text', 'bob personal canvas intact');
step('end workshop works');

// Phone width.
const phone = await newPage();
await phone.setViewportSize({ width: 375, height: 800 });
await hostSignIn(phone, 'taylor@taylorelyse.com');
await phone.getByRole('button', { name: 'Start workshop' }).click();
await phone.getByRole('heading', { level: 1, name: 'Workshop' }).waitFor();
const w = await phone.evaluate(() => document.documentElement.scrollWidth);
if (w > 375) fail(`horizontal scroll at 375px (${w})`);
await axe(phone, 'host dashboard 375px');
await phone.screenshot({ path: out + 'ws-host-mobile.png', fullPage: true });

await browser.close();
console.log(process.exitCode ? 'Done with failures' : 'All workshop checks passed');
