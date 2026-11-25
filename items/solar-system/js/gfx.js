/* Solar System Explorer — shaders, materials and procedural textures. */
(function () {
  'use strict';
  const THREE = window.THREE;
  const noise3 = window.SOLTERRAIN.noise3;

  // =============================== surface (planet sphere + terrain chunks)
  const SURF_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform mat3 uInvRot; uniform vec3 uPlanetPos;
varying vec3 vWP; varying vec3 vN;
#ifdef CHUNK
attribute vec4 tint; attribute vec3 scan;
varying vec4 vTint; varying vec3 vScan; varying vec3 vNL; varying vec3 vDir;
#else
varying vec2 vUv;
#endif
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
#ifdef CHUNK
  vTint = tint; vScan = scan; vNL = normal; vDir = uInvRot * (wp.xyz - uPlanetPos);
#else
  vUv = uv;
#endif
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
  const SURF_FRAG = `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uColor;
uniform sampler2D uNight; uniform float uHasNight;
uniform vec3 uSunDir; uniform float uSunI; uniform float uAmb;
uniform vec3 uPole; uniform mat3 uInvRot; uniform vec3 uPlanetPos; uniform float uR;
uniform vec3 uAtmCol; uniform float uRim; uniform float uSoft; uniform float uLimb; uniform float uOcean;
uniform sampler2D uRingTex; uniform vec3 uRing; uniform vec3 uLightCol; uniform sampler2D uDetail;
varying vec3 vWP; varying vec3 vN;
#ifdef CHUNK
uniform vec3 uAnchor; uniform vec3 uLampPos; uniform float uLampI;
uniform float uScan; uniform float uScanR; uniform vec3 uScanPos;
uniform vec3 uFogCol; uniform float uFog;
uniform vec4 uPad; uniform vec3 uPadCol; uniform vec3 uG; uniform float uGloss; uniform vec3 uGlowCol; uniform vec4 uNear;
varying vec4 vTint; varying vec3 vScan; varying vec3 vNL; varying vec3 vDir;
vec3 tri(vec3 p, vec3 w){
  vec3 s = vec3(0.0);
  if (w.x > 0.0) s += texture2D(uDetail, p.yz).rgb * w.x;
  if (w.y > 0.0) s += texture2D(uDetail, p.zx).rgb * w.y;
  if (w.z > 0.0) s += texture2D(uDetail, p.xy).rgb * w.z;
  return s; }
// same lookup on a lattice turned 53.13 degrees: layered with tri() it hides the tile repeat
vec3 triR(vec3 p, vec3 w){
  vec3 s = vec3(0.0);
  if (w.x > 0.0) s += texture2D(uDetail, vec2(0.6 * p.y + 0.8 * p.z, -0.8 * p.y + 0.6 * p.z)).rgb * w.x;
  if (w.y > 0.0) s += texture2D(uDetail, vec2(0.6 * p.z + 0.8 * p.x, -0.8 * p.z + 0.6 * p.x)).rgb * w.y;
  if (w.z > 0.0) s += texture2D(uDetail, vec2(0.6 * p.x + 0.8 * p.y, -0.8 * p.x + 0.6 * p.y)).rgb * w.z;
  return s; }
// channels: r = grain, g = crack network (1 = intact, 0 = crack), b = pebbles / cobbles
float gh(vec3 t){ return dot(t - vec3(0.5, 1.0, 0.25), uG); }
#else
varying vec2 vUv;
#endif
void main(){
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vN);
  float dist = length(vWP);
  vec3 V = -vWP / max(dist, 1e-9);
#ifdef CHUNK
  vec3 dirP = normalize(vDir);
  vec3 S = normalize(vWP - uPlanetPos);
  float eu = atan(-dirP.z, dirP.x) * 0.15915494 + 0.5;
  float eu2 = fract(eu + 0.5) - 0.5;
  float ev = asin(clamp(dirP.y, -1.0, 1.0)) * 0.31830989 + 0.5;
  #ifdef GRAD_OK
    float dux = dFdx(eu), dux2 = dFdx(eu2); if (abs(dux2) < abs(dux)) dux = dux2;
    float duy = dFdy(eu), duy2 = dFdy(eu2); if (abs(duy2) < abs(duy)) duy = duy2;
    vec2 uv = vec2(eu, ev);
    vec2 gx = vec2(dux, dFdx(ev)), gy = vec2(duy, dFdy(ev));
    vec3 alb = mix(uColor, texture2DGradEXT(uMap, uv, gx, gy).rgb, uHasMap);
  #else
    vec2 uv = vec2(fwidth(eu) > 0.5 ? eu2 : eu, ev);
    vec3 alb = mix(uColor, texture2D(uMap, uv).rgb, uHasMap);
  #endif
  if (uPad.w > 0.0) { float pd = length(dirP - uPad.xyz) * uR; alb = mix(alb, uPadCol, 1.0 - smoothstep(uPad.w * 0.45, uPad.w, pd)); }
  float ocean = uOcean * smoothstep(0.02, 0.10, alb.b - max(alb.r, alb.g));
  float land = 1.0 - ocean;
  if (uNear.a > 0.0) { // close up, the ground takes its true material colour (clean ice is far brighter than the 2-km average the map records)
    float nk = uNear.a * (1.0 - smoothstep(3.0, 60.0, dist));
    alb = mix(alb, uNear.rgb * (0.5 + 0.9 * dot(alb, vec3(0.3, 0.6, 0.1))), nk);
  }
  alb *= vTint.rgb;
  vec3 w = abs(normalize(vNL)); w = w * w; w = w * w; w = max(w - 0.05, 0.0); w /= (w.x + w.y + w.z);
  float det = 0.0, embv = 0.0, glint = 0.0;
  #ifdef GRAD_OK
  if (dist > 1.5) { // regional mottling, so the ground still has texture from high altitude
    float fa = smoothstep(1.5, 6.0, dist) * (1.0 - smoothstep(400.0, 2500.0, dist));
    float da = texture2DGradEXT(uDetail, uv * vec2(2400.0, 1200.0), gx * vec2(2400.0, 1200.0), gy * vec2(2400.0, 1200.0)).r;
    float db = texture2DGradEXT(uDetail, uv * vec2(380.0, 190.0) + 0.37, gx * vec2(380.0, 190.0), gy * vec2(380.0, 190.0)).r;
    det += ((da - 0.5) * 0.32 + (db - 0.5) * 0.24) * fa * uG.x;
  }
  #endif
  if (dist < 4.0) { // close-range ground texture; farther fragments skip these lookups entirely
    vec3 dp = uInvRot * (vWP - uAnchor) * 1000.0;
    vec3 sP = uInvRot * uSunDir;
    float d3 = 0.5 * (gh(tri(dp / 128.0, w)) + gh(triR(dp / 204.8, w)));
    det += d3 * 0.2 * (1.0 - smoothstep(1.0, 4.0, dist));
    if (dist < 0.5) {
      float f2 = 1.0 - smoothstep(0.12, 0.5, dist);
      float t2 = gh(tri(dp / 16.0, w));
      det += 0.5 * (t2 + gh(triR(dp / 12.8, w))) * 0.22 * f2;
      embv += (gh(tri((dp + sP * 1.2) / 16.0, w)) - t2) * 1.5 * f2;
      if (dist < 0.06) {
        float f1 = 1.0 - smoothstep(0.012, 0.06, dist);
        vec3 c1 = tri(dp / 2.0, w); float t1 = gh(c1);
        det += 0.5 * (t1 + gh(triR(dp / 1.6, w))) * 0.28 * f1;
        embv += (gh(tri((dp + sP * 0.15) / 2.0, w)) - t1) * 1.9 * f1;
        glint = smoothstep(0.74, 0.92, c1.r) * f1;
      }
    }
  }
  alb *= 1.0 + land * clamp(det, -0.7, 0.9);
  float emb = 1.0 - land * clamp(embv, -0.4, 0.4) * (1.0 - uSoft);
#else
  vec3 S = N; vec2 uv = vUv;
  vec3 alb = mix(uColor, texture2D(uMap, uv).rgb, uHasMap);
  if (uLimb > 0.5) { // fine streaks so a gas giant's cloud deck keeps some structure up close
    float g1 = texture2D(uDetail, uv * vec2(90.0, 260.0)).r, g2 = texture2D(uDetail, uv * vec2(700.0, 2000.0) + 0.21).r;
    alb *= 0.88 + 0.16 * g1 + 0.08 * g2; }
  float ocean = uOcean * smoothstep(0.02, 0.10, alb.b - max(alb.r, alb.g));
  float emb = 1.0;
#endif
  float sdl = dot(S, uSunDir), ndl = dot(N, uSunDir);
  float hard = max(ndl, 0.0) * smoothstep(-0.03, 0.06, sdl);
  float soft = smoothstep(-0.15, 0.6, sdl) * (0.55 + 0.45 * clamp(ndl / max(sdl, 0.2), 0.0, 1.6));
  float diff = mix(hard, soft, uSoft) * emb;
  float shadow = 1.0;
  if (uRing.z > 0.0) {
    vec3 Pp = vWP - uPlanetPos; float dn = dot(uSunDir, uPole);
    float tt = -dot(Pp, uPole) / (abs(dn) < 1e-5 ? 1e-5 : dn);
    if (tt > 0.0) { float r = length(Pp + uSunDir * tt); float x = (r - uRing.x) / (uRing.y - uRing.x);
      if (x > 0.0 && x < 1.0) shadow = 1.0 - uRing.z * texture2D(uRingTex, vec2(x, 0.5)).a; }
  }
  vec3 col = alb * (uAmb + diff * uSunI * shadow * uLightCol) * 1.4;
  col *= mix(1.0, 0.3 + 0.85 * pow(max(dot(N, V), 0.0), 0.5), uLimb);
  vec3 Hh = normalize(uSunDir + V);
  col += vec3(1.0, 0.93, 0.8) * pow(max(dot(N, Hh), 0.0), 120.0) * ocean * smoothstep(0.0, 0.1, sdl) * 0.9;
  if (uHasNight > 0.0) { vec3 nl = max(texture2D(uNight, uv).rgb - vec3(0.13, 0.13, 0.2), 0.0); col += nl * vec3(1.0, 0.85, 0.6) * 1.4 * (1.0 - smoothstep(-0.15, 0.05, sdl)); }
  float rim = pow(1.0 - max(dot(S, V), 0.0), 3.0);
  col = mix(col, uAtmCol * smoothstep(-0.2, 0.35, sdl), clamp(rim * uRim, 0.0, 1.0));
#ifdef CHUNK
  if (uGloss > 0.0) { // ice: a soft sheen towards the Sun plus glints from individual crystals
    float nh = max(dot(N, Hh), 0.0);
    col += uLightCol * uSunI * shadow * smoothstep(0.0, 0.12, sdl) * uGloss * (pow(nh, 38.0) * 0.55 * emb + glint * pow(nh, 5.0) * 1.4);
  }
  col += uGlowCol * vTint.a;
  if (uLampI > 0.0) { vec3 Lv = uLampPos - vWP; float ld = length(Lv); col += alb * vec3(1.0, 0.96, 0.88) * max(dot(N, Lv / ld), 0.0) * uLampI / (1.0 + ld * ld / 0.0004); }
  col = mix(col, uFogCol, 1.0 - exp(-dist * uFog));
  if (uScan > 0.0) {
    float ds = length(vWP - uScanPos) * 1000.0;
    float inR = 1.0 - smoothstep(uScanR - 3.0, uScanR, ds);
    float fade = 1.0 - smoothstep(70.0, 110.0, ds);
    float ring = exp(-pow((ds - uScanR) / 1.5, 2.0));
    float lum = dot(col, vec3(0.3, 0.6, 0.1));
    vec3 sc = vScan * (0.32 + 0.75 * min(lum, 0.8));
    float gl = smoothstep(0.93, 1.0, abs(fract(ds / 10.0) - 0.5) * 2.0);
    col = mix(col, sc, 0.74 * uScan * inR * fade) + vec3(0.35, 0.9, 1.0) * (ring + gl * 0.12 * inR) * uScan * fade;
  }
#endif
  col = mix(col, 0.62 + 0.38 * (1.0 - exp(-(col - 0.62) / 0.38)), step(0.62, col)); // soft shoulder so bright ice and cloud do not clip
  gl_FragColor = vec4(col, 1.0);
}`;

  let WHITE = null, gradOK = false;
  function white() {
    if (!WHITE) { WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); WHITE.needsUpdate = true; }
    return WHITE;
  }
  function surfaceUniforms() {
    return {
      uMap: { value: white() }, uHasMap: { value: 0 }, uColor: { value: new THREE.Color(0.5, 0.5, 0.5) },
      uNight: { value: white() }, uHasNight: { value: 0 },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uSunI: { value: 1 }, uAmb: { value: 0.015 },
      uPole: { value: new THREE.Vector3(0, 1, 0) }, uInvRot: { value: new THREE.Matrix3() }, uPlanetPos: { value: new THREE.Vector3() }, uR: { value: 1 },
      uAtmCol: { value: new THREE.Color(0, 0, 0) }, uRim: { value: 0 }, uSoft: { value: 0 }, uLimb: { value: 0 }, uOcean: { value: 0 },
      uRingTex: { value: white() }, uRing: { value: new THREE.Vector3(0, 1, 0) }, uLightCol: { value: new THREE.Color(1, 1, 1) },
      uDetail: { value: white() }, uAnchor: { value: new THREE.Vector3() }, uLampPos: { value: new THREE.Vector3() }, uLampI: { value: 0 },
      uScan: { value: 0 }, uScanR: { value: 0 }, uScanPos: { value: new THREE.Vector3() },
      uFogCol: { value: new THREE.Color(0, 0, 0) }, uFog: { value: 0 },
      uPad: { value: new THREE.Vector4(0, 0, 0, 0) }, uPadCol: { value: new THREE.Color(0.4, 0.4, 0.3) },
      uG: { value: new THREE.Vector3(1, 0, 0.5) }, uGloss: { value: 0 }, uGlowCol: { value: new THREE.Color(1.0, 0.33, 0.06) }, uNear: { value: new THREE.Vector4(1, 1, 1, 0) }
    };
  }
  function surfaceMaterial(chunk) {
    const defs = {};
    if (chunk) { defs.CHUNK = 1; if (gradOK) defs.GRAD_OK = 1; }
    const m = new THREE.ShaderMaterial({ uniforms: surfaceUniforms(), vertexShader: SURF_VERT, fragmentShader: SURF_FRAG, defines: defs, side: THREE.FrontSide });
    m.extensions.derivatives = true;
    return m;
  }

  // =============================== atmosphere halo (seen from space)
  const BASIC_VERT = `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWP; varying vec3 vN; varying vec2 vUv; varying vec3 vP;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; vP = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
  function haloMaterial(col, R, Rs, flat) {
    return new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(col[0], col[1], col[2]) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uK: { value: 1 },
        uPlanetPos: { value: new THREE.Vector3() }, uPole: { value: new THREE.Vector3(0, 1, 0) }, uR: { value: R }, uRs: { value: Rs }, uFlatK: { value: 1 / (1 - flat) - 1 } },
      vertexShader: BASIC_VERT,
      fragmentShader: `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCol; uniform vec3 uSunDir; uniform float uK; uniform vec3 uPlanetPos; uniform vec3 uPole; uniform float uR; uniform float uRs; uniform float uFlatK;
varying vec3 vWP; varying vec3 vN;
void main(){
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vN); vec3 d = normalize(vWP);
  // brightness depends on how close the line of sight passes to the surface (works from outside and inside the shell)
  vec3 C = uPlanetPos + uPole * dot(uPlanetPos, uPole) * uFlatK;
  vec3 dd = normalize(d + uPole * dot(d, uPole) * uFlatK);
  float t = dot(C, dd);
  float b = t < 0.0 ? length(C) : sqrt(max(dot(C, C) - t * t, 0.0));
  float i = clamp((uRs - b) / (uRs - uR), 0.0, 1.0); i = i * i * (0.35 + 0.65 * i);
  float day = smoothstep(-0.35, 0.35, dot(N, uSunDir));
  gl_FragColor = vec4(uCol * i * day * uK, 1.0);
}`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
    });
  }

  // =============================== cloud / haze shell
  function cloudMaterial(solid, color) {
    return new THREE.ShaderMaterial({
      uniforms: { uMap: { value: white() }, uHasMap: { value: 0 }, uDetail: { value: white() }, uCol: { value: new THREE.Color(color) }, uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uOpacity: { value: 1 }, uSolid: { value: solid ? 1 : 0 }, uAmb: { value: 0.02 }, uSunI: { value: 1 } },
      vertexShader: BASIC_VERT,
      fragmentShader: `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap; uniform sampler2D uDetail; uniform float uHasMap; uniform vec3 uCol; uniform vec3 uSunDir;
