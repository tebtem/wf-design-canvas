// Shared facilitator canvases end to end, against the Firebase emulators.
//   npm run emulators                                  (terminal 1)
//   npx vite build --mode emulator --outDir dist-emu
//   npx vite preview --outDir dist-emu --port 4174     (terminal 2)
//   npm run e2e:share
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
const until = async (fn, label, ms = 10000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if (await fn()) return true;
    } catch {
      // keep waiting
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  fail(`timed out: ${label}`);
  return false;
};
const axe = async (page, label) => {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of res.violations) console.log('AXE', label, v.id, v.impact, v.nodes.length, v.nodes[0]?.target);
  if (res.violations.length) fail(`${res.violations.length} axe violations on ${label}`);
};

const AUTH_EMU = 'http://127.0.0.1:9099/emulator/v1/projects/demo-wf-canvas/oobCodes';
async function accountSignIn(page, email) {
  await page.goto(APP_URL);
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await page.getByText('Check your inbox').waitFor();
  const { oobCodes } = await (await fetch(AUTH_EMU)).json();
  const latest = oobCodes.filter((c) => c.email === email && c.requestType === 'EMAIL_SIGNIN').pop();
  await page.goto(`${APP_URL}?account&apiKey=demo-key&oobCode=${latest.oobCode}&mode=signIn&lang=en`);
  await page.getByText(`Signed in as ${email}`).waitFor();
}
const newPage = async () => {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  if (process.env.DEBUG) p.on('console', (m) => console.log('  [page]', m.text()));
  return p;
};
const title = (page) => page.getByLabel('Working Title');
const bar = (page) => page.getByRole('region', { name: 'Shared canvas' });
const closeDialog = (page) => page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

const A = 'taylor@taylorelyse.com';
const B = 'shannon@theteamtogether.com';

// A facilitator starts a canvas and has no three-canvas limit.
const a = await newPage();
await accountSignIn(a, A);
await a.getByText('As a facilitator you can save as many as you like').waitFor();
for (let i = 0; i < 4; i++) {
  await a.getByRole('button', { name: 'Start a new canvas' }).click();
  await a.getByRole('dialog').waitFor({ state: 'hidden' });
  await a.getByRole('button', { name: 'Account' }).click();
  await a.getByText('Signed in as').waitFor();
}
await until(async () => (await a.locator('.ws-host__list li').count()) >= 4, 'four canvases listed');
step(`facilitator has ${await a.locator('.ws-host__list li').count()} canvases`);
await closeDialog(a);
await title(a).fill('Leadership retreat');
await a.waitForTimeout(2000);

// Share it.
await a.getByRole('button', { name: 'Account' }).click();
await a.getByRole('button', { name: 'Share Leadership retreat' }).click();
await a.getByRole('heading', { name: /Share “Leadership retreat”/ }).waitFor();
if (!(await a.evaluate(() => document.activeElement?.textContent?.includes('Share')))) fail('focus should move to the share heading');
await a.getByLabel("Facilitator's email").fill('someone@example.com');
await a.getByRole('button', { name: 'Share', exact: true }).click();
await until(async () => (await a.getByRole('alert').textContent())?.includes('approved facilitators'), 'off-list email refused');
await axe(a, 'share view with error');
await a.getByLabel("Facilitator's email").fill(B);
await a.getByRole('button', { name: 'Share', exact: true }).click();
await a.getByText(`Shared with ${B}.`).waitFor();
await a.getByRole('button', { name: `Stop sharing with ${B}` }).waitFor();
await a.getByRole('button', { name: 'Back to my canvases' }).click();
await a.getByText(`Shared with ${B}`, { exact: true }).waitFor();
await closeDialog(a);
// Alone on a shared canvas: editing starts automatically.
if (!(await until(async () => (await bar(a).textContent())?.includes('You are editing'), 'owner auto-edits'))) {
  console.log('  bar:', await bar(a).textContent().catch(() => '(none)'));
}
step('owner shared the canvas and is editing');

