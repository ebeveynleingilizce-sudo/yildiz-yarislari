const { test, expect, loginTeacher, connectStudent } = require('./fixtures.cjs');

test('reference portal fits the course and activates at 30 XP without an automatic reset', async ({ page, request }, info) => {
  await loginTeacher(page);
  expect((await request.get('/nether-portal.svg')).ok()).toBeTruthy();
  await page.evaluate(async () => {
    await window.raceCloud.write([
      { id: 1, name: 'Portal Test', emoji: 'mc-steve', stars: 29, xp: 29, lifetimeStars: 29 },
      { id: 2, name: 'Test B', emoji: 'mc-alex', stars: 0, xp: 0, lifetimeStars: 0 },
    ]);
  });
  const track = page.locator('#lane-1 .mc-world-track');
  await expect(page.locator('[data-name="1"]')).toHaveValue('Portal Test');
  await expect(track).not.toHaveClass(/mc-portal-active/);
  await page.locator('[data-add="1"]').click();
  await expect(track).toHaveClass(/mc-portal-active/);
  await expect(page.locator('[data-name="1"]').locator('xpath=../..').locator('.control-score')).toHaveText('XP 30');
  await page.locator('[data-add="1"]').click();
  await expect(page.locator('#toast')).toContainText('Nether portalı açıldı');
  await expect(page.locator('[data-name="1"]').locator('xpath=../..').locator('.control-score')).toHaveText('XP 30');
  await connectStudent(page);
  await expect(page.locator('#lane-1 .mc-world-track')).toHaveClass(/mc-portal-active/);
  const portal = page.locator('#lane-1 .finish-line');
  await expect(portal).toHaveCSS('width', '64px');
  const box = await portal.boundingBox();
  const world = await page.locator('#lane-1 .mc-world-track').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(world.x - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(world.x + world.width + 1);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  await page.locator('#lane-1').screenshot({ path: info.outputPath('nether-portal-30xp.png') });
});