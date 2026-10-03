const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, 'inline application script exists');

class FakeClassList {
  values = new Set();
  add(...values) { values.forEach(value => this.values.add(value)); }
  remove(...values) { values.forEach(value => this.values.delete(value)); }
  contains(value) { return this.values.has(value); }
}
class FakeElement {
  constructor(id) {
    this.id = id;
    this.listeners = {};
    this.classList = new FakeClassList();
    this.style = {};
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
    this.runner = { style: {}, classList: new FakeClassList() };
    this.lastElementChild = { scrollIntoView() {} };
  }
  addEventListener(name, listener) { (this.listeners[name] ??= []).push(listener); }
  querySelector(selector) { return selector === '.runner-token' ? this.runner : null; }
}
class FakeCustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
}
function makeApp(search = '?teacher=1', seed = null, seen = null) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, new FakeElement(id));
    return elements.get(id);
  };
  const storage = new Map();
  if (seed) storage.set('class-race-v1', JSON.stringify(seed));
  if (seen) storage.set('class-race-v1-seen', JSON.stringify(seen));
  let writes = 0, beeps = 0, warnings = 0;
  class FakeAudioContext { constructor(){this.currentTime=0;this.destination={}} createOscillator(){return {frequency:{},connect(){},start(){beeps++},stop(){},onended:null}} createGain(){return {gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}}} close(){} }
  const ctx = {
    document: { getElementById: get, body: { classList: new FakeClassList() } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { writes++; storage.set(key, String(value)); } },
    window: { listeners: {}, AudioContext: FakeAudioContext, addEventListener(name, listener) { this.listeners[name] = listener; }, dispatchEvent(event) { this.dispatched = event; return true; } },
    CustomEvent: FakeCustomEvent,
    location: { search }, URLSearchParams, confirm: () => true, requestAnimationFrame: fn => fn(), setTimeout: () => 1,
    clearTimeout() {}, console: { warn() { warnings++; } },
  };
  vm.runInNewContext(source, ctx, { filename: 'index.html:inline-script' });
  return { ctx, get, storage, get writes(){return writes}, get beeps(){return beeps}, get warnings(){return warnings} };
}
function target(selectors) { return { dataset: selectors['[data-profile]']?.dataset, closest: selector => selectors[selector] ?? null, matches: selector => !!selectors[selector] }; }
function fire(element, name, eventTarget = target({}), extra = {}) {
  for (const listener of element.listeners[name] ?? []) listener({ target: eventTarget, ...extra });
}
function studentsOf(storage) { return JSON.parse(storage.get('class-race-v1')); }

test('inline JavaScript parses and student screen renders ten lanes', () => {
  assert.doesNotThrow(() => new vm.Script(source));
  const { get, ctx } = makeApp('');
  assert.equal((get('lanes').innerHTML.match(/class="lane"/g) ?? []).length, 10);
  assert.equal(get('studentCount').textContent, '10 ÖĞRENCİ');
  assert.ok(!ctx.document.body.classList.contains('teacher-mode'));
  assert.match(html, /Yıldız Kazanma Yolları/);
});

test('Minecraft copy is scoped to the isolated teacher test mode', () => {
  const testApp = makeApp('?teacher=1&test=1');
  assert.ok(testApp.ctx.document.body.classList.contains('minecraft-mode'));
  assert.equal(testApp.get('heroTitle').textContent, 'BLOK DÜNYA YARIŞI 🏆');
  assert.equal(testApp.get('trackTitle').textContent, '🧱 BLOK PARKURU');
  assert.equal(testApp.get('teacherPanelTitle').textContent, '🧰 Dünya yönetimi');
  assert.equal(testApp.get('addStudent').textContent, '＋ Öğrenci ekle');
  const normalApp = makeApp('?teacher=1');
  assert.ok(!normalApp.ctx.document.body.classList.contains('minecraft-mode'));
  assert.equal(normalApp.get('heroTitle').textContent, '');
});

