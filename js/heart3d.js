/* Cath Lab Run: an orbitable 3D view of the patient's heart and coronary tree (three.js, loaded on first use).
   During a case it shows anatomy only (no lesions), starting from the current C-arm angle so you can see what a
   projection is looking at. After the case it adds every lesion (severity before → after), the stents and any
   complications. Needs config.js, sim.js and game.js. */
"use strict";
const THREE_SRC=['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
let threeReady=null;
function loadThree(){
  if(threeReady)return threeReady;
  const load=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)});
  threeReady=load(THREE_SRC[0]).then(()=>load(THREE_SRC[1])).catch(e=>{threeReady=null;throw e});
  return threeReady;
}

let H3=null; // the open viewer: {renderer, scene, camera, controls, raf, el}
const v3=p=>new THREE.Vector3(p[0],p[1],p[2]); // patient mm → scene: x = patient left (viewer's right from the front), y = up, z = anterior

/* a 3-band toon ramp so the shading reads like coloured pencil */
let TOON=null;
function toonMat(color,opts={}){
  if(!TOON){const d=new Uint8Array([90,170,255]);TOON=new THREE.DataTexture(d,3,1,THREE.LuminanceFormat);TOON.minFilter=TOON.magFilter=THREE.NearestFilter;TOON.needsUpdate=true}
  return new THREE.MeshToonMaterial({color,gradientMap:TOON,...opts});
}
const INK3=0x3a3a3a;
/* a tube plus a slightly fatter dark back-face tube round it: the classic inked outline */
const OUTLINE=new Map();
function inkedTube(pts,r,mat,seg){
  const g=new THREE.Group();g.add(new THREE.Mesh(tubeGeo(pts,r,seg),mat));
  const om=OUTLINE.get('ink')||new THREE.MeshBasicMaterial({color:INK3,side:THREE.BackSide});OUTLINE.set('ink',om);
  g.add(new THREE.Mesh(tubeGeo(pts,r+Math.max(0.45,r*0.22),seg),om));return g;
}
/* a handwritten label that always faces the camera */
function label3(text,pos,color='#111111',size=1){
  const c=document.createElement('canvas'),x=c.getContext('2d');x.font='500 36px Inter, system-ui, sans-serif';
  const w=Math.ceil(x.measureText(text).width)+28;c.width=w;c.height=64;
  x.font='500 36px Inter, system-ui, sans-serif';x.fillStyle='rgba(255,255,255,0.9)';x.strokeStyle='rgba(17,17,17,0.25)';x.lineWidth=2;
  x.beginPath();x.roundRect?x.roundRect(3,6,w-6,52,14):x.rect(3,6,w-6,52);x.fill();x.stroke();
  x.fillStyle=color;x.textBaseline='middle';x.fillText(text,14,33);
  const t=new THREE.CanvasTexture(c),s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));
  s.scale.set(w/64*13*size,13*size,1);s.position.copy(pos);s.renderOrder=10;return s;
}
/* an ellipsoid from the sketch model ({c, ax:[{u, r}]}) */
function ellMesh(e,mat){
  const geo=new THREE.SphereGeometry(1,40,28),m=new THREE.Matrix4();
  m.makeBasis(v3(e.ax[0].u),v3(e.ax[1].u),v3(e.ax[2].u));m.scale(new THREE.Vector3(e.ax[0].r,e.ax[1].r,e.ax[2].r));m.setPosition(v3(e.c));
  geo.applyMatrix4(m);return new THREE.Mesh(geo,mat);
}
function tubeGeo(pts,r,seg){const curve=new THREE.CatmullRomCurve3(pts.map(v3));return new THREE.TubeGeometry(curve,seg||Math.max(8,pts.length*2),r,10,false)}

