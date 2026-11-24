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
let ANAT_VER=0; // bumps on every rebuild so the cached backgrounds redraw the heart sketch for the new tree
function buildAnatomy(spec){
  ANAT_VER++;
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
/* The catheter does not run down the middle of the aorta: round the arch it is pushed against the outer wall (the
   greater curvature), by up to 7 mm where the aorta bends most. Off at the descending aorta's straight run and in
   the root, so the path still meets the root smoothly. */
const AO_CATH=(()=>{const n=AO.p.length,out=[];
  for(let i=0;i<n;i++){const a=AO.p[Math.max(0,i-6)],b=AO.p[Math.min(n-1,i+6)],mid=mul(add(a,b),0.5),o=sub(AO.p[i],mid),l=Math.hypot(o[0],o[1],o[2]);
    const ld=AO.ld[i],w=clamp((ld-(S_ARCH0-60))/40,0,1)*clamp((S_ROOT-12-ld)/30,0,1);
    out.push(l>1e-6?add(AO.p[i],mul(o,Math.min(7,l*15)*w/l)):AO.p[i].slice())}
  return {p:out,ld:AO.ld}})();

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
/* Torque: the operator turns the hub; the tip follows through a springy shaft that drags on the aortic wall.
   Small turns wind the shaft up without moving the tip (static friction); once the stored twist beats the friction the
   tip breaks free, and a big stored twist overshoots ("whip"). Moving the catheter in or out frees it, so torque goes
   through smoothly, as in the lab. cat = {th (tip, deg), hub (deg), w (tip spin, deg/s)}; fric = static friction (deg
   of twist the wall can hold). Returns the twist still stored in the shaft. */
function stepTorque(cat,dt,o){
  const wrap=a=>{a=(a+540)%360-180;return a},K=60,Cd=o.damp!=null?o.damp:8,dyn=o.dyn!=null?o.dyn:0.5;
  const F=o.fric*(o.moving?0.25:1)*(o.engaged?1.8:1);
  if(!o.fric){cat.th=wrap(cat.hub);cat.hub=wrap(cat.hub);cat.w=0;return 0} // no wall friction (Easy): the tip follows the hub exactly
  for(let t=0;t<dt-1e-9;t+=1/120){const h=Math.min(1/120,dt-t),tw=wrap(cat.hub-cat.th);
    if(Math.abs(tw)<=F&&Math.abs(cat.w)<5){cat.w=0;continue}
    // once it slips only the dynamic grip (dyn × static) holds it back: low dyn releases the stored twist all at once
    const acc=K*(tw-Math.sign(cat.w||tw)*F*dyn)-Cd*cat.w;cat.w+=acc*h;cat.th+=cat.w*h}
  cat.th=wrap(cat.th);cat.hub=wrap(cat.hub);
  return wrap(cat.hub-cat.th);
}
function cathState(c,D){
  const out={u:0,eng:null,deep:false,pts:null,tip:null,region:''};
  const sBody=Math.min(c.s,S_ROOT);
  const pts=[];for(let i=0;i<AO_CATH.p.length&&AO.ld[i]<sBody;i++)pts.push(AO_CATH.p[i]);
  const base=pointAt(AO_CATH,sBody);pts.push(base);
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
  const inWin=angDiff(c.th,OSTANG[C.sys])<tol;
  if(inWin&&u>0.4){
    // slide into the ostium over the last few millimetres before engaging, so an engaged tip is always seated in it
    const ost=add(OST[C.sys],mul(OSTDIR[C.sys],Math.max(0,u-1)*11)),w=sm((u-0.4)/0.15);tip=add(mul(tip,1-w),mul(ost,w));
    if(u>=0.55){out.eng=C.sys;out.deep=u>deepU}
  }
  const full=add(ROOT,add(mul(dir,c.type==='JL'?-13:-6),[0,c.type==='JL'?22:12,0]));
  let ctrl=add(mul(mul(add(base,tip),0.5),1-open),mul(full,open));
  // pushing on without an ostium to go into: the tip meets the aortic valve, the curve folds and the body loops up
  // (prolapse). The tip is driven down onto the valve and the shaft bows upwards.
  if(!out.eng&&u>1){const b=sm((u-1)/0.5);out.buckle=b;
    tip=add(mul(tip,1-0.75*b),mul(add(ROOT,add(mul(dir,6),[0,-16,0])),0.75*b));ctrl=add(ctrl,[0,18*b,0])}
  for(let i=1;i<=20;i++){const t=i/20,a=(1-t)*(1-t),b=2*(1-t)*t,cc=t*t;pts.push([a*base[0]+b*ctrl[0]+cc*tip[0],a*base[1]+b*ctrl[1]+cc*tip[1],a*base[2]+b*ctrl[2]+cc*tip[2]])}
  out.pts=pts;out.tip=tip;
  out.region=out.eng?(out.deep?'Deep-seated':'Engaged '+(out.eng==='L'?'LMCA':'RCA')):out.buckle>0.3?'Prolapsing onto the aortic valve':'Aortic root';
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
/* ---------- PCI complications ----------
   Events are {kind:'dissection'|'noreflow'|'perforation'|'spasm', vid, ld (mm along the vessel), len, ...}.
   Dissections narrow the vessel as they progress (0–1) and close it at 1 unless a stent covers them; no-reflow leaves
   the stent open but slows flow beyond it (flow 0–1) until vasodilators restore it. A perforation leaks blood (and
   contrast) into the pericardium until it is sealed; flow beyond it is preserved. Spasm is a smooth, concentric,
   reversible narrowing (sev 0–1) that limits flow only when tight. */
function evDownstream(v,i,ev){
  const E=VBY[ev.vid];if(!E||v.sys!==E.sys)return false;
  if(v.id===ev.vid)return v.ld[i]>ev.ld;
  if(!v.anc.has(ev.vid))return false;
  let cur=v;while(cur.parent!==ev.vid)cur=VBY[cur.parent];
  return E.ld[cur.joinIdx]>ev.ld;
}
function evFlow(ev){
  if(ev.kind==='noreflow')return ev.flow;if(ev.kind==='perforation')return 1;
  if(ev.kind==='spasm')return 1-clamp((ev.sev-0.7)*2.6,0,0.85);
  return ev.treated?1:ev.closed?0:1-0.85*ev.progress;
}
/* Blood leaking into the pericardium, as a fraction of a tamponading effusion per second. */
function perfLeak(ev,x){if(ev.sealed)return 0;return (ev.grade==='major'?1/45:1/150)*(x&&x.protamine?0.4:1)*(x&&x.balloon?0:1)*(ev.temporised?0.5:1)}
/* Chance of a perforation after a balloon or stent (diff = device minus vessel diameter, mm), or a distal wire exit. */
function perfRisk(x){if(x.kind==='wire')return x.hydrophilic?0.045:0.03;return (x.diff>1?0.5:0)+(x.atm>16?0.22:0)}
/* Chance of spasm: catheter engagement (the RCA is touchier), deep-seating, or the wire crossing. */
function spasmRisk(x){return x.cause==='deep'?0.35:x.cause==='wire'?0.06:x.sys==='R'?0.1:0.05}
/* Extra transit delay (s) and attenuation of contrast at point i of vessel v from all events. */
function flowMod(v,i,events){
  let delay=0,att=1;if(!events)return {delay,att};
  const d=v.base+v.ld[i];
  for(const ev of events){if(!evDownstream(v,i,ev))continue;const f=evFlow(ev);if(f>0.995)continue;
    const g=VBY[ev.vid].base+ev.ld;delay+=Math.max(0,d-g)/FLOW[v.sys]*(1/Math.max(0.08,f)-1)*1.5;att*=f<0.03?0:0.2+0.8*f}
  return {delay,att};
}
function stentCovers(st,ev){return st.vid===ev.vid&&Math.abs(st.ld-ev.ld)<=st.len/2+1}
/* Chance of no-reflow after a stent, and of a dissection after a balloon or stent, before the difficulty factor. */
function noReflowRisk(x){return Math.min(0.45,0.06+(x.acs?0.16:0)+(x.sev>=0.9?0.1:0)+(x.len>=24?0.05:0))}
function dissectRisk(x){if(x.over)return 1;if(x.atm>16)return 0.5;return x.kind==='balloon'?(x.stented?0:x.sev>=0.85?0.1:0.03):0.04}

/* ---------- flow estimates (end-of-case report) ----------
   Maximal (hyperaemic) flow through a stenosis as a share of a normal vessel, from the diameter stenosis: about
   0.9 at 50%, 0.7 at 70%, 0.5 at 80%, 0.2 at 90%. This is roughly what the FFR measures. Lesions in series multiply. */
function stenFlow(ds){ds=clamp(ds,0,0.995);const r=ds/(1-ds);return 1/(1+0.1*Math.pow(r,1.6))}
/* FFR measured by a pressure wire whose sensor sits at ld (mm) along vid: every narrowing between the ostium and the
   sensor counts (its own vessel up to the sensor, and its parents up to where this vessel branches off).
   useCur = after treatment (treated severities). Below 0.80 the narrowing limits flow enough to treat. */
function ffrAt(vid,ld,lesions,useCur){
  const v=VBY[vid];if(!v)return 1;let f=1;
  for(const L of lesions){
    let up=L.vid===vid&&L.at-L.len/2<ld;
    if(!up&&v.anc.has(L.vid)){let cur=v;while(cur.parent!==L.vid)cur=VBY[cur.parent];up=VBY[L.vid].ld[cur.joinIdx]>L.at}
    if(up)f*=stenFlow(useCur&&L.cur!=null?L.cur:L.sev);
  }
  return f;
}
/* the FFR a lesion would read with the sensor just beyond it, before any treatment */
const lesionFFR=(L,lesions)=>ffrAt(L.vid,L.at+L.len/2+6,lesions,false);
/* Flow at the far end of a vessel: its own lesions, lesions upstream of where it branches off, and (after
   treatment) any complication still present upstream. after = use treated severities and the events. */
function vesselFlow(vid,lesions,events,after){
  const v=VBY[vid];if(!v)return {f:1,timi:3,worst:0};
  let f=1,worst=0;
  for(const L of lesions){
    let up=L.vid===vid;
    if(!up&&v.anc.has(L.vid)){let cur=v;while(cur.parent!==L.vid)cur=VBY[cur.parent];up=VBY[L.vid].ld[cur.joinIdx]>L.at}
    if(!up)continue;const ds=after&&L.cur!=null?L.cur:L.sev;worst=Math.max(worst,ds);f*=stenFlow(ds);
  }
  let nr=null,closed=false;
  if(after&&events)for(const ev of events){if(ev.treated&&ev.kind!=='noreflow')continue;if(!evDownstream(v,v.n-1,ev)&&!(ev.vid===vid))continue;
    const e=evFlow(ev);f*=e;if(ev.kind==='noreflow')nr=ev.flow;if(e<0.03)closed=true}
  const timi=closed||f<0.03?0:nr!=null&&nr<0.35?1:worst>=0.9||(nr!=null&&nr<0.92)||f<0.3?2:3;
  return {f,timi,worst};
}

const PLAIN_VESSEL={LM:'main left trunk (left main)',LAD:'front artery (LAD)',LCx:'side artery (circumflex)',RCA:'right artery (RCA)',D1:'first diagonal branch',D2:'second diagonal branch',
  OM1:'first side-wall branch',OM2:'second side-wall branch',RI:'middle branch (ramus)',PDA:'underside branch (PDA)',LPDA:'underside branch (PDA)',PLV:'back-wall branch',LPL:'back-wall branch',
  AM:'right-edge branch',S1:'first septal branch',S2:'second septal branch',CON:'conus branch'};
const vesselName=id=>(PLAIN&&PLAIN_VESSEL[id])||(VBY[id]?VBY[id].name:id);
function segLabel(v,ld){
  if(PLAIN){const n=PLAIN_VESSEL[v.id]||v.name;if(v.id==='LM')return n;const f=ld/v.len;return (f<0.33?'start of the ':f<0.66?'middle of the ':'far end of the ')+n}
  if(v.id==='LM')return 'left main';const f=ld/v.len;return (f<0.33?'proximal ':f<0.66?'mid ':'distal ')+v.name}

/* ---------- static image layers ---------- */
const noise=[];for(let n=0;n<4;n++){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const id=g.createImageData(256,256);for(let i=0;i<id.data.length;i+=4){const v=128+(Math.random()+Math.random()-1)*46;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255}g.putImageData(id,0,0);noise.push(c)}
const vign=document.createElement('canvas');vign.width=vign.height=W;{const g=vign.getContext('2d');const rg=g.createRadialGradient(W/2,W/2,W*0.32,W/2,W/2,W*0.74);rg.addColorStop(0,'rgba(120,90,50,0)');rg.addColorStop(1,'rgba(120,90,50,0.32)');g.fillStyle=rg;g.fillRect(0,0,W,W)}
/* The image is drawn at RES× the 512-unit drawing space, so it stays sharp on high-density screens.
   hiCanvas() gives a RES× canvas whose context already draws in 512-unit coordinates. */
let RES=2;
const hiCanvas=()=>{const c=document.createElement('canvas');c.width=c.height=W*RES;const g=c.getContext('2d');g.setTransform(RES,0,0,RES,0,0);return c};
const bgCache=new Map();
const PAPER='#EFE9DC';
/* hand-drawn helpers: a stable pseudo-random number per (i, j), and pencil hatching over the whole canvas (clip it first) */
const hsh=(i,j)=>{const x=Math.sin(i*127.1+j*311.7)*43758.5453;return x-Math.floor(x)};
function hatch(g,deg,gap,lw,col,seed){
  const a=deg*D2R,dx=Math.cos(a),dy=Math.sin(a),nx=-dy,ny=dx,R=W*0.75;g.strokeStyle=col;g.lineCap='round';
  for(let k=-R,n=0;k<=R;k+=gap,n++){const j=(hsh(seed,n)-0.5)*gap*0.5,cx=W/2+nx*(k+j),cy=W/2+ny*(k+j),l=R*(0.8+0.4*hsh(seed+1,n));
    g.lineWidth=lw*(0.7+0.6*hsh(seed+2,n));g.beginPath();g.moveTo(cx-dx*l,cy-dy*l);g.lineTo(cx+dx*l,cy+dy*l);g.stroke()}
}
/* ---------- heart sketch over the fluoroscopy ----------
   A very light pencil drawing of the heart where it really lies, in every projection, following standard
   radiographic cardiac anatomy. In the frontal view the right heart border is the superior vena cava above and the
   right atrium below; the left border runs from the aortic knob over the main pulmonary artery and the left atrial
   appendage to the left ventricle, whose apex points left, forwards and down onto the diaphragm. The right ventricle
   lies in front (retrosternal), the left atrium is the most posterior chamber, just in front of the spine, and the
   atrioventricular and interventricular grooves (where the coronaries run) mark the borders between the chambers.
   The ventricular mass is fitted to the patient's own coronary tree (which lies on its surface), so the sketch fits
   every anatomy. HEART_MODE: 'chambers' (Easy: outline, chambers, grooves and labels), 'outline' (Medium: the
   cardiac silhouette only) or 'none' (Hard). js/game.js sets it for each case. */
let HEART_MODE='outline';
const FIBO=(()=>{const out=[],n=90,g=Math.PI*(3-Math.sqrt(5));for(let i=0;i<n;i++){const y=1-2*(i+0.5)/n,r=Math.sqrt(1-y*y);out.push([Math.cos(g*i)*r,y,Math.sin(g*i)*r])}return out})();
function hull2(P){P=P.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[],up=[];
  for(const p of P){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p)}
  for(let i=P.length-1;i>=0;i--){const p=P[i];while(up.length>1&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p)}
  return lo.slice(0,-1).concat(up.slice(0,-1))}
function smoothClosed(g,pts,jit,seed){const n=pts.length;g.beginPath();
  for(let i=0;i<=n;i++){const a=pts[i%n],b=pts[(i+1)%n],m=[(a[0]+b[0])/2+(hsh(seed,i)-0.5)*jit,(a[1]+b[1])/2+(hsh(seed+9,i)-0.5)*jit];i?g.quadraticCurveTo(a[0],a[1],m[0],m[1]):g.moveTo(m[0],m[1])}}
/* eigenvectors of a symmetric 3×3 matrix (Jacobi rotations); returns [{val, vec}] */
function eig3(A){A=A.map(r=>r.slice());let V=[[1,0,0],[0,1,0],[0,0,1]];
  for(let sweep=0;sweep<30;sweep++)for(const [p,q] of [[0,1],[0,2],[1,2]]){if(Math.abs(A[p][q])<1e-9)continue;
    const th=(A[q][q]-A[p][p])/(2*A[p][q]),t=Math.sign(th||1)/(Math.abs(th)+Math.sqrt(th*th+1)),c=1/Math.sqrt(t*t+1),s=t*c;
    for(let k=0;k<3;k++){const a=A[k][p],b=A[k][q];A[k][p]=c*a-s*b;A[k][q]=s*a+c*b}
    for(let k=0;k<3;k++){const a=A[p][k],b=A[q][k];A[p][k]=c*a-s*b;A[q][k]=s*a+c*b}
    for(let k=0;k<3;k++){const a=V[k][p],b=V[k][q];V[k][p]=c*a-s*b;V[k][q]=s*a+c*b}}
  return [0,1,2].map(i=>({val:A[i][i],vec:[V[0][i],V[1][i],V[2][i]]}))}
/* an ellipsoid on the points' own principal axes, just reaching their furthest extent along each axis (the
   coronaries lie on the heart's surface), plus a margin (mm) for the epicardial fat they run in */
function fitEllipsoid(pts,margin){
  const n=pts.length,m=[0,0,0];for(const p of pts)for(let i=0;i<3;i++)m[i]+=p[i]/n;
  const C=[[0,0,0],[0,0,0],[0,0,0]];for(const p of pts){const d=sub(p,m);for(let i=0;i<3;i++)for(let j=0;j<3;j++)C[i][j]+=d[i]*d[j]/n}
  let c=m.slice();const ax=[];
  for(const e of eig3(C)){let lo=1e9,hi=-1e9;for(const p of pts){const t=dot(sub(p,m),e.vec);lo=Math.min(lo,t);hi=Math.max(hi,t)}c=add(c,mul(e.vec,(lo+hi)/2));ax.push({u:e.vec,r:(hi-lo)/2+margin})}
  return {c,ax};
}
const ell=(c,ax)=>({c,ax:ax.map(([u,r])=>({u:norm(u),r}))});
const ellPts=e=>FIBO.map(f=>{let p=e.c.slice();e.ax.forEach((a,i)=>{p=add(p,mul(a.u,a.r*f[i]))});return p});
/* atria, appendages and great vessels (mm), placed relative to the coronary tree: the RA behind the right AV groove,
   the LA behind the left main and circumflex, in front of the spine */
const HEART_PARTS={
  RA:ell([-38,14,-12],[[[1,0,0.2],22],[[0,1,0],30],[[-0.2,0,1],21]]),
  LA:ell([18,30,-46],[[[1,0,0],30],[[0,1,0],18],[[0,0,1],19]]),
  LAA:ell([36,36,-14],[[[0.5,0.2,0.8],13],[[0,1,0],8],[[0.8,0,-0.5],8]]),
  RAA:ell([-20,38,14],[[[-0.4,0.2,0.9],13],[[0,1,0],9],[[0.9,0,0.4],8]]),
};
const PA_TRUNK=[[14,40,32],[20,54,24],[26,66,10],[30,71,-2]],PA_L=[[30,71,-2],[44,74,-12],[58,72,-20]],PA_R=[[30,71,-2],[12,72,-12],[-8,70,-16]];
const SVC_LINE=[[-30,46,-14],[-29,80,-14],[-27,126,-14]],IVC_LINE=[[-30,-12,-30],[-29,-50,-32],[-28,-95,-34]];
/* the three great branches off the top of the aortic arch, right to left: brachiocephalic, left common carotid,
   left subclavian */
const ARCH_BRANCHES=[[[-8,114,-2],[-12,132,-4],[-16,152,-6]],[[0,118,-16],[1,136,-17],[2,156,-18]],[[6,115,-30],[11,132,-32],[18,150,-34]]];
function heartGeometry(){
  const ids=['LAD','D1','D2','RI','LCx','OM1','OM2','RCA','AM','PDA','PLV','LPDA','LPL'],pts=[];
  for(const id of ids){const v=VBY[id];if(!v)continue;const from=id==='RCA'?0.3:id==='LCx'?0.25:0;for(let i=Math.floor(v.n*from);i<v.n;i+=2)pts.push(v.p[i])}
  const all=[];for(const v of VESSELS)for(let i=0;i<v.n;i+=2)all.push(v.p[i]);const mc=m3(pts);
  return {V:fitEllipsoid(pts,4),pts:all.map(p=>add(p,mul(norm(sub(p,mc)),4)))};
}
const m3=pts=>{const m=[0,0,0];for(const p of pts)for(let i=0;i<3;i++)m[i]+=p[i]/pts.length;return m};
/* the cardiac silhouette as a filled mask for view B: the ventricles (the rounded fit, merged with the coronary
   tree's own outline so every vessel stays inside), the atria and appendages, the aorta, pulmonary trunk and cavae */
function heartMask(B,geo){
  const P=q=>proj(q,B),{V,pts}=geo||heartGeometry(),parts=HEART_PARTS,hullOf=e=>hull2(ellPts(e).map(P));
  const c=hiCanvas(),m=c.getContext('2d');m.fillStyle='#000';m.strokeStyle='#000';m.lineCap='round';m.lineJoin='round';
  for(const e of [V,parts.RA,parts.LA,parts.LAA,parts.RAA]){smoothClosed(m,hullOf(e),0,0);m.fill()}
  smoothClosed(m,hull2(pts.map(P)),0,0);m.fill();
  for(const [pts3,r] of heartTubes()){if(pts3===PA_L||pts3===PA_R)continue; // the pulmonary branches are hilar, not part of the cardiac outline
    const q=pts3.map(P);m.beginPath();q.forEach((p,i)=>i?m.lineTo(p[0],p[1]):m.moveTo(p[0],p[1]));m.lineWidth=2*r*SCALE;m.stroke()}
  return c;
}
const heartTubes=()=>[[AO.p.filter((p,i)=>i%3===0&&p[1]>-110),13],[PA_TRUNK,13],[PA_L,8.5],[PA_R,8.5],[SVC_LINE,10],[IVC_LINE,11],[ARCH_BRANCHES[0],6],[ARCH_BRANCHES[1],4.5],[ARCH_BRANCHES[2],5]];
function drawHeartSketch(g,B){
  if(HEART_MODE==='none')return;
  const P=q=>proj(q,B),ink=a=>`rgba(62,54,46,${a})`,geo=heartGeometry(),{V}=geo,parts=HEART_PARTS;
  const hullOf=e=>hull2(ellPts(e).map(P));
  const tubes=heartTubes();
  const pathOf=pts=>{const q=pts.map(P);g.beginPath();q.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]))};
  // the silhouette: fill every part into a mask, then keep a thin ring just outside it
  const mk=hiCanvas;
  const mask=heartMask(B,geo);
  const ringOf=(w,ox,oy)=>{const r=mk(),x=r.getContext('2d');for(let k=0;k<12;k++){const a=k/12*Math.PI*2;x.drawImage(mask,ox+Math.cos(a)*w,oy+Math.sin(a)*w,W,W)}
    x.globalCompositeOperation='destination-out';x.drawImage(mask,ox,oy,W,W);x.globalCompositeOperation='source-in';x.fillStyle='rgb(62,54,46)';x.fillRect(0,0,W,W);return r};
  g.save();
  if(HEART_MODE==='chambers'){const h=mk(),x=h.getContext('2d');hatch(x,-32,8,0.9,ink(0.1),3);x.globalCompositeOperation='destination-in';x.drawImage(mask,0,0,W,W);g.drawImage(h,0,0,W,W)}
  g.globalAlpha=HEART_MODE==='chambers'?0.42:0.34;g.drawImage(ringOf(1.6,0,0),0,0,W,W);g.globalAlpha*=0.5;g.drawImage(ringOf(1.1,1.3,-0.9),0,0,W,W);g.globalAlpha=1;
  if(HEART_MODE==='chambers'){
    g.lineCap='round';g.lineJoin='round';
    // each chamber's own outline, faint, where it overlaps the others
    for(const [e,sd] of [[V,61],[parts.RA,41],[parts.LA,51],[parts.LAA,71],[parts.RAA,81]]){smoothClosed(g,hullOf(e),1.6,sd);g.lineWidth=0.9;g.strokeStyle=ink(0.16);g.stroke()}
    // great vessel walls
    for(const [pts,r] of tubes){const q=pts.map(P);for(const side of [-1,1]){g.beginPath();q.forEach((p,i)=>{const A=q[Math.max(0,i-1)],Bq=q[Math.min(q.length-1,i+1)];let nx=A[1]-Bq[1],ny=Bq[0]-A[0];const l=Math.hypot(nx,ny)||1;const x=p[0]+nx/l*r*SCALE*side,y=p[1]+ny/l*r*SCALE*side;i?g.lineTo(x,y):g.moveTo(x,y)});g.lineWidth=0.9;g.strokeStyle=ink(0.15);g.stroke()}}
    // cardiac veins: the great cardiac vein runs up beside the LAD, then round the left AV groove with the circumflex
    // to the coronary sinus at the back, which empties into the right atrium (dotted: it is behind the heart)
    {const off=(id,o,from,to)=>{const v=VBY[id];if(!v)return [];const out=[];for(let i=Math.floor(v.n*from);i<v.n*to;i+=2){const p=v.p[i],q=v.p[Math.min(v.n-1,i+2)],t=norm(sub(q,p)),side=norm([t[1],-t[0],0.3]);out.push(add(p,mul(side,o)))}return out};
     const gcv=off('LAD',4,0.05,0.85).reverse().concat(off('LCx',-4,0,1));
     g.setLineDash([2,4]);g.beginPath();gcv.forEach((p,i)=>{const q=P(p);i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])});
     const cs=[[54,-12,-56],[30,-34,-50],[6,-44,-42],[-18,-34,-30]].map(P);cs.forEach(q=>g.lineTo(q[0],q[1]));
     g.lineWidth=1.1;g.strokeStyle='rgba(47,93,138,0.35)';g.stroke();g.setLineDash([])}
    // grooves between the chambers: atrioventricular (RCA, circumflex) and interventricular (LAD, PDA)
    g.setLineDash([5,5]);
    for(const id of ['RCA','LCx','LAD','PDA','LPDA']){const v=VBY[id];if(!v)continue;g.beginPath();for(let i=0;i<v.n;i+=2){const q=P(v.p[i]);i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])}g.lineWidth=1;g.strokeStyle=ink(0.2);g.stroke()}
    g.setLineDash([]);
    // labels: the RV on the right/anterior side of the interventricular groove, the LV on the left/posterior side
    const toward=id=>{const v=VBY[id];return v?norm(sub(v.p[Math.floor(v.n*0.6)],V.c)):[0,0,0]};
    const rv=add(V.c,add(mul(toward(VBY.AM?'AM':'RCA'),24),[0,0,14])),lv=add(V.c,mul(toward('OM1'),22));
    g.font='italic 16px "Cormorant Garamond", Georgia, serif';g.fillStyle=ink(0.42);g.textAlign='center';g.textBaseline='middle';
    for(const [t,c] of [['RA',parts.RA.c],['LA',parts.LA.c],['RV',rv],['LV',lv],['Ao',[-6,70,4]],['PA',[24,62,16]],['SVC',[-29,104,-14]],...(B.u[1]>0.9?[['IVC',[-29,-84,-33]]]:[])])
      {const q=P(c);if(q[0]>16&&q[0]<W-16&&q[1]>16&&q[1]<W-16)g.fillText(t,q[0],q[1])}
    g.textAlign='left';g.textBaseline='alphabetic';
  }
  g.restore();
}
function getBg(a,b){
  const key=Math.round(a)+'|'+Math.round(b)+'|'+ANAT_VER+'|'+HEART_MODE;if(bgCache.has(key))return bgCache.get(key);
  const c=hiCanvas(),B=basis(a,b);
  // the anatomy is drawn in black on a transparent layer, then laid on paper as graphite (see the end)
  const lay=hiCanvas(),g=lay.getContext('2d');
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
  g.beginPath();for(let x=-150;x<=150;x+=6){const y=-76-Math.pow((x-6)/60,2)*12+(x>20?-8:0)*Math.min(1,(x-20)/40);const q=proj([x,y,0],B);x===-150?g.moveTo(q[0],q[1]):g.lineTo(q[0],q[1])}
  g.lineTo(W+50,W+400);g.lineTo(-50,W+400);g.closePath();
  g.save();g.clip();hatch(g,-38,6,1.1,'rgba(0,0,0,0.22)',7);hatch(g,52,9,0.9,'rgba(0,0,0,0.1)',8);g.restore();
  g.beginPath();for(let x=-150;x<=150;x+=6){const y=-76-Math.pow((x-6)/60,2)*12+(x>20?-8:0)*Math.min(1,(x-20)/40);const q=proj([x,y,0],B);x===-150?g.moveTo(q[0],q[1]):g.lineTo(q[0],q[1])}
  g.lineWidth=2.2;g.strokeStyle='rgba(0,0,0,0.45)';g.stroke();
  // ECG electrodes and leads on the skin
  for(const e of [[-74,-30,96],[82,-48,90],[-60,110,70]]){const q=proj(e,B);g.beginPath();g.arc(q[0],q[1],9,0,7);g.strokeStyle='rgba(0,0,0,0.42)';g.lineWidth=2.5;g.stroke();g.beginPath();g.arc(q[0],q[1],3,0,7);g.fillStyle='rgba(0,0,0,0.5)';g.fill();g.beginPath();g.moveTo(q[0],q[1]);g.bezierCurveTo(q[0]+30,q[1]+40,q[0]-10,q[1]+120,q[0]+40,q[1]+260);g.lineWidth=1.6;g.strokeStyle='rgba(0,0,0,0.32)';g.stroke()}
  // compose: paper, cross-hatched heart shadow, then the anatomy as graphite drawn twice slightly offset (a sketchy pencil line)
  const gc=c.getContext('2d');gc.fillStyle=PAPER;gc.fillRect(0,0,W,W);
  drawHeartSketch(gc,B);
  const tint=hiCanvas();{const t=tint.getContext('2d');t.drawImage(lay,0,0,W,W);t.globalCompositeOperation='source-in';t.fillStyle='rgb(29,27,25)';t.fillRect(0,0,W,W)}
  gc.globalAlpha=0.9;gc.drawImage(tint,0,0,W,W);gc.globalAlpha=1;
  engraveBg(c);
  if(bgCache.size>16)bgCache.delete(bgCache.keys().next().value);
  bgCache.set(key,c);return c;
}

