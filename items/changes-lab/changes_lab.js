/* Changes Lab (CB-C7-SCI-05-GAME-CHANGESLAB) - three.js lab bench, 6 guided experiments, NEXT = one stage. Data goes ONLY through window.__S (ZQSim adapter).
   Facts as the book (CH/source/text.txt; rusting set-up and the magnesium caution from the ch04 text). Shared parts (renderer, glass, apparatus,
   powders, labels) copied from the C8 Separation Lab sim (Class8/Science/Nature of Matter.../work/game/separation_lab, untouched). Units: cm. */
import * as THREE from 'three';
import { OrbitControls } from './vendor/addons/OrbitControls.js';
import { RoomEnvironment } from './vendor/addons/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/addons/RoundedBoxGeometry.js';

const S = window.__S, TASKS = window.TASKS;
const Q = new URLSearchParams(location.search);
const TS = Math.max(1, +(Q.get('speed') || (Q.get('zq_test') === '1' ? 6 : 1)));   // process clock speed (tests only)
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ------------------------------------------------------------------ renderer + world
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
scene.background = gradTex(['#2B4252', '#17242E', '#0C1319']);
const camera = new THREE.PerspectiveCamera(36, 1, .5, 1500);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false; controls.minPolarAngle = .3; controls.maxPolarAngle = 1.45;
scene.add(new THREE.HemisphereLight('#DDEBF5', '#2E3B47', .6));
const key = new THREE.DirectionalLight('#FFFFFF', 1.6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .03;
Object.assign(key.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 5, far: 200 }); scene.add(key, key.target);
const fill = new THREE.DirectionalLight('#9CC4FF', .65); scene.add(fill, fill.target);
const rimL = new THREE.DirectionalLight('#CFE6FF', 1.1); scene.add(rimL, rimL.target);       // back light: bright rims on the glass

function gradTex(cols) { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  cols.forEach((k, i) => gr.addColorStop(i / (cols.length - 1), k)); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function softTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
const SOFT = softTex();
function noiseTex(base, amt, seed, rep = 4, n = 2600) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), R = mulberry(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256); for (let i = 0; i < n; i++) { const a = R() > .5 ? 255 : 0; g.fillStyle = `rgba(${a},${a},${a},${R() * amt})`; g.fillRect(R() * 256, R() * 256, 1 + R() * 3, 1 + R() * 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = THREE.SRGBColorSpace; return t; }
function tileTex(base, grout, tiles = 4) { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), R = mulberry(17), s = 256 / tiles;
  g.fillStyle = grout; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < tiles; i++) for (let j = 0; j < tiles; j++) { const v = (R() - .5) * 14; g.fillStyle = shade(base, v); g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
function shade(hex, v) { const c = new THREE.Color(hex); c.r = clamp(c.r + v / 255); c.g = clamp(c.g + v / 255); c.b = clamp(c.b + v / 255); return '#' + c.getHexString(); }
const benchMat = new THREE.MeshStandardMaterial({ map: noiseTex('#3B4B5B', .08, 3, 3), roughness: .6, metalness: .05 });
const steelMat = new THREE.MeshStandardMaterial({ color: '#C9D2DA', metalness: 1, roughness: .28 });
const ironMat = new THREE.MeshStandardMaterial({ color: '#4A5561', metalness: .6, roughness: .45 });
const darkMat = new THREE.MeshStandardMaterial({ color: '#26323D', roughness: .5, metalness: .3 });
const PORC = () => new THREE.MeshPhysicalMaterial({ color: '#EEF1F3', roughness: .22, clearcoat: .8, clearcoatRoughness: .12, side: THREE.DoubleSide });

// ------------------------------------------------------------------ glass (video kit sci.js): base glass + additive fresnel/softbox shell + dark edge lines
function glassMat(o = {}) { return new THREE.MeshPhysicalMaterial({ color: o.tint ?? '#DCEFF5', roughness: .04, transparent: true, opacity: o.opacity ?? .16, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.6, ior: 1.5 }); }
function rimMat(o = {}) { return new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Color(o.color ?? '#D6EEFF') }, uStr: { value: o.strength ?? .95 }, uPow: { value: o.power ?? 2.4 }, uStripe: { value: o.stripe ?? .55 } },
  vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
  fragmentShader: 'uniform vec3 uCol; uniform float uStr; uniform float uPow; uniform float uStripe; varying vec3 vN; varying vec3 vV; void main(){ vec3 n = normalize(vN); float f = pow(1.-abs(dot(n, normalize(vV))), uPow); float s = smoothstep(.42,.5,n.x)*(1.-smoothstep(.58,.68,n.x)) + .55*smoothstep(-.62,-.56,n.x)*(1.-smoothstep(-.52,-.46,n.x)); float side = 1. - smoothstep(.55, .9, abs(n.y)); gl_FragColor = vec4(uCol*(f*uStr*(.35+.65*side) + s*uStripe*side), 1.); }',
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide }); }
function glassPiece(geo, o = {}) { const g = new THREE.Group();
  const b = new THREE.Mesh(geo, glassMat(o)); b.renderOrder = 20; g.add(b);
  const r = new THREE.Mesh(geo, rimMat(o)); r.renderOrder = 21; g.add(r);
  if (o.edges !== false) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, o.edgeAngle ?? 25), new THREE.LineBasicMaterial({ color: o.edgeColor ?? '#14212C', transparent: true, opacity: o.edgeOpacity ?? .6, depthWrite: false })); e.renderOrder = 22; g.add(e); }
  g.userData.base = b; return g; }
const lathe = (pts, seg = 56) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(.001, p[0]), p[1])), seg);
function beaker(r = 3, h = 7, o = {}) { const th = o.th ?? .14;
  const g = glassPiece(lathe([[0, .03], [r - .3, .03], [r, .3], [r, h - .2], [r + .2, h], [r + .2 - th, h + .02], [r - th, h - .25], [r - th, th + .28], [r - th - .28, th], [0, th]], 64), o);
  const marks = []; for (let i = 1; i <= 4; i++) { const y = h * (.18 + i * .15), a0 = 2.1, a1 = 2.1 + (i % 2 ? .5 : .3); for (let k = 0; k < 8; k++) { const u = a0 + (a1 - a0) * k / 8, v = a0 + (a1 - a0) * (k + 1) / 8; marks.push(Math.cos(u) * (r + .01), y, Math.sin(u) * (r + .01), Math.cos(v) * (r + .01), y, Math.sin(v) * (r + .01)); } }
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(marks, 3));
  const ml = new THREE.LineSegments(mg, new THREE.LineBasicMaterial({ color: '#EAF4FA', transparent: true, opacity: .8, depthWrite: false })); ml.renderOrder = 23; g.add(ml);
  // bright rim ring at the lip: the glass edge always reads against the wall
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + .12, .06, 6, 64), new THREE.MeshBasicMaterial({ color: '#E2F3FF', transparent: true, opacity: .8, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = h; ring.renderOrder = 23; g.add(ring);
  g.userData.r = r; g.userData.h = h; g.userData.inR = r - th; return g; }
function testTube(r = 1.3, h = 15, o = {}) { const th = o.th ?? .1, p = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; p.push([Math.sin(a) * r, r - Math.cos(a) * r]); } p.push([r, h], [r + .12, h + .06], [r - th, h + .06]); for (let i = 10; i >= 0; i--) { const a = i / 10 * Math.PI / 2; p.push([Math.sin(a) * (r - th), r - Math.cos(a) * (r - th) + th * .9]); }
  const g = glassPiece(lathe(p, 40), o); const ring = new THREE.Mesh(new THREE.TorusGeometry(r + .04, .05, 6, 40), new THREE.MeshBasicMaterial({ color: '#E2F3FF', transparent: true, opacity: .8, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = h + .04; ring.renderOrder = 23; g.add(ring); return g; }
// liquid in an upright cylinder vessel with a visible meniscus (rises at the wall) + bright ring at the wall
function liquidCyl(r, color, opacity = .7) {
  const g = new THREE.Group(), col = new THREE.Color(color);
  const mat = new THREE.MeshPhysicalMaterial({ color: col, transparent: true, opacity, roughness: .1, clearcoat: .5, depthWrite: true, envMapIntensity: .45 });
  const topMat = mat.clone(); topMat.color = col.clone().lerp(new THREE.Color('#ffffff'), .06); topMat.opacity = Math.min(1, opacity + .08);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 56, 1, true), mat); body.renderOrder = 10; g.add(body);
  const bot = new THREE.Mesh(new THREE.CircleGeometry(r, 56), mat); bot.rotation.x = Math.PI / 2; bot.position.y = .02; bot.renderOrder = 10; g.add(bot);
  const men = .1, pts = []; for (let i = 0; i <= 10; i++) { const u = .82 + .18 * i / 10; pts.push(new THREE.Vector2(u * r, men * r * Math.pow((u - .82) / .18, 2.2))); }
  const top = new THREE.Group(); const disc = new THREE.Mesh(new THREE.CircleGeometry(r * .821, 56), topMat); disc.rotation.x = -Math.PI / 2; disc.renderOrder = 11; top.add(disc, new THREE.Mesh(new THREE.LatheGeometry(pts, 56), topMat)); top.children[1].renderOrder = 11; g.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * .995, Math.max(.03, r * .012), 6, 56), new THREE.MeshBasicMaterial({ color: col.clone().lerp(new THREE.Color('#ffffff'), .65), transparent: true, opacity: .85, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.renderOrder = 12; g.add(ring);
  g.userData = { mat, topMat, ring, setLevel(y0, y1) { const h = Math.max(.001, y1 - y0); body.scale.y = h; body.position.y = y0 + h / 2; top.position.y = y1; ring.position.y = y1 + men * r * .95; bot.position.y = y0 + .02; g.visible = h > .03; },
    setColor(c, op) { mat.color.set(c); topMat.color.set(c).lerp(new THREE.Color('#ffffff'), .06); ring.material.color.set(c).lerp(new THREE.Color('#ffffff'), .65); if (op != null) { mat.opacity = op; topMat.opacity = Math.min(1, op + .08); } } };
  return g; }

// ------------------------------------------------------------------ powders, heaps, grains
const TEXC = {};
function powderTex(kind) {
  if (TEXC[kind]) return TEXC[kind];
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), R = mulberry({ iron: 3, sulfur: 5, sand: 7, fes: 11, salt: 13, sugar: 19, char: 23, mixS: 29, mixA: 31, chalk: 37, soda: 41, mgo: 43 }[kind] || 1);
  const base = { iron: '#3B3F45', sulfur: '#F0CC32', sand: '#C9A56E', fes: '#2C2D30', salt: '#F2F4F5', sugar: '#F4F5F2', char: '#1F1E1D', mixS: '#E9C42E', mixA: '#2F3135', chalk: '#F1EFE9', soda: '#F6F6F2', mgo: '#F2F2EF' }[kind];
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const dot = (col, n, r0, r1) => { g.fillStyle = col; for (let i = 0; i < n; i++) { const r = r0 + R() * (r1 - r0); g.beginPath(); g.ellipse(R() * 512, R() * 512, r, r * (.5 + R() * .5), R() * 3, 0, Math.PI * 2); g.fill(); } };
  if (kind === 'iron') { dot('#24272B', 2600, .8, 2.4); dot('#5A6068', 1500, .6, 1.8); dot('#9AA4AE', 500, .4, 1.1); }
  if (kind === 'sulfur' || kind === 'mixS') { dot('#D9AE1E', 1700, 1, 3.2); dot('#FFE36E', 1900, .8, 2.6); dot('#FFF1A8', 500, .6, 1.6); }
  if (kind === 'sand') { dot('#A9854F', 2400, .8, 2.6); dot('#E0C38E', 1800, .7, 2.2); dot('#8C6A3D', 600, .6, 1.6); dot('#F2E2BE', 400, .5, 1.2); }
  if (kind === 'mixA') { dot('#25282C', 1800, .8, 2.6); dot('#6A7078', 700, .5, 1.6); dot('#E9C22C', 1500, 1, 3.4); dot('#FFDF5E', 1100, .8, 2.4); }
  if (kind === 'fes') { dot('#232427', 3000, .6, 2.0); dot('#3A3C40', 2200, .6, 1.8); dot('#4A4C51', 600, .4, 1.1); }
  if (kind === 'salt') { dot('#FFFFFF', 2600, .8, 2.6); dot('#DCE3E8', 1400, .7, 2); }
  if (kind === 'sugar') { dot('#FFFFFF', 2200, 1, 3); dot('#D9DCD8', 1500, .8, 2.4); }
  if (kind === 'chalk') { dot('#FFFFFF', 2400, .8, 2.8); dot('#DAD6CC', 1200, .6, 2); }
  if (kind === 'soda') { dot('#FFFFFF', 2600, .8, 2.4); dot('#E4E4DF', 1300, .6, 1.8); }
  if (kind === 'mgo') { dot('#FFFFFF', 2200, 1, 3); dot('#D8D8D4', 1400, .6, 2); dot('#BDBDB8', 300, .4, 1.2); }
  if (kind === 'char') { dot('#0E0E0E', 2600, 1, 4); dot('#3A3836', 1500, .8, 2.6); dot('#55524E', 300, .5, 1.4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; TEXC[kind] = t; return t; }
function powderMat(kind) { const t = powderTex(kind); return new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 1.2, roughness: kind === 'iron' ? .55 : .9, metalness: kind === 'iron' ? .35 : .05, side: THREE.DoubleSide }); }
// heap: polar-grid mound following the vessel floor (+lift). set(cx, cz, R, H) reshapes it (ch08 video lab.js)
function heap(kind, floor, o = {}) {
  const rings = o.rings ?? 12, segs = o.segs ?? 48, n = (rings + 1) * segs + 1, lift = o.lift ?? .12, rough = o.rough ?? .08, R0 = mulberry(o.seed ?? 3);
  const ph = [R0() * 6, R0() * 6, R0() * 6, R0() * 6];
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
  for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) { const a = 1 + r * segs + s, b = 1 + r * segs + (s + 1) % segs, c2 = 1 + (r + 1) * segs + s, d = 1 + (r + 1) * segs + (s + 1) % segs; if (r === 0) idx.push(0, b, a); idx.push(a, b, d, a, d, c2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const m = new THREE.Mesh(geo, o.mat ?? powderMat(kind)); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
  const noise = (a, u) => Math.sin(a * 3 + ph[0]) * .5 + Math.sin(a * 5 + u * 4 + ph[1]) * .3 + Math.sin(a * 9 + u * 7 + ph[2]) * .2 + Math.sin(a * 17 + u * 13 + ph[3]) * .12;
  const prof = u => Math.pow(Math.max(0, 1 - u * u), o.pow ?? .9);
  const S0 = { cx: 0, cz: 0, R: 1, H: 0 };
  const yAt = (u, a) => floor(S0.cx + Math.cos(a) * u * S0.R, S0.cz + Math.sin(a) * u * S0.R) + lift + S0.H * prof(u) * (1 + rough * noise(a, u)) * (o.lumps ? 1 + o.lumps * Math.max(0, Math.sin(a * 6 + u * 9 + ph[3])) * prof(u) : 1);
  m.userData = { S: S0,
    set(cx, cz, R, H) { S0.cx = cx; S0.cz = cz; S0.R = Math.max(.01, R); S0.H = Math.max(0, H); m.visible = H > .005 && R > .02; if (!m.visible) return;
      pos[0] = cx; pos[1] = yAt(0, 0); pos[2] = cz; uv[0] = cx / 12 + .5; uv[1] = cz / 12 + .5;
      for (let r = 0; r <= rings; r++) { const u = (r + 1) / (rings + 1); for (let s = 0; s < segs; s++) { const a = s / segs * Math.PI * 2, i = 1 + r * segs + s, x = cx + Math.cos(a) * u * S0.R, z = cz + Math.sin(a) * u * S0.R;
        pos[i * 3] = x; pos[i * 3 + 1] = yAt(u, a) - (r === rings ? .02 : 0); pos[i * 3 + 2] = z; uv[i * 2] = x / 12 + .5; uv[i * 2 + 1] = z / 12 + .5; } }
      geo.attributes.position.needsUpdate = true; geo.attributes.uv.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere(); },
    surf(u, a, up = 0) { return V(S0.cx + Math.cos(a) * u * S0.R, yAt(Math.min(1, u), a) + up, S0.cz + Math.sin(a) * u * S0.R); } };
  return m; }
function grainMesh(n, geo, colors, o = {}) {
  const mat = new THREE.MeshStandardMaterial({ roughness: o.rough ?? .55, metalness: o.metal ?? 0 });
  const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = !!o.shadow; m.frustumCulled = false; const c = new THREE.Color(), R = mulberry(o.seed ?? 5);
  for (let i = 0; i < n; i++) { c.set(colors[Math.floor(R() * colors.length)]); m.setColorAt(i, c); } m.instanceColor.needsUpdate = true; return m; }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function place(mesh, i, p, sc, rot = 0) { _e.set(rot, rot * 1.7, rot * .6); _q.setFromEuler(_e); _s.setScalar(sc); _m.compose(p, _q, _s); mesh.setMatrixAt(i, _m); }

// ------------------------------------------------------------------ apparatus (ch08 video lab.js / d_parts.js, adapted)
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * .12), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent && parent.add(m); return m; }
function cyl(r0, r1, h, mat, x = 0, y = 0, z = 0, parent, seg = 32) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent && parent.add(m); return m; }
function labSet(G, w = 90) {   // bench top y = 0; edge band 0.15 lower; lighter tiled splash-back so glass edges read; dark wall far behind
  const bench = new THREE.Mesh(new THREE.BoxGeometry(w, 4, 46), benchMat); bench.position.set(0, -2, 0); bench.receiveShadow = true; G.add(bench);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(w + .4, .6, 46.4), new THREE.MeshStandardMaterial({ color: '#25303B', roughness: .5 })); edge.position.set(0, -.45, 0); G.add(edge);
  const tt = tileTex('#5F7488', '#465869', 4); tt.repeat.set(w / 10, 2.2);
  const splash = new THREE.Mesh(new THREE.BoxGeometry(w, 22, 1), new THREE.MeshStandardMaterial({ map: tt, roughness: .35, metalness: 0 })); splash.position.set(0, 11, -22.6); splash.receiveShadow = true; G.add(splash);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(w * 3, 120), new THREE.MeshBasicMaterial({ map: gradTex(['#1A2833', '#22323F', '#2B3E4D']) })); wall.position.set(0, 50, -24); G.add(wall);
  return bench; }
