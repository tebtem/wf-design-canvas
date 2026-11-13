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
await page.getByText('Step 1 of 5').waitFor();
await axeCheck(page, 'guided start');
await page.getByRole('button', { name: 'Next: Facilitator at the Center' }).click();
await page.waitForTimeout(200);
if ((await page.evaluate(() => document.activeElement?.textContent)) !== 'Facilitator at the Center') fail('focus after Next');
if (!(await visibleTitles()).includes('Session Brief')) fail('Next should add, not replace');
const layoutClass = () => page.locator('.canvas-body').getAttribute('class');
if (!(await layoutClass()).includes('canvas-body--stacked')) fail('guide should start stacked');
await page.getByRole('button', { name: 'Next: Time Blocks' }).click();
await page.waitForTimeout(100);
if (!(await layoutClass()).includes('canvas-body--stacked')) fail('stacked should stay the default');
await page.getByRole('radio', { name: 'Canvas' }).check();
if (!(await layoutClass()).includes('canvas-body--canvas')) fail('layout toggle should switch to the canvas layout');
await page.reload();
if (!(await layoutClass()).includes('canvas-body--canvas')) fail('layout choice should be remembered');
await axeCheck(page, 'canvas layout');
await page.getByRole('radio', { name: 'Stacked' }).check();
await page.getByRole('button', { name: 'Show full canvas' }).click();
if (await page.getByRole('button', { name: /^Next:/ }).count()) fail('Next still shown after Show full canvas');
if (await page.getByRole('button', { name: 'Show full canvas' }).count()) fail('Show full canvas still shown');

if ((await page.getByLabel('Working Title').getAttribute('placeholder')) !== 'Working Title') fail('details should read like a title to type into');
if ((await page.getByLabel('Name of function 1').getAttribute('placeholder')) !== 'Name this function') fail('function names should say Name this function');
await page.getByLabel('Working Title').fill('Q3 planning');
await page.getByLabel('Client Name').fill('Acme');
await page.getByLabel('Number of Participants').fill('24');
if (await page.locator('.note-cell__text').count()) fail('free-text boxes should be gone');
const order = await visibleTitles();
const expected = ['Session Brief', 'Participants at the Center', 'Participant Before', 'Participant After', 'Facilitator at the Center', 'Time Blocks', 'Flow, Function, and Form', 'Activity Ideation', 'Session Outline'];
await page.getByLabel('Name of function 1').fill('Opening');
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
if ((await page.locator('.bank-item').count()) !== 4) fail('bank should have 3 starter blocks plus a break');
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

