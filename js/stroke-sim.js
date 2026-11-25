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
  RM3a:['right frontal branch (M3)','right front branch (M3)'],RM3b:['right parietal branch (M3)','right top branch (M3)'],RM3c:['right temporal branch (M3)','right side branch (M3)'],RM3d:['right angular branch (M3)','right back branch (M3)'],
  LM3a:['left frontal branch (M3)','left front branch (M3)'],LM3b:['left parietal branch (M3)','left top branch (M3)'],LM3c:['left temporal branch (M3)','left side branch (M3)'],LM3d:['left angular branch (M3)','left back branch (M3)'],
  BA:['basilar artery','artery at the base of the brain (basilar)'],
  RFPCA:['right fetal posterior cerebral','right back brain artery, fed from the carotid'],LFPCA:['left fetal posterior cerebral','left back brain artery, fed from the carotid'],RPCA:['right posterior cerebral','right back brain artery (posterior cerebral)'],LPCA:['left posterior cerebral','left back brain artery (posterior cerebral)'],
};
/* build the arch, neck and brain arteries (and the veins that drain the brain). spec: {arch:'I'|'II'|'III', bovine, side,
   loop (a coiled internal carotid on that side), fetal (that side's posterior cerebral fed from the internal carotid)}.
   The arch and lower neck are still built (the catheter's path runs through them) but cases start in the upper neck
   and the X-ray only shows the head and upper neck. */
