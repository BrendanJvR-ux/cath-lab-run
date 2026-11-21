/* Cath Lab Run: random patients. Every patient comes from a seed, written as a short case code (CLR-XXXXX),
   so the same code always gives the same anatomy, lesions and history. Needs config.js and sim.js. */
"use strict";
const CODE_ABC='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function seedToCode(n){let s='';for(let i=0;i<5;i++){s=CODE_ABC[n%CODE_ABC.length]+s;n=Math.floor(n/CODE_ABC.length)}return 'CLR-'+s}
function codeToSeed(code){
  const m=String(code||'').toUpperCase().replace(/\s/g,'').replace(/^CLR-?/,'');if(!/^[A-Z2-9]{5}$/.test(m))return null;
  let n=0;for(const ch of m){const i=CODE_ABC.indexOf(ch);if(i<0)return null;n=n*CODE_ABC.length+i}return n;
}
const CODE_SPACE=Math.pow(CODE_ABC.length,5);
function randomCode(){return seedToCode(Math.floor(Math.random()*CODE_SPACE))}

/* Where lesions may sit: vessel, range along it (fraction of length), and how often it's chosen. */
const LESION_SITES=[['LAD',0.06,0.6,5],['RCA',0.08,0.75,4],['LCx',0.1,0.6,3],['D1',0.08,0.4,1.2],['OM1',0.1,0.45,1.2],['RI',0.1,0.45,1],['OM2',0.1,0.4,0.5],['PDA',0.1,0.4,0.5],['LPDA',0.1,0.4,0.5]];
const REGION={II:'inferior',V3:'anterior',V5:'lateral'};

function describeAnatomy(sp){
  const out=[{R:'right-dominant',L:'left-dominant: the circumflex gives the posterior descending artery and the RCA is small',C:'co-dominant: the RCA gives the posterior descending, the circumflex a posterolateral branch'}[sp.dom]];
  if(sp.ramus)out.push('a ramus intermedius between the LAD and circumflex');
  if(sp.shortLM)out.push('a short left main');
  if(sp.rca==='anterior')out.push('an anteriorly placed RCA origin');
  if(sp.rca==='posterior')out.push('a posteriorly placed RCA origin (more clockwise torque)');
  if(sp.d1==='large')out.push('a large first diagonal');
  if(sp.d1==='small')out.push('a small first diagonal');
  if(!sp.om2)out.push('a single obtuse marginal');
  return out;
}

