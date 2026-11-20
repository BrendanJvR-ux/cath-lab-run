/* Cath Lab Run: game state, input, UI, hemodynamic strip, main loop and scoring. */
"use strict";
const img=document.getElementById('img');ictx=img.getContext('2d');

/* ---------- state ---------- */
let S=null;
const keys={};
function newState(ci){
  return {ci,c:CASES[ci],lesions:prepLesions(CASES[ci].lesions),clock:0,phase:0,hr:72,hrT:72,a:0,b:0,cath:{s:0,th:CATH.JL.home,type:'JL'},exch:0,
    cL:0,cR:0,cRoot:0,hist:{L:[],R:[],root:[]},histN:0,contrast:0,ak:0,ftime:0,ctime:0,blind:0,wasted:0,
    cine:null,runs:[],marks:[],pending:null,review:null,imgAcc:0,frame:0,deepInj:0,rcaInj:0,complication:null,done:false,
    sysP:128,diaP:74,beatMax:0,beatMin:999,lastPh:0,hemoAcc:0,pci:null,stents:[],stE:0};
}
const histAt=(arr,t)=>{if(t<0||!arr.length)return 0;const i=Math.floor(t*50);return i<arr.length?arr[i]:arr[arr.length-1]};

/* ---------- UI refs ---------- */
const $=id=>document.getElementById(id);
const hudTL=$('hudTL'),hudTR=$('hudTR'),hudBL=$('hudBL'),hudBR=$('hudBR'),toastEl=$('toast');
let toastT=0;
function toast(msg,danger){toastEl.textContent=msg;toastEl.className='toast'+(danger?' danger':'');toastEl.hidden=false;toastT=2.6}

$('caseList').innerHTML=CASES.map((c,i)=>`<button class="case" data-ci="${i}"><span>CASE ${i+1} · ${c.pt}</span><b>${c.title}</b><em>${c.task}</em></button>`).join('');
$('caseList').addEventListener('click',e=>{const b=e.target.closest('.case');if(b)startCase(+b.dataset.ci)});
$('presets').innerHTML=PRESETS.map((p,i)=>`<button data-i="${i}" title="Key ${i+1}">${p[0]}</button>`).join('');
$('presets').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setPreset(+b.dataset.i)});
function setPreset(i){if(!S||S.cine)return;S.a=PRESETS[i][1];S.b=PRESETS[i][2];syncArm()}
function syncArm(){$('sA').value=S?S.a:0;$('sB').value=S?S.b:0;const a=S?S.a:0,b=S?S.b:0;$('oA').textContent=a===0?'AP':(a>0?'LAO ':'RAO ')+Math.abs(a)+'°';$('oB').textContent=b===0?'0°':(b>0?'CRA ':'CAU ')+Math.abs(b)+'°'}
$('sA').addEventListener('input',e=>{if(!S||S.cine){syncArm();return}S.a=+e.target.value;syncArm()});
$('sB').addEventListener('input',e=>{if(!S||S.cine){syncArm();return}S.b=+e.target.value;syncArm()});

function startCase(ci){
  S=newState(ci);
  $('startOv').hidden=true;$('resultOv').hidden=true;closeReview();
  const c=S.c;$('caseHead').innerHTML=`<h2>Patient · case ${ci+1}</h2><b>${c.title}</b><p>${c.pt}. ${c.hx}</p><p class="task">${c.task}</p>`;
  ictx.fillStyle='#000';ictx.fillRect(0,0,W,W);
  syncArm();renderRuns();renderMarks();renderPending();renderPCI(true);
  toast('Sheath in the right femoral artery. Hold Space for fluoro and advance.');
}

/* ---------- input ---------- */
const GAME_KEYS=new Set(['Space','KeyJ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD','KeyC','KeyF','KeyB']);
window.addEventListener('keydown',e=>{
  if(e.target&&(e.target.tagName==='INPUT'&&e.target.type!=='range'))return;
  if(e.target&&e.target.type==='range'&&e.code.startsWith('Arrow'))return;
  if(GAME_KEYS.has(e.code)||/^Digit[1-7]$/.test(e.code)){if(S&&!S.done)e.preventDefault()}else return;
  if(e.repeat)return;
  if(e.code==='KeyC'){toggleCine();return}
  if(e.code.startsWith('Digit')){setPreset(+e.code.slice(5)-1);return}
  keys[e.code]=true;
});
window.addEventListener('keyup',e=>{keys[e.code]=false});
window.addEventListener('blur',()=>{for(const k in keys)keys[k]=false});
document.querySelectorAll('.hold[data-k]').forEach(b=>{
  const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys['btn_'+k]=true});
  const up=()=>{keys['btn_'+k]=false};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
});
$('bCine').addEventListener('click',toggleCine);
const down=(...ks)=>ks.some(k=>keys[k]||keys['btn_'+k]);

$('bExch').addEventListener('click',()=>{
  if(!S||S.done||S.exch>0)return;
  if(S.pci){toast('Finish or cancel the stent first.');return}
  if(S.cath.s>S_EXCH){toast('Pull the catheter back to the descending aorta before exchanging.');return}
  S.exch=2.2;toast('Exchanging catheter over a 0.035" wire…');
});

