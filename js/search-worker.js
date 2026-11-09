importScripts('engine.js','process.js','search-core.js');
self.onmessage=function(event){try{const {parts,stocks,template,auto,settings}=event.data,search=PlannerSearchCore.create(parts,stocks,template,auto,settings),start=Date.now(),budget=Math.max(250,Math.min(60000,Number(settings.seconds||8)*1000));let last=0;
 do{search.step();if(Date.now()-last>400){last=Date.now();self.postMessage({type:'progress',elapsed:Date.now()-start,result:search.result});}}while(Date.now()-start<budget);
 self.postMessage({type:'done',result:search.result});
}catch(error){self.postMessage({type:'error',message:error.message});}};
