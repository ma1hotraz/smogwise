/**
 * Records the submission demo by driving the LIVE site (real air data, real Gemini) in Chromium.
 * Run: npm run demo   → demo/raw/*.webm; convert with the ffmpeg command in README "Demo video".
 * The pauses pace the video for viewers; they are not waits for the app (those use locators).
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

/** How long viewers get to read each caption, in ms (pacing for the video, not app waits). */
const PACE = { glance: 1200, read: 2500, linger: 3500, scroll: 900 } as const;
const LOAD_TIMEOUT_MS = 20_000;
const AI_TIMEOUT_MS = 30_000;
const PUBLIC_LINKS = 'smogwise.vercel.app  ·  github.com/ma1hotraz/smogwise';

const pause = (page: Page, ms: number): Promise<void> => page.waitForTimeout(ms);

async function scrollBy(page: Page, dy: number): Promise<void> {
  await page.mouse.wheel(0, dy);
  await pause(page, PACE.scroll);
}

async function openTab(page: Page, name: string): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  await page.getByRole('tab', { name }).click();
}

/** 1. The brief and one-click sample households. */
async function intro(page: Page): Promise<void> {
  await page.goto(BASE);
  await caption(page, 'Smogwise: a clean-air day plan for families in winter smog');
  await pause(page, PACE.linger);
  await caption(page, 'Pick a sample household, or enter your own city and home');
  await scrollBy(page, 250);
  await pause(page, PACE.glance);
  await page.getByRole('button', { name: /Sharma household/ }).click();
  await page
    .getByText('Live forecast: CAMS model via Open-Meteo.')
    .waitFor({ timeout: LOAD_TIMEOUT_MS });
}

/** 2. Today: live local air, the cleanest window, the AI brief, dose and routine. */
async function today(page: Page): Promise<void> {
  await caption(
    page,
    'Live PM2.5 for Delhi, on the India AQI scale, with the cleanest hours of the day',
  );
  await pause(page, PACE.linger);
  await caption(page, 'Advice is stricter for this home: a toddler, a grandmother with asthma');
  await scrollBy(page, 420);
  await pause(page, PACE.glance);
  await page.getByText(/Written by Gemini/).waitFor({ timeout: LOAD_TIMEOUT_MS });
  await caption(page, 'Gemini writes the daily brief, using only the plan’s own figures');
  await scrollBy(page, 260);
  await pause(page, PACE.linger);
  await caption(page, 'What the family breathes in today, and how much the plan cuts it');
  await scrollBy(page, 380);
  await pause(page, PACE.read);
  await caption(page, 'An hour-by-hour low-emission routine, each step with its reason');
  await scrollBy(page, 450);
  await pause(page, PACE.read);
  await scrollBy(page, 450);
}

/** 3. Home air: ranked indoor fixes and a live what-if. */
async function homeAir(page: Page): Promise<void> {
  await openTab(page, 'Home air');
  await caption(page, 'Indoor fixes ranked by how much they cut this home’s PM2.5');
  await scrollBy(page, 300);
  await pause(page, PACE.read);
  await page.getByRole('checkbox', { name: 'Include in my plan' }).nth(1).check();
  await caption(page, 'Tick a fix and the whole day recomputes instantly');
  await pause(page, PACE.read);
}

/** 4. Swaps: the direct impact of each choice. */
async function swaps(page: Page): Promise<void> {
  await openTab(page, 'Swaps & impact');
  await caption(
    page,
    'Each swap shows PM2.5 and CO₂ saved per week, and the change in your own dose',
  );
  await scrollBy(page, 420);
  await pause(page, PACE.read);
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Take the metro' })
    .getByRole('checkbox')
    .check();
  await caption(page, 'Scooter → metro: cleaner city air and less smog in your lungs');
  await pause(page, PACE.linger);
}

/** 5. Community: scale the impact and print a notice. */
async function community(page: Page): Promise<void> {
  await openTab(page, 'Community');
  const households = page.getByLabel('Households taking part');
  await households.waitFor();
  await households.fill('120');
  await households.press('Tab');
  await caption(page, 'Scale it to a housing society, then print a notice for the noticeboard');
  await pause(page, PACE.linger);
  await scrollBy(page, 400);
  await pause(page, PACE.read);
}

/** 6. Ask Smogwise in English, then Hindi (real Gemini answers). */
async function ask(page: Page): Promise<void> {
  await openTab(page, 'Ask Smogwise');
  const question = page.getByLabel('Your question');
  await question.waitFor();
  await caption(page, 'Ask Smogwise: questions about this family’s plan, answered by Gemini');
  await question.pressSequentially('Can my mother go for her evening walk?', { delay: 35 });
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.getByText(/Answered by Gemini/).waitFor({ timeout: AI_TIMEOUT_MS });
  await page.locator('.answer').scrollIntoViewIfNeeded();
  await pause(page, PACE.linger);
  await question.fill('');
  await page.getByLabel('Answer in').selectOption('hi');
  await question.pressSequentially('क्या बच्चे बाहर खेल सकते हैं?', { delay: 45 });
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  // Wait for the new answer itself: Devanagari text in the answer block.
  await page
    .locator('.answer p')
    .filter({ hasText: /[\u0900-\u097F]/ })
    .waitFor({ timeout: AI_TIMEOUT_MS });
  await page.locator('.answer').scrollIntoViewIfNeeded();
  await caption(page, 'In Hindi too. Emergency symptoms always get a fixed safety answer');
  await pause(page, PACE.linger);
}

/** 7. Inclusive by design, then the links. */
async function inclusive(page: Page): Promise<void> {
  await openTab(page, 'Today');
  await page.getByLabel('Theme').selectOption('dark');
  await page.getByLabel('Text size').selectOption('115');
  await caption(
    page,
    'WCAG 2.2 AA: keyboard, screen readers, dark mode, larger text, works offline',
  );
  await pause(page, PACE.linger);
  await caption(page, PUBLIC_LINKS);
  await pause(page, PACE.linger);
}

const SCENES = [intro, today, homeAir, swaps, community, ask, inclusive] as const;

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: SIZE },
  });
  const page = await context.newPage();
  const started = Date.now();
  for (const scene of SCENES) {
    await scene(page);
  }
  // Closing the context finalises the video file.
  await context.close();
  process.stdout.write(`recorded ${((Date.now() - started) / 1000).toFixed(1)} s\n`);
} finally {
  await browser.close();
}
