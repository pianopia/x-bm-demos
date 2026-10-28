// CHIP DAW 8bit — UI. Engine: ../audio/chip.js · AI: ./gen.js (local heuristics)
import { Chip, noteName, renderWav, renderSfxWav, DEFAULT_INST } from '../audio/chip.js';
import { SONGS } from '../audio/songs.js';
import { SFX, SFX_LABELS } from '../audio/sfx.js';
import * as G from './gen.js';
const $ = id => document.getElementById(id);
const LS = 'chipdaw-8bit-v1', LS_SFX = 'chipdaw-8bit-sfx-v1';
const COL = ['#ffd166', '#5ec8ff', '#ff7aa8', '#b9a8ff'];
const chip = new Chip(); chip.vol = .7; chip.chMute = [0, 0, 0, 0]; chip.chSolo = [0, 0, 0, 0];
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- state
let song, pi = 0, ch = 0, sel = null, tool = 'pen', len = 2, cursor = 0, seedN = 0, lastPrompt = '', mode = null;
const undoS = [], redoS = [];
function snap() { undoS.push(JSON.stringify(song)); if (undoS.length > 80) undoS.shift(); redoS.length = 0; }
function undo() { if (!undoS.length) return; redoS.push(JSON.stringify(song)); song = JSON.parse(undoS.pop()); fixSong(); refresh(); }
function redo() { if (!redoS.length) return; undoS.push(JSON.stringify(song)); song = JSON.parse(redoS.pop()); fixSong(); refresh(); }
let saveT; function save() { clearTimeout(saveT); saveT = setTimeout(() => localStorage.setItem(LS, JSON.stringify(song)), 250); }
function fixSong() {
  song.rpb ||= 4; song.rows ||= 32; song.order ||= [0]; song.instruments ||= [{ ...DEFAULT_INST }];
  song.channels ||= []; while (song.channels.length < 4) song.channels.push({ name: ['Pulse 1', 'Pulse 2', 'Triangle', 'Noise'][song.channels.length], inst: 0 });
  if (!song.patterns?.length) song.patterns = [G.emptyPattern(song, 'A')];
  for (const P of song.patterns) { P.ch ||= []; while (P.ch.length < song.channels.length) P.ch.push([]); P.ch = P.ch.map(c => { const a = c.slice(0, song.rows); while (a.length < song.rows) a.push(null); return a.map((x, r) => x && x.n != null ? { ...x, l: Math.max(1, Math.min(x.l || 1, song.rows - r)) } : null); }); }
  song.order = song.order.filter(i => i < song.patterns.length); if (!song.order.length) song.order = [0];
  pi = Math.min(pi, song.patterns.length - 1); sel = null; if (chip.song) chip.song = song;
}
function loadSong(s) { snap(); song = clone(s); pi = song.order[0] || 0; fixSong(); refresh(); save(); }

