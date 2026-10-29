// NEKO_CART_SHOOTER_v1 — PS1 on-rails arcade gun shooter (auto cart, aim + shoot only)
// NEKO_CART_STAGES_v1 — title / stage select / 3 stages (mid-bosses, final boss, game clear)
import * as THREE from './vendor/three.module.js';
import { tex, colTex, M, U, createPipeline, meshToLambert } from './render.js';
import { initAudio, sfx, playBgm, stopBgm, setMuted, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];

// ---------------- renderer / scene
const R = new THREE.WebGLRenderer({ antialias: false });
R.setPixelRatio(1); R.setSize(innerWidth, innerHeight); document.body.prepend(R.domElement);
const S = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.05, 110);
S.add(cam);
U.uOutZ.value = -1e5; U.uSnap.value = 140; U.uNV.value = 0;

// ---------------- textures
const face = (base, eye, opt = {}) => tex((g, n) => {
  g.fillStyle = base; g.fillRect(0, 0, n, n);
  if (opt.stripe) { g.fillStyle = opt.stripe; for (let i = 0; i < 3; i++) g.fillRect(22 + i * 8, 0, 4, 12); }
  g.fillStyle = '#fff'; g.fillRect(10, 22, 16, 16); g.fillRect(38, 22, 16, 16);
  g.fillStyle = eye; g.fillRect(12, 24, 12, 12); g.fillRect(40, 24, 12, 12);
  g.fillStyle = '#111'; g.fillRect(16, 25, 4, 10); g.fillRect(44, 25, 4, 10);
  if (opt.patch) { g.fillStyle = '#111'; g.fillRect(36, 18, 22, 22); g.fillRect(4, 14, 60, 3); }
  if (opt.angry) { g.fillStyle = '#111'; g.fillRect(8, 16, 18, 3); g.fillRect(38, 16, 18, 3); }
  g.fillStyle = '#ff7aa8'; g.fillRect(29, 38, 6, 4);
  g.fillStyle = '#222'; g.fillRect(26, 44, 4, 2); g.fillRect(30, 46, 4, 2); g.fillRect(34, 44, 4, 2); // ω
  g.fillRect(0, 40, 14, 1); g.fillRect(0, 44, 14, 1); g.fillRect(50, 40, 14, 1); g.fillRect(50, 44, 14, 1);
  if (opt.blush) { g.fillStyle = '#ff9ac888'; g.fillRect(6, 40, 8, 4); g.fillRect(50, 40, 8, 4); }
});
const stripes = (a, b, w = 8, diag = false) => tex((g, n) => { g.fillStyle = a; g.fillRect(0, 0, n, n); g.fillStyle = b; for (let i = -n; i < n * 2; i += w * 2) { g.beginPath(); if (diag) { g.moveTo(i, 0); g.lineTo(i + w, 0); g.lineTo(i + w + n, n); g.lineTo(i + n, n); } else { g.rect(0, i, n, w); } g.fill(); } });
const vstripes = (a, b, w = 8) => tex((g, n) => { g.fillStyle = a; g.fillRect(0, 0, n, n); g.fillStyle = b; for (let i = 0; i < n; i += w * 2) g.fillRect(i, 0, w, n); });
const speck = (base, cols, cnt = 100, w = 2, h = 2) => tex((g, n) => { g.fillStyle = base; g.fillRect(0, 0, n, n); for (let i = 0; i < cnt; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * n | 0, Math.random() * n | 0, w, h); } });
const T = {
  grass: speck('#3f6e3a', ['#4f8a46', '#355f32', '#5d9a50'], 120, 2, 3),
  grassN: speck('#2c3f36', ['#3a5244', '#22322a', '#4a3a5a'], 120, 2, 3),
  stone: tex((g, n) => { g.fillStyle = '#3a3a48'; g.fillRect(0, 0, n, n); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = ['#4c4c5c', '#55526a', '#44445a'][(x + y * 3) % 3]; g.fillRect(x * 16 + (y % 2) * 8 + 1, y * 16 + 1, 14, 14); } }),
  dirt: speck('#6a4a3a', ['#7d5a46', '#58392c'], 90, 3, 2),
  rail: colTex('#b8bcc8', 0.1), sleeper: colTex('#5a3a22', 0.2),
  leaf: tex((g, n) => { g.fillStyle = '#2f7a4a'; g.fillRect(0, 0, n, n); for (let i = 0; i < 60; i++) { g.fillStyle = ['#3f9a5a', '#25603a', '#ff9ac8'][i % 7 ? i % 2 : 2]; g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 4, 4); } }),
  trunk: colTex('#5e3d26', 0.2), fence: stripes('#f2e6dc', '#c9b8aa', 6),
  candy: stripes('#fff4f4', '#e8304a', 8, true), mint: stripes('#effff6', '#2fb87a', 8, true),
  lolli: tex((g, n) => { g.fillStyle = '#ffd0ea'; g.fillRect(0, 0, n, n); g.strokeStyle = '#ff4aa0'; g.lineWidth = 5; g.beginPath(); for (let a = 0; a < 18; a += 0.2) g.lineTo(32 + Math.cos(a) * a * 1.7, 32 + Math.sin(a) * a * 1.7); g.stroke(); }),
  ginger: tex((g, n) => { g.fillStyle = '#a8662e'; g.fillRect(0, 0, n, n); g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 16 + 2, n, 2); g.fillStyle = '#ff5a8a'; g.fillRect(24, 24, 16, 16); }),
  wallA: tex((g, n) => { g.fillStyle = '#5a3a7a'; g.fillRect(0, 0, n, n); g.fillStyle = '#ffd65a'; g.fillRect(10, 14, 14, 16); g.fillRect(40, 14, 14, 16); g.fillStyle = '#3a2050'; g.fillRect(16, 14, 2, 16); g.fillRect(46, 14, 2, 16); g.fillRect(24, 40, 16, 24); }),
  wallB: tex((g, n) => { g.fillStyle = '#2f6a72'; g.fillRect(0, 0, n, n); g.fillStyle = '#ffe28a'; g.fillRect(12, 12, 14, 14); g.fillRect(38, 12, 14, 14); g.fillStyle = '#1f3f48'; for (let i = 0; i < n; i += 8) g.fillRect(0, i, n, 1); }),
  wallM: tex((g, n) => { g.fillStyle = '#4a2e1e'; g.fillRect(0, 0, n, n); g.fillStyle = '#ffe9b0'; g.fillRect(6, 10, 22, 26); g.fillRect(36, 10, 22, 26); g.fillStyle = '#4a2e1e'; for (let x = 6; x < 60; x += 7) g.fillRect(x, 10, 1, 26); g.fillRect(6, 22, 52, 1); g.fillStyle = '#2a4a8a'; g.fillRect(18, 42, 28, 22); g.fillStyle = '#fff'; g.fillRect(28, 48, 8, 6); }),
  roof: tex((g, n) => { g.fillStyle = '#7a2a3a'; g.fillRect(0, 0, n, n); g.fillStyle = '#5a1a2a'; for (let y = 0; y < n; y += 8) for (let x = (y / 8 % 2) * 8; x < n; x += 16) g.fillRect(x, y, 8, 7); }),
  roofT: tex((g, n) => { g.fillStyle = '#2a3448'; g.fillRect(0, 0, n, n); g.fillStyle = '#3c4a64'; for (let x = 0; x < n; x += 8) g.fillRect(x, 0, 4, n); }),
  roofP: tex((g, n) => { g.fillStyle = '#4a2a6a'; g.fillRect(0, 0, n, n); g.fillStyle = '#6a3a8a'; for (let y = 0; y < n; y += 8) for (let x = (y / 8 % 2) * 8; x < n; x += 16) g.fillRect(x, y, 8, 7); }),
  castle: tex((g, n) => { g.fillStyle = '#3a3048'; g.fillRect(0, 0, n, n); g.fillStyle = '#54486a'; for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) g.fillRect(x * 16 + (y % 2) * 8 + 1, y * 8 + 1, 14, 6); g.fillStyle = '#ffb04a'; g.fillRect(28, 20, 8, 14); }),
  pumpkin: vstripes('#e8701a', '#b8500a', 3),
  grave: colTex('#8a8aa0', 0.2),
  lantern: colTex('#ffe08a', 0.05), metal: colTex('#3a3448', 0.15),
  wood: tex((g, n) => { g.fillStyle = '#7a5230'; g.fillRect(0, 0, n, n); g.fillStyle = '#4f331a'; for (let i = 0; i < n; i += 12) g.fillRect(0, i, n, 2); }),
  barrel: tex((g, n) => { g.fillStyle = '#8a5a30'; g.fillRect(0, 0, n, n); g.fillStyle = '#3a3a40'; g.fillRect(0, 8, n, 5); g.fillRect(0, 50, n, 5); g.fillStyle = '#6a4220'; for (let i = 0; i < n; i += 10) g.fillRect(i, 0, 2, n); }),
  water: speck('#1a3a6a', ['#2a5a9a', '#4a8ad0', '#183058'], 140, 6, 1),
  sail: stripes('#f2ece4', '#d8cfc0', 10),
  awnR: vstripes('#f2ece4', '#d8304a', 8), awnB: vstripes('#f2ece4', '#2a6ad8', 8),
  chochin: tex((g, n) => { g.fillStyle = '#e8402a'; g.fillRect(0, 0, n, n); g.fillStyle = '#a82010'; for (let y = 4; y < n; y += 8) g.fillRect(0, y, n, 2); g.fillStyle = '#1a1010'; g.fillRect(0, 0, n, 5); g.fillRect(0, n - 5, n, 5); g.fillStyle = '#fff0c0'; g.font = 'bold 22px sans-serif'; g.fillText('猫', 20, 40); }),
  fChochin: tex((g, n) => { g.fillStyle = '#e8402a'; g.fillRect(0, 0, n, n); g.fillStyle = '#a82010'; for (let y = 4; y < n; y += 8) g.fillRect(0, y, n, 2); g.fillStyle = '#fff6a0'; g.fillRect(10, 18, 16, 14); g.fillRect(38, 18, 16, 14); g.fillStyle = '#111'; g.fillRect(16, 20, 5, 10); g.fillRect(44, 20, 5, 10); g.fillStyle = '#1a0a0a'; g.fillRect(16, 40, 32, 14); g.fillStyle = '#ff6a8a'; g.fillRect(26, 48, 12, 6); }),
  crate: tex((g, n) => { g.fillStyle = '#9a6a3a'; g.fillRect(0, 0, n, n); g.fillStyle = '#6a4220'; g.fillRect(0, 0, n, 4); g.fillRect(0, n - 4, n, 4); g.fillRect(0, 0, 4, n); g.fillRect(0, n - 4, 4, n); g.fillRect(0, 30, n, 4); g.fillStyle = '#ff7ab8'; g.fillRect(24, 10, 16, 12); }),
  crateF: tex((g, n) => { g.fillStyle = '#c8a070'; g.fillRect(0, 0, n, n); g.fillStyle = '#2a6ad8'; g.font = 'bold 26px sans-serif'; g.fillText('魚', 18, 42); g.fillStyle = '#8a6a40'; g.fillRect(0, 0, n, 4); g.fillRect(0, n - 4, n, 4); }),
  catOrange: stripes('#f0902a', '#c0601a', 6), catBlack: colTex('#2a2630', 0.1), catWhite: colTex('#f2ece4', 0.08), catGrey: stripes('#8a8a9a', '#6a6a7a', 5), catBrown: stripes('#8a5a3a', '#6a3a22', 5),
  fOrange: face('#f0902a', '#7ad84a', { stripe: '#c0601a', blush: 1 }), fBlack: face('#2a2630', '#ffd23a'), fWhite: face('#f2ece4', '#4aa8ff', { blush: 1 }), fGrey: face('#8a8a9a', '#ff9a3a', { stripe: '#6a6a7a' }),
  fBrown: face('#8a5a3a', '#ff5a5a', { stripe: '#6a3a22', angry: 1 }),
  fTora: face('#f0902a', '#ffe23a', { stripe: '#a0400a', angry: 1 }), fOyabun: face('#8a8a9a', '#ff3a3a', { stripe: '#5a5a6a', patch: 1, angry: 1 }),
  fBat: face('#2a2630', '#ff4a4a', { angry: 1 }), wing: colTex('#4a2a5a', 0.1),
  pinkIn: colTex('#ff9ac8', 0.05),
  ghost: colTex('#eef0ff', 0.05), fGhost: tex((g, n) => { g.fillStyle = '#eef0ff'; g.fillRect(0, 0, n, n); g.fillStyle = '#222'; g.fillRect(14, 22, 10, 14); g.fillRect(40, 22, 10, 14); g.fillStyle = '#ff7aa8'; g.fillRect(26, 42, 12, 8); g.fillStyle = '#9ad'; g.fillRect(8, 40, 8, 3); g.fillRect(48, 40, 8, 3); }),
  balloonR: colTex('#ff4a7a', 0.05), balloonY: colTex('#ffd23a', 0.05), balloonB: colTex('#4ab8ff', 0.05), balloonH: tex((g, n) => { g.fillStyle = '#ff6ab0'; g.fillRect(0, 0, n, n); g.fillStyle = '#fff'; g.fillRect(20, 22, 10, 10); g.fillRect(34, 22, 10, 10); g.fillRect(22, 30, 20, 10); g.fillRect(27, 40, 10, 6); }),
  target: tex((g, n) => { const c = ['#e8304a', '#fff', '#e8304a', '#fff', '#ffd23a']; c.forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(32, 32, 31 - i * 6.5, 0, 7); g.fill(); }); g.fillStyle = '#e8304a'; g.beginPath(); g.moveTo(8, 14); g.lineTo(14, 0); g.lineTo(22, 10); g.fill(); g.beginPath(); g.moveTo(56, 14); g.lineTo(50, 0); g.lineTo(42, 10); g.fill(); }),
  fish: tex((g, n) => { g.fillStyle = '#4a9ad8'; g.fillRect(0, 0, n, n); g.fillStyle = '#cfe8ff'; g.fillRect(0, 36, n, 28); g.fillStyle = '#2a5a88'; for (let i = 0; i < n; i += 8) g.fillRect(i, 10, 4, 4); }),
  yarn: stripes('#ff6ab0', '#c02a7a', 4, true), fire: colTex('#7ad8ff', 0.05),
  boss: vstripes('#ef7a1a', '#b8500a', 3), kingBody: vstripes('#c84a1a', '#6a1a3a', 3),
  bossFace: tex((g, n) => { g.fillStyle = '#ef7a1a'; g.fillRect(0, 0, n, n); g.fillStyle = '#ffe23a'; g.beginPath(); g.moveTo(8, 30); g.lineTo(18, 12); g.lineTo(28, 30); g.fill(); g.beginPath(); g.moveTo(36, 30); g.lineTo(46, 12); g.lineTo(56, 30); g.fill(); g.fillRect(10, 42, 44, 10); g.fillStyle = '#ef7a1a'; for (let i = 14; i < 54; i += 10) g.fillRect(i, 42, 4, 5); g.fillStyle = '#3a1a0a'; g.fillRect(0, 36, 12, 1); g.fillRect(52, 36, 12, 1); g.fillRect(0, 40, 10, 1); g.fillRect(54, 40, 10, 1); }),
  kingFace: tex((g, n) => { g.fillStyle = '#c84a1a'; g.fillRect(0, 0, n, n); g.fillStyle = '#9af0ff'; g.beginPath(); g.moveTo(6, 32); g.lineTo(18, 10); g.lineTo(28, 32); g.fill(); g.beginPath(); g.moveTo(36, 32); g.lineTo(46, 10); g.lineTo(58, 32); g.fill(); g.fillRect(8, 40, 48, 14); g.fillStyle = '#c84a1a'; for (let i = 12; i < 56; i += 8) { g.fillRect(i, 40, 4, 6); g.fillRect(i + 4, 48, 4, 6); } }),
  gold: colTex('#ffcf3a', 0.08), cape: colTex('#6a1a8a', 0.1),
  cart: tex((g, n) => { g.fillStyle = '#ff6ab0'; g.fillRect(0, 0, n, n); g.fillStyle = '#fff'; g.fillRect(0, 4, n, 4); g.fillRect(0, n - 8, n, 4); g.fillStyle = '#ffd23a'; for (let i = 6; i < n; i += 16) { g.beginPath(); g.arc(i, 32, 5, 0, 7); g.fill(); } }),
  paw: colTex('#fff0f6', 0.05), pad: colTex('#ff7ab0', 0.05), gun: stripes('#7a5aff', '#5a3ad8', 6),
};
const mc = new Map();
const mat = (k, emi = 0, rep = [1, 1]) => { const key = k + emi + rep; if (!mc.has(key)) mc.set(key, M(T[k], rep, emi)); return mc.get(key); };
const G = {
  box: new THREE.BoxGeometry(1, 1, 1), cone4: new THREE.ConeGeometry(1, 1, 4), cone6: new THREE.ConeGeometry(1, 1, 6),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6), ico: new THREE.IcosahedronGeometry(1, 0), ico1: new THREE.IcosahedronGeometry(1, 1),
  disc: new THREE.CylinderGeometry(1, 1, 0.12, 10), prism: new THREE.CylinderGeometry(1, 1, 1, 3),
};
const UP = new THREE.Vector3(0, 1, 0);
const C3 = (a) => new THREE.Color(...a);

