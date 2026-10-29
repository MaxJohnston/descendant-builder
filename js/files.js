/* Descendant Builder · js/files.js
   Files: the .txt backup, GEDCOM import and export, moving people to and from Pedigree Builder,
   the read-only web page, and the Backup & import screen.
   All files share one global scope and must load in the order listed in index.html. */
'use strict';

/* Inside claude.ai the page cannot start downloads itself, so it asks the viewer through the "downloads"
   capability there; everywhere else it uses an ordinary download link. */
var DL=null;
try{ if(window.claude&&window.claude.use) window.claude.use('downloads').then(function(d){ DL=d }).catch(function(){}) }catch(_){}
function linkDownload(name,text,type){
  var a=document.createElement('a'), b=new Blob([text],{type:type||'text/plain;charset=utf-8'});
  a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove() },500);
}
function download(name,text,type){
  if(!DL) return linkDownload(name,text,type);
  DL.save({filename:name, data:text}).then(function(){ toast('Saved '+name) },function(e){
    var c=e&&e.code;
    if(c==='rejected_extension'&&!/\.txt$/.test(name)) return DL.save({filename:name+'.txt', data:text}).then(function(){ toast('Saved '+name+'.txt. Remove the .txt ending before importing it elsewhere.') },function(){});
    if(c!=='declined') toast('Could not save the file here.');
  });
}
var today=function(){ return new Date().toISOString().slice(0,10) };
var slug=function(s){ return String(s||'tree').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'tree' };
var PFIELDS=['name','fn','mn','ln','sx','mln','sex','l','b','bm','bdy','bq','b2','d','dm','ddy','dq','d2','bp','dp','occ','spouse','notes','star','wiki','children','ev','src'];

/* ---------- .txt backup ---------- */
function exportTxt(){
  var r=P.get(STATE.root);
  download('descendants-'+slug(r&&r.name)+'-'+today()+'.txt','Descendant Builder export · '+(r?r.name:'')+' · '+today()+'\nImport this file on the Backup & import screen.\n\n'+JSON.stringify(STATE,null,1));
}
function parseJsonText(t){ var a=t.indexOf('{'), b=t.lastIndexOf('}'); if(a<0||b<a) throw new Error('no data'); return JSON.parse(t.slice(a,b+1)) }

/* ---------- Pedigree Builder ----------
   Pedigree Builder numbers people by their place in a pedigree (Ahnentafel numbers: father of n is 2n, mother 2n+1).
   Importing turns those numbers into partnerships; exporting builds a pedigree of one person's ancestors. */
function fromPedigree(o){
  var by=new Map(); o.people.forEach(function(p){ if(p.ref==null) by.set(p.n,p) });
  var id=function(n){ return 'n'+n }, people=[], fams=new Map(), unions=[];
  by.forEach(function(p,n){
    var q={id:id(n)}; PFIELDS.forEach(function(k){ if(p[k]!=null) q[k]=clone(p[k]) });
    q.sex=n===1?(p.sex||undefined):(n%2===0?'M':'F'); if(!q.sex) delete q.sex;
    var resi=(q.ev||[]).filter(function(e){return e.t==='resi'&&e.pl})[0]; if(resi&&!q.seat) q.seat=resi.pl;
    people.push(q);
  });
  by.forEach(function(p,n){
    var f=p.fa!=null?p.fa:2*n, m=p.mo!=null?p.mo:2*n+1, hf=by.has(f), hm=by.has(m);
    if(!hf&&!hm) return;
    var key=(hf?f:'-')+'|'+(hm?m:'-'), u=fams.get(key);
    if(!u){ u={id:'f'+key.replace('|','x').replace(/-/g,'0'), p:[], ch:[]}; if(hf) u.p.push(id(f)); if(hm) u.p.push(id(m)); fams.set(key,u); unions.push(u) }
    u.ch.push(id(n));
  });
  var bornOf=function(i){ var q=by.get(+i.slice(1)); return q&&q.b||9999 };
  unions.forEach(function(u){ u.ch.sort(function(a,b){ return bornOf(a)-bornOf(b) }) });
  var s={v:1, app:'descendant-builder', people:people, unions:unions};
  STATE=s; rebuild(); s.root=topOf('n1'); return s;
}
function toPedigree(start){
  var num=new Map([[start,1]]), q=[start], out=[];
  while(q.length){
    var x=q.shift(), k=num.get(x), p=P.get(x), r={n:k};
    PFIELDS.forEach(function(f){ if(p[f]!=null&&f!=='sex') r[f]=clone(p[f]) });
    if(k===1&&p.sex) r.sex=p.sex;
    if(p.seat){ r.ev=(r.ev||[]).concat([{t:'resi',pl:p.seat}]) }
    var ps=parentsOf(x), fa=ps.filter(function(y){return sexOf(y)==='M'})[0], mo=ps.filter(function(y){return y!==fa})[0];
    if(fa==null&&ps.length>1){ fa=ps[0]; mo=ps[1] }
    [[fa,2*k,'fa'],[mo,2*k+1,'mo']].forEach(function(e){
      if(e[0]==null) return;
      if(num.has(e[0])){ r[e[2]]=num.get(e[0]); return }
      num.set(e[0],e[1]); q.push(e[0]);
    });
    out.push(r);
  }
  out.sort(function(a,b){return a.n-b.n});
  var rp=P.get(start);
  return 'Pedigree Builder export · '+rp.name+' · '+today()+'\nImport this file on the Backup & reset screen.\n\n'+JSON.stringify({v:1, sample:false, people:out},null,2);
}