const EX = { ruins: ['ゲーム: 廃墟の灯火 — 探索', () => SONGS.ruins], guardian: ['ゲーム: 祭壇の守り — 戦闘', () => SONGS.guardian], dawn: ['ゲーム: 夜明け（クリア後）', () => SONGS.dawn], town: ['AI例: 明るい町のテーマ', () => G.generateSong('明るい町のテーマ', 0).song], boss: ['AI例: ボス戦闘 速い', () => G.generateSong('ボス戦闘 速い', 0).song] };
const qs = new URLSearchParams(location.search).get('song');
try { song = qs && EX[qs] ? clone(EX[qs][1]()) : JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { song = null; }
if (!song) song = clone(SONGS.ruins);
fixSong();

const pat = () => song.patterns[pi], arr = () => pat().ch[ch];
const instOf = c => song.instruments[c?.i ?? song.channels[ch].inst] || song.instruments[0];
const isNoise = (c = ch) => song.instruments[song.channels[c].inst]?.wave === 'noise';
const chInst = (c = ch) => song.instruments[song.channels[c].inst];
const preview = (n, c = null) => { if (n == null) return; chip.unlock(); ensureBuses(); chip.note(c?.i != null ? song.instruments[c.i] : chInst(), n, .22, c ? { v: c.v, fx: c.fx } : {}); };
function ensureBuses() { if (chip.ctx) for (let i = 0; i < song.channels.length; i++) chip.bus(i); chip.applyMutes(); }

// ---------- transport
function play(patOnly) { chip.unlock(); chip.play(song, patOnly ? { pattern: pi, loop: true } : { order: Math.max(0, song.order.indexOf(pi)), loop: true }); ensureBuses(); mode = patOnly ? 'pat' : 'song'; paintTransport(); }
function stop() { chip.stop(); mode = null; paintTransport(); drawRoll(); drawLanes(); paintOrder(); }
function paintTransport() { $('playSong').classList.toggle('on', mode === 'song'); $('playPat').classList.toggle('on', mode === 'pat'); }
$('playSong').onclick = () => mode === 'song' ? stop() : play(false);
$('playPat').onclick = () => mode === 'pat' ? stop() : play(true);
$('stop').onclick = stop;
$('bpm').onchange = e => { snap(); song.bpm = Math.max(40, Math.min(260, +e.target.value || 120)); save(); };
$('rows').onchange = e => { snap(); song.rows = +e.target.value; fixSong(); refresh(); save(); };
$('swing').oninput = e => { song.swing = +e.target.value; save(); };
$('echo').oninput = e => { song.echo = +e.target.value; if (chip.ctx) chip.wet.gain.setTargetAtTime(song.echo, chip.ctx.currentTime, .05); save(); };
$('vol').oninput = e => { chip.unlock(); chip.setVolume(+e.target.value); };
$('undo').onclick = undo; $('redo').onclick = redo;
$('newSong').onclick = () => { if (!confirm('新規ソングにする？（今の曲は「JSON保存」していなければ取り消しで戻せる）')) return; const s = G.generateSong('', 0).song; s.title = 'Untitled'; s.patterns = [G.emptyPattern(s, 'A')]; s.order = [0]; s.bpm = 120; s.meta = null; loadSong(s); };
const exSel = $('examples'); exSel.innerHTML = '<option value="">例を開く…</option>' + Object.entries(EX).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join('');
exSel.onchange = () => { const k = exSel.value; exSel.value = ''; if (k) { stop(); loadSong(EX[k][1]()); log(`例「${EX[k][0]}」を開いた`); } };
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
const slug = () => (song.title || 'song').replace(/[^\w\u3040-\u30ff\u4e00-\u9fff-]+/g, '_').slice(0, 40);
$('expJson').onclick = () => download(new Blob([JSON.stringify(song, null, 1)], { type: 'application/json' }), slug() + '.chip.json');
$('impJson').onclick = () => $('file').click();
$('file').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const s = JSON.parse(await f.text()); if (!s.patterns) throw new Error('patterns がない'); stop(); loadSong(s); log(`読み込み: ${f.name}`); } catch (err) { alert('読み込み失敗: ' + err.message); } e.target.value = ''; };
$('expWav').onclick = async () => { const b = $('expWav'); b.disabled = true; b.textContent = '書出中…'; try { download(await renderWav(song, mode === 'pat' ? { pattern: pi, loops: 2 } : {}), slug() + '.wav'); } catch (e) { alert('WAV 書き出し失敗: ' + e.message); } b.disabled = false; b.textContent = 'WAV書出'; };

// ---------- left panel
function paintChans() {
  $('chans').innerHTML = '';
  song.channels.forEach((c, i) => {
    const d = document.createElement('div'); d.className = 'ch' + (i === ch ? ' sel' : '');
    const inst = song.instruments[c.inst];
    d.innerHTML = `<span class="dot" style="background:${COL[i]}"></span><div>${c.name}<small>${inst?.name || '?'} · ${pat().ch[i].filter(Boolean).length}音</small></div><button class="${chip.chMute[i] ? 'on' : ''}" title="ミュート">M</button><button class="solo ${chip.chSolo[i] ? 'on' : ''}" title="ソロ">S</button>`;
    d.onclick = () => selectCh(i);
    const [bm, bs] = d.querySelectorAll('button');
    bm.onclick = e => { e.stopPropagation(); chip.chMute[i] = !chip.chMute[i]; chip.applyMutes(); paintChans(); };
    bs.onclick = e => { e.stopPropagation(); chip.chSolo[i] = !chip.chSolo[i]; chip.applyMutes(); paintChans(); };
    $('chans').append(d);
  });
}
function selectCh(i) { ch = i; sel = null; refresh(); scrollToNotes(); }
function paintPats() {
  $('pats').innerHTML = '';
  song.patterns.forEach((P, i) => { const b = document.createElement('button'); b.textContent = `${String(i).padStart(2, '0')} ${P.name}`; if (i === pi) b.classList.add('on'); b.onclick = () => { pi = i; sel = null; refresh(); if (mode === 'pat') play(true); }; $('pats').append(b); });
  $('patName').value = pat().name;
}
let ordSel = 0;
function paintOrder() {
  const h = mode === 'song' ? chip.head() : null; $('order').innerHTML = '';
  song.order.forEach((p, k) => { const b = document.createElement('button'); b.textContent = String(p).padStart(2, '0'); if (k === ordSel) b.classList.add('on'); if (h && h.o === k) b.classList.add('play'); b.title = song.patterns[p]?.name; b.onclick = () => { ordSel = k; pi = p; sel = null; refresh(); }; $('order').append(b); });
}
$('patName').onchange = e => { snap(); pat().name = e.target.value || 'P'; paintPats(); save(); };
$('patNew').onclick = () => { snap(); song.patterns.push(G.emptyPattern(song, String.fromCharCode(65 + song.patterns.length % 26))); pi = song.patterns.length - 1; refresh(); save(); };
$('patDup').onclick = () => { snap(); const P = clone(pat()); P.name += "'"; song.patterns.push(P); pi = song.patterns.length - 1; refresh(); save(); };
$('patClr').onclick = () => { snap(); pat().ch[ch] = Array(song.rows).fill(null); sel = null; refresh(); save(); };
$('patDel').onclick = () => { if (song.patterns.length < 2) return; snap(); song.patterns.splice(pi, 1); song.order = song.order.filter(i => i !== pi).map(i => i > pi ? i - 1 : i); pi = Math.max(0, pi - 1); fixSong(); refresh(); save(); };
$('ordAdd').onclick = () => { snap(); song.order.push(pi); ordSel = song.order.length - 1; refresh(); save(); };
$('ordDel').onclick = () => { if (song.order.length < 2) return; snap(); song.order.splice(ordSel, 1); ordSel = Math.min(ordSel, song.order.length - 1); refresh(); save(); };
const ordMove = d => { const j = ordSel + d; if (j < 0 || j >= song.order.length) return; snap(); [song.order[ordSel], song.order[j]] = [song.order[j], song.order[ordSel]]; ordSel = j; refresh(); save(); };
$('ordL').onclick = () => ordMove(-1); $('ordR').onclick = () => ordMove(1);

