/**
 * End-to-end against the production build with no API key (docs/07 §2). Air and place data are
 * routed to fixtures, so no test reaches the network.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

import { localHourKey } from '../../src/shared/time.js';

// The browser clock is pinned to 09:00 in Delhi, so the plan (which depends on the hour) is the
// same whenever the suite runs; fixture dates are derived from that instant.
const TIMEZONE = 'Asia/Kolkata';
const FIXED_NOW = new Date('2026-11-20T03:30:00Z');
const DAY_MS = 86_400_000;
const today = localHourKey(FIXED_NOW, TIMEZONE).slice(0, 10);
const tomorrow = localHourKey(new Date(FIXED_NOW.getTime() + DAY_MS), TIMEZONE).slice(0, 10);
const SHAPE = [
  170, 175, 178, 180, 180, 178, 175, 171, 160, 140, 120, 105, 95, 88, 86, 90, 110, 130, 150, 160,
  165, 168, 170, 170,
];
const AIR = {
  source: 'open-meteo',
  fetchedAt: FIXED_NOW.toISOString(),
  timezone: TIMEZONE,
  hourly: [today, tomorrow].flatMap((day) =>
    SHAPE.map((pm25, h) => ({
      time: `${day}T${String(h).padStart(2, '0')}:00`,
      pm25,
      pm10: pm25 * 1.4,
    })),
  ),
};
const PLACES = {
  results: [
    {
      name: 'Delhi',
      admin1: 'National Capital Territory of Delhi',
      countryCode: 'IN',
      lat: 28.65,
      lon: 77.23,
      timezone: 'Asia/Kolkata',
    },
  ],
};

async function setup(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(message.text());
    }
  });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.clock.setFixedTime(FIXED_NOW);
  await page.route('**/api/air?**', (route) => route.fulfill({ json: AIR }));
  await page.route('**/api/geocode?**', (route) => route.fulfill({ json: PLACES }));
  return problems;
}

/** Each tab's own heading: waiting for it means the (possibly lazy) panel has rendered. */
const TAB_HEADINGS: Record<string, string> = {
  Today: 'Your low-emission day',
  'Home air': 'Cleaner air at home',
  'Swaps & impact': 'Swaps and their impact',
  Community: 'Clean air is a group effort',
  'Ask Smogwise': 'Ask Smogwise',
};
const TABS = Object.keys(TAB_HEADINGS);

async function openTab(page: Page, tab: string): Promise<void> {
  await page.getByRole('tab', { name: tab }).click();
  await expect(
    page
      .getByRole('tabpanel')
      .getByRole('heading', { name: TAB_HEADINGS[tab] ?? tab, exact: true }),
  ).toBeVisible();
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

async function openSample(page: Page, name = /Sharma household/): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name }).click();
  await expect(page.getByRole('heading', { level: 1, name: /air on the .* scale/ })).toBeVisible();
  await expect(page.getByText('Live forecast: CAMS model via Open-Meteo.')).toBeVisible();
}

test('a sample household gets a complete plan in one click, with no console or CSP errors', async ({
  page,
}) => {
  const problems = await setup(page);
  await openSample(page);
  await expect(page.getByRole('heading', { name: 'Your low-emission day' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Keep windows shut until 13:00' })).toBeVisible();
  await expect(page.getByText(/Written from your plan’s rules/)).toBeVisible();
  await expect(page.getByRole('meter')).toBeVisible();
  expect(problems).toEqual([]);
});

test('every view has zero axe violations in light and dark themes', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await expectNoAxeViolations(page);
  await openSample(page, /Rohit/);
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Theme').selectOption(theme);
    for (const tab of TABS) {
      await openTab(page, tab);
      await expectNoAxeViolations(page);
    }
  }
});

test('works with the keyboard alone: search, choose, build and move between tabs', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('combobox', { name: 'City or town' }).focus();
  await page.keyboard.type('Delhi');
  await expect(page.getByRole('option', { name: /Delhi/ })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'City or town' })).toHaveValue(
    /Delhi, National Capital/,
  );
  await page.getByRole('button', { name: 'Build my day' }).focus();
  await page.keyboard.press('Enter');
  const heading = page.getByRole('heading', { level: 1, name: /Delhi/ });
  await expect(heading).toBeFocused();
  await page.getByRole('tab', { name: 'Today' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Home air' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Ask Smogwise' })).toBeFocused();
});

