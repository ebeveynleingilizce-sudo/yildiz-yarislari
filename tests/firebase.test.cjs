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
test('a short code publishes a private one-student roster; removal revokes it without affecting another teacher', async () => {
  const c = client(); await c.ready();
  await c.env.raceCloud.login('teacher-a@example.invalid', 'test-only-password');
  const before = c.env.__testCloud.data(), other = before.teacherData['teacher-b'];
  const cls = before.teacherData['teacher-a'], classId = cls.defaultClassId;
  assert.equal(before.sharedRosters.TESTCODE.students.length, 1);
  assert.equal(before.sharedRosters.TESTCODE.students[0].name, 'Test Öğrenci A');
  assert.equal(before.sharedRosters.TESTCODE.students[0].id, '1');
  assert.equal(before.studentCredentials.TESTCODE.codes['1'], 'TESTCODE');
  assert.equal(before.teacherData['teacher-a'].classTokens.TESTCODE, classId);
  c.events.length = 0;
  const roster = cls.classData[classId].students.filter(student => student.id !== 1);
  await c.env.raceCloud.write(roster);
  const snapshots = c.events.filter(event => event.type === 'firebase-roster').map(event => event.detail.map(student => student.id));
  assert.ok(snapshots.length > 0);
  assert.ok(snapshots.every(ids => !ids.includes(1)), `removed student reappeared: ${JSON.stringify(snapshots)}`);
  const after = c.env.__testCloud.data();
  assert.deepEqual(after.studentCredentials.TESTCODE.codes, {});
  assert.deepEqual(after.sharedRosters.TESTCODE.students, []);
  assert.equal(after.teacherData['teacher-a'].classTokens.TESTCODE, classId);
  assert.deepEqual(after.teacherData['teacher-b'], other);
  assert.equal(after.teacherData['teacher-a'].classData[classId].students.length, 1);
});

test('a clean anonymous student enters by short code only and cannot read other students or classes', async () => {
  const c = client(''); await c.ready();
  assert.ok(c.events.some(event => event.type === 'firebase-student-access-required'));
  assert.ok(!c.events.some(event => event.type === 'firebase-roster'));
  await assert.rejects(c.sdk.get(c.sdk.ref(null, 'sharedRosters')), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.sdk.get(c.sdk.ref(null, 'studentCodeLookup')), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.env.raceCloud.authorizeStudent('', 'NOPECODE'), { message: 'STUDENT_CODE_INVALID' });
  await c.env.raceCloud.authorizeStudent('', 'TESTCODE');
  assert.ok(c.events.some(event => event.type === 'firebase-account-scope' && event.detail.scope === 'student-TESTCODE'));
  const rosterEvent = c.events.filter(event => event.type === 'firebase-roster').at(-1);
  assert.equal(rosterEvent.detail.length, 1);
  assert.equal(rosterEvent.detail[0].name, 'Test Öğrenci A');
  await assert.rejects(c.sdk.get(c.sdk.ref(null, 'sharedRosters/BCODEONE')), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.sdk.get(c.sdk.ref(null, 'teacherData/teacher-b')), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.sdk.get(c.sdk.ref(null, 'studentQuestionData/TESTCODE/2')), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.sdk.set(c.sdk.ref(null, 'studentQuestionData/BCODEONE/1'), { xpEarned: 99 }), { code: 'PERMISSION_DENIED' });
  await c.env.raceCloud.saveQuestionProgress('1', { xpEarned: 1, solvedQuestionIds: ['q1'] });
  const reloaded = client('', c.storage); await reloaded.ready();
  assert.ok(reloaded.events.some(event => event.type === 'firebase-student-authorized' && event.detail.studentId === '1'));
  assert.equal((await reloaded.env.raceCloud.loadQuestionProgress())['1'].xpEarned, 1);
});

