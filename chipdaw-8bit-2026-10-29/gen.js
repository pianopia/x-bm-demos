// "AI" = local procedural heuristics (no cloud LLM, no API key). Prompt keywords → mood params → seeded generators.
import { parseNote, mtof } from '../audio/chip.js';

export function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
const pick = (R, a) => a[Math.floor(R() * a.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], harm: [0, 2, 3, 5, 7, 8, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], minpent: [0, 3, 5, 7, 10], majpent: [0, 2, 4, 7, 9], miyako: [0, 1, 5, 7, 8] };
const PROG = {
  major: [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4], [3, 4, 2, 5], [0, 3, 0, 4]],
  minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 4], [0, 5, 3, 4], [0, 3, 6, 2]],
  harm: [[0, 0, 5, 4], [0, 6, 5, 4], [0, 3, 4, 0], [0, 5, 1, 4]],
  dorian: [[0, 3, 0, 3], [0, 6, 3, 0], [0, 2, 3, 6]],
  phryg: [[0, 1, 0, 6], [0, 1, 6, 1]], lydian: [[0, 1, 0, 1], [0, 1, 4, 3]],
  minpent: [[0, 2, 3, 0], [0, 3, 4, 0]], majpent: [[0, 3, 4, 0], [0, 2, 3, 4]], miyako: [[0, 3, 2, 0], [0, 4, 3, 0]],
};
const MOODS = [
  { k: ['廃墟', 'ruin', '霧', 'fog', 'dark', '暗', 'ダーク', '怖', 'ホラー', 'horror', 'dungeon', 'ダンジョン', '洞窟', 'cave', '墓', '聖堂', 'cathedral'], set: { scale: 'minor', bpm: [70, 86], energy: .25, echo: .35, tag: '暗い' } },
  { k: ['探索', 'explore', 'field', 'フィールド', '旅', '冒険', 'adventure', 'overworld', '森', 'forest'], set: { scale: 'dorian', bpm: [100, 116], energy: .5, echo: .18, tag: '探索' } },
  { k: ['戦闘', 'battle', 'boss', 'ボス', 'fight', 'バトル', '敵', 'combat', '決戦'], set: { scale: 'harm', bpm: [144, 168], energy: .92, echo: .08, tag: '戦闘' } },
  { k: ['クリア', 'clear', 'win', '勝利', 'victory', 'ファンファーレ', 'fanfare', 'ジングル', 'jingle', 'stage clear'], set: { scale: 'major', bpm: [126, 140], energy: .75, echo: .15, short: true, tag: 'ファンファーレ' } },
  { k: ['cheerful', '明る', '楽し', 'happy', 'town', '町', '村', 'ポップ', 'pop', 'shop', 'ショップ', 'かわいい', 'cute'], set: { scale: 'major', bpm: [112, 132], energy: .6, echo: .12, tag: '明るい' } },
  { k: ['悲し', 'sad', '切な', '雨', 'rain', '夜', 'night', '静か', 'calm', 'ambient', '眠', 'lullaby', 'ゲームオーバー', 'game over'], set: { scale: 'minor', bpm: [64, 80], energy: .15, echo: .4, tag: '静か' } },
  { k: ['和', 'japan', '祭', 'oriental', '東洋', '忍', 'ninja', '侍'], set: { scale: 'miyako', bpm: [96, 128], energy: .55, echo: .2, tag: '和風' } },
  { k: ['宇宙', 'space', 'sf', 'sci-fi', '未来', 'cyber', 'サイバー', '神秘', 'mystery', '謎', '夢', 'dream'], set: { scale: 'lydian', bpm: [90, 112], energy: .45, echo: .3, tag: '神秘' } },
  { k: ['タイトル', 'title', 'opening', 'オープニング', '勇者', 'hero', '王', 'castle', '城'], set: { scale: 'major', bpm: [100, 120], energy: .65, echo: .2, tag: '勇壮' } },
];
const TEMPO = [{ k: ['速', 'fast', '疾走', 'race', 'chase', '追', 'hurry', '急'], d: 22, e: .2 }, { k: ['遅', 'slow', 'ゆっくり', 'のんびり'], d: -18, e: -.15 }];
const SFXK = {
  jump: ['ジャンプ', 'jump', '跳'], coin: ['コイン', 'coin', '拾', 'pickup', 'pick up', '取得', 'item', 'アイテム', 'get'], chest: ['宝箱', 'chest', 'treasure', 'お宝'],
  hit: ['ダメージ', 'damage', 'hurt', '被弾', '痛', 'hit'], explode: ['爆発', 'explosion', 'explode', 'bomb', '爆', '崩'], laser: ['レーザー', 'laser', 'shoot', '弾', 'ビーム', 'beam', 'shot', '射撃'],
  power: ['パワーアップ', 'power', 'powerup', 'レベルアップ', 'level up', 'levelup', '回復', 'heal'], door: ['扉', 'door', '門', 'gate', '開'], select: ['決定', 'select', 'ok', 'カーソル', 'cursor', 'menu', 'メニュー', 'ui', 'ボタン', 'click'],
  step: ['足音', 'step', 'footstep', '歩'], swing: ['斬', 'swing', '剣', 'sword', '振', 'slash'], magic: ['魔法', 'magic', 'spell', 'キラ', 'sparkle', 'shine'],
  fall: ['落下', 'fall', '落ち', '穴'], fire: ['炎', '火', 'fire', 'torch', '松明', '燃'], alarm: ['警報', 'alarm', 'warning', '危険', 'siren'], die: ['やられ', '死', 'death', 'die', 'dead', '撃破', 'defeat'],
};
const SFX_WORDS = ['効果音', 'se', 'sfx', 'sound effect'], SONG_WORDS = ['bgm', '曲', 'music', 'song', 'テーマ', 'theme', 'ループ', 'loop', 'ジングル', 'jingle', 'ファンファーレ'];
const lc = s => s.toLowerCase();
const has = (p, ks) => ks.some(k => p.includes(lc(k)));

