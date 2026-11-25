// app.js - Optics Lab renderer + step player. Physics lives in optics.js / setups.js; this file only draws it.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as O from './optics.js';
import { EXPS, H, stepParams, readouts, BANDS, FINE } from './setups.js';
import { Music } from './music.js';

const DEG = Math.PI / 180;
const V3 = (p, y = H) => new THREE.Vector3(p[0], y, p[1]);
const canvas = document.getElementById('c');
const isTouch = matchMedia('(pointer: coarse)').matches;

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.75 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);
scene.fog = new THREE.FogExp2(0x05070a, 0.0065);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.32;

const camera = new THREE.PerspectiveCamera(36, 1, 1, 600);
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// lights
scene.add(new THREE.HemisphereLight(0x8aa0c0, 0x0a0b0d, 0.35));
const key = new THREE.SpotLight(0xfff1e0, 900, 0, 0.62, 0.85, 2);
key.position.set(-10, 95, 35);
key.target.position.set(0, 0, 0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0002;
key.shadow.normalBias = 0.02;
key.shadow.camera.near = 30; key.shadow.camera.far = 200;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x6f8dff, 0.55);
rim.position.set(30, 20, -60);
scene.add(rim);

// ------------------------------------------------------------------ textures
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
// optical breadboard: 25 mm hole grid, one hole per texture tile
const holeTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#17191c'; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h);
  for (let k = 0; k < img.data.length; k += 4) { const n = (Math.random() - 0.5) * 7; img.data[k] += n; img.data[k + 1] += n; img.data[k + 2] += n; }
  g.putImageData(img, 0, 0);
  const r = w * 0.13;
  const gr = g.createRadialGradient(w / 2, h / 2, r * 0.2, w / 2, h / 2, r * 1.25);
  gr.addColorStop(0, '#000'); gr.addColorStop(0.78, '#050505'); gr.addColorStop(0.86, '#3a3d42'); gr.addColorStop(1, 'rgba(23,25,28,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(w / 2, h / 2, r * 1.25, 0, Math.PI * 2); g.fill();
});
holeTex.wrapS = holeTex.wrapT = THREE.RepeatWrapping;
const spotTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.42, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, false);
function protractorTex(scale, zero) {
  return canvasTex(1024, 1024, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#121418'; g.fillRect(0, 0, w, w);
    const ring = g.createRadialGradient(c, c, c * 0.6, c, c, c);
    ring.addColorStop(0, '#15171b'); ring.addColorStop(1, '#202329');
    g.fillStyle = ring; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    if (scale === 'none') return;
    g.strokeStyle = 'rgba(235,240,245,0.85)'; g.fillStyle = 'rgba(235,240,245,0.9)';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 34px system-ui, sans-serif';
    for (let a = 0; a < 360; a += 2) {
      const rel = ((a - zero) % 360 + 540) % 360 - 180; // -180..180 from the zero line
      if (scale === 'half' && Math.abs(rel) > 90) continue;
      const big = a % 10 === 0, mid = a % 5 === 0;
      const r0 = c * 0.985, r1 = c * (big ? 0.88 : mid ? 0.92 : 0.95);
      const ang = -a * DEG; // texture v axis points to -z after mapping, flip
      g.lineWidth = big ? 4 : 2;
      g.beginPath(); g.moveTo(c + Math.cos(ang) * r0, c + Math.sin(ang) * r0); g.lineTo(c + Math.cos(ang) * r1, c + Math.sin(ang) * r1); g.stroke();
      if (a % 30 === 0) {
        const rr = c * 0.8;
        g.save(); g.translate(c + Math.cos(ang) * rr, c + Math.sin(ang) * rr); g.rotate(ang + Math.PI / 2);
        g.fillText(String(Math.abs(Math.round(rel))), 0, 0); g.restore();
      }
    }
    g.lineWidth = 2; g.strokeStyle = 'rgba(235,240,245,0.35)';
    g.beginPath(); g.arc(c, c, c * 0.72, 0, Math.PI * 2); g.stroke();
  });
}
const labelTex = canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#f0c22b'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#111'; g.font = '700 54px system-ui, sans-serif'; g.textBaseline = 'middle';
  g.beginPath(); g.moveTo(40, 98); g.lineTo(78, 30); g.lineTo(116, 98); g.closePath(); g.fill();
  g.fillStyle = '#f0c22b'; g.font = '800 44px system-ui'; g.fillText('!', 70, 74);
  g.fillStyle = '#111'; g.font = '700 50px system-ui, sans-serif'; g.fillText('LASER 650 nm', 140, 66);
});

// ------------------------------------------------------------------ materials
const M = {
  anod: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.36, metalness: 0.65 }),
  anod2: new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.45, metalness: 0.55 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.22, metalness: 1.0 }),
  black: new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.7, metalness: 0.2 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf1f1ec, roughness: 0.88, metalness: 0.0 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.03, metalness: 1.0, envMapIntensity: 2.2 }),
  label: new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.5, metalness: 0 }),
  cable: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.6, metalness: 0.1 }),
};
function glassMat(type) {
  const flint = type === 'SF11';
  return new THREE.MeshPhysicalMaterial({
    color: flint ? 0xfff8ea : 0xffffff, roughness: 0.035, metalness: 0, transmission: 1, thickness: 3,
    ior: flint ? 1.78 : 1.515, attenuationColor: new THREE.Color(flint ? 0xf3ecd6 : 0xd5f3ef), attenuationDistance: 26,
    specularIntensity: 1, envMapIntensity: 1.6, depthWrite: false, side: THREE.FrontSide,
  });
}
const edgeMat = new THREE.LineBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.32, depthWrite: false });

function mesh(geo, mat, cast = true, recv = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv; return m; }
function cylX(r, len, mat, seg = 40) { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); return mesh(g, mat); }

// ------------------------------------------------------------------ table
{
  const W = 240, D = 170;
  const tex = holeTex.clone(); tex.needsUpdate = true; tex.repeat.set(W / 2.5, D / 2.5);
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0.35 });
  const side = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.5, metalness: 0.4 });
  const t = mesh(new THREE.BoxGeometry(W, 4, D), [side, side, top, side, side, side], false, true);
  t.position.set(1.25, -2, 1.25); // hole centres on the 2.5 cm grid through the origin
  scene.add(t);
}

