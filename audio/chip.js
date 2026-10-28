// chip.js — tiny dependency-free 8-bit (NES-ish) engine on the Web Audio API.
// Shared by ps1-tps-explore-rpg (game BGM/SFX) and chipdaw-8bit (editor).
//
// SONG JSON (v1)
// {
//   v: 1, title, bpm, rpb: 4 (rows per beat), rows: 32 (rows per pattern), swing: 0..0.5, echo: 0..0.6,
//   meta?: { root: 57, scale: 'minor' }               // optional hint for AI tools
//   instruments: [{ name, wave:'pulse'|'tri'|'saw'|'noise', duty:.125|.25|.5|.75, vol:0..1,
//                   a, d, s, r (seconds / sustain level), vib (cents), vibRate (Hz), vibDelay (s),
//                   slide (semitones over the note), arp:'047' (semitone digits/hex, cycles at 60Hz),
//                   noiseMode:'long'|'short' }],
//   channels: [{ name, inst: 0 }]  // 4 = pulse1, pulse2, triangle, noise (more is OK)
//   patterns: [{ name, ch: [[cell|null x rows] x channels] }],
//   order: [0, 1, 0, 2]            // pattern indices played in sequence
// }
// cell = { n: MIDI note (noise: 0..15 period index, 0 = highest), l: length in rows, v: 1..15, i?: inst override,
//          fx?: { arp?: '037', slide?: semitones, vib?: cents } }
//
// SFX params: { wave, duty, f0, f1 (Hz start/end), dur, a, vol, vib, vibRate, arp:[semitones], arpRate (Hz),
//               noise: 0..1 (noise layer), steps: 0 (pitch quantize steps), repeat: 1, gap: s }

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = n => NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
export const mtof = n => 440 * 2 ** ((n - 69) / 12);
export function parseNote(s) { const m = /^([A-Ga-g])(#|b)?(-?\d)$/.exec(s); if (!m) return null; const b = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1].toUpperCase()]; return b + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12; }
const NOISE_PERIOD = [4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068];
export const noiseHz = i => 1789773 / NOISE_PERIOD[Math.max(0, Math.min(15, i | 0))];

/** Tracker-text line → cells. Tokens: `A4` note, `A4:8` with volume, `NC` noise period (hex), `.` empty, `-` hold previous,
 *  `|` ignored (bar line), `A4@2` instrument override, `A4~037` arpeggio fx, `A4^12` slide. */
export function parseLine(str, rows) {
  const out = []; let last = null;
  for (const tok of str.trim().split(/\s+/)) {
    if (!tok || tok === '|') continue;
    if (tok === '-') { if (last) last.l++; out.push(null); continue; }
    if (tok === '.') { last = null; out.push(null); continue; }
    const m = /^(N[0-9A-Fa-f]|[A-G][#b]?-?\d)(?::(\d+))?(?:@(\d+))?(?:~([0-9a-fA-F]+))?(?:\^(-?\d+))?$/.exec(tok);
    if (!m) { out.push(null); last = null; continue; }
    const n = m[1][0] === 'N' ? parseInt(m[1].slice(1), 16) : parseNote(m[1]);
    const c = { n, l: 1, v: m[2] ? +m[2] : 12 }; if (m[3]) c.i = +m[3];
    if (m[4] || m[5]) { c.fx = {}; if (m[4]) c.fx.arp = m[4]; if (m[5]) c.fx.slide = +m[5]; }
    out.push(c); last = c;
  }
  if (rows) { while (out.length < rows) out.push(null); out.length = rows; }
  return out;
}

// ---------- waveforms (per AudioContext cache)
const cache = new WeakMap();
function tableWave(ctx, tbl) {
  const N = tbl.length, H = N >> 1, re = new Float32Array(H), im = new Float32Array(H);
  for (let k = 1; k < H; k++) { let a = 0, b = 0; for (let j = 0; j < N; j++) { const p = 2 * Math.PI * k * j / N; a += tbl[j] * Math.cos(p); b += tbl[j] * Math.sin(p); } re[k] = a * 2 / N; im[k] = b * 2 / N; }
  return ctx.createPeriodicWave(re, im);
}
function lfsr(len, short) { const out = new Float32Array(len); let r = 1; for (let i = 0; i < len; i++) { const fb = (r & 1) ^ ((r >> (short ? 6 : 1)) & 1); r = (r >> 1) | (fb << 14); out[i] = (r & 1) ? .9 : -.9; } return out; }
function res(ctx) {
  let c = cache.get(ctx); if (c) return c; c = { pulse: {} };
  for (const d of [.125, .25, .5, .75]) c.pulse[d] = tableWave(ctx, Array.from({ length: 64 }, (_, j) => j < d * 64 ? 1 : -1));
  // NES-style 4-bit stepped triangle (32 steps, each doubled)
  c.tri = tableWave(ctx, Array.from({ length: 64 }, (_, j) => { const s = j >> 1; return ((s < 16 ? 15 - s : s - 16) / 7.5) - 1; }));
  c.saw = tableWave(ctx, Array.from({ length: 64 }, (_, j) => ((j >> 2) / 7.5) - 1));
  const mk = (data) => { const b = ctx.createBuffer(1, data.length, ctx.sampleRate); b.copyToChannel(data, 0); return b; };
  c.noiseLong = mk(lfsr(32767 * 2, false)); c.noiseShort = mk(lfsr(93 * 64, true));
  cache.set(ctx, c); return c;
}
const nearestDuty = d => [.125, .25, .5, .75].reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a, .5);
const arpList = s => (typeof s === 'string' ? [...s].map(ch => parseInt(ch, 16)).filter(x => !isNaN(x)) : (s || []));

export const DEFAULT_INST = { name: 'Inst', wave: 'pulse', duty: .5, vol: .5, a: .003, d: .15, s: .55, r: .06, vib: 0, vibRate: 6, vibDelay: .15, slide: 0, arp: '', noiseMode: 'long' };

/** Schedule one note on ctx at time t into dest. dur = gate length (s). */
export function scheduleNote(ctx, dest, instIn, n, t, dur, opt = {}) {
  const inst = { ...DEFAULT_INST, ...instIn }, R = res(ctx), fx = opt.fx || {};
  const vel = (opt.v ?? 12) / 15, peak = Math.max(0, inst.vol * vel * .45);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
  const a = Math.max(.001, inst.a), d = Math.max(.005, inst.d), r = Math.max(.005, inst.r);
  g.gain.linearRampToValueAtTime(peak, t + a);
  const sus = peak * inst.s, tEnd = t + Math.max(dur, a + .01);
  if (t + a + d < tEnd) { g.gain.linearRampToValueAtTime(sus, t + a + d); g.gain.setValueAtTime(sus, tEnd); }
  else g.gain.linearRampToValueAtTime(peak + (sus - peak) * Math.min(1, (tEnd - t - a) / d), tEnd);
  g.gain.linearRampToValueAtTime(0, tEnd + r);
  g.connect(dest);
  let src;
  if (inst.wave === 'noise') {
    src = ctx.createBufferSource(); src.buffer = inst.noiseMode === 'short' ? R.noiseShort : R.noiseLong; src.loop = true;
    src.playbackRate.setValueAtTime(noiseHz(n) / ctx.sampleRate, t);
    const sl = fx.slide ?? inst.slide; if (sl) src.playbackRate.linearRampToValueAtTime(noiseHz(n + sl) / ctx.sampleRate, tEnd);
  } else {
    src = ctx.createOscillator();
    src.setPeriodicWave(inst.wave === 'tri' ? R.tri : inst.wave === 'saw' ? R.saw : R.pulse[nearestDuty(inst.duty)]);
    const f = mtof(n), arp = arpList(fx.arp || inst.arp), sl = fx.slide ?? inst.slide;
    src.frequency.setValueAtTime(f, t);
    if (arp.length > 1) { const st = 1 / 60 * 2; let i = 0; for (let tt = t; tt < tEnd + r; tt += st, i++) src.frequency.setValueAtTime(f * 2 ** (arp[i % arp.length] / 12), tt); }
    else if (sl) src.frequency.exponentialRampToValueAtTime(Math.max(20, f * 2 ** (sl / 12)), tEnd);
    const vib = fx.vib ?? inst.vib;
    if (vib) { const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = inst.vibRate || 6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(vib, t + (inst.vibDelay || 0) + .05); lfo.connect(lg).connect(src.detune); lfo.start(t); lfo.stop(tEnd + r + .05); }
  }
  src.connect(g); src.start(t); src.stop(tEnd + r + .03);
  return src;
}

/** Procedural one-shot. Returns length (s). */
export function scheduleSfx(ctx, dest, p0, t) {
  const p = { wave: 'pulse', duty: .5, f0: 440, f1: 440, dur: .2, a: .002, vol: .5, vib: 0, vibRate: 12, arp: [], arpRate: 30, noise: 0, steps: 0, repeat: 1, gap: .05, ...p0 }; if (p0.f1 == null) p.f1 = p.f0;
  const R = res(ctx); let tt = t;
  for (let k = 0; k < Math.max(1, p.repeat | 0); k++) {
    const g = ctx.createGain(), pk = p.vol * .45 * (1 - k * .15); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(pk, tt + p.a);
    g.gain.exponentialRampToValueAtTime(.0005, tt + p.dur); g.gain.linearRampToValueAtTime(0, tt + p.dur + .01); g.connect(dest);
    const pitch = (prm, mul) => {
      prm.setValueAtTime(p.f0 * mul, tt);
      const arp = arpList(p.arp);
      if (arp.length > 1) { const st = 1 / Math.max(1, p.arpRate); let i = 0; for (let x = tt; x < tt + p.dur; x += st, i++) prm.setValueAtTime(p.f0 * mul * 2 ** (arp[i % arp.length] / 12), x); }
      else if (p.steps > 1) { for (let i = 1; i <= p.steps; i++) prm.setValueAtTime(mul * p.f0 * (p.f1 / p.f0) ** (i / p.steps), tt + p.dur * i / p.steps); }
      else if (p.f1 !== p.f0) prm.exponentialRampToValueAtTime(Math.max(1, p.f1 * mul), tt + p.dur);
    };
    if (p.noise < 1) {
      const o = ctx.createOscillator(); o.setPeriodicWave(p.wave === 'tri' ? R.tri : p.wave === 'saw' ? R.saw : R.pulse[nearestDuty(p.duty)]);
      pitch(o.frequency, 1);
      if (p.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = p.vibRate; lg.gain.value = p.vib; l.connect(lg).connect(o.detune); l.start(tt); l.stop(tt + p.dur + .05); }
      const og = ctx.createGain(); og.gain.value = 1 - p.noise; o.connect(og).connect(g); o.start(tt); o.stop(tt + p.dur + .05);
    }
    if (p.noise > 0) {
      const s = ctx.createBufferSource(); s.buffer = p.wave === 'noise-short' ? R.noiseShort : R.noiseLong; s.loop = true;
      pitch(s.playbackRate, 32 / ctx.sampleRate);
      const ng = ctx.createGain(); ng.gain.value = p.noise; s.connect(ng).connect(g); s.start(tt); s.stop(tt + p.dur + .05);
    }
    tt += p.dur + p.gap;
  }
  return tt - t;
}

export const songRowDur = s => 60 / s.bpm / (s.rpb || 4);
function rowTime(s, rowIndex) { const d = songRowDur(s); return rowIndex * d + (rowIndex % 2 ? (s.swing || 0) * d : 0); }
const instFor = (s, ch, cell) => s.instruments[cell.i ?? s.channels[ch].inst] || s.instruments[0];

/** Main engine: owns an AudioContext, music/sfx buses, a lookahead sequencer. */
export class Chip {
  constructor() { this.ctx = null; this.vol = 0.7; this.muted = false; this.song = null; this.playing = false; this.queue = []; this.chMute = []; this.onEnd = null; this.musicLevel = 1; }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol;
      this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -10; this.comp.ratio.value = 4;
      this.master.connect(this.comp).connect(c.destination);
      this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024; this.comp.connect(this.analyser);
      this.music = c.createGain(); this.music.connect(this.master);
      this.sfxBus = c.createGain(); this.sfxBus.connect(this.master);
      this.delay = c.createDelay(1); this.fb = c.createGain(); this.wet = c.createGain(); this.wet.gain.value = 0;
      this.music.connect(this.delay); this.delay.connect(this.fb).connect(this.delay); this.delay.connect(this.wet).connect(this.master); this.fb.gain.value = .35;
      this.chBus = [];
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  setVolume(v) { this.vol = v; if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : v, this.ctx.currentTime, .03); }
  setMuted(m) { this.muted = m; this.setVolume(this.vol); }
  bus(ch) { while (this.chBus.length <= ch) { const g = this.ctx.createGain(); g.connect(this.music); this.chBus.push(g); } return this.chBus[ch]; }
  applyMutes() { if (!this.ctx) return; const solo = this.chSolo?.some(Boolean); this.chBus.forEach((g, i) => g.gain.setTargetAtTime((solo ? this.chSolo[i] : !this.chMute[i]) ? 1 : 0, this.ctx.currentTime, .01)); }
  note(inst, n, dur = .3, opt) { const c = this.unlock(); scheduleNote(c, this.sfxBus, inst, n, c.currentTime + .01, dur, opt); }
  sfx(p) { if (!p) return; const c = this.unlock(); if (this.muted) return; if (Array.isArray(p)) { let t = c.currentTime + .01; for (const q of p) { scheduleSfx(c, this.sfxBus, q, t + (q.at || 0)); } return; } scheduleSfx(c, this.sfxBus, p, c.currentTime + .01); }
  /** opts: { loop:true, pattern:null (index → loop just that pattern), order:0, row:0, level:1 } */
  play(song, opts = {}) {
    const c = this.unlock(); this.stop(true);
    this.song = song; this.opts = { loop: true, pattern: null, ...opts };
    this.pos = { o: this.opts.order || 0, r: this.opts.row || 0 }; this.t0 = c.currentTime + .06; this.rowIdx = 0; this.queue = [];
    this.wet.gain.setTargetAtTime(song.echo || 0, c.currentTime, .05); this.delay.delayTime.value = Math.min(1, songRowDur(song) * 3);
    this.music.gain.cancelScheduledValues(c.currentTime); this.music.gain.setTargetAtTime(this.opts.level ?? 1, c.currentTime, .02);
    this.playing = true; this.applyMutes(); this.tick(); this.timer = setInterval(() => this.tick(), 25);
  }
  stop(quiet) { this.playing = false; clearInterval(this.timer); this.queue = []; if (!quiet && this.ctx) { this.music.gain.setTargetAtTime(0, this.ctx.currentTime, .02); } }
  fadeTo(level, sec = .5) { if (this.ctx) this.music.gain.setTargetAtTime(level, this.ctx.currentTime, sec / 3); }
  tick() {
    const s = this.song, c = this.ctx; if (!this.playing || !s) return;
    while (true) {
      const t = this.t0 + rowTime(s, this.rowIdx) - (this.rowIdx % 2 ? 0 : 0);
      if (t > c.currentTime + .15) break;
      const pi = this.opts.pattern ?? s.order[this.pos.o], P = s.patterns[pi];
      if (P) {
        for (let ch = 0; ch < s.channels.length; ch++) {
          const cell = P.ch[ch]?.[this.pos.r]; if (!cell || cell.n == null) continue;
          const dur = (cell.l || 1) * songRowDur(s) * .96;
          if (t >= c.currentTime - .02) scheduleNote(c, this.bus(ch), instFor(s, ch, cell), cell.n, Math.max(t, c.currentTime), dur, cell);
        }
      }
      this.queue.push({ t, o: this.pos.o, r: this.pos.r, p: pi }); if (this.queue.length > 64) this.queue.shift();
      this.rowIdx++; this.pos.r++;
      if (this.pos.r >= s.rows) {
        this.pos.r = 0;
        if (this.opts.pattern == null) { this.pos.o++; if (this.pos.o >= s.order.length) { if (this.opts.loop) this.pos.o = 0; else { this.playing = false; clearInterval(this.timer); const fin = t + songRowDur(s); setTimeout(() => this.onEnd?.(), Math.max(0, (fin - c.currentTime) * 1000)); break; } } }
        else if (!this.opts.loop) { this.playing = false; clearInterval(this.timer); break; }
      }
    }
  }
  /** Current playhead {o, r, p} or null. */
  head() { if (!this.ctx || !this.queue.length) return null; const now = this.ctx.currentTime; let h = null; for (const q of this.queue) if (q.t <= now) h = q; return h; }
}

/** Exact length in seconds of one pass (pattern index or full order) — the loop period. */
export function songPeriod(song, { pattern = null, loops = 1 } = {}) { return rowTime(song, (pattern != null ? 1 : song.order.length) * song.rows * loops); }

/**
 * Render song (once through order, or a single pattern) to an AudioBuffer via OfflineAudioContext.
 * opts: { pattern:null, loops:1, tail:1.2, sr:44100, seamless:false, xfade:0 }
 *  - normal: length = loops·period + tail (release/echo ring out), starts 20ms in.
 *  - seamless:true → game-loop asset. Length is exactly loops·period samples, notes start at sample 0.
 *    The release/echo that spills past the end is rendered too and folded (added) onto the head of the
 *    buffer, i.e. exactly what you hear when the loop wraps — so the seam is sample-continuous.
 *    xfade (ms, default 0) optionally adds a short equal-power crossfade of the last xfade ms into the
 *    head for material that isn't strictly periodic; the length stays exact.
 */
export async function renderSongBuffer(song, { pattern = null, loops = 1, tail = 1.2, sr = 44100, seamless = false, xfade = 0 } = {}) {
  loops = Math.max(1, loops | 0);
  const pats = pattern != null ? Array(loops).fill(pattern) : Array(loops).fill(0).flatMap(() => song.order);
  const rows = pats.length * song.rows, period = Math.round(rowTime(song, rows) * sr);
  if (seamless) return renderSeamless(song, pats, period, Math.max(tail, 1.2, song.echo ? 4 : 0), sr, xfade);
  const off = .02, len = Math.ceil((off + rowTime(song, rows) + tail) * sr);
  const oc = new OfflineAudioContext(1, len, sr), out = oc.createGain(); out.gain.value = .9; out.connect(oc.destination);
  if (song.echo) { const d = oc.createDelay(1), fb = oc.createGain(), w = oc.createGain(); d.delayTime.value = Math.min(1, songRowDur(song) * 3); fb.gain.value = .35; w.gain.value = song.echo; out.connect(d); d.connect(fb).connect(d); d.connect(w).connect(oc.destination); }
  pats.forEach((pi, k) => { const P = song.patterns[pi]; if (!P) return; for (let r = 0; r < song.rows; r++) for (let ch = 0; ch < song.channels.length; ch++) { const cell = P.ch[ch]?.[r]; if (!cell || cell.n == null) continue; scheduleNote(oc, out, instFor(song, ch, cell), cell.n, off + rowTime(song, k * song.rows + r), (cell.l || 1) * songRowDur(song) * .96, cell); } });
  return oc.startRendering();
}
async function renderSeamless(song, pats, period, spill, sr, xfadeMs) {
  // Render one pass + spill, then fold the spill onto the head (circular wrap). For echo (feedback),
  // the fold is iterated so multi-cycle echo tails also wrap.
  const len = period + Math.ceil(spill * sr);
  const oc = new OfflineAudioContext(1, len, sr), out = oc.createGain(); out.gain.value = .9; out.connect(oc.destination);
  if (song.echo) { const d = oc.createDelay(1), fb = oc.createGain(), w = oc.createGain(); d.delayTime.value = Math.min(1, songRowDur(song) * 3); fb.gain.value = .35; w.gain.value = song.echo; out.connect(d); d.connect(fb).connect(d); d.connect(w).connect(oc.destination); }
  pats.forEach((pi, k) => { const P = song.patterns[pi]; if (!P) return; for (let r = 0; r < song.rows; r++) for (let ch = 0; ch < song.channels.length; ch++) { const cell = P.ch[ch]?.[r]; if (!cell || cell.n == null) continue; scheduleNote(oc, out, instFor(song, ch, cell), cell.n, rowTime(song, k * song.rows + r), (cell.l || 1) * songRowDur(song) * .96, cell); } });
  const raw = (await oc.startRendering()).getChannelData(0);
  const loop = new Float32Array(period);
  for (let i = 0; i < raw.length; i++) loop[i % period] += raw[i];
  const xf = Math.min(period >> 2, Math.round((xfadeMs || 0) / 1000 * sr));
  if (xf > 0) { // equal-power blend of the tail end into the head; length unchanged
    for (let i = 0; i < xf; i++) { const t = i / xf, a = Math.sin(t * Math.PI / 2), b = Math.cos(t * Math.PI / 2); loop[i] = loop[i] * a + loop[period - xf + i] * b; }
  }
  let peak = 0; for (let i = 0; i < period; i++) peak = Math.max(peak, Math.abs(loop[i]));
  if (peak > 1) for (let i = 0; i < period; i++) loop[i] /= peak;
  return { sampleRate: sr, length: period, numberOfChannels: 1, duration: period / sr, getChannelData: () => loop };
}
/** Render song to a mono 16-bit WAV Blob (backward compatible). Accepts the same opts as renderSongBuffer. */
export async function renderWav(song, opts = {}) { return wavBlob(await renderSongBuffer(song, opts)); }
export async function renderSfxBuffer(p, sr = 44100) { const oc = new OfflineAudioContext(1, Math.ceil(sr * ((p.dur + (p.gap || .05)) * (p.repeat || 1) + .3)), sr); scheduleSfx(oc, oc.destination, p, .01); return oc.startRendering(); }
export async function renderSfxWav(p, sr = 44100) { return wavBlob(await renderSfxBuffer(p, sr)); }
/** Song → MP3 Blob. opts as renderSongBuffer + { bitrate:128 }. */
export async function renderMp3(song, opts = {}) { return encodeMp3(await renderSongBuffer(song, opts), opts); }
export async function renderSfxMp3(p, opts = {}) { return encodeMp3(await renderSfxBuffer(p, opts.sr || 44100), opts); }
export function wavBlob(buf) {
  const d = buf.getChannelData(0), n = d.length, ab = new ArrayBuffer(44 + n * 2), v = new DataView(ab);
  const ws = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
  return new Blob([ab], { type: 'audio/wav' });
}
/** Mono MP3 via vendored lamejs (LGPL, ./vendor/lamejs/lamejs.js), loaded lazily so the game never pays for it. */
export async function encodeMp3(buf, { bitrate = 128 } = {}) {
  const { Mp3Encoder } = await import('./vendor/lamejs/lamejs.js');
  const d = buf.getChannelData(0), n = d.length, pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) pcm[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
  const enc = new Mp3Encoder(1, buf.sampleRate, bitrate), parts = [];
  for (let i = 0; i < n; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(new Uint8Array(b)); }
  const f = enc.flush(); if (f.length) parts.push(new Uint8Array(f));
  return new Blob(parts, { type: 'audio/mpeg' });
}

/** Build a song from tracker-text lines: { title, bpm, rows, instruments, channels, patterns:[[line,line,line,line]], order } */
export function songFromText(def) {
  return { v: 1, title: def.title, bpm: def.bpm, rpb: def.rpb || 4, rows: def.rows, swing: def.swing || 0, echo: def.echo || 0, meta: def.meta,
    instruments: def.instruments, channels: def.channels,
    patterns: def.patterns.map((p, i) => ({ name: p.name || 'P' + i, ch: p.lines.map(l => parseLine(l || '', def.rows)) })), order: def.order };
}
