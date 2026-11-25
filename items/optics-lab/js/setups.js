// setups.js - the six experiments as pure geometry + physics (no three.js; runs in node for tests).
// build(p) places every part from the step parameters p, traces every ray with optics.js,
// and measures every number that goes on screen from those traced rays.
import * as O from './optics.js';

export const H = 7.5;          // beam height above the table (cm)
export const LASER_NM = 650;   // red diode laser
const { add, sub, mul, dirOf, angOf, norm, rot, angBetween } = O;

export const fmt = {
  deg: (x) => `${(Math.round(x * 10) / 10).toFixed(1)}°`,
  cm: (x) => `${(Math.round(x * 10) / 10).toFixed(1)} cm`,
  n3: (x) => (Math.round(x * 1000) / 1000).toFixed(3),
};

// smaller arc between two directions
function arcBetween(a, b) {
  const d = ((b - a) % 360 + 540) % 360 - 180;
  return d >= 0 ? [a, a + d] : [b, b - d];
}
function arcOv(c, r, angA, angB, col, label, alpha) {
  const [a0, a1] = arcBetween(angA, angB);
  const mid = (a0 + a1) / 2;
  return { c, r, a0, a1, col, alpha, label, lp: add(c, mul(dirOf(mid), r + 2.6)) };
}
const tf = (pts, c, ang) => pts.map((p) => add(rot(p, ang), c));
function tfElems(elems, c, ang) {
  return elems.map((e) => (e.t === 'seg'
    ? { ...e, a: add(rot(e.a, ang), c), b: add(rot(e.b, ang), c) }
    : { ...e, c: add(rot(e.c, ang), c), a0: e.a0 + ang, a1: e.a1 + ang }));
}
function mainEvents(res) { return res.events.filter((e) => e.kind === 'main').sort((a, b) => a.s - b.s); }
function lastMain(res) { return res.segs.filter((s) => s.kind === 'main').sort((a, b) => b.s1 - a.s1)[0]; }
const segDir = (s) => norm(sub(s.b, s.a));

// spectral sample sets for white light
export const BANDS = [
  { k: 'V', name: 'violet', nm: 410 }, { k: 'I', name: 'indigo', nm: 440 }, { k: 'B', name: 'blue', nm: 470 },
  { k: 'G', name: 'green', nm: 530 }, { k: 'Y', name: 'yellow', nm: 580 }, { k: 'O', name: 'orange', nm: 610 },
  { k: 'R', name: 'red', nm: 660 },
];
export const FINE = Array.from({ length: 41 }, (_, k) => 400 + k * 7.5);

// ---------------------------------------------------------------- 1. reflection
const E1 = {
  id: 'reflection', title: 'Reflection',
  defaults: { on: 0, normal: 0, arcs: 0, m: 0 },
  view: { az: 0, el: 58, azP: 0, elP: 66 },
  steps: [
    { set: {}, text: () => 'A laser, a flat mirror and a protractor on an optics table.' },
    { set: { on: 1 }, text: () => 'Laser on. The beam hits the mirror and bounces off onto the curved screen.' },
    { set: { normal: 1 }, text: () => 'The dashed line is the normal: it stands at 90° to the mirror.' },
    { set: { arcs: 1 }, text: (R) => `Angle of incidence i = ${R.i}. Angle of reflection r = ${R.r}. They are equal.` },
    { set: { m: -10 }, text: (R) => `Turn the mirror: now i = ${R.i} and r = ${R.r}. Still equal.` },
    { set: { m: 12 }, text: (R) => `Turn it the other way: i = ${R.i}, r = ${R.r}. However you turn it, r = i.` },
  ],
  build(p) {
    const nA = 90 + p.m;
    const laser = { kind: 'laser', id: 'laser', pos: mul(dirOf(120), 20), ang: 300, on: p.on };
    const mirror = { kind: 'mirror', id: 'mirror', c: [0, 0], ang: nA, size: 4.4 };
    const t = dirOf(nA - 90);
    const scene = {
      mirrors: [{ id: 'mirror', a: mul(t, -2.2), b: mul(t, 2.2), front: dirOf(nA) }],
      screens: [{ id: 'arcScreen', elem: O.arc([0, 0], 19, 22, 98) }],
    };
    const src = { p: laser.pos, d: dirOf(laser.ang), lambda: LASER_NM };
    const res = O.trace(src, scene);
    const ev = mainEvents(res)[0];
    const num = { i: ev.i, r: ev.r };
    const ov = { arcs: [], lines: [], labels: [] };
    const nAng = angOf(ev.n);
    ov.lines.push({ a: ev.p, b: add(ev.p, mul(ev.n, 11)), col: 'n', alpha: p.normal, dash: true });
    ov.arcs.push(arcOv(ev.p, 6.5, nAng, angOf(mul(ev.din, -1)), 'i', `i = ${fmt.deg(num.i)}`, p.arcs));
    ov.arcs.push(arcOv(ev.p, 6.5, nAng, angOf(ev.dout), 'r', `r = ${fmt.deg(num.r)}`, p.arcs));
    return {
      objs: [laser, mirror,
        { kind: 'stage', id: 'stage', c: [0, 0], r: 9.5, rot: 0, scale: 'half', zero: 90, top: H - 3.4 },
        { kind: 'arcScreen', id: 'arcScreen', c: [0, 0], R: 19, a0: 22, a1: 98 }],
      traces: [{ src, res, col: 'red' }], num, ov,
      frame: [[-17, 19], [17, 19], [-12, -4], [12, -4], [-24, 20], [0, 24]],
    };
  },
};

