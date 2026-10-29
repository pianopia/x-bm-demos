// Moon arena + astronaut meshes (PS1 materials from sibling render.js)
import * as THREE from 'three';
import { U, T, M, colTex, computeBounce } from '../ps1-tps-explore-rpg-2026-10-29/render.js';

export const ARENA_R = 11.5;
export const MATCH_SEC = 90;

const moonTex = colTex('#6a6660', 0.22);
const regolith = colTex('#5a5752', 0.28);
const suitW = colTex('#e8e6e0', 0.08);
const suitA = colTex('#c4a882', 0.1);
const visor = colTex('#1a3048', 0.05);
const flagR = colTex('#b23a2e', 0.12);

export function buildArena(scene) {
  const solids = [];
  const g = new THREE.Group();
  scene.add(g);

  // starfield
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
      Array.from({ length: 800 }, () => [(Math.random() - 0.5) * 400, 20 + Math.random() * 180, (Math.random() - 0.5) * 400]).flat(), 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.85 }),
  );
  scene.add(stars);

  // distant moon sphere (backdrop)
  const farMoon = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 10), M(regolith, [1, 1]));
  farMoon.position.set(-38, 42, -55);
  g.add(farMoon);

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
  U.uMoonC.value.set(0.35, 0.38, 0.55);
  U.uAmb.value.set(0.04, 0.042, 0.055);
  U.uOutZ.value = 80;
  U.uFogD.value = 0.028;

  const lights = [
    { pos: new THREE.Vector3(-6, 14, -4), col: new THREE.Vector3(2.2, 2.0, 1.6) },
    { pos: new THREE.Vector3(8, 10, 6), col: new THREE.Vector3(0.4, 0.55, 1.1) },
  ];
  lights.forEach((L, i) => { U.uLP.value[i].copy(L.pos); U.uLC.value[i].copy(L.col); });
  computeBounce(lights, solids);

  return { group: g, solids, disk };
}

const PAL = [0xc4a882, 0x88a8c4, 0xa8c488, 0xc488a8, 0xc4c088];

export function makeAstronaut(colorIdx = 0) {
  const root = new THREE.Group();
  const accent = PAL[colorIdx % PAL.length];
  const mSuit = M(suitW);
  const mAcc = M(colTex('#' + accent.toString(16).padStart(6, '0'), 0.06));
  const mVis = M(visor);
  const mBoot = M(colTex('#3a3632', 0.1));
  const add = (geo, mat, p, r = [0, 0, 0], parent = root) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...p);
    mesh.rotation.set(...r);
    parent.add(mesh);
    return mesh;
  };
  add(new THREE.CylinderGeometry(0.22, 0.28, 0.75, 7, 1), mSuit, [0, 0.78, 0]);
  add(new THREE.SphereGeometry(0.24, 8, 6), mSuit, [0, 1.32, 0]);
  add(new THREE.SphereGeometry(0.26, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mAcc, [0, 1.34, -0.02]);
  add(new THREE.BoxGeometry(0.38, 0.14, 0.12), mVis, [0, 1.32, 0.18]);
  add(new THREE.BoxGeometry(0.14, 0.38, 0.14), mBoot, [-0.11, 0.22, 0]);
  add(new THREE.BoxGeometry(0.14, 0.38, 0.14), mBoot, [0.11, 0.22, 0]);
  add(new THREE.BoxGeometry(0.12, 0.32, 0.12), mAcc, [-0.32, 0.95, 0], [0, 0, 0.25]);
  add(new THREE.BoxGeometry(0.12, 0.32, 0.12), mAcc, [0.32, 0.95, 0], [0, 0, -0.25]);
  add(new THREE.BoxGeometry(0.42, 0.12, 0.22), mSuit, [0, 1.05, -0.22]);
  root.userData.colorIdx = colorIdx;
  return root;
}

export function fellOff(x, z) {
  return Math.hypot(x, z) > ARENA_R - 0.35;
}