test('removing a student revokes the old code session and question writes after refresh', async () => {
  const teacher = client(); await teacher.ready();
  await teacher.env.raceCloud.login('teacher-a@example.invalid', 'test-only-password');
  const student = client('', teacher.storage); await student.ready();
  await student.env.raceCloud.authorizeStudent('', 'TESTCODE');
  const teacherRecord = teacher.env.__testCloud.data().teacherData['teacher-a'];
  const roster = teacherRecord.classData[teacherRecord.defaultClassId].students.filter(item => item.id !== 1);
  await teacher.env.raceCloud.write(roster);
  await assert.rejects(student.sdk.get(student.sdk.ref(null, 'sharedRosters/TESTCODE')), { code: 'PERMISSION_DENIED' });
  await assert.rejects(student.sdk.set(student.sdk.ref(null, 'studentQuestionData/TESTCODE/1'), { xpEarned: 99 }), { code: 'PERMISSION_DENIED' });
  await assert.rejects(student.env.raceCloud.authorizeStudent('', 'TESTCODE'), { message: 'STUDENT_CODE_INVALID' });
  const reloaded = client('', teacher.storage); await reloaded.ready();
  assert.ok(!reloaded.events.some(event => event.type === 'firebase-student-authorized'));
  assert.ok(reloaded.events.some(event => event.type === 'firebase-student-access-required'));
});

test('a rejected roster mutation keeps the previously confirmed roster and short-code records', async () => {
  const c = client(); await c.ready();
  await c.env.raceCloud.login('teacher-a@example.invalid', 'test-only-password');
  const before = c.env.__testCloud.data();
  c.env.__testCloud.failNextWrite = true;
  await assert.rejects(c.env.raceCloud.write(before.teacherData['teacher-a'].classData[before.teacherData['teacher-a'].defaultClassId].students.slice(1)), { code: 'PERMISSION_DENIED' });
  assert.deepEqual(c.env.__testCloud.data(), before);
});

test('a code collision with another teacher retries without overwriting their student', async () => {
  const storage = new Map();
  const teacherB = client('?teacher=1', storage); await teacherB.ready();
  await teacherB.env.raceCloud.login('teacher-b@example.invalid', 'test-only-password');
  const teacherA = client('?teacher=1', storage); await teacherA.ready();
  await teacherA.env.raceCloud.login('teacher-a@example.invalid', 'test-only-password');
  const account = teacherA.env.__testCloud.data().teacherData['teacher-a'];
  const classId = account.defaultClassId, classPath = `teacherData/teacher-a/classData/${classId}`;
  await teacherA.sdk.update(teacherA.sdk.ref(null, classPath + '/studentAccessCodes'), { 1: 'BCODEONE' });
  const changed = account.classData[classId].students.map(student => ({ ...student, name: student.id === 1 ? student.name + ' Updated' : student.name }));
  await teacherA.env.raceCloud.write(changed);
  const data = teacherA.env.__testCloud.data();
  assert.notEqual(data.teacherData['teacher-a'].classData[classId].studentAccessCodes['1'], 'BCODEONE');
  assert.equal(data.sharedRosters.BCODEONE.students[0].name, 'Öğretmen B Öğrenci 1');
  assert.equal(data.studentCredentials.BCODEONE.codes['1'], 'BCODEONE');
});

test('student entry has no special-link UI or query dependency', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /id="studentAccessCode"/);
  assert.doesNotMatch(html, /studentAccessName|studentAccessName/);
  assert.doesNotMatch(html, /firebase-share-link|firebase-share-copy|data-copy-student-link|Bağlantıyı kopyala/);
  assert.doesNotMatch(source, /studentCodeLookup|requestedRoster|getShareUrl|firebase-share-copy/);
});

test('short-code paths remain private to the owning teacher and are not an enumerable lookup', async () => {
  const c = client(''); await c.ready();
  await c.env.raceCloud.authorizeStudent('', 'TESTCODE');
  await assert.rejects(c.sdk.get(c.sdk.ref(null, 'sharedRosters/OTHER?')), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.sdk.set(c.sdk.ref(null, 'studentSessions/TESTCODE/anonymous-test'), { studentId: '2', accessCode: 'TESTCODE' }), { code: 'PERMISSION_DENIED' });
  await assert.rejects(c.sdk.get(c.sdk.ref(null, 'studentCredentials/TESTCODE')), { code: 'PERMISSION_DENIED' });
});
