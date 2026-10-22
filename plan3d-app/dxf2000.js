/* Coll Plan3D — turn the app's AutoCAD R12 DXF into an AutoCAD 2000 DXF built on LibreDWG's own empty drawing
   (libredwg/template-r2000.dxf), so LibreDWG's dxf2dwg makes a clean DWG: the template's reserved objects keep
   their own IDs, and our layers and shapes get fresh ones above them.
   Handles: LINE, POLYLINE (→ LWPOLYLINE), ARC, TEXT and the layer / line type tables — what cad.js writes.
   Coll Business Solutions LLC */
'use strict';

// "code\nvalue" pairs from DXF text
function pairs(text) {
  const L = text.split(/\r?\n/), out = [];
  for (let i = 0; i + 1 < L.length; i += 2) out.push([parseInt(L[i], 10), L[i + 1]]);
  return out;
}

// Read the R12 file: layer table records, extra line types, and entities in order
function readR12(text) {
  const P = pairs(text), layers = [], ltypes = [], ents = [];
  let section = '', table = '', cur = null, poly = null;
  const flush = () => { if (cur) { if (cur.type === 'LAYER') layers.push(cur); else if (cur.type === 'LTYPE') ltypes.push(cur); cur = null; } };
  for (let i = 0; i < P.length; i++) {
    const [c, v] = P[i];
    if (c === 0) {
      flush();
      if (v === 'SECTION') { section = P[i + 1] && P[i + 1][1]; continue; }
      if (v === 'ENDSEC') { section = ''; continue; }
      if (section === 'TABLES') {
        if (v === 'TABLE') { table = P[i + 1] && P[i + 1][1]; continue; }
        if (v === 'ENDTAB') { table = ''; continue; }
        if (v === 'LAYER' || v === 'LTYPE') cur = { type: v, g: [] };
        continue;
      }
      if (section === 'ENTITIES') {
        if (v === 'VERTEX' && poly) { poly.verts.push({ g: [] }); cur = null; continue; }
        if (v === 'SEQEND') { if (poly) ents.push(poly); poly = null; ents._last = null; continue; }
        if (v === 'POLYLINE') { poly = { type: 'POLYLINE', g: [], verts: [] }; continue; }
        const e = { type: v, g: [] }; ents.push(e); cur = null; poly = null;
        ents._last = e;
        continue;
      }
      continue;
    }
    if (section === 'TABLES' && cur) cur.g.push([c, v]);
    else if (section === 'ENTITIES') {
      if (poly) { if (poly.verts.length) poly.verts[poly.verts.length - 1].g.push([c, v]); else poly.g.push([c, v]); }
      else if (ents._last) ents._last.g.push([c, v]);
    }
  }
  flush();
  delete ents._last;
  return { layers, ltypes, ents };
}

const get = (g, code, def) => { for (const [c, v] of g) if (c === code) return v; return def; };
const num = (g, code, def) => { const v = get(g, code, null); return v == null ? def : +v; };
const f = (v) => { const r = Math.round(+v * 1e6) / 1e6; return (Number.isInteger(r) ? r.toFixed(1) : String(r)); };

