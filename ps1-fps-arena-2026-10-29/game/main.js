import * as THREE from './vendor/three.module.js';
import { T, M, U, computeBounce, createPipeline, meshToLambert } from './render.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const STICK_R = 56;
const FIRE_DRAG_MAX = 14;
const FIRE_TAP_MS = 220;
const PICKUP_R = 1.55; // horizontal (xz) radius — auto-collect on walk-over
const PICKUP_PROMPT_R = 2.6;

/** @type {'title'|'play'} */
let phase = 'title';
let muted = localStorage.getItem('fps-mute') === '1';
const RENDER_MODES = new Set(['ps1b', 'ps1', 'clean']);
let renderMode = localStorage.getItem('fps-render') || 'ps1b';
if (!RENDER_MODES.has(renderMode)) {
  renderMode = 'ps1b';
  localStorage.setItem('fps-render', renderMode);
}

const player = {
  hp: 40,
  maxHp: 40,
  herbs: 0,
  ammo: 12,
  magSize: 12,
  reserve: 36,
  reloading: false,
  reloadT: 0,
  reloadDur: 1.45,
  yaw: 0,
  pitch: 0,
  pos: new THREE.Vector3(0, 1.6, 6),
  speed: 4.2,
  fireCd: 0,
  fireRate: 0.12,
  hurtI: 0,
  shake: 0,
};

const ENEMY_TYPES = {
  tank: {
    name: '巨体ゾンビ', hp: 6, touchDps: 6, model: 'zombieBig',
    speed: 0.72, stop: 1.55, melee: 2.05,
  },
  runner: {
    name: '走るゾンビ', hp: 2, touchDps: 3.3, model: 'zombie',
    speed: 1.7, stop: 1.35, melee: 1.85,
  },
  sniper: {
    name: '骸骨弓兵', hp: 3, touchDps: 1, model: 'skeleton',
    speed: 0.88, stop: 5.5, melee: 2.4, ideal: 7.5,
    ranged: true, range: 12, shotRate: 4.35, shotDmg: 1,
  },
};

const move = { x: 0, z: 0 };
const stick = { on: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
const look = { on: false, id: -1, lx: 0, ly: 0, drag: 0, t0: 0 };
let pointerLocked = false;
let wave = 1;

const R = new THREE.WebGLRenderer({ antialias: false });
R.debug.checkShaderErrors = typeof location !== 'undefined' && location.search.includes('debug=1');
R.setPixelRatio(1);
R.setSize(innerWidth, innerHeight);
document.body.prepend(R.domElement);

const S = new THREE.Scene();
S.background = new THREE.Color(0x050508);
const cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 40);
const pipeline = createPipeline(R);

const solids = [];
const enemies = [];
const pickups = [];
const ray = new THREE.Raycaster();

function addSolid(geo, tex, rep, pos, rot = [0, 0, 0], emi = 0) {
  const m = new THREE.Mesh(geo, M(tex, rep, emi));
  m.position.set(...pos);
  m.rotation.set(...rot);
  S.add(m);
  solids.push(m);
  return m;
}

const W = 14, D = 14, H = 3.2;
addSolid(new THREE.PlaneGeometry(W, D, 10, 10), T.floor, [4, 4], [0, 0, 0], [-Math.PI / 2, 0, 0]);
addSolid(new THREE.PlaneGeometry(W, D, 10, 10), T.plaster, [4, 4], [0, H, 0], [Math.PI / 2, 0, 0]);
addSolid(new THREE.PlaneGeometry(D, H, 10, 4), T.brick, [5, 1.2], [-W / 2, H / 2, 0], [0, Math.PI / 2, 0]);
addSolid(new THREE.PlaneGeometry(D, H, 10, 4), T.brick, [5, 1.2], [W / 2, H / 2, 0], [0, -Math.PI / 2, 0]);
addSolid(new THREE.PlaneGeometry(W, H, 10, 4), T.brick, [5, 1.2], [0, H / 2, -D / 2], [0, 0, 0]);
addSolid(new THREE.PlaneGeometry(W, H, 10, 4), T.red, [2, 1], [0, H / 2, D / 2], [0, Math.PI, 0]);
for (const [x, z, sx, sy, sz] of [
  [-4, -3, 2, 1.2, 1], [3, 2, 1.5, 1.8, 1.5], [-2, 4, 3, 1, 2], [5, -4, 1, 2.5, 1],
  [0, 0, 2.5, 1, 2.5], [-5, 5, 1.2, 1.2, 1.2],
]) {
  addSolid(new THREE.BoxGeometry(sx, sy, sz, 2, 2, 2), T.wood, [1, 1], [x, sy / 2, z], [0, x * 0.1, 0]);
}