// ---------- piano roll
const roll = $('roll'), rctx = roll.getContext('2d'), wrap = $('rollWrap'), KW = 44, CH_H = 13;
const pitches = () => { if (isNoise()) return Array.from({ length: 16 }, (_, i) => i); const [lo, hi] = ch === 2 ? [28, 76] : [43, 96]; const a = []; for (let n = hi; n >= lo; n--) a.push(n); return a; };
let geo = { cw: 20, P: [] };
function drawRoll() {
  const P = pitches(), dpr = devicePixelRatio || 1, W = wrap.clientWidth, Hh = P.length * CH_H, rows = song.rows, cw = (W - KW) / rows;
  if (roll.width !== W * dpr || roll.height !== Hh * dpr) { roll.width = W * dpr; roll.height = Hh * dpr; roll.style.width = W + 'px'; roll.style.height = Hh + 'px'; }
  geo = { cw, P }; const c = rctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, Hh);
  const noise = isNoise();
  P.forEach((n, i) => { const black = !noise && [1, 3, 6, 8, 10].includes(n % 12); c.fillStyle = black ? '#0b0e14' : '#10141c'; c.fillRect(KW, i * CH_H, W - KW, CH_H);
    c.fillStyle = noise ? '#1a1f2b' : black ? '#20242e' : '#cfd6e3'; c.fillRect(0, i * CH_H, KW - 2, CH_H - 1);
    if (noise || n % 12 === 0) { c.fillStyle = noise || black ? '#9aa4b8' : '#202530'; c.font = '10px ui-monospace,monospace'; c.fillText(noise ? 'N' + n.toString(16).toUpperCase() : noteName(n), 3, i * CH_H + 10); }
    if (!noise && n % 12 === 0) { c.fillStyle = '#2a3140'; c.fillRect(KW, i * CH_H + CH_H - 1, W - KW, 1); } });
  for (let r = 0; r <= rows; r++) { c.fillStyle = r % 16 === 0 ? '#4a5568' : r % song.rpb === 0 ? '#2a3140' : '#171b24'; c.fillRect(KW + r * cw, 0, 1, Hh); }
  const rowY = n => { const i = P.indexOf(n); return i < 0 ? null : i * CH_H; };
  // ghosts
  if (!noise) pat().ch.forEach((a, k) => { if (k === ch || isNoise(k)) return; c.fillStyle = COL[k] + '30'; a.forEach((x, r) => { if (!x) return; const y = rowY(x.n); if (y != null) c.fillRect(KW + r * cw + 1, y + 2, x.l * cw - 2, CH_H - 4); }); });
  // cursor column (step input)
  if ($('stepRec').checked) { c.fillStyle = '#7ef0c822'; c.fillRect(KW + cursor * cw, 0, cw, Hh); }
  arr().forEach((x, r) => { if (!x) return; const y = rowY(x.n); if (y == null) return; const alpha = Math.round(120 + 135 * (x.v ?? 12) / 15).toString(16).padStart(2, '0');
    c.fillStyle = COL[ch] + alpha; c.fillRect(KW + r * cw + 1, y + 1, x.l * cw - 2, CH_H - 2);
    if (x.fx?.arp || x.fx?.slide) { c.fillStyle = '#000a'; c.fillRect(KW + r * cw + 1, y + CH_H - 4, x.l * cw - 2, 2); }
    if (r === sel) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(KW + r * cw + 1, y + 1, x.l * cw - 2, CH_H - 2); }
    if (x.l * cw > 26) { c.fillStyle = '#000c'; c.font = '9px ui-monospace,monospace'; c.fillText(noise ? 'N' + x.n.toString(16).toUpperCase() : noteName(x.n), KW + r * cw + 3, y + 10); } });
  const h = chip.playing ? chip.head() : null;
  if (h && h.p === pi) { c.fillStyle = '#7ef0c8'; c.fillRect(KW + h.r * cw, 0, 2, Hh); }
}
function hitAt(e) { const b = roll.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top; const row = Math.max(0, Math.min(song.rows - 1, Math.floor((x - KW) / geo.cw))), pIdx = Math.max(0, Math.min(geo.P.length - 1, Math.floor(y / CH_H))); return { x, row, pIdx, n: geo.P[pIdx] }; }
function noteAt(row, n) { const a = arr(); for (let r = row; r >= 0; r--) { const x = a[r]; if (x && x.n === n && r + x.l > row) return r; } return null; }
let drag = null;
roll.addEventListener('contextmenu', e => e.preventDefault());
roll.addEventListener('pointerdown', e => {
  const h = hitAt(e); chip.unlock();
  if (h.x < KW) { preview(h.n); return; }
  const hit = noteAt(h.row, h.n), a = arr();
  if (tool === 'erase' || e.button === 2) { if (hit != null) { snap(); a[hit] = null; sel = null; afterEdit(); } drag = { mode: 'erase' }; roll.setPointerCapture(e.pointerId); return; }
  roll.setPointerCapture(e.pointerId);
  if (hit != null) { sel = hit; const x = a[hit]; preview(x.n, x); const edge = h.row === hit + x.l - 1 && (x.l > 1 || (h.x - KW) / geo.cw - h.row > .6); drag = { mode: edge ? 'resize' : 'move', r0: hit, cur: hit, row0: h.row, i0: h.pIdx, moved: false }; if (edge) snap(); }
  else { snap(); a[h.row] = { n: h.n, l: Math.min(len, song.rows - h.row), v: 12 }; sel = h.row; preview(h.n); drag = { mode: 'resize', r0: h.row, created: true }; }
  drawRoll(); paintNoteEd();
});
roll.addEventListener('pointermove', e => {
  if (!drag) return; const h = hitAt(e), a = arr();
  if (drag.mode === 'erase') { const r = noteAt(h.row, h.n); if (r != null) { snap(); a[r] = null; afterEdit(); } return; }
  if (drag.mode === 'resize') { const x = a[drag.r0]; if (!x) return; const nl = Math.max(1, Math.min(song.rows - drag.r0, h.row - drag.r0 + 1)); if (nl !== x.l) { x.l = nl; len = nl; syncLen(); drawRoll(); paintNoteEd(); } return; }
  if (drag.mode === 'move') {
    const nr = Math.max(0, Math.min(song.rows - 1, drag.r0 + h.row - drag.row0)), ni = Math.max(0, Math.min(geo.P.length - 1, h.pIdx)), x = a[drag.cur]; if (!x) return;
    const nn = geo.P[ni]; if (nr === drag.cur && nn === x.n) return;
    if (!drag.moved) { snap(); drag.moved = true; }
    a[drag.cur] = null; const pitchChanged = nn !== x.n; x.n = nn; x.l = Math.min(x.l, song.rows - nr); a[nr] = x; drag.cur = nr; sel = nr; if (pitchChanged) preview(nn, x); drawRoll(); paintNoteEd();
  }
});
const endDrag = () => { if (drag) { drag = null; afterEdit(); } };
roll.addEventListener('pointerup', endDrag); roll.addEventListener('pointercancel', endDrag);
roll.addEventListener('dblclick', e => { const h = hitAt(e), r = noteAt(h.row, h.n); if (r != null) { snap(); arr()[r] = null; sel = null; afterEdit(); } });
function afterEdit() { save(); drawRoll(); drawLanes(); paintNoteEd(); paintChans(); }
function scrollToNotes() { const P = pitches(), ns = arr().filter(Boolean).map(x => P.indexOf(x.n)).filter(i => i >= 0); const mid = ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : P.indexOf(ch === 2 ? 45 : 69); wrap.scrollTop = Math.max(0, mid * CH_H - wrap.clientHeight / 2); }

