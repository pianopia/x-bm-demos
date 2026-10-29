// PS1 look: low-res RT + vertex snap + affine UV + dither + 15bit color + optional fake 1-bounce (VPL)
import * as THREE from './vendor/three.module.js';
export const NL = 8, NV = 48;
const v3 = () => new THREE.Vector3();
export const U = {
  uPS1: { value: 1 }, uAff: { value: 1 }, uGour: { value: 1 }, uSnap: { value: 150 }, uBounce: { value: 1 },
  uRes: { value: new THREE.Vector2(320, 240) },
  uLP: { value: Array.from({ length: NL }, v3) }, uLC: { value: Array.from({ length: NL }, v3) },
  uVP: { value: Array.from({ length: NV }, v3) }, uVN: { value: Array.from({ length: NV }, v3) }, uVC: { value: Array.from({ length: NV }, v3) },
  uNV: { value: 0 }, uAmb: { value: new THREE.Vector3(.07, .07, .08) },
  uMoonDir: { value: new THREE.Vector3(-.4, .8, .35).normalize() }, uMoonC: { value: new THREE.Vector3(.1, .11, .14) }, uOutZ: { value: 21.3 },
  uFogC: { value: new THREE.Vector3(.06, .055, .07) }, uFogD: { value: .06 },
};

const BAYER_GLSL = `
float bayer(vec2 p){
  vec2 q=floor(mod(p,4.));
  float i=q.x+q.y*4.;
  float v=0.;
  if(i<.5) v=0.; else if(i<1.5) v=8.; else if(i<2.5) v=2.; else if(i<3.5) v=10.;
  else if(i<4.5) v=12.; else if(i<5.5) v=4.; else if(i<6.5) v=14.; else if(i<7.5) v=6.;
  else if(i<8.5) v=3.; else if(i<9.5) v=11.; else if(i<10.5) v=1.; else if(i<11.5) v=9.;
  else if(i<12.5) v=15.; else if(i<13.5) v=7.; else if(i<14.5) v=13.; else v=5.;
  return v/16.-.5;
}`;