uniform float uOpacity; uniform float uSolid; uniform float uAmb; uniform float uSunI;
varying vec3 vWP; varying vec3 vN; varying vec2 vUv;
void main(){
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vN); vec3 V = normalize(-vWP);
  vec4 t = texture2D(uMap, vUv);
  float sdl = dot(N, uSunDir);
  float l = smoothstep(-0.18, 0.6, sdl);
  vec3 c; float a;
  if (uSolid > 0.5) { c = mix(uCol, t.rgb, uHasMap); a = 1.0; c *= 0.35 + 0.8 * pow(abs(dot(N, V)), 0.45); }
  else { c = uCol; float n1 = texture2D(uDetail, vUv * vec2(56.0, 28.0)).r, n2 = texture2D(uDetail, vUv * vec2(340.0, 170.0) + 0.31).r;
    float m = t.r + ((n1 - 0.5) * 0.9 + (n2 - 0.5) * 0.5) * (1.0 - abs(t.r * 2.0 - 1.0)); a = smoothstep(0.1, 0.8, m) * 0.96; }
  gl_FragColor = vec4(c * (uAmb + l * uSunI), a * uOpacity);
}`,
      side: THREE.DoubleSide, transparent: true, depthWrite: false
    });
  }

  // =============================== rings
  function ringMaterial(tex, R) {
    return new THREE.ShaderMaterial({
      uniforms: { uTex: { value: tex }, uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uPlanetPos: { value: new THREE.Vector3() }, uPole: { value: new THREE.Vector3(0, 1, 0) }, uR: { value: R }, uSunI: { value: 1 } },
      vertexShader: BASIC_VERT,
      fragmentShader: `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uTex; uniform vec3 uSunDir; uniform vec3 uPlanetPos; uniform vec3 uPole; uniform float uR; uniform float uSunI;
