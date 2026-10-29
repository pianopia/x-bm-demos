/** StarFight Stylized Astronaut (GLB) + PS1 skinned materials + animation clips. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { U, colTex } from '../ps1-tps-explore-rpg-2026-10-29/render.js';

export const ANIM_FPS = 30;

export const CLIP_FRAMES = {
  idle: [30, 110],
  walk: [140, 180],
  run: [210, 250],
  flip: [309, 329],
  float: [440, 580],
};

const SUIT = {
  grey: colTex('#22241b', 0.06),
  white: colTex('#f4f4f0', 0.05),
  helm: colTex('#cc7417', 0.06),
};

const NL = 8;
const LIGHT = `uniform vec3 uLP[${NL}];uniform vec3 uLC[${NL}];uniform vec3 uAmb;uniform vec3 uMoonDir;uniform vec3 uMoonC;uniform float uOutZ;
vec3 lightAt(vec3 p,vec3 n){float o=smoothstep(uOutZ-.3,uOutZ+.3,p.z);vec3 c=uAmb+uMoonC*(max(dot(n,uMoonDir),0.)+.35)*o;
 for(int i=0;i<${NL};i++){vec3 L=uLP[i]-p;float d=length(L)+1e-4;c+=uLC[i]*max(dot(n,L/d),0.)/(1.+.35*d*d);}return c;}`;

const VS = `#include <common>
#include <skinning_pars_vertex>
uniform float uPS1,uAff,uGour,uSnap;uniform vec2 uRes;uniform vec2 uRep;${LIGHT}
varying vec2 vUv;varying vec2 vUvW;varying float vW;varying vec3 vP;varying vec3 vN;varying vec3 vG;
void main(){
  #include <skinning_vertex>
  vec4 wp=modelMatrix*vec4(transformed,1.);vP=wp.xyz;vN=normalize(mat3(modelMatrix)*normal);vUv=uv*uRep;
  vec4 cp=projectionMatrix*viewMatrix*wp;
  if(uPS1>.5&&cp.w>0.){vec2 g=vec2(uSnap*uRes.x/uRes.y,uSnap)*.5;cp.xy=floor(cp.xy/cp.w*g+.5)/g*cp.w;}
  vUvW=vUv*cp.w;vW=cp.w;vG=uGour>.5&&uPS1>.5?lightAt(vP,vN):vec3(0);gl_Position=cp;
}`;
const FS = `uniform float uPS1,uAff,uGour;uniform sampler2D map;uniform vec2 uTS;uniform vec3 uEmi;uniform vec3 uFogC;uniform float uFogD;${LIGHT}
varying vec2 vUv;varying vec2 vUvW;varying float vW;varying vec3 vP;varying vec3 vN;varying vec3 vG;
void main(){vec2 uv=vUv;if(uPS1>.5){if(uAff>.5)uv=vUvW/vW;uv=(floor(uv*uTS)+.5)/uTS;}
 vec3 alb=texture2D(map,uv).rgb;vec3 lit=(uPS1>.5&&uGour>.5)?vG:lightAt(vP,normalize(vN));
 vec3 c=alb*lit+uEmi;float f=1.-exp(-length(vP-cameraPosition)*uFogD);gl_FragColor=vec4(mix(c,uFogC,f),1.);}`;

function skinMat(tex, rep = [1, 1]) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      map: { value: tex },
      uTS: { value: new THREE.Vector2(64, 64) },
      uRep: { value: new THREE.Vector2(...rep) },
      uEmi: { value: new THREE.Color(0) },
      uUseB: { value: 0 },
    },
    vertexShader: VS,
    fragmentShader: FS,
    skinning: true,
  });
}

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

function matForSlot(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('helm')) return skinMat(SUIT.helm);
  if (n.includes('white')) return skinMat(SUIT.white);
  return skinMat(SUIT.grey);
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

function bakeCanvasTex(src) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.drawImage(src.image, 0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = src.wrapS;
  t.repeat.copy(src.repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

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
  root.traverse(o => {
    if (o.isSkinnedMesh) {
      o.frustumCulled = false;
      const slots = o.material;
      const pick = m => matForSlot(m?.name || m?.userData?.name || '');
      if (Array.isArray(slots)) o.material = slots.map(pick);
      else o.material = pick(slots);
    }
  });
  root.rotation.y = Math.PI;
  root.scale.setScalar(1);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const height = box.getSize(new THREE.Vector3()).y;
  if (!height || !Number.isFinite(height)) throw new Error('astronaut.glb: invalid bounds');
  root.scale.setScalar(1.65 / height);

  const src = astro.animations[0];
  if (!src) throw new Error('astronaut.glb: no animation');
  _clips = subClips(src);
  for (const [k, c] of Object.entries(_clips)) {
    if (!c.duration) console.warn('[astro] empty clip', k);
  }
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
    if (!act) {
      console.warn('[astro] missing clip', name);
      return;
    }
    if (current === name && act.isRunning()) return;
    const prev = current ? actions[current] : null;
    act.reset().fadeIn(fade).play();
    if (prev && fade > 0) act.crossFadeFrom(prev, fade, false);
    current = name;
  };
  return {
    root,
    mixer,
    actions,
    play,
    tick(dt) { mixer.update(dt); },
    get anim() { return current; },
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
  const anim = speed > 4.5 ? 'run' : speed > 0.65 ? 'walk' : 'idle';
  rig.play(anim);
  rig.tick(dt);
}