// ------------------------------------------------------------------ hardware builders
function postTo(group, topY, at = [0, 0]) {
  // post (12.7 mm) in a post holder on a base plate, from the table (y=0) up to topY (group-local, group at y=0)
  const g = new THREE.Group();
  const base = mesh(new THREE.BoxGeometry(6.4, 0.95, 2.6), M.anod); base.position.y = 0.475; g.add(base);
  for (const s of [-2.2, 2.2]) { const sc = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 20), M.steel); sc.position.set(s, 1.1, 0); g.add(sc); }
  const holderH = Math.min(5, Math.max(1.5, topY * 0.45));
  const ph = mesh(new THREE.CylinderGeometry(1.2, 1.2, holderH, 32), M.anod); ph.position.y = 0.95 + holderH / 2; g.add(ph);
  const knob = cylX(0.38, 1.4, M.anod2, 16); knob.position.set(1.7, 0.95 + holderH * 0.7, 0); g.add(knob);
  const postLen = Math.max(0.5, topY - 0.95);
  const post = mesh(new THREE.CylinderGeometry(0.63, 0.63, postLen, 28), M.steel); post.position.y = 0.95 + postLen / 2; g.add(post);
  g.position.set(at[0], 0, at[1]);
  group.add(g);
  return g;
}
function makeLaser() {
  const g = new THREE.Group(); // local +x = beam; origin = aperture at beam height
  const body = cylX(1.15, 9.6, M.anod); body.position.x = -5.6; g.add(body);
  const band = new THREE.CylinderGeometry(1.17, 1.17, 3.2, 40, 1, true); band.rotateZ(Math.PI / 2);
  const bm = mesh(band, M.label); bm.position.x = -5.2; bm.rotation.x = -Math.PI / 2; g.add(bm);
  const nose = cylX(0.85, 1.0, M.steel); nose.position.x = -0.5; g.add(nose);
  const lip = cylX(0.55, 0.12, M.black, 24); lip.position.x = 0.02; g.add(lip);
  const tail = cylX(0.9, 0.8, M.steel); tail.position.x = -10.8; g.add(tail);
  const led = mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2010, emissiveIntensity: 0 }));
  led.position.set(-9.6, 1.12, 0); g.add(led);
  const aper = mesh(new THREE.CircleGeometry(0.22, 20), new THREE.MeshBasicMaterial({ color: 0x000000 }), false, false);
  aper.rotation.y = Math.PI / 2; aper.position.x = 0.09; g.add(aper);
  for (const x of [-2.6, -8.4]) {
    const ring = mesh(new THREE.TorusGeometry(1.3, 0.22, 10, 40), M.anod2); ring.rotation.y = Math.PI / 2; ring.position.x = x; g.add(ring);
    const lug = mesh(new THREE.BoxGeometry(1.2, 1.6, 1.0), M.anod2); lug.position.set(x, -1.75, 0); g.add(lug);
  }
  const bar = mesh(new THREE.BoxGeometry(7.4, 0.6, 1.4), M.anod); bar.position.set(-5.5, -2.6, 0); g.add(bar);
  const stand = new THREE.Group(); g.add(stand); stand.position.set(-5.5, -H, 0);
  postTo(stand, H - 2.9);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-11.2, 0, 0), new THREE.Vector3(-13.5, -0.6, 0.4), new THREE.Vector3(-15, -H + 1.5, 1.2), new THREE.Vector3(-22, -H + 0.35, 3)]);
  g.add(mesh(new THREE.TubeGeometry(curve, 40, 0.22, 8), M.cable));
  g.userData.on = (v) => { led.material.emissiveIntensity = v > 0.01 ? 3 : 0; aper.material.color.setRGB(v > 0.01 ? 3 : 0, v > 0.01 ? 0.1 : 0, 0); };
  return g;
}
function makeLamp() {
  const g = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(8, 6.2, 6.2), M.anod2); box.position.x = -7.4; g.add(box);
  for (let k = 0; k < 6; k++) { const fin = mesh(new THREE.BoxGeometry(0.28, 0.9, 5.6), M.anod); fin.position.set(-10.4 + k * 1.2, 3.5, 0); g.add(fin); }
  const tube = cylX(1.55, 3.2, M.anod); tube.position.x = -1.75; g.add(tube);
  const ringm = cylX(1.75, 0.35, M.steel); ringm.position.x = -0.3; g.add(ringm);
  const plate = cylX(1.5, 0.12, M.black, 32); plate.position.x = 0.0; g.add(plate);
  const slit = mesh(new THREE.PlaneGeometry(0.14, 1.9), new THREE.MeshBasicMaterial({ color: 0x000000 }), false, false);
  slit.rotation.y = Math.PI / 2; slit.position.x = 0.08; g.add(slit);
  const sw = mesh(new THREE.BoxGeometry(1.2, 0.5, 0.8), M.anod); sw.position.set(-5, 3.3, 2.0); g.add(sw);
  const led = mesh(new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0 }));
  led.position.set(-3.5, 2.2, 3.12); g.add(led);
  const stand = new THREE.Group(); g.add(stand); stand.position.set(-7.4, -H, 0);
  postTo(stand, H - 3.1);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-11.4, -1, 0), new THREE.Vector3(-13.5, -2, 0.5), new THREE.Vector3(-15, -H + 1.2, 1.5), new THREE.Vector3(-24, -H + 0.35, 4)]);
  g.add(mesh(new THREE.TubeGeometry(curve, 40, 0.3, 8), M.cable));
  g.userData.on = (v) => { led.material.emissiveIntensity = v > 0.01 ? 2.5 : 0; slit.material.color.setScalar(v > 0.01 ? 4 : 0); };
  return g;
}
function makeRaybox(beams) {
  const g = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(6, 3.6, 7.6), M.anod2); box.position.x = -3.1; g.add(box);
  const face = mesh(new THREE.BoxGeometry(0.25, 3.9, 7.9), M.anod); face.position.x = -0.12; g.add(face);
  const dots = beams.map((v) => {
    const d = mesh(new THREE.CircleGeometry(0.22, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }), false, false);
    d.rotation.y = Math.PI / 2; d.position.set(0.02, 0, v); g.add(d); return d;
  });
  const lbl = mesh(new THREE.PlaneGeometry(4.2, 1.05), M.label, false, false); lbl.rotation.x = -Math.PI / 2; lbl.position.set(-3.1, 1.81, 0); g.add(lbl);
  const stand = new THREE.Group(); g.add(stand); stand.position.set(-3.1, -H, 0);
  postTo(stand, H - 1.8);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-6.1, -0.6, 0), new THREE.Vector3(-8, -1.5, 0.4), new THREE.Vector3(-9, -H + 1.2, 1.2), new THREE.Vector3(-18, -H + 0.35, 3)]);
  g.add(mesh(new THREE.TubeGeometry(curve, 40, 0.22, 8), M.cable));
  g.userData.on = (v) => dots.forEach((d) => d.material.color.setRGB(v > 0.01 ? 3 : 0, v > 0.01 ? 0.1 : 0, 0));
  return g;
}
function makeMirror(size, stageTop) {
  const g = new THREE.Group(); // local +x = mirror normal; mirror face at x=0
  const r = size / 2;
  const disc = cylX(r, 0.45, M.mirror, 48); disc.position.x = -0.225; g.add(disc);
  const rimm = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.12, 8, 48), M.anod); rimm.rotation.y = Math.PI / 2; rimm.position.x = -0.1; g.add(rimm);
  const plate = mesh(new THREE.BoxGeometry(0.9, size + 1.6, size + 1.6), M.anod); plate.position.x = -0.95; g.add(plate);
  const plate2 = mesh(new THREE.BoxGeometry(0.7, size + 1.6, size + 1.6), M.anod2); plate2.position.x = -2.1; g.add(plate2);
  for (const [y, z] of [[r + 0.2, r + 0.2], [-r - 0.2, r + 0.2], [r + 0.2, -r - 0.2]]) {
    const k = cylX(0.32, 1.9, M.steel, 16); k.position.set(-2.9, y, z); g.add(k);
    const kn = cylX(0.55, 0.8, M.anod, 20); kn.position.set(-3.9, y, z); g.add(kn);
  }
  const plen = (H - (size + 1.6) / 2) - stageTop;
  const post = mesh(new THREE.CylinderGeometry(0.63, 0.63, plen + 0.1, 24), M.steel); post.position.set(-1.6, -(size + 1.6) / 2 - plen / 2, 0); g.add(post);
  return g;
}
function makeStage(o) {
  const g = new THREE.Group();
  const thick = 1.0;
  const topMat = new THREE.MeshStandardMaterial({ map: protractorTex(o.scale, o.zero), roughness: 0.55, metalness: 0.4, transparent: true });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.35, metalness: 0.75, transparent: true });
  const disk = mesh(new THREE.CylinderGeometry(o.r, o.r, thick, 72), [sideMat, topMat, sideMat], true, true);
  disk.position.y = o.top - thick / 2;
  // top face UV: CylinderGeometry cap uv maps x -> u, z -> -v; we rotate the texture with the disk
  g.add(disk);
  const ped = mesh(new THREE.CylinderGeometry(2.2, 2.8, o.top - thick - 0.6, 32), M.anod); ped.position.y = 0.6 + (o.top - thick - 0.6) / 2; g.add(ped);
  const foot = mesh(new THREE.CylinderGeometry(o.r * 0.55, o.r * 0.6, 0.6, 48), M.anod2); foot.position.y = 0.3; g.add(foot);
  g.userData.disk = disk; g.userData.mats = [topMat, sideMat];
  return g;
}
function makeScreen(o) {
  const g = new THREE.Group(); // local +x faces the light; card front at x=0
  const card = mesh(new THREE.BoxGeometry(0.3, o.hgt, o.w), M.white); card.position.x = -0.15; g.add(card);
  const frame = mesh(new THREE.BoxGeometry(0.4, o.hgt + 0.8, o.w + 0.8), M.anod); frame.position.x = -0.55; g.add(frame);
  const clamp = mesh(new THREE.BoxGeometry(1.4, 1.2, 2.6), M.anod2); clamp.position.set(-0.9, -o.hgt / 2 - 0.9, 0); g.add(clamp);
  const stand = new THREE.Group(); g.add(stand); stand.position.set(-0.9, -H, 0);
  postTo(stand, H - o.hgt / 2 - 1.4);
  return g;
}
function makeArcScreen(o) {
  const g = new THREE.Group();
  const hgt = 7;
  const ts = (90 - o.a1) * DEG, tl = (o.a1 - o.a0) * DEG;
  const mat = M.white.clone(); mat.side = THREE.DoubleSide; mat.transparent = true;
  const front = mesh(new THREE.CylinderGeometry(o.R, o.R, hgt, 96, 1, true, ts, tl), mat); front.position.y = H; g.add(front);
  const bm = M.anod.clone(); bm.side = THREE.DoubleSide; bm.transparent = true;
  const back = mesh(new THREE.CylinderGeometry(o.R + 0.35, o.R + 0.35, hgt + 0.7, 96, 1, true, ts - 0.01, tl + 0.02), bm); back.position.y = H; g.add(back);
  for (const a of [o.a0, o.a1]) {
    const p = O.mul(O.dirOf(a), o.R + 1.4);
    const st = new THREE.Group(); st.position.set(p[0], 0, p[1]); g.add(st);
    postTo(st, H - hgt / 2 - 0.2);
    const arm = mesh(new THREE.BoxGeometry(2.2, 0.8, 1.2), M.anod2); arm.position.set(0, H - hgt / 2 - 0.5, 0);
    arm.rotation.y = -a * DEG; st.add(arm);
  }
  g.userData.mats = [mat, bm];
  return g;
}
function shapeGeo(pts) {
  const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
  return s;
}
function extrudeGlass(shape, hgt, curveSegs = 12) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: hgt, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: curveSegs });
  geo.translate(0, 0, -hgt / 2);
  geo.rotateX(Math.PI / 2); // shape (u,v) -> (x, ., z)
  geo.computeVertexNormals();
  return geo;
}
function makeGlass(o) {
  const g = new THREE.Group();
  let geo;
  if (o.form === 'slab') geo = new THREE.BoxGeometry(o.w, o.hgt, o.h);
  else if (o.form === 'poly') geo = extrudeGlass(shapeGeo(o.local), o.hgt);
  else if (o.form === 'semi') {
    const s = new THREE.Shape(); s.absarc(0, 0, o.R, 0, Math.PI, false); s.lineTo(o.R, 0);
    geo = extrudeGlass(s, o.hgt, 48);
  } else if (o.form === 'lens') {
    const pts = [], h = o.D / 2, R = o.R, t = o.t;
    const N = 40;
    for (let k = 0; k <= N; k++) { const r = h * k / N; pts.push(new THREE.Vector2(r, -t / 2 + (R - Math.sqrt(R * R - r * r)))); }
    for (let k = N; k >= 0; k--) { const r = h * k / N; pts.push(new THREE.Vector2(r, t / 2 - (R - Math.sqrt(R * R - r * r)))); }
    geo = new THREE.LatheGeometry(pts, 72); geo.rotateZ(-Math.PI / 2);
  } else if (o.form === 'fibre') {
    const f = o.shape, cp = [];
    const n1 = 24;
    for (let k = 0; k <= 8; k++) cp.push(O.add(f.start, [(f.p1[0] - f.start[0]) * k / 8, 0]));
    for (let k = 1; k <= n1; k++) { const a = f.a0 + (f.a1 - f.a0) * k / n1; cp.push(O.add(f.cb, O.mul(O.dirOf(a), f.Rb))); }
    for (let k = 1; k <= 8; k++) cp.push(O.add(f.p2, O.mul(f.tEnd, O.len(O.sub(f.p3, f.p2)) * k / 8)));
    const curve = new THREE.CatmullRomCurve3(cp.map((p) => new THREE.Vector3(p[0], 0, p[1])), false, 'centripetal');
    geo = new THREE.TubeGeometry(curve, 160, f.w / 2, 28, false);
    // end caps + holders
    for (const [p, d] of [[f.start, [-1, 0]], [f.p3, f.tEnd]]) {
      const cap = mesh(new THREE.CircleGeometry(f.w / 2, 28), glassMat('BK7'), false, false);
      cap.position.set(p[0], 0, p[1]); cap.lookAt(p[0] + d[0], 0, p[1] + d[1]); g.add(cap);
    }
    for (const q of [O.add(f.start, [3, 0]), O.add(f.cb, O.mul(O.dirOf((f.a0 + f.a1) / 2), f.Rb)), O.add(f.p2, O.mul(f.tEnd, 6))]) {
      const st = new THREE.Group(); st.position.set(q[0], -H, q[1]); g.add(st);
      postTo(st, H - 1.6);
      const vb = mesh(new THREE.BoxGeometry(2.2, 0.8, 2.2), M.anod2); vb.position.y = H - 1.05; st.add(vb);
    }
  }
  const glass = mesh(geo, glassMat(o.glassType || 'BK7'), false, false);
  glass.renderOrder = 1;
  g.add(glass);
  if (o.form !== 'fibre') {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), edgeMat);
    edges.renderOrder = 2; g.add(edges);
  }
  if (o.form === 'lens') {
    // lens in a ring holder on a post
    const ring = mesh(new THREE.TorusGeometry(o.D / 2 + 0.35, 0.32, 12, 64), M.anod); ring.rotation.y = Math.PI / 2; g.add(ring);
    const st = new THREE.Group(); st.position.set(0, -H, 0); g.add(st);
    postTo(st, H - o.D / 2 - 0.55);
    g.userData.post = st;
  }
  return g;
}

