// PS1 Moon Push — float in space (title + matchmaking) → moon arena on countdown
import * as THREE from 'three';
import { createPipeline } from '../ps1-tps-explore-rpg-2026-10-29/render.js';
import { buildArena, buildLobbySpace, tickLobbyFloat, attachLobbyFloaters, MATCH_PLAYERS } from './world.js';
import { loadStarfightAssets, spawnAstronaut, updateArenaAnim, playPushFlip, facingFromDirection } from './astro.js';
import { MoonNet, normalizePlayers } from './net.js';
import { OfflineRoom } from './offline.js';
import { mountAudioUi } from './audio.js';

const $ = id => document.getElementById(id);
const V3 = THREE.Vector3;
const aud = mountAudioUi($('sndBtn'));

const R = new THREE.WebGLRenderer({ antialias: false });
R.setPixelRatio(1);
R.setSize(innerWidth, innerHeight);
document.body.prepend(R.domElement);

const lobbyScene = new THREE.Scene();
lobbyScene.background = new THREE.Color(0.045, 0.05, 0.09);
lobbyScene.fog = new THREE.FogExp2(0x0c0e18, 0.004);

const arenaScene = new THREE.Scene();
arenaScene.background = new THREE.Color(0.07, 0.075, 0.1);
arenaScene.fog = new THREE.FogExp2(0x101218, 0.011);

const cam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 200);
const pipe = createPipeline(R);
let lobby = null;
let astroTemplate = null;
let astroClips = null;

loadStarfightAssets().then(assets => {
  astroTemplate = assets.template;
  astroClips = assets.clips;
  lobby = buildLobbySpace(lobbyScene, assets.tex);
  attachLobbyFloaters(lobby.floaters, lobby.group, () => spawnAstronaut(astroTemplate, astroClips));
  buildArena(arenaScene, assets.tex, assets.rocks);
  setStatus('宇宙ロビー — キューに入るとマッチング');
}).catch(err => {
  console.error('[MoonPush] loadStarfightAssets failed', err);
  setStatus(`読込失敗: ${err?.message || err}`, 'off');
});

let view = 'lobby'; // lobby | arena
let trans = null; // { phase: 'out'|'in', t: number }
const TRANS_DUR = 0.4;
const LOBBY_BOT_FILL_SEC = 12;

let playerName = '';
let lobbyWait = 0;
let lobbyCount = 1;
let botFillTriggered = false;

addEventListener('resize', () => {
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  R.setSize(innerWidth, innerHeight);
  pipe.resize();
});

