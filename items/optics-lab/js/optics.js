// optics.js - exact 2D ray optics for the Optics Lab (no three.js, runs in node too).
// Plane of the optical table: 2D points [u, v] (cm). Every drawn ray comes from trace():
// law of reflection at mirrors / TIR, Snell's law (vector form) at glass surfaces,
// Fresnel (unpolarised) for how bright each ray is, Sellmeier n(lambda) for the glass.

export const GLASS = {
  // Schott Sellmeier coefficients, lambda in micrometres (refractiveindex.info / Schott datasheets)
  BK7: { name: 'BK7 crown glass', B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653] },
  SF11: { name: 'SF11 flint glass', B: [1.73759695, 0.313747346, 1.89878101], C: [0.013188707, 0.0623068142, 155.23629] },
};
export const N_AIR = 1.0;

export function nGlass(glass, lambdaNm) {
  const g = typeof glass === 'string' ? GLASS[glass] : glass;
  const l2 = (lambdaNm / 1000) ** 2;
  let s = 1;
  for (let k = 0; k < 3; k++) s += (g.B[k] * l2) / (l2 - g.C[k]);
  return Math.sqrt(s);
}

export const DEG = Math.PI / 180;
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, s) => [a[0] * s, a[1] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const len = (a) => Math.hypot(a[0], a[1]);
export const norm = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
export const dirOf = (deg) => [Math.cos(deg * DEG), Math.sin(deg * DEG)];
export const angOf = (d) => Math.atan2(d[1], d[0]) / DEG;
export const rot = (p, deg, c = [0, 0]) => {
  const a = deg * DEG, x = p[0] - c[0], y = p[1] - c[1];
  return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)];
};
// angle between two directions, 0..180
export const angBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) / DEG;

// ---- vector laws ----
export function reflect(d, n) { const k = 2 * dot(d, n); return [d[0] - k * n[0], d[1] - k * n[1]]; }
// n points against d (towards the incoming side). eta = n1/n2. Returns null on total internal reflection.
export function refract(d, n, eta) {
  const cosi = -dot(d, n);
  const sin2t = eta * eta * (1 - cosi * cosi);
  if (sin2t > 1) return null;
  const cost = Math.sqrt(1 - sin2t);
  return norm([eta * d[0] + (eta * cosi - cost) * n[0], eta * d[1] + (eta * cosi - cost) * n[1]]);
}
// unpolarised Fresnel reflectance
export function fresnelR(n1, n2, cosi) {
  const sin2t = (n1 / n2) ** 2 * (1 - cosi * cosi);
  if (sin2t >= 1) return 1;
  const cost = Math.sqrt(1 - sin2t);
  const rs = (n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost);
  const rp = (n1 * cost - n2 * cosi) / (n1 * cost + n2 * cosi);
  return 0.5 * (rs * rs + rp * rp);
}

// ---- shapes ----
// element: {t:'seg', a, b} | {t:'arc', c, r, a0, a1} (arc from angle a0 to a1 deg, counter-clockwise)
export const seg = (a, b, extra = {}) => ({ t: 'seg', a, b, ...extra });
export const arc = (c, r, a0, a1, extra = {}) => ({ t: 'arc', c, r, a0, a1, ...extra });

function inArc(e, p) {
  let a = Math.atan2(p[1] - e.c[1], p[0] - e.c[0]) / DEG;
  let s = ((a - e.a0) % 360 + 360) % 360;
  const span = ((e.a1 - e.a0) % 360 + 360) % 360 || 360;
  return s <= span + 1e-9;
}
const EPS = 1e-7;
export function hitElement(e, o, d) {
  if (e.t === 'seg') {
    const ab = sub(e.b, e.a);
    const den = cross(d, ab);
    if (Math.abs(den) < 1e-14) return null;
    const ao = sub(e.a, o);
    const t = cross(ao, ab) / den;
    const s = cross(ao, d) / den;
    if (t <= EPS || s < -1e-9 || s > 1 + 1e-9) return null;
    const p = add(o, mul(d, t));
    const nn = norm([ab[1], -ab[0]]);
    return { t, p, n: nn };
  }
  // arc: |o + t d - c| = r
  const oc = sub(o, e.c);
  const b = dot(oc, d), cc = dot(oc, oc) - e.r * e.r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [-b - sq, -b + sq]) {
    if (t <= EPS) continue;
    const p = add(o, mul(d, t));
    if (!inArc(e, p)) continue;
    return { t, p, n: norm(sub(p, e.c)) };
  }
  return null;
}

