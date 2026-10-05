let rosterWriteQueue = Promise.resolve();
let publishedRoster = null;
let pendingRosterWrites = 0;
let queuedRoster = null;
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, browserLocalPersistence, browserSessionPersistence,
  createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, signInAnonymously,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase, get, onValue, ref, set, update } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const teacherMode = new URLSearchParams(location.search).has("teacher");
const testMode = teacherMode && new URLSearchParams(location.search).get("test") === "1";
const app = initializeApp(firebaseConfig, teacherMode ? (testMode ? "yildiz-teacher-test" : "yildiz-teacher") : "yildiz-student");
const auth = getAuth(app);
const db = getDatabase(app);
const params = new URLSearchParams(location.search);
const requestedRoster = params.get("roster");
const primaryTeacherEmail = "tunc@test.com";
let isTeacher = false;
let teacherUid = null;
let shareToken = null;
let activeStudentRoster = null;
let studentUid = null;
let activeStudentId = null;
let studentAccessCodes = {};
let rosterSubscription = null;
let questionProgressSubscription = null;
let privateSubscription = null;
let starHistory = [];
let seasons = [];
let suppressRosterSave = false;

const defaultWays = [
  { emoji: "📚", title: "Ödevini tamamla", description: "Sorumluluklarını zamanında bitir." },
  { emoji: "📖", title: "Kitap oku", description: "Yeni dünyalar keşfet, öğrendiklerini paylaş." },
  { emoji: "🏃", title: "Hareket et", description: "Spor yap, bedenini ve enerjini geliştir." },
  { emoji: "💻", title: "Kodlama öğren", description: "Fikirlerini teknolojiyle hayata geçir." },
  { emoji: "🧠", title: "Yeni bir şey öğren", description: "Merak et, araştır ve öğrendiklerini anlat." },
  { emoji: "🎨", title: "Üret ve tasarla", description: "Bir çizim, proje ya da yeni bir fikir ortaya koy." },
  { emoji: "🤝", title: "Yardım et, paylaş", description: "İyiliğinle çevrene katkı sağla." },
];
const defaultStudents = [
  ["Halil İbrahim", "🐱"], ["Ayşe", "🐰"], ["Mehmet", "🦊"], ["Zeynep", "🐼"], ["Efe", "🦁"],
  ["Elif", "🐸"], ["Emir", "🐻"], ["Defne", "🐧"], ["Can", "🐶"], ["Lina", "🤖"],
].map(([name, emoji], index) => ({ id: index + 1, name, emoji, stars: 0, xp: 0, lifetimeStars: 0 }));

function message(text) {
  const target = document.getElementById(teacherMode ? "firebaseLoginMessage" : "studentAccessMessage");
  if (target) target.textContent = text;
}

function reportFirebaseError(operation, path, error) {
  console.error(`Firebase ${operation} failed`, {
    code: error?.code || "unknown",
    message: error?.message || String(error),
    path,
    authUid: auth.currentUser?.uid || null,
    isAnonymous: auth.currentUser?.isAnonymous ?? null,
    appName: app.name,
    projectId: firebaseConfig.projectId,
    error,
  });
}

async function firebaseRequest(operation, path, request) {
  try {
    return await request();
  } catch (error) {
    reportFirebaseError(operation, path, error);
    throw error;
  }
}

function showWriteFailure(label, error) {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = `${label} (${error?.code || "unknown"}).`;
    toast.classList.add("show");
  }
}

function showLogin(show) {
  document.getElementById("firebaseLoginOverlay")?.classList.toggle("open", show);
  const settings = document.getElementById("settingsBtn");
  if (settings && teacherMode) settings.style.display = show ? "none" : "";
}

function publishRoster(raw, force = false) {
  let roster = raw;
  if (!Array.isArray(roster) && roster && typeof roster === "object") roster = Object.values(roster);
  if (Array.isArray(roster) && roster.length) {
    const serialized = JSON.stringify(roster);
    // Ignore intermediate echoes when several local roster changes are queued.
    if (!force && pendingRosterWrites && serialized !== JSON.stringify(queuedRoster)) return;
    if (serialized === publishedRoster) return;
    publishedRoster = serialized;
    window.dispatchEvent(new CustomEvent("firebase-roster", { detail: roster }));
  }
}

