(function(root){
 'use strict';
 const E=root.PlannerEngine,P=root.PlannerProcess;
 function build(board,activeOperation,project={}){
  const tree=P.manufacturingRoot(board),nodes=E.nodes(tree),ids=new Map(nodes.map((n,i)=>[n.id,i+1])),active=activeOperation?.source.id;
  const attrs=obj=>Object.entries(obj).filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>k+'="'+E.escape(typeof v==='number'?E.fmt(v):v)+'"').join(' ');
  const lines=['<?xml version="1.0" encoding="UTF-8"?>','<!-- Podgląd bieżącej płyty Planera. Dodatkowe osie i kolejność są jawne. -->','<!-- Nie jest to zatwierdzony eksport do sterownika KDT. -->','<project previewOnly="true" coordinateSystem="bottom-left" generatedBy="PlanerOffline">'];
  lines.push('  <panel1 '+attrs({l:board.width,w:board.length,num:1,material:board.material,thickness:board.thickness,saw:board.kerf,mcode:'',name:board.name})+'>');
  let activeLine=-1;
  function visit(n,level){const id=ids.get(n.id),axis=n.axis||'y';if(n.id===active)activeLine=lines.length;
   const a=attrs({id,plannerId:n.id,nativeId:n.nativeId,l:axis==='x'?n.w:n.h,w:axis==='x'?n.h:n.w,x:n.x,y:board.width-n.y-n.h,geometryWidth:n.w,geometryHeight:n.h,cut:n.cut,kerf:n.kerf,layer:level,axis:n.axis||'none',startSide:n.axis==='y'?(n.fromEnd?'bottom':'top'):'left',kind:n.kind|| (n.piece?'part':n.axis?'cut':'waste'),trim:n.kind==='trim'?n.allowance||0:0,name:n.piece?.name,code:n.piece?.code,material:n.piece?.material,thickness:n.piece?.thickness,origW:n.piece?.length,origH:n.piece?.width,rotated:n.piece?(n.piece.rotated?'1':'0'):undefined,canRotate:n.piece?(n.piece.canRotate?'1':'0'):undefined,edgeBand1:n.piece?.edges?.[0],edgeBand2:n.piece?.edges?.[1],edgeBand3:n.piece?.edges?.[2],edgeBand4:n.piece?.edges?.[3]});
   if(!n.children?.length){lines.push('    <no.'+id+' '+a+' />');return;}
   lines.push('    <no.'+id+' '+a+'>');for(const c of n.children)lines.push('      <part '+attrs({cut:n.axis==='x'?c.w:c.h,id:ids.get(c.id),type:c.axis?2:1,code:c.piece?.code||'',waste:!c.axis&&!c.piece?'true':undefined})+' />');lines.push('    </no.'+id+'>');n.children.forEach(c=>visit(c,level+1));
  }visit(tree,1);
  lines.push('    <execution policy="'+(board.cutOrder==='strip'?'finish-strip':'parallel-strips')+'">');P.sequence(board).forEach((o,i)=>lines.push('      <step '+attrs({no:i+1,source:ids.get(o.source.id),axis:o.axis,cut:o.cut,kerf:o.kerf,kind:o.kind,trim:o.kind==='trim'?o.allowance:undefined})+' />'));lines.push('    </execution>');
  lines.push('    <!-- Dane etykiet Planera; obsługa tego rozszerzenia przez KDT nie została potwierdzona. -->','    <labelData schema="PlanerLabels/1" widthMm="80" heightMm="60" template="IBRON-80x60-Code128.lbld">');
  for(const n of nodes.filter(n=>n.piece)){const values=root.PlannerLabelData.values(n.piece,project,board,{sheetIndex:project.sheets?.indexOf(board)});lines.push('      <label '+attrs({node:ids.get(n.id),partId:n.piece.id,instanceId:n.piece.instanceId})+'>');for(const [key,value]of Object.entries(values))lines.push('        <field '+attrs({name:key})+'>'+E.escape(value)+'</field>');for(const [i,value]of (n.piece.raw||[]).entries())lines.push('        <sourceColumn '+attrs({index:i+1,header:n.piece.rawHeaders?.[i]||''})+'>'+E.escape(value)+'</sourceColumn>');lines.push('      </label>');}
  lines.push('    </labelData>','  </panel1>','</project>');
  return{text:lines.join('\n'),activeLine,nodes:nodes.length,operations:P.sequence(board).length};
 }
 function original(project,board){if(!board.imported||!project.sourceMcut)return'';const document=new DOMParser().parseFromString(project.sourceMcut,'application/xml'),panels=[...document.documentElement.children].filter(n=>/^panel\d+$/i.test(n.localName)),match=String(board.stockId||board.id).match(/^mstock(\d+)/),panel=panels[Number(match?.[1]||0)];return panel?'<?xml version="1.0" encoding="UTF-8"?>\n<project>\n'+new XMLSerializer().serializeToString(panel)+'\n</project>':'';}
 function download(project,boards,mode='current'){
  if(!boards.length)throw Error('Nie wybrano płyty.');
  if(mode==='original'){if(boards.length===project.sheets.length&&project.sheets.every(b=>b.imported)&&project.sourceMcut)return project.sourceMcut;const source=original(project,boards[0]);if(boards.length===1&&source)return source;throw Error('Brak oryginalnego MCUT dla wybranego zakresu.');}
  const xml=new DOMParser().parseFromString(build(boards[0],null,project).text,'application/xml'),panel=xml.documentElement.firstElementChild;panel.remove();boards.forEach((b,i)=>{const next=new DOMParser().parseFromString(build(b,null,project).text,'application/xml').documentElement.firstElementChild,copy=xml.createElement('panel'+(i+1));for(const a of next.attributes)copy.setAttribute(a.name,a.value);for(const child of [...next.childNodes])copy.appendChild(xml.importNode(child,true));xml.documentElement.appendChild(copy);});
  xml.documentElement.setAttribute('projectName',project.name||'');return '<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(xml.documentElement);
 }
 root.PlannerMcutPreview={build,original,download};
})(typeof globalThis!=='undefined'?globalThis:this);
