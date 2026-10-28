// MotionBricks Steer Toy — procedural teaching toy. NOT NVIDIA MotionBricks (no weights, no ONNX).
import * as THREE from 'three';

// ---------- constants ----------
const THIGH = 0.42, SHIN = 0.42, SPINE = 0.5, NECK = 0.22, UARM = 0.3, FARM = 0.28, FOOT = 0.15;
const ANKLE_Y = 0.07, BODY_R = 0.3;
const FIELDS = ['lean','nod','hipL','kneeL','hipR','kneeR','shL','elL','shR','elR','splay','lift','sway','toeL','toeR'];
const STYLES = {
  normal: {name:'Normal', jp:'ふつう', key:'1', color:0x5eead4, speed:1.5, A:.42, hipBias:0, kBase:.1, K:.8, lean:.06, armA:.38, elB:.25, shBias:0, splay:.06, hop:0, limp:0, nod:.05, sway:.02},
  skip:   {name:'Skip',   jp:'スキップ', key:'2', color:0xfacc15, speed:2.1, A:.55, hipBias:.05, kBase:.15, K:1.5, lean:.08, armA:.75, elB:.6, shBias:.25, splay:.15, hop:.2, hopMode:'skip', limp:0, nod:-.05, sway:.03},
  zombie: {name:'Zombie', jp:'ゾンビ', key:'3', color:0x86efac, speed:.65, A:.26, hipBias:0, kBase:.12, K:.35, lean:.2, armA:.07, elB:.08, shBias:1.45, splay:.12, hop:0, limp:.55, nod:.35, sway:.09},
  crouch: {name:'Crouch', jp:'しゃがみ', key:'4', color:0xc084fc, speed:1.0, A:.38, hipBias:.75, kBase:1.35, K:.55, lean:.6, armA:.22, elB:.9, shBias:.35, splay:.1, hop:0, limp:0, nod:-.3, sway:.02},
  run:    {name:'Run',    jp:'ダッシュ', key:'5', color:0xfb923c, speed:4.0, A:.72, hipBias:.08, kBase:.3, K:1.7, lean:.3, armA:.9, elB:1.5, shBias:.1, splay:.08, hop:.07, hopMode:'run', limp:0, nod:-.1, sway:.0},
};
const STYLE_KEYS = Object.keys(STYLES);
const DUCK_STYLE = {...STYLES.crouch, hipBias:1.0, kBase:1.9, lean:.75, nod:-.45, A:.32, K:.4, speed:1.0, armA:.15, elB:1.1};

// ---------- helpers ----------
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const lerp = (a,b,t)=>a+(b-a)*t;
const sstep = (a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const wrapA = a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
const zeroPose = ()=>Object.fromEntries(FIELDS.map(f=>[f,0]));
const mixPose = (a,b,t,out=zeroPose())=>{for(const f of FIELDS) out[f]=lerp(a[f],b[f],t);return out;};
const copyPose = p=>({...p});
function cycleLen(st){ return Math.max(.4, 4*(THIGH+SHIN)*Math.sin(st.A)*(1-st.limp*.4)); }

function gaitPose(st, ph, amt, t=0, out=zeroPose()){
  const sL=Math.sin(ph), sR=Math.sin(ph+Math.PI);
  const swL=Math.max(0,Math.cos(ph)), swR=Math.max(0,Math.cos(ph+Math.PI));
  out.hipL = st.hipBias + st.A*sL*amt;
  out.hipR = st.hipBias + st.A*sR*amt*(1-st.limp);
  out.kneeL = st.kBase + st.K*swL*amt;
  out.kneeR = st.kBase + st.K*swR*amt*(1-st.limp*.6);
  out.shL = st.shBias - st.armA*sL*amt + .03*Math.sin(t*2.1);
  out.shR = st.shBias - st.armA*sR*amt + .03*Math.sin(t*2.1+1);
  out.elL = st.elB; out.elR = st.elB;
  out.lean = st.lean*(st.hipBias>.3||st.limp>0?1:(.35+.65*amt));
  out.nod = st.nod + .04*Math.sin(ph*2)*amt;
  out.splay = st.splay;
  let lift=0;
  if(st.hopMode==='skip') lift = st.hop*amt*Math.pow(Math.max(0,Math.sin(2*ph+.6)),1.5);
  else if(st.hopMode==='run') lift = st.hop*amt*Math.max(0,Math.cos(2*ph));
  out.lift = lift;
  out.sway = st.sway*Math.sin(ph)*amt;
  out.toeL = .35*swL*amt; out.toeR = .35*swR*amt;
  return out;
}

// forward kinematics in character-local frame (+z forward, +x = character's left, +y up)
const J = ['pelvis','chest','head','hipL','kneeL','ankleL','toeL','hipR','kneeR','ankleR','toeR','shL','elbL','handL','shR','elbR','handR'];
function makeJoints(){ const o={}; for(const j of J) o[j]=new THREE.Vector3(); return o; }
function fk(p, o){
  const dropL = THIGH*Math.cos(p.hipL)+SHIN*Math.cos(p.hipL-p.kneeL);
  const dropR = THIGH*Math.cos(p.hipR)+SHIN*Math.cos(p.hipR-p.kneeR);
  const py = ANKLE_Y + Math.max(dropL,dropR) + p.lift;
  o.pelvis.set(p.sway,py,0);
  const leg=(side,hip,knee,toe,H,K,A,T)=>{
    o[H].set(p.sway+side*.11,py,0);
    o[K].set(o[H].x, o[H].y-THIGH*Math.cos(hip), o[H].z+THIGH*Math.sin(hip));
    const sa=hip-knee;
    o[A].set(o[K].x, o[K].y-SHIN*Math.cos(sa), o[K].z+SHIN*Math.sin(sa));
    o[T].set(o[A].x, o[A].y+FOOT*Math.sin(toe)*.5-.02, o[A].z+FOOT*Math.cos(toe*.5));
  };
  leg(1,p.hipL,p.kneeL,p.toeL,'hipL','kneeL','ankleL','toeL');
  leg(-1,p.hipR,p.kneeR,p.toeR,'hipR','kneeR','ankleR','toeR');
  o.chest.set(p.sway, py+SPINE*Math.cos(p.lean), SPINE*Math.sin(p.lean));
  const hn=p.lean+p.nod;
  o.head.set(o.chest.x, o.chest.y+NECK*Math.cos(hn), o.chest.z+NECK*Math.sin(hn));
  const arm=(side,s,e,S,E,Hd)=>{
    o[S].set(o.chest.x+side*.2, o.chest.y-.05, o.chest.z);
    const sp=p.splay, c=Math.cos(sp);
    o[E].set(o[S].x+side*Math.sin(sp)*UARM, o[S].y-Math.cos(s)*c*UARM, o[S].z+Math.sin(s)*c*UARM);
    const s2=s+e;
    o[Hd].set(o[E].x+side*Math.sin(sp)*.5*FARM, o[E].y-Math.cos(s2)*c*FARM, o[E].z+Math.sin(s2)*c*FARM);
  };
  arm(1,p.shL,p.elL,'shL','elbL','handL');
  arm(-1,p.shR,p.elR,'shR','elbR','handR');
  return o;
}
const BONES = [ // [a,b,radius]
  ['pelvis','chest',.13],['chest','head',.05],['hipL','hipR',.08],['shL','shR',.07],
  ['hipL','kneeL',.07],['kneeL','ankleL',.06],['ankleL','toeL',.045],
  ['hipR','kneeR',.07],['kneeR','ankleR',.06],['ankleR','toeR',.045],
  ['shL','elbL',.05],['elbL','handL',.045],['shR','elbR',.05],['elbR','handR',.045],
];

// ---------- renderer / scene ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e141b);
scene.fog = new THREE.Fog(0x0e141b, 18, 42);
const camera = new THREE.PerspectiveCamera(50, 1, .05, 200);
scene.add(new THREE.HemisphereLight(0xbcd7ff, 0x1a1408, .9));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(6,12,5); sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:40});
scene.add(sun);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(32,32), new THREE.MeshStandardMaterial({color:0x1b2430, roughness:.95}));
ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(32,32,0x2f4a3a,0x24303d); grid.position.y=.002; scene.add(grid);

