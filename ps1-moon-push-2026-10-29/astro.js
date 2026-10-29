/** StarFight Stylized Astronaut (GLB) — Lambert materials (PS1 look via low-res RT blit). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const ANIM_FPS = 30;

export const CLIP_FRAMES = {
  idle: [30, 110],
  walk: [140, 180],
  run: [210, 250],
  flip: [309, 329],
  float: [440, 580],
};

const SLOT_COLOR = {
  grey: 0x22241b,
  white: 0xf4f4f0,
  helm: 0xcc7417,
};

function url(rel) {
  return new URL(rel, import.meta.url).href;
}

function loadImgTex(path, rep = [1, 1]) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url(path),
      t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.SRGBColorSpace;
        t.minFilter = t.magFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        t.repeat.set(rep[0], rep[1]);
        resolve(t);
      },
      undefined,
      reject,
    );
  });
}

function bakeCanvasTex(src) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  c.getContext('2d').drawImage(src.image, 0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = src.wrapS;
  t.repeat.copy(src.repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

function slotColor(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('helm')) return SLOT_COLOR.helm;
  if (n.includes('white')) return SLOT_COLOR.white;
  return SLOT_COLOR.grey;
}

function astroMat(name) {
  return new THREE.MeshLambertMaterial({
    color: slotColor(name),
    flatShading: true,
  });
}

function applySkinnedMaterials(root) {
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    o.frustumCulled = false;
    const slots = o.material;
    const pick = m => astroMat(m?.name);
    if (Array.isArray(slots)) o.material = slots.map(pick);
    else o.material = pick(slots);
  });
}

function poseSkeleton(root) {
  root.traverse(o => {
    if (o.isSkinnedMesh?.skeleton) o.skeleton.update();
  });
  root.updateMatrixWorld(true);
}

function subClips(source) {
  const out = {};
  for (const [name, [a, b]] of Object.entries(CLIP_FRAMES)) {
    out[name] = THREE.AnimationUtils.subclip(source, name, a, b, ANIM_FPS);
  }
  return out;
}

let _template = null;
let _clips = null;
let _rocksTemplate = null;
let _tex = null;

export async function loadStarfightAssets() {
  if (_template) return { template: _template, clips: _clips, rocks: _rocksTemplate, tex: _tex };
  const raw = await Promise.all([
    loadImgTex('./assets/lunar/Ground_00_D_512.png', [4, 4]),
    loadImgTex('./assets/lunar/Ground_01_D_512.png', [2, 2]),
    loadImgTex('./assets/lunar/Milkyway.png', [1, 1]),
    loadImgTex('./assets/lunar/stars_alpha.png', [2, 2]),
  ]);
  _tex = {
    ground0: bakeCanvasTex(raw[0]),
    ground1: bakeCanvasTex(raw[1]),
    milky: bakeCanvasTex(raw[2]),
    stars: bakeCanvasTex(raw[3]),
  };
  const loader = new GLTFLoader();
  const [astro, rocks] = await Promise.all([
    loader.loadAsync(url('./assets/astronaut.glb')),
    loader.loadAsync(url('./assets/rocks.glb')),
  ]);
  const root = astro.scene;
  applySkinnedMaterials(root);
  root.rotation.y = Math.PI;
  root.scale.setScalar(1);
  poseSkeleton(root);
  const box = new THREE.Box3().setFromObject(root);
  const height = box.getSize(new THREE.Vector3()).y;
  root.scale.setScalar(height > 1e-4 ? 1.65 / height : 0.0165);
  poseSkeleton(root);

  const src = astro.animations[0];
  if (!src) throw new Error('astronaut.glb: no animation');
  _clips = subClips(src);
  _template = root;
  _rocksTemplate = rocks.scene;
  return { template: _template, clips: _clips, rocks: _rocksTemplate, tex: _tex };
}

export function spawnAstronaut(template, clips) {
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(template);
  root.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [name, clip] of Object.entries(clips)) {
    const act = mixer.clipAction(clip);
    act.setLoop(name === 'flip' ? THREE.LoopOnce : THREE.LoopRepeat, name === 'flip' ? 1 : Infinity);
    if (name === 'flip') act.clampWhenFinished = true;
    actions[name] = act;
  }
  let current = '';
  const play = (name, fade = 0.2) => {
    const act = actions[name];
    if (!act) return;
    if (current === name && act.isRunning()) return;
    const prev = current ? actions[current] : null;
    act.reset().fadeIn(fade).play();
    if (prev && fade > 0) act.crossFadeFrom(prev, fade, false);
    current = name;
    mixer.update(0);
  };
  return {
    root,
    mixer,
    actions,
    play,
    tick(dt) { mixer.update(dt); },
  };
}

export function playPushFlip(rig) {
  if (!rig?.actions?.flip) return;
  rig.play('flip', 0.08);
  rig._pushUntil = performance.now() + 420;
}

export function updateArenaAnim(rig, speed, dt) {
  if (!rig) return;
  if (rig._pushUntil && performance.now() < rig._pushUntil) {
    rig.tick(dt);
    return;
  }
  rig._pushUntil = 0;
  rig.play(speed > 4.5 ? 'run' : speed > 0.65 ? 'walk' : 'idle');
  rig.tick(dt);
}