// ---------------------------------------------------------------- 2. glass slab
const SLAB = { w: 5, h: 14 };
const E2 = {
  id: 'slab', title: 'Refraction in a glass slab',
  defaults: { on: 0, rot: 0, normal: 0, arcs: 0, arcs2: 0, ghost: 0, zoom: 0 },
  view: { az: 0, el: 52, azP: -90, elP: 62 },
  steps: [
    { set: {}, text: () => 'A glass slab (BK7 glass) on a turntable, a red laser and a screen.' },
    { set: { on: 1 }, text: (R) => `Laser on, straight at the glass (i = ${R.i}). It goes through without bending.` },
    { set: { rot: 40, normal: 1, arcs: 1, zoom: 1 }, text: (R) => `Turn the slab: i = ${R.i}. Entering glass the beam bends towards the normal: r = ${R.r}.` },
    { set: { arcs2: 1 }, text: (R) => `Leaving the glass it bends away from the normal, out at e = ${R.e}: parallel to the beam going in.` },
    { set: { ghost: 1, zoom: 0 }, text: (R) => `So the beam is shifted sideways by d = ${R.d}. This is the lateral shift.` },
    { set: { zoom: 1 }, text: (R) => `Snell's law: 1.000 × sin ${R.i} = ${R.si} = ${R.n} × sin ${R.r}.` },
    { set: { rot: 60 }, text: (R) => `At i = ${R.i}: r = ${R.r}, d = ${R.d}. Again 1.000 × sin ${R.i} = ${R.si} = ${R.n} × sin ${R.r}.` },
  ],
  build(p) {
    const laser = { kind: 'laser', id: 'laser', pos: [-26, 0], ang: 0, on: p.on };
    const pts = tf(O.rectPts([0, 0], SLAB.w, SLAB.h), [0, 0], p.rot);
    const glass = { id: 'slab', glass: 'BK7', ...O.polygonShape(pts) };
    const screen = { kind: 'screen', id: 'screen', c: [26, 0], ang: 180, w: 16, hgt: 10 };
    const scene = { glass: [glass], screens: [{ id: 'screen', elem: O.seg([26, -8], [26, 8]) }] };
    const src = { p: laser.pos, d: [1, 0], lambda: LASER_NM };
    const res = O.trace(src, scene);
    const ev = mainEvents(res);
    const e1 = ev[0], e2 = ev[1];
    const n = O.nGlass('BK7', LASER_NM);
    const out = lastMain(res);
    const num = { i: e1.i, r: e1.r, e: e2.r, i2: e2.i, n, d: O.distPointLine(e2.p, src.p, src.d) };
    num.si = Math.sin(num.i * O.DEG);
    const ov = { arcs: [], lines: [], labels: [] };
    const showNorm = p.normal * (num.i > 0.5 ? 1 : 0.0);
    for (const e of [e1, e2]) {
      ov.lines.push({ a: add(e.p, mul(e.n, 6)), b: add(e.p, mul(e.n, -6)), col: 'n', alpha: p.normal, dash: true });
    }
    ov.arcs.push(arcOv(e1.p, 4.2, angOf(e1.n), angOf(mul(e1.din, -1)), 'i', `i = ${fmt.deg(num.i)}`, p.arcs * showNorm));
    ov.arcs.push(arcOv(e1.p, 4.2, angOf(mul(e1.n, -1)), angOf(e1.dout), 'r', `r = ${fmt.deg(num.r)}`, p.arcs * showNorm));
    ov.arcs.push(arcOv(e2.p, 4.2, angOf(mul(e2.n, -1)), angOf(e2.dout), 'e', `e = ${fmt.deg(num.e)}`, p.arcs2 * showNorm));
    // ghost: where the beam would go without the glass
    const ghostEnd = [26 - 0.25, 0];
    ov.lines.push({ a: e1.p, b: ghostEnd, col: 'g', alpha: p.ghost, dash: true });
    const outEnd = out.b;
    ov.labels.push({ p: add(ghostEnd, [-5.5, (outEnd[1] - ghostEnd[1]) / 2 + (outEnd[1] >= 0 ? -2.6 : 2.6)]), text: `d = ${fmt.cm(num.d)}`, col: 'g', alpha: p.ghost });
    ov.marks = [{ kind: 'ring', p: ghostEnd, screenAng: 180, alpha: p.ghost }];
    return {
      objs: [laser, { kind: 'stage', id: 'stage', c: [0, 0], r: 9, rot: p.rot, scale: 'full', zero: 180, top: H - 1.75 },
        { kind: 'glass', id: 'slab', form: 'slab', w: SLAB.w, h: SLAB.h, c: [0, 0], rot: p.rot, lift: 0, hgt: 3.4 },
        screen],
      traces: [{ src, res, col: 'red' }], num, ov,
      frame: p.zoom > 0.5 ? [[-11, -8], [11, -8], [-11, 8], [11, 8]]
        : [[-36, -4], [-36, 4], [27, -8], [27, 8], [0, 9], [0, -9]],
    };
  },
};

