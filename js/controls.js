/* Cath Lab Run: controls. Every action can be bound to two inputs: a key, a mouse button (used over the X-ray image)
   or the scroll wheel (over the image). Bindings are saved in this browser. Number keys 1–7 always pick the C-arm views. */
"use strict";
const CTRL_KEY='cathlabrun.controls.v1';
const ACTIONS=[
  {id:'ArrowUp',label:'Advance catheter',grp:'Catheter',def:['ArrowUp','KeyW']},
  {id:'ArrowDown',label:'Withdraw catheter',grp:'Catheter',def:['ArrowDown','KeyS']},
  {id:'ArrowLeft',label:'Turn anticlockwise',grp:'Catheter',def:['ArrowLeft','KeyA']},
  {id:'ArrowRight',label:'Turn clockwise',grp:'Catheter',def:['ArrowRight','KeyD']},
  {id:'KeyX',label:'Switch catheter (JL4 / JR4)',grp:'Catheter',def:['KeyX',null]},
  {id:'Space',label:'Fluoro (hold)',grp:'X-ray',def:['Space','KeyF']},
  {id:'KeyC',label:'Record cine (start / stop)',grp:'X-ray',def:['KeyC',null]},
  {id:'KeyJ',label:'Inject contrast (hold)',grp:'X-ray',def:['KeyJ',null]},
  {id:'KeyB',label:'Inflate balloon or stent (hold)',grp:'Treatment',def:['KeyB',null]},
];
// mouse-first layout: left button for fluoro, right button to inject, wheel to advance and withdraw, middle button records
const MOUSE_PRESET={ArrowUp:['WheelUp','ArrowUp'],ArrowDown:['WheelDown','ArrowDown'],ArrowLeft:['ArrowLeft','KeyA'],ArrowRight:['ArrowRight','KeyD'],
  KeyX:['KeyX',null],Space:['Mouse0','Space'],KeyC:['Mouse1','KeyC'],KeyJ:['Mouse2','KeyJ'],KeyB:['KeyB',null]};
const RESERVED=new Set(['Escape','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7']);
let CTRL=null,INPUT_MAP=new Map();
function ctrlDefaults(){const b={};for(const a of ACTIONS)b[a.id]=a.def.slice();return {binds:b,drag:false}}
function loadControls(){
  CTRL=ctrlDefaults();
  try{const s=JSON.parse(localStorage.getItem(CTRL_KEY)||'null');
    if(s&&s.binds){for(const a of ACTIONS){const v=s.binds[a.id];if(Array.isArray(v))CTRL.binds[a.id]=[v[0]||null,v[1]||null]}CTRL.drag=!!s.drag}}catch(e){}
  buildInputMap();
}
function saveControls(){try{localStorage.setItem(CTRL_KEY,JSON.stringify(CTRL))}catch(e){}buildInputMap();labelControls()}
function buildInputMap(){INPUT_MAP=new Map();for(const a of ACTIONS)for(const c of CTRL.binds[a.id])if(c)INPUT_MAP.set(c,a.id)}
const KEY_NAMES={ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Space:'Space',Enter:'Enter',Tab:'Tab',Backspace:'Backspace',
  ShiftLeft:'Left Shift',ShiftRight:'Right Shift',ControlLeft:'Left Ctrl',ControlRight:'Right Ctrl',AltLeft:'Left Alt',AltRight:'Right Alt',MetaLeft:'Cmd',MetaRight:'Right Cmd',
  Backquote:'`',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backslash:'\\',CapsLock:'Caps Lock',
  Mouse0:'Left click',Mouse1:'Middle click',Mouse2:'Right click',Mouse3:'Mouse back',Mouse4:'Mouse forward',WheelUp:'Wheel up',WheelDown:'Wheel down'};
const SHORT={Mouse0:'L-click',Mouse1:'M-click',Mouse2:'R-click',Mouse3:'M4',Mouse4:'M5',WheelUp:'Wheel ↑',WheelDown:'Wheel ↓',ShiftLeft:'Shift',ShiftRight:'Shift',ControlLeft:'Ctrl',ControlRight:'Ctrl',AltLeft:'Alt',AltRight:'Alt'};
function bindName(c){if(!c)return '';if(KEY_NAMES[c])return KEY_NAMES[c];if(/^Key[A-Z]$/.test(c))return c.slice(3);if(/^Digit\d$/.test(c))return c.slice(5);if(/^Numpad/.test(c))return 'Num '+c.slice(6);return c}
/* the label shown on a button: its first binding */
function shortKey(id){const b=(CTRL&&CTRL.binds[id])||[];const c=b[0]||b[1];return c?(SHORT[c]||bindName(c)):'–'}
function labelControls(){
  document.querySelectorAll('.strip .hold[data-k]').forEach(b=>{const k=b.querySelector('kbd');if(k)k.textContent=shortKey(b.dataset.k)});
  const c=document.querySelector('#bCine kbd');if(c)c.textContent=shortKey('KeyC');
  document.querySelectorAll('[data-hold] kbd').forEach(k=>k.textContent=shortKey('KeyB'));
  const t=document.getElementById('cathToggle');if(t)t.setAttribute('aria-label',`Catheter (${shortKey('KeyX')} to switch)`);
}

