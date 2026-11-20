/* Cath Lab Run: menu and operator profile, game state, input, UI, PCI tools, hemodynamic strip, main loop and scoring. */
"use strict";
const img=document.getElementById('img');ictx=img.getContext('2d');
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- operator profile (saved on this device only) ---------- */
const STORE='cathlabrun.profile.v1';
function loadProfile(){try{const p=JSON.parse(localStorage.getItem(STORE)||'null');if(p&&typeof p.name==='string'&&p.name)return {tokens:0,best:{},diff:'easy',avatar:0,...p}}catch(e){}return null}
function saveProfile(){try{localStorage.setItem(STORE,JSON.stringify(profile))}catch(e){}}
let profile=loadProfile();

function avatarSVG(i,size){
  const a=AVATARS[i]||AVATARS[0];
  const hair={short:`<path d="M21 27Q20 14 32 14Q44 14 43 27Q40 19 32 19Q24 19 21 27Z" fill="${a.hair}"/>`,
    long:`<path d="M20 30Q18 13 32 13Q46 13 44 30L45 42Q41 40 41 32Q40 20 32 20Q24 20 23 32Q23 40 19 42Z" fill="${a.hair}"/>`,
    bun:`<circle cx="32" cy="11" r="5" fill="${a.hair}"/><path d="M21 27Q20 14 32 14Q44 14 43 27Q40 19 32 19Q24 19 21 27Z" fill="${a.hair}"/>`,
    crop:`<path d="M21.5 25Q22 15 32 15Q42 15 42.5 25Q38 20 32 20Q26 20 21.5 25Z" fill="${a.hair}"/>`,
    bald:`<path d="M21 30Q20 24 23 22L23 30ZM43 30Q44 24 41 22L41 30Z" fill="${a.hair}"/>`}[a.style];
  const cap=a.cap?`<path d="M20 24Q20 12 32 12Q44 12 44 24Q32 19 20 24Z" fill="${a.cap}"/><path d="M43 22L48 25" stroke="${a.cap}" stroke-width="2" stroke-linecap="round"/>`:'';
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="#222c31"/><path d="M10 64Q12 46 32 44Q52 46 54 64Z" fill="${a.scrub}"/><path d="M26 45L32 53L38 45" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="2"/><rect x="28" y="35" width="8" height="10" fill="${a.skin}"/><ellipse cx="32" cy="28" rx="11" ry="12" fill="${a.skin}"/>${hair}${cap}<circle cx="28" cy="29" r="1.3" fill="#2a1a12"/><circle cx="36" cy="29" r="1.3" fill="#2a1a12"/><path d="M29 34Q32 36.5 35 34" fill="none" stroke="#5a3424" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}
const CUP='<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5h9v5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" fill="currentColor"/><path d="M11 6h1.5a2 2 0 0 1 0 4H11" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 1.5q1 1 0 2M8 1.5q1 1 0 2" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>';
function renderWho(){const w=$('who');if(!profile){w.hidden=true;return}w.hidden=false;w.innerHTML=`${avatarSVG(profile.avatar,26)}<span>${esc(profile.name)}</span><b>${CUP}${profile.tokens}</b>`}

/* ---------- menu ---------- */
let menuView='home',draft=null;
function showMenu(view){
  menuView=view||(profile?'home':'profile');S=null;
  $('resultOv').hidden=true;$('startOv').hidden=false;$('reviewbar').hidden=true;$('ivusOv').hidden=true;$('mapCan').hidden=true;$('monitor').classList.remove('withmap');
  demoFrame();syncArm();renderRuns();renderMarks();renderPending();renderPCI(true);renderWho();
  $('caseHead').innerHTML='<h2>Patient</h2><b>No case loaded</b><p>Pick a case on the monitor to begin.</p>';$('status').textContent='Catheter in the femoral sheath.';$('status').className='status';
  renderMenu();
}
function renderMenu(){
  const ov=$('startOv');
  if(menuView==='profile'){
    if(!draft)draft={name:profile?profile.name:'',avatar:profile?profile.avatar:0};
    ov.innerHTML=`<h1>${profile?'Edit operator':'Create your operator'}</h1>
      <p>Your name and avatar appear on the console and your reports. They're saved in this browser only.</p>
      <label class="field" for="opName"><span>Name</span><input id="opName" maxlength="24" autocomplete="off" placeholder="Dr …" value="${esc(draft.name)}"></label>
      <div class="grouplabel">Avatar</div>
      <div class="avatars">${AVATARS.map((_,i)=>`<button class="av${i===draft.avatar?' sel':''}" data-av="${i}" aria-label="Avatar ${i+1}">${avatarSVG(i,56)}</button>`).join('')}</div>
      <div class="row"><button class="btn primary" data-act="saveop" ${draft.name.trim()?'':'disabled'}>Save operator</button>${profile?'<button class="btn" data-act="home">Cancel</button>':''}</div>`;
    const inp=$('opName');inp.addEventListener('input',()=>{draft.name=inp.value;ov.querySelector('[data-act="saveop"]').disabled=!inp.value.trim()});
    return;
  }
  if(menuView==='play'){
    const d=profile.diff;
    ov.innerHTML=`<h1>Choose a case</h1>
      <div class="grouplabel">Difficulty</div>
      <div class="diffs">${Object.entries(DIFFICULTY).map(([k,v])=>`<button class="diff${k===d?' sel':''}" data-diff="${k}"><b>${v.label}</b><span>${v.blurb}</span></button>`).join('')}</div>
      <div class="cases">${CASES.map((c,i)=>{const b=profile.best[d+'-'+i];return `<button class="case" data-ci="${i}"><span>CASE ${i+1} · ${c.pt}${b!=null?` · BEST ${b}`:''}</span><b>${c.title}</b><em>${c.task}</em></button>`}).join('')}</div>
      <div class="row"><button class="btn" data-act="home">Back</button></div>`;
    return;
  }
  ov.innerHTML=`<h1>Cath Lab Run</h1>
    <p>You have a 6F sheath in the right femoral artery. Drive the catheter to the aortic root, engage each coronary ostium, record cine runs in useful projections, then mark, measure and treat the stenosis. Keep contrast and radiation low.</p>
    <div class="opcard">${avatarSVG(profile.avatar,64)}<div><b>${esc(profile.name)}</b><span>${CUP} ${profile.tokens} coffee tokens banked · ${DIFFICULTY[profile.diff].label}</span></div><button class="btn" data-act="editop">Change operator</button></div>
    <div class="row"><button class="btn primary big" data-act="play">Start a case</button></div>
    <div class="keys">
      <div><kbd>Space</kbd> hold for fluoro (live X-ray)</div><div><kbd>C</kbd> start / stop a cine run</div>
      <div><kbd>J</kbd> hold to inject contrast</div><div><kbd>↑</kbd><kbd>↓</kbd> advance / withdraw</div>
      <div><kbd>←</kbd><kbd>→</kbd> torque counter-clockwise / clockwise</div><div><kbd>B</kbd> hold to inflate a balloon or stent</div>
      <div><kbd>1</kbd>–<kbd>7</kbd> C-arm presets</div>
    </div>
    <p class="fine">Coffee tokens are earned from each case score and banked for later. Teaching game with simplified anatomy and physics. Not a clinical training device.</p>`;
}
$('startOv').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.av!=null){draft.name=($('opName')||{}).value||draft.name;draft.avatar=+d.av;renderMenu();return}
  if(d.diff){profile.diff=d.diff;saveProfile();renderMenu();renderWho();return}
  if(d.ci!=null){startCase(+d.ci);return}
  if(d.act==='saveop'){const n=($('opName').value||'').trim().slice(0,24);if(!n)return;profile=profile?{...profile,name:n,avatar:draft.avatar}:{name:n,avatar:draft.avatar,tokens:0,best:{},diff:'easy'};draft=null;saveProfile();renderWho();menuView='home';renderMenu()}
  else if(d.act==='editop'){draft=null;menuView='profile';renderMenu()}
  else if(d.act==='play'){menuView='play';renderMenu()}
  else if(d.act==='home'){draft=null;menuView='home';renderMenu()}
});
$('who').addEventListener('click',()=>{if(!S||S.done)showMenu('home')});

