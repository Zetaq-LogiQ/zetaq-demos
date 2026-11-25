/* Solar System Explorer — sound. Everything is synthesised with Web Audio (no audio files):
   slow ambient music (pad chords, soft bells through an echo) and short effects for the game's events. */
(function () {
  'use strict';
  const SIM = window.SIM; if (!SIM || SIM.failed) return;
  const A = SIM.audio = { music: true, sfx: true, ready: false };
  try { const p = JSON.parse(localStorage.getItem('sse_audio') || 'null'); if (p) { A.music = p.music !== false; A.sfx = p.sfx !== false; } } catch (e) {}
  const save = function () { try { localStorage.setItem('sse_audio', JSON.stringify({ music: A.music, sfx: A.sfx })); } catch (e) {} };
  let ctx = null, master, musicBus, sfxBus, echo, noiseBuf, engGain, engFilter, engHum, engHumGain, timer = 0;
  const f = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = A.music ? 0.5 : 0; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = A.sfx ? 0.8 : 0; sfxBus.connect(master);
    // echo for the bells
    echo = ctx.createDelay(1.5); echo.delayTime.value = 0.46;
    const fb = ctx.createGain(); fb.gain.value = 0.46; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(musicBus);
    // noise for engines, whooshes and thuds
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.04 * w) / 1.04; d[i] = last * 3.2 + w * 0.12; }
    // continuous engine: filtered noise + low hum, silent until the ship thrusts
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 200;
    engGain = ctx.createGain(); engGain.gain.value = 0; src.connect(engFilter); engFilter.connect(engGain); engGain.connect(sfxBus); src.start();
    engHum = ctx.createOscillator(); engHum.type = 'sawtooth'; engHum.frequency.value = 48;
    const hlp = ctx.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 140;
    engHumGain = ctx.createGain(); engHumGain.gain.value = 0; engHum.connect(hlp); hlp.connect(engHumGain); engHumGain.connect(sfxBus); engHum.start();
    A.ready = true;
    return true;
  }

  // ---------------- music
  const CHORDS = [[50, 57, 60, 64, 65], [46, 53, 57, 62, 65], [41, 48, 57, 60, 64], [48, 55, 57, 62, 64], [50, 57, 60, 64, 67], [43, 50, 58, 62, 65], [46, 53, 58, 62, 69], [45, 52, 57, 60, 64]];
  const CH = 9.5; let nextChord = 0, chordI = 0, nextBell = 0;
  function pad(midi, t, dur, vol) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700 + 500 * Math.random();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 3.2); g.gain.setValueAtTime(vol, t + dur - 1); g.gain.linearRampToValueAtTime(0, t + dur + 3.5);
    [['sine', 0], ['triangle', 7], ['sine', -6]].forEach(function (o) {
      const os = ctx.createOscillator(); os.type = o[0]; os.frequency.value = f(midi); os.detune.value = o[1];
      os.connect(lp); os.start(t); os.stop(t + dur + 3.6);
    });
    lp.connect(g); g.connect(musicBus);
  }
  function bell(midi, t, vol) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0008, t + 3.2);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f(midi);
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f(midi) * 2.01; const g2 = ctx.createGain(); g2.gain.value = 0.22;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicBus); g.connect(echo);
    o1.start(t); o2.start(t); o1.stop(t + 3.3); o2.stop(t + 3.3);
  }
  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (nextChord < now) { nextChord = now + 0.2; nextBell = now + 3; }
    while (nextChord < now + 1.2) {
      const c = CHORDS[chordI % CHORDS.length]; chordI++;
      pad(c[0] - 12, nextChord, CH, 0.085);
      for (let i = 0; i < c.length; i++) pad(c[i], nextChord + i * 0.35, CH - i * 0.35, 0.03);
      nextChord += CH;
    }
    while (nextBell < now + 1.2) {
      const c = CHORDS[(chordI + CHORDS.length - 1) % CHORDS.length];
      const n = c[1 + Math.floor(Math.random() * (c.length - 1))] + (Math.random() < 0.6 ? 12 : 24);
      bell(n, nextBell, 0.045 + 0.03 * Math.random());
      if (Math.random() < 0.3) bell(n + (Math.random() < 0.5 ? 7 : 5), nextBell + 0.23, 0.03);
      nextBell += 1.1 + Math.random() * 2.6;
    }
  }

  // ---------------- effects
  function tone(type, f0, f1, t, dur, vol, dest) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, type, f0, f1, q) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q || 0.8; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.08, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  const notes = function (list, type, step, dur, vol) { const t = ctx.currentTime; list.forEach(function (m, i) { tone(type, f(m), f(m), t + i * step, dur, vol); }); };
  const FX = {
    click: function (t) { tone('sine', 620, 880, t, 0.07, 0.12); },
    beep: function (t) { tone('square', 880, 880, t, 0.12, 0.06); },
    go: function (t) { tone('square', 1320, 1320, t, 0.45, 0.07); },
    land: function (t) { noise(t, 0.6, 0.5, 'lowpass', 260, 60); tone('sine', 70, 38, t, 0.5, 0.4); },
    step: function (t) { noise(t, 0.09, 0.07, 'lowpass', 380, 150); },
    jump: function (t) { tone('sine', 220, 520, t, 0.18, 0.1); },
    pick: function () { notes([84, 88, 91, 96], 'sine', 0.07, 0.5, 0.14); },
    scan: function (t) { tone('sine', 380, 1700, t, 0.7, 0.09); tone('sine', 1700, 1700, t + 0.72, 0.18, 0.08); },
    ping: function (t) { tone('sine', 1200, 1180, t, 0.9, 0.08); },
    coin: function () { notes([83, 88], 'square', 0.08, 0.3, 0.07); notes([95], 'sine', 0.16, 0.5, 0.06); },
    level: function () { notes([72, 76, 79, 84, 88], 'triangle', 0.13, 0.7, 0.16); },
    mission: function () { notes([67, 72, 76, 79], 'triangle', 0.11, 0.9, 0.13); },
    warp: function (t) { noise(t, 3.2, 0.3, 'bandpass', 260, 3400, 1.4); noise(t + 3, 2.4, 0.22, 'bandpass', 3400, 180, 1.2); },
    build: function (t) { for (let i = 0; i < 4; i++) { noise(t + i * 0.16, 0.07, 0.22, 'bandpass', 1900, 900, 4); } notes([76, 79, 84], 'sine', 0.12, 0.5, 0.0001); tone('sine', f(84), f(84), t + 0.75, 0.6, 0.12); },
    on: function () { notes([60, 67, 72, 79], 'sine', 0.16, 1.2, 0.12); },
    probe: function (t) { tone('sine', 900, 300, t, 0.9, 0.1); noise(t, 1.2, 0.2, 'bandpass', 2000, 400, 1); },
    tele: function (t) { tone('sine', 1500, 1500, t, 0.06, 0.05); },
    lost: function (t) { noise(t, 0.9, 0.3, 'highpass', 1500, 4000); tone('sawtooth', 300, 60, t, 0.7, 0.08); },
    bino: function (t) { noise(t, 0.05, 0.2, 'bandpass', 2600, 1800, 5); tone('sine', 1500, 1900, t + 0.04, 0.06, 0.05); },
    no: function (t) { tone('sawtooth', 160, 110, t, 0.22, 0.08); },
    open: function (t) { tone('sine', 520, 700, t, 0.09, 0.07); }
  };
  A.sfx = A.sfx; // (kept as the on/off flag; play() is the trigger)
  A.play = function (name) { if (!A.ready || !A.sfx || ctx.state !== 'running' || !FX[name]) return; try { FX[name](ctx.currentTime); } catch (e) {} };
  // continuous engine level: thrust 0..1.5 (main engines), lift 0..1 (landing thrusters)
  A.engine = function (thrust, lift) {
    if (!A.ready || ctx.state !== 'running') return;
    const t = ctx.currentTime, k = Math.min(1.5, thrust) + lift * 0.6;
    engGain.gain.setTargetAtTime(Math.min(0.5, k * 0.3), t, 0.12);
    engFilter.frequency.setTargetAtTime(160 + k * 700, t, 0.15);
    engHumGain.gain.setTargetAtTime(Math.min(0.2, k * 0.12), t, 0.12);
    engHum.frequency.setTargetAtTime(44 + k * 26, t, 0.2);
  };
  A.start = function () {
    if (!ctx && !init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!timer) timer = setInterval(schedule, 400);
  };
  A.setMusic = function (on) { A.music = on; save(); if (A.ready) musicBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.4); };
  A.setSfx = function (on) { A.sfx = on; save(); if (A.ready) sfxBus.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.1); };
  document.addEventListener('visibilitychange', function () { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
  SIM.sfx = function (n) { A.play(n); };
})();
