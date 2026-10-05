// Local SDK double: runs the application's real firebase.js without an SDK/network.
// Evaluates the repository's rule expressions; this is not the Firebase emulator.
function createFirebaseSdk(env, rules) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const tokens = { a: 'a'.repeat(32), b: 'b'.repeat(32) };
  const seed = {};
  for (const account of ['a', 'b']) {
    const students = [1, 2].map(id => ({ id, name: account === 'a' ? `Test Öğrenci ${id === 1 ? 'A' : 'B'}` : `Öğretmen B Öğrenci ${id}`, emoji: id === 1 ? 'mc-steve' : 'mc-alex', stars: 0, xp: 0, lifetimeStars: 0 }));
    const codes = { 1: account === 'a' ? 'TESTCODE' : 'BCODEONE', 2: account === 'a' ? 'OTHERCODE' : 'BCODETWO' };
    seed.teacherData ??= {}; seed.sharedRosters ??= {}; seed.studentCredentials ??= {}; seed.studentCodeLookup ??= {};
    seed.teacherData[`teacher-${account}`] = { shareToken: tokens[account], students, studentAccessCodes: codes, ways: [], seasons: [], starHistory: [] };
    seed.sharedRosters[tokens[account]] = { ownerUid: `teacher-${account}`, students, ways: [] };
    seed.studentCredentials[tokens[account]] = { ownerUid: `teacher-${account}`, codes };
    for (const [studentId, code] of Object.entries(codes)) seed.studentCodeLookup[code] = { ownerUid: `teacher-${account}`, rosterToken: tokens[account], studentId };
  }
  const storage = env.localStorage;
  const key = 'local-test-database';
  if (!storage.getItem(key)) storage.setItem(key, JSON.stringify(seed));
  const read = () => JSON.parse(storage.getItem(key));
  const at = (root, path) => path.split('/').filter(Boolean).reduce((value, part) => value?.[part], root) ?? null;
  function snapshot(value) {
    return { val: () => value == null ? null : clone(value), exists: () => value != null,
      child: path => snapshot(at(value, path)), isString: () => typeof value === 'string',
      matches: pattern => typeof value === 'string' && pattern.test(value),
      hasChildren: names => names.every(name => at(value, name) != null) };
  }
  function put(root, path, value) {
    const parts = path.split('/').filter(Boolean), last = parts.pop();
    let parent = root;
    for (const part of parts) parent = parent[part] ??= {};
    if (value == null) delete parent[last]; else parent[last] = clone(value);
  }
  const auth = { currentUser: null }, listeners = new Set(), authListeners = new Set();
  let appName;
  const state = env.__testCloud = { writes: [], failNextSave: false, failNextWrite: false, transactionNullOnce: false, tokens,
    data: read, pending: [], ready: false };
  function permitted(operation, path, oldRoot, nextRoot = oldRoot) {
    const captures = {}, parts = path.split('/').filter(Boolean);
    let node = rules.rules, traversed = [];
    for (let i = 0; node; i++) {
      const expression = node['.' + operation];
      if (expression === true) return true;
      if (typeof expression === 'string' || typeof expression === 'function') {
        const user = auth.currentUser ? { ...auth.currentUser, token: { email: auth.currentUser.email, firebase: { sign_in_provider: auth.currentUser.isAnonymous ? 'anonymous' : 'password' } } } : null;
        const args = ['auth', 'root', 'data', 'newData', ...Object.keys(captures)];
        const values = [user, snapshot(oldRoot), snapshot(at(oldRoot, traversed.join('/'))), snapshot(at(nextRoot, traversed.join('/'))), ...Object.values(captures)];
        const result = typeof expression === 'function'
          ? expression({ auth: user, root: values[1], data: values[2], newData: values[3], ...captures })
          : Function(...args, 'return (' + expression + ')')(...values);
        if (result) return true;
      }
      if (i === parts.length) break;
      const part = parts[i], wildcard = Object.keys(node).find(name => name.startsWith('$'));
      if (node[part]) node = node[part];
      else if (wildcard) { captures[wildcard] = part; node = node[wildcard]; }
      else break;
      traversed.push(part);
    }
    return false;
  }
  const denied = () => Object.assign(new Error('Permission denied'), { code: 'PERMISSION_DENIED' });
  function notify() {
    const root = read();
    for (const listener of [...listeners]) {
      if (!permitted('read', listener.path, root)) {
        listeners.delete(listener); listener.error?.(denied()); continue;
      }
      const value = at(root, listener.path), serialized = JSON.stringify(value);
      if (serialized !== listener.last) { listener.last = serialized; listener.callback(snapshot(value)); }
    }
  }
  env.addEventListener?.('storage', event => { if (event.key === key) notify(); });
  async function write(reference, values, replace) {
    if ((state.failNextSave && reference.path.startsWith('studentQuestionData/')) || state.failNextWrite) {
      state.failNextSave = state.failNextWrite = false; throw denied();
    }
    const oldRoot = read(), next = clone(oldRoot);
    const updates = replace ? { [reference.path]: values } : Object.fromEntries(Object.entries(values).map(([path, value]) => [[reference.path, path].filter(Boolean).join('/'), value]));
    for (const [path, value] of Object.entries(updates)) put(next, path, value);
    for (const path of Object.keys(updates)) if (!permitted('write', path, oldRoot, next)) throw denied();
    state.writes.push({ path: reference.path, updates: clone(updates) });
    storage.setItem(key, JSON.stringify(next)); notify();
  }
  async function authenticate(user) {
    auth.currentUser = user;
    storage.setItem('local-test-auth:' + appName, JSON.stringify(user));
    for (const callback of authListeners) await callback(user);
  }
  return {
    initializeApp: (_, name) => { appName = name; return { name }; },
    getAuth: () => auth, getDatabase: () => ({}), ref: (_, path = '') => ({ path }),
    runTransaction: async (reference,callback) => {const current=state.transactionNullOnce?(state.transactionNullOnce=false,null):at(read(),reference.path);const value=callback(current);if(value===undefined)return {committed:false,snapshot:snapshot(at(read(),reference.path))};await write(reference,value,true);return {committed:true,snapshot:snapshot(value)};},
    get: async reference => { const root = read(); if (!permitted('read', reference.path, root)) throw denied(); return snapshot(at(root, reference.path)); },
    set: (reference, value) => write(reference, value, true), update: (reference, value) => write(reference, value, false),
    onValue: (reference, callback, error) => { const listener = { path: reference.path, callback, error, last: undefined }; listeners.add(listener); notify(); return () => listeners.delete(listener); },
    onAuthStateChanged: (_, callback) => {
      authListeners.add(callback);
      auth.currentUser = JSON.parse(storage.getItem('local-test-auth:' + appName) || 'null');
      const pending = Promise.resolve().then(() => callback(auth.currentUser)).then(() => { state.ready = true; });
      state.pending.push(pending); return () => authListeners.delete(callback);
    },
    setPersistence: async () => {}, browserLocalPersistence: 'local', browserSessionPersistence: 'session',
    signInAnonymously: () => authenticate({ uid: 'anonymous-test', isAnonymous: true }),
    signInWithEmailAndPassword: async (_, email, password) => {
      if (!/^teacher-[ab]@example\.invalid$/.test(email) && email !== 'tunc@test.com' || password !== 'test-only-password') throw denied();
      await authenticate({ uid: email === 'tunc@test.com' ? 'teacher-a' : email.split('@')[0], email, isAnonymous: false });
    },
    signOut: () => authenticate(null), GoogleAuthProvider: class {},
    signInWithPopup: async () => { throw denied(); }, createUserWithEmailAndPassword: async () => { throw denied(); },
  };
}
if (typeof module !== 'undefined') module.exports = { createFirebaseSdk };
