/* Cath Lab Run: stroke thrombectomy, the simulation (no page code, so the tests can load it).
   Geometry in millimetres: x = the patient's left, y = up (towards the head), z = forwards.
   The X-ray shows two views side by side, as in a neuro room's biplane: front (AP) on the left, side (lateral) on the
   right. Each vessel runs from its origin (proximal) to its far end (distal), which is also the way blood flows.
   The catheter tip moves along this tree: at each branch it enters the branch if the tip is turned the branch's way
   (its angle, in degrees: 0 = up, 90 = towards the patient's left, 180 = down, 270 = towards the patient's right). */
"use strict";
const SK_STROKE_VER=1;
function skCurve(ctrl,step=2){
  const pts=[];
  for(let i=0;i<ctrl.length-1;i++){const p0=ctrl[Math.max(0,i-1)],p1=ctrl[i],p2=ctrl[i+1],p3=ctrl[Math.min(ctrl.length-1,i+2)],len=Math.hypot(p2[0]-p1[0],p2[1]-p1[1],p2[2]-p1[2]),n=Math.max(2,Math.ceil(len/step));
    for(let k=0;k<n;k++){const t=k/n,t2=t*t,t3=t2*t;pts.push([0,1,2].map(j=>0.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3)))}}
  pts.push(ctrl[ctrl.length-1].slice());return pts;
}
const SK_NAMES={
  AO:['aortic arch','main artery from the heart (aortic arch)'],BCT:['brachiocephalic trunk','first branch off the arch (brachiocephalic)'],
  RSCA:['right subclavian artery','artery to the right arm (subclavian)'],LSCA:['left subclavian artery','artery to the left arm (subclavian)'],
  RCCA:['right common carotid','right neck artery (common carotid)'],LCCA:['left common carotid','left neck artery (common carotid)'],
  RICA:['right internal carotid','right artery into the brain (internal carotid)'],LICA:['left internal carotid','left artery into the brain (internal carotid)'],
  RECA:['right external carotid','right artery to the face (external carotid)'],LECA:['left external carotid','left artery to the face (external carotid)'],
  RM1:['right M1 (middle cerebral)','right main brain artery (middle cerebral, M1)'],LM1:['left M1 (middle cerebral)','left main brain artery (middle cerebral, M1)'],
  RM2s:['right upper M2 branch','right upper branch (M2)'],RM2i:['right lower M2 branch','right lower branch (M2)'],LM2s:['left upper M2 branch','left upper branch (M2)'],LM2i:['left lower M2 branch','left lower branch (M2)'],
  RA1:['right A1 (anterior cerebral)','right front brain artery (anterior cerebral)'],LA1:['left A1 (anterior cerebral)','left front brain artery (anterior cerebral)'],
  RACA:['right anterior cerebral','right front brain artery (anterior cerebral)'],LACA:['left anterior cerebral','left front brain artery (anterior cerebral)'],
  RVA:['right vertebral artery','right back-of-neck artery (vertebral)'],LVA:['left vertebral artery','left back-of-neck artery (vertebral)'],
  BA:['basilar artery','artery at the base of the brain (basilar)'],RPCA:['right posterior cerebral','right back brain artery (posterior cerebral)'],LPCA:['left posterior cerebral','left back brain artery (posterior cerebral)'],
};
/* build the arch, neck and brain arteries. spec: {arch:'I'|'II'|'III', bovine} */
function skAnatomy(spec={}){
  const d={I:0,II:-14,III:-30}[spec.arch||'I'],bov=!!spec.bovine;
  const V={},order=[];
  const add=(id,parent,ctrl,r,rot,o={})=>{const pts=skCurve(ctrl),cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]));
    const v={id,parent,pts,cum,len:cum[cum.length-1],n:pts.length,r,rot,children:[],guideMaxY:o.guideMaxY??1e9,intra:!!o.intra,trap:!!o.trap,link:o.link||null,end:!!o.end};
    if(parent){const P=V[parent];let oi=P.n-1;if(!o.atEnd){let bd=1e9;for(let i=0;i<P.n;i++){const q=P.pts[i],dd=Math.hypot(q[0]-ctrl[0][0],q[1]-ctrl[0][1],q[2]-ctrl[0][2]);if(dd<bd){bd=dd;oi=i}}}
      v.oi=oi;v.os=P.cum[oi];P.children.push(v)}
    V[id]=v;order.push(id);return v};
  // the aorta: up the descending aorta, over the arch, down the ascending aorta to the heart
  add('AO',null,[[24,-125,-22],[24,-70,-20],[22,-28+d,-14],[9,-6+d,-3],[-6,-7+d,6],[-16,-30+d,14],[-18,-95,16]],11,0);
  const top=(x,y,z)=>[x,y+d,z];
  add('BCT','AO',[top(-7,-6,5),[-12,18,6],[-18,38,4]],6,0);
  if(bov)add('LCCA','BCT',[[-10,6,5],[4,40,6],[18,80,7],[27,138,8]],3.5,90,{guideMaxY:1e9});
  else add('LCCA','AO',[top(5,-3,1),[12,30,5],[20,80,7],[27,138,8]],3.5,0);
  add('LSCA','AO',[top(16,-8,-8),[24,15,-8],[36,30,-8],[58,38,-8],[86,30,-8]],4,0);
  add('RSCA','BCT',[[-18,38,4],[-34,45,0],[-58,40,-6],[-86,30,-8]],4,270,{atEnd:true});
  add('RCCA','BCT',[[-18,38,4],[-23,90,6],[-27,138,8]],3.5,0,{atEnd:true});
  for(const S of ['R','L']){const sx=S==='R'?-1:1,lat=S==='R'?270:90,med=S==='R'?90:270;
    add(S+'ICA',S+'CCA',[[sx*27,138,8],[sx*30,170,1],[sx*31,205,-2],[sx*28,222,9],[sx*24,238,14],[sx*22,250,4]],2.4,0,{atEnd:true,guideMaxY:204});
    add(S+'ECA',S+'CCA',[[sx*27,138,8],[sx*22,160,22],[sx*30,185,30],[sx*38,205,34]],2.1,S==='R'?55:305,{atEnd:true,trap:true});
    add(S+'M1',S+'ICA',[[sx*22,250,4],[sx*38,252,2],[sx*54,251,0],[sx*63,253,-2]],1.6,lat,{atEnd:true,intra:true});
    add(S+'M2s',S+'M1',[[sx*63,253,-2],[sx*70,268,4],[sx*73,290,0],[sx*70,306,-6]],1.1,0,{atEnd:true,intra:true,end:true});
    add(S+'M2i',S+'M1',[[sx*63,253,-2],[sx*73,246,-8],[sx*80,250,-22],[sx*82,262,-34]],1.1,180,{atEnd:true,intra:true,end:true});
    add(S+'A1',S+'ICA',[[sx*22,250,4],[sx*11,256,10],[sx*3,262,14]],1.2,med,{atEnd:true,intra:true});
    add(S+'ACA',S+'A1',[[sx*3,262,14],[sx*3,290,24],[sx*4,320,10],[sx*6,334,-10]],1.1,0,{atEnd:true,intra:true,end:true})}
  add('LVA','LSCA',[[30,24,-8],[23,90,-22],[18,150,-26],[12,205,-34],[4,222,-32]],1.8,0,{guideMaxY:160});
  add('RVA','RSCA',[[-32,44,-2],[-23,90,-22],[-18,150,-26],[-12,205,-34],[-4,222,-32]],1.7,0,{guideMaxY:160,link:'BA'});
  add('BA','LVA',[[4,222,-32],[0,234,-30],[0,252,-24],[0,268,-20]],1.8,0,{atEnd:true,intra:true});
  add('LPCA','BA',[[0,268,-20],[16,272,-28],[32,270,-40],[44,264,-52]],1.2,90,{atEnd:true,intra:true,end:true});
  add('RPCA','BA',[[0,268,-20],[-16,272,-28],[-32,270,-40],[-44,264,-52]],1.2,270,{atEnd:true,intra:true,end:true});
  return {V,order,spec:{arch:spec.arch||'I',bovine:bov}};
}
const skPt=(v,s)=>{let i=0;while(i<v.n-1&&v.cum[i+1]<s)i++;const t=v.cum[i+1]>v.cum[i]?Math.min(1,Math.max(0,(s-v.cum[i])/(v.cum[i+1]-v.cum[i]))):0,a=v.pts[i],b=v.pts[Math.min(v.n-1,i+1)];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]};
const skAngDiff=(a,b)=>Math.abs(((a-b)%360+540)%360-180);
/* difficulty: how close the tip's turn must be to a branch's angle to enter it, and how much the tip is drawn in */
// rate: game minutes on the stroke clock per real second
const SK_DIFF={story:{win:70,seek:90,adv:48,micro:22,rate:1/10},easy:{win:55,seek:60,adv:46,micro:20,rate:1/8},medium:{win:36,seek:0,adv:44,micro:18,rate:1/6},hard:{win:24,seek:0,adv:42,micro:16,rate:1/5}};
function skWindow(A,c,dk){const w=SK_DIFF[dk]||SK_DIFF.medium;let win=w.win;if(c.parent==='AO')win-= {I:0,II:5,III:12}[A.spec.arch];return Math.max(12,win)}
/* the catheter: {vid, s, rot, stack:[{vid,s}], deep (microcatheter out)} */
function skNewCath(){return {vid:'AO',s:0,rot:180,stack:[],deep:false,push:0}}
/* move the tip by ds millimetres; returns what happened */
function skMove(A,cat,ds,dk,clot){
  const v=A.V[cat.vid];let out={};
  if(ds>0){
    // a clot slows the microcatheter as it crosses
    if(clot&&cat.vid===clot.vid&&cat.s>clot.s-clot.len/2-1&&cat.s<clot.s+clot.len/2+1)ds*=0.35;
    const ns=cat.s+ds;
    // branches whose openings the tip is passing, entered if it is turned their way
    let best=null,bd=1e9;
    for(const c of v.children){const near=c.os>=v.len-0.5?ns>=v.len-1:Math.abs(ns-c.os)<=3;if(!near)continue;
      if(c.intra&&!cat.deep)continue;const df=skAngDiff(cat.rot,c.rot);if(df<=skWindow(A,c,dk)&&df<bd){bd=df;best=c}}
    if(!best&&v.link&&ns>=v.len-1&&cat.deep&&skAngDiff(cat.rot,0)<=skWindow(A,A.V[v.link],dk))best=A.V[v.link];
    if(best){cat.stack.push({vid:v.id,s:Math.min(ns,v.len)});cat.vid=best.id;cat.s=0;cat.push=0;return {entered:best.id,trap:best.trap}}
    // the guide catheter cannot go into the head: the microcatheter has to
    if(!cat.deep){const p=skPt(v,ns);if(p[1]>v.guideMaxY||v.intra){cat.s=Math.max(cat.s,Math.min(ns,v.len));const q=skPt(v,cat.s);if(q[1]>v.guideMaxY){let s=cat.s;while(s>0&&skPt(v,s)[1]>v.guideMaxY)s-=0.5;cat.s=s}return {blocked:'deep'}}}
    if(ns>=v.len){cat.s=v.len;cat.push+=ds;return {end:true}}
    cat.s=ns;cat.push=0;return out;
  }
  if(ds<0){cat.push=0;let ns=cat.s+ds;
    while(ns<0&&cat.stack.length){const st=cat.stack.pop();cat.vid=st.vid;ns=st.s+ns}
    if(ns<0)ns=0;cat.s=ns;
    // the microcatheter goes back into the guide once the tip is back in the neck
    if(cat.deep){const vv=A.V[cat.vid];if(!vv.intra&&skPt(vv,cat.s)[1]<130){cat.deep=false;out.retracted=true}}
    return out}
  return out;
}
/* which branch the next push would enter from here (or null), using the same rule as skMove */
function skPick(A,cat,dk){const v=A.V[cat.vid];let best=null,bd=1e9;
  for(const c of v.children){const near=c.os>=v.len-0.5?cat.s>=v.len-4:Math.abs(cat.s-c.os)<=3;if(!near||(c.intra&&!cat.deep))continue;const df=skAngDiff(cat.rot,c.rot);if(df<=skWindow(A,c,dk)&&df<bd){bd=df;best=c}}
  if(!best&&v.link&&cat.s>=v.len-4&&cat.deep&&skAngDiff(cat.rot,0)<=skWindow(A,A.V[v.link],dk))best=A.V[v.link];return best}
