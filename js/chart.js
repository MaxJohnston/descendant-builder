/* Descendant Builder · js/chart.js
   Chart layout and drawing, zoom and pan, the details panel and navigation.
   Generations run left to right: the person the chart starts from on the left, children in the next column, and so on.
   Each person's partners are stacked under them, and the children of each partnership branch off to the right. */
'use strict';

/* FOCUS: while showing how one person descends from the start of the tree, {id, set (the people on those lines), paths, prev} */
var FOCUS=null;
/* In edit mode, "Add" cards are drawn only on smaller charts; on big ones they would more than double the cards, so adding is done from a card's details instead. */
var ADDCARDS=true, ADDMAX=1500;
var VIEWDESC=new Set(), NODES=[], BYKEY=new Map(), WIDTH=0, HEIGHT=0, MAXCOL=0, SHOWN=new Map();

/* Lay out the chart for the current view and depth. Returns nodes (cards) and lines (SVG paths). */
function layout(){
  var nodes=[], lines=[], drawn=new Set(), done=new Set(), maxCol=depth-1, deepest=0, cross=!!(STATE.crossLines||FOCUS), pn=new Map(), spByU=new Map(), later=[], spread=[];
  var add=function(n){ nodes.push(n); return n };
  function shift(from,dy){ for(var i=from;i<nodes.length;i++) nodes[i].y+=dy }
  /* Place id's family block with its top at "top" in column c. Returns the block's height. */
  function block(id,c,top){
    drawn.add(id); deepest=Math.max(deepest,c);
    var us=unionsOf(id), canAdd=editing&&!READONLY&&!FOCUS&&ADDCARDS;
    /* "how they descend": only the families on a line down to that person (and that person's own partners) */
    if(FOCUS) us=us.filter(function(u){ return id===FOCUS.id?partnerIn(u,id)!=null:u.ch.some(function(k){return FOCUS.set.has(k)}) });
    /* View > Hide partners (not while editing, where the partner cards are needed) */
    var withP=STATE.hidePartners&&!editing?[]:us.filter(function(u){return partnerIn(u,id)!=null});
    var ownH=CH+withP.length*PSLOT+(canAdd?PSLOT:0);
    var start=nodes.length, me=add({key:'p:'+id, kind:'p', id:id, c:c, y:0}); pn.set(id,me);
    var spN=withP.map(function(u){ var q=add({key:'s:'+u.id+':'+id, kind:'sp', id:partnerIn(u,id), of:id, u:u.id, c:c, y:0}); if(!spByU.has(u.id)) spByU.set(u.id,q); return q });
    var addP=canAdd?add({key:'ap:'+id, kind:'add', act:'partner', of:id, c:c, y:0}):null;
    /* partners: one goes under the person; with several, they alternate above and below (nearest first) */
    var nP=spN.length, rank=new Map();
    spN.forEach(function(q,i){ q.above=nP>1&&i%2===0; q.lvl=Math.floor(i/2); rank.set(q.u, q.above?-q.lvl-1:q.lvl+1) });
    /* brackets step outwards for nearer partners, so the lines leaving them never cross the brackets of partners further out */
    var maxL=nP?Math.floor((nP-1)/2):0;
    spN.forEach(function(q){ q.off=8+(maxL-q.lvl)*12+(q.above||nP<2?0:6) });
    var nA=spN.filter(function(q){return q.above}).length, nB=nP-nA;
    var kidStart=nodes.length, cur=top, groups=[];
    /* in edit mode, people with no children yet get "Add child" cards even in the last generation shown */
    if(c<maxCol||(canAdd&&!childrenOf(id).length)){
      /* lay the children out in the same top-to-bottom order as their other parent */
      var list=us.slice().sort(function(a,b){ return (rank.has(a.id)?rank.get(a.id):99)-(rank.has(b.id)?rank.get(b.id):99) }); if(canAdd&&!list.length) list=[{id:null,p:[id],ch:[]}];
      var colB=new Map(), gutB=new Map();
      list.forEach(function(u,ui){
        if(u.id&&done.has(u.id)){ groups.push({u:u, ref:true}); return }
        if(u.id) done.add(u.id);
        var g={u:u, kids:[]};
        if(groups.length&&groups[groups.length-1].kids&&groups[groups.length-1].kids.length) cur+=FGAP;
        /* another partner's children carry on below the previous family's children (the room each column needs is kept across families) */
        var floor=top;
        /* Pack the children's families as tightly as their own columns allow. Each column (and the gap to its right,
           where the lines run) only has to clear what is already in that column, so a family can slide up beside
           its cousins, and someone with no descendants shown sits beside their nieces and nephews. */
        u.ch.forEach(function(k){
          if(FOCUS&&!FOCUS.set.has(k)) return;
          /* "how they descend": someone who married a cousin on another line is drawn once, as the partner card beside that cousin, and the line from their parents runs there */
          if(FOCUS&&!drawn.has(k)&&k!==FOCUS.id){ var fu=unionsOf(k).filter(function(v){ return v.ch.some(function(x){return FOCUS.set.has(x)}) });
            if(fu.length&&fu.every(function(v){ return done.has(v.id)&&spByU.has(v.id) })){ (g.far=g.far||[]).push(spByU.get(fu[0].id)); return } }
          var h0=nodes.length;
          if(drawn.has(k)){ if(cross&&pn.has(k)){ (g.far=g.far||[]).push(pn.get(k)); return } g.kids.push(add({key:'r:'+k+':'+id, kind:'ref', id:k, c:c+1, y:floor})) }
          else { block(k,c+1,floor); g.kids.push(nodes[h0]) }
          /* per column: where its cards are, and where the lines in the gap to its right run */
          var lo=new Map(), hi=new Map(), glo=new Map(), ghi=new Map(), d=0, q;
          var mn=function(m,k,v){ m.set(k,Math.min(m.has(k)?m.get(k):1e9,v)) }, mx=function(m,k,v){ m.set(k,Math.max(m.has(k)?m.get(k):-1e9,v)) };
          for(var i=h0;i<nodes.length;i++){ q=nodes[i];
            mn(lo,q.c,q.y); mx(hi,q.c,q.y+CH);
            if(q.c>c+1){ mn(glo,q.c-1,q.y+CH/2); mx(ghi,q.c-1,q.y+CH/2) }
            if(q.stack){ mn(glo,q.c,q.y+q.stack[0]); mx(ghi,q.c,q.y+q.stack[1]) } }
          /* cards only have to clear cards, and lines only lines */
          lo.forEach(function(v,cl){ if(colB.has(cl)) d=Math.max(d,colB.get(cl)-v) });
          glo.forEach(function(v,cl){ if(gutB.has(cl)) d=Math.max(d,gutB.get(cl)-v) });
          if(d) for(var i2=h0;i2<nodes.length;i2++) nodes[i2].y+=d;
          hi.forEach(function(v,cl){ mx(colB,cl,v+d+FGAP); cur=Math.max(cur,v+d+FGAP) });
          ghi.forEach(function(v,cl){ mx(gutB,cl,v+d+FGAP) });
        });
        if(canAdd){ deepest=Math.max(deepest,c+1); g.kids.push(add({key:'ac:'+(u.id||id), kind:'add', act:'child', of:id, u:u.id, c:c+1, y:cur})); cur+=CH+FGAP }
        groups.push(g);
      });
    } else {
      var n=FOCUS?0:descCount(id); if(n) me.more=n;
    }
    var kidsH=Math.max(0,cur-top-FGAP), H=Math.max(ownH,kidsH);
    if(kidsH<ownH&&kidsH>0) shift(kidStart,(ownH-kidsH)/2);
    var oy=top+(H-ownH)/2;
    me.y=oy+nA*PSLOT; me.bt=-nA*PSLOT; me.bb=CH+(nB+(addP?1:0))*PSLOT; spN.forEach(function(q){ q.y=me.y+(q.above?-1:1)*(q.lvl+1)*PSLOT }); if(addP) addP.y=me.y+(nB+1)*PSLOT;
    /* lines from each partnership to its children */
    if(groups.some(function(g){return g.kids&&g.kids.length})) me.stack=[-nA*PSLOT, CH+nB*PSLOT];
    var x0=xOf(c)+CW, xm=xOf(c+1)-GAP/2;
    /* several partners: each couple gets its own bracket on the right, staggered outwards so they stay apart */
    if(nP>1) spN.forEach(function(q){ lines.push({br:true, col:id, me:me, s:q, x0:x0}) });
    var fam=[];
    groups.forEach(function(g,gi){
      var s=null; spN.forEach(function(q){ if(q.u===g.u.id) s=q });
      if(g.ref){
        /* the couple's children are already drawn under the other partner (cousins who married) */
        if(cross&&g.u.ch.length){ later.push({g:g, me:me, s:s, single:spN.length===1, x0:x0, xm:xm}); return }
        if(s&&g.u.ch.length) s.ref=true; return }
      if(!g.kids.length&&!g.far) return;
      var single=spN.length===1, gl=[];
      g.kids.forEach(function(k){
        gl.push({cls:k.kind==='add'?'add':'', col:k.kind==='add'?null:k.id, node:k, me:me, s:s, single:single, x0:x0, xm:xm});
      });
      (g.far||[]).forEach(function(k){ gl.push({cls:'far', col:k.id, node:k, me:me, s:s, single:single, x0:x0, xm:xm, far:true}) });
      gl.forEach(function(l){ lines.push(l) }); fam.push(gl);
    });
    /* several families: their vertical lines are spread apart; which goes where is chosen once positions are final */
    if(fam.length>1) spread.push(fam);
    return H;
  }
  var H=block(view,0,TOP);
  later.forEach(function(o){ o.g.u.ch.forEach(function(k){ if(pn.has(k)) lines.push({cls:'far', col:k, node:pn.get(k), me:o.me, s:o.s, single:o.single, x0:o.x0, xm:o.xm, far:true}) }) });
  /* spread each person's families across the gap, in the order that crosses the fewest lines */
  var startY=function(l){ return !l.s?l.me.y+CH/2:(l.s.lvl?l.s.y+CH/2:(l.me.y+l.s.y+CH)/2) };
  spread.forEach(function(fam){
    var info=fam.map(function(gl){ var oy=startY(gl[0]), lo=oy, hi=oy;
      gl.forEach(function(l){ var y=l.node.y+CH/2; lo=Math.min(lo,y); hi=Math.max(hi,y) }); return {oy:oy, lo:lo, hi:hi} });
    var n=fam.length, offs=info.map(function(_,i){ return (i-(n-1)/2)*7 }), best=null, bestX=1e9;
    var perms=function(a){ if(a.length<2) return [a]; var r=[]; a.forEach(function(x,i){ perms(a.slice(0,i).concat(a.slice(i+1))).forEach(function(p){ r.push([x].concat(p)) }) }); return r };
    (n<=5?perms(offs):[offs]).forEach(function(pm){
      var x=0;
      /* a family's line runs across from its parents to its own vertical; it crosses any vertical to its left that spans that height */
      for(var a=0;a<n;a++) for(var b=0;b<n;b++) if(a!==b&&pm[b]<pm[a]&&info[b].lo<info[a].oy&&info[a].oy<info[b].hi) x++;
      if(x<bestX){ bestX=x; best=pm }
    });
    fam.forEach(function(gl,i){ gl.forEach(function(l){ l.xm+=best[i] }) });
  });
  /* lines to children were recorded with the child node; resolve their final positions now */
  lines.forEach(function(l){
    if(l.br){ var o=l.s.off; l.d='M'+l.x0+' '+(l.me.y+CH/2)+'h'+o+'V'+(l.s.y+CH/2)+'h-'+o; return }
    if(l.stack){ var y0=l.me.y+CH/2, yl=l.stack[l.stack.length-1].y+CH/2;
      l.d='M'+(l.x-1)+' '+y0+'h-9V'+yl+l.stack.map(function(q){return 'M'+(l.x-10)+' '+(q.y+CH/2)+'h9'}).join(''); return }
    /* children leave from the middle of their parents' bracket; for partners further out, from the bracket's far corner so they don't cross the inner brackets */
    var oy=startY(l), ky=l.node.y+CH/2, kx=xOf(l.node.c);
    /* a line to someone drawn elsewhere: across to the column before theirs, then down or up to them */
    /* to someone in the same column (or, when showing how one person descends, an earlier one): round the parents' block and in from the left like any other child */
    if(l.far&&(l.node.c===l.me.c||(FOCUS&&l.node.c<l.me.c))){ var up=ky<l.me.y+CH/2, hy=l.me.y+(up?l.me.bt-FGAP/2:l.me.bb+FGAP/2), xb=xOf(l.node.c)-12;
      l.d=(l.s&&l.single?'M'+l.x0+' '+(l.me.y+CH/2)+'h8V'+(l.s.y+CH/2)+'h-8M'+(l.x0+8)+' '+oy:'M'+(l.s?l.x0+l.s.off:l.x0)+' '+oy)+'H'+l.xm+'V'+hy+'H'+xb+'V'+ky+'H'+kx; return }
    if(l.far){ var cc=l.node.c, xe=cc*1>l.me.c?xOf(cc)-GAP/2+6:xOf(cc)+CW+GAP/2-6, ex=cc>l.me.c?xOf(cc):xOf(cc)+CW;
      l.d=(l.s&&l.single?'M'+l.x0+' '+(l.me.y+CH/2)+'h8V'+(l.s.y+CH/2)+'h-8M'+(l.x0+8)+' '+oy:'M'+(l.s?l.x0+l.s.off:l.x0)+' '+oy)+'H'+l.xm+'H'+xe+'V'+ky+'H'+ex; return }
    /* one partner: a short bracket joins the couple on the right and the line leaves from its middle */
    l.d=(l.s&&l.single?'M'+l.x0+' '+(l.me.y+CH/2)+'h8V'+(l.s.y+CH/2)+'h-8M'+(l.x0+8)+' '+oy:'M'+(l.s?l.x0+l.s.off:l.x0)+' '+oy)+'H'+l.xm+'V'+ky+'H'+kx;
  });
  return {nodes:nodes, lines:lines, h:H+TOP*2, cols:deepest+1};
}

