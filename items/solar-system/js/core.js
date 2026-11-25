/* Solar System Explorer — core: ephemeris, body objects, floating-origin rendering.
   World frame: J2000 ecliptic, x = vernal equinox, y = ecliptic north, units km. The camera always sits
   at the origin; every frame all bodies are re-positioned relative to it in double precision. */
(function () {
  'use strict';
  const THREE = window.THREE, DATA = window.SOLDATA, TR = window.SOLTERRAIN, GFX = window.SOLGFX;
  const AU = DATA.AU, D2R = Math.PI / 180;
  const V3 = THREE.Vector3, Q4 = THREE.Quaternion;
  const $ = function (id) { return document.getElementById(id); };

  const SIM = window.SIM = { AU: AU, bodies: [], byId: {}, t: 0, warp: 1, lod: null, showOrbits: true, quality: 1 };
  // phones and tablets get lighter settings: smaller maps, coarser terrain, lower resolution cap
  SIM.mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
  if (/[?&#]mobile/.test(location.href)) SIM.mobile = true;
  if (SIM.mobile) SIM.quality = 0.35;
  const canvas = $('gl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  } catch (e) { SIM.failed = true; const f = $('fail'); if (f) f.hidden = false; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SIM.mobile ? 1.5 : 2));
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);
  GFX.setGradOK(renderer.capabilities.isWebGL2);
  const camera = new THREE.PerspectiveCamera(58, 1, 1e-4, 1e11);
  const scene = new THREE.Scene(), bg = new THREE.Scene();
  SIM.renderer = renderer; SIM.camera = camera; SIM.scene = scene;
  SIM.cam = { body: null, rel: new V3(), q: new Q4() };

  function resize() {
    const app = $('app'), w = app.clientWidth || window.innerWidth, h = app.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); SIM.W = w; SIM.H = h;
  }
  window.addEventListener('resize', resize); resize();
  // adaptive resolution: the UI lowers the pixel ratio when frames get slow and raises it again when there is headroom
  SIM.maxPR = Math.min(window.devicePixelRatio || 1, SIM.mobile ? 1.5 : 2); SIM.pr = SIM.maxPR;
  SIM.setPixelRatio = function (pr) {
    pr = Math.max(Math.min(0.6, SIM.maxPR), Math.min(SIM.maxPR, pr)); if (Math.abs(pr - SIM.pr) < 0.01) return;
    SIM.pr = pr; prPending = true; // applied just before the next frame is drawn: resizing after drawing would show one blank frame (a blink)
  };
  let prPending = false;

  // ---------------- lights for ship / astronaut / rocks
  const fill = new THREE.DirectionalLight(0xa9b8d6, 0.3); fill.position.set(0.3, 0.5, 1); scene.add(fill);
  const sunLight = new THREE.DirectionalLight(0xfff3df, 2.2); scene.add(sunLight); scene.add(sunLight.target);
  const amb = new THREE.AmbientLight(0x93a4c4, 0.12); scene.add(amb);
  const lamp = new THREE.PointLight(0xfff0d8, 0, 0.06, 1.6); scene.add(lamp);
  SIM.lampLight = lamp;

  // ---------------- time
  SIM.nowDays = function () { return Date.now() / 86400000 + 2440587.5 - 2451545.0; };
  SIM.t = SIM.nowDays();
  SIM.dateOf = function (t) { return new Date((t + 2451545.0 - 2440587.5) * 86400000); };

  // ---------------- ephemeris
  function kepler(M, e) { let E = M + e * Math.sin(M); for (let i = 0; i < 10; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); return E; }
  function orbitPos(a, e, I, Om, w, M, out) {
    const E = kepler(M, e), xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(Om), sO = Math.sin(Om), cI = Math.cos(I), sI = Math.sin(I);
    const x = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
    const y = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
    const z = (sw * sI) * xp + (cw * sI) * yp;
    return out.set(x, z, -y);
  }
  function helioPos(d, t, out) {
    if (d.el) {
      const T = t / 36525, el = d.el, rt = d.rt;
      const a = (el[0] + rt[0] * T) * AU, e = el[1] + rt[1] * T, I = (el[2] + rt[2] * T) * D2R, L = el[3] + rt[3] * T, wb = el[4] + rt[4] * T, Om = el[5] + rt[5] * T;
      return orbitPos(a, e, I, Om * D2R, (wb - Om) * D2R, ((L - wb) % 360) * D2R, out);
    }
    const k = d.kep;
    return orbitPos(k.a * AU, k.e, k.i * D2R, k.O * D2R, k.w * D2R, ((k.M0 + 360 * (t - k.ep) / k.P) % 360) * D2R, out);
  }
  function moonOffset(b, t, out) {
    const o = b.d.orbit;
    if (o.luna) { // truncated lunar theory (Meeus): good to about a degree
      const L = (218.316 + 13.176396 * t) * D2R, M = (134.963 + 13.064993 * t) * D2R, F = (93.272 + 13.229350 * t) * D2R;
      const lam = L + 6.289 * D2R * Math.sin(M), beta = 5.128 * D2R * Math.sin(F), r = 385001 - 20905 * Math.cos(M);
      return out.set(r * Math.cos(beta) * Math.cos(lam), r * Math.sin(beta), -r * Math.cos(beta) * Math.sin(lam));
    }
    const th = (o.ph + 360 * t / o.P) % 360 * D2R, r = o.a * (1 - o.e * Math.cos(th - 1.0));
    return out.set(0, 0, 0).addScaledVector(b.ou, r * Math.cos(th)).addScaledVector(b.ov, r * Math.sin(th));
  }
  SIM.helioPos = helioPos; SIM.moonOffset = moonOffset;

  // ---------------- body objects
  const tmpA = new V3(), tmpB = new V3(), tmpC = new V3(), m4 = new THREE.Matrix4();
  DATA.BODIES.forEach(function (d) {
    const b = { d: d, id: d.id, name: d.name, R: d.Req || d.R, flat: d.flat || 0, pos: new V3(), q: new Q4(), rel: new V3(), dist: 1, pole: new V3(0, 1, 0),
      sunDir: new V3(1, 0, 0), children: [], parent: null, terrain: null };
    SIM.bodies.push(b); SIM.byId[d.id] = b;
  });
  const sun = SIM.sun = SIM.byId.sun;
  SIM.bodies.forEach(function (b) {
    const d = b.d;
    if (d.parent) { b.parent = SIM.byId[d.parent]; b.parent.children.push(b); }
    if (d.pole) { GFX.eqDir(d.pole[0], d.pole[1], b.pole); b.node = GFX.eqDir(d.pole[0] + 90, 0, new V3()); b.nodeP = new V3().crossVectors(b.pole, b.node).normalize(); }
    b.a = d.el ? d.el[0] * AU : d.kep ? d.kep.a * AU : d.orbit ? d.orbit.a : 0;
    b.period = d.el ? 36525 * 360 / d.rt[3] : d.kep ? d.kep.P : d.orbit ? d.orbit.P : 0;
    b.GM = DATA.G * d.mass;
    b.g = b.GM / (d.R * d.R) * 1000; // m/s^2 at mean radius
  });
  SIM.bodies.forEach(function (b) {
    const d = b.d;
    if (b.parent) b.soi = Math.max(b.a * Math.pow(d.mass / b.parent.d.mass, 0.4), b.R * 6); else b.soi = Infinity;
    if (d.type === 'moon' && !d.orbit.luna) {
      const pp = b.parent, sgn = (pp.d.pm && pp.d.pm[1] < 0) ? -1 : 1;
      const pn = pp.pole.clone().multiplyScalar(sgn);
      const e1 = new V3().crossVectors(pn, Math.abs(pn.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0)).normalize();
      const e2 = new V3().crossVectors(pn, e1);
      const i = d.orbit.inc * D2R;
      b.on = pn.clone().multiplyScalar(Math.cos(i)).addScaledVector(e2, -Math.sin(i)).normalize();
      b.ou = e1; b.ov = new V3().crossVectors(b.on, e1).normalize();
      if (!d.pole) b.pole.copy(b.on);
    }
    b.rotAlt = Math.max(b.R * 0.03, 5, d.atm && d.atm.H ? d.atm.H * 8 : 0);
  });
  SIM.updateBodies = function (t) {
    for (let i = 0; i < SIM.bodies.length; i++) {
      const b = SIM.bodies[i], d = b.d;
      if (d.type === 'star') b.pos.set(0, 0, 0);
      else if (d.type === 'moon') { moonOffset(b, t, tmpA); b.pos.copy(b.parent.pos).add(tmpA); }
      else helioPos(d, t, b.pos);
      if (b !== sun) b.sunDir.copy(b.pos).multiplyScalar(-1).normalize();
    }
    for (let i = 0; i < SIM.bodies.length; i++) {
      const b = SIM.bodies[i], d = b.d;
      let X = tmpA, Y = tmpB, Z = tmpC;
      if (d.locked) {
        X.copy(b.parent.pos).sub(b.pos).normalize();
        Y.copy(b.pole).addScaledVector(X, -X.dot(b.pole)).normalize();
      } else {
        const W = ((d.pm[0] + d.pm[1] * t) % 360) * D2R;
        X.copy(b.node).multiplyScalar(Math.cos(W)).addScaledVector(b.nodeP, Math.sin(W)).normalize();
        Y.copy(b.pole);
      }
      Z.crossVectors(X, Y);
      m4.makeBasis(X, Y, Z); b.q.setFromRotationMatrix(m4);
    }
  };

  // ---------------- geometry
  const sphereGeo = new THREE.SphereGeometry(1, 128, 64), sphereLo = new THREE.SphereGeometry(1, 64, 32);
  function oblate(geo, f) {
    if (!f) return geo;
    const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      p.setY(i, y * (1 - f));
      const ny = y / (1 - f), l = 1 / Math.sqrt(x * x + ny * ny + z * z);
      n.setXYZ(i, x * l, ny * l, z * l);
    }
    g.computeBoundingSphere();
    return g;
  }
  // radius of the visible "surface" for a unit direction given in the body frame
  SIM.surfR = function (b, y) { return b.flat ? b.R * (1 - b.flat * y * y) : b.R; };

  // ---------------- textures: loaded when a world comes into view, dropped again when it is far away
  const loader = new THREE.TextureLoader();
  const maxAniso = Math.min(SIM.mobile ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  const TEXLIST = window.SOLTEX || null, TEXHI = (!SIM.mobile && renderer.capabilities.maxTextureSize >= 4096 && window.SOLTEXHI) || [];
  SIM.loading = 0;
  function loadTex(name, ok, fail, hi) {
    if (!hi && TEXLIST && TEXLIST.indexOf(name) < 0) { if (fail) fail(); return; }
    SIM.loading++;
    loader.load('tex/' + (hi ? 'hi/' : '') + name + '.jpg', function (t) { SIM.loading--; t.wrapS = THREE.RepeatWrapping; t.anisotropy = maxAniso; ok(t); }, undefined, function () { SIM.loading--; if (fail) fail(); });
  }
  // decode an image into raw pixels at its own size
  function pixelsOf(image, W, H) {
    const c = document.createElement('canvas'); c.width = W || image.naturalWidth || image.width; c.height = H || image.naturalHeight || image.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, c.width, c.height);
    try { return { data: ctx.getImageData(0, 0, c.width, c.height).data, W: c.width, H: c.height }; } catch (e) { return null; }
  }
  const detailTex = GFX.detailTexture();
  const glowTex = GFX.glowTexture([[0, 'rgba(255,250,235,1)'], [0.1, 'rgba(255,236,190,0.75)'], [0.26, 'rgba(255,196,110,0.26)'], [0.55, 'rgba(255,150,60,0.07)'], [1, 'rgba(255,120,40,0)']]);
  const flareTex = GFX.glowTexture([[0, 'rgba(255,255,255,1)'], [0.07, 'rgba(255,250,235,0.9)'], [0.2, 'rgba(255,235,200,0.22)'], [0.5, 'rgba(255,220,180,0.05)'], [1, 'rgba(255,220,180,0)']]);

  // ---------------- per-body visuals
  SIM.bodies.forEach(function (b) {
    const d = b.d;
    b.group = new THREE.Group(); scene.add(b.group);
    const geo = oblate(sphereGeo, b.flat);
    if (d.type === 'star') {
      b.mat = GFX.sunMaterial();
      b.far = new THREE.Mesh(geo, b.mat); b.far.scale.setScalar(b.R); b.group.add(b.far);
      b.corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      b.corona.renderOrder = 5; scene.add(b.corona);
      b.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      b.flare.renderOrder = 6; scene.add(b.flare);
      loadTex('sun', function (t) { b.mat.uniforms.uMap.value = t; b.mat.uniforms.uHasMap.value = 1; });
      return;
    }
    b.mat = GFX.surfaceMaterial(false);
    const u = b.mat.uniforms;
    u.uColor.value.set(d.color); u.uR.value = b.R; u.uOcean.value = d.ocean ? 1 : 0; u.uLimb.value = d.gas ? 1 : 0;
    u.uDetail.value = detailTex;
    if (d.atm) { u.uAtmCol.value.setRGB(d.atm.rim[0], d.atm.rim[1], d.atm.rim[2]); u.uRim.value = d.atm.rimK; u.uSoft.value = d.atm.soft;
      if (d.atm.overcast) { const m = Math.max(d.atm.hor[0], d.atm.hor[1], d.atm.hor[2]); u.uLightCol.value.setRGB(d.atm.hor[0] / m, d.atm.hor[1] / m, d.atm.hor[2] / m); } }
    b.far = new THREE.Mesh(geo, b.mat); b.far.scale.setScalar(b.R); b.group.add(b.far);
    b.tx = 0; b.txHi = 0; b.idle = 0;
    b.setMap = function (t, proc) {
      const old = b.map;
      u.uMap.value = t; u.uHasMap.value = 1; b.map = t; b.proc = !!proc; b.sampler = null;
      if (old && old !== t && old.dispose) old.dispose();
      if (!proc && !b.albFn && d.terrain && d.terrain.useAlb) { // terrain recipes that follow the photographed surface (dark lava lakes, bright grooved ice …)
        const px = pixelsOf(t.image, 2048, 1024);
        if (px) {
          const lum = new Uint8Array(px.W * px.H), pd = px.data;
          for (let i = 0; i < lum.length; i++) lum[i] = (pd[i * 4] * 0.3 + pd[i * 4 + 1] * 0.59 + pd[i * 4 + 2] * 0.11) | 0;
          b.albFn = TR.makeAlb(lum, px.W, px.H);
          if (b.terrain) { b.terrain.alb = b.albFn; b.terrain.invalidate(); SIM.terrainChanged(b); }
        }
      }
      if (b.id === 'earth' && !proc && !d.dem) {
        const s = GFX.makeSampler(t.image, 2048, 1024);
        if (s) { b.landFn = GFX.landMask(s); if (b.terrain) { b.terrain.land = b.landFn; SIM.terrainChanged(b); } }
      }
      if (SIM.onTexture) SIM.onTexture(b);
    };
    if (d.rings) {
      b.ringTex = GFX.ringTexture(d.rings);
      b.ringMat = GFX.ringMaterial(b.ringTex, b.R * (1 - b.flat * 0.5));
      b.ring = new THREE.Mesh(GFX.ringGeometry(d.rings.inner, d.rings.outer), b.ringMat); b.ring.renderOrder = 3; b.group.add(b.ring);
      if (d.rings.saturn) { u.uRingTex.value = b.ringTex; u.uRing.value.set(d.rings.inner, d.rings.outer, 0.82); }
    }
    if (d.atm && d.atm.shell) {
      const k = 1 + d.atm.shell;
      b.haloMat = GFX.haloMaterial(d.atm.rim, b.R, b.R * k, b.flat);
      b.halo = new THREE.Mesh(oblate(sphereLo, b.flat), b.haloMat); b.halo.scale.setScalar(b.R * k); b.halo.renderOrder = 2; b.group.add(b.halo);
    }
    if (d.clouds) {
      b.cloudMat = GFX.cloudMaterial(d.clouds.solid, d.clouds.color);
      b.cloudMat.uniforms.uDetail.value = detailTex;
      b.cloud = new THREE.Mesh(sphereGeo, b.cloudMat); b.cloud.scale.setScalar(b.R + d.clouds.alt); b.cloud.renderOrder = 1; b.group.add(b.cloud);
    }
  });

  // ---------------- texture / elevation streaming
  function texStart(b) {
    const d = b.d; b.tx = 1;
    loadTex(d.tex || d.id, function (t) { b.tx = 2; b.setMap(t, false); }, function () { b.tx = 2; b.setMap(GFX.procTexture(d), true); });
    if (d.night) loadTex(d.night, function (t) { b.nightTex = t; b.mat.uniforms.uNight.value = t; b.mat.uniforms.uHasNight.value = 1; });
    if (d.clouds && d.clouds.tex && b.cloud) loadTex(d.clouds.tex, function (t) { b.cloudTex = t; b.cloudMat.uniforms.uMap.value = t; b.cloudMat.uniforms.uHasMap.value = 1; });
  }
  function texHi(b) {
    b.txHi = 1;
    loadTex(b.d.tex || b.d.id, function (t) { if (b.tx === 2) { b.txHi = 2; b.setMap(t, false); } else { b.txHi = 0; t.dispose(); } }, function () { b.txHi = 3; }, true);
  }
  function texDrop(b) {
    const u = b.mat.uniforms;
    if (b.map && b.map.dispose) b.map.dispose(); b.map = null; b.sampler = null; u.uMap.value = GFX.white(); u.uHasMap.value = 0;
    if (b.nightTex) { b.nightTex.dispose(); b.nightTex = null; u.uNight.value = GFX.white(); u.uHasNight.value = 0; }
    if (b.cloudTex) { b.cloudTex.dispose(); b.cloudTex = null; b.cloudMat.uniforms.uMap.value = GFX.white(); b.cloudMat.uniforms.uHasMap.value = 0; }
    b.tx = 0; b.txHi = 0;
  }
  const DEMMETA = window.SOLDEM || {};
  function demStart(b) {
    const m = DEMMETA[b.id]; if (!m || b.demState) return;
    b.demState = 1; SIM.loading++;
    const img = new Image();
    img.onload = function () {
      SIM.loading--;
      const px = pixelsOf(img); if (!px) { b.demState = 3; return; }
      const n = px.W * px.H, data = new Uint16Array(n), pd = px.data;
      for (let i = 0; i < n; i++) data[i] = (pd[i * 4] << 8) | pd[i * 4 + 1];
      const off = (m.ref || b.d.R) - b.d.R;
      b.demObj = TR.makeDEM(data, px.W, px.H, m.min + off, m.max + off, b.d.R); b.demState = 2;
      if (b.terrain) { b.terrain.setDEM(b.demObj); SIM.terrainChanged(b); }
    };
    img.onerror = function () { SIM.loading--; b.demState = 3; };
    img.src = 'dem/' + (SIM.mobile && m.file2k ? m.file2k : m.file);
  }
  SIM.hasDEM = function (b) { return !!DEMMETA[b.id]; };
  SIM.terrainChanged = function (b) {
    if (SIM.lod && SIM.lod.body === b) SIM.rebuildLOD();
    if (SIM.onTerrainChange) SIM.onTerrainChange(b);
  };
  // keep a world's maps in memory (used while it is shown in the destination picker)
  SIM.preload = function (b) { if (b !== sun && !b.tx) texStart(b); if (b.d.dem) demStart(b); };
  let lastFrameT = 0;
  function streamAssets(time) {
    const dt = Math.min(1, Math.max(0, time - lastFrameT)); lastFrameT = time;
    const cb = SIM.cam.body;
    for (let i = 0; i < SIM.bodies.length; i++) {
      const b = SIM.bodies[i]; if (b === sun) continue;
      const near = b === cb || b === SIM.target, need = near || b.px > 2;
      if (need) {
        b.idle = 0;
        if (!b.tx) texStart(b);
        else if (b.tx === 2 && !b.txHi && !b.proc && TEXHI.indexOf(b.d.tex || b.d.id) >= 0 && (b.px > 140 || b === cb)) texHi(b);
        if (b.d.dem && !b.demState && (near || b.px > 30)) demStart(b);
      } else if (b.tx === 2) { b.idle += dt; if (b.idle > (SIM.mobile ? 12 : 40)) texDrop(b); }
    }
  }

  // ---------------- stars, sky dome
  const stars = GFX.buildStars(); bg.add(stars);
  stars.material.uniforms.uPx.value = renderer.getPixelRatio();
  const skyMat = GFX.skyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat); sky.renderOrder = 2; sky.frustumCulled = false; bg.add(sky);
  SIM.sky = { alpha: 0, day: 1, dens: 0 };

  // ---------------- far-body dots
  const nb = SIM.bodies.length;
  const dotGeo = new THREE.BufferGeometry();
  const dotPos = new Float32Array(nb * 3), dotCol = new Float32Array(nb * 3), dotSize = new Float32Array(nb);
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
  dotGeo.setAttribute('acol', new THREE.BufferAttribute(dotCol, 3));
  dotGeo.setAttribute('size', new THREE.BufferAttribute(dotSize, 1));
  const dotMat = GFX.starMaterial(true); dotMat.uniforms.uPx.value = renderer.getPixelRatio();
  SIM.onPR = function (pr) { stars.material.uniforms.uPx.value = pr; dotMat.uniforms.uPx.value = pr; };
  const dots = new THREE.Points(dotGeo, dotMat); dots.frustumCulled = false; dots.renderOrder = 4; scene.add(dots);
  SIM.bodies.forEach(function (b, i) { const c = new THREE.Color(b.d.color); const m = 1 / Math.max(c.r, c.g, c.b); dotCol[i * 3] = c.r * m; dotCol[i * 3 + 1] = c.g * m; dotCol[i * 3 + 2] = c.b * m; });

  // ---------------- orbit lines
  SIM.updateBodies(SIM.t);
  SIM.bodies.forEach(function (b) {
    if (b === sun) return;
    const n = b.d.type === 'moon' ? 160 : 400, pts = new Float32Array(n * 3), v = new V3();
    for (let i = 0; i < n; i++) {
      const tt = SIM.t + b.period * i / n;
      if (b.d.type === 'moon') moonOffset(b, tt, v); else helioPos(b.d, tt, v);
      pts[i * 3] = v.x; pts[i * 3 + 1] = v.y; pts[i * 3 + 2] = v.z;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const c = new THREE.Color(b.d.color).lerp(new THREE.Color(0xffffff), 0.25);
    b.orbitLine = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.2, depthWrite: false }));
    b.orbitLine.frustumCulled = false; b.orbitPts = pts; scene.add(b.orbitLine);
  });

  // ---------------- terrain + LOD
  SIM.latLonDir = function (lat, lon, out) { const a = lat * D2R, o = lon * D2R; return (out || new V3()).set(Math.cos(a) * Math.cos(o), Math.sin(a), -Math.cos(a) * Math.sin(o)); };
  SIM.dirLatLon = function (v) { const l = v.length(); return { lat: Math.asin(v.y / l) / D2R, lon: Math.atan2(-v.z, v.x) / D2R }; };
  SIM.KSC = SIM.latLonDir(28.6082, -80.6041); // Launch Complex 39A
  SIM.terrainOf = function (b) {
    if (!b.terrain && b.d.landable) {
      b.terrain = new TR.Terrain(b.d);
      if (b.id === 'earth') { b.terrain.addFlat(SIM.KSC.x, SIM.KSC.y, SIM.KSC.z, 9, 0.004); if (b.landFn) b.terrain.land = b.landFn; }
      if (b.demObj) b.terrain.setDEM(b.demObj);
      if (b.albFn) b.terrain.alb = b.albFn;
      if (SIM.onTerrainCreate) SIM.onTerrainCreate(b, b.terrain);
    }
    return b.terrain;
  };
  // Enceladus: jets of ice crystals spraying from the tiger-stripe fractures at the south pole
  SIM.bodies.forEach(function (b) {
    if (!b.d.plumes) return;
    const f = SIM.terrainOf(b).feat.filter(function (x) { return x.type === 'canyon'; })[0]; if (!f) return;
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const ctx = c.getContext('2d'), img = ctx.createImageData(64, 256), px = img.data;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
      const v = 1 - y / 255, w = 0.08 + 0.42 * Math.pow(v, 0.7), dx = (x - 31.5) / 32 / w;
      const a = Math.exp(-dx * dx * 2.2) * Math.pow(1 - v, 1.6) * Math.min(1, v * 30) * (0.75 + 0.25 * Math.sin(v * 37 + x));
      const o = (y * 64 + x) * 4; px[o] = 215 * a; px[o + 1] = 235 * a; px[o + 2] = 255 * a; px[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.55 });
    const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);
    const grp = new THREE.Group(), dir = new V3(), Y = new V3(0, 1, 0), q2 = new Q4(), n = f.n || 1, gap = (f.gap || 0) * f.w;
    for (let k = 0; k < n; k++) for (let j = 0; j < 4; j++) {
      const along = (j - 1.5) * f.len * 0.2 + ((k * 7 + j * 3) % 5 - 2) * 3, across = (k - (n - 1) / 2) * gap;
      dir.set(f.x + (f.ax[0] * along + f.cr[0] * across) / b.R, f.y + (f.ax[1] * along + f.cr[1] * across) / b.R, f.z + (f.ax[2] * along + f.cr[2] * across) / b.R).normalize();
      const h = 55 + 45 * ((k * 5 + j * 11) % 7) / 6, w = 9 + 5 * ((k + j) % 3);
      for (let r = 0; r < 2; r++) {
        const m = new THREE.Mesh(geo, mat); m.position.copy(dir).multiplyScalar(b.R - 0.4);
        m.quaternion.setFromUnitVectors(Y, dir); q2.setFromAxisAngle(Y, r * Math.PI / 2 + k); m.quaternion.multiply(q2);
        m.scale.set(w, h, 1); m.renderOrder = 4; grp.add(m);
      }
    }
    b.group.add(grp); b.plumeGroup = grp; b.plumeMat = mat;
  });
  SIM.water = false;
  // radius of solid ground (or the dive limit for gas giants / the Sun) along a body-frame unit direction
  SIM.groundR = function (b, x, y, z) {
    if (b.d.landable) { const t = SIM.terrainOf(b); const h = t.heightFine(x, y, z); SIM.water = t.water; return b.R + h; }
    SIM.water = false;
    if (b.d.gas) return SIM.surfR(b, y) * 0.9955;
    return b.R * 1.004;
  };
  SIM.colorAt = function (b, x, y, z, out) {
    if (!b.sampler && b.map && b.map.image) b.sampler = GFX.makeSampler(b.map.image, 1024, 512) || { color: function (a, b2, c, o) { o[0] = o[1] = o[2] = 0.5; return o; } };
    if (b.sampler) return b.sampler.color(x, y, z, out);
    const c = new THREE.Color(b.d.color); out[0] = c.r; out[1] = c.g; out[2] = c.b; return out;
  };
  const SHARED = ['uLightCol', 'uMap', 'uHasMap', 'uColor', 'uNight', 'uHasNight', 'uSunDir', 'uSunI', 'uAmb', 'uPole', 'uPlanetPos', 'uR', 'uAtmCol', 'uRim', 'uSoft', 'uOcean'];
  function makeLOD(b) {
    const t = SIM.terrainOf(b);
    if (!b.chunkMat) {
      b.chunkMat = GFX.surfaceMaterial(true);
      SHARED.forEach(function (k) { b.chunkMat.uniforms[k] = b.mat.uniforms[k]; });
      b.chunkMat.uniforms.uDetail.value = detailTex;
      if (b.id === 'earth') { b.chunkMat.uniforms.uPad.value.set(SIM.KSC.x, SIM.KSC.y, SIM.KSC.z, 7.5); b.chunkMat.uniforms.uPadCol.value.setRGB(0.47, 0.46, 0.33); }
      const gr = b.d.ground || { g: [1, 0, 0.5], gloss: 0 };
      b.chunkMat.uniforms.uG.value.set(gr.g[0], gr.g[1], gr.g[2]); b.chunkMat.uniforms.uGloss.value = gr.gloss || 0;
      if (gr.near) b.chunkMat.uniforms.uNear.value.set(gr.near[0], gr.near[1], gr.near[2], gr.near[3]);
    }
    const group = new THREE.Group(); b.group.add(group);
    SIM.lod = { body: b, group: group, lod: new TR.TerrainLOD(THREE, t, b.chunkMat, group) };
    SIM.lod.lod.K = 1.5 + 0.3 * SIM.quality;
    b.far.visible = false;
  }
  function dropLOD() {
    if (!SIM.lod) return;
    SIM.lod.lod.dispose(); SIM.lod.body.group.remove(SIM.lod.group); SIM.lod.body.far.visible = true; SIM.lod = null;
  }
  SIM.rebuildLOD = function () { if (SIM.lod) { const b = SIM.lod.body; dropLOD(); makeLOD(b); } };

  // ---------------- per-frame placement + render
  const qInv = new Q4(), camLocal = new V3(), up = new V3(), toSun = new V3(), anchor = new V3(), m4b = new THREE.Matrix4(), tv = new V3();
  function sstep(a, b, x) { x = (x - a) / (b - a); x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
  // 1 if the Sun is visible from point P (relative to a sphere of radius R at the origin), 0 if the sphere blocks it
  function sunVisible(P, dir, R) {
    const bq = P.dot(dir); if (bq > 0) return 1;
    const d2 = P.lengthSq() - bq * bq;
    return sstep(R * R * 0.985, R * R * 1.01, d2);
  }
  SIM.scan = { k: 0, r: 0, pos: new V3() };
  SIM.lampPos = new V3(); SIM.lampI = 0;
  SIM.fovBoost = 0;

  SIM.renderFrame = function (time) {
    if (prPending) { prPending = false; renderer.setPixelRatio(SIM.pr); renderer.setSize(SIM.W, SIM.H, false); if (SIM.onPR) SIM.onPR(SIM.pr); }
    const cb = SIM.cam.body, cr = SIM.cam.rel;
    const pxPerRad = (SIM.H / 2) / Math.tan(camera.fov * D2R / 2);
    streamAssets(time);
    for (let i = 0; i < nb; i++) {
      const b = SIM.bodies[i];
      b.rel.copy(b.pos).sub(cb.pos).sub(cr);
      b.group.position.copy(b.rel); b.group.quaternion.copy(b.q);
      b.dist = b.rel.length();
      b.px = b.R / b.dist * pxPerRad;
    }
    // --- terrain level of detail around the camera
    const rc = cr.length();
    const wantLOD = cb.d.landable && rc < cb.R * 8;
    if (SIM.lod && (SIM.lod.body !== cb || !wantLOD)) dropLOD();
    if (wantLOD && !SIM.lod) makeLOD(cb);
    qInv.copy(cb.q).invert();
    camLocal.copy(cr).applyQuaternion(qInv);
    if (SIM.lod) {
      SIM.lod.lod.update(camLocal, SIM.lodBudget || (SIM.mobile ? 5 : 7));
      const cu = cb.chunkMat.uniforms, P = 1.024;
      m4b.makeRotationFromQuaternion(qInv); cu.uInvRot.value.setFromMatrix4(m4b);
      anchor.set(Math.round(camLocal.x / P) * P, Math.round(camLocal.y / P) * P, Math.round(camLocal.z / P) * P).sub(camLocal).applyQuaternion(cb.q);
      cu.uAnchor.value.copy(anchor);
      cu.uLampPos.value.copy(SIM.lampPos); cu.uLampI.value = SIM.lampI;
      cu.uScan.value = SIM.scan.k; cu.uScanR.value = SIM.scan.r; cu.uScanPos.value.copy(SIM.scan.pos);
    }
    // --- atmosphere state at the camera
    up.copy(cr).normalize();
    toSun.copy(sun.rel).normalize();
    const atm = cb.d.atm, S = SIM.sky;
    let alt = rc - (cb.flat ? SIM.surfR(cb, camLocal.y / rc) : cb.R);
    S.alt = alt; S.alpha = 0; S.dens = 0; S.day = sstep(-0.12, 0.14, up.dot(toSun));
    if (atm) {
      const dens = Math.exp(-Math.min(60, Math.max(-12, alt / atm.H)));
      S.dens = dens;
      S.alpha = atm.opacity * (1 - Math.exp(-dens * atm.k));
      const su = skyMat.uniforms;
      su.uUp.value.copy(up); su.uSun.value.copy(toSun);
      su.uZen.value.setRGB(atm.zen[0], atm.zen[1], atm.zen[2]); su.uHor.value.setRGB(atm.hor[0], atm.hor[1], atm.hor[2]);
      su.uSunset.value.setRGB(atm.sunset[0], atm.sunset[1], atm.sunset[2]); su.uNightCol.value.setRGB(atm.nightCol[0], atm.nightCol[1], atm.nightCol[2]);
      su.uOver.value = atm.overcast; su.uDay.value = S.day;
      su.uAlpha.value = S.alpha * (atm.night + (1 - atm.night) * S.day);
      sky.visible = su.uAlpha.value > 0.003;
      if (SIM.lod) {
        const cu = cb.chunkMat.uniforms;
        cu.uFog.value = atm.fog * Math.min(1, dens);
        cu.uFogCol.value.setRGB(atm.hor[0] * S.day + atm.nightCol[0] * (1 - S.day), atm.hor[1] * S.day + atm.nightCol[1] * (1 - S.day), atm.hor[2] * S.day + atm.nightCol[2] * (1 - S.day));
      }
    } else { sky.visible = false; if (SIM.lod) cb.chunkMat.uniforms.uFog.value = 0; }
    // --- sunlight on ship / astronaut
    let vis = cb === sun ? 1 : sunVisible(cr, toSun, cb.R * (1 - cb.flat) * 0.999);
    if (vis > 0 && cb.parent && cb.parent !== sun) { tv.copy(cb.parent.rel).multiplyScalar(-1); vis *= sunVisible(tv, toSun, cb.parent.R * 0.98); }
    const hazeCut = atm ? 1 - atm.overcast * S.alpha * 0.85 : 1;
    S.sunVis = vis;
    skyMat.uniforms.uSunVis.value = vis;
    const dAU = Math.max(0.2, sun.dist / AU);
    const sunI = 1 / (1 + 0.07 * Math.log2(Math.max(1, dAU)));
    sunLight.position.copy(toSun).multiplyScalar(10); sunLight.target.position.set(0, 0, 0);
    sunLight.intensity = 1.25 * vis * (0.5 + 0.5 * sunI) * hazeCut;
    amb.intensity = 0.3 + 0.3 * S.alpha * S.day + (atm && atm.overcast ? 0.25 * S.alpha * S.day : 0);
    lamp.position.copy(SIM.lampPos); lamp.intensity = SIM.lampI * 1.6;
    // --- per-body uniforms
    for (let i = 0; i < nb; i++) {
      const b = SIM.bodies[i], d = b.d, isCam = b === cb;
      if (b === sun) {
        b.mat.uniforms.uTime.value = time;
        const sFar = Math.max(b.R * 9, b.dist * 0.055);
        b.corona.position.copy(b.rel); b.corona.scale.setScalar(b.R * 7);
        b.flare.position.copy(b.rel); b.flare.scale.setScalar(sFar);
        b.flare.material.opacity = hazeCut * (0.55 + 0.45 * Math.min(1, b.dist / (b.R * 40)));
        b.corona.material.opacity = hazeCut;
        b.far.visible = hazeCut > 0.3;
        continue;
      }
      const u = b.mat.uniforms;
      u.uSunDir.value.copy(b.sunDir); u.uPlanetPos.value.copy(b.rel); u.uPole.value.copy(b.pole);
      const bd = Math.max(0.2, b.pos.length() / AU);
      const bI = 1 / (1 + 0.07 * Math.log2(Math.max(1, bd)));
      let ecl = 1; // moons go dark when they pass through their planet's shadow
      if (d.type === 'moon') { tv.copy(b.pos).sub(b.parent.pos); ecl = sunVisible(tv, b.sunDir, b.parent.R * 0.99); }
      u.uSunI.value = bI * ecl;
      u.uAmb.value = (d.atm ? 0.02 + 0.05 * d.atm.soft : 0.02) + (isCam && SIM.lod ? 0.03 : 0);
      u.uRim.value = d.atm ? d.atm.rimK * (isCam ? 1 - S.alpha : 1) : 0;
      if (!(SIM.lod && SIM.lod.body === b)) b.far.visible = b.px > 0.35;
      if (b.halo) { b.haloMat.uniforms.uSunDir.value.copy(b.sunDir); b.haloMat.uniforms.uPlanetPos.value.copy(b.rel); b.haloMat.uniforms.uPole.value.copy(b.pole); b.haloMat.uniforms.uK.value = isCam ? Math.max(0, 1 - S.alpha * 1.6) * (1 - (1 - d.atm.opacity) * sstep(b.R * d.atm.shell, b.R * d.atm.shell * 0.4, alt)) : 1; b.halo.visible = b.px > 2 && b.haloMat.uniforms.uK.value > 0.01 && b.dist < b.R * 3000; } // (from very far away the glow is sub-pixel, and its maths loses precision under a telescope)
      if (b.plumeGroup) { b.plumeGroup.visible = b.px > 25; b.plumeMat.opacity = 0.5 * ecl; }
      if (b.ring) { const ru = b.ringMat.uniforms; ru.uSunDir.value.copy(b.sunDir); ru.uPlanetPos.value.copy(b.rel); ru.uPole.value.copy(b.pole); ru.uSunI.value = bI; b.ring.visible = b.px > 1; }
      if (b.cloud) {
        const c = d.clouds, cu = b.cloudMat.uniforms; let op = 1;
        if (isCam) { if (c.solid) op = sstep(c.fade[0], c.fade[1], alt); else op = Math.min(1, Math.abs(alt - c.alt) / 4) * (alt < c.alt ? 0.8 : 1); }
        cu.uOpacity.value = op; cu.uSunDir.value.copy(b.sunDir); cu.uSunI.value = bI;
        b.cloud.visible = op > 0.01 && b.px > 1 && (c.solid || cu.uHasMap.value > 0);
      }
      // far dots
      const o = i * 3;
      dotPos[o] = b.rel.x; dotPos[o + 1] = b.rel.y; dotPos[o + 2] = b.rel.z;
      const isMoon = d.type === 'moon';
      let sz = b.px < 1.6 ? (isMoon ? 2.6 : d.type === 'dwarf' ? 3.0 : 4.6) : 0;
      if (isMoon && b.parent.dist > b.a * 400) sz = 0;
      dotSize[i] = sz;
      // orbit lines
      if (b.orbitLine) {
        const par = b.parent;
        let show = SIM.showOrbits && S.alpha < 0.25 && !(cb.d.landable && alt < cb.R * 0.04);
        if (isMoon) show = show && par.dist < b.a * 60 && b.dist > b.R * 30;
        else show = show && b.dist > b.R * 250;
        b.orbitLine.visible = show;
        if (show) b.orbitLine.position.copy(par.rel);
      }
    }
    dotGeo.attributes.position.needsUpdate = true; dotGeo.attributes.size.needsUpdate = true;
    dotMat.uniforms.uFade.value = 1 - 0.8 * S.alpha * S.day;
    const asp = SIM.W / SIM.H; // tall phone screens get a wider lens so the ship still fits
    camera.fov = SIM.zoomFov ? SIM.zoomFov : (asp < 1.25 ? Math.min(88, 2 * Math.atan(0.5543 * 1.25 / asp) / D2R) : 58) + SIM.fovBoost; camera.updateProjectionMatrix();
    camera.position.set(0, 0, 0); camera.quaternion.copy(SIM.cam.q); camera.updateMatrixWorld(true);
    renderer.clear();
    renderer.render(bg, camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
  };

  // ---------------- small shared helpers
  SIM.fmtDist = function (km) {
    const a = Math.abs(km);
    if (a < 1) return (km * 1000).toFixed(a < 0.1 ? 1 : 0) + ' m';
    if (a < 1000) return km.toFixed(a < 10 ? 2 : a < 100 ? 1 : 0) + ' km';
    if (a < 1e6) return Math.round(km).toLocaleString('en-US') + ' km';
    if (a < 0.05 * AU) return (km / 1e6).toFixed(2) + ' million km';
    return (km / AU).toFixed(a < 10 * AU ? 3 : 2) + ' AU';
  };
  SIM.fmtSpeed = function (kms) {
    const a = Math.abs(kms);
    if (a < 1) return (kms * 1000).toFixed(0) + ' m/s';
    if (a < 3000) return kms.toFixed(a < 100 ? 1 : 0) + ' km/s';
    return (kms / 299792.458).toFixed(a < 299792 ? 3 : 1) + ' c';
  };
  SIM.sstep = sstep;
})();
