// 廃墟の灯火 — PS1 TPS Explore RPG (main: player, camera, input, interactions, UI)
import * as THREE from 'three';
import { U, T, M, createPipeline, computeBounce } from './render.js';
import { buildWorld, find, cellAt, C, H, isIndoor } from './world.js';
import * as St from './state.js';
import * as Dlg from './dialogue.js';
const { S, ITEMS } = St;
const $ = id => document.getElementById(id);
const V3 = THREE.Vector3;

// ---------- renderer / scene
const R = new THREE.WebGLRenderer({ antialias: false }); R.setPixelRatio(1); R.setSize(innerWidth, innerHeight); document.body.prepend(R.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(.05, .055, .075);
const cam = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, .05, 80);
const pipe = createPipeline(R);
const W = buildWorld(scene);
addEventListener('resize', () => { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); R.setSize(innerWidth, innerHeight); pipe.resize(); });

// ---------- player mesh (low-poly)
const START = find('S'), HALL_SAFE = new V3(17, 0, 17.4);
const P = { pos: START.clone(), y: 0, vy: 0, face: Math.PI, falling: false, kb: new V3(), inv: 0, atkCd: 0, swing: 0, moving: 0 };
const pg = new THREE.Group(); scene.add(pg);
const add = (geo, mat, pos, rot = [0, 0, 0], parent = pg) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); m.rotation.set(...rot); parent.add(m); return m; };
const mCloak = M(T.cloak), mSkin = M(T.skin), mDarkP = M(T.hood), mIronP = M(T.iron), mWoodP = M(T.wood), mFl = M(T.flame, [1, 1], 0xff8a2a);
add(new THREE.CylinderGeometry(.2, .34, .85, 7, 2), mCloak, [0, .78, 0]);
add(new THREE.SphereGeometry(.19, 7, 5), mSkin, [0, 1.37, 0]);
add(new THREE.ConeGeometry(.24, .38, 7), mCloak, [0, 1.55, -.05], [-.35, 0, 0]);
add(new THREE.SphereGeometry(.22, 9, 6, Math.PI * .8, Math.PI * 1.4), mCloak, [0, 1.38, 0]); // hood back
add(new THREE.BoxGeometry(.06, .06, .05), mDarkP, [-.07, 1.4, .17]); add(new THREE.BoxGeometry(.06, .06, .05), mDarkP, [.07, 1.4, .17]);
const legL = add(new THREE.BoxGeometry(.13, .4, .14), mDarkP, [-.1, .2, 0]), legR = add(new THREE.BoxGeometry(.13, .4, .14), mDarkP, [.1, .2, 0]);
const armR = new THREE.Group(); armR.position.set(.3, 1.08, 0); pg.add(armR); add(new THREE.BoxGeometry(.1, .4, .1), mCloak, [0, -.18, 0], [0, 0, 0], armR);
const rodMesh = add(new THREE.CylinderGeometry(.03, .04, 1.0, 5), mIronP, [0, -.35, .4], [Math.PI / 2, 0, 0], armR);
const armL = new THREE.Group(); armL.position.set(-.3, 1.08, 0); pg.add(armL); add(new THREE.BoxGeometry(.1, .4, .1), mCloak, [0, -.18, 0], [0, 0, 0], armL);
const torchMesh = new THREE.Group(); torchMesh.position.set(0, -.35, .15); armL.add(torchMesh);
add(new THREE.CylinderGeometry(.04, .03, .55, 5), mWoodP, [0, .1, 0], [0, 0, 0], torchMesh);
const torchFlame = add(new THREE.ConeGeometry(.09, .3, 6), mFl, [0, .5, 0], [0, 0, 0], torchMesh);

// ---------- slime
const SL = { home: find('s').clone(), pos: find('s').clone(), hp: 3, alive: true, hop: 0, flash: 0, cd: 0, dead: 0, kb: new V3() };
const mSlime = M(T.slime);
const slimeMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(.5, 1), mSlime); scene.add(slimeMesh);

// ---------- game state
let mode = 'title', camYaw = 0, camPitch = .32, camDist = 3.6, renderMode = 'ps1b', fade = 0, fadeT = 0, clearT = 0;
const MODES = { ps1b: 'PS1＋バウンス', ps1: 'PS1', clean: 'クリーン' };
const keys = new Set(); const joy = { x: 0, y: 0 };
const panelOpen = () => Dlg.isOpen() || $('inv').classList.contains('show') || mode !== 'play';

