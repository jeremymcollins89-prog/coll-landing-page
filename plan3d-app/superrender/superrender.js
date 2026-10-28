/* Coll Plan3D Super Render: a path-traced, photo-real still of the view on screen.
   The viewer hands over the visible model (as GLB), the camera and the view (walk, dollhouse, exterior…).
   Here every surface is rebuilt as a physical material with real surface detail:
     - relief (normal maps) derived from every texture: siding, shingles, wood grain, ceiling tile perforations
     - procedural finishes, laid out in real-world scale: brushed 304 stainless, orange-peel painted panels,
       clear-coated epoxy floors, rubber cove base, polished concrete or mown grass outside
     - real glass (refraction, Fresnel reflection, a green edge tint)
   Light is physical too: a clear-day sky with a sun disk (soft-edged shadows), every LED panel an area light,
   up to 9 bounces, a camera with a touch of depth of field in walk view, AgX filmic colour and a denoise.
   Bundled with three.js r185 and three-gpu-pathtracer (MIT). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { WebGLPathTracer, ProceduralEquirectTexture, DenoiseMaterial, PhysicalCamera } from 'three-gpu-pathtracer';

// finishes still being checked for fireflies; switched on one at a time once each renders clean
const DETAIL = Object.assign({ steel: true, paint: true, epoxy: true, rubber: true, coat: true }, (typeof window !== 'undefined' && window.P3SR_DETAIL) || {});
const QUALITY = {
  draft: { w: 1280, samples: 128, label: 'Draft · 1280' },
  high: { w: 1920, samples: 512, label: 'High · 1920' },
  ultra: { w: 3840, samples: 1536, label: 'Ultra · 4K' },
};
const TEST = { w: 480, samples: 24 };  // used by the test bench only

const css = `
.p3sr{position:fixed;inset:0;z-index:100000;background:#0e1113;color:#e8ecef;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column}
.p3sr-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;padding-top:calc(10px + env(safe-area-inset-top,0px));border-bottom:1px solid rgba(255,255,255,.08);flex-wrap:wrap}
.p3sr-bar b{font-size:15px;letter-spacing:.01em}
.p3sr-bar .sp{flex:1}
.p3sr-st{font:12.5px ui-monospace,Consolas,monospace;color:#9aa7ad;min-width:200px}
.p3sr button,.p3sr select{font:600 13.5px Inter,system-ui,sans-serif;color:#e8ecef;background:#22272b;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px 13px;cursor:pointer}
.p3sr button.pri{background:linear-gradient(180deg,#f8d978,#f2c84b 55%,#d9a928);color:#1c1f1e;border:0}
.p3sr button:disabled{opacity:.5;cursor:default}
.p3sr-stage{flex:1;display:flex;align-items:center;justify-content:center;padding:14px;min-height:0}
.p3sr-stage canvas{max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5);background:#000}
.p3sr-bar .pb{position:relative;height:4px;width:160px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden}
.p3sr-bar .pb i{position:absolute;left:0;top:0;bottom:0;background:#f2c84b;width:0}
@media (max-width:640px){.p3sr-st{min-width:0;width:100%;order:9}.p3sr-bar .pb{width:90px}}
`;

/* ---------- procedural texture kit (canvas), everything tiles seamlessly ---------- */
const rnd = (() => { let s = 1234567; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; })();
function canvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }
// smooth tiling value noise: several octaves of random grids drawn with wrap-around and smoothing
function noiseCanvas(n, octaves, base, gain) {
  const out = canvas(n), g = out.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, n, n);
  let amp = 1, cells = base;
  for (let o = 0; o < octaves; o++) {
    const small = canvas(cells), sg = small.getContext('2d'), id = sg.createImageData(cells, cells);
    for (let i = 0; i < cells * cells; i++) { const v = rnd() * 255; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    sg.putImageData(id, 0, 0);
    g.globalAlpha = amp * 0.5; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) g.drawImage(small, dx, dy, n, n);
    amp *= gain; cells *= 2;
  }
  g.globalAlpha = 1; return out;
}
// a normal map from a height canvas (Sobel), wrap-around so it tiles
function normalFromHeight(src, strength, size) {
  const n = size || Math.min(1024, Math.max(src.width, src.height));
  const hc = canvas(n), hg = hc.getContext('2d'); hg.drawImage(src, 0, 0, n, n);
  const H = hg.getImageData(0, 0, n, n).data, out = hg.createImageData(n, n), o = out.data;
  const h = (x, y) => { x = (x + n) % n; y = (y + n) % n; const i = (y * n + x) * 4; return (H[i] * 0.299 + H[i + 1] * 0.587 + H[i + 2] * 0.114) / 255; };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1)) - (h(x - 1, y - 1) + 2 * h(x - 1, y) + h(x - 1, y + 1));
    const dy = (h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1)) - (h(x - 1, y - 1) + 2 * h(x, y - 1) + h(x + 1, y - 1));
    let nx = -dx * strength, ny = -dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * n + x) * 4; o[i] = (nx * 0.5 + 0.5) * 255; o[i + 1] = (ny * 0.5 + 0.5) * 255; o[i + 2] = (nz * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  const c = canvas(n); c.getContext('2d').putImageData(out, 0, 0); return c;
}
const tex = (c, srgb, rep) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; if (rep) t.repeat.set(rep, rep); return t; };