// ---------------------------------------------------------------- 3. prism, red laser
const PRISM_S = 8, PRISM_A = 60, BEAM_V = 0.8;
function prismTrace(glassName, lambda, i, extraGlass = []) {
  const pts = O.prismPts([0, 0], PRISM_S, PRISM_A, 30 - i);
  const glass = [{ id: 'prism', glass: glassName, ...O.polygonShape(pts) }, ...extraGlass];
  return { pts, res: O.trace({ p: [-26, BEAM_V], d: [1, 0], lambda }, { glass }) };
}
function prismD(glassName, lambda, i) {
  const { res } = prismTrace(glassName, lambda, i);
  return angBetween([1, 0], segDir(lastMain(res)));
}
const BK7n = O.nGlass('BK7', LASER_NM);
const IMIN3 = O.goldenMin((i) => prismD('BK7', LASER_NM, i), 40, 58);
const E3SCREEN = (() => {
  const dir = dirOf(-44.5); // centre of the range of exit directions
  const c = add([2, -1], mul(dir, 27));
  return { c, ang: angOf(mul(dir, -1)), w: 20 };
})();
function screenElem(s) {
  const t = dirOf(s.ang + 90);
  return O.seg(add(s.c, mul(t, -s.w / 2)), add(s.c, mul(t, s.w / 2)));
}
const E3 = {
  id: 'prism', title: 'Prism and a red laser',
  defaults: { on: 0, i: 30, dev: 0, par: 0, inorm: 0 },
  view: { az: 0, el: 55, azP: -62, elP: 62 },
  steps: [
    { set: {}, text: () => 'A 60° glass prism (BK7) on a turntable, and a red laser.' },
    { set: { on: 1 }, text: () => 'Laser on. The beam bends twice, both times towards the thick base of the prism.' },
    { set: { dev: 1, inorm: 1 }, text: (R) => `It is turned through D = ${R.D}, the angle of deviation. Here i = ${R.i}.` },
    { set: { i: 40 }, text: (R) => `Turn the prism: i = ${R.i}, and D falls to ${R.D}.` },
    { set: { i: IMIN3, par: 1 }, text: (R) => `D stops falling at ${R.D} when i = ${R.i}: minimum deviation. Inside, the beam runs parallel to the base.` },
    { set: { i: 60, par: 0 }, text: (R) => `Turn further, i = ${R.i}: D grows again, to ${R.D}.` },
    { set: { i: IMIN3 }, text: (R) => `At minimum deviation n = sin((A + D)/2) ÷ sin(A/2) = sin ${R.half} ÷ sin 30.0° = ${R.nmd}.` },
  ],
  build(p) {
    const laser = { kind: 'laser', id: 'laser', pos: [-26, BEAM_V], ang: 0, on: p.on };
    const pts = O.prismPts([0, 0], PRISM_S, PRISM_A, 30 - p.i);
    const glass = { id: 'prism', glass: 'BK7', ...O.polygonShape(pts) };
    const scene = { glass: [glass], screens: [{ id: 'screen', elem: screenElem(E3SCREEN) }] };
    const src = { p: laser.pos, d: [1, 0], lambda: LASER_NM };
    const res = O.trace(src, scene);
    const ev = mainEvents(res);
    const e1 = ev[0], e2 = ev[1];
    const out = lastMain(res);
    const dOut = segDir(out);
    const D = angBetween(src.d, dOut);
    const Dmin = prismD('BK7', LASER_NM, IMIN3);
    const num = { i: e1.i, r1: e1.r, r2: e2.i, e: e2.r, D, A: PRISM_A, n: BK7n, imin: IMIN3, Dmin };
    num.half = (PRISM_A + D) / 2;
    num.nmd = Math.sin(num.half * O.DEG) / Math.sin(PRISM_A / 2 * O.DEG);
    const ov = { arcs: [], lines: [], labels: [] };
    const X = O.lineX(src.p, src.d, e2.p, dOut);
    ov.lines.push({ a: e1.p, b: add(X, mul(src.d, 13)), col: 'g', alpha: p.dev, dash: true });
    ov.lines.push({ a: e2.p, b: X, col: 'g', alpha: p.dev, dash: true });
    ov.arcs.push(arcOv(X, 6.5, 0, angOf(dOut), 'd', `D = ${fmt.deg(D)}`, p.dev));
    ov.lines.push({ a: add(e1.p, mul(e1.n, 5)), b: add(e1.p, mul(e1.n, -3)), col: 'n', alpha: p.inorm, dash: true });
    ov.arcs.push(arcOv(e1.p, 3.6, angOf(e1.n), angOf(mul(e1.din, -1)), 'i', `i = ${fmt.deg(num.i)}`, p.inorm));
    // base edge pts[1]->pts[2]; label parallel
    const mid = O.mul(add(e1.p, e2.p), 0.5);
    ov.labels.push({ p: add(mid, [0, -5.2]), text: 'parallel to base', col: 'g', alpha: p.par });
    ov.lines.push({ a: add(pts[2], mul(norm(sub(pts[1], pts[2])), -1)), b: add(pts[1], mul(norm(sub(pts[1], pts[2])), 1)), col: 'g', alpha: p.par, dash: false, w: 0.12, y: -1.95 });
    return {
      objs: [laser, { kind: 'stage', id: 'stage', c: [0, 0], r: 8.5, rot: 30 - p.i, scale: 'full', zero: 0, top: H - 2.05 },
        { kind: 'glass', id: 'prism', form: 'poly', local: O.prismPts([0, 0], PRISM_S, PRISM_A, 0), c: [0, 0], rot: 30 - p.i, lift: 0, hgt: 4 },
        { kind: 'screen', id: 'screen', ...E3SCREEN, hgt: 10 }],
      traces: [{ src, res, col: 'red' }], num, ov,
      frame: [[-36, -3], [-36, 4], [-6, 8], [6, 6], add(E3SCREEN.c, [-8, -6]), add(E3SCREEN.c, [8, 6]), add(E3SCREEN.c, [0, 2])],
    };
  },
};