function cardHTML(n){
  var esc2=esc, p=P.get(n.id), cls='card', yr='', btns='', st='left:'+xOf(n.c)+'px;top:'+n.y+'px;';
  if(n.kind==='add'){
    var t=n.act==='partner'?'Add partner':'Add child', s=n.act==='partner'?'Wife, husband or partner of '+firstName(P.get(n.of)):'Child of '+firstName(P.get(n.of))+(n.u&&partnerIn(U.get(n.u),n.of)!=null?' and '+firstName(P.get(partnerIn(U.get(n.u),n.of))):'');
    return '<button type="button" class="card add" style="'+st+'" data-k="'+esc2(n.key)+'"><span class="plus" aria-hidden="true">+</span><span class="who"><span class="nm">'+t+'</span><span class="yr">'+esc2(s)+'</span></span></button>';
  }
  var y=years(p);
  if(n.kind==='p'){
    if(n.id===view) cls+=' root';
    if(FOCUS&&n.id===FOCUS.id) cls+=' target';
    st+='--lc:'+lc(n.id)+';';
    var parts=[]; if(y) parts.push(esc2(y)); if(p.seat) parts.push(esc2(p.seat.split(',')[0]));
    yr='<i class="dot"></i>'+(parts.join(' · ')||'<span class="mute">Dates not recorded</span>');
    if(p.star) cls+=' famous';
  } else if(n.kind==='sp'){
    cls+=' sp'; var u=U.get(n.u), mt=marrText(u);
    if(LINE.has(n.id)||n.id===view||VIEWDESC.has(n.id)) cls+=' linked';
    yr='<span class="ring" aria-label="partner">'+ICON_RING+'</span>'+[mt?'m. '+esc2(mt):'', esc2(y)].filter(Boolean).join(' · ');
    if(n.ref) yr+=' · <span class="mute">children elsewhere</span>';
  } else if(n.kind==='ref'){
    cls+=' refcard'; st+='--lc:'+lc(n.id)+';';
    yr='<i class="dot"></i><span class="mute">Shown above</span>';
  }
  var nm=esc2(dispName(p))+(p.sx&&!/[,\s]/.test(p.sx)?'':'');
  if(n.kind==='p'&&n.id!==view&&childrenOf(n.id).length) btns+='<button type="button" class="ico" data-a="view" aria-label="Show the descendants of '+esc2(p.name)+'" title="Start the chart from '+esc2(p.name)+'">'+ICON_TREE+'</button>';
  if(editing&&!READONLY&&n.kind!=='ref') btns+='<button type="button" class="ico pen" data-a="edit" aria-label="Edit '+esc2(p.name)+'">'+ICON_PEN+'</button>';
  btns+='<button type="button" class="ico" data-a="open" aria-expanded="'+(openKey===n.key)+'" aria-label="Details for '+esc2(p.name)+'">'+ICON_CHEV+'</button>';
  var more=n.more?'<button type="button" class="beyond" data-a="more" title="'+n.more+' more descendants. Show them." aria-label="'+n.more+' more descendants of '+esc2(p.name)+'"><span>+'+n.more+'</span>&#8250;</button>':'';
  if(n.more) cls+=' hasmore';
  if(openKey===n.key) cls+=' open';
  return '<div class="'+cls+'" style="'+st+'" data-k="'+esc2(n.key)+'"><div class="who"><span class="nm" title="'+esc2(dispName(p))+'">'+nm+'</span><span class="yr">'+yr+'</span></div>'+btns+more+'</div>';
}

