/* Cath Lab Run: the stroke room. Mechanical thrombectomy for a large-vessel stroke, using the shared monitor, controls,
   pop-up styles, sound, settings, plain words and progression. The anatomy, steering and dye are in js/stroke-sim.js.
   A case: steer up over the arch into the right neck artery, film with dye to find where the dye column stops (the
   clot), mark it, take the microcatheter (X) into the head, then pull the clot out with a stent retriever (open it,
   let it grip, pull back with suction) or suck it out with an aspiration catheter. The stroke clock runs throughout:
   every minute costs brain. */
"use strict";
let SK=null;
const skName=id=>{const n=SK_NAMES[id];return n?(PLAIN?n[1]:n[0]):id};
const SK_SITE_TXT={'ICA-T':['internal carotid terminus','end of the internal carotid (terminus)'],M1:['M1 (middle cerebral)','main middle brain artery (M1)'],M2:['M2 branch','a branch of the middle brain artery (M2)'],BA:['basilar artery','basilar artery (base of the brain)']};
const skSite=k=>PLAIN?SK_SITE_TXT[k][1]:SK_SITE_TXT[k][0];
for(const k of SK_RARE)RARE_BY[k.id]=k; // so the casebook can record stroke rare patients

/* ---------- drawing: two views side by side, in ink ---------- */
const skProj=(p,pane)=>pane===0?[128+p[0],400-p[1]]:[384-p[2]*1.05,400-p[1]];
let skBgCanvas=null;
function skBg(){
  if(skBgCanvas)return skBgCanvas;
  const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');g.scale(2,2);
  g.fillStyle='#EFE9DC';g.fillRect(0,0,512,512);
  const ink=a=>`rgba(29,27,25,${a})`,ell=(x,y,rx,ry,a=0)=>{g.beginPath();g.ellipse(x,y,rx,ry,a,0,7)};
  const hatchIn=(clip,gap,ang,a)=>{g.save();g.beginPath();clip();g.clip();g.strokeStyle=ink(a);g.lineWidth=0.5;const cs=Math.cos(ang),sn=Math.sin(ang);for(let k=-700;k<700;k+=gap){g.beginPath();g.moveTo(256+cs*-700-sn*k,256+sn*-700+cs*k);g.lineTo(256+cs*700-sn*k,256+sn*700+cs*k);g.stroke()}g.restore()};
  for(const pane of [0,1]){const ox=pane*256,cx=ox+128;
    g.save();g.beginPath();g.rect(ox,0,256,512);g.clip();
    // skull: an engraved rim, darker at the edge like bone on X-ray
    if(pane===0){ell(cx,128,84,96);}else{g.beginPath();g.ellipse(cx+8,126,96,92,0,0,7)}
    g.lineWidth=7;g.strokeStyle=ink(0.12);g.stroke();g.lineWidth=1.2;g.strokeStyle=ink(0.45);g.stroke();
    hatchIn(()=>{if(pane===0)g.ellipse(cx,128,84,96,0,0,7);else g.ellipse(cx+8,126,96,92,0,0,7)},4.2,-0.7,0.06);
    if(pane===0){for(const sx of [-1,1]){ell(cx+sx*30,172,15,11);g.lineWidth=1;g.strokeStyle=ink(0.4);g.stroke()} // orbits
      g.beginPath();g.moveTo(cx-56,214);g.quadraticCurveTo(cx,262,cx+56,214);g.lineWidth=1.4;g.strokeStyle=ink(0.4);g.stroke(); // jaw
      for(let i=0;i<9;i++){const y=226+i*21;g.strokeStyle=ink(0.38);g.lineWidth=0.9;g.strokeRect(cx-11,y,22,17);hatchIn(()=>g.rect(cx-11,y,22,17),3,0.3,0.12)} // spine
      for(const sx of [-1,1]){g.beginPath();g.moveTo(cx+sx*14,404);g.quadraticCurveTo(cx+sx*50,392,cx+sx*96,398);g.lineWidth=3;g.strokeStyle=ink(0.25);g.stroke()} // collarbones
      for(let k=0;k<3;k++)for(const sx of [-1,1]){g.beginPath();g.moveTo(cx+sx*12,430+k*26);g.quadraticCurveTo(cx+sx*70,410+k*26,cx+sx*110,450+k*26);g.lineWidth=1;g.strokeStyle=ink(0.2);g.stroke()}}
    else{g.beginPath();g.moveTo(cx-88,140);g.quadraticCurveTo(cx-100,190,cx-84,215);g.quadraticCurveTo(cx-60,250,cx-20,248);g.lineWidth=1.3;g.strokeStyle=ink(0.4);g.stroke(); // face and jaw
      ell(cx-70,170,14,11);g.lineWidth=1;g.strokeStyle=ink(0.35);g.stroke();
      for(let i=0;i<9;i++){const y=226+i*21,x=cx+30+Math.sin(i*0.35)*6;g.strokeStyle=ink(0.38);g.lineWidth=0.9;g.strokeRect(x-12,y,24,17);hatchIn(()=>g.rect(x-12,y,24,17),3,0.3,0.12)}}
    // a soft dark rim, like the edge of the X-ray field
    const gr=g.createRadialGradient(cx,256,150,cx,256,300);gr.addColorStop(0,'rgba(60,45,25,0)');gr.addColorStop(1,'rgba(60,45,25,0.22)');g.fillStyle=gr;g.fillRect(ox,0,256,512);
    g.restore()}
  g.strokeStyle='#1d1b19';g.lineWidth=1.4;g.beginPath();g.moveTo(256,0);g.lineTo(256,512);g.stroke();
  g.font='italic 14px "IM Fell English", Georgia, serif';g.fillStyle=ink(0.7);g.textAlign='right';g.fillText('front (AP)',250,16);g.textAlign='left';g.fillText('side (lateral)',262,16);
  return skBgCanvas=c;
}
/* draw the scene into any canvas: dye from a distance map up to a front, a faint roadmap, the catheter and devices */
function skRender(ctx,o){
  const sc=ctx.canvas.width/512;ctx.setTransform(sc,0,0,sc,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.drawImage(skBg(),0,0,512,512);
  if(!o.image){ctx.fillStyle='rgba(239,233,220,0.55)';ctx.fillRect(0,0,512,512);return}
  const A=o.A,lineFor=v=>Math.max(1.5,v.r*2.6);
  const drawVessels=(dist,front,alpha,wk)=>{if(!dist)return;for(const pane of [0,1]){ctx.save();ctx.beginPath();ctx.rect(pane*256,0,256,512);ctx.clip();
    for(const id of A.order){const v=A.V[id],D=dist[id];let pen=false;ctx.beginPath();
      for(let i=0;i<v.n;i++){if(D[i]<=front){const q=skProj(v.pts[i],pane);pen?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);pen=true}else if(pen)break}
      if(pen){ctx.strokeStyle=`rgba(29,27,25,${alpha})`;ctx.lineWidth=lineFor(v)*wk;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
        if(alpha>0.5&&v.r>1.5){ctx.strokeStyle=`rgba(239,233,220,${alpha*0.7})`;ctx.lineWidth=0.7;ctx.stroke()}}}
    ctx.restore()}};
  if(o.road)drawVessels(o.road.dist,o.road.front,0.16,1);
  if(o.dist&&o.fade>0.02)drawVessels(o.dist,o.front,0.9*o.fade,1);
  // a bleed from a perforation: a cloud of dye outside the artery
  if(o.perf)for(const pane of [0,1]){const q=skProj(o.perf,pane);const gr=ctx.createRadialGradient(q[0],q[1],2,q[0],q[1],26);gr.addColorStop(0,'rgba(29,27,25,0.55)');gr.addColorStop(1,'rgba(29,27,25,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(q[0],q[1],26,0,7);ctx.fill()}
  // the catheter: the guide thick, the microcatheter thin beyond it
  const drawPath=(pts,w,a)=>{for(const pane of [0,1]){ctx.save();ctx.beginPath();ctx.rect(pane*256,0,256,512);ctx.clip();ctx.beginPath();pts.forEach((p,i)=>{const q=skProj(p,pane);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.strokeStyle=`rgba(29,27,25,${a})`;ctx.lineWidth=w;ctx.lineCap='round';ctx.stroke();ctx.restore()}};
  if(o.cath){const path=skCathPath(A,o.cath);
    if(o.cath.deep&&o.guide){drawPath(o.guide,2.8,0.85);drawPath(path,1.1,0.9)}else drawPath(path,2.8,0.85);
    const tip=path[path.length-1],r=o.cath.rot*Math.PI/180;
    for(const pane of [0,1]){const q=skProj(tip,pane),dx=pane===0?Math.sin(r):Math.sin(r)*0.45,dy=-Math.cos(r);ctx.save();ctx.beginPath();ctx.rect(pane*256,0,256,512);ctx.clip();
      ctx.beginPath();ctx.moveTo(q[0],q[1]);ctx.quadraticCurveTo(q[0]+dx*4,q[1]+dy*4-2,q[0]+dx*8,q[1]+dy*8);ctx.strokeStyle='rgba(29,27,25,0.95)';ctx.lineWidth=o.cath.deep?1.4:2.6;ctx.stroke();ctx.restore()}}
  // devices at the clot
  if(o.device&&o.clot){const v=A.V[o.clot.vid];for(const pane of [0,1]){ctx.save();ctx.beginPath();ctx.rect(pane*256,0,256,512);ctx.clip();
    if(o.device==='sr'){ctx.strokeStyle='rgba(29,27,25,0.9)';ctx.lineWidth=0.7;ctx.beginPath();for(let s=o.clot.s-o.clot.len/2-3,k=0;s<=o.clot.s+o.clot.len/2+4;s+=1.5,k++){const p=skPt(v,s),q=skProj(p,pane);ctx.lineTo(q[0]+(k%2?2.4:-2.4),q[1]+(k%2?-1.2:1.2))}ctx.stroke()}
    ctx.restore()}}
  // the clot, once marked: a double ring in oxblood ink
  if(o.mark&&o.clot){const v=A.V[o.clot.vid],p=skPt(v,o.clot.s-o.clot.len/2);for(const pane of [0,1]){const q=skProj(p,pane);ctx.strokeStyle='#8A2D1F';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(q[0],q[1],10,0,7);ctx.stroke();ctx.lineWidth=0.6;ctx.beginPath();ctx.arc(q[0],q[1],13,0,7);ctx.stroke()}}
}
/* a small picture for the casebook: the arteries the rare patient is known for */
function skThumb(cv,seed){
  try{const pat=skPatient(seed),A=skAnatomy(pat),cat=skNewCath();let clot=skClot(A,pat);
    if(pat.rare==='basilar'){cat.vid='LVA';cat.s=30}else{cat.s=A.V.AO.len*0.35}
    const dist=skDyeDist(A,cat,clot);skRender(cv.getContext('2d'),{A,image:true,dist,front:1e9,fade:1,cath:cat,clot,mark:pat.rare==='basilar'})}catch(e){}
}

/* ---------- the case ---------- */
function skEl(){
  if(!$('skPanel')){const p=document.createElement('div');p.className='sec';p.id='skPanel';$('caseHead').after(p);
    p.addEventListener('click',skPanelClick)}
  if(!$('skPop')){const d=document.createElement('div');d.className='txpop skpop';d.id='skPop';d.hidden=true;d.setAttribute('role','dialog');d.setAttribute('aria-label','Stroke treatment');$('monitor').appendChild(d);d.addEventListener('click',skPopClick)}
  if(!$('skGuide')){const gd=document.createElement('div');gd.className='guide';gd.id='skGuide';gd.hidden=true;gd.setAttribute('aria-live','polite');$('toast').after(gd)}
}
function skStart(seed,opt={}){
  if(typeof close3D==='function')close3D();
  if(typeof S!=='undefined'&&S&&!S.done&&typeof saveCase==='function')saveCase();
  S=null;skEl();
  const tut=!!opt.tut;if(tut)seed=skTutSeed();
  const dk=tut?'easy':(profile.diff||'easy'),pat=skPatient(seed==null?Math.floor(Math.random()*CODE_SPACE):seed),A=skAnatomy(pat);
  SK={dk,D:DIFFICULTY[dk],W:SK_DIFF[dk]||SK_DIFF.medium,pat,A,cat:skNewCath(),clot:null,t:0,cine:false,runs:[],review:null,inj:null,road:null,roadOn:DIFFICULTY[dk].level===1,
    found:false,gradeOk:null,pending:false,tx:null,passes:0,tici:0,reperfAt:null,emboli:false,sah:null,contrast:0,ak:0,ftime:0,guide:null,done:false,
    ecaInj:0,maxFront:0,prevB:false,beatT:0,blockedT:0,popKey:'',ctrlT:0,firstPassTici:null,tut:tut?{i:0}:null};
  SK.clot=skClot(A,pat);
  document.body.classList.remove('inmenu','inreport');document.body.classList.add('stroke');
  $('startOv').hidden=true;$('resultOv').hidden=true;$('reviewbar').hidden=true;$('teachNote').hidden=true;
  ['txPop','gradePop','txDot','guide'].forEach(id=>{const e=$(id);if(e)e.hidden=true});
  const ctx=img.getContext('2d');skRender(ctx,{A,image:false});
  $('caseHead').innerHTML=`<h2>Stroke room · ${pat.code} · ${SK.D.label}</h2>${pat.rare&&RARE_BY[pat.rare]?`<p class="task">Rare patient: ${RARE_BY[pat.rare].name}. ${RARE_BY[pat.rare].short}.</p>`:''}<b>${pat.title}</b><p>${pat.pt}. ${pat.hx}</p>
    <p class="task">${SK.D.level>=3?pw('Find the occlusion on angiography and remove the clot.','Find the blocked brain artery with dye and pull the clot out.'):pw(`CT angiogram: occlusion of the ${pat.where}. Confirm it on angiography and remove the clot.`,`The CT scan shows a clot in the ${pat.where}. Find it with dye and pull it out.`)} ${pw('Every minute counts.','Every minute costs brain cells.')}</p>`;
  skPanel(true);skCoach();
  toast(pw('Groin access done: the guide catheter is in the descending aorta. Advance over the arch.','The tube is in, through the top of the leg, and waiting in the main artery. Push it up over the arch.'));
  requestAnimationFrame(skLoop);
}
function skStop(){if(SK){SK.done=true;SK=null}document.body.classList.remove('stroke');const p=$('skPop');if(p)p.hidden=true;const g=$('skGuide');if(g)g.hidden=true}
const skMinutes=()=>SK.pat.door+SK.t*SK.W.rate;
const skSinceGroin=()=>skMinutes()-SK.pat.door;
function skBrainSaved(){const m=(SK.reperfAt??skMinutes())-SK.pat.door;return Math.max(5,Math.round(100-m*1.15))}
function skNihss(){const p=SK.pat.nihss;if(SK.reperfAt!=null)return p;return Math.min(42,p+Math.floor(skSinceGroin()/12)+(SK.sah?6:0))}
let skLast=0;
function skLoop(now){
  if(!SK||SK.done)return;
  const dt=Math.min(0.05,skLast?(now-skLast)/1000:0.016);skLast=now;requestAnimationFrame(skLoop);
  skTick(dt);skDraw();
  SK.uiAcc=(SK.uiAcc||0)+1;if(SK.uiAcc%6===0){skPanel();skPop();skGuide();skTutTick()}
}
function skTick(dt){
  const s=SK,A=s.A,c=s.cat,fl=down('Space','KeyF'),inj=down('KeyJ'),busy=!!(s.tx&&s.tx.stage!=='choose');
  s.t+=dt;if(s.ctrlT>0)s.ctrlT-=dt;
  // turning and moving
  if(!busy&&!s.sah){
    if(down('ArrowRight','KeyD'))c.rot=(c.rot+120*dt)%360;
    if(down('ArrowLeft','KeyA'))c.rot=(c.rot-120*dt+360)%360;
    let ds=0;const sp=c.deep?s.W.micro:s.W.adv;if(down('ArrowUp','KeyW'))ds+=sp*dt;if(down('ArrowDown','KeyS'))ds-=sp*dt;
    if(ds){const imaging=fl||s.cine;const r=skMove(A,c,ds,s.dk,s.clot);
      if(r.entered){if(typeof sfx==='function')sfx('engage');const v=A.V[r.entered];
        toast(r.trap?pw(`That is the ${skName(r.entered)}: it goes to the face, not the brain. Pull back and keep the tip pointing up.`,`Careful: that is the ${skName(r.entered)}, which goes to the face, not the brain. Pull back and keep the tip pointing up.`):`${pw('Into the','Into the')} ${skName(r.entered)}.`,!!r.trap);if(r.trap)s.ecaIn=true}
      if(r.blocked==='deep'&&s.blockedT<=0){s.blockedT=4;toast(pw(`The guide stays in the neck. Press ${shortKey('KeyX')} for the microcatheter to go further.`,`The big tube has to stay in the neck. Press ${shortKey('KeyX')} to send the thin tube (microcatheter) on into the head.`))}
      if(r.retracted)toast(pw('Microcatheter back in the guide.','The thin tube is back inside the big one.'));
      if(!imaging&&Math.abs(ds)>0){s.blind=(s.blind||0)+dt;if(s.blind>1.5&&Math.floor((s.blind-dt)/3)!==Math.floor(s.blind/3))toast(pw('Moving without fluoro. Hold the X-ray on.','Moving the tube without X-ray: hold the X-ray on so you can see it.'),true)}
      // pushing a microcatheter against the end of a small artery can go through the wall
      const v=A.V[c.vid];if(c.deep&&v.end&&c.push>10&&!s.sah){if(s.D.level>=2){s.sah=skPt(v,v.len);c.push=0;toast(pw('Bleed: the wire went through the end of a small artery (subarachnoid haemorrhage). Stop and finish the case.','The wire poked through the end of a small artery: the brain is bleeding (subarachnoid haemorrhage). Stop and finish the case.'),true)}else{c.push=0;toast(pw('Careful: the tip is pushing against the end of a small artery. Pull back.','Careful: the tip is pushing on the end of a tiny artery and could go through it. Pull back.'),true)}}}
    // easier settings: the tip turns itself towards a nearby opening
    if(s.W.seek>0&&!down('ArrowLeft','KeyA','ArrowRight','KeyD')){const nb=skNearBranch(A,c);if(nb&&!nb.child.trap&&nb.dist<6&&(!nb.child.intra||c.deep)){const d=((nb.child.rot-c.rot+540)%360)-180;if(Math.abs(d)<skWindow(A,nb.child,s.dk)+40)c.rot=(c.rot+Math.sign(d)*Math.min(Math.abs(d),s.W.seek*dt)+360)%360}}
  }
  if(s.blockedT>0)s.blockedT-=dt;
  // dye
  if(inj&&!s.sah){s.contrast+=(c.vid==='AO'?8:3.5)*dt;if(c.vid.endsWith('ECA'))s.ecaInj+=dt;
    if(!s.inj||!s.inj.active)s.inj={t0:s.t,active:true,dist:skDyeDist(A,c,s.clot),rel:0}}
  else if(s.inj&&s.inj.active){s.inj.active=false;s.inj.rel=s.t}
  if(s.inj){s.inj.front=s.inj.active?(s.t-s.inj.t0)*170:s.inj.front;s.inj.fade=s.inj.active?1:Math.max(0,1-(s.t-s.inj.rel)/1.4);if(s.cine&&s.inj.fade>0.5){s.maxFront=Math.max(s.maxFront,s.inj.front);s.runDist=s.inj.dist}}
  // dose
  if(fl){s.ftime+=dt;s.ak+=0.45*dt}if(s.cine)s.ak+=1.6*dt;
  // the heart monitor still beeps
  s.beatT-=dt;if(s.beatT<=0){s.beatT=60/78;if(typeof sfx==='function'&&typeof SND!=='undefined'&&SND.beat)sfx('beep')}
  // treatment
  const B=down('KeyB'),edge=B&&!s.prevB;s.prevB=B;const tx=s.tx;
  if(tx&&tx.type==='sr'){
    if(tx.stage==='deploy'&&B){tx.dep=Math.min(1,(tx.dep||0)+dt/1.4);if(tx.dep>=1){tx.stage='wait';tx.w=0;if(typeof sfx==='function')sfx('ding');toast(pw('Stent retriever open across the clot. Let it grip for a few seconds.','The mesh stent is open inside the clot. Wait a few seconds for it to grip.'))}}
    else if(tx.stage==='wait'){tx.w+=dt;if(edge){tx.stage='pull';tx.pull=0}}
    else if(tx.stage==='pull'&&B){tx.pull+=dt/3;if(tx.pull>=1)skResolve()}}
  if(tx&&tx.type==='asp'&&tx.stage==='suck'&&B){tx.suck=(tx.suck||0)+dt/4;if(tx.suck>=1)skResolve()}
  // lights on the control strip
  $('lamp').classList.toggle('on',!!(fl||s.cine));document.querySelector('[data-k="Space"]').classList.toggle('on',!!fl);$('bCine').classList.toggle('on',!!s.cine);$('bInj').classList.toggle('on',!!inj);
  ['ArrowLeft','ArrowUp','ArrowDown','ArrowRight'].forEach(k=>document.querySelector(`[data-k="${k}"]`).classList.toggle('on',!!down(k)));
  const hold=document.querySelectorAll('#skPop [data-skhold]');hold.forEach(b=>b.classList.toggle('on',!!B));
}
function skDraw(){
  const s=SK,ctx=img.getContext('2d'),fl=down('Space','KeyF')||s.cine||s.ctrlT>0;
  if(s.review){skRender(ctx,{A:s.A,image:true,dist:s.review.dist,front:s.review.front,fade:1,cath:s.review.cath,guide:s.review.guide,clot:s.clot,mark:s.found});}
  else skRender(ctx,{A:s.A,image:fl,dist:s.inj&&s.inj.dist,front:s.inj?s.inj.front:0,fade:s.inj?s.inj.fade:0,road:s.roadOn&&s.road?s.road:null,cath:s.cat,guide:s.guide,clot:s.clot,mark:s.found,device:s.tx&&s.tx.type==='sr'&&s.tx.stage!=='deploy'&&s.tx.stage!=='choose'?'sr':null,perf:s.sah});
  // the text on the image
  const m=skMinutes(),hh=Math.floor(m/60),mm=String(Math.floor(m%60)).padStart(2,'0');
  hudTL.textContent=`${s.pat.code} · ${s.pat.pt}\nNIHSS ${skNihss()}`;
  hudTR.innerHTML=s.review?`<span class="act">REVIEW · FILM ${s.review.id}</span>`:s.cine?'<span class="act">● CINE</span>':fl?'<span class="act">FLUORO</span>':'';
  hudBL.textContent=s.review?pw('Click where the dye column stops','Click where the dye suddenly stops'):fl?'':`Hold ${shortKey('Space')} for X-ray`;
  hudBR.textContent=`${pw('Door to reperfusion','Since arrival')} ${hh}:${mm}${s.reperfAt!=null?' ✓':''}\n${Math.round(s.contrast)} mL · ${Math.round(s.ak)} mGy`;
}
/* recording: C starts and stops a film; the film keeps the fullest dye picture */
function skToggleCine(){
  const s=SK;if(s.review){s.review=null}
  if(!s.cine){s.cine=true;s.maxFront=0;s.runDist=null;if(typeof sfx==='function')sfx('pedal');return}
  s.cine=false;if(typeof sfx==='function')sfx('pedal');
  if(!s.runDist||s.maxFront<20){toast(pw(`No dye in that film. Hold ${shortKey('KeyJ')} while recording.`,`That film had no dye in it: hold ${shortKey('KeyJ')} to inject while it records.`));return}
  const cl=s.clot,showsClot=!!(cl&&(()=>{const v=s.A.V[cl.vid],D=s.runDist[cl.vid];let i=0;while(i<v.n-1&&v.cum[i+1]<cl.s-cl.len/2-2)i++;return D[i]<=s.maxFront})());
  const run={id:s.runs.length+1,dist:s.runDist,front:s.maxFront,cath:{...s.cat,stack:s.cat.stack.map(x=>({...x}))},guide:s.guide,where:skName(s.cat.vid),showsClot};
  s.runs.push(run);s.road={dist:s.runDist,front:s.maxFront};
  toast(`${pw('Film','Film')} ${run.id} ${pw('saved','saved')} · ${run.where}${showsClot&&!s.found?pw(' · open it and click the cut-off',' · open it and click where the dye stops'):''}`);
  skPanel(true);
}
/* X: the microcatheter out of the guide, or back */
function skDeeper(){
  const s=SK,c=s.cat,v=s.A.V[c.vid];
  if(c.deep){if(v.intra){toast(pw('Pull the microcatheter back into the neck first.','Pull the thin tube back down into the neck first.'));return}c.deep=false;s.guide=null;toast(pw('Microcatheter back in the guide.','The thin tube is back inside the big one.'));return}
  if(!/ICA|VA|CCA/.test(c.vid)){toast(pw('Park the guide in a neck artery (carotid or vertebral) first.','First bring the big tube up into a neck artery (carotid or vertebral).'));return}
  c.deep=true;s.guide=skCathPath(s.A,c);toast(pw('Microcatheter and wire out of the guide: you can go into the head now.','The thin tube (microcatheter) is out of the big one: you can now steer into the head.'));if(typeof sfx==='function')sfx('engage');skPanel(true);
}
/* marking the clot on a film */
img.addEventListener('click',e=>{
  if(!SK||SK.done||!SK.review)return;
  const r=img.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*512,y=(e.clientY-r.top)/r.height*512,cl=SK.clot;
  if(!cl){toast(pw('There is no clot left to mark.','Nothing is blocked any more.'));return}
  const p=skPt(SK.A.V[cl.vid],cl.s-cl.len/2),near=[0,1].some(pane=>{const q=skProj(p,pane);return Math.hypot(q[0]-x,q[1]-y)<20});
  if(near&&SK.review.showsClot){SK.pending=true;SK.popKey='';skPop()}
  else toast(SK.review.showsClot?pw('No cut-off there. Click where the dye column stops.','Not there: click where the dye suddenly stops.'):pw('This film does not reach the clot. Film from closer to it.','The dye in this film does not reach the blocked artery. Film again from the right neck artery.'));
});
/* ---------- the side panel ---------- */
function skPanel(force){
  const s=SK;if(!s)return;const el=$('skPanel'),c=s.cat,saved=skBrainSaved();
  const key=[s.runs.length,c.vid,c.deep,s.roadOn,!!s.review,s.found,s.tici,s.passes,Math.round(skMinutes()),skNihss(),!!s.sah].join();if(!force&&key===s.panelKey)return;s.panelKey=key;
  el.innerHTML=`<h2>${pw('The brain','The brain')}</h2>
    <div class="reads"><div class="read"><span>NIHSS</span><b>${skNihss()}</b></div><div class="read"><span>${pw('Brain saved','Brain still savable')}</span><b>${saved}<small>%</small></b><i class="lvl"><b style="width:${saved}%"></b></i></div>
    <div class="read"><span>${pw('Reperfusion','Blood flow')}</span><b>${s.tici?ticiName(s.tici):'–'}<small>${s.tici?'TICI':''}</small></b></div><div class="read"><span>${pw('Passes','Tries')}</span><b>${s.passes}</b></div></div>
    <h2 style="margin-top:8px">${pw('Catheter','The tube')}</h2>
    <div class="status">${pw('Tip in the','Tip in the')} ${skName(c.vid)}${c.deep?pw(' · microcatheter out',' · thin tube out'):''}.</div>
    <div class="row"><button class="btn" data-sk="deep">${c.deep?pw('Microcatheter back','Thin tube back'):pw('Go deeper: microcatheter','Go deeper: thin tube')} <kbd>${shortKey('KeyX')}</kbd></button><button class="btn" data-sk="road" aria-pressed="${s.roadOn}">${pw('Roadmap','Roadmap (ghost of the last film)')}: ${s.roadOn?'on':'off'}</button></div>
    <h2 style="margin-top:8px">${pw('Films','Films')}</h2>
    <div class="runs">${s.runs.length?s.runs.map(r=>`<button class="run${s.review===r?' sel':''}" data-skrun="${r.id}"><b>${pw('Film','Film')} ${r.id}</b><span>${r.where}</span></button>`).join(''):`<div class="empty">${pw(`No films yet. Press ${shortKey('KeyC')} to record, hold ${shortKey('KeyJ')} to inject.`,`No films yet. Press ${shortKey('KeyC')} to record, then hold ${shortKey('KeyJ')} to inject dye.`)}</div>`}</div>
    ${s.review?`<div class="row"><button class="btn" data-sk="live">${pw('Back to live','Back to live')}</button></div>`:''}
    <button class="btn primary" data-sk="finish" ${s.runs.length||s.sah?'':'disabled'}>${pw('Finish and report','Finish and report')}</button>`;
}
function skPanelClick(e){
  const b=e.target.closest('button');if(!b||!SK)return;const d=b.dataset;
  if(d.sk==='deep')skDeeper();
  else if(d.sk==='road'){SK.roadOn=!SK.roadOn;if(SK.roadOn&&!SK.road)toast(pw('Record a film first: the roadmap is its ghost.','Record a film first: the roadmap is a faint copy of it.'))}
  else if(d.sk==='live')SK.review=null;
  else if(d.sk==='finish')skFinish();
  else if(d.skrun){const r=SK.runs.find(x=>x.id===+d.skrun);SK.review=SK.review===r?null:r;if(SK.review&&!SK.found)toast(pw('Click where the dye column stops: that is the clot.','Click where the dye suddenly stops: that is where the clot is.'))}
  skPanel(true);
}
/* ---------- the pop-up: say where the clot is, then pull it out ---------- */
function skPop(){
  const s=SK;if(!s)return;const el=$('skPop'),c=s.cat,cl=s.clot;
  const crossed=!!(cl&&c.deep&&c.vid===cl.vid&&c.s>cl.s+cl.len/2+1.5),atFace=!!(cl&&c.deep&&c.vid===cl.vid&&c.s>=cl.s-cl.len/2-5&&c.s<=cl.s-cl.len/2+1.5);
  const tx=s.tx,key=[s.pending,s.found,!!cl,crossed,atFace,tx&&tx.type,tx&&tx.stage,tx&&Math.round((tx.dep||tx.pull||tx.suck||0)*10),tx&&Math.floor((tx.w||0)*2),s.tici,s.passes,!!s.sah,s.done].join();
  if(key===s.popKey)return;s.popKey=key;
  let h='';
  if(s.pending){h=`<div class="txhead"><b>${pw('Where is the clot?','Where is the clot?')}</b></div><div class="pending"><div>${pw('Name the occluded segment.','Which artery is blocked?')}</div>
    <div class="sev sksites">${['ICA-T','M1','M2','BA'].map(k=>`<button data-sksite="${k}">${skSite(k)}</button>`).join('')}</div><div class="row"><button class="btn" data-skx="1">${pw('Not sure yet','Not sure yet')}</button></div></div>`}
  else if(s.found&&!s.sah){
    if(!tx||tx.stage==='choose'){
      const res=s.tici?`<div class="${s.tici>=2.5?'ffrread ok':'alert'}"><b>${pw('Control run','After that try')}: TICI ${ticiName(s.tici)}</b><span>${TICI_TXT[s.tici]}.</span></div>`:'';
      h=`<div class="txhead"><b>${cl?pw('Remove the clot','Pull the clot out'):pw('Artery open','Artery open')}</b></div><div class="pending">${res}
        ${cl?`<div>${pw(`Clot in the ${skName(cl.vid)}.`,`The clot is in the ${skName(cl.vid)}.`)} ${c.deep?'':pw(`Bring the guide into the neck and press ${shortKey('KeyX')} for the microcatheter.`,`Bring the big tube up the neck, then press ${shortKey('KeyX')} for the thin tube.`)}</div>
        <div class="tools"><button class="btn" data-sktool="sr" ${crossed?'':'disabled'}><b>${pw('Stent retriever','Mesh stent (stent retriever)')}</b><span>${crossed?pw('Microcatheter is across the clot','Ready: the tube is through the clot'):pw('First cross the clot with the microcatheter','First push the thin tube through the clot')}</span></button>
        <button class="btn" data-sktool="asp" ${atFace?'':'disabled'}><b>${pw('Aspiration','Suction tube (aspiration)')}</b><span>${atFace?pw('Tip is at the clot face','Ready: the tip is touching the clot'):pw('Stop with the tip at the clot face','Stop with the tip just touching the clot')}</span></button></div>`:''}
        <div class="row">${s.tici>=2.5||s.passes>=1?`<button class="btn${!cl?' primary':''}" data-sk2="finish">${pw('Finish the case','Finish the case')}</button>`:''}</div></div>`}
    else if(tx.type==='sr'){
      const w=tx.w||0,zone=w<1.5?'too soon':w<3?'nearly':w<=6?'just right':w<=9?'still good':'long enough';
      h=`<div class="txhead"><b>${pw('Stent retriever','Mesh stent')}</b></div><div class="pending">
        ${tx.stage==='deploy'?`<div>${pw('Hold to unsheathe the stent across the clot.','Hold to open the mesh stent inside the clot.')}</div><i class="gmeter"><b style="width:${Math.round((tx.dep||0)*100)}%"></b></i>`
        :tx.stage==='wait'?`<div>${pw('Let it integrate with the clot: 3 to 6 seconds is ideal. Then hold to pull back with suction.','Let it grip the clot: 3 to 6 seconds is best. Then hold to pull it back with suction.')}</div><i class="gmeter skwait"><b style="width:${Math.min(100,w/9*100)}%"></b></i><div class="fine">${Math.floor(w)} s · ${zone}</div>`
        :`<div>${pw('Pulling back under suction. Keep holding.','Pulling the clot back with suction. Keep holding.')}</div><i class="gmeter"><b style="width:${Math.round((tx.pull||0)*100)}%"></b></i>`}
        <div class="row"><button class="hold" data-skhold="1"><span>${tx.stage==='deploy'?pw('Open','Open'):pw('Pull','Pull')}</span><kbd>${shortKey('KeyB')}</kbd></button></div></div>`}
    else{h=`<div class="txhead"><b>${pw('Aspiration','Suction')}</b></div><div class="pending"><div>${pw('Hold for suction with the tip on the clot; it comes out with the catheter.','Hold to suck on the clot; the tube comes out with it.')}</div><i class="gmeter"><b style="width:${Math.round((tx.suck||0)*100)}%"></b></i>
        <div class="row"><button class="hold" data-skhold="1"><span>${pw('Suction','Suck')}</span><kbd>${shortKey('KeyB')}</kbd></button></div></div>`}
  }
  else if(s.sah){h=`<div class="txhead"><b>${pw('Bleed in the brain','Bleeding in the brain')}</b></div><div class="alert"><b>${pw('Subarachnoid haemorrhage','Brain bleed (subarachnoid haemorrhage)')}</b><span>${pw('Stop: no more passes. Finish the case.','Stop here: no more tries. Finish the case.')}</span></div><div class="row"><button class="btn primary" data-sk2="finish">${pw('Finish the case','Finish the case')}</button></div>`}
  el.hidden=!h;el.innerHTML=h;
}
function skPopClick(e){
  const b=e.target.closest('button');if(!b||!SK)return;const d=b.dataset,s=SK;
  if(d.sksite){s.pending=false;s.found=true;s.gradeOk=d.sksite===s.clot.site;s.review=null;toast(pw('Clot marked. Now take the microcatheter up to it.','Clot marked. Now steer the thin tube up to it.'));if(typeof sfx==='function')sfx('ding')}
  else if(d.skx){s.pending=false}
  else if(d.sktool==='sr')s.tx={type:'sr',stage:'deploy',dep:0};
  else if(d.sktool==='asp')s.tx={type:'asp',stage:'suck',suck:0};
  else if(d.sk2==='finish'){skFinish();return}
  s.popKey='';skPop();skPanel(true);
}
$('monitor').addEventListener('pointerdown',e=>{if(SK&&e.target.closest('[data-skhold]')){e.preventDefault();keys.btn_KeyB=true}});
/* one pass: how well it went depends on the site, the device, how long the stent gripped, and the setting */
function skResolve(){
  const s=SK,tx=s.tx,cl=s.clot;s.passes++;
  const base={sr:{'ICA-T':0.5,M1:0.64,M2:0.56,BA:0.56},asp:{'ICA-T':0.46,M1:0.58,M2:0.62,BA:0.62}}[tx.type][cl.site];
  let f=1;if(tx.type==='sr'){const w=tx.w;f=w<1.5?0.45:w<3?0.8:w<=6?1:w<=9?0.95:0.85}
  const diffF={story:1.3,easy:1.15,medium:1,hard:0.9}[s.dk]||1,p=Math.min(0.95,base*f*diffF*Math.pow(0.9,s.passes-1)),r=Math.random();
  let tici=r<p*0.55?3:r<p?2.5:(Math.random()<0.3?2:1);
  if(s.tut)tici=tx.type==='sr'&&(tx.w<3||tx.w>6)?2.5:3; // the tutorial pass always works
  s.tx=null;
  if(tici>=2.5){
    s.tici=Math.max(s.tici,tici);if(s.reperfAt==null)s.reperfAt=skMinutes();if(s.passes===1)s.firstPassTici=tici;
    // a fragment can break off into a smaller branch
    const emb=tici===2.5&&(cl.site==='M1'||cl.site==='ICA-T')&&Math.random()<0.3;
    if(emb){const id=s.pat.side+(Math.random()<0.5?'M2s':'M2i'),v=s.A.V[id];s.clot={vid:id,s:v.len*0.45,len:6,site:'M2',emb:true};s.emboli=true;
      toast(pw('TICI 2b: most of the territory is back. A fragment went into an M2 branch: stop here or go after it.','Most of the area has blood flow again (TICI 2b). A small piece broke off into a branch: you can stop, or go after it.'))}
    else{s.clot=null;toast(tici===3?pw('TICI 3: complete reperfusion.','Complete blood flow restored (TICI 3).'):pw('TICI 2b: most of the territory is flowing again.','Most of the area has blood flow again (TICI 2b).'))}
    if(typeof sfx==='function')sfx('chime');
  }else{s.tici=Math.max(s.tici,tici);toast(pw(`No luck this pass: ${TICI_TXT[tici]}. Try again.`,`The clot did not come out this time (${TICI_TXT[tici]}). Try again.`),true)}
  // the device comes out; the tip falls back towards the neck; a control run shows the result
  skMove(s.A,s.cat,-30,s.dk,null);
  s.inj={t0:s.t,active:false,rel:s.t+1.6,dist:skDyeDist(s.A,s.cat,s.clot),front:1e9,fade:1};s.ctrlT=2.6;
  s.popKey='';skPop();skPanel(true);
}
/* the steering guide (Story and Easy) */
function skRoute(){const s=SK,A=s.A,target=s.clot?s.clot.vid:null;if(!target)return [];const r=[];let v=A.V[target];while(v){r.unshift(v.id);v=v.parent?A.V[v.parent]:null}if(target==='BA'&&!r.includes('LVA')){/* already via LVA */}return r}
function skGuide(){
  const s=SK,el=$('skGuide');if(!el)return;if(s.D.level!==1||s.review||s.sah||!s.clot){el.hidden=true;return}
  const A=s.A,c=s.cat,route=skRoute(),k=id=>`<kbd>${shortKey(id)}</kbd>`;let t='';
  const idx=route.indexOf(c.vid);
  if(s.tx&&s.tx.stage!=='choose'){t=s.tx.type==='sr'?(s.tx.stage==='wait'?`Wait until the bar is in the middle, then hold ${k('KeyB')} to pull.`:`Hold ${k('KeyB')}.`):`Hold ${k('KeyB')} for suction.`}
  else if(!s.runs.length&&!s.found&&idx>=0&&/ICA|VA$/.test(c.vid)&&!c.deep&&c.s>8){t=`Good spot to film: press ${k('KeyC')} to record, hold ${k('KeyJ')} for dye, then ${k('KeyC')} to stop.`}
  else if(idx<0){t=`Wrong branch (${skName(c.vid)}): pull back ${k('ArrowDown')}.`}
  else if(idx===route.length-1){const v=A.V[c.vid],face=s.clot.s-s.clot.len/2;
    if(!s.found)t=s.runs.length?`Open your film and click where the dye stops.`:`Film here (${k('KeyC')} + ${k('KeyJ')}), open the film and click where the dye stops.`;
    else if(!c.deep&&skPt(v,face)[1]>v.guideMaxY)t=`Press ${k('KeyX')} to send the thin tube on into the head.`;
    else if(c.s<face-6)t=`Push up ${k('ArrowUp')} towards the clot.`;
    else t=`At the clot: push ${k('ArrowUp')} through it for the mesh stent, or stop just before it for suction.`}
  else{const next=A.V[route[idx+1]],v=A.V[c.vid],dist=next.os>=v.len-0.5?v.len-c.s:next.os-c.s;
    if(next.intra&&!c.deep)t=s.found?`Press ${k('KeyX')} to send the thin tube on into the head.`:(s.runs.length?`Open your film and click where the dye stops.`:`Film first: ${k('KeyC')} to record, hold ${k('KeyJ')} for dye.`);
    else if(dist>14||(dist>4&&skPick(A,{...c,s:Math.max(c.s,next.os>=v.len-0.5?v.len:next.os)},s.dk)===next))t=`Push up ${k('ArrowUp')} towards the opening of the ${skName(next.id)}.`;
    else if(dist<-4)t=`You passed it: pull back ${k('ArrowDown')} a little.`;
    else{const d=((next.rot-c.rot+540)%360)-180,pick=skPick(A,{...c,s:Math.max(c.s,next.os>=v.len-0.5?v.len:next.os)},s.dk);t=pick===next&&Math.abs(d)<=skWindow(A,next,s.dk)*0.7?`Lined up: push ${k('ArrowUp')} into the ${skName(next.id)}.`:`Turn ${d>0?'clockwise '+k('ArrowRight'):'anticlockwise '+k('ArrowLeft')} towards the ${skName(next.id)}${pick&&pick!==next?` (now it points into the ${skName(pick.id)})`:''}.`}}
  if(!(down('Space','KeyF')||s.cine)&&!/film|Film|Hold/.test(t))t=`Hold ${k('Space')} for X-ray, then: `+t.charAt(0).toLowerCase()+t.slice(1);
  el.hidden=false;if(el.dataset.t!==t){el.innerHTML=t;el.dataset.t=t}
}
/* ---------- the report ---------- */
function skFinish(){
  const s=SK;if(!s||s.done)return;s.done=true;s.cine=false;keys.btn_KeyB=false;
  if(s.tut){profile.skTutDone=true;saveProfile();$('coach').hidden=true}
  const rows=[],notes=[],gtr=s.reperfAt!=null?s.reperfAt-s.pat.door:null;
  const rep=s.tici>=3?40:s.tici>=2.5?32:s.tici>=2?12:0;rows.push([`${pw('Reperfusion','Blood flow restored')} (TICI ${s.tici?ticiName(s.tici):'0'})`,rep,40]);
  const spd=gtr==null?0:Math.round(20*Math.max(0,Math.min(1,1-(gtr-20)/60)));rows.push([`${pw('Speed','Speed')}: ${gtr==null?pw('not reperfused','no flow restored'):pw(`groin to reperfusion ${Math.round(gtr)} min`,`${Math.round(gtr)} min from the groin to flow`)}`,spd,20]);
  const dx=s.found?(s.gradeOk?15:9):0;rows.push([pw('Finding the occlusion','Finding the clot'),dx,15]);
  const ps=s.tici>=2.5?(s.firstPassTici?10:Math.max(0,10-3*(s.passes-1))):0;rows.push([`${pw('Passes','Tries')}: ${s.passes}${s.firstPassTici?pw(' (first-pass effect)',' (first try)'):''}`,ps,10]);
  let saf=15;if(s.sah)saf-=12;if(s.ecaInj>0.3)saf-=2;if(s.contrast>120)saf-=Math.min(4,Math.floor((s.contrast-120)/15));if(s.ak>500)saf-=2;saf=Math.max(0,saf);rows.push([`${pw('Safety and dose','Safety and dose')} (${Math.round(s.contrast)} mL, ${Math.round(s.ak)} mGy)`,saf,15]);
  let total=rows.reduce((a,r)=>a+r[1],0);if(s.sah)total=Math.min(total,40);
  if(s.found)notes.push({c:s.gradeOk?'good':'',t:s.gradeOk?pw(`You found the clot in the ${skSite(s.pat.site)}.`,`You found the clot in the ${skSite(s.pat.site)}.`):pw(`Found the cut-off, but it was the ${skSite(s.pat.site)}.`,`You found the clot, but it was in the ${skSite(s.pat.site)}.`)});
  else notes.push({c:'bad',t:pw('The occlusion was never marked on a film.','The clot was never marked on a film.')});
  if(s.tici>=2.5)notes.push({c:'good',t:pw(`Reperfusion TICI ${ticiName(s.tici)} after ${s.passes} pass${s.passes===1?'':'es'}${gtr!=null?`, ${Math.round(gtr)} minutes after the groin puncture`:''}.`,`Blood flow restored (TICI ${ticiName(s.tici)}) after ${s.passes} tr${s.passes===1?'y':'ies'}${gtr!=null?`, ${Math.round(gtr)} minutes after the start`:''}.`)});
  else notes.push({c:'bad',t:pw('The artery was not opened (TICI 2b or better is the aim).','The artery was not opened (the aim is most of the territory flowing, TICI 2b or better).')});
  if(s.emboli)notes.push({c:s.clot?'':'good',t:s.clot?pw('A fragment was left in an M2 branch.','A small piece of clot was left in a branch.'):pw('A fragment went distal, and you retrieved it too.','A small piece broke off and you got that out too.')});
  if(s.sah)notes.push({c:'bad',t:pw('Subarachnoid haemorrhage from the wire pushing through a distal branch: score capped at 40.','The wire went through the end of a small artery and caused a brain bleed: score capped at 40.')});
  if(s.ecaInj>0.3)notes.push({c:'',t:pw('Dye was injected into the external carotid: that films the face, not the brain.','Dye went into the artery to the face, not the brain.')});
  const indep=s.tici>=2.5?Math.max(1,Math.min(8,Math.round((0.72-(gtr||60)*0.006-s.pat.nihss*0.012)*10))):1;
  notes.push({c:'',t:pw(`About ${indep} in 10 patients like this would be walking independently at three months (mRS 0–2). Every 10 minutes sooner adds roughly one more in 100.`,`About ${indep} in 10 people like this would be walking on their own three months later. Every 10 minutes sooner helps about one more person in 100.`)});
  const earned=Math.round(total/10*s.D.tokenX);profile.tokens+=earned;saveProfile();
  // shared progression: streak, grade, badges, casebook
  let achRes=null,fresh=null;
  if(typeof recordCasebook==='function')fresh=recordCasebook({rare:s.pat.rare,code:s.pat.code,seed:s.pat.seed,title:s.pat.title},total);
  if(typeof recordCase==='function')achRes=recordCase({score:total,diff:s.dk,level:s.D.level,daily:null,sig:0,opened:0,sigAll:0,graded:0,comps:[],
    S:{complication:null,budget:120,contrast:s.contrast,ftime:s.ftime,blind:99,ffr:[],stents:[],d2b:null,whips:0,weekly:null,c:{rare:s.pat.rare}},
    stroke:{tici:s.tici,passes:s.passes,gtr,first:s.firstPassTici}});
  if(achRes)achRes.fresh.forEach((a,i)=>setTimeout(()=>toast(`Achievement: ${a.name} · +${a.t} tokens`),600+i*1800));
  if(typeof sfx==='function'&&(fresh||(achRes&&achRes.fresh.length)))setTimeout(()=>sfx('chime'),350);
  const grade=s.sah?'Complication':total>=85?pw('Attending standard','Expert work'):total>=70?pw('Senior fellow','Very good'):total>=50?pw('Junior fellow','Good start'):pw('Keep practising','Keep practising');
  const ov=$('resultOv');document.body.classList.add('inreport');$('skPop').hidden=true;$('skGuide').hidden=true;
  ov.innerHTML=`<div class="rephead">${avatarSVG(profile.avatar,48)}<div><h1>${pw('Stroke report','Stroke report')} · ${s.pat.code}</h1><span class="fine">${esc(profile.name)} · ${s.D.label} · ${s.pat.title}</span></div></div>
    <div class="score"><b>${total}</b><span>${grade}</span></div>
    <div class="tokens">${CUP} +${earned} coffee token${earned===1?'':'s'} · ${profile.tokens} banked</div>
    ${fresh&&typeof casebookReportHTML==='function'?casebookReportHTML(fresh):''}
    ${typeof achReportHTML==='function'?achReportHTML(achRes):''}
    <div class="rows">${rows.map(r=>`<span>${r[0]}</span><span class="v">${Math.round(r[1])} / ${r[2]}</span>`).join('')}</div>
    <div class="notes">${notes.map(n=>`<div class="${n.c}">${n.t}</div>`).join('')}</div>
    <div class="row"><button class="btn primary" id="skNew">${pw('New stroke patient','New stroke patient')}</button><button class="btn" id="skAgain">${pw('Repeat this patient','Repeat this patient')}</button><button class="btn" id="skMenu">${pw('Main menu','Main menu')}</button></div>`;
  ov.hidden=false;window.scrollTo(0,Math.max(0,$('monitor').offsetTop-8));
  const seed=s.pat.seed;$('skNew').onclick=()=>skStart(null);if(s.tut)$('skNew').textContent=pw('Your first real stroke patient','Your first real stroke patient');$('skAgain').onclick=()=>skStart(seed);$('skMenu').onclick=()=>showMenu('home');
}
/* ---------- the stroke tutorial: one patient, a coach card, one step at a time ---------- */
function skTutSeed(){for(let i=1;i<20000;i++){const sd=(i*7919)%CODE_SPACE,p=skPatient(sd);if(p.site==='M1'&&p.side==='L'&&p.arch==='I'&&!p.bovine)return sd}return 1}
const skReached=id=>SK.cat.vid===id||SK.cat.stack.some(x=>x.vid===id);
const SK_TUT=[
  {title:'X-ray on',text:()=>`Hold ${kk('Space')} (or the X-ray button) to switch the X-ray on. You see two views at once: the front on the left, the side on the right. The tube is waiting in the main artery from the heart (the aorta), at the bottom.`,done:s=>s.ftime>0.6},
  {title:'Into the left neck artery',text:()=>`Keep the X-ray on and hold ${kk('ArrowUp')} to push the tube up and over the arch. The left neck artery (left common carotid) is the second branch. The guide under the X-ray says when to turn the tip up into it.`,done:()=>skReached('LCCA')},
  {title:'Up the neck',text:()=>`Push on up the neck. At the fork, keep the tip pointing up to go into the internal carotid (to the brain), not the external carotid (to the face).`,done:()=>skReached('LICA')},
  {title:'Film it',text:()=>`Press ${kk('KeyC')} to record, hold ${kk('KeyJ')} for about two seconds to inject dye, then press ${kk('KeyC')} to stop. The dye fills the brain's arteries, except beyond the clot.`,done:s=>s.runs.some(r=>r.showsClot)},
  {title:'Find the clot',text:()=>`Open Film 1 under Films. Click where the dye column suddenly stops, then say which artery it is: the main middle brain artery (M1).`,done:s=>s.found},
  {title:'Go deeper',text:()=>`The big tube cannot go into the skull. Push up to the top of the neck, then press ${kk('KeyX')}: a thin tube (microcatheter) comes out of it and can go into the head.`,done:s=>s.cat.deep},
  {title:'Through the clot',text:()=>`Steer the thin tube into the M1 (the guide shows which way) and push right through the clot. The mesh stent button in the pop-up turns ready.`,done:s=>!!(s.clot&&s.cat.vid===s.clot.vid&&s.cat.s>s.clot.s+s.clot.len/2+1.5)||s.passes>0},
  {title:'Open the stent',text:()=>`In the pop-up choose the mesh stent (stent retriever), then hold ${kk('KeyB')} to open it inside the clot.`,done:s=>!!(s.tx&&s.tx.stage!=='deploy')||s.passes>0},
  {title:'Grip, then pull',text:()=>`Let go of ${kk('KeyB')} and wait 3 to 6 seconds while it grips (watch the bar). Then hold ${kk('KeyB')} to pull it back with suction.`,done:s=>s.passes>0},
  {title:'Check and finish',text:()=>`The control run shows the blood flowing again (TICI). Press Finish the case for your report.`,done:s=>s.done},
];
const kk=id=>`<kbd>${shortKey(id)}</kbd>`;
function skCoach(){
  const el=$('coach');if(!SK||!SK.tut){if(SK)el.hidden=true;return}
  const st=SK_TUT[SK.tut.i];if(!st){el.hidden=true;return}
  el.hidden=false;el.innerHTML=`<div class="coachhead"><b>Stroke tutorial · step ${SK.tut.i+1} of ${SK_TUT.length} · ${st.title}</b><button class="btn" data-skcoach="skip">Skip tutorial</button></div><p>${typeof glossLink==='function'?glossLink(st.text()):st.text()}</p>
    <div class="coachdots">${SK_TUT.map((_,i)=>`<i class="${i<SK.tut.i?'done':i===SK.tut.i?'now':''}"></i>`).join('')}</div>`;
}
function skTutTick(){
  const s=SK;if(!s||!s.tut)return;const st=SK_TUT[s.tut.i];
  if(st&&st.done(s)){s.tut.i++;const nx=SK_TUT[s.tut.i];if(nx)toast(`✓ ${st.title}. Next: ${nx.title.toLowerCase()}.`);skCoach()}
}
$('coach').addEventListener('click',e=>{const b=e.target.closest('[data-skcoach]');if(!b||!SK)return;SK.tut=null;profile.skTutDone=true;saveProfile();$('coach').hidden=true;toast('Tutorial skipped. You can replay it from the Stroke room.')});
function skTutorial(){if(profile&&!profile.skIntroSeen&&typeof openStrokeIntro==='function')openStrokeIntro(()=>skStart(null,{tut:true}));else skStart(null,{tut:true})}
/* ---------- menu: the stroke room folder and chart ---------- */
function skChart(D){
  return `<div class="chead"><h2>${pw('Stroke room','Stroke room')}</h2><span class="meta">${pw('Mechanical thrombectomy','Pulling a clot out of a brain artery')} · ${D.label}</span></div>
    <dl><dt>${pw('The job','The job')}</dt><dd>${pw('A large-vessel stroke: a clot is blocking an artery in the brain. Steer up over the arch into the right neck artery, film to find where the dye stops, take the microcatheter into the head and pull the clot out.','A clot is blocking an artery in the brain. Steer the tube up into the neck, film with dye to find where it stops, send the thin tube into the head and pull the clot out.')}</dd>
    <dt>${pw('New here','New here')}</dt><dd>${pw('Two views at once (front and side), a roadmap ghost of your last film, the microcatheter (X), the stent retriever and aspiration, and the stroke clock: every minute costs brain.','Two X-ray views at once (front and side), a faint ghost of your last film to steer by, a thin tube for the head (X), a mesh stent or a suction tube, and a clock: every minute costs brain cells.')}</dd>
    <dt>${pw('Controls','Controls')}</dt><dd>${pw('The same keys as the heart room. B opens and pulls the stent retriever, or holds suction.','The same keys as the heart room. B opens and pulls the mesh stent, or holds suction.')}</dd></dl>
    ${profile.skTutDone?`<button class="btn primary go" data-act="stroke">Start a stroke case</button><div class="row"><button class="btn" data-act="sktut">Tutorial again</button><button class="btn" data-act="skintro">How a thrombectomy works (1 min)</button></div>`
      :`<button class="btn primary go" data-act="sktut">Start the stroke tutorial</button><div class="row"><button class="btn" data-act="stroke">Skip it: start a case</button><button class="btn" data-act="skintro">How a thrombectomy works (1 min)</button></div>`}`;
}
/* ---------- wiring into the shared game ---------- */
{const sm=showMenu;window.showMenu=function(v){skStop();return sm(v)}}
{const sc=startCase;window.startCase=function(ci,opt){skStop();return sc(ci,opt)}}
{const tc=toggleCine;window.toggleCine=function(){if(SK&&!SK.done){skToggleCine();return}return tc()}}
{const ex=exchangeTo;window.exchangeTo=function(t){if(SK&&!SK.done){skDeeper();return}return ex(t)}}
$('bCine').addEventListener('click',e=>{if(SK&&!SK.done){e.stopImmediatePropagation();skToggleCine()}},true);
