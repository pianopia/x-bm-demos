// PS1 look: low-res RT + vertex snap + affine UV + dither + 15bit color + optional fake 1-bounce (VPL)
// Adapted from ../ps1-radiance-lite-2026-10-29/
import * as THREE from 'three';
export const NL = 8, NV = 48;
const v3 = () => new THREE.Vector3();
export const U = {
  uPS1: { value: 1 }, uAff: { value: 1 }, uGour: { value: 1 }, uSnap: { value: 150 }, uBounce: { value: 1 },
  uRes: { value: new THREE.Vector2(320, 240) },
  uLP: { value: Array.from({ length: NL }, v3) }, uLC: { value: Array.from({ length: NL }, v3) },
  uVP: { value: Array.from({ length: NV }, v3) }, uVN: { value: Array.from({ length: NV }, v3) }, uVC: { value: Array.from({ length: NV }, v3) },
  uNV: { value: 0 }, uAmb: { value: new THREE.Vector3(.03, .032, .042) },
  uMoonDir: { value: new THREE.Vector3(-.4, .8, .35).normalize() }, uMoonC: { value: new THREE.Vector3(.2, .25, .4) }, uOutZ: { value: 21.3 },
  uFogC: { value: new THREE.Vector3(.05, .055, .075) }, uFogD: { value: .075 },
};
const LIGHT = `uniform vec3 uLP[${NL}];uniform vec3 uLC[${NL}];uniform vec3 uVP[${NV}];uniform vec3 uVN[${NV}];uniform vec3 uVC[${NV}];uniform int uNV;uniform float uBounce;uniform vec3 uAmb;uniform vec3 uMoonDir;uniform vec3 uMoonC;uniform float uOutZ;
vec3 lightAt(vec3 p,vec3 n,float useB){float o=smoothstep(uOutZ-.3,uOutZ+.3,p.z);vec3 c=uAmb+uMoonC*(max(dot(n,uMoonDir),0.)+.35)*o;
 for(int i=0;i<${NL};i++){vec3 L=uLP[i]-p;float d=length(L)+1e-4;c+=uLC[i]*max(dot(n,L/d),0.)/(1.+.35*d*d);}
 if(useB>0.){vec3 b=vec3(0);for(int j=0;j<${NV};j++){if(j>=uNV)break;vec3 L=uVP[j]-p;float d2=dot(L,L)+.25;vec3 l=L*inversesqrt(d2);b+=uVC[j]*max(dot(n,l),0.)*max(dot(uVN[j],-l),0.)/d2;}c+=b*uBounce*useB;}return c;}`;
const VS = `uniform float uPS1,uAff,uGour,uSnap;uniform vec2 uRes;uniform float uUseB;${LIGHT}
varying vec2 vUv;varying vec2 vUvW;varying float vW;varying vec3 vP;varying vec3 vN;varying vec3 vG;uniform vec2 uRep;
void main(){vec4 wp=modelMatrix*vec4(position,1.);vP=wp.xyz;vN=normalize(mat3(modelMatrix)*normal);vUv=uv*uRep;
 vec4 cp=projectionMatrix*viewMatrix*wp;
 if(uPS1>.5&&cp.w>0.){vec2 g=vec2(uSnap*uRes.x/uRes.y,uSnap)*.5;cp.xy=floor(cp.xy/cp.w*g+.5)/g*cp.w;}
 vUvW=vUv*cp.w;vW=cp.w;vG=uGour>.5&&uPS1>.5?lightAt(vP,vN,uUseB):vec3(0);gl_Position=cp;}`;
const FS = `uniform float uPS1,uAff,uGour;uniform sampler2D map;uniform vec2 uTS;uniform vec3 uEmi;uniform float uUseB;uniform vec3 uFogC;uniform float uFogD;${LIGHT}
varying vec2 vUv;varying vec2 vUvW;varying float vW;varying vec3 vP;varying vec3 vN;varying vec3 vG;
void main(){vec2 uv=vUv;if(uPS1>.5){if(uAff>.5)uv=vUvW/vW;uv=(floor(uv*uTS)+.5)/uTS;}
 vec3 alb=texture2D(map,uv).rgb;vec3 lit=(uPS1>.5&&uGour>.5)?vG:lightAt(vP,normalize(vN),uUseB);
 vec3 c=alb*lit+uEmi;float f=1.-exp(-length(vP-cameraPosition)*uFogD);gl_FragColor=vec4(mix(c,uFogC,f),1.);}`;