// ---------------- STAGES (NEKO_CART_STAGES_v1)
const STAGES = [
  {
    id: 1, name: 'にゃんこ公園', en: 'NEKO PARK', blurb: '夕やけの公園と おかし通り。まずはここで練習！ ボスは公園番長トラきち。',
    pts: [[0, 0], [0, -26], [10, -50], [28, -66], [42, -92], [36, -122], [14, -140], [-8, -160], [-16, -186], [-14, -212], [-14, -232]],
    zones: [
      { kind: 'garden', name: 'にゃんこ庭園', en: 'CAT GARDEN', end: 0.55, lamp: [1.0, 0.75, 0.45] },
      { kind: 'candy', name: 'おかし通り', en: 'CANDY STREET', end: 1.01, lamp: [1.0, 0.5, 0.8] },
    ],
    fog: [0.62, 0.38, 0.42], fogD: 0.017, amb: [0.48, 0.40, 0.42], moonDir: [0.4, 0.5, 0.6], moonC: [0.75, 0.55, 0.42], moonCol: 0xffc890, ground: 'grass', arena: 'candy',
    bgm: 'main', gap: 11, atk: 3.0, speed: 5.6, bosses: [{ at: 'end', kind: 'tora' }], rank: [12000, 8500, 5000],
  },
  {
    id: 2, name: 'よるの魚市場', en: 'NIGHT FISH MARKET', blurb: 'ちょうちん揺れる横丁と魚河岸。コウモリ猫・でぶ猫が登場。途中に中ボス！',
    pts: [[0, 0], [0, -24], [-12, -46], [-30, -60], [-44, -84], [-40, -112], [-20, -128], [4, -138], [26, -156], [34, -184], [24, -210], [6, -228], [-6, -252], [-8, -280], [-4, -306], [-4, -326]],
    zones: [
      { kind: 'market', name: 'ねこ横丁', en: 'NEKO ALLEY', end: 0.5, lamp: [1.0, 0.45, 0.3] },
      { kind: 'dock', name: '魚河岸', en: 'FISH DOCK', end: 1.01, lamp: [0.5, 0.8, 1.0] },
    ],
    fog: [0.08, 0.09, 0.2], fogD: 0.026, amb: [0.24, 0.24, 0.36], moonDir: [-0.3, 0.8, 0.5], moonC: [0.4, 0.45, 0.72], moonCol: 0xe8f0ff, ground: 'stone', arena: 'dock',
    bgm: 'market', gap: 8.4, atk: 2.5, speed: 6.1, bosses: [{ at: 0.44, kind: 'chochin' }, { at: 'end', kind: 'oyabun' }], rank: [24000, 17000, 10000],
  },
  {
    id: 3, name: '月夜のかぼちゃ城', en: 'PUMPKIN CASTLE', blurb: '毛糸屋敷→月夜の屋根→かぼちゃ城。おばけだらけの最終決戦！',
    pts: [[0, 0], [0, -26], [10, -50], [28, -66], [42, -92], [36, -122], [14, -140], [-12, -150], [-34, -172], [-40, -204], [-26, -232], [-4, -246], [14, -268], [18, -296], [16, -318], [12, -346], [12, -366]],
    zones: [
      { kind: 'manor', name: 'おばけ毛糸屋敷', en: 'YARN MANOR', end: 0.34, lamp: [0.5, 0.75, 1.0] },
      { kind: 'roofs', name: '月夜の屋根', en: 'MOONLIT ROOFS', end: 0.68, lamp: [1.0, 0.6, 0.3] },
      { kind: 'castle', name: 'かぼちゃ城', en: 'PUMPKIN CASTLE', end: 1.01, lamp: [0.9, 0.4, 1.0] },
    ],
    fog: [0.22, 0.12, 0.28], fogD: 0.022, amb: [0.30, 0.25, 0.36], moonDir: [-0.3, 0.8, 0.5], moonC: [0.45, 0.42, 0.62], moonCol: 0xfff2c0, ground: 'grassN', arena: 'castle',
    bgm: 'night', gap: 7.2, atk: 2.1, speed: 6.4, bosses: [{ at: 0.5, kind: 'jack' }, { at: 'end', kind: 'king' }], rank: [34000, 24000, 14000],
  },
];
const BOSSES = {
  tora: { name: '公園番長 トラきち', hp: 30, y: 1.2, sway: 4, atk: 2.3, throws: ['fish', 'yarn'], minions: ['cat'], summon: 7, score: 3000, multi: 1 },
  chochin: { name: '化けちょうちん', hp: 26, y: 2.8, sway: 5, atk: 2.0, throws: ['fire'], minions: ['ghost', 'bat'], summon: 5, score: 3000, multi: 1, mid: true },
  oyabun: { name: '魚河岸の親分 ドラ五郎', hp: 55, y: 1.3, sway: 5, atk: 2.1, throws: ['fish', 'fish', 'yarn'], minions: ['cat', 'bat'], summon: 6, score: 6000, multi: 2 },
  jack: { name: 'ジャック・オ・ニャンタン', hp: 45, y: 2.8, dist: 12, sway: 5, atk: 2.2, throws: ['pumpkin'], minions: ['ghost'], summon: 6, score: 4000, multi: 1, mid: true },
  king: { name: 'キング・ニャンタン', hp: 90, y: 3.6, dist: 15, sway: 6, atk: 1.9, throws: ['pumpkin', 'fire'], minions: ['ghost', 'bat'], summon: 4.5, score: 12000, multi: 3 },
};

