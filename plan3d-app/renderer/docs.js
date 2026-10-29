/* Coll Plan3D — project documents, start to finish.
   Submittal package (cover with approval stamp, contents, floor plan, room data sheets, equipment and panel cut
   sheets, electrical summary, materials summary), purchase orders split by supplier, the install schedule with
   crew-days room by room and a punch list, and the certification checklist (ISO 14644 sample locations, limits,
   airflow, pressure, filter leak, recovery) with blanks for the certifier.
   Everything comes from the plan: the parts list, rooms (type, ISO class, air changes, pressure), equipment
   models and the electrical schedule. Letter pages, printed to PDF by the app.
   Coll Business Solutions LLC */
(function (global) {
'use strict';
const V = () => global.Plan3DViewer, PT = () => global.Plan3DParts, Q = () => global.Plan3DQuote, LD = () => global.Plan3DLoads;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d) => (+v || 0).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d });
const ftin = (ft) => { try { return global.Plan3DSheet.dimText(ft); } catch (e) { return (+ft).toFixed(2) + ' ft'; } };
const money = (v) => '$' + (Math.round((+v || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const dayName = (d) => d.toLocaleDateString('en-US', { weekday: 'short' });

/* ---------------------------------------------------------------- shared */
function roomsOf(plan) {
  let C; try { C = V().cleanroomCheck(plan); } catch (e) { return []; }
  const RT = V().ROOM_TYPES || {};
  return C.rooms.filter(q => q.room).map((q, i) => {
    const t = q.room.crType && RT[q.room.crType];
    const fx = q.fixtures || [];
    return { q, name: q.room.name || 'Room ' + (i + 1), type: t ? t.label : '', iso: q.iso || (t && t.iso) || null, area: q.area || 0, volume: q.volume || 0, H: q.H, ffus: fx.filter(f => f.type === 'ffu'), lights: fx.filter(f => f.type !== 'ffu'), cfm: q.cfm || 0, ach: q.ach, achT: q.achTarget, pressure: q.pressure, inWC: q.inWC, ok: q.ok };
  });
}
function partsLines(plan) { try { return Q().lines(plan); } catch (e) { return []; } }
const CSS = (accent) => `
@page{size:8.5in 11in;margin:0}html,body{margin:0;padding:0;background:#fff;color:#14191c;font-family:"Segoe UI",Arial,sans-serif;font-size:10pt}
.page{width:8.5in;height:11in;box-sizing:border-box;padding:.55in .6in .8in;position:relative;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}
.ph{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${accent};padding-bottom:6px;margin-bottom:14px}
.ph .brand{display:flex;align-items:center;gap:8px}.ph img{height:26px}.ph b{font-size:11pt}.ph span{font-size:9pt;color:#555;text-transform:uppercase;letter-spacing:.08em}
.pf{position:absolute;left:.6in;right:.6in;bottom:.4in;display:flex;justify-content:space-between;font-size:7.5pt;color:#777;border-top:1px solid #ddd;padding-top:5px}
h1{font-size:26pt;margin:0 0 6px;line-height:1.1}h2{font-size:15pt;margin:0 0 10px}h3{font-size:11pt;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.06em;color:#444}
table{width:100%;border-collapse:collapse;font-size:9pt}th{text-align:left;border-bottom:2px solid #14191c;padding:4px 5px;font-size:7.5pt;text-transform:uppercase;letter-spacing:.05em;color:#444}
td{border-bottom:1px solid #ddd;padding:4px 5px;vertical-align:top}td.n,th.n{text-align:right;white-space:nowrap}td small{display:block;color:#777;font-size:7.5pt}
tr.cat td{background:#f3f4f5;font-weight:700;font-size:8pt;text-transform:uppercase;letter-spacing:.05em}
.kv{display:grid;grid-template-columns:1.3in 1fr;gap:3px 12px;font-size:9.5pt}.kv span{color:#666}
.box{border:1px solid #c9ced2;border-radius:6px;padding:10px 12px;margin:8px 0}.note{font-size:8pt;color:#666;line-height:1.45}
.blank{display:inline-block;min-width:1.1in;border-bottom:1px solid #333;height:14px}
.chk{display:inline-block;width:11px;height:11px;border:1.3px solid #333;border-radius:2px;vertical-align:-2px;margin-right:6px}
td.bl{border-bottom:1px solid #999}
.stamp{border:2px solid #14191c;border-radius:8px;padding:10px 14px;font-size:9.5pt}.stamp b{font-size:10pt;letter-spacing:.06em}
.cover .band{background:#14191c;color:#fff;margin:-.55in -.6in 0;padding:.45in .6in .35in;display:flex;gap:14px;align-items:center}.cover .band img{height:44px;background:#fff;border-radius:6px;padding:4px}
.cover .band b{font-size:16pt;display:block}.cover .band span{font-size:9pt;color:#c9d1d5}.cover .ttl{margin:.45in 0 .25in}.cover .ttl small{font-size:10pt;text-transform:uppercase;letter-spacing:.14em;color:${accent};font-weight:700}
.cover .pic{width:100%;height:3.2in;object-fit:cover;border-radius:8px;margin:6px 0 14px}
.sheet svg{width:100%;height:auto;max-height:8.6in;display:block}
.bar{height:12px;background:${accent};border-radius:2px}
.toc td{font-size:10pt;padding:6px 5px}
`;
function frame(title, co, docName, ref, accent) {
  let n = 0;
  const head = (t) => `<header class="ph"><div class="brand">${co.logo ? `<img src="${co.logo}" alt="">` : ''}<b>${esc(co.name || 'Coll Business Solutions LLC')}</b></div><span>${esc(t)}</span></header>`;
  const page = (t, body, cls) => `<section class="page ${cls || ''}">${cls === 'cover' ? '' : head(t)}${body}<footer class="pf"><span>${esc([co.name || 'Coll Business Solutions LLC', co.phone, co.email, co.web].filter(Boolean).join('  ·  '))}</span><span>${esc(docName)}${ref ? ' ' + esc(ref) : ''} · page ${++n}</span></footer></section>`;
  const doc = (pages) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS(accent || '#c99a1e')}</style></head><body>${pages.join('')}</body></html>`;
  return { page, doc };
}
const cover = (co, kind, project, lines, picture) => `<div class="band">${co.logo ? `<img src="${co.logo}" alt="">` : ''}<div><b>${esc(co.name || 'Coll Business Solutions LLC')}</b><span>${esc([co.phone, co.email, co.web].filter(Boolean).join('  ·  '))}</span></div></div>
  <div class="ttl"><small>${esc(kind)}</small><h1>${esc(project)}</h1></div>${picture ? `<img class="pic" src="${picture}" alt="">` : ''}<div class="kv">${lines.filter(l => l[1]).map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div>`;
// a long table over as many pages as it needs: rows are HTML <tr>s; the first page has room for `first` rows
function tablePages(F, label, title, intro, head, rows, first, per) {
  const out = []; let i = 0, k = 0;
  do {
    const n = k ? per : first, chunk = rows.slice(i, i + n);
    out.push(F.page(label, `<h2>${esc(title)}${k ? ' (continued)' : ''}</h2>${k ? '' : intro}<table><thead>${head}</thead><tbody>${chunk.join('')}</tbody></table>`));
    i += n; k++;
  } while (i < rows.length);
  return out;
}
const isoOf = (r) => r.iso ? 'ISO ' + r.iso : '—';
const prTxt = (r) => r.pressure == null ? '—' : (r.pressure > 0 ? '+' : '') + r.pressure + ' Pa (' + (r.pressure > 0 ? '+' : r.pressure < 0 ? '−' : '') + Math.abs(r.inWC || r.pressure * V().PA_TO_INWC).toFixed(3) + '″ w.c.)';

/* ---------------------------------------------------------------- 1. Submittal package */
function submittalHTML(plan, X) {
  // X: { co, cust, number, rev, date, picture, sheetSvg }
  const co = X.co || {}, cu = X.cust || {}, project = cu.project || plan.name || 'Cleanroom', R = roomsOf(plan), L = partsLines(plan);
  const F = frame(project + ' submittal', co, 'Submittal', X.number + (X.rev ? ' rev ' + X.rev : ''));
  const pages = [];
  const FM = plan.ffuModel || null, LM = plan.lightModel || null, PC = V().PANEL_COLORS[V().panelColorOf(plan)];
  const fx = (() => { try { return V().ceilingFixtures(plan, V().analyze(plan)); } catch (e) { return []; } })();
  const nF = fx.filter(f => f.type === 'ffu').length, nL = fx.length - nF;
  const sections = [['Floor plan', 1], ['Room data sheets', 1], ['Fan filter units', !!nF], ['Lights', !!nL], ['Wall panels', 1], ['Ceiling', 1], ['Electrical summary', 1], ['Materials summary', 1]].filter(s => s[1]);
  pages.push(F.page('', cover(co, 'Submittal for approval', project, [['Prepared for', [cu.name, cu.company].filter(Boolean).join(', ')], ['Address', cu.address], ['Submittal no.', X.number], ['Revision', X.rev || '0'], ['Date', X.date], ['Prepared by', co.name || 'Coll Business Solutions LLC']], X.picture) + `
    <div class="stamp" style="margin-top:22px"><b>REVIEW</b><div style="display:flex;gap:22px;margin:8px 0 12px"><span><i class="chk"></i>Approved</span><span><i class="chk"></i>Approved as noted</span><span><i class="chk"></i>Revise and resubmit</span><span><i class="chk"></i>Rejected</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px">Reviewed by <span class="blank" style="min-width:2.2in"></span>Date <span class="blank" style="min-width:1.6in"></span></div></div>`, 'cover'));
  pages.push(F.page('Contents', `<h2>Contents</h2><table class="toc"><tbody>${sections.map((s, i) => `<tr><td>${i + 1}.</td><td>${esc(s[0])}</td></tr>`).join('')}</tbody></table>
    <h3>Scope</h3><p>${esc(cu.scope || `Modular hardwall cleanroom, ${R.length} room${R.length === 1 ? '' : 's'}${R.some(r => r.iso) ? ', ' + [...new Set(R.map(r => r.iso).filter(Boolean))].sort().map(i => 'ISO ' + i).join(' / ') : ''}: wall panels, doors and glass, grid ceiling, fan filter units, lights and the electrical devices shown.`)}</p>
    <p class="note">Quantities and sizes are taken from the drawings and model in this package. Field measurements govern; please note any change on the drawings and return them with the review stamp.</p>`));
  if (X.sheetSvg) pages.push(F.page('Floor plan', `<h2>Floor plan</h2><div class="sheet">${X.sheetSvg}</div>`));
  // room data sheets: two rooms to a page
  for (let i = 0; i < Math.max(1, R.length); i += 2) {
    const two = R.slice(i, i + 2);
    pages.push(F.page('Room data sheets', `<h2>Room data sheets</h2>${two.length ? two.map(r => `<div class="box"><h3 style="margin-top:0">${esc(r.name)}</h3><div class="kv">
      <span>Room type</span><b>${esc(r.type || 'Cleanroom')}</b><span>Classification</span><b>${isoOf(r)}</b>
      <span>Floor area</span><b>${num(r.area)} sq ft (${num(r.area * 0.092903, 1)} m²)</b><span>Ceiling height</span><b>${ftin(r.H || plan.ceiling || 8)}</b><span>Volume</span><b>${num(r.volume)} cu ft</b>
      <span>Fan filter units</span><b>${r.ffus.length}</b><span>Supply air</span><b>${num(r.cfm)} CFM</b>
      <span>Air changes</span><b>${r.ach != null ? num(r.ach) + ' per hour' : '—'}${r.achT ? ' (target ' + r.achT + ')' : ''}</b><span>Pressure</span><b>${esc(prTxt(r))}</b>
      <span>Lights</span><b>${r.lights.length}</b><span>Design check</span><b>${r.ok ? 'Meets its targets' : 'See notes'}</b></div>${!r.ok && r.q.short && r.q.short.length ? `<p class="note">${r.q.short.map(esc).join(' · ')}</p>` : ''}</div>`).join('') : '<p>No labelled rooms in the plan. Add room labels to get a data sheet for each room.</p>'}`));
  }
  // equipment cut sheets
  if (nF) {
    const sizes = (FM && FM.sizes) || [];
    pages.push(F.page('Fan filter units', `<h2>Fan filter units</h2><div class="kv"><span>Manufacturer</span><b>${esc((FM && FM.maker) || 'Per schedule')}</b><span>Model</span><b>${esc((FM && (FM.model || FM.name)) || 'Standard 2×4 FFU')}</b>
      <span>Grid fit</span><b>${esc((FM && FM.fitLabel) || '—')}</b><span>Finish</span><b>${esc((FM && FM.finishLabel) || 'White powder coat')}</b><span>Quantity</span><b>${nF}</b><span>Filter</span><b>HEPA, 99.99% at 0.3 µm (ULPA where specified)</b></div>
      ${sizes.length ? `<h3>Sizes</h3><table><thead><tr><th>Nominal</th><th>Actual</th><th class="n">Airflow</th><th class="n">Weight</th></tr></thead><tbody>${sizes.map(s => `<tr><td>${esc(s.nominal || '')}</td><td>${s.w ? (s.w * 12).toFixed(2) + '″ × ' + (s.d * 12).toFixed(2) + '″' : '—'}</td><td class="n">${s.cfm ? num(s.cfm) + ' CFM' : '—'}</td><td class="n">${s.lb ? num(s.lb) + ' lb' : '—'}</td></tr>`).join('')}</tbody></table>` : ''}
      <h3>By room</h3><table><thead><tr><th>Room</th><th class="n">FFUs</th><th class="n">CFM</th><th class="n">ACH</th></tr></thead><tbody>${R.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${r.ffus.length}</td><td class="n">${num(r.cfm)}</td><td class="n">${r.ach != null ? num(r.ach) : '—'}</td></tr>`).join('')}</tbody></table>
      <p class="note">Attach the manufacturer's data sheet for the model above. Units are speed-controlled; final airflow is set at balancing.</p>`));
  }
  if (nL) pages.push(F.page('Lights', `<h2>Lights</h2><div class="kv"><span>Manufacturer</span><b>${esc((LM && LM.maker) || 'Per schedule')}</b><span>Model</span><b>${esc((LM && (LM.model || LM.name)) || 'LED cleanroom flat panel')}</b>
      <span>Style</span><b>${esc((LM && { flat: 'Lay-in flat panel', troffer: 'Sealed troffer', rss: 'Room-side serviceable troffer', blp: 'Low-profile panel', teardrop: 'Teardrop' }[LM.style]) || 'Lay-in flat panel')}</b><span>Finish</span><b>${esc((LM && LM.finishLabel) || 'White')}</b><span>Quantity</span><b>${nL}</b></div>
      <h3>By room</h3><table><thead><tr><th>Room</th><th class="n">Lights</th></tr></thead><tbody>${R.map(r => `<tr><td>${esc(r.name)}</td><td class="n">${r.lights.length}</td></tr>`).join('')}</tbody></table>
      <p class="note">Attach the manufacturer's data sheet. Gasketed, sealed to the grid, rated for cleanroom use.</p>`));
  const wp = L.filter(l => l.cat === 'Wall panels'), grid = L.filter(l => l.cat === 'Ceiling grid' || (l.cat === 'Ceiling' && !/fan filter|light|led/i.test(l.item)));
  const wallT = plan.wallT || 0.25;
  const wpSpec = `<div class="kv"><span>Wall system</span><b>Modular hardwall panels, ${(wallT * 12).toFixed(wallT * 12 % 1 ? 2 : 0)}″ thick</b><span>Panel color</span><b>${esc(PC ? PC[0] : 'White')}${(plan.walls || []).some(w => w.color && w.color !== plan.panelColor) ? ' (some walls in other colors, see plan)' : ''}</b>
      <span>Construction</span><b>Painted steel skins, honeycomb or foam core, H-stud joints, aluminum floor track, ceiling track, rubber base</b><span>Ceiling height</span><b>${ftin(plan.ceiling || 8)}${plan.plenum ? ', ' + ftin(plan.plenum) + ' plenum above' : ''}</b></div>
`;
  const qtyRow = (l) => `<tr><td>${esc(l.item)}</td><td>${esc(l.size)}</td><td class="n">${num(l.qty, 2)} ${l.unit === 'ea' ? '' : esc(l.unit)}</td></tr>`;
  const hd3 = '<tr><th>Item</th><th>Size</th><th class="n">Qty</th></tr>';
  pages.push(...tablePages(F, 'Wall panels', 'Wall panels', wpSpec + '<h3>Wall panels</h3>', hd3, wp.length ? wp.map(qtyRow) : ['<tr><td colspan="3">—</td></tr>'], 22, 40));
  pages.push(...tablePages(F, 'Ceiling', 'Ceiling', `<div class="kv"><span>Ceiling</span><b>Aluminum T-grid, gasketed, sealed; ${esc((V().TILE_TYPES[V().tileTypeOf(plan)] || { label: 'Vinyl-covered gypsum' }).label.toLowerCase())} tiles; ${ftin(plan.ceiling || 8)} above the floor</b></div><h3>Ceiling parts</h3>`, hd3, grid.length ? grid.map(qtyRow) : ['<tr><td colspan="3">—</td></tr>'], 36, 40));
  let S = null; try { S = LD().schedule(plan); } catch (e) { S = null; }
  pages.push(F.page('Electrical summary', `<h2>Electrical summary</h2>${S ? `<div class="kv"><span>Connected load</span><b>${num(S.connectedW)} W · ${num(S.amps, 1)} A at ${S.E.volts} V</b><span>Branch circuits</span><b>${S.circuits.length}</b><span>Cooling (sensible)</span><b>${num(S.L.rooms.reduce((t, r) => t + r.btuS, 0))} BTU/hr · ${num(S.L.rooms.reduce((t, r) => t + r.tons, 0), 2)} tons</b></div>
      <h3>Circuits</h3><table><thead><tr><th>#</th><th>Description</th><th>Breaker</th><th class="n">Load</th><th class="n">Amps</th></tr></thead><tbody>${S.circuits.slice(0, 32).map(c => `<tr><td>${c.n}</td><td>${esc(c.desc)}</td><td>${esc(c.breaker)}</td><td class="n">${num(c.load)} W</td><td class="n">${num(c.amps, 1)}</td></tr>`).join('')}</tbody></table>${S.circuits.length > 32 ? `<p class="note">${S.circuits.length - 32} more circuits on the panel schedule.</p>` : ''}
      <p class="note">Planning numbers for sizing the panel and the AC; the electrical and mechanical engineers of record size the final equipment.</p>` : '<p>No electrical load in the plan.</p>'}`));
  // materials summary
  let cat = '', rows = '';
  for (const l of L) { if (l.cat !== cat) rows += `<tr class="cat"><td colspan="3">${esc(cat = l.cat)}</td></tr>`; rows += `<tr><td>${esc(l.item)}${l.size ? `<small>${esc(l.size)}</small>` : ''}</td><td class="n">${num(l.qty, 2)}</td><td>${l.unit === 'ea' ? 'ea' : esc(l.unit)}</td></tr>`; }
  const mrows = rows.split('</tr>').filter(x => x.trim()).map(x => x + '</tr>');
  pages.push(...tablePages(F, 'Materials summary', 'Materials summary', '', '<tr><th>Item</th><th class="n">Qty</th><th>Unit</th></tr>', mrows, 22, 24));
  return F.doc(pages);
}

/* ---------------------------------------------------------------- 2. Crate list (with the fabrication sheets) */
const PANEL_PSF = 3.2; // lb per sq ft, a 2–3″ painted steel hardwall panel; close enough for crating and freight
function crates(rows, opts) {
  const maxN = (opts && opts.perCrate) || 16, maxLb = (opts && opts.maxLb) || 1800, out = [];
  let cur = null;
  const byWall = new Map(); for (const r of rows) { if (!byWall.has(r.wall)) byWall.set(r.wall, []); byWall.get(r.wall).push(r); }
  for (const [wall, list] of byWall) for (const r of list) {
    const lb = r.w * r.h * PANEL_PSF;
    if (!cur || cur.items.length >= maxN || cur.lb + lb > maxLb) { cur = { n: out.length + 1, walls: new Set(), items: [], lb: 0, maxH: 0 }; out.push(cur); }
    cur.items.push(r); cur.walls.add(wall); cur.lb += lb; cur.maxH = Math.max(cur.maxH, r.h);
  }
  return out;
}

/* ---------------------------------------------------------------- 3. Purchase orders */
const SUPPLIER_GROUPS = [
  ['ffu', 'Fan filter units', (l) => /fan filter unit/i.test(l.item)],
  ['light', 'Lights', (l) => (l.cat === 'Ceiling' || l.cat === 'Electrical') && /\blight|led\b|troffer|teardrop/i.test(l.item) && !/switch/i.test(l.item)],
  ['panel', 'Wall panels and framing', (l) => ['Wall panels', 'Studs & posts', 'Trim', 'Air chases'].includes(l.cat)],
  ['ceiling', 'Ceiling grid and tiles', (l) => ['Ceiling grid', 'Ceiling'].includes(l.cat)],
  ['door', 'Doors and glass', (l) => ['Doors & glass', 'Doors & windows'].includes(l.cat)],
  ['elec', 'Electrical', (l) => l.cat === 'Electrical' && !/branch circuits/i.test(l.item)],
  ['steel', 'Steel and lid', (l) => ['Structure', 'Roof'].includes(l.cat)],
  ['other', 'Other', () => true]
];
const LEAD_DAYS = { ffu: 42, light: 28, panel: 35, ceiling: 21, door: 35, elec: 14, steel: 28, other: 14 };
function poGroups(plan) {
  const L = partsLines(plan), G = SUPPLIER_GROUPS.map(([k, label]) => ({ k, label, lines: [] }));
  for (const l of L) { if (/branch circuits/i.test(l.item)) continue; const i = SUPPLIER_GROUPS.findIndex(g => g[2](l)); G[i].lines.push(l); }
  return G.filter(g => g.lines.length);
}
function addWorkDays(d, n, back) { const x = new Date(d); let k = 0; while (k < n) { x.setDate(x.getDate() + (back ? -1 : 1)); const w = x.getDay(); if (w !== 0 && w !== 6) k++; } return x; }
function posHTML(plan, X) {
  // X: { co, cust, number, date, needBy (Date), suppliers: {k: {name, email, phone, lead}}, prices, shipTo }
  const co = X.co || {}, cu = X.cust || {}, project = cu.project || plan.name || 'Cleanroom';
  const F = frame(project + ' purchase orders', co, 'PO', X.number);
  const pages = [], G = poGroups(plan), pk = (l) => Q().priceKey(l);
  G.forEach((g, i) => {
    const sup = (X.suppliers || {})[g.k] || {}, lead = +sup.lead || LEAD_DAYS[g.k], orderBy = X.needBy ? addWorkDays(X.needBy, Math.ceil(lead * 5 / 7), true) : null;
    let tot = 0;
    const rowsA = g.lines.map(l => { const u = (X.prices || {})[pk(l)] || 0, c = u * l.qty; tot += c; return `<tr><td>${esc(l.item)}${l.size ? `<small>${esc(l.size)}</small>` : ''}</td><td class="n">${num(l.qty, 2)}</td><td>${l.unit === 'ea' ? 'ea' : esc(l.unit)}</td><td class="n">${u ? money(u) : ''}</td><td class="n">${c ? money(c) : ''}</td></tr>`; });
    const FIRST = 13, PER = 24, rows = rowsA.slice(0, FIRST).join(''), more = [];
    for (let j = FIRST; j < rowsA.length; j += PER) more.push(rowsA.slice(j, j + PER).join(''));
    const no = X.number + '-' + String(i + 1).padStart(2, '0');
    pages.push(F.page('Purchase order ' + no, `<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h1 style="font-size:22pt">Purchase order</h1><div class="kv"><span>PO number</span><b>${esc(no)}</b><span>Date</span><b>${esc(X.date)}</b><span>Project</span><b>${esc(project)}</b>${X.needBy ? `<span>Need on site</span><b>${fmtDate(X.needBy)}</b><span>Order by</span><b>${fmtDate(orderBy)}</b>` : ''}<span>Lead time</span><b>${lead} days</b></div></div>
      <div class="box" style="min-width:2.6in"><div class="note">VENDOR · ${esc(g.label.toUpperCase())}</div><b>${esc(sup.name || '')}</b>${sup.name ? '' : '<span class="blank" style="min-width:2.2in"></span>'}<div>${esc(sup.phone || '')}</div><div>${esc(sup.email || '')}</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="box"><div class="note">BILL TO</div><b>${esc(co.name || 'Coll Business Solutions LLC')}</b><div>${esc(co.phone || '')}</div><div>${esc(co.email || '')}</div></div>
      <div class="box"><div class="note">SHIP TO (JOB SITE)</div><b>${esc(cu.company || cu.name || '')}</b><div>${esc(X.shipTo || cu.address || '').replace(/\n/g, '<br>')}</div><div>Attn: site superintendent</div></div></div>
      <table style="margin-top:10px"><thead><tr><th>Item</th><th class="n">Qty</th><th>Unit</th><th class="n">Unit cost</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody>
      ${more.length ? `</table><p class="note">Continued on the next page.</p>` : `<tfoot><tr><td colspan="4" class="n"><b>Total</b></td><td class="n"><b>${tot ? money(tot) : '—'}</b></td></tr></tfoot></table>`}
      ${more.length ? '' : `<p class="note">Please confirm the order, the ship date and the freight within 2 business days. Reference the PO number on every packing slip and invoice. Quantities are from the drawings; call before substituting.</p>
      <div style="margin-top:18px">Authorized by <span class="blank" style="min-width:2.4in"></span> &nbsp; Date <span class="blank"></span></div>`}`));
    more.forEach((m, j) => { const last = j === more.length - 1; pages.push(F.page('Purchase order ' + no, `<h2>Purchase order ${esc(no)} (continued)</h2><table><thead><tr><th>Item</th><th class="n">Qty</th><th>Unit</th><th class="n">Unit cost</th><th class="n">Amount</th></tr></thead><tbody>${m}</tbody>${last ? `<tfoot><tr><td colspan="4" class="n"><b>Total</b></td><td class="n"><b>${tot ? money(tot) : '—'}</b></td></tr></tfoot>` : ''}</table>
      ${last ? `<p class="note">Please confirm the order, the ship date and the freight within 2 business days. Reference the PO number on every packing slip and invoice. Quantities are from the drawings; call before substituting.</p><div style="margin-top:18px">Authorized by <span class="blank" style="min-width:2.4in"></span> &nbsp; Date <span class="blank"></span></div>` : '<p class="note">Continued on the next page.</p>'}`)); });
  });
  return { html: F.doc(pages), groups: G };
}
function posCSV(plan, X) {
  const q = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const L = [['PO', 'Supplier group', 'Supplier', 'Item', 'Size', 'Qty', 'Unit', 'Unit cost', 'Amount'].join(',')];
  poGroups(plan).forEach((g, i) => { const sup = (X.suppliers || {})[g.k] || {}, no = X.number + '-' + String(i + 1).padStart(2, '0'); for (const l of g.lines) { const u = (X.prices || {})[Q().priceKey(l)] || 0; L.push([no, g.label, sup.name || '', l.item, l.size, l.qty, l.unit, u || '', u ? (u * l.qty).toFixed(2) : ''].map(q).join(',')); } });
  return L.join('\n');
}

/* ---------------------------------------------------------------- 4. Install schedule + punch list */
// production rates for one crew (default 3 installers, 8-hour days)
const RATES = { track: 450, panels: 36, doors: 6, grid: 1400, lid: 1100, fixtures: 28, devices: 30, tiles: 1800, seal: 1500 };
function installPlan(plan, X) {
  const L = partsLines(plan), R = roomsOf(plan), crew = Math.max(1, +X.crew || 3), k = 3 / crew;
  const sumBy = (fn) => L.filter(fn).reduce((t, l) => t + l.qty, 0);
  const track = sumBy(l => /floor track/i.test(l.item) && l.unit !== 'ea'), panels = sumBy(l => l.cat === 'Wall panels' && l.unit === 'ea');
  const doors = sumBy(l => (l.cat === 'Doors & glass' || l.cat === 'Doors & windows') && l.unit === 'ea' && /door|glass|pass|window/i.test(l.item) && !/closer|hinge|hardware|lever|sweep|seal|kit/i.test(l.item));
  let area = 0; try { area = Q().floorArea(plan); } catch (e) { area = R.reduce((t, r) => t + r.area, 0); }
  const fx = (() => { try { return V().ceilingFixtures(plan, V().analyze(plan)).length; } catch (e) { return 0; } })();
  const devices = sumBy(l => l.cat === 'Electrical' && l.unit === 'ea' && !/branch circuits/i.test(l.item));
  const lid = ((plan.deckPieces || []).length || (+plan.plenum || 0) > 0) ? area : 0;
  const T = [
    ['Layout, chalk lines, floor track', track / RATES.track],
    ['Wall panels, posts and H-studs', panels / RATES.panels],
    ['Doors, glass and pass-thrus', doors / RATES.doors],
    ['Ceiling grid, hangers and track', area / RATES.grid],
    ['Lid / roof deck over the plenum', lid / RATES.lid],
    ['Fan filter units and lights set in the grid', fx / RATES.fixtures],
    ['Electrical devices and connections (with the electrician)', devices / RATES.devices],
    ['Ceiling tiles, clips and gaskets', area / RATES.tiles],
    ['Caulk and seal, touch-up, cleaning', area / RATES.seal],
    ['Air balance and pressure set-up', Math.max(0.5, R.length * 0.25)],
    ['Certification (with the certifier)', 1 + R.length / 6],
    ['Punch list and turnover', Math.max(0.5, R.length * 0.2)]
  ].filter(t => t[1] > 0.01).map(([name, d], i) => ({ name, days: Math.max(0.5, Math.ceil(d * k * 2) / 2), i }));
  let day = 0; const start = X.start || new Date();
  const at = (n) => { const d0 = new Date(start); while (d0.getDay() === 0 || d0.getDay() === 6) d0.setDate(d0.getDate() + 1); return n <= 0 ? d0 : addWorkDays(d0, Math.floor(n)); };
  for (const t of T) { t.s = day; t.e = day + t.days; t.sd = at(t.s); t.ed = at(Math.ceil(t.e) - 1); day = t.e; }
  const total = day, totArea = R.reduce((t, r) => t + r.area, 0) || 1;
  const rooms = R.map(r => ({ ...r, days: Math.round(total * (r.area / totArea) * 10) / 10 }));
  return { tasks: T, total, rooms, crew, finish: at(Math.ceil(total) - 1), start: at(0) };
}
const PUNCH = ['Floor track down, sealed to the floor, square to the layout', 'Walls plumb, panels tight, H-stud joints closed', 'Corner and end posts set, caps on', 'Doors swing free, latch, close fully; closers adjusted', 'Door sweeps and seals touching all round', 'Interlocks: only one door opens at a time; override works', 'Glass and pass-thrus sealed, latches and interlocks work', 'Ceiling grid level, tees straight, hangers tight', 'Ceiling tiles seated, clips and gaskets in place', 'FFUs seated, gasketed, running; speed controllers labelled', 'Lights seated, sealed, all on; switches labelled', 'Receptacles and devices work; cover plates on, labelled', 'Return grilles and dampers set as balanced', 'All seams caulked: wall to floor, wall to ceiling, penetrations', 'Room pressure reads correct on the gauge', 'Touch-up paint, labels, signage', 'Final clean: wipe-down top to bottom, floor cleaned', 'Debris out, site left clean'];
function scheduleHTML(plan, X) {
  const co = X.co || {}, cu = X.cust || {}, project = cu.project || plan.name || 'Cleanroom', P = installPlan(plan, X);
  const F = frame(project + ' install schedule', co, 'Install schedule', '');
  const pages = [], span = Math.max(1, Math.ceil(P.total));
  const bars = P.tasks.map(t => `<tr><td>${esc(t.name)}</td><td class="n">${t.days}</td><td>${dayName(t.sd)} ${fmtDate(t.sd)}</td><td>${dayName(t.ed)} ${fmtDate(t.ed)}</td><td style="width:2.3in"><div style="position:relative;height:12px;background:#f1f2f3;border-radius:2px"><div class="bar" style="position:absolute;left:${(t.s / span * 100).toFixed(1)}%;width:${Math.max(1.5, t.days / span * 100).toFixed(1)}%"></div></div></td></tr>`).join('');
  pages.push(F.page('Install schedule', `<h2>Install schedule</h2><div class="kv"><span>Project</span><b>${esc(project)}</b><span>Crew</span><b>${P.crew} installers, 8-hour days, Monday to Friday</b><span>Start</span><b>${fmtDate(P.start)}</b><span>Finish</span><b>${fmtDate(P.finish)} · ${num(P.total, 1)} working days</b></div>
    <h3>Order of work</h3><table><thead><tr><th>Task</th><th class="n">Crew-days</th><th>Start</th><th>Finish</th><th>Timeline</th></tr></thead><tbody>${bars}</tbody></table>
    <h3>Crew-days by room</h3><table><thead><tr><th>Room</th><th>Class</th><th class="n">Area</th><th class="n">Crew-days</th></tr></thead><tbody>${P.rooms.map(r => `<tr><td>${esc(r.name)}</td><td>${isoOf(r)}</td><td class="n">${num(r.area)} sq ft</td><td class="n">${r.days}</td></tr>`).join('') || '<tr><td colspan="4">Label the rooms to see their share.</td></tr>'}</tbody></table>
    <p class="note">Estimated from the quantities in the plan at typical production rates for a ${P.crew}-person crew. Adjust for site access, other trades, deliveries and overtime.</p>`));
  const R = P.rooms.length ? P.rooms : [{ name: project, iso: null }];
  for (const r of R) pages.push(F.page('Punch list', `<h2>Punch list · ${esc(r.name)}</h2><div class="kv" style="margin-bottom:8px"><span>Class</span><b>${isoOf(r)}</b><span>Walked by</span><b><span class="blank" style="min-width:2.4in"></span></b></div>
    <table><thead><tr><th style="width:18px"></th><th>Item</th><th style="width:1.6in">Notes</th><th style="width:.6in">Initials</th><th style="width:.7in">Date</th></tr></thead><tbody>${PUNCH.map(p => `<tr><td><i class="chk"></i></td><td>${esc(p)}</td><td class="bl"></td><td class="bl"></td><td class="bl"></td></tr>`).join('')}
    ${[1, 2, 3, 4].map(() => '<tr><td><i class="chk"></i></td><td class="bl"></td><td class="bl"></td><td class="bl"></td><td class="bl"></td></tr>').join('')}</tbody></table>`));
  return { html: F.doc(pages), P };
}

/* ---------------------------------------------------------------- 5. Certification checklist */
// ISO 14644-1:2015 Table A.1: minimum sample locations by room area (m²)
const ISO_LOC = [[2, 1], [4, 2], [6, 3], [8, 4], [10, 5], [24, 6], [28, 7], [32, 8], [36, 9], [52, 10], [56, 11], [64, 12], [68, 13], [72, 14], [76, 15], [104, 16], [108, 17], [116, 18], [148, 19], [156, 20], [192, 21], [232, 22], [276, 23], [352, 24], [436, 25], [636, 26], [1000, 27]];
const sampleLocations = (m2) => { for (const [a, n] of ISO_LOC) if (m2 <= a) return n; return Math.ceil(27 * m2 / 1000); };
// ISO 14644-1 class limits, particles ≥ 0.5 µm per m³ (and per cubic foot, the old FS 209E way of saying it)
const ISO_LIMIT = { 1: [0, 0], 2: [4, 0.1], 3: [35, 1], 4: [352, 10], 5: [3520, 100], 6: [35200, 1000], 7: [352000, 10000], 8: [3520000, 100000], 9: [35200000, 1000000] };
function certHTML(plan, X) {
  const co = X.co || {}, cu = X.cust || {}, project = cu.project || plan.name || 'Cleanroom', R = roomsOf(plan);
  const F = frame(project + ' certification checklist', co, 'Certification checklist', '');
  const pages = [];
  pages.push(F.page('Certification', `<h2>Certification checklist</h2><div class="kv"><span>Project</span><b>${esc(project)}</b><span>Customer</span><b>${esc([cu.name, cu.company].filter(Boolean).join(', ') || '')}</b><span>Rooms</span><b>${R.length}</b><span>Standard</span><b>ISO 14644-1:2015 (classification), ISO 14644-3 (test methods)</b></div>
    <h3>Rooms to certify</h3><table><thead><tr><th>Room</th><th>Class</th><th class="n">Area</th><th class="n">Sample locations</th><th class="n">≥0.5 µm limit</th><th class="n">Design ACH</th><th>Pressure</th></tr></thead><tbody>${R.map(r => { const m2 = r.area * 0.092903, lim = r.iso && ISO_LIMIT[r.iso]; return `<tr><td>${esc(r.name)}</td><td>${isoOf(r)}</td><td class="n">${num(r.area)} sq ft<small>${num(m2, 1)} m²</small></td><td class="n">${r.iso ? sampleLocations(m2) : '—'}</td><td class="n">${lim ? num(lim[0]) + '/m³<small>' + num(lim[1]) + '/ft³</small>' : '—'}</td><td class="n">${r.ach != null ? num(r.ach) : '—'}</td><td>${esc(prTxt(r))}</td></tr>`; }).join('')}</tbody></table>
    <h3>Certifier</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px">Company <span class="blank" style="min-width:2.4in"></span>Technician <span class="blank" style="min-width:2.4in"></span>Particle counter (model, serial) <span class="blank" style="min-width:2.4in"></span>Calibration date <span class="blank" style="min-width:2.4in"></span>Anemometer / hood (model, serial) <span class="blank" style="min-width:2.4in"></span>Calibration date <span class="blank" style="min-width:2.4in"></span></div>
    <p class="note">Sample locations are the minimum from ISO 14644-1:2015 Table A.1 for the room's floor area; place them evenly over the room at work height. Limits are for particles ≥ 0.5 µm; add other sizes as the customer's spec requires. Test in the occupancy state agreed with the customer (as-built, at-rest or operational).</p>`));
  for (const r of R) {
    const m2 = r.area * 0.092903, nLoc = r.iso ? sampleLocations(m2) : 0, lim = r.iso && ISO_LIMIT[r.iso], perF = r.ffus.length ? r.cfm / r.ffus.length : 0;
    const ffuRows = r.ffus.map((f, i) => `<tr><td>FFU-${i + 1}</td><td class="n">${perF ? num(perF) : ''}</td><td class="bl"></td><td class="bl"></td><td class="bl"></td><td><i class="chk"></i>Pass <i class="chk"></i>Fail</td></tr>`).join('');
    const locRows = Array.from({ length: Math.min(nLoc, 30) }, (_, i) => `<tr><td>L${i + 1}</td><td class="bl"></td><td class="bl"></td><td class="bl"></td><td><i class="chk"></i>Pass</td></tr>`).join('');
    const head = `<h2>${esc(r.name)}</h2><div class="kv"><span>Class</span><b>${isoOf(r)}${r.type ? ' · ' + esc(r.type) : ''}</b><span>Area</span><b>${num(r.area)} sq ft (${num(m2, 1)} m²) · ${num(r.volume)} cu ft</b><span>Design</span><b>${r.ffus.length} FFUs · ${num(r.cfm)} CFM · ${r.ach != null ? num(r.ach) + ' ACH' : '—'} · ${esc(prTxt(r))}</b></div>`;
    const ffuHead = '<tr><th>Unit</th><th class="n">Design CFM</th><th>Measured CFM</th><th>Avg velocity (fpm)</th><th>Leak scan</th><th>Result</th></tr>';
    const ffuList = r.ffus.map((f, i) => `<tr><td>FFU-${i + 1}</td><td class="n">${perF ? num(perF) : ''}</td><td class="bl"></td><td class="bl"></td><td class="bl"></td><td><i class="chk"></i>Pass <i class="chk"></i>Fail</td></tr>`);
    const sec1 = (rows, cont) => `<h3>1. Airflow and HEPA filter leak test, each FFU${cont ? ' (continued)' : ''}</h3><table><thead>${ffuHead}</thead><tbody>${rows.join('') || '<tr><td colspan="6">No FFUs in this room.</td></tr>'}</tbody></table>`;
    const rest = `<h3>2. Air changes and pressure</h3><table><tbody><tr><td>Total supply (sum of the FFUs)</td><td class="bl" style="width:1.4in"></td><td>CFM</td></tr><tr><td>Air changes per hour (CFM × 60 ÷ ${num(r.volume)} cu ft)${r.achT ? ' · target ' + r.achT : ''}</td><td class="bl"></td><td>ACH</td></tr><tr><td>Pressure to the space next door · design ${esc(prTxt(r))}</td><td class="bl"></td><td>″ w.c.</td></tr><tr><td>Temperature / relative humidity</td><td class="bl"></td><td>°F / %RH</td></tr><tr><td>Light level at work height</td><td class="bl"></td><td>fc</td></tr></tbody></table>
      ${r.iso ? `<h3>3. Particle count, ISO ${r.iso} · ${nLoc} location${nLoc === 1 ? '' : 's'} · limit ${num(lim[0])}/m³ ≥ 0.5 µm</h3><table><thead><tr><th>Location</th><th>Count ≥ 0.5 µm (/m³)</th><th>Count ≥ 5 µm (/m³)</th><th>Sample volume</th><th>Result</th></tr></thead><tbody>${locRows}</tbody></table>${nLoc > 30 ? `<p class="note">${nLoc - 30} more locations on an extra sheet.</p>` : ''}` : '<h3>3. Particle count</h3><p class="note">Set the room\'s ISO class (room type) to get its sample locations and limits.</p>'}
      <h3>4. Recovery (ISO 14644-3, 100:1)</h3><table><tbody><tr><td>Time to recover 100:1 after a challenge · typically 15 minutes or less</td><td class="bl" style="width:1.4in"></td><td>min</td></tr></tbody></table>
      <div style="margin-top:14px;display:flex;gap:26px"><span><i class="chk"></i>Room passes</span><span><i class="chk"></i>Room fails, see notes</span><span>Certifier <span class="blank" style="min-width:1.8in"></span></span><span>Date <span class="blank" style="min-width:1in"></span></span></div>`;
    // one page when it all fits; otherwise the FFU table on its own page(s), the rest after
    if (ffuList.length + Math.min(nLoc, 30) <= 18) pages.push(F.page('Certification · ' + r.name, head + sec1(ffuList) + rest));
    else {
      for (let j = 0; j < ffuList.length || j === 0; j += 26) pages.push(F.page('Certification · ' + r.name, (j ? `<h2>${esc(r.name)}</h2>` : head) + sec1(ffuList.slice(j, j + 26), j > 0)));
      pages.push(F.page('Certification · ' + r.name, `<h2>${esc(r.name)} (continued)</h2>` + rest));
    }
  }
  return F.doc(pages);
}

global.Plan3DDocs = { roomsOf, submittalHTML, crates, PANEL_PSF, poGroups, posHTML, posCSV, SUPPLIER_GROUPS, LEAD_DAYS, installPlan, scheduleHTML, PUNCH, certHTML, sampleLocations, ISO_LIMIT };
})(window);