// Session Outline: rows follow the chosen draft's blocks and show the working title.
const outline = page.locator('#section-outline');
if (!(await outline.getByText('Q3 planning').count())) fail('outline should show the working title');
await page.getByRole('button', { name: 'Add 15 min block to Session Draft 1' }).click();
if ((await outline.locator('tbody tr').count()) !== 2) fail('outline should have a row per block');
// Typeable times: first start sets the session start; end times and lengths resize blocks.
const startField = page.getByLabel('Session start time');
await startField.fill('9');
await startField.press('Enter');
if ((await startField.inputValue()) !== '09:00') fail(`session start: ${await startField.inputValue()}`);
if ((await outline.locator('.outline__start').textContent()) !== '09:45') fail('row 2 should start when row 1 ends');
const end2 = page.getByLabel(/^End time, row 2/);
await end2.fill('10:10');
await end2.press('Enter');
if ((await page.getByLabel(/^Length in minutes, row 2/).inputValue()) !== '25') fail('typing an end time should set the length');
const len1 = page.getByLabel(/^Length in minutes, row 1/);
await len1.fill('42');
await len1.press('Tab');
if ((await len1.inputValue()) !== '40') fail(`length should snap to 5 minutes: ${await len1.inputValue()}`);
if ((await outline.locator('.outline__start').textContent()) !== '09:40') fail('rows below should shift');
await startField.fill('abc');
await startField.press('Enter');
if ((await startField.inputValue()) !== '09:00') fail('invalid time should be ignored');
if (!(await page.locator('.tblock__time').first().textContent()).includes('09:00')) fail('time blocks should use the session start');
// Activities are rich text: a title, bullets, bold and italic.
const acts = page.getByLabel(/^Activities, 09:00 to 09:40/);
await acts.click();
await page.keyboard.type('# Kickoff and goals');
await page.keyboard.press('Enter');
await page.keyboard.type('- Pairs share ');
await page.keyboard.press('ControlOrMeta+b');
await page.keyboard.type('hopes');
await page.keyboard.press('ControlOrMeta+b');
if ((await acts.locator('h3').textContent()) !== 'Kickoff and goals') fail('"# " should make a title');
if ((await acts.locator('li strong').textContent()) !== 'hopes') fail('bullets and bold should work');
await page.getByRole('toolbar', { name: /^Formatting for Activities, 09:00/ }).getByRole('button', { name: 'Italic' }).click();
await page.keyboard.type(' now');
if ((await acts.locator('li em').textContent()) !== ' now') fail('italic button should work');
await page.getByLabel(/^Moves and materials, 09:00 to 09:40/).fill('Slides, timer');
await page.getByLabel('Based on').selectOption('d2');
if (!(await outline.getByText('Add time blocks to Session Draft 2').count())) fail('empty outline message');
await page.getByLabel('Based on').selectOption('d1');
if ((await page.getByLabel(/^Activities, 09:00 to 09:40/).locator('h3').textContent()) !== 'Kickoff and goals') fail('outline text lost when switching drafts');
// Multi-day: a Day 2 divider starts a fresh clock, in the time blocks and the outline.
await page.getByRole('button', { name: 'Add next day' }).first().click();
await page.getByRole('button', { name: 'Add 30 min block to Session Draft 1' }).click();
if ((await outline.locator('.outline__day').count()) !== 2) fail('outline should group rows by day');
const day2 = page.getByLabel('Day 2 start time');
await day2.fill('8:30');
await day2.press('Enter');
if (!(await page.getByRole('group', { name: 'Session Draft 1' }).getByText('starts 08:30').count())) fail('day divider should show its start');
if (!(await draft1.locator('.draft__total').textContent()).startsWith('2 days')) fail('draft total should count days');
await axeCheck(page, 'multi-day');
await page.getByRole('button', { name: 'Remove Day 2' }).click();
if (await outline.locator('.outline__day').count()) fail('removing the day should merge it back');
await page.getByRole('button', { name: /^Remove 30 minute block/ }).last().click();
// Breaks: from the bank or the cup toggle; striped, totaled separately, one notes cell in the outline.
await page.getByRole('button', { name: 'Add a break to Session Draft 1' }).click();
if (!(await draft1.locator('.tblock--break').count())) fail('break block should look different');
if (!(await draft1.locator('.draft__total').textContent()).includes('15 min of breaks')) fail('draft total should show break time');
const breakRow = outline.locator('tr.outline__break');
if ((await breakRow.count()) !== 1 || (await breakRow.locator('td').count()) !== 3) fail('break row should merge its notes cells');
await page.getByRole('button', { name: /^Break: 15 minute break/ }).click();
if (await draft1.locator('.tblock--break').count()) fail('cup toggle should turn a break back into an activity');
await page.getByRole('button', { name: /^Break: 15 minute block/ }).click();
await axeCheck(page, 'breaks');
await page.getByRole('button', { name: /^Remove 15 minute break/ }).click();
await axeCheck(page, 'session outline');
await outline.screenshot({ path: out + 'outline.png' });

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
if ((await page.getByLabel('Name of function 1').inputValue()) !== 'Opening') fail('column title did not persist');
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

// Backup: download, clear, restore.
// More menu: opens, closes with Escape (focus back on More), and holds backup, restore and clear.
const more = page.getByRole('button', { name: 'More' });
await more.click();
if ((await more.getAttribute('aria-expanded')) !== 'true') fail('More should expand');
await axeCheck(page, 'more menu open');
await page.keyboard.press('Escape');
if ((await more.getAttribute('aria-expanded')) !== 'false') fail('Escape should close More');
if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) !== 'More') fail('focus should return to More');
await more.click();
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download backup' }).click()]);
if (!download.suggestedFilename().startsWith('q3-planning-backup-')) fail(`backup file name: ${download.suggestedFilename()}`);
const backupPath = out + 'backup.json';
await download.saveAs(backupPath);
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole('button', { name: 'More' }).click();
await page.getByRole('button', { name: 'Clear canvas' }).click();
await page.getByRole('button', { name: 'Clear everything' }).click();
if ((await page.getByLabel('Client Name').inputValue()) !== '') fail('clear did not clear');
page.once('dialog', (d) => d.accept());
await page.locator('.toolbar input[type=file]').setInputFiles(backupPath);
await page.waitForTimeout(300);
if ((await page.getByLabel('Client Name').inputValue()) !== 'Acme') fail('restore did not bring the canvas back');
if (!(await page.getByText(/Backup.*restored/).count())) fail('restore message missing');
await page.locator('.toolbar input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
await page.waitForTimeout(200);
if (!(await page.getByText('That file is not a canvas backup').count())) fail('bad file message missing');

// Clear canvas starts the guide over, and print still shows every section.
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole('button', { name: 'More' }).click();
await page.getByRole('button', { name: 'Clear canvas' }).click();
await page.getByRole('button', { name: 'Clear everything' }).click();
await page.getByRole('button', { name: 'Next: Facilitator at the Center' }).waitFor();
await page.emulateMedia({ media: 'print' });
const printed = await page.locator('#canvas .band__title:visible').allTextContents();
if (printed.length !== 9) fail(`print should show the full canvas, got ${printed.length} sections`);
await page.emulateMedia({ media: 'screen' });

await browser.close();
console.log(process.exitCode ? 'Done with failures' : 'All checks passed');
