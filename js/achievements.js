/* Cath Lab Run: achievements, play streak and skill grade.
   - Play streak: consecutive days on which you completed at least one case (finished it to the report). Any case
     counts except the tutorial; the streak never affects the grade.
   - Skill grade: the average, over every case you have completed, of your score adjusted for difficulty (Hard counts
     for more than Easy, Story for less). It is provisional until three cases.
   - Achievements: checked when a case is completed; each pays coffee tokens once. */
"use strict";
const DIFF_WEIGHT={story:0.55,easy:0.75,medium:1,hard:1.2};
const GRADES=[[0,'E','Observer'],[30,'D','Trainee'],[45,'C','Competent'],[58,'B','Skilled'],[70,'A','Expert'],[82,'S','Master'],[92,'S+','Legend']];
const COMP_KINDS=['dissection','noreflow','perforation','spasm'];
const ACHIEVEMENTS=[
  {id:'first',icon:'1',name:'First case',desc:'Complete any case.',t:5,test:c=>true},
  {id:'stent',icon:'◎',name:'Opened up',desc:'Put a stent in a narrowing for the first time.',t:5,test:c=>c.opened>0},
  {id:'sweep',icon:'✓',name:'Clean sweep',desc:'Open every badly narrowed artery in a case.',t:10,test:c=>c.sig>0&&c.opened===c.sig&&!c.S.complication},
  {id:'eye',icon:'◉',name:'Sharp eye',desc:'Find and grade every significant narrowing correctly in one case.',t:10,test:c=>c.sigAll>0&&c.graded===c.sigAll},
  {id:'s80',icon:'★',name:'Top marks',desc:'Score 80 or more.',t:10,test:c=>c.score>=80},
  {id:'s95',icon:'✦',name:'Near perfect',desc:'Score 95 or more.',t:25,test:c=>c.score>=95},
  {id:'hard',icon:'▲',name:'Hard as nails',desc:'Score 60 or more on Hard.',t:20,test:c=>c.diff==='hard'&&c.score>=60},
  {id:'dye',icon:'◌',name:'Dye saver',desc:'Score 60+ using less than half the usual dye (under 40 mL without a limit).',t:10,test:c=>c.score>=60&&(c.S.budget?c.S.contrast<c.S.budget*0.5:c.S.contrast<40)},
  {id:'light',icon:'☼',name:'Light touch',desc:'Open every badly narrowed artery with under 2 minutes of X-ray.',t:15,test:c=>c.sig>0&&c.opened===c.sig&&c.S.ftime<120},
  {id:'smooth',icon:'∿',name:'Smooth operator',desc:'Score 70+ on Medium or Hard with no whip and no moving blind.',t:15,test:c=>c.level>=2&&c.score>=70&&!(c.S.whips>0)&&c.S.blind<0.6},
  {id:'ffr',icon:'⌁',name:'Under pressure',desc:'Measure a narrowing with the pressure wire (FFR).',t:5,test:c=>c.S.ffr.length>0},
  {id:'defer',icon:'⊘',name:'Hands off',desc:'Leave a narrowing alone after the pressure wire shows it is not limiting flow.',t:10,test:c=>c.S.ffr.some(f=>f.value>0.8&&!c.S.stents.some(s=>s.vid===f.vid&&Math.abs(s.ld-f.ld)<25))},
  {id:'cool',icon:'❄',name:'Cool head',desc:'Manage every complication in a case.',t:15,test:c=>c.comps.length>0&&c.comps.every(e=>e.treated||e.sealed)&&!c.S.complication},
  {id:'allcomp',icon:'✚',name:'Seen it all',desc:'Manage a dissection, a no-reflow, a perforation and a spasm (across any cases).',t:30,test:(c,p)=>COMP_KINDS.every(k=>p.ach.comp[k])},
  {id:'d2b',icon:'⏱',name:'Door to balloon',desc:'Open a STEMI within 90 minutes.',t:15,test:c=>c.S.d2b&&c.S.reperfAt!=null&&c.S.reperfAt<=90},
  {id:'golden',icon:'⧗',name:'Golden hour',desc:'Open a STEMI within 60 minutes.',t:25,test:c=>c.S.d2b&&c.S.reperfAt!=null&&c.S.reperfAt<=60},
  {id:'gold',icon:'●',name:'Gold standard',desc:'Win gold on today’s case.',t:15,test:c=>c.daily&&c.daily.medal==='gold'},
  {id:'all4',icon:'◆',name:'All-rounder',desc:'Score 60+ on Story, Easy, Medium and Hard.',t:25,test:(c,p)=>['story','easy','medium','hard'].every(d=>p.ach.diff60[d])},
  {id:'st3',icon:'3',name:'Three in a row',desc:'Complete a case three days running.',t:10,test:(c,p)=>p.streak.n>=3},
  {id:'st7',icon:'7',name:'Week of shifts',desc:'Complete a case seven days running.',t:25,test:(c,p)=>p.streak.n>=7},
  {id:'st30',icon:'30',name:'Part of the furniture',desc:'Complete a case thirty days running.',t:60,test:(c,p)=>p.streak.n>=30},
  {id:'wk1',icon:'W',name:'Challenge accepted',desc:'Complete a weekly challenge.',t:10,test:c=>!!c.S.weekly},
  {id:'wk4',icon:'W4',name:'Weekly regular',desc:'Complete the weekly challenge in four different weeks.',t:30,test:(c,p)=>(p.weeklyHist||[]).length>=4},
  {id:'wkgold',icon:'W★',name:'Challenge champion',desc:'Win gold on a weekly challenge.',t:25,test:c=>!!c.S.weekly&&c.score>=MEDALS.medium.gold},
  {id:'rare1',icon:'✎',name:'Curiosity',desc:'Treat a rare patient (a new casebook page).',t:15,test:c=>!!c.S.c.rare},
  {id:'rareall',icon:'✎6',name:'The full casebook',desc:'Treat every kind of rare patient.',t:60,test:(c,p)=>typeof RARE_KINDS!=='undefined'&&RARE_KINDS.every(k=>p.casebook&&p.casebook.rare&&p.casebook.rare[k.id])},
  {id:'sk1',icon:'⌁B',name:'Clot buster',desc:'Restore flow in a stroke (TICI 2b or better).',t:15,test:c=>!!c.stroke&&c.stroke.tici>=2.5},
  {id:'skfpe',icon:'1×',name:'First-pass effect',desc:'Complete reperfusion (TICI 3) on the first pass in a stroke.',t:25,test:c=>!!c.stroke&&c.stroke.first===3},
  {id:'skfast',icon:'⏱B',name:'Time is brain',desc:'Restore flow within 30 minutes of the groin puncture in a stroke.',t:25,test:c=>!!c.stroke&&c.stroke.tici>=2.5&&c.stroke.gtr!=null&&c.stroke.gtr<=30},
  {id:'c10',icon:'10',name:'Regular',desc:'Complete 10 cases.',t:10,test:(c,p)=>p.stats.n>=10},
  {id:'c50',icon:'50',name:'Veteran',desc:'Complete 50 cases.',t:40,test:(c,p)=>p.stats.n>=50},
  {id:'gA',icon:'A',name:'Expert grade',desc:'Reach skill grade A.',t:30,test:(c,p)=>gradeOf(p).ok&&gradeOf(p).r>=70},
];
const emptyStats=()=>({n:0,sum:0,rsum:0,by:{}});
function ensureAch(p){
  p.stats=p.stats||emptyStats();p.streak=p.streak||{n:0};p.ach=p.ach||{};
  p.ach.got=p.ach.got||{};p.ach.comp=p.ach.comp||{};p.ach.diff60=p.ach.diff60||{};
  return p;
}
/* the skill grade: difficulty-adjusted average over every completed case */
function gradeOf(p){
  const st=(p&&p.stats)||emptyStats();if(!st.n)return {ok:false,n:0,r:0,avg:0,letter:'–',title:'No cases yet'};
  const r=st.rsum/st.n,avg=st.sum/st.n;let g=GRADES[0];for(const x of GRADES)if(r>=x[0])g=x;
  return {ok:st.n>=3,n:st.n,r,avg,letter:g[1],title:g[2],next:GRADES[GRADES.indexOf(g)+1]||null};
}
const dayKey=off=>dateKey(new Date(Date.now()-off*864e5));
/* is the streak still alive (played today or yesterday)? */
function streakNow(p){const s=(p&&p.streak)||{n:0};return s.last===dayKey(0)||s.last===dayKey(1)?s.n:0}
/* record a completed case; returns what changed for the report */
function recordCase(c){
  const p=ensureAch(profile),before=gradeOf(p),today=dayKey(0);
  // streak: counts once per day, for any completed case
  const s=p.streak;let streakUp=false;
  if(s.last!==today){s.n=s.last===dayKey(1)?s.n+1:1;s.last=today;s.best=Math.max(s.best||0,s.n);streakUp=true}
  // stats for the grade (the streak plays no part)
  const score=Math.max(0,c.score),r=Math.min(100,score*(DIFF_WEIGHT[c.diff]||1));
  p.stats.n++;p.stats.sum+=score;p.stats.rsum+=r;
  const b=p.stats.by[c.diff]=p.stats.by[c.diff]||{n:0,sum:0,best:0};b.n++;b.sum+=score;b.best=Math.max(b.best,score);
  // cross-case progress
  for(const e of c.comps)if(e.treated||e.sealed)p.ach.comp[e.kind]=true;
  if(score>=60)p.ach.diff60[c.diff]=true;
  // unlocks
  const fresh=[];
  for(const a of ACHIEVEMENTS){if(p.ach.got[a.id])continue;let ok=false;try{ok=!!a.test(c,p)}catch(e){}
    if(ok){p.ach.got[a.id]=today;p.tokens+=a.t;fresh.push(a)}}
  saveProfile();if(typeof renderWho==='function')renderWho();
  const after=gradeOf(p);
  return {fresh,streak:s.n,streakUp,before,after};
}
/* the report section: new achievements, the streak and the grade */
function achReportHTML(res){
  if(!res)return '';
  const g=res.after,moved=res.before.letter!==g.letter&&g.ok;
  return `<div class="achrep">
    ${res.fresh.length?`<div class="achnew">${res.fresh.map(a=>`<div class="badge got"><i>${a.icon}</i><span><b>${a.name}</b>${a.desc} · +${a.t} tokens</span></div>`).join('')}</div>`:''}
    <div class="achline"><span>🔥 ${res.streak}-day streak${res.streakUp&&res.streak>1?' · kept going':''}</span>
    <span>Skill grade <b>${g.ok?g.letter:'–'}</b> ${g.ok?g.title:`(provisional: ${g.n} of 3 cases)`}${moved?' · new grade':''}</span>
    <span>Average ${Math.round(g.avg)} · rating ${Math.round(g.r)} over ${g.n} case${g.n===1?'':'s'}</span></div></div>`;
}
/* the Achievements screen on the menu */
function achView(){
  const p=ensureAch(profile),g=gradeOf(p),st=p.stats,got=ACHIEVEMENTS.filter(a=>p.ach.got[a.id]).length,sn=streakNow(p);
  const nxt=g.next?`${Math.max(1,Math.ceil(g.next[0]-g.r))} rating points to ${g.next[1]} (${g.next[2]})`:'The top grade';
  const rows=['story','easy','medium','hard'].map(d=>{const b=st.by[d];return `<tr><td>${DIFFICULTY[d].label}</td><td>${b?b.n:0}</td><td>${b?Math.round(b.sum/b.n):'–'}</td><td>${b?b.best:'–'}</td><td>×${DIFF_WEIGHT[d]}</td></tr>`}).join('');
  return `<h1>Achievements</h1>
    <div class="achtop">
      <div class="gradecard"><span class="grouplabel">Skill grade</span><b class="letter">${g.ok?g.letter:'–'}</b><span class="gtitle">${g.ok?g.title:g.n?`Provisional: ${g.n} of 3 cases`:'Complete a case to get graded'}</span>
        <span class="fine">Rating ${Math.round(g.r)} · average score ${Math.round(g.avg)} over ${g.n} case${g.n===1?'':'s'}. ${g.ok?nxt+'.':''}</span></div>
      <div class="gradecard"><span class="grouplabel">Streak</span><b class="letter">${sn}</b><span class="gtitle">${sn===1?'day':'days'} in a row</span>
        <span class="fine">Best ${p.streak.best||0}. Complete any case each day to keep it going${p.streak.last===dayKey(1)?': play today to keep it':''}. The streak does not affect your grade.</span></div>
    </div>
    <table class="gradetab"><thead><tr><th>Difficulty</th><th>Cases</th><th>Average</th><th>Best</th><th>Counts</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="fine">The grade is the average of every completed case, with each score multiplied by its difficulty (shown under Counts, capped at 100). Grades: ${GRADES.map(x=>`${x[1]} ${x[2]} (${x[0]}+)`).join(' · ')}. The tutorial does not count.</p>
    <div class="grouplabel">Badges · ${got} of ${ACHIEVEMENTS.length}</div>
    <div class="badges">${ACHIEVEMENTS.map(a=>{const d=p.ach.got[a.id];return `<div class="badge${d?' got':''}"><i>${d?a.icon:'?'}</i><span><b>${a.name}</b>${a.desc}<small>${d?'Earned '+d:'+'+a.t+' tokens'}</small></span></div>`}).join('')}</div>
    <div class="row"><button class="btn" data-act="home">Back</button></div>`;
}