const KIT = {};
function kit() {
  if (KIT.ready) return KIT;
  // orange-peel paint (fine bumps) on wall panels and painted surfaces
  KIT.paintN = tex(normalFromHeight(noiseCanvas(512, 4, 64, 0.55), 1.4), false);
  KIT.paintR = tex(noiseCanvas(256, 3, 16, 0.6), false);
  // brushed stainless: long fine streaks along one direction
  const b = canvas(512), bg = b.getContext('2d'); bg.fillStyle = '#808080'; bg.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { const y = rnd() * 512, v = 100 + rnd() * 60; bg.fillStyle = `rgb(${v},${v},${v})`; bg.globalAlpha = 0.35; const x = rnd() * 512, L = 80 + rnd() * 400; bg.fillRect(x, y, L, 1); bg.fillRect(x - 512, y, L, 1); }
  bg.globalAlpha = 1;
  KIT.brushN = tex(normalFromHeight(b, 2.2), false); KIT.brushR = tex(b, false);
  // epoxy floor: a very faint mottle under a glossy clear coat
  KIT.epoxyR = tex(noiseCanvas(512, 4, 8, 0.6), false);
  // polished concrete: mottled colour, fine pores and a few trowel marks
  const cc = noiseCanvas(1024, 6, 6, 0.62), cg = cc.getContext('2d');
  for (let i = 0; i < 9000; i++) { cg.fillStyle = rnd() < 0.5 ? 'rgba(40,40,40,.35)' : 'rgba(230,230,225,.25)'; const r = rnd() * 1.6; cg.beginPath(); cg.arc(rnd() * 1024, rnd() * 1024, r, 0, 7); cg.fill(); }
  KIT.concC = tex(cc, true); KIT.concN = tex(normalFromHeight(cc, 0.8), false); KIT.concR = tex(noiseCanvas(512, 3, 8, 0.6), false);
  // mown grass: green noise with blade speckle and stripes
  const gr = canvas(1024), gg = gr.getContext('2d'); gg.fillStyle = '#4f7a35'; gg.fillRect(0, 0, 1024, 1024);
  gg.globalAlpha = 0.5; gg.drawImage(noiseCanvas(1024, 5, 8, 0.6), 0, 0); gg.globalAlpha = 1;
  for (let i = 0; i < 60000; i++) { const g2 = 70 + rnd() * 90; gg.fillStyle = `rgba(${g2 * 0.55 | 0},${g2 | 0},${g2 * 0.35 | 0},.55)`; gg.fillRect(rnd() * 1024, rnd() * 1024, 1, 2 + rnd() * 3); }
  gg.fillStyle = 'rgba(255,255,255,.04)'; for (let x = 0; x < 1024; x += 256) gg.fillRect(x, 0, 128, 1024);
  KIT.grassC = tex(gr, true); KIT.grassN = tex(normalFromHeight(gr, 1.5), false);
  KIT.ready = true; return KIT;
}

