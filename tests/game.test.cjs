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
    this._innerHTML = '';
    this.value = '';
    this.runner = { style: {}, classList: new FakeClassList() };
    this.lastElementChild = { scrollIntoView() {} };
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(value) {
    this._innerHTML = String(value);
    this.choiceButtons = [...this._innerHTML.matchAll(/<button[^>]*data-answer="(\d+)"[^>]*>([\s\S]*?)<\/button>/g)]
      .map(match => ({ dataset: { answer: match[1] }, label: match[2], disabled: false, classList: new FakeClassList() }));
  }
  addEventListener(name, listener) { (this.listeners[name] ??= []).push(listener); }
  querySelector(selector) { return selector === '.runner-token' ? this.runner : null; }
  querySelectorAll(selector) { return selector === '.qb-choice' ? (this.choiceButtons ?? []) : []; }
  setAttribute(name, value) { this[name] = value; }
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
async function fireAsync(element, name, eventTarget = target({}), extra = {}) {
  for (const listener of element.listeners[name] ?? []) await listener({ target: eventTarget, ...extra });
}
function studentsOf(storage) { return JSON.parse(storage.get('class-race-v1')); }

test('inline JavaScript parses and a new student is gated behind connection', () => {
  assert.doesNotThrow(() => new vm.Script(source));
  const { get, ctx } = makeApp('');
  assert.equal((get('lanes').innerHTML.match(/class="lane student-card"/g) ?? []).length, 0);
  assert.equal(get('raceApp').hidden, true);
  assert.ok(get('studentAccessOverlay').classList.contains('open'));
  assert.equal(get('studentCount').textContent, '0 OYUNCU');
  assert.ok(ctx.document.body.classList.contains('minecraft-mode'));
  assert.ok(!ctx.document.body.classList.contains('teacher-mode'));
  assert.match(html, /Yıldız Kazanma Yolları/);
});

test('Minecraft presentation is the default for teacher and student apps', () => {
  const testApp = makeApp('?teacher=1&test=1');
  assert.ok(testApp.ctx.document.body.classList.contains('minecraft-mode'));
  assert.equal(testApp.get('heroTitle').textContent, 'BLOK DÜNYA YARIŞI');
  assert.equal(testApp.get('brandName').textContent, 'BLOK YARIŞI');
  assert.equal(testApp.get('heroTagline').textContent, 'XP’ni topla, dünyada ilerle!');
  assert.equal(testApp.get('trackTitle').textContent, 'NETHER PORTALINA ULAŞ');
  assert.equal(testApp.get('teacherPanelTitle').textContent, 'Dünya yönetimi');
  assert.equal(testApp.get('addStudent').textContent, 'Öğrenci ekle');
  assert.equal(testApp.get('finishTarget').textContent, 'NETHER PORTALI · 30 XP');
  assert.equal(testApp.get('xpStatLabel').textContent, 'TOPLAM XP');
  const normalApp = makeApp('?teacher=1');
  assert.ok(normalApp.ctx.document.body.classList.contains('minecraft-mode'));
  assert.equal(normalApp.get('heroTitle').textContent, 'BLOK DÜNYA YARIŞI');
  assert.equal(normalApp.get('questionBankOpen').style.display, 'none');
});

