'use strict';
// Reads receipt photos (Tesseract, on this computer) and PDFs (text layer).
const path = require('path');
const fs = require('fs');
let worker = null, busy = Promise.resolve();

// pdfjs tries to load a native canvas add-on that crashes inside Electron.
// Reading text never needs it, so make sure it can't load.
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (typeof req === 'string' && req.startsWith('@napi-rs/canvas')) throw Object.assign(new Error('Canvas add-on disabled'), { code: 'MODULE_NOT_FOUND' });
  return origResolve.call(this, req, ...rest);
};

async function getWorker(dataDir) {
  if (worker) return worker;
  const T = require('tesseract.js');
  const langPath = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
  const cachePath = path.join(dataDir, 'ocr-cache'); fs.mkdirSync(cachePath, { recursive: true });
  worker = await T.createWorker('eng', 1, { langPath, cachePath, gzip: true });
  return worker;
}
async function pdfText(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const base = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, standardFontDataUrl: path.join(base, 'standard_fonts') + path.sep, verbosity: 0 });
  const doc = await task.promise;
  let out = '';
  for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    let lastY = null;
    for (const it of tc.items) { const y = it.transform[5]; if (lastY !== null) out += Math.abs(y - lastY) > 2 ? '\n' : ' '; out += it.str; lastY = y; }
    out += '\n';
  }
  await task.destroy();
  return out;
}
function read(buf, name, dataDir) {
  const job = busy.then(async () => {
    if (/\.pdf$/i.test(name || '') || buf.slice(0, 4).toString() === '%PDF') {
      const text = await pdfText(buf);
      return { text, kind: 'pdf', scanned: text.replace(/\s/g, '').length < 20 };
    }
    const w = await getWorker(dataDir);
    const r = await w.recognize(buf);
    return { text: r.data.text || '', kind: 'image', confidence: r.data.confidence };
  });
  busy = job.catch(() => {});
  return job.catch(e => ({ error: String((e && e.message) || e) }));
}
function stop() { if (worker) { worker.terminate().catch(() => {}); worker = null; } }
module.exports = { read, stop };