function toggleCine(){
  if(!S||S.done||S.complication)return;
  if(S.review)closeReview();
  if(S.cine){stopCine();return}
  S.cine={id:S.runs.length+1,a:S.a,b:S.b,frames:[],t0:S.clock,lesState:S.lesions.map(L=>({...L}))};
}
function stopCine(){
  const r=S.cine;S.cine=null;if(!r||r.frames.length<4)return;
  let mL=0,mR=0;for(const f of r.frames){mL=Math.max(mL,histAt(S.hist.L,f.t));mR=Math.max(mR,histAt(S.hist.R,f.t))}
  r.sys=mL>0.55?'L':mR>0.55?'R':null;r.mL=mL;r.mR=mR;r.dur=r.frames.length/15;
  S.runs.push(r);renderRuns();
  toast(`Run ${r.id} saved · ${r.sys?(r.sys==='L'?'LCA':'RCA'):'non-selective'} · ${angLabel(r.a,r.b)}`);
}

/* ---------- review ---------- */
function openReview(id){
  if(!S)return;const run=S.runs.find(r=>r.id===id);if(!run)return;
  if(S.cine)stopCine();
  S.review={run,idx:0,playing:true,acc:0};
  $('reviewbar').hidden=false;$('rvSlider').max=run.frames.length-1;$('rvPlay').textContent='Pause';renderRuns();
}
function closeReview(){if(S)S.review=null;$('reviewbar').hidden=true;renderRuns()}
$('rvClose').addEventListener('click',closeReview);
$('rvPlay').addEventListener('click',()=>{if(!S||!S.review)return;S.review.playing=!S.review.playing;$('rvPlay').textContent=S.review.playing?'Pause':'Play'});
$('rvSlider').addEventListener('input',e=>{if(!S||!S.review)return;S.review.idx=+e.target.value;S.review.playing=false;$('rvPlay').textContent='Play';drawReview()});
$('runs').addEventListener('click',e=>{const b=e.target.closest('.run');if(b)openReview(+b.dataset.id)});
function frameState(run,f){
  return {t:f.t,phase:f.phase,a:run.a,b:run.b,mode:'cine',frame:f.frame,lesions:run.lesState||S.lesions,pci:f.pci,cath:true,cathState:cathState(f.cath),
    conc:(sys,t)=>histAt(S.hist[sys],t),root:histAt(S.hist.root,f.t),marks:S.marks.filter(m=>true)};
}
function drawReview(){const R=S.review;const f=R.run.frames[R.idx];renderImage(frameState(R.run,f));$('rvSlider').value=R.idx}
img.addEventListener('click',e=>{
  if(!S||!S.review||S.done||!lastProj)return;
  const rect=img.getBoundingClientRect();const x=(e.clientX-rect.left)/rect.width*W,y=(e.clientY-rect.top)/rect.height*W;
  let best=null,bd=14;
  for(const P of lastProj.projV){for(let i=0;i<P.v.n;i++){if(P.cs[i]<0.3)continue;const d=Math.hypot(P.xs[i]-x,P.ys[i]-y);if(d<bd){bd=d;best={v:P.v,i}}}}
  S.review.playing=false;$('rvPlay').textContent='Play';
  if(!best){toast('No opacified vessel there. Pause on a well-filled frame and click on the vessel.');return}
  S.pending={vid:best.v.id,ld:best.v.ld[best.i],p3:best.v.p[best.i],label:segLabel(best.v,best.v.ld[best.i]),run:S.review.run.id};
  renderPending();drawReview();
});
function renderPending(){
  const el=$('pending');if(!S||!S.pending){el.innerHTML='';return}
  el.innerHTML=`<div class="pending"><div>Marked <b>${S.pending.label}</b> on run ${S.pending.run}. Estimate the diameter stenosis:</div><div class="sev">${BUCKETS.map((b,i)=>`<button data-b="${i}">${b.k}</button>`).join('')}</div><button class="btn" data-x="1">Discard mark</button></div>`;
}
$('pending').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!S||!S.pending)return;
  if(b.dataset.x){S.pending=null}else{S.marks.push({...S.pending,bucket:+b.dataset.b});S.pending=null}
  renderPending();renderMarks();if(S.review)drawReview();
});
function renderMarks(){
  const el=$('marks');
  $('bFinish').disabled=!S||S.done||(!S.runs.length&&!S.complication);
  if(!S||!S.marks.length){el.innerHTML='<div class="empty">Open a cine run and click on a narrowing to mark it.</div>';return}
  el.innerHTML=S.marks.map((m,i)=>`<div class="mark"><span>${i+1}. ${m.label} · ${BUCKETS[m.bucket].k}</span><button data-i="${i}" aria-label="Remove mark ${i+1}">Remove</button></div>`).join('');
}
$('marks').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!S)return;S.marks.splice(+b.dataset.i,1);renderMarks();if(S.review)drawReview()});
function renderRuns(){
  const el=$('runs');
  if(!S||!S.runs.length){el.innerHTML='<div class="empty">No runs yet. Engage an ostium, press Cine, then inject.</div>';$('bFinish').disabled=!S||S.done||!S.complication;return}
  el.innerHTML=S.runs.map(r=>`<button class="run${S.review&&S.review.run===r?' sel':''}" data-id="${r.id}"><b>Run ${r.id}</b><span>${angLabel(r.a,r.b)} · ${r.dur.toFixed(1)} s</span><span class="sys ${r.sys||''}">${r.sys?(r.sys==='L'?'LCA':'RCA'):'NS'}</span></button>`).join('');
  $('bFinish').disabled=S.done;
}

