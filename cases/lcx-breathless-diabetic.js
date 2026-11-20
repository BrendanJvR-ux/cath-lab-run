/* Case 3. Editable.
   pt/hx/task: what the player reads. budget: contrast (mL) for full marks.
   lesions: vid = vessel id from config/config.js, at = mm from that vessel's start,
   len = lesion length (mm), sev = true diameter stenosis (0–1),
   e = direction the plaque bulges from (an eccentric lesion looks mild when viewed along e). */
"use strict";
CASES.push({
  title:'Breathless on exertion',
  pt:'M, 71',
  hx:'Diabetic, dyspnoea after one flight of stairs. Echo: lateral hypokinesis, EF 50%. eGFR 48, so keep contrast to a minimum.',
  task:'Map all disease, significant or not.',
  budgetInTask:true, // adds "Aim for under N mL of contrast." when the difficulty has a contrast limit
  budget:50,
  ecg:{twi:['V5']},
  lesions:[{vid:'LCx',at:31,len:10,sev:0.76,e:[0,1,0.2]},{vid:'LAD',at:52,len:8,sev:0.38,e:[1,0,0]}]});