/* pen-and-ink look: lay engraved hatching over the background, denser and cross-hatched where it is darker, and keep
   the original drawing faintly underneath so fine lines and labels still read. Runs once per view (the result is cached). */
function engraveBg(c){
  const N=200,sm=document.createElement('canvas');sm.width=sm.height=N;const sg=sm.getContext('2d');sg.drawImage(c,0,0,N,N);
  const I=sg.getImageData(0,0,N,N).data,dark=(x,y)=>{if(x<0||y<0||x>=N||y>=N)return 0;const i=((y|0)*N+(x|0))*4;return 1-(I[i]*0.3+I[i+1]*0.59+I[i+2]*0.11)/236};
  const old=document.createElement('canvas');old.width=c.width;old.height=c.height;old.getContext('2d').drawImage(c,0,0);
  const g=c.getContext('2d');g.save();g.setTransform(RES,0,0,RES,0,0);g.fillStyle=PAPER;g.fillRect(0,0,W,W);g.globalAlpha=0.55;g.drawImage(old,0,0,W,W);g.globalAlpha=1;
  g.strokeStyle='rgba(29,27,25,0.78)';g.lineWidth=0.5;g.lineCap='round';
  const pass=(ang,gap,th)=>{const cs=Math.cos(ang),sn=Math.sin(ang),L=W*1.45;g.beginPath();
    for(let k=-L/2;k<L/2;k+=gap){let on=false;for(let t=-L/2;t<L/2;t+=3){const x=W/2+cs*t-sn*k,y=W/2+sn*t+cs*k,d=dark(x/W*N,y/W*N);
      if(d>th){if(!on){g.moveTo(x,y);on=true}else g.lineTo(x,y)}else on=false}}g.stroke()};
  pass(0.12,3.2,0.1);pass(-0.9,3.6,0.22);pass(0.9,3.8,0.34);pass(1.6,3.2,0.48);
  g.restore();
}
/* ---------- rendering ---------- */
let ictx=null; // set by js/game.js (or a test) to the 2D context the image is drawn into
let dcan=hiCanvas(),dctx=dcan.getContext('2d');
/* Each vessel is drawn on its own layer (the lumen never darkens itself where its strokes overlap), then MULTIPLIED
   into the image: transmissions multiply, so attenuation adds, exactly as X-rays do (Beer–Lambert). Where two
   vessels cross, or a branch runs over its parent, the image is darker. */
