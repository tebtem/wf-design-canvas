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

await page.goto(APP_URL);

// Typing and stickies persist.
await page.getByRole('textbox', { name: 'Purpose', exact: true }).fill('Align on Q3 goals');
await page.getByRole('button', { name: 'Sticky note in Activity ideas' }).click();
await page.keyboard.type('Gallery walk');

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
const total2 = await page.getByRole('group', { name: 'Session Draft 2' }).locator('.draft__total').textContent();
console.log('Draft 1:', total1, '| Draft 2:', total2);
if (total1 !== 'Total 45 min') fail('expected Draft 1 to total 45 min');

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
if ((await page.getByRole('textbox', { name: 'Purpose', exact: true }).inputValue()) !== 'Align on Q3 goals') fail('text did not persist');
if ((await page.getByRole('textbox', { name: /Sticky note 1 in Activity ideas/ }).inputValue()) !== 'Gallery walk') fail('sticky did not persist');
const savedNotes = await page.getByRole('textbox', { name: /^Notes for 60 minute block/ }).inputValue();
if (savedNotes !== '• Pairs discuss\n• Share out') fail(`block notes wrong: ${JSON.stringify(savedNotes)}`);
const blocks = await page.locator('.tblock').count();
console.log('Blocks after reload:', blocks);
if (blocks < 2) fail('expected blocks to persist');

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

await browser.close();
console.log(process.exitCode ? 'Done with failures' : 'All checks passed');
