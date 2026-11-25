/* Dino Garden offline helper.
   Saves the game on the device the first time it opens, so it works with no internet.
   Pages load fresh when online (so updates show up) and from the saved copy when offline. */
const CACHE = 'dino-garden-v39';
const CORE = ['./', './index.html', './apple-touch-icon.png', './icon-512.png', './manifest.json', './voice-3e70df5b.bin', './songs/hello.mp3', './songs/stomp.mp3', './songs/count.mp3', './songs/rainbow.mp3', './songs/abc.mp3', './songs/party.mp3', './songs/jingle.mp3', './songs/deck.mp3', './songs/wish.mp3', './songs/silent.mp3', './songs/xparty.mp3', './songs/snowflakes.mp3', './songs/heart.mp3', './songs/seeds.mp3', './songs/splash.mp3', './songs/boo.mp3'];

// Voice and song files never change under the same name, so an update copies them from the
// copy already saved on this device and only downloads what is new. The old copy is removed
// only after the new one is complete (in 'activate').
const KEEP = /\/(voice-[0-9a-f]+\.bin|songs\/[a-z]+\.mp3)$/;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(async u => {
    const req = new Request(u, { cache: 'reload' });
    if (KEEP.test(new URL(u, self.location).pathname)) { const old = await caches.match(u); if (old) return c.put(u, old); }
    const res = await fetch(req); if (!res.ok) throw new Error('could not save ' + u); return c.put(u, res);
  }))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // The game itself: try the network first, fall back to the saved copy.
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    // The rounded font: use the saved copy if we have it.
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }))
    );
  }
});