let vcan=hiCanvas(),vctx=vcan.getContext('2d');
/* drop to a lighter resolution (for slow devices): rebuilds the working canvases and the background cache */
function setResolution(r){if(r===RES)return;RES=r;dcan=hiCanvas();dctx=dcan.getContext('2d');vcan=hiCanvas();vctx=vcan.getContext('2d');bgCache.clear()}
/* ink: v = 1 is bare paper (white in the multiply layer), v = 0 is full blue-black ink */
const INK=[29,27,25];
const grey=v=>{v=clamp(v,0,1);return 'rgb('+Math.round(INK[0]+(255-INK[0])*v)+','+Math.round(INK[1]+(255-INK[1])*v)+','+Math.round(INK[2]+(255-INK[2])*v)+')'};
let lastProj=null;
function renderImage(st){
  const B=basis(st.a,st.b),k=contraction(st.phase);
  const ctx=ictx,sc=ctx.canvas.width/W;ctx.setTransform(sc,0,0,sc,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.drawImage(getBg(st.a,st.b),0,0,W,W);
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
      for(const L of slow){if(d>L.gd){delay+=(d-L.gd)/FLOW[v.sys]*2.4;att*=sevNow(L)>=0.98?0.04:0.72}} // a total occlusion lets almost nothing past (TIMI 0)
      if(st.events){const m=flowMod(v,i,st.events);delay+=m.delay;att*=m.att}
      // the bolus front spreads as it travels (dispersion): average the concentration over a window that widens with transit time
      const sp=0.06+0.14*delay,t0=st.t-delay;
      cs[i]=(st.conc(v.sys,t0-sp)+2*st.conc(v.sys,t0)+st.conc(v.sys,t0+sp))/4*att;
    }
    projV.push({v,xs,ys,cs});const rws=new Float32Array(v.n);
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,any=false;
    for(let i=0;i<v.n;i++){if(cs[i]<0.02)continue;any=true;x0=Math.min(x0,xs[i]);x1=Math.max(x1,xs[i]);y0=Math.min(y0,ys[i]);y1=Math.max(y1,ys[i])}
    const pad=v.r0*SCALE*1.5+6;x0=Math.max(0,Math.floor(x0-pad));y0=Math.max(0,Math.floor(y0-pad));x1=Math.min(W,Math.ceil(x1+pad));y1=Math.min(W,Math.ceil(y1+pad));
    if(any){vctx.globalCompositeOperation='source-over';vctx.fillStyle='#fff';vctx.fillRect(x0,y0,x1-x0,y1-y0);vctx.globalCompositeOperation='darken';vctx.lineCap='round';vctx.lineJoin='round'}
    // a branch's first millimetres lie inside its parent's lumen: leave them to the parent, or the junction would
    // count twice and show a dark bead at every branch point
    const skip=v.parent?VBY[v.parent].r[v.joinIdx]*1.7:0;
    for(let i=0;any&&i<v.n-1;i++){
      const c=(cs[i]+cs[i+1])/2;if(c<0.02||v.ld[i+1]<skip)continue;
      let rf=1;for(const [L,ap] of les){const dd=Math.abs(v.ld[i]-L.at),h=L.len/2;if(dd<h)rf*=1-ap*0.5*(1+Math.cos(Math.PI*dd/h))}
      if(st.events)for(const ev of st.events){if(ev.vid!==v.id)continue;const dd=Math.abs(v.ld[i]-ev.ld),h=ev.len/2;if(dd>=h)continue;
        if(ev.kind==='dissection'&&!ev.treated)rf*=1-(ev.closed?0.85:0.25+0.55*ev.progress)*0.5*(1+Math.cos(Math.PI*dd/h));
        else if(ev.kind==='spasm'&&ev.sev>0.02)rf*=1-ev.sev*0.5*(1+Math.cos(Math.PI*dd/h))}
      // a round lumen: X-rays crossing its middle travel through more contrast than at its edge (chord length), so
      // three nested strokes give the darker centre and softer walls of a real opacified artery
      const r=v.r[i]*rf,w=Math.max(1.1,2*r*SCALE),dens=0.5+0.5*Math.min(1,r/1.5);
      vctx.beginPath();vctx.moveTo(xs[i],ys[i]);vctx.lineTo(xs[i+1],ys[i+1]);
      vctx.lineWidth=w;vctx.strokeStyle=grey(1-0.42*c*dens);vctx.stroke();
      vctx.lineWidth=w*0.72;vctx.strokeStyle=grey(1-0.66*c*dens);vctx.stroke();
      vctx.lineWidth=w*0.4;vctx.strokeStyle=grey(1-0.86*c*dens);vctx.stroke();
      rws[i]=r;
    }
    if(any){dctx.globalCompositeOperation='multiply';dctx.drawImage(vcan,x0*RES,y0*RES,(x1-x0)*RES,(y1-y0)*RES,x0,y0,x1-x0,y1-y0);dctx.globalCompositeOperation='darken'}
    // pen outline along both walls of the filled lumen, re-inked every few frames so the line "boils" like hand-drawn animation
    const boil=Math.floor((st.frame||0)/4);
    for(const side of [-1,1]){dctx.beginPath();let pen=false;
      for(let i=0;i<v.n;i++){const c=i<v.n-1?(cs[i]+cs[i+1])/2:cs[i];if(c<0.12||!rws[i]){pen=false;continue}
        const a=Math.max(0,i-1),b=Math.min(v.n-1,i+1);let nx=ys[a]-ys[b],ny=xs[b]-xs[a];const l=Math.hypot(nx,ny)||1;
        const j=(hsh(i*7+side,boil+v.n)-0.5)*1.3,o=rws[i]*SCALE+0.5+j,x=xs[i]+nx/l*o*side,y=ys[i]+ny/l*o*side;
        pen?dctx.lineTo(x,y):dctx.moveTo(x,y);pen=true}
      dctx.lineWidth=1.15;dctx.strokeStyle=grey(1-0.9*Math.min(1,Math.max(...cs)*1.2));dctx.stroke()}
  }
  if(st.events){drawDissections(st.events,projV);drawPerforations(st.events,projV)}
  if(st.pci)drawPCI(st.pci,projV);
  if(st.cath){
    const cs=st.cathState;const pp=cs.pts.map(p=>proj(motion(p,k),B));
    dctx.beginPath();pp.forEach((q,i)=>i?dctx.lineTo(q[0],q[1]):dctx.moveTo(q[0],q[1]));
    dctx.lineWidth=5.2;dctx.strokeStyle=grey(0.55);dctx.stroke();
    for(const side of [-1,1]){dctx.beginPath();pp.forEach((q,i)=>{const a=pp[Math.max(0,i-1)],b=pp[Math.min(pp.length-1,i+1)];let nx=a[1]-b[1],ny=b[0]-a[0];const l=Math.hypot(nx,ny)||1;const x=q[0]+nx/l*2.7*side,y=q[1]+ny/l*2.7*side;i?dctx.lineTo(x,y):dctx.moveTo(x,y)});dctx.lineWidth=1;dctx.strokeStyle=grey(0.2);dctx.stroke()}
    const tq=pp[pp.length-1];dctx.beginPath();dctx.arc(tq[0],tq[1],2.8,0,7);dctx.fillStyle=grey(0.36);dctx.fill();
    if(st.wire){const p2=proj(motion(add(cs.tip,[0,14,0]),k),B);dctx.beginPath();dctx.moveTo(tq[0],tq[1]);dctx.lineTo(p2[0],p2[1]);dctx.lineWidth=1.6;dctx.strokeStyle=grey(0.35);dctx.stroke()}
  }
  ctx.globalCompositeOperation='multiply';ctx.drawImage(dcan,0,0,W,W);
  ctx.globalCompositeOperation='overlay';ctx.globalAlpha=st.mode==='cine'?0.07:0.16;ctx.imageSmoothingEnabled=true;ctx.drawImage(noise[st.frame%4],0,0,W,W);
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(vign,0,0,W,W);
  lastProj={B,k,projV};
  if(st.labels)drawVesselLabels(ctx,projV);
  if(st.marks&&st.marks.length){
    ctx.lineWidth=1.4;ctx.font='italic 17px "IM Fell English", Georgia, serif';
    st.marks.forEach((m,i)=>{const q=proj(motion(m.p3,k),B);ctx.strokeStyle='#8A2D1F';ctx.beginPath();ctx.arc(q[0],q[1],14,0,7);ctx.stroke();ctx.lineWidth=0.6;ctx.beginPath();ctx.arc(q[0],q[1],17.5,0,7);ctx.stroke();ctx.lineWidth=1.4;ctx.fillStyle='#8A2D1F';ctx.fillText(String(i+1),q[0]+16,q[1]-10)});
  }
}


