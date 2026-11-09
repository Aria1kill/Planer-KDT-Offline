/* Independent binary round trips and the MCUT -> editor -> resolved LBLD workflow. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require(path.join(process.env.TEMP,'planer-offline-test-deps/node_modules/jsdom'));
const app=path.resolve(__dirname,'../..'),out=path.join(app,'etykiety/IBRON-80x60'),exportDir=path.join(app,'eksport/mcut');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(exportDir,{recursive:true});
const errors=[],downloads=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const html=fs.readFileSync(path.join(app,'narzedzia/edytor-lbld.html'),'utf8').replace(/<script[^>]*src[^>]*><\/script>/g,'');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://labels.test/',virtualConsole:vc}),w=dom.window;
w.TextDecoder=TextDecoder;w.TextEncoder=TextEncoder;w.structuredClone=structuredClone;w.Blob=Blob;w.confirm=()=>true;
w.URL.createObjectURL=b=>{downloads.push(b);return'blob:test';};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
for(const match of fs.readFileSync(path.join(app,'narzedzia/edytor-lbld.html'),'utf8').matchAll(/<script[^>]+src="([^"]+)"/g))w.eval(fs.readFileSync(path.resolve(app,'narzedzia',match[1]),'utf8'));
for(const file of ['process.js','mcut-preview.js'])w.eval(fs.readFileSync(path.join(app,'js',file),'utf8'));
const {Resvg}=require(path.join(process.env.TEMP,'planer-render-deps/node_modules/@resvg/resvg-js'));w.PlannerLabelRaster.png=async svg=>new Uint8Array(new Resvg(svg,{fitTo:{mode:'width',value:945},font:{loadSystemFonts:true}}).render().asPng());
const $=id=>w.document.getElementById(id),click=id=>$(id).click();
(async()=>{
 for(const name of ['LabelExample.lbld','LabelExample_En.lbld']){const bytes=fs.readFileSync('D:/EX/KDT_PreSize_New-Setup-V3.0.1.9/LabelExample/'+name),doc=w.LBLD.read(bytes);assert.equal(Buffer.compare(Buffer.from(doc.originalRoundTrip()),bytes),0,'Unedited source stays byte-identical');const edited=doc.editable(1);doc.set(edited,'_displayText','Półka — próba 413.5 mm');doc.duplicate(1);doc.remove(0);assert.equal(w.LBLD.read(doc.save()).items.length,doc.items.length);}
 for(const [name,options]of [['IBRON-80x60-Code128.lbld',{}],['IBRON-80x60-QR.lbld',{barcode:'qr'}],['IBRON-80x60-bez-kodu.lbld',{style:'project'}],['Przyklad-Plecy-dane-stale.lbld',{fixed:true}]]){const doc=w.PlannerLbldPresets.make(options),bytes=doc.save(),again=w.LBLD.read(bytes);assert(again.items.length>=7);fs.writeFileSync(path.join(out,name),bytes);
  if(!options.barcode&&options.style!=='project'){const code=again.shapes().find(s=>s.node.meta.name==='LabelDesign.Code').node;assert.equal(again.get(again.get(code,'_codeType'),'value__'),16);assert.equal(again.get(again.get(code,'_orientation'),'value__'),0);}
  if(options.fixed)for(const {node}of again.shapes()){assert(!again.get(node,'BindingShape+_dataSourse'));assert(!again.get(node,'BindingShape+_dataSourseInside'));}
 }
 assert.equal(w.LabelEditor.document.items.length,7);assert.equal($('labelCanvas').querySelectorAll('[data-shape]').length,7);assert($('labelCanvas').querySelector('path'));
 click('addText');assert.equal(w.LabelEditor.document.items.length,8);click('undo');assert.equal(w.LabelEditor.document.items.length,7);click('redo');assert.equal(w.LabelEditor.document.items.length,8);
 click('loadIBRON');assert($('labelCanvas').querySelector('[aria-label="ASLaz0000001"]'));assert(!$('addCode').disabled);const templateCount=w.LabelEditor.document.items.length;click('addCode');assert.equal(w.LabelEditor.document.items.length,templateCount+1);click('deleteShape');assert.equal(w.LabelEditor.document.items.length,templateCount);
 const project=JSON.parse(fs.readFileSync(path.join(app,'przyklady/OVSyp-9-plyt.rozkroj.json'),'utf8'));
 const text=w.PlannerMcutPreview.download(project,project.sheets),first=w.PlannerMcutPreview.download(project,[project.sheets[0]]);fs.writeFileSync(path.join(exportDir,'OVSyp-calosc-test.mcut'),text);fs.writeFileSync(path.join(exportDir,'OVSyp-plyta-1-test.mcut'),first);
 const xml=new w.DOMParser().parseFromString(text,'application/xml');assert(!xml.querySelector('parsererror'));assert.equal(xml.querySelectorAll('labelData > label').length,108);
 const bytes=new TextEncoder().encode(text);await $('labelDataFile').onchange({target:{files:[{name:'OVSyp-calosc-test.mcut',arrayBuffer:async()=>bytes.buffer}],value:''}});
 assert.equal($('labelDataPart').options.length,108);assert.equal($('previewMode').value,'sample');assert(!$('labelCanvas').innerHTML.includes('{Barcode(Code)}'));
 const label=xml.querySelector('labelData > label'),values=Object.fromEntries([...label.querySelectorAll('field')].map(n=>[n.getAttribute('name'),n.textContent]));
 assert.equal(values.Code,values['Barcode(Code)']);assert.equal(values.PartLength,values['Length(L)']);assert.equal(values.PartWidth,values['Width(W)']);
 await $('saveResolvedLabel').onclick();if(!downloads.length)throw Error($('editorMessage').textContent);assert.equal(downloads.length,1);const saved=new Uint8Array(await downloads[0].arrayBuffer()),doc=w.LBLD.read(saved);assert.equal(doc.items.length,1);assert.equal(doc.shape(0).meta.name,'LabelDesign.Image');const image=w.PlannerLbldGraphics.info(doc,doc.shape(0));assert(image.url.startsWith('data:image/png;base64,'));fs.writeFileSync(path.join(out,'OVSyp-pierwszy-element-dane-stale.lbld'),saved);
 const codeIndex=w.LabelEditor.document.shapes().find(s=>s.node.meta.name==='LabelDesign.Code').index;$('shapeList').querySelector('[data-select="'+codeIndex+'"]').click();$('shapeWidth').value=180;$('propertiesForm').dispatchEvent(new w.Event('submit',{cancelable:true}));assert.equal(w.LabelEditor.document.get(w.LabelEditor.document.get(w.LabelEditor.document.shape(codeIndex),'Shape+_sizef'),'width'),180);
 const codeName=values.Code;values.Code='ŻÓŁĆ';assert.throws(()=>w.PlannerLbldPresets.make({values}),/ASCII/);values.Code=codeName;
 fs.writeFileSync(path.join(out,'mapowanie-pol.json'),JSON.stringify({format:'PlanerLabels/1',paperMm:{width:80,height:60},fields:w.PlannerLabelData.fields,aliases:{'Barcode(Code)':'Code','Length(L)':'PartLength','Width(W)':'PartWidth'},nativeKdtDataImportVerified:false,nativeKdtVisualRenderingVerified:false},null,2));
 fs.writeFileSync(path.join(app,'docs/analiza/lbld-editor-tests/podglad-IBRON.svg'),$('labelCanvas').outerHTML);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({sourceByteRoundTrips:2,nativePresets:4,code128Enum:'PASS',MCUTLabels:108,MCUTToFixedLBLD:'PASS',unicodeNames:'PASS',codeEditing:'PASS',errors}));w.close();
})().catch(error=>{console.error(error);w.close();process.exitCode=1;});