/** Decide song vs sfx and extract params. */
export function analyze(prompt) {
  const p = lc(prompt);
  let sfxType = null; for (const [t, ks] of Object.entries(SFXK)) if (has(p, ks)) { sfxType = t; break; }
  const wantsSong = has(p, SONG_WORDS) || MOODS.some(m => has(p, m.k)) && !sfxType;
  const kind = (has(p, SFX_WORDS) || (sfxType && !has(p, SONG_WORDS))) ? 'sfx' : 'song';
  const mood = { scale: 'minor', bpm: [96, 116], energy: .5, echo: .2, tag: '標準' }; const tags = [];
  let nm = 0; for (const m of MOODS) if (has(p, m.k)) { // first match sets scale; later matches blend tempo/energy
    if (!nm) Object.assign(mood, m.set); else { mood.bpm = [(mood.bpm[0] + m.set.bpm[0]) / 2, (mood.bpm[1] + m.set.bpm[1]) / 2]; mood.energy = (mood.energy + m.set.energy) / 2; mood.short = mood.short || m.set.short; }
    nm++; tags.push(m.set.tag); }
  let bpm = Math.round((mood.bpm[0] + mood.bpm[1]) / 2);
  for (const t of TEMPO) if (has(p, t.k)) { bpm += t.d; mood.energy = clamp(mood.energy + t.e, .05, 1); tags.push(t.d > 0 ? '速め' : '遅め'); }
  const mb = /(\d{2,3})\s*bpm|bpm\s*(\d{2,3})/i.exec(prompt); if (mb) bpm = +(mb[1] || mb[2]);
  if (/major|メジャー|長調/i.test(prompt)) mood.scale = 'major'; if (/minor|マイナー|短調/i.test(prompt)) mood.scale = mood.scale === 'harm' ? 'harm' : 'minor';
  let root = null; const mk = /\b([A-G])(#|b|♯|♭)?\s*(?:major|minor|maj|min|m\b)|([A-G])(#|♯|♭|b)?\s*(?:メジャー|マイナー|調)/.exec(prompt);
  if (mk) { const L = mk[1] || mk[3], acc = mk[2] || mk[4]; root = parseNote(L + (acc === '#' || acc === '♯' ? '#' : acc === 'b' || acc === '♭' ? 'b' : '') + '3'); }
  const bars = /(\d+)\s*(小節|bars?)/i.exec(prompt);
  const longReq = /長い|長め|長尺|フル|ロング|long|full/i.test(prompt);
  return { kind: wantsSong && !has(p, SFX_WORDS) && kind === 'sfx' && !sfxType ? 'song' : kind, sfxType: sfxType || 'coin', mood, bpm: clamp(bpm, 50, 220), root, bars: bars ? Math.min(512, +bars[1]) : longReq ? 48 : null, tags };
}

// ---------- music theory helpers
const deg = (scale, d) => { const L = scale.length, o = Math.floor(d / L); return scale[((d % L) + L) % L] + 12 * o; };
export function chordTones(meta, d) { const sc = SCALES[meta.scale] || SCALES.minor; const L = sc.length >= 7 ? 2 : 1; return [d, d + L * 1, d + L * 2].map(x => meta.root + deg(sc, x)); }
const pcs = notes => new Set(notes.map(n => ((n % 12) + 12) % 12));
function snapToScale(meta, n) { const sc = SCALES[meta.scale] || SCALES.minor; for (let k = 0; k < 7; k++) for (const s of [n - k, n + k]) if (sc.includes((((s - meta.root) % 12) + 12) % 12)) return s; return n; }
function scaleStep(meta, n, step) { const sc = SCALES[meta.scale] || SCALES.minor; let x = snapToScale(meta, n); let i = 0; const dir = Math.sign(step); while (i < Math.abs(step)) { x += dir; if (sc.includes((((x - meta.root) % 12) + 12) % 12)) i++; } return x; }
const nearestIn = (cands, target) => cands.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
function inOct(pcSet, lo, hi) { const out = []; for (let n = lo; n <= hi; n++) if (pcSet.has(n % 12)) out.push(n); return out; }

export function emptyPattern(song, name) { return { name: name || 'P' + song.patterns.length, ch: song.channels.map(() => Array(song.rows).fill(null)) }; }
const cell = (n, l = 1, v = 12, extra) => ({ n, l, v, ...extra });

// ---------- channel generators (pattern = 2+ bars; chords = array of degree per bar)
const RHY = { // onset templates for one 16-row bar: [row, len]
  low: [[[0, 6], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 6], [14, 2]], [[0, 8], [8, 4], [12, 4]], [[0, 3], [3, 3], [6, 10]]],
  mid: [[[0, 3], [3, 3], [6, 2], [8, 4], [12, 2], [14, 2]], [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]], [[0, 4], [4, 2], [6, 2], [8, 6], [14, 2]], [[0, 3], [3, 1], [4, 4], [10, 2], [12, 4]]],
  high: [[[0, 2], [2, 2], [4, 2], [6, 2], [8, 3], [11, 1], [12, 2], [14, 2]], [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 4]], [[0, 3], [3, 3], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]]],
};
export function genMelody(R, meta, chords, rows, energy, lo = 67, hi = 86) {
  const out = Array(rows).fill(null), bars = rows / 16, lvl = energy < .35 ? 'low' : energy < .75 ? 'mid' : 'high';
  const motif = pick(R, RHY[lvl]), alt = pick(R, RHY[lvl]);
  let prev = snapToScale(meta, meta.root + 12 + (meta.root + 12 < lo ? 12 : 0));
  const firstContour = [];
  for (let b = 0; b < bars; b++) {
    const ch = chordTones(meta, chords[b % chords.length]), chordPc = pcs(ch), cand = inOct(chordPc, lo, hi);
    const rh = (b % 4 === 3 && R() < .6) ? [[0, 4], [4, 4], [8, 8]] : (b % 2 ? alt : motif);
    rh.forEach(([r, l], i) => {
      let n;
      if (b % 2 === 1 && firstContour[i] != null && R() < .55) n = clamp(scaleStep(meta, prev, firstContour[i]), lo, hi);
      else if (r % 4 === 0 || l >= 4) n = nearestIn(cand.filter(x => Math.abs(x - prev) <= 7 && x !== prev).concat(cand), prev + (R() - .5) * 8);
      else n = scaleStep(meta, prev, pick(R, [-2, -1, -1, 1, 1, 2]));
      n = clamp(n, lo, hi);
      if (b % 2 === 0) firstContour[i] = 0;
      if (b % 2 === 0 && i > 0) firstContour[i] = Math.sign(n - prev) * Math.min(2, Math.abs(Math.round((n - prev) / 2)));
      if (i === rh.length - 1 && b === bars - 1) n = nearestIn(cand, n);
      out[b * 16 + r] = cell(n, l, r % 8 === 0 ? 12 : 10); prev = n;
    });
  }
  return out;
}
export function genBass(R, meta, chords, rows, energy) {
  const out = Array(rows).fill(null), bars = rows / 16; let base = meta.root - 12; while (base > 47) base -= 12; while (base < 36) base += 12;
  const style = energy < .3 ? 'hold' : energy < .6 ? 'root5' : energy < .85 ? 'octave' : 'drive';
  for (let b = 0; b < bars; b++) {
    const [r1, , r5] = chordTones({ ...meta, root: base }, chords[b % chords.length]); const r0 = r1 > base + 9 ? r1 - 12 : r1, f = r5 - r1 + r0;
    const o = b * 16;
    if (style === 'hold') { out[o] = cell(r0, R() < .5 ? 16 : 12); if (!out[o + 12] && out[o].l === 12) out[o + 12] = cell(f > r0 + 9 ? f - 12 : f, 4); }
    else if (style === 'root5') [[0, r0, 4], [4, f, 4], [8, r0, 4], [12, R() < .5 ? f : r0 + 12, 4]].forEach(([r, n, l]) => out[o + r] = cell(n, l - 1));
    else if (style === 'octave') for (let r = 0; r < 16; r += 2) out[o + r] = cell(r % 4 ? r0 + 12 : r0, 1);
    else for (let r = 0; r < 16; r += 2) out[o + r] = cell(r === 14 && R() < .5 ? f : r % 4 === 2 && R() < .4 ? r0 + 12 : r0, 2);
  }
  return out;
}
export function genHarmony(R, meta, chords, rows, energy, melody) {
  const out = Array(rows).fill(null), bars = rows / 16;
  const style = energy < .35 ? 'arp' : energy < .7 ? (R() < .5 ? 'arp' : 'offbeat') : 'chordArp';
  for (let b = 0; b < bars; b++) {
    const ch = chordTones({ ...meta, root: meta.root }, chords[b % chords.length]).map(n => { while (n < 57) n += 12; while (n > 72) n -= 12; return n; }).sort((a, c) => a - c), o = b * 16;
    if (style === 'arp') { const seq = [0, 1, 2, 1]; for (let r = 0; r < 16; r += 2) out[o + r] = cell(ch[seq[(r / 2) % 4]], 2, 8); }
    else if (style === 'offbeat') for (let r = 2; r < 16; r += 4) out[o + r] = cell(ch[1], 2, 9);
    else { const iv = ch.map(n => n - ch[0]).map(x => x.toString(16)).join(''); for (let r = 0; r < 16; r += 4) out[o + r] = cell(ch[0], 2, 9, { fx: { arp: iv } }); }
  }
  if (melody && style === 'offbeat' && R() < .5) melody.forEach((c, r) => { if (c && r % 8 === 0) { const h = scaleStep(meta, c.n, -2); out[r] = cell(h, Math.min(c.l, 4), 8); } });
  return out;
}
/** Noise drums. Instruments by name lookup (Hat/Kick/Snare) provided via drum = {hat, kick, snare, wind}. */
export function genDrums(R, rows, energy, drum) {
  const out = Array(rows).fill(null), bars = rows / 16;
  const K = (r, v = 12) => cell(12, 1, v, { i: drum.kick }), S = (r, v = 12) => cell(6, 1, v, { i: drum.snare }), H = (v = 7) => cell(1, 1, v, { i: drum.hat });
  for (let b = 0; b < bars; b++) {
    const o = b * 16;
    if (energy < .3) { if (b % 2 === 0 && drum.wind != null) out[o] = cell(9, 16, 7, { i: drum.wind }); else { out[o + 8] = H(5); if (R() < .5) out[o + 12] = H(4); } continue; }
    for (let r = 0; r < 16; r += energy > .75 ? 2 : 4) out[o + r] = H(energy > .75 ? 6 : 7);
    out[o] = K(); out[o + 8] = energy > .6 ? K() : out[o + 8]; out[o + 4] = S(); out[o + 12] = S();
    if (energy > .6 && R() < .7) out[o + 10] = K(0, 10);
    if (b === bars - 1 && R() < .7) { out[o + 13] = S(0, 9); out[o + 14] = S(0, 10); out[o + 15] = S(0, 11); }
  }
  return out;
}