/* ---------- hemodynamics ---------- */
const hemo=$('hemo'),hctx=hemo.getContext('2d');let HB=null,hx=0,dpr=1;
function sizeHemo(){dpr=Math.min(2,window.devicePixelRatio||1);const w=Math.max(200,Math.round(hemo.clientWidth*dpr)),h=Math.round(118*dpr);hemo.width=w;hemo.height=h;HB={e:new Float32Array(w).fill(NaN),p:new Float32Array(w).fill(NaN)};hx=0}
window.addEventListener('resize',sizeHemo);
const gs=(x,m,s)=>Math.exp(-((x-m)*(x-m))/(2*s*s));
function ecgAt(ph,st=0){return 0.1*gs(ph,0.03,0.016)-0.1*gs(ph,0.085,0.006)+1*gs(ph,0.1,0.007)-0.26*gs(ph,0.115,0.008)*(1-st)+(0.28+0.3*st)*gs(ph,0.33,0.04)+st*0.32*gs(ph,0.2,0.06)}
function pressAt(ph,damped){
  const x=((ph-0.14)%1+1)%1;let s;
  if(x<0.12)s=Math.sin(x/0.12*Math.PI/2);else if(x<0.32)s=1-(x-0.12)/0.2*0.36;else if(x<0.36)s=0.62+0.07*Math.sin((x-0.32)/0.04*Math.PI);else s=0.62*Math.exp(-(x-0.36)*3.2)-0.08*(x-0.36)/0.64;
  return damped?62+30*Math.pow(Math.max(0,s),1.6):74+54*s;
}
function hemoStep(dt,ph0,ph1,damped,stE=0){
  if(!HB)return;const speed=105*dpr;const n=Math.max(0,Math.round(dt*speed));
  for(let j=1;j<=n;j++){let ph=ph0+(((ph1-ph0+1)%1))*j/n;ph%=1;HB.e[hx]=ecgAt(ph,stE);HB.p[hx]=pressAt(ph,damped);hx=(hx+1)%HB.e.length;for(let g=0;g<14*dpr;g++){HB.e[(hx+g)%HB.e.length]=NaN;HB.p[(hx+g)%HB.e.length]=NaN}}
}
function drawHemo(){
  if(!HB)return;const w=hemo.width,h=hemo.height;hctx.clearRect(0,0,w,h);
  hctx.strokeStyle='rgba(120,140,150,0.13)';hctx.lineWidth=1;
  const pTop=h*0.5,pBot=h-6*dpr,pm=v=>pBot-(v/160)*(pBot-pTop);
  for(const v of [40,80,120]){hctx.beginPath();hctx.moveTo(0,pm(v));hctx.lineTo(w,pm(v));hctx.stroke()}
  const trace=(arr,map,col)=>{hctx.strokeStyle=col;hctx.lineWidth=1.6*dpr;hctx.beginPath();let pen=false;for(let x=0;x<w;x++){const v=arr[x];if(isNaN(v)){pen=false;continue}const y=map(v);pen?hctx.lineTo(x,y):hctx.moveTo(x,y);pen=true}hctx.stroke()};
  trace(HB.e,v=>h*0.36-v*h*0.27,'#5fe08c');trace(HB.p,pm,'#ff6a63');
  hctx.font=`${11*dpr}px "IBM Plex Mono", monospace`;hctx.fillStyle='#5fe08c';hctx.fillText('II',6*dpr,14*dpr);
  hctx.fillStyle='#ff6a63';hctx.fillText('AO 0–160',6*dpr,h*0.5+10*dpr);
  const hr=S?Math.round(S.hr):72,sp=S?Math.round(S.sysP):128,dp=S?Math.round(S.diaP):74;
  hctx.textAlign='right';hctx.font=`600 ${15*dpr}px "IBM Plex Mono", monospace`;hctx.fillStyle='#5fe08c';hctx.fillText('HR '+hr,w-8*dpr,18*dpr);
  hctx.fillStyle='#ff6a63';hctx.fillText(`${sp}/${dp} (${Math.round(dp+(sp-dp)/3)})`,w-8*dpr,h*0.5+12*dpr);hctx.textAlign='left';
}

