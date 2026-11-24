/* Cath Lab Run: sound. Everything is synthesised with the Web Audio API (no sound files):
   - the heart monitor beep on every beat, and a monitor alarm when the blood pressure collapses
   - the X-ray: a pedal click and a low hum while fluoro is on, a brighter whir while recording (cine)
   - a hiss while injecting dye, a click when the catheter engages an artery, a snap on a whip
   - the inflator ticking up in atmospheres, a soft whoosh when the balloon comes down, a chime when a stent is in,
     a ding when the wire crosses
   - a two-tone warning with every warning message, and a chime for medals and achievements
   - a very quiet tick on buttons
   The game state is watched each frame, so the game code only calls sfx() for the report chimes.
   Settings (volume, monitor beep, button ticks, mute) live in this browser. Audio starts on the first click or key,
   as browsers require. */
"use strict";
const SND_KEY='cathlabrun.sound.v1';
let SND={vol:0.6,beat:true,ui:true,muted:false};
try{Object.assign(SND,JSON.parse(localStorage.getItem(SND_KEY)||'{}'))}catch(e){}
const saveSnd=()=>{try{localStorage.setItem(SND_KEY,JSON.stringify(SND))}catch(e){}};
let AC=null,MASTER=null,NOISE=null;
function audio(){
  if(AC)return AC;
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
  try{AC=new C();MASTER=AC.createGain();MASTER.connect(AC.destination);setMaster();
    const n=AC.sampleRate*2;NOISE=AC.createBuffer(1,n,AC.sampleRate);const d=NOISE.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1}catch(e){AC=null}
  return AC;
}
function setMaster(){if(MASTER)MASTER.gain.setTargetAtTime(SND.muted||document.hidden?0:SND.vol*0.7,AC.currentTime,0.03)}
['pointerdown','keydown'].forEach(ev=>addEventListener(ev,()=>{const a=audio();if(a&&a.state==='suspended')a.resume()},{capture:true}));
document.addEventListener('visibilitychange',()=>{if(AC)setMaster()});
const live=()=>!!(AC&&AC.state==='running'&&!SND.muted);

