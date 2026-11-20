/* Case 1. Editable.
   pt/hx/task: what the player reads. budget: contrast (mL) for full marks.
   lesions: vid = vessel id from config/config.js, at = mm from that vessel's start,
   len = lesion length (mm), sev = true diameter stenosis (0–1),
   e = direction the plaque bulges from (an eccentric lesion looks mild when viewed along e). */
"use strict";
CASES.push({
  title:'Exertional chest pain',
  pt:'M, 64',
  hx:'Two months of chest tightness walking uphill, relieved by rest. Treadmill: 2 mm anterior ST depression at 6 METs. Creatinine 88 µmol/L.',
  task:'Image both coronary systems and report any significant stenosis.',
  budget:80,
  lesions:[{vid:'LAD',at:13,len:9,sev:0.82,e:[1,0.3,-0.2]}]});
