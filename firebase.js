import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, browserLocalPersistence, browserSessionPersistence,
  createUserWithEmailAndPassword, onAuthStateChanged, setPersistence, signInAnonymously,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase, get, onValue, ref, runTransaction, set, update } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
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
let publishedRoster = null;
let pendingRosterWrites = 0;
let queuedRoster = null;
let studentConnectionGeneration = 0;
let rosterWriteQueue = Promise.resolve();
let teacherClasses = {};
let activeClassId = null;
let defaultClassId = null;
let classListSubscription = null;
let classGeneration = 0;

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
  if (Array.isArray(roster)) {
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
  await firebaseRequest("write", path, () => set(ref(db, path), { ownerUid: teacherUid, teacherId:teacherUid, classId:activeClassId, codes: studentAccessCodes }));
}

function activateStudentIdentity(studentId) {
  activeStudentId = String(studentId);
  const roster = activeStudentRoster, id = activeStudentId;
  questionProgressSubscription?.();
  const progressRef = ref(db, `studentQuestionData/${roster}/${id}`);
  questionProgressSubscription = onValue(progressRef, snapshot => {
    if (activeStudentRoster !== roster || activeStudentId !== id) return;
    const progress = snapshot.exists() ? snapshot.val() : null;
    window.dispatchEvent(new CustomEvent("firebase-question-progress", { detail: progress ? { [id]: progress } : {} }));
  }, error => reportFirebaseError("listen", `studentQuestionData/${roster}/${id}`, error));
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


function accountPath() { return `${testMode ? "testTeacherData" : "teacherData"}/${teacherUid}`; }
function classPath(id = activeClassId) { if (!id || !teacherClasses[id]) throw new Error("Önce sınıf seç."); return `${accountPath()}/classData/${id}`; }
function emitClasses() {
  window.dispatchEvent(new CustomEvent("firebase-classes", { detail: { classes: Object.values(teacherClasses), activeClassId, teacherId: teacherUid } }));
}
async function saveClassRoster(id, roster, codes, extra = {}) {
  const cls = teacherClasses[id];
  if (!cls) throw new Error("Sınıf bulunamadı.");
  const students = roster.map(s => ({...s, teacherId: teacherUid, classId:id}));
  const path = classPath(id), updates = { [path + "/students"]: students, [path + "/studentAccessCodes"]: codes };
  if (id === defaultClassId) { updates[accountPath()+"/students"] = students; updates[accountPath()+"/studentAccessCodes"] = codes; }
  if (!testMode) {
    updates["sharedRosters/"+cls.shareToken] = { ownerUid:teacherUid, teacherId:teacherUid, classId:id, className:cls.name, students, ways:extra.ways || [] };
    updates["studentCredentials/"+cls.shareToken] = { ownerUid:teacherUid, teacherId:teacherUid, classId:id, codes };
  }
  Object.assign(updates, extra.updates || {});
  await firebaseRequest("write",path,()=>update(ref(db),updates));
}
async function switchClass(id) {
  if (!isTeacher || !teacherClasses[id]) throw new Error("Sınıf bulunamadı.");
  await rosterWriteQueue.catch(()=>{});
  const generation = ++classGeneration;
  privateSubscription?.(); questionProgressSubscription?.();
  privateSubscription = questionProgressSubscription = null;
  activeClassId=id; shareToken=teacherClasses[id].shareToken;
  try{localStorage.setItem("yildiz-active-class-"+teacherUid,id);}catch{}
  publishedRoster=null;
  setLocalScope(`teacher${testMode?"-test":""}-${teacherUid}-${id}`);
  emitClasses();
  const consume = snapshot => {
    if (generation!==classGeneration || !snapshot.exists()) return;
    const data=snapshot.val();
    studentAccessCodes=data.studentAccessCodes || {};
    publishStudentCodes(); publishRoster(data.students || []);
    publishWays(data.ways || defaultWays);
    starHistory=data.starHistory || []; seasons=data.seasons || [];
    window.dispatchEvent(new CustomEvent("firebase-seasons",{detail:seasons}));
    showShareLink(shareToken);
  };
  const reference=ref(db,classPath(id));
  consume(await get(reference));
  privateSubscription=onValue(reference,consume,error=>showWriteFailure("Sınıf okunamadı",error));
  if (!testMode) questionProgressSubscription=onValue(ref(db,"studentQuestionData/"+shareToken),snapshot=>{
    if(generation===classGeneration) window.dispatchEvent(new CustomEvent("firebase-question-progress",{detail:combineQuestionProgress(snapshot.val())}));
  },error=>reportFirebaseError("listen","studentQuestionData/"+shareToken,error));
}
async function migrateClasses(data, teacherRef) {
  if(data.classSchemaVersion===1&&data.classData&&data.classes)return data;
  const id=makeToken();
  const result=await runTransaction(teacherRef,current=>{
    if(!current)current=data;
    if(!current)return;
    if(current.classSchemaVersion===1)return current;
    const token=current.shareToken,students=(Array.isArray(current.students)?current.students:defaultStudents).map(s=>({...s,teacherId:teacherUid,classId:id}));
    const cls={classId:id,teacherId:teacherUid,name:"Varsayılan Sınıf",shareToken:token};
    return {...current,classSchemaVersion:1,defaultClassId:id,classes:{[id]:cls},classTokens:{[token]:id},
      legacyClassesBackup:current.classes||[],legacyStudentsBackup:current.students||[],legacyStudentAccessCodesBackup:current.studentAccessCodes||{},legacySeasonsBackup:current.seasons||[],legacyStarHistoryBackup:current.starHistory||[],
      classData:{[id]:{students,studentAccessCodes:reconcileStudentCodes(students,current.studentAccessCodes||{}),ways:current.ways||defaultWays,starHistory:current.starHistory||[],seasons:current.seasons||[],settings:current.settings||{finishStars:30}}}};
  },{applyLocally:false});
  if(!result.committed)throw new Error("Sınıf geçişi tamamlanamadı.");
  return result.snapshot.val();
}

async function publishTeacherData(data) {
  const path=classPath();
  const updates={[path]:{...(await get(ref(db,path))).val(),...data}};
  if(!testMode) {
    const cls=teacherClasses[activeClassId];
    if(Object.hasOwn(data,"ways")) updates["sharedRosters/"+cls.shareToken+"/ways"]=data.ways;
  }
  await update(ref(db),updates);
}

async function initializeTeacher(user) {
  teacherUid = user.uid;
  const teacherCollection = testMode ? "testTeacherData" : "teacherData";
  const teacherRef = ref(db, `${teacherCollection}/${teacherUid}`);
  const snapshot = await firebaseRequest("read", `${teacherCollection}/${teacherUid}`, () => get(teacherRef));
  let data = snapshot.exists() ? snapshot.val() : null;
  const brandNewAccount = !data;

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
  const needsMigration=data.classSchemaVersion!==1;
  data=await migrateClasses(data,teacherRef);
  teacherClasses=data.classes; defaultClassId=data.defaultClassId;
  // Publish each class separately. Existing default codes and progress keep their token.
  for (const cls of needsMigration ? Object.values(teacherClasses) : []) {
    const record=data.classData[cls.classId];
    if(brandNewAccount)await saveClassRoster(cls.classId,record.students||[],record.studentAccessCodes||{}, {ways:record.ways||defaultWays});
    else if(!testMode)await update(ref(db),{
      ["sharedRosters/"+cls.shareToken+"/teacherId"]:teacherUid,["sharedRosters/"+cls.shareToken+"/classId"]:cls.classId,["sharedRosters/"+cls.shareToken+"/className"]:cls.name,
      ["studentCredentials/"+cls.shareToken+"/teacherId"]:teacherUid,["studentCredentials/"+cls.shareToken+"/classId"]:cls.classId
    });
  }
  classListSubscription?.();
  classListSubscription=onValue(ref(db,accountPath()+"/classes"),snapshot=>{
    if(snapshot.exists()) {teacherClasses=snapshot.val();emitClasses();}
  });
  let remembered;try{remembered=localStorage.getItem("yildiz-active-class-"+teacherUid);}catch{}
  await switchClass(teacherClasses[remembered]?remembered:defaultClassId);
  showLogin(false);
  message("Öğretmen hesabıyla bağlandı.");
  // Make this account the default class only for the original owner. Other teachers
  // share their own unguessable link from the teacher panel.
  if (!testMode && user.email?.toLowerCase() === primaryTeacherEmail) {
    await set(ref(db, "class-race/defaultRosterToken"), shareToken);
  }
}

function requireStudentConnection() {
  studentConnectionGeneration++;
  rosterSubscription?.(); rosterSubscription = null;
  questionProgressSubscription?.(); questionProgressSubscription = null;
  activeStudentId = null;
  activeStudentRoster = null;
  try { localStorage.removeItem("yildiz-student-roster-token"); } catch { /* fail closed */ }
  setLocalScope("student-disconnected");
  window.dispatchEvent(new CustomEvent("firebase-student-access-required"));
}

async function connectStudentRoster(token, sessionConfirmed = false) {
  const generation = ++studentConnectionGeneration;
  rosterSubscription?.(); rosterSubscription = null;
  questionProgressSubscription?.(); questionProgressSubscription = null;
  activeStudentId = null;
  if (typeof token !== "string" || !/^[a-f0-9]{32,64}$/i.test(token)) {
    throw new Error("Öğretmen bağlantı kodu geçersiz.");
  }
  const sharedRef = ref(db, `sharedRosters/${token}`);
  const sessionPath = `studentSessions/${token}/${studentUid}`;
  const session = await firebaseRequest("read", sessionPath, () => get(ref(db, sessionPath)));
  const studentId = session.exists() ? String(session.val()?.studentId || "") : "";
  if (!studentId) throw new Error("Öğrenci bağlantısı gerekli.");
  // Revalidate a remembered session with a server-acknowledged write. A cached
  // offline read must not unlock a revoked class connection.
  if (!sessionConfirmed) await firebaseRequest("write", sessionPath, () => set(ref(db, sessionPath), session.val()));
  const initialRoster = await firebaseRequest("read", `sharedRosters/${token}`, () => get(sharedRef));
  if (!initialRoster.exists() || !studentId || !Object.values(initialRoster.val().students || {}).some(student => String(student.id) === studentId)) throw new Error("Öğrenci bağlantısı kaldırılmış.");
  if (generation !== studentConnectionGeneration) return;
  activeStudentRoster = token;
  setLocalScope(`student-${token}-${studentId}`);
  window.dispatchEvent(new CustomEvent("firebase-class-context",{detail:{teacherId:initialRoster.val().teacherId||initialRoster.val().ownerUid,classId:initialRoster.val().classId,className:initialRoster.val().className}}));
  publishRoster(initialRoster.val().students);
  publishWays(initialRoster.val().ways || defaultWays);
  activateStudentIdentity(studentId);
  try { localStorage.setItem("yildiz-student-roster-token", token); } catch { /* session remains in Firebase */ }
  window.dispatchEvent(new CustomEvent("firebase-student-roster-ready", { detail: { token } }));
  rosterSubscription = onValue(sharedRef, snapshot => {
    if (generation !== studentConnectionGeneration) return;
    if (!snapshot.exists() || !Object.values(snapshot.val().students || {}).some(student => String(student.id) === activeStudentId)) {
      requireStudentConnection();
      message("Öğrenci bağlantısı kaldırılmış. Öğretmeninden yeni kod iste.");
      return;
    }
    const shared = snapshot.val();
    window.dispatchEvent(new CustomEvent("firebase-class-context",{detail:{teacherId:shared.teacherId||shared.ownerUid,classId:shared.classId,className:shared.className}}));
    publishRoster(shared.students);
    publishWays(shared.ways || defaultWays);
  }, error => {
    if (generation !== studentConnectionGeneration) return;
    requireStudentConnection();
    message(`Yarış verisine erişilemedi (${error.code || "unknown"}). Öğretmen bağlantısını ve Firebase kurallarını kontrol et.`);
    reportFirebaseError("listen", `sharedRosters/${token}`, error);
  });
}

async function watchStudentRoster(user) {
  if (!user) { requireStudentConnection(); return; }
  studentUid = user.uid;
  let token = requestedRoster;
  if (!token) { try { token = localStorage.getItem("yildiz-student-roster-token"); } catch { /* require a code */ } }
  if (!token) { requireStudentConnection(); return; }
  try { await connectStudentRoster(token); }
  catch { requireStudentConnection(); message("Öğretmeninden aldığın kodu gir."); }
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
    if(!isTeacher||!activeClassId)throw new Error("Önce sınıf seç.");
    const uid=teacherUid,id=activeClassId,token=shareToken;
    const students=JSON.parse(JSON.stringify(roster)).map(s=>({...s,teacherId:uid,classId:id}));
    pendingRosterWrites++;queuedRoster=students;
    const operation=rosterWriteQueue.catch(()=>{}).then(async()=>{
      if(teacherUid!==uid||activeClassId!==id)throw new Error("Sınıf değişti.");
      const path=classPath(id),record=(await get(ref(db,path))).val()||{};
      try {await saveClassRoster(id,students,reconcileStudentCodes(students,record.studentAccessCodes||{}),{ways:record.ways||defaultWays});}
      catch(error){const confirmed=await get(ref(db,path));publishedRoster=null;publishRoster(confirmed.val()?.students||[],true);throw error;}
      return true;
    });
    rosterWriteQueue=operation.finally(()=>{pendingRosterWrites--;if(!pendingRosterWrites)queuedRoster=null;});
    return rosterWriteQueue;
  },
  async selectClass(id){return switchClass(id);},
  async createClass(name){
    name=String(name||"").trim().slice(0,60);if(!isTeacher||!name)throw new Error("Sınıf adı gerekli.");
    await rosterWriteQueue.catch(()=>{});
    const classId=makeToken(),token=makeToken(),cls={classId,teacherId:teacherUid,name,shareToken:token};
    await update(ref(db,accountPath()),{["classes/"+classId]:cls,["classTokens/"+token]:classId,["classData/"+classId]:{students:[],studentAccessCodes:{},ways:defaultWays,seasons:[],starHistory:[]}});
    teacherClasses[classId]=cls;
    await saveClassRoster(classId,[],{},{ways:defaultWays});await switchClass(classId);return cls;
  },
  async renameClass(id,name){
    name=String(name||"").trim().slice(0,60);if(!teacherClasses[id]||!name)throw new Error("Sınıf adı gerekli.");
    const cls=teacherClasses[id],updates={[accountPath()+"/classes/"+id+"/name"]:name};
    if(!testMode)updates["sharedRosters/"+cls.shareToken+"/className"]=name;
    await update(ref(db),updates);teacherClasses[id].name=name;emitClasses();
  },
  async moveStudent(studentId,targetId,sourceId=activeClassId){
    await rosterWriteQueue.catch(()=>{});
    if(!teacherClasses[targetId]||targetId===sourceId)throw new Error("Başka bir sınıf seç.");
    const src=(await get(ref(db,classPath(sourceId)))).val(),dest=(await get(ref(db,classPath(targetId)))).val();
    const student=(src.students||[]).find(s=>String(s.id)===String(studentId));if(!student)throw new Error("Öğrenci bulunamadı.");
    const others=(src.students||[]).filter(s=>String(s.id)!==String(studentId)),target=dest.students||[];
    const newId=target.some(s=>String(s.id)===String(studentId))?Math.max(0,...target.map(s=>Number(s.id)||0))+1:student.id;
    target.push({...student,id:newId,classId:targetId,teacherId:teacherUid});
    const changes={},cls=teacherClasses[sourceId],to=teacherClasses[targetId];
    for(const [id,roster,codes,ways] of [[sourceId,others,reconcileStudentCodes(others,src.studentAccessCodes),src.ways],[targetId,target,reconcileStudentCodes(target,dest.studentAccessCodes),dest.ways]]) {
      const c=teacherClasses[id];changes[classPath(id)+"/students"]=roster;changes[classPath(id)+"/studentAccessCodes"]=codes;
      if(id===defaultClassId){changes[accountPath()+"/students"]=roster;changes[accountPath()+"/studentAccessCodes"]=codes;}
      if(!testMode){changes["sharedRosters/"+c.shareToken]={ownerUid:teacherUid,teacherId:teacherUid,classId:id,className:c.name,students:roster,ways:ways||defaultWays};changes["studentCredentials/"+c.shareToken]={ownerUid:teacherUid,teacherId:teacherUid,classId:id,codes};}
    }
    if(!testMode){const progress=(await get(ref(db,"studentQuestionData/"+cls.shareToken+"/"+student.id))).val();if(progress)changes["studentQuestionData/"+to.shareToken+"/"+newId]=progress;}
    await update(ref(db),changes);return newId;
  },
  async deleteClass(id,targetId){
    if(!teacherClasses[id]||Object.keys(teacherClasses).length<=1)throw new Error("Son sınıf silinemez.");
    const record=(await get(ref(db,classPath(id)))).val();
    if((record.students||[]).length&&!teacherClasses[targetId])throw new Error("Öğrencilerin taşınacağı sınıfı seç.");
    for(const student of record.students||[])await this.moveStudent(student.id,targetId,id);
    const token=teacherClasses[id].shareToken;
    if(activeClassId===id)await switchClass(targetId||Object.keys(teacherClasses).find(key=>key!==id));
    const updates={[accountPath()+"/classes/"+id]:null,[accountPath()+"/classData/"+id]:null,[accountPath()+"/classTokens/"+token]:null};
    // Keep historical question data and legacy backups; revoked credentials block old codes.
    if(!testMode){updates["sharedRosters/"+token]=null;updates["studentCredentials/"+token]=null;}
    if(id===defaultClassId){defaultClassId=activeClassId;const replacement=(await get(ref(db,classPath(defaultClassId)))).val();updates[accountPath()+"/defaultClassId"]=defaultClassId;updates[accountPath()+"/shareToken"]=teacherClasses[defaultClassId].shareToken;updates[accountPath()+"/students"]=replacement.students||[];updates[accountPath()+"/studentAccessCodes"]=replacement.studentAccessCodes||{};}
    const archived={...record,class:teacherClasses[id],archivedAt:Date.now()};updates[accountPath()+"/classArchives/"+id]=archived;
    if(id===defaultClassId){/* replacement selected above */}
    await update(ref(db),updates);delete teacherClasses[id];emitClasses();
  },
  async rotateStudentCode(studentId) {
    if (!isTeacher || testMode || !teacherUid || !shareToken) throw new Error("Öğretmen hesabı bağlanmadı.");
    const id = String(studentId);
    if (!studentAccessCodes[id]) throw new Error("Öğrenci bulunamadı.");
    studentAccessCodes[id] = createStudentCode();
    const teacherPath = classPath();
    await firebaseRequest("write", teacherPath, () => update(ref(db, teacherPath), { studentAccessCodes }));
    await publishStudentCredentials();
    publishStudentCodes();
  },
  async authorizeStudent(studentId, accessCode) {
    if (isTeacher || !studentUid) throw new Error("Öğrenci bağlantısı henüz hazır değil.");
    let token = activeStudentRoster || requestedRoster, id = String(studentId || "");
    const parts = String(accessCode || "").trim().split(":");
    if (parts.length === 3) [token, id, accessCode] = parts;
    token = token?.toLowerCase();
    if (!/^[a-f0-9]{32,64}$/.test(token || "") || !/^\d+$/.test(id) || !/^[A-Z2-9]{8}$/.test(accessCode)) throw new Error("STUDENT_CODE_INVALID");
    requireStudentConnection();
    const path = `studentSessions/${token}/${studentUid}`;
    await firebaseRequest("write", path, () => set(ref(db, path), { studentId: id, accessCode }));
    await connectStudentRoster(token, true);
    return true;
  },
  getStudentConnectionCode(studentId, code) {
    if (!isTeacher || testMode || !shareToken || studentAccessCodes[String(studentId)] !== code) return "";
    return `${shareToken}:${studentId}:${code}`;
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
  const path = classPath();
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
    questionProgressSubscription?.(); questionProgressSubscription = null;
    if (!user) {
      privateSubscription?.();classListSubscription?.();
      privateSubscription = null;classListSubscription=null;
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
      const errorDetail = error?.code && error.code !== "unknown" ? error.code : error?.message || "unknown";
      message(`Öğretmen verisi açılamadı (${errorDetail}). Firebase bağlantı kayıtlarını kontrol et.`);
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
