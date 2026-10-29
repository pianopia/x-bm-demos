import * as THREE from './vendor/three.module.js';
import { T, M, U, computeBounce, createPipeline, meshToLambert } from './render.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const STICK_R = 56;
const FIRE_DRAG_MAX = 14;
const FIRE_TAP_MS = 220;
const HEART_SLOTS = 8;
const PICKUP_R = 1.55;
const PICKUP_BTN_R = 2.0;
let nearPickup = null;

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
  reloadDur: 0.8,
  yaw: 0,
  pitch: 0,
  pos: new THREE.Vector3(0, 1.6, 9),
  speed: 4.2,
  fireCd: 0,
  fireRate: 0.12,
  hurtI: 0,
  shake: 0,
};

const ENEMY_TYPES = {
  tank: {
    name: '腐ゾンビ', model: 'zombie', variant: 'brute', hp: 6, touchDps: 6,
    speed: 0.72, stop: 1.55, melee: 2.05,
  },
  runner: {
    name: '骨走り', model: 'skeleton', variant: 'runner', hp: 2, touchDps: 3.3,
    speed: 2.05, stop: 1.35, melee: 1.85,
  },
  sniper: {
    name: '骨弓', model: 'skeleton', variant: 'sniper', hp: 3, touchDps: 1,
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
const cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 55);
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

const W = 26, D = 22, H = 3.2;

function buildArena() {
  addSolid(new THREE.PlaneGeometry(W, D, 14, 12), T.floor, [6, 5], [0, 0, 0], [-Math.PI / 2, 0, 0]);
  addSolid(new THREE.PlaneGeometry(W, D, 14, 12), T.plaster, [6, 5], [0, H, 0], [Math.PI / 2, 0, 0]);
  addSolid(new THREE.PlaneGeometry(D, H, 12, 4), T.brick, [6, 1.2], [-W / 2, H / 2, 0], [0, Math.PI / 2, 0]);
  addSolid(new THREE.PlaneGeometry(D, H, 12, 4), T.brick, [6, 1.2], [W / 2, H / 2, 0], [0, -Math.PI / 2, 0]);
  addSolid(new THREE.PlaneGeometry(W, H, 12, 4), T.brick, [6, 1.2], [0, H / 2, -D / 2], [0, 0, 0]);
  addSolid(new THREE.PlaneGeometry(W, H, 12, 4), T.red, [3, 1], [0, H / 2, D / 2], [0, Math.PI, 0]);
  // Corridors & room partitions
  addSolid(new THREE.BoxGeometry(0.35, H, 10, 1, 4, 1), T.plaster, [1, 2], [-7, H / 2, -4], [0, 0, 0]);
  addSolid(new THREE.BoxGeometry(0.35, H, 8, 1, 4, 1), T.plaster, [1, 2], [4, H / 2, 2], [0, 0.2, 0]);
  addSolid(new THREE.BoxGeometry(12, H, 0.35, 4, 4, 1), T.brick, [3, 1], [-2, H / 2, -8], [0, 0, 0]);
  addSolid(new THREE.BoxGeometry(8, H, 0.35, 3, 4, 1), T.brick, [2, 1], [8, H / 2, -2], [0, 0.1, 0]);
  addSolid(new THREE.BoxGeometry(0.35, H, 6, 1, 3, 1), T.wood, [1, 1], [-11, H / 2, 6], [0, 0, 0]);
  for (const [x, z, sx, sy, sz] of [
    [-10, -7, 2.2, 1.3, 1.2], [9, -6, 1.8, 1.6, 1.4], [-8, 3, 3, 1, 2.2], [11, 4, 2.5, 1.2, 2],
    [2, -2, 2.8, 1, 2.8], [-3, 7, 1.4, 1.4, 1.4], [6, -9, 2, 1.2, 1], [-12, 0, 1.2, 2.4, 1],
    [0, 5, 3.5, 1, 1.5], [12, -2, 1, 2.2, 1], [-5, -3, 1.5, 1.8, 1.5], [7, 7, 2, 1, 2],
  ]) {
    addSolid(new THREE.BoxGeometry(sx, sy, sz, 2, 2, 2), T.wood, [1, 1], [x, sy / 2, z], [0, x * 0.08, 0]);
  }
}
buildArena();

// --- XZ collision (walls / crates): circle vs AABB push-out
const colliders = solids
  .filter((m) => m.geometry?.type === 'BoxGeometry')
  .map((m) => { m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m); return { x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z }; });
