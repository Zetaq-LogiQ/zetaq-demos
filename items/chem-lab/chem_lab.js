/* Chemistry Lab (ZetaQ demo): a bright 3D lab bench, six school experiments, one NEXT button (and Back).
   Look: physically based liquids (MeshPhysical transmission: they refract and tint the bench behind them, Beer-Lambert colour),
   thin clear glass (reflections of the room softboxes + darker edges, as real glass reads on a white bench), opaque bubbles and
   precipitate grains inside the liquid (seen through it), settling sediment, time-lapse clock.
   Shared ideas copied from our shipped sims (C7 Changes Lab, C8 Separation Lab: pour rig, bubbles, flame, desk clock, labels;
   lab_glassware kit profiles). All equations come from equations.js (tests/check_equations.mjs). Units: cm. */
import * as THREE from 'three';
import { OrbitControls } from './vendor/addons/OrbitControls.js';
import { RoomEnvironment } from './vendor/addons/RoomEnvironment.js';
import { EQ, INDICATORS } from './equations.js';

const Q = new URLSearchParams(location.search);
const TS = Math.max(1, +(Q.get('speed') || 1));          // animation speed (tests only)
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const seg = (u, a, b) => clamp((u - a) / (b - a));
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = c => new THREE.Color(c);
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ------------------------------------------------------------------ renderer + room
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .03).texture; scene.environmentIntensity = .85;
const tex = (draw, w = 256, h = 128) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
scene.background = tex((x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#F7FAFC'); g.addColorStop(.55, '#E8EFF3'); g.addColorStop(1, '#D9E3E9'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, 4, 256);
const camera = new THREE.PerspectiveCamera(34, 1, 1, 900);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = .14; controls.enablePan = false; controls.rotateSpeed = .7; controls.zoomSpeed = .6;
scene.add(new THREE.HemisphereLight('#FFFFFF', '#CBD5DC', .55));
const key = new THREE.DirectionalLight('#FFF7EE', 2.1); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0005; key.shadow.normalBias = .02; key.shadow.radius = 4;
Object.assign(key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 10, far: 220 }); scene.add(key, key.target);
const fill = new THREE.DirectionalLight('#E4F0FF', .6); scene.add(fill, fill.target);

function noiseTex(base, amt, seed, rep = 4, n = 2600, sz = 256) { return tex((x, w, h) => { const R = mulberry(seed); x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { const a = R() > .5 ? 255 : 0; x.fillStyle = `rgba(${a},${a},${a},${R() * amt})`; x.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); } }, sz, sz); }
function softTex(stops) { return tex((x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([k, c]) => g.addColorStop(k, c)); x.fillStyle = g; x.fillRect(0, 0, w, h); }, 128, 128); }
const SOFT = softTex([[0, 'rgba(255,255,255,1)'], [.45, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]);
const BLOB = softTex([[0, 'rgba(40,55,65,.42)'], [.55, 'rgba(40,55,65,.18)'], [1, 'rgba(40,55,65,0)']]);
function blob(parent, r, x = 0, z = 0, k = 1) { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.6, r * 2.6), new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, depthWrite: false, opacity: k }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, .04, z); m.renderOrder = 1; parent.add(m); return m; }

// the room: white bench top (top surface y = 0), front edge band set lower, tiled splash-back, a shelf far behind (no coplanar faces)
const ROOM = new THREE.Group(); scene.add(ROOM);
{ const top = new THREE.Mesh(new THREE.BoxGeometry(200, 4, 80), new THREE.MeshStandardMaterial({ map: noiseTex('#EDF1F3', .05, 3, 6), roughness: .42, metalness: 0 }));
  top.position.set(0, -2, 0); top.receiveShadow = true; ROOM.add(top);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(200.6, 3, 1.2), new THREE.MeshStandardMaterial({ color: '#C9D3DA', roughness: .5 })); edge.position.set(0, -1.75, 40.3); ROOM.add(edge);
  const tt = tex((x, w, h) => { x.fillStyle = '#D5DEE4'; x.fillRect(0, 0, w, h); const R = mulberry(9); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 246 + (R() * 6 | 0); x.fillStyle = `rgb(${v},${v + 2},${v + 3})`; x.fillRect(i * 64 + 1.5, j * 64 + 1.5, 61, 61); } }, 256, 256);
  tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(200 / 40, 70 / 40);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(200, 70), new THREE.MeshStandardMaterial({ map: tt, roughness: .35 })); wall.position.set(0, 35, -34); wall.receiveShadow = true; ROOM.add(wall);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(120, 1.2, 9), new THREE.MeshStandardMaterial({ color: '#F4F6F7', roughness: .5 })); shelf.position.set(0, 40, -29); shelf.castShadow = shelf.receiveShadow = true; ROOM.add(shelf);
  const R = mulberry(4), cols = ['#6B3A12', '#E9EEF0', '#6B3A12', '#2D6FB0', '#E9EEF0', '#6B3A12'];
  for (let i = 0; i < 16; i++) { const r = 1.4 + R() * .9, h = 5 + R() * 3, m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: .25, metalness: .1 }));
    m.position.set(-55 + i * 7.2 + R() * 2, 40.6 + h / 2, -29 + (R() - .5) * 3); m.castShadow = true; ROOM.add(m); } }

// ------------------------------------------------------------------ materials
const steelMat = new THREE.MeshStandardMaterial({ color: '#C7CFD6', metalness: 1, roughness: .26 });
const darkMat = new THREE.MeshStandardMaterial({ color: '#3A4650', roughness: .45, metalness: .3 });
const woodMat = new THREE.MeshStandardMaterial({ map: noiseTex('#C49A6C', .1, 41, 2), roughness: .62 });
const corkMat = new THREE.MeshStandardMaterial({ map: noiseTex('#B98756', .25, 91, 1, 1600), roughness: .9 });
const rubberMat = new THREE.MeshStandardMaterial({ color: '#D2453A', roughness: .55 });
const tileMat = new THREE.MeshPhysicalMaterial({ color: '#FFFFFF', roughness: .2, clearcoat: .6, clearcoatRoughness: .15 });
/* clear glass: no body colour in the middle, reflections of the room (softbox stripes, sun glint) added on top, and a little more
   absorption at grazing angles so the outline reads on a white bench. Blend = premultiplied (reflection adds, body barely tints). */
function glassMat(o = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: o.tint ?? '#6F8E98', roughness: .03, metalness: 0, ior: 1.5, specularIntensity: 1, envMapIntensity: o.env ?? .9, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  const base = o.base ?? .0, edge = o.edge ?? .3, spec = o.spec ?? .3;
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
    `float zqF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
     float zqA = clamp(${base.toFixed(3)} + ${edge.toFixed(3)} * zqF, 0.0, 1.0);
     gl_FragColor = vec4(totalDiffuse * zqA + totalSpecular * ${spec.toFixed(3)} * (0.4 + 1.6 * zqF), zqA);`); };
  m.customProgramCacheKey = () => `zqglass${base}${edge}${spec}`;
  return m; }
const GLASS = glassMat(), GLASS_THIN = glassMat({ edge: .45, base: .02, spec: .4 });
/* liquids: refraction through the volume (transmission), tint by colour + attenuation; milk = less transmission, rougher, whiter */
function liquidMat(col = '#FFFFFF', o = {}) {
  return new THREE.MeshPhysicalMaterial({ color: col, transmission: 1, thickness: o.th ?? 2, roughness: .04, ior: 1.33, attenuationColor: o.att ?? col, attenuationDistance: o.ad ?? 8,
    envMapIntensity: 1, specularIntensity: .9, side: o.side ?? THREE.FrontSide, clippingPlanes: o.clip ?? null }); }
const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(.001, p[0]), p[1])), seg);
function mesh(geo, mat, parent, x = 0, y = 0, z = 0, shadow = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent && parent.add(m); return m; }
const cylG = (r0, r1, h, s = 32) => new THREE.CylinderGeometry(r0, r1, h, s);

// ------------------------------------------------------------------ glassware: thick-wall lathe profiles. userData: rIn(y), floor, top
function rInFrom(inner) { const p = inner.slice().sort((a, b) => a[1] - b[1]);
  return y => { if (y <= p[0][1]) return p[0][0]; for (let i = 1; i < p.length; i++) if (y <= p[i][1]) { const a = p[i - 1], b = p[i], k = (y - a[1]) / Math.max(1e-6, b[1] - a[1]); return a[0] + (b[0] - a[0]) * k; } return p[p.length - 1][0]; }; }
function glassVessel(outer, inner, o = {}) {   // outer: axis-bottom -> rim; inner: rim -> axis-bottom
  const g = new THREE.Group(), top = outer[outer.length - 1], lipR = (top[0] + inner[0][0]) / 2, th = top[0] - inner[0][0];
  const pts = [...outer];
  for (let i = 1; i < 6; i++) { const a = i / 6 * Math.PI; pts.push([lipR + Math.cos(a) * th / 2 * 1.15, top[1] + Math.sin(a) * th * .6]); }
  pts.push(...inner);
  const m = new THREE.Mesh(lathe(pts, o.seg ?? 64), o.mat ?? GLASS); m.position.y = .03; m.renderOrder = 6; m.castShadow = false; m.userData.glass = true; g.add(m);
  const floor = inner[inner.length - 1][1];
  g.userData = { rIn: rInFrom(inner), floor, top: top[1], rTop: inner[0][0], rOut: Math.max(...outer.map(p => p[0])), glass: m };
  if (o.blob !== false) blob(g, g.userData.rOut, 0, 0, o.blobK ?? .8);
  return g; }
function testTube(r = 1.3, h = 15, o = {}) { const th = o.th ?? .1, out = [], inn = [[r - th, h]];
  for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; out.push([r * Math.sin(a), r - r * Math.cos(a)]); } out.push([r, h]);
  for (let i = 10; i >= 0; i--) { const a = i / 10 * Math.PI / 2; inn.push([(r - th) * Math.sin(a), r - (r - th) * Math.cos(a)]); }
  return glassVessel(out, inn, { blob: o.blob, seg: 48 }); }
function beaker(r = 3, h = 7.5, o = {}) { const th = o.th ?? .13, f = .3;
  const g = glassVessel([[0, 0], [r - f, 0], [r - f * .3, f * .3], [r, f], [r, h]], [[r - th, h], [r - th, f + th], [r - th - f * .3, th + f * .3], [r - th - f, th], [0, th]]);
  // printed graduation marks (enamel, as on real beakers)
  const mk = new THREE.MeshBasicMaterial({ color: '#2F4E5C', transparent: true, opacity: .75, depthWrite: false });
  for (let i = 1; i <= 4; i++) { const y = h * (.16 + i * .16), len = i % 2 ? .7 : .45, a0 = -Math.PI * .75; const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + .012, r + .012, .07, 24, 1, true, a0, len), mk); ring.position.y = y; ring.renderOrder = 7; g.add(ring); }
  return g; }
function conicalFlask(R = 3.8, h = 12.5, nr = 1.3, o = {}) { const th = .13, nb = h * .64;
  const out = [[0, 0], [R - .45, 0], [R - .12, .12], [R, .5], [nr + .35, nb], [nr + .05, nb + .5], [nr, nb + 1], [nr, h]];
  const inn = out.slice(1).reverse().map(([r, y]) => [Math.max(.05, r - th), y < .3 ? y + th : y]); inn[inn.length - 1][1] = th + .1; inn.push([0, th]);
  return glassVessel(out, inn); }