const LIGHT = `uniform vec3 uLP[${NL}];uniform vec3 uLC[${NL}];uniform vec3 uVP[${NV}];uniform vec3 uVN[${NV}];uniform vec3 uVC[${NV}];uniform int uNV;uniform float uBounce;uniform vec3 uAmb;uniform vec3 uMoonDir;uniform vec3 uMoonC;uniform float uOutZ;
vec3 lightAt(vec3 p,vec3 n,float useB){float o=smoothstep(uOutZ-.3,uOutZ+.3,p.z);vec3 c=uAmb+uMoonC*(max(dot(n,uMoonDir),0.)+.2)*o;
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

export function tex(draw, n = 64) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d', { willReadFrequently: true }); draw(g, n);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; return t;
}
const noise = (g, n, a) => { for (let i = 0; i < n * n / 3; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? 0 : 255},${Math.random() < .5 ? 0 : 255},0,${a * Math.random()})`; g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 1, 1); } };
export const colTex = (hex, a = .12) => tex((g, n) => { g.fillStyle = hex; g.fillRect(0, 0, n, n); noise(g, n, a); });
export const T = {
  brick: tex((g, n) => { g.fillStyle = '#5e4436'; g.fillRect(0, 0, n, n); g.fillStyle = '#8d6450'; for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) g.fillRect(x * 16 + (y % 2) * 8 + 1, y * 8 + 1, 14, 6); noise(g, n, .18); }),
  floor: tex((g, n) => { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#5d5a53' : '#7b766b'; g.fillRect(x * 32, y * 32, 32, 32); } g.strokeStyle = '#2c2a26'; g.strokeRect(0, 0, n, n); noise(g, n, .2); }),
  cobble: tex((g, n) => { g.fillStyle = '#3a3c3a'; g.fillRect(0, 0, n, n); for (let i = 0; i < 22; i++) { g.fillStyle = ['#646a64', '#575c55', '#6e6a60', '#4f5a48'][i % 4]; const x = Math.random() * n, y = Math.random() * n, r = 5 + Math.random() * 6; g.beginPath(); g.ellipse(x, y, r, r * .8, 0, 0, 7); g.fill(); } noise(g, n, .2); }),
  wood: tex((g, n) => { g.fillStyle = '#7a5230'; g.fillRect(0, 0, n, n); g.fillStyle = '#4f331a'; for (let i = 0; i < n; i += 16) g.fillRect(0, i, n, 2); g.fillRect(0, 0, 3, n); g.fillRect(n - 3, 0, 3, n); g.fillRect(0, 0, n, 3); g.fillRect(0, n - 3, n, 3); noise(g, n, .15); }),
  plaster: tex((g, n) => { g.fillStyle = '#4a4540'; g.fillRect(0, 0, n, n); g.fillStyle = '#2e2a26'; for (let i = 0; i < n; i += 16) g.fillRect(0, i, n, 3); noise(g, n, .12); }),
  iron: tex((g, n) => { g.fillStyle = '#3c4044'; g.fillRect(0, 0, n, n); g.fillStyle = '#6a5038'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 4, 3); noise(g, n, .2); }),
  red: tex((g, n) => { g.fillStyle = '#8e2a22'; g.fillRect(0, 0, n, n); g.fillStyle = '#c9a050'; g.fillRect(0, 6, n, 5); noise(g, n, .12); }),
  target: tex((g, n) => { g.fillStyle = '#6a3030'; g.fillRect(0, 0, n, n); g.fillStyle = '#c94040'; g.fillRect(16, 16, 32, 32); g.fillStyle = '#f0e0c0'; g.fillRect(28, 28, 8, 8); noise(g, n, .1); }),
  metal: tex((g, n) => { g.fillStyle = '#4a5058'; g.fillRect(0, 0, n, n); g.fillStyle = '#7a828a'; for (let i = 0; i < 20; i++) g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 8, 2); noise(g, n, .15); }),
  ammoBox: tex((g, n) => { g.fillStyle = '#3a4a38'; g.fillRect(0, 0, n, n); g.fillStyle = '#c9a050'; g.fillRect(8, 20, 48, 28); g.fillStyle = '#8a7030'; g.fillRect(12, 24, 40, 8); noise(g, n, .12); }),
  herb: colTex('#3d8a4a', .15),
  medkit: tex((g, n) => { g.fillStyle = '#6a3030'; g.fillRect(0, 0, n, n); g.fillStyle = '#e8e8e8'; g.fillRect(26, 10, 12, 44); g.fillRect(10, 26, 44, 12); noise(g, n, .1); }),
  scout: colTex('#6a5a8a', .12),
  black: colTex('#080808', .02),
  zombie: tex((g, n) => { g.fillStyle = '#5f7a48'; g.fillRect(0, 0, n, n); g.fillStyle = '#3c4f2c'; for (let i = 0; i < 26; i++) g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 6, 4); g.fillStyle = '#6a2a22'; for (let i = 0; i < 8; i++) g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 5, 3); noise(g, n, .2); }),
  zombieDark: tex((g, n) => { g.fillStyle = '#4a5a3a'; g.fillRect(0, 0, n, n); g.fillStyle = '#2e3a24'; for (let i = 0; i < 30; i++) g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 7, 5); g.fillStyle = '#5a1e18'; for (let i = 0; i < 10; i++) g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 6, 4); noise(g, n, .2); }),
  zombieHead: tex((g, n) => { g.fillStyle = '#6a8450'; g.fillRect(0, 0, n, n); g.fillStyle = '#2a3020'; g.fillRect(0, 0, n, 12); g.fillStyle = '#1a1010'; g.fillRect(18, 22, 10, 8); g.fillRect(36, 22, 10, 8); g.fillStyle = '#3a1010'; g.fillRect(20, 42, 24, 8); g.fillStyle = '#c8c0a0'; for (let x = 22; x < 42; x += 5) g.fillRect(x, 42, 3, 4); noise(g, n, .2); }),
  rags: tex((g, n) => { g.fillStyle = '#4a4036'; g.fillRect(0, 0, n, n); g.fillStyle = '#2e2620'; for (let i = 0; i < n; i += 10) g.fillRect(0, i, n, 3); g.fillStyle = '#6a2420'; for (let i = 0; i < 12; i++) g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 6, 6); g.fillStyle = '#5f7a48'; g.fillRect(20, 30, 14, 12); noise(g, n, .2); }),
  pants: tex((g, n) => { g.fillStyle = '#2e3446'; g.fillRect(0, 0, n, n); g.fillStyle = '#1c2030'; for (let i = 0; i < 16; i++) g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 8, 5); noise(g, n, .2); }),
  bone: tex((g, n) => { g.fillStyle = '#d8d0b8'; g.fillRect(0, 0, n, n); g.fillStyle = '#a89c80'; for (let i = 0; i < 18; i++) g.fillRect(Math.random() * n | 0, Math.random() * n | 0, 3, 6); noise(g, n, .12); }),
  skull: tex((g, n) => { g.fillStyle = '#e0d8c0'; g.fillRect(0, 0, n, n); g.fillStyle = '#100c08'; g.fillRect(14, 20, 14, 14); g.fillRect(36, 20, 14, 14); g.fillRect(28, 36, 8, 8); g.fillStyle = '#2a2018'; g.fillRect(16, 48, 32, 8); g.fillStyle = '#e0d8c0'; for (let x = 18; x < 46; x += 5) g.fillRect(x, 48, 3, 6); noise(g, n, .12); }),
  ribs: tex((g, n) => { g.fillStyle = '#100c08'; g.fillRect(0, 0, n, n); g.fillStyle = '#d8d0b8'; g.fillRect(28, 0, 8, n); for (let y = 4; y < n; y += 11) g.fillRect(4, y, 56, 5); noise(g, n, .1); }),
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

