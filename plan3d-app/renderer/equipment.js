/* Coll Plan3D — ceiling equipment (fan filter units) from manufacturer data.
   A model is { id, name, maker, model, source, fits: [{ key, label, sizes: [size …] }], finishes: [{ key, label }] }
   and a size is { nominal: '2x4' | '2x3' | '2x2', w, d, h, overall, hw, hd, ebox, cfm, lb } in feet (cfm, lb as given).
   w is the long side, d the short side, h the cabinet height (above the grid), overall the height to the top of the
   blower housing, hw × hd the housing footprint, ebox the electrical box width.
   The chosen model is copied into the plan (plan.ffuModel) so the 3D view, walkthrough exports, parts list and Revit
   export work anywhere without this catalog.
   Revit families (.rfa) carry their type table in an XML stream called PartAtom; readRevitFamily() turns that into
   a model. Coll Business Solutions LLC */
(function (global) {
'use strict';

const IN = 1 / 12;

/* Envirco MAC 10 LEDC, from Envirco's Revit family "Fan-Filter_Unit-Envirco-Mac_10_Standard-LEDC.rfa" (2013).
   Three grid fits per size; weights per finish (stainless differs). */
function envircoMac10() {
  const fits = [
    { key: '600', label: '23.63″ × 47.63″ (600 × 1210 mm)', sw: 23.63, l4: 47.63, l3: 35.63, l2: 23.63 },
    { key: '588', label: '23.13″ × 47.13″ (588 × 1197 mm)', sw: 23.13, l4: 47.13, l3: 35.13, l2: 23.13 },
    { key: '585', label: '23.03″ × 46.63″ (585 × 1185 mm)', sw: 23.03, l4: 46.63, l3: 34.84, l2: 23.03 }
  ];
  const lb = { '2x4': { white: 66, alum: 66, sst: 76 }, '2x3': { white: 52, alum: 52, sst: 62 }, '2x2': { white: 51, alum: 51, sst: 41 } };
  const cfm = { '2x4': 950, '2x3': 650, '2x2': 540 };
  return {
    id: 'envirco-mac10-ledc', name: 'Envirco MAC 10 LEDC', maker: 'Envirco', model: 'MAC 10 LEDC', source: 'Envirco Revit family (2013)',
    finishes: [{ key: 'white', label: 'White powder coat' }, { key: 'alum', label: 'Aluminum, mill finish' }, { key: 'sst', label: 'Stainless steel' }],
    weights: lb,
    fits: fits.map(f => ({
      key: f.key, label: f.label,
      sizes: [['2x4', f.l4, 5.54], ['2x3', f.l3, 5.54], ['2x2', f.l2, 4.0]].map(([nominal, long, ebox]) => ({
        nominal, w: long * IN, d: f.sw * IN, h: 9.47 * IN, overall: 14.32 * IN, hw: 20 * IN, hd: 20 * IN, ebox: ebox * IN, cfm: cfm[nominal], lb: lb[nominal].white
      }))
    }))
  };
}
const BUILT_IN = [envircoMac10()];

/* ---- Revit family (.rfa) → model ---- */
// "47.63\"" / "1210 mm" / "4' 0\"" → feet
function lenFt(s) {
  if (s == null) return null;
  s = String(s).trim();
  let m = /^(-?[\d.]+)\s*mm$/i.exec(s); if (m) return +m[1] / 304.8;
  m = /^(-?[\d.]+)\s*cm$/i.exec(s); if (m) return +m[1] / 30.48;
  m = /^(-?[\d.]+)\s*m$/i.exec(s); if (m) return +m[1] * 3.28084;
  m = /^(-?[\d.]+)'\s*-?\s*([\d.]+)?\s*"?$/.exec(s); if (m) return +m[1] + (m[2] ? +m[2] / 12 : 0);
  m = /^(-?[\d.]+)\s*"?$/.exec(s); if (m) return +m[1] / 12;
  return null;
}
const num = (s) => { const m = /-?[\d.]+/.exec(String(s || '')); return m ? +m[0] : null; };

function readRevitFamily(xml, fileName) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const parts = [...doc.getElementsByTagNameNS('urn:schemas-autodesk-com:partatom', 'part')];
  if (!parts.length) throw new Error('This family has no type table Coll Plan3D can read.');
  const val = (p, ...tags) => { for (const t of tags) { const e = [...p.children].find(c => c.localName === t); if (e && e.textContent.trim()) return e.textContent.trim(); } return null; };
  const familyTitle = (doc.querySelector('entry > title') || {}).textContent || fileName || 'Revit family';
  const types = parts.map(p => {
    const a = lenFt(val(p, 'Width', 'Length', 'Overall_Width', 'Nominal_Width')), b = lenFt(val(p, 'Depth', 'Overall_Depth', 'Nominal_Depth'));
    if (!(a > 0 && b > 0)) return null;
    const w = Math.max(a, b), d = Math.min(a, b);
    const h = lenFt(val(p, 'Height', 'Cabinet_Height', 'Unit_Height')) || 0.75;
    const overall = Math.max(h, lenFt(val(p, 'Overall_Height')) || h);
    const name = val(p, 'title') || [...p.children].find(c => c.localName === 'title')?.textContent || '';
    const fin = /\bsst\b|stainless/i.test(name) ? 'sst' : /\balum/i.test(name) ? 'alum' : /white/i.test(name) ? 'white' : (/stainless/i.test(val(p, 'Finish') || '') ? 'sst' : /mill|alum/i.test(val(p, 'Finish') || '') ? 'alum' : 'white');
    return {
      name, finish: fin, w, d, h, overall,
      hw: lenFt(val(p, 'Housing_Width', 'CTRL_Housing_Width')) || Math.min(d, 20 * IN),
      hd: lenFt(val(p, 'Housing_Height', 'Housing_Depth', 'CTRL_Housing_Height')) || Math.min(d, 20 * IN),
      ebox: lenFt(val(p, 'Electrical_Box_Width')) || 5 * IN,
      cfm: num(val(p, 'Maximum_Air_Flow_at_0in_SP', 'Maximum_Air_Flow', 'Air_Flow')),
      lb: num(val(p, 'Net_Weight', 'Weight', 'Operating_Weight')),
      maker: val(p, 'Manufacturer') || '', model: val(p, 'Model') || ''
    };
  }).filter(Boolean);
  if (!types.length) throw new Error('No sizes with a width and depth were found in this family.');
  const nominalOf = (t) => { const L = Math.round(t.w * 12 / 12) ; return '2x' + Math.max(2, Math.min(4, L)); };
  // group by grid fit (short side), one size per nominal length
  const fitMap = new Map();
  for (const t of types) {
    const key = (t.d * 12).toFixed(2);
    if (!fitMap.has(key)) fitMap.set(key, { key, label: (t.d * 12).toFixed(2) + '″ wide', sizes: [] });
    const f = fitMap.get(key), nominal = nominalOf(t);
    if (!f.sizes.some(s => s.nominal === nominal)) f.sizes.push({ nominal, w: t.w, d: t.d, h: t.h, overall: t.overall, hw: t.hw, hd: t.hd, ebox: t.ebox, cfm: t.cfm, lb: t.lb });
  }
  const finishes = [...new Set(types.map(t => t.finish))].map(k => ({ key: k, label: { white: 'White', alum: 'Aluminum', sst: 'Stainless steel' }[k] }));
  const weights = {};
  for (const t of types) { const n = nominalOf(t); (weights[n] = weights[n] || {})[t.finish] = t.lb; }
  const maker = types[0].maker, model = types[0].model || familyTitle;
  const fits = [...fitMap.values()].sort((a, b) => b.sizes.length - a.sizes.length || +b.key - +a.key);
  return { id: 'rfa-' + familyTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), name: (maker ? maker + ' ' : '') + familyTitle.replace(/[_-]+/g, ' ').replace(/^fan filter unit\s*/i, '').replace(new RegExp('^' + maker + '\\s*', 'i'), ''), maker, model, source: 'Revit family ' + (fileName || ''), finishes, weights, fits };
}

/* What gets stored in the plan: the chosen model, fit and finish with just that fit's sizes. */
function planSpec(model, fitKey, finishKey) {
  const fit = model.fits.find(f => f.key === fitKey) || model.fits[0];
  const finish = (model.finishes.find(f => f.key === finishKey) || model.finishes[0] || { key: 'white', label: 'White' });
  const sizes = fit.sizes.map(s => ({ ...s, lb: (model.weights && model.weights[s.nominal] && model.weights[s.nominal][finish.key]) || s.lb }));
  return { id: model.id, name: model.name, maker: model.maker, model: model.model, fit: fit.key, fitLabel: fit.label, finish: finish.key, finishLabel: finish.label, sizes };
}

global.Plan3DEquipment = { BUILT_IN, readRevitFamily, planSpec, lenFt };
})(window);