// ------------------------------------------------------------------ beams (instanced core + soft glow)
const MAXB = 900;
const unitCyl = (r, s) => { const g = new THREE.CylinderGeometry(r, r, 1, s, 1, true); g.translate(0, 0.5, 0); return g; };
const coreMesh = new THREE.InstancedMesh(unitCyl(0.065, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }), MAXB);
const glowMat = new THREE.ShaderMaterial({
  uniforms: { uK: { value: 1.0 } },
  vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vC;
    void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position,1.0);
      vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
      vC = instanceColor; gl_Position = projectionMatrix * viewMatrix * wp; }`,
  fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vC; uniform float uK;
    void main(){ float f = abs(dot(normalize(vN), normalize(vV))); float g = pow(f, 3.5);
      gl_FragColor = vec4(vC * g * uK, 1.0); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const glowMesh = new THREE.InstancedMesh(unitCyl(0.34, 14), glowMat, MAXB);
for (const m of [coreMesh, glowMesh]) {
  m.frustumCulled = false; m.renderOrder = 5; m.count = 0;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.setColorAt(0, new THREE.Color(0, 0, 0)); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  scene.add(m);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
let nBeam = 0;
function pushBeam(a, b, rgb, k) {
  if (nBeam >= MAXB) return;
  const A = V3(a), B = V3(b);
  const d = B.clone().sub(A); const L = d.length(); if (L < 1e-4) return;
  _q.setFromUnitVectors(_up, d.divideScalar(L));
  _m.compose(A, _q, _s.set(1, L, 1));
  coreMesh.setMatrixAt(nBeam, _m); glowMesh.setMatrixAt(nBeam, _m);
  coreMesh.setColorAt(nBeam, _c.setRGB(rgb[0] * k * 3.2, rgb[1] * k * 3.2, rgb[2] * k * 3.2));
  glowMesh.setColorAt(nBeam, _c.setRGB(rgb[0] * k * 0.5, rgb[1] * k * 0.5, rgb[2] * k * 0.5));
  nBeam++;
}
// spots on screens + glints on surfaces
const spotPool = [];
const spotGeo = new THREE.PlaneGeometry(1, 1);
function getSpot(i) {
  while (spotPool.length <= i) {
    const m = new THREE.Mesh(spotGeo, new THREE.MeshBasicMaterial({ map: spotTex, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
    m.renderOrder = 6; scene.add(m); spotPool.push(m);
  }
  return spotPool[i];
}
let nSpot = 0;
function pushSpot(p, nrm, rgb, size, k) {
  const m = getSpot(nSpot++);
  m.visible = true;
  m.position.set(p[0] + nrm[0] * 0.09, H, p[1] + nrm[1] * 0.09);
  m.lookAt(p[0] + nrm[0], H, p[1] + nrm[1]);
  m.scale.setScalar(size);
  m.material.color.setRGB(rgb[0] * k, rgb[1] * k, rgb[2] * k);
}
const glintPool = [];
let nGlint = 0;
function pushGlint(p, rgb, k, size = 1.3) {
  while (glintPool.length <= nGlint) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spotTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false, fog: false }));
    s.renderOrder = 7; scene.add(s); glintPool.push(s);
  }
  const s = glintPool[nGlint++];
  s.visible = true; s.position.copy(V3(p)); s.scale.setScalar(size);
  s.material.color.setRGB(rgb[0] * k, rgb[1] * k, rgb[2] * k);
}
// spectrum strip on screen A
const specGeo = new THREE.BufferGeometry();
const specMesh = new THREE.Mesh(specGeo, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
specMesh.renderOrder = 6; specMesh.frustumCulled = false; scene.add(specMesh);

// white balance for the spectral colours so that all bands together add up to white
const bandRGB = (() => {
  const raw = BANDS.map((b) => O.wavelengthRGB(b.nm));
  const sum = raw.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0]);
  return raw.map((c) => [c[0] / sum[0], c[1] / sum[1], c[2] / sum[2]]);
})();
const fineRGB = (() => {
  const raw = FINE.map((nm) => O.wavelengthRGB(nm));
  const sum = raw.reduce((s, c) => [s[0] + c[0], s[1] + c[1], s[2] + c[2]], [0, 0, 0]);
  return raw.map((c) => [c[0] / sum[0] * FINE.length, c[1] / sum[1] * FINE.length, c[2] / sum[2] * FINE.length]);
})();
const RED = [1, 0.045, 0.02];

// ------------------------------------------------------------------ haze: dust motes lit by the beams
const DUST = 2200, NSEG = 48;
const dust = (() => {
  const pos = new Float32Array(DUST * 3), ph = new Float32Array(DUST);
  for (let k = 0; k < DUST; k++) {
    pos[k * 3] = (Math.random() - 0.5) * 90; pos[k * 3 + 1] = H + (Math.random() - 0.5) * 7; pos[k * 3 + 2] = (Math.random() - 0.5) * 80;
    ph[k] = Math.random() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uSeg: { value: Array.from({ length: NSEG }, () => new THREE.Vector4()) },
      uCol: { value: Array.from({ length: NSEG }, () => new THREE.Vector3()) }, uN: { value: 0 }, uScale: { value: 300 } },
    vertexShader: `uniform float uT; uniform vec4 uSeg[${NSEG}]; uniform vec3 uCol[${NSEG}]; uniform int uN; uniform float uScale;
      attribute float ph; varying vec3 vC;
      void main(){ vec3 p = position + vec3(sin(uT*0.11+ph)*1.6, sin(uT*0.07+ph*1.7)*0.9, cos(uT*0.09+ph*0.6)*1.6);
        vec3 c = vec3(0.012);
        for (int k=0;k<${NSEG};k++){ if(k>=uN) break; vec2 a=uSeg[k].xy, b=uSeg[k].zw; vec2 q=p.xz;
          vec2 ab=b-a; float t=clamp(dot(q-a,ab)/max(dot(ab,ab),1e-4),0.0,1.0); vec2 d2=q-(a+ab*t);
          float dy=p.y-${H.toFixed(2)}; float dd=dot(d2,d2)+dy*dy; c += uCol[k]*exp(-dd*1.6)*1.4; }
        vC = c; vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = uScale*0.075/(-mv.z); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d); if(r>0.25) discard; gl_FragColor=vec4(vC*(1.0-r*4.0),1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 4;
  scene.add(pts);
  return mat;
})();

