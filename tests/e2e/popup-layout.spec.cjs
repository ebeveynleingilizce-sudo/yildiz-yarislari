const { test, expect } = require('./fixtures.cjs');
test('student connection dialog and its fields remain symmetric', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#studentAccessOverlay')).toBeVisible();
  const geometry = await page.evaluate(() => {
    const box = document.querySelector('#studentAccessForm').getBoundingClientRect();
    const input = document.querySelector('#studentAccessCode').getBoundingClientRect();
    const button = document.querySelector('#studentAccessSubmit').getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      inputLeft: input.left, inputRight: input.right, buttonLeft: button.left, buttonRight: button.right };
  });
  expect(Math.abs(geometry.x + geometry.width / 2 - geometry.viewportWidth / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.y + geometry.height / 2 - geometry.viewportHeight / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.inputLeft - geometry.buttonLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.inputRight - geometry.buttonRight)).toBeLessThanOrEqual(1);
  expect(geometry.x).toBeGreaterThanOrEqual(0);
  expect(geometry.y).toBeGreaterThanOrEqual(0);
});