function toR2000(r12Text, templateText) {
  const src = readR12(r12Text);
  const T = templateText.replace(/\r\n/g, '\n').split('\n');
  // template pairs as lines; find positions by scanning pairs
  const at = (pred) => { for (let i = 0; i + 1 < T.length; i += 2) if (pred(T[i].trim(), T[i + 1].trim(), i)) return i; return -1; };
  const seedIdx = at((c, v) => c === '9' && v === '$HANDSEED');
  let next = Math.max(0x100, parseInt(T[seedIdx + 3].trim(), 16) + 1);
  const H = () => (next++).toString(16).toUpperCase();
  const out = [];
  const w = (...kv) => { for (let i = 0; i < kv.length; i += 2) out.push(String(kv[i]).padStart(3, ' '), String(kv[i + 1])); };

  // table handles in the template
  const tableHandle = (name) => { const i = at((c, v, k) => c === '0' && v === 'TABLE' && T[k + 3].trim() === name); return i < 0 ? null : T[i + 5].trim(); };
  const ltTable = tableHandle('LTYPE'), layTable = tableHandle('LAYER');
  const msIdx = at((c, v, k) => c === '0' && v === 'BLOCK_RECORD' && (T.slice(k, k + 20).join('\n').includes('*MODEL_SPACE')));
  const modelSpace = T[msIdx + 3].trim();
  const plotStyle = (() => { const i = at((c, v, k) => c === '0' && v === 'LAYER'); for (let k = i; k < i + 40; k += 2) if (T[k].trim() === '390') return T[k + 1].trim(); return null; })();

  // new line types (anything but CONTINUOUS)
  const ltRecs = [];
  for (const lt of src.ltypes) {
    const name = get(lt.g, 2, ''); if (!name || /^(CONTINUOUS|BYLAYER|BYBLOCK)$/i.test(name)) continue;
    const dashes = lt.g.filter(([c]) => c === 49).map(([, v]) => +v);
    const rec = [];
    const r = (...kv) => { for (let i = 0; i < kv.length; i += 2) rec.push(String(kv[i]).padStart(3, ' '), String(kv[i + 1])); };
    r(0, 'LTYPE', 5, H(), 330, ltTable, 100, 'AcDbSymbolTableRecord', 100, 'AcDbLinetypeTableRecord', 2, name, 70, 0, 3, get(lt.g, 3, ''), 72, 65, 73, dashes.length, 40, f(num(lt.g, 40, 0)));
    for (const d of dashes) r(49, f(d), 74, 0);
    ltRecs.push(rec);
  }
  // new layers (anything but 0)
  const layRecs = [];
  for (const L of src.layers) {
    const name = get(L.g, 2, ''); if (!name || name === '0') continue;
    const rec = [];
    const r = (...kv) => { for (let i = 0; i < kv.length; i += 2) rec.push(String(kv[i]).padStart(3, ' '), String(kv[i + 1])); };
    r(0, 'LAYER', 5, H(), 330, layTable, 100, 'AcDbSymbolTableRecord', 100, 'AcDbLayerTableRecord', 2, name, 70, num(L.g, 70, 0), 62, num(L.g, 62, 7), 6, get(L.g, 6, 'CONTINUOUS'), 290, 1);
    if (plotStyle) r(390, plotStyle);
    layRecs.push(rec);
  }
  // entities
  const entLines = [];
  const e = (...kv) => { for (let i = 0; i < kv.length; i += 2) entLines.push(String(kv[i]).padStart(3, ' '), String(kv[i + 1])); };
  for (const x of src.ents) {
    const g = x.g, layer = get(g, 8, '0');
    const head = (type) => e(0, type, 5, H(), 330, modelSpace, 100, 'AcDbEntity', 8, layer);
    if (x.type === 'LINE') {
      head('LINE'); e(100, 'AcDbLine', 10, f(num(g, 10, 0)), 20, f(num(g, 20, 0)), 30, f(num(g, 30, 0)), 11, f(num(g, 11, 0)), 21, f(num(g, 21, 0)), 31, f(num(g, 31, 0)));
    } else if (x.type === 'POLYLINE') {
      const v = x.verts.map(q => [num(q.g, 10, 0), num(q.g, 20, 0)]); if (v.length < 2) continue;
      head('LWPOLYLINE'); e(100, 'AcDbPolyline', 90, v.length, 70, (num(g, 70, 0) & 1) ? 1 : 0, 43, '0.0');
      for (const p of v) e(10, f(p[0]), 20, f(p[1]));
    } else if (x.type === 'ARC') {
      head('ARC'); e(100, 'AcDbCircle', 10, f(num(g, 10, 0)), 20, f(num(g, 20, 0)), 30, f(num(g, 30, 0)), 40, f(num(g, 40, 1)), 100, 'AcDbArc', 50, f(num(g, 50, 0)), 51, f(num(g, 51, 0)));
    } else if (x.type === 'CIRCLE') {
      head('CIRCLE'); e(100, 'AcDbCircle', 10, f(num(g, 10, 0)), 20, f(num(g, 20, 0)), 30, f(num(g, 30, 0)), 40, f(num(g, 40, 1)));
    } else if (x.type === 'TEXT') {
      const h72 = num(g, 72, 0), v73 = num(g, 73, 0), aligned = h72 || v73;
      head('TEXT'); e(100, 'AcDbText', 10, f(num(g, 10, 0)), 20, f(num(g, 20, 0)), 30, f(num(g, 30, 0)), 40, f(num(g, 40, 1)), 1, get(g, 1, ''), 50, f(num(g, 50, 0)), 72, h72);
      if (aligned) e(11, f(num(g, 11, num(g, 10, 0))), 21, f(num(g, 21, num(g, 20, 0))), 31, f(num(g, 31, 0)));
      e(100, 'AcDbText', 73, v73);
    }
  }

  // assemble: template with our records spliced in
  const res = [];
  let i = 0, inEntities = false, curTable = '';
  while (i + 1 < T.length) {
    const c = T[i].trim(), v = T[i + 1].trim();
    if (c === '9' && v === '$HANDSEED') { res.push(T[i], T[i + 1], T[i + 2], next.toString(16).toUpperCase()); i += 4; continue; }
    if (c === '0' && v === 'TABLE') curTable = T[i + 3].trim();
    if (c === '0' && v === 'ENDTAB') {
      if (curTable === 'LTYPE') for (const r of ltRecs) res.push(...r);
      if (curTable === 'LAYER') for (const r of layRecs) res.push(...r);
      curTable = '';
    }
    // table record counts
    if (c === '70' && curTable && T[i - 2] && T[i - 2].trim() === '100' && T[i - 1].trim() === 'AcDbSymbolTable') {
      const add = curTable === 'LTYPE' ? ltRecs.length : curTable === 'LAYER' ? layRecs.length : 0;
      res.push(T[i], String(parseInt(v, 10) + add).padStart(6, ' ')); i += 2; continue;
    }
    if (c === '2' && v === 'ENTITIES' && T[i - 1] && T[i - 1].trim() === 'SECTION') {
      res.push(T[i], T[i + 1], ...entLines); i += 2; inEntities = true; continue;
    }
    if (inEntities) { // drop the template's own entities
      if (c === '0' && v === 'ENDSEC') { inEntities = false; res.push(T[i], T[i + 1]); }
      i += 2; continue;
    }
    res.push(T[i], T[i + 1]); i += 2;
  }
  while (i < T.length) res.push(T[i++]);
  return res.join('\r\n').replace(/(\r\n)*$/, '\r\n');
}

module.exports = { toR2000, readR12 };
