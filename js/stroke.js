/* Cath Lab Run: the stroke room. Mechanical thrombectomy for a large-vessel stroke, using the shared monitor, controls,
   pop-up styles, sound, settings, plain words and progression. The anatomy, steering and dye are in js/stroke-sim.js.
   A case: the guide starts up the neck artery that leads to the clot (the X-ray shows only the head and upper neck);
   film with dye to find where the dye column stops (the clot), mark it, take the microcatheter (X) into the head, then pull the clot out with a stent retriever (open it,
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
/* the head and neck on X-ray, in both views. The bone comes from assets/skull-xray.png, an X-ray passed through a 3D
   model of the skull, face, spine and upper chest (tools/skull-model.js, made with tools/render_skull.html): red is
   how much bone each ray crossed, green the ink contours (cortex seen edge-on), blue the soft tissue. Here it is
   laid on paper as a graphite wash and engraved: line screens whose lines thicken with density, crossed where it
   is denser, as the heart room's X-ray. */
/* the picture shows only the head and upper neck: frame rows SK_VY to SK_VY+256 (skull top to C2), two square views */
const SK_VY=14,SK_VH=256;
let skBgCanvas=null;const skBgCache={};let skSkullData=null;
const skSkull=new Image();
skSkull.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');x.drawImage(skSkull,0,0);skSkullData=x.getImageData(0,0,1024,1024).data}catch(e){skSkullData='img'}
  for(const k in skBgCache)delete skBgCache[k];skBgCanvas=null};
skSkull.src='assets/skull-xray.png?v=2';
/* the brain in both views, in faint ink: lobes, the main fissures and sulci, the corpus callosum and ventricles, the
   brainstem and cerebellum. Drawn in the same coordinates as the arteries, so the middle cerebral runs in the Sylvian
   fissure, the pericallosal artery over the corpus callosum and the basilar on the front of the pons. */