varying vec3 vWP; varying vec2 vUv;
void main(){
  #include <logdepthbuf_fragment>
  vec4 t = texture2D(uTex, vec2(vUv.x, 0.5));
  vec3 Pp = vWP - uPlanetPos; vec3 V = normalize(-vWP);
  float along = dot(Pp, uSunDir); float perp = length(Pp - uSunDir * along);
  float sh = along < 0.0 ? smoothstep(uR * 0.985, uR * 1.01, perp) : 1.0;
  float ss = dot(uPole, uSunDir), sv = dot(uPole, V);
  float lit = ss * sv > 0.0 ? 1.0 : 0.16 + 0.75 * (1.0 - t.a) * t.a * 3.0;
  float elev = 0.8 + 0.2 * smoothstep(0.0, 0.45, abs(ss));
  float fwd = 1.0 + 0.5 * pow(max(dot(V, -uSunDir), 0.0), 8.0);
  gl_FragColor = vec4(t.rgb * lit * elev * fwd * (0.45 + 0.9 * uSunI) * (0.03 + 0.97 * sh), t.a);
}`,
      side: THREE.DoubleSide, transparent: true, depthWrite: false
    });
  }
  function ringGeometry(inner, outer) {
    const seg = 192, pos = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(c * inner, 0, s * inner, c * outer, 0, s * outer); uv.push(0, i / seg, 1, i / seg);
      if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(0).map(function (v, i) { return i % 3 === 1 ? 1 : 0; }), 3));
    g.setIndex(idx);
    return g;
  }
  function h1(n, s) { const x = Math.sin(n * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }
  function n1(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h1(i, s) * (1 - u) + h1(i + 1, s) * u; }
  function ringTexture(rg) {
    const W = 2048, c = document.createElement('canvas'); c.width = W; c.height = 4;
    const ctx = c.getContext('2d'), img = ctx.createImageData(W, 4), d = img.data;
    for (let i = 0; i < W; i++) {
      const r = rg.inner + (rg.outer - rg.inner) * (i + 0.5) / W;
      let a = 0, col = rg.color.slice();
      if (rg.saturn) {
        const fine = 0.78 + 0.22 * n1(r / 140, 1) + 0.12 * (n1(r / 37, 2) - 0.5), mid = 0.8 + 0.4 * (n1(r / 900, 3) - 0.5);
        if (r < 74510) { a = 0.012 + 0.012 * n1(r / 600, 4); col = [0.5, 0.47, 0.44]; }                       // D ring
        else if (r < 74658) a = 0;
        else if (r < 92000) { a = (0.07 + 0.11 * (r - 74658) / 17342) * (0.7 + 0.6 * n1(r / 500, 5)) * fine; col = [0.52, 0.47, 0.42]; } // C ring
        else if (r < 117580) { const x = (r - 92000) / 25580; a = (0.72 + 0.26 * Math.min(1, x * 1.6)) * (0.86 + 0.14 * mid) * fine; a = Math.min(0.99, a + 0.08); col = [0.86 - 0.05 * (1 - x), 0.78 - 0.06 * (1 - x), 0.63 - 0.07 * (1 - x)]; } // B ring
        else if (r < 122170) { a = (r < 117930 ? 0.0 : 0.07 + 0.07 * n1(r / 300, 6)) * fine; col = [0.5, 0.45, 0.4]; }   // Cassini Division (Huygens gap at its inner edge)
        else if (r < 136775) { a = 0.52 * (0.9 + 0.2 * mid) * fine; if (Math.abs(r - 133589) < 165) a = 0; if (Math.abs(r - 136505) < 22) a = 0; col = [0.80, 0.74, 0.63]; } // A ring with Encke and Keeler gaps
        else if (r < 139900) a = 0.006;                                                                          // Roche Division
        else if (Math.abs(r - 140180) < 60) { a = 0.28; col = [0.85, 0.82, 0.78]; }                              // F ring
      } else if (rg.bands) {
        for (let b = 0; b < rg.bands.length; b++) {
          const bd = rg.bands[b], px = (rg.outer - rg.inner) / W;
          const lo = bd[0] - px * 0.6, hi = Math.max(bd[1], bd[0] + px) + px * 0.6;
          if (r >= lo && r <= hi) a = Math.max(a, bd[2] * (0.8 + 0.2 * n1(r / 80, 7)));
        }
      }
      const k = 0.92 + 0.08 * n1(r / 220, 8);
      for (let y = 0; y < 4; y++) { const o = (y * W + i) * 4; d[o] = col[0] * 255 * k; d[o + 1] = col[1] * 255 * k; d[o + 2] = col[2] * 255 * k; d[o + 3] = Math.max(0, Math.min(1, a)) * 255; }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.ClampToEdgeWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.premultiplyAlpha = false;
    return t;
  }

  // =============================== Sun
  function sunMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uMap: { value: white() }, uHasMap: { value: 0 }, uTime: { value: 0 } },
      vertexShader: BASIC_VERT,
      fragmentShader: `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uMap; uniform float uHasMap; uniform float uTime;