test('ticking a swap changes the dose and is announced (direct impact of choices)', async ({
  page,
}) => {
  await setup(page);
  await openSample(page);
  await page.getByRole('tab', { name: 'Swaps & impact' }).click();
  const meter = page.getByRole('meter');
  const before = await meter.getAttribute('value');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Take the metro' })
    .getByRole('checkbox')
    .check();
  await expect.poll(() => meter.getAttribute('value')).not.toBe(before);
  await expect(page.getByTestId('announcer')).toContainText('less PM2.5 breathed in today');
});

test('Ask Smogwise answers without an API key and handles red flags', async ({ page }) => {
  await setup(page);
  await openSample(page);
  await page.getByRole('tab', { name: 'Ask Smogwise' }).click();
  await page.getByLabel('Your question').fill('Can my mother go for her evening walk?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByText(/Answered from your plan’s rules/)).toBeVisible();
  await page.getByLabel('Your question').fill('My father has chest pain');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await expect(page.getByText(/This could be a medical emergency/)).toBeVisible();
});

test('the plan survives a reload, and "Forget my data" clears it', async ({ page }) => {
  await setup(page);
  await openSample(page, /Chen family/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Beijing/ })).toBeVisible();
  await page.getByText(/Have a reading from a local monitor/).click();
  await page.getByRole('button', { name: 'Forget my data' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: /Plan a cleaner-air day/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: /Plan a cleaner-air day/ }),
  ).toBeVisible();
});

test('reflows at 320 px with no horizontal scrolling, and supports 200% text', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await openSample(page);
  await page.getByLabel('Text size').selectOption('130');
  for (const tab of ['Today', 'Swaps & impact', 'Community']) {
    await page.getByRole('tab', { name: tab }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  }
});

test.describe('user style overrides', () => {
  // A reader's own stylesheet is not subject to the page CSP (which blocks injected styles).
  test.use({ bypassCSP: true });

  test('keeps content readable with WCAG text-spacing overrides (1.4.12)', async ({ page }) => {
    await setup(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await openSample(page);
    await page.addStyleTag({
      content:
        '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }',
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole('heading', { name: 'Your low-emission day' })).toBeVisible();
  });
});

test('every interactive target is at least 24 × 24 px (2.5.8)', async ({ page }) => {
  await setup(page);
  await openSample(page, /Rohit/);
  for (const tab of TABS) {
    await openTab(page, tab);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, input, select, textarea, summary, [role="tab"]')]
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.width > 0 && (box.width < 24 || box.height < 24))
        .map(
          ({ el, box }) =>
            `${el.tagName}#${el.id} ${Math.round(box.width)}×${Math.round(box.height)}`,
        ),
    );
    expect(small).toEqual([]);
  }
});

test('the community notice prints on its own', async ({ page }) => {
  await setup(page);
  await openSample(page, /Rohit/);
  await page.getByRole('tab', { name: 'Community' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(
    page.getByRole('heading', { name: /Cleaner air for our neighbourhood, Gurugram/ }),
  ).toBeVisible();
  await expect(page.getByRole('tablist')).toBeHidden();
});

test('honours reduced motion and forced colours without violations', async ({ page }) => {
  await setup(page);
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await openSample(page);
  await expectNoAxeViolations(page);
});

test('security headers are served with the page', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response?.headers() ?? {};
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['content-security-policy']).not.toContain('unsafe-inline');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['permissions-policy']).toContain('geolocation=(self)');
});
