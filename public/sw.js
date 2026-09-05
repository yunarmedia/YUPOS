const CACHE_NAME = 'yupos-shell-v3';

function appUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

const APP_SHELL = [
  appUrl('./'),
  appUrl('./index.html'),
  appUrl('./manifest.webmanifest'),
  appUrl('./assets/icon-192.png'),
  appUrl('./assets/icon-512.png'),
  appUrl('./assets/yupos-loading-logo.png'),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Always prefer the network for the document and service-worker script.
  // This prevents an installed PWA from serving an old JavaScript bundle
  // after a new GitHub Pages deployment.
  const isNavigation = event.request.mode === 'navigate';
  const isAppDocument = url.pathname.endsWith('/index.html');
  const isServiceWorker = url.pathname.endsWith('/sw.js');

  if (isNavigation || isAppDocument || isServiceWorker) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok && !isServiceWorker) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match(appUrl('./index.html'))))
    );
    return;
  }

  // Static hashed Vite assets can remain cache-first; new builds receive new URLs.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
