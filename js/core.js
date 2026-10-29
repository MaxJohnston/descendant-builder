/* Descendant Builder · js/core.js
   Shared state and helpers: the tree being edited (STATE), lookups built from it (rebuild), names, dates and descent lines.
   All files share one global scope and must load in the order listed in index.html. */
'use strict';

/* A read-only copy (saved with "Save as read-only web page") carries its tree in DB_EXPORT and cannot be edited. */
var READONLY=!!(window.DB_EXPORT&&window.DB_EXPORT.state);
var DB_BODY=(function(){ var b=document.body.cloneNode(true); b.querySelectorAll('script').forEach(function(s){ s.remove() }); return b.innerHTML.trim() })();

/* Card size and spacing, in chart pixels. SLOT is one row; a partner card sits PSLOT under the person it married. */
var CW=256, CH=48, GAP=72, SLOT=58, PSLOT=54, MX=24, TOP=14, FGAP=10;
var clone=function(o){return JSON.parse(JSON.stringify(o))};
var STATE=READONLY?{people:[],unions:[]}:clone(SAMPLE);
var P=new Map(), U=new Map(), UOF=new Map(), PU=new Map(), DESC=new Map();
var $=function(s){return document.querySelector(s)};
var stage=$('#stage'), vp=$('#vp'), sizer=$('#sizer'), world=$('#world'), pop=$('#pop'), heads=$('#heads'), hin=$('#hin'), lg=$('#legend');
var narrow=window.matchMedia('(max-width:640px)');
var view=null, depth=5, scale=1, ww=800, wh=400, openKey=null, editing=false;

