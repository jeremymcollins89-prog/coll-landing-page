/* Coll Plan3D — 3D walkthrough viewer (shared by the app and exported .html files)
   Plan units are feet. Plan (x, y) maps to 3D (x, z); y grows "down" the sheet = +z.
   Coll Business Solutions LLC */
(function (global) {
'use strict';

const CSS = `
.p3v [hidden]{display:none!important}
.p3v{position:relative;overflow:hidden;background:#dde4e8;font-family:Bahnschrift,"Segoe UI",system-ui,sans-serif;color:#eef2f3;-webkit-user-select:none;user-select:none}
.p3v-c{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab;outline:none}
.p3v-c.drag{cursor:grabbing}
.p3v-top{position:absolute;top:12px;left:12px;right:12px;display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;pointer-events:none;z-index:5}
.p3v-top>*{pointer-events:auto}
.p3v-panel{background:rgba(18,23,25,.86);border:1px solid rgba(255,255,255,.13);border-radius:10px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.p3v-card{padding:9px 13px 10px;max-width:330px;min-width:0}
.p3v-title{font-size:17px;font-weight:600;line-height:1.15}
.p3v-meta{font:11px Consolas,"Cascadia Mono",ui-monospace,monospace;color:#9aa7ad;text-transform:uppercase;letter-spacing:.04em;margin-top:3px}
.p3v-here{margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.13);display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.p3v-here b{font-size:15px;font-weight:600}
.p3v-here span{font:11.5px Consolas,"Cascadia Mono",ui-monospace,monospace;color:#f2c84b}
.p3v-modes{display:flex;border-radius:999px;padding:3px;gap:2px}
.p3v-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.p3v-mlabels{position:absolute;inset:0;pointer-events:none;overflow:hidden}.p3v-mlab{position:absolute;transform:translate(-50%,-50%);background:#ff9a1f;color:#1a1206;font:700 12.5px/1.2 ui-monospace,Consolas,monospace;padding:4px 7px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35)}.p3v-mlab small{display:block;font-weight:600;font-size:10.5px;opacity:.8}
.p3v-mhover{position:absolute;pointer-events:none;transform:translate(14px,14px);background:rgba(20,26,29,.92);color:#e8edef;font:600 12px/1.35 system-ui,sans-serif;padding:6px 9px;border-radius:8px;white-space:nowrap}.p3v-mhover b{color:#ffb547}
.p3v-ud{position:absolute;right:18px;bottom:150px;display:flex;flex-direction:column;gap:8px;pointer-events:auto}.p3v-ud button{width:54px;height:54px;border-radius:50%;border:0;background:rgba(20,26,29,.8);color:#fff;font-size:20px}
.p3v-snapdlg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,90%);padding:14px;border-radius:14px;display:flex;flex-direction:column;gap:10px;pointer-events:auto;z-index:5}.p3v-snapdlg b{color:#fff;font-size:15px}.p3v-snapdlg img{width:100%;border-radius:8px}.p3v-snapdlg textarea{background:#11171a;color:#e8edef;border:1px solid #3a464c;border-radius:8px;padding:8px;font:13px system-ui,sans-serif;resize:vertical}.p3v-snapdlg div{display:flex;justify-content:flex-end;gap:8px}.p3v-snapdlg button{border:0;border-radius:8px;padding:8px 14px;font:600 13px system-ui,sans-serif;background:#2b353a;color:#e8edef;cursor:pointer}.p3v-snapdlg button.pri{background:#f2c84b;color:#1a1606}
.p3v-meas[aria-pressed=true]{background:#ff9a1f;color:#1a1206}
.p3v-cap{position:absolute;left:50%;bottom:86px;transform:translateX(-50%);padding:12px 18px;border-radius:12px;text-align:center;pointer-events:none;max-width:80%}.p3v-cap b{display:block;font-size:17px;color:#fff;margin-bottom:2px}.p3v-cap span{font-size:12.5px;color:#cfd8dc}
.p3v-look{font-family:inherit;font-size:12.5px;font-weight:600;color:#cfd8dc;border-radius:999px;padding:6px 12px;cursor:pointer}
.p3v-look kbd{font:11px Consolas,ui-monospace,monospace;color:#9aa7ad;margin-left:4px;border:1px solid rgba(255,255,255,.2);border-radius:4px;padding:0 4px}
.p3v-look[aria-pressed=true]{background:#f2c84b;color:#121719;border-color:#f2c84b}
.p3v-look[aria-pressed=true] kbd{color:#121719;border-color:rgba(0,0,0,.3)}
.p3v-aim{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#f2c84b;box-shadow:0 0 0 2px rgba(0,0,0,.35);pointer-events:none;z-index:6;display:none}
.p3v-looking .p3v-aim{display:block}
.p3v-looking .p3v-c{cursor:none}
.p3v-modes button{font-family:inherit;font-size:13px;font-weight:600;letter-spacing:.03em;color:#9aa7ad;background:transparent;border:0;border-radius:999px;padding:7px 14px;cursor:pointer}
.p3v-modes button[aria-pressed=true]{background:#eef2f3;color:#121719}
.p3v-bottom{position:absolute;bottom:12px;left:12px;right:12px;display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none;z-index:5}
.p3v-bottom>*{pointer-events:auto}
.p3v-mini{width:130px;height:150px;display:block;cursor:crosshair}
.p3v-chips{display:flex;gap:6px;overflow-x:auto;max-width:100%;scrollbar-width:none;padding:1px}
.p3v-chips::-webkit-scrollbar{display:none}
.p3v-chips button{flex:0 0 auto;font-family:inherit;font-size:13px;font-weight:600;color:#eef2f3;background:rgba(18,23,25,.86);border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:7px 13px;cursor:pointer;white-space:nowrap}
.p3v-chips button.on{border-color:#f2c84b;color:#f2c84b}
.p3v-joy{position:absolute;left:16px;bottom:62px;width:124px;height:124px;border-radius:50%;background:rgba(18,23,25,.42);border:1px solid rgba(255,255,255,.22);z-index:6;touch-action:none;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);-webkit-user-select:none;user-select:none}.p3v-joy[hidden]{display:none}.p3v-joy i{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:rgba(255,255,255,.88);box-shadow:0 4px 14px rgba(0,0,0,.35);pointer-events:none}.p3v-joy b{position:absolute;left:0;right:0;top:-22px;text-align:center;font:600 11px system-ui,sans-serif;color:rgba(255,255,255,.75);letter-spacing:.04em;pointer-events:none}.p3v-hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;pointer-events:none;background:rgba(18,23,25,.86);border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:9px 16px;font-size:14px;transition:opacity .6s;white-space:nowrap;max-width:calc(100% - 32px);overflow:hidden;text-overflow:ellipsis}
.p3v-hint.gone{opacity:0}
.p3v-nogl{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:#e8edef;background:#121719;font:600 15px system-ui,sans-serif;z-index:9}
.p3v-labels{position:absolute;inset:0;pointer-events:none;z-index:3}
.p3v-rl{position:absolute;left:0;top:0;background:rgba(18,23,25,.86);border:1px solid rgba(255,255,255,.13);border-radius:6px;padding:3px 8px;text-align:center;white-space:nowrap}
.p3v-rl b{display:block;font-size:12.5px;font-weight:600}
.p3v-rl span{font:10.5px Consolas,ui-monospace,monospace;color:#f2c84b}
.p3v-touch .p3v-rl{padding:2px 6px;border-radius:5px;opacity:.88}.p3v-touch .p3v-rl b{font-size:10.5px}.p3v-touch .p3v-rl span{display:none}
.p3v button:focus-visible{outline:2px solid #f2c84b;outline-offset:2px}
.p3v-cbtn{pointer-events:auto;cursor:pointer;font:600 13px/1 inherit;color:#e8edef;padding:9px 12px;border:0}.p3v-cbtn[aria-pressed=true]{background:#f2c84b;color:#1a1f22}
.p3v-clist{position:absolute;left:12px;bottom:12px;z-index:6;max-width:min(360px,calc(100% - 24px));max-height:40%;overflow:auto;padding:10px 12px;color:#e8edef;font:13px/1.4 system-ui,sans-serif;pointer-events:auto}
.p3v-clist ol{margin:6px 0;padding-left:20px}.p3v-clist li{margin:3px 0}.p3v-clist small{color:#9fb0b7}.p3v-clist button{font:600 12px inherit;margin:6px 6px 0 0;padding:6px 10px;border-radius:7px;border:0;background:#f2c84b;color:#1a1f22;cursor:pointer}.p3v-clist button.x{background:transparent;color:#9fb0b7;padding:0 4px;margin:0}
.p3v-cform{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:8;display:flex;flex-direction:column;gap:8px;padding:14px;width:min(340px,calc(100% - 40px));color:#e8edef;font:13px system-ui,sans-serif;pointer-events:auto}
.p3v-cform textarea,.p3v-cform input{font:13px system-ui,sans-serif;padding:7px 8px;border-radius:7px;border:1px solid #3d4a50;background:#1b2226;color:#e8edef}
.p3v-clist button.p3v-abtn{display:block;width:100%;margin:2px 0 8px;padding:9px 10px;font-size:13px;background:#3fb36b;color:#fff}.p3v-clist button.p3v-abtn.done{background:#28343a;color:#8fd9a8}
.p3v-clist .p3v-chead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.p3v-clist .p3v-chead button.x{font-size:20px;line-height:1;padding:2px 6px}
.p3v-clist button.p3v-cadd{display:block;width:100%;margin:0 0 8px;padding:9px 10px;font-size:13px;background:#2b3439;color:#f2c84b;border:1px solid rgba(242,200,75,.45)}
.p3v-touch .p3v-clist{left:auto;right:10px;top:58px;bottom:auto;width:min(330px,calc(100% - 170px));max-width:none;max-height:calc(100% - 76px);z-index:9;box-shadow:0 14px 40px rgba(0,0,0,.45)}
.p3v-touch .p3v-cbtn .p3v-cn{display:inline-block;min-width:18px;margin-left:5px;padding:2px 5px;border-radius:999px;background:#f2c84b;color:#1a1f22;font-size:11px;text-align:center}
.p3v-touch .p3v-cbtn .p3v-cn:empty{display:none}
.p3v-touch .p3v-cbtn[aria-pressed=true] .p3v-cn{background:#1a1f22;color:#f2c84b}
.p3v-adec button{flex:1;margin:0!important;background:#28343a!important;color:#e8edef!important}.p3v-adec button[aria-pressed=true]{background:#3fb36b!important;color:#fff!important}.p3v-adec button[data-dec=changes][aria-pressed=true]{background:#f2c84b!important;color:#1a1f22!important}
.p3v-cform button{font:600 13px inherit;padding:7px 12px;border-radius:7px;border:0;margin-right:6px;cursor:pointer;background:#f2c84b;color:#1a1f22}.p3v-cform .p3v-ccancel{background:#3d4a50;color:#e8edef}
.p3v-empty{position:absolute;inset:0;display:grid;place-items:center;color:#5b676d;font-size:16px;pointer-events:none;z-index:2}
`;

function injectCSS() {
  if (document.getElementById('p3v-css')) return;
  const s = document.createElement('style'); s.id = 'p3v-css'; s.textContent = CSS; document.head.appendChild(s);
}
function makeCanvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
const CANVAS_CACHE = {};
function cachedCanvas(key, createFn) {
  if (!CANVAS_CACHE[key]) CANVAS_CACHE[key] = createFn();
  return CANVAS_CACHE[key];
}

function segDist(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - x1) * dx + (pz - z1) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t));
}
function segCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const o = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const d1 = o(cx, cz, dx, dz, ax, az), d2 = o(cx, cz, dx, dz, bx, bz), d3 = o(ax, az, bx, bz, cx, cz), d4 = o(ax, az, bx, bz, dx, dz);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
const FR = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
function fmtFt(ft) {
  const e = Math.round(Math.abs(ft) * 96), f = Math.floor(e / 96), r = e - f * 96;
  return (ft < 0 ? '-' : '') + f + '′-' + Math.floor(r / 8) + FR[r % 8] + '″';
}

/* ---------- Wall types ----------
   A wall with no kind is a hardwall cleanroom panel (the default). Building walls (concrete, block, metal,
   stud) are drawn to their own height (w.h, else plan.shellH, else 20′), have no panel joints, rubber base or
   ceiling track, and don't make a cleanroom ceiling. */
const WALL_KINDS = {
  hardwall: { label: 'Hardwall cleanroom panel', short: 'Hardwall', t: 0.25, color: 0xf7f8f8, plan: '#e9eef0' },
  concrete: { label: 'Concrete (tilt-up / poured)', short: 'Concrete', t: 8 / 12, color: 0xb9b6ae, plan: '#a9a59c' },
  cmu: { label: 'Concrete block (CMU)', short: 'Block', t: 8 / 12, color: 0xc9c5bb, plan: '#bdb7aa' },
  metal: { label: 'Metal building panel', short: 'Metal panel', t: 6 / 12, color: 0xdfe3e5, plan: '#b6c3ca' },
  stud: { label: 'Stud wall, drywall', short: 'Stud / drywall', t: 4.875 / 12, color: 0xefede8, plan: '#d9d4c8' },
  // house walls: framed, drywall inside, sheathing and siding outside; as tall as the ceiling
  wood: { label: 'Wood stud wall (house)', short: 'Wood stud', t: 4.5 / 12, color: 0xf2efe9, plan: '#e6d3b3', frame: true },
  steel: { label: 'Steel stud wall (house)', short: 'Steel stud', t: 4.5 / 12, color: 0xf2efe9, plan: '#c9d3da', frame: true }
};
const isHard = (w) => !w || !w.kind || w.kind === 'hardwall' || !WALL_KINDS[w.kind];
const isFrame = (w) => !!(w && w.kind && WALL_KINDS[w.kind] && WALL_KINDS[w.kind].frame);

/* ---------- House items: kitchen, bath, laundry, utility ----------
   w = width along the wall, d = depth out from the wall, h = height (feet). wv: width can change. */
const ITEMS = {
  base: { label: 'Base cabinet', group: 'Kitchen', w: 3, d: 2, h: 3, wv: true },
  sinkbase: { label: 'Sink base with sink', group: 'Kitchen', w: 3, d: 2, h: 3, wv: true },
  upper: { label: 'Upper cabinet', group: 'Kitchen', w: 3, d: 1, h: 2.5, z: 4.5, wv: true },
  tall: { label: 'Pantry cabinet', group: 'Kitchen', w: 2, d: 2, h: 7, wv: true },
  island: { label: 'Island', group: 'Kitchen', w: 6, d: 3, h: 3, wv: true, free: true },
  range: { label: 'Range / oven', group: 'Kitchen', w: 2.5, d: 2.17, h: 3 },
  fridge: { label: 'Refrigerator', group: 'Kitchen', w: 3, d: 2.5, h: 5.83 },
  dishwasher: { label: 'Dishwasher', group: 'Kitchen', w: 2, d: 2, h: 2.83 },
  toilet: { label: 'Toilet', group: 'Bathroom', w: 1.67, d: 2.42, h: 2.5 },
  vanity: { label: 'Vanity with sink', group: 'Bathroom', w: 3, d: 1.75, h: 2.83, wv: true },
  tub: { label: 'Bathtub', group: 'Bathroom', w: 5, d: 2.5, h: 1.67 },
  shower: { label: 'Shower', group: 'Bathroom', w: 3, d: 3, h: 6.67, wv: true },
  washer: { label: 'Washer', group: 'Laundry & utility', w: 2.25, d: 2.33, h: 3.17 },
  dryer: { label: 'Dryer', group: 'Laundry & utility', w: 2.25, d: 2.33, h: 3.17 },
  waterheater: { label: 'Water heater', group: 'Laundry & utility', w: 1.83, d: 1.83, h: 5 },
  furnace: { label: 'Furnace', group: 'Laundry & utility', w: 1.75, d: 2.33, h: 4 },
  // more kitchen
  walloven: { label: 'Double wall oven', group: 'Kitchen', w: 2.5, d: 2, h: 7 },
  hood: { label: 'Range hood', group: 'Kitchen', w: 2.5, d: 1.67, h: 1.5, z: 5.5, wv: true },
  microwave: { label: 'Over-range microwave', group: 'Kitchen', w: 2.5, d: 1.33, h: 1.42, z: 5.4 },
  winefridge: { label: 'Wine cooler', group: 'Kitchen', w: 2, d: 2, h: 3 },
  stools: { label: 'Counter stools (3)', group: 'Kitchen', w: 5, d: 1.5, h: 2.17, free: true },
  pantrywall: { label: 'Coffee bar / hutch', group: 'Kitchen', w: 5, d: 1.67, h: 7, wv: true },
  // more bathroom
  dblvanity: { label: 'Double vanity', group: 'Bathroom', w: 5, d: 1.83, h: 2.83, wv: true },
  freetub: { label: 'Freestanding tub', group: 'Bathroom', w: 5.5, d: 2.67, h: 2, free: true },
  linen: { label: 'Linen cabinet', group: 'Bathroom', w: 1.5, d: 1.33, h: 7 },
  mirror: { label: 'Mirror', group: 'Bathroom', w: 3, d: 0.1, h: 3, z: 3.6, wv: true },
  bidet: { label: 'Bidet', group: 'Bathroom', w: 1.33, d: 2, h: 1.33 },
  // more laundry & utility
  utilsink: { label: 'Utility sink', group: 'Laundry & utility', w: 2, d: 1.83, h: 2.92 },
  laundrycounter: { label: 'Folding counter', group: 'Laundry & utility', w: 5, d: 2.17, h: 3, wv: true },
  // living room
  sofa: { label: 'Sofa', group: 'Living room', w: 7, d: 3, h: 2.75, wv: true },
  sectional: { label: 'Sectional', group: 'Living room', w: 9.5, d: 7, h: 2.75 },
  loveseat: { label: 'Loveseat', group: 'Living room', w: 5.5, d: 3, h: 2.75 },
  armchair: { label: 'Armchair', group: 'Living room', w: 2.83, d: 2.83, h: 2.75, free: true },
  coffeetable: { label: 'Coffee table', group: 'Living room', w: 4, d: 2, h: 1.5, free: true },
  sidetable: { label: 'Side table', group: 'Living room', w: 1.67, d: 1.67, h: 2, free: true },
  tvconsole: { label: 'TV and media console', group: 'Living room', w: 6, d: 1.5, h: 2, wv: true },
  fireplace: { label: 'Fireplace with mantel', group: 'Living room', w: 5, d: 1.5, h: 4.5, wv: true },
  bookcase: { label: 'Bookcase', group: 'Living room', w: 3, d: 1.17, h: 7, wv: true },
  rug: { label: 'Area rug 8×10', group: 'Living room', w: 10, d: 8, h: 0.04, free: true },
  // dining
  dining6: { label: 'Dining table, 6 chairs', group: 'Dining', w: 7.5, d: 6.5, h: 2.5, free: true },
  dining4: { label: 'Round table, 4 chairs', group: 'Dining', w: 6, d: 6, h: 2.5, free: true },
  buffet: { label: 'Sideboard', group: 'Dining', w: 6, d: 1.5, h: 3, wv: true },
  // bedroom
  kingbed: { label: 'King bed', group: 'Bedroom', w: 6.83, d: 7.33, h: 3.5 },
  queenbed: { label: 'Queen bed', group: 'Bedroom', w: 5.33, d: 7, h: 3.5 },
  twinbed: { label: 'Twin bed', group: 'Bedroom', w: 3.42, d: 6.67, h: 3 },
  nightstand: { label: 'Nightstand', group: 'Bedroom', w: 2, d: 1.5, h: 2 },
  dresser: { label: 'Dresser', group: 'Bedroom', w: 5, d: 1.67, h: 3, wv: true },
  closet: { label: 'Closet shelf and rod', group: 'Bedroom', w: 6, d: 2, h: 7, wv: true },
  desk: { label: 'Desk and chair', group: 'Bedroom', w: 5, d: 4, h: 2.5 },
  // lighting
  ceilfan: { label: 'Ceiling fan with light', group: 'Lighting', w: 4.33, d: 4.33, h: 1.2, ceil: true, free: true },
  chandelier: { label: 'Chandelier', group: 'Lighting', w: 2.5, d: 2.5, h: 2.2, ceil: true, free: true },
  pendants: { label: 'Pendant lights (3)', group: 'Lighting', w: 6, d: 1, h: 2.2, ceil: true, free: true },
  sconce: { label: 'Wall sconces (pair)', group: 'Lighting', w: 3, d: 0.5, h: 0.8, z: 5.5, wv: true },
  // outdoor & garage
  car: { label: 'Car', group: 'Outdoor & garage', w: 6.25, d: 15.5, h: 4.75, free: true },
  workbench: { label: 'Garage workbench', group: 'Outdoor & garage', w: 6, d: 2, h: 3, wv: true },
  grill: { label: 'Grill', group: 'Outdoor & garage', w: 5, d: 2, h: 3.75, free: true },
  hottub: { label: 'Hot tub', group: 'Outdoor & garage', w: 7, d: 7, h: 3, free: true },
  patioset: { label: 'Patio table and chairs', group: 'Outdoor & garage', w: 6, d: 6, h: 2.5, free: true },
  condenser: { label: 'AC condenser', group: 'Outdoor & garage', w: 2.5, d: 2.5, h: 2.67 },
  // a machine brought in from a drawing (Library → Add a machine): it carries its own plan linework
  // (it.lines, it.swings, local feet about its centre), size (w × d) and height (it.h)
  // ---- cleanroom furniture and equipment (cr: shown in cleanroom plans; sz: width, depth and height can change)
  sstable: { label: 'Stainless steel table', group: 'Cleanroom furniture', w: 6, d: 2.5, h: 34 / 12, cr: true, sz: true },
  sscart: { label: 'Stainless utility cart', group: 'Cleanroom furniture', w: 3, d: 1.67, h: 3, cr: true, sz: true, free: true },
  shelving: { label: 'Wire shelving, stainless', group: 'Cleanroom furniture', w: 4, d: 1.5, h: 6, cr: true, sz: true },
  sscabinet: { label: 'Stainless storage cabinet', group: 'Cleanroom furniture', w: 3, d: 1.5, h: 6, cr: true, sz: true },
  gownbench: { label: 'Gowning bench (step-over)', group: 'Cleanroom furniture', w: 6, d: 1.33, h: 1.5, cr: true, sz: true, free: true },
  gownrack: { label: 'Garment rack, stainless', group: 'Cleanroom furniture', w: 4, d: 1.67, h: 6, cr: true, wv: true },
  crchair: { label: 'Cleanroom chair', group: 'Cleanroom furniture', w: 1.83, d: 1.83, h: 3.5, cr: true, free: true },
  sstrash: { label: 'Waste can, stainless, foot pedal', group: 'Cleanroom furniture', w: 1.25, d: 1.25, h: 2.33, cr: true },
  tackymat: { label: 'Tacky mat', group: 'Cleanroom furniture', w: 3, d: 2, h: 0.02, cr: true, sz: true, free: true },
  cubicle: { label: 'Cubicle workstation, grey panels', group: 'Cleanroom furniture', w: 6.5, d: 3, h: 4.5, cr: true, sz: true },
  // more cleanroom furniture, sized like the usual catalog pieces (Terra Universal and the like)
  crstool: { label: 'Cleanroom stool, adjustable (ESD)', group: 'Cleanroom furniture', w: 1.33, d: 1.33, h: 2.6, cr: true, free: true },
  wallshelf: { label: 'Wall shelf, stainless, perforated', group: 'Cleanroom furniture', w: 4, d: 1.17, h: 0.6, z: 5, cr: true, wv: true },
  wallcab: { label: 'Wall cabinet, stainless, glass doors', group: 'Cleanroom furniture', w: 3, d: 1.17, h: 2.5, z: 5, cr: true, wv: true },
  locker: { label: 'Gowning locker, stainless, 3 tiers', group: 'Cleanroom furniture', w: 1.25, d: 1.5, h: 6, cr: true },
  mirror: { label: 'Gowning mirror, full length', group: 'Cleanroom furniture', w: 2, d: 0.17, h: 5, z: 1, cr: true },
  bootrack: { label: 'Boot and shoe rack, stainless', group: 'Cleanroom furniture', w: 4, d: 1.17, h: 3, cr: true, sz: true },
  esdbench: { label: 'Cleanroom workstation, ESD top, upper shelf and light', group: 'Workstations and storage', w: 6, d: 2.5, h: 6.5, cr: true, sz: true },
  lfbench: { label: 'Laminar flow workstation, horizontal', group: 'Workstations and storage', w: 4, d: 2.5, h: 6.5, cr: true, wv: true },
  desiccator: { label: 'Desiccator cabinet, nitrogen purge, 4 doors', group: 'Workstations and storage', w: 2.83, d: 1.83, h: 6, cr: true, sz: true },
  desicbench: { label: 'Desiccator cabinet, benchtop, 2 doors', group: 'Workstations and storage', w: 2, d: 1.67, h: 1.67, z: 3, cr: true },
  glovebox: { label: 'Glove box, acrylic, nitrogen', group: 'Workstations and storage', w: 4, d: 2.33, h: 2.5, z: 3, cr: true, wv: true },
  fumehood: { label: 'Fume hood, with base cabinets', group: 'Workstations and storage', w: 6, d: 2.67, h: 8, cr: true, wv: true },
  gowncab: { label: 'Garment cabinet, HEPA-filtered', group: 'Workstations and storage', w: 4, d: 2, h: 7, cr: true, wv: true },
  partcart: { label: 'Particle counter on a cart', group: 'Workstations and storage', w: 1.5, d: 1.5, h: 3.5, cr: true, free: true },
  shoecleaner: { label: 'Shoe sole cleaner, stainless (brushes)', group: 'Sinks and gowning', w: 1.83, d: 2.33, h: 3.5, cr: true },
  wipestation: { label: 'Wipes and IPA station, wall', group: 'Sinks and gowning', w: 1.5, d: 0.5, h: 1.5, z: 3.5, cr: true },
  eyewash: { label: 'Eyewash station, wall', group: 'Sinks and gowning', w: 1.25, d: 0.83, h: 1, z: 3, cr: true },
  ivpole: { label: 'IV pole, mobile', group: 'IV and compounding', w: 2, d: 2, h: 6.5, cr: true, free: true },
  ivrack: { label: 'IV rack, mobile (12 hooks)', group: 'IV and compounding', w: 3, d: 2, h: 6, cr: true, free: true, wv: true },
  ivbar: { label: 'IV bar, wall-mounted', group: 'IV and compounding', w: 4, d: 0.42, h: 0.5, z: 5.5, cr: true, wv: true },
  lafw: { label: 'Laminar flow hood (LAFW)', group: 'IV and compounding', w: 4, d: 2.75, h: 7, cr: true, wv: true },
  bsc: { label: 'Biosafety cabinet, Class II', group: 'IV and compounding', w: 4, d: 2.75, h: 7, cr: true, wv: true },
  isolator: { label: 'Compounding aseptic isolator', group: 'IV and compounding', w: 4.5, d: 2.75, h: 6.75, cr: true, wv: true },
  medfridge: { label: 'Pharmacy refrigerator', group: 'IV and compounding', w: 2.25, d: 2.25, h: 6.5, cr: true },
  handsink: { label: 'Hand sink, stainless, hands-free', group: 'Sinks and gowning', w: 2, d: 1.67, h: 3, cr: true },
  scrubsink: { label: 'Scrub sink, stainless, 2 stations', group: 'Sinks and gowning', w: 5, d: 2.17, h: 3, cr: true, wv: true },
  dispenser: { label: 'Glove, mask and bouffant dispenser', group: 'Sinks and gowning', w: 3, d: 0.42, h: 1.25, z: 4, cr: true },
  shoecover: { label: 'Shoe cover dispenser', group: 'Sinks and gowning', w: 1.25, d: 1.25, h: 2.5, cr: true },
  airshower: { label: 'Air shower, walk-through (interlocked doors)', group: 'Air showers and ceiling', w: 4.17, d: 3.67, h: 7.1, cr: true },
  teardrop: { label: 'Teardrop LED light, on a grid tee', group: 'Air showers and ceiling', w: 4, d: 0.25, h: 0.2, ceil: true, cr: true, free: true },
  sprinkler: { label: 'Fire sprinkler head, pendent', group: 'Air showers and ceiling', w: 0.3, d: 0.3, h: 0.25, ceil: true, cr: true, free: true },
  smokedet: { label: 'Smoke detector', group: 'Air showers and ceiling', w: 0.5, d: 0.5, h: 0.16, ceil: true, cr: true, free: true },
  machine: { label: 'Machine', group: 'Equipment', w: 4, d: 4, h: 8, free: true, hidden: true },
  // stairs up to the floor above: risers 7¾″ max, treads 10″; d is the run (it's set from the floor-to-floor height
  // when placed). The floor above gets a stairwell opening over it.
  stairs: { label: 'Stairs, straight run', group: 'Stairs', w: 3, d: 12, h: 9, free: true, wv: true },
  stairsL: { label: 'Stairs with landing (L)', group: 'Stairs', w: 6.5, d: 10, h: 9, free: true }
};
/* ---------- House foundation (plan.foundation) ----------
   type: slab (monolithic slab, thickened edge), stem (stem wall on a footing, slab inside), crawl (stem wall on a
   footing, wood floor over a crawlspace), basement (full-height basement walls on a footing, slab). Sizes in feet. */
const FOUNDATIONS = {
  slab: { label: 'Slab on grade, thickened edge', exp: 0.33 },
  stem: { label: 'Stem wall and footing, slab inside', exp: 0.67 },
  crawl: { label: 'Crawlspace: stem wall, footing, wood floor', exp: 1.5 },
  basement: { label: 'Full basement: 8′ walls, footing, slab', exp: 0.67 },
  none: { label: 'None (on an existing slab)', exp: 0 }
};
function foundationOf(plan) {
  const F = Object.assign({ type: 'slab', slabT: 4 / 12, footW: 16 / 12, footD: 12 / 12, stemT: 8 / 12, stemH: 2, crawlH: 3, baseH: 8, gravel: 4 / 12, mesh: 'wwm' }, (plan && plan.foundation) || {});
  if (!FOUNDATIONS[F.type]) F.type = 'slab';
  return F;
}
/* The house's outside walls (framed walls with the outdoors on one side), as the takeoff and foundation use them. */
function houseExtWalls(plan, A) {
  A = A || analyze(plan);
  const FP = footprint(A, true), out = (x, z) => !FP || !FP.has(x, z);
  return (A.walls || []).filter(w => isFrame(w)).filter(w => {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 0.2) return false;
    if (w.ext != null) return !!w.ext;
    const t = w.t || 0.375, nx = -(w.y2 - w.y1) / L, nz = (w.x2 - w.x1) / L, cx = (w.x1 + w.x2) / 2, cz = (w.y1 + w.y2) / 2, off = t / 2 + 0.8;
    return out(cx + nx * off, cz + nz * off) || out(cx - nx * off, cz - nz * off);
  });
}
/* Foundation quantities: perimeter (outside walls), slab area (the whole footprint) and the concrete, steel,
   gravel and the rest for the chosen type. Concrete in cubic yards (+5%), rebar in feet (#4, +10% laps). */
function foundationTakeoff(plan, A) {
  A = A || analyze(plan);
  const F = foundationOf(plan), FP = footprint(A, true), ext = houseExtWalls(plan, A);
  const len = (w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  const perim = ext.reduce((t, w) => t + len(w), 0), area = FP ? FP.area : 0;
  if (F.type === 'none' || !perim) return { F, perim, area, lines: [] };
  // over a basement floor (plan.__baseRects, from the levels): the part past it (an attached garage, a porch
  // wing) sits on a stem wall and slab instead of basement walls
  const BR = F.type === 'basement' && plan.__baseRects && plan.__baseRects.length ? plan.__baseRects : null;
  if (BR) {
    const inB = (x, z, m) => BR.some(r => x >= r[0] - m && x <= r[2] + m && z >= r[1] - m && z <= r[3] + m);
    const eB = ext.filter(w => inB((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, 1)), eS = ext.filter(w => !eB.includes(w));
    let aS = 0; if (FP) for (let k = 0; k < FP.inside.length; k++) if (FP.inside[k]) { const i = k % FP.nx, j = (k - i) / FP.nx; if (!inB(FP.x0 + (i + 0.5) * FP.cell, FP.z0 + (j + 0.5) * FP.cell, 0)) aS += FP.cell * FP.cell; }
    if (eS.length && aS > 1) {
      const pB = plan.__basePerim || eB.reduce((t, w) => t + len(w), 0), pS = eS.reduce((t, w) => t + len(w), 0);
      const lines = foundationLines(F, 'basement', pB, area - aS, eB.length, '').concat(foundationLines(F, 'stem', pS, aS, eS.length, ' (garage / wing on slab)'));
      return { F, perim, area, ext, lines };
    }
  }
  return { F, perim, area, ext, lines: foundationLines(F, F.type, perim, area, ext.length, '') };
}
function foundationLines(F, type, perim, area, nWalls, tag) {
  const cy = (cf) => cf / 27 * 1.05, L = [];
  const footCF = perim * F.footW * F.footD;
  if (type === 'slab') {
    L.push(['Concrete', 'Concrete, monolithic slab ' + Math.round(F.slabT * 12) + '″ with thickened edge ' + Math.round(F.footW * 12) + '″ × ' + Math.round(F.footD * 12) + '″' + tag, '', cy(area * F.slabT + perim * F.footW * Math.max(0, F.footD - F.slabT)), 'cu yd']);
  } else {
    L.push(['Concrete', 'Concrete, footings ' + Math.round(F.footW * 12) + '″ × ' + Math.round(F.footD * 12) + '″' + tag, '', cy(footCF), 'cu yd']);
    const wallH = type === 'basement' ? F.baseH : type === 'crawl' ? F.crawlH : F.stemH;
    L.push(['Concrete', (type === 'basement' ? 'Concrete, basement walls ' : 'Concrete, stem walls ') + Math.round(F.stemT * 12) + '″ × ' + (wallH >= 1 ? fmtFt(wallH) : Math.round(wallH * 12) + '″') + tag, '', cy(perim * F.stemT * wallH), 'cu yd']);
    L.push(['Concrete', 'Wall forms (both faces)' + tag, '', perim * wallH * 2, 'sq ft']);
    if (type !== 'crawl') L.push(['Concrete', 'Concrete, slab ' + Math.round(F.slabT * 12) + '″' + (type === 'basement' ? ' (basement floor)' : tag), '', cy(Math.max(0, area - perim * F.stemT) * F.slabT), 'cu yd']);
    L.push(['Rebar', 'Rebar #4, wall verticals at 24″ (with hooks)' + tag, '', Math.ceil(perim / 2) * (wallH + F.footD + 1), 'lin ft']);
    L.push(['Rebar', 'Rebar #4, wall horizontals (' + (wallH > 3 ? 'at 18″' : '2 bars') + ')' + tag, '', perim * (wallH > 3 ? Math.ceil(wallH / 1.5) : 2) * 1.1, 'lin ft']);
  }
  L.push(['Rebar', 'Rebar #4, footing / edge, 2 continuous' + tag, '', perim * 2 * 1.1, 'lin ft']);
  if (type !== 'crawl') {
    if (F.mesh === 'rebar') L.push(['Rebar', 'Rebar #4 at 18″ each way, slab' + tag, '', area / 1.5 * 2 * 1.1, 'lin ft']);
    else L.push(['Rebar', 'Welded wire mesh 6×6 W1.4, slab' + tag, '', area * 1.1, 'sq ft']);
    L.push(['Concrete', 'Gravel base ' + Math.round(F.gravel * 12) + '″, compacted' + tag, '', area * F.gravel / 27 * 1.1, 'cu yd']);
    L.push(['Concrete', 'Vapor barrier, 10 mil under slab' + tag, '', area * 1.15, 'sq ft']);
  } else {
    L.push(['Concrete', 'Ground vapor barrier, 6 mil (crawlspace)', '', area * 1.15, 'sq ft']);
    L.push(['Concrete', 'Foundation vents', '1 per 150 sq ft', Math.ceil(area / 150), 'ea']);
    L.push(['Framing', 'Floor joists 2×10 at 16″ (est.)', '', Math.ceil(area / 1.333 / 12 * 1.1), 'pcs (12′)']);
    L.push(['Framing', 'Subfloor ¾″ T&G OSB 4×8', '', Math.ceil(area / 32 * 1.1), 'sheets']);
    L.push(['Framing', 'Sill plate, pressure-treated 2×6', '', perim * 1.05, 'lin ft']);
  }
  if (type === 'basement') {
    L.push(['Concrete', 'Foundation waterproofing (basement walls)', '', perim * F.baseH, 'sq ft']);
    L.push(['Concrete', 'Perimeter drain tile, 4″ with gravel', '', perim * 1.05, 'lin ft']);
    L.push(['Framing', 'Floor joists over basement, 2×10 at 16″ (est.)', '', Math.ceil(area / 1.333 / 12 * 1.1), 'pcs (12′)']);
    L.push(['Framing', 'Subfloor ¾″ T&G OSB 4×8', '', Math.ceil(area / 32 * 1.1), 'sheets']);
  }
  L.push(['Concrete', 'Anchor bolts ½″ × 10″ (6′ on center, 12″ from corners)' + tag, '', Math.ceil(perim / 6) + nWalls * 2, 'ea']);
  L.push(['Concrete', 'Sill seal gasket' + tag, '', perim * 1.05, 'lin ft']);
  return L;
}
/* Where a wall taller than one 12′ panel is stacked: the first joint at the ceiling line when the room's ceiling
   (the higher of the two sides) leaves a plenum panel of 12′ or less above it, otherwise at 12′; then every 12′.
   Returns the panel heights bottom to top, e.g. [11, 3] for a 14′ wall over an 11′ ceiling. */
function panelStack(h, ceil) {
  if (!(h > 12 + 1 / 96)) return [h];
  const r = []; let y = 0;
  if (ceil >= 4 && ceil <= 12 && h - ceil > 0.25) { r.push(ceil); y = ceil; }
  while (h - y > 12 + 1 / 96) { r.push(12); y += 12; }
  r.push(h - y); return r;
}
function wallCeil(plan, A, p) {
  const CA = ceilAreas(plan, A), L = Math.hypot(p.x2 - p.x1, p.z2 - p.z1) || 1, nx = -(p.z2 - p.z1) / L, nz = (p.x2 - p.x1) / L, o = (p.t || 0.25) / 2 + 0.4;
  // the highest ceiling along either face, ends included (a short piece at a corner of a raised room)
  let h = 0;
  for (const f of [0.5, 0.02, 0.98]) { const mx = p.x1 + (p.x2 - p.x1) * f, mz = p.z1 + (p.z2 - p.z1) * f; h = Math.max(h, ceilingAt(CA, A.H, mx + nx * o, mz + nz * o), ceilingAt(CA, A.H, mx - nx * o, mz - nz * o)); }
  return h;
}
/* ---------- Stories (plan.levels) ----------
   A house can have several floors. plan.levels = [{ id, name, data }] and plan.level is the floor being edited:
   its contents (walls, openings, rooms, items…) live on the plan itself, as a one-floor plan always has; the
   others are kept in their level's data. Floor k sits at the sum of the floor-to-floor heights below it: each
   floor's wall height plus the floor system (plan.floorDepth, 1′ to start: joists and subfloor). */
const LEVEL_KEYS = ['walls', 'openings', 'rooms', 'items', 'devices', 'chases', 'columns', 'beams', 'headers', 'grilles', 'ceiling'];
function levelData(plan, k) {
  const L = plan.levels || [], cur = plan.level || 0;
  if (k === cur || !L.length) { const d = {}; for (const key of LEVEL_KEYS) d[key] = plan[key]; return d; }
  return Object.assign({ walls: [], openings: [], rooms: [], items: [], devices: [], chases: [], columns: [], beams: [], headers: [], grilles: [], ceiling: plan.ceiling || 8 }, (L[k] && L[k].data) || {});
}
const floorDepthOf = (plan) => Math.max(0.5, Math.min(3, +plan.floorDepth || 1));
const stairRise = (plan, k) => (levelData(plan, k).ceiling || plan.ceiling || 8) + floorDepthOf(plan);
/* Each floor as a plan of its own, with its elevation: the roof on the top floor only, the foundation under the
   first; a floor over another gets the stairwell openings of the stairs coming up from below. */
function levelPlans(plan) {
  const L = plan.levels || [];
  if (L.length < 2) return [{ k: 0, name: (L[0] && L[0].name) || '', plan, elev: 0, top: true }];
  // a basement (level.below) sits below grade: the first floor above it is at 0
  const out = []; let elev = 0;
  for (let k = 0; k < L.length && L[k].below; k++) elev -= stairRise(plan, k);
  for (let k = 0; k < L.length; k++) {
    const d = levelData(plan, k), lp = Object.assign({}, plan, JSON.parse(JSON.stringify(d)));
    delete lp.levels; lp.level = 0;
    // a lower floor keeps the roof only where no floor sits on it (an attached garage, a one-story wing)
    if (k < L.length - 1) {
      const cover = [];
      if (!L[k].below) for (let j = k + 1; j < L.length; j++) { const up = Object.assign({}, plan, JSON.parse(JSON.stringify(levelData(plan, j)))); delete up.levels; up.level = 0; const Au = analyze(up), fu = footprint(Au, true), gw = Math.max(0.5, (up.wallT || 0.375) / 2 + 0.45); if (fu) cover.push(...fu.rects.map(r => [r[0] - gw, r[1] - gw, r[2] + gw, r[3] + gw])); }
      if (cover.length) lp.__roofCover = cover; else lp.roof = { type: 'none' };
    }
    const grade = !L[k].below && (k === 0 || L[k - 1].below);
    if (!grade) { lp.foundation = { type: k === 0 ? 'none' : 'none' }; if (!L[k].below) lp.__floorBand = floorDepthOf(plan); lp.inserts = []; }
    if (L[k].below) { lp.roof = { type: 'none' }; lp.__below = true; }
    lp.__top = k === L.length - 1; lp.__grade = grade;
    if (grade && k > 0) { const br = []; for (let j = 0; j < k; j++) if (L[j].below) { const dn = Object.assign({}, plan, JSON.parse(JSON.stringify(levelData(plan, j)))); delete dn.levels; dn.level = 0; const fd = footprint(analyze(dn), true); if (fd) { br.push(...fd.rects); let e = 0; for (let q = 0; q < fd.inside.length; q++) if (fd.inside[q]) { const i = q % fd.nx, jj = (q - i) / fd.nx; for (const [a2, b2] of [[i - 1, jj], [i + 1, jj], [i, jj - 1], [i, jj + 1]]) if (a2 < 0 || b2 < 0 || a2 >= fd.nx || b2 >= fd.nz || !fd.inside[b2 * fd.nx + a2]) e++; } lp.__basePerim = (lp.__basePerim || 0) + e * fd.cell; } } if (br.length) lp.__baseRects = br; }
    lp.__rise = stairRise(plan, k); lp.__elev = elev;
    const holes = (items) => (items || []).filter(it => it.type === 'stairs' || it.type === 'stairsL').map(it => { const c = itemCorners(it); return { x0: Math.min(...c.map(q => q[0])), z0: Math.min(...c.map(q => q[1])), x1: Math.max(...c.map(q => q[0])), z1: Math.max(...c.map(q => q[1])) }; });
    lp.__ceilHoles = holes(d.items);
    if (k > 0) lp.__floorHoles = holes(levelData(plan, k - 1).items);
    out.push({ k, name: L[k].name || 'Floor ' + (k + 1), plan: lp, elev, top: k === L.length - 1, grade });
    elev += stairRise(plan, k);
  }
  return out;
}
/* House finishes: picked in the Plan panel (plan.finish), shown in 3D and named on the parts list. */
/* Cleanroom wall panel colours (plan.panelColor for the whole cleanroom, wall.color for one wall) */
/* Ceiling tile types (plan.tileType): vinyl-covered gypsum is the standard cleanroom tile; thin aluminum pans
   are the option */
const TILE_TYPES = { vcg: { label: 'Vinyl-covered gypsum', short: 'vinyl-covered gypsum' }, alum: { label: 'Aluminum', short: 'aluminum' } };
const tileTypeOf = (plan) => (plan && TILE_TYPES[plan.tileType]) ? plan.tileType : 'vcg';
// aluminum tiles are usually painted: plan.tileColor is a panel colour key, or 'natural' for bare aluminum
const tileColorOf = (plan) => (plan && plan.tileColor && plan.tileColor !== 'natural' && PANEL_COLORS[plan.tileColor]) ? plan.tileColor : 'natural';
// the tee grid's enamel (plan.gridColor): white is standard
const GRID_COLORS = { white: ['White', 0xdfe3e5], black: ['Black', 0x26292c], alum: ['Aluminum', 0xb4babe] };
const gridColorOf = (plan) => (plan && GRID_COLORS[plan.gridColor]) ? plan.gridColor : 'white';
const tileName = (plan) => tileTypeOf(plan) === 'alum' ? 'aluminum' + (tileColorOf(plan) !== 'natural' ? ', painted ' + PANEL_COLORS[tileColorOf(plan)][0].toLowerCase() : '') : 'vinyl-covered gypsum';
const PANEL_COLORS = { white: ['White', '#f7f8f8'], ltgray: ['Light gray', '#d6dadd'], gray: ['Gray', '#8f979c'], black: ['Black', '#25282c'], pink: ['Pink', '#f3a3c4'], red: ['Red', '#d33f3f'], orange: ['Orange', '#f28a2a'], yellow: ['Yellow', '#f4cf3f'], green: ['Green', '#4caa5a'], blue: ['Blue', '#3b7bd0'], ltblue: ['Light blue', '#9ccaf0'], purple: ['Purple', '#8858c4'] };
const panelColorOf = (plan, w) => { const k = (w && w.color && PANEL_COLORS[w.color]) ? w.color : (plan && PANEL_COLORS[plan.panelColor]) ? plan.panelColor : 'white'; return k; };
const FINISH = {
  siding: { lap: 'Lap siding', board: 'Board and batten', shake: 'Cedar shake', brick: 'Brick', stone: 'Stone veneer', stucco: 'Stucco' },
  sidingColor: { white: ['White', '#eceeec'], gray: ['Gray', '#b9bfc0'], greige: ['Greige', '#cbbfae'], sage: ['Sage', '#9fae98'], navy: ['Navy', '#3f4e66'], charcoal: ['Charcoal', '#4a4f55'], red: ['Barn red', '#8a3b32'], natural: ['Natural (brick / stone / cedar)', ''] },
  roof: { shingle: 'Architectural shingles', metal: 'Standing-seam metal', tile: 'Clay tile', slate: 'Slate' },
  roofColor: { charcoal: ['Charcoal', '#4b4e52'], brown: ['Weathered brown', '#5e4a3c'], gray: ['Pewter gray', '#7a7f84'], black: ['Black', '#2a2c2f'], green: ['Forest green', '#3d5446'], red: ['Terracotta', '#a25a3c'] },
  paint: { white: ['Bright white', '#f4f2ee'], warm: ['Warm white', '#efe8dc'], greige: ['Greige', '#ddd4c6'], gray: ['Light gray', '#dcdedd'], blue: ['Soft blue', '#d4dee4'], sage: ['Sage', '#d6dccf'] },
  cabinet: { white: ['White shaker', '#f3f1ec'], gray: ['Gray shaker', '#a7adb0'], navy: ['Navy', '#2f3d55'], green: ['Sage green', '#8c9a84'], oak: ['Natural oak', '#c49a6c'], walnut: ['Walnut', '#6b4a33'], black: ['Matte black', '#2b2d30'] },
  counter: { quartz: ['White quartz', '#eceae5'], marble: ['Marble', '#e6e4df'], granite: ['Black granite', '#2f3236'], concrete: ['Concrete', '#a9a7a2'], butcher: ['Butcher block', '#b98a57'] }
};
const finishOf = (plan) => Object.assign({ siding: 'lap', sidingColor: 'gray', roof: 'shingle', roofColor: 'charcoal', paint: 'warm', cabinet: 'white', counter: 'quartz' }, (plan && plan.finish) || {});
/* an item's footprint corners on the plan (a = angle of its width axis; the back is at -d/2) */
function itemCorners(it) {
  const D = ITEMS[it.type] || { w: 2, d: 2 }, w = it.w || D.w, d = it.d || D.d, a = it.a || 0, c = Math.cos(a), sn = Math.sin(a);
  const P = (u, v) => [it.x + c * u - sn * v, it.y + sn * u + c * v];
  return [P(-w / 2, -d / 2), P(w / 2, -d / 2), P(w / 2, d / 2), P(-w / 2, d / 2)];
}
/* floor finishes for houses (cleanrooms get the gray epoxy floor) */
const FLOORS = { lvp: 'Luxury vinyl plank', hardwood: 'Hardwood', whiteoak: 'White oak', herringbone: 'Herringbone oak', carpet: 'Carpet', tile: 'Ceramic tile', marble: 'Marble tile', slate: 'Slate tile', concrete: 'Sealed concrete' };
const shellHeight = (plan, w) => Math.max(6, (w && w.h) || (plan && plan.shellH) || 20);

/* ---------- Buildings placed in a plan ----------
   plan.inserts = [{ id, name, libId, libSaved, x, y, rot (quarter turns, clockwise on the sheet), mirror, plan }].
   ins.plan is a full copy of the saved building, centred on (0, 0); it never changes unless you update it.
   A transform is { a, b, c, d, tx, ty }: world = (a·x + b·y + tx, c·x + d·y + ty). */
function insertXform(ins) {
  let a = ins.mirror ? -1 : 1, b = 0, c = 0, d = 1;
  for (let k = 0; k < (((ins.rot || 0) % 4) + 4) % 4; k++) { const na = -c, nb = -d, nc = a, nd = b; a = na; b = nb; c = nc; d = nd; }
  return { a, b, c, d, tx: ins.x || 0, ty: ins.y || 0 };
}
function composeXform(P, C) {
  return { a: P.a * C.a + P.b * C.c, b: P.a * C.b + P.b * C.d, c: P.c * C.a + P.d * C.c, d: P.c * C.b + P.d * C.d, tx: P.a * C.tx + P.b * C.ty + P.tx, ty: P.c * C.tx + P.d * C.ty + P.ty };
}
const FACE = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
/* A copy of a building's plan moved, turned and mirrored into place (inserts inside it are left out). */
/* ---------- Electrical and utility devices on wall faces ----------
   Each device: { id, type, x, y (plan feet, on the wall face), a (radians, the way it faces), h (feet,
   center above the floor) }. w × hh is the cover plate (feet); ifc is how it goes to Revit. */
const DEVICES = {
  outlet: { label: 'Receptacle, duplex 20A', short: 'R', group: 'Power', h: 1.5, w: 2.75 / 12, hh: 4.5 / 12, ifc: ['IFCOUTLET', '.POWEROUTLET.'] },
  gfci: { label: 'Receptacle, GFCI 20A', short: 'GFI', group: 'Power', h: 1.5, w: 2.75 / 12, hh: 4.5 / 12, ifc: ['IFCOUTLET', '.POWEROUTLET.'] },
  dedicated: { label: 'Receptacle, dedicated (equipment)', short: 'DR', group: 'Power', h: 1.5, w: 2.75 / 12, hh: 4.5 / 12, ifc: ['IFCOUTLET', '.POWEROUTLET.'] },
  r208: { label: 'Receptacle, 208V 30A', short: '208', group: 'Power', h: 1.5, w: 4.5 / 12, hh: 4.5 / 12, ifc: ['IFCOUTLET', '.POWEROUTLET.'] },
  jbox: { label: 'Junction box (equipment hookup)', short: 'J', group: 'Power', h: 1.5, w: 4 / 12, hh: 4 / 12, ifc: ['IFCJUNCTIONBOX', '.POWER.'] },
  switch: { label: 'Light switch', short: 'S', group: 'Controls', h: 4, w: 2.75 / 12, hh: 4.5 / 12, ifc: ['IFCSWITCHINGDEVICE', '.TOGGLESWITCH.'] },
  ffuctl: { label: 'FFU speed controller', short: 'FC', group: 'Controls', h: 4.5, w: 4.5 / 12, hh: 4.5 / 12, ifc: ['IFCSWITCHINGDEVICE', '.SELECTORSWITCH.'] },
  interlock: { label: 'Door interlock controller (airlock)', short: 'IL', group: 'Controls', h: 5, w: 6 / 12, hh: 8 / 12, ifc: ['IFCCONTROLLER', '.PROGRAMMABLE.'] },
  monitor: { label: 'Room pressure monitor', short: 'PM', group: 'Controls', h: 5, w: 6 / 12, hh: 4.5 / 12, ifc: ['IFCSENSOR', '.PRESSURESENSOR.'] },
  data: { label: 'Data jack', short: 'D', group: 'Data', h: 1.5, w: 2.75 / 12, hh: 4.5 / 12, ifc: ['IFCOUTLET', '.DATAOUTLET.'] },
  panel: { label: 'Electrical panel', short: 'EP', group: 'Power', h: 5, w: 20 / 12, hh: 40 / 12, d: 4 / 12, ifc: ['IFCELECTRICDISTRIBUTIONBOARD', '.DISTRIBUTIONBOARD.'] }
};
/* Which lights a switch works: dv.lights holds light keys, the fixture's id, or 'at:x,y' for a light from the
   automatic ceiling layout (those have no id; they always land in the same places). */
const lightKey = (f) => f.id ? String(f.id) : 'at:' + (+f.x).toFixed(1) + ',' + (+f.y).toFixed(1);
function transformPlan(src, T, idp) {
  const P = JSON.parse(JSON.stringify(src)), X = (x, y) => [T.a * x + T.b * y + T.tx, T.c * x + T.d * y + T.ty];
  const flip = T.a * T.d - T.b * T.c < 0, turned = Math.abs(T.a) < 0.5, pre = idp ? idp + ':' : '';
  delete P.inserts; delete P.background;
  for (const w of P.walls || []) { [w.x1, w.y1] = X(w.x1, w.y1); [w.x2, w.y2] = X(w.x2, w.y2); if (w.id) w.id = pre + w.id; }
  for (const o of P.openings || []) { [o.x1, o.y1] = X(o.x1, o.y1); [o.x2, o.y2] = X(o.x2, o.y2); if (flip) o.swing = o.swing === -1 ? 1 : -1; if (o.id) o.id = pre + o.id; if (o.unit) o.unit = pre + o.unit; }
  for (const k of P.chases || []) {
    const [ax, ay] = X(k.x0, k.y0), [bx, by] = X(k.x1, k.y1);
    k.x0 = Math.min(ax, bx); k.x1 = Math.max(ax, bx); k.y0 = Math.min(ay, by); k.y1 = Math.max(ay, by);
    if (k.grille && FACE[k.grille]) { const [fx, fy] = FACE[k.grille], nx = T.a * fx + T.b * fy, ny = T.c * fx + T.d * fy; k.grille = Math.abs(nx) > Math.abs(ny) ? (nx > 0 ? 'E' : 'W') : (ny > 0 ? 'S' : 'N'); }
    if (k.id) k.id = pre + k.id;
  }
  for (const r of P.rooms || []) { [r.x, r.y] = X(r.x, r.y); if (r.id) r.id = pre + r.id; }
  // things facing a way (devices, house items) turn with the building
  const turnA = (a) => { const cx = Math.cos(a || 0), sy = Math.sin(a || 0); return Math.atan2(T.c * cx + T.d * sy, T.a * cx + T.b * sy); };
  for (const dv of P.devices || []) {
    [dv.x, dv.y] = X(dv.x, dv.y); dv.a = turnA(dv.a); if (dv.id) dv.id = pre + dv.id;
    if (Array.isArray(dv.lights)) dv.lights = dv.lights.map(k => { const m = /^at:(-?[\d.]+),(-?[\d.]+)$/.exec(k); return m ? lightKey({ x: X(+m[1], +m[2])[0], y: X(+m[1], +m[2])[1] }) : pre + k; });
  }
  for (const c of P.columns || []) { [c.x, c.y] = X(c.x, c.y); if (c.id) c.id = pre + c.id; }
  for (const b of P.beams || []) { [b.x1, b.y1] = X(b.x1, b.y1); [b.x2, b.y2] = X(b.x2, b.y2); if (b.id) b.id = pre + b.id; }
  for (const k of P.ceilAreas || []) { const [ax, ay] = X(k.x0, k.y0), [bx, by] = X(k.x1, k.y1); k.x0 = Math.min(ax, bx); k.x1 = Math.max(ax, bx); k.y0 = Math.min(ay, by); k.y1 = Math.max(ay, by); if (k.id) k.id = pre + k.id; }
  for (const it of P.items || []) { [it.x, it.y] = X(it.x, it.y); it.a = turnA(it.a); if (it.id) it.id = pre + it.id; }
  for (const f of P.fixtures || []) { [f.x, f.y] = X(f.x, f.y); if (turned) { const w = f.w || 2, h = f.h || 4; f.w = h; f.h = w; } if (f.id) f.id = pre + f.id; }
  if (P.ceilGrid && isFinite(P.ceilGrid.ox)) { const [gx, gy] = X(P.ceilGrid.ox, P.ceilGrid.oy); P.ceilGrid = { ox: gx, oy: gy, swap: !!P.ceilGrid.swap !== turned }; }
  else if (turned) P.ceilGrid = null, P.ceilSwap = !P.ceilSwap;
  if (Array.isArray(P.ceilingGrid)) P.ceilingGrid = P.ceilingGrid.map(q => [...X(q[0], q[1]), ...X(q[2], q[3])]);
  for (const d of P.deckPieces || []) { d.outer = d.outer.map(q => X(q[0], q[1])); d.holes = (d.holes || []).map(h => h.map(q => X(q[0], q[1]))); if (d.id) d.id = pre + d.id; }
  for (const t of P.ceilTiles || []) { [t.x, t.y] = X(t.x, t.y); if (turned) { const w = t.w; t.w = t.h; t.h = w; } if (t.id) t.id = pre + t.id; }
  if (P.ceilingImage) { const I = P.ceilingImage; [I.x, I.y] = X(I.x, I.y); I.rot = ((I.rot || 0) + (turned ? (T.c > 0 ? 90 : 270) : (T.a < 0 && T.d < 0 ? 180 : 0))) % 360; }
  return P;
}
/* One building with rooms at different ceiling heights: each room can carry its own ceiling and plenum
   (room.ceiling / room.plenum, feet; unset = the building's). The building is split into one area per
   height, each drawn, quoted and exported like its own building: a wall goes with the tallest room it
   bounds, so a wall between a tall room and a low one runs up to the tall room's top. Where a low area
   opens into a tall one, transition panels fill the step (as between placed buildings). */
const roomKey = (P, r) => { const H = Math.max(6, r && r.ceiling > 0 ? r.ceiling : (P.ceiling || 8)), PL = Math.max(0, Math.min(20, r && r.plenum != null && r.plenum !== '' ? +r.plenum : (+P.plenum || 0))); return { H, PL, key: H.toFixed(3) + '|' + PL.toFixed(3) }; };
function splitByCeiling(P) {
  const rooms = P.rooms || [], def = roomKey(P, null);
  if (!rooms.some(r => r && (r.ceiling > 0 || (r.plenum != null && r.plenum !== '')) && roomKey(P, r).key !== def.key)) return null;
  const A0 = analyze(P); if (A0.empty) return null;
  const R = roomRegions(A0, P, true), G = R.grid; if (!G) return null;
  const keyOfComp = R.map(q => roomKey(P, q.room));
  const fpAll = footprint(A0, true);
  const at = (x, z) => {
    const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((z - G.z0) / G.cell);
    if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) return null;
    const k = j * G.nx + i;
    if (G.comp[k] >= 0) return keyOfComp[G.comp[k]];
    return G.inside[k] && !G.wall[k] ? def : null;
  };
  const groups = new Map([[def.key, Object.assign({ walls: [], ghost: [], openings: [], chases: [], rooms: [], fixtures: [], devices: [], items: [], columns: [], beams: [], ceilAreas: [] }, def)]]);
  const grp = (k) => { if (!groups.has(k.key)) groups.set(k.key, Object.assign({ walls: [], ghost: [], openings: [], chases: [], rooms: [], fixtures: [], devices: [], items: [], columns: [], beams: [], ceilAreas: [] }, k)); return groups.get(k.key); };
  const top = (k) => k.H + k.PL;
  const wallOf = new Map();
  for (const w of P.walls || []) {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 0.01) continue;
    const nx = -(w.y2 - w.y1) / L, nz = (w.x2 - w.x1) / L, t = w.t || 0.25, seen = new Map();
    for (const f of [0.15, 0.5, 0.85]) for (const sd of [1, -1]) for (const off of [t / 2 + 0.4, t / 2 + 1.0]) {
      const k = at(w.x1 + (w.x2 - w.x1) * f + nx * sd * off, w.y1 + (w.y2 - w.y1) * f + nz * sd * off);
      if (k) { seen.set(k.key, k); break; }
    }
    const sides = [...seen.values()];
    const own = sides.length ? sides.reduce((a, b) => (top(b) > top(a) + 1e-6 ? b : a)) : def;
    grp(own).walls.push(w); wallOf.set(w, own.key);
    for (const k of sides) if (k.key !== own.key) grp(k).ghost.push(w);
  }
  for (const o of P.openings || []) {
    let best = null, bd = 1e9;
    for (const w of P.walls || []) { const d = segDist((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, w.x1, w.y1, w.x2, w.y2); if (d < bd) { bd = d; best = w; } }
    groups.get(best && wallOf.has(best) ? wallOf.get(best) : def.key).openings.push(o);
  }
  for (const c of P.chases || []) grp(at((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2) || def).chases.push(c);
  for (const r of rooms) grp(roomKey(P, r)).rooms.push(r);
  for (const f of P.fixtures || []) grp(at(f.x, f.y) || def).fixtures.push(f);
  for (const dv of P.devices || []) { const back = at(dv.x + Math.cos(dv.a || 0) * 0.6, dv.y + Math.sin(dv.a || 0) * 0.6); grp(back || def).devices.push(dv); }
  for (const it of P.items || []) grp(at(it.x, it.y) || def).items.push(it);
  for (const c of P.columns || []) groups.get(def.key).columns.push(c);
  for (const b of P.beams || []) groups.get(def.key).beams.push(b);
  for (const k of P.ceilAreas || []) grp(at((k.x0 + k.x1) / 2, (k.y0 + k.y1) / 2) || def).ceilAreas.push(k);
  // every area keeps the building's one ceiling grid, so tees line up across the areas
  const cg = P.ceilGrid && isFinite(P.ceilGrid.ox) ? P.ceilGrid : (() => { const g = ceilingGrid(P, A0); return { ox: g.ox, oy: g.oz, swap: g.swap }; })();
  const out = [];
  for (const g of groups.values()) {
    if (!g.walls.length && !g.rooms.length) continue;
    const q = Object.assign({}, P, { inserts: undefined, walls: g.walls, openings: g.openings, chases: g.chases, rooms: g.rooms, fixtures: g.fixtures, devices: g.devices, items: g.items, columns: g.columns, beams: g.beams, ceilAreas: g.ceilAreas, ceiling: g.H, plenum: g.PL, ceilGrid: cg });
    Object.defineProperty(q, '__ghost', { value: g.ghost, enumerable: false, configurable: true });
    out.push({ plan: q, H: g.H, PL: g.PL, def: g.key === def.key });
  }
  out.sort((a, b) => (b.def ? 1 : 0) - (a.def ? 1 : 0));
  return out.length > 1 ? out : null;
}
/* Every building in a plan, each in plan coordinates: the main plan first, then the placed buildings
   (and buildings placed inside those). Each zone is drawn, quoted and exported as its own building. */
function zones(plan, T, idp, out) {
  out = out || [];
  T = T || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  const own = idp ? transformPlan(plan, T, idp) : Object.assign({}, plan, { inserts: undefined });
  const nm = plan.name || (idp ? 'Building' : 'Main building'), parts = splitByCeiling(own);
  if (!parts) out.push({ id: idp || null, name: nm, plan: own, main: !idp });
  // one building with several ceiling heights: one area per height, all part of this building
  else parts.forEach((q, k) => out.push({ id: k ? (idp || '') + '#' + k : idp || null, name: nm, plan: q.plan, main: !idp && k === 0, area: k ? fmtFt(q.H) + ' ceiling' : null, virtual: k > 0, of: idp || null }));
  for (const ins of plan.inserts || []) {
    if (!ins || !ins.plan) continue;
    const C = composeXform(T, insertXform(ins)), sub = Object.assign({}, ins.plan, { name: ins.name || ins.plan.name });
    zones(sub, C, (idp ? idp + '/' : '') + ins.id, out);
  }
  // each building knows the walls of the buildings around it (where one carries on into another)
  // (each sibling wall carries __top: how high it stands, so a taller building can fill the step above a lower one)
  const topOf = (q, w) => { const H = Math.max(6, q.plan.ceiling || 8), PL = Math.max(0, Math.min(20, +q.plan.plenum || 0)); return isHard(w) ? H + PL : isFrame(w) ? Math.max(6, w.h || H) : shellHeight(q.plan, w); };
  if (!idp) for (const z of out) Object.defineProperty(z.plan, '__sib', { value: [].concat(...out.filter(q => q !== z).map(q => (q.plan.walls || []).map(w => Object.assign({}, w, { __top: topOf(q, w), __ceil: Math.max(6, q.plan.ceiling || 8), __hard: isHard(w) })))), enumerable: false, configurable: true });
  return out;
}
/* One flat plan with every building merged in (for 2D drawings: DWG/DXF and the plan sheet). */
function flatten(plan) {
  const Z = zones(plan), F = Object.assign({}, Z[0].plan, { inserts: [] }); delete F.__sib;
  for (const k of ['walls', 'openings', 'chases', 'rooms', 'devices', 'items', 'columns', 'beams', 'ceilAreas']) F[k] = [].concat(...Z.map(z => z.plan[k] || []));
  // each building's own lights and FFUs, already laid out on its own grid
  F.fixtures = [].concat(...Z.map(z => ceilingFixtures(z.plan))); F.ceilingMode = 'manual'; F.fixturesFinal = true;
  return F;
}
/* World-space box of a placed building. */
function insertBox(ins) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const z of zones({ walls: [], inserts: [ins] }).slice(1)) {
    const P = z.plan, e = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    (P.walls || []).forEach(w => { const h = (w.t || 0.25) / 2; e(w.x1 - h, w.y1 - h); e(w.x2 + h, w.y2 + h); e(w.x1 + h, w.y1 + h); e(w.x2 - h, w.y2 - h); });
    (P.chases || []).forEach(k => { e(k.x0, k.y0); e(k.x1, k.y1); });
  }
  if (x0 > x1) { x0 = (ins.x || 0) - 2; x1 = (ins.x || 0) + 2; y0 = (ins.y || 0) - 2; y1 = (ins.y || 0) + 2; }
  return { x0, y0, x1, y1 };
}
/* A building ready for the library: centred on (0, 0), no background image. */
function centredCopy(plan) {
  const P = JSON.parse(JSON.stringify(plan)); delete P.background;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const e = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  (P.walls || []).forEach(w => { e(w.x1, w.y1); e(w.x2, w.y2); }); (P.chases || []).forEach(k => { e(k.x0, k.y0); e(k.x1, k.y1); });
  (P.inserts || []).forEach(i => { const b = insertBox(i); e(b.x0, b.y0); e(b.x1, b.y1); });
  if (x0 > x1) return P;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return transformPlanKeepInserts(P, { a: 1, b: 0, c: 0, d: 1, tx: -cx, ty: -cy });
}
function transformPlanKeepInserts(P, T) {
  const ins = (P.inserts || []).map(i => Object.assign({}, i, { x: (i.x || 0) + T.tx, y: (i.y || 0) + T.ty }));
  const out = transformPlan(P, T, ''); out.inserts = ins; return out;
}

/* A door built like the standard cleanroom door drawings (o.style === 'cr'): leaves o.leafW wide (36″ to
   start) and 84″ tall, a pair meeting in the middle with no post between them, the frame (jambs and posts) taking up
   the rest of the opening, the head at 86″ with the header panel above. Vision glass 24″ × 34″ in a 26″ × 36″
   frame, centred on the leaf, its bottom 41¾″ up; lever 38″ up. */
function doorSpec(o, len) {
  if (!o || o.style !== 'cr' || (o.type !== 'door' && o.type !== 'door2')) return null;
  // a pair has no post between the leaves: the frame keeps its jambs and the two leaves meet in the middle,
  // sharing the space a meeting strip used to take (7½″, 3¾″ more on each leaf)
  const n = o.type === 'door2' ? 2 : 1, gap = n === 2 ? 7.5 / 12 : 0, mull = 0;
  let leafW = o.leafW > 0 ? +o.leafW : 3, jamb = (len - n * leafW - gap) / 2;
  if (jamb < 1.5 / 12) jamb = 1.5 / 12;
  leafW = (len - 2 * jamb) / n;
  return { n, leafW, jamb, mull, leafH: 7, head: 86 / 12, vis: { w: 26 / 12, h: 36.12 / 12, y0: 41.75 / 12 }, lever: 38 / 12 };
}
/* A removable wall section (o.type === 'removable'): wall panels that come out to bring equipment through,
   held in a frame like a door frame. Across the wall: 3″ × 3″ steel tube post | white wall start | removable panel |
   H-stud with insert | removable panel | … | white start | metal tube post. The posts run from the floor up to
   the lid (top); a metal header tube runs across under the header panels, with a white start under it; the
   header panels over it are split by H-studs lined up with the ones below. All flush with the wall faces.
   Measured along the section from its start (s, ft) and up from the floor (y, ft): the 3D view, the parts
   list and the fabrication sheets all use this one layout. */
const REM = { tube: 3 / 12, start: 1 / 12, stud: 3 / 12 };
function removableLayout(len, head, top) {
  const TW = REM.tube, ST = REM.start, SW = REM.stud;
  const hd = Math.max(TW + ST + 1, Math.min(head || 8, top || 99)), wt = Math.max(hd, top || hd);
  const a0 = TW + ST, a1 = len - TW - ST, py = hd - TW - ST, n = Math.max(1, Math.round((a1 - a0) / 4)), pw = (a1 - a0 - (n - 1) * SW) / n;
  const panels = [], studs = [], headers = [], hstuds = [];
  for (let k = 0; k < n; k++) {
    const s0 = a0 + k * (pw + SW); panels.push({ s0, s1: s0 + pw, y0: 0, y1: py });
    if (k < n - 1) { studs.push({ s0: s0 + pw, s1: s0 + pw + SW, y0: 0, y1: py }); if (wt - hd > 0.05) hstuds.push({ s0: s0 + pw, s1: s0 + pw + SW, y0: hd, y1: wt }); }
  }
  if (wt - hd > 0.05) { let x = TW; for (const q of hstuds) { headers.push({ s0: x, s1: q.s0, y0: hd, y1: wt }); x = q.s1; } headers.push({ s0: x, s1: len - TW, y0: hd, y1: wt }); }
  return {
    len, head: hd, top: wt, n, panelW: pw, panelH: py, panels, studs, headers, hstuds,
    posts: [{ s0: 0, s1: TW, y0: 0, y1: wt }, { s0: len - TW, s1: len, y0: 0, y1: wt }],
    headerTube: { s0: TW, s1: len - TW, y0: hd - TW, y1: hd },
    starts: [{ s0: TW, s1: TW + ST, y0: 0, y1: hd - TW }, { s0: len - TW - ST, s1: len - TW, y0: 0, y1: hd - TW }, { s0: TW + ST, s1: len - TW - ST, y0: py, y1: hd - TW }],
    startFt: 2 * (hd - TW) + (len - 2 * TW - 2 * ST)
  };
}
// the layout of the removable section an analyzed opening is (i from analyze(plan).opInfo), with its header
// at the opening's head, held under the ceiling there, and its posts up to the top of the wall there
function removableOf(plan, A, i) {
  const o = i.o, ceilHere = i.hard ? wallCeil(plan, A, { x1: o.x1, z1: o.y1, x2: o.x2, z2: o.y2, t: i.t }) : A.H;
  const head = Math.min(i.hard ? Math.min(ceilHere, i.wallH || ceilHere) : (i.wallH || A.H), o.head || 7);
  return removableLayout(i.len, head, i.wallH || A.H);
}
/* ---------- Pure geometry analysis (no three.js) ---------- */
function leavesFor(i) {
  const o = i.o, sw = o.swing === -1 ? -1 : 1, nx = -i.uz, nz = i.ux, out = [];
  const S = doorSpec(o, i.len);
  if (S) {
    // leaves inside the frame: one from the first jamb, a pair from both jambs toward the meeting strip
    const leaf = (bx, bz, dir) => { const sx = bx + nx * sw * (i.t / 2 + 0.07), sz = bz + nz * sw * (i.t / 2 + 0.07); out.push({ x1: sx, z1: sz, x2: sx + i.ux * dir * S.leafW, z2: sz + i.uz * dir * S.leafW, w: S.leafW, leafSw: sw, tx: nx * sw, tz: nz * sw }); };
    leaf(o.x1 + i.ux * S.jamb, o.y1 + i.uz * S.jamb, 1);
    if (S.n === 2) leaf(o.x2 - i.ux * S.jamb, o.y2 - i.uz * S.jamb, -1);
    return out;
  }
  if (o.type === 'door') {
    const w = Math.max(0.5, i.len - 0.22);
    const bx = o.x1 + i.ux * 0.1, bz = o.y1 + i.uz * 0.1;
    const sx = bx + nx * sw * (i.t / 2 + 0.07), sz = bz + nz * sw * (i.t / 2 + 0.07);
    out.push({ x1: sx, z1: sz, x2: sx + i.ux * w, z2: sz + i.uz * w, w, leafSw: sw, tx: nx * sw, tz: nz * sw });
  } else if (o.type === 'door2') {
    const halfW = Math.max(0.4, i.len / 2 - 0.14);
    const bx1 = o.x1 + i.ux * 0.1, bz1 = o.y1 + i.uz * 0.1;
    const sx1 = bx1 + nx * sw * (i.t / 2 + 0.07), sz1 = bz1 + nz * sw * (i.t / 2 + 0.07);
    out.push({ x1: sx1, z1: sz1, x2: sx1 + i.ux * halfW, z2: sz1 + i.uz * halfW, w: halfW, leafSw: sw, tx: nx * sw, tz: nz * sw });

    const bx2 = o.x2 - i.ux * 0.1, bz2 = o.y2 - i.uz * 0.1;
    const sx2 = bx2 + nx * sw * (i.t / 2 + 0.07), sz2 = bz2 + nz * sw * (i.t / 2 + 0.07);
    out.push({ x1: sx2, z1: sz2, x2: sx2 - i.ux * halfW, z2: sz2 - i.uz * halfW, w: halfW, leafSw: sw, tx: nx * sw, tz: nz * sw });
  }
  return out;
}

/* How tall a cleanroom wall is at an opening in it: as tall as the wall itself there, the same way the wall's
   pieces work it out (its own height sections, and any ceiling area raising the walls, whichever is higher),
   so the panel over a door carries the plenum on up to the top. */
function opTopFor(plan, host, o, t, WH, PL) {
  const mx = (o.x1 + o.x2) / 2, mz = (o.y1 + o.y2) / 2;
  let h = null;
  if (host) { const L = Math.hypot(host.x2 - host.x1, host.y2 - host.y1) || 1, s = (mx - host.x1) * (host.x2 - host.x1) / L + (mz - host.y1) * (host.y2 - host.y1) / L; const own = sectionTop(host, s, null); if (own != null) h = own; }
  for (const c of plan.ceilAreas || []) {
    if (!c || !c.raise || !(c.ceiling > 0)) continue;
    const m = (t || 0.25) / 2 + 0.3;
    if (mx >= Math.min(c.x0, c.x1) - m && mx <= Math.max(c.x0, c.x1) + m && mz >= Math.min(c.y0, c.y1) - m && mz <= Math.max(c.y0, c.y1) + m) h = Math.max(h == null ? 0 : h, Math.max(6, +c.ceiling) + PL);
  }
  return h == null ? WH : Math.max(1, h);
}
function analyze(plan) {
  const H = Math.max(6, plan.ceiling || 8);
  // plenum: the space above the grid ceiling (FFU housings, ducts, wiring). Hardwall walls run up through it
  // to the top (a lid) at H + plenum.
  const PL = Math.max(0, Math.min(20, +plan.plenum || 0)), WH = H + PL;
  const walls = (plan.walls || []).filter(w => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 0.01);
  const ops = plan.openings || [], chases = plan.chases || [];
  const pieces = [], ends = [];
  for (const w of walls) {
    const dx = w.x2 - w.x1, dz = w.y2 - w.y1, len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len, t = w.t || 0.25;
    const cuts = [];
    for (const o of ops) {
      const tol = t * 0.6 + 0.05;
      const perp = (x, y) => Math.abs((x - w.x1) * (-uz) + (y - w.y1) * ux);
      if (perp(o.x1, o.y1) > tol || perp(o.x2, o.y2) > tol) continue;
      const s1 = (o.x1 - w.x1) * ux + (o.y1 - w.y1) * uz, s2 = (o.x2 - w.x1) * ux + (o.y2 - w.y1) * uz;
      const a = Math.max(0, Math.min(s1, s2)), b = Math.min(len, Math.max(s1, s2));
      if (b - a > 0.02) cuts.push([a, b]);
    }
    cuts.sort((p, q) => p[0] - q[0]);
    let c = 0; const segs = [];
    for (const [a, b] of cuts) { if (a > c + 0.004) segs.push([c, a]); c = Math.max(c, b); }
    if (len > c + 0.004) segs.push([c, len]);
    const hard = isHard(w), frame = isFrame(w), kind = hard ? 'hardwall' : w.kind, wh = hard ? WH : frame ? Math.max(6, w.h || H) : shellHeight(plan, w);
    // height sections: the wall's own, plus where it runs through a ceiling area set to raise the walls
    // (a taller section of a room): there it goes up to that area's ceiling and plenum
    let secs = hard && Array.isArray(w.sections) && w.sections.length ? w.sections.slice() : null;
    if (hard) for (const c of plan.ceilAreas || []) {
      if (!c || !c.raise || !(c.ceiling > 0)) continue;
      const bx0 = Math.min(c.x0, c.x1) - t / 2 - 0.3, bx1 = Math.max(c.x0, c.x1) + t / 2 + 0.3, bz0 = Math.min(c.y0, c.y1) - t / 2 - 0.3, bz1 = Math.max(c.y0, c.y1) + t / 2 + 0.3;
      // the part of the wall inside the area's box
      let t0 = 0, t1 = 1; const dx = w.x2 - w.x1, dz = w.y2 - w.y1, P = [-dx, dx, -dz, dz], Q = [w.x1 - bx0, bx1 - w.x1, w.y1 - bz0, bz1 - w.y1]; let ok = true;
      for (let k = 0; k < 4; k++) { if (Math.abs(P[k]) < 1e-12) { if (Q[k] < 0) ok = false; continue; } const r = Q[k] / P[k]; if (P[k] < 0) { if (r > t1) ok = false; else if (r > t0) t0 = r; } else { if (r < t0) ok = false; else if (r < t1) t1 = r; } }
      if (!ok || (t1 - t0) * len < 0.1) continue;
      (secs = secs || []).push({ a: t0 * len, b: t1 * len, h: Math.max(6, +c.ceiling) + PL });
    }
    const topAt = (s0, def) => { let h = null; for (const q of secs || []) if (q && q.h > 0 && s0 >= Math.min(q.a, q.b) - 1e-6 && s0 <= Math.max(q.a, q.b) + 1e-6) h = h === null ? +q.h : Math.max(h, +q.h); return h === null ? def : Math.max(1, h); };
    for (const [a0, b0] of segs) {
      // a hardwall with height sections is cut where its height changes
      const bk = [a0, b0]; if (secs) for (const q of secs) for (const v of [q.a, q.b]) if (v > a0 + 0.01 && v < b0 - 0.01) bk.push(+v);
      bk.sort((p, q) => p - q);
      for (let k = 0; k + 1 < bk.length; k++) {
        const a = bk[k], b = bk[k + 1]; if (b - a < 0.004) continue;
        pieces.push({ id: w.id, piece: w.piece || null, x1: w.x1 + ux * a, z1: w.y1 + uz * a, x2: w.x1 + ux * b, z2: w.y1 + uz * b, t, sp: !!w.sp && hard, s0: a, len: b - a, kind, hard, frame, ceilw: hard || frame, h: secs ? topAt((a + b) / 2, wh) : wh, ext: w.ext });
      }
    }
    ends.push({ x: w.x1, z: w.y1, t, ang: Math.atan2(-uz, ux), cut: cuts.some(k => k[0] < 0.01), w, h: hard ? topAt(0, wh) : wh });
    ends.push({ x: w.x2, z: w.y2, t, ang: Math.atan2(-uz, ux), cut: cuts.some(k => k[1] > len - 0.01), w, h: hard ? topAt(len, wh) : wh });
  }
  // A wall end that meets another wall (a straight run drawn in pieces, or a tee) is a joint, not a free end:
  // it gets no end post, so runs don't sprout a post at every joint.
  // ghost: walls of the same building that belong to a taller ceiling area but bound this one (one building
  // with several ceiling heights): they close this area's ceiling and joints, but are drawn by the taller area
  const ghost = (plan.__ghost || []).filter(w => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 0.01);
  for (const e of ends) e.joined = !isHard(e.w) || walls.concat(ghost).some(o => o !== e.w && segDist(e.x, e.z, o.x1, o.y1, o.x2, o.y2) < Math.max(e.t, o.t || 0.25) / 2 + 0.06);
  const CORNER = 4 / 12, corners = [], nodes = [];
  for (const w of walls) for (const [x, y, st] of [[w.x1, w.y1, true], [w.x2, w.y2, false]]) {
    let n = nodes.find(n => Math.hypot(n.x - x, n.y - y) < 0.3);
    if (!n) { n = { x, y, ws: [] }; nodes.push(n); }
    if (!n.ws.includes(w)) n.ws.push(w);
  }
  for (const n of nodes) {
    if (n.ws.length !== 2) continue;
    const [a, b] = n.ws;
    if (!isHard(a) || !isHard(b)) continue;
    const ax = a.x2 - a.x1, ay = a.y2 - a.y1, bx = b.x2 - b.x1, by = b.y2 - b.y1, den = ax * by - ay * bx;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (Math.abs(den) / (la * lb) < 0.2) continue;
    if (walls.some(o => o !== a && o !== b && segDist(n.x, n.y, o.x1, o.y1, o.x2, o.y2) < (o.t || 0.25) / 2 + 0.06)) continue;
    const t = ((b.x1 - a.x1) * by - (b.y1 - a.y1) * bx) / den;
    const cx = a.x1 + ax * t, cz = a.y1 + ay * t;
    const away = (w) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); const fromStart = Math.hypot(w.x1 - cx, w.y1 - cz) < Math.hypot(w.x2 - cx, w.y2 - cz); return fromStart ? [(w.x2 - w.x1) / L, (w.y2 - w.y1) / L] : [(w.x1 - w.x2) / L, (w.y1 - w.y2) / L]; };
    const [dax, day] = away(a), [dbx, dby] = away(b);
    const S = Math.max(CORNER, a.t || 0.25, b.t || 0.25), wt = Math.max(a.t || 0.25, b.t || 0.25);
    const ox = cx - (dax + dbx) * wt / 2, oz = cz - (day + dby) * wt / 2;
    const endTop = (w) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); return sectionTop(w, Math.hypot(w.x1 - cx, w.y1 - cz) < Math.hypot(w.x2 - cx, w.y2 - cz) ? 0 : L, WH); };
    corners.push({ x: ox, z: oz, a: [dax, day], b: [dbx, dby], size: S, wt, ang: Math.atan2(-ay, ax), h: Math.max(endTop(a), endTop(b)) });
  }
  const opInfo = [];
  for (const o of ops) {
    const dx = o.x2 - o.x1, dz = o.y2 - o.y1, len = Math.hypot(dx, dz); if (len < 0.05) continue;
    let t = o.t, host = null, best = 1e9;
    // the wall it's in: the nearest one running the same way (a short cross wall nearby doesn't count)
    for (const w of walls) { const wl = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); let d = segDist((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, w.x1, w.y1, w.x2, w.y2); if (wl < 0.05 || Math.abs(dx * (w.y2 - w.y1) - dz * (w.x2 - w.x1)) / (len * wl) > 0.1) d += 10; if (d < best) { best = d; host = w; } }
    if (best > 1.5) host = null;
    if (!t) t = host && host.t ? host.t : 0.25;
    const opTop = (hh, oo, tt) => opTopFor(plan, hh, oo, tt, WH, PL);
    const hard = isHard(host), frame = isFrame(host), i = { host, o, len, ux: dx / len, uz: dz / len, t, hard, frame, ceilw: hard || frame, kind: hard ? 'hardwall' : host.kind, wallH: hard ? opTop(host, o, t) : frame ? Math.max(6, host.h || H) : shellHeight(plan, host) };
    i.leaves = leavesFor(i);
    opInfo.push(i);
  }
  let minX = 1e9, minZ = 1e9, maxX = -1e9, maxZ = -1e9;
  const ext = (x, z) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); };
  walls.forEach(w => { ext(w.x1, w.y1); ext(w.x2, w.y2); });
  chases.forEach(c => { ext(c.x0, c.y0); ext(c.x1, c.y1); });
  ops.forEach(o => { ext(o.x1, o.y1); ext(o.x2, o.y2); });
  const empty = minX > maxX;
  if (empty) { minX = 0; minZ = 0; maxX = 24; maxZ = 24; }
  const obs = [];
  pieces.forEach(p => obs.push({ x1: p.x1, z1: p.z1, x2: p.x2, z2: p.z2, r: p.t / 2 }));
  opInfo.forEach(i => {
    if (i.o.type === 'glass' || i.o.type === 'window') obs.push({ x1: i.o.x1, z1: i.o.y1, x2: i.o.x2, z2: i.o.y2, r: i.t / 2 });
    if (i.o.type === 'overhead') obs.push({ x1: i.o.x1, z1: i.o.y1, x2: i.o.x2, z2: i.o.y2, r: i.t / 2 });
    if (i.o.type === 'pass') obs.push({ x1: i.o.x1, z1: i.o.y1, x2: i.o.x2, z2: i.o.y2, r: Math.max(i.t, i.o.depth || 2) / 2 });
  });
  const boxes = chases.map(c => ({ x0: Math.min(c.x0, c.x1), x1: Math.max(c.x0, c.x1), z0: Math.min(c.y0, c.y1), z1: Math.max(c.y0, c.y1), grille: c.grille || '', c }));
  const hardAny = pieces.some(p => p.hard), frameAny = pieces.some(p => p.frame), shellTop = pieces.reduce((m, p) => p.hard || p.frame ? m : Math.max(m, p.h), 0);
  // building columns block walking
  for (const c of plan.columns || []) { const r = (c.size || 0.67) / 2; obs.push({ x1: c.x - r, z1: c.y, x2: c.x + r, z2: c.y, r }); }
  // house items block walking
  const items = (plan.items || []).filter(it => ITEMS[it.type]).map(it => ({ it, c: itemCorners(it) }));
  for (const q of items) for (let k = 0; k < 4; k++) { const a = q.c[k], b = q.c[(k + 1) % 4]; obs.push({ x1: a[0], z1: a[1], x2: b[0], z2: b[1], r: 0.05, item: true }); }
  // Transition panels: where this building's hardwall run has a gap that a lower building carries on through
  // (both gap ends meet its walls), the step between the lower building's top and this one's top is filled
  // with hardwall panels so the taller plenum stays closed.
  const transitions = [], SIB = plan.__sib || [];
  if (SIB.length && PL >= 0) {
    const HW = walls.filter(w => isHard(w) && Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 0.3);
    const topAt = (x, z) => { let t = -1; for (const w of SIB) if (w.__hard && (Math.hypot(w.x1 - x, w.y1 - z) < 0.6 || Math.hypot(w.x2 - x, w.y2 - z) < 0.6)) t = Math.max(t, w.__top); return t; };
    const ceilAt = (x, z) => { let c = -1; for (const w of SIB) if (w.__hard && (Math.hypot(w.x1 - x, w.y1 - z) < 0.6 || Math.hypot(w.x2 - x, w.y2 - z) < 0.6)) c = Math.max(c, w.__ceil || 0); return c; };
    for (let i = 0; i < HW.length; i++) for (let j = i + 1; j < HW.length; j++) {
      const a = HW[i], b = HW[j], la = Math.hypot(a.x2 - a.x1, a.y2 - a.y1), ux = (a.x2 - a.x1) / la, uz = (a.y2 - a.y1) / la;
      const lb = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
      if (Math.abs(ux * (b.y2 - b.y1) / lb - uz * (b.x2 - b.x1) / lb) > 0.01) continue;
      if (Math.abs((b.x1 - a.x1) * -uz + (b.y1 - a.y1) * ux) > 0.1) continue;
      let best = null, bd = 12;
      for (const [ex, ez] of [[a.x1, a.y1], [a.x2, a.y2]]) for (const [fx, fz] of [[b.x1, b.y1], [b.x2, b.y2]]) {
        const g = Math.hypot(fx - ex, fz - ez); if (g < 0.3 || g >= bd) continue;
        const mx = (ex + fx) / 2, mz = (ez + fz) / 2;
        if (segDist(mx, mz, a.x1, a.y1, a.x2, a.y2) < g / 2 - 0.05 || segDist(mx, mz, b.x1, b.y1, b.x2, b.y2) < g / 2 - 0.05) continue;
        const t1 = topAt(ex, ez), t2 = topAt(fx, fz); if (t1 < 0 || t2 < 0) continue;
        // an opening (door) already standing in the gap is not a gap
        if (ops.some(o => segDist((o.x1 + o.x2) / 2, (o.y1 + o.y2) / 2, ex, ez, fx, fz) < 0.3)) continue;
        // the panels hang from this area's top down to the lower area's ceiling (a bulkhead over the opening),
        // closing both the step between the two tops and the lower area's plenum where it opens into this one
        if (WH <= Math.max(t1, t2) + 0.05) continue;
        const c0 = Math.max(ceilAt(ex, ez), ceilAt(fx, fz));
        bd = g; best = { x1: ex, z1: ez, x2: fx, z2: fz, t: Math.max(a.t || 0.25, b.t || 0.25), y0: c0 > 0 ? Math.min(c0, H) : Math.max(t1, t2), y1: WH, hLow: c0 > 0 ? c0 : null, len: g };
      }
      if (best && best.y1 - best.y0 > 0.05 && !transitions.some(q => Math.hypot((q.x1 + q.x2 - best.x1 - best.x2) / 2, (q.z1 + q.z2 - best.z1 - best.z2) / 2) < 0.5 && Math.abs(q.len - best.len) < 0.5)) transitions.push(best);
    }
  }
  // steps: where a hardwall's height changes along its run, the taller part's exposed edge gets an end cap
  const steps = [];
  for (let k = 1; k < pieces.length; k++) {
    const p = pieces[k - 1], q = pieces[k];
    if (!p.hard || p.id !== q.id || Math.abs(p.s0 + p.len - q.s0) > 0.01 || Math.abs(p.h - q.h) < 0.02) continue;
    steps.push({ x: q.x1, z: q.z1, t: q.t, ang: Math.atan2(-(q.z2 - q.z1), q.x2 - q.x1), y0: Math.min(p.h, q.h), y1: Math.max(p.h, q.h) });
  }
  return { steps, sib: plan.__sib || [], ghost, transitions, H, PL, WH, hardAny, frameAny, ceilAny: hardAny || frameAny, house: frameAny && !hardAny, items, shellTop, walls, pieces, ends, corners, opInfo, boxes, obs, empty, bounds: { minX, minZ, maxX, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ } };
}

/* Return grille on an air chase: c.grW / c.grH (feet) and c.grSill (feet, floor to bottom of the grille),
   c.damper (opposed-blade damper behind it). Unset sizes keep the old look: the face less 3″ each side,
   18″ tall, 6″ off the floor. faceLen: length of the chase face the grille is on. */
function grilleSize(c, faceLen, H) {
  c = c || {}; H = H || 8;
  const w = Math.max(0.25, Math.min(Math.max(0.25, faceLen - 0.1), c.grW > 0 ? c.grW : faceLen - 0.5));
  const sill = Math.max(0, Math.min(H - 0.5, c.grSill != null ? c.grSill : 0.5));
  const h = Math.max(0.25, Math.min(H - 0.25 - sill, c.grH > 0 ? c.grH : 1.5));
  return { w, h, sill, damper: !!c.damper };
}

/* The inside of the walls, on a fine grid. By default only hardwall (cleanroom) walls count, since that's
   where the cleanroom ceiling goes; all = true counts building walls too (for the floor slab and roof). */
function footprint(A, all) {
  const KEY = all ? '__fpAll' : '__fp';
  if (A[KEY] !== undefined) return A[KEY];
  A[KEY] = null;
  if (A.empty) return null;
  if (!all && !A.ceilAny) return null;
  const use = (h) => all || h !== false;
  const B = A.bounds, R = 0.75;
  let cell = 0.25;
  const span = (B.w + 2 * R + 4) * (B.d + 2 * R + 4);
  while (span / (cell * cell) > 400000) cell *= 1.5;
  const x0 = B.minX - R - 2, z0 = B.minZ - R - 2, nx = Math.ceil((B.w + 2 * R + 4) / cell), nz = Math.ceil((B.d + 2 * R + 4) / cell), N = nx * nz;
  const wall = new Uint8Array(N);
  const stamp = (x1, z1, x2, z2, t) => {
    const r = Math.max(t / 2, cell * 0.75), L = Math.hypot(x2 - x1, z2 - z1);
    const i0 = Math.max(0, Math.floor((Math.min(x1, x2) - r - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((Math.max(x1, x2) + r - x0) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(z1, z2) - r - z0) / cell)), j1 = Math.min(nz - 1, Math.ceil((Math.max(z1, z2) + r - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = x0 + (i + 0.5) * cell, pz = z0 + (j + 0.5) * cell;
      let d;
      if (L < 1e-6) d = Math.hypot(px - x1, pz - z1);
      else { const u = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (pz - z1) * (z2 - z1)) / (L * L))); d = Math.hypot(px - x1 - u * (x2 - x1), pz - z1 - u * (z2 - z1)); }
      if (d <= r) wall[j * nx + i] = 1;
    }
  };
  for (const p of A.pieces) if (use(p.ceilw)) stamp(p.x1, p.z1, p.x2, p.z2, p.t);
  for (const g of A.ghost || []) stamp(g.x1, g.y1, g.x2, g.y2, g.t || 0.25);
  for (const i of A.opInfo) if (use(i.ceilw)) stamp(i.o.x1, i.o.y1, i.o.x2, i.o.y2, i.t);
  for (const b of A.boxes) { stamp(b.x0, b.z0, b.x1, b.z0, 0.1); stamp(b.x1, b.z0, b.x1, b.z1, 0.1); stamp(b.x1, b.z1, b.x0, b.z1, 0.1); stamp(b.x0, b.z1, b.x0, b.z0, 0.1); }
  const segD = (px, pz, w) => { const dx = w.x2 - w.x1, dz = w.y2 - w.y1, L2 = dx * dx + dz * dz || 1e-9, u = Math.max(0, Math.min(1, ((px - w.x1) * dx + (pz - w.y1) * dz) / L2)); return Math.hypot(px - w.x1 - u * dx, pz - w.y1 - u * dz); };
  const free = [];
  for (const w of A.walls) for (const [x, z] of [[w.x1, w.y1], [w.x2, w.y2]]) {
    if (!use(isHard(w) || isFrame(w))) continue;
    const t = w.t || 0.25;
    // an end that stops just short of another wall (a drafting gap of an inch or three) still meets it
    if (A.walls.some(o => o !== w && segD(x, z, o) < Math.max(Math.max(t, o.t || 0.25) * 0.8, (t + (o.t || 0.25)) / 2 + 0.02))) continue;
    // an end beside an opening is a door jamb (the opening closes it), unless the opening sits inside this
    // same wall: then the end is the wall's real end and still needs closing
    if (A.opInfo.some(i => {
      if (Math.min(Math.hypot(i.o.x1 - x, i.o.y1 - z), Math.hypot(i.o.x2 - x, i.o.y2 - z)) >= 0.3) return false;
      const mx = (i.o.x1 + i.o.x2) / 2, mz = (i.o.y1 + i.o.y2) / 2;
      return segD(mx, mz, w) > (w.t || 0.25) || !(((mx - w.x1) * (w.x2 - w.x1) + (mz - w.y1) * (w.y2 - w.y1)) > 0 && ((mx - w.x2) * (w.x1 - w.x2) + (mz - w.y2) * (w.y1 - w.y2)) > 0);
    })) continue;
    free.push({ x, z, w });
  }
  const crosses = (a, b) => A.walls.some(w => {
    if (w === a.w || w === b.w) return false;
    const d1x = b.x - a.x, d1z = b.z - a.z, d2x = w.x2 - w.x1, d2z = w.y2 - w.y1, den = d1x * d2z - d1z * d2x;
    if (Math.abs(den) < 1e-9) return false;
    const s1 = ((w.x1 - a.x) * d2z - (w.y1 - a.z) * d2x) / den, s2 = ((w.x1 - a.x) * d1z - (w.y1 - a.z) * d1x) / den;
    return s1 > 0.02 && s1 < 0.98 && s2 > 0 && s2 < 1;
  });
  const joined = new Set(), joins = []; // joins: the lines drawn to close open sides (the floor's edge there)
  free.forEach((a, ia) => {
    // an open side closes straight across: ends lined up along X or Y count as half as far, so they link to
    // each other before cutting diagonally to a nearer loose end (that cut left a V notch in the floor)
    let best = -1, bs = Infinity;
    free.forEach((b, ib) => { if (ib === ia || b.w === a.w) return; const d = Math.hypot(b.x - a.x, b.z - a.z), sc = Math.abs(b.x - a.x) < 0.1 || Math.abs(b.z - a.z) < 0.1 ? d * 0.5 : d; if (d > 0.3 && d < 16 && sc < bs && !crosses(a, b)) { bs = sc; best = ib; } });
    if (best < 0) return;
    const key = Math.min(ia, best) + '-' + Math.max(ia, best); if (joined.has(key)) return; joined.add(key);
    stamp(a.x, a.z, free[best].x, free[best].z, 0.05); joins.push([a.x, a.z, free[best].x, free[best].z, 0.05]);
  });
  // a gap up to 12′ between wall ends on the same straight line counts as closed only where a building placed
  // next to this one carries on through it (its walls meet both ends), so the ceiling and floor stay inside.
  // Gaps between buildings that lead outside (notches, open areas) stay open.
  const SIB = A.sib || [], meets = (x, z) => SIB.some(w => Math.hypot(w.x1 - x, w.y1 - z) < 0.6 || Math.hypot(w.x2 - x, w.y2 - z) < 0.6);
  const LW = SIB.length ? A.walls.filter(w => use(isHard(w) || isFrame(w)) && Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 0.3) : [];
  for (let i = 0; i < LW.length; i++) for (let j = i + 1; j < LW.length; j++) {
    const a = LW[i], b = LW[j], la = Math.hypot(a.x2 - a.x1, a.y2 - a.y1), ux = (a.x2 - a.x1) / la, uz = (a.y2 - a.y1) / la;
    const lb = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
    if (Math.abs(ux * (b.y2 - b.y1) / lb - uz * (b.x2 - b.x1) / lb) > 0.01) continue;
    if (Math.abs((b.x1 - a.x1) * -uz + (b.y1 - a.y1) * ux) > 0.1) continue;
    let best = null, bd = 12;
    for (const [ex, ez] of [[a.x1, a.y1], [a.x2, a.y2]]) for (const [fx, fz] of [[b.x1, b.y1], [b.x2, b.y2]]) {
      const g = Math.hypot(fx - ex, fz - ez); if (g < 0.3 || g >= bd) continue;
      const mx = (ex + fx) / 2, mz = (ez + fz) / 2;
      if (segD(mx, mz, a) < g / 2 - 0.05 || segD(mx, mz, b) < g / 2 - 0.05) continue; // overlapping, not a gap
      if (!meets(ex, ez) || !meets(fx, fz)) continue;
      bd = g; best = [ex, ez, fx, fz];
    }
    if (best) { stamp(best[0], best[1], best[2], best[3], 0.05); joins.push([best[0], best[1], best[2], best[3], 0.05]); }
  }
  const dist = (seed) => {
    const D = new Float32Array(N); for (let k = 0; k < N; k++) D[k] = seed[k] ? 0 : 1e9;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; let d = D[k];
      if (i > 0) d = Math.min(d, D[k - 1] + 1); if (j > 0) { d = Math.min(d, D[k - nx] + 1); if (i > 0) d = Math.min(d, D[k - nx - 1] + 1.4142); if (i < nx - 1) d = Math.min(d, D[k - nx + 1] + 1.4142); } D[k] = d; }
    for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) { const k = j * nx + i; let d = D[k];
      if (i < nx - 1) d = Math.min(d, D[k + 1] + 1); if (j < nz - 1) { d = Math.min(d, D[k + nx] + 1); if (i < nx - 1) d = Math.min(d, D[k + nx + 1] + 1.4142); if (i > 0) d = Math.min(d, D[k + nx - 1] + 1.4142); } D[k] = d; }
    return D;
  };
  const rc = R / cell;
  const Dw = dist(wall);
  const out = new Uint8Array(N), stack = [];
  const push = (k) => { if (!out[k] && Dw[k] > rc) { out[k] = 1; stack.push(k); } };
  for (let i = 0; i < nx; i++) { push(i); push((nz - 1) * nx + i); }
  for (let j = 0; j < nz; j++) { push(j * nx); push(j * nx + nx - 1); }
  while (stack.length) { const k = stack.pop(), i = k % nx, j = (k - i) / nx; if (i > 0) push(k - 1); if (i < nx - 1) push(k + 1); if (j > 0) push(k - nx); if (j < nz - 1) push(k + nx); }
  // the outside reaches on, a short way, into the pockets it couldn't get into above (the inside corner of an
  // L-shaped outline, round a wall's end): any cell it gets to without crossing a wall is outside too, so the
  // floor and ceiling don't bulge out into those pockets
  const near = new Uint8Array(N), q2 = [];
  for (let k = 0; k < N; k++) if (out[k]) { near[k] = 1; q2.push(k, 0); }
  const LIM = Math.ceil(rc) + 2;
  for (let h = 0; h < q2.length; h += 2) {
    const k = q2[h], st = q2[h + 1]; if (st >= LIM) continue;
    const i = k % nx;
    for (const m of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k >= nx ? k - nx : -1, k + nx < N ? k + nx : -1]) if (m >= 0 && !near[m] && !wall[m] && Dw[m] >= 1) { near[m] = 1; q2.push(m, st + 1); }
  }
  const Do = dist(out), inside = new Uint8Array(N);
  let n = 0;
  for (let k = 0; k < N; k++) if (wall[k] || (Do[k] > rc + 0.5 && !near[k])) { inside[k] = 1; n++; }
  if (n < 4) return null;
  const rects = [], open = new Map();
  for (let j = 0; j <= nz; j++) {
    const runs = [];
    if (j < nz) { let i = 0; while (i < nx) { if (!inside[j * nx + i]) { i++; continue; } const a = i; while (i < nx && inside[j * nx + i]) i++; runs.push(a + ',' + i); } }
    const now = new Set(runs);
    for (const [key, r] of open) if (!now.has(key)) { rects.push(r); open.delete(key); }
    for (const key of runs) {
      if (open.has(key)) open.get(key)[3] = z0 + (j + 1) * cell;
      else { const [a, b] = key.split(',').map(Number); open.set(key, [x0 + a * cell, z0 + j * cell, x0 + b * cell, z0 + (j + 1) * cell]); }
    }
  }
  // The cells round a wall reach past its outside face (a cell is ¼′ or more), so the floor and ceiling would
  // show outside the room. Each rectangle's edge that runs along a wall, or sticks out past a wall's end, moves
  // onto the wall's centre line or end, under the wall where it can't be seen.
  const segs = [];
  for (const p of A.pieces) if (use(p.ceilw)) segs.push([p.x1, p.z1, p.x2, p.z2, p.t || 0.25]);
  for (const i of A.opInfo) if (use(i.ceilw)) segs.push([i.o.x1, i.o.y1, i.o.x2, i.o.y2, i.t || 0.25]);
  for (const g of A.ghost || []) segs.push([g.x1, g.y1, g.x2, g.y2, g.t || 0.25]);
  segs.push(...joins);
  // side at v (x = v when alongZ, else z = v), spanning lo..hi on the other axis
  const snapSide = (v, lo, hi, alongZ, more = 0) => {
    let best = v, bd = Infinity;
    for (const q of segs) {
      const [ua, va, ub, vb] = alongZ ? [q[0], q[1], q[2], q[3]] : [q[1], q[0], q[3], q[2]], t = q[4], R = Math.max(t / 2, cell * 0.75) + cell + 0.02 + more;
      if (Math.abs(ua - ub) < 0.02) { // the wall runs along the side
        if (Math.max(va, vb) < lo - 0.01 || Math.min(va, vb) > hi + 0.01) continue;
        const d = Math.abs(v - ua); if (d <= R && d < bd) { bd = d; best = ua; }
      } else if (Math.abs(va - vb) < 0.02) { // the wall runs across: the side may stick out past its end
        if (va < lo - R || va > hi + R || hi - lo > 2 * R + cell) continue; // only the short bump round the end
        // (a wall cut in pieces, at a door or a post, carries on past the cut: only its real ends count)
        const goesOn = (e) => segs.some(o => { if (o === q) return false; const [pa, pv, pb, pw] = alongZ ? [o[0], o[1], o[2], o[3]] : [o[1], o[0], o[3], o[2]]; return Math.abs(pv - va) < 0.02 && Math.abs(pw - va) < 0.02 && Math.min(pa, pb) < e + 0.02 && Math.max(pa, pb) > e - 0.02 && (Math.abs(pa - e) > 0.02 || Math.abs(pb - e) > 0.02); });
        for (const [e, o] of [[ua, ub], [ub, ua]]) { const d = Math.abs(v - e); if (d <= R && d < bd && (v - e) * (e - o) > 0 && !goesOn(e)) { bd = d; best = e; } }
      }
    }
    return best;
  };
  // A long side can run along several walls that don't line up (a room's wall a few inches further in than
  // the next room's): one snap for the whole side would carry the furthest wall's line along all of it, and the
  // ceiling and floor would stick out past the nearer walls. So the rectangle is cut where those walls end and
  // each piece snaps to its own wall.
  const ends = (v, lo, hi, alongZ) => {
    const out = [];
    for (const q of segs) {
      const [ua, va, ub, vb] = alongZ ? [q[0], q[1], q[2], q[3]] : [q[1], q[0], q[3], q[2]], R = Math.max(q[4] / 2, cell * 0.75) + cell + 0.02;
      if (Math.abs(ua - ub) >= 0.02 || Math.abs(v - ua) > R) continue;
      for (const e of [va, vb]) if (e > lo + 0.05 && e < hi - 0.05) out.push(e);
    }
    return out;
  };
  const cuts = (a, b, L) => { const P = [...new Set([a, ...L.map(e => +e.toFixed(4)), b])].sort((m, n) => m - n), o = []; for (let i = 0; i + 1 < P.length; i++) if (P[i + 1] - P[i] > 0.01) o.push([P[i], P[i + 1]]); return o; };
  const snapped = [];
  for (const r of rects) {
    for (const [xa, xb] of cuts(r[0], r[2], ends(r[1], r[0], r[2], false).concat(ends(r[3], r[0], r[2], false)))) {
      for (const [za, zb] of cuts(r[1], r[3], ends(xa, r[1], r[3], true).concat(ends(xb, r[1], r[3], true)))) {
        // a small piece is the bump round a wall corner: it may reach a little further to its wall
        const more = xb - xa < 0.75 && zb - za < 0.75 ? cell + 0.1 : 0;
        const x0s = snapSide(xa, za, zb, true, more), x1s = snapSide(xb, za, zb, true, more), z0s = snapSide(za, xa, xb, false, more), z1s = snapSide(zb, xa, xb, false, more);
        if (x1s - x0s < 0.01 || z1s - z0s < 0.01) continue;
        snapped.push([x0s, z0s, x1s, z1s]);
      }
    }
  }
  rects.length = 0; rects.push(...snapped);
  const fp = { cell, x0, z0, nx, nz, inside, wall, rects, area: n * cell * cell,
    has(x, z) { const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); return i >= 0 && j >= 0 && i < nx && j < nz && !!inside[j * nx + i]; } };
  A[KEY] = fp;
  return fp;
}

/* Ceiling areas: a rectangle inside a room with a ceiling of its own, raised or dropped
   (plan.ceilAreas: { id, x0, y0, x1, y1, ceiling }). It stays at least 3″ under the top of the walls; to go
   higher, raise the plenum or the walls. Where its edge runs across open ceiling (no wall there) a bulkhead of
   hardwall panels fills the step from the higher ceiling down to the lower one. */
function ceilAreas(plan, A) {
  const top = (A.WH || A.H) - 0.25;
  return (plan.ceilAreas || []).filter(c => c && Math.abs(c.x1 - c.x0) > 0.5 && Math.abs(c.y1 - c.y0) > 0.5).map(c => ({
    c, x0: Math.min(c.x0, c.x1), x1: Math.max(c.x0, c.x1), z0: Math.min(c.y0, c.y1), z1: Math.max(c.y0, c.y1),
    h: Math.max(6, Math.min(c.raise ? 40 : top, c.ceiling > 0 ? +c.ceiling : A.H)), raise: !!c.raise, hang: !!c.hang
  }));
}
// ceiling areas marked hang: grid hung where there are no walls round it (an open area, a canopy), as rects
function hangRects(plan) {
  return (plan && plan.ceilAreas || []).filter(c => c && c.hang && Math.abs(c.x1 - c.x0) > 0.5 && Math.abs(c.y1 - c.y0) > 0.5).map(c => [Math.min(c.x0, c.x1), Math.min(c.y0, c.y1), Math.max(c.x0, c.x1), Math.max(c.y0, c.y1)]);
}
// the ceiling height at a point: the last area drawn over it, or the room's
function ceilingAt(CA, H, x, z, skip) { let h = H; for (const a of CA) if (a !== skip && x > a.x0 + 1e-6 && x < a.x1 - 1e-6 && z > a.z0 + 1e-6 && z < a.z1 - 1e-6) h = a.h; return h; }
// the bulkheads: runs along each area's edge where the ceiling on the two sides differs and no wall stands there
function areaBulkheads(plan, A, CA) {
  CA = CA || ceilAreas(plan, A); if (!CA.length) return [];
  const fp = footprint(A), out = [], st = 0.25, t = 0.25;
  // a door or window in a wall counts as wall: its head panel already closes the space above it
  const nearWall = (x, z) => A.pieces.some(p => segDist(x, z, p.x1, p.z1, p.x2, p.z2) < (p.t || 0.25) / 2 + 0.2) || A.boxes.some(b => x > b.x0 - 0.2 && x < b.x1 + 0.2 && z > b.z0 - 0.2 && z < b.z1 + 0.2) || (A.opInfo || []).some(i => segDist(x, z, i.o.x1, i.o.y1, i.o.x2, i.o.y2) < (i.t || 0.25) / 2 + 0.2);
  for (const a of CA) {
    if (a.hang) continue; // a hung grid section has no walls or bulkheads round it
    for (const [ax, az, bx, bz, nx, nz] of [[a.x0, a.z0, a.x1, a.z0, 0, -1], [a.x1, a.z0, a.x1, a.z1, 1, 0], [a.x1, a.z1, a.x0, a.z1, 0, 1], [a.x0, a.z1, a.x0, a.z0, -1, 0]]) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / st)), ux = (bx - ax) / L, uz = (bz - az) / L;
      let run = null;
      const flush = () => { if (run && run.b - run.a > 0.2) out.push({ x1: ax + ux * run.a, z1: az + uz * run.a, x2: ax + ux * run.b, z2: az + uz * run.b, y0: Math.min(a.h, run.o), y1: Math.max(a.h, run.o), t, len: run.b - run.a, area: a }); run = null; };
      for (let k = 0; k < n; k++) {
        const s0 = k * L / n, s1 = (k + 1) * L / n, m = (s0 + s1) / 2, x = ax + ux * m, z = az + uz * m;
        const ox = x + nx * 0.3, oz = z + nz * 0.3, other = ceilingAt(CA, A.H, ox, oz, a);
        // another area outside this edge: only the higher of the two draws the step
        const otherArea = CA.some(q => q !== a && ox > q.x0 && ox < q.x1 && oz > q.z0 && oz < q.z1);
        const need = fp && fp.has(x, z) && fp.has(ox, oz) && Math.abs(other - a.h) > 0.05 && !(otherArea && other > a.h) && !nearWall(x, z);
        if (need && run && Math.abs(run.o - other) < 0.01) run.b = s1;
        else { flush(); if (need) run = { a: s0, b: s1, o: other }; }
      }
      flush();
    }
  }
  return out;
}
// rectangles [x0, z0, x1, z1]: with the holes cut out / only the part inside a box
function subtractRects(rects, holes) {
  let cur = rects.slice();
  for (const h of holes) {
    const nxt = [];
    for (const [a, b, c, d] of cur) {
      const x0 = Math.max(a, h.x0), x1 = Math.min(c, h.x1), z0 = Math.max(b, h.z0), z1 = Math.min(d, h.z1);
      if (x0 >= x1 || z0 >= z1) { nxt.push([a, b, c, d]); continue; }
      if (b < z0) nxt.push([a, b, c, z0]); if (z1 < d) nxt.push([a, z1, c, d]);
      if (a < x0) nxt.push([a, z0, x0, z1]); if (x1 < c) nxt.push([x1, z0, c, z1]);
    }
    cur = nxt;
  }
  return cur;
}
/* Where the ceiling is. A generated ceiling records its outline (plan.ceilRects, the rooms it was laid out in);
   then the ceiling, its tees and the plenum lid stay inside that outline (and inside this area's walls) instead
   of filling everything the walls enclose, which on a big plan can take in parts of the warehouse. */
/* A ceiling built piece by piece (the Grid tool's Build): plan.ceilTiles = [{ id, x, y, w, h }], each tile's
   centre and size in feet. The ceiling is exactly those tiles plus the FFUs and lights, and every tee is an
   edge of one of them, so any layout can be drawn: cut tiles, odd sizes, tiles turned any way. */
const isBuilt = (plan) => !!(plan && Array.isArray(plan.ceilTiles) && plan.ceilTiles.length);
const nomSize = (v) => (Math.abs(v - Math.round(v)) < 0.2 ? Math.round(v) : v);
// [x0, z0, x1, z1] of every tile, and of every FFU and light (at its nominal size)
function builtBoxes(plan, withFixtures) {
  const out = (plan.ceilTiles || []).filter(t => t && t.w > 0 && t.h > 0).map(t => [t.x - t.w / 2, t.y - t.h / 2, t.x + t.w / 2, t.y + t.h / 2]);
  if (withFixtures !== false) for (const f of plan.fixtures || []) { if (!f || !isFinite(f.x)) continue; const w = nomSize(f.w || 2), h = nomSize(f.h || 4); out.push([f.x - w / 2, f.y - h / 2, f.x + w / 2, f.y + h / 2]); }
  return out;
}
const builtRects = (plan) => builtBoxes(plan, true);
// the tees of a built ceiling: every piece's four edges, joined where pieces share an edge
function builtLines(plan) {
  const out = [];
  for (const [x0, z0, x1, z1] of builtBoxes(plan, true)) out.push([x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, z1]);
  return joinLines(out);
}
/* Where an imported ceiling drawing actually has grid: every spot with a drawn tee within a tile's length on
   each side, both ways (so the inside of each patch of grid, not the empty corners of its box), as rectangles. */
const DRAWN_COVER = new WeakMap();
function drawingCover(own, walls) {
  if (!own || !own.length) return [];
  const key = (walls || []).length, memo = DRAWN_COVER.get(own); if (memo && memo.key === key) return memo.out;
  const V = [], H = [];
  // the walls close a patch off too: the cut tiles between the last tee and a wall are ceiling
  const wl = (walls || []).filter(w => Math.abs(w.x1 - w.x2) < 0.02 || Math.abs(w.y1 - w.y2) < 0.02).map(w => [w.x1, w.y1, w.x2, w.y2]);
  for (const q of own.concat(wl)) { if (Math.abs(q[0] - q[2]) < 0.02) V.push([(q[0] + q[2]) / 2, Math.min(q[1], q[3]), Math.max(q[1], q[3])]); else if (Math.abs(q[1] - q[3]) < 0.02) H.push([(q[1] + q[3]) / 2, Math.min(q[0], q[2]), Math.max(q[0], q[2])]); }
  V.sort((a, b) => a[0] - b[0]); H.sort((a, b) => a[0] - b[0]);
  const lo = (L, v) => { let a = 0, b = L.length; while (a < b) { const m = (a + b) >> 1; if (L[m][0] < v) a = m + 1; else b = m; } return a; };
  const R = 4.2, both = (L, at, along) => { let l = false, r = false; for (let i = lo(L, at - R); i < L.length && L[i][0] <= at + R; i++) { const q = L[i]; if (along < q[1] - 0.05 || along > q[2] + 0.05) continue; if (q[0] < at) l = true; else r = true; if (l && r) return true; } return false; };
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const q of own) { x0 = Math.min(x0, q[0], q[2]); x1 = Math.max(x1, q[0], q[2]); z0 = Math.min(z0, q[1], q[3]); z1 = Math.max(z1, q[1], q[3]); }
  x0 -= R; z0 -= R; x1 += R; z1 += R;
  const st = 0.5, nx = Math.max(1, Math.ceil((x1 - x0) / st)), nz = Math.max(1, Math.ceil((z1 - z0) / st)), out = [];
  if (nx * nz > 4e6) { DRAWN_COVER.set(own, { key, out: [] }); return []; }
  let prev = new Map();
  for (let j = 0; j < nz; j++) {
    const z = z0 + (j + 0.5) * st, runs = []; let s0 = -1;
    for (let i = 0; i <= nx; i++) { const x = x0 + (i + 0.5) * st, on = i < nx && both(V, x, z) && both(H, z, x); if (on && s0 < 0) s0 = i; if (!on && s0 >= 0) { runs.push([s0, i]); s0 = -1; } }
    // a run lined up with one in the row above grows that rectangle down
    const next = new Map();
    for (const [a, b] of runs) { const k = a + ',' + b, r = prev.get(k); if (r) { r[3] = z0 + (j + 1) * st; next.set(k, r); } else { const n = [x0 + a * st, z0 + j * st, x0 + b * st, z0 + (j + 1) * st]; out.push(n); next.set(k, n); } }
    prev = next;
  }
  DRAWN_COVER.set(own, { key, out }); return out;
}
function ceilingRects(plan, FP, A) {
  const res = ceilingRects0(plan, FP, A), H2 = hangRects(plan);
  if (!H2.length) return res;
  // hung grid sections add their own ceiling, outside the walls too
  return res.concat(subtractRects(H2, res.map(r => ({ x0: r[0], z0: r[1], x1: r[2], z1: r[3] }))).filter(r => r[2] - r[0] > 0.05 && r[3] - r[1] > 0.05));
}
function ceilingRects0(plan, FP, A) {
  if (isBuilt(plan)) return builtRects(plan);
  const R = plan && Array.isArray(plan.ceilRects) && plan.ceilRects.length ? plan.ceilRects : null;
  const own = !R && plan && Array.isArray(plan.ceilingGrid) && plan.ceilingGrid.length ? plan.ceilingGrid : null;
  if (own) {
    // an imported ceiling drawing: the cleanroom, plus wherever the drawing has grid inside the building (a
    // room the plan leaves open, a hall), so the ceiling goes where the drawing puts it
    const base = FP ? FP.rects : [], all = A ? footprint(A, true) : null;
    let extra = drawingCover(own, plan.walls); if (all) extra = [].concat(...all.rects.map(a => clipRects(extra, { x0: a[0], z0: a[1], x1: a[2], z1: a[3] })));
    if (base.length && extra.length) extra = subtractRects(extra, base.map(r => ({ x0: r[0], z0: r[1], x1: r[2], z1: r[3] })));
    // what is left beside a wall is a thin strip (the drawing's lines sit a little off the walls): that strip is
    // not ceiling, it would stick out past the wall over the room next door. Real extra grid (a hall) is wider.
    return base.concat(extra.filter(r => r[2] - r[0] > 1.01 && r[3] - r[1] > 1.01));
  }
  if (!R) return FP ? FP.rects : [];
  const all = A ? footprint(A, true) : null, base = all ? all.rects : FP ? FP.rects : [], out = [];
  for (const a of base) for (const b of R) { const r = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]; if (r[0] < r[2] - 1e-6 && r[1] < r[3] - 1e-6) out.push(r); }
  return out;
}
function inCeiling(plan, FP, x, z) {
  // a built ceiling keeps its outline in plan.ceilRects too (the editor sets it on every change)
  if (isBuilt(plan) && !(Array.isArray(plan.ceilRects) && plan.ceilRects.length)) plan.ceilRects = builtRects(plan);
  const R = plan && Array.isArray(plan.ceilRects) && plan.ceilRects.length ? plan.ceilRects : null;
  const inHang = () => hangRects(plan).some(r => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]);
  if (!R) return !!(FP && FP.has(x, z)) || inHang();
  return R.some(r => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) || inHang();
}
const rectsMinus = (rects, cut) => subtractRects(rects, cut.map(r => ({ x0: r[0], z0: r[1], x1: r[2], z1: r[3] })));
const clipRects = (rects, h) => rects.map(([a, b, c, d]) => [Math.max(a, h.x0), Math.max(b, h.z0), Math.min(c, h.x1), Math.min(d, h.z1)]).filter(([a, b, c, d]) => a < c && b < d);
// a line [x1, z1, x2, z2] cut where it crosses ceiling areas: [[x1, z1, x2, z2, ceiling], …]
function splitByAreas(q, CA, H) {
  if (!CA.length) return [[...q, H]];
  const ts = [0, 1], dx = q[2] - q[0], dz = q[3] - q[1];
  for (const a of CA) { if (Math.abs(dx) > 1e-9) for (const x of [a.x0, a.x1]) ts.push((x - q[0]) / dx); if (Math.abs(dz) > 1e-9) for (const z of [a.z0, a.z1]) ts.push((z - q[1]) / dz); }
  const T = [...new Set(ts.filter(t => t >= 0 && t <= 1).map(t => +t.toFixed(6)))].sort((a, b) => a - b), out = [];
  for (let i = 0; i + 1 < T.length; i++) { if (T[i + 1] - T[i] < 1e-6) continue; const m = (T[i] + T[i + 1]) / 2; out.push([q[0] + dx * T[i], q[1] + dz * T[i], q[0] + dx * T[i + 1], q[1] + dz * T[i + 1], ceilingAt(CA, H, q[0] + dx * m, q[1] + dz * m)]); }
  return out;
}
/* Wall height sections: w.sections = [{ a, b, h }], a and b in feet along the wall from its first end and h the
   height of the wall's top there (floor to top). Outside every section the wall keeps its usual height. */
const sectionTop = (w, s, def) => { for (const q of (w && w.sections) || []) if (q && q.h > 0 && s >= Math.min(q.a, q.b) - 1e-6 && s <= Math.max(q.a, q.b) + 1e-6) return Math.max(1, +q.h); return def; };
function rectsGeometry(THREE, rects, y, down, su, sv, ox, oz, swapUV) {
  const pos = [], uv = [];
  for (const [ax, az, bx, bz] of rects) {
    const P = [[ax, az], [bx, az], [bx, bz], [ax, bz]];
    const tri = down ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const t of tri) { pos.push(P[t][0], y, P[t][1]); if (swapUV) uv.push((P[t][1] - oz) / su, (P[t][0] - ox) / sv); else uv.push((P[t][0] - ox) / su, (P[t][1] - oz) / sv); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/* The 2′ × 4′ lay-in ceiling grid: 2′ across (x), 4′ along (z, plan y), starting at plan.ceilGrid when the
   project has one (saved the first time fixtures are placed, so later wall edits don't slide the grid under
   them), otherwise at the walls' outside corner. Main / cross tee takeoffs will build on this. */
/* The grid in an imported ceiling drawing: line spacing each way and where the lines fall, so fixtures
   placed by hand land in its cells. */
const LINE_GRID = new WeakMap();
function gridFromLines(L) {
  if (LINE_GRID.has(L)) return LINE_GRID.get(L);
  const xs = [], ys = [];
  for (const q of L) { if (Math.abs(q[0] - q[2]) < 0.02 && Math.abs(q[1] - q[3]) > 1) xs.push((q[0] + q[2]) / 2); else if (Math.abs(q[1] - q[3]) < 0.02 && Math.abs(q[0] - q[2]) > 1) ys.push((q[1] + q[3]) / 2); }
  const axis = (v) => {
    const u = [...new Set(v.map(a => Math.round(a * 48) / 48))].sort((a, b) => a - b); if (u.length < 2) return null;
    const cnt = new Map(); for (let i = 1; i < u.length; i++) { const d = Math.round((u[i] - u[i - 1]) * 48) / 48; if (d >= 1.4 && d <= 5) cnt.set(d, (cnt.get(d) || 0) + 1); }
    if (!cnt.size) return null;
    const sp = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // the origin most lines agree with
    const ph = new Map(); for (const a of u) { const k = Math.round((((a % sp) + sp) % sp) * 48) / 48; ph.set(k, (ph.get(k) || 0) + 1); }
    return { sp, o: [...ph.entries()].sort((a, b) => b[1] - a[1])[0][0] };
  };
  const X = axis(xs), Y = axis(ys);
  const r = X && Y ? { ox: X.o, oz: Y.o, cw: X.sp, cl: Y.sp, swap: X.sp > Y.sp + 0.1, fromLines: true } : null;
  LINE_GRID.set(L, r); return r;
}
/* Steel beams (I-beams, wide flange) laid on the plan: { id, x1, y1, x2, y2, size, bot }. size is a W shape;
   bot is the height of the beam's underside (unset: see beamSeat). */
const BEAMS = {
  W8x18: { d: 8.14, bf: 5.25, tf: 0.33, tw: 0.23, lb: 18 }, W10x22: { d: 10.17, bf: 5.75, tf: 0.36, tw: 0.24, lb: 22 },
  W12x26: { d: 12.22, bf: 6.49, tf: 0.38, tw: 0.23, lb: 26 }, W14x30: { d: 13.84, bf: 6.73, tf: 0.39, tw: 0.27, lb: 30 },
  W16x31: { d: 15.88, bf: 5.53, tf: 0.44, tw: 0.28, lb: 31 }, W18x35: { d: 17.7, bf: 6.0, tf: 0.43, tw: 0.3, lb: 35 },
  W21x44: { d: 20.66, bf: 6.5, tf: 0.45, tw: 0.35, lb: 44 }, W24x55: { d: 23.57, bf: 7.0, tf: 0.51, tw: 0.4, lb: 55 }
};
const beamSize = (b) => BEAMS[b && b.size] || BEAMS.W12x26;
/* Where a beam actually goes. A beam over the cleanroom bears on the cleanroom walls: it runs from the wall it
   crosses going into the cleanroom to the wall it crosses coming out (stretched to the next wall when it stops
   short inside), with its top flush with the top of the walls, so it hangs in the plenum. With no plenum it sits
   on top of the walls. A beam that never crosses the cleanroom stays building structure, up under the roof deck.
   b.bot (feet) sets the underside by hand and leaves the beam where it was drawn.
   Returns { x1, y1, x2, y2, bot, onWalls }. */
function beamSeat(plan, A, b) {
  A = A || analyze(plan);
  const d = beamSize(b).d / 12, raw = { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 };
  const up = () => ({ ...raw, bot: A.shellTop ? Math.max(1, A.shellTop - d - 0.05) : (A.WH || (plan.ceiling || 8)) + (A.PL > 0 ? 0.17 : 0.05), onWalls: false });
  if (b.bot > 0) return { ...raw, bot: +b.bot, onWalls: false };
  const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1), fp = A.hardAny ? footprint(A) : null;
  if (!(L > 0.2) || !fp) return up();
  const ux = (b.x2 - b.x1) / L, uy = (b.y2 - b.y1) / L;
  // the stretch of the beam over the cleanroom
  let sa = null, sb = null;
  for (let s = 0; s <= L + 1e-9; s += 0.25) if (fp.has(b.x1 + ux * s, b.y1 + uy * s)) { if (sa == null) sa = s; sb = s; }
  if (sa == null) return up();
  // where the beam's line crosses cleanroom walls (distance along the beam from its first end)
  const hits = [], half = new Map();
  for (const w of A.walls) {
    if (!isHard(w)) continue;
    const wl = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (wl < 0.1) continue;
    const wx = (w.x2 - w.x1) / wl, wy = (w.y2 - w.y1) / wl, den = ux * wy - uy * wx; if (Math.abs(den) < 0.05) continue;
    const ex = w.x1 - b.x1, ey = w.y1 - b.y1, s = (ex * wy - ey * wx) / den, t = (ex * uy - ey * ux) / den, e = (w.t || 0.25) / 2;
    if (t >= -e && t <= wl + e) { hits.push(s); half.set(s, e); }
  }
  const tol = 0.75, before = hits.filter(s => s <= sa + tol), after = hits.filter(s => s >= sb - tol);
  if (!before.length && !after.length) return up();
  const s0 = before.length ? Math.max(...before) : sa, s1 = after.length ? Math.min(...after) : sb;
  // the beam runs on over each wall it bears on to the wall's outside face (flush with it)
  const e0 = before.length ? half.get(s0) || 0 : 0, e1 = after.length ? half.get(s1) || 0 : 0;
  if (s1 - s0 < 1) return up();
  // it sits on the walls it spans, at their top there: a taller room's walls (raised with a ceiling area, or
  // given their own height) carry it higher
  const ex = (s) => [b.x1 + ux * s, b.y1 + uy * s];
  const wallTop = (s) => { const [x, z] = ex(s); let best = null, bd = 1e9; for (const p of A.pieces) { if (!p.hard) continue; const dd = segDist(x, z, p.x1, p.z1, p.x2, p.z2); if (dd < (p.t || 0.25) / 2 + 0.75 && dd < bd) { bd = dd; best = p.h; } } return best; };
  const WH0 = A.WH || A.H, t0 = wallTop(s0), t1 = wallTop(s1), WH = t0 != null && t1 != null ? Math.min(t0, t1) : t0 != null ? t0 : t1 != null ? t1 : WH0, top = WH - 0.02;
  // it hangs in the plenum between the walls; its top flange runs on over each wall's top to the outside face and
  // rests on the panels there, under the wall cap (the web and bottom flange stop at the walls' inside faces)
  const tf = Math.max(0.025, (beamSize(b).tf || 0.4) / 12), btm = WH + tf - d, ceilUnder = A.PL > 0 ? WH - A.PL : A.H;
  return { x1: b.x1 + ux * (s0 - e0), y1: b.y1 + uy * (s0 - e0), x2: b.x1 + ux * (s1 + e1), y2: b.y1 + uy * (s1 + e1), in0: 2 * e0, in1: 2 * e1, bot: A.PL > 0 ? Math.max(ceilUnder + 0.05, btm) : WH + WALL_CAP.up, onWalls: true };
}
/* Where a beam can sit on a cleanroom wall: the studs. A wall drawn as a long run has an H-stud every 48″ from
   its start (where its panels join) and a post at each end; a snap-together panel has one at each end. */
function studPoints(plan) {
  const out = [], seen = new Set(), put = (x, y, w) => { const k = Math.round(x * 24) + ',' + Math.round(y * 24); if (seen.has(k)) return; seen.add(k); out.push({ x, y, wall: w.id }); };
  for (const w of plan.walls || []) {
    if (!isHard(w)) continue;
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 0.1) continue;
    put(w.x1, w.y1, w); put(w.x2, w.y2, w);
    if (!w.piece) { const ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L; for (const m of wallModule(w, plan)) put(w.x1 + ux * m, w.y1 + uy * m, w); }
  }
  return out;
}
/* The white cap over the top of every cleanroom wall: it fits over both faces and runs down 1″ on each; its top
   stands `up` above the panels (beams and the lid rest on it). */
const WALL_CAP = { up: 0.03, down: 1 / 12, over: 0.015 };
/* Where a cleanroom wall's panels join (H-studs), as distances from the wall's start (its centreline end). A full
   panel is 45″ with a 3″ H-stud, so studs are 48″ on centre, the first one 48″ from the end (1½″ to the face of the
   end post, a 45″ panel, half the stud). With beams on the wall (plan.studsUnderBeams, on unless turned off) a stud
   stands right under each beam; between those studs it is full panels with one cut panel to make up the length (or
   two equal ones of at least 24″ when the cut would be shorter than that), the cut panel put where it leaves the
   grilles on full panels, closest to where they are. */
const WMOD = new WeakMap();
function wallModule(w, plan) {
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), def = () => { const o = []; for (let m = 4; m < L - 1e-6; m += 4) o.push(m); return o; };
  // square walls sit on one building-wide grid: studs 48″ on centre from the building's corner, so walls facing
  // each other have their studs (and panels) lined up across the room and a beam set on a stud lands on a stud on
  // both sides
  if (plan && plan.studGrid !== false && !w.piece) { const g = gridStuds(w, plan); if (g) return g; }
  if (!plan || plan.studsUnderBeams !== true || !(plan.beams || []).length || w.piece) return def();
  const sig = JSON.stringify([plan.beams, (plan.walls || []).map(q => [q.id, q.x1, q.y1, q.x2, q.y2, q.t, q.type]), plan.ceiling, plan.plenum]);
  let C = WMOD.get(plan); if (!C || C.sig !== sig) { C = { sig, fixed: beamStuds(plan) }; WMOD.set(plan, C); }
  const F = (C.fixed.get(w.id) || []).filter(s => s > 0.35 && s < L - 0.35).sort((a, b) => a - b);
  const cols = grilleCols(w, plan), stops = [];
  for (const f of F) if (!stops.length || f - stops[stops.length - 1] > 0.3) stops.push(f);
  const ends = [wallEnd(w, plan, true), wallEnd(w, plan, false)];
  return wallStuds(L, stops, cols.length, cols.length ? Math.max(...cols.map(c => c.w)) + 3.25 / 12 : 0, ends);
}
/* What a wall end meets: 'corner' (another wall turning there, or nothing: a free end) or 'tee' (it butts into the
   side of another wall, or carries straight on into one). Short panels go at corners, not at tees. */
function wallEnd(w, plan, start) {
  const x = start ? w.x1 : w.x2, y = start ? w.y1 : w.y2, L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
  let tee = false;
  for (const o of plan.walls || []) {
    if (o === w || !isHard(o)) continue;
    const d = segDist(x, y, o.x1, o.y1, o.x2, o.y2); if (d > (o.t || 0.25) / 2 + 0.15) continue;
    const ol = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1, par = Math.abs(ux * (o.x2 - o.x1) / ol + uy * (o.y2 - o.y1) / ol) > 0.98;
    const atEnd = Math.min(Math.hypot(o.x1 - x, o.y1 - y), Math.hypot(o.x2 - x, o.y2 - y)) < 0.3;
    if (par || !atEnd) tee = true;
  }
  return tee ? 'tee' : 'corner';
}
/* The whole wall at once (feet, from its start): a stud at every fixed point F (under the beams); full 45″ panels
   (48″ on centre) wherever they fit; the fewest panels; a short panel (under 24″) put at a corner rather than in
   the middle of the wall, and two short ones combined into one where they can be; and at least K panels wide
   enough (`need`) for the grilles to sit centred on. Searched on a ¼″ step. */
function wallStuds(L, F, K, need, ends) {
  const P = [0]; for (let k = 1; k < Math.round(L * 48); k++) P.push(k / 48);
  const fixed = new Set(); for (const f of F) { let i = P.findIndex(x => Math.abs(x - f) < 0.125 / 12); if (i < 0) { P.push(f); P.sort((a, b) => a - b); i = P.indexOf(f); } else P[i] = f; fixed.add(i); }
  P.push(L); const N = P.length - 1, INF = 1e18;
  // a cut panel is best at a corner; a short one (under 24″) belongs at a corner, never mid-wall or at a tee
  const cost = (wd, end) => 10 + (Math.abs(wd - 4) < 0.01 ? 0 : end ? 2 : 3) + (wd < 2.01 ? (end ? 2 : 70) : 0) + (wd < 1 ? (end ? 8 : 700) + (end ? 0 : (1 - wd) * 600) : 0) + (wd < 1 / 12 ? 1e6 : 0);
  const E = ends || ['corner', 'corner'];
  const dp = Array.from({ length: N + 1 }, () => new Float64Array(K + 1).fill(INF)), fr = Array.from({ length: N + 1 }, () => new Int32Array(K + 1).fill(-1)), fc = Array.from({ length: N + 1 }, () => new Int16Array(K + 1));
  dp[0][0] = 0;
  for (let k = 1; k <= N; k++) {
    for (let j = k - 1; j >= 0; j--) {
      const wd = P[k] - P[j]; if (wd > 4 + (k === N ? 1.1 : 0.01) / 12) break;
      const big = need && wd >= need - 1e-6 ? 1 : 0, end = (j === 0 && E[0] === 'corner') || (k === N && E[1] === 'corner');
      for (let c = 0; c <= K; c++) { if (dp[j][c] >= INF) continue; const c2 = Math.min(K, c + big), v = dp[j][c] + cost(wd, end); if (v < dp[k][c2] - 1e-9) { dp[k][c2] = v; fr[k][c2] = j; fc[k][c2] = c; } }
      if (fixed.has(j)) break; // a stud under a beam can't be skipped
    }
  }
  // a grille spot with no panel to sit on (it gets removed) costs more than any short panel
  let c = 0, bv = INF; for (let q = 0; q <= K; q++) { const v = dp[N][q] + 500 * (K - q); if (v < bv) { bv = v; c = q; } }
  if (dp[N][c] >= INF) { const o = []; for (let m = 4; m < L - 1e-6; m += 4) o.push(m); return o; }
  const J = []; for (let k = N; k > 0;) { const j = fr[k][c], cc = fc[k][c]; if (j > 0) J.push(P[j]); k = j; c = cc; }
  return J.reverse();
}
// the building grid's origin, one for each direction: the 48″ grid placed (on a ¼″ step) where it gives the most
// grille spots a panel wide enough to sit centred on, then the most full panels, then the fewest short ones
const SGRID = new WeakMap();
function gridOrigin(plan) {
  const H = (plan.walls || []).filter(q => isHard(q) && !q.piece);
  const sig = JSON.stringify([H.map(q => [q.x1, q.y1, q.x2, q.y2]), (plan.grilles || []).map(g => g.wall).sort()]);
  const c = SGRID.get(plan); if (c && c.sig === sig) return c.o;
  let o = null;
  if (H.length) {
    const pick = (alongX) => {
      const W = H.filter(q => alongX ? Math.abs(q.y2 - q.y1) < 0.02 : Math.abs(q.x2 - q.x1) < 0.02).map(q => {
        const cols = grilleCols(q, plan); return { lo: Math.min(alongX ? q.x1 : q.y1, alongX ? q.x2 : q.y2), hi: Math.max(alongX ? q.x1 : q.y1, alongX ? q.x2 : q.y2), k: cols.length, need: cols.length ? Math.max(...cols.map(x => x.w)) + 3.25 / 12 : 0 };
      });
      const base = Math.min(...H.map(q => alongX ? Math.min(q.x1, q.x2) : Math.min(q.y1, q.y2)));
      let best = base, bs = -1e18;
      for (let s4 = 0; s4 < 192; s4++) {
        const org = base + s4 / 48; let sc = 0;
        for (const w of W) {
          const J = [w.lo]; for (let m = org + Math.ceil((w.lo - org) / 4 - 1e-6) * 4; m < w.hi - 1e-6; m += 4) if (m - w.lo >= 0.3 && w.hi - m >= 0.3) J.push(m); J.push(w.hi);
          let big = 0, full = 0, small = 0; for (let i = 0; i + 1 < J.length; i++) { const wd = J[i + 1] - J[i]; if (w.need && wd >= w.need - 1e-6) big++; if (Math.abs(wd - 4) < 0.01) full++; if (wd < 2) small++; }
          sc += 1000 * Math.min(big, w.k) + 10 * full - small;
        }
        if (sc > bs + 1e-9) { bs = sc; best = org; }
      }
      return best;
    };
    o = { x: pick(true), y: pick(false) };
  }
  SGRID.set(plan, { sig, o }); return o;
}
function gridStuds(w, plan) {
  const o = gridOrigin(plan); if (!o) return null;
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), alongX = Math.abs(w.y2 - w.y1) < 0.02, alongY = Math.abs(w.x2 - w.x1) < 0.02;
  if (!alongX && !alongY) return null;
  const a = alongX ? w.x1 : w.y1, b = alongX ? w.x2 : w.y2, org = alongX ? o.x : o.y, lo = Math.min(a, b), hi = Math.max(a, b), out = [];
  for (let m = org + Math.ceil((lo - org) / 4 - 1e-6) * 4; m < hi - 1e-6; m += 4) { if (m - lo < 0.3 || hi - m < 0.3) continue; out.push(Math.abs(m - a)); }
  return out.sort((x, y) => x - y).filter(v => v > 0 && v < L);
}
// the grille spots along a wall (a low return and the plenum grille over it count as one): [{ c, w }]
function grilleCols(w, plan) {
  const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, gx = (w.x2 - w.x1) / L, gy = (w.y2 - w.y1) / L, cols = [];
  for (const g of plan.grilles || []) { if (g.wall !== w.id) continue; const c = (g.x - w.x1) * gx + (g.y - w.y1) * gy, gw = Math.max(0.25, +g.w || 20 / 12); const k = cols.find(q => Math.abs(q.c - c) < 0.3); if (k) { k.w = Math.max(k.w, gw); k.g.push(g); } else cols.push({ c, w: gw, g: [g] }); }
  return cols.sort((a, b) => a.c - b.c);
}
// the grilles in a run of panels, in order, each to the panel nearest it that's wide enough: [{ col, panel | null }]
function placeCols(panels, cols) {
  const used = new Set(), out = [];
  for (const col of cols) {
    let best = null, bd = 1e9; for (let k = 0; k < panels.length; k++) { const q = panels[k]; if (used.has(k) || q[1] - q[0] - 3 / 12 < col.w + 0.25 / 12) continue; const d = Math.abs((q[0] + q[1]) / 2 - col.c); if (d < bd) { bd = d; best = k; } }
    if (best != null) used.add(best); out.push({ col, panel: best == null ? null : panels[best], d: bd });
  }
  return out;
}
/* Centre each wall's grilles on its panels after the studs move: each grille spot (with the plenum grille over it)
   moves to the middle of the panel nearest it that's wide enough. Extra grilles (spots with no panel wide enough
   left) are removed. Changes plan.grilles in place; returns { moved, removed, stuck: [{ wall, at, x, y, ids }] }. */
function fitGrilles(plan) {
  let moved = 0; const stuck = [];
  for (const w of (plan.walls || []).filter(q => isHard(q) && !q.piece)) {
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1); if (L < 1) continue;
    const cols = grilleCols(w, plan); if (!cols.length) continue;
    const gx = (w.x2 - w.x1) / L, gy = (w.y2 - w.y1) / L, J = [0, ...wallModule(w, plan), L], panels = [];
    for (let i = 0; i + 1 < J.length; i++) panels.push([J[i], J[i + 1]]);
    // when there are more grille spots than panels wide enough, choose which spots stay put (to sort out by hand) so
    // that none of them overlaps a grille that moved, and the rest move the least
    let P = placeCols(panels, cols), ns = P.filter(q => !q.panel).length;
    if (ns && cols.length <= 12) {
      const combos = []; const pick = (st, from) => { if (st.length === ns) { combos.push(st.slice()); return; } for (let k = from; k < cols.length; k++) { st.push(k); pick(st, k + 1); st.pop(); } }; pick([], 0);
      let bs = 1e18;
      for (const cb of combos) {
        const rest = cols.filter((_, k) => !cb.includes(k)), R = placeCols(panels, rest); if (R.some(q => !q.panel)) continue;
        const over = cb.reduce((t, k) => t + R.filter(q => Math.abs((q.panel[0] + q.panel[1]) / 2 - cols[k].c) < (q.col.w + cols[k].w) / 2).length, 0);
        const sc = over * 1000 + R.reduce((t, q) => t + q.d, 0);
        if (sc < bs) { bs = sc; P = R.concat(cb.map(k => ({ col: cols[k], panel: null }))); }
      }
    }
    for (const p of P) {
      if (!p.panel) { stuck.push({ wall: w.id, at: p.col.c, x: w.x1 + gx * p.col.c, y: w.y1 + gy * p.col.c, ids: p.col.g.map(g => g.id) }); continue; }
      const c = (p.panel[0] + p.panel[1]) / 2; if (Math.abs(c - p.col.c) < 1e-4) continue;
      for (const g of p.col.g) { g.x = w.x1 + gx * c; g.y = w.y1 + gy * c; moved++; }
    }
  }
  // grilles with no panel left to sit centred on are taken out (a stud would run through them)
  const gone = new Set([].concat(...stuck.map(q => q.ids)));
  if (gone.size) plan.grilles = (plan.grilles || []).filter(g => !gone.has(g.id));
  return { moved, removed: gone.size, stuck };
}
// the points where beams bear on cleanroom walls: Map(wall id → [distance along the wall])
function beamStuds(plan) {
  const out = new Map(); let A = null;
  try { A = analyze(plan); } catch (e) { return out; }
  const walls = (plan.walls || []).filter(w => isHard(w) && !w.piece);
  for (const b of plan.beams || []) {
    const q = beamSeat(plan, A, b); if (!q.onWalls) continue;
    const L = Math.hypot(q.x2 - q.x1, q.y2 - q.y1); if (L < 1) continue;
    const ux = (q.x2 - q.x1) / L, uy = (q.y2 - q.y1) / L;
    for (const [px, py] of [[q.x1 + ux * (q.in0 || 0) / 2, q.y1 + uy * (q.in0 || 0) / 2], [q.x2 - ux * (q.in1 || 0) / 2, q.y2 - uy * (q.in1 || 0) / 2]]) {
      let best = null, bd = 1e9;
      for (const w of walls) { const d = segDist(px, py, w.x1, w.y1, w.x2, w.y2); if (d < (w.t || 0.25) / 2 + 0.15 && d < bd) { bd = d; best = w; } }
      if (!best) continue;
      const wl = Math.hypot(best.x2 - best.x1, best.y2 - best.y1) || 1, s2 = ((px - best.x1) * (best.x2 - best.x1) + (py - best.y1) * (best.y2 - best.y1)) / wl;
      (out.get(best.id) || out.set(best.id, []).get(best.id)).push(s2);
    }
  }
  return out;
}
/* The wall cap on one wall piece: 12′ lengths along it, its top cut round each beam flange that crosses the wall.
   beams: [{ q (beamSeat), bf (feet) }]. Returns { p, L, ux, uz, nx, nz, cuts: [{ a, b, side }] }. */
function capPiece(p, beams) {
  const L0 = Math.hypot(p.x2 - p.x1, p.z2 - p.z1) || 1, ux = (p.x2 - p.x1) / L0, uz = (p.z2 - p.z1) / L0, nx = -uz, nz = ux, cuts = [];
  for (const bs of beams || []) {
    const bx = bs.q.x2 - bs.q.x1, bz = bs.q.y2 - bs.q.y1, bl = Math.hypot(bx, bz) || 1, den = ux * bz / bl - uz * bx / bl; if (Math.abs(den) < 0.2) continue;
    const ex = bs.q.x1 - p.x1, ez = bs.q.y1 - p.z1, sw = (ex * bz / bl - ez * bx / bl) / den, sb = (ex * uz - ez * ux) / den;
    if (sw < -0.05 || sw > L0 + 0.05 || sb < -0.05 || sb > bl + 0.05) continue;
    if (Math.min(sb, bl - sb) > (p.t || 0.25) + 0.1) continue; // the beam only bears on its end walls
    const mx = (bs.q.x1 + bs.q.x2) / 2 - p.x1, mz = (bs.q.y1 + bs.q.y2) / 2 - p.z1, side = mx * nx + mz * nz > 0 ? 1 : -1;
    const hw = bs.bf / 2 / Math.abs(den) + 0.01; cuts.push({ a: sw - hw, b: sw + hw, side });
  }
  return { p, L: L0, ux, uz, nx, nz, cuts };
}
// the cap as solids [{ x1, z1, x2, z2, y0, y1, t }]: one bent piece per length (top and legs together); under a
// flange only the leg on the far side from the beam carries on
function wallCapSolids(c) {
  const { p, L, ux, uz, nx, nz, cuts } = c, out = [], T2 = (p.t || 0.25) / 2, lg = WALL_CAP.over + 0.006;
  const minus = (a, b, C) => { const o = []; let s0 = a; for (const q of C.slice().sort((x, y) => x.a - y.a)) { if (q.b <= s0 || q.a >= b) continue; if (q.a - s0 > 0.01) o.push([s0, q.a]); s0 = Math.max(s0, q.b); } if (b - s0 > 0.01) o.push([s0, b]); return o; };
  const seg = (a, b, o, y0, y1, t) => out.push({ x1: p.x1 + ux * a + nx * o, z1: p.z1 + uz * a + nz * o, x2: p.x1 + ux * b + nx * o, z2: p.z1 + uz * b + nz * o, y0, y1, t });
  for (let a = 0; a < L - 0.01; a += 12) {
    const b = Math.min(L, a + 12);
    for (const [u, v] of minus(a, b, cuts)) seg(u, v, 0, p.h - WALL_CAP.down, p.h + WALL_CAP.up, p.t + 2 * WALL_CAP.over);
    for (const q of cuts) { const u = Math.max(a, q.a), v = Math.min(b, q.b); if (v - u > 0.01) seg(u, v, -q.side * (T2 + lg / 2), p.h - WALL_CAP.down, p.h, lg); }
  }
  return out;
}
// every cleanroom wall's cap (parts list, IFC, DWG)
function wallCaps(plan, A) {
  A = A || analyze(plan);
  const beams = A.PL > 0 ? (plan.beams || []).map(b => ({ q: beamSeat(plan, A, b), bf: beamSize(b).bf / 12 })).filter(o => o.q.onWalls) : [];
  return (A.pieces || []).filter(p => p.hard && !p.frame).map(p => capPiece(p, beams));
}
// the top of the cleanroom's own lid: on the wall caps, or on the beams where beams sit on the walls
function lidTop(plan, A) {
  A = A || analyze(plan);
  return Math.max((A.WH || A.H) + WALL_CAP.up, ...(plan.beams || []).map(b => { const q = beamSeat(plan, A, b); return q.onWalls ? q.bot + beamSize(b).d / 12 : 0; }));
}
function beamBottom(plan, A, b) { return beamSeat(plan, A, b).bot; }
/* Zoom for the orbit views: the wheel zooms toward whatever is under the mouse (not the middle of the
   screen), in steps that scale with distance, so a far corner comes up in a few turns and a close-up
   still gets fine steps. Double-click flies the view to the spot clicked. Touchpad pinch works too. */
function smartZoom(THREE, camera, controls, canvas, opts) {
  opts = opts || {};
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), minD = opts.minDist || 1.2, maxD = opts.maxDist || 700;
  controls.enableZoom = false; controls.minDistance = Math.min(controls.minDistance, 0.3);
  if (controls.maxDistance < maxD) controls.maxDistance = maxD;
  const pointAt = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const objs = opts.objects ? opts.objects() : [];
    const hit = objs.length ? ray.intersectObjects(objs, false)[0] : null;
    if (hit) return hit.point.clone();
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) && p.distanceTo(camera.position) < 900) return p;
    return ray.ray.at(camera.position.distanceTo(controls.target), p);
  };
  const active = () => controls.enabled && (!opts.active || opts.active());
  canvas.addEventListener('wheel', (e) => {
    if (!active()) return;
    e.preventDefault(); fly = null;
    const P = pointAt(e), d = camera.position.distanceTo(P), td = camera.position.distanceTo(controls.target);
    // ctrl+wheel is what a touchpad pinch sends: bigger steps per event
    let f = Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * (e.ctrlKey ? 0.012 : 0.0016))));
    if (f < 1 && d * f < minD) f = Math.min(1, minD / Math.max(d, 1e-6));
    if (f > 1 && td * f > maxD) f = Math.max(1, maxD / td);
    if (Math.abs(f - 1) < 1e-4) return;
    camera.position.sub(P).multiplyScalar(f).add(P);
    controls.target.sub(P).multiplyScalar(f).add(P);
    controls.update();
  }, { passive: false });
  // two fingers on a touch screen: pinch to zoom in and out, toward the point between the fingers (the orbit
  // controls' own zoom is off, so it would only pan)
  const tp = new Map(); let pz = null;
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; tp.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (tp.size === 2) { const [a, b] = [...tp.values()]; pz = { d: Math.hypot(a.x - b.x, a.y - b.y) }; } });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' || !tp.has(e.pointerId)) return; tp.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tp.size !== 2 || !pz || !active()) return;
    const [a, b] = [...tp.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 10) return;
    let f = pz.d / d; pz.d = d; f = Math.max(0.8, Math.min(1.25, f));
    const P = pointAt({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }), dP = camera.position.distanceTo(P), td = camera.position.distanceTo(controls.target);
    if (f < 1 && dP * f < minD) f = Math.min(1, minD / Math.max(dP, 1e-6));
    if (f > 1 && td * f > maxD) f = Math.max(1, maxD / td);
    if (Math.abs(f - 1) < 1e-4) return;
    camera.position.sub(P).multiplyScalar(f).add(P); controls.target.sub(P).multiplyScalar(f).add(P); controls.update();
  });
  const tpEnd = (e) => { tp.delete(e.pointerId); if (tp.size < 2) pz = null; };
  canvas.addEventListener('pointerup', tpEnd); canvas.addEventListener('pointercancel', tpEnd);
  let fly = null;
  const step = () => {
    if (!fly) return;
    const k = Math.min(1, (performance.now() - fly.t0) / 450), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(fly.fc, fly.toC, e); controls.target.lerpVectors(fly.ft, fly.toT, e); controls.update();
    if (k < 1) requestAnimationFrame(step); else fly = null;
  };
  canvas.addEventListener('dblclick', (e) => {
    if (!active() || (opts.canFly && !opts.canFly())) return;
    const P = pointAt(e), dir = camera.position.clone().sub(controls.target);
    const dist = Math.max(minD * 5, Math.min(dir.length(), camera.position.distanceTo(P) * 0.45));
    fly = { t0: performance.now(), fc: camera.position.clone(), ft: controls.target.clone(), toT: P, toC: P.clone().add(dir.setLength(dist)) };
    requestAnimationFrame(step);
  });
  return { pointAt };
}
function ceilingGrid(plan, A) {
  // a ceiling drawn in: its own grid
  if (plan && Array.isArray(plan.ceilingGrid) && plan.ceilingGrid.length) { const lg = gridFromLines(plan.ceilingGrid); if (lg) return lg; }
  const g = plan && plan.ceilGrid;
  // swap: the building was turned a quarter turn, so the 4′ side runs across (x) instead of along (z)
  const sw = g && isFinite(g.ox) ? !!g.swap : !!(plan && plan.ceilSwap), cw = sw ? 4 : 2, cl = sw ? 2 : 4;
  if (g && isFinite(g.ox) && isFinite(g.oy)) return { ox: g.ox, oz: g.oy, cw, cl, swap: sw };
  A = A || analyze(plan);
  return { ox: A.empty ? 0 : A.bounds.minX, oz: A.empty ? 0 : A.bounds.minZ, cw, cl, swap: sw };
}
/* Every T-grid line over the cleanroom ceiling. With an imported ceiling drawing: the drawing's own lines,
   plus the same grid (its spacing and line positions) carried on over any part of the ceiling the drawing
   didn't reach, so a drawing that covers half the room still gives a full ceiling. */
const CEIL_LINES = new WeakMap();
function ceilingLines(plan, A) {
  const own = Array.isArray(plan.ceilingGrid) && plan.ceilingGrid.length ? plan.ceilingGrid : null;
  A = A || analyze(plan);
  const hk = JSON.stringify(hangRects(plan)), memo = CEIL_LINES.get(A); if (memo && memo.src === own && memo.hk === hk) return memo.lines;
  const FP = footprint(A), out = own ? own.slice() : [];
  const save = (l) => { CEIL_LINES.set(A, { src: own, hk, lines: l }); return l; };
  if (!FP || A.house) return save(out);
  const G = own ? gridFromLines(own) : ceilingGrid(plan, A);
  if (!G) return save(out);
  const B = A.bounds, cw = G.cw, cl = G.cl, eps = 0.06;
  // the drawing's lines by position, to tell which cell edges it already draws
  const vx = new Map(), hz = new Map(), key = (v) => Math.round(v * 8);
  for (const q of own || []) {
    if (Math.abs(q[0] - q[2]) < 0.02) { const k = key((q[0] + q[2]) / 2); (vx.get(k) || vx.set(k, []).get(k)).push([Math.min(q[1], q[3]), Math.max(q[1], q[3])]); }
    else if (Math.abs(q[1] - q[3]) < 0.02) { const k = key((q[1] + q[3]) / 2); (hz.get(k) || hz.set(k, []).get(k)).push([Math.min(q[0], q[2]), Math.max(q[0], q[2])]); }
  }
  const hit = (M, at, v) => { for (const d of [-1, 0, 1]) for (const r of M.get(key(at) + d) || []) if (v > r[0] - eps && v < r[1] + eps) return true; return false; };
  const vDrawn = (x, zm) => hit(vx, x, zm), hDrawn = (z, xm) => hit(hz, z, xm);
  const i0 = Math.floor((B.minX - G.ox) / cw) - 1, i1 = Math.ceil((B.maxX - G.ox) / cw) + 1;
  const j0 = Math.floor((B.minZ - G.oz) / cl) - 1, j1 = Math.ceil((B.maxZ - G.oz) / cl) + 1;
  const X = (i) => G.ox + i * cw, Z = (j) => G.oz + j * cl;
  // the areas the drawing covers: each patch of grid it draws (lines that touch or cross), as a box. A drawing
  // can hold several patches laid out on their own lines (a room each, turned or shifted); the grid is only
  // carried on where none of them reaches, so it never runs a second set of tees over a patch
  const patches = [];
  if (own) {
    const n = own.length, par = own.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i]))), bx = own.map(q => [Math.min(q[0], q[2]) - 0.3, Math.min(q[1], q[3]) - 0.3, Math.max(q[0], q[2]) + 0.3, Math.max(q[1], q[3]) + 0.3]);
    const ord = bx.map((_, i) => i).sort((a, b) => bx[a][0] - bx[b][0]);
    for (let a = 0; a < n; a++) { const p = bx[ord[a]]; for (let b = a + 1; b < n; b++) { const q = bx[ord[b]]; if (q[0] > p[2]) break; if (q[1] <= p[3] && q[3] >= p[1]) par[find(ord[a])] = find(ord[b]); } }
    const m = new Map(); own.forEach((q, i) => { const r = find(i), b0 = m.get(r) || [1e9, 1e9, -1e9, -1e9, 0]; b0[0] = Math.min(b0[0], q[0], q[2]); b0[1] = Math.min(b0[1], q[1], q[3]); b0[2] = Math.max(b0[2], q[0], q[2]); b0[3] = Math.max(b0[3], q[1], q[3]); b0[4]++; m.set(r, b0); });
    for (const b0 of m.values()) if (b0[4] >= 3 && b0[2] - b0[0] > 1 && b0[3] - b0[1] > 1) patches.push(b0);
  }
  const inPatch = (x, z, e) => patches.some(p => x > p[0] - e && x < p[2] + e && z > p[1] - e && z < p[3] + e);
  // a cell the drawing already covers: inside one of its patches, or at least three of its four sides drawn
  const covered = (i, j) => {
    if (!own) return false;
    const xm = X(i) + cw / 2, zm = Z(j) + cl / 2;
    if ([[.5, .5], [.15, .15], [.85, .15], [.15, .85], [.85, .85]].some(([a, b]) => inPatch(X(i) + a * cw, Z(j) + b * cl, 0.25))) return true;
    return (vDrawn(X(i), zm) + vDrawn(X(i + 1), zm) + hDrawn(Z(j), xm) + hDrawn(Z(j + 1), xm)) >= 3;
  };
  // hung grid sections (ceiling areas with no walls round them) have grid too
  const HG = hangRects(plan), inHG = (x, z) => HG.some(r => x >= r[0] - 1e-6 && x <= r[2] + 1e-6 && z >= r[1] - 1e-6 && z <= r[3] + 1e-6);
  const FPh = HG.length ? { cell: FP.cell, has: (x, z) => FP.has(x, z) || inHG(x, z) } : FP;
  const inCell = (i, j) => { const s = [[.5, .5], [.1, .1], [.9, .1], [.1, .9], [.9, .9], [.5, .1], [.5, .9], [.1, .5], [.9, .5]]; return s.filter(([a, b]) => FPh.has(X(i) + a * cw, Z(j) + b * cl)).length >= 2; };
  const step = Math.min(0.25, FP.cell / 2);
  // one edge, clipped to where there is ceiling under it
  const edge = (x1, z1, x2, z2, F) => {
    F = F || FPh;
    const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(L / step)); let st = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, ins = F.has(x, z);
      if (ins && st === null) st = t;
      if ((!ins || k === n) && st !== null) { const e = ins ? t : (k - 1) / n; if ((e - st) * L > 0.3) out.push([x1 + (x2 - x1) * st, z1 + (z2 - z1) * st, x1 + (x2 - x1) * e, z1 + (z2 - z1) * e]); st = null; }
    }
  };
  // the drawing's own lines, trimmed to the ceiling (a drawing bigger than the room, or set off to one side,
  // doesn't hang past the walls)
  // (trimmed to the building, not just the closed-in cleanroom: a hall or a room left open in the plan still
  // keeps the grid drawn over it)
  out.length = 0;
  const FPd0 = own ? footprint(A, true) || FP : FP, FPd = HG.length ? { has: (x, z) => FPd0.has(x, z) || inHG(x, z) } : FPd0;
  for (const q of own || []) edge(q[0], q[1], q[2], q[3], FPd);
  const need = new Set();
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (inCell(i, j) && !covered(i, j)) need.add(i + ',' + j);
  const done = new Set();
  for (const c of need) {
    const [i, j] = c.split(',').map(Number);
    const sides = [['v', i, j, X(i), Z(j), X(i), Z(j + 1)], ['v', i + 1, j, X(i + 1), Z(j), X(i + 1), Z(j + 1)], ['h', i, j, X(i), Z(j), X(i + 1), Z(j)], ['h', i, j + 1, X(i), Z(j + 1), X(i + 1), Z(j + 1)]];
    for (const [t, a, b, x1, z1, x2, z2] of sides) {
      const k = t + a + ',' + b; if (done.has(k)) continue; done.add(k);
      if (t === 'v' ? vDrawn(x1, (z1 + z2) / 2) : hDrawn(z1, (x1 + x2) / 2)) continue;
      // a side running along or into a patch: the patch's own edge tee is already there
      if (inPatch((x1 + x2) / 2, (z1 + z2) / 2, 0.15)) continue;
      edge(x1, z1, x2, z2);
    }
  }
  return save(out);
}
/* Tee takeoff for a 2′ × 4′ lay-in grid over the cleanroom ceiling: main tees are the continuous runners
   4′ apart (12′ pieces, spliced), 4′ cross tees span between them every 2′ (a cut bay at a wall still takes
   a whole tee), a 2′ cross tee splits a cell for each 2 × 2 fixture, and hanger wires go every 4′ along the
   mains plus four at each light and FFU. The ceiling track on the walls is the perimeter support. */
/* Ceiling tiles as the grid lays them: every grid opening that isn't an FFU or light, a wall or a chase. A whole
   2′ × 4′ opening is a full tile; anything else is a cut tile, listed by its opening size (tee centre to tee
   centre or to the wall), short side first, to the ¼″. Tiles to order: the full ones, plus one tile per cut,
   except two small cuts are taken from one tile where they fit side by side. Not for an imported ceiling drawing. */
// every tile opening the ceiling has: { x0, z0, x1, z1 (its box), parts (the rects it's made of), notch, G }
function tileOpenings(plan, A) {
  A = A || analyze(plan);
  if (isBuilt(plan)) return plan.ceilTiles.filter(t => t && t.w > 0 && t.h > 0).map(t => ({ x0: t.x - t.w / 2, z0: t.y - t.h / 2, x1: t.x + t.w / 2, z1: t.y + t.h / 2, parts: [[t.x - t.w / 2, t.y - t.h / 2, t.x + t.w / 2, t.y + t.h / 2]], notch: false, G: { cw: t.w >= t.h ? 4 : 2, cl: t.w >= t.h ? 2 : 4 }, id: t.id }));
  if (Array.isArray(plan.ceilingGrid) && plan.ceilingGrid.length) return null;
  const fp = footprint(A); if (!fp || !A.hardAny) return null;
  const R = ceilingRects(plan, fp, A); if (!R.length) return null;
  let FX = []; try { FX = ceilingFixtures(plan, A); } catch (e) { FX = []; }
  const holes = FX.map(f => { const G = gridAt(plan, f.x, f.y, A), w = nomSize(f.w || (G.swap ? 4 : 2)), h = nomSize(f.h || (G.swap ? 2 : 4)); return { x0: f.x - w / 2, z0: f.y - h / 2, x1: f.x + w / 2, z1: f.y + h / 2 }; });
  for (const p of A.pieces) if (Math.abs(p.x1 - p.x2) < 1e-3 || Math.abs(p.z1 - p.z2) < 1e-3) { const t = (p.t || 0.25) / 2; holes.push({ x0: Math.min(p.x1, p.x2) - t, z0: Math.min(p.z1, p.z2) - t, x1: Math.max(p.x1, p.x2) + t, z1: Math.max(p.z1, p.z2) + t }); }
  for (const b of A.boxes || []) holes.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 });
  const out = [];
  for (const gp of gridPieces(plan, R)) {
    const G = gp.G; let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9;
    for (const r of gp.rects) { bx0 = Math.min(bx0, r[0]); bz0 = Math.min(bz0, r[1]); bx1 = Math.max(bx1, r[2]); bz1 = Math.max(bz1, r[3]); }
    for (let x = G.ox + Math.floor((bx0 - G.ox) / G.cw) * G.cw; x < bx1 - 1e-6; x += G.cw) for (let z = G.oz + Math.floor((bz0 - G.oz) / G.cl) * G.cl; z < bz1 - 1e-6; z += G.cl) {
      const cell = { x0: x, z0: z, x1: x + G.cw, z1: z + G.cl };
      let parts = clipRects(gp.rects, cell); if (!parts.length) continue;
      const near = holes.filter(h => h.x0 < cell.x1 && h.x1 > cell.x0 && h.z0 < cell.z1 && h.z1 > cell.z0);
      if (near.length) parts = subtractRects(parts, near);
      parts = parts.filter(r => r[2] - r[0] > 1e-3 && r[3] - r[1] > 1e-3);
      // what's left in the opening, in touching groups: each group is one tile
      const grp = parts.map((_, i) => i), find = (i) => (grp[i] === i ? i : (grp[i] = find(grp[i])));
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) { const a = parts[i], b = parts[j]; if (a[0] <= b[2] + 1e-4 && b[0] <= a[2] + 1e-4 && a[1] <= b[3] + 1e-4 && b[1] <= a[3] + 1e-4 && (Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 1e-3 || Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 1e-3)) grp[find(i)] = find(j); }
      const boxes = new Map();
      parts.forEach((r, i) => { const k = find(i), q = boxes.get(k) || { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9, area: 0, parts: [], G }; q.x0 = Math.min(q.x0, r[0]); q.z0 = Math.min(q.z0, r[1]); q.x1 = Math.max(q.x1, r[2]); q.z1 = Math.max(q.z1, r[3]); q.area += (r[2] - r[0]) * (r[3] - r[1]); q.parts.push(r); boxes.set(k, q); });
      for (const q of boxes.values()) { q.notch = q.area < (q.x1 - q.x0) * (q.z1 - q.z0) - 0.01; out.push(q); }
    }
  }
  return out;
}
/* Ceiling tiles as the grid lays them: every grid opening that isn't an FFU or light, a wall or a chase. A whole
   2′ × 4′ opening is a full tile; anything else is a cut tile, listed by its opening size (tee centre to tee
   centre or to the wall), short side first, to the ¼″. Tiles to order: the full ones, plus one tile per cut,
   except two small cuts are taken from one tile where they fit side by side. Not for an imported ceiling drawing. */
function tileTakeoff(plan, A) {
  const O = tileOpenings(plan, A); if (!O || !O.length) return null;
  const q4 = (v) => Math.round(v * 48) / 48; // to the ¼″
  let full = 0, slivers = 0; const cuts = new Map();
  for (const q of O) {
    const w = q4(q.x1 - q.x0), d = q4(q.z1 - q.z0), a = Math.min(w, d), b = Math.max(w, d);
    if (a < 1.5 / 12) { slivers++; continue; } // under 1½″: closed with the wall angle, no tile
    if (Math.abs(a - 2) < 0.03 && Math.abs(b - 4) < 0.03 && !q.notch) { full++; continue; }
    const key = a.toFixed(4) + 'x' + b.toFixed(4) + (q.notch ? 'n' : '');
    const e = cuts.get(key) || { a, b, notch: q.notch, n: 0 }; e.n++; cuts.set(key, e);
  }
  const list = [...cuts.values()].sort((p, q) => q.n - p.n || q.a * q.b - p.a * p.b);
  // tiles to order: two cuts share one 2′ × 4′ where they fit side by side (notched cuts get a tile each)
  const pcs = []; for (const c of list) for (let i = 0; i < c.n; i++) pcs.push(c);
  pcs.sort((p, q) => q.a * q.b - p.a * p.b);
  const used = new Array(pcs.length).fill(false); let cutStock = 0;
  const pair = (p, q) => !p.notch && !q.notch && ((p.b + q.b <= 4 + 1e-6 && p.a <= 2 + 1e-6 && q.a <= 2 + 1e-6) || (p.a + q.a <= 2 + 1e-6 && p.b <= 4 + 1e-6 && q.b <= 4 + 1e-6));
  for (let i = 0; i < pcs.length; i++) { if (used[i]) continue; used[i] = true; cutStock++; for (let j = pcs.length - 1; j > i; j--) if (!used[j] && pair(pcs[i], pcs[j])) { used[j] = true; break; } }
  return { full, cuts: list, cutPcs: pcs.length, cutStock, slivers, order: full + cutStock };
}
function gridTakeoff(plan, A) {
  A = A || analyze(plan);
  // a built ceiling: mains run across the tiles' long sides (lines 4′ apart), crosses along them
  if (isBuilt(plan)) {
    const T = plan.ceilTiles, longZ = T.filter(t => t.h > t.w + 0.05).length >= T.filter(t => t.w > t.h + 0.05).length;
    let mainFt = 0, mainRuns = 0, cross4 = 0, cross2 = 0;
    for (const q of builtLines(plan)) {
      const L = Math.hypot(q[2] - q[0], q[3] - q[1]), alongX = Math.abs(q[1] - q[3]) < 1e-6;
      if (alongX === longZ) { mainFt += L; mainRuns++; } else if (L <= 2.2) cross2++; else cross4 += Math.ceil(L / 4 - 1e-6);
    }
    const fx = ceilingFixtures(plan, A);
    return { mainFt, mainPcs: Math.ceil(mainFt * 1.05 / 12), mainRuns, cross4, cross2, frameFt: 0, framePcs: 0, hangers: Math.ceil(mainFt / 4) + mainRuns + fx.length * 4, fixtures: fx.length };
  }
  const fp = footprint(A); if (!fp || !A.hardAny) return null;
  // a generated ceiling: count each grid section on its own grid, inside the ceiling's outline
  if (Array.isArray(plan.ceilRects) && plan.ceilRects.length) {
    let mainFt = 0, mainRuns = 0, cross4 = 0;
    const first = (o, lo, sp) => o + Math.ceil((lo - o) / sp - 1e-6) * sp;
    for (const gp of gridPieces(plan, ceilingRects(plan, fp, A))) {
      const G = gp.G, mainAlongX = G.cl === 4;
      for (const [x0, z0, x1, z1] of gp.rects) {
        if (mainAlongX) { for (let z = first(G.oz, z0, 4); z <= z1 + 1e-6; z += 4) { mainFt += x1 - x0; mainRuns++; } for (let x = first(G.ox, x0, 2); x <= x1 + 1e-6; x += 2) cross4 += Math.ceil((z1 - z0) / 4 - 1e-6); }
        else { for (let x = first(G.ox, x0, 4); x <= x1 + 1e-6; x += 4) { mainFt += z1 - z0; mainRuns++; } for (let z = first(G.oz, z0, 2); z <= z1 + 1e-6; z += 2) cross4 += Math.ceil((x1 - x0) / 4 - 1e-6); }
      }
    }
    const fx = ceilingFixtures(plan, A), cross2 = fx.filter(f => Math.max(f.w || 2, f.h || 4) <= 2.2).length;
    // tees cut to frame fixtures that sit off the grid lines or turned across it
    let frameFt = 0; try { for (const l of fixtureFrames(plan, A).lines) frameFt += Math.hypot(l[2] - l[0], l[3] - l[1]); } catch (e) { frameFt = 0; }
    return { mainFt, mainPcs: Math.ceil(mainFt * 1.05 / 12), mainRuns, cross4, cross2, frameFt, framePcs: Math.ceil(frameFt / 4), hangers: Math.ceil(mainFt / 4) + mainRuns + fx.length * 4, fixtures: fx.length };
  }
  const G = ceilingGrid(plan, A), B = A.bounds, step = Math.min(0.25, fp.cell / 2);
  // mains run along the 2′ direction (lines 4′ apart); crosses run along the 4′ direction (lines 2′ apart)
  const mainAlongX = G.cl === 4, runs = [];
  const scan = (fixed, lo, hi, alongX) => {
    let st = null;
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const inside = alongX ? inCeiling(plan, fp, v, fixed) : inCeiling(plan, fp, fixed, v);
      if (inside && st === null) st = v;
      if ((!inside || v + step > hi + 1e-9) && st !== null) { const e = inside ? v : v - step; if (e - st > 0.3) runs.push({ fixed, a: st, b: e, alongX }); st = null; }
    }
  };
  const first = (o, lo, sp) => o + Math.ceil((lo - o) / sp - 1e-9) * sp;
  const mains = [], crosses = [];
  if (mainAlongX) {
    for (let z = first(G.oz, B.minZ, 4); z <= B.maxZ + 1e-9; z += 4) { runs.length = 0; scan(z, B.minX, B.maxX, true); mains.push(...runs); }
    for (let x = first(G.ox, B.minX, 2); x <= B.maxX + 1e-9; x += 2) { runs.length = 0; scan(x, B.minZ, B.maxZ, false); crosses.push(...runs); }
  } else {
    for (let x = first(G.ox, B.minX, 4); x <= B.maxX + 1e-9; x += 4) { runs.length = 0; scan(x, B.minZ, B.maxZ, false); mains.push(...runs); }
    for (let z = first(G.oz, B.minZ, 2); z <= B.maxZ + 1e-9; z += 2) { runs.length = 0; scan(z, B.minX, B.maxX, true); crosses.push(...runs); }
  }
  const mainFt = mains.reduce((t, r) => t + (r.b - r.a), 0);
  // cross tees: one per 4′ bay between mains that the run passes through (cut bays included)
  const mo = mainAlongX ? G.oz : G.ox;
  let cross4 = 0;
  for (const r of crosses) { const k0 = Math.floor((r.a - mo) / 4 + 1e-6), k1 = Math.ceil((r.b - mo) / 4 - 1e-6); for (let k = k0; k < k1; k++) { const a = Math.max(r.a, mo + k * 4), b = Math.min(r.b, mo + (k + 1) * 4); if (b - a > 0.3) cross4++; } }
  const fx = ceilingFixtures(plan, A), cross2 = fx.filter(f => Math.max(f.w || 2, f.h || 4) <= 2.2).length;
  const hangers = mains.reduce((t, r) => t + Math.ceil((r.b - r.a) / 4) + 1, 0) + fx.length * 4;
  return { mainFt, mainPcs: Math.ceil(mainFt * 1.05 / 12), mainRuns: mains.length, cross4, cross2, hangers, fixtures: fx.length };
}
/* Cleanroom check: for every room label, its floor area and volume, the FFUs over it, their airflow, air
   changes per hour and filter coverage, against its ISO class; and for every door or opening between two
   rooms, which way the air goes (from higher to lower pressure) and whether that's from the cleaner side.
   Targets are typical industry design ranges (minimums), not a certification. */
// return grilles: design face velocity (fpm) through the grille; Pa → inches of water column
const RET_FPM = 400, PA_TO_INWC = 1 / 249.0889;
/* Room types with the limits their standard puts on a room, checked against what the plan gives the room:
   USP <797> and <800> (2023 revisions) for sterile and hazardous compounding, EU GMP Annex 1 grades.
   iso: worst ISO class allowed (in operation); ach: minimum air changes; p: pressure against the rooms next
   to it ('pos' at least +5 Pa, 'neg' between -2.5 and -7.5 Pa, 'grade' at least 10 Pa over a lower grade);
   posTo 'unclassified': only against unclassified rooms and outside (an ante room sits below its buffer room);
   sink: 'need' / 'none'. A guide for the layout; certification on site is what counts. */
const ROOM_TYPES = {
  usp797buf: { label: 'USP 797 buffer room', iso: 7, ach: 30, p: 'pos', sink: 'none' },
  usp797ante: { label: 'USP 797 ante room', iso: 8, ach: 20, p: 'pos', posTo: 'unclassified', sink: 'need' },
  usp800buf: { label: 'USP 800 hazardous buffer room', iso: 7, ach: 30, p: 'neg', sink: 'none' },
  usp800ante: { label: 'USP 800 ante room', iso: 7, ach: 30, p: 'pos', posTo: 'unclassified', sink: 'need' },
  usp800csca: { label: 'USP 800 C-SCA (hazardous, unclassified)', iso: null, ach: 12, p: 'neg' },
  gmpA: { label: 'GMP Grade A', iso: 5, ach: null, p: 'grade', grade: 4 },
  gmpB: { label: 'GMP Grade B', iso: 7, ach: null, p: 'grade', grade: 3 },
  gmpC: { label: 'GMP Grade C', iso: 8, ach: null, p: 'grade', grade: 2 },
  gmpD: { label: 'GMP Grade D', iso: 8, ach: null, p: 'grade', grade: 1 }
};
const ISO_TARGETS = { 5: { ach: 240, cov: 35 }, 6: { ach: 150, cov: 25 }, 7: { ach: 60, cov: 15 }, 8: { ach: 20, cov: 5 }, 9: { ach: 10, cov: 0 } };
function cleanroomCheck(plan) {
  const Z = zones(plan), rooms = [], grids = [];
  for (const z of Z) {
    const A = analyze(z.plan); if (A.empty) continue;
    const R = roomRegions(A, z.plan, true); if (!R.grid) continue;
    grids.push({ R, z });
    const FM = z.plan.ffuModel && Array.isArray(z.plan.ffuModel.sizes) && z.plan.ffuModel.sizes.length ? z.plan.ffuModel : null;
    const fx = ceilingFixtures(z.plan, A), G = R.grid;
    const compAt = (x, y) => { const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((y - G.z0) / G.cell); return i < 0 || j < 0 || i >= G.nx || j >= G.nz ? -1 : G.comp[j * G.nx + i]; };
    // return air: the room-side face of each return grille, in a wall panel (Grille tool) or on an air chase.
    // A grille is good for about RET_FPM through its face; transfer grilles (both sides) aren't counted.
    const ret = new Map(), addRet = (x, y, w, h, kind) => { const ci = compAt(x, y); if (ci < 0) return; const e = ret.get(ci) || { n: 0, area: 0, kinds: {} }; e.n++; e.area += w * h; e.kinds[kind] = (e.kinds[kind] || 0) + 1; ret.set(ci, e); };
    for (const gr of z.plan.grilles || []) {
      if (gr.plenum || gr.flow === 'out' || gr.side === 0) continue;
      const a = gr.a || 0, nx = -Math.sin(a), ny = Math.cos(a), sd = gr.side || 1, off = (gr.t || 0.25) / 2 + 1.2;
      addRet(gr.x + nx * sd * off, gr.y + ny * sd * off, Math.max(0.25, +gr.w || 20 / 12), Math.max(0.25, +gr.h || 20 / 12), 'wall');
    }
    for (const b of A.boxes || []) {
      if (!b.grille) continue;
      const ns = b.grille === 'N' || b.grille === 'S', G = grilleSize(b.c, ns ? b.x1 - b.x0 : b.z1 - b.z0, A.H);
      const px = b.grille === 'W' ? b.x0 - 1.2 : b.grille === 'E' ? b.x1 + 1.2 : (b.x0 + b.x1) / 2, py = b.grille === 'N' ? b.z0 - 1.2 : b.grille === 'S' ? b.z1 + 1.2 : (b.z0 + b.z1) / 2;
      addRet(px, py, G.w, G.h, 'chase');
    }
    R.forEach((q, ci) => {
      const r = q.room, area = q.area, vol = area * A.H;
      let n = 0, cfm = 0, face = 0;
      const inRoom = fx.filter(f => compAt(f.x, f.y) === ci);
      for (const f of inRoom) {
        if (f.type !== 'ffu') continue;
        n++;
        const long = Math.max(f.w || 2, f.h || 4), short = Math.min(f.w || 2, f.h || 4);
        const zz = FM ? (FM.sizes.find(s2 => s2.nominal === '2x' + Math.max(2, Math.min(4, Math.round(long)))) || FM.sizes[0]) : null;
        const fa = Math.max(0.5, (long - 0.2) * (short - 0.2));
        face += fa; cfm += zz && zz.cfm ? zz.cfm : fa * 90; // 90 fpm face velocity when the unit's airflow isn't known
      }
      const iso = r.iso ? +r.iso : null, T = iso ? ISO_TARGETS[iso] : null, achT = r.ach > 0 ? +r.ach : T ? T.ach : null;
      const ach = vol > 0 ? cfm * 60 / vol : 0, cov = area > 0 ? face / area * 100 : 0;
      const short = [];
      if (achT && ach + 1e-6 < achT) short.push(`air changes ${Math.round(ach)}/hr, needs ${achT}`);
      if (T && T.cov && cov + 1e-6 < T.cov) short.push(`filter coverage ${Math.round(cov)}%, needs ${T.cov}%`);
      if (achT && vol > 0 && ach < achT) { const per = n ? cfm / n : (FM ? (FM.sizes[0].cfm || 650) : 630); short.push(`about ${Math.ceil((achT * vol / 60 - cfm) / per)} more FFU${Math.ceil((achT * vol / 60 - cfm) / per) === 1 ? '' : 's'}`); }
      // return air balance: the air the FFUs push in has to get back out through the return grilles
      const rt = ret.get(ci) || { n: 0, area: 0, kinds: {} }, retCap = rt.area * RET_FPM, vel = rt.area > 0 ? cfm / rt.area : null;
      let retWarn = null, retMore = 0;
      if (cfm > 0 && !rt.n) { retWarn = 'no return grilles in this room'; retMore = Math.ceil(cfm / RET_FPM / 4); }
      else if (vel != null && vel > RET_FPM * 1.1) { retMore = Math.ceil((cfm / RET_FPM - rt.area) / 4); retWarn = `returns too small: ${Math.round(vel)} fpm through them (aim for ${RET_FPM} or less)`; }
      const pr = r.pressure != null && r.pressure !== '' ? +r.pressure : null;
      rooms.push({ room: r, zone: z, area, volume: vol, H: A.H, ffus: n, cfm, ach, coverage: cov, iso, achTarget: achT, covTarget: T ? T.cov : null, pressure: pr, inWC: pr != null ? pr * PA_TO_INWC : null, ok: !short.length, short,
        returns: rt.n, returnArea: rt.area, returnCap: retCap, returnFpm: vel, retWarn, retMore, fixtures: inRoom, lights: inRoom.filter(f => f.type !== 'ffu').length,
        devices: (z.plan.devices || []).filter(d => compAt(d.x + Math.cos(d.a || 0) * 0.6, d.y + Math.sin(d.a || 0) * 0.6) === ci), items: (z.plan.items || []).filter(it => compAt(it.x, it.y) === ci) });
    });
  }
  // which room is at a point (any area), or null outside every labeled room
  const roomAt = (x, y) => { for (const g of grids) { const G = g.R.grid, i = Math.floor((x - G.x0) / G.cell), j = Math.floor((y - G.z0) / G.cell); if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) continue; const c = G.comp[j * G.nx + i]; if (c >= 0) return g.R[c].room; } return null; };
  const byRoom = new Map(rooms.map(q => [q.room, q]));
  const doors = [];
  for (const z of Z) for (const o of z.plan.openings || []) {
    if (o.type === 'window' || o.type === 'glass' || o.type === 'removable') continue;
    const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1); if (L < 0.1) continue;
    const nx = -(o.y2 - o.y1) / L, ny = (o.x2 - o.x1) / L, mx = (o.x1 + o.x2) / 2, my = (o.y1 + o.y2) / 2, off = (o.t || 0.3) / 2 + 1.2;
    const a = roomAt(mx + nx * off, my + ny * off), b = roomAt(mx - nx * off, my - ny * off);
    if (!a && !b) continue;
    const qa = a ? byRoom.get(a) : null, qb = b ? byRoom.get(b) : null;
    const pa = qa && qa.pressure != null ? qa.pressure : (a ? null : 0), pb = qb && qb.pressure != null ? qb.pressure : (b ? null : 0);
    if (pa == null || pb == null) { doors.push({ o, a, b, mx, my, nx, ny, dp: null }); continue; }
    const dp = pa - pb; // > 0: air flows from a's side to b's side (along -n)
    const ia = qa && qa.iso ? qa.iso : 10, ib = qb && qb.iso ? qb.iso : 10;
    let warn = null;
    if (Math.abs(dp) < 0.5) warn = 'no pressure difference';
    else if ((dp > 0 && ia > ib) || (dp < 0 && ib > ia)) warn = 'air flows from the less clean side into the cleaner room';
    else if (Math.abs(dp) < 5) warn = 'less than 5 Pa difference';
    doors.push({ o, a, b, mx, my, nx, ny, dp, warn });
  }
  // room types: class, air changes, pressure against the rooms next to it, sinks
  for (const q of rooms) {
    const RT = q.room.crType && ROOM_TYPES[q.room.crType]; q.typeIssues = []; if (!RT) continue;
    const I = q.typeIssues;
    if (RT.iso && (!q.iso || q.iso > RT.iso)) I.push(`needs ISO ${RT.iso} or cleaner${q.iso ? ' (set to ISO ' + q.iso + ')' : ' (set its ISO class)'}`);
    if (RT.ach && q.ach + 1e-6 < RT.ach) I.push(`needs at least ${RT.ach} air changes (has ${Math.round(q.ach)})`);
    const near = doors.filter(d => d.a === q.room || d.b === q.room).map(d => ({ other: d.a === q.room ? d.b : d.a, dp: d.dp == null ? null : (d.a === q.room ? d.dp : -d.dp) }));
    const nm = (r) => r ? (r.name || 'Room') : 'outside';
    if (q.pressure == null) { if (RT.p) I.push('set its pressure to check the cascade'); }
    else for (const n of near) {
      if (n.dp == null) continue;
      const pa = n.dp, inw = (v) => (v * PA_TO_INWC).toFixed(3) + '″';
      const uncl = !n.other || !n.other.iso || +n.other.iso >= 9;
      if (RT.p === 'pos' && (RT.posTo !== 'unclassified' || uncl) && pa < 5) I.push(`must be at least +5 Pa (+0.020″) over ${nm(n.other)} (is ${pa > 0 ? '+' : ''}${Math.round(pa * 10) / 10} Pa)`);
      if (RT.p === 'neg' && (pa > -2.5 || pa < -7.5)) I.push(`must be −2.5 to −7.5 Pa (−0.01 to −0.03″) to ${nm(n.other)} (is ${Math.round(pa * 10) / 10} Pa, ${inw(pa)})`);
      if (RT.p === 'grade') { const o = n.other && n.other.crType && ROOM_TYPES[n.other.crType]; const og = o && o.grade || 0; if (og < RT.grade && pa < 10) I.push(`must be at least 10 Pa over lower-grade ${nm(n.other)} (is ${Math.round(pa * 10) / 10} Pa)`); }
    }
    const sinks = (q.items || []).filter(it => it.type === 'handsink' || it.type === 'scrubsink').length;
    if (RT.sink === 'none' && sinks) I.push('no sink allowed in this room (move it to the ante room)');
    if (RT.sink === 'need' && !sinks) I.push('needs a hand-washing sink (Items → Sinks and gowning)');
    if (I.length) q.ok = false;
  }
  return { rooms, doors, targets: ISO_TARGETS, types: ROOM_TYPES };
}
/* Grid sections: parts of a generated ceiling laid out on their own grid, turned a quarter turn or shifted
   (plan.gridZones = [{ id, x0, y0, x1, y1, swap, ox, oy }]; ox/oy is where its lines start, unset = its corner).
   A later section wins where two overlap. Outside every section the ceiling keeps the main grid. */
const zoneBox = (q) => ({ x0: Math.min(q.x0, q.x1), x1: Math.max(q.x0, q.x1), z0: Math.min(q.y0, q.y1), z1: Math.max(q.y0, q.y1) });
function zoneGrid(q) { const b = zoneBox(q), sw = !!q.swap; return { ox: isFinite(q.ox) ? +q.ox : b.x0, oz: isFinite(q.oy) ? +q.oy : b.z0, cw: sw ? 4 : 2, cl: sw ? 2 : 4, swap: sw, zone: q }; }
function gridZoneAt(plan, x, z) { let r = null; if (plan && Array.isArray(plan.ceilRects) && plan.ceilRects.length) for (const q of plan.gridZones || []) { const b = zoneBox(q); if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) r = q; } return r; }
// the grid a fixture at (x, z) sits in
function gridAt(plan, x, z, A) { const q = gridZoneAt(plan, x, z); return q ? zoneGrid(q) : ceilingGrid(plan, A); }
// rectangles split by grid: [{ rects, G }], the main grid's part first
function gridPieces(plan, rects, G0) {
  const Z = (plan && Array.isArray(plan.ceilRects) && plan.ceilRects.length ? plan.gridZones || [] : []).filter(q => Math.abs(q.x1 - q.x0) > 0.5 && Math.abs(q.y1 - q.y0) > 0.5);
  const out = [{ rects: subtractRects(rects, Z.map(zoneBox)), G: G0 || ceilingGrid(plan) }];
  Z.forEach((q, i) => out.push({ rects: subtractRects(clipRects(rects, zoneBox(q)), Z.slice(i + 1).map(zoneBox)), G: zoneGrid(q) }));
  return out.filter(p => p.rects.length);
}
// the T-grid lines of one grid inside some rectangles: the grid's own lines only (the rectangles are just how
// the ceiling's outline is stored; their edges aren't tees). Lines along the same grid line are joined.
function gridLinesIn(rects, G) {
  const out = [];
  for (const [x0, z0, x1, z1] of rects) {
    for (let x = G.ox + Math.ceil((x0 - G.ox) / G.cw - 1e-6) * G.cw; x <= x1 + 1e-6; x += G.cw) out.push([x, z0, x, z1]);
    for (let z = G.oz + Math.ceil((z0 - G.oz) / G.cl - 1e-6) * G.cl; z <= z1 + 1e-6; z += G.cl) out.push([x0, z, x1, z]);
  }
  return joinLines(out);
}
// lines lying on the same straight line and overlapping or touching, joined into one
function joinLines(lines) {
  const by = new Map(), out = [];
  for (const q of lines) {
    const v = Math.abs(q[0] - q[2]) < 1e-6, h = Math.abs(q[1] - q[3]) < 1e-6; if (!v && !h) { out.push(q); continue; }
    const key = (v ? 'v' : 'h') + Math.round((v ? q[0] : q[1]) * 96), a = v ? Math.min(q[1], q[3]) : Math.min(q[0], q[2]), b = v ? Math.max(q[1], q[3]) : Math.max(q[0], q[2]);
    (by.get(key) || by.set(key, []).get(key)).push([a, b, v ? q[0] : q[1], v]);
  }
  for (const L of by.values()) {
    L.sort((p, q) => p[0] - q[0]); let cur = null;
    const put = (c) => { if (c[1] - c[0] > 0.05) out.push(c[3] ? [c[2], c[0], c[2], c[1]] : [c[0], c[2], c[1], c[2]]); };
    for (const s of L) { if (cur && s[0] <= cur[1] + 0.02) cur[1] = Math.max(cur[1], s[1]); else { if (cur) put(cur); cur = s.slice(); } }
    if (cur) put(cur);
  }
  return out;
}
// the open edges of a ceiling (where it stops in mid-air, not at a wall: an area boxed in by hand, or a grid
// section's border): those get a tee; edges along a wall get the wall angle, not a tee
function openEdges(rects, A) {
  const out = [], e = 0.02;
  const covered = (x, z) => rects.some(r => x > r[0] - 1e-6 && x < r[2] + 1e-6 && z > r[1] - 1e-6 && z < r[3] + 1e-6);
  for (const [x0, z0, x1, z1] of rects) {
    const sides = [[x0, z0, x1, z0, 0, -1], [x0, z1, x1, z1, 0, 1], [x0, z0, x0, z1, -1, 0], [x1, z0, x1, z1, 1, 0]];
    for (const [ax, az, bx, bz, nx, nz] of sides) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.25)); let st = null;
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const open = k < n && !covered(x + nx * e, z + nz * e) && !A.pieces.some(p => segDist(x, z, p.x1, p.z1, p.x2, p.z2) < (p.t || 0.25) / 2 + 0.75) && !A.opInfo.some(i => segDist(x, z, i.o.x1, i.o.y1, i.o.x2, i.o.y2) < (i.t || 0.25) / 2 + 0.75);
        if (open && st === null) st = t;
        if (!open && st !== null) { if ((t - st) * L > 0.5) out.push([ax + (bx - ax) * st, az + (bz - az) * st, ax + (bx - ax) * t, az + (bz - az) * t]); st = null; }
      }
    }
  }
  return joinLines(out);
}
// every T-grid line of a generated ceiling, each grid section on its own grid, fitted to the fixtures
function generatedGridLines(plan, A) {
  if (isBuilt(plan)) return builtLines(plan);
  if (!(Array.isArray(plan.ceilRects) && plan.ceilRects.length)) return null;
  A = A || analyze(plan);
  const R = ceilingRects(plan, footprint(A), A), out = [];
  for (const p of gridPieces(plan, R)) { for (const q of gridLinesIn(p.rects, p.G)) out.push(q); for (const q of openEdges(p.rects, A)) out.push(q); }
  const F = fixtureFrames(plan, A, R);
  // tees stop at walls: no tee runs through a wall from one room into the next
  const wallBoxes = A.pieces.filter(p => Math.abs(p.x1 - p.x2) < 1e-3 || Math.abs(p.z1 - p.z2) < 1e-3).map(p => { const h = (p.t || 0.25) / 2; return [Math.min(p.x1, p.x2) - h, Math.min(p.z1, p.z2) - h, Math.max(p.x1, p.x2) + h, Math.max(p.z1, p.z2) + h]; });
  return cutByFixtures(cutByFixtures(joinLines(out), wallBoxes), F.fx).concat(F.lines);
}
/* The tees a fixture needs when it isn't sitting in whole grid cells (placed by hand off the grid lines, turned
   across the grid, or a 2 × 2 in a 2 × 4 cell): one along each of its four edges, each running on to the nearest
   grid line either side so it lands on a tee; the tiles around it are cut to fit. No tee runs across a fixture.
   Returns { fx: the fixtures' boxes [x0, z0, x1, z1], lines: the frame tees, cut where they cross fixtures }. */
function fixtureFrames(plan, A, R) {
  A = A || analyze(plan);
  if (!R) { const fp = footprint(A); R = fp ? ceilingRects(plan, fp, A) : []; }
  let FX = []; try { FX = ceilingFixtures(plan, A); } catch (e) { FX = []; }
  // a built ceiling: the pieces around each fixture are laid to fit it, so it needs no frame of its own
  if (isBuilt(plan)) return { fx: FX.map(f => { const w = nomSize(f.w || 2), h = nomSize(f.h || 4); return [f.x - w / 2, f.y - h / 2, f.x + w / 2, f.y + h / 2]; }), lines: [] };
  const on = (v, o, sp) => { const d = Math.abs(v - o) % sp; return Math.min(d, sp - d) < 0.03; };
  const prev = (v, o, sp) => (on(v, o, sp) ? v : o + Math.floor((v - o) / sp) * sp), next = (v, o, sp) => (on(v, o, sp) ? v : o + Math.ceil((v - o) / sp) * sp);
  // a tee clipped to the ceiling (it never runs into a wall)
  const clip = (l) => {
    const out = [], vert = Math.abs(l[0] - l[2]) < 1e-6;
    for (const [x0, z0, x1, z1] of R) {
      if (vert) { if (l[0] < x0 - 1e-6 || l[0] > x1 + 1e-6) continue; const a = Math.max(Math.min(l[1], l[3]), z0), b = Math.min(Math.max(l[1], l[3]), z1); if (b - a > 0.05) out.push([l[0], a, l[0], b]); }
      else { if (l[1] < z0 - 1e-6 || l[1] > z1 + 1e-6) continue; const a = Math.max(Math.min(l[0], l[2]), x0), b = Math.min(Math.max(l[0], l[2]), x1); if (b - a > 0.05) out.push([a, l[1], b, l[1]]); }
    }
    return out;
  };
  const fx = [], lines = [];
  for (const f of FX) {
    const G = gridAt(plan, f.x, f.y, A); if (!G || G.fromLines) continue;
    // a fixture's nominal size (a 23.6″ × 47.6″ FFU is a 2′ × 4′ in the grid), so its frame sits on the grid lines
    const nom = (v) => (Math.abs(v - Math.round(v)) < 0.2 ? Math.round(v) : v);
    const w = nom(f.w || (G.swap ? 4 : 2)), h = nom(f.h || (G.swap ? 2 : 4)), x0 = f.x - w / 2, x1 = f.x + w / 2, z0 = f.y - h / 2, z1 = f.y + h / 2;
    if (!R.some(r => f.x > r[0] && f.x < r[2] && f.y > r[1] && f.y < r[3])) continue;
    fx.push([x0, z0, x1, z1]);
    const on2 = (v, o, sp) => { const d = Math.abs(v - o) % sp; return Math.min(d, sp - d) < 0.06; };
    if (on2(x0, G.ox, G.cw) && on2(x1, G.ox, G.cw) && on2(z0, G.oz, G.cl) && on2(z1, G.oz, G.cl)) continue;
    const ax0 = prev(x0, G.ox, G.cw), ax1 = next(x1, G.ox, G.cw), az0 = prev(z0, G.oz, G.cl), az1 = next(z1, G.oz, G.cl);
    for (const l of [[ax0, z0, ax1, z0], [ax0, z1, ax1, z1], [x0, az0, x0, az1], [x1, az0, x1, az1]]) lines.push(...clip(l));
  }
  return { fx, lines: cutByFixtures(lines, fx) };
}
// lines with the parts that run across a fixture taken out (lines along a fixture's edge stay: it sits on them)
function cutByFixtures(lines, fx) {
  if (!fx.length) return lines;
  const e = 0.03; let out = lines;
  for (const [x0, z0, x1, z1] of fx) {
    const nx = [];
    for (const l of out) {
      const vert = Math.abs(l[0] - l[2]) < 1e-6, horiz = Math.abs(l[1] - l[3]) < 1e-6;
      if (vert && l[0] > x0 + e && l[0] < x1 - e) {
        const a = Math.min(l[1], l[3]), b = Math.max(l[1], l[3]);
        if (b <= z0 || a >= z1) { nx.push(l); continue; }
        if (z0 - a > 0.05) nx.push([l[0], a, l[0], z0]); if (b - z1 > 0.05) nx.push([l[0], z1, l[0], b]);
      } else if (horiz && l[1] > z0 + e && l[1] < z1 - e) {
        const a = Math.min(l[0], l[2]), b = Math.max(l[0], l[2]);
        if (b <= x0 || a >= x1) { nx.push(l); continue; }
        if (x0 - a > 0.05) nx.push([a, l[1], x0, l[1]]); if (b - x1 > 0.05) nx.push([x1, l[1], b, l[1]]);
      } else nx.push(l);
    }
    out = nx;
  }
  return out;
}
/* The spaces a generated ceiling can go in: every closed-off space of the plan (all walls, with gaps of up to
   20′ between cleanroom wall ends closed), labelled rooms first. Returns { P, A, G, comp, found, at, hardShare }:
   found = [{ id, room, cells }] on the footprint grid G; at(x, z) = the grid cell under a point. */
function ceilingSpaceData(plan) {
    const P = plan, A = analyze(P); if (A.empty || !A.hardAny) return null;
    const R = roomRegions(A, P, true), G = R.grid; if (!G) return null;
    const N = G.wall.length, wall = G.wall.slice();
    const stampLine = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(L / (G.cell / 2))); for (let q = 0; q <= n; q++) { const x = ax + (bx - ax) * q / n, z = az + (bz - az) * q / n, i = Math.floor((x - G.x0) / G.cell), j = Math.floor((z - G.z0) / G.cell); for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < G.nx && jj < G.nz) wall[jj * G.nx + ii] = 1; } } };
    // cleanroom wall ends that don't meet another wall or a door
    const HW = A.walls.filter(w => isHard(w) && Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 0.3), ends = [];
    for (const w of HW) for (const [x, z] of [[w.x1, w.y1], [w.x2, w.y2]]) {
      if (A.walls.some(o => o !== w && segDist(x, z, o.x1, o.y1, o.x2, o.y2) < Math.max(w.t || 0.25, o.t || 0.25) * 0.8 + 0.1)) continue;
      if (A.opInfo.some(i => Math.min(Math.hypot(i.o.x1 - x, i.o.y1 - z), Math.hypot(i.o.x2 - x, i.o.y2 - z)) < 0.4)) continue;
      ends.push({ x, z, w });
    }
    const crossesWall = (a, b) => A.walls.some(w => {
      if (w === a.w || w === b.w) return false;
      const d1x = b.x - a.x, d1z = b.z - a.z, d2x = w.x2 - w.x1, d2z = w.y2 - w.y1, den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-9) return false;
      const s1 = ((w.x1 - a.x) * d2z - (w.y1 - a.z) * d2x) / den, s2 = ((w.x1 - a.x) * d1z - (w.y1 - a.z) * d1x) / den;
      return s1 > 0.02 && s1 < 0.98 && s2 > 0 && s2 < 1;
    });
    // Close a wall that's missing from the drawing, only where it plainly belongs: two wall ends on one straight
    // line facing each other (up to 16′ apart), or two walls at a right angle that would meet at a corner if both
    // ran on (up to 16′ each). Ends that merely sit near each other across an aisle between rooms are left open,
    // so the aisles between cleanroom boxes stay outside the ceiling.
    const virt = [], done = new Set(), shut = new Set();
    const dirOf = (e) => { const w = e.w, L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, far = Math.hypot(w.x1 - e.x, w.y1 - e.z) < 1e-6 ? [w.x2, w.y2] : [w.x1, w.y1]; return [(e.x - far[0]) / L, (e.z - far[1]) / L]; };
    const close = (pts) => { for (let q = 0; q + 1 < pts.length; q++) { stampLine(pts[q][0], pts[q][1], pts[q + 1][0], pts[q + 1][1]); virt.push({ x1: pts[q][0], z1: pts[q][1], x2: pts[q + 1][0], z2: pts[q + 1][1], r: G.cell * 2, hard: true }); } };
    const clear = (a, b, skip) => !A.walls.some(w => {
      if (skip.includes(w)) return false;
      const d1x = b[0] - a[0], d1z = b[1] - a[1], d2x = w.x2 - w.x1, d2z = w.y2 - w.y1, den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-9) return false;
      const s1 = ((w.x1 - a[0]) * d2z - (w.y1 - a[1]) * d2x) / den, s2 = ((w.x1 - a[0]) * d1z - (w.y1 - a[1]) * d1x) / den;
      return s1 > 0.02 && s1 < 0.98 && s2 > 0 && s2 < 1;
    });
    ends.forEach((e, ia) => {
      const [ux, uz] = dirOf(e); let best = null;
      ends.forEach((f, ib) => {
        if (ib === ia || f.w === e.w) return;
        const [vx, vz] = dirOf(f), dx = f.x - e.x, dz = f.z - e.z, d = Math.hypot(dx, dz);
        if (d < 0.3) return;
        const along = dx * ux + dz * uz, lat = Math.abs(-dx * uz + dz * ux);
        // in line, facing each other
        if (Math.abs(ux * vz - uz * vx) < 0.05 && ux * vx + uz * vz < -0.95 && lat < 0.35 && along > 0 && along <= 16) {
          if (clear([e.x, e.z], [f.x, f.z], [e.w, f.w]) && (!best || d < best.d)) best = { d, ib, pts: [[e.x, e.z], [f.x, f.z]] };
          return;
        }
        // a corner: both run on to where their lines cross
        if (Math.abs(ux * vx + uz * vz) < 0.05) {
          const den = ux * vz - uz * vx; if (Math.abs(den) < 1e-6) return;
          const t = (dx * vz - dz * vx) / den, s2 = (dx * uz - dz * ux) / den; // e + u t = f + v s2
          if (t > 0.2 && t <= 16 && -s2 > -0.05 && -s2 <= 16) {
            const X = [e.x + ux * t, e.z + uz * t];
            if (clear([e.x, e.z], X, [e.w, f.w]) && clear(X, [f.x, f.z], [e.w, f.w]) && (!best || t - s2 < best.d)) best = { d: t - s2, ib, pts: [[e.x, e.z], X, [f.x, f.z]] };
          }
        }
      });
      if (!best) return; const key = Math.min(ia, best.ib) + '-' + Math.max(ia, best.ib); if (done.has(key)) return; done.add(key);
      close(best.pts); shut.add(e); shut.add(ends[best.ib]);
    });
    // an open bay: a room with three walls, its fourth side open (onto a corridor or the warehouse). Its two side
    // walls run the same way from one back wall; the open side between their ends is closed (9' to 30' wide).
    const backWall = (w, x, z) => A.walls.find(o => o !== w && isHard(o) && segDist(x, z, o.x1, o.y1, o.x2, o.y2) < Math.max(w.t || 0.25, o.t || 0.25) + 0.3 && Math.abs(((w.x2 - w.x1) * (o.x2 - o.x1) + (w.y2 - w.y1) * (o.y2 - o.y1)) / ((Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1) * (Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1))) < 0.1);
    // (a side wall's end can be a corner too, where a short return or the next room's wall meets it)
    const sideEnds = ends.concat(HW.flatMap(w => [[w.x1, w.y1], [w.x2, w.y2]].filter(([x, z]) => !ends.some(q => q.w === w && Math.hypot(q.x - x, q.z - z) < 1e-6)).map(([x, z]) => ({ x, z, w }))));
    for (const e of sideEnds) {
      if (shut.has(e)) continue;
      const [ux, uz] = dirOf(e), w = e.w;
      // something already carries on past this end in line: not an open side
      if (A.walls.some(o => o !== w && segDist(e.x + ux * 0.6, e.z + uz * 0.6, o.x1, o.y1, o.x2, o.y2) < (o.t || 0.25) / 2 + 0.1)) continue;
      // the side wall can be drawn in pieces on one line: follow it back to its real end
      let far = Math.hypot(w.x1 - e.x, w.y1 - e.z) < 1e-6 ? [w.x2, w.y2] : [w.x1, w.y1], seen = new Set([w]);
      for (let step = 0; step < 20; step++) {
        const nx = A.walls.find(o => !seen.has(o) && isHard(o) && Math.abs(ux * (o.y2 - o.y1) - uz * (o.x2 - o.x1)) / (Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1) < 0.05 && Math.min(Math.hypot(o.x1 - far[0], o.y1 - far[1]), Math.hypot(o.x2 - far[0], o.y2 - far[1])) < 0.3);
        if (!nx) break; seen.add(nx);
        const a1 = (nx.x1 - far[0]) * ux + (nx.y1 - far[1]) * uz, a2 = (nx.x2 - far[0]) * ux + (nx.y2 - far[1]) * uz;
        far = a1 < a2 ? [nx.x1, nx.y1] : [nx.x2, nx.y2];
      }
      const back = backWall(w, far[0], far[1]) || A.walls.find(o => !seen.has(o) && isHard(o) && segDist(far[0], far[1], o.x1, o.y1, o.x2, o.y2) < (o.t || 0.25) + 0.3 && Math.abs(ux * (o.x2 - o.x1) + uz * (o.y2 - o.y1)) / (Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1) < 0.1);
      if (!back) continue;
      let best = null;
      for (const o of A.walls) {
        if (seen.has(o) || o === back || !isHard(o)) continue;
        const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1) || 1; if (Math.abs(ux * (o.y2 - o.y1) / L - uz * (o.x2 - o.x1) / L) > 0.05) continue;
        for (const [fx, fz, gx, gz] of [[o.x1, o.y1, o.x2, o.y2], [o.x2, o.y2, o.x1, o.y1]]) {
          const along = (fx - e.x) * ux + (fz - e.z) * uz, d = Math.abs(-(fx - e.x) * uz + (fz - e.z) * ux);
          // a bay is room-sized; a narrow slot between two rooms (an aisle, 6′ or so) isn't one
          if (Math.abs(along) > 1.5 || d < 9 || d > 30) continue;
          if ((gx - fx) * ux + (gz - fz) * uz > -2) continue; // its wall runs back the same way
          if (segDist(gx, gz, back.x1, back.y1, back.x2, back.y2) > Math.max(o.t || 0.25, back.t || 0.25) + 0.3) continue; // from the same back wall
          if (!clear([e.x, e.z], [fx, fz], [w, o])) continue;
          if (!best || d < best.d) best = { d, pts: [[e.x, e.z], [fx, fz]] };
        }
      }
      if (best) { close(best.pts); shut.add(e); }
    }
    // how much of a space's edge is cleanroom hardwall (doors and glass in hardwall, and the closed gaps, count),
    // not the building's shell: a warehouse aisle is edged by the shell and the cleanroom's outside
    // which cleanroom box each hardwall wall belongs to: walls that touch, or meet across a door, are one box
    const HWs = A.walls.filter(w => isHard(w)), par = new Map(HWs.map(w => [w, w])), find = (w) => { while (par.get(w) !== w) { par.set(w, par.get(par.get(w))); w = par.get(w); } return w; };
    const touch = (a, b) => { const r = ((a.t || 0.25) + (b.t || 0.25)) / 2 + 0.35; return segDist(a.x1, a.y1, b.x1, b.y1, b.x2, b.y2) < r || segDist(a.x2, a.y2, b.x1, b.y1, b.x2, b.y2) < r || segDist(b.x1, b.y1, a.x1, a.y1, a.x2, a.y2) < r || segDist(b.x2, b.y2, a.x1, a.y1, a.x2, a.y2) < r; };
    for (let i = 0; i < HWs.length; i++) for (let j = i + 1; j < HWs.length; j++) if (touch(HWs[i], HWs[j])) par.set(find(HWs[i]), find(HWs[j]));
    const hostOf = (x, z) => { let b = null, bd = 1.5; for (const w of HWs) { const d = segDist(x, z, w.x1, w.y1, w.x2, w.y2); if (d < bd) { bd = d; b = w; } } return b; };
    for (const i of A.opInfo) { if (!i.hard) continue; const a = hostOf(i.o.x1, i.o.y1), b = hostOf(i.o.x2, i.o.y2); if (a && b) par.set(find(a), find(b)); }
    const byId = new Map(HWs.map(w => [w.id, w]));
    const boxOf = (id) => { const w = byId.get(id); return w ? find(w) : null; };
    const edges = A.pieces.map(p => ({ x1: p.x1, z1: p.z1, x2: p.x2, z2: p.z2, r: (p.t || 0.25) / 2 + G.cell * 2, hard: p.hard !== false, box: p.hard ? boxOf(p.id) : null }))
      .concat(A.opInfo.map(i => { const h = i.hard ? hostOf((i.o.x1 + i.o.x2) / 2, (i.o.y1 + i.o.y2) / 2) : null; return { x1: i.o.x1, z1: i.o.y1, x2: i.o.x2, z2: i.o.y2, r: (i.t || 0.25) / 2 + G.cell * 2, hard: i.hard !== false, box: h ? find(h) : null }; }), virt);
    // the share of a space's walls that belong to one box: a room inside a box is walled by that box alone; an
    // aisle or corridor between separate boxes is walled by several
    const oneBox = (cells) => {
      const cnt = new Map(); let n = 0;
      for (const k of cells) {
        const i = k % G.nx, j = (k - i) / G.nx;
        if (![k - 1, k + 1, k - G.nx, k + G.nx].some(q => q < 0 || q >= N || wall[q] || !G.inside[q])) continue;
        const x = G.x0 + (i + 0.5) * G.cell, z = G.z0 + (j + 0.5) * G.cell;
        let best = null, bd = 1e9; for (const e of edges) { const d = segDist(x, z, e.x1, e.z1, e.x2, e.z2) - e.r; if (d < bd) { bd = d; best = e; } }
        if (best && bd < G.cell * 2 && best.box) { n++; cnt.set(best.box, (cnt.get(best.box) || 0) + 1); }
      }
      if (!n) return { share: 1, box: null };
      let box = null, bn = -1; for (const [b, c] of cnt) if (c > bn) { bn = c; box = b; }
      return { share: bn / n, box };
    };
    // boxes fastened to the building's walls (offices, restrooms) versus cleanroom boxes standing free in it
    const shellWalls = A.walls.filter(w => !isHard(w) && !isFrame(w)), shellBox = new Set();
    for (const w of HWs) if (shellWalls.some(o => touch(w, o))) shellBox.add(find(w));
    const freeBox = HWs.some(w => !shellBox.has(find(w)));
    // how many feet of a space's edge run along the building's shell (a warehouse wall, not the cleanroom's own)
    const shellFeet = (cells) => {
      let n = 0;
      for (const k of cells) {
        const i = k % G.nx, j = (k - i) / G.nx;
        if (![k - 1, k + 1, k - G.nx, k + G.nx].some(q => q < 0 || q >= N || wall[q] || !G.inside[q])) continue;
        const x = G.x0 + (i + 0.5) * G.cell, z = G.z0 + (j + 0.5) * G.cell;
        let best = null, bd = 1e9; for (const e of edges) { const d = segDist(x, z, e.x1, e.z1, e.x2, e.z2) - e.r; if (d < bd) { bd = d; best = e; } }
        if (best && bd < G.cell * 2 && !best.hard) n++;
      }
      return n * G.cell;
    };
    const hardShare = (cells) => {
      let h = 0, n = 0;
      for (const k of cells) {
        const i = k % G.nx, j = (k - i) / G.nx;
        if (![k - 1, k + 1, k - G.nx, k + G.nx].some(q => q < 0 || q >= N || wall[q] || !G.inside[q])) continue;
        const x = G.x0 + (i + 0.5) * G.cell, z = G.z0 + (j + 0.5) * G.cell;
        let best = null, bd = 1e9; for (const e of edges) { const d = segDist(x, z, e.x1, e.z1, e.x2, e.z2) - e.r; if (d < bd) { bd = d; best = e; } }
        if (best && bd < G.cell * 2) { n++; if (best.hard) h++; }
      }
      return n ? h / n : 0;
    };
    // the spaces, labelled rooms first so they carry their names
    const comp = new Int32Array(N).fill(-1); let id = 0;
    const fill = (k0) => { const st = [k0], cells = []; comp[k0] = id; while (st.length) { const u = st.pop(), a = u % G.nx; cells.push(u); for (const v of [a > 0 ? u - 1 : -1, a < G.nx - 1 ? u + 1 : -1, u - G.nx, u + G.nx]) if (v >= 0 && v < N && comp[v] < 0 && G.inside[v] && !wall[v]) { comp[v] = id; st.push(v); } } return cells; };
    const at = (x, z) => { const i = Math.floor((x - G.x0) / G.cell), j = Math.floor((z - G.z0) / G.cell); return i < 0 || j < 0 || i >= G.nx || j >= G.nz ? -1 : j * G.nx + i; };
    const found = [];
    for (const room of P.rooms || []) {
      let k = at(room.x, room.y); if (k < 0) continue;
      if (wall[k] || !G.inside[k]) { const nb = [k - 1, k + 1, k - G.nx, k + G.nx, k - G.nx - 1, k - G.nx + 1, k + G.nx - 1, k + G.nx + 1].find(q => q >= 0 && q < N && !wall[q] && G.inside[q]); if (nb == null) continue; k = nb; }
      if (comp[k] >= 0) { const f = found.find(q => q.id === comp[k]); if (f && !f.room) f.room = room; continue; }
      found.push({ id, room, cells: fill(k) }); id++;
    }
    for (let k = 0; k < N; k++) { if (comp[k] >= 0 || !G.inside[k] || wall[k]) continue; found.push({ id, room: null, cells: fill(k) }); id++; }
    // inside the cleanroom: what the cleanroom's own walls (hardwall, its doors and glass, and the closed gaps)
    // wall in, with the building's shell left out. A space that runs out past them (a room missing a wall in the
    // drawing, opening onto the warehouse) only gets ceiling over the part inside the cleanroom.
    // a wall that stops a little short of another wall's side (up to 3') plainly meets it
    const short = [];
    for (const e of ends) {
      let best = null, bd = 3;
      for (const w of HWs) { if (w === e.w) continue; const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, t = Math.max(0, Math.min(1, ((e.x - w.x1) * (w.x2 - w.x1) + (e.z - w.y1) * (w.y2 - w.y1)) / (L * L))), px = w.x1 + (w.x2 - w.x1) * t, pz = w.y1 + (w.y2 - w.y1) * t, d = Math.hypot(px - e.x, pz - e.z); if (d > 0.05 && d < bd) { bd = d; best = [px, pz]; } }
      if (best) short.push({ x1: e.x, z1: e.z, x2: best[0], z2: best[1] });
    }
    // looser: any two loose wall ends up to 10' apart (a doorway with no door drawn, a wider missing piece)
    const loose = [];
    ends.forEach((e, ia) => ends.forEach((f, ib) => { if (ib <= ia || f.w === e.w) return; const d = Math.hypot(f.x - e.x, f.z - e.z); if (d > 0.3 && d <= 10 && !crossesWall(e, f)) loose.push({ x1: e.x, z1: e.z, x2: f.x, z2: f.z }); }));
    // inside the cleanroom: what its own walls (hardwall, its doors and glass, and the closed gaps) wall in, with
    // the building's shell left out
    const makeHull = (extra) => {
      const bar = new Uint8Array(N), hull = new Uint8Array(N);
      const band = (ax, az, bx, bz, r) => {
        const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(L / (G.cell / 2))), rr = Math.max(1, Math.ceil(r / G.cell));
        for (let q = 0; q <= n; q++) { const x = ax + (bx - ax) * q / n, z = az + (bz - az) * q / n, i = Math.floor((x - G.x0) / G.cell), j = Math.floor((z - G.z0) / G.cell); for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < G.nx && jj < G.nz) bar[jj * G.nx + ii] = 1; } }
      };
      for (const p of A.pieces) if (p.hard) band(p.x1, p.z1, p.x2, p.z2, (p.t || 0.25) / 2);
      for (const i of A.opInfo) if (i.hard) band(i.o.x1, i.o.y1, i.o.x2, i.o.y2, (i.t || 0.25) / 2);
      for (const v of virt.concat(short, extra)) band(v.x1, v.z1, v.x2, v.z2, G.cell);
      const outside = new Uint8Array(N), st = [];
      const push = (k) => { if (!bar[k] && !outside[k]) { outside[k] = 1; st.push(k); } };
      for (let i = 0; i < G.nx; i++) { push(i); push((G.nz - 1) * G.nx + i); }
      for (let j = 0; j < G.nz; j++) { push(j * G.nx); push(j * G.nx + G.nx - 1); }
      while (st.length) { const u = st.pop(), a = u % G.nx; if (a > 0) push(u - 1); if (a < G.nx - 1) push(u + 1); if (u >= G.nx) push(u - G.nx); if (u + G.nx < N) push(u + G.nx); }
      // the wall bands themselves belong to the side they face: peel them back from the outside so nothing outside
      // a wall (a strip along the warehouse side) counts as in
      for (let pass = 0; pass < 4; pass++) {
        const peel = [];
        for (let k = 0; k < N; k++) { if (outside[k] || !bar[k]) continue; const a = k % G.nx; if ((a > 0 && outside[k - 1]) || (a < G.nx - 1 && outside[k + 1]) || (k >= G.nx && outside[k - G.nx]) || (k + G.nx < N && outside[k + G.nx])) peel.push(k); }
        if (!peel.length) break; for (const k of peel) outside[k] = 1;
      }
      for (let k = 0; k < N; k++) hull[k] = outside[k] ? 0 : 1;
      return hull;
    };
    const hull = makeHull([]), hullLoose = makeHull(loose);
    // where the cleanroom's own walls (and their doors) are, cell by cell
    const hardBar = new Uint8Array(N);
    { const band = (ax, az, bx, bz, r) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(L / (G.cell / 2))), rr = Math.max(1, Math.ceil(r / G.cell)); for (let q = 0; q <= n; q++) { const x = ax + (bx - ax) * q / n, z = az + (bz - az) * q / n, i = Math.floor((x - G.x0) / G.cell), j = Math.floor((z - G.z0) / G.cell); for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < G.nx && jj < G.nz) hardBar[jj * G.nx + ii] = 1; } } };
      for (const p of A.pieces) if (p.hard) band(p.x1, p.z1, p.x2, p.z2, (p.t || 0.25) / 2);
      for (const i of A.opInfo) if (i.hard) band(i.o.x1, i.o.y1, i.o.x2, i.o.y2, (i.t || 0.25) / 2); }
    return { P, A, G, comp, found, at, hardShare, hull, hullLoose, hardBar, boxAt: (x, z) => { const w = hostOf(x, z); return w ? find(w) : null; }, shellFeet, oneBox, shellBox, freeBox };
}
/* A space's cells as rectangles, grown half a cell so they meet the walls. */
function cellRects(g, cells) {
  const out = [], rows = new Map();
  for (const k of cells) { const i = k % g.nx, j = (k - i) / g.nx; (rows.get(j) || rows.set(j, []).get(j)).push(i); }
  const open = new Map(), js = [...rows.keys()].sort((a, b) => a - b);
  const close = (r) => out.push([g.x0 + (r.a - 0.5) * g.cell, g.z0 + (r.j0 - 0.5) * g.cell, g.x0 + (r.b + 1.5) * g.cell, g.z0 + (r.j1 + 1.5) * g.cell].map(v => +v.toFixed(3)));
  for (const j of js) {
    const is = rows.get(j).sort((a, b) => a - b), now = new Set();
    for (let q = 0; q < is.length;) { let e = q; while (e + 1 < is.length && is[e + 1] === is[e] + 1) e++; const key = is[q] + ',' + is[e]; now.add(key); const r = open.get(key); if (r && r.j1 === j - 1) r.j1 = j; else { if (r) close(r); open.set(key, { a: is[q], b: is[e], j0: j, j1: j }); } q = e + 1; }
    for (const [key, r] of [...open]) if (!now.has(key)) { close(r); open.delete(key); }
  }
  for (const r of open.values()) close(r);
  return out;
}
/* The closed-off space under a point, as rectangles (for the Grid tool's click to add or take off ceiling). */
function ceilingSpaceAt(plan, x, z) {
  const D = ceilingSpaceData(plan); if (!D) return null;
  const k = D.at(x, z); if (k < 0 || D.comp[k] < 0) return null;
  const f = D.found.find(q => q.id === D.comp[k]); if (!f) return null;
  // the part the cleanroom's walls close in (a room missing a wall would otherwise run out into the warehouse)
  let inner = f.cells.filter(q => D.hull[q]); if (inner.length < f.cells.length * 0.5) { const c2 = f.cells.filter(q => D.hullLoose[q]); if (c2.length > inner.length) inner = c2; }
  const A2 = inner.length * D.G.cell * D.G.cell;
  return { rects: cellRects(D.G, f.cells), inner: A2 >= 16 ? cellRects(D.G, inner) : [], open: A2 < Math.max(16, f.cells.length * D.G.cell * D.G.cell * 0.5), room: f.room, area: f.cells.length * D.G.cell * D.G.cell };
}
/* Generate a ceiling for the cleanroom (the main building, every ceiling height in it): a 2′ × 4′ grid centred
   in the biggest room so the cut tiles at its two walls match, then per room enough FFUs for its cleanroom class
   (air changes and FFU coverage, from the room's own class or opts.iso) and about one light per opts.sqftPerLight,
   each spread evenly over the whole cells that are clear of walls, chases and ceiling-area edges.
   opts: { iso, sqftPerLight, swap }. Returns { ceilGrid, fixtures, rooms: [{ name, area, iso, ffu, led, need, cells }] }. */
function generateCeiling(plan, opts) {
  opts = opts || {};
  const uid = () => Math.random().toString(36).slice(2, 10);
  let swap = opts.swap != null ? !!opts.swap : !!(plan.ceilGrid && isFinite(plan.ceilGrid.ox) ? plan.ceilGrid.swap : plan.ceilSwap);
  // opts.keep: the FFUs and lights already placed stay as they are; the grid is lined up with them and the
  // ceiling laid around them (new lights only go in cells left free, and only with opts.addLights)
  const keep = !!opts.keep, EX = keep ? (plan.fixtures || []).filter(f => f && isFinite(f.x) && isFinite(f.y) && f.w > 0 && f.h > 0) : [];
  const EF = EX.filter(f => f.type === 'ffu');
  if (keep) { const wide = EF.filter(f => f.w > f.h + 0.1).length, tall = EF.filter(f => f.h > f.w + 0.1).length; if (wide !== tall) swap = wide > tall; }
  const cw = swap ? 4 : 2, cl = swap ? 2 : 4;
  const FM = plan.ffuModel && Array.isArray(plan.ffuModel.sizes) && plan.ffuModel.sizes.length ? plan.ffuModel : null;
  const z24 = FM ? (FM.sizes.find(q => q.nominal === '2x4') || FM.sizes[0]) : null, cfm = z24 && z24.cfm > 0 ? z24.cfm : 8 * 90;
  // every space inside the cleanroom walls: labelled rooms, then any unlabelled space. Found on the whole plan
  // (all its walls at once); each room's ceiling height comes from its label. Gaps of up to 20′ between
  // cleanroom wall ends (a wall missing from an imported drawing) count as closed here, so a room isn't lost
  // to the warehouse through them. A room label can say what its ceiling gets: room.ceil = 'always' (a ceiling
  // even if it isn't walled in by hardwall), 'lights' (grid and lights, no FFUs) or 'none' (no ceiling).
  const spaces = [], D = ceilingSpaceData(plan); if (!D) return null;
  let skippedOffices = 0, openRooms = 0;
  {
    const { P, A, G, comp, found, at, hardShare, hull, hullLoose, shellFeet, oneBox, shellBox, freeBox } = D;
    // spaces clicked with the Grid tool: ceiling taken off (plan.ceilSkip) or put on (plan.ceilForce)
    const holds = (f, pts) => (pts || []).some(q => { const k = at(q.x, q.y); return k >= 0 && comp[k] === f.id; });
    for (const f of found) {
      if (holds(f, P.ceilSkip)) continue;
      const mine = keep && holds(f, EX.map(q => ({ x: q.x, y: q.y })));
      const mode = holds(f, P.ceilForce) || mine ? 'always' : f.room && f.room.ceil ? f.room.ceil : 'auto';
      // the ceiling stays inside the cleanroom's walls: only a space put on by hand with the Grid tool, or a
      // room label set to always get one, can reach past them
      // only what the cleanroom's own walls close in gets ceiling: an aisle between boxes, a warehouse strip or a
      // room missing a wall (so it opens onto the warehouse) is cut back to the part that is closed in
      const forced = holds(f, P.ceilForce) || (f.room && f.room.ceil === 'always');
      // closed in by its walls; failing that (a doorway with no door drawn, a missing piece) by its walls with the
      // loose ends up to 10' apart joined; a room that's still open gets none (the result says so)
      let H0 = hull, cells = f.cells.filter(k => hull[k]);
      if (cells.length < f.cells.length * 0.5) { const c2 = f.cells.filter(k => hullLoose[k]); if (c2.length > cells.length) { cells = c2; H0 = hullLoose; } }
      // FFUs placed in a room that isn't closed in (an open bay, a missing wall): ceiling over the room they're
      // in, found by running out from the FFUs to the nearest cleanroom wall on each side (up to 12′)
      if (mine) {
        const inF = EX.filter(q => { const k = at(q.x, q.y); return k >= 0 && comp[k] === f.id; });
        const cset = new Set(cells), covered = inF.filter(q => { const k = at(q.x, q.y); return k >= 0 && cset.has(k); }).length;
        if (covered < inF.length * 0.6) {
          const mask = new Uint8Array(H0.length), HW = A.walls.filter(w => isHard(w));
          const groups = []; for (const q of inF) { const g2 = groups.find(g => q.x > g[0] - 6 && q.x < g[2] + 6 && q.y > g[1] - 6 && q.y < g[3] + 6); const b = [q.x - q.w / 2, q.y - q.h / 2, q.x + q.w / 2, q.y + q.h / 2]; if (g2) { g2[0] = Math.min(g2[0], b[0]); g2[1] = Math.min(g2[1], b[1]); g2[2] = Math.max(g2[2], b[2]); g2[3] = Math.max(g2[3], b[3]); } else groups.push(b); }
          for (const [x0, z0, x1, z1] of groups) {
            const reach = (side) => {
              let best = null;
              for (const w of HW) {
                const vert = Math.abs(w.x2 - w.x1) < 0.2, horiz = Math.abs(w.y2 - w.y1) < 0.2;
                if ((side === 'L' || side === 'R') && vert) { const x = (w.x1 + w.x2) / 2, a = Math.max(Math.min(w.y1, w.y2), z0), b = Math.min(Math.max(w.y1, w.y2), z1); if (b - a < (z1 - z0) * 0.3) continue; const d = side === 'L' ? x0 - x : x - x1; if (d >= -0.1 && d <= 12 && (best === null || d < best)) best = d; }
                if ((side === 'T' || side === 'B') && horiz) { const z = (w.y1 + w.y2) / 2, a = Math.max(Math.min(w.x1, w.x2), x0), b = Math.min(Math.max(w.x1, w.x2), x1); if (b - a < (x1 - x0) * 0.3) continue; const d = side === 'T' ? z0 - z : z - z1; if (d >= -0.1 && d <= 12 && (best === null || d < best)) best = d; }
              }
              return best === null ? 1 : best;
            };
            const r = [x0 - reach('L'), z0 - reach('T'), x1 + reach('R'), z1 + reach('B')];
            for (let k = 0; k < mask.length; k++) { if (comp[k] !== f.id) continue; const i = k % G.nx, j = (k - i) / G.nx, x = G.x0 + (i + 0.5) * G.cell, z = G.z0 + (j + 0.5) * G.cell; if (x > r[0] && x < r[2] && z > r[1] && z < r[3]) mask[k] = 1; }
          }
          const c3 = f.cells.filter(k => mask[k] || cset.has(k));
          if (c3.length > cells.length) { for (const k of cells) mask[k] = 1; cells = c3; H0 = mask; }
        }
      }
      if (cells.length * G.cell * G.cell < 16 && (mine || f.room || forced)) openRooms++;
      // slivers (the gap inside a wall drawn as two lines, a strip beside a wall) aren't rooms
      { const set = new Set(cells), rr = Math.max(1, Math.round(1.5 / G.cell)); let roomy = false;
        for (const k of cells) { const i = k % G.nx, j = (k - i) / G.nx; let ok = true; for (let dj = -rr; dj <= rr && ok; dj += rr) for (let di = -rr; di <= rr && ok; di += rr) if (!set.has((j + dj) * G.nx + i + di)) ok = false; if (ok) { roomy = true; break; } }
        if (!roomy) continue; }
      if (mode === 'none' || cells.length * G.cell * G.cell < 16) continue;
      const share = hardShare(cells);
      // a labelled room needs half its edge to be hardwall, an unlabelled space nearly all of it
      if (mode !== 'always' && share < (f.room ? 0.5 : 0.85)) continue;
      // an aisle or corridor between separate cleanroom boxes isn't inside any of them
      const ob = oneBox(cells);
      if (!forced && !mine && ob.share < 0.8) continue;
      // in a warehouse with cleanroom boxes standing free, the rooms built onto the building's walls are offices
      if (!forced && !mine && freeBox && ob.box && shellBox.has(ob.box)) { skippedOffices++; continue; }
      spaces.push({ P, A, G, comp, id: f.id, room: f.room, cells, hull: H0, lightsOnly: mode === 'lights' });
    }
  }
  if (!spaces.length) return null;
  // The hallway joining the rooms: open floor with a ceiling room on one side and, straight across (7′–16′ of
  // floor), another room or the cleanroom's own wall. A slot narrower than 7′ between two rooms is an aisle
  // outside the cleanroom and stays bare; so does a strip along the building's own walls.
  if (!plan.noHall) {
    const { G, comp, hardBar } = D, N = G.nx * G.nz, ceil = new Uint8Array(N);
    // real walls only (the plan's footprint also draws guessed closing lines between wall ends; those are floor here)
    const shellBar = new Uint8Array(N);
    for (const p of D.A.pieces) { if (p.hard) continue; const L = Math.hypot(p.x2 - p.x1, p.z2 - p.z1), n = Math.max(2, Math.ceil(L / (G.cell / 2))), rr = Math.max(1, Math.ceil((p.t || 0.25) / 2 / G.cell)); for (let q = 0; q <= n; q++) { const x = p.x1 + (p.x2 - p.x1) * q / n, z = p.z1 + (p.z2 - p.z1) * q / n, i0 = Math.floor((x - G.x0) / G.cell), j0 = Math.floor((z - G.z0) / G.cell); for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) { const ii = i0 + di, jj = j0 + dj; if (ii >= 0 && jj >= 0 && ii < G.nx && jj < G.nz) shellBar[jj * G.nx + ii] = 1; } } }
    const isWall = (q) => hardBar[q] || shellBar[q];
    for (const sp of spaces) for (const k of sp.cells) ceil[k] = 1;
    // the hallway stays within the stretch the rooms cover (it doesn't wander off down an office corridor)
    let rx0 = 1e9, rz0 = 1e9, rx1 = -1e9, rz1 = -1e9;
    for (const sp of spaces) for (const k of sp.cells) { const i = k % G.nx, j = (k - i) / G.nx; rx0 = Math.min(rx0, i); rx1 = Math.max(rx1, i); rz0 = Math.min(rz0, j); rz1 = Math.max(rz1, j); }
    const pad = Math.round(0.5 / G.cell), within = (k) => { const i = k % G.nx, j = (k - i) / G.nx; return i >= rx0 - pad && i <= rx1 + pad && j >= rz0 - pad && j <= rz1 + pad; };
    const lim = Math.round(16 / G.cell), wallMax = Math.round(1.5 / G.cell), hall = new Uint8Array(N), shape = new Uint8Array(N);
    // from a cell, step one way: how far to the next wall, and what's past it (a ceiling room, or a cleanroom wall)
    const look = (k, di, dj) => {
      let i = k % G.nx, j = (k - i) / G.nx, n = 0;
      while (n <= lim) {
        i += di; j += dj; n++; if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) return null;
        const q = j * G.nx + i;
        if (ceil[q]) return { d: n, room: true };
        if (isWall(q)) {
          const hard = hardBar[q], box = hard ? D.boxAt(G.x0 + (i + 0.5) * G.cell, G.z0 + (j + 0.5) * G.cell) : null; let m = 0;
          // through the wall: a room straight behind it?
          while (m <= wallMax) { i += di; j += dj; m++; if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) break; const r2 = j * G.nx + i; if (ceil[r2]) return { d: n, room: true, box }; if (!isWall(r2)) break; }
          return hard ? { d: n, room: false, box } : null;
        }
      }
      return null;
    };
    for (let k = 0; k < N; k++) {
      if (ceil[k] || isWall(k) || !G.inside[k] || !within(k)) continue;
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        const a = look(k, di, dj); if (!a) continue; const b = look(k, -di, -dj); if (!b) continue;
        const w = (a.d + b.d - 1) * G.cell;
        // a room one side; across, another room or a wall of the same cleanroom (not a building wall that
        // happens to be drawn as hardwall)
        if ((a.room || b.room) && w >= 7 && w <= 16) {
          const r = a.room ? a : b, o = a.room ? b : a;
          // a room each side; or a room one side and, across, a wall of that same cleanroom (or any of its walls
          // when the room side is an open bay) -- not a building wall that happens to be drawn as hardwall
          if (o.room || !r.box || (o.box && o.box === r.box)) { hall[k] = 1; break; }
        }
        // corridor-shaped: cleanroom walls both sides, 7'-16' apart (where the hallway carries on past the rooms)
        if (!a.room && !b.room && w >= 7 && w <= 16) shape[k] = 1;
      }
    }
    // (bridge the odd column right where a wall stops, by growing it a foot)
    { const g = Math.round(1 / G.cell), add = [];
      for (let k = 0; k < N; k++) { if (!shape[k]) continue; const i = k % G.nx; for (let d = 1; d <= g; d++) for (const v of [i - d >= 0 ? k - d : -1, i + d < G.nx ? k + d : -1, k - d * G.nx, k + d * G.nx]) if (v >= 0 && v < N && !shape[v] && !ceil[v] && !isWall(v) && G.inside[v] && within(v)) add.push(v); }
      for (const v of add) shape[v] = 1; }
    // carry the hallway on along corridor-shaped floor joined to it
    { const st = []; for (let k = 0; k < N; k++) if (hall[k]) st.push(k);
      while (st.length) { const u = st.pop(), a = u % G.nx; for (const v of [a > 0 ? u - 1 : -1, a < G.nx - 1 ? u + 1 : -1, u - G.nx, u + G.nx]) if (v >= 0 && v < N && shape[v] && !hall[v]) { hall[v] = 1; st.push(v); } } }
    // keep each stretch of hallway that's big enough to be one, as its own ceiling area
    const seen = new Uint8Array(N);
    for (let k0 = 0; k0 < N; k0++) {
      if (!hall[k0] || seen[k0]) continue;
      const cells = [], st = [k0]; seen[k0] = 1;
      while (st.length) { const u = st.pop(), a = u % G.nx; cells.push(u); for (const v of [a > 0 ? u - 1 : -1, a < G.nx - 1 ? u + 1 : -1, u - G.nx, u + G.nx]) if (v >= 0 && v < N && hall[v] && !seen[v]) { seen[v] = 1; st.push(v); } }
      if (cells.length * G.cell * G.cell < 40) continue;
      const mask = new Uint8Array(N); for (const c of cells) mask[c] = 1;
      const ids = new Map(); for (const c of cells) ids.set(comp[c], (ids.get(comp[c]) || 0) + 1);
      for (const [id] of ids) { const mine = cells.filter(c => comp[c] === id); if (mine.length * G.cell * G.cell >= 20) spaces.push({ P: D.P, A: D.A, G, comp, id, room: { name: 'Hallway' }, cells: mine, hull: mask, lightsOnly: false, hallway: true }); }
    }
  }
  // the grid: centred in the biggest space, on whichever of "a line at the centre" or "a cell at the centre"
  // leaves the bigger cut tiles at the walls
  const big = spaces.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
  let bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
  for (const k of big.cells) { const i = k % big.G.nx, j = (k - i) / big.G.nx, x = big.G.x0 + (i + 0.5) * big.G.cell, z = big.G.z0 + (j + 0.5) * big.G.cell; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
  const centre = (lo, hi, sp) => { const c = (lo + hi) / 2, cut = (o) => { const r = ((((lo - o) % sp) + sp) % sp); return r < 1e-6 ? sp : sp - r; }; return cut(c) >= cut(c + sp / 2) ? c : c + sp / 2; };
  let ox = centre(bx0, bx1, cw), oz = centre(bz0, bz1, cl);
  if (keep) {
    // the grid line most of the placed fixtures (lying the grid's way) have an edge on
    const on = EX.filter(f => Math.abs(f.w - cw) < 0.25 && Math.abs(f.h - cl) < 0.25);
    const vote = (vals, sp) => { let best = null, bn = 0; for (const v of vals) { const n = vals.filter(u => { const d = Math.abs(u - v) % sp; return Math.min(d, sp - d) < 0.1; }).length; if (n > bn) { bn = n; best = v; } } return best; };
    const md = (v, sp) => ((v % sp) + sp) % sp;
    // both ways at once: the line pair the most FFUs share (one layout's lines across, another's up and down
    // would fit neither); FFUs a hair apart (up to 3″) count as on the same lines, and the middle of them is taken
    if (on.length) {
      const P2 = on.map(f => [md(f.x - cw / 2, cw), md(f.y - cl / 2, cl)]), nr = (a, b, sp) => { const d = Math.abs(a - b) % sp; return Math.min(d, sp - d) < 0.25; };
      let best = P2[0], bn = 0; for (const p of P2) { const n = P2.filter(q => nr(q[0], p[0], cw) && nr(q[1], p[1], cl)).length; if (n > bn) { bn = n; best = p; } }
      const M = P2.filter(q => nr(q[0], best[0], cw) && nr(q[1], best[1], cl)), mid = (vals, b0, sp) => { const L = vals.map(u => { let d = u - b0; d -= Math.round(d / sp) * sp; return d; }).sort((a, b) => a - b); return md(b0 + L[L.length >> 1], sp); };
      ox = mid(M.map(q => q[0]), best[0], cw); oz = mid(M.map(q => q[1]), best[1], cl);
    }
  }
  const G = { ox, oz, cw, cl, swap };
  const spIn = (sp, x, z) => { const g = sp.G, i = Math.floor((x - g.x0) / g.cell), j = Math.floor((z - g.z0) / g.cell); return i >= 0 && j >= 0 && i < g.nx && j < g.nz && sp.comp[j * g.nx + i] === sp.id && (!sp.hull || sp.hull[j * g.nx + i]); };
  const mdv = (v, sp) => ((v % sp) + sp) % sp, sameLine = (a, b, sp) => { const d = Math.abs(a - b) % sp; return Math.min(d, sp - d) < 0.06; };
  // a room whose FFUs face the other way from the main grid, or sit on other lines (a layout dragged in off the
  // main grid), gets its own grid section lined up with them, so the tiles between them stay whole: no tiles
  // split down the middle, no tees framing every FFU. Sections from an earlier Generate are made fresh.
  const userZones = (plan.gridZones || []).filter(q => q && !q.auto), autoZones = [];
  // FFU layouts: FFUs within 2½′ of each other, edge to edge (a layout's rows with a row of tiles between)
  const clusters = [];
  if (keep && EF.length) {
    const par = EF.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
    for (let i = 0; i < EF.length; i++) for (let j = i + 1; j < EF.length; j++) { const a = EF[i], b = EF[j]; if (Math.abs(a.x - b.x) - (a.w + b.w) / 2 < 2.5 && Math.abs(a.y - b.y) - (a.h + b.h) / 2 < 2.5) par[find(i)] = find(j); }
    const m = new Map(); EF.forEach((f, i) => { const r = find(i); (m.get(r) || m.set(r, []).get(r)).push(f); }); clusters.push(...m.values());
  }
  // the grid lines a set of FFUs sit on: the way most of them face, and the edge line most of them share
  // (FFUs drawn a hair apart, up to 3″, count as on the same line; the middle of those is taken)
  const latticeOf = (fs) => {
    const wd = fs.filter(f => f.w > f.h + 0.1).length, tl = fs.filter(f => f.h > f.w + 0.1).length;
    const sw = wd === tl ? swap : wd > tl, zw = sw ? 4 : 2, zl = sw ? 2 : 4;
    const on = fs.filter(f => Math.abs(f.w - zw) < 0.25 && Math.abs(f.h - zl) < 0.25); if (!on.length) return null;
    const near = (a, b, s) => { const d = Math.abs(a - b) % s; return Math.min(d, s - d) < 0.25; };
    const vote = (vals, s) => { let best = null, bn = 0; for (const v of vals) { const n = vals.filter(u => near(u, v, s)).length; if (n > bn) { bn = n; best = v; } } const L = vals.filter(u => near(u, best, s)).map(u => { let d = u - best; d -= Math.round(d / s) * s; return d; }).sort((a, b) => a - b); return mdv(best + L[L.length >> 1], s); };
    return { sw, zw, zl, zx: vote(on.map(f => mdv(f.x - zw / 2, zw)), zw), zz: vote(on.map(f => mdv(f.y - zl / 2, zl)), zl), n: on.length };
  };
  const spBox = (sp) => { const g = sp.G; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const k of sp.cells) { const i = k % g.nx, j = (k - i) / g.nx; x0 = Math.min(x0, g.x0 + i * g.cell); x1 = Math.max(x1, g.x0 + (i + 1) * g.cell); z0 = Math.min(z0, g.z0 + j * g.cell); z1 = Math.max(z1, g.z0 + (j + 1) * g.cell); } return { x0, x1, z0, z1 }; };
  const fxBox = (fs) => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const f of fs) { x0 = Math.min(x0, f.x - f.w / 2); x1 = Math.max(x1, f.x + f.w / 2); z0 = Math.min(z0, f.y - f.h / 2); z1 = Math.max(z1, f.y + f.h / 2); } return { x0, x1, z0, z1 }; };
  const CL = clusters.map(fs => ({ fs, L: latticeOf(fs), box: fxBox(fs), sp: spaces.map(sp => [sp, fs.filter(f => spIn(sp, f.x, f.y)).length]).sort((a, b) => b[1] - a[1]).map(q => (q[1] ? q[0] : null))[0] }));
  const near15 = (a, b, sp) => { const d = Math.abs(a - b) % sp; return Math.min(d, sp - d) < 0.15; }, sameAs = (L, M) => L && M && L.sw === M.sw && near15(L.zx, M.zx, L.zw) && near15(L.zz, M.zz, L.zl);
  const MAIN = { sw: swap, zw: cw, zl: cl, zx: mdv(ox, cw), zz: mdv(oz, cl) };
  for (const c of CL) {
    // a layout lined up with the main grid needs nothing; one turned or shifted off it gets its own section
    if (!c.L || !c.sp || c.fs.length < 2 || sameAs(c.L, MAIN)) continue;
    const sp = c.sp, others = CL.filter(d => d !== c && d.sp === sp && !sameAs(d.L, c.L));
    let { x0, x1, z0, z1 } = spBox(sp);
    let intr = 0; for (const s2 of spaces) if (s2 !== sp) for (const k of s2.cells) { const i = k % s2.G.nx, j = (k - i) / s2.G.nx, x = s2.G.x0 + (i + 0.5) * s2.G.cell, z = s2.G.z0 + (j + 0.5) * s2.G.cell; if (x > x0 && x < x1 && z > z0 && z < z1 && !spIn(sp, x, z)) intr++; }
    if (others.length || intr > 0.1 * sp.cells.length) {
      // the room isn't a plain box of its own (it runs on into a hall, wraps a neighbour, or holds another
      // layout lying another way): the section is the layout's own box, grown out to the room's walls while
      // it stays in this room and clear of the other layouts
      const b = { ...c.box }, okPt = (x, z) => spIn(sp, x, z) && !others.some(d => x > d.box.x0 - 0.1 && x < d.box.x1 + 0.1 && z > d.box.z0 - 0.1 && z < d.box.z1 + 0.1);
      const strip = (side, d) => { const pts = []; const st = 0.5; if (side === 'x0' || side === 'x1') { const x = side === 'x0' ? b.x0 - d : b.x1 + d; for (let z = b.z0 + 0.1; z <= b.z1 - 0.1; z += st) pts.push([x, z]); } else { const z = side === 'z0' ? b.z0 - d : b.z1 + d; for (let x = b.x0 + 0.1; x <= b.x1 - 0.1; x += st) pts.push([x, z]); } return pts.length ? pts.filter(([x, z]) => okPt(x, z)).length / pts.length : 0; };
      for (let pass = 0; pass < 2; pass++) for (const side of ['x0', 'x1', 'z0', 'z1']) { let n = 0; while (n < 120 && strip(side, 0.125) >= 0.85) { if (side === 'x0') b.x0 -= 0.25; else if (side === 'x1') b.x1 += 0.25; else if (side === 'z0') b.z0 -= 0.25; else b.z1 += 0.25; n++; } }
      ({ x0, x1, z0, z1 } = b);
    }
    // out to the middle of the room's walls (the room's cells stop a little short of them), so no sliver of the
    // main grid is left along a wall
    const reach = (vert, at, lo, hi, dir) => { let best = null; for (const p of sp.A.pieces) { if (vert ? Math.abs(p.x1 - p.x2) > 1e-3 : Math.abs(p.z1 - p.z2) > 1e-3) continue; const cc = vert ? p.x1 : p.z1, a = vert ? Math.min(p.z1, p.z2) : Math.min(p.x1, p.x2), bb = vert ? Math.max(p.z1, p.z2) : Math.max(p.x1, p.x2); const d = (cc - at) * dir; if (d >= -0.05 && d <= 1.25 && bb > lo + 0.5 && a < hi - 0.5 && (best === null || d < (best - at) * dir)) best = cc; } return best === null ? at : best; };
    [x0, x1, z0, z1] = [reach(true, x0, z0, z1, -1), reach(true, x1, z0, z1, 1), reach(false, z0, x0, x1, -1), reach(false, z1, x0, x1, 1)];
    const L = c.L; autoZones.push({ id: uid(), x0, y0: z0, x1, y1: z1, swap: L.sw, ox: x0 + mdv(L.zx - x0, L.zw), oy: z0 + mdv(L.zz - z0, L.zl), auto: true });
  }
  const gridZones = userZones.concat(autoZones);
  const PZ = Object.assign({}, plan, { gridZones, ceilRects: [[0, 0, 0, 0]] });
  const gridFor = (x, z) => { const q = gridZoneAt(PZ, x, z); return q ? zoneGrid(q) : G; };
  // FFUs and lights kept from before that sit a little off the grid (up to 6″, from an older grid or a drawing)
  // are set into their cells, so the grid doesn't get extra tees framing them
  const snapped = [];
  if (keep) for (const f of EX) {
    // a 2×4 lying the grid's way goes into its cell; one turned across the grid (or a 2×2) onto the lines a
    // half cell apart, so its frame tees fall exactly between whole cells and leave whole 2×2 tiles beside it
    const g = gridFor(f.x, f.y), ox = g.ox, oz = g.oz, w = Math.round(f.w), h = Math.round(f.h);
    if (!((w === 2 || w === 4) && (h === 2 || h === 4) && Math.abs(f.w - w) < 0.25 && Math.abs(f.h - h) < 0.25)) continue;
    const sx = Math.min(g.cw, w), sz = Math.min(g.cl, h);
    const cx = ox + Math.round((f.x - w / 2 - ox) / sx) * sx + w / 2, cz = oz + Math.round((f.y - h / 2 - oz) / sz) * sz + h / 2;
    const dx = cx - f.x, dz = cz - f.y;
    if ((Math.abs(dx) > 1e-3 || Math.abs(dz) > 1e-3) && Math.abs(dx) <= 0.5 && Math.abs(dz) <= 0.5) snapped.push({ id: f.id, x: cx, y: cz });
  }
  const out = [], rooms = [], taken = new Set();
  for (const sp of spaces) {
    const { P, A, comp, id } = sp, g = sp.G, CA = ceilAreas(P, A);
    const inSpace = (x, z) => { const i = Math.floor((x - g.x0) / g.cell), j = Math.floor((z - g.z0) / g.cell); return i >= 0 && j >= 0 && i < g.nx && j < g.nz && comp[j * g.nx + i] === id && (!sp.hull || sp.hull[j * g.nx + i]); };
    // whole grid cells in this space, clear of walls, chases and ceiling-area edges
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const k of sp.cells) { const i = k % g.nx, j = (k - i) / g.nx; x0 = Math.min(x0, g.x0 + i * g.cell); x1 = Math.max(x1, g.x0 + (i + 1) * g.cell); z0 = Math.min(z0, g.z0 + j * g.cell); z1 = Math.max(z1, g.z0 + (j + 1) * g.cell); }
    const cells = [];
    for (const gp of gridPieces(Object.assign({}, P, { gridZones, ceilRects: [[0, 0, 0, 0]] }), [[x0 - 1, z0 - 1, x1 + 1, z1 + 1]], G)) {
    const { ox: gox, oz: goz, cw: gcw, cl: gcl } = gp.G, inPiece = (x, z, w, h) => gp.rects.some(r => x >= r[0] - 1e-6 && z >= r[1] - 1e-6 && x + w <= r[2] + 1e-6 && z + h <= r[3] + 1e-6);
    for (let x = gox + Math.floor((x0 - gox) / gcw) * gcw; x + gcw <= x1 + 1; x += gcw) for (let z = goz + Math.floor((z0 - goz) / gcl) * gcl; z + gcl <= z1 + 1; z += gcl) {
      const cw = gcw, cl = gcl; if (!inPiece(x, z, cw, cl)) continue;
      const cx = x + cw / 2, cz = z + cl / 2, e = 0.15, pts = [[cx, cz], [x + e, z + e], [x + cw - e, z + e], [x + e, z + cl - e], [x + cw - e, z + cl - e]];
      if (!pts.every(([px, pz]) => inSpace(px, pz))) continue;
      if (fixtureHitsWall({ x: cx, y: cz, w: cw, h: cl }, A)) continue;
      if (A.pieces.some(p => segDist(cx, cz, p.x1, p.z1, p.x2, p.z2) < Math.min(cw, cl) / 2 + (p.t || 0.25) / 2 - 0.05)) continue;
      if (A.boxes.some(b => x < b.x1 && x + cw > b.x0 && z < b.z1 && z + cl > b.z0)) continue;
      const hs = pts.map(([px, pz]) => ceilingAt(CA, roomKey(P, sp.room).H, px, pz)); if (hs.some(h => Math.abs(h - hs[0]) > 0.01)) continue;
      const key = cx.toFixed(2) + ',' + cz.toFixed(2); if (taken.has(key)) continue;
      if (EX.some(f => Math.abs(f.x - cx) < (f.w + cw) / 2 - 0.05 && Math.abs(f.y - cz) < (f.h + cl) / 2 - 0.05)) continue;
      cells.push({ x: cx, y: cz, key, h: hs[0], w: cw, d: cl });
    }
    }
    const area = sp.cells.length * g.cell * g.cell, H = cells.length ? cells.reduce((t, c) => t + c.h, 0) / cells.length : roomKey(P, sp.room).H;
    const iso = sp.room && sp.room.iso ? +sp.room.iso : (opts.iso ? +opts.iso : 7), T = ISO_TARGETS[iso] || ISO_TARGETS[7];
    const ach = sp.room && sp.room.ach > 0 ? +sp.room.ach : T.ach;
    const need = Math.max(Math.ceil(ach * area * H / 60 / cfm), Math.ceil(T.cov / 100 * area / (cw * cl)), area > 30 && T.cov > 0 ? 1 : 0);
    const mineF = EF.filter(f => inSpace(f.x, f.y)), mineL = EX.filter(f => f.type !== 'ffu' && inSpace(f.x, f.y)).length;
    const nF = keep || sp.lightsOnly ? 0 : Math.min(need, cells.length);
    const pickF = spread(cells, nF);
    const rest = cells.filter((c, i) => !pickF.includes(i));
    const wantL = Math.max(area > 20 ? 1 : 0, Math.round(area / (opts.sqftPerLight > 0 ? opts.sqftPerLight : 64)));
    const nL = keep && !opts.addLights ? 0 : Math.min(rest.length, Math.max(0, wantL - (keep ? mineL : 0)));
    const pickL = spread(rest, nL);
    for (const i of pickF) { const c = cells[i]; taken.add(c.key); out.push({ id: uid(), type: 'ffu', x: c.x, y: c.y, w: c.w, h: c.d }); }
    for (const i of pickL) { const c = rest[i]; taken.add(c.key); out.push({ id: uid(), type: 'led', x: c.x, y: c.y, w: c.w, h: c.d }); }
    // with keep, the FFUs counted are the ones already placed (a 2×2 moves half the air of a 2×4)
    const fN = keep ? mineF.length : nF, fCfm = keep ? mineF.reduce((t, f) => t + cfm * Math.min(1, (f.w * f.h) / 8), 0) : nF * cfm;
    rooms.push({ name: sp.room ? (sp.room.name || 'Room') : 'Unlabelled space', area, iso, ach, ffu: fN, led: pickL.length + (keep ? mineL : 0), need: sp.lightsOnly ? 0 : need, lightsOnly: !!sp.lightsOnly, cells: cells.length, cfm: fCfm, achGot: area * H > 0 ? fCfm * 60 / (area * H) : 0 });
  }
  let ceilRects = [];
  { const g0 = spaces[0].G, seen = new Set(), all = []; for (const sp of spaces) for (const k of sp.cells) if (!seen.has(k)) { seen.add(k); all.push(k); } ceilRects = cellRects(g0, all); }
  // areas boxed in by hand with the Grid tool: added (plan.ceilAdd) and cut out (plan.ceilCut), last
  const cut = Array.isArray(plan.ceilCut) ? plan.ceilCut : [];
  if (Array.isArray(plan.ceilAdd) && plan.ceilAdd.length) ceilRects = rectsMinus(ceilRects, plan.ceilAdd).concat(plan.ceilAdd.map(r => r.slice()));
  if (cut.length) { ceilRects = rectsMinus(ceilRects, cut); for (let i = out.length - 1; i >= 0; i--) if (cut.some(r => out[i].x > r[0] && out[i].x < r[2] && out[i].y > r[1] && out[i].y < r[3])) out.splice(i, 1); }
  // FFUs and lights already placed that ended up with no ceiling over them (in a room that isn't closed in)
  const bare = keep ? EX.filter(f => !ceilRects.some(r => f.x > r[0] && f.x < r[2] && f.y > r[1] && f.y < r[3])).length : 0;
  // fixtures placed by hand that sit off the new grid (so the tees run across them)
  const sm = new Map(snapped.map(q => [q.id, q]));
  const off = keep ? EX.filter(f => { const q = sm.get(f.id) || f, nom = (v) => (Math.abs(v - Math.round(v)) < 0.2 ? Math.round(v) : v), w = nom(f.w), h = nom(f.h), a = (v, o, sp) => { const d = Math.abs(v - o) % sp; return Math.min(d, sp - d) < 0.06; }, g = gridFor(q.x, q.y); return !(a(q.x - w / 2, g.ox, Math.min(g.cw, w)) && a(q.y - h / 2, g.oz, Math.min(g.cl, h))); }).length : 0;
  return { ceilGrid: { ox: G.ox, oy: G.oz, swap }, gridZones, fixtures: out, rooms, ceilRects, keep, offGrid: off, bare, offices: skippedOffices, open: openRooms, snapped };
}
// k points spread evenly over a set of cells: start nearest the middle, add the farthest, then even them out
function spread(cells, k) {
  if (k <= 0) return []; if (k >= cells.length) return cells.map((_, i) => i);
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const mx = cells.reduce((t, c) => t + c.x, 0) / cells.length, my = cells.reduce((t, c) => t + c.y, 0) / cells.length;
  let first = 0; cells.forEach((c, i) => { if (d2(c, { x: mx, y: my }) < d2(cells[first], { x: mx, y: my })) first = i; });
  const pick = [first], near = cells.map(c => d2(c, cells[first]));
  while (pick.length < k) { let best = -1; near.forEach((v, i) => { if (!pick.includes(i) && (best < 0 || v > near[best])) best = i; }); pick.push(best); cells.forEach((c, i) => { near[i] = Math.min(near[i], d2(c, cells[best])); }); }
  // a few rounds of moving each point to the middle of the cells nearest it
  let ctr = pick.map(i => ({ x: cells[i].x, y: cells[i].y }));
  for (let it = 0; it < 8; it++) {
    const sum = ctr.map(() => ({ x: 0, y: 0, n: 0 }));
    cells.forEach(c => { let b = 0; ctr.forEach((q, j) => { if (d2(c, q) < d2(c, ctr[b])) b = j; }); sum[b].x += c.x; sum[b].y += c.y; sum[b].n++; });
    ctr = sum.map((q, j) => (q.n ? { x: q.x / q.n, y: q.y / q.n } : ctr[j]));
  }
  const used = new Set();
  return ctr.map(q => { let b = -1; cells.forEach((c, i) => { if (!used.has(i) && (b < 0 || d2(c, q) < d2(cells[b], q))) b = i; }); used.add(b); return b; });
}
/* Grid steps for a fixture: its long side steps on 4′, its short side on 2′ (a 2 × 2 on 2′ both ways).
   On a turned grid the two axes trade places. */
/* Is a fixture turned across the grid (its long side across the cells' long side)? Only on the app's own
   2′ × 4′ grid; an imported ceiling drawing keeps its own lines. */
function fixtureTurned(f, G) {
  if (!G || G.fromLines) return false;
  const w = f.w || (G.swap ? 4 : 2), h = f.h || (G.swap ? 2 : 4);
  return Math.abs(w - h) > 0.1 && (w > h) !== (G.cw > G.cl);
}
/* The half of a 4′ × 4′ block (two cells side by side) that a turned fixture leaves open: one 2′ × 4′ tile laid
   the same way, with the cross tee moved to the fixture's edge. Returns { x0, z0, x1, z1 }. */
function turnedOpenHalf(f, G) {
  if (G.cl > G.cw) { const z0 = f.y - 1, c0 = G.oz + Math.floor((z0 - G.oz) / 4 + 1e-6) * 4, lo = z0 - c0 < 0.5 ? c0 + 2 : c0; return { x0: f.x - 2, x1: f.x + 2, z0: lo, z1: lo + 2 }; }
  const x0 = f.x - 1, c0 = G.ox + Math.floor((x0 - G.ox) / 4 + 1e-6) * 4, lo = x0 - c0 < 0.5 ? c0 + 2 : c0; return { x0: lo, x1: lo + 2, z0: f.y - 2, z1: f.y + 2 };
}
function fixtureSteps(w, h, G) {
  // a 2 × 4 turned across the grid spans two cells side by side and fills half their length: 2′ steps both ways
  const base = (a, b) => a > 2.2 && b <= 2.2 ? [2, 2] : [a > 2.2 ? 4 : 2, b > 2.2 ? 4 : (a <= 2.2 ? 2 : 4)];
  if (!G.swap) return base(w, h);
  const [sz, sx] = base(h, w); return [sx, sz];
}
/* Snap a fixture into whole grid cells so it never straddles a tee: a 2′ × 4′ (or 2 × 2) fixture centres on
   its cell. Fixtures from an imported ceiling drawing follow that drawing's own grid instead. */
/* An FFU or light dropped on an imported ceiling drawing: into the drawing's own opening under it. Each edge
   catches on a drawn tee (one that runs along that edge), preferring a spot where both opposite edges sit on
   tees (the fixture fills a hole); reach: how far it may move, in feet. Null when the plan has no drawing. */
const DRAWN_IDX = new WeakMap();
function snapToDrawn(plan, f, reach) {
  const L = plan && Array.isArray(plan.ceilingGrid) && plan.ceilingGrid.length ? plan.ceilingGrid : null; if (!L) return null;
  // the drawing's tees joined end to end (a line drawn in 2′ pieces is one tee), and the walls' faces: a hole at
  // the edge of the drawing closes on a wall
  let I = DRAWN_IDX.get(L); const wk = (plan.walls || []).length;
  if (!I || I.wk !== wk) {
    I = { V: [], H: [], wk }; const faces = [];
    for (const w of plan.walls || []) { const t = (w.t || 0.25) / 2; if (Math.abs(w.x1 - w.x2) < 0.02) for (const s of [-t, t]) faces.push([w.x1 + s, w.y1, w.x2 + s, w.y2]); else if (Math.abs(w.y1 - w.y2) < 0.02) for (const s of [-t, t]) faces.push([w.x1, w.y1 + s, w.x2, w.y2 + s]); }
    for (const q of joinLines(L.concat(faces))) { if (Math.abs(q[0] - q[2]) < 0.02) I.V.push([(q[0] + q[2]) / 2, Math.min(q[1], q[3]), Math.max(q[1], q[3])]); else if (Math.abs(q[1] - q[3]) < 0.02) I.H.push([(q[1] + q[3]) / 2, Math.min(q[0], q[2]), Math.max(q[0], q[2])]); }
    DRAWN_IDX.set(L, I);
  }
  reach = reach || 1;
  const nom = (v) => (Math.abs(v - Math.round(v)) < 0.2 ? Math.round(v) : v), w = nom(f.w || 2), h = nom(f.h || 4);
  // along one axis: lines near the fixture's two edges that run along most of that edge
  const axis = (lines, c, half, a0, a1) => {
    const P = [];
    for (const q of lines) if (q[0] > c - half - reach - 0.01 && q[0] < c + half + reach + 0.01 && Math.min(q[2], a1) - Math.max(q[1], a0) > 0.45 * (a1 - a0) && !P.some(p => Math.abs(p - q[0]) < 0.01)) P.push(q[0]);
    let best = null;
    for (const p of P) for (const sd of [-1, 1]) {
      const d = p - (c + sd * half); if (Math.abs(d) > reach) continue;
      const both = P.some(q => Math.abs(q - (c + d - sd * half)) < 0.08), score = (both ? 0 : 10) + Math.abs(d);
      if (!best || score < best.score) best = { d, score };
    }
    return best;
  };
  let x = f.x, y = f.y, fx = null, fz = null;
  for (let pass = 0; pass < 2; pass++) {
    fx = axis(I.V, f.x, w / 2, y - h / 2, y + h / 2); if (fx) x = f.x + fx.d;
    fz = axis(I.H, f.y, h / 2, x - w / 2, x + w / 2); if (fz) y = f.y + fz.d;
  }
  return { ...f, x, y, inHole: !!(fx && fz && fx.score < 10 && fz.score < 10), caught: !!(fx || fz) };
}
// where a fixture goes when it's dropped at (f.x, f.y): an imported drawing's own opening when there is one under
// it, otherwise the grid's cells
function placeFixture(plan, f, A) {
  const d = !isBuilt(plan) ? snapToDrawn(plan, f, 1) : null;
  if (d && d.caught) return d;
  if (d) return { ...f };
  return snapFixture(f, gridAt(plan, f.x, f.y, A));
}
function snapFixture(f, G) {
  const w = f.w || (G.swap ? 4 : 2), h = f.h || (G.swap ? 2 : 4);
  // an imported grid: step by its own line spacing (2 × 2, 2 × 4, or whatever it was drawn at)
  const [sx, sz] = G.fromLines ? [G.cw, G.cl] : fixtureSteps(w, h, G);
  const fw = Math.max(sx, Math.round(w / sx) * sx), fh = Math.max(sz, Math.round(h / sz) * sz);
  const x0 = G.ox + Math.round((f.x - fw / 2 - G.ox) / sx) * sx, z0 = G.oz + Math.round((f.y - fh / 2 - G.oz) / sz) * sz;
  return { ...f, x: x0 + fw / 2, y: z0 + fh / 2 };
}
/* Does a wall run through this fixture? (its centreline crosses the fixture's box, ignoring a 1″ edge so a
   fixture that just meets a wall face doesn't count) */
function fixtureHitsWall(f, A) {
  const hw = (f.w || 2) / 2 - 0.09, hh = (f.h || 4) / 2 - 0.09;
  for (const p of A.pieces) {
    const x0 = f.x - hw, x1 = f.x + hw, z0 = f.y - hh, z1 = f.y + hh;
    // clip the wall's centreline to the box (Liang–Barsky)
    let t0 = 0, t1 = 1; const dx = p.x2 - p.x1, dz = p.z2 - p.z1;
    const clip = (q, d) => { if (Math.abs(d) < 1e-12) return q >= 0; const t = q / d; if (d < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
    if (clip(p.x1 - x0, -dx) && clip(x1 - p.x1, dx) && clip(p.z1 - z0, -dz) && clip(z1 - p.z1, dz) && t0 <= t1) return true;
  }
  return false;
}
/* Snapping to the grid can push a fixture into a wall. Then use the nearest whole cell that's clear of walls
   (within a cell of where it was put); if none is, keep the snapped spot. */
function clearOfWalls(s, f, G, A) {
  if (!A.pieces.length || !fixtureHitsWall(s, A)) return s;
  const w = s.w || (G.swap ? 4 : 2), h = s.h || (G.swap ? 2 : 4), [sx, sz] = fixtureSteps(w, h, G);
  let best = null, bd = 1e9;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    if (!i && !j) continue;
    const c = snapFixture({ ...s, x: s.x + i * sx, y: s.y + j * sz }, G);
    if (fixtureHitsWall(c, A)) continue;
    const d = Math.hypot(c.x - f.x, c.y - f.y); if (d < bd) { bd = d; best = c; }
  }
  return best || s;
}
function ceilingFixtures(plan, A) {
  A = A || analyze(plan);
  const G = ceilingGrid(plan, A);
  if (plan.fixturesFinal) return (plan.fixtures || []).map(f => ({ ...f }));
  if (plan.ceilingMode === 'manual') {
    // a generated ceiling keeps each fixture where it was placed (moved freely or nudged off the grid lines, the
    // tees are fitted around it); fixtures traced from a ceiling picture are snapped into cells
    const own = isBuilt(plan) || (Array.isArray(plan.ceilingGrid) && plan.ceilingGrid.length > 0) || (Array.isArray(plan.ceilRects) && plan.ceilRects.length > 0);
    return (plan.fixtures || []).map(f => own ? { ...f } : clearOfWalls(snapFixture(f, G), f, G, A));
  }
  // automatic layout: only where there's a cleanroom (hardwall) ceiling
  if (!A.hardAny) return [];
  const B = A.bounds, out = [], cw = G.cw, cl = G.cl, hx = cw / 2 - 0.1, hz = cl / 2 - 0.1; let k = 0;
  const gx0 = G.ox + Math.ceil((B.minX + cw - G.ox) / cw) * cw, gz0 = G.oz + Math.ceil((B.minZ + cl - G.oz) / cl) * cl;
  const stepX = G.swap ? 8 : 6, stepZ = G.swap ? 6 : 8;
  for (let x = gx0; x + cw <= B.maxX; x += stepX) {
    for (let z = gz0; z + cl <= B.maxZ; z += stepZ) {
      const cx = x + cw / 2, cz = z + cl / 2;
      let clear = true;
      for (const p of A.pieces) { if (segDist(cx, cz, p.x1, p.z1, p.x2, p.z2) < 2.3) { clear = false; break; } }
      if (clear) for (const b of A.boxes) if (cx > b.x0 - hx - 0.3 && cx < b.x1 + hx + 0.3 && cz > b.z0 - hz - 0.3 && cz < b.z1 + hz + 0.3) { clear = false; break; }
      if (clear) { const fp = footprint(A); if (fp && !(fp.has(cx - hx, cz - hz) && fp.has(cx + hx, cz - hz) && fp.has(cx - hx, cz + hz) && fp.has(cx + hx, cz + hz))) clear = false; }
      if (clear) out.push(G.swap ? { type: (k++ % 2) ? 'ffu' : 'led', x: cx, y: cz, w: 4, h: 2 } : { type: (k++ % 2) ? 'ffu' : 'led', x: cx, y: cz });
    }
  }
  return out;
}

/* A roof deck / lid laid over the cleanroom, from a drawing: plan.deckPieces = [{ id, outer: [[x, y], …],
   holes: [[[x, y], …], …] }], each piece placed (and moved) on its own. */
/* The height a lid piece sits at: on top of everything under it. The plenum (the top of the walls), a taller
   room's walls, and the I-beams across the cleanroom all hold it up; the ceiling under it doesn't change. */
/* Where a lid piece sits: on top of the room under each part of it, so a piece over a tall room and a short
   one steps down with the walls instead of floating over the short part. A spot's height is its room's wall
   top (the lowest of the nearest walls each way round it: a shared wall with a taller room doesn't lift the
   short one), raised by any I-beam sitting on those walls. The ceiling under it doesn't change.
   Returns [{h, rects:[[x0, z0, x1, z1]...]}] covering the piece's box, one entry per height. */
function deckLevels(plan, A, d, WH) {
  const walls = (A.pieces || []).filter(p => p.hard);
  // doorways close their wall here (so a corridor doesn't see past them), at that wall's height
  const hard = walls.concat((plan.openings || []).map(o => { let best = null, bd = 1e9; if (o.x2 == null) return null; for (const p of walls) { const dd = Math.min(segDist(o.x1, o.y1, p.x1, p.z1, p.x2, p.z2), segDist(o.x2, o.y2, p.x1, p.z1, p.x2, p.z2)); if (dd < bd) { bd = dd; best = p; } } return best && bd < 1.5 && o.x2 != null ? { x1: o.x1, z1: o.y1, x2: o.x2, z2: o.y2, t: best.t, h: best.h, hard: true } : null; }).filter(Boolean));
  const P = d.outer;
  let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; P.forEach(q => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); });
  // cut lines: the piece's own corners and every wall end and wall face inside its box
  const xs = new Set([x0, x1]), zs = new Set([z0, z1]);
  P.forEach(q => { xs.add(q[0]); zs.add(q[1]); });
  for (const p of hard) {
    const e = (p.t || 0.25) / 2;
    if (Math.abs(p.x1 - p.x2) < 0.05) { xs.add(p.x1 - e); xs.add(p.x1 + e); } else if (Math.abs(p.z1 - p.z2) < 0.05) { zs.add(p.z1 - e); zs.add(p.z1 + e); }
    for (const [x, z] of [[p.x1, p.z1], [p.x2, p.z2]]) { xs.add(x); zs.add(z); }
  }
  const cut = (S, lo, hi) => { const v = [...S].filter(t => t >= lo - 1e-6 && t <= hi + 1e-6).sort((a, b) => a - b), o = []; for (const t of v) if (!o.length || t - o[o.length - 1] > 0.05) o.push(t); o[0] = lo; o[o.length - 1] = hi; return o; };
  const X = cut(xs, x0, x1), Z = cut(zs, z0, z1);
  // the beams each lid height rests on: on walls with no plenum a beam sits on top of them and lifts the lid
  const beams = (plan.beams || []).map(b => { const q = beamSeat(plan, A, b); return { q, top: q.bot + beamSize(b).d / 12 }; });
  const wallTop = (x, z) => {
    const hits = [[], [], [], []];
    for (const p of hard) {
      const e = (p.t || 0.25) / 2 + 0.05;
      if (Math.abs(p.z1 - p.z2) < 0.05 || Math.abs(p.x1 - p.x2) >= 0.05) {
        // crossing the vertical line through x (up / down)
        const lo = Math.min(p.x1, p.x2) - e, hi = Math.max(p.x1, p.x2) + e;
        if (x >= lo && x <= hi) { const t = Math.abs(p.x2 - p.x1) < 1e-6 ? null : (x - p.x1) / (p.x2 - p.x1); const zz = t == null ? (p.z1 + p.z2) / 2 : p.z1 + (p.z2 - p.z1) * Math.max(0, Math.min(1, t)); if (t != null || Math.abs(x - p.x1) <= e) hits[zz < z ? 0 : 1].push([Math.abs(zz - z), p.h]); }
      }
      if (Math.abs(p.x1 - p.x2) < 0.05 || Math.abs(p.z1 - p.z2) >= 0.05) {
        const lo = Math.min(p.z1, p.z2) - e, hi = Math.max(p.z1, p.z2) + e;
        if (z >= lo && z <= hi) { const t = Math.abs(p.z2 - p.z1) < 1e-6 ? null : (z - p.z1) / (p.z2 - p.z1); const xx = t == null ? (p.x1 + p.x2) / 2 : p.x1 + (p.x2 - p.x1) * Math.max(0, Math.min(1, t)); if (t != null || Math.abs(z - p.z1) <= e) hits[xx < x ? 2 : 3].push([Math.abs(xx - x), p.h]); }
      }
    }
    const near = hits.filter(h => h.length).map(h => h.sort((a, b) => a[0] - b[0])[0]);
    if (!near.length) return WH;
    // standing on a wall: that wall's own top
    const on = near.find(n => n[0] < 0.2); if (on) return -on[1]; // on a wall's top: marked, settled below
    return Math.min(...near.map(n => n[1]));
  };
  const FPo = footprint(A) || footprint(A, true);
  const at = (x, z) => {
    let t = wallTop(x, z); if (t < 0) return t;
    // lid hanging out past the cleanroom's walls: settled below from the lid beside it
    if (FPo && !FPo.has(x, z)) return -t;
    for (const B of beams) {
      const q = B.q, L = Math.hypot(q.x2 - q.x1, q.y2 - q.y1); if (L < 0.2 || B.top <= t + 0.01) continue;
      // a beam over this room (its seat at this wall top, or anywhere within the span when it sits on top of the walls)
      const seat = A.PL > 0 ? B.top : q.bot - 0.01;
      if (Math.abs(seat - t) > 0.15) continue;
      const along = ((x - q.x1) * (q.x2 - q.x1) + (z - q.y1) * (q.y2 - q.y1)) / L;
      if (along < -1 || along > L + 1) continue;
      t = B.top;
    }
    return t;
  };
  // each cell's height, then cells merged into rectangles per height
  const nI = X.length - 1, nJ = Z.length - 1, H = [];
  const inPoly = (R, x, z) => { let c = false; for (let a = 0, b = R.length - 1; a < R.length; b = a++) { const [xa, za] = R[a], [xb, zb] = R[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) c = !c; } return c; };
  const onLid = (x, z) => inPoly(P, x, z) && !(d.holes || []).some(hh => inPoly(hh, x, z));
  // cells off the piece (outside its outline, or in a hole) have no height
  for (let i = 0; i < nI; i++) { H.push([]); for (let j = 0; j < nJ; j++) { const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2; H[i].push(onLid(cx, cz) ? Math.round(at(cx, cz) * 50) / 50 : null); } }
  // a strip of lid over a wall's top sits at the height of the lid beside it (the higher side, where the wall
  // parts a tall room from a short one), not at the wall's own top: a short room's lid ending over a tall wall
  // stays down with the room
  for (let pass = 0; pass < 40; pass++) {
    let left = false;
    for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) {
      const v = H[i][j]; if (v == null || v >= 0) continue;
      const nb = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].map(([a, b]) => a >= 0 && b >= 0 && a < nI && b < nJ ? H[a][b] : null).filter(t => t != null && t >= 0);
      if (nb.length) H[i][j] = Math.max(...nb); else left = true;
    }
    if (!left) break;
  }
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) if (H[i][j] != null && H[i][j] < 0) H[i][j] = -H[i][j];
  // hair-thin strips (under 2″, where cut lines fall close together) take the height of the wider cell beside
  // them, so the lid has no slivers standing proud of it
  const thin = 2 / 12;
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) {
    if (H[i][j] == null) continue;
    const wx = X[i + 1] - X[i], wz = Z[j + 1] - Z[j], cand = [];
    if (wx < thin) for (const a of [i - 1, i + 1]) if (a >= 0 && a < nI && H[a][j] != null) cand.push([X[a + 1] - X[a], H[a][j]]);
    if (wz < thin) for (const b of [j - 1, j + 1]) if (b >= 0 && b < nJ && H[i][b] != null) cand.push([Z[b + 1] - Z[b], H[i][b]]);
    if (cand.length) H[i][j] = cand.sort((p, q) => q[0] - p[0])[0][1];
  }
  const used = H.map(r => r.map(v => v == null)), lv = new Map();
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) {
    if (used[i][j]) continue;
    const h = H[i][j]; let j2 = j; while (j2 + 1 < nJ && !used[i][j2 + 1] && H[i][j2 + 1] === h) j2++;
    let i2 = i; while (i2 + 1 < nI) { let ok = true; for (let k = j; k <= j2; k++) if (used[i2 + 1][k] || H[i2 + 1][k] !== h) { ok = false; break; } if (!ok) break; i2++; }
    for (let a = i; a <= i2; a++) for (let k = j; k <= j2; k++) used[a][k] = true;
    (lv.get(h) || lv.set(h, []).get(h)).push([X[i], Z[j], X[i2 + 1], Z[j2 + 1]]);
  }
  // each height's outline: the edges between its cells and any other cell, chained into loops (outlines
  // anticlockwise, holes clockwise), so a level draws as one sheet with no seams across it
  const loopsOf = (h) => {
    const nxt = new Map(), K = (i, j) => i + ',' + j, edge = (a, b) => (nxt.get(K(a[0], a[1])) || nxt.set(K(a[0], a[1]), []).get(K(a[0], a[1]))).push(b);
    const same = (i, j) => i >= 0 && j >= 0 && i < nI && j < nJ && H[i][j] === h;
    for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) {
      if (H[i][j] !== h) continue;
      if (!same(i, j - 1)) edge([i + 1, j], [i, j]);
      if (!same(i - 1, j)) edge([i, j], [i, j + 1]);
      if (!same(i, j + 1)) edge([i, j + 1], [i + 1, j + 1]);
      if (!same(i + 1, j)) edge([i + 1, j + 1], [i + 1, j]);
    }
    const loops = [];
    for (const [k0] of nxt) while ((nxt.get(k0) || []).length) {
      const L = []; let cur = k0, g = 0;
      do { const [i, j] = cur.split(',').map(Number); L.push([X[i], Z[j]]); const n = nxt.get(cur); if (!n || !n.length) break; const b = n.pop(); cur = K(b[0], b[1]); } while (cur !== k0 && g++ < 100000);
      // drop the points in the middle of straight runs
      const T = L.filter((p, k) => { const a = L[(k + L.length - 1) % L.length], b = L[(k + 1) % L.length]; return Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) > 1e-9; });
      if (T.length >= 3) loops.push(T);
    }
    return loops;
  };
  return [...lv.entries()].map(([h, rects]) => ({ h, rects, loops: loopsOf(h) }));
}
/* A lid piece cut into the parts that sit at each height: [{ h, outer, holes }] (h = underside, feet). One
   height under the whole piece gives the piece as drawn; straight-sided pieces give one sheet per height from
   its outline; anything else is cut into the rectangles under each height. Used by the 3D view and the IFC. */
function deckParts(plan, A, d, WH) {
  const LV = deckLevels(plan, A, d, WH), holes = d.holes || [];
  const sarea = (R) => { let a = 0; for (let i = 0; i < R.length; i++) { const [x1, y1] = R[i], [x2, y2] = R[(i + 1) % R.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
  const square = [d.outer].concat(holes).every(R => R.every((q, k) => { const b = R[(k + 1) % R.length]; return Math.abs(q[0] - b[0]) < 1e-6 || Math.abs(q[1] - b[1]) < 1e-6; }));
  const sheets = (l) => {
    const L = l.loops || [], outs = L.filter(R => sarea(R) < 0), ins = L.filter(R => sarea(R) > 0);
    const inP = (R, x, z) => { let c = false; for (let a = 0, b = R.length - 1; a < R.length; b = a++) { const [xa, za] = R[a], [xb, zb] = R[b]; if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) c = !c; } return c; };
    return outs.map(o => ({ h: l.h, outer: o, holes: ins.filter(hh => inP(o, hh[0][0] + 1e-4, hh[0][1] + 1e-4) || inP(o, (hh[0][0] + hh[1][0]) / 2, (hh[0][1] + hh[1][1]) / 2)) }));
  };
  const parts = LV.length === 1 ? [{ h: LV[0].h, outer: d.outer, holes }] : square ? [].concat(...LV.map(sheets)) : [].concat(...LV.map(l => l.rects.map(r => ({ h: l.h, outer: clipPolyRect(d.outer, r), holes: holes.map(hh => clipPolyRect(hh, r)).filter(hh => hh.length >= 3 && Math.abs(sarea(hh)) > 0.01) }))));
  return parts.filter(pt => pt.outer && pt.outer.length >= 3 && Math.abs(sarea(pt.outer)) >= 0.01);
}
/* The highest point a lid piece sits at (parts list). */
function deckBase(plan, A, d, WH) { return Math.max(WH, ...deckLevels(plan, A, d, WH).map(l => l.h)); }
/* Lid steps: where the lid steps from one height up to another and no wall reaches the higher lid, a run of
   wall panels (4′ wide, H-mold at the joints) closes the step, from the top of the lower lid up to the higher
   one. Found automatically between the lid's parts, plus any drawn by hand (plan.lidSteps: {id, x1, y1, x2, y2}).
   Returns [{x1, z1, x2, z2, y0, y1, t, len, id?}]. */
function deckSteps(plan, A, WH) {
  const DK = deckShapes(plan); if (!DK.length) return [];
  const T = 0.17, inPoly = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const R = [];
  for (const d of DK) for (const l of deckLevels(plan, A, d, WH)) for (const r of l.rects) R.push({ r, h: l.h, d });
  const inside = (q, x, z) => x >= q.r[0] - 1e-6 && x <= q.r[2] + 1e-6 && z >= q.r[1] - 1e-6 && z <= q.r[3] + 1e-6 && inPoly(q.d.outer, x, z) && !q.d.holes.some(hh => inPoly(hh, x, z));
  // the lid's height at a point (null: no lid there)
  const lidAt = (x, z) => { let h = null; for (const q of R) if (inside(q, x, z)) h = h == null ? q.h : Math.max(h, q.h); return h; };
  // what already closes a step: wall pieces, the panels over doors (they run up as far as their wall) and headers
  const walls = (A.pieces || []).filter(p => p.hard)
    .concat((A.opInfo || []).filter(i => i.hard).map(i => ({ x1: i.o.x1, z1: i.o.y1, x2: i.o.x2, z2: i.o.y2, t: i.t, h: i.wallH })))
    .concat(typeof headerSegs === 'function' ? headerSegs(plan, A).map(q => ({ x1: q.x1, z1: q.z1, x2: q.x2, z2: q.z2, t: q.t, h: q.y1 })) : []);
  const walled = (x, z, hi) => walls.some(p => p.h >= hi - 0.05 && segDist(x, z, p.x1, p.z1, p.x2, p.z2) < (p.t || 0.25) / 2 + 0.25);
  const out = [], st = 0.25, seen = new Set(), auto = plan.lidStepsAuto !== false;
  // every edge between two parts of the lid at different heights (unless automatic step panels are off)
  if (auto) for (let i = 0; i < R.length; i++) for (let j = 0; j < R.length; j++) {
    if (i === j || R[i].h >= R[j].h - 0.05) continue;
    const a = R[i].r, b = R[j].r; // a lower, b higher
    const edges = [];
    for (const [ea, eb, ax] of [[a[2], b[0], 0], [a[0], b[2], 0], [a[3], b[1], 1], [a[1], b[3], 1]]) {
      if (Math.abs(ea - eb) > 0.02) continue;
      const lo = Math.max(ax ? a[0] : a[1], ax ? b[0] : b[1]), hi = Math.min(ax ? a[2] : a[3], ax ? b[2] : b[3]);
      if (hi - lo > 0.2) edges.push({ v: ea, ax, lo, hi, dir: (ea === a[2] || ea === a[3]) ? 1 : -1 });
    }
    for (const E of edges) {
      const key = E.ax + ':' + E.v.toFixed(2) + ':' + E.lo.toFixed(2) + ':' + E.hi.toFixed(2); if (seen.has(key)) continue; seen.add(key);
      const n = Math.max(1, Math.round((E.hi - E.lo) / st)), pt = (u, off) => E.ax ? [u, E.v + off] : [E.v + off, u];
      let run = null;
      const flush = (u) => { if (run && u - run.a > 0.3) { const p1 = pt(run.a, 0), p2 = pt(u, 0); out.push({ x1: p1[0], z1: p1[1], x2: p2[0], z2: p2[1], y0: run.lo + T, y1: run.hi, t: 0.25, len: u - run.a, auto: true }); } run = null; };
      for (let k = 0; k < n; k++) {
        const u = E.lo + (E.hi - E.lo) * (k + 0.5) / n, [lx, lz] = pt(u, -0.12 * E.dir), [hx, hz] = pt(u, 0.12 * E.dir), [mx, mz] = pt(u, 0);
        const hl = lidAt(lx, lz), hh = lidAt(hx, hz);
        const need = hl != null && hh != null && hh - hl > 0.05 && !walled(mx, mz, hh);
        const u0 = E.lo + (E.hi - E.lo) * k / n;
        if (need && run && (Math.abs(run.lo - hl) > 0.01 || Math.abs(run.hi - hh) > 0.01)) flush(u0);
        if (need && !run) run = { a: u0, lo: hl, hi: hh };
        if (!need) flush(u0);
      }
      flush(E.hi);
    }
  }
  // one run where two come out side by side (either side of a wall's line): keep the first
  for (let i = out.length - 1; i >= 0; i--) {
    const a = out[i], ha = Math.abs(a.z1 - a.z2) < 0.01;
    if (out.some((b, j) => j < i && (Math.abs(b.z1 - b.z2) < 0.01) === ha && (ha ? Math.abs(a.z1 - b.z1) : Math.abs(a.x1 - b.x1)) < 0.4 &&
      Math.min(ha ? Math.max(a.x1, a.x2) : Math.max(a.z1, a.z2), ha ? Math.max(b.x1, b.x2) : Math.max(b.z1, b.z2)) - Math.max(ha ? Math.min(a.x1, a.x2) : Math.min(a.z1, a.z2), ha ? Math.min(b.x1, b.x2) : Math.min(b.z1, b.z2)) > a.len * 0.5)) out.splice(i, 1);
  }
  // an automatic run lines up on the wall it runs beside (a step over a wall stands on that wall's line, not a
  // few inches off it where the lid's cells happen to change height)
  for (const q of out) {
    const hz = Math.abs(q.z1 - q.z2) < 0.01, lo = hz ? Math.min(q.x1, q.x2) : Math.min(q.z1, q.z2), hi = hz ? Math.max(q.x1, q.x2) : Math.max(q.z1, q.z2);
    let best = null, bd = 0.6;
    for (const p of (A.pieces || []).filter(p => p.hard)) {
      const ph = Math.abs(p.z1 - p.z2) < 0.01, pv = Math.abs(p.x1 - p.x2) < 0.01; if (hz ? !ph : !pv) continue;
      const off = hz ? Math.abs(p.z1 - q.z1) : Math.abs(p.x1 - q.x1), plo = hz ? Math.min(p.x1, p.x2) : Math.min(p.z1, p.z2), phi = hz ? Math.max(p.x1, p.x2) : Math.max(p.z1, p.z2);
      if (off < bd && Math.min(hi, phi) - Math.max(lo, plo) > -0.3) { bd = off; best = p; }
    }
    if (best) { if (hz) q.z1 = q.z2 = best.z1; else q.x1 = q.x2 = best.x1; }
  }
  // drawn by hand: along the run, from the lower lid beside it up to the higher one, worked out every 3″ so a run
  // across lid heights changes height with them (with the lid the same height both sides: from the ceiling up
  // under the lid, closing the plenum)
  for (const s of plan.lidSteps || []) {
    const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); if (L < 0.2) continue;
    const ux = (s.x2 - s.x1) / L, uz = (s.y2 - s.y1) / L, nx = -uz, nz = ux, n = Math.max(1, Math.round(L / st));
    let run = null;
    const flush = (u) => { if (run && u - run.a > 0.1) out.push({ x1: s.x1 + ux * run.a, z1: s.y1 + uz * run.a, x2: s.x1 + ux * u, z2: s.y1 + uz * u, y0: run.y0, y1: run.y1, t: 0.25, len: u - run.a, id: s.id }); run = null; };
    for (let k = 0; k < n; k++) {
      const u0 = L * k / n, um = L * (k + 0.5) / n, x = s.x1 + ux * um, z = s.y1 + uz * um;
      const hA = lidAt(x + nx * 0.3, z + nz * 0.3), hB = lidAt(x - nx * 0.3, z - nz * 0.3), hs = [hA, hB].filter(v => v != null);
      const hi = hs.length ? Math.max(...hs) : WH, lo = hs.length ? Math.min(...hs) : WH;
      const y0 = hi - lo > 0.05 ? lo + T : Math.min(A.H, hi - 0.5), y1 = hi;
      if (run && (Math.abs(run.y0 - y0) > 0.01 || Math.abs(run.y1 - y1) > 0.01)) flush(u0);
      if (!run) run = { a: u0, y0, y1 };
    }
    flush(L);
  }
  // where a run drawn by hand covers an automatic one, the hand-drawn run is the one that stands
  const mine = out.filter(q => q.id), along = (q, hz) => hz ? [Math.min(q.x1, q.x2), Math.max(q.x1, q.x2)] : [Math.min(q.z1, q.z2), Math.max(q.z1, q.z2)];
  return out.filter(q => {
    if (!q.auto) return true;
    const hz = Math.abs(q.z1 - q.z2) < 0.01, [a0, a1] = along(q, hz);
    return !mine.some(m => { const mh = Math.abs(m.z1 - m.z2) < 0.01, mv = Math.abs(m.x1 - m.x2) < 0.01; if (hz ? !mh : !mv) return false; const off = hz ? Math.abs(m.z1 - q.z1) : Math.abs(m.x1 - q.x1); const [b0, b1] = along(m, hz); return off < 0.5 && Math.min(a1, b1) - Math.max(a0, b0) > (a1 - a0) * 0.5; });
  });
}
/* The posts and joints along the cleanroom walls, as the parts list counts them: where wall ends meet (a corner
   post, a T-post, a cross post, an H-stud where two runs carry straight on, an end cap at a free end) and the
   H-studs on the 48″ panel module along each run. [{ x, y, kind: 'corner'|'tee'|'cross'|'hstud'|'cap', a }]
   (a: the wall's direction there, for drawing an H-stud across it). */
function wallJoints(plan, A) {
  A = A || analyze(plan);
  const walls = (plan.walls || []).filter(w => isHard(w)), TOL = 0.3, nodes = [], out = [];
  const dirOf = (w, st) => { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1, ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L; return st ? [ux, uy] : [-ux, -uy]; };
  const addDir = (n, d) => { if (!n.dirs.some(e => e[0] * d[0] + e[1] * d[1] > 0.99)) n.dirs.push(d); };
  for (const w of walls) for (const [x, y, st] of [[w.x1, w.y1, true], [w.x2, w.y2, false]]) {
    let n = nodes.find(n => Math.hypot(n.x - x, n.y - y) < TOL);
    if (!n) { n = { x, y, dirs: [], ws: new Set() }; nodes.push(n); }
    addDir(n, dirOf(w, st)); n.ws.add(w.id);
  }
  for (const n of nodes) for (const w of walls) {
    if (n.ws.has(w.id)) continue;
    const nearEnd = Math.hypot(n.x - w.x1, n.y - w.y1) < TOL || Math.hypot(n.x - w.x2, n.y - w.y2) < TOL;
    if (!nearEnd && segDist(n.x, n.y, w.x1, w.y1, w.x2, w.y2) < (w.t || 0.25) / 2 + 0.06) { addDir(n, dirOf(w, true)); addDir(n, dirOf(w, false)); n.ws.add(w.id); }
  }
  for (const n of nodes) {
    const k = n.dirs.length, a = Math.atan2(n.dirs[0][1], n.dirs[0][0]);
    const kind = k === 1 ? 'cap' : k === 2 ? (n.dirs[0][0] * n.dirs[1][0] + n.dirs[0][1] * n.dirs[1][1] < -0.99 ? 'hstud' : 'corner') : k === 3 ? 'tee' : 'cross';
    out.push({ x: n.x, y: n.y, kind, a });
  }
  // H-studs on the 48″ module along runs drawn as long walls (where the parts list cuts panels)
  for (const p of A.pieces || []) {
    if (!p.hard || p.len < 0.1) continue;
    const w = (plan.walls || []).find(q => q.id === p.id); if (!w || w.piece) continue;
    const ux = (p.x2 - p.x1) / p.len, uz = (p.z2 - p.z1) / p.len, a = Math.atan2(uz, ux);
    for (const m of wallModule(w, plan)) { if (m <= p.s0 + 1e-6 || m >= p.s0 + p.len - 1e-6) continue; const t = m - p.s0; out.push({ x: p.x1 + ux * t, y: p.z1 + uz * t, kind: 'hstud', a, mod: true }); }
  }
  return out;
}
/* Header panels: wall panels across an open passage between walls, from the ceiling up to the top of the walls,
   closing the plenum over the gap (plan.headers: {id, x1, y1, x2, y2, bot?}). bot is where the panel starts;
   left out, it's the lower ceiling on either side of it. The top is the top of the walls it runs between. */
function headerSegs(plan, A) {
  const CA = ceilAreas(plan, A), WH = A.WH || A.H, hard = (A.pieces || []).filter(p => p.hard);
  const topNear = (x, z) => { let t = null; for (const p of hard) if (segDist(x, z, p.x1, p.z1, p.x2, p.z2) < (p.t || 0.25) / 2 + 0.35) t = Math.max(t || 0, p.h); return t; };
  const out = [];
  for (const h of plan.headers || []) {
    const L = Math.hypot(h.x2 - h.x1, h.y2 - h.y1); if (L < 0.2) continue;
    const nx = -(h.y2 - h.y1) / L, nz = (h.x2 - h.x1) / L, mx = (h.x1 + h.x2) / 2, mz = (h.y1 + h.y2) / 2;
    const tops = [topNear(h.x1, h.y1), topNear(h.x2, h.y2)].filter(v => v != null), y1 = tops.length ? Math.max(...tops) : WH;
    const ceil = Math.min(ceilingAt(CA, A.H, mx + nx * 0.6, mz + nz * 0.6), ceilingAt(CA, A.H, mx - nx * 0.6, mz - nz * 0.6));
    const y0 = Math.max(0, Math.min(y1 - 0.25, h.bot > 0 ? +h.bot : ceil));
    out.push({ x1: h.x1, z1: h.y1, x2: h.x2, z2: h.y2, y0, y1, t: 0.25, len: L, id: h.id });
  }
  return out;
}
/* Open passages a header could close: two cleanroom wall ends in line with each other, 6″ to 16′ apart, with
   nothing between them and cleanroom on both sides, and no header there yet. */
function headerGaps(plan, A) {
  A = A || analyze(plan);
  const W = (plan.walls || []).filter(w => isHard(w) && Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 0.3), fp = footprint(A, true), out = [];
  const have = plan.headers || [];
  for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
    const a = W[i], b = W[j], la = Math.hypot(a.x2 - a.x1, a.y2 - a.y1), ux = (a.x2 - a.x1) / la, uz = (a.y2 - a.y1) / la, lb = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
    if (Math.abs(ux * (b.y2 - b.y1) / lb - uz * (b.x2 - b.x1) / lb) > 0.02) continue;
    if (Math.abs((b.x1 - a.x1) * -uz + (b.y1 - a.y1) * ux) > 0.15) continue;
    let best = null, bd = 16.01;
    for (const [ex, ez] of [[a.x1, a.y1], [a.x2, a.y2]]) for (const [fx, fz] of [[b.x1, b.y1], [b.x2, b.y2]]) {
      const g = Math.hypot(fx - ex, fz - ez); if (g < 0.5 || g >= bd) continue;
      const mx = (ex + fx) / 2, mz = (ez + fz) / 2;
      if (segDist(mx, mz, a.x1, a.y1, a.x2, a.y2) < g / 2 - 0.05 || segDist(mx, mz, b.x1, b.y1, b.x2, b.y2) < g / 2 - 0.05) continue; // overlapping, not a gap
      if (W.some(w => w !== a && w !== b && segDist(mx, mz, w.x1, w.y1, w.x2, w.y2) < (w.t || 0.25) / 2 + 0.05)) continue;
      const nx = -(fz - ez) / g, nz = (fx - ex) / g;
      if (fp && !(fp.has(mx + nx * 1, mz + nz * 1) && fp.has(mx - nx * 1, mz - nz * 1))) continue;
      if (have.some(h => segDist(mx, mz, h.x1, h.y1, h.x2, h.y2) < 0.3)) continue;
      bd = g; best = [ex, ez, fx, fz];
    }
    if (best) out.push(best);
  }
  // one per gap (the same gap can come from both walls' sides)
  return out.filter((q, k) => !out.some((r, m) => m < k && Math.hypot((q[0] + q[2]) / 2 - (r[0] + r[2]) / 2, (q[1] + q[3]) / 2 - (r[1] + r[3]) / 2) < 0.3));
}
/* A polygon clipped to a rectangle (Sutherland–Hodgman). */
function clipPolyRect(P, r) {
  let out = P;
  const edges = [[0, r[0], 1], [0, r[2], -1], [1, r[1], 1], [1, r[3], -1]];
  for (const [ax, v, sg] of edges) {
    const inp = out; out = []; if (!inp.length) break;
    const inside = (q) => (q[ax] - v) * sg >= -1e-9;
    for (let i = 0; i < inp.length; i++) {
      const c = inp[i], p = inp[(i + inp.length - 1) % inp.length], ci = inside(c), pi = inside(p);
      if (ci !== pi) { const t = (v - p[ax]) / (c[ax] - p[ax]), q = [p[0] + (c[0] - p[0]) * t, p[1] + (c[1] - p[1]) * t]; out.push(q); }
      if (ci) out.push(c);
    }
  }
  return out;
}
function deckShapes(plan) {
  const L = plan && Array.isArray(plan.deckPieces) ? plan.deckPieces : [];
  const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a / 2); };
  return L.filter(d => d && Array.isArray(d.outer) && d.outer.length >= 3).map(d => ({ outer: d.outer, holes: d.holes || [], area: area(d.outer) - (d.holes || []).reduce((t, h) => t + area(h), 0), id: d.id }));
}
/* ---------- house helpers ---------- */
const FLOOR_TEX = {};
function floorMat(THREE, kind) {
  if (FLOOR_TEX[kind]) return FLOOR_TEX[kind];
  const draw = {
    lvp: [256, 256, 4, 4, (g, w, h) => { const tones = ['#b58a5e', '#a97f55', '#c09468', '#9d7550', '#b9905f']; const pw = h / 8; for (let r = 0; r < 8; r++) { let x = -((r * 97) % w); while (x < w) { const L = w * (0.45 + ((r * 31 + x) % 40) / 100); g.fillStyle = tones[(((r + Math.floor(x / 7)) % tones.length) + tones.length) % tones.length]; g.fillRect(x, r * pw, L, pw); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, r * pw, 1.2, pw); x += L; } g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, r * pw, w, 1); } for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(60,35,10,${Math.random() * .08})`; g.fillRect(Math.random() * w, Math.random() * h, 14, 1); } }],
    hardwood: [256, 256, 3, 3, (g, w, h) => { const tones = ['#7a4f2e', '#6c4427', '#855733', '#5f3c22']; const pw = h / 12; for (let r = 0; r < 12; r++) { let x = -((r * 53) % w); while (x < w) { const L = w * (0.3 + ((r * 17 + x) % 30) / 100); g.fillStyle = tones[(((r + Math.floor(x / 7)) % tones.length) + tones.length) % tones.length]; g.fillRect(x, r * pw, L, pw); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, r * pw, 1, pw); x += L; } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, r * pw, w, 1); } for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(30,15,5,${Math.random() * .1})`; g.fillRect(Math.random() * w, Math.random() * h, 16, 1); } }],
    carpet: [128, 128, 3, 3, (g, w, h) => { g.fillStyle = '#b9ad9a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { const v = Math.random() < .5 ? '0,0,0' : '255,255,255'; g.fillStyle = `rgba(${v},${Math.random() * .07})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } }],
    tile: [128, 128, 2, 2, (g, w, h) => { g.fillStyle = '#d9d6cf'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .04})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.fillStyle = '#a9a59d'; g.fillRect(0, 0, w, 2); g.fillRect(0, h / 2, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(w / 2, 0, 2, h); }],
    whiteoak: [256, 256, 3, 3, (g, w, h) => { const tones = ['#d8bf98', '#cdb38b', '#e0c8a3', '#c9ae86']; const pw = h / 10; for (let r = 0; r < 10; r++) { let x = -((r * 71) % w); while (x < w) { const L = 60 + Math.random() * 120; g.fillStyle = tones[(Math.random() * tones.length) | 0]; g.fillRect(x, r * pw, L, pw); g.fillStyle = 'rgba(80,60,40,.25)'; g.fillRect(x, r * pw, 1, pw); x += L; } g.fillStyle = 'rgba(80,60,40,.3)'; g.fillRect(0, r * pw, w, 1); } for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(90,65,40,${Math.random() * .08})`; g.fillRect(Math.random() * w, Math.random() * h, 8 + Math.random() * 20, 1); } }],
    herringbone: [256, 256, 3, 3, (g, w, h) => { g.fillStyle = '#b08a5e'; g.fillRect(0, 0, w, h); const tones = ['#b9905f', '#a57d52', '#c49a6a', '#9c7449']; const L = 64, W2 = 16; for (let y = -L; y < h + L; y += W2 * 2) for (let x = -L; x < w + L; x += L) { for (const [dx, rot] of [[0, Math.PI / 4], [L / 2, -Math.PI / 4]]) { g.save(); g.translate(x + dx, y); g.rotate(rot); g.fillStyle = tones[(Math.random() * 4) | 0]; g.fillRect(0, 0, L * 0.7, W2); g.strokeStyle = 'rgba(60,40,20,.35)'; g.strokeRect(0, 0, L * 0.7, W2); g.restore(); } } }],
    marble: [256, 256, 4, 4, (g, w, h) => { g.fillStyle = '#eeece8'; g.fillRect(0, 0, w, h); for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(120,120,125,${0.08 + Math.random() * .15})`; g.lineWidth = 0.6 + Math.random() * 1.6; g.beginPath(); let x = Math.random() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (Math.random() - .5) * 30; y += 10 + Math.random() * 20; g.lineTo(x, y); } g.stroke(); } g.fillStyle = 'rgba(160,160,160,.6)'; g.fillRect(0, 0, w, 1.5); g.fillRect(0, 0, 1.5, h); g.fillRect(0, h / 2, w, 1.5); g.fillRect(w / 2, 0, 1.5, h); }],
    slate: [128, 128, 3, 3, (g, w, h) => { const tones = ['#4f5357', '#5b5f62', '#464a4d', '#585653']; for (let y = 0; y < h; y += h / 2) for (let x = 0; x < w; x += w / 2) { g.fillStyle = tones[(Math.random() * 4) | 0]; g.fillRect(x, y, w / 2, h / 2); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .05})`; g.fillRect(x + Math.random() * w / 2, y + Math.random() * h / 2, 3, 1); } } g.fillStyle = '#2b2d2f'; for (const v of [0, h / 2]) { g.fillRect(0, v, w, 2); g.fillRect(v, 0, 2, h); } }],
    concrete: [128, 128, 8, 8, (g, w, h) => { g.fillStyle = '#b7b4ad'; g.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { const v = Math.random() < .5 ? '0,0,0' : '255,255,255'; g.fillStyle = `rgba(${v},${Math.random() * .05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }]
  }[kind] || null;
  if (!draw) return floorMat(THREE, 'lvp');
  const t = new THREE.CanvasTexture(makeCanvas(draw[0], draw[1], draw[4])); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO;
  return (FLOOR_TEX[kind] = { mat: new THREE.MeshLambertMaterial({ map: t }), su: draw[2], sv: draw[3] });
}
/* Rooms of a house: each room label's area, split by walls and openings (door cells count as walls here). */
function roomRegions(A, plan, closeGaps) {
  const fp = footprint(A, true); if (!fp || !fp.wall) return [];
  const { nx, nz, inside, cell, x0, z0 } = fp, comp = new Int32Array(nx * nz).fill(-1), out = [];
  let wall = fp.wall;
  if (closeGaps) {
    // a gap of up to 12′ in a straight wall line (a hallway opening into a room) counts as the room's edge
    wall = fp.wall.slice();
    const line = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.ceil(L / (cell / 2))); for (let q = 0; q <= n; q++) { const x = ax + (bx - ax) * q / n, z = az + (bz - az) * q / n, i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell); for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && Math.hypot(x0 + (ii + 0.5) * cell - x, z0 + (jj + 0.5) * cell - z) < cell * 0.75) wall[jj * nx + ii] = 1; } } };
    const W = A.walls.filter(w => (isHard(w) || isFrame(w)) && Math.hypot(w.x2 - w.x1, w.y2 - w.y1) > 0.3);
    for (let i = 0; i < W.length; i++) for (let j = i + 1; j < W.length; j++) {
      const a = W[i], b = W[j], la = Math.hypot(a.x2 - a.x1, a.y2 - a.y1), ux = (a.x2 - a.x1) / la, uz = (a.y2 - a.y1) / la, lb = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
      if (Math.abs(ux * (b.y2 - b.y1) / lb - uz * (b.x2 - b.x1) / lb) > 0.01 || Math.abs((b.x1 - a.x1) * -uz + (b.y1 - a.y1) * ux) > 0.1) continue;
      let best = null, bd = 12;
      for (const [ex, ez] of [[a.x1, a.y1], [a.x2, a.y2]]) for (const [fx, fz] of [[b.x1, b.y1], [b.x2, b.y2]]) {
        const g = Math.hypot(fx - ex, fz - ez); if (g < 0.3 || g >= bd) continue;
        const mx = (ex + fx) / 2, mz = (ez + fz) / 2;
        if (segDist(mx, mz, a.x1, a.y1, a.x2, a.y2) < g / 2 - 0.05 || segDist(mx, mz, b.x1, b.y1, b.x2, b.y2) < g / 2 - 0.05) continue;
        bd = g; best = [ex, ez, fx, fz];
      }
      if (best) line(...best);
    }
  }
  for (const room of plan.rooms || []) {
    const i0 = Math.floor((room.x - x0) / cell), j0 = Math.floor((room.y - z0) / cell);
    if (i0 < 0 || j0 < 0 || i0 >= nx || j0 >= nz) continue;
    const k0 = j0 * nx + i0; if (!inside[k0] || wall[k0] || comp[k0] >= 0) continue;
    const id = out.length, st = [k0], cells = []; comp[k0] = id;
    while (st.length) { const k = st.pop(); cells.push(k); const i = k % nx, j = (k - i) / nx;
      for (const q of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < nz - 1 ? k + nx : -1]) if (q >= 0 && inside[q] && !wall[q] && comp[q] < 0) { comp[q] = id; st.push(q); } }
    // rectangles: runs per row, merged down the rows (cells grown by half a cell so rooms meet the walls)
    const rows = new Map(); for (const k of cells) { const i = k % nx, j = (k - i) / nx; (rows.get(j) || rows.set(j, []).get(j)).push(i); }
    const rects = [];
    for (const [j, is] of rows) { is.sort((a, b) => a - b); let a = is[0], b = a; for (let q = 1; q <= is.length; q++) { if (q < is.length && is[q] === b + 1) { b = is[q]; continue; } rects.push([x0 + (a - 0.5) * cell, z0 + (j - 0.5) * cell, x0 + (b + 1.5) * cell, z0 + (j + 1.5) * cell]); if (q < is.length) a = b = is[q]; } }
    out.push({ room, rects, area: cells.length * cell * cell, cells });
  }
  out.grid = { comp, nx, nz, cell, x0, z0, inside, wall };
  return out;
}
/* A roof over the house as a height field: hip = Chebyshev distance to the eaves (gives hips and valleys on
   any square-cornered plan), gable = distance across the short way only, flat = a low-slope deck. */
function roofField(A, plan, fp) {
  const R = plan.roof || {}, ov = Math.max(0, R.overhang == null ? 1 : R.overhang), slope = (R.pitch == null ? 6 : R.pitch) / 12, s = 0.5;
  const B = A.bounds, gx0 = B.minX - ov - 2, gz0 = B.minZ - ov - 2, nx = Math.ceil((B.w + 2 * ov + 4) / s), nz = Math.ceil((B.d + 2 * ov + 4) / s), N = nx * nz;
  // under a floor above (plan.__roofCover): no roof there, and the roof runs into that floor's wall
  const cov = plan.__roofCover, cv = new Uint8Array(N);
  if (cov) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = gx0 + (i + 0.5) * s, z = gz0 + (j + 0.5) * s; if (cov.some(r => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3])) cv[j * nx + i] = 1; }
  const ins = new Uint8Array(N); for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) ins[j * nx + i] = !cv[j * nx + i] && fp.has(gx0 + (i + 0.5) * s, gz0 + (j + 0.5) * s) ? 1 : 0;
  const cheb = (seed, axis) => { // distance (cells) from each cell to the nearest seed cell
    const D = new Float32Array(N); for (let k = 0; k < N; k++) D[k] = seed[k] ? 0 : 1e9;
    const pass = (rev) => { for (let jj = 0; jj < nz; jj++) { const j = rev ? nz - 1 - jj : jj; for (let ii = 0; ii < nx; ii++) { const i = rev ? nx - 1 - ii : ii, k = j * nx + i; let d = D[k];
      const nb = (di, dj) => { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) return; d = Math.min(d, D[b * nx + a] + 1); };
      if (axis !== 'z') nb(rev ? 1 : -1, 0); if (axis !== 'x') nb(0, rev ? 1 : -1); if (!axis) { nb(-1, rev ? 1 : -1); nb(1, rev ? 1 : -1); }
      D[k] = d; } } };
    pass(false); pass(true); return D;
  };
  const toIns = cheb(ins), roofed = new Uint8Array(N); for (let k = 0; k < N; k++) roofed[k] = !cv[k] && toIns[k] * s <= ov + 1e-6 ? 1 : 0;
  let gAxis = B.w >= B.d ? 'z' : 'x';
  if (cov) {
    // a wing against a taller floor (an attached garage): its ridge runs straight out from that floor's wall, the
    // gable end on the far side, and the overhang stops at that wall instead of running along it
    let i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1, cx = 0, cz = 0; const side = { l: 0, r: 0, t: 0, b: 0 };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!ins[k]) continue; i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; if (!ins[k]) continue;
      if (i > 0 && cv[k - 1]) { cx++; if (i === i0) side.l++; } if (i < nx - 1 && cv[k + 1]) { cx++; if (i === i1) side.r++; }
      if (j > 0 && cv[k - nx]) { cz++; if (j === j0) side.t++; } if (j < nz - 1 && cv[k + nx]) { cz++; if (j === j1) side.b++; } }
    if (i1 >= 0) {
      if (cx || cz) gAxis = cx >= cz ? 'z' : 'x';
      const oc = Math.round(ov / s), a0 = i0 - (side.l ? 0 : oc), a1 = i1 + (side.r ? 0 : oc), b0 = j0 - (side.t ? 0 : oc), b1 = j1 + (side.b ? 0 : oc);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (i < a0 || i > a1 || j < b0 || j > b1) roofed[j * nx + i] = 0;
    }
  }
  const outside = new Uint8Array(N); for (let k = 0; k < N; k++) outside[k] = roofed[k] || cv[k] ? 0 : 1;
  const type = R.type || 'gable', axis = type === 'gable' ? gAxis : null;
  const D = cheb(outside, axis), H = A.H, Z = new Float32Array(N);
  for (let k = 0; k < N; k++) Z[k] = !roofed[k] ? 0 : type === 'flat' ? H + 0.6 : H + slope * (D[k] * s - s / 2 - ov);
  return { s, gx0, gz0, nx, nz, roofed, Z, H, ov, slope, type, cv: cov ? cv : null, at(x, z) { const i = Math.floor((x - gx0) / s), j = Math.floor((z - gz0) / s); if (i < 0 || j < 0 || i >= nx || j >= nz) return H; const k = j * nx + i; return roofed[k] ? Z[k] : H; } };
}
function buildRoof(THREE, group, A, plan, fp, sidingMat, M) {
  const F = roofField(A, plan, fp), { s, gx0, gz0, nx, nz, roofed, Z } = F;
  const pos = [], uv = [], h = (i, j) => { i = Math.max(0, Math.min(nx - 1, i)); j = Math.max(0, Math.min(nz - 1, j)); return Z[j * nx + i]; };
  // vertex heights at cell corners: the average of the roofed cells around them
  // every roof plane runs true right out to its edge: a cell off the roof takes the height its roofed neighbour's
  // slope carries out to it (so an eave edge sits at the eave height and a rake keeps climbing), and the vertex
  // is the average of the four cells round it
  const RF0 = (a, b) => a >= 0 && b >= 0 && a < nx && b < nz && roofed[b * nx + a];
  const cov0 = (a, b) => a >= 0 && b >= 0 && a < nx && b < nz && F.cv && F.cv[b * nx + a];
  const ext = (a, b, i, j) => {
    // the cell (a, b) is off the roof: carry the slope out from a roofed neighbour inside the 2 × 2 at vertex (i, j)
    const out = [];
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const c1 = [a + da, b + db]; if (c1[0] < i - 1 || c1[0] > i || c1[1] < j - 1 || c1[1] > j || !RF0(...c1)) continue;
      const c2 = [a + 2 * da, b + 2 * db]; const z1 = Z[c1[1] * nx + c1[0]], z2 = RF0(...c2) ? Z[c2[1] * nx + c2[0]] : z1;
      out.push(2 * z1 - z2); if (da && db) break;
      if (out.length >= 2) break;
    }
    return out.length ? out.reduce((t, v) => t + v, 0) / out.length : null;
  };
  const vz = (i, j) => {
    let t = 0, n = 0, any = false;
    for (const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) if (RF0(a, b)) { any = true; t += Z[b * nx + a]; n++; }
    if (!any) return F.H;
    for (const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) if (!RF0(a, b) && !cov0(a, b)) { const e = ext(a, b, i, j); if (e != null) { t += e; n++; } }
    return t / n;
  };
  const V = new Float32Array((nx + 1) * (nz + 1)); for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) V[j * (nx + 1) + i] = vz(i, j);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!roofed[j * nx + i]) continue;
    const x0 = gx0 + i * s, z0 = gz0 + j * s, P = [[x0, V[j * (nx + 1) + i], z0], [x0 + s, V[j * (nx + 1) + i + 1], z0], [x0 + s, V[(j + 1) * (nx + 1) + i + 1], z0 + s], [x0, V[(j + 1) * (nx + 1) + i], z0 + s]];
    for (const t of [0, 2, 1, 0, 3, 2]) { pos.push(...P[t]); uv.push(P[t][0] / 3, P[t][2] / 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  // roofing: shingles, standing-seam metal, clay tile or slate, in the picked colour
  const RF = finishOf(plan), rcol = (FINISH.roofColor[RF.roofColor] || [])[1] || '#4b4e52';
  const shade = (hexs, k) => { const v = parseInt(hexs.slice(1), 16), f = (c) => Math.max(0, Math.min(255, Math.round(c * k))); return `rgb(${f(v >> 16)},${f((v >> 8) & 255)},${f(v & 255)})`; };
  const sh = cachedCanvas('roof_' + RF.roof + '|' + rcol, () => makeCanvas(128, 128, (c, w, hh) => {
    c.fillStyle = rcol; c.fillRect(0, 0, w, hh);
    if (RF.roof === 'metal') { for (let x = 0; x < w; x += 16) { c.fillStyle = shade(rcol, 1.35); c.fillRect(x, 0, 2, hh); c.fillStyle = shade(rcol, 0.7); c.fillRect(x + 2, 0, 1, hh); } }
    else if (RF.roof === 'tile') { for (let r = 0; r < 8; r++) for (let x = (r % 2) * 8; x < w + 16; x += 16) { const gr = c.createLinearGradient(x - 8, 0, x + 8, 0); gr.addColorStop(0, shade(rcol, 0.7)); gr.addColorStop(0.5, shade(rcol, 1.25)); gr.addColorStop(1, shade(rcol, 0.7)); c.fillStyle = gr; c.fillRect(x - 8, r * 16, 16, 15); c.fillStyle = shade(rcol, 0.55); c.fillRect(x - 8, r * 16 + 14, 16, 2); } }
    else if (RF.roof === 'slate') { for (let r = 0; r < 8; r++) for (let x = (r % 2) * 10 - 10; x < w; x += 20) { c.fillStyle = shade(rcol, 0.8 + Math.random() * 0.4); c.fillRect(x + 1, r * 16 + 1, 18, 14); } c.fillStyle = 'rgba(0,0,0,.4)'; for (let r = 0; r < 8; r++) c.fillRect(0, r * 16, w, 1.5); }
    else { for (let r = 0; r < 8; r++) { const off = r % 2 ? 8 : 0; for (let x = -16 + off; x < w; x += 16) { c.fillStyle = shade(rcol, 0.85 + Math.random() * 0.35); c.fillRect(x + 1, r * 16 + 1, 14, 14); } c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, r * 16, w, 2); } }
  }));
  const tex = new THREE.CanvasTexture(sh); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = ANISO;
  group.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, name: 'Roofing' })));
  try { roofTrim(THREE, group, F, V, plan); } catch (e) { console.error(e); }
  // gable ends and any outside wall face under a rising roof: siding from the wall top up to the roof. The roof's
  // height is read just inside the wall (on the line itself it can read as the eave), and walls inside the
  // house get none (they stop at the ceiling; above them is attic).
  const gp = [], guv = [], gn = [];
  // the wall pieces and the openings in them (a window under a gable needs the gable over it too)
  const runs = A.pieces.filter(p => p.frame).concat(A.opInfo.filter(i => i.frame).map(i => ({ x1: i.o.x1, z1: i.o.y1, x2: i.o.x2, z2: i.o.y2, len: i.len, t: i.t, h: i.wallH, s0: 0, frame: true })));
  for (const p of runs) {
    if (p.len < 0.05) continue;
    const ux = (p.x2 - p.x1) / p.len, uz = (p.z2 - p.z1) / p.len, nx = -uz, nz = ux, o = (p.t || 0.375) / 2 + 0.6;
    const mx = (p.x1 + p.x2) / 2, mz = (p.z1 + p.z2) / 2, outA = !fp.has(mx + nx * o, mz + nz * o), outB = !fp.has(mx - nx * o, mz - nz * o);
    if (!outA && !outB) continue;
    // the roof read just inside the wall, carried back out to the wall line where it slopes that way (an eave wall)
    const ins = outA ? -1 : 1, at1 = (x, z) => F.at(x + nx * ins * o, z + nz * ins * o), at2 = (x, z) => F.at(x + nx * ins * o * 2, z + nz * ins * o * 2), roofAt = (x, z) => { const r1 = at1(x, z), r2 = at2(x, z); return r1 - Math.max(0, r2 - r1); };
    const n = Math.max(1, Math.ceil(p.len / (s / 2)));
    for (let k = 0; k < n; k++) {
      const a = k / n, b = (k + 1) / n, xa = p.x1 + (p.x2 - p.x1) * a, za = p.z1 + (p.z2 - p.z1) * a, xb = p.x1 + (p.x2 - p.x1) * b, zb = p.z1 + (p.z2 - p.z1) * b;
      const ha = roofAt(xa, za) - 0.15, hb = roofAt(xb, zb) - 0.15; if (ha < p.h + 0.05 && hb < p.h + 0.05) continue;
      const ya = Math.max(p.h, ha), yb = Math.max(p.h, hb), sa = (p.s0 || 0) + a * p.len, sb = (p.s0 || 0) + b * p.len;
      // set the face just outside the wall's outer face so it lines up with the siding below
      const ox = nx * -ins * (p.t || 0.375) / 2, oz = nz * -ins * (p.t || 0.375) / 2;
      const A0 = [xa + ox, p.h, za + oz], B0 = [xb + ox, p.h, zb + oz], B1 = [xb + ox, yb, zb + oz], A1 = [xa + ox, ya, za + oz];
      // wound to face out (a run drawn the other way round would otherwise be lit as its back face), lit like the wall below
      const L2 = Math.hypot(ox, oz) || 1, ex = B0[0] - A0[0], ez = B0[2] - A0[2];
      // (B0 − A0) × up = (−ez, 0, ex): A0, B0, B1 is counter-clockwise from outside when that points out
      if (-ez * ox + ex * oz > 0) { gp.push(...A0, ...B0, ...B1, ...A0, ...B1, ...A1); guv.push(sa, p.h, sb, p.h, sb, yb, sa, p.h, sb, yb, sa, ya); }
      else { gp.push(...A0, ...B1, ...B0, ...A0, ...A1, ...B1); guv.push(sa, p.h, sb, yb, sb, p.h, sa, p.h, sa, ya, sb, yb); }
      for (let q = 0; q < 6; q++) gn.push(ox / L2, 0, oz / L2);
    }
  }
  if (gp.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2)); gg.setAttribute('normal', new THREE.Float32BufferAttribute(gn, 3)); const gm = sidingMat(1, 1); gm.side = THREE.DoubleSide; group.add(new THREE.Mesh(gg, gm)); }
}
/* The roof's edges, built like a house: a fascia board along every edge (the eaves level, the rakes climbing the
   gables), a K-style gutter hung on each eave's fascia with end caps, and a downspout from each end of a gutter
   down the wall to the ground. Edges against a taller floor's wall (a garage roof running into the house) get
   none: the roof stops at that wall. */
function roofTrim(THREE, group, F, V, plan) {
  const { s, gx0, gz0, nx, nz, roofed } = F, cv = F.cv;
  const vh = (i, j) => V[j * (nx + 1) + i];
  const RFc = (a, b) => a >= 0 && b >= 0 && a < nx && b < nz && roofed[b * nx + a];
  const CVc = (a, b) => !!(cv && a >= 0 && b >= 0 && a < nx && b < nz && cv[b * nx + a]);
  // the outline as straight runs of cell edges: [i0, j0, i1, j1] vertex indices, with the outward normal
  const runs = [];
  for (let j = 0; j < nz; j++) { let a = -1, b = -1; for (let i = 0; i <= nx; i++) { const e = i < nx && RFc(i, j) && !RFc(i, j - 1) && !CVc(i, j - 1); if (e && a < 0) a = i; if (!e && a >= 0) { runs.push({ i0: a, j0: j, i1: i, j1: j, n: [0, -1] }); a = -1; } } }
  for (let j = 0; j < nz; j++) { let a = -1; for (let i = 0; i <= nx; i++) { const e = i < nx && RFc(i, j) && !RFc(i, j + 1) && !CVc(i, j + 1); if (e && a < 0) a = i; if (!e && a >= 0) { runs.push({ i0: a, j0: j + 1, i1: i, j1: j + 1, n: [0, 1] }); a = -1; } } }
  for (let i = 0; i < nx; i++) { let a = -1; for (let j = 0; j <= nz; j++) { const e = j < nz && RFc(i, j) && !RFc(i - 1, j) && !CVc(i - 1, j); if (e && a < 0) a = j; if (!e && a >= 0) { runs.push({ i0: i, j0: a, i1: i, j1: j, n: [-1, 0] }); a = -1; } } }
  for (let i = 0; i < nx; i++) { let a = -1; for (let j = 0; j <= nz; j++) { const e = j < nz && RFc(i, j) && !RFc(i + 1, j) && !CVc(i + 1, j); if (e && a < 0) a = j; if (!e && a >= 0) { runs.push({ i0: i + 1, j0: a, i1: i + 1, j1: j, n: [1, 0] }); a = -1; } } }
  const P = (i, j) => [gx0 + i * s, gz0 + j * s];
  const trimMat = new THREE.MeshLambertMaterial({ color: 0xf3f3f0, name: 'Fascia and rake trim, white' });
  const gutMat = new THREE.MeshPhongMaterial({ color: 0xeef0f0, specular: 0x555555, shininess: 40, side: THREE.DoubleSide, name: 'Gutter, aluminum' });
  const fp = [], gp = [];
  const quad = (arr, a, b, c, d) => arr.push(...a, ...b, ...c, ...a, ...c, ...d);
  const FH = 0.62, FT = 0.07;   // fascia 7½″ deep, ~1″ thick
  const elev = plan.__elev || 0, downs = [];
  // split each run into lengths where its height is level (eave) or climbing (rake)
  for (const r of runs) {
    const di = Math.sign(r.i1 - r.i0), dj = Math.sign(r.j1 - r.j0), L = Math.max(Math.abs(r.i1 - r.i0), Math.abs(r.j1 - r.j0));
    const pts = []; for (let k = 0; k <= L; k++) { const i = r.i0 + di * k, j = r.j0 + dj * k; const [x, z] = P(i, j); pts.push([x, vh(i, j), z]); }
    // fascia: a board under the edge all the way along, its face 1″ out from the roof edge
    const ox = r.n[0] * FT, oz = r.n[1] * FT;
    for (let k = 0; k < L; k++) {
      const a = pts[k], b = pts[k + 1];
      quad(fp, [a[0] + ox, a[1] - FH, a[2] + oz], [b[0] + ox, b[1] - FH, b[2] + oz], [b[0] + ox, b[1] + 0.05, b[2] + oz], [a[0] + ox, a[1] + 0.05, a[2] + oz]);
      // its top edge (a cap over the roofing's edge) and its underside
      quad(fp, [a[0], a[1] + 0.05, a[2]], [a[0] + ox, a[1] + 0.05, a[2] + oz], [b[0] + ox, b[1] + 0.05, b[2] + oz], [b[0], b[1] + 0.05, b[2]]);
      quad(fp, [a[0], a[1] - FH, a[2]], [b[0], b[1] - FH, b[2]], [b[0] + ox, b[1] - FH, b[2] + oz], [a[0] + ox, a[1] - FH, a[2] + oz]);
    }
    // gutters on the level stretches (eaves): K-style, 5″ wide, 4½″ deep, hung just under the roof edge
    const level = (k) => Math.abs(pts[k + 1][1] - pts[k][1]) < 0.02;
    for (let k = 0; k < L;) {
      if (!level(k)) { k++; continue; }
      let e = k; while (e + 1 < L && level(e + 1)) e++;
      const a = pts[k], b = pts[e + 1], len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (len >= 1.5) {
        const ux = (b[0] - a[0]) / len, uz = (b[2] - a[2]) / len, ex = r.n[0], ez = r.n[1], y1 = a[1] - 0.08, y0 = y1 - 0.38, W = 0.42, o1 = FT, o2 = FT + W;
        const G = (o, y, t) => [a[0] + ux * t + ex * o, y, a[2] + uz * t + ez * o];
        const t0 = -0.04, t1 = len + 0.04;
        // back, bottom, the front's ogee (a slope then straight up), a bead along the top, and the end caps
        quad(gp, G(o1, y0, t0), G(o1, y0, t1), G(o1, y1, t1), G(o1, y1, t0));
        quad(gp, G(o1, y0, t0), G(o2 - 0.07, y0, t0), G(o2 - 0.07, y0, t1), G(o1, y0, t1));
        quad(gp, G(o2 - 0.07, y0, t0), G(o2, y0 + 0.14, t0), G(o2, y0 + 0.14, t1), G(o2 - 0.07, y0, t1));
        quad(gp, G(o2, y0 + 0.14, t0), G(o2, y1, t0), G(o2, y1, t1), G(o2, y0 + 0.14, t1));
        quad(gp, G(o2, y1, t0), G(o2 - 0.05, y1, t0), G(o2 - 0.05, y1, t1), G(o2, y1, t1));
        for (const t of [t0, t1]) { gp.push(...G(o1, y0, t), ...G(o2 - 0.07, y0, t), ...G(o2, y0 + 0.14, t), ...G(o1, y0, t), ...G(o2, y0 + 0.14, t), ...G(o2, y1, t), ...G(o1, y0, t), ...G(o2, y1, t), ...G(o1, y1, t)); }
        // a downspout near each end, on the wall under the overhang (ends against a taller wall have none)
        const back = (F.ov || 1) - 0.12;
        for (const [t, endI, endJ] of [[Math.min(len / 2, F.ov + 0.45), r.i0 + di * k, r.j0 + dj * k], [Math.max(len / 2, len - F.ov - 0.45), r.i0 + di * (e + 1), r.j0 + dj * (e + 1)]]) {
          // an end that runs into a covered (taller-floor) area keeps its cap but no downspout
          const ci = endI - (r.n[0] < 0 ? 1 : 0) + (di ? (t < len / 2 ? -1 : 0) : 0), cj = endJ - (r.n[1] < 0 ? 1 : 0) + (dj ? (t < len / 2 ? -1 : 0) : 0);
          if (CVc(ci, cj) || CVc(ci - di, cj - dj) || CVc(ci + di, cj + dj)) continue;
          downs.push({ x: a[0] + ux * t, z: a[2] + uz * t, ex, ez, back, top: y0, bottom: -elev + 0.12 });
        }
      }
      k = e + 1;
    }
  }
  const mk = (arr, mat) => { if (!arr.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); group.add(m); return m; };
  const fm = mk(fp, trimMat); if (fm) fm.material.side = THREE.DoubleSide;
  mk(gp, gutMat);
  // downspouts: 3″ × 4″: out of the gutter's bottom, an offset back under the soffit to the wall, straight down,
  // and a short kick-out at the foot
  const dsMat = new THREE.MeshPhongMaterial({ color: 0xeef0f0, specular: 0x555555, shininess: 40, name: 'Downspout, aluminum' });
  const seen = [];
  for (const d of downs) {
    if (seen.some(q => Math.hypot(q.x - d.x, q.z - d.z) < 1.5)) continue; seen.push(d);
    const wx = d.x - d.ex * d.back, wz = d.z - d.ez * d.back, gx = d.x + d.ex * (FT + 0.2), gz = d.z + d.ez * (FT + 0.2);
    const yOff = d.top - 0.45, len = yOff - d.bottom; if (len < 1) continue;
    const add = (sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), dsMat); m.position.set(x, y, z); group.add(m); };
    const along = Math.abs(d.ex) > 0.5;   // the offset runs across x when the eave faces ±x
    add(0.25, 0.4, 0.25, gx, d.top - 0.2, gz);   // outlet
    const ol = Math.hypot(gx - wx, gz - wz); add(along ? ol : 0.25, 0.22, along ? 0.25 : ol, (gx + wx) / 2, yOff + 0.05, (gz + wz) / 2);   // offset to the wall
    add(along ? 0.25 : 0.33, len, along ? 0.33 : 0.25, wx, d.bottom + len / 2, wz);   // down the wall
    add(along ? 0.7 : 0.33, 0.2, along ? 0.33 : 0.7, wx + d.ex * 0.3, d.bottom + 0.1, wz + d.ez * 0.3);   // kick-out
  }
}
/* a house item as a small 3D model */
/* A machine from a drawing in 3D: each line of its plan stands up as a thin panel the machine's height (its
   enclosure walls and doors), with a light top over the lines that close a box, so it reads as a cabinet.
   Door swings stay on the plan. */
function machineMesh(THREE, it) {
  const g = new THREE.Group(), h = Math.max(1, +it.h || 8), t = 0.12, pos = [];
  for (const q of it.lines || []) {
    const L = Math.hypot(q[2] - q[0], q[3] - q[1]); if (L < 0.02) continue;
    const nx = -(q[3] - q[1]) / L * t / 2, nz = (q[2] - q[0]) / L * t / 2;
    const A = [q[0] + nx, q[1] + nz], B = [q[2] + nx, q[3] + nz], C = [q[2] - nx, q[3] - nz], D = [q[0] - nx, q[1] - nz];
    const quad = (p1, p2, y0, y1) => pos.push(p1[0], y0, p1[1], p2[0], y0, p2[1], p2[0], y1, p2[1], p1[0], y0, p1[1], p2[0], y1, p2[1], p1[0], y1, p1[1]);
    quad(A, B, 0, h); quad(C, D, 0, h); quad(B, C, 0, h); quad(D, A, 0, h);
    pos.push(A[0], h, A[1], B[0], h, B[1], C[0], h, C[1], A[0], h, A[1], C[0], h, C[1], D[0], h, D[1]);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0x8e9ba3, specular: 0x444444, shininess: 30, side: THREE.DoubleSide, name: 'Equipment' })); g.add(m);
  // a dark line along the top and the foot of every panel, so the shape reads from any side
  const lp = []; for (const q of it.lines || []) { lp.push(q[0], h + 0.01, q[1], q[2], h + 0.01, q[3], q[0], 0.02, q[1], q[2], 0.02, q[3]); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2c3438 })));
  // its top: a see-through cover over its footprint box, so it shows as one machine from above
  if (it.w > 0 && it.d > 0) { const top = new THREE.Mesh(new THREE.BoxGeometry(it.w, 0.02, it.d), new THREE.MeshLambertMaterial({ color: 0x7d8c95, transparent: true, opacity: 0.6, depthWrite: false, name: 'Equipment outline (helper)' })); top.position.set(0, h, 0); g.add(top); }
  g.position.set(it.x, 0, it.y); g.rotation.y = -(it.a || 0);
  return g;
}
function itemMesh(THREE, it, M, opt) {
  opt = opt || {};
  if (it.type === 'machine') return machineMesh(THREE, it);
  const D = ITEMS[it.type], w = it.w || D.w, d = it.d || D.d, h = (D.sz && it.h > 0) ? it.h : D.h, z0 = D.ceil ? Math.max(1, (opt.H || 8) - h) : (D.z || 0), g = new THREE.Group();
  const mat = (c, sp) => new THREE.MeshPhongMaterial({ color: c, specular: sp || 0x222222, shininess: sp ? 60 : 14 });
  const F = finishOf(opt.plan), hex = (k, v) => parseInt(((FINISH[k][v] || [])[1] || '#888888').slice(1), 16);
  const cab = mat(hex('cabinet', F.cabinet)), counter = mat(hex('counter', F.counter), 0x555555), steel = mat(0xc9ced2, 0x999999), porcelain = mat(0xfbfbfb, 0x777777), dark = mat(0x26292c, 0x444444), wood = mat(hex('cabinet', F.cabinet) === 0xf3f1ec ? 0xe9e5dd : hex('cabinet', F.cabinet));
  const fabric = mat(0x8d9399), fabric2 = mat(0xb9b2a6), oak = mat(0xb98f62), walnut = mat(0x6b4a33), black = mat(0x232527, 0x444444), brass = mat(0xc8a35a, 0xaaaaaa), linen = mat(0xf2efe8), glow = new THREE.MeshBasicMaterial({ color: 0xfff4d6 });
  // a chair: seat, back and four legs, its seat centred at (x, z), facing angle ry
  const chair = (x, z, ry, m) => { const c = new THREE.Group(); const b = (px, py, pz, sx, sy, sz, mm) => { const q = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mm); q.position.set(px, py, pz); c.add(q); }; b(0, 1.5, 0, 1.4, 0.12, 1.4, m); b(0, 2.4, -0.65, 1.4, 1.7, 0.12, m); for (const [lx, lz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b(lx, 0.75, lz, 0.1, 1.5, 0.1, walnut); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); };
  const box = (x, y, z, sx, sy, sz, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); g.add(b); return b; };
  const cyl = (x, y, z, r, hh, m, seg) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hh, seg || 24), m); c.position.set(x, y, z); g.add(c); return c; };
  // local axes: x along the width, z out from the wall (back at -d/2), y up
  switch (it.type) {
    case 'base': case 'sinkbase': case 'island': {
      box(0, 0.25, 0.05, w - 0.02, 0.33, d - 0.25, dark); box(0, 1.6, 0, w - 0.02, 2.55, d - 0.1, cab);
      const doors = Math.max(1, Math.round(w / 1.5)); for (let k = 0; k < doors; k++) { const x = -w / 2 + (k + 0.5) * w / doors; box(x, 1.45, d / 2 - 0.03, w / doors - 0.1, 1.7, 0.04, wood); box(x, 2.6, d / 2 - 0.03, w / doors - 0.1, 0.42, 0.04, wood); }
      box(0, 2.94, 0.04, w + 0.05, 0.12, d + 0.08, counter);
      if (it.type === 'sinkbase') { box(0, 2.95, 0.05, Math.min(2.3, w - 0.5), 0.13, 1.3, steel); cyl(0, 3.25, -0.65, 0.04, 0.6, steel); }
      break;
    }
    case 'upper': box(0, 1.25, 0, w - 0.02, 2.5, d, cab); for (let k = 0, n = Math.max(1, Math.round(w / 1.5)); k < n; k++) box(-w / 2 + (k + 0.5) * w / n, 1.25, d / 2, w / n - 0.1, 2.3, 0.04, wood); break;
    case 'tall': box(0, 3.5, 0, w - 0.02, 7, d - 0.05, cab); box(0, 3.6, d / 2, w - 0.12, 6.6, 0.04, wood); break;
    case 'range': box(0, 1.45, 0, w, 2.9, d, steel); box(0, 2.93, 0, w, 0.06, d, dark); for (const [x, z] of [[-0.55, -0.4], [0.55, -0.4], [-0.55, 0.4], [0.55, 0.4]]) cyl(x, 2.97, z, 0.33, 0.02, mat(0x111111)); box(0, 1.3, d / 2 + 0.01, w - 0.3, 1.5, 0.03, dark); box(0, 3.4, -d / 2 + 0.08, w, 0.8, 0.12, steel); break;
    case 'fridge': box(0, h / 2, 0, w, h, d, steel); box(0, h * 0.68, d / 2 + 0.01, 0.02, h * 0.62, 0.02, dark); box(-0.12, h * 0.68, d / 2 + 0.06, 0.05, 1.6, 0.06, steel); box(0.12, h * 0.68, d / 2 + 0.06, 0.05, 1.6, 0.06, steel); box(0, h * 0.36, d / 2 + 0.01, w, 0.02, 0.02, dark); break;
    case 'dishwasher': box(0, 1.42, 0, w - 0.02, 2.83, d - 0.05, steel); box(0, 2.6, d / 2, w - 0.1, 0.06, 0.06, dark); box(0, 2.94, 0.04, w + 0.05, 0.12, d + 0.08, counter); break;
    case 'toilet': { box(0, 1.25, -d / 2 + 0.33, w * 0.95, 1.2, 0.62, porcelain); const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.45, 1.25, 24), porcelain); bowl.scale.set(0.95, 1, 1.25); bowl.position.set(0, 0.62, 0.3); g.add(bowl); box(0, 1.27, 0.32, 1.2, 0.06, 1.45, porcelain); break; }
    case 'vanity': box(0, 1.3, 0, w - 0.02, 2.5, d - 0.05, wood); box(0, 2.78, 0.02, w + 0.04, 0.1, d + 0.04, mat(0xeae6df, 0x666666)); box(0, 2.8, 0.05, Math.min(1.6, w - 0.6), 0.1, 1.0, porcelain); cyl(0, 3.1, -d / 2 + 0.25, 0.04, 0.5, steel); box(0, 4.6, -d / 2 + 0.03, Math.min(w, 3), 2.6, 0.05, mat(0xcfe3ea, 0xffffff)); break;
    case 'stairs': case 'stairsL': {
      // treads and risers up to the floor above (rise from the plan), stringers, a handrail on the open side
      const rise = (opt.plan && opt.plan.__rise) || ((opt.H || 8) + 1), n = Math.max(2, Math.ceil(rise * 12 / 7.75)), rh = rise / n;
      const oak2 = mat(0xb98f62), wht = mat(0xf2f0eb), rail = mat(0x6b4a33);
      if (it.type === 'stairs') {
        const tr = d / (n - 1);
        for (let k = 0; k < n - 1; k++) { const z = -d / 2 + tr * (k + 0.5); box(0, rh * (k + 1) - 0.04, z, w, 0.08, tr + 0.08, oak2); box(0, rh * (k + 0.5), z - tr / 2 + 0.02, w, rh, 0.04, wht); }
        for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, Math.hypot(d, rise)), wht); st.position.set(sx * (w / 2 - 0.06), rise / 2 - 0.3, 0); st.rotation.x = Math.atan2(rise, d); g.add(st); }
        const hr = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, Math.hypot(d, rise)), rail); hr.position.set(w / 2 - 0.1, rise / 2 + 3, 0); hr.rotation.x = Math.atan2(rise, d); g.add(hr);
        for (let k = 0; k < n - 1; k += 2) { const z = -d / 2 + (d / (n - 1)) * (k + 0.5); box(w / 2 - 0.1, rh * (k + 1) + 1.5, z, 0.06, 3, 0.06, wht); }
      } else {
        // two runs and a square landing at half height: up along the right side, across the landing, back along the left
        const half = Math.ceil(n / 2), wr = w / 2 - 0.1, run = d - wr, tr = run / (half - 1), y0 = rh * half;
        for (let k = 0; k < half - 1; k++) { const z = d / 2 - tr * (k + 0.5); box(w / 4, rh * (k + 1) - 0.04, z, wr, 0.08, tr + 0.08, oak2); box(w / 4, rh * (k + 0.5), z + tr / 2 - 0.02, wr, rh, 0.04, wht); }
        box(0, y0 - 0.04, -d / 2 + wr / 2, w, 0.08, wr, oak2); box(0, y0 / 2, -d / 2 + wr / 2, w, y0, wr, wht);
        for (let k = 0; k < n - half - 1; k++) { const z = -d / 2 + wr + tr * (k + 0.5); box(-w / 4, y0 + rh * (k + 1) - 0.04, z, wr, 0.08, tr + 0.08, oak2); box(-w / 4, y0 + rh * (k + 0.5), z - tr / 2 + 0.02, wr, rh, 0.04, wht); }
      }
      break;
    }
    case 'tub': box(0, h / 2, 0, w, h, d, porcelain); box(0, h - 0.05, 0.02, w - 0.5, 0.12, d - 0.45, mat(0xe9eef0)); cyl(-w / 2 + 0.35, h + 0.25, -d / 2 + 0.3, 0.04, 0.5, steel); break;
    case 'shower': box(0, 0.12, 0, w, 0.24, d, porcelain); box(0, h / 2, d / 2 - 0.02, w, h, 0.03, M.glass); box(-w / 2 + 0.02, h / 2, 0, 0.03, h, d, M.glass); cyl(0, 6.2, -d / 2 + 0.25, 0.25, 0.04, steel); break;
    case 'washer': case 'dryer': box(0, h / 2, 0, w, h, d, porcelain); box(0, h - 0.2, -d / 2 + 0.2, w, 0.4, 0.4, mat(0xdde1e3)); { const c = cyl(0, 1.55, d / 2 + 0.01, 0.7, 0.05, it.type === 'washer' ? mat(0x9fb6c2, 0xffffff) : dark, 32); c.rotation.x = Math.PI / 2; } break;
    case 'waterheater': cyl(0, h / 2, 0, w / 2, h, mat(0xe8e9e6), 28); cyl(0, h + 0.2, 0, 0.1, 0.4, steel); break;
    case 'furnace': box(0, h / 2, 0, w, h, d, mat(0xd9dcd9)); box(0, h + 0.6, 0, w * 0.9, 1.2, d * 0.9, steel); break;
    // ---- kitchen extras
    case 'walloven': box(0, h / 2, 0, w - 0.02, h, d - 0.05, cab); for (const y of [2.6, 4.6]) { box(0, y, d / 2, w - 0.3, 1.7, 0.05, steel); box(0, y + 0.3, d / 2 + 0.05, w - 0.6, 0.9, 0.02, dark); box(0, y + 0.95, d / 2 + 0.08, w - 0.7, 0.05, 0.06, steel); } break;
    case 'hood': { const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.35, Math.max(w, d) * 0.62, h * 0.55, 4, 1), steel); cn.rotation.y = Math.PI / 4; cn.scale.set(1, 1, d / w); cn.position.set(0, h * 0.28, 0); g.add(cn); box(0, h * 0.78, -d / 2 + 0.35, 0.8, h * 0.44, 0.7, steel); break; }
    case 'microwave': box(0, h / 2, 0, w, h, d, steel); box(-0.25, h / 2, d / 2, w * 0.62, h * 0.7, 0.02, dark); break;
    case 'winefridge': box(0, 1.42, 0, w - 0.02, 2.83, d - 0.05, steel); box(0, 1.45, d / 2, w - 0.2, 2.4, 0.03, M.glass); for (let y = 0.4; y < 2.6; y += 0.45) box(0, y, 0, w - 0.25, 0.04, d - 0.3, walnut); box(0, 2.94, 0.04, w + 0.05, 0.12, d + 0.08, counter); break;
    case 'stools': for (const x of [-w / 3, 0, w / 3]) { cyl(x, 2.1, 0, 0.6, 0.12, walnut); cyl(x, 1.05, 0, 0.06, 2.0, black, 8); const r = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 6, 20), black); r.rotation.x = Math.PI / 2; r.position.set(x, 0.75, 0); g.add(r); } break;
    case 'pantrywall': box(0, 1.5, 0.05, w, 3, d - 0.1, cab); box(0, 3.05, 0.04, w + 0.05, 0.1, d, counter); box(0, 5.6, -d / 2 + 0.6, w, 2.8, 1.2, cab); for (const y of [4.3, 5.0]) box(0, y, -d / 2 + 0.25, w - 0.2, 0.05, 0.5, walnut); break;
    // ---- bathroom extras
    case 'dblvanity': box(0, 1.3, 0, w - 0.02, 2.5, d - 0.05, wood); box(0, 2.78, 0.02, w + 0.04, 0.1, d + 0.04, counter); for (const x of [-w / 4, w / 4]) { box(x, 2.8, 0.05, 1.3, 0.1, 1.0, porcelain); cyl(x, 3.1, -d / 2 + 0.25, 0.04, 0.5, steel); } break;
    case 'freetub': { const t = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.85, h, 32), porcelain); t.scale.set(w / 2, 1, d / 2); t.position.y = h / 2; g.add(t); const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.8, 0.1, 32), mat(0xe9eef0)); inner.scale.set(w / 2, 1, d / 2); inner.position.y = h - 0.03; g.add(inner); cyl(w / 2 + 0.4, 1.9, 0, 0.05, 3.8, steel, 8); break; }
    case 'linen': box(0, h / 2, 0, w - 0.02, h, d - 0.05, wood); box(0, h * 0.6, d / 2, w - 0.12, h * 0.75, 0.04, cab); break;
    case 'mirror': box(0, h / 2, 0, w, h, 0.06, mat(0xdfe7ea, 0xffffff)); box(0, h / 2, -0.02, w + 0.12, h + 0.12, 0.04, brass); break;
    case 'bidet': { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.45, 1.3, 24), porcelain); b.scale.set(0.95, 1, 1.4); b.position.set(0, 0.65, 0.1); g.add(b); break; }
    // ---- laundry extras
    case 'utilsink': box(0, 2.3, 0, w, 1.2, d, porcelain); for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) box(x, 0.85, z, 0.08, 1.7, 0.08, porcelain); cyl(0, 3.2, -d / 2 + 0.2, 0.04, 0.6, steel); break;
    case 'laundrycounter': box(0, 2.94, 0.04, w, 0.12, d, counter); box(0, 5.5, -d / 2 + 0.5, w, 0.06, 1, cab); for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) box(x, 1.45, 0, 0.1, 2.9, d - 0.2, cab); break;
    // ---- living room
    case 'sofa': case 'loveseat': { box(0, 0.8, 0.1, w, 0.9, d - 0.2, fabric); box(0, 1.9, -d / 2 + 0.35, w, 1.7, 0.7, fabric); for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) box(x, 1.4, 0, 0.6, 1.0, d, fabric); const n = it.type === 'sofa' ? 3 : 2; for (let k = 0; k < n; k++) box(-w / 2 + 0.6 + (k + 0.5) * (w - 1.2) / n, 1.35, 0.2, (w - 1.2) / n - 0.05, 0.25, d - 0.9, fabric2); for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) box(x, 0.15, z, 0.15, 0.3, 0.15, walnut); break; }
    case 'sectional': { box(0, 0.8, -d / 2 + 1.5, w, 0.9, 3, fabric); box(0, 1.9, -d / 2 + 0.35, w, 1.7, 0.7, fabric); box(w / 2 - 1.5, 0.8, 1.5, 3, 0.9, d - 3, fabric); box(w / 2 - 0.35, 1.9, 1.5, 0.7, 1.7, d - 3, fabric); box(-w / 2 + 0.3, 1.4, -d / 2 + 1.5, 0.6, 1.0, 3, fabric); for (let k = 0; k < 3; k++) box(-w / 2 + 1.2 + k * 2.2, 1.35, -d / 2 + 1.7, 2.1, 0.25, 2.1, fabric2); box(w / 2 - 1.7, 1.35, 1.5, 2.1, 0.25, d - 3.4, fabric2); break; }
    case 'armchair': box(0, 0.8, 0.1, w, 0.9, d - 0.2, fabric2); box(0, 1.9, -d / 2 + 0.3, w, 1.7, 0.6, fabric2); for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) box(x, 1.4, 0, 0.5, 1.0, d, fabric2); break;
    case 'coffeetable': box(0, h - 0.08, 0, w, 0.16, d, walnut); box(0, 0.45, 0, w - 0.3, 0.08, d - 0.3, walnut); for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) for (const z of [-d / 2 + 0.15, d / 2 - 0.15]) box(x, h / 2, z, 0.12, h, 0.12, black); break;
    case 'sidetable': cyl(0, h - 0.05, 0, w / 2, 0.1, walnut); cyl(0, h / 2, 0, 0.12, h, black, 10); cyl(0, 0.05, 0, w / 3, 0.1, black); cyl(0, h + 0.6, 0, 0.35, 0.9, linen, 16); break;
    case 'tvconsole': box(0, 1, 0, w, 2, d, walnut); box(0, 1, d / 2, w - 0.2, 1.6, 0.03, oak); box(0, 4.2, -d / 2 + 0.15, 4.6, 2.6, 0.12, black); box(0, 4.2, -d / 2 + 0.22, 4.4, 2.45, 0.02, mat(0x0d0f12, 0x666666)); break;
    case 'fireplace': box(0, 2.1, 0, w, 4.2, d, mat(0xd8d4cc)); box(0, 1.35, d / 2 - 0.05, w * 0.55, 1.9, 0.12, mat(0x1a1b1d)); box(0, 0.75, d / 2 - 0.08, w * 0.4, 0.25, 0.06, mat(0xff8a3d)); box(0, 4.3, 0.1, w + 0.6, 0.25, d + 0.4, walnut); box(0, 0.12, 0.6, w + 0.6, 0.24, d + 1.0, mat(0x6f6c68)); break;
    case 'bookcase': box(0, h / 2, -d / 2 + 0.05, w, h, 0.1, walnut); for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) box(x, h / 2, 0, 0.1, h, d, walnut); for (let y = 0.2; y < h; y += h / 6) { box(0, y, 0, w, 0.08, d, walnut); for (let k = 0; k < 6; k++) box(-w / 2 + 0.3 + k * 0.4, y + 0.45, 0, 0.25, 0.8, d - 0.3, mat([0x7d3b33, 0x2f4a6b, 0x5a6b3a, 0xc9b27d, 0x3a3a3a, 0x9b5d2b][k])); } break;
    case 'rug': box(0, 0.02, 0, w, 0.03, d, mat(0xc7bba7)); box(0, 0.035, 0, w - 0.8, 0.01, d - 0.8, mat(0x9aa4a8)); break;
    // ---- dining
    case 'dining6': { const tw = w - 1.5, td = 3.33; box(0, 2.4, 0, tw, 0.15, td, oak); for (const x of [-tw / 2 + 0.3, tw / 2 - 0.3]) for (const z of [-td / 2 + 0.3, td / 2 - 0.3]) box(x, 1.15, z, 0.2, 2.3, 0.2, oak); for (const x of [-tw / 3, 0, tw / 3]) { chair(x, -td / 2 - 0.7, 0, fabric2); chair(x, td / 2 + 0.7, Math.PI, fabric2); } break; }
    case 'dining4': { cyl(0, 2.4, 0, 2, 0.15, oak, 40); cyl(0, 1.2, 0, 0.25, 2.3, oak, 12); cyl(0, 0.08, 0, 0.9, 0.16, oak); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; chair(Math.sin(a) * 2.6, Math.cos(a) * 2.6, a + Math.PI, fabric2); } break; }
    case 'buffet': box(0, 1.6, 0, w, 2.6, d, walnut); box(0, 0.15, 0, w - 0.3, 0.3, d - 0.2, black); for (let k = 0; k < 3; k++) box(-w / 3 + k * w / 3, 1.6, d / 2, w / 3 - 0.1, 2.3, 0.04, oak); break;
    // ---- bedroom
    case 'kingbed': case 'queenbed': case 'twinbed': box(0, 0.6, 0.1, w, 0.6, d - 0.2, walnut); box(0, 1.2, 0.15, w - 0.15, 0.7, d - 0.4, linen); box(0, 1.6, 0.55, w - 0.1, 0.2, d - 1.6, mat(0x7f8e9c)); box(0, h / 2 + 0.3, -d / 2 + 0.1, w + 0.2, h + 0.6, 0.2, fabric); for (const x of (it.type === 'twinbed' ? [0] : [-w / 4, w / 4])) box(x, 1.75, -d / 2 + 0.9, (it.type === 'twinbed' ? w - 0.6 : w / 2 - 0.4), 0.35, 1.1, linen); break;
    case 'nightstand': box(0, h / 2, 0, w, h, d, walnut); box(0, h * 0.62, d / 2, w - 0.15, h * 0.3, 0.03, oak); cyl(0, h + 0.55, -0.1, 0.35, 0.8, linen, 16); cyl(0, h + 0.1, -0.1, 0.12, 0.2, brass); break;
    case 'dresser': box(0, h / 2, 0, w, h, d, walnut); for (let r = 0; r < 3; r++) for (const x of [-w / 4, w / 4]) { box(x, 0.5 + r * 0.85, d / 2, w / 2 - 0.15, 0.75, 0.03, oak); box(x, 0.5 + r * 0.85, d / 2 + 0.04, 0.4, 0.05, 0.05, brass); } break;
    case 'closet': box(0, 5.5, 0, w, 0.06, d, cab); cyl(0, 5.25, 0.25, 0.05, w, steel, 8).rotation.z = Math.PI / 2; for (let k = 0; k < 10; k++) box(-w / 2 + 0.4 + k * (w - 0.8) / 9, 4.1, 0.25, 0.04, 2.2, 1.6, mat([0x2f4a6b, 0xe8e2d6, 0x6b6f72, 0x9b5d2b, 0x1f2124][k % 5])); break;
    case 'desk': box(0, 2.45, -d / 2 + 1.25, w, 0.1, 2.5, oak); for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) box(x, 1.2, -d / 2 + 1.25, 0.1, 2.4, 2.4, black); box(0, 3.4, -d / 2 + 0.4, 2, 1.25, 0.08, black); chair(0, d / 2 - 0.9, Math.PI, black); break;
    // ---- lighting (hangs from the ceiling)
    case 'ceilfan': { cyl(0, h - 0.25, 0, 0.06, 0.5, black, 8); cyl(0, 0.55, 0, 0.45, 0.35, black); cyl(0, 0.3, 0, 0.35, 0.15, glow); for (let k = 0; k < 5; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.45), walnut); const a = k * Math.PI * 2 / 5; bl.position.set(Math.cos(a) * 1.15, 0.6, Math.sin(a) * 1.15); bl.rotation.y = -a; g.add(bl); } break; }
    case 'chandelier': { cyl(0, h - 0.4, 0, 0.03, 0.8, brass, 6); const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.04, 8, 32), brass); ring.rotation.x = Math.PI / 2; ring.position.y = 0.9; g.add(ring); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; cyl(Math.cos(a), 1.05, Math.sin(a), 0.07, 0.3, glow, 8); } break; }
    case 'pendants': for (const x of [-w / 3, 0, w / 3]) { cyl(x, h - 0.6, 0, 0.015, 1.2, black, 6); const sh = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.55, 20, 1, true), black); sh.position.set(x, 0.75, 0); g.add(sh); cyl(x, 0.55, 0, 0.18, 0.1, glow, 12); } break;
    case 'sconce': for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) { box(x, h / 2, -d / 2 + 0.05, 0.3, 0.5, 0.05, brass); cyl(x, h / 2 + 0.1, 0, 0.18, 0.45, glow, 12); } break;
    // ---- outdoor & garage
    case 'car': { box(0, 1.6, 0, w - 0.2, 1.6, d, mat(0x3c5a7a, 0x888888)); box(0, 3.3, -0.6, w - 0.7, 1.8, d * 0.5, mat(0x2a3542, 0x888888)); box(0, 3.3, -0.6, w - 0.6, 1.4, d * 0.48, M.glass); for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) for (const z of [-d / 2 + 2.8, d / 2 - 2.8]) { const wh = cyl(x, 1.05, z, 1.05, 0.8, black, 20); wh.rotation.z = Math.PI / 2; } break; }
    case 'workbench': box(0, 2.95, 0, w, 0.12, d, oak); for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) box(x, 1.45, 0, 0.12, 2.9, d - 0.2, black); box(0, 0.6, 0, w - 0.3, 0.06, d - 0.3, oak); box(0, 4.6, -d / 2 + 0.05, w, 2.5, 0.06, mat(0x9aa0a4)); break;
    case 'grill': box(0, 1.6, 0, w * 0.6, 1.6, d, black); box(0, 3.0, -0.2, w * 0.6, 1.0, d - 0.4, steel); for (const x of [-w * 0.4, w * 0.4]) box(x, 2.3, 0, w * 0.2, 0.1, d - 0.2, steel); break;
    case 'hottub': box(0, h / 2, 0, w, h, d, walnut); box(0, h - 0.05, 0, w - 0.8, 0.1, d - 0.8, mat(0x5fb8d6, 0xffffff)); break;
    case 'patioset': cyl(0, 2.4, 0, 1.6, 0.1, black, 32); cyl(0, 1.2, 0, 0.15, 2.4, black, 10); cyl(0, 5.3, 0, 0.06, 5.6, mat(0xd8d2c4), 8); { const um = new THREE.Mesh(new THREE.ConeGeometry(4, 1.2, 8), mat(0xe8e1d0)); um.position.y = 7.2; g.add(um); } for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; chair(Math.sin(a) * 2.3, Math.cos(a) * 2.3, a + Math.PI, black); } break;
    case 'condenser': box(0, h / 2, 0, w, h, d, mat(0xd8dbd6)); cyl(0, h + 0.02, 0, w * 0.4, 0.05, black, 24); break;
    // ---- cleanroom furniture and equipment: brushed 304 stainless, white powder coat, dark casters
    case 'sstable': case 'sscart': case 'shelving': case 'sscabinet': case 'gownbench': case 'gownrack': case 'crchair': case 'sstrash': case 'tackymat':
    case 'ivpole': case 'ivrack': case 'ivbar': case 'lafw': case 'bsc': case 'isolator': case 'medfridge': case 'handsink': case 'scrubsink': case 'dispenser': case 'shoecover': case 'airshower': case 'teardrop': case 'sprinkler': case 'smokedet':
    case 'crstool': case 'wallshelf': case 'wallcab': case 'locker': case 'mirror': case 'bootrack': case 'esdbench': case 'lfbench': case 'desiccator': case 'desicbench': case 'glovebox': case 'fumehood': case 'gowncab': case 'partcart': case 'shoecleaner': case 'wipestation': case 'eyewash': case 'cubicle': {
      const brushed = cachedCanvas('brushed-ss', () => makeCanvas(256, 64, (c, W2, H2) => { c.fillStyle = '#c9ced1'; c.fillRect(0, 0, W2, H2); for (let k = 0; k < 900; k++) { const v = 180 + Math.random() * 60 | 0; c.fillStyle = `rgba(${v},${v + 4},${v + 6},.35)`; c.fillRect(Math.random() * W2, Math.random() * H2, 20 + Math.random() * 90, 1); } }));
      const sst = new THREE.CanvasTexture(brushed); sst.wrapS = sst.wrapT = THREE.RepeatWrapping; sst.repeat.set(2, 1);
      const ss = new THREE.MeshPhongMaterial({ color: 0xe4e8ea, map: sst, specular: 0xffffff, shininess: 90 });
      const ssD = new THREE.MeshPhongMaterial({ color: 0xb4bbbf, specular: 0xcccccc, shininess: 70 });
      const coat = mat(0xf3f4f2, 0x444444), glass = new THREE.MeshPhongMaterial({ color: 0x9fc4d6, specular: 0xffffff, shininess: 100, transparent: true, opacity: 0.35 }), rubber = mat(0x2a2d30), blue = mat(0x3d78b8), lightP = new THREE.MeshBasicMaterial({ color: 0xf6fbff });
      const caster = (x, z) => { cyl(x, 0.12, z, 0.12, 0.1, rubber, 14).rotation.z = Math.PI / 2; box(x, 0.27, z, 0.1, 0.12, 0.1, ssD); };
      const legs = (x0, z0, y0, y1, t, m) => { for (const [x, z] of [[-x0, -z0], [x0, -z0], [-x0, z0], [x0, z0]]) box(x, (y0 + y1) / 2, z, t, y1 - y0, t, m || ss); };
      switch (it.type) {
        case 'sstable': {
          // 14-gauge top with a rolled front edge, tube legs, optional undershelf, backsplash and casters
          const cas = !!it.casters, y0 = cas ? 0.33 : 0.03, ix = w / 2 - 0.12, iz = d / 2 - 0.12;
          box(0, h - 0.04, 0, w, 0.08, d, ss); box(0, h - 0.09, d / 2 - 0.02, w, 0.1, 0.04, ss);
          legs(ix, iz, y0, h - 0.08, 0.14);
          if (cas) for (const [x, z] of [[-ix, -iz], [ix, -iz], [-ix, iz], [ix, iz]]) caster(x, z); else for (const [x, z] of [[-ix, -iz], [ix, -iz], [-ix, iz], [ix, iz]]) cyl(x, 0.03, z, 0.09, 0.06, ssD, 12);
          if (it.shelf !== false) box(0, Math.max(0.55, y0 + 0.4), 0, w - 0.1, 0.05, d - 0.1, ss);
          else { box(0, 0.75, -iz, w - 0.3, 0.08, 0.08, ss); for (const x of [-ix, ix]) box(x, 0.75, 0, 0.08, 0.08, d - 0.3, ss); }
          if (it.splash) box(0, h + 0.25, -d / 2 + 0.03, w, 0.5, 0.06, ss);
          break;
        }
        case 'sscart': {
          const ix = w / 2 - 0.08, iz = d / 2 - 0.08; legs(ix, iz, 0.33, h - 0.05, 0.1);
          for (const y of [0.6, 1.8, h - 0.05]) { box(0, y, 0, w, 0.05, d, ss); box(0, y + 0.08, d / 2 - 0.02, w, 0.14, 0.03, ss); box(0, y + 0.08, -d / 2 + 0.02, w, 0.14, 0.03, ss); }
          for (const [x, z] of [[-ix, -iz], [ix, -iz], [-ix, iz], [ix, iz]]) caster(x, z);
          box(w / 2 + 0.12, h - 0.25, 0, 0.06, 0.06, d * 0.7, ssD); break;
        }
        case 'shelving': {
          const ix = w / 2 - 0.04, iz = d / 2 - 0.04; legs(ix, iz, 0, h, 0.07, ssD);
          const n = Math.max(3, Math.round(h / 1.5)); for (let k = 0; k < n; k++) { const y = 0.5 + k * (h - 0.6) / (n - 1); box(0, y, 0, w - 0.02, 0.04, d - 0.02, ss); for (let q = -w / 2 + 0.25; q < w / 2; q += 0.25) box(q, y - 0.04, 0, 0.015, 0.04, d - 0.06, ssD); }
          break;
        }
        case 'sscabinet': {
          box(0, h / 2 + 0.25, 0, w, h - 0.5, d, ss); legs(w / 2 - 0.1, d / 2 - 0.1, 0, 0.3, 0.1, ssD);
          box(0, h / 2 + 0.25, d / 2 + 0.005, 0.02, h - 0.6, 0.01, ssD); for (const x of [-0.12, 0.12]) box(x, h / 2 + 0.3, d / 2 + 0.05, 0.04, 0.6, 0.06, ssD);
          break;
        }
        case 'gownbench': {
          box(0, h - 0.05, 0, w, 0.1, d, ss); legs(w / 2 - 0.2, d / 2 - 0.15, 0, h - 0.1, 0.12);
          box(0, h + 0.004, 0, 0.12, 0.02, d, mat(0xd9a928)); break;  // the clean / dirty line painted across the top
        }
        case 'gownrack': {
          for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) { box(x, h / 2, 0, 0.08, h, 0.08, ss); box(x, 0.2, 0, 0.08, 0.08, d, ss); caster(x, -d / 2 + 0.1); caster(x, d / 2 - 0.1); }
          cyl(0, h - 0.15, 0, 0.04, w, ss, 10).rotation.z = Math.PI / 2;
          const n = Math.max(2, Math.floor(w / 0.45)); for (let k = 0; k < n; k++) { const x = -w / 2 + 0.3 + k * (w - 0.6) / Math.max(1, n - 1); box(x, h - 2.0, 0, 0.32, 3.6, 1.3, k % 3 === 1 ? mat(0xb9d4ee) : coat); }
          break;
        }
        case 'crchair': {
          for (let k = 0; k < 5; k++) { const a2 = k * Math.PI * 2 / 5, bx = Math.cos(a2) * 0.4, bz = Math.sin(a2) * 0.4; const leg = box(bx, 0.2, bz, 0.8, 0.07, 0.1, ssD); leg.rotation.y = -a2; caster(Math.cos(a2) * 0.8, Math.sin(a2) * 0.8); }
          cyl(0, 1.0, 0, 0.07, 1.4, ss, 12); cyl(0, 1.75, 0, 0.75, 0.22, mat(0x2f3a45), 24); box(0, 2.75, -0.62, 1.2, 1.1, 0.16, mat(0x2f3a45)); box(0, 2.1, -0.7, 0.12, 0.8, 0.08, ss);
          break;
        }
        case 'sstrash': { cyl(0, h / 2, 0, w / 2 - 0.02, h - 0.1, ss, 28); cyl(0, h - 0.03, 0, w / 2, 0.08, ssD, 28); box(0, 0.08, w / 2, 0.4, 0.06, 0.25, rubber); break; }
        case 'tackymat': { box(0, 0.012, 0, w, 0.024, d, new THREE.MeshPhongMaterial({ color: 0xd9e6f0, specular: 0xffffff, shininess: 60 })); box(0, 0.026, 0, w - 0.25, 0.004, d - 0.25, new THREE.MeshPhongMaterial({ color: 0xc7d9e8, transparent: true, opacity: 0.7 })); break; }
        case 'ivpole': {
          for (let k = 0; k < 5; k++) { const a2 = k * Math.PI * 2 / 5; const leg = box(Math.cos(a2) * 0.45, 0.32, Math.sin(a2) * 0.45, 0.9, 0.07, 0.09, ss); leg.rotation.y = -a2; caster(Math.cos(a2) * 0.88, Math.sin(a2) * 0.88); }
          cyl(0, h / 2 + 0.2, 0, 0.045, h - 0.4, ss, 12);
          for (let k = 0; k < 4; k++) { const a2 = k * Math.PI / 2 + Math.PI / 4; const hk = box(Math.cos(a2) * 0.22, h - 0.05, Math.sin(a2) * 0.22, 0.44, 0.05, 0.05, ss); hk.rotation.y = -a2; cyl(Math.cos(a2) * 0.42, h - 0.12, Math.sin(a2) * 0.42, 0.03, 0.16, ss, 8); }
          box(0.3, h - 0.75, 0.3, 0.32, 0.55, 0.12, new THREE.MeshPhongMaterial({ color: 0xeaf4fb, transparent: true, opacity: 0.8 }));
          break;
        }
        case 'ivrack': {
          box(0, 0.3, 0, w, 0.08, 0.1, ss); for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) { box(x, 0.3, 0, 0.1, 0.08, d, ss); caster(x, -d / 2 + 0.1); caster(x, d / 2 - 0.1); box(x, h / 2 + 0.15, 0, 0.09, h - 0.3, 0.09, ss); }
          for (const y of [h - 0.1, h - 1.2]) { cyl(0, y, 0, 0.04, w, ss, 10).rotation.z = Math.PI / 2; for (let k = 0; k < 6; k++) { const x = -w / 2 + 0.3 + k * (w - 0.6) / 5; box(x, y - 0.1, 0, 0.03, 0.2, 0.03, ss); if (k % 2 === 0) box(x, y - 0.55, 0.02, 0.28, 0.45, 0.1, new THREE.MeshPhongMaterial({ color: 0xeaf4fb, transparent: true, opacity: 0.8 })); } }
          break;
        }
        case 'ivbar': {
          cyl(0, 0.3, 0.1, 0.05, w, ss, 12).rotation.z = Math.PI / 2; for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) box(x, 0.3, -0.06, 0.08, 0.2, 0.32, ss);
          for (let k = 0; k < Math.max(2, Math.floor(w / 0.5)); k++) { const x = -w / 2 + 0.3 + k * 0.5; if (x > w / 2 - 0.2) break; box(x, 0.17, 0.1, 0.03, 0.22, 0.03, ss); }
          break;
        }
        case 'lafw': case 'bsc': case 'isolator': {
          // stand, stainless work surface at 30″, the cabinet with its HEPA housing on top and a lit work zone
          const top = h, ws = 2.5; legs(w / 2 - 0.15, d / 2 - 0.15, 0, ws - 0.1, 0.12, ssD); box(0, 0.6, -d / 2 + 0.15, w - 0.3, 0.06, 0.06, ssD);
          box(0, ws, 0, w, 0.12, d, ss);
          box(-w / 2 + 0.06, (ws + top) / 2, 0, 0.12, top - ws, d, coat); box(w / 2 - 0.06, (ws + top) / 2, 0, 0.12, top - ws, d, coat); box(0, (ws + top) / 2, -d / 2 + 0.06, w, top - ws, 0.12, coat);
          box(0, top - 0.55, 0, w, 1.1, d, coat); box(0, top - 0.55, d / 2 + 0.005, w - 0.4, 0.5, 0.01, mat(0x5b6670)); box(0, ws + 0.07, 0, w - 0.3, 0.02, d - 0.3, ssD);
          box(0, top - 1.13, 0, w - 0.3, 0.04, d - 0.4, lightP);
          if (it.type === 'lafw') { box(0, ws + 1.4, d / 2 - 0.12, w - 0.25, 0.08, 0.06, coat); }
          else if (it.type === 'bsc') { const sash = box(0, ws + 1.45, d / 2 - 0.15, w - 0.25, 1.9, 0.04, glass); sash.rotation.x = -0.18; box(0, ws + 0.35, d / 2 - 0.05, w - 0.25, 0.1, 0.12, ssD); }
          else { box(0, (ws + top - 1.1) / 2 + 0.05, d / 2 - 0.08, w - 0.25, top - ws - 1.2, 0.05, glass); for (const x of [-w / 4, w / 4]) { const p2 = cyl(x, ws + 1.0, d / 2 - 0.05, 0.28, 0.08, mat(0x30353a), 22); p2.rotation.x = Math.PI / 2; } }
          break;
        }
        case 'medfridge': { box(0, h / 2, 0, w, h, d, coat); box(0, h / 2 + 0.1, d / 2 + 0.01, w - 0.25, h - 0.7, 0.03, glass); for (let k = 1; k < 5; k++) box(0, k * (h - 0.6) / 5 + 0.2, 0, w - 0.3, 0.03, d - 0.3, ssD); box(w / 2 - 0.2, h / 2, d / 2 + 0.06, 0.05, 1.2, 0.05, ssD); box(0, 0.25, d / 2 + 0.02, w - 0.2, 0.25, 0.02, mat(0x30353a)); break; }
        case 'handsink': case 'scrubsink': {
          const n = it.type === 'scrubsink' ? 2 : 1; box(0, h - 0.35, 0, w, 0.7, d, ss); box(0, h * 0.4, -d / 2 + 0.15, w * 0.9, h * 0.6, 0.2, ss);
          box(0, h + 0.5, -d / 2 + 0.05, w, 1.0, 0.1, ss);
          for (let k = 0; k < n; k++) { const x = n === 1 ? 0 : (k ? 1 : -1) * w / 4; box(x, h - 0.02, 0.05, Math.min(1.5, w / n - 0.4), 0.06, d - 0.5, ssD); cyl(x, h + 0.35, -d / 2 + 0.3, 0.035, 0.7, ss, 10); const sp = cyl(x, h + 0.68, -d / 2 + 0.5, 0.03, 0.42, ss, 10); sp.rotation.x = Math.PI / 2; box(x + 0.3, 0.08, d / 2 - 0.1, 0.35, 0.06, 0.3, ssD); }
          break;
        }
        case 'dispenser': { box(0, h / 2, 0, w, h, d, ss); for (let k = 0; k < 3; k++) { const x = -w / 3 + k * w / 3; box(x, h / 2, d / 2 + 0.01, w / 3 - 0.1, h - 0.2, 0.02, [blue, coat, mat(0xd8e4ee)][k]); box(x, 0.15, d / 2 + 0.02, 0.4, 0.1, 0.02, rubber); } break; }
        case 'airshower': {
          // two nozzle walls and a roof, glass doors at both ends, a stainless floor plate
          const sw = 0.55, nz = mat(0x6f8fa8);
          for (const sx of [-1, 1]) { box(sx * (w / 2 - sw / 2), h / 2, 0, sw, h, d, coat); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) cyl(sx * (w / 2 - sw - 0.02), 1.6 + r * 1.2, -d / 3 + c * d / 3, 0.07, 0.05, nz, 10).rotation.z = Math.PI / 2; }
          box(0, h - 0.4, 0, w, 0.8, d, coat); box(0, 0.04, 0, w - 2 * sw, 0.08, d, ss);
          for (const sz2 of [-1, 1]) { box(0, (h - 0.8) / 2, sz2 * (d / 2 - 0.03), w - 2 * sw, h - 0.8, 0.04, glass); box(0, h - 0.95, sz2 * (d / 2 - 0.03), w - 2 * sw, 0.12, 0.06, ss); }
          box(0, h - 0.2, d / 2 + 0.01, 1.2, 0.18, 0.02, lightP);
          break;
        }
        case 'teardrop': { box(0, h - 0.03, 0, w, 0.06, d * 0.7, coat); const l = cyl(0, h - 0.1, 0, d / 2, w - 0.05, lightP, 16); l.rotation.z = Math.PI / 2; l.scale.set(1, 1, 0.85); break; }
        case 'sprinkler': { cyl(0, h - 0.01, 0, 0.13, 0.02, coat, 18); cyl(0, h - 0.07, 0, 0.035, 0.1, ssD, 10); cyl(0, h - 0.16, 0, 0.012, 0.06, mat(0xd04a3a), 8); cyl(0, h - 0.2, 0, 0.07, 0.01, ssD, 14); break; }
        case 'smokedet': { cyl(0, h - 0.06, 0, 0.24, 0.12, coat, 24); cyl(0, h - 0.125, 0, 0.17, 0.01, mat(0xe8eaea), 20); cyl(0.12, h - 0.13, 0, 0.012, 0.012, mat(0x2fbf4f), 8); break; }
        case 'crstool': {
          for (let k = 0; k < 5; k++) { const a2 = k * Math.PI * 2 / 5; const leg = box(Math.cos(a2) * 0.3, 0.2, Math.sin(a2) * 0.3, 0.6, 0.07, 0.09, ssD); leg.rotation.y = -a2; caster(Math.cos(a2) * 0.58, Math.sin(a2) * 0.58); }
          cyl(0, 1.2, 0, 0.06, 1.8, ss, 12); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 6, 24), ss); ring.rotation.x = Math.PI / 2; ring.position.set(0, 1.1, 0); g.add(ring);
          cyl(0, h - 0.1, 0, 0.62, 0.2, mat(0x2f3a45), 24); break;
        }
        case 'wallshelf': {
          box(0, h - 0.05, 0, w, 0.06, d, ss); box(0, h - 0.05, d / 2 - 0.02, w, 0.14, 0.04, ss);
          for (let q = -w / 2 + 0.2; q < w / 2 - 0.1; q += 0.2) box(q, h - 0.015, 0, 0.06, 0.005, d - 0.15, ssD); // perforations
          for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) { box(x, h / 2 - 0.05, -d / 2 + 0.05, 0.06, h - 0.1, 0.06, ssD); const br = box(x, h / 2 - 0.05, -d / 4, 0.05, 0.05, d * 0.7, ssD); br.rotation.x = -0.6; }
          break;
        }
        case 'wallcab': {
          box(0, h / 2, 0, w, h, d, ss); const n = w > 2.5 ? 2 : 1;
          for (let k = 0; k < n; k++) { const x = -w / 2 + (k + 0.5) * w / n; box(x, h / 2, d / 2 + 0.01, w / n - 0.12, h - 0.2, 0.02, glass); box(x + (k ? -1 : 1) * (w / n / 2 - 0.15), h / 2, d / 2 + 0.05, 0.04, 0.5, 0.05, ssD); }
          box(0, h / 2, 0, w - 0.1, 0.03, d - 0.1, ssD); break;
        }
        case 'locker': {
          box(0, h / 2 + 0.17, 0, w, h - 0.33, d, ss); legs(w / 2 - 0.08, d / 2 - 0.08, 0, 0.34, 0.07, ssD);
          for (let k = 1; k < 3; k++) box(0, 0.33 + k * (h - 0.33) / 3, d / 2 + 0.005, w - 0.05, 0.02, 0.01, ssD);
          for (let k = 0; k < 3; k++) { const y = 0.33 + (k + 0.5) * (h - 0.33) / 3; box(w / 2 - 0.15, y, d / 2 + 0.03, 0.05, 0.25, 0.04, ssD); for (let v = 0; v < 4; v++) box(0, y + 0.45 + v * 0.06, d / 2 + 0.006, w * 0.5, 0.02, 0.01, ssD); }
          break;
        }
        case 'mirror': { box(0, h / 2, 0, w, h, d * 0.5, ss); box(0, h / 2, d * 0.26, w - 0.15, h - 0.15, 0.01, new THREE.MeshPhongMaterial({ color: 0xcfe1e8, specular: 0xffffff, shininess: 120 })); break; }
        case 'bootrack': {
          legs(w / 2 - 0.05, d / 2 - 0.05, 0, h, 0.07, ssD);
          for (let k = 0; k < 3; k++) { const y = 0.45 + k * (h - 0.6) / 2, sh = box(0, y, 0, w - 0.1, 0.04, d - 0.1, ss); sh.rotation.x = 0.2; box(0, y - 0.05, d / 2 - 0.08, w - 0.1, 0.1, 0.03, ss);
            for (let q = 0; q < Math.floor(w / 0.6); q++) box(-w / 2 + 0.35 + q * 0.6, y + 0.25, 0, 0.35, 0.45, d * 0.75, q % 2 ? mat(0xe8eef2) : blue); }
          break;
        }
        case 'cubicle': {
          // grey fabric panels along the back and both ends with light caps, a grey work surface at 29″ and a
          // pedestal file under one end; the open side (+d/2) is where the chair goes
          const fab = mat(0x8b9095, 0x222222), cap = mat(0xc9cdd0, 0x666666), top = mat(0xb3b7ba, 0x444444), pt = 0.12, ws = 29 / 12;
          box(0, h / 2, -d / 2 + pt / 2, w, h, pt, fab); box(0, h + 0.02, -d / 2 + pt / 2, w, 0.04, pt + 0.02, cap);
          for (const sx of [-1, 1]) { box(sx * (w / 2 - pt / 2), h / 2, pt / 2, pt, h, d - pt, fab); box(sx * (w / 2 - pt / 2), h + 0.02, pt / 2, pt + 0.02, 0.04, d - pt, cap); }
          box(0, ws - 0.05, pt / 2, w - 2 * pt, 0.1, d - pt, top); box(0, ws - 0.05, d / 2 - 0.02, w - 2 * pt, 0.1, 0.04, mat(0x5d6368));
          const pw = Math.min(1.33, w / 3); box(w / 2 - pt - pw / 2, (ws - 0.1) / 2, -0.1, pw, ws - 0.1, d - 0.5, mat(0x767c82, 0x333333));
          for (let k = 0; k < 3; k++) box(w / 2 - pt - pw / 2, 0.35 + k * 0.62, d / 2 - 0.34, 0.35, 0.05, 0.03, cap); // drawer pulls
          break;
        }
        case 'esdbench': {
          // a 30″–36″ work surface (grey ESD laminate), tube legs, uprights at the back with a shelf and a light under it
          const ws = 3, ix = w / 2 - 0.12, iz = d / 2 - 0.12; legs(ix, iz, 0.03, ws - 0.08, 0.13); box(0, 0.6, 0, w - 0.2, 0.05, d - 0.2, ss);
          box(0, ws - 0.04, 0, w, 0.1, d, mat(0x6f7c84, 0x333333)); box(0, ws - 0.04, d / 2, w, 0.1, 0.03, ssD);
          for (const x of [-ix, ix]) box(x, (ws + h) / 2, -d / 2 + 0.1, 0.12, h - ws, 0.12, ss);
          box(0, h - 0.6, -d / 2 + 0.55, w - 0.1, 0.05, 1.0, ss); box(0, h - 0.7, -d / 2 + 0.55, w - 0.5, 0.1, 0.35, coat); box(0, h - 0.76, -d / 2 + 0.55, w - 0.6, 0.02, 0.28, lightP);
          box(0, ws + 0.9, -d / 2 + 0.08, w - 0.4, 0.3, 0.12, coat); for (let k = 0; k < 6; k++) box(-w / 2 + 0.6 + k * (w - 1.2) / 5, ws + 0.9, -d / 2 + 0.15, 0.12, 0.12, 0.02, mat(0x30353a)); // outlet strip
          box(0, ws + 0.02, d / 2 - 0.4, 0.35, 0.02, 0.35, mat(0x1e5ea8)); // ESD wrist-strap ground point
          break;
        }
        case 'lfbench': {
          // horizontal flow: the HEPA filter fills the back, air blows across the work surface toward you
          const ws = 2.5; legs(w / 2 - 0.15, d / 2 - 0.15, 0, ws - 0.1, 0.12, ssD); box(0, ws, 0, w, 0.12, d, ss);
          box(0, (ws + h) / 2, -d / 2 + 0.35, w, h - ws, 0.7, coat); box(0, (ws + h - 0.8) / 2 + 0.05, -d / 2 + 0.71, w - 0.3, h - ws - 1.0, 0.02, mat(0xdfe5e8)); // filter face
          for (const sx of [-1, 1]) box(sx * (w / 2 - 0.03), (ws + h) / 2, 0.1, 0.06, h - ws, d - 0.7, glass);
          box(0, h - 0.3, 0.1, w, 0.6, d - 0.7, coat); box(0, h - 0.62, 0.1, w - 0.3, 0.03, d - 0.9, lightP); box(0, h - 0.3, d / 2 - 0.24, w - 0.4, 0.35, 0.01, mat(0x5b6670));
          break;
        }
        case 'desiccator': case 'desicbench': {
          // acrylic doors over shelves in a stainless frame, a nitrogen flowmeter on the side
          const rows = it.type === 'desiccator' ? 2 : 1, cols = 2, y0 = it.type === 'desiccator' ? 0.33 : 0, hh = h - y0;
          if (y0) legs(w / 2 - 0.08, d / 2 - 0.08, 0, y0 + 0.02, 0.08, ssD);
          box(0, y0 + hh / 2, -0.02, w, hh, d - 0.04, ss); box(0, y0 + hh / 2, d / 2 - 0.05, w - 0.12, hh - 0.12, 0.04, mat(0xeef3f5));
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const x = -w / 2 + (c + 0.5) * w / cols, y = y0 + (r + 0.5) * hh / rows; box(x, y, d / 2 + 0.005, w / cols - 0.12, hh / rows - 0.12, 0.03, glass);
            box(x + (c ? -1 : 1) * (w / cols / 2 - 0.12), y, d / 2 + 0.05, 0.04, Math.min(0.5, hh / rows / 3), 0.05, ssD);
            for (let k = 1; k < 3; k++) box(x, y - hh / rows / 2 + k * hh / rows / 3, 0, w / cols - 0.15, 0.02, d - 0.3, ssD);
          }
          box(w / 2 + 0.06, y0 + hh * 0.75, d / 2 - 0.3, 0.1, 0.45, 0.2, coat); cyl(w / 2 + 0.12, y0 + hh * 0.75, d / 2 - 0.3, 0.03, 0.35, glass, 10);
          break;
        }
        case 'glovebox': {
          box(0, 0.05, 0, w, 0.1, d, ss); box(0, h / 2 + 0.05, 0, w - 0.05, h - 0.1, d - 0.05, glass);
          for (const [x, y, z, sx, sy, sz] of [[0, h - 0.02, 0, w, 0.04, d], [-w / 2, h / 2, 0, 0.05, h, d], [w / 2, h / 2, 0, 0.05, h, d], [0, h / 2, d / 2, w, 0.05, 0.05], [0, h / 2, -d / 2, w, 0.05, 0.05]]) box(x, y, z, sx, sy, sz, ss);
          for (const x of [-w / 5, w / 5]) { const pt = cyl(x, h * 0.45, d / 2 + 0.02, 0.32, 0.08, mat(0x30353a), 22); pt.rotation.x = Math.PI / 2; cyl(x, h * 0.45, d / 2 - 0.4, 0.22, 0.7, mat(0x1d2124), 14).rotation.x = Math.PI / 2; }
          const al = cyl(w / 2 + 0.45, h * 0.4, 0, 0.42, 0.9, ss, 24); al.rotation.z = Math.PI / 2; // side airlock
          break;
        }
        case 'fumehood': {
          const ws = 3; box(0, 1.45, 0, w, 2.7, d - 0.15, coat); box(0, 0.15, 0.05, w, 0.3, d - 0.3, rubber);
          const nd = Math.max(2, Math.round(w / 1.5)); for (let k = 0; k < nd; k++) { const x = -w / 2 + (k + 0.5) * w / nd; box(x, 1.5, d / 2 - 0.06, w / nd - 0.08, 2.2, 0.03, mat(0xe6e9ea)); box(x + 0.3, 2.3, d / 2 - 0.02, 0.2, 0.04, 0.04, ssD); }
          box(0, ws - 0.15, 0, w + 0.05, 0.12, d, mat(0x2b2e31, 0x555555)); // epoxy work top
          for (const sx of [-1, 1]) box(sx * (w / 2 - 0.12), (ws + h) / 2, 0, 0.24, h - ws, d, coat);
          box(0, (ws + h) / 2, -d / 2 + 0.1, w, h - ws, 0.2, coat); box(0, h - 0.6, 0, w, 1.2, d, coat);
          box(0, ws + 1.55, d / 2 - 0.12, w - 0.5, 2.4, 0.04, glass); box(0, ws + 0.35, d / 2 - 0.1, w - 0.5, 0.12, 0.08, ssD);
          cyl(0, h + 0.5, -0.2, 0.42, 1.0, ssD, 24); box(-w / 2 + 0.5, h - 0.6, d / 2 + 0.01, 0.6, 0.35, 0.02, mat(0x30353a));
          break;
        }
        case 'gowncab': {
          box(0, h / 2, 0, w, h, d, coat); box(0, h - 0.4, 0.02, w - 0.1, 0.6, d - 0.1, coat); box(0, h - 0.4, d / 2 + 0.01, w - 0.6, 0.25, 0.02, mat(0x5b6670));
          box(0, (h - 0.8) / 2 + 0.2, d / 2 + 0.01, w - 0.2, h - 1.1, 0.03, glass); box(w / 2 - 0.25, h / 2, d / 2 + 0.06, 0.04, 0.6, 0.05, ssD);
          cyl(0, h - 1.05, 0, 0.03, w - 0.2, ss, 10).rotation.z = Math.PI / 2;
          const n = Math.max(2, Math.floor(w / 0.45)); for (let k = 0; k < n; k++) box(-w / 2 + 0.35 + k * (w - 0.7) / Math.max(1, n - 1), h - 2.9, 0, 0.3, 3.6, d * 0.7, k % 3 === 1 ? mat(0xb9d4ee) : mat(0xf6f7f6));
          break;
        }
        case 'partcart': {
          legs(w / 2 - 0.08, d / 2 - 0.08, 0.33, 2.6, 0.07); for (const y of [0.6, 2.6]) box(0, y, 0, w, 0.05, d, ss); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) caster(x * (w / 2 - 0.08), z * (d / 2 - 0.08));
          box(0, 2.95, 0, w * 0.7, 0.65, d * 0.75, mat(0xeceff0)); box(0, 3.05, d * 0.38, w * 0.5, 0.35, 0.02, mat(0x223a52));
          cyl(-w * 0.2, 3.35, 0, 0.06, 0.2, ssD, 12); box(-w * 0.2, 3.48, 0, 0.16, 0.06, 0.16, ssD); // the sample probe
          break;
        }
        case 'shoecleaner': {
          box(0, 0.3, 0.1, w, 0.6, d - 0.2, ss); box(0, 0.62, 0.1, w - 0.3, 0.04, d - 0.5, mat(0x1d2124)); for (let k = 0; k < 4; k++) box(0, 0.68, -d / 2 + 0.6 + k * 0.35, w - 0.4, 0.08, 0.12, blue); // brushes
          for (const sx of [-1, 1]) { box(sx * (w / 2 - 0.05), h / 2, -d / 2 + 0.15, 0.08, h, 0.08, ss); box(sx * (w / 2 - 0.05), h - 0.05, 0, 0.06, 0.06, d - 0.3, ss); }
          box(0, h * 0.62, -d / 2 + 0.12, w - 0.2, 0.5, 0.1, coat);
          break;
        }
        case 'wipestation': {
          box(0, h / 2, 0, w, h, d, ss); box(0, h / 2 + 0.1, d / 2 + 0.005, w - 0.15, h - 0.4, 0.01, mat(0xdfe5e8));
          cyl(-w / 4, 0.25, d / 2 - 0.05, 0.2, 0.3, mat(0xf8f8f8), 18); const b2 = cyl(w / 4, 0.3, d / 2 + 0.05, 0.1, 0.45, new THREE.MeshPhongMaterial({ color: 0xdfeff8, transparent: true, opacity: 0.75 }), 14); b2.position.y = 0.3;
          box(w / 4, 0.58, d / 2 + 0.05, 0.05, 0.12, 0.05, blue); break;
        }
        case 'eyewash': {
          box(0, h / 2, -d / 2 + 0.05, 0.6, h, 0.1, ss); cyl(0, h * 0.3, 0, 0.06, h * 0.5, ss, 10);
          for (const x of [-0.25, 0.25]) cyl(x, h * 0.65, 0.05, 0.16, 0.1, mat(0x3fb35a), 18);
          box(0, h * 0.4, d / 2 - 0.05, 0.5, 0.25, 0.04, mat(0x3fb35a)); box(0, h + 0.45, -d / 2 + 0.03, 0.9, 0.6, 0.02, mat(0x2f9e4c)); // pull plate and the green sign
          break;
        }
        case 'shoecover': { box(0, 0.5, 0, w, 1.0, d, coat); box(0, 1.6, 0, w * 0.8, 1.2, d * 0.8, ss); box(0, 1.02, d / 2 - 0.25, w * 0.6, 0.04, 0.4, blue); break; }
      }
      break;
    }
    default: box(0, h / 2, 0, w, h, d, cab);
  }
  g.position.set(it.x, z0, it.y); g.rotation.y = -(it.a || 0);
  return g;
}

/* ---------- three.js scene ---------- */
const IMG_TEX = {};
let ANISO = 4;
function buildScene(THREE, plan, A) {
  const root = new THREE.Group();
  const H = A.H, WH = A.WH || H, B = A.bounds;
  const pick = [];
  const doors = [];
  const doorObs = [], removable = [];

  const PX_IN = 512 / 48;
  const seamCanvas = cachedCanvas('seamCanvas', () => makeCanvas(512, 256, (g, w, h) => {
    g.fillStyle = '#f7f8f8'; g.fillRect(0, 0, w, h);
    const vg = g.createLinearGradient(0, 0, 0, h); vg.addColorStop(0, 'rgba(255,255,255,.25)'); vg.addColorStop(1, 'rgba(0,0,0,.015)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .025})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 6); }
    const batten = (cx) => {
      const half = 1.5 * PX_IN, ins = 0.6 * PX_IN;
      g.fillStyle = '#fbfbfb'; g.fillRect(cx - half, 0, half * 2, h);
      g.fillStyle = '#a3aaae'; g.fillRect(cx - half - 1, 0, 1.4, h);
      g.fillStyle = '#a3aaae'; g.fillRect(cx + half - 0.4, 0, 1.4, h);
      g.fillStyle = '#ffffff'; g.fillRect(cx - half + 0.6, 0, 1, h);
      const ig = g.createLinearGradient(cx - ins, 0, cx + ins, 0);
      ig.addColorStop(0, '#e9ecec'); ig.addColorStop(0.5, '#f6f7f7'); ig.addColorStop(1, '#e3e6e7');
      g.fillStyle = ig; g.fillRect(cx - ins, 0, ins * 2, h);
      g.fillStyle = '#b3babd'; g.fillRect(cx - ins - 1, 0, 1, h); g.fillRect(cx + ins, 0, 1, h);
      g.fillStyle = '#ffffff'; g.fillRect(cx - ins, 0, 0.8, h);
    };
    batten(0); batten(w);
  }));
  // the same panel face without the battens (a wall whose studs are re-spaced gets its battens as strips)
  const seamPlain = cachedCanvas('seamPlain', () => makeCanvas(512, 256, (g, w, h) => {
    g.fillStyle = '#f7f8f8'; g.fillRect(0, 0, w, h);
    const vg = g.createLinearGradient(0, 0, 0, h); vg.addColorStop(0, 'rgba(255,255,255,.25)'); vg.addColorStop(1, 'rgba(0,0,0,.015)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .025})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 6); }
  }));
  const floorCanvas = cachedCanvas('floorCanvas', () => makeCanvas(512, 512, (g, w, h) => {
    g.fillStyle = '#c3c7c8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, r); const d = Math.random() < .5; gr.addColorStop(0, d ? 'rgba(90,96,100,.035)' : 'rgba(255,255,255,.04)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); } }
    for (let i = 0; i < 4000; i++) { const v = 150 + Math.random() * 70 | 0; g.fillStyle = `rgba(${v},${v + 3},${v + 5},.28)`; g.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2); }
  }));
  // vinyl-covered gypsum: a smooth white vinyl face with the faintest texture
  const ceilCanvas = cachedCanvas('ceilCanvas', () => makeCanvas(128, 256, (g, w, h) => {
    g.fillStyle = '#f3f4f3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(150,154,156,${Math.random() * .06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#d3d8da'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
    g.fillStyle = '#fbfbfb'; g.fillRect(0, 3, w, 1); g.fillRect(3, 0, 1, h);
  }));
  const ffuCanvas = cachedCanvas('ffuCanvas', () => makeCanvas(64, 128, (g, w, h) => { g.fillStyle = '#eceeee'; g.fillRect(0, 0, w, h); g.fillStyle = '#b8c0c4'; for (let y = 8; y < h - 6; y += 5) for (let x = 6; x < w - 4; x += 5) g.fillRect(x, y, 2, 2); g.strokeStyle = '#c4cacd'; g.lineWidth = 4; g.strokeRect(0, 0, w, h); }));
  const steelCanvas = cachedCanvas('steelCanvas', () => makeCanvas(256, 256, (g, w, h) => {
    g.fillStyle = '#a9aeb0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * h, r = 15 + Math.random() * 50, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, Math.random() < .5 ? 'rgba(70,76,80,.10)' : 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 1400; i++) { const v = Math.random() < .5 ? 255 : 60; g.fillStyle = `rgba(${v},${v},${v},${Math.random() * .03})`; g.fillRect(0, Math.random() * h, w, 1); }
  }));
  const grilleCanvas = cachedCanvas('grilleCanvas', () => makeCanvas(256, 96, (g, w, h) => {
    g.fillStyle = '#f3f4f4'; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 8; y += 7) { g.fillStyle = '#c4cacd'; g.fillRect(9, y, w - 18, 2.2); g.fillStyle = '#ffffff'; g.fillRect(9, y + 2.2, w - 18, 1); }
    g.strokeStyle = '#dde1e2'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.strokeStyle = '#b9c0c3'; g.lineWidth = 1; g.strokeRect(8.5, 8.5, w - 17, h - 17);
  }));
  const aoCanvas = cachedCanvas('aoCanvas', () => makeCanvas(64, 64, (g) => { g.filter = 'blur(9px)'; g.fillStyle = '#000'; g.fillRect(20, 20, 24, 24); }));

  // building wall finishes: tilt-up concrete (panel joints), block (running bond), metal panel (ribs), drywall
  const shellCanvas = (kind) => cachedCanvas('shell_' + kind, () => makeCanvas(256, 256, (g, w, h) => {
    const base = { concrete: '#bdbab2', cmu: '#cbc7bd', metal: '#e1e5e7', stud: '#f0eee9' }[kind] || '#ddd';
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < (kind === 'stud' ? 600 : 2600); i++) { const v = Math.random() < .5 ? '0,0,0' : '255,255,255'; g.fillStyle = `rgba(${v},${Math.random() * (kind === 'concrete' ? .06 : .035)})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
    if (kind === 'concrete') { g.fillStyle = 'rgba(70,70,66,.55)'; g.fillRect(0, 0, 2, h); }
    if (kind === 'cmu') { g.fillStyle = 'rgba(150,146,136,.9)'; for (let r = 0; r < 4; r++) { g.fillRect(0, r * 64, w, 3); const off = r % 2 ? 0 : 128; g.fillRect(off, r * 64, 3, 64); g.fillRect(off + 128 > w ? off - 128 : off + 128, r * 64, 3, 64); } }
    if (kind === 'metal') { for (let x = 0; x < w; x += 64) { const gr = g.createLinearGradient(x, 0, x + 18, 0); gr.addColorStop(0, 'rgba(0,0,0,.10)'); gr.addColorStop(.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(0,0,0,.08)'); g.fillStyle = gr; g.fillRect(x, 0, 18, h); } }
  }));
  // texture size in feet: concrete panel 20′ wide, block 32″ × 16″ (two blocks per tile row), metal ribs 12″, drywall 8′
  const SHELL_REP = { concrete: [20, 20], cmu: [32 / 12, 32 / 12], metal: [4, 4], stud: [8, 8] };
  const shellMat = (kind, len, h, s0) => {
    const t = new THREE.CanvasTexture(shellCanvas(kind)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO;
    const [ru, rv] = SHELL_REP[kind] || [8, 8]; t.repeat.set(len / ru, h / rv); t.offset.set(((s0 || 0) % ru) / ru, 0);
    return new THREE.MeshPhongMaterial({ map: t, color: 0xffffff, specular: kind === 'metal' ? 0x444444 : 0x0c0c0c, shininess: kind === 'metal' ? 30 : 6 });
  };
  // house finishes: painted drywall inside, lap siding outside, white trim
  const FIN = finishOf(plan), sidingKey = FIN.siding + '|' + FIN.sidingColor;
  const sidingBase = (FINISH.sidingColor[FIN.sidingColor] || [])[1] || '';
  const SID_REP = { lap: [8, 16 * 7 / 12 * 2 / 2], board: [4, 8], shake: [4, 4], brick: [8 / 3, 2], stone: [4, 4], stucco: [8, 8] };
  const sidingCanvas = cachedCanvas('siding_' + sidingKey, () => makeCanvas(128, 128, (g, w, h) => {
    const k = FIN.siding, col = sidingBase || { brick: '#9a4e3a', stone: '#a49c8f', shake: '#a07a55' }[k] || '#d7dbd8';
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    const speck = (n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1); } };
    if (k === 'lap') { for (let y = 0; y < h; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, 'rgba(0,0,0,.16)'); gr.addColorStop(.15, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(0,0,0,.02)'); g.fillStyle = gr; g.fillRect(0, y, w, 16); } speck(500, .03); }
    else if (k === 'board') { for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 26, 0, 2, h); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x, 0, 5, h); g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(x + 5, 0, 1, h); } speck(400, .03); }
    else if (k === 'shake') { for (let y = 0; y < h; y += 16) for (let x = -((y / 16) % 2) * 6; x < w; x += 8 + Math.random() * 8) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .12})`; g.fillRect(x, y, 10, 16); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x, y, 1, 16); g.fillRect(x, y + 15, 10, 1); } }
    else if (k === 'brick') { for (let r = 0; r < 8; r++) for (let x = (r % 2) * -16; x < w; x += 32) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .14})`; g.fillRect(x, r * 16, 32, 16); } g.fillStyle = '#cfc8bd'; for (let r = 0; r < 8; r++) { g.fillRect(0, r * 16, w, 2); for (let x = (r % 2) * -16; x < w; x += 32) g.fillRect(x, r * 16, 2, 16); } speck(500, .05); }
    else if (k === 'stone') { g.fillStyle = '#c9c3b8'; g.fillRect(0, 0, w, h); let y = 1; while (y < h) { const ch = 10 + Math.random() * 8; let x = -Math.random() * 20; while (x < w) { const sw = 14 + Math.random() * 26; const l = 42 + Math.random() * 22; g.fillStyle = `hsl(${25 + Math.random() * 20},${6 + Math.random() * 12}%,${l}%)`; const r = 3; g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + sw - r, y); g.quadraticCurveTo(x + sw, y, x + sw, y + r); g.lineTo(x + sw, y + ch - r); g.quadraticCurveTo(x + sw, y + ch, x + sw - r, y + ch); g.lineTo(x + r, y + ch); g.quadraticCurveTo(x, y + ch, x, y + ch - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.fill(); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 1, y + ch - 2, sw - 2, 2); x += sw + 2; } y += ch + 2; } speck(600, .06); }
    else { speck(3000, .05); }
  }));
  // y0: where the piece starts, so the courses line up with the wall beside it (over a window, under a sill)
  const sidingMat = (len, h, y0) => { const t = new THREE.CanvasTexture(sidingCanvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = ANISO; const r = SID_REP[FIN.siding] || [8, 9.33]; t.repeat.set(len / r[0], h / r[1]); t.offset.set(0, (y0 || 0) / r[1]); return new THREE.MeshLambertMaterial({ map: t }); };
  const drywall = new THREE.MeshLambertMaterial({ color: parseInt(((FINISH.paint[FIN.paint] || [])[1] || '#f1eee8').slice(1), 16) });
  // which face of a framed wall is outside: the side with no building behind it
  const FPout = footprint(A, true);
  const outsideAt = (x, z) => !FPout || !FPout.has(x, z);
  const frameMats = (x1, z1, x2, z2, t, h, ext, y0) => {
    const L = Math.hypot(x2 - x1, z2 - z1) || 1, nx = -(z2 - z1) / L, nz = (x2 - x1) / L, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, off = t / 2 + 0.8;
    let left = outsideAt(cx + nx * off, cz + nz * off), right = outsideAt(cx - nx * off, cz - nz * off);
    if (ext === false) left = right = false;
    const sm = (left || right) ? sidingMat(L, h, y0) : null;
    return { mats: [M.edge, M.edge, M.edge, M.edge, left ? sm : drywall, right ? sm : drywall], left, right, nx, nz };
  };
  // the ceiling track (the angle the grid rests on) shows only on walls taller than one 12′ panel; a single
  // panel reads as one smooth face, with no band or blocks at the ceiling line
  // (no ceiling track band on any wall: each panel is 12′ or less, and the walls read as smooth faces)
  const trackOK = () => false;
  let wallCA = null;
  const M = {
    white: new THREE.MeshPhongMaterial({ color: 0xf7f8f8, emissive: 0x141515, specular: 0x1c1c1c, shininess: 16 }),
    edge: new THREE.MeshPhongMaterial({ color: 0xf2f3f3, emissive: 0x121313, specular: 0x111111, shininess: 10 }),
    base: new THREE.MeshPhongMaterial({ color: 0x18191b, specular: 0x2a2a2a, shininess: 28 }),
    track: new THREE.MeshPhongMaterial({ color: 0xdfe2e3, specular: 0x555555, shininess: 40 }),
    frame: new THREE.MeshPhongMaterial({ color: 0xf8f9f9, emissive: 0x121313, specular: 0x222222, shininess: 24 }),
    closer: new THREE.MeshPhongMaterial({ color: 0xb9bfc2, specular: 0x888888, shininess: 60 }),
    leaf: new THREE.MeshPhongMaterial({ color: 0xfbfcfc, emissive: 0x121313, specular: 0x1c1c1c, shininess: 16 }),
    kick: new THREE.MeshLambertMaterial({ color: 0xa9b2b8 }),
    lite: new THREE.MeshPhongMaterial({ color: 0xb8d3db, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
    glass: new THREE.MeshLambertMaterial({ color: 0x9fd8e6, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    grille: new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(grilleCanvas), specular: 0x1c1c1c, shininess: 16 }),
    steel: new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(steelCanvas), color: 0xffffff, specular: 0x9a9a9a, shininess: 55 }),
    steelDoor: new THREE.MeshPhongMaterial({ map: new THREE.CanvasTexture(steelCanvas), color: 0xf2f2f2, specular: 0xb0b0b0, shininess: 70 }),
    line: new THREE.LineBasicMaterial({ color: 0x8a9398, transparent: true, opacity: 0.45 }),
    ao: new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(aoCanvas), transparent: true, opacity: 0.34, depthWrite: false, color: 0x1c2428 })
  };
  M.fx = M.white.clone();   // FFU and light housings stay white whatever colour the panels are
  // names for every material (they become the material names in an exported model: Twinmotion, Blender…)
  Object.entries({ white: 'Wall panel trim', edge: 'Wall panel edge', base: 'Rubber base', track: 'Ceiling track, aluminum', frame: 'Door frame', closer: 'Door hardware, satin', leaf: 'Door leaf', kick: 'Kick plate, stainless', lite: 'Door vision glass', glass: 'Glass', grille: 'Return grille', steel: 'Stainless steel', steelDoor: 'Door, stainless', ao: 'Contact shadow', fx: 'Fixture housing, white' }).forEach(([k, n]) => { if (M[k]) M[k].name = n; });
  // panel colour: the plan's colour on every panel part; a wall with its own colour gets its own set
  const PCM = {};
  function panelMats(key) {
    if (PCM[key]) return PCM[key];
    if (key === 'white') return (PCM.white = { face: 0xffffff, emissive: 0x141515, edge: M.edge, trim: M.white, label: 'White' });
    const c = new THREE.Color(PANEL_COLORS[key][1]), dark = c.getHSL({}).l < 0.3;
    const edge = M.edge.clone(), trim = M.white.clone(); edge.color.copy(c).multiplyScalar(0.94); trim.color.copy(c); edge.emissive.set(0); trim.emissive.set(0);
    edge.shininess = trim.shininess = dark ? 30 : 18;
    edge.name = 'Wall panel edge, ' + PANEL_COLORS[key][0].toLowerCase(); trim.name = 'Wall panel trim, ' + PANEL_COLORS[key][0].toLowerCase();
    return (PCM[key] = { face: c.getHex(), emissive: 0x000000, edge, trim, label: PANEL_COLORS[key][0] });
  }
  { const pm = panelMats(panelColorOf(plan)); if (pm.edge !== M.edge) { M.edge = pm.edge; M.white = pm.trim; } }
  const wallById = new Map((plan.walls || []).map(w => [w.id, w]));
  const wallPM = (id) => panelMats(panelColorOf(plan, wallById.get(id)));
  const aoGeo = new THREE.PlaneGeometry(1, 1);
  const outline = (m) => m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), M.line));
  function shadow(cx, cz, len, wid, ang, spread) {
    const s = spread || 0.9, g = new THREE.Group(), m = new THREE.Mesh(aoGeo, M.ao);
    m.rotation.x = -Math.PI / 2; m.scale.set(len + s * 2.4, wid + s * 2.4, 1); m.renderOrder = 1;
    g.add(m); g.position.set(cx, 0.018, cz); g.rotation.y = ang || 0; root.add(g);
  }
  function segBox(x1, z1, x2, z2, y0, y1, th, mat, ext) {
    const len = Math.hypot(x2 - x1, z2 - z1) + (ext || 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.001, len), Math.max(0.001, y1 - y0), th), mat);
    m.position.set((x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2);
    m.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
    if (curRef) m.userData.ref = curRef;
    root.add(m); return m;
  }
  function localSegBox(parent, x1, z1, x2, z2, y0, y1, th, mat, ext) {
    const len = Math.hypot(x2 - x1, z2 - z1) + (ext || 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.001, len), Math.max(0.001, y1 - y0), th), mat);
    m.position.set((x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2);
    m.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
    if (curRef) m.userData.ref = curRef;
    parent.add(m); return m;
  }
  let curRef = null;
  // the beams hung between cleanroom walls (their top flanges run over the walls, through the wall caps)
  let capB = null;
  const capBeams = () => capB || (capB = A.PL > 0 ? (plan.beams || []).map(b => ({ q: beamSeat(plan, A, b), bf: beamSize(b).bf / 12 })).filter(o => o.q.onWalls) : []);

  for (const p of A.pieces) {
    curRef = p.id ? { kind: 'wall', id: p.id } : null;
    if (p.frame) {
      // a house wall: drywall on room sides, siding outside, white baseboard inside
      const F = frameMats(p.x1, p.z1, p.x2, p.z2, p.t, p.h, p.ext), m = segBox(p.x1, p.z1, p.x2, p.z2, 0, p.h, p.t, F.mats);
      outline(m); pick.push(m);
      for (const [sd, isOut] of [[1, F.left], [-1, F.right]]) {
        if (isOut) continue;
        const ox = F.nx * sd * (p.t / 2 + 0.02), oz = F.nz * sd * (p.t / 2 + 0.02);
        segBox(p.x1 + ox, p.z1 + oz, p.x2 + ox, p.z2 + oz, 0, 0.29, 0.04, M.frame);
      }
      shadow((p.x1 + p.x2) / 2, (p.z1 + p.z2) / 2, p.len, p.t, Math.atan2(-(p.z2 - p.z1), p.x2 - p.x1), 0.6);
      continue;
    }
    if (!p.hard) {
      const sm = shellMat(p.kind, p.len, p.h, p.s0), m = segBox(p.x1, p.z1, p.x2, p.z2, 0, p.h, p.t, [M.edge, M.edge, M.edge, M.edge, sm, sm]);
      outline(m); pick.push(m); shadow((p.x1 + p.x2) / 2, (p.z1 + p.z2) / 2, p.len, p.t, Math.atan2(-(p.z2 - p.z1), p.x2 - p.x1));
      continue;
    }
    // studs re-spaced under beams: a plain face, the battens added as strips at the wall's own joints
    const pw = (plan.walls || []).find(q => q.id === p.id), pmod = pw ? wallModule(pw, plan) : null;
    // studs 48″ apart (the building grid, or the 48″ module from the wall's start): the panel texture with its
    // detailed H-studs and inserts, slid so its joints land on this wall's studs; uneven spacing gets strips
    const m0 = pmod && pmod.length ? pmod[0] % 4 : 0, even = !pmod || pmod.every((m, i) => i === 0 || Math.abs(m - pmod[i - 1] - 4) < 1e-4);
    const custom = !even;
    const tex = new THREE.CanvasTexture(custom ? seamPlain : seamCanvas); tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = ANISO;
    tex.repeat.set(p.len / 4, 1); tex.offset.set((((p.s0 - m0) % 4) + 4) % 4 / 4, 0);
    const WP = wallPM(p.id);
    if (custom) {
      const bm = M.batten || (M.batten = new THREE.MeshPhongMaterial({ color: 0xfbfbfb, specular: 0x222222, shininess: 20, name: 'H-stud batten' }));
      const L0 = Math.hypot(p.x2 - p.x1, p.z2 - p.z1) || 1, ux = (p.x2 - p.x1) / L0, uz = (p.z2 - p.z1) / L0;
      for (const m of pmod) { const k = m - p.s0; if (k < 0.05 || k > p.len - 0.05) continue; const x = p.x1 + ux * k, z = p.z1 + uz * k; outline(segBox(x - ux * 0.125, z - uz * 0.125, x + ux * 0.125, z + uz * 0.125, 0.333, p.h - 0.01, p.t + 0.016, bm)); }
    }
    const face = new THREE.MeshPhongMaterial({ map: tex, color: p.sp ? 0xf6dc80 : WP.face, emissive: p.sp ? 0x000000 : WP.emissive, specular: 0x1c1c1c, shininess: 16 }); face.name = p.sp ? 'Wall panel, S.P. yellow' : 'Wall panel, ' + WP.label.toLowerCase();
    // the other face runs its texture the other way along the wall: offset it so its seams land on the same
    // 48″ module (from the wall's start) as this face's, where the panels really join
    const tex2 = tex.clone(); tex2.offset.set((((m0 - p.len - p.s0) % 4) + 4) % 4 / 4, 0); tex2.needsUpdate = true;
    const face2 = face.clone(); face2.map = tex2;
    const m = segBox(p.x1, p.z1, p.x2, p.z2, 0, p.h, p.t, [WP.edge, WP.edge, WP.edge, WP.edge, face, face2]);
    outline(m); pick.push(m);
    segBox(p.x1, p.z1, p.x2, p.z2, 0, 0.333, p.t + 0.022, M.base);
    // the ceiling track: on the side with the ceiling (the room side), not across the outside face, which is one
    // smooth panel up to the top. Only drawn on a wall taller than one 12′ panel; a single panel shows no band.
    if (p.h > H + 0.05 && trackOK(p.h)) {
      const L0 = Math.hypot(p.x2 - p.x1, p.z2 - p.z1) || 1, nx = -(p.z2 - p.z1) / L0, nz = (p.x2 - p.x1) / L0, mx = (p.x1 + p.x2) / 2, mz = (p.z1 + p.z2) / 2;
      // at that side's own ceiling height (a room with a raised or dropped ceiling area has its track up or down
      // there, not at the plan's ceiling line)
      const FPw = footprint(A), CAw = wallCA || (wallCA = ceilAreas(plan, A)), side = (sd) => { for (const t of [0.5, 0.2, 0.8]) { const x = p.x1 + (p.x2 - p.x1) * t + nx * sd * (p.t / 2 + 0.4), z = p.z1 + (p.z2 - p.z1) * t + nz * sd * (p.t / 2 + 0.4); if (inCeiling(plan, FPw, x, z)) return ceilingAt(CAw, H, x, z); } return 0; };
      for (const sd of [1, -1]) { const hc = side(sd); if (!hc || p.h <= hc + 0.05) continue; const o = sd * (p.t / 2 + 0.016); segBox(p.x1 + nx * o, p.z1 + nz * o, p.x2 + nx * o, p.z2 + nz * o, hc - 0.17, hc, 0.024, M.track); }
    }
    // panels come up to 12′ tall in one piece; a taller wall has a second one stacked on it. The joint is not drawn:
    // the wall reads as one smooth face (no band at the stack line)
    // a section that stops short of (or runs past) the top of the cleanroom gets a cap along its top
    // the white wall cap over the top of every wall: down 1″ over both faces
    // (12′ lengths; its top cut round the top flange of each beam that crosses the wall, the flange showing in the
    // gap; the leg on the outside face carries on under the flange, so each length is still one piece)
    {
      const cm = M.wallCap || (M.wallCap = new THREE.MeshLambertMaterial({ color: 0xf6f7f7, emissive: 0x2a2a2a, name: 'Wall cap, white' }));
      for (const q of wallCapSolids(capPiece(p, capBeams()))) outline(segBox(q.x1, q.z1, q.x2, q.z2, q.y0, q.y1, q.t, cm));
    }
    shadow((p.x1 + p.x2) / 2, (p.z1 + p.z2) / 2, p.len, p.t, Math.atan2(-(p.z2 - p.z1), p.x2 - p.x1));
  }
  curRef = null;
  // an upper floor's floor system (rim joist, subfloor) between it and the floor below, sided on the outside
  // corner boards: a white 1×5 on both faces of every outside corner of the house, floor band to wall top, so the
  // siding of the two walls meets under trim (as built) instead of in a raw seam
  if (A.frameAny && !A.hardAny) {
    try {
      const EW = houseExtWalls(plan, A), FPc = footprint(A, true), cbMat = M.cornerBoard || (M.cornerBoard = new THREE.MeshLambertMaterial({ color: 0xf3f3f0, name: 'Corner board, white' }));
      const ends = []; for (const w of EW) for (const [x, z, ox, oz] of [[w.x1, w.y1, w.x2, w.y2], [w.x2, w.y2, w.x1, w.y1]]) { const L = Math.hypot(ox - x, oz - z); ends.push({ w, x, z, ux: (ox - x) / L, uz: (oz - z) / L }); }
      const done = [];
      for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
        const a = ends[i], b = ends[j]; if (a.w === b.w || Math.hypot(a.x - b.x, a.z - b.z) > 0.08 || Math.abs(a.ux * b.ux + a.uz * b.uz) > 0.2) continue;
        if (done.some(q => Math.hypot(q[0] - a.x, q[1] - a.z) < 0.1)) continue;
        // an outside corner: the point diagonally out from it, away from both walls, is outside the house
        const t = Math.max(a.w.t || 0.375, b.w.t || 0.375), ox = -(a.ux + b.ux), oz = -(a.uz + b.uz), on = Math.hypot(ox, oz) || 1;
        if (FPc && FPc.has(a.x + ox / on * (t + 0.5), a.z + oz / on * (t + 0.5))) continue;
        done.push([a.x, a.z]);
        const top = Math.max(a.w.h || A.H, b.w.h || A.H, A.H), bot = -(plan.__floorBand || 0) + 0.02, W = 5 / 12, T = 1 / 12;
        // outer corner of the framing, then a board along each wall's outer face
        const px = a.x - a.ux * t / 2 - b.ux * t / 2, pz = a.z - a.uz * t / 2 - b.uz * t / 2;
        for (const [u, v] of [[a, b], [b, a]]) {
          // the face of wall u: offset out (away from v's direction) by half a board's thickness
          const fx = px - v.ux * T / 2, fz = pz - v.uz * T / 2;
          segBox(fx - u.ux * T, fz - u.uz * T, fx + u.ux * W, fz + u.uz * W, bot, top, T, cbMat);
        }
      }
    } catch (e) { /* trim is a nicety */ }
  }
  if (A.frameAny && plan.__floorBand > 0) {
    for (const w of houseExtWalls(plan, A)) { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uz = (w.y2 - w.y1) / L, e = (w.t || 0.375) / 2; const sm = sidingMat(L + 2 * e, plan.__floorBand, -plan.__floorBand); const m = segBox(w.x1 - ux * e, w.y1 - uz * e, w.x2 + ux * e, w.y2 + uz * e, -plan.__floorBand, 0, (w.t || 0.375), [M.edge, M.edge, M.edge, M.edge, sm, sm]); pick.push(m); }
  }
  // a house's foundation where it shows above grade: a concrete band at the foot of the outside walls (the slab
  // edge, or the stem / basement wall), siding starting above it
  if (A.frameAny) {
    const F = foundationOf(plan), exp = (FOUNDATIONS[F.type] || {}).exp || 0;
    if (exp > 0) {
      const cm = M.concrete || (M.concrete = new THREE.MeshLambertMaterial({ color: 0xb7b4ad }));
      for (const w of houseExtWalls(plan, A)) { const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uz = (w.y2 - w.y1) / L, e = (w.t || 0.375) / 2 + 0.03; const m = segBox(w.x1 - ux * e, w.y1 - uz * e, w.x2 + ux * e, w.y2 + uz * e, -exp - 0.1, -0.005, (w.t || 0.375) + 0.06, cm); pick.push(m); }
    }
  }
  // transition panels over a lower building that carries on through a gap in this one's wall
  for (const q of A.transitions || []) {
    const tex = new THREE.CanvasTexture(seamCanvas); tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = ANISO; tex.repeat.set(q.len / 4, 1);
    const PP = panelMats(panelColorOf(plan)), face = new THREE.MeshPhongMaterial({ map: tex, color: PP.face, emissive: PP.emissive, specular: 0x1c1c1c, shininess: 16, name: 'Wall panel, ' + PP.label.toLowerCase() });
    const m = segBox(q.x1, q.z1, q.x2, q.z2, q.y0, q.y1, q.t, [M.edge, M.edge, M.edge, M.edge, face, face]); outline(m); pick.push(m);
    // closure channel along the bottom edge, ceiling track for each side's ceiling
    segBox(q.x1, q.z1, q.x2, q.z2, q.y0 - 0.015, q.y0 + 0.06, q.t + 0.012, M.white);
    if (H - q.y0 > 0.25 && trackOK(WH)) segBox(q.x1, q.z1, q.x2, q.z2, H - 0.17, H, q.t + 0.03, M.track);
  }
  // header panels over open passages: panels from the ceiling up to the top of the walls, a closure channel
  // along the bottom and ceiling track on both sides
  for (const q of headerSegs(plan, A)) {
    const tex = new THREE.CanvasTexture(seamCanvas); tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = ANISO; tex.repeat.set(q.len / 4, 1);
    const PP = panelMats(panelColorOf(plan)), face = new THREE.MeshPhongMaterial({ map: tex, color: PP.face, emissive: PP.emissive, specular: 0x1c1c1c, shininess: 16, name: 'Wall panel, ' + PP.label.toLowerCase() });
    curRef = q.id ? { kind: 'header', id: q.id } : null;
    const m = segBox(q.x1, q.z1, q.x2, q.z2, q.y0, q.y1, q.t, [M.edge, M.edge, M.edge, M.edge, face, face]); outline(m); pick.push(m);
    segBox(q.x1, q.z1, q.x2, q.z2, q.y0 - 0.015, q.y0 + 0.06, q.t + 0.012, M.white);
    if (trackOK(WH)) segBox(q.x1, q.z1, q.x2, q.z2, q.y0 - 0.17, q.y0, q.t + 0.03, M.track);
    curRef = null;
  }
  // return grilles set into wall panels (plan.grilles): a louvred face on both sides of the panel, the damper
  // behind it shown as a dark frame
  for (const gr of plan.grilles || []) {
    const w = Math.max(0.25, +gr.w || 20 / 12), h = Math.max(0.25, +gr.h || 20 / 12), sill = Math.max(0, gr.sill == null ? 0.5 : +gr.sill), a = gr.a || 0, c = Math.cos(a), sn = Math.sin(a), t = (gr.t || 0.25) + 0.03;
    curRef = gr.id ? { kind: 'grille', id: gr.id } : null;
    const m = segBox(gr.x - c * w / 2, gr.y - sn * w / 2, gr.x + c * w / 2, gr.y + sn * w / 2, sill, sill + h, t, [M.edge, M.edge, M.edge, M.edge, M.grille, M.grille]); outline(m); pick.push(m);
    if (gr.damper) { const dm = M.damper || (M.damper = new THREE.MeshPhongMaterial({ color: 0x3c4348, specular: 0x666666, shininess: 40, name: 'Damper' })), e = 0.06; for (const [y0, y1, s0, s1] of [[sill - e, sill, -w / 2 - e, w / 2 + e], [sill + h, sill + h + e, -w / 2 - e, w / 2 + e], [sill, sill + h, -w / 2 - e, -w / 2], [sill, sill + h, w / 2, w / 2 + e]]) { const f = segBox(gr.x + c * s0, gr.y + sn * s0, gr.x + c * s1, gr.y + sn * s1, y0, y1, t + 0.01, dm); pick.push(f); } }
    curRef = null;
  }
  // end caps where a wall steps up or down
  for (const st of A.steps || []) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, st.y1 - st.y0, st.t + 0.03), M.white);
    m.position.set(st.x, (st.y0 + st.y1) / 2, st.z); m.rotation.y = st.ang; root.add(m); pick.push(m);
  }
  // bulkheads where a ceiling area steps up or down across open ceiling
  const CA = ceilAreas(plan, A);
  for (const q of areaBulkheads(plan, A, CA)) {
    const tex = new THREE.CanvasTexture(seamCanvas); tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = ANISO; tex.repeat.set(q.len / 4, 1);
    const PP = panelMats(panelColorOf(plan)), face = new THREE.MeshPhongMaterial({ map: tex, color: PP.face, emissive: PP.emissive, specular: 0x1c1c1c, shininess: 16, name: 'Wall panel, ' + PP.label.toLowerCase() });
    const m = segBox(q.x1, q.z1, q.x2, q.z2, q.y0, q.y1, q.t, [M.edge, M.edge, M.edge, M.edge, face, face]); outline(m); pick.push(m);
    if (q.area.c.id) m.userData.ref = { kind: 'carea', id: q.area.c.id };
    segBox(q.x1, q.z1, q.x2, q.z2, q.y0 - 0.015, q.y0 + 0.06, q.t + 0.012, M.white);
    if (trackOK(WH)) segBox(q.x1, q.z1, q.x2, q.z2, q.y1 - 0.17, q.y1, q.t + 0.03, M.track);
  }
  // ceiling track at a ceiling area's height along the walls it meets
  for (const a of CA) for (const p of A.pieces) {
    if (!p.hard || p.h < a.h || !trackOK(p.h)) continue;
    const ax = Math.abs(p.x2 - p.x1) < 1e-3, az = Math.abs(p.z2 - p.z1) < 1e-3; if (!ax && !az) continue;
    const r = p.t / 2 + 0.3;
    // only on the face toward the area: the room on the wall's other side has its own ceiling height
    const off = p.t / 2 + 0.016;
    if (ax && (Math.abs(p.x1 - a.x0) < r || Math.abs(p.x1 - a.x1) < r)) { const lo = Math.max(Math.min(p.z1, p.z2), a.z0), hi = Math.min(Math.max(p.z1, p.z2), a.z1), x = p.x1 + (Math.abs(p.x1 - a.x0) < r ? off : -off); if (hi - lo > 0.2) segBox(x, lo, x, hi, a.h - 0.17, a.h, 0.024, M.track); }
    if (az && (Math.abs(p.z1 - a.z0) < r || Math.abs(p.z1 - a.z1) < r)) { const lo = Math.max(Math.min(p.x1, p.x2), a.x0), hi = Math.min(Math.max(p.x1, p.x2), a.x1), z = p.z1 + (Math.abs(p.z1 - a.z0) < r ? off : -off); if (hi - lo > 0.2) segBox(lo, z, hi, z, a.h - 0.17, a.h, 0.024, M.track); }
  }
  // a ceiling track strip on each face of a run that has the ceiling against it, none across a face that's
  // outside the room (where the panel runs smooth on up past the ceiling line)
  const FPt = footprint(A), CAt = ceilAreas(plan, A);
  // each face at the ceiling height on its own side (a raised or dropped ceiling area), never at the plan's
  // ceiling line where that side's ceiling is somewhere else
  const trackFaces = (x1, z1, x2, z2, t, top, wallTop) => {
    const L0 = Math.hypot(x2 - x1, z2 - z1) || 1, nx = -(z2 - z1) / L0, nz = (x2 - x1) / L0;
    for (const sd of [1, -1]) {
      let hc = 0; for (const f of [0.5, 0.15, 0.85]) { const x = x1 + (x2 - x1) * f + nx * sd * (t / 2 + 0.4), z = z1 + (z2 - z1) * f + nz * sd * (t / 2 + 0.4); if (inCeiling(plan, FPt, x, z)) { hc = ceilingAt(CAt, top, x, z); break; } }
      if (!hc || (wallTop && wallTop <= hc + 0.05)) continue;
      const o = sd * (t / 2 + 0.016); segBox(x1 + nx * o, z1 + nz * o, x2 + nx * o, z2 + nz * o, hc - 0.17, hc, 0.024, M.track);
    }
  };
  for (const c of A.corners) {
    const legs = [[c.a, c.b], [c.b, c.a]];
    for (const [u, v] of legs) {
      const x1 = c.x + v[0] * c.wt / 2, z1 = c.z + v[1] * c.wt / 2, x2 = x1 + u[0] * c.size, z2 = z1 + u[1] * c.size;
      const m = segBox(x1, z1, x2, z2, 0, c.h || WH, c.wt + 0.006, M.white); outline(m); pick.push(m);
      segBox(x1, z1, x2, z2, 0, 0.333, c.wt + 0.024, M.base);
      if (trackOK(c.h || WH)) { if ((c.h || WH) > H + 0.05) trackFaces(x1, z1, x2, z2, c.wt + 0.008, H, c.h || WH); else segBox(x1, z1, x2, z2, H - 0.17, H, c.wt + 0.032, M.track); }
    }
  }
  const seen = [];
  for (const e of A.ends) {
    if (e.cut || e.joined || seen.some(s => Math.hypot(s.x - e.x, s.z - e.z) < 0.02) || A.corners.some(c => Math.hypot(c.x - e.x, c.z - e.z) < 0.35)) continue;
    seen.push(e);
    const eh = e.h || WH, m = new THREE.Mesh(new THREE.BoxGeometry(e.t, eh, e.t), M.white);
    m.position.set(e.x, eh / 2, e.z); m.rotation.y = e.ang; root.add(m); pick.push(m);
    const pb = new THREE.Mesh(new THREE.BoxGeometry(e.t + 0.022, 0.333, e.t + 0.022), M.base); pb.position.set(e.x, 0.1665, e.z); pb.rotation.y = e.ang; root.add(pb);
    if (!trackOK(eh)) { /* one panel: no ceiling track */ }
    else if (eh > H + 0.05) { const ux = Math.cos(e.ang), uz = -Math.sin(e.ang), h2 = e.t / 2; trackFaces(e.x - ux * h2, e.z - uz * h2, e.x + ux * h2, e.z + uz * h2, e.t, H); trackFaces(e.x + uz * h2, e.z - ux * h2, e.x - uz * h2, e.z + ux * h2, e.t, H); }
    else { const pt = new THREE.Mesh(new THREE.BoxGeometry(e.t + 0.03, 0.17, e.t + 0.03), M.track); pt.position.set(e.x, H - 0.085, e.z); pt.rotation.y = e.ang; root.add(pt); }
  }

  // a wall panel's face (its colour, plain: for header panels and removable panels) and an H-stud with its insert
  const panelFace = (WP) => {
    return M['remFace' + WP.label] || (M['remFace' + WP.label] = (() => { const m = new THREE.MeshPhongMaterial({ color: new THREE.Color(WP.face).multiplyScalar(0.955), emissive: WP.emissive, specular: 0x1c1c1c, shininess: 16 }); m.name = 'Wall panel, removable, ' + WP.label.toLowerCase(); return m; })());
  };
  const studMat = (WP) => {
    const stud = M.studIns || (M.studIns = (() => { const tx = new THREE.CanvasTexture(cachedCanvas('studIns', () => makeCanvas(32, 64, (g, w, h) => {
        const ins = 0.6 * w / 3, cx = w / 2;
        g.fillStyle = '#fbfbfb'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#a3aaae'; g.fillRect(0, 0, 1.4, h); g.fillRect(w - 1.4, 0, 1.4, h);
        g.fillStyle = '#ffffff'; g.fillRect(1.6, 0, 1, h);
        const ig = g.createLinearGradient(cx - ins, 0, cx + ins, 0); ig.addColorStop(0, '#e9ecec'); ig.addColorStop(0.5, '#f6f7f7'); ig.addColorStop(1, '#e3e6e7');
        g.fillStyle = ig; g.fillRect(cx - ins, 0, ins * 2, h);
        g.fillStyle = '#b3babd'; g.fillRect(cx - ins - 1, 0, 1, h); g.fillRect(cx + ins, 0, 1, h);
        g.fillStyle = '#ffffff'; g.fillRect(cx - ins, 0, 0.8, h);
      }))); tx.anisotropy = ANISO; const m = new THREE.MeshPhongMaterial({ map: tx, color: 0xffffff, emissive: 0x141515, specular: 0x1c1c1c, shininess: 16 }); m.name = 'H-stud with insert'; return m; })());
    return WP.face === 0xffffff ? stud : (M['studIns' + WP.label] || (M['studIns' + WP.label] = (() => { const m = stud.clone(); m.color.set(WP.face); m.emissive.set(WP.emissive); return m; })()));
  };
  for (const i of A.opInfo) {
    const o = i.o, t = i.t, nx = -i.uz, nz = i.ux;
    curRef = o.id ? { kind: 'opening', id: o.id } : null;
    const ceilHere = i.hard ? wallCeil(plan, A, { x1: o.x1, z1: o.y1, x2: o.x2, z2: o.y2, t: i.t }) : H;
    const head = Math.min(i.hard ? Math.min(ceilHere, i.wallH || ceilHere) : (i.wallH || H), o.head || 7);
    const IP = i.hard ? wallPM(i.host && i.host.id) : null, top = i.wallH || H, hm = i.hard ? IP.trim : i.frame ? frameMats(o.x1, o.y1, o.x2, o.y2, t, top - head, undefined, head).mats : shellMat(i.kind, i.len, top - head, 0);
    if (top - head > 0.01 && o.type !== 'removable') {
      if (i.hard) {
        // header panels over a door or glass in a cleanroom wall: the same panels as the wall (its colour), equal
        // widths of up to 45″, with an H-stud and its insert between them (centred over a pair of doors)
        const PWd = 45 / 12, SWd = 3 / 12, F = panelFace(IP), SC = studMat(IP), E4 = [IP.edge, IP.edge, IP.edge, IP.edge], at = (q) => [o.x1 + i.ux * q, o.y1 + i.uz * q];
        const np = Math.max(1, Math.ceil((i.len + SWd - 1e-6) / (PWd + SWd))), pw = (i.len - (np - 1) * SWd) / np;
        for (let k = 0; k < np; k++) {
          const q0 = k * (pw + SWd), q1 = q0 + pw, [ax2, az2] = at(q0), [bx2, bz2] = at(q1);
          const hp = segBox(ax2, az2, bx2, bz2, head, top, t, E4.concat([F, F])); outline(hp); pick.push(hp);
          if (k < np - 1) { const [cx2, cz2] = at(q1 + SWd); pick.push(segBox(bx2, bz2, cx2, cz2, head, top, t + 0.006, E4.concat([SC, SC]))); }
        }
      } else { const h = segBox(o.x1, o.y1, o.x2, o.y2, head, top, t, hm); outline(h); pick.push(h); } if (i.hard && ceilHere - head > 0.2 && trackOK(top)) { if (top > ceilHere + 0.05) trackFaces(o.x1, o.y1, o.x2, o.y2, t, H, top); else segBox(o.x1, o.y1, o.x2, o.y2, H - 0.17, H, t + 0.03, M.track); } }
    const ax = o.x1, az = o.y1, bx = o.x2, bz = o.y2;
    const along = (s) => [ax + i.ux * s, az + i.uz * s];
    if (o.type === 'removable') {
      // removable wall section (equipment access): see removableLayout. Show removed (3D) hides the panels and
      // the studs between them, so you can see the opening a machine comes through.
      const RL = removableOf(plan, A, i), WP = i.hard ? IP : wallPM(null), tb = t + 0.004, EE = [WP.edge, WP.edge, WP.edge, WP.edge];
      // the steel tube is painted to match the room (the wall panels' colour), a little glossier than the panels
      const metal = M['remSteel' + WP.label] || (M['remSteel' + WP.label] = (() => { const m = new THREE.MeshPhongMaterial({ color: new THREE.Color(WP.face).multiplyScalar(0.97), emissive: WP.emissive, specular: 0x3a3d3f, shininess: 45 }); m.name = 'Removable section frame, 3x3 steel tube, painted ' + WP.label.toLowerCase(); return m; })());
      const box = (q, th, mat, line) => { const [p0x, p0z] = along(q.s0), [p1x, p1z] = along(q.s1); const m = segBox(p0x, p0z, p1x, p1z, q.y0, q.y1, th, mat); if (line) outline(m); pick.push(m); return m; };
      const face = panelFace(WP), sc = studMat(WP);
      for (const q of RL.posts) box(q, tb, metal, true);
      box(RL.headerTube, tb, metal, true);
      for (const q of RL.starts) box(q, tb, WP.trim, true);
      for (const q of RL.headers) box(q, t, EE.concat([face, face]), true);
      for (const q of RL.hstuds) box(q, t + 0.006, EE.concat([sc, sc]));
      const out = [];
      for (const q of RL.panels) out.push(box(q, t, EE.concat([face, face]), true));
      for (const q of RL.studs) out.push(box(q, t + 0.006, EE.concat([sc, sc])));
      const bq = { s0: RL.panels[0].s0, s1: RL.panels[RL.panels.length - 1].s1, y0: 0, y1: 0.333 };
      out.push(box(bq, t + 0.022, M.base));
      for (const q of [{ s0: 0, s1: bq.s0 }, { s0: bq.s1, s1: i.len }]) box({ ...q, y0: 0, y1: 0.333 }, t + 0.022, M.base);
      // closed, it blocks walking like a wall; removed, you can walk through
      const ob = { x1: o.x1, z1: o.y1, x2: o.x2, z2: o.y2, r: t / 2, doorGroup: { userData: { isOpen: false } } };
      doorObs.push(ob);
      // click it in 3D and the pieces come out of the wall and float to the side of the opening (click again: back)
      const home = out.map(m => ({ p: m.position.clone(), ry: m.rotation.y, s: (m.position.x - ax) * i.ux + (m.position.z - az) * i.uz, w: m.geometry.parameters ? m.geometry.parameters.width : 1 }));
      removable.push({ meshes: out, ob, o, home, ux: i.ux, uz: i.uz, nx, nz, len: i.len, t, k: 0, open: false, side: 1 });
      shadow((ax + bx) / 2, (az + bz) / 2, i.len, t, Math.atan2(-i.uz, i.ux));
    } else if (o.type === 'pass') {
      const sill = Math.max(0, Math.min(head - 0.5, o.sill == null ? 3 : o.sill)), D = Math.max(t + 0.1, o.depth || 2), ph = head - sill;
      if (sill > 0.01) { const lw = segBox(ax, az, bx, bz, 0, sill, t, i.hard ? IP.trim : shellMat(i.kind, i.len, sill, 0)); outline(lw); pick.push(lw); if (i.hard) segBox(ax, az, bx, bz, 0, 0.333, t + 0.022, M.base); }
      const body = segBox(ax, az, bx, bz, sill, head, D, M.steel); outline(body); pick.push(body);
      const [f1x, f1z] = along(-0.1), [f2x, f2z] = along(i.len + 0.1);
      segBox(f1x, f1z, f2x, f2z, sill - 0.1, sill, t + 0.05, M.steel); segBox(f1x, f1z, f2x, f2z, head, head + 0.1, t + 0.05, M.steel);
      segBox(f1x, f1z, ax, az, sill, head, t + 0.05, M.steel); segBox(bx, bz, f2x, f2z, sill, head, t + 0.05, M.steel);
      for (const sg of [1, -1]) {
        const off = sg * (D / 2 + 0.02), O = (s, k) => { const [x, z] = along(s); return [x + nx * (off + sg * (k || 0)), z + nz * (off + sg * (k || 0))]; };
        const [p1x, p1z] = O(0.08), [p2x, p2z] = O(i.len - 0.08);
        const dr = segBox(p1x, p1z, p2x, p2z, sill + 0.08, head - 0.08, 0.04, M.steelDoor); outline(dr); pick.push(dr);
        const [w1x, w1z] = O(i.len * 0.25, 0.012), [w2x, w2z] = O(i.len * 0.75, 0.012);
        segBox(w1x, w1z, w2x, w2z, sill + ph * 0.42, head - 0.22, 0.03, M.lite);
        const [h1x, h1z] = O(i.len - 0.3, 0.05), [h2x, h2z] = O(i.len - 0.22, 0.05);
        segBox(h1x, h1z, h2x, h2z, sill + ph * 0.3, sill + ph * 0.62, 0.08, M.closer);
      }
      shadow((ax + bx) / 2, (az + bz) / 2, i.len, D, Math.atan2(-i.uz, i.ux), 0.5);
    } else if (o.type === 'window') {
      // house window: wall below, white vinyl frame with a meeting rail, glass, interior stool and casing
      const sill = Math.max(0, Math.min(head - 0.5, o.sill == null ? 3 : o.sill));
      if (sill > 0.01) { const sw = segBox(ax, az, bx, bz, 0, sill, t, i.frame ? frameMats(ax, az, bx, bz, t, sill).mats : i.hard ? IP.trim : shellMat(i.kind, i.len, sill, 0)); outline(sw); pick.push(sw); }
      const fw = 0.17, [p1x, p1z] = along(fw), [p2x, p2z] = along(i.len - fw);
      segBox(ax, az, bx, bz, sill, sill + fw, t * 0.7, M.frame); segBox(ax, az, bx, bz, head - fw, head, t * 0.7, M.frame);
      segBox(ax, az, p1x, p1z, sill, head, t * 0.7, M.frame); segBox(p2x, p2z, bx, bz, sill, head, t * 0.7, M.frame);
      const mid = (sill + head) / 2; segBox(p1x, p1z, p2x, p2z, mid - 0.05, mid + 0.05, t * 0.5, M.frame);
      segBox(p1x, p1z, p2x, p2z, sill + fw, head - fw, 0.03, M.lite);
      // stool (inside ledge) and casing on both faces
      const [c1x, c1z] = along(-0.29), [c2x, c2z] = along(i.len + 0.29);
      segBox(c1x, c1z, c2x, c2z, sill - 0.06, sill, t + 0.2, M.frame);
      for (const sd of [1, -1]) {
        const ox = nx * sd * (t / 2 + 0.02), oz = nz * sd * (t / 2 + 0.02);
        segBox(c1x + ox, c1z + oz, c2x + ox, c2z + oz, head, head + 0.29, 0.05, M.frame);
        segBox(c1x + ox, c1z + oz, ax + ox, az + oz, sill, head, 0.05, M.frame); segBox(bx + ox, bz + oz, c2x + ox, c2z + oz, sill, head, 0.05, M.frame);
      }
    } else if (o.type === 'glass') {
      const sill = Math.max(0, Math.min(head - 0.5, o.sill == null ? 3 : o.sill));
      if (sill > 0.01) { const s = segBox(ax, az, bx, bz, 0, sill, t, i.hard ? IP.trim : shellMat(i.kind, i.len, sill, 0)); outline(s); pick.push(s); if (i.hard) segBox(ax, az, bx, bz, 0, 0.333, t + 0.022, M.base); }
      segBox(ax, az, bx, bz, sill, head, 0.05, M.glass);
      segBox(ax, az, bx, bz, sill, sill + 0.12, t + 0.06, M.frame);
      segBox(ax, az, bx, bz, head - 0.12, head, t + 0.06, M.frame);
      const [p1x, p1z] = along(0.12), [p2x, p2z] = along(i.len - 0.12);
      segBox(ax, az, p1x, p1z, sill, head, t + 0.06, M.frame);
      segBox(p2x, p2z, bx, bz, sill, head, t + 0.06, M.frame);
      shadow((ax + bx) / 2, (az + bz) / 2, i.len, t, Math.atan2(-i.uz, i.ux), 0.6);
    } else if (o.type === 'overhead') {
      // overhead sectional door: steel jamb guards, the closed curtain of ribbed panels, the coil/track
      // housing above it on the inside face
      const ohd = new THREE.MeshPhongMaterial({ map: (() => { const tx = new THREE.CanvasTexture(cachedCanvas('ohd', () => makeCanvas(32, 128, (g, w, h) => { g.fillStyle = '#d9dee1'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, y + 2, w, 2); for (let k = 8; k < 32; k += 8) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, y + k, w, 1); } } }))); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(Math.max(1, i.len / 4), head / 8); return tx; })(), specular: 0x666666, shininess: 40 });
      const cur = segBox(ax, az, bx, bz, 0, head, 0.14, ohd); outline(cur); pick.push(cur);
      const [j1x, j1z] = along(-0.33), [j2x, j2z] = along(i.len + 0.33);
      segBox(j1x, j1z, ax, az, 0, head, t + 0.1, M.steel); segBox(bx, bz, j2x, j2z, 0, head, t + 0.1, M.steel);
      const osw = o.swing === -1 ? -1 : 1, inX = nx * osw * (t / 2 + 0.55), inZ = nz * osw * (t / 2 + 0.55);
      if (top - head > 1.2) { const hb = segBox(ax + inX, az + inZ, bx + inX, bz + inZ, head + 0.1, head + 1.4, 1.0, M.steel); outline(hb); }
      shadow((ax + bx) / 2, (az + bz) / 2, i.len, t, Math.atan2(-i.uz, i.ux), 0.6);
    } else if (doorSpec(o, i.len)) {
      // standard cleanroom door: jambs and the meeting strip inside the opening, the frame head, then the leaves
      const S = doorSpec(o, i.len), hd = Math.min(head, S.head), fr = M.frame;
      const [k1x, k1z] = along(S.jamb), [k2x, k2z] = along(i.len - S.jamb);
      for (const [p, q] of [[[ax, az], [k1x, k1z]], [[k2x, k2z], [bx, bz]]]) { const j = segBox(p[0], p[1], q[0], q[1], 0, hd, t + 0.06, fr); outline(j); pick.push(j); }
      if (S.mull > 0) { const [m1x, m1z] = along(i.len / 2 - S.mull / 2), [m2x, m2z] = along(i.len / 2 + S.mull / 2); const ms = segBox(m1x, m1z, m2x, m2z, 0, S.leafH, t + 0.02, fr); outline(ms); pick.push(ms); }
      const hb = segBox(ax, az, bx, bz, S.leafH, hd, t + 0.06, fr); outline(hb);
      // the header panel over the door, up to the head the opening was given (the wall above that is drawn already)
      if (head > hd + 0.01) { const hp = segBox(ax, az, bx, bz, hd, head, t, i.hard ? IP.trim : hm); outline(hp); pick.push(hp); segBox(ax, az, bx, bz, hd, hd + 0.25, t + 0.012, M.white); }
      for (const l of i.leaves) {
        const baseAngle = Math.atan2(-(l.z2 - l.z1), l.x2 - l.x1), ldx = l.x2 - l.x1, ldz = l.z2 - l.z1;
        const swingDir = (l.tx != null ? (ldz * l.tx - ldx * l.tz) : l.leafSw) >= 0 ? 1 : -1;
        const doorGroup = new THREE.Group(); doorGroup.position.set(l.x1, 0, l.z1); doorGroup.rotation.y = baseAngle;
        doorGroup.userData = { isDoor: true, isOpen: false, baseRotation: baseAngle, openAngle: 0, swingDir, side: [l.tx, l.tz] };
        root.add(doorGroup); doors.push(doorGroup); doorObs.push({ x1: l.x1, z1: l.z1, x2: l.x2, z2: l.z2, r: 0.07, doorGroup });
        const L = Math.hypot(ldx, ldz) || 1, top = S.leafH - 0.02, lm = new THREE.Group(); doorGroup.add(lm);
        const g0 = (L - S.vis.w) / 2, g1 = g0 + S.vis.w, v0 = S.vis.y0, v1 = v0 + S.vis.h, gl = 1 / 12;
        const parts = [[0, L, 0.03, v0], [0, L, v1, top], [0, g0, v0, v1], [g1, L, v0, v1]].map(([u0, u1, y0, y1]) => localSegBox(lm, u0, 0, u1, 0, y0, y1, 0.145, M.leaf));
        // one outline round the whole leaf (the leaf is built in four pieces round the glass; outlining each piece
        // drew seams across the door at the top and bottom of the vision lite)
        parts.forEach(m => pick.push(m));
        { const ghost = localSegBox(lm, 0, 0, L, 0, 0.03, top, 0.145, M.leaf), ln = new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry, 25), M.line);
          ln.position.copy(ghost.position); ln.rotation.copy(ghost.rotation); ln.scale.copy(ghost.scale); lm.remove(ghost); lm.add(ln); }
        // vision frame (26″ × 36″) and the 24″ × 34″ glass
        localSegBox(lm, g0, 0, g0 + gl, 0, v0, v1, 0.18, fr); localSegBox(lm, g1 - gl, 0, g1, 0, v0, v1, 0.18, fr);
        localSegBox(lm, g0, 0, g1, 0, v0, v0 + gl, 0.18, fr); localSegBox(lm, g0, 0, g1, 0, v1 - gl, v1, 0.18, fr);
        localSegBox(lm, g0 + gl, 0, g1 - gl, 0, v0 + gl, v1 - gl, 0.06, M.lite);
        // lever on the latch edge, both faces
        localSegBox(lm, L - 0.42, 0, L - 0.12, 0, S.lever - 0.04, S.lever + 0.04, 0.4, M.closer);
        // closer arm at the top, on the swing side
        localSegBox(lm, L * 0.08, 0.13, L * 0.45, 0.13, top - 0.42, top - 0.2, 0.13, M.closer);
        shadow((l.x1 + l.x2) / 2, (l.z1 + l.z2) / 2, l.w, 0.14, Math.atan2(-(l.z2 - l.z1), l.x2 - l.x1), 0.45);
      }
    } else {
      const [j1x, j1z] = along(-0.14), [j2x, j2z] = along(i.len + 0.14);
      segBox(j1x, j1z, ax, az, 0, head, t + 0.06, M.frame);
      segBox(bx, bz, j2x, j2z, 0, head, t + 0.06, M.frame);
      segBox(j1x, j1z, j2x, j2z, head - 0.02, Math.min(H, head + 0.12), t + 0.06, M.frame);
      if (i.frame && (o.type === 'door' || o.type === 'door2')) {
        // a house door's jambs and head inside the opening, the full wall depth, so nothing shows past the leaf;
        // an outside door gets a threshold
        const r = o.type === 'door' ? 0.12 : 0.1, [k1x, k1z] = along(0.1), [k2x, k2z] = along(i.len - r);
        segBox(ax, az, k1x, k1z, 0, head, t + 0.01, M.frame); segBox(k2x, k2z, bx, bz, 0, head, t + 0.01, M.frame);
        const lt = Math.min(head - 0.05, 6.7); if (head - lt > 0.005) segBox(ax, az, bx, bz, lt, head, t + 0.01, M.frame);
        const FPh = footprint(A, true), mx = (ax + bx) / 2, mz = (az + bz) / 2, outD = FPh && (!FPh.has(mx + nx * (t / 2 + 0.8), mz + nz * (t / 2 + 0.8)) || !FPh.has(mx - nx * (t / 2 + 0.8), mz - nz * (t / 2 + 0.8)));
        if (outD) segBox(ax, az, bx, bz, 0, 0.06, t + 0.12, M.steel || M.frame);
      }
      for (const l of i.leaves) {
        const baseAngle = Math.atan2(-(l.z2 - l.z1), l.x2 - l.x1);
        // Open toward the swing side shown on the plan. Turning by +90° sends the leaf's direction (dx, dz)
        // to (dz, −dx); pick the turn that lands on the swing side. Both leaves of a pair then open the same way.
        const ldx = l.x2 - l.x1, ldz = l.z2 - l.z1;
        const swingDir = (l.tx != null ? (ldz * l.tx - ldx * l.tz) : l.leafSw) >= 0 ? 1 : -1;

        const doorGroup = new THREE.Group();
        doorGroup.position.set(l.x1, 0, l.z1);
        doorGroup.rotation.y = baseAngle;
        doorGroup.userData = { 
          isDoor: true, 
          isOpen: false, 
          baseRotation: baseAngle,
          openAngle: 0,
          swingDir: swingDir,
          side: [l.tx, l.tz]
        };
        root.add(doorGroup);
        doors.push(doorGroup);

        doorObs.push({ x1: l.x1, z1: l.z1, x2: l.x2, z2: l.z2, r: 0.07, doorGroup });

        const leafLen = Math.hypot(l.x2 - l.x1, l.z2 - l.z1) || 1;
        const top = Math.min(head - 0.1, 6.9);
        const f = (k) => [leafLen * k, 0];
        const g0 = 0.2, g1 = 0.8, v0 = 3.6, v1 = Math.min(6.05, top - 0.5);
        const [a0x, a0z] = f(0), [b0x, b0z] = f(g0), [b1x, b1z] = f(g1), [a1x, a1z] = f(1);

        const leafMesh = new THREE.Group();
        doorGroup.add(leafMesh);
        if (i.frame) {
          // house door: a painted two-panel door with a round knob
          const top2 = Math.min(head - 0.05, 6.7), L2 = leafLen;
          const slab = localSegBox(leafMesh, 0, 0, L2, 0, 0.03, top2, 0.145, M.leaf); outline(slab); pick.push(slab);
          for (const [z0, z1] of [[0.6, 3.1], [3.6, top2 - 0.5]]) localSegBox(leafMesh, L2 * 0.18, 0, L2 * 0.82, 0, z0, z1, 0.165, M.edge);
          for (const sd of [1, -1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), M.closer); k.position.set(L2 * 0.9, 3, sd * 0.16); leafMesh.add(k); }
          shadow((l.x1 + l.x2) / 2, (l.z1 + l.z2) / 2, l.w, 0.14, Math.atan2(-(l.z2 - l.z1), l.x2 - l.x1), 0.45);
          continue;
        }

        const m1 = localSegBox(leafMesh, a0x, a0z, a1x, a1z, 0.05, v0, 0.14, M.leaf);
        const m2 = localSegBox(leafMesh, a0x, a0z, a1x, a1z, v1, top, 0.14, M.leaf);
        const m3 = localSegBox(leafMesh, a0x, a0z, b0x, b0z, v0, v1, 0.14, M.leaf);
        const m4 = localSegBox(leafMesh, b1x, b1z, a1x, a1z, v0, v1, 0.14, M.leaf);

        // one outline round the whole leaf: outlining the pieces it's built from (round the vision lite) drew lines
        // across the door at the top and bottom of the glass
        [m1, m2, m3, m4].forEach(m => pick.push(m));
        { const ghost = localSegBox(leafMesh, a0x, a0z, a1x, a1z, 0.05, top, 0.14, M.leaf), ln = new THREE.LineSegments(new THREE.EdgesGeometry(ghost.geometry, 25), M.line);
          ln.position.copy(ghost.position); ln.rotation.copy(ghost.rotation); ln.scale.copy(ghost.scale); leafMesh.remove(ghost); leafMesh.add(ln); }

        localSegBox(leafMesh, b0x, b0z, b1x, b1z, v0, v1, 0.06, M.lite);

        const [c0x, c0z] = f(g0 - 0.035), [c1x, c1z] = f(g1 + 0.035);
        localSegBox(leafMesh, c0x, c0z, c1x, c1z, v0 - 0.07, v0, 0.18, M.frame);
        localSegBox(leafMesh, c0x, c0z, c1x, c1z, v1, v1 + 0.07, 0.18, M.frame);
        localSegBox(leafMesh, c0x, c0z, b0x, b0z, v0, v1, 0.18, M.frame);
        localSegBox(leafMesh, b1x, b1z, c1x, c1z, v0, v1, 0.18, M.frame);

        const [d0x, d0z] = f(0.08), [d1x, d1z] = f(0.45);
        localSegBox(leafMesh, d0x, d0z + 0.13, d1x, d1z + 0.13, top - 0.42, top - 0.2, 0.13, M.closer);

        const [h0x, h0z] = f(0.86), [h1x, h1z] = f(0.94);
        localSegBox(leafMesh, h0x, h0z, h1x, h1z, 3.25, 3.33, 0.42, M.closer);

        shadow((l.x1 + l.x2) / 2, (l.z1 + l.z2) / 2, l.w, 0.14, Math.atan2(-(l.z2 - l.z1), l.x2 - l.x1), 0.45);
      }
    }
  }

  curRef = null;
  for (const b of A.boxes) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0; if (w < 0.02 || d < 0.02) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), M.white);
    m.position.set((b.x0 + b.x1) / 2, H / 2, (b.z0 + b.z1) / 2); root.add(m); outline(m); pick.push(m);
    if (b.c && b.c.id) m.userData.ref = { kind: 'chase', id: b.c.id };
    const cv = new THREE.Mesh(new THREE.BoxGeometry(w + 0.022, 0.333, d + 0.022), M.base); cv.position.set(m.position.x, 0.1665, m.position.z); root.add(cv);
    if (trackOK(WH)) { const ct = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.17, d + 0.03), M.track); ct.position.set(m.position.x, H - 0.085, m.position.z); root.add(ct); }
    shadow(m.position.x, m.position.z, w, d, 0, 1.0);
    const f = b.grille;
    if (f) {
      const G = grilleSize(b.c, (f === 'N' || f === 'S') ? w : d, H);
      const gh = G.h, gy = G.sill + gh / 2, gt = 0.04, glen = G.w;
      let gm;
      if (f === 'W' || f === 'E') { gm = new THREE.Mesh(new THREE.BoxGeometry(gt, gh, glen), M.grille); gm.position.set(f === 'W' ? b.x0 - gt / 2 : b.x1 + gt / 2, gy, m.position.z); }
      else { gm = new THREE.Mesh(new THREE.BoxGeometry(glen, gh, gt), M.grille); gm.position.set(m.position.x, gy, f === 'N' ? b.z0 - gt / 2 : b.z1 + gt / 2); }
      root.add(gm);
      const tg = new THREE.BoxGeometry(0.14, H - 0.503, 0.14), corners = [];
      if (f === 'W') corners.push([b.x0, b.z0], [b.x0, b.z1]); else if (f === 'E') corners.push([b.x1, b.z0], [b.x1, b.z1]);
      else if (f === 'N') corners.push([b.x0, b.z0], [b.x1, b.z0]); else corners.push([b.x0, b.z1], [b.x1, b.z1]);
      corners.forEach(([x, z]) => { const t = new THREE.Mesh(tg, M.frame); t.position.set(x, 0.333 + (H - 0.503) / 2, z); root.add(t); outline(t); });
    }
  }

  // the cleanroom (hardwall) footprint carries the grid ceiling; the whole building's footprint carries the floor
  const FP = footprint(A), FPall = footprint(A, true) || FP;
  const fTex = new THREE.CanvasTexture(floorCanvas); fTex.wrapS = fTex.wrapT = THREE.RepeatWrapping; fTex.anisotropy = ANISO;
  // a building with no cleanroom walls has a plain concrete slab; cleanrooms get the gray epoxy floor
  const fMat = new THREE.MeshPhongMaterial({ map: fTex, color: A.hardAny ? 0x9ea2a3 : 0xb7b4ad, specular: 0x101010, shininess: A.hardAny ? 22 : 8, name: A.hardAny ? 'Floor, cleanroom coating' : 'Floor, concrete' });
  let floor;
  // houses: a floor finish for the whole house (plan.floorType), and per room where a room label sets one
  const fl = A.house ? floorMat(THREE, plan.floorType || 'lvp') : null;
  const fRects = FPall ? (plan.__floorHoles && plan.__floorHoles.length ? subtractRects(FPall.rects, plan.__floorHoles) : FPall.rects) : null;
  if (FPall) floor = fl ? new THREE.Mesh(rectsGeometry(THREE, fRects, 0.01, false, fl.su, fl.sv, 0, 0), fl.mat) : new THREE.Mesh(rectsGeometry(THREE, fRects, 0.01, false, 12, 12, 0, 0), fMat);
  else { fTex.repeat.set(B.w / 12, B.d / 12); floor = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.d), fMat); floor.rotation.x = -Math.PI / 2; floor.position.set(B.cx, 0.01, B.cz); }
  root.add(floor);
  if (A.house && FPall) for (const r of roomRegions(A, plan)) {
    if (!r.room.floor || r.room.floor === (plan.floorType || 'lvp')) continue;
    const F = floorMat(THREE, r.room.floor); root.add(new THREE.Mesh(rectsGeometry(THREE, plan.__floorHoles ? subtractRects(r.rects, plan.__floorHoles) : r.rects, 0.035, false, F.su, F.sv, 0, 0), F.mat));
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(B.w + 140, B.d + 140), new THREE.MeshLambertMaterial({ color: 0xc4c8c2, name: 'Ground' }));
  // a house on a stem wall, crawlspace or basement sits up off the ground: the ground drops below the floor and the
  // foundation shows between them
  const gDrop = A.frameAny ? ((FOUNDATIONS[foundationOf(plan).type] || {}).exp || 0) : 0;
  ground.rotation.x = -Math.PI / 2; ground.position.set(B.cx, -0.08 - gDrop, B.cz); root.add(ground);

  const ceiling = new THREE.Group(); root.add(ceiling);
  let gridLines = null;
  const cTex = new THREE.CanvasTexture(ceilCanvas); cTex.wrapS = cTex.wrapT = THREE.RepeatWrapping; cTex.repeat.set(B.w / 2, B.d / 4); cTex.anisotropy = ANISO;
  const built = isBuilt(plan), ownGrid = built || (Array.isArray(plan.ceilingGrid) && plan.ceilingGrid.length > 0);
  const ownLines = () => (built ? builtLines(plan) : ceilingLines(plan, A));
  let cMap = cTex;
  // the tees are real geometry wherever the ceiling is laid out (FP), so the tiles carry no painted lines there,
  // only a faint shadow where each pan meets its tee
  const geoGrid = !!FP && !A.house, lined = !ownGrid && !geoGrid;
  const GC = new THREE.Color(GRID_COLORS[gridColorOf(plan)][1]), GRID_NAME = gridColorOf(plan) === 'alum' ? 'Ceiling grid, aluminum' : 'Ceiling grid, enamel';
  const edge = (g, w, h) => { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); g.fillStyle = 'rgba(0,0,0,.035)'; g.fillRect(0, 3, w, 3); g.fillRect(3, 0, 3, h); };
  if (!ownGrid && geoGrid && tileTypeOf(plan) !== 'alum') {
    cMap = new THREE.CanvasTexture(cachedCanvas('ceilVcgEdge', () => makeCanvas(128, 256, (g, w, h) => { g.fillStyle = '#f3f4f3'; g.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(150,154,156,${Math.random() * .06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } edge(g, w, h); })));
    cMap.wrapS = cMap.wrapT = THREE.RepeatWrapping; cMap.anisotropy = ANISO;
  }
  if (ownGrid) {
    const plain = cachedCanvas('ceilPlainVcg', () => makeCanvas(128, 128, (g, w, h) => { g.fillStyle = '#f3f4f3'; g.fillRect(0, 0, w, h); for (let i = 0; i < 250; i++) { g.fillStyle = `rgba(150,154,156,${Math.random() * .06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }));
    cMap = new THREE.CanvasTexture(plain); cMap.wrapS = cMap.wrapT = THREE.RepeatWrapping; cMap.repeat.set(B.w / 2, B.d / 2); cMap.anisotropy = ANISO;
  }
  // both sides, so the grid shows from above in the Plenum view
  const TT = tileTypeOf(plan), TC = tileColorOf(plan);
  // Aluminum pans, natural or painted. The tee grid is white enamel whatever the tiles are: on the standard grid
  // it is drawn into each tile's texture (a 2'x4' cell, its lines along two edges), so it shows on every colour;
  // a drawn grid (ownGrid) has its own tees.
  const grid = (g, w, h) => {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, w, 4); g.fillRect(0, 0, 4, h);
    g.fillStyle = '#e9ecee'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
    g.fillStyle = '#fbfcfc'; g.fillRect(0, 0, w, 1); g.fillRect(0, 0, 1, h);
  };
  const tileTex = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(B.w / 2, B.d / (ownGrid ? 2 : 4)); t.anisotropy = ANISO; return t; };
  let cMat;
  if (TT === 'alum' && TC !== 'natural') {
    // painted pans: the paint is in the texture (so the grid stays white), a smooth satin face
    const hex = PANEL_COLORS[TC][1];
    cMap = tileTex(cachedCanvas('ceilPaint' + hex + (ownGrid ? 'P' : lined ? 'G' : 'E'), () => makeCanvas(128, ownGrid ? 128 : 256, (g, w, h) => {
      g.fillStyle = hex; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .035})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      // a soft shadow line along the pan's turned-down edge
      if (lined) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(4, 4, w - 4, 3); g.fillRect(4, 4, 3, h - 4); grid(g, w, h); } else if (!ownGrid) edge(g, w, h);
    })));
    cMat = new THREE.MeshPhongMaterial({ map: cMap, color: 0xf2f2f2, emissive: 0x858585, emissiveMap: cMap, specular: 0x333333, shininess: 30, name: 'Ceiling tile, ' + tileName(plan) });
  } else if (TT === 'alum') {
    // natural pans: a fine brushed grain
    cMap = tileTex(cachedCanvas('ceilAlum' + (ownGrid ? 'P' : lined ? 'G' : 'E'), () => makeCanvas(128, ownGrid ? 128 : 256, (g, w, h) => {
      g.fillStyle = '#c9ced1'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '90,96,100'},${Math.random() * .12})`; g.fillRect(0, y, w, 1); }
      if (lined) { g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(4, 4, w - 4, 3); g.fillRect(4, 4, 3, h - 4); grid(g, w, h); } else if (!ownGrid) edge(g, w, h);
    })));
    cMat = new THREE.MeshPhongMaterial({ map: cMap, color: 0xd8dde0, emissive: 0x6a6f72, emissiveMap: cMap, specular: 0xbfc5c9, shininess: 70, name: 'Ceiling tile, aluminum' });
  } else cMat = new THREE.MeshLambertMaterial({ map: cMap, color: 0xc4c6c6, emissive: 0x9c9e9e, emissiveMap: cMap, name: 'Ceiling tile, vinyl-covered gypsum' });
  let ceil;
  if (FP) {
    cMap.repeat.set(1, 1);
    const CG = ceilingGrid(plan, A);
    const CR = ceilingRects(plan, FP, A), GP = gridPieces(plan, CR, CG);
    // each grid section's tiles laid on its own grid (the main grid first)
    GP.forEach((gp, i) => {
      const G = gp.G, m = new THREE.Mesh(rectsGeometry(THREE, subtractRects(gp.rects, CA.concat(plan.__ceilHoles || [])), H, true, 2, ownGrid ? 2 : 4, G.ox, G.oz, G.swap && !ownGrid), cMat);
      if (!ceil) ceil = m; else ceil.add(m);
      for (const a of CA) ceil.add(new THREE.Mesh(rectsGeometry(THREE, clipRects(gp.rects, a), a.h, true, 2, ownGrid ? 2 : 4, G.ox, G.oz, G.swap && !ownGrid), cMat));
    });
    if (!ceil) ceil = new THREE.Mesh(new THREE.BufferGeometry(), cMat);
  } else if (A.hardAny || !A.shellTop) { ceil = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.d), cMat); ceil.rotation.x = Math.PI / 2; ceil.position.set(B.cx, H, B.cz); }
  // a house has a plain drywall ceiling, no grid
  if (ceil && A.house) ceil.material = new THREE.MeshLambertMaterial({ color: 0xf4f2ee, emissive: 0xa9a7a3, side: THREE.DoubleSide });
  if (ceil) ceiling.add(ceil);
  // The top of the grid ceiling, as seen from the plenum: the backs of the tiles framed by the T-grid
  // (main and cross tees standing up 1½″), so the Plenum view shows the grid instead of a white sheet.
  if (ceil && !A.house && FP) {
    const CG = ceilingGrid(plan, A), sw = CG.swap && !ownGrid;
    // the tile backs: solid kraft-paper brown (the gypsum board's paper back), as seen from the plenum
    const topCanvas = cachedCanvas(ownGrid ? 'ceilTopPlainK' : 'ceilTopK', () => makeCanvas(128, ownGrid ? 128 : 256, (g, w, h) => {
      g.fillStyle = '#a8825a'; g.fillRect(0, 0, w, h);
      if (!ownGrid) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, w, 4); g.fillRect(0, 0, 4, h); g.fillStyle = '#f1f3f4'; g.fillRect(0, 0, w, 2.5); g.fillRect(0, 0, 2.5, h); }
    }));
    const tt = new THREE.CanvasTexture(topCanvas); tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.anisotropy = ANISO;
    const topMat = new THREE.MeshLambertMaterial({ map: tt, color: 0xffffff, name: 'Ceiling tile, back (kraft paper)' });
    const CR = ceilingRects(plan, FP, A);
    for (const gp of gridPieces(plan, CR, CG)) {
      const G = gp.G, gsw = G.swap && !ownGrid;
      ceiling.add(new THREE.Mesh(rectsGeometry(THREE, subtractRects(gp.rects, CA), H + 0.004, false, 2, ownGrid ? 2 : 4, G.ox, G.oz, gsw), topMat));
      for (const a of CA) ceiling.add(new THREE.Mesh(rectsGeometry(THREE, clipRects(gp.rects, a), a.h + 0.004, false, 2, ownGrid ? 2 : 4, G.ox, G.oz, gsw), topMat));
    }
    // the tees: thin webs standing up along every grid line, only over the ceiling
    const lines = [];
    const genLines = !ownGrid ? generatedGridLines(plan, A) : null;
    if (ownGrid) for (const q of ownLines()) lines.push(q);
    else if (genLines) lines.push(...genLines);
    else {
      const step = FP.cell / 2, runs = (fixed, lo, hi, isX) => {
        let st = null;
        for (let v = lo; v <= hi + 1e-9; v += step) {
          const inside = isX ? inCeiling(plan, FP, fixed, v) : inCeiling(plan, FP, v, fixed);
          if (inside && st === null) st = v;
          if ((!inside || v + step > hi + 1e-9) && st !== null) { const e = inside ? v : v - step; if (e - st > 0.3) lines.push(isX ? [fixed, st, fixed, e] : [st, fixed, e, fixed]); st = null; }
        }
      };
      for (let x = CG.ox + Math.ceil((B.minX - CG.ox) / CG.cw) * CG.cw; x <= B.maxX; x += CG.cw) runs(x, B.minZ, B.maxZ, true);
      for (let z = CG.oz + Math.ceil((B.minZ - CG.oz) / CG.cl) * CG.cl; z <= B.maxZ; z += CG.cl) runs(z, B.minX, B.maxX, false);
    }
    gridLines = lines;
    const tp = [], web = 0.014;
    for (const q of [].concat(...lines.map(l => splitByAreas(l, CA, H)))) {
      const y0 = q[4] + 0.004, y1 = q[4] + 0.14;
      const L = Math.hypot(q[2] - q[0], q[3] - q[1]); if (!(L > 0.05)) continue;
      const nx = -(q[3] - q[1]) / L * web, nz = (q[2] - q[0]) / L * web;
      for (const sd of [1, -1]) { const a = [q[0] + nx * sd, y0, q[1] + nz * sd], b = [q[2] + nx * sd, y0, q[3] + nz * sd], c = [q[2] + nx * sd, y1, q[3] + nz * sd], d = [q[0] + nx * sd, y1, q[1] + nz * sd]; tp.push(...a, ...b, ...c, ...a, ...c, ...d); }
      const a = [q[0] + nx, y1, q[1] + nz], b = [q[2] + nx, y1, q[3] + nz], c = [q[2] - nx, y1, q[3] - nz], d = [q[0] - nx, y1, q[1] - nz]; tp.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
    if (tp.length) { const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.computeVertexNormals(); ceiling.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: GC.clone().lerp(new THREE.Color(0xffffff), 0.25), emissive: GC.clone().multiplyScalar(0.2), side: THREE.DoubleSide, name: 'Ceiling grid tees, top' }))); }
  }
  // the roof (houses): gable, hip or flat, over the outside walls with an overhang
  const roof = new THREE.Group(); root.add(roof);
  if (A.frameAny && FPall && plan.roof && plan.roof.type && plan.roof.type !== 'none') buildRoof(THREE, roof, A, plan, FPall, sidingMat, M);
  // plenum lid: the top of the cleanroom, over the plenum (hidden in Dollhouse and Plenum views)
  const lid = new THREE.Group(); root.add(lid);
  const DK = deckShapes(plan);
  // steel roof deck: galvanized, ribbed every 6″
  const dc = cachedCanvas('deck', () => makeCanvas(64, 64, (g, w, h) => { g.fillStyle = '#a9afb3'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x, 0, 5, h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 9, 0, 3, h); } }));
  const dtx = new THREE.CanvasTexture(dc); dtx.wrapS = dtx.wrapT = THREE.RepeatWrapping; dtx.repeat.set(0.5, 0.5); dtx.anisotropy = ANISO;
  const dm = new THREE.MeshPhongMaterial({ map: dtx, color: 0xd5dadd, specular: 0x555555, shininess: 40, side: THREE.DoubleSide, name: 'Lid deck, galvanized' });
  if (DK.length) {
    // a roof deck / lid drawn and placed over the cleanroom: its outline, 2″ thick, on top of the plenum and beams
    const sarea = (R) => { let a = 0; for (let i = 0; i < R.length; i++) { const [x1, y1] = R[i], [x2, y2] = R[(i + 1) % R.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
    for (const d of DK) {
      const parts = deckParts(plan, A, d, WH);
      for (const pt of parts) {
        if (pt.outer.length < 3 || Math.abs(sarea(pt.outer)) < 0.01) continue;
        const sh = new THREE.Shape(pt.outer.map(([x, z]) => new THREE.Vector2(x, z)));
        for (const h of pt.holes) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.17, bevelEnabled: false }), m = new THREE.Mesh(g, dm);
        m.rotation.x = Math.PI / 2; m.position.y = pt.h + 0.17; outline(m); if (d.id) m.userData.ref = { kind: 'deck', id: d.id }; pick.push(m); lid.add(m);
      }
    }
    // the steps in the lid: wall panels from the lower lid up to the higher one, seams (H-mold) every 4′
    for (const q of deckSteps(plan, A, WH)) {
      if (q.y1 - q.y0 < 0.05) continue;
      const tex = new THREE.CanvasTexture(seamCanvas); tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = ANISO; tex.repeat.set(q.len / 4, 1);
      const PP = panelMats(panelColorOf(plan)), face = new THREE.MeshPhongMaterial({ map: tex, color: PP.face, emissive: PP.emissive, specular: 0x1c1c1c, shininess: 16, name: 'Wall panel, ' + PP.label.toLowerCase() });
      curRef = q.id ? { kind: 'lstep', id: q.id } : null;
      const m = localSegBox(lid, q.x1, q.z1, q.x2, q.z2, q.y0, q.y1, q.t, [M.edge, M.edge, M.edge, M.edge, face, face]); if (curRef) m.userData.ref = curRef; outline(m); pick.push(m);
      // closure channel along the bottom, cap along the top
      localSegBox(lid, q.x1, q.z1, q.x2, q.z2, q.y0 - 0.015, q.y0 + 0.06, q.t + 0.012, M.white);
      localSegBox(lid, q.x1, q.z1, q.x2, q.z2, q.y1 - 0.04, q.y1, q.t + 0.03, M.white);
      curRef = null;
    }
  } else if (A.PL > 0 && FP) {
    // the cleanroom's own lid: the same galvanized steel deck as a drawn lid (its uv runs 4′ to a repeat here)
    const ltx = dtx.clone(); ltx.repeat.set(2, 2); ltx.needsUpdate = true;
    const lm = dm.clone(); lm.map = ltx; lm.name = 'Lid deck, galvanized';
    const LR = ceilingRects(plan, FP, A);
    // a taller section (a ceiling area set to raise the walls): its own top, and panels closing the step
    const up = ceilAreas(plan, A).filter(a => a.raise && a.h + A.PL > WH + 0.05);
    // it rests on the wall caps, or on the beams where beams sit on the walls
    const lidY = lidTop(plan, A);
    lid.add(new THREE.Mesh(rectsGeometry(THREE, up.length ? subtractRects(LR, up) : LR, lidY, true, 4, 4, 0, 0), lm));
    for (const a of up) {
      const T = a.h + A.PL;
      lid.add(new THREE.Mesh(rectsGeometry(THREE, clipRects(LR, a), T, true, 4, 4, 0, 0), lm));
      // the step from the lower top up to this one, along the area's edge where it isn't against a wall
      const st = 0.25, pos = [];
      for (const [ax, az, bx, bz, nx, nz] of [[a.x0, a.z0, a.x1, a.z0, 0, -1], [a.x0, a.z1, a.x1, a.z1, 0, 1], [a.x0, a.z0, a.x0, a.z1, -1, 0], [a.x1, a.z0, a.x1, a.z1, 1, 0]]) {
        const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / st)); let s0 = null;
        const need = (x, z) => inCeiling(plan, FP, x + nx * 0.3, z + nz * 0.3) && inCeiling(plan, FP, x - nx * 0.3, z - nz * 0.3) && !A.pieces.some(p => segDist(x, z, p.x1, p.z1, p.x2, p.z2) < (p.t || 0.25) / 2 + 0.1);
        for (let k = 0; k <= n; k++) {
          const tt = k / n, x = ax + (bx - ax) * tt, z = az + (bz - az) * tt, on = k < n && need(x + (bx - ax) / n / 2, z + (bz - az) / n / 2);
          if (on && s0 === null) s0 = tt;
          if (!on && s0 !== null) { const p1 = [ax + (bx - ax) * s0, az + (bz - az) * s0], p2 = [x, z]; pos.push(p1[0], WH, p1[1], p2[0], WH, p2[1], p2[0], T, p2[1], p1[0], WH, p1[1], p2[0], T, p2[1], p1[0], T, p1[1]); s0 = null; }
        }
      }
      if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xf4f6f6, side: THREE.DoubleSide })); outline(m); lid.add(m); }
    }
  }
  // building walls: a metal roof deck at the top of the walls (hidden in Dollhouse, like the ceiling)
  if (A.shellTop > 0 && FPall) {
    const deck = cachedCanvas('deck', () => makeCanvas(64, 64, (g, w, h) => { g.fillStyle = '#a9afb3'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 16) { g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x, 0, 5, h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 9, 0, 3, h); } }));
    const dt = new THREE.CanvasTexture(deck); dt.wrapS = dt.wrapT = THREE.RepeatWrapping; dt.anisotropy = ANISO;
    ceiling.add(new THREE.Mesh(rectsGeometry(THREE, FPall.rects, A.shellTop, true, 2, 2, 0, 0), new THREE.MeshLambertMaterial({ map: dt, color: 0xe3e6e8 })));
    // roof structure: open-web steel joists under the deck (top and bottom chords, webs as lines)
    const RS = roofStructure(plan, A);
    if (RS) {
      const chord = new THREE.MeshLambertMaterial({ color: 0x6f777c }), wp = [];
      for (const j of RS.joists) {
        const yT = A.shellTop - 0.06, yB = A.shellTop - RS.depth + 0.06;
        for (const y of [yT, yB]) { const m = new THREE.Mesh(new THREE.BoxGeometry(j.len, 0.12, 0.2), chord); m.position.set((j.x1 + j.x2) / 2, y, (j.z1 + j.z2) / 2); m.rotation.y = Math.atan2(-(j.z2 - j.z1), j.x2 - j.x1); ceiling.add(m); }
        const n = Math.max(2, Math.round(j.len / (RS.depth))), ux = (j.x2 - j.x1) / n, uz = (j.z2 - j.z1) / n;
        for (let k = 0; k < n; k++) { const top = k % 2 === 0; wp.push(j.x1 + ux * k, top ? yT : yB, j.z1 + uz * k, j.x1 + ux * (k + 1), top ? yB : yT, j.z1 + uz * (k + 1)); }
      }
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      ceiling.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x59636a })));
    }
  }
  // building columns: steel wide-flange (or concrete) from the floor to the roof structure, with a base plate
  const colTop = A.shellTop || shellHeight(plan, null);
  for (const c of plan.columns || []) {
    const sz = c.size || 0.67, ht = c.h || colTop, conc = c.kind === 'concrete', g = new THREE.Group();
    curRef = c.id ? { kind: 'column', id: c.id } : null;
    if (conc) { g.add(new THREE.Mesh(new THREE.BoxGeometry(sz, ht, sz), shellMat('concrete', sz, ht, 0))); g.children[0].position.y = ht / 2; }
    else {
      const stl = new THREE.MeshPhongMaterial({ color: 0x8a9297, specular: 0x444444, shininess: 30 }), tf = Math.max(0.04, sz * 0.07);
      for (const z of [-sz / 2 + tf / 2, sz / 2 - tf / 2]) { const f = new THREE.Mesh(new THREE.BoxGeometry(sz, ht, tf), stl); f.position.set(0, ht / 2, z); g.add(f); }
      const wb = new THREE.Mesh(new THREE.BoxGeometry(tf * 0.7, ht, sz - 2 * tf), stl); wb.position.y = ht / 2; g.add(wb);
      const bp = new THREE.Mesh(new THREE.BoxGeometry(sz + 0.5, 0.06, sz + 0.5), stl); bp.position.y = 0.03; g.add(bp);
    }
    g.position.set(c.x, 0, c.y); g.rotation.y = -(c.a || 0);
    g.traverse(o => { if (o.isMesh) { outline(o); pick.push(o); if (c.id) o.userData.ref = { kind: 'column', id: c.id }; } });
    root.add(g);
  }
  // steel beams: top and bottom flanges and the web, along the beam
  for (const b of plan.beams || []) {
    const q = beamSeat(plan, A, b), L = Math.hypot(q.x2 - q.x1, q.y2 - q.y1); if (L < 0.2) continue;
    const S = beamSize(b), d = S.d / 12, bf = S.bf / 12, tf = Math.max(0.025, S.tf / 12), tw = Math.max(0.02, S.tw / 12), y0 = q.bot;
    const stl = new THREE.MeshPhongMaterial({ color: 0x7d868b, specular: 0x444444, shininess: 30, name: 'Steel beam' }), g = new THREE.Group();
    // hung between the walls, the web and bottom flange stop at the walls' inside faces; the top flange runs on
    // over the wall tops to the outside faces, under the wall caps
    const i0 = A.PL > 0 ? q.in0 || 0 : 0, i1 = A.PL > 0 ? q.in1 || 0 : 0, Li = Math.max(0.1, L - i0 - i1), mi = (i0 - i1) / 2;
    { const f = new THREE.Mesh(new THREE.BoxGeometry(L, tf, bf), stl); f.position.y = d - tf / 2; g.add(f); }
    { const f = new THREE.Mesh(new THREE.BoxGeometry(Li, tf, bf), stl); f.position.set(mi, tf / 2, 0); g.add(f); }
    const wb = new THREE.Mesh(new THREE.BoxGeometry(Li, d - 2 * tf, tw), stl); wb.position.set(mi, d / 2, 0); g.add(wb);
    g.position.set((q.x1 + q.x2) / 2, y0, (q.y1 + q.y2) / 2); g.rotation.y = -Math.atan2(q.y2 - q.y1, q.x2 - q.x1);
    g.traverse(o => { if (o.isMesh) { outline(o); pick.push(o); if (b.id) o.userData.ref = { kind: 'beam', id: b.id }; } });
    root.add(g);
  }
  curRef = null;
  const underLines = ownGrid ? ownLines() : gridLines;
  if (underLines && underLines.length) {
    // the tees' 15/16″ faces from below, a hair under the tiles (the tiles' edge shadow sets them off)
    const tw = (15 / 16 / 12) / 2, pos = [];
    for (const q of [].concat(...underLines.map(l => splitByAreas(l, CA, H)))) {
      const L = Math.hypot(q[2] - q[0], q[3] - q[1]); if (!(L > 0.01)) continue;
      const nx = -(q[3] - q[1]) / L * tw, nz = (q[2] - q[0]) / L * tw, y = q[4] - 0.012;
      const a = [q[0] + nx, y, q[1] + nz], b = [q[2] + nx, y, q[3] + nz], c = [q[2] - nx, y, q[3] - nz], d = [q[0] - nx, y, q[1] - nz];
      pos.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ceiling.add(new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: GC, side: THREE.DoubleSide, name: GRID_NAME })));
  }
  if (plan.ceilingImage && plan.ceilingImage.dataUrl) {
    const I = plan.ceilingImage, q = (I.rot || 0) % 180 ? [I.h, I.w] : [I.w, I.h];
    const tex = IMG_TEX[I.dataUrl] || (IMG_TEX[I.dataUrl] = new THREE.TextureLoader().load(I.dataUrl));
    tex.anisotropy = ANISO;
    const im = new THREE.Mesh(new THREE.PlaneGeometry(q[0], q[1]), new THREE.MeshBasicMaterial({ map: tex, color: 0xe6e8e8, side: THREE.DoubleSide }));
    im.rotation.order = 'YXZ'; im.rotation.x = -Math.PI / 2; im.rotation.y = -(I.rot || 0) * Math.PI / 180;
    im.position.set(I.x, H - 0.006, I.y); ceiling.add(im);
  }
  const led = new THREE.MeshBasicMaterial({ color: 0xffffff, name: 'Light lens (emissive)' }), ffu = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ffuCanvas), name: 'FFU perforated face' });
  const fg = new THREE.BoxGeometry(1.9, 0.08, 3.9), fgs = {};
  const fixtures = new THREE.Group(); root.add(fixtures);
  const housingMat = new THREE.MeshPhongMaterial({ color: 0xc9ced1, specular: 0x666666, shininess: 40 });
  // the back of our LED panels and their driver boxes: silver metal (as the fan filter units' tops)
  const lightBack = new THREE.MeshPhongMaterial({ color: 0xc4c9cd, emissive: 0x0c0d0e, specular: 0xb8bec4, shininess: 70, name: 'LED panel back, silver metal' });
  // house items: cabinets, appliances, plumbing fixtures
  for (const q of A.items || []) { const g = itemMesh(THREE, q.it, M, { H: A.H, plan }); fixtures.add(g); g.traverse(o => { if (o.isMesh) { pick.push(o); if (q.it.id) o.userData.ref = { kind: 'item', id: q.it.id }; } }); }
  // electrical devices: cover plates on the wall faces (panels and monitors as boxes)
  const plateMat = new THREE.MeshPhongMaterial({ color: 0xf4f5f5, specular: 0x333333, shininess: 30 }), panelMat = new THREE.MeshPhongMaterial({ color: 0x9aa2a6, specular: 0x555555, shininess: 40 }), screenMat = new THREE.MeshPhongMaterial({ color: 0x1d2a30, emissive: 0x0b3a2c, shininess: 80 }), slotMat = new THREE.MeshBasicMaterial({ color: 0x2c3236 });
  for (const dv of plan.devices || []) {
    const D = DEVICES[dv.type]; if (!D) continue;
    const dep = D.d || 0.03, g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(dep, D.hh, D.w), dv.type === 'panel' ? panelMat : plateMat);
    body.position.x = dep / 2; g.add(body);
    if (dv.type === 'monitor') { const sc = new THREE.Mesh(new THREE.BoxGeometry(0.005, D.hh * 0.6, D.w * 0.7), screenMat); sc.position.x = dep + 0.003; g.add(sc); }
    else if (dv.type !== 'panel' && dv.type !== 'jbox') { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.004, D.hh * (dv.type === 'switch' ? 0.25 : 0.18), D.w * (dv.type === 'switch' ? 0.18 : 0.4)), slotMat); sl.position.x = dep + 0.002; if (dv.type !== 'switch') { sl.position.y = D.hh * 0.18; const s2 = sl.clone(); s2.position.y = -D.hh * 0.18; g.add(s2); } g.add(sl); }
    g.position.set(dv.x, dv.h != null ? dv.h : D.h, dv.y); g.rotation.y = -(dv.a || 0);
    // a switch knows its lights; the viewer flips them when it's clicked (its toggle moves up and down)
    if (dv.type === 'switch') { g.userData.sw = { id: dv.id, lights: Array.isArray(dv.lights) ? dv.lights : [], off: !!dv.off }; g.children[g.children.length - 1].userData.toggle = true; }
    g.traverse(o => { if (o.isMesh) { pick.push(o); if (dv.id) o.userData.ref = { kind: 'device', id: dv.id }; } });
    fixtures.add(g);
  }
  // A real fan filter unit model (plan.ffuModel: manufacturer sizes from a Revit family): the cabinet and blower
  // housing sit above the grid (seen in Dollhouse, where the ceiling is hidden); the perforated face shows from below.
  const FM = plan.ffuModel && Array.isArray(plan.ffuModel.sizes) && plan.ffuModel.sizes.length ? plan.ffuModel : null;
  const ffuParts = {};
  const fin = FM ? ({ sst: M.steel, alum: new THREE.MeshPhongMaterial({ color: 0xc8ced2, specular: 0x8a8f93, shininess: 60 }) }[FM.finish] || new THREE.MeshPhongMaterial({ color: 0xf1f3f3, emissive: 0x101111, specular: 0x222222, shininess: 18 })) : null;
  const dark = FM ? new THREE.MeshPhongMaterial({ color: 0x3a3f42, specular: 0x222222, shininess: 10, name: 'FFU fan and electrical box' }) : null;
  if (fin && !fin.name) fin.name = 'FFU housing';
  const galv = FM ? new THREE.MeshPhongMaterial({ color: 0xaeb4b8, specular: 0x777777, shininess: 45, name: 'FFU galvanized steel' }) : null;
  // the cabinet, blower housing and power box above the grid: silver metal (the room side keeps the chosen finish)
  const shell = FM ? (FM.finish === 'sst' ? M.steel : new THREE.MeshPhongMaterial({ color: 0xc4c9cd, emissive: 0x0c0d0e, specular: 0xb8bec4, shininess: 70, name: 'FFU housing, silver metal' })) : null;
  function ffuUnit(sz) {
    const key = [sz.w, sz.d, sz.h, sz.overall, sz.hw, sz.hd, sz.ebox].map(v => v.toFixed(3)).join(',');
    if (ffuParts[key]) return ffuParts[key].clone();
    const g = new THREE.Group(), e = 1.25 / 12, add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    // perforated face, a hair below the ceiling, inside a white knife-edge frame
    add(new THREE.BoxGeometry(sz.d - 2 * e, 0.012, sz.w - 2 * e), ffu, 0, -0.03, 0);
    add(new THREE.BoxGeometry(sz.d, 0.05, e), fin, 0, -0.02, sz.w / 2 - e / 2); add(new THREE.BoxGeometry(sz.d, 0.05, e), fin, 0, -0.02, -sz.w / 2 + e / 2);
    add(new THREE.BoxGeometry(e, 0.05, sz.w - 2 * e), fin, sz.d / 2 - e / 2, -0.02, 0); add(new THREE.BoxGeometry(e, 0.05, sz.w - 2 * e), fin, -sz.d / 2 + e / 2, -0.02, 0);
    // cabinet above the grid
    const cab = add(new THREE.BoxGeometry(sz.d - 0.03, sz.h, sz.w - 0.03), shell, 0, sz.h / 2, 0); outline(cab);
    // blower housing toward one end of the cabinet, with the electrical box against its side toward the other end
    // (as the maker's drawing shows it); the two together sit centred along the unit
    const hh = Math.max(0.05, sz.overall - sz.h), HD = Math.min(sz.hd, sz.d - 0.1), HW = Math.min(sz.hw, sz.w - 0.1);
    const EL = Math.min(Math.max(sz.ebox || 0, 4 / 12), Math.max(0.2, sz.w - HW - 0.3)), EW = Math.min(sz.d * 0.6, HD), EH = hh * 0.65;
    const hz = (HW + EL) / 2 - HW / 2, ez = hz - HW / 2 - EL / 2;
    const hs = add(new THREE.BoxGeometry(HD, hh, HW), shell, 0, sz.h + hh / 2, hz); outline(hs);
    // inlet ring and round pre-filter on the housing
    const r = Math.min(sz.hw, sz.hd) * 0.36;
    add(new THREE.CylinderGeometry(r, r, 0.06, 32), galv, 0, sz.overall + 0.03, hz);
    add(new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.065, 32), dark, 0, sz.overall + 0.035, hz);
    // electrical box: lower and narrower than the housing, its end face with the on/off switch and speed control
    const eb = add(new THREE.BoxGeometry(EW, EH, EL), shell, 0, sz.h + EH / 2, ez); outline(eb);
    const fz = ez - EL / 2 - 0.006;
    add(new THREE.BoxGeometry(0.07, 0.1, 0.014), dark, -EW * 0.2, sz.h + EH * 0.5, fz);                   // rocker switch
    const kn = add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), galv, EW * 0.2, sz.h + EH * 0.5, fz - 0.004); kn.rotation.x = Math.PI / 2; // speed control
    ffuParts[key] = g;
    return g.clone();
  }
  const ffuSize = (f) => {
    const long = Math.max(f.w || 2, f.h || 4), nominal = '2x' + Math.max(2, Math.min(4, Math.round(long)));
    return FM.sizes.find(s => s.nominal === nominal) || FM.sizes.slice().sort((a, b) => Math.abs(a.w - long) - Math.abs(b.w - long))[0];
  };
  // the tees framing fixtures that sit off the grid lines or turned across it (seen from below); the grid's own
  // lines come with the tiles
  const FXL = ceilingFixtures(plan, A);
  try {
    const teeMat = new THREE.MeshBasicMaterial({ color: GC, side: THREE.DoubleSide, name: GRID_NAME }), tw = 15 / 16 / 12;
    for (const [x1, z1, x2, z2] of fixtureFrames(plan, A).lines) {
      const L = Math.hypot(x2 - x1, z2 - z1), hc = ceilingAt(CA, H, (x1 + x2) / 2, (z1 + z2) / 2), t = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x2 - x1) > 0.01 ? L + tw : tw, Math.abs(z2 - z1) > 0.01 ? L + tw : tw), teeMat);
      t.rotation.x = Math.PI / 2; t.position.set((x1 + x2) / 2, hc - 0.007, (z1 + z2) / 2); fixtures.add(t);
    }
  } catch (e) { /* drawn without the frames */ }
  for (const f of FXL) {
    if (FM && f.type === 'ffu') {
      const u = ffuUnit(ffuSize(f)); u.position.set(f.x, ceilingAt(CA, H, f.x, f.y), f.y);
      if ((f.w || 2) > (f.h || 4)) u.rotation.y = Math.PI / 2; // long side across the room
      if (f.id) u.traverse(o => { o.userData.ref = { kind: 'fixture', id: f.id }; });
      fixtures.add(u);
      continue;
    }
    let geo = fg;
    // drawn at its nominal size (a 23.6″ × 47.6″ FFU fills its 2′ × 4′ cell, its edges on the tees), so no
    // strip of tile edge shows round it and reads as a doubled tee
    const nomv = (v) => (Math.abs(v - Math.round(v)) < 0.2 ? Math.round(v) : v), nw = f.w > 0 ? nomv(f.w) : 0, nh = f.h > 0 ? nomv(f.h) : 0;
    if (nw > 0 && nh > 0 && !(Math.abs(nw - 2) < 0.06 && Math.abs(nh - 4) < 0.06)) { const key = nw.toFixed(2) + 'x' + nh.toFixed(2); geo = fgs[key] || (fgs[key] = new THREE.BoxGeometry(Math.max(0.3, nw - 0.1), 0.08, Math.max(0.3, nh - 0.1))); }
    const fh = ceilingAt(CA, H, f.x, f.y), m = new THREE.Mesh(geo, f.type === 'ffu' ? ffu : led); m.position.set(f.x, fh - 0.04, f.y);
    if (f.id) m.userData.ref = { kind: 'fixture', id: f.id };
    if (f.type !== 'ffu') m.userData.light = lightKey(f);
    fixtures.add(m);
    // an emergency light: the battery's charge indicator and test button, a small red-and-green pod on the lens
    if (f.type !== 'ffu' && f.em) {
      const along = (nw || 2) >= (nh || 4), ex = along ? (nw || 2) / 2 - 0.35 : 0, ez = along ? 0 : (nh || 4) / 2 - 0.35;
      const pod = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.28 : 0.16, 0.05, along ? 0.16 : 0.28), M.emPod || (M.emPod = new THREE.MeshBasicMaterial({ color: 0xd33b2c, name: 'Emergency light test button' })));
      pod.position.set(f.x + ex, fh - 0.1, f.y + ez); if (f.id) pod.userData.ref = m.userData.ref; fixtures.add(pod);
      const dot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.06), M.emDot || (M.emDot = new THREE.MeshBasicMaterial({ color: 0x35d06e, name: 'Emergency light charge indicator' })));
      dot.position.set(f.x + ex + (along ? -0.2 : 0), fh - 0.115, f.y + ez + (along ? 0 : -0.2)); fixtures.add(dot);
    }
    // a light model picked in the Plan panel (plan.lightModel): its door frame round the lens, in its finish;
    // a troffer's lens sits up inside the frame
    const LMo = f.type !== 'ffu' && plan.lightModel ? plan.lightModel : null;
    if (LMo) {
      const lw = Math.max(0.3, (nw || 2) - 0.1), ld = Math.max(0.3, (nh || 4) - 0.1), fm = LMo.finish === 'sst' ? M.steel : M.fx;
      const band = LMo.style === 'rss' ? 2.5 / 12 : LMo.style === 'troffer' ? 1.75 / 12 : LMo.style === 'blp' ? 0.5 / 12 : 0.75 / 12, dep = LMo.style === 'rss' ? 0.09 : LMo.style === 'troffer' ? 0.06 : 0.035;
      const ring = [[0, -ld / 2 + band / 2, lw, band], [0, ld / 2 - band / 2, lw, band], [-lw / 2 + band / 2, 0, band, ld - 2 * band], [lw / 2 - band / 2, 0, band, ld - 2 * band]];
      for (const [ox, oz, bw, bd] of ring) { const r = new THREE.Mesh(new THREE.BoxGeometry(bw, dep, bd), fm); r.position.set(f.x + ox, fh - dep / 2 - 0.004, f.y + oz); if (f.id) r.userData.ref = m.userData.ref; outline(r); fixtures.add(r); }
      m.scale.set((lw - 2 * band) / lw, 1, (ld - 2 * band) / ld);
      if (LMo.style === 'troffer' || LMo.style === 'rss') m.position.y = fh + 0.02;
    }
    // its housing above the grid (seen in the Plenum view)
    const fw = Math.max(0.3, (nw || 2) - 0.08), fd = Math.max(0.3, (nh || 4) - 0.08), hh = f.type === 'ffu' ? 0.9 : LMo ? Math.max(0.1, LMo.hh) : LIGHT_HH;
    const hs = new THREE.Mesh(new THREE.BoxGeometry(fw, hh, fd), f.type === 'ffu' ? M.fx : LMo && LMo.finish === 'sst' ? M.steel : LMo ? housingMat : lightBack); hs.position.set(f.x, fh + 0.005 + hh / 2, f.y); outline(hs); fixtures.add(hs);
    // the driver box on its back, along one short end (a picked light model's own, else our panels' driver)
    if (f.type !== 'ffu' && (!LMo || LMo.box)) { const B = LMo ? LMo.box : LIGHT_BOX, alongX = (nw || 2) >= (nh || 4), bx = new THREE.Mesh(new THREE.BoxGeometry(alongX ? B.w : B.l, B.h, alongX ? B.l : B.w), LMo ? housingMat : lightBack); bx.position.set(f.x + (alongX ? fw / 2 - B.w / 2 - 0.08 : 0), fh + 0.005 + hh + B.h / 2, f.y + (alongX ? 0 : fd / 2 - B.w / 2 - 0.08)); outline(bx); fixtures.add(bx); }
  }
  // the fixture whips: flexible steel-armoured cable from box to box over the ceiling, a connector at each end and at
  // each joint where a 12′ extension carries the run on
  if (Array.isArray(plan.whips) && plan.whips.length) {
    try {
      const OB = [], PT = new Map(whipPorts(plan, A, OB).map(p => [p.id, p])), RAD = 0.036;
      // the highest box under a point (within the cable's radius), so the cable rides over everything
      const floorAt = (x, z) => { let h = -1e9; for (const o of OB) if (x > o[0] - RAD && x < o[2] + RAD && z > o[1] - RAD && z < o[3] + RAD && o[4] > h) h = o[4]; return h; };
      // the armour: a spiral-wound steel strip, its ridges in a striped texture (bump too), shiny
      const armour = cachedCanvas('whipArmour', () => makeCanvas(64, 32, (g, W, Hh) => {
        const gr = g.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, '#8e959a'); gr.addColorStop(0.5, '#e9edef'); gr.addColorStop(1, '#8e959a');
        g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
        for (let k = -2; k < 6; k++) { g.save(); g.translate(k * 16, 0); g.fillStyle = 'rgba(40,46,50,.55)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(5, 0); g.lineTo(5 + 16, Hh); g.lineTo(16, Hh); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.moveTo(6, 0); g.lineTo(8, 0); g.lineTo(24, Hh); g.lineTo(22, Hh); g.closePath(); g.fill(); g.restore(); }
      }));
      const plug = M.whipPlug || (M.whipPlug = new THREE.MeshPhongMaterial({ color: 0xb7bcc0, specular: 0xbbbbbb, shininess: 70, name: 'OnePass connector, die-cast' }));
      const tag = M.whipTag || (M.whipTag = new THREE.MeshLambertMaterial({ color: 0xf1d43a, name: 'OnePass connector label' }));
      const blk = M.whipBlk || (M.whipBlk = new THREE.MeshLambertMaterial({ color: 0x2b2e31, name: 'OnePass connector face' }));
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      // a OnePass connector: a flat die-cast body on the cable end, the contact face out front (yellow label on the
      // fixture end), seated on its box
      const connector = (p, dir, yellow) => {
        const g = new THREE.Group(); g.position.copy(p); if (Math.abs(dir.y) > 0.99) g.rotation.set(dir.y < 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0); else g.lookAt(p.clone().add(dir));
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.17), yellow ? tag : plug); body.position.z = -0.085; g.add(body);
        const neck = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.07), plug); neck.position.z = -0.2; g.add(neck);
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.012), blk); face.position.z = 0.002; g.add(face);
        fixtures.add(g);
      };
      for (const w of plan.whips) {
        const a = PT.get(w.a), b = PT.get(w.b); if (!a || !b) continue;
        const A3 = new THREE.Vector3(a.x, a.y, a.z), B3 = new THREE.Vector3(b.x, b.y, b.z), dx = b.x - a.x, dz = b.z - a.z, D = Math.hypot(dx, dz) || 1;
        const ux = dx / D, uz = dz / D, nx = -uz, nz = ux, rest = Math.max(a.y, b.y) + 0.06;
        // a loose coil of flexible cable: out of the box, a lazy bow to one side and back, lying over the units
        const R = WHIP.len + WHIP.ext * (w.ext || 0), spare = Math.max(0, R - D), bow = Math.min(1.6, 0.25 + spare * 0.12) * (rnd() < 0.5 ? -1 : 1);
        // straight up off the top of each box, then a lazy bow over to the next
        const pts = [A3.clone(), new THREE.Vector3(a.x, a.y + 0.22, a.z), new THREE.Vector3(a.x + ux * 0.3, a.y + 0.32, a.z + uz * 0.3)];
        const n = Math.max(2, Math.round(D / 2.5));
        for (let k = 1; k < n; k++) { const t = k / n, side = Math.sin(t * Math.PI) * bow + (rnd() - 0.5) * 0.35; pts.push(new THREE.Vector3(a.x + dx * t + nx * side, 0, a.z + dz * t + nz * side)); }
        pts.push(new THREE.Vector3(b.x - ux * 0.3, b.y + 0.32, b.z - uz * 0.3), new THREE.Vector3(b.x, b.y + 0.22, b.z), B3.clone());
        // it lies on whatever is under it: dense points along the bow, each set on the boxes below (never into them)
        const rough = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5), Lr = rough.getLength(), m = Math.max(12, Math.round(Lr / 0.25)), dense = [];
        for (let k = 0; k <= m; k++) {
          const p = rough.getPointAt(k / m), end = Math.min(k, m - k) * Lr / m;
          if (end < 0.3) { dense.push(p); continue; }   // the rise off each box stays as drawn
          let y = Math.max(rest, floorAt(p.x, p.z)) + RAD + 0.03;
          for (const dd of [-0.25, 0.25]) { const q = rough.getPointAt(Math.max(0, Math.min(1, k / m + dd / Lr))); y = Math.max(y, floorAt(q.x, q.z) + RAD + 0.03 - 0.12); }
          dense.push(new THREE.Vector3(p.x, y, p.z));
        }
        const curve = new THREE.CatmullRomCurve3(dense, false, 'centripetal', 0.5), L = curve.getLength();
        const tx = new THREE.CanvasTexture(armour); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(L * 22, 1); tx.anisotropy = ANISO;
        const mat = new THREE.MeshPhongMaterial({ map: tx, bumpMap: tx, bumpScale: 0.02, color: 0xffffff, specular: 0xffffff, shininess: 80, name: 'Fixture whip, flexible steel armour (OnePass)' });
        fixtures.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, Math.round(L * 10)), 0.036, 10, false), mat));
        // connectors at the two boxes (the fixture end yellow-labelled) and at each 12′ extension's joint
        // the plugs seated on top of the boxes, cable up out of them
        connector(A3, new THREE.Vector3(0, -1, 0), false); connector(B3, new THREE.Vector3(0, -1, 0), true);
        for (let k = 0, d = WHIP.len; k < (w.ext || 0); k++, d += WHIP.ext) { const t = d / R, p = curve.getPointAt(t), tg = curve.getTangentAt(t); connector(p.clone().addScaledVector(tg, 0.13), tg, true); connector(p.clone().addScaledVector(tg, 0.13), tg.clone().negate(), false); }
      }
    } catch (e) { console.error(e); }
  }
  // the extras never stop the model from showing
  try { root.add(airflowArrows(THREE, plan, A)); } catch (e) { console.error(e); }
  return { root, pick, floor, floors: [floor], ground, ceiling, lid, roof, ceilPlane: ceil || new THREE.Object3D(), fixtures, doors, doorObs, removable };
}

/* Our LED flat panels (2×2 and 2×4) when no light model is picked: 1.38″ thick, with the driver box on the back
   near one end (about 5½″ × 4½″ × 1½″). */
const LIGHT_HH = 1.38 / 12, LIGHT_BOX = { l: 5.54 / 12, w: 4.5 / 12, h: 1.5 / 12 };

/* Fixture whips: the lights and fan filter units are wired in a daisy chain, box to box, with modular wiring
   whips (Acuity RELOC OnePass OC1, 1-port, flexible steel armour): a 9′ whip from each fixture's power / driver box
   to the next one's, plus 12′ extension whips where the run is longer than 9′. plan.whips = [{ id, a, b, ext }]
   (a, b: fixture ids; ext: 12′ extensions in the run). */
const WHIP = { len: 9, ext: 12, slack: 1 };
// each fixture's wiring port, on top of its box (an FFU's power box, a light's driver box), feet, world; and the
// boxes the cables have to ride over (obs: [x0, z0, x1, z1, top])
function whipPorts(plan, A, obs) {
  A = A || analyze(plan);
  const FX = ceilingFixtures(plan, A), CA = ceilAreas(plan, A), H = A.H, FM = plan.ffuModel && plan.ffuModel.sizes && plan.ffuModel.sizes.length ? plan.ffuModel : null, out = [];
  const box = (cx, cz, sx, sz, top) => { if (obs) obs.push([cx - sx / 2, cz - sz / 2, cx + sx / 2, cz + sz / 2, top]); };
  FX.forEach((f, i) => {
    const base = ceilingAt(CA, H, f.x, f.y), id = f.id || 'fx' + i;
    if (f.type === 'ffu') {
      if (!FM) { box(f.x, f.y, f.w || 2, f.h || 4, base + 0.95); out.push({ id, f, x: f.x, z: f.y, y: base + 0.9 }); return; }
      const long = Math.max(f.w || 2, f.h || 4), nominal = '2x' + Math.max(2, Math.min(4, Math.round(long)));
      const sz = FM.sizes.find(q => q.nominal === nominal) || FM.sizes.slice().sort((a, b) => Math.abs(a.w - long) - Math.abs(b.w - long))[0];
      const hh = Math.max(0.05, sz.overall - sz.h), HD = Math.min(sz.hd, sz.d - 0.1), HW = Math.min(sz.hw, sz.w - 0.1), EL = Math.min(Math.max(sz.ebox || 0, 4 / 12), Math.max(0.2, sz.w - HW - 0.3)), EW = Math.min(sz.d * 0.6, HD), EH = hh * 0.65;
      const hz = (HW + EL) / 2 - HW / 2, ez = hz - HW / 2 - EL / 2, turned = (f.w || 2) > (f.h || 4);
      // local (x across, z along) → world
      const W = (lx, lz, sx, szz, top) => box(f.x + (turned ? lz : lx), f.y + (turned ? -lx : lz), turned ? szz : sx, turned ? sx : szz, top);
      W(0, 0, sz.d, sz.w, base + sz.h); W(0, hz, HD, HW, base + sz.overall + 0.07); W(0, ez, EW, EL, base + sz.h + EH);
      out.push({ id, f, x: f.x + (turned ? ez : 0), z: f.y + (turned ? 0 : ez), y: base + sz.h + EH });
      return;
    }
    const LMo = plan.lightModel || null, B = LMo ? LMo.box : LIGHT_BOX, nomv = (v) => (Math.abs(v - Math.round(v)) < 0.2 ? Math.round(v) : v);
    const nw = f.w > 0 ? nomv(f.w) : 2, nh = f.h > 0 ? nomv(f.h) : 4, fw = Math.max(0.3, nw - 0.08), fd = Math.max(0.3, nh - 0.08), lh = LMo ? Math.max(0.1, LMo.hh) : LIGHT_HH;
    box(f.x, f.y, fw, fd, base + 0.005 + lh);
    if (!B) { out.push({ id, f, x: f.x, z: f.y, y: base + 0.005 + lh }); return; }
    const alongX = nw >= nh, bx = f.x + (alongX ? fw / 2 - B.w / 2 - 0.08 : 0), bz = f.y + (alongX ? 0 : fd / 2 - B.w / 2 - 0.08);
    box(bx, bz, alongX ? B.w : B.l, alongX ? B.l : B.w, base + 0.005 + lh + B.h);
    out.push({ id, f, x: bx, z: bz, y: base + 0.005 + lh + B.h });
  });
  return out;
}
// the run between two ports: along and across the grid (cables run square to it), plus slack at the ends
const whipRun = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.z - q.z) + Math.abs(p.y - q.y) + WHIP.slack;
const whipExt = (L) => (L <= WHIP.len ? 0 : Math.ceil((L - WHIP.len) / WHIP.ext - 1e-9));
/* The whips as simple runs for the drawings and the IFC: up off each box, along then across over whatever is in
   between, down into the next box. [{ w, pts: [[x, y, z], ...], len }] */
function whipLines(plan, A) {
  A = A || analyze(plan);
  if (!Array.isArray(plan.whips) || !plan.whips.length) return [];
  const OB = [], PT = new Map(whipPorts(plan, A, OB).map(p => [p.id, p]));
  const topOver = (x0, z0, x1, z1) => { let h = -1e9; const a = Math.min(x0, x1) - 0.05, b = Math.max(x0, x1) + 0.05, c = Math.min(z0, z1) - 0.05, d = Math.max(z0, z1) + 0.05; for (const o of OB) if (o[2] > a && o[0] < b && o[3] > c && o[1] < d && o[4] > h) h = o[4]; return h; };
  const out = [];
  for (const w of plan.whips) {
    const a = PT.get(w.a), b = PT.get(w.b); if (!a || !b) continue;
    const y = Math.max(a.y, b.y, topOver(a.x, a.z, b.x, a.z), topOver(b.x, a.z, b.x, b.z)) + 0.1;
    const pts = [[a.x, a.y, a.z], [a.x, y, a.z], [b.x, y, a.z], [b.x, y, b.z], [b.x, b.y, b.z]].filter((q, i, A2) => i === 0 || Math.hypot(q[0] - A2[i - 1][0], q[1] - A2[i - 1][1], q[2] - A2[i - 1][2]) > 0.02);
    out.push({ w, pts, len: WHIP.len + WHIP.ext * (w.ext || 0) });
  }
  return out;
}
/* Wire them: in each room (walls up to the lid split the plenum), a chain from the fixture nearest the room's corner
   to the nearest one not yet wired, and on, never through a wall. Returns the whips. */
function wireFixtures(plan, A) {
  A = A || analyze(plan);
  // the walls and the doorways in them (the panels over a door close the plenum there too)
  const P = whipPorts(plan, A), walls = (A.pieces || []).filter(p => p.hard).concat((A.opInfo || []).map(i => ({ x1: i.o.x1, z1: i.o.y1, x2: i.o.x2, z2: i.o.y2 })));
  const cross = (a, b) => walls.some(w => {
    const d1x = b.x - a.x, d1z = b.z - a.z, d2x = w.x2 - w.x1, d2z = w.z2 - w.z1, den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-9) return false;
    const s1 = ((w.x1 - a.x) * d2z - (w.z1 - a.z) * d2x) / den, s2 = ((w.x1 - a.x) * d1z - (w.z1 - a.z) * d1x) / den;
    return s1 > 0 && s1 < 1 && s2 > -0.02 && s2 < 1.02;
  });
  // rooms: fixtures that can reach each other without crossing a wall (straight or with one bend)
  const reach = (a, b) => !cross(a, b) || !cross(a, { x: b.x, z: a.z }) && !cross({ x: b.x, z: a.z }, b) || !cross(a, { x: a.x, z: b.z }) && !cross({ x: a.x, z: b.z }, b);
  const room = new Array(P.length).fill(-1); let nr = 0;
  for (let i = 0; i < P.length; i++) { if (room[i] >= 0) continue; room[i] = nr; const st = [i]; while (st.length) { const k = st.pop(); for (let j = 0; j < P.length; j++) if (room[j] < 0 && Math.hypot(P[j].x - P[k].x, P[j].z - P[k].z) < 30 && reach(P[k], P[j])) { room[j] = nr; st.push(j); } } nr++; }
  const out = [];
  for (let r = 0; r < nr; r++) {
    const idx = P.map((p, i) => i).filter(i => room[i] === r); if (idx.length < 2) continue;
    let cur = idx.reduce((m, i) => (P[i].x + P[i].z < P[m].x + P[m].z ? i : m), idx[0]); const left = new Set(idx); left.delete(cur);
    while (left.size) {
      let best = null, bd = 1e9; for (const j of left) { const d = whipRun(P[cur], P[j]) + (reach(P[cur], P[j]) ? 0 : 1e4); if (d < bd) { bd = d; best = j; } }
      const L = whipRun(P[cur], P[best]); out.push({ id: 'wh' + out.length.toString(36) + Math.random().toString(36).slice(2, 6), a: P[cur].id, b: P[best].id, ext: whipExt(L) });
      left.delete(best); cur = best;
    }
  }
  return out;
}

/* Analysis of a plan with every placed building in it, merged (for walking, collisions and the mini map). */
function analyzeAll(plan) {
  const Z = zones(plan);
  if (Z.length === 1) { const A = analyze(plan); A.zones = [{ zone: Z[0], A }]; return A; }
  const parts = Z.map(z => ({ zone: z, A: analyze(z.plan) })), live = parts.filter(q => !q.A.empty);
  const M = { H: Math.max(6, ...live.map(q => q.A.H)), PL: Math.max(0, ...live.map(q => q.A.PL || 0)), WH: Math.max(6, ...live.map(q => q.A.WH || q.A.H)), hardAny: live.some(q => q.A.hardAny), shellTop: Math.max(0, ...live.map(q => q.A.shellTop)), zones: parts, empty: !live.length };
  for (const k of ['walls', 'pieces', 'ends', 'corners', 'opInfo', 'boxes', 'obs']) M[k] = [].concat(...live.map(q => q.A[k]));
  if (M.empty) { M.bounds = parts[0].A.bounds; return M; }
  const b = { minX: Math.min(...live.map(q => q.A.bounds.minX)), minZ: Math.min(...live.map(q => q.A.bounds.minZ)), maxX: Math.max(...live.map(q => q.A.bounds.maxX)), maxZ: Math.max(...live.map(q => q.A.bounds.maxZ)) };
  M.bounds = Object.assign(b, { cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2, w: b.maxX - b.minX, d: b.maxZ - b.minZ });
  return M;
}
/* The 3D scene for a plan and every building placed in it. Each building is built as its own scene (its own
   ceiling height, floor, fixtures) and they're put together; placed buildings sit a hair above the main floor. */
function buildAll(THREE, plan, M) {
  M = M || analyzeAll(plan);
  if (M.zones.length === 1) return buildScene(THREE, plan, M.zones[0].A);
  const root = new THREE.Group(), ceiling = new THREE.Group(), lid = new THREE.Group(), roof = new THREE.Group(), out = { root, pick: [], floors: [], ground: null, ceiling, lid, roof, ceilPlane: new THREE.Object3D(), fixtures: new THREE.Group(), doors: [], doorObs: [], removable: [] };
  root.add(ceiling); root.add(lid); root.add(roof); root.add(out.fixtures);
  let n = 0;
  for (const q of M.zones) {
    if (q.A.empty) continue;
    const b = buildScene(THREE, q.zone.plan, q.A), lift = n++ * 0.03;
    b.root.position.y = lift;
    if (out.ground) b.root.remove(b.ground); else { out.ground = b.ground; b.ground.position.y -= lift; }
    ceiling.add(b.ceiling); b.ceiling.position.y = lift; lid.add(b.lid); b.lid.position.y = lift; roof.add(b.roof); b.roof.position.y = lift;
    root.add(b.root);
    out.pick.push(...b.pick); out.floors.push(b.floor); out.doors.push(...b.doors); out.doorObs.push(...b.doorObs); out.removable.push(...(b.removable || []));
  }
  out.floor = out.floors[0];
  if (!out.ground) out.ground = new THREE.Object3D();
  return out;
}

/* A house with several floors: each floor built on its own and stacked at its elevation (the ground and the
   foundation from the first floor). */
function buildStack(THREE, plan, M) {
  const LP = levelPlans(plan);
  if (LP.length < 2) return buildAll(THREE, plan, M);
  const root = new THREE.Group(), ceiling = new THREE.Group(), lid = new THREE.Group(), roof = new THREE.Group(), out = { root, pick: [], floors: [], ground: null, ceiling, lid, roof, ceilPlane: new THREE.Object3D(), fixtures: new THREE.Group(), doors: [], doorObs: [], removable: [], levelObjs: [] };
  root.add(ceiling); root.add(lid); root.add(roof); root.add(out.fixtures);
  for (const L of LP) {
    const b = buildAll(THREE, L.plan);
    b.root.position.y = L.elev;
    if (!L.grade || !b.ground) { if (b.ground && b.ground.parent) b.ground.parent.remove(b.ground); } else out.ground = b.ground;
    for (const [grp, src] of [[ceiling, b.ceiling], [lid, b.lid], [roof, b.roof]]) if (src) { grp.add(src); src.position.y = L.elev; }
    root.add(b.root);
    out.pick.push(...b.pick); out.floors.push(b.floor); out.doors.push(...b.doors); out.doorObs.push(...b.doorObs); out.removable.push(...(b.removable || []));
    out.levelObjs.push({ k: L.k, objs: [b.root, b.ceiling, b.lid, b.roof].filter(Boolean) });
  }
  out.floor = out.floors[0];
  if (!out.ground) out.ground = new THREE.Object3D();
  return out;
}
/* Airflow in 3D: clean air pushed straight down out of each fan filter unit (blue), and room air drawn into
   each air chase's return grille (purple). They go in a group marked userData.airflow so the viewer can show
   and hide them. */
function airflowArrows(THREE, plan, A) {
  const g = new THREE.Group(); g.userData.airflow = true;
  if (A.empty) return g;
  const supply = new THREE.MeshBasicMaterial({ color: 0x4fb8e8, transparent: true, opacity: 0.6, depthWrite: false });
  const ret = new THREE.MeshBasicMaterial({ color: 0xa48be8, transparent: true, opacity: 0.7, depthWrite: false });
  const shaftG = new THREE.CylinderGeometry(1, 1, 1, 10), headG = new THREE.ConeGeometry(1, 1, 14), up = new THREE.Vector3(0, 1, 0);
  const arrow = (x, y, z, dir, len, r, m) => {
    const a = new THREE.Group(), hl = Math.min(len * 0.4, r * 5), sl = len - hl;
    const sh = new THREE.Mesh(shaftG, m); sh.scale.set(r, sl, r); sh.position.y = sl / 2; a.add(sh);
    const hd = new THREE.Mesh(headG, m); hd.scale.set(r * 2.6, hl, r * 2.6); hd.position.y = sl + hl / 2; a.add(hd);
    a.position.set(x, y, z); a.quaternion.setFromUnitVectors(up, new THREE.Vector3(...dir).normalize());
    a.traverse(o => { o.renderOrder = 3; }); g.add(a);
  };
  const H = A.H, CA = ceilAreas(plan, A);
  // down out of each FFU face: one arrow per 2′ of its long side
  for (const f of ceilingFixtures(plan, A)) {
    if (f.type !== 'ffu') continue;
    const w = f.w || 2, h = f.h || 4, n = Math.max(1, Math.round(Math.max(w, h) / 2)), alongZ = h >= w, len = Math.min(3.2, H * 0.4);
    for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 1.6; arrow(f.x + (alongZ ? 0 : o), ceilingAt(CA, H, f.x, f.y) - 0.3, f.y + (alongZ ? o : 0), [0, -1, 0], len, 0.13, supply); }
  }
  // into each return grille in a wall panel, from the side it faces (both sides when it's a transfer grille)
  for (const gr of plan.grilles || []) {
    const w = +gr.w || 20 / 12, h = +gr.h || 20 / 12, sill = gr.sill == null ? 0.5 : +gr.sill, a = gr.a || 0, c = Math.cos(a), sn = Math.sin(a), nx = -sn, nz = c, y = sill + h / 2;
    const n = Math.max(1, Math.round(w / 1.5)), len = 2, t = (gr.t || 0.25) / 2;
    for (const sd of gr.side === 0 ? [1, -1] : [gr.side || 1]) for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * Math.min(1.5, w / n);
      // air out of the grille (a plenum grille feeding the plenum from the wall) starts at the face and points away;
      // a return grille draws air in from the room
      if (gr.flow === 'out' || (gr.flow == null && gr.plenum)) arrow(gr.x + c * o + nx * sd * (t + 0.05), y, gr.y + sn * o + nz * sd * (t + 0.05), [nx * sd, 0, nz * sd], len, 0.11, ret);
      else arrow(gr.x + c * o + nx * sd * (t + len + 0.05), y, gr.y + sn * o + nz * sd * (t + len + 0.05), [-nx * sd, 0, -nz * sd], len, 0.11, ret);
    }
  }
  // into each return grille, low on the chase face
  for (const b of A.boxes) {
    const D = { N: [0, 1], S: [0, -1], W: [1, 0], E: [-1, 0] }[b.grille]; if (!D) continue;
    const across = (b.grille === 'N' || b.grille === 'S'), G = grilleSize(b.c, across ? b.x1 - b.x0 : b.z1 - b.z0, H), y = G.sill + G.h / 2;
    const fx = b.grille === 'W' ? b.x0 : b.grille === 'E' ? b.x1 : 0, fz = b.grille === 'N' ? b.z0 : b.grille === 'S' ? b.z1 : 0;
    const n = Math.max(1, Math.round(G.w / 1.5));
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * Math.min(1.5, G.w / n), len = 2;
      if (across) arrow((b.x0 + b.x1) / 2 + o, y, fz - D[1] * (len + 0.05), [0, 0, D[1]], len, 0.11, ret);
      else arrow(fx - D[0] * (len + 0.05), y, (b.z0 + b.z1) / 2 + o, [D[0], 0, 0], len, 0.11, ret);
    }
  }
  return g;
}
/* Airflow on the floor: how the air leaves each room through its doors, room to room, and out of the building.
   The plan is cut into spaces by every wall, door and chase (rooms, the warehouse around the cleanroom, the
   outdoors). Through each door the air goes from the higher room pressure to the lower when both sides have one
   set; otherwise it goes from the space further inside to the one nearer the outdoors, as a positive-pressure
   cleanroom does. In each space a path runs along the floor from where the air starts (the room label, or the
   door it came in by) to each door it leaves by, then on through that door; moving chevrons show the way.
   One group, marked userData.airflow, so the Airflow button shows and hides it with the other arrows. */
/* People and material flow (plan.flows = { people: [room id | 'out' …], material: […] }): a path on the floor
   from room to room in that order, through the door between each pair (straight across when there's none),
   with its stops (the rooms) for the guided tour. */
function flowRoutes(plan) {
  const F = plan.flows || {}; if (!((F.people || []).length > 1 || (F.material || []).length > 1)) return null;
  let C; try { C = cleanroomCheck(plan); } catch (e) { return null; }
  const R = new Map((plan.rooms || []).map(r => [r.id, r]));
  const path = (list) => {
    const ids = (list || []).filter(k => k === 'out' || R.has(k)); if (ids.length < 2) return null;
    const pts = [], miss = [], stops = [];
    for (let i = 0; i < ids.length; i++) {
      const cur = ids[i] === 'out' ? null : R.get(ids[i]);
      if (i === 0 && cur) { pts.push([cur.x, cur.y]); stops.push({ room: cur, at: 0 }); }
      if (i + 1 >= ids.length) break;
      const nxt = ids[i + 1] === 'out' ? null : R.get(ids[i + 1]);
      const d = C.doors.find(q => (q.a === cur && q.b === nxt) || (q.a === nxt && q.b === cur));
      if (d) {
        const sg = d.a === cur ? 1 : -1, off = 1.8;
        if (i === 0 && !cur) pts.push([d.mx + d.nx * 6 * sg, d.my + d.ny * 6 * sg]);
        pts.push([d.mx + d.nx * off * sg, d.my + d.ny * off * sg], [d.mx, d.my], [d.mx - d.nx * off * sg, d.my - d.ny * off * sg]);
        if (!nxt) pts.push([d.mx - d.nx * 6 * sg, d.my - d.ny * 6 * sg]);
      } else miss.push([cur, nxt]);
      if (nxt) { pts.push([nxt.x, nxt.y]); stops.push({ room: nxt, at: pts.length - 1 }); }
    }
    return pts.length > 1 ? { ids, pts, miss, stops } : null;
  };
  return { people: path(F.people), material: path(F.material), check: C };
}
// the flow paths drawn on the floor in 3D: green chevrons for people, orange for material
function flowArrows(THREE, root, plan) {
  const FR = flowRoutes(plan); if (!FR) return;
  const grp = new THREE.Group(); grp.userData.airflow = true; root.add(grp);
  const sh = new THREE.Shape(); sh.moveTo(-0.6, -0.5); sh.lineTo(0, 0.15); sh.lineTo(0.6, -0.5); sh.lineTo(0.6, -0.15); sh.lineTo(0, 0.55); sh.lineTo(-0.6, -0.15); sh.lineTo(-0.6, -0.5);
  const geo = new THREE.ShapeGeometry(sh);
  for (const [k, col, y] of [['people', 0x3fbf6f, 0.1], ['material', 0xf09a3a, 0.11]]) {
    const P = FR[k]; if (!P) continue;
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i + 1 < P.pts.length; i++) {
      const [x1, z1] = P.pts[i], [x2, z2] = P.pts[i + 1], L = Math.hypot(x2 - x1, z2 - z1); if (L < 0.3) continue;
      const n = Math.max(1, Math.floor(L / 2.5)), ang = Math.atan2(x2 - x1, z2 - z1);
      for (let j = 0; j < n; j++) { const t = (j + 0.5) / n, c = new THREE.Mesh(geo, m); c.rotation.x = -Math.PI / 2; c.rotation.z = ang + Math.PI; c.position.set(x1 + (x2 - x1) * t, y, z1 + (z2 - z1) * t); c.renderOrder = 2; grp.add(c); }
    }
  }
}
function floorFlow(THREE, root, plan) {
  const grp = new THREE.Group(); grp.userData.airflow = true; root.add(grp);
  let A; try { A = analyzeAll(plan); } catch (e) { return; }
  // cleanrooms only: a house has no pressure cascade to show
  if (A.empty || !A.pieces || !A.pieces.length || !A.hardAny) return;
  const rooms = (zones(plan).length > 1 ? flatten(plan).rooms : plan.rooms) || [];
  const B = A.bounds, M = 8;
  let c = 0.5; while (((B.w + 2 * M) / c) * ((B.d + 2 * M) / c) > 1.2e6) c *= 1.25;
  const x0 = B.minX - M, z0 = B.minZ - M, nx = Math.ceil((B.w + 2 * M) / c), nz = Math.ceil((B.d + 2 * M) / c), N = nx * nz;
  const ix = (x) => Math.floor((x - x0) / c), iz = (z) => Math.floor((z - z0) / c), at = (x, z) => { const i = ix(x), j = iz(z); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
  const cx = (k) => x0 + (k % nx + 0.5) * c, cz = (k) => z0 + (Math.floor(k / nx) + 0.5) * c;
  // walls, openings (closed, so they part the spaces) and chases
  const solid = new Uint8Array(N);
  const stamp = (ax, az, bx, bz, r) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / (c / 3))); for (let k = 0; k <= n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; for (let j = iz(z - r); j <= iz(z + r); j++) for (let i = ix(x - r); i <= ix(x + r); i++) if (i >= 0 && j >= 0 && i < nx && j < nz) solid[j * nx + i] = 1; } };
  for (const p of A.pieces) stamp(p.x1, p.z1, p.x2, p.z2, Math.max(c * 0.6, (p.t || 0.25) / 2));
  for (const i of A.opInfo) stamp(i.o.x1, i.o.y1, i.o.x2, i.o.y2, Math.max(c * 0.6, (i.t || 0.25) / 2));
  for (const b of A.boxes) for (let j = iz(b.z0); j <= iz(b.z1); j++) for (let i = ix(b.x0); i <= ix(b.x1); i++) if (i >= 0 && j >= 0 && i < nx && j < nz) solid[j * nx + i] = 1;
  // spaces
  const comp = new Int32Array(N).fill(-1); let nc = 0;
  for (let s0 = 0; s0 < N; s0++) {
    if (solid[s0] || comp[s0] >= 0) continue;
    const st = [s0]; comp[s0] = nc;
    while (st.length) { const k = st.pop(), i = k % nx; for (const q of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, k - nx, k + nx]) if (q >= 0 && q < N && !solid[q] && comp[q] < 0) { comp[q] = nc; st.push(q); } }
    nc++;
  }
  const OUT = comp[0];
  const compAt = (x, z) => { const k = at(x, z); if (k < 0) return OUT; if (comp[k] >= 0) return comp[k]; for (let r = 1; r <= 3; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const q = k + dj * nx + di; if (q >= 0 && q < N && comp[q] >= 0) return comp[q]; } return -1; };
  // room pressures and starting points by space
  const P = new Map(), labels = new Map();
  for (const r of rooms) {
    const k = compAt(r.x, r.y); if (k < 0 || k === OUT) continue;
    (labels.get(k) || labels.set(k, []).get(k)).push([r.x, r.y]);
    const pr = r.pressure != null && r.pressure !== '' && isFinite(+r.pressure) ? +r.pressure : null;
    if (pr != null) P.set(k, Math.max(P.has(k) ? P.get(k) : -1e9, pr));
  }
  P.set(OUT, 0);
  // doors between spaces
  const doors = [];
  for (const i of A.opInfo) {
    const o = i.o; if (o.type === 'glass' || o.type === 'window' || o.type === 'pass' || o.type === 'removable') continue;
    const L = Math.hypot(o.x2 - o.x1, o.y2 - o.y1); if (L < 0.5) continue;
    const ux = (o.x2 - o.x1) / L, uz = (o.y2 - o.y1) / L, mx = (o.x1 + o.x2) / 2, mz = (o.y1 + o.y2) / 2, off = (i.t || 0.25) / 2 + 1.1;
    const sa = [mx - uz * off, mz + ux * off], sb = [mx + uz * off, mz - ux * off], a = compAt(...sa), b = compAt(...sb);
    if (a < 0 || b < 0 || a === b) continue;
    doors.push({ a, b, sa, sb, mx, mz });
  }
  if (!doors.length) return;
  // hops from the outdoors
  const hop = new Map([[OUT, 0]]), q0 = [OUT];
  while (q0.length) { const k = q0.shift(); for (const d of doors) { const o = d.a === k ? d.b : d.b === k ? d.a : -1; if (o >= 0 && !hop.has(o)) { hop.set(o, hop.get(k) + 1); q0.push(o); } } }
  // which way each door goes: from (space, inside point) to (space, inside point)
  const flows = [];
  for (const d of doors) {
    const pa = P.get(d.a), pb = P.get(d.b), ha = hop.has(d.a) ? hop.get(d.a) : 1e9, hb = hop.has(d.b) ? hop.get(d.b) : 1e9;
    let fwd = null;
    if (pa != null && pb != null && Math.abs(pa - pb) >= 0.5) fwd = pa > pb;
    else if (ha !== hb) fwd = ha > hb;
    if (fwd == null) continue;
    flows.push(fwd ? { from: d.a, to: d.b, p: d.sa, q: d.sb } : { from: d.b, to: d.a, p: d.sb, q: d.sa });
  }
  if (!flows.length) return;
  // paths inside each space keep about 9″ off the walls where they can
  const pad = new Uint8Array(N), R = Math.max(1, Math.round(0.75 / c));
  for (let k = 0; k < N; k++) if (solid[k]) { const i = k % nx, j = Math.floor(k / nx); for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) pad[jj * nx + ii] = 1; } }
  const nearFree = (x, z, k) => { const s = at(x, z); if (s < 0) return -1; if (comp[s] === k && !pad[s]) return s; for (let r = 1; r <= 6; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const q = s + dj * nx + di; if (q >= 0 && q < N && comp[q] === k && !pad[q]) return q; } return comp[s] === k ? s : -1; };
  const clearLine = (a, b) => { const ax = cx(a), az = cz(a), bx = cx(b), bz = cz(b), L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / (c / 2)); for (let t = 0; t <= n; t++) { const k = at(ax + (bx - ax) * t / n, az + (bz - az) * t / n); if (k < 0 || pad[k]) return false; } return true; };
  const paths = [];
  const bySpace = new Map(); for (const f of flows) (bySpace.get(f.from) || bySpace.set(f.from, { out: [], in: [] }).get(f.from)).out.push(f);
  for (const f of flows) if (bySpace.has(f.to)) bySpace.get(f.to).in.push(f);
  for (const [k, S] of bySpace) {
    if (k === OUT) continue;
    const src = [...(labels.get(k) || []), ...S.in.map(f => f.q)].map(([x, z]) => nearFree(x, z, k)).filter(s => s >= 0);
    if (!src.length) continue;
    // one search from every start; each way out traces back to the nearest start
    const par = new Int32Array(N).fill(-2), qq = [];
    for (const s of src) { par[s] = -1; qq.push(s); }
    for (let h = 0; h < qq.length; h++) { const u = qq[h], i = u % nx; for (const v of [i > 0 ? u - 1 : -1, i < nx - 1 ? u + 1 : -1, u - nx, u + nx, i > 0 ? u - nx - 1 : -1, i < nx - 1 ? u - nx + 1 : -1, i > 0 ? u + nx - 1 : -1, i < nx - 1 ? u + nx + 1 : -1]) if (v >= 0 && v < N && par[v] === -2 && comp[v] === k && !pad[v]) { par[v] = u; qq.push(v); } }
    for (const f of S.out) {
      const e = nearFree(f.p[0], f.p[1], k); if (e < 0 || par[e] === -2) continue;
      const cells = []; for (let u = e; u >= 0; u = par[u]) cells.push(u); cells.reverse();
      // pull the path straight wherever the floor between two points is clear
      const keep = [cells[0]]; let a = 0;
      while (a < cells.length - 1) { let b = cells.length - 1; while (b > a + 1 && !clearLine(cells[a], cells[b])) b--; keep.push(cells[b]); a = b; }
      const pts = keep.map(u => [cx(u), cz(u)]); pts.push(f.p, f.q);
      paths.push({ pts, out: f.to === OUT });
    }
  }
  // the outdoors: carry the air a few feet clear of the building
  for (const f of flows) if (f.to === OUT) { const dx = f.q[0] - f.p[0], dz = f.q[1] - f.p[1], L = Math.hypot(dx, dz) || 1; paths.push({ pts: [f.p, f.q, [f.q[0] + dx / L * 4, f.q[1] + dz / L * 4]], out: true }); }
  if (!paths.length) return;
  // a ribbon of chevrons along each path, sliding along with time
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d'); g.fillStyle = 'rgba(255,255,255,1)';
  g.beginPath(); g.moveTo(20, 6); g.lineTo(64, 32); g.lineTo(20, 58); g.lineTo(44, 58); g.lineTo(88, 32); g.lineTo(44, 6); g.closePath(); g.fill();
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  const mk = (col) => new THREE.MeshBasicMaterial({ map: tex, color: col, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, side: THREE.DoubleSide });
  const inMat = mk(0x3fc4e0), outMat = mk(0xf0a35a), W = 0.6, Y = 0.1, rep = 1.7;
  for (const pth of paths) {
    const pts = pth.pts.filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.05); if (pts.length < 2) continue;
    const pos = [], uv = [], idx = []; let u = 0;
    for (let i = 0; i < pts.length; i++) {
      const pa = pts[Math.max(0, i - 1)], pb = pts[Math.min(pts.length - 1, i + 1)], dx = pb[0] - pa[0], dz = pb[1] - pa[1], L = Math.hypot(dx, dz) || 1, nX = -dz / L * W, nZ = dx / L * W;
      if (i) u += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / rep;
      pos.push(pts[i][0] + nX, Y, pts[i][1] + nZ, pts[i][0] - nX, Y, pts[i][1] - nZ); uv.push(u, 1, u, 0);
      if (i) { const b = (i - 1) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, pth.out ? outMat : inMat); m.renderOrder = 2; grp.add(m);
  }
  const first = grp.children[0];
  if (first) first.onBeforeRender = () => { tex.offset.x = -((performance.now() / 1000) * 0.6 % 1); };
}
/* Pressure cascade in 3D: a flat arrow on the floor through each door with pressures set on both sides,
   pointing the way the air goes, green when it's right and red when it's wrong or weak. */
function pressureArrows(THREE, root, plan) {
  if (!(plan.rooms || []).some(r => r.pressure != null && r.pressure !== '')) return;
  let C; try { C = cleanroomCheck(plan); } catch (e) { return; }
  const shape = new THREE.Shape(); shape.moveTo(-0.9, -0.16); shape.lineTo(0.25, -0.16); shape.lineTo(0.25, -0.42); shape.lineTo(0.95, 0); shape.lineTo(0.25, 0.42); shape.lineTo(0.25, 0.16); shape.lineTo(-0.9, 0.16); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const po = { transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 };
  const good = new THREE.MeshBasicMaterial({ color: 0x3fbf6f, ...po }), bad = new THREE.MeshBasicMaterial({ color: 0xe5533d, ...po });
  const grp = new THREE.Group(); grp.userData.airflow = true; root.add(grp);
  for (const d of C.doors) {
    if (d.dp == null || Math.abs(d.dp) < 0.5) continue;
    const sg = d.dp > 0 ? -1 : 1, m = new THREE.Mesh(geo, d.warn ? bad : good);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(-d.ny * sg, d.nx * sg);
    m.scale.set(1.4, 1.4, 1); m.position.set(d.mx, 0.12, d.my); m.renderOrder = 2; grp.add(m);
  }
}
/* Roof structure over building (shell) walls: open-web steel joists across the short way, 5′ on center,
   24″ deep (30″ past a 50′ span), each running wall to wall inside the building. */
function roofStructure(plan, A) {
  A = A || analyze(plan); if (!(A.shellTop > 0) || plan.__below) return null;
  const fp = footprint(A, true); if (!fp) return null;
  const B = A.bounds, alongX = B.w <= B.d, sp = 5, step = 0.25, joists = [];
  const scan = (fixed, lo, hi) => {
    let st = null;
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const inside = alongX ? fp.has(v, fixed) : fp.has(fixed, v);
      if (inside && st === null) st = v;
      if ((!inside || v + step > hi + 1e-9) && st !== null) { const e = inside ? v : v - step; if (e - st > 4) joists.push(alongX ? { x1: st, z1: fixed, x2: e, z2: fixed, len: e - st } : { x1: fixed, z1: st, x2: fixed, z2: e, len: e - st }); st = null; }
    }
  };
  if (alongX) for (let z = B.minZ + sp / 2; z < B.maxZ; z += sp) scan(z, B.minX, B.maxX);
  else for (let x = B.minX + sp / 2; x < B.maxX; x += sp) scan(x, B.minZ, B.maxZ);
  if (!joists.length) return null;
  const span = Math.max(...joists.map(j => j.len));
  return { joists, depth: span > 50 ? 2.5 : 2, spacing: sp, span };
}
/* ---------- Mount ---------- */
function mount(container, plan, opts) {
  opts = opts || {};
  const THREE = global.THREE;
  injectCSS();
  container.classList.add('p3v');
  container.innerHTML = `
    <canvas class="p3v-c" tabindex="0" aria-label="3D model. Drag to look, click the floor to walk."></canvas>
    <div class="p3v-labels" hidden></div>
    <div class="p3v-top">
      <div class="p3v-panel p3v-card"><div class="p3v-title"></div><div class="p3v-meta"></div><div class="p3v-here"><b></b><span></span></div></div>
      <div class="p3v-right"><div class="p3v-panel p3v-modes" role="group" aria-label="View"><button data-m="walk">Walk</button><button data-m="fly" title="Drone: fly a little drone anywhere, through walls, up into the plenum, outside round the building. W A S D to move, Space or R up, C or F down, Shift faster, drag to look, V for the drone’s own camera">Drone</button><button data-m="doll">Dollhouse</button><button data-m="plenum" hidden title="Looks into the plenum: the grid ceiling stays, the top comes off">Plenum</button><button data-m="exterior" hidden title="The outside, with the roof on">Exterior</button><button data-m="plan">Plan</button></div>
      <button class="p3v-panel p3v-look" aria-pressed="false" title="Turn by moving the mouse, no button needed (L). Esc to stop.">Mouse look <kbd>L</kbd></button>
      <button class="p3v-panel p3v-look p3v-lidb" aria-pressed="false" hidden title="Show the lid (the top of the cleanroom, or a roof deck you placed) in every view, or take it off again">Lid</button>
      <button class="p3v-panel p3v-look p3v-remb" aria-pressed="false" hidden title="Take the removable wall sections out, to see the opening (and walk through it) when equipment comes in">Show removed</button>
      
      <button class="p3v-panel p3v-look p3v-air" aria-pressed="true" hidden title="Show or hide the airflow: air down out of the FFUs, into the return grilles, and along the floor out through the doors and out of the building">Airflow</button>
      <button class="p3v-panel p3v-look p3v-meas" aria-pressed="false" title="Measure: click two points for the distance between them. It snaps to corners, edges, the top of a filter, the ceiling grid and tiles, floors and walls (green dot = snapped). Shift: straight up/down from the first point; Ctrl: level with it. M turns it on and off, Esc drops a half-done measurement">📏 Measure <kbd>M</kbd></button><button class="p3v-panel p3v-look p3v-mclear" hidden title="Take all the measurements off">✕ Clear</button>
      <button class="p3v-panel p3v-look p3v-snap" title="Save a picture of this view with a note (and your measurements), to come back to later (P)">📷 Snapshot <kbd>P</kbd></button>
      <button class="p3v-panel p3v-look p3v-tour" hidden title="A guided walk along the gowning route, room by room">▶ Gowning tour</button>
      <button class="p3v-panel p3v-look p3v-srb" hidden title="A photo-real, path-traced picture of this view (light bounces, real glass and steel, soft shadows). Save it as an image.">✨ Super render</button><button class="p3v-panel p3v-cbtn" aria-pressed="false" hidden title="Click anything in the model to leave a comment on it">💬 Comment</button></div>
    </div>
    <div class="p3v-cap p3v-panel" hidden aria-live="polite"></div>
    <div class="p3v-mlabels" aria-hidden="true"></div><div class="p3v-mhover" hidden></div>
    <div class="p3v-ud" hidden><button data-ud="1" aria-label="Fly up">▲</button><button data-ud="-1" aria-label="Fly down">▼</button></div>
    <div class="p3v-snapdlg p3v-panel" hidden role="dialog" aria-label="Snapshot"><b>Snapshot</b><img alt=""><textarea rows="3" placeholder="What needs work here?"></textarea><div><button data-a="cancel">Cancel</button><button data-a="save" class="pri">Save</button></div></div>
    <div class="p3v-aim" aria-hidden="true"></div>
    <div class="p3v-joy" hidden aria-hidden="true"><b>MOVE</b><i></i></div>
    <div class="p3v-bottom"><canvas class="p3v-mini p3v-panel" aria-label="Mini map. Click to jump there."></canvas><div class="p3v-chips"></div></div>
    <div class="p3v-hint"></div>
    <div class="p3v-panel p3v-clist" hidden></div>
    <form class="p3v-panel p3v-cform p3v-aform" hidden><b>Approve this design?</b><small class="p3v-ainfo" style="color:#9fb0b7">Your designer gets your answer right away.</small><div class="p3v-adec" style="display:flex;gap:6px"><button type="button" data-dec="approve" aria-pressed="true">✓ Approve</button><button type="button" data-dec="changes" aria-pressed="false">✎ Request changes</button></div><textarea rows="3" placeholder="Anything to add (optional)"></textarea><input placeholder="Your name" maxlength="60" required><div><button type="submit">Send</button><button type="button" class="p3v-ccancel">Cancel</button></div><small class="p3v-aerr" style="color:#f0a3a3"></small></form>
    <form class="p3v-panel p3v-cform" hidden><b>Comment</b><textarea rows="3" placeholder="What should change here?" required></textarea><input placeholder="Your name" maxlength="60"><div><button type="submit">Save</button><button type="button" class="p3v-ccancel">Cancel</button></div></form>
    <div class="p3v-empty" hidden>Draw or import walls to see them in 3D.</div>`;
  const $ = (s) => container.querySelector(s);
  const canvas = $('.p3v-c'), labelsEl = $('.p3v-labels'), chipsEl = $('.p3v-chips'), mini = $('.p3v-mini'), hint = $('.p3v-hint');
  const titleEl = $('.p3v-title'), metaEl = $('.p3v-meta'), hereName = $('.p3v-here b'), hereDims = $('.p3v-here span'), emptyEl = $('.p3v-empty');
  const modeBtns = [...container.querySelectorAll('.p3v-modes button')];
  const lookBtn = container.querySelector('.p3v-look');
  // Airflow arrows: shown until turned off; the button only shows when there are arrows to show
  const airBtn = container.querySelector('.p3v-air'); let airOn = opts.airflow !== false; // a customer link starts with it off
  function refreshAir() {
    const G = []; if (built) built.root.traverse(o => { if (o.userData && o.userData.airflow) G.push(o); });
    G.forEach(o => { o.visible = airOn; });
    if (airBtn) { airBtn.hidden = !G.some(o => o.children.length); airBtn.setAttribute('aria-pressed', String(airOn)); }
  }
  if (airBtn) airBtn.addEventListener('click', (e) => { e.stopPropagation(); airOn = !airOn; refreshAir(); });
  // the lid on in every view (Dollhouse and Plan too), or back to each view's own
  const lidBtn = container.querySelector('.p3v-lidb'); let lidOn = false;
  const remBtn = container.querySelector('.p3v-remb'); let remOpen = false;
  if (remBtn) remBtn.addEventListener('click', (e) => { e.stopPropagation(); remOpen = !remOpen; remBtn.setAttribute('aria-pressed', String(remOpen)); applyVis(mode); });
  if (lidBtn) lidBtn.addEventListener('click', (e) => { e.stopPropagation(); lidOn = !lidOn; lidBtn.setAttribute('aria-pressed', String(lidOn)); applyVis(mode); });
  // Light switches: click one to turn its lights off and on. A light goes dark when any switch it's on is off.
  // This is for looking around; it doesn't change the plan (a switch saved with off: true starts off).
  const swState = new Map(), ledOff = new THREE.MeshPhongMaterial({ color: 0x5d6468, specular: 0x222222, shininess: 10 });
  function applySwitches() {
    if (!built) return;
    const dark = new Set();
    built.root.traverse(o => {
      const S = o.userData && o.userData.sw; if (!S) return;
      if (!swState.has(S.id)) swState.set(S.id, !S.off);
      const on = swState.get(S.id);
      if (!on) S.lights.forEach(k => dark.add(k));
      o.children.forEach(c => { if (c.userData.toggle) c.position.y = on ? 0.03 : -0.03; });
    });
    built.root.traverse(o => {
      if (!o.isMesh || !o.userData || !o.userData.light) return;
      if (!o.userData.onMat) o.userData.onMat = o.material;
      o.material = dark.has(o.userData.light) ? ledOff : o.userData.onMat;
    });
  }
  function checkSwitchClick(clientX, clientY) {
    if (!built) return false;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([...(built.floors || [built.floor]), ...built.pick], false)[0]; if (!hit) return false;
    for (let o = hit.object; o; o = o.parent) {
      const S = o.userData && o.userData.sw;
      if (S) { swState.set(S.id, !swState.get(S.id)); applySwitches(); return true; }
    }
    return false;
  }

  // phones and tablets: a lighter canvas (sharp enough on their small screens, and well inside the graphics
  // memory iPhones and Android browsers give a page, so the 3D doesn't go black or reload)
  const COARSE = !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !COARSE || (global.devicePixelRatio || 1) < 2, preserveDrawingBuffer: !!opts.preserve, powerPreference: COARSE ? 'default' : 'high-performance' }); }
  catch (e) { container.insertAdjacentHTML('beforeend', '<div class="p3v-nogl">This browser can’t show 3D (WebGL is turned off or not supported). Try Safari, Chrome, Edge or Firefox, or turn on hardware acceleration.</div>'); throw e; }
  renderer.setPixelRatio(Math.min(COARSE ? 1.5 : 2, global.devicePixelRatio || 1));
  ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdde4e8);
  scene.fog = new THREE.Fog(0xdde4e8, 140, 360);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 900);
  camera.rotation.order = 'YXZ';
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b6b9, 0.64));
  scene.add(new THREE.AmbientLight(0xffffff, 0.17));
  const sun = new THREE.DirectionalLight(0xffffff, 0.58); sun.position.set(-50, 80, 35); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xf2f6ff, 0.24); fill.position.set(70, 50, -50); scene.add(fill);

  // ---- Graphics: physically based materials, a lighting environment for reflections, filmic colour, soft sun
  // shadows fitted to the model and (on a computer) ambient occlusion. Everything the scene builders make
  // (Phong / Lambert) is swapped for a matching physical material as it appears, so every view gets it.
  const HQ = opts.quality ? opts.quality === 'high' : !(global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
  const GFX = !!THREE.MeshStandardMaterial && opts.graphics !== 'classic' && !(global.P3GFX && global.P3GFX.classic);
  const GT = Object.assign({ exposure: 1.0, ao: false, env: 0.5, light: 0.68, tm: 'none', shadows: true, nb: 0.15 }, global.P3GFX || {});
  if (GFX) {
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = GT.tm === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; renderer.toneMappingExposure = GT.exposure;
    // physical materials add up light in linear space, so the lights are turned down to keep whites white
    scene.traverse(o => { if (o.isLight) o.intensity *= GT.light; });
    renderer.shadowMap.enabled = !!GT.shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene.fog.color.convertSRGBToLinear();
    sun.castShadow = true; sun.shadow.mapSize.set(HQ ? 4096 : 1024, HQ ? 4096 : 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = GT.nb; sun.shadow.radius = 3;
    scene.add(sun.target);
    // the environment: a sky dome, a pale horizon, a darker ground and a few big soft lights, blurred into
    // reflections and image-based light (what makes steel, glass and epoxy look real)
    try {
      const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
      const sg = new THREE.SphereGeometry(100, 48, 24), pos = sg.attributes.position, cols = [];
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 100, sky = new THREE.Color(0.52, 0.66, 0.92), hor = new THREE.Color(1.0, 0.98, 0.95), gnd = new THREE.Color(0.24, 0.23, 0.22); const c = y > 0 ? hor.clone().lerp(sky, Math.pow(y, 0.6)) : hor.clone().lerp(gnd, Math.min(1, -y * 4)); cols.push(c.r, c.g, c.b); }
      sg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      es.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
      const box = (x, y, z, w, h, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.98, 0.94).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
      box(-40, 70, 30, 40, 40, 5); box(60, 40, -40, 30, 50, 2.5); box(0, 90, -10, 60, 30, 3); box(-70, 20, -50, 20, 30, 1.6);
      scene.environment = pm.fromScene(es, 0.035).texture; pm.dispose();
    } catch (e) { /* no environment: materials still work */ }
  }
  const upCache = new Map(), upDone = new WeakSet();
  function upMat(m) {
    if (!m || upDone.has(m)) return m;
    if (upCache.has(m)) return upCache.get(m);
    let out = m;
    if (m.map) { m.map.encoding = THREE.sRGBEncoding; m.map.needsUpdate = true; }
    if (m.isMeshPhongMaterial || m.isMeshLambertMaterial) {
      const ph = !!m.isMeshPhongMaterial, sh = ph ? (m.shininess || 30) : 0, sp = ph && m.specular ? (m.specular.r + m.specular.g + m.specular.b) / 3 : 0;
      const c = m.color, sat = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b), lum = (c.r + c.g + c.b) / 3;
      const glass = m.transparent && m.opacity < 0.65 && !m.map;
      const metal = !glass && ph && sp >= 0.55 && sh >= 55 && sat < 0.1 && lum > 0.45 ? 0.82 : 0;
      out = new THREE.MeshStandardMaterial({
        color: m.color.clone().convertSRGBToLinear(), map: m.map || null, transparent: m.transparent, opacity: m.opacity, side: m.side,
        depthWrite: m.depthWrite, depthTest: m.depthTest, alphaTest: m.alphaTest, vertexColors: m.vertexColors,
        polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits,
        roughness: glass ? 0.05 : ph ? Math.max(0.16, Math.min(0.9, 1 - Math.sqrt(sh / 100) * 0.78)) : 0.86,
        metalness: metal, envMapIntensity: glass ? 1.6 : metal ? 1.15 : GT.env,
      });
      if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01) { out.emissive = m.emissive.clone().convertSRGBToLinear(); out.emissiveIntensity = m.emissiveIntensity; out.emissiveMap = m.emissiveMap || null; }
      out.userData = m.userData; out.name = m.name; out.visible = m.visible;
      upCache.set(m, out); upDone.add(out);
      if (real) tuneMat(out, true);
    } else if (m.isMeshBasicMaterial || m.isLineBasicMaterial || m.isSpriteMaterial || m.isPointsMaterial) {
      // flat colours (lights, arrows, labels, linework) keep exactly the colour they were drawn in
      if (m.color) m.color.convertSRGBToLinear(); m.toneMapped = false; m.needsUpdate = true; upDone.add(m);
    } else upDone.add(m);
    return out;
  }
  function upgradeScene(root) {
    if (!GFX || !root) return;
    root.traverse(o => {
      if (!(o.isMesh || o.isLine || o.isSprite || o.isPoints)) return;
      o.material = Array.isArray(o.material) ? o.material.map(upMat) : upMat(o.material);
      if (o.isMesh && !o.isSprite) { const tr = Array.isArray(o.material) ? o.material.some(q => q.transparent) : o.material.transparent; o.castShadow = !tr && !o.material.isMeshBasicMaterial; o.receiveShadow = !o.material.isMeshBasicMaterial; }
    });
  }
  // the sun's shadow box fitted around the model, so shadows stay crisp on a small room and a big building
  function fitSun(Bd, top) {
    if (!GFX || !Bd || !isFinite(Bd.w)) return;
    const cx = Bd.minX + Bd.w / 2, cz = Bd.minZ + Bd.d / 2, r = Math.max(20, Math.hypot(Bd.w, Bd.d) / 2 + 6);
    sun.target.position.set(cx, 0, cz); sun.position.set(cx - r * 0.75, Math.max(top, 10) + r * 1.4, cz + r * 0.55);
    const C = sun.shadow.camera; C.left = -r; C.right = r; C.top = r; C.bottom = -r; C.near = 1; C.far = r * 5 + top; C.updateProjectionMatrix();
  }
  // ambient occlusion and smoothing on a computer: the soft darkening where walls meet the floor and ceiling
  let composer = null, ssaoPass = null, fxaaPass = null;
  if (GFX && HQ && GT.ao && THREE.EffectComposer && THREE.SSAOPass && renderer.capabilities.isWebGL2) {
    try {
      const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType });
      composer = new THREE.EffectComposer(renderer, rt);
      ssaoPass = new THREE.SSAOPass(scene, camera, 2, 2); ssaoPass.kernelRadius = 0.9; ssaoPass.minDistance = 0.0004; ssaoPass.maxDistance = 0.02;
      composer.addPass(ssaoPass); composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      fxaaPass = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaaPass);
    } catch (e) { composer = null; }
  }

  // ---- Realistic: the rooms lit by their ceiling lights (an area light over each room), filmic colour,
  // ambient occlusion in the corners, an indoor reflection environment (bright ceiling panels over a glossy
  // floor) for the epoxy, aluminum and stainless, and a soft glow on the light lenses. An option: the plain
  // view stays exactly as it was when it's off.
  const realBtn = container.querySelector('.p3v-real');
  // the Realistic view was taken out (1.6.2): the regular 3D view and Super render are the two looks
  const canReal = false;
  let lightGain = 1.7, real = false, rGrade = null, rComp = null, rPlain = null, rSSAO = null, rFXAA = null, rBloom = null, envIn = null;
  const envOut = scene.environment, tmOut = renderer.toneMapping, expOut = renderer.toneMappingExposure;
  const roomLights = new THREE.Group(); roomLights.name = 'room lights'; scene.add(roomLights);
  const matOrig = new Map();
  const REAL_TUNE = [
    [/floor/i, { roughness: 0.3, metalness: 0, envMapIntensity: 0.38 }],
    [/glass/i, { roughness: 0.04, envMapIntensity: 0.9 }],
    // the ceiling isn't lit by the lights below it (they face down), so it gets the bounce light it would have
    // in a white room: a little glow of its own
    [/ceiling tile, aluminum, painted/i, { roughness: 0.45, metalness: 0, envMapIntensity: 0.6, emissiveIntensity: 1.45 }],
    [/ceiling tile, aluminum/i, { roughness: 0.4, metalness: 0.25, envMapIntensity: 1.1, emissiveIntensity: 2.6 }],
    [/ceiling tile, vinyl/i, { roughness: 0.55, metalness: 0, envMapIntensity: 0.6, emissiveIntensity: 1.3 }],
    [/grid|track|aluminum|hardware|stainless|galvanized|damper|kick/i, { roughness: 0.3, metalness: 0.9, envMapIntensity: 1.3 }],
    [/ceiling tile|ceiling, solid/i, { roughness: 0.92, metalness: 0, envMapIntensity: 0.35 }],
    [/wall panel|door leaf|door frame|fixture housing|ffu housing/i, { roughness: 0.36, metalness: 0, envMapIntensity: 0.85 }],
    [/rubber/i, { roughness: 0.82, envMapIntensity: 0.3 }]
  ];
  function tuneMat(m, on) {
    if (!m || !m.isMeshStandardMaterial) return;
    const t = REAL_TUNE.find(([re]) => re.test(m.name || '')); if (!t) return;
    if (on) { if (!matOrig.has(m)) matOrig.set(m, { roughness: m.roughness, metalness: m.metalness, envMapIntensity: m.envMapIntensity, emissiveIntensity: m.emissiveIntensity }); Object.assign(m, t[1]); }
    else if (matOrig.has(m)) Object.assign(m, matOrig.get(m));
  }
  function indoorEnv() {
    // a big pale room: light-gray walls, a darker floor, rows of bright ceiling panels (the light fixtures the
    // floor, steel and glass reflect)
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(), B = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide })); m.position.set(x, y, z); es.add(m); };
    B(80, 14, 80, new THREE.Color(0.5, 0.52, 0.53), 0, 7, 0);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.34, 0.35) })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.02; es.add(fl);
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.99, 0.96).multiplyScalar(3.2) })); p.rotation.x = Math.PI / 2; p.position.set(i * 11, 13.9, j * 11); es.add(p); }
    const t = pm.fromScene(es, 0.04).texture; pm.dispose(); return t;
  }
  function makeComposer() {
    // full 24-bit depth everywhere (a target without a stencil gets a 16-bit depth buffer, and the rubber base,
    // floor and wall faces, a fraction of an inch apart, flicker through each other)
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, stencilBuffer: true });
    rComp = new THREE.EffectComposer(renderer, rt);
    rPlain = new THREE.RenderPass(scene, camera); rPlain.enabled = false; rComp.addPass(rPlain);   // used when the corner shading is off
    rSSAO = new THREE.SSAOPass(scene, camera, 2, 2); rSSAO.kernelRadius = 4; rSSAO.minDistance = 0.0015; rSSAO.maxDistance = 0.15;   // wide and soft: the corners and the wall-ceiling joint shade like a real room
    if (rSSAO.beautyRenderTarget) rSSAO.beautyRenderTarget.stencilBuffer = true;
    if (rSSAO.normalRenderTarget && rSSAO.normalRenderTarget.depthTexture) rSSAO.normalRenderTarget.depthTexture.type = THREE.UnsignedIntType;
    rComp.addPass(rSSAO);
    if (THREE.UnrealBloomPass) { rBloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.5, 1.4); rComp.addPass(rBloom); }   // only what's brighter than white glows: the light lenses
    rComp.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
    // a photographer's finish, like the Super render's filmic colour: a gentle S-curve, a touch of warmth and
    // saturation, and a soft vignette
    rGrade = new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, con: { value: 0.1 }, sat: { value: 1.05 }, vig: { value: 0.16 }, warm: { value: 0.012 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float con, sat, vig, warm; varying vec2 vUv; void main() { vec4 t = texture2D(tDiffuse, vUv); vec3 c = clamp(t.rgb, 0.0, 1.0); c = c + con * (c - c * c) * (2.0 * c - 1.0) * 4.0; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(vec3(l), c, sat); c *= vec3(1.0 + warm, 1.0, 1.0 - warm * 1.2); vec2 d = vUv - 0.5; c *= 1.0 - vig * smoothstep(0.25, 0.75, dot(d, d) * 2.2); gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a); }'
    });
    rComp.addPass(rGrade);
    rFXAA = new THREE.ShaderPass(THREE.FXAAShader); rComp.addPass(rFXAA);
    sizeReal();
  }
  function sizeReal() {
    if (!rComp) return; const w = container.clientWidth || 1, h = container.clientHeight || 1, pr = renderer.getPixelRatio();
    rComp.setSize(w, h); if (rSSAO) rSSAO.setSize(w * pr, h * pr); if (rBloom) rBloom.setSize(w * pr, h * pr); if (rFXAA) rFXAA.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
  }
  // an area light over each room, as wide as its ceiling fixtures, as bright as its lights
  const FLOOR_GLOSS = {
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, opacity: { value: 0.2 }, texel: { value: new THREE.Vector2(1 / 512, 1 / 512) } },
    vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; void main() { vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // a satin epoxy floor, not a mirror: the reflection is blurred (more along the line of sight, like a real
    // floor's sheen) and only the bright things, the light panels, really show in it; the room is a faint haze
    fragmentShader: 'uniform vec3 color; uniform sampler2D tDiffuse; uniform float opacity; uniform vec2 texel; varying vec4 vUv; vec3 tap(vec2 uv) { return texture2D(tDiffuse, uv).rgb; } void main() { vec2 uv = vUv.xy / vUv.w; vec3 c = tap(uv) * 0.2; float wsum = 0.2; for (int i = 1; i <= 6; i++) { float k = float(i), g = exp(-k * k / 14.0); c += (tap(uv + texel * vec2(0.0, 3.0 * k)) + tap(uv - texel * vec2(0.0, 3.0 * k))) * g; c += (tap(uv + texel * vec2(1.6 * k, 0.0)) + tap(uv - texel * vec2(1.6 * k, 0.0))) * g * 0.6; wsum += g * 3.2; } c /= wsum; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); float h = smoothstep(0.9, 2.2, l); gl_FragColor = vec4(c * color, opacity * mix(0.12, 1.0, h)); }'
  };
  let gloss = null;
  function placeGloss() {
    if (gloss) { scene.remove(gloss); gloss.getRenderTarget().dispose(); gloss.geometry.dispose(); gloss.material.dispose(); gloss = null; }
    if (!real || !A || A.empty || !A.hardAny || !THREE.Reflector || (global.P3REAL || {}).gloss === false || gov.level >= 1) return;
    const b = A.bounds, pr = renderer.getPixelRatio(), tw = Math.max(192, Math.round((container.clientWidth || 800) * pr * 0.3)), th = Math.max(192, Math.round((container.clientHeight || 600) * pr * 0.3));
    gloss = new THREE.Reflector(new THREE.PlaneGeometry(b.w + 0.5, b.d + 0.5), { textureWidth: tw, textureHeight: th, clipBias: 0.003, color: 0xffffff, shader: FLOOR_GLOSS });
    { const rt = gloss.getRenderTarget(); rt.texture.type = THREE.HalfFloatType; rt.texture.minFilter = THREE.LinearFilter; }
    gloss.material.transparent = true; gloss.material.depthWrite = false; gloss.material.uniforms.opacity.value = (global.P3REAL || {}).gl || 0.32; gloss.material.uniforms.texel.value.set(1 / tw, 1 / th);
    gloss.rotation.x = -Math.PI / 2; gloss.position.set(b.minX + b.w / 2, 0.012, b.minZ + b.d / 2); gloss.renderOrder = 2; gloss.name = 'floor gloss';
    // not in the normals pass of the corner shading; and you (the drone, the game, the cursor ring and comment
    // pins) aren't in the floor's reflection, only the room is
    const ob = gloss.onBeforeRender; gloss.onBeforeRender = function (r, sc, cam) {
      if (sc.overrideMaterial) return;
      const hide = [drone, ring, pulse, pins, sc.getObjectByName('p3g')].filter(o => o && o.visible);
      hide.forEach(o => { o.visible = false; });
      try { ob.call(this, r, sc, cam); } finally { hide.forEach(o => { o.visible = true; }); }
    };
    upDone.add(gloss.material); scene.add(gloss);
  }
  // Each light fixture near you is its own area light, the way the Super render lights a room: pools of light
  // under the fixtures, walls brighter near them and falling off between. A fixed set (so nothing recompiles as
  // you move) follows the camera to the nearest fixtures; the room-wide light stays on, dimmer, as the fill.
  const FXN = 10, fxGroup = new THREE.Group(), fxList = []; let fxT = -1, fxOn = false;
  fxGroup.name = 'fixture lights'; scene.add(fxGroup);
  function fxPool() {
    if (fxGroup.children.length) return;
    for (let i = 0; i < FXN; i++) { const l = new THREE.RectAreaLight(0xfff4e6, 0, 2, 4); l.position.set(0, -50, 0); l.lookAt(0, -100, 0); fxGroup.add(l); }
  }
  function updateFx(now, force) {
    if (!real || !fxGroup.children.length || !fxGroup.parent) return;
    if (!force && now - fxT < 350) return; fxT = now;
    const KN = global.P3REAL || {}, inside = mode === 'walk' || (mode === 'fly' && A && st.x > A.bounds.minX && st.x < A.bounds.maxX && st.z > A.bounds.minZ && st.z < A.bounds.maxZ);
    const on = inside && KN.fx !== false && fxList.length > 0;
    if (on !== fxOn) { fxOn = on; const fill = KN.fill != null ? KN.fill : 0.45; roomLights.children.forEach(l => { if (l.userData.i0 == null) l.userData.i0 = l.intensity; l.intensity = l.userData.i0 * (on ? fill : 1); }); }
    const cx = camera.position.x, cz = camera.position.z;
    const near = on ? fxList.map(f => [f, (f.x - cx) * (f.x - cx) + (f.z - cz) * (f.z - cz)]).sort((a, b) => a[1] - b[1]).slice(0, FXN).map(x => x[0]) : [];
    fxGroup.children.forEach((l, i) => {
      const f = near[i];
      if (!f) { l.intensity = 0; return; }
      if (l.userData.f !== f) { l.userData.f = f; l.width = f.w; l.height = f.h; l.position.set(f.x, f.H - 0.04, f.z); l.lookAt(f.x, 0, f.z); }
      // fade the farthest one in and out so lights don't pop as you walk
      l.intensity = f.I * (i === FXN - 1 && near.length === FXN ? 0.5 : 1);
    });
  }
  // Ceiling light shadows: a soft light straight down over where you are, so equipment, tables and carts cast
  // shadows on the floor the way they do under a cleanroom's light panels (Realistic, inside). The ceiling,
  // lid and fixtures (everything above head height) don't block it.
  const downL = new THREE.DirectionalLight(0xfff4e6, 0); scene.add(downL, downL.target);
  downL.shadow.mapSize.set(1024, 1024); downL.shadow.bias = -0.0006; downL.shadow.normalBias = 0.04;
  let downOn = false, downBuilt = null;
  function setCeilCast(on) {
    if (!built) return; const bb = new THREE.Box3();
    built.root.traverse(o => {
      if (!o.isMesh) return;
      if (on) { if (!o.castShadow || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); if (bb.min.y > 6.2) { o.userData.cs0 = true; o.castShadow = false; } }
      else if (o.userData.cs0) { o.castShadow = true; delete o.userData.cs0; }
    });
  }
  function updateDown() {
    const KN = global.P3REAL || {}, on = !!(real && fxOn && GFX && renderer.shadowMap.enabled && KN.down !== false && gov.level < 1 && A);
    if (on !== downOn || (on && downBuilt !== built)) { downOn = on; downL.castShadow = on; downL.intensity = on ? (KN.dk != null ? KN.dk : 0.32) : 0; if (built) built.root.updateMatrixWorld(); setCeilCast(on); downBuilt = on ? built : null; }
    if (!on) return;
    const r = 22, cx = Math.round(camera.position.x / 4) * 4, cz = Math.round(camera.position.z / 4) * 4;
    downL.position.set(cx, (A.H || 9) + 25, cz + 0.01); downL.target.position.set(cx, 0, cz);
    const C = downL.shadow.camera; if (C.right !== r) { C.left = -r; C.right = r; C.top = r; C.bottom = -r; C.near = 1; C.far = 80; C.updateProjectionMatrix(); }
  }
  function placeRoomLights() {
    while (roomLights.children.length) roomLights.remove(roomLights.children[0]);
    fxList.length = 0; fxOn = false; fxT = -1;
    placeGloss();
    if (!real || !plan) return;
    let R = []; try { R = cleanroomCheck(plan).rooms; } catch (e) { R = []; }
    const list = [];
    for (const q of R) {
      const fx = q.fixtures || []; if (!fx.length) continue;
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const f of fx) { const hw = (f.w || 2) / 2, hh = (f.h || 4) / 2; x0 = Math.min(x0, f.x - hw); x1 = Math.max(x1, f.x + hw); z0 = Math.min(z0, f.y - hh); z1 = Math.max(z1, f.y + hh); }
      const nL = fx.filter(f => f.type !== 'ffu').length, w = Math.max(2, x1 - x0), d = Math.max(2, z1 - z0), H = q.H || (A && A.H) || 8;
      const k = Math.min(3.2, 0.55 + 1.9 * nL * 8 / (w * d));
      list.push({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w, d, H, k });
      // the room's light, shared out over its fixtures (same total light, from where the fixtures are)
      const KN = global.P3REAL || {}, I = k * lightGain * (w * d) / Math.max(1, nL * 8) * (KN.fxs != null ? KN.fxs : 0.75);
      for (const f of fx) if (f.type !== 'ffu') fxList.push({ x: f.x, z: f.y, w: Math.max(0.5, f.w || 2), h: Math.max(0.5, f.h || 4), H, I: Math.min(I, 14) });
    }
    if (!list.length && A && !A.empty && A.hardAny) { const b = A.bounds; list.push({ cx: b.minX + b.w / 2, cz: b.minZ + b.d / 2, w: b.w * 0.9, d: b.d * 0.9, H: A.H || 8, k: 1.2 }); }
    list.sort((a, b) => b.w * b.d - a.w * a.d).slice(0, 16).forEach(L => {
      const l = new THREE.RectAreaLight(0xfff6ea, L.k * lightGain, L.w, L.d); l.position.set(L.cx, L.H - 0.03, L.cz); l.lookAt(L.cx, 0, L.cz); roomLights.add(l);
    });
    if (fxList.length) { fxPool(); updateFx(performance.now(), true); }
  }
  function setReal(on) {
    govReset();
    real = !!on && canReal;
    const KN = global.P3REAL || {};
    if (real && !rComp) { try { THREE.RectAreaLightUniformsLib.init(); makeComposer(); } catch (e) { console.error(e); real = false; } }
    if (real && !envIn) { try { envIn = indoorEnv(); } catch (e) { envIn = null; } }
    renderer.toneMapping = real ? (KN.tm === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping) : tmOut; renderer.toneMappingExposure = real ? (KN.exp || 1) : expOut; if (rSSAO) { rSSAO.enabled = KN.ao !== false && gov.level < 3; rPlain.enabled = !rSSAO.enabled; if (KN.kr) rSSAO.kernelRadius = KN.kr; if (KN.min) rSSAO.minDistance = KN.min; if (KN.max) rSSAO.maxDistance = KN.max; }
    scene.environment = real && envIn && KN.env !== false ? envIn : envOut;
    for (const m of upCache.values()) { tuneMat(m, real); m.needsUpdate = true; }
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    // light lenses brighter than white in the realistic view, so they (and nothing else) glow
    scene.traverse(o => { const m = o.material; if (m && !Array.isArray(m) && /light lens/i.test(m.name || '') && m.color) { if (m.userData.c0 == null) m.userData.c0 = m.color.getHex(); m.color.setHex(m.userData.c0); if (real) m.color.multiplyScalar(3); } });
    const amb = KN.amb != null ? KN.amb : 0.3;
    scene.children.forEach(o => { if (o.isHemisphereLight || o.isAmbientLight) { if (o.userData.i0 == null) o.userData.i0 = o.intensity; o.intensity = o.userData.i0 * (real ? amb : 1); } });
    lightGain = KN.k != null ? KN.k : 1.1;
    placeRoomLights(); roomLights.visible = KN.lights !== false; if (rGrade) { rGrade.enabled = KN.grade !== false; const U = rGrade.uniforms; U.con.value = KN.con != null ? KN.con : 0.06; U.warm.value = KN.warm != null ? KN.warm : 0.004; U.vig.value = KN.vig != null ? KN.vig : 0.14; U.sat.value = KN.sat != null ? KN.sat : 1.04; }
    if (!real) fxGroup.children.forEach(l => { l.intensity = 0; });
    if (realBtn) realBtn.setAttribute('aria-pressed', String(real));
    try { localStorage.setItem('p3v.real', real ? '1' : '0'); } catch (e) { /* ok */ }
  }
  if (realBtn && canReal) { realBtn.hidden = false; realBtn.addEventListener('click', (e) => { e.stopPropagation(); setReal(!real); }); }

  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.09; controls.maxPolarAngle = 1.42;
  controls.minDistance = 8; controls.maxDistance = 400; controls.enabled = false;
  smartZoom(THREE, camera, controls, canvas, { objects: () => { const o = []; if (built) built.root.traverseVisible(m => { if (m.isMesh) o.push(m); }); return o; }, active: () => mode !== 'walk' && mode !== 'fly' && !tween });

  const EYE0 = 5.3, R = 0.55; let EYE = EYE0; // eye height, raised to the floor being drawn on
  const st = { x: 0, y: 5.5, z: 0, yaw: 0, pitch: -0.04 };
  let A = null, built = null, rooms = [], outside = null;
  let mode = 'walk', tween = null, target = null, stuck = 0, fov = 70, curRoom = undefined;
  const reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2c84b, transparent: true, opacity: 0.9, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.58, 40), ringMat); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 40), new THREE.MeshBasicMaterial({ color: 0xf2c84b, transparent: true, opacity: 0, depthWrite: false }));
  pulse.rotation.x = -Math.PI / 2; scene.add(pulse); let pulseT = -1;
  function showPulse(x, z) { pulse.position.set(x, 0.03, z); pulseT = 0; }

  function collides(x, z) {
    const b = A.bounds;
    if (x < b.minX - 30 || x > b.maxX + 30 || z < b.minZ - 30 || z > b.maxZ + 30) return true;
    // on a phone or tablet the walk goes straight through doors and furniture (only walls and glass stop it)
    for (const o of A.obs) if (!(touchy && o.item) && segDist(x, z, o.x1, o.z1, o.x2, o.z2) < o.r + R) return true;
    if (built && built.doorObs && !touchy) {
      for (const d of built.doorObs) {
        if (d.doorGroup && d.doorGroup.userData.isOpen) continue;
        if (segDist(x, z, d.x1, d.z1, d.x2, d.z2) < d.r + R) return true;
      }
    }
    for (const q of A.boxes) if (x > q.x0 - R && x < q.x1 + R && z > q.z0 - R && z < q.z1 + R) return true;
    return false;
  }
  function step(dx, dz) { let m = 0; if (!collides(st.x + dx, st.z)) { st.x += dx; m += Math.abs(dx); } if (!collides(st.x, st.z + dz)) { st.z += dz; m += Math.abs(dz); } return m; }
  function freeSpot(x, z) {
    if (!collides(x, z)) return { x, z };
    for (let r = 0.3; r < 5; r += 0.3) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!collides(px, pz)) return { x: px, z: pz }; }
    return { x, z };
  }
  function roomAt(x, z) {
    const b = A.bounds;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return outside;
    let best = null, bd = 1e9;
    for (const r of rooms) {
      const d = Math.hypot(r.x - x, r.y - z); if (d >= bd) continue;
      let blocked = false;
      for (const p of A.pieces) if (segCross(x, z, r.x, r.y, p.x1, p.z1, p.x2, p.z2)) { blocked = true; break; }
      if (!blocked) { best = r; bd = d; }
    }
    return best;
  }
  function applyWalkCam() { camera.position.set(st.x, EYE, st.z); camera.rotation.set(st.pitch, st.yaw, 0, 'YXZ'); }
  function walkLook() { const cp = Math.cos(st.pitch); return new THREE.Vector3(st.x - Math.sin(st.yaw) * cp * 6, EYE + Math.sin(st.pitch) * 6, st.z - Math.cos(st.yaw) * cp * 6); }
  function orbitPose(kind) {
    const b = A.bounds, vh = Math.tan(THREE.MathUtils.degToRad(45 / 2)), asp = (container.clientWidth || 1) / (container.clientHeight || 1);
    let d = Math.max(b.d * 0.62 / vh, b.w * 0.62 / (vh * asp), 30);
    const t = new THREE.Vector3(b.cx, 0, b.cz);
    // a phone or a customer viewer: fit the whole building between the buttons along the top and the room names
    // along the bottom
    if (touchy || opts.views) {
      const dir = kind === 'plan' ? new THREE.Vector3(0, 1.05, 0.0001) : new THREE.Vector3(-0.42, 0.72, 0.62), cam = new THREE.PerspectiveCamera(45, asp, 0.1, 5000), top = Math.max(A.WH || A.H || 9, 9);
      const C = []; for (const x of [b.minX, b.maxX]) for (const z of [b.minZ, b.maxZ]) for (const y of [0, top]) C.push(new THREE.Vector3(x, y, z));
      const fits = (dd) => { cam.position.copy(t).addScaledVector(dir, dd); cam.lookAt(t); cam.updateMatrixWorld(); return C.every(p => { const q = p.clone().project(cam); return q.z < 1 && Math.abs(q.x) < 0.93 && q.y > -0.72 && q.y < 0.7; }); };
      let lo = 5, hi = d * 3; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; } d = hi;
      // shift the aim down a little so the building sits in the middle of the clear band
      t.y = 0; const off = new THREE.Vector3(0, 0, 0); cam.position.copy(t).addScaledVector(dir, d); cam.lookAt(t); cam.updateMatrixWorld();
      const mid = new THREE.Vector3(0, -0.03, 0.5).unproject(cam).sub(cam.position).setLength(cam.position.distanceTo(t)).add(cam.position); off.subVectors(t, mid); t.add(off);
      if (kind === 'plan') return { pos: t.clone().add(new THREE.Vector3(0, d * 1.05, 0.01)), look: t, fov: 45 };
      return { pos: t.clone().addScaledVector(dir, d), look: t, fov: 45 };
    }
    if (kind === 'plan') return { pos: new THREE.Vector3(b.cx, d * 1.05, b.cz + 0.01), look: t, fov: 45 };
    return { pos: new THREE.Vector3(b.cx - d * 0.42, d * 0.72, b.cz + d * 0.62), look: t, fov: 45 };
  }
  // what shows in each view: Walk = everything; Dollhouse/Plan = no ceiling, lid or roof;
  // Plenum = the grid ceiling without the lid; Exterior = everything, from outside
  function applyVis(m) {
    if (!built) return;
    built.ceiling.visible = m === 'walk' || m === 'fly' || m === 'plenum' || m === 'exterior';
    if (built.lid) built.lid.visible = lidOn || m === 'walk' || m === 'exterior';
    if (lidBtn) lidBtn.hidden = !(built.lid && built.lid.children.length);
    const RS = built.removable || []; if (remBtn) remBtn.hidden = !RS.length;
    for (const r of RS) { for (const m of r.meshes) m.visible = !remOpen; r.ob.doorGroup.userData.isOpen = remOpen || r.open; }
    if (built.roof) built.roof.visible = m === 'walk' || m === 'fly' || m === 'exterior';
    // several floors: Dollhouse and the overhead view look down into the floor being edited, so the ones above it hide
    if (built.levelObjs) { const act = (plan && plan.level) || 0, cut = m === 'doll' || m === 'plan'; for (const L of built.levelObjs) for (const o of L.objs) o.visible = !cut || L.k <= act; }
  }
  function startTween(to, dur, done) {
    const from = { pos: camera.position.clone(), look: mode === 'walk' ? walkLook() : mode === 'fly' ? camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(6)) : controls.target.clone(), fov: camera.fov };
    tween = { t0: performance.now(), dur: reduce ? 1 : dur, from, to, done };
    controls.enabled = false;
  }
  function runTween(now) {
    const k = Math.min(1, (now - tween.t0) / tween.dur), e = ease(k);
    camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
    const look = new THREE.Vector3().lerpVectors(tween.from.look, tween.to.look, e);
    camera.fov = tween.from.fov + (tween.to.fov - tween.from.fov) * e; camera.updateProjectionMatrix();
    camera.lookAt(look);
    if (k >= 1) { const d = tween.done; tween = null; d && d(); }
  }
  function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  // touch screens: a joystick to walk with (push to move, further is faster; drag anywhere else to look)
  const joyEl = $('.p3v-joy'), joyKnob = joyEl.querySelector('i'), joy = { f: 0, s: 0, id: null };
  const touchy = !!opts.joystick || (global.matchMedia && global.matchMedia('(pointer: coarse)').matches);
  if (touchy) { container.classList.add('p3v-touch'); modeBtns.forEach(b => { if (b.dataset.m === 'plan') b.remove(); }); }
  const joySet = (dx, dy) => { const R = 44, d = Math.hypot(dx, dy), k = d > R ? R / d : 1; dx *= k; dy *= k; joyKnob.style.transform = `translate(${dx}px,${dy}px)`; joy.s = dx / R; joy.f = -dy / R; };
  joyEl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); const r = joyEl.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joySet(e.clientX - joy.cx, e.clientY - joy.cy); target = null; });
  joyEl.addEventListener('pointermove', (e) => { if (e.pointerId !== joy.id) return; e.preventDefault(); e.stopPropagation(); joySet(e.clientX - joy.cx, e.clientY - joy.cy); });
  const joyEnd = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joySet(0, 0); };
  joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
  function setModeUI() { modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === mode))); if (touchy) { const was = mini.hidden; mini.hidden = !(mode === 'walk' || mode === 'fly'); container.classList.toggle('p3v-orbit', !(mode === 'walk' || mode === 'fly')); if (was && !mini.hidden && A) sizeMini(); } joyEl.hidden = !(touchy && (mode === 'walk' || mode === 'fly')); if (mode !== 'fly') drone.visible = false; if (udEl) udEl.hidden = !(touchy && mode === 'fly'); if (joyEl.hidden && joy.id == null) joySet(0, 0); }
  function goWalk(x, z, yaw, dur) {
    if (walkHintLater) { walkHintLater = false; hint.textContent = walkTip; hint.classList.remove('gone'); setTimeout(() => { if (!commentMode) hint.classList.add('gone'); }, 6000); }
    const p = freeSpot(x, z); target = null;
    const to = { pos: new THREE.Vector3(p.x, EYE, p.z), look: new THREE.Vector3(p.x - Math.sin(yaw) * 6, EYE, p.z - Math.cos(yaw) * 6), fov };
    applyVis('walk'); labelsEl.hidden = true;
    startTween(to, dur || 900, () => { st.x = p.x; st.z = p.z; st.yaw = yaw; st.pitch = 0; applyWalkCam(); });
    mode = 'walk'; setModeUI();
  }
  function goOrbit(kind) {
    const pose = orbitPose(kind); target = null; applyVis(kind);
    const wasWalk = mode === 'walk';
    startTween(pose, wasWalk ? 1100 : 800, () => { controls.target.copy(pose.look); controls.enabled = true; controls.update(); labelsEl.hidden = kind === 'exterior'; });
    mode = kind; setModeUI();
  }
  modeBtns.forEach(b => b.addEventListener('click', () => {
    const m = b.dataset.m;
    if (m === 'walk') { if (mode !== 'walk' || tween) goWalk(st.x, st.z, st.yaw); }
    else if (m === 'fly') { if (mode !== 'fly') goFly(); }
    else if (m !== mode) goOrbit(m);
  }));

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(cx, cy) {
    if (!built) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const floors = built.floors || [built.floor];
    const objs = [...floors, built.ground, ...built.pick];
    const hit = ray.intersectObjects(objs, false)[0];
    if (!hit) return null;
    const p = hit.point;
    if (floors.includes(hit.object) || hit.object === built.ground) return { x: p.x, z: p.z };
    const dx = camera.position.x - p.x, dz = camera.position.z - p.z, d = Math.hypot(dx, dz) || 1;
    return { x: p.x + dx / d * 1.0, z: p.z + dz / d * 1.0 };
  }

  // removable wall sections: a click takes the panels out (they come toward you and float to the side of the
  // opening), a second click puts them back
  const remRay = new THREE.Raycaster();
  function checkRemClick(clientX, clientY) {
    const RS = built && built.removable; if (!RS || !RS.length) return false;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    remRay.setFromCamera(ndc, camera);
    const all = []; for (const q of RS) for (const m of q.meshes) if (m.visible) all.push(m);
    const hit = remRay.intersectObjects(all, false)[0]; if (!hit) return false;
    // something else (a wall, a door) in front of it takes the click
    const other = remRay.intersectObjects(built.pick.filter(m => !all.includes(m)), false)[0];
    if (other && other.distance < hit.distance - 0.05) return false;
    const q = RS.find(x => x.meshes.includes(hit.object)); if (!q) return false;
    q.open = !q.open;
    if (q.open) { const mx = (q.o.x1 + q.o.x2) / 2, mz = (q.o.y1 + q.o.y2) / 2; q.side = ((camera.position.x - mx) * q.nx + (camera.position.z - mz) * q.nz) >= 0 ? 1 : -1; }
    q.ob.doorGroup.userData.isOpen = q.open || remOpen;
    return true;
  }
  function stepRemovable(dt) {
    const RS = built && built.removable; if (!RS) return;
    const now = performance.now() / 1000, ease = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x), back = (x) => { if (x <= 0) return 0; if (x >= 1) return 1; const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
    for (const q of RS) {
      const goal = q.open ? 1 : 0; if (Math.abs(goal - q.k) < 0.0005 && !q.open) { if (q.k !== goal) { q.k = goal; q.home.forEach((h, j) => { q.meshes[j].position.copy(h.p); q.meshes[j].rotation.y = h.ry; }); } continue; }
      q.k += Math.sign(goal - q.k) * Math.min(Math.abs(goal - q.k), dt / 1.4);
      // the pieces left of the middle go out past the start of the opening, the rest past its end; the one nearest
      // each end leaves first and floats farthest out, so they fan out in layers
      const L = [], R = []; q.home.forEach((h, j) => (h.s < q.len / 2 ? L : R).push(j));
      L.sort((a, b) => q.home[a].s - q.home[b].s); R.sort((a, b) => q.home[b].s - q.home[a].s);
      for (const [grp, dir] of [[L, -1], [R, 1]]) grp.forEach((j, n) => {
        const h = q.home[j], m = q.meshes[j], d = n * 0.12, a = back(Math.min(1, Math.max(0, (q.k - d) / 0.35))), b = ease((q.k - 0.3 - d) / 0.6);
        const out = q.side * (q.t / 2 + 1.1 + n * 0.55) * a, sFin = dir < 0 ? -(h.w / 2 + 0.6 + n * 0.25) : q.len + h.w / 2 + 0.6 + n * 0.25, ds = (sFin - h.s) * b;
        const lift = (0.35 + Math.sin(now * 1.7 + j * 1.3) * 0.07) * b;
        m.position.set(h.p.x + q.nx * out + q.ux * ds, h.p.y + lift, h.p.z + q.nz * out + q.uz * ds);
        m.rotation.y = h.ry + dir * q.side * 0.14 * b;
      });
    }
  }
  const doorRay = new THREE.Raycaster();
  function checkDoorClick(clientX, clientY) {
    if (!built || !built.doors || !built.doors.length) return false;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    doorRay.setFromCamera(ndc, camera);
    const hits = doorRay.intersectObjects(built.doors, true);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && obj !== scene) {
        if (obj.userData && obj.userData.isDoor) {
          obj.userData.isOpen = !obj.userData.isOpen;
          return true;
        }
        obj = obj.parent;
      }
    }
    return false;
  }

  // ---- The surprise filter: one FFU marked "Surprise" in the app looks like every other filter, until someone
  // clicks it: a fart, and a cloud of green gas pushed down out of the filter that drifts and slowly thins away.
  const gasRay = new THREE.Raycaster(), gas = [];
  let gasTex = null;
  function gasTexture() {
    if (gasTex) return gasTex;
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    for (let k = 0; k < 7; k++) { // a lumpy, soft puff
      const x = 64 + (Math.random() - 0.5) * 34, y = 64 + (Math.random() - 0.5) * 34, r = 26 + Math.random() * 22, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    gasTex = new THREE.CanvasTexture(c); return gasTex;
  }
  let fartAC = null;
  function fartSound() {
    try {
      const AC = global.AudioContext || global.webkitAudioContext; if (!AC) return;
      const ac = fartAC || (fartAC = new AC()); if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime + 0.02, dur = 1.0 + Math.random() * 0.7, f0 = 85 + Math.random() * 35;
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + dur);
      const wob = ac.createOscillator(), wg = ac.createGain(); wob.frequency.value = 18 + Math.random() * 8; wg.gain.value = f0 * 0.3; wob.connect(wg); wg.connect(o.frequency);
      const nb = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const n = ac.createBufferSource(); n.buffer = nb; const nf = ac.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 160; nf.Q.value = 0.9; const ng = ac.createGain(); ng.gain.value = 0.5;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 7; lp.frequency.setValueAtTime(1000, t); lp.frequency.exponentialRampToValueAtTime(300, t + dur);
      const flut = ac.createGain(); flut.gain.value = 0.7; const am = ac.createOscillator(), amg = ac.createGain(); am.frequency.setValueAtTime(16, t); am.frequency.linearRampToValueAtTime(6, t + dur); amg.gain.value = 0.3; am.connect(amg); amg.connect(flut.gain);
      const env = ac.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.9, t + 0.03); env.gain.setValueAtTime(0.9, t + dur * 0.6); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); n.connect(nf); nf.connect(ng); ng.connect(lp); lp.connect(flut); flut.connect(env); env.connect(ac.destination);
      for (const src of [o, wob, n, am]) { src.start(t); src.stop(t + dur + 0.05); }
    } catch (e) { /* no sound here */ }
  }
  function releaseGas(at) {
    const tex = gasTexture();
    for (let k = 0; k < 46; k++) {
      const m = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color().setHSL(0.24 + Math.random() * 0.06, 0.85, 0.42 + Math.random() * 0.12), transparent: true, opacity: 0, depthWrite: false });
      m.toneMapped = false;
      const sp = new THREE.Sprite(m), a = Math.random() * Math.PI * 2, out = 0.6 + Math.random() * 2.2;
      sp.position.set(at.x + (Math.random() - 0.5) * 1.5, at.y - 0.3, at.z + (Math.random() - 0.5) * 3);
      sp.userData.gas = { delay: Math.random() * 1.4, t: 0, life: 9 + Math.random() * 7, vx: Math.cos(a) * out, vz: Math.sin(a) * out, vy: -(2.5 + Math.random() * 3), s0: 0.6 + Math.random() * 0.6, s1: 5 + Math.random() * 5, spin: (Math.random() - 0.5) * 0.4, floor: at.y - 30 };
      sp.scale.setScalar(0.01); sp.renderOrder = 5;
      scene.add(sp); gas.push(sp);
    }
    fartSound();
  }
  function stepGas(dt) {
    for (let i = gas.length - 1; i >= 0; i--) {
      const sp = gas[i], q = sp.userData.gas;
      if (q.delay > 0) { q.delay -= dt; continue; }
      q.t += dt; const k = q.t / q.life;
      if (k >= 1) { scene.remove(sp); sp.material.dispose(); gas.splice(i, 1); continue; }
      const drag = Math.exp(-1.1 * dt); q.vx *= drag; q.vz *= drag; q.vy = q.vy * drag + 0.12 * dt; // pushed down, then hangs and slowly rises
      sp.position.x += q.vx * dt; sp.position.y += q.vy * dt; sp.position.z += q.vz * dt;
      sp.scale.setScalar(q.s0 + (q.s1 - q.s0) * (1 - Math.pow(1 - k, 2.2)));
      sp.material.rotation += q.spin * dt;
      sp.material.opacity = (k < 0.06 ? k / 0.06 : Math.pow(1 - (k - 0.06) / 0.94, 1.6)) * 0.62;
    }
  }
  function checkSurpriseClick(clientX, clientY) {
    if (!built || !plan) return false;
    const ids = new Set((plan.fixtures || []).filter(f => f && f.surprise && f.id).map(f => f.id));
    for (const L of plan.levels || []) for (const f of (L && L.fixtures) || []) if (f && f.surprise && f.id) ids.add(f.id);
    if (!ids.size) return false;
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    gasRay.setFromCamera(ndc, camera);
    const seen = (o) => { for (let p = o; p; p = p.parent) if (!p.visible || (p.userData && p.userData.airflow)) return false; return true; }; // airflow arrows don't block it
    const hit = gasRay.intersectObject(built.root, true).find(h => h.object.isMesh && seen(h.object));
    if (!hit) return false;
    for (let o = hit.object; o; o = o.parent) { const ref = o.userData && o.userData.ref; if (ref) { if (ref.kind === 'fixture' && ids.has(ref.id)) { releaseGas(hit.point); return true; } return false; } }
    return false;
  }

  // ---- Guided tour: walk the people route (plan.flows.people), stopping in each room with its name and class
  const tourBtn = $('.p3v-tour'), capEl = $('.p3v-cap');
  let tour = null;
  function refreshTour() { let FR = null; try { FR = plan && flowRoutes(plan); } catch (e) { FR = null; } tourBtn.hidden = !(FR && FR.people); return FR; }
  function caption(r, q) {
    if (!r) { capEl.hidden = true; return; }
    const T = r.crType && ROOM_TYPES[r.crType], bits = [];
    if (T) bits.push(T.label); if (r.iso) bits.push('ISO ' + r.iso); if (r.pressure != null && r.pressure !== '') bits.push((r.pressure > 0 ? '+' : '') + r.pressure + ' Pa (' + (r.pressure * PA_TO_INWC).toFixed(3) + '″ w.c.)'); if (q && q.ach) bits.push(Math.round(q.ach) + ' air changes/hr');
    capEl.innerHTML = '<b>' + String(r.name || 'Room').replace(/[&<>]/g, '') + '</b><span>' + bits.join(' · ') + '</span>'; capEl.hidden = false;
  }
  function stopTour() { if (!tour) return; tour = null; capEl.hidden = true; tourBtn.textContent = '▶ Gowning tour'; }
  function startTour() {
    const FR = refreshTour(); if (!FR || !FR.people) return;
    const P = FR.people, q0 = (r) => FR.check.rooms.find(x => x.room === r);
    const [x0, z0] = P.pts[0], [x1, z1] = P.pts[1];
    goWalk(x0, z0, Math.atan2(-(x1 - x0), -(z1 - z0)), 600);
    tour = { P, i: 0, t: 0, pause: 1.6, q0, stopAt: new Map(P.stops.map(s2 => [s2.at, s2.room])) };
    caption(P.stops[0] && P.stops[0].at === 0 ? P.stops[0].room : null, P.stops[0] && q0(P.stops[0].room));
    tourBtn.textContent = '■ Stop tour';
  }
  function stepTour(dt) {
    const T = tour; if (!T || tween) return;
    if (T.pause > 0) { T.pause -= dt; if (T.pause <= 0 && T.i >= T.P.pts.length - 1) { stopTour(); } return; }
    const [x1, z1] = T.P.pts[T.i], [x2, z2] = T.P.pts[T.i + 1], L = Math.hypot(x2 - x1, z2 - z1) || 0.01;
    T.t += dt * 3.2 / L; const k = Math.min(1, T.t);
    st.x = x1 + (x2 - x1) * k; st.z = z1 + (z2 - z1) * k;
    // face the way it's walking, turning smoothly
    let want = Math.atan2(-(x2 - x1), -(z2 - z1)), dy = want - st.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; st.yaw += dy * Math.min(1, dt * 4); st.pitch += (-0.04 - st.pitch) * Math.min(1, dt * 3);
    // doors open ahead of the tour
    if (built && built.doors) for (const dg of built.doors) { const p2 = dg.getWorldPosition ? dg.getWorldPosition(new THREE.Vector3()) : dg.position; if (Math.hypot(p2.x - st.x, p2.z - st.z) < 5 && dg.userData) dg.userData.isOpen = true; }
    if (k >= 1) { T.i++; T.t = 0; const r = T.stopAt.get(T.i); if (r) { caption(r, T.q0(r)); T.pause = 2.6; } else if (T.i >= T.P.pts.length - 1) T.pause = 1.5; }
  }
  tourBtn.addEventListener('click', (e) => { e.stopPropagation(); if (tour) stopTour(); else startTour(); });

  // ---- Fly: a free camera that goes anywhere (through walls, into the plenum, outside and over the top).
  // W / S forward and back, A / D slide (always level), arrow keys aim the camera, Space / R up, C / F down,
  // Shift faster; drag (or Mouse look) to look; on a phone the joystick flies and ▲ ▼ go up and down.
  const udEl = $('.p3v-ud'); let flyUD = 0;
  udEl.querySelectorAll('button').forEach(b => { const v = +b.dataset.ud; b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); flyUD = v; }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => { flyUD = 0; }); });
  // the drone: a small quadcopter you steer; the view follows a few feet behind it (V: look through its camera)
  const drone = new THREE.Group(); drone.visible = false; scene.add(drone);
  {
    // a sleek stealth-black quadcopter: rounded shell, carbon arms, chrome motor bells, prop blur discs, a gimbal
    // camera under the nose, nav lights, and AREA 51 on both sides
    const ph = (c, sp, sh, ex) => new THREE.MeshPhongMaterial(Object.assign({ color: c, specular: sp, shininess: sh }, ex || {}));
    const shell = ph(0x1b1f24, 0x8a96a3, 90), carbon = ph(0x2a2e33, 0x444444, 30), chrome = ph(0xb9c2c8, 0xffffff, 140), accent = ph(0x39ff88, 0x39ff88, 60, { emissive: 0x0f5a2c });
    const glass = ph(0x061018, 0xffffff, 160), blur = new THREE.MeshBasicMaterial({ color: 0xb8c4ca, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    const add = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); drone.add(m); return m; };
    // body: a flattened ellipsoid with a raised canopy and a bright stripe round the waist
    add(new THREE.BoxGeometry(0.44, 0.15, 0.56), shell, 0, 0, 0);
    add(new THREE.SphereGeometry(0.22, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), shell, 0, 0.07, 0, 0.92, 0.38, 1.25);
    add(new THREE.SphereGeometry(0.22, 32, 16), shell, 0, 0, -0.28, 0.86, 0.34, 0.5);
    add(new THREE.SphereGeometry(0.22, 32, 16), shell, 0, 0, 0.28, 0.86, 0.34, 0.4);
    add(new THREE.SphereGeometry(0.13, 28, 14), glass, 0, 0.1, -0.12, 1, 0.45, 1.4);
    for (const sd of [1, -1]) add(new THREE.BoxGeometry(0.006, 0.012, 0.6), accent, sd * 0.222, -0.06, 0);
    drone.userData.props = [];
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ax = sx * 0.5, az = sz * 0.46, L = Math.hypot(ax, az);
      const arm = add(new THREE.BoxGeometry(0.055, 0.035, L), carbon, ax / 2, 0.01, az / 2); arm.rotation.y = Math.atan2(ax, az);
      add(new THREE.CylinderGeometry(0.055, 0.06, 0.07, 20), chrome, ax, 0.04, az);
      add(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), carbon, ax, 0.09, az);
      const disc = add(new THREE.CircleGeometry(0.25, 36), blur, ax, 0.1, az); disc.rotation.x = -Math.PI / 2;
      const ring = add(new THREE.TorusGeometry(0.25, 0.004, 4, 48), accent, ax, 0.1, az); ring.rotation.x = Math.PI / 2; ring.material = blur;
      const blade = add(new THREE.BoxGeometry(0.48, 0.006, 0.035), carbon, ax, 0.1, az); drone.userData.props.push(blade);
      // landing skid under each arm
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.15, 8), carbon, ax * 0.42, -0.12, az * 0.42);
    }
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), carbon, 0.13, -0.19, 0).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8), carbon, -0.13, -0.19, 0).rotation.x = Math.PI / 2;
    // gimbal camera under the nose
    add(new THREE.BoxGeometry(0.1, 0.05, 0.06), carbon, 0, -0.08, -0.3);
    add(new THREE.SphereGeometry(0.065, 20, 14), shell, 0, -0.13, -0.32);
    const lens = add(new THREE.CircleGeometry(0.035, 20), glass, 0, -0.13, -0.386); lens.rotation.y = Math.PI;
    add(new THREE.TorusGeometry(0.037, 0.006, 6, 24), chrome, 0, -0.13, -0.384);
    // nav lights: green right, red left, white strobe at the tail
    add(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: 0x35e06a }), 0.5, 0.02, -0.46);
    add(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), -0.5, 0.02, -0.46);
    drone.userData.strobe = add(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0, 0.05, 0.35);
    // AREA 51 decals on both sides
    const dc = document.createElement('canvas'); dc.width = 512; dc.height = 160; const g = dc.getContext('2d');
    g.clearRect(0, 0, 512, 160);
    g.fillStyle = 'rgba(57,255,136,0.9)'; g.fillRect(8, 128, 496, 6);
    // a little flying saucer badge
    g.save(); g.translate(70, 70); g.fillStyle = '#39ff88'; g.beginPath(); g.ellipse(0, 6, 54, 16, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9ffe0'; g.beginPath(); g.ellipse(0, -6, 24, 20, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#0d1a12'; for (const x of [-30, -10, 10, 30]) { g.beginPath(); g.arc(x, 8, 4, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(57,255,136,0.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, 22); g.lineTo(-34, 54); g.moveTo(18, 22); g.lineTo(34, 54); g.stroke(); g.restore();
    g.fillStyle = '#ffffff'; g.font = '900 86px Impact, "Arial Black", sans-serif'; g.textBaseline = 'middle'; g.fillText('AREA 51', 140, 66);
    g.fillStyle = 'rgba(200,255,225,0.85)'; g.font = '700 22px Consolas, monospace'; g.fillText('RESTRICTED AIRSPACE', 144, 112);
    const tex = new THREE.CanvasTexture(dc); tex.anisotropy = 4;
    const dm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.FrontSide });
    for (const sd of [1, -1]) { const d = add(new THREE.PlaneGeometry(0.4, 0.125), dm, sd * 0.2225, 0.005, 0); d.lookAt(sd * 2, 0.005, 0); d.renderOrder = 5; }
    drone.traverse(o => { if (o.renderOrder < 4) o.renderOrder = 4; });
  }
  let pilot = false, droneTilt = 0, droneRoll = 0, propSpin = 0, flyBoost = 1, game = null;
  const camOff = new THREE.Vector3(); let camYaw = null, camYawT = 0;
  function applyFlyCam() {
    const chase = mode === 'fly' && !pilot && !tween;
    drone.visible = chase;
    drone.position.set(st.x, st.y, st.z); drone.rotation.set(droneTilt, st.yaw, droneRoll, 'YXZ');
    if (!chase) { camera.position.set(st.x, st.y, st.z); camera.rotation.set(st.pitch, st.yaw, 0, 'YXZ'); return; }
    // always the same spot: 3.2 ft behind the drone and a foot above it, facing the way the drone faces. Looking
    // up or down only tilts the camera there; it never swings round the drone.
    camOff.set(Math.sin(st.yaw) * 3.2, 0.95, Math.cos(st.yaw) * 3.2);
    camera.position.set(st.x + camOff.x, st.y + camOff.y, st.z + camOff.z); camera.rotation.set(st.pitch - 0.16, st.yaw, 0, 'YXZ');
  }
  function poseFromCamera() { const d = camera.getWorldDirection(new THREE.Vector3()); return { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: Math.atan2(-d.x, -d.z), pitch: Math.max(-1.3, Math.min(1.3, Math.asin(Math.max(-1, Math.min(1, d.y))))) }; }
  function goFly() {
    if (tween) return;
    stopTour(); Object.assign(st, poseFromCamera()); target = null; pilot = false; camYaw = null;
    { const cp = Math.cos(st.pitch); st.x -= Math.sin(st.yaw) * cp * 3.2; st.z -= Math.cos(st.yaw) * cp * 3.2; st.y = Math.max(1.5, st.y - 0.95 + Math.sin(st.pitch) * 3.2); }
    controls.enabled = false; labelsEl.hidden = true; mode = 'fly';
    applyVis('fly'); setModeUI(); applyFlyCam();
    hint.textContent = touchy ? 'Drone: joystick flies the way it looks · ▲ ▼ up and down · drag to look' : 'Drone: W forward · S back · A / D slide · arrows aim the camera · Space / R up · C / F down · Shift faster · V drone camera · M measure · P snapshot';
    hint.classList.remove('gone'); hintGone = false; setTimeout(dismissHint, 6000);
  }
  // fly to a saved pose (a snapshot's camera)
  function flyTo(c) {
    if (!c || !A) return;
    stopTour(); target = null; labelsEl.hidden = true; applyVis('fly');
    const pos = new THREE.Vector3(c.x, c.y, c.z), cp = Math.cos(c.pitch || 0), look = pos.clone().add(new THREE.Vector3(-Math.sin(c.yaw || 0) * cp * 6, Math.sin(c.pitch || 0) * 6, -Math.cos(c.yaw || 0) * cp * 6));
    startTween({ pos, look, fov: c.fov || fov }, 900, () => { st.x = c.x; st.y = c.y; st.z = c.z; st.yaw = c.yaw || 0; st.pitch = c.pitch || 0; pilot = true; applyFlyCam(); });
    mode = 'fly'; setModeUI();
  }
  // ↑ ↓ tilt the view up and down (the camera only: walking and flying stay level)
  function lookKeys(dt) { let v = 0; if (keys.has('arrowup')) v += 1; if (keys.has('arrowdown')) v -= 1; if (v) st.pitch = Math.max(-1.25, Math.min(1.25, st.pitch + v * 1.1 * dt)); }
  function flyStep(dt) {
    let f = 0, s2 = 0, u = 0, turn = 0;
    if (keys.has('w')) f += 1; if (keys.has('s')) f -= 1;
    if (keys.has('d')) s2 += 1; if (keys.has('a')) s2 -= 1;
    lookKeys(dt);
    if (keys.has(' ') || keys.has('r')) u += 1; if (keys.has('c') || keys.has('f')) u -= 1;
    if (keys.has('arrowleft') || keys.has('q')) turn += 1; if (keys.has('arrowright') || keys.has('e')) turn -= 1;
    if (turn) { turnHeld = Math.min(1, turnHeld + dt * 2.5); st.yaw += turn * (1.4 + 1.4 * turnHeld) * dt; } else turnHeld = 0;
    if (joy.id != null && Math.hypot(joy.f, joy.s) > 0.12) { f += joy.f; s2 += joy.s; }
    u += flyUD;
    const sp = (running || keys.has('shift') ? 26 : 9) * dt * flyBoost, cp = Math.cos(st.pitch);
    void cp; const vx = -Math.sin(st.yaw) * f + Math.cos(st.yaw) * s2, vy = u, vz = -Math.cos(st.yaw) * f - Math.sin(st.yaw) * s2, n = Math.hypot(vx, vy, vz);
    if (n > 1e-4) { const k = sp * Math.min(1, n) / n; st.x += vx * k; st.y += vy * k; st.z += vz * k; }
    // leans into the way it's flying; props always spinning
    const lean = Math.min(1, Math.abs(f)) * Math.sign(f) * (running || keys.has('shift') ? 0.32 : 0.2), roll = -Math.max(-1, Math.min(1, s2 + turn * 0.6)) * 0.22;
    droneTilt += (-lean - droneTilt) * Math.min(1, dt * 5); droneRoll += (roll - droneRoll) * Math.min(1, dt * 5);
    propSpin += dt * 60; drone.userData.props.forEach((b, i) => { b.rotation.y = propSpin * (i % 2 ? 1 : -1); });
    if (drone.userData.strobe) drone.userData.strobe.visible = (propSpin % 60) < 4;
    drone.position.y = st.y + Math.sin(propSpin * 0.05) * 0.02;
    const b = A.bounds; st.x = Math.max(b.minX - 120, Math.min(b.maxX + 120, st.x)); st.z = Math.max(b.minZ - 120, Math.min(b.maxZ + 120, st.z)); st.y = Math.max(0.3, Math.min(150, st.y));
    applyFlyCam();
  }

  // ---- Measure: click two points for the distance between them (snaps to corners within 3″); pointing at
  // anything shows its size. Measurements stay until Clear; they show on snapshots too.
  const measBtn = $('.p3v-meas'), mClearBtn = $('.p3v-mclear'), mLabels = $('.p3v-mlabels'), mHover = $('.p3v-mhover');
  const mGroup = new THREE.Group(); mGroup.renderOrder = 20; scene.add(mGroup);
  const mLine = new THREE.LineBasicMaterial({ color: 0xff9a1f, depthTest: false, transparent: true }), mDot = new THREE.MeshBasicMaterial({ color: 0xff9a1f, depthTest: false, transparent: true }), mDotG = new THREE.SphereGeometry(0.08, 12, 8);
  let measureOn = false, mPending = null, mRubber = null, mLast = 0;
  const meas = [];
  const fIn = (v) => fmtFt(Math.abs(v));
  function mLabelHTML(a, b) {
    const d = a.distanceTo(b), dh = Math.hypot(b.x - a.x, b.z - a.z), dv = Math.abs(b.y - a.y);
    return fIn(d) + (dh > 0.04 && dv > 0.04 ? `<small>↔ ${fIn(dh)} · ↕ ${fIn(dv)}</small>` : '');
  }
  function dotAt(p) { const m = new THREE.Mesh(mDotG, mDot); m.position.copy(p); m.renderOrder = 21; mGroup.add(m); return m; }
  function lineOf(a, b) { const g = new THREE.BufferGeometry().setFromPoints([a, b]), l = new THREE.Line(g, mLine); l.renderOrder = 21; mGroup.add(l); return l; }
  function setMeasure(on) { measureOn = on; measBtn.setAttribute('aria-pressed', String(on)); if (!on) { cancelPending(); mHover.hidden = true; mSnapDot.visible = false; } canvas.style.cursor = on ? 'crosshair' : ''; if (on) dismissHint(); }
  function cancelPending() { if (!mPending) return; mGroup.remove(mPending.dot); if (mRubber) { mGroup.remove(mRubber.line); mRubber.el.remove(); mRubber = null; } mPending = null; }
  function refreshClear() { mClearBtn.hidden = !meas.length; }
  measBtn.addEventListener('click', (e) => { e.stopPropagation(); setMeasure(!measureOn); });
  // a customer viewer (shared link, phone, exported file) has no measuring tool
  if (opts.measure === false) { measBtn.hidden = true; measBtn.remove(); mClearBtn.hidden = true; }
  mClearBtn.addEventListener('click', (e) => { e.stopPropagation(); cancelPending(); for (const m of meas) { mGroup.remove(m.line, m.da, m.db); m.el.remove(); } meas.length = 0; refreshClear(); });
  const mRay = new THREE.Raycaster();
  function surfaceAt(cx, cy) {
    if (!built) return null;
    const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); mRay.setFromCamera(ndc, camera);
    const seen = (o) => { for (let q = o; q; q = q.parent) if (!q.visible || (q.userData && q.userData.airflow)) return false; return true; };
    return mRay.intersectObject(built.root, true).find(h => h.object.isMesh && !h.object.isSprite && seen(h.object)) || null;
  }
  // what's under the pointer: the whole piece it belongs to (everything sharing its plan reference)
  function pieceOf(o) {
    let top = null, ref = null;
    for (let q = o; q && q !== built.root; q = q.parent) { const r2 = q.userData && q.userData.ref; if (r2 && (!ref || (r2.kind === ref.kind && r2.id === ref.id))) { ref = r2; top = q; } else if (ref) break; }
    return top ? { obj: top, ref } : { obj: o, ref: null };
  }
  const KIND_NAMES = { wall: 'Wall', fixture: 'Ceiling fixture', item: 'Item', device: 'Device', chase: 'Air chase', opening: 'Door', beam: 'Beam', column: 'Column', grille: 'Grille', deck: 'Lid' };
  // a name for what was hit: the piece's kind (an FFU, a light), else by where it is and which way it faces
  function surfaceName(hit, pc) {
    const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0), y = hit.point.y, H0 = (A && A.H) || 9;
    if (pc.ref) {
      if (pc.ref.kind === 'fixture') { const f = ((plan && plan.fixtures) || []).find(q => q.id === pc.ref.id); return f && f.type === 'ffu' ? 'FFU' : 'Light'; }
      if (pc.ref.kind === 'wall') return Math.abs(n.y) > 0.7 ? 'Top of wall' : 'Wall face';
      return KIND_NAMES[pc.ref.kind] || 'Item';
    }
    if (n.y > 0.7 && y < 0.15) return 'Floor';
    if (n.y < -0.7 && Math.abs(y - H0) < 0.3) return 'Ceiling tile';
    if (Math.abs(y - H0) < 0.25) return 'Ceiling grid';
    if (n.y > 0.7 && y > H0 + 0.3) return 'Top';
    return Math.abs(n.y) < 0.3 ? 'Face' : n.y > 0 ? 'Top surface' : 'Underside';
  }
  const scr = new THREE.Vector3();
  function toScreen(p) { scr.copy(p).project(camera); const r = canvas.getBoundingClientRect(); return scr.z > 1 ? null : { x: r.left + (scr.x * 0.5 + 0.5) * r.width, y: r.top + (-scr.y * 0.5 + 0.5) * r.height }; }
  // Smart snap: the point under the pointer, pulled to the nearest corner or edge of what it's on, or to the
  // top (highest point) or bottom of the piece, when that's within a few pixels on screen; floors snap to
  // the floor level exactly. Shift keeps the second point straight above or below the first, Ctrl / Alt keeps
  // it level with the first.
  function smartSnap(cx, cy, ev) {
    const hit = surfaceAt(cx, cy); if (!hit) return null;
    const pc = pieceOf(hit.object), name = surfaceName(hit, pc);
    let best = { p: hit.point.clone(), label: name, d: 0, pri: 0 };
    if (name === 'Floor') best.p.y = 0;
    const consider = (p, label, pri, px) => { const s2 = toScreen(p); if (!s2) return; const d = Math.hypot(s2.x - cx, s2.y - cy); if (d <= px && (pri > best.pri || (pri === best.pri && d < best.d))) best = { p: p.clone(), label, d, pri }; };
    // the hit mesh's own box: its 8 corners and the nearest point on each of its 12 edges
    const g = hit.object.geometry; if (g) { if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox, M2 = hit.object.matrixWorld;
      const C = []; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) C.push(new THREE.Vector3(x, y, z).applyMatrix4(M2));
      C.forEach(c => consider(c, 'Corner · ' + name, 3, 16));
      const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], seg = new THREE.Line3(), q = new THREE.Vector3();
      for (const [a, b] of E) { seg.set(C[a], C[b]); seg.closestPointToPoint(hit.point, true, q); consider(q, 'Edge · ' + name, 2, 10); }
    }
    // the whole piece: its highest point and its bottom, right above / below where you're pointing (and its
    // top centre), so "top of the FFU" is one click
    if (pc.obj) { const box = new THREE.Box3().setFromObject(pc.obj);
      if (isFinite(box.max.y)) {
        const cxz = (y) => new THREE.Vector3(Math.max(box.min.x, Math.min(box.max.x, hit.point.x)), y, Math.max(box.min.z, Math.min(box.max.z, hit.point.z)));
        const ctr = box.getCenter(new THREE.Vector3());
        consider(cxz(box.max.y), 'Highest point · ' + name, 2, 26); consider(new THREE.Vector3(ctr.x, box.max.y, ctr.z), 'Top centre · ' + name, 3, 22);
        if (box.min.y > 0.05) consider(cxz(box.min.y), 'Bottom · ' + name, 2, 22);
      }
    }
    // axis locks for the second point
    if (mPending && ev) {
      const a = mPending.p;
      if (ev.shiftKey) { best.p.set(a.x, best.p.y, a.z); best.label = '↕ Straight up / down'; }
      else if (ev.ctrlKey || ev.altKey) { best.p.y = a.y; best.label = '↔ Level'; }
    }
    return best;
  }
  const mSnapDot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.95 })); mSnapDot.renderOrder = 22; mSnapDot.visible = false; mGroup.add(mSnapDot);
  function measureHover(cx, cy, ev) {
    const now = performance.now(); if (now - mLast < 50) return; mLast = now;
    const r = canvas.getBoundingClientRect(), sn = smartSnap(cx, cy, ev);
    if (!sn) { mHover.hidden = true; mSnapDot.visible = false; return; }
    mSnapDot.position.copy(sn.p); mSnapDot.visible = true; mSnapDot.material.color.set(sn.pri >= 2 ? 0x39ff88 : 0xffffff);
    let html = `<b>${sn.label}</b>`;
    if (mPending) {
      if (!mRubber) { mRubber = { line: lineOf(mPending.p, sn.p), el: document.createElement('div') }; mRubber.el.className = 'p3v-mlab'; mRubber.el.style.opacity = '0.85'; mLabels.appendChild(mRubber.el); }
      mRubber.line.geometry.setFromPoints([mPending.p, sn.p]); mRubber.b = sn.p; mRubber.el.innerHTML = mLabelHTML(mPending.p, sn.p);
      html += `<br><span style="opacity:.75">click to finish · Shift straight up/down · Ctrl level · Esc cancel</span>`;
    } else {
      const hit = surfaceAt(cx, cy), pc = hit ? pieceOf(hit.object) : null;
      if (pc && pc.obj) { const box = new THREE.Box3().setFromObject(pc.obj), sz = box.getSize(new THREE.Vector3()); html += `<br>${fIn(Math.max(sz.x, sz.z))} × ${fIn(Math.min(sz.x, sz.z))} × ${fIn(sz.y)} high · top at ${fIn(Math.max(0, box.max.y))}`; }
      html += `<br><span style="opacity:.75">height here ${fIn(Math.max(0, sn.p.y))} · click to start measuring</span>`;
    }
    mHover.innerHTML = html; mHover.style.left = (cx - r.left) + 'px'; mHover.style.top = (cy - r.top) + 'px'; mHover.hidden = false;
    // keep the tip clear of the measurement being drawn (and the other measurement labels): try below-right of the
    // pointer, then below-left, above-right, above-left
    const labs = [...mLabels.children].map(e => e.getBoundingClientRect()).filter(q => q.width);
    const W = mHover.offsetWidth, Hh = mHover.offsetHeight, G = 14, cw = r.width, ch = r.height;
    const spots = [[G, G], [-W - G, G], [G, -Hh - G], [-W - G, -Hh - G]];
    let pick = spots[0], best = 1e18;
    for (const [dx, dy] of spots) {
      const x0 = cx + dx, y0 = cy + dy, x1 = x0 + W, y1 = y0 + Hh;
      let over = 0; for (const q of labs) over += Math.max(0, Math.min(x1, q.right) - Math.max(x0, q.left)) * Math.max(0, Math.min(y1, q.bottom) - Math.max(y0, q.top));
      const off = Math.max(0, r.left - x0) + Math.max(0, x1 - r.left - cw) + Math.max(0, r.top - y0) + Math.max(0, y1 - r.top - ch);
      const sc = over + off * 400; if (sc < best - 1e-6) { best = sc; pick = [dx, dy]; }
    }
    mHover.style.transform = 'translate(' + pick[0] + 'px,' + pick[1] + 'px)';
  }
  function measureClick(cx, cy, ev) {
    const sn = smartSnap(cx, cy, ev); if (!sn) return;
    const p = sn.p;
    if (!mPending) { mPending = { p, dot: dotAt(p) }; return; }
    if (p.distanceTo(mPending.p) < 0.01) return;
    const a = mPending.p, el = document.createElement('div'); el.className = 'p3v-mlab'; el.innerHTML = mLabelHTML(a, p); mLabels.appendChild(el);
    meas.push({ a, b: p, line: lineOf(a, p), da: mPending.dot, db: dotAt(p), el });
    if (mRubber) { mGroup.remove(mRubber.line); mRubber.el.remove(); mRubber = null; }
    mPending = null; refreshClear();
  }
  const mTmp = new THREE.Vector3();
  function placeLabel(el, a, b) {
    mTmp.copy(a).add(b).multiplyScalar(0.5).project(camera);
    if (mTmp.z > 1) { el.style.display = 'none'; return; }
    el.style.display = ''; el.style.left = ((mTmp.x * 0.5 + 0.5) * container.clientWidth) + 'px'; el.style.top = ((-mTmp.y * 0.5 + 0.5) * container.clientHeight) + 'px';
  }
  function updateMeasureLabels() { for (const m of meas) placeLabel(m.el, m.a, m.b); if (mRubber && mPending && mRubber.b) placeLabel(mRubber.el, mPending.p, mRubber.b); }

  // ---- Snapshot: a picture of this view (with the measurements on it) and a note, saved with the plan in the
  // app (opts.onSnapshot), or downloaded as a picture in a walkthrough or the phone viewer.
  const snapBtn = $('.p3v-snap'), snapDlg = $('.p3v-snapdlg');
  let snapPending = null;
  function takeSnapshot() {
    if (!built || tween || !snapDlg.hidden) return;
    // with the drone out, the picture is what its camera sees (not the drone from behind)
    const viaDrone = mode === 'fly' && !pilot; if (viaDrone) { pilot = true; applyFlyCam(); }
    try { renderer.render(scene, camera); } catch (e) { /* draw what's there */ }
    const W0 = canvas.width, H0 = canvas.height, k = Math.min(1, 1600 / W0), c2 = document.createElement('canvas'); c2.width = Math.round(W0 * k); c2.height = Math.round(H0 * k);
    const g = c2.getContext('2d'); g.drawImage(canvas, 0, 0, c2.width, c2.height);
    // the measurement labels, drawn onto the picture
    const sx = c2.width / container.clientWidth, sy = c2.height / container.clientHeight;
    g.font = `700 ${Math.round(13 * sx)}px Consolas, monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const m of meas) {
      mTmp.copy(m.a).add(m.b).multiplyScalar(0.5).project(camera); if (mTmp.z > 1) continue;
      const x = (mTmp.x * 0.5 + 0.5) * container.clientWidth * sx, y = (-mTmp.y * 0.5 + 0.5) * container.clientHeight * sy, t = fIn(m.a.distanceTo(m.b)), w = g.measureText(t).width + 14 * sx;
      g.fillStyle = '#ff9a1f'; g.fillRect(x - w / 2, y - 11 * sy, w, 22 * sy); g.fillStyle = '#1a1206'; g.fillText(t, x, y);
    }
    if (viaDrone) { pilot = false; applyFlyCam(); }
    const img = c2.toDataURL('image/jpeg', 0.86), pose = mode === 'walk' ? { x: st.x, y: EYE, z: st.z, yaw: st.yaw, pitch: st.pitch } : mode === 'fly' ? { x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch } : poseFromCamera();
    snapPending = { img, cam: { ...pose, fov: camera.fov, mode } };
    snapDlg.querySelector('img').src = img; const ta = snapDlg.querySelector('textarea'); ta.value = ''; snapDlg.hidden = false; setTimeout(() => ta.focus(), 30);
  }
  snapBtn.addEventListener('click', (e) => { e.stopPropagation(); takeSnapshot(); });
  snapDlg.addEventListener('pointerdown', (e) => e.stopPropagation());
  snapDlg.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') snapDlg.querySelector('[data-a=cancel]').click(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) snapDlg.querySelector('[data-a=save]').click(); });
  snapDlg.querySelectorAll('button').forEach(b => b.addEventListener('click', (e) => {
    e.stopPropagation(); snapDlg.hidden = true; const S2 = snapPending; snapPending = null; canvas.focus();
    if (b.dataset.a !== 'save' || !S2) return;
    const snap = { id: 's' + Date.now().toString(36), at: new Date().toISOString(), note: snapDlg.querySelector('textarea').value.trim(), img: S2.img, cam: S2.cam, meas: meas.map(m => ({ a: m.a.toArray().map(v => +v.toFixed(3)), b: m.b.toArray().map(v => +v.toFixed(3)) })) };
    if (opts.onSnapshot) opts.onSnapshot(snap);
    else { const a2 = document.createElement('a'); a2.href = S2.img; a2.download = ((plan && plan.name) || 'Plan3D') + ' snapshot' + (snap.note ? ' - ' + snap.note.slice(0, 40).replace(/[\\/:*?"<>|]+/g, ' ') : '') + '.jpg'; document.body.appendChild(a2); a2.click(); a2.remove(); }
  }));

  const pts = new Map(); let down = null, pinch = null;
  let hintGone = false; var walkHintLater = false; function dismissHint() { if (hintGone) return; hintGone = true; hint.classList.add('gone'); }
  const coarse = global.matchMedia && global.matchMedia('(pointer: coarse)').matches;
  if (coarse && lookBtn) lookBtn.hidden = true;
  hint.textContent = coarse ? 'Drag to look · Tap the floor to walk · Tap doors to open' : 'W A S D to walk, Shift to run · arrow keys aim the camera (← → turn, ↑ ↓ look up and down) · Click doors to open, switches for lights';
  setTimeout(dismissHint, 7000);
  // a viewer that opens in an overview (Dollhouse, Plenum): the walking tips wait until the customer goes to Walk
  const walkTip = hint.textContent;
  if (opts.startMode && opts.startMode !== 'walk') { hint.classList.add('gone'); hintGone = true; walkHintLater = true; }
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    dismissHint(); canvas.focus(); stopTour(); if (sheetOpen) setSheet(false);
    if (isLocked()) { down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, multi: false }; return; }
    down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, multi: pts.size > 0 };
    if ((mode !== 'walk' && mode !== 'fly') || tween) return;
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), fov }; down.multi = true; }
    canvas.classList.add('drag');
  });
  // Mouse look (L key or the Look button): the mouse turns the view without holding a button, like a game.
  // Esc or L again lets go of the mouse.
  const lockable = !!canvas.requestPointerLock;
  const isLocked = () => document.pointerLockElement === canvas;
  function toggleLook() {
    if (!lockable) return;
    if (isLocked()) { document.exitPointerLock(); return; }
    if (mode !== 'walk' && mode !== 'fly') goWalk(st.x, st.z, st.yaw, 500);
    try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* not allowed here */ }
  }
  if (lookBtn) { if (!lockable) lookBtn.hidden = true; lookBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleLook(); }); }
  document.addEventListener('pointerlockchange', () => { container.classList.toggle('p3v-looking', isLocked()); keys.clear(); if (lookBtn) lookBtn.setAttribute('aria-pressed', String(isLocked())); });
  canvas.addEventListener('mousemove', e => {
    if (!isLocked() || (mode !== 'walk' && mode !== 'fly') || tween || game) return;
    const k = 0.0024 * (fov / 70);
    st.yaw -= e.movementX * k; st.pitch = Math.max(-1.25, Math.min(1.25, st.pitch - e.movementY * k));
  });
  canvas.addEventListener('pointermove', e => {
    if (isLocked()) return;
    if (down) down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
    if ((mode === 'walk' || mode === 'fly') && !tween && pts.has(e.pointerId)) {
      if (game) return;
      const p = pts.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) { const k = (e.pointerType === 'touch' ? 0.0068 : 0.0058) * (fov / 70); st.yaw -= dx * k; st.pitch = Math.max(-1.25, Math.min(1.25, st.pitch - dy * k)); }  // game-style: drag up looks up, drag right turns right (same as mouse look and the joystick)
      else if (pts.size === 2 && pinch) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); fov = Math.max(35, Math.min(85, pinch.fov * pinch.d / d)); camera.fov = fov; camera.updateProjectionMatrix(); }
      ring.visible = false; return;
    }
    if (measureOn && !e.buttons && !tween) { measureHover(e.clientX, e.clientY, e); ring.visible = false; return; }
    if (e.pointerType === 'mouse' && !e.buttons && !tween && mode !== 'fly') {
      const p = pick(e.clientX, e.clientY);
      if (p) { ring.position.set(p.x, 0.03, p.z); ring.visible = true; } else ring.visible = false;
    }
  });
  function endPointer(e) {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (!pts.size) canvas.classList.remove('drag');
    if (!down) return;
    const click = down.moved < 7 && !down.multi && performance.now() - down.t < 600 && e.type === 'pointerup' && e.button === 0;
    if (pts.size === 0) down = null;
    if (!click || tween || !A || game) return;
    if (isLocked()) { const r = canvas.getBoundingClientRect(); e = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; }

    if (commentMode) { placeComment(e.clientX, e.clientY); return; }
    if (measureOn) { measureClick(e.clientX, e.clientY, e); return; }
    if (checkSurpriseClick(e.clientX, e.clientY)) return;
    if (checkSwitchClick(e.clientX, e.clientY)) return;
    if (checkRemClick(e.clientX, e.clientY)) return;
    if (checkDoorClick(e.clientX, e.clientY)) return;

    if (mode === 'fly') return;
    const p = pick(e.clientX, e.clientY); if (!p) return;
    if (mode === 'walk') { const f = freeSpot(p.x, p.z); target = f; stuck = 0; showPulse(f.x, f.z); }
    else { const yaw = Math.atan2(-(p.x - camera.position.x), -(p.z - camera.position.z)); showPulse(p.x, p.z); goWalk(p.x, p.z, yaw); }
  }
  // ---- Comments: a customer clicks anything in the model and leaves a note on it. The notes stay in this
  // browser and "Send comments" sends them straight to the designer's app (a file only if asked for).
  // ---- Super render: the visible model goes to the path tracer (loaded on first use) with this exact view
  const srBtn = $('.p3v-srb'), srSrc = opts.superSrc === undefined ? 'https://collbusinesssolutions.com/plan3d-app/renderer/vendor/superrender.js' : opts.superSrc;
  srBtn.hidden = true; // Super render taken out (1.9.16)
  const loadScript = (src) => new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = src; sc.onload = ok; sc.onerror = () => no(new Error('Couldn’t load the renderer. Check your internet connection.')); document.head.appendChild(sc); });
  async function superRender() {
    if (!built || srBtn.disabled) return;
    srBtn.disabled = true; const lbl = srBtn.textContent; srBtn.textContent = 'Preparing…';
    const hid = [];
    try {
      built.root.traverse(o => { if (o.visible && ((o.userData && o.userData.airflow) || o.isSprite || o.isLine || o.isLineSegments || o.isPoints)) { o.visible = false; hid.push(o); } });
      const glb = await new Promise((ok, no) => { try { new THREE.GLTFExporter().parse(built.root, ok, { binary: true, onlyVisible: true, maxTextureSize: 1024 }); } catch (e) { no(e); } });
      hid.forEach(o => { o.visible = true; }); hid.length = 0;
      if (!global.P3Super) await loadScript(srSrc);
      const sd = sun.position.clone().sub(sun.target.position).normalize();
      global.__p3sr = await global.P3Super.open({ glb, camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov, aspect: camera.aspect }, view: mode, sunDir: sd.toArray(), title: (plan && plan.name) || 'Plan3D', mobile: !HQ, house: !!(plan && plan.mode === 'house'), quality: global.P3SR_Q, log: !!global.P3SR_Q });
    } catch (e) { console.error(e); hint.textContent = e.message || 'Super render couldn’t start.'; hint.classList.remove('gone'); setTimeout(() => hint.classList.add('gone'), 4000); }
    finally { hid.forEach(o => { o.visible = true; }); srBtn.disabled = false; srBtn.textContent = lbl; }
  }
  srBtn.onclick = (e) => { e.stopPropagation(); superRender(); };
  const cBtn = $('.p3v-cbtn:not(.p3v-abtn)'), cList = $('.p3v-clist'), cForm = $('.p3v-cform:not(.p3v-aform)');
  const pins = new THREE.Group(); scene.add(pins);
  let commentMode = false, pendingAt = null, myComments = [], sheetOpen = false;
  const storeKey = () => 'p3v-comments:' + ((plan && (plan.name || '')) + ':' + ((plan && plan.walls) ? plan.walls.length : 0));
  const loadMine = () => { if (!opts.comments) { myComments = []; return; } try { myComments = JSON.parse(localStorage.getItem(storeKey()) || '[]') || []; } catch (e) { myComments = []; } };
  const saveMine = () => { try { localStorage.setItem(storeKey(), JSON.stringify(myComments)); } catch (e) { /* private window: kept for this visit only */ } };
  // the customer's copy (a walkthrough link: a share id, no private key) can approve or ask for changes
  const aOk = () => !!(opts.comments && opts.approve !== false && plan && plan.share && plan.share.id && !plan.share.key);
  const allComments = () => [...((plan && plan.comments) || []).map(c => ({ ...c, theirs: true })), ...myComments];
  const pinTex = {};
  function pinSprite(n, done) {
    const k = n + (done ? 'd' : '');
    if (!pinTex[k]) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = done ? '#6fd08c' : '#f2c84b'; g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill(); g.lineWidth = 4; g.strokeStyle = '#1a1f22'; g.stroke(); g.fillStyle = '#1a1f22'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 32, 34); pinTex[k] = new THREE.CanvasTexture(c); }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pinTex[k], depthTest: false })); sp.scale.set(0.9, 0.9, 1); sp.renderOrder = 10; return sp;
  }
  function drawPins() {
    while (pins.children.length) pins.remove(pins.children[0]);
    allComments().forEach((c, i) => { const sp = pinSprite(i + 1, c.done); sp.position.set(c.x, (c.h || 0) + 0.6, c.y); pins.add(sp); });
    const L = allComments();
    if (touchy) { const n = cBtn.querySelector('.p3v-cn'); if (n) n.textContent = L.length ? String(L.length) : ''; }
    if (!opts.comments && !L.length) { cList.hidden = true; return; }
    cList.hidden = (!opts.comments && !L.length) || (touchy && !sheetOpen);
    const esc2 = (t) => String(t || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
    cList.innerHTML = (touchy ? '<div class="p3v-chead"><b>Review</b><button class="x p3v-cclose" aria-label="Close">×</button></div>' : '') + (aOk() ? '<button class="p3v-abtn" title="Tell your designer this design is approved, or what should change">✓ Approve or request changes</button>' : '') + (touchy && opts.comments ? '<button class="p3v-cadd">💬 Add a comment</button>' : '') + `<b>Comments${L.length ? ' (' + L.length + ')' : ''}</b>` + (L.length ? '<ol>' + L.map((c, i) => `<li>${esc2(c.text)}<br><small>${esc2(c.by || '')}${c.by ? ' · ' : ''}${esc2((c.at || '').slice(0, 10))}${c.done ? ' · done' : ''}</small>${!c.theirs && opts.comments ? ` <button class="x" data-del="${esc2(c.id)}" title="Delete">✕</button>` : ''}</li>`).join('') + '</ol>' : (touchy ? '<br><small>Tap Add a comment, then tap anything in the model.</small>' : '<br><small>Turn on 💬 Comment, then click anything in the model.</small>'))
      + (opts.comments && myComments.some(c => !c.sent) ? '<button class="p3v-csend">Send comments</button>' : opts.comments && myComments.length ? '<p><small>All sent to your designer ✓</small></p>' : '');
    cList.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { myComments = myComments.filter(c => c.id !== b.dataset.del); saveMine(); drawPins(); });
    const sb = cList.querySelector('.p3v-csend'); if (sb) sb.onclick = () => sendComments(false);
    const ab = cList.querySelector('.p3v-abtn'); if (ab) { ab.onclick = (e) => { e.stopPropagation(); openApprove(); }; aState(); }
    const cc = cList.querySelector('.p3v-cclose'); if (cc) cc.onclick = (e) => { e.stopPropagation(); setSheet(false); };
    const ca = cList.querySelector('.p3v-cadd'); if (ca) ca.onclick = (e) => { e.stopPropagation(); setSheet(false); setCommentMode(true); };
  }
  // with a share id (set by the app), comments go straight to the designer's app through the server;
  // without one, or with no connection, they're saved as a file to email back
  const COMMENTS_URL = opts.commentsUrl || 'https://cleanroom-cloud-production.up.railway.app/api/plan3d/comments/';
  // Comments that couldn't go out (no signal on a job site, say) stay marked unsent in this browser and are
  // tried again on their own: every half minute while the page is open, as soon as it's back online, and
  // the next time it's opened. A file is only made if the customer asks for one.
  let sendBusy = false, retryT = null;
  const setNote = (html) => { let n = cList.querySelector('.p3v-cnote'); if (!n) { n = document.createElement('p'); n.className = 'p3v-cnote'; cList.appendChild(n); } n.innerHTML = html; const fb = n.querySelector('.p3v-cfile'); if (fb) fb.onclick = () => saveFile(); };
  async function sendComments(quiet) {
    const sid = plan && plan.share && plan.share.id, todo = myComments.filter(c => !c.sent);
    if (!todo.length || sendBusy) return;
    if (!sid) {
      // a plan saved before comments could be sent: the file is the only way back to the designer
      if (!quiet) setNote('<small>This copy of the plan can’t send comments straight to your designer. Ask them for a new walkthrough link, or </small><button class="p3v-cfile">Save comments as a file</button>');
      return;
    }
    sendBusy = true; clearTimeout(retryT);
    const sb = cList.querySelector('.p3v-csend'); if (sb) { sb.disabled = true; sb.textContent = 'Sending…'; }
    let why = '';
    try {
      const r = await fetch(COMMENTS_URL + encodeURIComponent(sid), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comments: todo, project: (plan && plan.name) || '' }) });
      if (r.ok) { todo.forEach(c => { c.sent = true; }); saveMine(); drawPins(); setNote('<small>Sent ✓ Your designer will see ' + (todo.length === 1 ? 'it' : 'them') + ' in Coll Plan3D.</small>'); sendBusy = false; return; }
      try { const d = await r.json(); why = (d && (d.error || d.message)) || ''; } catch (e) { /* not json */ }
      if (!why) why = 'The server said ' + r.status + '.';
    } catch (e) { why = navigator.onLine === false ? 'No internet connection right now.' : 'Couldn’t reach the server.'; }
    sendBusy = false;
    const sb2 = cList.querySelector('.p3v-csend'); if (sb2) { sb2.disabled = false; sb2.textContent = 'Send comments'; }
    const esc3 = (t) => String(t).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
    setNote('<small>Not sent yet: ' + esc3(why) + ' Your comments are kept here and will send on their own when it can. </small><button class="p3v-cfile">Save as a file instead</button>');
    retryT = setTimeout(() => sendComments(true), 30000);
  }
  if (opts.comments) {
    global.addEventListener('online', () => sendComments(true));
    setTimeout(() => sendComments(true), 4000);  // anything left unsent from last time
  }
  function saveFile() {
    const data = JSON.stringify({ kind: 'coll-plan3d-comments', project: plan && plan.name, sent: new Date().toISOString(), comments: myComments }, null, 1);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = ((plan && plan.name) || 'project') + ' comments.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    setNote('<small>Saved as a file. Email or text that file back to your designer.</small>');
  }
  function placeComment(cx, cy) {
    if (!built) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([...(built.floors || [built.floor]), built.ground, ...built.pick], true)[0]; if (!hit) return;
    let ref = null; for (let o = hit.object; o && !ref; o = o.parent) ref = o.userData && o.userData.ref;
    pendingAt = { x: hit.point.x, y: hit.point.z, h: hit.point.y, ref };
    cForm.hidden = false; const ta = cForm.querySelector('textarea'); ta.value = ''; try { cForm.querySelector('input').value = localStorage.getItem('p3v-name') || ''; } catch (e) { /* ok */ } ta.focus();
  }
  cForm.addEventListener('submit', (e) => {
    e.preventDefault(); if (!pendingAt) return;
    const text = cForm.querySelector('textarea').value.trim(), by = cForm.querySelector('input').value.trim(); if (!text) return;
    try { if (by) localStorage.setItem('p3v-name', by); } catch (err) { /* ok */ }
    myComments.push({ id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...pendingAt, text, by, at: new Date().toISOString() });
    saveMine(); pendingAt = null; cForm.hidden = true; if (touchy) setCommentMode(false); drawPins();
  });
  cForm.querySelector('.p3v-ccancel').onclick = () => { pendingAt = null; cForm.hidden = true; };
  // ---- Approve or request changes (a walkthrough link only: a plan with a share id and no private key, i.e.
  // the customer's copy). It goes to the designer's app like a comment, marked as a decision on this version.
  const aForm = $('.p3v-aform');
  const aKey = () => 'p3v-decision:' + ((plan && plan.share && plan.share.id) || '') + ':' + ((plan && plan.ver) || '');
  function aState() {
    let d = null; try { d = JSON.parse(localStorage.getItem(aKey()) || 'null'); } catch (e) { d = null; }
    const b = cList.querySelector('.p3v-abtn');
    if (b) { b.classList.toggle('done', !!d); b.textContent = d ? (d.decision === 'approve' ? '✓ You approved this design' : '✎ You asked for changes') + ' · change' : '✓ Approve or request changes'; }
    return d;
  }
  function aSetup() { aForm.hidden = true; }
  function openApprove() {
    const d = aState();
    aForm.querySelector('.p3v-ainfo').textContent = d ? `You sent “${d.decision === 'approve' ? 'approved' : 'changes requested'}” on ${new Date(d.at).toLocaleDateString()}. You can send a new answer.` : 'Your designer gets your answer right away.';
    aForm.querySelector('.p3v-aerr').textContent = ''; setDec(d && d.decision === 'changes' ? 'changes' : 'approve');
    try { aForm.querySelector('input[maxlength]').value = localStorage.getItem('p3v-name') || ''; } catch (err) { /* ok */ }
    aForm.hidden = false;
  };
  aForm.querySelector('.p3v-ccancel').onclick = () => { aForm.hidden = true; };
  let aDec = 'approve';
  const setDec = (d) => { aDec = d; aForm.querySelectorAll('[data-dec]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dec === d))); const ta = aForm.querySelector('textarea'); ta.placeholder = d === 'changes' ? 'What should change?' : 'Anything to add (optional)'; ta.required = d === 'changes'; };
  aForm.querySelectorAll('[data-dec]').forEach(b => b.onclick = (e) => { e.preventDefault(); setDec(b.dataset.dec); });
  aForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const decision = aDec;
    const note = aForm.querySelector('textarea').value.trim(), by = aForm.querySelector('input[maxlength]').value.trim();
    if (!by) return; if (decision === 'changes' && !note) return;
    try { localStorage.setItem('p3v-name', by); } catch (err) { /* ok */ }
    const b = A && A.bounds, at = new Date().toISOString();
    const c = { id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: (decision === 'approve' ? 'Approved the design.' : 'Requested changes.') + (note ? ' ' + note : ''), by, at, x: b ? b.minX + b.w / 2 : 0, y: b ? b.minZ + b.d / 2 : 0, h: 0, ref: { kind: 'approval', id: String((plan && plan.ver) || '') }, target: decision };
    const sb = aForm.querySelector('button[type=submit]'); sb.disabled = true; sb.textContent = 'Sending…';
    let err = '';
    try { const r = await fetch(COMMENTS_URL + encodeURIComponent(plan.share.id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comments: [c], project: (plan && plan.name) || '' }) }); if (!r.ok) err = 'The server said ' + r.status + '.'; }
    catch (x) { err = navigator.onLine === false ? 'No internet connection right now.' : 'Couldn’t reach the server.'; }
    sb.disabled = false; sb.textContent = 'Send';
    if (err) { aForm.querySelector('.p3v-aerr').textContent = 'Not sent: ' + err + ' Try again in a moment.'; return; }
    try { localStorage.setItem(aKey(), JSON.stringify({ decision, at })); } catch (x) { /* ok */ }
    aForm.hidden = true; drawPins();
    hint.textContent = decision === 'approve' ? 'Sent ✓ Your designer has your approval.' : 'Sent ✓ Your designer has your requested changes.'; hint.classList.remove('gone'); setTimeout(() => hint.classList.add('gone'), 4500);
  });
  function setCommentMode(on) { commentMode = on; cBtn.setAttribute('aria-pressed', commentMode); hint.textContent = commentMode ? (touchy ? 'Tap anything to comment on it' : 'Click anything to comment on it') : ''; hint.classList.toggle('gone', !commentMode); }
  function setSheet(on) { sheetOpen = on; drawPins(); }
  if (opts.comments) {
    cBtn.hidden = false;
    if (touchy) { cBtn.innerHTML = '💬<span class="p3v-cn"></span>'; cBtn.setAttribute('aria-label', 'Comments and approval'); cBtn.title = 'Comments and approval'; drawPins(); }
    cBtn.onclick = (e) => { e.stopPropagation(); if (touchy && !commentMode) setSheet(!sheetOpen); else setCommentMode(!commentMode); };
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') ring.visible = false; });
  canvas.addEventListener('wheel', e => { if (mode !== 'walk' && mode !== 'fly') return; e.preventDefault(); fov = Math.max(12, Math.min(85, fov + e.deltaY * 0.03 * (fov / 60))); camera.fov = fov; camera.updateProjectionMatrix(); }, { passive: false });
  const keys = new Set();
  const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e', 'shift', ' ', 'r', 'f', 'c'];
  const typing = (t) => t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ''));
  // Keys reach the walkthrough whenever it's on screen and you're not typing in a box,
  // so you don't have to click the 3D view first.
  const viewOnScreen = () => !!container.offsetParent && container.clientWidth > 0;
  const onKeyDown = (e) => {
    if (!alive || e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || !viewOnScreen()) return;
    if (document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (game && game.key(k, e, true)) { e.preventDefault(); return; }
    if (k === 'g' && !e.repeat && mode === 'fly' && !tween && global.P3Game && A) { startGame(); e.preventDefault(); return; }
    if (tour && /^(w|a|s|d|q|e|arrow\w+|escape)$/.test(k)) stopTour();
    if (k === 'l' && !e.repeat) { toggleLook(); e.preventDefault(); return; }
    if (k === 'm' && opts.measure !== false && !e.repeat && (container.contains(e.target) || container.clientWidth > global.innerWidth * 0.6)) { setMeasure(!measureOn); e.preventDefault(); return; }
    if (k === 'p' && !e.shiftKey && !e.repeat && (container.contains(e.target) || container.clientWidth > global.innerWidth * 0.6)) { takeSnapshot(); e.preventDefault(); return; }
    if (k === 'escape' && mPending) { cancelPending(); }
    if (k === 'v' && !e.repeat && mode === 'fly') { pilot = !pilot; applyFlyCam(); e.preventDefault(); return; }
    // Only take keys that are meant for the walkthrough: when you're in it, or when it fills the window.
    // Side by side with the 2D plan, keys typed in the plan stay with the plan (W = wall tool, and so on).
    const inView = container.contains(e.target), big = container.clientWidth > global.innerWidth * 0.6;
    if (!inView && !big) return;
    if (mode !== 'walk' && mode !== 'fly' && !inView) return;
    running = e.shiftKey;
    if (MOVE_KEYS.includes(k)) { keys.add(k); dismissHint(); if (k !== 'shift') e.preventDefault(); }
  };
  const onKeyUp = (e) => { keys.delete(e.key.toLowerCase()); running = e.shiftKey; if (game) game.key(e.key.toLowerCase(), e, false); };
  function startGame() {
    setMeasure(false); if (isLocked()) document.exitPointerLock();
    st.pitch = 0;  // level flight: W straight ahead, Space / C up and down
    game = global.P3Game.start({
      THREE, scene, camera, drone, st, renderer, canvas, container, keys, touchy, bounds: A.bounds,
      inside: (() => { const fp = footprint(A, true), top = Math.max(A.WH || 0, A.H || 0, ...(A.pieces || []).map(p => p.h || 0)) + 0.5; return (x, y, z) => !!fp && fp.has(x, z) && y < top; })(),
      isLocked, lock: () => { if (lockable && !isLocked() && !touchy) toggleLook(); }, unlock: () => { if (isLocked()) document.exitPointerLock(); },
      setBoost: (v) => { flyBoost = v; }, isPilot: () => pilot,
      ended: () => { game = null; flyBoost = 1; applyFlyCam(); }
    });
  }
  let running = false;
  global.addEventListener('keydown', onKeyDown);
  global.addEventListener('keyup', onKeyUp);
  global.addEventListener('blur', () => keys.clear());

  const mg = mini.getContext('2d'); let mm = { s: 1, ox: 0, oy: 0, w: 1, h: 1 };
  function sizeMini() {
    if (!A) return;
    const r = mini.getBoundingClientRect(), dpr = Math.min(2, global.devicePixelRatio || 1);
    mini.width = Math.max(1, Math.round(r.width * dpr)); mini.height = Math.max(1, Math.round(r.height * dpr)); mg.setTransform(dpr, 0, 0, dpr, 0, 0);
    const b = A.bounds, s = Math.min((r.width - 14) / b.w, (r.height - 14) / b.d);
    mm = { s, ox: (r.width - b.w * s) / 2 - b.minX * s, oy: (r.height - b.d * s) / 2 - b.minZ * s, w: r.width, h: r.height };
  }
  const mx = x => mm.ox + x * mm.s, my = z => mm.oy + z * mm.s;
  function drawMini() {
    if (!A) return;
    mg.clearRect(0, 0, mm.w, mm.h);
    mg.fillStyle = '#c9d2d6';
    for (const b of A.boxes) mg.fillRect(mx(b.x0), my(b.z0), (b.x1 - b.x0) * mm.s, (b.z1 - b.z0) * mm.s);
    mg.lineCap = 'square';
    for (const p of A.pieces) { mg.strokeStyle = p.sp ? '#f2c84b' : '#e8edef'; mg.lineWidth = 2; mg.beginPath(); mg.moveTo(mx(p.x1), my(p.z1)); mg.lineTo(mx(p.x2), my(p.z2)); mg.stroke(); }
    for (const i of A.opInfo) {
      if (i.o.type === 'pass') { mg.strokeStyle = '#b9c0c3'; mg.lineWidth = 3; mg.beginPath(); mg.moveTo(mx(i.o.x1), my(i.o.y1)); mg.lineTo(mx(i.o.x2), my(i.o.y2)); mg.stroke(); }
      if (i.o.type === 'removable') { mg.strokeStyle = '#e0a43a'; mg.lineWidth = 2; mg.beginPath(); mg.moveTo(mx(i.o.x1), my(i.o.y1)); mg.lineTo(mx(i.o.x2), my(i.o.y2)); mg.stroke(); }
      if (i.o.type === 'glass') { mg.strokeStyle = '#7fd3e3'; mg.lineWidth = 1.6; mg.beginPath(); mg.moveTo(mx(i.o.x1), my(i.o.y1)); mg.lineTo(mx(i.o.x2), my(i.o.y2)); mg.stroke(); }
      mg.strokeStyle = 'rgba(232,237,239,.45)'; mg.lineWidth = 1;
      for (const l of i.leaves) { mg.beginPath(); mg.moveTo(mx(l.x1), my(l.z1)); mg.lineTo(mx(l.x2), my(l.z2)); mg.stroke(); }
    }
    let px, pz, yaw;
    if (mode === 'walk' && !tween) { px = st.x; pz = st.z; yaw = st.yaw; }
    else { const v = new THREE.Vector3(); camera.getWorldDirection(v); px = camera.position.x; pz = camera.position.z; yaw = Math.atan2(-v.x, -v.z); }
    if (mode === 'walk' || tween) {
      const a = Math.atan2(-Math.cos(yaw), -Math.sin(yaw)), half = THREE.MathUtils.degToRad(fov * 0.6);
      const b = A.bounds, cx = mx(Math.max(b.minX - 3, Math.min(b.maxX + 3, px))), cy = my(Math.max(b.minZ - 3, Math.min(b.maxZ + 3, pz)));
      const grd = mg.createRadialGradient(cx, cy, 0, cx, cy, 30); grd.addColorStop(0, 'rgba(242,200,75,.55)'); grd.addColorStop(1, 'rgba(242,200,75,0)');
      mg.fillStyle = grd; mg.beginPath(); mg.moveTo(cx, cy); mg.arc(cx, cy, 30, a - half, a + half); mg.closePath(); mg.fill();
      mg.fillStyle = '#f2c84b'; mg.beginPath(); mg.arc(cx, cy, 3.6, 0, Math.PI * 2); mg.fill(); mg.strokeStyle = '#121719'; mg.lineWidth = 1.2; mg.stroke();
    } else { mg.fillStyle = '#f2c84b'; mg.beginPath(); mg.arc(mx(st.x), my(st.z), 3, 0, Math.PI * 2); mg.fill(); }
  }
  mini.addEventListener('click', e => {
    if (!A) return; dismissHint();
    const r = mini.getBoundingClientRect(), b = A.bounds;
    const x = (e.clientX - r.left - mm.ox) / mm.s, z = (e.clientY - r.top - mm.oy) / mm.s;
    goWalk(Math.max(b.minX - 8, Math.min(b.maxX + 8, x)), Math.max(b.minZ - 8, Math.min(b.maxZ + 8, z)), mode === 'walk' ? st.yaw : 0, 900);
  });

  let labelEls = [], chipBtns = {};
  const allRooms = (p) => {
    if (!A || !A.zones || A.zones.length < 2) return p.rooms || [];
    // with several buildings, rooms in placed buildings are named "Building · Room"
    return [].concat(...A.zones.map(q => (q.zone.plan.rooms || []).map(r => q.zone.main || (q.zone.virtual && !q.zone.of) ? r : { ...r, name: (q.zone.name || 'Building') + ' · ' + (r.name || 'Room') })));
  };
  function buildHud(p) {
    const b = A.bounds;
    titleEl.textContent = p.name || 'Floor plan';
    const live = (A.zones || []).filter(q => !q.A.empty), nb = live.filter(q => !q.zone.virtual).length;
    const hs = [...new Set(live.map(q => fmtFt(q.A.H)))];
    metaEl.textContent = A.empty ? 'No walls yet' : `${fmtFt(b.w)} × ${fmtFt(b.d)} · ` + (nb > 1 ? `${nb} buildings` : hs.length > 1 ? `${hs.join(' / ')} ceilings` : `${fmtFt(A.H)} ceiling`);
    rooms = allRooms(p).filter(r => r && isFinite(r.x) && isFinite(r.y)).map(r => ({ ...r }));
    outside = { id: '__out', name: 'Outside', dims: '', x: b.cx, y: b.minZ - 11 };
    chipsEl.innerHTML = ''; chipBtns = {};
    [...rooms, outside].forEach(r => {
      const btn = document.createElement('button'); btn.textContent = r.name || 'Room';
      btn.addEventListener('click', () => {
        dismissHint();
        const yaw = r === outside ? Math.PI : Math.atan2(-(b.cx - r.x), -(b.cz - r.y));
        goWalk(r.x, r.y, yaw, mode === 'walk' ? 850 : 1000);
      });
      chipsEl.appendChild(btn); chipBtns[r.id || r.name] = btn; r.__btn = btn;
    });
    labelsEl.innerHTML = ''; labelEls = [];
    rooms.forEach(r => {
      const d = document.createElement('div'); d.className = 'p3v-rl';
      d.innerHTML = '<b></b>' + (r.dims ? '<span></span>' : '');
      d.querySelector('b').textContent = r.name || 'Room'; if (r.dims) d.querySelector('span').textContent = r.dims;
      labelsEl.appendChild(d); labelEls.push({ d, v: new THREE.Vector3(r.x, A.H + 0.6, r.y) });
    });
    curRoom = undefined;
  }
  function updateRoom() {
    const live = (mode === 'walk' || mode === 'fly') && !tween, x = live ? st.x : camera.position.x, z = live ? st.z : camera.position.z;
    const r = (!live && !tween) ? { name: 'Overview', dims: '' } : roomAt(x, z);
    if (r === curRoom || (curRoom && r && !r.id && curRoom.name === r.name)) return; curRoom = r;
    hereName.textContent = r ? (r.name || 'Room') : '—'; hereDims.textContent = r ? (r.dims || '') : '';
    [...rooms, outside].forEach(q => q.__btn && q.__btn.classList.toggle('on', q === r));
  }

  // a phone can take the graphics back to save memory (the 3D goes blank): ask for it back and rebuild
  let ctxLost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault(); ctxLost = true;
    hint.textContent = 'The 3D paused to save memory. One moment…'; hint.classList.remove('gone');
    setTimeout(() => { if (ctxLost) { hint.textContent = 'Reload the page to see the 3D again.'; hint.classList.remove('gone'); } }, 6000);
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    ctxLost = false; scene.environment = null;
    try { setPlan(plan, true); } catch (e) { console.error(e); }
    hint.classList.add('gone');
  }, false);
  // where a walkthrough starts outside: 11′ out from an outside door (double doors first), facing in; with no outside
  // door, in front of the building's long side
  function outsideStart() {
    const FP = footprint(A) || footprint(A, true); if (!FP) return null;
    const b = A.bounds, cand = [];
    for (const i of A.opInfo || []) {
      const t = i.o.type; if (!(t === 'door' || t === 'door2' || t === 'open' || t === 'overhead')) continue;
      const mx = (i.o.x1 + i.o.x2) / 2, mz = (i.o.y1 + i.o.y2) / 2, L = Math.hypot(i.o.x2 - i.o.x1, i.o.y2 - i.o.y1) || 1, nx = -(i.o.y2 - i.o.y1) / L, nz = (i.o.x2 - i.o.x1) / L;
      const a = FP.has(mx + nx * 2, mz + nz * 2), c = FP.has(mx - nx * 2, mz - nz * 2); if (a === c) continue;
      const sd = a ? -1 : 1, rank = t === 'door2' ? 0 : t === 'door' ? 1 : 2;
      cand.push({ mx, mz, ox: nx * sd, oz: nz * sd, rank, d: Math.hypot(mx - b.cx, mz - b.cz) });
    }
    cand.sort((p, q) => p.rank - q.rank || p.d - q.d);
    const c = cand[0];
    const at = c ? { x: c.mx + c.ox * 11, z: c.mz + c.oz * 11, lx: c.mx, lz: c.mz } : { x: b.cx, z: b.maxZ + 8, lx: b.cx, lz: b.cz };
    const f = freeSpot(at.x, at.z);
    return { x: f.x, z: f.z, yaw: Math.atan2(-(at.lx - f.x), -(at.lz - f.z)) || 0 };
  }
  let startedOnce = false;
  function setPlan(p, keep) {
    plan = p;
    A = analyzeAll(p);
    if (built) { scene.remove(built.root); built.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    built = buildStack(THREE, p, A);
    EYE = EYE0; try { if ((p.levels || []).length > 1) { const L = levelPlans(p).find(q => q.k === (p.level || 0)); if (L) EYE = EYE0 + L.elev; } } catch (e) { }
    for (const extra of [() => pressureArrows(THREE, built.root, p), () => floorFlow(THREE, built.root, p), () => flowArrows(THREE, built.root, p)]) { try { extra(); } catch (e) { console.error(e); } }
    scene.add(built.root);
    if (real) placeRoomLights();
    try { refreshAir(); applySwitches(); } catch (e) { console.error(e); }
    try { stopTour(); refreshTour(); } catch (e) { console.error(e); }
    try { upgradeScene(scene); let top = (A && A.H) || 10; try { const LP = levelPlans(p); top = LP[LP.length - 1].elev + 30; } catch (e) { } fitSun(A && A.bounds, top); } catch (e) { console.error(e); }
    if (typeof drawPins === 'function' && cList) { loadMine(); drawPins(); aSetup(); }
    emptyEl.hidden = !A.empty;
    // the Plenum view only when there is a plenum
    const pb = modeBtns.find(b => b.dataset.m === 'plenum'); if (pb) pb.hidden = !(A.PL > 0);
    // a customer link opens in its own view (the Plenum) and offers only its own views (opts.views); with no plenum
    // in the plan, the Dollhouse stands in for it
    if (!keep && opts.startMode && !startedOnce) { startedOnce = true; mode = opts.startMode; }
    if (mode === 'plenum' && !(A.PL > 0)) mode = 'doll';
    let hasRoof = false; if (built.roof) built.roof.traverse(o => { if (o.isMesh) hasRoof = true; });
    const eb = modeBtns.find(b => b.dataset.m === 'exterior'); if (eb) eb.hidden = !hasRoof;
    if (opts.views) { const V = opts.views.concat(opts.views.includes('plenum') && !(A.PL > 0) ? ['doll'] : []); modeBtns.forEach(b => { if (!V.includes(b.dataset.m)) b.hidden = true; }); }
    if (mode === 'exterior' && !hasRoof) mode = 'doll';
    buildHud(p);
    sizeMini();
    if (!keep) {
      const b = A.bounds, r0 = allRooms(p)[0];
      const sx = r0 ? r0.x : b.cx, sz = r0 ? r0.y : b.cz;
      const f = freeSpot(sx, sz); st.x = f.x; st.z = f.z; st.yaw = r0 ? Math.atan2(-(b.cx - sx), -(b.cz - sz)) || 0 : 0; st.pitch = -0.04;
      // a customer walkthrough (shared link, phone, exported file) starts outside, at the way in, facing the room
      if (opts.startOutside && !A.empty) { try { const o = outsideStart(); if (o) { st.x = o.x; st.z = o.z; st.yaw = o.yaw; if (mode !== 'walk' && mode !== 'doll' && mode !== 'plenum') mode = 'walk'; } } catch (e) { console.error(e); } }
      if (A.empty) { mode = 'doll'; }
      if (mode === 'fly') mode = 'doll';
      if (mode === 'walk') { labelsEl.hidden = true; applyWalkCam(); }
      else { const pose = orbitPose(mode); camera.position.copy(pose.pos); camera.fov = 45; camera.updateProjectionMatrix(); controls.target.copy(pose.look); controls.enabled = true; controls.update(); labelsEl.hidden = false; }
      applyVis(mode);
      setModeUI();
    } else {
      if (mode === 'walk') { if (collides(st.x, st.z)) { const f = freeSpot(st.x, st.z); st.x = f.x; st.z = f.z; } }
      applyVis(mode);
    }
  }

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); sizeMini();
    sizeReal();
    if (composer) { const pr = renderer.getPixelRatio(); composer.setSize(w, h); if (ssaoPass) ssaoPass.setSize(w * pr, h * pr); if (fxaaPass) fxaaPass.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr)); }
  }
  const ro = new ResizeObserver(resize); ro.observe(container);

  const tmp = new THREE.Vector3(); let last = performance.now(), raf = 0, alive = true, turnHeld = 0, sweepN = 0, aoOff = false;
  /* Smooth on any machine: when a big plan draws slowly (steadily under ~24 frames a second for a few seconds),
     the extras step down one at a time: the floor reflection, then the sharpness (pixel ratio 1), then the
     corner shading. Hitches (a frame over half a second: loading, rebuilding) don't count. It never turns
     anything back up on its own; turning Realistic off and on starts it over. */
  const PR0 = renderer.getPixelRatio();
  const gov = { ema: 1 / 60, slow: 0, level: 0 };
  function govReset() { gov.ema = 1 / 60; gov.slow = 0; if (gov.level) { gov.level = 0; if (!fxGroup.parent) scene.add(fxGroup); aoOff = false; if (renderer.getPixelRatio() !== PR0) { renderer.setPixelRatio(PR0); resize(); } } }
  function govStep(rawDt) {
    if (rawDt <= 0 || rawDt > 0.5 || document.hidden || global.P3NOAUTO) return;
    gov.ema += (rawDt - gov.ema) * 0.08;
    if (gov.ema > 1 / 24) gov.slow += rawDt; else gov.slow = Math.max(0, gov.slow - rawDt * 0.5);
    if (gov.slow < 3 || gov.level >= 3) return;
    gov.slow = 0; gov.level++;
    if (gov.level === 1) { if (real && gloss) { scene.remove(gloss); gloss.getRenderTarget().dispose(); gloss = null; } aoOff = true; }
    else if (gov.level === 2) { if (renderer.getPixelRatio() > 1) { renderer.setPixelRatio(1); resize(); } scene.remove(fxGroup); fxOn = false; roomLights.children.forEach(l => { if (l.userData.i0 != null) l.intensity = l.userData.i0; }); }
    else if (gov.level === 3) { if (rSSAO && real) { rSSAO.enabled = false; rPlain.enabled = true; } }
  }
  function loop(now) {
    if (!alive) return;
    // up to 1/8 s per frame, so turning and walking keep their speed even when the 3D draws slowly
    const rawDt = Math.max(0, (now - last) / 1000), dt = Math.min(0.125, rawDt); last = now; govStep(rawDt);
    if (A) {
      // the tour keeps real time even when the 3D draws slowly
      if (tour && !tween) { stepTour(Math.min(0.5, rawDt)); applyWalkCam(); }
      else if (tween) runTween(now);
      else if (mode === 'walk') {
        let f = 0, s = 0, turn = 0;
        if (keys.has('w')) f += 1; if (keys.has('s')) f -= 1;
        if (keys.has('d')) s += 1; if (keys.has('a')) s -= 1;
        if (keys.has('arrowleft') || keys.has('q')) turn += 1; if (keys.has('arrowright') || keys.has('e')) turn -= 1;
        lookKeys(dt);
        // turning starts gentle for small corrections and speeds up while held
        if (turn) { turnHeld = Math.min(1, turnHeld + dt * 2.5); st.yaw += turn * (1.6 + 1.6 * turnHeld) * dt; } else turnHeld = 0;
        // the joystick: forward and back walk, side to side turns (so one thumb can walk a room)
        let jm = 0; if (joy.id != null && Math.hypot(joy.f, joy.s) > 0.12) { jm = Math.min(1, Math.hypot(joy.f, joy.s)); if (Math.abs(joy.f) > 0.15) f += joy.f; if (Math.abs(joy.s) > 0.18) st.yaw -= (joy.s - Math.sign(joy.s) * 0.18) * 2.4 * dt; }
        if (f || s) {
          target = null; const sp = (running || keys.has('shift') ? 13 : 7) * dt * (jm && !keys.size ? Math.max(0.25, Math.abs(f)) : 1), fx = -Math.sin(st.yaw), fz = -Math.cos(st.yaw), rx = Math.cos(st.yaw), rz = -Math.sin(st.yaw);
          const vx = fx * f + rx * s, vz = fz * f + rz * s, n = Math.hypot(vx, vz); if (n > 1e-4) step(vx / n * sp, vz / n * sp);
        }
        if (target) {
          const dx = target.x - st.x, dz = target.z - st.z, d = Math.hypot(dx, dz);
          if (d < 0.06) target = null;
          else { const sp = Math.min(d, dt * Math.max(2.2, Math.min(9, d * 2.6))); const m = step(dx / d * sp, dz / d * sp); if (m < sp * 0.2) { stuck += dt; if (stuck > 0.2) target = null; } else stuck = 0; }
        }
        applyWalkCam();
      } else if (mode === 'fly') { flyStep(dt); if (game) game.step(dt); }
      else controls.update();   // orbit views only (Dollhouse, Plenum, Exterior, Plan); never in Walk or Drone
      if (game && mode !== 'fly') game.stop();

      stepRemovable(dt);
      if (built && built.doors) {
        built.doors.forEach(doorGroup => {
          const targetOpenAngle = doorGroup.userData.isOpen ? (Math.PI / 2) * doorGroup.userData.swingDir : 0;
          doorGroup.userData.openAngle += (targetOpenAngle - doorGroup.userData.openAngle) * 0.15;
          doorGroup.rotation.y = doorGroup.userData.baseRotation + doorGroup.userData.openAngle;
        });
      }

      if (pulseT >= 0) { pulseT += dt; const k = pulseT / 0.7; pulse.scale.setScalar(1 + k * 1.4); pulse.material.opacity = Math.max(0, 0.9 * (1 - k)); if (k >= 1) { pulseT = -1; pulse.material.opacity = 0; } }
      if (!labelsEl.hidden) {
        const w = container.clientWidth, h = container.clientHeight;
        for (const l of labelEls) {
          tmp.copy(l.v).project(camera);
          if (tmp.z > 1) { l.d.style.display = 'none'; continue; } l.d.style.display = '';
          l.d.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px,${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`;
        }
      }
      updateRoom(); drawMini(); updateMeasureLabels();
    }
    if (gas.length) stepGas(dt);
    if (GFX && (++sweepN % 30) === 0) upgradeScene(scene);
    if (GFX) { const sh = mode !== 'walk' && mode !== 'plenum' && !downOn; if (sun.castShadow !== sh) sun.castShadow = sh; }   // inside under the ceiling lights, the sun doesn't reach
    if (real) updateFx(now);
    if (real || downOn) updateDown();
    if (real && rComp && !ctxLost) rComp.render(); else if (composer && !aoOff) composer.render(); else renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  camera.fov = fov; camera.updateProjectionMatrix();
  resize();
  setPlan(plan || { walls: [] }, false);
  // Realistic starts on for a computer (it remembers if you turned it off); phones keep the lighter view
  if (canReal && HQ) { let pref = '1'; try { const v = localStorage.getItem('p3v.real'); if (v != null) pref = v; } catch (e) { /* ok */ } if (pref !== '0') setReal(true); }
  raf = requestAnimationFrame(loop);

  return {
    setPlan: (p) => setPlan(p, true),
    loadPlan: (p) => setPlan(p, false),
    setMode: (m) => { if (m === 'walk') goWalk(st.x, st.z, st.yaw); else goOrbit(m); },
    resize,
    get state() { return { x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch, mode, cam: { x: camera.position.x, y: camera.position.y, z: camera.position.z } }; },
    flyTo: (c) => flyTo(c), setMeasure: (on) => setMeasure(!!on), takeSnapshot: () => takeSnapshot(),
    // a picture of the view as it is now (JPEG data URL), or null when the 3D view isn't on screen
    snapshot: (q) => { if (canvas.width < 64 || canvas.height < 64) return null; const dv = drone.visible; drone.visible = false; try { renderer.render(scene, camera); return canvas.toDataURL('image/jpeg', q || 0.9); } catch (e) { return null; } finally { drone.visible = dv; } },
    // a model for Twinmotion (or Enscape, Lumion, Blender, SketchUp): real size (metres), every material named
    // for what it is with physically based starting values (painted steel, aluminum, stainless, glass, epoxy),
    // parts grouped by kind; outlines, airflow arrows and helper shadows left out
    exportTwinmotion: () => new Promise((resolve, reject) => {
      if (!THREE.GLTFExporter) return reject(new Error('GLTF exporter missing'));
      const fresh = buildStack(THREE, plan), drop = [];
      fresh.root.traverse(o => {
        const mn = o.material && !Array.isArray(o.material) ? o.material.name : '';
        if (o.isLine || o.isLineSegments || o.isSprite || o.isPoints || (o.userData && o.userData.airflow) || mn === 'Contact shadow' || mn === 'Ground' || /\(helper\)/.test(mn)) drop.push(o);
      });
      drop.forEach(o => { if (o.parent) o.parent.remove(o); });
      const conv = new Map(), byName = new Map();
      const pbr = (m) => {
        if (!m) return m; if (conv.has(m)) return conv.get(m);
        const name = m.name || 'Material', n = name.toLowerCase();
        // one material per name, so each finish is one drag-and-drop in Twinmotion
        if (byName.has(name)) { conv.set(m, byName.get(name)); return byName.get(name); }
        const plainPanel = /^wall panel, /.test(n);   // the joints are real geometry below, not painted on
        const o = new THREE.MeshStandardMaterial({ name, color: m.color ? m.color.clone() : new THREE.Color(0xffffff), map: plainPanel ? null : (m.map || null), side: m.side, transparent: !!m.transparent, opacity: m.opacity == null ? 1 : m.opacity });
        byName.set(name, o);
        let r = 0.6, mt = 0;
        if (/glass/.test(n)) { r = 0.05; o.transparent = true; o.opacity = 0.25; }
        else if (/painted|enamel|tees, top/.test(n)) r = 0.45;
        else if (/stainless|aluminum|galvanized|hardware|grid|damper|ffu galvanized/.test(n)) { r = 0.35; mt = 0.85; }
        else if (/steel beam/.test(n)) { r = 0.55; mt = 0.6; }
        else if (/wall panel|door leaf|door frame|fixture housing|ffu housing/.test(n)) r = 0.42;
        else if (/floor/.test(n)) r = 0.28;
        else if (/ceiling tile, vinyl/.test(n)) r = 0.55;
        else if (/ceiling tile|ceiling, solid/.test(n)) r = 0.9;
        else if (/rubber/.test(n)) r = 0.85;
        if (/light lens/.test(n)) { o.emissive = new THREE.Color(0xffffff); o.emissiveIntensity = 1; r = 0.3; }
        o.roughness = r; o.metalness = mt;
        conv.set(m, o); return o;
      };
      const CATS = [['Walls', /wall panel|rubber base|ceiling track|return grille|damper/i], ['Doors and glass', /door|kick plate|glass/i], ['Fan filter units', /ffu/i], ['Lights', /light|fixture housing/i], ['Ceiling', /ceiling/i], ['Floor', /floor/i], ['Lid and structure', /lid|steel beam|stainless/i]];
      const out = new THREE.Group(); out.name = (plan.name || 'Cleanroom') + ' (Coll Plan3D)';
      const groups = {}, cat = (name) => { let k = 'Other'; for (const [label, re] of CATS) if (re.test(name)) { k = label; break; } if (!groups[k]) { const g = new THREE.Group(); g.name = k; out.add(g); groups[k] = g; } return groups[k]; };
      fresh.root.updateMatrixWorld(true);
      const meshes = []; fresh.root.traverse(o => { if (o.isMesh && o.visible !== false) meshes.push(o); });
      const count = {};
      for (const m of meshes) {
        m.material = Array.isArray(m.material) ? m.material.map(pbr) : pbr(m.material);
        const nm = (Array.isArray(m.material) ? (m.material.find(x => /wall panel,/i.test(x.name)) || m.material[0]) : m.material).name;
        const g = cat(nm); count[nm] = (count[nm] || 0) + 1; m.name = nm + ' ' + count[nm];
        g.attach(m);
      }
      // panel joints: a thin strip on both faces of every hardwall run at each 48″ module, where the panels meet
      try {
        const jm = new THREE.MeshStandardMaterial({ name: 'Wall panel joint', color: 0xb9c0c4, roughness: 0.5, metalness: 0.2 }), jw = 0.75 / 12, js = new THREE.BoxGeometry(1, 1, 1);
        const jg = new THREE.Group(); jg.name = 'Wall panel joints'; (groups.Walls || out).add(jg);
        for (const p of A.pieces || []) {
          if (!p.hard) continue;
          const L = p.len || Math.hypot(p.x2 - p.x1, p.z2 - p.z1); if (L < 0.5) continue;
          const ux = (p.x2 - p.x1) / L, uz = (p.z2 - p.z1) / L, ang = Math.atan2(-uz, ux), s0 = p.s0 || 0;
          const ww = (plan.walls || []).find(q => q.id === p.id);
          for (const mm of ww ? wallModule(ww, plan) : []) { if (mm >= s0 + L - 0.2) continue;
            if (mm - s0 < 0.2) continue;
            const k = mm - s0, x = p.x1 + ux * k, z = p.z1 + uz * k, j = new THREE.Mesh(js, jm);
            j.scale.set(jw, Math.max(0.1, p.h - 0.333), (p.t || 0.25) + 0.012); j.position.set(x, 0.333 + (p.h - 0.333) / 2, z); j.rotation.y = ang; j.name = 'Wall panel joint';
            jg.add(j);
          }
        }
      } catch (e) { /* joints are a nicety */ }
      const top = new THREE.Group(); top.add(out); out.scale.setScalar(0.3048);  // feet → metres
      new THREE.GLTFExporter().parse(top, (res) => resolve(res), { binary: true, onlyVisible: true, maxTextureSize: 2048 });
    }),
    exportGLB: () => new Promise((resolve, reject) => {
      if (!THREE.GLTFExporter) return reject(new Error('GLTF exporter missing'));
      const fresh = buildStack(THREE, plan);
      fresh.root.traverse(o => { if (o.isLineSegments) o.visible = false; });
      new THREE.GLTFExporter().parse(fresh.root, (res) => resolve(res), { binary: true, onlyVisible: true });
    }),
    dispose: () => { alive = false; global.removeEventListener('keydown', onKeyDown); global.removeEventListener('keyup', onKeyUp); if (isLocked()) document.exitPointerLock(); cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); container.innerHTML = ''; }
  };
}

global.Plan3DViewer = { fitGrilles, wallModule, whipLines, WALL_CAP, wallCaps, wallCapSolids, lidTop, WHIP, whipPorts, whipRun, whipExt, wireFixtures, LIGHT_HH, LIGHT_BOX, removableLayout, removableOf, REM, TILE_TYPES, tileTypeOf, tileColorOf, tileName, GRID_COLORS, gridColorOf, PANEL_COLORS, panelColorOf, hangRects, subtractRects, clipRects, flowRoutes, ROOM_TYPES, RET_FPM, PA_TO_INWC, fixtureFrames, rectsMinus, gridAt, gridZoneAt, zoneGrid, gridPieces, generatedGridLines, ceilingSpaceAt, FINISH, finishOf, ceilingRects, inCeiling, generateCeiling, ISO_TARGETS, fixtureTurned, turnedOpenHalf, ceilAreas, ceilingAt, areaBulkheads, sectionTop, lightKey, BEAMS, beamSize, beamBottom, beamSeat, roofStructure, DEVICES, cleanroomCheck, gridTakeoff, studPoints, tileTakeoff, tileOpenings, isBuilt, builtLines, builtRects, splitByCeiling, roomKey, mount, analyze, analyzeAll, buildAll: (THREE, plan) => buildAll(THREE, plan), buildStack: (THREE, plan) => buildStack(THREE, plan), zones, flatten, transformPlan, insertXform, insertBox, centredCopy, WALL_KINDS, isHard, isFrame, ITEMS, itemCorners, FLOORS, roomRegions, roofField, shellHeight, footprint, grilleSize, ceilingGrid, ceilingLines, smartZoom, snapFixture, fmtFt, buildScene: (THREE, plan, A) => buildScene(THREE, plan, A || analyze(plan)), ceilingFixtures, segDist, snapToDrawn, placeFixture, doorSpec, panelStack, wallCeil, LEVEL_KEYS, levelData, levelPlans, stairRise, floorDepthOf, FOUNDATIONS, foundationOf, houseExtWalls, foundationTakeoff, deckShapes, deckBase, deckLevels, deckParts, deckSteps, headerSegs, headerGaps, wallJoints };
})(typeof window !== 'undefined' ? window : this);