/* Wire, balloon and stents, drawn along the already-projected vessels. */
/* A dissection shows as a thin second channel of contrast running beside the lumen (the false lumen behind the
   flap) and a haze of contrast staining the wall that lingers after the injection washes out. */
/* Teaching mode (Easy): name each vessel that is holding contrast, in handwriting beside it. */
const VESSEL_SHORT={LAD:'LAD',D1:'D1',D2:'D2',LCx:'Cx',OM1:'OM1',OM2:'OM2',RI:'Ramus',RCA:'RCA',AM:'AM',PDA:'PDA',PLV:'PL',LPDA:'PDA',LPL:'PL'}; // small septals, conus and the short left main would crowd the bifurcation
function drawVesselLabels(ctx,projV){
  ctx.save();ctx.font='italic 14px "IM Fell English", Georgia, serif';ctx.textBaseline='middle';ctx.lineJoin='round';
  for(const P of projV){
    const v=P.v,name=VESSEL_SHORT[v.id];if(!name)continue;
    const i=Math.min(v.n-2,Math.floor(v.n*(v.id==='LM'?0.5:v.id==='LAD'||v.id==='RCA'||v.id==='LCx'?0.42:0.6)));
    if(P.cs[i]<0.25)continue;
    let nx=P.ys[i-1]-P.ys[i+1],ny=P.xs[i+1]-P.xs[i-1];const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;
    const x=P.xs[i]+nx*14,y=P.ys[i]+ny*14,w=ctx.measureText(name).width;
    ctx.fillStyle='rgba(241,236,225,0.9)';ctx.strokeStyle='rgba(29,27,25,0.7)';ctx.lineWidth=0.8;
    ctx.beginPath();ctx.roundRect?ctx.roundRect(x-w/2-6,y-9,w+12,18,9):ctx.rect(x-w/2-5,y-10,w+10,20);ctx.fill();ctx.stroke();
    ctx.fillStyle='#1d1b19';ctx.fillText(name,x-w/2,y+1);
  }
  ctx.restore();
}
function drawDissections(events,projV){
  for(const ev of events){
    if(ev.kind!=='dissection'||ev.treated)continue;const P=projV.find(x=>x.v.id===ev.vid);if(!P)continue;const v=P.v;
    const ext=ev.len/2+4*ev.progress,idx=[];for(let i=0;i<v.n;i++)if(Math.abs(v.ld[i]-ev.ld)<=ext)idx.push(i);if(idx.length<3)continue;
    // staining
    if(ev.stain>0.03){dctx.beginPath();idx.forEach((i,j)=>j?dctx.lineTo(P.xs[i],P.ys[i]):dctx.moveTo(P.xs[i],P.ys[i]));dctx.lineWidth=(v.r[idx[0]]*3.2)*SCALE;dctx.strokeStyle=grey(1-0.32*Math.min(1,ev.stain));dctx.stroke()}
    // false lumen beside the true lumen, filling with the contrast passing the site
    const c=Math.max(...idx.map(i=>P.cs[i]));if(c<0.05)continue;
    const off=(v.r[idx[0]]+0.7)*SCALE;dctx.beginPath();
    idx.forEach((i,j)=>{const a=idx[Math.max(0,j-1)],b=idx[Math.min(idx.length-1,j+1)];let nx=P.ys[a]-P.ys[b],ny=P.xs[b]-P.xs[a];const l=Math.hypot(nx,ny)||1;
      const taper=Math.sin(Math.PI*(j+0.5)/idx.length),x=P.xs[i]+nx/l*off*taper,y=P.ys[i]+ny/l*off*taper;j?dctx.lineTo(x,y):dctx.moveTo(x,y)});
    dctx.lineWidth=Math.max(1.2,v.r[idx[0]]*0.8*SCALE);dctx.strokeStyle=grey(1-0.7*c);dctx.stroke();
  }
}
/* A perforation squirts a jet of contrast out of the vessel while it is injected, and the contrast that escaped
   pools as a haze beside the heart that hardly washes out. */
