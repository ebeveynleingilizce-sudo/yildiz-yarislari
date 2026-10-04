(() => {
  'use strict';

  const installButton = document.getElementById('installBtn');
  const helpDialog = document.getElementById('installHelp');
  const closeButton = document.getElementById('installHelpClose');
  const query = new URLSearchParams(location.search);
  const teacherMode = query.has('teacher');
  const testMode = teacherMode && query.get('test') === '1';
  const appTitle = testMode ? 'BLOK YARIŞI Test' : teacherMode ? 'BLOK YARIŞI · Öğretmen' : 'BLOK YARIŞI · Öğrenci';
  let installPrompt = null;
  const displayMode = window.matchMedia('(display-mode: standalone)');
  let installed = displayMode.matches || navigator.standalone === true;
  let prompting = false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isSafari = isIOS && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);

  document.title = appTitle;
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) manifestLink.href = testMode ? './manifest-teacher-test.webmanifest' : teacherMode ? './manifest-teacher.webmanifest' : './manifest-student.webmanifest';
  const touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (touchIcon) touchIcon.href = teacherMode ? './teacher-icon.svg' : './minecraft-test-icon.svg';
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) favicon.href = teacherMode ? './teacher-icon.svg' : './minecraft-test-icon.svg';
  const themeColor = document.getElementById('themeColor');
  if (themeColor) themeColor.content = '#446d52';
  const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitle) appleTitle.content = appTitle;
  const installLabel = isIOS
    ? (/iPad/.test(navigator.userAgent) ? "iPad'e Yükle" : "iPhone'a Yükle")
    : /Android/i.test(navigator.userAgent) ? "Android'e Yükle" : 'Uygulamayı yükle';
  installButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 15v4h14v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>' + installLabel + '</span>';
  installButton.title = appTitle + ' · ' + installLabel;
  installButton.setAttribute('aria-label', installButton.title);
  document.getElementById('installHelpTitle').textContent = teacherMode
    ? '📲 Öğretmen uygulamasını ekle'
    : '📲 Öğrenci uygulamasını ekle';

  function updateInstallButton() {
    installButton.hidden = installed || testMode || !window.isSecureContext || (!installPrompt && !isSafari);
    installButton.disabled = prompting;
  }
  updateInstallButton();
  displayMode.addEventListener('change', event => {
    installed = event.matches || navigator.standalone === true;
    updateInstallButton();
    if (installed) helpDialog.classList.remove('open');
  });

  function showHelp() {
    helpDialog.classList.add('open');
    closeButton.focus();
  }

  function hideHelp() {
    helpDialog.classList.remove('open');
    installButton.focus();
  }

  window.addEventListener('beforeinstallprompt', event => {
    if (installed || testMode || !window.isSecureContext) return;
    event.preventDefault();
    installPrompt = event;
    updateInstallButton();
  });

  installButton.addEventListener('click', async () => {
    if (installed || testMode || prompting || !window.isSecureContext) return;
    if (!installPrompt) {
      if (isSafari) showHelp();
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    prompting = true;
    installButton.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') installed = true;
    } catch (error) {
      console.warn('Kurulum penceresi açılamadı:', error);
    } finally {
      prompting = false;
      updateInstallButton();
    }
  });

  closeButton.addEventListener('click', hideHelp);
  helpDialog.addEventListener('click', event => {
    if (event.target === helpDialog) hideHelp();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && helpDialog.classList.contains('open')) hideHelp();
  });

  const instructions = document.getElementById('installInstructions');
  instructions.textContent = 'Paylaş → Ana Ekrana Ekle';

  window.addEventListener('appinstalled', () => {
    installed = true;
    installPrompt = null;
    helpDialog.classList.remove('open');
    updateInstallButton();
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' })
        .catch(error => console.warn('Uygulama önbelleği başlatılamadı:', error));
    });
  }
})();
