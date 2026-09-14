// Training Log — app-shell service worker
// Scope: caches ONLY the static shell (HTML, CDN libraries, manifest, icons) so the app can
// still boot on a flaky connection. Every other request (Supabase, the Claude proxy, exercise
// images) is left completely untouched — this worker never intercepts, caches, or delays live
// data, only the code needed to render the page.
//
// Caching strategy is deliberately split:
//   - index.html / the app root  -> NETWORK FIRST. The HTML is the app; serving a stale copy
//     meant every upload only appeared on the *second* open. Online you always get the latest;
//     offline it falls back to the cached copy.
//   - CDN libraries, icons, manifest -> CACHE FIRST (stale-while-revalidate). These are
//     version-pinned or effectively immutable, so serving them instantly is free speed.

const CACHE_NAME = 'training-log-shell-v2';

const RELATIVE_PATHS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png',
];

const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js',
];

const abs = (p) => new URL(p, self.registration.scope).href;
const shellUrls = () => [...RELATIVE_PATHS.map(abs), ...CDN_URLS];
// The two URLs that resolve to the app's HTML document
const documentUrls = () => [abs('./'), abs('./index.html')];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(shellUrls()))
      .then(() => self.skipWaiting())
      .catch((err) => console.error('SW precache failed:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Allow the page to force an immediate worker takeover
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const isDocument = event.request.mode === 'navigate' || documentUrls().includes(url);

  // ── App HTML: network first ────────────────────────────────────────────────
  // Always try the network so a fresh upload is picked up on the very next open.
  if (isDocument) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(abs('./index.html'), clone));
          }
          return response;
        })
        .catch(() => caches.match(abs('./index.html')).then((c) => c || caches.match(event.request)))
    );
    return;
  }

  // ── Everything else in the shell: cache first, refresh in background ───────
  if (!shellUrls().includes(url)) return; // Supabase, Claude proxy, images: untouched

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
