import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, browserLocalPersistence, browserSessionPersistence,
  inMemoryPersistence, onAuthStateChanged, setPersistence, signInAnonymously,
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
let rosterSubscription = null;
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
  const target = document.getElementById("firebaseLoginMessage");
  if (target) target.textContent = text;
}

function showLogin(show) {
  document.getElementById("firebaseLoginOverlay")?.classList.toggle("open", show);
  const settings = document.getElementById("settingsBtn");
  if (settings && teacherMode) settings.style.display = show ? "none" : "";
}

function publishRoster(raw) {
  let roster = raw;
  if (!Array.isArray(roster) && roster && typeof roster === "object") roster = Object.values(roster);
  if (Array.isArray(roster) && roster.length) {
    window.dispatchEvent(new CustomEvent("firebase-roster", { detail: roster }));
  }
}

function publishWays(ways) {
  const safeWays = Array.isArray(ways) ? ways : defaultWays;
  window.dispatchEvent(new CustomEvent("firebase-ways", { detail: safeWays }));
}

function makeToken() {
  if (crypto.randomUUID) return crypto.randomUUID().replaceAll("-", "");
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function setLocalScope(scope) {
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
  const teacherRef = ref(db, `${teacherCollection}/${teacherUid}`);
  const updates = [update(teacherRef, data)];
  if (testMode) {
    await Promise.all(updates);
    return;
  }
  const shareRef = ref(db, `sharedRosters/${shareToken}`);
  const sharedUpdate = { ownerUid: teacherUid };
  if (Object.hasOwn(data, "students")) sharedUpdate.students = data.students;
  if (Object.hasOwn(data, "ways")) sharedUpdate.ways = data.ways;
  updates.push(update(shareRef, sharedUpdate));
  await Promise.all(updates);
}

async function initializeTeacher(user) {
  teacherUid = user.uid;
  const teacherCollection = testMode ? "testTeacherData" : "teacherData";
  const teacherRef = ref(db, `${teacherCollection}/${teacherUid}`);
  const snapshot = await get(teacherRef);
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
      ways: defaultWays,
      starHistory: [],
      seasons: [],
      classes: [{ id: "default", name: "Yıldız Yarışları" }],
      activeClassId: "default",
      settings: { finishStars: 30 },
      createdAt: Date.now(),
    };
    await set(teacherRef, data);
  }

  if (!data.shareToken) {
    data.shareToken = makeToken();
    await update(teacherRef, { shareToken: data.shareToken });
  }
  shareToken = data.shareToken;
  isTeacher = true;
  data.students = Array.isArray(data.students) && data.students.length ? data.students : defaultStudents;
  data.ways = Array.isArray(data.ways) ? data.ways : defaultWays;
  await publishTeacherData({ students: data.students, ways: data.ways });
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
    window.dispatchEvent(new CustomEvent("firebase-seasons", { detail: seasons }));
    if (Array.isArray(latest.students) && latest.students.length) publishRoster(latest.students);
    publishWays(latest.ways || defaultWays);
    showShareLink(shareToken);
  }, error => {
    message("Hesap verisi okunamadı. Firebase kurallarını kontrol et.");
    console.error("Öğretmen hesabı dinleme hatası:", error);
  });

  // Make this account the default class only for the original owner. Other teachers
  // share their own unguessable link from the teacher panel.
  if (!testMode && user.email?.toLowerCase() === primaryTeacherEmail) {
    await set(ref(db, "class-race/defaultRosterToken"), shareToken);
  }
}