// ---------------------------------------------------------------- 4. prism, white light
const SF = 'SF11';
const IMIN4 = O.goldenMin((i) => prismD(SF, 589.3, i), 50, 75);
const P1PTS = O.prismPts([0, 0], PRISM_S, PRISM_A, 30 - IMIN4);
// second prism = point reflection of the first through the midpoint P of a short gap on the 589 nm exit ray:
// its faces are antiparallel to the first prism's, so every colour leaves it parallel to the white beam (Newton)
const P2PIV = (() => {
  const { res } = prismTrace(SF, 589.3, IMIN4);
  const out = lastMain(res);
  return add(out.a, mul(segDir(out), 0.3));
})();
const P2C = sub(mul(P2PIV, 2), [0, 0]); // centroid of prism 2
const P2PTS = P1PTS.map((q) => sub(mul(P2PIV, 2), q));
const E4A = (() => {
  const { res } = prismTrace(SF, 589.3, IMIN4);
  const out = lastMain(res);
  const dir = segDir(out);
  const c = add(out.a, mul(dir, 32));
  return { c, ang: angOf(mul(dir, -1)), w: 16 };
})();
const E4B = (() => {
  const { res } = prismTrace(SF, 589.3, IMIN4);
  const ein = mainEvents(res)[0].p;
  const vOut = 2 * P2PIV[1] - ein[1]; // exit height of the recombined beam (point symmetry)
  return { c: [34, (vOut + BEAM_V) / 2], ang: 180, w: 16 };
})();
const E4 = {
  id: 'white', title: 'White light through a prism',
  defaults: { on: 0, lift1: 1, lift2: 1, vib: 0, nums: 0 },
  view: { az: 0, el: 55, azP: -55, elP: 62 },
  steps: [
    { set: {}, text: () => 'A white light source with a thin slit, and a flint-glass prism (SF11) waiting above the bench.' },
    { set: { on: 1 }, text: () => 'White light on: it makes a white spot on the screen straight ahead.' },
    { set: { lift1: 0 }, text: () => 'Lower the prism into the beam: the white light fans out into a band of colours, a spectrum.' },
    { set: { vib: 1 }, text: () => 'Seven colours: V I B G Y O R. Violet bends the most, red the least.' },
    { set: { nums: 1 }, text: (R) => `The glass bends violet more: n = ${R.nV} for violet, ${R.nR} for red. Violet turns ${R.DV}, red only ${R.DR}.` },
    { set: { lift2: 0 }, text: () => "Newton's test: a second prism, upside down, bends the colours back. They mix into white light again." },
  ],
  build(p) {
    const src0 = { kind: 'lamp', id: 'lamp', pos: [-26, BEAM_V], ang: 0, on: p.on };
    const glass = [];
    if (p.lift1 * 14 < 2) glass.push({ id: 'prism', glass: SF, ...O.polygonShape(P1PTS) });
    if (p.lift2 * 14 < 2) glass.push({ id: 'prism2', glass: SF, ...O.polygonShape(P2PTS) });
    const scene = { glass, screens: [{ id: 'screenA', elem: screenElem(E4A) }, { id: 'screenB', elem: screenElem(E4B) }] };
    const traces = BANDS.map((b) => {
      const src = { p: src0.pos, d: [1, 0], lambda: b.nm };
      return { src, res: O.trace(src, scene), col: 'nm', nm: b.nm, band: b.k };
    });
    const fine = FINE.map((nm) => ({ nm, res: O.trace({ p: src0.pos, d: [1, 0], lambda: nm }, scene) }));
    const devOf = (t) => angBetween([1, 0], segDir(lastMain(t.res)));
    const tV = traces[0], tR = traces[6];
    const num = { nV: O.nGlass(SF, 410), nR: O.nGlass(SF, 660), DV: devOf(tV), DR: devOf(tR), imin: IMIN4, i: mainEvents(tV.res)[0]?.i ?? 0 };
    const ov = { arcs: [], lines: [], labels: [] };
    const hitOf = (t) => t.res.hits.find((h) => h.screen === 'screenA');
    if (glass.length === 1) {
      traces.forEach((t, k) => {
        const h = hitOf(t); if (!h) return;
        const side = mul(dirOf(E4A.ang + 90), 0);
        const lp = add(add(h.p, mul(dirOf(E4A.ang), 2.4)), side);
        const text = (k === 0 || k === 6) && p.nums > 0.01 ? `${BANDS[k].k} · D = ${fmt.deg(devOf(t))}` : BANDS[k].k;
        ov.labels.push({ p: lp, text, col: 'nm', nm: BANDS[k].nm, alpha: p.vib, small: true, key: 'band' + k });
      });
    }
    return {
      objs: [src0,
        { kind: 'stage', id: 'stage', c: [0, 0], r: 4.6, rot: 30 - IMIN4, scale: 'full', zero: 0, top: H - 2.05 },
        { kind: 'glass', id: 'prism', form: 'poly', glassType: SF, local: O.prismPts([0, 0], PRISM_S, PRISM_A, 0), c: [0, 0], rot: 30 - IMIN4, lift: p.lift1 * 14, hgt: 4 },
        { kind: 'glass', id: 'prism2', form: 'poly', glassType: SF, local: O.prismPts([0, 0], PRISM_S, PRISM_A, 0), c: P2C, rot: 30 - IMIN4 + 180, lift: p.lift2 * 14, hgt: 4 },
        { kind: 'stage', id: 'stage2', c: P2C, r: 3.8, rot: 210 - IMIN4, scale: 'none', zero: 0, top: H - 2.05 },
        { kind: 'screen', id: 'screenA', ...E4A, hgt: 10 }, { kind: 'screen', id: 'screenB', ...E4B, hgt: 10 }],
      traces, fine, num, ov, white: true,
      frame: [[-36, -3], [-36, 4], [-6, 9], [12, 8], [35, -9], [35, 8], add(E4A.c, [-9, -3]), add(E4A.c, [9, 3])],
    };
  },
};