// ---------- UI helpers
function toast(msg) { const d = document.createElement('div'); d.className = 'toast panel'; d.textContent = msg; $('toasts').append(d); setTimeout(() => d.remove(), 3300); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); }
St.onFlag((k, v) => { const d = document.createElement('div'); d.textContent = `flags.${k} = ${v}`; $('flaglog').append(d); setTimeout(() => d.remove(), 6000); });
function hud() {
  $('hp').textContent = '♥'.repeat(S.hp) + '♡'.repeat(S.maxHp - S.hp);
  $('objText').textContent = St.objective();
  if ($('inv').classList.contains('show')) renderInv();
}
St.onChange(hud);

// ---------- inventory UI
let invSel = 0;
function itemDesc(id) { if (id === 'torch' && St.flag('torchLit')) return '火のついた松明。暗い場所を照らし、火鉢に火を移せる。'; if (id === 'memo' && St.flag('readMemo')) return '先代の灯守りの覚え書き。「火は焚き火より。鍵は闇の倉に眠る。橋は東の歯車で上がる。」'; return ITEMS[id].desc; }
function itemName(id) { return id === 'torch' && St.flag('torchLit') ? '松明（火）' : ITEMS[id].name; }
function renderInv() {
  const L = $('invList'); L.innerHTML = ''; invSel = Math.min(invSel, Math.max(0, S.inv.length - 1));
  if (!S.inv.length) L.innerHTML = '<div style="color:#9a9284">何も持っていない。</div>';
  S.inv.forEach((it, i) => { const b = document.createElement('button'); if (i === invSel) b.classList.add('sel'); b.innerHTML = `<span>${ITEMS[it.id].icon} ${itemName(it.id)}</span><span>×${it.n}</span>`; b.onclick = () => { invSel = i; renderInv(); }; b.ondblclick = () => useItem(it.id); L.append(b); });
  const cur = S.inv[invSel]; $('invDesc').textContent = cur ? itemDesc(cur.id) : 'アイテムを拾うとここに並ぶ。';
  const now = St.objective(); let foundNow = false;
  $('quest').innerHTML = St.QUEST.map(([k, label]) => { const done = St.flag(k); let cls = done ? 'done' : ''; if (!done && !foundNow) { cls = 'now'; foundNow = true; } return `<div class="${cls}">${done ? '✔' : cls === 'now' ? '▶' : '・'} ${label}</div>`; }).join('') + `<div class="now" style="margin-top:4px">目的: ${now}</div>`;
  $('flags').innerHTML = St.FLAG_KEYS.map(k => `<span class="${St.flag(k) ? 'on' : ''}">${k}</span>`).join('');
}
function openInv() { if (mode !== 'play' || Dlg.isOpen()) return; document.exitPointerLock?.(); $('inv').classList.add('show'); renderInv(); }
function closeInv() { $('inv').classList.remove('show'); }
$('invBtn').onclick = () => $('inv').classList.contains('show') ? closeInv() : openInv();
$('invClose').onclick = closeInv; $('useBtn').onclick = () => { const it = S.inv[invSel]; if (it) useItem(it.id); };

// ---------- proximity helpers
const OBJ = { campfire: find('f'), brazier: find('F'), door: find('D'), crate: find('X'), lever: find('L'), altar: find('A'), npc: find('N'), gate: find('G'), plate: find('p') };
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const near = (id, r = 2.3) => dist2d(P.pos, OBJ[id]) < r;

