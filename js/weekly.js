/* Cath Lab Run: the weekly challenge.
   One patient a week (Monday to Sunday), the same for everyone, always on Medium, with a twist that changes how it
   plays. The patient code and the twist come from the week, so friends get the same case. Your tries this week are
   ranked, your best is kept, and the first completion each week pays a bonus. */
"use strict";
const WEEKLY_MODS=[
  {id:'dye',name:'Dye shortage',desc:'Half the usual contrast budget. Every puff counts.',prep(c,D,S){c.budget=Math.max(20,Math.round(c.budget*0.5));c.budgetInTask=true}},
  {id:'blind',name:'No shortcuts',desc:'The view presets and the 3D heart are switched off: set the camera angles yourself.',flag(S){S.noPresets=true;S.no3D=true}},
  {id:'stiff',name:'Stiff catheter',desc:'Hard catheter handling on a Medium patient: the tip grips the wall, winds up and whips, and the arteries are harder to engage.',prep(c,D){const H=DIFFICULTY.hard;D.torque={...H.torque};D.tol={L:H.tol.L+(D.tol.L-DIFFICULTY.medium.tol.L),R:H.tol.R+(D.tol.R-DIFFICULTY.medium.tol.R)};D.seek=H.seek;D.seekSpeed=H.seekSpeed}},
  {id:'two',name:'Double trouble',desc:'A patient with two badly narrowed arteries. Find and open both.',need:p=>p.lesions.filter(L=>L.sev>=0.7).length>=2},
  {id:'lowrad',name:'Low dose',desc:'Full radiation marks only up to half the usual dose. Keep the X-ray pedal light.',flag(S){S.radX=0.5}},
  {id:'stemi',name:'Heart attack in progress',desc:'A patient having a heart attack (STEMI). The door-to-balloon clock is running.',need:p=>!!(p.ecg&&p.ecg.stemi)},
];
const WEEKLY_DIFF='medium',WEEKLY_BONUS=15;
function weekKey(d=new Date()){
  const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())),day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);
  const y=t.getUTCFullYear(),wk=Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7);return y+'-W'+String(wk).padStart(2,'0');
}
const weekDaysLeft=(d=new Date())=>8-(d.getDay()||7);
const fnv=str=>{let h=2166136261;for(const ch of str){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return h};
const WCACHE=new Map();
/* the week's twist and patient (deterministic: same for everyone) */
function weeklyInfo(key=weekKey()){
  if(WCACHE.has(key))return WCACHE.get(key);
  const h=fnv('cathlab-weekly:'+key),mod=WEEKLY_MODS[h%WEEKLY_MODS.length];let code=null;
  for(let i=0;i<400;i++){const c=seedToCode((h+i*7919)%CODE_SPACE),p=patientOf(c);if(!mod.need||mod.need(p)){code=c;break}}
  if(!code)code=seedToCode(h%CODE_SPACE);
  const info={key,mod,code};WCACHE.set(key,info);return info;
}
/* this week's record for the operator */
function weeklyRec(p=profile,key=weekKey()){const w=p&&p.weekly;return w&&w.key===key?w:{key,tries:[],best:null}}
/* record a completed weekly try; returns what to show on the report */
function recordWeekly(score,key){
  const w=weeklyRec(profile,key),first=!w.tries.length,prevBest=w.best;
  w.tries=[...w.tries,score].slice(-50);w.best=Math.max(w.best??-1,score);profile.weekly=w;
  const mod=weeklyInfo(key).mod;
  const hist=(profile.weeklyHist||[]).filter(h=>h.key!==key);hist.unshift({key,mod:mod.id,best:w.best,tries:w.tries.length});profile.weeklyHist=hist.slice(0,26);
  let bonus=0;if(first){bonus=WEEKLY_BONUS;profile.tokens+=bonus}
  const rank=[...w.tries].sort((a,b)=>b-a).indexOf(score)+1;
  return {mod,score,best:w.best,newBest:prevBest!=null&&score>prevBest,tries:w.tries.length,rank,bonus,medal:medalFor(score,WEEKLY_DIFF)};
}
function weeklyReportHTML(r){
  if(!r)return '';
  return `<div class="medalrow">${medalBadge(r.medal)}<span><b>Weekly challenge · ${r.mod.name}: ${r.score}</b> · try ${r.tries}, your #${r.rank} this week · best ${r.best}${r.newBest?' (new best)':''}${r.bonus?` · +${r.bonus} tokens for this week's first try`:''}</span></div>`;
}
/* the case-select chart for the weekly folder */
function weeklyChart(){
  const info=weeklyInfo(),p=patientOf(info.code),w=weeklyRec(),th=MEDALS[WEEKLY_DIFF],left=weekDaysLeft();
  const tries=[...w.tries].sort((a,b)=>b-a).slice(0,5);
  const past=(profile.weeklyHist||[]).filter(h=>h.key!==info.key).slice(0,4).map(h=>`${h.key.replace(/^\d+-/,'')} ${(WEEKLY_MODS.find(m=>m.id===h.mod)||{}).name||''}: ${h.best}`).join(' · ');
  return `<div class="chead"><h2>This week: ${info.mod.name}</h2><span class="meta">Medium · ${left} day${left===1?'':'s'} left · ${info.code}</span></div>
    <dl><dt>Twist</dt><dd>${info.mod.desc}</dd><dt>Patient</dt><dd>${esc(p.title)} · ${esc(p.pt)}</dd><dt>History</dt><dd>${esc(p.hx)}</dd>
    <dt>Your best</dt><dd>${w.best!=null?`${w.best} (${MEDAL_NAME[medalFor(w.best,WEEKLY_DIFF)]}) · ${w.tries.length} tr${w.tries.length===1?'y':'ies'}${tries.length>1?' · top tries '+tries.join(', '):''}`:`Not tried yet. First try this week: +${WEEKLY_BONUS} tokens.`}</dd>
    <dt>Medals</dt><dd>Bronze ${th.bronze} · silver ${th.silver} · gold ${th.gold}. Everyone gets this patient and twist this week.</dd>${past?`<dt>Past weeks</dt><dd>${past}</dd>`:''}</dl>
    <button class="btn primary go" data-act="weekly">Start challenge</button>`;
}
