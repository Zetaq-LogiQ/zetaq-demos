/* Separation Lab (CB-C8-SCI-08-GAME-SEPARATIONLAB) - three.js scene, 3 stations, 6 tasks. Data goes ONLY through window.__S (ZQSim adapter).
   Facts as the book (CH/source/text.txt). Apparatus look from the delivered ch08 video (scenes/S18-S21 lab.js + d_parts.js) and the
   video kit sci.js glassware (glass base + additive rim shell + dark edge lines, liquids with a meniscus ring). Units: cm. Seeded random only. */
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
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), R = mulberry({ iron: 3, sulfur: 5, sand: 7, fes: 11, salt: 13, sugar: 19, char: 23, mixS: 29, mixA: 31 }[kind] || 1);
  const base = { iron: '#3B3F45', sulfur: '#F0CC32', sand: '#C9A56E', fes: '#2C2D30', salt: '#F2F4F5', sugar: '#F4F5F2', char: '#1F1E1D', mixS: '#E9C42E', mixA: '#2F3135' }[kind];
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  const dot = (col, n, r0, r1) => { g.fillStyle = col; for (let i = 0; i < n; i++) { const r = r0 + R() * (r1 - r0); g.beginPath(); g.ellipse(R() * 512, R() * 512, r, r * (.5 + R() * .5), R() * 3, 0, Math.PI * 2); g.fill(); } };
  if (kind === 'iron') { dot('#24272B', 2600, .8, 2.4); dot('#5A6068', 1500, .6, 1.8); dot('#9AA4AE', 500, .4, 1.1); }
  if (kind === 'sulfur' || kind === 'mixS') { dot('#D9AE1E', 1700, 1, 3.2); dot('#FFE36E', 1900, .8, 2.6); dot('#FFF1A8', 500, .6, 1.6); }
  if (kind === 'sand') { dot('#A9854F', 2400, .8, 2.6); dot('#E0C38E', 1800, .7, 2.2); dot('#8C6A3D', 600, .6, 1.6); dot('#F2E2BE', 400, .5, 1.2); }
  if (kind === 'mixA') { dot('#25282C', 1800, .8, 2.6); dot('#6A7078', 700, .5, 1.6); dot('#E9C22C', 1500, 1, 3.4); dot('#FFDF5E', 1100, .8, 2.4); }
  if (kind === 'fes') { dot('#232427', 3000, .6, 2.0); dot('#3A3C40', 2200, .6, 1.8); dot('#4A4C51', 600, .4, 1.1); }
  if (kind === 'salt') { dot('#FFFFFF', 2600, .8, 2.6); dot('#DCE3E8', 1400, .7, 2); }
  if (kind === 'sugar') { dot('#FFFFFF', 2200, 1, 3); dot('#D9DCD8', 1500, .8, 2.4); }
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

// ------------------------------------------------------------------ pouring beaker: tilts just enough for the liquid to reach the lip (horizontal surface, clipped)
// pivot = lip point; body = the beaker, bottom centre at (r, -h) from the lip. Axial liquid height L; tilt th = atan((h - L) / r) when pouring.
class Pourer {
  constructor(parent, o) {
    this.o = o; this.parent = parent; const r = this.r = o.r, h = this.h = o.h; this.L0 = this.L = o.fill * h;
    this.pivot = new THREE.Group(); parent.add(this.pivot); this.body = new THREE.Group(); this.body.position.set(r, -h, 0); this.pivot.add(this.body);
    this.glass = beaker(r, h, { opacity: .16 }); this.body.add(this.glass);
    this.plane = new THREE.Plane(V(0, -1, 0), 0);
    const ri = r - .16;
    if (o.color) { this.mat = new THREE.MeshPhysicalMaterial({ color: o.color, transparent: true, opacity: o.opacity ?? .72, roughness: .1, clearcoat: .5, clippingPlanes: [this.plane], side: THREE.DoubleSide, envMapIntensity: .45 });
      this.liq = new THREE.Mesh(new THREE.CylinderGeometry(ri, ri, h, 48, 1, true), this.mat); this.liq.position.y = h / 2 + .15; this.liq.renderOrder = 10; this.body.add(this.liq);
      const bot = new THREE.Mesh(new THREE.CircleGeometry(ri, 48), this.mat); bot.rotation.x = Math.PI / 2; bot.position.y = .17; bot.renderOrder = 10; this.body.add(bot); this.bot = bot;
      this.capMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(o.color).lerp(new THREE.Color('#fff'), .08), transparent: true, opacity: Math.min(1, (o.opacity ?? .72) + .08), roughness: .08, clearcoat: .6, envMapIntensity: .5 });
      this.cap = new THREE.Mesh(new THREE.CircleGeometry(ri, 48), this.capMat); this.cap.renderOrder = 11; parent.add(this.cap);
      this.capRing = new THREE.Mesh(new THREE.TorusGeometry(ri, .05, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(o.color).lerp(new THREE.Color('#fff'), .6), transparent: true, opacity: .8, depthWrite: false })); this.capRing.renderOrder = 12; parent.add(this.capRing); }
    if (o.sediment) { this.sed = new THREE.Mesh(new THREE.CylinderGeometry(ri - .02, ri - .02, 1, 48), new THREE.MeshStandardMaterial({ map: powderTex(o.sediment), roughness: .9, clippingPlanes: [this.plane] })); this.sed.renderOrder = 9; this.body.add(this.sed); }
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(.22, .14, 1, 12, 1, true), new THREE.MeshPhysicalMaterial({ color: o.streamColor ?? o.color ?? '#9FD8EC', transparent: true, opacity: .75, roughness: .1, side: THREE.DoubleSide })); this.stream.visible = false; this.stream.renderOrder = 12; parent.add(this.stream);
    this.engage = 0; this.th = 0; this.flowing = false;
    this.rest = o.rest.clone().add(V(-r, h, 0)); this.pour = o.pour.clone(); this.reset();
  }
  reset() { this.L = this.L0; this.engage = 0; this.th = 0; this.pivot.position.copy(this.rest); this.pivot.rotation.z = 0; this.flowing = false; this.stream.visible = false; this.sync(); }
  get frac() { return this.L / this.L0; }
  update(dt, want, rate, targetY, flowOK = true) {   // returns the fraction of the start volume poured in this step
    this.engage = clamp(this.engage + (want ? 1 : -1) * dt / .6);
    const thLip = Math.atan2(this.h - this.L, this.r) + (this.L < .15 * this.L0 ? (1 - this.L / (.15 * this.L0)) * .45 : 0);
    this.th = smooth(this.engage) * thLip;
    this.pivot.position.lerpVectors(this.rest, this.pour, smooth(Math.min(1, this.engage * 1.6)));
    this.pivot.rotation.z = this.th;
    let out = 0; this.flowing = want && flowOK && this.engage > .97 && this.L > .001;
    if (this.flowing) { const d = Math.min(this.L, rate * this.L0 * dt); this.L -= d; out = d / this.L0; }
    this.sync(targetY); return out;
  }
  sync(targetY) {
    this.pivot.updateMatrixWorld(true);
    const axisPt = this.body.localToWorld(V(0, this.L + .15, 0)); this.plane.constant = axisPt.y;
    const show = this.L > .02;
    if (this.liq) { this.liq.visible = this.bot.visible = show; const c = this.parent.worldToLocal(axisPt.clone());
      const capOK = show && Math.tan(this.th) * (this.r - .16) < this.L + .1;
      this.cap.visible = this.capRing.visible = capOK; this.cap.position.copy(c); this.capRing.position.copy(c); this.cap.rotation.set(-Math.PI / 2, 0, 0); this.capRing.rotation.set(Math.PI / 2, 0, 0);
      const sx = 1 / Math.max(.25, Math.cos(this.th)); this.cap.scale.set(sx, 1, 1); this.capRing.scale.set(sx, 1, 1); }
    if (this.sed) { const sh = this.o.sedH * this.frac; this.sed.visible = sh > .02; this.sed.scale.y = Math.max(.01, sh); this.sed.position.y = .17 + sh / 2; }
    if (this.flowing && targetY != null) { const lip = this.pivot.getWorldPosition(V()); const a = this.parent.worldToLocal(lip.clone()), len = Math.max(.1, a.y - targetY);
      this.stream.visible = true; this.stream.scale.y = len; this.stream.position.set(a.x - .15, a.y - len / 2, a.z); }
    else this.stream.visible = false;
  }
}

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
function toast(msg, kind = '', ms = 3000) { toastEl.textContent = msg; toastEl.className = 'show ' + kind; toastEl.style.top = ($('top').getBoundingClientRect().bottom + 8) + 'px'; clearTimeout(toastT); toastT = setTimeout(() => toastEl.className = '', ms); }
function act(a, t, v) { if (started && !ended) try { S.act(a, t, v); } catch (e) { console.warn(e); } }
function onBtn(id, fn) { $(id).addEventListener('click', e => { e.preventDefault(); fn(e); }); }
const HOLD = {};
function hold(id, fnDown, fnUp) { const el = $(id); HOLD[id] = false;
  const dn = e => { e.preventDefault(); if (HOLD[id]) return; HOLD[id] = true; el.classList.add('on'); fnDown && fnDown(); try { el.setPointerCapture(e.pointerId); } catch (_) { } };
  const up = () => { if (!HOLD[id]) return; HOLD[id] = false; el.classList.remove('on'); fnUp && fnUp(); };
  el.addEventListener('pointerdown', dn); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up); el.addEventListener('contextmenu', e => e.preventDefault()); }
const now = () => performance.now() / 1000;

// magnet that sweeps over a heap of grains. capture: grains near the magnet jump up and cling to its poles; release: back home (optional)
class MagnetSweep {
  constructor(parent, mag, grains, homes, o) { this.parent = parent; this.mag = mag; this.g = grains; this.homes = homes; this.o = o; this.n = homes.length;
    this.st = new Uint8Array(this.n); this.k = new Float32Array(this.n); this.stick = []; const R = mulberry(o.seed ?? 77), L = mag.userData.L;
    for (let i = 0; i < this.n; i++) { const side = R() < .5 ? -1 : 1; this.stick.push(V(side * (L / 2 - R() * 1.7), -mag.userData.h / 2 - .1 - R() * .45, (R() - .5) * (mag.userData.w + .3))); }
    this.phase = 0; this.sweepT = 0; this.mpos = o.park.clone(); this.rnd = mulberry((o.seed ?? 77) + 1); }
  reset() { this.st.fill(0); this.k.fill(0); this.sweepT = 0; this.mpos.copy(this.o.park); this.phase = 0; }
  get left() { let c = 0; for (let i = 0; i < this.n; i++) if (this.st[i] === 0 && this.homes[i].vis) c++; return c; }
  get total() { let c = 0; for (let i = 0; i < this.n; i++) if (this.homes[i].vis) c++; return c; }
  update(dt, holding, drive = true) {
    const o = this.o, pdt = dt * Math.min(TS, 3);
    if (holding) { this.phase += pdt * 2.2; this.sweepT += dt; }
    const ctr = o.center(), tgt = holding ? V(ctr.x + Math.sin(this.phase) * o.ax, ctr.y + o.lift, ctr.z + Math.sin(this.phase * .53 + .7) * o.az) : o.park;
    if (drive) { this.mpos.lerp(tgt, clamp(dt * (holding ? 7 : 4)));
      this.mag.position.copy(this.mpos); this.mag.rotation.set(0, holding ? .15 * Math.sin(this.phase * .7) : (o.parkRot ?? 0), 0); }
    this.mag.updateMatrixWorld(true);
    const near = holding && this.mpos.distanceTo(tgt) < 2.5;
    for (let i = 0; i < this.n; i++) {
      const H = this.homes[i]; if (!H.vis) { place(this.g, i, H.p, 0); continue; }
      let s = this.st[i];
      if (s === 0 && near && o.attract) { const dx = H.p.x - this.mpos.x, dz = H.p.z - this.mpos.z; if (Math.abs(dx) < this.mag.userData.L / 2 + .6 && Math.abs(dz) < 1.7 && this.rnd() < pdt * 5) { this.st[i] = s = 1; this.k[i] = 0; } }
      if (s === 3 && o.attract && holding && near) { this.st[i] = s = 1; }
      let p;
      if (s === 0) p = H.p;
      else { const sp = this.parent.worldToLocal(this.mag.localToWorld(this.stick[i].clone()));
        if (s === 1) { this.k[i] = Math.min(1, this.k[i] + pdt / .32); const e = this.k[i]; p = H.p.clone().lerp(sp, e * e); p.y += Math.sin(e * Math.PI) * .6; if (e >= 1) this.st[i] = 2; }
        else if (s === 2) { p = sp; if (!holding && o.returnHome) { this.st[i] = 3; this.k[i] = 1; } }
        else { this.k[i] = Math.max(0, this.k[i] - pdt / .45); p = H.p.clone().lerp(sp, this.k[i] * this.k[i]); if (this.k[i] <= 0) this.st[i] = 0; } }
      place(this.g, i, p, H.s, H.rot);
    }
    this.g.instanceMatrix.needsUpdate = true;
  }
}

