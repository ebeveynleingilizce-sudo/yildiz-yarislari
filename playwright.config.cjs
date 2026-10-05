const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/removal.spec.cjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 30000,
  expect: { timeout: 7000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4179',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/support/server.cjs',
    url: 'http://127.0.0.1:4179/__test_health',
    reuseExistingServer: false,
    timeout: 15000,
  },
  projects: [
    { name: 'android-small', use: { ...devices['Pixel 5'], browserName: 'chromium', viewport: { width: 360, height: 800 } } },
    { name: 'android-standard', use: { ...devices['Pixel 5'], browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit', viewport: { width: 390, height: 844 } } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'webkit', viewport: { width: 810, height: 1080 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } },
  ],
});
