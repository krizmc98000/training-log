// Training Log — app-shell service worker
// Scope: caches ONLY the static shell (HTML, CDN libraries, manifest, icons) so the app can
// still boot on a flaky connection. Every other request (Supabase, RapidAPI ExerciseDB, the
// Claude proxy) is left completely untouched — this worker never intercepts, caches, or
// delays live data, only the code needed to render the page.

const CACHE_NAME = 'training-log-shell-v1';

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

self.addEventListener('install', (event) => {
  const precacheUrls = [
    ...RELATIVE_PATHS.map((p) => new URL(p, self.registration.scope).href),
    ...CDN_URLS,
  ];
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(precacheUrls))
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

self.addEventListener('fetch', (event) => {
  const precacheUrls = [
    ...RELATIVE_PATHS.map((p) => new URL(p, self.registration.scope).href),
    ...CDN_URLS,
  ];

  // Only ever intercept GET requests for files in our known shell list.
  // Anything else — Supabase reads/writes, RapidAPI GIF lookups, the Claude proxy —
  // passes straight through to the network untouched.
  if (event.request.method !== 'GET' || !precacheUrls.includes(event.request.url)) return;

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
        .catch(() => cached); // offline — fall back to whatever's cached
      // Stale-while-revalidate: serve cached instantly if we have it, refresh in the background
      return cached || networkFetch;
    })
  );
});