/* a liquid in a vessel: concave meniscus at the wall; setLevel / setLook; tilt mode = full-volume mesh clipped at a world height (pouring) */
class Liquid {
  constructor(vessel, col, o = {}) {
    this.U = vessel.userData; this.vessel = vessel; this.men = o.men ?? Math.min(.22, this.U.rTop * .14); this.level = null;
    this.base = C(col); this.att = C(o.att ?? col); this.ad = o.ad ?? 8;
    this.mat = liquidMat(col, { th: this.U.rTop * 1.6, att: o.att, ad: this.ad }); this.m = new THREE.Mesh(new THREE.BufferGeometry(), this.mat); this.m.renderOrder = 2; this.m.castShadow = false; vessel.add(this.m);
    this.milk = 0; this.col = C(col);
  }
  setLevel(y) { y = Math.max(this.U.floor + .05, y); if (this.level != null && Math.abs(y - this.level) < .003) return; this.level = y; const U = this.U, f = U.floor + .015, g = .02, pts = [[0, f]];
    for (let i = 1; i <= 18; i++) { const k = i / 18, yy = f + (y - f) * k * k * (3 - 2 * k) * .999; pts.push([Math.max(.002, U.rIn(yy) - g), yy]); }
    const r0 = Math.max(.01, U.rIn(y) - g), men = Math.min(this.men, (y - f) * .5);
    for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push([r0 * (1 - .3 * u), y + men * (1 - u) * (1 - u)]); }
    pts.push([0, y]); this.m.geometry.dispose(); this.m.geometry = lathe(pts, 48); this.m.visible = true; }
  hide() { this.m.visible = false; this.level = null; }
  setLook(col, milk = this.milk, ad) { this.col.set(col); this.milk = milk; const M = this.mat;
    M.color.copy(this.col).lerp(C('#F4F6F5'), milk * .9); M.attenuationColor.copy(this.col).lerp(C('#FFFFFF'), milk); if (ad != null) M.attenuationDistance = ad;
    M.transmission = lerp(1, .1, milk); M.roughness = lerp(.04, .55, milk); }
  tiltMode(on) {   // world-clipped full volume while the vessel is tipped
    if (on && !this.tm) { this.plane = new THREE.Plane(V(0, -1, 0), 0); const U = this.U, pts = [[0, U.floor + .02]];
      for (let i = 1; i <= 16; i++) { const yy = U.floor + .02 + (U.top - .2 - U.floor) * i / 16; pts.push([U.rIn(yy) - .02, yy]); } pts.push([0, U.top - .2]);
      this.tm = new THREE.Mesh(lathe(pts, 40), liquidMat('#FFFFFF', { side: THREE.DoubleSide, clip: [this.plane], th: 1.5 })); this.tm.renderOrder = 2; this.vessel.add(this.tm); }
    if (this.tm) { this.tm.visible = on; if (on) { this.tm.material.color.copy(this.mat.color); this.tm.material.attenuationColor.copy(this.mat.attenuationColor); } }
    this.m.visible = !on && this.level != null; }
  setCut(worldY) { if (this.plane) this.plane.constant = worldY; }
}
// a stream of liquid from a point down to a height (a thin transmissive column)
function streamMesh(parent, col = '#FFFFFF') { const m = new THREE.Mesh(new THREE.CylinderGeometry(.11, .08, 1, 12, 1, true), liquidMat(col, { th: .3, side: THREE.DoubleSide })); m.renderOrder = 3; m.visible = false; parent.add(m);
  m.userData.set = (on, from, toY) => { m.visible = on && from.y > toY; if (!m.visible) return; const L = from.y - toY; m.scale.y = L; m.position.set(from.x, toY + L / 2, from.z); }; return m; }
// bubbles: opaque shiny spheres INSIDE the liquid (the liquid's refraction shows them), rising and wobbling, popping at the surface
const bubbleMat = new THREE.MeshStandardMaterial({ color: '#F3FAFF', roughness: .06, metalness: 0, envMapIntensity: 2.2 });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function place(im, i, p, sc, rot = 0) { _e.set(rot, rot * 1.7, rot * .6); _q.setFromEuler(_e); _s.setScalar(sc); _m.compose(p, _q, _s); im.setMatrixAt(i, _m); }
class Bubbles {
  constructor(parent, n, o) { this.o = o; this.n = n; this.R = mulberry(o.seed ?? 7); this.acc = 0; this.P = [];
    this.m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), o.mat ?? bubbleMat, n); this.m.frustumCulled = false; this.m.castShadow = false; parent.add(this.m);
    for (let i = 0; i < n; i++) { this.P.push({ live: false, p: V(), v: 0, s: 0, ph: 0 }); place(this.m, i, V(), 0); } this.m.instanceMatrix.needsUpdate = true; }
  clear() { for (let i = 0; i < this.n; i++) { this.P[i].live = false; place(this.m, i, V(), 0); } this.m.instanceMatrix.needsUpdate = true; }
  update(dt, rate) { const o = this.o, R = this.R; this.acc = Math.min(4, this.acc + rate * dt);
    for (let i = 0; i < this.n && this.acc >= 1; i++) { const b = this.P[i]; if (b.live) continue; this.acc -= 1; b.live = true; const s = o.src(R);
      b.p.copy(s); b.v = (o.speed ?? 5) * (.6 + R() * .8); b.s = (o.size ?? .09) * (.5 + R() * .9); b.ph = R() * 6; }
    const top = o.top();
    for (let i = 0; i < this.n; i++) { const b = this.P[i]; if (!b.live) continue; b.p.y += b.v * dt; b.ph += dt * 8; b.p.x += Math.sin(b.ph) * .01; b.p.z += Math.cos(b.ph * .8) * .008;
      if (o.rIn) { const rr = Math.hypot(b.p.x - (o.cx ?? 0), b.p.z - (o.cz ?? 0)), lim = Math.max(.05, o.rIn(b.p.y) - b.s - .04); if (rr > lim) { const k = lim / rr; b.p.x = (o.cx ?? 0) + (b.p.x - (o.cx ?? 0)) * k; b.p.z = (o.cz ?? 0) + (b.p.z - (o.cz ?? 0)) * k; } }
      if (b.p.y > top - b.s * .3) { b.live = false; place(this.m, i, V(), 0); continue; } place(this.m, i, b.p, b.s); }
    this.m.instanceMatrix.needsUpdate = true; } }
// precipitate / suspension grains: deterministic from seeds. mix 0..1 = how many are formed, settle 0..1 = how far they have fallen
class Grains {
  constructor(parent, n, o) { this.o = o; this.n = n; const R = mulberry(o.seed ?? 11); this.S = [];
    this.m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: o.color ?? '#FFFFFF', roughness: .95 }), n); this.m.frustumCulled = false; this.m.castShadow = false; parent.add(this.m);
    for (let i = 0; i < n; i++) this.S.push({ a: R() * Math.PI * 2, r: Math.sqrt(R()), y: R(), k: R(), w: R() * 6, s: (o.size ?? .045) * (.6 + R() * .8) }); }
  update(t, mix, settle, floorH = 0) { const o = this.o, top = o.top(), fl = o.floor;
    for (let i = 0; i < this.n; i++) { const s = this.S[i]; if (s.k > mix || top < fl + .1) { place(this.m, i, V(), 0); continue; }
      const spread = clamp((mix - s.k) * 6), y0 = lerp(o.y0 ?? top, fl + .2 + s.y * (top - fl - .35), smooth(spread));
      const fall = clamp(settle * (1.3 + s.y * .8) - s.y * .5), yb = fl + .05 + s.s + Math.min(floorH, .9 * floorH * (1 - s.r * .5)) * .9;
      const y = lerp(y0, yb, fall * fall), rr = Math.max(.02, o.rIn(y) - .08) * s.r * lerp(spread, 1, .2);
      const jit = (1 - fall) * .12; place(this.m, i, V((o.cx ?? 0) + Math.cos(s.a + t * .15 * (1 - fall)) * rr + Math.sin(t * 1.3 + s.w) * jit, y + Math.sin(t * .9 + s.w) * jit, (o.cz ?? 0) + Math.sin(s.a + t * .15 * (1 - fall)) * rr), s.s, s.w); }
    this.m.instanceMatrix.needsUpdate = true; } }
// a solid layer at the bottom of a vessel (sediment, powder): a lathe from the floor up to h
function layerMesh(vessel, mat) { const U = vessel.userData, m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.castShadow = false; vessel.add(m); let last = -1;
  m.userData.set = h => { m.visible = h > .02; if (!m.visible || Math.abs(h - last) < .005) return; last = h; const f = U.floor + .02, pts = [[0, f]];
    for (let i = 1; i <= 8; i++) { const yy = f + h * i / 8; pts.push([Math.max(.01, U.rIn(yy) - .03), yy]); }
    pts.push([U.rIn(f + h) * .5, f + h + h * .12], [0, f + h + h * .16]); m.geometry.dispose(); m.geometry = lathe(pts, 40); }; return m; }
// a heap of powder on the floor of a vessel (mound)
function moundMesh(vessel, mat) { const U = vessel.userData, m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.castShadow = false; vessel.add(m); let last = -1;
  m.userData.set = (R, H) => { m.visible = H > .02; if (!m.visible || Math.abs(R + H - last) < .004) return; last = R + H; const f = U.floor + .01, pts = [];
    pts.push([0, f]); for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([R * (1 - u), f + H * Math.pow(Math.sin(u * Math.PI / 2), .8)]); }
    m.geometry.dispose(); m.geometry = lathe(pts, 32); }; return m; }

// ------------------------------------------------------------------ other apparatus
function labelTex(lines, o = {}) { return tex((x, w, h) => { x.fillStyle = o.bg ?? '#FBF8EF'; x.fillRect(0, 0, w, h); x.strokeStyle = o.line ?? '#2F6FB0'; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
  x.fillStyle = o.ink ?? '#14283A'; x.textAlign = 'center'; x.textBaseline = 'middle'; const fs = o.fs ?? 64; x.font = `700 ${fs}px "Segoe UI",Arial,sans-serif`;
  lines.forEach((s, i) => x.fillText(s, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.12)); }, o.w ?? 512, o.h ?? 256); }
function band(r, hgt, y, t, span = 1.6, parent) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hgt, 40, 1, true, -span / 2, span), new THREE.MeshStandardMaterial({ map: t, roughness: .7 })); m.position.y = y; m.rotation.y = 0; parent && parent.add(m); return m; }
/* reagent bottle (amber glass, ground stopper, paper label). mouthY = height of the mouth, for the pour rig */
function reagentBottle(lines, o = {}) { const g = new THREE.Group(), r = o.r ?? 2.2, h = o.h ?? 8, nr = r * .42;
  const body = new THREE.Mesh(lathe([[0, 0], [r - .3, 0], [r, .35], [r, h * .7], [r * .62, h * .86], [nr, h * .9], [nr, h], [nr - .14, h], [nr - .14, h * .9], [0, h * .9]], 48),
    new THREE.MeshPhysicalMaterial({ color: o.glass ?? '#5A2A0B', roughness: .08, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.6 })); body.castShadow = true; g.add(body);
  band(r + .02, h * .34, h * .4, labelTex(lines, { fs: lines.length > 1 ? 58 : 66, line: o.line }), 2.2, g);
  const stopper = mesh(lathe([[0, 0], [nr - .1, 0], [nr + .05, .7], [nr * 1.5, .9], [nr * 1.5, 1.3], [0, 1.4]], 24), new THREE.MeshPhysicalMaterial({ color: o.glass ?? '#4A230A', roughness: .15, clearcoat: 1 }), g, 0, h - .1, 0);
  blob(g, r, 0, 0, .8); g.userData = { mouthY: h, stopper }; return g; }
