/* Cath Lab Run: geometry, catheter, lesions and the X-ray image renderer. No game state. */
"use strict";
/* ---------- geometry ---------- */
function crPt(p0,p1,p2,p3,t){const t2=t*t,t3=t2*t;const f=i=>0.5*(2*p1[i]+(-p0[i]+p2[i])*t+(2*p0[i]-5*p1[i]+4*p2[i]-p3[i])*t2+(-p0[i]+3*p1[i]-3*p2[i]+p3[i])*t3);return [f(0),f(1),f(2)]}
function sample(ctrl,step){const out=[];for(let i=0;i<ctrl.length-1;i++){const p0=ctrl[Math.max(0,i-1)],p1=ctrl[i],p2=ctrl[i+1],p3=ctrl[Math.min(ctrl.length-1,i+2)];const n=Math.max(2,Math.ceil(dist3(p1,p2)/step));for(let k=0;k<n;k++)out.push(crPt(p0,p1,p2,p3,k/n))}out.push(ctrl[ctrl.length-1].slice());const ld=[0];for(let i=1;i<out.length;i++)ld.push(ld[i-1]+dist3(out[i-1],out[i]));return {p:out,ld}}
function pointAt(S,s){const ld=S.ld;if(s<=0)return S.p[0].slice();if(s>=ld[ld.length-1])return S.p[S.p.length-1].slice();let lo=0,hi=ld.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(ld[m]<=s)lo=m;else hi=m}const f=(s-ld[lo])/(ld[hi]-ld[lo]||1);return add(S.p[lo],mul(sub(S.p[hi],S.p[lo]),f))}

/* ---------- anatomy ----------
   buildAnatomy(spec) rebuilds the live coronary tree in place: VESSELS, VBY, MAXD, the ostia and the coverage
   segments. The default spec is the usual right-dominant pattern. Random patients pass a variant:
   dom 'R' | 'L' | 'C' (right, left or co-dominant), ramus (a ramus intermedius), shortLM (a stubby left main),
   rca 'normal' | 'anterior' | 'posterior' (where the RCA leaves the right sinus), d1 'normal' | 'large' | 'small',
   om2 (second obtuse marginal present), tort {seed, amp} (the pattern and strength of natural tortuosity). */
const VESSELS=[],VBY={},MAXD={L:0,R:0},OST={},OSTDIR={},OSTANG={},MAP_SEGS=[];
const ANATOMY_DEFAULT={dom:'R',ramus:false,shortLM:false,rca:'normal',d1:'normal',om2:true,tort:{seed:0,amp:1}};
let ANATOMY=ANATOMY_DEFAULT;
/* Natural tortuosity: a smooth 3D wave field nudges every vessel point by up to ~2 mm. Because it depends only
   on position, a branch moves exactly with its parent at the join. It fades to nothing near the two ostia
   (engagement is unchanged) and grows towards the periphery, where real coronaries are curliest. */