function publishWays(ways) {
  const safeWays = Array.isArray(ways) ? ways : defaultWays;
  window.dispatchEvent(new CustomEvent("firebase-ways", { detail: safeWays }));
}

function combineQuestionProgress(raw) {
  const combined = {};
  if (!raw || typeof raw !== "object") return combined;
  const addProgress = (studentId, progress) => {
    if (!progress || typeof progress !== "object" || !Array.isArray(progress.solvedQuestionIds)) return;
    const current = combined[String(studentId)] || { xpEarned: 0, solvedQuestionIds: [], testHistory: [] };
    current.solvedQuestionIds = [...new Set([...current.solvedQuestionIds, ...progress.solvedQuestionIds])];
    current.xpEarned = Math.max(current.xpEarned, Number(progress.xpEarned) || 0, current.solvedQuestionIds.length);
    current.testHistory = [...new Map([...current.testHistory, ...(progress.testHistory || [])].map(item => [item.id, item])).values()].slice(-100);
    combined[String(studentId)] = current;
  };
  for (const [key, value] of Object.entries(raw)) {
    if (value && Array.isArray(value.solvedQuestionIds)) addProgress(key, value);
    else if (value && typeof value === "object") {
      // Read the earlier UID/student nested layout during migration.
      for (const [studentId, progress] of Object.entries(value)) addProgress(studentId, progress);
    }
  }
  return combined;
}

function makeToken() {
  if (crypto.randomUUID) return crypto.randomUUID().replaceAll("-", "");
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function createStudentCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
}

function reconcileStudentCodes(roster, current = {}) {
  const next = {};
  for (const student of Array.isArray(roster) ? roster : []) {
    const id = String(student?.id ?? "");
    if (id) next[id] = typeof current[id] === "string" && current[id] ? current[id] : createStudentCode();
  }
  return next;
}

function publishStudentCodes() {
  window.dispatchEvent(new CustomEvent("firebase-student-codes", { detail: studentAccessCodes }));
}

async function publishStudentCredentials() {
  if (!isTeacher || testMode || !teacherUid || !shareToken) return;
  const path = `studentCredentials/${shareToken}`;
  await firebaseRequest("write", path, () => set(ref(db, path), { ownerUid: teacherUid, codes: studentAccessCodes }));
}

function activateStudentIdentity(studentId) {
  activeStudentId = String(studentId);
  setLocalScope(`student-${activeStudentRoster}-${activeStudentId}`);
  questionProgressSubscription?.();
  const progressRef = ref(db, `studentQuestionData/${activeStudentRoster}/${activeStudentId}`);
  questionProgressSubscription = onValue(progressRef, snapshot => {
    const progress = snapshot.exists() ? snapshot.val() : null;
    window.dispatchEvent(new CustomEvent("firebase-question-progress", { detail: progress ? { [activeStudentId]: progress } : {} }));
  }, error => reportFirebaseError("listen", `studentQuestionData/${activeStudentRoster}/${activeStudentId}`, error));
  window.dispatchEvent(new CustomEvent("firebase-student-authorized", { detail: { studentId: activeStudentId } }));
}

function setLocalScope(scope) {
  publishedRoster = null;
  suppressRosterSave = true;
  window.dispatchEvent(new CustomEvent("firebase-account-scope", { detail: { scope } }));
  queueMicrotask(() => { suppressRosterSave = false; });
}

function showShareLink(token) {
  if (testMode) return;
  const url = new URL(location.href);
  url.search = `?roster=${encodeURIComponent(token)}`;
  url.hash = "";
  window.dispatchEvent(new CustomEvent("firebase-share-link", { detail: { url: url.href } }));
}