// ================================================================== 1. SEPARATE (four mixtures, four kinds of apparatus)
const MIX = { iron: { name: 'iron filings + sand', app: 'magnet', key: 'mIron' }, grain: { name: 'chickpeas + green gram', app: 'sieve', key: 'mGrain' },
  sand: { name: 'sand + water', app: 'filter', key: 'mSand' }, salt: { name: 'salt water', app: 'dish', key: 'mSalt' } };
const APP = { magnet: { key: 'aMagnet', name: 'magnet', steps: 'stMagnet' }, sieve: { key: 'aSieve', name: 'sieve', steps: 'stSieve' }, filter: { key: 'aFilter', name: 'funnel + filter paper', steps: 'stFilter' }, dish: { key: 'aDish', name: 'china dish + burner', steps: 'stDish' } };
const WHY_NOT = {
  iron: { sieve: 'Iron filings and sand grains are both tiny: they would both fall through a sieve.', filter: 'Filtration separates a solid from a liquid. This mixture has no liquid.', dish: 'There is no water to evaporate. Heating does not separate iron filings from sand.' },
  grain: { magnet: 'Neither grain is attracted by a magnet.', filter: 'Filtration separates a solid from a liquid. These grains are dry.', dish: 'Heating does not separate grains. These grains are of different sizes.' },
  sand: { magnet: 'Sand and water are not attracted by a magnet.', sieve: 'Sand grains are tiny: water and sand would both run through the holes of a sieve.', dish: 'Evaporation would leave the sand, but the water would be lost as vapour. To get clear water, the sand must be held back.' },
  salt: { magnet: 'Salt and water are not attracted by a magnet.', sieve: 'The salt is dissolved in the water: it runs through the sieve with the water.', filter: 'The salt is dissolved in the water: it passes through the filter paper with the water.' } };
{
  const G = new THREE.Group(); G.position.set(0, 0, 0); scene.add(G);
  const st = ST.sep = { st: 'sep', G, dir: V(.12, .42, 1).normalize(), mix: 'iron', app: null };
  labSet(G, 90);
  const rigs = {}; for (const k in MIX) { rigs[k] = new THREE.Group(); G.add(rigs[k]); }
  const lbl = (html, anchor, show, cls) => { const L = label('sep', html, anchor, cls); L.show = show; return L; };

  // ---------- rig: iron filings + sand on a watch glass; bar magnet
  { const R = rigs.iron; const T = tile(15, 15); R.add(T); const wg = watchGlass(6); wg.position.y = TILE_TOP; R.add(wg);
    const fl = (x, z) => TILE_TOP + wg.userData.floor(x, z);
    const sand = heap('sand', fl, { seed: 4 }); R.add(sand); sand.userData.set(0, 0, 4.6, 1.5);
    const N = 340, geo = new THREE.IcosahedronGeometry(.17, 0); geo.scale(1.6, .55, .7);
    const gr = grainMesh(N, geo, ['#2E3238', '#3E444C', '#565D66', '#23262A'], { metal: .7, rough: .35, seed: 9 }); R.add(gr);
    const RR = mulberry(31), homes = []; for (let i = 0; i < N; i++) { const u = Math.sqrt(RR()) * .93, a = RR() * 6.283; homes.push({ p: sand.userData.surf(u, a, .04), s: .8 + RR() * .5, rot: RR() * 6, vis: true }); }
    const mag = barMagnet(8); R.add(mag);
    const sweep = new MagnetSweep(R, mag, gr, homes, { center: () => V(0, 0, 0), lift: 4.4, ax: 3.4, az: 3.3, park: V(10.5, .6, 4), parkRot: .5, attract: true, returnHome: false, seed: 5 });
    st.iron = { sweep, mag, showMag: false };
    lbl('<b>watch glass</b>', () => R.localToWorld(V(-6.4, 1.6, 0)), () => st.mix === 'iron');
    lbl('<b>iron filings</b> + <b>sand</b>', () => R.localToWorld(V(0, 3.4, 0)), () => st.mix === 'iron' && sweep.left > N * .5 && !HOLD.sMagnet);
    lbl('iron filings on the <b>magnet</b>', () => mag.localToWorld(V(0, 1.4, 0)), () => st.mix === 'iron' && st.app === 'magnet' && sweep.left < N * .9, 'c');
    lbl('only <b>sand</b> left', () => R.localToWorld(V(0, 3.0, 0)), () => st.mix === 'iron' && sweep.left === 0 && !HOLD.sMagnet, 'y');
  }
  // ---------- rig: chickpeas + green gram; sieve on a glass bowl
  { const R = rigs.grain;
    const bowlR = 6.4, bowlH = 4.6; const bowl = glassPiece(lathe([[0, .03], [bowlR * .55, .03], [bowlR * .8, .4], [bowlR * .97, 1.8], [bowlR, bowlH], [bowlR - .18, bowlH + .02], [bowlR * .97 - .18, 1.8], [bowlR * .8 - .15, .55], [bowlR * .55, .16], [0, .16]], 64), { opacity: .16 });
    R.add(bowl); const bring = new THREE.Mesh(new THREE.TorusGeometry(bowlR - .08, .07, 6, 64), new THREE.MeshBasicMaterial({ color: '#E2F3FF', transparent: true, opacity: .8, depthWrite: false })); bring.rotation.x = Math.PI / 2; bring.position.y = bowlH; bring.renderOrder = 23; R.add(bring);
    const sieve = new THREE.Group(); R.add(sieve); const SY = bowlH - 1.2, SR = 5.9;
    const rimG = new THREE.Mesh(new THREE.CylinderGeometry(SR, SR, 1.9, 64, 1, true), new THREE.MeshStandardMaterial({ color: '#B9C4CE', metalness: .9, roughness: .3, side: THREE.DoubleSide })); rimG.position.y = SY + .95; rimG.castShadow = true; sieve.add(rimG);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(SR + .45, .16, 8, 64), steelMat); lip.rotation.x = Math.PI / 2; lip.position.y = bowlH + .17; sieve.add(lip);
    const lip2 = new THREE.Mesh(new THREE.TorusGeometry(SR, .1, 8, 64), steelMat); lip2.rotation.x = Math.PI / 2; lip2.position.y = SY + 1.9; sieve.add(lip2);
    { const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); x.strokeStyle = '#C3CCD4'; x.lineWidth = 3; for (let i = 0; i <= 512; i += 11) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8;
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(SR, 64), new THREE.MeshStandardMaterial({ map: tx, transparent: true, alphaTest: .4, side: THREE.DoubleSide, metalness: .7, roughness: .35 })); mesh.rotation.x = -Math.PI / 2; mesh.position.y = SY; mesh.castShadow = true; sieve.add(mesh); }
    const NC = 46, NG = 170, geoC = new THREE.SphereGeometry(.55, 14, 10), geoG = new THREE.SphereGeometry(.22, 10, 8); geoC.scale(1, .92, .95); geoG.scale(1.25, .85, .85);
    const chick = grainMesh(NC, geoC, ['#D9B46A', '#CFA65C', '#E2C07C'], { rough: .6, seed: 3, shadow: true }), gram = grainMesh(NG, geoG, ['#5E9B3A', '#4F8A2E', '#6FA845', '#3F7A26'], { rough: .5, seed: 4 });
    R.add(chick, gram);
    const src = new Pourer(R, { r: 3, h: 6.2, fill: .001, rest: V(12, 0, 3), pour: V(4.6, 13.5, 0) });
    const RR = mulberry(51), mk = (n, rad) => Array.from({ length: n }, (_, i) => { const a = RR() * 6.283, u = Math.sqrt(RR());
      return { src: V(Math.cos(a) * u * 2.4, .45 + RR() * 3.2, Math.sin(a) * u * 2.4), sieve: V(Math.cos(a) * u * (SR - 1), SY + rad + RR() * rad * 1.6, Math.sin(a) * u * (SR - 1)),
        bowl: V(Math.cos(a) * Math.sqrt(RR()) * 4.4, .3 + rad + RR() * .9, Math.sin(a) * Math.sqrt(RR()) * 4.4), t0: RR(), st: 0, k: 0, rot: RR() * 6 }; });
    const C = mk(NC, .5), Gm = mk(NG, .2), rndS = mulberry(57);
    st.grain = { sieve, src, C, Gm, poured: false, pourT: -1, shake: 0,
      reset() { this.poured = false; this.pourT = -1; this.src.reset(); for (const g of [...C, ...Gm]) { g.st = 0; g.k = 0; } },
      get through() { return Gm.filter(g => g.st >= 3).length; } };
    st.grain.update = (dt, t) => {
      const sg = st.grain, pdt = dt * TS, sh = HOLD.sShake && sg.poured && st.app === 'sieve';
      sieve.position.x = sh ? .35 * Math.sin(t * 26) : sieve.position.x * .8; sieve.position.z = sh ? .2 * Math.sin(t * 19 + 1) : sieve.position.z * .8;
      if (sg.pourT >= 0) sg.pourT += dt;
      const want = sg.pourT >= 0 && sg.pourT < 2.2; src.engage = clamp(src.engage + (want ? 1 : -1) * dt / .6); src.pivot.position.lerpVectors(src.rest, src.pour, smooth(Math.min(1, src.engage * 1.6))); src.pivot.rotation.z = smooth(src.engage) * 2.0; src.sync();
      src.pivot.updateMatrixWorld(true); const lip = R.worldToLocal(src.pivot.getWorldPosition(V()));
      const upd = (arr, mesh, rad) => arr.forEach((g, i) => { let p;
        if (g.st === 0) { p = R.worldToLocal(src.body.localToWorld(g.src.clone())); if (sg.pourT > .55 + g.t0 * 1.2 && src.engage > .9) { g.st = 1; g.k = 0; g.from = p.clone(); } }
        if (g.st === 1) { g.k = Math.min(1, g.k + dt / .45); const e = g.k; p = g.from.clone().lerp(lip, Math.min(1, e * 3)); if (e > .33) { const f = (e - .33) / .67; p = lip.clone().lerp(g.sieve, f); p.y += Math.sin(f * Math.PI) * 1.2 - f * f * .4; } if (g.k >= 1) g.st = 2; }
        if (g.st === 2) { p = g.sieve.clone().add(sieve.position); if (sh && rad < .3 && rndS() < pdt * .9) { g.st = 3; g.k = 0; } }
        if (g.st === 3) { g.k = Math.min(1, g.k + pdt / .4); p = g.sieve.clone().add(sieve.position).lerp(g.bowl, g.k * g.k); if (g.k >= 1) g.st = 4; }
        if (g.st === 4) p = g.bowl;
        place(mesh, i, p, 1, g.rot); });
      upd(C, chick, .5); upd(Gm, gram, .2); chick.instanceMatrix.needsUpdate = gram.instanceMatrix.needsUpdate = true;
      if (!sg.poured && sg.pourT > 1 && C.every(g => g.st >= 2) && Gm.every(g => g.st >= 2)) sg.poured = true;
    };
    lbl('<b>chickpeas</b> + <b>green gram</b>', () => st.grain.src.body.localToWorld(V(0, 7.6, 0)), () => st.mix === 'grain' && st.grain.pourT < 0, 'y');
    lbl('<b>sieve</b>', () => R.localToWorld(V(-6.6, bowlH + 2.2, 0)), () => st.mix === 'grain' && st.app === 'sieve');
    lbl('<b>chickpeas</b> stay on top', () => R.localToWorld(V(0, bowlH + 3.6, 0)), () => st.mix === 'grain' && st.grain.through > NG * .5, 'y');
    lbl('<b>green gram</b> falls through', () => R.localToWorld(V(5.4, 1.2, 5)), () => st.mix === 'grain' && st.grain.through > NG * .3, 'g');
  }
  // ---------- rig: sand + water; funnel, filter paper, stand, beaker
  { const R = rigs.sand;
    const stand = retortStand(24); stand.position.set(-1, 0, -1.4); R.add(stand);
    const FY = 7.6, CA = 5, CT = 9.4, FR = 4.4;   // funnel: stem 0..CA, cone CA..CT (local), placed at y = FY
    const funnel = new THREE.Group(); funnel.position.set(0, FY, 0); R.add(funnel);
    funnel.add(glassPiece(lathe([[.32, 0], [.32, CA], [FR, CT], [FR + .1, CT + .08], [FR - .14, CT + .06], [.18, CA + .1], [.18, 0]], 48), { opacity: .2 }));
    { const ring = new THREE.Mesh(new THREE.TorusGeometry(FR + .06, .06, 6, 48), new THREE.MeshBasicMaterial({ color: '#E2F3FF', transparent: true, opacity: .85, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.position.y = CT + .06; ring.renderOrder = 23; funnel.add(ring); }
    const clampY = CA + (CT - CA) * .55, clampR = .32 + (FR - .32) * .55 + .18;
    const cring = new THREE.Mesh(new THREE.TorusGeometry(clampR, .2, 8, 40), ironMat); cring.rotation.x = Math.PI / 2; cring.position.set(0, FY + clampY, 0); R.add(cring);
    const bossP = V(-4, FY + clampY, -3), dirA = bossP.clone().setY(0).normalize(), ringP = V(dirA.x * (clampR + .1), FY + clampY, dirA.z * (clampR + .1));
    const arm = cyl(.18, .18, 1, ironMat, 0, 0, 0, R, 10); arm.scale.y = bossP.distanceTo(ringP); arm.position.copy(bossP).add(ringP).multiplyScalar(.5); arm.quaternion.setFromUnitVectors(V(0, 1, 0), bossP.clone().sub(ringP).normalize());
    const boss = box(1, 1, 1, ironMat, bossP.x, bossP.y, bossP.z, R);
    const coll = beaker(3.3, 7.8); R.add(coll); const collLiq = liquidCyl(3.3 - .16, '#9FD8EC', .5); R.add(collLiq);
    const collSed = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 1, 48), new THREE.MeshStandardMaterial({ map: powderTex('sand'), roughness: .9 })); R.add(collSed); collSed.visible = false;
    const pf = (y, inset = 0) => .32 + (y - CA) / (CT - CA) * (FR - .32) - inset;     // inner cone radius at local y
    const paperMat = new THREE.MeshStandardMaterial({ color: '#F4F6F2', roughness: .85, side: THREE.DoubleSide });
    const paperCone = new THREE.Mesh(lathe([[.2, CA + .55], [pf(CT - .35, .2), CT - .35]], 48), paperMat); paperCone.castShadow = true; funnel.add(paperCone); paperCone.visible = false;
    const flat = new THREE.Group(); R.add(flat); flat.position.set(-9.5, .05, 6);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, .04, 48), paperMat); disc.position.y = .03; disc.castShadow = true; flat.add(disc);
    const fold = new THREE.Mesh(lathe([[.05, 0], [2.6, 3.2]], 48), paperMat); fold.visible = false; flat.add(fold);
    const funLiq = new THREE.Mesh(lathe([[0, CA + .5], [1, CA + 1.5]], 32), new THREE.MeshPhysicalMaterial({ color: '#A07A4A', transparent: true, opacity: .78, roughness: .1, clearcoat: .4 })); funLiq.renderOrder = 10; funnel.add(funLiq); funLiq.visible = false;
    const resid = new THREE.Mesh(lathe([[0, CA + .5], [1, CA + 1.5]], 32), new THREE.MeshStandardMaterial({ map: powderTex('sand'), roughness: .9, side: THREE.DoubleSide })); resid.renderOrder = 9; funnel.add(resid); resid.visible = false;
    const coneLathe = (m, y1, inset) => { m.geometry.dispose(); m.geometry = lathe([[0, CA + .55], [pf(CA + .55, inset), CA + .55], [pf(y1, inset), y1], [0, y1]], 40); };
    const src = new Pourer(R, { r: 2.9, h: 6.8, fill: .62, color: '#A9824F', opacity: .82, streamColor: '#A9824F', sediment: 'sand', sedH: 1.1, rest: V(10.5, 0, 3.5), pour: V(1.2, FY + CT + 4.2, 0) });
    const rod = glassRod(12); R.add(rod); rod.visible = false;   // pour along the glass rod: the liquid runs down the rod into the paper cone
    const rodStream = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, 1, 10, 1, true), new THREE.MeshPhysicalMaterial({ color: '#A9824F', transparent: true, opacity: .8, roughness: .1, side: THREE.DoubleSide })); rodStream.renderOrder = 12; rodStream.visible = false; R.add(rodStream);
    const drips = []; for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshPhysicalMaterial({ color: '#BFE6F5', transparent: true, opacity: .8, roughness: .05 })); d.visible = false; R.add(d); drips.push(d); }
    const sf = st.filter = { src, folded: false, fitted: false, foldK: 0, fitK: 0, Vf: 0, drained: 0, sandOnPaper: 0, sandThrough: 0, poured: 0, muddy: false,
      reset() { this.folded = this.fitted = false; this.foldK = this.fitK = 0; this.Vf = this.drained = this.sandOnPaper = this.sandThrough = this.poured = 0; this.muddy = false; this.src.reset(); paperCone.visible = false; flat.visible = true; flat.position.set(-9.5, .05, 6); flat.rotation.set(0, 0, 0); disc.visible = true; fold.visible = false; } };
    sf.update = (dt, t) => {
      const pdt = dt * TS;
      if (sf.folded && sf.foldK < 1) { sf.foldK = Math.min(1, sf.foldK + dt / .8); disc.scale.set(1 - sf.foldK * .5, 1, 1 - sf.foldK * .75); if (sf.foldK >= 1) { disc.visible = false; fold.visible = true; } }
      if (sf.fitted && sf.fitK < 1) { sf.fitK = Math.min(1, sf.fitK + dt / .9); const e = smooth(sf.fitK); flat.position.lerpVectors(V(-9.5, .05, 6), V(0, FY + CA + 2.2, 0), e); flat.position.y += Math.sin(e * Math.PI) * 6; flat.rotation.x = e * Math.PI; if (sf.fitK >= 1) { flat.visible = false; paperCone.visible = true; } }
      if (sf.Vf > .8) sf.wait = true; else if (sf.Vf < .45) sf.wait = false;
      const want = HOLD.sPourF && st.app === 'filter', inflow = src.update(dt, want, .2 * TS, null, !sf.wait);
      if (inflow > 0) { sf.poured += inflow; sf.Vf += inflow * 2.2; if (sf.fitted && sf.fitK >= 1) sf.sandOnPaper += inflow; else { sf.sandThrough += inflow; sf.muddy = true; } }
      rod.visible = src.engage > .5; rodStream.visible = false; if (rod.visible) { const lip = R.worldToLocal(src.pivot.getWorldPosition(V())), B = V(.6, FY + CA + 1.0, .3), T = lip.clone().add(V(-.05, -.1, .3)), d = T.clone().sub(B);
        rod.position.copy(B); rod.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
        if (src.flowing) { rodStream.visible = true; rodStream.scale.set(1, d.length(), 1); rodStream.position.copy(B).addScaledVector(d, .5).add(V(0, .18, 0)); rodStream.quaternion.copy(rod.quaternion); } }
      const paper = sf.fitted && sf.fitK >= 1, drain = Math.min(sf.Vf, (paper ? .42 : 1.6) * pdt * .5); sf.Vf -= drain; sf.drained += drain / 2.2;
      // funnel content: residue cone + liquid cone (local heights)
      const hRes = CA + .6 + Math.sqrt(sf.sandOnPaper) * 1.4; resid.visible = paper && sf.sandOnPaper > .01; if (resid.visible) coneLathe(resid, hRes, .26);
      const hLiq = (paper ? hRes : CA + .5) + Math.sqrt(sf.Vf) * 2.6; funLiq.visible = sf.Vf > .02; if (funLiq.visible) { coneLathe(funLiq, Math.min(CT - 1.3, hLiq), paper ? .24 : .2); funLiq.material.color.set(paper ? '#A88E66' : '#A07A4A'); }
      // collected filtrate
      const lv = .17 + Math.min(5.6, sf.drained * 5.2); collLiq.userData.setLevel(.17, lv); collLiq.userData.setColor(sf.muddy ? '#A9824F' : '#8CC8E6', sf.muddy ? .8 : .55);
      collSed.visible = sf.sandThrough > .02; if (collSed.visible) { const h = sf.sandThrough * 1.1; collSed.scale.y = h; collSed.position.y = .18 + h / 2; }
      drips.forEach((d, i) => { const on = sf.Vf > .02 || drain > 1e-4; d.visible = on; if (!on) return; const u = (t * 1.6 + i / drips.length) % 1; d.position.set(.0, FY - .2 - u * (FY - .2 - lv), 0); d.material.color.set(sf.muddy ? '#A9824F' : '#BFE6F5'); });
    };
    sf.done = () => sf.fitted && !sf.muddy && src.L <= .02 && sf.Vf < .02;
    lbl('<b>sand</b> + <b>water</b>', () => src.body.localToWorld(V(0, 8.0, 0)), () => st.mix === 'sand' && src.engage < .1 && sf.poured < .05, 'y');
    lbl('<b>filter paper</b>', () => flat.localToWorld(V(0, 1.4, 0)), () => st.mix === 'sand' && st.app === 'filter' && flat.visible);
    lbl('<b>funnel</b>', () => R.localToWorld(V(-FR - .9, FY + CT, 0)), () => st.mix === 'sand' && st.app === 'filter');
    lbl('<b>sand</b> stays on the paper (residue)', () => R.localToWorld(V(0, FY + CT + 1.4, 0)), () => st.mix === 'sand' && sf.sandOnPaper > .3 && src.engage < .5, 'y');
    lbl('clear <b>water</b> (filtrate)', () => R.localToWorld(V(3.6, 3.2, 3)), () => st.mix === 'sand' && sf.drained > .25 && !sf.muddy);
    lbl('muddy: no filter paper', () => R.localToWorld(V(3.6, 3.2, 3)), () => st.mix === 'sand' && sf.muddy, 'c');
    st.filterParts = [stand, funnel, cring, arm, boss, coll, collLiq];
  }
  // ---------- rig: salt water; china dish on tripod + gauze over a burner
  { const R = rigs.salt;
    const tri = tripodGauze(12, 4.6); R.add(tri); const bun = bunsen(7); R.add(bun);
    const dish = chinaDish(4.6); dish.position.y = tri.userData.topY; R.add(dish);
    const dY = tri.userData.topY, dfl = dish.userData.floor, rAt = dish.userData.rAt, th = dish.userData.th, H = dish.userData.H;
    const liqMat = new THREE.MeshPhysicalMaterial({ color: '#7FC0E2', transparent: true, opacity: .72, roughness: .08, clearcoat: .6, side: THREE.DoubleSide, envMapIntensity: .5 });
    const liq = new THREE.Mesh(new THREE.BufferGeometry(), liqMat); liq.renderOrder = 10; liq.position.y = dY; R.add(liq);
    const lring = new THREE.Mesh(new THREE.TorusGeometry(1, .05, 6, 56), new THREE.MeshBasicMaterial({ color: '#E2F5FF', transparent: true, opacity: .8, depthWrite: false })); lring.rotation.x = Math.PI / 2; lring.renderOrder = 12; R.add(lring);
    let lastY = -1; const setDishLevel = y => { if (Math.abs(y - lastY) < .01) return; lastY = y; const pts = [[0, th + .03]]; for (let i = 0; i <= 12; i++) { const yy = th + .03 + (y - th - .03) * i / 12; pts.push([rAt(yy) - .02, yy]); } pts.push([0, y]);
      liq.geometry.dispose(); liq.geometry = lathe(pts, 56); const r = rAt(y) - .02; lring.scale.set(r, r, 1); lring.position.y = dY + y; };
    const NS = 320, crys = grainMesh(NS, new THREE.BoxGeometry(.2, .14, .2), ['#FFFFFF', '#EEF3F6', '#E2EAEF'], { rough: .3, seed: 13 }); R.add(crys);
    const RR = mulberry(71), cr = Array.from({ length: NS }, (_, i) => { const ring = i % 3 === 0, a = RR() * 6.283; let x, z, y;
      if (ring) { const yy = th + .35 + RR() * .9, r = rAt(yy) - .1; x = Math.cos(a) * r; z = Math.sin(a) * r; y = yy; } else { const r = Math.sqrt(RR()) * 2.9; x = Math.cos(a) * r; z = Math.sin(a) * r; y = dfl(x, z) + .06; }
      return { p: V(x, dY + y, z), t: RR(), rot: RR() * 6, s: .7 + RR() * .8 }; });
    const src = new Pourer(R, { r: 2.8, h: 6.4, fill: .6, color: '#8CC8E6', opacity: .6, rest: V(11, 0, 3), pour: V(3.6, dY + H + 5.2, 0) });
    const steam = wisps(R, 46, '#EAF2F7', 2.2), bubbles = grainMesh(18, new THREE.SphereGeometry(.12, 8, 6), ['#FFFFFF'], {}); bubbles.material.transparent = true; bubbles.material.opacity = .6; R.add(bubbles);
    const sd = st.dish = { src, W: 0, poured: false, pourT: -1, burner: false, dryT: 0,
      reset() { this.W = 0; this.poured = false; this.pourT = -1; this.burner = false; this.dryT = 0; this.src.reset(); setBurnerBtn(); } };
    sd.update = (dt, t) => {
      const pdt = dt * TS;
      if (sd.pourT >= 0 && !sd.poured) { sd.pourT += dt; const inflow = src.update(dt, true, .35 * Math.min(TS, 3), dY + H * .4); sd.W += inflow; if (src.L <= .002) { sd.poured = true; } }
      else src.update(dt, false, 0);
      if (sd.burner && sd.W > 0) { sd.W = Math.max(0, sd.W - pdt / 14); if (sd.W === 0) sd.dryT = t; }
      bun.userData.flame.userData.set(t, sd.burner ? 1 : 0);
      const y = th + .03 + Math.pow(sd.W, .55) * (H * .62); liq.visible = lring.visible = sd.W > .004; if (liq.visible) setDishLevel(y);
      const salt = sd.poured || sd.W > 0 ? 1 - sd.W : 0, vis = sd.poured ? clamp((salt - .45) / .5) : 0;
      cr.forEach((c, i) => place(crys, i, c.p, c.t < vis ? c.s : 0, c.rot)); crys.instanceMatrix.needsUpdate = true;
      steam.userData.update(t, V(0, dY + y + .3, 0), sd.burner && sd.W > 0 ? .9 : 0, 7, 3);
      const boil = sd.burner && sd.W > 0; for (let i = 0; i < 18; i++) { const u = (t * 1.3 + i * .37) % 1, a = i * 2.4, r = (i % 5) / 5 * 2.6; place(bubbles, i, V(Math.cos(a) * r, dY + th + .1 + u * (y - th), Math.sin(a) * r), boil && u < .95 ? 1 : 0); } bubbles.instanceMatrix.needsUpdate = true;
    };
    sd.done = () => sd.poured && sd.W <= 0 && !sd.burner;
    lbl('<b>salt water</b>', () => src.body.localToWorld(V(0, 7.6, 0)), () => st.mix === 'salt' && !st.dish.poured && st.dish.pourT < 0);
    lbl('<b>china dish</b>', () => R.localToWorld(V(-5.6, dY + 1.6, 0)), () => st.mix === 'salt' && st.app === 'dish');
    lbl('<b>burner</b>', () => R.localToWorld(V(-2.6, 3.4, 2)), () => st.mix === 'salt' && st.app === 'dish');
    lbl('water <b>evaporates</b>', () => R.localToWorld(V(0, dY + 8.5, 0)), () => st.mix === 'salt' && st.dish.burner && st.dish.W > 0);
    lbl('<b>salt</b> is left behind', () => R.localToWorld(V(0, dY + 4.2, 0)), () => st.mix === 'salt' && st.dish.poured && st.dish.W <= 0, 'y');
    st.dishParts = [tri, bun, dish];
  }
  function showApp() {
    const a = st.app, m = st.mix;
    st.iron.mag.visible = m === 'iron' && a === 'magnet';
    rigs.grain.children.forEach(c => { if (c.isInstancedMesh || c === st.grain.src.pivot || c === st.grain.src.cap || c === st.grain.src.capRing || c === st.grain.src.stream) return; c.visible = a === 'sieve'; });
    st.filterParts.forEach(p => p.visible = a === 'filter');
    st.dishParts.forEach(p => p.visible = a === 'dish');
    for (const k in APP) $(APP[k].key).classList.toggle('on', a === k);
    for (const k in MIX) $(MIX[k].key).classList.toggle('on', m === k);
    for (const k of ['stNone', 'stMagnet', 'stSieve', 'stFilter', 'stDish']) $(k).classList.toggle('on', k === (a ? APP[a].steps : 'stNone'));
  }
  st.setMix = (m, quiet) => { st.mix = m; st.app = null; for (const k in rigs) rigs[k].visible = k === m; resetMix(m); showApp(); if (!quiet) act('choose_mixture', m, 1); frame(st, false); };
  function resetMix(m) { if (m === 'iron') st.iron.sweep.reset(); if (m === 'grain') st.grain.reset(); if (m === 'sand') st.filter.reset(); if (m === 'salt') st.dish.reset(); }
  st.resetMix = () => { resetMix(st.mix); act('reset', st.mix, 1); };
  st.pickApp = a => {
    const m = st.mix; act('pick_apparatus', a, MIX[m].app === a);
    if (MIX[m].app !== a) { const T = curTask && taskById(curTask); if (T && T.mix === m) wrongTry(curTask, WHY_NOT[m][a]); else toast(WHY_NOT[m][a], 'bad', 3800); return; }
    st.app = a; showApp(); frame(st, false);
  };
  st.layout = portrait => { const m = st.mix;
    const C = { iron: [V(1, 2.5, 1), 11.5], grain: [V(3.5, 5.5, 1), 13], sand: [V(1.5, 10, 1), 15], salt: [V(2.5, 9, 1), 14] }[m];
    st.center = C[0]; st.radius = C[1] * (portrait ? .92 : 1); };
  st.update = (dt) => { const t = now();
    if (st.mix === 'iron') st.iron.sweep.update(dt, HOLD.sMagnet && st.app === 'magnet');
    if (st.mix === 'grain') st.grain.update(dt, t);
    if (st.mix === 'sand') st.filter.update(dt, t);
    if (st.mix === 'salt') st.dish.update(dt, t); };
  st.hud = () => { const m = st.mix, a = st.app; let row = '';
    if (m === 'iron') { const L = st.iron.sweep.left, N = st.iron.sweep.total; row = `Iron filings left in the sand: <b>${Math.round(L / N * 100)}%</b><div class="bar"><i style="width:${(1 - L / N) * 100}%"></i></div>`; }
    if (m === 'grain') { const g = st.grain, n = g.Gm.length; row = !g.poured ? 'Grains of two different sizes.' : `Green gram through the sieve: <b>${Math.round(g.through / n * 100)}%</b><div class="bar"><i style="width:${g.through / n * 100}%"></i></div>`; }
    if (m === 'sand') { const f = st.filter; row = `Filter paper: <b>${f.fitted ? 'in the funnel' : f.folded ? 'folded' : 'flat'}</b> · beaker poured: <b>${Math.round(f.poured / .999 * 100)}%</b><br>Filtrate: <b>${f.drained < .02 ? 'none yet' : f.muddy ? 'muddy' : 'clear'}</b>`; }
    if (m === 'salt') { const d = st.dish; row = `Burner: <b>${d.burner ? 'on' : 'off'}</b> · water in the dish: <b>${d.poured || d.W > 0 ? Math.round(d.W * 100) + '%' : 'none'}</b>${d.poured && d.W <= 0 ? '<br>Only salt is left.' : ''}`; }
    return `<div class="big">${MIX[m].name[0].toUpperCase() + MIX[m].name.slice(1)}</div><div class="row">Apparatus: <b>${a ? APP[a].name : 'not chosen'}</b></div><div class="row">${row}</div>`; };
}