function skAnatomy(spec={}){
  const d={I:0,II:-14,III:-30}[spec.arch||'I'],bov=!!spec.bovine;
  const V={},order=[];
  const add=(id,parent,ctrl,r,rot,o={})=>{const pts=skCurve(ctrl),cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]));
    const v={id,parent,pts,cum,len:cum[cum.length-1],n:pts.length,r,rot,children:[],guideMaxY:o.guideMaxY??1e9,intra:!!o.intra,trap:!!o.trap,link:o.link||null,end:!!o.end,noEntry:!!o.noEntry};
    if(parent){const P=V[parent];let oi=P.n-1;if(!o.atEnd){let bd=1e9;for(let i=0;i<P.n;i++){const q=P.pts[i],dd=Math.hypot(q[0]-ctrl[0][0],q[1]-ctrl[0][1],q[2]-ctrl[0][2]);if(dd<bd){bd=dd;oi=i}}}
      v.oi=oi;v.os=P.cum[oi];P.children.push(v)}
    V[id]=v;order.push(id);return v};
  // the aorta: up the descending aorta, over the arch, down the ascending aorta to the heart
  add('AO',null,[[24,-125,-22],[24,-70,-20],[22,-28+d,-14],[9,-6+d,-3],[-6,-7+d,6],[-16,-30+d,14],[-18,-95,16]],11,0);
  const top=(x,y,z)=>[x,y+d,z];
  add('BCT','AO',[top(-7,-6,5),[-12,18,6],[-18,38,4]],6,0);
  if(bov)add('LCCA','BCT',[[-10,6,5],[4,40,6],[18,80,7],[27,138,8]],3.5,90);
  else add('LCCA','AO',[top(5,-3,1),[12,30,5],[20,80,7],[27,138,8]],3.5,0);
  add('LSCA','AO',[top(16,-8,-8),[24,15,-8],[36,30,-8],[58,38,-8],[86,30,-8]],4,0);
  add('RSCA','BCT',[[-18,38,4],[-34,45,0],[-58,40,-6],[-86,30,-8]],4,270,{atEnd:true});
  add('RCCA','BCT',[[-18,38,4],[-23,90,6],[-27,138,8]],3.5,0,{atEnd:true});
  for(const S of ['R','L']){const sx=S==='R'?-1:1,lat=S==='R'?270:90,med=S==='R'?90:270;
    // internal carotid: straight up the neck, then through the skull base (petrous part, bending forwards), up through the
    // cavernous sinus in an S-shaped siphon, and on to its end where it splits into the middle and anterior cerebrals
    const loop=spec.loop&&spec.side===S;
    add(S+'ICA',S+'CCA',[[sx*27,138,8],...(loop?[[sx*29,148,6],[sx*36,158,14],[sx*35,170,22],[sx*27,172,14],[sx*25,162,4],[sx*29,156,-4],[sx*34,166,-6],[sx*33,180,-4]]:[[sx*30,175,0]]),[sx*31,198,-4],[sx*29,206,4],[sx*25,210,14],[sx*21,220,21],[sx*20,233,18],[sx*21,240,7],[sx*22,250,4]],2.4,0,{atEnd:true,guideMaxY:loop?150:200});
    add(S+'OPH',S+'ICA',[[sx*20,234,17],[sx*25,238,36],[sx*29,234,58],[sx*30,230,70]],0.7,0,{noEntry:true,intra:true,end:true});
    // external carotid and its branches (to the face and scalp): a wrong turn for this job
    add(S+'ECA',S+'CCA',[[sx*27,138,8],[sx*22,160,22],[sx*30,185,30],[sx*38,205,34]],2.1,S==='R'?55:305,{atEnd:true,trap:true});
    add(S+'FAC',S+'ECA',[[sx*23,162,23],[sx*32,170,44],[sx*34,186,58],[sx*28,204,66]],0.9,0,{noEntry:true,end:true});
    add(S+'OCC',S+'ECA',[[sx*25,168,25],[sx*32,182,0],[sx*34,200,-30],[sx*30,222,-62]],0.9,0,{noEntry:true,end:true});
    add(S+'STA',S+'ECA',[[sx*38,205,34],[sx*48,232,30],[sx*56,262,24],[sx*60,292,16]],1,0,{noEntry:true,end:true,atEnd:true});
    add(S+'MAX',S+'ECA',[[sx*35,196,32],[sx*30,204,46],[sx*24,206,58]],0.8,0,{noEntry:true,end:true});
    // middle cerebral: M1 out sideways, tiny perforators up into the deep brain, then two M2 trunks fanning over the hemisphere
    add(S+'M1',S+'ICA',[[sx*22,250,4],[sx*36,252,2],[sx*50,251,0],[sx*58,252,-2]],1.6,lat,{atEnd:true,intra:true});
    for(const [k,f] of [['a',0.35],['b',0.55]])add(S+'LS'+k,S+'M1',[[sx*(22+f*36),251,2],[sx*(23+f*36),262,3],[sx*(24+f*36),272,6]],0.4,0,{noEntry:true,intra:true,end:true});
    add(S+'M2s',S+'M1',[[sx*58,252,-2],[sx*66,262,4],[sx*70,276,6],[sx*72,292,2]],1.1,0,{atEnd:true,intra:true});
    add(S+'M2i',S+'M1',[[sx*58,252,-2],[sx*68,250,-12],[sx*74,256,-26],[sx*76,268,-40]],1.1,180,{atEnd:true,intra:true});
    add(S+'M3a',S+'M2s',[[sx*72,292,2],[sx*68,308,26],[sx*60,320,50],[sx*52,324,66]],0.75,90,{atEnd:true,intra:true,end:true});
    add(S+'M3b',S+'M2s',[[sx*72,292,2],[sx*71,314,-8],[sx*64,330,-34],[sx*56,334,-52]],0.75,270,{atEnd:true,intra:true,end:true});
    add(S+'M3c',S+'M2i',[[sx*76,268,-40],[sx*74,262,-60],[sx*68,270,-78],[sx*60,282,-90]],0.75,180,{atEnd:true,intra:true,end:true});
    add(S+'M3d',S+'M2i',[[sx*76,268,-40],[sx*76,290,-50],[sx*70,308,-66],[sx*62,320,-78]],0.75,0,{atEnd:true,intra:true,end:true});
    // anterior cerebral: A1 inwards, then up the midline and back in an arc over the corpus callosum (pericallosal),
    // with the callosomarginal branch running above it
    add(S+'A1',S+'ICA',[[sx*22,250,4],[sx*11,256,10],[sx*3,260,14]],1.2,med,{atEnd:true,intra:true});
    add(S+'ACA',S+'A1',[[sx*3,260,14],[sx*3,276,30],[sx*4,296,36],[sx*5,312,22],[sx*5,318,-10],[sx*5,314,-44],[sx*5,302,-66]],1.1,0,{atEnd:true,intra:true,end:true});
    add(S+'CMA',S+'ACA',[[sx*4,294,36],[sx*6,318,42],[sx*7,334,16],[sx*7,334,-24]],0.7,0,{noEntry:true,intra:true,end:true})}
  // vertebral arteries: up through the neck bones, a loop round the atlas (C1), then into the skull to join as the basilar
  add('LVA','LSCA',[[30,24,-8],[23,90,-20],[18,150,-24],[17,186,-26],[24,198,-30],[30,206,-40],[18,212,-40],[8,218,-34],[4,222,-32]],1.8,0,{guideMaxY:186});
  add('RVA','RSCA',[[-32,44,-2],[-23,90,-20],[-18,150,-24],[-17,186,-26],[-24,198,-30],[-30,206,-40],[-18,212,-40],[-8,218,-34],[-4,222,-32]],1.7,0,{guideMaxY:186,link:'BA'});
  add('BA','LVA',[[4,222,-32],[1,236,-28],[0,252,-24],[0,268,-20]],1.8,0,{atEnd:true,intra:true});
  for(const S of ['L','R']){const sx=S==='R'?-1:1,fetal=spec.fetal&&spec.side===S;
    // a fetal posterior cerebral: fed from the internal carotid through a large posterior communicating artery
    if(fetal)add(S+'FPCA',S+'ICA',[[sx*20,238,12],[sx*19,244,-4],[sx*20,258,-22],[sx*28,266,-44],[sx*34,262,-64],[sx*30,256,-84]],1.15,0,{noEntry:true,intra:true,end:true});
    add(S+'PCA','BA',[[0,268,-20],[sx*14,270,-28],[sx*28,268,-44],[sx*34,262,-64],[sx*30,256,-84]],fetal?0.5:1.2,S==='R'?270:90,{atEnd:true,intra:true,end:true});
    add(S+'CALC',S+'PCA',[[sx*30,256,-84],[sx*22,266,-94],[sx*14,276,-98]],0.7,0,{noEntry:true,intra:true,end:true,atEnd:true});
    add(S+'SCB','BA',[[0,264,-21],[sx*16,262,-30],[sx*28,256,-46]],0.6,0,{noEntry:true,intra:true,end:true})}
  // the veins and sinuses that drain the brain (filled late, in the venous phase); not for the catheter
  const veins=[];const vein=(ctrl,r,delay)=>{const pts=skCurve(ctrl,3),cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]));veins.push({pts,cum,n:pts.length,r,delay})};
  for(const sx of [-1,1]){vein([[sx*62,300,24],[sx*36,326,30],[sx*4,342,24]],0.9,0);vein([[sx*66,292,-40],[sx*36,320,-56],[sx*4,328,-62]],0.9,0.1);vein([[sx*64,262,-20],[sx*58,258,-58],[sx*52,258,-82]],0.8,0.1)}
  vein([[0,330,64],[0,346,22],[0,342,-30],[0,324,-70],[0,292,-96],[0,262,-100]],2.8,0.4);           // superior sagittal sinus
  vein([[0,300,14],[0,292,-28],[0,274,-70],[0,262,-100]],1.8,0.5);                                  // inferior sagittal and straight sinus
  for(const sx of [-1,1]){vein([[0,262,-100],[sx*30,260,-98],[sx*54,250,-80],[sx*60,232,-60],[sx*56,214,-44],[sx*48,200,-34]],2.6,0.9); // transverse and sigmoid sinus
    vein([[sx*48,200,-34],[sx*42,170,-12],[sx*36,120,-2],[sx*32,60,0],[sx*30,0,2]],3.6,1.4)}         // internal jugular vein
  return {V,order,veins,spec:{arch:spec.arch||'I',bovine:bov,loop:!!spec.loop,fetal:!!spec.fetal,side:spec.side}};
}
const skPt=(v,s)=>{let i=0;while(i<v.n-1&&v.cum[i+1]<s)i++;const t=v.cum[i+1]>v.cum[i]?Math.min(1,Math.max(0,(s-v.cum[i])/(v.cum[i+1]-v.cum[i]))):0,a=v.pts[i],b=v.pts[Math.min(v.n-1,i+1)];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]};
const skAngDiff=(a,b)=>Math.abs(((a-b)%360+540)%360-180);
/* difficulty: how close the tip's turn must be to a branch's angle to enter it, and how much the tip is drawn in */
// rate: game minutes on the stroke clock per real second
const SK_DIFF={story:{win:70,seek:90,adv:48,micro:22,rate:1/10},easy:{win:55,seek:60,adv:46,micro:20,rate:1/8},medium:{win:36,seek:0,adv:44,micro:18,rate:1/6},hard:{win:24,seek:0,adv:42,micro:16,rate:1/5}};
function skWindow(A,c,dk){const w=SK_DIFF[dk]||SK_DIFF.medium;let win=w.win;if(c.parent==='AO')win-= {I:0,II:5,III:12}[A.spec.arch];return Math.max(12,win)}
/* the catheter: {vid, s, rot, stack:[{vid,s}], deep (microcatheter out)} */
function skNewCath(){return {vid:'AO',s:0,rot:180,stack:[],deep:false,push:0}}
/* where a case starts: the guide already up the neck artery that leads to the clot (the internal carotid on the clot's
   side, or the left vertebral for the basilar), its tip in the upper neck pointing up. The way back down is closed at
   the floor, the bottom of the picture. */
