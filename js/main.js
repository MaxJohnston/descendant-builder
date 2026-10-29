/* Descendant Builder · js/main.js
   Start-up: loads the saved tree (or the sample) and draws the chart. Loaded last.
   All files share one global scope and must load in the order listed in index.html. */
'use strict';

(function(){
  if(READONLY){ STATE=normalize(DB_EXPORT.state); document.body.classList.add('readonly'); return }
/*{edit*/
  /* a saved copy of the untouched sample is replaced by the current sample */
  try{ var s=localStorage.getItem(LSKEY); if(s){ var o=JSON.parse(s); if(valid(o)&&!o.sample) STATE=normalize(o) } }catch(_){}
/*}edit*/
})();
rebuild();
(function(){
  var sv=READONLY?{view:DB_EXPORT.view,depth:DB_EXPORT.depth}:savedView();
  view=readHash()||(sv&&P.has(sv.view)?sv.view:STATE.root);
  depth=sv&&sv.depth?sv.depth:Math.min(4,maxDepthOf(view));
})();
fillDepth();
render();
fitStart();
/*{edit*/
resetHistory();
setSave('Saved in this browser');
/*}edit*/