varying vec3 vWP; varying vec3 vN; varying vec2 vUv; varying vec3 vP;
float hsh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vN); vec3 V = normalize(-vWP); float mu = max(dot(N, V), 0.0);
  vec3 p = normalize(vP);
  float big = fbm(p * 5.0 + vec3(0.0, uTime * 0.01, 0.0));
  float gran = fbm(p * 90.0 + vec3(uTime * 0.06));
  float lat = abs(p.y);
  float spots = smoothstep(0.73, 0.80, fbm(p * 9.0 + 4.0)) * smoothstep(0.55, 0.3, lat) * smoothstep(0.02, 0.12, lat);
  vec3 base = mix(vec3(1.0, 0.62, 0.2), vec3(1.0, 0.95, 0.78), clamp(big * 0.7 + gran * 0.75 - 0.15, 0.0, 1.0));
  if (uHasMap > 0.0) base = mix(base, texture2D(uMap, vUv).rgb * 1.5, 0.55);
  base *= 1.0 - 0.75 * spots;
  float limb = 0.4 + 0.6 * pow(mu, 0.55);
  vec3 col = base * limb * 1.3 * vec3(1.0, 0.75 + 0.25 * mu, 0.5 + 0.5 * mu);
  gl_FragColor = vec4(col, 1.0);
}`
    });
  }

  // =============================== sky dome (inside an atmosphere)
  function skyMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uUp: { value: new THREE.Vector3(0, 1, 0) }, uSun: { value: new THREE.Vector3(1, 0, 0) },
        uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunset: { value: new THREE.Color() }, uNightCol: { value: new THREE.Color() },
        uAlpha: { value: 0 }, uDay: { value: 1 }, uOver: { value: 0 }, uSunVis: { value: 1 }
      },
      vertexShader: `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