// obstacles
const colliders = [];  // {min:{x,z},max:{x,z}}
const actionables = []; // {type,label,min,max,h,cx,cz}
const matCrate = new THREE.MeshStandardMaterial({color:0x8b5a2b, roughness:.8});
const matWall = new THREE.MeshStandardMaterial({color:0x6b7280, roughness:.9});
const matArch = new THREE.MeshStandardMaterial({color:0x9a8f7a, roughness:.85});
const matPillar = new THREE.MeshStandardMaterial({color:0x4b6a88, roughness:.7});
function addBox(cx,cz,sx,sy,sz,mat,y0=0){
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), mat);
  m.position.set(cx,y0+sy/2,cz); m.castShadow = m.receiveShadow = true; scene.add(m);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({color:0x000000, transparent:true, opacity:.35}));
  m.add(e); return m;
}
const bb=(cx,cz,sx,sz)=>({min:{x:cx-sx/2,z:cz-sz/2},max:{x:cx+sx/2,z:cz+sz/2}});
function crate(cx,cz,s=1,h=.9){ addBox(cx,cz,s,h,s,matCrate); const b=bb(cx,cz,s,s); colliders.push(b); actionables.push({type:'vault',label:'木箱 crate',...b,h,cx,cz}); }
function wall(cx,cz,sx,sz,h=.6){ addBox(cx,cz,sx,h,sz,matWall); const b=bb(cx,cz,sx,sz); colliders.push(b); actionables.push({type:'vault',label:'低い壁 low wall',...b,h,cx,cz}); }
function pillar(cx,cz,r=.35){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,2.2,20),matPillar); m.position.set(cx,1.1,cz); m.castShadow=m.receiveShadow=true; scene.add(m);
  const b=bb(cx,cz,r*2,r*2); colliders.push(b); actionables.push({type:'side',label:'柱 pillar',...b,h:2.2,cx,cz});
}
function arch(cx,cz,alongX=true){
  const W=1.7, D=.6, P=.45, bottom=1.25, top=1.7;
  if(alongX){
    addBox(cx-(W/2+P/2),cz,P,top,D,matArch); addBox(cx+(W/2+P/2),cz,P,top,D,matArch);
    addBox(cx,cz,W+2*P,top-bottom,D,matArch,bottom);
    colliders.push(bb(cx-(W/2+P/2),cz,P,D), bb(cx+(W/2+P/2),cz,P,D));
    actionables.push({type:'duck',label:'アーチ arch',...bb(cx,cz,W,D),h:bottom,cx,cz});
  } else {
    addBox(cx,cz-(W/2+P/2),D,top,P,matArch); addBox(cx,cz+(W/2+P/2),D,top,P,matArch);
    addBox(cx,cz,D,top-bottom,W+2*P,matArch,bottom);
    colliders.push(bb(cx,cz-(W/2+P/2),D,P), bb(cx,cz+(W/2+P/2),D,P));
    actionables.push({type:'duck',label:'アーチ arch',...bb(cx,cz,D,W),h:bottom,cx,cz});
  }
}
crate(3,4); crate(-6.5,-5.5); crate(7,-6,1,.9);
wall(-4,3.2,4,.4,.6); wall(6.5,1.5,.4,3.2,.6);
arch(0,-5,true); arch(-8,1,false);
pillar(-3,-1.5); pillar(4.5,-2.5); pillar(1.5,7.5);
// arena border (visual)
{ const g=new THREE.EdgesGeometry(new THREE.BoxGeometry(30,.3,30)); const l=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x76b900,transparent:true,opacity:.35})); l.position.y=.15; scene.add(l); }

