/* Drawing records verified against local .NET Color/Bitmap serialization and LabelDesign metadata. */
(function(root){
 'use strict';
 const primitive=(type,value)=>({kind:'primitive',primitiveType:type,value}),ref=n=>({t:9,ref:n.id}),nil=()=>({t:10});
 function replace(doc,n,name,specs,base){const old=n.meta,fields=n.fields;old.names.forEach((key,i)=>{if(base(key))specs.push({name:key,type:old.types[i],info:old.infos[i],value:fields[i]});});n.t=5;delete n.header;n.meta={id:n.id,name,names:specs.map(s=>s.name),types:specs.map(s=>s.type),infos:specs.map(s=>s.info??null),library:old.library};n.fields=specs.map(s=>s.value);doc.schemas.set(n.id,n.meta);return n;}
 function bounds(doc,n,r,name){const location=doc.get(n,'Shape+_location'),size=doc.get(n,'Shape+_sizef');doc.set(location,'x',r.x);doc.set(location,'y',r.y);doc.set(size,'width',r.width);doc.set(size,'height',r.height);doc.set(n,'Shape+_name',name);doc.set(n,'Shape+_select',false);}
 function image(doc,r,png,name='Logo IBRON'){
  const n=doc.shape(doc.add('text')),native=n.meta.library,drawing=doc.get(n,'_font').meta.library,bytes=doc.createBytes(Uint8Array.from(atob(png),c=>c.charCodeAt(0))),bitmap=doc.createClass('System.Drawing.Bitmap',[{name:'Data',type:7,info:2,value:ref(bytes)}],drawing),mode=doc.createClass('LabelDesign.ImageSizeMode',[{name:'value__',type:0,info:8,value:primitive(8,1)}],native,true);
  replace(doc,n,'LabelDesign.Image',[{name:'_bmp',type:4,info:{name:'System.Drawing.Bitmap',library:drawing},value:ref(bitmap)},{name:'_sizeMode',type:4,info:{name:'LabelDesign.ImageSizeMode',library:native},value:ref(mode)}],key=>key.includes('+'));
  for(const key of n.meta.names.filter(k=>k.endsWith('+_dataSourse')||k.endsWith('+_dataSourseInside')))doc.set(n,key,null);bounds(doc,n,r,name);return n;
 }
 function line(doc,r,name,color='#2ca752',width=2.8){
  const n=doc.shape(doc.add('text')),drawing=doc.get(n,'_font').meta.library,argb=BigInt(0xff000000+parseInt(color.replace('#',''),16)),c=doc.createClass('System.Drawing.Color',[{name:'name',type:1,value:nil()},{name:'value',type:0,info:9,value:primitive(9,argb)},{name:'knownColor',type:0,info:7,value:primitive(7,0)},{name:'state',type:0,info:7,value:primitive(7,2)}],drawing,true);
  replace(doc,n,'LabelDesign.LDLine',[{name:'Figures+_penColor',type:4,info:{name:'System.Drawing.Color',library:drawing},value:ref(c)},{name:'Figures+_penWidth',type:0,info:11,value:primitive(11,width)}],key=>key.startsWith('Shape+'));
  bounds(doc,n,r,name);return n;
 }
 const cache=new WeakMap();
 function info(doc,n){if(n.meta.name==='LabelDesign.Image'){const bytes=doc.get(doc.get(n,'_bmp'),'Data');if(!bytes?.entries)return{image:true,url:''};if(!cache.has(bytes)){let binary='';const values=bytes.entries.map(v=>v.value);for(let i=0;i<values.length;i+=32768)binary+=String.fromCharCode(...values.slice(i,i+32768));cache.set(bytes,'data:image/png;base64,'+btoa(binary));}return{image:true,url:cache.get(bytes)};}
  if(n.meta.name==='LabelDesign.LDLine'){const c=doc.get(n,'Figures+_penColor'),v=Number(doc.get(c,'value')||0);return{line:true,color:'#'+(v%16777216).toString(16).padStart(6,'0'),alpha:Math.floor(v/16777216)/255,widthPen:doc.get(n,'Figures+_penWidth')||1};}return{};
 }
 function textDirection(doc,n,value){let member=doc.get(n,'_stringFormatDirection');if(member){doc.set(member,'value__',value);return;}const old=n.meta,en=doc.createClass('LabelDesign.BarcodeOrientation',[{name:'value__',type:0,info:8,value:primitive(8,value)}],old.library,true);n.t=5;delete n.header;n.meta={...old,id:n.id,names:[...old.names,'_stringFormatDirection'],types:[...old.types,4],infos:[...old.infos,{name:'LabelDesign.BarcodeOrientation',library:old.library}]};n.fields.push(ref(en));doc.schemas.set(n.id,n.meta);}
 root.PlannerLbldGraphics={image,line,info,textDirection};
})(typeof globalThis!=='undefined'?globalThis:this);
