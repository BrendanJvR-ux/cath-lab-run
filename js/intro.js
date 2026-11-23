/* Cath Lab Run: a one-minute animated explainer for players outside medicine.
   Six ten-second scenes on a canvas, each with a caption: the heart's own arteries, a narrowing, the catheter from
   the leg, filming with dye, opening it with a balloon and stent, then what the player does in the game.
   Shown once to new players after the experience question, and any time from "How it works" on the main menu. */
"use strict";
const IW=720,IH=380,INK_='#111',GREY_='#c9c8c2',RED_='#E5432D',PINK_='#FBE3DE',PLAQ_='#E7DFC6';
const ease=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const iseg=(t,a,b)=>ease((t-a)/(b-a));
const bz=(p,t)=>{const u=1-t;return [u*u*u*p[0][0]+3*u*u*t*p[1][0]+3*u*t*t*p[2][0]+t*t*t*p[3][0],u*u*u*p[0][1]+3*u*u*t*p[1][1]+3*u*t*t*p[2][1]+t*t*t*p[3][1]]};
function strokeBz(g,p,upto=1,n=60){g.beginPath();for(let i=0;i<=n*upto;i++){const q=bz(p,i/n);i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])}g.stroke()}
function label(g,txt,x,y,col=INK_,align='left'){g.font='500 15px Inter, system-ui, sans-serif';g.fillStyle=col;g.textAlign=align;g.textBaseline='middle';g.fillText(txt,x,y)}
function arrowTo(g,x0,y0,x1,y1,col=INK_){g.strokeStyle=col;g.lineWidth=1.2;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();const a=Math.atan2(y1-y0,x1-x0);g.beginPath();g.moveTo(x1,y1);g.lineTo(x1-7*Math.cos(a-0.45),y1-7*Math.sin(a-0.45));g.moveTo(x1,y1);g.lineTo(x1-7*Math.cos(a+0.45),y1-7*Math.sin(a+0.45));g.stroke()}

/* a simple heart: two lobes and a point, tilted the way it sits in the chest */
function heartPath(g,cx,cy,s){g.save();g.translate(cx,cy);g.rotate(-0.35);g.scale(s,s);g.beginPath();
  g.moveTo(0,-38);g.bezierCurveTo(-18,-78,-92,-70,-88,-12);g.bezierCurveTo(-84,36,-30,74,6,112);g.bezierCurveTo(40,72,96,34,94,-14);g.bezierCurveTo(90,-72,18,-78,0,-38);g.closePath();g.restore()}
const HEART_ART=[ // coronary arteries over the front of the heart, in scene-1 coordinates
  [[352,132],[330,170],[338,232],[372,300]],   // front artery (LAD)
  [[352,132],[396,124],[432,150],[446,208]],   // side artery (circumflex)
  [[336,138],[290,148],[268,196],[286,262]],   // right artery
  [[340,196],[370,206],[396,226],[410,252]],   // a branch
];
function flowDots(g,paths,time,speed,col=RED_,r=2.6){g.fillStyle=col;paths.forEach((p,j)=>{for(let k=0;k<5;k++){const t=((time*speed+k/5+j*0.13)%1);const q=bz(p,t);g.beginPath();g.arc(q[0],q[1],r,0,7);g.fill()}})}

/* a straight artery with a narrowing in the middle; bump 0..1 is how much plaque, used by scenes 2 and 5 */
function artery(g,bump,time,speed,opts={}){
  const y0=190,R=36,x0=60,x1=660,cx=360,w=70;
  const off=x=>R-bump*R*0.82*Math.exp(-(((x-cx)/w)**2));
  // plaque
  g.fillStyle=PLAQ_;for(const sgn of [-1,1]){g.beginPath();g.moveTo(x0,y0+sgn*R);for(let x=x0;x<=x1;x+=4)g.lineTo(x,y0+sgn*off(x));g.lineTo(x1,y0+sgn*R);g.closePath();g.fill()}
  // lumen
  g.fillStyle=PINK_;g.beginPath();g.moveTo(x0,y0-off(x0));for(let x=x0;x<=x1;x+=4)g.lineTo(x,y0-off(x));for(let x=x1;x>=x0;x-=4)g.lineTo(x,y0+off(x));g.closePath();g.fill();
  // wall
  g.strokeStyle=INK_;g.lineWidth=1.6;for(const sgn of [-1,1]){g.beginPath();g.moveTo(x0,y0+sgn*R);g.lineTo(x1,y0+sgn*R);g.stroke()}
  g.strokeStyle='rgba(17,17,17,.35)';g.lineWidth=1;for(const sgn of [-1,1]){g.beginPath();for(let x=x0;x<=x1;x+=4){const y=y0+sgn*off(x);x===x0?g.moveTo(x,y):g.lineTo(x,y)}g.stroke()}
  // blood cells: fewer and slower get through a tight narrowing
  const n=14,pass=1-bump*0.85;g.fillStyle=RED_;
  for(let k=0;k<n;k++){const lane=((k*37)%9)/9-0.45;let x=x0+((time*speed*pass*90+k*(x1-x0)/n)%(x1-x0));
    if(k%3!==0&&bump>0.5&&x>cx-60){if(x<cx-40)continue;else continue}
    const y=y0+lane*off(x)*1.3;g.beginPath();g.arc(x,y,4.2,0,7);g.fill()}
  return {y0,cx,off};
}