// ---------- actions (shared by E-interact and inventory use)
function lightTorch() { St.setFlag('torchLit'); toast('松明に火がついた！'); }
function lightBrazier() { St.setFlag('brazierLit'); toast('火鉢に火が灯った……床に何か光っている！'); }
function breakCrate() { St.setFlag('crateBroken'); W.shatter(P.pos.clone()); shake = .35; toast('バキッ！ 木箱の山が崩れた'); }
function openDoor() { St.removeItem('key'); St.setFlag('doorOpen'); shake = .2; toast('ギィィ……鉄扉が開いた'); }
function useItem(id) {
  const f = S.flags;
  if (id === 'herb') { if (S.hp >= S.maxHp) return toast('体力は満タンだ'); St.removeItem('herb'); St.setHp(S.hp + 2); return toast('薬草を使った。体力が回復した'); }
  if (id === 'memo') { closeInv(); St.setFlag('readMemo'); return Dlg.say([{ who: '古びたメモ', text: '――灯守りの覚え書き。\n「火は中庭の焚き火より。鍵は闇の倉に眠り、灯をともせば姿を現す。」' }, { who: '古びたメモ', text: '「鉄扉の前の床は崩れた。橋は東の部屋の歯車（レバー）で上がる。」\n……番人に見せれば何か教えてくれるかもしれない。' }]); }
  if (id === 'torch') {
    if (!f.torchLit && near('campfire', 2.4)) { closeInv(); return lightTorch(); }
    if (f.torchLit && !f.brazierLit && near('brazier', 2.4)) { closeInv(); return lightBrazier(); }
    return toast(f.torchLit ? '松明を掲げた。あたりが少し明るい' : '火がついていない。焚き火で火をつけよう');
  }
  if (id === 'key') { if (!f.doorOpen && near('door', 2.6)) { closeInv(); return openDoor(); } return toast('ここで使えるものはない'); }
  if (id === 'rod') { if (!f.crateBroken && near('crate', 2.4)) { closeInv(); return breakCrate(); } return toast('F キー / 左クリックで振れる'); }
}

// ---------- NPC dialogue (branches on flags + items)
const NPC = '灯守りの老人';
function npcTalk() {
  const f = S.flags;
  if (f.cleared) return Dlg.say([{ who: NPC, text: '霧が晴れていく……ありがとう、旅の者。この灯は、もう消えまい。' }]);
  if (!f.spokeNpc) {
    const end = () => [{ who: NPC, text: 'まずは北の門じゃ。中庭の石板と繋がっておる。……祭壇の灯を、頼んだぞ。', act: () => St.setFlag('spokeNpc') }];
    return Dlg.say([
      { who: NPC, text: '……おや、こんな霧の夜に旅の者とは珍しい。' },
      { who: NPC, text: 'ここはかつて“灯火の聖堂”と呼ばれた場所。奥の祭壇の灯が消えてから、この霧が晴れんのじゃ。', choices: [
        { label: '祭壇へはどう行けばいい？', then: () => [{ who: NPC, text: '北の門を抜け、崩れた回廊を越え、鉄扉の奥じゃ。鍵は……どこへやったかのう。' }, ...end()] },
        { label: 'あなたは誰？', then: () => [{ who: NPC, text: 'ただの灯守りよ。灯を守れなかった、な。足が悪くてもう奥へは行けん。' }, ...end()] },
      ] },
    ]);
  }
  const ch = [{ label: 'ヒントをくれ', then: () => [{ who: NPC, text: St.hint() }] }];
  if (f.readMemo && !f.memoShown) ch.push({ label: '古びたメモを見せる', then: () => [{ who: NPC, text: 'これは先代の字じゃ……「火は焚き火より、鍵は闇の倉に」。', act: () => St.setFlag('memoShown') }, { who: NPC, text: '西の倉庫は灯りがない。松明に火を移して、奥の火鉢を灯すのじゃ。それと、扉前の穴には東のレバーで橋が架かる。' }] });
  if (St.hasItem('key') && !f.doorOpen) ch.push({ label: '鍵を見せる', then: () => [{ who: NPC, text: 'おお、まさしく鉄扉の鍵！' + (f.bridgeUp ? ' 橋も上がっておる、扉の前で使うがよい。' : ' じゃが扉の前は穴じゃ。東の部屋のレバーで橋を上げい。') }] });
  if (S.hp < S.maxHp && !f.npcGaveHerb) ch.push({ label: '傷を見てほしい', then: () => [{ who: NPC, text: 'ひどい顔じゃ。これを持っていけ。', act: () => { St.setFlag('npcGaveHerb'); St.addItem('herb'); toast('薬草を受け取った'); } }] });
  ch.push({ label: 'またあとで', then: () => null });
  const greet = f.slimeDefeated ? '守りのスライムを退けたか！ あとは祭壇じゃ。' : f.doorOpen ? '鉄扉が開いた音がしたぞ。気をつけるのじゃ、奥には古い守りがおる。' : f.gateOpen ? '門が開いたようじゃな。' : 'どうした、旅の者。';
  Dlg.say([{ who: NPC, text: greet, choices: ch }]);
}

