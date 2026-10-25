/* Service Worker: שומר את האפליקציה במטמון כדי שתעבוד בלי אינטרנט.
   אחרי שינוי בקבצים יש להעלות את מספר הגרסה. */
const CACHE = 'miluim-v3';
const ASSETS = [
  './', 'index.html', 'css/style.css', 'js/logic.js', 'js/seed.js', 'js/app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// קודם מהרשת (כדי לקבל תמיד את הגרסה העדכנית), ואם אין אינטרנט או שהרשת איטית, מהמטמון
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    e.waitUntil(net.catch(() => {}));
    if (!cached) return net.catch(async () => (req.mode === 'navigate' && (await cache.match('index.html'))) || Response.error());
    const slow = new Promise((r) => setTimeout(() => r(cached), 3000));
    return Promise.race([net.catch(() => cached), slow]);
  })());
});