const DEFAULT_INSTRUMENTS = () => [
  { name: 'Lead 25%', wave: 'pulse', duty: .25, vol: .42, a: .006, d: .25, s: .55, r: .12, vib: 14, vibRate: 5.5, vibDelay: .2 },
  { name: 'Harm 12.5%', wave: 'pulse', duty: .125, vol: .22, a: .003, d: .15, s: .35, r: .06 },
  { name: 'Bass Tri', wave: 'tri', vol: .78, a: .002, d: .08, s: .85, r: .03 },
  { name: 'Wind', wave: 'noise', noiseMode: 'long', vol: .14, a: .35, d: .6, s: .5, r: .7 },
  { name: 'Hat', wave: 'noise', noiseMode: 'short', vol: .16, a: .001, d: .04, s: 0, r: .02 },
  { name: 'Kick', wave: 'noise', noiseMode: 'long', vol: .55, a: .001, d: .07, s: 0, r: .02, slide: 3 },
  { name: 'Snare', wave: 'noise', noiseMode: 'long', vol: .42, a: .001, d: .14, s: 0, r: .03 },
];
export function drumMap(song) { const f = n => { const i = song.instruments.findIndex(x => x.name.toLowerCase() === n); return i < 0 ? null : i; }; return { hat: f('hat') ?? 3, kick: f('kick') ?? 3, snare: f('snare') ?? 3, wind: f('wind') }; }