/* ---------- GEDCOM ---------- */
var GMON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function gDate(o,k){
  var y=o[k]; if(!y) return '';
  var q=o[k+'q'], one=function(m,d,yy){ return [d&&m?d:'',m?GMON[m-1]:'',yy<0?(-yy)+' B.C.':yy].filter(Boolean).join(' ') };
  if(q==='bet'&&o[k+'2']) return 'BET '+one(0,0,y)+' AND '+one(0,0,o[k+'2']);
  return ({abt:'ABT ',bef:'BEF ',aft:'AFT '}[q]||'')+one(o[k+'m'],o[k+'dy'],y);
}
function readGDate(t,o,k){
  t=String(t||'').toUpperCase().trim(); if(!t) return;
  var m=/^(ABT|ABOUT|EST|CAL|BEF|AFT|BET|FROM)\s+(.*)$/.exec(t), q='', rest=t;
  if(m){ q={ABT:'abt',ABOUT:'abt',EST:'abt',CAL:'abt',BEF:'bef',AFT:'aft',BET:'bet',FROM:'bet'}[m[1]]; rest=m[2] }
  var two=/^(.*?)\s+(?:AND|TO)\s+(.*)$/.exec(rest); if(two) rest=two[1];
  var parts=rest.split(/\s+/), y=null, mo=null, d=null;
  parts.forEach(function(w){ var i=GMON.indexOf(w.slice(0,3)); if(i>=0) mo=i+1; else if(/^\d{3,4}$/.test(w)) y=+w; else if(/^\d{1,2}$/.test(w)) d=+w });
  if(/B\.?C/.test(rest)&&y) y=-y;
  if(!y) return;
  o[k]=y; if(q&&!(q==='bet'&&!two)) o[k+'q']=q; if(mo) o[k+'m']=mo; if(mo&&d) o[k+'dy']=d;
  if(two){ var y2=/(\d{3,4})/.exec(two[2]); if(y2) o[k+'2']=+y2[1]; else delete o[k+'q'] }
}
function exportGed(){
  var L=['0 HEAD','1 SOUR DESCENDANT_BUILDER','2 NAME Descendant Builder','1 GEDC','2 VERS 5.5.1','2 FORM LINEAGE-LINKED','1 CHAR UTF-8'];
  var ix=new Map(); STATE.people.forEach(function(p,i){ ix.set(p.id,'@I'+(i+1)+'@') });
  var fx=new Map(); STATE.unions.forEach(function(u,i){ fx.set(u.id,'@F'+(i+1)+'@') });
  var txt=function(lv,tag,v){ String(v).split(/\r?\n/).forEach(function(line,i){ L.push((i?(lv+1)+' CONT ':lv+' '+tag+' ')+line) }) };
  STATE.people.forEach(function(p){
    var np=nameParts(p); L.push('0 '+ix.get(p.id)+' INDI');
    L.push('1 NAME '+[np.fn,np.mn].filter(Boolean).join(' ')+' /'+np.ln+'/'+(np.sx?' '+np.sx:''));
    if(np.fn||np.mn) L.push('2 GIVN '+[np.fn,np.mn].filter(Boolean).join(' ')); if(np.ln) L.push('2 SURN '+np.ln); if(np.sx) L.push('2 NSFX '+np.sx);
    if(p.sex) L.push('1 SEX '+p.sex);
    if(p.l) L.push('1 _LIVING Y');
    if(p.b||p.bp){ L.push('1 BIRT'); if(p.b) L.push('2 DATE '+gDate(p,'b')); if(p.bp) L.push('2 PLAC '+p.bp) }
    if(p.d||p.dp){ L.push('1 DEAT'); if(p.d) L.push('2 DATE '+gDate(p,'d')); if(p.dp) L.push('2 PLAC '+p.dp) } else if(!p.l) L.push('1 DEAT Y');
    if(p.seat){ L.push('1 RESI'); L.push('2 PLAC '+p.seat) }
    if(p.occ) L.push('1 OCCU '+p.occ);
    (p.ev||[]).forEach(function(e){ var tg=({marr:'EVEN',div:'EVEN'}[e.t]||String(e.t||'even').toUpperCase()); L.push('1 '+tg+(e.tx?' '+e.tx.replace(/\n/g,' '):'')); if(e.date) L.push('2 DATE '+e.date); if(e.pl) L.push('2 PLAC '+e.pl) });
    if(p.star) L.push('1 _STAR '+p.star); if(p.wiki) L.push('1 _WIKI '+p.wiki);
    if(p.idx) L.push('1 REFN '+p.idx);
    if(p.notes) txt(1,'NOTE',p.notes);
    (p.src||[]).forEach(function(s){ L.push('1 SOUR'); L.push('2 TITL '+s.ti); if(s.url) L.push('2 WWW '+s.url) });
    unionsOf(p.id).forEach(function(u){ L.push('1 FAMS '+fx.get(u.id)) });
    var pu=PU.get(p.id); if(pu) L.push('1 FAMC '+fx.get(pu));
  });
  STATE.unions.forEach(function(u){
    L.push('0 '+fx.get(u.id)+' FAM');
    var a=u.p.map(function(x){return P.get(x)}), h=a.filter(function(x){return x.sex==='M'})[0]||null, w=a.filter(function(x){return x!==h})[0]||null;
    if(!h&&a.length>1&&w&&w.sex!=='F'){ h=a[0]; w=a[1] }
    if(h) L.push('1 HUSB '+ix.get(h.id)); if(w) L.push('1 WIFE '+ix.get(w.id));
    if(u.m||u.mp){ L.push('1 MARR'); if(u.m) L.push('2 DATE '+gDate(u,'m')); if(u.mp) L.push('2 PLAC '+u.mp) }
    if(u.div) L.push('1 DIV Y');
    u.ch.forEach(function(c){ L.push('1 CHIL '+ix.get(c)) });
  });
  L.push('0 TRLR');
  var r=P.get(STATE.root); download('descendants-'+slug(r&&r.name)+'-'+today()+'.ged',L.join('\r\n'),'text/plain;charset=utf-8');
}
function importGed(text){
  var recs=[], cur=null;
  text.split(/\r?\n/).forEach(function(line){
    var m=/^\s*(\d+)\s+(@[^@]+@)?\s*([A-Za-z0-9_]+)(?:\s(.*))?$/.exec(line); if(!m) return;
    var lv=+m[1], node={lv:lv, x:m[2]||null, tag:m[3].toUpperCase(), v:m[4]||'', kids:[]};
    if(lv===0){ cur=node; recs.push(node); node.stack=[node]; return }
    if(!cur) return; var st=cur.stack; while(st.length>lv) st.pop(); var par=st[st.length-1];
    if(node.tag==='CONT'){ par.v+='\n'+node.v; return } if(node.tag==='CONC'){ par.v+=node.v; return }
    par.kids.push(node); st.push(node);
  });
  var sub=function(n,t){ for(var i=0;i<n.kids.length;i++) if(n.kids[i].tag===t) return n.kids[i]; return null };
  var subs=function(n,t){ return n.kids.filter(function(k){return k.tag===t}) };
  var people=[], unions=[], ids=new Map();
  recs.forEach(function(r){ if(r.tag==='INDI'&&r.x) ids.set(r.x,'g'+r.x.replace(/@/g,'').replace(/[^A-Za-z0-9]/g,'')) });
  recs.forEach(function(r){
    if(r.tag!=='INDI'||!r.x) return;
    var p={id:ids.get(r.x)}, nm=sub(r,'NAME');
    if(nm){ var raw=nm.v, sur=/\/([^\/]*)\//.exec(raw), giv=sub(nm,'GIVN'), sn=sub(nm,'SURN'), sx=sub(nm,'NSFX');
      var given=giv?giv.v:raw.replace(/\/[^\/]*\//,'').trim(), last=sn?sn.v:(sur?sur[1]:'');
      var gw=given.split(/\s+/).filter(Boolean); if(gw[0]) p.fn=gw[0]; if(gw.length>1) p.mn=gw.slice(1).join(' ');
      if(last) p.ln=last.trim(); if(sx) p.sx=sx.v; else { var tail=raw.split('/').pop().trim(); if(tail) p.sx=tail }
      p.name=joinName(nameParts(p)) }
    if(!p.name) p.name='Unnamed';
    var s=sub(r,'SEX'); if(s&&/^[MF]/i.test(s.v)) p.sex=s.v.charAt(0).toUpperCase();
    if(sub(r,'_LIVING')) p.l=1;
    [['BIRT','b'],['DEAT','d']].forEach(function(e){ var ev=sub(r,e[0]); if(!ev) return; var dt=sub(ev,'DATE'), pl=sub(ev,'PLAC'); if(dt) readGDate(dt.v,p,e[1]); if(pl&&pl.v) p[e[1]+'p']=pl.v });
    var re=sub(r,'RESI'); if(re){ var rp=sub(re,'PLAC'); if(rp&&rp.v) p.seat=rp.v }
    var oc=sub(r,'OCCU'); if(oc&&oc.v) p.occ=oc.v;
    var st=sub(r,'_STAR'); if(st) p.star=st.v; var wk=sub(r,'_WIKI'); if(wk) p.wiki=wk.v; var rf=sub(r,'REFN'); if(rf) p.idx=rf.v;
    var notes=subs(r,'NOTE').map(function(n){return n.v}).filter(function(v){return v&&v.charAt(0)!=='@'}); if(notes.length) p.notes=notes.join('\n');
    var src=subs(r,'SOUR').map(function(s){ var t=sub(s,'TITL'), w=sub(s,'WWW'); var o={f:'all', ti:(t?t.v:s.v)||''}; if(w) o.url=w.v; return o }).filter(function(o){return o.ti&&o.ti.charAt(0)!=='@'});
    if(src.length) p.src=src;
    people.push(p);
  });
  recs.forEach(function(r){
    if(r.tag!=='FAM') return;
    var u={id:'g'+String(r.x||uid('f')).replace(/[^A-Za-z0-9]/g,''), p:[], ch:[]};
    ['HUSB','WIFE'].forEach(function(t){ var x=sub(r,t); if(x&&ids.has(x.v.trim())) u.p.push(ids.get(x.v.trim())) });
    subs(r,'CHIL').forEach(function(c){ if(ids.has(c.v.trim())) u.ch.push(ids.get(c.v.trim())) });
    var ma=sub(r,'MARR'); if(ma){ var dt=sub(ma,'DATE'), pl=sub(ma,'PLAC'); if(dt) readGDate(dt.v,u,'m'); if(pl&&pl.v) u.mp=pl.v }
    if(sub(r,'DIV')) u.div=1;
    if(u.p.length||u.ch.length) unions.push(u);
  });
  if(!people.length) throw new Error('No people found in this GEDCOM file.');
  STATE={v:1, app:'descendant-builder', people:people, unions:unions}; rebuild();
  var best=people[0].id, bn=-1; people.forEach(function(p){ if(parentsOf(p.id).length) return; var n=descCount(p.id); if(n>bn){ bn=n; best=p.id } });
  STATE.root=best; return STATE;
}

/* ---------- read-only web page ---------- */
function stripEdit(s){ return s.replace(/\/\*\{edit\*\/[\s\S]*?\/\*\}edit\*\//g,'') }
function exportReadOnly(){
  var parts=[].slice.call(document.querySelectorAll('style[data-db],link[data-db],script[data-db]'));
  Promise.all(parts.map(function(el){
    if(el.tagName==='STYLE') return Promise.resolve('<style>'+stripEdit(el.textContent)+'</style>');
    var url=el.tagName==='LINK'?el.href:el.src;
    if(!url) return Promise.resolve('<script>'+stripEdit(el.textContent).replace(/<\/(script)/gi,'<\\/$1')+'</script>');
    return fetch(url).then(function(r){ return r.text() }).then(function(t){ t=stripEdit(t); return el.tagName==='LINK'?'<style>'+t+'</style>':'<script>'+t.replace(/<\/(script)/gi,'<\\/$1')+'</script>' });
  })).then(function(chunks){
    var css=chunks.filter(function(c){return c.indexOf('<style>')===0}).join('\n'), js=chunks.filter(function(c){return c.indexOf('<script>')===0}).join('\n');
    var data={state:STATE, view:view, depth:depth};
    var html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(dispName(P.get(view)))+' · Descendants</title>'+
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap">'+css+'</head><body>'+DB_BODY+
      '<script>window.DB_EXPORT='+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>'+js+'</body></html>';
    download('descendants-'+slug(P.get(view).name)+'.html',html,'text/html;charset=utf-8');
  }).catch(function(){ toast('Could not build the page here. Open the app from its web address (not a file) and try again.') });
}
document.querySelector('[data-ro]').onclick=function(){ $('#viewmenu').hidden=true; exportReadOnly() };

/*{edit*/
/* ---------- Backup & import screen ---------- */
function openData(){
  var r=P.get(STATE.root);
  openSheet(shell('Backup & import','Your tree',
    '<section><h3 class="sh3">Back up</h3><p class="note2">Your tree is saved in this browser. Export a copy now and then and keep it somewhere safe.</p>'+
    '<div class="btnrow"><button type="button" class="btn" data-x="txt">Export as .txt file</button><button type="button" class="btn" data-x="ged">Export as GEDCOM (.ged)</button></div></section>'+
    '<section class="combo"><h3 class="sh3">Send someone\'s ancestry to Pedigree Builder</h3><p class="note2">Makes a Pedigree Builder file of one person and their ancestors in this tree. Import it there on the Backup &amp; reset screen.</p>'+
    '<label for="pbf">Person</label><input type="search" id="pbf" autocomplete="off" placeholder="Find a person"><ul class="combolist" id="pbl" hidden></ul><div id="pbpick"></div></section>'+
    '<section><h3 class="sh3">Import</h3><p class="note2">A Descendant Builder .txt backup, a <b>Pedigree Builder</b> .txt backup, or a GEDCOM (.ged) file from Ancestry, FamilySearch and other programs. Importing replaces the tree in this browser (you can undo).</p>'+
    '<label class="f filein">Choose a file<input type="file" id="impf" accept=".txt,.json,.ged,.gedcom,text/plain"></label><p class="okmsg" id="impmsg" hidden></p></section>'+
    '<section><h3 class="sh3">Start over</h3><div class="btnrow"><button type="button" class="btn" data-x="sample">Load the Randolph sample</button><button type="button" class="btn danger" data-x="blank">Start a blank tree…</button></div><div id="blankc"></div></section>',
    '<button type="button" class="btn primary" data-close>Done</button>'));
  sheet.querySelector('[data-x="txt"]').onclick=exportTxt;
  sheet.querySelector('[data-x="ged"]').onclick=exportGed;
  sheet.querySelector('[data-x="sample"]').onclick=function(){ commit('Loaded the sample'); STATE=clone(SAMPLE); afterLoad('Loaded the Randolph sample') };
  sheet.querySelector('[data-x="blank"]').onclick=function(){
    $('#blankc').innerHTML='<div class="confirm"><p>Replace the whole tree with one empty person? Export a backup first if you want to keep it. You can undo.</p><div class="btnrow"><button type="button" class="btn danger" data-yes>Start a blank tree</button><button type="button" class="btn" data-no>Cancel</button></div></div>';
    $('#blankc').querySelector('[data-no]').onclick=function(){ $('#blankc').innerHTML='' };
    $('#blankc').querySelector('[data-yes]').onclick=function(){ commit('Started a blank tree'); STATE={v:1,app:'descendant-builder',root:'i1',people:[{id:'i1',name:'First ancestor',fn:'First',ln:'ancestor'}],unions:[]}; afterLoad('Started a blank tree. Use the pencil on the card to name the first person.') };
  };
  var inp=$('#pbf'), list=$('#pbl');
  inp.oninput=function(){ var res=search(inp.value,8); list.hidden=!inp.value.trim();
    list.innerHTML=res.length?res.map(function(id){ var p=P.get(id); return '<li data-id="'+esc(id)+'"><b>'+esc(dispName(p))+'</b><span>'+esc(years(p))+'</span></li>' }).join(''):'<li class="none">No one found</li>' };
  list.onclick=function(e){ var li=e.target.closest('[data-id]'); if(!li) return; var id=li.getAttribute('data-id'); list.hidden=true; inp.value='';
    var n=0; (function up(x,s){ if(s.has(x)) return; s.add(x); n++; parentsOf(x).forEach(function(q){ up(q,s) }) })(id,new Set());
    $('#pbpick').innerHTML='<div class="picked"><span><b>'+esc(dispName(P.get(id)))+'</b> and '+(n-1)+' ancestor'+(n===2?'':'s')+'</span><button type="button" class="btn" data-pb>Download</button></div>';
    $('#pbpick').querySelector('[data-pb]').onclick=function(){ download('family-tree-'+slug(P.get(id).name)+'-'+today()+'.txt',toPedigree(id)) } };
  $('#impf').onchange=function(){
    var f=this.files[0]; if(!f) return; var rd=new FileReader();
    rd.onload=function(){
      var t=String(rd.result), msg='';
      try{
        var prev=JSON.stringify(STATE);
        if(/^\s*0\s+HEAD/m.test(t)&&/\bINDI\b/.test(t)){ importGed(t); msg='Imported '+STATE.people.length+' people from GEDCOM' }
        else { var o=parseJsonText(t);
          if(valid(o)){ STATE=normalize(o); msg='Imported '+STATE.people.length+' people' }
          else if(Array.isArray(o.people)&&o.people.every(function(p){return p.n!=null})){ fromPedigree(o); msg='Imported '+STATE.people.length+' people from Pedigree Builder. The chart starts from '+P.get(STATE.root).name+'.' }
          else throw new Error('not a tree') }
        UNDO.push({s:prev,label:'Imported '+f.name,view:view}); REDO=[]; undoBtns();
        afterLoad(msg,true); pickRoot();
      }catch(err){ var m=$('#impmsg'); m.hidden=false; m.textContent='Could not read that file. Choose a Descendant Builder or Pedigree Builder .txt backup, or a GEDCOM file.' }
    };
    rd.readAsText(f);
  };
}
function afterLoad(msg,keep){ rebuild(); view=STATE.root; depth=Math.min(4,maxDepthOf(view)); if(!keep) closeSheet(); setView(view); save(); toast(msg) }
/* After an import: choose who the chart starts from. Suggests the people furthest up each line (most generations below them); any person can be found by name. */
function pickRoot(){
  var tops=STATE.people.filter(function(p){ return !parentsOf(p.id).length&&childrenOf(p.id).length }).map(function(p){ return {id:p.id, g:maxDepthOf(p.id)-1} })
    .sort(function(a,b){ return b.g-a.g||descCount(b.id)-descCount(a.id) }).slice(0,12);
  var row=function(id,g){ var p=P.get(id); return '<li data-id="'+esc(id)+'"'+(id===STATE.root?' class="cur"':'')+'><b>'+esc(dispName(p))+'</b><span>'+esc([years(p), g!=null?g+(g===1?' generation':' generations')+' below':''].filter(Boolean).join(' · '))+'</span></li>' };
  var m=$('#impmsg'); m.hidden=false; m.className='okmsg rootpick';
  m.innerHTML='<span><b>Imported.</b> Who should the chart start from? It starts from <b id="rpcur">'+esc(dispName(P.get(STATE.root)))+'</b> now.</span>'+
    '<span class="combo"><input type="search" id="rpf" autocomplete="off" placeholder="Find any ancestor"><ul class="combolist" id="rpl" hidden></ul></span>'+
    '<span class="mute">Furthest back:</span><ul class="combolist rplist" id="rptop">'+tops.map(function(t){ return row(t.id,t.g) }).join('')+'</ul>';
  var choose=function(e){ var li=e.target.closest('[data-id]'); if(!li) return; var id=li.getAttribute('data-id');
    STATE.root=id; view=id; depth=Math.min(Math.max(depth,4),maxDepthOf(id)); save(); setView(id);
    $('#rpcur').textContent=dispName(P.get(id)); m.querySelectorAll('li').forEach(function(x){ x.classList.toggle('cur',x.getAttribute('data-id')===id) });
    $('#rpl').hidden=true; $('#rpf').value=''; toast('The chart now starts from '+dispName(P.get(id))) };
  $('#rptop').onclick=choose; $('#rpl').onclick=choose;
  $('#rpf').oninput=function(){ var v=this.value, res=search(v,8), l=$('#rpl'); l.hidden=!v.trim();
    l.innerHTML=res.length?res.map(function(id){ return row(id,null) }).join(''):'<li class="none">No one found</li>' };
}
/*}edit*/
