/* Cath Lab Run: menu and operator profile, game state, input, UI, PCI tools, hemodynamic strip, main loop and scoring. */
"use strict";
const img=document.getElementById('img');img.width=img.height=W*RES;ictx=img.getContext('2d');ictx.setTransform(RES,0,0,RES,0,0);
/* touch devices: name the on-screen buttons instead of keys */
const TOUCH=matchMedia('(pointer:coarse)').matches;
const keyName=(k,btn)=>TOUCH?btn:k;
/* if frames are slow (an older phone), drop to a lighter image resolution once */
let renderEMA=0,lowRes=false;
let renderN=0;
function noteRenderTime(ms){renderN++;renderEMA=renderEMA?renderEMA*0.92+ms*0.08:ms;if(!lowRes&&renderN>40&&renderEMA>30){lowRes=true;setResolution(1);img.width=img.height=W;ictx=img.getContext('2d');ictx.setTransform(1,0,0,1,0,0);toast('Lighter image quality for a smoother run on this device.')}}
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- operator profile (saved on this device only) ---------- */
const STORE='cathlabrun.profile.v1';
function loadProfile(){try{const p=JSON.parse(localStorage.getItem(STORE)||'null');if(p&&typeof p.name==='string'&&p.name){
  const q={tokens:0,best:{},diff:'easy',avatar:0,owned:[],tiers:{},...p};delete q.lut;q.tiers={...(q.tiers||{})};
  // the old single-tier perks become tier 1 of their upgrade
  q.owned=(q.owned||[]).filter(id=>{const u=UPGRADE_FROM_PERK[id];if(u){q.tiers[u]=Math.max(q.tiers[u]||0,1);return false}return true});
  // refund anything the shop no longer sells (the monitor colour filters)
  let back=0;q.owned=(q.owned||[]).filter(id=>{if(RETIRED_SHOP[id]){back+=RETIRED_SHOP[id];return false}return true});
  if(back){q.tokens+=back;q.refunded=back;try{localStorage.setItem(STORE,JSON.stringify({...q,refunded:undefined}))}catch(e){}}
  return q}}catch(e){}return null}
function saveProfile(){try{localStorage.setItem(STORE,JSON.stringify(profile))}catch(e){}}
let profile=loadProfile();
/* someone who has already played (or chose to skip) never has the tutorial put in their way */
const returning=()=>!!(profile&&(profile.tutDone||profile.tutSkipped||profile.randomDone>0||Object.keys(profile.best||{}).length||profile.daily));
const owns=id=>!!(profile&&profile.owned&&profile.owned.includes(id));
const tierOf=id=>(profile&&profile.tiers&&profile.tiers[id])||0;
/* the effect of an upgrade at the operator's current tier (its base value if not bought) */
function upgradeVal(id){const u=UPGRADES.find(x=>x.id===id),t=tierOf(id);return t?u.tiers[t-1].val:u.base}
/* Contrast budget for a case on a difficulty (null = no limit), including the power injector. */
function caseBudget(c,D){return D.budgetX==null?null:Math.round(c.budget*D.budgetX*upgradeVal('injector'))}
function caseTask(c,D){const b=caseBudget(c,D);return c.task+(c.budgetInTask&&b!=null?` Aim for under ${b} mL of contrast.`:'')}