const TORT_W0=[[0.41,0.13,0.29,0.3],[0.17,0.37,-0.22,1.7],[-0.26,0.21,0.35,4.1],[0.33,-0.28,0.12,2.6],[0.09,0.44,0.19,5.3],[-0.38,-0.1,0.27,0.9]];
function tortField(osts,seed,ampK){
  const W=TORT_W0.map((w,i)=>[w[0],w[1],w[2],w[3]+seed*(1.3+0.7*i)]);
  return p=>{
    const d=Math.min(...osts.map(o=>dist3(p,o))),amp=ampK*clamp((d-6)/14,0,1)*(1.1+0.9*clamp((d-20)/60,0,1));
    const w=i=>{const a=W[i],b=W[i+3];return 0.6*Math.sin(a[0]*p[0]+a[1]*p[1]+a[2]*p[2]+a[3])+0.4*Math.sin(b[0]*p[0]+b[1]*p[1]+b[2]*p[2]+b[3])};
    return [p[0]+amp*w(0),p[1]+amp*w(1),p[2]+amp*w(2)];
  };
}
function anatomyDefs(sp){
  const cp=o=>JSON.parse(JSON.stringify(o)),V=VARIANT_PARTS;
  let defs=cp(VESSEL_DEFS);const by=id=>defs.find(v=>v.id===id),drop=(...ids)=>{defs=defs.filter(v=>!ids.includes(v.id))};
  if(sp.dom==='L'){
    const r=by('RCA');r.ctrl=r.ctrl.slice(0,5);r.r0=1.6;r.r1=0.9;drop('PDA','PLV');
    const c=by('LCx');c.ctrl=c.ctrl.concat(cp(V.LCX_LONG).slice(1));c.r0=2.0;c.r1=1.1;
    const om=by('OM1');om.r0=1.3;defs.push(cp(V.LPDA));
  }else if(sp.dom==='C'){
    drop('PLV');const c=by('LCx');c.ctrl=c.ctrl.concat(cp(V.LCX_MID).slice(1));c.r0=1.85;c.r1=0.95;defs.push(cp(V.LPL));
    const r=by('RCA');r.r0=1.8;r.r1=1.0;
  }
  if(sp.ramus)defs.splice(defs.findIndex(v=>v.id==='LCx'),0,cp(V.RI));
  if(sp.d1==='large'){const d=by('D1');d.r0=1.45;d.r1=0.65}
  else if(sp.d1==='small'){const d=by('D1');d.r0=0.8;d.r1=0.35;d.ctrl=d.ctrl.slice(0,3)}
  if(!sp.om2)drop('OM2');
  if(sp.rca!=='normal'&&V.RCA_ORIGIN[sp.rca]){const r=by('RCA'),o=V.RCA_ORIGIN[sp.rca];r.ctrl[0]=o[0];r.ctrl[1]=o[1]}
  if(sp.shortLM){ // shift the whole left tree back towards the ostium
    const lm=by('LM'),end=lm.ctrl[2],dl=[-4.5,0.5,-1],sh=q=>[q[0]+dl[0],q[1]+dl[1],q[2]+dl[2]];
    for(const v of defs)if(v.sys==='L'&&v.id!=='LM')v.ctrl=v.ctrl.map(sh);
    lm.ctrl=[lm.ctrl[0],[14.5,40.2,-3.8],sh(end)];
  }
  return defs;
}
function buildAnatomy(spec){
  const sp=ANATOMY={...ANATOMY_DEFAULT,...(spec||{}),tort:{...ANATOMY_DEFAULT.tort,...((spec&&spec.tort)||{})}};
  const defs=anatomyDefs(sp);
  const o={L:defs.find(v=>v.id==='LM').ctrl[0].slice(),R:defs.find(v=>v.id==='RCA').ctrl[0].slice()};
  for(const v of defs){const c=o[v.sys];v.ctrl=v.ctrl.map(q=>q.map((x,i)=>c[i]+(x-c[i])*TREE_SCALE));v.r0*=TREE_RSCALE;v.r1*=TREE_RSCALE}
  const tortuous=tortField([o.L,o.R],sp.tort.seed,sp.tort.amp);
  VESSELS.length=0;for(const k in VBY)delete VBY[k];MAXD.L=MAXD.R=0;
  for(const v of defs){
    const s=sample(v.ctrl,1.1);s.p=s.p.map(tortuous);
    if(v.parent){const P=VBY[v.parent];let bq=P.p[0],bd=1e9;for(const q of P.p){const d=dist3(q,s.p[0]);if(d<bd){bd=d;bq=q}}s.p[0]=bq.slice()} // a branch starts exactly on its parent
    for(let i=1;i<s.p.length;i++)s.ld[i]=s.ld[i-1]+dist3(s.p[i-1],s.p[i]);
    v.p=s.p;v.ld=s.ld;v.len=s.ld[s.ld.length-1];v.n=v.p.length;
    v.anc=new Set();
    if(v.parent){const P=VBY[v.parent];let bi=0,bd=1e9;P.p.forEach((q,i)=>{const d=dist3(q,v.p[0]);if(d<bd){bd=d;bi=i}});v.base=P.base+P.ld[bi];v.joinIdx=bi;P.anc.forEach(a=>v.anc.add(a));v.anc.add(P.id)}else v.base=0;
    v.r=v.ld.map(d=>v.r0+(v.r1-v.r0)*d/v.len);
    MAXD[v.sys]=Math.max(MAXD[v.sys],v.base+v.len);
    VBY[v.id]=v;VESSELS.push(v);
  }
  OST.L=VBY.LM.p[0];OST.R=VBY.RCA.p[0];
  OSTDIR.L=norm(sub(VBY.LM.p[Math.min(3,VBY.LM.n-1)],VBY.LM.p[0]));OSTDIR.R=norm(sub(VBY.RCA.p[3],VBY.RCA.p[0]));
  OSTANG.L=Math.atan2(OST.L[2]-ROOT[2],OST.L[0]-ROOT[0])/D2R;OSTANG.R=Math.atan2(OST.R[2]-ROOT[2],OST.R[0]-ROOT[0])/D2R;
  MAP_SEGS.length=0;for(const v of VESSELS){const parts=v.id==='LM'||v.len<30?1:3;for(let j=0;j<parts;j++)MAP_SEGS.push({key:v.id+':'+j,v,j,parts})}
  return sp;
}
buildAnatomy();
const AO=sample(AO_CTRL,2);
AO.len=AO.ld[AO.ld.length-1];
const S_ROOT=AO.len-18;
let S_EXCH=0;for(let i=0;i<AO.p.length;i++){if(AO.p[i][1]>40){S_EXCH=AO.ld[i];break}}
let S_ARCH0=0,S_ARCH1=0;{let f=false;for(let i=0;i<AO.p.length;i++){if(AO.p[i][1]>95){if(!f){S_ARCH0=AO.ld[i];f=true}S_ARCH1=AO.ld[i]}}}
const AO_ASC=AO.p.filter((q,i)=>AO.ld[i]>AO.len-80);