function collideXZ(pos, r) {
  for (let it = 0; it < 2; it++) {
    for (const c of colliders) {
      const cx = clamp(pos.x, c.x0, c.x1), cz = clamp(pos.z, c.z0, c.z1);
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), k = (r - d) / d;
        pos.x += dx * k; pos.z += dz * k;
      } else {
        const pen = [pos.x - c.x0 + r, c.x1 - pos.x + r, pos.z - c.z0 + r, c.z1 - pos.z + r];
        const i = pen.indexOf(Math.min(...pen));
        if (i === 0) pos.x -= pen[0]; else if (i === 1) pos.x += pen[1]; else if (i === 2) pos.z -= pen[2]; else pos.z += pen[3];
      }
    }
  }
}

const lights = [
  { pos: new THREE.Vector3(-8, 2.6, -6), col: new THREE.Color(1.0, 0.65, 0.35).multiplyScalar(3.5) },
  { pos: new THREE.Vector3(9, 2.4, 5), col: new THREE.Color(0.4, 0.75, 1).multiplyScalar(2.8) },
  { pos: new THREE.Vector3(0, 2.5, 0), col: new THREE.Color(0.9, 0.85, 0.7).multiplyScalar(1.8) },
  { pos: new THREE.Vector3(-10, 2.3, 7), col: new THREE.Color(0.85, 0.7, 0.5).multiplyScalar(2.2) },
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

function setMeshEmissive(mesh, r, g, b) {
  if (mesh?.material?.uniforms?.uEmi) mesh.material.uniforms.uEmi.value.setRGB(r, g, b);
  else if (mesh?.material?.emissive) mesh.material.emissive.setRGB(r, g, b);
}

function setRootEmissive(root, r, g, b) {
  if (!root) return;
  root.traverse((o) => { if (o.isMesh) setMeshEmissive(o, r, g, b); });
}

function horizDistXZ(x1, z1, x2, z2) {
  return Math.hypot(x1 - x2, z1 - z2);
}

function part(geo, tex, x, y, z, ry = 0, emi = 0, hitZone = 'body') {
  const m = new THREE.Mesh(geo, M(tex, [1, 1], emi));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.userData.hitZone = hitZone;
  return m;
}

function buildZombieGroup(variant = 'normal') {
  const g = new THREE.Group();
  const s = variant === 'brute' ? 1.18 : 1;
  const skin = T.zombieSkin;
  const rot = T.zombieRot;
  g.add(part(new THREE.BoxGeometry(0.34 * s, 0.34 * s, 0.34 * s, 1, 1, 1), skin, 0, 1.38 * s, 0, 0, 0, 'head'));
  g.add(part(new THREE.BoxGeometry(0.52 * s, 0.58 * s, 0.3 * s, 2, 2, 1), rot, 0, 0.88 * s, 0));
  g.add(part(new THREE.BoxGeometry(0.15 * s, 0.48 * s, 0.15 * s, 1, 1, 1), skin, -0.36 * s, 0.92 * s, 0, 0.25));
  g.add(part(new THREE.BoxGeometry(0.15 * s, 0.48 * s, 0.15 * s, 1, 1, 1), skin, 0.36 * s, 0.92 * s, 0, -0.25));
  g.add(part(new THREE.BoxGeometry(0.2 * s, 0.52 * s, 0.2 * s, 1, 1, 1), rot, -0.13 * s, 0.26 * s, 0.05));
  g.add(part(new THREE.BoxGeometry(0.2 * s, 0.52 * s, 0.2 * s, 1, 1, 1), rot, 0.13 * s, 0.26 * s, -0.05));
  g.userData.feetY = 0;
  return g;
}

function buildSkeletonGroup(variant = 'runner') {
  const g = new THREE.Group();
  const bone = T.bone;
  const dark = T.boneDark;
  const tall = variant === 'sniper' ? 1.12 : 0.95;
  g.add(part(new THREE.BoxGeometry(0.28 * tall, 0.3 * tall, 0.28 * tall, 1, 1, 1), bone, 0, 1.45 * tall, 0, 0, 0, 'head'));
  g.add(part(new THREE.BoxGeometry(0.38 * tall, 0.52 * tall, 0.18 * tall, 2, 2, 1), dark, 0, 0.92 * tall, 0));
  g.add(part(new THREE.BoxGeometry(0.1 * tall, 0.42 * tall, 0.1 * tall, 1, 1, 1), bone, -0.32 * tall, 0.95 * tall, 0, 0.15));
  g.add(part(new THREE.BoxGeometry(0.1 * tall, 0.42 * tall, 0.1 * tall, 1, 1, 1), bone, 0.32 * tall, 0.95 * tall, 0, -0.15));
  g.add(part(new THREE.BoxGeometry(0.12 * tall, 0.48 * tall, 0.12 * tall, 1, 1, 1), bone, -0.1 * tall, 0.24 * tall, 0.04));
  g.add(part(new THREE.BoxGeometry(0.12 * tall, 0.48 * tall, 0.12 * tall, 1, 1, 1), bone, 0.1 * tall, 0.24 * tall, -0.04));
  if (variant === 'sniper') {
    g.add(part(new THREE.BoxGeometry(0.06 * tall, 0.7 * tall, 0.06 * tall, 1, 1, 1), dark, 0.34 * tall, 1.0 * tall, -0.05, -0.4));
  }
  g.userData.feetY = 0;
  return g;
}

function buildEnemyMesh(def) {
  if (def.model === 'zombie') return buildZombieGroup(def.variant);
  return buildSkeletonGroup(def.variant);
}

function findEnemyFromHit(obj) {
  for (const e of enemies) {
    if (!e.alive || !e.mesh) continue;
    let hit = false;
    e.mesh.traverse((c) => { if (c === obj) hit = true; });
    if (hit) return e;
  }
  return null;
}

function enemyHitMeshes() {
  const arr = [];
  for (const e of livingEnemies()) e.mesh?.traverse((c) => { if (c.isMesh) arr.push(c); });
  return arr;
}

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
  { kind: 'ammo', x: -10, z: -8, amount: 12, respawn: 18 },
  { kind: 'ammo', x: 10, z: 7, amount: 12, respawn: 18 },
  { kind: 'ammo', x: 0, z: -9, amount: 8, respawn: 22 },
  { kind: 'herb', x: -11, z: 5, amount: 1, respawn: 28 },
  { kind: 'medkit', x: 8, z: -3, amount: 2, respawn: 35 },
  { kind: 'herb', x: 5, z: 8, amount: 1, respawn: 30 },
];