test('Minecraft test roster uses pixel sprites for lanes, picker, teacher controls, and profiles', () => {
  const app = makeApp('?teacher=1&test=1');
  assert.match(app.get('lanes').innerHTML, /aria-label=\"Steve\"/);
  assert.match(app.get('lanes').innerHTML, /class=\"mc-sprite mc-online-wrap\"/);
  assert.match(app.get('lanes').innerHTML, /fill=\"#c58b62\"/);
  assert.match(app.get('lanes').innerHTML, /stroke=\"#172016\"/);
  assert.ok((app.get('lanes').innerHTML.match(/<rect /g) || []).length >= 10, 'pixel character has multiple colored detail blocks');
  assert.doesNotMatch(app.get('lanes').innerHTML, /fill=#[^\s\"]+\/>/);
  assert.match(app.get('studentControls').innerHTML, /aria-label=\"Halil İbrahim için Steve seç\"/);
  assert.match(app.get('waysList').innerHTML, /mc-task-icon/);
  assert.doesNotMatch(app.get('waysList').innerHTML, /<b>📚<\/b>/);
  assert.match(app.get('lanes').innerHTML, /class="place-block">01/);
  assert.doesNotMatch(app.get('lanes').innerHTML, /0\/30/);
  assert.match(app.get('lanes').innerHTML, /mc-world-track/);
  assert.match(app.get('lanes').innerHTML, /<article class="lane student-card"[^>]*><header class="student-header">/);
  assert.match(app.get('lanes').innerHTML, /<header class="student-header">[\s\S]*?<\/header><div class="game-world track mc-world-track/);
  assert.match(app.get('lanes').innerHTML, /<\/div><div class="mc-course-hud minecraft-hud"/);
  assert.match(html, /student-card \.game-world\{[^}]*position:relative/);
  assert.match(html, /student-card \.runner-token\{top:auto/);
  assert.match(app.get('lanes').innerHTML, /mc-world-ground/);
  assert.match(app.get('lanes').innerHTML, /mc-checkpoint-chest/);
  assert.match(app.get('lanes').innerHTML, /aria-label=\"Nether portalı hedefi\"/);
  assert.doesNotMatch(app.get('lanes').innerHTML, /mc-path-step/);
  assert.match(app.get('lanes').innerHTML, /mc-world-road/);
  assert.doesNotMatch(app.get('lanes').innerHTML, /mc-torch|mc-world-feature/);
  assert.match(app.get('lanes').innerHTML, /mc-portal-inner/);
  assert.doesNotMatch(app.get('lanes').innerHTML, /beacon-core|mc-beacon-base/);
  assert.match(app.get('lanes').innerHTML, /mc-cabin /);
  assert.match(app.get('lanes').innerHTML, /mc-start-label">START/);
  assert.doesNotMatch(app.get('lanes').innerHTML, /mc-checkpoint-sign|15★|scene-[0-9]/);
  assert.equal((app.get('lanes').innerHTML.match(/class="mc-world-scene"/g) || []).length, 10);
  assert.match(html, /mc-portal-active \.finish-line/);
  assert.match(html, /--runner-from/);
  assert.match(html, /segment<raceStars\(s\)\?' filled':''/);
  assert.match(html, /width:80px;height:80px/);
  assert.match(app.get('lanes').innerHTML, /20 XP checkpoint sandığı/);
  assert.match(app.get('lanes').innerHTML, /style=\"left:5\.00%\"/);
  assert.match(app.get('lanes').innerHTML, /class="mc-xp-bar" role="progressbar"/);
  assert.match(app.get('lanes').innerHTML, /class="mc-hearts">(?:<span class="mc-heart"><\/span>){10}<\/div>/);
  assert.match(app.get('lanes').innerHTML, /class="mc-hunger">(?:<span class="mc-hunger-icon"><\/span>){10}<\/div>/);
  assert.match(app.get('lanes').innerHTML, /class="mc-hud-level">0<\/span>/);
  assert.match(html, /mc-world-road\{[^}]*#806344/);
  assert.equal((app.get('lanes').innerHTML.match(/class="mc-obsidian-block /g) || []).length, 40);
  assert.match(html, /mc-portal-inner:before/);
  assert.match(app.get('lanes').innerHTML, /aria-valuenow="0"/);
  assert.match(html, /body\.minecraft-mode \.mc-xp-bar\{position:absolute;left:0;right:0;bottom:2px/);
  assert.match(app.get('lanes').innerHTML, /mc-xp-segment/);
  assert.match(html, /body\.minecraft-mode \.mc-xp-segment\.filled\{background:#76ed20/);
  assert.match(html, /body\.minecraft-mode \.lane:before\{display:none!important\}/);
  assert.match(html, /body\.minecraft-mode \.student\{width:100%;max-width:150px/);
  assert.match(html, /body\.minecraft-mode \.mc-start\{left:var\(--track-start\)/);
  assert.match(html, /body\.minecraft-mode \.finish-line\{top:auto;left:var\(--track-end\);right:auto/);
  assert.doesNotMatch(html.match(/body\.minecraft-mode \.mc-xp-bar\{([^}]+)\}/)?.[1] || '', /gradient|border-radius:[1-9]/);
  assert.match(app.get('lanes').innerHTML, /mc-milestone-label">10 XP/);
  assert.match(app.get('lanes').innerHTML, /mc-milestone-label">20 XP/);
  assert.match(html, /body\.minecraft-mode \.mc-xp-bar\{position:absolute;left:0;right:0;bottom:2px/);
  assert.match(html, /mc-start:after\{display:none\}/);
  assert.match(html, /body\.minecraft-mode \.track\{grid-column:1\/\-/);
  assert.match(html, /body\.minecraft-mode \.track-head\{display:block/);
  assert.match(html, /body\.minecraft-mode:before/);
  assert.match(html, /body\.minecraft-mode \.finish-line:after/);
  assert.match(html, /body\.minecraft-mode \.xp-fill/);
  fire(app.get('settingsBtn'), 'click');
  fire(app.get('studentControls'), 'click', target({ '[data-pick]': { dataset: { pick: '1' } } }));
  assert.match(app.get('characterOptions').innerHTML, /Enderman/);
  assert.equal((app.get('characterOptions').innerHTML.match(/class=\"mc-sprite(?: [^\"]*)?\"/g) || []).length, 6);
  assert.match(app.get('characterOptions').innerHTML, /Steve[\s\S]*Alex[\s\S]*Zombi[\s\S]*İskelet[\s\S]*Creeper[\s\S]*Enderman/);
  assert.doesNotMatch(app.get('characterOptions').innerHTML, /Ghast|Piglin/);
  fire(app.get('characterOptions'), 'click', target({ '[data-char]': { dataset: { char: '1', emoji: 'mc-enderman' } } }));
  assert.equal(studentsOf(app.storage)[0].emoji, 'mc-enderman');
  fire(app.get('lanes'), 'click', target({ '[data-profile]': { dataset: { profile: '1' } } }));
  assert.match(app.get('profileAvatar').innerHTML, /aria-label=\"Enderman\"/);
  assert.match(app.get('profileAvatar').innerHTML, /mc-sprite/);
});

test('Minecraft stars drive XP segments, runner position, and portal course milestones', () => {
  const positions = [[0,'5.00%'],[5,'20.00%'],[10,'35.00%'],[15,'50.00%'],[20,'65.00%'],[25,'80.00%'],[30,'95.00%']];
  for (const [stars, expected] of positions) {
    const record = [{ id: 1, name: 'Kaşif', emoji: 'mc-steve', stars, xp: stars, lifetimeStars: stars }];
    const app = makeApp('?teacher=1&test=1', record);
    assert.ok(app.get('lanes').innerHTML.includes('left:' + expected));
    assert.match(app.get('lanes').innerHTML, new RegExp('aria-valuenow=\"' + stars + '\"'));
    assert.equal((app.get('lanes').innerHTML.match(/mc-xp-segment[^>]*filled/g) || []).length, stars);
    assert.equal((app.get('lanes').innerHTML.match(/class="mc-xp-segment/g) || []).length, 30);
    assert.match(app.get('lanes').innerHTML, /class="mc-start" style="left:5\.00%"/);
    assert.match(app.get('lanes').innerHTML, /class="mc-cabin [^"]*" style="left:35\.00%"/);
    assert.match(app.get('lanes').innerHTML, /class="mc-checkpoint-chest [^"]*" style="left:65\.00%"/);
    assert.match(app.get('lanes').innerHTML, /class="finish-line" style="left:95\.00%"/);
    if (stars >= 10) assert.match(app.get('lanes').innerHTML, /mc-cabin mc-cabin-reached/);
    else assert.match(app.get('lanes').innerHTML, /mc-cabin "/);
    if (stars >= 20) assert.match(app.get('lanes').innerHTML, /mc-checkpoint-chest mc-chest-open/);
    else assert.match(app.get('lanes').innerHTML, /mc-checkpoint-chest "/);
    if (stars === 30) {
      assert.match(app.get('lanes').innerHTML, /20 XP ödül sandığı/);
      assert.match(app.get('lanes').innerHTML, /PORTAL AÇIK/);
      assert.match(app.get('lanes').innerHTML, /mc-portal-active/);
      assert.match(app.get('lanes').innerHTML, /mc-portal-active/);
    }
  }
});

test('local question bank has 20 uniquely identified, answerable questions per lesson and topic', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'questions.js'), 'utf8'), context);
  const bank = context.window.LOCAL_QUESTION_BANK;
  assert.ok(bank.length >= 300);
  const ids = new Set();
  const groups = new Map();
  for (const question of bank) {
    assert.ok(question.id && question.lesson && question.topic && question.question);
    assert.equal(question.choices.length, 4);
    assert.ok(question.choices.every(choice => typeof choice === 'string' && choice.length));
    assert.ok(question.correctAnswer >= 0 && question.correctAnswer < question.choices.length);
    assert.ok(!ids.has(question.id), `question id ${question.id} must be unique`);
    ids.add(question.id);
    const key = `${question.lesson}|${question.topic}`;
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  assert.ok([...groups.values()].every(count => count >= 20));
  assert.equal(groups.get('Sosyal Bilgiler|Harita ve Yönler'), 20);
  assert.equal(groups.get('Sosyal Bilgiler|Ülkemizi Tanıyalım'), 20);
});

test('question bank is available to students and teacher test preview, and correct answers award one XP', async () => {
  const student = makeApp('');
  assert.equal(student.get('questionBankOpen').style.display, '');
  const teacher = makeApp('?teacher=1');
  assert.equal(teacher.get('questionBankOpen').style.display, 'none');
  const { ctx, get, storage } = makeApp('?teacher=1&test=1');
  assert.equal(get('questionBankOpen').style.display, '');
  const fixture = Array.from({ length: 20 }, (_, i) => ({
    id: 'math_fractions_001', lesson: 'Matematik', topic: 'Kesirler',
    question: '3/4 kesrinde pay hangisidir?', choices: ['3', '4', '7', '1'], correctAnswer: 0, difficulty: 'easy',
  }));
  ctx.window.LOCAL_QUESTION_BANK = fixture;
  fire(get('questionBankOpen'), 'click');
  get('qbStudent').value = '1';
  get('qbLesson').value = 'Matematik';
  fire(get('qbLesson'), 'change');
  get('qbTopic').value = 'Kesirler';
  fire(get('qbTopic'), 'change');
  fire(get('qbStart'), 'click');
  assert.match(get('qbQuestionCount').textContent, /1 \/ 20/);
  const correctButton = get('qbChoices').choiceButtons.find(button => button.label.includes('3'));
  await fireAsync(get('qbChoices'), 'click', target({ '[data-answer]': { dataset: { answer: correctButton.dataset.answer } } }));
  assert.match(get('qbFeedback').textContent, /\+1 XP/);
  let saved = JSON.parse(storage.get('question-progress-v1:class-race-v1'));
  assert.equal(saved['1'].xpEarned, 1);
  assert.deepEqual(saved['1'].solvedQuestionIds, ['math_fractions_001']);
  assert.match(get('lanes').innerHTML, /aria-valuenow="1"/);
  fire(get('qbNext'), 'click');
  const repeatedCorrect = get('qbChoices').choiceButtons.find(button => button.label.includes('3'));
  await fireAsync(get('qbChoices'), 'click', target({ '[data-answer]': { dataset: { answer: repeatedCorrect.dataset.answer } } }));
  assert.match(get('qbFeedback').textContent, /\+1 XP/);
  saved = JSON.parse(storage.get('question-progress-v1:class-race-v1'));
  assert.equal(saved['1'].xpEarned, 2, 'each correct response grants one XP, including a repeated question');
  assert.deepEqual(studentsOf(storage)[0].stars, 0, 'student bank progress is tracked separately from teacher-assigned stars');
  fire(get('qbNext'), 'click');
  assert.equal(get('qbQuestionCount').textContent, 'SORU 3 / 20');
  const wrongButton = get('qbChoices').choiceButtons.find(button => !button.label.includes('3'));
  await fireAsync(get('qbChoices'), 'click', target({ '[data-answer]': { dataset: { answer: wrongButton.dataset.answer } } }));
  assert.match(get('qbFeedback').textContent, /YANLIŞ/);
  saved = JSON.parse(storage.get('question-progress-v1:class-race-v1'));
  assert.equal(saved['1'].xpEarned, 2, 'wrong answers grant no XP');
  while (get('qbQuestionCount').textContent !== 'SORU 20 / 20') {
    await fireAsync(get('qbNext'), 'click');
    const answer = get('qbChoices').choiceButtons.find(button => button.label.includes('3'));
    await fireAsync(get('qbChoices'), 'click', target({ '[data-answer]': { dataset: { answer: answer.dataset.answer } } }));
  }
  await fireAsync(get('qbNext'), 'click');
  assert.equal(get('qbResultScore').textContent, 'Doğru: 19 · Yanlış: 1');
  assert.equal(get('qbResultXp').textContent, 'Bu testte kazanılan XP: +19 XP');
  saved = JSON.parse(storage.get('question-progress-v1:class-race-v1'));
  assert.equal(saved['1'].testHistory.length, 1);
  assert.equal(saved['1'].testHistory[0].totalQuestions, 20);
  assert.equal(saved['1'].testHistory[0].newXp, 19);
});

test('student question XP is not awarded when the Firebase write fails', async () => {
  const roster = [{ id: 2, name: 'Hilal İbrahim', emoji: 'mc-steve', stars: 0, xp: 0, lifetimeStars: 0 }];
  const { ctx, get, storage } = makeApp('', roster);
  fire(get('questionBankOpen'), 'click');
  ctx.window.listeners['firebase-student-authorized']({ detail: { studentId: '2' } });
  ctx.window.raceCloud = { saveQuestionProgress: async () => { const error = new Error('denied'); error.code = 'PERMISSION_DENIED'; throw error; } };
  ctx.window.LOCAL_QUESTION_BANK = Array.from({ length: 20 }, (_, i) => ({
    id: 'student_failure_' + i, lesson: 'Matematik', topic: 'Kesirler',
    question: 'Pay hangisidir?', choices: ['Üstteki sayı', 'Alttaki sayı', 'Çizgi', 'Bütün'], correctAnswer: 0,
  }));
  get('qbStudent').value = '2';
  get('qbLesson').value = 'Matematik'; fire(get('qbLesson'), 'change');
  get('qbTopic').value = 'Kesirler'; fire(get('qbTopic'), 'change');
  fire(get('qbStart'), 'click');
  const correct = get('qbChoices').choiceButtons.find(button => button.label.includes('Üstteki sayı'));
  await fireAsync(get('qbChoices'), 'click', target({ '[data-answer]': { dataset: { answer: correct.dataset.answer } } }));
  assert.match(get('qbFeedback').textContent, /PERMISSION_DENIED/);
  assert.doesNotMatch(get('qbFeedback').textContent, /\+1 XP/);
  assert.equal(get('qbNext').hidden, true);
  const saved = JSON.parse(storage.get('question-progress-v1:class-race-v1'));
  assert.equal(saved['2'], undefined, 'failed Firebase XP is rolled back locally');
});

test('student question XP feedback waits for Firebase confirmation', async () => {
  const roster = [{ id: 2, name: 'Hilal İbrahim', emoji: 'mc-steve', stars: 0, xp: 0, lifetimeStars: 0 }];
  const { ctx, get, storage } = makeApp('', roster);
  fire(get('questionBankOpen'), 'click');
  ctx.window.listeners['firebase-student-authorized']({ detail: { studentId: '2' } });
  let confirmWrite;
  ctx.window.raceCloud = { saveQuestionProgress: async () => new Promise(resolve => { confirmWrite = resolve; }) };
  ctx.window.LOCAL_QUESTION_BANK = Array.from({ length: 20 }, (_, i) => ({
    id: 'student_wait_' + i, lesson: 'Matematik', topic: 'Kesirler',
    question: 'Pay hangisidir?', choices: ['Üstteki sayı', 'Alttaki sayı', 'Çizgi', 'Bütün'], correctAnswer: 0,
  }));
  get('qbStudent').value = '2';
  get('qbLesson').value = 'Matematik'; fire(get('qbLesson'), 'change');
  get('qbTopic').value = 'Kesirler'; fire(get('qbTopic'), 'change');
  fire(get('qbStart'), 'click');
  const correct = get('qbChoices').choiceButtons.find(button => button.label.includes('Üstteki sayı'));
  const answerPending = fireAsync(get('qbChoices'), 'click', target({ '[data-answer]': { dataset: { answer: correct.dataset.answer } } }));
  await Promise.resolve();
  assert.equal(get('qbFeedback').textContent, '', 'no success message while Firebase is pending');
  assert.equal(get('qbNext').hidden, true);
  confirmWrite();
  await answerPending;
  assert.match(get('qbFeedback').textContent, /\+1 XP/);
  assert.equal(JSON.parse(storage.get('question-progress-v1:class-race-v1'))['2'].xpEarned, 1);
});

test('revocation during an XP write closes the race without reviving a question or crashing', async () => {
  const roster = [{ id: 2, name: 'Test', emoji: 'mc-steve', stars: 0, xp: 0, lifetimeStars: 0 }];
  for (const reject of [false, true]) {
    const { ctx, get } = makeApp('', roster);
    ctx.window.listeners['firebase-student-authorized']({ detail: { studentId: '2' } });
    let finish;
    ctx.window.raceCloud = { saveQuestionProgress: () => new Promise((resolve, rejectWrite) => {
      finish = () => reject ? rejectWrite(Object.assign(new Error('revoked'), { code: 'PERMISSION_DENIED' })) : resolve();
    }) };
    ctx.window.LOCAL_QUESTION_BANK = Array.from({ length: 20 }, (_, i) => ({
      id: 'revoked_' + i, lesson: 'Math', topic: 'Topic', question: 'Question?', choices: ['YES', 'NO'], correctAnswer: 0,
    }));
    get('qbLesson').value = 'Math'; fire(get('qbLesson'), 'change');
    get('qbTopic').value = 'Topic'; fire(get('qbStart'), 'click');
    const correct = get('qbChoices').choiceButtons.find(button => button.label.includes('YES'));
    const pending = fireAsync(get('qbChoices'), 'click', target({ '[data-answer]': { dataset: { answer: correct.dataset.answer } } }));
    ctx.window.listeners['firebase-student-access-required']({});
    finish(); await pending;
    assert.equal(get('raceApp').hidden, true);
    assert.ok(!get('questionBankOverlay').classList.contains('open'));
    assert.ok(get('studentAccessOverlay').classList.contains('open'));
    assert.doesNotMatch(get('qbFeedback').textContent, /\+1 XP/);
  }
});

test('normalizing a Firebase snapshot does not echo a roster write back to Firebase', () => {
  const { ctx, get } = makeApp();
  ctx.window.dispatched = null;
  ctx.window.listeners['firebase-roster']({ detail: [{ id: 1, name: 'Legacy', emoji: '🐱', stars: '2' }] });
  assert.match(get('lanes').innerHTML, /Legacy/);
  assert.equal(ctx.window.dispatched, null, 'snapshot normalization must not dispatch firebase-local-save');
});

test('student bank binds the test to the code-authorized student only', async () => {
  const roster = [
    { id: 1, name: 'Ayşe', emoji: 'mc-alex', stars: 0, xp: 0, lifetimeStars: 0 },
    { id: 2, name: 'Hilal İbrahim', emoji: 'mc-steve', stars: 0, xp: 0, lifetimeStars: 0 },
  ];
  const { ctx, get, storage } = makeApp('', roster);
  assert.equal(get('settingsBtn').style.display, 'none');
  fire(get('questionBankOpen'), 'click');
  assert.ok(get('studentAccessOverlay').classList.contains('open'));
  assert.ok(!get('questionBankOverlay').classList.contains('open'));
  ctx.window.listeners['firebase-student-authorized']({ detail: { studentId: '2' } });
  ctx.window.raceCloud = { saveQuestionProgress: async () => {} };
  assert.ok(get('questionBankOverlay').classList.contains('open'));
  assert.match(get('qbStudent').innerHTML, /value="2">Hilal İbrahim/);
  assert.doesNotMatch(get('qbStudent').innerHTML, /Ayşe/);
  ctx.window.LOCAL_QUESTION_BANK = Array.from({ length: 20 }, (_, i) => ({
    id: `student_identity_${i + 1}`, lesson: 'Matematik', topic: 'Kesirler',
    question: 'Pay hangisidir?', choices: ['Üstteki sayı', 'Alttaki sayı', 'Çizgi', 'Bütün'], correctAnswer: 0,
  }));
  get('qbStudent').value = '1';
  get('qbLesson').value = 'Matematik'; fire(get('qbLesson'), 'change');
  get('qbTopic').value = 'Kesirler'; fire(get('qbTopic'), 'change');
  fire(get('qbStart'), 'click');
  assert.equal(get('qbStudentLabel').textContent, 'Hilal İbrahim');
  const correct = get('qbChoices').choiceButtons.find(button => button.label.includes('Üstteki sayı'));
  await fireAsync(get('qbChoices'), 'click', target({ '[data-answer]': { dataset: { answer: correct.dataset.answer } } }));
  const saved = JSON.parse(storage.get('question-progress-v1:class-race-v1'));
  assert.equal(saved['2'].xpEarned, 1);
  assert.equal(saved['1'], undefined);
});

test('Sosyal Bilgiler is selectable and its sample topic starts a test', () => {
  assert.match(html, /<option>Sosyal Bilgiler<\/option>/);
  assert.match(html, /<script src="\.\/questions\.js\?v=21"><\/script>/);
  assert.match(html, /\[hidden\]\{display:none!important\}/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8'), /CACHE_NAME = 'yildiz-yarislari-v32'/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'pages.yml'), 'utf8'), /cp .*questions\.js .*_site\//);
  const { ctx, get } = makeApp('?teacher=1&test=1');
  ctx.window.LOCAL_QUESTION_BANK = Array.from({ length: 20 }, (_, i) => ({
    id: `social_directions_${i + 1}`, lesson: 'Sosyal Bilgiler', topic: 'Harita ve Yönler',
    question: 'Haritalarda yukarı taraf hangi yönü gösterir?', choices: ['Kuzey', 'Güney', 'Doğu', 'Batı'], correctAnswer: 0,
  }));
  fire(get('questionBankOpen'), 'click');
  get('qbLesson').value = 'Sosyal Bilgiler';
  fire(get('qbLesson'), 'change');
  assert.match(get('qbTopic').innerHTML, /Harita ve Yönler/);
  get('qbTopic').value = 'Harita ve Yönler';
  fire(get('qbTopic'), 'change');
  fire(get('qbStart'), 'click');
  assert.equal(get('qbQuestionCount').textContent, 'SORU 1 / 20');
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

test('legacy Minecraft placeholder selections fall back to Steve without changing character assets', () => {
  const app = makeApp('?teacher=1&test=1', [
    { id: 1, name: 'Old option A', emoji: 'mc-ghast', stars: 0, xp: 0 },
    { id: 2, name: 'Old option B', emoji: 'mc-piglin', stars: 0, xp: 0 },
  ]);
  assert.deepEqual(studentsOf(app.storage).map(student => student.emoji), ['mc-steve', 'mc-steve']);
  assert.match(app.get('lanes').innerHTML, /aria-label="Steve"/);
  assert.doesNotMatch(app.get('lanes').innerHTML, /Ghast|Piglin/);
});

test('teacher can add and remove students beyond the original ten', () => {
  const { get, storage } = makeApp();
  fire(get('addStudent'), 'click');
  assert.equal(studentsOf(storage).length, 11);
  assert.equal((get('lanes').innerHTML.match(/class="lane student-card"/g) ?? []).length, 11);
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
  assert.equal(storage.get('class-race-v1:teacher-account-a'), undefined, 'scope loading does not publish a default roster');
  const accountA = JSON.parse(original);
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
  const { get, storage, ctx } = makeApp('', studentsOf(makeApp().storage));
  const data = studentsOf(storage);
  data[0].stars = 3;
  storage.set('class-race-v1', JSON.stringify(data));
  ctx.window.listeners.storage({ key: 'class-race-v1' });
  assert.match(get('lanes').innerHTML, /★ 3 \/ 30 XP/);
  assert.match(get('lanes').innerHTML, /aria-valuenow="3"/);
});

test('responsive CSS and essential dialog controls are present', () => {
  assert.match(html, /@media\(max-width:1000px\)/);
  assert.match(html, /@media\(max-width:650px\)/);
  assert.match(html, /@media\(max-width:420px\)/);
  assert.match(html, /id="characterClose"/);
  assert.match(html, /id="profileClose"/);
  assert.match(html, /\(i\+1\)\+'\.'/);
  assert.match(html, /class="place-block"/);
  assert.match(html, /minecraftMode\?/);
});

test('Minecraft course endpoints keep the player and portal inside narrow viewports', () => {
  assert.match(html, /@media\(max-width:900px\)\{body\.minecraft-mode \.student-card \.runner-token\{left:clamp\(44px,var\(--runner-x\),calc\(100% - 44px\)\)!important\}body\.minecraft-mode \.student-card \.finish-line\{left:clamp\(32px,var\(--track-end\),calc\(100% - 32px\)\)!important\}\}/);
  for (const worldWidth of [320, 350, 390, 660, 1260, 1800]) {
    const playerCenter = Math.max(44, Math.min(worldWidth * 0.05, worldWidth - 44));
    const portalCenter = Math.max(32, Math.min(worldWidth * 0.95, worldWidth - 32));
    assert.ok(playerCenter - 40 >= 0 && playerCenter + 40 <= worldWidth, `player fits in ${worldWidth}px world`);
    assert.ok(portalCenter - 32 >= 0 && portalCenter + 32 <= worldWidth, `portal fits in ${worldWidth}px world`);
  }
  assert.match(html, /@media\(max-width:420px\)\{body\.minecraft-mode \.control-row\{grid-template-columns:40px minmax\(40px,1fr\) auto repeat\(3,38px\);gap:4px\}body\.minecraft-mode \.mini-btn\{width:38px;height:38px\}\}/);
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
  assert.equal(get('profileTitle').textContent, 'Efsane Kaşif');
  assert.equal(get('profileStars').textContent, 30);
  assert.match(get('profileBadges').innerHTML, /Parkur Şampiyonu/);
  assert.match(get('xpCaption').textContent, /en yüksek seviye/i);
});

test('malformed saved student records are discarded without replacing valid students', () => {
  const records = [null, { id: 2, name: 'Kayıtlı', emoji: '<img src=x>', stars: 'NaN', xp: 4 }];
  const { get, storage } = makeApp('?teacher=1', records);
  assert.equal(studentsOf(storage).length, 1);
  assert.equal(studentsOf(storage)[0].name, 'Kayıtlı');
  assert.equal(studentsOf(storage)[0].emoji, 'mc-steve');
  assert.equal(studentsOf(storage)[0].stars, 0);
  assert.match(get('lanes').innerHTML, /Kayıtlı/);
  assert.doesNotMatch(get('lanes').innerHTML, /<img src=x>/);
});

test('student reopens with unseen progress and gets an animated runner', () => {
  const record = [{ id: 1, name: 'Halil İbrahim', emoji: '🐱', stars: 3, xp: 3, lifetimeStars: 3 }];
  const app = makeApp('', record, { '1': { stars: 1 } }), { get, storage } = app;
  assert.ok(get('lane-1').classList.contains('runner'));
  assert.equal(get('lane-1').runner.style.left, '14.00%');
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
  const app = makeApp('', studentsOf(makeApp().storage)); const { storage, ctx } = app; const before = app.writes;
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
  assert.equal(saved[1].emoji, 'mc-steve', 'invalid Minecraft character falls back to the first valid character');
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
  assert.match(get('lanes').innerHTML, /aria-valuenow="1"/);
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
  assert.equal(rules.rules.teacherData['$uid']['.read'], 'auth != null && auth.uid === $uid && auth.token.email != null');
  assert.equal(rules.rules.teacherData['$uid']['.write'], 'auth != null && auth.uid === $uid && auth.token.email != null');
  assert.match(rules.rules.sharedRosters['$token']['.read'], /studentSessions.*studentCredentials/);
  assert.match(rules.rules.sharedRosters['$token']['.write'], /auth\.uid === newData\.child\('ownerUid'\)\.val\(\)/);
  assert.equal(rules.rules['class-race'].defaultRosterToken['.read'], false);
  assert.equal(rules.rules['class-race'].students['.read'], "auth != null && auth.token.email === 'tunc@test.com'");
  assert.match(firebase, /signInAnonymously/);
  assert.match(firebase, /signInWithEmailAndPassword/);
  assert.match(firebase, /signInWithPopup/);
  assert.match(firebase, /const teacherCollection = testMode \? "testTeacherData" : "teacherData"/);
  assert.match(firebase, /\$\{teacherCollection\}\/\$\{teacherUid\}/);
  assert.match(firebase, /sharedRosters\/\$\{token\}/);
  assert.match(firebase, /classPath/);
  assert.match(firebase, /Object\.hasOwn\(data,"ways"\)/);
  assert.match(firebase, /setPersistence\(auth, browserLocalPersistence\)/);
  assert.match(firebase, /studentQuestionData\/\$\{activeStudentRoster\}\/\$\{activeStudentId\}/);
  assert.match(html, /await window\.raceCloud\.saveQuestionProgress\(String\(studentId\),progress\)/);
  assert.ok(rules.rules.studentQuestionData, 'question progress has an account-scoped database path');
  assert.match(rules.rules.studentCredentials.$token['.read'], /classTokens/); assert.match(rules.rules.studentCredentials.$token['.read'], /data\.child\('ownerUid'\)\.val\(\) === auth\.uid/);
  assert.match(rules.rules.studentSessions.$token.$uid['.write'], /studentCredentials.*codes/);
  assert.match(rules.rules.studentQuestionData.$token.$studentId['.read'], /studentSessions/);
  assert.match(rules.rules.studentQuestionData.$token.$studentId['.write'], /child\('studentId'\)\.val\(\) === \$studentId/);
  assert.match(firebase, /authorizeStudent\(studentId, accessCode\)/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'), /database\.rules\.json/);
});

test('Firebase failures expose the actual path and save result without weakening rules', () => {
  const firebase = fs.readFileSync(path.join(__dirname, '..', 'firebase.js'), 'utf8');
  const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
  assert.match(firebase, /console\.error\(`Firebase \$\{operation\} failed`/);
  assert.match(firebase, /path,\s*authUid: auth\.currentUser\?\.uid/);
  assert.match(firebase, /firebase-ways-save-result/);
  assert.match(firebase, /Firebase'e kaydedilemedi \(\$\{error\?\.code/);
  assert.match(htmlSource, /Görev panosu Firebase’e kaydedildi/);
  assert.match(htmlSource, /Görev panosu Firebase’e kaydedilemedi/);
  assert.equal(rules.rules['.read'], false);
  assert.equal(rules.rules['.write'], false);
});

test('Minecraft teacher test mode has its own Firebase data and install identity', () => {
  const firebase = fs.readFileSync(path.join(__dirname, '..', 'firebase.js'), 'utf8');
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest-teacher-test.webmanifest'), 'utf8'));
  const studentManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest-student.webmanifest'), 'utf8'));
  const teacherManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest-teacher.webmanifest'), 'utf8'));
  assert.match(html, /document\.body\.classList\.add\('minecraft-mode'\);applyMinecraftCopy/);
  assert.match(firebase, /testTeacherData/);
  assert.match(firebase, /testMode \? "testTeacherData" : "teacherData"/);
  assert.equal(rules.rules.testTeacherData['$uid']['.read'], 'auth != null && auth.uid === $uid && auth.token.email != null');
  assert.equal(rules.rules.testTeacherData['$uid']['.write'], 'auth != null && auth.uid === $uid && auth.token.email != null');
  assert.equal(new Set([manifest.id, studentManifest.id, teacherManifest.id]).size, 3, 'the test install ID does not overlap the production apps');
  assert.equal(manifest.start_url, './?teacher=1&test=1');
  assert.equal(manifest.theme_color, '#446d52');
  assert.equal(manifest.short_name, 'Blok Yarışı');
  assert.equal(manifest.icons[0].src, './minecraft-test-icon.svg');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'pwa.js'), 'utf8'), /manifest-teacher-test\.webmanifest/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8'), /manifest-teacher-test\.webmanifest/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8'), /questions\.js/);
});
