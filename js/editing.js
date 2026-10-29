/* Descendant Builder · js/editing.js
   Edit mode: the side sheet, the person form (with marriage details), adding children and partners,
   linking a partner who is already in the tree, reordering and deleting.
   All files share one global scope and must load in the order listed in index.html. */
'use strict';
/*{edit*/
var sheet=$('#sheet'), scrim=$('#scrim'), lastFocus=null;
function openSheet(html,wide){
  lastFocus=document.activeElement;
  sheet.innerHTML=html; sheet.classList.toggle('wide',!!wide); sheet.hidden=false; scrim.hidden=false;
  var f=sheet.querySelector('input:not([type=hidden]),select,textarea,button'); if(f) f.focus({preventScroll:true});
}
function closeSheet(){ sheet.hidden=true; scrim.hidden=true; sheet.innerHTML=''; if(lastFocus&&lastFocus.focus) lastFocus.focus({preventScroll:true}) }
scrim.addEventListener('click',closeSheet);
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!sheet.hidden){ e.preventDefault(); closeSheet() } });
sheet.addEventListener('click',function(e){ if(e.target.closest('[data-close]')) closeSheet() });

function setEditing(on){
  if(READONLY) return;
  editing=!!on; $('#edit').setAttribute('aria-pressed',String(editing)); $('#editbar').hidden=!editing;
  closePop(true); render(true);
}
$('#edit').onclick=function(){ setEditing(!editing) };
$('#editbar').addEventListener('click',function(e){
  var b=e.target.closest('[data-e]'); if(!b) return;
  var k=b.getAttribute('data-e');
  if(k==='done') setEditing(false);
  else if(k==='undo') undo(); else if(k==='redo') redo();
  else if(k==='start') openEdit(view,BYKEY.get('p:'+view));
  else if(k==='data') openData();
});

