import { chromium } from 'playwright-core';
import fs from 'node:fs';

const shots = '/tmp/vlab-shots';
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.log(`✗ ${name}: ${error.message}`);
    await page.screenshot({ path: `${shots}/fail-${name.replace(/\W+/g, '-')}.png`, fullPage: true });
    throw error;
  }
};

try {
  await step('login page', async () => {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Welcome back', { timeout: 10000 });
    await page.screenshot({ path: `${shots}/01-login.png`, fullPage: true });
  });

  await step('demo student dashboard', async () => {
    await page.getByRole('button', { name: /Demo student/i }).click();
    await page.waitForURL(/#\/dashboard/, { timeout: 10000 });
    await page.waitForSelector('text=Term grade');
    await page.waitForSelector('text=Class leaderboard');
    const body = await page.locator('body').innerText();
    if (!/Ada Obi/.test(body)) throw new Error('student name missing from dashboard');
    await page.screenshot({ path: `${shots}/02-student-dashboard.png`, fullPage: true });
    await page.goto('http://localhost:4173/#/library', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Practical library');
    await page.screenshot({ path: `${shots}/03-library.png`, fullPage: true });
  });

  await step('library filters', async () => {
    const cards = await page.locator('h3').count();
    console.log(`  cards visible: ${cards}`);
    await page.getByPlaceholder(/Search a practical/i).fill('titration');
    await page.waitForTimeout(300);
    console.log(`  after search: ${await page.locator('h3').count()} headings`);
    await page.getByPlaceholder(/Search a practical/i).fill('');
    await page.waitForTimeout(200);
  });

  await step('open pendulum briefing', async () => {
    await page.getByRole('heading', { name: /Simple pendulum: determine g/i }).click();
    await page.waitForURL(/#\/lab\/phy-01/, { timeout: 10000 });
    await page.waitForSelector('text=Start practical');
    await page.screenshot({ path: `${shots}/04-briefing.png`, fullPage: true });
  });

  await step('start 3D practical', async () => {
    await page.getByRole('button', { name: /Start practical/i }).click();
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${shots}/05-pendulum-lab.png`, fullPage: true });
  });

  await step('time and record a reading', async () => {
    await page.getByRole('button', { name: /Time 20 swings/i }).click();
    await page.waitForTimeout(6000);
    await page.getByRole('button', { name: /Record row/i }).click();
    await page.waitForTimeout(800);
    const values = await page
      .locator('table')
      .first()
      .locator('input')
      .evaluateAll((elements) => elements.map((element) => element.value));
    console.log('  table values:', values.slice(0, 8).join(' | '));
    if (!values.some((value) => value && value !== '')) {
      throw new Error('no numeric reading recorded');
    }
  });

  await step('graph tool', async () => {
    await page.getByRole('tab', { name: /^Graph$/ }).click();
    await page.getByRole('button', { name: /Plot from table/i }).click();
    await page.getByRole('button', { name: /Draw best-fit line/i }).click();
    await page.locator('input[id^="graph-xlabel-"]:visible').fill('Length L / m');
    await page.locator('input[id^="graph-ylabel-"]:visible').fill('T² / s²');
    await page.waitForTimeout(500);
    const gradientText = await page.getByText('Gradient of your line').first().innerText();
    const gradientValue = await page
      .locator('p.reading')
      .first()
      .innerText();
    console.log('  gradient panel:', gradientText.replace(/\s+/g, ' '), '=>', gradientValue);
    await page.screenshot({ path: `${shots}/06-graph.png`, fullPage: true });
  });

  await step('calculations and conclusion', async () => {
    await page.getByRole('tab', { name: /Calculations/i }).click();
    const calcInputs = page.locator('input[placeholder="Your answer"]:visible');
    await calcInputs.nth(0).fill('9.80');
    await calcInputs.nth(1).fill('1.00');
    await page.getByRole('tab', { name: /Conclusion/i }).click();
    await page.locator('textarea[aria-label="Conclusion and evaluation"]:visible').fill(
      'From the graph, g is approximately 9.8 m/s², close to the accepted value of 9.81 m/s². The main source of error is reaction time when starting the stopwatch.',
    );
    await page.screenshot({ path: `${shots}/07-calculations.png`, fullPage: true });
  });

  await step('submit and mark', async () => {
    await page.getByRole('button', { name: /^Submit$/ }).click();
    await page.waitForSelector('text=Submit this practical?');
    await page.getByRole('button', { name: /Submit for marking/i }).click();
    await page.waitForURL(/#\/report\//, { timeout: 20000 });
    await page.waitForSelector('text=Itemised feedback', { timeout: 10000 });
    const body = await page.locator('body').innerText();
    console.log('  report snippet:', body.replace(/\s+/g, ' ').slice(0, 220));
    await page.screenshot({ path: `${shots}/08-report.png`, fullPage: true });
  });

  await step('teacher dashboard', async () => {
    await page.goto('http://localhost:4173/#/settings', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Sign out/i }).first().click();
    await page.waitForSelector('text=Welcome back', { timeout: 10000 });
    await page.getByRole('button', { name: /Demo teacher/i }).click();
    await page.waitForTimeout(900);
    await page.goto('http://localhost:4173/#/dashboard', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Marking queue');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${shots}/08-teacher-dashboard.png`, fullPage: true });
    const text = await page.locator('body').innerText();
    console.log('  dashboard has submissions:', /Submissions/.test(text), /Ada Obi/.test(text));
    if (!/Ada Obi/.test(text)) throw new Error('class submission missing on dashboard');
  });

  await step('teacher marks a submission', async () => {
    await page.getByRole('button', { name: /^Mark$/ }).first().click();
    await page.waitForSelector('text=Mark this practical');
    await page.locator('#teacher-marks').fill('18');
    await page.locator('#teacher-comment').fill('Smoke test: strong readings, tighten the graph scale.');
    await page.getByRole('button', { name: /Save mark/i }).click();
    await page.waitForSelector('text=Mark this practical', { state: 'hidden', timeout: 5000 });
    console.log('  teacher mark saved');
  });

  await step('owner console', async () => {
    await page.goto('http://localhost:4173/#/settings', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Sign out/i }).first().click();
    await page.waitForSelector('text=Welcome back', { timeout: 10000 });
    await page.getByRole('button', { name: /Demo owner/i }).click();
    await page.waitForTimeout(1400);
    await page.goto('http://localhost:4173/#/dashboard', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Platform administration');
    const body = await page.locator('body').innerText();
    if (!/Greenfield Academy/.test(body)) throw new Error('pending school missing from owner console');
    await page.screenshot({ path: `${shots}/09-owner-console.png`, fullPage: true });
  });

  await step('school admin console', async () => {
    await page.goto('http://localhost:4173/#/settings', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Sign out/i }).first().click();
    await page.waitForSelector('text=Welcome back', { timeout: 10000 });
    await page.getByRole('button', { name: /Demo school admin/i }).click();
    await page.waitForTimeout(1400);
    await page.goto('http://localhost:4173/#/dashboard', { waitUntil: 'networkidle' });
    await page.waitForSelector('text=School console');
    const body = await page.locator('body').innerText();
    if (!/Ngozi Umeh/.test(body)) throw new Error('pending student request missing from school console');
    await page.screenshot({ path: `${shots}/10-school-console.png`, fullPage: true });
  });

  await step('global leaderboard', async () => {
    await page.goto('http://localhost:4173/#/leaderboard', { waitUntil: 'networkidle' });
    await page.getByRole('tab', { name: /Global/i }).click();
    await page.waitForTimeout(500);
    const body = await page.locator('body').innerText();
    if (!/Ifeoma Eze|Chidi Nwankwo/.test(body)) {
      throw new Error('ranked students missing from global leaderboard');
    }
    await page.screenshot({ path: `${shots}/11-leaderboard.png`, fullPage: true });
  });

  await step('mobile library layout', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:4173/#/settings', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Sign out/i }).first().click();
    await page.waitForSelector('text=Welcome back', { timeout: 10000 });
    await page.getByRole('button', { name: /Demo student/i }).click();
    await page.waitForTimeout(1400);
    await page.goto('http://localhost:4173/#/library', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${shots}/12-mobile-library.png`, fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log('  horizontal overflow px:', overflow);
    if (overflow > 2) throw new Error(`horizontal overflow ${overflow}px`);
  });

  await step('mobile lab layout', async () => {
    await page.goto('http://localhost:4173/#/lab/phy-08-refraction-glass-block', {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('text=Start practical');
    await page.getByRole('button', { name: /Start practical/i }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${shots}/13-mobile-lab.png`, fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log('  horizontal overflow px:', overflow);
    if (overflow > 2) throw new Error(`horizontal overflow ${overflow}px`);
  });

  console.log('CONSOLE ERRORS:', errors.length);
  for (const error of errors.slice(0, 10)) console.log(' -', error);
} catch (error) {
  console.log('FAILED:', error.message);
  console.log('CONSOLE ERRORS:', errors.length);
  for (const entry of errors.slice(0, 15)) console.log(' -', entry);
  process.exitCode = 1;
} finally {
  await browser.close();
}