// ------------------------------------------------------------------ overlays: ribbons (lines, arcs) + DOM labels
const OVC = { n: [0.85, 0.9, 0.95], i: [1.0, 0.7, 0.25], r: [0.28, 0.84, 1.0], e: [0.55, 1.0, 0.6], d: [1.0, 0.42, 0.84], g: [0.7, 0.75, 0.82], f: [1.0, 0.9, 0.4] };
const CSSC = { n: '#d9e2ea', i: '#ffb340', r: '#46d7ff', e: '#8cff9a', d: '#ff6ad5', g: '#b7c0cb', f: '#ffe066' };
const ovGeo = new THREE.BufferGeometry();
const ovMesh = new THREE.Mesh(ovGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
ovMesh.renderOrder = 8; ovMesh.frustumCulled = false; scene.add(ovMesh);
function buildOverlays(ov) {
  const P = [], C = [];
  const quad = (a, b, w, col, al, y) => {
    const d = O.norm(O.sub(b, a)), n = [-d[1] * w / 2, d[0] * w / 2];
    const q = [O.add(a, n), O.sub(a, n), O.sub(b, n), O.add(b, n)];
    for (const k of [0, 1, 2, 0, 2, 3]) { P.push(q[k][0], y, q[k][1]); C.push(col[0], col[1], col[2], al); }
  };
  for (const l of ov.lines || []) {
    if (!(l.alpha > 0.01)) continue;
    const col = OVC[l.col] || OVC.g, w = l.w ?? 0.2, y = H + 0.03 + (l.y || 0);
    const L = O.len(O.sub(l.b, l.a)); const d = O.norm(O.sub(l.b, l.a));
    if (l.dash) {
      for (let s = 0; s < L; s += 1.3) quad(O.add(l.a, O.mul(d, s)), O.add(l.a, O.mul(d, Math.min(L, s + 0.75))), w, col, l.alpha * 0.9, y);
    } else quad(l.a, l.b, w, col, l.alpha * 0.9, y);
    if (l.ticks) {
      const n = [-d[1], d[0]];
      for (let s = 0; s <= L + 1e-6; s += 1) {
        const p = O.add(l.a, O.mul(d, Math.min(s, L))), big = Math.abs(s % 5) < 1e-6 || s >= L;
        quad(O.add(p, O.mul(n, big ? 0.7 : 0.35)), O.add(p, O.mul(n, big ? -0.7 : -0.35)), 0.09, col, l.alpha * 0.9, y);
      }
    }
  }
  for (const a of ov.arcs || []) {
    if (!(a.alpha > 0.01)) continue;
    const col = OVC[a.col] || OVC.g, steps = Math.max(6, Math.ceil((a.a1 - a.a0) / 3));
    for (let k = 0; k < steps; k++) {
      const t0 = a.a0 + (a.a1 - a.a0) * k / steps, t1 = a.a0 + (a.a1 - a.a0) * (k + 1) / steps;
      quad(O.add(a.c, O.mul(O.dirOf(t0), a.r)), O.add(a.c, O.mul(O.dirOf(t1), a.r)), 0.26, col, a.alpha, H + 0.05);
    }
    // a light fill of the angle
    for (let k = 0; k < steps; k++) {
      const t0 = a.a0 + (a.a1 - a.a0) * k / steps, t1 = a.a0 + (a.a1 - a.a0) * (k + 1) / steps;
      const q = [a.c, O.add(a.c, O.mul(O.dirOf(t0), a.r)), O.add(a.c, O.mul(O.dirOf(t1), a.r))];
      for (const p of q) { P.push(p[0], H + 0.04, p[1]); C.push(col[0], col[1], col[2], a.alpha * 0.16); }
    }
  }
  ovGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  ovGeo.setAttribute('color', new THREE.Float32BufferAttribute(C, 4));
  ovGeo.computeBoundingSphere();
}
const labelsEl = document.getElementById('labels');
const labelPool = new Map();
function setLabels(list) {
  const seen = new Set();
  list.forEach((l, k) => {
    const id = l.key || 'l' + k; seen.add(id);
    let el = labelPool.get(id);
    if (!el) { el = document.createElement('div'); el.className = 'lb'; labelsEl.appendChild(el); labelPool.set(id, el); }
    if (el.textContent !== l.text) el.textContent = l.text;
    el.classList.toggle('small', !!l.small);
    let col = CSSC[l.col] || '#ddd';
    if (l.col === 'nm') { const c = O.wavelengthRGB(l.nm); col = `rgb(${Math.round(Math.min(1, c[0] * 1.1 + 0.15) * 255)},${Math.round(Math.min(1, c[1] * 1.1 + 0.15) * 255)},${Math.round(Math.min(1, c[2] * 1.1 + 0.15) * 255)})`; }
    el.style.color = col;
    el._p = l.p; el._a = l.alpha; el._y = l.y ?? H + 0.6;
  });
  for (const [id, el] of labelPool) if (!seen.has(id)) { el.remove(); labelPool.delete(id); }
}
const _v = new THREE.Vector3();
function placeLabels() {
  const W = innerWidth, Hh = innerHeight, top = ui.topH + 4, bot = Hh - ui.botH - 4;
  for (const el of labelPool.values()) {
    if (!(el._a > 0.02)) { el.style.display = 'none'; continue; }
    _v.set(el._p[0], el._y, el._p[1]).project(camera);
    if (_v.z > 1) { el.style.display = 'none'; continue; }
    el.style.display = 'block';
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = (_v.x * 0.5 + 0.5) * W, y = (-_v.y * 0.5 + 0.5) * Hh;
    x = Math.max(8 + w / 2, Math.min(W - 8 - w / 2, x));
    y = Math.max(top + h / 2, Math.min(bot - h / 2, y));
    el.style.transform = `translate(${(x - w / 2).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px)`;
    el.style.opacity = Math.min(1, el._a).toFixed(2);
  }
}
// marks: ghost ring, focus
const ringMark = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), new THREE.MeshBasicMaterial({ color: 0xb7c0cb, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
ringMark.renderOrder = 7; scene.add(ringMark);
const focusMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: spotTex, color: 0xffe066, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false }));
focusMark.renderOrder = 9; scene.add(focusMark);

