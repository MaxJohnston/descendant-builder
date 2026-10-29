/* Descendant Builder · js/storage.js
   Saving to localStorage, undo and redo, view settings, menus, find, the toast and keyboard shortcuts.
   All files share one global scope and must load in the order listed in index.html. */
'use strict';
var LSKEY='descendant-builder:v1', LSVIEW='descendant-builder:view';

function valid(o){ return o&&typeof o==='object'&&Array.isArray(o.people)&&o.people.every(function(p){return p&&p.id!=null}) }
function normalize(o){
  var s={v:1, app:'descendant-builder', root:o.root, people:o.people.map(function(p){ var q=Object.assign({},p); q.id=String(q.id); return q }),
    unions:(o.unions||[]).map(function(u){ var v=Object.assign({},u); v.id=String(v.id||uid('f')); v.p=(v.p||[]).map(String); v.ch=(v.ch||[]).map(String); return v })};
  ['showLiving','crossLines','hidePartners','nameView','sample','sampleNote','title'].forEach(function(k){ if(o[k]!=null) s[k]=o[k] });
  if(s.root!=null) s.root=String(s.root);
  return s;
}
function saveView(){ try{ localStorage.setItem(LSVIEW,JSON.stringify({view:view,depth:depth})) }catch(_){} }
function savedView(){ try{ return JSON.parse(localStorage.getItem(LSVIEW)||'null') }catch(_){ return null } }

/*{edit*/
var UNDO=[], REDO=[], saveTimer=null;
function setSave(t){ var s=$('#savest'); if(s) s.textContent=t }
function save(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(function(){ try{ localStorage.setItem(LSKEY,JSON.stringify(STATE)); setSave('Saved in this browser') }catch(_){ setSave('Could not save: browser storage is full or blocked. Export a backup.') } },150);
}
function commit(label){
  var snap=JSON.stringify(STATE), cap=Math.max(10,Math.min(100,Math.floor(4e7/snap.length)));  /* fewer undo steps for very big trees */
  UNDO.push({s:snap, label:label, view:view}); while(UNDO.length>cap) UNDO.shift(); REDO=[];
  if(STATE.sample){ delete STATE.sample; delete STATE.sampleNote }
  undoBtns();
}
function undoBtns(){ $('#undo').disabled=!UNDO.length; $('#redo').disabled=!REDO.length;
  $('#undo').title=UNDO.length?'Undo: '+UNDO[UNDO.length-1].label:''; $('#redo').title=REDO.length?'Redo: '+REDO[REDO.length-1].label:'' }
function undo(){ if(!UNDO.length) return; var e=UNDO.pop(); REDO.push({s:JSON.stringify(STATE),label:e.label,view:view}); STATE=JSON.parse(e.s); afterUndo(e); toast('Undid: '+e.label) }
function redo(){ if(!REDO.length) return; var e=REDO.pop(); UNDO.push({s:JSON.stringify(STATE),label:e.label,view:view}); STATE=JSON.parse(e.s); afterUndo(e); toast('Redid: '+e.label) }
function afterUndo(e){ rebuild(); if(!P.has(view)) view=P.has(e.view)?e.view:STATE.root; fillDepth(); render(true); save(); undoBtns() }
function resetHistory(){ UNDO=[]; REDO=[]; undoBtns() }
/*}edit*/

var toastTimer=null;
function toast(msg){
  var t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){ t.hidden=true },3200);
}