function skBrain(g){
  const lat=([z,y])=>[384-1.05*z,400-y],ap=([x,y])=>[128+x,400-y];
  const curve=(pts,map,closed)=>{const q=pts.map(map);g.beginPath();if(closed){const m0=[(q[q.length-1][0]+q[0][0])/2,(q[q.length-1][1]+q[0][1])/2];g.moveTo(...m0);
      for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length];g.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2)}g.closePath()}
    else{g.moveTo(...q[0]);for(let i=1;i<q.length-1;i++){const a=q[i],b=q[i+1];g.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2)}g.lineTo(...q[q.length-1])}};
  const pen=(al,w,fill)=>{g.strokeStyle=`rgba(29,27,25,${al})`;g.lineWidth=w;g.stroke();if(fill){g.fillStyle=fill;g.fill()}};
  g.save();g.lineCap='round';g.lineJoin='round';
  /* ---- side view (z forwards, y up) ---- */
  g.save();g.beginPath();g.rect(256,0,256,512);g.clip();
  // cerebrum: frontal pole, over the convexity to the occipital pole, under the occipital lobe on the tentorium,
  // round the temporal lobe in the middle fossa and its pole, then under the frontal lobe on the orbital roofs
  const cer=[[82,262],[80,290],[66,320],[42,346],[10,362],[-26,364],[-58,350],[-84,324],[-100,292],[-106,264],[-100,246],[-84,240],[-62,242],[-46,246],
    [-38,232],[-30,214],[-12,204],[12,203],[30,207],[40,216],[38,228],[30,236],[44,241],[62,244],[76,250]];
  curve(cer,lat,true);pen(0.62,1.1,'rgba(239,233,220,0.18)');
  curve([[30,236],[14,248],[-8,256],[-30,266],[-46,278],[-52,292]],lat);pen(0.55,0.9);                       // Sylvian (lateral) fissure
  curve([[-46,278],[-40,290]],lat);pen(0.4,0.7);curve([[18,246],[22,258]],lat);pen(0.35,0.6);                 // its posterior and anterior ascending rami
  curve([[-24,363],[-18,344],[-10,322],[-2,300],[4,282],[8,266]],lat);pen(0.5,0.85);                         // central sulcus
  curve([[-6,364],[0,344],[8,322],[16,300],[20,282]],lat);pen(0.32,0.6);                                     // precentral sulcus
  curve([[-40,358],[-34,338],[-26,316],[-20,296],[-16,280]],lat);pen(0.32,0.6);                              // postcentral sulcus
  curve([[30,354],[44,336],[56,316],[66,296]],lat);pen(0.28,0.55);curve([[36,300],[48,290],[62,284],[74,276]],lat);pen(0.28,0.55); // superior and inferior frontal sulci
  curve([[-36,318],[-52,312],[-70,300],[-86,292]],lat);pen(0.28,0.55);                                       // intraparietal sulcus
  curve([[-82,326],[-90,310],[-94,294]],lat);pen(0.25,0.5);curve([[-88,276],[-100,266]],lat);pen(0.25,0.5);  // parieto-occipital, lateral occipital
  curve([[32,224],[14,232],[-8,240],[-30,250],[-50,262],[-62,272]],lat);pen(0.32,0.6);                       // superior temporal sulcus
  curve([[26,214],[6,218],[-14,226],[-32,236]],lat);pen(0.26,0.5);                                           // inferior temporal sulcus
  // corpus callosum (on the midline, seen through the hemisphere) and the lateral ventricle under it
  curve([[40,282],[44,292],[34,304],[8,312],[-30,310],[-58,300],[-66,286],[-56,284],[-30,298],[6,302],[30,296],[34,286]],lat,true);pen(0.38,0.7,'rgba(29,27,25,0.05)');
  curve([[32,282],[26,292],[2,296],[-28,292],[-50,282],[-60,268],[-74,262],[-56,270],[-40,272],[-36,262],[-28,246],[-10,240],[8,236],[-14,248],[-30,262],[-26,278],[0,284],[24,282]],lat,true);pen(0.3,0.6,'rgba(239,233,220,0.25)');
  // brainstem: midbrain, the bulge of the pons (the basilar runs on its front), medulla down to the foramen magnum
  curve([[-14,268],[-12,252],[-14,238],[-20,222],[-28,204],[-32,188]],lat);pen(0.5,0.9);
  curve([[-32,266],[-38,250],[-38,232],[-40,214],[-42,200],[-44,188]],lat);pen(0.5,0.9);
  // cerebellum under the tentorium, with its folia
  curve([[-40,234],[-58,240],[-84,236],[-100,222],[-96,200],[-76,190],[-52,192],[-42,206]],lat,true);pen(0.55,1,'rgba(29,27,25,0.04)');
  for(const [y,w] of [[228,0.4],[220,0.35],[212,0.35],[204,0.3]])curve([[-44,y-2],[-62,y+3],[-80,y+1],[-94,y-6]],lat),pen(w*0.7,0.5);
  g.restore();
  /* ---- front view (x to the patient's left, y up) ---- */
  g.save();g.beginPath();g.rect(0,0,256,512);g.clip();
  for(const sx of [-1,1]){const m=([x,y])=>[sx*x,y];
    // one hemisphere: from the top of the midline out over the convexity, down to the temporal lobe in the middle fossa,
    // in under it and up to the midline over the brainstem
    curve([[2,360],[26,358],[50,344],[70,318],[80,288],[81,260],[78,238],[72,220],[62,208],[48,204],[36,210],[28,222],[18,236],[8,244],[2,250]].map(m),ap);pen(0.62,1.1);
    curve([[22,246],[34,250],[48,252],[62,256],[72,264]].map(m),ap);pen(0.55,0.9);                                   // Sylvian fissure (the M1 runs in it)
    curve([[40,262],[36,250],[38,238],[46,232]].map(m),ap);pen(0.3,0.6);                                              // insula
    curve([[14,354],[28,346],[38,336]].map(m),ap);pen(0.3,0.55);curve([[52,330],[62,316],[70,300]].map(m),ap);pen(0.3,0.55);curve([[74,282],[76,270]].map(m),ap);pen(0.28,0.5); // sulci on the convexity
    curve([[56,226],[46,220],[36,224]].map(m),ap);pen(0.28,0.55);                                                     // temporal sulcus
    curve([[4,290],[16,292],[24,284],[22,276],[12,280],[6,286]].map(m),ap,true);pen(0.32,0.6,'rgba(239,233,220,0.3)'); // frontal horn of the lateral ventricle
    curve([[4,300],[22,304],[34,296]].map(m),ap);pen(0.38,0.7);                                                       // corpus callosum
    curve([[10,214],[24,226],[44,228],[54,214],[46,196],[24,192],[10,200]].map(m),ap,true);pen(0.45,0.85);            // cerebellar hemisphere
    curve([[13,262],[12,244],[14,228],[11,210],[8,192]].map(m),ap);pen(0.5,0.85)}                                     // brainstem
  curve([[0,360],[0,330],[0,304]],ap);pen(0.5,0.8);                                                                   // interhemispheric fissure
  curve([[0,286],[0,270]],ap);pen(0.35,0.6);                                                                          // septum and third ventricle
  g.restore();g.restore();
}
function skBg(S=2){
  if(skBgCache[S])return skBgCache[S];
  const N=512*S,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');g.scale(S,S);
  g.fillStyle='#EFE9DC';g.fillRect(0,0,512,512);
  if(skSkullData==='img'){g.globalAlpha=0.55;g.globalCompositeOperation='multiply';g.drawImage(skSkull,0,0,512,512);g.globalAlpha=1;g.globalCompositeOperation='source-over'} // opened from disk: no pixel access
  else if(skSkullData){
    const D=skSkullData,im=g.getImageData(0,0,N,N),o=im.data,k=1024/N;
    const smp=(fx,fy,ch)=>{fx=Math.max(0,Math.min(1023,fx));fy=Math.max(0,Math.min(1023,fy));const x0=fx|0,y0=fy|0,x1=Math.min(1023,x0+1),y1=Math.min(1023,y0+1),tx=fx-x0,ty=fy-y0;
      return ((D[(y0*1024+x0)*4+ch]*(1-tx)+D[(y0*1024+x1)*4+ch]*tx)*(1-ty)+(D[(y1*1024+x0)*4+ch]*(1-tx)+D[(y1*1024+x1)*4+ch]*tx)*ty)/255};
    const cl=v=>v<0?0:v>1?1:v;
    // a line screen at angle a: coverage of a line of the given width (in units of 1/512) at this point
    const ang=[0.55,-0.75,1.45].map(a=>[Math.cos(a),Math.sin(a)]);
    const screen=(ux,uy,k,per,w)=>{if(w<=0)return 0;const t=(ux*ang[k][0]+uy*ang[k][1])/per,d=Math.abs(t-Math.round(t))*per;return cl((w*0.5-d)*S+0.5)};
    const c1=ang[0][0],s1=ang[0][1];
    for(let py=0;py<N;py++){const uy=(py+0.5)/S;
      for(let px=0;px<N;px++){const ux=(px+0.5)/S,fx=(px+0.5)*k-0.5,fy=(py+0.5)*k-0.5,R=smp(fx,fy,0),G=smp(fx,fy,1),B=smp(fx,fy,2);
        const wob=0.45*Math.sin(ux*0.051+uy*0.033)+0.35*Math.sin(uy*0.071-ux*0.023),vx=ux+wob*s1,vy=uy-wob*c1;
        const h1=screen(vx,vy,0,2.4,2.4*Math.pow(cl((R-0.14)/0.8),1.1)*0.6),
              h2=screen(vx,vy,1,2.6,2.6*cl((R-0.55)/0.4)*0.5),
              h3=screen(vx,vy,2,2.3,2.3*cl((R-0.78)/0.22)*0.45);
        const a=1-(1-0.14*R-0.06*B)*(1-h1*0.36)*(1-h2*0.3)*(1-h3*0.26)*(1-cl(G)*0.32),i=(py*N+px)*4;
        o[i]=239+(29-239)*a;o[i+1]=233+(27-233)*a;o[i+2]=220+(25-220)*a;o[i+3]=255}}
    g.putImageData(im,0,0);
  }
  skBrain(g);
  // the X-ray field's dark rim, then the divider and labels
  for(const ox of [0,256]){const cy=SK_VY+128,gr=g.createRadialGradient(ox+128,cy,95,ox+128,cy,190);gr.addColorStop(0,'rgba(60,45,25,0)');gr.addColorStop(1,'rgba(60,45,25,0.22)');g.fillStyle=gr;g.fillRect(ox,0,256,512)}
  g.strokeStyle='#1d1b19';g.lineWidth=1.4;g.beginPath();g.moveTo(256,0);g.lineTo(256,512);g.stroke();
  g.font='italic 14px "IM Fell English", Georgia, serif';g.fillStyle='rgba(29,27,25,0.7)';g.textAlign='right';g.fillText('front (AP)',250,SK_VY+16);g.textAlign='left';g.fillText('side (lateral)',262,SK_VY+16);
  if(skSkullData){skBgCache[S]=c;if(S===2)skBgCanvas=c}
  return c;
}
const SK_FLOW=200,SK_VEIN_DELAY=3; // mm of artery per second of dye travel; seconds until the veins fill
const skHist=(h,t)=>{if(t<0||!h.length)return 0;const i=Math.floor(t/0.02);return i<h.length?h[i]:h[h.length-1]};
/* draw the scene into any canvas: dye from a distance map up to a front, a faint roadmap, the catheter and devices */
let skVL=null;
const SK_ZOOM=1.6,SK_ZCY=150; // zoomed in: both views magnified about this height (the circle of Willis)
function skRender(ctx,o){
  const sc=ctx.canvas.width/512,base=[sc,0,0,sc,0,-SK_VY*sc];ctx.setTransform(...base);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  const Z=o.zoom?SK_ZOOM:1,zt=pane=>[sc*Z,0,0,sc*Z,sc*(pane*256+128)*(1-Z),sc*(SK_ZCY*(1-Z)-SK_VY)];
  // draw into one view: clipped to it, with the zoom applied
  const inPane=(k,pane,fn)=>{k.save();k.setTransform(...base);k.beginPath();k.rect(pane*256,SK_VY,256,SK_VH);k.clip();if(Z!==1)k.setTransform(...zt(pane));fn();k.restore()};
  if(Z===1)ctx.drawImage(skBg(),0,0,512,512);
  else{const hi=skBg(4);for(const pane of [0,1])inPane(ctx,pane,()=>ctx.drawImage(hi,0,0,512,512));
    ctx.strokeStyle='#1d1b19';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(256,0);ctx.lineTo(256,512);ctx.stroke();
    ctx.font='italic 14px "IM Fell English", Georgia, serif';ctx.fillStyle='rgba(29,27,25,0.75)';ctx.textAlign='right';ctx.fillText(`front ×${SK_ZOOM}`,250,SK_VY+16);ctx.textAlign='left';ctx.fillText(`side ×${SK_ZOOM}`,262,SK_VY+16)}
  if(!o.image){ctx.fillStyle='rgba(239,233,220,0.55)';ctx.fillRect(0,0,512,512);return}
  const A=o.A,lineFor=v=>Math.max(1.4,v.r*2.4);
  // vessels, catheter and any bleed go on their own layer, then multiply over the bone (as on the heart room's X-ray)
  if(!skVL||skVL.width!==ctx.canvas.width||skVL.height!==ctx.canvas.height){skVL=document.createElement('canvas');skVL.width=ctx.canvas.width;skVL.height=ctx.canvas.height}
  const L=skVL.getContext('2d');L.setTransform(1,0,0,1,0,0);L.globalAlpha=1;L.fillStyle='#fff';L.fillRect(0,0,skVL.width,skVL.height);L.setTransform(...base);L.lineCap='round';L.lineJoin='round';
  const clip=(pane,fn)=>inPane(L,pane,fn);
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
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='multiply';ctx.drawImage(skVL,0,0);ctx.setTransform(...base);
  // film grain and the dark rim of the image intensifier, as on the heart room's monitor
  if(typeof noise!=='undefined'&&noise.length){ctx.globalCompositeOperation='overlay';ctx.globalAlpha=o.cine?0.07:0.15;ctx.drawImage(noise[Math.floor(performance.now()/66)%noise.length],0,0,512,512);ctx.globalAlpha=1}
  ctx.globalCompositeOperation='source-over';
  if(typeof vign!=='undefined'){ctx.drawImage(vign,0,SK_VY,256,SK_VH);ctx.drawImage(vign,256,SK_VY,256,SK_VH)}
  if(o.hint)for(const pane of [0,1])inPane(ctx,pane,()=>{ctx.setLineDash([3/Z,2.2/Z]);ctx.strokeStyle='rgba(138,45,31,0.85)';ctx.lineWidth=1.3/Z;ctx.beginPath();o.hint.forEach((p,i)=>{const q=skProj(p,pane);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.stroke();ctx.setLineDash([])});
  // the clot, once marked: a double ring in oxblood ink
  if(o.mark&&o.clot){const v=A.V[o.clot.vid],p=skPt(v,o.clot.s-o.clot.len/2);for(const pane of [0,1])inPane(ctx,pane,()=>{const q=skProj(p,pane);ctx.strokeStyle='#8A2D1F';ctx.lineWidth=1.4/Z;ctx.beginPath();ctx.arc(q[0],q[1],10/Z,0,7);ctx.stroke();ctx.lineWidth=0.6/Z;ctx.beginPath();ctx.arc(q[0],q[1],13/Z,0,7);ctx.stroke()})}
}
/* a small picture for the casebook: the arteries the rare patient is known for */
function skThumb(cv,seed){
  try{const pat=skPatient(seed),A=skAnatomy(pat),cat=skNewCath();let clot=skClot(A,pat);
    Object.assign(cat,skStartCath(A,pat));const guide=skCathPath(A,cat);
    const dist=skDyeDist(A,cat,clot);skRender(cv.getContext('2d'),{A,image:true,dist,front:1e9,fade:1,cath:cat,guide,clot,mark:pat.rare==='basilar'})}catch(e){}
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
  skCanvas(true);
  SK={dk,D:DIFFICULTY[dk],W:SK_DIFF[dk]||SK_DIFF.medium,pat,A,cat:skStartCath(A,pat),clot:null,t:0,cine:false,runs:[],review:null,inj:null,road:null,roadOn:DIFFICULTY[dk].level===1,
    found:false,gradeOk:null,pending:false,tx:null,passes:0,tici:0,reperfAt:null,emboli:false,sah:null,contrast:0,ak:0,ftime:0,guide:null,done:false,
    ecaInj:0,zoom:false,zoomSet:false,maxFront:0,hist:[],vhist:[],src:0,dist:null,injOn:false,autoInj:0,toBrain:false,prevB:false,beatT:0,blockedT:0,popKey:'',ctrlT:0,firstPassTici:null,tut:tut?{i:0}:null};
  SK.clot=skClot(A,pat);SK.guide=skCathPath(A,SK.cat);
  document.body.classList.remove('inmenu','inreport');document.body.classList.add('stroke');
  $('startOv').hidden=true;$('resultOv').hidden=true;$('reviewbar').hidden=true;$('teachNote').hidden=true;
  ['txPop','gradePop','txDot','guide'].forEach(id=>{const e=$(id);if(e)e.hidden=true});
  const ctx=img.getContext('2d');skRender(ctx,{A,image:false});
  $('caseHead').innerHTML=`<h2>Stroke room · ${pat.code} · ${SK.D.label}</h2>${pat.rare&&RARE_BY[pat.rare]?`<p class="task">Rare patient: ${RARE_BY[pat.rare].name}. ${RARE_BY[pat.rare].short}.</p>`:''}<b>${pat.title}</b><p>${pat.pt}. ${pat.hx}</p>
    <p class="task">${SK.D.level>=3?pw('Find the occlusion on angiography and remove the clot.','Find the blocked brain artery with dye and pull the clot out.'):pw(`CT angiogram: occlusion of the ${pat.where}. Confirm it on angiography and remove the clot.`,`The CT scan shows a clot in the ${pat.where}. Find it with dye and pull it out.`)} ${pw('Every minute counts.','Every minute costs brain cells.')}</p>`;
  skPanel(true);skCoach();
  toast(pw(`Groin access done: the guide catheter is already up the ${skName(SK.cat.vid)}, in the upper neck. Film to find the occlusion.`,`The tube is already up in the ${skName(SK.cat.vid)}, in the upper neck, with the thin tube ready to steer. Film with dye to find where it is blocked.`));
  requestAnimationFrame(skLoop);
}
/* the stroke room's X-ray is twice as wide as it is tall (two square views); the heart room's is square */
function skCanvas(on){const h=on?img.width/2:img.width;if(img.height!==h){img.height=h;if(!on&&typeof ictx!=='undefined'&&typeof W!=='undefined')ictx.setTransform(img.width/W,0,0,img.width/W,0,0)}}
function skStop(){if(SK){SK.done=true;SK=null}skCanvas(false);document.body.classList.remove('stroke');const p=$('skPop');if(p)p.hidden=true;const g=$('skGuide');if(g)g.hidden=true}
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
    let ds=0;const sp=A.V[c.vid].intra?s.W.micro:s.W.adv;if(down('ArrowUp','KeyW'))ds+=sp*dt;if(down('ArrowDown','KeyS'))ds-=sp*dt;
    if(ds){const imaging=fl||s.cine;const r=skMove(A,c,ds,s.dk,s.clot);
      if(r.entered){if(typeof sfx==='function')sfx('engage');const v=A.V[r.entered];
        toast(r.trap?pw(`That is the ${skName(r.entered)}: it goes to the face, not the brain. Pull back and keep the tip pointing up.`,`Careful: that is the ${skName(r.entered)}, which goes to the face, not the brain. Pull back and keep the tip pointing up.`):`${pw('Into the','Into the')} ${skName(r.entered)}.`,!!r.trap);if(r.trap)s.ecaIn=true}
      if(r.blocked==='deep'&&s.blockedT<=0){s.blockedT=4;toast(pw(`The guide stays in the neck. Press ${shortKey('KeyX')} for the microcatheter to go further.`,`The big tube has to stay in the neck. Press ${shortKey('KeyX')} to send the thin tube (microcatheter) on into the head.`))}
      if(r.floor&&s.blockedT<=0){s.blockedT=4;toast(pw('The guide stays in this neck artery: there is no need to come further back.','The big tube stays in this neck artery: no need to pull it back any further.'))}
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
/* the branch the tip will go into at the next fork or opening ahead, for a dashed mark on the X-ray (not on Hard) */
function skForkHint(){const s=SK,A=s.A,c=s.cat,v=A.V[c.vid],nb=skNearBranch(A,c);if(!nb||nb.dist>16)return null;
  const at=nb.child.os>=v.len-0.5?v.len:nb.child.os;if(at<c.s-3)return null;const pick=skChoose(A,v,c,s.dk,Math.max(c.s,at),4);if(!pick)return null;
  const pts=[];for(let d=0;d<=Math.min(16,pick.len);d+=1.5)pts.push(skPt(pick,d));return pts}
function skDraw(){
  const s=SK,ctx=img.getContext('2d'),fl=down('Space','KeyF')||s.cine||s.ctrlT>0;
  const hint=s.dk!=='hard'&&!s.review&&fl?skForkHint():null;
  if(s.review){skRender(ctx,{A:s.A,image:true,zoom:s.zoom,dist:s.review.dist,front:s.review.front,fade:1,cath:s.review.cath,guide:s.review.guide,clot:s.clot,mark:s.found});}
  else skRender(ctx,{A:s.A,image:fl,zoom:s.zoom,cine:s.cine,dist:s.dist,conc:d=>skHist(s.hist,s.t-d/SK_FLOW),vein:dl=>0.55*skHist(s.vhist,s.t-SK_VEIN_DELAY-dl),road:s.roadOn&&s.road?s.road:null,cath:s.cat,guide:s.guide,clot:s.clot,mark:s.found,device:s.tx&&s.tx.type==='sr'&&s.tx.stage!=='deploy'&&s.tx.stage!=='choose'?'sr':null,perf:s.sah,hint});
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
/* Z: zoom in on the head, or back out */
function skToggleZoom(){if(!SK)return;SK.zoom=!SK.zoom;SK.zoomSet=true;skPanel(true)}
/* X: the microcatheter out of the guide, or back */
function skDeeper(){
  const s=SK,c=s.cat,v=s.A.V[c.vid];if(c.floor){toast(pw('No exchange needed: the microcatheter is already out of the guide and goes where you steer it.','Nothing to switch here: the thin tube is already out of the big one and goes wherever you steer.'));return}
  if(c.deep){if(v.intra){toast(pw('Pull the microcatheter back into the neck first.','Pull the thin tube back down into the neck first.'));return}c.deep=false;s.guide=null;toast(pw('Microcatheter back in the guide.','The thin tube is back inside the big one.'));return}
  if(!/ICA|VA|CCA/.test(c.vid)){toast(pw('Park the guide in a neck artery (carotid or vertebral) first.','First bring the big tube up into a neck artery (carotid or vertebral).'));return}
  c.deep=true;s.guide=skCathPath(s.A,c);toast(pw('Microcatheter and wire out of the guide: you can go into the head now.','The thin tube (microcatheter) is out of the big one: you can now steer into the head.'));if(typeof sfx==='function')sfx('engage');skPanel(true);
}
/* marking the clot on a film */
img.addEventListener('click',e=>{
  if(!SK||SK.done||!SK.review)return;
  const r=img.getBoundingClientRect();let x=(e.clientX-r.left)/r.width*512,y=SK_VY+(e.clientY-r.top)/r.height*SK_VH;const cl=SK.clot;
  if(SK.zoom){const pane=x<256?0:1,cx=pane*256+128;x=cx+(x-cx)/SK_ZOOM;y=SK_ZCY+(y-SK_ZCY)/SK_ZOOM}
  if(!cl){toast(pw('There is no clot left to mark.','Nothing is blocked any more.'));return}
  const p=skPt(SK.A.V[cl.vid],cl.s-cl.len/2),near=[0,1].some(pane=>{const q=skProj(p,pane);return Math.hypot(q[0]-x,q[1]-y)<20});
  if(near&&SK.review.showsClot){SK.pending=true;SK.popKey='';skPop()}
  else toast(SK.review.showsClot?pw('No cut-off there. Click where the dye column stops.','Not there: click where the dye suddenly stops.'):pw('This film does not reach the clot. Film from closer to it.','The dye in this film does not reach the blocked artery. Film again from the right neck artery.'));
});
/* ---------- the side panel ---------- */
function skPanel(force){
  const s=SK;if(!s)return;const el=$('skPanel'),c=s.cat,saved=skBrainSaved();
  const key=[s.runs.length,c.vid,c.deep,s.roadOn,s.zoom,!!s.review,s.found,s.tici,s.passes,Math.round(skMinutes()),skNihss(),!!s.sah].join();if(!force&&key===s.panelKey)return;s.panelKey=key;
  el.innerHTML=`<h2>${pw('The brain','The brain')}</h2>
    <div class="reads"><div class="read"><span>NIHSS</span><b>${skNihss()}</b></div><div class="read"><span>${pw('Brain saved','Brain still savable')}</span><b>${saved}<small>%</small></b><i class="lvl"><b style="width:${saved}%"></b></i></div>
    <div class="read"><span>${pw('Reperfusion','Blood flow')}</span><b>${s.tici?ticiName(s.tici):'–'}<small>${s.tici?'TICI':''}</small></b></div><div class="read"><span>${pw('Passes','Tries')}</span><b>${s.passes}</b></div></div>
    <h2 style="margin-top:8px">${pw('Catheter','The tube')}</h2>
    <div class="status">${pw('Tip in the','Tip in the')} ${skName(c.vid)}.</div>
    <div class="row"><button class="btn" data-sk="zoom" aria-pressed="${!!s.zoom}">${s.zoom?pw('Zoom out','Zoom out'):pw('Zoom in on the head','Zoom in on the head')} <kbd>${shortKey('KeyZ')}</kbd></button><button class="btn" data-sk="road" aria-pressed="${s.roadOn}">${pw('Roadmap','Roadmap (ghost of the last film)')}: ${s.roadOn?'on':'off'}</button></div>
    <h2 style="margin-top:8px">${pw('Films','Films')}</h2>
    <div class="runs">${s.runs.length?s.runs.map(r=>`<button class="run${s.review===r?' sel':''}" data-skrun="${r.id}"><b>${pw('Film','Film')} ${r.id}</b><span>${r.where}</span></button>`).join(''):`<div class="empty">${pw(`No films yet. Press ${shortKey('KeyC')} to record, hold ${shortKey('KeyJ')} to inject.`,`No films yet. Press ${shortKey('KeyC')} to record, then hold ${shortKey('KeyJ')} to inject dye.`)}</div>`}</div>
    ${s.review?`<div class="row"><button class="btn" data-sk="live">${pw('Back to live','Back to live')}</button></div>`:''}
    <button class="btn primary" data-sk="finish" ${s.runs.length||s.sah?'':'disabled'}>${pw('Finish and report','Finish and report')}</button>`;
}
function skPanelClick(e){
  const b=e.target.closest('button');if(!b||!SK)return;const d=b.dataset;
  if(d.sk==='deep')skDeeper();
  else if(d.sk==='zoom')skToggleZoom();
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
        ${cl?`<div>${pw(`Clot in the ${skName(cl.vid)}.`,`The clot is in the ${skName(cl.vid)}.`)}</div>
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
  el.hidden=false;if(el.dataset.t!==t){el.innerHTML=`<span>${t}</span>`;el.dataset.t=t}
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
function skTutSeed(){for(let i=1;i<20000;i++){const sd=(i*7919)%CODE_SPACE,p=skPatient(sd);if(p.site==='M1'&&p.side==='L'&&!p.rare)return sd}return 1}
const skReached=id=>SK.cat.vid===id||SK.cat.stack.some(x=>x.vid===id);
const SK_TUT=[
  {title:'X-ray on',text:()=>`Hold ${kk('Space')} (or the X-ray button) to switch the X-ray on. You see two views of the head at once: the front on the left, the side on the right. The tube is already up the left artery into the brain (internal carotid), at the bottom of the picture. The big tube stays there; a thin tube inside it goes on wherever you steer.`,done:s=>s.ftime>0.6},
  {title:'Film it',text:()=>`Press ${kk('KeyC')} to record, hold ${kk('KeyJ')} for about two seconds to inject dye, then press ${kk('KeyC')} to stop. The dye fills the brain's arteries, except beyond the clot.`,done:s=>s.runs.some(r=>r.showsClot)},
  {title:'Find the clot',text:()=>`Open Film 1 under Films. Click where the dye column suddenly stops, then say which artery it is: the main middle brain artery (M1).`,done:s=>s.found},
  {title:'Through the clot',text:()=>`Push up the neck into the head. Where the artery forks, the tip goes the way it is turned (a dashed red mark shows which branch): steer into the M1 and push right through the clot. The mesh stent button in the pop-up turns ready.`,done:s=>!!(s.clot&&s.cat.vid===s.clot.vid&&s.cat.s>s.clot.s+s.clot.len/2+1.5)||s.passes>0},
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
    <dl><dt>${pw('The job','The job')}</dt><dd>${pw('A large-vessel stroke: a clot is blocking an artery in the brain. The guide catheter is already up the neck artery that leads to it: film to find where the dye stops, steer the microcatheter on into the head and pull the clot out.','A clot is blocking an artery in the brain. The tube is already up in the neck: film with dye to find where it stops, steer on into the head and pull the clot out.')}</dd>
    <dt>${pw('New here','New here')}</dt><dd>${pw('Two views at once (front and side), a roadmap ghost of your last film, the microcatheter, the stent retriever and aspiration, and the stroke clock: every minute costs brain.','Two X-ray views at once (front and side), a faint ghost of your last film to steer by, a thin tube for the head, a mesh stent or a suction tube, and a clock: every minute costs brain cells.')}</dd>
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
