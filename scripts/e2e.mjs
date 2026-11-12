// End-to-end smoke check: run `npm run build && npm run preview` first.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const APP_URL = process.env.URL ?? 'http://localhost:4173/';
const out = new URL('./out/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const fail = (m) => {
  console.error('FAIL:', m);
  process.exitCode = 1;
};

const axeCheck = async (p, label) => {
  const res = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  for (const v of res.violations) console.log('AXE', label, v.id, v.impact, v.nodes.length, v.nodes[0]?.target);
  if (res.violations.length) fail(`${res.violations.length} axe violations on ${label}`);
};

await page.goto(APP_URL);

// Details, stickies-only cells, and the new section order.
// A new canvas starts guided: first group only, then Next adds sections below.
const visibleTitles = () => page.locator('#canvas .band__title:visible').allTextContents();
const first = ['Session Brief', 'Participants at the Center', 'Participant Before', 'Participant After'];
if ((await visibleTitles()).join('|') !== first.join('|')) fail(`guided start: ${await visibleTitles()}`);
await page.getByText('Step 1 of 4').waitFor();
await axeCheck(page, 'guided start');
await page.getByRole('button', { name: 'Next: Facilitator at the Center' }).click();
await page.waitForTimeout(200);
if ((await page.evaluate(() => document.activeElement?.textContent)) !== 'Facilitator at the Center') fail('focus after Next');
if (!(await visibleTitles()).includes('Session Brief')) fail('Next should add, not replace');
await page.getByRole('button', { name: 'Next: Time Blocks' }).click();
await page.getByRole('button', { name: 'Show full canvas' }).click();
if (await page.getByRole('button', { name: /^Next:/ }).count()) fail('Next still shown after Show full canvas');
if (await page.getByRole('button', { name: 'Show full canvas' }).count()) fail('Show full canvas still shown');

await page.getByLabel('Working Title').fill('Q3 planning');
await page.getByLabel('Client Name').fill('Acme');
await page.getByLabel('Number of Participants').fill('24');
if (await page.locator('.note-cell__text').count()) fail('free-text boxes should be gone');
const order = await visibleTitles();
const expected = ['Session Brief', 'Participants at the Center', 'Participant Before', 'Participant After', 'Facilitator at the Center', 'Time Blocks', 'Flow, Function, and Form', 'Activity Ideation'];
await page.getByLabel('Column 1 title').fill('Opening');
if (order.join('|') !== expected.join('|')) fail(`section order: ${order.join(', ')}`);
for (const name of ['Timing + Logistics', 'Space + Materials']) {
  if (!(await page.getByRole('group', { name, exact: true }).count())) fail(`missing cell ${name}`);
}
await page.getByRole('button', { name: 'Add sticky note in Purpose' }).click();
await page.keyboard.type('Align on Q3 goals');
await page.getByRole('button', { name: 'Add sticky note in Activity ideas' }).click();
await page.keyboard.type('Gallery walk');

// Sticky notes: move with the dialog, then drag between sections.
await page.getByRole('button', { name: 'Add sticky note in Activity ideas' }).click();
await page.keyboard.type('Fishbowl');
await page.getByRole('button', { name: /^Move Sticky note 2 in Activity ideas/ }).click();
await page.getByLabel('Section', { exact: true }).selectOption('brief.1');
await page.getByRole('button', { name: 'Move', exact: true }).click();
await page.waitForTimeout(200);
if ((await page.getByRole('textbox', { name: 'Sticky note 1 in Outcomes' }).inputValue()) !== 'Fishbowl') fail('move dialog did not move sticky');
const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
if (!focused?.startsWith('Move Sticky note 1 in Outcomes')) fail(`focus after move dialog: ${focused}`);
await page.getByRole('button', { name: 'Drag Sticky note 1 in Outcomes' }).hover();
await page.mouse.down();
const target = await page.getByRole('group', { name: 'Space + Materials' }).boundingBox();
await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
await page.mouse.move(target.x + target.width / 2 + 4, target.y + target.height / 2, { steps: 3 });
await page.mouse.up();
await page.waitForTimeout(300);
if ((await page.getByRole('textbox', { name: 'Sticky note 1 in Space + Materials' }).inputValue()) !== 'Fishbowl') fail('drag did not move sticky');
if (await page.getByRole('textbox', { name: 'Sticky note 1 in Outcomes' }).count()) fail('sticky still in Outcomes after drag');