// lanes overview
const lanes = $('lanes'), lctx = lanes.getContext('2d');
function drawLanes() {
  const dpr = devicePixelRatio || 1, W = lanes.clientWidth, H = 72; if (lanes.width !== W * dpr) { lanes.width = W * dpr; lanes.height = H * dpr; }
  const c = lctx, lh = H / 4, cw = (W - KW) / song.rows; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  pat().ch.forEach((a, k) => {
    c.fillStyle = k === ch ? '#1b2130' : '#0d1017'; c.fillRect(0, k * lh, W, lh - 1); c.fillStyle = COL[k]; c.font = '10px ui-monospace,monospace'; c.fillText(['P1', 'P2', 'TRI', 'NOI'][k] || k, 4, k * lh + 12);
    const ns = a.filter(Boolean).map(x => x.n), lo = Math.min(...ns, 999), hi = Math.max(...ns, -999), span = Math.max(1, hi - lo);
    a.forEach((x, r) => { if (!x) return; const y = k * lh + 2 + (1 - (x.n - lo) / span) * (lh - 7); c.globalAlpha = chip.chMute[k] ? .25 : 1; c.fillRect(KW + r * cw, y, Math.max(2, x.l * cw - 1), 3); }); c.globalAlpha = 1;
  });
  for (let r = 0; r <= song.rows; r += 16) { c.fillStyle = '#4a5568'; c.fillRect(KW + r * cw, 0, 1, H); }
  const h = chip.playing ? chip.head() : null; if (h && h.p === pi) { c.fillStyle = '#7ef0c8'; c.fillRect(KW + h.r * cw, 0, 2, H); }
}
lanes.onclick = e => { const b = lanes.getBoundingClientRect(); const k = Math.floor((e.clientY - b.top) / (b.height / 4)); if (k >= 0 && k < 4) selectCh(k); };