// ================================================================== 2. IRON + SULFUR (Activity 8.5, demonstration)
{
  const G = new THREE.Group(); G.position.set(400, 0, 0); scene.add(G);
  const st = ST.fes = { st: 'fes', G, dir: V(.05, .5, 1).normalize() };
  labSet(G, 84);
  // fume hood frame (well-ventilated set-up, as the book's safety note)
  { const hm = new THREE.MeshStandardMaterial({ color: '#33495A', roughness: .55, metalness: .1 }), trim = new THREE.MeshStandardMaterial({ color: '#B9C6D1', roughness: .3, metalness: .6 });
    for (const s of [-1, 1]) { box(2.4, 40, 44, hm, s * 43, 18, -1, G); box(2.8, 40, .8, trim, s * 43, 18, 21.4, G); }
    box(89, 5, 44, hm, 0, 40, -1, G); const led = new THREE.Mesh(new THREE.BoxGeometry(56, .5, 2), new THREE.MeshStandardMaterial({ color: '#E8F4FF', emissive: '#CFE6FF', emissiveIntensity: 1.3 })); led.position.set(0, 37.3, 14); G.add(led); }
  const tA = tile(13, 13); tA.position.set(-8, 0, 6); G.add(tA); const wA = watchGlass(5.2); wA.position.set(-8, TILE_TOP, 6); G.add(wA);
  const tB = tile(13, 13); tB.position.set(8, 0, 6); G.add(tB); const wB = watchGlass(5.2); wB.position.set(8, TILE_TOP, 6); G.add(wB);
  const flA = (x, z) => TILE_TOP + wA.userData.floor(x, z), flB = (x, z) => TILE_TOP + wB.userData.floor(x, z);
  const ironH = heap('iron', flA, { seed: 6 }), sulH = heap('sulfur', flA, { seed: 7 }), mixH = heap('mixS', flA, { seed: 8 }), bH = heap('fes', flB, { seed: 9, lumps: .1 });
  [ironH, sulH, mixH].forEach(h => { h.position.set(-8, 0, 6); G.add(h); }); bH.position.set(8, 0, 6); G.add(bH);
  const tri = tripodGauze(12, 4.6); tri.position.set(-10, 0, -8); G.add(tri); const bun = bunsen(7); bun.position.set(-10, 0, -8); G.add(bun);
  const dish = chinaDish(4.6); dish.position.set(-10, tri.userData.topY, -9); G.add(dish);
  const dfl = (x, z) => dish.userData.floor(x, z);
  const dishMat = powderMat('mixA'); dishMat.emissive = new THREE.Color('#000');
  const dH = heap('mixS', dfl, { seed: 10, mat: dishMat, lumps: .15 }); dH.position.copy(dish.position); G.add(dH);
  const mor = mortar(4.4); mor.position.set(6, 0, -9); G.add(mor); const pes = pestle(7.5); G.add(pes);
  const mH = heap('fes', (x, z) => mor.userData.floor(x, z), { seed: 12, lumps: .3 }); mH.position.copy(mor.position); G.add(mH);
  const spat = spatula(11); G.add(spat); const rod = glassRod(13); G.add(rod);
  const mag = barMagnet(8); G.add(mag);
  const fumes = wisps(G, 40, '#C9CFC4', 2.4);
  // iron grains for Sample A (dark specks on the yellow mixture), on watch glass A; some go into the china dish
  const NI = 420, geo = new THREE.IcosahedronGeometry(.16, 0); geo.scale(1.6, .55, .7);
  const gA = grainMesh(NI, geo, ['#2E3238', '#3E444C', '#565D66', '#23262A'], { metal: .7, rough: .35, seed: 19 }); G.add(gA);
  const RR = mulberry(91), homes = []; for (let i = 0; i < NI; i++) homes.push({ u: Math.sqrt(RR()) * .93, a: RR() * 6.283, p: V(), s: .8 + RR() * .5, rot: RR() * 6, vis: false, half: i % 2 === 1 });
  const sweepA = new MagnetSweep(G, mag, gA, homes, { center: () => V(-8, 0, 6), lift: 4.2, ax: 3, az: 2, park: V(0, .6, 14), parkRot: 0, attract: true, returnHome: true, seed: 8 });
  const sweepB = new MagnetSweep(G, mag, new THREE.InstancedMesh(geo, gA.material, 1), [{ p: V(), s: 0, rot: 0, vis: false }], { center: () => V(8, 0, 6), lift: 4.2, ax: 3, az: 2, park: V(0, .6, 14), attract: false });
  const s = st.s = { taken: false, mixed: false, mixK: 0, half: false, p: 0, burner: false, grindK: -1, B: false, magA: 0, magB: 0, magAok: false, magBok: false, warned: 0 };
  st.reset = () => { Object.assign(s, { taken: false, mixed: false, mixK: 0, half: false, p: 0, burner: false, grindK: -1, B: false, magA: 0, magB: 0, magAok: false, magBok: false, warned: 0 }); sweepA.reset(); sweepB.reset(); setFBurner(); };
  function placeHomes() { const k = s.half ? .82 : 1; mixH.userData.set(0, 0, 3.9 * k, 1.35 * k); homes.forEach(h => { h.vis = s.mixed && s.mixK >= 1 && !(s.half && h.half); if (h.vis) { const q = mixH.userData.surf(h.u, h.a, .05); h.p.set(q.x - 8, q.y, q.z + 6); } }); }
  st.layout = portrait => { st.center = V(0, 5, -1); st.radius = portrait ? 19 : 18.5; };
  st.update = dt => {
    const t = now(), pdt = dt * TS;
    // heaps on watch glass A
    if (s.taken && !s.mixed) { ironH.userData.set(-1.9, 0, 2.2, 1.1); sulH.userData.set(1.9, 0, 2.4, 1.25); }
    ironH.visible = s.taken && (!s.mixed || s.mixK < .5); sulH.visible = ironH.visible;
    if (s.mixed && s.mixK < 1) { s.mixK = Math.min(1, s.mixK + dt / 1.2); spat.visible = true; const a = t * 9; spat.position.set(-8 + Math.cos(a) * 1.6, 2.4, 6 + Math.sin(a) * 1.4); spat.rotation.set(0, -a, -.5); if (s.mixK >= 1) placeHomes(); }
    else { spat.visible = true; spat.position.set(-1.5, .5, 13.5); spat.rotation.set(0, .3, 0); }
    mixH.visible = s.mixed && s.mixK >= .5; if (mixH.visible && s.mixK < 1) mixH.userData.set(0, 0, 3.9, 1.35);
    // heating half of Sample A in the china dish, with continuous stirring
    const stirring = HOLD.fStir, heating = s.burner && s.half && s.p < 1;
    if (s.half && s.burner && stirring && s.p < 1) s.p = Math.min(1, s.p + pdt / 14);
    const glow = s.burner ? smooth((s.p - .25) / .25) * (1 - smooth((s.p - .85) / .15)) : 0;
    dH.visible = s.half && s.grindK < .35; if (dH.visible) { dH.userData.set(0, 0, 3.0, 1.0 + (s.p > .6 ? .15 : 0)); const c = new THREE.Color('#FFFFFF').lerp(new THREE.Color('#55565A'), smooth((s.p - .15) / .6)); dishMat.color.copy(c); dishMat.emissive.set('#FF4A10').multiplyScalar(1.6 * glow * (.75 + .25 * Math.sin(t * 6))); dishMat.map = s.p > .8 ? powderTex('fes') : powderTex('mixA'); }
    bun.userData.flame.userData.set(t, s.burner ? 1 : 0);
    rod.visible = stirring && s.half && s.grindK < 0; if (rod.visible) { const a = t * 6; rod.position.set(-10 + Math.cos(a) * 1.4, tri.userData.topY + .6, -8 + Math.sin(a) * 1.2); rod.rotation.set(.25 * Math.sin(a), 0, -.3 * Math.cos(a)); }
    fumes.userData.update(t, V(-10, tri.userData.topY + 2.4, -8), s.burner && s.half && s.p > .2 ? .8 : 0, 9, 2.2);
    // cool + grind -> Sample B
    if (s.grindK >= 0 && s.grindK < 1) { s.grindK = Math.min(1, s.grindK + dt / 2.6); if (s.grindK >= 1) { s.B = true; } }
    mH.visible = s.grindK >= .35 && s.grindK < .85; if (mH.visible) mH.userData.set(0, 0, 2.6, .9 - (s.grindK - .35) * .6);
    { const g = s.grindK > .35 && s.grindK < .85, a = t * 7; pes.position.set(6 + (g ? Math.cos(a) * .9 : -1.2), 1.4 + (g ? .2 : 0), -9 + (g ? Math.sin(a) * .9 : 0)); pes.rotation.set(g ? .25 * Math.sin(a) : 0, 0, g ? -.25 * Math.cos(a) : .5); }
    bH.visible = s.B || s.grindK >= .85; if (bH.visible) bH.userData.set(0, 0, 3.5, 1.15 * (s.B ? 1 : (s.grindK - .85) / .15));
    // magnet tests (one magnet; whichever button is held)
    const hA = HOLD.fMagA && s.mixed && s.mixK >= 1, hB = HOLD.fMagB && s.B;
    if (hB) { sweepB.update(dt, true); sweepA.update(dt, false, false); s.magB += dt; } else { sweepA.update(dt, hA, true); sweepB.mpos.copy(sweepA.mpos); if (hA) s.magA += dt; }
    if (!s.mixed || s.mixK < 1) { homes.forEach(h => h.vis = false); }
    if (hA && sweepA.left < sweepA.total * .5 && !s.magAok) { s.magAok = true; act('observe', 'sampleA_magnet', 1); toast('Sample A: the iron filings get attracted towards the magnet; the yellow sulfur stays. Hence, iron and sulfur can be separated.', 'good', 4200); }
    if (hB && s.magB > 1.4 / Math.min(TS, 3) && !s.magBok) { s.magBok = true; act('observe', 'sampleB_magnet', 1); toast('Sample B: nothing is attracted by the magnet. The black mass is a new substance.', 'good', 3800); }
  };
  st.take = () => { if (s.taken) { toast('Already weighed: 5.6 g iron filings and 3.2 g sulfur powder.'); return; } s.taken = true; act('step', 'weigh_out', 1); toast('5.6 g of iron filings and 3.2 g of sulfur powder on a watch glass.'); };
  st.mix = () => { if (!s.taken) { toast('Weigh out the iron filings and sulfur powder first.'); return; } if (s.mixed) { toast('Sample A is already mixed.'); return; } s.mixed = true; s.mixK = 0; act('step', 'mix', 1); };
  st.burner = () => { if (!s.burner && !(s.mixed && s.mixK >= 1)) { toast('Make Sample A first.'); return; } s.burner = !s.burner; act('set', 'burner', s.burner);
    if (s.burner && !s.half) { s.half = true; placeHomes(); toast('Half of Sample A is in the china dish. Hold Stir while it heats.'); }
    setFBurner(); };
  st.stirStart = () => { if (!s.half) { toast('Light the burner first: half of Sample A goes into the china dish.'); return; } if (!s.burner && s.p < 1) toast('The burner is off.'); if (s.p >= 1) toast('The black mass has formed. Burner off, then cool and grind it.'); act('hold', 'stir', 1); };
  st.grind = () => { if (s.p < 1) { toast(s.half ? 'Keep heating with stirring until a black mass is formed.' : 'Heat half of Sample A first.'); return; } if (s.burner) { toast('Turn the burner off and let the china dish cool first.'); return; } if (s.grindK >= 0) { toast('Sample B is ready.'); return; } s.grindK = 0; act('step', 'cool_grind', 1); };
  st.labels = [
    label('fes', '<b>iron filings</b> 5.6 g', () => G.localToWorld(V(-10, 3.4, 6)), ''), label('fes', '<b>sulfur powder</b> 3.2 g', () => G.localToWorld(V(-6, 3.6, 6)), 'y'),
    label('fes', '<b>Sample A</b> (mixture)', () => G.localToWorld(V(-8, 4.0, 6)), 'y'), label('fes', '<b>Sample B</b>', () => G.localToWorld(V(8, 3.6, 6)), ''),
    label('fes', '<b>china dish</b>', () => G.localToWorld(V(-15.6, 14, -8))), label('fes', '<b>black mass</b>', () => G.localToWorld(V(-10, 17.5, -8)), 'c'),
    label('fes', '<b>mortar</b> + <b>pestle</b>', () => G.localToWorld(V(6, 7.5, -9)))];
  const [l1, l2, l3, l4, l5, l6, l7] = st.labels;
  l1.show = l2.show = () => s.taken && !s.mixed; l3.show = () => s.mixed && s.mixK >= 1 && !HOLD.fMagA; l4.show = () => s.B && !HOLD.fMagB;
  l5.show = () => s.half && s.p < .9; l6.show = () => s.p >= 1 && s.grindK < .35; l7.show = () => s.grindK >= 0 && !s.B;
  st.hud = () => `<div class="big">Iron + sulfur</div><div class="row">Sample A: <b>${s.mixed ? (s.half ? 'half left' : 'mixed') : s.taken ? 'not mixed yet' : 'not made'}</b> · magnet: <b>${s.magAok ? 'iron attracted' : 'not tested'}</b></div>`
    + `<div class="row">Heating: <b>${!s.half ? 'not started' : s.p >= 1 ? 'black mass formed' : Math.round(s.p * 100) + '%'}</b> · burner <b>${s.burner ? 'on' : 'off'}</b></div>`
    + `<div class="row">Sample B: <b>${s.B ? 'ready' : 'not made'}</b> · magnet: <b>${s.magBok ? 'not attracted' : 'not tested'}</b></div><div class="row safe">Teacher demonstration · well-ventilated · do not inhale the gases</div>`;
}

