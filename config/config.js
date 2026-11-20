/* Cath Lab Run: anatomy, catheters, C-arm presets and grading buckets.
   Coordinates are millimetres: x = patient left, y = cranial, z = anterior. */
"use strict";
const W=512, SCALE=2.85, CX=256, CY=258, D2R=Math.PI/180;
const ISO=[10,6,0], ROOT=[2,36,0], HC=[26,-4,2];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const dist3=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]};

/* Coronary tree. ctrl = control points from the ostium outward; r0/r1 = lumen radius (mm) at start/end.
   A branch starts at one of its parent's control points. */
const VESSELS=[
 {id:'LM',sys:'L',name:'left main',r0:2.3,r1:2.1,ctrl:[[12,40,-4],[17,40,-4],[22,39,-2]]},
 {id:'LAD',sys:'L',name:'LAD',parent:'LM',r0:1.9,r1:0.7,ctrl:[[22,39,-2],[27,37,9],[31,31,20],[35,19,28],[39,5,31],[43,-11,29],[47,-27,23],[50,-40,15]]},
 {id:'S1',sys:'L',name:'first septal',parent:'LAD',r0:0.6,r1:0.3,ctrl:[[28,35,13],[27,29,7],[26,21,2]]},
 {id:'D1',sys:'L',name:'first diagonal',parent:'LAD',r0:1.15,r1:0.5,ctrl:[[31,31,20],[40,28,24],[50,20,22],[58,8,17],[62,-4,12]]},
 {id:'S2',sys:'L',name:'second septal',parent:'LAD',r0:0.55,r1:0.3,ctrl:[[35,19,28],[32,12,19],[30,4,13]]},
 {id:'D2',sys:'L',name:'second diagonal',parent:'LAD',r0:0.8,r1:0.4,ctrl:[[43,-11,29],[52,-14,26],[58,-22,20]]},
 {id:'LCx',sys:'L',name:'circumflex',parent:'LM',r0:1.7,r1:0.8,ctrl:[[22,39,-2],[31,41,-11],[40,38,-21],[46,30,-30],[49,19,-37],[50,7,-41]]},
 {id:'OM1',sys:'L',name:'first obtuse marginal',parent:'LCx',r0:1.2,r1:0.5,ctrl:[[40,38,-21],[51,30,-18],[58,17,-14],[61,2,-10]]},
 {id:'OM2',sys:'L',name:'second obtuse marginal',parent:'LCx',r0:1.0,r1:0.45,ctrl:[[49,19,-37],[56,10,-33],[58,-2,-28]]},
 {id:'RCA',sys:'R',name:'RCA',r0:2.0,r1:1.2,ctrl:[[-8,40,10],[-19,35,17],[-30,26,20],[-39,12,16],[-41,-3,8],[-36,-16,-4],[-24,-23,-17],[-8,-25,-27]]},
 {id:'CON',sys:'R',name:'conus branch',parent:'RCA',r0:0.55,r1:0.3,ctrl:[[-19,35,17],[-17,40,26],[-11,42,32]]},
 {id:'AM',sys:'R',name:'acute marginal',parent:'RCA',r0:0.75,r1:0.35,ctrl:[[-39,12,16],[-34,2,26],[-26,-8,30]]},
 {id:'PDA',sys:'R',name:'posterior descending',parent:'RCA',r0:1.1,r1:0.5,ctrl:[[-8,-25,-27],[4,-31,-22],[17,-37,-15],[28,-42,-7]]},
 {id:'PLV',sys:'R',name:'posterolateral',parent:'RCA',r0:1.0,r1:0.5,ctrl:[[-8,-25,-27],[6,-21,-35],[18,-15,-40],[26,-8,-41]]},
];

/* Coronary flow speed (mm/s) for contrast travel. */
const FLOW={L:150,R:125};

/* Aortic centreline from the femoral approach up to the aortic root. */
const AO_CTRL=[[14,-240,-62],[14,-120,-62],[13,-20,-60],[12,60,-56],[9,100,-46],[2,118,-28],[-7,116,-8],[-12,100,6],[-11,78,8],[-6,56,5],[0,44,1],[2,36,0]];

/* Judkins catheters: home = starting tip angle (deg), tol = engagement window (deg), sys = which coronary it engages. */
const CATH={JL:{label:'JL4',home:-45,tol:32,sys:'L'},JR:{label:'JR4',home:55,tol:26,sys:'R'}};

/* Stenosis grading buckets offered in the report. */
const BUCKETS=[{k:'<50%',lo:0,hi:0.5},{k:'50–69%',lo:0.5,hi:0.7},{k:'70–89%',lo:0.7,hi:0.9},{k:'≥90%',lo:0.9,hi:1.01}];

/* C-arm presets on keys 1–7: [label, LAO(+)/RAO(-), CRA(+)/CAU(-)]. */
const PRESETS=[['RAO 30 CAU 25',-30,-25],['RAO 30 CRA 30',-30,30],['AP CRA 35',0,35],['LAO 45 CRA 25',45,25],['LAO 45 CAU 30',45,-30],['LAO 40',40,0],['RAO 30',-30,0]];

/* Cases add themselves here (see cases/*.js). */
const CASES=[];
