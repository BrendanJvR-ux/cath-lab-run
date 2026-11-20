/* Cath Lab Run: geometry, catheter, lesions and the X-ray image renderer. No game state. */
"use strict";
/* ---------- geometry ---------- */
function crPt(p0,p1,p2,p3,t){const t2=t*t,t3=t2*t;const f=i=>0.5*(2*p1[i]+(-p0[i]+p2[i])*t+(2*p0[i]-5*p1[i]+4*p2[i]-p3[i])*t2+(-p0[i]+3*p1[i]-3*p2[i]+p3[i])*t3);return [f(0),f(1),f(2)]}
function sample(ctrl,step){const out=[];for(let i=0;i<ctrl.length-1;i++){const p0=ctrl[Math.max(0,i-1)],p1=ctrl[i],p2=ctrl[i+1],p3=ctrl[Math.min(ctrl.length-1,i+2)];const n=Math.max(2,Math.ceil(dist3(p1,p2)/step));for(let k=0;k<n;k++)out.push(crPt(p0,p1,p2,p3,k/n))}out.push(ctrl[ctrl.length-1].slice());const ld=[0];for(let i=1;i<out.length;i++)ld.push(ld[i-1]+dist3(out[i-1],out[i]));return {p:out,ld}}
function pointAt(S,s){const ld=S.ld;if(s<=0)return S.p[0].slice();if(s>=ld[ld.length-1])return S.p[S.p.length-1].slice();let lo=0,hi=ld.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(ld[m]<=s)lo=m;else hi=m}const f=(s-ld[lo])/(ld[hi]-ld[lo]||1);return add(S.p[lo],mul(sub(S.p[hi],S.p[lo]),f))}

const VBY={};
const MAXD={L:0,R:0};
for(const v of VESSELS){
  const s=sample(v.ctrl,1.1);v.p=s.p;v.ld=s.ld;v.len=s.ld[s.ld.length-1];v.n=v.p.length;
  v.anc=new Set();
  if(v.parent){const P=VBY[v.parent];let bi=0,bd=1e9;P.p.forEach((q,i)=>{const d=dist3(q,v.p[0]);if(d<bd){bd=d;bi=i}});v.base=P.base+P.ld[bi];v.joinIdx=bi;P.anc.forEach(a=>v.anc.add(a));v.anc.add(P.id)}else v.base=0;
  v.r=v.ld.map(d=>v.r0+(v.r1-v.r0)*d/v.len);
  MAXD[v.sys]=Math.max(MAXD[v.sys],v.base+v.len);
  VBY[v.id]=v;
}
const OST={L:VBY.LM.p[0],R:VBY.RCA.p[0]};
const OSTDIR={L:norm(sub(VBY.LM.p[3],VBY.LM.p[0])),R:norm(sub(VBY.RCA.p[3],VBY.RCA.p[0]))};
const OSTANG={L:Math.atan2(OST.L[2]-ROOT[2],OST.L[0]-ROOT[0])/D2R,R:Math.atan2(OST.R[2]-ROOT[2],OST.R[0]-ROOT[0])/D2R};
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
  const reach=Math.min(1,0.5+u);let tip=add(ROOT,add(mul(dir,19*reach),[0,5*reach,0]));
  const C=CATH[c.type],tol=D?D.tol[C.sys]:C.tol,deepU=D?D.deep:1.5;
  if(u>=0.55&&angDiff(c.th,OSTANG[C.sys])<tol){out.eng=C.sys;out.deep=u>deepU;tip=add(OST[C.sys],mul(OSTDIR[C.sys],Math.max(0,u-1)*11))}
  const ctrl=add(ROOT,add(mul(dir,c.type==='JL'?-13:-6),[0,c.type==='JL'?22:12,0]));
  for(let i=1;i<=20;i++){const t=i/20,a=(1-t)*(1-t),b=2*(1-t)*t,cc=t*t;pts.push([a*base[0]+b*ctrl[0]+cc*tip[0],a*base[1]+b*ctrl[1]+cc*tip[1],a*base[2]+b*ctrl[2]+cc*tip[2]])}
  out.pts=pts;out.tip=tip;
  out.region=out.eng?(out.deep?'Deep-seated':'Engaged '+(out.eng==='L'?'LMCA':'RCA')):'Aortic root';
  return out;
}