/* ---------- state ---------- */
let S=null;
const keys={};
function newState(ci){
  const D=DIFFICULTY[profile.diff]||DIFFICULTY.easy,c=CASES[ci];
  return {ci,c,D,diff:profile.diff,budget:Math.round(c.budget*D.budgetX),lesions:prepLesions(c.lesions),clock:0,phase:0,hr:72,hrT:72,a:0,b:0,cath:{s:0,th:CATH.JL.home,type:'JL'},exch:0,
    cL:0,cR:0,cRoot:0,hist:{L:[],R:[],root:[]},histN:0,contrast:0,ak:0,ftime:0,ctime:0,blind:0,wasted:0,
    cine:null,runs:[],marks:[],pending:null,review:null,imgAcc:0,frame:0,deepInj:0,rcaInj:0,complication:null,done:false,
    sysP:128,diaP:74,beatMax:0,beatMin:999,pci:null,stents:[],balloons:[],ivusUsed:new Set(),ivusNote:null,mapped:new Set(),
    st:{II:0,V3:0,V5:0},twi:new Set((c.ecg&&c.ecg.twi)||[])};
}
const histAt=(arr,t)=>{if(t<0||!arr.length)return 0;const i=Math.floor(t*50);return i<arr.length?arr[i]:arr[arr.length-1]};
const cst=c=>cathState(c,S&&S.D);

/* ---------- UI refs ---------- */
const hudTL=$('hudTL'),hudTR=$('hudTR'),hudBL=$('hudBL'),hudBR=$('hudBR'),toastEl=$('toast');
let toastT=0;
function toast(msg,danger){toastEl.textContent=msg;toastEl.className='toast'+(danger?' danger':'');toastEl.hidden=false;toastT=2.8}
$('presets').innerHTML=PRESETS.map((p,i)=>`<button data-i="${i}" title="Key ${i+1}">${p[0]}</button>`).join('');
$('presets').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setPreset(+b.dataset.i)});
function setPreset(i){if(!S||S.cine)return;S.a=PRESETS[i][1];S.b=PRESETS[i][2];syncArm()}
function syncArm(){$('sA').value=S?S.a:0;$('sB').value=S?S.b:0;const a=S?S.a:0,b=S?S.b:0;$('oA').textContent=a===0?'AP':(a>0?'LAO ':'RAO ')+Math.abs(a)+'°';$('oB').textContent=b===0?'0°':(b>0?'CRA ':'CAU ')+Math.abs(b)+'°'}
$('sA').addEventListener('input',e=>{if(!S||S.cine){syncArm();return}S.a=+e.target.value;syncArm()});
$('sB').addEventListener('input',e=>{if(!S||S.cine){syncArm();return}S.b=+e.target.value;syncArm()});

function startCase(ci){
  S=newState(ci);
  $('startOv').hidden=true;$('resultOv').hidden=true;$('ivusOv').hidden=true;closeReview();
  const c=S.c;$('caseHead').innerHTML=`<h2>Patient · case ${ci+1} · ${S.D.label}</h2><b>${c.title}</b><p>${c.pt}. ${c.hx}</p><p class="task">${c.task}</p>`;
  ictx.fillStyle='#000';ictx.fillRect(0,0,W,W);
  $('mapCan').hidden=!S.D.map;$('monitor').classList.toggle('withmap',S.D.map);if(S.D.map)drawMap($('mapCan').getContext('2d'),S.mapped);
  syncArm();renderRuns();renderMarks();renderPending();renderPCI(true);renderWho();
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
  if(S.pci){toast('Finish or cancel the PCI first.');return}
  if(S.cath.s>S_EXCH){toast('Pull the catheter back to the descending aorta before exchanging.');return}
  S.exch=2.2;toast('Exchanging catheter over a 0.035" wire…');
});

