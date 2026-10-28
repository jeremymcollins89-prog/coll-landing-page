/* Coll Plan3D — quote and proposal.
   The parts list, priced: unit prices come from a price book kept on this computer (one price per part, used
   for every project), labor by the square foot or as one amount, freight, a markup and sales tax on materials.
   The proposal is a printable, branded PDF for the customer: a cover with a picture of the job, the rooms
   (ISO class, size, pressure, air changes), the floor plan, the price and terms with a place to sign.
   Customer prices carry the markup inside them; the markup itself never shows on the proposal.
   Coll Business Solutions LLC */
(function (global) {
'use strict';
const V = () => global.Plan3DViewer, PT = () => global.Plan3DParts;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = (v) => '$' + (Math.round((+v || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = (v) => '$' + Math.round(+v || 0).toLocaleString('en-US');

/* One price per part: counted parts by item and size, running totals (lin ft, sq ft …) by item and unit. */
const priceKey = (r) => r.cat + '|' + r.item + '|' + (r.unit === 'ea' ? r.size || '' : '') + '|' + r.unit;

/* The project's parts, every building in one list (same part, same key: quantities add up). */
function lines(plan) {
  const out = [], by = new Map();
  for (const sec of PT().projectParts(plan)) for (const r of sec.rows) {
    if (r.unit === 'lb' || r.unit === 'CFM') continue; // totals for the engineer (weight on the grid, airflow), nothing to buy
    const k = priceKey(r), m = by.get(k);
    if (m) { m.qty = Math.round((m.qty + r.qty) * 100) / 100; continue; }
    const q = { cat: r.cat, item: r.item, size: r.size || '', unit: r.unit, qty: r.qty, order: r.order || 0, key: k };
    by.set(k, q); out.push(q);
  }
  out.sort((a, b) => a.order - b.order || a.item.localeCompare(b.item));
  return out;
}

/* Cleanroom floor area (sq ft): inside the walls of every building. */
function floorArea(plan) {
  let a = 0;
  try { for (const z of V().zones(plan)) { if (z.virtual) continue; const A = V().analyze(z.plan); if (A.empty) continue; const f = V().footprint(A, true); if (f) a += f.area; } } catch (e) { /* none */ }
  return Math.round(a);
}

/* Prices and totals. S: { markup, tax, laborMode: 'sqft' | 'lump', laborRate, laborLump, freight } */
function totals(L, prices, S, area) {
  const mk = 1 + (+S.markup || 0) / 100;
  let material = 0, priced = 0;
  const rows = L.map(r => { const p = +prices[r.key] || 0; if (p > 0) priced++; const cost = p * r.qty; material += cost; return { ...r, price: p, cost, sell: p * mk, sellTotal: cost * mk }; });
  const labor = S.laborMode === 'lump' ? +S.laborLump || 0 : (+S.laborRate || 0) * area, freight = +S.freight || 0;
  const materialSell = material * mk, tax = materialSell * (+S.tax || 0) / 100;
  const total = materialSell + labor + freight + tax;
  const cats = []; for (const r of rows) { let c = cats.find(q => q.cat === r.cat); if (!c) cats.push(c = { cat: r.cat, sell: 0, n: 0 }); c.sell += r.sellTotal; c.n++; }
  return { rows, cats, material, materialSell, markupAmt: materialSell - material, labor, freight, tax, total, priced, area, cost: material + labor + freight + tax, profit: materialSell - material };
}

const fmtSize = (b) => V().fmtFt(b.w) + ' × ' + V().fmtFt(b.d);
function summary(plan) {
  const A = V().analyze(plan), C = (() => { try { return V().cleanroomCheck(plan); } catch (e) { return { rooms: [] }; } })();
  const fx = (() => { try { return V().ceilingFixtures(plan, A); } catch (e) { return []; } })();
  const nF = fx.filter(f => f.type === 'ffu').length, nL = fx.length - nF;
  const doors = (plan.openings || []).filter(o => o.type === 'door' || o.type === 'door2').length, glass = (plan.openings || []).filter(o => o.type === 'glass' || o.type === 'window').length;
  return { A, rooms: C.rooms, nF, nL, doors, glass, size: A.empty ? '' : fmtSize({ w: A.bounds.w, d: A.bounds.d }), ceiling: A.H, isos: [...new Set(C.rooms.map(q => q.iso).filter(Boolean))].sort() };
}

/* ---- The proposal (Letter pages) ---- */
function proposalHTML(plan, Q) {
  // Q: { co, cust, opts, T, picture, sheetSvg, date, number, valid }
  const co = Q.co || {}, cu = Q.cust || {}, T = Q.T, Sm = summary(plan), o = Q.opts || {};
  const accent = '#c99a1e', ink = '#14191c';
  const head = (t) => `<header class="ph"><div class="brand">${co.logo ? `<img src="${co.logo}" alt="">` : ''}<b>${esc(co.name || 'Coll Business Solutions LLC')}</b></div><span>${esc(t)}</span></header>`;
  const foot = (n) => `<footer class="pf"><span>${esc([co.name, co.phone, co.email, co.web].filter(Boolean).join('  ·  '))}</span><span>Proposal ${esc(Q.number)} · page ${n}</span></footer>`;
  const rooms = Sm.rooms.filter(q => q.room && (q.room.name || q.iso));
  const isoTxt = Sm.isos.length ? 'ISO ' + Sm.isos.join(', ') : '';
  const pr = (q) => q.pressure == null ? '—' : (q.pressure > 0 ? '+' : '') + q.pressure + ' Pa<small>' + (q.pressure > 0 ? '+' : q.pressure < 0 ? '−' : '') + (Math.abs(q.pressure) * V().PA_TO_INWC).toFixed(3) + '″ w.c.</small>';
  let n = 0;
  const page = (cls, body) => `<section class="page ${cls}">${body}${foot(++n)}</section>`;

  // 1. cover
  let html = page('cover', `
    <div class="band">${co.logo ? `<img src="${co.logo}" alt="">` : ''}<div><b>${esc(co.name || 'Coll Business Solutions LLC')}</b><span>${esc([co.phone, co.email, co.web].filter(Boolean).join('  ·  '))}</span></div></div>
    <div class="ttl"><small>Cleanroom proposal</small><h1>${esc(cu.project || plan.name || 'Cleanroom')}</h1>
      <p>Prepared for <b>${esc(cu.name || 'Customer')}</b>${cu.company ? ', ' + esc(cu.company) : ''}${cu.address ? '<br>' + esc(cu.address).replace(/\n/g, '<br>') : ''}</p></div>
    ${Q.picture ? `<div class="hero"><img src="${Q.picture}" alt=""></div>` : '<div class="hero none"></div>'}
    <div class="facts">
      ${Sm.size ? `<div><small>Overall size</small><b>${esc(Sm.size)}</b></div>` : ''}
      <div><small>Cleanroom floor</small><b>${T.area.toLocaleString()} sq ft</b></div>
      ${rooms.length ? `<div><small>Rooms</small><b>${rooms.length}${isoTxt ? ' · ' + isoTxt : ''}</b></div>` : ''}
      <div><small>Proposal total</small><b class="hl">${money0(T.total)}</b></div>
    </div>
    <div class="meta"><span>Proposal ${esc(Q.number)}</span><span>${esc(Q.date)}</span><span>Valid until ${esc(Q.valid)}</span></div>`);

  // 2. the project: rooms and what's in it
  const sys = [];
  if (Sm.size) sys.push(`Modular hardwall cleanroom, ${esc(Sm.size)} overall, ${esc(V().fmtFt(Sm.ceiling))} ceiling height`);
  if (Sm.nF) sys.push(`${Sm.nF} fan filter unit${Sm.nF === 1 ? '' : 's'}${plan.ffuModel ? ', ' + esc(plan.ffuModel.name) + (plan.ffuModel.finishLabel ? ' (' + esc(plan.ffuModel.finishLabel) + ')' : '') : ''}`);
  if (Sm.nL) sys.push(`${Sm.nL} LED light${Sm.nL === 1 ? '' : 's'}${plan.lightModel ? ', ' + esc(plan.lightModel.name) : ''}`);
  if (Sm.doors) sys.push(`${Sm.doors} door${Sm.doors === 1 ? '' : 's'}${Sm.glass ? ', ' + Sm.glass + ' window' + (Sm.glass === 1 ? '' : 's') : ''}`);
  const nGr = (plan.grilles || []).filter(g => !g.plenum).length; if (nGr) sys.push(`${nGr} return air grille${nGr === 1 ? '' : 's'}${(plan.grilles || []).some(g => g.damper) ? ' with dampers' : ''}`);
  html += page('', `${head('Project')}
    <h2>${esc(cu.project || plan.name || 'Cleanroom')}</h2>
    ${o.scope ? `<div class="scope">${esc(o.scope).replace(/\n/g, '<br>')}</div>` : ''}
    <h3>What's included</h3><ul class="sys">${sys.map(s => `<li>${s}</li>`).join('')}</ul>
    ${rooms.length ? `<h3>Rooms</h3><table class="rt"><thead><tr><th>Room</th><th>Class</th><th>Floor area</th><th>Pressure</th><th>Air changes</th><th>FFUs</th></tr></thead><tbody>
      ${rooms.map(q => `<tr><td>${esc(q.room.name || 'Room')}</td><td>${q.iso ? 'ISO ' + q.iso : '—'}</td><td>${Math.round(q.area).toLocaleString()} sq ft</td><td>${pr(q)}</td><td>${Math.round(q.ach)} /hr${q.achTarget ? `<small>design ${q.achTarget}</small>` : ''}</td><td>${q.ffus}</td></tr>`).join('')}
      </tbody></table><p class="fine">Air changes are from the fan filter units over each room. ISO targets are typical design ranges; the finished room is certified on site.</p>` : ''}`);

  // 3. floor plan
  if (Q.sheetSvg) html += page('plan', `${head('Floor plan')}<div class="sheet">${Q.sheetSvg}</div>`);

  // 4. price: as many pages as the lines need (about 16 lines a page), totals, terms and signing on the last
  const rowsAll = o.showLines
    ? T.rows.filter(r => r.sellTotal > 0).map(r => `<tr><td>${esc(r.item)}${r.size ? `<small>${esc(r.size)}</small>` : ''}</td><td class="n">${r.qty.toLocaleString()} ${r.unit === 'ea' ? '' : esc(r.unit)}</td><td class="n">${money(r.sell)}</td><td class="n">${money(r.sellTotal)}</td></tr>`)
    : T.cats.filter(c => c.sell > 0).map(c => `<tr><td>${esc(c.cat)}</td><td class="n" colspan="3">${money(c.sell)}</td></tr>`);
  const thead = `<thead><tr>${o.showLines ? '<th>Item</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Amount</th>' : '<th>Materials and equipment</th><th class="n" colspan="3">Amount</th>'}</tr></thead>`;
  const tfoot = `<tfoot>
      <tr><td colspan="3">Materials and equipment</td><td class="n">${money(T.materialSell)}</td></tr>
      ${T.labor ? `<tr><td colspan="3">Installation labor${T.area && o.laborMode !== 'lump' ? ` (${T.area.toLocaleString()} sq ft)` : ''}</td><td class="n">${money(T.labor)}</td></tr>` : ''}
      ${T.freight ? `<tr><td colspan="3">Freight and delivery</td><td class="n">${money(T.freight)}</td></tr>` : ''}
      ${T.tax ? `<tr><td colspan="3">Sales tax on materials (${+o.tax}%)</td><td class="n">${money(T.tax)}</td></tr>` : ''}
      <tr class="tot"><td colspan="3">Total</td><td class="n">${money(T.total)}</td></tr>
    </tfoot>`;
  const close = `${o.terms ? `<h3>Terms</h3><div class="terms">${esc(o.terms).replace(/\n/g, '<br>')}</div>` : ''}
    <div class="sign"><div><span></span><small>Accepted by (name and title)</small></div><div><span></span><small>Signature</small></div><div><span></span><small>Date</small></div></div>`;
  const PER = 16, LAST = 6, chunks = [];
  for (let i = 0; i < rowsAll.length; i += PER) chunks.push(rowsAll.slice(i, i + PER));
  if (!chunks.length) chunks.push([]);
  const lastFits = chunks[chunks.length - 1].length <= LAST;
  chunks.forEach((c, k) => {
    const last = k === chunks.length - 1;
    html += page('', `${head(k ? 'Price, continued' : 'Price')}${k ? '' : '<h2>Price</h2>'}
      <table class="pt">${thead}<tbody>${c.join('')}</tbody>${last && lastFits ? tfoot : ''}</table>${last && lastFits ? close : ''}`);
  });
  if (!lastFits) html += page('', `${head('Price, total')}<h2>Total</h2><table class="pt"><tbody></tbody>${tfoot}</table>${close}`);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc((cu.project || plan.name || 'Cleanroom') + ' proposal')}</title><style>
@page{size:8.5in 11in;margin:0}
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:${ink};font:10.5pt/1.45 "Segoe UI",system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:8.5in;height:11in;padding:.6in .65in .8in;position:relative;overflow:hidden;page-break-after:always;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
.ph{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${ink};padding-bottom:8px;margin-bottom:22px;font-size:9pt;color:#5b666c;text-transform:uppercase;letter-spacing:.08em}
.ph .brand{display:flex;align-items:center;gap:8px;color:${ink};text-transform:none;letter-spacing:0}.ph .brand img{height:22px}.ph b{font-size:11pt}
.pf{position:absolute;left:.65in;right:.65in;bottom:.4in;display:flex;justify-content:space-between;font-size:8pt;color:#7a858a;border-top:1px solid #d8dde0;padding-top:6px}
h1{font:700 30pt/1.05 Bahnschrift,"Segoe UI",sans-serif;margin:4px 0 10px;letter-spacing:-.01em}
h2{font:700 20pt/1.1 Bahnschrift,"Segoe UI",sans-serif;margin:0 0 12px}
h3{font:700 11pt Bahnschrift,"Segoe UI",sans-serif;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.06em;color:#3c464b}
small{display:block;color:#6b767b;font-size:8pt}
.cover{padding-top:0}
.cover .band{margin:0 -.65in;padding:.45in .65in .3in;background:${ink};color:#fff;display:flex;align-items:center;gap:14px;border-bottom:5px solid ${accent}}
.cover .band img{height:44px;background:#fff;border-radius:6px;padding:4px}.cover .band b{display:block;font:700 17pt Bahnschrift,"Segoe UI",sans-serif}.cover .band span{font-size:9pt;color:#b9c3c7}
.ttl{margin:.35in 0 .2in}.ttl small{text-transform:uppercase;letter-spacing:.14em;color:${accent};font-weight:700;font-size:9pt}.ttl p{margin:0;color:#3c464b}
.hero{flex:1;min-height:0;border-radius:10px;overflow:hidden;background:#e9eef0}.hero img{width:100%;height:100%;object-fit:cover;display:block}
.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0 10px}.facts div{border-top:3px solid ${ink};padding-top:6px}.facts b{font:700 13pt Bahnschrift,"Segoe UI",sans-serif}.facts .hl{color:${accent}}
.meta{display:flex;gap:22px;font-size:8.5pt;color:#6b767b;margin-bottom:14px}
.scope{background:#f3f6f7;border-left:4px solid ${accent};padding:10px 14px;margin-bottom:6px}
ul.sys{margin:0;padding-left:18px}ul.sys li{margin:3px 0}
table{width:100%;border-collapse:collapse;font-size:9.5pt}th{text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.06em;color:#5b666c;border-bottom:2px solid ${ink};padding:5px 6px}
td{border-bottom:1px solid #e1e5e7;padding:6px;vertical-align:top}td small{font-size:7.5pt}.n{text-align:right;white-space:nowrap}
tfoot td{border-bottom:none;padding:4px 6px}tfoot tr:first-child td{border-top:2px solid ${ink};padding-top:8px}
tr.tot td{font:700 14pt Bahnschrift,"Segoe UI",sans-serif;border-top:2px solid ${ink};padding-top:8px}
.fine{font-size:8pt;color:#6b767b;margin-top:8px}
.plan .sheet{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}.plan .sheet svg{width:100%;height:auto;max-height:100%;border:1px solid #d8dde0}
.terms{font-size:9pt;color:#3c464b}
.sign{display:grid;grid-template-columns:2fr 2fr 1fr;gap:18px;margin-top:auto;padding-top:30px}.sign span{display:block;border-bottom:1px solid ${ink};height:34px}
</style></head><body>${html}</body></html>`;
}

/* The quote as a spreadsheet (CSV) with cost, sell and totals: for the office, not the customer. */
function quoteCSV(plan, T, S) {
  const q = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const L = [['Category', 'Item', 'Size', 'Qty', 'Unit', 'Unit cost', 'Cost', 'Unit sell', 'Sell'].join(',')];
  for (const r of T.rows) L.push([r.cat, r.item, r.size, r.qty, r.unit, r.price.toFixed(2), r.cost.toFixed(2), r.sell.toFixed(2), r.sellTotal.toFixed(2)].map(q).join(','));
  L.push('');
  for (const [k, v] of [['Materials (cost)', T.material], ['Markup ' + (+S.markup || 0) + '%', T.markupAmt], ['Materials (sell)', T.materialSell], ['Labor', T.labor], ['Freight', T.freight], ['Sales tax', T.tax], ['Total', T.total]]) L.push([q(k), '', '', '', '', '', '', '', v.toFixed(2)].join(','));
  return '﻿' + L.join('\r\n');
}

global.Plan3DQuote = { lines, totals, floorArea, priceKey, proposalHTML, quoteCSV, summary, money };
})(window);