const lights = [
  { pos: new THREE.Vector3(-3, 2.6, -2), col: new THREE.Color(1.0, 0.65, 0.35).multiplyScalar(3.5) },
  { pos: new THREE.Vector3(3.5, 2.4, 3), col: new THREE.Color(0.4, 0.75, 1).multiplyScalar(2.8) },
  { pos: new THREE.Vector3(0, 2.5, 0), col: new THREE.Color(0.9, 0.85, 0.7).multiplyScalar(1.8) },
];

function syncLights() {
  lights.forEach((L, i) => {
    U.uLP.value[i].copy(L.pos);
    U.uLC.value[i].set(L.col.r, L.col.g, L.col.b);
  });
  computeBounce(lights, solids);
}
syncLights();

function syncCameraFromPlayer() {
  const sh = player.shake;
  if (sh > 0.001) {
    cam.position.set(
      player.pos.x + (Math.random() - 0.5) * sh,
      player.pos.y + (Math.random() - 0.5) * sh * 0.6,
      player.pos.z + (Math.random() - 0.5) * sh,
    );
  } else cam.position.copy(player.pos);
  cam.rotation.order = 'YXZ';
  cam.rotation.y = player.yaw;
  cam.rotation.x = player.pitch;
}
syncCameraFromPlayer();

let fallbackMode = !pipeline.isEnabled();
const fallbackLights = [];
function enableFallbackRenderer() {
  if (fallbackMode) return;
  fallbackMode = true;
  pipeline.disable();
  if (!fallbackLights.length) {
    fallbackLights.push(new THREE.AmbientLight(0x707088, 0.65));
    const d = new THREE.DirectionalLight(0xffd0a8, 1.15);
    d.position.set(-4, 7, 3);
    fallbackLights.push(d);
    S.add(...fallbackLights);
  }
  S.traverse((o) => meshToLambert(o));
}
if (fallbackMode) enableFallbackRenderer();

function setMeshEmissive(obj, r, g, b) {
  obj?.traverse?.((mesh) => {
    if (!mesh.isMesh || mesh.userData.keepEmi) return;
    if (mesh.material?.uniforms?.uEmi) mesh.material.uniforms.uEmi.value.setRGB(r, g, b);
    else if (mesh.material?.emissive) mesh.material.emissive.setRGB(r, g, b);
  });
}
function toLambertDeep(obj) { obj.traverse((o) => meshToLambert(o)); }

// --- Toasts
function toast(msg) {
  const stack = $('toastStack');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 320);
  }, 2400);
}

// --- Pickups
const PICKUP_SPOTS = [
  { kind: 'ammo', x: -5.5, z: -4, amount: 12, respawn: 18 },
  { kind: 'ammo', x: 5, z: 4.5, amount: 12, respawn: 18 },
  { kind: 'ammo', x: 0, z: -6, amount: 8, respawn: 22 },
  { kind: 'herb', x: -2, z: 5.5, amount: 1, respawn: 28 },
  { kind: 'medkit', x: 4, z: -1, amount: 2, respawn: 35 },
  { kind: 'herb', x: 6, z: -5, amount: 1, respawn: 30 },
];

function spawnPickupSpot(spot) {
  if (spot.mesh) return;
  const tex = spot.kind === 'ammo' ? T.ammoBox : spot.kind === 'medkit' ? T.medkit : T.herb;
  const geo = spot.kind === 'ammo'
    ? new THREE.BoxGeometry(0.45, 0.28, 0.35, 1, 1, 1)
    : new THREE.BoxGeometry(0.35, 0.35, 0.35, 1, 1, 1);
  const mesh = new THREE.Mesh(geo, M(tex, [1, 1], 0x111111));
  spot.baseY = spot.kind === 'ammo' ? 0.18 : 0.22;
  mesh.position.set(spot.x, spot.baseY, spot.z);
  mesh.rotation.y = spot.x * 0.2;
  S.add(mesh);
  if (fallbackMode) meshToLambert(mesh);
  spot.mesh = mesh;
  spot.timer = 0;
  pickups.push(spot);
}

function clearPickups() {
  for (const p of pickups) {
    if (p.mesh) S.remove(p.mesh);
    p.mesh = null;
  }
  pickups.length = 0;
}

function initPickups() {
  clearPickups();
  for (const s of PICKUP_SPOTS) {
    s.mesh = null;
    s.timer = 0;
    spawnPickupSpot(s);
  }
}