var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
var safeUrl=function(u){u=String(u||'').trim();return /^https?:\/\//i.test(u)?u:''};
var uid=function(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)};
var isUrl=function(w){ return /^https?:\/\//i.test(String(w||'')) };
function wikiHref(w){ return isUrl(w)?w:'https://en.wikipedia.org/wiki/'+encodeURI(w) }
function wikiAria(w,name){ return wikiSite(w)==='Wikipedia'?'Open the Wikipedia article for '+name+' in a new tab':'Open the '+wikiSite(w)+' page for '+name+' in a new tab' }
function wikiSite(w){
  if(!isUrl(w)||/wikipedia\.org/i.test(w)) return 'Wikipedia';
  var h=''; try{ h=new URL(w).hostname }catch(_){} return h.replace(/^www\./,'')||'Link';
}
var EVT={marr:'Marriage',div:'Divorce',bapm:'Baptism',chr:'Christening',buri:'Burial',immi:'Immigration',emig:'Emigration',natu:'Naturalization',mili:'Military service',resi:'Residence',educ:'Education',cens:'Census',reli:'Religion',even:'Other event'};
var FACTS=[['all','Whole record'],['name','Name'],['birth','Birth'],['death','Death'],['parents','Parents'],['marr','Marriage'],['occ','Occupation'],['events','Other events']];
var QUAL=[['','Exact'],['abt','About'],['bef','Before'],['aft','After'],['bet','Between']];
var SEXW={M:'Male',F:'Female',U:'Not recorded'};

/* ---------- the tree ----------
   people: [{id, name, fn, mn, ln, sx, sex, l, b…, d…, bp, dp, seat, occ, star, wiki, notes, ev, src, idx}]
   unions: [{id, p:[personId, partnerId|null], ch:[childIds], m, mm, mdy, mq, mp, div, note}]
   The person fields are the same as Pedigree Builder's, so people move between the two apps unchanged. */
function rebuild(){
  if(!Array.isArray(STATE.people)) STATE.people=[];
  if(!Array.isArray(STATE.unions)) STATE.unions=[];
  P=new Map(); STATE.people.forEach(function(p){ P.set(p.id,p) });
  U=new Map(); UOF=new Map(); PU=new Map();
  STATE.unions.forEach(function(u){
    u.p=(u.p||[]).filter(function(x){return x!=null&&P.has(x)}); u.ch=(u.ch||[]).filter(function(x){return P.has(x)});
    U.set(u.id,u);
    u.p.forEach(function(x){ if(!UOF.has(x)) UOF.set(x,[]); UOF.get(x).push(u.id) });
    u.ch.forEach(function(c){ if(!PU.has(c)) PU.set(c,u.id) });
  });
  if(!P.has(STATE.root)) STATE.root=STATE.people.length?STATE.people[0].id:null;
  DESC=new Map();
}
var person=function(id){return P.get(id)};
var unionsOf=function(id){return (UOF.get(id)||[]).map(function(k){return U.get(k)})};
var partnerIn=function(u,id){ for(var i=0;i<u.p.length;i++) if(u.p[i]!==id) return u.p[i]; return null };
var parentsOf=function(id){ var u=U.get(PU.get(id)); return u?u.p.slice():[] };
function childrenOf(id){ var out=[]; unionsOf(id).forEach(function(u){ u.ch.forEach(function(c){ if(out.indexOf(c)<0) out.push(c) }) }); return out }
/* All descendants of id (each once), for counts and "more" markers. */
function descCount(id){
  if(DESC.has(id)) return DESC.get(id);
  var seen=new Set(), st=childrenOf(id).slice();
  while(st.length){ var x=st.pop(); if(seen.has(x)||x===id) continue; seen.add(x); childrenOf(x).forEach(function(c){ st.push(c) }) }
  DESC.set(id,seen.size); return seen.size;
}
/* Generations from a down to d by the shortest line (0 = same person, -1 = not a descendant). */
function genFrom(a,d){
  if(a===d) return 0;
  var layer=[a], seen=new Set([a]);
  for(var g=1;g<200&&layer.length;g++){
    var nx=[];
    for(var i=0;i<layer.length;i++){ var k=childrenOf(layer[i]);
      for(var j=0;j<k.length;j++){ if(k[j]===d) return g; if(!seen.has(k[j])){ seen.add(k[j]); nx.push(k[j]) } } }
    layer=nx;
  }
  return -1;
}
/* The tree's first ancestor of someone: follow parents up while there are any (father's side first). */
function topOf(id){
  var x=id, seen=new Set();
  while(!seen.has(x)){ seen.add(x); var ps=parentsOf(x); if(!ps.length) return x;
    var f=ps.filter(function(q){return sexOf(q)==='M'})[0]; x=f!=null?f:ps[0] }
  return x;
}

/* ---------- names, sex and relationships ---------- */
var SUFFIX=/^(jr\.?|sr\.?|i{1,3}|iv|v|vi{0,3}|ix|x)$/i;
function nameParts(p){
  if(p.fn!=null||p.mn!=null||p.ln!=null||p.sx!=null) return {fn:p.fn||'',mn:p.mn||'',ln:p.ln||'',sx:p.sx||''};
  var t=String(p.name||'').trim().split(/\s+/).filter(Boolean), sx=[];
  while(t.length>2&&SUFFIX.test(t[t.length-1].replace(/,$/,''))) sx.unshift(t.pop());
  if(!t.length) return {fn:'',mn:'',ln:'',sx:''};
  if(t.length===1) return {fn:t[0],mn:'',ln:'',sx:sx.join(' ')};
  return {fn:t[0],mn:t.slice(1,-1).join(' '),ln:t[t.length-1],sx:sx.join(' ')};
}
function joinName(np){ return [np.fn,np.mn,np.ln].filter(Boolean).join(' ')+(np.sx?(/^(jr|sr)/i.test(np.sx)?', ':' ')+np.sx:'') }
function dispName(p){
  if(!p) return '?';
  if(STATE.nameView==='married'&&p.mln){ var np=nameParts(p), m=String(p.mln).split(',')[0].trim(); if(m) return joinName({fn:np.fn,mn:np.mn,ln:m,sx:np.sx}) }
  return p.name||'Unnamed';
}
var firstName=function(p){ var np=nameParts(p); return np.fn||p.name||'?' };
function sexOf(id){ var p=P.get(id); return (p&&p.sex)||'U' }
var ord=function(k){var v=k%100,s=['th','st','nd','rd'];return k+(s[(v-20)%10]||s[v]||s[0])};
var cap=function(s){return s.charAt(0).toUpperCase()+s.slice(1)};
function relWord(g,sex){
  var m=sex==='M', f=sex==='F';
  if(g===0) return 'Self';
  if(g===1) return m?'Son':f?'Daughter':'Child';
  if(g===2) return m?'Grandson':f?'Granddaughter':'Grandchild';
  var base=m?'great-grandson':f?'great-granddaughter':'great-grandchild';
  return g===3?cap(base):ord(g-2)+' '+base;
}
function genLabel(g){
  if(g===0) return 'Start';
  if(g===1) return 'Children';
  if(g===2) return 'Grandchildren';
  if(g===3) return 'Great-grandchildren';
  return ord(g-2)+' great-grandchildren';
}
/* Index numbers in the style of "The Randolphs of Virginia": one digit per generation below the tree's root,
   each the child's place among its siblings; 10 is x, 11 is a, 12 is b and so on. */
var IDXD='123456789xabcdefghijklmnopqrstuvwyz';
function indexOf(id){
  var root=STATE.root, out='', x=id, seen=new Set();
  while(x!==root){
    if(seen.has(x)) return ''; seen.add(x);
    var u=U.get(PU.get(x)); if(!u) return '';
    var par=u.p.filter(function(q){return genFrom(root,q)>=0})[0]; if(par==null) return '';
    var sibs=childrenOf(par), i=sibs.indexOf(x);
    out=(IDXD.charAt(i)||'?')+out; x=par;
  }
  return out;
}

/* ---------- dates ---------- */
var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function yStr(y){ y=+y; return y<0?(-y)+' BC':String(y) }
function yText(p,k){
  var y=p[k]; if(!y) return '';
  var q=p[k+'q'], y2=p[k+'2'];
  if(q==='abt') return 'c. '+yStr(y); if(q==='bef') return 'bef. '+yStr(y); if(q==='aft') return 'aft. '+yStr(y);
  if(q==='bet'&&y2) return yStr(y)+'/'+yStr(y2);
  return yStr(y);
}
function fullDate(p,k){
  var y=p[k]; if(!y) return '';
  var q=p[k+'q'];
  if(q==='bet'&&p[k+'2']) return 'between '+yStr(y)+' and '+yStr(p[k+'2']);
  var m=p[k+'m'], d=p[k+'dy'], parts=[];
  if(m&&d) parts.push(d); if(m) parts.push(MONTHS[m-1]); parts.push(yStr(y));
  return ({abt:'about ',bef:'before ',aft:'after '}[q]||'')+parts.join(' ');
}
function years(p){
  if(p.l) return (p.b&&STATE.showLiving)?yText(p,'b')+'–Living':'Living';
  if(p.b&&p.d) return yText(p,'b')+'–'+yText(p,'d');
  if(p.b) return 'b. '+yText(p,'b');
  if(p.d) return 'd. '+yText(p,'d');
  return '';
}
function lived(p){
  if(!p.b||!p.d||p.l) return '';
  var a=p.d-p.b; if(p.bm&&p.dm&&(p.dm<p.bm||(p.dm===p.bm&&p.ddy&&p.bdy&&p.ddy<p.bdy))) a--;
  if(a<0||a>125) return '';
  return (p.bq||p.dq||!p.bm||!p.dm?'about ':'')+a+(a===1?' year':' years');
}
var marrText=function(u){ return u.m?(u.mq==='abt'?'c. ':u.mq==='bef'?'bef. ':u.mq==='aft'?'aft. ':'')+yStr(u.m):'' };

/* ---------- lines of descent ----------
   Each child of the person at the start of the chart owns a colour; their descendants share it. */
var LINE=new Map(), LINEINFO=[];
function buildLines(root){
  LINE=new Map(); LINEINFO=[];
  childrenOf(root).forEach(function(c,i){
    var slot=i%8; LINEINFO.push({slot:slot,id:c});
    var st=[c];
    while(st.length){ var x=st.pop(); if(LINE.has(x)) continue; LINE.set(x,slot); childrenOf(x).forEach(function(k){ st.push(k) }) }
  });
}
function lc(id){ var s=LINE.get(id); return s==null?'var(--rule)':'var(--b'+s+')' }
function renderLegend(){
  var h='<li class="lead">Lines of descent</li>';
  if(!LINEINFO.length) h+='<li class="lead">no children recorded</li>';
  else h+=LINEINFO.map(function(e){ var p=P.get(e.id), lab=firstName(p)+(p.seat?' of '+p.seat.split(',')[0]:'');
    return '<li><button type="button" class="lgb" data-go="'+esc(e.id)+'" title="Show '+esc(dispName(p))+'"><i class="dot" style="--lc:var(--b'+e.slot+')"></i><span>'+esc(lab)+'</span></button></li>' }).join('');
  lg.innerHTML=h;
}

/* Generation labels live in a strip above the scrolling chart and follow its horizontal scroll and zoom. */
function buildHeads(maxD){
  var h='';
  for(var c=0;c<=maxD;c++) h+='<div class="hd'+(c%2?' alt':'')+'" data-c="'+c+'"><b>'+(c+1)+'</b><span class="tx">'+esc(genLabel(c))+'</span></div>';
  hin.innerHTML=h;
}
var xOf=function(c){return MX+c*(CW+GAP)};
function layoutHeads(){
  var w=(CW+GAP)*scale, kids=hin.children;
  heads.style.right=(vp.offsetWidth-vp.clientWidth)+'px';
  for(var i=0;i<kids.length;i++){
    var c=+kids[i].getAttribute('data-c');
    kids[i].style.left=((xOf(c)-GAP/2+(c?0:GAP/2-MX))*scale)+'px';
    kids[i].style.width=((CW+GAP-(c?0:GAP/2-MX))*scale)+'px';
    kids[i].classList.toggle('num',w<150);
  }
}
function scrollHeads(){hin.style.transform='translateX('+(-vp.scrollLeft)+'px)'}

var ICON_TREE='<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="6" width="4" height="4" rx=".8"/><rect x="10.5" y="1.5" width="4" height="4" rx=".8"/><rect x="10.5" y="10.5" width="4" height="4" rx=".8"/><path d="M5.5 8H8M8 3.5v9M8 3.5h2.5M8 12.5h2.5"/></svg>';
var ICON_CHEV='<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transition:transform .15s"><path d="M3.5 6l4.5 4.5L12.5 6"/></svg>';
var ICON_PEN='<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.8 2.4l2.8 2.8-8.2 8.2-3.5.7.7-3.5z"/><path d="M9.3 3.9l2.8 2.8"/></svg>';
var ICON_RING='<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="6" cy="9" r="4"/><circle cx="10" cy="9" r="4"/></svg>';
