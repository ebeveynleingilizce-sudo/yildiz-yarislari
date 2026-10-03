const CACHE_NAME = 'yildiz-yarislari-v13';
const BASE_PATH = new URL('./', self.location.href).pathname;
const APP_FILES = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest-student.webmanifest`,
  `${BASE_PATH}manifest-teacher.webmanifest`,
  `${BASE_PATH}manifest-teacher-test.webmanifest`,
  `${BASE_PATH}app-icon.svg`,
  `${BASE_PATH}teacher-icon.svg`,
  `${BASE_PATH}minecraft-test-icon.svg`,
  `${BASE_PATH}pwa.js`
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('yildiz-yarislari-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(`${BASE_PATH}index.html`, copy));
      return response;
    }).catch(() => caches.match(`${BASE_PATH}index.html`)));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  })));
});