// --- Collect FX (particles + screen flash)
const fxParts = [];
const FX_GEO = new THREE.BoxGeometry(0.07, 0.07, 0.07);
const FX_COL = { ammo: [0xffd060, '#ffd06066'], herb: [0x60ff80, '#60ff8066'], medkit: [0xff6060, '#ff707066'] };
const fxMats = {};
function fxMat(kind) {
  if (!fxMats[kind]) fxMats[kind] = new THREE.MeshBasicMaterial({ color: FX_COL[kind][0] });
  return fxMats[kind];
}
function collectFx(kind, pos) {
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(FX_GEO, fxMat(kind));
    m.position.copy(pos);
    const a = Math.random() * Math.PI * 2;
    const sp = 1.2 + Math.random() * 1.8;
    m.userData.v = new THREE.Vector3(Math.cos(a) * sp, 2.5 + Math.random() * 2.5, Math.sin(a) * sp);
    m.userData.life = 0.55 + Math.random() * 0.3;
    S.add(m);
    fxParts.push(m);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 4, 12), fxMat(kind));
  ring.position.copy(pos);
  ring.rotation.x = Math.PI / 2;
  ring.userData.v = new THREE.Vector3(0, 1.6, 0);
  ring.userData.life = 0.6;
  ring.userData.ring = true;
  S.add(ring);
  fxParts.push(ring);
  const fl = $('pickFlash');
  fl.style.transition = 'none';
  fl.style.background = `radial-gradient(circle, transparent 35%, ${FX_COL[kind][1]} 100%)`;
  fl.style.opacity = '1';
  requestAnimationFrame(() => requestAnimationFrame(() => { fl.style.transition = 'opacity .45s ease-out'; fl.style.opacity = '0'; }));
}
function updateFx(dt) {
  for (let i = fxParts.length - 1; i >= 0; i--) {
    const m = fxParts[i];
    m.userData.life -= dt;
    if (m.userData.life <= 0) { S.remove(m); fxParts.splice(i, 1); continue; }
    m.position.addScaledVector(m.userData.v, dt);
    if (m.userData.ring) m.scale.multiplyScalar(1 + dt * 3.5);
    else { m.userData.v.y -= 9 * dt; m.rotation.x += dt * 8; m.rotation.y += dt * 6; }
  }
}

function collectPickup(p) {
  collectFx(p.kind, p.mesh.position.clone().setY(0.4));
  if (p.kind === 'ammo') {
    player.reserve += p.amount;
    toast(`📦 弾薬 +${p.amount}`);
    sfxPickupAmmo();
  } else if (p.kind === 'herb') {
    player.herbs += p.amount;
    toast(`🌿 回復草 +${p.amount}（Eで使用）`);
    sfxPickupHeal();
  } else if (p.kind === 'medkit') {
    const before = player.hp;
    player.hp = Math.min(player.maxHp, player.hp + p.amount);
    toast(`➕ 救急箱 +${player.hp - before}♥`);
    sfxPickupHeal();
  }
  updateHud();
  S.remove(p.mesh);
  p.mesh = null;
  p.timer = p.respawn;
}