/* ---------- form pieces ---------- */
var opt=function(v,t,sel){ return '<option value="'+esc(v)+'"'+(String(sel)===String(v)?' selected':'')+'>'+esc(t)+'</option>' };
function dateRow(p,k,label){
  var q=p[k+'q']||'', mo='<option value="">Month</option>'+MONTHS.map(function(m,i){return opt(i+1,m,p[k+'m']||'')}).join('');
  return '<div class="f"><span>'+label+'</span><div class="row4">'+
    '<select name="'+k+'q" aria-label="'+label+': exact or approximate">'+QUAL.map(function(x){return opt(x[0],x[1],q)}).join('')+'</select>'+
    '<input name="'+k+'dy" inputmode="numeric" placeholder="Day" aria-label="'+label+': day" value="'+esc(p[k+'dy']||'')+'">'+
    '<select name="'+k+'m" aria-label="'+label+': month">'+mo+'</select>'+
    '<input name="'+k+'" inputmode="numeric" placeholder="Year" aria-label="'+label+': year" value="'+esc(p[k]||'')+'">'+
    '</div><input name="'+k+'2" inputmode="numeric" placeholder="Later year (for between)" aria-label="'+label+': later year" value="'+esc(p[k+'2']||'')+'"'+(q==='bet'?'':' hidden')+'></div>';
}
function personFields(p){
  var np=nameParts(p);
  return '<fieldset><legend>Name</legend>'+
    '<div class="row2 even"><label class="f">First name<input name="fn" value="'+esc(np.fn)+'"></label><label class="f">Middle names<input name="mn" value="'+esc(np.mn)+'"></label></div>'+
    '<div class="rowls"><label class="f">Last name at birth<input name="ln" value="'+esc(np.ln)+'"></label><label class="f">Suffix<input name="sx" value="'+esc(np.sx)+'" placeholder="Jr."></label></div>'+
    '<label class="f">Married last names<input name="mln" value="'+esc(p.mln||'')+'"><small>Separate several with commas.</small></label>'+
    '<div class="row2 even"><label class="f">Sex<select name="sex">'+opt('','Not recorded',p.sex||'')+opt('M','Male',p.sex)+opt('F','Female',p.sex)+'</select></label>'+
    '<label class="chk sw" style="align-self:end;padding-bottom:8px"><input type="checkbox" name="l"'+(p.l?' checked':'')+'> Living</label></div></fieldset>'+
    '<fieldset><legend>Life</legend>'+dateRow(p,'b','Born')+'<label class="f">Birthplace<input name="bp" value="'+esc(p.bp||'')+'"></label>'+
    dateRow(p,'d','Died')+'<label class="f">Place of death<input name="dp" value="'+esc(p.dp||'')+'"></label>'+
    '<label class="f">Seat or home<input name="seat" value="'+esc(p.seat||'')+'" placeholder="Tuckahoe, Goochland County, Virginia"><small>Shown on the card, for example the plantation someone was "of".</small></label>'+
    '<label class="f">Occupation<input name="occ" value="'+esc(p.occ||'')+'"></label>'+
    '<label class="f">Notable for<input name="star" value="'+esc(p.star||'')+'"></label>'+
    '<label class="f">Wikipedia article or web page<input name="wiki" value="'+esc(p.wiki||'')+'" placeholder="Thomas_Jefferson or https://…"></label>'+
    '<label class="f">Notes<textarea name="notes" rows="3">'+esc(p.notes||'')+'</textarea></label></fieldset>'+
    '<fieldset><legend>Sources</legend><div class="rows" id="srcrows">'+(p.src||[]).map(srcRow).join('')+'</div>'+
    '<button type="button" class="btn" data-addsrc>Add a source</button></fieldset>';
}
function srcRow(s){
  s=s||{};
  return '<div class="srcrow"><select name="sf" aria-label="Fact this source supports">'+FACTS.map(function(x){return opt(x[0],x[1],s.f||'all')}).join('')+'</select>'+
    '<input name="sti" placeholder="Title, page" aria-label="Source title" value="'+esc(s.ti||'')+'"><input name="surl" placeholder="Link (optional)" aria-label="Source link" value="'+esc(s.url||'')+'">'+
    '<button type="button" class="btn sq" data-delsrc aria-label="Remove this source">&times;</button></div>';
}
function marrFields(u){
  u=u||{};
  return '<fieldset><legend>Marriage</legend>'+dateRow({m:u.m,mm:u.mm,mdy:u.mdy,mq:u.mq,m2:u.m2},'m','Married')+
    '<label class="f">Place of marriage<input name="mp" value="'+esc(u.mp||'')+'"></label>'+
    '<label class="chk"><input type="checkbox" name="div"'+(u.div?' checked':'')+'> Divorced or separated</label></fieldset>';
}
sheet.addEventListener('change',function(e){
  var t=e.target; if(/^[bdm]q$/.test(t.name)){ var y2=sheet.querySelector('[name="'+t.name.charAt(0)+'2"]'); if(y2) y2.hidden=t.value!=='bet' }
});
sheet.addEventListener('click',function(e){
  if(e.target.closest('[data-addsrc]')){ $('#srcrows').insertAdjacentHTML('beforeend',srcRow()); $('#srcrows').lastElementChild.querySelector('input').focus() }
  var d=e.target.closest('[data-delsrc]'); if(d) d.parentNode.remove();
});
var num=function(v){ v=String(v||'').trim(); if(!/^-?\d+$/.test(v)) return null; return +v };
function readDate(fd,k,o){
  ['','q','m','dy','2'].forEach(function(s){ delete o[k+s] });
  var y=num(fd.get(k)); if(!y) return;
  o[k]=y; var q=fd.get(k+'q'); if(q) o[k+'q']=q;
  var m=num(fd.get(k+'m')); if(m&&m>=1&&m<=12) o[k+'m']=m;
  var d=num(fd.get(k+'dy')); if(m&&d&&d>=1&&d<=31) o[k+'dy']=d;
  var y2=num(fd.get(k+'2')); if(q==='bet'&&y2) o[k+'2']=y2;
}
function readPerson(form,p){
  var fd=new FormData(form), g=function(k){ return String(fd.get(k)||'').trim() };
  var np={fn:g('fn'),mn:g('mn'),ln:g('ln'),sx:g('sx')};
  if(!np.fn&&!np.ln) return 'Enter a first or last name.';
  p.name=joinName(np); ['fn','mn','ln','sx'].forEach(function(k){ if(np[k]) p[k]=np[k]; else delete p[k] });
  ['mln','sex','bp','dp','seat','occ','star','wiki','notes'].forEach(function(k){ var v=k==='notes'?String(fd.get(k)||'').trim():g(k); if(v) p[k]=v; else delete p[k] });
  if(fd.get('l')) p.l=1; else delete p.l;
  readDate(fd,'b',p); readDate(fd,'d',p);
  var src=[]; form.querySelectorAll('.srcrow').forEach(function(r){ var ti=r.querySelector('[name=sti]').value.trim(); if(!ti) return;
    var s={f:r.querySelector('[name=sf]').value, ti:ti}, u=r.querySelector('[name=surl]').value.trim(); if(u) s.url=u; src.push(s) });
  if(src.length) p.src=src; else delete p.src;
  return '';
}
function readUnion(form,u){
  var fd=new FormData(form); readDate(fd,'m',u);
  var mp=String(fd.get('mp')||'').trim(); if(mp) u.mp=mp; else delete u.mp;
  if(fd.get('div')) u.div=1; else delete u.div;
}
function shell(title,sub,body,foot){
  return '<form class="fwrap" novalidate><div class="sh"><div><p class="kicker">'+esc(sub)+'</p><h2 id="sheet-t">'+esc(title)+'</h2></div>'+
    '<button type="button" class="btn sq" data-close aria-label="Close">&times;</button></div><div class="sbody"><p class="ferr" id="ferr" hidden></p>'+body+'</div><div class="sf">'+foot+'</div></form>';
}
function showErr(m){ var e=$('#ferr'); e.textContent=m; e.hidden=!m; if(m) e.scrollIntoView({block:'nearest'}) }