// ================================================================== 3. HEAT SUGAR (Activity 8.4)
{
  const G = new THREE.Group(); G.position.set(800, 0, 0); scene.add(G);
  const st = ST.sug = { st: 'sug', G, dir: V(.18, .32, 1).normalize() };
  labSet(G, 90);
  const lamp = spiritLamp(1.6); G.add(lamp);
  const TILT = -.62, TR = 1.3, TH = 15;
  const tubeG = new THREE.Group(); G.add(tubeG); tubeG.rotation.z = TILT;
  const tube = testTube(TR, TH, { opacity: .1, edgeOpacity: .8 }); tubeG.add(tube);
  const holder = tubeHolder(13, TR + .02); holder.position.y = TH * .8; holder.rotation.y = Math.PI; tubeG.add(holder);
  const BOT_HEAT = V(-.2, 13.6, 0), BOT_REST = V(-1.6, 17.5, 0);
  const clip = new THREE.Plane(V(0, -1, 0), 0);
  const sugarMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: powderTex('sugar'), roughness: .55, side: THREE.DoubleSide, clippingPlanes: [clip], emissive: '#000' });
  const bed = new THREE.Group(); tubeG.add(bed);
  const sBall = new THREE.Mesh(new THREE.SphereGeometry(TR - .16, 32, 20), sugarMat); sBall.position.y = TR; bed.add(sBall);
  const sCyl = new THREE.Mesh(new THREE.CylinderGeometry(TR - .16, TR - .16, 6, 32, 1, true), sugarMat); sCyl.position.y = TR + 3; bed.add(sCyl);
  const drops = []; { const R = mulberry(33); for (let i = 0; i < 26; i++) { const a = (R() - .5) * 2.8 + Math.PI / 2 * (R() < .65 ? 1 : 0), y = TH - 3.8 + R() * 3.1, r = .09 + R() * .13;
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#E2F5FF', transparent: true, opacity: .7, roughness: .03, clearcoat: 1, depthWrite: false, envMapIntensity: 2 }));
    d.position.set(Math.sin(a) * (TR - .11), y, Math.cos(a) * (TR - .11)); d.quaternion.setFromUnitVectors(V(0, 1, 0), V(-Math.sin(a), 0, -Math.cos(a))); d.userData.t0 = R(); d.renderOrder = 24; tubeG.add(d); drops.push(d); } }
  const vap = wisps(G, 30, '#EEF4F8', 1.6);
  const tW = tile(11, 11); tW.position.set(-12, 0, 4); G.add(tW); const wg = watchGlass(4.2); wg.position.set(-12, TILE_TOP, 4); G.add(wg);
  const charH = heap('char', (x, z) => TILE_TOP + wg.userData.floor(x, z), { seed: 15, lumps: .45, rough: .25 }); charH.position.set(-12, 0, 4); G.add(charH);
  const spat = spatula(11); G.add(spat); const onSpat = new THREE.Mesh(new THREE.SphereGeometry(.6, 12, 8), new THREE.MeshStandardMaterial({ map: powderTex('sugar'), roughness: .7 })); onSpat.scale.set(1.3, .55, .9); onSpat.position.set(-.9, .2, 0); spat.add(onSpat);
  const s = st.s = { sugar: 0, addT: -1, lamp: false, eng: 0, p: 0, scoopT: -1, scooped: false, drops: 0 };
  st.reset = () => { Object.assign(s, { sugar: 0, addT: -1, lamp: false, eng: 0, p: 0, scoopT: -1, scooped: false, drops: 0 }); setULamp(); };
  const onAxis = y => tubeG.localToWorld(V(0, y, 0));
  const SPREST = V(6, .5, 9);
  const COLS = [[0, '#F6F6F2'], [.2, '#F2E6BE'], [.42, '#C98A4A'], [.62, '#7A4321'], [.82, '#2E2018'], [1, '#1B1A19']];
  const colAt = p => { for (let i = 1; i < COLS.length; i++) if (p <= COLS[i][0]) return new THREE.Color(COLS[i - 1][1]).lerp(new THREE.Color(COLS[i][1]), (p - COLS[i - 1][0]) / (COLS[i][0] - COLS[i - 1][0])); return new THREE.Color(COLS[COLS.length - 1][1]); };
  st.layout = portrait => { st.center = V(-3.5, 9.5, 2); st.radius = portrait ? 14 : 15; };
  st.update = dt => {
    const t = now(), pdt = dt * TS;
    // heating: the tube is held in the flame while the button is held
    const want = HOLD.uHeat && s.sugar >= 1; s.eng = clamp(s.eng + (want ? 1 : -1) * dt / .5);
    tubeG.position.lerpVectors(BOT_REST, BOT_HEAT, smooth(s.eng)); tubeG.updateMatrixWorld(true);
    if (s.lamp && s.eng > .9 && s.p < 1) s.p = Math.min(1, s.p + pdt / 16);
    lamp.userData.flame.userData.set(t, s.lamp ? 1 : 0);
    // sugar bed: level surface (world clip plane), colour white -> brown -> black, swells a little as it chars
    const bedH = s.scooped ? 0 : s.sugar * (2.6 + smooth((s.p - .55) / .4) * .9);
    bed.visible = bedH > .02; clip.constant = onAxis(.5 + bedH).y;
    if (s.addT >= 0 && s.addT < 3) { s.addT += dt; s.sugar = clamp((s.addT - .9) / 1.0); }
    sugarMat.color.copy(colAt(s.p)); sugarMat.map = s.p > .78 ? powderTex('char') : powderTex('sugar'); sugarMat.roughness = s.p > .15 && s.p < .7 ? .25 : .7;
    // water droplets near the open end (from the sugar), vapour at the mouth while heating
    s.drops = Math.max(s.drops, smooth((s.p - .3) / .4)); drops.forEach(d => { const k = clamp(s.drops * 1.4 - d.userData.t0 * .5); d.visible = k > .02; d.scale.setScalar(k); });
    vap.userData.update(t, G.worldToLocal(onAxis(TH + .6)), s.lamp && s.eng > .9 && s.p > .3 && s.p < .97 ? .6 : 0, 5, 1);
    // spatula: pours sugar in, later scoops charcoal onto the watch glass
    const mouth = G.worldToLocal(onAxis(TH + 1.2)), inside = G.worldToLocal(onAxis(3)), WG = V(-12, 2.4, 4);
    let sp = SPREST.clone(), rz = 0;
    if (s.addT >= 0 && s.addT < 2.6) { const k = s.addT; sp = k < .7 ? SPREST.clone().lerp(mouth.clone().add(V(1.2, .8, 0)), smooth(k / .7)) : k < 2.0 ? mouth.clone().add(V(1.2, .8, 0)) : mouth.clone().add(V(1.2, .8, 0)).lerp(SPREST, smooth((k - 2) / .6)); rz = k > .7 && k < 2 ? -.9 : 0; onSpat.visible = k < 1.4; onSpat.material.map = powderTex('sugar'); }
    else if (s.scoopT >= 0 && s.scoopT < 4) { s.scoopT += dt; const k = s.scoopT; const P = [[0, SPREST], [.8, mouth], [1.6, inside], [2.1, mouth], [3.1, WG], [3.5, WG], [4, SPREST]];
      for (let i = 1; i < P.length; i++) if (k <= P[i][0]) { sp = P[i - 1][1].clone().lerp(P[i][1], smooth((k - P[i - 1][0]) / (P[i][0] - P[i - 1][0]))); break; }
      if (k >= 4) sp = SPREST.clone(); rz = k > .6 && k < 2.2 ? Math.atan2(-Math.cos(TILT), Math.sin(TILT)) : 0; onSpat.visible = k > 1.6 && k < 3.3; onSpat.material.map = powderTex('char');
      if (k > 1.6 && !s.scooped) s.scooped = true; if (k >= 4) s.scoopT = 99; }
    else onSpat.visible = false;
    spat.position.copy(sp); spat.rotation.set(0, 0, rz); spat.visible = true;
    charH.visible = s.scoopT >= 3.3 && s.scoopT < 100 || s.scoopT === 99; if (charH.visible) charH.userData.set(0, 0, 2.4, 1.3);
  };
  st.add = () => { if (s.sugar > 0 || s.addT >= 0) { toast('There is already a teaspoon of sugar in the boiling tube.'); return; } s.addT = 0; act('step', 'add_sugar', 1); };
  st.lampT = () => { s.lamp = !s.lamp; if (!s.lamp) s.offAt = now(); act('set', 'lamp', s.lamp); setULamp(); };
  st.heatStart = () => { if (s.sugar < 1) { toast('Put a teaspoon of sugar in the boiling tube first.'); return; } if (!s.lamp) toast('Light the spirit lamp first.'); else if (s.p >= 1) toast('The sugar has charred. Put the lamp out and scoop it out.'); act('hold', 'heat', 1); };
  st.scoop = () => { if (s.p < 1) { toast(s.sugar ? 'Heat it until the sugar turns black (it chars).' : 'Add sugar and heat it first.'); return; } if (s.lamp) { toast('Put the lamp out first.'); return; } if (now() - (s.offAt || 0) < 1.2) { toast('Let the boiling tube cool a little first.'); return; } if (s.scoopT >= 0) { toast('The charcoal is on the watch glass.'); return; } s.scoopT = 0; act('step', 'scoop', 1); };
  const L = (h, a, show, cls) => { const l = label('sug', h, a, cls); l.show = show; return l; };
  L('<b>boiling tube</b>', () => onAxis(TH * .66).add(V(1.6, 0, 0)), () => s.p < .3);
  L('<b>test tube holder</b>', () => tubeG.localToWorld(V(-9, TH * .8, 0)), () => s.p < .3);
  L('<b>spirit lamp</b>', () => G.localToWorld(V(-4.8, 4, 1.5)), () => s.p < .3 || !s.lamp);
  L('<b>sugar</b>', () => onAxis(1.5).add(V(-2.2, 0, 0)), () => s.sugar >= 1 && s.p < .15);
  L('it turns <b>brown</b>', () => onAxis(1.5).add(V(-2.2, 0, 0)), () => s.p >= .3 && s.p < .7, 'c');
  L('blackish: it <b>chars</b>', () => onAxis(1.5).add(V(-2.2, 0, 0)), () => s.p >= .75 && !s.scooped);
  L('water <b>droplets</b>', () => onAxis(TH - 2.2).add(V(0, 1.2, TR)), () => s.drops > .5 && !s.scooped);
  L('<b>charcoal</b> (carbon)', () => G.localToWorld(V(-12, 4.2, 4)), () => s.scoopT >= 3.3, 'y');
  L('<b>watch glass</b>', () => G.localToWorld(V(-12, 1.2, 8.5)), () => s.p >= .75);
  st.hud = () => { const c = s.p < .15 ? 'white' : s.p < .35 ? 'melting' : s.p < .7 ? 'brown' : s.p < 1 ? 'turning black' : 'black (charred)';
    return `<div class="big">Heating sugar</div><div class="row">Sugar: <b>${s.sugar >= 1 ? c : 'not added'}</b> · lamp <b>${s.lamp ? 'lit' : 'out'}</b></div><div class="row">Heating: <b>${Math.round(s.p * 100)}%</b>${s.drops > .5 ? ' · water droplets near the open end' : ''}</div><div class="row">${s.scooped ? 'Charcoal (carbon) on the watch glass.' : '&nbsp;'}</div><div class="row safe">Safety first: only in the presence of a teacher</div>`; };
}