function spawnPickupSpot(spot) {
  if (spot.mesh) return;
  const tex = spot.kind === 'ammo' ? T.ammoBox : spot.kind === 'medkit' ? T.medkit : T.herb;
  const geo = spot.kind === 'ammo'
    ? new THREE.BoxGeometry(0.45, 0.28, 0.35, 1, 1, 1)
    : new THREE.BoxGeometry(0.35, 0.35, 0.35, 1, 1, 1);
  const mesh = new THREE.Mesh(geo, M(tex, [1, 1], 0x111111));
  mesh.position.set(spot.x, spot.kind === 'ammo' ? 0.18 : 0.22, spot.z);
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

// --- Collect FX (particles + ring + screen-edge flash)
const fxParts = [];
const FX_GEO = new THREE.BoxGeometry(0.07, 0.07, 0.07);
const FX_COL = { ammo: [0xffd060, '#ffd06066'], herb: [0x60ff80, '#60ff8066'], medkit: [0xff6060, '#ff707066'] };
const fxMats = {};
function fxMat(kind) {
  if (!fxMats[kind]) fxMats[kind] = new THREE.MeshBasicMaterial({ color: FX_COL[kind][0] });
  return fxMats[kind];
}
function edgeFlash(col, ms = 450) {
  const fl = $('pickFlash');
  fl.style.transition = 'none';
  fl.style.background = `radial-gradient(circle, transparent 35%, ${col} 100%)`;
  fl.style.opacity = '1';
  requestAnimationFrame(() => requestAnimationFrame(() => { fl.style.transition = `opacity ${ms}ms ease-out`; fl.style.opacity = '0'; }));
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
  edgeFlash(FX_COL[kind][1]);
}
// HIT_MUZZLE_FX_v1: enemy impact sparks/blood (shares fxParts/updateFx, capped)
const FX_MAX = 140;
const HIT_GEO = new THREE.BoxGeometry(0.045, 0.045, 0.045);
const HIT_MATS = {
  spark: new THREE.MeshBasicMaterial({ color: 0xffa020 }),
  sparkHot: new THREE.MeshBasicMaterial({ color: 0xfff4b0 }),
  blood: new THREE.MeshBasicMaterial({ color: 0xa01010 }),
  bloodDark: new THREE.MeshBasicMaterial({ color: 0x400808 }),
  flash: new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.9, depthWrite: false }),
};
function fxTrim() {
  while (fxParts.length > FX_MAX) { const o = fxParts.shift(); S.remove(o); }
}
const _hitN = new THREE.Vector3();
function hitFx(hit, head, rayDir) {
  const pos = hit.point.clone();
  if (hit.face) _hitN.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
  else _hitN.copy(rayDir).negate();
  if (_hitN.dot(rayDir) > 0) _hitN.negate();
  pos.addScaledVector(_hitN, 0.04);
  const nSpark = head ? 16 : 9, nBlood = head ? 10 : 6;
  for (let i = 0; i < nSpark + nBlood; i++) {
    const isSpark = i < nSpark;
    const mat = isSpark ? (head ? (i % 3 ? HIT_MATS.sparkHot : HIT_MATS.spark) : (i % 3 ? HIT_MATS.spark : HIT_MATS.sparkHot))
      : (i % 2 ? HIT_MATS.blood : HIT_MATS.bloodDark);
    const m = new THREE.Mesh(HIT_GEO, mat);
    m.position.copy(pos);
    const sp = isSpark ? (head ? 3.5 : 2.6) + Math.random() * 2.5 : 0.8 + Math.random() * 1.4;
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(1.6).add(_hitN).normalize();
    m.userData.v = v.multiplyScalar(sp);
    m.userData.life = isSpark ? 0.12 + Math.random() * 0.16 : 0.3 + Math.random() * 0.25;
    m.userData.g = isSpark ? 4 : 11;
    if (isSpark) m.scale.set(0.7, 0.7, 1.8);
    S.add(m);
    fxParts.push(m);
  }
  const f = new THREE.Mesh(HIT_GEO, HIT_MATS.flash);
  f.position.copy(pos);
  f.scale.setScalar(head ? 4.5 : 3);
  f.userData.v = new THREE.Vector3();
  f.userData.life = 0.07;
  f.userData.pop = true;
  S.add(f);
  fxParts.push(f);
  fxTrim();
}
function updateFx(dt) {
  for (let i = fxParts.length - 1; i >= 0; i--) {
    const m = fxParts[i];
    m.userData.life -= dt;
    if (m.userData.life <= 0) { S.remove(m); fxParts.splice(i, 1); continue; }
    m.position.addScaledVector(m.userData.v, dt);
    if (m.userData.ring) m.scale.multiplyScalar(1 + dt * 3.5);
    else if (m.userData.pop) m.scale.multiplyScalar(1 + dt * 10);
    else { m.userData.v.y -= (m.userData.g ?? 9) * dt; m.rotation.x += dt * 8; m.rotation.y += dt * 6; }
  }
}
let hsTimer = 0;
function headshotPop() {
  const el = $('hsPop');
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(hsTimer);
  hsTimer = setTimeout(() => el.classList.remove('show'), 650);
  edgeFlash('#ff202088', 300);
}