/* ---------- input: several inputs can hold the same action, so an action stays on until all are released ---------- */
const HELD={};
function actPress(id,src){
  if(id==='KeyC'){toggleCine();return}
  if(id==='KeyX'){if(S&&!S.done)exchangeTo(S.cath.type==='JL'?'JR':'JL');return}
  (HELD[id]=HELD[id]||new Set()).add(src);keys[id]=true;
}
function actRelease(id,src){const h=HELD[id];if(!h)return;h.delete(src);keys[id]=h.size>0}
function releaseAll(){for(const id in HELD){HELD[id].clear();keys[id]=false}}
let capturing=null;
window.addEventListener('keydown',e=>{
  if(capturing)return;
  if(document.querySelector('.glossary,.ctrlmodal'))return;
  if(e.target&&(e.target.tagName==='INPUT'&&e.target.type!=='range'))return;
  if(e.target&&e.target.type==='range'&&e.code.startsWith('Arrow'))return;
  const id=INPUT_MAP.get(e.code),preset=/^Digit[1-7]$/.test(e.code);
  if(!id&&!preset)return;
  if(S&&!S.done)e.preventDefault();
  if(e.repeat)return;
  if(preset){setPreset(+e.code.slice(5)-1);return}
  actPress(id,e.code);
});
window.addEventListener('keyup',e=>{const id=INPUT_MAP.get(e.code);if(id)actRelease(id,e.code)});
window.addEventListener('blur',releaseAll);

/* mouse buttons and the wheel act only over the live X-ray image, not on buttons, pop-ups or menus */
const monEl=document.getElementById('monitor');
const liveTarget=e=>!!(S&&!S.done&&!S.review&&!e.target.closest('.overlay,.txpop,.reviewbar,button,input,a'));
let dragX=null;
monEl.addEventListener('mousedown',e=>{
  if(!liveTarget(e))return;
  const code='Mouse'+e.button,id=INPUT_MAP.get(code);
  if(e.button===0&&CTRL.drag)dragX=e.clientX;
  if(!id&&!(e.button===0&&CTRL.drag))return;
  e.preventDefault();if(id)actPress(id,code);
});
window.addEventListener('mouseup',e=>{const code='Mouse'+e.button,id=INPUT_MAP.get(code);if(id)actRelease(id,code);if(e.button===0)dragX=null});
window.addEventListener('mousemove',e=>{
  if(dragX==null||!S||S.done)return;
  if(!(e.buttons&1)){dragX=null;return}
  S.dragTurn=(S.dragTurn||0)+(e.clientX-dragX)*0.55;dragX=e.clientX;
});
monEl.addEventListener('contextmenu',e=>{if(S&&!S.done&&!S.review&&INPUT_MAP.has('Mouse2'))e.preventDefault()});
monEl.addEventListener('auxclick',e=>{if(liveTarget(e))e.preventDefault()});
const wheelT={};
monEl.addEventListener('wheel',e=>{
  if(!liveTarget(e)||!e.deltaY)return;
  const code=e.deltaY<0?'WheelUp':'WheelDown',id=INPUT_MAP.get(code);if(!id)return;
  e.preventDefault();actPress(id,code);
  // each notch is a short push or pull
  clearTimeout(wheelT[code]);wheelT[code]=setTimeout(()=>actRelease(id,code),160);
},{passive:false});