// ------------------------------------------------------------------ experiment objects
let world = null; // { group, objs: Map(id -> Object3D) }
function buildWorld(e) {
  if (world) { scene.remove(world.group); world.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const group = new THREE.Group(); scene.add(group);
  const objs = new Map();
  const m0 = EXPS[e].build(stepParams(e, 0));
  for (const o of m0.objs) {
    let g;
    if (o.kind === 'laser') g = makeLaser();
    else if (o.kind === 'lamp') g = makeLamp();
    else if (o.kind === 'raybox') g = makeRaybox(o.beams);
    else if (o.kind === 'mirror') g = makeMirror(o.size, m0.objs.find((x) => x.kind === 'stage')?.top ?? H - 3.4);
    else if (o.kind === 'stage') g = makeStage(o);
    else if (o.kind === 'screen') g = makeScreen(o);
    else if (o.kind === 'arcScreen') g = makeArcScreen(o);
    else if (o.kind === 'glass') g = makeGlass(o);
    if (!g) continue;
    group.add(g); objs.set(o.id, g);
  }
  world = { group, objs, e };
}
function setAlpha(g, a) {
  g.visible = a > 0.01;
  if (g.userData.mats) for (const m of g.userData.mats) { m.opacity = a; m.depthWrite = a > 0.98; }
}
function poseWorld(model) {
  for (const o of model.objs) {
    const g = world.objs.get(o.id); if (!g) continue;
    if (o.kind === 'stage') {
      g.position.set(o.c[0], 0, o.c[1]);
      g.userData.disk.rotation.y = -(o.rot || 0) * DEG;
      setAlpha(g, o.alpha ?? 1);
    } else if (o.kind === 'arcScreen') { setAlpha(g, o.alpha ?? 1); }
    else if (o.kind === 'glass') {
      g.position.set(o.c[0], H + (o.lift || 0), o.c[1]); g.rotation.y = -(o.rot || 0) * DEG;
      g.visible = (o.alpha ?? 1) > 0.01;
      if (g.userData.post) g.userData.post.position.y = -H - (o.lift || 0);
    } else {
      const pos = o.pos || o.c;
      g.position.set(pos[0], H, pos[1]); g.rotation.y = -(o.ang || 0) * DEG;
      if (o.alpha !== undefined) g.visible = o.alpha > 0.01;
      if (g.userData.on) g.userData.on(o.on ?? 0);
    }
  }
}
// draw rays from a model
function drawModel(model, p) {
  nBeam = 0; nSpot = 0; nGlint = 0;
  const segsForDust = [];
  const maxS = Math.max(1, ...model.traces.map((t) => Math.max(...t.res.segs.map((s) => s.s1))));
  const reveal = (p.on ?? 0) >= 0.999 ? 1e9 : (p.on ?? 0) * Math.min(maxS, 120);
  const white = !!model.white;
  model.traces.forEach((t, ti) => {
    const rgb = white ? bandRGB[ti] : RED;
    for (const s of t.res.segs) {
      if (s.s0 >= reveal) continue;
      const f = Math.min(1, (reveal - s.s0) / (s.s1 - s.s0));
      const b = O.add(s.a, O.mul(O.sub(s.b, s.a), f));
      const k = Math.sqrt(s.I) * (s.inside >= 0 ? 1.25 : 1) * (white ? 0.45 : model.traces.length > 1 ? 0.6 : 1);
      pushBeam(s.a, b, rgb, k);
      segsForDust.push({ a: s.a, b, rgb, k: k * (white ? 0.55 : 1) });
    }
    for (const h of t.res.hits) {
      if (h.s > reveal) continue;
      if (white && model.fine && h.screen === 'screenA') continue; // drawn as a continuous band
      pushSpot(h.p, h.n, rgb, white ? 2.0 : 1.5, Math.sqrt(h.I) * (white ? 1.6 : 3.0));
      pushSpot(h.p, h.n, rgb, white ? 4.2 : 3.6, Math.sqrt(h.I) * (white ? 0.5 : 0.8));
    }
    if (!white) for (const ev of t.res.events) if (ev.s <= reveal && ev.kind !== 'partial') pushGlint(ev.p, rgb, 0.9, 1.4);
  });
  coreMesh.count = nBeam; glowMesh.count = nBeam;
  coreMesh.instanceMatrix.needsUpdate = glowMesh.instanceMatrix.needsUpdate = true;
  coreMesh.instanceColor.needsUpdate = glowMesh.instanceColor.needsUpdate = true;
  for (let k = nSpot; k < spotPool.length; k++) spotPool[k].visible = false;
  for (let k = nGlint; k < glintPool.length; k++) glintPool[k].visible = false;
  // spectrum band
  if (white && model.fine && reveal > 1) {
    const hs = model.fine.map((f, k) => ({ h: f.res.hits.find((x) => x.screen === 'screenA'), k }));
    const P = [], C = [];
    for (let j = 0; j < hs.length - 1; j++) {
      const A = hs[j], B = hs[j + 1]; if (!A.h || !B.h || A.h.s > reveal) continue;
      const na = A.h.n, ca = fineRGB[A.k], cb = fineRGB[B.k];
      const pa = O.add(A.h.p, O.mul(na, 0.1)), pb = O.add(B.h.p, O.mul(na, 0.1));
      const span = O.len(O.sub(pb, pa));
      const ext = Math.max(0, 0.06 - span) / 2; // keep the band continuous
      const d = O.norm(O.sub(pb, pa));
      const a2 = O.sub(pa, O.mul(d, ext)), b2 = O.add(pb, O.mul(d, ext));
      const kk = 1.15 / Math.max(0.12, span * 6);
      for (const [hh, al] of [[0.95, 1], [2.2, 0.28]]) {
        const v = [[a2, H - hh, ca], [b2, H - hh, cb], [b2, H + hh, cb], [a2, H + hh, ca]];
        for (const q of [0, 1, 2, 0, 2, 3]) { P.push(v[q][0][0], v[q][1], v[q][0][1]); C.push(v[q][2][0] * kk * al, v[q][2][1] * kk * al, v[q][2][2] * kk * al); }
      }
    }
    specGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    specGeo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    specMesh.visible = P.length > 0;
  } else specMesh.visible = false;
  // dust uniforms
  segsForDust.sort((x, y) => y.k * O.len(O.sub(y.b, y.a)) - x.k * O.len(O.sub(x.b, x.a)));
  const n = Math.min(NSEG, segsForDust.length);
  for (let k = 0; k < n; k++) {
    const s = segsForDust[k];
    dust.uniforms.uSeg.value[k].set(s.a[0], s.a[1], s.b[0], s.b[1]);
    dust.uniforms.uCol.value[k].set(s.rgb[0] * s.k, s.rgb[1] * s.k, s.rgb[2] * s.k);
  }
  dust.uniforms.uN.value = n;
  // overlays + marks
  buildOverlays(model.ov);
  const ring = (model.ov.marks || []).find((m) => m.kind === 'ring');
  ringMark.visible = !!ring && ring.alpha > 0.01;
  if (ring) { ringMark.position.set(ring.p[0], H, ring.p[1]); ringMark.lookAt(ring.p[0] - 1, H, ring.p[1]); ringMark.material.opacity = ring.alpha * 0.9; }
  const fm = (model.ov.marks || []).find((m) => m.kind === 'focus');
  focusMark.visible = !!fm && fm.alpha > 0.01;
  if (fm) { focusMark.position.copy(V3(fm.p)); focusMark.scale.setScalar(2.6); focusMark.material.opacity = fm.alpha; }
  const labs = [...(model.ov.labels || [])];
  for (const a of model.ov.arcs || []) if (a.label) labs.push({ p: a.lp, text: a.label, col: a.col, alpha: a.alpha, key: 'arc' + a.col + a.label.split('=')[0] });
  setLabels(labs);
}

// ------------------------------------------------------------------ camera framing + drag orbit
const camState = { pos: new THREE.Vector3(0, 60, 60), tgt: new THREE.Vector3(0, H, 0), goalPos: new THREE.Vector3(), goalTgt: new THREE.Vector3(), yaw: 0, pitch: 0, zoom: 1 };
const ui = { topH: 80, botH: 150 };
function measureUI() {
  ui.topH = document.getElementById('ttl').getBoundingClientRect().bottom + 6;
  ui.botH = innerHeight - document.getElementById('cap').getBoundingClientRect().top + 4;
}
function frameGoal(model, e) {
  const W = innerWidth, Hh = innerHeight, portrait = Hh > W * 1.05;
  const v = EXPS[e].view;
  const az = (portrait ? v.azP : v.az) + camState.yaw, el = Math.max(18, Math.min(84, (portrait ? v.elP : v.el) + camState.pitch));
  const pts = [];
  for (const q of model.frame) { pts.push(new THREE.Vector3(q[0], 0.5, q[1])); pts.push(new THREE.Vector3(q[0], H + 3, q[1])); }
  const box = new THREE.Box3().setFromPoints(pts);
  const tgt = box.getCenter(new THREE.Vector3());
  const back = new THREE.Vector3(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), Math.cos(az * DEG) * Math.cos(el * DEG));
  const fwd = back.clone().negate();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const upv = new THREE.Vector3().crossVectors(right, fwd);
  const freeH = Math.max(120, Hh - ui.topH - ui.botH);
  const tanV = Math.tan(camera.fov * DEG / 2) * (freeH / Hh) * 0.94;
  const tanH = Math.tan(camera.fov * DEG / 2) * (W / Hh) * 0.92;
  let dist = 10;
  for (const p of pts) {
    const q = p.clone().sub(tgt);
    const x = q.dot(right), y = q.dot(upv), z = q.dot(back);
    dist = Math.max(dist, z + Math.abs(x) / tanH, z + Math.abs(y) / tanV);
  }
  dist *= camState.zoom;
  camState.goalTgt.copy(tgt);
  camState.goalPos.copy(tgt).addScaledVector(back, dist);
}
function applyViewOffset() {
  const W = innerWidth, Hh = innerHeight;
  const s = (ui.topH - ui.botH) / 2;
  camera.setViewOffset(W, Hh, 0, -s, W, Hh);
}
{
  let drag = null;
  canvas.addEventListener('pointerdown', (ev) => { drag = { x: ev.clientX, y: ev.clientY, yaw: camState.yaw, pitch: camState.pitch }; canvas.setPointerCapture(ev.pointerId); });
  canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    camState.yaw = Math.max(-40, Math.min(40, drag.yaw - (ev.clientX - drag.x) * 0.25));
    camState.pitch = Math.max(-25, Math.min(20, drag.pitch + (ev.clientY - drag.y) * 0.18));
    needFrame = true;
  });
  const end = () => { drag = null; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (ev) => { ev.preventDefault(); camState.zoom = Math.max(0.6, Math.min(1.4, camState.zoom * (1 + Math.sign(ev.deltaY) * 0.06))); needFrame = true; }, { passive: false });
}