function basis(aDeg,bDeg){const a=aDeg*D2R,b=bDeg*D2R;const d=[Math.sin(a)*Math.cos(b),Math.sin(b),Math.cos(a)*Math.cos(b)];const r=[Math.cos(a),0,-Math.sin(a)];const u=[d[1]*r[2]-d[2]*r[1],d[2]*r[0]-d[0]*r[2],d[0]*r[1]-d[1]*r[0]];return {d,r,u}}
function motion(p,k){
  if(k<=0)return p;
  const dr=dist3(p,ROOT);const w=clamp((dr-5)/40,0,1)*k;const s=-0.08*w;
  let x=p[0]+(p[0]-HC[0])*s,y=p[1]+(p[1]-HC[1])*s+2.5*w,z=p[2]+(p[2]-HC[2])*s;
  const ang=0.07*w,cx=x-HC[0],cz=z-HC[2];
  return [HC[0]+cx*Math.cos(ang)-cz*Math.sin(ang),y,HC[2]+cx*Math.sin(ang)+cz*Math.cos(ang)];
}
function proj(p,B){const q=sub(p,ISO);return [CX+dot(q,B.r)*SCALE,CY-dot(q,B.u)*SCALE]}
function contraction(ph){return ph>0.13&&ph<0.5?Math.pow(Math.sin(Math.PI*(ph-0.13)/0.37),1.2):0}

/* ---------- catheter ---------- */
function angDiff(a,b){let d=(a-b)%360;if(d>180)d-=360;if(d<-180)d+=360;return Math.abs(d)}
function cathState(c,D){
  const out={u:0,eng:null,deep:false,pts:null,tip:null,region:''};
  const sBody=Math.min(c.s,S_ROOT);
  const pts=[];for(let i=0;i<AO.p.length&&AO.ld[i]<sBody;i++)pts.push(AO.p[i]);
  const base=pointAt(AO,sBody);pts.push(base);
  if(c.s<=S_ROOT){
    out.pts=pts;out.tip=base;
    out.region=c.s<S_ARCH0?'Descending aorta':c.s<=S_ARCH1?'Aortic arch':'Ascending aorta';
    return out;
  }
  const u=(c.s-S_ROOT)/22;out.u=u;
  const th=c.th*D2R,dir=[Math.cos(th),0,Math.sin(th)];
  // the preformed curve opens out gradually as it leaves the aorta, so the tip never jumps
  const sm=x=>{x=clamp(x,0,1);return x*x*(3-2*x)},open=sm(u/0.55);
  const reach=Math.min(1,0.5+u),free=add(ROOT,add(mul(dir,19*reach),[0,5*reach,0]));
  let tip=add(mul(base,1-open),mul(free,open));
  const C=CATH[c.type],tol=D?D.tol[C.sys]:C.tol,deepU=D?D.deep:1.5;
  if(u>=0.55&&angDiff(c.th,OSTANG[C.sys])<tol){out.eng=C.sys;out.deep=u>deepU;
    // slide into the ostium over a few millimetres instead of snapping
    const ost=add(OST[C.sys],mul(OSTDIR[C.sys],Math.max(0,u-1)*11)),w=sm((u-0.55)/0.3);tip=add(mul(tip,1-w),mul(ost,w))}
  const full=add(ROOT,add(mul(dir,c.type==='JL'?-13:-6),[0,c.type==='JL'?22:12,0]));
  const ctrl=add(mul(mul(add(base,tip),0.5),1-open),mul(full,open));
  for(let i=1;i<=20;i++){const t=i/20,a=(1-t)*(1-t),b=2*(1-t)*t,cc=t*t;pts.push([a*base[0]+b*ctrl[0]+cc*tip[0],a*base[1]+b*ctrl[1]+cc*tip[1],a*base[2]+b*ctrl[2]+cc*tip[2]])}
  out.pts=pts;out.tip=tip;
  out.region=out.eng?(out.deep?'Deep-seated':'Engaged '+(out.eng==='L'?'LMCA':'RCA')):'Aortic root';
  return out;
}