// ------------------------------------------------------------------ camera framing per station (fits the visible area between the top card and the bottom panel)
let cur = ST.sep, camReady = false, camAnim = null;
function visArea() { let top = $('top').getBoundingClientRect().bottom;
  if (innerWidth < 900) top = Math.max(top, $('hud').getBoundingClientRect().bottom + 4);
  const bot = innerWidth >= 900 ? innerHeight : $('bottom').getBoundingClientRect().top; return { top, bot: Math.max(top + 120, bot) }; }
function applyOffset() { const W = innerWidth, H = innerHeight, va = visArea(), cy = (va.top + va.bot) / 2, ow = W >= 900 ? 470 : 0, cx = (W - ow) / 2;
  camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H); }
function frame(st, instant) {
  const W = innerWidth, H = innerHeight, portrait = W / H < .9; st.layout(portrait);
  const va = visArea(), vh = va.bot - va.top, ow = W >= 900 ? 470 : 0; applyOffset();
  const fovV = THREE.MathUtils.degToRad(camera.fov) * vh / H, aspect = (W - ow) / vh, fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
  const dist = st.radius / Math.sin(Math.min(fovV, fovH) / 2) * .92;
  const to = st.center.clone().add(st.G.position), pos = to.clone().add(st.dir.clone().multiplyScalar(dist));
  controls.minDistance = dist * .4; controls.maxDistance = dist * 1.6;
  key.position.copy(to).add(V(30, 70, 50)); key.target.position.copy(to); fill.position.copy(to).add(V(-50, 30, 20)); fill.target.position.copy(to); rimL.position.copy(to).add(V(10, 25, -60)); rimL.target.position.copy(to);
  if (instant) { camera.position.copy(pos); controls.target.copy(to); camAnim = null; }
  else camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: to, k: 0 };
  camReady = true; }