/** Full song from prompt. seed varies alternatives. */
export function generateSong(prompt, seed = 0) {
  const A = analyze(prompt), R = rng(hash(prompt) ^ (seed * 2654435761));
  const roots = [57, 50, 52, 55, 60, 53, 62]; const root = A.root ?? pick(R, roots);
  const scale = A.mood.scale, meta = { root: root < 50 ? root + 12 : root > 62 ? root - 12 : root, scale };
  const energy = clamp(A.mood.energy + (R() - .5) * .15, .05, 1);
  const short = A.mood.short;
  const song = { v: 1, title: (prompt.trim().slice(0, 28) || 'Untitled') + (seed ? ` #${seed + 1}` : ''), bpm: A.bpm + Math.round((R() - .5) * 8), rpb: 4, rows: 32, swing: energy < .4 && R() < .3 ? .12 : 0, echo: A.mood.echo, meta,
    instruments: DEFAULT_INSTRUMENTS(), channels: [{ name: 'Pulse 1', inst: 0 }, { name: 'Pulse 2', inst: 1 }, { name: 'Triangle', inst: 2 }, { name: 'Noise', inst: 4 }], patterns: [], order: [] };
  if (energy > .75) { song.instruments[0].duty = .5; song.instruments[0].d = .12; }
  if (scale === 'miyako') { song.instruments[0].duty = .125; song.instruments[0].vib = 25; }
  const progs = PROG[scale] || PROG.minor, p1 = pick(R, progs), p2 = pick(R, progs);
  const D = drumMap(song);
  const mk = (name, chords, e, opts = {}) => {
    const P = emptyPattern(song, name); const mel = opts.noMel ? Array(32).fill(null) : genMelody(R, meta, chords, 32, e);
    P.ch[0] = mel; P.ch[1] = genHarmony(R, meta, chords, 32, e, mel); P.ch[2] = genBass(R, meta, chords, 32, e); P.ch[3] = genDrums(R, 32, e, D);
    song.patterns.push(P); return song.patterns.length - 1;
  };
  if (short) { // jingle: 2 patterns, ends on tonic
    const a = mk('Fanfare A', [p1[0], p1[1]], energy), b = mk('Fanfare B', [p1[3] ?? 4, 0], energy);
    const P = song.patterns[b]; P.ch[0] = P.ch[0].map((c, r) => r < 16 ? c : null); P.ch[0][16] = cell(meta.root + 24, 12, 13, { fx: { arp: scale === 'major' ? '047' : '037' } }); P.ch[3] = P.ch[3].map((c, r) => r < 18 ? c : null);
    song.order = [a, b]; return { song, info: A };
  }
  const intro = energy < .6 ? mk('Intro', [p1[0], p1[1]], energy * .6, { noMel: true }) : null;
  const a = mk('A', [p1[0], p1[1]], energy), b = mk('B', [p1[2], p1[3]], energy), c = mk('C', [p2[0], p2[1]], clamp(energy + .1, 0, 1));
  const bars = A.bars ? Math.max(2, Math.round(A.bars / 2)) : 0;
  song.order = intro != null ? [intro, a, b, a, c] : [a, b, a, c];
  if (bars) { while (song.order.length < bars) song.order.push(song.order[1 + (song.order.length % (song.order.length - 1))]); song.order.length = bars; }
  return { song, info: A };
}