// --- Enemies (low-poly zombie / skeleton figures; root Group at feet, y=0)
function part(root, w, h, d, tex, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), M(tex, [1, 1], 0));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  root.add(m);
  return m;
}
function eyes(root, y, z, sep, col) {
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), M(T.black, [1, 1], col));
    e.position.set(sx * sep, y, z);
    e.userData.keepEmi = true;
    root.add(e);
  }
}
function buildEnemyModel(kind) {
  const g = new THREE.Group();
  const limbs = {};
  if (kind === 'skeleton') {
    part(g, 0.26, 0.28, 0.26, T.skull, 0, 1.68, 0);
    eyes(g, 1.7, 0.135, 0.06, 0x6688ff);
    part(g, 0.08, 0.14, 0.08, T.bone, 0, 1.5, 0);
    part(g, 0.42, 0.42, 0.18, T.ribs, 0, 1.22, 0);
    part(g, 0.08, 0.22, 0.08, T.bone, 0, 0.92, 0);
    part(g, 0.34, 0.1, 0.16, T.bone, 0, 0.8, 0);
    limbs.la = part(g, 0.07, 0.62, 0.07, T.bone, -0.27, 1.12, 0.08, -0.5, 0, 0.08);
    limbs.ra = part(g, 0.07, 0.62, 0.07, T.bone, 0.27, 1.12, 0.12, -1.1, 0, -0.08);
    part(g, 0.05, 0.8, 0.05, T.wood, 0.3, 1.25, 0.42, 0.3, 0, 0);
    limbs.ll = part(g, 0.09, 0.76, 0.09, T.bone, -0.11, 0.38, 0);
    limbs.rl = part(g, 0.09, 0.76, 0.09, T.bone, 0.11, 0.38, 0);
  } else {
    const big = kind === 'zombieBig';
    const s = big ? 1.25 : 1;
    const skin = big ? T.zombieDark : T.zombie;
    const ax = 0.33 * s * (big ? 1.25 : 1);
    part(g, 0.32 * s, 0.32 * s, 0.3 * s, T.zombieHead, 0, 1.52 * s, 0.06 * s, 0.25, 0, 0.12);
    eyes(g, 1.55 * s, 0.22 * s, 0.07 * s, 0xff3020);
    part(g, (big ? 0.62 : 0.46) * s, 0.58 * s, 0.26 * s, T.rags, 0, 1.06 * s, 0, 0.18, 0, 0);
    limbs.la = part(g, 0.13 * s, 0.6 * s, 0.13 * s, skin, -ax, 1.1 * s, 0.26 * s, -1.35, 0, 0);
    limbs.ra = part(g, 0.13 * s, 0.6 * s, 0.13 * s, skin, ax, 1.08 * s, 0.24 * s, -1.25, 0, 0);
    limbs.ll = part(g, 0.16 * s, 0.76 * s, 0.16 * s, T.pants, -0.13 * s, 0.38 * s, 0);
    limbs.rl = part(g, 0.16 * s, 0.76 * s, 0.16 * s, T.pants, 0.13 * s, 0.38 * s, 0);
  }
  // invisible hitbox for reliable raycast
  const hbH = kind === 'zombieBig' ? 2.05 : kind === 'skeleton' ? 1.85 : 1.75;
  const hbW = kind === 'zombieBig' ? 1.0 : 0.7;
  const hit = new THREE.Mesh(new THREE.BoxGeometry(hbW, hbH, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = hbH / 2;
  hit.userData.keepEmi = true;
  g.add(hit);
  return { g, hit, limbs };
}
function spawnEnemy(typeKey, x, z) {
  const def = ENEMY_TYPES[typeKey];
  const { g: mesh, hit, limbs } = buildEnemyModel(def.model);
  mesh.position.set(x, 0, z);
  S.add(mesh);
  if (fallbackMode) toLambertDeep(mesh);
  const e = {
    type: typeKey, def, mesh, hit, limbs, walk: Math.random() * 6, hp: def.hp, maxHp: def.hp, flash: 0, alive: true,
    shotCd: 0, wander: Math.random() * Math.PI * 2, touchAcc: 0,
  };
  enemies.push(e);
  return e;
}

function spawnWave() {
  enemies.forEach((e) => { if (e.mesh) S.remove(e.mesh); });
  enemies.length = 0;
  // Small arena: 2–3 foes per wave, spawned on the far side away from the player
  const sets = [
    [['runner', -4.5, -5.5], ['tank', 4.5, -5.5]],
    [['runner', -5.5, -5], ['sniper', 5.5, -5.5]],
    [['tank', -5, -5.5], ['runner', 5.5, -4.5], ['sniper', 0, -6]],
    [['runner', -5.5, -5.5], ['runner', 5.5, -5.5], ['sniper', 2, -6]],
    [['tank', -5.5, -5], ['sniper', 5.5, -5.5], ['runner', 0.5, -6.2]],
  ];
  let list = sets[Math.min(wave - 1, sets.length - 1)];
  if (wave > sets.length) list = sets[2 + ((wave - 1) % 3)];
  const flip = player.pos.z < 0 ? -1 : 1;
  list = list.map(([t, x, z]) => [t, x, z * flip]);
  for (const [t, x, z] of list) spawnEnemy(t, x, z);
}

function livingEnemies() {
  return enemies.filter((e) => e.alive && e.mesh);
}

// --- Gun viewmodel
const gun = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.38, 1, 1, 2), M(T.metal, [1, 1], 0));
gunBody.position.set(0.22, -0.18, -0.32);
const gunSlide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.18, 1, 1, 1), M(T.metal, [1, 1], 0));
gunSlide.position.set(0.22, -0.16, -0.18);
const gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.1, 1, 1, 1), M(T.wood, [1, 1], 0));
gunGrip.position.set(0.22, -0.24, -0.28);
gun.add(gunBody, gunSlide, gunGrip);
cam.add(gun);
S.add(cam);

let reloadSfxStage = 0;

function updateGunAnim(dt) {
  if (player.reloading) {
    const t = 1 - player.reloadT / player.reloadDur;
    gun.rotation.x = -0.12 - 0.42 * Math.sin(Math.min(1, t * 1.1) * Math.PI);
    gunSlide.position.z = -0.18 - 0.12 * Math.sin(Math.min(1, t * 1.4) * Math.PI);
    gunBody.position.y = -0.18 + 0.04 * Math.sin(t * Math.PI * 4);
    const stage = Math.floor(t * 5);
    if (stage > reloadSfxStage) {
      reloadSfxStage = stage;
      sfxReloadStage(stage);
    }
  } else {
    reloadSfxStage = 0;
    gun.rotation.x *= 0.82;
    gunSlide.position.z += (-0.18 - gunSlide.position.z) * Math.min(1, dt * 14);
    gunBody.position.y += (-0.18 - gunBody.position.y) * Math.min(1, dt * 14);
  }
}