const avatars = new Map();
function ensureAvatar(id, colorIdx) {
  if (!astroTemplate || !astroClips) return null;
  if (!avatars.has(id)) {
    const rig = spawnAstronaut(astroTemplate, astroClips);
    rig.play('idle', 0);
    arenaScene.add(rig.root);
    avatars.set(id, { g: rig.root, rig, smooth: new V3(), vel: new V3(), snap: new V3() });
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
  camYaw = Math.PI;
  localFace = 0;
  lastMove.x = 0;
  lastMove.z = 1;
}

function currentScene() {
  return view === 'arena' ? arenaScene : lobbyScene;
}

function setPlayControls(on) {
  document.body.classList.toggle('play', on);
}

const keys = new Set();
const joy = { x: 0, y: 0 };
let pushPulse = false;

/** Independent camera yaw (廃墟の灯火 / ps1-tps-explore-rpg と同じ — mesh.rotation に連動しない). */
let camYaw = Math.PI;
const camPitch = 0.34;
const camDist = 10.5;
let localFace = 0;
const lastMove = { x: 0, z: 1 };
const _fwd = new V3();
const _right = new V3();
const _dir = new V3();

/** Camera-relative move → world XZ (same basis as ps1-tps-explore-rpg game.js). */
function readMoveWorld() {
  let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + joy.x;
  let iy = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + joy.y;
  _fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  _right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
  _dir.copy(_fwd).multiplyScalar(iy).add(_right.clone().multiplyScalar(ix));
  const dl = _dir.length();
  if (dl < 0.05) return { x: 0, z: 0 };
  if (dl > 1) _dir.divideScalar(dl);
  return { x: _dir.x, z: _dir.z };
}

function updateLocalFace(avatar, mv, dt) {
  const dl = Math.hypot(mv.x, mv.z);
  if (dl > 0.05) {
    const target = facingFromDirection(mv.x, mv.z);
    let d = target - localFace;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    localFace += d * Math.min(1, dt * 12);
    lastMove.x = mv.x / dl;
    lastMove.z = mv.z / dl;
  } else {
    _fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const target = facingFromDirection(_fwd.x, _fwd.z);
    let d = target - localFace;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    localFace += d * Math.min(1, dt * 4);
  }
  avatar.g.rotation.y = localFace;
}

addEventListener('keydown', e => {
  if (e.code === 'Space' && phase === 'play') { pushPulse = true; aud.sfx('push'); e.preventDefault(); }
  if (e.code === 'KeyM') {
    aud.unlock();
    aud.toggleMute();
    if (!aud.muted) aud.sfx('select');
    paintMuteBtn();
    e.preventDefault();
  }
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
  joy.y = -(Math.sin(a) * m) / 50;
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
$('pushBtn').addEventListener('pointerdown', () => {
  if (phase === 'play') { pushPulse = true; aud.sfx('push'); }
});

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
let lastStateAt = 0;
let lastStateTick = -1;
let inputAcc = 0;
let bannerT = 0;
let cdShown = -1;
let lastDeathCount = 0;
let lastCdBeep = -1;

function syncBgm() {
  if (phase === 'result') aud.setBgm('off');
  else if (phase === 'play' || phase === 'countdown') aud.setBgm('match');
  else if (view === 'lobby') aud.setBgm('lobby');
  else aud.setBgm('off');
}

function paintMuteBtn() {
  $('sndBtn').textContent = aud.muted ? '♪ OFF' : '♪ ON';
  $('sndBtn').classList.toggle('off', aud.muted);
  syncBgm();
}

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
  if (myDeaths > lastDeathCount) {
    aud.sfx('fall');
    lastDeathCount = myDeaths;
  }
}

function showBanner(t) {
  $('banner').textContent = t;
  $('banner').classList.add('show');
  bannerT = 1.2;
  const s = String(t);
  if (/^\d+$/.test(s)) {
    const n = +s;
    if (n !== lastCdBeep) { lastCdBeep = n; aud.sfx('countdown'); }
  } else if (s === 'START!') {
    aud.sfx('start');
    lastCdBeep = -1;
  }
}

function onMatchApproach() {
  if (view !== 'lobby') return;
  goToArena();
  setPlayControls(false);
  syncBgm();
}

function onMatchPlaying() {
  goToArena();
  setPlayControls(true);
  $('lobby').classList.remove('show');
  syncBgm();
}

function updateLobbyUi() {
  const left = Math.max(0, Math.ceil(LOBBY_BOT_FILL_SEC - lobbyWait));
  const need = MATCH_PLAYERS;
  $('lobbySub').textContent = `${lobbyCount}/${need} 人 — 4人マッチ / NPC補充まで ${left}秒`;
}

function startBotFillMatch() {
  if (botFillTriggered || mode === 'botfill' || mode === 'offline') return;
  botFillTriggered = true;
  if (net) { net.disconnect(); net = null; }
  mode = 'botfill';
  myId = 'local';
  offline = new OfflineRoom(playerName, { localId: 'local', lobbySec: 1.5 });
  phase = 'lobby';
  view = 'lobby';
  cdShown = -1;
  setPlayControls(false);
  $('lobby').classList.add('show');
  $('lobbyText').textContent = 'NPC 補充マッチ';
  $('lobbySub').textContent = `${MATCH_PLAYERS}人（あなた + NPC ${MATCH_PLAYERS - 1}）`;
  setStatus('bot fill — 4人ローカル（サーバー待機タイムアウト）', 'practice');
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
      lobbyCount = Math.max(1, msg.count ?? msg.players?.length ?? msg.inQueue ?? 1);
      updateLobbyUi();
      break;
    case 'countdown': {
      botFillTriggered = true;
      phase = 'countdown';
      onMatchApproach();
      const n = msg.seconds ?? msg.value ?? msg.n ?? 3;
      showBanner(String(n));
      break;
    }
    case 'start':
      botFillTriggered = true;
      phase = 'play';
      onMatchPlaying();
      showBanner('START!');
      break;
    case 'state': {
      const p = msg.phase ?? 'play';
      if (p === 'play' || p === 'countdown') botFillTriggered = true;
      if ((p === 'play' || p === 'countdown') && view === 'lobby') onMatchApproach();
      if (p === 'play' && phase !== 'play') onMatchPlaying();
      phase = p;
      timeLeft = msg.timeLeft ?? msg.time ?? msg.t ?? timeLeft;
      lastState = normalizePlayers(msg);
      lastStateAt = clock.elapsedTime;
      lastStateTick = msg.tick ?? lastStateTick;
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
  syncBgm();
}

function showResult(rows) {
  aud.sfx('result');
  aud.setBgm('off');
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
  playerName = name;
  mode = 'online';
  phase = 'connecting';
  view = 'lobby';
  lobbyWait = 0;
  lobbyCount = 1;
  botFillTriggered = false;
  setPlayControls(false);
  setStatus('Realtime に接続中…');
  $('lobby').classList.add('show');
  $('lobbyText').textContent = '接続中';
  $('lobbySub').textContent = `4人マッチ待機 — NPC補充 ${LOBBY_BOT_FILL_SEC}秒`;
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
  botFillTriggered = true;
  offline = new OfflineRoom(name, { lobbySec: 2.5 });
  phase = 'lobby';
  view = 'lobby';
  cdShown = -1;
  setPlayControls(false);
  $('lobby').classList.add('show');
  $('lobbyText').textContent = fromFail ? 'offline practice' : 'オフライン練習';
  $('lobbySub').textContent = `${MATCH_PLAYERS}人（NPC ${MATCH_PLAYERS - 1}）— 宇宙待機 → 月面`;
  setStatus('offline practice — WS 未接続', 'practice');
}

function beginPlay() {
  const name = $('nameIn').value.trim() || defaultName();
  localStorage.setItem('moonpush-name', name);
  playerName = name;
  aud.unlock();
  aud.sfx('select');
  lastDeathCount = 0;
  $('title').classList.add('hide');
  document.body.classList.remove('title');
  startOnline(name);
  syncBgm();
}

$('playBtn').onclick = beginPlay;
$('retryBtn').onclick = () => { $('result').classList.remove('show'); location.reload(); };

const lookAt = new V3();
const lobbyCamBase = new V3(0, 1.6, 13);
const lobbyLook = new V3(0, 0.8, -4);
const _back = new V3();

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
  const cp = Math.cos(camPitch);
  _back.set(Math.sin(camYaw) * cp, Math.sin(camPitch), Math.cos(camYaw) * cp);
  const tgt = lookAt.clone().add(new V3(0, 1.2, 0));
  cam.position.lerp(tgt.clone().addScaledVector(_back, camDist), 1 - Math.pow(0.0008, dt));
  cam.lookAt(tgt.x, tgt.y, tgt.z);
}

function syncAvatars(players, dt, localMv = null, opts = {}) {
  const stateAge = opts.stateAge ?? 0;
  const extrap = Math.min(0.14, Math.max(0, stateAge));
  const ids = new Set(players.map(p => p.id));
  for (const id of avatars.keys()) if (!ids.has(id)) removeAvatar(id);
  players.forEach((p, i) => {
    const a = ensureAvatar(p.id, i);
    if (!a) return;
    const vx = p.vx ?? 0;
    const vz = p.vz ?? 0;
    a.vel.set(vx, 0, vz);
    a.snap.set(p.x, 0, p.z);
    const px = p.x + vx * extrap;
    const pz = p.z + vz * extrap;
    const speed = Math.hypot(vx, vz);
    const corr = speed > 2 ? 16 : speed > 0.5 ? 11 : 7;
    const alpha = 1 - Math.exp(-corr * dt);
    if (a.smooth.lengthSq() < 1e-8) a.smooth.set(px, 0, pz);
    const err = Math.hypot(px - a.smooth.x, pz - a.smooth.z);
    if (err > 2.5) a.smooth.set(px, 0, pz);
    else {
      a.smooth.x += (px - a.smooth.x) * alpha;
      a.smooth.z += (pz - a.smooth.z) * alpha;
    }
    if (opts.integrateVel !== false && speed > 0.3) {
      a.smooth.x += vx * dt * 0.92;
      a.smooth.z += vz * dt * 0.92;
    }
    a.g.position.copy(a.smooth);
    if (p.id === myId && localMv) {
      updateLocalFace(a, localMv, dt);
    } else {
      let target = p.yaw;
      if (Math.abs(vx) + Math.abs(vz) > 0.05) target = facingFromDirection(vx, vz);
      if (target != null && !Number.isNaN(target)) {
        let d = target - a.g.rotation.y;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        a.g.rotation.y += d * Math.min(1, dt * 10);
      }
    }
    a.g.visible = p.alive !== false;
    updateArenaAnim(a.rig, speed, dt);
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

  tickLobbyFloat(lobby?.floaters ?? [], t, dt);

  if (view === 'lobby') updateLobbyCamera(t, dt);
  else updateArenaCamera(dt);

  if ((mode === 'offline' || mode === 'botfill') && offline) {
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
      const mv = readMoveWorld();
      offline.input.x = mv.x;
      offline.input.z = mv.z;
      if (pushPulse && mv.x * mv.x + mv.z * mv.z < 0.01) {
        offline.input.x = lastMove.x;
        offline.input.z = lastMove.z;
      }
      if (pushPulse) {
        aud.sfx(offline.lastPushHit ? 'pushHit' : 'push');
        const me = avatars.get('local');
        if (me?.rig) playPushFlip(me.rig);
      }
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
    if (view === 'arena') {
      const mv = phase === 'play' ? readMoveWorld() : null;
      syncAvatars(st, dt, mv, { stateAge: 0, integrateVel: false });
    }
  } else if (mode === 'online') {
    if ((phase === 'lobby' || phase === 'connecting') && !botFillTriggered) {
      lobbyWait += dt;
      if (phase === 'lobby') updateLobbyUi();
      if (lobbyWait >= LOBBY_BOT_FILL_SEC) startBotFillMatch();
    }
    if (phase === 'play' && view === 'arena') {
      inputAcc += dt;
      if (inputAcc >= 0.05) {
        inputAcc = 0;
        const mv = readMoveWorld();
        if (pushPulse) {
          aud.sfx('push');
          const me = avatars.get(myId);
          if (me?.rig) playPushFlip(me.rig);
        }
        net?.sendInput(mv.x, mv.z, pushPulse);
        pushPulse = false;
      }
    }
    if (lastState && view === 'arena') {
      const mv = phase === 'play' ? readMoveWorld() : null;
      const stateAge = clock.elapsedTime - lastStateAt;
      syncAvatars(lastState, dt, mv, { stateAge, integrateVel: true });
    }
    updateHud();
  }

  aud.tick(dt);
  pipe.render(currentScene(), cam, 'ps1b', fade);
});

updateHud();