/* ---------- lesions ---------- */
function prepLesions(list){
  return list.map(L0=>{
    const L={...L0,at:L0.at*TREE_SCALE};
    const v=VBY[L.vid];let i=0;while(i<v.n-1&&v.ld[i]<L.at)i++;
    const t=norm(sub(v.p[Math.min(v.n-1,i+2)],v.p[Math.max(0,i-2)]));
    let e=norm(L.e);e=norm(sub(e,mul(t,dot(e,t))));
    return {...L,sys:v.sys,idx:i,t,e,pos:v.p[i],gd:v.base+L.at,label:segLabel(v,L.at)};
  });
}
function apparent(L,B,sev=L.sev){
  const t2=[dot(L.t,B.r),dot(L.t,B.u)];const len2=Math.hypot(t2[0],t2[1])||1e-6;
  const n2=[-t2[1]/len2,t2[0]/len2];const f=Math.abs(dot(L.e,B.r)*n2[0]+dot(L.e,B.u)*n2[1]);
  return sev*(0.28+0.72*f)*Math.min(1,0.3+len2*1.25);
}
function refDiam(vid,ld){const v=VBY[vid];let i=0;while(i<v.n-1&&v.ld[i]<ld)i++;return 2*v.r[i]}
/* What a stent s {vid,ld,len,diam,atm} does to lesion L. Returns null if it misses the lesion entirely. */
function stentOutcome(L,s){
  if(L.vid!==s.vid)return null;
  const off=Math.abs(L.at-s.ld);if(off>s.len/2+L.len/2)return null;
  const refD=refDiam(L.vid,L.at),diff=s.diam-refD,before=L.cur!=null?L.cur:L.sev;
  const covered=off+L.len/2<=s.len/2+0.5,under=diff<-0.4,over=diff>0.75,lowP=s.atm<12;
  const noPre=L.sev>=0.9&&!L.predil;
  let res=under?0.3:0.05;if(lowP)res+=0.12;if(noPre)res+=0.15;if(!covered)res=Math.max(res,before*0.6);
  return {residual:Math.min(before,res),refD,diff,covered,under,over,lowP,noPre};
}
/* Plain balloon angioplasty b {vid,ld,len,diam,atm} on lesion L. Leaves recoil (about 30–45% residual) unless
   it is post-dilating a stent. Oversizing by more than 0.5 mm risks dissection. */
function balloonOutcome(L,b){
  if(L.vid!==b.vid)return null;
  const off=Math.abs(L.at-b.ld);if(off>b.len/2+L.len/2)return null;
  const refD=refDiam(L.vid,L.at),diff=b.diam-refD,before=L.cur!=null?L.cur:L.sev;
  const covered=off+L.len/2<=b.len/2+0.5,over=diff>0.5,under=diff<-0.75,lowP=b.atm<8;
  let res;
  if(L.stented)res=(!under&&!lowP)?Math.min(before,0.02):before;
  else res=(under||lowP)?before*0.85:Math.max(0.3,before*0.45);
  if(!covered)res=Math.max(res,before*0.8);
  return {residual:Math.min(before,res),refD,diff,covered,over,under,lowP,post:!!L.stented};
}
function segLabel(v,ld){if(v.id==='LM')return 'left main';const f=ld/v.len;return (f<0.33?'proximal ':f<0.66?'mid ':'distal ')+v.name}

