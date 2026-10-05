const { test, expect, loginTeacher, connectStudent, studentQuestion } = require('./fixtures.cjs');

async function choiceFor(page, answer, wrong = false) {
  const buttons = page.locator('#qbChoices button');
  const labels = await buttons.allTextContents();
  const index = labels.findIndex(label => wrong ? label.slice(3) !== answer : label.slice(3) === answer);
  expect(index, 'an exact answer choice exists').toBeGreaterThanOrEqual(0);
  return buttons.nth(index);
}

test('student view renders and fits the viewport', async ({ page }, info) => {
  await connectStudent(page);
  await expect(page.locator('.student-card')).toHaveCount(2);
  await expect(page.locator('body')).toHaveClass(/minecraft-mode/);
  await expect(page.locator('#settingsBtn')).toBeHidden();
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(size.scroll).toBeLessThanOrEqual(size.width + 1);
  await page.screenshot({ path: info.outputPath('student-view.png'), fullPage: true });
});

test('teacher edits, scores, changes character, adds and removes a student', async ({ page }, info) => {
  await loginTeacher(page);
  const name = page.locator('[data-name="1"]');
  await name.fill('Yeni Test İsmi');
  await name.press('Tab');
  await expect(page.locator('#lanes')).toContainText('Yeni Test İsmi');
  await page.locator('[data-add="1"]').click();
  await expect(page.locator('[data-name="1"]').locator('xpath=../..').locator('.control-score')).toContainText('1');
  await page.locator('[data-pick="1"]').click();
  await expect(page.locator('#characterOverlay')).toHaveClass(/open/);
  await page.locator('[data-char="1"][data-emoji="mc-alex"]').click();
  await page.locator('#addStudent').click();
  await expect(page.locator('.control-row')).toHaveCount(3);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-remove-student="3"]').click();
  await expect(page.locator('.control-row')).toHaveCount(2);
  await page.screenshot({ path: info.outputPath('teacher-view.png'), fullPage: true });
});

test('mock teacher accounts retain separate local rosters', async ({ page }) => {
  await loginTeacher(page, 'a');
  await page.locator('[data-name="1"]').fill('Yalnız A');
  await page.locator('[data-name="1"]').press('Tab');
  await loginTeacher(page, 'b');
  await expect(page.locator('[data-name="1"]')).toHaveValue('Öğretmen B Öğrenci 1');
  await loginTeacher(page, 'a');
  await expect(page.locator('[data-name="1"]')).toHaveValue('Yalnız A');
});

test('invalid student code keeps access dialog open', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__testCloud?.ready);
  await page.locator('#studentAccessCode').fill(`${'a'.repeat(32)}:1:WRONGCOD`);
  await page.locator('#studentAccessSubmit').click();
  await expect(page.locator('#studentAccessMessage')).toContainText('Erişim reddedildi');
  await expect(page.locator('#studentAccessOverlay')).toHaveClass(/open/);
  await expect(page.locator('#questionBankOverlay')).not.toHaveClass(/open/);
});

test('student answers correct and wrong questions; confirmed XP persists', async ({ page }) => {
  await studentQuestion(page);
  const correct = await page.evaluate(() => {
    const text = document.getElementById('qbQuestionText').textContent;
    const q = window.LOCAL_QUESTION_BANK.find(q => q.question === text);
    return q.choices[q.correctAnswer];
  });
  await (await choiceFor(page, correct)).click();
  await expect(page.locator('#qbFeedback')).toContainText('+1 XP');
  expect(await page.evaluate(() => window.__testCloud.data().studentQuestionData['a'.repeat(32)][1].xpEarned)).toBe(1);
  await page.locator('#qbNext').click();
  const nextCorrect = await page.evaluate(() => {
    const q = window.LOCAL_QUESTION_BANK.find(q => q.question === document.getElementById('qbQuestionText').textContent);
    return q.choices[q.correctAnswer];
  });
  await (await choiceFor(page, nextCorrect, true)).click();
  await expect(page.locator('#qbFeedback')).toContainText('YANLIŞ');
  expect(await page.evaluate(() => window.__testCloud.writes.filter(write => write.path.startsWith('studentQuestionData/')).length)).toBe(1);
});

test('rejected question write rolls XP back and allows retry', async ({ page }) => {
  await studentQuestion(page);
  await page.evaluate(() => { window.__testCloud.failNextSave = true; });
  const correct = await page.evaluate(() => {
    const q = window.LOCAL_QUESTION_BANK.find(q => q.question === document.getElementById('qbQuestionText').textContent);
    return q.choices[q.correctAnswer];
  });
  const answer = await choiceFor(page, correct);
  await answer.click();
  await expect(page.locator('#qbFeedback')).toContainText('XP kaydedilemedi');
  await expect(page.locator('#qbNext')).toBeHidden();
  await expect(answer).toBeEnabled();
  expect(await page.evaluate(() => window.__testCloud.writes.filter(write => write.path.startsWith('studentQuestionData/')).length)).toBe(0);
  await answer.click();
  await expect(page.locator('#qbFeedback')).toContainText('+1 XP');
});

test('student, teacher and test-mode manifests remain distinct', async ({ page, request }) => {
  const ids = [];
  for (const [url, manifest] of [['/', 'manifest-student.webmanifest'], ['/?teacher=1', 'manifest-teacher.webmanifest'], ['/?teacher=1&test=1', 'manifest-teacher-test.webmanifest']]) {
    await page.goto(url);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', './' + manifest);
    const response = await request.get('/' + manifest);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    ids.push(data.id);
    expect(data.display).toBe('standalone');
    const icon = await request.get('/' + data.icons[0].src.replace('./', ''));
    expect(icon.ok()).toBeTruthy();
  }
  expect(new Set(ids).size).toBe(3);
  await expect(page.locator('#installBtn')).toBeHidden();
});

test('local server serves a mock module and refuses real Firebase configuration', async ({ request }) => {
  const module = await request.get('/firebase.js?v=28');
  expect(module.ok()).toBeTruthy();
  const source = await module.text();
  expect(source).toContain('local-test-double');
  expect(source).not.toContain('gstatic.com');
  for (const url of ['/firebase-config.js', '/database.rules.json', '/.git/config']) {
    expect((await request.get(url)).status()).toBe(404);
  }
});