function resize() { const W = innerWidth, H = innerHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  const hud = $('hud'); hud.innerHTML = cur.hud(); hud._hh = hud.getBoundingClientRect().height; hud.style.top = ((innerWidth < 900 ? $('card') : $('top')).getBoundingClientRect().bottom + 6) + 'px'; frame(cur, true); }
addEventListener('resize', resize);

// ------------------------------------------------------------------ station switching + controls
const STNAME = { sep: 'Separate', fes: 'Iron + sulfur', sug: 'Heat sugar' };
function goStation(id, why) {
  cur = ST[id]; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.st === id));
  document.querySelectorAll('.grp').forEach(g => g.classList.toggle('on', g.dataset.g === id));
  for (const k in ST) ST[k].G.visible = k === id;
  $('hud').innerHTML = cur.hud(); frame(cur, false); if (why !== 'task') act('open', 'station_' + id, 1); }
document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => goStation(b.dataset.st)));
for (const k in MIX) onBtn(MIX[k].key, () => ST.sep.setMix(k));
for (const k in APP) onBtn(APP[k].key, () => ST.sep.pickApp(k));
['sReset1', 'sReset2', 'sReset3', 'sReset4'].forEach(id => onBtn(id, () => ST.sep.resetMix()));
hold('sMagnet', () => act('hold', 'magnet_sweep', 1));
onBtn('sPourSieve', () => { const g = ST.sep.grain; if (g.pourT >= 0) { toast('The grains are already in the sieve.'); return; } g.pourT = 0; act('step', 'pour_sieve', 1); });
hold('sShake', () => { if (!ST.sep.grain.poured) toast('Pour the grains into the sieve first.'); act('hold', 'shake', 1); });
onBtn('sFold', () => { const f = ST.sep.filter; if (f.folded) { toast('The filter paper is folded.'); return; } f.folded = true; act('step', 'fold_paper', 1); toast('Filter paper folded into a cone.'); });
onBtn('sFit', () => { const f = ST.sep.filter; if (!f.folded) { toast('Fold the filter paper first.'); return; } if (f.fitted) { toast('The paper is in the funnel.'); return; } if (f.poured > 0) { toast('Start again to set up the filter first.'); return; } f.fitted = true; act('step', 'fit_paper', 1); });
hold('sPourF', () => { const f = ST.sep.filter; act('hold', 'pour_filter', 1);
  if (!f.fitted && !f.muddy) { const T = curTask && taskById(curTask); const msg = 'No filter paper in the funnel: the sand runs straight through with the water.'; if (T && T.mix === 'sand') wrongTry(curTask, msg); else toast(msg, 'bad', 3600); } });