/* ---------- static image layers ---------- */
const noise=[];for(let n=0;n<4;n++){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const id=g.createImageData(256,256);for(let i=0;i<id.data.length;i+=4){const v=128+(Math.random()+Math.random()-1)*80;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255}g.putImageData(id,0,0);noise.push(c)}
const vign=document.createElement('canvas');vign.width=vign.height=W;{const g=vign.getContext('2d');const rg=g.createRadialGradient(W/2,W/2,W*0.32,W/2,W/2,W*0.74);rg.addColorStop(0,'rgba(0,0,0,0)');rg.addColorStop(1,'rgba(0,0,0,0.62)');g.fillStyle=rg;g.fillRect(0,0,W,W)}
const bgCache=new Map();
function getBg(a,b){
  const key=Math.round(a)+'|'+Math.round(b);if(bgCache.has(key))return bgCache.get(key);
  const c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d');const B=basis(a,b);
  g.fillStyle='rgb(178,178,176)';g.fillRect(0,0,W,W);
  for(const x of [-62,66]){const q=proj([x,45,-5],B);const rg=g.createRadialGradient(q[0],q[1],10,q[0],q[1],170);rg.addColorStop(0,'rgba(255,255,255,0.26)');rg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=rg;g.fillRect(0,0,W,W)}
  {const q=proj(HC,B);const rg=g.createRadialGradient(q[0],q[1],20,q[0],q[1],78*SCALE);rg.addColorStop(0,'rgba(0,0,0,0.17)');rg.addColorStop(0.75,'rgba(0,0,0,0.11)');rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.fillRect(0,0,W,W)}
  // ribs: twelve pairs, each articulating with its thoracic vertebra (T1 at the top of the spine below). A rib runs
  // back and out from the spine to its angle, sweeps round the side of the chest, then slopes down and forwards
  // to the costochondral junction, three or four levels below where it started. The posterior part is dense with
  // a thick lower cortex (the costal groove); the anterior part is flatter and fainter, and the cartilage that
  // joins it to the sternum barely shows. Ribs 11 and 12 are short and float free.
  {const RX=[50,76,94,106,114,120,123,124,122,116,104,90],RZ=[44,60,73,80,85,87,87,85,81,75,66,56];
   const XE=[30,36,42,49,56,64,73,83,93,104,0,0],DROP=[24,42,56,66,73,77,79,77,71,60,22,14];
   g.lineCap='round';g.lineJoin='round';
   for(let i=0;i<12;i++){
    const y0=154-27*i+9,Rx=RX[i],Rz=RZ[i],zc=-100+Rz;
    const pmax=i>=10?(i===10?1.35:1.05):Math.PI-Math.asin(clamp((XE[i]-14)/Rx,0,1));
    for(const sd of [-1,1]){
     const N=44,C=[],U=[],L=[],F=[];
     for(let k=0;k<=N;k++){
      const ph=pmax*k/N,f=k/N;
      const y=y0+5*Math.sin(Math.min(1,ph/0.8)*Math.PI/2)-DROP[i]*Math.pow(Math.max(0,ph-0.5)/Math.max(0.3,pmax-0.5),1.5);
      const c=[sd*(14+Rx*Math.sin(ph)),y,zc-Rz*Math.cos(ph)],w=(i===0?10:8)+3*f*(i<10?1:0.2);
      C.push(c);U.push(proj([c[0],y+w/2,c[2]],B));L.push(proj([c[0],y-w/2,c[2]],B));F.push(f);
     }
     // bone body
     g.beginPath();U.forEach((q,k)=>k?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));for(let k=N;k>=0;k--)g.lineTo(L[k][0],L[k][1]);g.closePath();
     g.fillStyle='rgba(0,0,0,0.045)';g.fill();
     // cortical edges, fading towards the front
     for(let k=0;k<N;k++){const fade=1-0.55*F[k];
      g.beginPath();g.moveTo(U[k][0],U[k][1]);g.lineTo(U[k+1][0],U[k+1][1]);g.lineWidth=1.6;g.strokeStyle=`rgba(0,0,0,${(0.12*fade).toFixed(3)})`;g.stroke();
      g.beginPath();g.moveTo(L[k][0],L[k][1]);g.lineTo(L[k+1][0],L[k+1][1]);g.lineWidth=2.6;g.strokeStyle=`rgba(0,0,0,${(0.15*fade).toFixed(3)})`;g.stroke()}
     // rib head and neck against the vertebra
     {const h=proj([sd*9,y0-1,-92],B);g.beginPath();g.ellipse(h[0],h[1],4.5,5.5,0,0,7);g.fillStyle='rgba(0,0,0,0.06)';g.fill()}
     // costal cartilage to the sternum (only the upper ten reach it, directly or via the costal margin)
     if(i<10){const e=C[N],st=[sd*(i<7?11:24+6*(i-7)),e[1]-(i<7?6+3*i:18),i<7?84:70],q0=proj(e,B),q1=proj(st,B);
      g.beginPath();g.moveTo(q0[0],q0[1]);g.lineTo(q1[0],q1[1]);g.lineWidth=7;g.strokeStyle='rgba(0,0,0,0.018)';g.stroke()}
    }
   }
   // clavicles: S-shaped, from the sternal notch out to the acromion
   for(const sd of [-1,1]){const P=[[sd*16,150,66],[sd*60,156,52],[sd*104,160,22],[sd*140,170,-12]].map(p=>proj(p,B));
    g.beginPath();g.moveTo(P[0][0],P[0][1]);g.bezierCurveTo(P[1][0],P[1][1],P[2][0],P[2][1],P[3][0],P[3][1]);
    g.lineWidth=13*SCALE*0.75;g.strokeStyle='rgba(0,0,0,0.06)';g.stroke();g.lineWidth=2;g.strokeStyle='rgba(0,0,0,0.05)';g.stroke()}
  }
  // spine: vertebral bodies with cortical rims and endplates, pedicles, transverse and spinous processes
  {const sx=0.75+0.25*Math.abs(Math.cos(a*D2R)),sy=Math.abs(Math.cos(b*D2R));
   const P=(x,y,z)=>proj([x,y,z],B),line=(p,q,w,col)=>{g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(q[0],q[1]);g.lineWidth=w;g.strokeStyle=col;g.stroke()};
   g.lineCap='round';g.lineJoin='round';
   for(let y=-170;y<=180;y+=27){
    const q=P(2,y,-84),w=36*SCALE*sx,h=21*SCALE*sy+4,x0=q[0]-w/2,x1=q[0]+w/2,y0=q[1]-h/2,y1=q[1]+h/2,ws=w*0.06,r=Math.min(8,h/3);
    // body: flared endplates and a concave waist
    const body=()=>{g.beginPath();g.moveTo(x0+r,y0);g.lineTo(x1-r,y0);g.quadraticCurveTo(x1,y0,x1,y0+r);g.quadraticCurveTo(x1-ws,q[1],x1,y1-r);g.quadraticCurveTo(x1,y1,x1-r,y1);g.lineTo(x0+r,y1);g.quadraticCurveTo(x0,y1,x0,y1-r);g.quadraticCurveTo(x0+ws,q[1],x0,y0+r);g.quadraticCurveTo(x0,y0,x0+r,y0);g.closePath()};
    body();g.fillStyle='rgba(0,0,0,0.13)';g.fill();g.lineWidth=2.5;g.strokeStyle='rgba(0,0,0,0.13)';g.stroke();
    // trabecular grain, denser along the endplates
    g.save();body();g.clip();g.lineWidth=1;g.strokeStyle='rgba(0,0,0,0.035)';
    for(let i=1;i<9;i++){const xx=x0+w*i/9;g.beginPath();g.moveTo(xx,y0);g.lineTo(xx+(i%2?1.5:-1.5),y1);g.stroke()}
    g.fillStyle='rgba(0,0,0,0.08)';g.fillRect(x0,y0,w,3.5);g.fillRect(x0,y1-3.5,w,3.5);g.restore();
    // transverse processes reaching out towards the rib heads
    for(const s of [-1,1]){const a0=P(2+s*15,y+4,-98),a1=P(2+s*31,y+6,-104);line(a0,a1,7,'rgba(0,0,0,0.085)');line(a0,a1,2,'rgba(0,0,0,0.05)')}
    // pedicles seen end-on: oval rings with a dense cortex
    for(const s of [-1,1]){const pq=P(2+s*13,y+4,-96);g.beginPath();g.ellipse(pq[0],pq[1],5.5*sx,8*sy+1.5,0,0,7);g.strokeStyle='rgba(0,0,0,0.16)';g.lineWidth=3;g.stroke();g.fillStyle='rgba(0,0,0,0.04)';g.fill()}
    // laminae meeting in the midline, and the spinous process projecting down over the body below
    {const l0=P(2-12,y+1,-106),l1=P(2+12,y+1,-106),m=P(2,y-4,-112),sp=P(2,y-15,-122);
     g.beginPath();g.moveTo(l0[0],l0[1]);g.quadraticCurveTo(m[0],m[1]-2,l1[0],l1[1]);g.lineWidth=2.5;g.strokeStyle='rgba(0,0,0,0.07)';g.stroke();
     g.beginPath();g.ellipse((m[0]+sp[0])/2,(m[1]+sp[1])/2,4*sx+1,Math.max(3,Math.abs(sp[1]-m[1])/2+3),0,0,7);g.fillStyle='rgba(0,0,0,0.07)';g.fill();g.strokeStyle='rgba(0,0,0,0.1)';g.lineWidth=1.5;g.stroke()}
   }}
  // diaphragm
  g.beginPath();for(let x=-150;x<=150;x+=6){const y=-58-Math.pow((x-6)/60,2)*12+(x>20?-8:0)*Math.min(1,(x-20)/40);const q=proj([x,y,0],B);x===-150?g.moveTo(q[0],q[1]):g.lineTo(q[0],q[1])}
  g.lineTo(W+50,W+400);g.lineTo(-50,W+400);g.closePath();const dg=g.createLinearGradient(0,W*0.7,0,W);dg.addColorStop(0,'rgba(0,0,0,0.2)');dg.addColorStop(1,'rgba(0,0,0,0.28)');g.fillStyle=dg;g.fill();
  // ECG electrodes and leads on the skin
  for(const e of [[-74,-30,96],[82,-48,90],[-60,110,70]]){const q=proj(e,B);g.beginPath();g.arc(q[0],q[1],9,0,7);g.strokeStyle='rgba(0,0,0,0.42)';g.lineWidth=2.5;g.stroke();g.beginPath();g.arc(q[0],q[1],3,0,7);g.fillStyle='rgba(0,0,0,0.5)';g.fill();g.beginPath();g.moveTo(q[0],q[1]);g.bezierCurveTo(q[0]+30,q[1]+40,q[0]-10,q[1]+120,q[0]+40,q[1]+260);g.lineWidth=1.6;g.strokeStyle='rgba(0,0,0,0.32)';g.stroke()}
  if(bgCache.size>40)bgCache.delete(bgCache.keys().next().value);
  bgCache.set(key,c);return c;
}

