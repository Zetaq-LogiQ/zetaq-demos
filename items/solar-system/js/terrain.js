/* Solar System Explorer — procedural terrain: noise, per-world height fields, and a cube-sphere
   quadtree that refines from orbit down to ~1 m at your feet. Heights are in km above the mean radius. */
(function () {
  'use strict';
  const imul = Math.imul, floor = Math.floor, abs = Math.abs, sqrt = Math.sqrt;

  function hashI(x, y, z, s) {
    let h = imul(x, 0x27d4eb2d) ^ imul(y, 0x165667b1) ^ imul(z, 0x9e3779b1) ^ imul(s, 0x85ebca6b);
    h = imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = imul(h ^ (h >>> 12), 0x297a2d39);
    return (h ^ (h >>> 15)) >>> 0;
  }
  function grad(h, x, y, z) {
    const g = h & 15, u = g < 8 ? x : y, v = g < 4 ? y : (g === 12 || g === 14) ? x : z;
    return ((g & 1) ? -u : u) + ((g & 2) ? -v : v);
  }
  // Perlin gradient noise, ~[-1, 1]
  function noise3(x, y, z, s) {
    const X = floor(x), Y = floor(y), Z = floor(z);
    const fx = x - X, fy = y - Y, fz = z - Z;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const w = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
    const a = grad(hashI(X, Y, Z, s), fx, fy, fz), b = grad(hashI(X + 1, Y, Z, s), fx - 1, fy, fz);
    const c = grad(hashI(X, Y + 1, Z, s), fx, fy - 1, fz), d = grad(hashI(X + 1, Y + 1, Z, s), fx - 1, fy - 1, fz);
    const e = grad(hashI(X, Y, Z + 1, s), fx, fy, fz - 1), f = grad(hashI(X + 1, Y, Z + 1, s), fx - 1, fy, fz - 1);
    const g = grad(hashI(X, Y + 1, Z + 1, s), fx, fy - 1, fz - 1), h = grad(hashI(X + 1, Y + 1, Z + 1, s), fx - 1, fy - 1, fz - 1);
    const x1 = a + u * (b - a), x2 = c + u * (d - c), x3 = e + u * (f - e), x4 = g + u * (h - g);
    const y1 = x1 + v * (x2 - x1), y2 = x3 + v * (x4 - x3);
    return y1 + w * (y2 - y1);
  }
  function sm(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

  // ---------- cube-sphere faces: [normal, axisA, axisB] with A × B = N
  const FACES = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]
  ];
  const QP = Math.PI / 4;
  const _d = [0, 0, 0];
  // (face, u, v in [-1,1]) -> unit direction (equal-angle warp), written to _d
  function faceDir(face, u, v) {
    const F = FACES[face], N = F[0], A = F[1], Bx = F[2];
    const a = Math.tan(u * QP), b = Math.tan(v * QP);
    const x = N[0] + a * A[0] + b * Bx[0], y = N[1] + a * A[1] + b * Bx[1], z = N[2] + a * A[2] + b * Bx[2];
    const l = 1 / sqrt(x * x + y * y + z * z);
    _d[0] = x * l; _d[1] = y * l; _d[2] = z * l;
    return _d;
  }
  // unit direction -> {face, u, v}
  function dirToFace(x, y, z) {
    const ax = abs(x), ay = abs(y), az = abs(z);
    let face;
    if (ax >= ay && ax >= az) face = x > 0 ? 0 : 1; else if (ay >= az) face = y > 0 ? 2 : 3; else face = z > 0 ? 4 : 5;
    const F = FACES[face], N = F[0], A = F[1], Bx = F[2];
    const n = x * N[0] + y * N[1] + z * N[2];
    const a = (x * A[0] + y * A[1] + z * A[2]) / n, b = (x * Bx[0] + y * Bx[1] + z * Bx[2]) / n;
    return { face: face, u: Math.atan(a) / QP, v: Math.atan(b) / QP };
  }

  // ---------- cellular lookup over the 8 surrounding lattice cells: nearest / second-nearest feature point
  let vF1 = 0, vF2 = 0, vH = 0, vX = 0, vY = 0, vZ = 0;
  function cells(px, py, pz, seed) {
    const bx = floor(px - 0.5), by = floor(py - 0.5), bz = floor(pz - 0.5);
    let f1 = 9, f2 = 9;
    for (let q = 0; q < 8; q++) {
      const cx = bx + (q & 1), cy = by + ((q >> 1) & 1), cz = bz + (q >> 2);
      const hh = hashI(cx, cy, cz, seed);
      const jx = cx + 0.5 + (((hh >>> 2) & 255) / 255 - 0.5) * 0.5, jy = cy + 0.5 + (((hh >>> 10) & 255) / 255 - 0.5) * 0.5, jz = cz + 0.5 + (((hh >>> 18) & 255) / 255 - 0.5) * 0.5;
      const dx = px - jx, dy = py - jy, dz = pz - jz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < f1) { f2 = f1; f1 = d2; vH = hh; vX = jx; vY = jy; vZ = jz; } else if (d2 < f2) f2 = d2;
    }
    vF1 = sqrt(f1); vF2 = sqrt(f2);
  }
  const D2R = Math.PI / 180;
  function llDir(lat, lon) { const a = lat * D2R, o = lon * D2R; return [Math.cos(a) * Math.cos(o), Math.sin(a), -Math.cos(a) * Math.sin(o)]; }

  // =====================================================================
  //  Terrain: height field for one body
  // =====================================================================
  function Terrain(body) {
    const T = body.terrain || { amp: 0.3, craters: 0.3, seed: 1 };
    this.body = body; this.T = T; this.R = body.R;
    this.seed = T.seed | 0;
    this.W0 = T.W || body.R * 0.5;
    this.gain = T.gain || 0.6;
    this.C0 = Math.min(body.R * 1.2, (T.cmax || body.R * 0.15) / 0.38);
    this.maxLevel = Math.max(1, Math.ceil(Math.log2((Math.PI / 2) * body.R / 0.046)));
    this.fineSpacing = (Math.PI / 2) * body.R / Math.pow(2, this.maxLevel) / 32;
    this.minWaveFine = this.fineSpacing * 4;
    let extra = 0;
    this.feat = (T.feat || []).map(function (f) {
      const d = llDir(f.lat, f.lon), a = f.lat * D2R, o = f.lon * D2R;
      const n = [-Math.sin(a) * Math.cos(o), Math.cos(a), Math.sin(a) * Math.sin(o)], e = [-Math.sin(o), 0, -Math.cos(o)];
      const az = (f.az || 0) * D2R, ax = [n[0] * Math.cos(az) + e[0] * Math.sin(az), n[1] * Math.cos(az) + e[1] * Math.sin(az), n[2] * Math.cos(az) + e[2] * Math.sin(az)];
      const cr = [d[1] * ax[2] - d[2] * ax[1], d[2] * ax[0] - d[0] * ax[2], d[0] * ax[1] - d[1] * ax[0]];
      const reach = (f.type === 'canyon' || f.type === 'scarp' ? (f.len || f.r) * 0.62 + (f.w || 10) * ((f.n || 1) * (f.gap || 0) + 3) : f.r * (f.type === 'crater' ? 1.7 : 1.35));
      extra = Math.max(extra, Math.abs(f.h || 0), Math.abs(f.depth || 0), f.peak || 0, f.rim || 0);
      return Object.assign({}, f, { x: d[0], y: d[1], z: d[2], ax: ax, cr: cr, cosr: Math.cos(Math.min(3.1, reach / body.R)) });
    });
    this.relief = Math.min(body.R * 0.3, T.amp * 2.6 + (T.mtn ? T.mtn[1] * 2.6 : 0) + (T.craters > 0 ? Math.min(3, this.C0 * 0.1) : 0) + 0.2 + extra + (T.lineae ? 0.6 : 0) + (T.grooves ? T.grooves.h * 2 : 0) + (T.paterae ? T.paterae.depth * 1.2 : 0));
    this.flats = [];       // [{x,y,z,r,h}] flattened pads
    this.land = null;      // Earth without elevation data: function(x,y,z) -> landness 0..1
    this.dem = null;       // real elevation: {sample(x,y,z) -> km, res: km per pixel}
    this.alb = null;       // brightness of the colour map: function(x,y,z) -> 0..1
    this.water = false;    // set by height(): true if the sampled point is open water
    this.stain = 0;        // set by height(): 0..1 strength of the world's special surface unit (ridge stain, lava, fracture …)
    this.glow = 0;         // set by height(): 0..1 incandescence (Io's lava lakes)
    this.Wd = this.W0; this.Ad = T.amp; this.Cd = this.C0;
  }
  // attach real elevation data; procedural relief is then only added below the data's resolution
  Terrain.prototype.setDEM = function (dem) {
    this.dem = dem; this.invalidate();
    const T = this.T, w = Math.min(this.W0, dem.res * 3.2);
    this.Wd = w; this.Ad = Math.min(T.amp * Math.pow(this.gain, Math.log2(this.W0 / w)), w * 0.035) * (T.demRough || 1);
    this.Cd = Math.min(this.C0, dem.res * 2.2 / 0.38);
    this.relief = Math.min(this.R * 0.3, Math.max(Math.abs(dem.min), Math.abs(dem.max)) + 1.5);
  };

  // long double ridges in every direction and at every size: Europa's "ball of string"
  Terrain.prototype.lineaeLayer = function (x, y, z, c, hh, w, seedL, dens) {
    const R = this.R, s = R / c, px = x * s, py = y * s, pz = z * s;
    const wob = 0.09 * noise3(px * 1.3 + 4.1, py * 1.3, pz * 1.3 + 2.2, seedL + 77);
    const bx = floor(px - 0.5), by = floor(py - 0.5), bz = floor(pz - 0.5);
    let sum = 0;
    for (let q = 0; q < 8; q++) {
      const cx = bx + (q & 1), cy = by + ((q >> 1) & 1), cz = bz + (q >> 2);
      const h1 = hashI(cx, cy, cz, seedL);
      if ((h1 & 255) >= dens) continue;
      const qx = cx + 0.5 + (((h1 >>> 8) & 255) / 255 - 0.5) * 0.5, qy = cy + 0.5 + (((h1 >>> 16) & 255) / 255 - 0.5) * 0.5, qz = cz + 0.5 + (((h1 >>> 24) & 255) / 255 - 0.5) * 0.5;
      const dx = px - qx, dy = py - qy, dz = pz - qz, r2 = dx * dx + dy * dy + dz * dz;
      if (r2 > 0.9) continue;
      const h2 = hashI(cx, cy, cz, seedL + 1);
      // ridge plane normal: random, made perpendicular to the local vertical so the plane cuts the ground in a line
      let mx = ((h2 & 1023) / 511.5 - 1), my = (((h2 >>> 10) & 1023) / 511.5 - 1), mz = (((h2 >>> 20) & 1023) / 511.5 - 1);
      const dt = mx * x + my * y + mz * z; mx -= dt * x; my -= dt * y; mz -= dt * z;
      const ml = sqrt(mx * mx + my * my + mz * mz); if (ml < 0.05) continue;
      const wr = w * (0.6 + ((h1 >>> 4) & 15) / 15), t = ((dx * mx + dy * my + dz * mz) / ml + wob) * c / wr, at = abs(t);
      if (at > 3) continue;
      const fade = sm((0.95 - sqrt(r2)) / 0.4);
      const g = Math.exp(-(at - 1) * (at - 1) * 3) - 0.5 * Math.exp(-t * t * 4);
      sum += hh * (0.5 + ((h2 >>> 30) & 3) / 6) * fade * g;
      const st = fade * Math.exp(-t * t * 0.45); if (st > this.stain) this.stain = st;
    }
    return sum;
  };

  Terrain.prototype.height = function (x, y, z, minWave) {
    const T = this.T, R = this.R, seed = this.seed;
    let h = 0; this.water = false; this.stain = 0; this.glow = 0;
    let coastF = 1, coast = 1, e = 0;
    const dem = this.dem;
    if (dem) e = dem.sample(x, y, z);
    const lum = this.alb ? this.alb(x, y, z) : -1;
    // explicit calm zones (ice plains such as Pluto's Sputnik Planitia)
    let calm = 0, calmH = 0;
    const ft = this.feat;
    for (let i = 0; i < ft.length; i++) {
      const f = ft[i]; if (f.type !== 'basin') continue;
      const dt = x * f.x + y * f.y + z * f.z; if (dt < f.cosr) continue;
      const dist = Math.acos(dt > 1 ? 1 : dt) * R * (1 + 0.16 * noise3(x * 5 + 1.1, y * 5, z * 5 + 3.3, seed + 960) + 0.05 * noise3(x * 23, y * 23, z * 23, seed + 961));
      const wgt = sm((f.r - dist) / (f.r * 0.07)); if (wgt > calm) { calm = wgt; calmH = f.h; }
    }
    if (T.earth) {
      if (dem) {
        coast = (e > 0.1 ? 0.5 : e < -0.1 ? -0.5 : e * 5) + 0.035 * noise3(x * R / 9, y * R / 9, z * R / 9, seed + 951);
        if (minWave < 1.2) coast += 0.012 * noise3(x * R / 1.1, y * R / 1.1, z * R / 1.1, seed + 952);
        if (minWave < 0.15) coast += 0.004 * noise3(x * R / 0.13, y * R / 0.13, z * R / 0.13, seed + 953);
      } else {
        let l;
        if (this.land) l = this.land(x, y, z); else l = 0.5 + noise3(x * 1.9 + 3.1, y * 1.9, z * 1.9 + 7.7, 5) * 1.2 + noise3(x * 5, y * 5, z * 5, 6) * 0.4;
        coast = l - 0.5 + 0.10 * noise3(x * R / 70, y * R / 70, z * R / 70, seed + 950) + 0.04 * noise3(x * R / 9, y * R / 9, z * R / 9, seed + 951);
        if (minWave < 1.2) coast += 0.012 * noise3(x * R / 1.1, y * R / 1.1, z * R / 1.1, seed + 952);
        if (minWave < 0.15) coast += 0.004 * noise3(x * R / 0.13, y * R / 0.13, z * R / 0.13, seed + 953);
      }
      if (coast <= 0) { this.water = true; h = 0; coastF = 0; }
      else coastF = sm(coast * 4);
    }
    if (coastF > 0) {
      // regional roughness mask so plains and rugged country alternate
      const m = noise3(x * 2.3 + 7.1, y * 2.3 + 1.3, z * 2.3 + 4.7, seed + 900);
      let rough = 0.5 + 0.9 * sm(m * 1.4 + 0.5);
      if (dem && T.earth) rough = 0.12 + 1.5 * sm(e / 2.2);
      let w = dem ? this.Wd : this.W0, a = dem ? this.Ad : T.amp, s = R / w, k = 0;
      const gain = this.gain, live = 1 - calm;
      if (live > 0.001) {
        while (w >= minWave && a > 2e-7) {
          h += a * noise3(x * s, y * s, z * s, seed + k) * (k < 3 && !dem ? 1 : rough);
          a *= w > 0.6 ? gain : 0.5; w *= 0.5; s *= 2; k++; // below ~600 m the spectrum steepens, keeping metre-scale slopes realistic (5-10 degrees)
        }
        // mountain / ridge band (worlds without elevation data)
        if (T.mtn && (!dem || T.earth)) {
          const mm = dem ? 2.6 * sm((e - 0.7) / 2.2) : T.mtnAll ? 1 : sm(noise3(x * 4.6 + 3.3, y * 4.6 + 0.2, z * 4.6 + 9.2, seed + 901) * 2.2 + 0.15); // Earth: real mountain belts get ridges and valleys
          if (mm > 0.002) {
            let w2 = T.mtn[0], a2 = T.mtn[1], s2 = R / w2, k2 = 0, acc = 0, prev = 1;
            while (w2 >= minWave && a2 > 2e-7) {
              let n = noise3(x * s2 + 11.5, y * s2 + 3.7, z * s2 + 5.1, seed + 50 + k2);
              if (T.ridge && w2 > 0.4) { n = 1 - abs(n) * 1.7; n = n < 0 ? 0 : n * n; acc += a2 * n * prev; prev = n * 1.4 > 1 ? 1 : n * 1.4; if (prev < 0.25) prev = 0.25; }
              else acc += a2 * n * prev * 0.7;
              a2 *= 0.5; w2 *= 0.5; s2 *= 2; k2++;
            }
            h += mm * acc;
          }
        }
        // impact craters, every scale from basins to metre-sized pits
        const dens = T.craters * 1024;
        if (dens > 0) {
          let c = dem ? this.Cd : this.C0, j = 0, ch = 0;
          while (c * 0.38 >= minWave * 0.75 && j < 24) {
            const s = R / c, px = x * s, py = y * s, pz = z * s;
            const bx = floor(px - 0.5), by = floor(py - 0.5), bz = floor(pz - 0.5);
            for (let q = 0; q < 8; q++) {
              const cx = bx + (q & 1), cy = by + ((q >> 1) & 1), cz = bz + (q >> 2);
              const hh = hashI(cx, cy, cz, seed + 300 + j);
              if ((hh & 1023) >= dens) continue;
              const h2 = hashI(cx, cy, cz, seed + 400 + j);
              const u = ((h2 >>> 8) & 1023) / 1023;
              const r = 0.1 + 0.28 * u * u;
              const ddx = px - (cx + 0.5 + (((hh >>> 10) & 255) / 255 - 0.5) * 0.4);
              const ddy = py - (cy + 0.5 + (((hh >>> 18) & 255) / 255 - 0.5) * 0.4);
              const ddz = pz - (cz + 0.5 + ((h2 & 255) / 255 - 0.5) * 0.4);
              const d2 = ddx * ddx + ddy * ddy + ddz * ddz, rr = r * 1.6;
              if (d2 >= rr * rr) continue;
              const t = sqrt(d2) / r, rk = r * c;
              const D = rk < 4 ? 0.3 * rk : 1.2 * Math.pow(rk / 4, 0.3);
              const rim = 0.22 * D;
              if (t < 1) { const t2 = t * t; ch += -D * (1 - t2) + rim * t2 * t2; }
              else { const f = (1.6 - t) / 0.6; ch += rim * f * f; }
            }
            c *= 0.5; j++;
          }
          h += ch;
        }
        // dune fields
        if (T.dunes && T.dunes[0] >= minWave * 1.5) {
          const lam = T.dunes[0];
          let dm = sm(noise3(x * 9 + 1.7, y * 9 + 5.2, z * 9 + 8.8, seed + 902) * 2.4 - 0.15);
          if (T.dunes[2] && lum >= 0) dm = sm((T.dunes[2] - lum) * 6) * (1 - sm((abs(y) - 0.45) * 8)); // Titan: the dark equatorial sand seas seen by Cassini
          if (dm > 0.01) {
            const s = R / (lam * 7);
            const ph = y * R / lam + 2.2 * noise3(x * s, y * s, z * s, seed + 903);
            const tr = abs((ph - floor(ph)) * 2 - 1);
            h += T.dunes[1] * dm * (1 - tr * tr) * (0.7 + 0.3 * noise3(x * s * 3, y * s * 3, z * s * 3, seed + 904));
          }
        }
        // ---- world-specific landforms
        if (T.lineae) {
          const L = T.lineae;
          for (let i = 0; i < L.length; i++) { const l = L[i]; if (l[2] * 3.5 < minWave) break; h += this.lineaeLayer(x, y, z, l[0], l[1], l[2], seed + 1000 + i * 7, l[3] || 150); }
        }
        if (T.chaos) { // broken, tilted ice rafts frozen into a rough matrix
          const C = T.chaos;
          const cm = sm((noise3(x * R / C.scale + 9.1, y * R / C.scale, z * R / C.scale + 1.7, seed + 970) + C.cover - 0.5) * 5);
          if (cm > 0.01 && C.cell * 1.2 >= minWave) {
            const s = R / C.cell; cells(x * s, y * s, z * s, seed + 971);
            const edge = vF2 - vF1, raft = sm(edge * 7 - 0.25);
            const tiltx = ((vH >>> 3) & 255) / 255 - 0.5, tilty = ((vH >>> 11) & 255) / 255 - 0.5, lift = ((vH >>> 19) & 255) / 255;
            let ph = raft * (C.h * (0.35 + lift) + C.h * 1.6 * (tiltx * (x * s - vX) + tilty * (z * s - vZ))) - (1 - raft) * C.h * 0.5;
            if (C.cell * 0.12 >= minWave) ph += (1 - raft) * C.h * 0.5 * noise3(x * s * 7, y * s * 7, z * s * 7, seed + 972);
            h += cm * ph; const st = cm * (1 - raft) * 0.9; if (st > this.stain) this.stain = st;
          }
        }
        if (T.grooves) { // sets of parallel ridges and troughs, each region with its own direction
          const G = T.grooves, s = R / G.region; cells(x * s, y * s, z * s, seed + 980);
          let on = ((vH >>> 5) & 255) / 255 < G.cover ? 1 : 0;
          if (G.byAlb && lum >= 0) on = sm((lum - G.byAlb) * 9);
          if (G.south) on *= sm((-y - G.south) * 9);
          if (on > 0.01 && G.lam * 1.6 >= minWave) {
            let mx = ((vH & 1023) / 511.5 - 1), my = (((vH >>> 10) & 1023) / 511.5 - 1) * 0.6, mz = (((vH >>> 20) & 1023) / 511.5 - 1);
            const dt = mx * x + my * y + mz * z; mx -= dt * x; my -= dt * y; mz -= dt * z; const ml = sqrt(mx * mx + my * my + mz * mz) || 1;
            const ph = (x * mx + y * my + z * mz) / ml * R / G.lam + 1.3 * noise3(x * R / (G.lam * 9), y * R / (G.lam * 9), z * R / (G.lam * 9), seed + 981);
            let tr = abs((ph - floor(ph)) * 2 - 1); tr = tr * tr * (3 - 2 * tr);
            let gh = G.h * (tr - 0.5);
            if (G.lam * 0.14 >= minWave) { const p2 = ph * 3.7; const t2 = abs((p2 - floor(p2)) * 2 - 1); gh += G.h * 0.22 * (t2 - 0.5); }
            const ed = on * sm((vF2 - vF1) * 5 + 0.15);
            h += ed * gh; if (G.stain) { const st = ed * (1 - tr) * G.stain; if (st > this.stain) this.stain = st; }
          }
        }
        if (T.paterae) { // Io: flat-floored volcanic pits (dark spots on the map are the real ones) and lava flow fields
          const P = T.paterae; let pit = 0;
          if (lum >= 0) pit = sm((P.dark - lum) * 9);
          const s = R / P.c, px = x * s, py = y * s, pz = z * s; cells(px, py, pz, seed + 990);
          if (((vH >>> 7) & 255) < P.dens) {
            const rr = 0.16 + 0.2 * ((vH >>> 15) & 255) / 255;
            const t = vF1 / rr * (1 + 0.25 * noise3(px * 4, py * 4, pz * 4, seed + 991));
            const p2 = sm((1 - t) / 0.14); if (p2 > pit) pit = p2;
          }
          if (pit > 0) { h = h * (1 - pit * 0.85) - P.depth * pit; if (pit > this.stain) this.stain = pit; this.glow = sm(pit * 3 - 2) * sm(noise3(x * R / 2.5, y * R / 2.5, z * R / 2.5, seed + 992) * 3 + 0.2); }
          else if (P.flow * 0.2 >= minWave) { // overlapping lava flow lobes on the plains
            const fl = noise3(x * R / P.flow + 5.5, y * R / P.flow, z * R / P.flow, seed + 993) + 0.5 * noise3(x * R / P.flow * 2.7, y * R / P.flow * 2.7, z * R / P.flow * 2.7, seed + 994);
            const lob = sm(fl * 6 - 1.2); h += lob * 0.012; const st = lob * 0.75; if (st > this.stain) this.stain = st;
          }
        }
        if (T.cells && T.cells.c * 0.25 >= minWave) { // polygonal / dimpled ground (Triton's cantaloupe terrain)
          const C = T.cells, s = R / C.c; cells(x * s, y * s, z * s, seed + 985);
          const edge = vF2 - vF1, wall = 1 - sm(edge * 5);
          const on = C.cover >= 1 ? 1 : sm((noise3(x * 3.1 + 2.2, y * 3.1, z * 3.1 + 6.6, seed + 986) + C.cover - 0.5) * 6);
          h += on * (C.rim * wall - C.depth * (1 - wall) * (1 - vF1 * vF1 * 3));
        }
      }
      if (calm > 0) { // nitrogen-ice plain: flat, with convection polygons outlined by shallow troughs and small sublimation pits
        let ph = calmH;
        if (T.poly && T.poly.c * 0.12 >= minWave) {
          const s = R / T.poly.c; cells(x * s, y * s, z * s, seed + 987);
          const edge = vF2 - vF1, tr = 1 - sm(edge * 14);
          ph += -T.poly.depth * tr + T.poly.depth * 0.5 * (0.5 - vF1); if (tr * 0.7 > this.stain * (1 - calm)) this.stain = Math.max(this.stain * (1 - calm), tr * 0.7 * calm);
          if (0.25 >= minWave) ph -= 0.02 * sm(noise3(x * R / 0.9, y * R / 0.9, z * R / 0.9, seed + 988) * 4 - 1.6);
        }
        h = h * (1 - calm) + ph * calm;
      }
      if (T.earth) {
        if (dem) h = 0.0015 + coastF * ((e > 0 ? e : 0) + abs(h) * 0.55) + (coast > 0.5 ? 0.5 : coast) * 0.02;
        else h = 0.0015 + coastF * (abs(h) * 0.55) + coast * 0.02;
      } else if (dem) h += e;
    }
    // ---- named landforms at their real coordinates
    for (let i = 0; i < ft.length; i++) {
      const f = ft[i]; if (f.type === 'basin') continue;
      const dt = x * f.x + y * f.y + z * f.z; if (dt < f.cosr) continue;
      if (f.type === 'crater') { // complex crater: flat floor, terraced wall, raised rim, optional central peak
        const t = Math.acos(dt > 1 ? 1 : dt) * R / f.r * (1 + 0.05 * noise3(x * R / f.r * 3, y * R / f.r * 3, z * R / f.r * 3, seed + 940 + i));
        if (t < 1.7) {
          let p;
          if (t < 1) { const wl = sm((t - 0.55) / 0.45); p = -f.depth + (f.depth + f.rim) * wl * wl; if (f.peak) p += f.peak * Math.exp(-t * t * 60); if (t > 0.6 && f.r * 0.1 >= minWave) p += f.depth * 0.04 * Math.sin(t * 38); }
          else { const q = (1.7 - t) / 0.7; p = f.rim * q * q; }
          const keep = t < 1 ? 0.25 : 0.25 + 0.75 * sm((t - 1) / 0.5);
          h = h * keep + p;
        }
      } else if (f.type === 'rings') { // multi-ring impact structure (Valhalla on Callisto)
        const dkm = Math.acos(dt > 1 ? 1 : dt) * R;
        if (dkm < f.r) { const fade = sm((f.r - dkm) / (f.r * 0.3)) * sm(dkm / (f.r * 0.18)); const ph = dkm / f.lam + 0.6 * noise3(x * 9, y * 9, z * 9, seed + 941); let tr = abs((ph - floor(ph)) * 2 - 1); tr = tr * tr; h += f.h * fade * (tr - 0.35); h *= 1 - 0.7 * (1 - sm(dkm / (f.r * 0.16))); }
      } else if (f.type === 'mount') { // isolated massif
        const dkm = Math.acos(dt > 1 ? 1 : dt) * R, t = dkm / f.r;
        if (t < 1.3) { const g = Math.exp(-t * t * 3.2); let n = 1; if (f.r * 0.3 >= minWave) n = 0.72 + 0.5 * abs(noise3(x * R / (f.r * 0.35), y * R / (f.r * 0.35), z * R / (f.r * 0.35), seed + 942 + i)) + 0.2 * noise3(x * R / (f.r * 0.09), y * R / (f.r * 0.09), z * R / (f.r * 0.09), seed + 943); h += f.h * g * n; }
      } else if (f.type === 'canyon' || f.type === 'scarp') { // straight troughs (tiger stripes, chasmata) or a single great cliff
        const along = (x * f.ax[0] + y * f.ax[1] + z * f.ax[2]) * R, across = (x * f.cr[0] + y * f.cr[1] + z * f.cr[2]) * R;
        const L = f.len * 0.5, fa = sm((L - abs(along)) / (L * 0.25));
        if (fa > 0) {
          const wob = f.w * 0.9 * noise3(along / (f.w * 7) + 3.3, i * 7.7, 1.1, seed + 944);
          if (f.type === 'scarp') h += f.h * fa * (sm((across + wob) / f.w + 0.5) - 0.5) * sm((f.w * 14 - abs(across)) / (f.w * 8));
          else {
            const n = f.n || 1, gap = (f.gap || 0) * f.w;
            for (let k = 0; k < n; k++) {
              const t = (across + wob - (k - (n - 1) / 2) * gap) / f.w, at = abs(t);
              if (at < 3) { const tr = sm(1.25 - at); h += fa * (-f.depth * tr + (f.rim || 0) * Math.exp(-(at - 1.5) * (at - 1.5) * 4)); const st = fa * tr; if (f.stain && st > this.stain) this.stain = st; if (f.glow) this.glow = Math.max(this.glow, fa * sm(0.5 - at)); }
            }
          }
        }
      } else if (f.type === 'eqridge') { // Iapetus: a mountain wall running along the equator
        const lon = Math.atan2(-z, x) / D2R; let dl = abs(lon - f.lon); if (dl > 180) dl = 360 - dl;
        const fa = sm((f.span * 0.5 - dl) / 25), t = y * R / f.w;
        if (fa > 0 && abs(t) < 3) h += f.h * fa * Math.exp(-t * t * 1.4) * (0.75 + 0.35 * noise3(x * R / 60, y * R / 60, z * R / 60, seed + 945));
      }
    }
    const fl = this.flats;
    for (let i = 0; i < fl.length && !this._noFlats; i++) {
      const f = fl[i];
      const dt = x * f.x + y * f.y + z * f.z;
      if (dt < f.cosr) continue;
      const dist = sqrt(Math.max(0, 2 * (1 - dt))) * R;
      const wgt = sm((f.r - dist) / (f.r * 0.6));
      let fh = f.h;
      if (fh == null) { // natural ground level at the pad centre, worked out once (and again if the terrain data changes)
        if (f.h0 == null) { const sw = this.water, ss = this.stain, sg = this.glow; this._noFlats = true; f.h0 = this.height(f.x, f.y, f.z, Math.max(this.minWaveFine, f.r * 2)); this._noFlats = false; this.water = sw; this.stain = ss; this.glow = sg; }
        fh = f.h0;
      }
      h += (fh - h) * wgt;
      if (wgt > 0.3) this.water = false;
      this.stain *= 1 - wgt;
    }
    return h;
  };
  Terrain.prototype.heightFine = function (x, y, z) { return this.height(x, y, z, this.minWaveFine); };
  // flatten a pad of radius r km; h omitted = keep the natural ground level at its centre
  Terrain.prototype.addFlat = function (x, y, z, r, h, tmp) {
    this.flats.push({ x: x, y: y, z: z, r: r, h: h, h0: null, tmp: !!tmp, cosr: Math.cos(r / this.R) });
  };
  // remove temporary pads (the ship's last landing spot); permanent ones (launch pad, camps) stay
  Terrain.prototype.clearFlats = function () { this.flats = this.flats.filter(function (f) { return !f.tmp; }); };
  Terrain.prototype.invalidate = function () { for (let i = 0; i < this.flats.length; i++) this.flats[i].h0 = null; };

  // brightness / tone variation written to out[o..o+3] (rgb multiplier + incandescence)
  Terrain.prototype.shade = function (x, y, z, minWave, out, o, stain, glow) {
    const R = this.R, seed = this.seed, T = this.T;
    let t = 1, hue = 0;
    if (60 >= minWave && R > 200) { const s = R / 60; t += 0.07 * noise3(x * s, y * s, z * s, seed + 700); }
    if (1.6 >= minWave) { const s = R / 1.6; const n = noise3(x * s, y * s, z * s, seed + 701); t += 0.08 * n; hue += n; }
    if (0.06 >= minWave) { const s = R / 0.06; const n = noise3(x * s, y * s, z * s, seed + 702); t += 0.09 * n; hue -= n * 0.6; }
    if (0.008 >= minWave) { const s = R / 0.008; t += 0.06 * noise3(x * s, y * s, z * s, seed + 703); }
    const hk = T.hue == null ? 1 : T.hue;
    let r = t * (1 + 0.025 * hue * hk), g = t, b = t * (1 - 0.03 * hue * hk);
    if (T.patch && 8 >= minWave) { // frost / dust patches in a second colour
      const P = T.patch, k = sm((noise3(x * R / P[3] + 8.8, y * R / P[3], z * R / P[3] + 2.4, seed + 705) + 0.35 * noise3(x * R / P[3] * 5, y * R / P[3] * 5, z * R / P[3] * 5, seed + 706)) * 3 + P[4]);
      r *= 1 + (P[0] - 1) * k; g *= 1 + (P[1] - 1) * k; b *= 1 + (P[2] - 1) * k;
    }
    if (stain > 0 && T.stain) { const S = T.stain; r *= 1 + (S[0] - 1) * stain; g *= 1 + (S[1] - 1) * stain; b *= 1 + (S[2] - 1) * stain; }
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = glow || 0;
  };

  // which surface material is exposed here (index into body.materials); stain = value left by the last height() call
  Terrain.prototype.materialIndex = function (x, y, z, stain) {
    const mats = this.body.materials; if (!mats) return 0;
    const R = this.R, seed = this.seed, T = this.T;
    if (stain == null) stain = this.stain;
    if (T.stainMat != null && stain > 0.45) return T.stainMat;
    const v = 0.55 * noise3(x * R / 2.6 + 1.3, y * R / 2.6, z * R / 2.6, seed + 800) + 0.45 * noise3(x * R / 0.11, y * R / 0.11 + 2.1, z * R / 0.11, seed + 801) + 0.3 * noise3(x * R / 0.021, y * R / 0.021, z * R / 0.021 + 4.4, seed + 802);
    let u = 0.5 + v * 1.9; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
    if (!this._cum) { let tot = 0; this._cum = mats.map(function (m) { tot += m.w; return tot; }); this._tot = tot; }
    const target = u * this._tot;
    for (let i = 0; i < this._cum.length; i++) if (target < this._cum[i]) return i;
    return mats.length - 1;
  };

  // real elevation raster: 16-bit values in an equirectangular grid, bicubic lookup (km above the reference radius)
  function makeDEM(data, W, H, min, max, R) {
    const k = (max - min) / 65535, w = [0, 0, 0, 0];
    function cub(t, o) { const t2 = t * t, t3 = t2 * t; o[0] = -0.5 * t3 + t2 - 0.5 * t; o[1] = 1.5 * t3 - 2.5 * t2 + 1; o[2] = -1.5 * t3 + 2 * t2 + 0.5 * t; o[3] = 0.5 * t3 - 0.5 * t2; }
    const wy = [0, 0, 0, 0];
    return {
      min: min, max: max, res: 2 * Math.PI * R / W, W: W, H: H,
      sample: function (x, y, z) {
        const fx = (Math.atan2(-z, x) / (2 * Math.PI) + 0.5) * W - 0.5, fy = (0.5 - Math.asin(y > 1 ? 1 : y < -1 ? -1 : y) / Math.PI) * H - 0.5;
        const x0 = floor(fx), y0 = floor(fy); cub(fx - x0, w); cub(fy - y0, wy);
        let s = 0;
        for (let j = 0; j < 4; j++) {
          let yy = y0 - 1 + j; yy = yy < 0 ? 0 : yy >= H ? H - 1 : yy; const row = yy * W; let r = 0;
          for (let i = 0; i < 4; i++) { let xx = x0 - 1 + i; xx = xx < 0 ? xx + W : xx >= W ? xx - W : xx; r += data[row + xx] * w[i]; }
          s += r * wy[j];
        }
        return min + s * k;
      }
    };
  }
  // brightness raster of the colour map: bilinear lookup, 0..1
  function makeAlb(data, W, H) {
    return function (x, y, z) {
      const fx = (Math.atan2(-z, x) / (2 * Math.PI) + 0.5) * W - 0.5, fy = (0.5 - Math.asin(y > 1 ? 1 : y < -1 ? -1 : y) / Math.PI) * H - 0.5;
      const x0 = floor(fx), y0 = Math.max(0, Math.min(H - 2, floor(fy))), ax = fx - x0, ay = Math.max(0, Math.min(1, fy - y0));
      const xa = (x0 + W) % W, xb = (x0 + 1 + W) % W;
      const a = data[y0 * W + xa], b = data[y0 * W + xb], c = data[(y0 + 1) * W + xa], d = data[(y0 + 1) * W + xb];
      return (a + (b - a) * ax + (c - a) * ay + (a - b - c + d) * ax * ay) / 255;
    };
  }

  // =====================================================================
  //  Quadtree LOD
  // =====================================================================
  const N = 32, NV = N + 1, NS = N + 3;
  const VCOUNT = NV * NV + 4 * NV;
  let sharedIndex = null;
  function getIndex(THREE) {
    if (sharedIndex) return sharedIndex;
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * NV + i, b = a + 1, c = a + NV, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const base = NV * NV;
    const edge = [function (k) { return k; }, function (k) { return N * NV + k; }, function (k) { return k * NV; }, function (k) { return k * NV + N; }];
    for (let e = 0; e < 4; e++) for (let k = 0; k < N; k++) {
      const e0 = edge[e](k), e1 = edge[e](k + 1), s0 = base + e * NV + k, s1 = s0 + 1;
      if (e === 1 || e === 2) idx.push(e0, e1, s0, e1, s1, s0); else idx.push(e0, s0, e1, e1, s0, s1);
    }
    sharedIndex = new THREE.BufferAttribute(new Uint16Array(idx), 1);
    return sharedIndex;
  }
  const P = new Float64Array(NS * NS * 3);
  const D = new Float64Array(NS * NS * 3);
  const tmpT = [0, 0, 0];

  function TerrainLOD(THREE, terrain, material, group) {
    this.THREE = THREE; this.t = terrain; this.mat = material; this.group = group;
    this.R = terrain.R; this.maxLevel = terrain.maxLevel; this.K = 1.75;
    this.queue = []; this.count = 0; this.pending = 0;
    this.scanCols = (terrain.body.materials || []).map(function (m) { const c = new THREE.Color(m.c); return [c.r * 255, c.g * 255, c.b * 255]; });
    this.roots = [];
    for (let f = 0; f < 6; f++) { const n = this.makeNode(f, 0, 0, 0); this.build(n); this.roots.push(n); }
  }
  TerrainLOD.prototype.levelWave = function (level) {
    const spacing = (Math.PI / 2) * this.R / Math.pow(2, level) / N;
    return Math.max(this.t.minWaveFine, spacing * 4);
  };
  TerrainLOD.prototype.makeNode = function (face, level, ix, iy) {
    const n = Math.pow(2, level);
    const d = faceDir(face, -1 + 2 * (ix + 0.5) / n, -1 + 2 * (iy + 0.5) / n);
    const dx = d[0], dy = d[1], dz = d[2];
    const h = this.t.height(dx, dy, dz, this.levelWave(level));
    const r = this.R + h;
    return { face: face, level: level, ix: ix, iy: iy, dx: dx, dy: dy, dz: dz, cx: dx * r, cy: dy * r, cz: dz * r, size: (Math.PI / 2) * this.R / n, mesh: null, ch: null, pri: 0 };
  };
  TerrainLOD.prototype.build = function (node) {
    const THREE = this.THREE, t = this.t, R = this.R;
    const n = Math.pow(2, node.level), du = 2 / n / N;
    const u0 = -1 + 2 * node.ix / n, v0 = -1 + 2 * node.iy / n;
    const mw = this.levelWave(node.level);
    const doScan = node.level >= this.maxLevel - 7 && this.scanCols.length > 0;
    const water = new Uint8Array(NV * NV), stn = new Float32Array(NV * NV), glw = new Float32Array(NV * NV);
    for (let j = 0; j < NS; j++) for (let i = 0; i < NS; i++) {
      const d = faceDir(node.face, u0 + (i - 1) * du, v0 + (j - 1) * du);
      const h = t.height(d[0], d[1], d[2], mw), r = R + h, o = (j * NS + i) * 3;
      D[o] = d[0]; D[o + 1] = d[1]; D[o + 2] = d[2];
      P[o] = d[0] * r; P[o + 1] = d[1] * r; P[o + 2] = d[2] * r;
      if (i >= 1 && i <= NV && j >= 1 && j <= NV) { const wi = (j - 1) * NV + (i - 1); if (t.water) water[wi] = 1; stn[wi] = t.stain; glw[wi] = t.glow; }
    }
    const pos = new Float32Array(VCOUNT * 3), nor = new Float32Array(VCOUNT * 3), tint = new Float32Array(VCOUNT * 4), scan = new Uint8Array(VCOUNT * 3);
    let maxR2 = 0;
    for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) {
      const o = ((j + 1) * NS + (i + 1)) * 3, k = (j * NV + i) * 3;
      const x = P[o] - node.cx, y = P[o + 1] - node.cy, z = P[o + 2] - node.cz;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      const r2 = x * x + y * y + z * z; if (r2 > maxR2) maxR2 = r2;
      const ax = P[o + 3] - P[o - 3], ay = P[o + 4] - P[o - 2], az = P[o + 5] - P[o - 1];
      const ob = o + NS * 3, oa = o - NS * 3;
      const bx = P[ob] - P[oa], by = P[ob + 1] - P[oa + 1], bz = P[ob + 2] - P[oa + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const l = 1 / sqrt(nx * nx + ny * ny + nz * nz);
      nor[k] = nx * l; nor[k + 1] = ny * l; nor[k + 2] = nz * l;
      const k4 = (j * NV + i) * 4, wi = j * NV + i;
      if (water[wi]) { tint[k4] = 1; tint[k4 + 1] = 1; tint[k4 + 2] = 1; tint[k4 + 3] = 0; scan[k] = 30; scan[k + 1] = 90; scan[k + 2] = 200; }
      else {
        t.shade(D[o], D[o + 1], D[o + 2], mw, tint, k4, stn[wi], glw[wi]);
        if (doScan) { const c = this.scanCols[t.materialIndex(D[o], D[o + 1], D[o + 2], stn[wi])]; scan[k] = c[0]; scan[k + 1] = c[1]; scan[k + 2] = c[2]; }
        else { scan[k] = 128; scan[k + 1] = 128; scan[k + 2] = 128; }
      }
    }
    // skirts hide the cracks between neighbouring detail levels
    const skirt = node.size * 0.12, base = NV * NV;
    const edge = [function (q) { return q; }, function (q) { return N * NV + q; }, function (q) { return q * NV; }, function (q) { return q * NV + N; }];
    for (let e = 0; e < 4; e++) for (let q = 0; q < NV; q++) {
      const src = edge[e](q) * 3, dst = (base + e * NV + q) * 3;
      const o = ((floor(edge[e](q) / NV) + 1) * NS + (edge[e](q) % NV + 1)) * 3;
      pos[dst] = pos[src] - D[o] * skirt; pos[dst + 1] = pos[src + 1] - D[o + 1] * skirt; pos[dst + 2] = pos[src + 2] - D[o + 2] * skirt;
      nor[dst] = nor[src]; nor[dst + 1] = nor[src + 1]; nor[dst + 2] = nor[src + 2];
      { const s4 = edge[e](q) * 4, d4 = (base + e * NV + q) * 4; tint[d4] = tint[s4]; tint[d4 + 1] = tint[s4 + 1]; tint[d4 + 2] = tint[s4 + 2]; tint[d4 + 3] = tint[s4 + 3]; }
      scan[dst] = scan[src]; scan[dst + 1] = scan[src + 1]; scan[dst + 2] = scan[src + 2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 4));
    g.setAttribute('scan', new THREE.BufferAttribute(scan, 3, true));
    g.setIndex(getIndex(THREE));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), sqrt(maxR2) + skirt);
    const mesh = new THREE.Mesh(g, this.mat);
    mesh.position.set(node.cx, node.cy, node.cz);
    mesh.visible = false;
    this.group.add(mesh);
    node.mesh = mesh; this.count++;
  };
  TerrainLOD.prototype.disposeNode = function (node) {
    if (node.ch) { for (let i = 0; i < 4; i++) this.disposeNode(node.ch[i]); node.ch = null; }
    if (node.mesh) { this.group.remove(node.mesh); node.mesh.geometry.setIndex(null); node.mesh.geometry.dispose(); node.mesh = null; this.count--; }
  };
  TerrainLOD.prototype.hide = function (node) {
    if (node.mesh) node.mesh.visible = false;
    if (node.ch) for (let i = 0; i < 4; i++) this.hide(node.ch[i]);
  };
  TerrainLOD.prototype.visit = function (node) {
    const c = this.cam, R = this.R;
    const ddx = c.x - node.cx, ddy = c.y - node.cy, ddz = c.z - node.cz;
    const d = sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
    let cosA = (node.dx * c.x + node.dy * c.y + node.dz * c.z) / this.rc; cosA = cosA > 1 ? 1 : cosA < -1 ? -1 : cosA;
    const beyond = Math.acos(cosA) - node.size * 0.75 / R > this.horiz;
    const split = node.level < this.maxLevel && !beyond && d < node.size * this.K;
    if (split) {
      if (!node.ch) {
        node.ch = [];
        for (let q = 0; q < 4; q++) node.ch.push(this.makeNode(node.face, node.level + 1, node.ix * 2 + (q & 1), node.iy * 2 + (q >> 1)));
      }
      let ready = true;
      for (let q = 0; q < 4; q++) {
        const ch = node.ch[q];
        if (!ch.mesh) { ready = false; const ex = c.x - ch.cx, ey = c.y - ch.cy, ez = c.z - ch.cz; ch.pri = sqrt(ex * ex + ey * ey + ez * ez) / ch.size; this.queue.push(ch); }
      }
      if (ready) { node.mesh.visible = false; for (let q = 0; q < 4; q++) this.visit(node.ch[q]); }
      else { node.mesh.visible = true; for (let q = 0; q < 4; q++) this.hide(node.ch[q]); }
    } else {
      node.mesh.visible = !beyond;
      if (node.ch) {
        if (beyond || d > node.size * this.K * 1.25) { for (let q = 0; q < 4; q++) this.disposeNode(node.ch[q]); node.ch = null; }
        else for (let q = 0; q < 4; q++) this.hide(node.ch[q]);
      }
    }
  };
  // cam: camera position in the planet's rotating frame (km)
  TerrainLOD.prototype.update = function (cam, budgetMs) {
    this.cam = cam;
    const t = this.t, R = this.R;
    this.rc = sqrt(cam.x * cam.x + cam.y * cam.y + cam.z * cam.z);
    const Rlow = R - t.relief, Rhigh = R + t.relief;
    this.horiz = Math.acos(Math.min(1, Rlow / Math.max(this.rc, Rlow))) + Math.acos(Rlow / Rhigh) + 0.002;
    this.queue.length = 0;
    for (let f = 0; f < 6; f++) this.visit(this.roots[f]);
    const q = this.queue; this.pending = q.length;
    if (q.length) {
      q.sort(function (a, b) { return a.pri - b.pri; });
      const t0 = performance.now(); let built = 0;
      for (let i = 0; i < q.length; i++) {
        if (built > 0 && performance.now() - t0 > budgetMs) break;
        this.build(q[i]); built++;
      }
    }
  };
  TerrainLOD.prototype.dispose = function () {
    for (let f = 0; f < 6; f++) this.disposeNode(this.roots[f]);
    this.roots = [];
  };

  window.SOLTERRAIN = { makeDEM: makeDEM, makeAlb: makeAlb, llDir: llDir, Terrain: Terrain, TerrainLOD: TerrainLOD, noise3: noise3, hashI: hashI, faceDir: faceDir, dirToFace: dirToFace, sm: sm };
})();