/** Copy light colors into vec3 uniforms (Vector3.copy(Color) is invalid in r169). */
export function syncLightUniforms(lights) {
  lights.forEach((L, i) => {
    U.uLP.value[i].copy(L.pos);
    U.uLC.value[i].set(L.col.r, L.col.g, L.col.b);
  });
}

export function computeBounce(lights, meshes) {
  const ray = new THREE.Raycaster(); ray.far = 16;
  const colSq = (c) => c.r * c.r + c.g * c.g + c.b * c.b;
  const act = lights.filter((l) => colSq(l.col) > 0.01); const per = Math.max(1, Math.floor(NV / Math.max(1, act.length)));
  const dirs = []; for (let i = 0; i < per; i++) { const y = 1 - 2 * (i + .5) / per, r = Math.sqrt(1 - y * y), a = i * 2.39996; dirs.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  let k = 0;
  for (const L of act) for (const d of dirs) {
    if (k >= NV) break; ray.set(L.pos, d); const h = ray.intersectObjects(meshes, false)[0]; if (!h || !h.face) continue;
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    const lam = Math.max(n.dot(d.clone().negate()), 0) / (1 + .35 * h.distance * h.distance);
    const a = h.object.material.userData.alb || new THREE.Color(.5, .5, .5); const flux = 4 * Math.PI / per * 1.5;
    U.uVP.value[k].copy(h.point).addScaledVector(n, .05); U.uVN.value[k].copy(n);
    U.uVC.value[k].set(L.col.r * a.r * lam * flux, L.col.g * a.g * lam * flux, L.col.b * a.b * lam * flux); k++;
  }
  U.uNV.value = k;
}

function shaderLinked(R, material, scene, camera) {
  R.compile(scene, camera);
  const gl = R.getContext();
  const programs = R.properties.get(material)?.programs;
  if (!programs?.size) return true;
  for (const entry of programs.values()) {
    const prog = entry?.program;
    if (prog && !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[PS1 FPS] shader log:', gl.getProgramInfoLog(prog));
      return false;
    }
  }
  return true;
}

function makeTarget(R, w, h, msaa) {
  const opts = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
  };
  if (msaa && R.capabilities.isWebGL2) opts.samples = 4;
  return new THREE.WebGLRenderTarget(w, h, opts);
}