function skStartCath(A,pat){
  const vid=pat.site==='BA'?'LVA':pat.side+'ICA',v=A.V[vid],at=y=>{let s=0;while(s<v.len&&skPt(v,s)[1]<y)s+=0.5;return s};
  const stack=[];let ch=v;while(ch.parent){stack.unshift({vid:ch.parent,s:ch.os});ch=A.V[ch.parent]}
  const loop=A.spec.loop&&vid===A.spec.side+'ICA',s=at(vid==='LVA'?158:loop?142:162),floor=Math.min(s,at(vid==='LVA'?148:141));
  return {vid,s,rot:0,stack,deep:false,push:0,floor:{vid,s:floor}};
}
/* move the tip by ds millimetres; returns what happened */
function skMove(A,cat,ds,dk,clot){
  const v=A.V[cat.vid];let out={};
  if(ds>0){
    // a clot slows the microcatheter as it crosses
    if(clot&&cat.vid===clot.vid&&cat.s>clot.s-clot.len/2-1&&cat.s<clot.s+clot.len/2+1)ds*=0.35;
    const ns=cat.s+ds;
    // branches whose openings the tip is passing, entered if it is turned their way
    let best=null,bd=1e9;
    for(const c of v.children){if(c.noEntry)continue;const near=c.os>=v.len-0.5?ns>=v.len-1:Math.abs(ns-c.os)<=3;if(!near)continue;
      if(c.intra&&!cat.deep)continue;const df=skAngDiff(cat.rot,c.rot);if(df<=skWindow(A,c,dk)&&df<bd){bd=df;best=c}}
    if(!best&&v.link&&ns>=v.len-1&&cat.deep&&skAngDiff(cat.rot,0)<=skWindow(A,A.V[v.link],dk))best=A.V[v.link];
    if(best){cat.stack.push({vid:v.id,s:Math.min(ns,v.len)});cat.vid=best.id;cat.s=0;cat.push=0;return {entered:best.id,trap:best.trap}}
    // the guide catheter cannot go into the head: the microcatheter has to
    if(!cat.deep){const p=skPt(v,ns);if(p[1]>v.guideMaxY||v.intra){cat.s=Math.max(cat.s,Math.min(ns,v.len));const q=skPt(v,cat.s);if(q[1]>v.guideMaxY){let s=cat.s;while(s>0&&skPt(v,s)[1]>v.guideMaxY)s-=0.5;cat.s=s}return {blocked:'deep'}}}
    if(ns>=v.len){cat.s=v.len;cat.push+=ds;return {end:true}}
    cat.s=ns;cat.push=0;return out;
  }
  if(ds<0){cat.push=0;let ns=cat.s+ds;
    if(cat.floor&&cat.vid===cat.floor.vid&&ns<cat.floor.s){cat.s=cat.floor.s;return {floor:true}}
    while(ns<0&&cat.stack.length){const st=cat.stack.pop();cat.vid=st.vid;ns=st.s+ns}
    if(ns<0)ns=0;cat.s=ns;
    // the microcatheter goes back into the guide once the tip is back in the neck
    if(cat.deep){const vv=A.V[cat.vid];if(!vv.intra&&skPt(vv,cat.s)[1]<130){cat.deep=false;out.retracted=true}}
    return out}
  return out;
}
/* which branch the next push would enter from here (or null), using the same rule as skMove */
function skPick(A,cat,dk){const v=A.V[cat.vid];let best=null,bd=1e9;
  for(const c of v.children){if(c.noEntry)continue;const near=c.os>=v.len-0.5?cat.s>=v.len-4:Math.abs(cat.s-c.os)<=3;if(!near||(c.intra&&!cat.deep))continue;const df=skAngDiff(cat.rot,c.rot);if(df<=skWindow(A,c,dk)&&df<bd){bd=df;best=c}}
  if(!best&&v.link&&cat.s>=v.len-4&&cat.deep&&skAngDiff(cat.rot,0)<=skWindow(A,A.V[v.link],dk))best=A.V[v.link];return best}