// ---------------------------------------------------------------- 5. total internal reflection
const SEMI_R = 6;
const FIB = O.fibreShape([-12, -8], 1.0, 12, 9, 90, 10);
const FIB_ANG = 18;
const FIB_LASER = add(FIB.start, mul(dirOf(FIB_ANG), -8));
const CRIT = Math.asin(1 / BK7n) / O.DEG;
const E5 = {
  id: 'tir', title: 'Total internal reflection',
  defaults: { on: 0, i: 20, arcs: 0, fib: 0 },
  view: { az: 0, el: 60, azP: 0, elP: 66 },
  steps: [
    { set: {}, text: () => 'A half-round glass block (BK7). The beam enters the round side aimed at the centre, so it goes in straight.' },
    { set: { on: 1, arcs: 1 }, text: (R) => `At i = ${R.i} most light gets out, bending away from the normal: e = ${R.e}. A little reflects back.` },
    { set: { i: 35 }, text: (R) => `At i = ${R.i} it bends more, e = ${R.e}, and the reflected part gets brighter.` },
    { set: { i: CRIT - 1e-6 }, text: (R) => `At the critical angle c = ${R.c} the beam skims along the face: e = ${R.e}. sin c = 1/n = 1/${R.n}.` },
    { set: { i: 50 }, text: (R) => `Past it, at i = ${R.i}, no light gets out. It all reflects: total internal reflection.` },
    { set: { fib: 1, arcs: 0 }, text: (R) => `An optical fibre uses this: the light reflects ${R.N} times inside the glass and follows the bend.` },
  ],
  build(p) {
    const f = p.fib;
    const clamp = (x) => Math.max(0, Math.min(1, x));
    const semiLift = clamp(f * 2) * 14, fibLift = clamp(2 - 2 * f) * 14;
    const lpos0 = mul(dirOf(90 + p.i), 22), lang0 = 270 + p.i;
    const lpos = add(mul(lpos0, 1 - f), mul(FIB_LASER, f));
    const lang = lang0 + (FIB_ANG + 360 - lang0) * f;
    const laser = { kind: 'laser', id: 'laser', pos: lpos, ang: lang, on: p.on };
    const glass = [];
    if (semiLift < 2) glass.push({ id: 'semi', glass: 'BK7', ...O.semicircleShape([0, 0], SEMI_R, 0) });
    if (fibLift < 0.5) glass.push({ id: 'fibre', glass: 'BK7', ...FIB });
    const scene = {
      glass,
      screens: f < 0.5 ? [{ id: 'back', elem: O.arc([0, 0], 21, -95, 3) }, { id: 'front', elem: O.arc([0, 0], 21, 25, 80) }]
        : [{ id: 'fscreen', elem: O.seg(add(FIB.p3, [-5, 5]), add(FIB.p3, [5, 5])) }],
    };
    const src = { p: lpos, d: dirOf(lang), lambda: LASER_NM };
    const res = O.trace(src, scene);
    const ev = mainEvents(res);
    const flat = ev.find((e) => e.obj === 'semi' && e.elem === 1);
    const num = { c: CRIT, n: BK7n, i: flat ? flat.i : p.i, e: flat && flat.type === 'refract' ? flat.r : NaN, tir: flat ? flat.type === 'tir' : false, N: ev.filter((e) => e.type === 'tir' && e.obj === 'fibre').length };
    if (flat) num.R = flat.R;
    const ov = { arcs: [], lines: [], labels: [] };
    const a = p.arcs * (1 - f);
    if (flat) {
      ov.lines.push({ a: [0, 9], b: [0, -9], col: 'n', alpha: a, dash: true });
      ov.arcs.push(arcOv([0, 0], 4.2, 90, angOf(mul(flat.din, -1)), 'i', `i = ${fmt.deg(num.i)}`, a));
      if (flat.type === 'refract') ov.arcs.push(arcOv([0, 0], 4.2, -90, angOf(flat.dout), 'e', `e = ${fmt.deg(num.e)}`, a));
      else ov.labels.push({ p: [9.5, -5], text: 'no light out', col: 'e', alpha: a });
    }
    return {
      objs: [laser, { kind: 'stage', id: 'stage', c: [0, 0], r: 9, rot: 0, scale: 'full', zero: 90, top: H - 1.75, alpha: 1 - p.fib },
        { kind: 'glass', id: 'semi', form: 'semi', R: SEMI_R, c: [0, 0], rot: 0, lift: semiLift, hgt: 3.4, alpha: f < 0.99 ? 1 : 0 },
        { kind: 'glass', id: 'fibre', form: 'fibre', shape: FIB, c: [0, 0], rot: 0, lift: fibLift, hgt: 1.0, alpha: f > 0.01 ? 1 : 0 },
        { kind: 'arcScreen', id: 'back', c: [0, 0], R: 21, a0: -95, a1: 3, alpha: 1 - f },
        { kind: 'arcScreen', id: 'front', c: [0, 0], R: 21, a0: 25, a1: 80, alpha: 1 - f },
        { kind: 'screen', id: 'fscreen', c: add(FIB.p3, [0, 5]), ang: 270, w: 10, hgt: 8, alpha: f }],
      traces: [{ src, res, col: 'red' }], num, ov,
      frame: f > 0.5 ? [[-26, -13], [15, -13], [15, 17], [-26, 17]]
        : [[-20, 20], [-15, 22], [21, 0], [12, -19], [14, 15], [0, -21]],
    };
  },
};

