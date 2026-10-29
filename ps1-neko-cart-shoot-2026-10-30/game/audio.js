// NekoCart 8-bit audio: procedural looping BGM buffers + oscillator SFX (Web Audio)
let A = null, master, bgmGain, sfxGain, noiseBuf, bgmSrc = null, muted = false, curBgm = null;
const bufs = {};
export function initAudio() {
  if (!A) {
    A = new (window.AudioContext || window.webkitAudioContext)();
    master = A.createGain(); master.gain.value = 0.85; master.connect(A.destination);
    bgmGain = A.createGain(); bgmGain.gain.value = 0.3; bgmGain.connect(master);
    sfxGain = A.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    noiseBuf = A.createBuffer(1, A.sampleRate, A.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    bufs.main = renderSong(SONGS.main); bufs.boss = renderSong(SONGS.boss);
  }
  if (A.state !== 'running') A.resume();
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.85; }
export function isMuted() { return muted; }
export function playBgm(name) {
  if (!A) return; stopBgm(); curBgm = name;
  bgmSrc = A.createBufferSource(); bgmSrc.buffer = bufs[name]; bgmSrc.loop = true; bgmSrc.connect(bgmGain); bgmSrc.start();
}
export function stopBgm() { if (bgmSrc) { try { bgmSrc.stop(); } catch (e) { } bgmSrc.disconnect(); bgmSrc = null; } }
function duck() { if (!A) return; const t = A.currentTime; bgmGain.gain.cancelScheduledValues(t); bgmGain.gain.setValueAtTime(0.2, t); bgmGain.gain.linearRampToValueAtTime(0.3, t + 0.25); }

function tone(type, f0, f1, dur, vol, delay = 0) {
  if (!A) return; const t = A.currentTime + delay;
  const o = A.createOscillator(), g = A.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq, ftype = 'bandpass', delay = 0, q = 1) {
  if (!A) return; const t = A.currentTime + delay;
  const s = A.createBufferSource(); s.buffer = noiseBuf; const f = A.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q;
  const g = A.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
function nya(p = 1, vol = 0.2, delay = 0) {
  if (!A) return; const t = A.currentTime + delay;
  const o = A.createOscillator(), f = A.createBiquadFilter(), g = A.createGain(); o.type = 'square';
  o.frequency.setValueAtTime(520 * p, t); o.frequency.linearRampToValueAtTime(900 * p, t + 0.07); o.frequency.linearRampToValueAtTime(560 * p, t + 0.24);
  f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1800, t + 0.08); f.frequency.linearRampToValueAtTime(1000, t + 0.24); f.Q.value = 2.5;
  g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
  o.connect(f); f.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + 0.3);
}
export const sfx = {
  shoot() { tone('square', 1100, 260, 0.09, 0.22); noise(0.05, 0.25, 3500, 'highpass'); duck(); },
  empty() { tone('square', 1900, 1900, 0.025, 0.12); },
  hit() { tone('triangle', 520, 1100, 0.08, 0.3); },
  head() { tone('square', 988, 988, 0.06, 0.22); tone('square', 1319, 1319, 0.12, 0.22, 0.06); },
  nya(p) { nya(p); },
  pop() { noise(0.12, 0.45, 1600); tone('sine', 380, 80, 0.15, 0.3); },
  ghost() { tone('triangle', 700, 200, 0.35, 0.18); tone('triangle', 710, 210, 0.35, 0.12, 0.03); },
  ding() { tone('square', 1568, 1568, 0.05, 0.15); tone('square', 2093, 2093, 0.1, 0.15, 0.05); },
  heart() { [784, 988, 1175, 1568].forEach((f, i) => tone('square', f, f, 0.08, 0.16, i * 0.06)); },
  hurt() { tone('sawtooth', 320, 70, 0.4, 0.3); noise(0.2, 0.3, 500, 'lowpass'); },
  throw() { tone('triangle', 260, 620, 0.16, 0.14); },
  reload() { // ガチャン: click -> mag out -> seat -> rack
    noise(0.02, 0.3, 4200, 'highpass');
    tone('square', 320, 170, 0.06, 0.16, 0.08); noise(0.05, 0.25, 1800, 'bandpass', 0.08);
    noise(0.07, 0.6, 700, 'lowpass', 0.26); tone('square', 140, 90, 0.06, 0.25, 0.26);
    noise(0.08, 0.35, 2600, 'highpass', 0.42); tone('square', 1500, 900, 0.05, 0.14, 0.42);
  },
  rattle(v = 1) { noise(0.03, 0.05 * v, 650, 'bandpass', 0, 3); },
  section() { [659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.1, 0.14, i * 0.08)); },
  roar() { tone('sawtooth', 140, 45, 0.9, 0.35); noise(0.7, 0.3, 300, 'lowpass'); nya(0.45, 0.25, 0.1); },
  boom() { noise(0.6, 0.6, 400, 'lowpass'); tone('square', 200, 30, 0.6, 0.3); },
  clear() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('square', f, f, i === 6 ? 0.5 : 0.12, 0.18, i * 0.12)); },
  over() { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.98, 0.25, 0.25, i * 0.22)); },
};