function avatarSVG(i,size){
  const a=AVATARS[i]||AVATARS[0];
  const hair={short:`<path d="M21 27Q20 14 32 14Q44 14 43 27Q40 19 32 19Q24 19 21 27Z" fill="${a.hair}"/>`,
    long:`<path d="M20 30Q18 13 32 13Q46 13 44 30L45 42Q41 40 41 32Q40 20 32 20Q24 20 23 32Q23 40 19 42Z" fill="${a.hair}"/>`,
    bun:`<circle cx="32" cy="11" r="5" fill="${a.hair}"/><path d="M21 27Q20 14 32 14Q44 14 43 27Q40 19 32 19Q24 19 21 27Z" fill="${a.hair}"/>`,
    crop:`<path d="M21.5 25Q22 15 32 15Q42 15 42.5 25Q38 20 32 20Q26 20 21.5 25Z" fill="${a.hair}"/>`,
    bald:`<path d="M21 30Q20 24 23 22L23 30ZM43 30Q44 24 41 22L41 30Z" fill="${a.hair}"/>`}[a.style];
  const cap=a.cap?`<path d="M20 24Q20 12 32 12Q44 12 44 24Q32 19 20 24Z" fill="${a.cap}"/><path d="M43 22L48 25" stroke="${a.cap}" stroke-width="2" stroke-linecap="round"/>`:'';
  return `<svg class="sketch" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#f5edda" stroke="#2b2a33" stroke-width="1.5"/><g stroke="#2b2a33" stroke-width="1.3" stroke-linejoin="round"><path d="M10 64Q12 46 32 44Q52 46 54 64Z" fill="${a.scrub}"/><path d="M26 45L32 53L38 45" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="2"/><rect x="28" y="35" width="8" height="10" fill="${a.skin}"/><ellipse cx="32" cy="28" rx="11" ry="12" fill="${a.skin}"/>${hair}${cap}</g><circle cx="28" cy="29" r="1.3" fill="#2a1a12"/><circle cx="36" cy="29" r="1.3" fill="#2a1a12"/><path d="M29 34Q32 36.5 35 34" fill="none" stroke="#5a3424" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}
const DICE='<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style="vertical-align:-3px"><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5" cy="5" r="1.3" fill="currentColor"/><circle cx="11" cy="11" r="1.3" fill="currentColor"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/></svg>';
const CUP='<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5h9v5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" fill="currentColor"/><path d="M11 6h1.5a2 2 0 0 1 0 4H11" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 1.5q1 1 0 2M8 1.5q1 1 0 2" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>';
function renderWho(){const w=$('who');if(!profile){w.hidden=true;return}w.hidden=false;w.innerHTML=`${avatarSVG(profile.avatar,26)}<span>${esc(profile.name)}</span><b>${CUP}${profile.tokens}</b>`}

/* ---------- menu ---------- */
let menuView='home',draft=null;
const LEVEL_BARS=n=>`<span class="lvl" aria-hidden="true">${[1,2,3].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</span>`;
const ICONS={
  torque:'<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M5 5l2.5 2.5M16.5 16.5L19 19"/><path d="M17 8a6 6 0 0 1 0 8" />',
  wire:'<path d="M2 16c3-8 5 6 8-2s5 6 8-2 3 2 4 1"/>',
  fluoro:'<circle cx="12" cy="12" r="2"/><path d="M12 4a8 8 0 0 1 6.9 4l-4.5 2.6M5.1 8A8 8 0 0 1 12 4M5.1 16a8 8 0 0 0 6.9 4M18.9 16a8 8 0 0 1-6.9 4"/><path d="M4 21L20 3"/>',
  injector:'<path d="M14 3l7 7M17.5 6.5L8 16l-3 1 1-3 9.5-9.5M3 21l3-3M11 9l4 4"/>',
};
function shopIcon(it){if(it.kind==='avatar')return avatarSVG(it.avatar,44);return `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[it.id]}</svg>`}
function showMenu(view){
  if(typeof close3D==='function')close3D();
  if(S&&!S.done)saveCase();
  menuView=view||(profile?'home':'profile');S=null;if(typeof renderCoach==='function')renderCoach();document.body.classList.add('inmenu');document.body.classList.remove('inreport');
  $('resultOv').hidden=true;$('startOv').hidden=false;$('reviewbar').hidden=true;
  demoFrame();syncArm();renderRuns();renderMarks();renderPending();renderPCI(true);renderWho();
  $('caseHead').innerHTML='<h2>Patient</h2><b>No case loaded</b><p>Pick a case on the monitor to begin.</p>';$('status').textContent='Catheter in the femoral sheath.';$('status').className='status';
  renderMenu();
}
/* ---------- save and resume ----------
   An unfinished case is saved every couple of seconds (and when the tab is hidden or closed). The patient is
   rebuilt from its case code, so only what happened is stored: the contrast history, runs, marks, devices,
   complications and where the catheter is. A cine run being recorded at that moment is not kept. */
const SAVE_KEY='cathlabrun.save.v1';
const SAVE_FIELDS=['clock','phase','hr','hrT','a','b','cath','exch','cL','cR','cRoot','histN','contrast','ak','ftime','ctime','blind','wasted','runs','marks','imgAcc','frame','deepInj','rcaInj','complication','sysP','diaP','pci','events','drugs','hrDip','bpDip','isch','effusion','tamponade','pcT','pcCount','protamine','seals','prevEng','prevDeep','st','forced','twist','ffr','tut','daily'];
const r3=a=>a.map(x=>Math.round(x*1000)/1000);
function saveCase(){
  if(!S||S.done)return;
  try{
    const sv={v:1,ci:S.ci,diff:S.diff,saved:Date.now(),hist:{L:r3(S.hist.L),R:r3(S.hist.R),root:r3(S.hist.root)},mapped:[...S.mapped],twi:[...S.twi],
      lesions:S.lesions.map(L=>({cur:L.cur??null,predil:!!L.predil,stented:!!L.stented})),
      stents:S.stents.map(d=>({...d,hits:d.hits.map(h=>({li:S.lesions.indexOf(h.L),o:h.o}))})),
      balloons:S.balloons.map(d=>({...d,hits:d.hits.map(h=>({li:S.lesions.indexOf(h.L),o:h.o}))}))};
    for(const k of SAVE_FIELDS)sv[k]=S[k];
    localStorage.setItem(SAVE_KEY,JSON.stringify(sv));
  }catch(e){}
}
function loadSave(){try{const sv=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return sv&&sv.v===1&&sv.ci?sv:null}catch(e){return null}}
function clearSave(){try{localStorage.removeItem(SAVE_KEY)}catch(e){}}
function resumeCase(){
  const sv=loadSave();if(!sv)return;
  if(sv.ci!=='TUTORIAL'){profile.diff=sv.diff;saveProfile()}
  startCase(sv.ci,{daily:sv.daily});
  for(const k of SAVE_FIELDS)if(sv[k]!==undefined)S[k]=sv[k];
  S.hist={L:sv.hist.L,R:sv.hist.R,root:sv.hist.root};S.mapped=new Set(sv.mapped);S.twi=new Set(sv.twi);
  sv.lesions.forEach((x,i)=>{const L=S.lesions[i];if(!L)return;if(x.cur!=null)L.cur=x.cur;L.predil=x.predil;L.stented=x.stented});
  const relink=d=>({...d,hits:d.hits.map(h=>({L:S.lesions[h.li],o:h.o})).filter(h=>h.L)});
  S.stents=sv.stents.map(relink);S.balloons=sv.balloons.map(relink);
  S.daily=!!sv.daily&&sv.ci===dailyCode();S.cine=null;S.review=null;
  syncArm();renderRuns();renderMarks();renderPending();renderPCI(true);if(typeof renderCoach==='function')renderCoach();
  toast(`Resumed ${caseName(S)} at ${fmtT(S.clock)}. ${keyName('Hold Space','Hold the Fluoro button')} for fluoro to pick up where you left off.`);
}
function resumeCard(){
  const sv=loadSave();if(!sv)return '';
  const name=sv.ci==='TUTORIAL'?'the tutorial':'patient '+sv.ci,ago=Math.round((Date.now()-sv.saved)/60000);
  return `<div class="daily resume"><span class="medal none" aria-hidden="true">▶</span><div><b>Unfinished case</b><span>${name} on ${DIFFICULTY[sv.diff]?DIFFICULTY[sv.diff].label:sv.diff}, ${fmtT(sv.clock)} in${sv.stents&&sv.stents.length?`, ${sv.stents.length} stent${sv.stents.length>1?'s':''} placed`:''} · saved ${ago<1?'just now':ago<60?ago+' min ago':Math.round(ago/60)+' h ago'}.</span></div>
    <div class="row"><button class="btn primary" data-act="resume">Resume</button><button class="btn" data-act="discard">Discard</button></div></div>`;
}
window.addEventListener('pagehide',saveCase);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveCase()});

/* ---------- daily case ---------- */
const MEDAL_NAME={gold:'Gold',silver:'Silver',bronze:'Bronze',none:'No medal'};
const medalBadge=m=>`<span class="medal ${m}" aria-label="${MEDAL_NAME[m]}">${m==='none'?'–':MEDAL_NAME[m][0]}</span>`;
function dailyCard(){
  const today=dateKey(),dd=profile.daily&&profile.daily.date===today?profile.daily:null,m=dd?dd.medal:'none',st=profile.streak||{n:0};
  const md=profile.medals||{},th=MEDALS[profile.diff];
  const streakLive=st.last===today||st.last===dateKey(new Date(Date.now()-864e5));
  return `<div class="daily">${medalBadge(m)}<div><b>Today's case · ${new Date().toLocaleDateString(undefined,{day:'numeric',month:'short'})}</b>
    <span>${dd?`Best today ${dd.score} on ${DIFFICULTY[dd.diff].label}: ${MEDAL_NAME[m].toLowerCase()}.`:'Everyone gets the same patient today.'} ${DIFFICULTY[profile.diff].label}: bronze ${th.bronze}, silver ${th.silver}, gold ${th.gold}.</span>
    <span class="cabinet">${streakLive&&st.n?`🔥 ${st.n}-day streak · `:''}<span><i style="background:#f2c94c"></i>${md.gold||0}</span><span><i style="background:#cfd4da"></i>${md.silver||0}</span><span><i style="background:#d99a62"></i>${md.bronze||0}</span></span></div>
    <button class="btn primary" data-act="daily">${dd?'Try again':'Play today\'s case'}</button></div>`;
}
/* record a daily result: keep the day's best medal, pay the difference in medal tokens, keep the streak */
function recordDaily(score){
  const today=dateKey(),medal=medalFor(score,S.diff),prev=profile.daily&&profile.daily.date===today?profile.daily:null,old=prev?prev.medal:'none';
  let bonus=0;
  if(!prev||MEDAL_RANK[medal]>MEDAL_RANK[old]||(medal===old&&score>prev.score)){
    if(MEDAL_RANK[medal]>MEDAL_RANK[old]){
      bonus=(MEDAL_TOKENS[medal]||0)-(MEDAL_TOKENS[old]||0);
      profile.medals={...(profile.medals||{})};if(old!=='none')profile.medals[old]=Math.max(0,(profile.medals[old]||0)-1);profile.medals[medal]=(profile.medals[medal]||0)+1;
      if(old==='none'){const st=profile.streak||{n:0},y=dateKey(new Date(Date.now()-864e5));profile.streak={n:st.last===y?st.n+1:st.last===today?st.n:1,last:today}}
    }
    profile.daily={date:today,score,medal,diff:S.diff};
  }
  profile.tokens+=bonus;
  return {medal,bonus};
}
function renderMenu(){
  const ov=$('startOv');ov.dataset.view=menuView;
  if(menuView==='profile'){
    if(!draft)draft={name:profile?profile.name:'',avatar:profile?profile.avatar:0};
    const avail=AVATARS.map((a,i)=>({a,i})).filter(x=>!x.a.shop||owns(x.a.shop));
    ov.innerHTML=`<h1>${profile?'Edit operator':'Create your operator'}</h1>
      <p>Your name and avatar appear on the console and your reports. They're saved in this browser only.</p>
      <label class="field" for="opName"><span>Name</span><input id="opName" maxlength="24" autocomplete="off" placeholder="Dr …" value="${esc(draft.name)}"></label>
      <div class="grouplabel">Avatar${AVATARS.length>avail.length?' · more in the shop':''}</div>
      <div class="avatars">${avail.map(({i})=>`<button class="av${i===draft.avatar?' sel':''}" data-av="${i}" aria-label="Avatar ${i+1}">${avatarSVG(i,56)}</button>`).join('')}</div>
      <div class="row"><button class="btn primary" data-act="saveop" ${draft.name.trim()?'':'disabled'}>Save operator</button>${profile?'<button class="btn" data-act="home">Cancel</button>':''}</div>`;
    const inp=$('opName');inp.addEventListener('input',()=>{draft.name=inp.value;ov.querySelector('[data-act="saveop"]').disabled=!inp.value.trim()});
    return;
  }
  if(menuView==='exp'){
    ov.innerHTML=`<h1>How much angiography have you done?</h1>
      <p>The tutorial is a short play-through of one patient. Your answer sets how much it explains and where you start afterwards.</p>
      <div class="diffs">${EXPERIENCE.map(e=>`<button class="diff${profile.exp===e.k?' sel':''}" data-exp="${e.k}"><b>${e.name}</b><span>${e.desc}</span></button>`).join('')}</div>
      <div class="row"><button class="btn" data-act="notut">Skip the tutorial: go to the cases</button><button class="btn" data-act="home">Back</button></div>`;
    return;
  }
  if(menuView==='tutoffer'){
    const e=EXPERIENCE[profile.exp];
    ov.innerHTML=`<h1>Ready for a quick tutorial?</h1>
      <p>${e.k===0?'One patient, start to finish: getting the catheter to the heart, filming the arteries, finding the narrowing and stenting it. The coach under the monitor explains each step and waits for you. About ten minutes.':e.k===1?'One patient, start to finish, with the game\'s controls explained as you go. About five minutes.':'A fast run through this game\'s controls on one patient: torque, cine, marking, the PCI panel and the report. A couple of minutes.'}</p>
      <div class="row"><button class="btn primary big" data-act="tutorial">Start the tutorial</button><button class="btn big" data-act="skiptut">Skip the tutorial: go to the cases</button></div>`;
    return;
  }
  if(menuView==='play'){
    const d=profile.diff;
    ov.innerHTML=`<h1>New patient</h1>
      <div class="grouplabel">Difficulty</div>
      <div class="diffs">${Object.entries(DIFFICULTY).map(([k,v])=>`<button class="diff${k===d?' sel':''}" data-diff="${k}"><b>${LEVEL_BARS(v.level)}${v.label}</b><span>${v.blurb}</span>${profile.best[k+'-R']!=null?`<span class="best">Best ${profile.best[k+'-R']}</span>`:''}</button>`).join('')}</div>
      <div class="grouplabel">Patient</div>
      <div class="randrow"><button class="btn primary big" data-act="rand">${DICE} New random patient</button></div>
      <p class="fine">Every patient is different: anatomy, disease, history and what goes wrong. ${profile.randomDone?`You have seen ${profile.randomDone}.`:''}</p>
      <div class="grouplabel">Replay or share a patient</div>
      <div class="randrow"><input id="codeIn" maxlength="10" autocomplete="off" spellcheck="false" placeholder="CLR-XXXXX" aria-label="Case code"><button class="btn" data-act="code">Play code</button>
        <span class="randinfo">A code gives the same patient on the same difficulty.</span></div>
      <div class="row"><button class="btn" data-act="home">Back</button></div>`;
    return;
  }
  if(menuView==='shop'){
    ov.innerHTML=`<div class="shophead"><h1>Coffee cart</h1><span class="tokens big">${CUP} ${profile.tokens} tokens</span></div>
      <p>Spend the tokens you earn on cases. Gear works on every case once bought.</p>
      <div class="grouplabel">Upgrades</div>
      <div class="shop">${UPGRADES.map(u=>{const t=tierOf(u.id),next=u.tiers[t],need=next?next.price-profile.tokens:0;
        const pips=`<span class="pips" aria-label="Tier ${t} of ${u.tiers.length}">${u.tiers.map((_,i)=>`<i class="${i<t?'on':''}"></i>`).join('')}</span>`;
        const cta=next?`<button class="btn primary" data-up="${u.id}" ${need>0?'disabled':''}>${t?'Upgrade':'Buy'} · ${CUP} ${next.price}</button>${need>0?`<span class="need">${need} more</span>`:''}`:'<span class="owned">Top tier</span>';
        return `<div class="item${t?' own':''}"><div class="ic perk">${shopIcon({id:u.id})}</div><div class="txt"><b>${u.name} ${pips}</b>
          <span>${t?`Now: ${u.what(u.tiers[t-1].val)}.`:'Not bought yet.'}</span>${next?`<span class="nexttier">Tier ${['I','II','III'][t]}: ${u.what(next.val)}.</span>`:''}</div><div class="cta">${cta}</div></div>`}).join('')}</div>
      <div class="grouplabel">Gear and avatars</div>
      <div class="shop">${SHOP.map(it=>{const own=owns(it.id),need=it.price-profile.tokens;
        const cta=own?`<span class="owned">${it.kind==='avatar'?'Owned · pick it in Change operator':'Owned'}</span>`
          :`<button class="btn primary" data-buy="${it.id}" ${need>0?'disabled':''}>${CUP} ${it.price}</button>${need>0?`<span class="need">${need} more</span>`:''}`;
        return `<div class="item${own?' own':''}"><div class="ic ${it.kind}">${shopIcon(it)}</div><div class="txt"><b>${it.name}</b><span>${it.desc}</span></div><div class="cta">${cta}</div></div>`}).join('')}</div>
      <div class="row"><button class="btn" data-act="home">Back</button></div>`;
    return;
  }
  ov.innerHTML=`<div class="hero"><img class="heroimg" src="assets/cardiologists.png" alt="Cartoon of two cardiologists, a woman with a stethoscope and a man holding a guide catheter, in scrubs and lead aprons"><div class="herotxt"><span class="kicker">Coronary angiography · PCI</span><h1>Cath Lab Run</h1><p>Drive the catheter to the aortic root, engage each coronary, record cine runs in the right projections, then find, grade and treat the stenosis.</p></div></div>
    <div class="opcard">${avatarSVG(profile.avatar,64)}<div><b>${esc(profile.name)}</b><span>${CUP} ${profile.tokens} coffee tokens · ${DIFFICULTY[profile.diff].label}</span></div><button class="btn" data-act="editop">Change operator</button></div>
    ${resumeCard()}${dailyCard()}
    <div class="menubtns"><button class="btn primary big" data-act="play">Start a case</button><button class="btn big" data-act="shop">${CUP} Coffee cart</button><button class="btn big" data-act="exp">Tutorial</button><button class="btn big" data-gl="">Glossary</button></div>
    <p class="fine">Teaching game with simplified anatomy and physics. Not a clinical training device.</p>`;
}
$('startOv').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.av!=null){draft.name=($('opName')||{}).value||draft.name;draft.avatar=+d.av;renderMenu();return}
  if(d.exp!=null){profile.exp=+d.exp;profile.diff=EXPERIENCE[+d.exp].diff;saveProfile();renderWho();menuView='tutoffer';renderMenu();return}
  if(d.diff){profile.diff=d.diff;saveProfile();renderMenu();renderWho();return}
  if(d.up){const u=UPGRADES.find(x=>x.id===d.up),t=tierOf(d.up),next=u&&u.tiers[t];if(!next||profile.tokens<next.price)return;profile.tokens-=next.price;profile.tiers={...(profile.tiers||{}),[u.id]:t+1};saveProfile();renderWho();renderMenu();toast(`${u.name} tier ${['I','II','III'][t]}: ${u.what(next.val)}.`);return}
  if(d.buy){const it=SHOP.find(x=>x.id===d.buy);if(!it||owns(it.id)||profile.tokens<it.price)return;profile.tokens-=it.price;profile.owned=[...(profile.owned||[]),it.id];saveProfile();renderWho();renderMenu();toast(`Bought: ${it.name}.`);return}
  if(d.act==='saveop'){const n=($('opName').value||'').trim().slice(0,24);if(!n)return;profile=profile?{...profile,name:n,avatar:draft.avatar}:{name:n,avatar:draft.avatar,tokens:0,best:{},diff:'easy',owned:[],tiers:{}};const isNew=profile.exp==null;draft=null;saveProfile();renderWho();menuView=isNew?'exp':'home';renderMenu()}
  else if(d.act==='editop'){draft=null;menuView='profile';renderMenu()}
  else if(d.act==='play'){menuView=profile.exp==null&&!returning()?'exp':'play';renderMenu()}
  else if(d.act==='exp'){menuView='exp';renderMenu()}
  else if(d.act==='tutorial'){startTutorial()}
  else if(d.act==='skiptut'||d.act==='notut'){profile.tutSkipped=true;saveProfile();menuView='play';renderMenu()}
  else if(d.act==='rand'){startCase(randomCode())}
  else if(d.act==='resume'){resumeCase()}
  else if(d.act==='discard'){clearSave();renderMenu();toast('Unfinished case discarded.')}
  else if(d.act==='daily'){startCase(dailyCode(),{daily:true})}
  else if(d.act==='code'){const v=($('codeIn').value||'').trim(),n=codeToSeed(v);if(n==null){toast('That is not a case code. Codes look like CLR-7KQ2M.',true);return}startCase(seedToCode(n))}
  else if(d.act==='shop'){menuView='shop';renderMenu()}
  else if(d.act==='home'){draft=null;menuView='home';renderMenu()}
});
$('who').addEventListener('click',()=>{if(!S||S.done)showMenu('home')});


/* ---------- state ---------- */
let S=null;
const keys={};
/* ci is a random patient's case code ('CLR-XXXXX'). */
const caseName=S=>S.c.tutorial?'the tutorial patient':'patient '+S.c.code;
function newState(ci){
  const tut=ci==='TUTORIAL',dk=tut?'easy':profile.diff,base=DIFFICULTY[dk]||DIFFICULTY.easy,ch=caseChallenge(ci,dk),c=tut?tutorialCase():{...generatePatient(ci)};
  // a severe contrast restriction halves the budget and joins the story
  if(ch.contrastX<1&&base.budgetX!=null){c.budget=Math.round(c.budget*ch.contrastX);c.budgetInTask=true;c.hx+=` Severe chronic kidney disease (eGFR ${12+(codeToSeed(ci)%14)}): every millilitre of contrast counts.`}
  buildAnatomy(c.anatomy);
  HEART_MODE=['chambers','outline','none'][base.level-1]||'outline'; // the heart sketch: labelled chambers on Easy, outline on Medium, none on Hard
  // shop perks adjust a copy of the difficulty settings
  const D={...base,tol:{...base.tol}},tq=upgradeVal('torque');D.tol.L+=tq;D.tol.R+=tq;
  return {ci,c,D,ch,forced:ch.forced,diff:dk,budget:caseBudget(c,base),lesions:prepLesions(c.lesions),clock:0,phase:0,hr:72,hrT:72,a:0,b:0,cath:{s:0,th:CATH.JL.home,hub:CATH.JL.home,w:0,type:'JL'},twist:0,exch:0,
    cL:0,cR:0,cRoot:0,hist:{L:[],R:[],root:[]},histN:0,contrast:0,ak:0,ftime:0,ctime:0,blind:0,wasted:0,
    cine:null,runs:[],marks:[],pending:null,review:null,imgAcc:0,frame:0,deepInj:0,rcaInj:0,complication:null,done:false,
    sysP:128,diaP:74,beatMax:0,beatMin:999,pci:null,stents:[],balloons:[],mapped:new Set(),events:[],drugs:[],ffr:[],pdRatio:null,hrDip:0,bpDip:0,isch:0,effusion:0,tamponade:false,pcT:0,pcCount:0,protamine:false,seals:[],prevEng:null,prevDeep:false,
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

function startCase(ci,opt={}){
  if(typeof renderCoach==='function')setTimeout(renderCoach,0);
  if(typeof close3D==='function')close3D();
  S=newState(ci);S.daily=!!opt.daily&&ci===dailyCode();document.body.classList.remove('inmenu','inreport');
  $('startOv').hidden=true;$('resultOv').hidden=true;closeReview();
  const c=S.c;$('caseHead').innerHTML=`<h2>${S.c.code?'Random patient · '+S.c.code:'Patient · '+caseName(S)} · ${S.D.label}</h2><b>${c.title}</b><p>${c.pt}. ${c.hx}</p><p class="task">${caseTask(c,DIFFICULTY[S.diff])}</p>`;
  ictx.fillStyle=PAPER;ictx.fillRect(0,0,W,W);
  syncArm();renderRuns();renderMarks();renderPending();renderPCI(true);renderWho();
  toast(`Sheath in the right femoral artery. ${keyName('Hold Space','Hold Fluoro')} for X-ray and ${keyName('↑','Advance')} to advance.`);
}

/* ---------- input ---------- */
const GAME_KEYS=new Set(['Space','KeyJ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD','KeyC','KeyF','KeyB','KeyX']);
window.addEventListener('keydown',e=>{
  if(e.target&&(e.target.tagName==='INPUT'&&e.target.type!=='range'))return;
  if(e.target&&e.target.type==='range'&&e.code.startsWith('Arrow'))return;
  if(GAME_KEYS.has(e.code)||/^Digit[1-7]$/.test(e.code)){if(S&&!S.done)e.preventDefault()}else return;
  if(e.repeat)return;
  if(e.code==='KeyC'){toggleCine();return}
  if(e.code==='KeyX'){if(S&&!S.done)exchangeTo(S.cath.type==='JL'?'JR':'JL');return}
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
$('b3d').addEventListener('click',()=>{if(S&&!S.done&&S.D.level<3)open3D(false)});
const down=(...ks)=>ks.some(k=>keys[k]||keys['btn_'+k]);

function exchangeTo(type){
  if(!S||S.done||S.exch>0||type===S.cath.type)return;
  if(S.pci){toast('Finish or cancel the PCI first.');return}
  // a long exchange wire is parked in the aorta, so this works from anywhere short of an engaged ostium
  if(S.cs&&S.cs.eng){S.cath.s=Math.min(S.cath.s,S_ROOT);toast('Backed out of the ostium. Exchanging catheter over a 0.035" wire…')}
  else toast('Exchanging catheter over a 0.035" wire…');
  S.exch=1.6;
}
$('cathToggle').addEventListener('click',e=>{const b=e.target.closest('button[data-cath]');if(b)exchangeTo(b.dataset.cath)});


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
  return {t:f.t,phase:f.phase,a:run.a,b:run.b,mode:'cine',frame:f.frame,lesions:run.lesState||S.lesions,pci:f.pci,events:f.ev,cath:true,cathState:cst(f.cath),
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
function sizeHemo(){dpr=Math.min(2,window.devicePixelRatio||1);const w=Math.max(200,Math.round(hemo.clientWidth*dpr)),h=Math.round(HEMO_H*dpr);hemo.width=w;hemo.height=h;HB={p:new Float32Array(w).fill(NaN),pd:new Float32Array(w).fill(NaN)};for(const l of LEADS)HB[l]=new Float32Array(w).fill(NaN);hx=0}
window.addEventListener('resize',sizeHemo);
const gs=(x,m,s)=>Math.exp(-((x-m)*(x-m))/(2*s*s));
/* One beat of an ECG lead: st = ST shift (+ elevation, − depression), twi = inverted T wave, amp = QRS size. */
function ecgAt(ph,st=0,twi=false,amp=1){
  const t=twi?-0.22:0.28;
  return 0.1*gs(ph,0.03,0.016)-0.1*gs(ph,0.085,0.006)+amp*gs(ph,0.1,0.007)-0.26*gs(ph,0.115,0.008)
    +st*0.34*(gs(ph,0.2,0.05)+0.6*gs(ph,0.27,0.05))+(t+0.25*Math.max(0,st))*gs(ph,0.33,0.04);
}
const LEAD_AMP={II:1,V3:0.85,V5:1.1};
function pressAt(ph,damped,drop=0){
  const x=((ph-0.14)%1+1)%1;let s;
  if(x<0.12)s=Math.sin(x/0.12*Math.PI/2);else if(x<0.32)s=1-(x-0.12)/0.2*0.36;else if(x<0.36)s=0.62+0.07*Math.sin((x-0.32)/0.04*Math.PI);else s=0.62*Math.exp(-(x-0.36)*3.2)-0.08*(x-0.36)/0.64;
  return damped?62+30*Math.pow(Math.max(0,s),1.6):74-drop*0.45+(54-drop)*s;
}
function hemoStep(dt,ph0,ph1,damped){
  if(!HB)return;const speed=105*dpr;const n=Math.max(0,Math.round(dt*speed));const len=HB.p.length;
  for(let j=1;j<=n;j++){let ph=ph0+(((ph1-ph0+1)%1))*j/n;ph%=1;
    for(const l of LEADS)HB[l][hx]=ecgAt(ph,S?S.st[l]:0,S?S.twi.has(l):false,LEAD_AMP[l]);
    HB.p[hx]=pressAt(ph,damped,S?S.bpDrop||0:0);HB.pd[hx]=S&&S.pdRatio!=null?HB.p[hx]*S.pdRatio:NaN;hx=(hx+1)%len;
    for(let g=0;g<14*dpr;g++){const k=(hx+g)%len;HB.p[k]=NaN;HB.pd[k]=NaN;for(const l of LEADS)HB[l][k]=NaN}}
}
function drawHemo(){
  if(!HB)return;const w=hemo.width,h=hemo.height;hctx.clearRect(0,0,w,h);
  const rowH=h*0.19,pTop=h*0.62,pBot=h-6*dpr,pm=v=>pBot-(v/160)*(pBot-pTop);
  // ECG paper: fine pink grid with heavier lines every fifth square
  const sq=6*dpr;for(let x=0,n=0;x<w;x+=sq,n++){hctx.strokeStyle=n%5?'rgba(226,120,110,0.16)':'rgba(226,120,110,0.38)';hctx.lineWidth=n%5?1:1.4;hctx.beginPath();hctx.moveTo(x,0);hctx.lineTo(x,h);hctx.stroke()}
  for(let y=0,n=0;y<h;y+=sq,n++){hctx.strokeStyle=n%5?'rgba(226,120,110,0.16)':'rgba(226,120,110,0.38)';hctx.lineWidth=n%5?1:1.4;hctx.beginPath();hctx.moveTo(0,y);hctx.lineTo(w,y);hctx.stroke()}
  hctx.strokeStyle='rgba(43,42,51,0.18)';hctx.setLineDash([4*dpr,4*dpr]);
  for(const v of [40,80,120]){hctx.beginPath();hctx.moveTo(0,pm(v));hctx.lineTo(w,pm(v));hctx.stroke()}hctx.setLineDash([]);
  const trace=(arr,map,col)=>{hctx.strokeStyle=col;hctx.lineWidth=1.5*dpr;hctx.beginPath();let pen=false;for(let x=0;x<w;x++){const v=arr[x];if(isNaN(v)){pen=false;continue}const y=map(v);pen?hctx.lineTo(x,y):hctx.moveTo(x,y);pen=true}hctx.stroke()};
  hctx.font=`${14*dpr}px "Patrick Hand", "Kalam", cursive`;
  LEADS.forEach((l,i)=>{const base=rowH*(i+0.72);trace(HB[l],v=>base-v*rowH*0.62,'#2b2a33');hctx.fillStyle='#2b2a33';hctx.fillText(l,6*dpr,rowH*i+12*dpr);
    const stv=S?S.st[l]:0;if(Math.abs(stv)>0.25){hctx.fillStyle=stv>0?'#c2452d':'#2f5d8a';hctx.fillText(`ST ${stv>0?'↑':'↓'} ${(Math.abs(stv)*2).toFixed(1)} mm`,26*dpr,rowH*i+12*dpr)}});
  trace(HB.p,pm,'#c2452d');trace(HB.pd,pm,'#2f5d8a');
  if(S&&S.pdRatio!=null){hctx.fillStyle='#2f5d8a';hctx.fillText(`Pd/Pa ${S.pdRatio.toFixed(2)}`,6*dpr,pTop+24*dpr)}
  hctx.fillStyle='#c2452d';hctx.fillText('AO 0–160',6*dpr,pTop+8*dpr);
  const hr=S?Math.round(S.hr):72,sp=S?Math.round(S.sysP):128,dp=S?Math.round(S.diaP):74;
  hctx.textAlign='right';hctx.font=`700 ${18*dpr}px "Kalam", "Patrick Hand", cursive`;hctx.fillStyle='#2b2a33';hctx.fillText('HR '+hr,w-8*dpr,16*dpr);
  hctx.fillStyle='#c2452d';hctx.fillText(`${sp}/${dp} (${Math.round(dp+(sp-dp)/3)})`,w-8*dpr,pTop+10*dpr);hctx.textAlign='left';
}

/* ---------- PCI: wire, balloon, stent ---------- */
const INFLATE_RATE=2.8; // atm per second while Inflate is held (12 atm takes about 4 s)
function pciRender(){
  if(!S)return null;const P=S.pci;
  return {stents:S.stents.map(s=>({vid:s.vid,ld:s.ld,len:s.len,diam:s.diam})),
    wire:P&&P.wire>0?{vid:P.vid,frac:Math.min(1,P.wire)}:null,
    balloon:P&&P.stage==='positioned'?{vid:P.vid,ld:P.ld,len:P.len,diam:P.diam,inflate:P.atm/14}:null};
}
function canTreat(m){const sys=VBY[m.vid].sys;return !!(S&&S.cs&&S.cs.eng===sys&&!S.cs.deep&&!S.complication&&!S.done)}
function startPCI(mi,opt){startPCIAt(S.marks[mi],opt)}
function startPCIAt(m,opt={}){
  if(!canTreat(m)){toast(`Engage the ${VBY[m.vid].sys==='L'?'left':'right'} coronary first.`);return}
  const closed=S.events.some(e=>e.kind==='dissection'&&e.closed&&!e.treated&&e.vid===m.vid);
  S.pci={vid:m.vid,ld:m.ld,mark:m.ld,label:m.label,stage:'wire',wire:0,kind:null,diam:3.0,len:18,atm:0,maxAtm:0,slow:closed,ffr:!!opt.ffr,hyperT:0,reading:null};
  toast(closed?'Recrossing an occluded, dissected vessel: the wire will be slow. Hold fluoro.':'Hold fluoro while the wire crosses the lesion.');renderPCI(true);
}
/* ---------- complications: dissection, no-reflow, perforation, spasm ---------- */
const evRender=()=>S.events.map(e=>({kind:e.kind,vid:e.vid,ld:e.ld,len:e.len,flow:e.flow,progress:e.progress,closed:e.closed,treated:e.treated,stain:e.stain,sev:e.sev,pool:e.pool,sealed:e.sealed,grade:e.grade}));
const EV_NAME={dissection:'Dissection',noreflow:'No-reflow',perforation:'Perforation',spasm:'Spasm'};
const isACS=()=>/STEMI/.test(S.c.title||'');
function addEvent(kind,vid,ld,cause,opt={}){
  if(!S.ch.randomX&&!S.ch.errX)return null; // Easy: no complications
  if(S.events.some(e=>e.kind===kind&&e.vid===vid&&!e.treated&&Math.abs(e.ld-ld)<15))return null;
  const v=VBY[vid];ld=clamp(ld,Math.min(4,v.len/2),Math.max(v.len/2,v.len-4));
  const ev={kind,vid,ld,len:kind==='dissection'?10:kind==='spasm'?8:0,label:segLabel(v,ld),cause,t0:S.clock,seen:false,treated:false,closed:false,progress:0,stain:0,flow:1,
    target:kind==='noreflow'?0.12+Math.random()*0.18:1,doses:[],grade:opt.grade||null,sev:opt.sev||0,sevTarget:opt.sev||0,pool:0,sealed:false,sealedBy:null,tamponT:0,temporised:false,byDrug:false};
  S.events.push(ev);
  const l=TERRITORY[vid];
  const msg=kind==='perforation'?'The patient is restless and short of breath.':kind==='spasm'?(ev.sev>0.8?`The patient has chest pain. ST rising in ${l}.`:null):`The patient has chest pain. ST rising in ${l}, BP falling.`;
  if(msg)setTimeout(()=>{if(S&&!S.done&&S.events.includes(ev)&&!ev.treated)toast(msg,true)},kind==='noreflow'?1500:kind==='perforation'?3000:400);
  renderPCI(true);return ev;
}
const coversEv=(P,e)=>P&&P.vid===e.vid&&Math.abs(P.ld-e.ld)<=P.len/2+1;
function applyDevice(){
  const P=S.pci,dev={vid:P.vid,ld:P.ld,len:P.len,diam:P.diam,atm:Math.round(P.maxAtm),label:segLabel(VBY[P.vid],P.ld),hits:[],t:S.clock};
  const diff=dev.diam-refDiam(dev.vid,dev.ld);
  if(P.kind==='stent'||P.kind==='covered'){
    for(const L of S.lesions){const o=stentOutcome(L,dev);if(o){L.cur=o.residual;L.stented=true;dev.hits.push({L,o})}}
    if(P.kind==='covered'){dev.covered=true;for(const ev of S.events)if(ev.kind==='perforation'&&!ev.sealed&&stentCovers(dev,ev)){ev.sealed=ev.treated=true;ev.sealedBy='a covered stent';ev.tx=S.clock;dev.sealed=true}}
    S.stents.push(dev);toast(dev.sealed?`Covered stent deployed: the perforation is sealed.`:`${dev.covered?'Covered stent':'Stent'} deployed: ${P.diam.toFixed(1)} × ${P.len} mm at ${dev.atm} atm.`);
    for(const ev of S.events)if(ev.kind==='spasm'&&!ev.treated&&stentCovers(dev,ev)){ev.stented=true}
    for(const ev of S.events)if(ev.kind==='dissection'&&!ev.treated&&stentCovers(dev,ev)){ev.treated=true;ev.tx=S.clock;setTimeout(()=>{if(S&&!S.done)toast(`Dissection in the ${ev.label} covered: the flap is tacked back and flow restored.`)},2900)}
    const sigHit=dev.hits.find(h=>h.L.sev>=0.7),over=dev.hits.some(h=>h.o.over);
    // perforation from an oversized stent or excess pressure, else an edge dissection beyond the stent
    const nEv=S.events.length,risk=x=>x?S.ch.errX:S.ch.randomX; // operator-caused vs chance
    if(!dev.covered&&Math.random()<perfRisk({diff,atm:dev.atm})*S.ch.errX)addEvent('perforation',dev.vid,dev.ld,diff>1?'an oversized stent':'deploying above the rated burst pressure',{grade:'major'});
    else if(Math.random()<dissectRisk({kind:'stent',over,atm:dev.atm})*risk(over||dev.atm>16))addEvent('dissection',dev.vid,dev.ld+dev.len/2+3,over?'an oversized stent':dev.atm>16?'deploying above the rated burst pressure':'stent deployment (an edge tear)');
    // no-reflow: debris and spasm in the microcirculation beyond a freshly stented, often thrombotic, lesion
    else if(sigHit&&Math.random()<noReflowRisk({acs:isACS(),sev:sigHit.L.sev,len:dev.len})*S.ch.randomX)addEvent('noreflow',dev.vid,dev.ld,'');
    // this case's set-piece complication, if it hasn't happened yet
    if(S.events.length===nEv&&!dev.covered){
      if(S.forced==='noreflow'&&sigHit&&addEvent('noreflow',dev.vid,dev.ld,''))S.forced=null;
      else if(S.forced==='dissection'&&addEvent('dissection',dev.vid,dev.ld+dev.len/2+3,'stent deployment (an edge tear)'))S.forced=null;
    }
  }else{
    for(const L of S.lesions){const o=balloonOutcome(L,dev);if(o){L.cur=o.residual;if(!o.under&&!o.lowP)L.predil=true;dev.hits.push({L,o})}}
    S.balloons.push(dev);const over=dev.hits.some(h=>h.o.over);
    const hit=dev.hits[0];
    const nEv=S.events.length,risk=x=>x?S.ch.errX:S.ch.randomX;
    if(!(hit&&hit.L.stented)&&Math.random()<perfRisk({diff,atm:dev.atm})*S.ch.errX)addEvent('perforation',dev.vid,hit?hit.L.at:dev.ld,diff>1?'an oversized balloon':'inflating above the rated burst pressure',{grade:'major'});
    else if(Math.random()<dissectRisk({kind:'balloon',over,atm:dev.atm,sev:hit?hit.L.sev:0,stented:hit&&hit.L.stented})*risk(over||dev.atm>16))addEvent('dissection',dev.vid,hit?hit.L.at:dev.ld,over?'an oversized balloon':dev.atm>16?'inflating above the rated burst pressure':'balloon angioplasty of a hard lesion');
    if(S.events.length===nEv&&S.forced==='dissection'&&hit&&!hit.L.stented&&addEvent('dissection',dev.vid,hit.L.at,'balloon angioplasty of a hard lesion'))S.forced=null;
    toast(over?'Balloon oversized: dissection flap at the lesion edge.':`Balloon ${P.diam.toFixed(1)} × ${P.len} mm inflated to ${dev.atm} atm.`,over);
  }
  P.stage='tools';P.kind=null;P.atm=0;P.maxAtm=0;P.warned=P.pain=false;P.ld=P.mark;renderPCI(true);
}
function giveDrug(id){
  const D=IC_DRUGS.find(x=>x.id===id),cs=S.cs;if(!D)return;
  if(D.iv){
    const perf=S.events.some(e=>e.kind==='perforation'&&!e.sealed);
    if(S.protamine){toast('Heparin is already reversed.');return}
    S.protamine=true;S.drugs.push({id,t:S.clock,useful:perf});for(const e of S.events)if(e.kind==='perforation'&&!e.sealed)e.prot=true;
    toast(perf?'Protamine IV: heparin reversed, the leak slows.':'Protamine IV: heparin reversed. With no bleeding to stop, a fresh stent may now clot.',!perf);renderPCI(true);return;
  }
  if(!cs||!cs.eng||cs.deep){toast('Engage the guide (not deep-seated) to give drugs into the coronary.');return}
  const nr=S.events.filter(e=>e.kind==='noreflow'&&!e.treated&&VBY[e.vid].sys===cs.eng);
  for(const e of nr){e.target=Math.min(1,e.target+D.gain);e.doses.push(D.short)}
  const sp=S.events.filter(e=>e.kind==='spasm'&&!e.treated&&VBY[e.vid].sys===cs.eng);
  if(D.spasm>0)for(const e of sp){e.sevTarget=e.sev*(1-D.spasm);e.byDrug=true;e.doses.push(D.short)}
  S.drugs.push({id,t:S.clock,useful:(nr.length>0&&D.gain>0.1)||(sp.length>0&&D.spasm>0)});
  if(D.side==='brady')S.hrDip=3.5;else S.bpDip=8;
  toast(`${D.name} into the ${cs.eng==='L'?'left':'right'} coronary.`+(D.side==='brady'?' Brief bradycardia.':' BP dips.')+(nr.length?(D.gain>0.1?' Distal flow improving.':' Little effect on the slow flow.'):'')+(sp.length&&D.spasm>0?' The narrowing is relaxing.':''));
  renderPCI(true);
}
let pciSig='';
function sizeChips(list,cur,attr,fmt,fit){return `<div class="sev">${list.map(v=>`<button data-${attr}="${v}" class="${v===cur?'sel':''}${v===fit?' fit':''}"${v===fit?' title="Best fit"':''}>${fmt(v)}</button>`).join('')}</div>`}
/* Sizing help for the device being chosen. Easy: the vessel size, the narrowing's length and a starred best fit;
   Medium: a size range and rough length, judged against the guide; Hard: the rules only. */
function sizingAdvice(P){
  const lvl=S.D.level,ref=refDiam(P.vid,P.ld),near=(list,x)=>(list.length?list:[BALLOON_DIAMS[0]]).reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a);
  const L=S.lesions.filter(l=>l.vid===P.vid&&Math.abs(l.at-P.ld)<=l.len/2+7).sort((a,b)=>Math.abs(a.at-P.ld)-Math.abs(b.at-P.ld))[0];
  const st=S.stents.find(x=>x.vid===P.vid&&Math.abs(x.ld-P.ld)<=x.len/2+2),post=P.kind==='balloon'&&!!st,len=L?L.len:8;
  let fitD,fitL,rule;
  if(P.kind==='balloon'&&P.seal){fitD=near(BALLOON_DIAMS,ref);fitL=BALLOON_LENS[0];rule='Sealing a perforation: a balloon about the vessel\'s size, inflated at low pressure (it is capped at 6 atm) over the hole.'}
  else if(post){fitD=near(BALLOON_DIAMS.filter(d=>d>=st.diam),st.diam+0.25)||st.diam;fitL=BALLOON_LENS.find(l=>l<=st.len)||BALLOON_LENS[0];
    rule=`Post-dilating the ${st.diam.toFixed(1)} mm stent: a balloon its own size or up to 0.5 mm bigger, no longer than the stent, at 14–18 atm (non-compliant). It drives the stent fully open.`}
  else if(P.kind==='balloon'){fitD=near(BALLOON_DIAMS.filter(d=>d<=ref),ref-0.5);fitL=BALLOON_LENS.find(l=>l>=len)||BALLOON_LENS[BALLOON_LENS.length-1];
    rule='Predilating: a balloon about 0.5 mm smaller than the vessel and no longer than the narrowing, at 8–12 atm. More than 0.5 mm bigger than the vessel tears it.'}
  else{fitD=near(STENT_DIAMS,ref);fitL=STENT_LENS.find(l=>l>=len+4)||STENT_LENS[STENT_LENS.length-1];
    rule=`${P.kind==='covered'?'Covered stent':'Stent'}: match the vessel (from 0.4 mm under to 0.75 mm over counts as well sized), long enough to cover the narrowing with 2–3 mm to spare each side, deployed at 12–14 atm.${L&&L.sev>=0.9&&!L.predil?' This narrowing is subtotal: predilate it with a balloon first.':''}`}
  const r4=x=>(Math.round(x*4)/4).toFixed(2).replace(/0$/,'');
  let est='';
  if(lvl===1)est=`<div>Vessel here <b>≈ ${ref.toFixed(1)} mm</b>${L?` · narrowing <b>≈ ${len} mm</b> long`:' · no tight narrowing here'}. Best fit: <b>${fitD.toFixed(1)} × ${fitL} mm</b> (★).</div>`;
  else if(lvl===2)est=`<div>Vessel here about <b>${r4(ref-0.3)}–${r4(ref+0.3)} mm</b> (about ${(ref/2).toFixed(1)}× the 2 mm guide)${L?` · narrowing roughly <b>${Math.max(4,Math.round(len/4)*4)}–${Math.round(len/4)*4+4} mm</b>`:''}.</div>`;
  return {html:`<div class="sizing">${est}<div>${rule}</div></div>`,fitD:lvl===1?fitD:null,fitL:lvl===1?fitL:null};
}
function renderPCI(force){
  const el=$('pci');
  const sig=!S?'none':JSON.stringify([S.done,S.cs&&S.cs.eng,S.cs&&S.cs.deep,S.events.map(e=>[e.seen,e.closed,e.treated,e.doses.length,e.sealed,e.temporised,Math.round(e.sev*10)]),Math.round(S.effusion*5),S.pcT>0,S.tamponade,S.protamine,S.pci&&[S.pci.stage,S.pci.kind,S.pci.diam,S.pci.len,Math.round(S.pci.ld)],S.marks.map(m=>m.vid+m.ld+canTreat(m)),S.stents.length,S.balloons.length]);
  if(!force&&sig===pciSig)return;pciSig=sig;
  if(!S){el.innerHTML='<div class="empty">Load a case to begin.</div>';return}
  const P=S.pci;let h='';
  // complications come first: what the patient shows, and once imaged, what it is and what to do
  const active=S.events.filter(e=>!e.treated&&!(e.kind==='spasm'&&!(e.sev>0.8||(e.seen&&S.D.level===1))));
  const aimBtn=(e,i)=>!P?`<button class="btn" data-rewire="${i}" ${canTreat(e)?'':'disabled'}>Wire it</button>`:P.vid===e.vid&&P.stage!=='wire'?`<button class="btn" data-aim="${i}">Aim devices here</button>`:'';
  let alerts=active.map(e=>{const i=S.events.indexOf(e),l=TERRITORY[e.vid];
    if(!e.seen)return e.kind==='perforation'?`<div class="alert"><b>Restless · BP falling · HR rising</b><span>Inject and look at the vessel you just treated.</span></div>`
      :`<div class="alert"><b>Chest pain · ST ↑ ${l}${e.kind==='spasm'?'':' · BP falling'}</b><span>Inject and look at the vessel you just ${e.kind==='spasm'?'engaged':'treated'}.</span></div>`;
    if(e.kind==='perforation')return `<div class="alert"><b>Perforation · ${e.label} · ${e.grade==='major'?'jet of contrast out of the vessel':'wire exit at the tip'}</b><span>Blood is leaking into the pericardium${e.temporised?' (slowed)':''}. ${e.grade==='major'?'Seal it with a covered stent. A low-pressure balloon inflation over the hole stops the leak while you hold it.':'Seal it with a coil, or hold a low-pressure balloon inflation over it for 15 s.'} IV protamine slows the leak.</span>${aimBtn(e,i)}</div>`;
    if(e.kind==='spasm')return `<div class="alert"><b>Spasm · ${e.label} · about ${Math.round(e.sev*100)}%</b><span>Smooth, concentric narrowing ${e.cause==='the wire'?'where the wire passed':'at the catheter tip'}, not plaque. Give intracoronary GTN${e.cause==='the wire'?'':' and ease the catheter back'}. Don't stent it.</span></div>`;
    if(e.kind==='dissection')return `<div class="alert"><b>${e.closed?'Abrupt closure':'Dissection'} · ${e.label}</b><span>${e.closed?'No flow beyond the flap. Recross it with a wire and stent it.':'Flap with contrast staining. Cover it with a stent before it closes.'}</span>${aimBtn(e,i)}</div>`;
    return `<div class="alert"><b>No-reflow · ${e.label}</b><span>Stent open, slow distal flow (${e.flow<0.35?'TIMI 1':'TIMI 2'}). Give intracoronary vasodilators below.${e.doses.length?' Given: '+e.doses.join(', ')+'.':''}</span></div>`;}).join('');
  if(S.effusion>0.3&&!S.complication)alerts=`<div class="alert"><b>${S.tamponade?'Tamponade':'Pericardial effusion'} · BP ${Math.round(S.sysP)}/${Math.round(S.diaP)}</b><span>${S.tamponade?'The heart is being squeezed by blood in the pericardium. Drain it now.':'Blood is collecting around the heart. Drain it before it tamponades.'}</span><button class="btn${S.tamponade?' primary':''}" data-pc="1" ${S.pcT>0?'disabled':''}>${S.pcT>0?'Draining…':'Pericardiocentesis'}</button></div>`+alerts;
  const eng=S.cs&&S.cs.eng&&!S.cs.deep&&!S.complication;
  const drugs=`<div class="grouplabel">Drugs</div><div class="drugs">${IC_DRUGS.map(d=>`<button class="btn" data-drug="${d.id}" title="${d.desc}" ${(d.iv?!S.complication&&!S.protamine:eng)?'':'disabled'}>${d.short}</button>`).join('')}</div>`;
  const resolved=S.events.filter(e=>e.treated).map(e=>`<div class="mark"><span>${EV_NAME[e.kind]} · ${e.label} · ${e.kind==='perforation'?'sealed':'resolved'}</span></div>`).join('');
  const log=[...S.balloons.map(b=>`Balloon ${b.diam.toFixed(1)} × ${b.len} mm · ${b.label} · ${b.atm} atm`),...S.stents.map(s=>`Stent ${s.diam.toFixed(1)} × ${s.len} mm · ${s.label} · ${s.atm} atm`)].map(t=>`<div class="mark"><span>${t}</span></div>`).join('');
  if(!P){
    if(!S.marks.length)h='<div class="empty">Mark a lesion on a cine run, then treat it here with the guide engaged.</div>';
    else{h=S.marks.map((m,i)=>`<div class="mark"><span>${i+1}. ${m.label} · ${BUCKETS[m.bucket].k}</span><span class="row"><button class="btn" data-ffr="${i}" ${canTreat(m)?'':'disabled'} title="Measure the pressure drop across it (FFR)">FFR</button><button class="btn" data-treat="${i}" ${canTreat(m)?'':'disabled'}>Wire it</button></span></div>`).join('');
      if(!S.marks.some(canTreat))h+='<div class="empty">Engage the matching coronary to treat a marked lesion.</div>'}
  }else if(P.stage==='wire'){
    h=`<div class="pending"><div>Crossing the ${P.label} with a 0.014" ${P.ffr?'pressure ':''}wire. Hold fluoro. <b id="pciWire" class="pci-read">0%</b></div><div class="row"><button class="btn" data-cancel="1">Cancel</button></div></div>`;
  }else if(P.stage==='ffr'){
    const r=P.reading;
    h=`<div class="pending"><div>Pressure wire beyond the ${P.label}. At rest the distal pressure (blue) sits just under the aortic pressure (red). Adenosine opens up the small vessels so maximal flow runs through the narrowing; the ratio of the two pressures then is the <b>FFR</b>.</div>
      ${r==null?`<div class="row"><button class="btn primary" data-hyper="1" ${P.hyperT>0?'disabled':''}>${P.hyperT>0?'Hyperaemia building…':'Give IV adenosine'}</button><button class="btn" data-finish="1">Remove wire</button></div>`
      :`<div class="ffrread ${r<=0.8?'sig':'ok'}"><b>FFR ${r.toFixed(2)}</b><span>${r<=0.8?'0.80 or less: this narrowing limits flow. Treat it.':'Above 0.80: not flow-limiting. Leave it and treat with tablets.'}</span></div>
        <div class="row">${r<=0.8?'<button class="btn primary" data-ffruse="1">Treat it with this wire</button>':''}<button class="btn${r>0.8?' primary':''}" data-finish="1">Remove wire</button></div>`}</div>`;
  }else if(P.stage==='tools'){
    h=`<div class="pending"><div>Wire across the ${P.label}. Choose a device:</div>
      <div class="tools"><button class="btn" data-tool="balloon"><b>Balloon</b><span>Angioplasty, pre- or post-dilation</span></button><button class="btn" data-tool="stent"><b>Stent</b><span>Drug-eluting stent</span></button>${S.events.some(e=>e.kind==='perforation'&&!e.sealed&&e.vid===P.vid)?'<button class="btn" data-tool="covered"><b>Covered stent</b><span>Seals a perforation</span></button>':''}${S.events.some(e=>e.kind==='perforation'&&!e.sealed&&e.grade==='distal'&&e.vid===P.vid)?'<button class="btn" data-tool="coil"><b>Coil</b><span>Plugs a distal wire perforation</span></button>':''}</div>
      <div class="row"><button class="btn" data-finish="1">Remove wire</button></div></div>`;
  }else if(P.stage==='size'){
    const isS=P.kind!=='balloon',nm=P.kind==='covered'?'covered stent':P.kind;
    const adv=sizingAdvice(P);
    h=`<div class="pending"><div>Choose the ${nm} for the ${P.label}. For scale, the 6F guide is 2 mm wide.</div>${adv.html}
      <div class="grouplabel">Diameter (mm)</div>${sizeChips(isS?STENT_DIAMS:BALLOON_DIAMS,P.diam,'d',v=>v.toFixed(1),adv.fitD)}
      <div class="grouplabel">Length (mm)</div>${sizeChips(isS?STENT_LENS:BALLOON_LENS,P.len,'l',v=>v,adv.fitL)}
      <div class="row"><button class="btn primary" data-pos="1">Position ${nm}</button><button class="btn" data-back="1">Back</button></div></div>`;
  }else if(P.stage==='positioned'){
    h=`<div class="pending"><div>${P.diam.toFixed(1)} × ${P.len} mm ${P.kind==='covered'?'covered stent':P.kind} across the ${P.label}. ${P.seal&&P.kind==='balloon'?'Sealing inflation: hold Inflate at low pressure (capped at 6 atm) over the hole; release when it is sealed.':`Line the markers up around the narrowing, then hold Inflate. ${P.kind!=='balloon'?'Deploy at 12–14 atm.':'Inflate to 8–12 atm.'}`}</div>
      <div class="row"><button class="btn" data-nudge="-2">◀ Proximal</button><button class="btn" data-nudge="2">Distal ▶</button></div>
      <div class="row"><button class="hold" data-hold="1"><span>Inflate</span><kbd>B</kbd></button><b id="pciAtm" class="pci-read">0.0 atm</b><button class="btn" data-back="1">Back</button></div></div>`;
  }
  el.innerHTML=alerts+h+(S.events.length||S.drugs.length||eng?drugs:'')+resolved+log;
}
$('pci').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!S||S.done)return;const P=S.pci,d=b.dataset;
  if(d.treat!=null)startPCI(+d.treat);
  else if(d.ffr!=null)startPCI(+d.ffr,{ffr:true});
  else if(d.hyper){if(!P.hyperT&&P.reading==null){P.hyperT=3.2;S.hrDip=1.2;toast('IV adenosine: maximal flow (hyperaemia) building… watch the blue distal pressure fall.')}}
  else if(d.ffruse){P.ffr=false;P.stage='tools';toast('The pressure wire doubles as your working wire. Choose a device.')}
  else if(d.rewire!=null){const e=S.events[+d.rewire];startPCIAt({vid:e.vid,ld:e.ld,label:e.label})}
  else if(d.drug){giveDrug(d.drug);return}
  else if(d.aim!=null){const e=S.events[+d.aim];P.mark=P.ld=e.ld;P.label=e.label;P.seal=e.kind==='perforation';toast(`Devices will be positioned at the ${e.label}.`+(P.seal?' A balloon here inflates at low pressure to seal the hole.':''))}
  else if(d.pc){if(S.pcT<=0){S.pcT=4;toast('Pericardiocentesis: needle under the xiphoid, draining the effusion…')}}
  else if(d.cancel){S.pci=null;toast('Wire withdrawn.')}
  else if(d.tool==='coil'){const e=S.events.find(x=>x.kind==='perforation'&&!x.sealed&&x.grade==='distal'&&x.vid===P.vid);if(e){e.sealed=e.treated=true;e.sealedBy='a coil';e.tx=S.clock;S.seals.push({how:'coil',label:e.label,t:S.clock});toast(`Coil deployed at the ${e.label}: the leak has stopped. The tiny vessel beyond it is sacrificed.`)}}
  else if(d.tool){P.kind=d.tool;P.stage='size';P.diam=d.tool==='balloon'?2.5:3.0;P.len=d.tool==='balloon'?15:18;if(d.tool!=='balloon')P.seal=false}
  else if(d.d)P.diam=+d.d;else if(d.l)P.len=+d.l;
  else if(d.pos){P.stage='positioned';toast(`${P.kind==='stent'?'Stent':'Balloon'} delivered over the wire. Markers show its ends.`)}
  else if(d.back){P.stage=P.stage==='positioned'?'size':'tools';P.atm=0;P.maxAtm=0}
  else if(d.nudge){const v=VBY[P.vid];P.ld=clamp(P.ld+ +d.nudge,P.len/2,v.len-2)}
  else if(d.finish){S.pci=null;toast('Wire removed.')}
  renderPCI(true);
});
$('pci').addEventListener('pointerdown',e=>{if(e.target.closest('[data-hold]')){e.preventDefault();keys.btn_KeyB=true}});
const holdUp=()=>{keys.btn_KeyB=false};window.addEventListener('pointerup',holdUp);window.addEventListener('pointercancel',holdUp);