/* is a branch opening near the tip worth steering towards? returns {child, diff} for the nearest */
function skNearBranch(A,cat){const v=A.V[cat.vid];let best=null;for(const c of v.children){const dist=c.os>=v.len-0.5?v.len-cat.s:Math.abs(cat.s-c.os);if(dist>14)continue;if(!best||dist<best.dist)best={child:c,dist}}return best}
/* where the tip can reach: the path from the aorta, for drawing the catheter */
function skCathPath(A,cat){const segs=[];for(const st of cat.stack)segs.push(st);segs.push({vid:cat.vid,s:cat.s});
  const pts=[];let prevVid=null;for(const sg of segs){const v=A.V[sg.vid];const s0=prevVid?0:0;for(let s=s0;s<=sg.s;s+=2)pts.push(skPt(v,s));pts.push(skPt(v,sg.s));prevVid=sg.vid}return pts}
/* dye: how far along the arteries (from the tip, with the blood flow) each point is; Infinity where dye cannot reach.
   A clot stops the dye unless the artery has been opened. */
function skDyeDist(A,cat,clot){
  const D={};for(const id of A.order)D[id]=new Float32Array(A.V[id].n).fill(Infinity);
  const cut=v=>clot&&v.id===clot.vid?clot.s-clot.len/2:Infinity;
  const visit=(v,base)=>{const c=cut(v);for(let i=0;i<v.n;i++){if(v.cum[i]>c)break;D[v.id][i]=Math.min(D[v.id][i],base+v.cum[i])}
    for(const ch of v.children)if(ch.os<=c)visit(ch,base+ch.os);if(v.link&&v.len<=c)visit(A.V[v.link],base+v.len)};
  const v=A.V[cat.vid];
  if(cat.vid==='AO'){for(let i=0;i<v.n;i++)D.AO[i]=Math.abs(v.cum[i]-cat.s);for(const ch of v.children)visit(ch,Math.abs(ch.os-cat.s))}
  else{const c=cut(v);for(let i=0;i<v.n;i++){if(v.cum[i]<cat.s)continue;if(v.cum[i]>c&&cat.s<c)break;D[v.id][i]=v.cum[i]-cat.s}
    for(const ch of v.children)if(ch.os>=cat.s&&(ch.os<=c||cat.s>c))visit(ch,ch.os-cat.s);if(v.link&&(v.len<=c||cat.s>c))visit(A.V[v.link],v.len-cat.s)}
  return D;
}
/* where the clot sits */
function skClot(A,pat){
  const sx=pat.side,site=pat.site;
  if(site==='BA'){const v=A.V.BA;return {vid:'BA',s:v.len*0.55,len:8,site}}
  if(site==='ICA-T'){const v=A.V[sx+'ICA'];return {vid:sx+'ICA',s:v.len-7,len:9,site}}
  if(site==='M2'){const id=sx+(pat.m2==='i'?'M2i':'M2s'),v=A.V[id];return {vid:id,s:v.len*0.3,len:7,site}}
  const v=A.V[sx+'M1'];return {vid:sx+'M1',s:v.len*0.5,len:8,site:'M1'};
}
/* the patient, fixed by a seed (so a code always gives the same patient) */
const SK_RARE=[
  {id:'bovine',name:'Bovine arch',short:'The left neck artery starts from the first arch branch',
    blurb:'In about one person in eight the left common carotid shares its origin with the brachiocephalic trunk (a "bovine" arch). The left carotid is not where you expect it on the arch.',
    tip:'Go into the first branch, then turn towards the patient’s left just above its origin to find the left carotid.'},
  {id:'type3',name:'Type III arch',short:'A deep arch with steep branch origins',
    blurb:'With age the arch elongates and sinks, so the neck arteries leave it far above its top. The catheter has to reach up into them.',
    tip:'Line up exactly under each opening and turn the tip up before you push: the window to engage is narrow.'},
  {id:'basilar',name:'Basilar occlusion',short:'A clot at the base of the brain, reached through the vertebral artery',
    blurb:'A blocked basilar artery cuts blood to the brainstem: the patient is drowsy with double vision and weakness on both sides.',
    tip:'Go into the left subclavian, turn up into the left vertebral, then take the microcatheter up into the basilar.'},
];
function skPatient(seed){
  const R=mulberry32((seed*2654435761+12345)>>>0),rnd=(a,b)=>a+(b-a)*R(),pick=a=>a[Math.floor(R()*a.length)];R();R();
  const u=R(),arch=u<0.55?'I':u<0.85?'II':'III',bovine=R()<0.13;
  const v=R(),site=v<0.1?'BA':v<0.27?'ICA-T':v<0.77?'M1':'M2',side=R()<0.5?'L':'R',m2=R()<0.5?'s':'i';
  const male=R()<0.52,age=Math.round(rnd(48,88)),onset=Math.round(rnd(70,300)),door=Math.round(rnd(35,60));
  const nihss=site==='BA'?Math.round(rnd(20,30)):site==='ICA-T'?Math.round(rnd(18,26)):site==='M1'?Math.round(rnd(12,22)):Math.round(rnd(7,13));
  const weak=side==='L'?'right':'left',left=side==='L';
  const sx=site==='BA'?'Drowsy, double vision and weakness on both sides':left?`Sudden ${weak}-sided weakness and cannot find words (aphasia)`:`Sudden ${weak}-sided weakness, ignores the left side, eyes turned to the right`;
  const where=site==='BA'?'basilar artery':`${left?'left':'right'} ${site==='ICA-T'?'internal carotid terminus':site==='M1'?'middle cerebral (M1)':'middle cerebral branch (M2)'}`;
  const rare=bovine?'bovine':site==='BA'?'basilar':arch==='III'?'type3':null;
  const title=site==='BA'?'Basilar stroke':`${left?'Left':'Right'} hemisphere stroke`;
  const hx=`${sx}. Last seen well ${Math.floor(onset/60)} h ${onset%60} min ago. NIHSS ${nihss}. CT: no bleed.`;
  return {seed,code:'STK-'+seedToCode(seed).slice(4),title,pt:(male?'M':'F')+', '+age,hx,where,arch,bovine,site,side,m2,nihss,onset,door,rare};
}
/* TICI 0-3 in words */
const TICI_TXT={0:'no flow past the clot',1:'a trickle past the clot',2:'part of the territory flowing (TICI 2a)',2.5:'most of the territory flowing (TICI 2b)',3:'complete flow (TICI 3)'};
const ticiName=t=>t===2.5?'2b':t===2?'2a':String(t);