// 2D slab ray vs AABB (xz)
function rayBox(px,pz,dx,dz,b){
  let tmin=-Infinity,tmax=Infinity,axis=null,nsign=0;
  for(const ax of ['x','z']){
    const p=ax==='x'?px:pz, d=ax==='x'?dx:dz;
    if(Math.abs(d)<1e-6){ if(p<b.min[ax]||p>b.max[ax]) return null; continue; }
    let t1=(b.min[ax]-p)/d, t2=(b.max[ax]-p)/d, s=-1;
    if(t1>t2){[t1,t2]=[t2,t1]; s=1;}
    if(t1>tmin){tmin=t1; axis=ax; nsign=s;}
    tmax=Math.min(tmax,t2);
  }
  if(tmax<tmin||tmax<0||axis===null) return null;
  return {t:tmin, axis, nsign}; // normal = nsign along axis (outward of entry face)
}
function pushOut(c){
  for(const b of colliders){
    const minx=b.min.x-BODY_R, maxx=b.max.x+BODY_R, minz=b.min.z-BODY_R, maxz=b.max.z+BODY_R;
    if(c.x>minx&&c.x<maxx&&c.z>minz&&c.z<maxz){
      const pen=[c.x-minx, maxx-c.x, c.z-minz, maxz-c.z]; const i=pen.indexOf(Math.min(...pen));
      if(i===0)c.x=minx; else if(i===1)c.x=maxx; else if(i===2)c.z=minz; else c.z=maxz;
      c.bumped=true;
    }
  }
  c.x=clamp(c.x,-14.6,14.6); c.z=clamp(c.z,-14.6,14.6);
}

// ---------- settings / UI state ----------
const S = { contacts:true, ghosts:true, hud:true, tokens:24, crowd:0 };
const latencyMs = ()=>30+S.tokens*7;

// ---------- foot contact decals ----------
const decalGeo = new THREE.RingGeometry(.05,.11,20); decalGeo.rotateX(-Math.PI/2);
const decals=[]; let decalI=0;
for(let i=0;i<140;i++){ const m=new THREE.Mesh(decalGeo,new THREE.MeshBasicMaterial({color:0xff5d5d,transparent:true,opacity:0,depthWrite:false})); m.position.y=.01; m.visible=false; scene.add(m); decals.push({m,life:0}); }
function spawnDecal(x,z,color){ const d=decals[decalI++%decals.length]; d.m.position.set(x,.012,z); d.m.material.color.setHex(color); d.life=1.4; d.m.visible=true; }

// ---------- ghost skeletons ----------
const GHOSTS=[];
const ghostMat = new THREE.LineBasicMaterial({color:0x76b900, transparent:true, opacity:.55, depthWrite:false});
for(let i=0;i<14;i++){
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((BONES.length+2)*6),3));
  const l=new THREE.LineSegments(g,ghostMat.clone()); l.visible=false; l.frustumCulled=false; scene.add(l);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),new THREE.MeshBasicMaterial({color:0x76b900,wireframe:true,transparent:true,opacity:.5})); head.visible=false; scene.add(head);
  GHOSTS.push({l,head});
}
const tmpJ = makeJoints(), tmpV = new THREE.Vector3();
function toWorld(v,x,z,yaw,out){ const c=Math.cos(yaw), s=Math.sin(yaw); return out.set(x+v.x*c+v.z*s, v.y, z-v.x*s+v.z*c); }
function setGhost(i, pose, x, z, yaw, alpha){
  const g=GHOSTS[i]; fk(pose,tmpJ); const arr=g.l.geometry.attributes.position.array; let k=0;
  for(const [a,b] of BONES){ toWorld(tmpJ[a],x,z,yaw,tmpV); arr[k++]=tmpV.x;arr[k++]=tmpV.y;arr[k++]=tmpV.z; toWorld(tmpJ[b],x,z,yaw,tmpV); arr[k++]=tmpV.x;arr[k++]=tmpV.y;arr[k++]=tmpV.z; }
  // root marker line
  arr[k++]=x;arr[k++]=.01;arr[k++]=z; toWorld(tmpJ.pelvis,x,z,yaw,tmpV); arr[k++]=tmpV.x;arr[k++]=tmpV.y;arr[k++]=tmpV.z;
  arr[k++]=x;arr[k++]=.01;arr[k++]=z; arr[k++]=x+Math.sin(yaw)*.35;arr[k++]=.01;arr[k++]=z+Math.cos(yaw)*.35;
  g.l.geometry.attributes.position.needsUpdate=true; g.l.material.opacity=alpha; g.l.visible=true;
  toWorld(tmpJ.head,x,z,yaw,g.head.position); g.head.material.opacity=alpha; g.head.visible=true;
}
function hideGhosts(){ for(const g of GHOSTS){g.l.visible=false;g.head.visible=false;} }

// ---------- Character ----------
const capCache = new Map();
function capsule(r,len){ const k=r+'|'+len.toFixed(3); if(!capCache.has(k)) capCache.set(k,new THREE.CapsuleGeometry(r,len,4,8)); return capCache.get(k); }
const headGeo = new THREE.SphereGeometry(.13,16,12), visorGeo = new THREE.BoxGeometry(.17,.05,.05), jointGeo=new THREE.SphereGeometry(.055,8,6);
const UP = new THREE.Vector3(0,1,0), qTmp=new THREE.Quaternion(), dTmp=new THREE.Vector3();

