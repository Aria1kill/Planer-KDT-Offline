/* Native-shaped MCUT plus explicit label data and ready-to-print LBLD copies. */
(function(root){
 'use strict';
 async function build(project,boards,options={}){const output=root.PlannerMcutNative.build(project,boards),stem=String(project.name||'Rozkroj').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,80),entries=[{name:stem+'.mcut',data:output.text},{name:stem+'.etykiety.json',data:JSON.stringify(output.metadata,null,2)},{name:stem+'.etykiety.csv',data:root.PlannerMcutNative.csv(output.metadata)}];
  for(const [style,name]of [['code','IBRON-z-kodem'],['project','IBRON-bez-kodu']])entries.push({name:'szablony/'+name+'.lbld',data:root.PlannerLbldPresets.make({style}).save()});
  if(options.fixedLabels!==false){let i=0;for(const row of output.metadata.rows){const p=row.piece,svg=root.PlannerLabels.labelSVG(p,project,{...project.labels,style:'auto'}),png=await root.PlannerLabelRaster.png(svg),doc=root.PlannerLbldPresets.fromBitmap(png);entries.push({name:'etykiety/plyta-'+row.panel+'-element-'+row.node+'.lbld',data:doc.compactSave()});i++;options.progress?.(i,output.metadata.rows.length);if(i%4===0)await new Promise(resolve=>setTimeout(resolve,0));}}
  entries.push({name:'Przeczytaj.txt',data:'MCUT ma strukturę project/panelN/no.N/part zgodną z dostarczonym 1.2_Pila.mcut. Wartość code pozostaje oryginalnym kodem elementu. Pełne nazwy, zamówienie i okleiny są w plikach etykiety.json i etykiety.csv. Ich automatyczny import do tabeli danych PreSize nie został potwierdzony.\r\n\r\nFolder etykiety zawiera osobne LBLD z gotowym obrazem każdej naklejki, zgodnym z podglądem Planera; nie wymagają one dynamicznego mapowania pól. Folder szablony zawiera edytowalne wzory. Papier: 80 × 60 mm.\r\n\r\nOtwieranie nowego MCUT i druk LBLD w docelowym PreSize wymagają próby. Program Planera nie łączy się ze sterownikiem piły.\r\n'});
  return{bytes:root.PlannerZip.build(entries),name:stem+'-MCUT-naklejki.zip',entries:entries.length,metadata:output.metadata};
 }
 root.PlannerNativePack={build};
})(typeof globalThis!=='undefined'?globalThis:this);