// glass shape: {id, glass:'BK7', elems:[...]}; mirror: {id, a, b, front:[nx,nv]} (front normal);
// screen: {id, elem}; stop: {id, elem} (absorbs, e.g. a holder)
export function trace(source, scene, opts = {}) {
  const segs = [], events = [], hits = [];
  const maxLen = opts.maxLen ?? 200;
  const lambda = source.lambda ?? 650;
  const stack = [{ o: source.p, d: norm(source.d), I: source.I ?? 1, inside: -1, depth: 0, kind: 'main', s: 0 }];
  let guard = 0;
  while (stack.length && guard++ < 400) {
    const ray = stack.pop();
    if (ray.depth > (opts.maxDepth ?? 40) || ray.I < 1e-4) continue;
    let best = null;
    const consider = (h, obj, type, ei) => { if (h && (!best || h.t < best.t)) best = { ...h, obj, type, ei }; };
    (scene.glass || []).forEach((g, gi) => g.elems.forEach((e, ei) => consider(hitElement(e, ray.o, ray.d), gi, 'glass', ei)));
    (scene.mirrors || []).forEach((m, mi) => consider(hitElement(seg(m.a, m.b), ray.o, ray.d), mi, 'mirror', 0));
    (scene.screens || []).forEach((s, si) => consider(hitElement(s.elem, ray.o, ray.d), si, 'screen', 0));
    (scene.stops || []).forEach((s, si) => consider(hitElement(s.elem, ray.o, ray.d), si, 'stop', 0));
    const nMed = ray.inside >= 0 ? nGlass(scene.glass[ray.inside].glass, lambda) : N_AIR;
    if (!best || best.t > maxLen) {
      segs.push({ a: ray.o, b: add(ray.o, mul(ray.d, maxLen)), I: ray.I, n: nMed, lambda, kind: ray.kind, inside: ray.inside, end: 'free', s0: ray.s, s1: ray.s + maxLen });
      continue;
    }
    const p = best.p;
    const s1 = ray.s + best.t;
    segs.push({ a: ray.o, b: p, I: ray.I, n: nMed, lambda, kind: ray.kind, inside: ray.inside, end: best.type, s0: ray.s, s1 });
    let nIn = best.n; if (dot(nIn, ray.d) > 0) nIn = mul(nIn, -1); // points back towards incoming side
    const cosi = -dot(ray.d, nIn);
    const iDeg = Math.acos(Math.min(1, cosi)) / DEG;
    if (best.type === 'screen') { hits.push({ screen: scene.screens[best.obj].id, p, I: ray.I, lambda, d: ray.d, s: s1, n: nIn }); continue; }
    if (best.type === 'stop') continue;
    if (best.type === 'mirror') {
      const m = scene.mirrors[best.obj];
      if (m.front && dot(ray.d, m.front) > 0) continue; // hit the back of the mirror: absorbed
      const dOut = reflect(ray.d, nIn);
      events.push({ type: 'mirror', obj: m.id, s: s1, kind: ray.kind, p, n: nIn, din: ray.d, dout: dOut, i: iDeg, r: angBetween(dOut, nIn), n1: nMed, n2: nMed });
      stack.push({ o: p, d: dOut, I: ray.I * (m.R ?? 1), inside: ray.inside, depth: ray.depth + 1, kind: ray.kind, s: s1 });
      continue;
    }
    // glass boundary
    const g = scene.glass[best.obj];
    const entering = ray.inside !== best.obj;
    const n1 = nMed, n2 = entering ? nGlass(g.glass, lambda) : N_AIR;
    const newInside = entering ? best.obj : -1;
    const dT = refract(ray.d, nIn, n1 / n2);
    const R = fresnelR(n1, n2, cosi);
    const elem = g.elems[best.ei];
    if (!dT) {
      const dR = reflect(ray.d, nIn);
      events.push({ type: 'tir', obj: g.id, elem: best.ei, s: s1, kind: ray.kind, p, n: nIn, din: ray.d, dout: dR, i: iDeg, r: angBetween(dR, nIn), n1, n2, R: 1 });
      stack.push({ o: p, d: dR, I: ray.I, inside: ray.inside, depth: ray.depth + 1, kind: ray.kind, s: s1 });
      continue;
    }
    const rDeg = angBetween(dT, mul(nIn, -1));
    events.push({ type: 'refract', obj: g.id, elem: best.ei, entering, s: s1, kind: ray.kind, p, n: nIn, din: ray.d, dout: dT, i: iDeg, r: rDeg, n1, n2, R });
    if (elem.partial && opts.partial !== false) {
      const dR = reflect(ray.d, nIn);
      stack.push({ o: p, d: dR, I: ray.I * R, inside: ray.inside, depth: ray.depth + 1, kind: 'partial', s: s1 });
      stack.push({ o: p, d: dT, I: ray.I * (1 - R), inside: newInside, depth: ray.depth + 1, kind: ray.kind, s: s1 });
    } else {
      // keep the beam's brightness readable: the ~4% surface losses are not drawn
      stack.push({ o: p, d: dT, I: ray.I, inside: newInside, depth: ray.depth + 1, kind: ray.kind, s: s1 });
    }
  }
  return { segs, events, hits };
}