// ---------- AI edit actions on one pattern
function inferMeta(song) {
  if (song.meta?.root != null) return song.meta;
  const hist = Array(12).fill(0); song.patterns.forEach(P => P.ch.forEach((c, ci) => song.instruments[song.channels[ci].inst]?.wave !== 'noise' && c.forEach(x => x && (hist[x.n % 12] += x.l || 1))));
  let best = { s: -1 }; for (let r = 0; r < 12; r++) for (const sc of ['major', 'minor']) { const s = SCALES[sc].reduce((a, i) => a + hist[(r + i) % 12], 0) + hist[r] * 1.5; if (s > best.s) best = { s, root: 48 + r + (r < 2 ? 12 : 0), scale: sc }; }
  return (song.meta = { root: best.root ?? 57, scale: best.scale || 'minor' });
}
/** Guess chord degree per bar from all pitched notes in the pattern (weighted by length, bass x2). */
export function inferChords(song, P, meta) {
  const bars = song.rows / 16, out = [], sc = SCALES[meta.scale] || SCALES.minor;
  for (let b = 0; b < bars; b++) {
    const w = Array(12).fill(0);
    P.ch.forEach((c, ci) => { if (song.instruments[song.channels[ci].inst]?.wave === 'noise') return; for (let r = b * 16; r < b * 16 + 16; r++) { const x = c[r]; if (x) w[x.n % 12] += (x.l || 1) * (ci === 2 ? 2 : 1) * (r % 4 === 0 ? 1.5 : 1); } });
    let best = 0, bs = -1; for (let d = 0; d < sc.length; d++) { const s = chordTones(meta, d).reduce((a, n) => a + w[((n % 12) + 12) % 12], 0) + (d === 0 ? .5 : 0); if (s > bs) { bs = s; best = d; } }
    out.push(best);
  }
  return out;
}
const energyOf = (song, P) => clamp(P.ch.reduce((a, c) => a + c.filter(Boolean).length, 0) / (song.rows * 1.6) + (song.bpm - 90) / 200, .1, 1);