/* ---------- editing someone ---------- */
function openEdit(id,n){
  var p=P.get(id); if(!p) return; closePop(true);
  var u=n&&n.kind==='sp'?U.get(n.u):null, pu=U.get(PU.get(id)), sibs=pu?pu.ch:[], si=sibs.indexOf(id);
  var extra='';
  if(u) extra+=marrFields(u)+'<p class="note2">Marriage to <b>'+esc(dispName(P.get(n.of)))+'</b>.</p>';
  var order='';
  if(sibs.length>1) order='<section><h3 class="sh3">Order among brothers and sisters</h3><div class="btnrow">'+
    '<button type="button" class="btn" data-move="-1"'+(si<=0?' disabled':'')+'>Move earlier</button><button type="button" class="btn" data-move="1"'+(si>=sibs.length-1?' disabled':'')+'>Move later</button>'+
    '<button type="button" class="btn" data-sortkids>Sort all by birth year</button></div></section>';
  var rootBtn=STATE.root!==id?'<section><h3 class="sh3">Start of the tree</h3><p class="note2">The tree opens on <b>'+esc(dispName(P.get(STATE.root)))+'</b>.</p><button type="button" class="btn" data-mkroot>Open the tree on '+esc(firstName(p))+' instead</button></section>':'';
  openSheet(shell(dispName(p),u?'Edit partner':'Edit person',extra+personFields(p)+order+rootBtn,
    '<button type="submit" class="btn primary">Save changes</button><button type="button" class="btn" data-close>Cancel</button>'+
    (u?'<button type="button" class="btn" data-unlink>Remove this marriage</button>':'')+'<button type="button" class="btn danger" data-del>Delete…</button>'));
  var form=sheet.querySelector('form');
  form.onsubmit=function(e){ e.preventDefault(); var copy=clone(p), err=readPerson(form,copy); if(err) return showErr(err);
    commit('Edited '+copy.name); Object.keys(p).forEach(function(k){ delete p[k] }); Object.assign(p,copy); if(u) readUnion(form,u);
    afterEdit(); closeSheet(); toast('Saved '+p.name) };
  form.querySelectorAll('[data-move]').forEach(function(b){ b.onclick=function(){ var d=+b.getAttribute('data-move'), j=si+d; if(j<0||j>=sibs.length) return;
    commit('Moved '+p.name); sibs.splice(si,1); sibs.splice(j,0,id); afterEdit(); closeSheet() } });
  var sk=form.querySelector('[data-sortkids]'); if(sk) sk.onclick=function(){ commit('Sorted children'); var y=function(c){ var q=P.get(c); return q.b||9999 };
    sibs.sort(function(a,b){ return y(a)-y(b) }); afterEdit(); closeSheet(); toast('Sorted by birth year; people without a year go last') };
  var mk=form.querySelector('[data-mkroot]'); if(mk) mk.onclick=function(){ commit('Changed the start of the tree'); STATE.root=id; afterEdit(); closeSheet(); setView(id) };
  var ul=form.querySelector('[data-unlink]'); if(ul) ul.onclick=function(){
    commit('Removed a marriage'); u.p=u.p.filter(function(x){return x!==id});
    if(!u.p.length&&!u.ch.length) STATE.unions=STATE.unions.filter(function(x){return x!==u});
    prune(); afterEdit(); closeSheet() };
  form.querySelector('[data-del]').onclick=function(){ confirmDelete(id,form) };
}
/* Everyone reachable from the start of the tree through children and partners. */
function reachable(){
  var seen=new Set(), st=[STATE.root];
  while(st.length){ var x=st.pop(); if(x==null||seen.has(x)) continue; seen.add(x);
    unionsOf(x).forEach(function(u){ u.p.forEach(function(q){ st.push(q) }); u.ch.forEach(function(c){ st.push(c) }) }) }
  return seen;
}
function prune(){
  rebuild(); var keep=reachable();
  STATE.people=STATE.people.filter(function(p){ return keep.has(p.id) });
  STATE.unions=STATE.unions.filter(function(u){ u.p=u.p.filter(function(x){return keep.has(x)}); u.ch=u.ch.filter(function(x){return keep.has(x)}); return u.p.length&&(u.p.length>1||u.ch.length) });
}
function confirmDelete(id,form){
  if(id===STATE.root) return showErr('This is the person the tree starts from. Open the tree on someone else first (below), then delete.');
  var all=STATE.people.length, test=clone(STATE), save=STATE;
  STATE=test; removePerson(id); prune(); var gone=all-STATE.people.length; STATE=save; rebuild();
  var box=form.querySelector('.confirm'); if(box) box.remove();
  form.querySelector('.sbody').insertAdjacentHTML('afterbegin','<div class="confirm"><p>Delete <b>'+esc(P.get(id).name)+'</b>'+(gone>1?' and '+(gone-1)+' other '+(gone===2?'person':'people')+' who would no longer be connected to the tree (their descendants and partners)':'')+'? You can undo this.</p><div class="btnrow"><button type="button" class="btn danger" data-yes>Delete</button><button type="button" class="btn" data-no>Keep</button></div></div>');
  form.querySelector('[data-no]').onclick=function(){ form.querySelector('.confirm').remove() };
  form.querySelector('[data-yes]').onclick=function(){ var nm=P.get(id).name; commit('Deleted '+nm); removePerson(id); prune(); afterEdit(); closeSheet(); toast('Deleted '+nm) };
  form.querySelector('.sbody').scrollTop=0;
}
function removePerson(id){
  STATE.people=STATE.people.filter(function(p){return p.id!==id});
  STATE.unions.forEach(function(u){ u.p=u.p.filter(function(x){return x!==id}); u.ch=u.ch.filter(function(x){return x!==id}) });
}