// ---- shape builders ----
export function polygonShape(pts, extra = {}) {
  const elems = pts.map((p, k) => seg(p, pts[(k + 1) % pts.length]));
  return { elems, pts, ...extra };
}
export function rectPts(c, w, h, ang = 0) {
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map((p) => add(rot(p, ang), c));
}
// equilateral-ish prism: apex angle A, side s, centroid c, rotation ang. Returns pts [apex, baseR, baseL]
export function prismPts(c, s, A, ang) {
  // isoceles triangle with apex angle A and equal sides s, apex pointing +v before rotation
  const h = s * Math.cos((A / 2) * DEG), half = s * Math.sin((A / 2) * DEG);
  const apex = [0, h], bR = [half, 0], bL = [-half, 0];
  const cy = h / 3; // centroid
  return [apex, bR, bL].map((p) => add(rot(sub(p, [0, cy]), ang), c));
}
// semicircle block: flat face through centre c, curved side towards direction ang+90
export function semicircleShape(c, R, ang, extra = {}) {
  const a = rot(add(c, [R, 0]), ang, c), b = rot(add(c, [-R, 0]), ang, c);
  return { elems: [arc(c, R, ang, ang + 180), seg(b, a, { partial: true })], c, R, ang, ...extra };
}
// symmetric biconvex lens: centre c, axis along direction ang (deg), surface radius R, diameter D, centre thickness t
export function lensShape(c, R, D, t, ang, extra = {}) {
  const ax = dirOf(ang);
  const h = D / 2;
  const sag = R - Math.sqrt(R * R - h * h);
  const e = t / 2 - sag; // half edge thickness
  const half = Math.asin(h / R) / DEG;
  // front surface (facing -ax): vertex at c - ax*t/2, centre of curvature at c - ax*t/2 + ax*R
  const c1 = add(c, mul(ax, R - t / 2));
  const c2 = add(c, mul(ax, -(R - t / 2)));
  const elems = [
    arc(c1, R, ang + 180 - half, ang + 180 + half),
    arc(c2, R, ang - half, ang + half),
  ];
  const perp = [-ax[1], ax[0]];
  if (e > 1e-6) {
    const topF = add(add(c, mul(perp, h)), mul(ax, -e)), topB = add(add(c, mul(perp, h)), mul(ax, e));
    const botF = add(add(c, mul(perp, -h)), mul(ax, -e)), botB = add(add(c, mul(perp, -h)), mul(ax, e));
    elems.push(seg(topF, topB), seg(botF, botB));
  }
  return { elems, c, R, D, t, ang, sag, edge: 2 * e, ...extra };
}
// thick-lens paraxial focal length (from the lens maker's equation) - used for the label
export function thickLensF(n, R1, R2, t) {
  const inv = (n - 1) * (1 / R1 - 1 / R2 + ((n - 1) * t) / (n * R1 * R2));
  return 1 / inv;
}
// bent glass rod (light pipe) in 2D: straight L1 along +u from start, then a bend of radius Rb through bendDeg, then straight L2
export function fibreShape(start, w, L1, Rb, bendDeg, L2, extra = {}) {
  const hw = w / 2;
  // centreline: start -> p1 (along +u), arc about centre cb = p1 + [0, Rb] (bending towards +v), then straight
  const p1 = add(start, [L1, 0]);
  const cb = add(p1, [0, Rb]);
  const a0 = -90, a1 = -90 + bendDeg;
  const tEnd = dirOf(bendDeg); // direction after the bend
  const p2 = add(cb, mul(dirOf(a1), Rb));
  const p3 = add(p2, mul(tEnd, L2));
  const nrm = (d) => [-d[1], d[0]]; // left normal (+v side)
  const n0 = [0, 1], n2 = nrm(tEnd);
  const elems = [
    seg(add(start, mul(n0, -hw)), add(start, mul(n0, hw))), // entry face
    seg(add(start, mul(n0, -hw)), add(p1, mul(n0, -hw))), // outer straight 1 (right side, -v)
    seg(add(start, mul(n0, hw)), add(p1, mul(n0, hw))), // inner straight 1
    arc(cb, Rb + hw, a0, a1), // outer bend
    arc(cb, Rb - hw, a0, a1), // inner bend
    seg(add(p2, mul(n2, -hw)), add(p3, mul(n2, -hw))),
    seg(add(p2, mul(n2, hw)), add(p3, mul(n2, hw))),
    seg(add(p3, mul(n2, -hw)), add(p3, mul(n2, hw))), // exit face
  ];
  return { elems, start, p1, cb, p2, p3, w, Rb, bendDeg, a0, a1, tEnd, ...extra };
}