function generatePatient(code){
  const seed=codeToSeed(code);if(seed==null)return null;
  const R=mulberry32(seed*2654435761>>>0),rnd=(a,b)=>a+(b-a)*R(),pick=a=>a[Math.floor(R()*a.length)],chance=p=>R()<p;
  for(let i=0;i<3;i++)R();
  // anatomy
  const u=R(),anatomy={dom:u<0.78?'R':u<0.89?'L':'C',ramus:chance(0.2),shortLM:chance(0.12),
    rca:(v=>v<0.7?'normal':v<0.85?'anterior':'posterior')(R()),d1:(v=>v<0.6?'normal':v<0.85?'large':'small')(R()),
    om2:chance(0.75),tort:{seed:Math.round(rnd(0,40)*10)/10,amp:Math.round(rnd(0.7,1.45)*100)/100}};
  buildAnatomy(anatomy);
  // lesions
  const sites=LESION_SITES.filter(s=>VBY[s[0]]),wsum=sites.reduce((a,s)=>a+s[3],0);
  const lesions=[];
  const place=(sevLo,sevHi,minDiam)=>{
    for(let tries=0;tries<80;tries++){
      let w=R()*wsum,s=sites[0];for(const x of sites){w-=x[3];if(w<=0){s=x;break}}
      const v=VBY[s[0]],mm=v.len*rnd(s[1],s[2]);
      if(refDiam(v.id,mm)<minDiam)continue;
      if(lesions.some(L=>L.vid===v.id&&Math.abs(L.at*TREE_SCALE-mm)<22))continue;
      const e=[rnd(-1,1),rnd(-1,1),rnd(-1,1)];if(Math.hypot(...e)<0.2)e[2]=1;
      const L={vid:v.id,at:Math.round(mm/TREE_SCALE*10)/10,len:Math.round(rnd(7,16)),sev:Math.round(rnd(sevLo,sevHi)*100)/100,e:e.map(x=>Math.round(x*100)/100)};
      lesions.push(L);return L;
    }
    return null;
  };
  const nSig=chance(0.3)?2:1,nMild=(v=>v<0.45?0:v<0.85?1:2)(R());
  const culprit=place(0.72,0.96,2.4)||(lesions.push({vid:'LAD',at:16,len:10,sev:0.8,e:[1,0.2,0.3]}),lesions[lesions.length-1]);
  if(nSig>1)place(0.7,0.88,2.4);
  for(let i=0;i<nMild;i++)chance(0.35)?place(0.52,0.66,2.2):place(0.28,0.46,2.0);
  // presentation follows the culprit's territory
  const lead=TERRITORY[culprit.vid],region=REGION[lead],male=chance(0.66),age=Math.round(rnd(44,83));
  const risks=['smoker','ex-smoker','diabetic','hypertensive','high cholesterol','family history of early heart disease','overweight'].filter(()=>chance(0.35)).slice(0,3);
  const riskTxt=risks.length?risks.join(', ').replace(/^./,c=>c.toUpperCase())+'. ':'';
  const renal=chance(0.2),acs=culprit.sev>=0.88&&chance(0.65);
  let title,hx,ecg=null;
  if(acs){
    title=region[0].toUpperCase()+region.slice(1)+' NSTEMI';
    const tw={II:'II, III and aVF',V3:'V2–V4',V5:'V5, V6, I and aVL'}[lead];
    hx=`${riskTxt}${pick(['Three','Four','Six','Eight'])} hours of ${pick(['rest pain','crushing central chest pain','chest tightness at rest'])}, rising troponin, T-wave inversion in ${tw}. Settled on nitrates and heparin.`;
    ecg={twi:[lead]};
  }else{
    title=pick(['Exertional chest pain','Angina despite tablets','Positive stress test','Breathless on exertion','Chest pain on hills']);
    const test=pick([`Treadmill: ${pick(['1','1.5','2','2.5'])} mm ST depression at ${pick(['5','6','7','8'])} METs.`,`Stress perfusion scan: reversible ${region} defect.`,`Stress echo: ${region} wall motion abnormality at peak stress.`]);
    hx=`${riskTxt}${pick(['Three','Four','Six'])} months of ${pick(['chest tightness walking uphill','breathlessness and chest pressure on exertion','jaw and arm ache on exertion'])}, relieved by rest. ${test}`;
    if(chance(0.25))ecg={twi:[lead]};
  }
  if(renal)hx+=` eGFR ${Math.round(rnd(34,52))}, so keep contrast to a minimum.`;
  const extra=lesions.length>nSig;
  const task=acs?(extra?'Find the culprit lesion and treat it. Report any other disease you see.':'Find the culprit lesion and treat it.')
    :(extra?'Map all disease, significant or not, and treat only what is significant.':'Find the significant stenosis and treat it.');
  const budget=renal?50:70+10*(nSig-1)+5*(lesions.length-nSig);
  return {code:seedToCode(seed),random:true,title,pt:(male?'M':'F')+', '+age,hx,task,budget,budgetInTask:renal,ecg,lesions,anatomy,anatomyNote:describeAnatomy(buildAnatomy(anatomy))};
}

/* What a case throws at you on a difficulty, fixed by the case code and the difficulty (so a shared code plays the
   same). randomX scales complications that strike by chance; errX scales those caused by the operator (oversizing,
   over-pressure, deep-seating, damped injections); forced = a complication that will happen at the first chance;
   contrastX scales the contrast budget (0.5 = severe restriction). */
const CHALLENGE_KINDS=['dissection','noreflow','perforation','spasm','dissection','noreflow'];
function caseChallenge(code,diffKey){
  const seed=codeToSeed(code)||0,R=mulberry32((seed*31+({easy:1,medium:2,hard:3}[diffKey]||2)*7919)>>>0);R();R();
  const pick=()=>CHALLENGE_KINDS[Math.floor(R()*CHALLENGE_KINDS.length)];
  if(diffKey==='easy')return {randomX:0,errX:0,forced:null,contrastX:1,label:'no complications'};
  if(diffKey==='medium'){const prone=R()<0.35,forced=prone&&R()<0.6?pick():null;
    return {randomX:prone?1.4:0,errX:1,forced,contrastX:1,label:prone?'complication-prone':'straightforward'}}
  const r=R(),comp=r<0.7,severe=r<0.15||(r>=0.7&&r<0.92);
  return {randomX:comp?2:0.6,errX:1,forced:comp?pick():null,contrastX:severe?0.5:1,label:[comp&&'complication-prone',severe&&'severe contrast restriction'].filter(Boolean).join(' and ')||'straightforward'};
}

/* ---------- daily case ----------
   One patient a day, the same for everyone: the case code comes from the local date. */
const dateKey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function dailyCode(key=dateKey()){let h=2166136261;for(const ch of 'cathlab:'+key){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0}return seedToCode(h%CODE_SPACE)}
/* medal thresholds by difficulty (score out of 100) and the tokens each medal pays */
const MEDALS={easy:{gold:92,silver:80,bronze:65},medium:{gold:85,silver:72,bronze:58},hard:{gold:78,silver:65,bronze:50}};
const MEDAL_TOKENS={gold:20,silver:10,bronze:5},MEDAL_RANK={none:0,bronze:1,silver:2,gold:3};
function medalFor(score,diffKey){const m=MEDALS[diffKey]||MEDALS.medium;return score>=m.gold?'gold':score>=m.silver?'silver':score>=m.bronze?'bronze':'none'}