class Character{
  constructor(styleKey, isPlayer=false){
    this.isPlayer=isPlayer; this.group=new THREE.Group(); scene.add(this.group);
    this.x=0; this.z=0; this.yaw=0; this.speed=0; this.phase=0; this.t=Math.random()*10;
    this.state='loco'; this.action=null; this.gen=null; this.cool=0;
    this.pose=zeroPose(); this.joints=makeJoints(); this.history=[]; this.histT=0;
    this.contact={L:false,R:false};
    this.mat=new THREE.MeshStandardMaterial({color:0xffffff, roughness:.45, metalness:.15});
    this.matDark=new THREE.MeshStandardMaterial({color:0x1f2937, roughness:.5, metalness:.3});
    this.boneMeshes=BONES.map(([a,b,r])=>{
      const len=this._len(a,b); const m=new THREE.Mesh(capsule(r,len), (a==='hipL'&&b==='hipR')||(a==='shL'&&b==='shR')?this.matDark:this.mat);
      m.castShadow=true; this.group.add(m); return m; });
    this.headM=new THREE.Mesh(headGeo,this.mat); this.headM.castShadow=true; this.group.add(this.headM);
    this.visor=new THREE.Mesh(visorGeo,new THREE.MeshBasicMaterial({color:0x111111})); this.group.add(this.visor);
    this.footM={L:new THREE.Mesh(jointGeo,this.matDark), R:new THREE.Mesh(jointGeo,this.matDark)};
    this.group.add(this.footM.L,this.footM.R);
    this.setStyle(styleKey);
  }
  _len(a,b){ const p=zeroPose(); fk(p,tmpJ); return Math.max(.001,tmpJ[a].distanceTo(tmpJ[b])); }
  setStyle(k){ this.styleKey=k; this.style=STYLES[k]; this.mat.color.setHex(this.style.color); this.visor.material.color.setHex(0x0b0f14); }
  get amt(){ return clamp(this.speed/this.style.speed,0,1); }
  heading(){ return {x:Math.sin(this.yaw), z:Math.cos(this.yaw)}; }

  // --- locomotion update with a desired direction (unit) or null
  loco(dt, dir, slow=1){
    const st=this.style; let target=0;
    if(dir){ target=st.speed*slow; const want=Math.atan2(dir.x,dir.z); const d=wrapA(want-this.yaw); const rate=(st===STYLES.run?5:7)*dt; this.yaw+=clamp(d,-rate,rate); if(Math.abs(d)>1.6) target*=.35; }
    const acc=(target>this.speed?5:7)*dt*Math.max(1,st.speed/1.5);
    this.speed+=clamp(target-this.speed,-acc,acc);
    const h=this.heading(); this.x+=h.x*this.speed*dt; this.z+=h.z*this.speed*dt;
    this.bumped=false; pushOut(this);
    this.phase+=dt*this.speed/cycleLen(st)*Math.PI*2;
    gaitPose(st,this.phase,this.amt,this.t,this.pose);
  }

  // --- obstacle detection: returns {ob, t, axis, nsign}
  detect(range){
    if(this.cool>0||this.speed<.25) return null;
    const h=this.heading(); let best=null;
    for(const ob of actionables){
      const r=rayBox(this.x,this.z,h.x,h.z,ob); if(!r||r.t<-0.05||r.t>range) continue;
      const nx=r.axis==='x'?r.nsign:0, nz=r.axis==='z'?r.nsign:0;
      if(-(nx*h.x+nz*h.z)<.55) continue; // glancing → let collision slide
      if(!best||r.t<best.t) best={ob,...r,nx,nz};
    }
    return best;
  }
  startGenerating(hit){ this.state='gen'; this.gen={hit, left:latencyMs()/1000, total:latencyMs()/1000}; if(this.isPlayer) flashGen(hit.ob); }