function tile(w = 15, d = 15) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .5, d), new THREE.MeshPhysicalMaterial({ color: '#E3E9EE', roughness: .28, clearcoat: .6, clearcoatRoughness: .2 })); m.geometry.translate(0, .28, 0); m.receiveShadow = m.castShadow = true; return m; }
const TILE_TOP = .53;
function watchGlass(R = 6) { const rim = R * .2, c = rim / (R * R), th = .13, pts = [];
  for (let i = 0; i <= 16; i++) { const r = R * i / 16; pts.push([r, c * r * r]); } pts.push([R + .05, rim + .06]);
  for (let i = 16; i >= 0; i--) { const r = (R - .02) * i / 16; pts.push([r, c * r * r + th]); }
  const g = glassPiece(lathe(pts, 72), { opacity: .22, edgeOpacity: .55, tint: '#D8EEF6', strength: 1.1 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + .02, .07, 6, 96), new THREE.MeshBasicMaterial({ color: '#D9F1FF', transparent: true, opacity: .8, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = rim + .04; ring.renderOrder = 23; g.add(ring);
  g.userData.floor = (x, z) => c * (x * x + z * z) + th; g.userData.R = R; return g; }
function chinaDish(R = 4.6) { const H = 2.2, th = .22, pts = [];
  for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI / 2; pts.push([Math.sin(a) * R * .98, H * (1 - Math.cos(a)) * .95]); }
  pts.push([R * 1.04, H + .05], [R * 1.04 - th, H + .08]);
  for (let i = 14; i >= 0; i--) { const a = i / 14 * Math.PI / 2; pts.push([Math.sin(a) * (R * .98 - th), H * (1 - Math.cos(a)) * .95 + th]); }
  const m = new THREE.Mesh(lathe(pts, 64), PORC()); m.castShadow = m.receiveShadow = true; const g = new THREE.Group(); g.add(m);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R * 1.04 - .1, .07, 6, 64), new THREE.MeshStandardMaterial({ color: '#8E9AA6', roughness: .4 })); lip.rotation.x = Math.PI / 2; lip.position.y = H + .08; g.add(lip);
  const kR = R * .98 - th;
  g.userData.floor = (x, z) => { const r = Math.min(kR * .999, Math.hypot(x, z)), a = Math.asin(r / kR); return H * (1 - Math.cos(a)) * .95 + th; };
  g.userData.rAt = y => { const k = clamp((y - th) / (H * .95)); return kR * Math.sin(Math.acos(1 - k)); };
  g.userData.R = kR; g.userData.H = H; g.userData.th = th; return g; }
function mortar(R = 4.4) { const H = 3.6, pts = [[0, 0], [R * .62, 0], [R * .8, .5]];
  for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2; pts.push([R * .8 + (R - R * .8) * Math.sin(a), .5 + (H - .5) * Math.sin(a)]); }
  pts.push([R + .15, H + .1], [R - .3, H + .1]);
  for (let i = 1; i <= 14; i++) { const a = i / 14 * Math.PI / 2; pts.push([(R - .3) * Math.cos(a), .9 + (H - .8) * (1 - Math.sin(a))]); }
  const m = new THREE.Mesh(lathe(pts, 64), PORC()); m.castShadow = m.receiveShadow = true; const g = new THREE.Group(); g.add(m);
  const kR = R - .3; g.userData.floor = (x, z) => { const r = Math.min(kR * .999, Math.hypot(x, z)), a = Math.acos(r / kR); return .9 + (H - .8) * (1 - Math.sin(a)); }; return g; }
function pestle(L = 7) { const pts = [[0, 0]]; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI / 2; pts.push([Math.sin(a) * .95, .95 - Math.cos(a) * .95]); }
  pts.push([.7, 2.2], [.5, L - .6], [.62, L - .2], [0, L]); const g = new THREE.Group(); const b = new THREE.Mesh(lathe(pts, 40), PORC()); b.castShadow = true; g.add(b); return g; }
function glassRod(L = 13) { const g = glassPiece(new THREE.CylinderGeometry(.17, .17, L, 16), { opacity: .4, edgeOpacity: .35 }); g.children.forEach(c => c.position.y = L / 2); return g; }
function spatula(L = 11) { const g = new THREE.Group(); const blade = new THREE.Mesh(new THREE.BoxGeometry(2.4, .07, 1.0), steelMat); blade.position.x = -1.2; blade.castShadow = true; g.add(blade);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .07, 24, 1, false, 0, Math.PI), steelMat); tip.rotation.y = Math.PI / 2; g.add(tip);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, L - 2.4, 12), steelMat); shaft.rotation.z = Math.PI / 2; shaft.position.x = -2.4 - (L - 2.4) / 2; shaft.castShadow = true; g.add(shaft);
  const h = new THREE.Mesh(new THREE.CylinderGeometry(.32, .36, L * .38, 16), new THREE.MeshStandardMaterial({ color: '#2F6FD6', roughness: .45 })); h.rotation.z = Math.PI / 2; h.position.x = -L + L * .19; h.castShadow = true; g.add(h); return g; }
function tripodGauze(H = 12, R = 4.6) { const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, .28, 10, 64), ironMat); ring.rotation.x = Math.PI / 2; ring.position.y = H - .28; ring.castShadow = true; g.add(ring);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 6, top = V(Math.cos(a) * R, H - .3, Math.sin(a) * R), foot = V(Math.cos(a) * (R + 1.4), 0, Math.sin(a) * (R + 1.4)); const len = top.distanceTo(foot), leg = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, len, 10), ironMat);
    leg.position.copy(top).add(foot).multiplyScalar(.5); leg.quaternion.setFromUnitVectors(V(0, 1, 0), top.clone().sub(foot).normalize()); leg.castShadow = true; g.add(leg); }
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.strokeStyle = 'rgba(150,160,170,1)'; x.lineWidth = 2.2;
  for (let i = 0; i <= 512; i += 9) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  x.strokeStyle = '#7C868F'; x.lineWidth = 10; x.strokeRect(5, 5, 502, 502);
  const cg = x.createRadialGradient(256, 256, 30, 256, 256, 150); cg.addColorStop(0, '#E8E6E1'); cg.addColorStop(.8, '#D6D3CC'); cg.addColorStop(1, 'rgba(214,211,204,0)'); x.fillStyle = cg; x.beginPath(); x.arc(256, 256, 150, 0, Math.PI * 2); x.fill();
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
  const gz = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.5, R * 2.5), new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: .35, side: THREE.DoubleSide, roughness: .7, metalness: .3 })); gz.rotation.x = -Math.PI / 2; gz.position.y = H + .03; gz.castShadow = gz.receiveShadow = true; g.add(gz);
  g.userData.topY = H + .05; return g; }
function flameMesh(o = {}) { const h = o.h ?? 4, r = o.r ?? .8, g = new THREE.Group();
  const mk = (rr, hh, col, tip, a, ord) => { const pts = []; for (let i = 0; i <= 18; i++) { const u = i / 18; pts.push(new THREE.Vector2(rr * Math.sin(Math.PI * Math.pow(u, .55)) * (1 - u * .35) + .001, u * hh)); }
    const m = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(col) }, uTip: { value: new THREE.Color(tip) }, uA: { value: a }, uH: { value: hh } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; uniform float uH; void main(){ vY = position.y / uH; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uCol; uniform vec3 uTip; uniform float uA; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.4); float a = uA * f * smoothstep(0., .12, vY) * (1. - smoothstep(.55, 1., vY)); gl_FragColor = vec4(mix(uCol, uTip, smoothstep(.3, 1., vY)) * a, 1.); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), m); mesh.renderOrder = ord; g.add(mesh); return mesh; };
  const outer = mk(r, h, o.outer ?? '#4C63FF', o.tip ?? '#4C63FF', o.aOuter ?? .6, 30), inner = mk(r * .5, h * .45, o.inner ?? '#8FD8FF', o.inner ?? '#8FD8FF', o.aInner ?? 1.1, 31);
  const light = new THREE.PointLight(o.light ?? '#9DB4FF', 0, h * 7, 2); light.position.y = h * .4; g.add(light);
  g.userData.set = (t, k) => { g.visible = k > .01; light.intensity = (o.lightMax ?? 25) * k; if (!g.visible) return; const f = 1 + .05 * Math.sin(t * 7.1) + .03 * Math.sin(t * 12.7) + .02 * Math.sin(t * 19.3);
    g.scale.set(.6 + .4 * k, Math.max(.05, k * f), .6 + .4 * k); outer.rotation.z = .025 * Math.sin(t * 3.3); inner.rotation.z = outer.rotation.z * .5; };
  return g; }
function bunsen(H = 7) { const g = new THREE.Group(), st = new THREE.MeshStandardMaterial({ color: '#AEB9C4', metalness: .85, roughness: .3 });
  cyl(2.1, 2.5, .8, darkMat, 0, .42, 0, g, 40); cyl(.42, .48, H - .8, st, 0, .85 + (H - .8) / 2, 0, g, 24); cyl(.62, .62, 1.0, darkMat, 0, 2.2, 0, g, 24);
  const hose = cyl(.22, .22, 4, new THREE.MeshStandardMaterial({ color: '#C8463E', roughness: .6 }), 2.8, 1.1, 0, g, 12); hose.rotation.z = Math.PI / 2;
  const fl = flameMesh({ h: 4.6, r: .62 }); fl.position.y = H + .05; g.add(fl); g.userData.flame = fl; return g; }
function spiritLamp(s = 1.6) { const g = new THREE.Group();
  g.add(glassPiece(lathe([[0, .03], [2.2 * s, .03], [2.9 * s, .6 * s], [3.0 * s, 1.8 * s], [2.2 * s, 3.1 * s], [.9 * s, 3.6 * s], [.9 * s, 3.9 * s]], 48), { opacity: .2, tint: '#D8ECF4' }));
  const sp = new THREE.Mesh(lathe([[0, .12 * s], [2.05 * s, .12 * s], [2.72 * s, .65 * s], [2.8 * s, 1.75 * s], [2.4 * s, 2.3 * s], [0, 2.3 * s]], 48), new THREE.MeshPhysicalMaterial({ color: '#5E8FD8', transparent: true, opacity: .55, roughness: .1 })); sp.renderOrder = 10; g.add(sp);
  const brass = new THREE.MeshStandardMaterial({ color: '#B89A5A', metalness: .85, roughness: .32 });
  cyl(1.0 * s, 1.05 * s, .8 * s, brass, 0, 4.1 * s, 0, g, 28); cyl(.55 * s, .9 * s, .35 * s, brass, 0, 4.65 * s, 0, g, 28);
  cyl(.28 * s, .3 * s, .7 * s, new THREE.MeshStandardMaterial({ color: '#E9E4D6', roughness: .9 }), 0, 5.1 * s, 0, g, 12);
  const fl = flameMesh({ h: 4.2 * s, r: .75 * s, outer: '#FF9A3C', tip: '#FFC56A', inner: '#6FA8FF', aOuter: .75, aInner: .9, light: '#FFB060', lightMax: 30 }); fl.position.y = 5.45 * s; g.add(fl);
  g.userData = { flame: fl, flameY: 5.45 * s }; return g; }