function collectPickup(p) {
  if (!p?.mesh) return;
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

// --- Enemies
function spawnEnemy(typeKey, x, z) {
  const def = ENEMY_TYPES[typeKey];
  const mesh = buildEnemyMesh(def);
  mesh.position.set(x, 0, z);
  S.add(mesh);
  if (fallbackMode) mesh.traverse((o) => meshToLambert(o));
  const e = {
    type: typeKey, def, mesh, hp: def.hp, maxHp: def.hp, flash: 0, alive: true,
    shotCd: 0, wander: Math.random() * Math.PI * 2, touchAcc: 0,
  };
  enemies.push(e);
  return e;
}

const SPAWN_POINTS = [
  [-11, -9], [-3, -10], [5, -10], [11, -8], [-10, -4], [10, 1], [-11, 3],
  [-6, 9], [3, 9], [10, 9], [-1, -5], [6, -5], [-4, 3], [9, -4],
];
const WAVE_SETS = [
  ['tank', 'runner'],
  ['runner', 'sniper', 'tank'],
  ['sniper', 'runner', 'runner'],
  ['tank', 'sniper', 'runner'],
];
function spawnWave() {
  enemies.forEach((e) => { if (e.mesh) S.remove(e.mesh); });
  enemies.length = 0;
  const list = WAVE_SETS[(wave - 1) % WAVE_SETS.length];
  const pts = SPAWN_POINTS
    .map(([x, z]) => ({ x, z, d: Math.hypot(x - player.pos.x, z - player.pos.z) }))
    .filter((p) => p.d > 8)
    .sort(() => Math.random() - 0.5);
  const used = [];
  for (const t of list) {
    const pt = pts.find((p) => used.every((u) => Math.hypot(u.x - p.x, u.z - p.z) > 6)) || pts[0];
    used.push(pt);
    pts.splice(pts.indexOf(pt), 1);
    spawnEnemy(t, pt.x, pt.z);
  }
}

function tryCollectNearPickup() {
  if (!nearPickup?.mesh || phase !== 'play') return;
  if (horizDistXZ(player.pos.x, player.pos.z, nearPickup.x, nearPickup.z) <= PICKUP_BTN_R) {
    collectPickup(nearPickup);
  }
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
// HIT_MUZZLE_FX_v1: muzzle flash at barrel tip (gunBody front z ≈ -0.51)
const muzzle = new THREE.Group();
muzzle.position.set(0.22, -0.17, -0.54);
const MUZ_MAT = new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
const MUZ_CORE = new THREE.MeshBasicMaterial({ color: 0xfffbe0, depthWrite: false, side: THREE.DoubleSide });
const muzA = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), MUZ_MAT);
const muzB = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), MUZ_MAT);
muzB.rotation.z = Math.PI / 4;
const muzSide = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.2), MUZ_MAT);
muzSide.rotation.x = -Math.PI / 2;
muzSide.position.z = -0.06;
const muzCore = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), MUZ_CORE);
muzzle.add(muzA, muzB, muzSide, muzCore);
muzzle.traverse((o) => { o.renderOrder = 10; });
muzzle.visible = false;
const muzLight = new THREE.PointLight(0xffb040, 0, 6, 2);
muzLight.position.set(0.22, -0.15, -0.6);
gun.add(muzzle, muzLight);
let muzzleT = 0;
function muzzleFlash() {
  muzzleT = 0.06;
  muzzle.visible = true;
  muzzle.rotation.z = Math.random() * Math.PI;
  muzzle.scale.setScalar(0.8 + Math.random() * 0.5);
  muzLight.intensity = 3.5;
}
function updateMuzzle(dt) {
  if (muzzleT <= 0) return;
  muzzleT -= dt;
  if (muzzleT <= 0) { muzzle.visible = false; muzLight.intensity = 0; return; }
  muzLight.intensity = 3.5 * (muzzleT / 0.06);
}
cam.add(gun);
S.add(cam);