// --- Audio
let actx, bgmTimer, bgmStep = 0;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}
function beep(freq, dur, type = 'square', vol = 0.08, when = 0) {
  if (muted) return;
  const ctx = audio();
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
function noiseBurst(dur = 0.05, vol = 0.04) {
  if (muted) return;
  const ctx = audio();
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur | 0, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g);
  g.connect(ctx.destination);
  src.start();
}
function sfxShoot() {
  beep(220, 0.04, 'square', 0.055);
  beep(110, 0.07, 'sawtooth', 0.035);
  noiseBurst(0.04, 0.025);
}
function sfxEmpty() { beep(140, 0.03, 'square', 0.04); beep(90, 0.05, 'square', 0.03); }
function sfxHit() { beep(280, 0.05, 'triangle', 0.06); beep(180, 0.06, 'square', 0.04); }
function sfxDeath() {
  beep(120, 0.12, 'sawtooth', 0.07);
  beep(80, 0.15, 'square', 0.05);
  noiseBurst(0.08, 0.03);
}
function sfxHurt() { beep(70, 0.1, 'sawtooth', 0.07); beep(45, 0.12, 'square', 0.05); }
function sfxPickupAmmo() { beep(520, 0.05, 'triangle', 0.05); beep(780, 0.06, 'square', 0.04); }
function sfxPickupHeal() { beep(440, 0.06, 'triangle', 0.05); beep(660, 0.08, 'triangle', 0.045); beep(880, 0.1, 'sine', 0.035); }
function sfxClear() {
  beep(523, 0.08, 'square', 0.05);
  beep(659, 0.08, 'square', 0.05, 0.09);
  beep(784, 0.12, 'triangle', 0.06, 0.18);
}
function sfxReloadStage(stage) {
  const seq = [
    () => { beep(180, 0.04, 'square', 0.04); noiseBurst(0.02, 0.02); },
    () => beep(260, 0.05, 'triangle', 0.045),
    () => { beep(320, 0.04, 'square', 0.04); beep(140, 0.06, 'sawtooth', 0.03); },
    () => beep(420, 0.05, 'triangle', 0.05),
    () => { beep(520, 0.07, 'square', 0.05); beep(780, 0.05, 'triangle', 0.04); },
  ];
  seq[Math.min(stage, seq.length - 1)]?.();
}
function startBgm() {
  if (bgmTimer || muted) return;
  bgmTimer = setInterval(() => {
    if (muted || phase !== 'play') return;
    const base = [110, 131, 165, 196][bgmStep % 4];
    beep(base, 0.14, 'triangle', 0.012);
    beep(base * 2, 0.1, 'square', 0.006);
    bgmStep++;
  }, 420);
}
function stopBgm() { clearInterval(bgmTimer); bgmTimer = null; }

function updateHud() {
  const hp = Math.max(0, Math.min(player.maxHp, player.hp | 0));
  const slots = 8;
  const filled = Math.max(0, Math.min(slots, Math.ceil(hp * slots / player.maxHp)));
  $('hp').textContent = '♥'.repeat(filled) + '♡'.repeat(slots - filled) + ` ${hp}/${player.maxHp}`;
  $('ammo').textContent = `${player.ammo} / ${player.reserve}`;
  $('herbs').textContent = `${player.herbs}`;
  $('cross').style.opacity = phase === 'play' ? '1' : '0.3';
}

function setPhase(p) {
  phase = p;
  $('title').style.display = p === 'title' ? 'flex' : 'none';
  $('hud').style.display = p === 'play' ? 'block' : 'none';
  $('touchUi').style.display = p === 'play' ? 'block' : 'none';
  if (p === 'play') startBgm();
  else stopBgm();
  updateHud();
}

function damagePlayer(amount, source = '') {
  if (player.hurtI > 0 || phase !== 'play') return;
  player.hp = Math.max(0, player.hp - amount);
  player.hurtI = 0.85;
  player.shake = 0.06;
  sfxHurt();
  if (source) toast(`💥 ${source} (-${amount}♥)`);
  updateHud();
  if (player.hp <= 0) {
    player.hp = 0;
    toast('💀 撃破された…');
    setPhase('title');
    player.hp = player.maxHp;
    player.herbs = 0;
    player.ammo = player.magSize;
    player.reserve = 36;
    wave = 1;
  }
}

function useHerb() {
  if (phase !== 'play' || player.herbs <= 0 || player.hp >= player.maxHp) return;
  player.herbs--;
  player.hp++;
  sfxPickupHeal();
  toast('🌿 回復草 +1♥');
  updateHud();
}