uniform vec3 uUp; uniform vec3 uSun; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uSunset; uniform vec3 uNightCol;
uniform float uAlpha; uniform float uDay; uniform float uOver; uniform float uSunVis;
varying vec3 vD;
void main(){
  vec3 d = normalize(vD);
  float h = dot(d, uUp), sd = max(dot(d, uSun), 0.0), se = dot(uSun, uUp);
  float t = pow(clamp(h, 0.0, 1.0), 0.45);
  vec3 sky = mix(uHor, uZen, t * (1.0 - 0.5 * uOver));
  float ssA = clamp(1.0 - abs(se) * 3.2, 0.0, 1.0) * (1.0 - uOver);
  sky = mix(sky, uSunset, ssA * pow(sd * 0.5 + 0.5, 3.0) * (1.0 - t) * 0.9);
  sky += (1.0 - uOver) * vec3(1.0, 0.9, 0.75) * (pow(sd, 400.0) * 0.7 + pow(sd, 24.0) * 0.16) * uSunVis;
  sky += uOver * uHor * pow(sd, 3.0) * 0.25;
  vec3 col = mix(uNightCol, sky, uDay);
  col = mix(col, col * 0.8, smoothstep(0.0, -0.2, h));
  gl_FragColor = vec4(col, uAlpha);
}`,
      side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false
    });
  }

  // =============================== stars & far-body dots
  function starMaterial(logDepth) {
    return new THREE.ShaderMaterial({
      uniforms: { uPx: { value: 1 }, uFade: { value: 1 } },
      vertexShader: (logDepth ? '#include <common>\n#include <logdepthbuf_pars_vertex>\n' : '') + `
