/* Cath Lab Run: the stroke room. Mechanical thrombectomy for a large-vessel stroke, using the shared monitor, controls,
   pop-up styles, sound, settings, plain words and progression. The anatomy, steering and dye are in js/stroke-sim.js.
   A case: steer up over the arch into the right neck artery, film with dye to find where the dye column stops (the
   clot), mark it, take the microcatheter (X) into the head, then pull the clot out with a stent retriever (open it,
   let it grip, pull back with suction) or suck it out with an aspiration catheter. The stroke clock runs throughout:
   every minute costs brain. */
"use strict";
let SK=null;
const skName=id=>{const n=SK_NAMES[id];return n?(PLAIN?n[1]:n[0]):id};
const SK_SITE_TXT={'ICA-T':['internal carotid terminus','end of the internal carotid (terminus)'],M1:['M1 (middle cerebral)','main middle brain artery (M1)'],M2:['M2 branch','a branch of the middle brain artery (M2)'],BA:['basilar artery','basilar artery (base of the brain)']};
const skSite=k=>PLAIN?SK_SITE_TXT[k][1]:SK_SITE_TXT[k][0];
for(const k of SK_RARE)RARE_BY[k.id]=k; // so the casebook can record stroke rare patients

/* ---------- drawing: two views side by side, in ink ---------- */
const skProj=(p,pane)=>pane===0?[128+p[0],400-p[1]]:[384-p[2]*1.05,400-p[1]];
/* the head and neck on X-ray, in both views. Bone is drawn as density (dark = dense) on its own layer; the layer is
   laid on paper as graphite, engraved with hatching where it is darkest (as the heart room's X-ray), then the edges
   are inked. Air spaces (sinuses, nose, airway, ear canal) are cut out of the density so they read lighter. */