// ---------------- save data
const SAVE_KEY = 'nekoCart.stages.v1';
const save = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })();
save.unlocked = save.unlocked || 1; save.hi = save.hi || [0, 0, 0]; save.cleared = save.cleared || [0, 0, 0];
if (/[?&]unlock=all/.test(location.search)) save.unlocked = 3;
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } };

// ---------------- world (rebuilt per stage)
let stage = STAGES[0], curve, LEN = 100, ZONES = [];
const world = new THREE.Group(); S.add(world);
const lamps = [];
function frameAt(s) {
  const u = clamp(s / LEN, 0, 1);
  const p = curve.getPointAt(u), t = curve.getTangentAt(u).normalize();
  const side = new THREE.Vector3().crossVectors(t, UP).normalize();
  return { p, t, side };
}
const zoneAt = (s) => { const i = ZONES.findIndex((z) => s / LEN < z.end); return i < 0 ? ZONES.length - 1 : i; };

const batches = new Map();
function addProp(geo, k, pos, rot = [0, 0, 0], scl = [1, 1, 1], emi = 0) {
  const key = k + '|' + emi; if (!batches.has(key)) batches.set(key, { k, emi, list: [] });
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scl));
  batches.get(key).list.push(geo.clone().applyMatrix4(m));
}
function flush() {
  for (const { k, emi, list } of batches.values()) {
    const P = [], N = [], UV = [];
    for (let g of list) { if (g.index) g = g.toNonIndexed(); P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); UV.push(...g.attributes.uv.array); g.dispose(); }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    world.add(new THREE.Mesh(bg, mat(k, emi)));
  }
  batches.clear();
}
function scenery(kind, q, t, ry, sd, off) {
  const yaw = Math.atan2(t.x, t.z), r = rnd();
  if (kind === 'garden') {
    if (r < 0.45) { const h = 2 + rnd() * 2; addProp(G.cyl6, 'trunk', [q.x, h / 2, q.z], [0, ry, 0], [0.22, h, 0.22]); addProp(G.ico, 'leaf', [q.x, h + 0.6, q.z], [0, ry, 0], [1.4, 1.3, 1.4]); }
    else if (r < 0.75) addProp(G.box, 'fence', [q.x, 0.45, q.z], [0, yaw, 0], [0.15, 0.9, 3]);
    else addProp(G.ico, 'pinkIn', [q.x, 0.25, q.z], [0, ry, 0], [0.3, 0.3, 0.3]);
  } else if (kind === 'candy') {
    if (r < 0.35) { const h = 2.5 + rnd() * 2; addProp(G.cyl6, rnd() < 0.5 ? 'candy' : 'mint', [q.x, h / 2, q.z], [0, 0, 0], [0.18, h, 0.18], 0x110508); addProp(G.cyl6, 'candy', [q.x + 0.4, h, q.z], [0, 0, Math.PI / 2], [0.18, 0.9, 0.18]); }
    else if (r < 0.6) { addProp(G.cyl6, 'fence', [q.x, 1, q.z], [0, 0, 0], [0.06, 2, 0.06]); addProp(G.disc, 'lolli', [q.x, 2.3, q.z], [Math.PI / 2, ry, 0], [0.9, 1, 0.9], 0x221018); }
    else { addProp(G.box, 'ginger', [q.x, 1.2, q.z], [0, ry, 0], [3, 2.4, 3]); addProp(G.prism, 'candy', [q.x, 3, q.z], [0, ry, Math.PI / 2], [1.2, 3.2, 1.9]); }
  } else if (kind === 'market') {
    if (r < 0.4) {
      addProp(G.box, 'wood', [q.x, 0.45, q.z], [0, yaw, 0], [2.2, 0.9, 1.4]);
      for (const e of [-1, 1]) addProp(G.cyl6, 'wood', [q.x + Math.cos(yaw) * e, 1.2, q.z - Math.sin(yaw) * e], [0, 0, 0], [0.06, 2.4, 0.06]);
      addProp(G.cone4, rnd() < 0.5 ? 'awnR' : 'awnB', [q.x, 2.7, q.z], [0, yaw + Math.PI / 4, 0], [1.9, 0.8, 1.9], 0x100808);
      addProp(G.box, 'fish', [q.x, 0.98, q.z], [0, yaw + 0.3, 0], [0.8, 0.12, 0.3], 0x102030);
    } else if (r < 0.75) {
      const h = 3 + rnd() * 2; addProp(G.box, 'wallM', [q.x, h / 2, q.z], [0, yaw, 0], [3.4, h, 3.4], 0x0a0604);
      addProp(G.cone4, 'roofT', [q.x, h + 0.9, q.z], [0, yaw + Math.PI / 4, 0], [2.9, 1.8, 2.9]);
    } else {
      addProp(G.cyl6, 'metal', [q.x, 1.6, q.z], [0, 0, 0], [0.06, 3.2, 0.06]);
      for (let i = 0; i < 3; i++) addProp(G.cyl6, 'chochin', [q.x + 0.3, 2.9 - i * 0.7, q.z], [0, ry, 0], [0.22, 0.45, 0.22], 0x803020);
    }
  } else if (kind === 'dock') {
    if (off > 9) { addProp(G.box, 'water', [q.x, 0.02, q.z], [0, yaw, 0], [9, 0.04, 4.6], 0x081830); return; }
    if (r < 0.3) { addProp(G.box, 'wood', [q.x, 0.35, q.z], [0, yaw, 0], [1.4, 0.7, 3.6]); addProp(G.cyl6, 'wood', [q.x, 2, q.z], [0, 0, 0], [0.06, 3, 0.06]); addProp(G.box, 'sail', [q.x, 2.2, q.z + 0.05], [0, yaw + Math.PI / 2, 0], [0.04, 1.8, 1.6], 0x0a0a0a); }
    else if (r < 0.6) for (let i = 0; i < 3; i++) addProp(G.cyl6, 'barrel', [q.x + (i - 1) * 0.8, 0.45, q.z + (i % 2) * 0.5], [0, ry, 0], [0.35, 0.9, 0.35]);
    else if (r < 0.85) { addProp(G.box, 'crateF', [q.x, 0.4, q.z], [0, ry, 0], [1.0, 0.8, 1.0]); addProp(G.box, 'crateF', [q.x + 0.2, 1.2, q.z], [0, ry + 0.4, 0], [0.9, 0.8, 0.9]); }
    else { addProp(G.cyl6, 'metal', [q.x, 1.4, q.z], [0, 0, 0], [0.06, 2.8, 0.06]); addProp(G.cyl6, 'chochin', [q.x, 2.8, q.z], [0, ry, 0], [0.25, 0.5, 0.25], 0x803020); }
  } else if (kind === 'manor') {
    if (r < 0.45) { const h = 3 + rnd() * 3; addProp(G.box, rnd() < 0.5 ? 'wallA' : 'wallB', [q.x, h / 2, q.z], [0, ry, 0], [3.5, h, 3.5], 0x060406); addProp(G.cone4, 'roof', [q.x, h + 1, q.z], [0, ry + Math.PI / 4, 0], [2.9, 2, 2.9]); }
    else if (r < 0.75) addProp(G.box, 'grave', [q.x, 0.5, q.z], [0, ry * 0.2, 0], [0.7, 1, 0.2]);
    else addProp(G.ico1, 'pumpkin', [q.x, 0.4, q.z], [0, ry, 0], [0.6, 0.45, 0.6], 0x200800);
  } else if (kind === 'roofs') {
    const h = 2 + rnd() * 5;
    addProp(G.box, rnd() < 0.5 ? 'wallA' : 'wallB', [q.x, h / 2, q.z], [0, ry, 0], [4, h, 4], 0x060406);
    addProp(G.cone4, 'roof', [q.x, h + 1.2, q.z], [0, ry + Math.PI / 4, 0], [3.2, 2.4, 3.2]);
    if (rnd() < 0.4) addProp(G.box, 'metal', [q.x + 1, h + 1.6, q.z], [0, ry, 0], [0.5, 1.4, 0.5]);
  } else {
    if (r < 0.45) { const h = 6 + rnd() * 4; addProp(G.cyl6, 'castle', [q.x, h / 2, q.z], [0, ry, 0], [1.4, h, 1.4], 0x080610); addProp(G.cone6, 'roofP', [q.x, h + 1.4, q.z], [0, ry, 0], [1.8, 2.8, 1.8]); }
    else if (r < 0.8) addProp(G.box, 'castle', [q.x, 1.6, q.z], [0, yaw, 0], [0.8, 3.2, 4.2], 0x080610);
    else addProp(G.ico1, 'pumpkin', [q.x, 0.6, q.z], [0, ry, 0], [0.9, 0.7, 0.9], 0x502000);
  }
}
function disposeWorld() {
  world.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
  world.clear(); lamps.length = 0;
}
function buildWorld(st0) {
  disposeWorld();
  stage = st0; seed = 7 + stage.id * 1013;
  curve = new THREE.CatmullRomCurve3(stage.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.4);
  LEN = curve.getLength();
  ZONES = stage.zones.map((z) => ({ ...z, lamp: C3(z.lamp) }));
  // atmosphere
  const fog = C3(stage.fog); S.background = fog;
  U.uFogC.value.set(fog.r, fog.g, fog.b); U.uFogD.value = stage.fogD;
  U.uAmb.value.set(...stage.amb); U.uMoonDir.value.set(...stage.moonDir).normalize(); U.uMoonC.value.set(...stage.moonC);
  moon.material.color.setHex(stage.moonCol);
  // ground sized to track bounds
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of stage.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const gw = x1 - x0 + 140, gd = z1 - z0 + 160;
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd, Math.ceil(gw / 5), Math.ceil(gd / 5)), mat(stage.ground, 0, [Math.round(gw / 5), Math.round(gd / 5)]));
  gr.rotation.x = -Math.PI / 2; gr.position.set((x0 + x1) / 2, -0.02, (z0 + z1) / 2 - 20); world.add(gr);
  // track
  const step = 0.9;
  for (let s = 0; s <= LEN; s += step) {
    const { p, t, side } = frameAt(s); const yaw = Math.atan2(t.x, t.z);
    addProp(G.box, 'dirt', [p.x, 0.0, p.z], [0, yaw, 0], [3.2, 0.06, step + 0.05]);
    if (Math.round(s / step) % 2 === 0) addProp(G.box, 'sleeper', [p.x, 0.08, p.z], [0, yaw, 0], [2.2, 0.1, 0.35]);
    for (const o of [-0.62, 0.62]) addProp(G.box, 'rail', [p.x + side.x * o, 0.17, p.z + side.z * o], [0, yaw, 0], [0.1, 0.12, step + 0.06]);
  }
  for (let s = 6; s < LEN + 30; s += 4.2) {
    const { p, t, side } = frameAt(Math.min(s, LEN)); const kind = ZONES[zoneAt(Math.min(s, LEN - 1))].kind;
    const ext = s > LEN ? t.clone().multiplyScalar(s - LEN) : new THREE.Vector3();
    for (const sd of [-1, 1]) {
      if (kind === 'dock') { const qw = p.clone().add(ext).addScaledVector(side, 15 * sd); scenery(kind, qw, t, 0, sd, 15); }
      if (rnd() < 0.25) continue;
      const off = kind === 'dock' ? 5 + rnd() * 4 : 5 + rnd() * 12; const q = p.clone().add(ext).addScaledVector(side, off * sd);
      scenery(kind, q, t, rnd() * 6, sd, Math.min(off, 9));
    }
  }
  let k = 0;
  for (let s = 10; s < LEN; s += 16) {
    const { p, side } = frameAt(s); const sd = (k++ % 2) ? 1 : -1; const q = p.clone().addScaledVector(side, 2.6 * sd);
    addProp(G.cyl6, 'metal', [q.x, 1.3, q.z], [0, 0, 0], [0.07, 2.6, 0.07]);
    addProp(G.box, 'lantern', [q.x, 2.75, q.z], [0, 0, 0], [0.4, 0.4, 0.4], 0xffd070);
    for (const e of [-0.13, 0.13]) addProp(G.cone4, 'lantern', [q.x + e, 3.05, q.z], [0, 0, 0], [0.09, 0.2, 0.09], 0xffd070);
    lamps.push({ pos: new THREE.Vector3(q.x, 2.7, q.z), col: ZONES[zoneAt(s)].lamp.clone().multiplyScalar(2.6) });
  }
  // boss arena ring
  const end = frameAt(LEN);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * Math.PI;
    const q = end.p.clone().addScaledVector(end.t, 12).add(new THREE.Vector3(Math.sin(a) * 15, 0, -Math.cos(a) * 15).applyAxisAngle(UP, Math.atan2(-end.t.x, -end.t.z)));
    if (stage.arena === 'candy') { addProp(G.cyl6, i % 2 ? 'candy' : 'mint', [q.x, 2, q.z], [0, 0, 0], [0.35, 4, 0.35], 0x110508); addProp(G.ico1, i % 2 ? 'balloonY' : 'balloonR', [q.x, 4.4, q.z], [0, a, 0], [0.8, 0.9, 0.8], 0x201010); }
    else if (stage.arena === 'dock') { addProp(G.cyl6, 'barrel', [q.x, 0.6, q.z], [0, a, 0], [0.6, 1.2, 0.6]); addProp(G.cyl6, 'chochin', [q.x, 3.2, q.z], [0, a, 0], [0.4, 0.8, 0.4], 0x803020); addProp(G.cyl6, 'metal', [q.x, 1.8, q.z], [0, 0, 0], [0.06, 2.6, 0.06]); }
    else { addProp(G.ico1, 'pumpkin', [q.x, 0.8, q.z], [0, a, 0], [1.2, 0.9, 1.2], 0x401000); if (i % 2 === 0) { addProp(G.cyl6, 'castle', [q.x * 1, 5, q.z], [0, 0, 0], [1.2, 10, 1.2], 0x080610); addProp(G.cone6, 'roofP', [q.x, 11.4, q.z], [0, 0, 0], [1.6, 2.8, 1.6]); } }
  }
  flush();
  if (lambertDone) world.traverse((m) => meshToLambert(m));
}
// moon (unfogged basic material)
const moon = new THREE.Mesh(new THREE.CircleGeometry(6, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }));
S.add(moon);

