/* Process invariants: material conservation, preserved parts, availability and sides. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../engine.js'),P=require('../process.js'),root=path.resolve(__dirname,'../..');
let boards=0,operations=0,pieces=0;
function verify(b){
 const physical=P.manufacturingRoot(b),expected=E.leaves(b.root).filter(n=>n.piece),actual=E.leaves(physical).filter(n=>n.piece);
 assert.equal(actual.length,expected.length);pieces+=actual.length;boards++;
 for(const n of expected){const other=actual.find(c=>c.piece.instanceId===n.piece.instanceId);assert(other);for(const key of ['x','y','w','h'])assert(Math.abs(n[key]-other[key])<.001,'Finished part geometry is unchanged');}
 assert.equal(physical.x,0);assert.equal(physical.y,0);assert.equal(physical.w,b.length);assert.equal(physical.h,b.width);
 for(const n of E.nodes(physical)){if(!n.axis)continue;const cross=n.axis==='x'?n.h:n.w;let sum=n.kerf*cross;
  for(const c of n.children){assert(c.w>=0&&c.h>=0);sum+=c.w*c.h;assert(c.x>=n.x-.001&&c.y>=n.y-.001&&c.x+c.w<=n.x+n.w+.001&&c.y+c.h<=n.y+n.h+.001,'Every fragment stays inside its parent');}
  assert(Math.abs(sum-n.w*n.h)<Math.max(.001,n.w*n.h*1e-8),'Children plus kerf conserve material');
 }
 for(const order of ['parallel','strip']){b.cutOrder=order;const model=P.compile(b),available=new Set([physical.id]);
  for(const frame of model.frames){operations++;const op=frame.op;assert(available.delete(op.source.id),'Every fragment exists before use');for(const c of op.children)if(c.axis)available.add(c.id);
   const axis=op.axis==='x'?op.source.w:op.source.h;assert(frame.infeed.y+axis/2<0,'Whole fragment passes behind saw before withdrawal');
   const c=P.center(op.source),cut=P.cutPoint(op),v=P.rotate(cut.x-c.x,cut.y-c.y,frame.cutPose.angle);assert(Math.abs(frame.cutPose.y+v.y)<.001,'Kerf reaches fixed saw line');
   for(const [i,out] of frame.outputs.entries()){const length=op.axis==='x'?out.node.w:out.node.h;assert(Math.abs(i===0?out.start.y-length/2-op.kerf/2:out.start.y+length/2+op.kerf/2)<.001,'Finished side is front, retained side is rear');}
  }assert.equal(available.size,0);
 }
}
for(const b of JSON.parse(fs.readFileSync(path.join(root,'przyklady/OVSyp-9-plyt.rozkroj.json'),'utf8')).sheets)verify(b);
for(const trim of [0,1,10]){
 const stock={id:'t'+trim,name:'Test',length:1200,width:800,trim,kerf:4.4,material:'MDF',thickness:18,qty:1};
 const empty=E.createBoard(stock,()=> 'empty');assert.equal(P.sequence(empty).length,0,'Do not trim a blank plate without a cutting job');
 const parts=[{id:'part',name:'Piece',length:500,width:300,qty:3,material:'MDF',thickness:18,canRotate:false,edges:[0,0,0,0]}];
 for(const b of E.optimize(parts,[stock],stock,false).sheets){verify(b);if(trim){const ops=P.sequence(b),firstCut=ops.findIndex(op=>op.kind!=='trim');assert(firstCut<4,'No compulsory four-edge trim prefix');}}
}
const report={boards,pieces,operationsAcrossBothOrders:operations,materialConservation:'PASS',partGeometryUnchanged:'PASS',wholeFragmentInfeed:'PASS',frontOutfeed:'PASS',twoSequencePolicies:'PASS',noEmptyPlateTrims:'PASS',deferredEdgeTrimming:'PASS'};
fs.writeFileSync(path.join(root,'docs/sprawdzenie-v5.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
