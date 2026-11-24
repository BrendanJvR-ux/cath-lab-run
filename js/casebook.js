/* Cath Lab Run: the casebook. A page for every rare patient you have treated (with an angiogram of the first one,
   drawn by the game's own renderer), and a list of the presentations you have seen. Filled in when a case is
   completed; the tutorial does not count. */
"use strict";
const PRESENTATIONS=['Exertional chest pain','Angina despite tablets','Positive stress test','Breathless on exertion','Chest pain on hills',
  'Inferior NSTEMI','Anterior NSTEMI','Lateral NSTEMI','Inferior STEMI','Anterior STEMI','Lateral STEMI'];
function casebookOf(p=profile){p.casebook=p.casebook||{rare:{},seen:{}};p.casebook.rare=p.casebook.rare||{};p.casebook.seen=p.casebook.seen||{};return p.casebook}
/* record a completed case; returns the new rare page, if this is the first time */
function recordCasebook(c,score){
  const cb=casebookOf(),today=dateKey();let fresh=null;
  if(c.rare&&RARE_BY[c.rare]){const e=cb.rare[c.rare];if(!e){cb.rare[c.rare]={first:today,code:c.code,n:1,best:score};fresh=RARE_BY[c.rare]}else{e.n++;e.best=Math.max(e.best,score)}}
  if(c.title){const e=cb.seen[c.title]||{n:0,best:0};e.n++;e.best=Math.max(e.best,score);cb.seen[c.title]=e}
  saveProfile();return fresh;
}
function casebookReportHTML(fresh){
  return fresh?`<div class="medalrow casenew"><span class="medal none" aria-hidden="true">✎</span><span><b>New casebook page: ${fresh.name}</b> · ${fresh.short}. Read it under Casebook on the main menu.</span></div>`:'';
}
function casebookView(){
  const cb=casebookOf(),met=RARE_KINDS.filter(k=>cb.rare[k.id]).length,seen=PRESENTATIONS.filter(t=>cb.seen[t]).length;
  return `<h1>Casebook</h1>
    <p class="fine">Rare patients turn up about once in every thirteen cases, in any mode. Treat one to add its page. ${met} of ${RARE_KINDS.length} rare patients and ${seen} of ${PRESENTATIONS.length} presentations so far.</p>
    <div class="cbpages">${RARE_KINDS.map(k=>{const e=cb.rare[k.id];
      return e?`<article class="cbpage"><canvas class="cbimg" width="320" height="320" data-code="${e.code}" data-kind="${k.id}" aria-label="Angiogram of your first ${k.name.toLowerCase()} patient"></canvas>
        <div><h3>${k.name}</h3><p class="cbshort">${k.short}</p><p>${k.blurb}</p><p class="cbtip"><b>Tip.</b> ${k.tip}</p>
        <span class="fine">First met ${e.first} · patient ${e.code} · treated ${e.n} time${e.n===1?'':'s'} · best ${e.best}</span></div></article>`
        :`<article class="cbpage locked"><div class="cbimg blank" aria-hidden="true">?</div><div><h3>${k.name}</h3><p class="cbshort">${k.short}</p><span class="fine">Not met yet. Keep taking new patients.</span></div></article>`}).join('')}</div>
    <div class="grouplabel">Presentations</div>
    <div class="cbseen">${PRESENTATIONS.map(t=>{const e=cb.seen[t];return `<span class="${e?'got':''}">${e?'✓ ':''}${t}${e?` <small>×${e.n} · best ${e.best}</small>`:''}</span>`}).join('')}</div>
    <div class="row"><button class="btn" data-act="home">Back</button></div>`;
}
/* draw the first patient of each kind with the game's renderer, in the view that shows its feature best */
function drawCasebookImages(){
  const cans=[...document.querySelectorAll('canvas.cbimg[data-code]')];if(!cans.length)return;
  const keepCtx=ictx,keepMode=HEART_MODE,tmp=document.createElement('canvas');tmp.width=tmp.height=W*2;
  const VIEW={anomrca:[45,0],leftdom:[-30,-25],tortuous:[-30,30],leftmain:[45,-30],long:[-30,30],kidney:[-30,-25]};
  try{
    for(const cv of cans){
      const p=generatePatient(cv.dataset.code);if(!p)continue;buildAnatomy(p.anatomy);
      const les=prepLesions(p.lesions),sys=p.rare==='anomrca'?'R':(VBY[p.lesions[0].vid]||{}).sys||'L',[a,b]=VIEW[p.rare]||[-30,-25];
      HEART_MODE='outline';ictx=tmp.getContext('2d');
      renderImage({t:6,phase:0.3,a,b,mode:'cine',frame:0,lesions:les,pci:null,events:[],cath:false,conc:s=>(p.rare==='leftdom'?s==='L':s===sys)?1:0,root:0});
      cv.getContext('2d').drawImage(tmp,0,0,cv.width,cv.height);
    }
  }catch(e){}
  ictx=keepCtx;HEART_MODE=keepMode;
}