// ---------------- cart + paw blaster (camera children)
const rig = new THREE.Group(); cam.add(rig);
function camPart(geo, k, pos, scl, rot = [0, 0, 0], emi = 0, parent = rig) { const m = new THREE.Mesh(geo, mat(k, emi)); m.position.set(...pos); m.scale.set(...scl); m.rotation.set(...rot); parent.add(m); return m; }
camPart(G.box, 'cart', [0, -0.78, -1.15], [1.9, 0.32, 0.2], [0.15, 0, 0], 0x200814);
camPart(G.box, 'cart', [-0.98, -0.72, -0.7], [0.12, 0.3, 1.0], [0, 0, 0], 0x200814);
camPart(G.box, 'cart', [0.98, -0.72, -0.7], [0.12, 0.3, 1.0], [0, 0, 0], 0x200814);
camPart(G.cone4, 'cart', [-0.7, -0.5, -1.15], [0.16, 0.25, 0.08], [0, Math.PI / 4, 0], 0x200814);
camPart(G.cone4, 'cart', [0.7, -0.5, -1.15], [0.16, 0.25, 0.08], [0, Math.PI / 4, 0], 0x200814);
const blaster = new THREE.Group(); blaster.position.set(0.42, -0.42, -0.75); rig.add(blaster);
camPart(G.box, 'gun', [0, 0, -0.1], [0.12, 0.12, 0.4], [0, 0, 0], 0x100820, blaster);
camPart(G.ico, 'paw', [0, 0, -0.34], [0.11, 0.11, 0.08], [0, 0, 0], 0x302028, blaster);
for (const [x, y] of [[-0.05, 0.05], [0.05, 0.05], [0, 0.07]]) camPart(G.ico, 'pad', [x, y - 0.02, -0.4], [0.025, 0.025, 0.02], [0, 0, 0], 0x401020, blaster);
camPart(G.box, 'gun', [0, -0.1, 0.02], [0.08, 0.18, 0.08], [0.3, 0, 0], 0x100820, blaster);

// ---------------- pipeline
const pipeline = createPipeline(R);
let lambertDone = false;
const adopt = (g) => { if (lambertDone) g.traverse((m) => meshToLambert(m)); return g; };

// ---------------- state
const st = { mode: 'title', s: 0, speed: 0, t: 0, hearts: 5, score: 0, combo: 0, maxCombo: 0, shots: 0, hits: 0, heads: 0, kills: 0, ammo: 6, reload: 0, inv: 0, zone: -1, boss: null, shake: 0, rattle: 0, end: 0, stops: [] };
const MAX_AMMO = 6;
const enemies = [], shots = [], parts = [], events = [];
const aim = { x: 0, y: 0, dx: 0, dy: 0 }; // dx,dy: drag/mouse aim; final = drag + gyro
const ray = new THREE.Raycaster();

// ---------------- enemy builders
function part(g, geo, k, pos, scl, zone = 'body', emi = 0, rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, Array.isArray(k) ? k : mat(k, emi)); m.position.set(...pos); m.scale.set(...scl); m.rotation.set(...rot); m.userData.zone = zone; g.add(m); return m;
}
const CATS = [['catOrange', 'fOrange'], ['catBlack', 'fBlack'], ['catWhite', 'fWhite'], ['catGrey', 'fGrey']];
function headMats(body, fk, emi = 0x100808) { const b = mat(body, emi), f = mat(fk, emi); return [b, b, b, b, f, b]; }
function makeCat(fat) {
  const [b, f] = fat ? ['catBrown', 'fBrown'] : pick(CATS); const g = new THREE.Group();
  part(g, G.box, b, [0, 0.42, 0], fat ? [1.05, 0.8, 0.8] : [0.75, 0.7, 0.55], 'body', 0x100808);
  part(g, G.box, headMats(b, f), [0, 1.08, 0.05], [0.72, 0.6, 0.55], 'head');
  part(g, G.cone4, b, [-0.22, 1.5, 0.05], [0.14, 0.3, 0.12], 'head', 0x100808, [0, Math.PI / 4, 0]);
  part(g, G.cone4, b, [0.22, 1.5, 0.05], [0.14, 0.3, 0.12], 'head', 0x100808, [0, Math.PI / 4, 0]);
  part(g, G.box, b, [0.35, 0.65, -0.3], [0.1, 0.7, 0.1], 'body', 0x100808, [0.4, 0, -0.3]);
  part(g, G.box, b, [-0.45, 0.85, 0.15], [0.16, 0.45, 0.16], 'body', 0x100808, [0, 0, 0.5]);
  if (fat) part(g, G.box, 'fish', [-0.55, 1.15, 0.2], [0.14, 0.5, 0.2], 'body', 0x102030, [0, 0, 0.5]);
  return g;
}
function makeGhost() {
  const g = new THREE.Group();
  part(g, G.cyl6, 'ghost', [0, 0.1, 0], [0.5, 0.9, 0.5], 'body', 0x202838);
  part(g, G.box, ['ghost', 'ghost', 'ghost', 'ghost', 'fGhost', 'ghost'].map((k) => mat(k, 0x202838)), [0, 0.8, 0.02], [0.75, 0.65, 0.6], 'head');
  part(g, G.cone4, 'ghost', [-0.24, 1.25, 0], [0.14, 0.28, 0.12], 'head', 0x202838, [0, Math.PI / 4, 0]);
  part(g, G.cone4, 'ghost', [0.24, 1.25, 0], [0.14, 0.28, 0.12], 'head', 0x202838, [0, Math.PI / 4, 0]);
  for (const x of [-0.3, 0, 0.3]) part(g, G.cone4, 'ghost', [x, -0.45, 0], [0.16, 0.3, 0.16], 'body', 0x202838, [Math.PI, 0, 0]);
  return g;
}
function makeBat() {
  const g = new THREE.Group();
  part(g, G.box, headMats('catBlack', 'fBat', 0x180818), [0, 0, 0], [0.62, 0.52, 0.5], 'head');
  part(g, G.cone4, 'catBlack', [-0.2, 0.36, 0], [0.12, 0.26, 0.1], 'head', 0x180818, [0, Math.PI / 4, 0]);
  part(g, G.cone4, 'catBlack', [0.2, 0.36, 0], [0.12, 0.26, 0.1], 'head', 0x180818, [0, Math.PI / 4, 0]);
  const wl = part(g, G.prism, 'wing', [-0.62, 0.05, 0], [0.42, 0.04, 0.3], 'body', 0x200a28, [0, 0, Math.PI / 2]);
  const wr = part(g, G.prism, 'wing', [0.62, 0.05, 0], [0.42, 0.04, 0.3], 'body', 0x200a28, [0, 0, -Math.PI / 2]);
  g.userData.wings = [wl, wr];
  return g;
}
function makeBalloon(heart) {
  const g = new THREE.Group();
  part(g, G.ico1, heart ? 'balloonH' : pick(['balloonR', 'balloonY', 'balloonB']), [0, 0, 0], [0.45, 0.55, 0.45], 'body', 0x201010);
  part(g, G.cone4, heart ? 'balloonH' : 'balloonR', [-0.2, 0.5, 0], [0.1, 0.2, 0.1], 'body', 0x201010);
  part(g, G.cone4, heart ? 'balloonH' : 'balloonR', [0.2, 0.5, 0], [0.1, 0.2, 0.1], 'body', 0x201010);
  part(g, G.box, 'fence', [0, -0.9, 0], [0.02, 1.2, 0.02]);
  return g;
}
function makeTarget() {
  const g = new THREE.Group();
  part(g, G.cyl6, 'metal', [0, 0.7, 0], [0.05, 1.4, 0.05]);
  const d = part(g, G.disc, ['metal', 'target', 'metal'].map((k) => mat(k, 0x181010)), [0, 1.6, 0], [0.6, 1, 0.6], 'head', 0, [Math.PI / 2, 0, 0]);
  d.userData.zone = 'body';
  return g;
}
function makeBigCat(body, fk, hat) {
  const g = new THREE.Group();
  part(g, G.box, body, [0, -0.6, 0], [2.4, 2.0, 1.8], 'body', 0x201008);
  part(g, G.box, headMats(body, fk, 0x302010), [0, 1.3, 0.2], [2.2, 1.8, 1.6], 'head');
  part(g, G.cone4, body, [-0.75, 2.6, 0.2], [0.45, 0.9, 0.4], 'body', 0x201008, [0, Math.PI / 4, 0]);
  part(g, G.cone4, body, [0.75, 2.6, 0.2], [0.45, 0.9, 0.4], 'body', 0x201008, [0, Math.PI / 4, 0]);
  part(g, G.box, body, [-1.5, 0.2, 0.4], [0.5, 1.4, 0.5], 'body', 0x201008, [0, 0, 0.6]);
  part(g, G.box, body, [1.5, 0.2, 0.4], [0.5, 1.4, 0.5], 'body', 0x201008, [0, 0, -0.6]);
  if (hat === 'fish') part(g, G.box, 'fish', [1.9, 1.1, 0.5], [0.4, 1.8, 0.6], 'body', 0x102030, [0, 0, -0.4]);
  if (hat === 'band') part(g, G.box, 'awnR', [0, 2.1, 0.2], [2.3, 0.3, 1.7], 'body', 0x200808);
  return g;
}
function makeChochin() {
  const g = new THREE.Group();
  part(g, G.cyl6, 'chochin', [0, 0, 0], [1.5, 2.6, 1.5], 'body', 0x902818);
  part(g, G.box, 'fChochin', [0, 0.1, 1.32], [1.7, 1.5, 0.2], 'head', 0xa03020);
  part(g, G.disc, 'catBlack', [0, 1.35, 0], [1.2, 1, 1.2], 'body', 0x100010);
  part(g, G.disc, 'catBlack', [0, -1.35, 0], [1.2, 1, 1.2], 'body', 0x100010);
  part(g, G.cone4, 'chochin', [-0.8, 1.9, 0], [0.35, 0.8, 0.3], 'body', 0x902818, [0, Math.PI / 4, 0]);
  part(g, G.cone4, 'chochin', [0.8, 1.9, 0], [0.35, 0.8, 0.3], 'body', 0x902818, [0, Math.PI / 4, 0]);
  part(g, G.box, 'fish', [0, -1.9, 0.4], [0.3, 0.9, 0.6], 'body', 0xa02020); // tongue
  return g;
}
function makePumpkinBoss(king) {
  const g = new THREE.Group(); const b = king ? 'kingBody' : 'boss';
  part(g, G.ico1, b, [0, 0, 0], [2.4, 2.0, 2.4], 'body', king ? 0x401020 : 0x301000);
  part(g, G.box, king ? 'kingFace' : 'bossFace', [0, 0.1, 2.1], [2.4, 1.6, 0.3], 'head', king ? 0x804060 : 0x806020);
  part(g, G.cone4, b, [-1.3, 2.1, 0], [0.6, 1.2, 0.5], 'body', 0x301000, [0, Math.PI / 4, 0]);
  part(g, G.cone4, b, [1.3, 2.1, 0], [0.6, 1.2, 0.5], 'body', 0x301000, [0, Math.PI / 4, 0]);
  if (king) {
    part(g, G.cyl6, 'gold', [0, 2.3, 0], [1.3, 0.5, 1.3], 'body', 0x604000);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; part(g, G.cone4, 'gold', [Math.sin(a) * 1.1, 2.9, Math.cos(a) * 1.1], [0.25, 0.8, 0.25], 'body', 0x604000); }
    part(g, G.ico, 'fire', [0, 2.9, 1.25], [0.25, 0.25, 0.25], 'body', 0x40a0c0);
    part(g, G.box, 'cape', [0, -0.4, -1.8], [4.2, 3.4, 0.2], 'body', 0x200830);
  } else {
    part(g, G.cyl6, 'leaf', [0, 2.2, 0], [0.2, 0.7, 0.2], 'body');
    part(g, G.disc, 'catBlack', [0, 2.6, 0], [1.6, 1, 1.6], 'body', 0x100010);
    part(g, G.cone6, 'catBlack', [0, 3.6, 0], [0.9, 2, 0.9], 'body', 0x100010, [0.2, 0, 0]);
  }
  if (king) g.scale.setScalar(1.3);
  return g;
}
const BOSS_BUILD = {
  tora: () => makeBigCat('catOrange', 'fTora', 'band'),
  chochin: makeChochin,
  oyabun: () => makeBigCat('catGrey', 'fOyabun', 'fish'),
  jack: () => makePumpkinBoss(false),
  king: () => makePumpkinBoss(true),
};

