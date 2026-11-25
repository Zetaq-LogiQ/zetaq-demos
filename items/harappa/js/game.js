/* Harappa Explorer — walking, time travel, discoveries, notebook, places, main loop. */
(function () {
  'use strict';
  const H = window.H; if (!H || H.failed) return;
  const THREE = window.THREE, P = H.P, CY = P.CY, input = H.input;
  const $ = function (id) { return document.getElementById(id); };
  const app = $('app'), canvas = $('gl');
  const sfx = function (n) { if (H.sfx) H.sfx(n); };
  let started = false;

  // ---------- icons
  const IC = {
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.500 2"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/>',
    sound: '<path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.4-1 .9-1 1.700M12 17v.01"/>',
    star: '<path d="M12 3l2.700 5.600 6.100.8-4.500 4.200 1.200 6-5.500-3-5.500 3 1.200-6L3.200 9.400l6.100-.8z"/>',
    run: '<path d="M13 4.500a1.500 1.500 0 1 0 0-.01M7 21l3-6 3 2v4M10 15l1-5 4 2 3-1M11 10l-4 1-1 3"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    mute: '<path d="M4 10v4h4l5 4V6L8 10H4zM17 9l5 6M22 9l-5 6"/>',
    way: '<circle cx="12" cy="12" r="9"/><path d="M15.500 8.500l-2 5-5 2 2-5z"/>'
  };
  const icon = function (n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + '</svg>'; };

  // ---------- the discoveries: one card each, in the words of the Class 6 book (CB-C6-SS-06). era: 'both', 'then' (living city) or 'now' (ruins)
  const FIRST = 285;
  function nearestHouse(x, z, test) { let best = null, bd = 1e9; P.houses.forEach(function (h) { if (test && !test(h)) return; const d = Math.hypot(h.cx - x, h.cz - z); if (d < bd) { bd = d; best = h; } }); return best; }
  const hCourt = nearestHouse(312, 22, function (h) { return h.two; }), hWell = nearestHouse(262, -28, function (h) { return h.well; }), hBath = nearestHouse(318, -46, function (h) { return h.bath; });
  const hBead = nearestHouse(338, -78), hSeal = nearestHouse(236, 34), hGirl = nearestHouse(350, 74), hKing = nearestHouse(224, -72);
  P.props.push({ m: 'beads_bangles_weights', x: hBead.cx + 0.8, z: hBead.cz + 0.6, y: 0.08, size: 1.0, by: 'w', ry: 0.4, era: 'past', sink: 0 });
  P.houses.forEach(function (h, i) { if (i % 23 === 5) P.props.push({ m: 'harappan_pottery', x: h.cx - 1.2, z: h.cz - 0.9, y: 0.08, size: 1.1, by: 'w', ry: i, era: 'past', sink: 0 }); });
  // the seal: a photo of a REAL Harappan unicorn seal (The Met, CC0) on a stone block, shown much bigger than life (no invented seal model)
  (function () {
    const g = new THREE.Group(), img = new Image(), side = new THREE.MeshStandardMaterial({ color: 0xb9b2a2, roughness: 0.95 });
    const tex = new THREE.Texture(img); tex.encoding = THREE.sRGBEncoding; tex.offset.set(0.075, 1 - 0.86); tex.repeat.set(0.36, 0.6);
    img.onload = function () { tex.needsUpdate = true; if (H.shadowsDirty) H.shadowsDirty(); }; img.src = 'photos/unicorn.jpg';
    const top = new THREE.MeshStandardMaterial({ map: tex, color: 0xb4b4b4, roughness: 0.9 });
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.8), [side, side, top, side, side, side]); block.position.y = 0.66; g.add(block);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.57, 1.0), new THREE.MeshStandardMaterial({ map: null, color: 0x5e4129, roughness: 1 })); stand.position.y = 0.285; g.add(stand);
    g.position.set(hSeal.cx + 0.6, 0.08, hSeal.cz - 0.5); g.rotation.y = Math.PI / 2; if (H.addProp) H.addProp(g, 'past');
    H.sealAt = [hSeal.cx + 0.6, hSeal.cz - 0.5];
  })();
  const SPOTS = [
    { id: 'upper', x: 121, z: 0, y: 0, era: 'both', title: 'The upper town',
      text: 'Most Harappan cities had two distinct parts. Up on this platform is the ‘upper town’, where the local elite probably lived. Down to the east is the ‘lower town’, where common people lived.' },
    { id: 'found', x: 72, z: 6, y: CY, era: 'now', title: 'Found a century ago',
      text: 'Harappa and Mohenjo-daro were the first two cities of this civilisation to be discovered; their identification goes back to 1924. Harappa was the first to be excavated, in 1920–21. That is why the people of this civilisation are called ‘Harappans’.' },
    { id: 'bath', x: 0, z: 9.2, y: CY, era: 'both', title: 'The Great Bath', photo: ['bath.jpg', 'The Great Bath at Mohenjo-daro today'],
      text: 'A small but elaborate tank, about 12 × 7 metres. Natural bitumen, a form of tar, was applied on top of carefully laid-out bricks to make it waterproof. A drain in one corner emptied the tank from time to time, so it could be refilled with fresh water.',
      more: 'What was it for? A bath for the royal family, or a tank used for religious rituals? Archaeologists still debate it. A public bath is ruled out, because most houses in this city had their own bathrooms.' },
    { id: 'bathwell', x: 12.2, z: -4.6, y: CY, era: 'both', title: 'The well beside the bath',
      text: 'The Great Bath was surrounded by small rooms. One of them contained a well.' },
    { id: 'hall', x: -43, z: -19.2, y: CY, era: 'both', title: 'A large building', recon: true,
      text: 'Some large buildings seem to have been used for collective purposes, for instance, warehouses where goods to be transported were stored. The purpose of this one is still a matter of debate.' },
    { id: 'street', x: FIRST, z: 22, y: 0, era: 'both', title: 'A wide street',
      text: 'The larger Harappan cities were built according to precise plans. They had wide streets, often oriented to the cardinal directions: this one runs north to south. You are in the ‘lower town’, where common people lived.' },
    { id: 'house', x: hCourt.cx + 1.5, z: hCourt.cz + 1.2, y: 0, era: 'both', title: 'A house', recon: true,
      text: 'Individual houses of various sizes lined the streets and smaller lanes. They were generally made of bricks. Interestingly, the quality of construction was the same for small and big houses.' },
    { id: 'bathroom', x: hBath.bath[0] - 1.2, z: hBath.bath[1], y: 0, era: 'both', title: 'A bathing area',
      text: 'The Harappans gave much importance to water management and cleanliness. They often had separate areas for bathing in their homes. These were connected to a larger network of drains.' },
    { id: 'drain', x: FIRST - 4.0, z: -34, y: 0, era: 'both', title: 'A drain', photo: ['drain.jpg', 'Drainage system at Lothal (Gujarat)'],
      text: 'The bathing areas of the houses were connected to a larger network of drains, which generally ran below the streets and took the waste water away.' },
    { id: 'well', x: hWell.well[0] + 1.3, z: hWell.well[1], y: 0, era: 'both', title: 'A brick well', photo: ['mwell.jpg', 'A brick well at Mohenjo-daro'],
      text: 'In Mohenjo-daro, people drew water from hundreds of wells made of bricks. About 700 of them have been counted.' },
    { id: 'grain', x: FIRST + 2.4, z: -14.6, y: 0, era: 'then', title: 'Grains and pulses',
      text: 'The Harappans grew cereals like barley, wheat, some millets, and sometimes rice, in addition to pulses and a variety of vegetables. The cities could survive only if enough produce from the villages reached them every day.' },
    { id: 'pots', x: 354, z: -139, y: 0, era: 'then', title: 'Clay pots', recon: true,
      text: 'What did Harappan cooking pots contain? Scientific examinations of clay pots found dairy products, and also remains of turmeric, ginger and banana. Clearly, their diet was quite diverse!' },
    { id: 'beads', x: hBead.cx, z: hBead.cz - 0.6, y: 0, era: 'then', title: 'The bead makers', photo: ['susabeads.jpg', 'Harappan carnelian beads, excavated at Susa (present-day Iran)'],
      text: 'The most favoured ornaments were beads of carnelian, a reddish semiprecious stone found mostly in Gujarat. Harappan craftspeople developed special techniques to drill them, so a string could pass through them.',
      more: 'They also worked conch shells into beautiful shell bangles. Shell is a hard material, so this needs sophisticated techniques.' },
    { id: 'seals', x: hSeal.cx - 0.6, z: hSeal.cz + 0.4, y: 0, era: 'then', title: 'The seals', photo: ['unicorn.jpg', 'A Harappan seal showing a unicorn, and its impression in clay'],
      text: 'Traders needed to identify their goods, and each other. That seems to be the chief purpose of thousands of small seals. They were generally made of steatite, a soft stone hardened by heating, and measure only a few centimetres (ours is shown much bigger).',
      more: 'A seal generally shows an animal with a few signs above it, part of a writing system. Nobody has understood it yet.' },
    { id: 'cart', x: FIRST - 0.6, z: 35, y: 0, era: 'then', title: 'Goods on the move', recon: true,
      text: 'The Harappans were engaged in active trade, within their own civilisation and with distant lands. They used land routes and rivers, and the sea for more distant destinations.' },
    { id: 'river', x: 460, z: 6, y: 0, era: 'both', title: 'The river',
      text: 'The Harappans created many settlements along the banks of rivers: for water, and for agriculture, since rivers enrich the soil around them. They also fished both in rivers and in the sea.',
      note: 'Where the river flowed 4,500 years ago is not certain; we show it to the east.' },
    { id: 'fields', x: 296, z: 147, y: 0, era: 'then', title: 'The fields',
      text: 'The Harappans were the first in Eurasia to grow cotton, which they used to weave into clothes. They grew wheat and barley too, and made farming tools, including the plough.' },
    { id: 'girl', x: hGirl.cx + 0.8, z: hGirl.cz, y: 0, era: 'both', title: 'The ‘Dancing Girl’', photo: ['dancer.jpg', 'The ‘Dancing Girl’, a bronze figurine from Mohenjo-daro'],
      text: 'A bronze figurine from Mohenjo-daro, only 10.8 cm high. Observe her bangles covering an entire arm, a practice still visible in parts of Gujarat and Rajasthan.',
      more: 'If tin is added to copper, the result is bronze, which is harder than copper. The Harappans used bronze to make tools, pots and pans, and some figurines.' },
    { id: 'king', x: hKing.cx + 0.8, z: hKing.cz, y: 0, era: 'both', title: 'The ‘Priest King’',
      text: 'Archaeologists found a statuette of a figure often called ‘Priest King’ in Mohenjo-daro, although it is not known whose figure this was.' },
    { id: 'end', x: 132, z: 58, y: 0, era: 'now', title: 'The end, or a new beginning?',
      text: 'Around 1900 BCE the cities were abandoned one by one, and people went back to a rural lifestyle. Two factors are agreed upon: a climatic change from 2200 BCE that brought less rain, and the Sarasvatī River drying up in its central basin.' }
  ];
  H.spots = SPOTS;
  const SPOT = {}; SPOTS.forEach(function (s) { SPOT[s.id] = s; });
  const avail = function (s) { return s.era === 'both' || (s.era === 'then') === (H.era > 0.5); };

  // ---------- missions = the sim's tasks (ZQSim rounds), in the order the book teaches them; the child may do them in any order
  const MISSIONS = [
    { id: 'wide_street', level: 1, spot: 'street', text: 'Walk down to the lower town. Find a wide street.' },
    { id: 'great_bath', level: 1, spot: 'bath', text: 'Find the Great Bath in the upper town.' },
    { id: 'bathing_area', level: 2, spot: 'bathroom', text: 'Find a bathing area inside a house.' },
    { id: 'drain', level: 2, spot: 'drain', text: 'Find a drain that takes the waste water away.' },
    { id: 'bead_makers', level: 3, spot: 'beads', text: 'Time travel to the living city. Find the bead makers.' },
    { id: 'seals', level: 3, spot: 'seals', text: 'In the living city, find the seals the traders used.' }
  ];
  const SIM = window.__S || null;   // the ONE adapter (index.html); data goes only through it
  const M = { cur: null, hints: 0, solved: {}, stars: {}, early: {}, ended: false };
  function act(a, t, v) { if (SIM && started && !M.ended) try { SIM.act(a, t, v); } catch (e) { console.warn(e); } }
  function mById(id) { for (let i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].id === id) return MISSIONS[i]; return null; }
  function mOfSpot(sid) { for (let i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].spot === sid) return MISSIONS[i]; return null; }
  function startMission(id) {
    if (M.ended || M.solved[id] || M.cur === id) return;
    M.cur = id; M.hints = 0; if (SIM) SIM.task(id);
    if (M.early[id]) { finishMission(id, 3); return; }   // already found while exploring: collect it now
    refreshProgress();
  }
  function finishMission(id, st) {
    if (SIM) SIM.done(st); M.solved[id] = true; M.stars[id] = st; M.cur = null; M.hints = 0;
    if (!nextMission()) { M.ended = true; if (SIM) SIM.end(); setTimeout(function () { H.say('★ All ' + MISSIONS.length + ' missions done! Keep exploring the city.', 6000); sfx('done'); }, 1200); }
    refreshProgress();
  }
  function nextMission() { return MISSIONS.filter(function (m) { return !M.solved[m.id]; })[0] || null; }   // the child starts it (card button or the list)
  function starsNow() { return M.hints === 0 ? 3 : M.hints === 1 ? 2 : 1; }
  function onFound(s) {   // a discovery card was opened: does it finish a mission?
    const m = mOfSpot(s.id); if (!m || M.solved[m.id] || M.ended) return null;
    if (M.cur === m.id) { const st = starsNow(); finishMission(m.id, st); return { m: m, stars: st }; }
    M.early[m.id] = true; return { m: m, early: true };
  }
  function endVisit() { if (!M.ended) { M.ended = true; M.cur = null; if (SIM) SIM.end(); } refreshProgress(); H.say('Visit ended. You can close this page.', 6000); if (H.audio && H.audio.quiet) H.audio.quiet(); }

  // ---------- progress of this visit (not saved: every visit is a fresh set of missions)
  const S = { seen: {}, trips: 0 };
  const save = function () {};
  const TOTAL = SPOTS.length;
  const seenCount = function () { return Object.keys(S.seen).length; };
  const RANKS = [[0, 'Visitor'], [4, 'Junior Explorer'], [9, 'Site Explorer'], [15, 'Archaeologist'], [TOTAL, 'Master Archaeologist']];
  function rank() { let r = RANKS[0][1]; const n = seenCount(); RANKS.forEach(function (q) { if (n >= q[0]) r = q[1]; }); return r; }

  // ---------- messages
  let toastTimer = 0;
  H.say = function (msg, ms) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500); };
  function overlayOpen() { return !$('places').hidden || !$('help').hidden || !$('notes').hidden || !$('start').hidden; }
  function closeOverlays() { let any = false; ['places', 'help', 'notes'].forEach(function (id) { if (!$(id).hidden) { $(id).hidden = true; any = true; } }); if (!$('card').hidden) { $('card').hidden = true; any = true; } if (any) canvas.focus(); return any; }
  function openOverlay(id) { closeOverlays(); input.keys = {}; resetStick(); $(id).hidden = false; }

  // ---------- player
  const pl = H.player = { x: 126, z: 0, y: 0, yaw: Math.PI / 2, pitch: 0.06, bob: 0, speed: 0, stepPh: 0 };
  const key = function (c) { return input.keys[c] ? 1 : 0; };
  const tmp = { x: 0, z: 0 };
  function walk(dt) {
    const fwd = key('KeyW') + key('ArrowUp') - key('KeyS') - key('ArrowDown') - input.sy, turn = key('ArrowLeft') + key('KeyA') - key('ArrowRight') - key('KeyD') - input.sx;
    pl.yaw += turn * 1.7 * dt - input.mdx * 0.0032;
    pl.pitch = Math.max(-1.2, Math.min(1.2, pl.pitch - input.mdy * 0.0032));
    input.mdx = 0; input.mdy = 0;
    const run = key('ShiftLeft') || key('ShiftRight') || input.run, mag = Math.min(1, Math.abs(fwd)), spd = (run ? 11 : 6) * mag * (fwd < 0 ? 0.6 : 1);
    if (travel) { pl.speed = 0; return; }
    const sx = -Math.sin(pl.yaw), sz = -Math.cos(pl.yaw), d = spd * dt * Math.sign(fwd || 1);
    // move in small steps so thin walls cannot be skipped
    const n = Math.max(1, Math.ceil(Math.abs(d) / 0.25));
    for (let i = 0; i < n; i++) { tmp.x = pl.x + sx * d / n; tmp.z = pl.z + sz * d / n; H.collide(tmp, pl.y, 0.36); pl.x = tmp.x; pl.z = tmp.z; }
    pl.x = Math.max(H.bounds.x0, Math.min(H.bounds.x1, pl.x)); pl.z = Math.max(H.bounds.z0, Math.min(H.bounds.z1, pl.z));
    if (H.era > 0.5 && pl.x > P.river.x0 - 2) pl.x = P.river.x0 - 2; // the river bank
    const gy = H.groundY(pl.x, pl.z);
    pl.y += (gy - pl.y) * Math.min(1, dt * (gy > pl.y ? 14 : 9));
    pl.speed = spd;
    if (mag > 0.05) { pl.stepPh += dt * (run ? 13 : 8.5); const st = Math.floor(pl.stepPh / Math.PI); if (st !== pl.lastStep) { pl.lastStep = st; sfx('step'); } }
    pl.bob += ((mag > 0.05 ? 1 : 0) - pl.bob) * Math.min(1, dt * 8);
  }
  let freeCam = null;
  function placeCamera() {
    const c = H.camera;
    if (freeCam) { c.position.set(freeCam[0], freeCam[1], freeCam[2]); c.rotation.order = 'YXZ'; c.rotation.set(freeCam[4], freeCam[3], 0); return; }
    c.position.set(pl.x, pl.y + 1.62 + Math.sin(pl.stepPh * 2) * 0.035 * pl.bob, pl.z);
    c.rotation.order = 'YXZ'; c.rotation.set(pl.pitch, pl.yaw, 0);
  }
  H.goto = function (x, z, yaw, pitch) { pl.x = x; pl.z = z; pl.y = H.groundY(x, z); if (yaw != null) pl.yaw = yaw; pl.pitch = pitch == null ? 0 : pitch; tmp.x = pl.x; tmp.z = pl.z; H.collide(tmp, pl.y, 0.36); pl.x = tmp.x; pl.z = tmp.z; };

  // ---------- time travel
  let travel = null;
  const YEAR_NOW = new Date().getFullYear();
  function yearText(t) { const y = Math.round(YEAR_NOW + (-2500 - YEAR_NOW) * t); return y > 0 ? y + ' CE' : (-y) + ' BCE'; }
  H.travel = function () {
    if (travel || !started) return;
    travel = { t: 0, T: 4.2, from: H.era < 0.5 ? 0 : 1 }; travel.to = 1 - travel.from; H.setTrail(null);
    sfx('travel'); $('year').hidden = false; $('card').hidden = true; S.trips++; save(); actSig = ''; act('travel', 'era', travel.to === 1);
  };
  function stepTravel(dt) {
    if (!travel) return;
    travel.t += dt; const u = Math.min(1, travel.t / travel.T), e = u * u * (3 - 2 * u), t = travel.from + (travel.to - travel.from) * e;
    H.applyEra(t);
    $('year-n').textContent = yearText(t);
    H.camera.fov = (H.W / H.Hh < 1 ? 82 : 68) + 16 * Math.sin(Math.PI * u); H.camera.updateProjectionMatrix();
    if (u >= 1) {
      H.applyEra(travel.to); travel = null; H.camera.fov = H.W / H.Hh < 1 ? 82 : 68; H.camera.updateProjectionMatrix();
      for (let i = 0; i < 4; i++) { tmp.x = pl.x; tmp.z = pl.z; H.collide(tmp, pl.y, 0.36); pl.x = tmp.x; pl.z = tmp.z; }
      H.shadowsDirty(); setTimeout(function () { $('year').hidden = true; }, 1400); actSig = ''; updateHUD();
      if (guide) { const sp = guide.spot; stopGuide(); if (avail(sp) || mOfSpot(sp.id)) setTimeout(function () { startGuide(sp); }, 1800); }
      H.say(H.era > 0.5 ? 'You are in the living city, about 2500 BCE. Look around!' : 'Back to today. These are the ruins that archaeologists uncovered.', 5000);
    }
  }

  // ---------- discoveries
  function eraKey() { return H.era > 0.5 ? 'then' : 'now'; }
  function nearestSpot() { let best = null, bd = 1e9; SPOTS.forEach(function (s) { if (!avail(s) || Math.abs(s.y - pl.y) > 3) return; const d = Math.hypot(s.x - pl.x, s.z - pl.z); if (d < bd) { bd = d; best = s; } }); return best ? { s: best, d: bd } : null; }
  function lookAt(s) {
    const isNew = !S.seen[s.id], past = H.era > 0.5;
    if (isNew) { const r0 = rank(); S.seen[s.id] = 1; sfx(seenCount() === TOTAL ? 'done' : 'find'); const r1 = rank(); if (r1 !== r0) setTimeout(function () { H.say('★ New rank: ' + r1 + '!', 5000); sfx('done'); }, 900); }
    else sfx('open');
    const mm = mOfSpot(s.id); act('look', s.id, !!(mm && M.cur === mm.id));
    const f = onFound(s);
    let head = '';
    if (f && f.stars) head = '<div class="found">Mission done! <span>' + '★'.repeat(f.stars) + '</span></div>';
    else if (f && f.early) head = '<div class="found">Found! This is mission ' + (MISSIONS.indexOf(f.m) + 1) + '. It will count when you get to it.</div>';
    const ph = s.photo ? '<figure class="ph"><img src="photos/' + s.photo[0] + '" alt=""><figcaption>' + s.photo[1] + '</figcaption></figure>' : '';
    const canT = s.era === 'both';
    $('card').innerHTML = head + '<div class="eyebrow">' + (past ? 'About 2500 BCE · the living city' : 'Today · the ruins') + (isNew ? ' · new discovery' : '') + '</div><h3>' + s.title + '</h3>' + ph + '<p>' + s.text + '</p>' + (s.more ? '<p>' + s.more + '</p>' : '') +
      (s.recon ? '<p class="note">' + (past ? 'The living city you see is our reconstruction from what archaeologists found.' : 'Only the brick walls survive.') + '</p>' : '') + (s.note ? '<p class="note">' + s.note + '</p>' : '') +
      '<div class="row"><button class="btn" id="card-x" type="button">Close</button>' + (f && f.stars && nextMission() ? '<button class="btn primary" id="card-next" type="button">Next mission</button>' : '') + (canT && !(f && f.stars && nextMission()) ? '<button class="btn primary" id="card-t" type="button">' + icon('clock') + (past ? 'Back to today' : 'Time travel') + '</button>' : '') + '</div>';
    $('card').hidden = false; $('card').scrollTop = 0;
    $('card-x').addEventListener('click', function () { $('card').hidden = true; canvas.focus(); });
    const cn = $('card-next'); if (cn) cn.addEventListener('click', function () { sfx('click'); $('card').hidden = true; const nm = nextMission(); if (nm) { act('select', nm.id, MISSIONS.indexOf(nm) + 1); startMission(nm.id); if (M.cur) H.say(mById(M.cur).text, 4500); } canvas.focus(); });
    const ct = $('card-t'); if (ct) ct.addEventListener('click', function () { $('card').hidden = true; H.travel(); });
    refreshProgress();
  }
  function refreshProgress() {
    const n = MISSIONS.filter(function (m) { return M.solved[m.id]; }).length, cm = M.cur && mById(M.cur);
    $('st-prog').innerHTML = cm ? '<b>Mission ' + (MISSIONS.indexOf(cm) + 1) + ' of ' + MISSIONS.length + '</b> · ' + n + ' done' : '<b>' + n + ' of ' + MISSIONS.length + ' missions done</b>';
    $('st-body').textContent = cm ? cm.text : n === MISSIONS.length ? 'All missions done! Keep exploring.' : M.ended ? 'Visit ended.' : 'Tap here to choose your next mission.';
  }

  // ---------- markers above the discoveries
  const marks = SPOTS.map(function (s) { const el = document.createElement('div'); el.className = 'mk'; el.hidden = true; el.innerHTML = '<span></span>'; $('markers').appendChild(el); return el; });
  const v3 = new THREE.Vector3();
  function updateMarkers() {
    const show = started && !overlayOpen() && !travel, goalSpot = M.cur ? mById(M.cur).spot : null;
    for (let i = 0; i < SPOTS.length; i++) {
      const s = SPOTS[i], el = marks[i]; let vis = false;
      if (show && avail(s)) {
        const d = Math.hypot(s.x - pl.x, s.z - pl.z);
        if (d < 90) {
          v3.set(s.x, s.y + 2.3, s.z).project(H.camera);
          if (v3.z < 1 && v3.z > -1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05) {
            el.style.transform = 'translate(' + ((v3.x * 0.5 + 0.5) * H.W).toFixed(1) + 'px,' + ((-v3.y * 0.5 + 0.5) * H.Hh).toFixed(1) + 'px)';
            const done = !!S.seen[s.id], goal = s.id === goalSpot, txt = (d < 28 || goal ? s.title : '') + (done ? ' ✓' : '');
            if (el.firstChild.textContent !== txt) el.firstChild.textContent = txt;
            el.classList.toggle('done', done); el.classList.toggle('goal', goal && !done); el.classList.toggle('near', d < 6); vis = true;
          }
        }
      }
      if (el.hidden === vis) el.hidden = !vis;
    }
  }

  // ---------- showing the way: a trail of dots on the ground leads to a discovery
  let guide = null;
  function unseenNearest() { let best = null, bd = 1e9; SPOTS.forEach(function (s) { if (!avail(s) || S.seen[s.id]) return; const d = Math.hypot(s.x - pl.x, s.z - pl.z); if (d < bd) { bd = d; best = s; } }); return best; }
  function startGuide(spot) {
    if (!spot) { H.say('You have found everything in this time. Try time travel!', 4500); return; }
    H.say('Finding the way to ' + spot.title + '…', 2500);
    setTimeout(function () {
      const p = H.findPath(pl.x, pl.z, spot.x, spot.z);
      if (!p) { guide = null; H.setTrail(null); H.say('I cannot find a way there from here. Try Places to jump closer.', 4500); refreshGuide(); return; }
      guide = { spot: spot, path: p, idx: 0, clock: 0 }; H.setTrail(p, 0, Math.hypot(spot.x - pl.x, spot.z - pl.z) > 14); sfx('open'); H.say('Follow the glowing dots to ' + spot.title + '.', 4000); refreshGuide(); actSig = '';
    }, 40);
  }
  function stopGuide() { guide = null; H.setTrail(null); refreshGuide(); actSig = ''; }
  function refreshGuide() {
    const el = $('guide'); if (!guide) { el.hidden = true; return; }
    const d = Math.hypot(guide.spot.x - pl.x, guide.spot.z - pl.z);
    el.hidden = false; el.innerHTML = icon('way') + '<span>' + guide.spot.title + ' · ' + Math.round(d) + ' m</span><b>✕</b>';
  }
  function stepGuide(dt) {
    if (!guide || travel) return;
    guide.clock += dt; if (guide.clock < 0.25) return; guide.clock = 0;
    const p = guide.path; let bi = guide.idx, bd = 1e9;
    for (let k = Math.max(0, guide.idx - 4); k < Math.min(p.length, guide.idx + 16); k++) { const d = Math.hypot(p[k][0] - pl.x, p[k][1] - pl.z); if (d < bd) { bd = d; bi = k; } }
    const ds = Math.hypot(guide.spot.x - pl.x, guide.spot.z - pl.z);
    guide.idx = bi; H.setTrail(p, Math.min(p.length - 1, bi + 1), ds > 14);
    if (ds < 4.5) { const sp = guide.spot; stopGuide(); H.say(avail(sp) ? 'You are here: ' + sp.title + '. Press Look closer!' : 'You are here. Now time travel to the living city!', 4500); sfx('find'); return; }
    if (bd > 7) { const sp = guide.spot; guide = null; startGuide(sp); return; } // wandered off: work out a new route
    refreshGuide();
  }
  $('guide').addEventListener('click', function () { sfx('click'); stopGuide(); });

  // ---------- maps: a small one in the corner and a big one in Places
  const MAP = { x0: -110, z0: -205, x1: 525, z1: 235, k: 2, base: {} };
  function baseMap() {
    const past = H.era > 0.5, key = past ? 'p' : 'r'; if (MAP.base[key]) return MAP.base[key];
    const c = document.createElement('canvas'), k = MAP.k; c.width = (MAP.x1 - MAP.x0) * k; c.height = (MAP.z1 - MAP.z0) * k;
    const g = c.getContext('2d'), X = function (x) { return (x - MAP.x0) * k; }, Z = function (z) { return (z - MAP.z0) * k; };
    g.fillStyle = past ? '#9fa868' : '#cfbb94'; g.fillRect(0, 0, c.width, c.height);
    if (past) { g.fillStyle = '#5b93a0'; g.fillRect(X(P.river.x0), 0, c.width, c.height); g.fillStyle = '#8a7a52'; P.fields.forEach(function (f) { g.fillRect(X(f.x0), Z(f.z0), (f.x1 - f.x0) * k, (f.z1 - f.z0) * k); }); }
    const C = P.citadel, T = P.town; g.fillStyle = past ? '#d9c39a' : '#c4ad84'; g.fillRect(X(C.x0), Z(C.z0), (C.x1 - C.x0) * k, (C.z1 - C.z0) * k);
    P.ramps.forEach(function (r) { g.fillRect(X(r.x0), Z(r.z0), (r.x1 - r.x0) * k, (r.z1 - r.z0) * k); });
    g.fillStyle = past ? '#e2cfa6' : '#d8c6a0'; g.fillRect(X(T.x0 - 10), Z(T.z0 - 10), (T.x1 - T.x0 + 20) * k, (T.z1 - T.z0 + 20) * k);
    g.fillStyle = past ? '#c9b48a' : '#cdb991'; P.houses.forEach(function (h) { g.fillRect(X(h.x0), Z(h.z0), (h.x1 - h.x0) * k, (h.z1 - h.z0) * k); });
    g.fillStyle = past ? '#e8d9b4' : '#dccaa4'; P.houses.forEach(function (h) { g.fillRect(X(h.c[0]), Z(h.c[1]), (h.c[2] - h.c[0]) * k, (h.c[3] - h.c[1]) * k); });
    const B = P.bath; g.fillStyle = past ? '#4f8f99' : '#a58e6c'; g.fillRect(X(B.x0), Z(B.z0), (B.x1 - B.x0) * k, (B.z1 - B.z0) * k);
    g.strokeStyle = past ? '#8a4a2e' : '#8d7458'; g.lineCap = 'butt';
    P.walls.forEach(function (w) { if (w.y0 > 6 || (w.rh === 0)) return; g.lineWidth = Math.max(1, w.t * k); g.beginPath(); g.moveTo(X(w.x1), Z(w.z1)); g.lineTo(X(w.x2), Z(w.z2)); g.stroke(); });
    if (!past) { g.fillStyle = '#a5805e'; g.beginPath(); g.arc(X(P.stupa.x), Z(P.stupa.z), P.stupa.r * k, 0, 6.3); g.fill(); }
    return (MAP.base[key] = c);
  }
  function drawSpots(g, toX, toZ, size) {
    SPOTS.forEach(function (s) { if (!avail(s)) return; const x = toX(s.x), y = toZ(s.z), done = S.seen[s.id]; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = done ? '#9be08a' : '#ffb648'; g.strokeStyle = '#2a1802'; g.lineWidth = 1.5; g.fillRect(-size / 2, -size / 2, size, size); g.strokeRect(-size / 2, -size / 2, size, size); g.restore(); });
  }
  function drawMe(g, x, y, s) { g.save(); g.translate(x, y); g.rotate(-pl.yaw); g.fillStyle = '#fff'; g.strokeStyle = '#14100c'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.7, s * 0.8); g.lineTo(0, s * 0.35); g.lineTo(-s * 0.7, s * 0.8); g.closePath(); g.fill(); g.stroke(); g.restore(); }
  function drawPath(g, toX, toZ, wdt) { if (!guide) return; const p = guide.path; g.strokeStyle = '#ffb648'; g.lineWidth = wdt; g.lineJoin = 'round'; g.setLineDash([wdt * 1.5, wdt * 1.5]); g.beginPath(); for (let i = guide.idx; i < p.length; i++) { const x = toX(p[i][0]), y = toZ(p[i][1]); if (i === guide.idx) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); g.setLineDash([]); }
  const mini = $('mini'), mctx = mini.getContext('2d');
  function drawMini() {
    const size = mini.clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1); if (!size) return;
    if (mini.width !== Math.round(size * dpr)) { mini.width = mini.height = Math.round(size * dpr); }
    const g = mctx, R = 62, sc = size / (2 * R), base = baseMap(), k = MAP.k; // R metres from the centre to the edge
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size, size);
    g.save(); g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, 6.3); g.clip();
    g.fillStyle = H.era > 0.5 ? '#9fa868' : '#cfbb94'; g.fillRect(0, 0, size, size);
    g.drawImage(base, (pl.x - R - MAP.x0) * k, (pl.z - R - MAP.z0) * k, 2 * R * k, 2 * R * k, 0, 0, size, size);
    const toX = function (x) { return (x - pl.x + R) * sc; }, toZ = function (z) { return (z - pl.z + R) * sc; };
    drawPath(g, toX, toZ, 3); drawSpots(g, toX, toZ, 8); drawMe(g, size / 2, size / 2, 8);
    g.restore();
    g.strokeStyle = 'rgba(240,214,170,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, 6.3); g.stroke();
    g.fillStyle = '#f8efdf'; g.font = '800 11px Nunito, sans-serif'; g.textAlign = 'center'; g.fillText('N', size / 2, 13);
  }
  // the big map (inside Places): tap a diamond to be shown the way there
  const big = $('bigmap'), bctx = big.getContext('2d'); let bigT = null;
  function drawBig() {
    const w = big.clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1); if (!w) return;
    const h = Math.round(w * (MAP.z1 - MAP.z0) / (MAP.x1 - MAP.x0)); big.style.height = h + 'px';
    if (big.width !== Math.round(w * dpr) || big.height !== Math.round(h * dpr)) { big.width = Math.round(w * dpr); big.height = Math.round(h * dpr); }
    const g = bctx, sc = w / (MAP.x1 - MAP.x0); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(baseMap(), 0, 0, w, h);
    const toX = function (x) { return (x - MAP.x0) * sc; }, toZ = function (z) { return (z - MAP.z0) * sc; };
    bigT = { toX: toX, toZ: toZ };
    drawPath(g, toX, toZ, 3); drawSpots(g, toX, toZ, 11); drawMe(g, toX(pl.x), toZ(pl.z), 10);
    g.fillStyle = '#14100c'; g.font = '800 12px Nunito, sans-serif'; g.textAlign = 'left';
    [['Upper town', -80, -92], ['Lower town', 165, -140], ['Main street', FIRST + 6, 132]].forEach(function (q) { g.fillText(q[0], toX(q[1]), toZ(q[2])); });
  }
  big.addEventListener('click', function (e) {
    if (!bigT) return; const r = big.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 26; SPOTS.forEach(function (s) { if (!avail(s)) return; const d = Math.hypot(bigT.toX(s.x) - x, bigT.toZ(s.z) - y); if (d < bd) { bd = d; best = s; } });
    if (best) { closeOverlays(); startGuide(best); }
  });
  mini.addEventListener('click', function () { sfx('click'); openOverlay('places'); drawBig(); });

  // ---------- big buttons
  const ACT = {
    travel: { label: 'Time travel', icon: 'clock', key: 'T', fn: function () { H.travel(); } },
    look: { label: 'Look closer', icon: 'eye', key: 'E', fn: function () { const n = nearestSpot(); if (n && n.d < 6) lookAt(n.s); } },
    way: { label: 'Show the way', icon: 'way', key: 'G', fn: function () {
      if (guide) { stopGuide(); return; }
      const cm = M.cur && mById(M.cur);
      if (cm) { M.hints++; if (SIM) SIM.hint(); act('hint', cm.id, M.hints); startGuide(SPOT[cm.spot]); }
      else { act('guide', 'nearest', true); startGuide(unseenNearest()); }
    } },
    run: { label: 'Run', icon: 'run', hold: 'run' }
  };
  let actSig = '';
  function updateActions() {
    const touch = app.classList.contains('touch'), n = nearestSpot(), near = n && n.d < 6 && !travel, top = [], hold = [];
    let primary = 'travel';
    if (near) { top.push('look'); if (!S.seen[n.s.id]) primary = 'look'; }
    if (!travel) { top.push('way'); top.push('travel'); }
    if (touch) hold.push('run');
    const tl = H.era > 0.5 ? 'Back to today' : 'Time travel';
    const sig = top.join(',') + '|' + primary + '|' + tl + '|' + touch + '|' + (near ? n.s.id : '') + '|' + (guide ? 1 : 0);
    if (sig === actSig) return; actSig = sig;
    const btn = function (id) { const a = ACT[id], lab = id === 'travel' ? tl : id === 'way' && guide ? 'Stop guiding' : a.label; if (a.hold) return '<button type="button" class="act round" data-hold="' + a.hold + '">' + icon(a.icon) + lab + '</button>'; return '<button type="button" class="act' + (id === primary ? ' primary' : '') + '" data-act="' + id + '">' + icon(a.icon) + lab + (a.key && !touch ? '<kbd>' + a.key + '</kbd>' : '') + '</button>'; };
    const ordered = top.filter(function (i) { return i !== primary; }); if (top.indexOf(primary) >= 0) ordered.push(primary);
    $('actions').innerHTML = '<div class="rowa">' + ordered.map(btn).join('') + '</div>' + (hold.length ? '<div class="rowa">' + hold.map(btn).join('') + '</div>' : '');
  }
  $('actions').addEventListener('click', function (e) { const t = e.target.closest('[data-act]'); if (!t) return; sfx('click'); ACT[t.getAttribute('data-act')].fn(); t.blur(); canvas.focus(); });
  function holdEvt(e, on) { const t = e.target.closest && e.target.closest('[data-hold]'); if (!t) return; e.preventDefault(); input[t.getAttribute('data-hold')] = on ? 1 : 0; t.classList.toggle('held', on); if (on && t.setPointerCapture) try { t.setPointerCapture(e.pointerId); } catch (err) {} }
  $('actions').addEventListener('pointerdown', function (e) { holdEvt(e, true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { $('actions').addEventListener(n, function (e) { holdEvt(e, false); }); });
  $('actions').addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- where am I
  const AREAS = [
    [function (x, z) { return Math.abs(x) < 17 && Math.abs(z) < 28; }, 'The Great Bath'], [function (x, z) { return x > -70 && x < -17 && z > -19 && z < 16.5; }, 'A large building'],
    [function (x, z) { const C = P.citadel; return x > C.x0 && x < C.x1 && z > C.z0 && z < C.z1; }, 'The upper town'],
    [function (x, z) { return Math.abs(x - FIRST) < 5 && Math.abs(z) < 135; }, 'The main street'], [function (x, z) { const T = P.town; return x > T.x0 - 6 && x < T.x1 + 6 && z > T.z0 - 6 && z < T.z1 + 6; }, 'The lower town'],
    [function (x, z) { return x > 440; }, 'By the river'], [function (x, z) { return z > 140 && x > 170 && x < 410; }, 'The fields'], [function (x, z) { return z < -128 && x > 335 && x < 375; }, 'The potters’ yard']
  ];
  let areaName = '';
  function updateHUD() {
    let name = 'Outside the city', ai = 0;
    for (let i = 0; i < AREAS.length; i++) if (AREAS[i][0](pl.x, pl.z)) { name = AREAS[i][1]; ai = i + 1; break; }
    const past = H.era > 0.5;
    const sub = name + ' · ' + (travel ? 'travelling through time…' : past ? 'about 2500 BCE' : 'today (ruins)');
    if ($('st-sub').textContent !== sub) $('st-sub').textContent = sub;
    if (name !== areaName) { areaName = name; act('enter', 'area', ai); }
    updateActions();
  }

  // ---------- places (jump to a landmark)
  const PLACES = [
    ['The Great Bath', 'Upper town', 0, 12.2, 0, -0.2], ['A large building', 'Upper town', -43, -23.5, Math.PI, -0.05],
    ['The foot of the upper town', 'Between the two towns', 126, 0, Math.PI / 2, 0.06],
    ['The main street', 'Lower town', FIRST, 27, 0, 0], ['A house', 'Lower town', hCourt.ex, hCourt.ez + (hCourt.side === 'n' ? -1.6 : 1.6), hCourt.side === 'n' ? Math.PI : 0, 0],
    ['The potters’ yard', 'North edge of town', 354, -134, 0, -0.05], ['The fields', 'South of town', 296, 143, Math.PI, 0], ['The river bank', 'East of town', 456, 6, -Math.PI / 2, 0]
  ];
  $('places-body').innerHTML = PLACES.map(function (p, i) { return '<button type="button" class="pl" data-i="' + i + '"><b>' + p[0] + '</b><span>' + p[1] + '</span></button>'; }).join('');
  $('places-body').addEventListener('click', function (e) { const t = e.target.closest('.pl'); if (!t) return; const i = +t.getAttribute('data-i'), p = PLACES[i]; act('jump', 'place', i + 1); closeOverlays(); sfx('open'); fade(function () { H.goto(p[2], p[3], p[4], p[5]); }); });
  function fade(fn) { const f = $('fade'); f.style.opacity = 1; setTimeout(function () { fn(); f.style.opacity = 0; }, 230); }

  // ---------- notebook: the missions first, then every discovery
  function fillNotes() {
    $('notes-title').textContent = 'Missions';
    let h = '<p class="note">Walk there and press Look closer. Do them in any order: tap one to choose it.</p><div class="ml">';
    MISSIONS.forEach(function (m, i) {
      const done = M.solved[m.id], cur = M.cur === m.id;
      h += '<button type="button" class="mi' + (done ? ' done' : '') + (cur ? ' cur' : '') + '" data-m="' + m.id + '"><i>' + (done ? '✓' : i + 1) + '</i><span>' + m.text + '</span>' + (done ? '<b>' + '★'.repeat(M.stars[m.id]) + '</b>' : cur ? '<b class="now">now</b>' : '') + '</button>';
    });
    h += '</div><div class="xp" style="margin-top:16px"><i><u style="width:' + Math.round(seenCount() / TOTAL * 100) + '%"></u></i><span>' + rank() + ' · ' + seenCount() + ' of ' + TOTAL + ' discoveries</span></div><div class="dl">';
    SPOTS.forEach(function (s) {
      const a = S.seen[s.id];
      h += '<div class="d' + (a ? ' got' : '') + '"><h4>' + (a ? s.title : '? ? ?') + '</h4><p>' + (a ? s.text : s.era === 'then' ? 'Not found yet. Look in the living city.' : s.era === 'now' ? 'Not found yet. Look among the ruins of today.' : 'Not found yet.') + '</p></div>';
    });
    h += '</div><div class="row" style="margin-top:14px"><button class="btn" id="notes-help" type="button">' + icon('help') + 'How to play</button><button class="btn" id="notes-end" type="button">End visit</button></div>';
    $('notes-body').innerHTML = h;
    $('notes-body').querySelectorAll('.mi').forEach(function (b) { b.addEventListener('click', function () {
      const id = b.getAttribute('data-m'); sfx('click');
      if (M.solved[id]) { H.say('Already done!', 2500); return; } if (M.ended) { H.say('The visit has ended.', 2500); return; }
      if (M.cur !== id) { act('select', id, MISSIONS.indexOf(mById(id)) + 1); startMission(id); }
      closeOverlays(); stopGuide(); if (M.cur) H.say(mById(M.cur).text, 4500);
    }); });
    $('notes-help').addEventListener('click', function () { sfx('click'); openOverlay('help'); });
    let armed = false; $('notes-end').addEventListener('click', function (e) { sfx('click'); if (!armed) { armed = true; e.currentTarget.textContent = 'Tap again to end'; return; } closeOverlays(); endVisit(); });
  }

  // ---------- input
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(c) >= 0) e.preventDefault();
    if (!started) { if ((c === 'Enter' || c === 'Space') && !$('start-btn').disabled) begin(); return; }
    if (c === 'Escape') { closeOverlays(); return; }
    if (e.repeat) return;
    if (c === 'KeyM') { if ($('places').hidden) { openOverlay('places'); drawBig(); } else closeOverlays(); return; }
    if (c === 'KeyB' || c === 'KeyN') { if ($('notes').hidden) { openOverlay('notes'); fillNotes(); } else closeOverlays(); return; }
    if (c === 'KeyH') return $('help').hidden ? openOverlay('help') : closeOverlays();
    if (overlayOpen()) return;
    input.keys[c] = true;
    if (c === 'KeyT') H.travel();
    else if (c === 'KeyG') ACT.way.fn();
    else if (c === 'KeyE' || c === 'Enter') { if (!$('card').hidden) $('card').hidden = true; else ACT.look.fn(); }
  });
  window.addEventListener('keyup', function (e) { input.keys[e.code] = false; });
  window.addEventListener('blur', function () { input.keys = {}; input.run = 0; resetStick(); });
  function markTouch() { if (!app.classList.contains('touch')) { app.classList.add('touch'); actSig = ''; } }
  if (H.mobile || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) markTouch();
  let lookId = null, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') markTouch(); if (!started || lookId !== null) return; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; canvas.focus(); try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
  canvas.addEventListener('pointermove', function (e) { if (e.pointerId !== lookId) return; const k = e.pointerType === 'touch' ? 1.5 : 1; input.mdx += (e.clientX - lx) * k; input.mdy += (e.clientY - ly) * k; lx = e.clientX; ly = e.clientY; });
  ['pointerup', 'pointercancel'].forEach(function (n) { canvas.addEventListener(n, function (e) { if (e.pointerId === lookId) lookId = null; }); });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  const stick = $('stick'), knob = stick.querySelector('i'); let stickId = null;
  function resetStick() { stickId = null; input.sx = 0; input.sy = 0; knob.style.transform = ''; }
  function stickMove(e) { const r = stick.getBoundingClientRect(), R = r.width / 2; let dx = (e.clientX - (r.left + R)) / (R * 0.72), dy = (e.clientY - (r.top + R)) / (R * 0.72); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } const dz = function (v) { return Math.abs(v) < 0.14 ? 0 : v; }; input.sx = dz(dx); input.sy = dz(dy); knob.style.transform = 'translate(' + (dx * R * 0.6).toFixed(1) + 'px,' + (dy * R * 0.6).toFixed(1) + 'px)'; }
  stick.addEventListener('pointerdown', function (e) { e.preventDefault(); markTouch(); stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (err) {} stickMove(e); });
  stick.addEventListener('pointermove', function (e) { if (e.pointerId === stickId) stickMove(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { stick.addEventListener(n, function (e) { if (e.pointerId === stickId) resetStick(); }); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  function click(id, fn) { $(id).addEventListener('click', function (e) { sfx('click'); fn(e); if (e.currentTarget.blur) e.currentTarget.blur(); if (!overlayOpen()) canvas.focus(); }); }
  function soundOn() { return !!(H.audio && (H.audio.music || H.audio.sfx)); }
  function fillSound() { $('b-sound').innerHTML = icon(soundOn() ? 'sound' : 'mute') + '<span>' + (soundOn() ? 'Sound' : 'Muted') + '</span>'; $('b-sound').setAttribute('aria-label', soundOn() ? 'Mute' : 'Sound on'); }
  $('b-places').innerHTML = icon('map') + '<span>Places</span>'; $('b-notes').innerHTML = icon('book') + '<span>Missions</span>'; fillSound();
  click('b-places', function () { if ($('places').hidden) { openOverlay('places'); drawBig(); act('open', 'places', true); } else closeOverlays(); });
  click('b-notes', function () { if ($('notes').hidden) { openOverlay('notes'); fillNotes(); act('open', 'missions', true); } else closeOverlays(); });
  $('loc').addEventListener('click', function () { if (!started) return; sfx('click'); openOverlay('notes'); fillNotes(); act('open', 'missions', true); });
  click('places-close', closeOverlays); click('notes-close', closeOverlays); click('help-close', closeOverlays);
  click('b-sound', function () { if (H.audio) { H.audio.start(); const on = !soundOn(); H.audio.setMusic(on); H.audio.setSfx(on); act('sound', 'mute', !on); } fillSound(); });
  click('start-btn', begin);

  // ---------- start
  $('s1').insertAdjacentHTML('afterbegin', icon('eye')); $('s2').insertAdjacentHTML('afterbegin', icon('clock')); $('s3').insertAdjacentHTML('afterbegin', icon('star'));
  H.loadProps();
  const bootT = performance.now();
  (function check() {
    if ((H.frames > 6 && H.loading === 0) || performance.now() - bootT > 25000) { const b = $('start-btn'); b.disabled = false; b.innerHTML = icon('play') + 'Start exploring'; $('load').hidden = true; if (location.hash.indexOf('play') >= 0) begin(); return; }
    setTimeout(check, 200);
  })();
  $('start-note').textContent = app.classList.contains('touch') ? 'Left stick to walk, drag the screen to look around, big buttons on the right.' : 'Arrow keys or W A S D to walk, drag with the mouse to look, T to time travel.';
  function begin() {
    if (started) return; started = true; $('start').hidden = true; $('hud').hidden = false; canvas.focus();
    if (H.audio) H.audio.start(); fillSound(); updateHUD();
    startMission(MISSIONS[0].id); refreshProgress();
    H.say('These are the ruins of Mohenjo-daro today. Your mission is at the top. Need help? Tap Show the way!', 9000);
  }
  H.begin = begin;
  H.debug = { view: function (x, y, z, yaw, pitch) { freeCam = x == null ? null : [x, y, z, yaw || 0, pitch || 0]; }, fps: function () { const f0 = H.frames, t0 = performance.now(); return new Promise(function (r) { setTimeout(function () { r(Math.round((H.frames - f0) / ((performance.now() - t0) / 1000))); }, 2000); }); }, era: function (t) { H.applyEra(t); H.shadowsDirty(); actSig = ''; }, save: function () { return S; } };
  // test hooks (the gate's play script): read-only state + a teleport next to a discovery
  window.__sim = {
    ready: function () { return !$('start-btn').disabled; },
    state: function () { return Object.assign({ cur: M.cur, hints: M.hints, ended: M.ended, era: H.era, seen: Object.keys(S.seen) }, SIM ? SIM.state() : {}); },
    spot: function (id) { const s = SPOT[id]; return s && { x: s.x, z: s.z, y: s.y, era: s.era }; },
    near: function (id) { const s = SPOT[id]; H.goto(s.x + 1.5, s.z, Math.PI / 2, -0.2); actSig = ''; updateHUD(); const n = nearestSpot(); return !!(n && n.s.id === id && n.d < 6); },
    busy: function () { return !!travel; },
    missions: MISSIONS.map(function (m) { return m.id; })
  };

  // ---------- main loop
  let last = performance.now(), slow = 0, err = false, avg = 1 / 60, prClock = 0, upOK = 0, prLock = 0, lastUp = -1e9;
  H.frames = 0;
  function frame(now) {
    requestAnimationFrame(frame); if (err) return;
    let dt = (now - last) / 1000; last = now; if (!(dt > 0)) dt = 0.001; if (dt > 0.1) dt = 0.1;
    try {
      if (started && !overlayOpen()) walk(dt); else { input.mdx = 0; input.mdy = 0; }
      stepTravel(dt); stepGuide(dt); placeCamera();
      H.render(now / 1000, dt);
      updateMarkers();
      slow += dt; if (slow > 0.15 && started) { slow = 0; updateHUD(); if (!overlayOpen()) drawMini(); }
      avg += (dt - avg) * 0.08; prClock += dt;
      if (prClock > 0.6 && document.visibilityState !== 'hidden' && !travel) {
        prClock = 0;
        if (avg > 1 / 43) { H.setPixelRatio(H.pr * (avg > 1 / 26 ? 0.75 : 0.88)); upOK = 0; prLock = now + (now - lastUp < 20000 ? 120000 : 30000); }
        else if (avg < 1 / 57 && H.pr < H.maxPR && now > prLock) { if (++upOK >= 10) { upOK = 0; lastUp = now; H.setPixelRatio(H.pr * 1.1); } } else upOK = 0;
      }
      H.frames++;
    } catch (e) { err = true; H.error = String(e && e.stack || e); console.error(e); const f = $('fail'); f.hidden = false; f.textContent = 'Oops, the game hit an error and stopped: ' + (e && e.message || e); }
  }
  requestAnimationFrame(frame);
})();