function render(keep){
  if(!view||!P.has(view)) view=STATE.root;
  syncPrefs();
  if(!view){ world.innerHTML=''; $('#title').textContent='Empty tree'; return }
  var sx=vp.scrollLeft, sy=vp.scrollTop;
  buildLines(view);
  /* everyone descended from the start person, to mark partners who are also descendants */
  VIEWDESC=new Set(); (function(){ var st=[view]; while(st.length){ childrenOf(st.pop()).forEach(function(k){ if(!VIEWDESC.has(k)){ VIEWDESC.add(k); st.push(k) } }) } })();
  ADDCARDS=true;
  if(editing){ var cnt=0, lay=[view], seen=new Set([view]);
    for(var g=1;g<depth&&lay.length&&cnt<=ADDMAX;g++){ var nx=[]; lay.forEach(function(x){ childrenOf(x).forEach(function(k){ if(!seen.has(k)){ seen.add(k); nx.push(k); cnt++ } }) }); lay=nx }
    ADDCARDS=cnt<=ADDMAX }
  var L=layout();
  NODES=L.nodes; BYKEY=new Map(NODES.map(function(n){return [n.key,n]}));
  SHOWN=new Map(); NODES.forEach(function(n){ if(n.kind==='p') SHOWN.set(n.id,n.key) });
  MAXCOL=L.cols-1;
  WIDTH=xOf(Math.max(MAXCOL,0))+CW+MX+(NODES.some(function(n){return n.more})?44:L.lines.some(function(l){return l.far&&l.node.c===MAXCOL&&l.node.c<=l.me.c})?GAP/2:0);
  HEIGHT=L.h;
  var h='';
  for(var c=0;c<=MAXCOL;c++) if(c%2) h+='<div class="band" style="left:'+(xOf(c)-GAP/2)+'px;width:'+(CW+GAP)+'px"></div>';
  h+='<svg class="lines" width="'+WIDTH+'" height="'+HEIGHT+'" aria-hidden="true">'+L.lines.map(function(l){
    return '<path d="'+l.d+'"'+(l.cls?' class="'+l.cls+'"':'')+(l.col?' style="--lc:'+lc(l.col)+'"':'')+'/>' }).join('')+'</svg>';
  h+=NODES.map(cardHTML).join('');
  world.innerHTML=h;
  world.style.width=WIDTH+'px'; world.style.height=HEIGHT+'px';
  buildHeads(MAXCOL);
  renderLegend(); renderHeader();
  applyScale();
  if(keep){ vp.scrollLeft=sx; vp.scrollTop=sy }
  if(openKey&&BYKEY.has(openKey)) showPop(openKey); else closePop(true);
  updateStatus();
}
function renderHeader(){
  var p=P.get(view);
  $('#title').textContent=dispName(p);
  var bits=[], y=years(p); if(y) bits.push(esc(y));
  var ps=parentsOf(view);
  if(ps.length) bits.push((sexOf(view)==='M'?'Son':sexOf(view)==='F'?'Daughter':'Child')+' of '+ps.map(function(q){return '<button type="button" class="linkbtn" data-go="'+esc(q)+'">'+esc(dispName(P.get(q)))+'</button>'}).join(' and '));
  if(FOCUS){ var fp=P.get(FOCUS.id);
    $('#sub').innerHTML='<span class="focusnote">How <b>'+esc(dispName(fp))+'</b>'+(years(fp)?' ('+esc(years(fp))+')':'')+' descends from '+esc(dispName(p))+': '+(FOCUS.paths===1?'one line':FOCUS.paths+' lines')+' of descent</span> · <button type="button" class="linkbtn" data-unfocus="1">Show everyone</button>';
    document.title='How '+dispName(fp)+' descends · Descendant Builder'; return }
  if(view!==STATE.root) bits.push('<button type="button" class="linkbtn" data-go="'+esc(STATE.root)+'">Back to '+esc(dispName(P.get(STATE.root)))+'</button>');
  if(STATE.sample) bits.push('<span class="samp">Sample tree</span> '+esc(STATE.sampleNote||'Press Edit to make it your own.'));
  $('#sub').innerHTML=bits.join(' · ');
  document.title=dispName(p)+' · Descendant Builder';
}
function updateStatus(){
  var n=0, sp=0; NODES.forEach(function(x){ if(x.kind==='p') n++; else if(x.kind==='sp') sp++ });
  if(FOCUS){ var on=0; NODES.forEach(function(x){ if(x.kind==='p'&&FOCUS.set.has(x.id)) on++ });
    $('#status').textContent=(FOCUS.paths===1?'One line':FOCUS.paths+' lines')+' of descent through '+on+' people · '+(FOCUS.gens.length>1?FOCUS.gens.join(', ')+' generations down':FOCUS.gens[0]+(FOCUS.gens[0]===1?' generation':' generations')+' down'); return }
  var total=descCount(view);
  $('#status').textContent=n+' people'+(STATE.hidePartners&&!editing?'':' and '+sp+' partners')+' shown · '+(n-1)+' of '+total+' descendants'+(editing&&!ADDCARDS?' · Add people from a card\'s details (⌄)':'');
}