let reloadSfxStage = 0;

function updateGunAnim(dt) {
  updateMuzzle(dt);
  if (player.reloading) {
    const t = 1 - player.reloadT / player.reloadDur;
    gun.rotation.x = -0.12 - 0.42 * Math.sin(Math.min(1, t * 1.1) * Math.PI);
    gunSlide.position.z = -0.18 - 0.12 * Math.sin(Math.min(1, t * 1.4) * Math.PI);
    gunBody.position.y = -0.18 + 0.04 * Math.sin(t * Math.PI * 4);
    const stage = Math.floor(t * 5);
    if (stage > reloadSfxStage) {
      reloadSfxStage = stage;
      sfxReloadStage(Math.min(stage, 3));
    }
  } else {
    reloadSfxStage = 0;
    gun.rotation.x *= 0.82;
    gunSlide.position.z += (-0.18 - gunSlide.position.z) * Math.min(1, dt * 14);
    gunBody.position.y += (-0.18 - gunBody.position.y) * Math.min(1, dt * 14);
  }
}

// --- Audio
let actx, bgmSrc = null, bgmGain = null, bgmBuffer = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume();
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
function sfxHeadshot() {
  beep(520, 0.07, 'square', 0.065);
  beep(880, 0.09, 'triangle', 0.05);
  noiseBurst(0.04, 0.035);
}
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
function metalHit(when, pitch = 1, vol = 0.06, ring = 0.16) {
  if (muted) return;
  const ctx = audio();
  const t0 = ctx.currentTime + when;
  // noisy transient through bandpass = steel impact
  const n = ctx.createBuffer(1, (ctx.sampleRate * 0.06) | 0, ctx.sampleRate);
  const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = ctx.createBufferSource(); src.buffer = n;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200 * pitch; bp.Q.value = 2.5;
  const ng = ctx.createGain(); ng.gain.value = vol * 2.2;
  src.connect(bp); bp.connect(ng); ng.connect(ctx.destination); src.start(t0);
  // inharmonic partials = metallic ring
  for (const [f, a] of [[1240, 1], [1983, 0.7], [2871, 0.45], [4130, 0.3]]) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * pitch, t0);
    g.gain.setValueAtTime(vol * a, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + ring * (1.2 - a * 0.3));
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + ring + 0.05);
  }
  // body thump
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(190 * pitch, t0); o.frequency.exponentialRampToValueAtTime(70, t0 + 0.07);
  g.gain.setValueAtTime(vol * 1.6, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
  o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + 0.12);
}
function sfxReloadStage(stage) {
  // 0: mag release / 1: mag out / 2: mag seat (カチッ) / 3: slide rack ガチャン
  const seq = [
    () => metalHit(0, 1.4, 0.03, 0.06),
    () => metalHit(0, 0.8, 0.035, 0.08),
    () => { metalHit(0, 1.1, 0.05, 0.1); metalHit(0.035, 0.9, 0.04, 0.08); },
    () => { metalHit(0, 0.75, 0.07, 0.14); metalHit(0.075, 1.05, 0.085, 0.24); },
  ];
  seq[Math.min(stage, seq.length - 1)]?.();
}

