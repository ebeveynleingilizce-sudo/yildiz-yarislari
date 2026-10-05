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
  assert.deepEqual(after.teacherData['teacher-b'], other);
  const rosterCommits = c.env.__testCloud.writes.filter(write => Object.keys(write.updates).some(path => /\/classData\/[^/]+\/students$/.test(path)));
  assert.equal(rosterCommits.length, 1, 'one authoritative roster commit');
  assert.ok(Object.keys(rosterCommits[0].updates).includes('studentCredentials/TESTCODE'), 'revocation accompanies the roster commit');
  assert.deepEqual(after.studentCredentials.TESTCODE.codes, {});
  assert.deepEqual(after.sharedRosters.TESTCODE.students, []);
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

test('rapid queued removals never publish an intermediate older roster', async () => {
  const c = client(); await c.ready();
  await c.env.raceCloud.login('teacher-a@example.invalid', 'test-only-password');
  const initial = c.env.__testCloud.data().teacherData['teacher-a'].students;
  const roster = [...initial, ...[3,4].map(id => ({...initial[0], id, name:'Test '+id}))];
  await c.env.raceCloud.write(roster);
  c.events.length = 0;
  await Promise.all([1,2,3].map(id => c.env.raceCloud.write(roster.filter(s => s.id > id))));
  const snapshots = c.events.filter(event => event.type === 'firebase-roster').map(event => event.detail.map(s => s.id));
  assert.ok(snapshots.length > 0);
  assert.ok(snapshots.every(ids => ids.length === 1 && ids[0] === 4), JSON.stringify(snapshots));
});