/* ---------- lesions ---------- */
function prepLesions(list){
  return list.map(L=>{
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
  // ribs
  g.lineCap='round';
  for(let y0=170;y0>-110;y0-=25){for(const side of [-1,1]){g.beginPath();for(let k=0;k<=24;k++){const ph=k/24*2.6;const p=[side*(12+110*Math.sin(ph)),y0-40*(ph/Math.PI),-88*Math.cos(ph)];const q=proj(p,B);k?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])}g.lineWidth=9;g.strokeStyle='rgba(0,0,0,0.075)';g.stroke();g.lineWidth=3;g.strokeStyle='rgba(0,0,0,0.05)';g.stroke()}}
  // spine
  for(let y=-170;y<=180;y+=27){
    const q=proj([2,y,-84],B);const w=36*SCALE*(0.75+0.25*Math.abs(Math.cos(a*D2R))),h=21*SCALE*Math.abs(Math.cos(b*D2R))+4;
    g.fillStyle='rgba(0,0,0,0.16)';g.beginPath();g.roundRect?g.roundRect(q[0]-w/2,q[1]-h/2,w,h,8):g.rect(q[0]-w/2,q[1]-h/2,w,h);g.fill();
    g.fillStyle='rgba(0,0,0,0.09)';g.fillRect(q[0]-w/2,q[1]-h/2,w,3);g.fillRect(q[0]-w/2,q[1]+h/2-3,w,3);
    for(const s of [-1,1]){const pq=proj([2+s*14,y+3,-100],B);g.beginPath();g.ellipse(pq[0],pq[1],7,9,0,0,7);g.strokeStyle='rgba(0,0,0,0.12)';g.lineWidth=3;g.stroke()}
  }
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

/* ---------- coronary map sketch (easy mode) ---------- */
const MAP_VIEW=basis(30,10);
const MAP_SEGS=[];for(const v of VESSELS){const parts=v.id==='LM'||v.len<30?1:3;for(let j=0;j<parts;j++)MAP_SEGS.push({key:v.id+':'+j,v,j,parts})}
const mapKey=(v,ld)=>{const parts=v.id==='LM'||v.len<30?1:3;return v.id+':'+Math.min(parts-1,Math.floor(ld/v.len*parts))};
let mapGeom=null;
function drawMap(ctx,mapped){
  const Wd=ctx.canvas.width,Hd=ctx.canvas.height;
  if(!mapGeom){let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;const P={};for(const v of VESSELS){P[v.id]=v.p.map(p=>{const q=proj(p,MAP_VIEW);x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);return q})}
    const sc=Math.min((Wd-20)/(x1-x0),(Hd-40)/(y1-y0));mapGeom={P,f:q=>[10+(q[0]-x0)*sc+((Wd-20)-(x1-x0)*sc)/2,26+(q[1]-y0)*sc],sc}}
  const {P,f,sc}=mapGeom;
  ctx.clearRect(0,0,Wd,Hd);ctx.fillStyle='rgba(12,16,18,0.82)';ctx.fillRect(0,0,Wd,Hd);
  ctx.strokeStyle='rgba(242,165,59,0.35)';ctx.lineWidth=1;ctx.strokeRect(0.5,0.5,Wd-1,Hd-1);
  const h=f(proj(HC,MAP_VIEW)),rt=f(proj(ROOT,MAP_VIEW));
  ctx.strokeStyle='rgba(220,227,230,0.16)';ctx.setLineDash([3,3]);ctx.beginPath();ctx.ellipse(h[0],h[1]+4,62*SCALE*sc/SCALE,52*sc,0.5,0,7);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='rgba(220,227,230,0.35)';ctx.beginPath();ctx.arc(rt[0],rt[1],13*sc,0,7);ctx.stroke();
  ctx.lineCap='round';
  for(const s of MAP_SEGS){const v=s.v,pts=P[v.id],a=Math.floor(s.j/s.parts*(v.n-1)),b=Math.floor((s.j+1)/s.parts*(v.n-1)),on=mapped.has(s.key);
    ctx.beginPath();for(let i=a;i<=b;i++){const q=f(pts[i]);i===a?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1])}
    ctx.setLineDash(on?[]:[2,3]);ctx.lineWidth=on?Math.max(1.6,v.r[a]*1.6):1.1;ctx.strokeStyle=on?'#f2a53b':'rgba(220,227,230,0.4)';ctx.stroke()}
  ctx.setLineDash([]);
  ctx.font='600 13px "IBM Plex Mono", monospace';ctx.fillStyle='rgba(220,227,230,0.8)';
  for(const [id,t] of [['LAD',0.55],['LCx',0.7],['RCA',0.35],['PDA',0.8],['D1',0.8],['OM1',0.9]]){const v=VBY[id],q=f(P[id][Math.floor(t*(v.n-1))]);ctx.fillText(id,q[0]+4,q[1]+3)}
  ctx.fillStyle='rgba(220,227,230,0.95)';ctx.font='600 14px "IBM Plex Mono", monospace';ctx.fillText(`MAP ${[...mapped].length}/${MAP_SEGS.length}`,8,17);
}

const angLabel=(a,b)=>(a===0?'AP':(a>0?'LAO ':'RAO ')+Math.abs(a)+'°')+(b===0?'':(b>0?' CRA ':' CAU ')+Math.abs(b)+'°');