/* ---------- rendering ---------- */
let ictx=null; // set by js/game.js (or a test) to the 2D context the image is drawn into
const dcan=document.createElement('canvas');dcan.width=dcan.height=W;const dctx=dcan.getContext('2d');
const grey=v=>{const n=Math.round(clamp(v,0,1)*255);return 'rgb('+n+','+n+','+n+')'};
let lastProj=null;
function renderImage(st){
  const B=basis(st.a,st.b),k=contraction(st.phase);
  const ctx=ictx;ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.drawImage(getBg(st.a,st.b),0,0);
  dctx.globalCompositeOperation='source-over';dctx.fillStyle='#fff';dctx.fillRect(0,0,W,W);
  dctx.globalCompositeOperation='darken';dctx.lineCap='round';dctx.lineJoin='round';
  if(st.root>0.02){
    const pp=AO_ASC.map(p=>proj(motion(p,k*0.5),B));
    dctx.beginPath();pp.forEach((q,i)=>i?dctx.lineTo(q[0],q[1]):dctx.moveTo(q[0],q[1]));dctx.lineWidth=26*SCALE;dctx.strokeStyle=grey(1-0.4*st.root);dctx.stroke();
    for(const o of [[-7,-4,6],[8,-5,-3],[-1,-5,-9]]){const q=proj(add(ROOT,o),B);dctx.beginPath();dctx.arc(q[0],q[1],9*SCALE,0,7);dctx.fillStyle=grey(1-0.42*st.root);dctx.fill()}
  }
  const sevNow=L=>L.cur!=null?L.cur:L.sev;
  const app=st.lesions.map(L=>apparent(L,B,sevNow(L)));
  const projV=[];
  for(const v of VESSELS){
    const xs=new Float32Array(v.n),ys=new Float32Array(v.n),cs=new Float32Array(v.n);
    const les=[];st.lesions.forEach((L,i)=>{if(L.vid===v.id)les.push([L,app[i]])});
    const slow=st.lesions.filter(L=>sevNow(L)>=0.9&&L.sys===v.sys&&(L.vid===v.id||v.anc.has(L.vid)));
    for(let i=0;i<v.n;i++){
      const q=proj(motion(v.p[i],k),B);xs[i]=q[0];ys[i]=q[1];
      const d=v.base+v.ld[i];let delay=d/FLOW[v.sys],att=1-0.35*d/MAXD[v.sys];
      for(const L of slow){if(d>L.gd){delay+=(d-L.gd)/FLOW[v.sys]*2.4;att*=0.72}}
      cs[i]=st.conc(v.sys,st.t-delay)*att;
    }
    projV.push({v,xs,ys,cs});
    for(let i=0;i<v.n-1;i++){
      const c=(cs[i]+cs[i+1])/2;if(c<0.02)continue;
      let rf=1;for(const [L,ap] of les){const dd=Math.abs(v.ld[i]-L.at),h=L.len/2;if(dd<h)rf*=1-ap*0.5*(1+Math.cos(Math.PI*dd/h))}
      const r=v.r[i]*rf,w=Math.max(1.1,2*r*SCALE),dens=0.5+0.5*Math.min(1,r/1.5);
      dctx.beginPath();dctx.moveTo(xs[i],ys[i]);dctx.lineTo(xs[i+1],ys[i+1]);
      dctx.lineWidth=w;dctx.strokeStyle=grey(1-0.6*c*dens);dctx.stroke();
      dctx.lineWidth=w*0.5;dctx.strokeStyle=grey(1-0.86*c*dens);dctx.stroke();
    }
  }
  if(st.pci)drawPCI(st.pci,projV);
  if(st.cath){
    const cs=st.cathState;const pp=cs.pts.map(p=>proj(motion(p,k),B));
    dctx.beginPath();pp.forEach((q,i)=>i?dctx.lineTo(q[0],q[1]):dctx.moveTo(q[0],q[1]));
    dctx.lineWidth=5.2;dctx.strokeStyle=grey(0.5);dctx.stroke();
    const tq=pp[pp.length-1];dctx.beginPath();dctx.arc(tq[0],tq[1],2.8,0,7);dctx.fillStyle=grey(0.36);dctx.fill();
    if(st.wire){const p2=proj(motion(add(cs.tip,[0,14,0]),k),B);dctx.beginPath();dctx.moveTo(tq[0],tq[1]);dctx.lineTo(p2[0],p2[1]);dctx.lineWidth=1.6;dctx.strokeStyle=grey(0.35);dctx.stroke()}
  }
  ctx.globalCompositeOperation='multiply';ctx.drawImage(dcan,0,0);
  ctx.globalCompositeOperation='overlay';ctx.globalAlpha=st.mode==='cine'?0.11:0.26;ctx.imageSmoothingEnabled=true;ctx.drawImage(noise[st.frame%4],0,0,W,W);
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(vign,0,0);
  lastProj={B,k,projV};
  if(st.marks&&st.marks.length){
    ctx.lineWidth=2;ctx.font='600 13px "IBM Plex Mono", monospace';
    st.marks.forEach((m,i)=>{const q=proj(motion(m.p3,k),B);ctx.strokeStyle='#f2a53b';ctx.beginPath();ctx.arc(q[0],q[1],13,0,7);ctx.stroke();ctx.fillStyle='#f2a53b';ctx.fillText(String(i+1),q[0]+15,q[1]-10)});
  }
}