// ---------------- spawn script (deterministic per stage)
function genAt(kind, s, out) {
  const r = rnd(), sd = () => (rnd() < 0.5 ? -1 : 1);
  const E = (o) => out.push({ s, ...o });
  if (kind === 'garden') {
    if (r < 0.55) E({ type: 'cat', side: sd() }); else if (r < 0.8) E({ type: 'target', side: sd() }); else E({ type: 'balloon', side: sd(), heart: rnd() < 0.3 });
  } else if (kind === 'candy') {
    if (r < 0.35) { E({ type: 'cat', side: -1 }); out.push({ s: s + 1.5, type: 'cat', side: 1 }); }
    else if (r < 0.6) E({ type: 'cat', side: sd(), roof: true });
    else if (r < 0.85) for (let i = 0; i < 3; i++) out.push({ s: s + i * 0.8, type: 'balloon', side: i - 1, heart: i === 1 && rnd() < 0.35 });
    else E({ type: 'ghost', side: sd() });
  } else if (kind === 'market') {
    if (r < 0.3) { E({ type: 'cat', side: -1 }); out.push({ s: s + 1.2, type: 'cat', side: 1, roof: rnd() < 0.5 }); }
    else if (r < 0.5) E({ type: 'bat', side: sd() });
    else if (r < 0.7) E({ type: 'cat', side: sd(), fat: true });
    else if (r < 0.88) E({ type: 'cat', side: sd(), roof: true });
    else E({ type: 'balloon', side: 0, heart: true });
  } else if (kind === 'dock') {
    if (r < 0.3) { E({ type: 'bat', side: -1 }); out.push({ s: s + 1, type: 'bat', side: 1 }); }
    else if (r < 0.5) { E({ type: 'cat', side: sd(), fat: true }); }
    else if (r < 0.75) for (let i = 0; i < 3; i++) out.push({ s: s + i, type: 'cat', side: i - 1, roof: i !== 1 });
    else if (r < 0.9) E({ type: 'target', side: sd() });
    else for (let i = 0; i < 3; i++) out.push({ s: s + i * 0.8, type: 'balloon', side: i - 1, heart: i === 1 });
  } else if (kind === 'manor') {
    if (r < 0.4) E({ type: 'ghost', side: sd() });
    else if (r < 0.7) { E({ type: 'cat', side: -1, roof: rnd() < 0.5 }); E({ type: 'ghost', side: 1 }); }
    else if (r < 0.85) E({ type: 'bat', side: sd() });
    else E({ type: 'balloon', side: 0, heart: true });
  } else if (kind === 'roofs') {
    if (r < 0.4) for (let i = 0; i < 3; i++) out.push({ s: s + i, type: 'cat', side: i - 1, roof: i !== 1 });
    else if (r < 0.65) { E({ type: 'ghost', side: -1 }); out.push({ s: s + 1, type: 'ghost', side: 1 }); }
    else if (r < 0.85) { E({ type: 'bat', side: -1 }); out.push({ s: s + 0.8, type: 'bat', side: 1 }); }
    else E({ type: 'cat', side: sd(), fat: true, roof: true });
  } else {
    if (r < 0.25) { E({ type: 'cat', side: -1, fat: true }); E({ type: 'ghost', side: 1 }); }
    else if (r < 0.5) for (let i = 0; i < 3; i++) out.push({ s: s + i * 0.7, type: 'bat', side: i - 1 });
    else if (r < 0.75) for (let i = 0; i < 3; i++) out.push({ s: s + i, type: 'cat', side: i - 1, roof: i !== 1 });
    else if (r < 0.88) { E({ type: 'ghost', side: -1 }); out.push({ s: s + 1, type: 'ghost', side: 1 }); }
    else E({ type: 'balloon', side: 0, heart: true });
  }
}
function buildEvents() {
  events.length = 0; seed = 4242 + stage.id * 77;
  const stopS = st.stops.map((x) => x.s);
  let s = 16; const endS = st.stops[st.stops.length - 1].s;
  while (s < endS - 14) {
    if (!stopS.some((x) => s > x - 18 && s < x + 3)) genAt(ZONES[zoneAt(s)].kind, s, events);
    s += stage.gap * (0.85 + rnd() * 0.3);
  }
  events.sort((a, b) => a.s - b.s);
  for (const e of events) if (e.type === 'cat' && !e.roof && e.side !== 0) {
    const { p, side } = frameAt(e.s + 12); const q = p.clone().addScaledVector(side, e.side * 3.6);
    addProp(G.box, 'crate', [q.x, 0.4, q.z], [0, rnd(), 0], [1.1, 0.8, 0.9], 0x100808);
  }
  flush();
  if (lambertDone) world.traverse((m) => meshToLambert(m));
}
let nextEv = 0;

function newEnemy(type, g, pos, extra = {}) {
  g.position.copy(pos); S.add(adopt(g));
  const en = { type, g, hp: 1, base: pos.clone(), age: 0, atkMax: 0, atk: 0, dead: 0, heart: false, ring: null, spin: rnd() * 6, flash: 0, size: 1, ...extra };
  g.traverse((m) => { if (m.isMesh) m.userData.en = en; });
  g.scale.setScalar(0.01); enemies.push(en); return en;
}
function spawn(e) {
  const ahead = 12 + (e.type === 'ghost' ? 6 : e.type === 'bat' ? 9 : 0);
  const { p, side } = frameAt(Math.min(e.s + ahead, LEN));
  const pos = p.clone().addScaledVector(side, e.side * (e.type === 'balloon' ? 2.2 : 3.6));
  const atk = stage.atk;
  if (e.type === 'cat') {
    pos.y = e.roof ? 2.2 + rnd() * 1.2 : 0.2; if (e.roof) pos.addScaledVector(side, e.side * 1.8);
    const en = newEnemy('cat', makeCat(e.fat), pos, { hp: e.fat ? 4 : 2, fat: !!e.fat, size: e.fat ? 1.25 : 1, atkMax: e.fat ? atk * 0.85 : atk, roof: e.roof });
    en.atk = en.atkMax + 0.5; if (rnd() < 0.5) sfx.nya(e.fat ? 0.7 : 0.9 + rnd() * 0.4);
  } else if (e.type === 'ghost') { pos.y = 1.6; newEnemy('ghost', makeGhost(), pos); }
  else if (e.type === 'bat') { pos.y = 2.4 + rnd(); newEnemy('bat', makeBat(), pos); sfx.bat(); }
  else if (e.type === 'balloon') { pos.y = 0.6; newEnemy('balloon', makeBalloon(e.heart), pos, { heart: !!e.heart }); }
  else { pos.y = 0; newEnemy('target', makeTarget(), pos); }
}
function spawnBoss(stop) {
  const cfg = BOSSES[stop.kind];
  const { p, t } = frameAt(stop.s);
  const g = BOSS_BUILD[stop.kind](); const base = p.clone().addScaledVector(t, cfg.dist || 11); base.y = cfg.y;
  const en = newEnemy('boss', g, base, { hp: cfg.hp, hpMax: cfg.hp, atkMax: cfg.atk, atk: cfg.atk + 0.6, summon: cfg.summon * 0.6, cfg, stop, side: new THREE.Vector3().crossVectors(t, UP).normalize(), phase: 1 });
  g.scale.setScalar(1); st.boss = en;
  $('bossName').textContent = cfg.name; $('bossBar').style.display = 'block';
  sfx.roar(); playBgm(stop.final && stage.id === 3 ? 'final' : 'boss'); banner(stop.final ? 'BOSS' : 'MID BOSS', cfg.name); st.shake = 0.4;
}
function throwShot(from, kind, durMul = 1) {
  const g = new THREE.Group();
  if (kind === 'fish') { part(g, G.box, 'fish', [0, 0, 0], [0.12, 0.22, 0.45], 'body', 0x102030); part(g, G.cone4, 'fish', [0, 0, 0.3], [0.15, 0.2, 0.05], 'body', 0x102030, [Math.PI / 2, 0, 0]); }
  else if (kind === 'yarn') part(g, G.ico, 'yarn', [0, 0, 0], [0.25, 0.25, 0.25], 'body', 0x301020);
  else if (kind === 'fire') { part(g, G.ico, 'fire', [0, 0, 0], [0.3, 0.3, 0.3], 'body', 0x3090c0); part(g, G.ico, 'ghost', [0, 0, 0], [0.16, 0.16, 0.16], 'body', 0x8090a0); }
  else part(g, G.ico1, 'pumpkin', [0, 0, 0], [0.45, 0.4, 0.45], 'body', 0x502000);
  g.position.copy(from); S.add(adopt(g));
  const dur = (kind === 'pumpkin' ? 1.5 : kind === 'fire' ? 1.35 : 1.2) * durMul;
  const sh = { type: 'shot', g, from: from.clone(), t: 0, dur, hp: kind === 'pumpkin' ? 2 : 1, kind, dead: 0, ring: null };
  g.traverse((m) => { if (m.isMesh) m.userData.en = sh; });
  shots.push(sh); kind === 'fire' ? sfx.fire() : sfx.throw();
}