// The other co-founder opens it: view only, updates live.
const b = await newPage();
await accountSignIn(b, B);
await b.getByText('Shared by taylor@taylorelyse.com').waitFor();
if (process.env.DEBUG) console.log('  list:', await b.locator('.ws-host__list').innerText());
await b.getByRole('button', { name: /^(Open|Keep working) Leadership retreat$/ }).click();
await b.getByRole('dialog').waitFor({ state: 'hidden' });
await until(async () => (await bar(b).textContent())?.includes('taylor is editing'), 'viewer sees who is editing');
await until(async () => (await title(b).inputValue()) === 'Leadership retreat', 'viewer sees the canvas');
if (!(await title(b).getAttribute('readonly') !== null)) fail('viewer title should be read only');
await until(async () => (await bar(a).textContent())?.includes('Also here: shannon'), 'editor sees who else is here');
await axe(b, 'viewer');
await axe(a, 'editor');
await b.screenshot({ path: `${out}share-viewer.png` });
await a.screenshot({ path: `${out}share-editor.png` });

const t0 = Date.now();
await title(a).fill('Leadership retreat 2027');
await until(async () => (await title(b).inputValue()) === 'Leadership retreat 2027', 'live update reaches the viewer');
step(`live update arrived in ${Date.now() - t0} ms`);

// The viewer cannot take over while the editor is active.
const editBtn = bar(b).getByRole('button', { name: 'Edit' });
if ((await editBtn.getAttribute('aria-disabled')) !== 'true') fail('Edit should be unavailable while someone is editing');

// Editor finishes; the viewer edits; the first co-founder now follows along.
await bar(a).getByRole('button', { name: 'Done editing' }).click();
await until(async () => (await editBtn.getAttribute('aria-disabled')) !== 'true', 'Edit becomes available');
await editBtn.click();
await until(async () => (await bar(b).textContent())?.includes('You are editing'), 'second co-founder edits');
await until(async () => (await bar(a).textContent())?.includes('shannon is editing'), 'first co-founder sees the switch');
await until(async () => (await title(b).getAttribute('readonly')) === null, 'editor can type');
await title(b).fill('Leadership retreat: final');
await until(async () => (await title(a).inputValue()) === 'Leadership retreat: final', 'live update in the other direction');
const announced = await a.locator('.share-bar [role="status"]').textContent();
if (!announced?.includes('shannon started editing')) fail(`screen reader announcement missing, got "${announced}"`);
step('editing passed between co-founders');

// Reload: the newest version loads, and the lock stays with whoever holds it.
await a.reload();
await until(async () => (await title(a).inputValue()) === 'Leadership retreat: final', 'reload shows the newest version');

// An editor who steps away for 30 seconds can be taken over.
if (!(await until(async () => (await bar(a).getByRole('button', { name: 'Take over editing' }).count()) > 0, 'idle editor can be taken over', 50000))) {
  console.log('  bar A:', await bar(a).textContent());
  const r = await fetch('http://127.0.0.1:9000/team.json?ns=demo-wf-canvas', { headers: { Authorization: 'Bearer owner' } });
  for (const [id, c] of Object.entries(await r.json())) if (c.lock) console.log('  lock', id, JSON.stringify(c.lock), 'now', Date.now());
}
await bar(a).getByRole('button', { name: 'Take over editing' }).click();
await until(async () => (await bar(a).textContent())?.includes('You are editing'), 'took over');
await until(async () => (await b.locator('.share-bar [role="status"]').textContent())?.includes('taylor took over editing'), 'previous editor is told');
await until(async () => (await title(b).getAttribute('readonly')) !== null, 'previous editor is view only');
step('idle takeover works');

// Owner stops sharing: the other person keeps a local copy and is told.
await a.getByRole('button', { name: 'Account' }).click();
await a.getByRole('button', { name: 'Share Leadership retreat: final' }).click();
await a.getByRole('button', { name: `Stop sharing with ${B}` }).click();
await a.getByText(`Stopped sharing with ${B}.`).waitFor();
await until(async () => (await b.getByRole('alert').textContent())?.includes('no longer shared with you'), 'removed person is told');
step('unsharing works');

// Phone width: no sideways scrolling in the bar, the list or the share view.
await a.setViewportSize({ width: 375, height: 800 });
const noOverflow = async (label) => {
  const wide = await a.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (wide) fail(`horizontal scroll at phone width: ${label}`);
};
await a.getByRole('button', { name: 'Back to my canvases' }).click();
await noOverflow('canvas list');
await a.screenshot({ path: `${out}share-list-phone.png` });
await a.getByRole('button', { name: /^Share Leadership retreat/ }).click();
await noOverflow('share view');
await a.screenshot({ path: `${out}share-view-phone.png` });
await axe(a, 'share view at phone width');

await browser.close();
console.log(process.exitCode ? 'Share e2e failed' : 'Share e2e passed');
