// Moon arena + StarFight lunar look (PS1 materials from sibling render.js)
import * as THREE from 'three';
import { U, M, colTex, computeBounce } from '../ps1-tps-explore-rpg-2026-10-29/render.js';

export const ARENA_R = 11.5;
export const MATCH_SEC = 90;
export const MATCH_PLAYERS = 4;

const flagR = colTex('#b23a2e', 0.12);

function addSky(scene, tex, fogC) {
  const geo = new THREE.SphereGeometry(120, 24, 16);
  geo.scale(-1, 1, 1);
  const milky = new THREE.Mesh(geo, M(tex.milky, [1, 1]));
  milky.frustumCulled = false;
  scene.add(milky);
  const starsGeo = new THREE.SphereGeometry(118, 32, 20);
  starsGeo.scale(-1, 1, 1);
  const stars = new THREE.Mesh(starsGeo, M(tex.stars, [2, 2]));
  stars.material.transparent = true;
  stars.material.depthWrite = false;
  stars.frustumCulled = false;
  scene.add(stars);
  U.uFogC.value.copy(fogC);
}

export function buildArena(scene, tex, rocksTemplate) {
  const solids = [];
  const g = new THREE.Group();
  g.name = 'arena';
  scene.add(g);

  addSky(scene, tex, new THREE.Vector3(0.06, 0.065, 0.09));
  scene.background = new THREE.Color(0.02, 0.025, 0.04);
  scene.fog = new THREE.FogExp2(0x080a12, 0.008);

  const seg = 32;
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
  const disk = new THREE.Mesh(geo, M(tex.ground0, [5, 5]));
  disk.userData.alb = disk.material.userData.alb;
  solids.push(disk);
  g.add(disk);

  if (rocksTemplate) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.15;
      const rock = rocksTemplate.clone(true);
      rock.scale.setScalar(0.008 + (i % 3) * 0.002);
      rock.position.set(Math.cos(a) * (ARENA_R + 0.5), -0.05, Math.sin(a) * (ARENA_R + 0.5));
      rock.rotation.set(0.2, a + 1, 0.1);
      rock.traverse(o => {
        if (o.isMesh) {
          o.material = M(tex.ground1, [1, 1]);
          solids.push(o);
        }
      });
      g.add(rock);
    }
  }

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), M(tex.ground1, [1, 1]));
  pole.position.set(-2, 1.1, 1.5);
  g.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55, 2, 1), M(flagR, [1, 1]));
  cloth.position.set(-1.55, 1.85, 1.5);
  cloth.rotation.y = 0.4;
  g.add(cloth);

  U.uMoonDir.value.set(-0.45, 0.85, 0.35).normalize();
  U.uMoonC.value.set(0.62, 0.58, 0.72);
  U.uAmb.value.set(0.06, 0.062, 0.08);
  U.uOutZ.value = 80;
  U.uFogD.value = 0.011;

  const lights = [
    { pos: new THREE.Vector3(-6, 14, -4), col: new THREE.Vector3(2.8, 2.6, 2.1) },
    { pos: new THREE.Vector3(8, 10, 6), col: new THREE.Vector3(0.65, 0.8, 1.35) },
    { pos: new THREE.Vector3(0, 18, 2), col: new THREE.Vector3(1.1, 1.15, 1.25) },
  ];
  lights.forEach((L, i) => { U.uLP.value[i].copy(L.pos); U.uLC.value[i].copy(L.col); });
  computeBounce(lights, solids);

  return { group: g, solids, disk };
}

/** Matchmaking / title: astronauts float in space; moon ahead (StarFight-style sky). */
export function buildLobbySpace(scene, tex) {
  const g = new THREE.Group();
  g.name = 'lobbySpace';
  scene.add(g);

  addSky(scene, tex, new THREE.Vector3(0.05, 0.055, 0.08));
  scene.background = new THREE.Color(0.015, 0.02, 0.035);
  scene.fog = new THREE.FogExp2(0x060810, 0.004);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 14), M(tex.ground0, [2, 2]));
  moon.position.set(0, -4, -42);
  moon.scale.setScalar(2.4);
  g.add(moon);

  const floaters = [];
  for (let i = 0; i < MATCH_PLAYERS; i++) {
    const base = new THREE.Vector3(Math.cos(i * 1.57) * 2.4, 0.2 + (i % 2) * 0.15, Math.sin(i * 1.57) * 1.8);
    floaters.push({ g: null, base, ph: i * 2.1, oy: i * 0.9, rig: null });
  }

  U.uMoonDir.value.set(0.15, 0.45, -0.88).normalize();
  U.uMoonC.value.set(0.35, 0.38, 0.55);
  U.uAmb.value.set(0.045, 0.048, 0.065);
  U.uFogD.value = 0.005;
  U.uLP.value[0].set(-4, 6, 8);
  U.uLC.value[0].set(2.0, 1.9, 1.65);
  U.uLP.value[1].set(6, 3, -6);
  U.uLC.value[1].set(0.45, 0.55, 1.15);
  U.uLP.value[2].set(0, 12, 4);
  U.uLC.value[2].set(0.9, 0.95, 1.05);
  U.uNV.value = 0;

  return { group: g, floaters, moon };
}

export function attachLobbyFloaters(floaters, group, spawnFn) {
  for (let i = 0; i < floaters.length; i++) {
    const f = floaters[i];
    const rig = spawnFn(i);
    f.rig = rig;
    f.g = rig.root;
    f.g.position.copy(f.base);
    group.add(f.g);
    rig.play('float', 0);
    rig.mixer.update(0);
  }
}

export function tickLobbyFloat(floaters, t, dt) {
  for (const f of floaters) {
    if (!f.g) continue;
    const bob = Math.sin(t * 1.05 + f.ph) * 0.28 + Math.sin(t * 2.05 + f.oy) * 0.1;
    f.g.position.y = f.base.y + bob;
    f.g.position.x = f.base.x + Math.sin(t * 0.35 + f.ph) * 0.18;
    f.g.position.z = f.base.z + Math.cos(t * 0.28 + f.oy) * 0.1;
    f.g.rotation.y = t * 0.08 + f.ph;
    if (f.rig) f.rig.tick(dt);
  }
}

export function fellOff(x, z) {
  return Math.hypot(x, z) > ARENA_R - 0.35;
}