let skBgCanvas=null;
function skBg(){
  if(skBgCanvas)return skBgCanvas;
  const S=2,mk=()=>{const c=document.createElement('canvas');c.width=c.height=512*S;const x=c.getContext('2d');x.scale(S,S);x.lineCap='round';x.lineJoin='round';return [c,x]};
  const [dc,D]=mk(),[c,g]=mk();
  const P=[]; // features: {path, fill, stroke(width), lucent, ink(outline alpha), dash}
  const F=(o)=>P.push(o);
  const E=(x,y,rx,ry,r=0)=>k=>{k.beginPath();k.ellipse(x,y,rx,ry,r,0,7)};
  const L=(pts)=>k=>{k.beginPath();pts.forEach((p,i)=>i?k.lineTo(p[0],p[1]):k.moveTo(p[0],p[1]))};
  const Q=(pts)=>k=>{k.beginPath();k.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length-1;i++){const m=[(pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2];k.quadraticCurveTo(pts[i][0],pts[i][1],m[0],m[1])}const l=pts[pts.length-1];k.lineTo(l[0],l[1])};
  const R=(x,y,w,h,r=2)=>k=>{k.beginPath();k.roundRect?k.roundRect(x,y,w,h,r):k.rect(x,y,w,h)};
  // free-form shapes: ['M',x,y], ['L',x,y], ['Q',cx,cy,x,y], ['C',c1x,c1y,c2x,c2y,x,y], ['Z']
  const B=(cmds)=>k=>{k.beginPath();for(const c of cmds){const [o,...a]=c;if(o==='M')k.moveTo(...a);else if(o==='L')k.lineTo(...a);else if(o==='Q')k.quadraticCurveTo(...a);else if(o==='C')k.bezierCurveTo(...a);else k.closePath()}};
  const mirror=(cmds,cx)=>cmds.map(c=>c[0]==='Z'?c:[c[0],...c.slice(1).map((v,i)=>i%2===0?2*cx-v:v)]);
  const scaleAbout=(cmds,cx,cy,f)=>cmds.map(c=>c[0]==='Z'?c:[c[0],...c.slice(1).map((v,i)=>i%2===0?cx+(v-cx)*f:cy+(v-cy)*f)]);
  /* ---------- front view (AP), centre x 128 ---------- */
  const ax=128;
  F({path:E(ax,124,94,106),fill:0.06,ink:0.2,dash:[3,4]});                              // scalp and soft tissue
  // the cranium: a dome that narrows at the temples down to the skull base
  const cranAP=B([['M',ax,32],['C',ax+50,32,ax+84,62,ax+86,112],['C',ax+88,150,ax+80,178,ax+70,196],['Q',ax+60,202,ax+44,200],['Q',ax+20,194,ax,196],['Q',ax-20,194,ax-44,200],['Q',ax-60,202,ax-70,196],['C',ax-80,178,ax-88,150,ax-86,112],['C',ax-84,62,ax-50,32,ax,32],['Z']]);
  const innerAP=B(scaleAbout([['M',ax,32],['C',ax+50,32,ax+84,62,ax+86,112],['C',ax+88,150,ax+80,178,ax+70,196],['Q',ax,190,ax-70,196],['C',ax-80,178,ax-88,150,ax-86,112],['C',ax-84,62,ax-50,32,ax,32],['Z']],ax,122,0.91));
  F({path:cranAP,fill:0.55,cortex:false});F({path:innerAP,lucent:0.9});F({path:innerAP,fill:0.03});
  F({path:cranAP,ink:0.65,w:1.3});F({path:innerAP,ink:0.42,w:0.9});
  F({path:Q([[ax,36],[ax+3,52],[ax-2,66],[ax+2,82]]),ink:0.25,w:0.7});                         // sagittal suture
  for(const sx of [-1,1])F({path:Q([[ax+sx*40,46],[ax+sx*74,92],[ax+sx*78,150]]),ink:0.16,w:0.7,dash:[2,3]}); // temporal lines
  F({path:Q([[ax-66,194],[ax-40,188],[ax,191],[ax+40,188],[ax+66,194]]),stroke:6,fill:0.2});        // skull base behind the face
  for(const sx of [-1,1]){
    F({path:Q([[ax+sx*8,186],[ax+sx*36,168],[ax+sx*72,180]]),stroke:5,fill:0.45,ink:0.4,w:0.8});   // petrous ridges
    const orb=R(sx<0?ax-50:ax+14,161,36,32,9);
    F({path:orb,lucent:0.2});F({path:orb,stroke:3.2,fill:0.5,ink:0.62,w:1.1});                     // orbits
    F({path:Q([[ax+sx*14,160],[ax+sx*32,154],[ax+sx*52,162]]),stroke:4,fill:0.45,ink:0.5,w:1});    // brow (supraorbital margin)
    F({path:Q([[ax+sx*22,184],[ax+sx*30,178],[ax+sx*40,188]]),ink:0.32,w:0.7});                     // superior orbital fissure
    F({path:B([['M',ax+sx*48,172],['Q',ax+sx*58,184,ax+sx*60,198],['Q',ax+sx*70,197,ax+sx*76,202],['Q',ax+sx*68,210,ax+sx*56,210],['Q',ax+sx*46,204,ax+sx*42,196],['Z']]),fill:0.38,ink:0.42,w:0.8}); // cheekbone and zygomatic arch
    F({path:E(ax+sx*30,210,13,14,sx*-0.2),lucent:0.24,ink:0.38,w:0.8});                             // maxillary sinuses
    F({path:E(ax+sx*64,208,4.5,7,sx*-0.2),fill:0.38,ink:0.35,w:0.7}); // mastoid processes
    F({path:E(ax+sx*17,240,7,6),fill:0.35,ink:0.3,w:0.7});                                          // lateral masses of C1
    F({path:E(ax+sx*60,204,5,4),fill:0.45,ink:0.4,w:0.7});                                          // jaw joints (condyles)
  }
  for(const [x,y,rx,ry] of [[ax-9,152,9,7],[ax,147,8,9],[ax+9,152,9,7]])F({path:E(x,y,rx,ry),lucent:0.26,ink:0.38,w:0.8}); // frontal sinus
  F({path:B([['M',ax,190],['C',ax-14,198,ax-17,214,ax-12,226],['Q',ax,232,ax+12,226],['C',ax+17,214,ax+14,198,ax,190],['Z']]),lucent:0.32,ink:0.5,w:1}); // nasal aperture
  F({path:L([[ax-4,180],[ax,190],[ax+4,180]]),stroke:2.5,fill:0.4,ink:0.45,w:0.8});                   // nasal bones
  F({path:L([[ax,194],[ax+1,212],[ax-1,226]]),ink:0.4,w:0.8});                                       // nasal septum
  // teeth: a curved row each, broader molars at the sides
  for(let i=-6;i<=6;i++){const w=Math.abs(i)>3?6.8:Math.abs(i)>1?5.6:5,x=ax+i*6.1,yU=227+Math.abs(i)*0.5,yL=239+Math.abs(i)*0.3;
    F({path:R(x-w/2,yU,w,9,2),fill:0.62,ink:0.32,w:0.5});F({path:R(x-w/2,yL,w,8.5,2),fill:0.6,ink:0.32,w:0.5})}
  F({path:B([['M',ax-44,212],['Q',ax-40,224,ax-38,228],['L',ax+38,228],['Q',ax+40,224,ax+44,212]]),stroke:3,fill:0.35,ink:0.35,w:0.7}); // upper jaw (maxilla)
  F({path:B([['M',ax-60,204],['C',ax-62,226,ax-60,246,ax-54,252],['C',ax-40,262,ax-20,270,ax,271],['C',ax+20,270,ax+40,262,ax+54,252],['C',ax+60,246,ax+62,226,ax+60,204]]),stroke:6,fill:0.45,ink:0.55,w:1.1}); // mandible
  F({path:E(ax,266,9,4),fill:0.3});                                                                    // chin
  F({path:R(ax-5,228,10,20,4),fill:0.3,ink:0.32,w:0.6});                                              // dens (through the open mouth)
  // neck vertebrae, front view: bodies with uncinate hooks, pedicles, transverse processes, spinous process end on
  for(let i=0;i<8;i++){const y=252+i*20.5,w=22+i*0.9,l=ax-w/2,r=ax+w/2;
    F({path:B([['M',l,y+2],['L',l-1.5,y-2],['L',l+3,y+1],['L',r-3,y+1],['L',r+1.5,y-2],['L',r,y+2],['L',r,y+15],['Q',ax,y+16.5,l,y+15],['Z']]),fill:0.42,ink:0.48,w:0.9});
    for(const sx of [-1,1]){F({path:E(ax+sx*(w/2-3.5),y+7,2.6,3.8),fill:0.3,ink:0.35,w:0.6});F({path:R(sx>0?r:l-8,y+4,8,6,2),fill:0.25,ink:0.3,w:0.5})}
    F({path:B([['M',ax,y+6],['Q',ax+4,y+12,ax,y+17],['Q',ax-4,y+12,ax,y+6],['Z']]),fill:0.42,ink:0.38,w:0.6})}
  F({path:R(ax-8,262,16,250,6),lucent:0.22,ink:0.2,w:0.6,dash:[2,3]});                                 // trachea (air)
  for(const sx of [-1,1]){
    F({path:Q([[ax+sx*12,404],[ax+sx*40,394],[ax+sx*70,400],[ax+sx*100,390]]),stroke:8,fill:0.38,ink:0.4,w:0.9}); // clavicles
    for(let k=0;k<3;k++)F({path:Q([[ax+sx*14,420+k*28],[ax+sx*60,404+k*28],[ax+sx*112,446+k*28]]),stroke:5,fill:0.26,ink:0.3,w:0.7}); // ribs
    F({path:Q([[ax+sx*44,262],[ax+sx*48,320],[ax+sx*56,372],[ax+sx*118,396]]),ink:0.2,w:0.8,dash:[3,4]}); // skin of neck and shoulders
  }
  /* ---------- side view (lateral), face to the left ---------- */
  F({path:Q([[296,112],[286,150],[282,168],[262,200],[284,212],[279,222],[282,236],[286,262],[312,284],[338,300],[348,400],[346,512]]),ink:0.24,w:0.9,dash:[3,4]}); // the face in profile
  F({path:Q([[494,140],[488,210],[472,300],[478,512]]),ink:0.2,w:0.8,dash:[3,4]});            // back of the head and neck
  const cranLat=[['M',298,166],['Q',290,158,290,146],['C',288,112,300,70,330,48],['C',360,26,420,22,456,44],['C',486,64,498,108,492,140],['Q',490,160,482,170],['Q',476,176,470,180],['C',462,196,448,210,432,214],['L',412,206],['Q',392,196,372,190],['Q',334,172,298,166],['Z']];
  F({path:B(cranLat),fill:0.55,cortex:false});F({path:B(scaleAbout(cranLat,392,118,0.91)),lucent:0.9});F({path:B(scaleAbout(cranLat,392,118,0.91)),fill:0.03});
  F({path:B(cranLat),ink:0.65,w:1.3});F({path:B(scaleAbout(cranLat,392,118,0.91)),ink:0.42,w:0.9});
  F({path:L([[346,36],[349,52],[345,66],[350,82],[347,98],[351,112]]),ink:0.3,w:0.7});           // coronal suture
  F({path:L([[456,46],[462,64],[458,80],[468,98],[464,116],[474,134],[470,150]]),ink:0.3,w:0.7}); // lambdoid suture
  F({path:Q([[360,176],[384,150],[414,148],[440,170]]),ink:0.3,w:0.7});                          // squamosal suture
  F({path:Q([[312,118],[360,66],[430,64],[470,104]]),ink:0.16,w:0.7,dash:[2,3]});                // temporal line
  F({path:E(300,148,8,13,0.2),lucent:0.3,ink:0.4,w:0.8});                                       // frontal sinus
  F({path:Q([[296,160],[310,152],[324,158]]),stroke:4,fill:0.45,ink:0.5,w:1});                  // brow ridge
  F({path:E(312,175,15,14),lucent:0.18});F({path:Q([[324,160],[326,176],[318,192]]),stroke:3,fill:0.45,ink:0.55,w:1}); // orbit and its rim
  F({path:Q([[302,164],[340,163],[372,170]]),stroke:3,fill:0.42,ink:0.42,w:0.9});                // floor of the front of the skull
  F({path:Q([[366,168],[372,186],[384,188],[392,170]]),stroke:3,fill:0.5,ink:0.6,w:1.1});         // sella turcica
  F({path:L([[392,172],[400,188],[414,214]]),stroke:9,fill:0.45,ink:0.4,w:0.9});                  // clivus
  F({path:L([[406,180],[440,174],[432,204],[406,198]]),fill:0.55,ink:0.4,w:0.8});                 // petrous bone
  F({path:E(422,198,5.5,5.5),lucent:0.4,ink:0.55,w:0.9});                                         // ear canal
  for(const [x,y,r] of [[440,204,3],[446,212,2.6],[438,214,2.4],[450,203,2.2],[444,220,2]])F({path:E(x,y,r,r),lucent:0.25,ink:0.3,w:0.5}); // mastoid air cells
  F({path:B([['M',436,206],['L',446,228],['L',454,208],['Z']]),fill:0.42,ink:0.4,w:0.8});         // mastoid process
  F({path:L([[420,208],[408,238]]),stroke:2,fill:0.4,ink:0.4,w:0.6});                              // styloid process
  F({path:L([[298,168],[284,196]]),stroke:3,fill:0.42,ink:0.5,w:0.9});                             // nasal bone
  F({path:B([['M',318,188],['Q',334,186,340,200],['Q',332,212,320,210],['Q',312,200,318,188],['Z']]),fill:0.42,ink:0.42,w:0.8}); // cheekbone
  F({path:L([[336,197],[372,199],[412,198]]),stroke:4,fill:0.42,ink:0.42,w:0.8});                  // zygomatic arch
  F({path:B([['M',284,196],['Q',278,206,276,212],['L',284,214],['Q',282,220,284,224],['L',366,220],['L',370,204],['Q',350,194,330,192],['Z']]),fill:0.38,ink:0.42,w:0.9}); // maxilla
  F({path:E(326,202,16,10,-0.1),lucent:0.26,ink:0.38,w:0.8});                                      // maxillary sinus
  F({path:L([[284,216],[368,220]]),stroke:3,fill:0.45,ink:0.42,w:0.8});                             // hard palate
  F({path:E(370,206,10,8),lucent:0.22});                                                            // nasopharynx
  // teeth: incisors leaning forwards at the front, molars behind
  for(let i=0;i<8;i++){const x=282+i*6.4,w=i<2?4.6:i<4?5.4:6.4,lean=i<2?-2:0;
    F({path:B([['M',x,224],['L',x+w,224],['L',x+w+lean,233],['Q',x+w/2+lean,235,x+lean,233],['Z']]),fill:0.62,ink:0.32,w:0.5});
    F({path:B([['M',x+1+lean,236],['Q',x+1+w/2+lean,234,x+1+w+lean,236],['L',x+1+w,245],['L',x+1,245],['Z']]),fill:0.6,ink:0.32,w:0.5})}
  // the mandible: chin, lower border, angle, ramus up to the condyle; the coronoid in front of the notch
  const jaw=[['M',288,244],['Q',282,256,286,266],['Q',292,274,306,272],['Q',340,268,374,262],['Q',386,258,388,248],['L',396,224],['Q',400,212,402,208],['Q',408,200,410,206],['Q',408,212,400,216],['Q',392,222,386,218],['L',378,206],['Q',372,212,370,224],['L',366,240],['Q',340,246,300,246],['Z']];
  F({path:B(jaw),fill:0.45,ink:0.55,w:1.1});F({path:E(306,262,1.6,1.6),lucent:0.3});              // mandible and mental foramen
  F({path:Q([[344,276],[352,272],[360,276]]),stroke:3,fill:0.4,ink:0.4,w:0.8});                      // hyoid
  F({path:Q([[368,206],[378,240],[382,280],[386,340],[388,512]]),stroke:13,lucent:0.25});           // pharynx and trachea (air)
  // cervical spine, side view: C1 (atlas) arches, the dens, C2 (axis) with its big spinous process, then C3 to C7
  F({path:E(402,222,4.5,5.5),fill:0.48,ink:0.5,w:0.8});                                            // C1 anterior arch
  F({path:B([['M',408,236],['L',408,214],['Q',412,206,416,214],['L',418,236],['Z']]),fill:0.42,ink:0.5,w:0.8}); // the dens (odontoid peg)
  F({path:E(424,220,8,6),fill:0.4,ink:0.42,w:0.7});                                                // C1 lateral mass
  F({path:B([['M',430,216],['L',460,218],['Q',470,220,468,226],['Q',462,230,456,226],['L',430,226],['Z']]),fill:0.42,ink:0.5,w:0.8}); // C1 posterior arch and tubercle
  F({path:B([['M',404,238],['L',430,236],['L',432,262],['Q',418,266,402,262],['Z']]),fill:0.44,ink:0.55,w:0.9}); // C2 body
  F({path:B([['M',432,234],['L',446,238],['L',448,258],['L',434,262],['Z']]),fill:0.4,ink:0.45,w:0.7}); // C2 articular pillar
  F({path:B([['M',446,242],['Q',466,240,478,250],['Q',482,258,474,262],['L',448,262],['Z']]),fill:0.42,ink:0.5,w:0.8}); // C2 spinous process
  const lord=[2,5,7,5,2];const spl=[22,22,24,28,42];
  for(let i=0;i<5;i++){const y=268+i*22,x=410-lord[i],h=17;
    F({path:B([['M',x,y+1],['L',x+24,y],['L',x+25,y+h],['Q',x+12,y+h+1.5,x-1,y+h+0.5],['Q',x-3,y+h-2,x,y+h-3],['Z']]),fill:0.44,ink:0.55,w:0.9}); // body with its front lip
    F({path:B([['M',x+26,y-3],['L',x+40,y+1],['L',x+42,y+17],['L',x+28,y+20],['Z']]),fill:0.38,ink:0.45,w:0.7}); // articular pillar
    const sx0=x+40,sy0=y+5,L2=spl[i];
    F({path:B([['M',sx0,sy0],['Q',sx0+L2*0.5,sy0+2+i,sx0+L2,sy0+8+i*1.5],['Q',sx0+L2+4,sy0+12+i*1.5,sx0+L2-2,sy0+15+i*1.5],['Q',sx0+L2*0.5,sy0+14,sx0,sy0+11],['Z']]),fill:0.4,ink:0.5,w:0.8})} // lamina and spinous process (C7 the longest)
  F({path:B([['M',404,380],['L',430,378],['L',432,396],['Q',418,399,402,396],['Z']]),fill:0.42,ink:0.5,w:0.8}); // T1
  F({path:E(440,486,52,46),fill:0.16,ink:0.18,w:0.7});                                              // the shoulders over the lower neck
  /* ---------- more skull detail: front view ---------- */
  {const rnd=(()=>{let a=987654;return()=>{a=(a*16807)%2147483647;return a/2147483647}})();
  // vault: a speckled diploe between the tables, vessel channels and granulation pits near the top
  F({speckle:520,path:cranAP,hole:innerAP,seed:3});
  for(const [x0,y0,dx] of [[ax-60,70,22],[ax+38,62,24],[ax-30,44,18],[ax+60,120,-10]])F({path:Q([[x0,y0],[x0+dx*0.4,y0+3],[x0+dx*0.7,y0-2],[x0+dx,y0+2]]),stroke:1.4,lucent:0.35,ink:0.18,w:0.5}); // diploic channels
  for(const [x,y] of [[ax-14,46],[ax+16,48],[ax-24,54],[ax+26,57]])F({path:E(x,y,2.2,1.6),lucent:0.35,ink:0.25,w:0.5});            // arachnoid granulation pits
  for(const sx of [-1,1])F({path:L([[ax+sx*4,40],[ax+sx*12,46],[ax+sx*16,42],[ax+sx*24,52],[ax+sx*30,50],[ax+sx*38,62],[ax+sx*44,60],[ax+sx*52,74],[ax+sx*58,72],[ax+sx*64,88]]),ink:0.28,w:0.6}); // lambdoid suture seen through the vault
  // midline of the face: nasion, crista galli, the ethmoid air cells between the orbits
  F({path:E(ax,166,5,3),fill:0.4,ink:0.35,w:0.6});
  F({path:B([['M',ax-2,170],['L',ax,156],['L',ax+2,170],['Z']]),fill:0.45,ink:0.45,w:0.6});
  for(let i=0;i<12;i++){const x=ax+(i%2?1:-1)*(3+((i*7)%4)*2.4),y=168+Math.floor(i/2)*3.6;F({path:E(x,y,2.6,1.9),lucent:0.25,ink:0.32,w:0.45})}
  F({path:L([[ax-30,171],[ax-14,169],[ax+14,169],[ax+30,171]]),ink:0.38,w:0.7});                    // lesser wings and planum sphenoidale
  for(const sx of [-1,1]){
    F({path:Q([[ax+sx*44,164],[ax+sx*41,178],[ax+sx*43,192]]),ink:0.42,w:0.8});                     // innominate line (greater wing of the sphenoid)
    F({path:E(ax+sx*22,161,2.4,1.6),lucent:0.4,ink:0.4,w:0.5});                                     // supraorbital notch
    F({path:E(ax+sx*28,199,1.8,1.8),lucent:0.4,ink:0.4,w:0.5});                                     // infraorbital foramen
    F({path:Q([[ax+sx*16,193],[ax+sx*32,196],[ax+sx*48,190]]),stroke:2.4,fill:0.42,ink:0.45,w:0.7});// infraorbital rim
    F({path:L([[ax+sx*49,164],[ax+sx*52,168]]),ink:0.35,w:0.6});                                    // frontozygomatic suture
    F({path:E(ax+sx*40,177,4,1.6),lucent:0.4,ink:0.45,w:0.5});                                      // internal auditory canal
    for(let k=0;k<7;k++)F({path:E(ax+sx*(58+(k%3)*3),194+Math.floor(k/3)*4+(k%2),1.6,1.4),lucent:0.3,ink:0.25,w:0.4}); // mastoid air cells
    F({path:B([['M',ax+sx*38,206],['L',ax+sx*44,214],['L',ax+sx*36,216],['Z']]),fill:0.35,ink:0.35,w:0.5}); // coronoid tip seen through the sinus
    F({path:Q([[ax+sx*20,210],[ax+sx*30,206],[ax+sx*40,212]]),ink:0.28,w:0.5});                     // septum in the maxillary sinus
    for(const y of [205,217])F({path:E(ax+sx*9,y,5,2.2,sx*0.2),fill:0.3,ink:0.4,w:0.6});            // middle and inferior turbinates
    F({path:E(ax+sx*22,258,1.8,1.8),lucent:0.4,ink:0.4,w:0.5});                                     // mental foramen
    F({path:Q([[ax+sx*54,232],[ax+sx*40,250],[ax+sx*22,257]]),stroke:1.3,lucent:0.3,ink:0.18,w:0.4}); // mandibular canal
    F({path:Q([[ax+sx*13,236],[ax+sx*17,232],[ax+sx*22,237]]),ink:0.4,w:0.6});                       // atlanto-axial joints
  }
  F({path:L([[ax,248],[ax,270]]),ink:0.25,w:0.5});                                                    // symphysis of the chin
  // tooth roots in the jaws, and the pulp in each crown
  for(let i=-6;i<=6;i++){const x=ax+i*6.1,w=Math.abs(i)>3?6.8:Math.abs(i)>1?5.6:5,yU=227+Math.abs(i)*0.5,yL=239+Math.abs(i)*0.3,rt=Math.abs(i)>3?2:1;
    for(let r=0;r<rt;r++){const ox=rt===2?(r?1.6:-1.6):0;F({path:L([[x+ox,yU],[x+ox*0.8,yU-11+Math.abs(i)*0.4]]),stroke:2.2,fill:0.35,ink:0.22,w:0.4});F({path:L([[x+ox,yL+8.5],[x+ox*0.8,yL+19-Math.abs(i)*0.3]]),stroke:2.2,fill:0.35,ink:0.22,w:0.4})}
    F({path:E(x,yU+4.5,w*0.18,2.2),lucent:0.3});F({path:E(x,yL+4,w*0.18,2),lucent:0.3})}
  /* ---------- more skull detail: side view ---------- */
  const cranLatIn=B(scaleAbout(cranLat,392,118,0.91));
  F({speckle:620,path:B(cranLat),hole:cranLatIn,seed:7});
  for(const [x0,y0,dx,dy] of [[360,64,30,-6],[420,50,26,8],[456,96,10,26],[330,96,-8,30]])F({path:Q([[x0,y0],[x0+dx*0.4,y0+dy*0.4+3],[x0+dx*0.7,y0+dy*0.7-2],[x0+dx,y0+dy]]),stroke:1.4,lucent:0.35,ink:0.18,w:0.5}); // diploic channels
  for(const [x,y] of [[372,40],[396,38],[420,42]])F({path:E(x,y,2.2,1.5),lucent:0.35,ink:0.25,w:0.5});                       // granulation pits
  F({path:Q([[360,170],[364,140],[378,112],[392,86]]),ink:0.22,w:0.6});F({path:Q([[372,128],[400,120],[428,100]]),ink:0.18,w:0.5});F({path:Q([[366,150],[392,150],[420,138]]),ink:0.18,w:0.5}); // middle meningeal grooves
  F({path:L([[352,146],[360,152],[352,158]]),ink:0.35,w:0.7});F({path:L([[364,146],[358,152],[364,158]]),ink:0.35,w:0.7}); // pterion
  F({path:E(478,150,5,6),fill:0.5,ink:0.4,w:0.6});F({path:Q([[476,150],[460,160],[440,170]]),stroke:2,lucent:0.25,ink:0.22,w:0.5}); // internal occipital protuberance, transverse sinus groove
  F({path:E(486,168,4,3),fill:0.55,ink:0.5,w:0.7});                                                     // external occipital protuberance (inion)
  F({path:E(440,220,7,4,0.3),fill:0.5,ink:0.45,w:0.7});                                                 // occipital condyle
  F({path:Q([[306,160],[336,158],[366,166]]),ink:0.42,w:0.8});F({path:Q([[308,166],[338,164],[366,170]]),ink:0.3,w:0.6}); // the two orbital roofs
  F({path:L([[332,168],[350,168]]),stroke:2,fill:0.45,ink:0.5,w:0.6});                                  // cribriform plate
  F({path:B([['M',362,164],['L',370,166],['L',366,172],['Z']]),fill:0.5,ink:0.5,w:0.6});               // anterior clinoid process
  F({path:B([['M',388,170],['L',392,164],['L',396,168],['L',392,174],['Z']]),fill:0.5,ink:0.5,w:0.6}); // dorsum sellae and posterior clinoid
  F({path:B([['M',360,180],['Q',374,176,388,182],['Q',392,192,386,202],['Q',372,206,360,200],['Q',354,190,360,180],['Z']]),lucent:0.3,ink:0.42,w:0.7}); // sphenoid sinus
  F({path:L([[374,180],[372,200]]),ink:0.3,w:0.5});F({path:L([[380,182],[382,198]]),ink:0.25,w:0.5});    // its septa
  F({path:B([['M',356,192],['Q',362,198,358,212],['Q',354,200,356,192],['Z']]),lucent:0.35,ink:0.4,w:0.6}); // pterygopalatine fossa
  F({path:L([[366,204],[370,228]]),stroke:1.6,fill:0.4,ink:0.42,w:0.6});F({path:L([[372,204],[378,226]]),stroke:1.6,fill:0.4,ink:0.42,w:0.6}); // pterygoid plates
  for(const [y,x1] of [[200,340],[207,346],[214,350]])F({path:Q([[292,y+1],[318,y-3],[x1,y]]),stroke:2,fill:0.3,ink:0.35,w:0.6}); // turbinates
  for(let i=0;i<9;i++)F({path:E(318+(i%3)*8,174+Math.floor(i/3)*5,3,2.2),lucent:0.25,ink:0.3,w:0.45});   // ethmoid air cells
  F({path:L([[300,140],[302,158]]),ink:0.3,w:0.5});                                                      // septum of the frontal sinus
  F({path:Q([[366,220],[376,226],[384,234]]),stroke:4,fill:0.14,ink:0.2,w:0.6});                         // soft palate
  F({path:B([['M',296,248],['Q',320,232,352,236],['Q',372,244,368,262],['Q',340,268,300,262],['Z']]),fill:0.08,ink:0.12,w:0.5,dash:[2,3]}); // tongue
  F({path:Q([[372,262],[368,272],[374,282]]),stroke:2,fill:0.2,ink:0.28,w:0.5});                         // epiglottis
  F({path:Q([[398,198],[406,192],[416,198]]),stroke:2,fill:0.42,ink:0.45,w:0.6});                        // articular eminence and glenoid fossa
  F({path:Q([[390,226],[350,250],[308,262]]),stroke:1.4,lucent:0.3,ink:0.2,w:0.4});                      // mandibular canal
  F({path:E(306,262,1.6,1.6),lucent:0.4,ink:0.4,w:0.5});                                                 // mental foramen
  // tooth roots: incisors single, molars double; the pulp in each crown
  for(let i=0;i<8;i++){const x=282+i*6.4,w=i<2?4.6:i<4?5.4:6.4,lean=i<2?-2:0,rt=i>4?2:1;
    for(let r=0;r<rt;r++){const ox=x+w*(rt===2?(r?0.75:0.25):0.5);
      F({path:L([[ox,224],[ox+lean*1.8+(rt===2?(r?1:-1):0),212]]),stroke:2,fill:0.35,ink:0.2,w:0.4});
      F({path:L([[ox+1+lean,245],[ox+1+lean*0.5+(rt===2?(r?1:-1):0),258]]),stroke:2,fill:0.35,ink:0.2,w:0.4})}
    F({path:E(x+w/2,229,w*0.16,2.4),lucent:0.3});F({path:E(x+1+w/2+lean,240,w*0.16,2.2),lucent:0.3})}
  }
  // build the density layer
  for(const f of P){
    if(f.speckle){let a=f.seed*7919+1;const r=()=>{a=(a*16807)%2147483647;return a/2147483647};D.save();f.path(D);D.clip();D.globalCompositeOperation='destination-out';
      for(let i=0;i<f.speckle;i++){const x=r()*512,y=r()*300;if(f.hole){f.hole(D);if(D.isPointInPath(x*S,y*S))continue}D.fillStyle=`rgba(0,0,0,${0.15+r()*0.25})`;D.beginPath();D.ellipse(x,y,0.6+r()*1.1,0.5+r()*0.8,r()*3,0,7);D.fill()}
      D.restore();continue}
    if(f.fill!=null||f.lucent!=null){D.save();
      if(f.lucent!=null){D.globalCompositeOperation='destination-out';D.fillStyle=D.strokeStyle=`rgba(0,0,0,${f.lucent})`;f.path(D);D.fill()}
      else if(f.stroke){D.strokeStyle=`rgba(0,0,0,${f.fill})`;f.path(D);D.lineWidth=f.stroke;D.stroke()}
      else if(f.cortex===false||f.fill<0.2){D.fillStyle=`rgba(0,0,0,${f.fill})`;f.path(D);D.fill()}
      // bone: a lighter inside with a dense rim of cortex, so shading gathers at the edges as on X-ray
      else{D.fillStyle=`rgba(0,0,0,${f.fill*0.55})`;f.path(D);D.fill();D.save();f.path(D);D.clip();D.strokeStyle=`rgba(0,0,0,${Math.min(0.7,f.fill+0.12)})`;D.lineWidth=3.2;f.path(D);D.stroke();D.restore()}
      D.restore()}}
  // paper, then the density as graphite
  g.fillStyle='#EFE9DC';g.fillRect(0,0,512,512);g.globalAlpha=0.5;g.drawImage(dc,0,0,512,512);g.globalAlpha=1;
  // engraving where it is dense: hatching, cross-hatched where darker (as the heart room)
  {const N=256,sm=document.createElement('canvas');sm.width=sm.height=N;const sg=sm.getContext('2d');sg.drawImage(dc,0,0,N,N);const I=sg.getImageData(0,0,N,N).data;
   const dark=(x,y)=>{if(x<0||y<0||x>=N||y>=N)return 0;return I[(((y|0)*N+(x|0))*4)+3]/255};
   g.strokeStyle='rgba(29,27,25,0.72)';g.lineWidth=0.5;
   const pass=(ang,gap,th)=>{const cs=Math.cos(ang),sn=Math.sin(ang),Ln=730;g.beginPath();for(let k=-Ln/2;k<Ln/2;k+=gap){let on=false;for(let t=-Ln/2;t<Ln/2;t+=2.5){const x=256+cs*t-sn*k,y=256+sn*t+cs*k,d=dark(x/2,y/2);
     if(d>th){if(!on){g.moveTo(x,y);on=true}else g.lineTo(x,y)}else on=false}}g.stroke()};
   pass(0.12,3,0.3);pass(-0.9,3.4,0.4);pass(0.9,3.6,0.5);pass(1.6,3.1,0.6)}
  // ink the edges
  for(const f of P){if(f.ink==null)continue;g.save();g.strokeStyle=`rgba(29,27,25,${f.ink})`;g.lineWidth=f.w||1;if(f.dash)g.setLineDash(f.dash);f.path(g);
    if(f.stroke){g.lineWidth=(f.w||1);g.stroke()}else g.stroke();g.restore()}
  // the X-ray field's dark rim, then the divider and labels
  for(const ox of [0,256]){const gr=g.createRadialGradient(ox+128,256,150,ox+128,256,300);gr.addColorStop(0,'rgba(60,45,25,0)');gr.addColorStop(1,'rgba(60,45,25,0.22)');g.fillStyle=gr;g.fillRect(ox,0,256,512)}
  g.strokeStyle='#1d1b19';g.lineWidth=1.4;g.beginPath();g.moveTo(256,0);g.lineTo(256,512);g.stroke();
  g.font='italic 14px "IM Fell English", Georgia, serif';g.fillStyle='rgba(29,27,25,0.7)';g.textAlign='right';g.fillText('front (AP)',250,16);g.textAlign='left';g.fillText('side (lateral)',262,16);
  return skBgCanvas=c;
}
const SK_FLOW=200,SK_VEIN_DELAY=3; // mm of artery per second of dye travel; seconds until the veins fill
const skHist=(h,t)=>{if(t<0||!h.length)return 0;const i=Math.floor(t/0.02);return i<h.length?h[i]:h[h.length-1]};
/* draw the scene into any canvas: dye from a distance map up to a front, a faint roadmap, the catheter and devices */
let skVL=null;
function skRender(ctx,o){
  const sc=ctx.canvas.width/512;ctx.setTransform(sc,0,0,sc,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.drawImage(skBg(),0,0,512,512);
  if(!o.image){ctx.fillStyle='rgba(239,233,220,0.55)';ctx.fillRect(0,0,512,512);return}
  const A=o.A,lineFor=v=>Math.max(1.4,v.r*2.4);
  // vessels, catheter and any bleed go on their own layer, then multiply over the bone (as on the heart room's X-ray)
  if(!skVL||skVL.width!==ctx.canvas.width){skVL=document.createElement('canvas');skVL.width=skVL.height=ctx.canvas.width}
  const L=skVL.getContext('2d');L.setTransform(1,0,0,1,0,0);L.globalAlpha=1;L.fillStyle='#fff';L.fillRect(0,0,skVL.width,skVL.height);L.setTransform(sc,0,0,sc,0,0);L.lineCap='round';L.lineJoin='round';
  const clip=(pane,fn)=>{L.save();L.beginPath();L.rect(pane*256,0,256,512);L.clip();fn();L.restore()};
  // the dye concentration varies along each vessel, so it is drawn in short runs of similar strength
  const tube=(pts,cs,w,road,venous)=>{for(const pane of [0,1])clip(pane,()=>{let i=0;
    while(i<pts.length-1){const lv=Math.round(Math.min(1,cs[i])*6);if(lv<=0){i++;continue}
      L.beginPath();let q=skProj(pts[i],pane);L.moveTo(q[0],q[1]);let j=i+1;while(j<pts.length&&Math.round(Math.min(1,cs[j])*6)===lv){q=skProj(pts[j],pane);L.lineTo(q[0],q[1]);j++}
      if(j<pts.length){q=skProj(pts[j],pane);L.lineTo(q[0],q[1])}
      L.globalAlpha=lv/6;
      if(road){L.strokeStyle='rgb(222,215,201)';L.lineWidth=w;L.stroke()}
      else if(venous){L.strokeStyle='rgb(120,112,100)';L.lineWidth=w+0.8;L.stroke();L.strokeStyle='rgb(176,168,154)';L.lineWidth=w;L.stroke()}
      // pen edges, the lumen, and a darker core (more contrast where the X-ray crosses the middle of the artery)
      else{L.strokeStyle='rgb(58,52,46)';L.lineWidth=w+1.3;L.stroke();L.strokeStyle='rgb(150,140,126)';L.lineWidth=w;L.stroke();L.strokeStyle='rgb(96,88,78)';L.lineWidth=Math.max(0.8,w*0.5);L.stroke()}
      i=j}L.globalAlpha=1})};
  const drawVessels=(dist,cf,road)=>{if(!dist)return;for(const id of A.order){const v=A.V[id],D=dist[id];let any=false;const cs=new Array(v.n);for(let i=0;i<v.n;i++){cs[i]=D[i]<Infinity?cf(D[i]):0;if(cs[i]>0.08)any=true}if(any)tube(v.pts,cs,lineFor(v),road,false)}};
  if(o.road)drawVessels(o.road.dist,d=>d<=o.road.front?0.9:0,true);
  if(o.vein&&A.veins)for(const vn of A.veins){const cs=vn.cum.map(x=>o.vein(vn.delay+x/90));if(cs.some(x=>x>0.08))tube(vn.pts,cs,vn.r*1.6,false,true)}
  if(o.dist)drawVessels(o.dist,o.conc||(d=>d<=o.front?Math.min(1,o.fade??1):0),false);
  if(o.perf)for(const pane of [0,1])clip(pane,()=>{const q=skProj(o.perf,pane);const gr=L.createRadialGradient(q[0],q[1],2,q[0],q[1],28);gr.addColorStop(0,'rgba(70,62,54,0.75)');gr.addColorStop(1,'rgba(70,62,54,0)');L.fillStyle=gr;L.beginPath();L.arc(q[0],q[1],28,0,7);L.fill()});
  // the catheter: the guide thick, the microcatheter thin beyond it
  const drawPath=(pts,w,col)=>{for(const pane of [0,1])clip(pane,()=>{L.beginPath();pts.forEach((p,i)=>{const q=skProj(p,pane);i?L.lineTo(q[0],q[1]):L.moveTo(q[0],q[1])});L.strokeStyle=col;L.lineWidth=w;L.stroke()})};
  if(o.cath){const path=skCathPath(A,o.cath);
    if(o.cath.deep&&o.guide){drawPath(o.guide,3,'rgb(70,64,58)');drawPath(o.guide,1.1,'rgb(150,142,130)');drawPath(path,1.2,'rgb(40,36,32)')}else{drawPath(path,3,'rgb(70,64,58)');drawPath(path,1.1,'rgb(150,142,130)')}
    const tip=path[path.length-1],r=o.cath.rot*Math.PI/180;
    for(const pane of [0,1])clip(pane,()=>{const q=skProj(tip,pane),dx=pane===0?Math.sin(r):Math.sin(r)*0.45,dy=-Math.cos(r);
      L.beginPath();L.moveTo(q[0],q[1]);L.quadraticCurveTo(q[0]+dx*4,q[1]+dy*4-2,q[0]+dx*8,q[1]+dy*8);L.strokeStyle='rgb(30,27,24)';L.lineWidth=o.cath.deep?1.5:2.8;L.stroke();
      L.fillStyle='rgb(30,27,24)';L.beginPath();L.arc(q[0]+dx*8,q[1]+dy*8,o.cath.deep?1.1:1.6,0,7);L.fill()})}  // radio-opaque tip marker
  if(o.device==='sr'&&o.clot){const v=A.V[o.clot.vid];for(const pane of [0,1])clip(pane,()=>{L.strokeStyle='rgb(40,36,32)';L.lineWidth=0.8;L.beginPath();for(let s=o.clot.s-o.clot.len/2-3,k=0;s<=o.clot.s+o.clot.len/2+4;s+=1.5,k++){const p=skPt(v,s),q=skProj(p,pane);L.lineTo(q[0]+(k%2?2.4:-2.4),q[1]+(k%2?-1.2:1.2))}L.stroke();
    for(const e of [o.clot.s-o.clot.len/2-3,o.clot.s+o.clot.len/2+4]){const q=skProj(skPt(v,e),pane);L.fillStyle='rgb(30,27,24)';L.beginPath();L.arc(q[0],q[1],1.4,0,7);L.fill()}})} // stent end markers
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='multiply';ctx.drawImage(skVL,0,0);ctx.setTransform(sc,0,0,sc,0,0);
  // film grain and the dark rim of the image intensifier, as on the heart room's monitor
  if(typeof noise!=='undefined'&&noise.length){ctx.globalCompositeOperation='overlay';ctx.globalAlpha=o.cine?0.07:0.15;ctx.drawImage(noise[Math.floor(performance.now()/66)%noise.length],0,0,512,512);ctx.globalAlpha=1}
  ctx.globalCompositeOperation='source-over';
  if(typeof vign!=='undefined'){ctx.drawImage(vign,0,0,256,512);ctx.drawImage(vign,256,0,256,512)}
  // the clot, once marked: a double ring in oxblood ink
  if(o.mark&&o.clot){const v=A.V[o.clot.vid],p=skPt(v,o.clot.s-o.clot.len/2);for(const pane of [0,1]){const q=skProj(p,pane);ctx.strokeStyle='#8A2D1F';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(q[0],q[1],10,0,7);ctx.stroke();ctx.lineWidth=0.6;ctx.beginPath();ctx.arc(q[0],q[1],13,0,7);ctx.stroke()}}
}
/* a small picture for the casebook: the arteries the rare patient is known for */
function skThumb(cv,seed){
  try{const pat=skPatient(seed),A=skAnatomy(pat),cat=skNewCath();let clot=skClot(A,pat);
    if(pat.rare==='basilar'){cat.vid='LVA';cat.s=30}else{cat.s=A.V.AO.len*0.35}
    const dist=skDyeDist(A,cat,clot);skRender(cv.getContext('2d'),{A,image:true,dist,front:1e9,fade:1,cath:cat,clot,mark:pat.rare==='basilar'})}catch(e){}
}

/* ---------- the case ---------- */
function skEl(){
  if(!$('skPanel')){const p=document.createElement('div');p.className='sec';p.id='skPanel';$('caseHead').after(p);
    p.addEventListener('click',skPanelClick)}
  if(!$('skPop')){const d=document.createElement('div');d.className='txpop skpop';d.id='skPop';d.hidden=true;d.setAttribute('role','dialog');d.setAttribute('aria-label','Stroke treatment');$('monitor').appendChild(d);d.addEventListener('click',skPopClick)}
  if(!$('skGuide')){const gd=document.createElement('div');gd.className='guide';gd.id='skGuide';gd.hidden=true;gd.setAttribute('aria-live','polite');$('toast').after(gd)}
}
function skStart(seed,opt={}){
  if(typeof close3D==='function')close3D();
  if(typeof S!=='undefined'&&S&&!S.done&&typeof saveCase==='function')saveCase();
  S=null;skEl();
  const tut=!!opt.tut;if(tut)seed=skTutSeed();
  const dk=tut?'easy':(profile.diff||'easy'),pat=skPatient(seed==null?Math.floor(Math.random()*CODE_SPACE):seed),A=skAnatomy(pat);
  SK={dk,D:DIFFICULTY[dk],W:SK_DIFF[dk]||SK_DIFF.medium,pat,A,cat:skNewCath(),clot:null,t:0,cine:false,runs:[],review:null,inj:null,road:null,roadOn:DIFFICULTY[dk].level===1,
    found:false,gradeOk:null,pending:false,tx:null,passes:0,tici:0,reperfAt:null,emboli:false,sah:null,contrast:0,ak:0,ftime:0,guide:null,done:false,
    ecaInj:0,maxFront:0,hist:[],vhist:[],src:0,dist:null,injOn:false,autoInj:0,toBrain:false,prevB:false,beatT:0,blockedT:0,popKey:'',ctrlT:0,firstPassTici:null,tut:tut?{i:0}:null};
  SK.clot=skClot(A,pat);
  document.body.classList.remove('inmenu','inreport');document.body.classList.add('stroke');
  $('startOv').hidden=true;$('resultOv').hidden=true;$('reviewbar').hidden=true;$('teachNote').hidden=true;
  ['txPop','gradePop','txDot','guide'].forEach(id=>{const e=$(id);if(e)e.hidden=true});
  const ctx=img.getContext('2d');skRender(ctx,{A,image:false});
  $('caseHead').innerHTML=`<h2>Stroke room · ${pat.code} · ${SK.D.label}</h2>${pat.rare&&RARE_BY[pat.rare]?`<p class="task">Rare patient: ${RARE_BY[pat.rare].name}. ${RARE_BY[pat.rare].short}.</p>`:''}<b>${pat.title}</b><p>${pat.pt}. ${pat.hx}</p>
    <p class="task">${SK.D.level>=3?pw('Find the occlusion on angiography and remove the clot.','Find the blocked brain artery with dye and pull the clot out.'):pw(`CT angiogram: occlusion of the ${pat.where}. Confirm it on angiography and remove the clot.`,`The CT scan shows a clot in the ${pat.where}. Find it with dye and pull it out.`)} ${pw('Every minute counts.','Every minute costs brain cells.')}</p>`;
  skPanel(true);skCoach();
  toast(pw('Groin access done: the guide catheter is in the descending aorta. Advance over the arch.','The tube is in, through the top of the leg, and waiting in the main artery. Push it up over the arch.'));
  requestAnimationFrame(skLoop);
}
function skStop(){if(SK){SK.done=true;SK=null}document.body.classList.remove('stroke');const p=$('skPop');if(p)p.hidden=true;const g=$('skGuide');if(g)g.hidden=true}
const skMinutes=()=>SK.pat.door+SK.t*SK.W.rate;
const skSinceGroin=()=>skMinutes()-SK.pat.door;
function skBrainSaved(){const m=(SK.reperfAt??skMinutes())-SK.pat.door;return Math.max(5,Math.round(100-m*1.15))}
function skNihss(){const p=SK.pat.nihss;if(SK.reperfAt!=null)return p;return Math.min(42,p+Math.floor(skSinceGroin()/12)+(SK.sah?6:0))}
let skLast=0;
function skLoop(now){
  if(!SK||SK.done)return;
  const dt=Math.min(0.05,skLast?(now-skLast)/1000:0.016);skLast=now;requestAnimationFrame(skLoop);
  skTick(dt);skDraw();
  SK.uiAcc=(SK.uiAcc||0)+1;if(SK.uiAcc%6===0){skPanel();skPop();skGuide();skTutTick()}
}
function skTick(dt){
  const s=SK,A=s.A,c=s.cat,fl=down('Space','KeyF'),inj=down('KeyJ'),busy=!!(s.tx&&s.tx.stage!=='choose');
  s.t+=dt;if(s.ctrlT>0)s.ctrlT-=dt;
  // turning and moving
  if(!busy&&!s.sah){
    if(down('ArrowRight','KeyD'))c.rot=(c.rot+120*dt)%360;
    if(down('ArrowLeft','KeyA'))c.rot=(c.rot-120*dt+360)%360;
    let ds=0;const sp=c.deep?s.W.micro:s.W.adv;if(down('ArrowUp','KeyW'))ds+=sp*dt;if(down('ArrowDown','KeyS'))ds-=sp*dt;
    if(ds){const imaging=fl||s.cine;const r=skMove(A,c,ds,s.dk,s.clot);
      if(r.entered){if(typeof sfx==='function')sfx('engage');const v=A.V[r.entered];
        toast(r.trap?pw(`That is the ${skName(r.entered)}: it goes to the face, not the brain. Pull back and keep the tip pointing up.`,`Careful: that is the ${skName(r.entered)}, which goes to the face, not the brain. Pull back and keep the tip pointing up.`):`${pw('Into the','Into the')} ${skName(r.entered)}.`,!!r.trap);if(r.trap)s.ecaIn=true}
      if(r.blocked==='deep'&&s.blockedT<=0){s.blockedT=4;toast(pw(`The guide stays in the neck. Press ${shortKey('KeyX')} for the microcatheter to go further.`,`The big tube has to stay in the neck. Press ${shortKey('KeyX')} to send the thin tube (microcatheter) on into the head.`))}
      if(r.retracted)toast(pw('Microcatheter back in the guide.','The thin tube is back inside the big one.'));
      if(!imaging&&Math.abs(ds)>0){s.blind=(s.blind||0)+dt;if(s.blind>1.5&&Math.floor((s.blind-dt)/3)!==Math.floor(s.blind/3))toast(pw('Moving without fluoro. Hold the X-ray on.','Moving the tube without X-ray: hold the X-ray on so you can see it.'),true)}
      // pushing a microcatheter against the end of a small artery can go through the wall
      const v=A.V[c.vid];if(c.deep&&v.end&&c.push>10&&!s.sah){if(s.D.level>=2){s.sah=skPt(v,v.len);c.push=0;toast(pw('Bleed: the wire went through the end of a small artery (subarachnoid haemorrhage). Stop and finish the case.','The wire poked through the end of a small artery: the brain is bleeding (subarachnoid haemorrhage). Stop and finish the case.'),true)}else{c.push=0;toast(pw('Careful: the tip is pushing against the end of a small artery. Pull back.','Careful: the tip is pushing on the end of a tiny artery and could go through it. Pull back.'),true)}}}
    // easier settings: the tip turns itself towards a nearby opening
    if(s.W.seek>0&&!down('ArrowLeft','KeyA','ArrowRight','KeyD')){const nb=skNearBranch(A,c);if(nb&&!nb.child.trap&&nb.dist<6&&(!nb.child.intra||c.deep)){const d=((nb.child.rot-c.rot+540)%360)-180;if(Math.abs(d)<skWindow(A,nb.child,s.dk)+40)c.rot=(c.rot+Math.sign(d)*Math.min(Math.abs(d),s.W.seek*dt)+360)%360}}
  }
  if(s.blockedT>0)s.blockedT-=dt;
  // dye
  // dye: it builds up at the catheter tip while J is held, flows down the arteries with the blood, and washes out
  // slowly once you let go (the same slow fill and fade as the heart room). What reaches the brain drains a few seconds
  // later through the veins and sinuses (the venous phase).
  if(s.autoInj>0)s.autoInj-=dt;
  const injNow=(inj||s.autoInj>0)&&!s.sah;
  if(injNow){s.contrast+=(c.vid==='AO'?8:3.5)*dt*(s.autoInj>0&&!inj?0.6:1);if(c.vid.endsWith('ECA'))s.ecaInj+=dt;
    if(!s.injOn){s.injOn=true;s.dist=skDyeDist(A,c,s.clot);s.injT0=s.t;s.toBrain=A.order.some(id=>A.V[id].intra&&s.dist[id].some(x=>x<Infinity))}}
  else s.injOn=false;
  s.src+=injNow?(1-s.src)*Math.min(1,dt/0.3):-s.src*Math.min(1,dt/1.1);
  while(s.hist.length<=Math.floor(s.t/0.02)){s.hist.push(s.src);s.vhist.push(s.toBrain?s.src:0)}
  if(s.cine&&injNow&&s.dist){s.maxFront=Math.max(s.maxFront,(s.t-s.injT0)*SK_FLOW);s.runDist=s.dist}
  // dose
  if(fl){s.ftime+=dt;s.ak+=0.45*dt}if(s.cine)s.ak+=1.6*dt;
  // the heart monitor still beeps
  s.beatT-=dt;if(s.beatT<=0){s.beatT=60/78;if(typeof sfx==='function'&&typeof SND!=='undefined'&&SND.beat)sfx('beep')}
  // treatment
  const B=down('KeyB'),edge=B&&!s.prevB;s.prevB=B;const tx=s.tx;
  if(tx&&tx.type==='sr'){
    if(tx.stage==='deploy'&&B){tx.dep=Math.min(1,(tx.dep||0)+dt/1.4);if(tx.dep>=1){tx.stage='wait';tx.w=0;if(typeof sfx==='function')sfx('ding');toast(pw('Stent retriever open across the clot. Let it grip for a few seconds.','The mesh stent is open inside the clot. Wait a few seconds for it to grip.'))}}
    else if(tx.stage==='wait'){tx.w+=dt;if(edge){tx.stage='pull';tx.pull=0}}
    else if(tx.stage==='pull'&&B){tx.pull+=dt/3;if(tx.pull>=1)skResolve()}}
  if(tx&&tx.type==='asp'&&tx.stage==='suck'&&B){tx.suck=(tx.suck||0)+dt/4;if(tx.suck>=1)skResolve()}
  // lights on the control strip
  $('lamp').classList.toggle('on',!!(fl||s.cine));document.querySelector('[data-k="Space"]').classList.toggle('on',!!fl);$('bCine').classList.toggle('on',!!s.cine);$('bInj').classList.toggle('on',!!inj);
  ['ArrowLeft','ArrowUp','ArrowDown','ArrowRight'].forEach(k=>document.querySelector(`[data-k="${k}"]`).classList.toggle('on',!!down(k)));
  const hold=document.querySelectorAll('#skPop [data-skhold]');hold.forEach(b=>b.classList.toggle('on',!!B));
}
function skDraw(){
  const s=SK,ctx=img.getContext('2d'),fl=down('Space','KeyF')||s.cine||s.ctrlT>0;
  if(s.review){skRender(ctx,{A:s.A,image:true,dist:s.review.dist,front:s.review.front,fade:1,cath:s.review.cath,guide:s.review.guide,clot:s.clot,mark:s.found});}
  else skRender(ctx,{A:s.A,image:fl,cine:s.cine,dist:s.dist,conc:d=>skHist(s.hist,s.t-d/SK_FLOW),vein:dl=>0.55*skHist(s.vhist,s.t-SK_VEIN_DELAY-dl),road:s.roadOn&&s.road?s.road:null,cath:s.cat,guide:s.guide,clot:s.clot,mark:s.found,device:s.tx&&s.tx.type==='sr'&&s.tx.stage!=='deploy'&&s.tx.stage!=='choose'?'sr':null,perf:s.sah});
  // the text on the image
  const m=skMinutes(),hh=Math.floor(m/60),mm=String(Math.floor(m%60)).padStart(2,'0');
  hudTL.textContent=`${s.pat.code} · ${s.pat.pt}\nNIHSS ${skNihss()}`;
  hudTR.innerHTML=s.review?`<span class="act">REVIEW · FILM ${s.review.id}</span>`:s.cine?'<span class="act">● CINE</span>':fl?'<span class="act">FLUORO</span>':'';
  hudBL.textContent=s.review?pw('Click where the dye column stops','Click where the dye suddenly stops'):fl?'':`Hold ${shortKey('Space')} for X-ray`;
  hudBR.textContent=`${pw('Door to reperfusion','Since arrival')} ${hh}:${mm}${s.reperfAt!=null?' ✓':''}\n${Math.round(s.contrast)} mL · ${Math.round(s.ak)} mGy`;
}
/* recording: C starts and stops a film; the film keeps the fullest dye picture */
function skToggleCine(){
  const s=SK;if(s.review){s.review=null}
  if(!s.cine){s.cine=true;s.maxFront=0;s.runDist=null;if(typeof sfx==='function')sfx('pedal');return}
  s.cine=false;if(typeof sfx==='function')sfx('pedal');
  if(!s.runDist||s.maxFront<20){toast(pw(`No dye in that film. Hold ${shortKey('KeyJ')} while recording.`,`That film had no dye in it: hold ${shortKey('KeyJ')} to inject while it records.`));return}
  const cl=s.clot,showsClot=!!(cl&&(()=>{const v=s.A.V[cl.vid],D=s.runDist[cl.vid];let i=0;while(i<v.n-1&&v.cum[i+1]<cl.s-cl.len/2-2)i++;return D[i]<=s.maxFront})());
  const run={id:s.runs.length+1,dist:s.runDist,front:s.maxFront,cath:{...s.cat,stack:s.cat.stack.map(x=>({...x}))},guide:s.guide,where:skName(s.cat.vid),showsClot};
  s.runs.push(run);s.road={dist:s.runDist,front:s.maxFront};
  toast(`${pw('Film','Film')} ${run.id} ${pw('saved','saved')} · ${run.where}${showsClot&&!s.found?pw(' · open it and click the cut-off',' · open it and click where the dye stops'):''}`);
  skPanel(true);
}
/* X: the microcatheter out of the guide, or back */
function skDeeper(){
  const s=SK,c=s.cat,v=s.A.V[c.vid];
  if(c.deep){if(v.intra){toast(pw('Pull the microcatheter back into the neck first.','Pull the thin tube back down into the neck first.'));return}c.deep=false;s.guide=null;toast(pw('Microcatheter back in the guide.','The thin tube is back inside the big one.'));return}
  if(!/ICA|VA|CCA/.test(c.vid)){toast(pw('Park the guide in a neck artery (carotid or vertebral) first.','First bring the big tube up into a neck artery (carotid or vertebral).'));return}
  c.deep=true;s.guide=skCathPath(s.A,c);toast(pw('Microcatheter and wire out of the guide: you can go into the head now.','The thin tube (microcatheter) is out of the big one: you can now steer into the head.'));if(typeof sfx==='function')sfx('engage');skPanel(true);
}
/* marking the clot on a film */
img.addEventListener('click',e=>{
  if(!SK||SK.done||!SK.review)return;
  const r=img.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*512,y=(e.clientY-r.top)/r.height*512,cl=SK.clot;
  if(!cl){toast(pw('There is no clot left to mark.','Nothing is blocked any more.'));return}
  const p=skPt(SK.A.V[cl.vid],cl.s-cl.len/2),near=[0,1].some(pane=>{const q=skProj(p,pane);return Math.hypot(q[0]-x,q[1]-y)<20});
  if(near&&SK.review.showsClot){SK.pending=true;SK.popKey='';skPop()}
  else toast(SK.review.showsClot?pw('No cut-off there. Click where the dye column stops.','Not there: click where the dye suddenly stops.'):pw('This film does not reach the clot. Film from closer to it.','The dye in this film does not reach the blocked artery. Film again from the right neck artery.'));
});
/* ---------- the side panel ---------- */
function skPanel(force){
  const s=SK;if(!s)return;const el=$('skPanel'),c=s.cat,saved=skBrainSaved();
  const key=[s.runs.length,c.vid,c.deep,s.roadOn,!!s.review,s.found,s.tici,s.passes,Math.round(skMinutes()),skNihss(),!!s.sah].join();if(!force&&key===s.panelKey)return;s.panelKey=key;
  el.innerHTML=`<h2>${pw('The brain','The brain')}</h2>
    <div class="reads"><div class="read"><span>NIHSS</span><b>${skNihss()}</b></div><div class="read"><span>${pw('Brain saved','Brain still savable')}</span><b>${saved}<small>%</small></b><i class="lvl"><b style="width:${saved}%"></b></i></div>
    <div class="read"><span>${pw('Reperfusion','Blood flow')}</span><b>${s.tici?ticiName(s.tici):'–'}<small>${s.tici?'TICI':''}</small></b></div><div class="read"><span>${pw('Passes','Tries')}</span><b>${s.passes}</b></div></div>
    <h2 style="margin-top:8px">${pw('Catheter','The tube')}</h2>
    <div class="status">${pw('Tip in the','Tip in the')} ${skName(c.vid)}${c.deep?pw(' · microcatheter out',' · thin tube out'):''}.</div>
    <div class="row"><button class="btn" data-sk="deep">${c.deep?pw('Microcatheter back','Thin tube back'):pw('Go deeper: microcatheter','Go deeper: thin tube')} <kbd>${shortKey('KeyX')}</kbd></button><button class="btn" data-sk="road" aria-pressed="${s.roadOn}">${pw('Roadmap','Roadmap (ghost of the last film)')}: ${s.roadOn?'on':'off'}</button></div>
    <h2 style="margin-top:8px">${pw('Films','Films')}</h2>
    <div class="runs">${s.runs.length?s.runs.map(r=>`<button class="run${s.review===r?' sel':''}" data-skrun="${r.id}"><b>${pw('Film','Film')} ${r.id}</b><span>${r.where}</span></button>`).join(''):`<div class="empty">${pw(`No films yet. Press ${shortKey('KeyC')} to record, hold ${shortKey('KeyJ')} to inject.`,`No films yet. Press ${shortKey('KeyC')} to record, then hold ${shortKey('KeyJ')} to inject dye.`)}</div>`}</div>
    ${s.review?`<div class="row"><button class="btn" data-sk="live">${pw('Back to live','Back to live')}</button></div>`:''}
    <button class="btn primary" data-sk="finish" ${s.runs.length||s.sah?'':'disabled'}>${pw('Finish and report','Finish and report')}</button>`;
}
function skPanelClick(e){
  const b=e.target.closest('button');if(!b||!SK)return;const d=b.dataset;
  if(d.sk==='deep')skDeeper();
  else if(d.sk==='road'){SK.roadOn=!SK.roadOn;if(SK.roadOn&&!SK.road)toast(pw('Record a film first: the roadmap is its ghost.','Record a film first: the roadmap is a faint copy of it.'))}
  else if(d.sk==='live')SK.review=null;
  else if(d.sk==='finish')skFinish();
  else if(d.skrun){const r=SK.runs.find(x=>x.id===+d.skrun);SK.review=SK.review===r?null:r;if(SK.review&&!SK.found)toast(pw('Click where the dye column stops: that is the clot.','Click where the dye suddenly stops: that is where the clot is.'))}
  skPanel(true);
}
/* ---------- the pop-up: say where the clot is, then pull it out ---------- */
function skPop(){
  const s=SK;if(!s)return;const el=$('skPop'),c=s.cat,cl=s.clot;
  const crossed=!!(cl&&c.deep&&c.vid===cl.vid&&c.s>cl.s+cl.len/2+1.5),atFace=!!(cl&&c.deep&&c.vid===cl.vid&&c.s>=cl.s-cl.len/2-5&&c.s<=cl.s-cl.len/2+1.5);
  const tx=s.tx,key=[s.pending,s.found,!!cl,crossed,atFace,tx&&tx.type,tx&&tx.stage,tx&&Math.round((tx.dep||tx.pull||tx.suck||0)*10),tx&&Math.floor((tx.w||0)*2),s.tici,s.passes,!!s.sah,s.done].join();
  if(key===s.popKey)return;s.popKey=key;
  let h='';
  if(s.pending){h=`<div class="txhead"><b>${pw('Where is the clot?','Where is the clot?')}</b></div><div class="pending"><div>${pw('Name the occluded segment.','Which artery is blocked?')}</div>
    <div class="sev sksites">${['ICA-T','M1','M2','BA'].map(k=>`<button data-sksite="${k}">${skSite(k)}</button>`).join('')}</div><div class="row"><button class="btn" data-skx="1">${pw('Not sure yet','Not sure yet')}</button></div></div>`}
  else if(s.found&&!s.sah){
    if(!tx||tx.stage==='choose'){
      const res=s.tici?`<div class="${s.tici>=2.5?'ffrread ok':'alert'}"><b>${pw('Control run','After that try')}: TICI ${ticiName(s.tici)}</b><span>${TICI_TXT[s.tici]}.</span></div>`:'';
      h=`<div class="txhead"><b>${cl?pw('Remove the clot','Pull the clot out'):pw('Artery open','Artery open')}</b></div><div class="pending">${res}
        ${cl?`<div>${pw(`Clot in the ${skName(cl.vid)}.`,`The clot is in the ${skName(cl.vid)}.`)} ${c.deep?'':pw(`Bring the guide into the neck and press ${shortKey('KeyX')} for the microcatheter.`,`Bring the big tube up the neck, then press ${shortKey('KeyX')} for the thin tube.`)}</div>
        <div class="tools"><button class="btn" data-sktool="sr" ${crossed?'':'disabled'}><b>${pw('Stent retriever','Mesh stent (stent retriever)')}</b><span>${crossed?pw('Microcatheter is across the clot','Ready: the tube is through the clot'):pw('First cross the clot with the microcatheter','First push the thin tube through the clot')}</span></button>
        <button class="btn" data-sktool="asp" ${atFace?'':'disabled'}><b>${pw('Aspiration','Suction tube (aspiration)')}</b><span>${atFace?pw('Tip is at the clot face','Ready: the tip is touching the clot'):pw('Stop with the tip at the clot face','Stop with the tip just touching the clot')}</span></button></div>`:''}
        <div class="row">${s.tici>=2.5||s.passes>=1?`<button class="btn${!cl?' primary':''}" data-sk2="finish">${pw('Finish the case','Finish the case')}</button>`:''}</div></div>`}
    else if(tx.type==='sr'){
      const w=tx.w||0,zone=w<1.5?'too soon':w<3?'nearly':w<=6?'just right':w<=9?'still good':'long enough';
      h=`<div class="txhead"><b>${pw('Stent retriever','Mesh stent')}</b></div><div class="pending">
        ${tx.stage==='deploy'?`<div>${pw('Hold to unsheathe the stent across the clot.','Hold to open the mesh stent inside the clot.')}</div><i class="gmeter"><b style="width:${Math.round((tx.dep||0)*100)}%"></b></i>`
        :tx.stage==='wait'?`<div>${pw('Let it integrate with the clot: 3 to 6 seconds is ideal. Then hold to pull back with suction.','Let it grip the clot: 3 to 6 seconds is best. Then hold to pull it back with suction.')}</div><i class="gmeter skwait"><b style="width:${Math.min(100,w/9*100)}%"></b></i><div class="fine">${Math.floor(w)} s · ${zone}</div>`
        :`<div>${pw('Pulling back under suction. Keep holding.','Pulling the clot back with suction. Keep holding.')}</div><i class="gmeter"><b style="width:${Math.round((tx.pull||0)*100)}%"></b></i>`}
        <div class="row"><button class="hold" data-skhold="1"><span>${tx.stage==='deploy'?pw('Open','Open'):pw('Pull','Pull')}</span><kbd>${shortKey('KeyB')}</kbd></button></div></div>`}
    else{h=`<div class="txhead"><b>${pw('Aspiration','Suction')}</b></div><div class="pending"><div>${pw('Hold for suction with the tip on the clot; it comes out with the catheter.','Hold to suck on the clot; the tube comes out with it.')}</div><i class="gmeter"><b style="width:${Math.round((tx.suck||0)*100)}%"></b></i>
        <div class="row"><button class="hold" data-skhold="1"><span>${pw('Suction','Suck')}</span><kbd>${shortKey('KeyB')}</kbd></button></div></div>`}
  }
  else if(s.sah){h=`<div class="txhead"><b>${pw('Bleed in the brain','Bleeding in the brain')}</b></div><div class="alert"><b>${pw('Subarachnoid haemorrhage','Brain bleed (subarachnoid haemorrhage)')}</b><span>${pw('Stop: no more passes. Finish the case.','Stop here: no more tries. Finish the case.')}</span></div><div class="row"><button class="btn primary" data-sk2="finish">${pw('Finish the case','Finish the case')}</button></div>`}
  el.hidden=!h;el.innerHTML=h;
}
function skPopClick(e){
  const b=e.target.closest('button');if(!b||!SK)return;const d=b.dataset,s=SK;
  if(d.sksite){s.pending=false;s.found=true;s.gradeOk=d.sksite===s.clot.site;s.review=null;toast(pw('Clot marked. Now take the microcatheter up to it.','Clot marked. Now steer the thin tube up to it.'));if(typeof sfx==='function')sfx('ding')}
  else if(d.skx){s.pending=false}
  else if(d.sktool==='sr')s.tx={type:'sr',stage:'deploy',dep:0};
  else if(d.sktool==='asp')s.tx={type:'asp',stage:'suck',suck:0};
  else if(d.sk2==='finish'){skFinish();return}
  s.popKey='';skPop();skPanel(true);
}
$('monitor').addEventListener('pointerdown',e=>{if(SK&&e.target.closest('[data-skhold]')){e.preventDefault();keys.btn_KeyB=true}});
/* one pass: how well it went depends on the site, the device, how long the stent gripped, and the setting */
function skResolve(){
  const s=SK,tx=s.tx,cl=s.clot;s.passes++;
  const base={sr:{'ICA-T':0.5,M1:0.64,M2:0.56,BA:0.56},asp:{'ICA-T':0.46,M1:0.58,M2:0.62,BA:0.62}}[tx.type][cl.site];
  let f=1;if(tx.type==='sr'){const w=tx.w;f=w<1.5?0.45:w<3?0.8:w<=6?1:w<=9?0.95:0.85}
  const diffF={story:1.3,easy:1.15,medium:1,hard:0.9}[s.dk]||1,p=Math.min(0.95,base*f*diffF*Math.pow(0.9,s.passes-1)),r=Math.random();
  let tici=r<p*0.55?3:r<p?2.5:(Math.random()<0.3?2:1);
  if(s.tut)tici=tx.type==='sr'&&(tx.w<3||tx.w>6)?2.5:3; // the tutorial pass always works
  s.tx=null;
  if(tici>=2.5){
    s.tici=Math.max(s.tici,tici);if(s.reperfAt==null)s.reperfAt=skMinutes();if(s.passes===1)s.firstPassTici=tici;
    // a fragment can break off into a smaller branch
    const emb=tici===2.5&&(cl.site==='M1'||cl.site==='ICA-T')&&Math.random()<0.3;
    if(emb){const id=s.pat.side+(Math.random()<0.5?'M2s':'M2i'),v=s.A.V[id];s.clot={vid:id,s:v.len*0.45,len:6,site:'M2',emb:true};s.emboli=true;
      toast(pw('TICI 2b: most of the territory is back. A fragment went into an M2 branch: stop here or go after it.','Most of the area has blood flow again (TICI 2b). A small piece broke off into a branch: you can stop, or go after it.'))}
    else{s.clot=null;toast(tici===3?pw('TICI 3: complete reperfusion.','Complete blood flow restored (TICI 3).'):pw('TICI 2b: most of the territory is flowing again.','Most of the area has blood flow again (TICI 2b).'))}
    if(typeof sfx==='function')sfx('chime');
  }else{s.tici=Math.max(s.tici,tici);toast(pw(`No luck this pass: ${TICI_TXT[tici]}. Try again.`,`The clot did not come out this time (${TICI_TXT[tici]}). Try again.`),true)}
  // the device comes out; the tip falls back towards the neck; a control run shows the result
  skMove(s.A,s.cat,-30,s.dk,null);
  s.injOn=false;s.autoInj=1.2;s.ctrlT=4;
  s.popKey='';skPop();skPanel(true);
}
/* the steering guide (Story and Easy) */
function skRoute(){const s=SK,A=s.A,target=s.clot?s.clot.vid:null;if(!target)return [];const r=[];let v=A.V[target];while(v){r.unshift(v.id);v=v.parent?A.V[v.parent]:null}if(target==='BA'&&!r.includes('LVA')){/* already via LVA */}return r}
function skGuide(){
  const s=SK,el=$('skGuide');if(!el)return;if(s.D.level!==1||s.review||s.sah||!s.clot){el.hidden=true;return}
  const A=s.A,c=s.cat,route=skRoute(),k=id=>`<kbd>${shortKey(id)}</kbd>`;let t='';
  const idx=route.indexOf(c.vid);
  if(s.tx&&s.tx.stage!=='choose'){t=s.tx.type==='sr'?(s.tx.stage==='wait'?`Wait until the bar is in the middle, then hold ${k('KeyB')} to pull.`:`Hold ${k('KeyB')}.`):`Hold ${k('KeyB')} for suction.`}
  else if(!s.runs.length&&!s.found&&idx>=0&&/ICA|VA$/.test(c.vid)&&!c.deep){t=`Good spot to film: press ${k('KeyC')} to record, hold ${k('KeyJ')} for dye, then ${k('KeyC')} to stop.`}
  else if(idx<0){t=`Wrong branch (${skName(c.vid)}): pull back ${k('ArrowDown')}.`}
  else if(idx===route.length-1){const v=A.V[c.vid],face=s.clot.s-s.clot.len/2;
    if(!s.found)t=s.runs.length?`Open your film and click where the dye stops.`:`Film here (${k('KeyC')} + ${k('KeyJ')}), open the film and click where the dye stops.`;
    else if(!c.deep&&skPt(v,face)[1]>v.guideMaxY)t=`Press ${k('KeyX')} to send the thin tube on into the head.`;
    else if(c.s<face-6)t=`Push up ${k('ArrowUp')} towards the clot.`;
    else t=`At the clot: push ${k('ArrowUp')} through it for the mesh stent, or stop just before it for suction.`}
  else{const next=A.V[route[idx+1]],v=A.V[c.vid],dist=next.os>=v.len-0.5?v.len-c.s:next.os-c.s;
    if(next.intra&&!c.deep)t=s.found?`Press ${k('KeyX')} to send the thin tube on into the head.`:(s.runs.length?`Open your film and click where the dye stops.`:`Film first: ${k('KeyC')} to record, hold ${k('KeyJ')} for dye.`);
    else if(dist>14||(dist>4&&skPick(A,{...c,s:Math.max(c.s,next.os>=v.len-0.5?v.len:next.os)},s.dk)===next))t=`Push up ${k('ArrowUp')} towards the opening of the ${skName(next.id)}.`;
    else if(dist<-4)t=`You passed it: pull back ${k('ArrowDown')} a little.`;
    else{const d=((next.rot-c.rot+540)%360)-180,pick=skPick(A,{...c,s:Math.max(c.s,next.os>=v.len-0.5?v.len:next.os)},s.dk);t=pick===next&&Math.abs(d)<=skWindow(A,next,s.dk)*0.7?`Lined up: push ${k('ArrowUp')} into the ${skName(next.id)}.`:`Turn ${d>0?'clockwise '+k('ArrowRight'):'anticlockwise '+k('ArrowLeft')} towards the ${skName(next.id)}${pick&&pick!==next?` (now it points into the ${skName(pick.id)})`:''}.`}}
  if(!(down('Space','KeyF')||s.cine)&&!/film|Film|Hold/.test(t))t=`Hold ${k('Space')} for X-ray, then: `+t.charAt(0).toLowerCase()+t.slice(1);
  el.hidden=false;if(el.dataset.t!==t){el.innerHTML=t;el.dataset.t=t}
}
/* ---------- the report ---------- */
function skFinish(){
  const s=SK;if(!s||s.done)return;s.done=true;s.cine=false;keys.btn_KeyB=false;
  if(s.tut){profile.skTutDone=true;saveProfile();$('coach').hidden=true}
  const rows=[],notes=[],gtr=s.reperfAt!=null?s.reperfAt-s.pat.door:null;
  const rep=s.tici>=3?40:s.tici>=2.5?32:s.tici>=2?12:0;rows.push([`${pw('Reperfusion','Blood flow restored')} (TICI ${s.tici?ticiName(s.tici):'0'})`,rep,40]);
  const spd=gtr==null?0:Math.round(20*Math.max(0,Math.min(1,1-(gtr-20)/60)));rows.push([`${pw('Speed','Speed')}: ${gtr==null?pw('not reperfused','no flow restored'):pw(`groin to reperfusion ${Math.round(gtr)} min`,`${Math.round(gtr)} min from the groin to flow`)}`,spd,20]);
  const dx=s.found?(s.gradeOk?15:9):0;rows.push([pw('Finding the occlusion','Finding the clot'),dx,15]);
  const ps=s.tici>=2.5?(s.firstPassTici?10:Math.max(0,10-3*(s.passes-1))):0;rows.push([`${pw('Passes','Tries')}: ${s.passes}${s.firstPassTici?pw(' (first-pass effect)',' (first try)'):''}`,ps,10]);
  let saf=15;if(s.sah)saf-=12;if(s.ecaInj>0.3)saf-=2;if(s.contrast>120)saf-=Math.min(4,Math.floor((s.contrast-120)/15));if(s.ak>500)saf-=2;saf=Math.max(0,saf);rows.push([`${pw('Safety and dose','Safety and dose')} (${Math.round(s.contrast)} mL, ${Math.round(s.ak)} mGy)`,saf,15]);
  let total=rows.reduce((a,r)=>a+r[1],0);if(s.sah)total=Math.min(total,40);
  if(s.found)notes.push({c:s.gradeOk?'good':'',t:s.gradeOk?pw(`You found the clot in the ${skSite(s.pat.site)}.`,`You found the clot in the ${skSite(s.pat.site)}.`):pw(`Found the cut-off, but it was the ${skSite(s.pat.site)}.`,`You found the clot, but it was in the ${skSite(s.pat.site)}.`)});
  else notes.push({c:'bad',t:pw('The occlusion was never marked on a film.','The clot was never marked on a film.')});
  if(s.tici>=2.5)notes.push({c:'good',t:pw(`Reperfusion TICI ${ticiName(s.tici)} after ${s.passes} pass${s.passes===1?'':'es'}${gtr!=null?`, ${Math.round(gtr)} minutes after the groin puncture`:''}.`,`Blood flow restored (TICI ${ticiName(s.tici)}) after ${s.passes} tr${s.passes===1?'y':'ies'}${gtr!=null?`, ${Math.round(gtr)} minutes after the start`:''}.`)});
  else notes.push({c:'bad',t:pw('The artery was not opened (TICI 2b or better is the aim).','The artery was not opened (the aim is most of the territory flowing, TICI 2b or better).')});
  if(s.emboli)notes.push({c:s.clot?'':'good',t:s.clot?pw('A fragment was left in an M2 branch.','A small piece of clot was left in a branch.'):pw('A fragment went distal, and you retrieved it too.','A small piece broke off and you got that out too.')});
  if(s.sah)notes.push({c:'bad',t:pw('Subarachnoid haemorrhage from the wire pushing through a distal branch: score capped at 40.','The wire went through the end of a small artery and caused a brain bleed: score capped at 40.')});
  if(s.ecaInj>0.3)notes.push({c:'',t:pw('Dye was injected into the external carotid: that films the face, not the brain.','Dye went into the artery to the face, not the brain.')});
  const indep=s.tici>=2.5?Math.max(1,Math.min(8,Math.round((0.72-(gtr||60)*0.006-s.pat.nihss*0.012)*10))):1;
  notes.push({c:'',t:pw(`About ${indep} in 10 patients like this would be walking independently at three months (mRS 0–2). Every 10 minutes sooner adds roughly one more in 100.`,`About ${indep} in 10 people like this would be walking on their own three months later. Every 10 minutes sooner helps about one more person in 100.`)});
  const earned=Math.round(total/10*s.D.tokenX);profile.tokens+=earned;saveProfile();
  // shared progression: streak, grade, badges, casebook
  let achRes=null,fresh=null;
  if(typeof recordCasebook==='function')fresh=recordCasebook({rare:s.pat.rare,code:s.pat.code,seed:s.pat.seed,title:s.pat.title},total);
  if(typeof recordCase==='function')achRes=recordCase({score:total,diff:s.dk,level:s.D.level,daily:null,sig:0,opened:0,sigAll:0,graded:0,comps:[],
    S:{complication:null,budget:120,contrast:s.contrast,ftime:s.ftime,blind:99,ffr:[],stents:[],d2b:null,whips:0,weekly:null,c:{rare:s.pat.rare}},
    stroke:{tici:s.tici,passes:s.passes,gtr,first:s.firstPassTici}});
  if(achRes)achRes.fresh.forEach((a,i)=>setTimeout(()=>toast(`Achievement: ${a.name} · +${a.t} tokens`),600+i*1800));
  if(typeof sfx==='function'&&(fresh||(achRes&&achRes.fresh.length)))setTimeout(()=>sfx('chime'),350);
  const grade=s.sah?'Complication':total>=85?pw('Attending standard','Expert work'):total>=70?pw('Senior fellow','Very good'):total>=50?pw('Junior fellow','Good start'):pw('Keep practising','Keep practising');
  const ov=$('resultOv');document.body.classList.add('inreport');$('skPop').hidden=true;$('skGuide').hidden=true;
  ov.innerHTML=`<div class="rephead">${avatarSVG(profile.avatar,48)}<div><h1>${pw('Stroke report','Stroke report')} · ${s.pat.code}</h1><span class="fine">${esc(profile.name)} · ${s.D.label} · ${s.pat.title}</span></div></div>
    <div class="score"><b>${total}</b><span>${grade}</span></div>
    <div class="tokens">${CUP} +${earned} coffee token${earned===1?'':'s'} · ${profile.tokens} banked</div>
    ${fresh&&typeof casebookReportHTML==='function'?casebookReportHTML(fresh):''}
    ${typeof achReportHTML==='function'?achReportHTML(achRes):''}
    <div class="rows">${rows.map(r=>`<span>${r[0]}</span><span class="v">${Math.round(r[1])} / ${r[2]}</span>`).join('')}</div>
    <div class="notes">${notes.map(n=>`<div class="${n.c}">${n.t}</div>`).join('')}</div>
    <div class="row"><button class="btn primary" id="skNew">${pw('New stroke patient','New stroke patient')}</button><button class="btn" id="skAgain">${pw('Repeat this patient','Repeat this patient')}</button><button class="btn" id="skMenu">${pw('Main menu','Main menu')}</button></div>`;
  ov.hidden=false;window.scrollTo(0,Math.max(0,$('monitor').offsetTop-8));
  const seed=s.pat.seed;$('skNew').onclick=()=>skStart(null);if(s.tut)$('skNew').textContent=pw('Your first real stroke patient','Your first real stroke patient');$('skAgain').onclick=()=>skStart(seed);$('skMenu').onclick=()=>showMenu('home');
}
/* ---------- the stroke tutorial: one patient, a coach card, one step at a time ---------- */
function skTutSeed(){for(let i=1;i<20000;i++){const sd=(i*7919)%CODE_SPACE,p=skPatient(sd);if(p.site==='M1'&&p.side==='L'&&p.arch==='I'&&!p.bovine)return sd}return 1}
const skReached=id=>SK.cat.vid===id||SK.cat.stack.some(x=>x.vid===id);
const SK_TUT=[
  {title:'X-ray on',text:()=>`Hold ${kk('Space')} (or the X-ray button) to switch the X-ray on. You see two views at once: the front on the left, the side on the right. The tube is waiting in the main artery from the heart (the aorta), at the bottom.`,done:s=>s.ftime>0.6},
  {title:'Into the left neck artery',text:()=>`Keep the X-ray on and hold ${kk('ArrowUp')} to push the tube up and over the arch. The left neck artery (left common carotid) is the second branch. The guide under the X-ray says when to turn the tip up into it.`,done:()=>skReached('LCCA')},
  {title:'Up the neck',text:()=>`Push on up the neck. At the fork, keep the tip pointing up to go into the internal carotid (to the brain), not the external carotid (to the face).`,done:()=>skReached('LICA')},
  {title:'Film it',text:()=>`Press ${kk('KeyC')} to record, hold ${kk('KeyJ')} for about two seconds to inject dye, then press ${kk('KeyC')} to stop. The dye fills the brain's arteries, except beyond the clot.`,done:s=>s.runs.some(r=>r.showsClot)},
  {title:'Find the clot',text:()=>`Open Film 1 under Films. Click where the dye column suddenly stops, then say which artery it is: the main middle brain artery (M1).`,done:s=>s.found},
  {title:'Go deeper',text:()=>`The big tube cannot go into the skull. Push up to the top of the neck, then press ${kk('KeyX')}: a thin tube (microcatheter) comes out of it and can go into the head.`,done:s=>s.cat.deep},
  {title:'Through the clot',text:()=>`Steer the thin tube into the M1 (the guide shows which way) and push right through the clot. The mesh stent button in the pop-up turns ready.`,done:s=>!!(s.clot&&s.cat.vid===s.clot.vid&&s.cat.s>s.clot.s+s.clot.len/2+1.5)||s.passes>0},
  {title:'Open the stent',text:()=>`In the pop-up choose the mesh stent (stent retriever), then hold ${kk('KeyB')} to open it inside the clot.`,done:s=>!!(s.tx&&s.tx.stage!=='deploy')||s.passes>0},
  {title:'Grip, then pull',text:()=>`Let go of ${kk('KeyB')} and wait 3 to 6 seconds while it grips (watch the bar). Then hold ${kk('KeyB')} to pull it back with suction.`,done:s=>s.passes>0},
  {title:'Check and finish',text:()=>`The control run shows the blood flowing again (TICI). Press Finish the case for your report.`,done:s=>s.done},
];
const kk=id=>`<kbd>${shortKey(id)}</kbd>`;
function skCoach(){
  const el=$('coach');if(!SK||!SK.tut){if(SK)el.hidden=true;return}
  const st=SK_TUT[SK.tut.i];if(!st){el.hidden=true;return}
  el.hidden=false;el.innerHTML=`<div class="coachhead"><b>Stroke tutorial · step ${SK.tut.i+1} of ${SK_TUT.length} · ${st.title}</b><button class="btn" data-skcoach="skip">Skip tutorial</button></div><p>${typeof glossLink==='function'?glossLink(st.text()):st.text()}</p>
    <div class="coachdots">${SK_TUT.map((_,i)=>`<i class="${i<SK.tut.i?'done':i===SK.tut.i?'now':''}"></i>`).join('')}</div>`;
}
function skTutTick(){
  const s=SK;if(!s||!s.tut)return;const st=SK_TUT[s.tut.i];
  if(st&&st.done(s)){s.tut.i++;const nx=SK_TUT[s.tut.i];if(nx)toast(`✓ ${st.title}. Next: ${nx.title.toLowerCase()}.`);skCoach()}
}
$('coach').addEventListener('click',e=>{const b=e.target.closest('[data-skcoach]');if(!b||!SK)return;SK.tut=null;profile.skTutDone=true;saveProfile();$('coach').hidden=true;toast('Tutorial skipped. You can replay it from the Stroke room.')});
function skTutorial(){if(profile&&!profile.skIntroSeen&&typeof openStrokeIntro==='function')openStrokeIntro(()=>skStart(null,{tut:true}));else skStart(null,{tut:true})}
/* ---------- menu: the stroke room folder and chart ---------- */
function skChart(D){
  return `<div class="chead"><h2>${pw('Stroke room','Stroke room')}</h2><span class="meta">${pw('Mechanical thrombectomy','Pulling a clot out of a brain artery')} · ${D.label}</span></div>
    <dl><dt>${pw('The job','The job')}</dt><dd>${pw('A large-vessel stroke: a clot is blocking an artery in the brain. Steer up over the arch into the right neck artery, film to find where the dye stops, take the microcatheter into the head and pull the clot out.','A clot is blocking an artery in the brain. Steer the tube up into the neck, film with dye to find where it stops, send the thin tube into the head and pull the clot out.')}</dd>
    <dt>${pw('New here','New here')}</dt><dd>${pw('Two views at once (front and side), a roadmap ghost of your last film, the microcatheter (X), the stent retriever and aspiration, and the stroke clock: every minute costs brain.','Two X-ray views at once (front and side), a faint ghost of your last film to steer by, a thin tube for the head (X), a mesh stent or a suction tube, and a clock: every minute costs brain cells.')}</dd>
    <dt>${pw('Controls','Controls')}</dt><dd>${pw('The same keys as the heart room. B opens and pulls the stent retriever, or holds suction.','The same keys as the heart room. B opens and pulls the mesh stent, or holds suction.')}</dd></dl>
    ${profile.skTutDone?`<button class="btn primary go" data-act="stroke">Start a stroke case</button><div class="row"><button class="btn" data-act="sktut">Tutorial again</button><button class="btn" data-act="skintro">How a thrombectomy works (1 min)</button></div>`
      :`<button class="btn primary go" data-act="sktut">Start the stroke tutorial</button><div class="row"><button class="btn" data-act="stroke">Skip it: start a case</button><button class="btn" data-act="skintro">How a thrombectomy works (1 min)</button></div>`}`;
}
/* ---------- wiring into the shared game ---------- */
{const sm=showMenu;window.showMenu=function(v){skStop();return sm(v)}}
{const sc=startCase;window.startCase=function(ci,opt){skStop();return sc(ci,opt)}}
{const tc=toggleCine;window.toggleCine=function(){if(SK&&!SK.done){skToggleCine();return}return tc()}}
{const ex=exchangeTo;window.exchangeTo=function(t){if(SK&&!SK.done){skDeeper();return}return ex(t)}}
$('bCine').addEventListener('click',e=>{if(SK&&!SK.done){e.stopImmediatePropagation();skToggleCine()}},true);