/* is a branch opening near the tip worth steering towards? returns {child, diff} for the nearest */
function skNearBranch(A,cat){const v=A.V[cat.vid];let best=null;for(const c of v.children){if(c.noEntry)continue;const dist=c.os>=v.len-0.5?v.len-cat.s:Math.abs(cat.s-c.os);if(dist>14)continue;if(!best||dist<best.dist)best={child:c,dist}}return best}
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
  {id:'loop',name:'Coiled carotid',short:'The internal carotid makes a full loop in the neck',
    blurb:'In some older people the neck part of the internal carotid is so long that it coils into a loop. The stiff guide catheter cannot follow it round.',
    tip:'Leave the guide below the loop: send the microcatheter (X) out early and steer it through the coil.'},
  {id:'fetal',name:'Fetal posterior cerebral',short:'The back brain artery is fed from the internal carotid',
    blurb:'In about one person in five the posterior cerebral artery on one side is fed mainly from the internal carotid, through a large posterior communicating artery, as it is before birth. A carotid film then fills the back of the brain too.',
    tip:'Do not mistake the extra artery running back from the carotid for a clot or a wrong branch: it is normal for this patient.'},
  {id:'basilar',name:'Basilar occlusion',short:'A clot at the base of the brain, reached through the vertebral artery',
    blurb:'A blocked basilar artery cuts blood to the brainstem: the patient is drowsy with double vision and weakness on both sides.',
    tip:'The guide starts in the left vertebral artery. Take the microcatheter up into the head and on into the basilar.'},
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
  const w=R(),loop=site!=='BA'&&w<0.06,fetal=site!=='BA'&&!loop&&w<0.12;
  const rare=site==='BA'?'basilar':loop?'loop':fetal?'fetal':null;
  const title=site==='BA'?'Basilar stroke':`${left?'Left':'Right'} hemisphere stroke`;
  const hx=`${sx}. Last seen well ${Math.floor(onset/60)} h ${onset%60} min ago. NIHSS ${nihss}. CT: no bleed.`;
  return {seed,code:'STK-'+seedToCode(seed).slice(4),title,pt:(male?'M':'F')+', '+age,hx,where,arch,bovine,loop,fetal,site,side,m2,nihss,onset,door,rare};
}
/* TICI 0-3 in words */
const TICI_TXT={0:'no flow past the clot',1:'a trickle past the clot',2:'part of the territory flowing (TICI 2a)',2.5:'most of the territory flowing (TICI 2b)',3:'complete flow (TICI 3)'};
const ticiName=t=>t===2.5?'2b':t===2?'2a':String(t);
