const { test, expect, loginTeacher } = require('./fixtures.cjs');

test('repeated removals retain surviving controls, worlds and running animations through Firebase echoes', async ({ page }) => {
  await loginTeacher(page);
  for (let i = 0; i < 4; i++) {
    await page.locator('#addStudent').click();
    await expect(page.locator('.control-row')).toHaveCount(3 + i);
  }
  // Allow pending mock Firebase writes to finish before observing deletion.
  await expect.poll(() => page.evaluate(() => window.__testCloud.data().teacherData['teacher-a'].students.length)).toBe(6);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => {
    const lane = document.getElementById('lane-6');
    window.survivor = {
      lane, world: lane.querySelector('.game-world'), runner: lane.querySelector('.runner-token'),
      sprite: lane.querySelector('.runner-token svg'),
      row: document.querySelector('[data-name="6"]').closest('.control-row'),
      input: document.querySelector('[data-name="6"]'),
      animations: lane.getAnimations({ subtree: true }).map(animation => ({ animation, startTime: animation.startTime })),
      removed: [], frames: [],
    };
    window.removalObserver = new MutationObserver(records => {
      for (const record of records) for (const node of record.removedNodes)
        if (node.nodeType === 1 && Object.values(window.survivor).some(value => value instanceof Node && (node === value || node.contains(value)))) window.survivor.removed.push(node.nodeName);
    });
    window.removalObserver.observe(document.querySelector('.app'), { childList: true, subtree: true });
    const sample = () => {
      window.survivor.frames.push(window.survivor.world.isConnected && window.survivor.row.isConnected &&
        !document.querySelector('.app').hidden && getComputedStyle(window.survivor.lane).display !== 'none');
      window.removalFrame = requestAnimationFrame(sample);
    };
    sample();
  });
  for (const [index, id] of ['1', '2', '3'].entries()) {
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-remove-student="' + id + '"]').click();
    await expect(page.locator('.control-row')).toHaveCount(5 - index);
    await expect.poll(() => page.evaluate(() => window.__testCloud.data().teacherData['teacher-a'].students.length)).toBe(5 - index);
    // Same roster may arrive again through another Firebase delivery.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('firebase-roster', {
      detail: window.__testCloud.data().teacherData['teacher-a'].students,
    })));
    await expect(page.locator('#lane-' + id)).toHaveCount(0);
    expect(await page.evaluate(() => {
      const s = window.survivor, lane = document.getElementById('lane-6');
      return {
        same: s.lane === lane && s.world === lane.querySelector('.game-world') &&
          s.runner === lane.querySelector('.runner-token') && s.sprite === lane.querySelector('.runner-token svg') &&
          s.row === document.querySelector('[data-name="6"]').closest('.control-row') &&
          s.input === document.querySelector('[data-name="6"]'),
        removed: s.removed, uninterrupted: s.frames.every(Boolean),
        animations: s.animations.every(({ animation, startTime }) => animation.playState !== 'idle' && animation.startTime === startTime), details: s.animations.filter(({ animation, startTime }) => animation.playState === 'idle' || animation.startTime !== startTime).map(({ animation, startTime }) => ({ name: animation.animationName, state: animation.playState, before: startTime, after: animation.startTime })),
      };
    })).toEqual({ same: true, removed: [], uninterrupted: true, animations: true, details: [] });
  }
  await page.evaluate(() => { cancelAnimationFrame(window.removalFrame); window.removalObserver.disconnect(); });
});

test('rapid consecutive removals do not resurrect deleted rows while writes are queued', async ({ page }) => {
  await loginTeacher(page);
  for (let i=0;i<4;i++) {
    await page.locator('#addStudent').click();
    await expect(page.locator('.control-row')).toHaveCount(3+i);
  }
  await expect.poll(() => page.evaluate(() => window.__testCloud.data().teacherData['teacher-a'].students.length)).toBe(6);
  await page.evaluate(() => {
    window.__rapidLane = document.getElementById('lane-6');
    window.__rapidRunner = window.__rapidLane.querySelector('.runner-token');
    window.__rapidRow = document.querySelector('[data-name="6"]').closest('.control-row');
    window.__rapidEchoes = [];
    window.addEventListener('firebase-roster', event => window.__rapidEchoes.push(event.detail.map(s => s.id)));
    window.confirm = () => true;
    for (const id of [1,2,3]) document.querySelector('[data-remove-student="'+id+'"]').click();
  });
  await expect.poll(() => page.evaluate(() => window.__testCloud.data().teacherData['teacher-a'].students.length)).toBe(3);
  await expect(page.locator('.control-row')).toHaveCount(3);
  expect(await page.evaluate(() => ({
    lane: window.__rapidLane === document.getElementById('lane-6'),
    runner: window.__rapidRunner === document.getElementById('lane-6').querySelector('.runner-token'),
    row: window.__rapidRow === document.querySelector('[data-name="6"]').closest('.control-row'),
    noStaleEcho: window.__rapidEchoes.length > 0 && window.__rapidEchoes.every(ids => ids.every(id => id > 3)),
    noResurrection: [1,2,3].every(id => !document.getElementById('lane-'+id)),
  }))).toEqual({ lane:true,runner:true,row:true,noStaleEcho:true,noResurrection:true });
});