function tubeHolder(len = 13, r = 1.45) { const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ map: noiseTex('#B98B5A', .12, 41, 2), roughness: .6 });
  const wire = new THREE.MeshStandardMaterial({ color: '#AEB8C2', metalness: .9, roughness: .3 });
  box(len, .55, 1.1, wood, -len / 2 - r, .45, 0, g); box(len * .55, .5, 1.0, wood, -len * .275 - r, -.42, 0, g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r + .12, .14, 10, 40), wire); ring.rotation.x = Math.PI / 2; g.add(ring); return g; }
function barMagnet(L = 8) { const g = new THREE.Group(), w = 1.6, h = 1.2;
  const lab = (txt, bg) => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 256, 128); x.fillStyle = '#FFFFFF'; x.font = '700 84px "Segoe UI",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const mk = (txt, col, sx) => { const plain = new THREE.MeshStandardMaterial({ color: col, roughness: .38, metalness: .15 }), face = new THREE.MeshStandardMaterial({ map: lab(txt, col), roughness: .38, metalness: .15 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(L / 2, h, w), [plain, plain, face, plain, face, face]); m.position.x = sx * L / 4; m.castShadow = true; g.add(m); };
  mk('N', '#D9433F', 1); mk('S', '#3D6FD6', -1); g.userData.L = L; g.userData.h = h; g.userData.w = w; return g; }
function balance() { const g = new THREE.Group();
  box(12, 2.6, 11, new THREE.MeshPhysicalMaterial({ color: '#56626F', roughness: .4, clearcoat: .5 }), 0, 1.3, 0, g);
  cyl(4.8, 4.8, .3, steelMat, 0, 3.0, 0, g, 48); cyl(1, 1, .5, steelMat, 0, 2.7, 0, g, 20);
  const c = document.createElement('canvas'); c.width = 320; c.height = 100; const x = c.getContext('2d'); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.75), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false })); disp.position.set(0, 1.4, 5.55); g.add(disp);
  let last = null; g.userData.setText = s => { if (s === last) return; last = s; x.fillStyle = '#0F1E1A'; x.fillRect(0, 0, 320, 100); x.fillStyle = '#7CF2C6'; x.font = '700 64px Consolas, monospace'; x.textAlign = 'right'; x.textBaseline = 'middle'; x.fillText(s, 300, 54); tx.needsUpdate = true; };
  g.userData.setText('0.0 g'); g.userData.panY = 3.15; return g; }
function retortStand(h = 26) { const g = new THREE.Group(); box(9, .8, 6, darkMat, 0, .4, 0, g); cyl(.3, .3, h, steelMat, -3, h / 2 + .8, -1.6, g, 16); return g; }
function wisps(parent, n, color, size) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(3 * n), 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, map: SOFT, transparent: true, opacity: .45, depthWrite: false, sizeAttenuation: true })); p.frustumCulled = false; p.renderOrder = 40; parent.add(p);
  const seeds = []; const R = mulberry(n * 7 + 3); for (let i = 0; i < n; i++) seeds.push([R(), R(), R()]);
  p.userData.update = (t, src, k, rise = 6, spread = 1.4) => { const a = geo.attributes.position.array; p.visible = k > .02; p.material.opacity = .45 * k;
    for (let i = 0; i < n; i++) { const s = seeds[i], u = (t * .35 + s[0]) % 1; a[3 * i] = src.x + (s[1] - .5) * spread * (1 + u * 2) + Math.sin(t + i) * .3 * u; a[3 * i + 1] = src.y + u * rise; a[3 * i + 2] = src.z + (s[2] - .5) * spread * (1 + u * 2); }
    geo.attributes.position.needsUpdate = true; };
  return p; }
// ------------------------------------------------------------------ HTML labels anchored to 3D points
const LABELS = [];
function label(st, html, anchor, cls = '') { const el = document.createElement('div'); el.className = 'lbl ' + cls; el.innerHTML = html; $('labels').appendChild(el);
  const L = { st, el, anchor, show: true, set(h) { if (h !== L._h) { el.innerHTML = h; L._h = h; } } }; LABELS.push(L); return L; }
const _v = new THREE.Vector3();
function updateLabels() { const r = canvas.getBoundingClientRect();
  for (const L of LABELS) { const vis = L.st === cur.st && (typeof L.show === 'function' ? L.show() : L.show) && camReady;
    if (!vis) { L.el.style.display = 'none'; continue; }
    if (typeof L.anchor === 'function') _v.copy(L.anchor()); else if (L.anchor.isObject3D) L.anchor.getWorldPosition(_v); else _v.copy(L.anchor);
    _v.project(camera); if (_v.z > 1) { L.el.style.display = 'none'; continue; }
    const x = (_v.x * .5 + .5) * r.width, y = (-_v.y * .5 + .5) * r.height; L.el.style.display = 'block';
    const w = L.el.offsetWidth || 80; L.el.style.transform = `translate(${Math.round(clamp(x, w / 2 + 6, r.width - w / 2 - 6))}px,${Math.round(y)}px) translate(-50%,-100%)`; } }

// ------------------------------------------------------------------ helpers
const ST = {};
const toastEl = $('toast'); let toastT = 0;
function toast(msg, kind = '', ms = 3000) { toastEl.textContent = msg; toastEl.className = 'show ' + kind; clearTimeout(toastT); toastT = setTimeout(() => toastEl.className = '', ms); }
function act(a, t, v) { if (started && !ended) try { S.act(a, t, v); } catch (e) { console.warn(e); } }
function onBtn(id, fn) { $(id).addEventListener('click', e => { e.preventDefault(); fn(e); }); }
const HOLD = {};
function hold(id, fnDown, fnUp) { const el = $(id); HOLD[id] = false;
  const dn = e => { e.preventDefault(); if (HOLD[id]) return; HOLD[id] = true; el.classList.add('on'); fnDown && fnDown(); try { el.setPointerCapture(e.pointerId); } catch (_) { } };
  const up = () => { if (!HOLD[id]) return; HOLD[id] = false; el.classList.remove('on'); fnUp && fnUp(); };
  el.addEventListener('pointerdown', dn); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up); el.addEventListener('contextmenu', e => e.preventDefault()); }
const now = () => performance.now() / 1000;

// ================================================================== CHANGES LAB: one bench, six guided experiments (Next = one stage)
const seg = (u, a, b) => clamp((u - a) / (b - a));
const PORT = innerWidth / innerHeight < .9, PL = (p, l) => PORT ? p : l;   // phone portrait: deeper, tighter bench layout
const WORLD = new THREE.Group(); scene.add(WORLD); labSet(WORLD, 140);
const EXPS = {}, ORDER = [];
const tex = (draw, w = 256, h = 128) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
function labelTex(lines, o = {}) { return tex((x, w, h) => { x.fillStyle = o.bg ?? '#F4F1E6'; x.fillRect(0, 0, w, h); x.strokeStyle = o.line ?? '#2F6FD6'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
  x.fillStyle = o.ink ?? '#1F2A44'; x.textAlign = 'center'; x.textBaseline = 'middle'; const fs = o.fs ?? 40; x.font = `700 ${fs}px "Segoe UI",sans-serif`;
  lines.forEach((s, i) => x.fillText(s, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.1)); }, o.w ?? 256, o.h ?? 128); }
function band(r, hgt, y, t, span = 1.8) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hgt, 40, 1, true, -span / 2, span), new THREE.MeshStandardMaterial({ map: t, roughness: .75 })); m.position.y = y; return m; }
const lipRing = (r, y, op = .8) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, .06, 6, 64), new THREE.MeshBasicMaterial({ color: '#E2F3FF', transparent: true, opacity: op, depthWrite: false })); m.rotation.x = Math.PI / 2; m.position.y = y; m.renderOrder = 23; return m; };

// ---------------------------------------------------------------- shared apparatus
function tumbler(r = 2.6, h = 8) { const th = .14, g = glassPiece(lathe([[0, .03], [r - .3, .03], [r, .3], [r, h], [r - th, h + .02], [r - th, .62], [r - th - .25, .45], [0, .45]], 56), { opacity: .15 });
  g.add(lipRing(r - .06, h + .01)); g.userData = { r, h, inR: r - th, floor: .45 }; return g; }
function shallowDish(R = 4.5, H = 1.1) { const th = .12, g = glassPiece(lathe([[0, .03], [R - .25, .03], [R, .25], [R, H], [R - th, H + .02], [R - th, .26], [R - th - .1, .16], [0, .16]], 64), { opacity: .2, strength: 1.1 });
  g.add(lipRing(R - .05, H + .01)); g.userData = { R, H, inR: R - th, floor: .16 }; return g; }
function glassBowl(R = 5, H = 2.6) { const th = .14, g = glassPiece(lathe([[0, .03], [R * .82, .03], [R * .9, .2], [R, H], [R - th, H + .02], [R * .9 - th, .38], [R * .82 - .1, .26], [0, .26]], 64), { opacity: .18, strength: 1.05 });
  g.add(lipRing(R - .06, H + .01)); g.userData = { R, H, floor: .26 }; return g; }
// liquid in a test tube (round bottom + column): setLevel(top) above the hemisphere
function liquidTube(r, color, op = .5) { const g = new THREE.Group(), mat = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: op, roughness: .1, clearcoat: .4, envMapIntensity: .45, side: THREE.DoubleSide });
  const cy = r + .09, hemi = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat); hemi.position.y = cy; hemi.renderOrder = 10; g.add(hemi);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 32, 1, true), mat); col.renderOrder = 10; g.add(col);
  const topM = mat.clone(); topM.side = THREE.FrontSide; const top = new THREE.Mesh(new THREE.CircleGeometry(r, 32), topM); top.rotation.x = -Math.PI / 2; top.renderOrder = 11; g.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * .99, .04, 6, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.renderOrder = 12; g.add(ring);
  g.userData = { cy, setLevel(y) { const hh = Math.max(.01, y - cy); col.scale.y = hh; col.position.y = cy + hh / 2; top.position.y = y; ring.position.y = y + .02; },
    setColor(c, o) { mat.color.set(c); topM.color.set(c).lerp(new THREE.Color('#fff'), .06); if (o != null) { mat.opacity = o; topM.opacity = Math.min(1, o + .08); } } };
  return g; }
function amberBottle(lines, r = 2.1, h = 7.4) { const g = new THREE.Group(), nr = r * .42;
  const pts = [[0, .03], [r - .3, .03], [r, .35], [r, h * .7], [r * .62, h * .86], [nr, h * .9], [nr, h], [nr - .15, h], [nr - .15, h * .9], [0, h * .9]];
  const geo = lathe(pts, 48), body = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: '#5B2C0C', roughness: .1, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.5 })); body.castShadow = true; g.add(body);
  const sh = new THREE.Mesh(geo, rimMat({ color: '#FFCF9A', strength: .55, stripe: .4 })); sh.renderOrder = 21; g.add(sh);
  g.add(band(r + .02, h * .3, h * .4, labelTex(lines, { fs: lines.length > 1 ? 34 : 40 }), 2.0));
  const stopper = cyl(nr + .1, nr + .1, .9, new THREE.MeshPhysicalMaterial({ color: '#4A230A', roughness: .2, clearcoat: 1 }), 0, h + .4, 0, g, 24);
  g.userData = { mouthY: h, r: nr, stopper }; return g; }
function steelJug(r = 2.4, h = 7.2) { const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#D3DAE0', metalness: 1, roughness: .22, side: THREE.DoubleSide });
  const b = new THREE.Mesh(lathe([[0, .03], [r - .25, .03], [r, .3], [r * 1.04, h * .55], [r * .95, h * .86], [r * 1.08, h]], 48), m); b.castShadow = true; g.add(b);
  const hnd = new THREE.Mesh(new THREE.TorusGeometry(2, .22, 10, 24, Math.PI), m); hnd.rotation.z = Math.PI / 2; hnd.position.set(-r - .1, h * .55, 0); hnd.scale.set(1, 1.1, 1); g.add(hnd);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r * .99, 40), new THREE.MeshPhysicalMaterial({ color: '#9CC7D8', roughness: .05, clearcoat: 1, transparent: true, opacity: .85 })); water.rotation.x = -Math.PI / 2; water.position.y = h * .7; g.add(water);
  g.userData = { mouthY: h, r: r * 1.08 }; return g; }
// pour rig: rotate about the mouth. u: 0-.3 move, .3-.5 tilt, .5-.8 pour, .8-1 back. dir +1 = bottle sits right of the target
function pourRig(parent, obj, rest) { const pv = new THREE.Group(); parent.add(pv); obj.position.y = -obj.userData.mouthY; pv.add(obj); pv.userData.rest = rest.clone().add(V(0, obj.userData.mouthY, 0)); pv.position.copy(pv.userData.rest); return pv; }
function pourPose(pv, u, to, tilt, dir) { const a = smooth(seg(u, 0, .3)), b = smooth(seg(u, .3, .5)), c = smooth(seg(u, .82, 1));
  pv.position.copy(pv.userData.rest).lerp(to, a); pv.position.lerp(pv.userData.rest, c); pv.rotation.z = dir * tilt * Math.max(0, b - c); return u > .46 && u < .84; }
function streamMesh(parent, color) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.13, .1, 1, 10, 1, true), new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: .7, roughness: .08, side: THREE.DoubleSide, depthWrite: false })); m.renderOrder = 14; m.visible = false; parent.add(m);
  m.userData.set = (on, from, toY) => { m.visible = on && from.y > toY; if (!m.visible) return; const L = from.y - toY; m.scale.y = L; m.position.set(from.x, toY + L / 2, from.z); }; return m; }