/* build the scene: post = after the case (show disease, devices and complications) */
function buildHeartScene(post){
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xffffff);
  scene.add(new THREE.AmbientLight(0xffffff,0.55));
  const sun=new THREE.DirectionalLight(0xffffff,0.75);sun.position.set(-120,180,260);scene.add(sun);
  const {V}=heartGeometry(),parts=HEART_PARTS;
  // chambers: see-through so the coronaries on the back still show
  const cham=(e,col,op)=>{const g=ellMesh(e,toonMat(col,{transparent:true,opacity:op,depthWrite:false}));g.renderOrder=1;scene.add(g);return g};
  cham(V,0xdedcd8,0.55);cham(parts.RA,0xcfd2d6,0.55);cham(parts.LA,0xe4e1dc,0.55);cham(parts.LAA,0xe4e1dc,0.6);cham(parts.RAA,0xcfd2d6,0.6);
  // great vessels
  const ves=(pts,r,col)=>scene.add(inkedTube(pts,r,toonMat(col)));
  const tubes=heartTubes();
  const colours=[0xbdbdb8,0xa9aeb5,0xa9aeb5,0xa9aeb5,0xa9aeb5,0xa9aeb5,0xbdbdb8,0xbdbdb8,0xbdbdb8];
  tubes.forEach(([pts,r],i)=>{if(i===0)pts=pts.filter(p=>p[1]>18); // the aorta from just below the arch, as anatomy drawings show it
    ves(pts,r*0.95,colours[i]||0xbdbdb8)});
  // coronary tree, each vessel tapering from its origin
  for(const v of VESSELS){
    const pts=v.p.filter((_,i)=>i%2===0||i===v.n-1),r=(v.r0+v.r1)/2*1.15;
    scene.add(inkedTube(pts,Math.max(0.55,r),toonMat(0xe5432d),pts.length*2));
  }
  // labels
  const tl=(t,p,c)=>scene.add(label3(t,v3(p),c));
  tl('RA',parts.RA.c);tl('LA',add(parts.LA.c,[0,0,-14]));tl('Ao',[-8,96,6]);tl('PA',[30,72,10]);tl('SVC',[-29,112,-14]);tl('IVC',[-29,-70,-33]);
  const toward=id=>{const v=VBY[id];return v?norm(sub(v.p[Math.floor(v.n*0.6)],V.c)):[0,0,0]};
  tl('RV',add(V.c,add(mul(toward(VBY.AM?'AM':'RCA'),30),[0,0,26])));tl('LV',add(V.c,mul(toward('OM1'),34)));
  for(const [id,f] of [['LAD',0.55],['LCx',0.6],['RCA',0.45]]){const v=VBY[id];if(v)scene.add(label3(id==='LCx'?'Cx':id,v3(add(v.p[Math.floor(v.n*f)],mul(norm(sub(v.p[Math.floor(v.n*f)],V.c)),9))),'#B32D1A',0.8))}
  if(post&&S){
    // lesions: a ring round the vessel, coloured by what is left, labelled before → after
    for(const L of S.lesions){
      const now=L.cur!=null?L.cur:L.sev,col=now>=0.7?0xc2452d:now>=0.5?0xe39a2d:0x3f7d4c,v=VBY[L.vid],r=v.r[L.idx];
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r*2.2,0.7,10,28),new THREE.MeshBasicMaterial({color:col}));
      ring.position.copy(v3(L.pos));ring.lookAt(v3(add(L.pos,L.t)));scene.add(ring);
      const txt=`${Math.round(L.sev*100)}%${L.cur!=null&&Math.abs(L.cur-L.sev)>0.02?' → '+Math.round(L.cur*100)+'%':''}`;
      scene.add(label3(txt,v3(add(L.pos,mul(norm(sub(L.pos,V.c)),14))),now>=0.7?'#8f2614':now>=0.5?'#8a5a12':'#2f5d3a',0.85));
    }
    // stents: a grey mesh sleeve over the treated segment
    for(const s of S.stents){const v=VBY[s.vid],pts=v.p.filter((_,i)=>Math.abs(v.ld[i]-s.ld)<=s.len/2);if(pts.length<2)continue;
      scene.add(new THREE.Mesh(tubeGeo(pts,s.diam/2*1.1,pts.length*3),new THREE.MeshBasicMaterial({color:s.covered?0x5d5a66:0x8d8a82,wireframe:true})))}
    // complications
    const EVN={dissection:'Dissection',noreflow:'No-reflow',perforation:'Perforation',spasm:'Spasm'};
    for(const e of S.events){const v=VBY[e.vid];let i=v.ld.findIndex(x=>x>=e.ld);if(i<0)i=v.n-1;
      scene.add(label3(`${EVN[e.kind]}${e.treated?' ✓':''}`,v3(add(v.p[i],mul(norm(sub(v.p[i],V.c)),-14))),e.treated?'#2f5d3a':'#8f2614',0.75))}
  }
  return {scene,center:v3(V.c)};
}

