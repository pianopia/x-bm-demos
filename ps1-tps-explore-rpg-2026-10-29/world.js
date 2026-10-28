// Map, meshes, colliders and gimmick objects
import * as THREE from 'three';
import { M, T } from './render.js';
export const C = 2, H = 3.6;
// # wall  . floor  o pillar  A altar  s slime  D iron door  G gate  X crate pile  + doorway
// P pit  B bridge  F brazier  k key  L lever  t torch  m memo  r rod  h herb  f campfire  N npc  S start  p pressure plate
export const MAP = [
  '################',
  '######.....#####',
  '######o.A.o#####',
  '######.....#####',
  '######..s..#####',
  '########D#######',
  '#.....#...#....#',
  '#..F..#PBP#..L.#',
  '#.k...X...+..t.#',
  '#.....#...#....#',
  '########G#######',
  '#...........m..#',
  '#.r..o...So..h.#',
  '#...f..N.......#',
  '#..........p...#',
  '################',
];
export const ROWS = MAP.length, COLS = MAP[0].length, OUT_ROW = 11;
export const cellCh = (c, r) => (MAP[r] || '')[c] || '#';
export const cellAt = (x, z) => cellCh(Math.floor(x / C), Math.floor(z / C));
export const center = (c, r, y = 0) => new THREE.Vector3((c + .5) * C, y, (r + .5) * C);
export function find(ch) { for (let r = 0; r < ROWS; r++) { const c = MAP[r].indexOf(ch); if (c >= 0) return center(c, r); } }
export const isIndoor = z => z < OUT_ROW * C;