// ---------------- particles
const pMats = ['#ffffff', '#ffd23a', '#ff6ab0', '#ff7a1a', '#9ad8ff'].map((c) => M(colTex(c, 0), [1, 1], new THREE.Color(c).multiplyScalar(0.8).getHex()));
function burst(pos, n = 10, col = 1, spd = 4) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(G.box, pMats[(col + (i % 2)) % pMats.length]); m.position.copy(pos); const s = 0.06 + Math.random() * 0.08; m.scale.setScalar(s); S.add(adopt(m));
    parts.push({ m, v: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar(spd * (0.4 + Math.random())), life: 0.5 + Math.random() * 0.3 });
  }
}

// ---------------- UI helpers
const tmpV = new THREE.Vector3();
function toScreen(v) { tmpV.copy(v).project(cam); return { x: (tmpV.x + 1) / 2 * innerWidth, y: (1 - tmpV.y) / 2 * innerHeight, ok: tmpV.z < 1 && tmpV.z > -1 }; }
function popText(v, text, cls = '') { const sp = toScreen(v); if (!sp.ok) return; const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text; d.style.left = sp.x + 'px'; d.style.top = sp.y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 820); }
function toast(msg, ms = 2200) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; $('toastStack').appendChild(d); requestAnimationFrame(() => d.classList.add('show')); setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 300); }, ms); }
let bannerT = 0;
function banner(sub, main, dur = 2.2) { $('banner').innerHTML = `<small>${sub}</small>${main}`; $('banner').classList.add('show'); bannerT = dur; }
const ringPool = [];
function ringFor(o) { if (!o.ring) { o.ring = ringPool.pop() || (() => { const d = document.createElement('div'); d.className = 'ring'; $('rings').appendChild(d); return d; })(); } return o.ring; }
function freeRing(o) { if (o.ring) { o.ring.style.display = 'none'; ringPool.push(o.ring); o.ring = null; } }
function hud() {
  $('hearts').textContent = '♥'.repeat(Math.max(0, st.hearts)) + '♡'.repeat(Math.max(0, 5 - st.hearts));
  $('score').textContent = st.score.toLocaleString();
  $('combo').textContent = st.combo >= 3 ? `${st.combo} COMBO ×${mult().toFixed(1)}` : '';
  $('ammo').textContent = st.reload > 0 ? '⟳⟳⟳' : '●'.repeat(st.ammo) + '○'.repeat(MAX_AMMO - st.ammo);
  $('reloadHint').style.display = st.ammo === 0 && st.reload <= 0 ? 'block' : 'none';
  $('progFill').style.width = (st.s / LEN * 100).toFixed(1) + '%';
  if (st.boss) $('bossFill').style.width = Math.max(0, st.boss.hp / st.boss.hpMax * 100) + '%';
}
const mult = () => Math.min(3, 1 + Math.floor(st.combo / 5) * 0.5);

// ---------------- combat
function addScore(n, at, cls) { const v = Math.round(n * mult()); st.score += v; if (at) popText(at, '+' + v, cls); }
function fire() {
  if (st.mode !== 'play') return;
  if (st.reload > 0) return;
  if (st.ammo <= 0) { sfx.empty(); startReload(); return; }
  st.ammo--; st.shots++; sfx.shoot();
  $('muzzle').style.opacity = 0.18; setTimeout(() => ($('muzzle').style.opacity = 0), 40);
  blaster.position.z = -0.65; $('cross').classList.add('kick'); setTimeout(() => $('cross').classList.remove('kick'), 70);
  ray.setFromCamera(new THREE.Vector2(aim.x, aim.y), cam);
  const targets = [];
  for (const e of enemies) if (!e.dead && (e.type === 'boss' || e.g.scale.x > 0.5)) e.g.traverse((m) => m.isMesh && targets.push(m));
  for (const s of shots) if (!s.dead) s.g.traverse((m) => m.isMesh && targets.push(m));
  const h = ray.intersectObjects(targets, false)[0];
  if (!h) { st.combo = Math.max(0, st.combo - 2); hud(); return; }
  st.hits++;
  const en = h.object.userData.en, head = h.object.userData.zone === 'head';
  burst(h.point, 6, head ? 0 : 1, 3);
  damage(en, head, h.point);
  hud();
}
function damage(en, head, at) {
  if (en.dead) return;
  en.flash = 0.12;
  if (en.type === 'shot') { en.hp--; sfx.hit(); if (en.hp <= 0) { en.dead = 1; freeRing(en); addScore(50, at, 'bonus'); burst(at, 10, 3, 4); st.combo++; } return; }
  if (en.type === 'boss') {
    const d = head ? 3 : 1; en.hp -= d; head ? sfx.head() : sfx.hit(); addScore(head ? 60 : 20, at, head ? 'hs' : '');
    if (head) { st.heads++; popText(at.clone().add(new THREE.Vector3(0, 0.6, 0)), 'WEAK POINT!', 'hs'); }
    if (en.phase === 1 && en.hp <= en.hpMax / 2) { en.phase = 2; sfx.roar(); st.shake = 0.5; banner('ANGRY!', en.cfg.name + ' 本気モード', 1.6); burst(en.g.position, 24, 3, 6); }
    if (en.hp <= 0) bossDown(en);
    return;
  }
  if (en.type === 'balloon') { kill(en, at); sfx.pop(); if (en.heart && st.hearts < 5) { st.hearts++; sfx.heart(); toast('♥ ハート回復！'); } addScore(en.heart ? 200 : 300, at, 'bonus'); return; }
  if (en.type === 'target') { kill(en, at); sfx.ding(); addScore(250, at, 'bonus'); return; }
  en.hp -= head ? 2 : 1;
  if (head) { st.heads++; sfx.head(); popText(at.clone().add(new THREE.Vector3(0, 0.5, 0)), 'HEADSHOT!', 'hs'); } else sfx.hit();
  if (en.hp <= 0) {
    kill(en, at); sfx.nya(en.type === 'ghost' ? 1.6 : en.fat ? 0.75 : 1.2); if (en.type === 'ghost') sfx.ghost(); if (en.type === 'bat') sfx.bat();
    const base = en.type === 'ghost' ? 150 : en.type === 'bat' ? 180 : en.fat ? 300 : 100;
    addScore(base * (head ? 2 : 1), at, head ? 'hs' : '');
  }
}
function kill(en, at) { en.dead = 0.001; freeRing(en); st.kills++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo); burst(at || en.g.position, 14, en.type === 'ghost' ? 4 : 2, 5); }
function startReload() { if (st.reload > 0 || st.ammo === MAX_AMMO || st.mode !== 'play') return; st.reload = 0.75; sfx.reload(); hud(); }
function hurt() {
  if (st.inv > 0 || st.mode !== 'play') return;
  st.hearts--; st.inv = 1.1; st.combo = 0; st.shake = 0.35; sfx.hurt();
  $('flash').style.transition = 'none'; $('flash').style.opacity = 1; requestAnimationFrame(() => { $('flash').style.transition = 'opacity .5s'; $('flash').style.opacity = 0; });
  hud();
  if (st.hearts <= 0) finish(false);
}
function bossDown(en) {
  en.dead = 0.001; st.kills++; sfx.boom(); st.shake = 0.6; en.stop.done = true;
  const runId = st.runId;
  for (let i = 0; i < 4; i++) setTimeout(() => { if (st.runId !== runId) return; burst(en.g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, 0)), 22, i, 7); sfx.boom(); }, i * 180);
  addScore(en.cfg.score, en.g.position, 'bonus'); stopBgm();
  for (const s of shots) { s.dead = 1; freeRing(s); }
  for (const e of enemies) if (e !== en && !e.dead) kill(e);
  $('bossBar').style.display = 'none';
  if (en.stop.final) setTimeout(() => { if (st.runId !== runId) return; sfx.clear(); finish(true); }, 1400);
  else setTimeout(() => { if (st.runId !== runId || st.mode !== 'play') return; st.boss = null; sfx.section(); banner('MID BOSS CLEAR', '先へすすめ！'); playBgm(stage.bgm); }, 1300);
}

// ---------------- result / flow (NEKO_CART_STAGES_v1)
function rankOf(total, clear) { const [s, a, b] = stage.rank; return !clear ? 'C' : total > s ? 'S' : total > a ? 'A' : total > b ? 'B' : 'C'; }
function finish(clear) {
  if (st.mode !== 'play') return;
  st.mode = 'result'; stopBgm(); if (!clear) sfx.over();
  for (const o of [...enemies, ...shots]) freeRing(o);
  $('bossBar').style.display = 'none';
  const acc = st.shots ? Math.round(st.hits / st.shots * 100) : 0;
  const total = st.score + (clear ? st.hearts * 1000 : 0) + acc * 20;
  const i = stage.id - 1; let rec = false, unlocked = false;
  if (clear) {
    save.cleared[i] = 1;
    if (total > save.hi[i]) { save.hi[i] = total; rec = true; }
    if (stage.id < 3 && save.unlocked < stage.id + 1) { save.unlocked = stage.id + 1; unlocked = true; }
    persist();
  }
  const all = clear && stage.id === 3;
  $('resSub').textContent = all ? 'ALL STAGES CLEAR!' : clear ? `STAGE ${stage.id} CLEAR!` : 'GAME OVER';
  $('resStage').textContent = `STAGE ${stage.id} · ${stage.name}`;
  $('rank').textContent = clear ? rankOf(total, true) : '×_×';
  $('resTable').innerHTML = [['スコア', st.score.toLocaleString()], ['ハートボーナス', clear ? '+' + st.hearts * 1000 : '-'], ['命中率', `${acc}% (${st.hits}/${st.shots}) +${acc * 20}`], ['撃破数', st.kills], ['ヘッドショット', st.heads], ['最大コンボ', st.maxCombo], ['合計', total.toLocaleString()]].map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
  $('resMsg').innerHTML = all ? '🎃👑 キング・ニャンタンをたおした！<br>ねこタウンに 平和がもどった。おめでとう！' : (rec ? '<b class="rec">★ NEW RECORD! ★</b>' : '') + (unlocked ? `<br>🔓 STAGE ${stage.id + 1}「${STAGES[stage.id].name}」解放！` : '');
  const btns = [];
  if (clear && stage.id < 3) btns.push(['next', `STAGE ${stage.id + 1} へ ▶`, 'big']);
  btns.push(['retry', clear ? 'もう一回' : 'リトライ ⟳', clear && stage.id < 3 ? 'small' : 'big']);
  btns.push(['select', 'ステージセレクト', 'small'], ['title', 'タイトルへ', 'small']);
  $('resBtns').innerHTML = btns.map(([id, l, c]) => `<button type="button" class="${c}" data-act="${id}">${l}</button>`).join('');
  $('result').classList.toggle('allclear', all);
  setTimeout(() => {
    if (st.mode !== 'result') return;
    $('result').style.display = 'flex'; $('cross').style.display = 'none'; document.body.style.cursor = 'default';
    if (all) { sfx.allclear(); confetti(); } else if (unlocked) setTimeout(() => sfx.unlock(), 500);
  }, clear ? 300 : 900);
}
function confetti() {
  const cols = ['#ff6ab0', '#ffd23a', '#7ad8ff', '#9aff7a', '#fff'];
  for (let i = 0; i < 70; i++) {
    const d = document.createElement('div'); d.className = 'conf'; d.style.left = Math.random() * 100 + 'vw'; d.style.background = cols[i % cols.length];
    d.style.animationDelay = Math.random() * 1.5 + 's'; d.style.animationDuration = 2 + Math.random() * 2 + 's'; $('result').appendChild(d); setTimeout(() => d.remove(), 5000);
  }
}
$('resBtns').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return; initAudio(); sfx.select();
  const a = b.dataset.act;
  if (a === 'next') startStage(stage.id + 1);
  else if (a === 'retry') startStage(stage.id);
  else if (a === 'select') showSelect();
  else showTitle();
});