async function publishTeacherData(data) {
  const teacherCollection = testMode ? "testTeacherData" : "teacherData";
  const teacherPath = `${teacherCollection}/${teacherUid}`;
  const teacherRef = ref(db, teacherPath);
  const updates = [firebaseRequest("write", teacherPath, () => update(teacherRef, data))];
  if (testMode) {
    await Promise.all(updates);
    return;
  }
  const sharePath = `sharedRosters/${shareToken}`;
  const shareRef = ref(db, sharePath);
  const sharedUpdate = { ownerUid: teacherUid };
  if (Object.hasOwn(data, "students")) sharedUpdate.students = data.students;
  if (Object.hasOwn(data, "ways")) sharedUpdate.ways = data.ways;
  updates.push(firebaseRequest("write", sharePath, () => update(shareRef, sharedUpdate)));
  await Promise.all(updates);
}

async function initializeTeacher(user) {
  teacherUid = user.uid;
  const teacherCollection = testMode ? "testTeacherData" : "teacherData";
  const teacherRef = ref(db, `${teacherCollection}/${teacherUid}`);
  const snapshot = await firebaseRequest("read", `${teacherCollection}/${teacherUid}`, () => get(teacherRef));
  let data = snapshot.exists() ? snapshot.val() : null;

  if (!data) {
    let legacyStudents = null;
    if (!testMode && user.email?.toLowerCase() === primaryTeacherEmail) {
      try {
        const legacy = await get(ref(db, "class-race/students"));
        if (legacy.exists()) legacyStudents = legacy.val();
      } catch (error) {
        console.warn("Eski yarış listesini taşıma izni yok; yeni hesap verisi başlatılıyor.", error);
      }
    }
    if (!testMode && !Array.isArray(legacyStudents) && user.email?.toLowerCase() === primaryTeacherEmail) {
      try {
        const local = JSON.parse(localStorage.getItem("class-race-v1") || "null");
        if (Array.isArray(local) && local.length) legacyStudents = local;
      } catch { /* local legacy data is optional */ }
    }
    data = {
      shareToken: makeToken(),
      students: Array.isArray(legacyStudents) && legacyStudents.length ? legacyStudents : defaultStudents,
      studentAccessCodes: {},
      ways: defaultWays,
      starHistory: [],
      seasons: [],
      classes: [{ id: "default", name: "Yıldız Yarışları" }],
      activeClassId: "default",
      settings: { finishStars: 30 },
      createdAt: Date.now(),
    };
    await firebaseRequest("write", `${teacherCollection}/${teacherUid}`, () => set(teacherRef, data));
  }

  if (!data.shareToken) {
    data.shareToken = makeToken();
    await firebaseRequest("write", `${teacherCollection}/${teacherUid}`, () => update(teacherRef, { shareToken: data.shareToken }));
  }
  shareToken = data.shareToken;
  isTeacher = true;
  data.students = Array.isArray(data.students) && data.students.length ? data.students : defaultStudents;
  data.ways = Array.isArray(data.ways) ? data.ways : defaultWays;
  studentAccessCodes = testMode ? {} : reconcileStudentCodes(data.students, data.studentAccessCodes || {});
  if (!testMode) {
    data.studentAccessCodes = studentAccessCodes;
    await firebaseRequest("write", `${teacherCollection}/${teacherUid}`, () => update(teacherRef, { studentAccessCodes }));
    await publishStudentCredentials();
  }
  await publishTeacherData({ students: data.students, ways: data.ways });
  if (!testMode) publishStudentCodes();
  setLocalScope(`teacher${testMode ? "-test" : ""}-${teacherUid}`);
  publishRoster(data.students);
  publishWays(data.ways || defaultWays);
  starHistory = Array.isArray(data.starHistory) ? data.starHistory : [];
  seasons = Array.isArray(data.seasons) ? data.seasons : [];
  window.dispatchEvent(new CustomEvent("firebase-seasons", { detail: seasons }));
  showShareLink(shareToken);
  showLogin(false);
  message("Öğretmen hesabıyla bağlandı.");

  // Keep the private account document in sync across this teacher's devices.
  privateSubscription?.();
  privateSubscription = onValue(teacherRef, current => {
    if (!current.exists()) return;
    const latest = current.val();
    shareToken = latest.shareToken || shareToken;
    starHistory = Array.isArray(latest.starHistory) ? latest.starHistory : [];
    seasons = Array.isArray(latest.seasons) ? latest.seasons : [];
    studentAccessCodes = testMode ? {} : reconcileStudentCodes(latest.students || data.students, latest.studentAccessCodes || studentAccessCodes);
    if (!testMode) publishStudentCodes();
    window.dispatchEvent(new CustomEvent("firebase-seasons", { detail: seasons }));
    if (Array.isArray(latest.students) && latest.students.length) publishRoster(latest.students);
    publishWays(latest.ways || defaultWays);
    showShareLink(shareToken);
  }, error => {
    message(`Hesap verisi okunamadı (${error.code || "unknown"}). Firebase kurallarını kontrol et.`);
    reportFirebaseError("listen", `${teacherCollection}/${teacherUid}`, error);
  });

  questionProgressSubscription?.();
  questionProgressSubscription = null;
  if (!testMode) {
    questionProgressSubscription = onValue(ref(db, `studentQuestionData/${shareToken}`), snapshot => {
      window.dispatchEvent(new CustomEvent("firebase-question-progress", {
        detail: combineQuestionProgress(snapshot.exists() ? snapshot.val() : {}),
      }));
    }, error => reportFirebaseError("listen", `studentQuestionData/${shareToken}`, error));
  }

  // Make this account the default class only for the original owner. Other teachers
  // share their own unguessable link from the teacher panel.
  if (!testMode && user.email?.toLowerCase() === primaryTeacherEmail) {
    await set(ref(db, "class-race/defaultRosterToken"), shareToken);
  }
}

