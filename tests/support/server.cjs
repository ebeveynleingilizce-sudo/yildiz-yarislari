const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const allowed = new Set(['index.html', 'classes-ui.js', 'pwa.js', 'questions.js', 'service-worker.js',
  'manifest-student.webmanifest', 'manifest-teacher.webmanifest', 'manifest-teacher-test.webmanifest',
  'app-icon.svg', 'teacher-icon.svg', 'minecraft-test-icon.svg']);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4179');
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  if (url.pathname === '/__test_health') { response.writeHead(200).end('yildiz-local-mock-only'); return; }
  let file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (file === 'firebase.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
    const source = fs.readFileSync(path.join(root, 'firebase.js'), 'utf8').replace(/import\s+[\s\S]*?from\s+"[^"]+";/g, '');
    response.end('import "./__test_sdk.js";\nconst { initializeApp, getAuth, GoogleAuthProvider, browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, signInAnonymously, signInWithEmailAndPassword, signInWithPopup, signOut, getDatabase, get, onValue, ref, runTransaction, set, update } = window.__firebaseSdk;\nconst firebaseConfig = { projectId: "local-test-double" };\n' + source);
    return;
  }
  if (file === '__test_sdk.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
    const rules = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8'));
    // Compile trusted repository rules on the server; the browser CSP stays strict.
    const compile = value => value && typeof value === 'object'
      ? '{' + Object.entries(value).map(([key, item]) => JSON.stringify(key) + ':' +
        (['.read', '.write'].includes(key) && typeof item === 'string'
          ? '({auth,root,data,newData,$token,$uid,$studentId})=>(' + item + ')'
          : compile(item))).join(',') + '}' : JSON.stringify(value);
    response.end(fs.readFileSync(path.join(__dirname, 'firebase-mock.js'), 'utf8') + '\nwindow.__firebaseSdk = createFirebaseSdk(window, ' + compile(rules) + ');');
    return;
  }
  if (!allowed.has(file)) { response.writeHead(404).end('Not found'); return; }
  try {
    let content = fs.readFileSync(path.join(root, file));
    if (file === 'index.html') {
      // The test server cannot load executable external modules or contact Firebase,
      // including from service workers. Production files remain unchanged.
      content = content.toString().replace(/<link\b[^>]*href="https:[^"]*"[^>]*>/g, '');
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; media-src 'self' blob:",
    });
    response.end(content);
  } catch { response.writeHead(500).end('Test file unavailable'); }
}).listen(4179, '127.0.0.1', () => console.log('Local mock-only test server: http://127.0.0.1:4179'));