  plan(hit){
    const ob=hit.ob, fx=-hit.nx, fz=-hit.nz; // forward into obstacle
    const lx=fz, lz=-fx; // +lat = local +x direction for yaw aligned
    const yawA=this.yaw+wrapA(Math.atan2(fx,fz)-this.yaw);
    const ax=hit.axis; const face = fx+fz>0 ? ob.min[ax] : ob.max[ax];
    const pAx = ax==='x'?this.x:this.z, dirAx = ax==='x'?fx:fz;
    const d0=Math.max(0,(face-pAx)*dirAx - 0.0);
    const D = ax==='x'? ob.max.x-ob.min.x : ob.max.z-ob.min.z;
    const W = ax==='x'? ob.max.z-ob.min.z : ob.max.x-ob.min.x;
    const latOff=(this.x-ob.cx)*lx+(this.z-ob.cz)*lz;
    const st=this.style, keys=[];
    keys.push({t:0,f:0,s:0,yaw:this.yaw,pose:copyPose(this.pose),label:'context'});
    let endPhase=0;
    if(ob.type==='vault'){
      const H=ob.h, sc=clamp(1.6/Math.sqrt(st.speed*1.2),.7,1.45);
      const P=(o)=>Object.assign(zeroPose(),o);
      keys.push({t:.26*sc,f:Math.max(.08,d0-.32),s:0,yaw:yawA,label:'plant',pose:P({lean:.6,nod:-.2,hipL:.65,kneeL:1.05,hipR:.15,kneeR:.45,shL:1.15,elL:.1,shR:1.15,elR:.1,splay:.12,toeL:.2})});
      keys.push({t:.5*sc,f:d0+.12,s:0,yaw:yawA,label:'push',pose:P({lean:.45,nod:-.15,hipL:1.3,kneeL:2.0,hipR:1.1,kneeR:1.85,shL:.35,elL:0,shR:.35,elR:0,splay:.25,lift:H*.92})});
      keys.push({t:.72*sc,f:d0+D*.5+.15,s:0,yaw:yawA,label:'tuck',pose:P({lean:.3,nod:-.1,hipL:1.55,kneeL:2.3,hipR:1.45,kneeR:2.25,shL:-.25,elL:.3,shR:-.25,elR:.3,splay:.55,lift:H+.13})});
      keys.push({t:.94*sc,f:d0+D+.35,s:0,yaw:yawA,label:'reach',pose:P({lean:.15,nod:0,hipL:.45,kneeL:.25,hipR:.25,kneeR:.2,shL:.8,elL:.2,shR:.8,elR:.2,splay:.85,lift:.18,toeL:-.3,toeR:-.3})});
      keys.push({t:1.1*sc,f:d0+D+.6,s:0,yaw:yawA,label:'land',pose:P({lean:.5,nod:-.2,hipL:.95,kneeL:1.55,hipR:.8,kneeR:1.45,shL:.55,elL:.45,shR:.55,elR:.45,splay:.35})});
      keys.push({t:1.4*sc,f:d0+D+.6+st.speed*.3,s:0,yaw:yawA,label:'recover',pose:gaitPose(st,0,1)});
      endPhase=0;
    } else {
      // path-sampled actions: duck / side
      const isDuck=ob.type==='duck';
      const total = d0 + D + (isDuck?1.2:1.5);
      const sign = isDuck?0:(Math.abs(latOff)<.02?(Math.random()<.5?-1:1):Math.sign(latOff));
      const sT = isDuck?0: sign*(W/2+.5) - latOff;
      const sOf = f=> isDuck?0 : sT*sstep(d0-1.0,d0-.05,f)*(1-sstep(d0+D+.1,d0+D+1.2,f));
      const eOf = f=> isDuck? sstep(d0-.9,d0-.15,f)*(1-sstep(d0+D+.1,d0+D+.8,f)) : 0;
      const gst = this.style; const step = Math.min(cycleLen(gst),cycleLen(DUCK_STYLE))/4;
      let f=0, t=0, ph=this.phase, prevF=0;
      const n=Math.max(4,Math.min(12,Math.ceil(total/step)));
      for(let i=1;i<=n;i++){
        f=total*i/n; const e=eOf((f+prevF)/2);
        const v = Math.max(.5, lerp(Math.max(gst.speed,1.0), DUCK_STYLE.speed, e));
        t += (f-prevF)/v;
        ph += (f-prevF)/lerp(cycleLen(gst),cycleLen(DUCK_STYLE),e)*Math.PI*2;
        const pose = mixPose(gaitPose(gst,ph,1), gaitPose(DUCK_STYLE,ph,1), eOf(f));
        const ds=(sOf(f+.05)-sOf(f-.05))/.1;
        keys.push({t,f,s:sOf(f),yaw:yawA+Math.atan(ds)*.8,pose,label:isDuck?(eOf(f)>.5?'duck':'walk'):(Math.abs(sOf(f))>.3?'side':'walk')});
        prevF=f;
      }
      endPhase=ph;
    }
    // unwrap yaw relative to first
    for(const k of keys) k.yaw = keys[0].yaw + wrapA(k.yaw-keys[0].yaw);
    // "generate" N frames by Catmull-Rom through keys
    const N=S.tokens, dur=keys[keys.length-1].t, frames=[];
    for(let i=0;i<N;i++){ frames.push(sampleKeys(keys, dur*i/(N-1))); }
    this.action={type:ob.type, label:ob.label, keys, frames, dur, el:0, x0:this.x, z0:this.z, fx, fz, lx, lz, endPhase, endYaw:keys[keys.length-1].yaw, speed0:this.speed};
    this.state='act';
  }
  rootAt(fr){ const a=this.action; return {x:a.x0+a.fx*fr.f+a.lx*fr.s, z:a.z0+a.fz*fr.f+a.lz*fr.s}; }
  playAction(dt){
    const a=this.action; a.el+=dt; const u=clamp(a.el/a.dur,0,1)*(a.frames.length-1);
    const i=Math.min(a.frames.length-2,Math.floor(u)), w=u-i, A=a.frames[i], B=a.frames[i+1];
    mixPose(A.pose,B.pose,w,this.pose);
    const f=lerp(A.f,B.f,w), s=lerp(A.s,B.s,w); this.yaw=lerp(A.yaw,B.yaw,w);
    this.x=a.x0+a.fx*f+a.lx*s; this.z=a.z0+a.fz*f+a.lz*s;
    a.frameIdx=Math.round(u);
    if(a.el>=a.dur){ this.state='loco'; this.phase=a.endPhase; this.yaw=wrapA(a.endYaw); this.speed=Math.min(this.style.speed, Math.max(a.speed0,.6*this.style.speed)); this.cool=.5; if(this.isPlayer) setPlanText(null); this.action=null; }
  }

