/* Cath Lab Run: career mode. A ladder of ranks; each rank has one goal, met by finishing cases that qualify.
   Every finished case counts towards the current goal (from the career button or not). Promotion pays tokens.
   Needs game.js and gen.js. */
"use strict";
const lc1=t=>t[0].toLowerCase()+t.slice(1);
/* r = the result of a finished case: {diff, score, stemi, d2b (minutes or null), managed (complications all
   resolved), hadComp, ffrUsed, medal} */
const CAREER=[
  {rank:'Medical student',goal:'Finish 2 Easy cases scoring 60 or more',need:2,diff:'easy',test:r=>r.diff==='easy'&&r.score>=60},
  {rank:'Junior fellow',goal:'Finish 3 Easy cases scoring 75 or more',need:3,diff:'easy',test:r=>r.diff==='easy'&&r.score>=75},
  {rank:'Fellow',goal:'Finish 2 Medium cases scoring 65 or more',need:2,diff:'medium',test:r=>(r.diff==='medium'||r.diff==='hard')&&r.score>=65},
  {rank:'Senior fellow',goal:'Open a STEMI on Medium or Hard within 90 minutes',need:1,diff:'medium',kind:'stemi',test:r=>(r.diff==='medium'||r.diff==='hard')&&r.stemi&&r.d2b!=null&&r.d2b<=90},
  {rank:'Interventional fellow',goal:'Manage a complication on Medium or Hard and still score 55 or more',need:1,diff:'medium',kind:'comp',test:r=>(r.diff==='medium'||r.diff==='hard')&&r.hadComp&&r.managed&&r.score>=55},
  {rank:'Consultant cardiologist',goal:'Finish 2 Hard cases scoring 60 or more',need:2,diff:'hard',test:r=>r.diff==='hard'&&r.score>=60},
  {rank:'Interventional consultant',goal:'Open a Hard STEMI within 90 minutes and score 60 or more',need:1,diff:'hard',kind:'stemi',test:r=>r.diff==='hard'&&r.stemi&&r.d2b!=null&&r.d2b<=90&&r.score>=60},
];
const TOP_RANK='Head of the cath lab';
const careerOf=()=>{const c=(profile&&profile.career)||{lvl:0,prog:0};return {lvl:c.lvl||0,prog:c.prog||0}};
const rankName=()=>{const c=careerOf();return c.lvl>=CAREER.length?TOP_RANK:CAREER[c.lvl].rank};
/* a patient suited to the current goal: a STEMI, or (for complications) one with a set complication on that difficulty */
function careerCode(goal){
  for(let i=0;i<600;i++){const code=randomCode();
    if(goal.kind==='stemi'){const p=generatePatient(code);if(!(p.ecg&&p.ecg.stemi))continue}
    if(goal.kind==='comp'&&!caseChallenge(code,goal.diff).forced)continue;
    return code}
  return randomCode();
}
function startCareerCase(){
  const c=careerOf();if(c.lvl>=CAREER.length){startCase(randomCode());return}
  const g=CAREER[c.lvl];profile.diff=g.diff==='easy'?'easy':(profile.diff==='hard'&&g.diff==='medium'?'hard':g.diff);saveProfile();
  startCase(careerCode(g));
}
/* count a finished case; returns notes to add to the report */
function careerRecord(r){
  const c=careerOf(),out=[];if(c.lvl>=CAREER.length)return out;
  const g=CAREER[c.lvl];
  if(g.test(r)){c.prog++;
    if(c.prog>=g.need){c.lvl++;c.prog=0;const pay=10+5*c.lvl;profile.tokens+=pay;
      out.push({c:'good',t:`Promoted to ${c.lvl>=CAREER.length?TOP_RANK:CAREER[c.lvl].rank}! +${pay} coffee tokens.${c.lvl<CAREER.length?` Next goal: ${lc1(CAREER[c.lvl].goal)}.`:' You have reached the top of the career ladder.'}`})}
    else out.push({c:'good',t:`Career: ${lc1(g.goal)} (${c.prog} of ${g.need}).`})}
  else out.push({c:'',t:`Career goal for ${g.rank}: ${lc1(g.goal)} (${c.prog} of ${g.need}). This case did not count.`});
  profile.career=c;return out;
}
function careerView(){
  const c=careerOf();
  const rows=CAREER.map((g,i)=>{const st=i<c.lvl?'done':i===c.lvl?'now':'';
    return `<div class="crow ${st}"><span class="cmark">${i<c.lvl?'✓':i===c.lvl?'▶':''}</span><div><b>${g.rank}</b><span>${g.goal}${i===c.lvl?` · ${c.prog} of ${g.need}`:''}</span></div></div>`}).join('')+
    `<div class="crow ${c.lvl>=CAREER.length?'done':''}"><span class="cmark">${c.lvl>=CAREER.length?'★':''}</span><div><b>${TOP_RANK}</b><span>The top of the ladder.</span></div></div>`;
  return `<h1>Career</h1><p>You are a <b>${rankName()}</b>. Meet each goal to be promoted: every finished case counts. Promotions pay coffee tokens.</p>
    <div class="career">${rows}</div>
    <div class="row">${c.lvl<CAREER.length?`<button class="btn primary big" data-act="careercase">Next career case (${DIFFICULTY[CAREER[c.lvl].diff].label}${CAREER[c.lvl].kind==='stemi'?', STEMI':CAREER[c.lvl].kind==='comp'?', with a complication':''})</button>`:''}<button class="btn" data-act="home">Back</button></div>`;
}