class Bubbles {
  constructor(parent, n, o) { this.o = o; this.n = n; this.R = mulberry(o.seed ?? 7); this.acc = 0; this.P = [];
    this.m = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshPhysicalMaterial({ color: o.color ?? '#F2FAFF', transparent: true, opacity: o.op ?? .6, roughness: .04, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false }), n);
    this.m.renderOrder = 13; this.m.frustumCulled = false; parent.add(this.m); for (let i = 0; i < n; i++) { this.P.push({ live: false, p: V(), v: 0, s: 0, ph: 0 }); place(this.m, i, V(), 0); } }
  clear() { for (let i = 0; i < this.n; i++) { this.P[i].live = false; place(this.m, i, V(), 0); } this.m.instanceMatrix.needsUpdate = true; }
  update(dt, rate) { const o = this.o, R = this.R; this.acc += rate * dt;
    for (let i = 0; i < this.n && this.acc >= 1; i++) { const b = this.P[i]; if (b.live) continue; this.acc -= 1; b.live = true; const s = o.src();
      b.p.set(s.x + (R() - .5) * (o.jit ?? .3), s.y, s.z + (R() - .5) * (o.jit ?? .3)); b.v = (o.speed ?? 6) * (.7 + R() * .6); b.s = (o.size ?? .16) * (.5 + R()); b.ph = R() * 6; }
    if (this.acc > 3) this.acc = 3;
    const top = typeof o.top === 'function' ? o.top() : o.top;
    for (let i = 0; i < this.n; i++) { const b = this.P[i]; if (!b.live) continue; b.p.y += b.v * dt; b.ph += dt * 9; b.p.x += Math.sin(b.ph) * .012;
      if (o.cx != null) { const dx = b.p.x - o.cx, dz = b.p.z - o.cz; if (Math.hypot(dx, dz) > (o.r ?? 1)) { b.p.x -= dx * .1; b.p.z -= dz * .1; } }
      if (b.p.y > top) { b.live = false; place(this.m, i, V(), 0); continue; } place(this.m, i, b.p, b.s); }
    this.m.instanceMatrix.needsUpdate = true; } }
function deskClock() { const g = new THREE.Group(), R = 3;
  const face = tex((x, w, h) => { x.fillStyle = '#F6F4EE'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1F2A44'; x.fillStyle = '#1F2A44'; x.translate(w / 2, h / 2);
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r0 = i % 5 ? 108 : 96; x.lineWidth = i % 5 ? 2 : 6; x.beginPath(); x.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); x.lineTo(Math.sin(a) * 118, -Math.cos(a) * 118); x.stroke(); }
    x.font = '700 30px "Segoe UI",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; for (let i = 1; i <= 12; i++) { const a = i / 12 * Math.PI * 2; x.fillText(i, Math.sin(a) * 76, -Math.cos(a) * 76); } }, 256, 256);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R + .5, R + .5, 1.6, 48), new THREE.MeshStandardMaterial({ color: '#2F6FD6', roughness: .35, metalness: .2 })); body.rotation.x = Math.PI / 2; body.castShadow = true; g.add(body);
  const f = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ map: face, roughness: .5 })); f.position.z = .82; g.add(f);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshPhysicalMaterial({ color: '#fff', transparent: true, opacity: .08, roughness: .02, clearcoat: 1 })); glass.position.z = 1.0; glass.renderOrder = 20; g.add(glass);
  const hand = (L, w, col, z) => { const p = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(w, L, .06), new THREE.MeshStandardMaterial({ color: col, roughness: .4 })); m.position.y = L / 2 - .3; p.add(m); p.position.z = z; g.add(p); return p; };
  const hh = hand(1.7, .26, '#1F2A44', .87), mh = hand(2.5, .16, '#1F2A44', .93);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .2, 16), darkMat); cap.rotation.x = Math.PI / 2; cap.position.z = .98; g.add(cap);
  for (const sx of [-1, 1]) { const leg = cyl(.3, .4, 2, darkMat, sx * 2, -R - .4, 0, g, 12); leg.rotation.z = sx * .3; }
  g.userData.set = mins => { hh.rotation.z = -mins / 720 * Math.PI * 2; mh.rotation.z = -mins / 60 * Math.PI * 2; }; return g; }

// ---------------------------------------------------------------- experiment framework
function exp(def) { const G = new THREE.Group(); G.visible = false; WORLD.add(G); const E = Object.assign({ G, st: def.id, s: {} }, def); EXPS[def.id] = E; ORDER.push(def.id); return E; }
function lbl(E, html, anchor, show, cls = '') { const L = label(E.id, html, anchor, cls); L.show = show; return L; }
const HINT = 'Ask: was a new substance formed? No new substance = a physical change. One or more new substances = a chemical change.';