function toggleCine(){
  if(!S||S.done||S.complication)return;
  if(S.review)closeReview();
  if(S.pci&&S.pci.stage==='ivus')return;
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
  if(S.cine)stopCine();if(S.pci&&S.pci.stage==='ivus')return;
  S.review={run,idx:0,playing:true,acc:0};
  $('reviewbar').hidden=false;$('rvSlider').max=run.frames.length-1;$('rvPlay').textContent='Pause';renderRuns();
}
function closeReview(){if(S)S.review=null;$('reviewbar').hidden=true;renderRuns()}
$('rvClose').addEventListener('click',closeReview);
$('rvPlay').addEventListener('click',()=>{if(!S||!S.review)return;S.review.playing=!S.review.playing;$('rvPlay').textContent=S.review.playing?'Pause':'Play'});
$('rvSlider').addEventListener('input',e=>{if(!S||!S.review)return;S.review.idx=+e.target.value;S.review.playing=false;$('rvPlay').textContent='Play';drawReview()});
$('runs').addEventListener('click',e=>{const b=e.target.closest('.run');if(b)openReview(+b.dataset.id)});
function frameState(run,f){
  return {t:f.t,phase:f.phase,a:run.a,b:run.b,mode:'cine',frame:f.frame,lesions:run.lesState||S.lesions,pci:f.pci,cath:true,cathState:cst(f.cath),
    conc:(sys,t)=>histAt(S.hist[sys],t),root:histAt(S.hist.root,f.t),marks:S.marks};
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

/* ---------- hemodynamics: three ECG leads + aortic pressure ---------- */
const hemo=$('hemo'),hctx=hemo.getContext('2d');let HB=null,hx=0,dpr=1;
const HEMO_H=168;
function sizeHemo(){dpr=Math.min(2,window.devicePixelRatio||1);const w=Math.max(200,Math.round(hemo.clientWidth*dpr)),h=Math.round(HEMO_H*dpr);hemo.width=w;hemo.height=h;HB={p:new Float32Array(w).fill(NaN)};for(const l of LEADS)HB[l]=new Float32Array(w).fill(NaN);hx=0}
window.addEventListener('resize',sizeHemo);
const gs=(x,m,s)=>Math.exp(-((x-m)*(x-m))/(2*s*s));
/* One beat of an ECG lead: st = ST shift (+ elevation, − depression), twi = inverted T wave, amp = QRS size. */
function ecgAt(ph,st=0,twi=false,amp=1){
  const t=twi?-0.22:0.28;
  return 0.1*gs(ph,0.03,0.016)-0.1*gs(ph,0.085,0.006)+amp*gs(ph,0.1,0.007)-0.26*gs(ph,0.115,0.008)
    +st*0.34*(gs(ph,0.2,0.05)+0.6*gs(ph,0.27,0.05))+(t+0.25*Math.max(0,st))*gs(ph,0.33,0.04);
}
const LEAD_AMP={II:1,V3:0.85,V5:1.1};
function pressAt(ph,damped){
  const x=((ph-0.14)%1+1)%1;let s;
  if(x<0.12)s=Math.sin(x/0.12*Math.PI/2);else if(x<0.32)s=1-(x-0.12)/0.2*0.36;else if(x<0.36)s=0.62+0.07*Math.sin((x-0.32)/0.04*Math.PI);else s=0.62*Math.exp(-(x-0.36)*3.2)-0.08*(x-0.36)/0.64;
  return damped?62+30*Math.pow(Math.max(0,s),1.6):74+54*s;
}
function hemoStep(dt,ph0,ph1,damped){
  if(!HB)return;const speed=105*dpr;const n=Math.max(0,Math.round(dt*speed));const len=HB.p.length;
  for(let j=1;j<=n;j++){let ph=ph0+(((ph1-ph0+1)%1))*j/n;ph%=1;
    for(const l of LEADS)HB[l][hx]=ecgAt(ph,S?S.st[l]:0,S?S.twi.has(l):false,LEAD_AMP[l]);
    HB.p[hx]=pressAt(ph,damped);hx=(hx+1)%len;
    for(let g=0;g<14*dpr;g++){const k=(hx+g)%len;HB.p[k]=NaN;for(const l of LEADS)HB[l][k]=NaN}}
}
function drawHemo(){
  if(!HB)return;const w=hemo.width,h=hemo.height;hctx.clearRect(0,0,w,h);
  const rowH=h*0.19,pTop=h*0.62,pBot=h-6*dpr,pm=v=>pBot-(v/160)*(pBot-pTop);
  hctx.strokeStyle='rgba(120,140,150,0.13)';hctx.lineWidth=1;
  for(const v of [40,80,120]){hctx.beginPath();hctx.moveTo(0,pm(v));hctx.lineTo(w,pm(v));hctx.stroke()}
  const trace=(arr,map,col)=>{hctx.strokeStyle=col;hctx.lineWidth=1.5*dpr;hctx.beginPath();let pen=false;for(let x=0;x<w;x++){const v=arr[x];if(isNaN(v)){pen=false;continue}const y=map(v);pen?hctx.lineTo(x,y):hctx.moveTo(x,y);pen=true}hctx.stroke()};
  hctx.font=`${10.5*dpr}px "IBM Plex Mono", monospace`;
  LEADS.forEach((l,i)=>{const base=rowH*(i+0.72);trace(HB[l],v=>base-v*rowH*0.62,'#5fe08c');hctx.fillStyle='#5fe08c';hctx.fillText(l,6*dpr,rowH*i+12*dpr);
    const stv=S?S.st[l]:0;if(Math.abs(stv)>0.25){hctx.fillStyle=stv>0?'#ffb15e':'#9fd0ff';hctx.fillText(`ST ${stv>0?'↑':'↓'} ${(Math.abs(stv)*2).toFixed(1)} mm`,26*dpr,rowH*i+12*dpr)}});
  trace(HB.p,pm,'#ff6a63');
  hctx.fillStyle='#ff6a63';hctx.fillText('AO 0–160',6*dpr,pTop+8*dpr);
  const hr=S?Math.round(S.hr):72,sp=S?Math.round(S.sysP):128,dp=S?Math.round(S.diaP):74;
  hctx.textAlign='right';hctx.font=`600 ${15*dpr}px "IBM Plex Mono", monospace`;hctx.fillStyle='#5fe08c';hctx.fillText('HR '+hr,w-8*dpr,16*dpr);
  hctx.fillStyle='#ff6a63';hctx.fillText(`${sp}/${dp} (${Math.round(dp+(sp-dp)/3)})`,w-8*dpr,pTop+10*dpr);hctx.textAlign='left';
}

/* ---------- PCI: wire, IVUS, balloon, stent ---------- */
const ivusLd=P=>clamp(P.ld+18-P.ivus*36,0,VBY[P.vid].len);
function pciRender(){
  if(!S)return null;const P=S.pci;
  return {stents:S.stents.map(s=>({vid:s.vid,ld:s.ld,len:s.len,diam:s.diam})),
    wire:P&&P.wire>0?{vid:P.vid,frac:Math.min(1,P.wire)}:null,
    balloon:P&&P.stage==='positioned'?{vid:P.vid,ld:P.ld,len:P.len,diam:P.diam,inflate:P.atm/14}:null,
    ivus:P&&P.stage==='ivus'?{vid:P.vid,ld:ivusLd(P)}:null};
}
function canTreat(m){const sys=VBY[m.vid].sys;return !!(S&&S.cs&&S.cs.eng===sys&&!S.cs.deep&&!S.complication&&!S.done)}
function startPCI(mi){
  const m=S.marks[mi];if(!canTreat(m)){toast(`Engage the ${VBY[m.vid].sys==='L'?'left':'right'} coronary first.`);return}
  S.pci={vid:m.vid,ld:m.ld,mark:m.ld,label:m.label,stage:'wire',wire:0,kind:null,diam:3.0,len:18,atm:0,maxAtm:0,ivus:0,ivusAuto:false};
  toast('Hold fluoro while the wire crosses the lesion.');renderPCI(true);
}
function applyDevice(){
  const P=S.pci,dev={vid:P.vid,ld:P.ld,len:P.len,diam:P.diam,atm:Math.round(P.maxAtm),label:segLabel(VBY[P.vid],P.ld),hits:[],t:S.clock,ivus:S.ivusUsed.has(P.vid)};
  if(P.kind==='stent'){
    for(const L of S.lesions){const o=stentOutcome(L,dev);if(o){L.cur=o.residual;L.stented=true;dev.hits.push({L,o})}}
    S.stents.push(dev);toast(`Stent deployed: ${P.diam.toFixed(1)} × ${P.len} mm at ${dev.atm} atm.`);
  }else{
    for(const L of S.lesions){const o=balloonOutcome(L,dev);if(o){L.cur=o.residual;if(!o.under&&!o.lowP)L.predil=true;dev.hits.push({L,o})}}
    S.balloons.push(dev);const over=dev.hits.some(h=>h.o.over);
    toast(over?'Balloon oversized: dissection flap at the lesion edge.':`Balloon ${P.diam.toFixed(1)} × ${P.len} mm inflated to ${dev.atm} atm.`,over);
  }
  P.stage='tools';P.kind=null;P.atm=0;P.maxAtm=0;P.warned=P.pain=false;P.ld=P.mark;renderPCI(true);
}
let pciSig='';
function sizeChips(list,cur,attr,fmt){return `<div class="sev">${list.map(v=>`<button data-${attr}="${v}" class="${v===cur?'sel':''}">${fmt(v)}</button>`).join('')}</div>`}
function renderPCI(force){
  const el=$('pci');
  const sig=!S?'none':JSON.stringify([S.done,S.pci&&[S.pci.stage,S.pci.kind,S.pci.diam,S.pci.len,Math.round(S.pci.ld)],S.marks.map(m=>m.vid+m.ld+canTreat(m)),S.stents.length,S.balloons.length]);
  if(!force&&sig===pciSig)return;pciSig=sig;
  if(!S){el.innerHTML='<div class="empty">Load a case to begin.</div>';return}
  const P=S.pci;let h='';
  const log=[...S.balloons.map(b=>`Balloon ${b.diam.toFixed(1)} × ${b.len} mm · ${b.label} · ${b.atm} atm`),...S.stents.map(s=>`Stent ${s.diam.toFixed(1)} × ${s.len} mm · ${s.label} · ${s.atm} atm`)].map(t=>`<div class="mark"><span>${t}</span></div>`).join('');
  if(!P){
    if(!S.marks.length)h='<div class="empty">Mark a lesion on a cine run, then treat it here with the guide engaged.</div>';
    else{h=S.marks.map((m,i)=>`<div class="mark"><span>${i+1}. ${m.label} · ${BUCKETS[m.bucket].k}</span><button class="btn" data-treat="${i}" ${canTreat(m)?'':'disabled'}>Wire it</button></div>`).join('');
      if(!S.marks.some(canTreat))h+='<div class="empty">Engage the matching coronary to treat a marked lesion.</div>'}
  }else if(P.stage==='wire'){
    h=`<div class="pending"><div>Crossing the ${P.label} with a 0.014" wire. Hold fluoro. <b id="pciWire" class="pci-read">0%</b></div><div class="row"><button class="btn" data-cancel="1">Cancel</button></div></div>`;
  }else if(P.stage==='tools'){
    h=`<div class="pending"><div>Wire across the ${P.label}. Choose a device:</div>
      <div class="tools"><button class="btn" data-tool="ivus"><b>IVUS</b><span>Measure the vessel and lesion</span></button><button class="btn" data-tool="balloon"><b>Balloon</b><span>Angioplasty, pre- or post-dilation</span></button><button class="btn" data-tool="stent"><b>Stent</b><span>Drug-eluting stent</span></button></div>
      <div class="row"><button class="btn" data-finish="1">Remove wire</button></div></div>`;
  }else if(P.stage==='size'){
    const isS=P.kind==='stent';
    h=`<div class="pending"><div>Choose the ${isS?'stent':'balloon'} for the ${P.label}. For scale, the 6F guide is 2 mm wide.</div>
      ${S.ivusNote&&S.ivusNote.vid===P.vid?`<div class="ivusnote">IVUS: ${S.ivusNote.text}</div>`:''}
      <div class="grouplabel">Diameter (mm)</div>${sizeChips(isS?STENT_DIAMS:BALLOON_DIAMS,P.diam,'d',v=>v.toFixed(1))}
      <div class="grouplabel">Length (mm)</div>${sizeChips(isS?STENT_LENS:BALLOON_LENS,P.len,'l',v=>v)}
      <div class="row"><button class="btn primary" data-pos="1">Position ${isS?'stent':'balloon'}</button><button class="btn" data-back="1">Back</button></div></div>`;
  }else if(P.stage==='positioned'){
    h=`<div class="pending"><div>${P.diam.toFixed(1)} × ${P.len} mm ${P.kind} across the ${P.label}. Line the markers up around the narrowing, then hold Inflate. ${P.kind==='stent'?'Deploy at 12–14 atm.':'Inflate to 8–12 atm.'}</div>
      <div class="row"><button class="btn" data-nudge="-2">◀ Proximal</button><button class="btn" data-nudge="2">Distal ▶</button></div>
      <div class="row"><button class="hold" data-hold="1"><span>Inflate</span><kbd>B</kbd></button><b id="pciAtm" class="pci-read">0.0 atm</b><button class="btn" data-back="1">Back</button></div></div>`;
  }else if(P.stage==='ivus'){
    h=`<div class="pending"><div>IVUS pullback in the ${P.label}. Scrub along the vessel with the slider on the monitor.</div><div class="row"><button class="btn primary" data-ivusdone="1">Done</button></div></div>`;
  }
  el.innerHTML=h+log;
}
function openIVUS(){
  const P=S.pci;P.stage='ivus';P.ivus=0;P.ivusAuto=true;S.ivusUsed.add(P.vid);
  let mla=1e9;const ext=[];
  for(let k=0;k<=72;k++){const ld=clamp(P.ld+18-k*0.5,0,VBY[P.vid].len);const pr=lumenProfile(P.vid,ld,S.lesions,S.stents);const a=Math.PI*pr.lumenR*pr.lumenR;if(a<mla)mla=a;if(1-(pr.lumenR*pr.lumenR)/(pr.eemR*pr.eemR)>0.5)ext.push(ld)}
  const vlen=VBY[P.vid].len,dRef=refDiam(P.vid,clamp(P.ld+18,0,vlen)),pRef=refDiam(P.vid,clamp(P.ld-18,0,vlen));
  const len=ext.length?Math.max(...ext)-Math.min(...ext):0;
  S.ivusNote={vid:P.vid,text:`MLA ${mla.toFixed(1)} mm² · reference lumen ${dRef.toFixed(1)} mm distal, ${pRef.toFixed(1)} mm proximal · plaque burden over 50% for about ${Math.round(len)} mm`};
  $('ivusSum').textContent=S.ivusNote.text;$('ivusOv').hidden=false;$('ivusPos').value=0;renderPCI(true);
}
function closeIVUS(){$('ivusOv').hidden=true;if(S&&S.pci&&S.pci.stage==='ivus'){S.pci.stage='tools';renderPCI(true)}}
$('ivusPos').addEventListener('input',e=>{if(S&&S.pci&&S.pci.stage==='ivus'){S.pci.ivus=+e.target.value/100;S.pci.ivusAuto=false}});
$('ivusDone').addEventListener('click',closeIVUS);
$('pci').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!S||S.done)return;const P=S.pci,d=b.dataset;
  if(d.treat!=null)startPCI(+d.treat);
  else if(d.cancel){S.pci=null;toast('Wire withdrawn.')}
  else if(d.tool==='ivus'){openIVUS();return}
  else if(d.tool){P.kind=d.tool;P.stage='size';P.diam=d.tool==='stent'?3.0:2.5;P.len=d.tool==='stent'?18:15}
  else if(d.d)P.diam=+d.d;else if(d.l)P.len=+d.l;
  else if(d.pos){P.stage='positioned';toast(`${P.kind==='stent'?'Stent':'Balloon'} delivered over the wire. Markers show its ends.`)}
  else if(d.back){P.stage=P.stage==='positioned'?'size':'tools';P.atm=0;P.maxAtm=0}
  else if(d.nudge){const v=VBY[P.vid];P.ld=clamp(P.ld+ +d.nudge,P.len/2,v.len-2)}
  else if(d.ivusdone){closeIVUS();return}
  else if(d.finish){S.pci=null;toast('Wire removed.')}
  renderPCI(true);
});
$('pci').addEventListener('pointerdown',e=>{if(e.target.closest('[data-hold]')){e.preventDefault();keys.btn_KeyB=true}});
const holdUp=()=>{keys.btn_KeyB=false};window.addEventListener('pointerup',holdUp);window.addEventListener('pointercancel',holdUp);

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
  const c=S.cath,D=S.D;
  const ph0=S.phase;S.hr+=(S.hrT-S.hr)*Math.min(1,dt/1.2);S.phase=(S.phase+dt*S.hr/60)%1;
  // catheter handling
  let cs=cst(c);
  if(S.exch>0){S.exch-=dt;if(S.exch<=0){c.type=c.type==='JL'?'JR':'JL';c.th=CATH[c.type].home;toast(`${CATH[c.type].label} in the descending aorta.`)}}
  else if(S.pci){if(down('ArrowUp','KeyW','ArrowDown','KeyS','ArrowLeft','KeyA','ArrowRight','KeyD')&&toastT<=0)toast('The guide is holding position over the wire. Remove the wire first.')}
  else if(!S.complication){
    let moved=false;const fine=c.s>S_ROOT-30;
    if(down('ArrowUp','KeyW')){c.s=Math.min(S_ROOT+22*1.6,c.s+(fine?26:110)*dt);moved=true}
    if(down('ArrowDown','KeyS')){c.s=Math.max(0,c.s-(fine?26:110)*dt);moved=true}
    if(down('ArrowRight','KeyD')){c.th+=170*dt;moved=true}
    if(down('ArrowLeft','KeyA')){c.th-=170*dt;moved=true}
    // near the ostium a preshaped Judkins tends to drop in on its own (more help on easier settings)
    if(D.seek>0){const C=CATH[c.type],c0=cst(c);if(!c0.eng&&c0.u>=0.55&&!down('ArrowLeft','KeyA','ArrowRight','KeyD')){const diff=((OSTANG[C.sys]-c.th+540)%360)-180;if(Math.abs(diff)<D.tol[C.sys]+D.seek)c.th+=Math.sign(diff)*Math.min(Math.abs(diff),D.seekSpeed*dt)}}
    if(c.th>180)c.th-=360;if(c.th<-180)c.th+=360;
    const imaging=down('Space','KeyF')||!!S.cine;
    if(moved&&!imaging&&c.s>120){S.blind+=dt;if(S.blind>0.6&&Math.floor((S.blind-dt)/2)!==Math.floor(S.blind/2))toast('Moving the catheter without fluoro. Step on the pedal.',true)}
    cs=cst(c);
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
  if(S.deepInj>0.45&&!S.complication){S.complication='Injection through a damped catheter caused an ostial dissection.';if(S.cine)stopCine();S.pci=null;$('ivusOv').hidden=true;toast('Ostial dissection. Stop and report.',true);renderMarks();renderPCI(true)}
  // bradycardia with RCA injection
  if(S.cR>0.7)S.rcaInj+=dt;else S.rcaInj=Math.max(0,S.rcaInj-dt*1.5);
  S.hrT=S.rcaInj>1.6?46:72;
  // PCI: wire crossing (under X-ray), IVUS pullback, balloon inflation
  const P=S.pci,xray=down('Space','KeyF')||!!S.cine;
  if(P&&P.stage==='wire'&&xray){P.wire+=dt*0.5;if(P.wire>=1){P.wire=1;P.stage='tools';toast('Wire is across. Choose a device.');renderPCI(true)}}
  if(P&&P.stage==='ivus'){
    if(P.ivusAuto){P.ivus=Math.min(1,P.ivus+dt/4);$('ivusPos').value=Math.round(P.ivus*100);if(P.ivus>=1)P.ivusAuto=false}
    const ld=ivusLd(P),pr=lumenProfile(P.vid,ld,S.lesions,S.stents);drawIVUS($('ivusCan').getContext('2d'),pr,contraction(S.phase),S.frame++);
    const la=Math.PI*pr.lumenR*pr.lumenR,ea=Math.PI*pr.eemR*pr.eemR,off=Math.round(ld-P.mark);
    $('ivusRead').textContent=`${off===0?'At the mark':Math.abs(off)+' mm '+(off>0?'distal':'proximal')}\nLumen ${(2*pr.lumenR).toFixed(1)} mm · ${la.toFixed(1)} mm²\nEEM ${(2*pr.eemR).toFixed(1)} mm · plaque ${Math.round((1-la/ea)*100)}%${pr.stent?'\nStent struts apposed':''}`;
  }
  if(P&&P.stage==='positioned'){
    if(down('KeyB')){P.atm=Math.min(18,P.atm+7*dt);P.maxAtm=Math.max(P.maxAtm,P.atm);if(P.atm>=16.5&&!P.warned){P.warned=true;toast('Above the 16 atm rated burst pressure.',true)}if(P.atm>4&&!P.pain){P.pain=true;toast(`Balloon up. Chest pain, ST rising in ${P.vid==='LM'?'V3 and V5':TERRITORY[P.vid]}.`)}}
    else if(P.atm>0){if(P.maxAtm>=4)applyDevice();else{P.atm=Math.max(0,P.atm-20*dt);if(P.atm===0)P.maxAtm=0}}
  }
  // ECG territories: an inflated balloon raises ST in the lead facing that vessel, with reciprocal change elsewhere
  const tgt={II:0,V3:0,V5:0};
  if(P&&P.atm>4){const l=TERRITORY[P.vid];if(P.vid==='LM'){tgt.V3=0.8;tgt.V5=0.8;tgt.II=-0.4}else{tgt[l]=1;if(l==='V3')tgt.II=-0.35;if(l==='V5')tgt.V3=-0.5;if(l==='II')tgt.V5=-0.3}}
  for(const l of LEADS)S.st[l]+=(tgt[l]-S.st[l])*Math.min(1,dt*1.4);
  // hemodynamics
  const damped=cs.deep;
  hemoStep(dt,ph0,S.phase,damped);
  const p=pressAt(S.phase,damped);S.beatMax=Math.max(S.beatMax,p);S.beatMin=Math.min(S.beatMin,p);
  if(S.phase<ph0){S.sysP=S.beatMax;S.diaP=S.beatMin;S.beatMax=0;S.beatMin=999}
  // imaging
  const fl=down('Space','KeyF')&&!S.complication;const imaging=(fl||!!S.cine)&&!(P&&P.stage==='ivus');
  if(imaging&&S.review)closeReview();
  const f=1/Math.pow(Math.cos(S.a*D2R)*Math.cos(S.b*D2R),1.5);
  if(S.cine){S.ak+=165/60*dt*f;S.ctime+=dt}else if(fl){S.ak+=17/60*dt*f;S.ftime+=dt}
  S.imgAcc+=dt;
  if(S.review){if(S.review.playing){S.review.acc+=dt;if(S.review.acc>=1/15){S.review.acc=0;S.review.idx=(S.review.idx+1)%S.review.run.frames.length;drawReview()}}}
  else if(imaging&&S.imgAcc>=1/15){
    S.imgAcc=0;S.frame++;
    renderImage({t:S.clock,phase:S.phase,a:S.a,b:S.b,mode:S.cine?'cine':'fluoro',frame:S.frame,lesions:S.lesions,pci:pciRender(),cath:true,cathState:cs,wire:S.exch>0,conc:(sys,t)=>histAt(S.hist[sys],t),root:histAt(S.hist.root,S.clock)});
    if(S.cine){S.cine.frames.push({t:S.clock,phase:S.phase,frame:S.frame,cath:{...c},pci:pciRender()});if(S.cine.frames.length>=90)stopCine()}
    // coronary map (easy): any segment that filled with contrast is now mapped
    if(D.map&&lastProj){const n0=S.mapped.size;for(const Pv of lastProj.projV){for(let i=0;i<Pv.v.n;i+=2)if(Pv.cs[i]>0.45)S.mapped.add(mapKey(Pv.v,Pv.v.ld[i]))}if(S.mapped.size!==n0)drawMap($('mapCan').getContext('2d'),S.mapped)}
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
  $('rdCM').querySelector('b').innerHTML=`${Math.round(S.contrast)}<small>/ ${S.budget} mL</small>`;$('rdCM').classList.toggle('hot',S.contrast>S.budget);
  $('rdHD').querySelector('b').innerHTML=`${Math.round(S.hr)}<small>${Math.round(S.sysP)}/${Math.round(S.diaP)}</small>`;$('rdHD').classList.toggle('hot',S.hr<55||(S.cs&&S.cs.deep));
  $('cathType').textContent=S.exch>0?'Exchanging…':CATH[S.cath.type].label+(S.pci?' guide':'')+' · 6F';
  const other=S.cath.type==='JL'?'JR4':'JL4';const be=$('bExch');be.textContent='Exchange for '+other;be.disabled=S.exch>0||!!S.complication||!!S.pci;
  const st=$('status');const cs=S.cs||{};let cls='',msg='';
  if(S.complication){cls='danger';msg=S.complication+' Finish the study to see your report.'}
  else if(S.exch>0){msg='Exchanging catheter over a 0.035" wire…'}
  else if(S.pci){cls='ok';msg={wire:'Crossing the lesion with a 0.014" wire. Keep fluoro on.',tools:'Wire across. Choose IVUS, a balloon or a stent.',size:'Pick the diameter and length.',positioned:'Device in place. Check its position on fluoro, then hold Inflate.',ivus:'IVUS pullback running.'}[S.pci.stage]}
  else if(cs.deep){cls='danger';msg='Pressure damped: catheter deep-seated. Withdraw slightly before you inject.'}
  else if(cs.eng){cls='ok';msg=`Engaged ${cs.eng==='L'?'left main':'right coronary'} ostium. Pressure normal. Start cine, then inject.`}
  else if(cs.u>0){cls='warn';const need=CATH[S.cath.type].sys;msg=`In the aortic root, ${CATH[S.cath.type].label} tip at ${Math.round(S.cath.th)}°. Torque to find the ${need==='L'?'left main':'right coronary'} ostium; a short test puff shows where you are.`}
  else{msg=`${cs.region||'Femoral sheath'} · ${Math.round(S.cath.s)} mm inserted.`+(S.cath.s<S_EXCH?' Catheter exchange is possible here.':'')}
  st.className='status '+cls;st.textContent=msg;
  document.querySelectorAll('#presets button').forEach(b=>b.disabled=!!S.cine);
  $('sA').disabled=$('sB').disabled=!!S.cine;
  renderPCI();
}

/* ---------- scoring and coffee tokens ---------- */
$('bFinish').addEventListener('click',finish);
function finish(){
  if(!S||S.done)return;if(S.cine)stopCine();closeReview();S.done=true;S.pci=null;$('ivusOv').hidden=true;
  const notes=[],rows=[];
  // lesion detection
  const sig=S.lesions.filter(L=>L.sev>=0.5),minor=S.lesions.filter(L=>L.sev<0.5);
  let lesPts=0;const used=new Set(),per=35/Math.max(1,sig.length);
  const match=L=>S.marks.findIndex((m,i)=>!used.has(i)&&m.vid===L.vid&&Math.abs(m.ld-L.at)<=L.len/2+7);
  for(const L of [...sig,...minor]){
    const bi=BUCKETS.findIndex(b=>L.sev>=b.lo&&L.sev<b.hi),mi=match(L);
    const views=S.runs.filter(r=>r.sys===L.sys).map(r=>({r,ap:apparent(L,basis(r.a,r.b))})).sort((x,y)=>y.ap-x.ap);
    let viewNote='';
    if(views.length){const b=views[0],w=views[views.length-1];viewNote=` Best shown in ${angLabel(b.r.a,b.r.b)} (looked about ${Math.round(b.ap*100)}%)`+(views.length>1&&b.ap-w.ap>0.15?`; in ${angLabel(w.r.a,w.r.b)} it looked about ${Math.round(w.ap*100)}%.`:'.')}
    else viewNote=` You never recorded a selective run of the ${L.sys==='L'?'left':'right'} system.`;
    if(L.sev>=0.5){
      if(mi>=0){used.add(mi);const m=S.marks[mi];const ok=m.bucket===bi,near=Math.abs(m.bucket-bi)===1;lesPts+=per*(ok?1:near?0.7:0.55);
        notes.push({c:ok?'good':'',t:`${Math.round(L.sev*100)}% ${L.label}: found, graded ${BUCKETS[m.bucket].k}${ok?'.':' (true range '+BUCKETS[bi].k+').'}${viewNote}`})}
      else notes.push({c:'bad',t:`Missed: ${Math.round(L.sev*100)}% ${L.label}.${viewNote}`});
    }else if(mi>=0){used.add(mi);const m=S.marks[mi];if(m.bucket===0)notes.push({c:'good',t:`${Math.round(L.sev*100)}% ${L.label}: correctly called non-significant.`});else{lesPts-=8;notes.push({c:'bad',t:`Overcalled: ${L.label} is about ${Math.round(L.sev*100)}%, you graded it ${BUCKETS[m.bucket].k}.${viewNote}`})}}
  }
  const fp=S.marks.filter((m,i)=>!used.has(i)).length;
  if(fp){lesPts-=6*fp;notes.push({c:'bad',t:`${fp} mark${fp>1?'s':''} on normal vessel.`})}
  lesPts=clamp(lesPts,0,35);rows.push(['Lesion detection and grading',lesPts,35]);
  // treatment
  const targets=S.lesions.filter(L=>L.sev>=0.7);let tx=0;const perT=15/Math.max(1,targets.length);
  for(const L of targets){
    const sh=[];for(const s of S.stents)for(const h of s.hits)if(h.L===L)sh.push({s,o:h.o});
    const bh=[];for(const b of S.balloons)for(const h of b.hits)if(h.L===L)bh.push({b,o:h.o});
    if(!sh.length&&!bh.length){notes.push({c:'bad',t:`Not treated: the ${Math.round(L.sev*100)}% ${L.label} needed treatment.`});continue}
    if(!sh.length){tx+=perT*0.4;notes.push({c:'',t:`Balloon angioplasty only on the ${L.label}: residual ${Math.round(L.cur*100)}% from elastic recoil. A stent gives a durable result.`});continue}
    const {s,o}=sh[sh.length-1],good=o.covered&&!o.under&&!o.over&&!o.lowP&&!o.noPre;tx+=perT*(good?1:0.5);
    const iss=[];if(!o.covered)iss.push('it did not cover the whole lesion');if(o.under)iss.push(`undersized for a ~${o.refD.toFixed(1)} mm vessel`);if(o.over)iss.push(`oversized for a ~${o.refD.toFixed(1)} mm vessel, with edge dissection risk`);if(o.lowP)iss.push(`deployed at only ${s.atm} atm (aim for 12–14)`);if(o.noPre)iss.push('a subtotal lesion should be predilated with a balloon first');
    const post=bh.some(x=>x.o.post);
    notes.push({c:good?'good':'',t:`Stented ${L.label}: ${s.diam.toFixed(1)} × ${s.len} mm at ${s.atm} atm${post?', post-dilated':''}, residual ${Math.round(L.cur*100)}%.`+(iss.length?' But '+iss.join('; ')+'.':` Well sized for a ~${o.refD.toFixed(1)} mm vessel${s.ivus?', IVUS-guided':''}.`)});
  }
  for(const s of S.stents){if(!s.hits.some(h=>h.L.sev>=0.5)){tx-=8;notes.push({c:'bad',t:`Unnecessary stent in the ${s.label}: ${s.hits.length?'that lesion was not flow-limiting.':'there was no lesion there.'}`})}else if(s.hits.some(h=>h.o.over))tx-=4}
  for(const b of S.balloons){if(b.hits.some(h=>h.o.over)){tx-=4;notes.push({c:'bad',t:`Oversized balloon in the ${b.label} (${b.diam.toFixed(1)} mm) caused an edge dissection.`})}if(!b.hits.some(h=>h.L.sev>=0.5)){tx-=4;notes.push({c:'bad',t:`Unnecessary balloon inflation in the ${b.label}.`})}}
  for(const sy of new Set(S.stents.map(s=>VBY[s.vid].sys))){const t=Math.max(...S.stents.filter(s=>VBY[s.vid].sys===sy).map(s=>s.t));if(!S.runs.some(r=>r.sys===sy&&r.t0>t))notes.push({c:'',t:`Record a final cine run of the ${sy==='L'?'left':'right'} system after stenting to confirm the result.`})}
  tx=clamp(tx,0,15);rows.push(['Treatment (balloon and stent)',tx,15]);
  // study quality
  const distinct=sys=>{const v=[];for(const r of S.runs){if(r.sys!==sys)continue;if(!v.some(o=>Math.abs(o.a-r.a)<15&&Math.abs(o.b-r.b)<15))v.push(r)}return v.length};
  const nL=distinct('L'),nR=distinct('R');
  const comp=(nL>=3?9:nL===2?6:nL===1?3:0)+(nR>=2?6:nR===1?3:0);rows.push([`Complete study (LCA ${nL} views, RCA ${nR})`,comp,15]);
  if(nL<3)notes.push({c:'',t:'A standard left system study uses at least three or four projections: RAO caudal, RAO cranial, LAO cranial and LAO caudal.'});
  if(nR<2)notes.push({c:'',t:'Image the RCA in at least two orthogonal views, for example LAO 40° and RAO 30°.'});
  const B=S.budget;const cm=Math.round(15*clamp(1-(S.contrast-B)/(B*2),0,1));rows.push([`Contrast ${Math.round(S.contrast)} mL (budget ${B})`,cm,15]);
  const rad=Math.round(10*clamp(1-(S.ak-400)/1000,0,1));rows.push([`Air kerma ${Math.round(S.ak)} mGy · fluoro ${fmtT(S.ftime)}`,rad,10]);
  if(S.ak>400)notes.push({c:'',t:'Steep angles and long cine runs drive dose up. Keep runs to 3–4 seconds and collimate your pedal time.'});
  const saf=10-Math.min(10,Math.round(S.blind*2));rows.push(['Safety (catheter moved under fluoro)',saf,10]);
  let total=lesPts+tx+comp+cm+rad+saf;
  if(S.complication){total=Math.min(total,35);notes.unshift({c:'bad',t:S.complication+' A damped or ventricularised pressure trace means the tip is against the vessel wall. Withdraw before injecting.'})}
  total=Math.round(total);
  const grade=S.complication?'Complication':total>=85?'Attending standard':total>=70?'Senior fellow':total>=50?'Junior fellow':'Keep practising';
  // coffee tokens: one per 10 points, scaled by difficulty; none after a complication
  const earned=S.complication?0:Math.round(total/10*S.D.tokenX);
  profile.tokens+=earned;const key=S.diff+'-'+S.ci,prev=profile.best[key];if(prev==null||total>prev)profile.best[key]=total;saveProfile();renderWho();
  const ov=$('resultOv');
  ov.innerHTML=`<div class="rephead">${avatarSVG(profile.avatar,48)}<div><h1>Report · case ${S.ci+1}</h1><span class="fine">${esc(profile.name)} · ${S.D.label}</span></div></div>
  <div class="score"><b>${total}</b><span>${grade}</span></div>
  <div class="tokens">${CUP} +${earned} coffee token${earned===1?'':'s'}${S.D.tokenX>1?` (×${S.D.tokenX} for ${S.D.label})`:''} · ${profile.tokens} banked${prev!=null&&total>prev?' · new best':''}</div>
  <div class="rows">${rows.map(r=>`<span>${r[0]}</span><span class="v">${Math.round(r[1])} / ${r[2]}</span>`).join('')}</div>
  <div class="notes">${notes.map(n=>`<div class="${n.c}">${n.t}</div>`).join('')}</div>
  <div class="row"><button class="btn primary" id="rAgain">Repeat case</button><button class="btn" id="rCases">Choose another case</button><button class="btn" id="rMenu">Main menu</button></div>`;
  ov.hidden=false;
  $('rAgain').onclick=()=>startCase(S.ci);
  $('rCases').onclick=()=>showMenu('play');
  $('rMenu').onclick=()=>showMenu('home');
  renderMarks();renderPCI(true);
}

sizeHemo();showMenu();
requestAnimationFrame(loop);
