// Builds preview.html: the whole app inlined into one self-contained web page
// (fonts and icon embedded, sample clients preloaded) for a quick look in any browser.
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', 'src', 'renderer');
const b64 = f => fs.readFileSync(path.join(R, f)).toString('base64');
const icon = `data:image/png;base64,${b64('icon.png')}`;

const css = fs.readFileSync(path.join(R, 'styles.css'), 'utf8')
  .replace("url('fonts/inter.woff2')", `url(data:font/woff2;base64,${b64('fonts/inter.woff2')})`)
  .replace("url('fonts/fraunces.woff2')", `url(data:font/woff2;base64,${b64('fonts/fraunces.woff2')})`);
const html = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src='))
  .replace(/src="icon\.png"/g, `src="${icon}"`);
const js = scripts.map(f => fs.readFileSync(path.join(R, f), 'utf8')).join('\n;\n').replace(/src="icon\.png"/g, `src="${icon}"`);

const out = `<title>Coll Ledger</title>
<meta name="description" content="Bookkeeping software for independent bookkeepers">
<style>${css}</style>
${body}
<script>window.COLL_PREVIEW = true;
${js.replace(/<\/script/g, '<\\/script')}</script>
`;
const dest = process.argv[2] || path.join(__dirname, '..', 'preview.html');
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(0) + ' KB');
