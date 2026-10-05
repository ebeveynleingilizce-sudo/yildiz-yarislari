const { test, expect, loginTeacher, openTeacherSession, connectStudent } = require('./fixtures.cjs');

test('new student and a class link alone show only the connection screen', async ({ page }) => {
  for (const url of ['/', `/?roster=${'a'.repeat(32)}`]) {
    await page.goto(url);
    await page.waitForFunction(() => window.__testCloud?.ready);
    await expect(page.locator('#studentAccessTitle')).toHaveText('Öğretmenine Bağlan');
    await expect(page.locator('#studentAccessOverlay')).toHaveClass(/open/);
    await expect(page.locator('#raceApp')).toBeHidden();
    await expect(page.locator('.student-card')).toHaveCount(0);
    expect(await page.evaluate(() => window.__testCloud.writes.length)).toBe(0);
  }
});

test('short student code alone opens the assigned student profile', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__testCloud?.ready);
  await page.locator('#studentAccessCode').fill('TESTCODE');
  await page.locator('#studentAccessSubmit').click();
  await expect(page.locator('#studentAccessOverlay')).not.toHaveClass(/open/);
  await expect(page.locator('#lanes')).toContainText('Test Öğrenci A');
});

test('connection selects teacher A, blocks teacher B at database paths, and survives refresh', async ({ page }) => {
  await connectStudent(page);
  await expect(page.locator('#lanes')).toContainText('Test Öğrenci A');
  await expect(page.locator('#lanes')).not.toContainText('Öğretmen B');
  const denied = await page.evaluate(async () => {
    const sdk = window.__firebaseSdk;
    const paths = ['teacherData/teacher-b', `sharedRosters/${'b'.repeat(32)}`, `studentQuestionData/${'b'.repeat(32)}/1`];
    return Promise.all(paths.map(async path => {
      try { await sdk.get(sdk.ref(null, path)); return 'ALLOWED'; } catch (error) { return error.code; }
    }));
  });
  expect(denied).toEqual(['PERMISSION_DENIED', 'PERMISSION_DENIED', 'PERMISSION_DENIED']);
  await page.reload();
  await expect(page.locator('#studentAccessOverlay')).not.toHaveClass(/open/);
  await expect(page.locator('#raceApp')).toBeVisible();
  await expect(page.locator('#lanes')).toContainText('Test Öğrenci A');
  await expect(page.locator('#studentSwitch')).toContainText('Test Öğrenci A');
});

test('removal happens once without resurrection or recreating remaining race cards', async ({ page }) => {
  await loginTeacher(page);
  await page.evaluate(() => {
    window.__testCloud.writes.length = 0;
    window.__remainingCard = document.getElementById('lane-2');
    window.__rostersAfterRemove = [];
    window.addEventListener('firebase-roster', event => window.__rostersAfterRemove.push(event.detail.map(student => student.id)));
    window.__resurrections = [];
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1 && (node.id === 'lane-1' || node.querySelector?.('#lane-1'))) window.__resurrections.push(node.id);
      }
    }).observe(document.getElementById('lanes'), { childList: true, subtree: true });
  });
  let dialogs = 0;
  page.on('dialog', async dialog => { dialogs++; await dialog.accept(); });
  await page.locator('[data-remove-student="1"]').click();
  await expect(page.locator('[data-name="1"]')).toHaveCount(0);
  await expect(page.locator('#lane-1')).toHaveCount(0);
  await expect(page.locator('#lane-2')).toHaveCount(1);
  await page.waitForFunction(() => window.__testCloud.data().teacherData['teacher-a'].students.length === 1);
  const outcome = await page.evaluate(() => ({
    sameCard: window.__remainingCard === document.getElementById('lane-2'),
    resurrections: window.__resurrections,
    snapshots: window.__rostersAfterRemove,
    writes: window.__testCloud.writes.filter(write => Object.keys(write.updates).some(path => path === 'teacherData/teacher-a/students')).length,
  }));
  expect(dialogs).toBe(1);
  expect(outcome.sameCard).toBe(true);
  expect(outcome.resurrections).toEqual([]);
  expect(outcome.snapshots.every(ids => !ids.includes(1))).toBe(true);
  expect(outcome.writes).toBe(1);
  await page.reload();
  await expect(page.locator('#lane-1')).toHaveCount(0);
  await expect(page.locator('#lane-2')).toHaveCount(1);
  await loginTeacher(page, 'b');
  await expect(page.locator('.control-row')).toHaveCount(2);
  await expect(page.locator('[data-name="1"]')).toHaveValue('Öğretmen B Öğrenci 1');
});

test('removing a connected student revokes live access, old code, and refreshed access', async ({ page, context }) => {
  await connectStudent(page);
  const teacher = await context.newPage();
  await openTeacherSession(teacher);
  teacher.once('dialog', dialog => dialog.accept());
  await teacher.locator('[data-remove-student="1"]').click();
  await page.bringToFront();
  await expect(page.locator('#raceApp')).toBeHidden();
  await expect(page.locator('#studentAccessOverlay')).toHaveClass(/open/);
  await expect(page.locator('.student-card')).toHaveCount(0);
  const forbiddenWrite = await page.evaluate(async () => {
    const sdk = window.__firebaseSdk;
    try { await sdk.set(sdk.ref(null, `studentQuestionData/${'a'.repeat(32)}/1`), { xpEarned: 999 }); return 'ALLOWED'; }
    catch (error) { return error.code; }
  });
  expect(forbiddenWrite).toBe('PERMISSION_DENIED');
  await page.locator('#studentAccessCode').fill(`${'a'.repeat(32)}:1:TESTCODE`);
  await page.locator('#studentAccessSubmit').click();
  await expect(page.locator('#studentAccessMessage')).toContainText('Erişim reddedildi');
  await page.reload();
  await page.waitForFunction(() => window.__testCloud?.ready);
  await expect(page.locator('#raceApp')).toBeHidden();
  await expect(page.locator('.student-card')).toHaveCount(0);
  await teacher.close();
});

test('rotating a student code revokes a connected session', async ({ page, context }) => {
  await connectStudent(page);
  const teacher = await context.newPage();
  await openTeacherSession(teacher);
  await teacher.locator('[data-rotate-code="1"]').click();
  await page.bringToFront();
  await expect(page.locator('#raceApp')).toBeHidden();
  await expect(page.locator('#studentAccessOverlay')).toHaveClass(/open/);
  await teacher.close();
});

test('teacher exposes short codes without student links', async ({ page }) => {
  await loginTeacher(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copiedCode = text; } } });
  });
  await page.locator('[data-copy-code="1"]').click();
  await expect.poll(() => page.evaluate(() => window.__copiedCode)).toBe('TESTCODE');
  await expect(page.locator('[data-student-id="1"] .student-code-row')).toContainText('TESTCODE');
  await expect(page.locator('[data-copy-student-link]')).toHaveCount(0);
  await expect(page.locator('#copyStudentLink')).toHaveCount(0);
});
test('rejected removal reports failure and restores the confirmed roster', async ({ page }) => {
  await loginTeacher(page);
  await page.evaluate(() => { window.__testCloud.failNextWrite = true; });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-remove-student="1"]').click();
  await expect(page.locator('#toast')).toContainText('Firebase\'e kaydedilemedi');
  await expect(page.locator('[data-name="1"]')).toHaveValue('Test Öğrenci A');
  await expect(page.locator('.control-row')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.student-card')).toHaveCount(2);
});