function dropperBottle(lines, col, o = {}) { const g = new THREE.Group(), r = 1.5, h = 4.2;
  g.add(new THREE.Mesh(lathe([[0, 0], [r - .2, 0], [r, .25], [r, h * .78], [.7, h], [0, h]], 32), new THREE.MeshPhysicalMaterial({ color: '#6B3A12', roughness: .1, clearcoat: 1, envMapIntensity: 1.5 })));
  band(r + .02, h * .5, h * .42, labelTex(lines, { fs: 50, w: 512, h: 256 }), 2.4, g); mesh(cylG(.6, .6, .5, 20), darkMat, g, 0, h + .2, 0); blob(g, r, 0, 0, .8); return g; }
/* a glass dropper: tube + red rubber teat. Tip at the origin. fill = the liquid inside (0..1) */
function dropper(col = '#FFFFFF') { const g = new THREE.Group();
  const glass = new THREE.Mesh(lathe([[.05, 0], [.12, .02], [.28, 1.3], [.32, 1.6], [.32, 6], [.4, 6.05], [.4, 6.2], [.26, 6.2], [.24, 6], [.24, 1.6], [.18, 1.3], [.03, .05]], 24), GLASS_THIN); glass.renderOrder = 6; g.add(glass);
  const liq = new THREE.Mesh(lathe([[0, .1], [.1, .12], [.2, 1.3], [.22, 1.6], [.22, 3], [0, 3]], 20), liquidMat(col, { th: .3 })); liq.renderOrder = 2; g.add(liq);
  const teat = mesh(lathe([[0, 0], [.42, 0], [.45, .6], [.55, 1.4], [.5, 2.4], [.28, 2.8], [0, 2.85]], 24), rubberMat, g, 0, 6.1, 0); g.userData = { teat, liq }; return g; }
/* a paper test strip (origin = the dipping end). setWet(len, colour) colours the wet part */
function strip(dry, o = {}) { const g = new THREE.Group(), W = o.w ?? .9, L = o.l ?? 6.5;
  const p = mesh(new THREE.BoxGeometry(W, L, .03), new THREE.MeshStandardMaterial({ color: dry, roughness: .9 }), g, 0, L / 2, 0); p.castShadow = true;
  const wm = new THREE.MeshStandardMaterial({ color: dry, roughness: .8 }), w = mesh(new THREE.BoxGeometry(W + .012, 1, .042), wm, g, 0, 0, 0, false); w.visible = false;
  g.userData = { dry: C(dry), L, setWet(len, col) { w.visible = len > .02; if (!w.visible) return; w.scale.y = len; w.position.y = len / 2; wm.color.set(col); } }; return g; }
function whiteTile(w = 16, d = 7, parent, x = 0, z = 0) { const m = mesh(new THREE.BoxGeometry(w, .6, d), tileMat, parent, x, .3, z); return m; }
/* a wooden test-tube rack: base board, a top board with holes (tubes stand on the base at y = .62), two end posts */
function rack(xs, parent, o = {}) { const g = new THREE.Group(), W = (o.w ?? Math.max(...xs.map(Math.abs)) * 2 + 4.4), D = 4.6, Ht = o.h ?? 7, r = (o.r ?? 1.3) + .15;
  mesh(new THREE.BoxGeometry(W, .6, D), woodMat, g, 0, .3, 0);
  const sh = new THREE.Shape(); sh.moveTo(-W / 2, -D / 2); sh.lineTo(W / 2, -D / 2); sh.lineTo(W / 2, D / 2); sh.lineTo(-W / 2, D / 2); sh.lineTo(-W / 2, -D / 2);
  for (const x of xs) { const h = new THREE.Path(); h.absarc(x, 0, r, 0, Math.PI * 2, true); sh.holes.push(h); }
  const top = mesh(new THREE.ExtrudeGeometry(sh, { depth: .55, bevelEnabled: false, curveSegments: 24 }), woodMat, g); top.rotation.x = -Math.PI / 2; top.position.y = Ht;
  for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.6, Ht - .6, D - .4), woodMat, g, s * (W / 2 - .3), .6 + (Ht - .6) / 2, 0);
  blob(g, W * .45, 0, 0, .6); parent && parent.add(g); g.userData.baseY = .62; return g; }
function flameMesh(o = {}) { const h = o.h ?? 2, r = o.r ?? .45, g = new THREE.Group();
  const mk = (rr, hh, col, tip, a, ord) => { const pts = []; for (let i = 0; i <= 18; i++) { const u = i / 18; pts.push(new THREE.Vector2(rr * Math.sin(Math.PI * Math.pow(u, .55)) * (1 - u * .35) + .001, u * hh)); }
    const m = new THREE.ShaderMaterial({ uniforms: { uCol: { value: C(col) }, uTip: { value: C(tip) }, uA: { value: a }, uH: { value: hh } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; uniform float uH; void main(){ vY = position.y / uH; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uCol; uniform vec3 uTip; uniform float uA; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.4); float a = uA * f * smoothstep(0., .12, vY) * (1. - smoothstep(.55, 1., vY)); gl_FragColor = vec4(mix(uCol, uTip, smoothstep(.3, 1., vY)) * a, a); }',
      transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, side: THREE.DoubleSide });
    const ms = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), m); ms.renderOrder = ord; g.add(ms); return ms; };
  const outer = mk(r, h, o.outer ?? '#FF8A1E', o.tip ?? '#FFC24A', o.aOuter ?? 1.1, 30), inner = mk(r * .5, h * .45, o.inner ?? '#FFE9A0', o.inner ?? '#FFF3C8', o.aInner ?? .9, 31);
  const light = new THREE.PointLight('#FFB060', 0, h * 8, 2); light.position.y = h * .4; g.add(light);
  g.userData.set = (t, k) => { g.visible = k > .01; light.intensity = (o.lightMax ?? 18) * k; if (!g.visible) return; const f = 1 + .06 * Math.sin(t * 9.1) + .04 * Math.sin(t * 14.7) + .02 * Math.sin(t * 23.3);
    g.scale.set(.6 + .4 * k, Math.max(.05, k * f), .6 + .4 * k); outer.rotation.z = .04 * Math.sin(t * 4.3); inner.rotation.z = outer.rotation.z * .5; };
  return g; }
function wisps(parent, n, color, size) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * n), 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: SOFT, transparent: true, opacity: .4, depthWrite: false, sizeAttenuation: true })); p.frustumCulled = false; p.renderOrder = 40; parent.add(p);
  const seeds = []; const R = mulberry(n * 7 + 3); for (let i = 0; i < n; i++) seeds.push([R(), R(), R()]);
  p.userData.update = (t, src, k, rise = 6, spread = 1.2) => { const a = geo.attributes.position.array; p.visible = k > .02; p.material.opacity = .4 * k;
    for (let i = 0; i < n; i++) { const s = seeds[i], u = (t * .3 + s[0]) % 1; a[3 * i] = src.x + (s[1] - .5) * spread * (1 + u * 2) + Math.sin(t + i) * .3 * u; a[3 * i + 1] = src.y + u * rise; a[3 * i + 2] = src.z + (s[2] - .5) * spread * (1 + u * 2); }
    geo.attributes.position.needsUpdate = true; };
  return p; }
function deskClock() { const g = new THREE.Group(), R = 2.6;
  const face = tex((x, w, h) => { x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h); x.strokeStyle = '#14283A'; x.fillStyle = '#14283A'; x.translate(w / 2, h / 2);
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r0 = i % 5 ? 216 : 190; x.lineWidth = i % 5 ? 4 : 12; x.beginPath(); x.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); x.lineTo(Math.sin(a) * 236, -Math.cos(a) * 236); x.stroke(); }
    x.font = '700 58px "Segoe UI",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; x.fillText(i, Math.sin(a) * 150, -Math.cos(a) * 150); } }, 512, 512);
  const body = mesh(new THREE.CylinderGeometry(R + .45, R + .45, 1.4, 48), new THREE.MeshStandardMaterial({ color: '#E8553D', roughness: .35, metalness: .1 }), g); body.rotation.x = Math.PI / 2;
  const f = mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ map: face, roughness: .5 }), g, 0, 0, .72, false);
  const hand = (L, w, z) => { const p = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(w, L, .05), new THREE.MeshStandardMaterial({ color: '#14283A', roughness: .4 })); m.position.y = L / 2 - .25; p.add(m); p.position.z = z; g.add(p); return p; };
  const hh = hand(1.45, .22, .78), mh = hand(2.15, .13, .84); mesh(new THREE.CylinderGeometry(.16, .16, .16, 16), darkMat, g, 0, 0, .9, false).rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) { const leg = mesh(cylG(.25, .35, 1.6, 12), darkMat, g, sx * 1.8, -R - .3, 0); leg.rotation.z = sx * .3; }
  g.userData.set = mins => { hh.rotation.z = -mins / 720 * Math.PI * 2; mh.rotation.z = -mins / 60 * Math.PI * 2; }; return g; }
function nailMesh(L = 6) { const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: '#9AA3AB', metalness: .85, roughness: .32 });
  const m = mesh(lathe([[0, 0], [.16, .55], [.17, L - .3], [.42, L - .25], [.42, L], [0, L + .02]], 20), mat, g); g.userData = { mat }; return g; }
function zincLump(R, seed) { const geo = new THREE.IcosahedronGeometry(R, 1), p = geo.attributes.position, rnd = mulberry(seed);
  for (let i = 0; i < p.count; i++) { const k = .72 + rnd() * .5; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * .85, p.getZ(i) * k); } geo.computeVertexNormals(); return geo; }
// pour rig: rotate about the mouth. u: 0-.3 move, .3-.5 tilt, .5-.8 pour, .8-1 back. dir +1 = the vessel sits right of the target
function pourRig(parent, obj, rest, mouthY) { const pv = new THREE.Group(); parent.add(pv); obj.position.y = -mouthY; pv.add(obj); pv.userData.rest = rest.clone().add(V(0, mouthY, 0)); pv.position.copy(pv.userData.rest); return pv; }
function pourPose(pv, u, to, tilt, dir) { const a = smooth(seg(u, 0, .3)), b = smooth(seg(u, .3, .48)), c = smooth(seg(u, .82, 1));
  pv.position.copy(pv.userData.rest).lerp(to, a); if (u > 0 && u < .3) pv.position.y += Math.sin(a * Math.PI) * 2; pv.position.lerp(pv.userData.rest, c); pv.rotation.z = dir * tilt * Math.max(0, b - c); return u > .47 && u < .83; }
// ------------------------------------------------------------------ HTML labels anchored to 3D points (kept below the card, inside the screen)
const LABELS = [];
function label(exp, html, anchor, show, cls = '') { const el = document.createElement('div'); el.className = 'lbl ' + cls; el.innerHTML = html; $('labels').appendChild(el);
  const L = { exp, el, anchor, show, set(h) { if (h !== L._h) { el.innerHTML = h; L._h = h; } } }; LABELS.push(L); return L; }
const _v = new THREE.Vector3();
function updateLabels() { const W = innerWidth, H = innerHeight, card = $('card').getBoundingClientRect(), barTop = $('bar').getBoundingClientRect().top; const placed = [];
  for (const L of LABELS) { const vis = L.exp === cur && L.show() && camReady && !introOpen;
    if (!vis) { L.el.style.display = 'none'; continue; }
    _v.copy(typeof L.anchor === 'function' ? L.anchor() : L.anchor); _v.project(camera); if (_v.z > 1) { L.el.style.display = 'none'; continue; }
    L.el.style.display = 'block'; const w = L.el.offsetWidth || 80, h = L.el.offsetHeight || 26;
    let x = (_v.x * .5 + .5) * W, y = (-_v.y * .5 + .5) * H - h;   // y = label top
    x = clamp(x, w / 2 + 8, W - w / 2 - 8); y = clamp(y, 8, barTop - h - 8);
    const overCard = (yy, xx) => yy < card.bottom + 6 && xx + w / 2 > card.left - 6 && xx - w / 2 < card.right + 6;
    if (overCard(y, x)) y = card.bottom + 8;
    for (const p of placed) if (Math.abs(p.x - x) < (p.w + w) / 2 + 4 && Math.abs(p.y - y) < h + 3) y = p.y + h + 4;
    y = Math.min(y, barTop - h - 8); placed.push({ x, y, w });
    L.el.style.transform = `translate(${Math.round(x - w / 2)}px,${Math.round(y)}px)`; } }