function synthWave(buf, ch, t, freq, vol, type, dur) {
  if (t < 0 || t >= buf.duration) return;
  const sr = buf.sampleRate;
  const i0 = (t * sr) | 0;
  const i1 = Math.min(buf.length, i0 + (dur * sr) | 0);
  for (let i = i0; i < i1; i++) {
    const tt = (i - i0) / sr;
    const env = Math.min(1, tt * 40) * Math.max(0, 1 - tt / dur);
    let s = 0;
    const ph = freq * tt * Math.PI * 2;
    if (type === 'square') s = Math.sign(Math.sin(ph)) * 0.55;
    else if (type === 'triangle') s = Math.asin(Math.sin(ph)) * (2 / Math.PI);
    else s = Math.sin(ph);
    ch[i] += s * vol * env;
  }
}

function synthNoise(ch, t, dur, vol, hp, sr, seed) {
  const i0 = (t * sr) | 0, i1 = Math.min(ch.length, i0 + ((dur * sr) | 0));
  let prev = 0, x = seed;
  for (let i = i0; i < i1; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const w = (x / 0x3fffffff) - 1;
    const v = hp ? w - prev : w; prev = w;
    const tt = (i - i0) / sr;
    ch[i] += v * vol * Math.pow(Math.max(0, 1 - tt / dur), 2);
  }
}
function synthKick(ch, t, vol, sr) {
  const i0 = (t * sr) | 0, n = (0.16 * sr) | 0;
  let ph = 0;
  for (let i = 0; i < n && i0 + i < ch.length; i++) {
    const tt = i / sr;
    ph += (2 * Math.PI * (45 + 110 * Math.exp(-tt * 30))) / sr;
    ch[i0 + i] += Math.sin(ph) * vol * Math.exp(-tt * 18);
  }
}
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
function renderBgmBuffer() {
  const ctx = audio();
  const sr = ctx.sampleRate;
  const bpm = 138, step = 60 / bpm / 4; // 16th
  const bars = 16, dur = bars * 16 * step;
  const buf = ctx.createBuffer(2, Math.ceil(sr * dur), sr);
  const L = buf.getChannelData(0), Rc = buf.getChannelData(1);
  // chords (root midi for bass, triad for arp)
  const CH = { Am: [45, [57, 60, 64]], F: [41, [57, 60, 65]], G: [43, [55, 59, 62]], E: [40, [56, 59, 64]], Dm: [38, [57, 62, 65]] };
  const prog = ['Am', 'F', 'G', 'E', 'Am', 'F', 'G', 'E', 'Dm', 'Am', 'F', 'E', 'Dm', 'Am', 'F', 'E'];
  // lead in 8ths: number = midi, '-' = hold, 0 = rest
  const lead = [
    [69, '-', 72, 76, 74, 72, 71, 72], [69, '-', '-', 65, 69, 72, 74, 72],
    [71, '-', 67, 71, 74, '-', 72, 71], [68, '-', 71, '-', 76, '-', '-', 0],
    [81, '-', 79, 76, 77, 76, 74, 72], [72, '-', 69, 72, 77, '-', 76, 74],
    [74, '-', 71, 74, 79, '-', 77, 76], [76, 74, 72, 71, 68, '-', '-', 0],
    [74, '-', 77, '-', 81, '-', 77, 74], [76, '-', 72, '-', 69, '-', 72, 76],
    [77, '-', 76, 77, 79, 77, 76, 72], [71, '-', 68, 71, 76, '-', '-', '-'],
    [74, 77, 81, 77, 74, 77, 81, 84], [81, '-', 76, '-', 72, '-', 76, '-'],
    [77, 76, 74, 72, 79, 77, 76, 74], [76, '-', '-', '-', 80, '-', 83, 0],
  ];
  let seed = 7;
  for (let b = 0; b < bars; b++) {
    const t0 = b * 16 * step;
    const [root, tri] = CH[prog[b]];
    const secB = b >= 8;
    // bass: driving octave 8ths
    for (let i = 0; i < 8; i++) {
      const f = midiHz(root + (i % 2 ? 12 : 0));
      synthWave(buf, L, t0 + i * 2 * step, f, 0.11, 'triangle', step * 1.8);
      synthWave(buf, Rc, t0 + i * 2 * step, f, 0.11, 'triangle', step * 1.8);
    }
    // arp: 16ths, quiet pulse, panned right
    for (let i = 0; i < 16; i++) {
      const m = tri[[0, 1, 2, 1][i % 4]] + (i >= 8 && secB ? 12 : 0);
      synthWave(buf, Rc, t0 + i * step, midiHz(m), 0.022, 'square', step * 0.7);
      synthWave(buf, L, t0 + i * step, midiHz(m), 0.008, 'square', step * 0.7);
    }
    // lead: square with hold, panned slightly left
    const row = lead[b];
    for (let i = 0; i < 8; i++) {
      const n = row[i];
      if (typeof n !== 'number' || !n) continue;
      let len = 1; while (i + len < 8 && row[i + len] === '-') len++;
      const d = len * 2 * step * 0.92;
      synthWave(buf, L, t0 + i * 2 * step, midiHz(n), 0.05, 'square', d);
      synthWave(buf, Rc, t0 + i * 2 * step + 0.012, midiHz(n) * 1.003, 0.035, 'square', d);
    }
    // drums
    const kicks = secB ? [0, 3, 6, 8, 10, 14] : [0, 6, 8, 11];
    for (const k of kicks) { synthKick(L, t0 + k * step, 0.42, sr); synthKick(Rc, t0 + k * step, 0.42, sr); }
    const snares = b === bars - 1 ? [4, 12, 13, 14, 15] : b % 4 === 3 ? [4, 12, 14, 15] : [4, 12];
    for (const sn of snares) {
      synthNoise(L, t0 + sn * step, 0.13, 0.16, false, sr, seed += 17);
      synthNoise(Rc, t0 + sn * step, 0.13, 0.16, false, sr, seed += 17);
      synthWave(buf, L, t0 + sn * step, 196, 0.06, 'triangle', 0.06);
      synthWave(buf, Rc, t0 + sn * step, 196, 0.06, 'triangle', 0.06);
    }
    for (let h = 0; h < 16; h += 2) {
      const v = h % 4 === 2 ? 0.07 : 0.035;
      synthNoise(L, t0 + h * step, 0.03, v, true, sr, seed += 31);
      synthNoise(Rc, t0 + h * step, 0.03, v * 0.8, true, sr, seed += 31);
    }
  }
  for (let i = 0; i < L.length; i++) { L[i] = Math.tanh(L[i] * 1.2); Rc[i] = Math.tanh(Rc[i] * 1.2); }
  return buf;
}