/* ---------- settings dialog ---------- */
function openControls(){
  closeControls();releaseAll();
  const d=document.createElement('div');d.className='glossary ctrlmodal';d.setAttribute('role','dialog');d.setAttribute('aria-label','Controls');
  document.body.appendChild(d);
  let note='';
  const draw=()=>{
    const groups=[...new Set(ACTIONS.map(a=>a.grp))];
    const isMouse=ACTIONS.every(a=>JSON.stringify(CTRL.binds[a.id])===JSON.stringify(MOUSE_PRESET[a.id]));
    const isKeys=ACTIONS.every(a=>JSON.stringify(CTRL.binds[a.id])===JSON.stringify(a.def));
    d.innerHTML=`<div class="glbox ctrlbox"><div class="glhead"><b>Controls and sound</b><span class="fine" style="flex:1">Click a box, then press a key, click a mouse button or scroll.</span><button class="btn" data-c-close="1">Done</button></div>
      <div class="ctrlbody">
        ${typeof soundSettingsHTML==='function'?soundSettingsHTML()+'<div class="grouplabel" style="margin-top:6px">Controls</div>':''}
        <div class="ctrlpresets"><span class="grouplabel">Layout</span>
          <button class="btn${isKeys?' primary':''}" data-c-preset="keys">Keyboard</button>
          <button class="btn${isMouse?' primary':''}" data-c-preset="mouse">Mouse + keyboard</button></div>
        <label class="ctrlcheck"><input type="checkbox" id="ctrlDrag" ${CTRL.drag?'checked':''}> Hold the left mouse button on the X-ray and drag sideways to turn the catheter</label>
        ${note?`<p class="ctrlnote">${note}</p>`:''}
        ${groups.map(g=>`<div class="grouplabel">${g}</div><div class="ctrlrows">${ACTIONS.filter(a=>a.grp===g).map(a=>`<div class="ctrlrow"><span>${a.label}</span>${[0,1].map(s=>{const c=CTRL.binds[a.id][s],cap=capturing&&capturing.id===a.id&&capturing.slot===s;
          return `<button class="bind${cap?' cap':''}${c?'':' empty'}" data-c-id="${a.id}" data-c-slot="${s}">${cap?'Press…':c?bindName(c):'none'}</button>`}).join('')}</div>`).join('')}</div>`).join('')}
        <p class="fine">Mouse buttons and the wheel work while the pointer is over the X-ray image (not while reviewing a run, when clicks mark lesions). Number keys 1–7 always pick the C-arm views. While a box is waiting, Backspace clears it and Esc cancels.</p>
        <div class="row"><button class="btn" data-c-reset="1">Reset to default</button></div>
      </div></div>`;
  };
  const finishCapture=code=>{
    const {id,slot}=capturing;capturing=null;
    if(code==null){note='';draw();return}
    if(code===''){CTRL.binds[id][slot]=null;note='';saveControls();draw();return}
    if(RESERVED.has(code)){note=`${bindName(code)} is kept for ${code==='Escape'?'cancelling':'the C-arm views'}.`;draw();return}
    note='';
    for(const a of ACTIONS)for(let s=0;s<2;s++)if(CTRL.binds[a.id][s]===code&&!(a.id===id&&s===slot)){CTRL.binds[a.id][s]=null;note=`${bindName(code)} moved from “${a.label}”.`}
    CTRL.binds[id][slot]=code;saveControls();draw();
  };
  d.addEventListener('click',e=>{
    if(e.target===d||e.target.closest('[data-c-close]')){closeControls();return}
    if(e.target.closest('[data-snd]')){if(e.target.closest('button')&&typeof soundSettingEvent==='function')soundSettingEvent(e);return}
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.cId){if(capturing)return;capturing={id:b.dataset.cId,slot:+b.dataset.cSlot};note='';draw();return}
    if(b.dataset.cPreset){const p=b.dataset.cPreset;for(const a of ACTIONS)CTRL.binds[a.id]=(p==='mouse'?MOUSE_PRESET[a.id]:a.def).slice();if(p==='mouse')CTRL.drag=true;note=p==='mouse'?'Mouse layout: left click fluoro, right click inject, wheel advances and withdraws, middle click records, drag sideways to turn.':'';saveControls();draw()}
    if(b.dataset.cReset){const z=ctrlDefaults();CTRL.binds=z.binds;CTRL.drag=false;note='';saveControls();draw()}
  });
  d.addEventListener('change',e=>{if(e.target.id==='ctrlDrag'){CTRL.drag=e.target.checked;saveControls()}else if(typeof soundSettingEvent==='function')soundSettingEvent(e)});
  d.addEventListener('input',e=>{if(e.target.dataset&&e.target.dataset.snd==='vol'&&typeof soundSettingEvent==='function')soundSettingEvent(e)});
  // capture: the next key, mouse button or wheel notch after a box was clicked
  ctrlKeyHandler=e=>{
    if(!capturing){if(e.key==='Escape')closeControls();return}
    e.preventDefault();e.stopPropagation();
    finishCapture(e.code==='Escape'?null:(e.code==='Backspace'||e.code==='Delete')?'':e.code);
  };
  window.addEventListener('keydown',ctrlKeyHandler,true);
  d.addEventListener('mousedown',e=>{if(!capturing||!e.target.closest('.bind.cap'))return;e.preventDefault();finishCapture('Mouse'+e.button)});
  d.addEventListener('contextmenu',e=>{if(capturing||e.target.closest('.bind'))e.preventDefault()});
  d.addEventListener('auxclick',e=>e.preventDefault());
  d.addEventListener('wheel',e=>{if(!capturing||!e.target.closest('.bind.cap'))return;e.preventDefault();finishCapture(e.deltaY<0?'WheelUp':'WheelDown')},{passive:false});
  draw();d.querySelector('.bind').focus();
}
let ctrlKeyHandler=null;
function closeControls(){capturing=null;if(ctrlKeyHandler){window.removeEventListener('keydown',ctrlKeyHandler,true);ctrlKeyHandler=null}document.querySelectorAll('.ctrlmodal').forEach(n=>n.remove())}
document.addEventListener('click',e=>{const b=e.target.closest('[data-ctrl]');if(b){e.preventDefault();openControls()}});
loadControls();labelControls();
