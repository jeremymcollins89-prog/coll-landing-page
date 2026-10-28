/* Coll Plan3D — heat load and electrical.
   For every room with a label: the heat its lights, fan filter unit motors, people and equipment give off
   (BTU/hr and tons of cooling), and the circuits they need. Then a panel schedule: FFUs and lights on 20 A
   branch circuits loaded to 80% (16 A), room by room, receptacles 8 to a circuit, dedicated outlets on their
   own; a 0-10 V dimming zone for each room's lights.
   These are planning numbers for sizing the AC and the panel; the mechanical and electrical engineers of
   record size the real equipment. Coll Business Solutions LLC */
(function (global) {
'use strict';
const BTU_W = 3.412, BTU_PERSON = 450; // a gowned worker, light work: about 250 sensible + 200 latent BTU/hr
const DEF = { ffuW: 180, ffuW2: 120, ledW: 40, volts: 120, pf: 0.95, people: null, safety: 10 };

// the most a light draws: the light model's size entry ("25/30/35/40/50 W switchable" → 50), else ledW
function lightW(plan, f, E) {
  const LM = plan.lightModel, Z = LM && global.Plan3DEquipment ? global.Plan3DEquipment.lightSize(LM, f) : null;
  if (Z && Z.watts) { const n = String(Z.watts).match(/\d+(\.\d+)?/g); if (n) return Math.max(...n.map(Number)); }
  return E.ledW;
}
function ffuW(f, E) { return Math.max(f.w || 2, f.h || 4) <= 2.5 ? E.ffuW2 : E.ffuW; }

function settings(plan) { return { ...DEF, ...(plan.loads || {}) }; }

function rooms(plan) {
  const V = global.Plan3DViewer, E = settings(plan);
  let C; try { C = V.cleanroomCheck(plan); } catch (e) { return { E, rooms: [], total: null }; }
  const out = C.rooms.filter(q => q.room).map(q => {
    const fx = q.fixtures || [], ffus = fx.filter(f => f.type === 'ffu'), leds = fx.filter(f => f.type !== 'ffu');
    const wF = ffus.reduce((t, f) => t + ffuW(f, E), 0), wL = leds.reduce((t, f) => t + lightW(plan, f, E), 0);
    const people = q.room.people != null && q.room.people !== '' ? +q.room.people : Math.max(q.area > 40 ? 1 : 0, Math.round(q.area / 150));
    const wEq = +q.room.equipW || 0;
    const btu = (wF + wL + wEq) * BTU_W + people * BTU_PERSON, btuS = btu * (1 + E.safety / 100);
    return { q, name: q.room.name || 'Room', ffus, leds, wF, wL, wEq, people, peopleSet: q.room.people != null && q.room.people !== '', btu, btuS, tons: btuS / 12000, area: q.area };
  });
  const sum = (k) => out.reduce((t, r) => t + r[k], 0);
  return { E, rooms: out, total: { wF: sum('wF'), wL: sum('wL'), wEq: sum('wEq'), people: sum('people'), btu: sum('btu'), btuS: sum('btuS'), tons: sum('btuS') / 12000 } };
}

/* Panel schedule: [{ n, desc, room, kind, load (W), amps, breaker }] */
function schedule(plan) {
  const L = rooms(plan), E = L.E, V = E.volts, out = [], cap = 16 * V * E.pf; // 16 A continuous on a 20 A breaker
  let n = 1;
  const pack = (items, wOf, kind, room) => {
    let cur = [], w = 0;
    const flush = () => { if (!cur.length) return; out.push({ n: n++, kind, room, desc: (kind === 'ffu' ? 'FFUs' : 'Lights') + ' · ' + room + ' (' + cur.length + ')', count: cur.length, load: w, amps: w / (V * E.pf), breaker: '20A 1P' }); cur = []; w = 0; };
    for (const it of items) { const x = wOf(it); if (w + x > cap && cur.length) flush(); cur.push(it); w += x; }
    flush();
  };
  for (const r of L.rooms) pack(r.ffus, f => ffuW(f, E), 'ffu', r.name);
  for (const r of L.rooms) pack(r.leds, f => lightW(plan, f, E), 'light', r.name);
  // fixtures outside every labeled room
  const inRooms = new Set(L.rooms.flatMap(r => r.ffus.concat(r.leds)));
  let all = []; try { const V2 = global.Plan3DViewer; all = V2.ceilingFixtures(plan, V2.analyze(plan)); } catch (e) { /* none */ }
  const key = (f) => f.x.toFixed(2) + ',' + f.y.toFixed(2), seen = new Set([...inRooms].map(key));
  const rest = all.filter(f => !seen.has(key(f)));
  if (rest.length) { pack(rest.filter(f => f.type === 'ffu'), f => ffuW(f, E), 'ffu', 'other areas'); pack(rest.filter(f => f.type !== 'ffu'), f => lightW(plan, f, E), 'light', 'other areas'); }
  const DV = (plan.devices || []), rec = DV.filter(d => d.type === 'outlet' || d.type === 'gfci');
  for (let i = 0; i < rec.length; i += 8) { const c = Math.min(8, rec.length - i); out.push({ n: n++, kind: 'rec', room: '', desc: 'Receptacles (' + c + ')', count: c, load: c * 180, amps: c * 180 / V, breaker: '20A 1P' }); }
  for (const d of DV.filter(d => d.type === 'dedicated' || d.type === 'jbox')) out.push({ n: n++, kind: 'ded', room: '', desc: d.type === 'jbox' ? 'Equipment hookup (junction box)' : 'Dedicated receptacle', count: 1, load: 0, amps: 0, breaker: '20A 1P' });
  for (const d of DV.filter(d => d.type === 'r208')) { out.push({ n, kind: 'ded', room: '', desc: '208V 30A receptacle', count: 1, load: 0, amps: 0, breaker: '30A 2P' }); n += 2; }
  const zones = L.rooms.filter(r => r.leds.length).map(r => ({ room: r.name, lights: r.leds.length }));
  const conn = out.reduce((t, c) => t + c.load, 0);
  return { E, circuits: out, zones, connectedW: conn, amps: conn / (V * E.pf), L };
}

function scheduleCSV(plan) {
  const S = schedule(plan), q = (v) => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const L = [['Circuit', 'Description', 'Room', 'Breaker', 'Load (W)', 'Amps'].join(',')];
  for (const c of S.circuits) L.push([c.n, c.desc, c.room, c.breaker, Math.round(c.load), c.amps.toFixed(1)].map(q).join(','));
  L.push('', ['', 'Connected load', '', '', Math.round(S.connectedW), S.amps.toFixed(1)].map(q).join(','));
  L.push('', 'Room,Lights W,FFU W,Equipment W,People,BTU/hr (+' + S.E.safety + '%),Tons');
  for (const r of S.L.rooms) L.push([r.name, Math.round(r.wL), Math.round(r.wF), Math.round(r.wEq), r.people, Math.round(r.btuS), r.tons.toFixed(2)].map(q).join(','));
  return '﻿' + L.join('\r\n');
}

global.Plan3DLoads = { rooms, schedule, scheduleCSV, settings, DEF, BTU_PERSON };
})(window);