const SCENES=[
  {title:'Your heart has its own arteries',cap:'The heart is a muscle that pumps all day. It needs its own blood supply: the coronary arteries, which run over its surface.',
   draw(g,t,time){const s=1+0.025*Math.sin(time*7.5);g.save();g.translate(360,200);g.scale(s,s);g.translate(-360,-200);
     g.strokeStyle=INK_;g.lineWidth=1.6;g.fillStyle='#F4F2EE';heartPath(g,360,190,1.45);g.fill();g.stroke();
     for(const [w,c] of [[17,INK_],[14,'#F4F2EE']]){g.beginPath();g.moveTo(352,128);g.bezierCurveTo(344,70,404,44,428,84);g.lineTo(432,112);g.strokeStyle=c;g.lineWidth=w;g.lineCap='butt';g.stroke()} // aorta
     g.strokeStyle=RED_;g.lineWidth=4;g.lineCap='round';HEART_ART.forEach((p,i)=>strokeBz(g,p,iseg(t,0.05+i*0.08,0.4+i*0.08)));
     if(t>0.5)flowDots(g,HEART_ART,time,0.35);g.restore();
     if(t>0.45){g.globalAlpha=iseg(t,0.45,0.6);arrowTo(g,520,150,452,186);label(g,'coronary arteries',528,146);arrowTo(g,250,74,336,84);label(g,'aorta: the main artery',244,74,INK_,'right');g.globalAlpha=1}}},
  {title:'Plaque narrows an artery',cap:'Over the years, fatty plaque can build up inside an artery and narrow it. Less blood gets through, which causes chest pain or a heart attack.',
   draw(g,t,time){const b=iseg(t,0.05,0.6);artery(g,b,time,1);
     if(t>0.45){g.globalAlpha=iseg(t,0.45,0.6);arrowTo(g,360,300,360,236);label(g,'plaque',360,316,INK_,'center');g.globalAlpha=1}
     if(t>0.65){g.globalAlpha=iseg(t,0.65,0.8);label(g,'less blood gets past',560,110,RED_,'center');g.globalAlpha=1}}},
  {title:'A thin tube, from the leg to the heart',cap:'To fix it without surgery, a doctor slides a thin tube (a catheter) into an artery at the top of the leg and steers it up to the heart.',
   draw(g,t){g.strokeStyle=INK_;g.lineWidth=1.6;g.fillStyle='#F4F2EE';
     g.beginPath();g.arc(360,58,26,0,7);g.fill();g.stroke();
     g.beginPath();g.moveTo(330,92);g.bezierCurveTo(296,96,290,112,288,150);g.lineTo(296,250);g.lineTo(424,250);g.lineTo(432,150);g.bezierCurveTo(430,112,424,96,390,92);g.closePath();g.fill();g.stroke();
     g.beginPath();g.moveTo(300,250);g.lineTo(306,368);g.moveTo(344,252);g.lineTo(350,368);g.moveTo(376,252);g.lineTo(370,368);g.moveTo(420,250);g.lineTo(414,368);g.stroke();
     g.fillStyle=RED_;heartPath(g,376,150,0.32);g.fill();
     const path=[[332,300],[334,250],[338,190],[352,128]],tip=[[352,128],[362,106],[386,106],[382,142]];
     g.strokeStyle=INK_;g.lineWidth=3;g.lineCap='round';const a=iseg(t,0.1,0.75);strokeBz(g,path,Math.min(1,a*1.6));if(a>0.62)strokeBz(g,tip,(a-0.62)/0.38);
     if(t>0.15){g.globalAlpha=iseg(t,0.15,0.3);arrowTo(g,226,300,326,300);label(g,'in at the top of the leg',218,300,INK_,'right');g.globalAlpha=1}
     if(t>0.8){g.globalAlpha=iseg(t,0.8,0.92);arrowTo(g,520,130,398,136);label(g,'catheter tip at the heart',526,130);g.globalAlpha=1}}},
  {title:'Dye and X-ray show the narrowing',cap:'Blood does not show on X-ray. So the doctor injects dye through the catheter and films it: the arteries appear, and a narrowing shows as a pinch.',
   draw(g,t){g.fillStyle='#F7F7F5';g.fillRect(200,30,320,320);g.strokeStyle=GREY_;g.lineWidth=1;g.strokeRect(200,30,320,320);
     const trunk=[[260,60],[300,110],[330,190],[360,320]],br=[[[300,110],[350,120],[410,160],[460,240]],[[330,190],[360,200],[400,230],[420,280]],[[285,92],[260,140],[240,200],[236,260]]];
     const f=iseg(t,0.1,0.7);g.lineCap='round';
     // grey outline of the catheter
     g.strokeStyle='#999';g.lineWidth=3;g.beginPath();g.moveTo(230,350);g.quadraticCurveTo(236,120,260,60);g.stroke();
     // dye fills from the tip outwards; a pinch on the trunk
     g.strokeStyle='#2a2a2a';const n=80;for(let i=0;i<n*Math.min(1,f*1.3);i++){const a=bz(trunk,i/n),b=bz(trunk,(i+1)/n),w=i/n>0.38&&i/n<0.48?2.2:7-3*i/n;g.lineWidth=w;g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke()}
     g.lineWidth=4;br.forEach((p,j)=>strokeBz(g,p,Math.max(0,Math.min(1,(f-0.3-j*0.1)*2))));
     if(t>0.72){const q=bz(trunk,0.43);g.globalAlpha=iseg(t,0.72,0.82);g.strokeStyle=RED_;g.lineWidth=2;g.beginPath();g.arc(q[0],q[1],18,0,7);g.stroke();arrowTo(g,560,170,q[0]+22,q[1]-6,RED_);label(g,'the narrowing',566,170,RED_);g.globalAlpha=1}
     if(t>0.2){g.globalAlpha=iseg(t,0.2,0.32);label(g,'X-ray image',200,18,'#8A8A85');g.globalAlpha=1}}},
  {title:'A balloon and a stent open it',cap:'A very thin wire crosses the narrowing. A balloon opens it, and a stent (a tiny metal mesh tube) holds it open. Blood flows freely again.',
   draw(g,t,time){const balloon=iseg(t,0.22,0.42)*(1-iseg(t,0.55,0.62)),open=iseg(t,0.25,0.45),b=1-open*0.92;
     const A=artery(g,b,time,1+iseg(t,0.6,0.8));
     // wire
     const wx=60+600*iseg(t,0.02,0.2);g.strokeStyle=INK_;g.lineWidth=1.2;g.beginPath();g.moveTo(60,A.y0);g.lineTo(wx,A.y0);g.stroke();
     // balloon
     if(balloon>0.01){g.fillStyle='rgba(120,150,200,.45)';g.strokeStyle='#4A5A70';g.lineWidth=1.2;g.beginPath();g.ellipse(A.cx,A.y0,80,4+balloon*30,0,0,7);g.fill();g.stroke()}
     // stent mesh along the wall
     const st=iseg(t,0.5,0.62);if(st>0){g.globalAlpha=st;g.strokeStyle='#555';g.lineWidth=1.3;for(const sgn of [-1,1]){g.beginPath();for(let x=A.cx-80,k=0;x<=A.cx+80;x+=10,k++){const y=A.y0+sgn*(A.off(x)-(k%2?0:5));x===A.cx-80?g.moveTo(x,y):g.lineTo(x,y)}g.stroke()}g.globalAlpha=1}
     const lab=t<0.22?'1  wire across':t<0.5?'2  balloon opens it':t<0.7?'3  stent holds it open':'4  blood flows again';label(g,lab,360,300,t>=0.7?RED_:INK_,'center')}},
  {title:'Your job in the game',cap:'Each patient is different. Take your time: the guide under the X-ray tells you which way to steer, and the score explains everything afterwards.',
   draw(g,t){const steps=['Steer the catheter into a heart artery','Film it: record, then inject dye','Find the narrowing and say how bad it is','Open it with a balloon and a stent'];
     steps.forEach((s,i)=>{const a=iseg(t,0.05+i*0.14,0.18+i*0.14);if(!a)return;g.globalAlpha=a;const y=86+i*64;
       g.strokeStyle=INK_;g.lineWidth=1.4;g.beginPath();g.arc(190,y,19,0,7);g.stroke();label(g,String(i+1),190,y+1,INK_,'center');
       g.font='300 22px Inter, system-ui, sans-serif';g.fillStyle=INK_;g.textAlign='left';g.fillText(s,228,y+1);g.globalAlpha=1})}},
];
const SCENE_S=10;
let introState=null;
function openIntro(){
  closeIntro();
  const d=document.createElement('div');d.className='glossary intro';d.setAttribute('role','dialog');d.setAttribute('aria-label','How it works');
  d.innerHTML=`<div class="glbox introbox"><div class="glhead"><b id="inTitle"></b><button class="btn" data-in="skip">Skip</button></div>
    <canvas id="inCan" width="${IW*2}" height="${IH*2}" aria-hidden="true"></canvas>
    <p class="incap" id="inCap" aria-live="polite"></p>
    <div class="inbar"><div class="indots" id="inDots"></div><span class="spacer"></span>
      <button class="btn" data-in="back">Back</button><button class="btn" data-in="pause">Pause</button><button class="btn primary" data-in="next">Next</button></div></div>`;
  document.body.appendChild(d);
  const can=d.querySelector('#inCan'),g=can.getContext('2d');g.setTransform(2,0,0,2,0,0);
  introState={i:0,t0:performance.now(),paused:false,pausedAt:0,raf:0};
  const show=i=>{introState.i=i;introState.t0=performance.now();introState.pausedAt=0;
    d.querySelector('#inTitle').textContent=`${i+1} of ${SCENES.length} · ${SCENES[i].title}`;d.querySelector('#inCap').textContent=SCENES[i].cap;
    d.querySelector('#inDots').innerHTML=SCENES.map((_,k)=>`<i class="${k<i?'done':k===i?'now':''}"></i>`).join('');
    d.querySelector('[data-in="back"]').disabled=i===0;d.querySelector('[data-in="next"]').textContent=i===SCENES.length-1?'Start playing':'Next'};
  const frame=now=>{
    if(!introState)return;
    const el=introState.paused?introState.pausedAt:(now-introState.t0)/1000,t=Math.min(1,el/SCENE_S);
    g.clearRect(0,0,IW,IH);g.fillStyle='#fff';g.fillRect(0,0,IW,IH);
    SCENES[introState.i].draw(g,t,el);
    if(!introState.paused&&el>=SCENE_S+1.2&&introState.i<SCENES.length-1)show(introState.i+1);
    introState.raf=requestAnimationFrame(frame);
  };
  d.addEventListener('click',e=>{
    const b=e.target.closest('[data-in]');if(!b){if(e.target===d)closeIntro(true);return}
    const a=b.dataset.in;
    if(a==='skip')closeIntro(true);
    else if(a==='back'&&introState.i>0)show(introState.i-1);
    else if(a==='next'){if(introState.i<SCENES.length-1)show(introState.i+1);else closeIntro(true)}
    else if(a==='pause'){const p=introState;if(p.paused){p.paused=false;p.t0=performance.now()-p.pausedAt*1000;b.textContent='Pause'}else{p.pausedAt=(performance.now()-p.t0)/1000;p.paused=true;b.textContent='Play'}}
  });
  d.addEventListener('keydown',e=>{if(e.key==='Escape')closeIntro(true);if(e.key==='ArrowRight')d.querySelector('[data-in="next"]').click();if(e.key==='ArrowLeft')d.querySelector('[data-in="back"]').click()});
  show(0);introState.raf=requestAnimationFrame(frame);d.querySelector('[data-in="next"]').focus();
}
function closeIntro(seen){
  if(introState){cancelAnimationFrame(introState.raf);introState=null}
  document.querySelectorAll('.intro').forEach(n=>n.remove());
  if(seen&&typeof profile!=='undefined'&&profile&&!profile.introSeen){profile.introSeen=true;saveProfile()}
}