// ================================================================== experiments
const WORLD = new THREE.Group(); scene.add(WORLD);
const EXPS = [];
function exp(def) { const G = new THREE.Group(); G.visible = false; WORLD.add(G); const E = Object.assign({ G, s: {}, reset() { }, update() { } }, def); EXPS.push(E); return E; }
const lbl = (E, html, anchor, show, cls) => label(E, html, anchor, show, cls);
const at = (E, i) => cur === E && step === i, from = (E, i) => cur === E && step >= i, done = (E, i) => cur === E && (step > i || (step === i && !busy));
const GOG = 'Safety: wear goggles. Acids and bases can harm skin and eyes. Work with your teacher.';

// ---------------------------------------------------------------- 1. Acids, bases and indicators
{ const E = exp({ id: 'indicators', title: 'Acids, bases and indicators', cls: 'Classes 7 to 10' }); const G = E.G, s = E.s;
  const XA = -4.2, XB = 4.2, LV = 4.6, TZ = 7.2;
  const mk = x => { const b = beaker(3, 7.5); b.position.x = x; G.add(b); const l = new Liquid(b, '#FFFFFF', { att: '#E3F3F8', ad: 14 }); l.setLevel(LV); return { b, l }; };
  const A = mk(XA), B = mk(XB);
  whiteTile(17, 8, G, 0, TZ);
  const bottle = dropperBottle(['Phenol-', 'phthalein'], '#FFFFFF'); bottle.position.set(0, 0, -4.5); G.add(bottle);
  const drp = dropper('#FFFFFF'); G.add(drp);
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(.16, 12, 8), liquidMat('#FFFFFF', { th: .3 }), 4); drops.frustumCulled = false; G.add(drops);
  // strips: [kind, beaker side, slot on the tile]
  const LIT_B = '#3F5FB5', LIT_R = '#D23C4E', TUR = '#EFB300', TUR_R = '#A8331C';
  const S = {}; const slot = { blA: -6.6, rdA: -4.4, tuA: -2.2, blB: 2.2, rdB: 4.4, tuB: 6.6 };
  for (const [k, dry] of [['blA', LIT_B], ['blB', LIT_B], ['rdA', LIT_R], ['rdB', LIT_R], ['tuA', TUR], ['tuB', TUR]]) { S[k] = strip(dry); G.add(S[k]); }
  const wetCol = { blA: LIT_R, blB: '#34509E', rdA: '#BC3446', rdB: LIT_B, tuA: '#E2A600', tuB: TUR_R };
  E.reset = () => { s.dipBl = 0; s.dipRd = 0; s.dipTu = 0; s.ph = 0; s.pink = 0; };
  // a strip pair's path: from above the beaker, dip, lift, lay flat on the tile. u 0..1
  const stripPose = (st, x, slotX, u) => { const a = smooth(seg(u, 0, .22)), b = smooth(seg(u, .22, .38)), c = smooth(seg(u, .55, .74)), d = smooth(seg(u, .74, 1));
    const hi = LV + 5.4, p = V(x, lerp(18, LV + .6, a) - 3 * b + (hi - LV + 2.4) * c, 0);
    if (u >= .74) p.set(lerp(x, slotX, d), lerp(hi, .64, d) + Math.sin(d * Math.PI) * 2.5, lerp(0, TZ + 2.9, d));
    st.position.copy(p); st.rotation.set(-Math.PI / 2 * d, 0, 0); st.visible = u > 0; };
  const wetOf = (u, k) => { if (u < .3) return [0, null]; const t = smooth(seg(u, .3, .46)), c = S[k].userData.dry.clone().lerp(C(wetCol[k]), t); return [2.7, '#' + c.getHexString()]; };
  E.steps = [
    { text: 'Two clear liquids: dilute hydrochloric acid (an acid) and dilute sodium hydroxide (a base). They look the same.', safe: GOG, dur: 1.4, cam: { c: V(0, 3.6, 1), r: 8.6 }, apply(u) { } },
    { text: 'Dip blue litmus paper in each. In the acid it turns red. In the base it stays blue.', dur: 4.2, cam: { c: V(0, 3.4, 3), r: 10 }, apply(u) { s.dipBl = u; } },
    { text: 'Dip red litmus paper in each. In the base it turns blue. In the acid it stays red.', dur: 4.2, cam: { c: V(0, 3.4, 3), r: 10 }, apply(u) { s.dipRd = u; } },
    { text: 'Add two drops of phenolphthalein to each. The base turns pink. The acid stays colourless.', dur: 5, cam: { c: V(0, 4.4, 0), r: 8.4 }, apply(u) { s.ph = u; s.pink = smooth(seg(u, .74, .95)); } },
    { text: 'Dip turmeric paper in each. In the base it turns red-brown. In the acid it stays yellow.', dur: 4.2, cam: { c: V(0, 3.4, 3), r: 10 }, apply(u) { s.dipTu = u; } },
    { text: 'Indicators tell acids from bases by a change of colour.', dur: 1.2, result: true, cam: { c: V(0, 3.2, 3.2), r: 10.4 }, apply(u) { } }
  ];
  E.update = (dt, t) => {
    for (const [k, x, u] of [['blA', XA, s.dipBl], ['blB', XB, s.dipBl], ['rdA', XA, s.dipRd], ['rdB', XB, s.dipRd], ['tuA', XA, s.dipTu], ['tuB', XB, s.dipTu]]) {
      stripPose(S[k], x, slot[k], u); const [len, col] = wetOf(u, k); S[k].userData.setWet(len, col); }
    // dropper: bottle -> over A (2 drops) -> over B (2 drops) -> back
    const u = s.ph, home = V(0, 6.2, -4.5), oA = V(XA, 10.5, 0), oB = V(XB, 10.5, 0);
    let p = home.clone(); const k1 = smooth(seg(u, .02, .2)), k2 = smooth(seg(u, .42, .56)), k3 = smooth(seg(u, .84, 1));
    if (u > 0) { p = home.clone().lerp(oA, k1); p.lerp(oB, k2); p.lerp(home, k3); if (u < .2) p.y += Math.sin(k1 * Math.PI) * 2; }
    drp.position.copy(p); drp.visible = u > 0 && u < 1;
    const sq = Math.max(Math.sin(seg(u, .22, .38) * Math.PI), Math.sin(seg(u, .58, .74) * Math.PI)); drp.userData.teat.scale.set(1 - .25 * sq, 1, 1 - .25 * sq);
    for (let i = 0; i < 4; i++) { const st = [.24, .32, .6, .68][i], q = seg(u, st, st + .08), x = i < 2 ? XA : XB; place(drops, i, V(x, lerp(10.3, LV, q * q), 0), q > 0 && q < 1 ? 1 : 0); } drops.instanceMatrix.needsUpdate = true;
    B.l.setLook(C('#FFFFFF').lerp(C('#EE4DB4'), s.pink), 0, lerp(14, 5, s.pink));
  };
  lbl(E, 'dilute <b>hydrochloric acid</b>', () => V(XA, 8.6, 0), () => at(E, 0) || (at(E, 3) && busy));
  lbl(E, 'dilute <b>sodium hydroxide</b>', () => V(XB, 8.6, 0), () => at(E, 0) || (at(E, 3) && busy));
  lbl(E, '<b>acid</b>', () => V(XA, 8.4, 0), () => from(E, 1) && !at(E, 3));
  lbl(E, '<b>base</b>', () => V(XB, 8.4, 0), () => from(E, 1) && !at(E, 3));
  lbl(E, 'blue litmus: <b>red</b>', () => V(slot.blA, .8, TZ + 3.4), () => done(E, 1) && at(E, 1), 'r');
  lbl(E, 'stays <b>blue</b>', () => V(slot.blB, .8, TZ + 3.4), () => done(E, 1) && at(E, 1), 'bl');
  lbl(E, 'red litmus: <b>blue</b>', () => V(slot.rdB, .8, TZ + 3.4), () => done(E, 2) && at(E, 2), 'bl');
  lbl(E, 'stays <b>red</b>', () => V(slot.rdA, .8, TZ + 3.4), () => done(E, 2) && at(E, 2), 'r');
  lbl(E, '<b>pink</b>: a base', () => V(XB, 8.4, 0), () => done(E, 3) && at(E, 3), 'p');
  lbl(E, '<b>colourless</b>: an acid', () => V(XA, 8.4, 0), () => done(E, 3) && at(E, 3));
  lbl(E, 'turmeric: <b>red-brown</b>', () => V(slot.tuB, .8, TZ + 3.4), () => done(E, 4) && at(E, 4), 'r');
  lbl(E, 'stays <b>yellow</b>', () => V(slot.tuA, .8, TZ + 3.4), () => done(E, 4) && at(E, 4), 'y');
}