// ------------------------------------------------------------------ step player
const capEl = document.getElementById('cap'), exEl = document.getElementById('exname'), progEl = document.getElementById('prog');
const nextBtn = document.getElementById('next'), backBtn = document.getElementById('back'), fadeEl = document.getElementById('fade');
const S = { e: 0, k: 0, p: null, from: null, to: null, t0: 0, dur: 1, animating: false, model: null, finalModel: null, caption: '' };
let needFrame = true;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function lerpParams(a, b, t) {
  const o = {};
  for (const k of Object.keys(b)) o[k] = (a[k] ?? b[k]) + (b[k] - (a[k] ?? b[k])) * (k === 'on' ? t : ease(t));
  return o;
}
function setTexts() {
  const ex = EXPS[S.e];
  exEl.textContent = ex.title;
  progEl.textContent = `Experiment ${S.e + 1} of ${EXPS.length} · Step ${S.k + 1} of ${ex.steps.length}`;
  S.finalModel = ex.build(S.to);
  S.caption = ex.steps[S.k].text(readouts(S.finalModel.num));
  capEl.textContent = S.caption;
  capEl.classList.remove('anim'); void capEl.offsetWidth; capEl.classList.add('anim');
  backBtn.disabled = S.e === 0 && S.k === 0;
  const last = S.e === EXPS.length - 1 && S.k === ex.steps.length - 1;
  nextBtn.textContent = last ? 'Start again ↺' : (S.k === ex.steps.length - 1 ? 'Next experiment ›' : 'Next ›');
  measureUI();
}
function go(e, k, instant = false) {
  const changeExp = !world || world.e !== e;
  const to = stepParams(e, k);
  const doIt = () => {
    if (changeExp) { buildWorld(e); camState.yaw = 0; camState.pitch = 0; camState.zoom = 1; }
    S.e = e; S.k = k; S.to = to;
    S.from = changeExp || instant || !S.p ? { ...to } : { ...S.p };
    S.t0 = performance.now();
    const moving = Object.keys(to).some((key) => Math.abs((S.from[key] ?? 0) - to[key]) > 1e-9);
    S.dur = moving ? 1700 : 1;
    S.animating = true;
    if (!changeExp) { camState.yaw *= 0.0; camState.pitch *= 0.0; }
    setTexts();
    frameGoal(S.finalModel, e);
    if (changeExp || instant) { camState.pos.copy(camState.goalPos); camState.tgt.copy(camState.goalTgt); }
    needFrame = true;
  };
  if (changeExp && world && !instant) {
    fadeEl.style.opacity = 1;
    setTimeout(() => { doIt(); setTimeout(() => { fadeEl.style.opacity = 0; }, 60); }, 360);
  } else doIt();
}
function next() {
  music.start(); music.blip();
  const ex = EXPS[S.e];
  if (S.k < ex.steps.length - 1) go(S.e, S.k + 1);
  else if (S.e < EXPS.length - 1) go(S.e + 1, 0);
  else go(0, 0);
}
function back() {
  music.start(); music.blip(0.7);
  if (S.k > 0) go(S.e, S.k - 1);
  else if (S.e > 0) go(S.e - 1, EXPS[S.e - 1].steps.length - 1);
}
nextBtn.addEventListener('click', next);
backBtn.addEventListener('click', back);
addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); next(); }
  if (ev.key === 'ArrowLeft') { ev.preventDefault(); back(); }
});