// roll toolbar
$('tools').onclick = e => { const t = e.target.dataset.tool; if (!t) return; tool = t; [...$('tools').children].forEach(b => b.classList.toggle('on', b.dataset.tool === t)); };
$('len').onchange = e => { len = +e.target.value; };
function syncLen() { const s = $('len'); if (![...s.options].some(o => +o.value === len)) s.append(new Option(len)); s.value = len; }
$('stepRec').onchange = () => drawRoll();

// note editor
function paintNoteEd() {
  const d = $('noteEd'), x = sel != null ? arr()[sel] : null;
  if (!x) { d.innerHTML = '<span>ノート未選択 — クリックで置く / 選んで編集。ステップ入力は z〜m キー。</span>'; return; }
  const noise = isNoise();
  d.innerHTML = `<b>${noise ? 'N' + x.n.toString(16).toUpperCase() : noteName(x.n)}</b> 行${sel} 長${x.l}
    <button data-a="up">↑</button><button data-a="dn">↓</button><button data-a="lf">←</button><button data-a="rt">→</button><button data-a="sh">長−</button><button data-a="lg">長＋</button>
    <label>音量 <input type="range" min="1" max="15" value="${x.v ?? 12}" data-k="v"></label>
    <label>音色 <select data-k="i"><option value="">ch既定</option>${song.instruments.map((s, k) => `<option value="${k}" ${x.i === k ? 'selected' : ''}>${k}:${s.name}</option>`).join('')}</select></label>
    ${noise ? '' : `<label>arp <input type="text" value="${x.fx?.arp || ''}" placeholder="037" data-k="arp"></label>`}
    <label>slide <input type="number" value="${x.fx?.slide || 0}" data-k="slide" style="width:50px"></label>
    <button data-a="del">削除</button>`;
  d.querySelectorAll('[data-a]').forEach(b => b.onclick = () => noteAct(b.dataset.a));
  d.querySelectorAll('[data-k]').forEach(inp => inp.onchange = () => { snap(); const k = inp.dataset.k, v = inp.value; if (k === 'v') x.v = +v; else if (k === 'i') { if (v === '') delete x.i; else x.i = +v; } else { x.fx ||= {}; if (k === 'arp') { if (/^[0-9a-f]+$/i.test(v)) x.fx.arp = v; else delete x.fx.arp; } else { if (+v) x.fx.slide = +v; else delete x.fx.slide; } if (!Object.keys(x.fx).length) delete x.fx; } preview(x.n, x); afterEdit(); });
}
function noteAct(a, big) {
  const A = arr(), x = sel != null ? A[sel] : null; if (!x) return; snap(); const noise = isNoise();
  const step = big ? 12 : 1, lim = n => noise ? Math.max(0, Math.min(15, n)) : Math.max(12, Math.min(108, n));
  if (a === 'up') x.n = lim(x.n + (noise ? -1 : step)); if (a === 'dn') x.n = lim(x.n - (noise ? -1 : step));
  if (a === 'lf' || a === 'rt') { const nr = sel + (a === 'lf' ? -1 : 1); if (nr >= 0 && nr < song.rows) { A[sel] = null; A[nr] = x; x.l = Math.min(x.l, song.rows - nr); sel = nr; } }
  if (a === 'sh') x.l = Math.max(1, x.l - 1); if (a === 'lg') x.l = Math.min(song.rows - sel, x.l + 1);
  if (a === 'del') { A[sel] = null; sel = null; } else if (a === 'up' || a === 'dn') preview(x.n, x);
  afterEdit();
}

