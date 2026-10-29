import * as THREE from './vendor/three.module.js';
import { T, M, mats, U, computeBounce, createPipeline } from './render.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const STICK_R = 56;
const FIRE_DRAG_MAX = 14;
const FIRE_TAP_MS = 220;

/** @type {'title'|'play'} */
let phase = 'title';
let muted = localStorage.getItem('fps-mute') === '1';
let renderMode = localStorage.getItem('fps-render') || 'ps1b';

const player = {
  hp: 100,
  maxHp: 100,
  ammo: 12,
  magSize: 12,
  reserve: 48,
  reloading: false,
  reloadT: 0,
  reloadDur: 1.4,
  yaw: 0,
  pitch: 0,
  pos: new THREE.Vector3(0, 1.6, 6),
  speed: 4.2,
  fireCd: 0,
  fireRate: 0.12,
};

const move = { x: 0, z: 0 };
const stick = { on: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
const look = { on: false, id: -1, lx: 0, ly: 0, drag: 0, t0: 0 };
let pointerLocked = false;

const R = new THREE.WebGLRenderer({ antialias: false });
R.setPixelRatio(1);
R.setSize(innerWidth, innerHeight);
document.body.prepend(R.domElement);

const S = new THREE.Scene();
S.background = new THREE.Color(0x050508);
const cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 40);
const pipeline = createPipeline(R);

const solids = [];
const enemies = [];
const ray = new THREE.Raycaster();

function addSolid(geo, tex, rep, pos, rot = [0, 0, 0], emi = 0) {
  const m = new THREE.Mesh(geo, M(tex, rep, emi));
  m.position.set(...pos);
  m.rotation.set(...rot);
  S.add(m);
  solids.push(m);
  return m;
}

// Indoor arena ~14×14
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
    U.uLC.value[i].copy(L.col);
  });
  computeBounce(lights, solids);
}
syncLights();

function spawnEnemy(x, z) {
  const geo = new THREE.BoxGeometry(0.9, 1.4, 0.5, 2, 2, 1);
  const mesh = new THREE.Mesh(geo, M(T.target, [1, 1], 0));
  mesh.position.set(x, 0.7, z);
  S.add(mesh);
  const e = { mesh, hp: 3, maxHp: 3, flash: 0, alive: true };
  enemies.push(e);
  return e;
}

spawnEnemy(-3, -2);
spawnEnemy(4, -3);
spawnEnemy(-1, 3);
spawnEnemy(5, 2);
spawnEnemy(0, -5);

// Gun viewmodel
const gun = new THREE.Group();
const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.45, 1, 1, 2), M(T.metal, [1, 1], 0));
gunBody.position.set(0.22, -0.18, -0.35);
gun.add(gunBody);
cam.add(gun);
S.add(cam);

// --- Audio (procedural chips)
let actx;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  return actx;
}
function beep(freq, dur, type = 'square', vol = 0.08) {
  if (muted) return;
  const ctx = audio();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.stop(ctx.currentTime + dur);
}
function sfxShoot() { beep(180, 0.06, 'square', 0.06); beep(90, 0.08, 'sawtooth', 0.04); }
function sfxReload() { beep(420, 0.05, 'triangle', 0.05); setTimeout(() => beep(520, 0.05, 'triangle', 0.05), 120); }
function sfxHit() { beep(260, 0.08, 'sawtooth', 0.07); }
function sfxEmpty() { beep(120, 0.04, 'square', 0.05); }
function sfxHurt() { beep(80, 0.15, 'sawtooth', 0.08); }

function updateHud() {
  $('hp').textContent = `${Math.max(0, player.hp | 0)}`;
  $('ammo').textContent = `${player.ammo} / ${player.reserve}`;
  $('cross').style.opacity = phase === 'play' ? '1' : '0.3';
}

function setPhase(p) {
  phase = p;
  $('title').style.display = p === 'title' ? 'flex' : 'none';
  $('hud').style.display = p === 'play' ? 'block' : 'none';
  $('touchUi').style.display = p === 'play' ? 'block' : 'none';
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
  gun.rotation.x = -0.08;
  setTimeout(() => { gun.rotation.x = 0; }, 60);

  ray.setFromCamera(new THREE.Vector2(0, 0), cam);
  const hits = ray.intersectObjects(enemies.map(e => e.mesh).filter(Boolean), false);
  if (hits[0]) {
    const mesh = hits[0].object;
    const e = enemies.find(x => x.mesh === mesh && x.alive);
    if (e) {
      e.hp--;
      e.flash = 0.2;
      sfxHit();
      if (e.hp <= 0) {
        e.alive = false;
        e.mesh.material.uniforms.uEmi.value.setRGB(1, 0.3, 0.2);
        setTimeout(() => {
          S.remove(e.mesh);
          e.mesh = null;
        }, 120);
      }
    }
  }
  updateHud();
}