/* ---------- main loop ---------- */
let demoPhase=0.25,last=performance.now(),saveAcc=0;
function demoFrame(){
  const cs=cathState({s:S_ROOT+22*1.02,th:OSTANG.L,type:'JL'});
  renderImage({t:10,phase:demoPhase,a:-30,b:-25,mode:'cine',frame:0,lesions:[],cath:true,cathState:cs,conc:()=>1,root:0.05});
}
function loop(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(S&&!S.done)tick(dt);else{const p0=demoPhase;demoPhase=(demoPhase+dt*72/60)%1;hemoStep(dt,p0,demoPhase,false)}
  if(toastT>0){toastT-=dt;if(toastT<=0)toastEl.hidden=true}
  drawHemo();updateUI();if(typeof tutorialTick==='function')tutorialTick();
  if(S&&!S.done){saveAcc+=dt;if(saveAcc>2){saveAcc=0;saveCase()}}
  requestAnimationFrame(loop);
}
function tick(dt){
  const c=S.cath,D=S.D;
  const ph0=S.phase;S.hr+=(S.hrT-S.hr)*Math.min(1,dt/1.2);S.phase=(S.phase+dt*S.hr/60)%1;
  // catheter handling
  let cs=cst(c);
  if(S.exch>0){S.exch-=dt;if(S.exch<=0){c.type=c.type==='JL'?'JR':'JL';c.th=c.hub=CATH[c.type].home;c.w=0;c.s=Math.min(c.s,S_ROOT);toast(`${CATH[c.type].label} is in. Same position, ready to torque.`)}}
  else if(S.pci){if(down('ArrowUp','KeyW','ArrowDown','KeyS','ArrowLeft','KeyA','ArrowRight','KeyD')&&toastT<=0)toast('The guide is holding position over the wire. Remove the wire first.')}
  else if(!S.complication){
    let moved=false;const spd=26+84*clamp((S_ROOT-10-c.s)/90,0,1); // slows smoothly approaching the root
    if(down('ArrowUp','KeyW')){c.s=Math.min(S_ROOT+22*1.6,c.s+spd*dt);moved=true}
    if(down('ArrowDown','KeyS')){c.s=Math.max(0,c.s-spd*dt);moved=true}
    const axial=down('ArrowUp','KeyW','ArrowDown','KeyS');
    if(down('ArrowRight','KeyD')){c.hub+=170*dt;moved=true}
    if(down('ArrowLeft','KeyA')){c.hub-=170*dt;moved=true}
    // torque reaches the tip through the shaft: it drags on the aortic wall (most round the arch), winds up, then lets go
    {const c0=cst(c),region=c.s<S_ARCH0?0.3:c.s<=S_ROOT?1.2:1;
     const th0=c.th;S.twist=stepTorque(c,dt,{...D.torque,fric:D.torque.fric*region,moving:axial,engaged:!!c0.eng});
     // a sudden jump of the tip is a whip: say so (once per jump)
     if(Math.abs(c.w)>260&&!S.whipT){S.whipT=1.2;toast(`Whip! The tip jumped as the stored twist let go. Turn in small steps and nudge the catheter in or out as you torque.`,true)}
     S.whipT=Math.max(0,(S.whipT||0)-dt);void th0}
    // near the ostium a preshaped Judkins tends to drop in on its own (more help on easier settings): the whole catheter turns
    if(D.seek>0){const C=CATH[c.type],c0=cst(c);if(!c0.eng&&c0.u>=0.55&&!down('ArrowLeft','KeyA','ArrowRight','KeyD')){const diff=((OSTANG[C.sys]-c.th+540)%360)-180;if(Math.abs(diff)<D.tol[C.sys]+D.seek){const d=Math.sign(diff)*Math.min(Math.abs(diff),D.seekSpeed*dt);c.th+=d;c.hub+=d}}}
    if(c.th>180)c.th-=360;if(c.th<-180)c.th+=360;
    const imaging=down('Space','KeyF')||!!S.cine;
    if(moved&&!imaging&&c.s>120){S.blind+=dt;if(S.blind>0.6&&Math.floor((S.blind-dt)/2)!==Math.floor(S.blind/2))toast('Moving the catheter without fluoro. Step on the pedal.',true)}
    cs=cst(c);
    if(cs.buckle>0.35&&toastT<=0)toast('The catheter is folding onto the aortic valve. Pull back a little and torque towards the ostium.');
  }
  S.cs=cs;
  // catheter-induced spasm: on engaging an ostium, more so the RCA, and very likely if the catheter deep-seats
  if(cs.eng&&cs.eng!==S.prevEng&&S.forced==='spasm'&&S.runs.length&&addEvent('spasm',cs.eng==='L'?'LM':'RCA',4,'the catheter',{sev:0.84+Math.random()*0.1}))S.forced=null;
  else if(cs.eng&&cs.eng!==S.prevEng&&Math.random()<spasmRisk({cause:'eng',sys:cs.eng})*S.ch.randomX)addEvent('spasm',cs.eng==='L'?'LM':'RCA',4,'the catheter',{sev:0.55+Math.random()*0.37});
  if(cs.deep&&!S.prevDeep&&Math.random()<spasmRisk({cause:'deep'})*S.ch.errX)addEvent('spasm',cs.eng==='L'?'LM':'RCA',4,'the catheter',{sev:0.75+Math.random()*0.17});
  S.prevEng=cs.eng;S.prevDeep=cs.deep;
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
  if(S.deepInj>0.45&&!S.complication&&!S.ch.errX){S.deepInj=0;toast('Damped trace! On Medium or Hard that injection would tear the ostium. Ease the catheter back.',true)}
  if(S.deepInj>0.45&&!S.complication){S.complication='Injection through a damped catheter caused an ostial dissection.';if(S.cine)stopCine();S.pci=null;toast('Ostial dissection. Stop and report.',true);renderMarks();renderPCI(true)}
  // bradycardia with RCA injection
  if(S.cR>0.7)S.rcaInj+=dt;else S.rcaInj=Math.max(0,S.rcaInj-dt*1.5);
  S.hrT=S.rcaInj>1.6?46:72;
  // complications: progression, staining, recognition, and the drugs' side effects
  for(const ev of S.events){
    const v=VBY[ev.vid],gd=v.base+ev.ld,c=histAt(S.hist[v.sys],S.clock-gd/FLOW[v.sys]),xr=down('Space','KeyF')||!!S.cine;
    if(ev.kind==='dissection'&&!ev.treated){
      if(!ev.closed){ev.progress=Math.min(1,ev.progress+dt/S.D.dissectT);if(ev.progress>=1){ev.closed=true;toast(`Abrupt closure of the ${ev.label}: no flow beyond the dissection. Rewire and stent it.`,true);renderPCI(true)}}
      ev.stain=c>0.3?Math.min(1,ev.stain+dt*0.7*c):ev.stain*Math.exp(-dt/12);
    }
    if(ev.kind==='perforation'){
      const Pp=S.pci,plug=!!(Pp&&Pp.stage==='positioned'&&Pp.kind==='balloon'&&Pp.atm>2&&coversEv(Pp,ev));
      if(!ev.sealed){
        S.effusion+=perfLeak(ev,{protamine:S.protamine,balloon:plug})*dt;
        if(plug){const t0=ev.tamponT;ev.tamponT+=dt;
          if(ev.grade==='distal'&&ev.tamponT>=15){ev.sealed=ev.treated=true;ev.sealedBy='a prolonged low-pressure balloon inflation';ev.tx=S.clock;toast(`The ${ev.label} perforation has sealed. Deflate.`);renderPCI(true)}
          else if(ev.grade==='major'&&ev.tamponT>=20&&!ev.temporised){ev.temporised=true;toast('The leak has slowed, but a hole this size needs a covered stent.');renderPCI(true)}
          else if(Math.floor(ev.tamponT/5)>Math.floor(t0/5))toast(`Balloon tamponade of the hole: ${Math.round(ev.tamponT)} s.`)}
        ev.pool+=c>0.1&&!plug?dt*c*(ev.grade==='major'?0.5:0.25):0;
      }
      ev.pool*=Math.exp(-dt/90);
    }
    if(ev.kind==='spasm'&&!ev.treated){
      // relieved by drugs, or settles by itself once the catheter or wire that provoked it is gone
      const gone=ev.cause==='the wire'?!S.pci:cs.eng!==VBY[ev.vid].sys;if(gone&&!ev.byDrug)ev.sevTarget=0;
      ev.sev+=(ev.sevTarget-ev.sev)*Math.min(1,dt/(ev.byDrug?3:14));
      if(ev.sev<0.1){ev.treated=true;ev.tx=S.clock;if(ev.seen||ev.byDrug)toast(`The spasm in the ${ev.label} has resolved.`);renderPCI(true)}
    }
    if(ev.kind==='noreflow'){ev.flow+=(ev.target-ev.flow)*Math.min(1,dt/(ev.flow>ev.target?2.5:4));if(!ev.treated&&ev.target>=0.95&&ev.flow>0.92){ev.treated=true;ev.tx=S.clock;toast(`Flow in the ${ev.label} restored. ST settling.`);renderPCI(true)}}
    if(!ev.seen&&xr&&c>0.35&&S.clock-ev.t0>1&&!ev.treated){ev.seen=true;renderPCI(true);
      const m={dissection:`Dissection: a flap with contrast staining in the ${ev.label}. Cover it with a stent before it closes.`,
        noreflow:`No-reflow: the stent in the ${ev.label} is open but contrast crawls beyond it. Give intracoronary vasodilators through the guide.`,
        perforation:`Perforation: contrast is squirting out of the ${ev.label} into the pericardium. Seal it.`,
        spasm:`Spasm: a smooth narrowing in the ${ev.label}. Intracoronary GTN should relieve it.`}[ev.kind];
      if(ev.kind!=='spasm'||ev.sev>0.8||S.D.level===1)toast(m,true)}
  }
  let isch=0,ischLead=null;for(const ev of S.events){const x=1-evFlow(ev);if(x>isch){isch=x;ischLead=TERRITORY[ev.vid]}}
  S.isch=isch;S.hrDip=Math.max(0,S.hrDip-dt);S.bpDip=Math.max(0,S.bpDip-dt);
  if(S.pcT>0){S.pcT-=dt;S.effusion=Math.max(0,S.effusion-dt*0.3);if(S.pcT<=0){S.pcCount++;for(const e of S.events)if(e.kind==='perforation'&&(!e.sealed||e.tx>S.clock-60))e.pc=(e.pc||0)+1;toast(`Pericardiocentesis: ${S.effusion<0.1?'the effusion is drained':'most of the effusion is drained'}, BP recovering.${S.events.some(e=>e.kind==='perforation'&&!e.sealed)?' It will reaccumulate until the hole is sealed.':''}`);renderPCI(true)}}
  if(S.effusion>0.8&&!S.tamponade){S.tamponade=true;toast('Tamponade: BP collapsing, HR racing. Pericardiocentesis now.',true);renderPCI(true)}
  if(S.effusion<0.5&&S.tamponade){S.tamponade=false;renderPCI(true)}
  if(S.effusion>=1.6&&!S.complication){S.complication='Untreated cardiac tamponade from a coronary perforation caused a cardiac arrest.';if(S.cine)stopCine();S.pci=null;toast('Cardiac arrest from tamponade.',true);renderMarks();renderPCI(true)}
  const tamp=clamp((S.effusion-0.2)/1.0,0,1);
  S.bpDrop=Math.min(70,isch*38+(S.bpDip>0?14:0)+tamp*55);
  if(S.hrDip>0)S.hrT=38;else if(tamp>0.4)S.hrT=104+20*tamp;else if(isch>0.5)S.hrT=ischLead==='II'?50:98;
  if(Math.floor(S.clock/4)!==Math.floor((S.clock-dt)/4)&&S.effusion>0.3)renderPCI(true);
  // PCI: wire crossing (under X-ray) and balloon inflation
  const P=S.pci,xray=down('Space','KeyF')||!!S.cine;
  if(P&&P.stage==='wire'&&xray){P.wire+=dt*(owns('wire')?1:0.5)*(P.slow?0.4:1);if(P.wire>=1){P.wire=1;P.stage=P.ffr?'ffr':'tools';toast(P.ffr?'Pressure wire across: its sensor sits beyond the narrowing. Give adenosine to read the FFR.':'Wire is across. Choose a device.');
    const v=VBY[P.vid];
    if(S.forced==='perforation'&&addEvent('perforation',P.vid,v.len-3,'the wire tip',{grade:'distal'}))S.forced=null;
    else if(Math.random()<perfRisk({kind:'wire',hydrophilic:owns('wire')})*S.ch.randomX)addEvent('perforation',P.vid,v.len-3,'the wire tip',{grade:'distal'});
    else if(Math.random()<spasmRisk({cause:'wire'})*S.ch.randomX)addEvent('spasm',P.vid,Math.min(v.len-6,P.ld+16+Math.random()*10),'the wire',{sev:0.5+Math.random()*0.35});
    renderPCI(true)}}
  if(P&&P.stage==='ffr'){
    const L=S.lesions.filter(l=>l.vid===P.vid&&Math.abs(l.at-P.mark)<=l.len/2+7)[0],sensor=L?L.at+L.len/2+6:P.mark+8;
    const truth=ffrAt(P.vid,sensor,S.lesions,true),rest=1-(1-truth)*0.3;
    if(P.hyperT>0){P.hyperT-=dt;if(P.hyperT<=0){P.hyperT=0;P.reading=Math.round(clamp(truth+(Math.random()-0.5)*0.03,0.3,1)*100)/100;
      S.ffr.push({vid:P.vid,ld:sensor,label:P.label,value:P.reading,t:S.clock});toast(`FFR ${P.reading.toFixed(2)} across the ${P.label}.`);renderPCI(true)}}
    const target=P.reading!=null?P.reading:P.hyperT>0?rest+(P.reading??truth-rest)*clamp(1-P.hyperT/3.2,0,1):rest;
    S.pdRatio=S.pdRatio==null?target:S.pdRatio+(target-S.pdRatio)*Math.min(1,dt*2);
  }else S.pdRatio=null;
  if(P&&P.stage==='positioned'){
    const sealing=P.seal&&P.kind==='balloon';
    if(down('KeyB')){P.atm=Math.min(sealing?6:18,P.atm+INFLATE_RATE*dt);P.maxAtm=Math.max(P.maxAtm,P.atm);if(P.atm>=16.5&&!P.warned){P.warned=true;toast('Above the 16 atm rated burst pressure.',true)}if(P.atm>4&&!P.pain){P.pain=true;toast(`Balloon up. Chest pain, ST rising in ${P.vid==='LM'?'V3 and V5':TERRITORY[P.vid]}.`)}}
    else if(P.atm>0){if(sealing){S.seals.push({how:'balloon',label:P.label,t:S.clock,atm:Math.round(P.maxAtm)});P.stage='tools';P.kind=null;P.atm=P.maxAtm=0;P.pain=false;toast('Balloon deflated.');renderPCI(true)}
      else if(P.maxAtm>=4)applyDevice();else{P.atm=Math.max(0,P.atm-20*dt);if(P.atm===0)P.maxAtm=0}}
  }
  // ECG territories: an inflated balloon raises ST in the lead facing that vessel, with reciprocal change elsewhere
  const tgt={II:0,V3:0,V5:0};
  if(P&&P.atm>4){const l=TERRITORY[P.vid];if(P.vid==='LM'){tgt.V3=0.8;tgt.V5=0.8;tgt.II=-0.4}else{tgt[l]=1;if(l==='V3')tgt.II=-0.35;if(l==='V5')tgt.V3=-0.5;if(l==='II')tgt.V5=-0.3}}
  for(const ev of S.events){const x=1-evFlow(ev);if(x<0.05)continue;const l=TERRITORY[ev.vid];tgt[l]=Math.max(tgt[l],1.1*x);if(l==='V3')tgt.II=Math.min(tgt.II,-0.35*x);if(l==='V5')tgt.V3=Math.min(tgt.V3,-0.5*x);if(l==='II')tgt.V5=Math.min(tgt.V5,-0.3*x)}
  for(const l of LEADS)S.st[l]+=(tgt[l]-S.st[l])*Math.min(1,dt*1.4);
  // hemodynamics
  const damped=cs.deep;
  hemoStep(dt,ph0,S.phase,damped);
  const p=pressAt(S.phase,damped,S.bpDrop||0);S.beatMax=Math.max(S.beatMax,p);S.beatMin=Math.min(S.beatMin,p);
  if(S.phase<ph0){S.sysP=S.beatMax;S.diaP=S.beatMin;S.beatMax=0;S.beatMin=999}
  // imaging
  const fl=down('Space','KeyF')&&!S.complication;const imaging=fl||!!S.cine;
  if(imaging&&S.review)closeReview();
  const f=1/Math.pow(Math.cos(S.a*D2R)*Math.cos(S.b*D2R),1.5);
  const doseX=1;
  if(S.cine){S.ak+=165/60*dt*f*doseX;S.ctime+=dt}else if(fl){S.ak+=17/60*dt*f*doseX;S.ftime+=dt}
  S.imgAcc+=dt;
  if(S.review){if(S.review.playing){S.review.acc+=dt;if(S.review.acc>=1/15){S.review.acc=0;S.review.idx=(S.review.idx+1)%S.review.run.frames.length;drawReview()}}}
  else if(imaging&&S.imgAcc>=1/15){
    S.imgAcc=0;S.frame++;
    const rt0=performance.now();renderImage({t:S.clock,phase:S.phase,a:S.a,b:S.b,mode:S.cine?'cine':'fluoro',frame:S.frame,lesions:S.lesions,pci:pciRender(),events:evRender(),cath:true,cathState:cs,wire:S.exch>0,conc:(sys,t)=>histAt(S.hist[sys],t),root:histAt(S.hist.root,S.clock)});if(!document.hidden)noteRenderTime(performance.now()-rt0);
    if(S.cine){S.cine.frames.push({t:S.clock,phase:S.phase,frame:S.frame,cath:{...c},pci:pciRender(),ev:evRender()});if(S.cine.frames.length>=90)stopCine()}
    // coverage: any segment that filled with contrast counts towards a complete study
    if(lastProj){for(const Pv of lastProj.projV){for(let i=0;i<Pv.v.n;i+=2)if(Pv.cs[i]>0.45)S.mapped.add(mapKey(Pv.v,Pv.v.ld[i]))}}
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
  hudTL.textContent=`${caseName(S).toUpperCase()} · ${S.c.pt}\n${R?angLabel(R.run.a,R.run.b):angLabel(S.a,S.b)}`;
  hudTR.innerHTML=R?`<span class="act">REVIEW · RUN ${R.run.id}</span>\nfr ${R.idx+1}/${R.run.frames.length}`:cine?`<span class="act">● CINE 15 f/s</span>\n${(S.cine.frames.length/15).toFixed(1)} s`:fl?'<span class="act">FLUORO 15 p/s</span>':(S.frame?'LIH':'NO IMAGE');
  hudBL.textContent=R?'Click a narrowing to mark it':(S.frame?'':TOUCH?'Hold Fluoro for X-ray':'Hold Space for fluoro');
  hudBR.textContent=`AK ${Math.round(S.ak)} mGy\n${Math.round(S.contrast)} mL`;
  uiAcc++;if(uiAcc%6)return;
  $('rdFT').querySelector('b').textContent=fmtT(S.ftime);
  $('rdAK').querySelector('b').innerHTML=`${Math.round(S.ak)}<small>mGy</small>`;$('rdAK').classList.toggle('hot',S.ak>800);
  $('rdCM').querySelector('b').innerHTML=`${Math.round(S.contrast)}<small>${S.budget==null?'mL':'/ '+S.budget+' mL'}</small>`;$('rdCM').classList.toggle('hot',S.budget!=null&&S.contrast>S.budget);
  $('rdHD').querySelector('b').innerHTML=`${Math.round(S.hr)}<small>${Math.round(S.sysP)}/${Math.round(S.diaP)}</small>`;$('rdHD').classList.toggle('hot',S.hr<55||(S.cs&&S.cs.deep));
  {const b=$('b3d'),off=!S||S.done||S.D.level>=3;if(b.disabled!==off){b.disabled=off;b.title=S&&S.D.level>=3?'No 3D help on Hard':'An orbitable 3D model of this patient\'s heart and coronaries (anatomy only during the case)'}}
  $('cathType').textContent=S.exch>0?'Exchanging…':(S.pci?'6F guide':'6F');
  {const tgt=S.exch>0?(S.cath.type==='JL'?'JR':'JL'):S.cath.type,lock=S.exch>0||!!S.complication||!!S.pci;
   for(const b of $('cathToggle').querySelectorAll('button')){const on=b.dataset.cath===tgt;if(b.getAttribute('aria-pressed')!==String(on))b.setAttribute('aria-pressed',on);b.disabled=lock&&!on;b.classList.toggle('busy',on&&S.exch>0)}}
  const st=$('status');const cs=S.cs||{};let cls='',msg='';
  if(S.complication){cls='danger';msg=S.complication+' Finish the study to see your report.'}
  else if(S.exch>0){msg='Exchanging catheter over a 0.035" wire…'}
  else if(S.pci){cls='ok';msg={wire:'Crossing the lesion with a 0.014" wire. Keep fluoro on.',tools:'Wire across. Choose a balloon or a stent.',size:'Pick the diameter and length.',positioned:'Device in place. Check its position on fluoro, then hold Inflate.'}[S.pci.stage]}
  else if(cs.deep){cls='danger';msg='Pressure damped: catheter deep-seated. Withdraw slightly before you inject.'}
  else if(cs.eng){cls='ok';msg=`Engaged ${cs.eng==='L'?'left main':'right coronary'} ostium. Pressure normal. Start cine, then inject.`}
  else if(cs.buckle>0.3){cls='danger';msg='Prolapsing: the tip is folding onto the aortic valve. Withdraw a little, then torque towards the ostium.'}
  else if(cs.u>0){cls='warn';const need=CATH[S.cath.type].sys,tw=Math.round(S.twist||0);msg=`In the aortic root, ${CATH[S.cath.type].label} tip at ${Math.round(S.cath.th)}°. Torque to find the ${need==='L'?'left main':'right coronary'} ostium; a short test puff shows where you are.`+(Math.abs(tw)>6?` ${Math.abs(tw)}° of twist stored in the shaft: nudge the catheter in or out to let it reach the tip, or it may whip.`:'')}
  else{msg=`${cs.region||'Femoral sheath'} · ${Math.round(S.cath.s)} mm inserted.`}
  st.className='status '+cls;st.textContent=msg;
  document.querySelectorAll('#presets button').forEach(b=>b.disabled=!!S.cine);
  $('sA').disabled=$('sB').disabled=!!S.cine;
  renderPCI();
}

/* ---------- scoring and coffee tokens ---------- */
$('bFinish').addEventListener('click',finish);
/* Where the treatment points went: each lesion's share, what was lost and why, and every penalty. */
function txBreakdown(){
  const B=S.txb;if(!B)return '';
  const f=p=>p==null?'':(p>0?'+':p<0?'−':'')+Math.abs(p).toFixed(1);
  return `<div class="txb"><div class="grouplabel" style="grid-column:1/-1">Treatment breakdown</div>${B.lines.map(l=>`<span class="${l.cls==='sub'?'sub':''}">${l.label}</span><span class="v ${l.pts==null?'':l.pts<0||l.cls==='minus'?'minus':l.cls==='plus'?'plus':''}">${f(l.pts)}</span>`).join('')}
    <span class="tot">Treatment total${B.raw<0?' (below 0 counts as 0)':B.raw>15?' (capped at 15)':''}</span><span class="v tot">${B.total.toFixed(1)} / 15</span></div>`;
}
/* Estimated flow in each diseased vessel at the start and at the end of the case. */
function flowReport(){
  const ids=[];for(const L of S.lesions)if(L.sev>=0.5&&!ids.includes(L.vid))ids.push(L.vid);
  for(const e of S.events)if(e.kind!=='perforation'&&!ids.includes(e.vid))ids.push(e.vid);
  if(!ids.length)return '';
  const pct=f=>Math.round(f*100),ffr=f=>Math.min(1,f).toFixed(2);
  const rows=ids.map(id=>{
    const pre=vesselFlow(id,S.lesions.map(L=>({...L,cur:null})),null,false),post=vesselFlow(id,S.lesions,S.events,true),d=pct(post.f)-pct(pre.f);
    const verdict=d>=15?`up ${d} points`:d<=-5?`down ${-d} points`:'no real change';
    return `<div class="flow"><b>${VBY[id].name}</b><span class="bar" role="img" aria-label="${pct(pre.f)}% before, ${pct(post.f)}% after"><i class="pre" style="width:${pct(pre.f)}%"></i><i class="post" style="width:${pct(post.f)}%"></i></span>
      <span class="fx">${pct(pre.f)}% → <strong>${pct(post.f)}%</strong> of normal · FFR ≈ ${ffr(pre.f)} → ${ffr(post.f)} · TIMI ${pre.timi} → ${post.timi} · ${verdict}</span></div>`}).join('');
  return `<div class="flows"><div class="grouplabel">Flow in each diseased vessel (estimates)</div>${rows}
    <div class="fine">Maximal flow as a share of a normal vessel, estimated from the remaining narrowing (about what an FFR wire would read; ischaemic below 0.80), with any complication left at the end. Pale bar: before, ink bar: after. Teaching model.</div></div>`;
}
function finish(){
  if(!S||S.done)return;clearSave();if(S.cine)stopCine();closeReview();S.done=true;S.pci=null;
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
      else if(S.mapped.has(mapKey(VBY[L.vid],L.at))){lesPts+=per*0.3;notes.push({c:'',t:`Seen but not marked: the ${Math.round(L.sev*100)}% ${L.label} filled with contrast on your images (30% credit).${viewNote}`})}
      else notes.push({c:'bad',t:`Missed: ${Math.round(L.sev*100)}% ${L.label}.${viewNote}`});
    }else if(mi>=0){used.add(mi);const m=S.marks[mi];if(m.bucket===0)notes.push({c:'good',t:`${Math.round(L.sev*100)}% ${L.label}: correctly called non-significant.`});else{lesPts-=8;notes.push({c:'bad',t:`Overcalled: ${L.label} is about ${Math.round(L.sev*100)}%, you graded it ${BUCKETS[m.bucket].k}.${viewNote}`})}}
  }
  const fp=S.marks.filter((m,i)=>!used.has(i)).length;
  if(fp){lesPts-=6*fp;notes.push({c:'bad',t:`${fp} mark${fp>1?'s':''} on normal vessel.`})}
  lesPts=clamp(lesPts,0,35);rows.push(['Lesion detection and grading',lesPts,35]);
  // treatment, itemised: each significant lesion is worth an equal share of 15; device and complication penalties follow
  // what needs treating: anything 70% or more, and intermediate (50–69%) narrowings only if they limit flow (FFR ≤ 0.80)
  // a lesion you measured is judged on your reading (that is what you acted on); otherwise on its true FFR
  const pre=S.lesions.map(L=>({...L,cur:null})),measured=L=>S.ffr.filter(f=>f.vid===L.vid&&Math.abs(f.ld-(L.at+L.len/2+6))<14).pop();
  const ffrOf=L=>{const m=measured(L);return m?m.value:lesionFFR(L,pre)},needs=L=>L.sev>=0.7||(L.sev>=0.5&&ffrOf(L)<=0.8);
  for(const L of S.lesions)if(L.sev>=0.5&&L.sev<0.7){const f=ffrOf(L),m=measured(L),st=S.stents.some(s=>s.hits.some(h=>h.L===L));
    if(f>0.8&&!st)notes.push({c:m?'good':'',t:m?`Intermediate ${Math.round(L.sev*100)}% ${L.label}: FFR ${m.value.toFixed(2)}, correctly left alone.`:`Intermediate ${Math.round(L.sev*100)}% ${L.label}: left alone, rightly. A pressure wire would have read about ${f.toFixed(2)} and proved it.`});
    else if(f<=0.8)notes.push({c:m?'good':'',t:`Intermediate ${Math.round(L.sev*100)}% ${L.label} limits flow (FFR about ${f.toFixed(2)}${m?`, you measured ${m.value.toFixed(2)}`:''}), so it needed treating.${m?'':' Measure intermediate narrowings with the pressure wire (FFR button) instead of judging them by eye.'}`})}
  const targets=S.lesions.filter(needs);let tx=0;const perT=15/Math.max(1,targets.length),txb=[];
  const T=(label,pts,cls)=>{txb.push({label,pts,cls});tx+=pts};
  const near=(list,x)=>list.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a);
  if(!targets.length)T('No lesion needed treatment',15,'plus');
  for(const L of targets){
    const head=`${Math.round(L.sev*100)}% ${L.label} (worth ${perT.toFixed(1)})`;
    const sh=[];for(const s of S.stents)for(const h of s.hits)if(h.L===L)sh.push({s,o:h.o});
    const bh=[];for(const b of S.balloons)for(const h of b.hits)if(h.L===L)bh.push({b,o:h.o});
    if(!sh.length&&!bh.length){txb.push({label:head,pts:0,cls:'minus'});txb.push({label:'Not treated: wire it, predilate if subtotal, then stent',pts:null,cls:'sub'});notes.push({c:'bad',t:`Not treated: the ${Math.round(L.sev*100)}% ${L.label} needed treatment.`});continue}
    if(!sh.length){T(head,perT*0.4,'');txb.push({label:`Balloon only: recoil left ${Math.round(L.cur*100)}% (−${(perT*0.6).toFixed(1)}); a stent gives a durable result`,pts:null,cls:'sub'});notes.push({c:'',t:`Balloon angioplasty only on the ${L.label}: residual ${Math.round(L.cur*100)}% from elastic recoil. A stent gives a durable result.`});continue}
    const {s,o}=sh[sh.length-1],ded=[];
    const fitD=near(STENT_DIAMS,o.refD),fitL=STENT_LENS.find(l=>l>=L.len+4)||STENT_LENS[STENT_LENS.length-1];
    if(!o.covered)ded.push([0.3,`didn't cover the whole narrowing (${L.len} mm long): use ${fitL} mm, centred on it`]);
    if(o.under)ded.push([0.25,`undersized: ${s.diam.toFixed(1)} mm in a ~${o.refD.toFixed(1)} mm vessel (a ${fitD.toFixed(1)} mm stent fits)`]);
    if(o.over)ded.push([0.2,`oversized: ${s.diam.toFixed(1)} mm in a ~${o.refD.toFixed(1)} mm vessel (a ${fitD.toFixed(1)} mm stent fits)`]);
    if(o.lowP)ded.push([0.15,`deployed at only ${s.atm} atm: 12–14 atm expands it fully`]);
    if(o.noPre)ded.push([0.15,'subtotal narrowing stented without predilating it with a balloon first']);
    const frac=Math.max(0.2,1-ded.reduce((a,d)=>a+d[0],0)),post=bh.some(x=>x.o.post);
    T(head,perT*frac,ded.length?'':'plus');
    txb.push({label:`Stent ${s.diam.toFixed(1)} × ${s.len} mm at ${s.atm} atm${post?', post-dilated':''}: residual ${Math.round(L.cur*100)}%${ded.length?'':' · well sized and placed'}`,pts:null,cls:'sub'});
    for(const d of ded)txb.push({label:`−${(perT*d[0]).toFixed(1)} ${d[1]}`,pts:null,cls:'sub'});
    notes.push({c:ded.length?'':'good',t:`Stented ${L.label}: ${s.diam.toFixed(1)} × ${s.len} mm at ${s.atm} atm${post?', post-dilated':''}, residual ${Math.round(L.cur*100)}%.`+(ded.length?' But '+ded.map(d=>d[1]).join('; ')+'.':` Well sized for a ~${o.refD.toFixed(1)} mm vessel.`)});
  }
  for(const s of S.stents){if(s.sealed&&!s.hits.length)continue;if(!s.hits.some(h=>needs(h.L))){const L=s.hits[0]&&s.hits[0].L,fx=L&&L.sev>=0.5?` (FFR ${ffrOf(L).toFixed(2)})`:'';T(`Unnecessary stent in the ${s.label}${fx}`,-8,'minus');notes.push({c:'bad',t:`Unnecessary stent in the ${s.label}: ${L?(L.sev>=0.5?`a ${Math.round(L.sev*100)}% narrowing with an FFR of about ${ffrOf(L).toFixed(2)} does not limit flow. Measure intermediate narrowings before stenting them.`:'that lesion was not flow-limiting.'):'there was no lesion there.'}`})}else if(s.hits.some(h=>h.o.over))T(`Oversized stent in the ${s.label} (edge dissection risk)`,-4,'minus')}
  for(const b of S.balloons){if(b.hits.some(h=>h.o.over)){T(`Oversized balloon in the ${b.label} (${b.diam.toFixed(1)} mm)`,-4,'minus');notes.push({c:'bad',t:`Oversized balloon in the ${b.label} (${b.diam.toFixed(1)} mm)${S.ch.errX?' caused an edge dissection.':': on Medium or Hard that tears the vessel.'}`})}if(!b.hits.some(h=>needs(h.L))&&!b.hits.some(h=>h.o.post)){T(`Unnecessary balloon inflation in the ${b.label}`,-4,'minus');notes.push({c:'bad',t:`Unnecessary balloon inflation in the ${b.label}.`})}}
  for(const sy of new Set(S.stents.map(s=>VBY[s.vid].sys))){const t=Math.max(...S.stents.filter(s=>VBY[s.vid].sys===sy).map(s=>s.t));if(!S.runs.some(r=>r.sys===sy&&r.t0>t))notes.push({c:'',t:`Record a final cine run of the ${sy==='L'?'left':'right'} system after stenting to confirm the result.`})}
  // complications during the case
  let capEv=100;
  for(const e of S.events){
    const when=fmtT(e.t0);
    if(e.kind==='dissection'){
      const cause=e.cause?` after ${e.cause}`:'';
      if(e.treated)notes.push({c:'good',t:`Dissection in the ${e.label} at ${when}${cause}: ${e.seen?'recognised and ':''}covered with a stent${e.closed?' after it had closed the vessel':''}. Bailout stenting is the right response.`});
      else if(e.closed){T(`Dissection left closing the ${e.label} (score capped at 45)`,-10,'minus');capEv=45;notes.push({c:'bad',t:`Abrupt closure of the ${e.label}: the dissection${cause} progressed and occluded the vessel. Recross it with a wire and stent it; a closed vessel means an infarct.`})}
      else{T(`Untreated dissection in the ${e.label}`,-6,'minus');notes.push({c:'bad',t:`Untreated dissection in the ${e.label}${cause}. It can close the vessel after you leave the lab: cover it with a stent.`})}
    }else if(e.kind==='perforation'){
      const what=e.grade==='major'?`Perforation of the ${e.label} after ${e.cause}`:`Distal wire perforation of the ${e.label}`;
      if(e.sealed)notes.push({c:'good',t:`${what} at ${when}: sealed with ${e.sealedBy}${e.prot?', heparin reversed with protamine':''}${e.pc?`, effusion drained by pericardiocentesis${e.pc>1?' ×'+e.pc:''}`:''}.`});
      else{T(`Unsealed perforation of the ${e.label} (score capped at 45)`,-8,'minus');capEv=Math.min(capEv,45);notes.push({c:'bad',t:`${what} was never sealed: it keeps bleeding into the pericardium. ${e.grade==='major'?'A covered stent':'A coil or a 15 s low-pressure balloon inflation'} seals it; protamine and pericardiocentesis only buy time.`})}
    }else if(e.kind==='spasm'){
      const nearMark=S.marks.some(m=>m.vid===e.vid&&Math.abs(m.ld-e.ld)<10&&!S.lesions.some(L=>L.vid===m.vid&&Math.abs(m.ld-L.at)<=L.len/2+7));
      const by=e.cause==='the wire'?'the wire':'the catheter tip';
      if(e.stented)notes.push({c:'bad',t:`The stent in the ${e.label} went into spasm, not plaque. Spasm is smooth and concentric and melts away with intracoronary GTN: give it before you treat.`});
      else if(e.treated&&e.byDrug)notes.push({c:'good',t:`Spasm from ${by} in the ${e.label} at ${when}: relieved with ${e.doses.join(', ')} and rightly left unstented.`});
      else if(e.treated)notes.push({c:'',t:`Spasm from ${by} in the ${e.label} at ${when} settled by itself. Intracoronary GTN relieves it at once and tells spasm from plaque.`});
      else notes.push({c:'',t:`Spasm from ${by} in the ${e.label} was still there at the end (about ${Math.round(e.sev*100)}%). Give intracoronary GTN before grading anything near it.`});
      if(nearMark)notes.push({c:'bad',t:`Your mark in the ${e.label} was spasm, not a stenosis.`});
    }else{
      const dz=e.doses.length?` with ${e.doses.join(', ')}`:'';
      if(e.treated)notes.push({c:'good',t:`No-reflow in the ${e.label} at ${when}: ${e.seen?'recognised and ':''}treated${dz} through the guide; flow restored.`});
      else{T(`Persistent no-reflow in the ${e.label}`,-5,'minus');notes.push({c:'bad',t:`Persistent no-reflow in the ${e.label}${dz?` despite ${e.doses.join(', ')}`:''}. Give intracoronary adenosine or verapamil (repeat doses) until distal flow is brisk. GTN alone does little for the microcirculation.`})}
    }
  }
  const idle=S.drugs.filter(x=>!x.useful&&x.id!=='gtn'&&x.id!=='prot').length;if(idle)notes.push({c:'',t:`${idle} dose${idle>1?'s':''} of vasodilator given with nothing for it to treat.`});
  if(S.drugs.some(x=>x.id==='prot'&&!x.useful)){T('Protamine with nothing bleeding',-3,'minus');notes.push({c:'bad',t:'Protamine reversed the heparin with no bleeding to stop, which risks clotting a fresh stent.'})}
  const txRaw=tx;tx=clamp(tx,0,15);rows.push(['Treatment (balloon and stent)',tx,15]);
  S.txb={lines:txb,raw:txRaw,total:tx};
  // study quality
  const distinct=sys=>{const v=[];for(const r of S.runs){if(r.sys!==sys)continue;if(!v.some(o=>Math.abs(o.a-r.a)<15&&Math.abs(o.b-r.b)<15))v.push(r)}return v.length};
  const nL=distinct('L'),nR=distinct('R');
  const cov=S.mapped.size/MAP_SEGS.length,comp=(nL>=3?5:nL===2?3:nL===1?2:0)+(nR>=2?3:nR===1?2:0)+7*cov;
  rows.push([`Complete study (LCA ${nL} views, RCA ${nR} · mapped ${S.mapped.size}/${MAP_SEGS.length} segments)`,comp,15]);
  if(cov<0.8)notes.push({c:'',t:`You opacified ${Math.round(cov*100)}% of the coronary tree. Fill both systems fully to map all of it.`});
  if(nL<3)notes.push({c:'',t:'A standard left system study uses at least three or four projections: RAO caudal, RAO cranial, LAO cranial and LAO caudal.'});
  if(nR<2)notes.push({c:'',t:'Image the RCA in at least two orthogonal views, for example LAO 40° and RAO 30°.'});
  const B=S.budget;const cm=B==null?15:Math.round(15*clamp(1-(S.contrast-B)/(B*2),0,1));rows.push([`Contrast ${Math.round(S.contrast)} mL (${B==null?'no limit on Easy':'budget '+B})`,cm,15]);
  const akMax=upgradeVal('fluoro'),rad=Math.round(10*clamp(1-(S.ak-akMax)/1000,0,1));rows.push([`Air kerma ${Math.round(S.ak)} mGy (full marks to ${akMax}) · fluoro ${fmtT(S.ftime)}`,rad,10]);
  if(S.ak>akMax)notes.push({c:'',t:'Steep angles and long cine runs drive dose up. Keep runs to 3–4 seconds and collimate your pedal time.'});
  const saf=10-Math.min(10,Math.round(S.blind*2));rows.push(['Safety (catheter moved under fluoro)',saf,10]);
  let total=lesPts+tx+comp+cm+rad+saf;
  if(S.complication){total=Math.min(total,35);notes.unshift({c:'bad',t:S.complication+(/damped/.test(S.complication)?' A damped or ventricularised pressure trace means the tip is against the vessel wall. Withdraw before injecting.':' Seal a perforation early, reverse heparin, and drain the pericardium as soon as BP falls.')})}
  if(S.c.tutorial){if(S.tut)tutorialWrapUp(notes);profile.tutDone=true}else notes.push({c:'',t:`This patient on ${S.D.label}: ${S.ch.label}.`});
  if(S.c.random){notes.push({c:'',t:`Anatomy: ${S.c.anatomyNote.join('; ')}.`});notes.push({c:'',t:`Case code <b>${S.c.code}</b>: enter it under Random patient to replay this exact patient, or share it.`})}
  if(capEv<100&&total>capEv){total=capEv}
  total=Math.round(total);
  const grade=S.complication?'Complication':total>=85?'Attending standard':total>=70?'Senior fellow':total>=50?'Junior fellow':'Keep practising';
  // coffee tokens: one per 10 points, scaled by difficulty; none after a complication
  const earned=S.complication?0:Math.round(total/10*S.D.tokenX);
  profile.tokens+=earned;if(S.c.random)profile.randomDone=(profile.randomDone||0)+1;
  const daily=S.daily?recordDaily(S.complication?0:total):null;
  const key=S.diff+'-'+(S.c.random?'R':S.ci),prev=profile.best[key];if(prev==null||total>prev)profile.best[key]=total;saveProfile();renderWho();
  const ov=$('resultOv');
  ov.innerHTML=`<div class="rephead">${avatarSVG(profile.avatar,48)}<div><h1>Report · ${caseName(S)}</h1><span class="fine">${esc(profile.name)} · ${S.D.label}</span></div></div>
  <div class="score"><b>${total}</b><span>${grade}</span></div>
  <div class="tokens">${CUP} +${earned} coffee token${earned===1?'':'s'}${S.D.tokenX>1?` (×${S.D.tokenX} for ${S.D.label})`:''} · ${profile.tokens} banked${prev!=null&&total>prev?' · new best':''}</div>
  ${daily?`<div class="medalrow">${medalBadge(daily.medal)}<span><b>Today's case: ${MEDAL_NAME[daily.medal]}</b>${daily.bonus?` · +${daily.bonus} medal tokens`:''} · bronze ${MEDALS[S.diff].bronze}, silver ${MEDALS[S.diff].silver}, gold ${MEDALS[S.diff].gold} on ${S.D.label}${profile.streak&&profile.streak.n>1?` · 🔥 ${profile.streak.n}-day streak`:''}</span></div>`:''}
  <div class="rows">${rows.map(r=>`<span>${r[0]}</span><span class="v">${Math.round(r[1])} / ${r[2]}</span>`).join('')}</div>
  ${txBreakdown()}
  ${flowReport()}
  <div class="notes">${notes.map(n=>`<div class="${n.c}">${n.t}</div>`).join('')}</div>
  <div class="row"><button class="btn primary" id="rNew">New random patient</button><button class="btn" id="r3d">View in 3D</button><button class="btn" id="rAgain">Repeat this patient</button><button class="btn" id="rCases">Change difficulty</button><button class="btn" id="rMenu">Main menu</button></div>`;
  ov.hidden=false;document.body.classList.add('inreport');window.scrollTo(0,Math.max(0,$('monitor').offsetTop-8));
  $('rAgain').onclick=()=>startCase(S.ci,{daily:S.daily});
  if($('rNew'))$('rNew').onclick=()=>startCase(randomCode());
  $('r3d').onclick=()=>open3D(true);
  $('rCases').onclick=()=>showMenu('play');
  $('rMenu').onclick=()=>showMenu('home');
  renderMarks();renderPCI(true);
}

sizeHemo();showMenu();
if(profile&&profile.refunded){toast(`The monitor colour filters are gone: ${profile.refunded} coffee tokens refunded.`);delete profile.refunded;saveProfile();renderWho()}
requestAnimationFrame(loop);
