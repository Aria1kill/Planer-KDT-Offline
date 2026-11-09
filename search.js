(function(){
 'use strict';
 let cancelCurrent=null;
 function optimize(parts,stocks,template,auto,settings,progress){return new Promise((resolve,reject)=>{
  let worker=null,latest=null,ended=false,timer=0,canceled=false;
  const finish=result=>{if(ended)return;ended=true;if(worker)worker.terminate();clearTimeout(timer);cancelCurrent=null;resolve(result);};
  const fail=error=>{if(ended)return;ended=true;if(worker)worker.terminate();cancelCurrent=null;reject(error);};
  function fallback(){if(worker){worker.terminate();worker=null;}let search;try{search=PlannerSearchCore.create(parts,stocks,template,auto,settings);}catch(e){fail(e);return;}
   if(canceled){finish(search.result);return;}const start=Date.now(),budget=Math.max(250,Math.min(60000,Number(settings.seconds||8)*1000));cancelCurrent=()=>finish(search.result);
   function batch(){if(ended)return;try{const until=Date.now()+35;do{search.step();}while(Date.now()<until&&Date.now()-start<budget);latest=search.result;progress?.({elapsed:Date.now()-start,result:latest});if(Date.now()-start>=budget)finish(latest);else timer=setTimeout(batch,0);}catch(e){fail(e);}}timer=setTimeout(batch,0);
  }
  if(typeof Worker==='undefined'){fallback();return;}
  try{worker=new Worker('js/search-worker.js');worker.onmessage=ev=>{const msg=ev.data;if(msg.type==='error'){fail(Error(msg.message));return;}latest=msg.result;progress?.({elapsed:msg.elapsed,result:latest});if(msg.type==='done')finish(latest);};worker.onerror=()=>{if(!latest&&!ended)fallback();else fail(Error('Nie udało się zakończyć optymalizacji.'));};worker.postMessage({parts,stocks,template,auto,settings});cancelCurrent=()=>{canceled=true;if(latest)finish(latest);else fallback();};}catch{fallback();}
 });}
 window.PlannerSearch={optimize,stop(){cancelCurrent?.();}};
})();
