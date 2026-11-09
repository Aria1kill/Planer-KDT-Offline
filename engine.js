/* Local, dependency-free data and guillotine layout engine. Coordinates: top-left, millimetres. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.PlannerEngine=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
 "use strict";
 const EPS=1e-6;
 const number=v=>{const n=Number(String(v??"").trim().replace(",","."));return Number.isFinite(n)?n:0;};
 const fmt=n=>String(Number(Number(n).toFixed(4)));
 const group=p=>String(p.material||"").trim()+"|"+number(p.thickness);
 const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));
 function decodeCSV(buffer){
  const bytes=new Uint8Array(buffer);
  if(bytes[0]===255&&bytes[1]===254)return{encoding:"UTF-16 LE",text:new TextDecoder("utf-16le").decode(bytes)};
  if(bytes[0]===254&&bytes[1]===255)return{encoding:"UTF-16 BE",text:new TextDecoder("utf-16be").decode(bytes)};
  try{return{encoding:"UTF-8",text:new TextDecoder("utf-8",{fatal:true}).decode(bytes)};}
  catch{return{encoding:"Windows-1250",text:new TextDecoder("windows-1250").decode(bytes)};}
 }
 function csvRows(text,delimiter){
  text=String(text).replace(/^\uFEFF/,"");
  if(!delimiter){const line=text.split(/\r?\n/).find(x=>x.trim())||"";delimiter=[";",",","\t"].sort((a,b)=>line.split(b).length-line.split(a).length)[0];}
  const rows=[];let row=[],cell="",quote=false;
  for(let i=0;i<text.length;i++){
   const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}
   else if(c===delimiter&&!quote){row.push(cell);cell="";}
   else if((c==="\n"||c==="\r")&&!quote){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell="";}
   else cell+=c;
  }
  if(quote)throw Error("Niedomknięty cudzysłów w CSV.");
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  return{rows,delimiter};
 }
 function materialInfo(raw){const m=String(raw||"").trim().match(/^(.+)-(\d+(?:[.,]\d+)?)\s*(?:mm)?$/i);return m?{material:m[1],thickness:number(m[2])}:{material:String(raw||"").trim(),thickness:0};}
 function parseCSV(text){
  const {rows,delimiter}=csvRows(text);if(!rows.length)throw Error("Plik CSV jest pusty.");
  const norm=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").toLowerCase().trim();
  const aliases={name:["nazwa","name","element"],material:["material","material-grubosc","material-thickness"],length:["dlugosc","length","l"],width:["szerokosc","width","w","height"],qty:["ilosc","qty","quantity","szt"],lock:["blokadaobrotu","rotationlock","blokada obrotu"],code:["kod","code"],thickness:["grubosc","thickness"],e1:["okldlugosc1","edgelength1"],e2:["okldlugosc2","edgelength2"],e3:["oklszerokosc1","edgewidth1"],e4:["oklszerokosc2","edgewidth2"]};
  const first=rows[0].map(norm),map={};for(const [key,words]of Object.entries(aliases))map[key]=first.findIndex(v=>words.includes(v));
  const header=map.length>=0&&map.width>=0;
  const extended=header?map.material>=0:rows[0].length>=5;
  const defaults=extended?{name:0,material:1,length:2,width:3,qty:4,lock:5,e1:6,e2:7,e3:8,e4:9,code:10,thickness:-1}:{name:0,length:1,width:2,qty:3,material:-1,lock:-1,e1:-1,e2:-1,e3:-1,e4:-1,code:-1,thickness:-1};
  const cols=header?map:defaults,parts=[],errors=[];
  for(let i=header?1:0;i<rows.length;i++){
   const r=rows[i],get=key=>cols[key]>=0?String(r[cols[key]]??"").trim():"",mat=materialInfo(get("material"));
   const length=number(get("length")),width=number(get("width")),qty=get("qty")===""?1:number(get("qty"));
   if(!(length>0&&width>0&&Number.isInteger(qty)&&qty>0)){errors.push({line:i+1,row:r,message:"Wymiary muszą być dodatnie, a ilość całkowita."});continue;}
   const lock=["true","1","tak","yes"].includes(get("lock").toLowerCase());
   parts.push({id:"csv-"+(i+1),name:get("name")||"Element "+(i+1),material:mat.material,materialRaw:get("material"),thickness:number(get("thickness"))||mat.thickness,length,width,qty,canRotate:!lock,edges:["e1","e2","e3","e4"].map(k=>number(get(k))),code:get("code"),raw:r.slice(),rawHeaders:header?rows[0].slice():null,sourceLine:i+1});
  }
  if(!parts.length)throw Error("Nie znaleziono poprawnych pozycji CSV.");
  return{parts,errors,delimiter,header,columns:cols};
 }
 function freeNode(id,x,y,w,h){return{id,x,y,w,h,axis:null,cut:0,kerf:0,children:[],piece:null,waste:true};}
 function leaves(node,out=[]){if(!node)return out;if(!node.children?.length)out.push(node);else node.children.forEach(n=>leaves(n,out));return out;}
 function nodes(node,out=[]){if(!node)return out;out.push(node);node.children?.forEach(n=>nodes(n,out));return out;}
 function createBoard(stock,nid,serial=1){
  const b={id:stock.id+"-"+serial,name:(stock.name||"Płyta")+" · "+serial,stockId:stock.id,length:stock.length,width:stock.width,thickness:stock.thickness,material:stock.material,kerf:stock.kerf,trim:stock.trim,auto:!!stock.auto};
  b.root=freeNode(nid(),stock.trim,stock.trim,stock.length-2*stock.trim,stock.width-2*stock.trim);return b;
 }
 function packInto(node,piece,w,h,rotated,policy,nid,kerf){
  const setPiece=n=>{n.piece={...piece,rotated};n.waste=false;};
  function split(n,axis,size){
   const dim=axis==="x"?n.w:n.h,diff=dim-size;
   if(diff<=EPS)return n;
   n.axis=axis;n.cut=size;n.kerf=Math.min(kerf,diff);n.waste=false;
   const a=freeNode(nid(),n.x,n.y,axis==="x"?size:n.w,axis==="y"?size:n.h);n.children=[a];
   const left=dim-size-n.kerf;if(left>EPS)n.children.push(freeNode(nid(),axis==="x"?n.x+size+n.kerf:n.x,axis==="y"?n.y+size+n.kerf:n.y,axis==="x"?left:n.w,axis==="y"?left:n.h));
   return a;
  }
  const dw=node.w-w,dh=node.h-h;
  const horizontal=policy==="h"||policy==="auto"&&dw*h<dh*w;
  let target;if(horizontal){target=split(node,"y",h);target=split(target,"x",w);}else{target=split(node,"x",w);target=split(target,"y",h);}
  setPiece(target);
 }
 function optimize(parts,stocks,template,allowAuto=true,options={}){
  for(const p of parts)if(!(p.length>0&&p.width>0&&Number.isInteger(p.qty)&&p.qty>0))throw Error("Niepoprawne wymiary lub ilość elementu: "+p.name);
  if(allowAuto&&!(template.length>2*template.trim&&template.width>2*template.trim&&template.trim>=0&&template.kerf>=0))throw Error("Niepoprawna płyta wzorcowa.");
  const quantities=parts.reduce((s,p)=>s+p.qty,0);if(quantities>5000)throw Error("Jednorazowy rozkrój obsługuje do 5000 sztuk.");
  for(const s of stocks){if(!(s.length>2*s.trim&&s.width>2*s.trim&&s.kerf>=0&&s.trim>=0&&Number.isInteger(s.qty)&&s.qty>0))throw Error("Niepoprawne wymiary lub ilość płyty: "+s.name);}
  const expanded=[];for(const p of parts)for(let i=0;i<p.qty;i++)expanded.push({...p,instanceId:p.id+"@"+(i+1),copy:i+1});
  const sorts=options.sorts||[(a,b)=>b.length*b.width-a.length*a.width,(a,b)=>Math.max(b.length,b.width)-Math.max(a.length,a.width),(a,b)=>b.length-a.length,(a,b)=>b.width-a.width];
  let best=null;
  for(const sort of sorts)for(const policy of options.policies||["auto","h","v"]){
   let seq=0;const nid=()=>"n"+(++seq),sheets=[],unplaced=[],used=new Map(),serials=new Map();
   const make=stock=>{const k=(serials.get(stock.id)||0)+1;serials.set(stock.id,k);const b=createBoard(stock,nid,k);sheets.push(b);used.set(stock.id,(used.get(stock.id)||0)+1);return b;};
   for(const p of expanded.slice().sort(sort)){
    if(!(p.thickness>0)||(!p.material&&!stocks.some(s=>group(s)===group(p)))){unplaced.push({piece:p,reason:"Uzupełnij materiał i grubość."});continue;}
    const candidates=stocks.filter(s=>group(s)===group(p));
    const autos=allowAuto?(candidates.length?candidates.map(s=>({...s,auto:true,id:"auto-"+s.id})): [{...template,id:"auto-"+group(p),name:p.material+" "+p.thickness+" mm",material:p.material,thickness:p.thickness,auto:true}]):[];
    let choice=null;
    function inspect(b){
     for(const n of leaves(b.root).filter(n=>n.waste))for(const rot of p.canRotate?[false,true]:[false]){
      const w=rot?p.width:p.length,h=rot?p.length:p.width;if(w>n.w+EPS||h>n.h+EPS)continue;
      const dw=n.w-w,dh=n.h-h;
      const score=options.selection==='short'?Math.min(dw,dh)*1e7+Math.max(dw,dh):options.selection==='long'?Math.max(dw,dh)*1e7+Math.min(dw,dh):(n.w*n.h-w*h)*1e4+Math.min(dw,dh);
      if(!choice||score<choice.score)choice={b,n,w,h,rot,score};
     }
    }
    sheets.filter(b=>group(b)===group(p)).forEach(inspect);
    if(!choice){
     const stock=candidates.find(s=>(used.get(s.id)||0)<s.qty&&fits(p,s))||autos.find(s=>fits(p,s));
     if(stock)inspect(make(stock));
    }
    if(!choice){unplaced.push({piece:p,reason:candidates.length||allowAuto?"Element nie mieści się na dostępnej płycie lub blokuje go kierunek słojów.":"Brak płyty dla materiału i grubości."});continue;}
    packInto(choice.n,p,choice.w,choice.h,choice.rot,policy,nid,choice.b.kerf);
   }
   const area=sheets.reduce((s,b)=>s+b.length*b.width,0),cuts=sheets.reduce((s,b)=>s+nodes(b.root).filter(n=>n.axis).length,0);
   const score=options.rank?options.rank({sheets,unplaced}):[unplaced.length,sheets.length,area,cuts];
   if(!best||score.some((v,i)=>v<best.score[i]&&score.slice(0,i).every((x,j)=>x===best.score[j])))best={sheets,unplaced,score};
  }
  return best||{sheets:[],unplaced:[],score:[0,0,0,0]};
 }
 function fits(p,s){const w=s.length-2*s.trim,h=s.width-2*s.trim;return p.length<=w+EPS&&p.width<=h+EPS||p.canRotate&&p.width<=w+EPS&&p.length<=h+EPS;}
 function sequence(board){
  if(typeof globalThis.PlannerProcess!=="undefined")return globalThis.PlannerProcess.sequence(board);
  const out=[];
  function visit(n,depth){
   if(n.axis){out.push({id:board.id+":"+n.id,sheetId:board.id,source:n,axis:n.axis,cut:n.cut,kerf:n.kerf,children:n.children,depth});n.children.forEach(c=>visit(c,depth+1));}
  }
  visit(board.root,1);return out;
 }
 function inventory(board,step){
  if(typeof globalThis.PlannerProcess!=="undefined")return globalThis.PlannerProcess.inventory(board,step);
  const available=new Map([[board.root.id,board.root]]),finished=[];
  for(const op of sequence(board).slice(0,step)){available.delete(op.source.id);for(const c of op.children){if(c.piece)finished.push(c);else if(c.children.length)available.set(c.id,c);}}
  return{available:[...available.values()],finished};
 }
 function validate(sheets){
  const errors=[],seen=new Set();
  for(const b of sheets){
   const ls=leaves(b.root).filter(n=>n.piece);
   for(const n of ls){
    const p=n.piece;if(seen.has(p.instanceId))errors.push("Powtórzony element "+p.instanceId);seen.add(p.instanceId);
    if(n.x<b.trim-EPS||n.y<b.trim-EPS||n.x+n.w>b.length-b.trim+EPS||n.y+n.h>b.width-b.trim+EPS)errors.push("Element poza płytą "+p.name);
    if(group(p)!==group(b))errors.push("Niezgodny materiał "+p.name);
    const w=p.rotated?p.width:p.length,h=p.rotated?p.length:p.width;
    if(Math.abs(n.w-w)>.001||Math.abs(n.h-h)>.001)errors.push("Niezgodny wymiar "+p.name);
    if(p.rotated&&!p.canRotate)errors.push("Niedozwolony obrót "+p.name);
   }
   for(let i=0;i<ls.length;i++)for(let j=i+1;j<ls.length;j++){const a=ls[i],c=ls[j];if(a.x<c.x+c.w-EPS&&a.x+a.w>c.x+EPS&&a.y<c.y+c.h-EPS&&a.y+a.h>c.y+EPS)errors.push("Nakładanie elementów.");}
  }return errors;
 }
 // Code128-B table from the user's existing IBRON label renderer.
 const C128=['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112'];
 function code128(text){
  if(!text||/[^\x20-\x7e]/.test(text))throw Error("Code 128 wymaga kodu z drukowalnych znaków ASCII. Oryginalnego kodu nie zmieniono.");
  const values=[...text].map(c=>c.charCodeAt(0)-32);return[104,...values,(104+values.reduce((s,v,i)=>s+v*(i+1),0))%103,106];
 }
 function barcodeSVG(text){
  const values=code128(text);let x=12,bars="";
  for(const v of values){let black=true;for(const d of C128[v]){const w=Number(d);if(black)bars+='<rect x="'+x+'" y="0" width="'+w+'" height="45"/>';x+=w;black=!black;}}
  return'<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+escape(text)+'" viewBox="0 0 '+(x+12)+' 45" preserveAspectRatio="none"><g fill="#111">'+bars+'</g></svg>';
 }
 return{number,fmt,group,escape,decodeCSV,csvRows,parseCSV,materialInfo,freeNode,leaves,nodes,createBoard,optimize,fits,sequence,inventory,validate,code128,barcodeSVG};
});
