/* Case 2. Editable.
   pt/hx/task: what the player reads. budget: contrast (mL) for full marks.
   lesions: vid = vessel id from config/config.js, at = mm from that vessel's start,
   len = lesion length (mm), sev = true diameter stenosis (0–1),
   e = direction the plaque bulges from (an eccentric lesion looks mild when viewed along e). */
"use strict";
CASES.push({
  title:'Inferior NSTEMI',
  pt:'F, 58',
  hx:'Four hours of rest pain, rising troponin, T-wave inversion in II, III and aVF. Settled on nitrates and heparin.',
  task:'Find the culprit lesion. Expect sluggish distal flow.',
  budget:80,
  lesions:[{vid:'RCA',at:52,len:8,sev:0.94,e:[0.2,0.1,1]}]});
