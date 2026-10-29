// PS1 Moon Push — lobby space scene → moon arena match
import * as THREE from 'three';
import { createPipeline } from '../ps1-tps-explore-rpg-2026-10-29/render.js';
import { buildArena, buildLobbySpace, tickLobbyFloat, makeAstronaut } from './world.js';
import { MoonNet, normalizePlayers } from './net.js';
import { OfflineRoom } from './offline.js';

const $ = id => document.getElementById(id);
const V3 = THREE.Vector3;

const R = new THREE.WebGLRenderer({ antialias: false });
R.setPixelRatio(1);
R.setSize(innerWidth, innerHeight);
document.body.prepend(R.domElement);

const lobbyScene = new THREE.Scene();
lobbyScene.background = new THREE.Color(0.01, 0.012, 0.028);
lobbyScene.fog = new THREE.FogExp2(0x020308, 0.008);

const arenaScene = new THREE.Scene();
arenaScene.background = new THREE.Color(0.02, 0.025, 0.04);
arenaScene.fog = new THREE.FogExp2(0x050608, 0.028);

const cam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 200);
const pipe = createPipeline(R);
const lobby = buildLobbySpace(lobbyScene);
buildArena(arenaScene);

let view = 'lobby'; // lobby | arena
let trans = null; // { phase: 'out'|'in', t: number }
const TRANS_DUR = 0.4;

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
    arenaScene.add(g);
    avatars.set(id, { g, target: new V3(), smooth: new V3() });
  }
  return avatars.get(id);
}

function clearArenaAvatars() {
  for (const [id, a] of avatars) {
    arenaScene.remove(a.g);
    avatars.delete(id);
  }
}

function removeAvatar(id) {
  const a = avatars.get(id);
  if (a) { arenaScene.remove(a.g); avatars.delete(id); }
}

function goToArena() {
  if (view === 'arena' || trans) return;
  trans = { phase: 'out', t: 0 };
}

function finishTransition() {
  view = 'arena';
  clearArenaAvatars();
}

function currentScene() {
  return view === 'arena' ? arenaScene : lobbyScene;
}

function inMatchView() {
  return view === 'arena' && (phase === 'countdown' || phase === 'play' || phase === 'result');
}

function setPlayControls(on) {
  document.body.classList.toggle('play', on);
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
  if (e.code === 'Space' && phase === 'play') { pushPulse = true; e.preventDefault(); }
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
$('pushBtn').addEventListener('pointerdown', () => { if (phase === 'play') pushPulse = true; });

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

function onMatchApproach() {
  goToArena();
  setPlayControls(false);
}

function onMatchPlaying() {
  goToArena();
  setPlayControls(true);
  $('lobby').classList.remove('show');
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
      view = 'lobby';
      setPlayControls(false);
      $('lobby').classList.add('show');
      $('lobbyText').textContent = 'マッチメイキング';
      $('lobbySub').textContent = `${msg.count ?? msg.players?.length ?? msg.inQueue ?? '?'} 人 / 開始 ${msg.needed ?? msg.min ?? 2} 人 — 宇宙で待機中`;
      break;
    case 'countdown': {
      phase = 'countdown';
      onMatchApproach();
      const n = msg.seconds ?? msg.value ?? msg.n ?? 3;
      showBanner(String(n));
      break;
    }
    case 'start':
      phase = 'play';
      onMatchPlaying();
      showBanner('START!');
      break;
    case 'state': {
      const p = msg.phase ?? 'play';
      if (p === 'play' || p === 'countdown') {
        if (phase !== 'play') onMatchApproach();
        if (p === 'play' && phase !== 'play') onMatchPlaying();
      }
      phase = p;
      timeLeft = msg.timeLeft ?? msg.time ?? msg.t ?? timeLeft;
      lastState = normalizePlayers(msg);
      alive = msg.alive ?? msg.aliveCount ?? lastState.filter(pl => pl.alive).length;
      const me = lastState.find(pl => pl.id === myId);
      if (me) myDeaths = me.deaths;
      updateHud();
      break;
    }
    case 'result':
      phase = 'result';
      setPlayControls(false);
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
  view = 'lobby';
  setPlayControls(false);
  setStatus('Realtime に接続中…');
  $('lobby').classList.add('show');
  $('lobbyText').textContent = '接続中';
  $('lobbySub').textContent = '宇宙軌道上でクルー待機…';
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
  view = 'lobby';
  cdShown = -1;
  setPlayControls(false);
  $('lobby').classList.add('show');
  $('lobbyText').textContent = fromFail ? 'offline practice' : 'オフライン練習';
  $('lobbySub').textContent = '短い宇宙待機 → 月面アリーナ（ボット3体）';
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
const lobbyCamBase = new V3(0, 2.2, 11);
const lobbyLook = new V3(0, 1.2, -6);

function updateLobbyCamera(t, dt) {
  const orbit = t * 0.18;
  cam.position.set(
    lobbyCamBase.x + Math.sin(orbit) * 2.8,
    lobbyCamBase.y + Math.sin(t * 0.5) * 0.25,
    lobbyCamBase.z + Math.cos(orbit) * 0.6,
  );
  const look = lobbyLook.clone().add(new V3(Math.sin(orbit * 0.7) * 0.5, Math.sin(t * 0.9) * 0.2, 0));
  cam.lookAt(look);
}

function updateArenaCamera(dt) {
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

function updateTransition(dt) {
  if (!trans) return 0;
  trans.t += dt;
  if (trans.phase === 'out') {
    if (trans.t >= TRANS_DUR) {
      finishTransition();
      trans.phase = 'in';
      trans.t = 0;
    }
    return Math.min(1, trans.t / TRANS_DUR);
  }
  if (trans.t >= TRANS_DUR) {
    trans = null;
    return 0;
  }
  return 1 - trans.t / TRANS_DUR;
}

const clock = new THREE.Clock();
R.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const fade = updateTransition(dt);

  if (bannerT > 0) {
    bannerT -= dt;
    if (bannerT <= 0) $('banner').classList.remove('show');
  }

  tickLobbyFloat(lobby.floaters, t);

  if (mode === 'offline' && offline) {
    if (offline.phase === 'countdown' && offline.countdown !== cdShown && offline.countdown > 0) {
      cdShown = offline.countdown;
      phase = 'countdown';
      onMatchApproach();
      showBanner(String(cdShown));
    }
    if (offline.phase === 'play') {
      if (phase !== 'play') {
        phase = 'play';
        onMatchPlaying();
        showBanner('START!');
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
    if (view === 'arena') syncAvatars(st, dt);
  } else if (mode === 'online') {
    if (phase === 'play' && view === 'arena') {
      inputAcc += dt;
      if (inputAcc >= 0.05) {
        inputAcc = 0;
        const mv = readMove();
        net?.sendInput(mv.x, mv.z, pushPulse);
        pushPulse = false;
      }
    }
    if (lastState && view === 'arena') syncAvatars(lastState, dt);
    updateHud();
  }

  if (view === 'lobby') updateLobbyCamera(t, dt);
  else updateArenaCamera(dt);

  pipe.render(currentScene(), cam, 'ps1b', fade);
});

updateHud();