export function aiFill(song, pi, ch, seed) {
  const P = song.patterns[pi], meta = inferMeta(song), R = rng(hash(P.name + ch) ^ seed), chords = inferChords(song, P, meta), e = energyOf(song, P);
  const inst = song.instruments[song.channels[ch].inst];
  if (inst?.wave === 'noise') P.ch[ch] = genDrums(R, song.rows, e, drumMap(song));
  else if (inst?.wave === 'tri' || ch === 2) P.ch[ch] = genBass(R, meta, chords, song.rows, e);
  else if (ch === 0) P.ch[ch] = genMelody(R, meta, chords, song.rows, e);
  else P.ch[ch] = genHarmony(R, meta, chords, song.rows, e, P.ch[0]);
}
export function aiBassFromMelody(song, pi, seed) { const P = song.patterns[pi], meta = inferMeta(song), R = rng(seed + 7); P.ch[2] = genBass(R, meta, inferChords(song, { ch: [P.ch[0], P.ch[1], Array(song.rows).fill(null)] }, meta), song.rows, energyOf(song, P)); }
export function aiDrums(song, pi, seed) { const P = song.patterns[pi]; P.ch[3] = genDrums(rng(seed + 11), song.rows, energyOf(song, P), drumMap(song)); }
export function aiVary(song, pi, ch, seed) {
  const P = song.patterns[pi], meta = inferMeta(song), R = rng(seed + 3), chords = inferChords(song, P, meta);
  P.ch[ch] = P.ch[ch].map((c, r) => {
    if (!c) return null; const x = { ...c };
    if (song.instruments[song.channels[ch].inst]?.wave === 'noise') { if (R() < .25) x.n = clamp(x.n + pick(R, [-2, -1, 1, 2]), 0, 15); return x; }
    const strong = r % 8 === 0, ct = chordTones(meta, chords[Math.floor(r / 16) % chords.length]);
    if (strong && R() < .5) x.n = nearestIn(inOct(pcs(ct), x.n - 7, x.n + 7), x.n + pick(R, [-4, 4]));
    else if (!strong && R() < .45) x.n = scaleStep(meta, x.n, pick(R, [-2, -1, 1, 2]));
    return x;
  });
  // rhythmic split: occasionally split a long note into two
  for (let r = 0; r < song.rows; r++) { const c = P.ch[ch][r]; if (c && c.l >= 4 && R() < .3) { const h = c.l >> 1; c.l = h; if (!P.ch[ch][r + h]) P.ch[ch][r + h] = { ...c, n: scaleStep(meta, c.n, pick(R, [-1, 1])) }; } }
}
export function aiMutate(song, pi, seed) {
  const R = rng(seed + 19), P = song.patterns[pi];
  for (let ch = 0; ch < P.ch.length; ch++) if (R() < .7) aiVary(song, pi, ch, seed + ch * 31);
  if (R() < .4) { const meta = inferMeta(song); P.ch[0] = P.ch[0].map(c => c && R() < .15 ? { ...c, n: c.n + 12 * pick(R, [-1, 1]) } : c); }
}
export function aiNextPattern(song, pi, seed) {
  const meta = inferMeta(song), src = song.patterns[pi], R = rng(seed + 41), chords = inferChords(song, src, meta), e = energyOf(song, src);
  const progs = PROG[meta.scale] || PROG.minor, pr = pick(R, progs), nc = chords.map((c, i) => pr[(i + 2) % pr.length]);
  const P = emptyPattern(song, src.name + "'"); P.ch[0] = genMelody(R, meta, nc, song.rows, e); P.ch[1] = genHarmony(R, meta, nc, song.rows, e, P.ch[0]); P.ch[2] = genBass(R, meta, nc, song.rows, e); P.ch[3] = genDrums(R, song.rows, e, drumMap(song));
  song.patterns.push(P); return song.patterns.length - 1;
}