// ---------- instrument editor
const field = (label, html, out = '') => `<span>${label}</span>${html}<output>${out}</output>`;
function paintInst() {
  const c = song.channels[ch], inst = song.instruments[c.inst]; $('instFor').textContent = `→ ${c.name}`;
  const rng = (k, min, max, step) => field(k, `<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${inst[k] ?? DEFAULT_INST[k] ?? 0}">`, (+(inst[k] ?? DEFAULT_INST[k] ?? 0)).toFixed(step < 1 ? (step < .01 ? 3 : 2) : 0));
  $('instEd').innerHTML = `<div class="kv">
    ${field('ch音色', `<select id="instSel">${song.instruments.map((s, k) => `<option value="${k}" ${k === c.inst ? 'selected' : ''}>${k}: ${s.name}</option>`).join('')}<option value="new">＋ 複製して新規</option></select>`)}
    ${field('名前', `<input type="text" data-k="name" value="${inst.name}">`)}
    ${field('波形', `<select data-k="wave">${['pulse', 'tri', 'saw', 'noise'].map(w => `<option ${inst.wave === w ? 'selected' : ''}>${w}</option>`).join('')}</select>`)}
    ${inst.wave === 'pulse' ? field('Duty', `<select data-k="duty">${[.125, .25, .5, .75].map(d => `<option value="${d}" ${+inst.duty === d ? 'selected' : ''}>${d * 100}%</option>`).join('')}</select>`) : ''}
    ${inst.wave === 'noise' ? field('Noise', `<select data-k="noiseMode">${['long', 'short'].map(m => `<option ${inst.noiseMode === m ? 'selected' : ''}>${m}</option>`).join('')}</select>`) : ''}
    ${rng('vol', 0, 1, .01)}${rng('a', 0, .5, .001)}${rng('d', .005, 1.5, .005)}${rng('s', 0, 1, .01)}${rng('r', .005, 1.5, .005)}
    ${rng('vib', 0, 80, 1)}${rng('vibRate', 1, 15, .5)}${rng('slide', -24, 24, 1)}
    ${inst.wave === 'noise' ? '' : field('arp', `<input type="text" data-k="arp" value="${inst.arp || ''}" placeholder="例 047">`)}
  </div><div class="row"><button id="instTry">試聴</button></div>`;
  $('instSel').onchange = e => { snap(); if (e.target.value === 'new') { song.instruments.push({ ...clone(inst), name: inst.name + '+' }); c.inst = song.instruments.length - 1; } else c.inst = +e.target.value; paintInst(); paintChans(); drawRoll(); save(); };
  $('instEd').querySelectorAll('[data-k]').forEach(el => { el.oninput = () => { const k = el.dataset.k; let v = el.value; if (el.type === 'range' || k === 'duty') v = +v; if (k === 'arp' && v && !/^[0-9a-f]+$/i.test(v)) return; inst[k] = v; const o = el.nextElementSibling; if (o?.tagName === 'OUTPUT') o.textContent = (+v).toFixed(el.step < 1 ? (el.step < .01 ? 3 : 2) : 0); save(); };
    el.onchange = () => { if (['wave', 'name'].includes(el.dataset.k)) { paintInst(); paintChans(); drawRoll(); } tryInst(); }; });
  $('instTry').onclick = tryInst;
}
function tryInst() { const x = sel != null ? arr()[sel] : null; preview(x ? x.n : isNoise() ? 6 : ch === 2 ? 45 : 69); }