// ------------------------------------------------------------------ music
const music = new Music();
const muteBtn = document.getElementById('mute');
const ICON_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a8 8 0 0 1 0 11"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
try { music.muted = localStorage.getItem('opticsLabMute') === '1'; } catch (_) { /* storage blocked */ }
const showMute = () => { muteBtn.innerHTML = music.muted ? ICON_OFF : ICON_ON; muteBtn.setAttribute('aria-pressed', String(music.muted)); };
showMute();
muteBtn.addEventListener('click', () => {
  music.setMuted(!music.muted); showMute();
  try { localStorage.setItem('opticsLabMute', music.muted ? '1' : '0'); } catch (_) { /* ignore */ }
});
canvas.addEventListener('pointerdown', () => music.start(), { once: true });

// ------------------------------------------------------------------ resize + loop
function resize() {
  const W = innerWidth, Hh = innerHeight;
  renderer.setSize(W, Hh, false);
  composer.setSize(W, Hh);
  bloom.setSize(Math.round(W / 2), Math.round(Hh / 2));
  camera.aspect = W / Hh;
  camera.fov = Hh > W * 1.05 ? 44 : 36;
  measureUI();
  applyViewOffset();
  camera.updateProjectionMatrix();
  dust.uniforms.uScale.value = Hh * renderer.getPixelRatio() / Math.tan(camera.fov * DEG / 2) * 0.5;
  if (S.finalModel) frameGoal(S.finalModel, S.e);
  needFrame = true;
}
addEventListener('resize', resize);

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.animating) {
    const t = Math.min(1, (now - S.t0) / S.dur);
    S.p = lerpParams(S.from, S.to, t);
    S.model = EXPS[S.e].build(S.p);
    poseWorld(S.model); drawModel(S.model, S.p);
    if (t >= 1) { S.animating = false; S.p = { ...S.to }; }
  }
  if (needFrame && S.finalModel) { frameGoal(S.finalModel, S.e); needFrame = false; }
  // smooth camera
  const k = 1 - Math.exp(-dt * 3.2);
  camState.pos.lerp(camState.goalPos, k); camState.tgt.lerp(camState.goalTgt, k);
  camera.position.copy(camState.pos); camera.lookAt(camState.tgt);
  dust.uniforms.uT.value = now / 1000;
  composer.render(dt);
  placeLabels();
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------ test hooks
window.__lab = {
  go: (e, k) => go(e, k, true),
  info: () => ({ e: S.e, k: S.k, nE: EXPS.length, nK: EXPS[S.e].steps.length, animating: S.animating, cam: camState.pos.distanceTo(camState.goalPos) }),
  steps: () => EXPS.map((x) => x.steps.length),
  dump: () => {
    const m = S.finalModel;
    const strip = (ev) => ({ type: ev.type, obj: ev.obj, kind: ev.kind, p: ev.p, n: ev.n, din: ev.din, dout: ev.dout, n1: ev.n1, n2: ev.n2, i: ev.i, r: ev.r });
    return {
      e: S.e, k: S.k, id: EXPS[S.e].id, params: S.to, num: m.num, caption: S.caption,
      labels: [...labelPool.values()].filter((el) => el.style.display !== 'none' && el._a > 0.5).map((el) => el.textContent),
      traces: m.traces.map((t) => ({ lambda: t.src.lambda, src: t.src, events: t.res.events.map(strip), hits: t.res.hits.map((h) => ({ screen: h.screen, p: h.p })) })),
    };
  },
};

// ------------------------------------------------------------------ start
resize();
const m = /e=(\d+)&s=(\d+)/.exec(location.hash);
go(m ? Math.min(EXPS.length - 1, +m[1] - 1) : 0, m ? +m[2] - 1 : 0, true);
requestAnimationFrame(loop);
window.__lab.ready = true;