export function createPipeline(R) {
  let rtLow, rtClean, resH = 240;
  let enabled = true;
  const post = new THREE.ShaderMaterial({
    uniforms: { tLow: { value: null }, uMode: { value: 1 }, uDith: { value: 1 }, uLowRes: { value: new THREE.Vector2() }, uFade: { value: 0 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `${BAYER_GLSL}
uniform sampler2D tLow;uniform float uMode,uDith,uFade;uniform vec2 uLowRes;varying vec2 vUv;
 vec3 tm(vec3 c){c=c/(1.+c*.6);return pow(clamp(c,0.,1.),vec3(1./2.2));}
 void main(){vec3 c=tm(texture2D(tLow,vUv).rgb);
  if(uMode>.5&&uDith>.5){vec2 px=floor(vUv*uLowRes);c=floor(c*31.+bayer(px)+.5)/31.;}
  vec2 q=vUv-.5;c*=1.-dot(q,q)*.55;c=mix(c,vec3(0),uFade);gl_FragColor=vec4(c,1.);}`,
  });
  const PS = new THREE.Scene(); PS.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post)); const PC = new THREE.Camera();

  function resize() {
    const h = resH, w = Math.round(h * innerWidth / innerHeight); rtLow?.dispose(); rtClean?.dispose();
    rtLow = makeTarget(R, w, h, false);
    rtClean = makeTarget(R, innerWidth, innerHeight, true);
    U.uRes.value.set(w, h);
  }
  function setPass(ps1, useB) { U.uPS1.value = ps1; for (const m of mats) m.uniforms.uUseB.value = useB; }

  resize();

  if (!shaderLinked(R, post, PS, PC)) {
    console.warn('[PS1 FPS] Post-process shader failed to link; using fallback renderer.');
    enabled = false;
  } else if (mats[0]) {
    const probe = new THREE.Scene();
    probe.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mats[0]));
    if (!shaderLinked(R, mats[0], probe, PC)) {
      console.warn('[PS1 FPS] Scene shader failed to link; using fallback renderer.');
      enabled = false;
    }
  }

  function render(S, cam, mode, fade = 0) {
    if (!enabled) return false;
    try {
      const low = mode !== 'clean';
      setPass(low ? 1 : 0, mode === 'ps1' ? 0 : 1);
      const rt = low ? rtLow : rtClean; R.setRenderTarget(rt); R.render(S, cam);
      post.uniforms.tLow.value = rt.texture; post.uniforms.uMode.value = low ? 1 : 0; post.uniforms.uLowRes.value.copy(U.uRes.value); post.uniforms.uFade.value = fade;
      R.setRenderTarget(null); R.render(PS, PC);
      return true;
    } catch (e) {
      console.warn('[PS1 FPS] Pipeline render error', e);
      enabled = false;
      return false;
    }
  }
  return { resize, render, setRes(h) { resH = h; resize(); }, isEnabled: () => enabled, disable: () => { enabled = false; } };
}

/** Replace PS1 shader mesh materials with Lambert (fallback path). */
export function meshToLambert(mesh) {
  if (!mesh?.isMesh || !mesh.material?.uniforms?.map) return;
  const map = mesh.material.uniforms.map.value;
  mesh.material = new THREE.MeshLambertMaterial({ map });
}