/* camera on the C-arm's line of sight (a = LAO+/RAO−, b = CRA+/CAU−), looking at the heart */
function aimCamera(cam,controls,center,a,b){
  const B=basis(a,b);center=center.clone().add(new THREE.Vector3(0,14,0));cam.position.copy(center.clone().add(v3(mul(B.d,470))));cam.up.copy(v3(B.u));cam.lookAt(center);
  if(controls){controls.target.copy(center);controls.update()}
}

function close3D(){
  if(H3){cancelAnimationFrame(H3.raf);H3.ro&&H3.ro.disconnect();H3.renderer.dispose();H3=null}
  document.querySelectorAll('.view3d').forEach(n=>n.remove());
}
async function open3D(post){
  close3D();
  const host=document.getElementById('monitor'),el=document.createElement('div');el.className='view3d';
  el.innerHTML=`<div class="v3bar"><b>${post?'Your patient in 3D':'Heart in 3D · anatomy only'}</b><span class="fine">Drag to turn · scroll or pinch to zoom</span>
    <div class="row"><button class="btn" data-v3="carm">${S?'Your C-arm view':'Front'}</button><button class="btn" data-v3="ap">Front (AP)</button><button class="btn" data-v3="lao">LAO 45</button><button class="btn" data-v3="rao">RAO 30</button><button class="btn primary" data-v3="close">Close</button></div></div>
    <div class="v3stage"><div class="v3msg">Loading the 3D viewer…</div></div>
    ${post?'<div class="v3legend"><span><i style="background:#c2452d"></i>70% or more left</span><span><i style="background:#e39a2d"></i>50–69%</span><span><i style="background:#3f7d4c"></i>under 50% / treated</span><span><i style="background:#8d8a82"></i>stent</span></div>':''}`;
  host.appendChild(el);
  const close=()=>{close3D();el.remove()};
  el.addEventListener('click',e=>{const b=e.target.closest('[data-v3]');if(!b)return;const k=b.dataset.v3;
    if(k==='close'){close();return}
    if(!H3)return;const ang={carm:S?[S.a,S.b]:[0,0],ap:[0,0],lao:[45,0],rao:[-30,0]}[k];aimCamera(H3.camera,H3.controls,H3.center,ang[0],ang[1])});
  try{await loadThree()}catch(e){el.querySelector('.v3msg').textContent='The 3D viewer needs an internet connection the first time (it loads three.js).';return}
  if(!el.isConnected)return;
  const stage=el.querySelector('.v3stage');stage.innerHTML='';
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));stage.appendChild(renderer.domElement);
  const {scene,center}=buildHeartScene(post);
  const camera=new THREE.PerspectiveCamera(32,1,10,3000);
  const controls=new THREE.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=0.12;controls.minDistance=180;controls.maxDistance=900;controls.enablePan=false;
  aimCamera(camera,controls,center,S?S.a:0,S?S.b:0);
  const size=()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix()};
  const ro=new ResizeObserver(size);ro.observe(stage);size();
  H3={renderer,scene,camera,controls,center,el,ro,raf:0};
  const tick=()=>{if(!H3)return;controls.update();renderer.render(scene,camera);H3.raf=requestAnimationFrame(tick)};tick();
}
