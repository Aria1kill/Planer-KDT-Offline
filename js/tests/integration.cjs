/* Isolated DOM tests. No user browser, printer, or network is controlled. */
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {JSDOM,VirtualConsole}=require(path.join(process.env.TEMP,"planer-offline-test-deps/node_modules/jsdom"));
const app=path.resolve(__dirname,"../..");
const errors=[],vc=new VirtualConsole();vc.on("jsdomError",e=>errors.push(e.message));
const html=fs.readFileSync(path.join(app,"index.html"),"utf8").replace(/<script[^>]*src[^>]*><\/script>/g,"");
const dom=new JSDOM(html,{url:"https://planner.test/",runScripts:"outside-only",pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;
w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;w.structuredClone=structuredClone;w.crypto.randomUUID=require("node:crypto").randomUUID;
w.confirm=()=>true;w.alert=msg=>{throw Error(msg);};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
const drawCalls=[],textCalls=[],fillCalls=[],downloads=[];w.URL.createObjectURL=blob=>{downloads.push(blob);return "blob:test";};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){this.dataset.clicked="true";};w.HTMLCanvasElement.prototype.getContext=function(){const id=this.id;let angle=0;const stack=[];const context={setTransform(){angle=0;},save(){stack.push(angle);},restore(){angle=stack.pop()??0;},rotate(value){angle+=value;drawCalls.push({id,angle:value});},fillRect(x,y,width,height){fillCalls.push({id,color:this.fillStyle,x,y,width,height});},fillText(text){textCalls.push({id,text,angle});}};return new Proxy(context,{get:(t,k)=>t[k]||(t[k]=()=>{})});};
w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:760,height:430,left:0,top:0,right:760,bottom:430});
let time=0,frames=[];w.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};w.cancelAnimationFrame=()=>{};
function frame(count=1){for(let i=0;i<count;i++){time+=16;const current=frames;frames=[];current.forEach(fn=>fn(time));}}
const $=id=>w.document.getElementById(id),click=id=>$(id).click();
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function submit(id){$(id).dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));}
function values(id,obj){for(const[k,v]of Object.entries(obj)){const el=$(id).elements.namedItem(k);if(el.type==="checkbox")el.checked=v;else el.value=v;}}
for(const match of fs.readFileSync(path.join(app,"index.html"),"utf8").matchAll(/<script[^>]+src="([^"]+)"/g)){const file=path.resolve(app,match[1]);w.eval(fs.readFileSync(file,"utf8")+"\n//# sourceURL="+path.basename(file));}
(async()=>{
 frame();assert.equal(w.document.querySelectorAll('nav [data-view="simulation"]').length,0);assert($("downloadMcut").disabled);assert.equal(w.Studio.project.parts.length,0);assert.equal(w.Studio.project.sheets.length,0);assert.equal($("emptyPlan").hidden,false);
 click("addBoard");values("boardForm",{name:"Płyta testowa",length:1200,width:800,material:"MDF",thickness:18,qty:1,kerf:4.4,trim:10});submit("boardForm");frame();
 assert.equal(w.Studio.project.stocks.length,1);assert.equal(w.Studio.project.sheets.length,1);assert.equal($("emptyPlan").hidden,true);
 click("addPart");values("partForm",{name:"Bok testowy",length:500,width:300,material:"MDF",thickness:18,qty:2,canRotate:false,code:"TEST001",e1:1,e2:0,e3:0,e4:1});submit("partForm");frame();
 assert.equal(w.Studio.project.parts.length,1);assert.equal(w.PlannerEngine.leaves(w.Studio.board.root).filter(n=>n.piece).length,2);
 // Click the centre of a real placement, then rename and resize it via the form.
 const placement=w.PlannerEngine.leaves(w.Studio.board.root).find(n=>n.piece),transform=w.Studio.drawBoard($("planCanvas"),w.Studio.board);
 $("planCanvas").dispatchEvent(new w.MouseEvent("click",{clientX:transform.x+(placement.x+placement.w/2)*transform.scale,clientY:transform.y+(placement.y+placement.h/2)*transform.scale,bubbles:true}));
 assert($("partDialog").open);assert.equal($("partForm").elements.name.value,"Bok testowy");
 values("partForm",{name:"Bok poprawiony",length:510});submit("partForm");frame();assert.equal(w.Studio.project.parts[0].length,510);assert.equal(w.Studio.project.parts[0].name,"Bok poprawiony");
 // Start empty again, then use the production CSV through the file input event.
 click("newProject");assert.equal(w.Studio.project.sheets.length,0);
 const csv=fs.readFileSync("C:/Users/arthu/OneDrive/Pulpit/Programy/Wzory/OVSyp.csv");
 await $("csvFile").onchange({target:{files:[{name:"OVSyp.csv",arrayBuffer:async()=>csv.buffer.slice(csv.byteOffset,csv.byteOffset+csv.byteLength)}],value:""}});
 assert($("csvDialog").open);assert.equal($("csvPreview").querySelectorAll("tbody tr").length,110);assert($("csvSummary").textContent.includes("Windows-1250"));
 click("confirmCSVOptimize");assert($("optDialog").open);values('optForm',{seconds:'.25'});submit("optForm");frame();await flush();frame();
 for(let i=0;i<200&&$('searchDialog').open;i++){await new Promise(r=>setTimeout(r,20));frame();}
 assert(!$('searchDialog').open,'Search finishes');
 assert.equal(w.Studio.project.parts.length,110);assert(w.Studio.project.sheets.length<=10);assert.equal(w.Studio.project.unplaced.length,2);const packedBoards=w.Studio.project.sheets.length;
 assert($('processWorkspace').contains($('planCanvas'))&&$('processWorkspace').contains($('simulationCanvas')),'Plan and simulation share a workspace');
 assert(w.StudioSimulation.model.ops.some(op=>op.kind==='trim'),'Trims are in the physical process');
 assert.equal($('simCamera').value,'-90','Saw carriage starts at screen bottom');
 const originalOps=w.StudioSimulation.model.ops.map(o=>o.id).join('|');$('simCutOrder').value='strip';$('simCutOrder').dispatchEvent(new w.Event('change'));assert.equal(w.Studio.board.cutOrder,'strip');
 assert.notEqual(w.StudioSimulation.model.ops.map(o=>o.id).join('|'),originalOps,'Per-sheet sequence changes');
 $('simCutOrder').value='parallel';$('simCutOrder').dispatchEvent(new w.Event('change'));
 assert.equal(w.Studio.project.parts.reduce((s,p)=>s+p.qty,0),110);assert(w.Studio.project.parts.some(p=>p.width===413.5));
 assert.equal(w.Studio.project.name,"OVSyp");assert.equal($("statPlaced").textContent,"108");
 // Current-sheet list, previous/next navigation, full fill and downloadable MCUT scopes.
 assert($('boardPartsList').querySelectorAll('[data-sheet-part]').length>0);
 const currentIndex=w.Studio.boardIndex;click('nextBoard');frame();assert.equal(w.Studio.boardIndex,currentIndex+1);click('prevBoard');frame();assert.equal(w.Studio.boardIndex,currentIndex);
 const cutting=w.PlannerProcess.sequence(w.Studio.board).find(o=>w.PlannerEngine.leaves(o.children[0]).some(n=>n.piece));assert(cutting);w.Studio.setActiveOperation(cutting);
 assert($('boardPartsList').querySelector('.cutting'));assert(fillCalls.some(c=>c.id==='planCanvas'&&c.color==='#ffd298'&&c.width>1&&c.height>1));
 click('showMcutCode');assert($('mcutCodeDialog').open);assert($('mcutCodeContent').textContent.includes('<labelData'));assert($('mcutCodeContent').textContent.includes('Barcode(Code)'));
 click('downloadMcut');assert($('downloadMcutDialog').open);$('downloadMcutFormat').value='current';assert.equal($('downloadMcutScope').options.length,2);click('confirmDownloadMcut');await flush();assert.equal(downloads.length,1);
 click('downloadMcut');$('downloadMcutScope').value='all';$('downloadMcutScope').dispatchEvent(new w.Event('change'));click('confirmDownloadMcut');await flush();assert.equal(downloads.length,2);
 const sourceProject=w.Studio.project,one=w.PlannerMcutPreview.download(sourceProject,[w.Studio.board]),all=w.PlannerMcutPreview.download(sourceProject,sourceProject.sheets);
 const oneImported=w.PlannerFiles.readMcut(one),allImported=w.PlannerFiles.readMcut(all);
 assert.equal(oneImported.sheets.length,1);assert.equal(allImported.sheets.length,sourceProject.sheets.length);assert.equal(allImported.parts.length,108);
 const expected=sourceProject.sheets.flatMap(b=>w.PlannerEngine.leaves(b.root).filter(n=>n.piece).map(n=>n.piece)),actual=allImported.parts;
 const key=p=>[p.name,p.code,p.length,p.width,p.material,p.thickness,p.edges.join(','),JSON.stringify(p.raw)].join('|');assert.deepEqual(actual.map(key).sort(),expected.map(key).sort());
 for(let i=0;i<sourceProject.sheets.length;i++){const a=w.PlannerProcess.sequence(sourceProject.sheets[i]),b=w.PlannerProcess.sequence(allImported.sheets[i]);assert.equal(a.length,b.length);assert.deepEqual(a.map(o=>[o.axis,+o.cut.toFixed(4),+o.kerf.toFixed(4),o.kind]),b.map(o=>[o.axis,+o.cut.toFixed(4),+o.kerf.toFixed(4),o.kind]));}
 $('mcutCodeDialog').close();
 // Full label data, physical dimensions, edge indications, real Code128.
 const coded=w.Studio.project.parts.find(p=>p.code);const label=w.PlannerLabels.labelHTML(coded,w.Studio.project,{width:80,height:60,style:"auto"});
 assert(label.includes("width:80mm;height:60mm"));assert(label.includes("ASLaz")||label.includes("<svg"));assert(label.includes(coded.code));assert(label.includes(coded.name));
 const noCode={...coded,code:"",edges:[1,0,0,0]};const noCodeLabel=w.PlannerLabels.labelHTML(noCode,w.Studio.project,{width:80,height:60,style:"auto"});
 assert(noCodeLabel.includes(w.Studio.project.orderName||w.Studio.project.name));assert(!noCodeLabel.includes('aria-label="'+noCode.code+'"'));assert.equal((noCodeLabel.match(/<line /g)||[]).length,1);
 assert(w.PlannerLabels.dataHTML(coded).includes("Wszystkie kolumny źródłowe CSV"));
 // Import a real editable LBLD into the main label screen and preserve it in the project.
 w.Studio.setView('labels');const importedTemplate=w.PlannerLbldPresets.make({}),titleIndex=importedTemplate.items.length;
 importedTemplate.add('text');const title=importedTemplate.editable(titleIndex);importedTemplate.set(title,'_displayText','SZABLON TESTOWY');for(const k of title.meta.names.filter(k=>k.endsWith('+_dataSourse')||k.endsWith('+_dataSourseInside')))importedTemplate.set(title,k,null);
 const templateBytes=importedTemplate.save();await $('labelTemplateFile').onchange({target:{files:[{name:'Moj-szablon.lbld',arrayBuffer:async()=>templateBytes.buffer.slice(templateBytes.byteOffset,templateBytes.byteOffset+templateBytes.byteLength)}],value:''}});
 assert($('labelImportDialog').open);click('confirmLabelImport');await flush();assert.equal(w.Studio.project.labels.customTemplates.length,1);assert($('labelPreview').textContent.includes('SZABLON TESTOWY'));
 const forcedOrder=w.PlannerLabels.labelHTML(coded,w.Studio.project,{...w.Studio.project.labels,width:80,height:60,style:'project'});assert(!forcedOrder.includes('aria-label="'+coded.code+'"'));assert(!forcedOrder.includes('Kod: '));
 const activeTemplate=w.Studio.project.labels.activeTemplate;assert.notEqual(activeTemplate,'ibron');click('labelNext');await flush();assert($('labelPreview').textContent.includes('SZABLON TESTOWY'));
 const printMarkup=w.PlannerLabels.labelHTML(coded,w.Studio.project,{...w.Studio.project.labels,width:80,height:60,style:'auto'});assert(printMarkup.includes('SZABLON TESTOWY'));
 $('orderName').value='Zamówienie próbne';$('orderName').dispatchEvent(new w.Event('change'));assert.equal(w.Studio.project.orderName,'Zamówienie próbne');
 const restored=JSON.parse(JSON.stringify(w.Studio.project));assert.equal(restored.labels.activeTemplate,activeTemplate);assert(restored.labels.customTemplates[0].base64.length>100);
 $('labelTemplatePicker').value='ibron';$('labelTemplatePicker').dispatchEvent(new w.Event('change'));const emptyCode=w.PlannerLabels.labelHTML({...coded,code:'   '},w.Studio.project,{...w.Studio.project.labels,width:80,height:60,style:'auto'});assert(emptyCode.includes('Zamówienie próbne'));assert(!emptyCode.includes('aria-label="'+coded.code+'"'));assert(!emptyCode.includes('Kod: '));
 // Animation progresses, retrieves stored strips and includes a real rotation phase.
 w.Studio.setView("simulation");frame();click("simPlay");frame(3000);click("simPlay");
 assert(!errors.length,errors.join("\n"));assert($("simCounter").textContent!=="1 / 0");assert(drawCalls.some(x=>x.id==="simulationCanvas"&&Math.abs(x.angle)>.1));
 $('simCamera').value='0';$('simCamera').dispatchEvent(new w.Event('change'));w.StudioSimulation.draw();$('simCamera').value='-90';$('simCamera').dispatchEvent(new w.Event('change'));w.StudioSimulation.draw();
 const fragmentLabels=textCalls.filter(x=>x.id==='simulationCanvas'&&x.text.includes('×'));assert(fragmentLabels.length>10);assert(fragmentLabels.every(x=>Math.abs(Math.sin(x.angle))<1e-6&&Math.cos(x.angle)>.999999),'Fragment labels stay upright for both camera views and all rotations');assert(fragmentLabels.every(x=>!x.text.includes('physical-auto-')),'Intermediate labels use short names');assert(fillCalls.some(c=>c.id==='simulationCanvas'&&c.color==='#ffd298'),'Whole cut-off fragment is filled on machine view');
 $('simCutOrder').value='strip';$('simCutOrder').dispatchEvent(new w.Event('change'));const saved=JSON.stringify(w.Studio.project);click("newProject");
 await $("projectFile").onchange({target:{files:[{name:"OVSyp.rozkroj.json",arrayBuffer:async()=>new TextEncoder().encode(saved).buffer}],value:""}});
 frame();assert.equal(w.Studio.project.parts.length,110);assert.equal(w.Studio.project.sheets.length,packedBoards);assert.equal(w.Studio.board.cutOrder,'strip');assert.equal($('simCutOrder').value,'strip');
 // Both label exports generate real NRBF binary templates.
 click('downloadLbld');await flush();assert.equal(downloads.length,3);w.PlannerLabelRaster.png=async()=>new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1kAAAAASUVORK5CYII=','base64'));click('downloadFixedLbld');await flush();await flush();assert.equal(downloads.length,4);
 // Existing MCUT sample still opens and produces its 22 final elements.
 const mcut=fs.readFileSync(path.join(app,"przyklady/Przyklad.mcut"),"utf8");const imported=w.PlannerFiles.readMcut(mcut);
 assert.equal(imported.parts.length,22);assert.equal(imported.sheets.length,1);
 assert.equal(imported.parts.reduce((s,p)=>s+p.qty,0),22);assert.equal(w.PlannerMcutPreview.download(imported,imported.sheets,'original'),mcut,'Native original download is byte-identical');
 const process=w.PlannerProcess,model=process.compile(imported.sheets[0]);assert.equal(model.ops.filter(op=>op.kind==='trim').length,3);
 for(const frame of model.frames){const op=frame.op,c=process.center(op.source),point=process.cutPoint(op),v=process.rotate(point.x-c.x,point.y-c.y,frame.cutPose.angle);assert(Math.abs(frame.cutPose.y+v.y)<.001,'Actual cut reaches the fixed saw line');
  const axis=op.axis==='x'?op.source.w:op.source.h;assert(frame.infeed.y+axis/2<0,'Whole fragment enters behind saw before it is pulled out');
  for(const [index,out]of frame.outputs.entries()){const length=op.axis==='x'?out.node.w:out.node.h;if(index===0)assert(Math.abs(out.start.y-length/2-op.kerf/2)<.001,'First child exits towards operator');else assert(Math.abs(out.start.y+length/2+op.kerf/2)<.001,'Remaining child stays behind saw');}
 }
 console.log(JSON.stringify({labelTemplateImport:'PASS',templateProjectPersistence:'PASS',emptyCodeOrderName:'PASS',sheetList:'PASS',sheetNavigation:'PASS',wholePartHighlight:'PASS',MCUTWindow:'PASS',MCUTDownloadOneAndAll:'PASS',MCUT108DataRoundTrip:'PASS',LBLDDownloads:'PASS',emptyStart:"PASS",boards:"PASS",clickEdit:"PASS",CSV110:"PASS",layout108Max10:"PASS",packedBoards,labels80x60:"PASS",rotation:"PASS",saveRestore:"PASS",MCUT22:"PASS",perSheetSequence:'PASS',infeedThenOutfeed:'PASS',errors}));
 w.close();
})().catch(err=>{console.error(err);w.close();process.exitCode=1;});
