/* Project-owned LBLD templates, shared by preview, print and label export. */
(function(root){
 'use strict';const cache=new WeakMap(),supported=new Set(['LabelDesign.Text','LabelDesign.Code','LabelDesign.QrCode','LabelDesign.Image','LabelDesign.LDLine']);
 function encode(bytes){let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.slice(i,i+32768));return btoa(s);}
 const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 function inspect(bytes,name){const doc=root.LBLD.read(bytes),types=doc.shapes().map(s=>s.node.meta.name),unknown=[...new Set(types.filter(t=>!supported.has(t)))];if(unknown.length)throw Error('Ten szablon zawiera nieobsługiwane obiekty: '+unknown.join(', '));let bound=0;for(const {node}of doc.shapes())if(doc.get(node,'Shape+_dataSourse')||doc.get(node,'BindingShape+_dataSourse'))bound++;
  const record={id:'tpl-'+crypto.randomUUID(),name:String(name),base64:encode(bytes),width:226,height:169.5,objects:types.length,bound};cache.set(record,doc);return record;
 }
 function selected(project,settings={}){const labels=project.labels||{},id=settings.activeTemplate??labels.activeTemplate;return(labels.customTemplates||[]).find(t=>t.id===id)||null;}
 function documentFor(p,project,settings={},fixed=false){const record=selected(project,settings),values=root.PlannerLabelData.values(p,project),style=settings.style==='project'||!values.Code?'project':'code';if(settings.style==='project'){values.Code='';values['Barcode(Code)']='';values.HasCode='false';values.LabelReference=values.OrderName;}let doc;
  if(record){if(!cache.has(record))cache.set(record,root.LBLD.read(decode(record.base64)));doc=fixed?root.LBLD.read(decode(record.base64)):cache.get(record);if(fixed)root.PlannerLbldPresets.resolveTemplate(doc,values);}
  else doc=root.PlannerLbldPresets.make({values,style,fixed:true});
  return{doc,values,width:record?.width||226,height:record?.height||169.5,record};
 }
 root.PlannerLabelTemplates={inspect,selected,documentFor,encode,decode};
})(typeof globalThis!=='undefined'?globalThis:this);