async function watchStudentRoster(user) {
  if (!user) return;
  let token = requestedRoster;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  if (token) {
    try { localStorage.setItem("yildiz-student-roster-token", token); } catch { /* token remains in the URL */ }
  } else if (standalone) {
    try { token = localStorage.getItem("yildiz-student-roster-token"); } catch { /* use the default roster below */ }
  }
  if (!token) {
    const defaultToken = await get(ref(db, "class-race/defaultRosterToken"));
    token = defaultToken.exists() ? defaultToken.val() : null;
  }
  if (typeof token !== "string" || !/^[a-f0-9]{32,64}$/i.test(token)) {
    message("Öğrenci listesi için öğretmen paylaşım bağlantısı gerekli.");
    return;
  }
  activeStudentRoster = token;
  setLocalScope(`roster-${token}`);
  rosterSubscription?.();
  rosterSubscription = onValue(ref(db, `sharedRosters/${token}`), snapshot => {
    if (!snapshot.exists()) {
      message("Bu yarış bağlantısı bulunamadı. Öğretmenden yeni bağlantı iste.");
      return;
    }
    const shared = snapshot.val();
    publishRoster(shared.students);
    publishWays(shared.ways || defaultWays);
  }, error => {
    message("Yarış verisine erişilemedi. Öğretmen bağlantısını ve Firebase kurallarını kontrol et.");
    console.error("Öğrenci yarış listesini dinleme hatası:", error);
  });
}

window.raceCloud = {
  async login(email, password, rememberTeacher) {
    await setPersistence(auth, rememberTeacher ? browserLocalPersistence : browserSessionPersistence);
    return signInWithEmailAndPassword(auth, email.trim(), password);
  },
  async googleLogin(rememberTeacher) {
    await setPersistence(auth, rememberTeacher ? browserLocalPersistence : browserSessionPersistence);
    return signInWithPopup(auth, new GoogleAuthProvider());
  },
  async logout() { await signOut(auth); },
  async write(roster) {
    if (!isTeacher || !teacherUid || !shareToken) throw new Error("Öğretmen hesabı bağlanmadı.");
    await publishTeacherData({ students: roster });
    return true;
  },
  getShareUrl() {
    if (testMode || !shareToken) return null;
    const url = new URL(location.href);
    url.search = `?roster=${encodeURIComponent(shareToken)}`;
    return url.href;
  },
};

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
    message(error.code === "auth/invalid-credential" || error.code === "auth/wrong-password"
      ? "E-posta veya parola hatalı. Firebase Authentication hesabını kontrol et."
      : "Giriş başarısız: " + (error.message || error.code));
  } finally { button.disabled = false; }
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
    if (toast) { toast.textContent = "Firebase'e kaydedilemedi. Bağlantı ve yetki kurallarını kontrol et."; toast.classList.add("show"); }
    console.error("Firebase kayıt hatası:", error);
  });
});

window.addEventListener("firebase-ways-save", event => {
  if (!isTeacher || !teacherUid || !shareToken) return;
  publishTeacherData({ ways: event.detail }).catch(error => console.error("Yıldız kazanma yolları kaydedilemedi:", error));
});

window.addEventListener("firebase-history-save", event => {
  if (!isTeacher || !teacherUid) return;
  starHistory = [...starHistory, event.detail].slice(-2000);
  update(ref(db, `${testMode ? "testTeacherData" : "teacherData"}/${teacherUid}`), { starHistory }).catch(error => console.error("Yıldız geçmişi kaydedilemedi:", error));
});

window.addEventListener("firebase-season-save", event => {
  if (!isTeacher || !teacherUid) return;
  seasons = [...seasons, event.detail].slice(-200);
  update(ref(db, `${testMode ? "testTeacherData" : "teacherData"}/${teacherUid}`), { seasons }).catch(error => console.error("Tur sonuçları kaydedilemedi:", error));
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
      message("Öğretmen verisi açılamadı: Firebase Realtime Database kurallarını yayımla.");
      console.error("Öğretmen verisi başlatılamadı:", error);
    }
    return;
  }

  if (!user) {
    try {
      await setPersistence(auth, inMemoryPersistence);
      await signInAnonymously(auth);
    } catch (error) {
      message("Öğrenci bağlantısı kurulamadı. Firebase Authentication'da Anonymous girişini etkinleştir.");
      console.error("Anonim Firebase girişi başarısız:", error);
    }
    return;
  }
  try { await watchStudentRoster(user); }
  catch (error) {
    message("Yarış bağlantısı kurulamadı. Firebase kurallarını ve paylaşım bağlantısını kontrol et.");
    console.error("Öğrenci bağlantısı kurulamadı:", error);
  }
});
