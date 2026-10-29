// Builds the Coll Ledger Academy phone app (an installable web app) into
// ../academy-app/ on the website: the same lessons, exams and Study center as
// the desktop app, with practice clients only and progress sync to the desktop.
// Run after any Academy change:  node scripts/bundle-academy.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const R = path.join(__dirname, '..', 'src', 'renderer');
const OUT = path.join(__dirname, '..', '..', 'academy-app');
const b64 = f => fs.readFileSync(path.join(R, f)).toString('base64');
const icon = `data:image/png;base64,${b64('icon.png')}`;
const version = require('../package.json').version;

const css = fs.readFileSync(path.join(R, 'styles.css'), 'utf8')
  .replace("url('fonts/inter.woff2')", `url(data:font/woff2;base64,${b64('fonts/inter.woff2')})`)
  .replace("url('fonts/fraunces.woff2')", `url(data:font/woff2;base64,${b64('fonts/fraunces.woff2')})`);
const html = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src=')).replace(/src="icon\.png"/g, `src="${icon}"`);
const js = scripts.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n').replace(/src="icon\.png"/g, `src="${icon}"`);

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Coll Ledger Academy</title>
<meta name="description" content="Coll Ledger Academy — hands-on bookkeeping training with exams and certificates from Coll Business Solutions LLC.">
<meta name="theme-color" content="#0F2A21">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Academy">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-180.png">
<style>${css}
body { padding-bottom: env(safe-area-inset-bottom); }
</style>
</head>
<body>
${body}
<script>window.COLL_ACADEMY = true; window.COLL_ACADEMY_VERSION = ${JSON.stringify(version)};
${js.replace(/<\/script/g, '<\\/script')}
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
</script>
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), page);
const hash = crypto.createHash('sha256').update(page).digest('hex').slice(0, 12);
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({
  name: 'Coll Ledger Academy', short_name: 'Academy', id: '/academy-app/', start_url: '/academy-app/', scope: '/academy-app/',
  display: 'standalone', background_color: '#F6F4EF', theme_color: '#0F2A21',
  description: 'Bookkeeping lessons, exams and certificates from Coll Business Solutions LLC.',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
}, null, 2));
// Offline: serve from cache, refresh in the background so the next open is up to date
fs.writeFileSync(path.join(OUT, 'sw.js'), `// Coll Ledger Academy ${version} · ${hash}
const CACHE = 'coll-academy-${hash}';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
`);
console.log('wrote', OUT, (page.length / 1024).toFixed(0) + ' KB', 'cache', hash);
