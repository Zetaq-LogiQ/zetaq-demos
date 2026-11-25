// music.js - soft generative ambient pad + tiny UI blips, all WebAudio (no files, no voice)
export class Music {
  constructor() { this.ctx = null; this.muted = false; this.started = false; }
  start() {
    if (this.started) { if (this.ctx && this.ctx.state === 'suspended' && !this.muted) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.started = true;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
    const dl = c.createDelay(1.0); dl.delayTime.value = 0.42;
    const fb = c.createGain(); fb.gain.value = 0.33; const wet = c.createGain(); wet.gain.value = 0.3;
    this.bus = c.createGain(); this.bus.connect(lp); lp.connect(this.master);
    this.bus.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(this.master);
    this.master.connect(c.destination);
    if (!this.muted) this.master.gain.linearRampToValueAtTime(0.13, c.currentTime + 3);
    const mt = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const chords = [[57, 60, 64, 71], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 66]];
    const penta = [69, 72, 74, 76, 79, 81, 84];
    let ci = 0, nextChord = c.currentTime + 0.1, nextArp = c.currentTime + 1.5;
    const pad = (f, t, len) => {
      for (const det of [-5, 5]) {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
        const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 2.4);
        g.gain.setValueAtTime(0.05, t + len - 2.5); g.gain.linearRampToValueAtTime(0, t + len + 0.5);
        o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + len + 0.6);
      }
    };
    const pluck = (f, t) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.6);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 1.7);
    };
    this.timer = setInterval(() => {
      const now = c.currentTime;
      while (nextChord < now + 0.5) { chords[ci % 4].forEach((m) => pad(mt(m), nextChord, 8)); ci++; nextChord += 8; }
      while (nextArp < now + 0.5) { if (Math.random() < 0.6) pluck(mt(penta[(Math.random() * penta.length) | 0]), nextArp); nextArp += 0.75; }
    }, 200);
  }
  setMuted(m) {
    this.muted = m;
    if (!this.ctx) { if (!m) this.start(); return; }
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(m ? 0 : 0.13, t + 0.4);
    if (!m && this.ctx.state === 'suspended') this.ctx.resume();
  }
  blip(k = 1) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(1100 * k, t); o.frequency.exponentialRampToValueAtTime(700 * k, t + 0.08);
    const g = c.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.15);
  }
}
