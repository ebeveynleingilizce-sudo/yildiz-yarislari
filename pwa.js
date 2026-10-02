(() => {
  'use strict';

  const installButton = document.getElementById('installBtn');
  const helpDialog = document.getElementById('installHelp');
  const closeButton = document.getElementById('installHelpClose');
  let installPrompt = null;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isStandalone) installButton.hidden = true;

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
        toast.textContent = 'Yıldız Yarışları ana ekranına ekleniyor! ⭐';
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
    ? 'Safari’de Paylaş düğmesine dokun, ardından “Ana Ekrana Ekle”yi seçip Ekle’ye bas.'
    : 'Tarayıcı menüsünden “Uygulamayı yükle” veya “Ana ekrana ekle” seçeneğine dokun. Chrome’da bu seçenek genellikle ⋮ menüsündedir.';

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