/* one-shot sounds */
function tone(f,dur,{type='sine',vol=0.2,at=0,a=0.005,glide=null,dest=null}={}){
  const t=AC.currentTime+at,o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(glide)o.frequency.exponentialRampToValueAtTime(glide,t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(dest||MASTER);o.start(t);o.stop(t+dur+0.05);
}
function burst(dur,{type='bandpass',f=1500,q=1,vol=0.2,at=0,sweep=null}={}){
  const t=AC.currentTime+at,s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=NOISE;fl.type=type;fl.frequency.setValueAtTime(f,t);fl.Q.value=q;
  if(sweep)fl.frequency.exponentialRampToValueAtTime(sweep,t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+0.004);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(fl);fl.connect(g);g.connect(MASTER);s.start(t,Math.random());s.stop(t+dur+0.05);
}
const SFX={
  beep:()=>tone(988,0.09,{vol:0.07}),
  alarm:()=>{for(let i=0;i<3;i++)tone(960,0.12,{type:'triangle',vol:0.09,at:i*0.18})},
  pedal:()=>{burst(0.03,{f:900,q:2,vol:0.12});tone(140,0.05,{type:'triangle',vol:0.08})},
  engage:()=>{burst(0.025,{f:2200,q:3,vol:0.14});tone(190,0.07,{type:'triangle',vol:0.12})},
  snap:()=>{burst(0.06,{type:'highpass',f:2500,vol:0.2});tone(1200,0.12,{type:'triangle',vol:0.12,glide:180})},
  tick:()=>tone(1500,0.025,{type:'square',vol:0.035}),
  atm:n=>tone(420+n*28,0.04,{type:'square',vol:0.05}),
  whoosh:()=>burst(0.45,{type:'lowpass',f:1800,sweep:160,vol:0.12}),
  ding:()=>{tone(1320,0.5,{vol:0.08});tone(1980,0.35,{vol:0.03})},
  stent:()=>{[523.3,659.3,784].forEach((f,i)=>tone(f,0.6,{vol:0.09,at:i*0.09}))},
  warn:()=>{tone(660,0.16,{type:'triangle',vol:0.08});tone(440,0.22,{type:'triangle',vol:0.08,at:0.17})},
  chime:()=>{[659.3,784,987.8,1318.5].forEach((f,i)=>tone(f,0.7,{vol:0.07,at:i*0.08}))},
  ui:()=>tone(2200,0.018,{vol:0.02}),
};
function sfx(name,arg){if(!live()||!SFX[name])return;try{SFX[name](arg)}catch(e){}}

/* continuous sounds: built once, their level follows the game each frame */
const LOOPS={};
function loopNode(name){
  if(LOOPS[name])return LOOPS[name];
  const g=AC.createGain();g.gain.value=0;g.connect(MASTER);const parts=[];
  const noise=(type,f,q,v)=>{const s=AC.createBufferSource(),fl=AC.createBiquadFilter(),gg=AC.createGain();s.buffer=NOISE;s.loop=true;fl.type=type;fl.frequency.value=f;fl.Q.value=q;gg.gain.value=v;s.connect(fl);fl.connect(gg);gg.connect(g);s.start();parts.push(s)};
  const osc=(type,f,v,lp)=>{const o=AC.createOscillator(),gg=AC.createGain(),fl=AC.createBiquadFilter();o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=lp;gg.gain.value=v;o.connect(fl);fl.connect(gg);gg.connect(g);o.start();parts.push(o)};
  if(name==='fluoro'){osc('sawtooth',58,0.5,260);noise('bandpass',1800,0.8,0.12)}
  if(name==='cine'){osc('triangle',233,0.18,1200);noise('bandpass',3200,1.2,0.16)}
  if(name==='inject'){noise('highpass',2600,0.7,0.6)}
  return LOOPS[name]={g,parts};
}
function loopLevel(name,v){if(!AC)return;if(!LOOPS[name]&&v<=0)return;const L=loopNode(name);L.g.gain.setTargetAtTime(v,AC.currentTime,0.05)}

/* watch the game each frame */
const prev={};
function soundFrame(){
  requestAnimationFrame(soundFrame);
  if(!AC)return;
  const on=typeof S!=='undefined'&&S&&!S.done&&!document.body.classList.contains('inmenu');
  const fl=on&&typeof down==='function'&&down('Space','KeyF')&&!S.complication,cine=on&&!!S.cine;
  const inj=on&&down('KeyJ')&&!S.complication&&S.exch<=0;
  loopLevel('fluoro',live()&&(fl||cine)?0.09:0);loopLevel('cine',live()&&cine?0.07:0);loopLevel('inject',live()&&inj?0.06:0);
  if(!on){prev.case=null;return}
  if(prev.case!==S){Object.assign(prev,{case:S,fl,cine,eng:S.cs&&S.cs.eng,phase:S.phase,whips:S.whips||0,stents:S.stents.length,stage:S.pci&&S.pci.stage,atm:0,alarmT:0});return}
  if(fl&&!prev.fl)sfx('pedal');
  if(cine!==prev.cine)sfx('pedal');
  const eng=S.cs&&S.cs.eng&&!S.cs.deep;if(eng&&!prev.eng)sfx('engage');
  if(SND.beat&&S.phase<prev.phase)sfx('beep');
  if((S.whips||0)>prev.whips)sfx('snap');
  if(S.stents.length>prev.stents)sfx('stent');
  const P=S.pci,stage=P&&P.stage;
  if(prev.stage==='wire'&&(stage==='tools'||stage==='ffr'))sfx('ding');
  const atm=P&&P.stage==='positioned'?Math.floor(P.atm):0;
  if(atm>prev.atm&&atm%2===0)sfx('atm',atm);
  if(prev.atm>=4&&atm===0&&stage)sfx('whoosh');
  // monitor alarm while the pressure has collapsed
  prev.alarmT-=1/60;if((S.tamponade||S.sysP<80)&&prev.alarmT<=0){sfx('alarm');prev.alarmT=2.2}
  Object.assign(prev,{fl,cine,eng,phase:S.phase,whips:S.whips||0,stents:S.stents.length,stage,atm});
}
requestAnimationFrame(soundFrame);
/* a warning tone with every warning message */
if(typeof toast==='function'){const t0=toast;let last=0;window.toast=function(msg,danger){t0(msg,danger);if(danger&&performance.now()-last>1200){last=performance.now();sfx('warn')}}}
/* a very quiet tick on buttons */
document.addEventListener('click',e=>{if(SND.ui&&e.target.closest('button'))sfx('ui')},true);

/* the mute button and the settings in the Controls dialog */
function soundButton(){const b=document.getElementById('sndBtn');if(!b)return;b.textContent=SND.muted?'Sound: off':'Sound: on';b.setAttribute('aria-pressed',String(!SND.muted))}
document.getElementById('sndBtn')?.addEventListener('click',()=>{SND.muted=!SND.muted;saveSnd();audio();if(AC&&AC.state==='suspended')AC.resume();setMaster();soundButton();if(!SND.muted)setTimeout(()=>sfx('ding'),60)});
soundButton();
function soundSettingsHTML(){
  return `<div class="grouplabel">Sound</div><div class="sndrow"><label for="sndVol">Volume</label><input type="range" id="sndVol" data-snd="vol" min="0" max="1" step="0.05" value="${SND.vol}"><button class="btn" data-snd="test">Test</button></div>
    <label class="ctrlcheck"><input type="checkbox" data-snd="muted" ${SND.muted?'':'checked'}> Sound on</label>
    <label class="ctrlcheck"><input type="checkbox" data-snd="beat" ${SND.beat?'checked':''}> Heart monitor beep on every heartbeat</label>
    <label class="ctrlcheck"><input type="checkbox" data-snd="ui" ${SND.ui?'checked':''}> Quiet tick on buttons</label>`;
}
function soundSettingEvent(e){
  const el=e.target.closest('[data-snd]');if(!el)return false;const k=el.dataset.snd;audio();if(AC&&AC.state==='suspended')AC.resume();
  if(k==='vol'){SND.vol=+el.value;setMaster()}
  else if(k==='muted'){SND.muted=!el.checked;setMaster();soundButton()}
  else if(k==='beat'||k==='ui')SND[k]=el.checked;
  else if(k==='test'){sfx('stent');setTimeout(()=>sfx('beep'),700)}
  saveSnd();return true;
}