function drawPerforations(events,projV){
  for(const ev of events){
    if(ev.kind!=='perforation')continue;const P=projV.find(x=>x.v.id===ev.vid);if(!P)continue;const v=P.v;
    let i=v.ld.findIndex(x=>x>=ev.ld);if(i<0)i=v.n-1;const a=Math.max(0,i-2),b=Math.min(v.n-1,i+2);
    let nx=P.ys[a]-P.ys[b],ny=P.xs[b]-P.xs[a];const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l;
    if(ev.grade==='distal'){nx=(P.xs[b]-P.xs[a])/l;ny=(P.ys[b]-P.ys[a])/l} // a wire exit leaks off the end
    const x0=P.xs[i],y0=P.ys[i],c=P.cs[i];
    if(ev.pool>0.02){const R=(4+9*Math.min(1.5,ev.pool))*SCALE,cx=x0+nx*R*0.6,cy=y0+ny*R*0.6,g=dctx.createRadialGradient(cx,cy,R*0.15,cx,cy,R);
      g.addColorStop(0,grey(1-0.38*Math.min(1,ev.pool)));g.addColorStop(1,'#fff');dctx.fillStyle=g;dctx.beginPath();dctx.arc(cx,cy,R,0,7);dctx.fill()}
    if(!ev.sealed&&c>0.05){const L=(ev.grade==='major'?9:5)*SCALE*Math.min(1,0.4+c);
      dctx.beginPath();dctx.moveTo(x0,y0);dctx.lineTo(x0+nx*L,y0+ny*L);dctx.lineWidth=(ev.grade==='major'?2.2:1.3)*SCALE;dctx.strokeStyle=grey(1-0.75*c);dctx.stroke();
      dctx.beginPath();dctx.arc(x0+nx*L,y0+ny*L,(ev.grade==='major'?2.6:1.6)*SCALE,0,7);dctx.fillStyle=grey(1-0.6*c);dctx.fill()}
  }
}
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
