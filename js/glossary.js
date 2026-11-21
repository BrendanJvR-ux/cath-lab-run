/* Cath Lab Run: glossary. Opened from the header (or the menu); terms in the tutorial coach link here. */
"use strict";
const GLOSSARY=[
  ['Angiography','Filming the coronary arteries with X-ray while injecting contrast into them, to find narrowings.'],
  ['PCI','Percutaneous coronary intervention: opening a narrowed coronary artery from inside, with a wire, balloon and stent, through a catheter.'],
  ['Fluoroscopy','Live, low-dose X-ray used while moving the catheter or wire. Not recorded. Fluoro on the Space bar.'],
  ['Cine','A recorded X-ray run at a higher frame rate and dose, used to diagnose. Press C to start and stop.'],
  ['Contrast','Iodine dye that blocks X-rays, so arteries filled with it show up. Too much can harm the kidneys.'],
  ['Air kerma','The radiation dose at the patient\'s skin (mGy). Steep angles and long cine runs raise it.'],
  ['Femoral access','Entering the arterial system through the femoral artery at the groin, through a sheath. The game starts here.'],
  ['Aortic root','The first part of the aorta, just above the aortic valve, where both coronary arteries start.'],
  ['Ostium','The opening of a coronary artery from the aortic root (plural ostia).'],
  ['Judkins catheter','Pre-shaped catheters for the coronaries: JL4 for the left, JR4 for the right. The number is the curve size.'],
  ['Guide catheter','The catheter that sits in the ostium during PCI and carries the wire, balloons and stents (6F here, about 2 mm wide).'],
  ['Torque','Turning the catheter at the hub so the tip rotates. The tip follows through the shaft, which can store twist.'],
  ['Whip','A sudden jump of the catheter tip when twist stored in the shaft lets go. Turn in small steps and move in or out as you torque.'],
  ['Prolapse','The catheter tip folding down onto the aortic valve when pushed on without engaging an ostium.'],
  ['Damping','A flattened pressure trace from the catheter tip, meaning it is wedged against the wall or deep in the artery. Injecting then can tear the vessel.'],
  ['Deep-seating','The catheter pushed beyond the ostium into the artery itself. Pressure damps; pull back slightly.'],
  ['Left main','The short first segment of the left coronary artery, which divides into the LAD and circumflex.'],
  ['LAD','Left anterior descending artery: runs down the front of the heart between the ventricles. Supplies the front wall and septum.'],
  ['Diagonal','A branch of the LAD running over the left ventricle\'s front wall.'],
  ['Septal','A branch of the LAD diving into the wall between the ventricles.'],
  ['Circumflex','The left coronary branch that curves round the left side of the heart in the groove between atrium and ventricle.'],
  ['Obtuse marginal','A branch of the circumflex running down the left ventricle\'s side wall.'],
  ['Ramus intermedius','A third branch of the left main, between the LAD and circumflex, in some people.'],
  ['RCA','Right coronary artery: runs round the right side of the heart. Usually supplies the bottom (inferior) wall.'],
  ['PDA','Posterior descending artery: runs along the bottom of the heart between the ventricles.'],
  ['Dominance','Which artery gives the PDA: the RCA (right-dominant, most people), the circumflex (left-dominant) or both (co-dominant).'],
  ['Stenosis','A narrowing of an artery, described as the percentage of the diameter lost.'],
  ['Eccentric lesion','A narrowing on one side of the artery: it looks tight from one angle and mild from another. Take several views.'],
  ['Projection','The angle of the C-arm: LAO or RAO (patient\'s left or right) and cranial or caudal (towards the head or feet).'],
  ['LAO','Left anterior oblique: the X-ray camera on the patient\'s left. Good for the RCA and the left main.'],
  ['RAO','Right anterior oblique: the camera on the patient\'s right. Good for the circumflex and the LAD\'s length.'],
  ['Cranial','The camera tilted towards the head. Opens up the LAD and its diagonals.'],
  ['Caudal','The camera tilted towards the feet. Opens up the left main and circumflex.'],
  ['Guidewire','A very thin (0.014 inch) wire passed across the narrowing. Balloons and stents run over it.'],
  ['Balloon angioplasty','Inflating a balloon in the narrowing to stretch it open. Alone it partly springs back (recoil).'],
  ['Predilation','Ballooning a very tight narrowing before stenting it, so the stent can open fully.'],
  ['Post-dilation','Ballooning inside a stent at high pressure to expand it fully.'],
  ['Stent','A metal mesh tube expanded inside the artery to hold it open. Drug-eluting stents slow re-narrowing.'],
  ['Covered stent','A stent lined with a membrane, used to seal a perforation.'],
  ['atm','Atmospheres: the balloon or stent inflation pressure. Stents usually 12–14 atm.'],
  ['FFR','Fractional flow reserve: the pressure beyond a narrowing divided by the aortic pressure at maximal flow. 0.80 or less means it limits flow and should be treated.'],
  ['Pressure wire','A guidewire with a pressure sensor near its tip, used to measure FFR.'],
  ['Hyperaemia','Maximal blood flow, produced with adenosine, needed for an FFR reading.'],
  ['Adenosine','A drug that opens the small vessels. IV for FFR; into the coronary for no-reflow. Brief slow heart rate.'],
  ['TIMI flow','Grade of contrast flow down an artery: 3 normal, 2 slow, 1 barely past the blockage, 0 none.'],
  ['NSTEMI','A heart attack without ST elevation: chest pain, rising troponin, often T-wave changes.'],
  ['ST elevation','A raised ST segment on the ECG: the heart muscle in that territory is short of blood right now.'],
  ['Dissection','A tear in the artery wall; a flap can narrow or close the artery. Cover it with a stent.'],
  ['No-reflow','Slow or absent flow beyond a stent that is open, from debris and spasm in the tiny vessels. Treated with vasodilators.'],
  ['Perforation','A hole through the artery wall: blood leaks into the sac round the heart.'],
  ['Tamponade','Blood in the pericardial sac squeezing the heart: blood pressure falls, heart rate rises. Drain it (pericardiocentesis).'],
  ['Pericardiocentesis','Draining fluid from round the heart with a needle under the breastbone.'],
  ['Spasm','A temporary, smooth tightening of an artery, often from the catheter or wire. Relieved by GTN.'],
  ['GTN','Glyceryl trinitrate (nitroglycerin): relaxes the arteries, relieves spasm, lowers blood pressure.'],
  ['Verapamil','A calcium-channel blocker given into the coronary for no-reflow and spasm.'],
  ['Protamine','Reverses heparin, slowing bleeding from a perforation. Risks clotting a fresh stent if given otherwise.'],
  ['eGFR','A measure of kidney function. Low values mean contrast is riskier: use as little as possible.'],
];
const GLOSS_MAP=new Map(GLOSSARY.map(([t,d])=>[t.toLowerCase(),[t,d]]));
function openGlossary(term){
  closeGlossary();
  const d=document.createElement('div');d.className='glossary';d.setAttribute('role','dialog');d.setAttribute('aria-label','Glossary');
  d.innerHTML=`<div class="glbox"><div class="glhead"><b>Glossary</b><input id="glq" type="search" placeholder="Search terms" aria-label="Search the glossary" autocomplete="off"><button class="btn" data-gl-close="1">Close</button></div><dl id="gllist"></dl></div>`;
  document.body.appendChild(d);
  const q=d.querySelector('#glq'),list=d.querySelector('#gllist');
  const draw=()=>{const f=q.value.trim().toLowerCase();list.innerHTML=GLOSSARY.filter(([t,x])=>!f||t.toLowerCase().includes(f)||x.toLowerCase().includes(f)).map(([t,x])=>`<div id="gl-${t.replace(/\W/g,'')}"><dt>${t}</dt><dd>${x}</dd></div>`).join('')||'<p class="fine">No matching term.</p>'};
  q.addEventListener('input',draw);draw();
  d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-gl-close]'))closeGlossary()});
  d.addEventListener('keydown',e=>{if(e.key==='Escape')closeGlossary()});
  if(term){const el=d.querySelector('#gl-'+term.replace(/\W/g,''));if(el){el.classList.add('hit');el.scrollIntoView({block:'center'})}}else q.focus();
}
function closeGlossary(){document.querySelectorAll('.glossary').forEach(n=>n.remove())}
/* turn the first mention of each glossary term in a piece of HTML into a link to its entry (text outside tags only) */
function glossLink(html){
  const seen=new Set(),terms=GLOSSARY.map(g=>g[0]).sort((a,b)=>b.length-a.length);
  const re=new RegExp('\\b('+terms.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\b','gi');
  return html.split(/(<[^>]+>)/).map(part=>part.startsWith('<')?part:part.replace(re,m=>{const k=m.toLowerCase();if(seen.has(k)||!GLOSS_MAP.has(k))return m;seen.add(k);return `<button class="glterm" data-gl="${GLOSS_MAP.get(k)[0]}">${m}</button>`})).join('');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-gl]');if(b){e.preventDefault();openGlossary(b.dataset.gl||null)}});