  update(dt, dir){
    this.t+=dt; this.cool=Math.max(0,this.cool-dt);
    if(this.state==='act'){ this.playAction(dt); }
    else if(this.state==='gen'){
      this.loco(dt, this.speed>.1?this.heading():null, .55); this.gen.left-=dt;
      if(this.gen.left<=0){ const hit=this.detect(2.5); this.gen=null; if(hit) this.plan(hit); else { this.state='loco'; if(this.isPlayer) setPlanText(null);} }
    } else {
      this.loco(dt, dir);
      const range = .7 + this.speed*(.35+latencyMs()/1000*.55);
      const hit=this.detect(range); if(hit) this.startGenerating(hit);
    }
    this.histT+=dt; if(this.histT>.18){ this.histT=0; this.history.push(copyPose(this.pose)); if(this.history.length>6) this.history.shift(); }
    this.render();
  }
  render(){
    fk(this.pose,this.joints); const o=this.joints;
    this.group.position.set(this.x,0,this.z); this.group.rotation.y=this.yaw;
    BONES.forEach(([a,b],i)=>{ const m=this.boneMeshes[i]; m.position.addVectors(o[a],o[b]).multiplyScalar(.5); dTmp.subVectors(o[b],o[a]).normalize(); m.quaternion.setFromUnitVectors(UP,dTmp); });
    this.headM.position.copy(o.head);
    const hn=this.pose.lean+this.pose.nod; this.visor.position.set(o.head.x, o.head.y+.01, o.head.z+.12); this.visor.rotation.x=-hn*.5;
    for(const side of ['L','R']){
      const an=o['ankle'+side]; this.footM[side].position.copy(an);
      const c = an.y < ANKLE_Y+.025;
      if(c && !this.contact[side] && S.contacts && (this.isPlayer||crowd.length<=8)){ toWorld(an,this.x,this.z,this.yaw,tmpV); spawnDecal(tmpV.x,tmpV.z, side==='L'?0xff5d5d:0x60a5fa); }
      this.contact[side]=c;
      this.footM[side].material = c&&S.contacts ? (side==='L'?contactMatL:contactMatR) : this.matDark;
    }
  }
  dispose(){ scene.remove(this.group); this.mat.dispose(); this.matDark.dispose(); }
}
const contactMatL=new THREE.MeshBasicMaterial({color:0xff5d5d}), contactMatR=new THREE.MeshBasicMaterial({color:0x60a5fa});

function sampleKeys(keys,t){
  let i=0; while(i<keys.length-2 && t>keys[i+1].t) i++;
  const k1=keys[i],k2=keys[i+1],k0=keys[Math.max(0,i-1)],k3=keys[Math.min(keys.length-1,i+2)];
  const u=clamp((t-k1.t)/Math.max(1e-5,k2.t-k1.t),0,1);
  const cr=(a,b,c,d)=>{const u2=u*u,u3=u2*u;return .5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u2+(-a+3*b-3*c+d)*u3);};
  const pose=zeroPose(); for(const f of FIELDS) pose[f]=cr(k0.pose[f],k1.pose[f],k2.pose[f],k3.pose[f]);
  pose.lift=Math.max(0,pose.lift);
  return {pose, f:cr(k0.f,k1.f,k2.f,k3.f), s:cr(k0.s,k1.s,k2.s,k3.s), yaw:cr(k0.yaw,k1.yaw,k2.yaw,k3.yaw)};
}

// ---------- player, crowd ----------
const player = new Character('normal', true);
player.x=0; player.z=8; player.yaw=Math.PI;
let crowd=[];
function setCrowd(n){
  while(crowd.length>n) crowd.pop().c.dispose();
  while(crowd.length<n){
    const c=new Character(STYLE_KEYS[(crowd.length+1)%STYLE_KEYS.length]);
    do{ c.x=(Math.random()-.5)*26; c.z=(Math.random()-.5)*26; c.bumped=false; pushOut(c);}while(Math.hypot(c.x-player.x,c.z-player.z)<2);
    c.yaw=Math.random()*6.28; crowd.push({c, goal:randGoal(), stuck:0});
  }
}
function randGoal(){ return {x:(Math.random()-.5)*26, z:(Math.random()-.5)*26}; }

// ---------- input ----------
const keys=new Set(); let goal=null;
const goalMarker=new THREE.Mesh(new THREE.RingGeometry(.18,.3,24).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0x76b900,transparent:true,opacity:.9}));
goalMarker.visible=false; scene.add(goalMarker);
addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT') return;
  const k=e.code; keys.add(k);
  if(/^Digit[1-5]$/.test(k)) selectStyle(STYLE_KEYS[+k.slice(5)-1]);
  if(k==='KeyC') toggle('tContacts'); if(k==='KeyG') toggle('tGhost'); if(k==='KeyH') toggle('tHud');
  if(k.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>keys.clear());