function startReload() {
  if (phase !== 'play' || player.reloading || player.ammo === player.magSize) return;
  if (player.reserve <= 0) {
    sfxEmpty();
    return;
  }
  player.reloading = true;
  player.reloadT = player.reloadDur;
  sfxReload();
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function updatePlayer(dt) {
  if (phase !== 'play') return;
  const cy = Math.cos(player.yaw), sy = Math.sin(player.yaw);
  const fx = -sy, fz = -cy;
  const rx = cy, rz = -sy;
  let mx = move.x * player.speed * dt;
  let mz = move.z * player.speed * dt;
  const vx = fx * mz + rx * mx;
  const vz = fz * mz + rz * mx;
  let nx = player.pos.x + vx;
  let nz = player.pos.z + vz;
  const pad = 0.35;
  nx = clamp(nx, -W / 2 + pad, W / 2 - pad);
  nz = clamp(nz, -D / 2 + pad, D / 2 - pad);
  player.pos.x = nx;
  player.pos.z = nz;
  cam.position.copy(player.pos);
  cam.rotation.order = 'YXZ';
  cam.rotation.y = player.yaw;
  cam.rotation.x = player.pitch;

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

  // Simple enemy poke damage
  for (const e of enemies) {
    if (!e.alive || !e.mesh) continue;
    if (e.mesh.position.distanceTo(player.pos) < 1.1) {
      player.hp -= dt * 12;
      if (Math.random() < dt * 2) sfxHurt();
    }
    e.flash = Math.max(0, e.flash - dt);
    if (e.flash > 0) e.mesh.material.uniforms.uEmi.value.setRGB(1, 0.5, 0.3);
    else if (e.alive) e.mesh.material.uniforms.uEmi.value.setRGB(0, 0, 0);
  }
  if (player.hp <= 0) {
    player.hp = 0;
    setPhase('title');
    player.hp = player.maxHp;
    player.ammo = player.magSize;
    player.reserve = 48;
  }
}

// --- Touch UI
const stickEl = $('stickBase');
const knobEl = $('stickKnob');

function stickVisual(dx, dy) {
  const len = Math.hypot(dx, dy);
  const max = STICK_R;
  const s = len > max ? max / len : 1;
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
      stick.dx = stick.dy = 0;
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
  for (const t of ev.changedTouches) {
    if (stick.on && t.identifier === stick.id) {
      stick.dx = t.clientX - stick.ox;
      stick.dy = t.clientY - stick.oy;
      stickVisual(stick.dx, stick.dy);
      const nx = stick.dx / STICK_R;
      const ny = stick.dy / STICK_R;
      move.x = clamp(nx, -1, 1);
      move.z = clamp(-ny, -1, 1);
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

// Desktop controls for web-play
const keys = new Set();
window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') startReload();
  if (e.code === 'KeyM') {
    muted = !muted;
    localStorage.setItem('fps-mute', muted ? '1' : '0');
    $('muteBtn').textContent = muted ? '🔇' : '🔊';
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

$('btnStart').onclick = () => {
  audio();
  player.hp = player.maxHp;
  player.ammo = player.magSize;
  player.reserve = 48;
  player.reloading = false;
  player.pos.set(0, 1.6, 6);
  player.yaw = Math.PI;
  player.pitch = 0;
  enemies.forEach(e => { if (e.mesh) S.remove(e.mesh); });
  enemies.length = 0;
  spawnEnemy(-3, -2);
  spawnEnemy(4, -3);
  spawnEnemy(-1, 3);
  spawnEnemy(5, 2);
  spawnEnemy(0, -5);
  setPhase('play');
};

$('btnReload').onclick = (e) => { e.stopPropagation(); startReload(); };
$('muteBtn').onclick = () => {
  muted = !muted;
  localStorage.setItem('fps-mute', muted ? '1' : '0');
  $('muteBtn').textContent = muted ? '🔇' : '🔊';
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
  updatePlayer(dt);
  updateHud();
  pipeline.render(S, cam, renderMode, phase === 'title' ? 0.35 : 0);
  requestAnimationFrame(loop);
}
setPhase('title');
loop();