// ---------- SFX sandbox
let sfxP = (() => { try { return JSON.parse(localStorage.getItem(LS_SFX)) || null; } catch (e) { return null; } })() || { ...SFX.pickup };
function paintSfx() {
  const p = sfxP, num = (k, min, max, step, def = 0) => field(k, `<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${p[k] ?? def}">`, (+(p[k] ?? def)).toFixed(step < 1 ? 2 : 0));
  $('sfxEd').innerHTML = `<div class="kv">
    ${field('プリセット', `<select id="sfxPre"><option value="">選ぶ…</option><optgroup label="ゲーム（廃墟の灯火）">${Object.keys(SFX).filter(k => !Array.isArray(SFX[k])).map(k => `<option value="g:${k}">${SFX_LABELS[k] || k}</option>`).join('')}</optgroup></select>`)}
    ${field('波形', `<select data-k="wave">${['pulse', 'tri', 'saw', 'noise-short'].map(w => `<option ${p.wave === w ? 'selected' : ''}>${w}</option>`).join('')}</select>`)}
    ${field('Duty', `<select data-k="duty">${[.125, .25, .5, .75].map(d => `<option value="${d}" ${+p.duty === d ? 'selected' : ''}>${d * 100}%</option>`).join('')}</select>`)}
    ${num('f0', 30, 3000, 1, 440)}${num('f1', 30, 3000, 1, p.f0)}${num('dur', .02, 2, .01, .2)}${num('vol', 0, 1, .01, .5)}
    ${num('noise', 0, 1, .01)}${num('steps', 0, 24, 1)}${num('vib', 0, 100, 1)}${num('vibRate', 1, 30, .5, 12)}
    ${field('arp', `<input type="text" data-k="arp" value="${(p.arp || []).join(',')}" placeholder="0,4,7,12">`)}${num('arpRate', 4, 60, 1, 30)}${num('repeat', 1, 6, 1, 1)}
  </div><div class="row"><button id="sfxPlay" class="pri">▶ 鳴らす</button><button id="sfxRnd">ランダム</button><button id="sfxWav">WAV</button><button id="sfxCopy">JSONコピー</button></div>`;
  $('sfxPre').onchange = e => { const k = e.target.value.slice(2); if (k) { sfxP = { ...SFX[k] }; paintSfx(); playSfx(); } };
  $('sfxEd').querySelectorAll('[data-k]').forEach(el => { el.oninput = () => { const k = el.dataset.k; let v = el.value; if (k === 'arp') v = v.split(/[ ,]+/).filter(Boolean).map(Number).filter(n => !isNaN(n)); else if (k !== 'wave') v = +v; sfxP[k] = v; const o = el.nextElementSibling; if (o?.tagName === 'OUTPUT') o.textContent = (+v).toFixed(el.step < 1 ? 2 : 0); localStorage.setItem(LS_SFX, JSON.stringify(sfxP)); }; el.onchange = playSfx; });
  $('sfxPlay').onclick = playSfx;
  $('sfxRnd').onclick = () => { const types = ['jump', 'coin', 'hit', 'laser', 'power', 'explode', 'magic', 'select']; const t = types[Math.random() * types.length | 0]; sfxP = G.generateSfx(t, Math.random() * 1e6 | 0).sfx; paintSfx(); playSfx(); };
  $('sfxWav').onclick = async () => download(await renderSfxWav(sfxP), 'sfx.wav');
  $('sfxCopy').onclick = () => { navigator.clipboard?.writeText(JSON.stringify(sfxP)); log('SFX パラメータ JSON をコピーした'); };
}
function playSfx() { chip.unlock(); chip.sfx(sfxP); }

// ---------- AI
function log(s) { $('aiLog').textContent = s; }
function runPrompt(p, seed) {
  const a = G.analyze(p);
  if (a.kind === 'sfx') { const { sfx } = G.generateSfx(p, seed); sfxP = sfx; paintSfx(); playSfx(); log(`効果音「${a.sfxType}」を生成 → 右のSFXサンドボックスで調整できる（seed ${seed}）`); $('sfxEd').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  const { song: s, info } = G.generateSong(p, seed); stop(); loadSong(s); ch = 0; refresh(); scrollToNotes();
  log(`曲を生成: ${info.tags.join('・') || '標準'} / ${s.meta.scale} root ${noteName(s.meta.root)} / ${s.bpm}BPM / パターン${s.patterns.length}・オーダー${s.order.length}（seed ${seed}）— 全ノート手で編集可`);
  play(false);
}
$('gen').onclick = () => { const p = $('prompt').value.trim() || '廃墟探索BGM'; seedN = 0; lastPrompt = p; runPrompt(p, 0); };
$('alt').onclick = () => { const p = $('prompt').value.trim() || lastPrompt || '廃墟探索BGM'; seedN = p === lastPrompt ? seedN + 1 : 1; lastPrompt = p; runPrompt(p, seedN); };
$('prompt').onkeydown = e => { if (e.key === 'Enter') $('gen').click(); };
$('chips').innerHTML = G.SUGGEST.map(([t, k]) => `<button class="${k}" title="${k === 'sfx' ? '効果音' : '曲'}">${k === 'sfx' ? '♪ ' : '♫ '}${t}</button>`).join('');
$('chips').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('prompt').value = b.textContent.slice(2); $('gen').click(); };
document.querySelectorAll('[data-ai]').forEach(b => b.onclick = () => {
  snap(); const sd = Math.random() * 1e9 | 0, a = b.dataset.ai;
  if (a === 'fill') { G.aiFill(song, pi, ch, sd); log(`${song.channels[ch].name} を他チャンネルの和音推定から生成`); }
  if (a === 'vary') { G.aiVary(song, pi, ch, sd); log(`${song.channels[ch].name} をリズムを保って変奏`); }
  if (a === 'bass') { G.aiBassFromMelody(song, pi, sd); ch = 2; log('Pulse1/2 から小節ごとの和音を推定 → Triangle ベース'); }
  if (a === 'drums') { G.aiDrums(song, pi, sd); ch = 3; log('ノイズドラムのグルーヴを生成'); }
  if (a === 'mutate') { G.aiMutate(song, pi, sd); log('パターン全体を少しずつ変異'); }
  if (a === 'next') { const ni = G.aiNextPattern(song, pi, sd); song.order.splice(Math.max(song.order.indexOf(pi), song.order.length - 1) + 1, 0, ni); pi = ni; log(`続きのパターン ${ni} を生成してオーダーに追加`); }
  sel = null; refresh(); save(); if (!mode) play(true);
});