// ---------------------------------------------------------------- 2. Neutralisation
{ const E = exp({ id: 'neutral', title: 'Neutralisation', cls: 'Classes 7 and 10' }); const G = E.G, s = E.s;
  whiteTile(12, 10, G, 0, 0);
  const FL = new THREE.Group(); FL.position.y = .6; G.add(FL); const flask = conicalFlask(3.8, 12.5, 1.3); FL.add(flask);
  const liq = new Liquid(flask, '#FFFFFF', { att: '#E3F3F8', ad: 14 }); const LV = 3.0; liq.setLevel(LV);
  // burette (dilute HCl) in a clamp on a retort stand
  const BX = 0, TIP = 13.9, bur = new THREE.Group(); bur.position.set(BX, TIP, 0); G.add(bur);
  const bh = 42, br = .62, bth = .07;
  const bOut = [[.06, 0], [.1, .05], [.16, 1.4], [.3, 1.9], [.3, 2.6], [br, 3.3], [br, bh]], bIn = [[br - bth, bh], [br - bth, 3.35], [.23, 2.6], [.23, 1.9], [.1, 1.4], [.04, .05]];
  const bg = glassVessel(bOut, bIn, { blob: false, seg: 32 }); bur.add(bg);
  const bl = new THREE.Mesh(new THREE.BufferGeometry(), liquidMat('#FFFFFF', { th: 1, att: '#E3F3F8', ad: 14 })); bl.renderOrder = 2; bur.add(bl);
  const setBur = top => { bl.geometry.dispose(); bl.geometry = lathe([[0, 3.4], [br - bth - .02, 3.4], [br - bth - .02, top], [(br - bth) * .7, top + .05], [0, top]], 24); };
  const marks = new THREE.MeshBasicMaterial({ color: '#2F4E5C', transparent: true, opacity: .8, depthWrite: false });
  for (let i = 0; i <= 25; i++) { const y = 6 + i * 1.4, len = i % 5 ? .5 : .9, m = new THREE.Mesh(new THREE.CylinderGeometry(br + .01, br + .01, .05, 16, 1, true, -.3, len), marks); m.position.y = y; m.renderOrder = 7; bur.add(m); }
  const cock = mesh(cylG(.3, .3, 1.8, 16), new THREE.MeshStandardMaterial({ color: '#F2F4F5', roughness: .4 }), bur, 0, 2.25, 0); cock.rotation.z = Math.PI / 2;
  const handle = mesh(new THREE.BoxGeometry(.35, 1.4, .3), new THREE.MeshStandardMaterial({ color: '#2D6FB0', roughness: .4 }), bur, -1, 2.25, 0);
  const stand = new THREE.Group(); G.add(stand);
  mesh(new THREE.BoxGeometry(8, .8, 10), darkMat, stand, -10.5, .4, -1); mesh(cylG(.32, .32, 58, 16), steelMat, stand, -11, 29.8, -4);
  mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), darkMat, stand, -11, 30, -4); const arm = mesh(cylG(.2, .2, Math.hypot(11, 4), 10), steelMat, stand, -5.5, 30, -2); arm.quaternion.setFromUnitVectors(V(0, 1, 0), V(11, 0, 4).normalize());
  mesh(new THREE.BoxGeometry(1.5, 1.6, 1.6), darkMat, stand, 0, 30, 0); mesh(cylG(.75, .75, .5, 20), new THREE.MeshStandardMaterial({ color: '#3C4852', roughness: .6 }), stand, 0, 30, 0);
  // thermometer, leaning in the flask
  const th = new THREE.Group(); FL.add(th); th.position.set(.3, .45, -1.9); th.rotation.set(.085, 0, .02);
  const tg = new THREE.Mesh(lathe([[0, 0], [.2, .1], [.22, .9], [.15, 1.1], [.15, 15], [0, 15.2]], 20), GLASS_THIN); tg.renderOrder = 6; th.add(tg);
  mesh(new THREE.SphereGeometry(.17, 14, 10), new THREE.MeshStandardMaterial({ color: '#D0312D', roughness: .3 }), th, 0, .45, 0, false).scale.y = 1.9;
  const col = mesh(cylG(.05, .05, 1, 8), new THREE.MeshBasicMaterial({ color: '#D0312D' }), th, 0, 0, 0, false);
  for (let i = 0; i <= 10; i++) mesh(new THREE.BoxGeometry(i % 5 ? .12 : .2, .03, .02), new THREE.MeshBasicMaterial({ color: '#2F4E5C' }), th, .16, 4 + i * 1, .02, false);
  const tY = T => 1.2 + (T - 20) * .5; const setT = T => { const h = tY(T); col.scale.y = h; col.position.y = h / 2 + .45; };
  // phenolphthalein + NaOH dropper bottles, droppers, burette drops
  const bP = dropperBottle(['Phenol-', 'phthalein'], '#fff'); bP.position.set(7, 0, -3); G.add(bP);
  const bN = dropperBottle(['dilute', 'NaOH'], '#fff'); bN.position.set(9.8, 0, -1); G.add(bN);
  const d1 = dropper('#FFFFFF'); G.add(d1); const d2 = dropper('#FFFFFF'); G.add(d2);
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(.15, 12, 8), liquidMat('#FFFFFF', { th: .3 }), 8); drops.frustumCulled = false; G.add(drops);
  const PINK = '#EE4DB4';
  E.reset = () => { s.ph = 0; s.pink = 0; s.acid = 0; s.end = 0; s.back = 0; s.T = 27; s.drops = 0; };
  const dropperRun = (d, u, home, over) => { const a = smooth(seg(u, 0, .3)), c = smooth(seg(u, .75, 1)); const p = home.clone().lerp(over, a); p.lerp(home, c); if (u > 0 && u < .3) p.y += Math.sin(a * Math.PI) * 2.5;
    d.position.copy(p); d.visible = u > 0 && u < 1; const sq = Math.sin(seg(u, .32, .6) * Math.PI); d.userData.teat.scale.set(1 - .25 * sq, 1, 1 - .25 * sq); };
  E.steps = [
    { text: 'A flask of dilute sodium hydroxide (a base) on a white tile. Above it, a burette filled with dilute hydrochloric acid.', safe: GOG, dur: 1.4, cam: { c: V(-1, 13, 0), r: 15, el: .22 }, apply(u) { } },
    { text: 'Add two drops of phenolphthalein. The solution turns pink: it is basic.', dur: 4, cam: { c: V(0, 7, 0), r: 9.4 }, apply(u) { s.ph = u; s.pink = smooth(seg(u, .5, .9)); } },
    { text: 'Open the tap. The acid falls drop by drop. Swirl the flask: the pink slowly gets lighter.', dur: 6, cam: { c: V(0, 7.5, 0), r: 9.4 }, apply(u) { s.acid = u; s.pink = 1 - .72 * smooth(u); s.T = 27 + 2.4 * u; } },
    { text: 'One more drop and the pink just disappears. All the base is used up: the solution is neutral.', dur: 3.6, cam: { c: V(0, 7, 0), r: 9 }, apply(u) { s.acid = 1; s.end = u; s.pink = .28 * (1 - smooth(seg(u, .35, .8))); s.T = 29.4 + .6 * u; } },
    { text: 'Touch the flask: it is a little warm (27 °C to 30 °C). Neutralisation gives out heat.', dur: 2.2, cam: { c: V(.8, 9, 0), r: 8.5 }, apply(u) { s.T = 30; s.end = 1; s.pink = 0; s.acid = 1; } },
    { text: 'Add one drop of sodium hydroxide: the pink comes back. Now there is a little extra base again.', dur: 4, result: true, cam: { c: V(1, 7, 0), r: 9.6 }, apply(u) { s.T = 30; s.end = 1; s.acid = 1; s.back = u; s.pink = .5 * smooth(seg(u, .5, .85)); } }
  ];
  E.update = (dt, t) => {
    dropperRun(d1, s.ph, V(7, 5.6, -3), V(0, 15.2, .8)); dropperRun(d2, s.back, V(9.8, 5.6, -1), V(0, 15.2, .8));
    // drops: burette (steady while "acid", one last drop in "end"), the indicator dropper (2 drops), the NaOH dropper (1 drop)
    const surf = .6 + (liq.level ?? LV), fallTo = (k, x, y0, z, q) => place(drops, k, V(x, lerp(y0, surf, q * q), z), q > 0 && q < 1 ? 1 : 0);
    fallTo(0, BX, TIP - .1, 0, s.acid > 0 && s.acid < 1 ? ((s.acid * 22) % 1) / .7 : -1); fallTo(1, BX, TIP - .1, 0, seg(s.end, .05, .3));
    fallTo(2, 0, 15.1, .8, seg(s.ph, .34, .44)); fallTo(3, 0, 15.1, .8, seg(s.ph, .46, .56)); fallTo(4, 0, 15.1, .8, seg(s.back, .36, .5));
    drops.instanceMatrix.needsUpdate = true;
    const used = s.acid * .85 + s.end * .1, bt = bh - 4 - used * 3.5; if (Math.abs(bt - (E._bt ?? -1)) > .004) { setBur(bt); E._bt = bt; } handle.rotation.y = (s.acid > 0 && s.acid < 1) || (s.end > 0 && s.end < .4) ? Math.PI / 2 : 0;
    liq.setLevel(LV + .55 * s.acid + .1 * s.end + .05 * s.back);
    liq.setLook(C('#FFFFFF').lerp(C(PINK), s.pink), 0, lerp(14, 5, s.pink));
    const sw = (s.acid > 0 && s.acid < 1) ? 1 : 0; FL.position.x = .18 * Math.sin(t * 5) * sw; FL.position.z = .18 * Math.cos(t * 5) * sw;
    setT(s.T); tempL.set(`<b>${s.T.toFixed(0)} °C</b>`);
  };
  lbl(E, '<b>burette</b>: dilute hydrochloric acid', () => V(0, 22, 0), () => at(E, 0));
  lbl(E, 'dilute <b>sodium hydroxide</b>', () => V(0, 5.5, 3.6), () => at(E, 0));
  lbl(E, '<b>pink</b>: basic', () => V(-3.6, 3.6, 2.5), () => done(E, 1) && at(E, 1), 'p');
  lbl(E, 'pink <b>fading</b>', () => V(-3.6, 3.6, 2.5), () => at(E, 2) && !busy, 'p');
  lbl(E, '<b>colourless</b>: neutral', () => V(-3.6, 3.6, 2.5), () => (at(E, 3) && !busy) || at(E, 4));
  const tempL = lbl(E, '27 °C', () => th.localToWorld(V(.6, 13.5, 0)), () => from(E, 2) && !at(E, 5), 'r');
  lbl(E, 'pink <b>again</b>: extra base', () => V(-3.6, 3.6, 2.5), () => done(E, 5), 'p');
}