// ---------------- input: mouse / touch (light-gun style) + gyro
const touches = new Map();
function setAimFromClient(x, y) { aim.dx = clamp(x / innerWidth * 2 - 1, -1, 1); aim.dy = clamp(-(y / innerHeight * 2 - 1), -1, 1); }
let holdFire = false, fireCD = 0;
const cv = R.domElement;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  if (st.mode !== 'play') return;
  e.preventDefault();
  if (e.button === 2) { startReload(); return; }
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gyro.on) setAimFromClient(e.clientX, e.clientY);
  } else setAimFromClient(e.clientX, e.clientY);
  updateAim(); fire(); holdFire = true; fireCD = 0.22;
});
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') {
    const t = touches.get(e.pointerId); if (!t) return;
    if (gyro.on) { aim.dx = clamp(aim.dx + (e.clientX - t.x) / innerWidth * 2, -1, 1); aim.dy = clamp(aim.dy - (e.clientY - t.y) / innerHeight * 2, -1, 1); }
    else setAimFromClient(e.clientX, e.clientY);
    t.x = e.clientX; t.y = e.clientY;
  } else setAimFromClient(e.clientX, e.clientY);
});
const up = (e) => { touches.delete(e.pointerId); if (!touches.size) holdFire = false; };
addEventListener('pointerup', up); addEventListener('pointercancel', up);
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space') { e.preventDefault(); fire(); holdFire = true; fireCD = 0.22; }
  else if (e.code === 'KeyR') startReload();
  else if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', (e) => { if (e.code === 'Space') holdFire = false; });
$('btnReload').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); startReload(); });

const gyro = { on: false, base: null, x: 0, y: 0, got: 0, q: new THREE.Quaternion() };
const _e = new THREE.Euler(), _q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), _q0 = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _f = new THREE.Vector3();
function onOri(ev) {
  if (ev.beta == null || ev.gamma == null) return;
  gyro.got = performance.now();
  const d = THREE.MathUtils.degToRad;
  const orient = d((screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0);
  _e.set(d(ev.beta), d(ev.alpha || 0), -d(ev.gamma), 'YXZ');
  gyro.q.setFromEuler(_e).multiply(_q1).multiply(_q0.setFromAxisAngle(_z, -orient));
  if (!gyro.base) gyro.base = gyro.q.clone().invert();
  _f.set(0, 0, -1).applyQuaternion(gyro.base.clone().multiply(gyro.q));
  const yaw = Math.atan2(_f.x, -_f.z), pitch = Math.asin(clamp(_f.y, -1, 1));
  gyro.x = clamp(yaw / d(24), -1.4, 1.4); gyro.y = clamp(pitch / d(17), -1.4, 1.4);
}
async function enableGyro() {
  if (typeof DeviceOrientationEvent === 'undefined') { toast('この端末はジャイロ非対応。ドラッグ／タップ照準で遊べるよ'); return false; }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') { toast('ジャイロが許可されなかったので、ドラッグ照準にするね'); return false; }
    }
  } catch (err) { toast('ジャイロ許可に失敗。ドラッグ照準で遊べるよ'); return false; }
  addEventListener('deviceorientation', onOri);
  gyro.on = true; gyro.base = null; gyro.got = 0; aim.dx = aim.dy = 0; gyroUi();
  toast('📱 ジャイロ照準 ON（🎯で中央に戻す）');
  setTimeout(() => { if (gyro.on && !gyro.got) { disableGyro(); toast('ジャイロの値が来ないので、ドラッグ照準に戻したよ'); } }, 1600);
  return true;
}
function disableGyro() { removeEventListener('deviceorientation', onOri); gyro.on = false; gyro.x = gyro.y = 0; gyroUi(); }
function gyroUi() { $('gyroBtn').classList.toggle('on', gyro.on); $('centerBtn').style.display = gyro.on ? '' : 'none'; $('btnGyroTitle').textContent = gyro.on ? '📱 ジャイロ照準 ON ✓' : '📱 ジャイロ照準を使う'; }
$('gyroBtn').addEventListener('click', () => (gyro.on ? (disableGyro(), toast('ジャイロ OFF')) : enableGyro()));
$('btnGyroTitle').addEventListener('click', () => (gyro.on ? disableGyro() : enableGyro()));
$('centerBtn').addEventListener('click', () => { gyro.base = null; aim.dx = aim.dy = 0; toast('🎯 照準を中央にリセット'); });
function updateAim() { aim.x = clamp(aim.dx + (gyro.on ? gyro.x : 0), -1, 1); aim.y = clamp(aim.dy + (gyro.on ? gyro.y : 0), -1, 1); }
function toggleMute() { setMuted(!isMuted()); $('muteBtn').textContent = isMuted() ? '🔇' : '🔊'; }
$('muteBtn').addEventListener('click', toggleMute);



// ---------------- screens
function clearActors() {
  for (const e of enemies) S.remove(e.g); for (const s of shots) S.remove(s.g); for (const p of parts) S.remove(p.m);
  for (const o of [...enemies, ...shots]) freeRing(o);
  enemies.length = shots.length = parts.length = 0; nextEv = 0;
}
function hideAll() { for (const id of ['title', 'select', 'result']) $(id).style.display = 'none'; }
function showTitle() {
  clearActors(); hideAll(); st.mode = 'title'; st.boss = null; st.s = 0;
  if (stage.id !== 1) buildWorld(STAGES[0]);
  $('hud').style.display = 'none'; $('cross').style.display = 'none'; $('bossBar').style.display = 'none'; document.body.style.cursor = 'default';
  const nx = nextStageId(); $('btnStart').textContent = nx > 1 ? `▶ つづきから (STAGE ${nx})` : 'INSERT COIN ▶ START';
  $('title').style.display = 'flex';
  if (audioOn) playBgm('title');
}
function showSelect() {
  clearActors(); hideAll(); st.mode = 'title'; st.boss = null;
  $('hud').style.display = 'none'; $('cross').style.display = 'none'; $('bossBar').style.display = 'none'; document.body.style.cursor = 'default';
  $('stageList').innerHTML = STAGES.map((sg, i) => {
    const lock = sg.id > save.unlocked;
    const bossN = sg.bosses.map((b) => (b.at === 'end' ? 'BOSS ' : '中ボス ') + BOSSES[b.kind].name).join(' / ');
    return `<button type="button" class="stage${lock ? ' lock' : ''}${save.cleared[i] ? ' clr' : ''}" data-id="${sg.id}" ${lock ? 'disabled' : ''}>
      <div class="sn">STAGE ${sg.id}${save.cleared[i] ? ' <span class="ok">CLEAR ✓</span>' : ''}</div>
      <div class="nm">${lock ? '🔒 ？？？' : sg.name}<small>${lock ? 'LOCKED' : sg.en}</small></div>
      <div class="bl">${lock ? `STAGE ${sg.id - 1} をクリアで解放` : sg.blurb}</div>
      ${lock ? '' : `<div class="bs">${bossN}</div><div class="hi">HI-SCORE ${save.hi[i].toLocaleString()}</div>`}
    </button>`;
  }).join('');
  $('select').style.display = 'flex';
  if (audioOn) playBgm('title');
}
$('stageList').addEventListener('click', (e) => { const b = e.target.closest('button.stage'); if (!b || b.disabled) return; initAudio(); startStage(+b.dataset.id); });
$('btnBack').addEventListener('click', () => { initAudio(); sfx.select(); showTitle(); });
let audioOn = false;
const unlockAudio = () => { initAudio(); if (!audioOn) { audioOn = true; if (st.mode === 'title') playBgm('title'); } };
$('btnStart').addEventListener('click', () => { unlockAudio(); sfx.select(); startStage(nextStageId()); });
function nextStageId() { const i = save.cleared.findIndex((c, k) => !c && k < save.unlocked); return i < 0 ? 1 : i + 1; }
$('btnSelect').addEventListener('click', () => { unlockAudio(); sfx.select(); showSelect(); });
$('title').addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) unlockAudio(); });

function startStage(id) {
  initAudio(); audioOn = true;
  const sg = STAGES[clamp(id, 1, 3) - 1];
  clearActors(); buildWorld(sg);
  st.stops = sg.bosses.map((b) => ({ s: b.at === 'end' ? LEN - 2 : b.at * LEN, kind: b.kind, final: b.at === 'end', done: false }));
  buildEvents();
  Object.assign(st, { mode: 'play', s: 0, speed: 0, t: 0, hearts: 5, score: 0, combo: 0, maxCombo: 0, shots: 0, hits: 0, heads: 0, kills: 0, ammo: MAX_AMMO, reload: 0, inv: 0, zone: -1, boss: null, shake: 0, end: 0, runId: (st.runId || 0) + 1 });
  seed = 99 + id; $('bossBar').style.display = 'none';
  hideAll(); $('hud').style.display = 'block'; $('cross').style.display = 'block';
  document.body.style.cursor = 'none';
  $('stageTag').textContent = `STAGE ${sg.id}`;
  playBgm(sg.bgm); hud();
  st.stageIntro = 2.6; banner(`STAGE ${sg.id}`, sg.name, 2.4); sfx.section();
}