onBtn('sPourDish', () => { const d = ST.sep.dish; if (d.pourT >= 0) { toast('The salt water is in the china dish.'); return; } d.pourT = 0; act('step', 'pour_dish', 1); });
function setBurnerBtn() { const on = ST.sep && ST.sep.dish && ST.sep.dish.burner; $('sBurner').textContent = on ? 'Burner off' : 'Light burner'; $('sBurner').classList.toggle('on', !!on); }
onBtn('sBurner', () => { const d = ST.sep.dish; if (!d.burner && !d.poured && d.pourT < 0) { toast('Pour the salt water into the china dish first.'); return; } d.burner = !d.burner; act('set', 'burner', d.burner); setBurnerBtn(); });
function setFBurner() { const on = ST.fes && ST.fes.s.burner; $('fBurner').textContent = on ? 'Burner off' : 'Light burner'; $('fBurner').classList.toggle('on', !!on); }
function setULamp() { const on = ST.sug && ST.sug.s.lamp; $('uLamp').textContent = on ? 'Put lamp out' : 'Light lamp'; $('uLamp').classList.toggle('on', !!on); }
onBtn('fTake', () => ST.fes.take()); onBtn('fMix', () => ST.fes.mix()); onBtn('fBurner', () => ST.fes.burner()); onBtn('fGrind', () => ST.fes.grind());
hold('fMagA', () => { if (!(ST.fes.s.mixed && ST.fes.s.mixK >= 1)) toast('Make Sample A first.'); act('hold', 'magnet_A', 1); });
hold('fMagB', () => { if (!ST.fes.s.B) toast('Make Sample B first.'); act('hold', 'magnet_B', 1); });
hold('fStir', () => ST.fes.stirStart());
onBtn('fGas', () => openInfo('gas')); onBtn('fReset', () => { ST.fes.reset(); act('reset', 'iron_sulfur', 1); });
onBtn('uAdd', () => ST.sug.add()); onBtn('uLamp', () => ST.sug.lampT()); hold('uHeat', () => ST.sug.heatStart()); onBtn('uScoop', () => ST.sug.scoop()); onBtn('uReset', () => { ST.sug.reset(); act('reset', 'sugar', 1); });

// ------------------------------------------------------------------ tasks
let started = false, ended = false, curTask = null; const solved = {}, starsOf = {}, pen = {};
function taskById(id) { return TASKS.find(t => t.id === id); }
function startTask(id) {
  const T = taskById(id); if (curTask !== id) { S.task(id); curTask = id; pen[id] = { hints: 0, wrong: 0 }; }
  if (T.mix) ST.sep.setMix(T.mix, true);
  if (id === 'iron_sulfur') ST.fes.reset();
  if (id === 'heat_sugar') ST.sug.reset();
  goStation(T.st, 'task'); closeSheet(); renderCard(); }
function wrongTry(id, msg) { toast(msg, 'bad', 3800); if (curTask === id && !solved[id]) { pen[id].wrong++; S.retry(); act('record_wrong', id, 1); } }
function finish(id, msg) {
  const p = pen[id] || { hints: 0, wrong: 0 }, n = p.hints + p.wrong, stars = n === 0 ? 3 : n === 1 ? 2 : 1;
  S.done(stars); solved[id] = true; starsOf[id] = stars; curTask = null; toast(msg + '  ' + '★'.repeat(stars), 'good', 4500); renderCard();
  if (TASKS.every(t => solved[t.id])) setTimeout(() => { $('doneStars').textContent = TASKS.map(t => '★'.repeat(starsOf[t.id])).join('   '); $('done').style.display = 'flex'; S.end(); ended = true; }, 1600); }
function record() {
  if (!started || ended) return;
  if (!curTask) { toast('Choose a task first.'); openList(); return; }
  const id = curTask, T = taskById(id);
  if (cur.st !== T.st) { toast('This task is in the ' + STNAME[T.st] + ' station.'); goStation(T.st); return; }
  const P = ST.sep;
  if (T.mix && P.mix !== T.mix) { toast('This task needs the ' + MIX[T.mix].name + ' mixture.'); P.setMix(T.mix, true); return; }
  if (id === 'magnet_iron') { if (P.app === 'magnet' && P.iron.sweep.left === 0) return finish(id, 'Recorded: the magnet pulled out all the iron filings; only sand is left.');
    return wrongTry(id, P.app !== 'magnet' ? 'Pick the apparatus first.' : 'Some iron filings are still in the sand. Keep sweeping the magnet.'); }
  if (id === 'sieve_grains') { const g = P.grain; if (P.app === 'sieve' && g.poured && g.through === g.Gm.length) return finish(id, 'Recorded: the small green gram fell through the sieve; the chickpeas stayed on top.');
    return wrongTry(id, P.app !== 'sieve' ? 'Pick the apparatus first.' : !g.poured ? 'Pour the grains into the sieve first.' : 'Some green gram is still in the sieve. Keep shaking.'); }
  if (id === 'filter_sand') { const f = P.filter; if (P.app === 'filter' && f.done()) return finish(id, 'Recorded: the sand stayed on the filter paper; clear water collected in the beaker.');
    return wrongTry(id, P.app !== 'filter' ? 'Pick the apparatus first.' : f.muddy ? 'The water in the beaker is muddy. Press Again and fit the filter paper first.' : !f.fitted ? 'Fold the filter paper and fit it in the funnel first.' : f.src.L > .02 ? 'Keep pouring until the beaker is empty.' : 'Wait until the funnel has drained.'); }
  if (id === 'evaporate_salt') { const d = P.dish; if (P.app === 'dish' && d.done()) return finish(id, 'Recorded: the water evaporated and the salt was left behind in the china dish.');
    return wrongTry(id, P.app !== 'dish' ? 'Pick the apparatus first.' : !d.poured ? 'Pour the salt water into the china dish first.' : d.W > 0 ? 'There is still water in the dish. Keep heating.' : 'Turn the burner off before you record.'); }
  if (id === 'iron_sulfur') { const s = ST.fes.s; if (s.B && s.magAok && s.magBok) return finish(id, 'Recorded: Sample A (mixture) - iron attracted by the magnet; Sample B (iron sulfide) - not attracted.');
    return wrongTry(id, !s.mixed ? 'Weigh out and mix the iron and sulfur first (Sample A).' : !s.B ? 'Heat half of Sample A with stirring until a black mass forms, then cool and grind it (Sample B).' : !s.magAok ? 'Test Sample A with the magnet.' : 'Test Sample B with the magnet.'); }
  if (id === 'heat_sugar') { const s = ST.sug.s; if (s.scooped && s.drops > .5) return finish(id, 'Recorded: sugar turned brown, then charred; water droplets formed; charcoal (carbon) was left.');
    return wrongTry(id, s.sugar < 1 ? 'Add a teaspoon of sugar first.' : s.p < 1 ? 'Heat it gently until the sugar is black.' : s.lamp ? 'Put the lamp out, then scoop the charcoal onto the watch glass.' : 'Scoop the charcoal onto the watch glass.'); }
}
onBtn('bRecord', record);
function renderCard() {
  const n = TASKS.filter(t => solved[t.id]).length; $('taskKey').textContent = `Tasks ${n}/6` + (curTask ? ' · ' + taskById(curTask).title : '');
  $('taskText').textContent = curTask ? taskById(curTask).text : (n === 6 ? 'All tasks done. Explore freely.' : 'Choose a task (list button), or explore the stations.');
  $('hintText').style.display = 'none'; $('bHint').disabled = !curTask; }
