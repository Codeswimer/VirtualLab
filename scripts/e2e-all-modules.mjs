import { chromium } from 'playwright-core';

const slugs = [
  'chm-01-acid-base-titration',
  'chm-02-hydrated-carbonate',
  'chm-03-redox-permanganate',
  'chm-04-cation-identification',
  'chm-05-anion-gas-identification',
  'chm-05b-gas-identification',
  'chm-06-food-tests',
  'phy-01-simple-pendulum',
  'phy-02-hookes-law',
  'phy-03-principle-of-moments',
  'phy-04-density-archimedes',
  'phy-05-concurrent-forces',
  'phy-06-inclined-plane-friction',
  'phy-07-vernier-micrometer',
  'phy-08-refraction-glass-block',
  'phy-09-prism-minimum-deviation',
  'phy-10-converging-lens',
  'phy-11-ohms-law',
  'phy-12-metre-bridge',
  'phy-13-potentiometer',
  'phy-14-specific-heat-capacity',
  'phy-15-newtons-law-of-cooling',
  'phy-16-boyles-law',
];

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
let errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Demo student/i }).click();
await page.waitForSelector('text=Practical library');

let failures = 0;
for (const slug of slugs) {
  errors = [];
  try {
    await page.goto(`http://localhost:4173/#/lab/${slug}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Start practical', { timeout: 8000 });
    await page.getByRole('button', { name: /Start practical/i }).click();
    await page.waitForTimeout(900);
    const apparatus = await page.locator('main svg, main canvas').count();
    if (apparatus === 0) throw new Error('no apparatus rendered');
    await page.getByRole('button', { name: /^Submit$/ }).click();
    await page.waitForSelector('text=Submit this practical?');
    await page.getByRole('button', { name: /Submit for marking/i }).click();
    await page.waitForSelector('text=Itemised feedback', { timeout: 15000 });
    const body = await page.locator('body').innerText();
    if (/NaN|Infinity/.test(body)) throw new Error('NaN/Infinity leaked into the report');
    const scoreLine = await page.getByText(/marks$/).first().innerText().catch(() => '');
    console.log(`✓ ${slug} — ${scoreLine.replace(/\s+/g, ' ').slice(0, 60)}`);
    if (errors.length) console.log(`   ⚠ ${errors.length} console error(s): ${errors[0]}`);
  } catch (error) {
    failures++;
    console.log(`✗ ${slug}: ${error.message}`);
    for (const entry of errors.slice(0, 4)) console.log('   -', entry);
    await page.screenshot({ path: `/tmp/vlab-shots/all-fail-${slug}.png`, fullPage: true });
  }
}

console.log(`\n${slugs.length - failures}/${slugs.length} modules opened, rendered and marked cleanly.`);
await browser.close();
if (failures > 0) process.exitCode = 1;