// Mouse drag: 30 min bank block into Draft 1.
const draft1 = page.getByRole('group', { name: 'Session Draft 1' });
await page.getByRole('button', { name: /^30 min block\. Drag/ }).hover();
await page.mouse.down();
const box = await draft1.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 12 });
await page.mouse.move(box.x + box.width / 2, box.y + 210, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(300);

// Keyboard drag: 15 min bank block, Space, arrow left until over Draft 1, Space.
await page.getByRole('button', { name: /^15 min block\. Drag/ }).focus();
await page.keyboard.press('Space');
await page.waitForTimeout(200);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(200);
await page.keyboard.press('Space');
await page.waitForTimeout(300);
const total1 = await draft1.locator('.draft__total').textContent();
console.log('Draft 1:', total1);
if (total1 !== 'Total 45 min') fail('expected Draft 1 to total 45 min');

// Starter bank of 15, 30 and 60. Lengths change by typing (5-minute steps) or dragging the bottom edge.
if (await page.getByRole('group', { name: 'Session Draft 2' }).count()) fail('draft 2 should start hidden');
if ((await page.locator('.bank-item').count()) !== 3) fail('bank should have 3 starter blocks');
const len15 = page.getByLabel(/^Length in minutes of 15 minute block/);
await len15.fill('20');
await len15.press('Enter');
const total = async () => draft1.locator('.draft__total').textContent();
if ((await total()) !== 'Total 50 min') fail(`typed length: ${await total()}`);
if (!(await page.locator('.tblock--m20').count())) fail('color should follow the new length');
const len20 = page.getByLabel(/^Length in minutes of 20 minute block/);
await len20.press('ArrowUp');
if ((await total()) !== 'Total 55 min') fail(`arrow key length: ${await total()}`);
const len25 = page.getByLabel(/^Length in minutes of 25 minute block/);
await len25.fill('7');
await len25.press('Tab');
if ((await total()) !== 'Total 35 min') fail(`snap to 5-minute steps: ${await total()}`);
const bar = page.locator('.tblock--m30 .tblock__resize');
const bb = await bar.boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2 + 12, { steps: 4 });
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2 + 23, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(200);
if ((await total()) !== 'Total 50 min') fail(`drag to resize: ${await total()}`);
if (!(await page.getByLabel(/^Length in minutes of 45 minute block/).count())) fail('resized block should be 45 minutes');

await page.getByRole('button', { name: 'Add another draft' }).click();
await page.waitForTimeout(150);
const focusedDraft = await page.evaluate(() => document.activeElement?.id);
if (focusedDraft !== 'draft-d2-heading') fail(`focus after adding draft: ${focusedDraft}`);

// A third draft; moving between three drafts uses a dialog. Then remove it again.
await page.getByRole('button', { name: 'Add another draft' }).click();
if (await page.getByRole('button', { name: 'Add another draft' }).count()) fail('more than three drafts allowed');
await page.getByRole('button', { name: 'Add 15 min block to Session Draft 3' }).click();
await page.getByRole('button', { name: /^Move 5 minute block to another draft/ }).click();
await page.getByLabel('Move to the end of').selectOption('d3');
await page.getByRole('dialog', { name: 'Move time block' }).getByRole('button', { name: 'Move', exact: true }).click();
await page.waitForTimeout(200);
const d3Total = await page.getByRole('group', { name: 'Session Draft 3' }).locator('.draft__total').textContent();
if (d3Total !== 'Total 20 min') fail(`draft 3 total after move: ${d3Total}`);
const afterMove = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
if (!afterMove?.startsWith('Move 5 minute block')) fail(`focus after block move dialog: ${afterMove}`);
await axeCheck(page, "three drafts");
await page.screenshot({ path: out + 'three-drafts.png', fullPage: true });
page.once('dialog', (d) => d.accept());
await page.getByRole('button', { name: 'Remove Session Draft 3' }).click();
await page.waitForTimeout(200);
if (await page.getByRole('group', { name: 'Session Draft 3' }).count()) fail('draft 3 not removed');