// ---------------------------------------------------------------- 6. convex lens
const LENS = (() => { const R = 10.3, D = 6, sag = R - Math.sqrt(R * R - (D / 2) ** 2); return { R, D, t: 2 * sag + 0.3 }; })();
const LENS_SHAPE = O.lensShape([0, 0], LENS.R, LENS.D, LENS.t, 0);
const BEAMS_V = [-2.2, -1.1, 0, 1.1, 2.2];
const FOCUS = (() => {
  const res = O.trace({ p: [-24, 0.01], d: [1, 0], lambda: LASER_NM }, { glass: [{ id: 'lens', glass: 'BK7', ...LENS_SHAPE }] });
  const s = lastMain(res);
  return O.lineX(s.a, segDir(s), [0, 0], [1, 0])[0];
})();
const E6 = {
  id: 'lens', title: 'Convex lens',
  defaults: { on: 0, lift: 1, scr: 24, F: 0 },
  view: { az: 0, el: 52, azP: -90, elP: 60 },
  steps: [
    { set: {}, text: () => 'A convex lens (BK7 glass) and a ray box that makes five parallel laser beams.' },
    { set: { on: 1 }, text: () => 'Beams on: five parallel beams make five spots on the screen.' },
    { set: { lift: 0 }, text: () => 'Lower the lens: each beam bends towards the middle, and they all meet at one point.' },
    { set: { F: 1 }, text: (R) => `That point is the focus F, ${R.f} from the lens centre: the focal length f.` },
    { set: { scr: FOCUS }, text: () => 'Move the screen to F: all five beams land on one bright spot.' },
    { set: { scr: 27 }, text: () => 'Beyond F the beams cross over and spread out again, swapped side to side.' },
  ],
  build(p) {
    const box = { kind: 'raybox', id: 'raybox', pos: [-24, 0], ang: 0, on: p.on, beams: BEAMS_V };
    const glass = [];
    if (p.lift * 14 < 3) glass.push({ id: 'lens', glass: 'BK7', ...LENS_SHAPE });
    const scrU = p.scr + 0.0;
    const scene = { glass, screens: [{ id: 'screen', elem: O.seg([scrU, -8], [scrU, 8]) }] };
    const traces = BEAMS_V.map((v) => { const src = { p: [-24, v], d: [1, 0], lambda: LASER_NM }; return { src, res: O.trace(src, scene), col: 'red' }; });
    const n = O.nGlass('BK7', LASER_NM);
    const num = { f: FOCUS, n, R: LENS.R, t: LENS.t, fthick: O.thickLensF(n, LENS.R, -LENS.R, LENS.t) };
    const ov = { arcs: [], lines: [], labels: [] };
    ov.lines.push({ a: [0, -4.6], b: [FOCUS, -4.6], col: 'g', alpha: p.F, dash: false, w: 0.1, ticks: true });
    ov.labels.push({ p: [FOCUS / 2, -7.2], text: `f = ${fmt.cm(FOCUS)}`, col: 'g', alpha: p.F });
    ov.labels.push({ p: [FOCUS, 3.6], text: 'F', col: 'f', alpha: p.F });
    ov.marks = [{ kind: 'focus', p: [FOCUS, 0], alpha: p.F * (1 - p.lift) }];
    return {
      objs: [box,
        { kind: 'glass', id: 'lens', form: 'lens', ...LENS, c: [0, 0], rot: 0, lift: p.lift * 14, hgt: LENS.D },
        { kind: 'screen', id: 'screen', c: [scrU, 0], ang: 180, w: 16, hgt: 10 }],
      traces, num, ov,
      frame: [[-31, -3], [-31, 3], [0, -8], [0, 8], [28, -8], [28, 8]],
    };
  },
};

export const EXPS = [E1, E2, E3, E4, E5, E6];
export const CONST = { IMIN3, IMIN4, CRIT, FOCUS, LENS, BK7n, P2C, PRISM_S, PRISM_A, BEAM_V, SEMI_R, FIB_ANG };

// full parameter set for a step (cumulative)
export function stepParams(e, k) {
  const ex = EXPS[e];
  const p = { ...ex.defaults };
  for (let j = 0; j <= k; j++) Object.assign(p, ex.steps[j].set);
  return p;
}
// formatted readouts used by captions
export function readouts(num) {
  const R = {};
  for (const [k, v] of Object.entries(num)) {
    if (typeof v !== 'number' || Number.isNaN(v)) continue;
    if (['n', 'nV', 'nR', 'nmd', 'si'].includes(k)) R[k] = fmt.n3(v);
    else if (['d', 'f'].includes(k)) R[k] = fmt.cm(v);
    else if (k === 'N') R[k] = String(v);
    else R[k] = fmt.deg(v);
  }
  return R;
}
