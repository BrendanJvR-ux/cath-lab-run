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

/* Coronary tree (the usual right-dominant pattern). ctrl = control points from the ostium outward;
   r0/r1 = lumen radius (mm) at start/end. A branch starts at one of its parent's control points.
   js/sim.js builds the live tree (VESSELS) from these, with any anatomical variant applied (see VARIANT_PARTS). */
const VESSEL_DEFS=[
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

/* The tree is drawn a little larger than the raw control points: every vessel is stretched away from its
   own ostium by TREE_SCALE (lumen radii by TREE_RSCALE). Lesion positions in the case files are scaled to match. */
const TREE_SCALE=1.344, TREE_RSCALE=1.06; // 1.344 = 1.12 × 1.2: every coronary 20% longer

/* Extra vessels used by anatomical variants (random patients). */
const VARIANT_PARTS={
  // ramus intermedius: a third branch from the end of the left main, between the LAD and the circumflex
  RI:{id:'RI',sys:'L',name:'ramus intermedius',parent:'LM',r0:1.3,r1:0.55,ctrl:[[22,39,-2],[32,36,3],[43,28,5],[52,16,3],[57,3,0]]},
  // left dominance: the circumflex runs on round the back of the heart to the crux and gives the posterior descending
  LCX_LONG:[[50,7,-41],[46,-6,-44],[34,-16,-43],[18,-22,-37],[2,-25,-30]],
  LPDA:{id:'LPDA',sys:'L',name:'posterior descending',parent:'LCx',r0:1.1,r1:0.5,ctrl:[[2,-25,-30],[10,-32,-23],[19,-38,-15],[28,-43,-7]]},
  // co-dominance: the circumflex reaches part-way and gives a posterolateral branch; the RCA keeps the PDA
  LCX_MID:[[50,7,-41],[46,-6,-44],[36,-15,-43]],
  LPL:{id:'LPL',sys:'L',name:'posterolateral',parent:'LCx',r0:0.95,r1:0.45,ctrl:[[36,-15,-43],[30,-24,-38],[22,-30,-31]]},
  // where the RCA arises from the right sinus (default is between these)
  RCA_ORIGIN:{anterior:[[-4,44,15],[-15,38,21]],posterior:[[-13,39,5],[-22,35,13]],high:[[1,46,17],[-11,41,23]]},
};

/* Coronary flow speed (mm/s) for contrast travel. */
const FLOW={L:150,R:125};

/* Aortic centreline from the femoral approach up to the aortic root. */
const AO_CTRL=[[14,-240,-62],[14,-120,-62],[13,-20,-60],[12,60,-56],[9,100,-46],[2,118,-28],[-7,116,-8],[-12,100,6],[-11,78,8],[-6,56,5],[0,44,1],[2,36,0]];

/* Judkins catheters: home = starting tip angle (deg), tol = engagement window (deg), sys = which coronary it engages. */
const CATH={JL:{label:'JL4',home:-45,tol:45,sys:'L'},JR:{label:'JR4',home:100,tol:55,sys:'R'}};

/* Stenosis grading buckets offered in the report. */
const BUCKETS=[{k:'<50%',lo:0,hi:0.5},{k:'50–69%',lo:0.5,hi:0.7},{k:'70–89%',lo:0.7,hi:0.9},{k:'≥90%',lo:0.9,hi:1.01}];
/* plain language: everyday words for players outside medicine (js/game.js switches it per operator) */
let PLAIN=false;
const GRADE_PLAIN=['Mild','Moderate','Severe','Near-blocked'];
const gradeName=i=>PLAIN?`${GRADE_PLAIN[i]} (${BUCKETS[i].k})`:BUCKETS[i].k;

/* C-arm presets on keys 1–7: [label, LAO(+)/RAO(-), CRA(+)/CAU(-)]. */
const PRESETS=[['RAO 30 CAU 25',-30,-25],['RAO 30 CRA 30',-30,30],['AP CRA 35',0,35],['LAO 45 CRA 25',45,25],['LAO 45 CAU 30',45,-30],['LAO 40',40,0],['RAO 30',-30,0]];

/* Stent sizes offered for PCI: diameter (mm) and length (mm). */
const STENT_DIAMS=[2.5,3.0,3.5,4.0];
const STENT_LENS=[12,18,24,30];

/* Balloon sizes for angioplasty: diameter (mm) and length (mm). */
const BALLOON_DIAMS=[2.0,2.5,3.0,3.5,4.0];
const BALLOON_LENS=[12,15,20];

/* Difficulty. tol = engagement window (deg) per system, seek = how far (deg) beyond the window the tip
   is pulled into the ostium (0 = no help), deep = how far past the ostium (u) before damping,
   budgetX scales each case's contrast budget (null = no limit), dissectT = seconds for an untreated dissection to
   close the vessel. torque = how the shaft grips the aortic wall: fric = twist (deg) it holds before the tip moves,
   dyn = how much grip is left once it slips (low = a big whip), damp = how quickly the tip settles. Complications are set per case (caseChallenge in js/gen.js): none on Easy, some cases on
   Medium, most cases on Hard (or a severe contrast restriction), tokenX scales coffee tokens. */
const DIFFICULTY={
  story:{label:'Story',blurb:'For anyone new to this: one narrowing, the catheter slides into the arteries almost by itself, step-by-step guidance, no limits and no complications.',story:true,tol:{L:70,R:80},seek:130,seekSpeed:150,deep:1.6,budgetX:null,dissectT:120,torque:{fric:0,dyn:0.5,damp:8},tokenX:0.5,level:1},
  easy:{label:'Easy',blurb:'Wide engagement windows, the tip drops into the ostia, no contrast limit and no complications.',tol:{L:45,R:55},seek:70,seekSpeed:90,deep:1.5,budgetX:null,dissectT:80,torque:{fric:0,dyn:0.5,damp:8},tokenX:1,level:1},
  medium:{label:'Medium',blurb:'Standard engagement with a gentle pull into the ostia. Standard contrast budget. Some cases have complications. Tokens ×1.5.',tol:{L:28,R:32},seek:30,seekSpeed:45,deep:1.42,budgetX:1,dissectT:55,torque:{fric:10,dyn:0.45,damp:7},tokenX:1.5,level:2},
  hard:{label:'Hard',blurb:'Tight engagement windows, no help finding the ostia, 25% less contrast. Most cases bring a complication or a severe contrast restriction. Tokens ×2.',tol:{L:16,R:18},seek:0,seekSpeed:0,deep:1.32,budgetX:0.75,dissectT:35,torque:{fric:26,dyn:0.12,damp:3.2},tokenX:2,level:3},
};

/* Drugs. Intracoronary ones go down the engaged guide; iv ones do not need it. gain = how much they restore flow in
   no-reflow (1 = fully), spasm = how completely they relieve spasm, side = what else they do. */
const IC_DRUGS=[
  {id:'gtn',name:'GTN 200 mcg',short:'GTN',gain:0.05,spasm:1,side:'bp',desc:'Nitrate. Relieves coronary spasm; does little for no-reflow. Lowers BP.'},
  {id:'adeno',name:'Adenosine 100 mcg',short:'Adenosine',gain:0.3,spasm:0,side:'brady',desc:'Microvascular vasodilator for no-reflow. Short-lived; brief bradycardia.'},
  {id:'vera',name:'Verapamil 200 mcg',short:'Verapamil',gain:0.42,spasm:0.7,side:'bp',desc:'Calcium-channel blocker for no-reflow and spasm. Lowers BP.'},
  {id:'prot',name:'Protamine 50 mg IV',short:'Protamine',gain:0,spasm:0,side:'none',iv:true,desc:'Reverses heparin. Slows bleeding from a perforation; risks clotting a fresh stent if given otherwise.'},
];

/* ECG lead that shows ischaemia in each vessel's territory: V3 anterior (LAD), V5 lateral (circumflex), II inferior (RCA). */
const TERRITORY={LM:'V3',LAD:'V3',D1:'V3',D2:'V3',S1:'V3',S2:'V3',LCx:'V5',OM1:'V5',OM2:'V5',RCA:'II',CON:'II',AM:'II',PDA:'II',PLV:'II',RI:'V5',LPDA:'II',LPL:'II'};
const LEADS=['II','V3','V5'];

/* Operator avatars (drawn as SVG in js/game.js). */
const AVATARS=[
  {skin:'#f1c7a5',hair:'#3b2a20',style:'short',scrub:'#4f7fa8',cap:null},
  {skin:'#8d5a3b',hair:'#1d1512',style:'bun',scrub:'#5c8f7a',cap:null},
  {skin:'#c99067',hair:'#6b3f22',style:'long',scrub:'#7a6aa8',cap:null},
  {skin:'#e7b896',hair:'#b9883e',style:'short',scrub:'#a86a5c',cap:'#d9a441'},
  {skin:'#5e3a26',hair:'#0f0b09',style:'crop',scrub:'#3f7f8f',cap:'#4f7fa8'},
  {skin:'#d7a57d',hair:'#8a8a8a',style:'bald',scrub:'#6f8a4f',cap:null},
  // shop avatars
  {skin:'#f3cdb0',hair:'#c2462e',style:'long',scrub:'#2f3e5c',cap:'#c94f6d',shop:'av6'},
  {skin:'#6b4430',hair:'#e6e1d8',style:'crop',scrub:'#8c2f39',cap:null,shop:'av7'},
  {skin:'#e0ac86',hair:'#1f2a44',style:'bun',scrub:'#1d6b5f',cap:'#f2a53b',shop:'av8'},
];

/* Coffee-token shop. kind: perk (always on once bought) or avatar.
   Retired items are refunded when a saved profile loads (RETIRED_SHOP). */
const RETIRED_SHOP={warm:20,cool:20}; // the old monitor colour filters
const SHOP=[
  {id:'wire',kind:'perk',name:'Hydrophilic wire',price:15,desc:'Crosses lesions twice as fast, but pokes out of small vessels a little more often.'},
  {id:'av6',kind:'avatar',name:'Operator: red hair, pink cap',price:15,desc:'A new avatar for your operator.',avatar:6},
  {id:'av7',kind:'avatar',name:'Operator: silver crop',price:15,desc:'A new avatar for your operator.',avatar:7},
  {id:'av8',kind:'avatar',name:'Operator: amber cap',price:15,desc:'A new avatar for your operator.',avatar:8},
];

/* Tiered upgrades in the coffee cart: each tier replaces the one before. val = the effect at that tier.
   Old single-tier perks carry over as tier 1 (see loadProfile in js/game.js). */
const TYPICAL_BUDGET=70; // mL, to show what a contrast upgrade means in practice
const UPGRADES=[
  {id:'injector',name:'Power injector',base:1,tiers:[{price:20,val:1.15},{price:40,val:1.3},{price:70,val:1.5}],
   what:v=>`Contrast budget ${Math.round((v-1)*100)}% bigger: +${Math.round(TYPICAL_BUDGET*(v-1))} mL on a typical ${TYPICAL_BUDGET} mL case`},
  {id:'fluoro',name:'Fluoro budget',base:400,tiers:[{price:20,val:500},{price:40,val:650},{price:70,val:850}],
   what:v=>`Full radiation marks up to ${v} mGy air kerma (standard 400 mGy)`},
  {id:'torque',name:'Torque device',base:0,tiers:[{price:20,val:4},{price:40,val:8},{price:70,val:12}],
   what:v=>`Every engagement window ${v}° wider`},
];
const UPGRADE_FROM_PERK={torque:'torque',injector:'injector',lowdose:'fluoro'};
