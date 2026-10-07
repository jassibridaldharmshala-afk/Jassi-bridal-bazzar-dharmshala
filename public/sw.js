const CACHE = 'jassi-general-store-phone-shell-v3';
const APP_SHELL = ['/', '/index.html', '/offline.html', '/manifest.json', '/favicon.ico', '/logo192.png', '/logo512.png'];
const STATIC_PATTERN = /\.(?:js|css|woff2?|png|jpe?g|gif|svg|ico|webp)$/i;
const PRIVATE_PATH = /^\/(?:api|uploads|admin|seller|checkout|orders|order-detail|order-success|payment-failed|profile|returns|notifications)(?:\/|$)/;

async function cacheShell() {
  const cache = await caches.open(CACHE);
  await Promise.allSettled(APP_SHELL.map(async (path) => {
    const response = await fetch(path, { cache: 'reload' });
    if (response.ok) await cache.put(path, response);
  }));
}

self.addEventListener('install', (event) => event.waitUntil(cacheShell()));

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function navigationResponse(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('text/html') && !PRIVATE_PATH.test(new URL(request.url).pathname)) {
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch (_) {
    return (await cache.match('/index.html')) || (await cache.match('/offline.html')) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (!STATIC_PATTERN.test(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  })());
});
