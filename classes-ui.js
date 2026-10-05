(() => {
  'use strict';
  if (!new URLSearchParams(location.search).has('teacher')) return;
  const controls = document.getElementById('controls');
  const bar = document.createElement('div');
  bar.className='class-management';
  bar.innerHTML = '<label>Sınıf: <select id="classSelect" aria-label="Aktif sınıf"></select></label><button class="action-btn" id="createClass" type="button">+ Sınıf Oluştur</button><button class="action-btn" id="renameClass" type="button">Sınıf adını değiştir</button><button class="action-btn danger" id="deleteClass" type="button">Sınıfı sil</button>';
  controls.insertBefore(bar, document.getElementById('addStudent'));
  const badge = document.createElement('span');
  badge.id = 'activeClassBadge';
  document.querySelector('.race-meta').prepend(badge);
  let state = { classes: [], activeClassId: null };
  const dialog = document.createElement('div');
  dialog.className = 'character-overlay';
  dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','classDialogTitle');
  dialog.innerHTML = '<form class="character-dialog class-dialog"><button type="button" class="icon-btn character-close" id="classDialogClose" aria-label="Kapat">✕</button><h2 id="classDialogTitle"></h2><label id="classNameLabel">Sınıf adı<input id="classNameInput" maxlength="60" required></label><label id="classTargetLabel">Öğrencilerin taşınacağı sınıf<select id="classTarget"></select></label><p id="classDialogMessage" role="status"></p><button class="action-btn primary" type="submit" id="classDialogSave">Kaydet</button></form>';
  document.body.appendChild(dialog);
  let action, studentId, previousFocus;
  const byId = id => document.getElementById(id);
  const current = () => state.classes.find(c => c.classId === state.activeClassId);
  function targets() {
    byId('classTarget').replaceChildren();
    for(const cls of state.classes.filter(c=>c.classId!==state.activeClassId)) {
      const option=document.createElement('option');option.value=cls.classId;option.textContent=cls.name;byId('classTarget').appendChild(option);
    }
  }
  function close(){dialog.classList.remove('open');previousFocus?.focus();}
  function open(mode,id) {
    previousFocus=document.activeElement;action=mode;studentId=id;
    byId('classNameLabel').hidden=!['create','rename'].includes(mode);
    byId('classTargetLabel').hidden=['create','rename'].includes(mode);
    byId('classNameInput').required=['create','rename'].includes(mode);
    byId('classNameInput').value=mode==='rename'?current().name:'';
    targets();
    byId('classDialogTitle').textContent={create:'Sınıf oluştur',rename:'Sınıf adını değiştir',delete:'Sınıfı sil · Öğrencileri güvenle taşı',move:'Öğrenciyi başka sınıfa taşı'}[mode];
    byId('classDialogMessage').textContent=mode==='delete'?'Öğrenciler seçtiğin sınıfa taşınır. Eski giriş kodları geçersiz olur; yeni sınıftaki kodları kullan.':mode==='move'?'XP ve ilerleme korunur. Öğrenci yeni sınıfının koduyla giriş yapar.':'';
    byId('classDialogSave').disabled=mode==='move'&&state.classes.length<2;
    dialog.classList.add('open');
    (byId('classNameLabel').hidden?byId('classTarget'):byId('classNameInput')).focus();
  }
  byId('createClass').onclick=()=>open('create');
  byId('renameClass').onclick=()=>open('rename');
  byId('deleteClass').onclick=()=>open('delete');
  byId('classDialogClose').onclick=close;
  dialog.onclick=e=>{if(e.target===dialog)close();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  byId('classSelect').onchange=async e=>{try{await window.raceCloud.selectClass(e.target.value);}catch(error){e.target.value=state.activeClassId;byId('toast').textContent=error.message;byId('toast').classList.add('show');}};
  byId('studentControls').addEventListener('click',e=>{const button=e.target.closest('[data-move-student]');if(button)open('move',button.dataset.moveStudent);});
  dialog.querySelector('form').onsubmit=async e=>{
    e.preventDefault();byId('classDialogSave').disabled=true;
    try{
      const cloud=window.raceCloud,name=byId('classNameInput').value,target=byId('classTarget').value;
      if(action==='create')await cloud.createClass(name);
      if(action==='rename')await cloud.renameClass(state.activeClassId,name);
      if(action==='move')await cloud.moveStudent(studentId,target);
      if(action==='delete')await cloud.deleteClass(state.activeClassId,target);
      close();
    }catch(error){byId('classDialogMessage').textContent=error.message;}
    finally{byId('classDialogSave').disabled=false;}
  };
  window.addEventListener('firebase-classes',e=>{
    state=e.detail;const select=byId('classSelect');select.replaceChildren();
    for(const cls of state.classes){const option=document.createElement('option');option.value=cls.classId;option.textContent=cls.name;select.appendChild(option);}
    select.value=state.activeClassId;badge.textContent=current()?.name||'';
    byId('deleteClass').disabled=state.classes.length<=1;
    byId('addStudent').disabled=!current();
  });
  byId('addStudent').disabled=true;
})();
