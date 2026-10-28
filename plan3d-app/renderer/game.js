/* Coll Plan3D · Coll Business Solutions LLC
   (internal) Drone extras. Loaded only by the desktop app; the walkthrough page and the phone viewer don't
   carry it. Started from the viewer's drone mode. */
(function (global) {
  'use strict';
  let CSS_DONE = false;
  const CSS = `
.p3g-on .p3v-panel,.p3g-on .p3v-bottom,.p3g-on .p3v-hint,.p3g-on .p3v-aim,.p3g-on .p3v-mlabels,.p3g-on .p3v-labels,.p3g-on .p3v-mhover,.p3g-on .p3v-modes{visibility:hidden!important}
.p3g-hud{position:absolute;inset:0;pointer-events:none;z-index:8;font-family:Consolas,"Cascadia Mono",ui-monospace,monospace;color:#c9ffe0;user-select:none;-webkit-user-select:none;overflow:hidden}
.p3g-hud *{box-sizing:border-box}
.p3g-tl{position:absolute;left:18px;top:16px;text-shadow:0 0 8px rgba(57,255,136,.55)}
.p3g-tl .t{font:900 13px/1 Consolas,monospace;letter-spacing:.32em;color:#39ff88}
.p3g-tl .s{font:800 34px/1.1 Consolas,monospace;color:#fff;margin-top:6px;letter-spacing:.04em}
.p3g-tl .r{font:700 13px/1.6 Consolas,monospace;color:#9fe8bd;letter-spacing:.12em}
.p3g-radar{position:absolute;right:18px;top:16px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(10,30,18,.78),rgba(4,14,8,.86));border:1px solid rgba(57,255,136,.55);box-shadow:0 0 18px rgba(57,255,136,.25),inset 0 0 22px rgba(57,255,136,.18)}
.p3g-hull{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);width:min(420px,70%);text-align:center}
.p3g-hull .l{font:800 11px/1 Consolas,monospace;letter-spacing:.34em;color:#39ff88;margin-bottom:6px;text-shadow:0 0 6px rgba(57,255,136,.6)}
.p3g-hull .bar{height:14px;border:1px solid rgba(57,255,136,.6);border-radius:3px;background:rgba(4,14,8,.7);padding:2px;box-shadow:0 0 12px rgba(57,255,136,.2)}
.p3g-hull .f{height:100%;width:100%;background:repeating-linear-gradient(90deg,#39ff88 0 14px,rgba(0,0,0,0) 14px 17px);transition:width .25s}
.p3g-hull.low .f{background:repeating-linear-gradient(90deg,#ff4d3d 0 14px,rgba(0,0,0,0) 14px 17px);animation:p3gblink .5s steps(2) infinite}
.p3g-hull.low .l{color:#ff6b5c}
@keyframes p3gblink{50%{opacity:.35}}
.p3g-x{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px}
.p3g-x i{position:absolute;background:#39ff88;box-shadow:0 0 6px #39ff88}
.p3g-x i:nth-child(1){left:22px;top:0;width:2px;height:13px}.p3g-x i:nth-child(2){left:22px;bottom:0;width:2px;height:13px}
.p3g-x i:nth-child(3){top:22px;left:0;height:2px;width:13px}.p3g-x i:nth-child(4){top:22px;right:0;height:2px;width:13px}
.p3g-x b{position:absolute;left:20px;top:20px;width:6px;height:6px;border-radius:50%;border:1px solid #39ff88}
.p3g-x.lock i,.p3g-x.lock b{background:#ff4d3d;border-color:#ff4d3d;box-shadow:0 0 8px #ff4d3d}
.p3g-msg{position:absolute;left:0;right:0;top:27%;text-align:center;font:900 34px/1.1 Consolas,monospace;letter-spacing:.18em;color:#fff;text-shadow:0 0 14px rgba(57,255,136,.9),0 0 2px #000;opacity:0;transition:opacity .35s}
.p3g-msg small{display:block;font:700 14px/1.8 Consolas,monospace;letter-spacing:.3em;color:#9fe8bd}
.p3g-msg.on{opacity:1}
.p3g-msl{position:absolute;left:0;right:0;top:calc(50% + 48px);text-align:center;font:900 18px Consolas,monospace;letter-spacing:.3em;color:#ff5a48;text-shadow:0 0 10px rgba(255,80,60,.9);opacity:0}
.p3g-pop{position:absolute;font:900 16px/1 Consolas,monospace;letter-spacing:.1em;color:#ffd84d;text-shadow:0 0 8px rgba(255,170,40,.9);transform:translate(-50%,-50%);transition:transform 1s ease-out,opacity 1s;white-space:nowrap}
.p3g-mk{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border:2px solid #ff4d3d;transform:rotate(45deg);box-shadow:0 0 8px rgba(255,77,61,.7)}
.p3g-mk span{position:absolute;left:34px;top:-4px;transform:rotate(-45deg);transform-origin:left top;font:700 11px Consolas,monospace;color:#ff8f84;white-space:nowrap}
.p3g-edge{position:absolute;width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:16px solid #ff4d3d;filter:drop-shadow(0 0 4px #ff4d3d)}
.p3g-vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(255,0,0,0) 45%,rgba(255,20,10,.55));opacity:0;transition:opacity .25s}
.p3g-beam{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 70%,rgba(57,255,136,.13),rgba(57,255,136,0) 60%);opacity:0;transition:opacity .2s}
.p3g-help{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);font:700 12px/1.6 Consolas,monospace;letter-spacing:.14em;color:#9fe8bd;background:rgba(4,14,8,.62);border:1px solid rgba(57,255,136,.35);border-radius:6px;padding:6px 14px;white-space:nowrap;transition:opacity 1s}
.p3g-over{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;padding:26px 40px;background:rgba(4,12,8,.84);border:1px solid rgba(57,255,136,.55);border-radius:12px;box-shadow:0 0 40px rgba(57,255,136,.25)}
.p3g-over .h{font:900 40px/1.1 Consolas,monospace;letter-spacing:.16em;color:#ff5a48;text-shadow:0 0 16px rgba(255,80,60,.8)}
.p3g-over .sc{font:800 22px/1.8 Consolas,monospace;color:#fff;margin-top:8px}
.p3g-over .k{font:700 13px/1.8 Consolas,monospace;letter-spacing:.2em;color:#9fe8bd}
.p3g-tb{position:absolute;right:20px;bottom:80px;display:flex;flex-direction:column;gap:14px;pointer-events:auto}
.p3g-tb button{width:78px;height:78px;border-radius:50%;border:2px solid #39ff88;background:rgba(4,14,8,.6);color:#c9ffe0;font:900 13px Consolas,monospace;letter-spacing:.1em;touch-action:none}
.p3g-tb button.fire{border-color:#ff5a48;color:#ffd0ca}
`;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function start(C) {
    const { THREE, scene, camera, drone, st, canvas, container, keys } = C;
    if (!CSS_DONE) { const el = document.createElement('style'); el.textContent = CSS; document.head.appendChild(el); CSS_DONE = true; }
    const B = C.bounds, cx = (B.minX + B.maxX) / 2, cz = (B.minZ + B.maxZ) / 2, span = Math.max(B.w || (B.maxX - B.minX), B.d || (B.maxZ - B.minZ), 40);
    const root = new THREE.Group(); root.name = 'p3g'; scene.add(root);
    container.classList.add('p3g-on');
    C.setBoost(1.15);

    // ---------------------------------------------------------------- textures
    function glowTex(stops, size) {
      const c = document.createElement('canvas'); c.width = c.height = size || 128; const g = c.getContext('2d'), h = c.width / 2;
      const gr = g.createRadialGradient(h, h, 0, h, h, h); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
      const t = new THREE.CanvasTexture(c); return t;
    }
    const TX = {
      fire: glowTex([[0, 'rgba(255,255,235,1)'], [0.18, 'rgba(255,226,120,.95)'], [0.45, 'rgba(255,120,30,.6)'], [0.75, 'rgba(200,40,10,.18)'], [1, 'rgba(120,20,0,0)']]),
      ball: glowTex([[0, 'rgba(255,250,210,1)'], [0.22, 'rgba(255,200,70,1)'], [0.5, 'rgba(250,110,20,.92)'], [0.75, 'rgba(170,45,10,.55)'], [1, 'rgba(60,20,10,0)']]),
      smoke: glowTex([[0, 'rgba(70,70,72,.85)'], [0.5, 'rgba(55,55,58,.5)'], [1, 'rgba(40,40,42,0)']]),
      green: glowTex([[0, 'rgba(230,255,240,1)'], [0.25, 'rgba(120,255,170,.8)'], [0.6, 'rgba(57,255,136,.25)'], [1, 'rgba(57,255,136,0)']]),
      spark: glowTex([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,220,140,.9)'], [1, 'rgba(255,140,40,0)']], 64),
      vapor: glowTex([[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(245,248,250,.45)'], [1, 'rgba(240,244,248,0)']], 64),
      scorch: glowTex([[0, 'rgba(20,16,12,.85)'], [0.55, 'rgba(30,24,18,.55)'], [1, 'rgba(30,24,18,0)']]),
      red: glowTex([[0, 'rgba(255,240,230,1)'], [0.3, 'rgba(255,110,70,.85)'], [1, 'rgba(255,40,20,0)']], 64)
    };
    // the tractor beam: soft bands that scroll up
    const beamCanvas = document.createElement('canvas'); beamCanvas.width = 64; beamCanvas.height = 256;
    { const g = beamCanvas.getContext('2d'); for (let y = 0; y < 256; y++) { const a = 0.22 + 0.22 * Math.sin(y / 256 * Math.PI * 8) ** 2; g.fillStyle = `rgba(120,255,170,${a})`; g.fillRect(0, y, 64, 1); } }
    const beamTex = new THREE.CanvasTexture(beamCanvas); beamTex.wrapS = beamTex.wrapT = THREE.RepeatWrapping;
    const NRM = (map, color, op) => new THREE.SpriteMaterial({ map, color: color || 0xffffff, transparent: true, opacity: op == null ? 1 : op, depthWrite: false });
    const ADD = (map, color, op) => new THREE.SpriteMaterial({ map, color: color || 0xffffff, transparent: true, opacity: op == null ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false });

    // ---------------------------------------------------------------- sound (made on the fly, no files)
    let AC = null, master = null, roar = null, beamSnd = null;
    function audio() {
      if (AC) return AC;
      try {
        AC = new (global.AudioContext || global.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.45; master.connect(AC.destination);
        const len = AC.sampleRate * 2, nb = AC.createBuffer(1, len, AC.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        AC.noise = nb;
        // jet roar: filtered noise whose loudness follows the nearest jet
        const src = AC.createBufferSource(); src.buffer = nb; src.loop = true; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.7;
        const gn = AC.createGain(); gn.gain.value = 0; src.connect(bp); bp.connect(gn); gn.connect(master); src.start(); roar = { src, bp, gn };
        // beam hum: two close tones beating, with a wobble
        const o1 = AC.createOscillator(), o2 = AC.createOscillator(), bg = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
        o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = 196; o2.frequency.value = 199.5; lfo.frequency.value = 6; lg.gain.value = 14; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
        bg.gain.value = 0; o1.connect(bg); o2.connect(bg); bg.connect(master); o1.start(); o2.start(); lfo.start(); beamSnd = { o1, o2, bg, lfo };
      } catch (e) { AC = null; }
      return AC;
    }
    function noiseHit(dur, f0, f1, vol, q, type) {
      if (!AC) return; const t = AC.currentTime, s = AC.createBufferSource(); s.buffer = AC.noise; const f = AC.createBiquadFilter(); f.type = type || 'lowpass'; f.Q.value = q || 0.8;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }
    function tone(type, f0, f1, dur, vol, at) {
      if (!AC) return; const t = AC.currentTime + (at || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    const SND = {
      gun: () => { noiseHit(0.07, 2600, 900, 0.22, 1.2, 'bandpass'); tone('square', 160, 70, 0.05, 0.05); },
      enemyGun: (v) => noiseHit(0.06, 1200, 500, 0.12 * v, 1, 'bandpass'),
      boom: (v) => { noiseHit(1.6, 900, 60, 0.9 * v); tone('sine', 90, 30, 0.9, 0.7 * v); },
      hit: () => { noiseHit(0.12, 3000, 400, 0.25, 0.6, 'highpass'); tone('sawtooth', 120, 50, 0.15, 0.12); },
      clang: () => noiseHit(0.05, 5000, 2500, 0.08, 2, 'bandpass'),
      bloop: () => { tone('sine', 300, 1400, 0.35, 0.25); tone('triangle', 600, 2400, 0.3, 0.08, 0.05); },
      alarm: () => { for (let i = 0; i < 3; i++) { tone('square', 880, 870, 0.14, 0.06, i * 0.32); tone('square', 660, 650, 0.14, 0.06, i * 0.32 + 0.16); } },
      missile: () => noiseHit(0.8, 1800, 600, 0.18, 1, 'bandpass'),
      over: () => { tone('sawtooth', 440, 110, 1.4, 0.12); tone('sawtooth', 330, 80, 1.6, 0.1, 0.1); }
    };

    // ---------------------------------------------------------------- the fighter jet
    const M = {
      skin: new THREE.MeshPhongMaterial({ color: 0x8e979f, specular: 0x9aa4ac, shininess: 70 }),
      dark: new THREE.MeshPhongMaterial({ color: 0x4d555c, specular: 0x666666, shininess: 50 }),
      metal: new THREE.MeshPhongMaterial({ color: 0x3a3d40, specular: 0xcfd6dc, shininess: 120 }),
      canopy: new THREE.MeshPhongMaterial({ color: 0x2a1d08, specular: 0xffe2a0, shininess: 160, transparent: true, opacity: 0.92 }),
      white: new THREE.MeshPhongMaterial({ color: 0xe9ecee, specular: 0xffffff, shininess: 90 }),
      stripe: new THREE.MeshPhongMaterial({ color: 0xff6a1f, specular: 0xffb070, shininess: 60, emissive: 0x401400 })
    };
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const flameCore = new THREE.MeshBasicMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    function shape(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; }
    const EX = (s, d) => new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.04, bevelSegments: 2 });
    function makeJet() {
      const J = new THREE.Group(), parts = [];
      const add = (geo, mat, pos, rot) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(pos[0], pos[1], pos[2]); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); J.add(m); parts.push(m); return m; };
      // fuselage: a smooth lathe profile, nose toward +z
      const prof = [[0, -8.4], [0.62, -8.2], [0.78, -7.4], [0.86, -5], [0.95, -1], [0.9, 2.5], [0.72, 4.8], [0.45, 6.6], [0.18, 7.8], [0, 8.5]].map(([r, y]) => new THREE.Vector2(r, y));
      add(new THREE.LatheGeometry(prof, 28), M.skin, [0, 0, 0], [Math.PI / 2, 0, 0]);
      // intakes on the sides
      for (const sd of [1, -1]) add(new THREE.BoxGeometry(0.42, 0.75, 4.6), M.dark, [sd * 0.92, -0.18, 0.2]);
      // canopy
      add(new THREE.SphereGeometry(0.62, 28, 16), M.canopy, [0, 0.62, 3.2], [0, 0, 0]).scale.set(0.9, 0.75, 2.6);
      add(new THREE.TorusGeometry(0.55, 0.05, 6, 24, Math.PI), M.metal, [0, 0.58, 2.2], [0, Math.PI / 2, 0]);
      // delta wings (each side), with an orange tip stripe
      for (const sd of [1, -1]) {
        const w = add(EX(shape([[0.7 * sd, 2.6], [7.4 * sd, -3.6], [7.4 * sd, -4.6], [0.7 * sd, -5.2]]), 0.14), M.skin, [0, -0.12, 0], [Math.PI / 2, 0, 0]);
        w.position.y = -0.05;
        add(new THREE.BoxGeometry(0.12, 0.2, 1.2), M.stripe, [sd * 7.42, -0.1, -4.05]);
        // a missile under each wing
        const ms = add(new THREE.CylinderGeometry(0.13, 0.13, 3, 12), M.white, [sd * 4.6, -0.42, -2.1], [Math.PI / 2, 0, 0]);
        add(new THREE.ConeGeometry(0.13, 0.5, 12), M.stripe, [sd * 4.6, -0.42, -0.35], [Math.PI / 2, 0, 0]);
        for (const fz of [-3.4]) add(new THREE.BoxGeometry(0.5, 0.04, 0.4), M.dark, [sd * 4.6, -0.42, fz]);
        void ms;
        // tail planes
        add(EX(shape([[0.6 * sd, -5.8], [3.4 * sd, -8.0], [3.4 * sd, -8.6], [0.6 * sd, -8.4]]), 0.1), M.skin, [0, -0.1, 0], [Math.PI / 2, 0, 0]);
      }
      // twin vertical fins, slightly canted out, with a stripe
      for (const sd of [1, -1]) {
        const f = add(EX(shape([[-4.6, 0], [-7.2, 3.1], [-8.1, 3.1], [-8.3, 0]]), 0.1), M.skin, [sd * 0.55, 0.3, 0], [0, -Math.PI / 2, sd * -0.22]);
        void f;
        add(new THREE.BoxGeometry(0.14, 0.35, 0.9), M.stripe, [sd * 1.18, 3.25, -7.65], [0, 0, sd * -0.22]);
      }
      // engine nozzles + afterburner flames
      const flames = [];
      for (const sd of [0.42, -0.42]) {
        add(new THREE.CylinderGeometry(0.42, 0.36, 1.1, 20, 1, true), M.metal, [sd, 0, -8.6], [Math.PI / 2, 0, 0]);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.34, 3.2, 16, 1, true), flameMat); fl.position.set(sd, 0, -10.6); fl.rotation.x = -Math.PI / 2; J.add(fl);
        const fc = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.6, 12, 1, true), flameCore); fc.position.set(sd, 0, -9.8); fc.rotation.x = -Math.PI / 2; J.add(fc);
        const glow = new THREE.Sprite(ADD(TX.fire, 0xffb060, 0.9)); glow.scale.set(2.6, 2.6, 1); glow.position.set(sd, 0, -9.3); J.add(glow);
        flames.push(fl, fc, glow);
      }
      // nav lights
      const nl = (c, x, y, z) => { const s = new THREE.Sprite(ADD(TX.spark, c, 1)); s.scale.set(0.9, 0.9, 1); s.position.set(x, y, z); J.add(s); return s; };
      const strobe = nl(0xffffff, 0, 3.4, -8.1); nl(0x35e06a, 7.45, -0.05, -3.9); nl(0xff3b30, -7.45, -0.05, -3.9);
      J.userData = { parts, flames, strobe };
      J.scale.setScalar(0.62);   // a little smaller than life, so a dogfight fits round a building
      return J;
    }

    // ---------------------------------------------------------------- the alien
    const AM = {
      skin: new THREE.MeshPhongMaterial({ color: 0x7be06a, specular: 0x335533, shininess: 30 }),
      eye: new THREE.MeshPhongMaterial({ color: 0x050607, specular: 0xffffff, shininess: 200 }),
      suit: new THREE.MeshPhongMaterial({ color: 0xb9c3cc, specular: 0xffffff, shininess: 110 }),
      tip: new THREE.MeshBasicMaterial({ color: 0xc8ffd8 })
    };
    function makeAlien() {
      const G = new THREE.Group(), body = new THREE.Group(); G.add(body);
      const add = (geo, mat, x, y, z, par) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); (par || body).add(m); return m; };
      add(new THREE.CylinderGeometry(0.32, 0.42, 1.05, 16), AM.suit, 0, 1.3, 0);
      add(new THREE.SphereGeometry(0.42, 16, 10), AM.suit, 0, 0.82, 0).scale.set(1, 0.6, 1);
      add(new THREE.CylinderGeometry(0.1, 0.12, 0.25, 10), AM.skin, 0, 1.9, 0);
      const head = add(new THREE.SphereGeometry(0.62, 26, 18), AM.skin, 0, 2.45, 0); head.scale.set(1, 1.18, 0.95);
      for (const sd of [1, -1]) {
        const e = add(new THREE.SphereGeometry(0.2, 16, 10), AM.eye, sd * 0.25, 2.42, 0.46); e.scale.set(1, 0.62, 0.5); e.rotation.z = sd * 0.5;
        const a = add(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 6), AM.skin, sd * 0.22, 3.2, 0); a.rotation.z = -sd * 0.35;
        add(new THREE.SphereGeometry(0.08, 10, 8), AM.tip, sd * 0.33, 3.48, 0);
      }
      const limbs = [];
      for (const sd of [1, -1]) {
        const arm = new THREE.Group(); arm.position.set(sd * 0.42, 1.72, 0); body.add(arm);
        add(new THREE.CylinderGeometry(0.07, 0.06, 0.95, 8), AM.skin, 0, -0.45, 0, arm);
        add(new THREE.SphereGeometry(0.1, 8, 6), AM.skin, 0, -0.95, 0, arm);
        const leg = new THREE.Group(); leg.position.set(sd * 0.18, 0.8, 0); body.add(leg);
        add(new THREE.CylinderGeometry(0.1, 0.08, 0.8, 8), AM.suit, 0, -0.4, 0, leg);
        add(new THREE.BoxGeometry(0.2, 0.08, 0.32), AM.suit, 0, -0.8, 0.06, leg);
        limbs.push({ arm, leg, sd });
      }
      // a soft shadow at its feet
      const sh = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; G.add(sh);
      G.userData = { body, limbs, sh };
      return G;
    }

    // ---------------------------------------------------------------- effects
    const fx = [];   // {obj, t, life, update(dt,k)}
    const flash = new THREE.PointLight(0xffaa55, 0, 90, 2); root.add(flash); let flashT = 0;
    function sprite(map, color, size, pos, op, normal) { const s = new THREE.Sprite(normal ? NRM(map, color, op) : ADD(map, color, op)); s.scale.set(size, size, 1); s.position.copy(pos); root.add(s); return s; }
    function addFx(obj, life, update) { fx.push({ obj, t: 0, life, update }); }
    function smokePuff(pos, size, life, rise, white) {
      const m = new THREE.SpriteMaterial({ map: white ? TX.green : TX.smoke, color: white ? 0xffffff : 0xffffff, transparent: true, opacity: white ? 0.35 : 0.7, depthWrite: false }); const s = new THREE.Sprite(m); s.position.copy(pos); s.scale.set(size, size, 1); root.add(s);
      const v = new THREE.Vector3(rnd(-1, 1), rise || rnd(1, 3), rnd(-1, 1)); const s0 = size;
      const o0 = m.opacity; if (white) { m.color.set(0xffffff); m.map = TX.vapor; }
      addFx(s, life, (dt, k) => { s.position.addScaledVector(v, dt); const z = s0 * (1 + k * 2.2); s.scale.set(z, z, 1); m.opacity = o0 * (1 - k); m.rotation += dt * 0.4; });
    }
    let shake = 0;
    function explode(pos, big) {
      const S = big ? 1.4 : 1;
      for (let i = 0; i < 7; i++) {
        const s = sprite(TX.ball, 0xffffff, rnd(3.5, 6) * S, pos.clone().add(new THREE.Vector3(rnd(-2, 2), rnd(-1.5, 1.5), rnd(-2, 2)).multiplyScalar(S)), 1, true);
        const s0 = s.scale.x, d = rnd(0, 0.15); s.material.opacity = 0; s.material.rotation = rnd(0, 6.28);
        // a hot core that blooms, reddens, then darkens into smoke
        addFx(s, 1.2 + rnd(0, 0.4), (dt, k, t) => { if (t < d) return; const kk = Math.min(1, (t - d) / 1.2); const z = s0 * (0.5 + kk * 1.6); s.scale.set(z, z, 1); s.material.opacity = kk < 0.15 ? kk / 0.15 : (1 - kk) ** 1.2; const c = 1 - kk * 0.75; s.material.color.setRGB(c + 0.25 * (1 - kk), c * 0.85, c * 0.7); s.position.y += dt * 2.5; });
      }
      for (let i = 0; i < 3; i++) {
        const s = sprite(TX.fire, 0xffffff, rnd(5, 8) * S, pos, 0.9);
        addFx(s, 0.35, (dt, k) => { const z = (6 + k * 6) * S; s.scale.set(z, z, 1); s.material.opacity = 0.9 * (1 - k); });
      }
      for (let i = 0; i < 26; i++) {
        const s = sprite(TX.spark, 0xffffff, rnd(0.5, 1.1), pos, 1), v = new THREE.Vector3(rnd(-1, 1), rnd(-0.4, 1.2), rnd(-1, 1)).normalize().multiplyScalar(rnd(20, 55) * S);
        addFx(s, rnd(0.6, 1.3), (dt, k) => { v.y -= 30 * dt; v.multiplyScalar(1 - dt * 1.4); s.position.addScaledVector(v, dt); s.material.opacity = 1 - k; });
      }
      for (let i = 0; i < 10; i++) setTimeout(() => smokePuff(pos.clone().add(new THREE.Vector3(rnd(-3, 3), rnd(-2, 2), rnd(-3, 3))), rnd(5, 8) * S, rnd(2.4, 3.6), rnd(1, 3)), 150 + i * 40);
      // a shock ring
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.4, 48), new THREE.MeshBasicMaterial({ color: 0xffd7a0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.position.copy(pos); ring.lookAt(camera.position); root.add(ring);
      ring.material.blending = THREE.NormalBlending; ring.material.color.set(0xfff0d0);
      addFx(ring, 0.45, (dt, k) => { const z = 1 + k * 7 * S; ring.scale.set(z, z, z); ring.material.opacity = 0.45 * (1 - k) ** 2; });
      flash.position.copy(pos); flash.intensity = 6 * S; flashT = 0.45;
      const d = camera.position.distanceTo(pos); shake = Math.max(shake, clamp(1.6 - d / 90, 0.15, 1.2) * S);
      SND.boom(clamp(1.3 - d / 220, 0.25, 1));
    }

    // ---------------------------------------------------------------- bullets & missiles
    const bulletGeo = new THREE.BoxGeometry(0.09, 0.09, 2.6);
    const myTracer = new THREE.MeshBasicMaterial({ color: 0x8dffbe, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const enTracer = new THREE.MeshBasicMaterial({ color: 0xffa060, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const bullets = [], myGlow = ADD(TX.green, 0xffffff, 0.8), enGlow = ADD(TX.red, 0xffffff, 0.8);
    function shoot(from, dir, speed, mine) {
      const m = new THREE.Mesh(bulletGeo, mine ? myTracer : enTracer); m.position.copy(from); m.lookAt(from.clone().add(dir)); root.add(m);
      const g = new THREE.Sprite(mine ? myGlow : enGlow); g.scale.set(1.2, 1.2, 1); m.add(g);
      bullets.push({ m, v: dir.clone().multiplyScalar(speed), life: mine ? 1.5 : 1.6, mine });
    }
    const missiles = [];
    const mslGeo = new THREE.CylinderGeometry(0.16, 0.16, 2.2, 10);
    function fireMissile(from, dir) {
      const g = new THREE.Group(); const body = new THREE.Mesh(mslGeo, M.white); body.rotation.x = Math.PI / 2; g.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 10), M.stripe); nose.rotation.x = Math.PI / 2; nose.position.z = 1.35; g.add(nose);
      const fl = new THREE.Sprite(ADD(TX.fire, 0xffc070, 1)); fl.scale.set(2, 2, 1); fl.position.z = -1.3; g.add(fl);
      g.position.copy(from); root.add(g); missiles.push({ g, dir: dir.clone().normalize(), speed: 30, life: 6, puff: 0 }); SND.missile();
    }

    // ---------------------------------------------------------------- HUD
    const hud = document.createElement('div'); hud.className = 'p3g-hud';
    hud.innerHTML = `<div class="p3g-vig"></div><div class="p3g-beam"></div>
      <div class="p3g-tl"><div class="t">AREA 51 · DEFENSE</div><div class="s">0</div><div class="r">WAVE 1 · 👽 0</div><div class="r b"></div></div>
      <canvas class="p3g-radar" width="300" height="300"></canvas>
      <div class="p3g-x"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="p3g-msg"></div><div class="p3g-msl">⚠ MISSILE LOCK</div>
      <div class="p3g-hull"><div class="l">HULL</div><div class="bar"><div class="f"></div></div></div>
      <div class="p3g-help">${C.touchy ? 'FIRE · BEAM over aliens · drag to aim' : 'HOLD X FIRE · GUNS LOCK ON AHEAD · HOLD B TRACTOR BEAM · G EXIT'}</div>
      ${C.touchy ? '<div class="p3g-tb"><button class="fire">FIRE</button><button class="beam">BEAM</button></div>' : ''}`;
    container.appendChild(hud);
    const H = (s) => hud.querySelector(s);
    const elScore = H('.p3g-tl .s'), elRow = H('.p3g-tl .r'), elBest = H('.p3g-tl .b'), elHull = H('.p3g-hull'), elFill = H('.p3g-hull .f'), elMsg = H('.p3g-msg'), elVig = H('.p3g-vig'), elBeamV = H('.p3g-beam'), elX = H('.p3g-x'), elMsl = H('.p3g-msl'), radar = H('.p3g-radar'), rg = radar.getContext('2d');
    setTimeout(() => { const h = H('.p3g-help'); if (h) h.style.opacity = '0'; }, 7000);
    let msgT = 0;
    function say(big, small, secs) { elMsg.innerHTML = big + (small ? `<small>${small}</small>` : ''); elMsg.classList.add('on'); msgT = secs || 2.2; }
    function pop(text, pos) {
      const p = pos.clone().project(camera); if (p.z > 1) return;
      const el = document.createElement('div'); el.className = 'p3g-pop'; el.textContent = text; const w = container.clientWidth, h = container.clientHeight;
      el.style.left = (p.x * 0.5 + 0.5) * w + 'px'; el.style.top = (-p.y * 0.5 + 0.5) * h + 'px'; hud.appendChild(el);
      requestAnimationFrame(() => { el.style.transform = 'translate(-50%,-180%)'; el.style.opacity = '0'; }); setTimeout(() => el.remove(), 1100);
    }
    const markers = [];
    function marker(i) { while (markers.length <= i) { const m = document.createElement('div'); m.className = 'p3g-mk'; m.innerHTML = '<span></span>'; const e = document.createElement('div'); e.className = 'p3g-edge'; hud.appendChild(m); hud.appendChild(e); markers.push({ m, e, s: m.querySelector('span') }); } return markers[i]; }
    // touch buttons
    let touchFire = false, touchBeam = false;
    if (C.touchy) {
      const fb = H('.p3g-tb .fire'), bb = H('.p3g-tb .beam');
      const hold = (el, set) => { el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); audio(); set(true); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => set(false)); };
      hold(fb, (v) => { touchFire = v; }); hold(bb, (v) => { touchBeam = v; });
    }

    // ---------------------------------------------------------------- game state
    let waveClear = false, score = 0, wave = 0, hull = 100, abducted = 0, dead = false, deadT = 0, waveT = 1.2, toSpawn = 0, spawnT = 0, fireT = 0, gunSide = 1, hitFlash = 0, time = 0, liftT = 0;
    let lastHit = -9, beamOn = false, streak = 0, lastKill = -9, mslWarn = 0, best = 0;
    try { best = +localStorage.getItem('p3g.best') || 0; } catch (e) { /* none */ }
    const jets = [], aliens = [];
    const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const dronePos = () => tmpV.set(st.x, st.y, st.z);
    const prevDrone = new THREE.Vector3(st.x, st.y, st.z), droneVel = new THREE.Vector3();

    function spawnJet() {
      const a = rnd(0, Math.PI * 2), r = span * 0.9 + rnd(90, 150);
      const J = makeJet(); J.position.set(cx + Math.cos(a) * r, rnd(30, 65), cz + Math.sin(a) * r); root.add(J);
      const dir = new THREE.Vector3(cx - J.position.x, rnd(-0.1, 0.05) * r, cz - J.position.z).normalize();
      const sp = 34 + Math.min(18, wave * 2.2);
      jets.push({ J, dir, speed: sp, hp: 4 + Math.floor(wave / 2), jink: 0, jinkV: new THREE.Vector3(), phase: 'attack', phaseT: 0, burst: 0, burstT: rnd(1.5, 3), shotT: 0, bank: 0, smokeT: 0, mslT: rnd(5, 9), dying: false });
    }
    // wanders the ground round the building (not through it)
    const ring = { x0: B.minX - 45, x1: B.maxX + 45, z0: B.minZ - 45, z1: B.maxZ + 45 };
    const insideBox = (x, z) => x > B.minX - 3 && x < B.maxX + 3 && z > B.minZ - 3 && z < B.maxZ + 3;
    function groundSpot(nearX, nearZ, rad) {
      for (let i = 0; i < 40; i++) {
        const x = nearX == null ? rnd(ring.x0, ring.x1) : nearX + rnd(-rad, rad), z = nearZ == null ? rnd(ring.z0, ring.z1) : nearZ + rnd(-rad, rad);
        if (x > ring.x0 && x < ring.x1 && z > ring.z0 && z < ring.z1 && !insideBox(x, z)) return [x, z];
      }
      return [B.minX - 20, B.minZ - 20];
    }
    function spawnAlien() {
      const G = makeAlien(), [x, z] = groundSpot(); G.position.set(x, 0, z); root.add(G);
      const [tx, tz] = groundSpot(x, z, 18); aliens.push({ G, tx, tz, walk: rnd(0, 6), state: 'walk', wait: 0, lift: 0, spin: 0 });
    }
    for (let i = 0; i < 8; i++) spawnAlien();

    // the tractor beam
    const beam = new THREE.Group(); beam.visible = false; root.add(beam);
    const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, color: 0x9dffc4, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beamCone = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1, 1, 40, 1, true), beamMat); beam.add(beamCone);
    const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 1, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xe8fff0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); beam.add(beamCore);
    const beamPool = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: TX.green, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); beamPool.rotation.x = -Math.PI / 2; root.add(beamPool); beamPool.visible = false;
    const beamLight = new THREE.PointLight(0x39ff88, 0, 40, 2); root.add(beamLight);
    const motes = []; for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(ADD(TX.green, 0xffffff, 0.8)); s.scale.set(0.35, 0.35, 1); s.visible = false; root.add(s); motes.push({ s, a: rnd(0, 6.28), r: rnd(0, 1), h: rnd(0, 1), v: rnd(0.25, 0.6) }); }

    // ---------------------------------------------------------------- input
    audio();
    say('AREA 51', 'HOSTILE AIRCRAFT INBOUND', 2.6);

    function restart() {
      for (const j of jets) root.remove(j.J); jets.length = 0;
      score = 0; wave = 0; hull = 100; dead = false; abducted = 0; streak = 0; waveClear = false; for (const m of missiles) root.remove(m.g); missiles.length = 0; waveT = 1; toSpawn = 0; C.setBoost(1.15); drone.visible = true;
      const o = H('.p3g-over'); if (o) o.remove(); say('AREA 51', 'HOSTILE AIRCRAFT INBOUND', 2.4);
    }

    function hurt(n) {
      if (dead) return; lastHit = time; hull = Math.max(0, hull - n); hitFlash = Math.min(1, 0.4 + n / 25); shake = Math.max(shake, 0.35); SND.hit();
      if (hull <= 0) {
        try { if (score >= best) localStorage.setItem('p3g.best', String(score)); } catch (e) { /* ok */ }
        dead = true; deadT = 0; C.setBoost(0); explode(new THREE.Vector3(st.x, st.y, st.z), true); SND.over(); drone.visible = false;
        const o = document.createElement('div'); o.className = 'p3g-over'; o.innerHTML = `<div class="h">DRONE DOWN</div><div class="sc">SCORE ${score.toLocaleString()} · WAVE ${wave} · 👽 ${abducted}</div><div class="k">${score >= best && score > 0 ? '★ NEW BEST ★' : 'BEST ' + best.toLocaleString()}</div><div class="k">${C.touchy ? 'TAP FIRE TO FLY AGAIN' : 'ENTER TO FLY AGAIN · G TO EXIT'}</div>`; hud.appendChild(o);
      }
    }

    // ---------------------------------------------------------------- the frame
    function step(dt) {
      if (!dt) return; time += dt;
      // a short climb to start, if you began near the floor
      if (liftT > 0) { liftT -= dt; st.y += dt * 14; }
      droneVel.set(st.x - prevDrone.x, st.y - prevDrone.y, st.z - prevDrone.z).divideScalar(Math.max(dt, 1e-3)); prevDrone.set(st.x, st.y, st.z);
      if (dead) { drone.visible = false; deadT += dt; if (touchFire && deadT > 1.2) restart(); }
      const D = dronePos().clone();

      // waves
      if (!dead && !jets.length && !toSpawn) { if (wave && !waveClear) { waveClear = true; const b = 500 * wave; score += b; hull = Math.min(100, hull + 25); say('WAVE ' + wave + ' CLEAR', '+' + b + ' · HULL REPAIRED', 2.6); tone('triangle', 440, 880, 0.3, 0.1); tone('triangle', 660, 1320, 0.35, 0.08, 0.15); waveT = 3.2; } waveT -= dt; if (waveT <= 0) { waveClear = false; wave++; toSpawn = Math.min(1 + wave, 9); spawnT = 0; say('WAVE ' + wave, wave === 1 ? 'SHOOT THEM DOWN · BEAM UP THE LOCALS' : 'MORE BANDITS INBOUND', 2.4); SND.alarm(); } }
      if (toSpawn) { spawnT -= dt; if (spawnT <= 0) { spawnJet(); toSpawn--; spawnT = 1.4; } }

      // our guns: aim through the crosshair, with a little help onto a jet near it
      const camFwd = camera.getWorldDirection(tmpV2).clone(), head = new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw));
      // the guns lock on to the jet nearest the nose: within about 25° either side, and well up or down
      let lockJ = null, bestS = 1e9;
      for (const j of jets) {
        if (j.dying) continue; const to = j.J.position.clone().sub(D), d = to.length(); if (d > 280) continue;
        const hz = Math.hypot(to.x, to.z), side = Math.acos(clamp((to.x * head.x + to.z * head.z) / Math.max(hz, 1e-6), -1, 1)), elev = Math.abs(Math.atan2(to.y, hz));
        if (side < 0.44 && elev < 1.0) { const sc = side * 2 + elev + d / 400; if (sc < bestS) { bestS = sc; lockJ = j; } }
      }
      elX.classList.toggle('lock', !!lockJ);
      fireT -= dt;
      if ((keys.has('x') || keys.has('enter') || touchFire) && !dead && fireT <= 0) {
        fireT = 1 / 11; gunSide = -gunSide;
        const right = new THREE.Vector3(Math.cos(st.yaw), 0, -Math.sin(st.yaw)), muzzle = D.clone().addScaledVector(right, gunSide * 0.35).add(new THREE.Vector3(0, -0.1, 0)).addScaledVector(new THREE.Vector3(-Math.sin(st.yaw), 0, -Math.cos(st.yaw)), 0.5);
        let aim = muzzle.clone().addScaledVector(head, 400);
        if (lockJ) { const t = lockJ.J.position.distanceTo(muzzle) / 320; aim = lockJ.J.position.clone().addScaledVector(lockJ.dir, lockJ.speed * t * 0.85); }
        shoot(muzzle, aim.sub(muzzle).normalize().add(new THREE.Vector3(rnd(-0.014, 0.014), rnd(-0.014, 0.014), rnd(-0.014, 0.014))).normalize(), 320, true);
        const mf = sprite(TX.green, 0xffffff, 1.1, muzzle, 1); addFx(mf, 0.06, (d2, k) => { mf.material.opacity = 1 - k; });
        SND.gun();
      }

      // jets
      let nearest = 1e9, closing = 0;
      for (let i = jets.length - 1; i >= 0; i--) {
        const j = jets[i], P = j.J.position;
        if (j.dying) {
          // falling and burning
          j.vy -= 32 * dt; P.addScaledVector(j.dir, j.speed * dt); P.y += j.vy * dt; j.J.rotateZ(j.spin * dt); j.J.rotateX(dt * 0.6);
          j.smokeT -= dt; if (j.smokeT <= 0) { j.smokeT = 0.05; smokePuff(P.clone(), 3, 2.2, 1); const f = sprite(TX.ball, 0xffffff, 2.6, P, 0.95, true); addFx(f, 0.3, (d2, k) => { f.material.opacity = 0.9 * (1 - k); }); }
          if (P.y <= 0.5 || (j.fall += dt) > 6) { P.y = Math.max(P.y, 1); explode(P.clone(), true); if (P.y < 3) scorch(P.x, P.z); root.remove(j.J); jets.splice(i, 1); }
          continue;
        }
        const to = D.clone().sub(P), dist = to.length();
        if (dist < nearest) { nearest = dist; closing = -to.clone().normalize().dot(j.dir.clone().multiplyScalar(j.speed).sub(droneVel)); }
        j.phaseT += dt;
        let want;
        if (j.phase === 'attack') {
          const lead = dist / 200; want = D.clone().addScaledVector(droneVel, lead).sub(P).normalize();
          if (dist < 22) { j.phase = 'extend'; j.phaseT = 0; j.ext = j.dir.clone().add(new THREE.Vector3(rnd(-0.6, 0.6), rnd(0.15, 0.45), rnd(-0.6, 0.6))).normalize(); }
        } else {
          want = j.ext; if (j.phaseT > rnd(2.2, 3.2)) j.phase = 'attack';
        }
        // under fire (hit, or you're lined up on it) a jet jinks hard one way, then the other
        j.jink -= dt; if ((j === lockJ || j.hitT > 0) && j.jink <= 0) { j.jink = rnd(0.7, 1.3); j.jinkV.set(rnd(-1, 1), rnd(-0.4, 0.6), rnd(-1, 1)).normalize().multiplyScalar(0.9); }
        if (j.jink > 0) want = want.clone().add(j.jinkV); j.hitT = (j.hitT || 0) - dt;
        if (P.y < 12) want.y += (12 - P.y) * 0.08; if (P.y > 110) want.y -= 0.3;
        want.normalize();
        // turn toward it at a jet's turn rate, banking into the turn
        const ang = j.dir.angleTo(want), maxT = (1.05 + Math.min(0.6, wave * 0.05)) * dt;
        const side = new THREE.Vector3().crossVectors(j.dir, want); const turnSign = Math.sign(side.y || 0);
        if (ang > 1e-4) { const axis = side.lengthSq() > 1e-10 ? side.normalize() : up; j.dir.applyAxisAngle(axis, Math.min(ang, maxT)).normalize(); }
        j.bank += ((clamp(ang / maxT * dt, 0, 1) * turnSign * 1.1) - j.bank) * Math.min(1, dt * 3);
        P.addScaledVector(j.dir, j.speed * dt);
        j.J.lookAt(P.clone().add(j.dir)); j.J.rotateZ(-j.bank);
        // guns: short bursts when lined up
        j.burstT -= dt;
        const toN = to.clone().normalize();
        if (!dead && j.phase === 'attack' && dist < 150 && dist > 24 && j.dir.angleTo(toN) < 0.22 && j.burstT <= 0 && !j.burst) { j.burst = 7; j.shotT = 0; }
        if (j.burst) { j.shotT -= dt; if (j.shotT <= 0) { j.shotT = 0.065; j.burst--; const nose = P.clone().addScaledVector(j.dir, 5); const aimD = D.clone().addScaledVector(droneVel, dist / 260).sub(nose).normalize().add(new THREE.Vector3(rnd(-0.022, 0.022), rnd(-0.022, 0.022), rnd(-0.022, 0.022))).normalize(); shoot(nose, aimD, 260, false); SND.enemyGun(clamp(1.4 - dist / 120, 0.2, 1)); if (!j.burst) j.burstT = rnd(2, 3.4) - Math.min(0.9, wave * 0.1); } }
        // from wave 3 on, now and then a heat-seeker
        if (wave >= 2 && !dead) { j.mslT -= dt; if (j.mslT <= 0 && dist < 160 && dist > 40) { j.mslT = rnd(7, 12); fireMissile(P.clone().addScaledVector(j.dir, 3).add(new THREE.Vector3(0, -0.6, 0)), j.dir); } }
        // flames flicker; strobe blinks
        const fl = j.J.userData.flames; const k = 0.85 + Math.random() * 0.3; for (let q = 0; q < fl.length; q++) { if (fl[q].isSprite) fl[q].material.opacity = 0.6 + Math.random() * 0.4; else fl[q].scale.set(1, k, 1); }
        j.J.userData.strobe.visible = ((time * 1.5 + i) % 1) < 0.08;
        if (Math.abs(j.bank) > 0.45) { j.trailT = (j.trailT || 0) - dt; if (j.trailT <= 0) { j.trailT = 0.035; for (const sd of [1, -1]) smokePuff(j.J.localToWorld(new THREE.Vector3(sd * 7.4, 0, -4.4)), 0.7, 1.3, 0.05, true); } }
        if (j.hp <= 1 && !j.dying) { j.smokeT -= dt; if (j.smokeT <= 0) { j.smokeT = 0.08; smokePuff(P.clone().addScaledVector(j.dir, -4), 1.6, 1.5, 0.5); } }
        // ramming the drone hurts both
        if (dist < 3.2 && !dead) { hurt(35); j.hp = 0; }
        if (j.hp <= 0) killJet(j);
      }
      // engine roar from the nearest jet, pitched by how fast it's closing
      if (roar && AC) { const v = dead ? 0 : clamp(1.15 - nearest / 140, 0, 1) ** 1.6 * 0.55; roar.gn.gain.setTargetAtTime(v, AC.currentTime, 0.08); roar.bp.frequency.setTargetAtTime(clamp(600 + closing * 9, 250, 1600), AC.currentTime, 0.1); }

      // bullets
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]; const p0 = b.m.position.clone(); b.m.position.addScaledVector(b.v, dt); b.life -= dt;
        let gone = b.life <= 0 || b.m.position.y < 0;
        if (!gone && b.mine) {
          for (const j of jets) { if (j.dying) continue; if (segDist(j.J.position, p0, b.m.position) < 3.4) { j.hp--; j.hitT = 0.6; gone = true; SND.clang(); const sp = sprite(TX.spark, 0xffffff, 2, b.m.position, 1); addFx(sp, 0.15, (d2, k) => { sp.material.opacity = 1 - k; }); if (j.hp <= 0) killJet(j); break; } }
        } else if (!gone && !dead) { if (segDist(D, p0, b.m.position) < 1.15) { gone = true; hurt(Math.round(3 + Math.min(4, wave * 0.6))); const sp = sprite(TX.spark, 0xffffff, 1.4, b.m.position, 1); addFx(sp, 0.12, (d2, k) => { sp.material.opacity = 1 - k; }); } }
        if (b.m.position.y < 0.1 && !gone) gone = true;
        if (gone) { root.remove(b.m); bullets.splice(i, 1); }
      }
      // missiles: chase the drone, but turn wide; outrun or dodge them
      for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i], P = m.g.position; m.life -= dt; m.speed = Math.min(52, m.speed + dt * 24);
        const want = D.clone().sub(P).normalize(), ang = m.dir.angleTo(want), ax = new THREE.Vector3().crossVectors(m.dir, want);
        if (ang > 1e-4 && ax.lengthSq() > 1e-10) m.dir.applyAxisAngle(ax.normalize(), Math.min(ang, 1.15 * dt)).normalize();
        const p0 = P.clone(); P.addScaledVector(m.dir, m.speed * dt); m.g.lookAt(P.clone().add(m.dir));
        m.puff -= dt; if (m.puff <= 0) { m.puff = 0.03; smokePuff(P.clone().addScaledVector(m.dir, -1.4), 0.9, 1.6, 0.3); }
        let boom = m.life <= 0 || P.y < 0.3;
        if (!dead && segDist(D, p0, P) < 2) { boom = true; hurt(25); }
        // shoot it down
        for (const b of bullets) if (b.mine && b.m.position.distanceTo(P) < 1.6) { boom = true; score += 50; pop('+50', P); }
        if (boom) { explode(P.clone(), false); root.remove(m.g); missiles.splice(i, 1); }
      }

      const warn = !dead && missiles.length > 0; mslWarn -= dt; if (warn && mslWarn <= 0) { mslWarn = 0.45; tone('square', 1320, 1300, 0.12, 0.05); } elMsl.style.opacity = warn ? (Math.sin(time * 14) > 0 ? '1' : '.35') : '0';
      // aliens and the tractor beam
      beamOn = !dead && (keys.has('b') || touchBeam);
      const bh = Math.max(0.5, st.y - 0.25), bR = 1 + bh * 0.16;
      beam.visible = beamPool.visible = beamOn;
      if (beamSnd && AC) beamSnd.bg.gain.setTargetAtTime(beamOn ? 0.12 : 0, AC.currentTime, 0.05);
      elBeamV.style.opacity = beamOn ? '1' : '0';
      if (beamOn) {
        beam.position.set(st.x, st.y - 0.25 - bh / 2, st.z); beamCone.scale.set(bR, bh, bR); beamCore.scale.set(bR * 0.5, bh, bR * 0.5);
        beamTex.offset.y = (beamTex.offset.y - dt * 0.8) % 1; beamTex.repeat.set(1, Math.max(1, bh / 6));
        beamPool.position.set(st.x, 0.05, st.z); beamPool.scale.setScalar(bR * 1.3); beamPool.material.opacity = 0.7 + Math.sin(time * 12) * 0.15;
        beamLight.position.set(st.x, 1.5, st.z); beamLight.intensity = 2.2;
        for (const m of motes) { m.h += m.v * dt; if (m.h > 1) { m.h = 0; m.a = rnd(0, 6.28); m.r = rnd(0, 1); } const r = bR * (1 - m.h * 0.7) * m.r, y = m.h * bh; m.s.visible = true; m.s.position.set(st.x + Math.cos(m.a + time) * r, y, st.z + Math.sin(m.a + time) * r); m.s.material.opacity = 0.9 * (1 - m.h); }
      } else { beamLight.intensity = 0; for (const m of motes) m.s.visible = false; }
      for (let i = aliens.length - 1; i >= 0; i--) {
        const a = aliens[i], G = a.G, U = G.userData, dx = G.position.x - st.x, dz = G.position.z - st.z, hd = Math.hypot(dx, dz);
        if (a.state === 'lift') {
          // up the beam, spinning, flailing; let go and it drops back down
          if (!beamOn) { a.state = 'fall'; a.vy = 0; }
          else {
            a.lift += dt; const k = Math.min(1, a.lift / 1.8);
            G.position.x += (st.x - G.position.x) * Math.min(1, dt * 3); G.position.z += (st.z - G.position.z) * Math.min(1, dt * 3);
            G.position.y += (st.y - 2.2 - G.position.y) * Math.min(1, dt * 1.6) + dt * 1.2; G.rotation.y += dt * 5; U.body.rotation.z = Math.sin(time * 9) * 0.3;
            U.limbs.forEach(l => { l.arm.rotation.z = l.sd * (2.4 + Math.sin(time * 20 + l.sd) * 0.4); l.leg.rotation.x = Math.sin(time * 16 * l.sd) * 0.6; });
            const s = 1 - k * 0.6; G.scale.setScalar(s); U.sh.visible = false;
            if (G.position.y > st.y - 2.6 || (k >= 1 && Math.abs(G.position.y - st.y) < 4)) {
              root.remove(G); aliens.splice(i, 1); abducted++; score += 250; hull = Math.min(100, hull + 8); SND.bloop(); pop('ABDUCTED +250', D);
              const g2 = sprite(TX.green, 0xffffff, 6, D, 1); addFx(g2, 0.5, (d2, kk) => { g2.material.opacity = 1 - kk; g2.scale.set(6 + kk * 8, 6 + kk * 8, 1); });
              setTimeout(() => { if (alive) spawnAlien(); }, 3000);
            }
          }
          continue;
        }
        if (a.state === 'fall') {
          a.vy -= 32 * dt; G.position.y += a.vy * dt; G.rotation.y += dt * 3;
          if (G.position.y <= 0) { G.position.y = 0; a.state = 'walk'; G.scale.setScalar(1); U.sh.visible = true; a.wait = 0.6; }
          continue;
        }
        if (beamOn && hd < bR + 0.4 && st.y < 80) { a.state = 'lift'; a.lift = 0; continue; }
        // they run from a low drone
        const scared = !dead && hd < 16 && st.y < 30;
        if (scared && a.state !== 'run') { a.state = 'run'; const k2 = 1 / Math.max(hd, 0.1); [a.tx, a.tz] = [G.position.x + dx * k2 * 25, G.position.z + dz * k2 * 25]; if (insideBox(a.tx, a.tz) || a.tx < ring.x0 || a.tx > ring.x1 || a.tz < ring.z0 || a.tz > ring.z1) [a.tx, a.tz] = groundSpot(G.position.x, G.position.z, 25); }
        if (a.wait > 0) { a.wait -= dt; U.limbs.forEach(l => { l.arm.rotation.z = l.sd * 0.15; l.leg.rotation.x = 0; }); continue; }
        const tx = a.tx - G.position.x, tz = a.tz - G.position.z, td = Math.hypot(tx, tz), sp = a.state === 'run' ? 8 : 2.6;
        if (td < 0.5) { a.state = 'walk'; a.wait = rnd(0.3, 2); [a.tx, a.tz] = groundSpot(G.position.x, G.position.z, 18); continue; }
        const nx = G.position.x + tx / td * sp * dt, nz = G.position.z + tz / td * sp * dt;
        if (insideBox(nx, nz)) { [a.tx, a.tz] = groundSpot(G.position.x, G.position.z, 18); continue; }
        G.position.x = nx; G.position.z = nz; G.rotation.y = Math.atan2(tx, tz);
        a.walk += dt * sp * 2.6; const sw = Math.sin(a.walk) * (a.state === 'run' ? 0.9 : 0.5);
        U.limbs.forEach(l => { l.leg.rotation.x = sw * l.sd; l.arm.rotation.x = -sw * l.sd * 0.8; l.arm.rotation.z = l.sd * (a.state === 'run' ? 1.2 : 0.12); });
        U.body.position.y = Math.abs(Math.sin(a.walk)) * 0.08;
      }

      // effects
      for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; const k = Math.min(1, f.t / f.life); f.update(dt, k, f.t); if (k >= 1) { root.remove(f.obj); if (f.obj.material && f.obj.material.dispose && f.obj.isSprite) f.obj.material.dispose(); fx.splice(i, 1); } }
      if (flashT > 0) { flashT -= dt; flash.intensity = Math.max(0, flash.intensity - dt * 14); } else flash.intensity = 0;
      if (shake > 0) { camera.position.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(shake * 0.35)); shake = Math.max(0, shake - dt * 2.2); }

      // the hull patches itself up slowly once you've been out of the fire a while
      if (!dead && time - lastHit > 6 && hull < 100) hull = Math.min(100, hull + dt * 2.5);
      // HUD
      hitFlash = Math.max(0, hitFlash - dt * 2.5); elVig.style.opacity = String(Math.max(hitFlash, hull < 30 && !dead ? 0.35 + Math.sin(time * 6) * 0.15 : 0));
      elScore.textContent = score.toLocaleString(); if (score > best) { best = score; } elBest.textContent = best ? 'BEST ' + best.toLocaleString() : ''; elRow.textContent = `WAVE ${Math.max(1, wave)} · 👽 ${abducted}`;
      elFill.style.width = hull.toFixed(1) + '%'; elHull.classList.toggle('low', hull < 30);
      if (msgT > 0) { msgT -= dt; if (msgT <= 0) elMsg.classList.remove('on'); }
      const w = container.clientWidth, h = container.clientHeight; let n = 0;
      for (const j of jets) {
        if (j.dying) continue; const mk = marker(n++), p = j.J.position.clone().project(camera), dist = j.J.position.distanceTo(D);
        const on = p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
        mk.m.style.display = on ? '' : 'none'; mk.e.style.display = on ? 'none' : '';
        if (on) { mk.m.style.left = (p.x * 0.5 + 0.5) * w + 'px'; mk.m.style.top = (-p.y * 0.5 + 0.5) * h + 'px'; mk.s.textContent = Math.round(dist) + ' FT'; mk.m.style.borderColor = j === lockJ ? '#ffd84d' : '#ff4d3d'; }
        else {
          // an arrow round the edge pointing toward it
          let ex = p.x, ey = p.y; if (p.z > 1) { ex = -ex; ey = -ey; } const a2 = Math.atan2(ey, ex), R = Math.min(w, h) * 0.42;
          mk.e.style.left = (w / 2 + Math.cos(a2) * R - 9) + 'px'; mk.e.style.top = (h / 2 - Math.sin(a2) * R - 8) + 'px'; mk.e.style.transform = `rotate(${Math.PI / 2 - a2}rad)`;
        }
      }
      for (let i = n; i < markers.length; i++) { markers[i].m.style.display = 'none'; markers[i].e.style.display = 'none'; }
      drawRadar();
    }
    function scorch(x, z) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ map: TX.scorch, transparent: true, opacity: 0.9, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z); m.scale.setScalar(rnd(6, 8)); root.add(m);
      addFx(m, 25, (dt, k) => { m.material.opacity = 0.9 * (1 - k * k); });
      for (let i = 0; i < 5; i++) setTimeout(() => { if (alive) smokePuff(new THREE.Vector3(x + rnd(-2, 2), 1, z + rnd(-2, 2)), 4, 4, 2.5); }, i * 500);
    }
    function killJet(j) {
      if (j.dying) return; j.dying = true; j.vy = 2; j.fall = 0; j.spin = rnd(-3, 3) || 2; j.smokeT = 0;
      const pts = 100 * Math.max(1, wave); score += pts; pop('BANDIT DOWN +' + pts, j.J.position);
      streak = time - lastKill < 4 ? streak + 1 : 1; lastKill = time;
      if (streak >= 2) { const n = ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'MULTI KILL', 'RAMPAGE'][Math.min(5, streak)] || 'UNSTOPPABLE'; const b = 150 * (streak - 1); score += b; say(n, '+' + b, 1.6); tone('square', 520, 1040, 0.18, 0.06); }
      explode(j.J.position.clone(), false);
      j.J.userData.flames.forEach(f => { f.visible = false; });
    }
    function segDist(p, a, b) { const ab = b.clone().sub(a), t = clamp(p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-9), 0, 1); return a.clone().addScaledVector(ab, t).distanceTo(p); }
    function drawRadar() {
      const S2 = 300, c = S2 / 2, R = 140, range = 260; rg.clearRect(0, 0, S2, S2);
      rg.strokeStyle = 'rgba(57,255,136,.28)'; rg.lineWidth = 1.5; for (const r of [R, R * 0.66, R * 0.33]) { rg.beginPath(); rg.arc(c, c, r, 0, Math.PI * 2); rg.stroke(); }
      rg.beginPath(); rg.moveTo(c - R, c); rg.lineTo(c + R, c); rg.moveTo(c, c - R); rg.lineTo(c, c + R); rg.stroke();
      const sw = (time * 2.2) % (Math.PI * 2), gr = rg.createConicGradient ? rg.createConicGradient(sw - 0.9, c, c) : null;
      if (gr) { gr.addColorStop(0, 'rgba(57,255,136,0)'); gr.addColorStop(0.14, 'rgba(57,255,136,.35)'); gr.addColorStop(0.15, 'rgba(57,255,136,0)'); rg.fillStyle = gr; rg.beginPath(); rg.arc(c, c, R, 0, Math.PI * 2); rg.fill(); }
      // the building
      const P = (x, z) => { const dx = x - st.x, dz = z - st.z, cs = Math.cos(st.yaw), sn = Math.sin(st.yaw); const rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; return [c + rx / range * R, c + rz / range * R]; };
      rg.strokeStyle = 'rgba(200,255,225,.6)'; rg.beginPath(); [[B.minX, B.minZ], [B.maxX, B.minZ], [B.maxX, B.maxZ], [B.minX, B.maxZ]].forEach(([x, z], i) => { const [u, v] = P(x, z); i ? rg.lineTo(u, v) : rg.moveTo(u, v); }); rg.closePath(); rg.stroke();
      const dot = (x, z, col, r) => { let [u, v] = P(x, z); const d = Math.hypot(u - c, v - c); if (d > R - 4) { u = c + (u - c) / d * (R - 4); v = c + (v - c) / d * (R - 4); } rg.fillStyle = col; rg.beginPath(); rg.arc(u, v, r, 0, Math.PI * 2); rg.fill(); };
      for (const a of aliens) dot(a.G.position.x, a.G.position.z, '#39ff88', 4);
      for (const j of jets) if (!j.dying) dot(j.J.position.x, j.J.position.z, '#ff4d3d', 7);
      for (const m of missiles) dot(m.g.position.x, m.g.position.z, '#ffd84d', 4);
      rg.fillStyle = '#ffffff'; rg.beginPath(); rg.moveTo(c, c - 10); rg.lineTo(c - 7, c + 8); rg.lineTo(c + 7, c + 8); rg.closePath(); rg.fill();
    }

    let alive = true;
    function key(k, e, isDown) {
      if (!alive) return false;
      if (!isDown) { return k === 'b' || k === 'x' || k === 'enter'; }
      audio();
      if (k === 'g' || k === 'escape') { if (!e.repeat) stop(); return true; }
      if (k === 'enter' && dead) { restart(); return true; }
      if (k === 'b' || k === 'x' || k === 'enter') { keys.add(k); return true; }
      if (k === 'm' || k === 'p' || k === 'l') return true;   // no measuring, snapshots or mouse look mid-fight
      return false;
    }
    function stop() {
      if (!alive) return; alive = false;
      keys.delete('b'); keys.delete('x'); keys.delete('enter');
      scene.remove(root);
      try { if (score > (+localStorage.getItem('p3g.best') || 0)) localStorage.setItem('p3g.best', String(score)); } catch (e) { /* ok */ }
      root.traverse(o => { if (o.geometry && o.geometry !== bulletGeo) o.geometry.dispose(); });
      hud.remove(); container.classList.remove('p3g-on'); drone.visible = true;
      try { if (roar) roar.gn.gain.value = 0; if (beamSnd) beamSnd.bg.gain.value = 0; if (AC) setTimeout(() => AC.close(), 200); } catch (e) { /* closed */ }
      C.ended();
    }
    return { step, key, stop };
  }
  global.P3Game = { start };
})(typeof window !== 'undefined' ? window : globalThis);
