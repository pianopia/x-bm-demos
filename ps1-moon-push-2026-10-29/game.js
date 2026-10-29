// PS1 Moon Push — online sumo + offline practice
import * as THREE from 'three';
import { createPipeline } from '../ps1-tps-explore-rpg-2026-10-29/render.js';
import { buildArena, makeAstronaut } from './world.js';
import { MoonNet, normalizePlayers } from './net.js';
import { OfflineRoom } from './offline.js';

const $ = id => document.getElementById(id);
const V3 = THREE.Vector3;

const R = new THREE.WebGLRenderer({ antialias: false });
R.setPixelRatio(1);
R.setSize(innerWidth, innerHeight);
document.body.prepend(R.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0.02, 0.025, 0.04);
scene.fog = new THREE.FogExp2(0x050608, 0.028);

const cam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 120);
const pipe = createPipeline(R);
buildArena(scene);

addEventListener('resize', () => {
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  R.setSize(innerWidth, innerHeight);
  pipe.resize();
});

const avatars = new Map();
function ensureAvatar(id, colorIdx) {
  if (!avatars.has(id)) {
    const g = makeAstronaut(colorIdx);
    scene.add(g);
    avatars.set(id, { g, target: new V3(), smooth: new V3() });
  }
  return avatars.get(id);
}

function removeAvatar(id) {
  const a = avatars.get(id);
  if (a) { scene.remove(a.g); avatars.delete(id); }
}

const keys = new Set();
const joy = { x: 0, y: 0 };
let pushPulse = false;
const readMove = () => {
  let x = joy.x, z = joy.y;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
  const l = Math.hypot(x, z);
  if (l > 1) { x /= l; z /= l; }
  return { x, z };
};

addEventListener('keydown', e => {
  if (e.code === 'Space') { pushPulse = true; e.preventDefault(); }
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));

const joyEl = $('joy'), joyK = $('joyK');
let joyId = null, joyOx = 0, joyOy = 0;
function joyMove(cx, cy) {
  const dx = cx - joyOx, dy = cy - joyOy;
  const m = Math.min(50, Math.hypot(dx, dy));
  const a = Math.atan2(dy, dx);
  joy.x = (Math.cos(a) * m) / 50;
  joy.y = (Math.sin(a) * m) / 50;
  joyK.style.transform = `translate(${Math.cos(a) * m}px,${Math.sin(a) * m}px)`;
}
joyEl.addEventListener('pointerdown', e => {
  joyId = e.pointerId; joyEl.setPointerCapture(e.pointerId);
  const r = joyEl.getBoundingClientRect();
  joyOx = r.left + r.width / 2; joyOy = r.top + r.height / 2;
  joyMove(e.clientX, e.clientY);
});
joyEl.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e.clientX, e.clientY); });
joyEl.addEventListener('pointerup', e => {
  if (e.pointerId !== joyId) return;
  joyId = null; joy.x = joy.y = 0;
  joyK.style.transform = '';
});
$('pushBtn').addEventListener('pointerdown', () => { pushPulse = true; });

if ('ontouchstart' in window) document.body.classList.add('touch');

let mode = 'title';
let phase = 'idle';
let myId = 'local';
let myDeaths = 0;
let timeLeft = 90;
let alive = 0;
let offline = null;
let net = null;
let lastState = null;
let inputAcc = 0;
let bannerT = 0;
let cdShown = -1;

const defaultName = () => localStorage.getItem('moonpush-name') || `Astro-${(Math.random() * 8999 + 1000 | 0)}`;
$('nameIn').value = defaultName();

