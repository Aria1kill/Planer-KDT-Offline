/* MCUT adapter: reads the supplied XML shape into the editor's own cut tree. */
(function(){
 const E=PlannerEngine;
 function readMcut(text){
  const d=new DOMParser().parseFromString(text.replace(/^\uFEFF/,""),"application/xml");
  if(d.querySelector("parsererror"))throw Error("Niepoprawny XML MCUT.");
  if(d.documentElement.getAttribute('generatedBy')==='PlanerOffline'&&d.documentElement.getAttribute('previewOnly')==='true')return readPreview(d,text);
  const panels=[...d.documentElement.children].filter(el=>/^panel\d+$/i.test(el.localName));
  if(!panels.length)throw Error("Brak paneli w pliku MCUT.");
  let seq=0;const nid=()=>"m"+(++seq),parts=[],stocks=[],sheets=[];
  panels.forEach((p,pi)=>{
   const stock={id:"mstock"+pi,name:"Płyta MCUT "+(pi+1),length:E.number(p.getAttribute("w")),width:E.number(p.getAttribute("l")),material:p.getAttribute("material")||"",thickness:E.number(p.getAttribute("thickness")),kerf:E.number(p.getAttribute("saw")),trim:0,qty:Math.max(1,E.number(p.getAttribute("num"))||1)};
   if(!(stock.length>0&&stock.width>0))throw Error("Niepoprawny wymiar płyty MCUT.");
   const els=[...p.children].filter(n=>n.localName.startsWith("no.")),map=new Map(els.map(n=>[n.getAttribute("id"),n]));
   const root=els.find(n=>n.getAttribute("id")==="1")||els[0];
   if(!root)throw Error("Brak węzłów no.N w MCUT.");
   const active=new Set();
   function build(xml,rect,parentAxis,code){
    const rawId=xml.getAttribute("id");if(active.has(rawId))throw Error("Zapętlone odwołanie id w MCUT.");active.add(rawId);
    const cuts=[...xml.children].filter(n=>n.localName==="part");
    if(!cuts.length){
     const c=xml.getAttribute("code")||code||"",name=xml.getAttribute("name")||(c&&c!=="null"?c:"Element #"+rawId);
     const part={id:"mp"+pi+"-"+rawId,name,code:c==="null"?"":c,length:E.number(xml.getAttribute("origW"))||rect.w,width:E.number(xml.getAttribute("origH"))||rect.h,qty:1,canRotate:xml.getAttribute("canRotate")!=="0",material:xml.getAttribute("material")||stock.material,materialRaw:xml.getAttribute("materialRaw")||stock.material,thickness:E.number(xml.getAttribute("thickness"))||stock.thickness,edges:[1,2,3,4].map(i=>E.number(xml.getAttribute("edgeBand"+i))),raw:[],sourceMcutId:rawId};
     parts.push(part);const n=E.freeNode(nid(),rect.x,rect.y,rect.w,rect.h);n.piece={...part,instanceId:part.id+"@1",copy:1,rotated:xml.getAttribute("rotated")==="1"};n.waste=false;active.delete(rawId);return n;
    }
    const linked=cuts.map(c=>map.get(c.getAttribute("id"))).filter(Boolean);
    const xs=linked.map(x=>E.number(x.getAttribute("x"))),ys=linked.map(x=>E.number(x.getAttribute("y")));
    const dx=xs.length?Math.max(...xs)-Math.min(...xs):0,dy=ys.length?Math.max(...ys)-Math.min(...ys):0;
    const axis=dx>1e-5||dy>1e-5?(dx>dy?"x":"y"):(parentAxis?(parentAxis==="x"?"y":"x"):"y");
    const trim=E.number(xml.getAttribute("trim"));
    let r={...rect};if(axis==="x"){r.x+=trim;r.w-=trim;}else{r.y+=trim;r.h-=trim;}
    const head=E.freeNode(nid(),r.x,r.y,r.w,r.h);let current=head;
    cuts.forEach((c,index)=>{
     const childXML=map.get(c.getAttribute("id")),size=E.number(c.getAttribute("cut"));if(!(size>0))return;
     const dim=axis==="x"?current.w:current.h;if(size>dim+.5)throw Error("Cięcie MCUT wykracza poza segment.");
     const childRect={x:current.x,y:current.y,w:axis==="x"?size:current.w,h:axis==="y"?size:current.h};
     if(childXML){if(childXML.hasAttribute("x"))childRect.x=E.number(childXML.getAttribute("x"));if(childXML.hasAttribute("y"))childRect.y=E.number(childXML.getAttribute("y"));}
     let child;
     if(childXML)child=build(childXML,childRect,axis,c.getAttribute("code"));
     else{child=E.freeNode(nid(),childRect.x,childRect.y,childRect.w,childRect.h);child.waste=true;}
     current.axis=axis;current.cut=size;current.kerf=Math.min(stock.kerf,Math.max(0,dim-size));current.waste=false;current.children=[child];current.nativeType=c.getAttribute("type");
     const rest=dim-size-current.kerf;
     if(rest>1e-6){const next=E.freeNode(nid(),axis==="x"?childRect.x+size+current.kerf:current.x,axis==="y"?childRect.y+size+current.kerf:current.y,axis==="x"?rest:current.w,axis==="y"?rest:current.h);current.children.push(next);current=next;}
     else if(index<cuts.length-1)throw Error("Brak miejsca na dalsze cięcia MCUT.");
    });
    active.delete(rawId);
    if(trim>0){
     const kerf=Math.min(stock.kerf,trim),off=E.freeNode(nid(),rect.x,rect.y,axis==='x'?trim-kerf:rect.w,axis==='y'?trim-kerf:rect.h);off.trimWaste=true;
     return{...E.freeNode(nid(),rect.x,rect.y,rect.w,rect.h),axis,cut:trim-kerf,kerf,children:[off,head],waste:false,kind:'trim',edge:'lokalne MCUT',allowance:trim,nativeId:rawId};
    }
    return head;
   }
   const tree=build(root,{x:0,y:0,w:stock.length,h:stock.width},null,"");
   // Native coordinates in this sample use the bottom edge as y=0.
   E.nodes(tree).forEach(n=>{n.y=stock.width-n.y-n.h;if(n.axis==='y')n.fromEnd=true;});
   stocks.push(stock);
   for(let i=0;i<stock.qty;i++){
    const b={...stock,id:stock.id+"@"+(i+1),root:structuredClone(tree),imported:true};
    E.leaves(b.root).filter(n=>n.piece).forEach(n=>{n.piece.instanceId=n.piece.id+"@"+(i+1);});
    sheets.push(b);
   }
   if(stock.qty>1)parts.filter(x=>x.id.startsWith("mp"+pi+"-")).forEach(x=>x.qty=stock.qty);
  });
  return{parts,stocks,sheets,sourceMcut:text};
 }
 function readPreview(d,text){
  const panels=[...d.documentElement.children].filter(n=>/^panel\d+$/i.test(n.localName)),parts=[],stocks=[],sheets=[];
  if(!panels.length)throw Error('Brak płyt w MCUT.');
  panels.forEach((panel,pi)=>{
   const stock={id:'preview'+pi,name:panel.getAttribute('name')||'Płyta '+(pi+1),length:E.number(panel.getAttribute('w')),width:E.number(panel.getAttribute('l')),material:panel.getAttribute('material')||'',thickness:E.number(panel.getAttribute('thickness')),kerf:E.number(panel.getAttribute('saw')),trim:0,qty:1};
   if(!(stock.length>0&&stock.width>0))throw Error('Niepoprawny wymiar płyty.');
   const nodes=[...panel.children].filter(n=>/^no\.\d+$/.test(n.localName)),map=new Map(nodes.map(n=>[n.getAttribute('id'),n])),labels=new Map([...panel.querySelectorAll('labelData > label')].map(n=>[n.getAttribute('node'),n])),active=new Set(),seen=new Set();
   function build(id){if(active.has(id)||seen.has(id))throw Error('Powtórzone lub zapętlone odwołanie MCUT.');const el=map.get(id);if(!el)throw Error('Brak segmentu MCUT: '+id);active.add(id);seen.add(id);
    const w=E.number(el.getAttribute('geometryWidth')),h=E.number(el.getAttribute('geometryHeight'));if(w<0||h<0)throw Error('Ujemny rozmiar segmentu MCUT.');
    const n=E.freeNode('preview'+pi+'-'+id,E.number(el.getAttribute('x')),stock.width-E.number(el.getAttribute('y'))-h,w,h),children=[...el.children].filter(n=>n.localName==='part');
    if(children.length){n.axis=el.getAttribute('axis');if(!['x','y'].includes(n.axis))throw Error('Brak osi cięcia.');n.cut=E.number(el.getAttribute('cut'));n.kerf=E.number(el.getAttribute('kerf'));n.fromEnd=n.axis==='y'&&el.getAttribute('startSide')==='bottom';n.kind=el.getAttribute('kind')||'cut';n.allowance=E.number(el.getAttribute('trim'));n.waste=false;n.children=children.map(c=>build(c.getAttribute('id')));}
    else if(el.getAttribute('kind')==='part'){
     const label=labels.get(id),v=Object.fromEntries([...(label?.querySelectorAll('field')||[])].map(f=>[f.getAttribute('name'),f.textContent])),rawNodes=[...(label?.querySelectorAll('sourceColumn')||[])];
     const part={id:'previewpart'+pi+'-'+id,name:v.PartName??el.getAttribute('name')??'',code:v.Code??el.getAttribute('code')??'',code2:v.Code2||'',length:E.number(v.PartLength??el.getAttribute('origW'))||w,width:E.number(v.PartWidth??el.getAttribute('origH'))||h,material:v.Material??stock.material,thickness:E.number(v.Thickness??stock.thickness),qty:1,canRotate:el.getAttribute('canRotate')!=='0',edges:[1,2,3,4].map(i=>E.number(el.getAttribute('edgeBand'+i))),raw:rawNodes.map(n=>n.textContent),rawHeaders:rawNodes.map(n=>n.getAttribute('header')||'')};
     parts.push(part);n.piece={...part,copy:E.number(v.Copy)||1,instanceId:part.id+'@1',rotated:el.getAttribute('rotated')==='1'};n.waste=false;
    }else n.trimWaste=el.getAttribute('kind')==='trimWaste';
    active.delete(id);return n;
   }
   const root=build('1'),board={...stock,id:stock.id+'@1',stockId:stock.id,root,cutOrder:panel.querySelector('execution')?.getAttribute('policy')==='finish-strip'?'strip':'parallel'};
   if(Math.abs(root.w-stock.length)>.01||Math.abs(root.h-stock.width)>.01)throw Error('Wymiar korzenia nie odpowiada płycie.');
   for(const n of E.nodes(root)){if(!n.axis)continue;const sum=n.children.reduce((s,c)=>s+c.w*c.h,0)+n.kerf*(n.axis==='x'?n.h:n.w);if(Math.abs(sum-n.w*n.h)>Math.max(.02,n.w*n.h*1e-7))throw Error('Segmenty MCUT nie zachowują wymiarów.');}
   stocks.push(stock);sheets.push(board);
  });
  return{parts,stocks,sheets,sourceMcut:text,sourceMcutPreview:true,name:d.documentElement.getAttribute('projectName')||''};
 }
 window.PlannerFiles={readMcut};
})();