/* world-scaled box-projected UVs, so procedural detail is the right size on every face */
function worldUV(mesh, scale) {
  const g = mesh.geometry, P = g.attributes.position, N = g.attributes.normal; if (!P || !N) return;
  const m = mesh.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(m), p = new THREE.Vector3(), n = new THREE.Vector3();
  const uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    p.fromBufferAttribute(P, i).applyMatrix4(m); n.fromBufferAttribute(N, i).applyMatrix3(nm);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let u, v; if (ay >= ax && ay >= az) { u = p.x; v = p.z; } else if (ax >= az) { u = p.z; v = p.y; } else { u = p.x; v = p.y; }
    uv[i * 2] = u / scale; uv[i * 2 + 1] = v / scale;
  }
  mesh.geometry = g.clone(); mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// a normal map with the same layout as a colour texture: the texture's own relief
const derived = new Map();
function reliefOf(map, strength) {
  if (!map || !map.image) return null;
  if (derived.has(map)) return derived.get(map);
  let t = null;
  try {
    const img = map.image, w = img.width || img.videoWidth, h = img.height || img.videoHeight;
    if (w > 4 && h > 4) { const c = canvas(Math.min(512, Math.max(w, h))); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); t = tex(normalFromHeight(c, strength), false); t.flipY = map.flipY; t.wrapS = map.wrapS; t.wrapT = map.wrapT; t.repeat.copy(map.repeat); t.offset.copy(map.offset); t.rotation = map.rotation; t.center.copy(map.center); t.channel = map.channel; }
  } catch (e) { t = null; }
  derived.set(map, t); return t;
}

/* a clear-day sky with a real sun disk (soft-edged shadows come from its size) */
function sky(sunDir, exterior) {
  const W = 2048, t = new ProceduralEquirectTexture(W, W / 2);
  const zen = new THREE.Color(0.11, 0.25, 0.62), hor = new THREE.Color(0.78, 0.85, 0.95), haze = new THREE.Color(1.0, 0.93, 0.82), gnd = new THREE.Color(0.11, 0.105, 0.1);
  const d = new THREE.Vector3(), s = sunDir.clone().normalize(), cosR = Math.cos(THREE.MathUtils.degToRad(0.6)), cosR2 = Math.cos(THREE.MathUtils.degToRad(2.5));
  // radiance: sun disk ≈ 3× the sky's light on a level surface, like a clear afternoon
  const SUN = exterior ? 8700 : 6000, AMB = exterior ? 0.36 : 0.22;
  t.generationCallback = (polar, uv, coord, color) => {
    d.setFromSpherical(polar);
    const mu = d.dot(s);
    if (d.y >= 0) {
      color.copy(hor).lerp(zen, Math.pow(Math.max(0, d.y), 0.42));
      color.lerp(haze, Math.pow(Math.max(0, mu), 8) * 0.55 + Math.pow(1 - Math.max(0, d.y), 6) * 0.25);
      color.multiplyScalar(AMB);
      if (mu > cosR2) color.lerp(haze.clone().multiplyScalar(AMB * 3), Math.pow((mu - cosR2) / (1 - cosR2), 2));  // the glow round the sun (the sun itself is a light)
    } else color.copy(hor).multiplyScalar(AMB).lerp(gnd, Math.min(1, Math.pow(-d.y, 0.3)));
  };
  t.update();
  return t;
}

