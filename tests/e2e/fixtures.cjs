const { test: base, expect } = require('@playwright/test');
const test = base.extend({
  page: async ({ page, context }, use) => {
    const errors = [], firebaseRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (/firebaseio\.com|firebaseapp\.com|googleapis\.com|gstatic\.com/.test(url.hostname)) firebaseRequests.push(url.href);
      if (url.origin === 'http://127.0.0.1:4179') return route.continue();
      return route.abort();
    });
    await use(page);
    expect(firebaseRequests, 'no production Firebase / SDK requests').toEqual([]);
    expect(errors, 'no uncaught browser runtime errors').toEqual([]);
  },
});
async function loginTeacher(page, account = 'a') {
  await page.bringToFront();
  await page.goto('/?teacher=1');
  await page.waitForFunction(() => window.__testCloud?.ready);
  if (!await page.locator('#firebaseLoginOverlay').evaluate(el => el.classList.contains('open'))) {
    await page.evaluate(() => window.raceCloud.logout());
  }
  await page.locator('#firebaseTeacherEmail').fill(`teacher-${account}@example.invalid`);
  await page.locator('#firebaseTeacherPassword').fill('test-only-password');
  await page.locator('#firebaseLoginSubmit').click();
  await expect(page.locator('#firebaseLoginOverlay')).not.toHaveClass(/open/);
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#controls')).toHaveClass(/open/);
}
module.exports = { test, expect, loginTeacher };
