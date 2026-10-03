(() => {
  'use strict';

  const installButton = document.getElementById('installBtn');
  const helpDialog = document.getElementById('installHelp');
  const closeButton = document.getElementById('installHelpClose');
  const query = new URLSearchParams(location.search);
  const teacherMode = query.has('teacher');
  const testMode = teacherMode && query.get('test') === '1';
  const appTitle = testMode ? 'YR Öğretmen Testi' : teacherMode ? 'YR Öğretmen' : 'Yıldız Yarışları';
  let installPrompt = null;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  document.title = appTitle;
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) manifestLink.href = testMode ? './manifest-teacher-test.webmanifest' : teacherMode ? './manifest-teacher.webmanifest' : './manifest-student.webmanifest';
  const touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (touchIcon) touchIcon.href = teacherMode ? './teacher-icon.svg' : './app-icon.svg';
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.content = appTitle;
  const installLabel = isIOS
    ? (/iPad/.test(navigator.userAgent) ? "iPad'e Yükle" : "iPhone'a Yükle")
    : /Android/i.test(navigator.userAgent) ? "Android'e Yükle" : 'Uygulamayı yükle';
  installButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>' + installLabel + '</span>';
  installButton.title = (teacherMode ? 'YR Öğretmen' : 'Yıldız Yarışları') + ' · ' + installLabel;
  installButton.setAttribute('aria-label', installButton.title);
  document.getElementById('installHelpTitle').textContent = teacherMode
    ? '📲 Öğretmen uygulamasını ekle'
    : '📲 Öğrenci uygulamasını ekle';

  if (isStandalone || testMode) installButton.hidden = true;

  function showHelp() {
    helpDialog.classList.add('open');
    closeButton.focus();
  }

  function hideHelp() {
    helpDialog.classList.remove('open');
    installButton.focus();
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
  });

  installButton.addEventListener('click', async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        installButton.hidden = true;
        const toast = document.getElementById('toast');
        toast.textContent = `${teacherMode ? 'Öğretmen' : 'Öğrenci'} uygulaması ana ekrana ekleniyor! ⭐`;
        toast.classList.add('show');
        window.setTimeout(() => toast.classList.remove('show'), 2600);
      }
      installPrompt = null;
      return;
    }
    showHelp();
  });

  closeButton.addEventListener('click', hideHelp);
  helpDialog.addEventListener('click', event => {
    if (event.target === helpDialog) hideHelp();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && helpDialog.classList.contains('open')) hideHelp();
  });

  const instructions = document.getElementById('installInstructions');
  instructions.textContent = isIOS
    ? 'Safari’de Paylaş düğmesine dokun, menüde “Ana Ekrana Ekle”yi seç, “Web Uygulaması Olarak Aç” seçeneğini istersen etkinleştir ve Ekle’ye bas.'
    : 'Android’de bu düğme gerçek kurulum penceresini açar. Masaüstünde tarayıcı menüsündeki “Uygulamayı yükle” seçeneğini kullanabilirsin.';

  window.addEventListener('appinstalled', () => {
    installButton.hidden = true;
    installPrompt = null;
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .catch(error => console.warn('Uygulama önbelleği başlatılamadı:', error));
    });
  }
})();