function tryFire() {
  if (phase !== 'play' || player.reloading) return;
  if (player.fireCd > 0) return;
  if (player.ammo <= 0) {
    sfxEmpty();
    return;
  }
  player.ammo--;
  player.fireCd = player.fireRate;
  sfxShoot();
  gun.rotation.x = -0.1;
  gunSlide.position.z = -0.24;
  ray.setFromCamera(new THREE.Vector2(0, 0), cam);
  const hits = ray.intersectObjects(livingEnemies().map((e) => e.hit), false);
  if (hits[0]) {
    const e = enemies.find((x) => x.hit === hits[0].object && x.alive);
    if (e) {
      e.hp--;
      e.flash = 0.2;
      sfxHit();
      if (e.hp <= 0) killEnemy(e);
    }
  }
  updateHud();
}

function killEnemy(e) {
  e.alive = false;
  sfxDeath();
  toast(`☠ ${e.def.name} 撃破`);
  setMeshEmissive(e.mesh, 1, 0.35, 0.2);
  setTimeout(() => {
    if (e.mesh) S.remove(e.mesh);
    e.mesh = null;
    if (phase === 'play' && livingEnemies().length === 0) onWaveClear();
  }, 140);
}

function onWaveClear() {
  sfxClear();
  toast(`✨ ウェーブ ${wave} クリア！`);
  wave++;
  setTimeout(() => {
    if (phase !== 'play') return;
    spawnWave();
    toast(`ウェーブ ${wave}`);
  }, 1200);
}

function startReload() {
  if (phase !== 'play' || player.reloading || player.ammo === player.magSize) return;
  if (player.reserve <= 0) {
    sfxEmpty();
    return;
  }
  player.reloading = true;
  player.reloadT = player.reloadDur;
  reloadSfxStage = -1;
  beep(160, 0.05, 'square', 0.04);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function horizDistToPlayer(m) {
  return Math.hypot(m.position.x - player.pos.x, m.position.z - player.pos.z);
}

function clampHorizFromPlayer(m, minD) {
  const dx = m.position.x - player.pos.x;
  const dz = m.position.z - player.pos.z;
  const h = Math.hypot(dx, dz);
  if (h < minD && h > 1e-4) {
    const s = minD / h;
    m.position.x = player.pos.x + dx * s;
    m.position.z = player.pos.z + dz * s;
  }
  return Math.hypot(m.position.x - player.pos.x, m.position.z - player.pos.z);
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive || !e.mesh) continue;
    const m = e.mesh;
    const def = e.def;
    const dx = player.pos.x - m.position.x;
    const dz = player.pos.z - m.position.z;
    let dist = Math.hypot(dx, dz);
    const toP = dist > 1e-4 ? new THREE.Vector3(dx / dist, 0, dz / dist) : new THREE.Vector3(0, 0, 1);
    const strafe = new THREE.Vector3(-toP.z, 0, toP.x);
    const spd = def.speed * dt;

    if (def.ranged) {
      m.rotation.y = Math.atan2(toP.x, toP.z);
      e.shotCd = (e.shotCd ?? 0) - dt;
      dist = horizDistToPlayer(m);
      if (dist >= def.stop && dist <= def.range && e.shotCd <= 0) {
        e.shotCd = def.shotRate;
        if (Math.random() < 0.5) {
          damagePlayer(def.shotDmg, def.name);
          setMeshEmissive(m, 0.9, 0.5, 0.9);
          setTimeout(() => { if (e.alive) setMeshEmissive(m, 0, 0, 0); }, 80);
        }
      }
      const ideal = def.ideal ?? 7.5;
      if (dist < def.stop) {
        m.position.addScaledVector(toP, -spd * 1.15);
      } else if (dist > def.range) {
        m.position.addScaledVector(toP, spd * 0.45);
      } else if (dist > ideal + 0.6) {
        m.position.addScaledVector(toP, spd * 0.35);
      } else if (dist < ideal - 0.6) {
        m.position.addScaledVector(toP, -spd * 0.45);
      } else {
        m.position.addScaledVector(strafe, Math.sin(e.wander) * spd * 0.5);
        e.wander += dt * 1.1;
      }
    } else {
      m.rotation.y = Math.atan2(toP.x, toP.z);
      dist = horizDistToPlayer(m);
      if (dist > def.stop + 0.08) {
        m.position.addScaledVector(toP, spd);
      } else if (dist < def.stop - 0.12) {
        m.position.addScaledVector(toP, -spd * 1.25);
      } else {
        m.position.addScaledVector(strafe, Math.sin(e.wander) * spd * 0.65);
        e.wander += dt * 1.4;
      }
    }

    dist = clampHorizFromPlayer(m, def.stop);
    m.position.y = 0;
    e.walk += dt * (def.speed * 4 + 1.5);
    const sw = Math.sin(e.walk) * 0.45;
    if (e.limbs.ll) { e.limbs.ll.rotation.x = sw; e.limbs.rl.rotation.x = -sw; }
    m.rotation.z = Math.sin(e.walk * 0.5) * 0.06;

    if (dist <= def.melee) {
      e.touchAcc += def.touchDps * dt;
      if (e.touchAcc >= 10 && player.hurtI <= 0) {
        e.touchAcc = 0;
        damagePlayer(1, def.name);
      }
    } else e.touchAcc = 0;

    e.flash = Math.max(0, e.flash - dt);
    if (e.flash > 0) setMeshEmissive(m, 1, 0.5, 0.3);
    else if (e.alive) setMeshEmissive(m, 0, 0, 0);

    m.position.x = clamp(m.position.x, -W / 2 + 0.5, W / 2 - 0.5);
    m.position.z = clamp(m.position.z, -D / 2 + 0.5, D / 2 - 0.5);
  }
}

