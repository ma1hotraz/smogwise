/**
 * Records the submission demo by driving the LIVE site (real air data, real Gemini) in Chromium.
 * Run: npx tsx scripts/record-demo.ts   → demo/raw/*.webm, then convert with ffmpeg (see README).
 */
import { chromium, type Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'https://smogwise.vercel.app';
const OUT = process.env.DEMO_OUT_DIR ?? 'demo/raw';
// Viewport and video size must match, otherwise the frame is padded with grey.
const SIZE = { width: 1280, height: 720 };

/** On-screen caption. Styles are set through the CSSOM, which the page's CSP allows. */
async function caption(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, {
        position: 'fixed',
        left: '50%',
        bottom: '28px',
        transform: 'translateX(-50%)',
        maxWidth: '80%',
        zIndex: '99999',
        background: '#1d2733',
        color: '#ffffff',
        padding: '12px 20px',
        borderRadius: '10px',
        borderLeft: '6px solid #7fb6d3',
        font: '600 20px/1.35 system-ui, sans-serif',
        boxShadow: '0 6px 24px rgb(0 0 0 / 0.25)',
        pointerEvents: 'none',
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: SIZE,
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT, size: SIZE },
});
const page = await context.newPage();
const pause = (ms: number): Promise<void> => page.waitForTimeout(ms);
const scrollBy = async (dy: number): Promise<void> => {
  await page.mouse.wheel(0, dy);
  await pause(900);
};
const tab = (name: string) => page.getByRole('tab', { name });
const started = Date.now();

// 1. The brief, and one-click sample households
await page.goto(BASE);
await caption(page, 'Smogwise: a clean-air day plan for families in winter smog');
await pause(3000);
await caption(page, 'Pick a sample household, or enter your own city and home');
await scrollBy(250);
await pause(1200);
await page.getByRole('button', { name: /Sharma household/ }).click();
await page.getByText('Live forecast: CAMS model via Open-Meteo.').waitFor({ timeout: 20_000 });

// 2. Today: live local air, cleanest window, routine
await caption(
  page,
  'Live PM2.5 for Delhi, on the India AQI scale, with the cleanest hours of the day',
);
await pause(3500);
await caption(page, 'Advice is stricter for this home: a toddler, a grandmother with asthma');
await scrollBy(420);
await pause(1800);
await page.getByText(/Written by Gemini/).waitFor({ timeout: 20_000 });
await caption(page, 'Gemini writes the daily brief, using only the plan’s own figures');
await scrollBy(260);
await pause(3000);
await caption(page, 'What the family breathes in today, and how much the plan cuts it');
await scrollBy(380);
await pause(2500);
await caption(page, 'An hour-by-hour low-emission routine, each step with its reason');
await scrollBy(450);
await pause(2500);
await scrollBy(450);
await pause(1500);

// 3. Home air: ranked indoor fixes, live what-if
await page.evaluate(() => {
  window.scrollTo(0, 0);
});
await tab('Home air').click();
await caption(page, 'Indoor fixes ranked by how much they cut this home’s PM2.5');
await scrollBy(300);
await pause(2500);
await page.getByRole('checkbox', { name: 'Include in my plan' }).nth(1).check();
await caption(page, 'Tick a fix and the whole day recomputes instantly');
await pause(2500);

// 4. Swaps: direct impact of each choice
await page.evaluate(() => {
  window.scrollTo(0, 0);
});
await tab('Swaps & impact').click();
await caption(
  page,
  'Each swap shows PM2.5 and CO₂ saved per week, and the change in your own dose',
);
await scrollBy(420);
await pause(2500);
await page
  .getByRole('listitem')
  .filter({ hasText: 'Take the metro' })
  .getByRole('checkbox')
  .check();
await caption(page, 'Scooter → metro: cleaner city air and less smog in your lungs');
await pause(3000);

// 5. Community
await page.evaluate(() => {
  window.scrollTo(0, 0);
});
await tab('Community').click();
const households = page.getByLabel('Households taking part');
await households.waitFor();
await households.fill('120');
await households.press('Tab');
await caption(page, 'Scale it to a housing society, then print a notice for the noticeboard');
await pause(3000);
await scrollBy(400);
await pause(2000);

// 6. Ask Smogwise, in English and Hindi (real Gemini)
await page.evaluate(() => {
  window.scrollTo(0, 0);
});
await tab('Ask Smogwise').click();
const question = page.getByLabel('Your question');
await question.waitFor();
await caption(page, 'Ask Smogwise: questions about this family’s plan, answered by Gemini');
await question.pressSequentially('Can my mother go for her evening walk?', { delay: 35 });
await page.getByRole('button', { name: 'Ask', exact: true }).click();
await page.getByText(/Answered by Gemini/).waitFor({ timeout: 30_000 });
await page.locator('.answer').scrollIntoViewIfNeeded();
await pause(4000);
await question.fill('');
await page.getByLabel('Answer in').selectOption('hi');
await question.pressSequentially('क्या बच्चे बाहर खेल सकते हैं?', { delay: 45 });
await page.getByRole('button', { name: 'Ask', exact: true }).click();
// Wait for the new answer itself: Devanagari text in the answer block.
await page
  .locator('.answer p')
  .filter({ hasText: /[\u0900-\u097F]/ })
  .waitFor({ timeout: 30_000 });
await page.locator('.answer').scrollIntoViewIfNeeded();
await caption(page, 'In Hindi too. Emergency symptoms always get a fixed safety answer');
await pause(4000);

// 7. Inclusive by design
await page.evaluate(() => {
  window.scrollTo(0, 0);
});
await tab('Today').click();
await page.getByLabel('Theme').selectOption('dark');
await page.getByLabel('Text size').selectOption('115');
await caption(page, 'WCAG 2.2 AA: keyboard, screen readers, dark mode, larger text, works offline');
await pause(3500);
await caption(page, 'smogwise.vercel.app  ·  github.com/ma1hotraz/smogwise');
await pause(3500);

process.stdout.write(`recorded ${((Date.now() - started) / 1000).toFixed(1)} s\n`);
await context.close();
await browser.close();