// ---------- SFX
const SFX_BASE = {
  jump: { wave: 'pulse', duty: .5, f0: 260, f1: 720, dur: .22, vol: .45 },
  coin: { wave: 'pulse', duty: .5, f0: 988, dur: .28, vol: .4, arp: [0, 5], arpRate: 14 },
  chest: { wave: 'pulse', duty: .25, f0: 523, dur: .6, vol: .4, arp: [0, 4, 7, 12, 16, 19, 24], arpRate: 16, vib: 10 },
  hit: { wave: 'pulse', duty: .5, f0: 320, f1: 80, dur: .22, vol: .5, noise: .4 },
  explode: { wave: 'noise', f0: 160, f1: 30, dur: .9, vol: .7, noise: 1, steps: 0 },
  laser: { wave: 'pulse', duty: .25, f0: 1800, f1: 220, dur: .2, vol: .4 },
  power: { wave: 'pulse', duty: .5, f0: 262, f1: 1047, dur: .7, vol: .4, steps: 16, vib: 20, vibRate: 14 },
  door: { wave: 'pulse', duty: .125, f0: 150, f1: 85, dur: .7, vol: .35, steps: 10, vib: 60, vibRate: 18 },
  select: { wave: 'pulse', duty: .5, f0: 880, f1: 1320, dur: .06, vol: .3, steps: 2 },
  step: { wave: 'noise', f0: 300, f1: 120, dur: .06, vol: .3, noise: 1 },
  swing: { wave: 'noise-short', f0: 2400, f1: 500, dur: .13, vol: .3, noise: 1 },
  magic: { wave: 'pulse', duty: .125, f0: 1047, dur: .7, vol: .3, arp: [0, 7, 12, 19, 24, 19, 12, 7], arpRate: 24, vib: 30, vibRate: 10 },
  fall: { wave: 'tri', f0: 900, f1: 90, dur: .8, vol: .55 },
  fire: { wave: 'pulse', duty: .125, f0: 140, f1: 800, dur: .6, a: .08, vol: .45, noise: .85 },
  alarm: { wave: 'pulse', duty: .5, f0: 880, f1: 660, dur: .18, vol: .35, repeat: 4, gap: .04, steps: 2 },
  die: { wave: 'pulse', duty: .25, f0: 700, f1: 70, dur: .8, vol: .45, steps: 14, vib: 40, vibRate: 20 },
};
export function generateSfx(prompt, seed = 0) {
  const A = analyze(prompt), R = rng(hash(prompt) ^ (seed * 977)), base = { ...SFX_BASE[A.sfxType] };
  const j = (x, amt) => x * (1 + (R() - .5) * 2 * amt);
  base.f0 = Math.round(j(base.f0, .25)); if (base.f1) base.f1 = Math.round(j(base.f1, .25)); base.dur = +j(base.dur, .2).toFixed(3);
  if (base.wave === 'pulse' && R() < .3) base.duty = pick(R, [.125, .25, .5]);
  if (/重|heavy|big|大|low|低/.test(prompt)) { base.f0 *= .6; if (base.f1) base.f1 *= .6; base.dur *= 1.4; }
  if (/軽|small|小|high|高|cute|かわいい/.test(prompt)) { base.f0 *= 1.5; if (base.f1) base.f1 *= 1.5; base.dur *= .75; }
  if (/暗|dark|怖/.test(prompt) && base.arp) base.arp = base.arp.map(x => x % 12 === 4 ? x - 1 : x);
  return { sfx: base, info: A };
}
export const SUGGEST = [
  ['廃墟探索BGM 霧の聖堂', 'song'], ['ボス戦闘 速い', 'song'], ['ステージクリア ファンファーレ', 'song'], ['明るい町のテーマ', 'song'], ['和風 祭 BGM', 'song'], ['静かな夜 雨', 'song'], ['宇宙 神秘 dream', 'song'],
  ['宝箱', 'sfx'], ['ダメージ', 'sfx'], ['ジャンプ', 'sfx'], ['コインを拾う', 'sfx'], ['爆発 重い', 'sfx'], ['レーザー', 'sfx'], ['パワーアップ', 'sfx'], ['魔法 キラキラ', 'sfx'], ['決定 カーソル', 'sfx'], ['やられ', 'sfx'],
];