// ================================================================== 1. Paper and chalk (Activity 5.2 A, C)
{ const E = exp({ id: 'paper_chalk', cam: PL({ c: V(0, 2, 1), r: 8.6 }, { c: V(-.8, 2, 1), r: 11.5 }), answer: 'physical',
    right: 'Only the shape or size changed; no new substance is formed. Such changes are called physical changes.',
    why: { chemical: 'No new substance was formed: the unfolded sheet is still paper and the powder is still chalk.', both: 'Nothing new was formed here: the paper and the chalk remained the same. Only their shape or size changed.' } });
  const G = E.G, s = E.s;
  const N = 10, W = 1.35, D = 10, PX = PL(-2.9, -4.6), PZ = PL(5.2, 4);
  const fib = crease => tex((x, w, h) => { x.fillStyle = '#F5F2EA'; x.fillRect(0, 0, w, h); const R = mulberry(5); for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(150,140,120,${R() * .12})`; x.lineWidth = .6; const px = R() * w, py = R() * h, a = R() * 6; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 6, py + Math.sin(a) * 6); x.stroke(); }
    if (crease) for (let j = 1; j < N; j++) { const px = j / N * w; x.strokeStyle = 'rgba(120,110,95,.55)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px + 2, 0); x.lineTo(px + 2, h); x.stroke(); } }, 512, 256);
  const T0 = fib(false), T1 = fib(true);
  const pg = new THREE.BufferGeometry(), pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), idx = [];
  for (let j = 0; j <= N; j++) { uv[j * 4] = j / N; uv[j * 4 + 1] = 0; uv[j * 4 + 2] = j / N; uv[j * 4 + 3] = 1; if (j < N) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); } }
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); pg.setIndex(idx);
  const pmat = new THREE.MeshStandardMaterial({ map: T0, roughness: .92, side: THREE.DoubleSide });
  const paper = new THREE.Mesh(pg, pmat); paper.castShadow = paper.receiveShadow = true; paper.position.set(PX, 0, PZ); G.add(paper);
  const setFold = k => { const th = k * 1.22; let x = 0, y = 0; const xs = [0], ys = [0]; for (let j = 0; j < N; j++) { const a = (j % 2 ? -1 : 1) * th; x += W * Math.cos(a); y += W * Math.sin(a); xs.push(x); ys.push(y); }
    for (let j = 0; j <= N; j++) { const X = xs[j] - x / 2, Y = ys[j] + .07 + k * .2; pos[j * 6] = X; pos[j * 6 + 1] = Y; pos[j * 6 + 2] = -D / 2; pos[j * 6 + 3] = X; pos[j * 6 + 4] = Y; pos[j * 6 + 5] = D / 2; }
    pg.attributes.position.needsUpdate = true; pg.computeVertexNormals(); pg.computeBoundingSphere(); };
  setFold(0);
  const chalkMat = new THREE.MeshStandardMaterial({ map: noiseTex('#F3F1EB', .1, 61, 1, 900), roughness: 1 });
  const chalk = cyl(.48, .48, 6.2, chalkMat, 0, 0, 0, null, 20); chalk.rotation.z = Math.PI / 2; const chalkG = new THREE.Group(); chalkG.add(chalk); G.add(chalkG);
  const MO = PL(V(3.6, 0, -4.2), V(5.6, 0, -3)); const mo = mortar(4.2); mo.position.copy(MO); G.add(mo);
  const pe = pestle(7.5); G.add(pe);
  const stone = new THREE.MeshStandardMaterial({ map: noiseTex('#5E646B', .22, 81, 2, 4000), roughness: .8, metalness: .05, side: THREE.DoubleSide }); mo.traverse(o => { if (o.isMesh) o.material = stone; }); pe.traverse(o => { if (o.isMesh) o.material = stone; });
  const fl = (x, z) => mo.userData.floor(x, z) + MO.y;
  const pow = heap('chalk', (x, z) => fl(x - MO.x, z - MO.z), { seed: 8, rough: .12 }); G.add(pow);
  const NB = 26, bits = grainMesh(NB, new THREE.DodecahedronGeometry(.35, 0), ['#F4F2EC', '#E9E6DE'], { rough: 1, seed: 3 }); G.add(bits);
  const RB = mulberry(12), bitP = Array.from({ length: NB }, () => V((RB() - .5) * 3.2, 0, (RB() - .5) * 3.2));
  const chalkRest = PL(V(6.4, .5, 3.4), V(5.2, .5, 5));
  E.reset = () => { setFold(0); pmat.map = T0; pmat.needsUpdate = true; s.chalkIn = 0; s.grind = 0; };
  E.stages = [
    { text: 'Take a sheet of paper and a small piece of chalk.', dur: 1.2, apply(u) { paper.position.y = (1 - smooth(u)) * 3; } },
    { text: 'Fold the paper to create a new object.', dur: 2.6, apply(u) { setFold(smooth(u)); } },
    { text: 'Unfold it. Do you get the same paper back?', dur: 2.2, apply(u) { if (u > 0 && pmat.map !== T1) { pmat.map = T1; pmat.needsUpdate = true; } setFold(1 - smooth(u)); } },
    { text: 'Crush a small piece of chalk into powder.', dur: 3.6, apply(u) { s.chalkIn = smooth(seg(u, 0, .25)); s.grind = seg(u, .22, .92); } },
    { text: 'The paper and the chalk remained the same; only their shape or size changed.', dur: 1, apply() { } }
  ];
  E.update = (dt, t) => {
    const ci = s.chalkIn || 0, gr = s.grind || 0;
    const into = V(MO.x, fl(0, 0) + .7, MO.z), p = chalkRest.clone().lerp(into, ci); p.y += Math.sin(ci * Math.PI) * 4;
    chalkG.position.copy(p); chalkG.rotation.y = Math.PI / 2 * (1 - ci) + ci * .3; const sc = Math.max(0, 1 - gr * 1.15); chalkG.scale.setScalar(Math.max(.001, sc)); chalkG.visible = sc > .02;
    pow.userData.set(MO.x, MO.z, 1.4 + 1.6 * smooth(gr), 1.1 * smooth(gr));
    for (let i = 0; i < NB; i++) { const k = gr > 0 && gr < .97 ? Math.min(1, gr * 4) * (1 - smooth(seg(gr, .5, .95))) : 0; const q = bitP[i].clone().multiplyScalar(.5 + .5 * (i % 3) / 2); q.x += MO.x; q.z += MO.z; q.y = fl(q.x - MO.x, q.z - MO.z) + .25; place(bits, i, q, k * (.5 + (i % 4) * .2), i); }
    bits.instanceMatrix.needsUpdate = true;
    const active = gr > 0 && gr < 1, ang = t * 7;
    const top = active ? V(MO.x + Math.cos(ang) * 1.4, 9.2, MO.z + Math.sin(ang) * 1.4) : V(MO.x + 2.4, 8.4, MO.z + 1.2);
    const bot = active ? V(MO.x + Math.cos(ang) * .7, fl(0, 0) + .35, MO.z + Math.sin(ang) * .7) : V(MO.x - .9, fl(0, 0) + .4, MO.z - .2);
    pe.position.copy(bot); pe.quaternion.setFromUnitVectors(V(0, 1, 0), top.clone().sub(bot).normalize());
  };
  lbl(E, '<b>paper</b>', () => G.localToWorld(V(PX, .5, PZ + D / 2 + .5)), () => stageIs(E, 0));
  lbl(E, 'a <b>paper fan</b>: a new object', () => G.localToWorld(V(PX, 3.6, PZ)), () => stageIs(E, 1) && !busy, 'y');
  lbl(E, 'the same <b>paper</b> (fold marks)', () => G.localToWorld(V(PX, .8, PZ)), () => stageIs(E, 2) && !busy || stageIs(E, 4));
  lbl(E, '<b>chalk</b>', () => chalkG.localToWorld(V(0, 1.2, 0)), () => stageIs(E, 0) || stageIs(E, 1) || stageIs(E, 2));
  lbl(E, '<b>chalk</b> powder', () => G.localToWorld(V(MO.x, 5.2, MO.z)), () => (stageIs(E, 3) && !busy) || stageIs(E, 4), 'y');
  lbl(E, '<b>mortar</b> and pestle', () => G.localToWorld(V(MO.x + 3.6, 4.6, MO.z)), () => stageIs(E, 0));
}

// ================================================================== 2. Ice and water (opener + 5.5)
{ const E = exp({ id: 'ice_water', cam: PL({ c: V(.6, 5, -1), r: 10 }, { c: V(1.4, 5, -1), r: 12.8 }), answer: 'physical',
    right: 'Ice melted into water and froze into ice again: only the state changed. No new substance is formed, so this is a physical change.',
    why: { chemical: 'Ice and water are the same substance in different states. No new substance was formed.', both: 'Only the state of water changed (solid, liquid, solid). Nothing new was formed.' } });
  const G = E.G, s = E.s;
  const BOWL = PL(V(-4.4, 0, 5.4), V(-6.6, 0, 4)); const bowlG = new THREE.Group(); G.add(bowlG); const bowl = glassBowl(4.2, 2.4); bowlG.add(bowl);
  const water = liquidCyl(4.2 * .9 - .16, '#BFE3EE', .42); bowlG.add(water);
  const iceMat = new THREE.MeshPhysicalMaterial({ color: '#E6F6FF', roughness: .12, clearcoat: 1, clearcoatRoughness: .1, transparent: true, opacity: .78, envMapIntensity: 1.6, map: noiseTex('#E9F7FF', .25, 71, 1, 1400) });
  const ice = new THREE.Mesh(new RoundedBoxGeometry(3, 3, 3, 4, .45), iceMat); ice.castShadow = true; bowlG.add(ice);
  const iceDisc = new THREE.Mesh(new THREE.CylinderGeometry(4.2 * .9 - .17, 4.2 * .9 - .25, .5, 56), new THREE.MeshPhysicalMaterial({ color: '#EAF7FF', roughness: .35, clearcoat: .8, transparent: true, opacity: .88, map: noiseTex('#F2FAFF', .3, 73, 2, 2200) })); bowlG.add(iceDisc);
  // freezer: open box (no overlapping coplanar faces) + door hinged on the right
  const FZ = PL(V(3.6, 0, -6.5), V(6.6, 0, -4.5)), FW = 14, FH = 13, FD = 13, t = 1.1; const fz = new THREE.Group(); fz.position.copy(FZ); G.add(fz);
  const outM = new THREE.MeshPhysicalMaterial({ color: '#EEF2F5', roughness: .3, clearcoat: .6 }), inM = new THREE.MeshStandardMaterial({ color: '#CBDCE6', roughness: .7, map: noiseTex('#D3E3EC', .25, 77, 3, 3000) });
  const iw = FW - 2 * t - .04;
  box(iw, t, FD, outM, 0, t / 2 + .05, 0, fz); box(iw, t, FD, outM, 0, FH - t / 2, 0, fz); box(t, FH, FD, outM, -FW / 2 + t / 2, FH / 2 + .02, 0, fz); box(t, FH, FD, outM, FW / 2 - t / 2, FH / 2 + .02, 0, fz);
  box(iw - .04, FH - 2 * t - .1, t, outM, 0, FH / 2 + .02, -FD / 2 + t / 2 + .03, fz);
  box(iw - .3, .2, FD - t - .4, inM, 0, t + .2, .5, fz); box(iw - .3, FH - 2 * t - .6, .2, inM, 0, FH / 2, -FD / 2 + t + .3, fz);
  const doorP = new THREE.Group(); doorP.position.set(FW / 2, 0, FD / 2 + .05); fz.add(doorP);
  box(FW, FH, 1.2, outM, -FW / 2, FH / 2 + .02, .62, doorP); box(.8, 6, .9, steelMat, -FW + 1.8, FH / 2, 1.5, doorP);
  const lt = labelTex(['freezer'], { fs: 44, bg: '#EEF2F5', line: '#9FB0BE' }); const lp = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), new THREE.MeshStandardMaterial({ map: lt, roughness: .5 })); lp.position.set(-FW / 2, FH - 3, 1.25); doorP.add(lp);
  const clock = deskClock(); clock.position.copy(PL(V(-6.4, 3.1, -3.6), V(-4.2, 3.9, -7))); if (PORT) clock.scale.setScalar(.8); clock.rotation.y = .2; G.add(clock);
  const inside = V(FZ.x, t + .32, FZ.z - .5), lifted = V(FZ.x - 1, 8, 4);
  E.reset = () => { s.melt = 0; s.frozen = 0; s.door = 0; s.mv = 0; s.mins = 0; s.iceIn = 1; };
  const bowlAt = mv => { const a = smooth(seg(mv, 0, .5)), b = smooth(seg(mv, .5, 1)); const p = BOWL.clone().lerp(lifted, a); p.lerp(inside, b); if (mv > 0 && mv < 1) p.y += Math.sin(mv * Math.PI) * 3; return p; };
  E.stages = [
    { text: 'A cube of ice is placed in a glass bowl.', dur: 1.4, apply(u) { s.iceIn = smooth(u); } },
    { text: 'Half an hour later: it has now become water!', dur: 3.4, apply(u) { s.mins = 30 * smooth(u); s.melt = smooth(u); } },
    { text: 'Put the bowl of water in the freezer.', dur: 3.4, apply(u) { s.door = smooth(seg(u, 0, .25)) - smooth(seg(u, .8, 1)); s.mv = seg(u, .22, .82); } },
    { text: 'Take it out after some time. When ice melts, it can be refrozen into ice.', dur: 4, apply(u) { s.mins = 30 + 180 * smooth(seg(u, 0, .4)); s.frozen = u > .35 ? 1 : 0; s.door = smooth(seg(u, .4, .58)) - smooth(seg(u, .9, 1)); s.mv = 1 - seg(u, .52, .9); } },
    { text: 'Water changes from one state to another. It is still water: no new substance is formed.', dur: 1, apply() { } }
  ];
  E.update = () => {
    bowlG.position.copy(bowlAt(s.mv)); doorP.rotation.y = 1.75 * s.door; clock.userData.set(600 + s.mins);
    const k = s.melt, H = 3 * (1 - k * .96), Wd = 3 * (1 - k * .55); ice.visible = k < .985 && !s.frozen; ice.scale.set(Wd / 3, Math.max(.02, H / 3), Wd / 3); ice.position.set(0, .27 + H / 2 + (1 - s.iceIn) * 6, 0);
    water.userData.setLevel(.27, .27 + .55 * k); water.visible = k > .02 && !s.frozen;
    iceDisc.visible = !!s.frozen; iceDisc.position.y = .27 + .26;
  };
  lbl(E, '<b>ice</b> (solid)', () => ice.getWorldPosition(V()).add(V(0, 2.4, 0)), () => stageIs(E, 0) && !busy);
  lbl(E, '<b>water</b> (liquid)', () => bowlG.localToWorld(V(0, 2.8, 0)), () => stageIs(E, 1) && !busy);
  lbl(E, '<b>ice</b> again (solid)', () => bowlG.localToWorld(V(0, 2.8, 0)), () => (stageIs(E, 3) && !busy) || stageIs(E, 4), 'y');
  lbl(E, '<b>freezer</b>', () => fz.localToWorld(V(0, FH + 1.2, 0)), () => stageIs(E, 2));
}

// ================================================================== 3. Blowing air into tap water and lime water (Activity 5.3)
{ const E = exp({ id: 'lime_water', cam: PL({ c: V(0, 5, 0), r: 9.2 }, { c: V(0, 5, 0), r: 11.8 }), answer: 'chemical',
    right: 'A new white substance, calcium carbonate, is formed (with a little water). Changes in which one or more new substances are formed are called chemical changes.',
    eq: 'Calcium hydroxide (Lime water) + Carbon dioxide → Calcium carbonate (Insoluble substance) + Water',
    why: { physical: 'Look at B: a new white substance formed and settled at the bottom. A new substance means a chemical change.', both: 'The change to look at is in B: a new white substance (calcium carbonate) was formed. That is a chemical change.' } });
  const G = E.G, s = E.s, XA = PL(-3.3, -4.2), XB = PL(3.3, 4.2), TZ = PL(3, 2.5);
  const mk = (x, letter) => { const g = new THREE.Group(); g.position.set(x, 0, TZ); G.add(g); const tb = tumbler(2.6, 8.2); g.add(tb);
    g.add(band(2.63, 1.6, 6.2, labelTex([letter], { fs: 80, w: 128, h: 128 }), .7));
    const liq = liquidCyl(2.6 - .16, '#D6ECF2', .3); g.add(liq); const sed = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1, 48), new THREE.MeshStandardMaterial({ map: powderTex('chalk'), roughness: 1 })); g.add(sed);
    return { g, tb, liq, sed }; };
  const A = mk(XA, 'A'), B = mk(XB, 'B');
  const jug = pourRig(G, steelJug(), PL(V(-6, 0, -6), V(-9, 0, -5.5))), bot = pourRig(G, amberBottle(['Lime', 'water']), PL(V(6, 0, -6), V(9, 0, -5.5)));
  const stA = streamMesh(G, '#BFE3EE'), stB = streamMesh(G, '#E8F2EE');
  const strawT = tex((x, w, h) => { x.fillStyle = '#F4F4F2'; x.fillRect(0, 0, w, h); x.fillStyle = '#2F9E8F'; for (let i = 0; i < w; i += 32) x.fillRect(i, 0, 12, h); }, 256, 16); strawT.wrapS = strawT.wrapT = THREE.RepeatWrapping;
  const straw = (x, dir) => { const c = new THREE.CatmullRomCurve3([V(0, .9, 0), V(0, 8.2, 0), V(0, 10.5, 0), V(dir * .8, 12, 0), V(dir * 2.4, 12.8, 0)]); const m = new THREE.Mesh(new THREE.TubeGeometry(c, 60, .22, 12), new THREE.MeshStandardMaterial({ map: strawT, roughness: .5, side: THREE.DoubleSide }));
    m.castShadow = true; const g = new THREE.Group(); g.add(m); g.position.set(x + .9, 0, TZ - .6); G.add(g); return g; };
  const sA = straw(XA, -1), sB = straw(XB, 1);
  const bubA = new Bubbles(G, 70, { src: () => V(XA + .9, 1.0, TZ - .6), top: () => s.lvA, size: .17, speed: 7, cx: XA, cz: TZ, r: 2.2 });
  const bubB = new Bubbles(G, 70, { src: () => V(XB + .9, 1.0, TZ - .6), top: () => s.lvB, size: .17, speed: 7, cx: XB, cz: TZ, r: 2.2, color: '#FFFFFF' });
  E.reset = () => { s.lvA = .46; s.lvB = .46; s.in = 0; s.sa = 0; s.sb = 0; s.ra = 0; s.rb = 0; s.milk = 0; s.settle = 0; s.pj = 0; s.pb = 0; bubA.clear(); bubB.clear(); };
  const Q = .46 + (8.2 - .46) / 4;   // one-fourth
  const CAUT = 'Caution — Do not suck the water or lime water while doing this.';
  E.stages = [
    { text: 'Take two glass tumblers. Mark them A and B.', dur: 1.6, apply(u) { s.in = smooth(u); } },
    { text: 'Fill one-fourth of A with tap water and one-fourth of B with lime water.', dur: 5, apply(u) { s.pj = seg(u, 0, .5); s.pb = seg(u, .5, 1); s.lvA = lerp(.46, Q, smooth(seg(u, .25, .42))); s.lvB = lerp(.46, Q, smooth(seg(u, .75, .92))); } },
    { text: 'Blow air (exhale) into tumbler A using a straw.', safe: CAUT, dur: 3.4, apply(u) { s.sa = smooth(seg(u, 0, .25)) - smooth(seg(u, .85, 1)); s.ra = u > .25 && u < .85 ? 40 : 0; } },
    { text: 'Now blow air into tumbler B using a separate straw.', safe: CAUT, dur: 4, apply(u) { s.sb = smooth(seg(u, 0, .2)) - smooth(seg(u, .88, 1)); s.rb = u > .2 && u < .88 ? 40 : 0; s.milk = smooth(seg(u, .3, .85)); } },
    { text: 'Leave it for some time: a white substance settles at the bottom of B.', dur: 3.2, apply(u) { s.settle = smooth(u); } }
  ];
  E.update = dt => {
    A.g.position.y = B.g.position.y = (1 - s.in) * 9; A.g.visible = B.g.visible = s.in > .01;
    const fA = pourPose(jug, s.pj, V(XA - .9, 12.2, TZ), 1.6, -1), fB = pourPose(bot, s.pb, V(XB + .6, 11.8, TZ), 1.9, 1);
    bot.children[0].userData.stopper.visible = s.pb <= 0 || s.pb >= 1;
    stA.userData.set(fA, jug.position.clone().add(V(.5, -2.3, 0)), s.lvA); stB.userData.set(fB, bot.position.clone().add(V(-.3, -.8, 0)), s.lvB);
    A.liq.userData.setLevel(.46, s.lvA); A.liq.visible = s.lvA > .5; B.liq.userData.setLevel(.46, s.lvB); B.liq.visible = s.lvB > .5;
    const m = s.milk * (1 - .55 * s.settle); B.liq.userData.setColor(new THREE.Color('#D6ECF2').lerp(new THREE.Color('#F8F8F3'), m), .3 + .67 * m);
    const sh = .02 + .38 * s.settle; B.sed.visible = s.settle > .02; B.sed.scale.y = sh; B.sed.position.y = .47 + sh / 2; A.sed.visible = false;
    sA.position.y = (1 - s.sa) * 9; sA.visible = s.sa > .01; sB.position.y = (1 - s.sb) * 9; sB.visible = s.sb > .01;
    bubA.update(dt * Math.min(TS, 2), s.ra); bubB.update(dt * Math.min(TS, 2), s.rb);
  };
  lbl(E, '<b>A</b>: tap water', () => G.localToWorld(V(XA, 9.6, TZ)), () => stageAtLeast(E, 1) && !(stageIs(E, 1) && busy));
  lbl(E, '<b>B</b>: lime water', () => G.localToWorld(V(XB, 9.6, TZ)), () => stageAtLeast(E, 1) && !(stageIs(E, 1) && busy) && !stageAtLeast(E, 3));
  lbl(E, 'A: <b>bubbles only</b>', () => G.localToWorld(V(XA, 4.6, TZ + 2.8)), () => stageAtLeast(E, 2) && !(stageIs(E, 2) && busy), 'g');
  lbl(E, 'B: lime water turns <b>milky</b>', () => G.localToWorld(V(XB, 9.6, TZ)), () => stageAtLeast(E, 3) && !(stageIs(E, 3) && busy), 'y');
  lbl(E, 'white <b>substance</b> settles', () => G.localToWorld(V(XB, 1.1, TZ + 2.8)), () => stageIs(E, 4) && !busy, 'y');
}

// ================================================================== 4. Vinegar and baking soda (Activity 5.4)
{ const E = exp({ id: 'vinegar_soda', cam: PL({ c: V(-1.4, 9.5, 0), r: 9.2, dir: V(0, .32, 1).normalize() }, { c: V(-2.4, 9, 0), r: 11, dir: V(0, .3, 1).normalize() }), answer: 'chemical',
    right: 'Since a new substance, carbon dioxide, is formed in this reaction, a chemical change has occurred.',
    eq: 'Vinegar + Baking soda → Carbon dioxide + Other substances',
    why: { physical: 'A new substance, carbon dioxide gas, was formed: it turned the lime water milky. That is a chemical change.', both: 'The change here is the formation of a new substance, carbon dioxide. That is a chemical change.' } });
  const G = E.G, s = E.s, X1 = -3, X2 = 3, RY = .8;
  const wood = new THREE.MeshStandardMaterial({ map: noiseTex('#B98B5A', .12, 41, 2), roughness: .6 });
  { const sh = new THREE.Shape(); sh.moveTo(-6, -2.2); sh.lineTo(6, -2.2); sh.lineTo(6, 2.2); sh.lineTo(-6, 2.2); sh.lineTo(-6, -2.2);
    for (const x of [X1, X2]) { const h = new THREE.Path(); h.absarc(x, 0, 1.5, 0, Math.PI * 2, true); sh.holes.push(h); }
    const top = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .7, bevelEnabled: true, bevelThickness: .08, bevelSize: .08, bevelSegments: 2 }), wood); top.rotation.x = -Math.PI / 2; top.position.y = 8; top.castShadow = top.receiveShadow = true; G.add(top);
    box(12.4, .8, 4.6, wood, 0, .4, 0, G); box(.8, 7.9, 4.4, wood, -5.8, 4.4, 0, G); box(.8, 7.9, 4.4, wood, 5.8, 4.4, 0, G); }
  const tube = x => { const g = new THREE.Group(); g.position.set(x, RY + .01, 0); G.add(g); g.add(testTube(1.3, 15)); const l = liquidTube(1.17, '#E8CF7A', .6); g.add(l); return { g, l }; };
  const T1 = tube(X1), T2 = tube(X2); T2.l.userData.setColor('#DCEEEA', .3); T2.l.userData.setLevel(6.2);
  // cork + delivery tube (Fig. 5.3a)
  const del = new THREE.Group(); G.add(del);
  cyl(1.42, 1.2, 1.8, new THREE.MeshStandardMaterial({ map: noiseTex('#B07A45', .25, 91, 1, 1600), roughness: .9 }), X1, RY + 15 + .3, 0, del, 32);
  const curve = new THREE.CatmullRomCurve3([V(X1, RY + 13.6, 0), V(X1, RY + 18.5, 0), V(X1 + .6, RY + 20.2, 0), V(X1 + 1.8, RY + 20.8, 0), V(X2 - 1.8, RY + 20.8, 0), V(X2 - .6, RY + 20.2, 0), V(X2, RY + 18.5, 0), V(X2, RY + 2.2, 0)], false, 'catmullrom', .2);
  del.add(glassPiece(new THREE.TubeGeometry(curve, 120, .24, 12), { opacity: .3, edgeOpacity: .25, edgeAngle: 60 }));
  const vin = pourRig(G, amberBottle(['Vinegar']), PL(V(-6.6, 0, -5.5), V(-8.6, 0, -5)));
  const stV = streamMesh(G, '#E8CF7A');
  const SD = PL(V(-5.6, 0, 6), V(-7.6, 0, 5.4)); const dish = watchGlass(3); dish.position.copy(SD); G.add(dish);
  const sodaHeap = heap('soda', (x, z) => dish.userData.floor(x - SD.x, z - SD.z), { seed: 6 }); G.add(sodaHeap); sodaHeap.userData.set(SD.x, SD.z, 1.7, .7);
  const spat = spatula(8); G.add(spat); const scoop = new THREE.Mesh(new THREE.SphereGeometry(.55, 14, 10), powderMat('soda')); scoop.scale.set(1.1, .45, .9); scoop.position.set(-.5, .18, 0); spat.add(scoop);
  const NF = 30, fall = grainMesh(NF, new THREE.SphereGeometry(.09, 6, 5), ['#FFFFFF', '#F0F0EC'], { rough: 1 }); G.add(fall);
  const foam = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 1, 32), new THREE.MeshStandardMaterial({ map: noiseTex('#FBFBF8', .25, 95, 2, 3000), roughness: .9, transparent: true, opacity: .92 })); G.add(foam);
  const bub1 = new Bubbles(G, 110, { src: () => V(X1 + (Math.random() - .5) * 1.4, RY + .6, (Math.random() - .5) * 1.4), top: () => RY + s.lv1 + s.foam * 2.4, size: .15, speed: 6, jit: .2, cx: X1, cz: 0, r: 1, op: .85, color: '#FFFFFF' });
  const bub2 = new Bubbles(G, 60, { src: () => V(X2, RY + 2.1, 0), top: RY + 6.2, size: .16, speed: 6, cx: X2, cz: 0, r: 1, color: '#FFFFFF' });
  E.reset = () => { s.pv = 0; s.lv1 = .3; s.sp = 0; s.fizz = 0; s.foam = 0; s.del = 0; s.gas = 0; s.milk = 0; bub1.clear(); bub2.clear(); };
  const spatRest = V(SD.x + .4, .75, SD.z), spatOver = V(X1 + .4, RY + 16.6, .3);
  E.stages = [
    { text: 'Take a teaspoonful of vinegar in a test tube.', dur: 3.8, apply(u) { s.pv = u; s.lv1 = lerp(.3, 4.2, smooth(seg(u, .5, .82))); } },
    { text: 'Add a pinch of baking soda (sodium hydrogen carbonate) to it.', dur: 3.2, apply(u) { s.sp = u; s.fizz = u > .72 ? 70 : 0; s.foam = smooth(seg(u, .72, 1)) * .5; } },
    { text: 'You would hear a fizzing, bubbling sound and see the gas bubbles forming.', dur: 3, apply(u) { s.fizz = 90; s.foam = .5 + .5 * smooth(seg(u, 0, .4)); } },
    { text: 'Pass this gas through freshly prepared lime water kept in another test tube.', dur: 3.6, apply(u) { s.del = smooth(seg(u, 0, .4)); s.fizz = 55; s.foam = 1 - .3 * u; s.gas = u > .45 ? 30 : 0; } },
    { text: 'The lime water turns milky. The gas formed is carbon dioxide.', dur: 3.2, apply(u) { s.fizz = 40 * (1 - u); s.foam = .7 - .3 * u; s.gas = 30 * (1 - smooth(seg(u, .7, 1))); s.milk = smooth(seg(u, 0, .8)); } }
  ];
  E.update = (dt, t) => {
    const f = pourPose(vin, s.pv, V(X1 - .5, RY + 17.2, 0), 1.85, -1); vin.children[0].userData.stopper.visible = s.pv <= 0 || s.pv >= 1;
    stV.userData.set(f, vin.position.clone().add(V(.3, -.8, 0)), RY + s.lv1);
    T1.l.userData.setLevel(Math.max(1.4, s.lv1)); T1.l.visible = s.lv1 > .4;
    const a = smooth(seg(s.sp, 0, .35)), b = smooth(seg(s.sp, .38, .62)), c = smooth(seg(s.sp, .8, 1));
    const p = spatRest.clone().lerp(spatOver, a); p.lerp(spatRest, c); if (s.sp > 0 && s.sp < 1) p.y += Math.sin(a * Math.PI) * 2;
    spat.position.copy(p); spat.rotation.set(-1.6 * Math.max(0, b - c), -1.2 * (1 - a) - .05 * a, 0); scoop.visible = s.sp < .55;
    for (let i = 0; i < NF; i++) { const k = seg(s.sp, .45 + (i / NF) * .15, .62 + (i / NF) * .15); const q = V(X1 + Math.sin(i * 2.1) * .35, lerp(RY + 16.2, RY + s.lv1, k * k), Math.cos(i * 1.7) * .35); place(fall, i, q, k > 0 && k < 1 ? 1 : 0, i); }
    fall.instanceMatrix.needsUpdate = true;
    const fh = .05 + 2.6 * s.foam; foam.visible = s.foam > .02; foam.scale.y = fh; foam.position.set(X1, RY + s.lv1 + fh / 2 - .05, 0); foam.rotation.y = t * .2;
    del.position.y = (1 - s.del) * 7; del.visible = s.del > .01;
    bub1.update(dt * Math.min(TS, 2), s.fizz); bub2.update(dt * Math.min(TS, 2), s.gas);
    T2.l.userData.setColor(new THREE.Color('#DCEEEA').lerp(new THREE.Color('#F8F8F3'), s.milk), .3 + .67 * s.milk);
    sfx.fizz(s.fizz > 0 && started ? Math.min(1, s.fizz / 90) : 0);
  };
  lbl(E, '<b>vinegar</b>', () => G.localToWorld(V(X1 - 2.2, RY + 3.4, 1.6)), () => stageAtLeast(E, 0) && !(stageIs(E, 0) && busy) && !stageAtLeast(E, 2));
  lbl(E, '<b>baking soda</b>', () => G.localToWorld(V(SD.x, 2.4, SD.z)), () => stageIs(E, 0) || stageIs(E, 1));
  lbl(E, '<b>lime water</b>', () => G.localToWorld(V(X2 + 2, RY + 5.5, 1.6)), () => !stageAtLeast(E, 4) || (stageIs(E, 4) && busy));
  lbl(E, 'bubbles of <b>carbon dioxide</b> gas', () => G.localToWorld(V(X1 - 1.5, RY + 6.5, 1.5)), () => stageAtLeast(E, 2) && !(stageIs(E, 2) && busy), 'g');
  lbl(E, 'lime water turns <b>milky</b>', () => G.localToWorld(V(X2 + 2.2, RY + 5.5, 1.6)), () => stageIs(E, 4) && !busy, 'y');
}

// ================================================================== 5. Rusting (5.3.1; set-up as ch4 Fig. 4.4c) and burning magnesium ribbon (5.3.2)
{ const E = exp({ id: 'rust_magnesium', cam: PL({ c: V(.8, 6.5, 0), r: 9.2 }, { c: V(.6, 6.5, 0), r: 11.2 }), answer: 'chemical',
    right: 'Both form new substances: rust (iron oxide) and magnesium oxide. So rusting and the burning of magnesium ribbon are chemical changes.',
    eq: 'Magnesium (Ribbon) + Oxygen (Air) → Magnesium oxide (White powder) + Heat + Light',
    why: { physical: 'New substances were formed: brown rust (iron oxide) on the nail, and white magnesium oxide from the ribbon. That is a chemical change.', both: 'In both cases the change to look at is a new substance (iron oxide, magnesium oxide). That is a chemical change.' } });
  const G = E.G, s = E.s, BX = PL(-4.4, -6), BZ = PL(-1, 1), LX = PL(5.4, 7), LZ = PL(-4, -2.5), WG = PL(V(2, 0, 4.6), V(2.4, 0, 3.5));
  const jar = new THREE.Group(); jar.position.set(BX, 0, BZ); G.add(jar);
  const r = 3.3, h = 10; jar.add(glassPiece(lathe([[0, .03], [r - .3, .03], [r, .3], [r, h], [r * .78, h + 1.2], [r * .7, h + 1.4], [r * .7, h + 2.2], [r * .7 - .13, h + 2.22], [r * .7 - .13, h + 1.4], [r * .78 - .13, h + 1.2], [r - .13, h], [r - .13, .5], [0, .5]], 56), { opacity: .15 }));
  jar.add(lipRing(r * .7 - .05, h + 2.2)); jar.add(band(r + .02, 1.5, 7.2, labelTex(['C'], { fs: 80, w: 128, h: 128 }), .65));
  const jw = liquidCyl(r - .15, '#BFDCE6', .4); jar.add(jw); jw.userData.setLevel(.5, 4.6);
  const rod = glassRod(9); rod.rotation.z = Math.PI / 2; rod.position.set(4.5, h + 2.5, 0); jar.add(rod);
  jar.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, h + 2.5, 0), V(0, 8.6, 0)]), new THREE.LineBasicMaterial({ color: '#E8E2D2' })));
  const nailC = document.createElement('canvas'); nailC.width = 128; nailC.height = 256; const nx = nailC.getContext('2d'), nailT = new THREE.CanvasTexture(nailC); nailT.colorSpace = THREE.SRGBColorSpace;
  const RN = mulberry(33), spots = Array.from({ length: 160 }, () => ({ x: RN() * 128, y: RN() * 256, r: 3 + RN() * 12, k: RN() }));
  let lastRust = -1; const drawRust = k => { if (Math.abs(k - lastRust) < .04 && k !== 0 && k !== 1) return; lastRust = k; nx.fillStyle = '#8E979F'; nx.fillRect(0, 0, 128, 256); nx.fillStyle = 'rgba(255,255,255,.18)'; nx.fillRect(0, 0, 128, 256);
    for (const p of spots) { const wl = 1 - Math.abs(p.y / 256 - .7) * 1.4; const a = clamp((k * 1.3 - p.k * .7) * (.4 + wl)) * .92; if (a <= 0) continue; nx.fillStyle = `rgba(${92 + p.k * 40 | 0},${40 + p.k * 18 | 0},${16 + p.k * 8 | 0},${a})`; nx.beginPath(); nx.arc(p.x, p.y, p.r * (.6 + k * .6), 0, 7); nx.fill(); }
    nailT.needsUpdate = true; };
  const nailM = new THREE.MeshStandardMaterial({ map: nailT, metalness: .75, roughness: .35 });
  const nail = new THREE.Mesh(lathe([[0, 0], [.2, .7], [.2, 5.4], [.5, 5.45], [.5, 5.7], [0, 5.72]], 24), nailM); nail.position.y = 2.9; nail.castShadow = true; jar.add(nail);
  const lamp = spiritLamp(1.25); lamp.position.set(LX, 0, LZ); G.add(lamp); const LF = lamp.userData.flame;
  const wg = watchGlass(3.6); wg.position.copy(WG); G.add(wg);
  const mgo = heap('mgo', (x, z) => wg.userData.floor(x - WG.x, z - WG.z), { seed: 14 }); G.add(mgo);
  const tongs = new THREE.Group(); G.add(tongs);
  for (const sz of [-1, 1]) { const arm = box(13, .32, .5, steelMat, 6.5, 0, sz * .32, tongs); arm.rotation.y = sz * .04; }
  box(1.2, .9, 1.4, steelMat, 13, 0, 0, tongs);
  const rib = new THREE.Mesh(new THREE.BoxGeometry(4, .5, .05), new THREE.MeshStandardMaterial({ color: '#D9DEE3', metalness: .95, roughness: .22 })); rib.geometry.translate(-2, 0, 0); rib.castShadow = true; tongs.add(rib);
  const ash = new THREE.Mesh(new THREE.BoxGeometry(1, .6, .3), new THREE.MeshStandardMaterial({ map: powderTex('mgo'), roughness: 1 })); ash.geometry.translate(-.5, 0, 0); tongs.add(ash);
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: '#FFFFFF', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); glare.renderOrder = 50; G.add(glare);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: '#F4F8FF', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); core.renderOrder = 51; G.add(core);
  const mgLight = new THREE.PointLight('#FFFFFF', 0, 60, 2); G.add(mgLight);
  const smoke = wisps(G, 40, '#FFFFFF', 1.4);
  const NF = 24, flakes = grainMesh(NF, new THREE.DodecahedronGeometry(.14, 0), ['#FFFFFF', '#F1F1EE'], { rough: 1 }); G.add(flakes);
  const T_REST = V(LX + 4, .7, 7.5), T_LAMP = V(LX + 4, 9, LZ), T_BURN = V(WG.x + 4, 6.8, WG.z);
  const CAUT = 'The teacher may demonstrate this activity. Caution — It is advisable for students to wear protective eyeglasses and keep safe distance.';
  E.reset = () => { s.days = 0; s.rust = 0; s.lamp = 0; s.tg = 0; s.burn = 0; s.mg = 0; s.drop = 0; drawRust(0); };
  E.stages = [
    { text: 'An iron nail is partially dipped in water in a glass bottle kept open (unstoppered).', dur: 1.4, apply(u) { s.drop = smooth(u); } },
    { text: 'After 8–10 days: brown deposits. A new brown-coloured substance called rust is formed.', dur: 3.6, apply(u) { s.days = 10 * smooth(u); s.rust = smooth(seg(u, .1, 1)); } },
    { text: 'Hold a magnesium ribbon with a pair of tongs. Ignite the other end using a spirit lamp.', safe: CAUT, dur: 3.4, apply(u) { s.lamp = smooth(seg(u, 0, .2)); s.tg = seg(u, .15, 1); s.mg = u > .9 ? .25 : 0; } },
    { text: 'It burns with a dazzling white flame and changes into a white powder.', safe: CAUT, dur: 4.4, apply(u) { s.lamp = 1; s.tg = 1 + smooth(seg(u, 0, .2)); s.burn = smooth(seg(u, .12, .95)); s.mg = u < .96 ? 1 : 0; } },
    { text: 'Rust is iron oxide. The white powder is magnesium oxide. Heat and light are also produced.', dur: 1, apply() { s.lamp = 1; s.tg = 2; s.burn = 1; s.mg = 0; } }
  ];
  E.update = (dt, t) => {
    nail.position.y = 2.9 + (1 - s.drop) * 5; drawRust(s.rust); nailM.metalness = .75 - .45 * s.rust; nailM.roughness = .35 + .5 * s.rust;
    LF.userData.set(t, s.lamp);
    let p; const tg = s.tg; if (tg <= 1) { const a = smooth(seg(tg, 0, .6)); p = T_REST.clone().lerp(T_LAMP, a); if (tg > 0 && tg < .6) p.y += Math.sin(a * Math.PI) * 3; } else p = T_LAMP.clone().lerp(T_BURN, smooth(tg - 1));
    tongs.position.copy(p); tongs.rotation.z = tg > 0 ? .12 : 0;
    const L = 4 * (1 - s.burn * .9); rib.scale.x = Math.max(.02, L / 4); ash.position.x = -L; ash.scale.set(Math.max(.01, s.burn * 1.6), 1, 1); ash.visible = s.burn > .02;
    tongs.updateMatrixWorld(true); const tip = tongs.localToWorld(V(-L, 0, 0));
    const k = s.mg * (.85 + .15 * Math.sin(t * 31) * Math.sin(t * 17)); glare.visible = core.visible = k > .01; glare.position.copy(tip); core.position.copy(tip);
    glare.scale.setScalar(9 * k); core.scale.setScalar(2.6 * k); glare.material.opacity = .9 * k; mgLight.position.copy(tip).add(V(0, .5, 1)); mgLight.intensity = 900 * k;
    smoke.userData.update(t, tip, s.mg > .5 ? .7 : 0, 7, 1.2);
    mgo.userData.set(WG.x, WG.z, .5 + 1.6 * s.burn, .6 * s.burn);
    for (let i = 0; i < NF; i++) { const ph = (t * .9 + i / NF) % 1, on = s.mg > .5; const q = tip.clone().lerp(V(WG.x + Math.sin(i) * .8, .5, WG.z + Math.cos(i * 1.3) * .8), ph); place(flakes, i, q, on ? 1 : 0, i); } flakes.instanceMatrix.needsUpdate = true;
  };
  lbl(E, '<b>iron nail</b>', () => jar.localToWorld(V(2.4, 9.4, 0)), () => stageIs(E, 0));
  lbl(E, '<b>water</b> + <b>air</b>', () => jar.localToWorld(V(0, 2.2, r + .4)), () => stageIs(E, 0));
  lbl(E, 'Day <b id="dayN">0</b>', () => jar.localToWorld(V(0, 14.4, 0)), () => stageIs(E, 1));
  lbl(E, '<b>rust</b> (iron oxide)', () => jar.localToWorld(V(0, 6.6, r + .4)), () => (stageIs(E, 1) && !busy) || stageAtLeast(E, 4), 'c');
  lbl(E, '<b>magnesium ribbon</b>', () => tongs.localToWorld(V(-2, 1.2, 0)), () => stageIs(E, 2));
  lbl(E, '<b>spirit lamp</b>', () => lamp.localToWorld(V(-2.6, 3, 0)), () => stageIs(E, 2));
  lbl(E, '<b>magnesium oxide</b> (white powder)', () => wg.localToWorld(V(0, 1.6, 2.4)), () => (stageIs(E, 3) && !busy) || stageAtLeast(E, 4), 'y');
  E.lblDay = () => { const el = document.getElementById('dayN'); if (el) el.textContent = Math.round(s.days); };
}

// ================================================================== 6. A burning candle (Activities 5.5, 5.7)
{ const E = exp({ id: 'candle', cam: PL({ c: V(0, 6, 0), r: 9.4 }, { c: V(0, 6, 0), r: 10.6 }), answer: 'both',
    right: 'The melting of wax, its solidification, and evaporation are physical changes. The burning of the wax vapour is a chemical change. So the burning of a candle involves both physical and chemical changes.',
    eq: 'Oxygen is required for combustion.<small>The carbon dioxide was formed by the carbon from the wax and the oxygen from the air.</small>',
    why: { physical: 'The wax vapour burns: new substances, such as carbon dioxide, are formed. That part is a chemical change, so this is not only physical.', chemical: 'The wax also melts, flows, solidifies and evaporates: those are physical changes. Here both kinds happen.' } });
  const G = E.G, s = E.s, X1 = PL(-4.6, -5), X2 = PL(4.6, 5), DR = PL(4.2, 4.4);
  const waxM = new THREE.MeshPhysicalMaterial({ color: '#F3EAD2', roughness: .55, clearcoat: .2, sheen: .4, sheenColor: new THREE.Color('#FFF3D6') });
  const mkC = x => { const g = new THREE.Group(); g.position.set(x, 0, 0); G.add(g); const d = shallowDish(DR, 1.0); g.add(d);
    cyl(1, 1, 7, waxM, 0, .17 + 3.5, 0, g, 40);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(.82, 40), new THREE.MeshPhysicalMaterial({ color: '#F8EFCF', roughness: .04, clearcoat: 1, transparent: true, opacity: .9 })); pool.rotation.x = -Math.PI / 2; pool.position.y = 7.17 + .03; g.add(pool);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, 1.1, 8), new THREE.MeshStandardMaterial({ color: '#1C1814', roughness: .9 })); wick.position.y = 7.17 + .5; wick.rotation.z = .08; g.add(wick);
    const fl = flameMesh({ h: 3, r: .55, outer: '#FFB347', tip: '#FFE9A6', inner: '#5C86FF', aOuter: 1.0, aInner: .45, light: '#FFB060', lightMax: 60 }); fl.position.y = 7.17 + .55; g.add(fl);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: '#FFB860', transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); glow.position.y = 7.17 + 1.8; glow.scale.setScalar(3.2); glow.renderOrder = 40; g.add(glow);
    const lime = liquidCyl(DR - .14, '#DCEEEA', .3); g.add(lime); lime.visible = false;
    const sm = wisps(G, 30, '#DDE3E8', 1.1);
    return { g, fl, pool, glow, lime, sm, wickTop: () => g.localToWorld(V(0, 7.17 + 1.1, 0)) }; };
  const C1 = mkC(X1), C2 = mkC(X2);
  const drip = new THREE.Mesh(new THREE.CapsuleGeometry(.22, 1, 4, 10), new THREE.MeshPhysicalMaterial({ color: '#F6EBCB', roughness: .2, clearcoat: .8 })); drip.position.set(X1 + .98, 0, .2); G.add(drip);
  const cover = new THREE.Group(); G.add(cover); { const tb = tumbler(3.4, 13.5); tb.rotation.x = Math.PI; tb.position.y = 13.5 + .02; cover.add(tb); } cover.position.set(X2, .17, 0);
  const match = new THREE.Group(); G.add(match); box(5, .26, .26, new THREE.MeshStandardMaterial({ color: '#E2C48E', roughness: .8 }), -2.5, 0, 0, match);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 12, 8), new THREE.MeshStandardMaterial({ color: '#B23A2A', roughness: .6 })); head.scale.set(1.4, 1, 1); match.add(head);
  const mfl = flameMesh({ h: 1.6, r: .3, outer: '#FFB347', tip: '#FFE9A6', inner: '#FFD480', aOuter: 1, aInner: .5, light: '#FFB060', lightMax: 20 }); mfl.position.set(.2, 0, 0); match.add(mfl);
  const drp = new THREE.Group(); G.add(drp); drp.add(glassPiece(lathe([[0, 0], [.12, 0], [.32, 1.2], [.32, 5], [0, 5]], 20), { opacity: .3 }));
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.55, 16, 12), new THREE.MeshStandardMaterial({ color: '#3B3F45', roughness: .5 })); bulb.scale.set(1, 1.5, 1); bulb.position.y = 5.6; drp.add(bulb);
  const drops = grainMesh(6, new THREE.SphereGeometry(.14, 8, 6), ['#E4F2EE'], { rough: .1 }); G.add(drops);
  const vap = grainMesh(18, new THREE.SphereGeometry(.05, 6, 4), ['#FFE7B0'], { rough: 1 }); G.add(vap);
  E.reset = () => { s.lit1 = 0; s.lit2 = 0; s.m = 0; s.pool = 0; s.drip = 0; s.cov = 0; s.out = 0; s.lime = 0; s.milk = 0; s.dr = 0; s.vap = 0; };
  E.stages = [
    { text: 'Place two identical candles on two separate petri dishes and light them.', safe: 'Caution — Perform this activity under the supervision of your teacher or an adult.', dur: 3.8, apply(u) { s.m = u; s.lit1 = smooth(seg(u, .35, .45)); s.lit2 = smooth(seg(u, .68, .78)); } },
    { text: 'The wax melts, is carried up the wick, and evaporates due to the heat of the flame.', cam: { c: V(X1, 8.2, 0), r: 4.6 }, dur: 3.2, apply(u) { s.lit1 = s.lit2 = 1; s.pool = smooth(u); s.vap = 1; } },
    { text: 'The vapour of wax burns to produce a flame. Melted wax flows and solidifies.', cam: { c: V(X1, 7, 0), r: 5.6 }, dur: 3.4, apply(u) { s.lit1 = s.lit2 = 1; s.pool = 1; s.vap = 1; s.drip = smooth(u); } },
    { text: 'Cover one of the candles with a glass tumbler.', dur: 2.6, apply(u) { s.lit1 = s.lit2 = 1; s.pool = 1; s.drip = 1; s.vap = 0; s.cov = smooth(u); } },
    { text: 'The covered candle stops burning after some time: it has no continuous supply of air.', dur: 3.8, apply(u) { s.lit1 = 1; s.pool = 1; s.drip = 1; s.cov = 1; s.lit2 = 1 - smooth(seg(u, .1, .75)); s.out = smooth(seg(u, .7, 1)); } },
    { text: 'Add a little lime water in the petri dish: it turns milky. Carbon dioxide was formed.', dur: 3.8, apply(u) { s.lit1 = 1; s.pool = 1; s.drip = 1; s.cov = 1; s.lit2 = 0; s.out = 1; s.dr = u; s.lime = smooth(seg(u, .25, .55)); s.milk = smooth(seg(u, .55, 1)); } }
  ];
  E.update = (dt, t) => {
    C1.fl.userData.set(t, s.lit1); C2.fl.userData.set(t, s.lit2); C1.glow.visible = s.lit1 > .05; C2.glow.visible = s.lit2 > .05; C1.glow.material.opacity = .35 * s.lit1; C2.glow.material.opacity = .35 * s.lit2;
    C1.pool.visible = s.lit1 > .5; C2.pool.visible = s.lit2 > .5 || s.out > 0; C1.pool.material.opacity = .4 + .5 * s.pool; C1.pool.scale.setScalar(.6 + .4 * s.pool); C2.pool.scale.copy(C1.pool.scale);
    const dl = 3.2 * s.drip; drip.visible = s.drip > .02; drip.scale.set(1, Math.max(.05, dl), 1); drip.position.y = 7.1 - dl / 2; drip.material.clearcoat = .8 * (1 - smooth(seg(s.drip, .6, 1))); drip.material.roughness = .2 + .4 * smooth(seg(s.drip, .6, 1));
    cover.position.y = .17 + (1 - s.cov) * 16; cover.visible = s.cov > .01;
    const w1 = C1.wickTop().add(V(.3, -.1, 0)), w2 = C2.wickTop().add(V(.3, -.1, 0)), rest = V(12, .5, 6); let mp; const on = s.m > .15 && s.m < .9;
    if (s.m <= .4) mp = rest.clone().lerp(w1, smooth(seg(s.m, 0, .35))); else if (s.m <= .75) mp = w1.clone().lerp(w2, smooth(seg(s.m, .45, .68))); else mp = w2.clone().lerp(rest, smooth(seg(s.m, .8, 1)));
    match.position.copy(mp); match.rotation.z = .5; match.visible = s.m > 0 && s.m < 1; mfl.userData.set(t, on ? 1 : 0);
    C1.sm.userData.update(t, C1.wickTop(), 0); C2.sm.userData.update(t, C2.wickTop(), s.out * (1 - smooth(seg(s.milk, .5, 1))) * .9, 4.5, .8);
    for (let i = 0; i < 18; i++) { const ph = (t * .8 + i / 18) % 1; const q = C1.g.localToWorld(V(Math.sin(i * 2.3) * .05, 7.2 + ph * 1.3, Math.cos(i * 1.9) * .05)); place(vap, i, q, s.vap > 0 && s.lit1 > .5 ? .9 : 0, 0); } vap.instanceMatrix.needsUpdate = true;
    const dpos = V(X2 + DR - .5, 2.4 + (1 - smooth(seg(s.dr, 0, .2))) * 9 + smooth(seg(s.dr, .85, 1)) * 9, .5); drp.position.copy(dpos); drp.visible = s.dr > 0 && s.dr < 1;
    for (let i = 0; i < 6; i++) { const ph = seg(s.dr, .2 + i * .05, .3 + i * .05); place(drops, i, V(X2 + DR - .5, lerp(2.2, .3, ph), .5), ph > 0 && ph < 1 ? 1 : 0); } drops.instanceMatrix.needsUpdate = true;
    C2.lime.visible = s.lime > .02; C2.lime.userData.setLevel(.18, .18 + .5 * s.lime); C2.lime.userData.setColor(new THREE.Color('#DCEEEA').lerp(new THREE.Color('#F8F8F3'), s.milk), .3 + .67 * s.milk);
  };
  lbl(E, '<b>candle</b> on a <b>petri dish</b>', () => G.localToWorld(V(X1, 2.4, 4.6)), () => stageIs(E, 0) && !busy);
  lbl(E, 'wax <b>melts</b>', () => C1.g.localToWorld(V(-1.2, 7.3, .8)), () => stageIs(E, 1) && !busy, 'y');
  lbl(E, 'carried up the <b>wick</b>', () => C1.g.localToWorld(V(1.4, 7.9, .4)), () => stageIs(E, 1) && !busy, 'g');
  lbl(E, 'wax <b>vapour</b> burns', () => C1.g.localToWorld(V(0, 11.1, 0)), () => stageIs(E, 2) && !busy, 'c');
  lbl(E, 'wax <b>solidifies</b>', () => G.localToWorld(V(X1 + 1.6, 4.6, .4)), () => stageIs(E, 2) && !busy, 'y');
  lbl(E, '<b>glass tumbler</b>', () => G.localToWorld(V(X2, 14.6, 0)), () => stageIs(E, 3) && !busy);
  lbl(E, 'goes out: <b>no air</b> supply', () => G.localToWorld(V(X2, 14.6, 0)), () => stageIs(E, 4) && !busy, 'c');
  lbl(E, 'keeps burning', () => G.localToWorld(V(X1, 11.4, 0)), () => stageIs(E, 4) && !busy, 'g');
  lbl(E, 'lime water turns <b>milky</b>', () => G.localToWorld(V(X2 + 3, 1.8, 4.4)), () => stageIs(E, 5) && !busy, 'y');
}

// ================================================================== flow: tasks, stages, NEXT, the end choice
let cur = EXPS.paper_chalk, camReady = false, camAnim = null, stage = 0, su = 1, busy = false, phase = 'stage';   // phase: stage | choose | result
let started = false, ended = false, curTask = null; const solved = {}, starsOf = {}, pen = {};
function stageIs(E, i) { return cur === E && (phase === 'stage' ? stage === i : i === E.stages.length - 1); }
function stageAtLeast(E, i) { return cur === E && (stage >= i || phase !== 'stage'); }
const taskOf = id => TASKS.find(t => t.id === id), idx = id => ORDER.indexOf(id);
function setStage(i, instant) { const E = cur; E.reset(); for (let j = 0; j < i; j++) E.stages[j].apply(1); stage = i; su = instant ? 1 : 0; E.stages[i].apply(su); busy = !instant; phase = 'stage'; renderUI(); frame(E.stages[i].cam || E.cam, false); }
function openExp(id, why) {
  for (const k in EXPS) EXPS[k].G.visible = k === id; cur = EXPS[id];
  if (!solved[id] && curTask !== id && started && !ended) { S.task(id); curTask = id; pen[id] = { hints: 0, wrong: 0 }; }
  else if (solved[id]) curTask = null;
  $('hintText').style.display = 'none'; $('why').style.display = 'none';
  if (why === 'list') act('open', id, 1);
  sfx.fizz(0); setStage(0, false); }
function next() {
  if (!started) return;
  if (phase === 'result') { const n = ORDER.find((id, i) => i > idx(cur.id) && !solved[id]) || ORDER.find(id => !solved[id]); if (!n) { showDone(); return; } sfx.tick(); openExp(n, 'next'); return; }
  if (busy || phase !== 'stage') return;
  act('next', cur.id, stage + 1); sfx.tick();
  if (stage < cur.stages.length - 1) { setStage(stage + 1, false); return; }
  phase = 'choose'; renderUI(); }
function choose(a) {
  if (phase !== 'choose') return; const E = cur, ok = a === E.answer, id = E.id;
  act('choose', a, ok);
  if (!ok) { sfx.wrong(); if (curTask === id && !solved[id]) { pen[id].wrong++; S.retry(); } $('why').textContent = E.why[a] || ''; $('why').style.display = 'block'; document.querySelector(`#choices [data-a="${a}"]`).classList.add('x'); applyOffset(); return; }
  sfx.right(); let stars = 0;
  if (curTask === id && !solved[id]) { const p = pen[id], n = p.hints + p.wrong; stars = n === 0 ? 3 : n === 1 ? 2 : 1; S.done(stars); solved[id] = true; starsOf[id] = stars; curTask = null; }
  phase = 'result'; $('why').style.display = 'none'; $('hintText').style.display = 'none';
  const name = { physical: 'Physical change', chemical: 'Chemical change', both: 'Physical and chemical changes' }[E.answer];
  $('resH').innerHTML = name + (stars ? `<span class="st">${'★'.repeat(stars)}</span>` : ''); $('resT').textContent = E.right;
  $('resEq').innerHTML = E.eq || ''; $('resEq').style.display = E.eq ? 'block' : 'none'; renderUI();
  if (ORDER.every(k => solved[k]) && !ended) setTimeout(showDone, 2600); }
function showDone() { if (ended) return; $('doneStars').textContent = ORDER.map(k => '★'.repeat(starsOf[k] || 0)).join('  '); $('done').style.display = 'flex'; S.end(); ended = true; }
function renderUI() {
  const E = cur, i = idx(E.id), T = taskOf(E.id), nS = E.stages.length, st = E.stages[stage];
  $('key').textContent = `${i + 1}/6 · ${T.title}` + (phase === 'stage' ? ` · step ${stage + 1}/${nS}` : '');
  $('line').style.display = phase === 'result' ? 'none' : 'block'; $('line').textContent = st.text;
  $('safe').style.display = phase === 'stage' && st.safe ? 'block' : 'none'; $('safe').textContent = st.safe || '';
  $('res').style.display = phase === 'result' ? 'block' : 'none';
  if (phase !== 'choose') $('why').style.display = 'none';
  $('bHint').disabled = !(curTask === E.id) || phase === 'result';
  const ch = $('choices'); ch.style.display = phase === 'choose' ? 'flex' : 'none'; if (phase !== 'choose') ch.querySelectorAll('button').forEach(b => b.classList.remove('x'));
  const b = $('bNext'); b.style.display = phase === 'choose' ? 'none' : 'block';
  b.textContent = phase === 'result' ? (ORDER.every(k => solved[k]) ? 'ALL DONE' : 'NEXT EXPERIMENT') : 'NEXT'; b.classList.toggle('wait', busy && phase === 'stage');
  $('dots').innerHTML = phase === 'result' ? '' : E.stages.map((_, k) => `<i class="${k < stage ? 'on' : k === stage && phase === 'stage' ? 'cur' : ''}"></i>`).join('') + `<i class="${phase === 'choose' ? 'cur' : ''}" style="border-radius:2px"></i>`;
  applyOffset(); }
onBtn('bNext', next);
['cPhy', 'cChem', 'cBoth'].forEach(id => onBtn(id, () => choose($(id).dataset.a)));
onBtn('bHint', () => { const id = cur.id; if (curTask !== id) return; const p = pen[id]; if (!p.hints) { p.hints = 1; S.hint(); } act('hint', id, 1);
  $('hintText').textContent = id === 'candle' ? 'Look at each part: the wax melting, flowing and solidifying, and the wax vapour burning. ' + HINT : HINT; $('hintText').style.display = 'block'; applyOffset(); });
const sheet = $('sheet'), sbox = $('sheetBox');
function closeSheet() { sheet.classList.remove('show'); }
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
function openList() {
  sbox.innerHTML = `<button class="btn x" id="xS">Close</button><h2>Experiments</h2>` + ORDER.map((id, i) => { const T = taskOf(id);
    return `<button class="trow${cur.id === id ? ' cur' : ''}" id="row_${id}"><span class="n">${i + 1}</span><span>${T.title}<small>level ${T.level}${solved[id] ? ' · done' : ''}</small></span><span class="s">${solved[id] ? '★'.repeat(starsOf[id]) : ''}</span></button>`; }).join('');
  sheet.classList.add('show'); $('xS').onclick = closeSheet;
  ORDER.forEach(id => $('row_' + id).onclick = () => { closeSheet(); if (!started) return; openExp(id, 'list'); }); }
onBtn('bList', () => { if (started) openList(); });
onBtn('bExit', () => { if (!started) { $('intro').style.display = 'none'; started = true; } if (!ended) { S.end(); ended = true; } curTask = null; closeSheet(); sfx.stop(); toast('Visit ended. You can close this page.', '', 5000); });
onBtn('bMusic', () => { sfx.toggle(); $('muteX').style.display = sfx.on ? 'none' : 'block'; act('toggle', 'sound', sfx.on); });
onBtn('bDoneOk', () => { $('done').style.display = 'none'; });
onBtn('bStart', () => { $('intro').style.display = 'none'; started = true; sfx.start(); openExp('paper_chalk', 'start'); });

// ---------------------------------------------------------------- camera framing (the bench fits between the top card and the bottom buttons)
function visArea() { const W = innerWidth, H = innerHeight; if (W >= 900) return { top: 20, bot: H - 96 };
  const top = $('top').getBoundingClientRect().bottom + 4, bot = $('bottom').getBoundingClientRect().top - 4; return { top, bot: Math.max(top + 140, bot) }; }
function applyOffset() { const W = innerWidth, H = innerHeight, va = visArea(), cy = (va.top + va.bot) / 2, cx = W >= 900 ? W / 2 + Math.min(150, W * .1) : W / 2; camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H); }
function frame(cam, instant) {
  const W = innerWidth, H = innerHeight, va = visArea(), vh = va.bot - va.top, vw = W >= 900 ? W - 2 * Math.min(150, W * .1) - 40 : W; applyOffset();
  const fovV = THREE.MathUtils.degToRad(camera.fov) * vh / H, fovH = 2 * Math.atan(Math.tan(fovV / 2) * vw / vh);
  const portrait = W / H < .9, dist = cam.r / Math.sin(Math.min(fovV, fovH) / 2), dir = cam.dir || (portrait ? V(0, .78, 1) : V(0, .45, 1)).normalize();
  const to = cam.c.clone(), pos = to.clone().add(dir.clone().multiplyScalar(dist));
  controls.minDistance = dist * .35; controls.maxDistance = dist * 1.7;
  key.position.copy(to).add(V(30, 70, 50)); key.target.position.copy(to); fill.position.copy(to).add(V(-50, 30, 20)); fill.target.position.copy(to); rimL.position.copy(to).add(V(10, 25, -60)); rimL.target.position.copy(to);
  if (instant) { camera.position.copy(pos); controls.target.copy(to); camAnim = null; }
  else camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: to, k: 0 };
  camReady = true; }