/* ---------- depth ---------- */
function maxDepthOf(id){
  var best=0, seen=new Set();
  (function go(x,g){ if(g>best) best=g; if(seen.has(x+'@'+g)||g>60) return; seen.add(x+'@'+g); childrenOf(x).forEach(function(k){ go(k,g+1) }) })(id,0);
  return best+1;
}
function fillDepth(){
  var sel=$('#depth'), m=Math.max(maxDepthOf(view),1), h='';
  for(var i=1;i<=Math.max(m,depth);i++) h+='<option value="'+i+'">'+i+'</option>';
  sel.innerHTML=h; sel.value=String(depth);
}

/* ---------- zoom and pan ---------- */
function applyScale(){
  world.style.transform='scale('+scale+')';
  sizer.style.width=(WIDTH*scale)+'px'; sizer.style.height=(HEIGHT*scale)+'px';
  $('#zlabel').textContent=Math.round(scale*100)+'%';
  layoutHeads(); scrollHeads();
}
function zoomTo(s,cx,cy){
  s=clamp(s,0.15,2); if(cx==null){ cx=vp.clientWidth/2; cy=vp.clientHeight/2 }
  var wx=(vp.scrollLeft+cx)/scale, wy=(vp.scrollTop+cy)/scale;
  scale=s; applyScale();
  vp.scrollLeft=wx*scale-cx; vp.scrollTop=wy*scale-cy;
  if(openKey) placePop();
}
/* Opening view: everything if it fits at a readable size, otherwise a readable zoom centred on the first card. */
function fitStart(){
  var s=Math.min(vp.clientWidth/WIDTH,vp.clientHeight/HEIGHT,1);
  if(s>=0.6){ fit(); return }
  scale=clamp(Math.min(vp.clientWidth/WIDTH,1),0.6,1); applyScale();
  var n=BYKEY.get('p:'+view); vp.scrollLeft=0; vp.scrollTop=n?Math.max(0,(n.y+CH/2)*scale-vp.clientHeight/2):0;
}
function fit(){
  var s=Math.min(vp.clientWidth/WIDTH,vp.clientHeight/HEIGHT,1);
  scale=clamp(s,0.15,1); applyScale(); vp.scrollLeft=0; vp.scrollTop=0;
  if(openKey) placePop();
}
function focusNode(key,open){
  var n=BYKEY.get(key); if(!n) return;
  var x=xOf(n.c)*scale, y=n.y*scale;
  vp.scrollTo({left:Math.max(0,x-vp.clientWidth/2+CW*scale/2), top:Math.max(0,y-vp.clientHeight/2+CH*scale/2), behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  var el=world.querySelector('[data-k="'+cssq(key)+'"]');
  if(el){ el.classList.remove('refhl'); void el.offsetWidth; el.classList.add('refhl'); setTimeout(function(){ el.classList.remove('refhl') },2600) }
  if(open) setTimeout(function(){ showPop(key) },260);
}
var cssq=function(s){ return String(s).replace(/["\\]/g,'\\$&') };
(function(){
  var drag=null;
  vp.addEventListener('pointerdown',function(e){
    if(e.button!==0||e.target.closest('button,a,.card.add')) return;
    drag={x:e.clientX,y:e.clientY,l:vp.scrollLeft,t:vp.scrollTop,m:false,id:e.pointerId};
  });
  window.addEventListener('pointermove',function(e){
    if(!drag||e.pointerId!==drag.id) return;
    var dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if(!drag.m&&Math.abs(dx)+Math.abs(dy)<4) return;
    if(e.pointerType!=='mouse') return;
    drag.m=true; vp.classList.add('drag'); vp.scrollLeft=drag.l-dx; vp.scrollTop=drag.t-dy;
  });
  window.addEventListener('pointerup',function(){ if(drag&&drag.m) vp.classList.remove('drag'); drag=null });
  vp.addEventListener('wheel',function(e){
    if(!e.ctrlKey&&!e.metaKey) return; e.preventDefault();
    var r=vp.getBoundingClientRect(); zoomTo(scale*Math.exp(-e.deltaY*0.0022),e.clientX-r.left,e.clientY-r.top);
  },{passive:false});
  vp.addEventListener('scroll',function(){ scrollHeads(); if(openKey) placePop() });
  window.addEventListener('resize',function(){ layoutHeads(); if(openKey) placePop() });
})();

/* ---------- details panel ---------- */
function linkTo(id,label){ return '<button type="button" class="linkbtn" data-go="'+esc(id)+'">'+esc(label||dispName(P.get(id)))+'</button>' }
function relation(id,n){
  if(id===view) return 'Start of this chart';
  var g=genFrom(view,id);
  if(g>0) return relWord(g,sexOf(id))+' of '+firstName(P.get(view));
  if(n&&n.kind==='sp'){ var o=P.get(n.of), s=sexOf(id); return (s==='F'?'Wife':s==='M'?'Husband':'Partner')+' of '+dispName(o) }
  return '';
}
function popHTML(key){
  var n=BYKEY.get(key), id=n.id, p=P.get(id), rows=[], cite={}, srcs=(p.src||[]).filter(function(s){return s&&s.ti});
  srcs.forEach(function(s,i){ var f=s.f||'all'; (cite[f]=cite[f]||[]).push(i+1) });
  var cs=function(f){ var a=(cite[f]||[]).concat(f==='all'?[]:[]); return a.length?'<sup class="cite">'+a.join(',')+'</sup>':'' };
  var row=function(k,v){ if(v) rows.push('<dt>'+k+'</dt><dd>'+v+'</dd>') };
  row('Relation',esc(relation(id,n)));
  var ix=genFrom(STATE.root,id)>=0?indexOf(id):'';
  row('Sex',SEXW[p.sex||'U']);
  if(p.l) row('Living','Yes'); else row('Lived',esc(lived(p)));
  if(!(p.l&&!STATE.showLiving)) row('Born',esc(fullDate(p,'b'))+cs('birth'));
  row('Died',esc(fullDate(p,'d'))+(p.d?cs('death'):''));
  row('Born in',esc(p.bp||'')); row('Died in',esc(p.dp||''));
  row('Seat or home',esc(p.seat||''));
  row('Occupation',esc(p.occ||'')+(p.occ?cs('occ'):''));
  row('Notable for',p.star?'<span class="sdot">&#9733;</span> '+esc(p.star):'');
  var us=unionsOf(id);
  if(us.length) row(us.length>1?'Partners':'Partner',us.map(function(u){ var o=partnerIn(u,id), mt=[];
    if(u.m) mt.push('m. '+esc(fullDate({m:u.m,mm:u.mm,mdy:u.mdy,mq:u.mq},'m')));
    if(u.mp) mt.push(esc(u.mp)); if(u.div) mt.push('divorced');
    var kids=u.ch.length; if(kids) mt.push(kids+(kids===1?' child':' children'));
    return '<div class="fam">'+(o!=null?linkTo(o):'<span class="mute">Partner not recorded</span>')+(mt.length?'<br><span class="mute">'+mt.join(' · ')+'</span>':'')+'</div>' }).join(''));
  var ps=parentsOf(id); row('Parents',ps.map(function(q){return '<div class="fam">'+linkTo(q)+'</div>'}).join('')+cs('parents'));
  var ks=childrenOf(id); if(ks.length) row(ks.length>1?'Children ('+ks.length+')':'Child',ks.map(function(k){return linkTo(k)}).join(', '));
  if(p.children&&p.children.length) row('Other children',esc(p.children.join(', ')));
  (p.ev||[]).forEach(function(e){ row(esc(EVT[e.t]||'Event'),'<span class="ev">'+[e.date,e.pl,e.tx].filter(Boolean).map(esc).join(' · ')+'</span>'+cs('events')) });
  if(p.notes) row('Notes',esc(p.notes).replace(/\n/g,'<br>'));
  if(ix) row('Index no.','<span class="mono">'+esc(ix)+'</span>'+(p.idx&&p.idx!==ix?' <span class="mute">(book: '+esc(p.idx)+')</span>':''));
  else if(p.idx) row('Index no.','<span class="mono">'+esc(p.idx)+'</span>');
  if(p.wiki) row(wikiSite(p.wiki),'<a href="'+esc(wikiHref(p.wiki))+'" target="_blank" rel="noopener">Open page &#8599;</a>');
  if(srcs.length) row('Sources','<ol class="srcs">'+srcs.map(function(s){
    var t=esc(s.ti), u=safeUrl(s.url); return '<li>'+(u?'<a href="'+esc(u)+'" target="_blank" rel="noopener">'+t+'</a>':t)+'</li>' }).join('')+'</ol>');
  var acts='';
  if(id!==STATE.root&&!(FOCUS&&FOCUS.id===id)&&genFrom(STATE.root,id)>0) acts+='<button type="button" class="btn" data-lineage="'+esc(id)+'">How they descend from '+esc(firstName(P.get(STATE.root)))+'</button>';
  if(id!==view&&ks.length) acts+='<button type="button" class="btn" data-go="'+esc(id)+'" data-mode="root">Show their descendants</button>';
  if(n.kind!=='p'&&SHOWN.has(id)) acts+='<button type="button" class="btn" data-jump="'+esc(SHOWN.get(id))+'">Go to their own card</button>';
  if(ps.length&&!SHOWN.has(ps[0])) acts+='<button type="button" class="btn" data-go="'+esc(topOf(id))+'" data-mode="root" data-find="'+esc(id)+'">Show from '+esc(firstName(P.get(topOf(id))))+'</button>';
  if(editing&&!READONLY&&!ADDCARDS){
    acts+='<button type="button" class="btn" data-add="partner" data-of="'+esc(id)+'">Add partner</button>';
    var au=us.length?us:[null];
    au.forEach(function(u){ var o=u?partnerIn(u,id):null; acts+='<button type="button" class="btn" data-add="child" data-of="'+esc(id)+'"'+(u?' data-u="'+esc(u.id)+'"':'')+'>Add child'+(o!=null&&au.length>1?' with '+esc(firstName(P.get(o))):'')+'</button>' });
  }
  if(editing&&!READONLY) acts+='<button type="button" class="btn" data-edit-id="'+esc(id)+'" data-edit-key="'+esc(key)+'">'+ICON_PEN+' Edit</button>';
  return '<h2>'+esc(dispName(p))+'</h2>'+(years(p)?'<p class="life">'+esc(years(p))+'</p>':'')+'<dl>'+rows.join('')+'</dl>'+(acts?'<div class="actions">'+acts+'</div>':'');
}
function showPop(key){
  if(!BYKEY.has(key)) return closePop();
  var prev=world.querySelector('.card.open'); if(prev){ prev.classList.remove('open'); var b=prev.querySelector('[data-a="open"]'); if(b) b.setAttribute('aria-expanded','false') }
  openKey=key; pop.innerHTML=popHTML(key); pop.hidden=false;
  var el=world.querySelector('[data-k="'+cssq(key)+'"]'); if(el){ el.classList.add('open'); var bb=el.querySelector('[data-a="open"]'); if(bb) bb.setAttribute('aria-expanded','true') }
  placePop();
}
function placePop(){
  if(pop.hidden||!openKey) return;
  if(narrow.matches){ pop.style.left=''; pop.style.top=''; return }
  var n=BYKEY.get(openKey); if(!n) return;
  var sr=stage.getBoundingClientRect(), vr=vp.getBoundingClientRect();
  var cx=vr.left-sr.left+xOf(n.c)*scale-vp.scrollLeft, cy=vr.top-sr.top+n.y*scale-vp.scrollTop;
  var pw=pop.offsetWidth, ph=pop.offsetHeight, x=cx+CW*scale+10;
  if(x+pw>sr.width-8) x=cx-pw-10;
  if(x<8) x=clamp(cx,8,sr.width-pw-8);
  var y=clamp(cy-20,8,Math.max(8,sr.height-ph-8));
  pop.style.left=x+'px'; pop.style.top=y+'px';
}
function closePop(quiet){
  var el=openKey&&world.querySelector('[data-k="'+cssq(openKey)+'"]');
  if(el){ el.classList.remove('open'); var b=el.querySelector('[data-a="open"]'); if(b){ b.setAttribute('aria-expanded','false'); if(!quiet) b.focus({preventScroll:true}) } }
  openKey=null; pop.hidden=true;
}

/* ---------- navigation ---------- */
/* Go to a person: their card if it is on the chart, otherwise a chart that shows them. */
function goTo(id,asRoot){
  if(!P.has(id)) return;
  if(FOCUS&&(asRoot||!SHOWN.has(id))){ depth=FOCUS.prev.depth; FOCUS=null }
  if(!asRoot&&SHOWN.has(id)){ closePop(true); focusNode(SHOWN.get(id),true); return }
  var g=genFrom(view,id);
  if(!asRoot&&g>0&&g<60){ depth=Math.max(depth,g+1); fillDepth(); saveView(); render(true); focusNode(SHOWN.get(id),true); return }
  setView(asRoot?id:(childrenOf(id).length?id:topOf(id)));
  if(SHOWN.has(id)&&id!==view) focusNode(SHOWN.get(id),true);
}
function setView(id){
  FOCUS=null; view=id; openKey=null; depth=Math.min(Math.max(depth,2),maxDepthOf(id)); if(depth<1) depth=1;
  try{ history.replaceState(null,'','#'+encodeURIComponent(id)) }catch(_){}
  fillDepth(); render(); fitStart(); saveView();
}
/* Show only the lines from the start of the tree down to one person: every way they descend from it. */
function showLineage(id){
  var root=STATE.root, down=new Set([root]), st=[root];
  while(st.length){ childrenOf(st.pop()).forEach(function(k){ if(!down.has(k)){ down.add(k); st.push(k) } }) }
  if(!down.has(id)||id===root) return;
  var set=new Set([id]); st=[id];
  while(st.length){ parentsOf(st.pop()).forEach(function(q){ if(down.has(q)&&!set.has(q)){ set.add(q); st.push(q) } }) }
  /* count the lines of descent, and how many generations each is */
  var memo=new Map();
  var walk=function(x){ if(x===root) return new Map([[0,1]]); if(memo.has(x)) return memo.get(x); memo.set(x,new Map());
    var m=new Map(); parentsOf(x).forEach(function(q){ if(!set.has(q)) return; walk(q).forEach(function(n,g){ m.set(g+1,(m.get(g+1)||0)+n) }) });
    memo.set(x,m); return m };
  var gm=walk(id), paths=0, gens=[]; gm.forEach(function(n,g){ paths+=n; gens.push(g) }); gens.sort(function(a,b){return a-b});
  var prev=FOCUS?FOCUS.prev:{view:view, depth:depth};
  FOCUS={id:id, set:set, paths:paths, gens:gens, prev:prev};
  view=root; openKey=null; depth=gens[gens.length-1]+1;
  fillDepth(); render(); fitStart();
  if(SHOWN.has(id)) focusNode(SHOWN.get(id));
}
function endLineage(){
  if(!FOCUS) return; var pv=FOCUS.prev, id=FOCUS.id; FOCUS=null;
  view=P.has(pv.view)?pv.view:STATE.root; depth=pv.depth; openKey=null;
  fillDepth(); render(); fitStart();
  if(SHOWN.has(id)) focusNode(SHOWN.get(id),true);
}
function readHash(){ var h=decodeURIComponent(location.hash.slice(1)); return P.has(h)?h:null }

world.addEventListener('click',function(e){
  var card=e.target.closest('[data-k]'); if(!card) return;
  var key=card.getAttribute('data-k'), n=BYKEY.get(key), a=e.target.closest('[data-a]');
  if(n.kind==='add'){ if(typeof openAdd==='function') openAdd(n); return }
  var act=a?a.getAttribute('data-a'):'open';
  if(act==='view'||act==='more'){ setView(n.id); return }
  if(act==='edit'){ if(typeof openEdit==='function') openEdit(n.id,n); return }
  if(n.kind==='ref'&&!a){ focusNode(SHOWN.get(n.id),true); return }
  if(openKey===key) closePop(); else showPop(key);
});
document.addEventListener('click',function(e){
  var g=e.target.closest('[data-go]');
  if(g){ var id=g.getAttribute('data-go'), f=g.getAttribute('data-find'); goTo(id,g.getAttribute('data-mode')==='root'); if(f&&SHOWN.has(f)) focusNode(SHOWN.get(f),true); return }
  var ad=e.target.closest('[data-add]'); if(ad&&typeof openAdd==='function'){ openAdd({act:ad.getAttribute('data-add'), of:ad.getAttribute('data-of'), u:ad.getAttribute('data-u')||null}); return }
  var ln=e.target.closest('[data-lineage]'); if(ln){ closePop(true); showLineage(ln.getAttribute('data-lineage')); return }
  if(e.target.closest('[data-unfocus]')){ endLineage(); return }
  var j=e.target.closest('[data-jump]'); if(j){ closePop(true); focusNode(j.getAttribute('data-jump'),true); return }
  var ed=e.target.closest('[data-edit-id]'); if(ed&&typeof openEdit==='function'){ openEdit(ed.getAttribute('data-edit-id'),BYKEY.get(ed.getAttribute('data-edit-key'))); return }
  if(!pop.hidden&&!e.target.closest('#pop')&&!e.target.closest('.card')&&!e.target.closest('.sheet')&&!e.target.closest('.scrim')) closePop(true);
});
document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!pop.hidden&&$('#sheet').hidden) closePop() });
$('#zin').onclick=function(){ zoomTo(scale*1.2) };
$('#zout').onclick=function(){ zoomTo(scale/1.2) };
$('#zlabel').onclick=function(){ zoomTo(1) };
$('#fit').onclick=fit;
$('#depth').onchange=function(){ depth=+this.value; if(!FOCUS) saveView(); render(true) };