/* ---------- main loop ---------- */
let demoPhase=0.25,last=performance.now();
function demoFrame(){
  const cs=cathState({s:S_ROOT+22*1.02,th:OSTANG.L,type:'JL'});
  renderImage({t:10,phase:demoPhase,a:-30,b:-25,mode:'cine',frame:0,lesions:[],cath:true,cathState:cs,conc:()=>1,root:0.05});
}
function loop(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(S&&!S.done)tick(dt);else{const p0=demoPhase;demoPhase=(demoPhase+dt*72/60)%1;hemoStep(dt,p0,demoPhase,false)}
  if(toastT>0){toastT-=dt;if(toastT<=0)toastEl.hidden=true}
  drawHemo();updateUI();
  requestAnimationFrame(loop);
}
function tick(dt){
  const c=S.cath;
  // heart
  const ph0=S.phase;S.hr+=(S.hrT-S.hr)*Math.min(1,dt/1.2);S.phase=(S.phase+dt*S.hr/60)%1;
  // catheter handling
  let cs=cathState(c);
  if(S.exch>0){S.exch-=dt;if(S.exch<=0){c.type=c.type==='JL'?'JR':'JL';c.th=CATH[c.type].home;toast(`${CATH[c.type].label} in the descending aorta.`)}}
  else if(S.pci){if(down('ArrowUp','KeyW','ArrowDown','KeyS','ArrowLeft','KeyA','ArrowRight','KeyD')&&toastT<=0)toast('The guide is holding position for the stent. Finish or cancel it first.')}
  else if(!S.complication){
    let moved=false;const fine=c.s>S_ROOT-30;
    if(down('ArrowUp','KeyW')){c.s=Math.min(S_ROOT+22*1.6,c.s+(fine?26:110)*dt);moved=true}
    if(down('ArrowDown','KeyS')){c.s=Math.max(0,c.s-(fine?26:110)*dt);moved=true}
    if(down('ArrowRight','KeyD')){c.th+=170*dt;moved=true}
    if(down('ArrowLeft','KeyA')){c.th-=170*dt;moved=true}
    // near the ostium the tip tends to drop in on its own, as a preshaped Judkins does
    {const C=CATH[c.type],c0=cathState(c);if(!c0.eng&&c0.u>=0.55&&!down('ArrowLeft','KeyA','ArrowRight','KeyD')){const diff=((OSTANG[C.sys]-c.th+540)%360)-180;if(Math.abs(diff)<C.tol+70)c.th+=Math.sign(diff)*Math.min(Math.abs(diff),90*dt)}}
    if(c.th>180)c.th-=360;if(c.th<-180)c.th+=360;
    const imaging=down('Space','KeyF')||!!S.cine;
    if(moved&&!imaging&&c.s>120){S.blind+=dt;if(S.blind>0.6&&Math.floor((S.blind-dt)/2)!==Math.floor(S.blind/2))toast('Moving the catheter without fluoro. Step on the pedal.',true)}
    cs=cathState(c);
  }
  S.cs=cs;
  // contrast dynamics at 50 Hz
  const inj=down('KeyJ')&&!S.complication&&S.exch<=0;
  while(S.histN/50<=S.clock){
    const h=0.02;let tL=0,tR=0,tRoot=0;
    if(inj){
      S.contrast+=3.2*h;
      if(cs.eng){if(cs.eng==='L')tL=1;else tR=1;tRoot=cs.deep?0:0.12;if(cs.deep)S.deepInj+=h}
      else if(cs.u>0){tRoot=0.9;tL=0.32*Math.max(0,1-angDiff(c.th,OSTANG.L)/55)*Math.min(1,cs.u);tR=0.32*Math.max(0,1-angDiff(c.th,OSTANG.R)/55)*Math.min(1,cs.u)}
      else S.wasted+=3.2*h;
    }
    const step=(v,t,up,dn)=>v+(t-v)*(1-Math.exp(-h/(t>v?up:dn)));
    S.cL=step(S.cL,tL,0.12,0.55);S.cR=step(S.cR,tR,0.12,0.55);S.cRoot=step(S.cRoot,tRoot,0.08,0.25);
    S.hist.L.push(S.cL);S.hist.R.push(S.cR);S.hist.root.push(S.cRoot);S.histN++;
  }
  S.clock+=dt;
  if(inj&&cs.u<=0&&S.wasted>1&&toastT<=0)toast('Injecting outside the aortic root wastes contrast.');
  if(inj&&cs.u>0&&!cs.eng&&toastT<=0)toast('Non-selective injection: contrast is refluxing into the aortic root.');
  if(S.deepInj>0.45&&!S.complication){S.complication='Injection through a damped catheter caused an ostial dissection.';if(S.cine)stopCine();toast('Ostial dissection. Stop and report.',true);renderMarks()}
  // bradycardia with RCA injection
  if(S.cR>0.7)S.rcaInj+=dt;else S.rcaInj=Math.max(0,S.rcaInj-dt*1.5);
  S.hrT=S.rcaInj>1.6?46:72;
  // hemodynamics
  // PCI: wire crossing (only under X-ray) and balloon inflation
  const P=S.pci,xray=down('Space','KeyF')||!!S.cine;
  if(P&&P.stage==='wire'&&xray){P.wire+=dt*0.5;if(P.wire>=1){P.wire=1;P.stage='size';toast('Wire is across. Choose a stent.');renderPCI(true)}}
  if(P&&P.stage==='positioned'){
    if(down('KeyB')){P.atm=Math.min(18,P.atm+7*dt);P.maxAtm=Math.max(P.maxAtm,P.atm);if(P.atm>=16.5&&!P.warned){P.warned=true;toast('Above the 16 atm rated burst pressure.',true)}if(P.atm>4&&!P.pain){P.pain=true;toast('Balloon up. Patient reports chest pain; ST segments rising.')}}
    else if(P.atm>0){if(P.maxAtm>=8)deploy();else{P.atm=Math.max(0,P.atm-20*dt);if(P.atm===0)P.maxAtm=0}}
  }
  S.stE+=((P&&P.atm>4?1:0)-S.stE)*Math.min(1,dt*1.5);
  const damped=cs.deep;
  hemoStep(dt,ph0,S.phase,damped,S.stE);
  const p=pressAt(S.phase,damped);S.beatMax=Math.max(S.beatMax,p);S.beatMin=Math.min(S.beatMin,p);
  if(S.phase<ph0){S.sysP=S.beatMax;S.diaP=S.beatMin;S.beatMax=0;S.beatMin=999}
  // imaging
  const fl=down('Space','KeyF')&&!S.complication;const imaging=(fl||!!S.cine);
  if(imaging&&S.review)closeReview();
  const f=1/Math.pow(Math.cos(S.a*D2R)*Math.cos(S.b*D2R),1.5);
  if(S.cine){S.ak+=165/60*dt*f;S.ctime+=dt}else if(fl){S.ak+=17/60*dt*f;S.ftime+=dt}
  S.imgAcc+=dt;
  if(S.review){if(S.review.playing){S.review.acc+=dt;if(S.review.acc>=1/15){S.review.acc=0;S.review.idx=(S.review.idx+1)%S.review.run.frames.length;drawReview()}}}
  else if(imaging&&S.imgAcc>=1/15){
    S.imgAcc=0;S.frame++;
    renderImage({t:S.clock,phase:S.phase,a:S.a,b:S.b,mode:S.cine?'cine':'fluoro',frame:S.frame,lesions:S.lesions,pci:pciRender(),cath:true,cathState:cs,wire:S.exch>0,conc:(sys,t)=>histAt(S.hist[sys],t),root:histAt(S.hist.root,S.clock)});
    if(S.cine){S.cine.frames.push({t:S.clock,phase:S.phase,frame:S.frame,cath:{...c},pci:pciRender()});if(S.cine.frames.length>=90)stopCine()}
  }
}
function fmtT(s){s=Math.floor(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
let uiAcc=0;
function updateUI(){
  const fl=S&&!S.done&&down('Space','KeyF')&&!S.complication,cine=S&&!!S.cine;
  $('lamp').classList.toggle('on',!!(fl||cine));
  document.querySelector('[data-k="Space"]').classList.toggle('on',!!fl);
  $('bCine').classList.toggle('on',!!cine);
  $('bInj').classList.toggle('on',!!(S&&down('KeyJ')));
  document.querySelectorAll('[data-hold]').forEach(b=>b.classList.toggle('on',!!down('KeyB')));
  if(S&&S.pci){const a=$('pciAtm');if(a)a.textContent=S.pci.atm.toFixed(1)+' atm';const w=$('pciWire');if(w)w.textContent=Math.round(S.pci.wire*100)+'%'}
  ['ArrowLeft','ArrowUp','ArrowDown','ArrowRight'].forEach(k=>document.querySelector(`[data-k="${k}"]`).classList.toggle('on',!!down(k)));
  if(!S){hudTL.textContent='CATH LAB RUN\nRAO 30° CAU 25°';hudTR.innerHTML='<span>SAMPLE IMAGE</span>';hudBL.textContent='';hudBR.textContent='';return}
  const R=S.review;
  hudTL.textContent=`CASE ${S.ci+1} · ${S.c.pt}\n${R?angLabel(R.run.a,R.run.b):angLabel(S.a,S.b)}`;
  hudTR.innerHTML=R?`<span class="act">REVIEW · RUN ${R.run.id}</span>\nfr ${R.idx+1}/${R.run.frames.length}`:cine?`<span class="act">● CINE 15 f/s</span>\n${(S.cine.frames.length/15).toFixed(1)} s`:fl?'<span class="act">FLUORO 15 p/s</span>':(S.frame?'LIH':'NO IMAGE');
  hudBL.textContent=R?'Click a narrowing to mark it':(S.frame?'':'Hold Space for fluoro');
  hudBR.textContent=`AK ${Math.round(S.ak)} mGy\n${Math.round(S.contrast)} mL`;
  uiAcc++;if(uiAcc%6)return;
  $('rdFT').querySelector('b').textContent=fmtT(S.ftime);
  $('rdAK').querySelector('b').innerHTML=`${Math.round(S.ak)}<small>mGy</small>`;$('rdAK').classList.toggle('hot',S.ak>800);
  $('rdCM').querySelector('b').innerHTML=`${Math.round(S.contrast)}<small>mL</small>`;$('rdCM').classList.toggle('hot',S.contrast>S.c.budget);
  $('rdHD').querySelector('b').innerHTML=`${Math.round(S.hr)}<small>${Math.round(S.sysP)}/${Math.round(S.diaP)}</small>`;$('rdHD').classList.toggle('hot',S.hr<55||(S.cs&&S.cs.deep));
  if(S.pci){$('cathType').textContent=CATH[S.cath.type].label+' guide · 6F'}else $('cathType').textContent=(S.exch>0?'Exchanging…':CATH[S.cath.type].label+' · 6F');
  const other=S.cath.type==='JL'?'JR4':'JL4';const be=$('bExch');be.textContent='Exchange for '+other;be.disabled=S.exch>0||!!S.complication||!!S.pci;
  const st=$('status');const cs=S.cs||{};let cls='',msg='';
  if(S.complication){cls='danger';msg=S.complication+' Finish the study to see your report.'}
  else if(S.exch>0){msg='Exchanging catheter over a 0.035" wire…'}
  else if(S.pci){cls='ok';msg={wire:'Crossing the lesion with a 0.014" wire. Keep fluoro on.',size:'Wire across. Pick the stent diameter and length.',positioned:'Stent in place. Check its position on fluoro, then hold Inflate.',done:'Stent deployed. Record a final shot, then remove the wire.'}[S.pci.stage]}
  else if(cs.deep){cls='danger';msg='Pressure damped: catheter deep-seated. Withdraw slightly before you inject.'}
  else if(cs.eng){cls='ok';msg=`Engaged ${cs.eng==='L'?'left main':'right coronary'} ostium. Pressure normal. Start cine, then inject.`}
  else if(cs.u>0){cls='warn';const need=CATH[S.cath.type].sys;msg=`In the aortic root, ${CATH[S.cath.type].label} tip at ${Math.round(S.cath.th)}°. Torque to find the ${need==='L'?'left main':'right coronary'} ostium; a short test puff shows where you are.`}
  else{msg=`${cs.region||'Femoral sheath'} · ${Math.round(S.cath.s)} mm inserted.`+(S.cath.s<S_EXCH?' Catheter exchange is possible here.':'')}
  st.className='status '+cls;st.textContent=msg;
  document.querySelectorAll('#presets button').forEach(b=>b.disabled=!!S.cine);
  $('sA').disabled=$('sB').disabled=!!S.cine;
  renderPCI();
}

/* ---------- scoring ---------- */
$('bFinish').addEventListener('click',finish);
function finish(){
  if(!S||S.done)return;if(S.cine)stopCine();closeReview();S.done=true;S.pci=null;
  const notes=[],rows=[];let total=0;
  // lesions
  const sig=S.lesions.filter(L=>L.sev>=0.5),minor=S.lesions.filter(L=>L.sev<0.5);
  let lesPts=0;const used=new Set();
  const per=35/Math.max(1,sig.length);
  const match=L=>S.marks.findIndex((m,i)=>!used.has(i)&&m.vid===L.vid&&Math.abs(m.ld-L.at)<=L.len/2+7);
  for(const L of [...sig,...minor]){
    const bi=BUCKETS.findIndex(b=>L.sev>=b.lo&&L.sev<b.hi);
    const mi=match(L);
    const views=S.runs.filter(r=>r.sys===L.sys).map(r=>({r,ap:apparent(L,basis(r.a,r.b))})).sort((x,y)=>y.ap-x.ap);
    let viewNote='';
    if(views.length){const b=views[0],w=views[views.length-1];viewNote=` Best shown in ${angLabel(b.r.a,b.r.b)} (looked about ${Math.round(b.ap*100)}%)`+(views.length>1&&b.ap-w.ap>0.15?`; in ${angLabel(w.r.a,w.r.b)} it looked about ${Math.round(w.ap*100)}%.`:'.')}
    else viewNote=` You never recorded a selective run of the ${L.sys==='L'?'left':'right'} system.`;
    if(L.sev>=0.5){
      if(mi>=0){used.add(mi);const m=S.marks[mi];const ok=m.bucket===bi,near=Math.abs(m.bucket-bi)===1;const p=per*(ok?1:near?0.7:0.55);lesPts+=p;
        notes.push({c:ok?'good':'',t:`${Math.round(L.sev*100)}% ${L.label}: found, graded ${BUCKETS[m.bucket].k}${ok?'.':' (true range '+BUCKETS[bi].k+').'}${viewNote}`})}
      else notes.push({c:'bad',t:`Missed: ${Math.round(L.sev*100)}% ${L.label}.${viewNote}`});
    }else{
      if(mi>=0){used.add(mi);const m=S.marks[mi];if(m.bucket===0)notes.push({c:'good',t:`${Math.round(L.sev*100)}% ${L.label}: correctly called non-significant.`});else{lesPts-=8;notes.push({c:'bad',t:`Overcalled: ${L.label} is about ${Math.round(L.sev*100)}%, you graded it ${BUCKETS[m.bucket].k}.${viewNote}`})}}
    }
  }
  const fp=S.marks.filter((m,i)=>!used.has(i)).length;
  if(fp){lesPts-=6*fp;notes.push({c:'bad',t:`${fp} mark${fp>1?'s':''} on normal vessel.`})}
  lesPts=clamp(lesPts,0,35);rows.push(['Lesion detection and grading',lesPts,35]);
  // treatment
  const targets=S.lesions.filter(L=>L.sev>=0.7);let tx=0;const perT=15/Math.max(1,targets.length);
  for(const L of targets){
    const hits=[];for(const s of S.stents)for(const h of s.hits)if(h.L===L)hits.push({s,o:h.o});
    if(!hits.length){notes.push({c:'bad',t:`Not treated: the ${Math.round(L.sev*100)}% ${L.label} needed a stent.`});continue}
    const {s,o}=hits[hits.length-1],good=o.covered&&!o.under&&!o.over&&!o.lowP;tx+=perT*(good?1:0.5);
    const iss=[];if(!o.covered)iss.push('it did not cover the whole lesion');if(o.under)iss.push(`undersized for a ~${o.refD.toFixed(1)} mm vessel`);if(o.over)iss.push(`oversized for a ~${o.refD.toFixed(1)} mm vessel, with edge dissection risk`);if(o.lowP)iss.push(`deployed at only ${s.atm} atm (aim for 12–14)`);
    notes.push({c:good?'good':'',t:`Stented ${L.label}: ${s.diam.toFixed(1)} × ${s.len} mm at ${s.atm} atm, residual ${Math.round(L.cur*100)}%.`+(iss.length?' But '+iss.join('; ')+'.':` Well sized for a ~${o.refD.toFixed(1)} mm vessel.`)});
  }
  for(const s of S.stents){
    if(!s.hits.some(h=>h.L.sev>=0.5)){tx-=8;notes.push({c:'bad',t:`Unnecessary stent in the ${s.label}: ${s.hits.length?'that lesion was not flow-limiting.':'there was no lesion there.'}`})}
    else if(s.hits.some(h=>h.o.over))tx-=4;
  }
  for(const sy of new Set(S.stents.map(s=>VBY[s.vid].sys))){const t=Math.max(...S.stents.filter(s=>VBY[s.vid].sys===sy).map(s=>s.t));if(!S.runs.some(r=>r.sys===sy&&r.t0>t))notes.push({c:'',t:`Record a final cine run of the ${sy==='L'?'left':'right'} system after stenting to confirm the result.`})}
  tx=clamp(tx,0,15);rows.push(['Treatment (stenting)',tx,15]);
  // completeness
  const distinct=sys=>{const v=[];for(const r of S.runs){if(r.sys!==sys)continue;if(!v.some(o=>Math.abs(o.a-r.a)<15&&Math.abs(o.b-r.b)<15))v.push(r)}return v.length};
  const nL=distinct('L'),nR=distinct('R');
  const comp=(nL>=3?9:nL===2?6:nL===1?3:0)+(nR>=2?6:nR===1?3:0);rows.push([`Complete study (LCA ${nL} views, RCA ${nR})`,comp,15]);
  if(nL<3)notes.push({c:'',t:'A standard left system study uses at least three or four projections: RAO caudal, RAO cranial, LAO cranial and LAO caudal.'});
  if(nR<2)notes.push({c:'',t:'Image the RCA in at least two orthogonal views, for example LAO 40° and RAO 30°.'});
  const B=S.c.budget;const cm=Math.round(15*clamp(1-(S.contrast-B)/(B*2),0,1));rows.push([`Contrast ${Math.round(S.contrast)} mL (budget ${B})`,cm,15]);
  const rad=Math.round(10*clamp(1-(S.ak-400)/1000,0,1));rows.push([`Air kerma ${Math.round(S.ak)} mGy · fluoro ${fmtT(S.ftime)}`,rad,10]);
  if(S.ak>400)notes.push({c:'',t:'Steep angles and long cine runs drive dose up. Keep runs to 3–4 seconds and collimate your pedal time.'});
  let saf=10-Math.min(10,Math.round(S.blind*2));rows.push(['Safety (catheter moved under fluoro)',saf,10]);
  total=lesPts+tx+comp+cm+rad+saf;
  if(S.complication){total=Math.min(total,35);notes.unshift({c:'bad',t:S.complication+' A damped or ventricularised pressure trace means the tip is against the vessel wall. Withdraw before injecting.'})}
  total=Math.round(total);
  const grade=S.complication?'Complication':total>=85?'Attending standard':total>=70?'Senior fellow':total>=50?'Junior fellow':'Keep practising';
  const ov=$('resultOv');
  ov.innerHTML=`<h1>Study report · case ${S.ci+1}</h1><div class="score"><b>${total}</b><span>${grade}</span></div>
  <div class="rows">${rows.map(r=>`<span>${r[0]}</span><span class="v">${Math.round(r[1])} / ${r[2]}</span>`).join('')}</div>
  <div class="notes">${notes.map(n=>`<div class="${n.c}">${n.t}</div>`).join('')}</div>
  <div class="row"><button class="btn primary" id="rAgain">Repeat case</button><button class="btn" id="rCases">Choose another case</button></div>`;
  ov.hidden=false;
  $('rAgain').onclick=()=>startCase(S.ci);
  $('rCases').onclick=()=>{ov.hidden=true;$('startOv').hidden=false;S=null;demoFrame();syncArm();renderRuns();renderMarks();renderPending();renderPCI(true);$('caseHead').innerHTML='<h2>Patient</h2><b>No case loaded</b><p>Pick a case on the monitor to begin.</p>';$('status').textContent='Catheter in the femoral sheath.';$('status').className='status'};
  renderMarks();
}

/* ---------- PCI ---------- */
function pciRender(){
  if(!S)return null;const P=S.pci;
  return {stents:S.stents.map(s=>({vid:s.vid,ld:s.ld,len:s.len,diam:s.diam})),
    wire:P&&P.wire>0?{vid:P.vid,frac:Math.min(1,P.wire)}:null,
    balloon:P&&P.stage==='positioned'?{vid:P.vid,ld:P.ld,len:P.len,diam:P.diam,inflate:P.atm/14}:null};
}
function canTreat(m){const sys=VBY[m.vid].sys;return S&&S.cs&&S.cs.eng===sys&&!S.cs.deep&&!S.complication&&!S.done}
function startPCI(mi){
  const m=S.marks[mi];if(!canTreat(m)){toast(`Engage the ${VBY[m.vid].sys==='L'?'left':'right'} coronary first.`);return}
  S.pci={vid:m.vid,ld:m.ld,label:m.label,stage:'wire',wire:0,diam:3.0,len:18,atm:0,maxAtm:0};
  toast('Hold fluoro while the wire crosses the lesion.');renderPCI(true);
}
function deploy(){
  const P=S.pci,s={vid:P.vid,ld:P.ld,len:P.len,diam:P.diam,atm:Math.round(P.maxAtm),label:segLabel(VBY[P.vid],P.ld),hits:[],t:S.clock};
  for(const L of S.lesions){const o=stentOutcome(L,s);if(o){L.cur=o.residual;s.hits.push({L,o})}}
  S.stents.push(s);P.stage='done';P.atm=0;
  toast(`Stent deployed: ${P.diam.toFixed(1)} × ${P.len} mm at ${s.atm} atm.`);renderPCI(true);
}
let pciSig='';
function renderPCI(force){
  const el=$('pci');
  const sig=!S?'none':JSON.stringify([S.done,S.pci&&[S.pci.stage,S.pci.diam,S.pci.len,Math.round(S.pci.ld)],S.marks.map(m=>m.vid+m.ld+canTreat(m)),S.stents.length]);
  if(!force&&sig===pciSig)return;pciSig=sig;
  if(!S){el.innerHTML='<div class="empty">Load a case to begin.</div>';return}
  const P=S.pci;let h='';
  const done=S.stents.map(s=>`<div class="mark"><span>Stent ${s.diam.toFixed(1)} × ${s.len} mm · ${s.label}</span><span>${s.atm} atm</span></div>`).join('');
  if(!P){
    if(!S.marks.length)h='<div class="empty">Mark a lesion on a cine run, then stent it here with the guide engaged.</div>';
    else{h=S.marks.map((m,i)=>`<div class="mark"><span>${i+1}. ${m.label} · ${BUCKETS[m.bucket].k}</span><button class="btn" data-treat="${i}" ${canTreat(m)?'':'disabled'}>Stent</button></div>`).join('');
      if(!S.marks.some(canTreat))h+='<div class="empty">Engage the matching coronary to stent a marked lesion.</div>'}
  }else if(P.stage==='wire'){
    h=`<div class="pending"><div>Crossing the ${P.label} with a 0.014" wire. Hold fluoro. <b id="pciWire" class="pci-read">0%</b></div><div class="row"><button class="btn" data-cancel="1">Cancel</button></div></div>`;
  }else if(P.stage==='size'){
    h=`<div class="pending"><div>Choose the stent for the ${P.label}. For scale, the 6F guide is 2 mm wide.</div>
      <div class="grouplabel">Diameter (mm)</div><div class="sev">${STENT_DIAMS.map(d=>`<button data-d="${d}" class="${d===P.diam?'sel':''}">${d.toFixed(1)}</button>`).join('')}</div>
      <div class="grouplabel">Length (mm)</div><div class="sev">${STENT_LENS.map(l=>`<button data-l="${l}" class="${l===P.len?'sel':''}">${l}</button>`).join('')}</div>
      <div class="row"><button class="btn primary" data-pos="1">Position stent</button><button class="btn" data-cancel="1">Cancel</button></div></div>`;
  }else if(P.stage==='positioned'){
    h=`<div class="pending"><div>${P.diam.toFixed(1)} × ${P.len} mm stent across the ${P.label}. Line the markers up around the narrowing, then hold Inflate. Deploy at 12–14 atm.</div>
      <div class="row"><button class="btn" data-nudge="-2">◀ Proximal</button><button class="btn" data-nudge="2">Distal ▶</button></div>
      <div class="row"><button class="hold" data-hold="1"><span>Inflate</span><kbd>B</kbd></button><b id="pciAtm" class="pci-read">0.0 atm</b><button class="btn" data-cancel="1">Cancel</button></div></div>`;
  }else{
    h=`<div class="pending"><div>Stent deployed in the ${P.label}. Record a final cine run to check the result, then remove the wire.</div><div class="row"><button class="btn primary" data-finish="1">Remove wire</button></div></div>`;
  }
  el.innerHTML=h+done;
}
$('pci').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!S||S.done)return;const P=S.pci,d=b.dataset;
  if(d.treat!=null)startPCI(+d.treat);
  else if(d.cancel){S.pci=null;toast('Stent cancelled. Wire withdrawn.')}
  else if(d.d)P.diam=+d.d;else if(d.l)P.len=+d.l;
  else if(d.pos){P.stage='positioned';toast('Stent delivered over the wire. Markers show its ends.')}
  else if(d.nudge){const v=VBY[P.vid];P.ld=clamp(P.ld+ +d.nudge,P.len/2,v.len-2)}
  else if(d.finish){S.pci=null;toast('Wire removed.')}
  renderPCI(true);
});
$('pci').addEventListener('pointerdown',e=>{if(e.target.closest('[data-hold]')){e.preventDefault();keys.btn_KeyB=true}});
const holdUp=()=>{keys.btn_KeyB=false};window.addEventListener('pointerup',holdUp);window.addEventListener('pointercancel',holdUp);

sizeHemo();demoFrame();syncArm();
requestAnimationFrame(loop);