function updatePickups(dt) {
  nearPickup = null;
  for (const p of pickups) {
    if (!p.mesh) {
      p.timer -= dt;
      if (p.timer <= 0) spawnPickupSpot(p);
      continue;
    }
    p.mesh.rotation.y += dt * 1.6;
    p.mesh.position.y = p.baseY + 0.08 + Math.sin(performance.now() * 0.004 + p.x) * 0.06;
    // horizontal (xz) distance only — camera is at y≈1.6, pickups sit on the floor
    const hd = horizDistToPlayer(p.mesh);
    if (hd < PICKUP_R) { collectPickup(p); continue; }
    if (hd < PICKUP_PROMPT_R && (!nearPickup || hd < nearD)) { nearPickup = p; nearD = hd; }
  }
  const btn = $('btnPick');
  const label = nearPickup ? `✋ 拾う（${PICK_NAMES[nearPickup.kind]}）${'ontouchstart' in window ? '' : ' [F]'}` : '';
  if (btn.dataset.label !== label) {
    btn.dataset.label = label;
    btn.textContent = label;
    btn.style.display = nearPickup ? 'block' : 'none';
  }
}
const PICK_NAMES = { ammo: '弾薬箱', herb: '回復草', medkit: '救急箱' };
let nearPickup = null, nearD = 0;
function pickNearest() {
  if (phase !== 'play' || !nearPickup?.mesh) return;
  collectPickup(nearPickup);
  nearPickup = null;
}

function updatePlayer(dt) {
  if (phase !== 'play') return;
  player.hurtI = Math.max(0, player.hurtI - dt);
  player.shake = Math.max(0, player.shake - dt * 0.35);

  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  const fx = -sy, fz = -cy;
  const rx = cy, rz = -sy;
  const vx = fx * (move.z * player.speed * dt) + rx * (move.x * player.speed * dt);
  const vz = fz * (move.z * player.speed * dt) + rz * (move.x * player.speed * dt);
  player.pos.x = clamp(player.pos.x + vx, -W / 2 + 0.35, W / 2 - 0.35);
  player.pos.z = clamp(player.pos.z + vz, -D / 2 + 0.35, D / 2 - 0.35);

  if (player.reloading) {
    player.reloadT -= dt;
    if (player.reloadT <= 0) {
      const need = player.magSize - player.ammo;
      const take = Math.min(need, player.reserve);
      player.ammo += take;
      player.reserve -= take;
      player.reloading = false;
      updateHud();
    }
  }
  if (player.fireCd > 0) player.fireCd -= dt;

  updateEnemies(dt);
  updatePickups(dt);
  updateFx(dt);
  updateGunAnim(dt);
}

// --- Touch UI
const stickEl = $('stickBase');
const knobEl = $('stickKnob');

function stickVisual(dx, dy) {
  const len = Math.hypot(dx, dy);
  const s = len > STICK_R ? STICK_R / len : 1;
  knobEl.style.transform = `translate(${dx * s}px, ${dy * s}px)`;
}

function resetStick() {
  stick.on = false;
  stick.id = -1;
  stick.dx = stick.dy = 0;
  move.x = move.z = 0;
  knobEl.style.transform = 'translate(0,0)';
}

function onTouchStart(ev) {
  if (phase !== 'play') return;
  for (const t of ev.changedTouches) {
    if (t.target.closest('button')) continue;
    const left = t.clientX < innerWidth * 0.5;
    if (left && !stick.on) {
      stick.on = true;
      stick.id = t.identifier;
      stick.ox = t.clientX;
      stick.oy = t.clientY;
      stickEl.style.left = `${stick.ox - STICK_R}px`;
      stickEl.style.top = `${stick.oy - STICK_R}px`;
      stickEl.style.display = 'block';
    } else if (!left && !look.on) {
      look.on = true;
      look.id = t.identifier;
      look.lx = t.clientX;
      look.ly = t.clientY;
      look.drag = 0;
      look.t0 = performance.now();
    }
  }
}