/* rebuild what the viewer exported with physical, detailed materials */
function physicalize(root, opts) {
  opts = Object.assign({}, opts, { dbg: opts.dbg || (typeof window !== 'undefined' && window.P3SR_DBG) || {} });
  const K = kit(), lights = [], cache = new Map(), box = new THREE.Box3(), size = new THREE.Vector3(), ctr = new THREE.Vector3();
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  root.updateMatrixWorld(true);
  const meshes = []; root.traverse(o => { if (o.isLine || o.isLineSegments || o.isPoints || o.isSprite) o.visible = false; else if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m) continue;
    box.setFromObject(o); box.getSize(size);
    const flat = size.y < 0.15 && size.x > 2 && size.z > 2;
    if (flat && size.x > 130 && size.z > 130) { o.visible = false; continue; }  // the viewer's plain ground: replaced by real grass / concrete
    const isLight = !!(o.userData && o.userData.light);
    let role = 'generic';
    if (isLight) role = 'light';
    else if (m.transparent && m.opacity < 0.65 && !m.map) role = 'glass';
    else if ((m.metalness || 0) > 0.5) role = 'steel';
    else if (m.map) role = 'textured';
    else if (lum(m.color) < 0.05) role = 'rubber';
    else if (flat && lum(m.color) < 0.55) role = 'epoxy';
    else if (lum(m.color) > 0.35) role = 'paint';
    if (opts.dbg && opts.dbg.noRole && opts.dbg.noRole.includes(role)) role = 'generic';
    const key = m.uuid + '|' + role;
    let out = cache.get(key);
    if (!out) {
      // light panels: in walk view they glow softly (the area lights below them do the real lighting); in daylight views they're white lenses
      if (role === 'light') out = opts.view === 'walk' ? new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff8ee, emissiveIntensity: 1.6, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: 0xf4f6f7, roughness: 0.5 });
      else if (role === 'glass') out = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.93, 0.98, 0.97), metalness: 0, roughness: 0.01, transmission: 1, ior: 1.52, thickness: 0.04, specularIntensity: 1, side: THREE.DoubleSide });
      else {
        out = new THREE.MeshPhysicalMaterial({ color: m.color.clone(), map: m.map || null, roughness: m.roughness != null ? m.roughness : 0.7, metalness: m.metalness || 0, transparent: !!m.transparent && m.opacity < 0.99, opacity: m.opacity, side: m.side, emissive: m.emissive || new THREE.Color(0), emissiveMap: m.emissiveMap || null });
        if (out.map) out.map.colorSpace = THREE.SRGBColorSpace;
        if (role === 'steel') { out.metalness = 1; out.color.lerp(new THREE.Color(0.78, 0.79, 0.8), 0.6); out.roughness = 0.34; if (DETAIL.steel) { out.roughnessMap = K.brushR; out.normalMap = K.brushN; out.normalScale.set(0.35, 0.35); out.anisotropy = 0.8; } }
        else if (role === 'paint') { out.roughness = 0.55; if (DETAIL.paint) { out.roughnessMap = K.paintR; out.normalMap = K.paintN; out.normalScale.set(0.12, 0.12); out.clearcoat = 0.12; out.clearcoatRoughness = 0.35; } }
        else if (role === 'epoxy') { out.roughness = 0.38; if (DETAIL.epoxy) { out.roughnessMap = K.epoxyR; out.clearcoat = 0.85; out.clearcoatRoughness = 0.06; } }
        else if (role === 'rubber') { out.roughness = 0.62; if (DETAIL.rubber) { out.normalMap = K.paintN; out.normalScale.set(0.25, 0.25); out.sheen = 0.2; } }
        else if (role === 'textured') { const rel = reliefOf(m.map, opts.house ? 2.2 : 1.6); if (rel) { out.normalMap = rel; out.normalScale.set(0.8, 0.8); } out.roughness = Math.max(0.35, out.roughness); if (DETAIL.coat && out.roughness < 0.5) { out.clearcoat = 0.25; out.clearcoatRoughness = 0.2; } }
        else out.roughness = Math.max(0.45, out.roughness);
      }
      out.userData.role = role; cache.set(key, out);
    }
    o.material = out;
    // procedural detail needs real-world texture coordinates (about a 2′ tile; brushed steel finer)
    if (['paint', 'steel', 'epoxy', 'rubber'].includes(role)) worldUV(o, role === 'steel' ? 1.2 : role === 'epoxy' ? 6 : 2.5);
    // light panels become area lights shining down
    if (role === 'light' && opts.view === 'walk' && (!opts.camera || box.distanceToPoint(new THREE.Vector3().fromArray(opts.camera.position)) < 40)) { box.getCenter(ctr); if (size.x > 0.3 && size.z > 0.3 && size.y < 0.6) { const L = new THREE.RectAreaLight(0xfff6ea, 12, size.x * 0.96, size.z * 0.96); L.position.set(ctr.x, box.min.y - 0.02, ctr.z); L.lookAt(ctr.x, box.min.y - 10, ctr.z); lights.push(L); } }
  }
  return lights;
}