// Button alternative.
await page.getByRole('button', { name: 'Add 60 min block to Session Draft 2' }).click();
await page.getByRole('textbox', { name: /^Activity for 60 minute block/ }).fill('Deep work');
const notes = page.getByRole('textbox', { name: /^Notes for 60 minute block/ });
await notes.click();
await page.keyboard.type('Pairs discuss');
await page.keyboard.press('Enter');
await page.keyboard.type('Share out');

await page.waitForTimeout(600);
await page.reload();
if ((await page.getByRole('textbox', { name: 'Sticky note 1 in Purpose' }).inputValue()) !== 'Align on Q3 goals') fail('sticky in Purpose did not persist');
if ((await page.getByLabel('Client Name').inputValue()) !== 'Acme') fail('details did not persist');
if ((await page.getByLabel('Column 1 title').inputValue()) !== 'Opening') fail('column title did not persist');
if (await page.getByRole('button', { name: /^Next:/ }).count()) fail('guide step did not persist');
if ((await page.getByRole('textbox', { name: /Sticky note 1 in Activity ideas/ }).inputValue()) !== 'Gallery walk') fail('sticky did not persist');
const savedNotes = await page.getByRole('textbox', { name: /^Notes for 60 minute block/ }).inputValue();
if (savedNotes !== '• Pairs discuss\n• Share out') fail(`block notes wrong: ${JSON.stringify(savedNotes)}`);
const blocks = await page.locator('.tblock').count();
console.log('Blocks after reload:', blocks);
if (blocks < 2) fail('expected blocks to persist');

if ((await page.getByRole('link', { name: /^Learn about facilitation design/ }).getAttribute('href')) !== 'https://www.womenfacilitating.com/facilitation-design') fail('Learn link href wrong');
for (const name of [/^Women Facilitating website/, /^Women Facilitating \(opens/]) {
  const href = await page.getByRole('link', { name }).getAttribute('href');
  if (href !== 'https://womenfacilitating.com') fail(`link ${name} has href ${href}`);
}
const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
for (const v of axe.violations) console.log('AXE', v.id, v.impact, v.nodes.length, v.nodes[0]?.target);
if (axe.violations.length) fail(`${axe.violations.length} axe violations`);

await page.screenshot({ path: out + 'desktop.png', fullPage: true });
await page.emulateMedia({ media: 'print' });
await page.screenshot({ path: out + 'print.png', fullPage: true });
await page.emulateMedia({ media: 'screen' });
await page.pdf({ path: out + 'canvas.pdf', preferCSSPageSize: true, printBackground: true });

await page.setViewportSize({ width: 375, height: 800 });
const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
if (scrollW > 375) fail(`horizontal scroll at 375px (${scrollW})`);
await page.screenshot({ path: out + 'mobile.png', fullPage: true });
const axeMobile = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
for (const v of axeMobile.violations) console.log('AXE mobile', v.id, v.impact, v.nodes.length, v.nodes[0]?.target);
if (axeMobile.violations.length) fail(`${axeMobile.violations.length} axe violations at 375px`);

// Clear canvas starts the guide over, and print still shows every section.
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole('button', { name: 'Clear canvas' }).click();
await page.getByRole('button', { name: 'Clear everything' }).click();
await page.getByRole('button', { name: 'Next: Facilitator at the Center' }).waitFor();
await page.emulateMedia({ media: 'print' });
const printed = await page.locator('#canvas .band__title:visible').allTextContents();
if (printed.length !== 8) fail(`print should show the full canvas, got ${printed.length} sections`);
await page.emulateMedia({ media: 'screen' });

await browser.close();
console.log(process.exitCode ? 'Done with failures' : 'All checks passed');