let camYaw=0, camDist=7.5, camPitch=.5, drag=null;
canvas.addEventListener('pointerdown',e=>{ drag={x:e.clientX,y:e.clientY,moved:0,yaw:camYaw,pitch:camPitch}; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove',e=>{ if(!drag) return; const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.moved=Math.max(drag.moved,Math.hypot(dx,dy)); if(drag.moved>6){ camYaw=drag.yaw-dx*.006; camPitch=clamp(drag.pitch+dy*.004,.15,1.25);} });
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
canvas.addEventListener('pointerup',e=>{
  if(drag&&drag.moved<=6){
    ndc.set(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight)*2+1); ray.setFromCamera(ndc,camera);
    const hit=ray.intersectObject(ground)[0]; if(hit){ goal={x:clamp(hit.point.x,-14.5,14.5),z:clamp(hit.point.z,-14.5,14.5)}; goalMarker.position.set(goal.x,.02,goal.z); goalMarker.visible=true; }
  }
  drag=null;
});
canvas.addEventListener('wheel',e=>{ camDist=clamp(camDist*(1+Math.sign(e.deltaY)*.08),3,18); e.preventDefault(); },{passive:false});

function inputDir(){
  let f=0,r=0;
  if(keys.has('KeyW')||keys.has('ArrowUp')) f+=1; if(keys.has('KeyS')||keys.has('ArrowDown')) f-=1;
  if(keys.has('KeyD')||keys.has('ArrowRight')) r+=1; if(keys.has('KeyA')||keys.has('ArrowLeft')) r-=1;
  if(f||r){ goal=null; goalMarker.visible=false;
    const fx=-Math.sin(camYaw), fz=-Math.cos(camYaw), rx=Math.cos(camYaw), rz=-Math.sin(camYaw);
    const x=fx*f+rx*r, z=fz*f+rz*r, l=Math.hypot(x,z); return {x:x/l,z:z/l}; }
  if(goal){ const dx=goal.x-player.x, dz=goal.z-player.z, l=Math.hypot(dx,dz);
    if(l<.35){ goal=null; goalMarker.visible=false; return null; } return {x:dx/l,z:dz/l}; }
  return null;
}

// ---------- UI ----------
const $=id=>document.getElementById(id);
const styleBox=$('styles');
for(const k of STYLE_KEYS){ const st=STYLES[k]; const b=document.createElement('button'); b.dataset.k=k; b.innerHTML=`${st.key} ${st.jp}<br><span class="sub">${st.name}</span>`; b.onclick=()=>selectStyle(k); b.style.borderLeft=`3px solid #${st.color.toString(16).padStart(6,'0')}`; styleBox.appendChild(b); }
function selectStyle(k){ if(!STYLES[k]) return; player.setStyle(k); for(const b of styleBox.children) b.classList.toggle('on',b.dataset.k===k); }
selectStyle('normal');
function toggle(id){ const el=$(id); el.checked=!el.checked; el.dispatchEvent(new Event('change')); }
$('tContacts').onchange=e=>{S.contacts=e.target.checked; if(!S.contacts) decals.forEach(d=>{d.life=0;d.m.visible=false;});};
$('tGhost').onchange=e=>{S.ghosts=e.target.checked;};
$('tHud').onchange=e=>{S.hud=e.target.checked; $('hudWrap').style.display=S.hud?'':'none';};
$('sTok').oninput=e=>{S.tokens=+e.target.value; $('vTok').textContent=S.tokens;};
$('sCrowd').oninput=e=>{S.crowd=+e.target.value; $('vCrowd').textContent=S.crowd; setCrowd(S.crowd);};
$('hidePanel').onclick=e=>{e.preventDefault(); $('side').style.display='none'; $('hideBtn').style.display='block';};
$('hideBtn').onclick=()=>{ $('side').style.display=''; $('hideBtn').style.display='none'; };
const genEl=$('gen'); let genTimer=0;
const TYPE_JP={vault:'VAULT 乗り越え', duck:'DUCK くぐる', side:'SIDESTEP 回り込み'};
let planText=null;
function flashGen(ob){ genEl.textContent=`GENERATING… ${S.tokens} tokens · ${latencyMs()}ms（擬似）→ ${TYPE_JP[ob.type]}`; genEl.classList.add('show'); genTimer=latencyMs()/1000+.08; setPlanText(`${ob.label} を検知 → ${TYPE_JP[ob.type]} を計画`); }
function setPlanText(t){ planText=t; }

// ---------- HUD canvas ----------
const hud=$('hud'), hctx=hud.getContext('2d');
function sizeHud(){ const r=hud.getBoundingClientRect(); hud.width=r.width*devicePixelRatio; hud.height=r.height*devicePixelRatio; }
const hudJ=makeJoints();
function drawFig(ctx, pose, cx, by, sc, color, alpha=1, yawOff=0){
  fk(pose,hudJ); ctx.globalAlpha=alpha; ctx.strokeStyle=color; ctx.lineWidth=Math.max(1.5,sc*.05); ctx.lineCap='round';
  const P=v=>[cx+(v.z*Math.cos(yawOff)+v.x*.25)*sc, by-v.y*sc];
  ctx.beginPath(); for(const [a,b] of BONES){ const A=P(hudJ[a]),B=P(hudJ[b]); ctx.moveTo(A[0],A[1]); ctx.lineTo(B[0],B[1]); } ctx.stroke();
  const H=P(hudJ.head); ctx.beginPath(); ctx.arc(H[0],H[1],sc*.11,0,7); ctx.stroke();
  ctx.fillStyle=color; for(const j of ['ankleL','ankleR','handL','handR','kneeL','kneeR']){ const p=P(hudJ[j]); ctx.fillRect(p[0]-1.5,p[1]-1.5,3,3); }
  ctx.globalAlpha=1;
}
function drawHud(){
  if(!S.hud) return;
  const W=hud.width, H=hud.height, d=devicePixelRatio; hctx.clearRect(0,0,W,H);
  hctx.font=`${10*d}px ui-sans-serif,system-ui`; hctx.fillStyle='#93a3b5';
  const sc=H*.36, base=H*.79, ctxN=4, M=4, slotW=W/(ctxN+M+1.3);
  hctx.fillText('context (N=4)',4*d,12*d); hctx.fillText('targets (M)',slotW*(ctxN+1.1),12*d);
  const hist=player.history.slice(-ctxN);
  hist.forEach((p,i)=>drawFig(hctx,p,slotW*(i+.6),base,sc,'#94a3b8',.45+.15*i));
  // current
  hctx.fillStyle='#76b900'; hctx.fillText('now',slotW*(ctxN+.45),H-4*d);
  drawFig(hctx,player.pose,slotW*(ctxN+.65),base,sc,'#e8eef5',1);
  // targets
  let targets=[], labels=[];
  const a=player.action;
  if(a){ const rem=a.keys.filter(k=>k.t>a.el); targets=rem.slice(0,M).map(k=>k.pose); labels=rem.slice(0,M).map(k=>k.label); }
  else { const st=player.style, amt=Math.max(player.amt,.0001); for(let i=1;i<=M;i++){ targets.push(gaitPose(st,player.phase+i*Math.PI/2,player.amt,player.t)); labels.push(player.amt>.05?`φ+${i*90}°`:'idle'); } }
  targets.forEach((p,i)=>{ drawFig(hctx,p,slotW*(ctxN+1.6+i),base,sc,a?'#76b900':'#5eead4',a?.95:.6); hctx.fillStyle=a?'#a3e635':'#5eead4'; hctx.fillText(labels[i]||'',slotW*(ctxN+1.25+i),H-4*d); });
  // arrow
  hctx.strokeStyle='#76b900'; hctx.lineWidth=d; hctx.beginPath(); const ax=slotW*(ctxN+1.05); hctx.moveTo(ax,base-sc*.9); hctx.lineTo(ax+8*d,base-sc*.9); hctx.stroke();
  // frames strip
  const n=S.tokens, x0=4*d, x1=W-4*d, y=H-17*d;
  hctx.fillStyle='#93a3b5'; hctx.textAlign='right'; hctx.fillText(a?`generated frames ${a.frameIdx??0}/${n-1}  ·  ${a.type}`:(player.state==='gen'?'generating…':`frames = ${n}`), W-4*d, 24*d); hctx.textAlign='left';
  for(let i=0;i<n;i++){ const px=lerp(x0+slotW*0.1, x1, i/(n-1)); hctx.fillStyle = a ? (i<= (a.frameIdx??0) ? '#76b900' : '#334155') : (player.state==='gen'?(Math.random()<.5?'#a3e635':'#334155'):'#26303c'); hctx.fillRect(px-1.2*d,y-14*d*0+0,2.4*d,3*d); }
}

// ---------- status ----------
const statusEl=$('status'); let fpsAcc=0,fpsN=0,fps=60;
function updStatus(){
  const st=player.style; const s={loco:'Locomotion（歩行サイクル）',gen:'Generating（擬似推論中）',act:'Transition（補間再生中）'}[player.state];
  statusEl.innerHTML=`<b>${st.jp} / ${st.name}</b> · ${player.speed.toFixed(2)} m/s · ${s}<br>${planText?planText+'<br>':''}<span class="sub">ghost=${S.ghosts?'on':'off'} · tokens ${S.tokens} · crowd ${crowd.length} · ${fps.toFixed(0)} fps</span>`;
}

// ---------- loop ----------
function resize(){ renderer.setSize(innerWidth,innerHeight,false); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); sizeHud(); }
addEventListener('resize',resize); resize();
const camTarget=new THREE.Vector3(player.x,1,player.z);
let last=performance.now(), statT=0;
function frame(now){
  const dt=Math.min(.05,(now-last)/1000); last=now;
  player.update(dt, player.state==='loco'?inputDir():null);
  for(const cr of crowd){
    const c=cr.c; let dir=null;
    if(c.state==='loco'){ const dx=cr.goal.x-c.x, dz=cr.goal.z-c.z, l=Math.hypot(dx,dz); if(l<.6){cr.goal=randGoal();} else dir={x:dx/l,z:dz/l}; }
    c.update(dt,dir); cr.stuck = c.bumped&&c.state==='loco' ? cr.stuck+dt : Math.max(0,cr.stuck-dt);
    if(cr.stuck>1.2){ cr.goal=randGoal(); cr.stuck=0; }
  }
  // ghosts
  hideGhosts();
  if(S.ghosts){
    const a=player.action;
    if(a){ const rem=a.keys.filter(k=>k.t>a.el).slice(0,GHOSTS.length); rem.forEach((k,i)=>{ const r=player.rootAt(k); setGhost(i,k.pose,r.x,r.z,k.yaw, .75-i*.05); }); }
    else if(player.state==='loco'&&player.amt>.1){ const h=player.heading(); for(let i=1;i<=2;i++){ const dd=player.speed*.25*i; setGhost(i-1,gaitPose(player.style,player.phase+i*Math.PI/2*(.25*player.speed/(cycleLen(player.style)/4)),player.amt),player.x+h.x*dd,player.z+h.z*dd,player.yaw,.28/i); } }
  }
  for(const d of decals){ if(d.life>0){ d.life-=dt; d.m.material.opacity=clamp(d.life/1.4,0,1)*.9; if(d.life<=0) d.m.visible=false; } }
  if(genTimer>0){ genTimer-=dt; if(genTimer<=0) genEl.classList.remove('show'); }
  goalMarker.rotation.y+=dt*2;
  // camera
  camTarget.lerp(tmpV.set(player.x,1.0,player.z),1-Math.exp(-dt*6));
  camera.position.set(camTarget.x+Math.sin(camYaw)*Math.cos(camPitch)*camDist, camTarget.y+Math.sin(camPitch)*camDist, camTarget.z+Math.cos(camYaw)*Math.cos(camPitch)*camDist);
  camera.lookAt(camTarget);
  sun.position.set(player.x+6,12,player.z+5); sun.target.position.set(player.x,0,player.z); sun.target.updateMatrixWorld();
  renderer.render(scene,camera);
  drawHud();
  fpsAcc+=dt; fpsN++; if(fpsAcc>.5){ fps=fpsN/fpsAcc; fpsAcc=0; fpsN=0; }
  statT+=dt; if(statT>.1){ statT=0; updStatus(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// debug/smoke hooks
window.__mb = { player, get crowd(){return crowd;}, setCrowd, selectStyle, setGoal:(x,z)=>{goal={x,z};goalMarker.position.set(x,.02,z);goalMarker.visible=true;}, STYLES };
