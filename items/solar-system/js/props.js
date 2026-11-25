/* Solar System Explorer — things the player builds: the space station (bought one module at a time) and the surface camp.
   Built in metres, group scaled to km like the other models. */
(function () {
  'use strict';
  const THREE = window.THREE;
  const std = function (color, rough, metal, extra) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: rough, metalness: metal }, extra || {})); };
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; }
  const cyl = function (r, len, mat, seg) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 24), mat); return m; };
  const box = function (x, y, z, mat) { return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), mat); };

  // ---------------------------------------------------------------- space station
  // Model units are 1/1.8 m (the whole station is scaled up 1.8x). Axes: X = long axis (docking port at +X),
  // +Z faces Earth, -Z faces space (the sky deck is on that side), Y = lab / crew-quarters direction.
  const STATION_SCALE = 0.0018;
  const STATION_PARTS = [
    { name: 'Core module', price: 150, note: 'The heart of the station: power, air and a docking port for your ship.' },
    { name: 'Solar wings', price: 250, note: 'Two big solar panels that turn sunlight into electricity.' },
    { name: 'Science lab', price: 400, note: 'A laboratory for studying the samples you bring back.' },
    { name: 'Crew quarters and sky deck', price: 600, note: 'Bunks, a kitchen, an airlock and an open deck. Now you can dock and walk around outside!' },
    { name: 'ZetaQ telescope', price: 800, note: 'A big telescope on the sky deck. Walk up to it and look at any planet.' },
    { name: 'Cupola window', price: 900, note: 'A dome of windows for watching Earth turn below.' },
    { name: 'Radiators', price: 1100, note: 'White panels that shed heat into space so the station stays cool.' },
    { name: 'Greenhouse', price: 1300, note: 'Fresh lettuce and tomatoes grown under pink lamps.' },
    { name: 'Radio dish', price: 1600, note: 'Talks to Earth and to your ship anywhere in the solar system.' },
    { name: 'Robot arm', price: 2000, note: 'Grabs visiting ships and moves cargo around.' },
    { name: 'Gravity ring', price: 2500, note: 'A spinning ring: inside it you can walk instead of float.' }
  ];
  // sky deck, in metres in the station's frame (x, y on the deck; the deck surface is at z = DECK.z, "up" is -z)
  const DECK = { x0: 4.6, x1: 22.4, y0: -4.7, y1: 4.7, z: -5.6, hatch: [6.2, 0], scope: [19.6, 0], port: [26.6, 0, 0] };
  function buildStation() {
    const g = new THREE.Group(), parts = [];
    const hull = std(0xe8ebef, 0.5, 0.25, { emissive: 0x39404a, emissiveIntensity: 0.55 }), grey = std(0x8b929c, 0.55, 0.5, { emissive: 0x20252c, emissiveIntensity: 0.5 });
    const dark = std(0x2b3038, 0.6, 0.4), gold = std(0xc9a24a, 0.35, 0.8, { emissive: 0x3a2c0c, emissiveIntensity: 0.5 }), win = std(0x10151c, 0.2, 0.6, { emissive: 0xffd89a, emissiveIntensity: 0.9 });
    const panelTex = canvasTex(256, 128, function (c, w, h) { c.fillStyle = '#12285e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3a5fb8'; c.lineWidth = 1; for (let x = 0; x <= w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.strokeStyle = '#c9a24a'; c.lineWidth = 3; c.strokeRect(1, 1, w - 2, h - 2); });
    const panel = std(0xffffff, 0.35, 0.5, { map: panelTex, emissive: 0x16306b, emissiveIntensity: 0.45, side: THREE.DoubleSide });
    const deckTex = canvasTex(256, 256, function (c, w, h) { c.fillStyle = '#59606b'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3d434c'; c.lineWidth = 2; for (let x = 0; x <= w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); c.beginPath(); c.moveTo(0, x); c.lineTo(w, x); c.stroke(); } c.fillStyle = '#ffb648'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8); });
    deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping; deckTex.repeat.set(5, 2.6);
    const logoTex = new THREE.TextureLoader().load('img/zetaq.png');
    const logoMat = new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, side: THREE.DoubleSide });
    const nameTex = canvasTex(512, 96, function (c, w, h) { c.fillStyle = '#0b1019'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffb648'; c.font = '700 60px Saira, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ZETAQ STATION', w / 2, h / 2 + 4); });
    const part = function () { const p = new THREE.Group(); g.add(p); parts.push(p); return p; };
    const tube = function (p, r, len, x, y, z, axis, mat) { const m = cyl(r, len, mat || hull); if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2; m.position.set(x, y, z); p.add(m); return m; };
    const band = function (p, r, x, y, z, axis, mat) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 8, 28), mat || grey); if (axis === 'x') m.rotation.y = Math.PI / 2; else if (axis === 'y') m.rotation.x = Math.PI / 2; m.position.set(x, y, z); p.add(m); };
    // 1 core module with a docking node and port at +X
    let p = part();
    tube(p, 2.1, 10, 0, 0, 0, 'x'); band(p, 2.14, -4.6, 0, 0, 'x'); band(p, 2.14, 4.6, 0, 0, 'x'); band(p, 2.14, 0, 0, 0, 'x', gold);
    for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), win); w.position.set(-3 + i * 2, 2.1, 0); w.rotation.x = -Math.PI / 2; p.add(w); }
    [-1, 1].forEach(function (s) { const nm = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.98), new THREE.MeshBasicMaterial({ map: nameTex })); nm.position.set(0, s * 2.13, 0); nm.rotation.x = -s * Math.PI / 2; if (s < 0) nm.rotation.z = Math.PI; p.add(nm); });
    const node = new THREE.Mesh(new THREE.SphereGeometry(2.5, 24, 16), hull); node.position.x = 6.6; p.add(node);
    tube(p, 1.2, 1.6, 9.6, 0, 0, 'x', grey); band(p, 1.3, 10.4, 0, 0, 'x', gold);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.1, 1.6, 24), grey); cone.rotation.z = Math.PI / 2; cone.position.x = -5.8; p.add(cone);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const th = box(0.7, 0.5, 0.5, dark); th.position.set(-4.2, Math.cos(a) * 2.25, Math.sin(a) * 2.25); p.add(th); }
    const whisk = cyl(0.03, 3.2, grey, 5); whisk.position.set(-3.6, -2.4, 2.4); whisk.rotation.x = -0.8; p.add(whisk);
    // 2 solar wings
    p = part();
    [-1, 1].forEach(function (s) {
      tube(p, 0.22, 5, -1.5, 0, s * 4.4, 'z', grey);
      [-1, 1].forEach(function (q) { const a = box(2.8, 0.1, 15, panel); a.position.set(-1.5 + q * 1.6, 0, s * 14.2); p.add(a); });
      const rib = box(0.3, 0.3, 15.4, gold); rib.position.set(-1.5, 0, s * 14.2); p.add(rib);
      for (let k = 0; k < 4; k++) { const c = box(6.2, 0.14, 0.14, gold); c.position.set(-1.5, 0, s * (7.6 + k * 4.4)); p.add(c); }
    });
    // 3 science lab (+Y from the node)
    p = part(); tube(p, 1.95, 8.5, 6.6, 6.6, 0, 'y'); band(p, 2.0, 6.6, 2.7, 0, 'y'); band(p, 2.0, 6.6, 10.7, 0, 'y', gold);
    for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), win); w.position.set(6.6, 4.5 + i * 2, 1.96); p.add(w); const w2 = w.clone(); w2.position.z = -1.96; w2.rotation.y = Math.PI; p.add(w2); }
    const capL = new THREE.Mesh(new THREE.SphereGeometry(1.95, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hull); capL.position.set(6.6, 10.85, 0); p.add(capL);
    // 4 crew quarters (-Y from the node) and the sky deck on the space-facing side
    p = part(); tube(p, 2.05, 9, 6.6, -6.9, 0, 'y'); band(p, 2.1, 6.6, -2.7, 0, 'y'); band(p, 2.1, 6.6, -11.2, 0, 'y');
    for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), win); w.position.set(6.6, -4.2 - i * 1.9, 2.06); p.add(w); const w2 = w.clone(); w2.position.z = -2.06; w2.rotation.y = Math.PI; p.add(w2); }
    const capH = new THREE.Mesh(new THREE.SphereGeometry(2.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), hull); capH.rotation.x = Math.PI; capH.position.set(6.6, -11.4, 0); p.add(capH);
    const K = 1 / 1.8, dx0 = DECK.x0 * K, dx1 = DECK.x1 * K, dy0 = DECK.y0 * K, dy1 = DECK.y1 * K, dz = DECK.z * K;
    const floor = box(dx1 - dx0 + 0.5, dy1 - dy0 + 0.5, 0.16, std(0xffffff, 0.8, 0.2, { map: deckTex, emissive: 0x2a2e35, emissiveIntensity: 0.6 })); floor.position.set((dx0 + dx1) / 2, 0, dz + 0.09); p.add(floor);
    [[dx0 + 0.6, 0], [dx1 - 0.6, 0], [(dx0 + dx1) / 2, 0]].forEach(function (c) { const st = cyl(0.3, Math.abs(dz) - 2.0, grey, 10); st.rotation.x = Math.PI / 2; st.position.set(c[0], c[1], dz / 2 - 1.0 + 0.1); p.add(st); });
    const rail = function (x0, y0, x1, y1) { // posts and two rails along one edge
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / 1.2));
      for (let i = 0; i <= n; i++) { const po = cyl(0.035, 0.62, grey, 6); po.rotation.x = Math.PI / 2; po.position.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, dz - 0.31); p.add(po); }
      [0.3, 0.6].forEach(function (hh) { const r = box(Math.abs(x1 - x0) + 0.05, Math.abs(y1 - y0) + 0.05, 0.04, gold); r.position.set((x0 + x1) / 2, (y0 + y1) / 2, dz - hh); p.add(r); });
    };
    rail(dx0 - 0.2, dy0 - 0.2, dx1 + 0.2, dy0 - 0.2); rail(dx0 - 0.2, dy1 + 0.2, dx1 + 0.2, dy1 + 0.2); rail(dx0 - 0.2, dy0 - 0.2, dx0 - 0.2, dy1 + 0.2); rail(dx1 + 0.2, dy0 - 0.2, dx1 + 0.2, dy1 + 0.2);
    const hatch = cyl(0.62, 0.5, grey, 16); hatch.rotation.x = Math.PI / 2; hatch.position.set(DECK.hatch[0] * K - 1.0, 0, dz - 0.2); p.add(hatch);
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), win); hl.position.set(DECK.hatch[0] * K - 1.0, 0, dz - 0.46); hl.rotation.y = Math.PI; p.add(hl);
    [[dx0 + 0.3, dy0 + 0.3], [dx0 + 0.3, dy1 - 0.3], [dx1 - 0.3, dy0 + 0.3], [dx1 - 0.3, dy1 - 0.3]].forEach(function (c) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1c4 })); l.position.set(c[0], c[1], dz - 0.75); p.add(l); const po = cyl(0.03, 0.75, grey, 6); po.rotation.x = Math.PI / 2; po.position.set(c[0], c[1], dz - 0.37); p.add(po); });
    // 5 ZetaQ telescope at the far end of the deck, with a banner beside it
    p = part();
    const sx = DECK.scope[0] * K, sy = DECK.scope[1] * K;
    const base = cyl(0.42, 0.5, dark, 14); base.rotation.x = Math.PI / 2; base.position.set(sx, sy, dz - 0.25); p.add(base);
    const fork = cyl(0.16, 0.9, grey, 10); fork.rotation.x = Math.PI / 2; fork.position.set(sx, sy, dz - 0.9); p.add(fork);
    const scope = new THREE.Group(); scope.position.set(sx, sy, dz - 1.4); scope.rotation.y = 0.55; p.add(scope);
    const tb = cyl(0.42, 2.6, hull, 20); tb.rotation.x = Math.PI / 2; scope.add(tb);
    const hood = cyl(0.47, 0.5, dark, 20); hood.rotation.x = Math.PI / 2; hood.position.z = -1.5; scope.add(hood);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), std(0x1a2a4a, 0.05, 0.9, { emissive: 0x2b5fd0, emissiveIntensity: 0.6 })); lens.position.z = -1.76; lens.rotation.y = Math.PI; scope.add(lens);
    const eye = cyl(0.1, 0.5, dark, 10); eye.position.set(0, 0, 1.2); eye.rotation.z = Math.PI / 2; eye.position.x = -0.5; scope.add(eye);
    [0.5, -0.9].forEach(function (zz) { const b2 = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.04, 6, 20), gold); b2.position.z = zz; scope.add(b2); });
    [-1, 1].forEach(function (s) { const lg = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.65), logoMat); lg.position.set(s * 0.425, 0, -0.2); lg.rotation.y = s * Math.PI / 2; lg.rotation.z = -s * Math.PI / 2; scope.add(lg); });
    const ban = box(1.5, 0.06, 2.1, dark); ban.position.set(sx - 0.2, dy1 - 0.1, dz - 1.25); p.add(ban);
    const banL = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.77), logoMat); banL.position.set(sx - 0.2, dy1 - 0.14, dz - 1.25); banL.rotation.set(Math.PI / 2, 0, Math.PI); p.add(banL);
    const banP = cyl(0.04, 0.3, grey, 6); banP.rotation.x = Math.PI / 2; banP.position.set(sx - 0.2, dy1 - 0.1, dz - 0.15); p.add(banP);
    // 6 cupola: a window dome on the Earth-facing side of the node
    p = part();
    tube(p, 1.1, 1.2, 6.6, 0, 3.0, 'z', grey);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x9fd0ff, 0.1, 0.3, { emissive: 0x9fd0ff, emissiveIntensity: 0.55, transparent: true, opacity: 0.85 }));
    dome.rotation.x = Math.PI / 2; dome.position.set(6.6, 0, 3.6); p.add(dome);
    // 7 radiators
    p = part();
    [-1, 1].forEach(function (s) { const r = box(5.5, 7, 0.1, std(0xf5f6f8, 0.4, 0.1, { side: THREE.DoubleSide, emissive: 0x40444a, emissiveIntensity: 0.5 })); r.position.set(-3.2, s * 6, 0); p.add(r); tube(p, 0.15, 1.2, -3.2, s * 2.3, 0, 'y', grey); });
    // 8 greenhouse (-X end of the core)
    p = part(); tube(p, 2.0, 7, -9.8, 0, 0, 'x'); band(p, 2.05, -6.5, 0, 0, 'x'); band(p, 2.05, -13.2, 0, 0, 'x');
    const grow = new THREE.Mesh(new THREE.CylinderGeometry(2.02, 2.02, 3.4, 24, 1, true), std(0x1a2a1a, 0.2, 0.3, { emissive: 0xff5ad0, emissiveIntensity: 0.75 })); grow.rotation.z = Math.PI / 2; grow.position.x = -9.8; p.add(grow);
    for (let i = 0; i < 5; i++) band(p, 2.06, -11.2 + i * 0.7, 0, 0, 'x', hull);
    // 9 radio dish on the side of the core
    p = part(); tube(p, 0.14, 3.2, 1.5, 3.6, 0, 'y', grey);
    const dishG = new THREE.LatheGeometry([[0, 0], [0.6, 0.06], [1.2, 0.26], [1.8, 0.62]].map(function (v) { return new THREE.Vector2(v[0], v[1]); }), 24);
    const dish = new THREE.Mesh(dishG, std(0xf0f2f5, 0.4, 0.3, { side: THREE.DoubleSide, emissive: 0x3a3d42, emissiveIntensity: 0.5 })); dish.position.set(1.5, 5.2, 0); dish.rotation.z = -0.5; p.add(dish);
    const feed = tube(p, 0.05, 1.3, 1.85, 5.75, 0, 'y', dark); feed.rotation.z = -0.5;
    // 10 robot arm on the Earth-facing side of the node
    p = part();
    const seg1 = tube(p, 0.2, 5, 8.6, -1.6, 4.2, 'z', hull); seg1.rotation.set(Math.PI / 2 + 0.5, 0, 0.3);
    const jn = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), gold); jn.position.set(9.3, -2.8, 6.3); p.add(jn);
    const seg2 = tube(p, 0.17, 4.6, 9.9, -1.4, 8.0, 'z', hull); seg2.rotation.set(Math.PI / 2 - 0.75, 0, 0.2);
    const hand = box(0.7, 0.5, 0.7, dark); hand.position.set(10.4, 0.1, 9.7); p.add(hand);
    // 11 gravity ring, spinning around the long axis
    p = part(); const ring = new THREE.Group(); ring.position.x = -17.5; p.add(ring);
    const tor = new THREE.Mesh(new THREE.TorusGeometry(13, 1.5, 12, 48), hull); tor.rotation.y = Math.PI / 2; ring.add(tor);
    for (let i = 0; i < 4; i++) { const sp = cyl(0.45, 12, grey, 10); sp.position.set(0, Math.cos(i * Math.PI / 2) * 6.5, Math.sin(i * Math.PI / 2) * 6.5); sp.rotation.x = i * Math.PI / 2; ring.add(sp); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const w = new THREE.Mesh(new THREE.CircleGeometry(0.35, 10), win); w.position.set(1.52, Math.cos(a) * 13, Math.sin(a) * 13); w.rotation.y = Math.PI / 2; ring.add(w); }
    tube(p, 1.0, 4.4, -15.2, 0, 0, 'x', grey);
    // lights
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 })); red.position.set(8.4, 0, -2.6); g.add(red);
    g.scale.setScalar(STATION_SCALE);
    g.userData = { parts: parts, ring: ring, beacon: red, setCount: function (n) { for (let i = 0; i < parts.length; i++) parts[i].visible = i < n; red.visible = n > 0; } };
    g.userData.setCount(0);
    return g;
  }

  // ---------------------------------------------------------------- surface camp
  function buildCamp() {
    const g = new THREE.Group(), parts = [];
    const white = std(0xf1f1ec, 0.7, 0.05), orange = std(0xff8a1e, 0.6, 0.1), grey = std(0x7d848e, 0.6, 0.5), dark = std(0x2a2e35, 0.7, 0.3);
    const glow = std(0x20242a, 0.3, 0.2, { emissive: 0xffd27a, emissiveIntensity: 0 });
    const bulb = new THREE.MeshBasicMaterial({ color: 0x4a4436 }), beaconM = new THREE.MeshBasicMaterial({ color: 0x551511 });
    const part = function () { const p = new THREE.Group(); g.add(p); parts.push(p); return p; };
    // 1 habitat dome with an airlock
    let p = part();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), white); p.add(dome);
    const base = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.16, 8, 32), orange); base.rotation.x = Math.PI / 2; base.position.y = 0.12; p.add(base);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(2.12, 0.07, 6, 32), orange); stripe.rotation.x = Math.PI / 2; stripe.position.y = 1.5; p.add(stripe);
    const lock = cyl(0.95, 1.9, white, 18); lock.rotation.x = Math.PI / 2; lock.position.set(0, 0.95, 2.9); p.add(lock);
    const door = new THREE.Mesh(new THREE.CircleGeometry(0.72, 18), dark); door.position.set(0, 0.95, 3.86); p.add(door);
    for (let i = 0; i < 4; i++) { const a = 0.9 + i * 1.25; const w = new THREE.Mesh(new THREE.CircleGeometry(0.36, 14), glow); w.position.set(Math.sin(a) * 2.42, 1.0, Math.cos(a) * 2.42); w.lookAt(Math.sin(a) * 9, 2.2, Math.cos(a) * 9); p.add(w); }
    // 2 solar panel
    p = part();
    const pole = cyl(0.07, 1.7, grey, 8); pole.position.set(4.6, 0.85, 0.8); p.add(pole);
    const pan = box(2.4, 0.06, 1.4, std(0x16306b, 0.3, 0.5, { emissive: 0x0a1a44, emissiveIntensity: 0.4 })); pan.position.set(4.6, 1.75, 0.8); pan.rotation.z = 0.5; p.add(pan);
    // 3 antenna mast with dish and beacon
    p = part();
    const mast = cyl(0.06, 5, grey, 8); mast.position.set(-3.8, 2.5, -1.2); p.add(mast);
    const dG = new THREE.LatheGeometry([[0, 0], [0.35, 0.05], [0.7, 0.22]].map(function (v) { return new THREE.Vector2(v[0], v[1]); }), 18);
    const dsh = new THREE.Mesh(dG, std(0xf0f2f5, 0.4, 0.3, { side: THREE.DoubleSide })); dsh.position.set(-3.8, 3.9, -1.0); dsh.rotation.x = 1.1; p.add(dsh);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), beaconM); beacon.position.set(-3.8, 5.1, -1.2); p.add(beacon);
    // 4 flag
    p = part();
    const fp = cyl(0.035, 2.8, grey, 6); fp.position.set(2.6, 1.4, 3.8); p.add(fp);
    const flagTex = canvasTex(128, 84, function (c, w, h) { c.fillStyle = '#ff8a1e'; c.fillRect(0, 0, w, h); c.fillStyle = '#0b1019'; c.fillRect(0, h * 0.62, w, h * 0.38); c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 9 : 22, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(w * 0.5 + Math.cos(a) * r, h * 0.36 + Math.sin(a) * r); } c.fill(); });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.66), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(3.12, 2.42, 3.8); p.add(flag);
    // 5 supply crates and lamps
    p = part();
    [[1.9, 0.35, -3.2, 0.7, 0.3], [2.75, 0.3, -2.7, 0.6, 1.1], [2.2, 0.95, -3.1, 0.5, 0.6]].forEach(function (c) { const b = box(c[3] * 1.3, c[3], c[3], c[1] > 0.6 ? orange : grey); b.position.set(c[0], c[1], c[2]); b.rotation.y = c[4]; p.add(b); });
    const lamps = [];
    [[-1.6, 4.4], [3.9, -1.4]].forEach(function (c) { const lp = cyl(0.04, 1.9, grey, 6); lp.position.set(c[0], 0.95, c[1]); p.add(lp); const l = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), bulb.clone()); l.position.set(c[0], 1.98, c[1]); p.add(l); lamps.push(l); });
    g.scale.setScalar(0.001);
    g.userData = {
      parts: parts,
      // k: 0..1 how much of the camp is assembled; on: powered up; time in seconds for the blinking beacon
      set: function (k, on, time) {
        for (let i = 0; i < parts.length; i++) { const v = Math.max(0, Math.min(1, k * parts.length - i)); parts[i].visible = v > 0.001; const s = v < 1 ? 0.3 + 0.7 * v * (2 - v) : 1; parts[i].scale.setScalar(s); }
        glow.emissiveIntensity = on ? 1.1 : 0;
        for (let i = 0; i < lamps.length; i++) lamps[i].material.color.setHex(on ? 0xfff1c4 : 0x4a4436);
        beaconM.color.setHex(on && (time % 1.4) < 0.25 ? 0xff3b30 : on ? 0x7a1c16 : 0x551511);
      }
    };
    g.userData.set(1, false, 0);
    return g;
  }

  window.SOLPROPS = { STATION_PARTS: STATION_PARTS, STATION_SCALE: STATION_SCALE, DECK: DECK, buildStation: buildStation, buildCamp: buildCamp };
})();