// ---- procedural textures (64px, PS1-ish)
export function tex(draw, n = 64) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d', { willReadFrequently: true }); draw(g, n);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}
const noise = (g, n, a) => { for (let i = 0; i < n * n / 3; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? 0 : 255},${Math.random() < .5 ? 0 : 255},0,${a * Math.random()})`; g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 1, 1); } };
export const colTex = (hex, a = .12) => tex((g, n) => { g.fillStyle = hex; g.fillRect(0, 0, n, n); noise(g, n, a); });
export const T = {
  brick: tex((g, n) => { g.fillStyle = '#5e4436'; g.fillRect(0, 0, n, n); g.fillStyle = '#8d6450'; for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) g.fillRect(x * 16 + (y % 2) * 8 + 1, y * 8 + 1, 14, 6); g.fillStyle = '#3d5a3388'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * n | 0, 40 + Math.random() * 24 | 0, 3, 2); noise(g, n, .18); }),
  floor: tex((g, n) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#5d5a53' : '#7b766b'; g.fillRect(x * 32, y * 32, 32, 32); } g.strokeStyle = '#2c2a26'; g.strokeRect(0, 0, n, n); noise(g, n, .2); }),
  cobble: tex((g, n) => { g.fillStyle = '#3a3c3a'; g.fillRect(0, 0, n, n); for (let i = 0; i < 22; i++) { g.fillStyle = ['#646a64', '#575c55', '#6e6a60', '#4f5a48'][i % 4]; const x = Math.random() * n, y = Math.random() * n, r = 5 + Math.random() * 6; g.beginPath(); g.ellipse(x, y, r, r * .8, 0, 0, 7); g.fill(); } noise(g, n, .2); }),
  wood: tex((g, n) => { g.fillStyle = '#7a5230'; g.fillRect(0, 0, n, n); g.fillStyle = '#4f331a'; for (let i = 0; i < n; i += 16) g.fillRect(0, i, n, 2); g.fillRect(0, 0, 3, n); g.fillRect(n - 3, 0, 3, n); g.fillRect(0, 0, n, 3); g.fillRect(0, n - 3, n, 3); noise(g, n, .15); }),
  plank: tex((g, n) => { g.fillStyle = '#6b4a2c'; g.fillRect(0, 0, n, n); g.fillStyle = '#3b2814'; for (let i = 0; i < n; i += 13) g.fillRect(i, 0, 2, n); noise(g, n, .18); }),
  plaster: tex((g, n) => { g.fillStyle = '#4a4540'; g.fillRect(0, 0, n, n); g.fillStyle = '#2e2a26'; for (let i = 0; i < n; i += 16) g.fillRect(0, i, n, 3); noise(g, n, .12); }),
  iron: tex((g, n) => { g.fillStyle = '#3c4044'; g.fillRect(0, 0, n, n); g.fillStyle = '#6a5038'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 4, 3); noise(g, n, .2); }),
  door: tex((g, n) => { g.fillStyle = '#5a3a20'; g.fillRect(0, 0, n, n); g.fillStyle = '#2f1d0e'; for (let i = 0; i < n; i += 10) g.fillRect(i, 0, 2, n); g.fillStyle = '#4b5056'; g.fillRect(0, 10, n, 6); g.fillRect(0, 48, n, 6); g.fillStyle = '#c9a54a'; g.fillRect(44, 28, 6, 8); noise(g, n, .12); }),
  stone: tex((g, n) => { g.fillStyle = '#6e6b66'; g.fillRect(0, 0, n, n); g.strokeStyle = '#3e3c39'; g.strokeRect(2, 2, n - 4, n - 4); noise(g, n, .25); }),
  rune: tex((g, n) => { g.fillStyle = '#5c5a56'; g.fillRect(0, 0, n, n); g.strokeStyle = '#8fd8ff'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 18, 0, 7); g.moveTo(32, 10); g.lineTo(32, 54); g.moveTo(14, 32); g.lineTo(50, 32); g.stroke(); noise(g, n, .2); }),
  red: tex((g, n) => { g.fillStyle = '#8e2a22'; g.fillRect(0, 0, n, n); g.fillStyle = '#c9a050'; g.fillRect(0, 6, n, 5); g.fillRect(28, 20, 8, 30); noise(g, n, .12); }),
  cloak: colTex('#2f6f72'), skin: colTex('#d9a37b', .05), robe: colTex('#5b4632'), hood: colTex('#3a2d22'),
  slime: tex((g, n) => { g.fillStyle = '#4fae4a'; g.fillRect(0, 0, n, n); g.fillStyle = '#122'; g.fillRect(18, 22, 7, 9); g.fillRect(39, 22, 7, 9); g.fillStyle = '#9fe08a'; g.fillRect(10, 8, 10, 4); noise(g, n, .1); }),
  dark: colTex('#0e0d0c', .1), flame: colTex('#ffb347', .0), blue: colTex('#7fd0ff', .05), paper: colTex('#d8cfa8', .1),
  gold: colTex('#c9a54a', .15), green: colTex('#4f8a3a', .15), leaf: colTex('#2f4a2a', .2),
};

export const mats = [];
export function M(t, rep = [1, 1], emi = 0x000000) {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...U, map: { value: t }, uTS: { value: new THREE.Vector2(64, 64) }, uRep: { value: new THREE.Vector2(...rep) }, uEmi: { value: new THREE.Color(emi) }, uUseB: { value: 1 } },
    vertexShader: VS, fragmentShader: FS,
  });
  m.userData.alb = avg(t); mats.push(m); return m;
}
export function avg(t) {
  const g = t.image.getContext('2d').getImageData(0, 0, 64, 64).data; const c = [0, 0, 0];
  for (let i = 0; i < g.length; i += 4) { c[0] += g[i]; c[1] += g[i + 1]; c[2] += g[i + 2]; }
  return new THREE.Color().setRGB(...c.map(v => v / (g.length / 4) / 255), THREE.SRGBColorSpace);
}

// ---- fake bounce: rays from static lights -> VPLs (recomputed only when lights change)
export function computeBounce(lights, meshes) {
  const ray = new THREE.Raycaster(); ray.far = 16;
  const act = lights.filter(l => l.col.lengthSq() > 0.01); const per = Math.max(1, Math.floor(NV / Math.max(1, act.length)));
  const dirs = []; for (let i = 0; i < per; i++) { const y = 1 - 2 * (i + .5) / per, r = Math.sqrt(1 - y * y), a = i * 2.39996; dirs.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  let k = 0;
  for (const L of act) for (const d of dirs) {
    if (k >= NV) break; ray.set(L.pos, d); const h = ray.intersectObjects(meshes, false)[0]; if (!h || !h.face) continue;
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    const lam = Math.max(n.dot(d.clone().negate()), 0) / (1 + .35 * h.distance * h.distance);
    const a = h.object.material.userData.alb || new THREE.Color(.5, .5, .5); const flux = 4 * Math.PI / per * 1.5;
    U.uVP.value[k].copy(h.point).addScaledVector(n, .05); U.uVN.value[k].copy(n);
    U.uVC.value[k].set(L.col.x * a.r * lam * flux, L.col.y * a.g * lam * flux, L.col.z * a.b * lam * flux); k++;
  }
  U.uNV.value = k;
}

// ---- render pipeline (low-res RT -> dither/tonemap composite)
export function createPipeline(R) {
  let rtLow, rtClean, resH = 240;
  const post = new THREE.ShaderMaterial({
    uniforms: { tLow: { value: null }, uMode: { value: 1 }, uDith: { value: 1 }, uLowRes: { value: new THREE.Vector2() }, uFade: { value: 0 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform sampler2D tLow;uniform float uMode,uDith,uFade;uniform vec2 uLowRes;varying vec2 vUv;
 float bayer(vec2 p){ivec2 q=ivec2(mod(p,4.));int m[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);return float(m[q.y*4+q.x])/16.-.5;}
 vec3 tm(vec3 c){c=c/(1.+c*.6);return pow(clamp(c,0.,1.),vec3(1./2.2));}
 void main(){vec3 c=tm(texture2D(tLow,vUv).rgb);
  if(uMode>.5&&uDith>.5){vec2 px=floor(vUv*uLowRes);c=floor(c*31.+bayer(px)+.5)/31.;}
  vec2 q=vUv-.5;c*=1.-dot(q,q)*.7;c=mix(c,vec3(0),uFade);gl_FragColor=vec4(c,1.);}`,
  });
  const PS = new THREE.Scene(); PS.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post)); const PC = new THREE.Camera();
  function resize() {
    const h = resH, w = Math.round(h * innerWidth / innerHeight); rtLow?.dispose(); rtClean?.dispose();
    rtLow = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.HalfFloatType });
    rtClean = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
    U.uRes.value.set(w, h);
  }
  function setPass(ps1, useB) { U.uPS1.value = ps1; for (const m of mats) m.uniforms.uUseB.value = useB; }
  // mode: 'ps1b' | 'ps1' | 'clean'
  function render(S, cam, mode, fade = 0) {
    const low = mode !== 'clean';
    setPass(low ? 1 : 0, mode === 'ps1' ? 0 : 1);
    const rt = low ? rtLow : rtClean;
    post.uniforms.tLow.value = null;
    R.setRenderTarget(rt);
    R.render(S, cam);
    post.uniforms.tLow.value = rt.texture;
    post.uniforms.uMode.value = low ? 1 : 0;
    post.uniforms.uLowRes.value.copy(U.uRes.value);
    post.uniforms.uFade.value = fade;
    R.setRenderTarget(null);
    R.render(PS, PC);
  }
  resize();
  return { resize, render, setRes(h) { resH = h; resize(); } };
}
