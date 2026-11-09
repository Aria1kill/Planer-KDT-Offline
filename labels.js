(function(){
 const E=PlannerEngine,e=E.escape;
 function dataHTML(p){
  if(!p)return"Brak wybranego elementu.";
  const fields=[["Nazwa",p.name],["Kod",p.code||"—"],["Długość",E.fmt(p.length)+" mm"],["Szerokość",E.fmt(p.width)+" mm"],["Ilość",p.qty],["Materiał",p.material||"Nieprzypisany"],["Materiał źródłowy",p.materialRaw||"—"],["Grubość",p.thickness?E.fmt(p.thickness)+" mm":"Nie podano"],["Obrót",p.canRotate?"Dozwolony":"Zablokowany"],["Oklejanie D1 / D2",p.edges.slice(0,2).map(E.fmt).join(" / ")],["Oklejanie S1 / S2",p.edges.slice(2,4).map(E.fmt).join(" / ")]];
  let html='<div class="data-grid">'+fields.map(([k,v])=>'<div class="datum'+(["Nazwa","Kod","Materiał","Materiał źródłowy"].includes(k)?" wide":"")+'"><span>'+e(k)+'</span><b>'+e(v)+'</b></div>').join("")+'</div>';
  if(p.raw?.length)html+='<details class="raw-details"><summary>Wszystkie kolumny źródłowe CSV</summary><div class="table-wrap"><table>'+p.raw.map((v,i)=>'<tr><td>'+e(p.rawHeaders?.[i]||"Kolumna "+(i+1))+'</td><td>'+e(v||"—")+'</td></tr>').join("")+'</table></div></details>';
  return html;
 }
 function labelSVG(p,project,settings={}){const t=PlannerLabelTemplates.documentFor(p,project,settings),svg=PlannerLbldRenderer.svg(t.doc,{width:t.width,height:t.height,mode:'sample',values:t.values});return svg.replace('<svg ','<svg class="label-vector" preserveAspectRatio="none" ');}
 function labelHTML(p,project,settings){const values=PlannerLabelData.values(p,project);return '<article class="sticker '+(values.Code&&settings.style!=='project'?'with-code':'without-code')+'" style="width:'+settings.width+'mm;height:'+settings.height+'mm;--label-ratio:'+settings.width+'/'+settings.height+'" aria-label="Naklejka '+e(p.name)+'">'+labelSVG(p,project,settings)+'</article>';}
 async function print(parts,project,settings){
  if(!parts.length)throw Error("Brak elementów w wybranym zakresie drukowania.");
  for(const p of parts){const t=PlannerLabelTemplates.documentFor(p,project,settings);for(const {node}of t.doc.shapes()){if(node.meta.name!=='LabelDesign.Code'||!t.values.Code)continue;const i=PlannerLbldRenderer.info(t.doc,node),value=i.binding?PlannerLabelData.resolve(i.binding,t.values):i.text;if(String(value).trim())E.code128(value);}}

  document.querySelectorAll("iframe.print-host").forEach(n=>n.remove());
  const iframe=document.createElement("iframe");iframe.className="print-host";iframe.style.cssText="display:block;position:fixed;left:-10000px;top:0;width:400px;height:300px;border:0";document.body.append(iframe);
  const html='<!doctype html><html lang="pl"><head><meta charset="utf-8"><base href="'+e(location.href)+'"><link rel="stylesheet" href="css/studio.css"><style>@page{size:'+settings.width+'mm '+settings.height+'mm;margin:0}html,body{margin:0;padding:0;background:#fff;width:'+settings.width+'mm}.sticker{margin:0;box-shadow:none;border-radius:0;break-after:page;page-break-after:always;print-color-adjust:exact;-webkit-print-color-adjust:exact}.sticker:last-child{break-after:auto;page-break-after:auto}</style></head><body>'+parts.map(p=>labelHTML(p,project,settings)).join("")+'</body></html>';
  await new Promise((resolve,reject)=>{iframe.onload=resolve;iframe.onerror=reject;iframe.srcdoc=html;});
  const images=[...iframe.contentDocument.images];await Promise.all(images.map(img=>img.decode?.().catch(()=>{})||Promise.resolve()));
  iframe.contentWindow.addEventListener("afterprint",()=>iframe.remove(),{once:true});
  iframe.contentWindow.focus();iframe.contentWindow.print();
 }
 window.PlannerLabels={dataHTML,labelHTML,labelSVG,print};
})();