// ---------------------------------------------------------------- 3. Metal and acid: zinc + dilute hydrochloric acid, the pop test
{ const E = exp({ id: 'metal_acid', title: 'Metal and acid', cls: 'Classes 8 and 10' }); const G = E.G, s = E.s;
  const RK = rack([0], G, { w: 7 }); const tube = testTube(1.35, 15.5, { blob: false }); tube.position.y = .62; G.add(tube);
  const U = tube.userData, liq = new Liquid(tube, '#FFFFFF', { att: '#E6F4F8', ad: 14 }); liq.hide();
  const zm = new THREE.MeshStandardMaterial({ color: '#9AA3AB', metalness: .75, roughness: .42 }), Z = [];
  const zp = [[0, .55, 0], [-.55, .62, .25], [.5, .62, -.2], [.1, .6, .55], [-.15, 1.15, -.3], [.35, 1.2, .25], [-.45, 1.25, .35]];
  zp.forEach(([x, y, z], i) => { const m = mesh(zincLump(.42, 31 + i), zm, tube, x, y, z); m.rotation.set(i, i * 2, i * .5); Z.push(m); });
  const bot = reagentBottle(['dilute', 'HCl'], { line: '#C0392B' }); const rig = pourRig(G, bot, V(6, 0, -2.5), 8); const stA = streamMesh(G, '#FFFFFF');
  const bub = new Bubbles(tube, 90, { src: R => { const z = Z[(R() * Z.length) | 0]; return z.position.clone().add(V((R() - .5) * .6, .3, (R() - .5) * .6)); }, top: () => (liq.level ?? 0) - .05, rIn: U.rIn, size: .075, speed: 4.5 });
  // burning splinter
  const spl = new THREE.Group(); G.add(spl); mesh(new THREE.BoxGeometry(14, .32, .32), woodMat, spl, 7, 0, 0); const char = mesh(new THREE.BoxGeometry(.7, .34, .34), new THREE.MeshStandardMaterial({ color: '#2A211B', roughness: .9 }), spl, .3, 0, 0);
  const fl = flameMesh({ h: 1.9, r: .42 }); fl.rotation.z = -.55; fl.position.set(.05, 0, 0); spl.add(fl);
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: '#FFD27A', transparent: true, depthWrite: false, opacity: 0 })); flash.renderOrder = 50; G.add(flash);
  const smoke = wisps(G, 28, '#B9C2C8', 1.1);
  E.reset = () => { s.pour = 0; s.lv = 0; s.fizz = 0; s.zinc = 1; s.spl = 0; s.pop = 0; s.out = 0; bub.clear(); };
  const MOUTH = V(0, .62 + 15.5, 0);
  E.steps = [
    { text: 'A few zinc granules in a test tube.', safe: 'Safety: goggles on. Handle the acid with care. Only your teacher brings a flame near the gas.', dur: 1.2, cam: { c: V(0, 6, 0), r: 8.2 }, apply(u) { } },
    { text: 'Add dilute hydrochloric acid. At once, bubbles of a gas form on the zinc.', dur: 4.6, cam: { c: V(1.5, 8, 0), r: 9.6 }, apply(u) { s.pour = u; s.lv = smooth(seg(u, .48, .82)); s.fizz = smooth(seg(u, .55, .8)); } },
    { text: 'The gas keeps bubbling out and the tube feels warm. The zinc is slowly used up.', dur: 4, cam: { c: V(0, 4.6, 0), r: 5.6 }, apply(u) { s.lv = 1; s.fizz = 1; s.zinc = 1 - .14 * smooth(u); } },
    { text: 'Bring a burning splinter to the mouth of the tube: a "pop" sound! The gas is hydrogen. It burns with a pop.', dur: 4.4, cam: { c: V(1.4, 14.5, 0), r: 6.4 }, apply(u) { s.lv = 1; s.fizz = 1; s.zinc = .86; s.spl = u; s.pop = seg(u, .5, .62); s.out = u > .52 ? 1 : 0; } },
    { text: 'Zinc takes the place of hydrogen in the acid. A salt, zinc chloride, stays in the solution.', dur: 1.2, result: true, cam: { c: V(.6, 8, 0), r: 9.4 }, apply(u) { s.lv = 1; s.fizz = .8; s.zinc = .86; s.spl = 1; s.out = 1; s.pop = 1; } }
  ];
  E.update = (dt, t) => {
    const flowing = pourPose(rig, s.pour, V(1.05, MOUTH.y + 2.4, 0), 1.9, 1); bot.userData.stopper.visible = s.pour <= 0 || s.pour >= 1;
    rig.updateMatrixWorld(true); const mouth = rig.localToWorld(V(0, 0, 0));
    stA.userData.set(flowing, mouth.clone().add(V(-.2, -.3, 0)), .62 + (liq.level ?? 1.2));
    if (s.lv > 0) liq.setLevel(lerp(U.floor + .5, 6.2, s.lv)); else liq.hide();
    Z.forEach(z => z.scale.setScalar(s.zinc));
    bub.update(dt * Math.min(TS, 2), s.lv > .3 ? 55 * s.fizz : 0); sfx.fizz(cur === E && s.fizz > 0 ? .6 * s.fizz : 0);
    // splinter: from the right, to the mouth, pop, back a little
    const a = smooth(seg(s.spl, 0, .48)), b = smooth(seg(s.spl, .7, 1)); const p = V(lerp(9, 1.15, a), lerp(MOUTH.y + 4, MOUTH.y + .7, a), lerp(3, .6, a)); p.lerp(V(5, MOUTH.y + 3, 2.5), b);
    spl.position.copy(p); spl.rotation.set(0, -.3, .55); spl.visible = s.spl > 0;
    fl.userData.set(t, s.spl > 0 && !s.out ? 1 : 0);
    const k = s.pop > 0 && s.pop < 1 ? Math.sin(s.pop * Math.PI) : 0; flash.position.copy(MOUTH).add(V(0, .8, 0)); flash.scale.setScalar(7 * k); flash.material.opacity = .9 * k; flash.visible = k > .01;
    if (s.pop > 0 && s.pop < .5 && !E._popped) { E._popped = true; sfx.pop(); } if (s.pop === 0) E._popped = false;
    spl.updateMatrixWorld(true); smoke.userData.update(t, spl.localToWorld(V(.2, 0, 0)), s.out && s.spl < 1 ? .8 : s.out ? .35 : 0, 5, .5);
  };
  lbl(E, '<b>zinc</b> granules', () => V(0, 2.6, 1.6), () => at(E, 0));
  lbl(E, 'dilute <b>hydrochloric acid</b>', () => rig.localToWorld(V(0, 1.4, 0)), () => at(E, 1) && busy);
  lbl(E, 'bubbles of <b>gas</b>', () => V(-1.6, 4.4, .6), () => (at(E, 1) && !busy) || at(E, 2), 'bl');
  lbl(E, 'the tube is <b>warm</b>', () => V(1.7, 6.6, .6), () => at(E, 2) && !busy, 'r');
  lbl(E, '<b>pop!</b> hydrogen burns', () => V(0, MOUTH.y + 3.2, 0), () => at(E, 3) && s.pop > 0, 'big r');
  lbl(E, '<b>burning splinter</b>', () => spl.localToWorld(V(5, .3, 0)), () => at(E, 3) && s.spl < .5);
}

// ---------------------------------------------------------------- 4. Displacement: iron nail in copper sulphate solution
{ const E = exp({ id: 'displacement', title: 'Displacement', cls: 'Classes 7 and 10' }); const G = E.G, s = E.s;
  const XA = -2.4, XB = 2.4; rack([XA, XB], G, { w: 10 });
  const CU = '#2D8FE6', CU_L = '#86C4EE', FE = '#CDE8B5';
  const tA = testTube(1.35, 15.5, { blob: false }); tA.position.set(XA, .62, 0); G.add(tA); const tB = testTube(1.35, 15.5, { blob: false }); tB.position.set(XB, .62, 0); G.add(tB);
  const lA = new Liquid(tA, CU, { ad: 2.2 }); lA.setLevel(10); const lB = new Liquid(tB, CU, { ad: 2.2 }); lB.setLevel(10);
  for (const [t, L] of [[tA, 'A'], [tB, 'B']]) { const b = band(1.37, 1.6, 12.6, labelTex([L], { fs: 150, w: 256, h: 256 }), 1.2, t); b.renderOrder = 7; }
  const nail = nailMesh(6.2); G.add(nail); const spare = nailMesh(6.2); spare.rotation.set(0, .5, -Math.PI / 2); spare.position.set(-1.2, .6 + .45, 6); G.add(spare); whiteTile(10, 5, G, 0, 6);
  const thread = new THREE.Mesh(cylG(.03, .03, 1, 6), new THREE.MeshStandardMaterial({ color: '#F4EFE2', roughness: .9 })); G.add(thread);
  const stick = mesh(new THREE.BoxGeometry(.3, .3, 4), woodMat, G, XB, 16.4, 0); stick.rotation.y = .3;
  const clk = deskClock(); clk.position.set(-9, 3.8, -1.5); clk.rotation.y = .35; G.add(clk);
  const cuBits = new Grains(tB, 60, { seed: 5, color: '#9A4A26', size: .07, top: () => 10, floor: tB.userData.floor, rIn: tB.userData.rIn, y0: 3 });
  E.reset = () => { s.lower = 0; s.coat = 0; s.min = 0; s.green = 0; s.fade = 0; s.lift = 0; };
  const timeTxt = () => s.min < 1 ? '0 min' : s.min <= 20.5 ? `${Math.round(s.min)} min` : s.min < 24 * 60 - 1 ? `${Math.round(s.min / 60)} h` : '1 day';
  E.steps = [
    { text: 'Tubes A and B hold blue copper sulphate solution. A clean iron nail is ready, and a spare nail to compare with.', safe: 'Safety: copper sulphate is harmful if swallowed. Do not taste it. Wash your hands after the experiment.', dur: 1.3, cam: { c: V(0, 7.5, 1), r: 10.5 }, apply(u) { } },
    { text: 'Hang the iron nail in tube B by a thread, so it is under the solution.', dur: 3.4, cam: { c: V(1, 9, 0), r: 9.5 }, apply(u) { s.lower = smooth(u); } },
    { text: 'Wait 20 minutes (sped up). A reddish-brown coat of copper forms on the nail. The blue gets lighter.', dur: 5, cam: { c: V(-2.5, 7, 0), r: 11 }, apply(u) { s.lower = 1; s.min = 20 * u; s.coat = .55 * smooth(u); s.fade = .35 * smooth(u); } },
    { text: 'Leave it for a day. The blue colour goes and the solution turns pale green: iron sulphate is formed.', dur: 5.5, cam: { c: V(-2.5, 7, 0), r: 11 }, apply(u) { s.lower = 1; s.min = 20 + (1440 - 20) * smooth(u); s.coat = .55 + .45 * smooth(u); s.fade = .35 + .65 * smooth(u); s.green = smooth(seg(u, .2, 1)); } },
    { text: 'Take the nail out and compare: it is coated brown with copper. The spare nail is still grey. Tube A is still blue.', dur: 3.2, result: true, cam: { c: V(0, 9, 2), r: 11 }, apply(u) { s.lower = 1; s.min = 1440; s.coat = 1; s.fade = 1; s.green = 1; s.lift = smooth(u); } }
  ];
  E.update = (dt, t) => {
    const ny = lerp(19, 1.25, s.lower) + s.lift * 8.5; nail.position.set(XB, ny, 0); nail.visible = true;
    const nm = nail.userData.mat; nm.color.set('#9AA3AB').lerp(C('#A4502A'), s.coat); nm.metalness = lerp(.85, .35, s.coat); nm.roughness = lerp(.32, .75, s.coat);
    const topY = ny + 6.2, th = 16.4 - topY; thread.visible = th > .1; thread.scale.y = Math.max(.01, th); thread.position.set(XB, topY + th / 2, 0); stick.visible = s.lower > .98 && s.lift < .05;
    if (!stick.visible) { thread.scale.y = 2; thread.position.set(XB, topY + 1, 0); }
    const col = C(CU).lerp(C(CU_L), clamp(s.fade * 1.4)).lerp(C(FE), s.green); lB.setLook(col, 0, lerp(2.2, 6, s.fade));
    clk.userData.set(9 * 60 + s.min); clkL.set(`time: <b>${timeTxt()}</b>`);
    cuBits.update(t, s.green * .9, 1, .25);
  };
  lbl(E, '<b>copper sulphate</b> solution', () => V(XA - 1.4, 8, 1.4), () => at(E, 0));
  lbl(E, '<b>iron nail</b>', () => nail.localToWorld(V(0, 6.6, 0)), () => at(E, 0) || at(E, 1));
  lbl(E, 'spare nail', () => V(-1.2, 1.4, 6), () => at(E, 0) || at(E, 4));
  const clkL = lbl(E, 'time: 0 min', () => V(-9, 7, -1.5), () => at(E, 2) || at(E, 3));
  lbl(E, '<b>copper</b> on the nail', () => V(XB + 1.6, 4.8, 1.2), () => at(E, 2) && !busy, 'r');
  lbl(E, '<b>pale green</b>: iron sulphate', () => V(XB + 1.2, 8, 1.2), () => at(E, 3) && !busy, 'g');
  lbl(E, 'still <b>blue</b>', () => V(XA - 1.2, 8, 1.2), () => at(E, 3) && !busy || at(E, 4), 'bl');
  lbl(E, 'coated with <b>copper</b>', () => nail.localToWorld(V(0, 3.5, 0)), () => done(E, 4), 'r');
}

