/* Offline-only checks. No browser application, port or machine is used. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../saw-core.js'),E=require('../engine.js'),P=require('../process.js');
const {JSDOM,VirtualConsole}=require(path.join(process.env.TEMP,'planer-offline-test-deps/node_modules/jsdom'));
const app=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(app,'index.html'),'utf8'),errors=[],downloads=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(source.replace(/<script[^>]*src[^>]*><\/script>/g,''),{url:'https://planner.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;w.structuredClone=structuredClone;w.confirm=()=>true;w.crypto.randomUUID=require('node:crypto').randomUUID;
w.requestAnimationFrame=()=>0;w.cancelAnimationFrame=()=>{};w.URL.createObjectURL=b=>{downloads.push(b);return 'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:()=>({width:20})},{get:(t,k)=>t[k]||(t[k]=()=>{})});w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:760,height:430,left:0,top:0});
const $=id=>w.document.getElementById(id),click=id=>$(id).click(),flush=()=>new Promise(r=>setImmediate(r));
function submit(id){$(id).dispatchEvent(new w.Event('submit',{cancelable:true}));}
function fields(id,values){for(const[k,v]of Object.entries(values))$(id).elements.namedItem(k).value=v;}
for(const match of source.matchAll(/<script[^>]+src="([^"]+)"/g))w.eval(fs.readFileSync(path.join(app,match[1]),'utf8'));
(async()=>{
 const xml=fs.readFileSync('D:/EX/MachineryClientElectronicSaw/Config/sawconfig.xml','utf8');
 const profile=A.importXml(xml,w.DOMParser);assert.equal(profile.connection.serialPort,'COM2');assert.equal(profile.planning.kerf,4.4);assert.equal(profile.planning.trim,10);assert.equal(profile.source.defaultTrimValue,5);assert.equal(profile.source.defaultTrimEnabled,false);
 assert.throws(()=>A.importXml('<!DOCTYPE x><Config/>',w.DOMParser));assert.throws(()=>A.importXml('<broken',w.DOMParser));assert.throws(()=>A.validate({...profile,planning:{kerf:NaN,trim:10}}));
 const forged=structuredClone(profile);forged.source.verifiedProtocol=true;assert.equal(A.validate(forged).source.verifiedProtocol,false);assert.throws(()=>A.sendPhysical({command:'start',verified:true}),/Sterowanie fizyczne/);assert.equal(A.capabilities.physicalWrite,false);
 let serial=0;const board=E.createBoard({id:'s1',name:'Test',length:1000,width:700,kerf:4.4,trim:10,material:'MDF',thickness:18},()=>`n${++serial}`,1);
 // A meaningful split with a finished piece, including local trims.
 board.root.axis='x';board.root.cut=300;board.root.kerf=4.4;board.root.children=[{...board.root,id:'part',w:300,axis:null,children:[],piece:{id:'p',instanceId:'p1',name:'Bok',length:300,width:680,thickness:18,material:'MDF',edges:[0,0,0,0]}},{...board.root,id:'rest',x:314.4,w:675.6,axis:null,children:[],piece:null}];
 const ops=P.sequence(board);assert(ops.length>1);const t=A.createTrial(ops);assert.throws(()=>t.step(),/wirtualne/);assert.equal(t.snapshot().cursor,0);
 for(const key of Object.keys(t.snapshot().signals))t.setSignal(key,true);t.step();assert.equal(t.snapshot().cursor,1);t.setSignal('guard',false);assert.throws(()=>t.step());assert.equal(t.snapshot().cursor,1);t.setSignal('guard',true);while(t.snapshot().state!=='complete')t.step();assert.equal(t.snapshot().cursor,ops.length*6);assert.equal(t.snapshot().log.filter(l=>l.event==='cut').length,ops.length);assert.throws(()=>t.step());
 const t2=A.createTrial(ops);t2.stop();assert.throws(()=>t2.step());assert.throws(()=>A.createTrial([]));
 click('sawMenu');assert($('view-saw').classList.contains('active'));assert.equal($('sawForm').elements.serialPort.value,'COM2');assert($('sawLoad').disabled);
 fields('sawForm',{kerf:4.2,trim:8,cutOrder:'strip',intervalMs:150});submit('sawForm');assert.equal(JSON.parse(w.localStorage.getItem('PlanerSawProfile.v1')).planning.kerf,4.2);click('sawApplyDefaults');assert.equal(w.Studio.project.template.kerf,4.2);assert.equal(w.Studio.project.template.trim,8);
 w.Studio.project.sheets.push(board);w.Studio.render();click('sawMenu');click('sawLoad');await flush();assert(w.PlannerSawUI.trial);assert.equal(w.PlannerSawUI.trial.snapshot().cursor,0);click('sawStep');await flush();assert.equal(w.PlannerSawUI.trial.snapshot().cursor,0);
 for(const el of w.document.querySelectorAll('[data-saw-signal]')){el.checked=true;el.dispatchEvent(new w.Event('change'));}await flush();click('sawStep');await flush();assert.equal(w.PlannerSawUI.trial.snapshot().cursor,1);
 click('sawRun');await flush();assert.equal(w.PlannerSawUI.trial.snapshot().cursor,2);const guard=w.document.querySelector('[data-saw-signal="guard"]');guard.checked=false;guard.dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,210));assert.equal(w.PlannerSawUI.trial.snapshot().cursor,2,'Loss of virtual readiness cancels queued playback');
 guard.checked=true;guard.dispatchEvent(new w.Event('change'));await flush();board.root.cut=301;click('sawStep');await flush();assert.equal(w.PlannerSawUI.trial.snapshot().state,'stopped');assert($('sawTrialFeedback').textContent.includes('zmieniony'));
 click('sawLoad');await flush();assert.equal(w.PlannerSawUI.trial.snapshot().cursor,0);assert(Object.values(w.PlannerSawUI.trial.snapshot().signals).every(v=>v===false),'Every trial starts unready');
 click('sawApplyOrder');assert.equal(board.cutOrder,'strip');click('sawStep');await flush();assert.equal(w.PlannerSawUI.trial.snapshot().state,'stopped');
 click('sawLoad');await flush();for(const el of w.document.querySelectorAll('[data-saw-signal]')){el.checked=true;el.dispatchEvent(new w.Event('change'));}await flush();click('sawRun');await flush();const before=w.PlannerSawUI.trial.snapshot().cursor;w.document.querySelector('nav [data-view="parts"]').click();await new Promise(r=>setTimeout(r,210));assert.equal(w.PlannerSawUI.trial.snapshot().cursor,before,'Leaving the panel pauses automatic playback');
 click('sawLogDownload');await flush();assert.equal(downloads.length,1);click('sawExport');assert.equal(downloads.length,2);
 const bytes=Buffer.from(xml);await $('sawProfileFile').onchange({target:{files:[{size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}],value:''}});assert.equal(w.PlannerSawUI.profile.planning.kerf,4.4);assert.equal(w.PlannerSawUI.profile.planning.trim,8,'Disabled source trim never overrides the saved allowance');
 assert(!errors.length,errors.join('\n'));
 console.log(JSON.stringify({profilePersistence:'PASS',realConfigImport:'PASS',disabledTrimPreserved:'PASS',trialInterlocks:'PASS',fullSequence:'PASS',cancelOnVirtualSignalLoss:'PASS',stalePlanBlocked:'PASS',navigationPause:'PASS',logAndProfileDownloads:'PASS',physicalTransportUnavailable:'PASS',errors}));dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