async function watchStudentRoster(user) {
  if (!user) return;
  studentUid = user.uid;
  let token = requestedRoster;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  if (token) {
    try { localStorage.setItem("yildiz-student-roster-token", token); } catch { /* token remains in the URL */ }
  } else if (standalone) {
    try { token = localStorage.getItem("yildiz-student-roster-token"); } catch { /* use the default roster below */ }
  }
  if (!token) {
    const defaultToken = await firebaseRequest("read", "class-race/defaultRosterToken", () => get(ref(db, "class-race/defaultRosterToken")));
    token = defaultToken.exists() ? defaultToken.val() : null;
  }
  if (typeof token !== "string" || !/^[a-f0-9]{32,64}$/i.test(token)) {
    message("Öğrenci listesi için öğretmen paylaşım bağlantısı gerekli.");
    return;
  }
  activeStudentRoster = token;
  activeStudentId = null;
  setLocalScope(`student-pending-${token}-${studentUid}`);
  rosterSubscription?.();
  const sharedRef = ref(db, `sharedRosters/${token}`);
  const initialRoster = await firebaseRequest("read", `sharedRosters/${token}`, () => get(sharedRef));
  if (!initialRoster.exists()) {
    message("Bu yarış bağlantısı bulunamadı. Öğretmenden yeni bağlantı iste.");
    return;
  }
  publishRoster(initialRoster.val().students);
  publishWays(initialRoster.val().ways || defaultWays);
  window.dispatchEvent(new CustomEvent("firebase-student-roster-ready", { detail: { token } }));
  rosterSubscription = onValue(sharedRef, snapshot => {
    if (!snapshot.exists()) {
      message("Bu yarış bağlantısı bulunamadı. Öğretmenden yeni bağlantı iste.");
      return;
    }
    const shared = snapshot.val();
    publishRoster(shared.students);
    publishWays(shared.ways || defaultWays);
  }, error => {
    message(`Yarış verisine erişilemedi (${error.code || "unknown"}). Öğretmen bağlantısını ve Firebase kurallarını kontrol et.`);
    reportFirebaseError("listen", `sharedRosters/${token}`, error);
  });
  try {
    const sessionPath = `studentSessions/${token}/${studentUid}`;
    const session = await firebaseRequest("read", sessionPath, () => get(ref(db, sessionPath)));
    const studentId = session.exists() ? String(session.val()?.studentId || "") : "";
    if (studentId && (initialRoster.val().students || []).some(student => String(student.id) === studentId)) activateStudentIdentity(studentId);
    else window.dispatchEvent(new CustomEvent("firebase-student-access-required"));
  } catch (error) {
    window.dispatchEvent(new CustomEvent("firebase-student-access-required"));
    console.warn("Öğrenci profili seçimi bekliyor.", error);
  }
}

