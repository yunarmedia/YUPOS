const CACHE_NAME = 'yupos-shell-v4';

function appUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

const APP_SHELL = [
  appUrl('./'),
  appUrl('./index.html'),
  appUrl('./manifest.webmanifest'),
  appUrl('./assets/icon-192.png'),
  appUrl('./assets/icon-512.png'),
  appUrl('./assets/yupos-app-icon.png'),
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

  // Always prefer the network for HTML, manifest, icons and the service worker.
  // This prevents GitHub Pages/PWA cache from keeping stale install metadata.
  const isNavigation = event.request.mode === 'navigate';
  const isAppDocument = url.pathname.endsWith('/index.html');
  const isManifest = url.pathname.endsWith('/manifest.webmanifest');
  const isServiceWorker = url.pathname.endsWith('/sw.js');
  const isAppIcon = /\/assets\/(icon-192|icon-512|yupos-app-icon)\.png$/.test(url.pathname);

  if (isNavigation || isAppDocument || isManifest || isServiceWorker || isAppIcon) {
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
