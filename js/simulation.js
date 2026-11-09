(function(){
 'use strict';
 const E=PlannerEngine,P=PlannerProcess,S=Studio,$=id=>document.getElementById(id),e=E.escape,f=E.fmt;
 let model=null,ops=[],step=0,progress=0,playing=false,last=0,raf=0,zoom=1;
 const planCard=$('planArea').closest('.card'),workspace=document.createElement('div');workspace.id='processWorkspace';workspace.className='process-workspace';planCard.before(workspace);
 const simView=$('view-simulation'),controls=simView.querySelector('.tools'),machine=simView.querySelector('.simulation-grid>.card');
 controls.id='processControls';workspace.before(controls);workspace.append(machine,planCard);
 const settings=document.createElement('div');settings.className='machine-settings';settings.innerHTML='<label>Kolejność dla tej płyty<select id="simCutOrder"><option value="parallel">Najpierw odcinaj kolejne pasy</option><option value="strip">Odcięty pas od razu docinaj</option></select></label><label>Ustawienie widoku<select id="simCamera"><option value="-90">Piła startuje od dołu ekranu</option><option value="0">Operator na dole ekranu</option></select></label>';machine.querySelector('.card-title').after(settings);
 $('simCutOrder').onchange=()=>{if(!S.board)return;S.board.cutOrder=$('simCutOrder').value;S.markChanged();reset();};$('simCamera').onchange=()=>{S.project.simulationCamera=Number($('simCamera').value);S.markChanged();draw();};
 const editor=$('view-plan').querySelector('.editor-grid>div');editor.append(simView.querySelector('.buffer-grid'),$('simOperations'));
 $('view-plan').querySelector('.sheet-parts-card').after($('simDetails').closest('.card'));
 machine.querySelector('.canvas-caption').textContent='Wprowadzenie całego fragmentu → wysunięcie do wymiaru → docisk i cięcie → odebranie pasa';
 const note=simView.querySelector('.small-note');if(note){note.textContent='Geometria fragmentów i rzazu wynika z planu. Brzegowanie jest wykonywane dopiero na potrzebnej krawędzi danego fragmentu; odpad nie jest brzegowany. Kolejność dobierasz dla każdej płyty. Ruchy przekładania są modelem poglądowym, nie odtworzonym sterownikiem MS320.';editor.append(note);}
 const fullscreen=document.createElement('button');fullscreen.textContent='⛶ Duże okno';fullscreen.type='button';fullscreen.onclick=()=>{document.body.classList.toggle('process-expanded');requestAnimationFrame(()=>{draw();S.drawPlan();});};controls.append(fullscreen);
 const zoomLabel=document.createElement('label');zoomLabel.innerHTML='Zbliżenie <select id="simZoom"><option value=".75">75%</option><option value="1" selected>100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select>';controls.append(zoomLabel);$('simZoom').onchange=()=>{zoom=Number($('simZoom').value);draw();};
 const slider=document.createElement('input');slider.type='range';slider.id='simTimeline';slider.min=0;slider.max=1000;slider.value=0;slider.setAttribute('aria-label','Postęp bieżącej operacji');controls.after(slider);slider.oninput=()=>{stop();progress=Number(slider.value)/1000;render();};
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){document.body.classList.remove('process-expanded');requestAnimationFrame(()=>{draw();S.drawPlan();});}});
 function stop(){playing=false;last=0;$('simPlay').textContent='▶ Odtwórz';}
 function reset(){stop();model=S.board?P.compile(S.board):null;ops=model?.ops||[];step=0;progress=0;$('simCutOrder').value=S.board?.cutOrder||'parallel';$('simCutOrder').disabled=!S.board;$('simCamera').value=String(S.project.simulationCamera??-90);render();}
 function current(){return model?.frames[step];}
 function phaseName(){const frame=current();if(!frame)return'Brak cięć do odtworzenia';
  if(frame.continuation&&progress<.53)return'Dalsze wysuwanie materiału do kolejnego cięcia';
  if(progress<.17)return step===0?'Załadunek surowej płyty':'Pobranie pojedynczego pasa z bufora';
  if(progress<.36)return Math.abs(frame.delta)>.001?'Obrót fragmentu o '+f(Math.abs(frame.delta)*180/Math.PI)+'°':'Wyrównanie fragmentu';
  if(progress<.46)return'Wprowadzenie całego fragmentu za linię piły';if(progress<.53)return'Wysunięcie materiału do wymiaru cięcia';if(progress<.59)return'Docisk materiału';
  if(progress<.76)return ops[step].kind==='trim'?'Brzegowanie · '+ops[step].edge+' · '+f(ops[step].allowance)+' mm':'Przejazd piły';
  if(progress<.84)return'Zwolnienie docisku i rozdzielenie';return'Odłożenie elementów i przygotowanie kolejnego cięcia';
 }
 function chips(list,activeId){return list.length?list.map(n=>'<div class="fragment-chip '+(n.id===activeId?'active':'')+'"><b>'+e(n.piece?.name||'Pas #'+n.id)+'</b>'+f(n.w)+' × '+f(n.h)+' mm'+(n.piece?.code?'<br>'+e(n.piece.code):'')+'</div>').join(''):'<span class="muted">Brak</span>';}
 function render(){
  step=Math.max(0,Math.min(step,ops.length-1));const op=ops[step],m=S.board?P.metrics([S.board]):null;
  $('simCounter').textContent=ops.length?(step+1)+' / '+ops.length+' · '+m.trims+' brzegowań · '+m.rotations+' obrotów':'0 / 0';
  for(const id of ['simPlay','simPrev','simNext'])$(id).disabled=!ops.length;
  $('simOperations').innerHTML=ops.map((o,i)=>'<button class="'+(i===step?'active':'')+'" data-step="'+i+'">'+(i+1)+'. '+(o.kind==='trim'?'Brzegowanie '+e(o.edge)+' · '+f(o.allowance)+' mm':f(o.cut)+' mm')+'</button>').join('');
  $('simOperations').querySelectorAll('[data-step]').forEach(n=>n.onclick=()=>goto(Number(n.dataset.step)));
  if(op){const inv=P.inventory(S.board,step+(progress>=1?1:0));$('bufferList').innerHTML=chips(inv.available,op.source.id);$('finishedList').innerHTML=chips(inv.finished);$('bufferCount').textContent=inv.available.length;$('finishedCount').textContent=inv.finished.length;
   $('simDetails').innerHTML='<div class="data-grid"><div class="datum wide"><span>Operacja</span><b>'+(op.kind==='trim'?'Brzegowanie '+e(op.edge):'Cięcie na '+f(op.cut)+' mm')+'</b></div><div class="datum"><span>Rzaz</span><b>'+f(op.kerf)+' mm</b></div><div class="datum"><span>Obrót do tego cięcia</span><b>'+f(Math.abs(current().delta)*180/Math.PI)+'°</b></div><div class="datum wide"><span>Fragment #'+e(op.source.nativeId||op.source.id)+'</span><b>'+f(op.source.w)+' × '+f(op.source.h)+' mm</b></div><div class="datum wide"><span>Cała płyta</span><b>'+m.cuts+' przejazdów · '+f(m.travel/1000)+' m linii cięcia</b></div></div>';
  }else{$('simDetails').textContent='Dodaj elementy i wykonaj rozkrój lub otwórz MCUT.';for(const id of ['bufferList','finishedList'])$(id).innerHTML='';$('bufferCount').textContent='0';$('finishedCount').textContent='0';}
  S.setActiveOperation(op||null);S.drawBoard($('miniCanvas'),S.board,op?.source);draw();
 }
 function goto(index){stop();step=Math.max(0,Math.min(ops.length-1,index));progress=0;render();}
 function tick(t){raf=0;if(!playing)return;if(last)progress+=Math.min(100,t-last)/6200*Number($('simSpeed').value);last=t;
  if(progress>=1){if(step<ops.length-1){step++;progress=0;render();}else if(S.boardIndex<S.project.sheets.length-1){const next=S.boardIndex+1;S.selectBoard(next);playing=true;$('simPlay').textContent='Ⅱ Pauza';last=t;}else{progress=1;stop();render();}}
  draw();if(playing)raf=requestAnimationFrame(tick);
 }
 function play(){if(playing){stop();return;}if(!ops.length)return;if(progress>=1&&step===ops.length-1){step=0;progress=0;render();}playing=true;last=0;$('simPlay').textContent='Ⅱ Pauza';if(!raf)raf=requestAnimationFrame(tick);}
 const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v);};
 const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:a.angle+(b.angle-a.angle)*t});
 function draw(){
  const canvas=$('simulationCanvas'),box=canvas.getBoundingClientRect();if(box.width<2||box.height<2)return;const w=box.width,h=box.height,dpr=devicePixelRatio||1;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#e8eef4';ctx.fillRect(0,0,w,h);const frame=current();
  if(!frame){ctx.fillStyle='#6b839c';ctx.font='14px Segoe UI,Arial';ctx.textAlign='center';ctx.fillText('Dodaj płytę i elementy, aby zobaczyć proces',w/2,h/2);return;}
  const camera=(S.project.simulationCamera??-90)*Math.PI/180,sideways=Math.abs(Math.sin(camera))>.5;
  const span=model.span,scale=Math.min(w/((sideways?3.6:4.3)*span),h/((sideways?4.3:3.6)*span))*zoom,cx=w*.47,cy=h*.47,p=progress,op=frame.op;
  ctx.save();ctx.translate(cx,cy);ctx.scale(scale,scale);ctx.rotate(camera);
  ctx.fillStyle='#c5d1dd';ctx.fillRect(-span*.68,-span*1.12,span*1.36,span*1.1);ctx.strokeStyle='#aab9c8';ctx.lineWidth=1/scale;
  for(let x=-span*.62;x<span*.68;x+=span*.13){ctx.beginPath();ctx.moveTo(x,-span*1.08);ctx.lineTo(x,-span*.05);ctx.stroke();}
  for(let i=0;i<3;i++){const x=-span*.62+i*span*.44;ctx.fillStyle='#b8c7d5';ctx.fillRect(x,span*.055,span*.32,span*1.18);ctx.fillStyle='#7a8c9d';for(let y=span*.12;y<span*1.2;y+=span*.06)ctx.fillRect(x+span*.015,y,span*.29,span*.012);}
  ctx.fillStyle='#d8e2ec';ctx.fillRect(span*.79,span*.10,span*.97,span*1.35);ctx.fillRect(-span*1.8,span*.10,span*.94,span*1.35);
  function label(text,x,y,color='#526d86',size=10,fragmentAngle=0,maxWidth=null){ctx.save();ctx.translate(x,y);ctx.rotate(-camera-fragmentAngle);ctx.fillStyle=color;ctx.textAlign='center';ctx.font=(size/scale)+'px Segoe UI,Arial';if(maxWidth===null)ctx.fillText(text,0,0);else ctx.fillText(text,0,0,maxWidth);ctx.restore();}
  label('BUFOR POJEDYNCZYCH PASÓW',span*1.26,span*.03);label('GOTOWE ELEMENTY',-span*1.32,span*.03);
  ctx.fillStyle='#475e72';ctx.fillRect(-span*.73,-span*.025,span*1.46,span*.05);label('MASTERWOOD MS320 · WIDOK Z GÓRY',0,-span*1.12,'#334e69',11);
  function fragment(n,pose,alpha=1,color=null){if(n.w<.001||n.h<.001)return;ctx.save();ctx.globalAlpha=alpha;ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);
   const left=-n.w/2,top=-n.h/2;ctx.fillStyle='#637c8e';ctx.fillRect(left+3/scale,top+3/scale,n.w,n.h);ctx.fillStyle=color||(n.piece?'#b9dcc4':n.trimWaste?'#e9ac75':'#c1d7e5');ctx.fillRect(left,top,n.w,n.h);ctx.strokeStyle=n.trimWaste?'#a36a35':'#537790';ctx.lineWidth=1/scale;ctx.strokeRect(left,top,n.w,n.h);if(n.id===op.source.id&&op.children[0]){const target=op.children[0];ctx.fillStyle='#ffd298';ctx.fillRect(left+target.x-n.x,top+target.y-n.y,target.w,target.h);}
   ctx.save();ctx.beginPath();ctx.rect(left,top,n.w,n.h);ctx.clip();ctx.strokeStyle='#ffffff30';ctx.lineWidth=1/scale;for(let y=top+20/scale;y<top+n.h;y+=18/scale){ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(left+n.w,y);ctx.stroke();}ctx.restore();
   const screenAngle=pose.angle+camera,screenW=Math.abs(n.w*Math.cos(screenAngle))+Math.abs(n.h*Math.sin(screenAngle)),screenH=Math.abs(n.w*Math.sin(screenAngle))+Math.abs(n.h*Math.cos(screenAngle));
   const title=n.piece?.name||'Pas '+(n.nativeId||String(n.id).split('-').pop());
   if(screenW*scale>65&&screenH*scale>23)label(title+' · '+f(n.w)+'×'+f(n.h),0,0,'#254b65',9,pose.angle,Math.max(1,screenW-10/scale));ctx.restore();
  }
  for(const item of frame.past)fragment(item.node,item.pose,.42);for(const item of frame.before)if(item.node.id!==op.source.id)fragment(item.node,item.pose,.75);
  let pose;if(frame.continuation&&p<.53)pose=lerp(frame.sourcePose,frame.cutPose,ease(p/.53));else if(p<.17)pose=lerp(frame.sourcePose,frame.staging,ease(p/.17));else if(p<.36)pose={...frame.staging,angle:frame.sourcePose.angle+frame.delta*ease((p-.17)/.19)};else if(p<.46)pose=lerp({...frame.staging,angle:frame.cutPose.angle},frame.infeed,ease((p-.36)/.10));else pose=lerp(frame.infeed,frame.cutPose,ease((p-.46)/.07));
  if(p<.76){fragment(op.source,pose,1,op.kind==='trim'?'#dfc19c':null);if(p>=.53){const cut=P.cutPoint(op),c=P.center(op.source);ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);ctx.fillStyle='#ed8a4c99';if(op.axis==='x')ctx.fillRect(cut.x-c.x-op.kerf/2,-op.source.h/2,Math.max(op.kerf,1/scale),op.source.h);else ctx.fillRect(-op.source.w/2,cut.y-c.y-op.kerf/2,op.source.w,Math.max(op.kerf,1/scale));ctx.restore();}}
  else{const separate=ease((p-.76)/.08),store=ease((p-.84)/.16);for(const out of frame.outputs){const start={...out.start};if(out.kind!=='table')start.y+=span*.10*separate;fragment(out.node,lerp(start,out.end,store),out.kind==='waste'?1-store:1,out.node.id===op.children[0]?.id?'#ffd298':null);}}
  const cross=op.axis==='x'?op.source.h:op.source.w,axis=op.axis==='x'?op.source.w:op.source.h;
  if(p>=.36&&p<.76){const rear=pose.y-axis/2;ctx.fillStyle='#516f87';ctx.fillRect(-cross/2-span*.025,rear-span*.018,cross+span*.05,span*.018);for(let i=0;i<8;i++)ctx.fillRect(-cross/2+cross*(i+.5)/8,rear-span*.02,span*.018,span*.04);}
  if(p>=.53&&p<.81){ctx.fillStyle=p<.59?'#5a7387aa':'#3d5365dd';ctx.fillRect(-span*.70,-span*.035,span*1.40,span*.07);}
  if(p>=.59&&p<.81){const t=clamp((p-.59)/.17),x=-cross/2+cross*t;ctx.strokeStyle='#ff8b37';ctx.lineWidth=2/scale;ctx.beginPath();ctx.moveTo(-cross/2,0);ctx.lineTo(x,0);ctx.stroke();if(p<.76){ctx.fillStyle='#ef9d4f';ctx.beginPath();ctx.arc(x,0,6/scale,0,Math.PI*2);ctx.fill();}}
  ctx.restore();ctx.fillStyle='#ffffffeb';ctx.fillRect(14,12,w-28,32);ctx.fillStyle='#365978';ctx.font='12px Segoe UI,Arial';ctx.textAlign='left';ctx.fillText(phaseName(),24,33);ctx.fillStyle='#5c7690';ctx.font='10px Segoe UI,Arial';ctx.fillText('Stała skala · '+f(span)+' mm płyty · '+(op.kind==='trim'?'brzegowanie':'cięcie '+f(op.cut)+' mm')+' · krok '+(step+1)+'/'+ops.length,18,h-15);
  $('simPhase').textContent=phaseName();$('simDimension').textContent=op.kind==='trim'?'Brzegowanie '+op.edge:f(op.cut)+' mm';$('simTimeline').value=String(Math.round(progress*1000));
 }
 $('simPlay').onclick=play;$('simReset').onclick=()=>goto(0);$('simPrev').onclick=()=>goto(step-1);$('simNext').onclick=()=>{if(step>=ops.length-1&&S.boardIndex<S.project.sheets.length-1)S.selectBoard(S.boardIndex+1);else goto(step+1);};$('simSheetPicker').onchange=ev=>S.selectBoard(Number(ev.target.value));
 window.StudioSimulation={reset,render,draw,stop,get model(){return model;},get step(){return step;}};reset();
})();
