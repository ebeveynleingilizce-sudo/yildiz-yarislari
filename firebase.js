import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase, onValue, ref, set } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { firebaseConfig, teacherEmail } from "./firebase-config.js";

const teacherMode = new URLSearchParams(location.search).has("teacher");
const app = initializeApp(firebaseConfig, teacherMode ? "yildiz-teacher" : "yildiz-student");
const auth = getAuth(app);
const db = getDatabase(app);
const rosterRef = ref(db, "class-race/students");
let isTeacher = false;
let watching = false;

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
  if (!Array.isArray(roster) && roster && typeof roster === "object") {
    roster = Object.values(roster);
  }
  if (!Array.isArray(roster) || !roster.length) return;
  window.dispatchEvent(new CustomEvent("firebase-roster", { detail: roster }));
}

function watchRoster() {
  if (watching) return;
  watching = true;
  onValue(rosterRef, async (snapshot) => {
    if (snapshot.exists()) {
      publishRoster(snapshot.val());
      return;
    }
    // Seed an empty database only from the authenticated teacher's device.
    if (isTeacher) {
      try {
        const local = JSON.parse(localStorage.getItem("class-race-v1") || "null");
        const seed = Array.isArray(local) && local.length ? local : [];
        if (seed.length) await set(rosterRef, seed);
      } catch (error) {
        message("Başlangıç verisi Firebase'e yazılamadı. Bağlantıyı ve kuralları kontrol et.");
        console.error("Firebase başlangıç kaydı başarısız:", error);
      }
    }
  }, (error) => {
    watching = false;
    message("Veritabanına erişilemedi. Güvenlik kurallarını kontrol et.");
    console.error("Firebase veritabanı dinleme hatası:", error);
  });
}

window.raceCloud = {
  async login(email, password, rememberTeacher) {
    await setPersistence(auth, rememberTeacher ? browserLocalPersistence : browserSessionPersistence);
    return signInWithEmailAndPassword(auth, email.trim(), password);
  },
  async logout() {
    await signOut(auth);
  },
  async write(roster) {
    if (!isTeacher) throw new Error("Yalnızca öğretmen hesabı veri değiştirebilir.");
    await set(rosterRef, roster);
    return true;
  },
};

document.getElementById("firebaseLoginForm")?.addEventListener("submit", async (event) => {
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
  } finally {
    button.disabled = false;
  }
});

document.getElementById("firebaseLogout")?.addEventListener("click", () => {
  window.raceCloud.logout().catch((error) => {
    console.error("Firebase çıkış hatası:", error);
  });
});

window.addEventListener("firebase-local-save", (event) => {
  if (!isTeacher) return;
  window.raceCloud.write(event.detail).catch((error) => {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.textContent = "Firebase'e kaydedilemedi. Bağlantı ve yetki kurallarını kontrol et.";
      toast.classList.add("show");
    }
    console.error("Firebase kayıt hatası:", error);
  });
});

onAuthStateChanged(auth, async (user) => {
  if (teacherMode) {
    isTeacher = !!user && user.email?.toLowerCase() === teacherEmail.toLowerCase();
    if (user && !isTeacher) {
      await signOut(auth);
      showLogin(true);
      message("Bu hesap öğretmen hesabı olarak yetkili değil.");
      return;
    }
    showLogin(!isTeacher);
    if (isTeacher) {
      message("Öğretmen hesabıyla bağlandı.");
      watchRoster();
    }
    return;
  }

  if (!user) {
    try {
      await setPersistence(auth, inMemoryPersistence);
      await signInAnonymously(auth);
    } catch (error) {
      message("Öğrenci bağlantısı kurulamadı. Firebase Authentication ayarlarını kontrol et.");
      console.error("Anonim Firebase girişi başarısız:", error);
    }
    return;
  }
  watchRoster();
});