// ---------- interactables
const pick = (id) => { const p = W.pickups.find(q => q.id === id); return p; };
function pickup(p) {
  St.setFlag(p.flag); St.addItem(p.id); toast(`${ITEMS[p.id].icon} ${ITEMS[p.id].name} を手に入れた`);
  if (p.id === 'memo') toast('持ち物（I）から読める');
}
const INTER = [
  { pos: OBJ.npc, r: 2.0, label: () => '話す：灯守りの老人', act: npcTalk },
  { pos: OBJ.campfire, r: 2.0, label: () => St.hasItem('torch') && !St.flag('torchLit') ? '松明に火をつける' : '調べる：焚き火', act: () => St.hasItem('torch') && !St.flag('torchLit') ? lightTorch() : toast('暖かい焚き火だ。火種になりそうだ') },
  { pos: OBJ.crate, r: 2.2, on: () => !St.flag('crateBroken'), label: () => St.hasItem('rod') ? '鉄棒で木箱を壊す' : '調べる：木箱の山', act: () => St.hasItem('rod') ? breakCrate() : toast('重くて動かない。叩き壊す道具があれば……') },
  { pos: OBJ.brazier, r: 2.0, on: () => !St.flag('brazierLit'), label: () => St.flag('torchLit') ? '火鉢に火を灯す' : '調べる：火鉢', act: () => St.flag('torchLit') ? lightBrazier() : toast(St.hasItem('torch') ? '松明に火がついていない' : '冷えた火鉢だ。火種があれば灯せそうだ') },
  { pos: OBJ.lever, r: 1.8, label: () => St.flag('bridgeUp') ? '調べる：レバー' : 'レバーを引く', act: () => { if (St.flag('bridgeUp')) return toast('レバーはもう倒れている'); St.setFlag('bridgeUp'); shake = .25; toast('ゴゴゴ……どこかで橋がせり上がった'); } },
  { pos: OBJ.door.clone().setZ(OBJ.door.z + 1.1), r: 1.9, on: () => !St.flag('doorOpen'), label: () => St.hasItem('key') ? '鍵で鉄扉を開ける' : '調べる：鉄扉', act: () => St.hasItem('key') ? openDoor() : toast('鍵がかかっている。錆びた鍵穴だ') },
  { pos: OBJ.gate.clone().setZ(OBJ.gate.z + .9), r: 1.8, on: () => !St.flag('gateOpen'), label: () => '調べる：鉄格子の門', act: () => toast('びくともしない。中庭の石板と連動しているようだ') },
  { pos: OBJ.altar, r: 2.1, label: () => St.flag('cleared') ? '祭壇' : '祭壇に触れる', act: touchAltar },
  ...W.pickups.map(p => ({ pos: p.pos, r: 1.5, on: () => p.g.visible, label: () => `拾う：${ITEMS[p.id].name}`, act: () => pickup(p) })),
];
let focus = null;
function updateFocus() {
  focus = null; let best = 1e9;
  for (const it of INTER) { if (it.on && !it.on()) continue; const d = dist2d(P.pos, it.pos); if (d < it.r && d < best) { best = d; focus = it; } }
  const pr = $('prompt');
  if (focus && !panelOpen()) { pr.style.display = 'block'; pr.innerHTML = `<b>[E]</b> ${focus.label()}`; } else pr.style.display = 'none';
}
function interact() { if (focus) focus.act(); }
function touchAltar() {
  if (St.flag('cleared')) return toast('祭壇の灯が静かに揺れている');
  if (!St.flag('slimeDefeated')) return toast('スライムが邪魔をして祭壇に近づけない！');
  St.setFlag('cleared'); toast('祭壇に灯がともった！'); clearT = 2.2;
}

