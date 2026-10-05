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

test('legacy migration recovers when the transaction first receives a null snapshot',async()=>{
 const c=client();await c.ready();c.env.__testCloud.transactionNullOnce=true;
 await c.env.raceCloud.login('tunc@test.com','test-only-password');
 const migrated=c.env.__testCloud.data().teacherData['teacher-a'];
 assert.equal(migrated.classSchemaVersion,1);assert.ok(migrated.classData[migrated.defaultClassId]);
});
test('legacy migration preserves codes, student IDs, XP and seasons and is idempotent',async()=>{
 const c=client();await c.ready();const original=c.env.__testCloud.data().teacherData['teacher-a'];
 await c.env.raceCloud.login('tunc@test.com','test-only-password');
 const migrated=c.env.__testCloud.data().teacherData['teacher-a'],id=migrated.defaultClassId;
 assert.deepEqual(migrated.legacyStudentsBackup,original.students);
 assert.deepEqual(migrated.classData[id].seasons,original.seasons);
 assert.deepEqual(migrated.classData[id].studentAccessCodes,original.studentAccessCodes);
 assert.ok(migrated.classData[id].students.every(s=>s.teacherId==='teacher-a'&&s.classId===id));
 await c.env.raceCloud.logout();await c.env.raceCloud.login('tunc@test.com','test-only-password');
 assert.equal(c.env.__testCloud.data().teacherData['teacher-a'].defaultClassId,id);
});
test('class tokens isolate classmates and progress; moves preserve XP and revoke old codes',async()=>{
 const c=client();await c.ready();await c.env.raceCloud.login('tunc@test.com','test-only-password');
 const initial=c.env.__testCloud.data().teacherData['teacher-a'],a=initial.defaultClassId;
 await c.env.raceCloud.renameClass(a,'5/A');
 await c.env.raceCloud.write([{id:1,name:'Ahmet',stars:7,xp:12,lifetimeStars:22,emoji:'mc-steve'},{id:2,name:'Mehmet',stars:2,xp:3,lifetimeStars:8,emoji:'mc-alex'}]);
 const b=await c.env.raceCloud.createClass('6/B');await c.env.raceCloud.write([{id:1,name:'Ayşe',stars:0,xp:0,lifetimeStars:0,emoji:'mc-alex'},{id:2,name:'Zeynep',stars:0,xp:0,lifetimeStars:0,emoji:'mc-steve'}]);
 const data=c.env.__testCloud.data().teacherData['teacher-a'],tokenA=data.classes[a].shareToken;
 const student=client('',c.storage);await student.ready();await student.env.raceCloud.authorizeStudent('',tokenA+':1:'+data.classData[a].studentAccessCodes[1]);
 await assert.rejects(student.sdk.get(student.sdk.ref(null,'sharedRosters/'+b.shareToken)),{code:'PERMISSION_DENIED'});
 await assert.rejects(student.sdk.get(student.sdk.ref(null,'teacherData/teacher-a/classData/'+b.classId)),{code:'PERMISSION_DENIED'});
 await student.env.raceCloud.saveQuestionProgress('1',{xpEarned:4,solvedQuestionIds:['q1','q2','q3','q4'],testHistory:[{id:'old-test'}]});
 await c.env.raceCloud.selectClass(a);const movedId=await c.env.raceCloud.moveStudent('1',b.classId);
 const moved=c.env.__testCloud.data();const record=moved.teacherData['teacher-a'].classData[b.classId].students.find(s=>s.name==='Ahmet');
 assert.equal(record.stars,7);assert.equal(record.xp,12);assert.equal(record.lifetimeStars,22);assert.notEqual(movedId,1);
 assert.equal(moved.studentQuestionData[b.shareToken][movedId].xpEarned,4);
 await assert.rejects(student.sdk.get(student.sdk.ref(null,'sharedRosters/'+tokenA)),{code:'PERMISSION_DENIED'});
 await assert.rejects(c.env.raceCloud.deleteClass(b.classId),/taşınacağı/);
 await c.env.raceCloud.deleteClass(b.classId,a);
 const after=c.env.__testCloud.data().teacherData['teacher-a'];
 assert.equal(after.classData[a].students.length,4);
 assert.ok(after.classArchives[b.classId]);assert.ok(!after.classes[b.classId]);
});
test('another teacher may use the same class name without reading or mutating the first teacher',async()=>{
 const c=client();await c.ready();await c.env.raceCloud.login('teacher-a@example.invalid','test-only-password');
 const a=await c.env.raceCloud.createClass('5/A');
 await c.env.raceCloud.logout();await c.env.raceCloud.login('teacher-b@example.invalid','test-only-password');
 const b=await c.env.raceCloud.createClass('5/A');assert.notEqual(a.classId,b.classId);assert.notEqual(a.shareToken,b.shareToken);
 await assert.rejects(c.sdk.get(c.sdk.ref(null,'teacherData/teacher-a/classData/'+a.classId)),{code:'PERMISSION_DENIED'});
 await assert.rejects(c.sdk.update(c.sdk.ref(null,'sharedRosters/'+a.shareToken),{ownerUid:'teacher-b'}),{code:'PERMISSION_DENIED'});
});
