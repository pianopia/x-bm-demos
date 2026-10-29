// Moon arena + astronaut meshes (PS1 materials from sibling render.js)
import * as THREE from 'three';
import { U, T, M, colTex, computeBounce } from '../ps1-tps-explore-rpg-2026-10-29/render.js';

export const ARENA_R = 11.5;
export const MATCH_SEC = 90;
export const MATCH_PLAYERS = 4;

const moonTex = colTex('#9a9590', 0.18);
const regolith = colTex('#848078', 0.22);
const suitW = colTex('#f2f0ea', 0.06);
const suitA = colTex('#d4b892', 0.08);
const visor = colTex('#2a4868', 0.04);
const flagR = colTex('#b23a2e', 0.12);

export function buildArena(scene) {
  const solids = [];
  const g = new THREE.Group();
  g.name = 'arena';
  scene.add(g);

  // starfield (subtle — arena is on the surface)
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
      Array.from({ length: 400 }, () => [(Math.random() - 0.5) * 400, 40 + Math.random() * 120, (Math.random() - 0.5) * 400]).flat(), 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, sizeAttenuation: true, transparent: true, opacity: 0.55 }),
  );
  scene.add(stars);

  // landing disk — low poly with craters
  const seg = 32, rings = 8;
  const geo = new THREE.CircleGeometry(ARENA_R, seg, 0, Math.PI * 2);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z) / ARENA_R;
    if (r < 0.02) { pos.setY(i, 0); continue; }
    const crater = Math.sin(v.x * 0.9 + 2) * Math.cos(v.z * 0.7 - 1) * 0.35;
    const noise = (Math.sin(v.x * 3.1) + Math.cos(v.z * 2.7)) * 0.08;
    const edge = THREE.MathUtils.smoothstep(r, 0.75, 1) * -0.9;
    pos.setY(i, crater * (1 - r) + noise + edge);
  }
  geo.computeVertexNormals();
  const disk = new THREE.Mesh(geo, M(moonTex, [4, 4]));
  disk.userData.alb = moonTex; solids.push(disk);
  g.add(disk);

  // rim rocks
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    const s = 0.5 + (i % 5) * 0.12;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M(regolith, [1, 1]));
    rock.position.set(Math.cos(a) * (ARENA_R + 0.3), s * 0.35 - 0.2, Math.sin(a) * (ARENA_R + 0.3));
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    solids.push(rock);
    g.add(rock);
  }

  // flag for flavor
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), M(regolith));
  pole.position.set(-2, 1.1, 1.5);
  g.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55, 2, 1), M(flagR, [1, 1]));
  cloth.position.set(-1.55, 1.85, 1.5);
  cloth.rotation.y = 0.4;
  g.add(cloth);

  U.uMoonDir.value.set(-0.45, 0.85, 0.35).normalize();
  U.uMoonC.value.set(0.52, 0.55, 0.68);
  U.uAmb.value.set(0.075, 0.078, 0.095);
  U.uFogC.value.set(0.12, 0.13, 0.16);
  U.uOutZ.value = 80;
  U.uFogD.value = 0.014;

  const lights = [
    { pos: new THREE.Vector3(-6, 14, -4), col: new THREE.Vector3(2.8, 2.6, 2.1) },
    { pos: new THREE.Vector3(8, 10, 6), col: new THREE.Vector3(0.65, 0.8, 1.35) },
    { pos: new THREE.Vector3(0, 18, 2), col: new THREE.Vector3(1.1, 1.15, 1.25) },
  ];
  lights.forEach((L, i) => { U.uLP.value[i].copy(L.pos); U.uLC.value[i].copy(L.col); });
  computeBounce(lights, solids);

  return { group: g, solids, disk };
}

/** Matchmaking scene: astronauts float in space; destination moon looms ahead (not the arena yet). */
export function buildLobbySpace(scene) {
  const g = new THREE.Group();
  g.name = 'lobbySpace';
  scene.add(g);

  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
      Array.from({ length: 1200 }, () => [(Math.random() - 0.5) * 500, (Math.random() - 0.5) * 280, (Math.random() - 0.5) * 500]).flat(), 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, sizeAttenuation: true, transparent: true, opacity: 0.9 }),
  );
  scene.add(stars);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 12), M(regolith, [2, 2]));
  moon.position.set(0, -6, -38);
  moon.scale.setScalar(2.2);
  g.add(moon);

  const floaters = [];
  for (let i = 0; i < MATCH_PLAYERS; i++) {
    const astro = makeAstronaut(i);
    const base = new THREE.Vector3(Math.cos(i * 1.57) * 2.6, 0.75 + (i % 2) * 0.2, Math.sin(i * 1.57) * 2.0);
    astro.position.copy(base);
    g.add(astro);
    floaters.push({ g: astro, base, ph: i * 2.1, oy: i * 0.9 });
  }

  U.uMoonDir.value.set(0.2, 0.5, -0.85).normalize();
  U.uMoonC.value.set(0.28, 0.32, 0.48);
  U.uAmb.value.set(0.055, 0.058, 0.075);
  U.uFogC.value.set(0.08, 0.09, 0.12);
  U.uFogD.value = 0.006;
  U.uLP.value[0].set(-4, 6, 8);
  U.uLC.value[0].set(2.0, 1.9, 1.65);
  U.uLP.value[1].set(6, 3, -6);
  U.uLC.value[1].set(0.45, 0.55, 1.15);
  U.uLP.value[2].set(0, 12, 4);
  U.uLC.value[2].set(0.9, 0.95, 1.05);
  U.uNV.value = 0;

  return { group: g, floaters, moon };
}

