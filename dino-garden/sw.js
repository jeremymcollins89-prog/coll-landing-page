/* Dino Garden offline helper.
   Saves the game on the device the first time it opens, so it works with no internet.
   Pages load fresh when online (so updates show up) and from the saved copy when offline. */
const CACHE = 'dino-garden-v35';
const CORE = ['./', './index.html', './apple-touch-icon.png', './icon-512.png', './manifest.json', './voice-c2c2e525.bin', './songs/hello.mp3', './songs/stomp.mp3', './songs/count.mp3', './songs/rainbow.mp3', './songs/abc.mp3', './songs/party.mp3', './songs/jingle.mp3', './songs/deck.mp3', './songs/wish.mp3', './songs/silent.mp3', './songs/xparty.mp3'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
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
