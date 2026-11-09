/* Multi-start guillotine search with order ruin/recreate and several fit rules. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.PlannerEngine,typeof module==='object'&&module.exports?require('./process.js'):root.PlannerProcess);if(typeof module==='object'&&module.exports)module.exports=api;root.PlannerSearchCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(E,P){
 'use strict';
 function create(parts,stocks,template,allowAuto,settings={}){
  let seed=Number(settings.seed)||81321,iterations=0,stale=0;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const shuffle=list=>{for(let i=list.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[list[i],list[j]]=[list[j],list[i]];}return list;};
  const instances=parts.flatMap(p=>Array.from({length:p.qty},(_,i)=>({...p,instanceId:p.id+'@'+(i+1)})));
  function rank(result){const area=result.sheets.reduce((s,b)=>s+b.length*b.width,0),m=P.metrics(result.sheets),placed=instances.length-result.unplaced.length;
   const workArea=area*(1+Math.min(.12,m.work/Math.max(1,placed)*.006));
   if(settings.priority==='work')return[result.unplaced.length,result.sheets.length,m.work,area];
   if(settings.priority==='waste')return[result.unplaced.length,area,result.sheets.length,m.work];
   return[result.unplaced.length,result.sheets.length,workArea,area,m.work];
  }
  const better=(a,b)=>a.some((v,i)=>v<b[i]&&a.slice(0,i).every((x,j)=>Math.abs(x-b[j])<1e-7));
  let best=E.optimize(parts,stocks,template,allowAuto,{rank}),bestRank=rank(best);
  function order(){
   const mode=iterations%14;
   if(mode<8){const score=p=>{const a=p.length,b=p.width;return mode===0?a*b:mode===1?Math.max(a,b):mode===2?Math.min(a,b):mode===3?a:mode===4?b:mode===5?a+b:mode===6?a/b:b/a;};
    const noise=iterations<14?0:.08+rand()*.7,weights=new Map(instances.map(p=>[p.instanceId,score(p)*(1+noise*(rand()-.5))]));return instances.slice().sort((a,b)=>weights.get(b.instanceId)-weights.get(a.instanceId));}
   // Reconstruct a promising order, destroy a subset and insert it elsewhere.
   const ids=best.sheets.flatMap(b=>E.leaves(b.root).filter(n=>n.piece).map(n=>n.piece.instanceId));
   const byId=new Map(instances.map(p=>[p.instanceId,p]));
   let list=ids.map(id=>byId.get(id)).filter(Boolean);const found=new Set(ids);list.push(...instances.filter(p=>!found.has(p.instanceId)));
   if(mode===8)list.reverse();else if(mode===9){const i=Math.floor(rand()*list.length),n=Math.max(2,Math.floor(list.length*(.1+rand()*.35)));const block=list.splice(i,n);list.splice(Math.floor(rand()*(list.length+1)),0,...shuffle(block));}
   else{const removed=[],ratio=stale>50?.5:.12+rand()*.18;list=list.filter(p=>{if(rand()<ratio){removed.push(p);return false;}return true;});for(const p of shuffle(removed))list.splice(Math.floor(rand()*(list.length+1)),0,p);}
   return list;
  }
  function step(){
   const list=order(),ranks=new Map(list.map((p,i)=>[p.instanceId,i]));iterations++;
   const result=E.optimize(parts,stocks,template,allowAuto,{sorts:[(a,b)=>(ranks.get(a.instanceId)??1e9)-(ranks.get(b.instanceId)??1e9)],policies:['auto','h','v'],selection:['area','short','long'][Math.floor(iterations/14)%3],rank});
   const value=rank(result);if(better(value,bestRank)){best=result;bestRank=value;stale=0;}else stale++;
   return{best,iterations,metrics:P.metrics(best.sheets)};
  }
  return{step,get result(){return{...best,optimization:{iterations,priority:settings.priority||'balanced',processRevision:5,metrics:P.metrics(best.sheets)}};}};
 }
 return{create};
});