export function buildWorld(scene) {
  const W = { colliders: [], camBlockers: [], bounceMeshes: [], o: {}, pickups: [], shards: [], lights: [] };
  const add = (geo, mat, pos, rot = [0, 0, 0], parent = scene, bounce = false) => {
    const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.rotation.set(...rot); parent.add(m); if (bounce) W.bounceMeshes.push(m); return m;
  };
  const box = (x0, x1, z0, z1, on = null, tag = '', cam = false) => { const b = { x0, x1, z0, z1, on, tag }; W.colliders.push(b); if (cam) W.camBlockers.push(b); return b; };
  const circ = (p, s, on = null, tag = '') => box(p.x - s / 2, p.x + s / 2, p.z - s / 2, p.z + s / 2, on, tag);

  const mWall = M(T.brick, [1, 3.3]), mFloor = M(T.floor, [1, 1]), mCob = M(T.cobble, [1, 1]), mCeil = M(T.plaster, [1, 1]);
  const mDark = M(T.dark), mStone = M(T.stone), mWood = M(T.wood), mPlank = M(T.plank, [1, 2]), mIron = M(T.iron), mRed = M(T.red);
  const mFlame = M(T.flame, [1, 1], 0xff8a2a), mBlue = M(T.blue, [1, 1], 0x1d4a66), mGold = M(T.gold), mPaper = M(T.paper), mGreen = M(T.green), mLeaf = M(T.leaf);
  W.m = { mFlame, mBlue, mWood, mStone, mIron, mGold, mDark };
  const gWall = new THREE.BoxGeometry(C, H + 3, C, 3, 7, 3), gTile = new THREE.PlaneGeometry(C, C, 3, 3);
  const isPit = ch => ch === 'P' || ch === 'B';

  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = cellCh(c, r), p = center(c, r);
    if (ch === '#') {
      let near = false; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const n = MAP[r + dr]?.[c + dc]; if (n && n !== '#') near = true; }
      box(c * C, c * C + C, r * C, r * C + C, null, 'wall', true);
      if (near) add(gWall, mWall, new THREE.Vector3(p.x, (H - 3) / 2, p.z), [0, 0, 0], scene, true);
      continue;
    }
    if (!isPit(ch)) add(gTile, r >= OUT_ROW ? mCob : mFloor, p, [-Math.PI / 2, 0, 0], scene, true);
    else {
      add(gTile, mDark, new THREE.Vector3(p.x, -3, p.z), [-Math.PI / 2, 0, 0]);
      for (const [dr, rot] of [[-1, 0], [1, Math.PI]]) if (!isPit(cellCh(c, r + dr))) add(new THREE.PlaneGeometry(C, 3, 2, 2), mStone, new THREE.Vector3(p.x, -1.5, p.z + dr * C / 2), [0, rot, 0]);
    }
    if (r < OUT_ROW) add(gTile, mCeil, new THREE.Vector3(p.x, H, p.z), [Math.PI / 2, 0, 0], scene, true);
  }

  // pillars
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (cellCh(c, r) === 'o') {
    const p = center(c, r); const broken = r >= OUT_ROW; const h = broken ? 1.4 + Math.random() : H;
    add(new THREE.CylinderGeometry(.42, .48, h, 10, 4), M(T.stone, [2, 2]), new THREE.Vector3(p.x, h / 2, p.z), [0, 0, 0], scene, true);
    add(new THREE.BoxGeometry(1.1, .3, 1.1), mStone, new THREE.Vector3(p.x, .15, p.z));
    circ(p, .95, null, 'pillar');
  }
  // ---- sconces + static lights
  const sconce = (x, y, z) => { add(new THREE.BoxGeometry(.18, .35, .18), mIron, new THREE.Vector3(x, y - .2, z)); const f = add(new THREE.ConeGeometry(.12, .35, 6), mFlame, new THREE.Vector3(x, y + .1, z)); W.flames.push(f); };
  W.flames = [];
  // light slots: 0 player, 1 campfire, 2 hall, 3 east, 4 brazier, 5 altar, 6 altar room, 7 door area
  W.lightDefs = [
    null,
    { pos: find('f').clone().setY(.9), col: new THREE.Vector3(1, .55, .25).multiplyScalar(3.4), flick: 1 },
    { pos: new THREE.Vector3(14.25, 2.4, 19), col: new THREE.Vector3(1, .6, .3).multiplyScalar(1.8), flick: 1, sconce: 1 },
    { pos: new THREE.Vector3(26, 2.4, 12.25), col: new THREE.Vector3(1, .65, .35).multiplyScalar(2.0), flick: 1, sconce: 1 },
    { pos: find('F').clone().setY(1.3), col: new THREE.Vector3(1, .5, .2).multiplyScalar(4.0), flick: 1, off: 'brazierLit' },
    { pos: find('A').clone().setY(1.7), col: new THREE.Vector3(.35, .7, 1).multiplyScalar(2.0), flick: 0 },
    { pos: new THREE.Vector3(12.25, 2.4, 7), col: new THREE.Vector3(1, .6, .3).multiplyScalar(1.6), flick: 1, sconce: 1 },
    { pos: new THREE.Vector3(19.75, 2.4, 13), col: new THREE.Vector3(.5, .6, 1).multiplyScalar(1.2), flick: 0, sconce: 1 },
  ];
  for (const d of W.lightDefs) if (d?.sconce) sconce(d.pos.x, d.pos.y, d.pos.z);
  // banners
  add(new THREE.PlaneGeometry(1, 2, 1, 3), mRed, new THREE.Vector3(19.74, 2, 19), [0, -Math.PI / 2, 0]);
  add(new THREE.PlaneGeometry(1, 2, 1, 3), mRed, new THREE.Vector3(12.26, 2, 4), [0, Math.PI / 2, 0]);
  add(new THREE.PlaneGeometry(1, 2, 1, 3), mRed, new THREE.Vector3(21.74, 2, 4), [0, -Math.PI / 2, 0]);

  // ---- gate (pressure plate)
  { const p = find('G'); const g = new THREE.Group(); g.position.copy(p); scene.add(g);
    for (let i = 0; i < 7; i++) add(new THREE.CylinderGeometry(.05, .05, 3.3, 5), mIron, new THREE.Vector3(-.9 + i * .3, 1.65, 0), [0, 0, 0], g);
    for (const y of [.5, 2.8]) add(new THREE.BoxGeometry(C, .12, .12), mIron, new THREE.Vector3(0, y, 0), [0, 0, 0], g);
    W.o.gate = g; box(p.x - 1, p.x + 1, p.z - .2, p.z + .2, () => !W.flags.gateOpen, 'gate', true); }
  // ---- iron door (key)
  { const p = find('D'); const piv = new THREE.Group(); piv.position.set(p.x - 1, 0, p.z + .4); scene.add(piv);
    add(new THREE.BoxGeometry(C, 3.2, .2, 3, 4, 1), M(T.door, [1, 1]), new THREE.Vector3(1, 1.6, 0), [0, 0, 0], piv);
    W.o.door = piv; box(p.x - 1, p.x + 1, p.z + .2, p.z + .6, () => !W.flags.doorOpen, 'door', true); }
  // ---- crate pile (breakable)
  { const p = find('X'); const g = new THREE.Group(); g.position.copy(p); scene.add(g); const gb = new THREE.BoxGeometry(.9, .9, .9, 2, 2, 2);
    const pos = [[-.45, .45, -.45], [.45, .45, -.4], [0, .45, .45], [-.2, 1.35, 0], [.5, 1.35, .3], [.1, 2.2, -.1]];
    W.o.crates = pos.map(q => add(gb, mWood, new THREE.Vector3(...q), [0, (q[0] + q[2]) * .8, 0], g));
    W.o.crate = g; box(p.x - 1, p.x + 1, p.z - 1, p.z + 1, () => !W.flags.crateBroken, 'crate'); }
  // ---- pressure plate
  { const p = find('p'); add(new THREE.BoxGeometry(1.8, .06, 1.8), mStone, p.clone().setY(.03)); W.o.plate = add(new THREE.BoxGeometry(1.3, .14, 1.3, 2, 1, 2), M(T.rune), p.clone().setY(.08)); W.o.platePos = p; }
  // ---- lever
  { const p = find('L'); add(new THREE.BoxGeometry(.6, .5, .5), mStone, p.clone().setY(.25)); const piv = new THREE.Group(); piv.position.set(p.x, .5, p.z); scene.add(piv);
    add(new THREE.CylinderGeometry(.05, .05, 1, 5), mIron, new THREE.Vector3(0, .5, 0), [0, 0, 0], piv); add(new THREE.SphereGeometry(.11, 6, 4), M(T.red), new THREE.Vector3(0, 1, 0), [0, 0, 0], piv);
    piv.rotation.x = -.7; W.o.lever = piv; circ(p, .7, null, 'lever');
    add(new THREE.CylinderGeometry(.5, .5, .15, 8), mIron, new THREE.Vector3(p.x + .7, 1.6, p.z - .9), [Math.PI / 2, 0, 0]); }
  // ---- bridge
  { const p = find('B'); W.o.bridge = add(new THREE.BoxGeometry(C * .96, .25, C, 2, 1, 3), mPlank, p.clone().setY(-2.8)); }
  // ---- brazier
  { const p = find('F'); add(new THREE.CylinderGeometry(.12, .25, .8, 6), mIron, p.clone().setY(.4)); add(new THREE.CylinderGeometry(.5, .25, .4, 8, 1, true), mIron, p.clone().setY(1)); add(new THREE.CircleGeometry(.48, 8), mDark, p.clone().setY(.95), [-Math.PI / 2, 0, 0]);
    const fl = new THREE.Group(); fl.position.copy(p).setY(1.05); scene.add(fl); for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(.22 - i * .05, .7 - i * .1, 6), mFlame, new THREE.Vector3((i - 1) * .12, .3, (i % 2) * .1), [0, 0, 0], fl);
    W.o.brazierFire = fl; circ(p, .9, null, 'brazier'); }
  // ---- campfire
  { const p = find('f'); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(new THREE.BoxGeometry(.28, .2, .24), mStone, new THREE.Vector3(p.x + Math.cos(a) * .55, .1, p.z + Math.sin(a) * .55), [0, a, 0]); }
    for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(.07, .07, .9, 5), mWood, new THREE.Vector3(p.x, .15, p.z), [Math.PI / 2, i * 1.05, 0]);
    const fl = new THREE.Group(); fl.position.copy(p).setY(.2); scene.add(fl); for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(.25 - i * .04, .9 - i * .12, 6), mFlame, new THREE.Vector3(Math.cos(i * 2) * .1, .4, Math.sin(i * 2) * .1), [0, 0, 0], fl);
    W.o.campFire = fl; circ(p, 1.1, null, 'campfire'); }
  // ---- altar
  { const p = find('A'); add(new THREE.BoxGeometry(2, .3, 1.6), mStone, p.clone().setY(.15)); add(new THREE.BoxGeometry(1.4, .9, 1, 2, 2, 2), M(T.rune), p.clone().setY(.75));
    W.o.crystal = add(new THREE.OctahedronGeometry(.35, 0), mBlue, p.clone().setY(1.9)); circ(p, 1.8, null, 'altar'); W.o.altarPos = p; }
  // ---- npc
  { const p = find('N'); const g = new THREE.Group(); g.position.copy(p); scene.add(g);
    add(new THREE.ConeGeometry(.45, 1.35, 8, 2), M(T.robe), new THREE.Vector3(0, .68, 0), [0, 0, 0], g); add(new THREE.SphereGeometry(.2, 7, 5), M(T.skin), new THREE.Vector3(0, 1.5, .03), [0, 0, 0], g);
    add(new THREE.ConeGeometry(.27, .5, 7), M(T.hood), new THREE.Vector3(0, 1.66, -.04), [-.25, 0, 0], g); add(new THREE.BoxGeometry(.3, .12, .05), M(T.paper), new THREE.Vector3(0, 1.38, .19), [0, 0, 0], g);
    add(new THREE.CylinderGeometry(.03, .03, 1.8, 5), mWood, new THREE.Vector3(.4, .9, .1), [0, 0, .08], g);
    W.o.npc = g; circ(p, .8, null, 'npc'); }
  // ---- decor: rubble, dead tree, east-room crates, storeroom barrels
  const rub = [[3, 23, .5], [2, 28.5, .7], [14, 29, .4], [28, 23, .6], [27, 28.5, .5], [20, 23.5, .35], [16, 7.4, .4], [3.5, 13, .4]];
  for (const [x, z, s] of rub) add(new THREE.DodecahedronGeometry(s, 0), mStone, new THREE.Vector3(x, s * .5, z), [x, z, 0]);
  { const p = new THREE.Vector3(29, 0, 27); add(new THREE.CylinderGeometry(.12, .25, 3, 6, 3), mWood, p.clone().setY(1.5)); add(new THREE.CylinderGeometry(.05, .1, 1.4, 5), mWood, p.clone().add(new THREE.Vector3(.5, 2.4, 0)), [0, 0, -.9]); add(new THREE.CylinderGeometry(.05, .1, 1.1, 5), mWood, p.clone().add(new THREE.Vector3(-.4, 2.1, .2)), [.3, 0, .9]); circ(p, .5); }
  for (const [x, z] of [[28.6, 18.5], [28.6, 17.6], [23, 18.6]]) { add(new THREE.BoxGeometry(.85, .85, .85, 2, 2, 2), mWood, new THREE.Vector3(x, .43, z), [0, x, 0]); circ(new THREE.Vector3(x, 0, z), .85); }
  for (const [x, z] of [[2.8, 12.8], [5.2, 18.8]]) { add(new THREE.CylinderGeometry(.35, .35, .9, 8), mWood, new THREE.Vector3(x, .45, z)); circ(new THREE.Vector3(x, 0, z), .7); }

  // ---- pickups
  const mk = (id, flagName, ch, build, needs = null) => { const p = find(ch); const g = new THREE.Group(); g.position.copy(p).setY(.55); scene.add(g); build(g);
    const glow = add(new THREE.OctahedronGeometry(.06), mFlame, new THREE.Vector3(0, .5, 0), [0, 0, 0], g); W.pickups.push({ id, flag: flagName, pos: p, g, glow, needs }); };
  mk('rod', 'gotRod', 'r', g => add(new THREE.CylinderGeometry(.04, .05, 1.1, 5), mIron, new THREE.Vector3(), [0, 0, 1.2], g));
  mk('torch', 'gotTorch', 't', g => { add(new THREE.CylinderGeometry(.05, .04, .7, 5), mWood, new THREE.Vector3(), [0, 0, .4], g); add(new THREE.CylinderGeometry(.08, .06, .15, 6), mDark, new THREE.Vector3(-.14, .3, 0), [0, 0, .4], g); });
  mk('herb', 'gotHerb', 'h', g => { for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(.08, .35, 4), mGreen, new THREE.Vector3(Math.cos(i * 1.6) * .08, 0, Math.sin(i * 1.6) * .08), [Math.cos(i * 1.6) * .4, 0, Math.sin(i * 1.6) * .4], g); });
  mk('memo', 'gotMemo', 'm', g => add(new THREE.PlaneGeometry(.4, .5), mPaper, new THREE.Vector3(), [-.6, 0, .1], g));
  mk('key', 'gotKey', 'k', g => { add(new THREE.TorusGeometry(.12, .035, 4, 8), mGold, new THREE.Vector3(0, .12, 0), [0, 0, 0], g); add(new THREE.BoxGeometry(.05, .35, .05), mGold, new THREE.Vector3(0, -.12, 0), [0, 0, 0], g); add(new THREE.BoxGeometry(.12, .05, .05), mGold, new THREE.Vector3(.05, -.25, 0), [0, 0, 0], g); }, 'brazierLit');

  // ---- breakable crate shards (cheap voronoi nod: jittered sub-boxes)
  W.shatter = (from) => {
    for (const cb of W.o.crates) {
      const wp = new THREE.Vector3(); cb.getWorldPosition(wp);
      for (let i = 0; i < 6; i++) {
        const s = .18 + Math.random() * .3; const m = add(new THREE.BoxGeometry(s, s * (.5 + Math.random()), s * (.6 + Math.random() * .8)), mWood, wp.clone().add(new THREE.Vector3((Math.random() - .5) * .7, (Math.random() - .5) * .7, (Math.random() - .5) * .7)), [Math.random() * 3, Math.random() * 3, 0]);
        const dir = wp.clone().sub(from).setY(0).normalize();
        W.shards.push({ m, v: new THREE.Vector3(dir.x * (2 + Math.random() * 3) + (Math.random() - .5) * 3, 2 + Math.random() * 4, dir.z * (2 + Math.random() * 3) + (Math.random() - .5) * 3), w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0), t: 0 });
      }
    }
    W.o.crate.visible = false;
  };
  W.flags = {};
  W.update = (dt, t, flags) => {
    W.flags = flags; const k = 1 - Math.exp(-dt * 4);
    W.o.gate.position.y += ((flags.gateOpen ? 3.3 : 0) - W.o.gate.position.y) * k;
    W.o.door.rotation.y += ((flags.doorOpen ? 1.6 : 0) - W.o.door.rotation.y) * k;
    W.o.lever.rotation.x += ((flags.bridgeUp ? .7 : -.7) - W.o.lever.rotation.x) * k * 2;
    W.o.bridge.position.y += ((flags.bridgeUp ? -.125 : -2.8) - W.o.bridge.position.y) * k * .7;
    W.o.plate.position.y += ((flags.gateOpen ? .02 : .08) - W.o.plate.position.y) * k;
    W.o.plate.material.uniforms.uEmi.value.setRGB(0, flags.gateOpen ? .12 : 0, flags.gateOpen ? .2 : 0);
    if (flags.crateBroken && !W.shards.length) W.o.crate.visible = false;
    W.o.brazierFire.visible = !!flags.brazierLit;
    const fl = s => 1 + Math.sin(t * 17 + s) * .08 + Math.sin(t * 7.3 + s) * .06;
    W.o.brazierFire.scale.set(1, fl(1), 1); W.o.campFire.scale.set(1, fl(2), 1); W.flames.forEach((f, i) => f.scale.set(1, fl(i), 1));
    W.o.crystal.rotation.y += dt * (flags.cleared ? 3 : .8); W.o.crystal.position.y = 1.9 + Math.sin(t * 2) * .08;
    W.o.crystal.material.uniforms.uEmi.value.setRGB(flags.cleared ? .6 : .1, flags.cleared ? 1 : .3, flags.cleared ? 1.4 : .45);
    for (const p of W.pickups) { const vis = !flags[p.flag] && (!p.needs || flags[p.needs]); p.g.visible = vis; p.g.rotation.y += dt * 1.6; p.g.position.y = .55 + Math.sin(t * 2.4 + p.pos.x) * .08; }
    for (let i = W.shards.length - 1; i >= 0; i--) {
      const s = W.shards[i]; s.t += dt; s.v.y -= 14 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += s.w.x * dt; s.m.rotation.y += s.w.y * dt;
      if (s.m.position.y < .1) { s.m.position.y = .1; s.v.y *= -.35; s.v.x *= .6; s.v.z *= .6; s.w.multiplyScalar(.7); }
      if (s.t > 2.2) { const k2 = Math.max(0, 1 - (s.t - 2.2) / .6); s.m.scale.setScalar(k2); if (k2 <= 0) { scene.remove(s.m); W.shards.splice(i, 1); } }
    }
  };
  return W;
}