test('Minecraft test roster uses pixel sprites for lanes, picker, teacher controls, and profiles', () => {
  const app = makeApp('?teacher=1&test=1');
  assert.match(app.get('lanes').innerHTML, /aria-label=\"Steve\"/);
  assert.match(app.get('lanes').innerHTML, /class=\"mc-sprite\"/);
  assert.match(app.get('lanes').innerHTML, /fill=\"#c58b62\"/);
  assert.match(app.get('lanes').innerHTML, /stroke=\"#172016\"/);
  assert.ok((app.get('lanes').innerHTML.match(/<rect /g) || []).length >= 10, 'pixel character has multiple colored detail blocks');
  assert.doesNotMatch(app.get('lanes').innerHTML, /fill=#[^\s\"]+\/>/);
  assert.match(app.get('studentControls').innerHTML, /aria-label=\"Halil İbrahim için Steve seç\"/);
  fire(app.get('settingsBtn'), 'click');
  fire(app.get('studentControls'), 'click', target({ '[data-pick]': { dataset: { pick: '1' } } }));
  assert.match(app.get('characterOptions').innerHTML, /Ghast/);
  assert.equal((app.get('characterOptions').innerHTML.match(/class=\"mc-sprite\"/g) || []).length, 8);
  fire(app.get('characterOptions'), 'click', target({ '[data-char]': { dataset: { char: '1', emoji: 'mc-ghast' } } }));
  assert.equal(studentsOf(app.storage)[0].emoji, 'mc-ghast');
  fire(app.get('lanes'), 'click', target({ '[data-profile]': { dataset: { profile: '1' } } }));
  assert.match(app.get('profileAvatar').innerHTML, /aria-label=\"Ghast\"/);
  assert.match(app.get('profileAvatar').innerHTML, /mc-sprite/);
});

test('teacher panel opens and a character can be selected and saved', () => {
  const { get, storage } = makeApp();
  fire(get('settingsBtn'), 'click');
  assert.ok(get('controls').classList.contains('open'));
  fire(get('studentControls'), 'click', target({ '[data-pick]': { dataset: { pick: '1' } } }));
  assert.ok(get('characterOverlay').classList.contains('open'));
  assert.match(get('characterPickerTitle').textContent, /Halil İbrahim/);
  fire(get('studentControls'), 'click', target({ '[data-add]': { dataset: { add: '1' } } }));
  assert.ok(get('characterOverlay').classList.contains('open'), 'ordinary roster refresh leaves chooser open');
  assert.doesNotMatch(get('studentControls').innerHTML, /row-character-picks/, 'chooser is rendered only once in its dialog');
  fire(get('characterOptions'), 'click', target({ '[data-char]': { dataset: { char: '1', emoji: '🦄' } } }));
  assert.equal(studentsOf(storage)[0].emoji, '🦄');
  assert.ok(!get('characterOverlay').classList.contains('open'));
});

test('teacher can add and remove students beyond the original ten', () => {
  const { get, storage } = makeApp();
  fire(get('addStudent'), 'click');
  assert.equal(studentsOf(storage).length, 11);
  assert.equal((get('lanes').innerHTML.match(/class="lane"/g) ?? []).length, 11);
  fire(get('studentControls'), 'click', target({ '[data-remove-student]': { dataset: { removeStudent: '11' } } }));
  assert.equal(studentsOf(storage).length, 10);
});

test('teacher can add, edit, deactivate, and remove star earning methods', () => {
  const { get, ctx } = makeApp();
  get('waysInput').value = '📘 | Fazladan ödev | Ek çalışma tamamla | 2 | aktif\n🎤 | İngilizce konuş | Derste İngilizce kullan | 1 | pasif';
  fire(get('saveWays'), 'click');
  assert.match(get('waysList').innerHTML, /Fazladan ödev/);
  assert.match(get('waysList').innerHTML, /\+2 yıldız/);
  assert.doesNotMatch(get('waysList').innerHTML, /İngilizce konuş/);
  assert.equal(ctx.window.dispatched.type, 'firebase-ways-save');
  assert.equal(ctx.window.dispatched.detail.length, 2);
  get('waysInput').value = '📗 | Kitap oku | Her gün oku | 3 | aktif';
  fire(get('saveWays'), 'click');
  assert.match(get('waysList').innerHTML, /Kitap oku/);
  assert.doesNotMatch(get('waysList').innerHTML, /Fazladan ödev/);
});

test('teacher accounts and student roster links use separate local storage namespaces', () => {
  const { get, storage, ctx } = makeApp();
  const original = storage.get('class-race-v1');
  ctx.window.listeners['firebase-account-scope']({ detail: { scope: 'teacher-account-a' } });
  const accountA = JSON.parse(storage.get('class-race-v1:teacher-account-a'));
  accountA[0].name = 'Hesap A';
  storage.set('class-race-v1:teacher-account-a', JSON.stringify(accountA));
  ctx.window.listeners['firebase-account-scope']({ detail: { scope: 'teacher-account-b' } });
  assert.notEqual(storage.get('class-race-v1:teacher-account-b'), storage.get('class-race-v1:teacher-account-a'));
  assert.equal(storage.get('class-race-v1'), original, 'legacy local data remains available for one-time migration');
  assert.match(get('lanes').innerHTML, /Halil İbrahim/);
});

test('stars, XP, and lifetime-star totals update correctly', () => {
  const { get, storage } = makeApp();
  fire(get('studentControls'), 'click', target({ '[data-add]': { dataset: { add: '1' } } }));
  assert.deepEqual([studentsOf(storage)[0].stars, studentsOf(storage)[0].xp, studentsOf(storage)[0].lifetimeStars], [1, 1, 1]);
  fire(get('studentControls'), 'click', target({ '[data-sub]': { dataset: { sub: '1' } } }));
  assert.deepEqual([studentsOf(storage)[0].stars, studentsOf(storage)[0].xp, studentsOf(storage)[0].lifetimeStars], [0, 1, 1]);
});

test('student roster names are saved and reflected on the race screen', () => {
  const { get, storage } = makeApp();
  const input = { dataset: { name: '1' }, value: 'Deneme Öğrenci', matches: selector => selector === '[data-name]' };
  fire(get('studentControls'), 'change', input);
  assert.equal(studentsOf(storage)[0].name, 'Deneme Öğrenci');
  assert.match(get('lanes').innerHTML, /Deneme Öğrenci/);
});

test('storage events refresh student view when another tab updates stars', () => {
  const { get, storage, ctx } = makeApp('');
  const data = studentsOf(storage);
  data[0].stars = 3;
  storage.set('class-race-v1', JSON.stringify(data));
  ctx.window.listeners.storage({ key: 'class-race-v1' });
  assert.match(get('lanes').innerHTML, /⭐ 3 yıldız/);
  assert.match(get('lanes').innerHTML, /3\/30/);
});

test('responsive CSS and essential dialog controls are present', () => {
  assert.match(html, /@media\(max-width:1000px\)/);
  assert.match(html, /@media\(max-width:650px\)/);
  assert.match(html, /@media\(max-width:420px\)/);
  assert.match(html, /id="characterClose"/);
  assert.match(html, /id="profileClose"/);
  assert.doesNotMatch(html, /String\(i\+1\)\.padStart\(2/);
  assert.match(html, /\(i\+1\)\+'\.'/);
});

test('star updates animate runners on this tab and on storage synchronization', () => {
  const { get, storage, ctx } = makeApp();
  fire(get('studentControls'), 'click', target({ '[data-add]': { dataset: { add: '1' } } }));
  assert.ok(get('lane-1').classList.contains('runner'), 'local award starts runner motion');
  get('lane-1').classList.remove('runner');
  const data = studentsOf(storage); data[0].stars = 4; storage.set('class-race-v1', JSON.stringify(data));
  ctx.window.listeners.storage({ key: 'class-race-v1' });
  assert.ok(get('lane-1').classList.contains('runner'), 'another tab update starts runner motion');
});

test('new race preserves lifetime progress; full reset clears it', () => {
  const { get, storage } = makeApp();
  for (let n = 0; n < 2; n++) fire(get('studentControls'), 'click', target({ '[data-add]': { dataset: { add: '1' } } }));
  fire(get('restartRace'), 'click');
  assert.deepEqual([studentsOf(storage)[0].stars, studentsOf(storage)[0].xp, studentsOf(storage)[0].lifetimeStars], [0, 2, 2]);
  fire(get('studentControls'), 'click', target({ '[data-add]': { dataset: { add: '1' } } }));
  fire(get('resetStars'), 'click');
  assert.deepEqual([studentsOf(storage)[0].stars, studentsOf(storage)[0].xp, studentsOf(storage)[0].lifetimeStars], [0, 0, 0]);
});

test('profile shows the correct top title, career stars, and earned badges', () => {
  const record = [{ id: 1, name: 'Uzman', emoji: '🐱', stars: 30, xp: 100, lifetimeStars: 30 }];
  const { get } = makeApp('?teacher=1', record);
  fire(get('lanes'), 'click', target({ '[data-profile]': { dataset: { profile: '1' } } }));
  assert.equal(get('profileTitle').textContent, 'Uzman Öğrenci');
  assert.equal(get('profileStars').textContent, 30);
  assert.match(get('profileBadges').innerHTML, /Şampiyon/);
  assert.match(get('xpCaption').textContent, /en yüksek seviye/i);
});

test('malformed saved student records are discarded without replacing valid students', () => {
  const records = [null, { id: 2, name: 'Kayıtlı', emoji: '<img src=x>', stars: 'NaN', xp: 4 }];
  const { get, storage } = makeApp('?teacher=1', records);
  assert.equal(studentsOf(storage).length, 1);
  assert.equal(studentsOf(storage)[0].name, 'Kayıtlı');
  assert.equal(studentsOf(storage)[0].emoji, '🐱');
  assert.equal(studentsOf(storage)[0].stars, 0);
  assert.match(get('lanes').innerHTML, /Kayıtlı/);
  assert.doesNotMatch(get('lanes').innerHTML, /<img src=x>/);
});

test('student reopens with unseen progress and gets an animated runner', () => {
  const record = [{ id: 1, name: 'Halil İbrahim', emoji: '🐱', stars: 3, xp: 3, lifetimeStars: 3 }];
  const app = makeApp('', record, { '1': { stars: 1 } }), { get, storage } = app;
  assert.ok(get('lane-1').classList.contains('runner'));
  assert.equal(get('lane-1').runner.style.left, '9.2%');
  assert.match(get('toast').textContent, /Son ziyaretinden beri/);
  assert.equal(app.beeps, 1, 'reopening after progress attempts one sound');
  assert.ok(storage.has('class-race-v1-seen'));
});

test('student hears a sound for each progress update', () => {
  const record = [{ id: 1, name: 'Halil İbrahim', emoji: '🐱', stars: 29, xp: 29, lifetimeStars: 29 }];
  const app = makeApp('', record), { storage, ctx } = app;
  assert.equal(app.beeps, 0, 'teacher awards do not play on teacher page when no crossing event occurs');
  const data = studentsOf(storage); data[0].stars = 30; storage.set('class-race-v1', JSON.stringify(data));
  ctx.window.listeners.storage({ key: 'class-race-v1' });
  assert.equal(app.beeps, 1);
  data[0].stars = 31; storage.set('class-race-v1', JSON.stringify(data));
  ctx.window.listeners.storage({ key: 'class-race-v1' });
  assert.equal(app.beeps, 2);
});

test('student storage refresh does not echo the roster back into other tabs', () => {
  const app = makeApp(''); const { storage, ctx } = app; const before = app.writes;  
  const data = studentsOf(storage); data[0].stars = 2; storage.set('class-race-v1', JSON.stringify(data));
  ctx.window.listeners.storage({ key: 'class-race-v1' });
  
  assert.equal(storage.get('class-race-v1'), JSON.stringify(data));
  assert.equal(app.writes, before + 1, 'only the seen snapshot is saved, preventing roster echo');
});

test('subtracting a star at zero does not change XP or stored history', () => {
  const { get, storage } = makeApp();
  fire(get('studentControls'), 'click', target({ '[data-sub]': { dataset: { sub: '1' } } }));
  assert.deepEqual([studentsOf(storage)[0].stars, studentsOf(storage)[0].xp, studentsOf(storage)[0].lifetimeStars], [0, 0, 0]);
  assert.match(get('toast').textContent, /Çıkarılacak/);
});

test('canceling removal and trying to remove the last student preserve the roster', () => {
  const { get, storage, ctx } = makeApp();
  ctx.confirm = () => false;
  fire(get('studentControls'), 'click', target({ '[data-remove-student]': { dataset: { removeStudent: '1' } } }));
  assert.equal(studentsOf(storage).length, 10);
  const single = [{ id: 7, name: 'Tek öğrenci', emoji: '🐱', stars: 0, xp: 0 }];
  const app = makeApp('?teacher=1', single);
  fire(app.get('studentControls'), 'click', target({ '[data-remove-student]': { dataset: { removeStudent: '7' } } }));
  assert.equal(studentsOf(app.storage).length, 1);
  assert.match(app.get('toast').textContent, /en az bir öğrenci/);
});

test('duplicate IDs and invalid emojis in saved data are normalized safely', () => {
  const records = [
    { id: 1, name: 'Bir', emoji: '🐱', stars: 2, xp: 2 },
    { id: 1, name: '<b>İki</b>', emoji: '<svg>', stars: 3, xp: 3 },
  ];
  const { get, storage } = makeApp('?teacher=1', records);
  const saved = studentsOf(storage);
  assert.equal(saved.length, 2);
  assert.notEqual(saved[0].id, saved[1].id);
  assert.equal(saved[1].emoji, '🐰', 'invalid emoji falls back to that roster position default');
  assert.match(get('lanes').innerHTML, /&lt;b&gt;İki&lt;\/b&gt;/);
  assert.doesNotMatch(get('lanes').innerHTML, /<b>İki<\/b>/);
});

test('teacher storage event refreshes roster and control rows in another teacher tab', () => {
  const { get, storage, ctx } = makeApp('?teacher=1');
  const data = studentsOf(storage);
  data[0].name = 'Sekmeden Güncel'; data.push({ id: 11, name: 'Ek Öğrenci', emoji: '🦄', stars: 0, xp: 0, lifetimeStars: 0 });
  storage.set('class-race-v1', JSON.stringify(data));
  ctx.window.listeners.storage({ key: 'class-race-v1' });
  assert.match(get('lanes').innerHTML, /Sekmeden Güncel/);
  assert.equal((get('studentControls').innerHTML.match(/class="control-row"/g) ?? []).length, 11);
});

test('settings, sound, profile keyboard, and close controls respond', () => {
  const { get } = makeApp('?teacher=1');
  fire(get('soundBtn'), 'click');
  assert.equal(get('soundBtn').textContent, '🔇');
  fire(get('soundBtn'), 'click');
  assert.equal(get('soundBtn').textContent, '🔊');
  fire(get('lanes'), 'keydown', target({ '[data-profile]': { dataset: { profile: '1' } } }), { key: 'Enter', preventDefault(){} });
  assert.ok(get('profileOverlay').classList.contains('open'));
  fire(get('profileClose'), 'click');
  assert.ok(!get('profileOverlay').classList.contains('open'));
  fire(get('settingsBtn'), 'click');
  fire(get('closeBtn'), 'click');
  assert.ok(!get('controls').classList.contains('open'));
});

test('HTML structure, static IDs, JavaScript references, and CSS delimiters are consistent', () => {
  const markup = html.replace(/<script>[\s\S]*?<\/script>/, '').replace(/<style>[\s\S]*?<\/style>/, '');
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'static HTML ids must be unique');
  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const stack = [];
  for (const match of markup.matchAll(/<\/?([A-Za-z][\w:-]*)(?:\s[^<>]*?)?\s*\/?>/g)) {
    const token = match[0], tag = match[1].toLowerCase();
    if (token.startsWith('</')) assert.equal(stack.pop(), tag, `closing tag ${tag} matches its opener`);
    else if (!voidTags.has(tag) && !token.endsWith('/>')) stack.push(tag);
  }
  assert.deepEqual(stack, [], 'all non-void HTML tags are closed');
  const refs = [...source.matchAll(/\$\('([A-Za-z][\w-]*)'\)/g)].map(match => match[1]);
  for (const id of new Set(refs)) assert.ok(ids.includes(id), `script reference ${id} exists in HTML`);
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  assert.match(css, /prefers-reduced-motion/);
  const open = (css.match(/{/g) ?? []).length, close = (css.match(/}/g) ?? []).length;
  assert.equal(open, close, 'CSS block braces balance');
});

test('failed local storage writes do not crash the page and are disclosed', () => {
  const app = makeApp(); const { ctx, get } = app;
  ctx.localStorage.setItem = () => { throw new Error('quota denied'); };
  assert.doesNotThrow(() => fire(get('studentControls'), 'click', target({ '[data-add]': { dataset: { add: '1' } } })));
  assert.match(get('lanes').innerHTML, /⭐ 1 yıldız/);
  assert.match(get('toast').textContent, /Bu cihazda kaydedilemedi/);
  assert.equal(app.warnings, 1);
});

test('Firebase config and rules isolate private teacher accounts and expose only shared rosters', () => {
  const config = fs.readFileSync(path.join(__dirname, '..', 'firebase-config.js'), 'utf8');
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
  const firebase = fs.readFileSync(path.join(__dirname, '..', 'firebase.js'), 'utf8');
  assert.match(config, /projectId:\s*"yildizyarislari"/);
  assert.match(config, /databaseURL:\s*"https:\/\/yildizyarislari-default-rtdb\.europe-west1\.firebasedatabase\.app"/);
  assert.equal(rules.rules['.read'], false, 'root listing and reads are denied');
  assert.equal(rules.rules['.write'], false, 'root writes are denied');
  assert.equal(rules.rules.teacherData['$uid']['.read'], 'auth != null && auth.uid === $uid');
  assert.equal(rules.rules.teacherData['$uid']['.write'], 'auth != null && auth.uid === $uid');
  assert.equal(rules.rules.sharedRosters['$token']['.read'], 'auth != null');
  assert.match(rules.rules.sharedRosters['$token']['.write'], /auth\.uid === newData\.child\('ownerUid'\)\.val\(\)/);
  assert.equal(rules.rules['class-race'].defaultRosterToken['.read'], 'auth != null');
  assert.equal(rules.rules['class-race'].students['.read'], "auth != null && auth.token.email === 'tunc@test.com'");
  assert.match(firebase, /signInAnonymously/);
  assert.match(firebase, /signInWithEmailAndPassword/);
  assert.match(firebase, /signInWithPopup/);
  assert.match(firebase, /const teacherCollection = testMode \? "testTeacherData" : "teacherData"/);
  assert.match(firebase, /\$\{teacherCollection\}\/\$\{teacherUid\}/);
  assert.match(firebase, /sharedRosters\/\$\{token\}/);
  assert.match(firebase, /if \(Object\.hasOwn\(data, "students"\)\) sharedUpdate\.students = data\.students/);
  assert.match(firebase, /if \(Object\.hasOwn\(data, "ways"\)\) sharedUpdate\.ways = data\.ways/);
  assert.match(firebase, /inMemoryPersistence/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'), /database\.rules\.json/);
});

test('Minecraft teacher test mode has its own Firebase data and install identity', () => {
  const firebase = fs.readFileSync(path.join(__dirname, '..', 'firebase.js'), 'utf8');
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest-teacher-test.webmanifest'), 'utf8'));
  const studentManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest-student.webmanifest'), 'utf8'));
  const teacherManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest-teacher.webmanifest'), 'utf8'));
  assert.match(html, /viewParams\.has\('teacher'\)&&viewParams\.get\('test'\)==='1'\)document\.body\.classList\.add\('minecraft-mode'\)/);
  assert.match(firebase, /testTeacherData/);
  assert.match(firebase, /if \(testMode\) \{\s*await Promise\.all\(updates\);\s*return;/);
  assert.equal(rules.rules.testTeacherData['$uid']['.read'], 'auth != null && auth.uid === $uid');
  assert.equal(rules.rules.testTeacherData['$uid']['.write'], 'auth != null && auth.uid === $uid');
  assert.equal(new Set([manifest.id, studentManifest.id, teacherManifest.id]).size, 3, 'the test install ID does not overlap the production apps');
  assert.equal(manifest.start_url, './?teacher=1&test=1');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'pwa.js'), 'utf8'), /manifest-teacher-test\.webmanifest/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8'), /manifest-teacher-test\.webmanifest/);
});