function onTouchMove(ev) {
  if (look.on) ev.preventDefault();
  for (const t of ev.changedTouches) {
    if (stick.on && t.identifier === stick.id) {
      stick.dx = t.clientX - stick.ox;
      stick.dy = t.clientY - stick.oy;
      stickVisual(stick.dx, stick.dy);
      move.x = clamp(stick.dx / STICK_R, -1, 1);
      move.z = clamp(-stick.dy / STICK_R, -1, 1);
    }
    if (look.on && t.identifier === look.id) {
      const dx = t.clientX - look.lx;
      const dy = t.clientY - look.ly;
      look.drag += Math.hypot(dx, dy);
      look.lx = t.clientX;
      look.ly = t.clientY;
      player.yaw -= dx * 0.004;
      player.pitch = clamp(player.pitch - dy * 0.003, -1.1, 1.1);
    }
  }
}

function onTouchEnd(ev) {
  for (const t of ev.changedTouches) {
    if (stick.on && t.identifier === stick.id) {
      resetStick();
      stickEl.style.display = 'none';
    }
    if (look.on && t.identifier === look.id) {
      const tap = look.drag < FIRE_DRAG_MAX && performance.now() - look.t0 < FIRE_TAP_MS;
      look.on = false;
      if (tap) tryFire();
    }
  }
}

R.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
R.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
R.domElement.addEventListener('touchend', onTouchEnd);
R.domElement.addEventListener('touchcancel', onTouchEnd);

const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyE') useHerb();
  if (e.code === 'KeyF') pickNearest();
  if (e.code === 'KeyM') {
    muted = !muted;
    localStorage.setItem('fps-mute', muted ? '1' : '0');
    $('muteBtn').textContent = muted ? '🔇' : '🔊';
    if (muted) stopBgm();
    else if (phase === 'play') startBgm();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

R.domElement.addEventListener('click', () => {
  if (phase !== 'play') return;
  if (!pointerLocked && !('ontouchstart' in window)) R.domElement.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === R.domElement;
});
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked || phase !== 'play') return;
  player.yaw -= e.movementX * 0.002;
  player.pitch = clamp(player.pitch - e.movementY * 0.002, -1.1, 1.1);
});
R.domElement.addEventListener('mousedown', (e) => {
  if (phase !== 'play' || e.button !== 0) return;
  if ('ontouchstart' in window) return;
  tryFire();
});

function pollKeys(dt) {
  if (phase !== 'play' || 'ontouchstart' in window) return;
  let x = 0, z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  const len = Math.hypot(x, z) || 1;
  move.x = x / len;
  move.z = z / len;
}

function startRun() {
  audio();
  player.hp = player.maxHp;
  player.herbs = 0;
  player.ammo = player.magSize;
  player.reserve = 36;
  player.reloading = false;
  player.hurtI = 0;
  player.shake = 0;
  player.pos.set(0, 1.6, 6);
  player.yaw = 0;
  player.pitch = 0;
  wave = 1;
  spawnWave();
  initPickups();
  setPhase('play');
  toast('🎯 ウェーブ 1');
}

$('btnStart').onclick = startRun;
$('btnReload').onclick = (e) => { e.stopPropagation(); startReload(); };
$('btnPick').onclick = (e) => { e.stopPropagation(); pickNearest(); };
$('btnHerb').onclick = (e) => { e.stopPropagation(); useHerb(); };
$('muteBtn').onclick = () => {
  muted = !muted;
  localStorage.setItem('fps-mute', muted ? '1' : '0');
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
  if (muted) stopBgm();
  else if (phase === 'play') startBgm();
};

if (DEBUG) {
  $('debugPanel').style.display = 'block';
  $('modePs1b').onclick = () => { renderMode = 'ps1b'; localStorage.setItem('fps-render', renderMode); };
  $('modePs1').onclick = () => { renderMode = 'ps1'; localStorage.setItem('fps-render', renderMode); };
  $('modeClean').onclick = () => { renderMode = 'clean'; localStorage.setItem('fps-render', renderMode); };
}
$('muteBtn').textContent = muted ? '🔇' : '🔊';

function onResize() {
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  R.setSize(innerWidth, innerHeight);
  pipeline.resize();
}
window.addEventListener('resize', onResize);

const clk = new THREE.Clock();
function loop() {
  const dt = Math.min(clk.getDelta(), 0.05);
  pollKeys(dt);
  syncCameraFromPlayer();
  updatePlayer(dt);
  updateHud();
  const fade = phase === 'title' ? 0.18 : 0;
  const ok = !fallbackMode && pipeline.render(S, cam, renderMode, fade);
  if (!ok) {
    enableFallbackRenderer();
    R.setRenderTarget(null);
    R.render(S, cam);
  }
  requestAnimationFrame(loop);
}
setPhase('title');
loop();