// ---------- combat
let shake = 0;
function attack() {
  if (mode !== 'play' || panelOpen() || P.atkCd > 0) return;
  if (!St.hasItem('rod')) { P.atkCd = .6; return toast('素手では心もとない。武器になる物を探そう'); }
  P.atkCd = .45; P.swing = .3;
  const fwd = new V3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  if (!P.moving) P.face = Math.atan2(fwd.x, fwd.z);
  const facing = new V3(Math.sin(P.face), 0, Math.cos(P.face));
  if (SL.alive && St.flag('doorOpen')) { const d = SL.pos.clone().sub(P.pos).setY(0); if (d.length() < 1.9 && d.normalize().dot(facing) > .2) hitSlime(facing); }
  if (!St.flag('crateBroken') && dist2d(P.pos, OBJ.crate) < 2.3) breakCrate();
}
function hitSlime(dir) {
  SL.hp--; SL.flash = .2; SL.kb.copy(dir).multiplyScalar(5); shake = .12;
  if (SL.hp <= 0) { SL.alive = false; SL.dead = .001; St.setFlag('slimeDefeated'); toast('スライムは霧に溶けて消えた！'); }
  else toast(`スライムに命中！（残り ${SL.hp}）`);
}
function hurt(n, from) {
  if (P.inv > 0 || mode !== 'play') return; P.inv = 1.1; St.setHp(S.hp - n); shake = .25;
  if (from) P.kb.copy(P.pos.clone().sub(from).setY(0).normalize().multiplyScalar(7));
  if (S.hp <= 0) { toast('力尽きた……中庭で目を覚ました'); S.deaths++; fadeT = 1; respawnAt = START.clone(); St.setHp(S.maxHp); }
  else toast('ダメージを受けた！');
}
let respawnAt = null;

// ---------- input
function look(dx, dy) { camYaw -= dx * .0028; camPitch = Math.max(-.25, Math.min(1.1, camPitch + dy * .0022)); }
function cycleMode() { const ks = Object.keys(MODES); renderMode = ks[(ks.indexOf(renderMode) + 1) % ks.length]; $('modeBtn').textContent = MODES[renderMode]; toast(`描画: ${MODES[renderMode]}`); }
$('modeBtn').onclick = cycleMode;
function handleKey(code, e) {
  if (mode === 'title') { if (code === 'Enter') ($('contBtn').style.display !== 'none' ? $('contBtn') : $('newBtn')).click(); return; }
  if (Dlg.isOpen()) {
    if (['KeyE', 'Space', 'Enter'].includes(code)) Dlg.next();
    const m = code.match(/^Digit([1-4])$/); if (m) Dlg.choose(+m[1] - 1);
    return;
  }
  if ($('inv').classList.contains('show')) {
    if (['Escape', 'KeyI', 'Tab'].includes(code)) closeInv();
    if (['ArrowUp', 'KeyW'].includes(code)) { invSel = Math.max(0, invSel - 1); renderInv(); }
    if (['ArrowDown', 'KeyS'].includes(code)) { invSel = Math.min(S.inv.length - 1, invSel + 1); renderInv(); }
    if (['Enter', 'KeyE'].includes(code)) { const it = S.inv[invSel]; if (it) useItem(it.id); }
    return;
  }
  if (mode !== 'play') return;
  if (code === 'KeyE') interact();
  if (code === 'KeyF') attack();
  if (code === 'KeyI' || code === 'Tab') openInv();
  if (code === 'KeyP') cycleMode();
}
addEventListener('keydown', e => {
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!e.repeat) handleKey(e.code, e); keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
$('dlg').onclick = () => Dlg.next();
const cv = R.domElement; let drag = null;
cv.addEventListener('mousedown', e => {
  if (mode !== 'play' || panelOpen()) return;
  if (document.pointerLockElement === cv) { if (e.button === 0) attack(); return; }
  drag = { x: e.clientX, y: e.clientY, moved: 0 };
});
addEventListener('mousemove', e => {
  if (document.pointerLockElement === cv) return look(e.movementX, e.movementY);
  if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy); look(dx, dy); }
});
addEventListener('mouseup', () => { if (drag && drag.moved < 4 && !document.body.classList.contains('touch')) { try { const p = cv.requestPointerLock(); p?.catch?.(() => { }); } catch (e) { } } drag = null; });
document.addEventListener('pointerlockchange', () => { $('cross').style.display = document.pointerLockElement === cv ? 'block' : 'none'; });
// touch: left = joystick, right = look; buttons
const touches = new Map();
cv.addEventListener('touchstart', e => { document.body.classList.add('touch'); for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX, y: t.clientY, ox: t.clientX, oy: t.clientY, joy: t.clientX < innerWidth * .4 }); e.preventDefault(); }, { passive: false });
cv.addEventListener('touchmove', e => { for (const t of e.changedTouches) { const s = touches.get(t.identifier); if (!s) continue;
  if (s.joy) { const dx = t.clientX - s.ox, dy = t.clientY - s.oy, l = Math.max(1, Math.hypot(dx, dy)), k = Math.min(1, l / 50); joy.x = dx / l * k; joy.y = -dy / l * k; $('joyK').style.transform = `translate(${joy.x * 40}px,${-joy.y * 40}px)`; }
  else { look((t.clientX - s.x) * 1.4, (t.clientY - s.y) * 1.4); } s.x = t.clientX; s.y = t.clientY; } e.preventDefault(); }, { passive: false });