/* ---------- adding ---------- */
function openAdd(n){
  closePop(true);
  var of=P.get(n.of), isP=n.act==='partner', u=n.u?U.get(n.u):null;
  var title=isP?'Add a partner':'Add a child', sub=isP?'Partner of '+dispName(of):'Child of '+dispName(of)+(u&&partnerIn(u,n.of)!=null?' and '+dispName(P.get(partnerIn(u,n.of))):'');
  var guess={}; if(!isP){ var np=nameParts(of); if(of.sex!=='F'&&np.ln) guess.ln=np.ln; else if(u){ var o=P.get(partnerIn(u,n.of)); if(o&&o.sex==='M'){ var on=nameParts(o); if(on.ln) guess.ln=on.ln } } }
  else guess.sex=of.sex==='M'?'F':of.sex==='F'?'M':'';
  var link=isP?'<section class="combo"><label for="lk">Already in the tree? (for example a cousin)</label><input type="search" id="lk" autocomplete="off" placeholder="Find a person"><ul class="combolist" id="lklist" hidden></ul><div id="lkpicked"></div></section>':'';
  openSheet(shell(title,sub,link+'<div class="newfields">'+personFields(guess)+(isP?marrFields({}):'')+'</div>',
    '<button type="submit" class="btn primary">'+(isP?'Add partner':'Add child')+'</button><button type="button" class="btn" data-close>Cancel</button>'));
  var form=sheet.querySelector('form'), picked=null;
  if(isP){
    var inp=$('#lk'), list=$('#lklist');
    inp.oninput=function(){ var r=search(inp.value,8).filter(function(x){return x!==n.of}); list.hidden=!inp.value.trim();
      list.innerHTML=r.length?r.map(function(id){ var p=P.get(id); return '<li data-id="'+esc(id)+'"><b>'+esc(dispName(p))+'</b><span>'+esc(years(p)||'')+(p.seat?' · '+esc(p.seat):'')+'</span></li>' }).join(''):'<li class="none">No one found</li>' };
    list.onclick=function(e){ var li=e.target.closest('[data-id]'); if(!li) return; picked=li.getAttribute('data-id'); list.hidden=true; inp.value='';
      $('#lkpicked').innerHTML='<div class="picked"><span>Linking <b>'+esc(dispName(P.get(picked)))+'</b></span><button type="button" class="btn" data-unpick>Change</button></div>';
      form.querySelector('.newfields').querySelectorAll('fieldset')[0].hidden=true; form.querySelector('.newfields').querySelectorAll('fieldset')[1].hidden=true; form.querySelector('.newfields').querySelectorAll('fieldset')[2].hidden=true };
    $('#lkpicked').onclick=function(e){ if(!e.target.closest('[data-unpick]')) return; picked=null; this.innerHTML=''; form.querySelectorAll('.newfields fieldset').forEach(function(f){ f.hidden=false }) };
  }
  form.onsubmit=function(e){
    e.preventDefault();
    var p={id:uid('i')};
    if(!picked){ var err=readPerson(form,p); if(err) return showErr(err) }
    commit(isP?'Added a partner':'Added a child');
    if(!picked) STATE.people.push(p);
    var pid=picked||p.id;
    if(isP){ var nu={id:uid('f'), p:[n.of,pid], ch:[]}; readUnion(form,nu); STATE.unions.push(nu) }
    else { if(!u){ u={id:uid('f'), p:[n.of], ch:[]}; STATE.unions.push(u) } u.ch.push(pid) }
    afterEdit(); closeSheet(); toast((picked?'Linked ':'Added ')+dispName(P.get(pid)));
  };
}
function afterEdit(){ rebuild(); if(!P.has(view)) view=STATE.root; fillDepth(); render(true); save() }
/*}edit*/