// ---- procedural chiptune loops
const SONGS = {
  // cheerful-spooky cart chase in C (16 bars)
  main: { bpm: 152, chords: [[48, 'M'], [45, 'm'], [41, 'M'], [43, 'M'], [48, 'M'], [45, 'm'], [38, 'm'], [43, 'M'], [41, 'M'], [43, 'M'], [40, 'm'], [45, 'm'], [41, 'M'], [43, 'M'], [48, 'M'], [43, 'M']] },
  // boss: minor, faster
  boss: { bpm: 172, minor: true, chords: [[45, 'm'], [41, 'M'], [43, 'M'], [40, 'M'], [45, 'm'], [41, 'M'], [38, 'm'], [40, 'M'], [45, 'm'], [41, 'M'], [43, 'M'], [40, 'M'], [38, 'm'], [41, 'M'], [40, 'M'], [40, 'M']] },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// motifs: 16th steps; values index chord tones [0..] or null=rest, -1 = hold
const MOTIF_A = [0, null, 2, null, 1, 2, null, 3, -1, null, 2, 1, 0, null, 1, null];
const MOTIF_B = [3, -1, 2, null, 1, null, 2, 3, 4, -1, -1, null, 3, 2, 1, null];
const MOTIF_C = [2, 1, 0, 1, 2, null, 2, null, 3, null, 2, null, 0, -1, -1, null];
const MOTIF_END = [4, null, 3, null, 2, null, 1, null, 0, -1, -1, -1, -1, null, null, null];
const BOSS_A = [0, 0, 3, 0, 4, 0, 3, 2, 0, 0, 3, 0, 5, 4, 3, 2];
const BOSS_B = [5, -1, 4, -1, 3, -1, 2, 3, 4, -1, 3, 2, 1, -1, 0, -1];

function renderSong(song) {
  const sr = 22050, spb = 60 / song.bpm, step = spb / 4, bars = song.chords.length;
  const len = Math.round(bars * 16 * step * sr), buf = A.createBuffer(1, len, sr), out = buf.getChannelData(0);
  const add = (t0, dur, f, wave, vol, env = 'pluck') => {
    const s0 = Math.floor(t0 * sr), n = Math.floor(dur * sr); let ph = 0; const inc = f / sr;
    for (let i = 0; i < n; i++) {
      const k = (s0 + i) % len; ph += inc; const p = ph % 1;
      let v = wave === 'pulse' ? (p < 0.25 ? 1 : -1) : wave === 'sq' ? (p < 0.5 ? 1 : -1) : wave === 'tri' ? (4 * Math.abs(p - 0.5) - 1) : 0;
      const tt = i / n; const e = env === 'pluck' ? Math.min(1, i / 60) * (1 - tt * 0.7) * (tt > 0.85 ? (1 - tt) / 0.15 : 1) : (1 - tt);
      out[k] += v * vol * e;
    }
  };
  const nz = (t0, dur, vol, lp) => {
    const s0 = Math.floor(t0 * sr), n = Math.floor(dur * sr); let y = 0;
    for (let i = 0; i < n; i++) { const x = Math.random() * 2 - 1; y = lp ? y + (x - y) * lp : x; out[(s0 + i) % len] += y * vol * Math.pow(1 - i / n, 2); }
  };
  song.chords.forEach(([root, q], b) => {
    const third = q === 'm' ? 3 : 4; const tones = [0, third, 7, 12, 12 + third, 19];
    const bt = b * 16 * step;
    // lead motif
    let mot;
    if (song.minor) mot = b % 4 === 3 ? BOSS_B : BOSS_A;
    else mot = b === bars - 1 ? MOTIF_END : (b % 4 === 3 ? MOTIF_C : (Math.floor(b / 4) % 2 ? MOTIF_B : MOTIF_A));
    for (let i = 0; i < 16; i++) {
      const v = mot[i]; if (v == null || v < 0) continue;
      let L = 1; while (i + L < 16 && mot[i + L] === -1) L++;
      add(bt + i * step, L * step * 0.95, mtof(root + 24 + tones[v]), 'pulse', 0.16);
    }
    // arpeggio (quiet 32nds)
    for (let i = 0; i < 32; i++) add(bt + i * step / 2, step / 2 * 0.9, mtof(root + 36 + tones[i % 3]), 'sq', 0.035);
    // bass: octave pump on 8ths
    for (let i = 0; i < 8; i++) add(bt + i * 2 * step, step * 1.7, mtof(root - 12 + (i % 2 ? 12 : 0)), 'tri', 0.32);
    // drums
    for (let i = 0; i < 16; i++) {
      const t = bt + i * step;
      if (i % 8 === 0 || (song.minor && i % 4 === 0) || i === 10) { add(t, 0.09, 90, 'tri', 0.5, 'dec'); nz(t, 0.03, 0.15, 0.1); }
      if (i % 8 === 4) nz(t, 0.12, 0.3, 0.5);
      if (i % 2 === 0) nz(t, 0.025, 0.08);
    }
  });
  let mx = 0; for (let i = 0; i < len; i++) mx = Math.max(mx, Math.abs(out[i]));
  const k = mx > 0.95 ? 0.95 / mx : 1; for (let i = 0; i < len; i++) out[i] *= k;
  return buf;
}