export function tickLobbyFloat(floaters, t) {
  for (const f of floaters) {
    const bob = Math.sin(t * 1.05 + f.ph) * 0.42 + Math.sin(t * 2.05 + f.oy) * 0.14;
    f.g.position.y = f.base.y + bob;
    f.g.position.x = f.base.x + Math.sin(t * 0.35 + f.ph) * 0.22;
    f.g.position.z = f.base.z + Math.cos(t * 0.28 + f.oy) * 0.12;
    f.g.rotation.y = t * 0.12 + f.ph;
    f.g.rotation.x = Math.sin(t * 0.65 + f.ph) * 0.12;
    f.g.rotation.z = Math.sin(t * 0.9 + f.oy) * 0.1;
  }
}

const PAL = [0xc4a882, 0x88a8c4, 0xa8c488, 0xc488a8, 0xc4c088];

export function makeAstronaut(colorIdx = 0) {
  const root = new THREE.Group();
  const accent = PAL[colorIdx % PAL.length];
  const mSuit = M(suitW);
  const mSuitD = M(suitA);
  const mAcc = M(colTex('#' + accent.toString(16).padStart(6, '0'), 0.06));
  const mVis = M(visor);
  const mVisSh = M(colTex('#6a8aa8', 0.05));
  const mBoot = M(colTex('#2e2a26', 0.12));
  const mGlove = M(colTex('#4a4540', 0.1));
  const mPack = M(colTex('#5a5650', 0.08));
  const mTank = M(colTex('#7a9098', 0.06));
  const mGold = M(colTex('#c8a040', 0.07));
  const add = (geo, mat, p, r = [0, 0, 0], parent = root) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...p);
    mesh.rotation.set(...r);
    parent.add(mesh);
    return mesh;
  };

  // legs + boots
  add(new THREE.BoxGeometry(0.16, 0.34, 0.16), mSuitD, [-0.1, 0.52, 0]);
  add(new THREE.BoxGeometry(0.16, 0.34, 0.16), mSuitD, [0.1, 0.52, 0]);
  add(new THREE.BoxGeometry(0.18, 0.14, 0.26), mBoot, [-0.1, 0.26, 0.04]);
  add(new THREE.BoxGeometry(0.18, 0.14, 0.26), mBoot, [0.1, 0.26, 0.04]);

  // torso + chest stripe
  add(new THREE.CylinderGeometry(0.24, 0.3, 0.62, 8, 1), mSuit, [0, 0.92, 0]);
  add(new THREE.BoxGeometry(0.22, 0.36, 0.08), mAcc, [0, 0.95, 0.16]);
  add(new THREE.BoxGeometry(0.34, 0.08, 0.06), mGold, [0, 1.08, 0.17]);

  // PLSS backpack + O2 tank
  add(new THREE.BoxGeometry(0.46, 0.52, 0.2), mPack, [0, 0.95, -0.2]);
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.38, 6), mTank, [0.14, 1.02, -0.28], [0.15, 0, 0]);
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 6), mGold, [0.14, 1.24, -0.28]);

  // arms (upper suit + gloves)
  add(new THREE.BoxGeometry(0.12, 0.28, 0.12), mSuit, [-0.34, 0.98, 0], [0, 0, 0.35]);
  add(new THREE.BoxGeometry(0.12, 0.28, 0.12), mSuit, [0.34, 0.98, 0], [0, 0, -0.35]);
  add(new THREE.BoxGeometry(0.14, 0.14, 0.14), mGlove, [-0.42, 0.82, 0.06], [0, 0, 0.35]);
  add(new THREE.BoxGeometry(0.14, 0.14, 0.14), mGlove, [0.42, 0.82, 0.06], [0, 0, -0.35]);

  // shoulders
  add(new THREE.SphereGeometry(0.11, 6, 5), mSuitD, [-0.26, 1.12, 0]);
  add(new THREE.SphereGeometry(0.11, 6, 5), mSuitD, [0.26, 1.12, 0]);

  // helmet shell + gold visor ring + glass
  add(new THREE.SphereGeometry(0.27, 8, 7), mSuit, [0, 1.42, 0]);
  add(new THREE.TorusGeometry(0.21, 0.035, 5, 10, Math.PI * 1.05), mGold, [0, 1.4, 0.08], [0.35, 0, 0]);
  add(new THREE.BoxGeometry(0.36, 0.2, 0.1), mVis, [0, 1.4, 0.2]);
  add(new THREE.BoxGeometry(0.32, 0.08, 0.06), mVisSh, [0, 1.52, 0.19]);

  root.userData.colorIdx = colorIdx;
  return root;
}

export function fellOff(x, z) {
  return Math.hypot(x, z) > ARENA_R - 0.35;
}
