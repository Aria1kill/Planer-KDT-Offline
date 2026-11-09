/* Offline machine model. This module contains no hardware transport. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.PlannerSaw=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const VERSION=1;
 function defaults(){return{format:'PlanerSawProfile',version:VERSION,name:'Masterwood MS320',connection:{protocol:'unknown',serialPort:'COM2',baud:null,dataBits:null,parity:'unknown',stopBits:null,host:'',amsNetId:''},planning:{kerf:4.4,trim:10,cutOrder:'parallel'},trial:{intervalMs:900},source:{description:'sawconfig.xml z komputera przy pile',serialPort:'COM2',sawWidthPLC:4.4,defaultTrimEnabled:false,defaultTrimValue:5,opaque:{SAMode:'1',ExternalDiameterOfSaw:'2'},verifiedProtocol:false}};}
 function number(value,min,max,label,nullable=false){if(value===null||value===undefined||typeof value==='string'&&!value.trim()){if(nullable)return null;throw Error('Niepoprawne pole: '+label);}if(typeof value!=='number'&&typeof value!=='string')throw Error('Niepoprawne pole: '+label);const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error('Niepoprawne pole: '+label);return n;}
 function text(value,max=160){if(typeof value!=='string'||value.length>max||/[\x00-\x1f]/.test(value))throw Error('Niepoprawny tekst w ustawieniach.');return value.trim();}
 function validate(input){
  if(!input||input.format!=='PlanerSawProfile'||input.version!==VERSION)throw Error('To nie jest obsługiwany profil piły.');
  const p=defaults(),c=input.connection||{},b=input.planning||{};
  p.name=text(input.name||p.name);p.connection.protocol=['unknown','serial','ads','modbus-tcp'].includes(c.protocol)?c.protocol:'unknown';
  p.connection.serialPort=text(c.serialPort||'',30);if(p.connection.serialPort&&!/^COM[1-9][0-9]{0,3}$/i.test(p.connection.serialPort))throw Error('Port powinien mieć postać COM2.');
  p.connection.baud=number(c.baud,300,4000000,'szybkość portu',true);p.connection.dataBits=number(c.dataBits,5,8,'bity danych',true);p.connection.stopBits=number(c.stopBits,1,2,'bity stopu',true);
  if(p.connection.baud!==null&&!Number.isInteger(p.connection.baud)||p.connection.dataBits!==null&&!Number.isInteger(p.connection.dataBits)||p.connection.stopBits!==null&&![1,1.5,2].includes(p.connection.stopBits))throw Error('Niepoprawne parametry portu.');
  p.connection.parity=['unknown','none','even','odd'].includes(c.parity)?c.parity:'unknown';p.connection.host=text(c.host||'',253);p.connection.amsNetId=text(c.amsNetId||'',60);
  p.planning.kerf=number(b.kerf,0,30,'rzaz');p.planning.trim=number(b.trim,0,200,'brzegowanie');p.planning.cutOrder=b.cutOrder==='strip'?'strip':'parallel';p.trial.intervalMs=number(input.trial?.intervalMs??900,150,10000,'tempo próby');
  // A saved file can never assert that a live connection has been verified.
  if(input.source&&typeof input.source==='object'){p.source.description=text(input.source.description||'',250);p.source.serialPort=text(input.source.serialPort||'',30);p.source.sawWidthPLC=number(input.source.sawWidthPLC??4.4,0,30,'rzaz źródłowy');p.source.defaultTrimEnabled=input.source.defaultTrimEnabled===true;p.source.defaultTrimValue=number(input.source.defaultTrimValue??5,0,200,'brzegowanie źródłowe');p.source.opaque={SAMode:text(String(input.source.opaque?.SAMode??''),30),ExternalDiameterOfSaw:text(String(input.source.opaque?.ExternalDiameterOfSaw??''),30)};}
  p.source.verifiedProtocol=false;return p;
 }
 function importXml(xml,DOMParser,profile=defaults()){
  if(typeof xml!=='string'||xml.length>100000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Nieobsługiwana zawartość konfiguracji XML.');
  const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw Error('Niepoprawny XML.');
  const get=name=>{const a=doc.getElementsByTagName(name);return a.length===1?a[0].textContent.trim():null;};
  const port=get('SerialPortName'),saw=get('SawWidthPLC');if(port===null||saw===null)throw Error('Nie znaleziono parametrów sawconfig.xml.');
  const p=validate(profile);p.connection.serialPort=port;p.planning.kerf=Number(saw.replace(',','.'));
  p.source={description:'Wczytany sawconfig.xml',serialPort:port,sawWidthPLC:p.planning.kerf,defaultTrimEnabled:get('EditBoardIsDefaultTrim')==='True',defaultTrimValue:Number((get('EditBoardDefaultTrimNum')||'5').replace(',','.')),opaque:{SAMode:get('SAMode')||'',ExternalDiameterOfSaw:get('ExternalDiameterOfSaw')||''},verifiedProtocol:false};
  // A disabled trim default never overrides the user's planning allowance.
  if(p.source.defaultTrimEnabled)p.planning.trim=p.source.defaultTrimValue;return validate(p);
 }
 const phases=[['take','Pobranie fragmentu'],['orient','Ułożenie / obrót fragmentu'],['feed','Podanie na wymiar'],['clamp','Docisk'],['cut','Przejazd piły'],['release','Zwolnienie i odłożenie']];
 function createTrial(operations){
  if(!Array.isArray(operations)||!operations.length)throw Error('Ta płyta nie ma operacji cięcia.');if(operations.length>5000)throw Error('Zbyt wiele operacji do pojedynczej próby (limit 5000).');
  const ops=operations.map(o=>({id:String(o.id),kind:o.kind,axis:o.axis,cut:number(o.cut,0,100000,'wymiar cięcia'),kerf:number(o.kerf,0,30,'rzaz'),source:{id:String(o.source.id),w:number(o.source.w,.001,100000,'długość fragmentu'),h:number(o.source.h,.001,100000,'szerokość fragmentu')},edge:String(o.edge||'')}));
  let cursor=0,state='idle';const log=[],signals={guard:false,emergencyReleased:false,pressure:false,homed:false};
  function record(event,detail){log.push({time:new Date().toISOString(),mode:'offline',event,detail,operation:Math.min(ops.length,Math.floor(cursor/phases.length)+1)});if(log.length>30000)log.shift();}
  function missing(){return Object.keys(signals).filter(k=>signals[k]!==true);}
  function snapshot(){const index=Math.floor(cursor/phases.length);return{state,cursor,total:ops.length*phases.length,index,phase:phases[cursor%phases.length]||phases[0],operation:ops[index]||null,signals:{...signals},missing:missing(),log:log.map(l=>({...l}))};}
  function step(){if(state==='stopped'||state==='complete')throw Error('Wczytaj płytę ponownie, aby rozpocząć nową próbę.');if(missing().length){state='blocked';record('blocked','Niepotwierdzone wirtualne sygnały: '+missing().join(', '));throw Error('Potwierdź wszystkie wirtualne sygnały gotowości.');}state='running';const op=ops[Math.floor(cursor/phases.length)],phase=phases[cursor%phases.length];record(phase[0],phase[1]+' · '+op.cut+' mm · '+op.id);cursor++;if(cursor===ops.length*phases.length){state='complete';record('complete','Próba płyty zakończona.');}return snapshot();}
  record('loaded','Wczytano '+ops.length+' operacji; bez połączenia z maszyną.');
  return{snapshot,step,setSignal(key,value){if(!Object.hasOwn(signals,key))throw Error('Nieznany sygnał.');signals[key]=value===true;record('signal',key+' = '+signals[key]);if(!signals[key]&&state==='running')state='blocked';return snapshot();},pause(){if(state==='running')state='paused';record('pause','Wstrzymano próbę.');return snapshot();},stop(){state='stopped';record('stop','Zakończono wyłącznie próbę komputerową.');return snapshot();}};
 }
 function sendPhysical(){throw Error('Sterowanie fizyczne nie jest dostępne: brak potwierdzonego protokołu, mapy komend i odbioru na maszynie.');}
 return{defaults,validate,importXml,createTrial,sendPhysical,phases,capabilities:Object.freeze({offlineTrial:true,physicalRead:false,physicalWrite:false})};
});