// ---------------- camera on rails
const fwd = new THREE.Vector3(), look = new THREE.Vector3();
function placeCamera(dt) {
  const s = st.s; const f = frameAt(s); const fa = frameAt(Math.min(s + 5, LEN));
  fwd.copy(fa.p).sub(f.p); if (fwd.lengthSq() < 1e-4) fwd.copy(f.t); fwd.y = 0; fwd.normalize();
  if (s >= LEN - 0.01) fwd.copy(f.t).setY(0).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
  const bob = Math.sin(st.t * 11) * 0.025 * (st.speed / 6) + Math.sin(st.t * 3.1) * 0.02;
  cam.position.copy(f.p).addScaledVector(UP, 1.45 + bob);
  if (st.shake > 0) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake, 0));
  look.copy(cam.position).add(fwd).addScaledVector(right, aim.x * 0.32).addScaledVector(UP, aim.y * 0.2 - 0.04);
  cam.lookAt(look);
  const turn = f.t.clone().cross(fa.t).y; cam.rotateZ(clamp(turn * 0.8, -0.08, 0.08));
  moon.position.copy(cam.position).add(new THREE.Vector3(-30, 34, -60)); moon.lookAt(cam.position);
}
function syncLamps() {
  const L = U.uLP.value, C = U.uLC.value;
  L[0].copy(cam.position).addScaledVector(fwd, 3).setY(1.8); C[0].set(1.4, 1.2, 1.0);
  const near = lamps.map((l) => [l, l.pos.distanceToSquared(cam.position)]).sort((a, b) => a[1] - b[1]);
  for (let i = 1; i < 8; i++) { const l = near[i - 1]; if (l) { L[i].copy(l[0].pos); C[i].set(l[0].col.r, l[0].col.g, l[0].col.b); } else C[i].set(0, 0, 0); }
}

// ---------------- main loop
let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  updateAim();
  if (st.mode === 'play') step(dt);
  else { st.t += dt; st.speed = 2; if (st.mode === 'title') { st.s = (st.s + dt * 2) % Math.min(60, LEN - 10); } }
  placeCamera(dt);
  syncLamps();
  const c = $('cross'); c.style.transform = `translate(${(aim.x + 1) / 2 * innerWidth}px,${(1 - aim.y) / 2 * innerHeight}px)`;
  blaster.rotation.set(aim.y * 0.35, -aim.x * 0.45, 0); blaster.position.z += (-0.75 - blaster.position.z) * Math.min(1, dt * 14);
  for (const ch of rig.children) ch.visible = st.mode !== 'title';
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('show');
  if (!pipeline.render(S, cam, 'ps1')) {
    if (!lambertDone) { S.traverse((m) => meshToLambert(m)); lambertDone = true; }
    R.setRenderTarget(null); R.render(S, cam);
  }
}
function step(dt) {
  st.t += dt;
  const stop = st.stops.find((x) => !x.done);
  const cruise = st.stageIntro > 0 ? stage.speed * 0.6 : stage.speed;
  if (st.stageIntro > 0) st.stageIntro -= dt;
  const target = stop && st.s >= stop.s - 0.05 ? 0 : stop && st.s > stop.s - 10 ? 2.2 : cruise;
  st.speed += (target - st.speed) * Math.min(1, dt * 2);
  st.s = Math.min(stop ? stop.s : LEN - 2, st.s + st.speed * dt);
  if (stop && st.s >= stop.s - 0.3 && !st.boss) spawnBoss(stop);
  st.inv = Math.max(0, st.inv - dt); st.shake = Math.max(0, st.shake - dt);
  if (st.reload > 0 && (st.reload -= dt) <= 0) { st.reload = 0; st.ammo = MAX_AMMO; hud(); }
  if (holdFire && (fireCD -= dt) <= 0) { fire(); fireCD = 0.22; }
  st.rattle -= dt * st.speed; if (st.rattle <= 0) { st.rattle = 0.9; sfx.rattle(st.speed / 6); }
  const z = zoneAt(st.s); if (z !== st.zone) { st.zone = z; $('secName').textContent = `STAGE ${stage.id}-${z + 1} · ${ZONES[z].en}`; if (z > 0) { banner(`AREA ${stage.id}-${z + 1}`, ZONES[z].name); sfx.section(); } }
  while (nextEv < events.length && events[nextEv].s <= st.s) spawn(events[nextEv++]);
  const camP = cam.position;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]; e.age += dt;
    if (e.dead) {
      e.dead += dt; const k = Math.max(0, 1 - e.dead / 0.35) * e.size * (e.type === 'boss' && e.cfg === BOSSES.king ? 1.3 : 1); e.g.scale.set(k * 1.3, k * 0.7, k * 1.3); e.g.position.y += dt * 2;
      if (e.dead > 0.35) { S.remove(e.g); enemies.splice(i, 1); }
      continue;
    }
    if (e.type !== 'boss') { const sc = Math.min(1, e.age * 4); e.g.scale.setScalar(e.size * sc * (1 + Math.sin(sc * Math.PI) * 0.25)); }
    if (e.flash > 0) { e.flash -= dt; e.g.scale.multiplyScalar(1.08); } else if (e.type === 'boss') e.g.scale.setScalar(e.cfg === BOSSES.king ? 1.3 : 1);
    const dx = camP.x - e.g.position.x, dz = camP.z - e.g.position.z; e.g.rotation.y = Math.atan2(dx, dz);
    const toE = e.g.position.clone().sub(camP); const ahead = toE.dot(fwd);
    if (e.type === 'cat') {
      e.g.position.y = e.base.y + Math.abs(Math.sin(e.age * (e.fat ? 3 : 5))) * 0.12;
      if (ahead > 1.5) {
        e.atk -= dt; const r = ringFor(e); const sp = toScreen(e.g.position.clone().add(new THREE.Vector3(0, 0.9 * e.size, 0)));
        const k = clamp(e.atk / e.atkMax, 0, 1); const size = 26 + 90 * k;
        r.style.display = sp.ok ? 'block' : 'none'; r.style.left = sp.x + 'px'; r.style.top = sp.y + 'px'; r.style.width = r.style.height = size + 'px'; r.classList.toggle('hot', k < 0.35);
        if (e.atk <= 0) { throwShot(e.g.position.clone().add(new THREE.Vector3(0, 1, 0)), e.fat ? 'fish' : rnd() < 0.5 ? 'fish' : 'yarn', e.fat ? 0.85 : 1); e.atk = e.atkMax + 0.6; sfx.nya(e.fat ? 0.8 : 1.4); }
      } else freeRing(e);
    } else if (e.type === 'ghost' || e.type === 'bat') {
      const bat = e.type === 'bat';
      if (bat && e.g.userData.wings) { const f = Math.sin(e.age * 22) * 0.6; e.g.userData.wings[0].rotation.x = f; e.g.userData.wings[1].rotation.x = f; }
      if (e.age > (bat ? 0.4 : 0.6) && ahead > 0) {
        const dir = camP.clone().sub(e.g.position); const d = dir.length(); dir.normalize();
        e.g.position.addScaledVector(dir, dt * ((bat ? 3.3 : 2.4) + st.speed * 0.35));
        e.g.position.y += Math.sin(e.age * (bat ? 7 : 4)) * (bat ? 0.03 : 0.01);
        e.g.position.addScaledVector(new THREE.Vector3().crossVectors(dir, UP), Math.sin(e.age * (bat ? 4.5 : 2.5)) * dt * (bat ? 4 : 1.5));
        const r = ringFor(e); const sp = toScreen(e.g.position.clone().add(new THREE.Vector3(0, bat ? 0 : 0.6, 0))); const sz = clamp(140 - d * 8, 24, 120);
        r.style.display = sp.ok ? 'block' : 'none'; r.style.left = sp.x + 'px'; r.style.top = sp.y + 'px'; r.style.width = r.style.height = sz + 'px'; r.classList.toggle('hot', d < 5);
        if (d < 1.4) { hurt(); kill(e, e.g.position); st.kills--; st.combo = 0; }
      }
    } else if (e.type === 'balloon') { e.g.position.y = e.base.y + e.age * 0.45; e.g.rotation.z = Math.sin(e.age * 2) * 0.15; }
    else if (e.type === 'boss') {
      const cfg = e.cfg, p2 = e.phase === 2;
      e.g.position.copy(e.base).addScaledVector(e.side, Math.sin(e.age * (p2 ? 1.3 : 0.9)) * cfg.sway).setY(e.base.y + Math.sin(e.age * 2.2) * 0.6);
      e.g.rotation.z = Math.sin(e.age * 1.7) * (p2 ? 0.2 : 0.12);
      const enr = p2 ? 0.7 : 1;
      if ((e.atk -= dt) <= 0) {
        const n = p2 ? cfg.multi : 1;
        for (let j = 0; j < n; j++) { const off = (j - (n - 1) / 2) * 1.6; throwShot(e.g.position.clone().addScaledVector(e.side, off).add(new THREE.Vector3(0, -0.5, 0)).addScaledVector(fwd, -1), pick(cfg.throws), 1 + j * 0.18); }
        e.atk = e.atkMax * enr * (n > 1 ? 1.3 : 1);
      }
      if ((e.summon -= dt) <= 0) { e.summon = cfg.summon * enr; spawnMinion(e, pick(cfg.minions)); }
    }
    if (e.type !== 'boss' && ahead < -1.5) { freeRing(e); S.remove(e.g); enemies.splice(i, 1); }
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    if (s.dead) { S.remove(s.g); freeRing(s); shots.splice(i, 1); continue; }
    s.t += dt / s.dur; const k = Math.min(1, s.t);
    const tgt = camP.clone().addScaledVector(fwd, 0.6).add(new THREE.Vector3(0, -0.15, 0));
    s.g.position.lerpVectors(s.from, tgt, k); s.g.position.y += Math.sin(k * Math.PI) * (s.kind === 'fire' ? 0.6 : 1.6);
    s.g.rotation.x += dt * 9; s.g.rotation.y += dt * 6;
    const r = ringFor(s); const sp = toScreen(s.g.position); r.style.display = sp.ok ? 'block' : 'none'; r.style.left = sp.x + 'px'; r.style.top = sp.y + 'px'; r.style.width = r.style.height = (22 + k * 50) + 'px'; r.classList.add('hot');
    if (k >= 1) { hurt(); s.dead = 1; }
  }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 8; if (p.life <= 0) { S.remove(p.m); parts.splice(i, 1); } }
  ray.setFromCamera(new THREE.Vector2(aim.x, aim.y), cam);
  const ts = []; for (const e of enemies) if (!e.dead) e.g.traverse((m) => m.isMesh && ts.push(m)); for (const s of shots) s.g.traverse((m) => m.isMesh && ts.push(m));
  $('cross').classList.toggle('lock', ray.intersectObjects(ts, false).length > 0);
  if (Math.floor(st.t * 4) !== Math.floor((st.t - dt) * 4)) hud();
}
function spawnMinion(boss, type) {
  const sd = rnd() < 0.5 ? -1 : 1;
  const pos = boss.g.position.clone().addScaledVector(boss.side, sd * 3.2);
  if (type === 'cat') {
    pos.y = 0.2; const en = newEnemy('cat', makeCat(false), pos, { hp: 2, atkMax: stage.atk, roof: false }); en.atk = en.atkMax + 0.4; sfx.nya(1.1);
  } else if (type === 'bat') { pos.y = 2.4; newEnemy('bat', makeBat(), pos); sfx.bat(); }
  else { pos.y = 1.6; newEnemy('ghost', makeGhost(), pos); sfx.ghost(); }
}
addEventListener('resize', () => { R.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); pipeline.resize(); });
window.__neko = { st, get LEN() { return LEN; }, damage, enemies, shots, fire, aim, enableGyro, cam, THREE, STAGES, save, startStage, showSelect, showTitle };
buildWorld(STAGES[0]);
showTitle(); hud(); requestAnimationFrame(tick);