const tend = e => { for (const t of e.changedTouches) { const s = touches.get(t.identifier); if (s?.joy) { joy.x = joy.y = 0; $('joyK').style.transform = ''; } touches.delete(t.identifier); } };
cv.addEventListener('touchend', tend); cv.addEventListener('touchcancel', tend);
document.querySelectorAll('#tbtn button').forEach(b => b.addEventListener('touchstart', e => { e.preventDefault(); handleKey(b.dataset.k); }, { passive: false }));
if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');

// ---------- collision
function collide(p, r) {
  for (let it = 0; it < 2; it++) for (const c of W.colliders) {
    if (c.on && !c.on()) continue;
    const qx = Math.max(c.x0, Math.min(p.x, c.x1)), qz = Math.max(c.z0, Math.min(p.z, c.z1));
    const dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
    else { const l = p.x - c.x0, rr = c.x1 - p.x, t = p.z - c.z0, b = c.z1 - p.z, m = Math.min(l, rr, t, b); if (m === l) p.x = c.x0 - r; else if (m === rr) p.x = c.x1 + r; else if (m === t) p.z = c.z0 - r; else p.z = c.z1 + r; }
  }
}
function camBlocked(q) {
  for (const c of W.camBlockers) { if (c.on && !c.on()) continue; if (q.x > c.x0 - .2 && q.x < c.x1 + .2 && q.z > c.z0 - .2 && q.z < c.z1 + .2) return true; }
  return false;
}

// ---------- lights
const lightKey = () => `${St.flag('brazierLit')}|${St.flag('cleared')}|${renderMode}`; let lastLK = '';
function updateLights(t) {
  const fl = s => 1 + .08 * Math.sin(t * 23 + s) * Math.sin(t * 7.1 + s);
  if (St.flag('torchLit')) { const wp = new V3(); torchFlame.getWorldPosition(wp); U.uLP.value[0].copy(wp); U.uLC.value[0].set(1, .58, .28).multiplyScalar(2.6 * fl(9)); }
  else { U.uLP.value[0].set(P.pos.x, 1.8, P.pos.z); U.uLC.value[0].set(.1, .1, .13); }
  W.lightDefs.forEach((d, i) => { if (!d) return; const on = !d.off || St.flag(d.off); U.uLP.value[i].copy(d.pos); U.uLC.value[i].copy(d.col).multiplyScalar(on ? (d.flick ? fl(i) : 1) * (i === 5 && St.flag('cleared') ? 2.5 : 1) : 0); });
  const lk = lightKey();
  if (lk !== lastLK) { lastLK = lk; computeBounce(W.lightDefs.filter(Boolean).filter(d => !d.off || St.flag(d.off)).map(d => ({ pos: d.pos, col: d.col })), W.bounceMeshes); }
}

// ---------- start / save
function startGame(cont) {
  $('title').classList.remove('show'); mode = 'play';
  P.pos.copy(START); camYaw = 0; P.face = Math.PI;
  if (cont && S.pos && cellAt(S.pos[0], S.pos[1]) !== '#' && !'PB'.includes(cellAt(S.pos[0], S.pos[1]))) { P.pos.set(S.pos[0], 0, S.pos[1]); camYaw = S.yaw || 0; }
  SL.alive = !St.flag('slimeDefeated'); SL.hp = 3; SL.pos.copy(SL.home); slimeMesh.visible = SL.alive;
  W.o.crate.visible = !St.flag('crateBroken');
  // snap animated gimmicks to their saved state
  W.o.gate.position.y = St.flag('gateOpen') ? 3.3 : 0; W.o.door.rotation.y = St.flag('doorOpen') ? 1.6 : 0; W.o.bridge.position.y = St.flag('bridgeUp') ? -.125 : -2.8; W.o.lever.rotation.x = St.flag('bridgeUp') ? .7 : -.7;
  hud();
  if (!cont) Dlg.say([{ who: '', text: '霧の夜。灯の消えた聖堂の中庭にたどり着いた。\n焚き火のそばに、誰かがいる……。' }]);
  else toast('つづきから再開した（セーブ読込）');
}
$('newBtn').onclick = () => { St.reset(); startGame(false); };
$('contBtn').onclick = () => { St.load(); startGame(true); };
if (St.hasSave()) $('contBtn').style.display = '';
$('againBtn').onclick = () => { St.reset(); location.reload(); };
$('stayBtn').onclick = () => { $('clear').classList.remove('show'); mode = 'play'; };

