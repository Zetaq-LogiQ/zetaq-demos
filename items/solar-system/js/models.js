/* Solar System Explorer — ship, astronaut, launch complex and rock models.
   Everything is built in metres (front = -Z, up = +Y) and the root group is scaled to kilometres. */
(function () {
  'use strict';
  const THREE = window.THREE;
  const noise3 = window.SOLTERRAIN.noise3;
  const V2 = THREE.Vector2, V3 = THREE.Vector3, PI = Math.PI, D2R = PI / 180;

  // ------------------------------------------------------------------ small helpers
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    if (repeat) t.repeat.set(repeat, repeat);
    return t;
  }
  function std(color, rough, metal, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: rough, metalness: metal }, extra || {})); }
  function basic(color, extra) { return new THREE.MeshBasicMaterial(Object.assign({ color: color }, extra || {})); }
  function glow(color, extra) { return new THREE.MeshBasicMaterial(Object.assign({ color: color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }, extra || {})); }
  function mesh(geo, mat, x, y, z, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(m); return m; }
  function box(w, h, d, mat, x, y, z, parent) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent); }
  function cyl(r1, r2, h, seg, mat, x, y, z, parent, open) { return mesh(new THREE.CylinderGeometry(r1, r2, h, seg, 1, !!open), mat, x, y, z, parent); }
  const _a = new V3(), _b = new V3(), _up = new V3(0, 1, 0);
  // thin strut between two points
  function strut(p, q, r, mat, parent, seg) {
    _a.set(p[0], p[1], p[2]); _b.set(q[0], q[1], q[2]);
    const len = _a.distanceTo(_b), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 6), mat);
    m.position.copy(_a).add(_b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(_up, _b.clone().sub(_a).normalize());
    parent.add(m); return m;
  }
  // rounded limb segment: top joint at y = 0 (radius r1), bottom joint at y = -len (radius r2)
  function limbGeo(r1, r2, len, seg) {
    const pts = [], n = 6;
    for (let i = 0; i <= n; i++) { const a = i / n * PI / 2; pts.push(new V2(Math.max(1e-4, r2 * Math.sin(a)), -len - r2 * Math.cos(a))); }
    for (let i = 0; i <= n; i++) { const a = i / n * PI / 2; pts.push(new V2(Math.max(1e-4, r1 * Math.cos(a)), r1 * Math.sin(a))); }
    return new THREE.LatheGeometry(pts, seg || 16);
  }
  function roundRect(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function roundBox(w, h, d, r, bev) { // centred on x/y, spans z = 0 .. d
    const b = bev === undefined ? Math.min(r, d * 0.3) : bev;
    const g = new THREE.ExtrudeGeometry(roundRect(w - 2 * b, h - 2 * b, Math.max(0.001, r - b)), { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, b); return g;
  }
  function tube(pts, r, mat, parent, seg) {
    const c = new THREE.CatmullRomCurve3(pts.map(function (p) { return new V3(p[0], p[1], p[2]); }));
    return mesh(new THREE.TubeGeometry(c, seg || 20, r, 7, false), mat, 0, 0, 0, parent);
  }

  // ------------------------------------------------------------------ reflections
  const envMats = []; let envTex = null, envK = 1;
  function shiny(color, rough, metal, envI, extra) {
    const m = std(color, rough, metal, extra); m.userData.envI = envI; envMats.push(m);
    if (envTex) { m.envMap = envTex; m.envMapIntensity = envI * envK; }
    return m;
  }
  function ensureEnv(renderer) {
    renderer = renderer || (window.SIM && window.SIM.renderer);
    if (envTex || !renderer) return;
    try {
      const src = canvasTex(512, 256, function (g, w, h) {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#04060b'); gr.addColorStop(0.36, '#0e1524'); gr.addColorStop(0.47, '#5f7190'); gr.addColorStop(0.5, '#e9eef5');
        gr.addColorStop(0.53, '#a39683'); gr.addColorStop(0.7, '#5a5148'); gr.addColorStop(1, '#231f1b');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        [[150, 62, 44], [150 + 512, 62, 44], [400, 96, 16]].forEach(function (s) {
          const rg = g.createRadialGradient(s[0], s[1], 0, s[0], s[1], s[2]);
          rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,250,235,0.9)'); rg.addColorStop(1, 'rgba(255,240,210,0)');
          g.fillStyle = rg; g.fillRect(s[0] - s[2], s[1] - s[2], s[2] * 2, s[2] * 2);
        });
      });
      src.wrapS = src.wrapT = THREE.ClampToEdgeWrapping; src.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(renderer);
      envTex = pm.fromEquirectangular(src).texture; pm.dispose(); src.dispose();
    } catch (e) { envTex = null; return; }
    envMats.forEach(function (m) { m.envMap = envTex; m.envMapIntensity = m.userData.envI * envK; m.needsUpdate = true; });
  }
  // scale all reflections (e.g. with daylight) — 0 = none, 1 = as authored
  function setEnvIntensity(k) { envK = k; for (let i = 0; i < envMats.length; i++) envMats[i].envMapIntensity = envMats[i].userData.envI * k; }

  // ------------------------------------------------------------------ textures (built once)
  let TX = null;
  function textures() {
    if (TX) return TX;
    TX = {};
    // white hull: 4 m per repeat, panel seams + a little tone variation
    TX.hull = canvasTex(512, 512, function (g, w, h) {
      const r = rng(11);
      g.fillStyle = '#dcdfe4'; g.fillRect(0, 0, w, h);
      const cols = [0, 70, 128, 200, 256, 330, 384, 452, 512], rows = [0, 64, 128, 192, 256, 320, 384, 448, 512];
      for (let i = 0; i < cols.length - 1; i++) for (let j = 0; j < rows.length - 1; j++) {
        const v = 214 + Math.floor(r() * 16);
        g.fillStyle = 'rgb(' + v + ',' + (v + 2) + ',' + (v + 6) + ')';
        g.fillRect(cols[i], rows[j], cols[i + 1] - cols[i], rows[j + 1] - rows[j]);
      }
      for (let k = 0; k < 26; k++) { // faint streaks
        const x = r() * w, y = r() * h, l = 30 + r() * 110;
        const gr = g.createLinearGradient(x, y, x + l, y); gr.addColorStop(0, 'rgba(120,125,135,0)'); gr.addColorStop(0.3, 'rgba(120,125,135,0.10)'); gr.addColorStop(1, 'rgba(120,125,135,0)');
        g.fillStyle = gr; g.fillRect(x, y, l, 3 + r() * 5);
      }
      g.strokeStyle = 'rgba(70,78,92,0.55)'; g.lineWidth = 1.6;
      cols.forEach(function (x) { g.beginPath(); g.moveTo(x % w + 0.5, 0); g.lineTo(x % w + 0.5, h); g.stroke(); });
      rows.forEach(function (y) { g.beginPath(); g.moveTo(0, y % h + 0.5); g.lineTo(w, y % h + 0.5); g.stroke(); });
      g.fillStyle = 'rgba(60,66,78,0.5)';
      for (let i = 0; i < cols.length - 1; i++) for (let j = 0; j < rows.length - 1; j++) { g.fillRect(cols[i] + 5, rows[j] + 5, 2, 2); g.fillRect(cols[i + 1] - 7, rows[j] + 5, 2, 2); }
    }, 0.25);
    // black thermal tiles: 1 m per repeat
    TX.tile = canvasTex(256, 256, function (g, w, h) {
      const r = rng(5);
      g.fillStyle = '#2b2e35'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        const v = 20 + Math.floor(r() * 16) + (r() < 0.06 ? 20 : 0);
        g.fillStyle = 'rgb(' + v + ',' + (v + 1) + ',' + (v + 4) + ')';
        g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30);
      }
    }, 1);
    // suit fabric: fine weave for bump + faint soil
    TX.fabric = canvasTex(128, 128, function (g, w, h) {
      const r = rng(3), img = g.createImageData(w, h);
      for (let i = 0; i < w * h; i++) { const x = i % w, y = (i / w) | 0; const v = 196 + ((x + y) % 2 ? 14 : 0) + ((x % 4 === 0 || y % 4 === 0) ? -18 : 0) + r() * 26; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
    }, 1);
    TX.plume = canvasTex(8, 128, function (g, w, h) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#000000'); gr.addColorStop(0.45, '#12305e'); gr.addColorStop(0.8, '#5aa8ff'); gr.addColorStop(1, '#f2fbff');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    TX.bell = canvasTex(8, 64, function (g, w, h) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#2a1208'); gr.addColorStop(0.5, '#a0380c'); gr.addColorStop(0.85, '#ff9a3c'); gr.addColorStop(1, '#fff0c8');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    TX.blob = canvasTex(128, 128, function (g, w, h) {
      const rg = g.createRadialGradient(64, 64, 6, 64, 64, 64);
      rg.addColorStop(0, 'rgba(0,0,0,0.62)'); rg.addColorStop(0.55, 'rgba(0,0,0,0.38)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
    });
    return TX;
  }
  function blobShadow(w, d) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: textures().blob, transparent: true, depthWrite: false, color: 0x000000 }));
    m.rotation.x = -PI / 2; m.visible = false; m.renderOrder = 1; return m;
  }

  // ------------------------------------------------------------------ lofted hull
  // stations: [{z, w, ht, hb, y}] ; cross-section is a superellipse with separate top/bottom heights
  function makeHull(st, o) {
    const z0 = st[0].z, z1 = st[st.length - 1].z, Ln = o.nose, nt = o.nt, nb = o.nb;
    function hermite(key, z) {
      let i = 0; while (i < st.length - 2 && z > st[i + 1].z) i++;
      const a = st[i], b = st[i + 1], dz = b.z - a.z, t = Math.min(1, Math.max(0, (z - a.z) / dz));
      const pa = st[i - 1] || a, nb2 = st[i + 2] || b;
      const m1 = (b[key] - pa[key]) / (b.z - pa.z), m2 = (nb2[key] - a[key]) / (nb2.z - a.z);
      const t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * a[key] + (t3 - 2 * t2 + t) * dz * m1 + (-2 * t3 + 3 * t2) * b[key] + (t3 - t2) * dz * m2;
    }
    function point(z, th, out) {
      const u = Math.min(1, Math.max(0, (z - z0) / Ln)), f = Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u)));
      const w = hermite('w', z) * f, c = Math.cos(th), s = Math.sin(th), n = s >= 0 ? nt : nb;
      const hh = (s >= 0 ? hermite('ht', z) : hermite('hb', z)) * f;
      return out.set(w * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), hermite('y', z) + hh * Math.sign(s) * Math.pow(Math.abs(s), 2 / n), z);
    }
    const p0 = new V3(), p1 = new V3(), p2 = new V3();
    function surf(z, th, off, out, nrm) {
      point(z, th, p0); point(z, th + 0.01, p1); point(Math.min(z1, z + 0.02) === z ? z - 0.02 : z + 0.02, th, p2);
      p1.sub(p0); p2.sub(p0); if (z + 0.02 > z1) p2.multiplyScalar(-1);
      p1.cross(p2).normalize();
      if (nrm) nrm.copy(p1);
      return out.copy(p0).addScaledVector(p1, off || 0);
    }
    // rings: dense near the nose tip, then even
    const zs = [], nN = 12; for (let k = 0; k <= nN; k++) zs.push(z0 + Ln * Math.pow(k / nN, 2));
    const nR = Math.ceil((z1 - z0 - Ln) / 0.36); for (let k = 1; k <= nR; k++) zs.push(z0 + Ln + (z1 - z0 - Ln) * k / nR);
    const N = o.seg || 44, pos = [], uv = [], v = new V3(), q = new V3();
    for (let i = 0; i < zs.length; i++) {
      let arc = 0;
      for (let j = 0; j <= N; j++) {
        const th = j / N * PI * 2; point(zs[i], th, v);
        if (j > 0) arc += v.distanceTo(q); q.copy(v);
        pos.push(v.x, v.y, v.z); uv.push(zs[i], arc);
      }
    }
    const top = [], belly = [], cap = [];
    for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < N; j++) {
      const a = i * (N + 1) + j, b = a + 1, c = a + N + 1, d = c + 1;
      const dark = Math.sin((j + 0.5) / N * PI * 2) < o.split || zs[i + 1] <= z0 + o.cap + 1e-6;
      (dark ? belly : top).push(a, b, c, b, d, c);
    }
    const base = pos.length / 3, last = (zs.length - 1) * (N + 1);
    pos.push(0, hermite('y', z1), z1); uv.push(0.5, 0.5);
    for (let j = 0; j <= N; j++) { pos.push(pos[(last + j) * 3], pos[(last + j) * 3 + 1], z1); uv.push(pos[(last + j) * 3] * 0.2 + 0.5, pos[(last + j) * 3 + 1] * 0.2 + 0.5); }
    for (let j = 0; j < N; j++) cap.push(base, base + 1 + j, base + 2 + j);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(top.concat(belly, cap));
    g.addGroup(0, top.length, 0); g.addGroup(top.length, belly.length, 1); g.addGroup(top.length + belly.length, cap.length, 2);
    g.computeVertexNormals();
    const nm = g.attributes.normal; // weld the seam normals
    for (let i = 0; i < zs.length; i++) {
      const a = i * (N + 1), b = a + N, x = nm.getX(a) + nm.getX(b), y = nm.getY(a) + nm.getY(b), z = nm.getZ(a) + nm.getZ(b), l = 1 / Math.sqrt(x * x + y * y + z * z);
      nm.setXYZ(a, x * l, y * l, z * l); nm.setXYZ(b, x * l, y * l, z * l);
    }
    // a patch that hugs the hull: z range, angle range (radians), stand-off distance
    function patch(za, zb, ta, tb, off, nz, nt2) {
      nz = nz || Math.max(2, Math.ceil(Math.abs(zb - za) / 0.3)); nt2 = nt2 || Math.max(2, Math.ceil(Math.abs(tb - ta) / 0.12));
      const P = [], U = [], I = [];
      for (let i = 0; i <= nz; i++) for (let j = 0; j <= nt2; j++) { surf(za + (zb - za) * i / nz, ta + (tb - ta) * j / nt2, off, v); P.push(v.x, v.y, v.z); U.push(i / nz, j / nt2); }
      for (let i = 0; i < nz; i++) for (let j = 0; j < nt2; j++) { const a = i * (nt2 + 1) + j, b = a + 1, c = a + nt2 + 1, d = c + 1; I.push(a, b, c, b, d, c); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); pg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); pg.setIndex(I); pg.computeVertexNormals();
      return pg;
    }
    return { geo: g, surf: surf, patch: patch, half: function (key, z) { return hermite(key, z); } };
  }

  // ------------------------------------------------------------------ spaceship
  function buildShip() {
    ensureEnv();
    const T = textures();
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const white = shiny(0xffffff, 0.5, 0.05, 0.22, { map: T.hull, bumpMap: T.hull, bumpScale: 5e-6, emissive: 0x5a5c60, emissiveIntensity: 0.16 });
    const tile = shiny(0xffffff, 0.62, 0.1, 0.25, { map: T.tile, bumpMap: T.tile, bumpScale: 4e-6 });
    const tileD = shiny(0xffffff, 0.62, 0.1, 0.25, { map: T.tile, side: THREE.DoubleSide });
    const dark = shiny(0x2a2e36, 0.55, 0.5, 0.4), steel = shiny(0x8a9099, 0.32, 0.85, 0.9), chrome = shiny(0xc8ccd2, 0.16, 1.0, 1.0);
    const rcc = shiny(0x3a3e46, 0.4, 0.3, 0.5), accent = std(0xf2861c, 0.5, 0.1, { side: THREE.DoubleSide });
    const glass = shiny(0x0a121e, 0.06, 0.9, 1.25, { side: THREE.DoubleSide, emissive: 0x0b1626, emissiveIntensity: 0.5 });
    const lit = std(0x2a2418, 0.3, 0.2, { emissive: 0xffd9a0, emissiveIntensity: 0.95, side: THREE.DoubleSide });
    const seam = basic(0x2c313a, { side: THREE.DoubleSide });
    const whiteD = std(0xe9ecf0, 0.5, 0.05, { side: THREE.DoubleSide });

    // --- fuselage
    const H = makeHull([
      { z: -6.5, w: 0.80, ht: 0.66, hb: 0.52, y: -0.14 }, { z: -4.4, w: 1.30, ht: 0.98, hb: 0.64, y: -0.04 }, { z: -2.5, w: 1.62, ht: 1.22, hb: 0.72, y: 0 },
      { z: -0.5, w: 1.80, ht: 1.30, hb: 0.76, y: 0 }, { z: 2.0, w: 1.86, ht: 1.28, hb: 0.76, y: 0 }, { z: 4.0, w: 1.78, ht: 1.14, hb: 0.72, y: 0.02 }, { z: 5.4, w: 1.58, ht: 0.96, hb: 0.62, y: 0.05 }
    ], { nose: 2.3, nt: 2.3, nb: 3.4, split: -0.06, cap: 0.42, seg: 48 });
    body.add(new THREE.Mesh(H.geo, [white, tile, dark]));
    const P = function (za, zb, da, db, off, mat, nz, nt) { const m = new THREE.Mesh(H.patch(za, zb, da * D2R, db * D2R, off, nz, nt), mat); body.add(m); return m; };
    // windshield: four panes wrapped over the nose + two eyebrow windows
    [[38, 61], [65, 88.5], [91.5, 115], [119, 142]].forEach(function (a) { P(-5.5, -4.62, a[0], a[1], 0.012, glass, 6, 5); });
    P(-5.56, -4.56, 34, 146, 0.006, seam, 6, 16);
    [[62, 86], [94, 118]].forEach(function (a) { P(-4.38, -3.86, a[0], a[1], 0.012, glass, 4, 4); });
    P(-4.43, -3.81, 59, 121, 0.006, seam, 4, 8);
    // cabin windows (lit) both sides
    [[-1.95, -1.5], [-1.2, -0.75], [-0.45, 0.0]].forEach(function (zz) {
      [[21, 33], [147, 159]].forEach(function (a) { P(zz[0] - 0.05, zz[1] + 0.05, a[0] - 1.5, a[1] + 1.5, 0.006, seam, 3, 3); P(zz[0], zz[1], a[0], a[1], 0.012, lit, 3, 3); });
    });
    // payload-bay door seams, accent band, name
    [[89.6, 90.4], [37.6, 38.4], [141.6, 142.4]].forEach(function (a) { P(-1.0, 3.7, a[0], a[1], 0.006, seam, 16, 1); });
    [-1.0, 1.35, 3.7].forEach(function (z) { P(z - 0.018, z + 0.018, 38, 142, 0.006, seam, 1, 20); });
    P(0.42, 0.74, 3, 177, 0.008, accent, 2, 40);
    P(0.80, 0.86, 3, 177, 0.008, std(0x20242b, 0.5, 0.1, { side: THREE.DoubleSide }), 1, 40);
    const nameTex = function (flip) {
      return canvasTex(512, 96, function (c, w, h) {
        c.clearRect(0, 0, w, h); c.save(); if (flip) { c.translate(w, 0); c.scale(-1, 1); }
        c.fillStyle = '#1c2230'; c.font = '700 64px "Saira", "Arial Narrow", Arial, sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
        c.fillText('E X P L O R E R', w / 2, h / 2 + 4); c.restore();
      });
    };
    // +X side: reading direction runs toward the nose (-Z); -X side: toward the tail
    const nmR = new THREE.MeshBasicMaterial({ map: nameTex(false), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const nmL = new THREE.MeshBasicMaterial({ map: nameTex(true), transparent: true, depthWrite: false, side: THREE.DoubleSide });
    P(4.1, 1.25, 13, 31, 0.014, nmR, 10, 3); P(4.1, 1.25, 167, 149, 0.014, nmL, 10, 3);
    // crew hatch on the left side, with porthole and handle
    P(-3.42, -2.38, 148.5, 179.5, 0.007, seam, 4, 5);
    P(-3.36, -2.44, 150, 178, 0.016, whiteD, 4, 5);
    P(-3.05, -2.75, 158, 167, 0.024, glass, 2, 2);
    const hp = new V3(); H.surf(-2.56, 171 * D2R, 0.05, hp); box(0.04, 0.2, 0.05, steel, hp.x, hp.y, hp.z, body);
    // docking ring + antennas on the spine
    const sp = new V3(), sn = new V3();
    H.surf(-2.75, PI / 2, 0, sp, sn);
    const dock = cyl(0.46, 0.5, 0.2, 24, steel, sp.x, sp.y + 0.06, sp.z, body); dock.quaternion.setFromUnitVectors(_up, sn);
    const dockIn = cyl(0.36, 0.36, 0.22, 20, dark, sp.x, sp.y + 0.07, sp.z, body); dockIn.quaternion.copy(dock.quaternion);
    H.surf(2.3, PI / 2, 0, sp); const blade = box(0.04, 0.42, 0.5, whiteD, 0, sp.y + 0.18, 2.3, body); blade.rotation.x = -0.35;
    H.surf(0.2, PI / 2, 0, sp); cyl(0.2, 0.2, 0.05, 16, whiteD, 0, sp.y + 0.14, 0.2, body); cyl(0.03, 0.03, 0.14, 6, steel, 0, sp.y + 0.06, 0.2, body);
    mesh(new THREE.SphereGeometry(0.07, 10, 8), basic(0xff3b30), 0, sp.y + 0.2, 0.2, body);

    // --- wings (right side built, left side mirrored)
    const wingR = new THREE.Group();
    const plan = [[1.1, -3.3], [1.72, -1.35], [5.5, 3.25], [5.72, 3.9], [5.72, 4.95], [1.1, 5.25]];
    const ws = new THREE.Shape(); plan.forEach(function (p, i) { if (i) ws.lineTo(p[0], p[1]); else ws.moveTo(p[0], p[1]); }); ws.closePath();
    const wg = new THREE.ExtrudeGeometry(ws, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.09, bevelSegments: 3 }); wg.rotateX(PI / 2);
    mesh(wg, [white, rcc], 0, -0.26, 0, wingR);
    const ug = new THREE.ShapeGeometry(ws); ug.rotateX(PI / 2); mesh(ug, tile, 0, -0.546, 0, wingR);
    // elevon seam + actuator fairings
    box(3.9, 0.012, 0.035, seam, 3.55, -0.176, 4.3, wingR); box(0.03, 0.012, 0.9, seam, 3.5, -0.176, 4.78, wingR);
    [2.3, 4.6].forEach(function (x) { const f = mesh(new THREE.SphereGeometry(1, 10, 8), white, x, -0.5, 4.2, wingR); f.scale.set(0.09, 0.09, 0.6); });
    // winglet
    const fs = new THREE.Shape(); [[3.75, 0], [5.02, 0], [5.42, 1.75], [4.82, 1.75]].forEach(function (p, i) { if (i) fs.lineTo(p[0], p[1]); else fs.moveTo(p[0], p[1]); }); fs.closePath();
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 2 }); fg.rotateY(-PI / 2); fg.translate(0.05, 0, 0);
    const fin = new THREE.Group(); fin.position.set(5.66, -0.3, 0); fin.rotation.z = -0.3; wingR.add(fin);
    mesh(fg, [white, rcc], 0, 0, 0, fin);
    const st1 = new THREE.Shape(); [[4.62, 1.2], [5.3, 1.2], [5.4, 1.62], [4.8, 1.62]].forEach(function (p, i) { if (i) st1.lineTo(p[0], p[1]); else st1.moveTo(p[0], p[1]); }); st1.closePath();
    const sg = new THREE.ShapeGeometry(st1); sg.rotateY(-PI / 2);
    mesh(sg, accent, 0.1, 0, 0, fin); mesh(sg, accent, -0.1, 0, 0, fin);
    // OMS pod with thruster quad
    const pod = mesh(new THREE.SphereGeometry(1, 20, 14), white, 1.12, 0.98, 4.05, wingR); pod.scale.set(0.52, 0.42, 1.55);
    cyl(0.16, 0.24, 0.42, 14, steel, 1.12, 0.98, 5.62, wingR, true).rotation.x = PI / 2;
    box(0.3, 0.26, 0.5, dark, 1.6, 0.62, 4.75, wingR);
    [[0.0, 0.16, 0], [0.17, 0.0, 0.15], [0.17, 0.0, -0.15]].forEach(function (p, i) { const n = cyl(0.045, 0.07, 0.1, 8, steel, 1.6 + p[0], 0.62 + p[1], 4.75 + p[2], wingR, true); if (i) n.rotation.z = -PI / 2; });
    // lift-thruster port under the wing
    cyl(0.3, 0.36, 0.1, 16, dark, 2.4, -0.58, 2.9, wingR);
    body.add(wingR);
    const wingL = wingR.clone(); wingL.scale.x = -1; body.add(wingL);
    mesh(new THREE.SphereGeometry(0.075, 10, 8), basic(0x38ff7a), 5.86, -0.36, 3.95, body);
    mesh(new THREE.SphereGeometry(0.075, 10, 8), basic(0xff3838), -5.86, -0.36, 3.95, body);
    // body flap and aft RCS
    box(2.7, 0.09, 0.95, tile, 0, -0.56, 5.78, body).rotation.x = -0.08;
    cyl(0.3, 0.36, 0.1, 16, dark, 0, -0.71, -3.0, body);

    // --- main engines
    const plumes = [];
    const bellProf = []; for (let i = 0; i <= 10; i++) { const t = i / 10; bellProf.push(new V2(0.2 + 0.44 * Math.pow(t, 0.62), t * 1.12)); }
    const bellG = new THREE.LatheGeometry(bellProf, 28); bellG.rotateX(PI / 2);
    const innerProf = bellProf.map(function (p) { return new V2(p.x - 0.015, p.y); }); const innerG = new THREE.LatheGeometry(innerProf, 24); innerG.rotateX(PI / 2);
    const bellMat = shiny(0x6a6e76, 0.3, 0.9, 1.0), innerMat = basic(0x4a4a4a, { map: T.bell, side: THREE.BackSide });
    const plumeProf = [[0.5, 0], [0.56, -0.5], [0.5, -1.4], [0.36, -2.8], [0.18, -4.6], [0.0, -6.4]].map(function (p) { return new V2(Math.max(1e-3, p[0]), p[1]); });
    const plumeG = new THREE.LatheGeometry(plumeProf, 18);
    [-1, 1].forEach(function (s) {
      const x = s * 0.84, y = 0.14;
      cyl(0.3, 0.34, 0.5, 16, dark, x, y, 5.5, body).rotation.x = PI / 2;
      mesh(bellG, bellMat, x, y, 5.5, body); const inner = mesh(innerG, innerMat, x, y, 5.5, body);
      if (s < 0) inner.onBeforeRender = function () { innerMat.color.setScalar(Math.min(1, 0.26 + 1.1 * plumes[0].material.opacity)); };
      mesh(new THREE.TorusGeometry(0.645, 0.022, 6, 28), steel, x, y, 6.62, body);
      mesh(new THREE.TorusGeometry(0.43, 0.02, 6, 24), steel, x, y, 5.95, body);
      const p = mesh(plumeG, glow(0xffffff, { map: T.plume }), x, y, 6.6, body); p.rotation.x = -PI / 2; p.visible = false; plumes.push(p);
      const core = mesh(new THREE.SphereGeometry(0.4, 14, 10), glow(0xbfe2ff), x, y, 6.55, body); core.scale.set(1, 1, 1.8); core.visible = false; plumes.push(core);
    });
    [[0, 0.62], [0, -0.3]].forEach(function (p) { cyl(0.1, 0.16, 0.3, 12, steel, p[0], p[1], 5.55, body, true).rotation.x = PI / 2; });
    mesh(new THREE.TorusGeometry(1.2, 0.03, 6, 40), steel, 0, 0.14, 5.42, body).scale.set(1.12, 0.62, 1);
    mesh(new THREE.SphereGeometry(0.06, 8, 6), basic(0xffffff), 0, 1.0, 5.4, body);

    // --- VTOL lift thrusters
    const lifts = [];
    const liftProf = [[0.26, 0], [0.34, -0.35], [0.3, -1.0], [0.16, -2.0], [0.0, -3.0]].map(function (p) { return new V2(Math.max(1e-3, p[0]), p[1]); });
    const liftG = new THREE.LatheGeometry(liftProf, 14);
    [[0, -0.72, -3.0], [-2.4, -0.6, 2.9], [2.4, -0.6, 2.9]].forEach(function (p) {
      const lm = mesh(liftG, glow(0xffd9a8, { map: T.plume }), p[0], p[1], p[2], body); lm.visible = false; lifts.push(lm);
    });

    // --- landing gear, ladder, lights (all hidden together when retracted)
    const gear = new THREE.Group(), GY = -2.26;
    const padProf = [[0.0, 0.0], [0.36, 0.0], [0.46, 0.05], [0.42, 0.1], [0.14, 0.14], [0.0, 0.14]].map(function (p) { return new V2(Math.max(1e-3, p[0]), p[1]); });
    const padG = new THREE.LatheGeometry(padProf, 18);
    [[0, -0.6, -3.9, 0], [-1.72, -0.5, 3.2, -1], [1.72, -0.5, 3.2, 1]].forEach(function (p) {
      const x = p[0], top = p[1], z = p[2], s = p[3], fx = x + s * 0.5, fz = z + (s ? 0.25 : -0.3);
      strut([x, top + 0.2, z], [x + (fx - x) * 0.45, top - 0.62, z + (fz - z) * 0.45], 0.1, white, gear, 12);
      strut([x + (fx - x) * 0.4, top - 0.52, z + (fz - z) * 0.4], [fx, GY + 0.12, fz], 0.07, chrome, gear, 10);
      mesh(padG, dark, fx, GY, fz, gear);
      mesh(new THREE.SphereGeometry(0.1, 10, 8), steel, fx, GY + 0.15, fz, gear);
      // side braces back to the hull
      const mx = x + (fx - x) * 0.45, my = top - 0.62, mz = z + (fz - z) * 0.45;
      strut([mx, my, mz], [x - (s ? s * 0.5 : 0.45), top + 0.1, z + (s ? -0.8 : 0.5)], 0.035, steel, gear);
      strut([mx, my, mz], [x - (s ? s * 0.5 : -0.45), top + 0.1, z + (s ? 0.7 : 0.5)], 0.035, steel, gear);
      // open gear door
      const door = box(0.03, 0.55, 0.9, tileD, x - (s ? s * 0.42 : 0.4), top - 0.2, z, gear); door.rotation.z = (s || 1) * 0.25;
      if (!s) { const d2 = box(0.03, 0.55, 0.9, tileD, x + 0.4, top - 0.2, z, gear); d2.rotation.z = -0.25; }
    });
    // landing lights on the nose leg
    [-0.14, 0.14].forEach(function (x) { cyl(0.07, 0.05, 0.08, 10, dark, x, -1.1, -4.12, gear).rotation.x = PI / 2; mesh(new THREE.CircleGeometry(0.06, 10), basic(0xfff4d6), x, -1.1, -4.165, gear).rotation.y = PI; });
    // boarding ladder below the hatch
    const lx = -1.78, lTop = 0.05;
    [-3.14, -2.66].forEach(function (z) { strut([lx, lTop, z], [lx - 0.22, GY + 0.02, z], 0.025, steel, gear); strut([lx, lTop - 0.15, z], [lx + 0.22, lTop - 0.05, z], 0.02, steel, gear); });
    for (let i = 0; i < 8; i++) { const t = (i + 0.6) / 8.4, y = lTop + (GY - lTop) * t, x = lx - 0.22 * t; strut([x, y, -3.14], [x, y, -2.66], 0.018, steel, gear); }
    body.add(gear);

    const shadow = blobShadow(15, 16); shadow.position.set(0, GY + 0.03, 0.3); g.add(shadow);
    g.scale.setScalar(0.001);
    g.userData = { plumes: plumes, lifts: lifts, gear: gear, rest: -GY / 1000, shadow: shadow, exit: new V3(-3.3, GY, -2.9), body: body };
    return g;
  }

  // ------------------------------------------------------------------ astronaut
  function buildAstronaut() {
    ensureEnv();
    const T = textures();
    const g = new THREE.Group(), rig = new THREE.Group(); g.add(rig);
    const suit = std(0xd9d9d3, 0.86, 0.0, { bumpMap: T.fabric, bumpScale: 1.2e-6, emissive: 0x6a6a66, emissiveIntensity: 0.2 });
    const suit2 = std(0xc9c9c2, 0.9, 0.0, { emissive: 0x6a6a66, emissiveIntensity: 0.2 });                     // slightly darker cover layer (PLSS, boots uppers)
    const grey = std(0x777d86, 0.6, 0.25), darkm = std(0x24272d, 0.7, 0.2), rubber = std(0x5d6672, 0.85, 0.05);
    const metal = shiny(0xaab0b8, 0.3, 0.9, 0.9), red = std(0xc23428, 0.7, 0.05), blue = std(0x2f5fa8, 0.6, 0.1);
    const gold = shiny(0xe0a030, 0.1, 0.95, 1.35, { emissive: 0x3a2203, emissiveIntensity: 0.55 });
    const legs = [], arms = [], knees = [], elbows = [], feet = [];

    // --- legs (pivot at the hip)
    const thighG = limbGeo(0.118, 0.098, 0.42, 16), shinG = limbGeo(0.094, 0.082, 0.34, 16);
    const bootShape = new THREE.Shape();
    [[0.115, 0.0], [-0.2, 0.0], [-0.235, 0.03], [-0.225, 0.085], [-0.12, 0.125], [-0.085, 0.2], [0.105, 0.2], [0.125, 0.06]].forEach(function (p, i) { if (i) bootShape.lineTo(p[0], p[1]); else bootShape.moveTo(p[0], p[1]); });
    bootShape.closePath();
    const bootG = new THREE.ExtrudeGeometry(bootShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 });
    bootG.rotateY(-PI / 2); bootG.translate(0.05, 0.04, 0);   // shape x -> z (toe at -z), thickness across x
    const soleG = roundBox(0.18, 0.4, 0.045, 0.07, 0.012); soleG.rotateX(-PI / 2);
    const ringG = new THREE.TorusGeometry(1, 0.11, 6, 18); ringG.rotateX(PI / 2);
    const bellowG = new THREE.TorusGeometry(1, 0.2, 6, 18); bellowG.rotateX(PI / 2);
    const bandG = new THREE.CylinderGeometry(1, 0.985, 1, 18, 1, true);
    [-1, 1].forEach(function (s) {
      const leg = new THREE.Group(); leg.position.set(s * 0.108, 0.9, 0); rig.add(leg); legs.push(leg);
      mesh(thighG, suit, 0, 0, 0, leg);
      const stripe = mesh(bandG, red, 0, -0.2, 0, leg); stripe.scale.set(0.1135, 0.05, 0.1135);
      const knee = new THREE.Group(); knee.position.y = -0.42; leg.add(knee); knees.push(knee);
      mesh(shinG, suit, 0, 0, 0, knee);
      [0.045, 0.0, -0.045].forEach(function (y) { const r = mesh(bellowG, suit, 0, y, 0, knee); r.scale.set(0.09, 0.1, 0.09); });
      const kp = mesh(new THREE.SphereGeometry(0.085, 12, 10), suit2, 0, -0.01, -0.045, knee); kp.scale.set(0.9, 1.1, 0.7);
      const foot = new THREE.Group(); foot.position.y = -0.34; knee.add(foot); feet.push(foot);
      mesh(ringG, metal, 0, 0.015, 0, foot).scale.set(0.082, 0.07, 0.082);
      mesh(bootG, suit2, 0, -0.14, 0.0, foot);
      mesh(soleG, rubber, 0, -0.14, -0.045, foot);
      const strap = mesh(ringG, grey, 0, -0.02, -0.02, foot); strap.scale.set(0.088, 0.1, 0.1);
      // thigh pocket on the outside
      mesh(roundBox(0.09, 0.15, 0.04, 0.015), suit2, s * 0.108, -0.3, -0.02, leg).rotation.y = s * PI / 2;
    });

    // --- body (pivot at the hips), carries torso, head, pack and arms
    const body = new THREE.Group(); body.position.y = 0.9; rig.add(body);
    const B = function (m, y) { m.position.y += (y || 0) - 0.9; body.add(m); return m; };   // place by absolute height
    const pelvis = mesh(new THREE.SphereGeometry(1, 18, 12), suit, 0, 0.865, 0); pelvis.scale.set(0.198, 0.115, 0.148); B(pelvis);
    // torso: lofted along the spine (hull maker runs along z, so build and stand it up)
    const TH = makeHull([
      { z: -1.56, w: 0.115, ht: 0.115, hb: 0.115, y: 0 }, { z: -1.5, w: 0.19, ht: 0.15, hb: 0.15, y: 0 }, { z: -1.42, w: 0.262, ht: 0.168, hb: 0.172, y: 0 },
      { z: -1.28, w: 0.268, ht: 0.176, hb: 0.18, y: 0 }, { z: -1.12, w: 0.245, ht: 0.166, hb: 0.166, y: 0 }, { z: -1.0, w: 0.222, ht: 0.156, hb: 0.152, y: 0 }, { z: -0.9, w: 0.208, ht: 0.148, hb: 0.144, y: 0 }, { z: -0.85, w: 0.2, ht: 0.142, hb: 0.138, y: 0 }
    ], { nose: 0.02, nt: 2.5, nb: 2.7, split: -2, cap: -1, seg: 28 });
    TH.geo.rotateX(PI / 2);                                  // z -> -y ... (x, y, z) -> (x, -z, y): height = -z, back = +hull-y
    B(new THREE.Mesh(TH.geo, [suit, suit, suit]), 0.9).position.y = -0.9;
    B(mesh(ringG, metal, 0, 1.0, 0)).scale.set(0.215, 0.12, 0.158);                // waist bearing
    B(mesh(ringG, metal, 0, 1.545, 0)).scale.set(0.14, 0.13, 0.14);                // neck ring
    // chest display & control module
    const dcm = new THREE.Group(); dcm.position.set(0, 1.235, -0.2); B(dcm);
    mesh(roundBox(0.27, 0.19, 0.085, 0.02), suit2, 0, 0, -0.07, dcm);
    box(0.11, 0.045, 0.006, basic(0x7fe9ff), -0.055, 0.045, -0.074, dcm);
    box(0.125, 0.06, 0.004, darkm, -0.055, 0.045, -0.072, dcm);
    [[0.03, 0.05, 0xd9d9d3], [0.075, 0.05, 0xd9d9d3], [0.105, 0.05, 0xc23428]].forEach(function (k) { cyl(0.014, 0.016, 0.03, 10, std(k[2], 0.6, 0.1), k[0], k[1], -0.082, dcm).rotation.x = PI / 2; });
    [-0.09, -0.05, -0.01, 0.03].forEach(function (x) { box(0.02, 0.03, 0.014, grey, x, -0.035, -0.075, dcm); });
    box(0.07, 0.05, 0.012, blue, 0.085, -0.035, -0.073, dcm);
    cyl(0.022, 0.022, 0.05, 10, red, 0.15, 0.0, -0.03, dcm).rotation.z = PI / 2;
    // life-support backpack
    const pack = new THREE.Group(); pack.position.set(0, 1.335, 0.165); B(pack);
    mesh(roundBox(0.5, 0.76, 0.215, 0.07, 0.035), suit2, 0, 0, 0, pack);
    mesh(roundBox(0.34, 0.3, 0.02, 0.03, 0.008), suit, 0, 0.12, 0.212, pack);
    mesh(roundBox(0.34, 0.16, 0.02, 0.03, 0.008), grey, 0, -0.16, 0.212, pack);
    for (let i = 0; i < 5; i++) box(0.26, 0.012, 0.006, darkm, 0, -0.21 + i * 0.025, 0.234, pack);
    box(0.3, 0.035, 0.008, red, 0, 0.305, 0.216, pack);
    box(0.012, 0.6, 0.008, basic(0xb9c2cc), -0.238, 0, 0.19, pack); box(0.012, 0.6, 0.008, basic(0xb9c2cc), 0.238, 0, 0.19, pack);
    cyl(0.07, 0.07, 0.46, 14, suit2, 0, -0.4, 0.1, pack).rotation.z = PI / 2;       // secondary oxygen pack
    [-1, 1].forEach(function (s) { mesh(new THREE.SphereGeometry(0.07, 12, 8), metal, s * 0.23, -0.4, 0.1, pack).scale.x = 0.6; });
    box(0.12, 0.05, 0.1, grey, 0.14, 0.4, 0.1, pack);
    cyl(0.005, 0.005, 0.17, 6, darkm, 0.17, 0.505, 0.12, pack); mesh(new THREE.SphereGeometry(0.01, 6, 5), red, 0.17, 0.595, 0.12, pack);
    // hoses from the pack to the chest unit
    B(tube([[-0.2, 1.08, 0.2], [-0.29, 1.04, 0.05], [-0.26, 1.1, -0.12], [-0.14, 1.19, -0.22]], 0.017, grey, null, 18));
    B(tube([[0.2, 1.1, 0.2], [0.3, 1.08, 0.04], [0.27, 1.16, -0.12], [0.15, 1.22, -0.22]], 0.014, blue, null, 18));
    // helmet: gold visor bubble inside a white shell, shade brow, lights and camera
    const head = new THREE.Group(); head.position.set(0, 1.665, -0.005); B(head);
    mesh(new THREE.SphereGeometry(0.168, 24, 16), gold, 0, 0, -0.012, head);
    const shellG = new THREE.SphereGeometry(0.19, 28, 14, 0, PI * 2, 58 * D2R, 122 * D2R); shellG.rotateX(-PI / 2 - 0.2);
    mesh(shellG, std(0xdededa, 0.55, 0.05, { side: THREE.DoubleSide }), 0, 0, 0, head);
    const rim = mesh(new THREE.TorusGeometry(0.19 * Math.sin(58 * D2R), 0.013, 8, 36), suit2, 0, 0, 0, head);
    rim.rotation.x = -0.2; rim.position.set(0, -0.19 * Math.cos(58 * D2R) * Math.sin(0.2), -0.19 * Math.cos(58 * D2R) * Math.cos(0.2));
    const lampGlow = new THREE.Group(); head.add(lampGlow);
    [-1, 1].forEach(function (s) {
      cyl(0.045, 0.045, 0.03, 14, grey, s * 0.188, -0.01, 0.0, head).rotation.z = PI / 2;      // visor pivots
      box(0.05, 0.05, 0.085, darkm, s * 0.165, 0.118, -0.06, head);
      cyl(0.02, 0.016, 0.012, 10, metal, s * 0.165, 0.118, -0.106, head).rotation.x = PI / 2;
      mesh(new THREE.SphereGeometry(0.014, 8, 6), basic(0xfff2cc), s * 0.165, 0.118, -0.106, lampGlow);
    });
    box(0.05, 0.04, 0.07, darkm, 0, 0.196, -0.03, head); cyl(0.014, 0.014, 0.02, 8, basic(0x18222e), 0, 0.196, -0.07, head).rotation.x = PI / 2;

    // --- arms (pivot at the shoulder)
    const upG = limbGeo(0.098, 0.084, 0.275, 16), foreG = limbGeo(0.08, 0.066, 0.235, 16);
    const patchTex = canvasTex(64, 64, function (c) {
      c.fillStyle = '#17325e'; c.beginPath(); c.arc(32, 32, 31, 0, 7); c.fill();
      c.strokeStyle = '#e8e2c8'; c.lineWidth = 3; c.beginPath(); c.arc(32, 32, 28, 0, 7); c.stroke();
      c.fillStyle = '#e9a23b'; c.beginPath(); c.arc(30, 34, 11, 0, 7); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(30, 34, 20, 6, -0.4, 0, 7); c.stroke();
      c.fillStyle = '#ffffff'; [[48, 14], [14, 16], [50, 46]].forEach(function (p) { c.fillRect(p[0], p[1], 2, 2); });
    });
    [-1, 1].forEach(function (s) {
      const arm = new THREE.Group(); arm.position.set(s * 0.292, 1.4 - 0.9, 0); body.add(arm); arms.push(arm);
      mesh(new THREE.SphereGeometry(0.118, 16, 12), suit, 0, 0.0, 0, arm);
      mesh(upG, suit, 0, -0.03, 0, arm);
      const stripe = mesh(bandG, red, 0, -0.17, 0, arm); stripe.scale.set(0.0945, 0.045, 0.0945);
      if (s < 0) { const pm = mesh(new THREE.CircleGeometry(0.042, 20), new THREE.MeshBasicMaterial({ map: patchTex, color: 0xd0d0d0 }), -0.099, -0.07, 0, arm); pm.rotation.y = -PI / 2; }
      const elbow = new THREE.Group(); elbow.position.y = -0.305; arm.add(elbow); elbows.push(elbow);
      mesh(foreG, suit, 0, 0, 0, elbow);
      [0.038, 0.0, -0.038].forEach(function (y) { const r = mesh(bellowG, suit, 0, y, 0, elbow); r.scale.set(0.076, 0.085, 0.076); });
      mesh(ringG, metal, 0, -0.235, 0, elbow).scale.set(0.066, 0.09, 0.066);           // wrist disconnect
      // glove: palm, curled fingers, thumb
      const hand = new THREE.Group(); hand.position.y = -0.25; elbow.add(hand);
      const palm = mesh(new THREE.SphereGeometry(1, 12, 10), suit2, 0, -0.055, 0, hand); palm.scale.set(0.045, 0.07, 0.06);
      const fing = mesh(limbGeo(0.03, 0.026, 0.06, 10), rubber, 0, -0.105, -0.012, hand); fing.scale.set(0.9, 1, 1.75); fing.rotation.x = 0.35;
      const thumb = mesh(limbGeo(0.02, 0.017, 0.045, 8), rubber, -s * 0.012, -0.06, -0.055, hand); thumb.rotation.x = 0.9;
      // mirror on the forearm (EMU wrist mirror) on the left, checklist on the right
      if (s < 0) box(0.012, 0.06, 0.075, metal, -0.078, -0.16, -0.01, elbow); else box(0.012, 0.07, 0.085, std(0xcfcab4, 0.8, 0), 0.072, -0.14, -0.01, elbow);
    });

    const shadow = blobShadow(1.5, 1.5); shadow.position.y = 0.012; g.add(shadow);
    g.scale.setScalar(0.001);

    // --- animation: walk cycle with knees and elbows; no allocations
    function pose(phase, amt, air) {
      amt = amt < 0 ? 0 : amt > 1 ? 1 : amt; air = air ? (air > 1 ? 1 : air) : 0;
      const w = amt * (1 - air), s = Math.sin(phase), c = Math.cos(phase);
      for (let i = 0; i < 2; i++) {
        const sg = i === 0 ? 1 : -1, sw = sg * s, cw = sg * c, side = i === 0 ? -1 : 1;
        const hip = w * (0.52 * sw + 0.06) + air * (i === 0 ? 0.5 : -0.12);
        const knee = -(w * (0.1 + 0.95 * Math.max(0, cw) * (0.6 + 0.4 * Math.max(0, -sw + 0.2))) + air * (i === 0 ? 0.85 : 0.4) + 0.04 * (1 - w) * (1 - air));
        legs[i].rotation.x = hip; legs[i].rotation.z = side * 0.035 * (1 - w);
        knees[i].rotation.x = knee;
        feet[i].rotation.x = -(hip + knee) * 0.75 + w * 0.22 * Math.max(0, sw) - air * 0.3;
        arms[i].rotation.x = w * (-0.42 * sw + 0.1) + (1 - w) * (1 - air) * 0.06 + air * 0.55;
        arms[i].rotation.z = side * (0.24 + 0.05 * w + 0.42 * air);
        elbows[i].rotation.x = 0.32 + w * (0.22 + 0.3 * Math.max(0, -sw)) + air * 0.5;
      }
      rig.position.y = -0.028 * w * s * s - 0.004 * (1 - w);
      body.rotation.x = -0.075 * w - 0.08 * air;
      body.rotation.y = -0.085 * w * s;
      body.rotation.z = 0.022 * w * c;
      head.rotation.y = 0.06 * w * s;
    }
    pose(0, 0, 0);
    g.userData = { legs: legs, arms: arms, knees: knees, elbows: elbows, feet: feet, body: body, head: head, lampGlow: lampGlow, shadow: shadow, pose: pose };
    return g;
  }

  // ------------------------------------------------------------------ launch complex (LC-39A-like)
  function buildPad() {
    ensureEnv();
    const g = new THREE.Group();
    const conc = std(0x9b9a93, 0.95, 0), conc2 = std(0x858680, 0.95, 0), steel = shiny(0x5c626b, 0.55, 0.6, 0.35), steelL = std(0x8a9098, 0.6, 0.4);
    const whitem = std(0xe6e7e3, 0.6, 0.05), darkm = std(0x26282c, 0.9, 0.1), oxide = std(0x8e3b2a, 0.75, 0.15), gravel = std(0xb5a78a, 1, 0), lightm = basic(0xfff6d8);
    // hardstand with painted markings
    const top = canvasTex(1024, 1024, function (c, w, h) {
      const r = rng(21);
      c.fillStyle = '#9d9c95'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) for (let j = 0; j < 26; j++) { const v = 150 + Math.floor(r() * 16); c.fillStyle = 'rgb(' + v + ',' + v + ',' + (v - 5) + ')'; c.fillRect(i * 40 + 1, j * 40 + 1, 38.5, 38.5); }
      const sc = c.createRadialGradient(512, 512, 10, 512, 512, 250); sc.addColorStop(0, 'rgba(25,22,20,0.8)'); sc.addColorStop(0.5, 'rgba(40,36,32,0.42)'); sc.addColorStop(1, 'rgba(40,36,32,0)');
      c.fillStyle = sc; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 60; k++) { const a = r() * 6.283, d = 60 + r() * 330; c.strokeStyle = 'rgba(40,38,36,' + (0.05 + r() * 0.1) + ')'; c.lineWidth = 2 + r() * 6; c.beginPath(); c.moveTo(512 + Math.cos(a) * d, 512 + Math.sin(a) * d); c.lineTo(512 + Math.cos(a) * (d + 30 + r() * 80), 512 + Math.sin(a) * (d + 30 + r() * 80)); c.stroke(); }
      c.strokeStyle = '#e8c33a'; c.lineWidth = 9; c.beginPath(); c.arc(512, 512, 170, 0, 7); c.stroke();
      c.lineWidth = 5; c.beginPath(); c.arc(512, 512, 430, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(240,240,235,0.85)'; c.lineWidth = 6; c.setLineDash([26, 18]); c.beginPath(); c.arc(512, 512, 300, 0, 7); c.stroke(); c.setLineDash([]);
      c.lineWidth = 7; [[512, 300, 512, 724], [300, 512, 724, 512]].forEach(function (l) { c.beginPath(); c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); c.stroke(); });
    });
    top.wrapS = top.wrapT = THREE.ClampToEdgeWrapping;
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(58, 63, 1.3, 8), [conc2, new THREE.MeshStandardMaterial({ map: top, roughness: 0.95, metalness: 0 }), conc2]);
    slab.rotation.y = PI / 8; slab.position.y = -0.55; g.add(slab);
    // flame trench behind the ship (+Z), deflector and walls
    box(11, 0.06, 68, darkm, 0, 0.13, 44, g);
    [-1, 1].forEach(function (s) {
      box(1.2, 1.1, 56, conc, s * 6.2, 0.55, 48, g);
      for (let i = 0; i < 6; i++) box(0.5, 0.06, 5, basic(i % 2 ? 0x222222 : 0xe8c33a), s * 5.3, 0.14, 11 + i * 0.01 + i * 5, g);
    });
    const defl = box(10.6, 0.4, 5, steel, 0, 0.75, 21, g); defl.rotation.x = 0.26;
    // fixed service structure: open steel tower with decks and bracing
    const fss = new THREE.Group(); fss.position.set(-25, 0, 2); g.add(fss);
    const TW = 4.6, TH = 78, LV = 6.5, nL = Math.round(TH / LV);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) { box(0.55, TH, 0.55, steel, c[0] * TW, TH / 2, c[1] * TW, fss); });
    box(3.2, TH + 2, 3.2, whitem, 0, TH / 2 + 1, 0, fss);
    const deckG = new THREE.BoxGeometry(TW * 2 + 1.6, 0.22, TW * 2 + 1.6), railG = new THREE.BoxGeometry(TW * 2 + 1.6, 0.08, 0.08);
    for (let i = 1; i <= nL; i++) {
      const y = i * LV; mesh(deckG, steelL, 0, y, 0, fss);
      [[0, 1, 0], [0, -1, 0], [1, 0, 1], [-1, 0, 1]].forEach(function (r) { const m = mesh(railG, oxide, r[0] * (TW + 0.8), y + 1.1, r[1] * (TW + 0.8), fss); if (r[2]) m.rotation.y = PI / 2; });
      const y0 = y - LV + 0.2, y1 = y - 0.2, dir = i % 2 ? 1 : -1;
      strut([-TW * dir, y0, TW], [TW * dir, y1, TW], 0.11, steel, fss, 5); strut([-TW * dir, y0, -TW], [TW * dir, y1, -TW], 0.11, steel, fss, 5);
      strut([TW, y0, -TW * dir], [TW, y1, TW * dir], 0.11, steel, fss, 5); strut([-TW, y0, -TW * dir], [-TW, y1, TW * dir], 0.11, steel, fss, 5);
    }
    // hammerhead crane and lightning mast on top
    box(30, 1.6, 2.2, oxide, 6, TH + 3.2, 0, fss); box(4, 3.2, 4, oxide, 0, TH + 2.4, 0, fss); box(2.2, 2.4, 2.6, steel, -8, TH + 3.2, 0, fss);
    strut([0, TH + 9, 0], [19, TH + 4, 0], 0.09, steel, fss, 5); strut([0, TH + 9, 0], [-8, TH + 4.4, 0], 0.09, steel, fss, 5);
    cyl(0.28, 0.55, 26, 10, whitem, 0, TH + 17, 0, fss);
    mesh(new THREE.SphereGeometry(0.7, 10, 8), basic(0xff3b30), 0, TH + 30.4, 0, fss);
    // crew access arm with white room, level with the ship's hatch
    const armY = 3.25;
    box(15, 0.25, 2.2, steelL, -12.2, armY - 1.25, -2.9, g);
    [[-1.05], [1.05]].forEach(function (z) {
      box(15, 0.12, 0.12, steel, -12.2, armY + 1.0, -2.9 + z[0], g);
      for (let i = 0; i < 7; i++) { const x0 = -19.6 + i * 2.14; strut([x0, armY - 1.2, -2.9 + z[0]], [x0 + 2.14, armY + 1.0, -2.9 + z[0]], 0.05, steel, g, 5); strut([x0 + 2.14, armY - 1.2, -2.9 + z[0]], [x0 + 2.14, armY + 1.0, -2.9 + z[0]], 0.05, steel, g, 5); }
    });
    box(3.0, 2.7, 3.0, whitem, -4.3, armY + 0.05, -2.9, g);
    box(0.06, 1.9, 1.3, darkm, -2.78, armY - 0.2, -2.9, g);
    box(1.2, 0.5, 0.06, basic(0x9fc6e8), -4.3, armY + 0.5, -4.42, g);
    box(1.2, 1.2, 0.9, steel, -20.2, armY - 0.6, -2.9, g);
    strut([-20.4, armY + 9, -1.5], [-6, armY + 1.4, -2.9], 0.07, steel, g, 5);
    // upper swing arms (retracted) and umbilical lines
    [36, 54].forEach(function (y) { box(2, 1.6, 13, steelL, -25, y, 13, g); box(2.4, 2.4, 2.4, whitem, -25, y, 20, g); });
    strut([-20.4, 30, 2], [-20.4, 0.3, 2], 0.18, darkm, g, 6); strut([-20.4, 30, 3], [-20.4, 0.3, 3], 0.12, whitem, g, 6);
    // lightning-protection towers
    const truss = canvasTex(64, 256, function (c, w, h) {
      c.clearRect(0, 0, w, h); c.strokeStyle = '#d9dcdf'; c.lineWidth = 5; c.strokeRect(2.5, 0, w - 5, h);
      c.lineWidth = 3.5; for (let i = 0; i < 8; i++) { const y = i * 32; c.beginPath(); c.moveTo(3, y); c.lineTo(w - 3, y + 32); c.moveTo(w - 3, y); c.lineTo(3, y + 32); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    });
    truss.repeat.set(4, 3);
    const trussMat = new THREE.MeshStandardMaterial({ map: truss, alphaTest: 0.4, transparent: false, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.3 });
    const ltG = new THREE.CylinderGeometry(1.0, 4.6, 96, 4, 1, true);
    [[84, -40], [-66, -78], [-30, 96]].forEach(function (p) {
      mesh(ltG, trussMat, p[0], 48, p[1], g).rotation.y = PI / 4;
      cyl(0.22, 0.4, 26, 8, whitem, p[0], 109, p[1], g); box(5, 1, 5, conc, p[0], 0.5, p[1], g);
    });
    // sound-suppression water tower
    const wt = new THREE.Group(); wt.position.set(52, 0, -58); g.add(wt);
    cyl(2.4, 3.4, 70, 16, whitem, 0, 35, 0, wt);
    const tank = mesh(new THREE.SphereGeometry(10.5, 28, 18), whitem, 0, 76, 0, wt); tank.scale.y = 0.72;
    cyl(10.55, 10.55, 1.0, 28, oxide, 0, 76, 0, wt, true); cyl(0.5, 0.5, 3, 8, steel, 0, 85, 0, wt);
    strut([52, 0.7, -58], [36, 0.7, -40], 0.5, steelL, g, 8);
    // cryogenic storage spheres with pipe runs to the pad
    [[-86, -64, 9.5, 0xe9eae6], [92, 46, 11, 0xe3e6ea]].forEach(function (s) {
      const grp = new THREE.Group(); grp.position.set(s[0], 0, s[1]); g.add(grp);
      const R = s[2], sm = std(s[3], 0.5, 0.05);
      mesh(new THREE.SphereGeometry(R, 32, 20), sm, 0, R + 4, 0, grp);
      for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; strut([Math.cos(a) * R * 0.92, R + 3, Math.sin(a) * R * 0.92], [Math.cos(a) * R * 0.98, 0, Math.sin(a) * R * 0.98], 0.32, steelL, grp, 6); }
      cyl(R * 1.02, R * 1.02, 0.3, 32, steelL, 0, R + 4, 0, grp, true);
      cyl(0.9, 0.9, 2.2, 10, sm, 0, R * 2 + 4.6, 0, grp); box(1.4, R * 2 + 6, 0.2, steelL, R * 0.99, R + 3, 0, grp);
      box(6, 3, 5, conc, R + 6, 1.5, 4, grp);
      strut([s[0], 0.5, s[1]], [s[0] * 0.5, 0.5, s[1] * 0.5], 0.3, steelL, g, 6); strut([s[0] + 1, 0.5, s[1]], [s[0] * 0.5 + 1, 0.5, s[1] * 0.5], 0.2, whitem, g, 6);
    });
    // propellant farm
    for (let i = 0; i < 4; i++) { const c = cyl(2.2, 2.2, 12, 14, whitem, 34 + i * 5.6, 2.8, 62, g); c.rotation.x = PI / 2; box(1, 1.2, 9, conc, 34 + i * 5.6, 0.6, 62, g); }
    // floodlight towers
    [[40, 40], [-44, 42], [40, -40], [-44, -40]].forEach(function (p) {
      cyl(0.3, 0.5, 30, 8, steel, p[0], 15, p[1], g);
      const head = new THREE.Group(); head.position.set(p[0], 30.6, p[1]); head.lookAt(0, 8, 0); g.add(head);
      box(4.4, 2.2, 0.5, darkm, 0, 0, 0, head);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) box(0.8, 0.8, 0.1, lightm, -1.5 + i, -0.5 + j, 0.3, head);
    });
    // crawlerway: two gravel tracks leading away from the front of the pad, with ramp
    [-1, 1].forEach(function (s) { box(12, 0.12, 700, gravel, s * 10.5, 0.02, -408, g); });
    box(8, 0.1, 700, std(0x6f8050, 1, 0), 0, 0.0, -408, g);
    box(38, 0.14, 26, conc2, 0, 0.03, -66, g);
    // horizontal integration hangar and support buildings beside the crawlerway
    const hg = new THREE.Group(); hg.position.set(-70, 0, -190); g.add(hg);
    box(44, 20, 84, whitem, 0, 10, 0, hg); box(46, 1.2, 86, steelL, 0, 20.6, 0, hg);
    box(30, 16, 0.4, std(0x4a5560, 0.6, 0.3), 0, 8, 42.1, hg); box(44.2, 2.4, 84.2, std(0x2f5fa8, 0.6, 0.1), 0, 16.5, 0, hg);
    box(18, 7, 26, std(0xd2d0c8, 0.8, 0), 44, 3.5, -150, g); box(12, 5, 12, std(0xd2d0c8, 0.8, 0), 60, 2.5, -120, g);
    // perimeter road
    const road = new THREE.Mesh(new THREE.RingGeometry(120, 128, 64), std(0x55585c, 1, 0)); road.rotation.x = -PI / 2; road.position.y = 0.03; g.add(road);
    g.scale.setScalar(0.001);
    return g;
  }

  // ------------------------------------------------------------------ rocks
  // style: 'rock' (regolith boulder), 'ice' (blocky, sharp), 'lava' (rough basalt), 'pebble' (smooth cobble)
  function rockGeometry(seed, style) {
    seed = seed || 0; style = style || 'rock';
    let g;
    if (style === 'ice') {
      g = new THREE.BoxGeometry(1.5, 1.1, 1.3, 2, 2, 2).toNonIndexed();
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const corner = (Math.abs(x) > 0.7 ? 1 : 0) + (Math.abs(y) > 0.5 ? 1 : 0) + (Math.abs(z) > 0.6 ? 1 : 0);
        const k = corner === 3 ? 0.8 : corner === 2 ? 0.94 : 1.06;
        const j = 0.34 * noise3(x * 1.9 + seed, y * 1.9, z * 1.9 - seed, seed + 7);
        x = x * k + j + 0.22 * y; z = z * k + 0.3 * noise3(z * 2.1, x * 2.1 + seed, y * 2.1, seed + 3) - 0.12 * y;
        y = y * k + 0.2 * noise3(y * 2.3, z * 2.3, x * 2.3 + seed, seed + 5);
        p.setXYZ(i, x, Math.max(-0.42, y), z);
      }
    } else if (style === 'pebble') {
      g = new THREE.SphereGeometry(1, 12, 8);
      const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 0.86 + 0.26 * noise3(x * 0.9 + seed, y * 0.9, z * 0.9, seed + 2);
        const px = x * k * 1.1, py = Math.max(-0.3, y * k * 0.62), pz = z * k * 0.86;
        p.setXYZ(i, px, py, pz);
        const nx = px / 1.21, ny = py / 0.38, nz = pz / 0.74, l = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        n.setXYZ(i, nx * l, ny * l, nz * l);
      }
      g.computeBoundingSphere(); return g;
    } else {
      const lava = style === 'lava';
      g = new THREE.IcosahedronGeometry(1, 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        let k = 0.74 + 0.42 * noise3(x * 1.2 + seed, y * 1.2, z * 1.2, seed) + 0.2 * noise3(x * 2.9, y * 2.9 + seed, z * 2.9, seed + 1);
        if (lava) k += 0.24 * Math.abs(noise3(x * 5.3 + seed, y * 5.3, z * 5.3, seed + 4)) - 0.2 * Math.max(0, noise3(x * 4.1, y * 4.1, z * 4.1 + seed, seed + 6));
        else k = Math.min(k, 0.98 + 0.1 * noise3(x * 2.2, y * 2.2, z * 2.2, seed + 8));   // planar-ish fracture faces
        p.setXYZ(i, x * k, Math.max(-0.32, y * k * (lava ? 0.66 : 0.76)), z * k * (lava ? 1 : 0.9));
      }
    }
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }

  window.SOLMODELS = { buildShip: buildShip, buildAstronaut: buildAstronaut, buildPad: buildPad, rockGeometry: rockGeometry, ensureEnv: ensureEnv, setEnvIntensity: setEnvIntensity };
})();
