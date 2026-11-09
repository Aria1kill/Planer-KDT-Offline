/* Complete generated shapes for the supplied LabelDesign.dll 1.1.4.2.
   Original imported files are preserved unless a new preset is explicitly generated. */
(function(root){
 'use strict';const version='1.1.4.2',primitive=(type,value)=>({kind:'primitive',primitiveType:type,value}),ref=n=>({t:9,ref:n.id}),nil=()=>({t:10});
 function apply(doc){
  function emptySourceList(library){const name='System.Collections.Generic.List`1[[LabelDesign.DataSourseString, LabelDesign, Version='+version+', Culture=neutral, PublicKeyToken=null]]',array=doc.insertRecord({t:7,id:doc.nextId++,arrayKind:0,rank:1,lengths:[0],lower:[],binaryType:4,typeInfo:{name:'LabelDesign.DataSourseString',library},entries:[]}),list=doc.createClass(name,[{name:'_items',type:4,info:{name:'LabelDesign.DataSourseString[]',library},value:ref(array)},{name:'_size',type:0,info:8,value:primitive(8,0)},{name:'_version',type:0,info:8,value:primitive(8,0)}],null);return doc.createClass('LabelDesign.DataSourseStringCollection',[{name:'SourseStringChanged',type:2,value:nil()},{name:'Collection`1+items',type:3,info:name,value:ref(list)}],library);}
  for(const {node}of doc.shapes()){const extra=[],library=node.meta.library,binding=node.meta.names.some(k=>k.startsWith('BindingShape+'));
   if(!doc.has(node,'Id'))extra.push({name:'Id',type:0,info:8,value:primitive(8,node.id)});
   if(binding&&!doc.has(node,'BindingShape+_dataSourseList'))extra.push({name:'BindingShape+_dataSourseList',type:4,info:{name:'LabelDesign.DataSourseStringCollection',library},value:ref(emptySourceList(library))});
   if(binding&&!doc.has(node,'BindingShape+_programsString'))extra.push({name:'BindingShape+_programsString',type:1,value:nil()});
   if(node.meta.name==='LabelDesign.Text'&&!doc.has(node,'_stringFormatDirection'))root.PlannerLbldGraphics.textDirection(doc,node,0);
   if(extra.length){const m=node.meta;node.t=5;delete node.header;node.meta={...m,id:node.id,names:[...m.names,...extra.map(x=>x.name)],types:[...m.types,...extra.map(x=>x.type)],infos:[...m.infos,...extra.map(x=>x.info??null)]};node.fields.push(...extra.map(x=>x.value));doc.schemas.set(node.id,node.meta);}doc.templates[node.meta.name]=node;
  }
  const replace=s=>typeof s==='string'?s.replace(/LabelDesign, Version=\d+\.\d+\.\d+\.\d+/g,'LabelDesign, Version='+version):s,metas=new Set();
  function walk(record){if(record.t===12)record.name=replace(record.name);if(record.meta&&!metas.has(record.meta)){metas.add(record.meta);record.meta.name=replace(record.meta.name);record.meta.infos=record.meta.infos.map(i=>typeof i==='string'?replace(i):i&&typeof i==='object'?{...i,name:replace(i.name)}:i);}if(record.t===4||record.t===5)delete record.header;if(record.fields)record.fields.forEach(walk);if(record.entries)record.entries.forEach(walk);}
  doc.records.forEach(walk);return doc;
 }
 root.PlannerLbldNativeContract={apply,version};
})(typeof globalThis!=='undefined'?globalThis:this);
