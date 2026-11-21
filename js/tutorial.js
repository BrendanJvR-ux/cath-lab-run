/* Cath Lab Run: a short play-through tutorial on a fixed, complication-free patient. A coach card under the
   monitor gives one step at a time; each step finishes when the player actually does it, and the control it needs
   is highlighted. How much it explains depends on the experience the player gave (profile.exp):
   0 = new to angiography, 1 = some experience, 2 = experienced (only this game's controls). Needs game.js. */
"use strict";
const EXPERIENCE=[
  {k:0,name:'New to angiography',desc:'I have not seen or done a coronary angiogram. Show me everything.',diff:'easy'},
  {k:1,name:'Some experience',desc:'I have watched or assisted with angiograms. Show me how the game works.',diff:'easy'},
  {k:2,name:'Experienced',desc:'I do angiograms or PCI. Just show me the controls.',diff:'medium'},
];
/* the tutorial patient: usual anatomy, one clear proximal LAD stenosis that shows in most views */
function tutorialCase(){
  return {code:'TUTORIAL',tutorial:true,random:false,title:'Tutorial: exertional chest pain',pt:'M, 62',
    hx:'Two months of chest tightness walking uphill, relieved by rest. Treadmill: 2 mm anterior ST depression.',
    task:'Follow the coach under the monitor, one step at a time.',budget:80,ecg:null,
    lesions:[{vid:'LAD',at:14,len:10,sev:0.82,e:[0.2,0.1,1]}],anatomy:{},anatomyNote:['right-dominant, usual anatomy']};
}
const lViews=S=>{const v=[];for(const r of S.runs){if(r.sys!=='L')continue;if(!v.some(o=>Math.abs(o.a-r.a)<15&&Math.abs(o.b-r.b)<15))v.push(r)}return v.length};
/* steps: who = which experience levels get the step; text[exp] (falls back to the nearest lower one) */
const TUT_STEPS=[
  {id:'look',who:[0,1],hl:'#bFluoro',title:'Switch on the X-ray',
   text:['This square is the fluoroscopy monitor: a live X-ray of the chest. Underneath run the ECG and the aortic pressure from the catheter tip. Hold <kbd>Space</kbd> (or the Fluoro pedal) to switch the X-ray on. Fluoro gives radiation, so only use it when you are moving or looking.',
         'Hold <kbd>Space</kbd> (Fluoro pedal) for live X-ray. Dose counts towards your score.'],
   done:S=>S.ftime>0.6},
  {id:'advance',who:[0,1,2],hl:'[data-k="ArrowUp"]',title:'Advance the catheter',
   text:['The catheter starts in the femoral artery at the groin. With fluoro on, hold <kbd>↑</kbd> (Advance) to push it up the descending aorta, over the arch and down into the aortic root, just above the aortic valve. It slows down by itself as it nears the root.',
         'With fluoro on, hold <kbd>↑</kbd> to advance up the aorta, over the arch, into the root.',
         '<kbd>↑</kbd>/<kbd>↓</kbd> advance and withdraw (fluoro on, or it counts against you). Femoral access, 6F JL4 to start.'],
   done:S=>S.cs&&S.cs.u>0.25},
  {id:'engage',who:[0,1,2],hl:'[data-k="ArrowRight"]',title:'Engage the left main',
   text:['The two coronary arteries leave the aortic root just above the valve: the left main from the left side, the right coronary from the right. The JL4 catheter is shaped for the left. Turn it with <kbd>←</kbd> <kbd>→</kbd> (torque) while advancing gently; when the tip is close it drops into the opening (the ostium). The status line says "Engaged" and the pressure trace stays normal.',
         'Torque with <kbd>←</kbd> <kbd>→</kbd> until the JL4 drops into the left main. The status line confirms it; keep the pressure trace normal.',
         'Torque with <kbd>←</kbd>/<kbd>→</kbd>. On Medium and Hard the shaft stores twist against the aortic wall and can whip: turn in small steps and nudge in or out. Switch to JR4 for the RCA with the catheter toggle or <kbd>X</kbd>.'],
   done:S=>S.cs&&S.cs.eng==='L'},
  {id:'cine',who:[0,1,2],hl:'#bCine',title:'Record a cine run',
   text:['A cine run is a recorded X-ray movie. Press <kbd>C</kbd> to start recording, hold <kbd>J</kbd> for about a second to inject contrast (X-ray dye) into the left coronary, watch it fill the arteries, then press <kbd>C</kbd> to stop. Contrast is limited on harder levels, so short puffs are best.',
         'Press <kbd>C</kbd> to record, hold <kbd>J</kbd> about a second to inject, then <kbd>C</kbd> to stop.',
         '<kbd>C</kbd> start/stop cine, hold <kbd>J</kbd> to inject. Contrast and dose are scored.'],
   done:S=>S.runs.some(r=>r.sys==='L')},
  {id:'views',who:[0,1],hl:'#presets',title:'Take a second view',
   text:['The X-ray is a flat shadow, so arteries overlap and a narrowing can look mild from one side and tight from another. Pick another C-arm angle from the presets (try RAO 30 CAU 25 or LAO 45 CRA 25) and record a second run. Real studies use four or more views of the left system.',
         'Pick another C-arm preset and record a second run: eccentric narrowings can look mild in one view and tight in another.'],
   done:S=>lViews(S)>=2},
  {id:'mark',who:[0,1,2],hl:'#runs',title:'Find and grade the narrowing',
   text:['Open a run from Cine runs: it replays on the monitor. Scrub to a frame where the arteries are full of contrast. The LAD runs down the front of the heart; near its start there is a "waist" where the contrast column narrows. Click on it, then choose how severe it looks.',
         'Open a run, scrub to a well-filled frame, click the narrowing in the proximal LAD and grade it.',
         'Open a run in Cine runs, click the stenosis on the frame and grade it. Marks score for detection and grading.'],
   done:S=>S.marks.length>0},
  {id:'wire',who:[0,1,2],hl:'#pci',title:'Cross it with a wire',
   text:['To treat it, a very thin guidewire (0.014") goes down the catheter and across the narrowing. Make sure the catheter is still engaged, press <b>Wire it</b> next to your mark under Treatment, and hold fluoro while the wire crosses.',
         'Re-engage if needed, press <b>Wire it</b> under Treatment and hold fluoro while the wire crosses.',
         '<b>Wire it</b> under Treatment (guide engaged, fluoro on).'],
   done:S=>(S.pci&&S.pci.stage!=='wire')||S.stents.length>0},
  {id:'stent',who:[0,1,2],hl:'#pci',title:'Place a stent',
   text:['Choose <b>Stent</b>. The sizing box tells you how wide the artery is and how long the narrowing is, and stars the best fit: pick those sizes, press Position, line the markers up over the narrowing, then hold <kbd>B</kbd> (Inflate) until it reads 12 to 14 atm and let go. The stent props the artery open.',
         'Choose <b>Stent</b>, take the starred size, position it over the narrowing and hold <kbd>B</kbd> to 12–14 atm.',
         'Stent: sizing help depends on difficulty (Easy stars the best fit). Hold <kbd>B</kbd> to inflate; release to deploy.'],
   done:S=>S.stents.length>0},
  {id:'final',who:[0,1],hl:'#bCine',title:'Check the result',
   text:['Record one more cine run to check the artery is now wide open, then press <b>Remove wire</b> under Treatment.',
         'Record a final run to check the result, then <b>Remove wire</b>.'],
   done:S=>!S.pci&&S.stents.length>0&&S.runs.some(r=>r.t0>Math.max(...S.stents.map(s=>s.t)))},
  {id:'finish',who:[0,1,2],hl:'#bFinish',title:'Finish and read your report',
   text:['Press <b>Finish and report</b>. The report scores the study and the treatment, explains every point lost, estimates how much flow you restored, and lets you look at the patient in 3D.',
         'Press <b>Finish and report</b> to see your score and where points went.',
         '<b>Finish and report</b>: itemised score, flow estimates and a 3D view.'],
   done:S=>S.done},
];
const tutSteps=exp=>TUT_STEPS.filter(s=>s.who.includes(exp));
function startTutorial(){
  profile.diff=profile.diff||'easy';saveProfile();
  startCase('TUTORIAL');S.tut={exp:profile.exp??0,i:0};renderCoach();
}
function renderCoach(){
  const el=$('coach');document.querySelectorAll('.coach-hl').forEach(n=>n.classList.remove('coach-hl'));
  if(!S||!S.tut){el.hidden=true;return}
  const steps=tutSteps(S.tut.exp),st=steps[S.tut.i];
  if(!st){el.hidden=true;return}
  const txt=st.text[Math.min(S.tut.exp,st.text.length-1)];
  el.hidden=false;
  el.innerHTML=`<div class="coachhead"><b>Step ${S.tut.i+1} of ${steps.length} · ${st.title}</b><button class="btn" data-coach="skip">Skip tutorial</button></div><p>${typeof glossLink==='function'?glossLink(txt):txt}</p>
    <div class="coachdots">${steps.map((_,i)=>`<i class="${i<S.tut.i?'done':i===S.tut.i?'now':''}"></i>`).join('')}</div>`;
  const hl=document.querySelector(st.hl);if(hl)hl.classList.add('coach-hl');
}
/* called every frame from the main loop */
function tutorialTick(){
  if(!S||!S.tut)return;const steps=tutSteps(S.tut.exp),st=steps[S.tut.i];
  if(st&&st.done(S)){S.tut.i++;if(S.tut.i<steps.length)toast(`✓ ${st.title}. Next: ${steps[S.tut.i].title.toLowerCase()}.`);renderCoach()}
}
/* after the tutorial: say what to try next, and set a sensible difficulty */
function tutorialWrapUp(notes){
  const ex=EXPERIENCE[S.tut?S.tut.exp:0];profile.diff=ex.diff;
  notes.unshift({c:'good',t:`Tutorial complete. Next: a random patient on ${DIFFICULTY[ex.diff].label} (now selected). Every patient is different, and Medium and Hard add complications. You can replay the tutorial from the main menu.`});
}
$('coach').addEventListener('click',e=>{const b=e.target.closest('[data-coach]');if(!b||!S)return;if(b.dataset.coach==='skip'){S.tut=null;renderCoach();toast('Tutorial skipped. You can restart it from the main menu.')}});