// ---------- keyboard
const KEYS = 'zsxdcvgbhnjm,l.;/'; const KEYS2 = 'q2w3er5t6y7ui9o0p';
addEventListener('keydown', e => {
  const tag = e.target.tagName; if (tag === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); e.shiftKey ? (mode === 'pat' ? stop() : play(true)) : (mode === 'song' ? stop() : play(false)); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); noteAct('del'); return; }
  if (e.key.startsWith('Arrow')) { e.preventDefault(); if (sel == null) { if (e.key === 'ArrowLeft') cursor = Math.max(0, cursor - 1); if (e.key === 'ArrowRight') cursor = Math.min(song.rows - 1, cursor + 1); drawRoll(); return; } noteAct({ ArrowUp: 'up', ArrowDown: 'dn', ArrowLeft: e.shiftKey ? 'sh' : 'lf', ArrowRight: e.shiftKey ? 'lg' : 'rt' }[e.key], e.shiftKey); return; }
  if (e.key === '[') return noteAct('sh'); if (e.key === ']') return noteAct('lg');
  if (e.key === '-' || e.key === '=') { const o = $('oct'); o.value = Math.max(1, Math.min(7, +o.value + (e.key === '=' ? 1 : -1))); return; }
  if (e.repeat) return;
  const k = e.key.toLowerCase(); let semi = KEYS.indexOf(k); if (semi < 0) { semi = KEYS2.indexOf(k); if (semi >= 0) semi += 12; }
  if (semi < 0) return; e.preventDefault();
  const n = isNoise() ? Math.max(0, Math.min(15, 15 - semi)) : (+$('oct').value + 1) * 12 + semi;
  preview(n);
  if ($('stepRec').checked) { snap(); arr()[cursor] = { n, l: Math.min(len, song.rows - cursor), v: 12 }; sel = cursor; cursor = (cursor + len) % song.rows; afterEdit(); }
});

// ---------- refresh / loop
function refresh() {
  $('bpm').value = song.bpm; $('rows').value = song.rows; $('swing').value = song.swing || 0; $('echo').value = song.echo || 0;
  $('chLabel').innerHTML = `<span style="color:${COL[ch]}">● ${song.channels[ch].name}</span> <small style="color:var(--mut)">${song.title || ''}</small>`;
  paintChans(); paintPats(); paintOrder(); paintInst(); paintNoteEd(); drawRoll(); drawLanes();
}
const scope = $('scope'), sctx = scope.getContext('2d'); let buf; let lastHead = '';
function loop() {
  if (chip.analyser) { buf ||= new Uint8Array(chip.analyser.fftSize); chip.analyser.getByteTimeDomainData(buf); sctx.fillStyle = '#05070a'; sctx.fillRect(0, 0, 120, 28); sctx.strokeStyle = '#7ef0c8'; sctx.beginPath(); for (let i = 0; i < 120; i++) { const v = buf[i * 4] / 255; i ? sctx.lineTo(i, v * 28) : sctx.moveTo(i, v * 28); } sctx.stroke(); }
  if (chip.playing) {
    const h = chip.head(); const key = h ? `${h.o}:${h.r}` : '';
    if (key !== lastHead) { lastHead = key; if (h && mode === 'song' && $('follow').checked && h.p !== pi && !drag) { pi = h.p; sel = null; ordSel = h.o; refresh(); } else { drawRoll(); drawLanes(); } if (h && h.r === 0) paintOrder(); }
  } else if (mode) { mode = null; paintTransport(); }
  requestAnimationFrame(loop);
}
addEventListener('resize', () => { drawRoll(); drawLanes(); });
refresh(); scrollToNotes(); requestAnimationFrame(loop);
if (qs && EX[qs]) log(`「${EX[qs][0]}」を開いた。▶ 曲 で再生、ノートはそのまま編集できる（ゲーム本体には反映されない）`);
else log('プロンプトかチップを押すとローカル生成 → そのまま手で編集。最初の再生でオーディオが有効になる。');
window.__daw = { get song() { return song; }, chip, G };
