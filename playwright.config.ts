import { defineConfig, devices } from '@playwright/test';

/** E2E runs against the production build with no API key; upstream data is routed to fixtures. */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node dist/server.mjs',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: !process.env.CI,
    // Every test shares one IP, so the per-IP AI limit is raised for this local server only.
    env: { NODE_ENV: 'production', PORT: '4173', GEMINI_API_KEY: '', RATE_LIMIT_PER_MIN: '1000' },
  },
});