function startBgm() {
  if (bgmSrc || muted) return;
  const ctx = audio();
  if (!bgmBuffer) bgmBuffer = renderBgmBuffer();
  if (!bgmGain) {
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.32;
    bgmGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  bgmSrc = ctx.createBufferSource();
  bgmSrc.buffer = bgmBuffer;
  bgmSrc.loop = true;
  bgmSrc.connect(bgmGain);
  bgmSrc.start();
}

function stopBgm() {
  try { bgmSrc?.stop(); } catch { /* */ }
  bgmSrc = null;
}

function updateHud() {
  const hp = Math.max(0, Math.min(player.maxHp, player.hp | 0));
  const per = player.maxHp / HEART_SLOTS;
  const filled = hp <= 0 ? 0 : Math.min(HEART_SLOTS, Math.ceil(hp / per));
  $('hpHearts').textContent = '♥'.repeat(filled) + '♡'.repeat(HEART_SLOTS - filled);
  $('hpVal').textContent = `${hp}/${player.maxHp}`;
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
  muzzleFlash(); // HIT_MUZZLE_FX_v1
  gun.rotation.x = -0.1;
  gunSlide.position.z = -0.24;
  ray.setFromCamera(new THREE.Vector2(0, 0), cam);
  const hits = ray.intersectObjects(enemyHitMeshes(), false);
  const wallHit = ray.intersectObjects(solids, false)[0];
  if (hits[0] && wallHit && wallHit.distance < hits[0].distance) hits.length = 0;
  if (hits[0]) {
    const e = findEnemyFromHit(hits[0].object);
    if (e) {
      const head = hits[0].object.userData?.hitZone === 'head';
      hitFx(hits[0], head, ray.ray.direction); // HIT_MUZZLE_FX_v1
      const dmg = head ? 2 : 1;
      e.hp -= dmg;
      e.flash = head ? 0.35 : 0.2;
      if (head) {
        sfxHeadshot();
        toast('🎯 ヘッドショット!');
        headshotPop();
        setRootEmissive(e.mesh, 1, 0.85, 0.35);
        player.shake = 0.04;
      } else sfxHit();
      if (e.hp <= 0) killEnemy(e);
    }
  }
  updateHud();
}

function killEnemy(e) {
  e.alive = false;
  sfxDeath();
  toast(`☠ ${e.def.name} 撃破`);
  setRootEmissive(e.mesh, 1, 0.35, 0.2);
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
      e.shotCd = (e.shotCd ?? 0) - dt;
      dist = horizDistToPlayer(m);
      if (dist >= def.stop && dist <= def.range && e.shotCd <= 0) {
        e.shotCd = def.shotRate;
        if (Math.random() < 0.5) {
          damagePlayer(def.shotDmg, def.name);
          setRootEmissive(m, 0.9, 0.5, 0.9);
          setTimeout(() => { if (e.alive) setRootEmissive(m, 0, 0, 0); }, 80);
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
    m.position.y = m.userData.feetY ?? 0;

    if (dist <= def.melee) {
      e.touchAcc += def.touchDps * dt;
      if (e.touchAcc >= 10 && player.hurtI <= 0) {
        e.touchAcc = 0;
        damagePlayer(1, def.name);
      }
    } else e.touchAcc = 0;

    e.flash = Math.max(0, e.flash - dt);
    if (e.flash > 0) setRootEmissive(m, 1, 0.5, 0.3);
    else if (e.alive) setRootEmissive(m, 0, 0, 0);

    m.position.x = clamp(m.position.x, -W / 2 + 0.5, W / 2 - 0.5);
    m.position.z = clamp(m.position.z, -D / 2 + 0.5, D / 2 - 0.5);
    collideXZ(m.position, 0.4);
    for (const o of enemies) {
      if (o === e || !o.alive || !o.mesh) continue;
      const ox = m.position.x - o.mesh.position.x, oz = m.position.z - o.mesh.position.z;
      const od = Math.hypot(ox, oz);
      if (od < 0.9 && od > 1e-4) { m.position.x += ox / od * (0.9 - od) * 0.5; m.position.z += oz / od * (0.9 - od) * 0.5; }
    }
  }
}

function updatePickups(dt) {
  nearPickup = null;
  let nearest = PICKUP_BTN_R + 1;
  for (const p of pickups) {
    if (!p.mesh) {
      p.timer -= dt;
      if (p.timer <= 0) spawnPickupSpot(p);
      continue;
    }
    p.mesh.rotation.y += dt * 0.8;
    const h = horizDistXZ(player.pos.x, player.pos.z, p.x, p.z);
    if (h < nearest) { nearest = h; nearPickup = p; }
    if (phase === 'play' && h < PICKUP_R) collectPickup(p);
  }
  const btn = $('btnPick');
  if (btn) {
    const show = phase === 'play' && nearPickup?.mesh && nearest <= PICKUP_BTN_R;
    btn.style.display = show ? 'block' : 'none';
    if (show) {
      const labels = { ammo: '📦 弾薬取得', herb: '🌿 回復草', medkit: '➕ 救急箱' };
      btn.textContent = labels[nearPickup.kind] || '取得';
    }
  }
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
  collideXZ(player.pos, 0.35);

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
  if (e.code === 'KeyF') tryCollectNearPickup();
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
  player.pos.set(0, 1.6, 9);
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
$('btnHerb').onclick = (e) => { e.stopPropagation(); useHerb(); };
$('btnPick').onclick = (e) => { e.stopPropagation(); tryCollectNearPickup(); };
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
