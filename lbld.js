/* Bounded NRBF data reader/writer. Does not load assemblies or instantiate .NET types. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LBLD=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 class Reader{
  constructor(bytes){this.bytes=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);assert(this.bytes.length<=1048576,'Szablon jest zbyt duży (limit 1 MB).');this.view=new DataView(this.bytes.buffer,this.bytes.byteOffset,this.bytes.byteLength);this.pos=0;this.schemas=new Map();this.objects=new Map();this.count=0;}
  take(n){assert(n>=0&&this.pos+n<=this.bytes.length,'Niepełny plik LBLD.');const b=this.bytes.slice(this.pos,this.pos+n);this.pos+=n;return b;}
  num(method,n){assert(this.pos+n<=this.bytes.length,'Niepełna wartość LBLD.');const v=this.view[method](this.pos,true);this.pos+=n;return v;}
  u8(){return this.num('getUint8',1);}i32(){return this.num('getInt32',4);}
  str(){let n=0,shift=0;for(let i=0;i<5;i++){const b=this.u8();n+=(b&127)*2**shift;if(!(b&128))return decoder.decode(this.take(n));shift+=7;}throw Error('Niepoprawny tekst LBLD.');}
  primitive(type){let value;switch(type){case 1:value=!!this.u8();break;case 2:value=this.u8();break;case 6:value=this.num('getFloat64',8);break;case 7:value=this.num('getInt16',2);break;case 8:value=this.i32();break;case 9:case 12:case 13:value=this.num('getBigInt64',8);break;case 10:value=this.num('getInt8',1);break;case 11:value=this.num('getFloat32',4);break;case 14:value=this.num('getUint16',2);break;case 15:value=this.num('getUint32',4);break;case 16:value=this.num('getBigUint64',8);break;case 5:case 18:value=this.str();break;case 17:value=null;break;default:throw Error('Nieobsługiwany typ wartości '+type);}
   return{kind:'primitive',primitiveType:type,value};}
  info(t){if(t===0||t===7)return this.u8();if(t===3)return this.str();if(t===4)return{name:this.str(),library:this.i32()};assert([1,2,5,6].includes(t),'Nieobsługiwany typ pola.');return null;}
  value(t,info){if(t===0)return this.primitive(info);const prefix=[];let r=this.record();while(r.t===12){prefix.push(r);r=this.record();}if(prefix.length)r.prefix=prefix;return r;}
  fields(r){r.fields=r.meta.types.map((t,i)=>this.value(t,r.meta.infos[i]));return r;}
  register(r){assert(!this.objects.has(r.id),'Powtórzony identyfikator w pliku.');this.objects.set(r.id,r);return r;}
  entries(r,type,info,n){assert(n>=0&&n<=(type===0&&info===2?262144:10000),'Przekroczono rozmiar tablicy.');r.entries=[];let seen=0;while(seen<n){const value=this.value(type,info);r.entries.push(value);seen+=value.t===13||value.t===14?value.n:1;}assert(seen===n,'Niepoprawna liczba pól tablicy.');return r;}
  record(){assert(++this.count<=30000,'Przekroczono liczbę rekordów LBLD.');const start=this.pos,t=this.u8();let r={t};
   if(t===0){r.values=[this.i32(),this.i32(),this.i32(),this.i32()];return r;}
   if(t===12){r.id=this.i32();r.name=this.str();return r;}
   if(t===4||t===5){r.id=this.i32();const name=this.str(),n=this.i32();assert(n>=0&&n<=500,'Zbyt wiele pól klasy.');const names=Array.from({length:n},()=>this.str()),types=Array.from({length:n},()=>this.u8()),infos=types.map(v=>this.info(v)),library=t===5?this.i32():null;r.meta={id:r.id,name,names,types,infos,library};r.header=this.bytes.slice(start,this.pos);this.schemas.set(r.id,r.meta);this.register(r);return this.fields(r);}
   if(t===1){r.id=this.i32();r.metadataId=this.i32();r.meta=this.schemas.get(r.metadataId);assert(r.meta,'Brak opisu klasy w pliku.');this.register(r);return this.fields(r);}
   if(t===6){r.id=this.i32();r.value=this.str();return this.register(r);}
   if(t===7){r.id=this.i32();r.arrayKind=this.u8();r.rank=this.i32();assert(r.rank>0&&r.rank<=8,'Nieobsługiwany wymiar tablicy.');r.lengths=Array.from({length:r.rank},()=>this.i32());r.lower=[3,4,5].includes(r.arrayKind)?Array.from({length:r.rank},()=>this.i32()):[];r.binaryType=this.u8();r.typeInfo=this.info(r.binaryType);this.register(r);return this.entries(r,r.binaryType,r.typeInfo,r.lengths.reduce((a,b)=>a*b,1));}
   if(t===8){r.data=this.primitive(this.u8());return r;}
   if(t===9){r.ref=this.i32();return r;}
   if(t===10||t===11)return r;
   if(t===13||t===14){r.n=t===13?this.u8():this.i32();assert(r.n>0,'Niepoprawny pusty rekord.');return r;}
   if([15,16,17].includes(t)){r.id=this.i32();r.lengths=[this.i32()];r.binaryType=t===15?0:t===17?1:2;r.typeInfo=t===15?this.u8():null;this.register(r);return this.entries(r,r.binaryType,r.typeInfo,r.lengths[0]);}
   throw Error('Nieobsługiwany rekord LBLD: '+t+'. Plik nie został zmieniony.');
  }
  parse(){const records=[];while(this.pos<this.bytes.length){const r=this.record();records.push(r);if(r.t===11)break;}assert(records[0]?.t===0&&records.at(-1)?.t===11&&this.pos===this.bytes.length,'Niepoprawna struktura LBLD.');return{records,objects:this.objects,schemas:this.schemas,rootId:records[0].values[0]};}
 }
 class Writer{
  constructor(){this.chunks=[];this.length=0;}
  bytes(b){this.chunks.push(b);this.length+=b.length;assert(this.length<=1048576,'Zapisany szablon przekroczył 1 MB.');}
  num(method,n,v){const b=new Uint8Array(n);new DataView(b.buffer)[method](0,v,true);this.bytes(b);}
  u8(v){this.num('setUint8',1,v);}i32(v){this.num('setInt32',4,v);}
  str(v){const b=encoder.encode(String(v));let n=b.length;do{const q=n%128;n=Math.floor(n/128);this.u8(q|(n?128:0));}while(n);this.bytes(b);}
  primitive(r){const t=r.primitiveType,v=r.value;const formats={2:['setUint8',1],6:['setFloat64',8],7:['setInt16',2],8:['setInt32',4],9:['setBigInt64',8],10:['setInt8',1],11:['setFloat32',4],12:['setBigInt64',8],13:['setBigInt64',8],14:['setUint16',2],15:['setUint32',4],16:['setBigUint64',8]};if(t===1)this.u8(v?1:0);else if(t===5||t===18)this.str(v);else if(t!==17){assert(formats[t],'Nieobsługiwany zapis wartości.');this.num(...formats[t],v);}}
  info(t,v){if(t===0||t===7)this.u8(v);else if(t===3)this.str(v);else if(t===4){this.str(v.name);this.i32(v.library);}}
  record(r){if(r.prefix)r.prefix.forEach(v=>this.record(v));if(r.kind==='primitive'){this.primitive(r);return;}
   if(r.t===4||r.t===5){if(r.header)this.bytes(r.header);else{this.u8(r.t);this.i32(r.id);this.str(r.meta.name);this.i32(r.meta.names.length);r.meta.names.forEach(v=>this.str(v));r.meta.types.forEach(v=>this.u8(v));r.meta.types.forEach((t,i)=>this.info(t,r.meta.infos[i]));if(r.t===5)this.i32(r.meta.library);}r.fields.forEach(v=>this.record(v));return;}
   this.u8(r.t);
   if(r.t===0){r.values.forEach(v=>this.i32(v));return;}
   if(r.t===12){this.i32(r.id);this.str(r.name);return;}
   if(r.t===1){this.i32(r.id);this.i32(r.metadataId);r.fields.forEach(v=>this.record(v));return;}
   if(r.t===6){this.i32(r.id);this.str(r.value);return;}
   if(r.t===7){this.i32(r.id);this.u8(r.arrayKind);this.i32(r.rank);r.lengths.forEach(v=>this.i32(v));r.lower.forEach(v=>this.i32(v));this.u8(r.binaryType);this.info(r.binaryType,r.typeInfo);r.entries.forEach(v=>this.record(v));return;}
   if(r.t===8){this.u8(r.data.primitiveType);this.primitive(r.data);return;}
   if(r.t===9){this.i32(r.ref);return;}
   if(r.t===13){this.u8(r.n);return;}if(r.t===14){this.i32(r.n);return;}
   if([15,16,17].includes(r.t)){this.i32(r.id);this.i32(r.lengths[0]);if(r.t===15)this.u8(r.typeInfo);r.entries.forEach(v=>this.record(v));}
  }
  result(records){records.forEach(r=>this.record(r));const result=new Uint8Array(this.length);let at=0;for(const c of this.chunks){result.set(c,at);at+=c.length;}return result;}
 }
 class Document{
  constructor(bytes){Object.assign(this,new Reader(bytes).parse());this.nextId=Math.max(...[...this.objects.keys()].map(Math.abs))+1;this.copies=new Set();this.templates={};
   const root=this.objects.get(this.rootId);assert(root?.meta?.name==='LabelDesign.ShapeCollection','To nie jest obsługiwany szablon LabelDesign.');this.list=this.get(root,'Collection`1+items');assert(this.list?.meta,'Brak listy elementów etykiety.');this.array=this.get(this.list,'_items');assert(this.array?.entries&&this.array.lengths.length===1,'Nieobsługiwany zapis listy elementów.');
   const count=this.get(this.list,'_size');this.items=[];for(const r of this.array.entries){if(r.t===13||r.t===14){for(let i=0;i<r.n;i++)this.items.push({t:10});}else this.items.push(r);}this.items=this.items.slice(0,count);
   assert(this.items.length<=300,'Edytor obsługuje do 300 obiektów.');for(const item of this.items){const node=this.resolve(item);if(node?.meta)this.templates[node.meta.name]=node;}
  }
  resolve(r){let depth=0;while(r?.t===9){r=this.objects.get(r.ref);assert(++depth<100&&r,'Niepoprawne odwołanie w szablonie.');}return r;}
  get(node,name){node=this.resolve(node);const i=node?.meta?.names.indexOf(name);if(!(i>=0))return undefined;const r=this.resolve(node.fields[i]);return r?.kind==='primitive'?r.value:r?.t===6?r.value:r?.t===10?null:r;}
  has(node,name){return this.resolve(node)?.meta?.names.includes(name);}
  shape(index){return this.resolve(this.items[index]);}
  shapes(){return this.items.map((r,i)=>({index:i,node:this.resolve(r)}));}
  insertRecord(r){this.records.splice(this.records.length-1,0,r);if(r.id!==undefined)this.objects.set(r.id,r);return r;}
  createClass(name,fields,library,valueType=false){const id=(valueType?-1:1)*this.nextId++,meta={id,name,names:fields.map(f=>f.name),types:fields.map(f=>f.type),infos:fields.map(f=>f.info??null),library};const r={t:library===null?4:5,id,meta,fields:fields.map(f=>f.value)};this.schemas.set(id,meta);this.insertRecord(r);return r;}
  createBytes(bytes){assert(bytes.length<=262144,'Grafika jest zbyt duża.');return this.insertRecord({t:15,id:this.nextId++,lengths:[bytes.length],binaryType:0,typeInfo:2,entries:Array.from(bytes,value=>({kind:'primitive',primitiveType:2,value}))});}
  clone(node){const memo=new Map();const copy=(token,top=false)=>{
    if(token.kind==='primitive')return{...token};
    if(token.t===9){const original=this.resolve(token);if(memo.has(original.id))return{t:9,ref:memo.get(original.id).id};const cloned=copy(original,true);return{t:9,ref:cloned.id};}
    if(token.id!==undefined&&memo.has(token.id))return{t:9,ref:memo.get(token.id).id};
    let r;
    if(token.t===6){r={t:6,id:this.nextId++,value:token.value};memo.set(token.id,r);this.objects.set(r.id,r);if(top)this.insertRecord(r);return r;}
    if(token.fields){const id=(token.id<0?-1:1)*this.nextId++;r={t:1,id,metadataId:token.meta.id,meta:token.meta,fields:[]};memo.set(token.id,r);this.objects.set(id,r);if(top)this.insertRecord(r);r.fields=token.fields.map(t=>copy(t));return r;}
    if(token.entries){r={...token,id:this.nextId++,lengths:token.lengths.slice(),entries:[]};memo.set(token.id,r);this.objects.set(r.id,r);if(top)this.insertRecord(r);r.entries=token.entries.map(t=>copy(t));return r;}
    assert([8,10,13,14].includes(token.t),'Tego obiektu nie można jeszcze powielić.');return token.t===8?{t:8,data:{...token.data}}:{...token,prefix:undefined};
   };return copy(node,true);}
  editable(index){let node=this.shape(index);if(!this.copies.has(node.id)){const old=this.items[index];if(old.t!==9&&old.id!==undefined&&!this.records.includes(old))this.insertRecord(old);node=this.clone(node);this.items[index]={t:9,ref:node.id};this.copies.add(node.id);}return node;}
  set(node,name,value){node=this.resolve(node);const i=node.meta.names.indexOf(name);assert(i>=0,'Brak pola '+name);const old=this.resolve(node.fields[i]);
   if(old?.kind==='primitive'){assert(typeof value==='boolean'||Number.isFinite(value)||typeof value==='bigint'&&[9,12,13,16].includes(old.primitiveType),'Niepoprawna wartość pola.');old.value=value;return;}
   if(value===null){if(node.fields[i].id!==undefined&&!this.records.includes(node.fields[i]))this.insertRecord(node.fields[i]);node.fields[i]={t:10};return;}
   assert(typeof value==='string','Nieobsługiwany rodzaj zmiany.');if(node.fields[i].t===6){const previous=node.fields[i];if(!this.records.includes(previous))this.insertRecord(previous);}
   const str=this.insertRecord({t:6,id:this.nextId++,value});node.fields[i]={t:9,ref:str.id};
  }
  add(type){assert(this.items.length<300,'Limit 300 obiektów.');const name=type==='qr'?'LabelDesign.QrCode':type==='code'?'LabelDesign.Code':'LabelDesign.Text',template=this.templates[name];assert(template,'W tym pliku nie ma wzorca tego typu obiektu. Wczytaj wzór IBRON z Code 128.');const node=this.clone(template);this.items.push({t:9,ref:node.id});this.copies.add(node.id);this.sync();return this.items.length-1;}
  duplicate(index){const node=this.clone(this.shape(index));this.items.splice(index+1,0,{t:9,ref:node.id});this.copies.add(node.id);this.sync();return index+1;}
  remove(index){const old=this.items[index];if(old?.id!==undefined&&!this.records.includes(old))this.insertRecord(old);this.items.splice(index,1);this.sync();}
  move(index,direction){const target=index+direction;if(target<0||target>=this.items.length)return index;[this.items[index],this.items[target]]=[this.items[target],this.items[index]];this.sync();return target;}
  sync(){this.array.entries=this.items.slice();this.array.lengths=[this.items.length];const i=this.list.meta.names.indexOf('_size');this.list.fields[i].value=this.items.length;const v=this.list.meta.names.indexOf('_version');if(v>=0)this.list.fields[v].value++;}
  save(){return this.compactSave();}
  compactSave(){
   this.sync();const queue=[],queued=new Set(),inline=new Set(),records=[],schemas=new Map();
   const enqueue=node=>{if(!queued.has(node.id)){queued.add(node.id);queue.push(node);}return{t:9,ref:node.id};};
   const convert=token=>{if(token.kind==='primitive')return{...token};if(token.t===9){const node=this.resolve(token);if(node.id<0){if(inline.has(node.id))return{t:9,ref:node.id};inline.add(node.id);return object(node);}return enqueue(node);}if(token.id!==undefined){if(token.id<0){if(inline.has(token.id))return{t:9,ref:token.id};inline.add(token.id);return object(token);}return enqueue(token);}return token.t===8?{t:8,data:{...token.data}}:{...token,prefix:undefined};};
   const object=node=>{const copy={...node,prefix:undefined,header:undefined};if(node.fields)copy.fields=node.fields.map(convert);if(node.entries){copy.lengths=node.lengths.slice();copy.entries=node.entries.map(convert);}return copy;};
   enqueue(this.objects.get(this.rootId));for(let i=0;i<queue.length;i++)records.push(object(queue[i]));
   function metadata(node){if(node.fields){const m=node.meta,key=JSON.stringify([m.name,m.names,m.types,m.infos,m.library]);if(schemas.has(key)){node.t=1;node.metadataId=schemas.get(key);node.meta={...m,id:node.metadataId};}else{node.t=m.library===null?4:5;node.meta={...m,id:node.id};schemas.set(key,node.id);}node.fields.forEach(metadata);}if(node.entries)node.entries.forEach(metadata);}
   records.forEach(metadata);const header={t:0,values:this.records[0].values.slice()},libraries=this.records.filter(r=>r.t===12).map(r=>({...r})),bytes=new Writer().result([header,...libraries,...records,{t:11}]);new Document(bytes);return bytes;
  }
  originalRoundTrip(){return new Writer().result(this.records);}
 }
 return{Reader,Writer,Document,read:bytes=>new Document(bytes)};
});
