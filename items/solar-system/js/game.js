/* Solar System Explorer — ship flight, launch / landing / autopilot sequences, astronaut EVA, rocks and samples. */
(function () {
  'use strict';
  const SIM = window.SIM; if (!SIM || SIM.failed) return;
  const THREE = window.THREE, TR = window.SOLTERRAIN, MODELS = window.SOLMODELS, PROPS = window.SOLPROPS, GFX = window.SOLGFX;
  const sfx = function (n) { if (SIM.sfx) SIM.sfx(n); };
  const V3 = THREE.Vector3, Q4 = THREE.Quaternion;
  const sm = TR.sm, sun = SIM.sun;
  const YUP = new V3(0, 1, 0), ZAX = new V3(0, 0, 1);

  const input = SIM.input = { keys: {}, mdx: 0, mdy: 0, stickX: 0, stickY: 0, up: 0, go: 0, back: 0, boost: 0 };
  const key = function (c) { return input.keys[c] ? 1 : 0; };
  const ship = SIM.ship = { docked: false, body: null, rot: true, p: new V3(), q: new Q4(), v: new V3(), landed: true, water: false, seq: null, after: null, view: 'chase', thrust: 0, lift: 0, speed: 0, alt: 0, nearAlt: 1 };
  const player = SIM.player = { body: null, p: new V3(), fwd: new V3(1, 0, 0), face: new V3(1, 0, 0), pitch: -0.12, vy: 0, air: false, phase: 0, moving: 0, scan: false, first: false, speed: 0, alt: 0 };
  SIM.mode = 'ship';
  SIM.say = SIM.say || function () {}; SIM.banner = SIM.banner || function () {};

  // ---------- models
  const shipModel = MODELS.buildShip(); SIM.scene.add(shipModel);
  const astro = MODELS.buildAstronaut(); astro.visible = false; SIM.scene.add(astro);
  const REST = shipModel.userData.rest + 0.00012;
  // ---------- small maths helpers
  const _m = new THREE.Matrix4(), _x = new V3(), _y = new V3(), _z = new V3();
  function lookQuat(fwd, up, out) {
    _z.copy(fwd).multiplyScalar(-1).normalize();
    _x.crossVectors(up, _z);
    if (_x.lengthSq() < 1e-12) _x.crossVectors(Math.abs(_z.y) < 0.9 ? YUP : new V3(1, 0, 0), _z);
    _x.normalize(); _y.crossVectors(_z, _x);
    _m.makeBasis(_x, _y, _z);
    return out.setFromRotationMatrix(_m);
  }
  function levelQuat(up, fwdHint, out) {
    const f = new V3().copy(fwdHint).addScaledVector(up, -fwdHint.dot(up));
    if (f.lengthSq() < 1e-10) f.crossVectors(up, Math.abs(up.y) < 0.9 ? YUP : new V3(1, 0, 0));
    return lookQuat(f.normalize(), up, out);
  }
  function slerpDir(a, b, k, out) {
    const c = Math.max(-1, Math.min(1, a.dot(b))), om = Math.acos(c);
    if (om < 1e-5) return out.copy(a).lerp(b, k).normalize();
    const s = Math.sin(om);
    return out.copy(a).multiplyScalar(Math.sin((1 - k) * om) / s).addScaledVector(b, Math.sin(k * om) / s).normalize();
  }
  const qi = new Q4();
  function shipInertial(P, Q) { P.copy(ship.p); Q.copy(ship.q); if (ship.rot) { P.applyQuaternion(ship.body.q); Q.premultiply(ship.body.q); } }
  const fP = new V3(), fQ = new Q4(), fV = new V3();
  function setFrame(body, rot) {
    if (body === ship.body && rot === ship.rot) return;
    shipInertial(fP, fQ); fV.copy(ship.v); if (ship.rot) fV.applyQuaternion(ship.body.q);
    fP.add(ship.body.pos).sub(body.pos);
    if (rot) { qi.copy(body.q).invert(); fP.applyQuaternion(qi); fQ.premultiply(qi); fV.applyQuaternion(qi); }
    ship.body = body; ship.rot = rot; ship.p.copy(fP); ship.q.copy(fQ).normalize(); ship.v.copy(fV);
  }
  SIM.setFrame = setFrame;
  const aP = new V3();
  // altitude of the ship above the ground of its frame body
  function shipGround() {
    const b = ship.body, r = ship.p.length();
    aP.copy(ship.p); if (!ship.rot) { qi.copy(b.q).invert(); aP.applyQuaternion(qi); }
    aP.divideScalar(r);
    let g;
    const near = Math.max(80, b.R * 0.03) + (b.terrain ? b.terrain.relief : 0);
    if (r - b.R < near || !b.d.landable) g = SIM.groundR(b, aP.x, aP.y, aP.z); else { g = b.R; SIM.water = false; }
    return { r: r, g: g, alt: r - g };
  }

  const pad = MODELS.buildPad();
  (function () {
    const e = SIM.byId.earth, d = SIM.KSC;
    pad.position.copy(d).multiplyScalar(e.R + 0.004);
    const east = new V3().crossVectors(YUP, d).normalize();
    lookQuat(east, d, pad.quaternion);
    e.group.add(pad);
  })();


  // ---------- placing the ship
  SIM.placeLanded = function (body, dir, heading) {
    ship.body = body; ship.rot = true;
    const g = SIM.groundR(body, dir.x, dir.y, dir.z); ship.water = SIM.water;
    ship.p.copy(dir).multiplyScalar(g + REST);
    levelQuat(dir, heading || new V3().crossVectors(YUP, dir), ship.q);
    ship.v.set(0, 0, 0); ship.landed = true; ship.seq = null; ship.after = null;
  };
  SIM.placeOrbit = function (body, altKm, dir) {
    ship.body = body; ship.rot = false;
    const d = dir ? dir.clone().normalize() : body === sun ? new V3(1, 0, 0) : body.sunDir.clone().multiplyScalar(0.85).addScaledVector(body.pole, 0.3).add(new V3().crossVectors(body.pole, body.sunDir).multiplyScalar(0.45)).normalize();
    ship.p.copy(d).multiplyScalar(body.R + altKm);
    lookQuat(d.clone().multiplyScalar(-1), YUP, ship.q);
    ship.v.set(0, 0, 0); ship.landed = false; ship.seq = null; ship.after = null;
  };

  // ---------- frame selection (which body the ship is "at")
  const cA = new V3(), cQ = new Q4();
  function chooseFrame() {
    shipInertial(cA, cQ); cA.add(ship.body.pos);
    let best = sun, bestSoi = Infinity, nearOther = Infinity;
    for (let i = 0; i < SIM.bodies.length; i++) {
      const b = SIM.bodies[i]; const d = cA.distanceTo(b.pos);
      if (b !== ship.body && d - b.R < nearOther) nearOther = d - b.R;
      if (b === sun) continue;
      if (d < b.soi * (b === ship.body ? 1.15 : 1) && b.soi < bestSoi) { best = b; bestSoi = b.soi; }
    }
    if (best !== ship.body) setFrame(best, false);
    const b = ship.body, alt = ship.p.length() - b.R;
    const wantRot = b !== sun && alt < b.rotAlt * (ship.rot ? 1.3 : 1);
    if (wantRot !== ship.rot) setFrame(b, wantRot);
    return nearOther;
  }

  // ---------- manual flight
  const _q = new Q4(), _e = new THREE.Euler(), _v = new V3(), _r = new V3(), _a = new V3(), _b = new V3(), _c = new V3();
  let warned = 0;
  function flyShip(dt) {
    const nearOther = chooseFrame();
    const b = ship.body;
    // steer: arrows / A-D / stick / drag. Up means nose up. The ship keeps its wings level by itself.
    const yaw = (key('ArrowLeft') + key('KeyA') - key('ArrowRight') - key('KeyD') - input.stickX) * 1.05 * dt - input.mdx * 0.0021;
    const pitch = (key('ArrowUp') - key('ArrowDown') - input.stickY) * 0.95 * dt - input.mdy * 0.0021;
    _q.setFromEuler(_e.set(pitch, yaw, 0, 'YXZ')); ship.q.multiply(_q).normalize();
    let info = shipGround();
    _r.copy(ship.p).normalize();
    if (b !== sun && info.alt < b.R * 1.5) { // wings level relative to the nearest world
      _a.set(1, 0, 0).applyQuaternion(ship.q); _b.set(0, 1, 0).applyQuaternion(ship.q); _c.set(0, 0, -1).applyQuaternion(ship.q);
      if (Math.abs(_c.dot(_r)) < 0.93) { const th = Math.atan2(-_a.dot(_r), _b.dot(_r)); _q.setFromAxisAngle(ZAX, th * Math.min(1, dt * 2.2)); ship.q.multiply(_q).normalize(); }
    }
    const fwd = Math.min(1, key('KeyW') + key('Space') + input.go), back = Math.min(1, key('KeyS') + input.back);
    const boost = key('ShiftLeft') || key('ShiftRight') || input.boost;
    const st = SIM.station, nearSt = st && st.n > 0 && b === SIM.byId.earth && !ship.rot;
    const stD = nearSt ? ship.p.distanceTo(st.pos) : Infinity;
    const nearAlt = Math.max(0.002, Math.min(info.alt, nearOther, stD - st.R));
    ship.nearAlt = nearAlt;
    // close to the station the ship creeps (metres per second), so you cannot shoot past it
    const cap = Math.min(4e7, Math.max(stD < 5 ? 0.004 : 0.03, nearAlt * (stD < 60 ? 0.35 : 0.5))) * (boost ? 4 : 1);
    _v.set(0, 0, back * 0.5 - fwd).applyQuaternion(ship.q).multiplyScalar(cap);
    ship.v.lerp(_v, 1 - Math.exp(-dt * (fwd || back ? 2.6 : 4.5))); // lets go of the throttle: the ship brakes by itself
    ship.p.addScaledVector(ship.v, dt);
    if (nearSt) { // the station is solid: stop at its edge
      _a.copy(ship.p).sub(st.pos); const d = _a.length();
      if (d < st.R && d > 1e-6) { _a.divideScalar(d); ship.p.copy(st.pos).addScaledVector(_a, st.R); const vr = ship.v.dot(_a); if (vr < 0) ship.v.addScaledVector(_a, -vr); }
    }
    ship.thrust = fwd * (boost ? 1.4 : 1); ship.lift = info.alt < 0.6 ? 0.6 : 0;
    info = shipGround();
    const floor = info.g + REST;
    if (info.r < floor) {
      ship.p.multiplyScalar(floor / info.r);
      _r.copy(ship.p).normalize(); const vr = ship.v.dot(_r); if (vr < 0) ship.v.addScaledVector(_r, -vr);
      if (b.d.landable) touchdown();
      else if (performance.now() - warned > 6000) { warned = performance.now(); SIM.say(b.d.gas ? b.name + ' has no ground to land on. It is gas all the way down!' : 'Too hot! You cannot land on a star.', 5000); }
      info.alt = REST;
    }
    ship.alt = Math.max(0, info.alt - REST); ship.speed = ship.v.length();
  }
  // make a small level spot for the ship to stand on
  function levelPad(b, dir) {
    const t = SIM.terrainOf(b);
    t.clearFlats();
    if (b.id === 'earth' && dir.distanceTo(SIM.KSC) < 0.0012) return;
    t.addFlat(dir.x, dir.y, dir.z, 0.05, null, true);
    SIM.rebuildLOD();
  }
  function touchdown() {
    const b = ship.body;
    if (!ship.rot) setFrame(b, true);
    _r.copy(ship.p).normalize();
    levelPad(b, _r);
    const g = SIM.groundR(b, _r.x, _r.y, _r.z); ship.water = SIM.water;
    ship.p.copy(_r).multiplyScalar(g + REST);
    _c.set(0, 0, -1).applyQuaternion(ship.q);
    ship.seq = { type: 'settle', t: 0, T: 0.7, q0: ship.q.clone(), q1: levelQuat(_r, _c, new Q4()) };
    ship.v.set(0, 0, 0); ship.landed = true; ship.speed = 0; ship.alt = 0;
    SIM.say(ship.water ? 'Splashdown! The ship floats. Fly to dry land to get out.' : 'Touchdown on ' + b.name + '!', 4000);
    sfx('land');
    if (SIM.onLand) SIM.onLand(b);
  }
  function landedIdle() {
    ship.thrust = 0; ship.lift = 0; ship.speed = 0; ship.alt = 0;
    if (key('Space') || key('KeyW') || input.go > 0) SIM.launch();
  }

  // ---------- automatic sequences
  SIM.launch = function () {
    if (SIM.mode !== 'ship') return SIM.say('Get back in the ship first.');
    if (ship.seq) return;
    if (!ship.landed) return;
    const b = ship.body, dir0 = ship.p.clone().normalize();
    const f = new V3(0, 0, -1).applyQuaternion(ship.q); f.addScaledVector(dir0, -f.dot(dir0)).normalize();
    const H = Math.max(3, Math.min(400, b.R * 0.04));
    ship.seq = { type: 'launch', t: 0, cd: 3.4, T: 13, dir0: dir0, fwd0: f, r0: ship.p.length(), H: H, last: ship.p.clone() };
    ship.landed = false;
  };
  SIM.site = null; // {body, dir, name}: where the next landing should go
  SIM.autoLand = function () {
    if (SIM.mode !== 'ship' || ship.seq) return;
    if (ship.landed) return SIM.launch();
    ship.docked = false;
    const b = ship.body;
    if (!b.d.landable) return SIM.say(b === sun ? 'The Sun has no ground to land on.' : b.name + ' is made of gas, so there is nothing to land on. Try one of its moons!', 5000);
    const info = shipGround();
    if (info.alt > b.R * 4) return SIM.say('Too far from ' + b.name + ' to land. Fly closer first.', 4500);
    setFrame(b, true);
    const dir0 = ship.p.clone().normalize();
    let dir1 = dir0.clone(), name = '';
    if (SIM.site && SIM.site.body === b) { dir1.copy(SIM.site.dir); name = SIM.site.name; }
    levelPad(b, dir1);
    const g = SIM.groundR(b, dir1.x, dir1.y, dir1.z) + REST, water = SIM.water;
    const f = new V3(0, 0, -1).applyQuaternion(ship.q);
    const ang = Math.acos(Math.max(-1, Math.min(1, dir0.dot(dir1))));
    ship.seq = { type: 'land', t: 0, T: 3.5 + 2.2 * Math.log10(1 + Math.max(0, info.alt) * 100) + ang * 2.5, dir0: dir0, dir1: dir1, r0: ship.p.length(), g: g, water: water, q0: ship.q.clone(), q1: levelQuat(dir1, f, new Q4()), last: ship.p.clone() };
    SIM.say(name ? 'Landing at ' + name + '…' : 'Landing on ' + b.name + '…', 3000);
  };
  SIM.autopilot = function (target) {
    if (SIM.mode !== 'ship') return SIM.say('Get back in the ship first.');
    if (!target) return;
    if (ship.seq) return;
    ship.docked = false;
    if (ship.landed) { ship.after = function () { SIM.autopilot(target); }; return SIM.launch(); }
    setFrame(target, false);
    const p0 = ship.p.clone(), d0 = p0.length();
    const dArr = target === sun ? target.R * 4.5 : Math.max(target.R * 3.4, target.R + 12);
    const dir0 = p0.clone().normalize();
    let dir1 = target === sun ? dir0.clone() : dir0.clone().multiplyScalar(0.4).addScaledVector(target.sunDir, 0.9).addScaledVector(target.pole, 0.25).normalize();
    if (SIM.site && SIM.site.body === target) dir1 = SIM.site.dir.clone().applyQuaternion(target.q).addScaledVector(target.sunDir, 0.25).normalize(); // arrive above the chosen landing site
    if (d0 < dArr * 1.15 && dir0.dot(dir1) > 0.9) { if (SIM.onArrive) SIM.onArrive(target); return SIM.say('You are already at ' + target.name + '.'); }
    ship.seq = { type: 'warp', t: 0, Ta: 1.5, T: 7 + Math.max(0, Math.min(4, Math.log10(d0 / dArr))), d0: d0, dArr: dArr, dir0: dir0, dir1: dir1, q0: ship.q.clone(),
      q1: lookQuat(dir0.clone().multiplyScalar(-1), YUP, new Q4()), target: target, last: ship.p.clone() };
    SIM.say('Flying to ' + target.name + ' · ' + SIM.fmtDist(d0) + ' away', 4000); sfx('warp');
  };
  SIM.abortSeq = function () {
    const s = ship.seq; if (!s || s.type === 'settle') return;
    if (s.type === 'launch' && s.t < s.cd) { ship.seq = null; ship.after = null; ship.landed = true; ship.shake = 0; SIM.banner(''); SIM.say('Launch stopped.'); return; }
    ship.seq = null; ship.after = null; SIM.afterArrive = null; ship.v.set(0, 0, 0); ship.shake = 0; SIM.fovBoost = 0; SIM.banner(''); SIM.say('Autopilot off. You are flying!');
  };
  const sD = new V3(), sF = new V3(), sU = new V3(), sQ = new Q4();
  function runSeq(dt) {
    const s = ship.seq; s.t += dt;
    if (s.type === 'settle') {
      const k = Math.min(1, s.t / s.T); ship.q.copy(s.q0).slerp(s.q1, sm(k)); ship.lift = 1 - k; ship.thrust = 0;
      if (k >= 1) ship.seq = null;
      return;
    }
    if (s.type === 'launch') {
      if (s.t < s.cd) {
        const n = Math.ceil(s.cd - s.t - 0.4);
        SIM.banner(n > 0 ? 'T-' + n : 'LIFT-OFF'); if (s.lastN !== n) { s.lastN = n; sfx(n > 0 ? 'beep' : 'go'); } ship.lift = sm(s.t / s.cd); ship.thrust = 0; ship.speed = 0; ship.shake = 0.3 * ship.lift;
        return;
      }
      const u = (s.t - s.cd) / s.T;
      if (u >= 1) {
        ship.seq = null; ship.v.set(0, 0, 0); ship.shake = 0; SIM.banner('');
        if (ship.after) { const f = ship.after; ship.after = null; f(); }
        else { SIM.say('You are in space, ' + SIM.fmtDist(s.H) + ' above ' + ship.body.name + '! Pick a world to visit.', 6500); if (SIM.onOrbit) SIM.onOrbit(ship.body); }
        return;
      }
      if (u > 0.08) SIM.banner('');
      const f = Math.pow(sm(u), 1.35);
      const th = Math.min(0.5, s.H * 1.5 / ship.body.R) * u * u * u;
      sD.copy(s.dir0).multiplyScalar(Math.cos(th)).addScaledVector(s.fwd0, Math.sin(th));
      sF.copy(s.fwd0).multiplyScalar(Math.cos(th)).addScaledVector(s.dir0, -Math.sin(th));
      const pt = 1.2 * sm(u / 0.1) * (1 - sm((u - 0.25) / 0.75));
      sU.copy(sD).multiplyScalar(Math.cos(pt)).addScaledVector(sF, -Math.sin(pt));
      sF.multiplyScalar(Math.cos(pt)).addScaledVector(sD, Math.sin(pt));
      lookQuat(sF, sU, ship.q);
      ship.p.copy(sD).multiplyScalar(s.r0 + s.H * f);
      ship.thrust = 1.4 * sm(u / 0.1) * (1 - sm((u - 0.85) / 0.15)); ship.lift = 1 - sm(u / 0.15); ship.shake = 0.5 * (1 - sm(u / 0.5));
    } else if (s.type === 'land') {
      const u = s.t / s.T;
      if (u >= 1) {
        ship.p.copy(s.dir1).multiplyScalar(s.g); ship.q.copy(s.q1); ship.landed = true; ship.water = s.water; ship.seq = null; ship.v.set(0, 0, 0); ship.speed = 0; ship.alt = 0; ship.lift = 0;
        SIM.say(s.water ? 'Splashdown! The ship floats. Fly to dry land to get out.' : 'Touchdown on ' + ship.body.name + '!', 4000);
        sfx('land');
        if (SIM.onLand) SIM.onLand(ship.body);
        return;
      }
      const k = 1 - u;
      slerpDir(s.dir0, s.dir1, sm(Math.min(1, u * 1.6)), sD);
      ship.p.copy(sD).multiplyScalar(s.g + (s.r0 - s.g) * k * k * k);
      ship.q.copy(s.q0).slerp(s.q1, sm(Math.min(1, u * 1.7)));
      ship.thrust = 0; ship.lift = sm((u - 0.4) / 0.4);
    } else if (s.type === 'berth' || s.type === 'unberth') { // slide onto / off the docking port
      const u = Math.min(1, s.t / s.T);
      if (s.type === 'berth') {
        portPose(sD, sQ, 0); portPose(sF, sQ, 45);
        if (u < 0.6) dkA.copy(s.p0).lerp(sF, sm(u / 0.6)); else dkA.copy(sF).lerp(sD, sm((u - 0.6) / 0.4));
        ship.q.copy(s.q0).slerp(sQ, sm(u / 0.55));
      } else { portPose(dkA, sQ, 75 * sm(u)); ship.q.copy(sQ); }
      ship.p.copy(station.pos).add(dkA); ship.thrust = 0; ship.lift = 0.25 * Math.sin(Math.PI * u);
      if (u >= 1) {
        ship.seq = null; ship.v.set(0, 0, 0); ship.lift = 0;
        if (s.type === 'berth') { ship.docked = true; sfx('land'); SIM.say('Docked with your space station!', 4500); if (SIM.onDock) SIM.onDock(); }
        return;
      }
    } else if (s.type === 'dock') { // glide up beside the space station and match its orbit
      const u = Math.min(1, s.t / s.T), e = u * u * u * (u * (u * 6 - 15) + 10);
      stationVel(SIM.t, sF); sU.copy(station.pos).normalize();
      _c.crossVectors(sF, sU).normalize();
      sD.copy(station.pos).addScaledVector(sF, -0.125).addScaledVector(sU, 0.02).addScaledVector(_c, 0.05);
      const rT = sD.length(); sD.divideScalar(rT);
      slerpDir(s.dir0, sD, e, _a);
      ship.p.copy(_a).multiplyScalar(s.r0 + (rT - s.r0) * e + Math.sin(Math.PI * e) * s.bump);
      _b.copy(station.pos).addScaledVector(sU, 0.03).sub(_v.copy(sD).multiplyScalar(rT)).normalize(); // nose a little above the station so the chase view shows it over the ship
      lookQuat(_b.addScaledVector(sU, -0.3).normalize(), sU, sQ); ship.q.copy(s.q0).slerp(sQ, sm(u * 1.2));
      ship.thrust = Math.sin(Math.PI * u); ship.lift = 0;
      if (u >= 1) { ship.seq = null; ship.v.set(0, 0, 0); ship.thrust = 0; SIM.say('Welcome to your space station!', 5000); if (SIM.onStation) SIM.onStation(); return; }
    } else if (s.type === 'warp') {
      if (s.t < s.Ta) { ship.q.copy(s.q0).slerp(s.q1, sm(s.t / s.Ta)); ship.thrust = sm(s.t / s.Ta); ship.speed = 0; return; }
      const u = (s.t - s.Ta) / s.T;
      if (u >= 1) {
        ship.p.copy(s.dir1).multiplyScalar(s.dArr); ship.seq = null; ship.v.set(0, 0, 0); SIM.fovBoost = 0; ship.thrust = 0;
        const t = s.target;
        SIM.say('Welcome to ' + t.name + '! You are ' + SIM.fmtDist(s.dArr - t.R) + ' above ' + (t.d.landable ? 'the ground.' : t === sun ? 'the surface of the Sun.' : 'the cloud tops.'), 6000);
        if (SIM.onArrive) SIM.onArrive(t);
        if (SIM.afterArrive) { const fn = SIM.afterArrive; SIM.afterArrive = null; fn(); }
        return;
      }
      const e = u * u * u * (u * (u * 6 - 15) + 10);
      const d = Math.exp(Math.log(s.d0) + (Math.log(s.dArr) - Math.log(s.d0)) * e);
      slerpDir(s.dir0, s.dir1, e * e, sD);
      ship.p.copy(sD).multiplyScalar(d);
      lookQuat(sF.copy(sD).multiplyScalar(-1), YUP, sQ); ship.q.slerp(sQ, Math.min(1, dt * 4));
      SIM.fovBoost = 24 * Math.sin(Math.PI * u); ship.thrust = 1.5 * Math.sin(Math.PI * Math.min(1, u * 1.15));
    }
    ship.speed = ship.p.distanceTo(s.last) / Math.max(dt, 1e-4); s.last.copy(ship.p);
    const info = shipGround(); ship.alt = Math.max(0, info.alt - REST);
  }

  // ---------- astronaut
  SIM.exitShip = function () {
    if (SIM.mode === 'foot') return SIM.enterShip();
    if (ship.seq) return;
    if (!ship.landed) return SIM.say('Land first, then you can get out.');
    if (ship.water) return SIM.say('The ship is floating on water. Fly to dry land first.');
    const b = ship.body; player.body = b;
    const right = new V3(1, 0, 0).applyQuaternion(ship.q), up = ship.p.clone().normalize();
    const ex = shipModel.userData.exit;
    if (ex) player.p.copy(ship.p).add(new V3(ex.x - 1.2, 0, ex.z).multiplyScalar(0.001).applyQuaternion(ship.q)); else player.p.copy(ship.p).addScaledVector(right, -0.0075);
    const d = player.p.clone().normalize(); player.p.copy(d).multiplyScalar(SIM.groundR(b, d.x, d.y, d.z));
    player.fwd.set(0, 0, -1).applyQuaternion(ship.q).addScaledVector(up, 0).normalize();
    player.face.copy(player.fwd); player.pitch = -0.1; player.vy = 0; player.air = false; player.scan = false;
    SIM.mode = 'foot'; rockKey = ''; sampKey = '';
    const g = b.g;
    SIM.say('You are standing on ' + b.name + '! Gravity here is ' + (g / 9.80665 * 100).toFixed(g < 0.5 ? 1 : 0) + '% of Earth’s.', 6000);
    if (SIM.onMode) SIM.onMode();
  };
  SIM.enterShip = function () {
    if (SIM.mode !== 'foot') return;
    SIM.mode = 'ship'; player.scan = false; astro.visible = false;
    SIM.say('Back in the ship.', 2500);
    if (SIM.onMode) SIM.onMode();
  };
  const wU = new V3(), wR = new V3(), wM = new V3(), wOld = new V3();
  let waterMsg = 0, lastStep = 0;
  function walk(dt) {
    const b = player.body;
    wU.copy(player.p).normalize();
    // stick / keys: forward-back walks, left-right curves the path (the camera swings round behind you)
    const mvY = key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown') - input.stickY, mvX = key('KeyD') + key('ArrowRight') - key('KeyA') - key('ArrowLeft') + input.stickX;
    const zk = SIM.zoomFov ? 0.16 : 1;
    const yaw = -input.mdx * 0.0026 * zk - mvX * 1.5 * dt * (SIM.zoomFov ? 0.3 : 1);
    player.fwd.applyAxisAngle(wU, yaw);
    player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch - input.mdy * 0.0026 * zk));
    player.fwd.addScaledVector(wU, -player.fwd.dot(wU)).normalize();
    wR.crossVectors(player.fwd, wU);
    const run = key('ShiftLeft') || key('ShiftRight') || input.boost;
    wM.set(0, 0, 0).addScaledVector(player.fwd, mvY).addScaledVector(wR, mvX * 0.55);
    const mag = Math.min(1, wM.length());
    const spd = (run ? 8 : 4.2) * 0.001 * mag;
    wOld.copy(player.p);
    if (mag > 0.01) {
      wM.normalize(); player.p.addScaledVector(wM, spd * dt); player.phase += dt * (run ? 11 : 8) * mag;
      const st = Math.floor(player.phase / Math.PI); if (st !== lastStep) { lastStep = st; if (!player.air) sfx('step'); }
      slerpDir(player.face, wM, Math.min(1, dt * 9), player.face);
    }
    player.face.addScaledVector(wU, -player.face.dot(wU)); if (player.face.lengthSq() < 1e-8) player.face.copy(player.fwd); player.face.normalize();
    player.moving += ((mag > 0.01 ? (run ? 1.25 : 1) : 0) - player.moving) * Math.min(1, dt * 8);
    let r = player.p.length(); wU.copy(player.p).divideScalar(r);
    let g = SIM.groundR(b, wU.x, wU.y, wU.z);
    if (SIM.water) {
      player.p.copy(wOld); r = player.p.length(); wU.copy(player.p).divideScalar(r); g = SIM.groundR(b, wU.x, wU.y, wU.z);
      if (performance.now() - waterMsg > 5000) { waterMsg = performance.now(); SIM.say('That is the sea! Spacesuits cannot swim.'); }
    }
    const cm = SIM.camps[b.id]; // the camp dome is solid: step around it
    if (cm) { _a.set(cm.x, cm.y, cm.z).multiplyScalar(r); const dc = _a.distanceTo(player.p); if (dc < 0.0036 && dc > 1e-7) { player.p.sub(_a).multiplyScalar(0.0036 / dc).add(_a); r = player.p.length(); wU.copy(player.p).divideScalar(r); g = SIM.groundR(b, wU.x, wU.y, wU.z); } }
    const gEff = Math.max(b.g, 0.25) * 0.001;
    if (player.air) {
      player.vy -= gEff * dt; r += player.vy * dt;
      if (r <= g) { r = g; player.air = false; player.vy = 0; }
    } else {
      if (r - g > 0.0006) { player.air = true; player.vy = 0; }
      else { r = g; if (key('Space') || input.up > 0) { player.vy = Math.min(0.0031, Math.sqrt(2 * gEff * 0.006)); player.air = true; sfx('jump'); } }
    }
    player.p.copy(wU).multiplyScalar(r);
    player.speed = spd; player.alt = r - g;
  }

  // ---------- rocks and collectable samples
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, flatShading: true });
  const rockGeos = {}; function rockGeo(style) { return rockGeos[style] || (rockGeos[style] = MODELS.rockGeometry(3, style)); }
  const rocks = new THREE.InstancedMesh(rockGeo('rock'), rockMat, 560); rocks.frustumCulled = false; rocks.instanceColor = new THREE.BufferAttribute(new Float32Array(560 * 3).fill(1), 3); rocks.count = 0;
  const sampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.25, flatShading: true, emissive: 0x2fc8ff, emissiveIntensity: 0 });
  const samp = new THREE.InstancedMesh(MODELS.rockGeometry(9), sampMat, 80); samp.frustumCulled = false; samp.instanceColor = new THREE.BufferAttribute(new Float32Array(80 * 3).fill(1), 3); samp.count = 0;
  let rockKey = '', sampKey = '', rockBody = null;
  const dm = new THREE.Object3D(), col = new THREE.Color(), cc = [0, 0, 0], rAnchor = new V3(), sAnchor = new V3();
  SIM.nearSamples = [];
  SIM.collected = {};
  SIM.samples = [];
  try { const s = JSON.parse(localStorage.getItem('sse_samples_v1') || 'null'); if (s && s.list) { SIM.samples = s.list; SIM.collected = s.keys || {}; } } catch (e) {}
  function saveSamples() { try { localStorage.setItem('sse_samples_v1', JSON.stringify({ list: SIM.samples, keys: SIM.collected })); } catch (e) {} }
  function updateRocks(b, dir) {
    const gr = b.d.ground || {};
    if (rockBody !== b) { if (rockBody) { rockBody.group.remove(rocks); rockBody.group.remove(samp); } b.group.add(rocks); b.group.add(samp); rockBody = b; rockKey = ''; sampKey = '';
      rocks.geometry = rockGeo(gr.rock || 'rock'); rockMat.roughness = gr.gloss > 0.3 ? 0.45 : 0.95; }
    const t = SIM.terrainOf(b), f = TR.dirToFace(dir.x, dir.y, dir.z), kmU = Math.PI / 4 * b.R;
    const cell = 0.006 / kmU, ci = Math.floor(f.u / cell), cj = Math.floor(f.v / cell), k = b.id + f.face + ':' + ci + ':' + cj;
    if (k !== rockKey) {
      rockKey = k; rAnchor.copy(dir).multiplyScalar(b.R); rocks.position.copy(rAnchor);
      SIM.colorAt(b, dir.x, dir.y, dir.z, cc);
      let n = 0;
      for (let dj = -11; dj <= 11; dj++) for (let di = -11; di <= 11; di++) {
        const h = TR.hashI(ci + di, cj + dj, f.face, t.seed + 5000);
        if ((h & 255) > 100 * (gr.rockK == null ? 1 : gr.rockK)) continue;
        const d = TR.faceDir(f.face, (ci + di + ((h >>> 8) & 255) / 255) * cell, (cj + dj + ((h >>> 16) & 255) / 255) * cell), x = d[0], y = d[1], z = d[2];
        const hh = t.heightFine(x, y, z); if (t.water) continue;
        const u = ((h >>> 24) & 255) / 255, s = 0.00007 + 0.00055 * u * u * u;
        dm.position.set(x * (b.R + hh - s * 0.3) - rAnchor.x, y * (b.R + hh - s * 0.3) - rAnchor.y, z * (b.R + hh - s * 0.3) - rAnchor.z);
        dm.quaternion.setFromUnitVectors(YUP, _a.set(x, y, z)); _q.setFromAxisAngle(YUP, u * 40); dm.quaternion.multiply(_q);
        dm.scale.set(s * (0.8 + 0.6 * ((h >>> 4) & 15) / 15), s * (0.6 + 0.5 * u), s);
        dm.updateMatrix(); rocks.setMatrixAt(n, dm.matrix);
        const sh = 0.5 + 0.35 * ((h >>> 12) & 15) / 15, lf = gr.rockLift || 0, rt = gr.rockTint || cc;
        rocks.setColorAt(n, col.setRGB((cc[0] * sh) * (1 - lf) + rt[0] * (0.7 + 0.3 * sh) * lf, (cc[1] * sh) * (1 - lf) + rt[1] * (0.7 + 0.3 * sh) * lf, (cc[2] * sh) * (1 - lf) + rt[2] * (0.7 + 0.3 * sh) * lf));
        if (++n >= 560) break;
      }
      rocks.count = n; rocks.instanceMatrix.needsUpdate = true; if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    }
    const cellS = 0.03 / kmU, si = Math.floor(f.u / cellS), sj = Math.floor(f.v / cellS), ks = b.id + f.face + ':' + si + ':' + sj;
    if (ks !== sampKey) {
      sampKey = ks; sAnchor.copy(dir).multiplyScalar(b.R); samp.position.copy(sAnchor);
      SIM.colorAt(b, dir.x, dir.y, dir.z, cc);
      SIM.nearSamples.length = 0; let n = 0;
      const mats = b.d.materials || [];
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
        const h = TR.hashI(si + di, sj + dj, f.face, t.seed + 6000);
        if ((h & 255) > 105) continue;
        const id = b.id + ':' + f.face + ':' + (si + di) + ':' + (sj + dj);
        if (SIM.collected[id]) continue;
        const d = TR.faceDir(f.face, (si + di + 0.15 + 0.7 * ((h >>> 8) & 255) / 255) * cellS, (sj + dj + 0.15 + 0.7 * ((h >>> 16) & 255) / 255) * cellS), x = d[0], y = d[1], z = d[2];
        const hh = t.heightFine(x, y, z); if (t.water) continue;
        let mi = t.materialIndex(x, y, z); if (mats.length > 1 && ((h >>> 28) & 3) < 2) mi = ((h >>> 12) & 1023) % mats.length;
        const s = 0.00032 + 0.0002 * ((h >>> 24) & 255) / 255, rr = b.R + hh + s * 0.25;
        dm.position.set(x * rr - sAnchor.x, y * rr - sAnchor.y, z * rr - sAnchor.z);
        dm.quaternion.setFromUnitVectors(YUP, _a.set(x, y, z)); _q.setFromAxisAngle(YUP, (h & 63)); dm.quaternion.multiply(_q);
        dm.scale.set(s, s * 0.85, s * 1.1); dm.updateMatrix(); samp.setMatrixAt(n, dm.matrix);
        if (mats[mi]) { col.set(mats[mi].c); samp.setColorAt(n, col.setRGB(cc[0] * 0.55 + col.r * 0.45, cc[1] * 0.55 + col.g * 0.45, cc[2] * 0.55 + col.b * 0.45)); }
        SIM.nearSamples.push({ id: id, p: new V3(x * rr, y * rr, z * rr), mat: mi, kg: 0.2 + 1.4 * ((h >>> 20) & 15) / 15 });
        if (++n >= 80) break;
      }
      samp.count = n; samp.instanceMatrix.needsUpdate = true; if (samp.instanceColor) samp.instanceColor.needsUpdate = true;
    }
  }
  SIM.nearestSample = function () {
    let best = null, bd = 1e9;
    for (let i = 0; i < SIM.nearSamples.length; i++) { const s = SIM.nearSamples[i], d = s.p.distanceTo(player.p); if (d < bd) { bd = d; best = s; } }
    return best ? { s: best, d: bd } : null;
  };
  SIM.collect = function () {
    if (SIM.mode !== 'foot') return;
    const n = SIM.nearestSample();
    if (!n || n.d > 0.0052) return SIM.say(n ? 'The nearest sample is ' + SIM.fmtDist(n.d) + ' away. Follow the blue diamond!' : 'No samples close by. Keep exploring!');
    const b = player.body, m = (b.d.materials || [])[n.s.mat] || { n: 'Unknown rock', comp: [] }, ll = SIM.dirLatLon(n.s.p);
    SIM.collected[n.s.id] = 1;
    const rec = { id: 'S-' + String(SIM.samples.length + 1).padStart(3, '0'), body: b.name, mat: m.n, comp: m.comp, note: m.note || '', c: m.c, lat: ll.lat, lon: ll.lon, kg: Math.round(n.s.kg * 100) / 100, date: SIM.dateOf(SIM.t).toISOString().slice(0, 16).replace('T', ' '), bid: b.id };
    SIM.samples.push(rec);
    saveSamples(); sampKey = ''; sfx('pick');
    if (SIM.onSample) SIM.onSample(rec);
  };
  SIM.clearSamples = function () { SIM.samples = []; SIM.collected = {}; saveSamples(); sampKey = ''; };
  SIM.saveSamples = saveSamples;

  // ---------- surface camp: set up once per world, then switched on
  const campModel = PROPS.buildCamp(); campModel.visible = false;
  let campBody = null, campAnim = 0, campClock = 0;
  SIM.camps = SIM.camps || {}; // body id -> {x, y, z, on}: unit direction of the camp in the body's frame
  SIM.onTerrainCreate = function (b, t) { const c = SIM.camps[b.id]; if (c) t.addFlat(c.x, c.y, c.z, 0.022); };
  SIM.campDist = function () { if (SIM.mode !== 'foot') return Infinity; const c = SIM.camps[player.body.id]; if (!c) return Infinity; return _a.set(c.x, c.y, c.z).multiplyScalar(player.p.length()).distanceTo(player.p); };
  SIM.setupCamp = function () {
    if (SIM.mode !== 'foot') return;
    const b = player.body;
    if (SIM.camps[b.id]) return SIM.say('You already have a camp on ' + b.name + '. Follow the tent marker to find it.');
    if (player.p.distanceTo(ship.p) < 0.03) { sfx('no'); return SIM.say('Too close to the ship. Walk a bit further away, then set up camp.'); }
    const d = player.p.clone().addScaledVector(player.face, 0.008).normalize();
    SIM.groundR(b, d.x, d.y, d.z); if (SIM.water) { sfx('no'); return SIM.say('You cannot camp on water!'); }
    SIM.camps[b.id] = { x: d.x, y: d.y, z: d.z, on: 0 };
    SIM.terrainOf(b).addFlat(d.x, d.y, d.z, 0.022); SIM.rebuildLOD();
    campBody = null; campAnim = 0.001; sfx('build');
    SIM.say('Setting up camp… walk over and switch it on!', 5000);
    if (SIM.onCamp) SIM.onCamp(b, 'built');
  };
  SIM.activateCamp = function () {
    if (SIM.mode !== 'foot') return;
    const b = player.body, c = SIM.camps[b.id]; if (!c || c.on) return;
    if (SIM.campDist() > 0.016) return SIM.say('Walk up to your camp to switch it on.');
    c.on = 1; sfx('on'); SIM.say('Camp ' + b.name + ' is online! Lights on, beacon blinking.', 5000);
    if (SIM.onCamp) SIM.onCamp(b, 'on');
  };
  function updateCamp(dt) {
    const gb = SIM.mode === 'foot' ? player.body : ship.body, c = SIM.camps[gb.id];
    if (!c || !(SIM.lod && SIM.lod.body === gb)) { campModel.visible = false; return; }
    if (campBody !== gb) {
      if (campModel.parent) campModel.parent.remove(campModel);
      gb.group.add(campModel); campBody = gb;
      const d = _a.set(c.x, c.y, c.z), g = SIM.groundR(gb, c.x, c.y, c.z);
      campModel.position.copy(d).multiplyScalar(g);
      levelQuat(d, _b.crossVectors(YUP, d), campModel.quaternion);
    }
    if (campAnim > 0) { campAnim += dt / 3.2; if (campAnim >= 1) campAnim = 0; }
    campClock += dt;
    campModel.visible = true; campModel.userData.set(campAnim > 0 ? campAnim : 1, !!c.on, campClock);
  }

  // ---------- space station: a real 420 km orbit, tilted 51.6 degrees like the ISS
  const earth = SIM.byId.earth;
  const station = SIM.station = { n: 0, pos: new V3(), prev: new V3(), model: PROPS.buildStation(), d: Infinity, P: 0.064456, r: earth.R + 420, R: 0.062 };
  const DECK = PROPS.DECK, UP3 = new V3(0, 0, -1), stQ = new Q4();
  SIM.scene.add(station.model); station.model.visible = false;
  const stE1 = new V3().crossVectors(earth.pole, new V3(1, 0, 0)).normalize(), stN = earth.pole.clone().multiplyScalar(Math.cos(0.9006)).addScaledVector(new V3().crossVectors(stE1, earth.pole), Math.sin(0.9006)).normalize(), stE2 = new V3().crossVectors(stN, stE1).normalize();
  function stationPos(t, out) { const a = (t / station.P % 1) * 2 * Math.PI; return out.copy(stE1).multiplyScalar(Math.cos(a) * station.r).addScaledVector(stE2, Math.sin(a) * station.r); }
  function stationVel(t, out) { const a = (t / station.P % 1) * 2 * Math.PI; return out.copy(stE1).multiplyScalar(-Math.sin(a)).addScaledVector(stE2, Math.cos(a)); }
  stationPos(SIM.t, station.pos);
  SIM.setStation = function (n) { station.n = n; station.model.userData.setCount(n); };
  // runs first every frame: move the station along its orbit and carry a ship that is parked beside it
  function stationStep() {
    station.prev.copy(station.pos); stationPos(SIM.t, station.pos);
    stationVel(SIM.t, _b); _c.copy(station.pos).normalize(); lookQuat(_c, _b, stQ); // deck side faces space, cupola faces Earth
    if (station.n > 0 && SIM.mode === 'ship' && !ship.landed && !ship.seq && ship.body === earth && !ship.rot && ship.p.distanceTo(station.prev) < 400)
      ship.p.add(station.pos).sub(station.prev);
  }
  function updateStation(dt) {
    const m = station.model;
    if (!station.n) { m.visible = false; station.d = Infinity; return; }
    m.position.copy(earth.pos).sub(SIM.cam.body.pos).add(station.pos).sub(SIM.cam.rel);
    station.d = SIM.mode === 'deck' ? 0 : SIM.mode === 'ship' && ship.body === earth ? (ship.rot ? _a.copy(ship.p).applyQuaternion(earth.q) : _a.copy(ship.p)).distanceTo(station.pos) : Infinity;
    m.visible = m.position.length() < 5000 && !(SIM.mode === 'deck' && deck.scope); // the eyepiece view must not be blocked by the telescope's own tube
    if (!m.visible) return;
    m.quaternion.copy(stQ);
    m.userData.ring.rotation.x += dt * 0.45;
    m.userData.beacon.visible = (performance.now() % 1600) < 300;
  }
  SIM.flyToStation = function () {
    if (!station.n) return SIM.say('You have not built a space station yet. Buy the first module in your logbook!');
    if (SIM.mode !== 'ship') return SIM.say('Get back in the ship first.');
    if (ship.seq) return;
    if (ship.docked) return SIM.say('You are already docked at your space station.');
    if (ship.landed) { ship.after = SIM.flyToStation; return SIM.launch(); }
    shipInertial(_a, _q);
    if (ship.body !== earth || _a.length() > earth.R * 6) { SIM.site = null; SIM.afterArrive = SIM.flyToStation; SIM.target = earth; return SIM.autopilot(earth); }
    setFrame(earth, false);
    const r0 = ship.p.length(), dir0 = ship.p.clone().divideScalar(r0), ang = Math.acos(Math.max(-1, Math.min(1, dir0.dot(_b.copy(station.pos).normalize()))));
    ship.seq = { type: 'dock', t: 0, T: 7 + ang * 2.5, dir0: dir0, r0: r0, bump: 350 * ang / Math.PI, q0: ship.q.clone(), last: ship.p.clone() };
    SIM.say('Flying to your space station…', 4000); sfx('warp');
  };

  // ---------- docking, the sky deck and the telescope
  const dkA = new V3(), dkB = new V3(), dkC = new V3(), dkD = new V3(), dkQ = new Q4();
  // offset (km, Earth frame) and attitude of a ship `back` metres out from the docking port, nose towards the station
  function portPose(outP, outQ, back) {
    outP.set(DECK.port[0] + back, DECK.port[1], DECK.port[2]).multiplyScalar(0.001).applyQuaternion(stQ);
    dkC.set(-1, 0, 0).applyQuaternion(stQ); dkD.copy(UP3).applyQuaternion(stQ);
    return lookQuat(dkC, dkD, outQ);
  }
  function dockedIdle() { portPose(dkA, ship.q, 0); ship.p.copy(station.pos).add(dkA); ship.v.set(0, 0, 0); ship.thrust = 0; ship.lift = 0; ship.speed = 7.66; ship.alt = 420; }
  SIM.dock = function () {
    if (SIM.mode !== 'ship' || ship.seq || ship.docked || !station.n) return;
    if (station.d > 2) return SIM.say('Fly closer to the station to dock.');
    setFrame(earth, false);
    ship.seq = { type: 'berth', t: 0, T: 6.5, p0: ship.p.clone().sub(station.pos), q0: ship.q.clone(), last: ship.p.clone() };
    SIM.say('Docking…', 3000);
  };
  SIM.undock = function () {
    if (SIM.mode !== 'ship' || ship.seq || !ship.docked) return;
    ship.docked = false; ship.seq = { type: 'unberth', t: 0, T: 3.5, last: ship.p.clone() }; sfx('open');
  };
  const deck = SIM.deck = { x: 0, y: 0, yaw: 0, pitch: -0.08, h: 0, vh: 0, phase: 0, moving: 0, scope: false, ti: 0, target: null, blocked: false };
  const TARGETS = ['moon', 'mars', 'jupiter', 'saturn', 'venus', 'mercury', 'sun', 'uranus', 'neptune', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'pluto'].map(function (id) { return SIM.byId[id]; }).filter(Boolean);
  SIM.visitStation = function () {
    if (SIM.mode !== 'ship' || !ship.docked) return;
    if (station.n < 4) { sfx('no'); return SIM.say('Build the crew quarters and sky deck (module 4) first. Then you can go outside!', 5000); }
    SIM.mode = 'deck'; deck.x = DECK.hatch[0]; deck.y = DECK.hatch[1]; deck.yaw = 0; deck.pitch = -0.08; deck.h = 0; deck.vh = 0; deck.scope = false;
    sfx('open'); SIM.say('Welcome aboard! Magnetic boots keep you on the sky deck.', 5000);
    if (SIM.onMode) SIM.onMode();
  };
  SIM.leaveDeck = function () { if (SIM.mode !== 'deck') return; deck.scope = false; SIM.zoomFov = 0; SIM.mode = 'ship'; astro.visible = false; if (SIM.onMode) SIM.onMode(); };
  SIM.scopeDist = function () { return Math.hypot(deck.x - DECK.scope[0], deck.y - DECK.scope[1]); };
  SIM.useScope = function (on) {
    if (SIM.mode !== 'deck') return;
    if (on && station.n < 5) return SIM.say('Buy the ZetaQ telescope (module 5) in your logbook first.');
    if (on && SIM.scopeDist() > 3.4) return SIM.say('Walk up to the telescope at the end of the deck.');
    deck.scope = on; deck.target = TARGETS[deck.ti]; if (!on) SIM.zoomFov = 0; sfx('bino');
    if (SIM.onScope) SIM.onScope(on);
  };
  SIM.scopeNext = function (d) { deck.ti = (deck.ti + d + TARGETS.length) % TARGETS.length; deck.target = TARGETS[deck.ti]; if (SIM.onScope) SIM.onScope(true); };
  let deckStep = 0;
  function deckWalk(dt) {
    if (deck.scope) return;
    const mvY = key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown') - input.stickY, mvX = key('KeyD') + key('ArrowRight') - key('KeyA') - key('ArrowLeft') + input.stickX;
    deck.yaw += input.mdx * 0.0026 + mvX * 1.5 * dt;
    deck.pitch = Math.max(-1.2, Math.min(1.2, deck.pitch - input.mdy * 0.0026));
    const c = Math.cos(deck.yaw), s = Math.sin(deck.yaw), mag = Math.min(1, Math.abs(mvY) + Math.abs(mvX) * 0.5), spd = 3.2 * dt;
    deck.x += (c * mvY - s * mvX * 0.5) * spd; deck.y += (s * mvY + c * mvX * 0.5) * spd;
    deck.x = Math.max(DECK.x0 + 0.5, Math.min(DECK.x1 - 0.5, deck.x)); deck.y = Math.max(DECK.y0 + 0.5, Math.min(DECK.y1 - 0.5, deck.y));
    if (station.n >= 5) { const dx = deck.x - DECK.scope[0], dy = deck.y - DECK.scope[1], d = Math.hypot(dx, dy); if (d < 1.4 && d > 1e-4) { deck.x = DECK.scope[0] + dx / d * 1.4; deck.y = DECK.scope[1] + dy / d * 1.4; } }
    if (mag > 0.01) { deck.phase += dt * 8 * mag; const st = Math.floor(deck.phase / Math.PI); if (st !== deckStep) { deckStep = st; if (deck.h === 0) sfx('step'); } }
    deck.moving += ((mag > 0.01 ? 1 : 0) - deck.moving) * Math.min(1, dt * 8);
    if (deck.h === 0 && deck.vh === 0 && (key('Space') || input.up > 0)) { deck.vh = 1.5; sfx('jump'); }
    if (deck.vh !== 0 || deck.h > 0) { deck.h += deck.vh * dt; deck.vh -= 1.1 * dt; if (deck.h <= 0) { deck.h = 0; deck.vh = 0; } }
  }

  // ---------- atmosphere probe for the gas giants
  const probeSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: GFX.glowTexture([[0, 'rgba(255,255,255,1)'], [0.15, 'rgba(255,240,200,0.9)'], [0.4, 'rgba(255,170,80,0.35)'], [1, 'rgba(255,120,40,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  probeSprite.visible = false; probeSprite.renderOrder = 7; SIM.scene.add(probeSprite);
  SIM.probe = null;
  SIM.sendProbe = function () {
    if (SIM.mode !== 'ship' || ship.landed || ship.seq || SIM.probe) return;
    const b = ship.body;
    if (!b.d.gas) return SIM.say('Probes are for the gas planets: Jupiter, Saturn, Uranus and Neptune.');
    const alt = ship.p.length() - b.R;
    if (alt > b.R * 4) return SIM.say('Fly closer to ' + b.name + ' before sending the probe.');
    SIM.probe = { t: 0, T: 20, body: b, alt: Math.max(50, alt) };
    sfx('probe'); if (SIM.onProbe) SIM.onProbe(b, 'start');
  };
  function updateProbe(dt) {
    const p = SIM.probe; if (!p) { probeSprite.visible = false; return; }
    p.t += dt; const u = p.t / p.T;
    if (u >= 1 || SIM.mode !== 'ship' || ship.body !== p.body) { SIM.probe = null; probeSprite.visible = false; if (u >= 1 && SIM.onProbe) SIM.onProbe(p.body, 'done'); return; }
    const k = Math.min(1, u / 0.42), e = k * k * (3 - 2 * k), dist = 0.02 + p.alt * 0.99 * e * e;
    shipInertial(_a, _q); _b.copy(_a).normalize().multiplyScalar(-1); // towards the planet's centre
    probeSprite.position.copy(_a).sub(SIM.cam.rel).addScaledVector(_b, dist);
    const heat = sm((u - 0.36) / 0.2);
    probeSprite.scale.setScalar(Math.max(0.003, dist * (0.012 + 0.03 * heat)));
    probeSprite.material.color.setRGB(1, 1 - 0.35 * heat, 1 - 0.7 * heat);
    probeSprite.material.opacity = u < 0.7 ? 1 : Math.max(0, 1 - (u - 0.7) / 0.2);
    probeSprite.visible = true;
  }

  // ---------- per-frame update: controls, camera, model placement
  const cP = new V3(), cQ2 = new Q4(), camT = new Q4(), off = new V3(), pP = new V3(), hQ = new Q4(), lk = new V3(), head = new V3(), tmp = new V3(), tmpQ = new Q4();
  let camInit = false, lampK = 0, scanWait = 0, airK = 0;
  SIM.update = function (dt) {
    stationStep();
    if (SIM.mode === 'ship') { if (ship.seq) runSeq(dt); else if (ship.docked) dockedIdle(); else if (ship.landed) landedIdle(); else flyShip(dt); }
    else if (SIM.mode === 'deck') deckWalk(dt);
    else walk(dt);
    input.mdx = 0; input.mdy = 0;
    const cam = SIM.cam;
    shipInertial(cP, cQ2);
    if (SIM.mode === 'ship') {
      cam.body = ship.body;
      const cockpit = ship.view === 'cockpit';
      if (cockpit) { camT.copy(cQ2); off.set(0, 0.00128, -0.0031); }
      else { tmpQ.setFromAxisAngle(_a.set(1, 0, 0), -0.1); camT.copy(cQ2).multiply(tmpQ); off.set(0, 0.0046, 0.0185); }
      if (!camInit || cockpit || (ship.seq && ship.seq.type === 'warp')) { cam.q.copy(camT); camInit = true; }
      else cam.q.slerp(camT, 1 - Math.exp(-dt * 7));
      cam.rel.copy(off).applyQuaternion(cam.q).add(cP);
      if (ship.shake) cam.rel.add(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.00012 * ship.shake));
      // keep the chase camera out of the ground
      const b = ship.body;
      if (b.d.landable && ship.alt < 0.3) {
        qi.copy(b.q).invert(); tmp.copy(cam.rel).applyQuaternion(qi); const r = tmp.length(); tmp.divideScalar(r);
        const g = SIM.groundR(b, tmp.x, tmp.y, tmp.z) + 0.0007; if (r < g) cam.rel.multiplyScalar(g / r);
      }
      shipModel.visible = !cockpit;
      shipModel.position.copy(cP).sub(cam.rel); shipModel.quaternion.copy(cQ2);
      astro.visible = false;
      SIM.lampPos.set(0, -0.001, -0.009).applyQuaternion(cQ2).add(shipModel.position);
    } else if (SIM.mode === 'deck') {
      cam.body = earth; camInit = false;
      const c = Math.cos(deck.yaw), s = Math.sin(deck.yaw), cp = Math.cos(deck.pitch), sp = Math.sin(deck.pitch);
      dkA.set(deck.x, deck.y, DECK.z - deck.h);              // boots, metres in the station frame ("up" is -z)
      lk.set(c * cp, s * cp, -sp);                            // where the astronaut looks
      if (deck.scope) pP.set(DECK.scope[0], DECK.scope[1], DECK.z - 2.7);
      else pP.copy(dkA).addScaledVector(UP3, 2.42).addScaledVector(lk, -4.4).addScaledVector(tmp.set(-s, c, 0), 0.55);
      if (!deck.scope && pP.z > DECK.z - 0.4) pP.z = DECK.z - 0.4;
      cam.rel.copy(pP).multiplyScalar(0.001).applyQuaternion(stQ).add(station.pos);
      if (deck.scope && deck.target) { // the telescope tracks the chosen world and zooms until it fills the eyepiece
        const tg = deck.target;
        dkB.copy(tg.pos).sub(earth.pos).sub(cam.rel); const dist = dkB.length(); dkB.divideScalar(dist);
        lookQuat(dkB, dkC.copy(UP3).applyQuaternion(stQ), cam.q);
        const ext = tg.d.rings && tg.d.rings.saturn ? tg.d.rings.outer : tg.R; // zoom until the world (and its rings) nearly fills the round eyepiece
        SIM.zoomFov = Math.max(0.0015, Math.min(30, 2 * Math.asin(Math.min(1, ext / dist)) * 57.2958 / 0.62));
        const bq = cam.rel.dot(dkB); deck.blocked = bq < 0 && cam.rel.lengthSq() - bq * bq < earth.R * earth.R * 1.02;
        deck.dist = dist;
      } else { lookQuat(lk, UP3, hQ); cam.q.copy(stQ).multiply(hQ); }
      astro.visible = !deck.scope;
      astro.position.copy(dkA).sub(pP).multiplyScalar(0.001).applyQuaternion(stQ);
      lookQuat(tmp.set(c, s, 0), UP3, hQ); astro.quaternion.copy(stQ).multiply(hQ);
      airK += ((deck.h > 0 ? 1 : 0) - airK) * Math.min(1, dt * 8);
      if (astro.userData.pose) astro.userData.pose(deck.phase, Math.min(1, deck.moving), airK);
      shipModel.visible = !deck.scope; shipModel.position.copy(cP).sub(cam.rel); shipModel.quaternion.copy(cQ2);
      SIM.lampPos.set(0, 0, 0);
    } else {
      const b = player.body; cam.body = b; camInit = false;
      wU.copy(player.p).normalize(); wR.crossVectors(player.fwd, wU);
      lk.copy(player.fwd).multiplyScalar(Math.cos(player.pitch)).addScaledVector(wU, Math.sin(player.pitch));
      head.copy(player.p).addScaledVector(wU, 0.00172);
      const fp = player.first || !!SIM.zoomFov;
      if (fp) pP.copy(head).addScaledVector(lk, 0.00025);
      else {
        pP.copy(head).addScaledVector(lk, -0.0046).addScaledVector(wU, 0.0007).addScaledVector(wR, 0.00055);
        const r = pP.length(); tmp.copy(pP).divideScalar(r);
        const g = SIM.groundR(b, tmp.x, tmp.y, tmp.z) + 0.00035; if (r < g) pP.multiplyScalar(g / r);
      }
      lookQuat(lk, wU, hQ);
      cam.rel.copy(pP).applyQuaternion(b.q); cam.q.copy(b.q).multiply(hQ);
      // astronaut model
      astro.visible = !fp;
      astro.position.copy(player.p).sub(pP).applyQuaternion(b.q);
      lookQuat(player.face, wU, hQ); astro.quaternion.copy(b.q).multiply(hQ);
      const ud = astro.userData, sw = Math.sin(player.phase) * 0.65 * Math.min(1, player.moving), air = player.air ? 0.35 : 0;
      airK += ((player.air ? 1 : 0) - airK) * Math.min(1, dt * 8);
      if (ud.pose) ud.pose(player.phase, Math.min(1, player.moving), airK);
      else { ud.legs[0].rotation.x = sw + air; ud.legs[1].rotation.x = -sw - air * 0.4; ud.arms[0].rotation.x = -sw * 0.7 - air; ud.arms[1].rotation.x = sw * 0.7 - air; }
      astro.position.addScaledVector(tmp.copy(wU).applyQuaternion(b.q), Math.abs(Math.sin(player.phase)) * 0.00004 * Math.min(1, player.moving));
      // parked ship
      shipModel.visible = true; shipModel.position.copy(cP).sub(cam.rel); shipModel.quaternion.copy(cQ2);
      SIM.lampPos.copy(head).addScaledVector(lk, 0.0012).sub(pP).applyQuaternion(b.q);
    }
    // soft contact shadows under the ship and the astronaut while on the ground in daylight
    const lit = SIM.sky.sunVis > 0.5 && SIM.sunHere() > 0.12;
    if (shipModel.userData.shadow) shipModel.userData.shadow.visible = lit && (SIM.mode === 'foot' || ship.landed);
    if (astro.userData.shadow) astro.userData.shadow.visible = lit && SIM.mode === 'foot' && !player.air;
    if (MODELS.setEnvIntensity) MODELS.setEnvIntensity(0.25 + 0.75 * Math.max(0, Math.min(1, SIM.sky.sunVis)));
    // engine glow
    const ud = shipModel.userData, th = SIM.mode === 'ship' ? ship.thrust : 0, lf = SIM.mode === 'ship' ? ship.lift : 0;
    for (let i = 0; i < ud.plumes.length; i++) { const p = ud.plumes[i]; p.material.opacity += (Math.min(0.85, th * 0.6) - p.material.opacity) * Math.min(1, dt * 6); p.visible = p.material.opacity > 0.01; if (i % 2 === 0) p.scale.set(1, 0.6 + th * 0.9 + Math.random() * 0.08, 1); }
    for (let i = 0; i < ud.lifts.length; i++) { const p = ud.lifts[i]; p.material.opacity += (Math.min(0.8, lf * 0.7) - p.material.opacity) * Math.min(1, dt * 6); p.visible = p.material.opacity > 0.01; }
    if (SIM.audio) SIM.audio.engine(th, lf);
    updateCamp(dt); updateStation(dt); updateProbe(dt);
    // rocks + samples near the ground
    const gb = SIM.mode === 'foot' ? player.body : ship.body;
    const low = SIM.mode === 'foot' || (gb.d.landable && ship.rot && ship.alt < 0.25);
    if (low && gb.d.landable) {
      if (SIM.mode === 'foot') tmp.copy(player.p).normalize(); else tmp.copy(ship.p).normalize();
      updateRocks(gb, tmp); rocks.visible = true; samp.visible = true;
    } else { rocks.visible = false; samp.visible = false; if (SIM.nearSamples.length) { SIM.nearSamples.length = 0; sampKey = ''; } }
    pad.visible = !!(SIM.lod && SIM.lod.body.id === 'earth');
    // lamp comes on in the dark
    const dark = (SIM.sky.sunVis < 0.4 || SIM.sky.day < 0.25) ? 1 : 0;
    const wantLamp = (SIM.mode === 'foot' || (ship.alt < 0.4 && ship.body.d.landable)) ? dark : 0;
    lampK += (wantLamp - lampK) * Math.min(1, dt * 2.5); SIM.lampI = lampK * 1.15;
    astro.userData.lampGlow.visible = lampK > 0.2;
    // suit scanner pulse
    const sc = SIM.scan, want = SIM.mode === 'foot' && player.scan ? 1 : 0;
    sc.k += (want - sc.k) * Math.min(1, dt * 5);
    if (want) {
      if (scanWait > 0) { scanWait -= dt; if (scanWait <= 0) sc.r = 0; }
      else { sc.r += dt * 42; if (sc.r > 112) { sc.r = 112; scanWait = 2.2; } }
      sc.pos.copy(player.p).sub(pP).applyQuaternion(player.body.q);
    } else { sc.r = 0; scanWait = 0; }
    sampMat.emissiveIntensity = 0.55 * sc.k * (0.6 + 0.4 * Math.sin(performance.now() / 260));
  };

  SIM.onTerrainChange = function (b) {
    rockKey = ''; sampKey = ''; campBody = null;
    if (ship.landed && ship.body === b && !ship.seq) { _r.copy(ship.p).normalize(); const g = SIM.groundR(b, _r.x, _r.y, _r.z); ship.water = SIM.water; ship.p.copy(_r).multiplyScalar(g + REST); }
    if (SIM.mode === 'foot' && player.body === b) { _r.copy(player.p).normalize(); player.p.copy(_r).multiplyScalar(SIM.groundR(b, _r.x, _r.y, _r.z)); }
  };
  // jump the clock forward until the Sun is well up where the ship / astronaut stands
  SIM.makeDay = function () {
    const foot = SIM.mode === 'foot', b = foot ? player.body : ship.body;
    if (b === sun || (!foot && !ship.rot)) return false;
    const d = (foot ? player.p : ship.p).clone().normalize(), w = new V3();
    const period = b.d.locked ? b.d.orbit.P : Math.abs(b.d.rotH) / 24, t0 = SIM.t;
    let best = -2, bt = t0;
    for (let i = 1; i <= 240; i++) {
      const t = t0 + period * 1.08 * i / 240;
      SIM.updateBodies(t); w.copy(d).applyQuaternion(b.q); const e = w.dot(b.sunDir);
      if (e > best) { best = e; bt = t; }
      if (e > 0.62) break;
    }
    SIM.t = bt; SIM.updateBodies(SIM.t);
    return best > 0.1;
  };
  // how high the Sun is where the ship / astronaut stands (sine of the elevation)
  SIM.sunHere = function () {
    const foot = SIM.mode === 'foot', b = foot ? player.body : ship.body;
    if (b === sun) return 1;
    _r.copy(foot ? player.p : ship.p).normalize(); if (foot || ship.rot) _r.applyQuaternion(b.q);
    return _r.dot(b.sunDir);
  };

  // ---------- start: on the pad at Kennedy Space Center, nose pointing east
  // The clock starts at the next mid-morning at the Cape (at most a day ahead of the real date), so the first launch is in daylight.
  (function () {
    const e = SIM.byId.earth, up = new V3();
    for (let i = 0; i < 144; i++) {
      SIM.updateBodies(SIM.t);
      up.copy(SIM.KSC).applyQuaternion(e.q);
      if (up.dot(e.sunDir) > 0.55) break;
      SIM.t += 1 / 144;
    }
  })();
  SIM.updateBodies(SIM.t);
  SIM.placeLanded(SIM.byId.earth, SIM.KSC, null);
  SIM.cam.body = SIM.byId.earth;
})();
