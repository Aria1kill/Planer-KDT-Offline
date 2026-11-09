(function(){
 "use strict";
 const E=PlannerEngine,L=PlannerLabels,$=id=>document.getElementById(id),e=E.escape,f=E.fmt;
 const fresh=()=>({format:"PlanerOffline",version:3,name:"Nowy projekt",parts:[],stocks:[],sheets:[],unplaced:[],auto:true,optimizationSettings:{seconds:8,priority:'balanced'},template:{length:2800,width:2070,kerf:4.4,trim:10},labels:{width:80,height:60,style:"auto",customTemplates:[],activeTemplate:"ibron"}});
 let P=fresh(),boardIndex=0,selected=null,editPartId=null,editStockId=null,pendingCSV=null,labelIndex=0,view="plan",dirty=false,toastTimer=0;
 let planTransform=null,activeOperation=null,activePartIds=new Set(),currentCode='',pendingLabelTemplate=null;
 const uid=prefix=>prefix+"-"+crypto.randomUUID();
 const searchFields=document.createElement('div');searchFields.className='form-grid';searchFields.innerHTML='<label>Dokładność poszukiwania<select name="seconds"><option value=".25">Szybko · 0,25 s</option><option value="8" selected>Dokładnie · około 8 s</option><option value="25">Bardzo dokładnie · około 25 s</option><option value="60">Długie poszukiwanie · około 60 s</option></select></label><label>Priorytet<select name="priority"><option value="balanced">Mało płyt i mało przekładania</option><option value="waste">Najmniejsza powierzchnia zużytych płyt</option><option value="work">Mało płyt, potem najmniej pracy</option></select></label><p class="small-note wide">Porównywane są różne kolejności elementów, kierunki podziału, sposoby dopasowania oraz zmiany fragmentów najlepszego układu. Wynik obejmuje brzegowania, obroty pasów i długość cięć. Dłuższe szukanie nie gwarantuje matematycznego optimum.</p>';$('optGroups').before(searchFields);
 $('stopSearch').onclick=()=>PlannerSearch.stop();$('searchDialog').addEventListener('cancel',ev=>{ev.preventDefault();PlannerSearch.stop();});
 const num=v=>E.number(v),currentBoard=()=>P.sheets[boardIndex]||null,partById=id=>P.parts.find(p=>p.id===id);
 function toast(text){$("toast").textContent=text;$("toast").classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").classList.remove("show"),5000);}
 function on(id,fn){$(id).addEventListener("click",async ev=>{try{await fn(ev);}catch(err){toast(err.message);console.error(err);}});}
 function changed(){dirty=true;$("saveState").textContent="Zmiany niezapisane";}
 function setView(v){view=v==='simulation'?'plan':v;document.querySelectorAll(".view").forEach(n=>n.classList.toggle("active",n.id==="view-"+view));document.querySelectorAll("nav button[data-view]").forEach(n=>n.classList.toggle("active",n.dataset.view===v));document.body.classList.toggle('simulation-focus',v==='simulation');if(v==="labels")renderLabels();else if(view!=='plan')window.StudioSimulation?.stop();requestAnimationFrame(()=>{drawPlan();window.StudioSimulation?.render();});}
 function normalizePart(p){return{...p,qty:num(p.qty)||1,edges:[0,1,2,3].map(i=>num(p.edges?.[i])),canRotate:p.canRotate!==false,raw:p.raw||[]};}
 function blankBoards(stock){return Array.from({length:stock.qty},(_,i)=>E.createBoard(stock,()=>uid("n"),i+1));}
 function render(){
  P.sheets.forEach(b=>PlannerProcess.invalidate(b));
  $("projectName").value=P.name;$("orderName").value=P.orderName||"";$("orderName").placeholder=P.name;$("partsBadge").textContent=P.parts.length;
  const total=P.parts.reduce((s,p)=>s+p.qty,0),placed=P.sheets.reduce((s,b)=>s+E.leaves(b.root).filter(n=>n.piece).length,0);
  $("projectSummary").textContent=P.parts.length+" pozycji · "+total+" szt. · "+P.sheets.length+" płyt";
  $("statBoards").textContent=P.sheets.length;$("statPlaced").textContent=placed;
  const area=P.sheets.reduce((s,b)=>s+b.length*b.width,0),used=P.sheets.reduce((s,b)=>s+E.leaves(b.root).reduce((a,n)=>a+(n.piece?n.w*n.h:0),0),0);
  $("statYield").textContent=area?(100*used/area).toFixed(1)+"%":"—";$("statMissing").textContent=P.unplaced.length;
  boardIndex=Math.max(0,Math.min(boardIndex,P.sheets.length-1));
  const options=P.sheets.length?P.sheets.map((b,i)=>'<option value="'+i+'">'+e(b.name)+" · "+f(b.length)+" × "+f(b.width)+" · "+e(b.material||"Nieprzypisany")+' / '+f(b.thickness)+' mm</option>').join(""):'<option value="">Brak płyt</option>';
  $("sheetPicker").innerHTML=options;$("sheetPicker").value=String(boardIndex);
  $('prevBoard').disabled=!P.sheets.length||boardIndex===0;$('nextBoard').disabled=!P.sheets.length||boardIndex===P.sheets.length-1;$('showMcutCode').disabled=!currentBoard();$('downloadMcut').disabled=!currentBoard();$('boardPosition').textContent=P.sheets.length?(boardIndex+1)+' / '+P.sheets.length:'0 / 0';
  $("simSheetPicker").innerHTML=options;$("simSheetPicker").value=String(boardIndex);
  $("boardList").innerHTML=P.sheets.length?P.sheets.map((b,i)=>'<div class="board-row '+(i===boardIndex?"active":"")+'" data-board="'+i+'"><b>'+e(b.name)+'</b><small>'+f(b.length)+' × '+f(b.width)+' · '+e(b.material||"Nieprzypisany")+' · '+f(b.thickness)+' mm</small></div>').join(""):'<div class="card-body muted">Nie dodano jeszcze płyt.</div>';
  $("boardList").querySelectorAll("[data-board]").forEach(n=>n.onclick=()=>selectBoard(Number(n.dataset.board)));
  $("issuesPanel").classList.toggle("hidden",!P.unplaced.length);
  $("issuesList").innerHTML=P.unplaced.map(x=>'<div><b>'+e(x.piece.name)+'</b> · '+f(x.piece.length)+' × '+f(x.piece.width)+' — '+e(x.reason)+'</div>').join("");
  $("emptyPlan").hidden=!!currentBoard();$("boardCaption").textContent=currentBoard()?f(currentBoard().length)+" × "+f(currentBoard().width)+" mm":"Dodaj pierwszą płytę";
  renderTable();renderSelection();renderBoardParts();requestAnimationFrame(drawPlan);window.StudioSimulation?.reset(false);if($('mcutCodeDialog').open)renderCodeWindow();
 }
 function selectBoard(i){boardIndex=i;selected=null;render();if(view==="labels")renderLabels();}
 function renderBoardParts(){
  const leaves=currentBoard()?E.leaves(currentBoard().root).filter(n=>n.piece):[],groups=new Map();for(const n of leaves){const p=n.piece,row=groups.get(p.id)||{p,count:0,active:false};row.count++;row.active||=activePartIds.has(p.instanceId);groups.set(p.id,row);}
  $('boardPartCount').textContent=leaves.length+' szt. / '+groups.size+' poz.';$('boardPartsList').innerHTML=groups.size?[...groups.values()].map(({p,count,active})=>'<button type="button" class="sheet-part-row '+(active?'cutting ':'')+(selected===p.id?'selected':'')+'" data-sheet-part="'+e(p.id)+'"><span class="part-row-head"><b>'+e(p.name)+'</b><strong>'+count+' szt.</strong></span><span>'+f(p.length)+' × '+f(p.width)+' mm'+(active?' <em>W cięciu</em>':'')+'</span><small>'+e(p.code||'Bez kodu')+'</small></button>').join(''):'<div class="card-body muted">Na tej płycie nie ma jeszcze elementów.</div>';
  $('boardPartsList').querySelectorAll('[data-sheet-part]').forEach(button=>{button.onclick=()=>{selected=button.dataset.sheetPart;renderSelection();drawPlan();renderBoardParts();document.querySelector('.selection-card').open=true;};button.ondblclick=()=>showPart(button.dataset.sheetPart);});
 }
 function renderCodeWindow(){const b=currentBoard();if(!b)return;const original=PlannerMcutPreview.original(P,b),option=$('mcutCodeMode').querySelector('[value="original"]');option.disabled=!original;if(!original&&$('mcutCodeMode').value==='original')$('mcutCodeMode').value='current';const isOriginal=$('mcutCodeMode').value==='original',preview=PlannerMcutPreview.build(b,activeOperation,P);currentCode=isOriginal?original:$('mcutCodeMode').value==='native'?PlannerMcutNative.build(P,[b]).text:preview.text;
  $('mcutCodeCaption').textContent=(boardIndex+1)+' / '+P.sheets.length+' · '+b.name+' · '+f(b.length)+' × '+f(b.width)+' mm';$('mcutCodeNote').textContent=isOriginal?'Oryginalny zapis tej płyty z wczytanego MCUT. Późniejsze zmiany w planerze pokazuje widok „Bieżący plan”.':'XML podglądowy bieżącej płyty z jawnymi osiami, brzegowaniami i kolejnością operacji. To zapis do analizy; nie jest zatwierdzonym eksportem do sterownika KDT.';if($('mcutCodeMode').value==='native')$('mcutCodeNote').textContent='MCUT w strukturze oryginalnego przykładu. Dane dodatkowe etykiet są dostępne w pakiecie ZIP. Zgodność odczytu w docelowym PreSize wymaga próby.';$('mcutCodeStatus').textContent='';
  $('mcutCodeContent').innerHTML=currentCode.split(/\r?\n/).map((line,index)=>'<span class="code-line '+($('mcutCodeMode').value==='current'&&index===preview.activeLine?'current-code-line':'')+'">'+e(line)+'</span>').join('');
 }
 function renderSelection(){
  const p=partById(selected);$("selectionActions").hidden=!p;$("selectionId").textContent=p?"#"+(P.parts.indexOf(p)+1):"—";
  $("selectionDetails").innerHTML=p?L.dataHTML(p):currentBoard()?'<div class="data-grid"><div class="datum wide"><span>Płyta</span><b>'+e(currentBoard().name)+'</b></div><div class="datum"><span>Materiał</span><b>'+e(currentBoard().material||"—")+'</b></div><div class="datum"><span>Grubość</span><b>'+f(currentBoard().thickness)+' mm</b></div><div class="datum"><span>Rzaz</span><b>'+f(currentBoard().kerf)+' mm</b></div><div class="datum"><span>Brzegowanie</span><b>'+f(currentBoard().trim)+' mm</b></div></div>':'Kliknij element na planie lub na liście.';
 }
 function renderTable(){
  const query=$("partsSearch").value.toLowerCase(),parts=P.parts.filter(p=>(p.name+" "+p.code+" "+p.material).toLowerCase().includes(query));
  $("partCount").textContent=parts.length+" pozycji / "+P.parts.reduce((s,p)=>s+p.qty,0)+" szt.";
  $("partsTable").querySelector("tbody").innerHTML=parts.map(p=>'<tr data-part="'+e(p.id)+'" class="'+(!p.material||!p.thickness?"attention":"")+'"><td>'+e(p.name)+'</td><td>'+e(p.material||"Nieprzypisany")+'</td><td>'+f(p.thickness)+'</td><td>'+f(p.length)+'</td><td>'+f(p.width)+'</td><td>'+p.qty+'</td><td>'+(p.canRotate?"Tak":"Nie")+'</td>'+p.edges.map(v=>'<td class="'+(v?"edge-cell":"")+'">'+f(v)+'</td>').join("")+'<td>'+e(p.code||"—")+'</td><td>'+e(p.raw.slice(11).filter(Boolean).join(" | ")||"—")+'</td><td><button data-edit="'+e(p.id)+'">Edytuj</button> <button data-delete="'+e(p.id)+'">Usuń</button></td></tr>').join("");
  $("partsTable").querySelectorAll("tr[data-part]").forEach(tr=>tr.ondblclick=()=>showPart(tr.dataset.part));
  $("partsTable").querySelectorAll("[data-edit]").forEach(n=>n.onclick=()=>showPart(n.dataset.edit));
  $("partsTable").querySelectorAll("[data-delete]").forEach(n=>n.onclick=()=>{const p=partById(n.dataset.delete);if(confirm("Usunąć pozycję „"+p.name+"” i wszystkie jej sztuki?")){P.parts=P.parts.filter(x=>x.id!==p.id);selected=null;if(P.sheets.some(b=>E.leaves(b.root).some(n=>n.piece)))runOptimize();else render();changed();}});
 }
 function fitCanvas(canvas,b,pad=35){
  const r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return null;const dpr=devicePixelRatio||1;canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle="#f6f9fc";ctx.fillRect(0,0,r.width,r.height);
  ctx.fillStyle="#dfe8f2";for(let x=14;x<r.width;x+=20)for(let y=14;y<r.height;y+=20)ctx.fillRect(x,y,1,1);
  if(!b)return null;const scale=Math.min((r.width-2*pad)/b.length,(r.height-2*pad)/b.width);
  return{ctx,scale,x:(r.width-b.length*scale)/2,y:(r.height-b.width*scale)/2,w:r.width,h:r.height};
 }
 function drawBoard(canvas,b,activeNode=null){
  const t=fitCanvas(canvas,b,canvas.id==="miniCanvas"?20:37);if(!t)return null;const{ctx,scale:s,x:ox,y:oy}=t;
  ctx.fillStyle="#e6ebf1";ctx.fillRect(ox,oy,b.length*s,b.width*s);
  const ls=E.leaves(b.root);
  for(const n of ls){const x=ox+n.x*s,y=oy+n.y*s,w=n.w*s,h=n.h*s,cutting=n.piece&&activePartIds.has(n.piece.instanceId);ctx.fillStyle=n.piece?(cutting?'#ffd298':selected===n.piece.id?'#d6eaff':'#b8ddf3'):"#eaf0f6";ctx.fillRect(x,y,w,h);ctx.strokeStyle=cutting?'#e78b2e':n.piece?"#7aa6c6":"#c6d3e1";ctx.lineWidth=cutting?1.5:.7;ctx.strokeRect(x,y,w,h);
   if(n.piece){const p=n.piece,edges=p.rotated?[p.edges[2],p.edges[3],p.edges[1],p.edges[0]]:[p.edges[0],p.edges[1],p.edges[2],p.edges[3]];
    ctx.strokeStyle="#2ca752";ctx.lineWidth=2.5;[[x,y,x+w,y],[x,y+h,x+w,y+h],[x,y,x,y+h],[x+w,y,x+w,y+h]].forEach((line,i)=>{if(edges[i]){ctx.beginPath();ctx.moveTo(line[0],line[1]);ctx.lineTo(line[2],line[3]);ctx.stroke();}});
    if(w>45&&h>20){ctx.save();ctx.beginPath();ctx.rect(x+2,y+2,w-4,h-4);ctx.clip();ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#315d83";const lines=canvas.id==="miniCanvas"?[p.name]:$("showAllData").checked?[p.name,f(p.length)+" × "+f(p.width)+" mm",p.code,p.material+" · "+f(p.thickness)+" mm"].filter(Boolean):[p.name,f(p.length)+" × "+f(p.width)];
     const size=Math.max(8,Math.min(12,w/Math.max(...lines.map(a=>String(a).length))*.95));ctx.font=size+"px Segoe UI,Arial";const count=Math.min(lines.length,Math.floor(h/(size+3)));lines.slice(0,count).forEach((line,i)=>ctx.fillText(line,x+w/2,y+h/2+(i-(count-1)/2)*(size+3)));ctx.restore();}
    if(p.id===selected){ctx.strokeStyle="#ef9448";ctx.lineWidth=2.5;ctx.strokeRect(x,y,w,h);}
   }
  }
  ctx.strokeStyle="#557a9e";ctx.lineWidth=1;ctx.strokeRect(ox,oy,b.length*s,b.width*s);ctx.fillStyle="#849bb8";ctx.font="10px Segoe UI,Arial";ctx.textAlign="center";ctx.fillText(f(b.length)+" mm",ox+b.length*s/2,oy-10);ctx.save();ctx.translate(ox-12,oy+b.width*s/2);ctx.rotate(-Math.PI/2);ctx.fillText(f(b.width)+" mm",0,0);ctx.restore();
  if(activeNode){ctx.strokeStyle="#ef8d3e";ctx.lineWidth=2;ctx.strokeRect(ox+activeNode.x*s,oy+activeNode.y*s,activeNode.w*s,activeNode.h*s);}
  return t;
 }
 function drawPlan(){const target=activeOperation?.children[0];planTransform=drawBoard($("planCanvas"),currentBoard(),target);if(!planTransform||!activeOperation)return;const {ctx,scale:s,x,y}=planTransform,o=activeOperation,n=o.source;if(target){ctx.fillStyle=o.kind==='trim'?'#f3a24955':'#f3a24922';ctx.fillRect(x+target.x*s,y+target.y*s,target.w*s,target.h*s);}ctx.fillStyle=o.kind==='trim'?'#e58c38aa':'#df6f28cc';if(o.axis==='x')ctx.fillRect(x+(n.x+o.cut)*s,y+n.y*s,Math.max(2,o.kerf*s),n.h*s);else ctx.fillRect(x+n.x*s,y+(o.fromEnd?n.y+n.h-o.cut-o.kerf:n.y+o.cut)*s,n.w*s,Math.max(2,o.kerf*s));}
 function hit(ev){if(!planTransform||!currentBoard())return null;const r=$("planCanvas").getBoundingClientRect(),x=(ev.clientX-r.left-planTransform.x)/planTransform.scale,y=(ev.clientY-r.top-planTransform.y)/planTransform.scale;return E.leaves(currentBoard().root).filter(n=>n.piece).reverse().find(n=>x>=n.x&&x<=n.x+n.w&&y>=n.y&&y<=n.y+n.h);}
 $("planCanvas").addEventListener("click",ev=>{const n=hit(ev);selected=n?.piece.id||null;renderSelection();renderBoardParts();drawPlan();if(n)showPart(n.piece.id);else if(planTransform&&currentBoard()){const r=$("planCanvas").getBoundingClientRect(),x=(ev.clientX-r.left-planTransform.x)/planTransform.scale,y=(ev.clientY-r.top-planTransform.y)/planTransform.scale;if(x>=0&&y>=0&&x<=currentBoard().length&&y<=currentBoard().width)showBoard(true);}});
 $("planCanvas").addEventListener("mousemove",ev=>{const n=hit(ev),tip=$("hoverInfo");if(!n){tip.hidden=true;return;}const p=n.piece;tip.innerHTML='<strong>'+e(p.name)+'</strong><div>'+f(p.length)+' × '+f(p.width)+' × '+f(p.thickness)+' mm · '+e(p.material||"—")+'</div><div>Kod: '+e(p.code||"—")+' · szt. '+p.qty+'</div><div>Oklejanie D1/D2/S1/S2: '+p.edges.map(f).join(" / ")+'</div><div>Obrót: '+(p.canRotate?"dozwolony":"zablokowany")+' · na płycie: '+(p.rotated?"90°":"0°")+'</div>';tip.hidden=false;tip.style.left=Math.min(innerWidth-320,ev.clientX+14)+"px";tip.style.top=Math.max(10,Math.min(innerHeight-tip.offsetHeight-12,ev.clientY+14))+"px";});
 $("planCanvas").addEventListener("mouseleave",()=>$("hoverInfo").hidden=true);
 function setForm(form,values){for(const [k,v]of Object.entries(values)){const el=form.elements.namedItem(k);if(!el)continue;if(el.type==="checkbox")el.checked=!!v;else el.value=v??"";}}
 function showBoard(edit=false){
  window.StudioSimulation?.stop();
  const b=edit?currentBoard():null,existing=b?P.stocks.find(s=>s.id===b.stockId||s.id===b.id):null;editStockId=edit?(existing?.id||"create-from-sheet"):null;
  setForm($("boardForm"),b?{...b,name:existing?.name||b.name,qty:existing?.qty||1}:{...P.template,name:"Płyta "+(P.stocks.length+1),material:"Materiał",thickness:18,qty:1});$("boardDialogTitle").textContent=edit?"Parametry płyty":"Dodaj płytę";$("boardDialog").showModal();
 }
 $("boardForm").addEventListener("submit",ev=>{ev.preventDefault();try{
  const data=Object.fromEntries(new FormData(ev.target));for(const k of ["length","width","thickness","qty","kerf","trim"])data[k]=num(data[k]);
  if(!(data.length>2*data.trim&&data.width>2*data.trim&&data.qty>0&&data.qty<=500&&Number.isInteger(data.qty)))throw Error("Sprawdź wymiary, brzegowanie i liczbę płyt (do 500).");
  data.id=editStockId&&editStockId!=="create-from-sheet"?editStockId:uid("stock");
  const index=P.stocks.findIndex(s=>s.id===data.id);if(index>=0)P.stocks[index]=data;else P.stocks.push(data);
  if(editStockId&&P.parts.length)runOptimize();else{P.sheets=P.sheets.filter(b=>b.stockId!==data.id);P.sheets.push(...blankBoards(data));boardIndex=P.sheets.length-data.qty;render();}
  changed();$("boardDialog").close();
 }catch(err){toast(err.message);}});
 function showPart(id=null){
  window.StudioSimulation?.stop();
  const p=id?partById(id):null;if(id&&!p)return;editPartId=id;const b=currentBoard();
  const data=p||{name:"Element "+(P.parts.length+1),length:500,width:300,material:b?.material||"",thickness:b?.thickness||18,qty:1,canRotate:true,code:"",edges:[0,0,0,0]};
  setForm($("partForm"),{...data,e1:data.edges[0],e2:data.edges[1],e3:data.edges[2],e4:data.edges[3]});$("partRaw").textContent=p?.raw?.length?JSON.stringify(p.raw,null,2):"Brak danych źródłowych CSV.";
  $("partSubmit").textContent=P.sheets.some(b=>E.leaves(b.root).some(n=>n.piece))?"Zapisz i przelicz rozkrój":"Zapisz element";$("partDialog").showModal();$("hoverInfo").hidden=true;
 }
 $("partForm").addEventListener("submit",ev=>{ev.preventDefault();try{
  const data=Object.fromEntries(new FormData(ev.target));for(const k of ["length","width","thickness","qty"])data[k]=num(data[k]);data.canRotate=ev.target.elements.canRotate.checked;data.edges=[1,2,3,4].map(i=>num(data["e"+i]));if(!(data.length>0&&data.width>0&&Number.isInteger(data.qty)&&data.qty>0))throw Error("Niepoprawne wymiary lub ilość.");
  const old=partById(editPartId),p={...(old||{}),...data,id:editPartId||uid("part"),raw:old?.raw||[]};
  if(old)P.parts[P.parts.indexOf(old)]=p;else P.parts.push(p);
  selected=p.id;const geometric=!old||["length","width","qty","material","thickness","canRotate"].some(k=>old[k]!==p[k]);
  if(geometric&&P.sheets.length)runOptimize();else{for(const b of P.sheets)for(const n of E.leaves(b.root))if(n.piece?.id===p.id)n.piece={...n.piece,...p,rotated:n.piece.rotated};render();}
  changed();$("partDialog").close();toast("Zapisano element: "+p.name);
 }catch(err){toast(err.message);}});
 function showOptimize(){
  if(!P.parts.length){toast("Dodaj elementy lub zaimportuj CSV.");return;}setForm($("optForm"),{...P.template,auto:P.auto,...P.optimizationSettings});
  const groups=new Map();for(const p of P.parts){const k=E.group(p);groups.set(k,{p,qty:(groups.get(k)?.qty||0)+p.qty});}
  $("optGroups").innerHTML=[...groups.values()].map(({p,qty})=>'<div>'+e(p.material||"Nieprzypisany materiał")+' · '+(p.thickness?f(p.thickness)+" mm":"brak grubości")+' <b style="float:right">'+qty+' szt.</b></div>').join("");$("optDialog").showModal();
 }
 function runOptimize(){
  if(!P.parts.length){P.sheets=P.stocks.flatMap(blankBoards);P.unplaced=[];render();return;}
  const result=E.optimize(P.parts,P.stocks,P.template,P.auto),errors=E.validate(result.sheets);if(errors.length)throw Error("Błąd geometrii: "+errors[0]);
  P.sheets=result.sheets;P.unplaced=result.unplaced;delete P.optimization;boardIndex=0;render();changed();toast("Rozmieszczono "+P.sheets.reduce((s,b)=>s+E.leaves(b.root).filter(n=>n.piece).length,0)+" szt. na "+P.sheets.length+" płytach. Do uzupełnienia: "+P.unplaced.length+".");
 }
 $("optForm").addEventListener("submit",async ev=>{ev.preventDefault();try{
  const data=Object.fromEntries(new FormData(ev.target));P.template={length:num(data.length),width:num(data.width),kerf:num(data.kerf),trim:num(data.trim)};P.auto=ev.target.elements.auto.checked;
  if(!(P.template.length>2*P.template.trim&&P.template.width>2*P.template.trim))throw Error("Brzegowanie pozostawia pusty obszar płyty.");
  P.optimizationSettings={seconds:Math.max(.25,Math.min(60,num(data.seconds)||8)),priority:data.priority||'balanced'};
  $("optDialog").close();window.StudioSimulation?.stop();$('searchStatus').textContent='Przygotowanie…';$('searchProgress').value=0;$('searchDialog').showModal();await new Promise(requestAnimationFrame);
  const result=await PlannerSearch.optimize(P.parts,P.stocks,P.template,P.auto,P.optimizationSettings,info=>{
   $('searchProgress').value=Math.min(100,(info.elapsed||0)/(P.optimizationSettings.seconds*10));const r=info.result,m=r.optimization.metrics;
   $('searchStatus').textContent=(r.optimization.iterations*3+12)+' wariantów · '+r.sheets.length+' płyt · '+m.cuts+' przejazdów (w tym '+m.trims+' brzegowań) · '+m.rotations+' obrotów · do uzupełnienia '+r.unplaced.length;
  });
  const errors=E.validate(result.sheets);if(errors.length)throw Error('Błąd geometrii: '+errors[0]);P.sheets=result.sheets;P.unplaced=result.unplaced;P.optimization=result.optimization;boardIndex=0;changed();render();$('searchDialog').close();setView('plan');toast('Wybrano najlepszy z '+(result.optimization.iterations*3+12)+' porównanych wariantów: '+P.sheets.length+' płyt, '+result.optimization.metrics.cuts+' przejazdów.');
 }catch(err){$('searchDialog').close();toast(err.message);}});
 async function importCSV(file){
  const decoded=E.decodeCSV(await file.arrayBuffer()),data=E.parseCSV(decoded.text);pendingCSV={...data,encoding:decoded.encoding,name:file.name.replace(/\.[^.]+$/,"")};
  const missing=data.parts.filter(p=>!p.material||!p.thickness);
  $("csvSummary").textContent=file.name+" · "+decoded.encoding+" · "+data.parts.length+" pozycji · "+data.parts.reduce((s,p)=>s+p.qty,0)+" sztuk";
  const headers=["Nazwa","Materiał–grubość","Długość","Szerokość","Ilość","Blokada obrotu","Okleina D1","Okleina D2","Okleina S1","Okleina S2","Kod","Dodatkowe 12","Dodatkowe 13"];
  $("csvPreview").innerHTML='<table><thead><tr>'+headers.map(x=>'<th>'+e(x)+'</th>').join("")+'</tr></thead><tbody>'+data.parts.map(p=>'<tr class="'+(!p.material||!p.thickness?"attention":"")+'">'+Array.from({length:Math.max(13,p.raw.length)},(_,i)=>'<td>'+e(p.raw[i]||"—")+'</td>').join("")+'</tr>').join("")+'</tbody></table>';
  $("csvWarnings").textContent=(missing.length?"Do uzupełnienia materiał/grubość: "+missing.map(p=>p.name+" (wiersz "+p.sourceLine+")").join(", ")+". ":"")+(data.errors.length?"Pominięte niepoprawne wiersze: "+data.errors.map(x=>x.line).join(", ")+".":"");
  $("csvDialog").showModal();
 }
 function confirmImport(optimize){
  if(!pendingCSV)return;const wasEmpty=!P.parts.length;P.parts.push(...pendingCSV.parts.map(p=>({...p,id:uid("csv")})));
  if(wasEmpty)P.name=pendingCSV.name;P.csvSource={encoding:pendingCSV.encoding,delimiter:pendingCSV.delimiter,errors:pendingCSV.errors};pendingCSV=null;selected=null;changed();$("csvDialog").close();render();if(optimize)showOptimize();else setView("parts");
 }
 const safeFileName=name=>String(name||"Planer").replace(/[<>:"/\\|?*\x00-\x1f]/g,"_").replace(/[. ]+$/,"").slice(0,120)||"Planer";
 function saveBlob(text,name,type){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=safeFileName(name);a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
 async function openFile(file){
  const text=new TextDecoder("utf-8").decode(await file.arrayBuffer()).replace(/^\uFEFF/,"");let next;
  if(text.trim().startsWith("<")){const parsed=PlannerFiles.readMcut(text);next={...fresh(),...parsed,name:parsed.name||file.name.replace(/\.[^.]+$/,"")};}
  else{next=JSON.parse(text);if(next.format!=="PlanerOffline"||next.version!==3||!Array.isArray(next.parts)||!Array.isArray(next.stocks)||!Array.isArray(next.sheets))throw Error("Nieobsługiwany format projektu.");next={...fresh(),...next};}
  if(next.parts.length>5000||next.sheets.length>1000)throw Error("Projekt jest zbyt duży.");
  next.parts=next.parts.map(normalizePart);next.labels={width:80,height:60,style:"auto",...next.labels};P=next;boardIndex=0;selected=null;labelIndex=0;dirty=false;$("saveState").textContent="Wczytany";window.StudioSimulation?.stop();render();setView("plan");toast("Wczytano "+file.name);
 }
 function csvExport(){
  const rows=P.parts.map(p=>{const r=p.raw.slice();r[0]=p.name;r[1]=p.material+(p.thickness?"-"+f(p.thickness):"");r[2]=f(p.length);r[3]=f(p.width);r[4]=p.qty;r[5]=String(!p.canRotate);p.edges.forEach((x,i)=>r[6+i]=f(x));r[10]=p.code;while(r.length<13)r.push("");return r;});
  const encode=v=>/[",\r\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v);
  saveBlob("\uFEFF"+rows.map(r=>r.map(encode).join(",")).join("\r\n"),P.name+".csv","text/csv;charset=utf-8");
 }
 function labelParts(){
  const scope=$("labelScope").value;
  if(scope==="sheet")return currentBoard()?E.leaves(currentBoard().root).filter(n=>n.piece).map(n=>n.piece):[];
  const parts=scope==="selected"?P.parts.filter(p=>p.id===selected):P.parts;
  return parts.flatMap(p=>Array.from({length:p.qty},(_,i)=>({...p,copy:i+1})));
 }
 function labelSettings(){return{...P.labels,width:Math.max(30,Math.min(150,num($("labelWidth").value)||80)),height:Math.max(20,Math.min(150,num($("labelHeight").value)||60)),style:$("labelStyle").value};}
 function renderLabels(){
  const templates=P.labels.customTemplates||[];$('labelTemplatePicker').innerHTML='<option value="ibron">IBRON — wzory przykładowe</option>'+templates.map(t=>'<option value="'+e(t.id)+'">'+e(t.name)+'</option>').join('');$('labelTemplatePicker').value=P.labels.activeTemplate||'ibron';$('removeLabelTemplate').hidden=!templates.some(t=>t.id===P.labels.activeTemplate);
  const list=labelParts();labelIndex=Math.max(0,Math.min(labelIndex,list.length-1));const p=list[labelIndex],settings=labelSettings();P.labels=settings;
  $("labelCounter").textContent=list.length?(labelIndex+1)+" / "+list.length:"0 / 0";$("labelPreview").innerHTML=p?L.labelHTML(p,P,settings):"Brak elementów w wybranym zakresie."; $("labelPreview").classList.toggle("empty-label",!p);$("labelData").innerHTML=p?L.dataHTML(p):"Dodaj elementy lub wybierz inny zakres.";
 }
 document.querySelectorAll("nav button[data-view]").forEach(n=>n.onclick=()=>setView(n.dataset.view));
 document.querySelectorAll("[data-close]").forEach(n=>n.onclick=()=>$(n.dataset.close).close());
 on("newProject",()=>{if(dirty&&!confirm("Utworzyć pusty projekt? Niezapisane zmiany zostaną utracone."))return;window.StudioSimulation?.stop();P=fresh();boardIndex=0;selected=null;dirty=false;$("saveState").textContent="Niezapisany";render();setView("plan");});
 on("openProject",()=>$("projectFile").click());$("projectFile").onchange=async ev=>{try{if(ev.target.files[0])await openFile(ev.target.files[0]);}catch(err){toast(err.message);console.error(err);}ev.target.value="";};
 for(const id of ["importCSV","tableImport"])on(id,()=>$("csvFile").click());
 $("csvFile").onchange=async ev=>{try{if(ev.target.files[0])await importCSV(ev.target.files[0]);}catch(err){toast(err.message);}ev.target.value="";};
 on("confirmCSV",()=>confirmImport(false));on("confirmCSVOptimize",()=>confirmImport(true));
 on("saveProject",()=>{P.name=$("projectName").value.trim()||"Nowy projekt";saveBlob(JSON.stringify(P,null,2),P.name+".rozkroj.json","application/json");dirty=false;$("saveState").textContent="Zapisany";toast("Zapisano projekt wraz z płytami, elementami i wszystkimi danymi źródłowymi.");});
 for(const id of ["addBoard","emptyAddBoard"])on(id,()=>showBoard(false));
 on("boardProperties",()=>{if(!currentBoard()){showBoard(false);return;}showBoard(true);});
 for(const id of ["addPart","tableAddPart"])on(id,()=>showPart());
 for(const id of ["optimize","tableOptimize"])on(id,showOptimize);
 on("editSelected",()=>showPart(selected));on("labelSelected",()=>{$("labelScope").value="selected";labelIndex=0;setView("labels");});
 $("sheetPicker").onchange=ev=>selectBoard(Number(ev.target.value));
 on('prevBoard',()=>{if(boardIndex>0)selectBoard(boardIndex-1);});on('nextBoard',()=>{if(boardIndex<P.sheets.length-1)selectBoard(boardIndex+1);});
 on('showMcutCode',()=>{if(!currentBoard())return;window.StudioSimulation?.stop();renderCodeWindow();$('mcutCodeDialog').showModal();});$('mcutCodeMode').onchange=renderCodeWindow;
 function downloadInfo(){const all=$('downloadMcutScope').value==='all',original=$('downloadMcutFormat').querySelector('[value="original"]');original.disabled=all?!P.sourceMcut||P.sheets.some(b=>!b.imported):!PlannerMcutPreview.original(P,currentBoard());if(original.disabled&&$('downloadMcutFormat').value==='original')$('downloadMcutFormat').value='native';$('downloadNativePack').disabled=$('downloadMcutFormat').value!=='native';$('downloadMcutInfo').textContent=all?P.sheets.length+' płyt w jednym pliku .mcut.':'Bieżąca płyta: '+(boardIndex+1)+' / '+P.sheets.length+' — '+currentBoard().name;}
 function showDownload(){if(!currentBoard())return;window.StudioSimulation?.stop();downloadInfo();$('downloadMcutDialog').showModal();}
 on('downloadMcut',showDownload);on('downloadCodeMcut',showDownload);$('downloadMcutScope').onchange=downloadInfo;$('downloadMcutFormat').onchange=downloadInfo;
 on('confirmDownloadMcut',()=>{const all=$('downloadMcutScope').value==='all',mode=$('downloadMcutFormat').value,boards=all?P.sheets:[currentBoard()],text=mode==='native'?PlannerMcutNative.build(P,boards).text:PlannerMcutPreview.download(P,boards,mode),name=all?P.name+'-calosc':P.name+'-plyta-'+(boardIndex+1);saveBlob(text,name+(mode==='original'?'-oryginal':mode==='native'?'-presize':'-planer')+'.mcut','application/xml;charset=utf-8');$('downloadMcutDialog').close();toast('Pobrano '+(all?'cały rozkrój':'bieżącą płytę')+' jako .mcut.');});
 on('downloadNativePack',async()=>{const button=$('downloadNativePack'),caption=button.textContent;button.disabled=true;try{const boards=$('downloadMcutScope').value==='all'?P.sheets:[currentBoard()],result=await PlannerNativePack.build(P,boards,{fixedLabels:$('includeFixedLabels').checked,progress:(i,total)=>{$('downloadMcutInfo').textContent='Przygotowywanie naklejek: '+i+' / '+total;}});saveBlob(result.bytes,result.name,'application/zip');$('downloadMcutDialog').close();toast('Pobrano pakiet: MCUT, dane i naklejki LBLD.');}finally{button.disabled=false;button.textContent=caption;}});
 on('downloadLbld',()=>{const settings=labelSettings(),custom=PlannerLabelTemplates.selected(P,settings),style=settings.style==='project'?'project':'code';if(custom){saveBlob(PlannerLabelTemplates.decode(custom.base64),custom.name,'application/octet-stream');return;}const doc=PlannerLbldPresets.make({style});saveBlob(doc.save(),'IBRON-80x60-'+(style==='project'?'bez-kodu':'Code128')+'.lbld','application/octet-stream');toast('Pobrano szablon .lbld z powiązaniami pól danych.');});
 on('downloadFixedLbld',async()=>{const p=labelParts()[labelIndex];if(!p)throw Error('Wybierz element do etykiety.');const settings=labelSettings(),svg=L.labelSVG(p,P,settings),png=await PlannerLabelRaster.png(svg,Math.round(settings.width/25.4*300),Math.round(settings.height/25.4*300)),doc=PlannerLbldPresets.fromBitmap(png);saveBlob(doc.compactSave(),p.name+'-'+(p.code||'bez-kodu')+'.lbld','application/octet-stream');toast('Zapisano gotowy obraz etykiety w LBLD — taki jak w podglądzie.');});
 on('copyMcutCode',async()=>{try{await navigator.clipboard.writeText(currentCode);$('mcutCodeStatus').textContent='Skopiowano kod';}catch{const range=document.createRange();range.selectNodeContents($('mcutCodeContent'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);$('mcutCodeStatus').textContent='Zaznaczono kod — naciśnij Ctrl+C';}});
 $("showAllData").onchange=drawPlan;$("partsSearch").oninput=renderTable;
 $("projectName").onchange=()=>{P.name=$("projectName").value.trim()||"Nowy projekt";changed();if(view==="labels")renderLabels();};
 on("exportCSV",csvExport);
 for(const id of ["labelStyle","labelWidth","labelHeight","labelScope"])$(id).onchange=()=>{labelIndex=0;changed();renderLabels();};
 on("labelPrev",()=>{labelIndex--;renderLabels();});on("labelNext",()=>{labelIndex=Math.min(labelParts().length-1,labelIndex+1);renderLabels();});
 on('importLabelTemplate',()=>$('labelTemplateFile').click());
 $('labelTemplateFile').onchange=async ev=>{try{const file=ev.target.files[0];if(!file)return;const template=PlannerLabelTemplates.inspect(new Uint8Array(await file.arrayBuffer()),file.name);pendingLabelTemplate=template;$('labelImportSummary').textContent=template.name+' — '+template.objects+' obiektów, '+template.bound+' powiązanych z danymi.';$('labelImportNote').textContent=template.bound?'Pola szablonu będą wypełniane danymi bieżącego elementu.':'Ten plik zawiera stałe dane lub gotowy obraz. Nazwy i wymiary zapisane na stałe nie zmienią się przy przełączaniu elementów.';$('templateCanvasWidth').value=template.width;$('templateCanvasHeight').value=template.height;$('labelImportDialog').showModal();}catch(error){toast(error.message);}ev.target.value='';};
 on('confirmLabelImport',()=>{if(!pendingLabelTemplate)return;const t=pendingLabelTemplate;t.width=Math.max(30,Math.min(2000,num($('templateCanvasWidth').value)||226));t.height=Math.max(20,Math.min(2000,num($('templateCanvasHeight').value)||169.5));const templates=P.labels.customTemplates||[];if(templates.length>=10)throw Error('W projekcie może być do 10 szablonów. Usuń niepotrzebny szablon.');P.labels.customTemplates=[...templates,t];P.labels.activeTemplate=t.id;pendingLabelTemplate=null;$('labelImportDialog').close();changed();renderLabels();toast('Szablon jest używany w podglądzie i druku. Zapisz projekt, aby go zachować.');});
 $('labelTemplatePicker').onchange=()=>{P.labels.activeTemplate=$('labelTemplatePicker').value;changed();renderLabels();};
 on('removeLabelTemplate',()=>{P.labels.customTemplates=(P.labels.customTemplates||[]).filter(t=>t.id!==P.labels.activeTemplate);P.labels.activeTemplate='ibron';changed();renderLabels();});
 $('orderName').onchange=()=>{P.orderName=$('orderName').value.trim();changed();if(view==='labels')renderLabels();};
 on("printLabels",()=>L.print(labelParts(),P,labelSettings()));
 window.addEventListener("resize",()=>{drawPlan();window.StudioSimulation?.draw();});
 window.Studio={get project(){return P;},get board(){return currentBoard();},get boardIndex(){return boardIndex;},get activeOperation(){return activeOperation;},selectBoard,drawBoard,drawPlan,setActiveOperation(op){activeOperation=op;activePartIds=new Set(op?E.leaves(op.children[0]).filter(n=>n.piece).map(n=>n.piece.instanceId):[]);drawPlan();renderBoardParts();if($('mcutCodeDialog').open)renderCodeWindow();},markChanged:changed,toast,render,setView,partById};
 render();
})();
