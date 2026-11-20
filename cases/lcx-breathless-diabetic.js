/* Case 3. Editable.
   pt/hx/task: what the player reads. budget: contrast (mL) for full marks.
   lesions: vid = vessel id from config/config.js, at = mm from that vessel's start,
   len = lesion length (mm), sev = true diameter stenosis (0–1),
   e = direction the plaque bulges from (an eccentric lesion looks mild when viewed along e). */
"use strict";
CASES.push({
  title:'Breathless on exertion',
  pt:'M, 71',
  hx:'Diabetic, dyspnoea after one flight of stairs. Echo: lateral hypokinesis, EF 50%. eGFR 48, so the contrast budget is tight.',
  task:'Map all disease, significant or not. Aim for under 50 mL of contrast.',
  budget:50,
  lesions:[{vid:'LCx',at:31,len:10,sev:0.76,e:[0,1,0.2]},{vid:'LAD',at:52,len:8,sev:0.38,e:[1,0,0]}]});