/* Wire, balloon and stents, drawn along the already-projected vessels. */
function drawPCI(pci,projV){
  const PV={};projV.forEach(P=>PV[P.v.id]=P);
  const chain=(vid,end)=>{const P=PV[vid],v=P.v,e=end==null?v.n-1:end,own=[];for(let i=0;i<=e;i++)own.push([P.xs[i],P.ys[i]]);return v.parent?chain(v.parent,v.joinIdx).concat(own):own};
  const seg=(vid,ld,len)=>{const P=PV[vid],v=P.v,out=[];for(let i=0;i<v.n;i++)if(Math.abs(v.ld[i]-ld)<=len/2)out.push([P.xs[i],P.ys[i]]);return out};
  for(const s of pci.stents){
    const q=seg(s.vid,s.ld,s.len);if(q.length<2)continue;const hw=s.diam/2*SCALE;
    dctx.beginPath();
    for(let j=0;j<q.length;j++){const a=q[Math.max(0,j-1)],b=q[Math.min(q.length-1,j+1)];let nx=a[1]-b[1],ny=b[0]-a[0];const l=Math.hypot(nx,ny)||1;const sg=j%2?1:-1;const x=q[j][0]+nx/l*hw*sg,y=q[j][1]+ny/l*hw*sg;j?dctx.lineTo(x,y):dctx.moveTo(x,y)}
    dctx.lineWidth=1.1;dctx.strokeStyle=grey(0.55);dctx.stroke();
  }
  const b=pci.balloon;
  if(b){const q=seg(b.vid,b.ld,b.len);if(q.length>1){
    if(b.inflate>0.02){dctx.beginPath();q.forEach((p,i)=>i?dctx.lineTo(p[0],p[1]):dctx.moveTo(p[0],p[1]));dctx.lineWidth=b.diam*SCALE*(0.3+0.7*Math.min(1,b.inflate));dctx.strokeStyle=grey(0.5);dctx.stroke()}
    for(const p of [q[0],q[q.length-1]]){dctx.beginPath();dctx.arc(p[0],p[1],2.6,0,7);dctx.fillStyle=grey(0.22);dctx.fill()}}}
  const w=pci.wire;
  if(w){const q=chain(w.vid);const n=Math.max(2,Math.round(q.length*w.frac));dctx.beginPath();for(let i=0;i<n;i++)i?dctx.lineTo(q[i][0],q[i][1]):dctx.moveTo(q[i][0],q[i][1]);dctx.lineWidth=1.5;dctx.strokeStyle=grey(0.3);dctx.stroke()}
}

/* ---------- coverage segments (MAP_SEGS, built with the anatomy): used to score how much of the tree was opacified ---------- */
const mapKey=(v,ld)=>{const parts=v.id==='LM'||v.len<30?1:3;return v.id+':'+Math.min(parts-1,Math.floor(ld/v.len*parts))};

const angLabel=(a,b)=>(a===0?'AP':(a>0?'LAO ':'RAO ')+Math.abs(a)+'°')+(b===0?'':(b>0?' CRA ':' CAU ')+Math.abs(b)+'°');
