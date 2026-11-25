/* Solar System Explorer — controls, big action buttons, world picker, scanners, missions and logbook, main loop. */
(function () {
  'use strict';
  const SIM = window.SIM; if (!SIM || SIM.failed) return;
  const THREE = window.THREE, V3 = THREE.Vector3;
  const $ = function (id) { return document.getElementById(id); };
  const ship = SIM.ship, player = SIM.player, input = SIM.input, sun = SIM.sun, AU = SIM.AU;
  const canvas = $('gl'), app = $('app');
  const D2R = Math.PI / 180;
  let started = false, lastT = performance.now(), justLanded = false;
  SIM.target = null; SIM.scanned = {};

  // ---------- icons
  const IC = {
    rocket: '<path d="M12 2c3 2.500 4.500 6 4.500 9.500V16h-9v-4.500C7.500 8 9 4.500 12 2z"/><path d="M7.500 13 4 16.500V19l3.500-1M16.500 13 20 16.500V19l-3.500-1M10 20c.5 1 1.200 1.700 2 2 .8-.3 1.500-1 2-2"/><circle cx="12" cy="9" r="1.800"/>',
    planet: '<circle cx="12" cy="12" r="6"/><path d="M6.300 14.200C3.500 16 2 17.600 2.600 18.500c.9 1.300 6.300-.5 12-4.200s9.600-7.700 8.700-9c-.5-.8-2.500-.5-5.200.6"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    land: '<path d="M12 3v11M7 10l5 5 5-5M4 20h16"/>',
    astro: '<circle cx="12" cy="7" r="4"/><path d="M9.500 7h5M6 21v-4a6 6 0 0 1 12 0v4"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    gem: '<path d="M12 3l7 4v6l-7 8-7-8V7z"/><path d="M5 7l7 4 7-4M12 11v10"/>',
    jump: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="5"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.7.4-1 .9-1 1.700M12 17v.01"/>',
    star: '<path d="M12 3l2.700 5.600 6.100.8-4.500 4.200 1.200 6-5.500-3-5.500 3 1.200-6L3.200 9.400l6.100-.8z"/>',
    go: '<path d="M6 13l6-6 6 6M6 19l6-6 6 6"/>',
    coin: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7v10M14.500 9.500h-3.500a1.500 1.500 0 0 0 0 3h2a1.500 1.500 0 0 1 0 3H9.500"/>',
    tent: '<path d="M3 20 12 4l9 16H3zM9 20l3-6 3 6"/>',
    tool: '<path d="M14.500 6.500a4 4 0 0 0-5 5L4 17l3 3 5.500-5.500a4 4 0 0 0 5-5l-2.500 2.500-2.500-.5-.5-2.500z"/>',
    bino: '<circle cx="7" cy="15" r="4"/><circle cx="17" cy="15" r="4"/><path d="M5 12l2-7h2l1 4h4l1-4h2l2 7M11 15h2"/>',
    power: '<path d="M12 3v9M6.500 7a8 8 0 1 0 11 0"/>',
    probe: '<path d="M12 3v6M8 9h8l2 6H6zM9 15l-2 6M15 15l2 6M12 15v6"/>',
    station: '<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M3 8v8M21 8v8M3 12h6M15 12h6M12 3v6M12 15v6"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/>',
    sound: '<path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6M18.500 6.500a8 8 0 0 1 0 11"/>'
  };
  const sfx = function (n) { if (SIM.sfx) SIM.sfx(n); };
  const icon = function (n) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + IC[n] + '</svg>'; };

  // ---------- formatting
  const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function sci(x, dp) {
    if (x === 0) return '0';
    const e = Math.floor(Math.log10(Math.abs(x))), m = x / Math.pow(10, e);
    return m.toFixed(dp == null ? 3 : dp) + ' × 10' + String(e).split('').map(function (c) { return SUP[c]; }).join('');
  }
  function num(x, dp) { return x.toLocaleString('en-US', { maximumFractionDigits: dp == null ? 0 : dp, minimumFractionDigits: dp == null ? 0 : dp }); }
  function fmtPeriod(days) {
    const a = Math.abs(days);
    if (a < 2) return (a * 24).toFixed(a * 24 < 10 ? 1 : 0) + ' hours';
    if (a < 800) return a.toFixed(a < 20 ? 1 : 0) + ' days';
    return (a / 365.25).toFixed(a / 365.25 < 20 ? 1 : 0) + ' years';
  }
  function fmtLight(km) {
    const s = km / 299792.458;
    if (s < 1) return (s * 1000).toFixed(0) + ' ms';
    if (s < 60) return s.toFixed(1) + ' seconds';
    if (s < 3600) return Math.round(s / 60) + ' minutes';
    return (s / 3600).toFixed(1) + ' hours';
  }
  function fmtK(k) { return num(k - 273.15) + ' °C (' + num(k) + ' K)'; }
  function latLonText(v) {
    const ll = SIM.dirLatLon(v);
    return Math.abs(ll.lat).toFixed(1) + '°' + (ll.lat >= 0 ? 'N' : 'S') + ' ' + Math.abs(ll.lon).toFixed(1) + '°' + (ll.lon >= 0 ? 'E' : 'W');
  }
  function bars(comp) {
    let h = '<div class="bars">';
    comp.forEach(function (c) {
      const v = c[1], txt = v >= 1 ? v.toFixed(1) : v >= 0.1 ? v.toFixed(2) : v >= 0.01 ? v.toFixed(3) : String(+v.toPrecision(2));
      h += '<span>' + c[0] + '</span><i><u style="width:' + Math.max(2, Math.min(100, v)) + '%"></u></i><b>' + txt + '%</b>';
    });
    return h + '</div>';
  }
  function kv(rows) { return '<div class="kv">' + rows.map(function (r) { return '<span>' + r[0] + '</span><b>' + r[1] + '</b>'; }).join('') + '</div>'; }
  function tiles(rows) { return '<div class="tiles">' + rows.map(function (r) { return '<div class="tile"><span>' + r[0] + '</span><b>' + r[1] + '</b><small>' + (r[2] || '') + '</small></div>'; }).join('') + '</div>'; }
  function disc(b, cls) {
    const i = SIM.bodies.indexOf(b);
    return '<span class="disc ' + (cls || '') + '" style="background-color:' + b.d.color + ';background-image:url(tex/thumbs.jpg);background-position:' + (i % 6) * 20 + '% ' + Math.floor(i / 6) * 20 + '%"></span>';
  }

  // ---------- saved game: name, experience, coins, what has been visited and built
  function loadJ(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function saveJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function freshSave() { return { name: '', xp: 0, coins: 0, launched: 0, station: 0, visited: {}, landed: {}, walked: {}, scanned: {}, types: {}, camps: {}, probes: {}, done: {}, log: [] }; }
  let S = loadJ('sse_save_v3');
  if (!S) { S = freshSave(); const old = loadJ('sse_prog_v2'); if (old) ['visited', 'landed', 'walked', 'scanned'].forEach(function (k) { if (old[k]) S[k] = old[k]; }); if (old && old.launched) S.launched = 1; }
  (function () { const f = freshSave(); Object.keys(f).forEach(function (k) { if (S[k] == null) S[k] = f[k]; }); })();
  const save = function () { saveJ('sse_save_v3', S); };
  const count = function (o) { return Object.keys(o || {}).length; };
  SIM.camps = S.camps; SIM.setStation(S.station);
  // older saves: work out which sample kinds were already found
  SIM.samples.forEach(function (x) { const id = x.bid || (SIM.bodies.filter(function (b) { return b.name === x.body; })[0] || {}).id; if (id) { x.bid = id; (S.types[id] = S.types[id] || {})[x.mat] = 1; } });

  const TITLES = ['Space Cadet', 'Junior Explorer', 'Explorer', 'Pilot', 'Navigator', 'Captain', 'Commander', 'Star Voyager', 'Admiral', 'Galaxy Legend'];
  function levelOf(xp) { let n = 1; while (xp >= 60 * n * (n + 1)) n++; return n; }
  function titleOf(l) { return TITLES[Math.min(TITLES.length, l) - 1]; }
  function xpSpan(l) { return [60 * (l - 1) * l, 60 * l * (l + 1)]; }
  // how much a world's discoveries are worth: farther from home pays better
  function worth(b) { if (b.id === 'earth') return 0.6; const pl = b.d.type === 'moon' ? b.parent : b; return 1 + 1.2 * Math.log2(1 + pl.a / AU); }
  function sampleValue(x) { const b = SIM.byId[x.bid]; return Math.round((15 + 20 * x.kg) * (b ? worth(b) : 1)); }
  function logAdd(txt) { const d = new Date(); S.log.push({ d: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }), t: txt }); if (S.log.length > 150) S.log.splice(0, S.log.length - 150); }
  function profileHTML() {
    const l = levelOf(S.xp);
    return '<b>Level ' + l + '</b> ' + titleOf(l) + (S.name ? ' ' + esc(S.name) : '') + '<span class="coin">' + icon('coin') + num(S.coins) + '</span>';
  }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function refreshProfile() { const el = $('st-prof'); if (el) el.innerHTML = profileHTML(); }
  let cardQueue = [];
  function reward(xp, coins, why) {
    const l0 = levelOf(S.xp); S.xp += xp || 0; S.coins += coins || 0;
    const l1 = levelOf(S.xp);
    if (coins) sfx('coin');
    if (l1 > l0) {
      logAdd('Promoted to ' + titleOf(l1) + ' (level ' + l1 + ').');
      setTimeout(function () { sfx('level'); showCard('<div class="eyebrow" style="color:var(--amber)">Level up!</div><h3>' + icon('star') + 'Level ' + l1 + ': ' + titleOf(l1) + '</h3><p>Well done' + (S.name ? ', ' + esc(S.name) : '') + '! Keep exploring to earn your next rank.</p>', 7000); }, 1400);
    }
    if (why && (xp || coins)) SIM.say(why + '  ' + (xp ? '+' + xp + ' XP ' : '') + (coins ? ' +' + coins + ' coins' : ''), 4500);
    save(); refreshProfile();
  }

  // ---------- world missions: every world has its own short checklist
  const ORDER = ['moon', 'mars', 'jupiter', 'europa', 'io', 'saturn', 'titan', 'enceladus', 'venus', 'mercury'];
  SIM.bodies.forEach(function (b) { if (ORDER.indexOf(b.id) < 0 && b.id !== 'earth') ORDER.push(b.id); }); ORDER.push('earth');
  function kindsNeeded(b) { return Math.max(1, Math.min(3, (b.d.materials || []).length)); }
  function steps(b) {
    const id = b.id, d = b.d;
    if (b === sun) return [['Fly to the Sun', !!S.visited.sun], ['Scan it with the ship scanner', !!S.scanned.sun]];
    if (d.gas) return [['Fly to ' + b.name, !!S.visited[id]], ['Scan it with the ship scanner', !!S.scanned[id]], ['Send a probe into the clouds', !!S.probes[id]]];
    const need = kindsNeeded(b), have = Math.min(need, count(S.types[id])), c = S.camps[id];
    return [['Land on ' + b.name, !!S.landed[id]], ['Collect ' + need + ' different kind' + (need > 1 ? 's' : '') + ' of sample (' + have + '/' + need + ')', have >= need],
      ['Set up a camp', !!c], ['Switch the camp on', !!(c && c.on)], ['Scan ' + b.name + ' with the ship scanner', !!S.scanned[id]]];
  }
  function checkWorld(b) {
    if (!b || S.done[b.id]) return;
    if (!steps(b).every(function (x) { return x[1]; })) return;
    S.done[b.id] = 1; const c = Math.round(120 * worth(b));
    logAdd('MISSION COMPLETE: ' + b.name + '.');
    sfx('mission');
    showCard('<div class="eyebrow" style="color:var(--amber)">Mission complete</div><h3>' + disc(b) + b.name + '</h3><p>Every task on ' + b.name + ' is done. Your reward: <b>' + c + ' coins</b> and 150 XP.</p>', 8000);
    reward(150, c);
  }
  function contextWorld() {
    if (SIM.mode === 'foot') return player.body;
    if (SIM.mode === 'deck' || ship.docked) return null;
    if (ship.landed || (ship.body !== sun && ship.alt < ship.body.R * 8)) return ship.body;
    return null;
  }
  function nextWorld() { for (let i = 0; i < ORDER.length; i++) if (!S.done[ORDER[i]]) return SIM.byId[ORDER[i]]; return null; }
  function checkMissions() {
    const w = contextWorld(), el = $('mission');
    let txt;
    if (SIM.mode === 'deck' || ship.docked) txt = 'Space station: ' + (S.station < 4 ? 'build the crew quarters to go outside' : S.station < 5 ? 'build the ZetaQ telescope' : 'look at the planets through the ZetaQ telescope');
    else if (w && !S.done[w.id] && (w.id !== 'earth' || S.launched)) { const st = steps(w).filter(function (x) { return !x[1]; })[0]; txt = w.name + ': ' + st[0]; }
    else if (!S.launched) txt = 'Launch into space';
    else { const n = nextWorld(); txt = n ? 'Next mission: ' + (n.d.gas ? 'send a probe into ' : n === sun ? 'visit the ' : 'explore ') + n.name : 'All missions complete. You are a legend!'; }
    const html = icon('star') + '<span>' + txt + '</span>';
    if (el.innerHTML !== html) el.innerHTML = html;
    if (!$('logp').hidden && logTab === 'missions') fillLog();
  }

  // ---------- messages
  let toastTimer = 0, cardTimer = 0;
  SIM.say = function (msg, ms) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500); };
  SIM.banner = function (txt) { const b = $('banner'); if (b.textContent !== txt) b.textContent = txt; };
  function showCard(html, ms) { const c = $('card'); c.innerHTML = html; c.hidden = false; clearTimeout(cardTimer); cardTimer = setTimeout(function () { c.hidden = true; }, ms || 6500); }
  $('card').addEventListener('click', function () { $('card').hidden = true; });
  function fade(fn) { const f = $('fade'); f.style.opacity = 1; setTimeout(function () { fn(); f.style.opacity = 0; }, 230); }

  function setTarget(b) { SIM.target = b; }
  SIM.setTarget = setTarget;

  // ---------- time
  const WARPS = [1, 10, 100, 1000, 10000, 100000, 1000000]; let warpI = 0;
  function warp(dir) {
    warpI = Math.max(0, Math.min(WARPS.length - 1, warpI + dir)); SIM.warp = WARPS[warpI];
    const txt = SIM.warp === 1 ? '×1 (real)' : '×' + num(SIM.warp);
    $('m-warp').textContent = txt; $('st-warp').hidden = SIM.warp === 1; $('st-warp').textContent = 'Time ×' + num(SIM.warp);
  }
  function makeDay() {
    if (SIM.mode !== 'foot' && !(ship.landed && !ship.seq)) return SIM.say('Land first. Then you can skip ahead to daytime.');
    fade(function () { const ok = SIM.makeDay(); SIM.say(ok ? 'Good morning! The clock jumped ahead to daytime here.' : 'The Sun stays very low here at this time of year.', 4500); });
  }

  // ---------- overlays
  const OV = ['worlds', 'help', 'logp'];
  function overlayOpen() { return !$('worlds').hidden || !$('help').hidden || !$('logp').hidden || !$('start').hidden; }
  function closeOverlays() {
    let any = false;
    OV.forEach(function (id) { if (!$(id).hidden) { $(id).hidden = true; any = true; } });
    if (!$('menu').hidden) { $('menu').hidden = true; any = true; }
    if (any) canvas.focus();
    return any;
  }
  function openOverlay(id) { closeOverlays(); input.keys = {}; resetStick(); $(id).hidden = false; }
  function toggle(id, onOpen) { if (!$(id).hidden) closeOverlays(); else { openOverlay(id); if (onOpen) onOpen(); } }

  // ---------- actions
  function nearestBody() { let best = null, bd = Infinity; SIM.bodies.forEach(function (b) { const d = b.dist - b.R; if (d < bd) { bd = d; best = b; } }); return best; }
  function scanBody() { if (SIM.target && SIM.target.dist < SIM.target.R * 60) return SIM.target; const nb = nearestBody(); return ship.body !== sun && !(nb && nb.dist - nb.R < nb.R * 3) ? ship.body : nb; }
  function inShip(fn) { if (SIM.mode === 'foot') fade(function () { SIM.enterShip(); fn(); }); else if (SIM.mode === 'deck') { SIM.leaveDeck(); fn(); } else fn(); }
  function doLaunch() { justLanded = false; SIM.launch(); }
  function doLand() { SIM.autoLand(); }
  function doOut() { if (SIM.mode === 'foot') return doBoard(); if (SIM.mode === 'deck') return fade(function () { SIM.leaveDeck(); }); if (ship.docked && !ship.seq) return S.station >= 4 ? fade(function () { SIM.visitStation(); }) : SIM.visitStation(); if (!ship.landed || ship.seq) return SIM.exitShip(); if (ship.water) return SIM.exitShip(); fade(function () { SIM.exitShip(); }); }
  function doBoard() { if (SIM.mode !== 'foot') return; fade(function () { SIM.enterShip(); }); }
  function doScan() {
    if (SIM.mode === 'deck') { SIM.useScope(!SIM.deck.scope); return; }
    if (SIM.mode === 'foot') {
      player.scan = !player.scan; $('suitp').hidden = !player.scan; suitClock = 0; toolsOpen = false; sfx(player.scan ? 'ping' : 'click');
      SIM.say(player.scan ? 'Scanner on! Colours show what the ground is made of. Blue diamonds are samples.' : 'Scanner off.', 4000);
      return;
    }
    openScan(scanBody());
  }
  function toggleView() {
    if (SIM.mode === 'deck') return;
    if (SIM.mode === 'ship') { ship.view = ship.view === 'chase' ? 'cockpit' : 'chase'; SIM.say(ship.view === 'cockpit' ? 'Looking out of the cockpit.' : 'Looking from behind the ship.', 1800); }
    else { player.first = !player.first; SIM.say(player.first ? 'Looking through your helmet.' : 'Looking from behind.', 1800); }
  }
  const ACT = {
    launch: { label: 'Launch', icon: 'rocket', key: 'L', fn: doLaunch },
    out: { label: 'Get out', icon: 'astro', key: 'E', fn: doOut },
    land: { label: 'Land', icon: 'land', key: 'L', fn: doLand },
    worlds: { label: 'Where to?', icon: 'planet', key: 'M', fn: function () { toggle('worlds', openWorlds); } },
    scan: { label: 'Scan', icon: 'scan', key: 'T', fn: doScan },
    gscan: { label: 'Scan ground', icon: 'scan', key: 'T', fn: doScan },
    pick: { label: 'Pick up', icon: 'gem', key: 'F', fn: function () { SIM.collect(); } },
    board: { label: 'Back to ship', icon: 'rocket', key: 'E', fn: doBoard },
    stop: { label: 'Stop', icon: 'stop', key: 'Esc', fn: function () { SIM.abortSeq(); } },
    day: { label: 'Make it day', icon: 'sun', fn: makeDay },
    tools: { label: 'Tools', icon: 'tool', fn: function () { toolsOpen = !toolsOpen; actSig = ''; updateActions(); } },
    bino: { label: 'Binoculars', icon: 'bino', key: 'N', fn: function () { setBino(!binoOn); toolsOpen = false; } },
    camp: { label: 'Set up camp', icon: 'tent', key: 'C', fn: function () { toolsOpen = false; SIM.setupCamp(); } },
    campon: { label: 'Switch camp on', icon: 'power', key: 'C', fn: function () { SIM.activateCamp(); } },
    probe: { label: 'Send probe', icon: 'probe', key: 'P', fn: function () { SIM.sendProbe(); } },
    dockit: { label: 'Dock', icon: 'station', key: 'L', fn: function () { SIM.dock(); } },
    undock: { label: 'Undock', icon: 'rocket', key: 'L', fn: function () { SIM.undock(); } },
    visit: { label: 'Go outside', icon: 'astro', key: 'E', fn: doOut },
    deckback: { label: 'Back inside', icon: 'rocket', key: 'E', fn: doOut },
    scope: { label: 'Use telescope', icon: 'bino', key: 'T', fn: function () { SIM.useScope(true); } },
    scprev: { label: 'Previous', icon: 'go', fn: function () { SIM.scopeNext(-1); } },
    scnext: { label: 'Next world', icon: 'planet', fn: function () { SIM.scopeNext(1); } },
    scstop: { label: 'Stop looking', icon: 'stop', key: 'T', fn: function () { SIM.useScope(false); } },
    go: { label: 'GO', icon: 'go', hold: 'go' },
    jump: { label: 'Jump', icon: 'jump', hold: 'up' }
  };
  let actSig = '', toolsOpen = false;
  function updateActions() {
    const foot = SIM.mode === 'foot', b = foot ? player.body : ship.body, touch = app.classList.contains('touch');
    const top = [], hold = [];
    let primary = '', scanLabel = 'Scan';
    const dark = (foot || (ship.landed && !ship.seq)) && b !== sun && SIM.sunHere() < 0.05;
    if (SIM.mode === 'deck') {
      if (SIM.deck.scope) { top.push('scstop'); top.push('scprev'); top.push('scnext'); primary = 'scnext'; }
      else { const near = S.station >= 5 && SIM.scopeDist() < 3.4; if (near) { top.push('scope'); primary = 'scope'; } top.push('deckback'); if (touch) hold.push('jump'); }
    }
    else if (foot && binoOn) { top.push('bino'); primary = 'bino'; }
    else if (foot) {
      const n = SIM.nearestSample(), nearS = n && n.d < 0.0052, nearShip = player.p.distanceTo(ship.p) < 0.02;
      const camp = S.camps[b.id], nearCamp = camp && !camp.on && SIM.campDist() < 0.016;
      if (nearS) { top.push('pick'); primary = 'pick'; }
      if (nearCamp) { top.push('campon'); if (!nearS) primary = 'campon'; }
      if (toolsOpen) { top.push('gscan'); top.push('bino'); if (!camp) top.push('camp'); if (dark) top.push('day'); }
      top.push('tools'); top.push('board'); if (!primary && nearShip) primary = 'board';
      if (touch) hold.push('jump');
    } else if (ship.seq) {
      const s = ship.seq;
      if ((s.type === 'launch' && s.t < s.cd) || s.type === 'warp' || s.type === 'dock') top.push('stop');
    } else if (ship.docked) {
      top.push('worlds'); top.push('undock'); top.push('visit'); primary = S.station >= 4 ? 'visit' : 'undock';
    } else if (ship.landed) {
      top.push('launch'); if (!ship.water) top.push('out');
      primary = justLanded && !ship.water ? 'out' : 'launch';
      if (dark) top.push('day');
    } else {
      const canLand = b.d.landable && ship.alt < b.R * 4;
      if (canLand) { top.push('land'); primary = 'land'; }
      top.push('worlds'); if (!canLand) primary = 'worlds';
      top.push('scan'); const nb = scanBody(); if (nb) scanLabel = 'Scan ' + nb.name;
      if (b.d.gas && ship.alt < b.R * 4 && !SIM.probe) { top.push('probe'); if (!S.probes[b.id]) primary = 'probe'; }
      if (SIM.station.n && SIM.station.d < 2) { top.push('dockit'); primary = 'dockit'; }
      if (touch) hold.push('go');
    }
    const sig = top.join(',') + '|' + hold.join(',') + '|' + primary + '|' + scanLabel + '|' + (player.scan ? 1 : 0) + '|' + touch + '|' + (toolsOpen ? 1 : 0) + (binoOn ? 1 : 0);
    if (sig !== actSig) {
      actSig = sig;
      const btn = function (id) {
        const a = ACT[id], lab = id === 'scan' ? scanLabel : id === 'gscan' && player.scan ? 'Scanner off' : id === 'bino' && binoOn ? 'Put away' : id === 'tools' && toolsOpen ? 'Close tools' : a.label;
        if (a.hold) return '<button type="button" class="act round" data-hold="' + a.hold + '">' + icon(a.icon) + lab + '</button>';
        return '<button type="button" class="act' + (id === primary ? ' primary' : '') + (id === 'gscan' && player.scan || id === 'tools' && toolsOpen ? ' on' : '') + '" data-act="' + id + '">' + icon(a.icon) + lab + (a.key && !touch ? '<kbd>' + a.key + '</kbd>' : '') + '</button>';
      };
      // the primary button sits lowest and furthest right, nearest the thumb
      const ordered = top.filter(function (i) { return i !== primary; }); if (primary) ordered.push(primary);
      $('actions').innerHTML = '<div class="rowa">' + ordered.map(btn).join('') + '</div>' + (hold.length ? '<div class="rowa">' + hold.map(btn).join('') + '</div>' : '');
    }
    // joystick only when there is something to steer
    const wantStick = touch && !binoOn && (foot || (SIM.mode === 'deck' ? !SIM.deck.scope : (!ship.seq && !ship.landed && !ship.docked)));
    const st = $('stick'); if ((st.style.visibility !== 'hidden') !== wantStick) { st.style.visibility = wantStick ? '' : 'hidden'; if (!wantStick) resetStick(); }
    const sl = foot || SIM.mode === 'deck' ? 'Walk' : 'Steer'; if ($('stick-lbl').textContent !== sl) $('stick-lbl').textContent = sl;
  }
  $('actions').addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]'); if (!t) return;
    sfx('click'); ACT[t.getAttribute('data-act')].fn(); t.blur(); if (!overlayOpen()) canvas.focus();
  });
  function holdEvt(e, on) {
    const t = e.target.closest && e.target.closest('[data-hold]'); if (!t) return;
    e.preventDefault(); const k = t.getAttribute('data-hold');
    input[k] = on ? 1 : 0; t.classList.toggle('held', on);
    if (on && t.setPointerCapture) try { t.setPointerCapture(e.pointerId); } catch (err) {}
  }
  $('actions').addEventListener('pointerdown', function (e) { holdEvt(e, true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { $('actions').addEventListener(n, function (e) { holdEvt(e, false); }); });
  $('actions').addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- keyboard
  window.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const c = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(c) >= 0 && !(e.target && e.target.tagName === 'INPUT')) e.preventDefault();
    if (e.target && e.target.tagName === 'INPUT') { if (c === 'Enter' && !started && !$('start-btn').disabled) begin(); return; }
    if (!started) { if ((c === 'Enter' || c === 'Space') && !$('start-btn').disabled) begin(); return; }
    if (c === 'Escape') { if (closeOverlays()) return; if (binoOn) return setBino(false); if (ship.seq) SIM.abortSeq(); else if (!$('scanp').hidden) $('scanp').hidden = true; return; }
    if (e.repeat) return;
    if (c === 'KeyM') return toggle('worlds', openWorlds);
    if (c === 'KeyH') return toggle('help');
    if (c === 'KeyB' || c === 'KeyI') return toggle('logp', fillLog);
    if (overlayOpen()) return;
    input.keys[c] = true;
    if (c === 'KeyT') doScan();
    else if (c === 'KeyL') { if (SIM.mode === 'ship') { if (ship.docked) SIM.undock(); else if (ship.landed) doLaunch(); else if (SIM.station.n && SIM.station.d < 2) SIM.dock(); else doLand(); } }
    else if (SIM.mode === 'deck' && SIM.deck.scope && (c === 'ArrowRight' || c === 'ArrowLeft')) SIM.scopeNext(c === 'ArrowRight' ? 1 : -1);
    else if (c === 'KeyE') doOut();
    else if (c === 'KeyF') SIM.collect();
    else if (c === 'KeyN') { if (SIM.mode === 'foot') setBino(!binoOn); }
    else if (c === 'KeyC') { if (SIM.mode === 'foot') { const cm = S.camps[player.body.id]; if (!cm) SIM.setupCamp(); else if (!cm.on) SIM.activateCamp(); } }
    else if (c === 'KeyP') SIM.sendProbe();
    else if (c === 'KeyV') toggleView();
    else if (c === 'KeyO') SIM.showOrbits = !SIM.showOrbits;
    else if (c === 'Comma') warp(-1);
    else if (c === 'Period') warp(1);
  });
  window.addEventListener('keyup', function (e) { input.keys[e.code] = false; });
  window.addEventListener('blur', function () { input.keys = {}; input.go = 0; input.up = 0; resetStick(); });

  // ---------- pointer: drag the view to steer / look; fixed joystick on touch screens
  function markTouch() { if (!app.classList.contains('touch')) { app.classList.add('touch'); actSig = ''; } }
  if (SIM.mobile || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) markTouch();
  let lookId = null, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') markTouch();
    if (!started || lookId !== null) return;
    lookId = e.pointerId; lx = e.clientX; ly = e.clientY; canvas.focus();
    if (!$('menu').hidden) $('menu').hidden = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== lookId) return;
    const k = e.pointerType === 'touch' ? 1.6 : 1;
    input.mdx += (e.clientX - lx) * k; input.mdy += (e.clientY - ly) * k; lx = e.clientX; ly = e.clientY;
  });
  ['pointerup', 'pointercancel'].forEach(function (n) { canvas.addEventListener(n, function (e) { if (e.pointerId === lookId) lookId = null; }); });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  const stick = $('stick'), knob = stick.querySelector('i'); let stickId = null;
  function resetStick() { stickId = null; input.stickX = 0; input.stickY = 0; knob.style.transform = ''; }
  function stickMove(e) {
    const r = stick.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / (R * 0.72), dy = (e.clientY - (r.top + R)) / (R * 0.72);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    const dz = function (v) { return Math.abs(v) < 0.14 ? 0 : v; };
    input.stickX = dz(dx); input.stickY = dz(dy);
    knob.style.transform = 'translate(' + (dx * R * 0.6).toFixed(1) + 'px,' + (dy * R * 0.6).toFixed(1) + 'px)';
  }
  stick.addEventListener('pointerdown', function (e) { e.preventDefault(); markTouch(); stickId = e.pointerId; try { stick.setPointerCapture(e.pointerId); } catch (err) {} stickMove(e); });
  stick.addEventListener('pointermove', function (e) { if (e.pointerId === stickId) stickMove(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (n) { stick.addEventListener(n, function (e) { if (e.pointerId === stickId) resetStick(); }); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  function click(id, fn) { $(id).addEventListener('click', function (e) { sfx('click'); fn(e); if (e.currentTarget.blur) e.currentTarget.blur(); if (!overlayOpen()) canvas.focus(); }); }
  $('b-map').innerHTML = icon('planet') + '<span>Worlds</span>'; $('b-log').innerHTML = icon('book') + '<span>Logbook</span>'; $('b-more').innerHTML = icon('menu') + '<span>More</span>';
  click('b-map', function () { toggle('worlds', openWorlds); });
  click('b-log', function () { toggle('logp', fillLog); });
  click('b-more', function () { const m = $('menu'); m.hidden = !m.hidden; if (!m.hidden) fillMenu(); });
  click('mission', function () { toggle('logp', fillLog); });
  click('scan-close', function () { $('scanp').hidden = true; });
  click('help-close', closeOverlays); click('log-close', closeOverlays); click('w-close', closeOverlays);
  click('start-btn', begin);
  click('m-slow', function () { warp(-1); }); click('m-fast', function () { warp(1); });
  click('m-day', function () { $('menu').hidden = true; makeDay(); });
  click('m-view', function () { $('menu').hidden = true; toggleView(); });
  click('m-orbits', function () { SIM.showOrbits = !SIM.showOrbits; fillMenu(); });
  click('m-help', function () { openOverlay('help'); });
  click('m-music', function () { if (SIM.audio) { SIM.audio.start(); SIM.audio.setMusic(!SIM.audio.music); } fillMenu(); });
  click('m-sound', function () { if (SIM.audio) { SIM.audio.start(); SIM.audio.setSfx(!SIM.audio.sfx); } fillMenu(); });
  click('probe-close', function () { $('probep').hidden = true; });
  const fsEl = document.documentElement, canFS = !!(fsEl.requestFullscreen || fsEl.webkitRequestFullscreen);
  click('m-full', function () {
    $('menu').hidden = true;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const p = (fsEl.requestFullscreen || fsEl.webkitRequestFullscreen).call(fsEl); if (p && p.catch) p.catch(function () { SIM.say('Full screen is not available here.'); }); }
    } catch (e) { SIM.say('Full screen is not available here.'); }
  });
  function fillMenu() {
    $('m-day').innerHTML = icon('sun') + 'Make it daytime here';
    $('m-view').innerHTML = icon('eye') + (SIM.mode === 'ship' ? (ship.view === 'chase' ? 'Look from the cockpit' : 'Look from behind the ship') : (player.first ? 'Look from behind' : 'Look through the helmet'));
    $('m-orbits').innerHTML = icon('orbit') + (SIM.showOrbits ? 'Hide orbit lines' : 'Show orbit lines');
    $('m-full').innerHTML = icon('full') + 'Full screen'; $('m-full').hidden = !canFS;
    $('m-help').innerHTML = icon('help') + 'How to play';
    $('m-music').innerHTML = icon('music') + (SIM.audio && SIM.audio.music ? 'Music: on' : 'Music: off');
    $('m-sound').innerHTML = icon('sound') + (SIM.audio && SIM.audio.sfx ? 'Sound effects: on' : 'Sound effects: off');
  }

  // ---------- facts
  const tA = new V3(), tB = new V3(), tC = new V3();
  function axialTilt(b) {
    const d = b.d; if (!d.pole || d.type === 'moon') return null;
    let ang;
    if (b === sun) ang = Math.acos(b.pole.y) / D2R;
    else { SIM.helioPos(d, SIM.t, tA); SIM.helioPos(d, SIM.t + b.period / 4, tB); tC.crossVectors(tA, tB).normalize(); ang = Math.acos(Math.max(-1, Math.min(1, tC.dot(b.pole)))) / D2R; }
    if (d.pm && d.pm[1] < 0) ang = 180 - ang;
    return ang;
  }
  // a handful of facts a child can picture
  function quickFacts(b) {
    const d = b.d, g = b.g, out = [];
    const w = d.R / 6371;
    if (b === sun) out.push(['Size', '109 Earths wide', 'More than a million Earths would fit inside.']);
    else if (b.id === 'earth') out.push(['Size', num(d.R * 2) + ' km wide', 'Our home planet.']);
    else if (w >= 1) out.push(['Size', w.toFixed(1) + '× wider than Earth', num(d.R * 2) + ' km across']);
    else if (w > 0.02) out.push(['Size', 'Earth is ' + (1 / w).toFixed(1) + '× wider', num(d.R * 2) + ' km across']);
    else out.push(['Size', num(d.R * 2, d.R < 50 ? 1 : 0) + ' km across', 'Small enough to fit inside a big city.']);
    const kid = 30 * g / 9.80665, jump = 0.4 * 9.80665 / g;
    if (b === sun || d.gas) out.push(['Gravity', (g / 9.80665).toFixed(g < 1 ? 2 : 1) + '× Earth’s', 'A 30 kg child would feel like ' + num(kid) + ' kg.']);
    else out.push(['Gravity', (g / 9.80665 * 100).toFixed(g < 0.5 ? 1 : 0) + '% of Earth’s', jump > 400 ? 'One good jump and you would float off into space!' : jump > 1.2 ? 'You could jump about ' + num(jump, jump < 10 ? 1 : 0) + ' m high.' : 'A 30 kg child would feel like ' + num(kid, 1) + ' kg.']);
    if (b === sun) out.push(['Temperature', '5,500 °C', 'At the surface. The core is 15 million °C.']);
    else if (d.tempNote) out.push(['Temperature', num(d.temp.mean - 273.15) + ' °C', 'At the cloud tops.']);
    else out.push(['Temperature', num(d.temp.mean - 273.15) + ' °C', 'From ' + num(d.temp.min - 273.15) + ' to ' + num(d.temp.max - 273.15) + ' °C']);
    if (d.locked) out.push(['One day lasts', fmtPeriod(d.orbit.P), 'It always keeps the same face towards ' + b.parent.name + '.']);
    else if (b !== sun) out.push(['One day lasts', fmtPeriod(Math.abs(d.rotH) / 24), d.pm[1] < 0 ? 'It spins backwards!' : d.type === 'planet' || d.type === 'dwarf' ? 'One year lasts ' + fmtPeriod(b.period) + '.' : 'Goes round ' + b.parent.name + ' every ' + fmtPeriod(b.period) + '.']);
    else out.push(['Age', '4.6 billion years', 'About halfway through its life.']);
    return out;
  }
  function report(b) {
    const d = b.d, vol = 4 / 3 * Math.PI * Math.pow(d.R, 3), rho = d.mass / (vol * 1e12), g = b.g, vesc = Math.sqrt(2 * b.GM / d.R);
    let h = '';
    const phys = [['Type', d.cls], ['Mass', sci(d.mass) + ' kg']];
    if (b.id !== 'earth') { const r = d.mass / 5.9722e24; phys.push(['Compared with Earth', (r >= 0.001 ? r.toPrecision(3) : sci(r, 2)) + ' × mass']); }
    phys.push(['Mean radius', num(d.R, d.R < 100 ? 2 : 1) + ' km']);
    if (d.Req) { phys.push(['Equatorial radius', num(d.Req) + ' km']); phys.push(['Polar flattening', (d.flat * 100).toFixed(2) + '%']); }
    phys.push(['Mean density', rho.toFixed(3) + ' g/cm³']);
    phys.push([d.gas ? 'Gravity at 1 bar' : b === sun ? 'Gravity at photosphere' : 'Surface gravity', g.toFixed(g < 0.1 ? 4 : 2) + ' m/s² (' + (g / 9.80665).toPrecision(3) + ' g)']);
    phys.push(['Escape velocity', vesc < 0.1 ? (vesc * 1000).toFixed(1) + ' m/s' : vesc.toFixed(2) + ' km/s']);
    if (d.locked) phys.push(['Rotation', 'Synchronous, ' + fmtPeriod(d.orbit.P)]);
    else phys.push(['Rotation period', fmtPeriod(Math.abs(d.rotH) / 24) + (d.pm[1] < 0 ? ' (retrograde)' : '')]);
    const tilt = axialTilt(b); if (tilt != null) phys.push([b === sun ? 'Tilt to ecliptic' : 'Axial tilt', tilt.toFixed(2) + '°']);
    h += '<div class="sec" style="margin-top:4px">Body</div>' + kv(phys);
    if (b !== sun) {
      const orb = [];
      if (d.type === 'moon') {
        orb.push(['Orbits', b.parent.name]); orb.push(['Distance from ' + b.parent.name, num(d.orbit.a) + ' km']); orb.push(['Orbital period', fmtPeriod(d.orbit.P) + (d.orbit.inc > 90 ? ' (retrograde)' : '')]);
        orb.push(['Eccentricity', d.orbit.e.toFixed(4)]); orb.push([d.orbit.luna ? 'Inclination to ecliptic' : 'Inclination to equator', d.orbit.inc.toFixed(2) + '°']);
      } else {
        const e = d.el ? d.el[1] : d.kep.e, inc = d.el ? d.el[2] : d.kep.i;
        orb.push(['Orbits', 'Sun']); orb.push(['Semi-major axis', (b.a / AU).toFixed(4) + ' AU']); orb.push(['Orbital period', fmtPeriod(b.period)]);
        orb.push(['Eccentricity', e.toFixed(4)]); orb.push(['Inclination to ecliptic', Math.abs(inc).toFixed(2) + '°']);
        orb.push(['Mean orbital speed', (2 * Math.PI * b.a / (b.period * 86400)).toFixed(2) + ' km/s']);
      }
      h += '<div class="sec">Orbit</div>' + kv(orb);
      const dS = b.pos.length() / AU, flux = 1361 / (dS * dS);
      h += '<div class="sec">Right now</div>' + kv([
        ['Distance from Sun', dS.toFixed(3) + ' AU'], ['Sunlight strength', (flux / 1361 * 100).toPrecision(3) + '% of Earth’s'],
        ['Sunlight takes', fmtLight(dS * AU) + ' to arrive'], ['Distance from ship', SIM.fmtDist(Math.max(0, b.dist - b.R))]]);
    }
    h += '<div class="sec">Temperature</div>';
    if (d.tempNote) h += '<p class="note">' + d.tempNote + '</p>';
    else h += kv([['Coldest', fmtK(d.temp.min)], ['Average', fmtK(d.temp.mean)], ['Hottest', fmtK(d.temp.max)]]);
    h += '<div class="sec">' + (b === sun ? d.compLabel : 'Air') + '</div>';
    if (b === sun) h += bars(d.comp);
    else if (d.atm) {
      const a = d.atm, rows = [];
      if (a.P != null) rows.push(['Pressure at the ground', a.P >= 0.01 ? a.P.toFixed(a.P > 10 ? 0 : 3) + ' bar' : sci(a.P * 1e5, 1) + ' Pa']);
      else rows.push(['Ground', 'None — gas all the way down']);
      h += kv(rows) + '<p class="note">What the air is made of</p>' + bars(a.comp);
    } else h += '<p class="note">' + (d.exo || 'No air at all. Space starts right at the ground.') + '</p>';
    if (d.rings) h += '<div class="sec">Rings</div>' + kv([['Inner edge', num(d.rings.inner) + ' km'], ['Outer edge', num(d.rings.outer) + ' km']]);
    if (d.materials) {
      h += '<div class="sec">What the ground is made of</div>';
      d.materials.forEach(function (m) { h += '<div class="note" style="display:flex;gap:8px;align-items:center;margin:0 0 6px"><em style="width:11px;height:11px;border-radius:3px;flex:none;background:' + m.c + '"></em><span style="color:var(--ink)">' + m.n + '</span></div>'; });
      h += '<p class="note">Land, step out and switch on your suit scanner to see exactly what is under your boots.</p>';
    }
    if (d.facts) h += '<div class="sec">Notes</div>' + kv(d.facts);
    if (b.proc) h += '<p class="note">Nobody has mapped this world yet, so its surface here is made up.</p>';
    return h;
  }
  let scanTimer = 0;
  function openScan(b) {
    if (!b) return;
    $('menu').hidden = true;
    $('scanp').hidden = false; $('scan-title').textContent = b.name; sfx('scan');
    $('scan-kind').textContent = 'Ship scanner · ' + b.d.cls;
    const body = $('scan-body'), pr = $('scan-prog');
    body.innerHTML = '<p class="note">Scanning ' + b.name + '…</p>'; body.scrollTop = 0;
    pr.style.transition = 'none'; pr.style.width = '0'; void pr.offsetWidth; pr.style.transition = ''; pr.style.width = '100%';
    clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      body.innerHTML = '<p>' + b.d.desc + '</p>' + tiles(quickFacts(b)) + '<details class="more"' + (SIM.W > 900 ? ' open' : '') + '><summary>All the numbers</summary>' + report(b) + '</details>';
      onScanned(b); pr.style.width = '0';
    }, 1100);
  }
  SIM.openScan = openScan;

  // ---------- suit scanner panel
  let suitClock = 0;
  function localTemp(b, sinElev) {
    const T = b.d.temp, day = Math.max(0, sinElev);
    if (b.d.atm && b.d.atm.P > 0.5) return T.mean + (T.max - T.mean) * 0.4 * day - (T.mean - T.min) * 0.08 * (1 - day);
    return T.min + (T.max - T.min) * Math.pow(day, 0.25);
  }
  function fillSuit() {
    const b = player.body, t = SIM.terrainOf(b), d = tA.copy(player.p).normalize();
    t.heightFine(d.x, d.y, d.z);
    const m = (b.d.materials || [])[t.materialIndex(d.x, d.y, d.z)];
    const se = SIM.sunHere();
    let h = '';
    if (m) h += '<h3><em style="background:' + m.c + '"></em>' + m.n + '</h3><p class="note">' + (m.note || '') + '</p>' + bars(m.comp);
    const a = b.d.atm, T = localTemp(b, se);
    h += kv([['Ground temperature', num(T - 273.15) + ' °C'], ['Air', a && a.P ? (a.P >= 0.01 ? a.P.toFixed(2) + ' bar' : 'Very thin') : 'None (vacuum)'], ['Where', latLonText(player.p)]]);
    $('suit-body').innerHTML = h;
  }

  // ---------- logbook: missions, samples (sell them), space station (build it), log
  let clearArmed = false, logTab = 'missions';
  function fillLog() {
    const l = levelOf(S.xp), span = xpSpan(l), list = SIM.samples; clearArmed = false;
    $('log-title').innerHTML = titleOf(l) + (S.name ? ' ' + esc(S.name) : '');
    let h = '<div class="xp"><span>Level ' + l + '</span><i><u style="width:' + Math.round((S.xp - span[0]) / (span[1] - span[0]) * 100) + '%"></u></i><span>' + num(S.xp) + ' / ' + num(span[1]) + ' XP</span><span class="coin">' + icon('coin') + num(S.coins) + '</span></div>';
    h += '<div class="tabs ltabs">' + [['missions', 'Missions'], ['samples', 'Samples'], ['station', 'Station'], ['log', 'Log']].map(function (t) { return '<button type="button" data-tab="' + t[0] + '" class="' + (logTab === t[0] ? 'sel' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (logTab === 'missions') {
      const dn = count(S.done);
      h += '<div class="stats"><div><b>' + dn + '</b><span>missions done</span></div><div><b>' + count(S.landed) + '</b><span>worlds landed on</span></div><div><b>' + count(S.camps) + '</b><span>camps built</span></div></div>';
      const cw = contextWorld(), nw = nextWorld(), show = [];
      if (cw && !S.done[cw.id]) show.push(cw); if (nw && show.indexOf(nw) < 0) show.push(nw);
      show.forEach(function (b) { h += '<div class="sec">' + (b === cw ? 'Here: ' : 'Next: ') + b.name + '</div>' + stepList(b); });
      h += '<div class="sec">All worlds</div><div class="wm">' + ORDER.map(function (id) { const b = SIM.byId[id], st = steps(b), n = st.filter(function (x) { return x[1]; }).length; return '<button type="button" class="wmr' + (S.done[id] ? ' done' : '') + '" data-world="' + id + '">' + disc(b) + '<span>' + b.name + '</span><em>' + (S.done[id] ? '✓ done' : n + ' / ' + st.length) + '</em></button>'; }).join('') + '</div>';
    } else if (logTab === 'samples') {
      const total = list.reduce(function (a, x) { return a + sampleValue(x); }, 0);
      h += '<div class="office"><img src="img/zetaq.png" alt="ZetaQ" width="52" height="80"><div><b>ZetaQ Science Lab</b><span>We buy your space samples for coins. The kinds you have found stay in your mission record even after you sell.</span></div></div>';
      if (!list.length) h += '<p class="note">No samples in the hold. Land on a world, get out, and look for the blue diamonds.</p>';
      else {
        h += '<div style="margin-bottom:12px"><button class="btn primary" id="sell-all" type="button">' + icon('coin') + 'Sell all ' + list.length + ' for ' + num(total) + ' coins</button></div>';
        list.slice().reverse().forEach(function (x, ri) {
          const i = list.length - 1 - ri;
          h += '<div class="samp"><h4><em style="background:' + x.c + '"></em>' + x.mat + '<button class="btn sell" type="button" data-sell="' + i + '">' + icon('coin') + num(sampleValue(x)) + '</button></h4><small>' + x.body + ' · ' + x.kg.toFixed(2) + ' kg</small><p class="note" style="margin:6px 0 0">' + (x.note || '') + '</p></div>';
        });
      }
    } else if (logTab === 'station') {
      const P = window.SOLPROPS.STATION_PARTS, n = S.station;
      h += '<p>Build your own space station in orbit around Earth, one module at a time. ' + (n ? 'You have built ' + n + ' of ' + P.length + ' modules.' : 'Sell samples to earn coins for the first module.') + '</p>';
      if (n) h += '<div style="margin-bottom:12px"><button class="btn" id="st-fly" type="button">' + icon('station') + 'Fly to my space station</button></div>';
      h += '<div class="parts">' + P.map(function (q, i) {
        const st = i < n ? 'built' : i === n ? 'next' : 'later';
        return '<div class="part ' + st + '"><i>' + (i < n ? '✓' : i + 1) + '</i><div><b>' + q.name + '</b><small>' + q.note + '</small></div>' +
          (i < n ? '<em>Built</em>' : i === n ? '<button class="btn ' + (S.coins >= q.price ? 'primary' : '') + '" id="st-buy" type="button"' + (S.coins >= q.price ? '' : ' disabled') + '>' + icon('coin') + num(q.price) + '</button>' : '<em>' + icon('coin') + num(q.price) + '</em>') + '</div>';
      }).join('') + '</div>';
      if (n < P.length && S.coins < P[n].price) h += '<p class="note" style="margin-top:10px">You need ' + num(P[n].price - S.coins) + ' more coins for the ' + P[n].name.toLowerCase() + '.</p>';
    } else {
      if (!S.log.length) h += '<p class="note">Your log is empty. It fills in as you explore.</p>';
      else h += '<div class="loglist">' + S.log.slice().reverse().map(function (e) { return '<div><small>' + e.d + '</small><span>' + esc(e.t) + '</span></div>'; }).join('') + '</div>';
      h += '<div style="margin-top:16px"><button class="btn" id="log-clear" type="button">Start again from the beginning</button></div>';
    }
    $('log-body').innerHTML = h;
  }
  function stepList(b) { return '<div class="mlist">' + steps(b).map(function (x, i, a) { const now = !x[1] && a.slice(0, i).every(function (y) { return y[1]; }); return '<div class="' + (x[1] ? 'done' : now ? 'now' : '') + '"><i>' + (x[1] ? '✓' : '') + '</i>' + x[0] + '</div>'; }).join('') + '</div>'; }
  $('log-body').addEventListener('click', function (e) {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-tab')) { logTab = t.getAttribute('data-tab'); sfx('click'); return fillLog(); }
    if (t.hasAttribute('data-world')) { openOverlay('worlds'); openWorlds(SIM.byId[t.getAttribute('data-world')]); return; }
    if (t.hasAttribute('data-sell')) { const i = +t.getAttribute('data-sell'), x = SIM.samples[i]; if (!x) return; const v = sampleValue(x); SIM.samples.splice(i, 1); SIM.saveSamples(); reward(0, v); fillLog(); return; }
    if (t.id === 'sell-all') { const v = SIM.samples.reduce(function (a, x) { return a + sampleValue(x); }, 0), n = SIM.samples.length; SIM.samples.length = 0; SIM.saveSamples(); logAdd('Sold ' + n + ' samples to the ZetaQ Science Lab for ' + v + ' coins.'); reward(0, v, 'Samples sold to ZetaQ!'); fillLog(); return; }
    if (t.id === 'st-buy') {
      const P = window.SOLPROPS.STATION_PARTS, q = P[S.station]; if (!q || S.coins < q.price) return;
      S.coins -= q.price; S.station++; SIM.setStation(S.station); sfx('build'); logAdd('Built the ' + q.name.toLowerCase() + ' of the space station.');
      showCard('<div class="eyebrow" style="color:var(--amber)">Space station · module ' + S.station + ' of ' + P.length + '</div><h3>' + icon('station') + q.name + '</h3><p>' + q.note + '</p><p class="note" style="margin:0">Fly to your space station to see it.</p>', 8000);
      reward(100, 0); fillLog(); return;
    }
    if (t.id === 'st-fly') { closeOverlays(); if (SIM.mode === 'deck') SIM.say('You are standing on it!'); else inShip(function () { SIM.flyToStation(); }); return; }
    if (t.id === 'log-clear') {
      if (!clearArmed) { clearArmed = true; t.textContent = 'Tap again to erase everything'; return; }
      const nm = S.name; SIM.clearSamples(); S = freshSave(); S.name = nm; SIM.camps = S.camps; SIM.setStation(0); save(); refreshProfile(); checkMissions(); fillLog();
    }
  });
  SIM.onSample = function (x) {
    const k = S.types[x.bid] = S.types[x.bid] || {}, isNew = !k[x.mat]; k[x.mat] = 1;
    const b = SIM.byId[x.bid], need = kindsNeeded(b), have = Math.min(need, count(k));
    showCard('<div class="eyebrow" style="color:var(--amber)">' + (isNew ? 'New kind of sample' : 'Sample collected') + ' · ' + x.body + '</div><h3><em style="background:' + x.c + '"></em>' + x.mat + '</h3><p>' + (x.note || '') + '</p>' + bars(x.comp.slice(0, 4)) +
      '<p class="note" style="margin:8px 0 0">' + x.kg.toFixed(2) + ' kg · worth ' + sampleValue(x) + ' coins · ' + have + ' of ' + need + ' kinds found on ' + x.body + '</p>', 8000);
    logAdd('Collected ' + x.mat + ' on ' + x.body + '.');
    reward(isNew ? 30 : 5, 0); checkWorld(b); checkMissions();
  };

  // ---------- worlds picker
  const WP = { sel: null, site: -1, tab: 'grid', view: 'sun', items: [] };
  function buildGrid() {
    const sec = function (title, list) { return list.length ? '<h3>' + title + '</h3><div class="wrow">' + list.map(function (b) { return '<button type="button" class="wb" data-id="' + b.id + '">' + disc(b) + '<span>' + b.name + '</span></button>'; }).join('') + '</div>' : ''; };
    let h = '<div id="w-station"></div>' + sec('The Sun and planets', SIM.bodies.filter(function (b) { return b.d.type === 'star' || b.d.type === 'planet'; }));
    h += sec('Dwarf planets', SIM.bodies.filter(function (b) { return b.d.type === 'dwarf'; }));
    SIM.bodies.forEach(function (p) { const ms = p.children.filter(function (c) { return c.d.type === 'moon'; }); if (ms.length) h += sec(ms.length === 1 ? p.name + '’s moon' : 'Moons of ' + p.name, ms); });
    $('w-grid').innerHTML = h;
    $('w-grid').addEventListener('click', function (e) { const t = e.target.closest('.wb'); if (t) selectWorld(SIM.byId[t.getAttribute('data-id')]); });
  }
  buildGrid();
  function badges() {
    const bs = $('w-grid').querySelectorAll('.wb');
    for (let i = 0; i < bs.length; i++) {
      const id = bs[i].getAttribute('data-id'); let bd = bs[i].querySelector('.badge');
      const st = S.done[id] ? 2 : S.visited[id] ? 1 : 0;
      if (st && !bd) { bd = document.createElement('span'); bs[i].appendChild(bd); }
      if (bd) { if (!st) bd.remove(); else { bd.className = 'badge' + (st === 1 ? ' v' : ''); bd.textContent = '✓'; } }
      bs[i].classList.toggle('sel', !!WP.sel && WP.sel.id === id);
    }
  }
  function selectWorld(b, keepSite) {
    WP.sel = b; if (!keepSite) WP.site = -1;
    if (b) {
      SIM.preload(b);
      if (WP.tab === 'map') { if (b.d.type === 'moon') WP.view = b.parent.id; else if (b !== sun && b.children.length) WP.view = b.id; else WP.view = 'sun'; }
    }
    badges(); fillInfo();
  }
  function fillInfo() {
    const b = WP.sel, box = $('w-info');
    if (!b) { box.hidden = true; return; }
    box.hidden = false;
    const d = b.d;
    let h = '<div id="wi-head">' + disc(b) + '<div><div class="eyebrow">' + d.cls + '</div><h3>' + b.name + '</h3></div></div><p>' + d.desc + '</p>' + tiles(quickFacts(b));
    h += '<div class="sec" style="margin-top:4px">Mission' + (S.done[b.id] ? ' · complete ✓' : '') + '</div>' + stepList(b);
    if (d.landable) {
      h += '<div class="sec">Where to land</div><div class="chips"><button type="button" class="chip' + (WP.site < 0 ? ' sel' : '') + '" data-site="-1"><span>The sunny side<small>Land wherever it is daytime right now.</small></span></button>';
      (d.sites || []).forEach(function (s, i) { h += '<button type="button" class="chip' + (WP.site === i ? ' sel' : '') + '" data-site="' + i + '"><span>' + s.name + '<small>' + s.note + '</small></span></button>'; });
      h += '</div>';
    } else h += '<p class="note">' + (b === sun ? 'You cannot land on the Sun, but you can fly close and scan it.' : b.name + ' has no ground. You can dive into the cloud tops, or land on one of its moons.') + '</p>';
    $('wi-body').innerHTML = h; $('wi-body').scrollTop = 0;
    $('wi-foot').innerHTML = '<button class="btn primary big" id="wi-go" type="button">' + icon('rocket') + 'Fly to ' + b.name + '</button><button class="btn" id="wi-scan" type="button">' + icon('scan') + 'Scan</button><button class="btn" id="wi-x" type="button">Back</button>';
    $('wi-go').addEventListener('click', function () { flyTo(b, WP.site); });
    $('wi-scan').addEventListener('click', function () { closeOverlays(); openScan(b); });
    $('wi-x').addEventListener('click', function () { selectWorld(null); });
  }
  $('wi-body').addEventListener('click', function (e) { const t = e.target.closest('.chip'); if (!t) return; WP.site = +t.getAttribute('data-site'); const cs = $('wi-body').querySelectorAll('.chip'); for (let i = 0; i < cs.length; i++) cs[i].classList.toggle('sel', cs[i] === t); });
  function flyTo(b, siteI) {
    closeOverlays(); $('scanp').hidden = true;
    const s = siteI >= 0 && b.d.sites ? b.d.sites[siteI] : null;
    SIM.site = s ? { body: b, dir: SIM.latLonDir(s.lat, s.lon), name: s.name } : null;
    setTarget(b);
    const go = function () { justLanded = false; SIM.autopilot(b); };
    inShip(function () { if (ship.seq) SIM.abortSeq(); go(); });
  }
  SIM.flyTo = flyTo;
  function setTab(t) {
    WP.tab = t; $('tab-grid').classList.toggle('sel', t === 'grid'); $('tab-map').classList.toggle('sel', t === 'map');
    $('w-grid').hidden = t !== 'grid'; $('w-map').hidden = t !== 'map';
    if (t === 'map') { const cb = SIM.cam.body; WP.view = WP.sel ? (WP.sel.d.type === 'moon' ? WP.sel.parent.id : WP.sel !== sun && WP.sel.children.length ? WP.sel.id : 'sun') : cb.d.type === 'moon' ? cb.parent.id : 'sun'; }
  }
  click('tab-grid', function () { setTab('grid'); }); click('tab-map', function () { setTab('map'); });
  click('map-up', function () { WP.view = 'sun'; });
  function openWorlds(b) {
    selectWorld(b && b.id ? b : null); setTab(WP.tab);
    $('w-station').innerHTML = S.station ? '<h3>Your space station</h3><button type="button" class="btn" id="w-st">' + icon('station') + 'Fly to my space station (' + S.station + ' of ' + window.SOLPROPS.STATION_PARTS.length + ' modules)</button>' : '';
    const ws = $('w-st'); if (ws) ws.addEventListener('click', function () { closeOverlays(); if (SIM.mode === 'deck') SIM.say('You are standing on it!'); else inShip(function () { SIM.flyToStation(); }); });
  }

  const mcan = $('map-canvas'), mctx = mcan.getContext('2d');
  const mu = new V3(), mv = new V3(), mrel = new V3();
  const fontD = getComputedStyle(document.documentElement).getPropertyValue('--display'), fontM = getComputedStyle(document.documentElement).getPropertyValue('--mono');
  function drawMap() {
    const st = $('w-map'), w = st.clientWidth, h = st.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!w || !h) return;
    if (mcan.width !== Math.round(w * dpr) || mcan.height !== Math.round(h * dpr)) { mcan.width = Math.round(w * dpr); mcan.height = Math.round(h * dpr); }
    const ctx = mctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const sheet = !$('w-info').hidden && SIM.W <= 900 && SIM.H > 480;
    const cx = w / 2, cy = sheet ? h * 0.2 : h / 2, Rpx = Math.max(50, Math.min(w / 2, sheet ? h * 0.2 : h / 2) - 30);
    const items = WP.items; items.length = 0;
    let rmax, pw, centre, P;
    const shipAbs = tA.copy(SIM.cam.body.pos).add(SIM.cam.rel);
    const ring = function (r, label) {
      const rp = Rpx * Math.pow(r / rmax, pw);
      ctx.beginPath(); ctx.arc(cx, cy, rp, 0, 6.2832); ctx.strokeStyle = 'rgba(150,180,225,0.10)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.font = '500 11px ' + fontM; ctx.fillStyle = 'rgba(154,171,196,0.75)'; ctx.fillText(label, cx + 4, cy - rp - 3);
    };
    $('map-up').hidden = WP.view === 'sun';
    if (WP.view === 'sun') {
      rmax = 100 * AU; pw = 0.38; centre = sun;
      P = function (v) { const r = Math.hypot(v.x, v.z); if (r < 1) return [cx, cy]; const k = Rpx * Math.pow(Math.min(r, rmax) / rmax, pw) / r; return [cx + v.x * k, cy + v.z * k]; };
      [[1, 'Earth’s distance'], [5, '5×'], [30, '30×'], [100, '100×']].forEach(function (r) { ring(r[0] * AU, r[1]); });
      $('map-note').textContent = 'Seen from above. Where the planets really are today. Tap one to choose it.';
    } else {
      centre = SIM.byId[WP.view];
      rmax = 0; centre.children.forEach(function (c) { rmax = Math.max(rmax, c.a); }); rmax *= 1.12; pw = 0.5;
      const n = centre.pole.clone().multiplyScalar(centre.d.pm && centre.d.pm[1] < 0 ? -1 : 1);
      mu.crossVectors(n, Math.abs(n.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0)).normalize(); mv.crossVectors(n, mu);
      P = function (v) { const x = v.dot(mu), y = -v.dot(mv), r = Math.hypot(x, y); if (r < 1e-6) return [cx, cy]; const k = Rpx * Math.pow(Math.min(r, rmax) / rmax, pw) / r; return [cx + x * k, cy + y * k]; };
      $('map-note').textContent = centre.name + ' and its moons, seen from above. Tap one to choose it.';
    }
    const draw = function (b) {
      const pts = b.orbitPts, n = pts.length / 3; ctx.beginPath();
      for (let i = 0; i <= n; i++) { const o = (i % n) * 3; mrel.set(pts[o], pts[o + 1], pts[o + 2]); const p = P(mrel); if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
      ctx.strokeStyle = b === WP.sel ? 'rgba(255,182,72,0.8)' : 'rgba(150,180,225,0.28)'; ctx.lineWidth = b === WP.sel ? 2 : 1; ctx.stroke();
    };
    const list = WP.view === 'sun' ? SIM.bodies.filter(function (b) { return b.d.type === 'planet' || b.d.type === 'dwarf'; }) : centre.children;
    list.forEach(draw);
    const dot = function (b, p, r) {
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fillStyle = b.d.color; ctx.fill();
      if (b === WP.sel) { ctx.beginPath(); ctx.arc(p[0], p[1], r + 6, 0, 6.2832); ctx.strokeStyle = '#ffb648'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.fillStyle = b === WP.sel ? '#ffb648' : '#eef3fb'; ctx.font = '600 13px ' + fontD;
      ctx.fillText(b.name, p[0] + r + 6, p[1] + 4);
      items.push({ b: b, x: p[0], y: p[1] });
    };
    dot(centre, [cx, cy], WP.view === 'sun' ? 9 : Math.max(8, Rpx * Math.pow(centre.R / rmax, pw)));
    list.forEach(function (b) { mrel.copy(b.pos).sub(centre.pos); dot(b, P(mrel), b.d.gas ? 8 : b.d.type === 'dwarf' ? 4.5 : 6); });
    mrel.copy(shipAbs).sub(centre.pos); const sp = P(mrel);
    ctx.save(); ctx.translate(sp[0], sp[1]); ctx.strokeStyle = '#70e2ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 6.2832); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#70e2ff'; ctx.font = '600 11px ' + fontM; ctx.fillText('YOU', sp[0] + 11, sp[1] - 9);
    if (WP.sel) { const it = items.filter(function (i) { return i.b === WP.sel; })[0]; if (it) { ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.moveTo(sp[0], sp[1]); ctx.lineTo(it.x, it.y); ctx.strokeStyle = 'rgba(255,182,72,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); } }
  }
  mcan.addEventListener('click', function (e) {
    const r = mcan.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 34;
    WP.items.forEach(function (i) { const d = Math.hypot(i.x - x, i.y - y); if (d < bd) { bd = d; best = i.b; } });
    if (best) selectWorld(best);
  });

  // ---------- labels on bodies
  const order = [];
  SIM.bodies.forEach(function (b) {
    const el = document.createElement('div'); el.className = 'lbl' + (b.d.type === 'moon' ? ' moon' : ''); el.hidden = true;
    const n = document.createElement('span'); n.textContent = b.name; const d = document.createElement('i'); el.appendChild(n); el.appendChild(d);
    el.addEventListener('click', function () { if (!started) return; openOverlay('worlds'); openWorlds(b); });
    $('labels').appendChild(el); b.lbl = el; b.lblDist = d; b.lblW = 34 + b.name.length * 8 + 66; order.push(b);
  });
  const lv = new V3(), boxes = [];
  function hiddenBy(b, occ) {
    if (!occ || occ === b) return false;
    const t = occ.rel.dot(lv.copy(b.rel).divideScalar(b.dist));
    if (t <= 0 || t >= b.dist) return false;
    return occ.dist * occ.dist - t * t < occ.R * occ.R * 0.996;
  }
  function pri(b) { const cb = SIM.cam.body; return b === SIM.target ? 0 : (b.parent === cb || b === cb.parent || b === cb) ? 1 : b.d.type === 'star' ? 2 : b.d.type === 'planet' ? 3 : b.d.type === 'dwarf' ? 4 : 5; }
  function updateLabels(text) {
    const cb = SIM.cam.body, W = SIM.W, H = SIM.H, S = SIM.sky, daySky = S.alpha * S.day > 0.6, small = W < 640;
    order.sort(function (a, b) { return pri(a) - pri(b) || a.dist - b.dist; });
    boxes.length = 0;
    for (let i = 0; i < order.length; i++) {
      const b = order[i], isT = b === SIM.target;
      let show = started && !overlayOpen();
      if (show && b === cb && b.px > 70) show = false;
      if (show && !isT && b.d.type === 'moon' && b !== cb && b.parent.dist > b.a * 70) show = false;
      if (show && !isT && daySky) show = false;
      if (show && !isT && b.d.type === 'dwarf' && b.dist > 6 * AU) show = false;
      if (show && !isT && small && pri(b) > 3) show = false;
      if (show && b.px > H * 0.45) show = false;
      if (show && (hiddenBy(b, cb) || (cb.parent && cb.parent !== sun && hiddenBy(b, cb.parent)) || (b.parent && b.parent !== sun && hiddenBy(b, b.parent)))) show = false;
      let x = 0, y = 0;
      if (show) {
        lv.copy(b.rel).project(SIM.camera);
        if (lv.z > 1 || lv.z < -1 || Math.abs(lv.x) > 1.02 || Math.abs(lv.y) > 1.02) show = false;
        else { const off = Math.min(b.px, 300) * 0.72 + 5; x = (lv.x * 0.5 + 0.5) * W + off; y = (-lv.y * 0.5 + 0.5) * H - off - 8; }
      }
      if (show && !isT) { for (let k = 0; k < boxes.length; k++) { const q = boxes[k]; if (x < q[0] + q[2] && x + b.lblW > q[0] && Math.abs(y - q[1]) < 20) { show = false; break; } } }
      if (show) {
        boxes.push([x, y, b.lblW]);
        b.lbl.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        if (text) { b.lblDist.textContent = SIM.fmtDist(Math.max(0, b.dist - b.R)); b.lbl.classList.toggle('tg', isT); }
      }
      if (b.lbl.hidden === show) b.lbl.hidden = !show;
    }
  }

  // ---------- markers: samples and the way back to the ship
  const marks = [];
  for (let i = 0; i < 9; i++) { const el = document.createElement('div'); el.className = 'mk'; el.hidden = true; $('markers').appendChild(el); marks.push(el); }
  const shipMk = document.createElement('div'); shipMk.className = 'mk ship'; shipMk.hidden = true; $('markers').appendChild(shipMk);
  const stLbl = document.createElement('div'); stLbl.className = 'lbl tg'; stLbl.hidden = true; stLbl.innerHTML = '<span>Space station</span><i></i>'; $('labels').appendChild(stLbl); const stLblD = stLbl.querySelector('i');
  stLbl.addEventListener('click', function () { if (SIM.station.d < 2) SIM.dock(); else SIM.flyToStation(); });
  const campMk = document.createElement('div'); campMk.className = 'mk ship'; campMk.hidden = true; $('markers').appendChild(campMk);
  const mk = new V3(); let showCamp = false;
  function updateMarkers(text) {
    let n = 0, showShip = false;
    if (SIM.mode === 'foot' && started && !overlayOpen()) {
      const b = player.body, mats = b.d.materials || [];
      for (let i = 0; i < SIM.nearSamples.length && n < marks.length; i++) {
        const s = SIM.nearSamples[i], d = s.p.distanceTo(player.p);
        if (d > (player.scan ? 0.12 : 0.06)) continue;
        mk.copy(s.p).applyQuaternion(b.q).sub(SIM.cam.rel).project(SIM.camera);
        if (mk.z > 1 || mk.z < -1 || Math.abs(mk.x) > 1 || Math.abs(mk.y) > 1) continue;
        const el = marks[n++];
        el.style.transform = 'translate(' + ((mk.x * 0.5 + 0.5) * SIM.W - 5).toFixed(1) + 'px,' + ((-mk.y * 0.5 + 0.5) * SIM.H - 26).toFixed(1) + 'px)';
        if (text) el.textContent = SIM.fmtDist(d) + (player.scan && mats[s.mat] ? ' · ' + mats[s.mat].n : '');
        el.hidden = false;
      }
      const cm = S.camps[b.id]; showCamp = false;
      if (cm) { const dc = SIM.campDist(); if (dc > 0.02) { mk.set(cm.x, cm.y, cm.z).multiplyScalar(player.p.length()).applyQuaternion(b.q).sub(SIM.cam.rel).project(SIM.camera); if (mk.z < 1 && mk.z > -1) { const x = Math.max(-0.9, Math.min(0.9, mk.x)), y = Math.max(-0.8, Math.min(0.8, mk.y)); campMk.style.transform = 'translate(' + ((x * 0.5 + 0.5) * SIM.W - 5).toFixed(1) + 'px,' + ((-y * 0.5 + 0.5) * SIM.H - 30).toFixed(1) + 'px)'; if (text) campMk.textContent = 'Camp · ' + SIM.fmtDist(dc); showCamp = true; } } }
      const ds = player.p.distanceTo(ship.p);
      if (ds > 0.03) {
        mk.copy(ship.p).applyQuaternion(b.q).sub(SIM.cam.rel).project(SIM.camera);
        if (mk.z < 1 && mk.z > -1) {
          const x = Math.max(-0.9, Math.min(0.9, mk.x)), y = Math.max(-0.8, Math.min(0.8, mk.y));
          shipMk.style.transform = 'translate(' + ((x * 0.5 + 0.5) * SIM.W - 5).toFixed(1) + 'px,' + ((-y * 0.5 + 0.5) * SIM.H - 30).toFixed(1) + 'px)';
          if (text) shipMk.textContent = 'Ship · ' + SIM.fmtDist(ds);
          showShip = true;
        }
      }
    }
    for (let i = n; i < marks.length; i++) if (!marks[i].hidden) marks[i].hidden = true;
    if (shipMk.hidden === showShip) shipMk.hidden = !showShip;
    let showSt = false; const stn = SIM.station;
    if (started && stn.n && SIM.mode === 'ship' && !ship.docked && !overlayOpen() && stn.model.visible && stn.d > 0.25) {
      mk.copy(stn.model.position).project(SIM.camera);
      if (mk.z < 1 && mk.z > -1 && Math.abs(mk.x) < 1 && Math.abs(mk.y) < 1) { stLbl.style.transform = 'translate(' + ((mk.x * 0.5 + 0.5) * SIM.W + 10).toFixed(1) + 'px,' + ((-mk.y * 0.5 + 0.5) * SIM.H - 26).toFixed(1) + 'px)'; if (text) stLblD.textContent = isFinite(stn.d) ? SIM.fmtDist(stn.d) : ''; showSt = true; }
    }
    if (stLbl.hidden === showSt) stLbl.hidden = !showSt;
    if (SIM.mode !== 'foot' || !started || overlayOpen()) showCamp = false;
    if (campMk.hidden === showCamp) campMk.hidden = !showCamp;
  }

  // ---------- HUD text
  const HINTS = {
    landed: [['L', 'launch'], ['E', 'get out'], ['M', 'choose a world'], ['H', 'help']],
    fly: [['Arrows', 'steer'], ['Space', 'fly forward'], ['Shift', 'faster'], ['L', 'land'], ['M', 'choose a world'], ['T', 'scan'], ['P', 'probe (gas planets)']],
    seq: [['Esc', 'stop and fly by hand']],
    docked: [['E', 'go outside'], ['L', 'undock'], ['M', 'choose a world']],
    deck: [['Arrows', 'walk'], ['Mouse', 'drag to look'], ['Space', 'float up'], ['T', 'telescope'], ['E', 'back inside']],
    foot: [['Arrows', 'walk'], ['Mouse', 'drag to look'], ['Space', 'jump'], ['T', 'scan ground'], ['F', 'pick up'], ['N', 'binoculars'], ['C', 'camp'], ['E', 'back to ship']]
  };
  let hintKey = '';
  const pr = new V3(), qInv = new THREE.Quaternion();
  function updateHUD() {
    if (SIM.mode === 'deck' || (ship.docked && !ship.seq)) {
      $('st-body').textContent = 'Space station';
      $('st-sub').textContent = SIM.mode !== 'deck' ? 'Docked' : SIM.deck.scope ? 'Looking through the ZetaQ telescope' : 'On the sky deck';
      $('st-alt').textContent = '420 km'; $('st-spd').textContent = '27,600 km/h';
      const hk2 = SIM.mode === 'deck' ? 'deck' : 'docked';
      if (hk2 !== hintKey) { hintKey = hk2; $('hint').innerHTML = HINTS[hk2].map(function (h) { return '<span><b>' + h[0] + '</b>' + h[1] + '</span>'; }).join(''); }
      updateActions(); return;
    }
    const foot = SIM.mode === 'foot', b = foot ? player.body : ship.body;
    if (foot) pr.copy(player.p); else { pr.copy(ship.p); if (!ship.rot) pr.applyQuaternion(qInv.copy(b.q).invert()); }
    const r = pr.length();
    let alt = foot ? player.alt : ship.alt, title = b.name, sub;
    if (b.d.gas || b === sun) alt = r - SIM.surfR(b, pr.y / r);
    const site = SIM.site && SIM.site.body === b && pr.clone().normalize().distanceTo(SIM.site.dir) < 0.02 / Math.max(1, b.R / 500) ? SIM.site.name : '';
    if (b === sun && r > sun.R * 40) { title = 'Deep space'; sub = (r / AU).toFixed(2) + ' × Earth’s distance from the Sun'; }
    else if (b === sun) sub = 'Close to the Sun';
    else if (foot) sub = 'Walking' + (site ? ' at ' + site : ' on the surface');
    else if (ship.landed) sub = (b.id === 'earth' && pr.clone().normalize().distanceTo(SIM.KSC) < 0.001) ? 'On the launch pad, Kennedy Space Center' : ship.water ? 'Floating on the sea' : 'Landed' + (site ? ' at ' + site : '');
    else if (ship.seq && ship.seq.type === 'warp') { title = 'Flying to ' + ship.seq.target.name; sub = 'Autopilot'; }
    else if (b.d.gas) sub = alt < 0 ? 'Inside the clouds' : 'Above the cloud tops';
    else if (SIM.station.d < 3) sub = 'At your space station';
    else if (alt < b.R * 0.05) sub = 'Flying low over the ground';
    else sub = 'In space near ' + b.name;
    $('st-body').textContent = title; $('st-sub').textContent = sub;
    $('st-alt').textContent = (b.d.gas && alt < 0 ? '−' : '') + SIM.fmtDist(Math.abs(alt));
    $('st-spd').textContent = SIM.fmtSpeed(foot ? player.speed : ship.speed);
    const hk = foot ? 'foot' : ship.seq && ship.seq.type !== 'settle' ? 'seq' : ship.landed ? 'landed' : 'fly';
    if (hk !== hintKey) { hintKey = hk; $('hint').innerHTML = HINTS[hk].map(function (h) { return '<span><b>' + h[0] + '</b>' + h[1] + '</span>'; }).join(''); }
    if (ship.seq && ship.seq.type === 'warp' && ship.seq.t > ship.seq.Ta) SIM.banner('');
    updateActions();
  }

  // ---------- game events
  SIM.onMode = function () {
    $('suitp').hidden = true; $('scanp').hidden = true; actSig = ''; toolsOpen = false; setBino(false);
    if (SIM.mode === 'deck' && !S.visited.deck) { S.visited.deck = 1; logAdd('Walked on the sky deck of the space station.'); reward(60, 0, 'First space walk on your station!'); }
    if (SIM.mode !== 'deck') { $('bino').classList.remove('scope'); if (!binoOn) $('bino').hidden = true; }
    if (SIM.mode === 'foot') {
      justLanded = false; const id = player.body.id;
      if (!S.walked[id]) { S.walked[id] = 1; S.landed[id] = 1; S.visited[id] = 1; logAdd('First steps on ' + player.body.name + '.'); reward(20, 0); }
      checkMissions();
    }
  };
  SIM.onOrbit = function (b) { if (!S.launched) { S.launched = 1; logAdd('Launched into space from ' + b.name + '.'); reward(20, 0, 'First launch!'); } checkMissions(); };
  function visit(t) { if (!S.visited[t.id]) { S.visited[t.id] = 1; logAdd('Arrived at ' + t.name + '.'); reward(40, 0, 'New world: ' + t.name + '!'); } }
  SIM.onArrive = function (t) { S.launched = 1; visit(t); save(); checkWorld(t); checkMissions(); SIM.target = null; };
  SIM.onLand = function (b) {
    // arriving in the dark is no fun: skip the clock ahead to morning at the landing site
    if (started && SIM.sunHere() < 0.08) setTimeout(function () { if (ship.landed && !ship.seq && SIM.sunHere() < 0.08) fade(function () { if (SIM.makeDay()) SIM.say('It was night here, so the clock skipped ahead to daytime.', 5000); }); }, 900);
    justLanded = true;
    if (!(b.id === 'earth' && !S.launched)) {
      S.visited[b.id] = S.visited[b.id] || 1;
      if (!S.landed[b.id]) { S.landed[b.id] = 1; logAdd('Landed on ' + b.name + (SIM.site && SIM.site.body === b ? ' at ' + SIM.site.name : '') + '.'); reward(60, 0, 'First landing on ' + b.name + '!'); }
    }
    save(); checkWorld(b); checkMissions();
  };
  SIM.onCamp = function (b, what) {
    if (what === 'built') { logAdd('Set up camp on ' + b.name + '.'); reward(30, 0); }
    else { const c = Math.round(50 * worth(b)); logAdd('Camp ' + b.name + ' switched on.'); reward(80, c, 'Camp online!'); }
    actSig = ''; checkWorld(b); checkMissions();
  };
  SIM.onDock = function () { actSig = ''; if (!S.visited.dock) { S.visited.dock = 1; logAdd('Docked with the space station.'); reward(40, 0, 'First docking!'); } checkMissions(); };
  SIM.onScope = function (on) {
    $('bino').hidden = !on; $('bino').classList.toggle('scope', on); actSig = '';
    if (!on) return;
    const t = SIM.deck.target, k = 'tel_' + t.id; fillBino();
    if (!S.visited[k]) { S.visited[k] = 1; logAdd('Looked at ' + t.name + ' through the ZetaQ telescope.'); reward(10, 0); }
  };
  SIM.onStation = function () { if (!S.visited.station) { S.visited.station = 1; logAdd('Visited the space station.'); reward(30, 0); } };
  function onScanned(b) { SIM.scanned[b.id] = 1; if (!S.scanned[b.id]) { S.scanned[b.id] = 1; logAdd('Scanned ' + b.name + '.'); reward(20, 0); } checkWorld(b); checkMissions(); }
  // gas-giant probe: live readings while it falls, then the result
  const WIND = { jupiter: 540, saturn: 1800, uranus: 900, neptune: 2100 };
  SIM.onProbe = function (b, what) {
    if (what === 'start') { $('probep').hidden = false; $('probe-title').textContent = b.name + ' probe'; SIM.say('Probe away! Watch it fall into ' + b.name + '.', 4000); fillProbe(); return; }
    sfx('lost');
    const first = !S.probes[b.id], c = Math.round(150 * worth(b) / 2);
    S.probes[b.id] = 1; logAdd('Probe sent into ' + b.name + ': lost at 22 bar.');
    setTimeout(function () { $('probep').hidden = true; }, 5000);
    if (first) reward(100, c, 'Probe data received!'); else save();
    checkWorld(b); checkMissions(); actSig = '';
  };
  function fillProbe() {
    const p = SIM.probe; if (!p) return;
    const b = p.body, u = p.t / p.T, T1 = b.d.temp.mean, H = b.d.atm.H;
    let h;
    if (u < 0.42) h = '<p>Falling towards the cloud tops…</p>' + kv([['Distance to clouds', SIM.fmtDist(p.alt * (1 - Math.pow(u / 0.42, 2)))], ['Heat shield', u > 0.3 ? 'Glowing!' : 'Ready']]);
    else {
      const v = Math.min(1, (u - 0.42) / 0.5), P = 0.1 * Math.pow(220, v), T = T1 * Math.pow(P, P > 1 ? 0.29 : 0.1), depth = H * Math.log(P / 0.1) * (0.7 + 0.3 * v);
      const w = (WIND[b.id] || 600) * (0.55 + 0.45 * Math.abs(Math.sin(v * 9)));
      h = '<p>' + (v >= 1 ? '<b style="color:var(--danger)">Signal lost.</b> The probe was crushed and melted by ' + b.name + '’s deep atmosphere.' : 'Parachute open. Sinking through the clouds…') + '</p>' +
        kv([['Depth below cloud tops', num(depth) + ' km'], ['Pressure', P.toFixed(P < 10 ? 1 : 0) + ' bar (' + P.toFixed(P < 10 ? 1 : 0) + '× Earth’s air)'], ['Temperature', num(T - 273.15) + ' °C'], ['Wind', num(w) + ' km/h']]) +
        '<div class="bars" style="grid-template-columns:1fr"><i><u style="width:' + Math.round(v * 100) + '%;background:' + (v > 0.8 ? 'var(--danger)' : 'var(--cyan)') + '"></u></i></div>';
      if (v < 1 && Math.random() < 0.5) sfx('tele');
    }
    $('probe-body').innerHTML = h;
  }
  // binoculars
  let binoOn = false;
  function setBino(on) {
    if (on === binoOn) return; binoOn = on; SIM.zoomFov = on ? 9 : 0; $('bino').hidden = !on; actSig = ''; if (started) sfx('bino');
    if (on) SIM.say('Binoculars! Drag to look around. Point at a planet, a moon or your ship.', 4000);
  }
  const bf = new V3();
  function fillBino() {
    if (SIM.mode === 'deck') { const d = SIM.deck, t = d.target; if (!d.scope || !t) return; $('bino-txt').textContent = t.name + ' · ' + SIM.fmtDist(Math.max(0, (d.dist || 0) - t.R)) + ' away' + (d.blocked ? ' · Earth is in the way right now, try another world' : SIM.zoomFov <= 0.00151 ? ' · too far to see details, even with this telescope' : ''); return; }
    bf.set(0, 0, -1).applyQuaternion(SIM.cam.q);
    let best = null, bs = 0.03;
    for (let i = 0; i < SIM.bodies.length; i++) {
      const b = SIM.bodies[i]; if (b === SIM.cam.body) continue;
      const c = b.rel.dot(bf) / b.dist; if (c <= 0) continue;
      const sep = Math.acos(Math.min(1, c)) - Math.asin(Math.min(1, b.R / b.dist));
      if (sep < bs) { bs = sep; best = b; }
    }
    $('bino-txt').textContent = best ? best.name + ' · ' + SIM.fmtDist(Math.max(0, best.dist - best.R)) + ' away' : 'Point at something in the sky';
  }

  // ---------- start
  $('s1').insertAdjacentHTML('afterbegin', icon('rocket')); $('s2').insertAdjacentHTML('afterbegin', icon('astro')); $('s3').insertAdjacentHTML('afterbegin', icon('gem'));
  $('start-note').textContent = app.classList.contains('touch') ? 'Use the stick on the left and the big buttons on the right. Turning your phone sideways gives the best view.' : 'Arrow keys steer, Space flies forward. Press H any time for help.';
  $('name-in').value = S.name || '';
  const bootT = performance.now();
  function checkReady() {
    const e = SIM.byId.earth, ok = SIM.frames > 8 && e.tx === 2 && SIM.loading === 0 && (!SIM.hasDEM(e) || e.demState >= 2);
    if (ok || performance.now() - bootT > 20000) { const sb = $('start-btn'); sb.disabled = false; sb.innerHTML = icon('rocket') + 'Play'; $('load').hidden = true; if (location.hash.indexOf('play') >= 0) begin(); return; }
    setTimeout(checkReady, 200);
  }
  checkReady();
  function begin() {
    if (started) return;
    started = true; $('start').hidden = true; $('hud').hidden = false; $('mission').hidden = false; canvas.focus();
    const nm = ($('name-in').value || '').replace(/[<>&"]/g, '').trim().slice(0, 16); if (nm) S.name = nm; save(); refreshProfile();
    if (SIM.audio) SIM.audio.start();
    if (!S.log.length) logAdd((S.name || 'A new explorer') + ' reported for duty at Kennedy Space Center.');
    fillMenu(); checkMissions(); warp(0);
    SIM.say('Welcome, ' + titleOf(levelOf(S.xp)) + (S.name ? ' ' + S.name : '') + '! Press the big Launch button.', 8000);
  }
  SIM.begin = begin;

  // ---------- debug / test hooks
  SIM.debug = {
    orbit: function (id, alt) { const b = SIM.byId[id]; SIM.mode = 'ship'; SIM.placeOrbit(b, alt == null ? b.R * 2.2 : alt); actSig = ''; },
    land: function (id, lat, lon) { const b = SIM.byId[id]; SIM.mode = 'ship'; SIM.placeLanded(b, SIM.latLonDir(lat || 0, lon || 0)); actSig = ''; },
    site: function (id, i) { const b = SIM.byId[id], s = b.d.sites[i || 0]; SIM.mode = 'ship'; SIM.placeLanded(b, SIM.latLonDir(s.lat, s.lon)); SIM.site = { body: b, dir: SIM.latLonDir(s.lat, s.lon), name: s.name }; return SIM.makeDay(); },
    foot: function () { SIM.exitShip(); },
    landDay: function (id, zen, turn) {
      const b = SIM.byId[id], q = b.q.clone().invert(), s = b.sunDir.clone().applyQuaternion(q), ax = new V3().crossVectors(s, Math.abs(s.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0)).normalize();
      const d = s.clone().applyAxisAngle(ax, (zen == null ? 50 : zen) * D2R).applyAxisAngle(s, (turn || 0) * D2R);
      SIM.mode = 'ship'; SIM.placeLanded(b, d);
    },
    fps: function () { const f0 = SIM.frames, t0 = performance.now(); return new Promise(function (r) { setTimeout(function () { r(Math.round((SIM.frames - f0) / ((performance.now() - t0) / 1000))); }, 2000); }); },
    prog: function () { return S; }, give: function (c, x) { reward(x || 0, c || 0); }
  };

  // ---------- main loop
  let pillClock = 0, slow = 0, err = false, avg = 1 / 60, prClock = 0, upOK = 0, prLock = 0, lastUp = -1e9;
  function frame(now) {
    requestAnimationFrame(frame);
    if (err) return;
    let dt = (now - lastT) / 1000; lastT = now; if (!(dt > 0)) dt = 0.001; if (dt > 0.1) dt = 0.1;
    try {
      SIM.t += dt * SIM.warp / 86400;
      SIM.updateBodies(SIM.t);
      SIM.update(dt);
      SIM.renderFrame(now / 1000);
      slow += dt; const text = slow > 0.12; if (text) slow = 0;
      updateLabels(text); updateMarkers(text);
      if (text && started) {
        updateHUD();
        if (SIM.probe) fillProbe();
        if (binoOn || (SIM.mode === 'deck' && SIM.deck.scope)) fillBino();
        if (++pillClock >= 8) { pillClock = 0; checkMissions(); }
        if (SIM.mode === 'foot' && player.scan) { suitClock -= 0.12; if (suitClock <= 0) { suitClock = 0.6; fillSuit(); } }
      }
      if (!$('worlds').hidden && WP.tab === 'map') drawMap();
      // adaptive resolution (ignore frames spent building terrain)
      if (!(SIM.lod && SIM.lod.lod.pending > 0)) avg += (dt - avg) * 0.08;
      prClock += dt;
      if (prClock > 0.6 && document.visibilityState !== 'hidden') {
        prClock = 0;
        // step the resolution down quickly when frames are slow, but back up only after a long calm spell, so it cannot flip-flop
        if (avg > 1 / 43) { SIM.setPixelRatio(SIM.pr * (avg > 1 / 26 ? 0.75 : 0.88)); upOK = 0; prLock = now + (now - lastUp < 20000 ? 120000 : 30000); }
        else if (avg < 1 / 57 && SIM.pr < SIM.maxPR && now > prLock) { if (++upOK >= 10) { upOK = 0; lastUp = now; SIM.setPixelRatio(SIM.pr * 1.1); } }
        else upOK = 0;
      }
      SIM.frames = (SIM.frames || 0) + 1;
    } catch (e) { err = true; SIM.error = String(e && e.stack || e); console.error(e); const f = $('fail'); f.hidden = false; f.textContent = 'Oops, the game hit an error and stopped: ' + (e && e.message || e); }
  }
  requestAnimationFrame(frame);
})();
