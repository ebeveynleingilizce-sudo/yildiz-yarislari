const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { createFirebaseSdk } = require('./support/firebase-mock.js');
const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '../database.rules.json')));
const source = fs.readFileSync(path.join(__dirname, '../firebase.js'), 'utf8').replace(/import\s+[\s\S]*?from\s+"[^"]+";/g, '');
function client(search = '?teacher=1', storage = new Map()) {
  const events = [], listeners = {}, elements = new Map();
  const env = {
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    addEventListener: (name, callback) => (listeners[name] ??= []).push(callback),
    dispatchEvent: event => { events.push(event); for (const callback of listeners[event.type] || []) callback(event); },
  };
  const getElement = id => {
    if (!elements.has(id)) elements.set(id, { style: {}, value: '', classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {} });
    return elements.get(id);
  };
  const sdk = createFirebaseSdk(env, rules);
  const ctx = { ...sdk, window: env, localStorage: env.localStorage, document: { getElementById: getElement },
    location: { search, href: 'http://127.0.0.1/' + search }, URLSearchParams, URL, navigator: {}, crypto: webcrypto,
    queueMicrotask, console: { error() {}, warn() {} }, firebaseConfig: { projectId: 'local-test-only' },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } } };
  vm.runInNewContext(source, ctx);
  return { env, sdk, events, storage, ready: () => Promise.all(env.__testCloud.pending) };
}
test('removal publishes no stale roster, revokes its code, and leaves another teacher intact', async () => {
  const c = client(); await c.ready();
  await c.env.raceCloud.login('teacher-a@example.invalid', 'test-only-password');
  const before = c.env.__testCloud.data(), other = before.teacherData['teacher-b'];
  c.events.length = 0; c.env.__testCloud.writes.length = 0;
  await c.env.raceCloud.write(before.teacherData['teacher-a'].students.filter(s => s.id !== 1));
  const snapshots = c.events.filter(event => event.type === 'firebase-roster').map(event => event.detail.map(s => s.id));
  assert.ok(snapshots.length > 0);
  assert.ok(snapshots.every(ids => !ids.includes(1)), `deleted student reappeared in snapshots: ${JSON.stringify(snapshots)}`);
  const after = c.env.__testCloud.data();
  assert.equal(after.studentCredentials['a'.repeat(32)].codes[1], undefined);
  assert.equal(after.studentCodeLookup.TESTCODE, undefined);
  assert.deepEqual(after.teacherData['teacher-b'], other);
  assert.equal(c.env.__testCloud.writes.length, 1, 'one atomic roster mutation');
});
test('a student cannot read a class before connecting, or another class after connecting', async () => {
  const c = client(''); await c.ready();
  const a = 'a'.repeat(32), b = 'b'.repeat(32);
  assert.ok(c.events.some(event => event.type === 'firebase-student-access-required'));
  assert.ok(!c.events.some(event => event.type === 'firebase-roster'));
  for (const token of [a, b]) await assert.rejects(c.sdk.get(c.sdk.ref(null, `sharedRosters/${token}`)), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.env.raceCloud.authorizeStudent('', `${a}:1:WRONGCOD`), { code: 'PERMISSION_DENIED' });
  await c.env.raceCloud.authorizeStudent('', 'TESTCODE');
  assert.ok(c.events.some(event => event.type === 'firebase-account-scope' && event.detail.scope === `student-${a}-1`));
  await assert.rejects(c.sdk.get(c.sdk.ref(null, `sharedRosters/${b}`)), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.sdk.get(c.sdk.ref(null, 'teacherData/teacher-b')), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.sdk.get(c.sdk.ref(null, `studentQuestionData/${a}/2`)), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.sdk.set(c.sdk.ref(null, `studentQuestionData/${b}/1`), { xpEarned: 99 }), { code: 'PERMISSION_DENIED' });
  await c.env.raceCloud.saveQuestionProgress('1', { xpEarned: 1, solvedQuestionIds: ['q1'] });
  const reloaded = client('', c.storage); await reloaded.ready();
  assert.ok(reloaded.events.some(event => event.type === 'firebase-student-authorized' && event.detail.studentId === '1'));
  assert.equal((await reloaded.env.raceCloud.loadQuestionProgress())['1'].xpEarned, 1);
});

test('removal revokes old sessions and question writes, including after refresh', async () => {
  const teacher = client(); await teacher.ready();
  await teacher.env.raceCloud.login('teacher-a@example.invalid', 'test-only-password');
  const student = client('', teacher.storage); await student.ready();
  const token = 'a'.repeat(32);
  await student.env.raceCloud.authorizeStudent('', 'TESTCODE');
  await teacher.env.raceCloud.write(teacher.env.__testCloud.data().teacherData['teacher-a'].students.filter(s => s.id !== 1));
  await assert.rejects(student.sdk.get(student.sdk.ref(null, `sharedRosters/${token}`)), { code: 'PERMISSION_DENIED' });
  await assert.rejects(student.sdk.set(student.sdk.ref(null, `studentQuestionData/${token}/1`), { xpEarned: 99 }), { code: 'PERMISSION_DENIED' });
  await assert.rejects(student.env.raceCloud.authorizeStudent('', 'TESTCODE'), { message: 'STUDENT_CODE_INVALID' });
  const reloaded = client('', teacher.storage); await reloaded.ready();
  assert.ok(!reloaded.events.some(event => event.type === 'firebase-student-authorized'));
  assert.ok(reloaded.events.some(event => event.type === 'firebase-student-access-required'));
});

test('a rejected roster mutation restores confirmed data and preserves credentials', async () => {
  const c = client(); await c.ready();
  await c.env.raceCloud.login('teacher-a@example.invalid', 'test-only-password');
  const before = c.env.__testCloud.data(); c.events.length = 0;
  c.env.__testCloud.failNextWrite = true;
  await assert.rejects(c.env.raceCloud.write(before.teacherData['teacher-a'].students.slice(1)), { code: 'PERMISSION_DENIED' });
  assert.deepEqual(c.env.__testCloud.data(), before);
  assert.deepEqual(c.events.filter(event => event.type === 'firebase-roster').at(-1).detail.map(s => s.id), [1, 2]);
});

test('a forged teacher token cannot expose or overwrite another teacher class', async () => {
  const c = client(''); await c.ready();
  await assert.rejects(c.sdk.set(c.sdk.ref(null, 'teacherData/anonymous-test'), { shareToken: 'b'.repeat(32) }), { code: 'PERMISSION_DENIED' });
  const teacher = client(); await teacher.ready();
  await teacher.env.raceCloud.login('teacher-a@example.invalid', 'test-only-password');
  await teacher.sdk.update(teacher.sdk.ref(null, 'teacherData/teacher-a'), { shareToken: 'b'.repeat(32) });
  for (const path of [`sharedRosters/${'b'.repeat(32)}`, `studentCredentials/${'b'.repeat(32)}`, `studentQuestionData/${'b'.repeat(32)}`]) {
    await assert.rejects(teacher.sdk.get(teacher.sdk.ref(null, path)), { code: 'PERMISSION_DENIED' });
  }
  await assert.rejects(teacher.sdk.set(teacher.sdk.ref(null, `studentCredentials/${'b'.repeat(32)}`), { ownerUid: 'teacher-a', codes: { 1: 'STOLEN' } }), { code: 'PERMISSION_DENIED' });
  await assert.rejects(teacher.sdk.set(teacher.sdk.ref(null, `sharedRosters/${'b'.repeat(32)}`), { ownerUid: 'teacher-a', students: [] }), { code: 'PERMISSION_DENIED' });
});