// ---------------------------------------------------------------- 5. Precipitation: sodium sulphate + barium chloride -> white barium sulphate
{ const E = exp({ id: 'precipitation', title: 'Precipitation', cls: 'Class 10' }); const G = E.G, s = E.s;
  const XL = -2.6, XR = 2.6; rack([XL, XR], G, { w: 11, r: 1.6 });
  const tL = testTube(1.3, 15, { blob: false }); const rig = pourRig(G, tL, V(XL, .62, 0), 15); const lL = new Liquid(tL, '#FFFFFF', { att: '#E6F4F8', ad: 14 }); lL.setLevel(4.6);
  const tR = testTube(1.65, 16, { blob: false, th: .12 }); tR.position.set(XR, .62, 0); G.add(tR); const UR = tR.userData; const lR = new Liquid(tR, '#FFFFFF', { att: '#E6F4F8', ad: 14 }); lR.setLevel(4.4);
  const stR = streamMesh(G, '#FFFFFF');
  const sed = layerMesh(tR, new THREE.MeshStandardMaterial({ map: noiseTex('#FBFBF9', .12, 15, 2), roughness: 1 }));
  const cloud = new Grains(tR, 700, { seed: 21, color: '#FFFFFF', size: .05, top: () => (lR.level ?? 4) - .1, floor: UR.floor, rIn: UR.rIn, y0: 6.5 });
  const clk = deskClock(); clk.position.set(8.4, 3.8, -1.5); clk.rotation.y = -.35; G.add(clk);
  E.reset = () => { s.pour = 0; s.mix = 0; s.milk = 0; s.settle = 0; s.min = 0; s.swirl = 0; lL.tiltMode(false); lL.setLevel(4.6); };
  E.steps = [
    { text: 'Two clear, colourless solutions: sodium sulphate (left) and barium chloride (right).', safe: 'Safety: barium chloride is poisonous. Gloves and goggles on, never taste, wash your hands. Only with your teacher.', dur: 1.3, cam: { c: V(0, 7.5, 0), r: 9.5 }, apply(u) { } },
    { text: 'Pour the sodium sulphate into the barium chloride. A white cloud appears at once.', dur: 5, cam: { c: V(1.2, 10, 0), r: 10.5 }, apply(u) { s.pour = u; s.mix = smooth(seg(u, .5, .85)) * .7; s.milk = .55 * smooth(seg(u, .52, .9)); } },
    { text: 'The white solid does not dissolve in water. A solid that forms in a solution like this is a precipitate: barium sulphate.', dur: 3.4, cam: { c: V(XR, 5.5, 0), r: 6.2 }, apply(u) { s.pour = 1; s.mix = .7 + .3 * smooth(u); s.milk = .55 + .3 * smooth(u); s.swirl = u; } },
    { text: 'Leave it for 10 minutes (sped up). The precipitate settles to the bottom. The clear liquid above is sodium chloride solution.', dur: 6, cam: { c: V(4.5, 6, 0), r: 9 }, apply(u) { s.pour = 1; s.mix = 1; s.settle = smooth(u); s.milk = .85 * (1 - smooth(seg(u, .05, .9))); s.min = 10 * u; } },
    { text: 'Two salts swapped partners. This is a double displacement reaction, and it forms a precipitate.', dur: 1.2, result: true, cam: { c: V(XR, 6, 0), r: 7.6 }, apply(u) { s.pour = 1; s.mix = 1; s.settle = 1; s.milk = 0; s.min = 10; } }
  ];
  E.update = (dt, t) => {
    const mouthTo = V(XR - 1.35, .62 + 16 + 1.1, 0); const flowing = pourPose(rig, s.pour, mouthTo, 1.95, -1);
    const pourK = seg(s.pour, .46, .82); rig.updateMatrixWorld(true);
    const tilted = s.pour > .3 && s.pour < .99; lL.tiltMode(tilted);
    if (tilted) { const mY = rig.localToWorld(V(0, 0, 0)).y, axisY = tL.localToWorld(V(0, 4.6, 0)).y; lL.setCut(s.pour < .47 ? Math.min(axisY, mY + 1.7) : lerp(mY + 1.7, mY - 1.2, smooth(pourK))); }
    if (!tilted) { if (s.pour >= .99) lL.hide(); else lL.setLevel(4.6); }
    stR.userData.set(flowing, rig.localToWorld(V(.35, -.15, 0)), .62 + (lR.level ?? 4.4));
    lR.setLevel(4.4 + 3.9 * smooth(pourK)); lR.setLook('#FFFFFF', s.milk, 14);
    sed.userData.set(.62 * s.settle * s.mix); cloud.update(t * (1 + s.swirl * 2), s.mix, s.settle, .62 * s.settle);
    clk.userData.set(3 * 60 + s.min); clkL.set(`time: <b>${Math.round(s.min)} min</b>`);
  };
  lbl(E, '<b>sodium sulphate</b>', () => V(XL - 1, 6, 1.4), () => at(E, 0));
  lbl(E, '<b>barium chloride</b>', () => V(XR + 1.2, 6, 1.6), () => at(E, 0));
  lbl(E, 'a <b>white</b> cloud', () => V(XR + 1.8, 6, 1.4), () => at(E, 1) && !busy);
  lbl(E, '<b>precipitate</b>: barium sulphate', () => V(XR + 1.4, 4.6, 1.4), () => at(E, 2) && !busy);
  lbl(E, 'clear: <b>sodium chloride</b> solution', () => V(XR + 1.5, 7, 1.4), () => (at(E, 3) && !busy) || at(E, 4), 'bl');
  lbl(E, '<b>precipitate</b> settled', () => V(XR + 1.6, 1.4, 1.4), () => (at(E, 3) && !busy) || at(E, 4));
  const clkL = lbl(E, 'time: 0 min', () => V(8.4, 7, -1.5), () => at(E, 3));
}

// ---------------------------------------------------------------- 6. Test for carbon dioxide: vinegar + baking soda -> gas through lime water
{ const E = exp({ id: 'co2', title: 'Test for carbon dioxide', cls: 'Classes 7 and 10' }); const G = E.G, s = E.s;
  const XF = -4.6, XT = 4.8;
  const flask = conicalFlask(3.6, 12, 1.25); flask.position.set(XF, 0, 0); G.add(flask); const UF = flask.userData;
  const vin = new Liquid(flask, '#FFFFFF', { att: '#F1F0E2', ad: 14 }); vin.hide();
  const soda = moundMesh(flask, new THREE.MeshStandardMaterial({ map: noiseTex('#FAFAF7', .14, 17, 2), roughness: 1 }));
  rack([0], G, { w: 6 }).position.x = XT; const tube = testTube(1.35, 15.5, { blob: false }); tube.position.set(XT, .62, 0); G.add(tube); const UT = tube.userData;
  const lime = new Liquid(tube, '#FFFFFF', { att: '#EEF6F2', ad: 14 }); lime.setLevel(10.2);
  const bottle = reagentBottle(['Vinegar'], { line: '#8A5A00' }); const rig = pourRig(G, bottle, V(-11.5, 0, -3), 8); const stV = streamMesh(G, '#FFFFFF');
  // cork + bent delivery tube (one piece, comes down from above)
  const del = new THREE.Group(); G.add(del);
  const ck = mesh(cylG(1.28, 1.05, 1.6, 24), corkMat, del, XF, 12 - .2, 0);
  const NY = 12.6, TOP = 18.6, path = new THREE.CatmullRomCurve3([V(XF, NY - 1.6, 0), V(XF, TOP - 1.2, 0), V(XF + .3, TOP - .3, 0), V(XF + 1.2, TOP, 0), V(XT - 1.2, TOP, 0), V(XT - .3, TOP - .3, 0), V(XT, TOP - 1.2, 0), V(XT, 2.6, 0)], false, 'catmullrom', .15);
  const dg = new THREE.Mesh(new THREE.TubeGeometry(path, 160, .26, 14, false), GLASS_THIN); dg.renderOrder = 6; del.add(dg);
  const foam = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ map: noiseTex('#FBFCFB', .25, 95, 2, 3000), roughness: .8 })); flask.add(foam); let foamK = -1;
  const setFoam = (y0, h) => { foam.visible = h > .05; if (!foam.visible || Math.abs(y0 + h * 3 - foamK) < .01) return; foamK = y0 + h * 3; const pts = [[0, y0 - .02]]; for (let i = 0; i <= 8; i++) { const yy = y0 + h * i / 8; pts.push([Math.max(.05, UF.rIn(yy) - .03), yy]); }
    for (let i = 1; i <= 5; i++) { const a = i / 5 * Math.PI / 2; pts.push([(UF.rIn(y0 + h) - .03) * Math.cos(a), y0 + h + .35 * Math.sin(a)]); } foam.geometry.dispose(); foam.geometry = lathe(pts, 40); };
  const bubF = new Bubbles(flask, 110, { src: R => V((R() - .5) * 4, UF.floor + .3, (R() - .5) * 4), top: () => (vin.level ?? 0) - .05, rIn: UF.rIn, size: .09, speed: 5 });
  const bubT = new Bubbles(tube, 60, { src: R => V((R() - .5) * .2, 2.05, (R() - .5) * .2), top: () => (lime.level ?? 0) - .05, rIn: UT.rIn, size: .13, speed: 4.5 });
  const milkG = new Grains(tube, 260, { seed: 33, color: '#FFFFFF', size: .03, top: () => (lime.level ?? 7) - .1, floor: UT.floor, rIn: UT.rIn, y0: 2 });
  E.reset = () => { s.pour = 0; s.lv = 0; s.fizz = 0; s.foam = 0; s.del = 0; s.gas = 0; s.milk = 0; s.soda = 1; bubF.clear(); bubT.clear(); };
  E.steps = [
    { text: 'Baking soda (sodium hydrogencarbonate) in a flask. Clear lime water in a test tube.', safe: 'Safety: wear goggles. Keep the cork loose enough if the fizz is strong; your teacher shows how.', dur: 1.3, cam: { c: V(0, 8, 0), r: 12 }, apply(u) { } },
    { text: 'Pour vinegar on the baking soda and fit the cork at once. It fizzes: a gas is given off.', dur: 6.4, cam: { c: V(-4, 8, 0), r: 11 }, apply(u) { s.pour = seg(u, 0, .62); s.lv = smooth(seg(u, .3, .5)); s.fizz = smooth(seg(u, .3, .45)); s.foam = smooth(seg(u, .32, .6)); s.soda = 1 - .35 * smooth(seg(u, .3, 1)); s.del = smooth(seg(u, .66, 1)); s.gas = u > .9 ? .5 : 0; } },
    { text: 'The gas goes through the delivery tube and bubbles through the lime water.', dur: 4, cam: { c: V(XT, 8.4, 0), r: 8.6, az: .3 }, apply(u) { s.pour = 1; s.lv = 1; s.del = 1; s.fizz = 1; s.foam = 1 - .3 * u; s.soda = .65 - .2 * u; s.gas = 1; s.milk = .12 * smooth(seg(u, .4, 1)); } },
    { text: 'The lime water turns milky. Only carbon dioxide does this.', dur: 4.6, cam: { c: V(XT, 8.4, 0), r: 8.6, az: .3 }, apply(u) { s.pour = 1; s.lv = 1; s.del = 1; s.fizz = 1 - .4 * u; s.foam = .7 - .3 * u; s.soda = .45 - .15 * u; s.gas = 1 - .3 * u; s.milk = .12 + .78 * smooth(u); } },
    { text: 'Vinegar and baking soda react and give carbon dioxide. Carbon dioxide turns lime water milky.', dur: 1.2, result: true, cam: { c: V(0, 8, 0), r: 12 }, apply(u) { s.pour = 1; s.lv = 1; s.del = 1; s.fizz = .4; s.foam = .3; s.soda = .3; s.gas = .5; s.milk = .9; } }
  ];
  E.update = (dt, t) => {
    const flowing = pourPose(rig, s.pour, V(XF - .95, 14.2, 0), 1.85, -1); bottle.userData.stopper.visible = s.pour <= 0 || s.pour >= 1;
    rig.updateMatrixWorld(true); stV.userData.set(flowing, rig.localToWorld(V(.3, -.2, 0)), (vin.level ?? UF.floor) + .2);
    if (s.lv > 0) vin.setLevel(lerp(UF.floor + .3, 2.6, s.lv)); else vin.hide();
    soda.userData.set(2.6 * Math.sqrt(s.soda), 1.25 * s.soda);
    setFoam((vin.level ?? 1) - .1, 2.6 * s.foam * (1 + .05 * Math.sin(t * 3)));
    del.position.y = (1 - s.del) * 9; del.visible = s.del > .01;
    bubF.update(dt * Math.min(TS, 2), s.lv > .3 ? 80 * s.fizz : 0); bubT.update(dt * Math.min(TS, 2), s.del > .98 ? 18 * s.gas : 0);
    sfx.fizz(cur === E && s.fizz > 0 ? .7 * s.fizz : 0);
    lime.setLook('#FFFFFF', s.milk * .92, 14); milkG.update(t, s.milk, 0, 0);
  };
  lbl(E, '<b>baking soda</b>', () => V(XF, 1.8, 3.8), () => at(E, 0));
  lbl(E, 'clear <b>lime water</b>', () => V(XT, 12, 1.4), () => at(E, 0) || at(E, 2));
  lbl(E, '<b>vinegar</b>', () => rig.localToWorld(V(0, 1.4, 0)), () => at(E, 1) && s.pour < .5);
  lbl(E, '<b>fizz</b>: a gas', () => V(XF, 8.2, 2.4), () => at(E, 1) && !busy, 'bl');
  lbl(E, '<b>delivery tube</b>', () => V(0, 19.6, 0), () => at(E, 1) && !busy);
  lbl(E, 'gas <b>bubbles</b>', () => V(XT + 1.5, 4, 1), () => at(E, 2) && !busy, 'bl');
  lbl(E, 'lime water turns <b>milky</b>', () => V(XT, 12, 1.4), () => (at(E, 3) && !busy) || at(E, 4));
}