window.raceCloud = {
  async login(email, password, rememberTeacher) {
    await setPersistence(auth, rememberTeacher ? browserLocalPersistence : browserSessionPersistence);
    return signInWithEmailAndPassword(auth, email.trim(), password);
  },
  async createTeacherAccount(email, password, rememberTeacher) {
    if (!teacherMode || testMode) throw new Error("Hızlı öğretmen hesabı bu ekranda kullanılamıyor.");
    await setPersistence(auth, rememberTeacher ? browserLocalPersistence : browserSessionPersistence);
    return createUserWithEmailAndPassword(auth, email.trim(), password);
  },
  async googleLogin(rememberTeacher) {
    await setPersistence(auth, rememberTeacher ? browserLocalPersistence : browserSessionPersistence);
    return signInWithPopup(auth, new GoogleAuthProvider());
  },
  async logout() { await signOut(auth); },
  async write(roster) {
    if (!isTeacher || !teacherUid || !shareToken) throw new Error("Öğretmen hesabı bağlanmadı.");
    const uid = teacherUid, token = shareToken;
    const students = JSON.parse(JSON.stringify(roster));
    pendingRosterWrites++;
    queuedRoster = students;
    const operation = rosterWriteQueue.catch(() => {}).then(async () => {
      if (!isTeacher || teacherUid !== uid || shareToken !== token) throw new Error("Öğretmen hesabı değişti.");
      const path = `${testMode ? "testTeacherData" : "teacherData"}/${uid}`;
      const updates = { [`${path}/students`]: students };
      if (!testMode) {
        const codes = reconcileStudentCodes(students, studentAccessCodes);
        updates[`${path}/studentAccessCodes`] = codes;
        updates[`sharedRosters/${token}/ownerUid`] = uid;
        updates[`sharedRosters/${token}/students`] = students;
        updates[`studentCredentials/${token}`] = { ownerUid: uid, codes };
      }
      try { await firebaseRequest("write", path, () => update(ref(db), updates)); }
      catch (error) {
        // Restore confirmed state after a rejected optimistic mutation.
        const confirmed = await firebaseRequest("read", path, () => get(ref(db, path)));
        if (teacherUid === uid && confirmed.exists()) {
          publishedRoster = null;
          publishRoster(confirmed.val().students, true);
        }
        throw error;
      }
      return true;
    });
    rosterWriteQueue = operation.finally(() => {
      pendingRosterWrites--;
      if (!pendingRosterWrites) queuedRoster = null;
    });
    return rosterWriteQueue;
  },
  async rotateStudentCode(studentId) {
    if (!isTeacher || testMode || !teacherUid || !shareToken) throw new Error("Öğretmen hesabı bağlanmadı.");
    const id = String(studentId);
    if (!studentAccessCodes[id]) throw new Error("Öğrenci bulunamadı.");
    studentAccessCodes[id] = createStudentCode();
    const teacherPath = `teacherData/${teacherUid}`;
    await firebaseRequest("write", teacherPath, () => update(ref(db, teacherPath), { studentAccessCodes }));
    await publishStudentCredentials();
    publishStudentCodes();
  },
  async authorizeStudent(studentId, accessCode) {
    if (isTeacher || !activeStudentRoster || !studentUid) throw new Error("Öğrenci bağlantısı henüz hazır değil.");
    const id = String(studentId);
    const path = `studentSessions/${activeStudentRoster}/${studentUid}`;
    await firebaseRequest("write", path, () => set(ref(db, path), { studentId: id, accessCode }));
    activateStudentIdentity(id);
    return true;
  },
  async loadQuestionProgress() {
    if (isTeacher || !activeStudentRoster || !activeStudentId) return {};
    const path = `studentQuestionData/${activeStudentRoster}/${activeStudentId}`;
    const snapshot = await firebaseRequest("read", path, () => get(ref(db, path)));
    return snapshot.exists() ? { [activeStudentId]: snapshot.val() } : {};
  },
  async saveQuestionProgress(studentId, progress) {
    if (isTeacher || !activeStudentRoster || !studentUid || String(studentId) !== activeStudentId) throw new Error("Bu öğrenci profili için yetkin yok.");
    const path = `studentQuestionData/${activeStudentRoster}/${activeStudentId}`;
    await firebaseRequest("write", path, () => set(ref(db, path), progress));
  },
  getShareUrl() {
    if (testMode || !shareToken) return null;
    const url = new URL(location.href);
    url.search = `?roster=${encodeURIComponent(shareToken)}`;
    return url.href;
  },
};
window.dispatchEvent(new CustomEvent("firebase-cloud-ready", { detail: { appName: app.name, projectId: firebaseConfig.projectId } }));

