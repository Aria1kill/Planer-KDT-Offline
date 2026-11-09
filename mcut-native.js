/* MCUT core schema reconstructed from 1.2_Pila.mcut and Temp/EditBoard.xml.
   Label metadata is returned separately: the samples do not establish a native label payload. */
(function(root){
 'use strict';
 const E=root.PlannerEngine,P=root.PlannerProcess,D=root.PlannerLabelData,EPS=.002;
 const attrs=o=>Object.entries(o).map(([k,v])=>k+'="'+E.escape(typeof v==='number'?E.fmt(v):v??'')+'"').join(' ');
 function build(project,boards){
  if(!boards.length)throw Error('Nie wybrano płyty.');
  const lines=['<?xml version="1.0" encoding="UTF-8"?>','<project>'],rows=[],panels=[],warnings=[];
  for(const board of boards){const physical=P.manufacturingRoot(board),memo=new WeakMap();
   function real(n){if(memo.has(n))return memo.get(n);const yes=!!n.piece||!!n.children?.some(real);memo.set(n,yes);return yes;}
   if(!real(physical)){warnings.push('Pominięto pustą płytę: '+board.name);continue;}
   const swapped=physical.axis==='x',yDirections=new Set(E.nodes(physical).filter(n=>n.axis==='y'&&real(n)).map(n=>!!n.fromEnd));
   if(yDirections.size>1)throw Error('Ta płyta ma przeciwne kierunki cięcia w jednej osi. Zapisz ją w rozszerzonym formacie Planera.');
   const flipY=yDirections.has(true),W=swapped?board.width:board.length,H=swapped?board.length:board.width;
   const rect=n=>{const y=flipY?board.width-n.y-n.h:n.y;return swapped?{x:y,y:n.x,w:n.h,h:n.w}:{x:n.x,y,w:n.w,h:n.h};};
   const nativeAxis=a=>swapped?(a==='x'?'y':'x'):a;
   const nativeNodes=[],panel=panels.length+1;let serial=0,maxLayer=0;
   function stage(source,axis,layer){
    const r=rect(source),id=++serial,node={id,r,axis,layer,trim:0,parts:[],source};nativeNodes.push(node);maxLayer=Math.max(maxLayer,layer);
    if(!source.axis&&source.piece){if(layer===1){const child=stage(source,axis==='x'?'y':'x',layer+1);node.parts.push({cut:axis==='x'?r.w:r.h,child,code:source.piece.code||'null'});}else rows.push({panel,node:id,sourceBoardId:board.id,sourceBoardIndex:project.sheets?.indexOf(board),piece:{...source.piece},placement:{x:source.x,y:source.y,w:source.w,h:source.h},values:D.values(source.piece,project,board,{sheetIndex:project.sheets?.indexOf(board)})});return node;}
    const terminals=[];
    function flatten(n){if(n.axis&&nativeAxis(n.axis)===axis)n.children.forEach(flatten);else terminals.push(n);}
    flatten(source);const key=axis==='x'?'x':'y',dim=axis==='x'?'w':'h';terminals.sort((a,b)=>rect(a)[key]-rect(b)[key]);
    const first=terminals.findIndex(real),last=terminals.findLastIndex(real);if(first<0)throw Error('Brak elementów w segmencie MCUT.');
    node.trim=rect(terminals[first])[key]-r[key];if(node.trim< -EPS)throw Error('Ujemne brzegowanie w eksporcie MCUT.');node.trim=Math.max(0,node.trim);
    let cursor=r[key]+node.trim;
    for(let i=first;i<=last;i++){const terminal=terminals[i],t=rect(terminal);if(!real(terminal))throw Error('Wewnętrzna przerwa w pasie nie mieści się w potwierdzonym wzorze MCUT. Użyj rozszerzonego eksportu.');
     if(Math.abs(t[key]-cursor)>EPS)throw Error('Odstęp między cięciami nie odpowiada rzazowi płyty.');
     if(terminal.axis&&nativeAxis(terminal.axis)===axis)throw Error('Nie udało się złączyć równoległych cięć.');
     const child=stage(terminal,axis==='x'?'y':'x',layer+1);node.parts.push({cut:t[dim],child,code:terminal.piece?.code|| (child.parts.length?'':'null')});cursor=t[key]+t[dim]+Math.min(board.kerf,Math.max(0,r[key]+r[dim]-t[key]-t[dim]));
    }
    return node;
   }
   stage(physical,'y',1);
   lines.push('  <panel'+panel+' '+attrs({l:H,w:W,num:1,material:board.material||'',thickness:board.thickness,saw:board.kerf,mcode:board.mcode||''})+'>');
   for(const n of nativeNodes){const a=attrs({l:n.axis==='x'?n.r.w:n.r.h,w:n.axis==='x'?n.r.h:n.r.w,trim:n.trim,x:n.r.x,y:n.r.y,layer:n.layer,id:n.id});
    if(!n.parts.length){lines.push('    <no.'+n.id+' '+a+' />');continue;}
    lines.push('    <no.'+n.id+' '+a+'>');for(const p of n.parts)lines.push('      <part '+attrs({cut:p.cut,id:p.child.id,type:p.child.parts.length?2:1,code:p.code})+' />');lines.push('    </no.'+n.id+'>');
   }
   lines.push('  </panel'+panel+'>');panels.push({panel,sourceBoardId:board.id,name:board.name,sourceLength:board.length,sourceWidth:board.width,nativeLength:W,nativeWidth:H,swapped,flipY,maxLayer,nodes:serial});
  }
  if(!panels.length)throw Error('Wybrane płyty są puste — nie ma rozkroju do eksportu MCUT.');
  lines.push('</project>');return{text:lines.join('\r\n'),metadata:{format:'PlanerNativeLabels',version:1,projectName:project.name||'',orderName:project.orderName||project.name||'',paperMm:{width:80,height:60},nativePreSizeImportVerified:false,nativeLabelTableBindingVerified:false,panels,rows},warnings};
 }
 function csv(metadata){const keys=['Panel','Node','PartName','PartLength','PartWidth','Code','Barcode(Code)','Material','Thickness','Project','OrderName','EdgeD1','EdgeD2','EdgeS1','EdgeS2','ShortDimension','LongDimension','Code2'],q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\uFEFF'+[keys.map(q).join(';'),...metadata.rows.map(r=>keys.map(k=>q(k==='Panel'?r.panel:k==='Node'?r.node:r.values[k])).join(';'))].join('\r\n');}
 root.PlannerMcutNative={build,csv};
})(typeof globalThis!=='undefined'?globalThis:this);