// ================================================================== flow: experiments, steps, NEXT / Back
let cur = EXPS[0], ei = 0, step = 0, su = 1, busy = false, started = false, introOpen = true, camReady = false, camAnim = null, userCam = false;
function setStep(i, animate) { const E = cur; E.reset(); for (let j = 0; j < i; j++) E.steps[j].apply(1); step = i; su = animate ? 0 : 1; E.steps[i].apply(su); busy = !!animate; renderUI(); frame(E.steps[i].cam, false); }
function openExp(k, atEnd) { ei = (k + EXPS.length) % EXPS.length; cur = EXPS[ei]; EXPS.forEach(E => E.G.visible = E === cur); sfx.fizz(0); setStep(atEnd ? cur.steps.length - 1 : 0, false); }
function next() { if (!started || busy) return; sfx.tick();
  if (step < cur.steps.length - 1) { setStep(step + 1, true); return; }
  openExp(ei + 1, false); }
function back() { if (!started) return; sfx.tick();
  if (busy) { su = 1; cur.steps[step].apply(1); busy = false; }
  if (step > 0) { setStep(step - 1, false); return; }
  if (ei > 0) openExp(ei - 1, true); }
function fmtFormula(f) { return f.split(' \u2192 ').map(side => side.split(' + ').map(t => { const m = /^(\d*)(.+?)(\((?:s|l|g|aq)\))?$/.exec(t);
  return (m[1] || '') + m[2].replace(/(\d+)/g, '<sub>$1</sub>') + (m[3] ? `<span class="st">${m[3]}</span>` : ''); }).join(' + ')).join(' &rarr; '); }
function resultHTML(E) { const R = EQ[E.id];
  if (R.table) return `<table><tr><th>Indicator</th><th>Acid</th><th>Base</th></tr>${INDICATORS.map(r => `<tr><td>${r.name}</td><td><span class="sw" style="background:${r.acid[1]}"></span>${r.acid[0]}</td><td><span class="sw" style="background:${r.base[1]}"></span>${r.base[0]}</td></tr>`).join('')}</table>`;
  return R.eqs.map(q => `<div class="w">${q.word.split(' \u2192 ').join(' &rarr; ')}</div><div class="f">${fmtFormula(q.formula)}</div>`).join('') + `<div class="cls">${R.note} Chemical equation: Class 10.</div>`; }
function renderUI() { const E = cur, st = E.steps[step], N = E.steps.length;
  $('key').textContent = `Experiment ${ei + 1} of ${EXPS.length} · Step ${step + 1} of ${N}`;
  $('title').textContent = E.title; $('line').textContent = st.text;
  $('safe').style.display = st.safe ? 'block' : 'none'; $('safe').textContent = st.safe || '';
  const showRes = st.result && !busy; $('res').style.display = showRes ? 'block' : 'none'; if (showRes) $('res').innerHTML = resultHTML(E);
  const b = $('bNext'); b.classList.toggle('wait', busy); b.disabled = busy;
  b.textContent = step < N - 1 ? 'NEXT' : ei < EXPS.length - 1 ? 'NEXT EXPERIMENT' : 'START AGAIN';
  $('bBack').disabled = ei === 0 && step === 0;
  if (camReady) frame(st.cam, false, true); }
const onBtn = (id, fn) => $(id).addEventListener('click', e => { e.preventDefault(); fn(e); });
onBtn('bNext', next); onBtn('bBack', back);
onBtn('bMusic', () => { sfx.toggle(); $('muteX').style.display = sfx.on ? 'none' : 'block'; });
onBtn('bStart', () => { $('intro').style.display = 'none'; introOpen = false; started = true; sfx.start(); openExp(0, false); });
const sheet = $('sheet'), sbox = $('sheetBox'); sheet.addEventListener('click', e => { if (e.target === sheet) sheet.classList.remove('show'); });
onBtn('bList', () => { if (!started) return; sbox.innerHTML = `<button id="xS">Close</button><h2>Experiments</h2>` + EXPS.map((E, i) => `<button class="trow${i === ei ? ' cur' : ''}" id="row${i}"><span class="n">${i + 1}</span><span>${E.title}<small>${E.cls} · ${E.steps.length} steps</small></span></button>`).join('');
  sheet.classList.add('show'); $('xS').onclick = () => sheet.classList.remove('show'); EXPS.forEach((E, i) => $('row' + i).onclick = () => { sheet.classList.remove('show'); openExp(i, false); }); });
addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === ' ') next(); if (e.key === 'ArrowLeft') back(); });

// ---------------------------------------------------------------- camera: frame each step between the card and the buttons; slight drag to orbit
function visArea() { const W = innerWidth, H = innerHeight, card = $('card').getBoundingClientRect(), bar = $('bar').getBoundingClientRect();
  if (W >= 900) return { l: card.right + 10, r: W - 10, t: 10, b: bar.top - 8 };
  return { l: 0, r: W, t: card.bottom + 6, b: bar.top - 6 }; }
function applyOffset(va) { const W = innerWidth, H = innerHeight, cx = (va.l + va.r) / 2, cy = (va.t + va.b) / 2; camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H); }
let lastCam = null;
function frame(cam, instant, keepUser) { if (!cam) return; if (keepUser && userCam && cam === lastCam) { applyOffset(visArea()); return; }
  const W = innerWidth, H = innerHeight, va = visArea(), vh = Math.max(120, va.b - va.t), vw = va.r - va.l; applyOffset(va);
  const fovV = THREE.MathUtils.degToRad(camera.fov) * vh / H, fovH = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * vw / H);
  const el = cam.el ?? .3, az = cam.az ?? 0, dist = cam.r / Math.sin(Math.min(fovV, fovH) / 2) * .92;
  const dir = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)), to = cam.c.clone(), pos = to.clone().add(dir.multiplyScalar(dist));
  controls.minDistance = dist * .6; controls.maxDistance = dist * 1.35; controls.minAzimuthAngle = az - .75; controls.maxAzimuthAngle = az + .75;
  controls.minPolarAngle = Math.max(.25, Math.PI / 2 - el - .6); controls.maxPolarAngle = Math.min(Math.PI / 2 - .04, Math.PI / 2 - el + .3);
  key.position.copy(to).add(V(-35, 70, 45)); key.target.position.copy(to); fill.position.copy(to).add(V(50, 25, 30)); fill.target.position.copy(to);
  if (instant || !camReady) { camera.position.copy(pos); controls.target.copy(to); camAnim = null; } else camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: to, k: 0 };
  lastCam = cam; userCam = false; camReady = true; }
controls.addEventListener('start', () => { userCam = true; camAnim = null; });
function resize() { const W = innerWidth, H = innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); frame(cur.steps[step].cam, true); }
addEventListener('resize', resize);

// ---------------------------------------------------------------- sound: generated music + small effects, one mute button (no voice)
const sfx = (() => {
  let ctx = null, master = null, on = true, timer = 0, n = 0, fzG = null; const notes = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
  function tone(f, t, v, d = 2.4, type = 'sine') { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(.0005, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .1); }
  function pad() { [130.8, 196, 246.9].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), lf = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = i * 4 - 4;
    g.gain.value = .014; lf.frequency.value = .07 + i * .03; lg.gain.value = .008; lf.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(master); o.start(); lf.start(); }); }
  function loop() { if (!on || !ctx) return; const t = ctx.currentTime + .05, R = (n * 2654435761 >>> 0) % 7; tone(notes[R], t, .04); if (n % 3 === 0) tone(notes[(R + 2) % 7] / 2, t + .6, .028); n++; timer = setTimeout(loop, 1500); }
  function noise(sec) { const len = ctx.sampleRate * sec, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), R = mulberry(99); for (let i = 0; i < len; i++) d[i] = (R() * 2 - 1) * (R() < .08 ? 1 : .25); return b; }
  function fizzNode() { const src = ctx.createBufferSource(); src.buffer = noise(2); src.loop = true; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; fzG = ctx.createGain(); fzG.gain.value = 0; src.connect(hp); hp.connect(fzG); fzG.connect(master); src.start(); }
  return { get on() { return on; },
    start() { try { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .8; master.connect(ctx.destination); pad(); fizzNode(); } ctx.resume(); if (on) { clearTimeout(timer); loop(); } } catch (e) { } },
    toggle() { on = !on; if (on) this.start(); else { clearTimeout(timer); try { ctx && ctx.suspend(); } catch (e) { } } },
    tick() { if (on && ctx) tone(880, ctx.currentTime, .025, .2); },
    pop() { if (!on || !ctx) return; const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise(.3); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; const g = ctx.createGain(); g.gain.setValueAtTime(.9, t); g.gain.exponentialRampToValueAtTime(.001, t + .22); s.connect(lp); lp.connect(g); g.connect(master); s.start(t); tone(110, t, .5, .25, 'sine'); },
    fizz(k) { if (fzG && ctx) fzG.gain.setTargetAtTime(on ? k * .045 : 0, ctx.currentTime, .1); } };
})();

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock(); let fpsAvg = 60;
function tick() {
  requestAnimationFrame(tick);
  const raw = clock.getDelta(), dt = Math.min(.05, raw), t = clock.elapsedTime; fpsAvg = fpsAvg * .95 + .05 / Math.max(raw, 1e-3);
  if (camAnim) { camAnim.k = Math.min(1, camAnim.k + dt / 1.1); const k = camAnim.k, e = k < .5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (k >= 1) camAnim = null; }
  controls.update();
  if (busy) { const st = cur.steps[step]; su = Math.min(1, su + dt * TS / st.dur); st.apply(su); if (su >= 1) { busy = false; renderUI(); } }
  cur.update(dt, t);
  updateLabels();
  renderer.render(scene, camera);
}
EXPS.forEach(E => { E.reset(); E.G.visible = E === cur; });
cur.steps[0].apply(1);
$('loading').style.display = 'none';
resize(); renderUI(); tick();
window.__lab = { ready: () => true, busy: () => busy, state: () => ({ exp: cur.id, ei, step, steps: cur.steps.length, nExp: EXPS.length, busy, fps: Math.round(fpsAvg), started }),
  steps: () => EXPS.map(E => ({ id: E.id, title: E.title, steps: E.steps.map(s => s.text) })), go: (i, k) => { openExp(i, false); setStep(k, false); } };