/* ---------- menus ---------- */
function menu(btn,box){
  btn.onclick=function(e){ e.stopPropagation(); var open=box.hidden; document.querySelectorAll('.menu').forEach(function(m){ m.hidden=true });
    document.querySelectorAll('[aria-haspopup]').forEach(function(b){ b.setAttribute('aria-expanded','false') });
    box.hidden=!open; btn.setAttribute('aria-expanded',String(open)) };
}
menu($('#viewbtn'),$('#viewmenu'));
document.addEventListener('click',function(e){ if(!e.target.closest('.mwrap')) document.querySelectorAll('.menu').forEach(function(m){ m.hidden=true }) });
function syncPrefs(){
  $('#showliv').checked=!!STATE.showLiving;
  $('#crossln').checked=!!STATE.crossLines;
  $('#hidesp').checked=!!STATE.hidePartners;
  document.querySelectorAll('[name=nameview]').forEach(function(r){ r.checked=r.value===(STATE.nameView||'birth') });
}
$('#hidesp').onchange=function(){ STATE.hidePartners=this.checked?1:0; render(true); if(!READONLY) save() };
$('#crossln').onchange=function(){ STATE.crossLines=this.checked?1:0; render(true); if(!READONLY) save() };
$('#showliv').onchange=function(){ STATE.showLiving=this.checked?1:0; render(true); if(!READONLY) save() };
document.querySelectorAll('[name=nameview]').forEach(function(r){ r.onchange=function(){ STATE.nameView=this.value; render(true); if(!READONLY) save() } });

/* ---------- find ---------- */
var fnorm=function(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim() };
function search(q,max){
  q=fnorm(q); if(!q) return [];
  var ws=q.split(' '), out=[];
  STATE.people.forEach(function(p){
    var hay=fnorm([p.name,p.mln,p.seat,p.bp,p.dp,p.b,p.d,p.idx].filter(Boolean).join(' '));
    if(ws.every(function(w){return hay.indexOf(w)>=0})){ var sc=fnorm(p.name).indexOf(ws[0])===0?0:1; out.push([sc,p.name,p.id]) }
  });
  out.sort(function(a,b){ return a[0]-b[0]||a[1].localeCompare(b[1]) });
  return out.slice(0,max||12).map(function(x){return x[2]});
}
(function(){
  var inp=$('#find'), list=$('#findlist'), sel=-1, res=[];
  function draw(){
    res=search(inp.value,12); sel=res.length?0:-1;
    list.innerHTML=res.length?res.map(function(id,i){ var p=P.get(id), g=genFrom(STATE.root,id), sub=[years(p), p.seat, g>0?relWord(g,p.sex)+' of '+firstName(P.get(STATE.root)):(g<0?'Married in':'')].filter(Boolean).join(' · ');
      return '<li role="option" id="fo'+i+'" data-id="'+esc(id)+'" aria-selected="'+(i===sel)+'"><b>'+esc(dispName(p))+'</b><span>'+esc(sub)+'</span></li>' }).join(''):'<li class="none">No one found</li>';
    list.hidden=!inp.value.trim(); inp.setAttribute('aria-expanded',String(!list.hidden));
  }
  function pick(id){ list.hidden=true; inp.value=''; inp.blur(); goTo(id) }
  inp.addEventListener('input',draw);
  inp.addEventListener('keydown',function(e){
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); if(!res.length) return; sel=(sel+(e.key==='ArrowDown'?1:-1)+res.length)%res.length;
      list.querySelectorAll('li').forEach(function(li,i){ li.setAttribute('aria-selected',String(i===sel)) }); inp.setAttribute('aria-activedescendant','fo'+sel) }
    else if(e.key==='Enter'&&sel>=0){ e.preventDefault(); pick(res[sel]) }
    else if(e.key==='Escape'){ list.hidden=true; inp.value='' }
  });
  list.addEventListener('mousedown',function(e){ var li=e.target.closest('[data-id]'); if(li){ e.preventDefault(); pick(li.getAttribute('data-id')) } });
  inp.addEventListener('blur',function(){ setTimeout(function(){ list.hidden=true },120) });
})();

/* ---------- keyboard ---------- */
document.addEventListener('keydown',function(e){
  var t=e.target, typing=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);
  if(typing||!$('#sheet').hidden) return;
  if((e.ctrlKey||e.metaKey)&&!READONLY&&editing){
    if(e.key==='z'&&!e.shiftKey){ e.preventDefault(); undo() } else if(e.key==='y'||(e.key==='z'&&e.shiftKey)||e.key==='Z'){ e.preventDefault(); redo() }
    return;
  }
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  if(e.key==='+'||e.key==='='){ zoomTo(scale*1.2) } else if(e.key==='-'){ zoomTo(scale/1.2) } else if(e.key==='0'){ fit() }
  else if(e.key==='/'){ e.preventDefault(); $('#find').focus() }
});
