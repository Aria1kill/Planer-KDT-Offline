const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {JSDOM,VirtualConsole}=require(path.join(process.env.TEMP,'planer-offline-test-deps/node_modules/jsdom'));
const root=path.resolve(__dirname,'../../docs/analiza/sprzet-etap7'),source=fs.readFileSync(path.join(root,'index.html'),'utf8'),errors=[];
const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(source,{runScripts:'outside-only',url:'file:///'+root.replaceAll('\\','/')+'/index.html',virtualConsole:vc}),w=dom.window,$=id=>w.document.getElementById(id);
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.eval(fs.readFileSync(path.join(root,'js/catalog.js'),'utf8'));
const d=w.SawCatalog.data;assert.equal(d.summary.runtimeFiles,337);assert.equal(d.summary.packageFiles,326);assert.equal(d.libraries.length,22);assert.equal(d.photos.length,207);assert.equal(d.photos.reduce((s,p)=>s+p.sources.length,0),287);assert.equal(d.inventory.length,39);
assert.equal(w.document.querySelectorAll('article').length,39);
$('search').value='ASDA-B2';$('search').dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelectorAll('article').length,1);assert($('content').textContent.includes('Alarm8xxS'));
for(const tab of ['photos','settings','libraries','files','gaps']){w.document.querySelector('[data-tab="'+tab+'"]').click();assert($('content').textContent.length>100);}
w.document.querySelector('[data-tab="photos"]').click();assert.equal(w.document.querySelectorAll('.photo-card').length,207);
$('group').value='Alarm8xxS';$('group').dispatchEvent(new w.Event('change'));assert(w.document.querySelectorAll('.photo-card').length>0);assert([...w.document.querySelectorAll('.photo-card h2')].every(x=>x.textContent.length>0));
$('search').value='ASDA-B2';$('search').dispatchEvent(new w.Event('input'));assert(w.document.querySelectorAll('.photo-card').length>0,'Model names from reviewed evidence are searchable in the photo gallery');
w.document.querySelector('[data-photo]').click();assert($('photoDialog').open);assert($('fullPhoto').getAttribute('src').startsWith('zdjecia/'));$('closePhoto').click();assert(!$('photoDialog').open);
const all=new Set();for(const p of d.photos){assert(!all.has(p.sha256));all.add(p.sha256);for(const name of [p.file,p.thumbnail])assert(fs.existsSync(path.join(root,name)));const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p.file))).digest('hex');assert.equal(hash,p.sha256,'Full-size evidence remains byte-identical');}
for(const match of source.matchAll(/(?:src|href)="([^"]+)"/g)){if(match[1].startsWith('#'))continue;assert(fs.existsSync(path.resolve(root,match[1])),match[1]);}
assert.equal(d.summary.ocr.errors,0);assert.equal(d.bufferLayout.calculatedMarshalledSize,328);assert(!errors.length,errors.join('\n'));
const result={fileManifest663:'PASS',libraries22:'PASS',evidenceCatalog39:'PASS',photoSources287:'PASS',uniquePhotos207:'PASS',allPhotoHashes:'PASS',modelAndFamilySearch:'PASS',allTabs:'PASS',photoViewer:'PASS',embeddedDataNoFetch:'PASS',errors};
fs.writeFileSync(path.join(root,'sprawdzenie.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));dom.window.close();