// ---------- main loop
const clk = new THREE.Clock(); let t = 0, saveT = 0;
const tmp = new V3();
function frame() {
  const dt = Math.min(.05, clk.getDelta()); t += dt;
  const f = S.flags; Dlg.tick(dt);
  if (mode === 'play' || mode === 'clear') S.playMs += dt * 1000 * (mode === 'play' ? 1 : 0);
  // --- player
  P.atkCd = Math.max(0, P.atkCd - dt); P.inv = Math.max(0, P.inv - dt); P.swing = Math.max(0, P.swing - dt);
  let ix = 0, iy = 0;
  if (mode === 'play' && !panelOpen()) {
    ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
    iy = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + joy.y;
  }
  const fwd = new V3(-Math.sin(camYaw), 0, -Math.cos(camYaw)), right = new V3(Math.cos(camYaw), 0, -Math.sin(camYaw));
  const dir = fwd.multiplyScalar(iy).add(right.multiplyScalar(ix)); const dl = dir.length(); if (dl > 1) dir.divideScalar(dl);
  P.moving = dl > .05 && !P.falling;
  if (!P.falling) {
    const sp = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5.6 : 3.4;
    P.pos.addScaledVector(dir, sp * dt).addScaledVector(P.kb, dt); P.kb.multiplyScalar(Math.exp(-dt * 8));
    collide(P.pos, .33);
    if (P.moving) { const target = Math.atan2(dir.x, dir.z); let d = target - P.face; d = Math.atan2(Math.sin(d), Math.cos(d)); P.face += d * Math.min(1, dt * 12); }
    const ch = cellAt(P.pos.x, P.pos.z);
    if (ch === 'P' || (ch === 'B' && !f.bridgeUp)) { P.falling = true; P.vy = 0; toast('足元が崩れた！'); }
  } else {
    P.vy -= 22 * dt; P.y += P.vy * dt;
    if (P.y < -3.5 && !fadeT) { fadeT = 1; respawnAt = HALL_SAFE.clone(); St.setHp(S.hp - 1); if (S.hp <= 0) { St.setHp(S.maxHp); respawnAt = START.clone(); toast('力尽きた……中庭で目を覚ました'); } else toast('穴に落ちた！（体力 -1）'); }
  }
  if (fadeT > 0) { fadeT = Math.max(0, fadeT - dt * 1.4); fade = Math.sin((1 - fadeT) * Math.PI); if (respawnAt && fadeT < .5) { P.pos.copy(respawnAt); P.y = 0; P.vy = 0; P.falling = false; P.kb.set(0, 0, 0); respawnAt = null; } } else fade = 0;
  // pressure plate (step on it)
  if (!f.gateOpen && Math.abs(P.pos.x - OBJ.plate.x) < .8 && Math.abs(P.pos.z - OBJ.plate.z) < .8) { St.setFlag('gateOpen'); shake = .25; toast('ガコン……！ 北の門が上がっていく'); }
  // player mesh anim
  pg.position.set(P.pos.x, P.y, P.pos.z); pg.rotation.y = P.face;
  const w = P.moving ? Math.sin(t * 11) : 0; legL.rotation.x = w * .6; legR.rotation.x = -w * .6; armL.rotation.x = -w * .4 - (St.flag('torchLit') ? .9 : 0);
  armR.rotation.x = P.swing > 0 ? -2.2 + (1 - P.swing / .3) * 3 : w * .4; rodMesh.visible = St.hasItem('rod');
  torchMesh.visible = St.hasItem('torch'); torchFlame.visible = St.flag('torchLit'); torchFlame.scale.y = 1 + Math.sin(t * 19) * .15;
  
  // --- slime
  if (SL.alive) {
    SL.hop += dt * 3; SL.flash = Math.max(0, SL.flash - dt); SL.cd = Math.max(0, SL.cd - dt);
    const toP = P.pos.clone().sub(SL.pos).setY(0), d = toP.length();
    if (f.doorOpen && d < 8 && P.pos.z < 10.4 && mode === 'play') SL.pos.addScaledVector(toP.normalize(), (Math.sin(SL.hop * 2) > 0 ? 2.0 : .3) * dt);
    SL.pos.addScaledVector(SL.kb, dt); SL.kb.multiplyScalar(Math.exp(-dt * 6));
    SL.pos.x = Math.max(12.6, Math.min(21.4, SL.pos.x)); SL.pos.z = Math.max(6.3, Math.min(9.4, SL.pos.z));
    if (d < .85 && !panelOpen()) hurt(1, SL.pos);
    const sq = Math.abs(Math.sin(SL.hop * 2)); slimeMesh.position.set(SL.pos.x, .32 + sq * .35, SL.pos.z); slimeMesh.scale.set(1 + (1 - sq) * .2, .65 + sq * .2, 1 + (1 - sq) * .2);
    slimeMesh.rotation.y = Math.atan2(toP.x, toP.z); mSlime.uniforms.uEmi.value.setRGB(SL.flash > 0 ? .8 : 0, SL.flash > 0 ? .8 : 0, SL.flash > 0 ? .8 : 0);
  } else if (SL.dead > 0) { SL.dead += dt; const k = Math.max(0, 1 - SL.dead / .6); slimeMesh.scale.set(1 + (1 - k), k * .7, 1 + (1 - k)); if (k <= 0) { slimeMesh.visible = false; SL.dead = 0; } }
  // --- npc faces player when near
  if (dist2d(P.pos, OBJ.npc) < 4) { const a = Math.atan2(P.pos.x - OBJ.npc.x, P.pos.z - OBJ.npc.z); let d = a - W.o.npc.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); W.o.npc.rotation.y += d * Math.min(1, dt * 4); }
  W.update(dt, t, f);
  updateFocus(); updateLights(t);
  // --- clear
  if (clearT > 0) { clearT -= dt; if (clearT <= 0) { mode = 'clear'; document.exitPointerLock?.(); const s = S.playMs / 1000 | 0; $('clearStat').textContent = `プレイ時間 ${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒 ／ 力尽きた回数 ${S.deaths}`; $('clear').classList.add('show'); } }
  // --- camera (third person, wall-aware)
  if (mode === 'title') camYaw += dt * .08;
  const tgt = new V3(P.pos.x, P.y + 1.45, P.pos.z);
  const cp = Math.cos(camPitch), back = new V3(Math.sin(camYaw) * cp, Math.sin(camPitch), Math.cos(camYaw) * cp);
  let dd = camDist;
  for (let i = 1; i <= 24; i++) { const s = i / 24 * camDist; tmp.copy(tgt).addScaledVector(back, s); if (isIndoor(tmp.z)) tmp.y = Math.min(tmp.y, H - .25); if (camBlocked(tmp)) { dd = Math.max(.35, s - .25); break; } }
  cam.position.copy(tgt).addScaledVector(back, dd); if (isIndoor(cam.position.z)) cam.position.y = Math.min(cam.position.y, H - .25); cam.position.y = Math.max(cam.position.y, P.y + .3);
  if (shake > 0) { shake = Math.max(0, shake - dt); cam.position.x += (Math.random() - .5) * shake * .4; cam.position.y += (Math.random() - .5) * shake * .4; }
  cam.lookAt(tgt.x, tgt.y + .1, tgt.z);
  pg.visible = dd > .9 && !(P.inv > 0 && Math.floor(t * 20) % 2);
  // --- autosave position
  saveT += dt; if (mode === 'play' && saveT > 2) { saveT = 0; S.pos = [P.pos.x, P.pos.z]; S.yaw = camYaw; St.save(); }
  pipe.render(scene, cam, renderMode, fade);
  requestAnimationFrame(frame);
}
hud(); requestAnimationFrame(frame);
window.__game = { St, P, W, SL, interact, useItem, get mode() { return mode; }, teleport: (x, z) => { P.pos.set(x, 0, z); }, get focus() { return focus?.label(); } };