if (testMode) {
  const signupButton = document.getElementById("firebaseTeacherSignup");
  if (signupButton) signupButton.hidden = true;
}

document.getElementById("firebaseLoginForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.getElementById("firebaseTeacherEmail").value;
  const passwordInput = document.getElementById("firebaseTeacherPassword");
  const rememberTeacher = document.getElementById("rememberTeacher").checked;
  const button = document.getElementById("firebaseLoginSubmit");
  button.disabled = true;
  message("Giriş yapılıyor…");
  try {
    await window.raceCloud.login(email, passwordInput.value, rememberTeacher);
    passwordInput.value = "";
  } catch (error) {
    message(error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/user-not-found"
      ? "E-posta veya şifre hatalı. Hesabın yoksa “Hızlı hesap oluştur” seçeneğini kullan."
      : "Giriş başarısız: " + (error.message || error.code));
  } finally { button.disabled = false; }
});

document.getElementById("firebaseTeacherSignup")?.addEventListener("click", async event => {
  const button = event.currentTarget;
  const form = document.getElementById("firebaseLoginForm");
  const email = document.getElementById("firebaseTeacherEmail");
  const passwordInput = document.getElementById("firebaseTeacherPassword");
  if (!form?.reportValidity?.()) return;
  const loginButton = document.getElementById("firebaseLoginSubmit");
  const googleButton = document.getElementById("googleTeacherLogin");
  for (const control of [button, loginButton, googleButton]) if (control) control.disabled = true;
  message("Öğretmen hesabı oluşturuluyor…");
  try {
    await window.raceCloud.createTeacherAccount(email.value, passwordInput.value, document.getElementById("rememberTeacher").checked);
    passwordInput.value = "";
    message("Hesap oluşturuldu; öğretmen panelin açılıyor…");
  } catch (error) {
    const messages = {
      "auth/email-already-in-use": "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.",
      "auth/invalid-email": "Geçerli bir e-posta adresi yaz.",
      "auth/weak-password": "Şifren en az 6 karakter olmalı.",
      "auth/operation-not-allowed": "E-posta ve şifreyle kayıt Firebase Authentication ayarlarında etkin değil.",
      "auth/network-request-failed": "Bağlantı kurulamadı. İnternetini kontrol edip yeniden dene.",
    };
    message(messages[error.code] || "Hesap oluşturulamadı: " + (error.message || error.code));
  } finally {
    for (const control of [button, loginButton, googleButton]) if (control) control.disabled = false;
  }
});

document.getElementById("googleTeacherLogin")?.addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  message("Google hesabı açılıyor…");
  try {
    await window.raceCloud.googleLogin(document.getElementById("rememberTeacher").checked);
  } catch (error) {
    message(error.code === "auth/popup-closed-by-user" ? "Google girişi kapatıldı." : "Google girişi başarısız: " + (error.message || error.code));
  } finally { button.disabled = false; }
});

document.getElementById("firebaseLogout")?.addEventListener("click", () => {
  window.raceCloud.logout().catch(error => console.error("Firebase çıkış hatası:", error));
});

window.addEventListener("firebase-local-save", event => {
  if (!isTeacher || suppressRosterSave) return;
  window.raceCloud.write(event.detail).catch(error => {
    const toast = document.getElementById("toast");
    if (toast) { toast.textContent = `Firebase'e kaydedilemedi (${error?.code || "unknown"}).`; toast.classList.add("show"); }
    console.error("Firebase kayıt hatası:", error);
  });
});

