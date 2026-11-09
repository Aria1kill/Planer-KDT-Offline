/* Small ZIP32 writer, stored entries, UTF-8 filenames. No external dependencies. */
(function(root){
 'use strict';const encoder=new TextEncoder(),table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 function crc(bytes){let value=0xffffffff;for(const b of bytes)value=table[(value^b)&255]^(value>>>8);return(value^0xffffffff)>>>0;}
 function build(entries){if(entries.length>65535)throw Error('Zbyt wiele plików w ZIP.');const files=[],directory=[];let offset=0,dirSize=0;
  for(const entry of entries){const name=encoder.encode(entry.name.replace(/\\/g,'/')),bytes=typeof entry.data==='string'?encoder.encode(entry.data):new Uint8Array(entry.data),checksum=crc(bytes),head=new Uint8Array(30+name.length),h=new DataView(head.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);h.setUint32(14,checksum,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);head.set(name,30);files.push(head,bytes);
   const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,checksum,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);directory.push(central);offset+=head.length+bytes.length;dirSize+=central.length;if(offset+dirSize>1073741824)throw Error('Pakiet przekroczył 1 GB. Wybierz mniejszy zakres.');
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,dirSize,true);e.setUint32(16,offset,true);const out=new Uint8Array(offset+dirSize+22);let at=0;for(const bytes of [...files,...directory,end]){out.set(bytes,at);at+=bytes.length;}return out;
 }
 root.PlannerZip={build,crc};
})(typeof globalThis!=='undefined'?globalThis:this);
