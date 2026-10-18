// Tests for Inkling. `npm test` runs both projects; the desktop one needs `npm ci` in desktop/ first
// (and a display: on Linux CI it runs under xvfb-run).
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { viewport: { width: 1440, height: 900 }, acceptDownloads: true },
  projects: [
    { name: 'web', testMatch: /web\.spec\.js/, use: { browserName: 'chromium' } },
    { name: 'desktop', testMatch: /desktop\.spec\.js/, workers: 1 }
  ]
});
