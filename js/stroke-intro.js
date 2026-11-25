/* Cath Lab Run: a one-minute animated intro to the stroke room, played with the intro player in js/intro.js
   (and drawn with its helpers): a clot in a brain artery, time is brain, the route from the leg to the head,
   dye showing the blockage, the stent retriever, and the player's job. */
"use strict";
function skBrainShape(g,cx,cy,s){g.beginPath();g.moveTo(cx-150*s,cy+10*s);g.bezierCurveTo(cx-160*s,cy-90*s,cx-40*s,cy-140*s,cx+40*s,cy-128*s);g.bezierCurveTo(cx+140*s,cy-118*s,cx+175*s,cy-40*s,cx+160*s,cy+30*s);
  g.bezierCurveTo(cx+150*s,cy+80*s,cx+80*s,cy+96*s,cx+20*s,cy+84*s);g.bezierCurveTo(cx-30*s,cy+96*s,cx-120*s,cy+90*s,cx-150*s,cy+10*s);g.closePath()}
function skSulci(g,cx,cy,s){g.strokeStyle='rgba(29,27,25,0.35)';g.lineWidth=1;for(const p of [[[-110,-40],[-70,-70],[-30,-50],[10,-80]],[[-60,10],[-20,-20],[30,0],[70,-30]],[[20,50],[60,20],[100,40],[130,0]],[[-120,40],[-80,30],[-40,55]],[[60,-90],[90,-60],[120,-70]]])strokeBz(g,p.map(q=>[cx+q[0]*s,cy+q[1]*s]).concat(p.length===3?[[cx+p[2][0]*s+8,cy+p[2][1]*s]]:[]).slice(0,4))}
// the middle cerebral artery tree in the side view of the brain
const SK_ART=[[[300,330],[300,270],[330,240],[360,232]],[[360,232],[410,220],[450,180],[480,140]],[[360,232],[420,240],[470,250],[520,230]],[[410,220],[430,170],[420,130],[400,100]],[[440,244],[470,290],[500,300],[540,290]]];
const SK_SCENES=[
  {title:'A clot blocks a brain artery',cap:'In most strokes a blood clot lodges in an artery of the brain. The part of the brain that artery feeds stops getting blood.',
   draw(g,t,time){g.fillStyle='#EFE9DC';g.strokeStyle=INK_;g.lineWidth=1.8;skBrainShape(g,380,210,1.3);g.fill();g.stroke();skSulci(g,380,210,1.3);
     const loss=iseg(t,0.35,0.85);if(loss>0){g.save();skBrainShape(g,380,210,1.3);g.clip();g.fillStyle=`rgba(29,27,25,${0.16*loss})`;g.beginPath();g.moveTo(370,232);g.arc(370,232,190*loss+20,-1.25,0.45);g.closePath();g.fill();g.restore()}
     g.lineCap='round';SK_ART.forEach((p,i)=>{g.strokeStyle=i>0&&t>0.32?`rgba(138,45,31,${1-0.7*loss})`:RED_;g.lineWidth=i===0?6:3.5;strokeBz(g,p,iseg(t,0.02+i*0.04,0.25+i*0.04))});
     if(t>0.25){const a=iseg(t,0.25,0.35);g.fillStyle=`rgba(29,27,25,${a})`;g.beginPath();g.ellipse(358,233,9*a,6*a,0.2,0,7);g.fill()}
     if(t>0.4){g.globalAlpha=iseg(t,0.4,0.52);arrowTo(g,250,140,348,226);label(g,'the clot',250,128,INK_,'right');g.globalAlpha=1}
     if(t>0.62){g.globalAlpha=iseg(t,0.62,0.74);label(g,'no blood reaches this part of the brain',560,320,RED_,'center');g.globalAlpha=1}}},
  {title:'Time is brain',cap:'Every minute without blood, about 1.9 million brain cells die. The centre dies first; the area around it can still be saved if the artery is opened fast.',
   draw(g,t,time){const mins=Math.floor(t*30),core=30+t*70,pen=150-t*60;
     g.fillStyle='#EFE9DC';g.strokeStyle=INK_;g.lineWidth=1.8;skBrainShape(g,260,200,1.05);g.fill();g.stroke();
     g.save();skBrainShape(g,260,200,1.05);g.clip();g.fillStyle='rgba(138,45,31,0.13)';g.beginPath();g.arc(300,190,Math.max(core,pen),0,7);g.fill();g.fillStyle='rgba(29,27,25,0.55)';g.beginPath();g.arc(300,190,core,0,7);g.fill();g.restore();
     label(g,'still savable',300,190-Math.max(core,pen)-12,RED_,'center');if(core>45)label(g,'lost',300,195,'#F6F2E9','center');
     g.font='italic 46px "IM Fell English", Georgia, serif';g.fillStyle=INK_;g.textAlign='left';g.fillText(`${mins} min`,470,170);
     g.font='italic 22px "IM Fell English", Georgia, serif';g.fillText(`${(mins*1.9).toFixed(1)} million`,470,212);g.fillText('brain cells lost',470,240)}},
  {title:'From the leg to the brain',cap:'The same thin tube as in the heart room goes in at the top of the leg, up the aorta, over its arch and into a neck artery. A thinner tube then goes on into the head.',
   draw(g,t){g.strokeStyle=INK_;g.lineWidth=1.6;g.fillStyle='#EFE9DC';
     g.beginPath();g.arc(360,58,28,0,7);g.fill();g.stroke();
     g.beginPath();g.moveTo(330,94);g.bezierCurveTo(296,98,290,114,288,150);g.lineTo(296,250);g.lineTo(424,250);g.lineTo(432,150);g.bezierCurveTo(430,114,424,98,390,94);g.closePath();g.fill();g.stroke();
     g.beginPath();g.moveTo(300,250);g.lineTo(306,368);g.moveTo(344,252);g.lineTo(350,368);g.moveTo(376,252);g.lineTo(370,368);g.moveTo(420,250);g.lineTo(414,368);g.stroke();
     g.fillStyle=RED_;heartPath(g,376,150,0.28);g.fill();
     const path=[[332,300],[336,230],[344,160],[362,118]],up=[[362,118],[366,100],[364,80],[360,58]];
     g.strokeStyle=INK_;g.lineWidth=3;g.lineCap='round';const a=iseg(t,0.08,0.7);strokeBz(g,path,Math.min(1,a*1.5));if(a>0.66){g.lineWidth=1.6;strokeBz(g,up,(a-0.66)/0.34)}
     if(t>0.12){g.globalAlpha=iseg(t,0.12,0.25);arrowTo(g,226,300,326,300);label(g,'in at the top of the leg',218,300,INK_,'right');g.globalAlpha=1}
     if(t>0.72){g.globalAlpha=iseg(t,0.72,0.84);arrowTo(g,500,70,372,66);label(g,'thin tube into the head',506,70);g.globalAlpha=1}}},
  {title:'Dye shows the blockage',cap:'Dye injected into the neck artery fills the brain’s arteries on X-ray, except beyond the clot: the dye column suddenly stops there.',
   draw(g,t){g.fillStyle='#EFE9DC';g.fillRect(200,22,320,336);g.strokeStyle=GREY_;g.lineWidth=1;g.strokeRect(200,22,320,336);
     g.strokeStyle='rgba(29,27,25,0.25)';g.lineWidth=1.2;g.beginPath();g.ellipse(360,150,120,118,0,0,7);g.stroke();
     const f=iseg(t,0.1,0.7),tree=[[[360,350],[356,280],[352,230],[356,190]],[[356,190],[320,170],[290,150],[262,120]],[[356,190],[392,176],[420,160],[452,130]],[[356,190],[360,150],[362,110],[358,70]]];
     g.strokeStyle='#2a2622';g.lineCap='round';g.lineWidth=6;strokeBz(g,tree[0],Math.min(1,f*2));
     g.lineWidth=4;strokeBz(g,tree[1],Math.max(0,Math.min(1,(f-0.45)*2)));strokeBz(g,tree[3],Math.max(0,Math.min(1,(f-0.45)*2)));strokeBz(g,tree[2],Math.max(0,Math.min(0.28,(f-0.45)*2)));
     if(t>0.72){const q=bz(tree[2],0.28);g.globalAlpha=iseg(t,0.72,0.82);g.strokeStyle=RED_;g.lineWidth=2;g.beginPath();g.arc(q[0],q[1],16,0,7);g.stroke();arrowTo(g,560,120,q[0]+18,q[1]-4,RED_);label(g,'the dye stops here',566,120,RED_);g.globalAlpha=1}
     if(t>0.15){g.globalAlpha=iseg(t,0.15,0.28);label(g,'X-ray of the head',200,12,'#8A8A85');g.globalAlpha=1}}},
  {title:'The stent retriever',cap:'A thin tube crosses the clot. A small mesh stent opens inside it and grips it for a few seconds, then it is pulled back with suction, bringing the clot out.',
   draw(g,t,time){const y0=190,x0=60,x1=660,R=24,cx=380,cross=iseg(t,0.02,0.18),open=iseg(t,0.2,0.34),grip=iseg(t,0.36,0.56),pull=iseg(t,0.6,0.86),flow=iseg(t,0.84,0.95);
     g.fillStyle=PINK_;g.fillRect(x0,y0-R,x1-x0,2*R);g.strokeStyle=INK_;g.lineWidth=1.6;g.beginPath();g.moveTo(x0,y0-R);g.lineTo(x1,y0-R);g.moveTo(x0,y0+R);g.lineTo(x1,y0+R);g.stroke();
     const off=-pull*360,clx=cx+off;
     if(clx>x0-40){g.fillStyle='#2a2622';g.beginPath();g.ellipse(clx,y0,46,R-3,0,0,7);g.fill();g.strokeStyle='rgba(239,233,220,0.4)';g.lineWidth=0.8;for(let k=0;k<6;k++){g.beginPath();g.moveTo(clx-40+k*14,y0-14);g.lineTo(clx-30+k*14,y0+14);g.stroke()}}
     g.strokeStyle=INK_;g.lineWidth=1.4;g.beginPath();g.moveTo(x0,y0);g.lineTo(x0+(cx+70-x0)*cross+off,y0);g.stroke();
     if(open>0){g.strokeStyle=grip>0?RED_:'#555';g.lineWidth=1.2;g.beginPath();for(let x=-58,k=0;x<=58;x+=8,k++){const yy=(k%2?1:-1)*(R-4)*open;g.lineTo(clx+x,y0+yy)}g.stroke();g.beginPath();for(let x=-58,k=0;x<=58;x+=8,k++){const yy=(k%2?-1:1)*(R-4)*open;g.lineTo(clx+x,y0+yy)}g.stroke()}
     if(flow>0){g.fillStyle=RED_;for(let k=0;k<14;k++){const x=x0+((time*140+k*43)%(x1-x0));if(x<clx+60&&clx>x0)continue;g.beginPath();g.arc(x,y0+((k*7)%9-4)*3,3.6,0,7);g.fill()}}
     const lab=t<0.2?'1  a thin tube crosses the clot':t<0.36?'2  the mesh stent opens inside it':t<0.6?'3  wait a few seconds: it grips the clot':t<0.86?'4  pull back with suction':'5  blood flows again';label(g,lab,360,300,t>=0.86?RED_:INK_,'center')}},
  {title:'Your job in the stroke room',cap:'Same keys as the heart room. Speed matters, but so does care: pushing too far in the brain’s small arteries can make them bleed.',
   draw(g,t){const steps=['The tube starts up in the neck artery','Film with dye: find where it stops','Send the thin tube (X) on into the head','Pull the clot out, and fast'];
     steps.forEach((s,i)=>{const a=iseg(t,0.05+i*0.14,0.18+i*0.14);if(!a)return;g.globalAlpha=a;const y=86+i*64;g.strokeStyle=INK_;g.lineWidth=1.4;g.beginPath();g.arc(190,y,19,0,7);g.stroke();label(g,String(i+1),190,y+1,INK_,'center');
       g.font='italic 24px "IM Fell English", Georgia, serif';g.fillStyle=INK_;g.textAlign='left';g.fillText(s,228,y+1);g.globalAlpha=1})}},
];
function openStrokeIntro(onClose){openIntro(SK_SCENES,{seenKey:'skIntroSeen',onClose,finish:onClose?'Start the tutorial':'Done'})}