window.addEventListener("firebase-student-code-rotate", event => {
  window.raceCloud.rotateStudentCode(event.detail?.studentId).catch(error => {
    const toast = document.getElementById("toast");
    if (toast) { toast.textContent = `Giriş kodu yenilenemedi (${error?.code || "unknown"}).`; toast.classList.add("show"); }
    console.error("Öğrenci kodu yenilenemedi:", error);
  });
});

window.addEventListener("firebase-ways-save", async event => {
  const result = { ok: false };
  try {
    if (!isTeacher || !teacherUid || !shareToken) throw new Error("Öğretmen bağlantısı hazır değil.");
    await publishTeacherData({ ways: event.detail });
    result.ok = true;
  } catch (error) {
    result.code = error?.code || "";
    result.message = error?.message || "Firebase kaydı başarısız.";
    console.error("Yıldız kazanma yolları kaydedilemedi:", error);
  }
  window.dispatchEvent(new CustomEvent("firebase-ways-save-result", { detail: result }));
});

window.addEventListener("firebase-history-save", async event => {
  if (!isTeacher || !teacherUid) return;
  const previous = starHistory;
  starHistory = [...starHistory, event.detail].slice(-2000);
  const path = `${testMode ? "testTeacherData" : "teacherData"}/${teacherUid}`;
  try { await firebaseRequest("write", path, () => update(ref(db, path), { starHistory })); }
  catch (error) { starHistory = previous; showWriteFailure("Yıldız geçmişi kaydedilemedi", error); }
});

window.addEventListener("firebase-season-save", async event => {
  if (!isTeacher || !teacherUid) return;
  const previous = seasons;
  seasons = [...seasons, event.detail].slice(-200);
  const path = `${testMode ? "testTeacherData" : "teacherData"}/${teacherUid}`;
  try { await firebaseRequest("write", path, () => update(ref(db, path), { seasons })); }
  catch (error) { seasons = previous; showWriteFailure("Tur sonuçları kaydedilemedi", error); }
});

window.addEventListener("firebase-share-copy", async () => {
  const url = window.raceCloud.getShareUrl();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    const toast = document.getElementById("toast");
    if (toast) { toast.textContent = "Öğrenci bağlantısı kopyalandı."; toast.classList.add("show"); }
  } catch { window.prompt("Öğrenci bağlantısını kopyala:", url); }
});

onAuthStateChanged(auth, async user => {
  if (teacherMode) {
    if (!user) {
      privateSubscription?.();
      privateSubscription = null;
      isTeacher = false;
      teacherUid = null;
      shareToken = null;
      showLogin(true);
      return;
    }
    if (user.isAnonymous) {
      privateSubscription?.();
      privateSubscription = null;
      isTeacher = false;
      await signOut(auth);
      showLogin(true);
      message("Öğretmen paneli için bir öğretmen hesabıyla giriş yap.");
      return;
    }
    privateSubscription?.();
    privateSubscription = null;
    isTeacher = false;
    try { await initializeTeacher(user); }
    catch (error) {
      isTeacher = false;
      showLogin(true);
      message(`Öğretmen verisi açılamadı (${error.code || "unknown"}). Firebase bağlantı kayıtlarını kontrol et.`);
      reportFirebaseError("teacher initialization", `${testMode ? "testTeacherData" : "teacherData"}/${user.uid}`, error);
    }
    return;
  }

  if (!user) {
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInAnonymously(auth);
    } catch (error) {
      message(`Firebase öğrenci girişi başarısız (${error.code || "unknown"}). Sayfayı yenileyip tekrar dene.`);
      reportFirebaseError("anonymous sign-in", "Firebase Authentication", error);
    }
    return;
  }
  try { await watchStudentRoster(user); }
  catch (error) {
    message(`Öğrenci bağlantısı kurulamadı (${error.code || "unknown"}). Sayfayı yenileyip tekrar dene.`);
    reportFirebaseError("student initialization", requestedRoster ? `sharedRosters/${requestedRoster}` : "class-race/defaultRosterToken", error);
  }
});