onBtn('bHint', () => { if (!curTask) return; const T = taskById(curTask), p = pen[curTask]; const lvl = Math.min(2, (p.shown || 0) + 1); p.shown = lvl;
  p.hints = Math.max(p.hints, lvl); S.hint(); act('hint', curTask, lvl); $('hintText').textContent = T.hint[lvl - 1]; $('hintText').style.display = 'block'; resize(); });
const sheet = $('sheet'), sbox = $('sheetBox');
function closeSheet() { sheet.classList.remove('show'); }
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
function openList(title) {
  sbox.innerHTML = `<button class="btn x" id="xS">Close</button><h2>${title || 'Experiments'}</h2>` + TASKS.map((t, i) =>
    `<button class="trow${curTask === t.id ? ' cur' : ''}" id="task_${t.id}"><span class="n">${i + 1}</span><span>${t.text}<small>${STNAME[t.st]} · level ${t.level}</small></span><span class="s">${solved[t.id] ? '★'.repeat(starsOf[t.id]) : ''}</span></button>`).join('');
  sheet.classList.add('show'); $('xS').onclick = closeSheet;
  TASKS.forEach(t => $('task_' + t.id).onclick = () => { if (solved[t.id]) { toast('Done already. You can still explore it.'); goStation(t.st); closeSheet(); return; } startTask(t.id); }); }
onBtn('bList', () => openList());
const CARDS = [
  ['mix', 'Mixture', 'When two or more substances are mixed, where each substance retains its properties, it is called a mixture. The individual substances that make up a mixture are called its components. The components of a mixture do not react chemically with each other.'],
  ['uni', 'Non-uniform and uniform mixtures', 'Mixtures where the different components are generally visible with the naked eye or with a magnifying device are non-uniform in nature. Mixtures where the components are evenly distributed and cannot be distinguished are uniform in nature, for example sugar and water.'],
  ['why', 'Why separate a mixture?', 'You learnt in earlier grades about the separation of mixtures. In everyday life, separation is done to obtain the component of interest and other components are discarded. However, in science, the purpose of separating a mixture is to obtain pure substances.'],
  ['methods', 'The methods in this lab', '<b>Magnet:</b> iron filings get attracted towards a magnet; sand and sulfur do not.<br><b>Sieving:</b> grains of different sizes; the small ones pass through the holes of the sieve.<br><b>Filtration:</b> a solid that does not dissolve (sand) stays on the filter paper; the clear liquid (filtrate) passes through.<br><b>Evaporation:</b> dissolved sodium chloride (common salt) may be separated from water by the physical process of evaporation.'],
  ['pure', 'Pure substance', 'A pure substance is a kind of matter that cannot be separated into other kinds of matter by any physical process. When a scientist says that something is pure, it means that the substance consists of the same type of particles.'],
  ['el', 'Elements', 'Elements are substances that cannot be further broken down into simpler substances. They are the building blocks of all matter. Some examples of elements are gold, silver, sulfur, carbon, etc. Iron is a metal; sulfur is a non-metal.'],
  ['co', 'Compounds', 'Compounds are formed when different elements combine in fixed ratios to form something entirely new. The properties of compounds are different from those of elements forming that compound. The constituent elements of a compound cannot be separated by any physical method.'],
  ['A', 'Sample A: a mixture', 'Sample A is a mixture of the two elements—iron and sulfur. Its components retain their properties, and their black and yellow coloured particles can be seen. On bringing magnet near Sample A, the iron filings get attracted towards the magnet. Hence, iron and sulfur can be separated.'],
  ['B', 'Sample B: iron sulfide', 'The black mass obtained in Sample B is iron sulfide. The texture and the colour are the same throughout. It is formed by heating the two elements, iron and sulfur. It is not attracted by a magnet. The new substance has completely different properties, and iron and sulfur can no longer be separated. Hence, a compound has been formed.'],
  ['gas', 'Gas test (dilute hydrochloric acid)', 'Sample A: iron in the mixture reacts with dilute hydrochloric acid to form iron chloride and hydrogen gas. The gas is colourless, has no smell, and burns with a ‘pop’ sound. Sulfur is left as a yellow solid at the bottom of the test tube: sulfur does not react with hydrochloric acid.<span class="eq">Iron + Dilute Hydrochloric acid → Iron chloride + Hydrogen gas</span><br>Sample B: iron sulfide reacts with dilute hydrochloric acid to form iron chloride and hydrogen sulfide gas. The gas is colourless and has a rotten egg-like odour.<span class="eq">Iron sulfide + Dilute Hydrochloric acid → Iron chloride + Hydrogen sulfide</span><br><i>Be careful while handling hydrochloric acid. Never smell anything directly: waft the gas towards your nose.</i>'],
  ['sug', 'Heating sugar', 'As you heat the sugar, it turns brown. Later, it begins to char, i.e., it turns blackish. Small droplets of water form inside the boiling tube near its open end. Since we are heating the tube, the water must have come from the dry sugar and not from the air. Charcoal (carbon) is left behind in the boiling tube.<span class="eq">Sugar decomposes on heating and gives carbon and water.</span>Water consists of hydrogen and oxygen. Hence, sugar cannot be an element: it is a chemical compound consisting of the elements carbon, hydrogen, and oxygen.'],
  ['salt', 'Common salt', 'Sodium, a soft metal, and chlorine, a hazardous gas, combine to form sodium chloride, made up of particles of sodium and chlorine in a 1:1 ratio. Dissolved sodium chloride (common salt) may be separated from water by the physical process of evaporation. It cannot be separated into its elements by a physical process.'],
  ['safe', 'Safety first', '<b>Iron + sulfur (Activity 8.5):</b> this activity may be demonstrated under the supervision of the teacher. It may be performed in a fume hood or a well-ventilated area. Do not inhale the gases.<br><b>Heating sugar (Activity 8.4):</b> this activity must be performed in the presence of a teacher.<br><b>Acids:</b> be careful while handling hydrochloric acid. Never smell anything directly.'],
];
function openInfo(openKey) { sbox.innerHTML = `<button class="btn x" id="xS">Close</button><h2>Info cards</h2>` + CARDS.map((c, i) => `<button class="cardbtn" id="card_${i}">${c[1]}</button><div id="cardBody_${i}"></div>`).join('') +
  '<p style="color:#8fa3b3;font-size:12.5px">Times are made shorter so you can watch each change.</p>';
  sheet.classList.add('show'); $('xS').onclick = closeSheet;
  const openC = i => { const b = $('cardBody_' + i); if (b.innerHTML) { b.innerHTML = ''; return; } b.innerHTML = `<div class="icard${CARDS[i][0] === 'safe' ? ' safe' : ''}"><h3>${CARDS[i][1]}</h3>${CARDS[i][2]}</div>`; act('open', 'card_' + CARDS[i][0], 1); };
  CARDS.forEach((c, i) => $('card_' + i).onclick = () => openC(i));
  if (typeof openKey === 'string') { const i = CARDS.findIndex(c => c[0] === openKey); if (i >= 0) { openC(i); setTimeout(() => $('card_' + i).scrollIntoView({ block: 'start' }), 30); } } }
onBtn('bInfo', () => openInfo());
onBtn('bExit', () => { if (!started) { $('intro').style.display = 'none'; started = true; } if (!ended) { S.end(); ended = true; } curTask = null; renderCard(); closeSheet(); music.stop(); toast('Visit ended. You can close this page.', '', 5000); });
onBtn('bMusic', () => { music.toggle(); act('toggle', 'music', music.on); });
onBtn('bDoneOk', () => { $('done').style.display = 'none'; });
onBtn('bStart', () => { $('intro').style.display = 'none'; started = true; music.start(); renderCard(); resize(); openList('Choose an experiment'); });

// ------------------------------------------------------------------ music (generated, no voice): soft cool pad + slow pentatonic bells
const music = (() => {
  let ctx = null, master = null, on = true, timer = 0, step = 0; const notes = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
  function bell(f, t, v) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(.0005, t + 2.4); o.connect(g); g.connect(master); o.start(t); o.stop(t + 2.5); }
  function pad() { [130.8, 196, 246.9].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), lf = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = i * 4 - 4;
    g.gain.value = .018; lf.frequency.value = .07 + i * .03; lg.gain.value = .01; lf.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(master); o.start(); lf.start(); }); }
  function loop() { if (!on || !ctx) return; const t = ctx.currentTime + .05, R = (step * 2654435761 >>> 0) % 7; bell(notes[R], t, .05); if (step % 3 === 0) bell(notes[(R + 2) % 7] / 2, t + .6, .035); step++; timer = setTimeout(loop, 1500); }
  return { get on() { return on; },
    start() { try { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .8; master.connect(ctx.destination); pad(); } ctx.resume(); if (on) { clearTimeout(timer); loop(); } } catch (e) { } },
    stop() { on = false; clearTimeout(timer); try { ctx && ctx.suspend(); } catch (e) { } },
    toggle() { on = !on; if (on) this.start(); else { clearTimeout(timer); try { ctx && ctx.suspend(); } catch (e) { } } } };
})();

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock(); let hudT = 0, fpsAvg = 60;
function tick() {
  requestAnimationFrame(tick);
  const raw = clock.getDelta(), dt = Math.min(.05, raw); fpsAvg = fpsAvg * .95 + .05 / Math.max(raw, 1e-3);
  if (camAnim) { camAnim.k = Math.min(1, camAnim.k + dt / .9); const e = camAnim.k < .5 ? 4 * camAnim.k ** 3 : 1 - (-2 * camAnim.k + 2) ** 3 / 2;
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e); controls.target.lerpVectors(camAnim.t0, camAnim.t1, e); if (camAnim.k >= 1) camAnim = null; }
  controls.update();
  cur.update(dt);
  if ((hudT += dt) > .2) { hudT = 0; const h = $('hud'); if (innerWidth < 900) { const ct = ($('card').getBoundingClientRect().bottom + 6) + 'px'; if (h.style.top !== ct) { h.style.top = ct; h._hh = -99; } } h.innerHTML = cur.hud(); const hh = h.getBoundingClientRect().height; if (Math.abs(hh - (h._hh || 0)) > 6) { h._hh = hh; if (innerWidth < 900) applyOffset(); } }
  updateLabels();
  renderer.render(scene, camera);
}
$('loading').style.display = 'none';
ST.sep.setMix('iron', true); for (const k in ST) ST[k].G.visible = k === 'sep';
resize(); goStation('sep', 'task'); renderCard(); tick();
window.__sim = { state: () => { const P = ST.sep, F = ST.fes.s, U = ST.sug.s;
  return Object.assign({ cur: cur.st, curTask, holds: Object.keys(HOLD).filter(k => HOLD[k]), solved: Object.assign({}, solved), stars: Object.assign({}, starsOf), fps: Math.round(fpsAvg), mix: P.mix, app: P.app,
    ironLeft: P.iron.sweep.left, grainThrough: P.grain.through, grainPoured: P.grain.poured, filter: { fitted: P.filter.fitted, muddy: P.filter.muddy, L: +P.filter.src.L.toFixed(3), Vf: +P.filter.Vf.toFixed(3), done: P.filter.done() },
    dish: { poured: P.dish.poured, W: +P.dish.W.toFixed(3), burner: P.dish.burner },
    fes: { taken: F.taken, mixed: F.mixed && F.mixK >= 1, half: F.half, p: Math.floor(F.p * 1000) / 1000, burner: F.burner, B: F.B, magA: F.magAok, magB: F.magBok },
    sug: { sugar: U.sugar, lamp: U.lamp, p: Math.floor(U.p * 1000) / 1000, drops: +U.drops.toFixed(2), scooped: U.scooped } }, S.state ? S.state() : {}); } };