function resize() { const W = innerWidth, H = innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); const st = cur.stages[stage]; frame((st && st.cam) || cur.cam, true); }
addEventListener('resize', resize);

// ---------------------------------------------------------------- sound: generated music + small effects, one mute button (no voice)
const sfx = (() => {
  let ctx = null, master = null, on = true, timer = 0, step = 0, fzG = null; const notes = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
  function tone(f, t, v, d = 2.4, type = 'sine') { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(.0005, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .1); }
  function pad() { [130.8, 196, 246.9].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), lf = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = i * 4 - 4;
    g.gain.value = .016; lf.frequency.value = .07 + i * .03; lg.gain.value = .009; lf.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(master); o.start(); lf.start(); }); }
  function loop() { if (!on || !ctx) return; const t = ctx.currentTime + .05, R = (step * 2654435761 >>> 0) % 7; tone(notes[R], t, .045); if (step % 3 === 0) tone(notes[(R + 2) % 7] / 2, t + .6, .03); step++; timer = setTimeout(loop, 1500); }
  function fizzNode() { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), R = mulberry(99); for (let i = 0; i < n; i++) d[i] = (R() * 2 - 1) * (R() < .08 ? 1 : .25);
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500; fzG = ctx.createGain(); fzG.gain.value = 0; src.connect(hp); hp.connect(fzG); fzG.connect(master); src.start(); }
  return { get on() { return on; },
    start() { try { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .8; master.connect(ctx.destination); pad(); fizzNode(); } ctx.resume(); if (on) { clearTimeout(timer); loop(); } } catch (e) { } },
    stop() { on = false; clearTimeout(timer); try { ctx && ctx.suspend(); } catch (e) { } },
    toggle() { on = !on; if (on) this.start(); else { clearTimeout(timer); try { ctx && ctx.suspend(); } catch (e) { } } },
    tick() { if (on && ctx) tone(880, ctx.currentTime, .03, .25); },
    right() { if (on && ctx) { const t = ctx.currentTime; tone(523.3, t, .06, 1); tone(659.3, t + .12, .06, 1); tone(784, t + .24, .07, 1.4); } },
    wrong() { if (on && ctx) { const t = ctx.currentTime; tone(220, t, .06, .6, 'triangle'); tone(196, t + .15, .05, .7, 'triangle'); } },
    fizz(k) { if (fzG && ctx) fzG.gain.setTargetAtTime(on ? k * .05 : 0, ctx.currentTime, .1); } };
})();

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock(); let fpsAvg = 60;
function tick() {
  requestAnimationFrame(tick);
  const raw = clock.getDelta(), dt = Math.min(.05, raw), t = clock.elapsedTime; fpsAvg = fpsAvg * .95 + .05 / Math.max(raw, 1e-3);
  if (camAnim) { camAnim.k = Math.min(1, camAnim.k + dt / 1.0); const e = camAnim.k < .5 ? 4 * camAnim.k ** 3 : 1 - (-2 * camAnim.k + 2) ** 3 / 2;
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.k >= 1) camAnim = null; }
  controls.update();
  if (busy) { const st = cur.stages[stage]; su = Math.min(1, su + dt * TS / st.dur); st.apply(su); if (su >= 1) { busy = false; renderUI(); } }
  cur.update(dt, t);
  if (cur.lblDay) cur.lblDay();
  updateLabels();
  renderer.render(scene, camera);
}
$('loading').style.display = 'none';
for (const k in EXPS) { EXPS[k].reset(); EXPS[k].G.visible = false; }
cur.G.visible = true; cur.stages[0].apply(1); stage = 0;
resize(); renderUI(); tick();
window.__sim = { ready: () => true, busy: () => busy, su: () => su, look: (x, y, z, r) => frame({ c: V(x, y, z), r }, true), state: () => Object.assign({ exp: cur.id, stage, phase, busy, curTask, solved: Object.assign({}, solved), stars: Object.assign({}, starsOf), fps: Math.round(fpsAvg) }, S.state()) };