function setStatus(text, cls = '') {
  const el = $('status');
  el.textContent = text;
  el.className = cls;
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${(s / 60 | 0)}:${String(s % 60).padStart(2, '0')}`;
}

function updateHud() {
  $('timer').textContent = fmtTime(timeLeft);
  $('alive').textContent = `生存 ${alive || '—'}`;
  $('deaths').textContent = `落下 ${myDeaths}`;
}

function showBanner(t) {
  $('banner').textContent = t;
  $('banner').classList.add('show');
  bannerT = 1.2;
}

function handleServerMsg(msg) {
  switch (msg.type) {
    case 'welcome':
    case 'joined':
      myId = String(msg.id ?? msg.playerId ?? msg.you ?? myId);
      break;
    case 'lobby':
    case 'queue':
      phase = 'lobby';
      $('lobby').classList.add('show');
      $('lobbyText').textContent = 'マッチメイキング';
      $('lobbySub').textContent = `${msg.count ?? msg.players?.length ?? msg.inQueue ?? '?'} 人 / 開始 ${msg.needed ?? msg.min ?? 2} 人`;
      break;
    case 'countdown': {
      phase = 'countdown';
      const n = msg.seconds ?? msg.value ?? msg.n ?? 3;
      showBanner(String(n));
      break;
    }
    case 'start':
      phase = 'play';
      $('lobby').classList.remove('show');
      showBanner('START!');
      break;
    case 'state': {
      phase = msg.phase ?? 'play';
      timeLeft = msg.timeLeft ?? msg.time ?? msg.t ?? timeLeft;
      lastState = normalizePlayers(msg);
      alive = msg.alive ?? msg.aliveCount ?? lastState.filter(p => p.alive).length;
      const me = lastState.find(p => p.id === myId);
      if (me) myDeaths = me.deaths;
      updateHud();
      break;
    }
    case 'result':
      phase = 'result';
      showResult(msg.scores ?? msg.standings ?? msg.players ?? lastState);
      break;
    default:
      break;
  }
}

function showResult(rows) {
  const list = $('scoreList');
  list.innerHTML = '';
  const arr = (rows || []).map(r => ({
    name: r.name ?? r.id,
    deaths: r.deaths ?? r.d ?? 0,
  })).sort((a, b) => a.deaths - b.deaths);
  for (const r of arr) {
    const li = document.createElement('li');
    li.textContent = `${r.name} — 落下 ${r.deaths}`;
    list.appendChild(li);
  }
  $('result').classList.add('show');
}

function startOnline(name) {
  mode = 'online';
  phase = 'connecting';
  setStatus('Realtime に接続中…');
  net = new MoonNet({
    onStatus(st, detail) {
      if (st === 'online') setStatus(`オンライン (${detail})`, '');
      if (st === 'offline') startOffline(name, true);
      if (st === 'connecting') setStatus(`接続中… ${detail}`, '');
    },
    onMessage: handleServerMsg,
  });
  net.connect(name);
}

function startOffline(name, fromFail = false) {
  if (net) { net.disconnect(); net = null; }
  mode = 'offline';
  myId = 'local';
  offline = new OfflineRoom(name);
  phase = 'lobby';
  cdShown = -1;
  $('lobby').classList.add('show');
  $('lobbyText').textContent = fromFail ? 'offline practice' : 'オフライン練習';
  $('lobbySub').textContent = 'ボット 3 体 / サーバーなし';
  setStatus('offline practice — WS 未接続', 'practice');
}

function beginPlay() {
  $('title').classList.add('hide');
  const name = $('nameIn').value.trim() || defaultName();
  localStorage.setItem('moonpush-name', name);
  startOnline(name);
}

$('playBtn').onclick = beginPlay;
$('retryBtn').onclick = () => { $('result').classList.remove('show'); location.reload(); };

const camOff = new V3(0, 5.5, 10);
const lookAt = new V3();

function updateCamera(dt) {
  const me = avatars.get(myId) || avatars.get('local');
  const p = me?.g.position ?? lookAt;
  lookAt.lerp(p, 1 - Math.pow(0.001, dt));
  const yaw = me?.g.rotation.y ?? 0;
  const off = camOff.clone().applyAxisAngle(new V3(0, 1, 0), yaw);
  cam.position.lerp(lookAt.clone().add(off), 1 - Math.pow(0.0008, dt));
  cam.lookAt(lookAt.x, lookAt.y + 1.2, lookAt.z);
}

function syncAvatars(players, dt) {
  const ids = new Set(players.map(p => p.id));
  for (const id of avatars.keys()) if (!ids.has(id)) removeAvatar(id);
  players.forEach((p, i) => {
    const a = ensureAvatar(p.id, i);
    a.target.set(p.x, 0, p.z);
    a.smooth.lerp(a.target, 1 - Math.pow(0.00001, dt));
    a.g.position.copy(a.smooth);
    if (Math.abs(p.vx) + Math.abs(p.vz) > 0.05) a.g.rotation.y = Math.atan2(p.vx, p.vz);
    else if (p.yaw) a.g.rotation.y = p.yaw;
    a.g.visible = p.alive !== false;
  });
}

const clock = new THREE.Clock();
R.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (bannerT > 0) {
    bannerT -= dt;
    if (bannerT <= 0) $('banner').classList.remove('show');
  }

  if (mode === 'offline' && offline) {
    if (offline.phase === 'countdown' && offline.countdown !== cdShown && offline.countdown > 0) {
      cdShown = offline.countdown;
      showBanner(String(cdShown));
      phase = 'countdown';
    }
    if (offline.phase === 'play') {
      if (phase !== 'play') {
        phase = 'play';
        showBanner('START!');
        $('lobby').classList.remove('show');
      }
      const mv = readMove();
      offline.input.x = mv.x;
      offline.input.z = mv.z;
      offline.input.push = pushPulse;
      pushPulse = false;
    }
    const ev = offline.step(dt);
    if (ev) handleServerMsg(ev);
    const st = offline.players.map(({ id, name, x, z, vx, vz, deaths, alive: al, yaw }) => ({ id, name, x, z, vx, vz, deaths, alive: al, yaw }));
    timeLeft = offline.timeLeft;
    alive = st.filter(p => p.alive).length;
    myDeaths = st.find(p => p.id === 'local')?.deaths ?? 0;
    updateHud();
    syncAvatars(st, dt);
  } else if (mode === 'online') {
    if (phase === 'play') {
      inputAcc += dt;
      if (inputAcc >= 0.05) {
        inputAcc = 0;
        const mv = readMove();
        net?.sendInput(mv.x, mv.z, pushPulse);
        pushPulse = false;
      }
    }
    if (lastState) syncAvatars(lastState, dt);
    updateHud();
  }

  if ((phase === 'lobby' || phase === 'connecting') && mode !== 'offline') {
    const t = clock.elapsedTime;
    syncAvatars([{ id: myId, x: Math.sin(t) * 2, z: Math.cos(t) * 2, vx: 0, vz: 0, deaths: 0, alive: true, yaw: t }], dt);
  }

  updateCamera(dt);
  pipe.render(scene, cam, 'ps1b', 0);
});

updateHud();