attribute float size; attribute vec3 acol; varying vec3 vC; uniform float uPx;
void main(){ vC = acol; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); gl_PointSize = size * uPx;
` + (logDepth ? '#include <logdepthbuf_vertex>\n' : '') + '}',
      fragmentShader: (logDepth ? '#include <common>\n#include <logdepthbuf_pars_fragment>\n' : '') + `
varying vec3 vC; uniform float uFade;
void main(){
` + (logDepth ? '#include <logdepthbuf_fragment>\n' : '') + `
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d); a = a * a;
  gl_FragColor = vec4(vC * a * uFade, 1.0);
}`,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: !!logDepth
    });
  }
  function bvColor(bv) {
    // rough black-body tint from B-V colour index
    const t = Math.max(-0.4, Math.min(2.0, bv));
    let r, g, b;
    if (t < 0.0) { r = 0.62 + 0.38 * (t + 0.4) / 0.4; g = 0.72 + 0.28 * (t + 0.4) / 0.4; b = 1.0; }
    else if (t < 0.6) { r = 1.0; g = 1.0 - 0.08 * t / 0.6; b = 1.0 - 0.28 * t / 0.6; }
    else { const k = Math.min(1, (t - 0.6) / 1.2); r = 1.0; g = 0.92 - 0.37 * k; b = 0.72 - 0.5 * k; }
    return [r, g, b];
  }
  // equatorial RA/Dec (deg) -> world direction (ecliptic frame: x = equinox, y = ecliptic north)
  function eqDir(ra, dec, out) {
    const D = Math.PI / 180, E = 23.43928 * D;
    const xe = Math.cos(dec * D) * Math.cos(ra * D), ye = Math.cos(dec * D) * Math.sin(ra * D), ze = Math.sin(dec * D);
    const yc = ye * Math.cos(E) + ze * Math.sin(E), zc = -ye * Math.sin(E) + ze * Math.cos(E);
    return out.set(xe, zc, -yc);
  }
  function buildStars() {
    const cat = window.STAR_CATALOG, pos = [], col = [], size = [], v = new THREE.Vector3(), RAD = 1e6;
    let seed = 12345; const rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    if (cat && cat.length > 400) {
      for (let i = 0; i < cat.length; i += 4) {
        const mag = cat[i + 2]; eqDir(cat[i], cat[i + 1], v);
        const c = bvColor(cat[i + 3]);
        const lum = Math.min(1.6, Math.pow(10, -0.4 * (mag - 1.2)) * 0.9 + 0.16);
        pos.push(v.x * RAD, v.y * RAD, v.z * RAD); col.push(c[0] * lum, c[1] * lum, c[2] * lum);
        size.push(Math.max(1.6, Math.min(7.5, 5.6 - mag * 0.72)));
      }
    } else {
      for (let i = 0; i < 4500; i++) {
        const z = rnd() * 2 - 1, a = rnd() * 6.2832, s = Math.sqrt(1 - z * z);
        const mag = 6.2 - 7.5 * Math.pow(rnd(), 3.2), c = bvColor(rnd() * 1.6 - 0.2), lum = Math.min(1.6, Math.pow(10, -0.4 * (mag - 1.2)) * 0.9 + 0.16);
        pos.push(s * Math.cos(a) * RAD, z * RAD, s * Math.sin(a) * RAD); col.push(c[0] * lum, c[1] * lum, c[2] * lum); size.push(Math.max(1.6, Math.min(7.5, 5.6 - mag * 0.72)));
      }
    }
    // faint Milky Way band (statistical, not catalogued): galactic pole RA 192.859 Dec 27.128, centre RA 266.405 Dec -28.936
    const gp = eqDir(192.859, 27.128, new THREE.Vector3()), gc = eqDir(266.405, -28.936, new THREE.Vector3());
    const gy = new THREE.Vector3().crossVectors(gp, gc).normalize();
    const gauss = function () { return (rnd() + rnd() + rnd() + rnd() - 2) / 0.58; };
    for (let i = 0; i < 9000; i++) {
      let l = rnd() * 6.2832; if (rnd() < 0.45) l = gauss() * 0.75;
      const widen = 0.085 + 0.1 * Math.exp(-l * l * 0.8 * (l > 3.14 ? 0 : 1));
      const bl = gauss() * widen, cb = Math.cos(bl);
      v.set(0, 0, 0).addScaledVector(gc, cb * Math.cos(l)).addScaledVector(gy, cb * Math.sin(l)).addScaledVector(gp, Math.sin(bl));
      const lum = 0.10 + 0.16 * rnd() * rnd();
      pos.push(v.x * RAD, v.y * RAD, v.z * RAD); col.push(lum * 0.95, lum * 0.93, lum); size.push(1.3 + rnd() * 0.9);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('acol', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
    const pts = new THREE.Points(g, starMaterial(false));
    pts.frustumCulled = false;
    return pts;
  }

  // =============================== small procedural textures
  function detailTexture() {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
    const acc = new Float32Array(S * S);
    let seed = 777; const rnd = function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let amp = 1, tot = 0;
    for (let p = 16; p <= 256; p *= 2) {
      const lat = new Float32Array(p * p); for (let i = 0; i < lat.length; i++) lat[i] = rnd();
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const fx = x / S * p, fy = y / S * p, ix = Math.floor(fx), iy = Math.floor(fy);
        let ux = fx - ix, uy = fy - iy; ux = ux * ux * (3 - 2 * ux); uy = uy * uy * (3 - 2 * uy);
        const x1 = (ix + 1) % p, y1 = (iy + 1) % p;
        const a = lat[iy * p + ix], b = lat[iy * p + x1], cc = lat[y1 * p + ix], dd = lat[y1 * p + x1];
        acc[y * S + x] += amp * (a + (b - a) * ux + (cc - a) * uy + (a - b - cc + dd) * ux * uy);
      }
      tot += amp; amp *= 0.8;
    }
    // tileable cell patterns: crack network (g) and pebbles (b)
    function cellField(n, seedC) {
      let sd = seedC; const rn = function () { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
      const px = new Float32Array(n * n), py = new Float32Array(n * n), pr = new Float32Array(n * n);
      for (let i = 0; i < n * n; i++) { px[i] = rn(); py[i] = rn(); pr[i] = rn(); }
      const f1 = new Float32Array(S * S), f2 = new Float32Array(S * S), rad = new Float32Array(S * S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const fx = x / S * n, fy = y / S * n, ix = Math.floor(fx), iy = Math.floor(fy);
        let a = 9, b = 9, rr = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx, cy = iy + dy, k = ((cy + n) % n) * n + (cx + n) % n;
          const ex = cx + px[k] - fx, ey = cy + py[k] - fy, d = Math.sqrt(ex * ex + ey * ey);
          if (d < a) { b = a; a = d; rr = pr[k]; } else if (d < b) b = d;
        }
        f1[y * S + x] = a; f2[y * S + x] = b; rad[y * S + x] = rr;
      }
      return { f1: f1, f2: f2, r: rad };
    }
    const cA = cellField(7, 11), cB = cellField(19, 23), pA = cellField(9, 31), pB = cellField(26, 47);
    for (let i = 0; i < S * S; i++) {
      let v = acc[i] / tot; v = (v - 0.5) * 1.9 + 0.5; v = v < 0 ? 0 : v > 1 ? 1 : v;
      const e1 = cA.f2[i] - cA.f1[i], e2 = cB.f2[i] - cB.f1[i];
      let ck = Math.min(1, e1 / 0.07) * (0.55 + 0.45 * Math.min(1, e2 / 0.1)); ck = ck * ck * (3 - 2 * ck);
      const r1 = 0.2 + 0.28 * pA.r[i], r2 = 0.22 + 0.3 * pB.r[i];
      let pb = Math.max(0, 1 - pA.f1[i] / r1); pb = Math.sqrt(pb) * (pA.r[i] > 0.45 ? 1 : 0);
      let pb2 = Math.max(0, 1 - pB.f1[i] / r2); pb2 = Math.sqrt(pb2) * 0.6 * (pB.r[i] > 0.3 ? 1 : 0);
      const peb = Math.max(pb, pb2);
      d[i * 4] = v * 255; d[i * 4 + 1] = ck * 255; d[i * 4 + 2] = Math.min(1, peb) * 255; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  }
  function glowTexture(stops) {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d'), g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    return new THREE.CanvasTexture(c);
  }
  // fallback colour map when no image file is available for a body
  function procTexture(d) {
    const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'), img = ctx.createImageData(W, H), px = img.data;
    const base = new THREE.Color(d.color), seed = (d.terrain && d.terrain.seed) || d.name.length * 7;
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let x = 0; x < W; x++) {
        const lon = ((x + 0.5) / W - 0.5) * 2 * Math.PI;
        const dx = cl * Math.cos(lon), dy = sl, dz = -cl * Math.sin(lon);
        let r = base.r, g = base.g, b = base.b;
        if (d.gas) {
          const wv = noise3(dx * 3, dy * 9, dz * 3, seed) * 0.25 + noise3(dx * 9, dy * 30, dz * 9, seed + 1) * 0.08;
          const band = Math.sin((lat + wv * 0.35) * (d.id === 'jupiter' ? 22 : d.id === 'saturn' ? 16 : 6));
          const k = d.id === 'jupiter' ? 0.2 : d.id === 'saturn' ? 0.09 : 0.035;
          const m = 1 + band * k + noise3(dx * 20, dy * 60, dz * 20, seed + 2) * k * 0.5;
          r *= m * (1 + band * k * 0.4); g *= m; b *= m * (1 - band * k * 0.5);
        } else if (d.id === 'earth') {
          const l = 0.5 + noise3(dx * 1.9 + 3.1, dy * 1.9, dz * 1.9 + 7.7, 5) * 1.2 + noise3(dx * 5, dy * 5, dz * 5, 6) * 0.4;
          if (Math.abs(lat) > 1.25 + noise3(dx * 6, dy * 6, dz * 6, 9) * 0.1) { r = 0.92; g = 0.94; b = 0.97; }
          else if (l > 0.5) { const dry = 0.5 + noise3(dx * 4, dy * 4, dz * 4, 8); r = 0.2 + 0.35 * dry; g = 0.36 + 0.12 * dry; b = 0.14 + 0.1 * dry; }
          else { r = 0.03; g = 0.1; b = 0.28; }
        } else {
          let n = 0, a = 0.5, f = 2.2;
          for (let o = 0; o < 5; o++) { n += a * noise3(dx * f, dy * f, dz * f, seed + o); a *= 0.55; f *= 2.1; }
          const m = 1 + n * 0.7; r *= m; g *= m; b *= m;
        }
        const o = (y * W + x) * 4; px[o] = Math.min(255, r * 255); px[o + 1] = Math.min(255, g * 255); px[o + 2] = Math.min(255, b * 255); px[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  }
  // CPU-side sampler of an equirectangular image (used for rock colours and Earth's land/sea mask)
  function makeSampler(image, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d'); ctx.drawImage(image, 0, 0, W, H);
    let data; try { data = ctx.getImageData(0, 0, W, H).data; } catch (e) { return null; }
    return {
      W: W, H: H, data: data,
      color: function (x, y, z, out) {
        const u = Math.atan2(-z, x) / (2 * Math.PI) + 0.5, v = 0.5 - Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI;
        const px = Math.min(W - 1, Math.floor(u * W)), py = Math.min(H - 1, Math.floor(v * H)), o = (py * W + px) * 4;
        out[0] = data[o] / 255; out[1] = data[o + 1] / 255; out[2] = data[o + 2] / 255; return out;
      }
    };
  }
  function landMask(s) {
    const W = s.W, H = s.H, d = s.data, m = new Float32Array(W * H), o = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; m[i] = (b > r * 1.25 && b > g * 0.95) ? 0 : 1; }
    // 3x3 box blur, two passes, wrapping in longitude
    const t = new Float32Array(W * H);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) { const yy = Math.max(0, Math.min(H - 1, y + dy)); for (let dx = -1; dx <= 1; dx++) sum += m[yy * W + (x + dx + W) % W]; }
        t[y * W + x] = sum / 9;
      }
      m.set(t);
    }
    for (let i = 0; i < W * H; i++) o[i] = m[i] * 255;
    return function (x, y, z) {
      const u = (Math.atan2(-z, x) / (2 * Math.PI) + 0.5) * W - 0.5, v = (0.5 - Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI) * H - 0.5;
      const x0 = Math.floor(u), y0 = Math.max(0, Math.min(H - 2, Math.floor(v))), fx = u - x0, fy = Math.max(0, Math.min(1, v - y0));
      const xa = (x0 + W) % W, xb = (x0 + 1 + W) % W;
      const a = o[y0 * W + xa], b = o[y0 * W + xb], c = o[(y0 + 1) * W + xa], e = o[(y0 + 1) * W + xb];
      return (a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy) / 255;
    };
  }

  window.SOLGFX = {
    surfaceMaterial: surfaceMaterial, haloMaterial: haloMaterial, cloudMaterial: cloudMaterial, ringMaterial: ringMaterial, ringGeometry: ringGeometry,
    ringTexture: ringTexture, sunMaterial: sunMaterial, skyMaterial: skyMaterial, starMaterial: starMaterial, buildStars: buildStars, eqDir: eqDir,
    detailTexture: detailTexture, glowTexture: glowTexture, procTexture: procTexture, makeSampler: makeSampler, landMask: landMask,
    setGradOK: function (v) { gradOK = v; }, white: white
  };
})();