export async function open(opts) {
  const DBG = opts.dbg || (typeof window !== 'undefined' && window.P3SR_DBG) || {};
  if (!document.getElementById('p3sr-css')) { const st = document.createElement('style'); st.id = 'p3sr-css'; st.textContent = css; document.head.appendChild(st); }
  const el = document.createElement('div'); el.className = 'p3sr';
  el.innerHTML = `<div class="p3sr-bar"><b>✨ Super Render</b><select class="q" aria-label="Quality">${Object.entries(QUALITY).map(([k, q]) => `<option value="${k}">${q.label}</option>`).join('')}</select>
    <span class="p3sr-st">Getting the model ready…</span><span class="pb"><i></i></span><span class="sp"></span>
    <button class="save pri" disabled>Save image</button><button class="close">Close</button></div><div class="p3sr-stage"></div>`;
  document.body.appendChild(el);
  const stEl = el.querySelector('.p3sr-st'), pbEl = el.querySelector('.pb i'), qSel = el.querySelector('.q'), saveBtn = el.querySelector('.save'), stage = el.querySelector('.p3sr-stage');
  qSel.value = opts.quality || (opts.mobile ? 'draft' : 'high');
  let alive = true, raf = 0, pt = null, renderer = null;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { alive = false; cancelAnimationFrame(raf); try { pt && pt.dispose(); renderer && renderer.dispose(); } catch (e) { } el.remove(); document.removeEventListener('keydown', onKey); };
  document.addEventListener('keydown', onKey);
  el.querySelector('.close').onclick = close;
  const T0 = performance.now(); const step = (t) => { stEl.textContent = t; if (opts.log) console.warn('[p3sr] ' + Math.round(performance.now() - T0) + 'ms ' + t); return new Promise(r => setTimeout(r, 20)); };

  let gltf;
  try { gltf = await new GLTFLoader().parseAsync(opts.glb, ''); }
  catch (e) { stEl.textContent = 'Couldn’t read the model: ' + e.message; return { close }; }
  if (!alive) return { close };

  await step('Building materials and surface detail…');
  const scene = new THREE.Scene(), model = gltf.scene; scene.add(model);
  const ext = opts.view !== 'walk' && opts.view !== 'plenum';
  const lights = DBG.plain ? [] : physicalize(model, opts); lights.forEach(l => scene.add(l));
  const bb = new THREE.Box3().setFromObject(model), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());

  await step('Lighting the sky…');
  const sunDir = (opts.sunDir ? new THREE.Vector3().fromArray(opts.sunDir) : new THREE.Vector3(-0.5, 0.75, 0.4)).normalize();
  if (sunDir.y < 0.35) { sunDir.y = 0.35; sunDir.normalize(); }
  scene.environment = sky(sunDir, ext); scene.background = scene.environment;
  // the sun: sampled directly by the tracer, so shadows come out clean instead of speckled
  const sun = new THREE.DirectionalLight(0xfff0dc, ext ? 2.6 : 2.2); sun.position.copy(c).addScaledVector(sunDir, 300); sun.target.position.copy(c); scene.add(sun, sun.target);
  // what the building stands on: mown grass around a house, polished concrete under a cleanroom
  const K = kit(), R = Math.max(sz.x, sz.z) * 5 + 150;
  const gm = opts.house
    ? new THREE.MeshPhysicalMaterial({ map: K.grassC, normalMap: K.grassN, roughness: 0.95, sheen: 0.4, sheenColor: new THREE.Color(0.6, 0.8, 0.4), sheenRoughness: 0.6 })
    : new THREE.MeshPhysicalMaterial({ map: K.concC, normalMap: K.concN, roughnessMap: K.concR, roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.25, color: 0xb9b7b0 });
  if (DBG.g) { const k = DBG.g; if (k.indexOf('n') < 0) gm.normalMap = null; if (k.indexOf('c') < 0) { gm.clearcoat = 0; gm.sheen = 0; } if (k.indexOf('r') < 0) gm.roughnessMap = null; if (k.indexOf('m') < 0) gm.map = null; }
  const rep = R / (opts.house ? 6 : 10); [gm.map, gm.normalMap, gm.roughnessMap].forEach(t => { if (t) { t.repeat.set(rep, rep); } });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R, 96), DBG.plainGround ? new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 1 }) : gm); ground.rotation.x = -Math.PI / 2; ground.position.set(c.x, bb.min.y - 0.03, c.z); scene.add(ground);

  // the viewer's camera, as a physical camera: a little depth of field in walk view
  const cam = new PhysicalCamera(opts.camera.fov, opts.camera.aspect, 0.05, 3000);
  cam.position.fromArray(opts.camera.position); cam.quaternion.fromArray(opts.camera.quaternion); cam.updateMatrixWorld();
  if (!ext) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), cam);
    const hit = ray.intersectObject(model, true)[0]; cam.focusDistance = hit ? hit.distance : 12; cam.fStop = 2.8; cam.bokehSize = 0.03;
  } else { cam.fStop = 32; cam.bokehSize = 0; cam.focusDistance = cam.position.distanceTo(c); }

  const canvasEl = document.createElement('canvas'); stage.appendChild(canvasEl);
  renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = ext ? 1.0 : 1.25; renderer.outputColorSpace = THREE.SRGBColorSpace;

  pt = new WebGLPathTracer(renderer);
  pt.bounces = 9; pt.transmissiveBounces = 10; pt.filterGlossyFactor = 0.6; pt.minSamples = 1; pt.fadeDuration = 0; pt.renderDelay = 0; pt.multipleImportanceSampling = true;
  const dq = new FullScreenQuad(new DenoiseMaterial({ sigma: 2.2, threshold: 0.08, kSigma: 1.0 }));
  pt.renderToCanvasCallback = (target, r, quad) => { const ac = r.autoClear; r.autoClear = false; if (pt.samples >= 4 && !DBG.noDenoise) { dq.material.map = target.texture; dq.render(r); } else quad.render(r); r.autoClear = ac; };

  let target = 0, t0 = 0;
  const start = (q) => {
    const Q = q === 'test' ? TEST : q === 'test2' ? { w: 256, samples: 192 } : (QUALITY[q] || QUALITY.high), W = Q.w, H = Math.round(W / opts.camera.aspect);
    renderer.setPixelRatio(1); renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
    canvasEl.style.aspectRatio = W + ' / ' + H; const tl = W > 2400 ? 4 : W > 1400 ? 2 : 1; pt.tiles.set(tl, tl);
    target = Q.samples; t0 = performance.now(); saveBtn.disabled = true; pt.updateCamera(); pt.reset();
  };
  await step('Building the light paths…');
  try { await pt.setSceneAsync(scene, cam); } catch (e) { pt.setScene(scene, cam); }
  if (!alive) return { close };
  await step('starting');
  start(/^test/.test(opts.quality || '') ? opts.quality : qSel.value);
  qSel.onchange = () => start(qSel.value);
  saveBtn.onclick = () => canvasEl.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (opts.title || 'Plan3D') + ' - super render.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }, 'image/png');

  const fmt = (s) => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const loop = () => {
    if (!alive) return;
    if (pt.samples < target) {
      pt.renderSample();
      const n = Math.floor(pt.samples), el2 = (performance.now() - t0) / 1000;
      pbEl.style.width = (Math.min(1, n / target) * 100) + '%';
      stEl.textContent = n >= target ? `Done · ${target} samples · ${fmt(el2)}` : `Rendering · ${n} / ${target} samples · ${fmt(el2)}${n > 2 ? ' · about ' + fmt(el2 / Math.max(1, n) * (target - n)) + ' left' : ''}`;
      if (n >= 8) saveBtn.disabled = false;
    }
    raf = requestAnimationFrame(loop);
  };
  loop();
  return { close, get samples() { return pt.samples; }, canvas: canvasEl, setQuality: (q) => { qSel.value = q; start(q); } };
}

if (typeof window !== 'undefined') window.P3Super = { open };