// wavelength (nm) -> linear-ish sRGB triple 0..1 (Bruton approximation with edge fall-off)
export function wavelengthRGB(l) {
  let r = 0, g = 0, b = 0;
  if (l < 440) { r = -(l - 440) / 60; b = 1; }
  else if (l < 490) { g = (l - 440) / 50; b = 1; }
  else if (l < 510) { g = 1; b = -(l - 510) / 20; }
  else if (l < 580) { r = (l - 510) / 70; g = 1; }
  else if (l < 645) { r = 1; g = -(l - 645) / 65; }
  else r = 1;
  let f = 1;
  if (l < 420) f = 0.3 + 0.7 * (l - 380) / 40;
  else if (l > 700) f = 0.3 + 0.7 * (780 - l) / 80;
  return [r * f, g * f, b * f];
}

// minimise f on [a,b] (golden section)
export function goldenMin(f, a, b, tol = 1e-7) {
  const gr = (Math.sqrt(5) - 1) / 2;
  let c = b - gr * (b - a), d = a + gr * (b - a);
  while (Math.abs(b - a) > tol) {
    if (f(c) < f(d)) b = d; else a = c;
    c = b - gr * (b - a); d = a + gr * (b - a);
  }
  return (a + b) / 2;
}
// intersection of two lines p+t d and q+s e
export function lineX(p, d, q, e) {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(q, p), e) / den;
  return add(p, mul(d, t));
}
export const distPointLine = (p, a, d) => Math.abs(cross(sub(p, a), norm(d)));
