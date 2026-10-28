/* Plan3D Viewer offline helper: keeps a copy of the viewer so it opens with no signal.
   Loads fresh when online (so updates show up), from the saved copy when offline. Plan files never leave the phone. */
const CACHE = 'plan3d-viewer-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-180.png', './icon-512.png',
  '/plan3d-app/renderer/vendor/three.min.js', '/plan3d-app/renderer/vendor/OrbitControls.js', '/plan3d-app/renderer/viewer.js', '/img/plan3d-hero-wide.webp'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE && x.startsWith('plan3d-viewer')).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const ours = url.origin === location.origin && (url.pathname.startsWith('/plan3d-viewer/') || CORE.includes(url.pathname));
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!ours && !font) return;
  e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
});
