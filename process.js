/* Geometry of physical fragments. Millimetres; original plans remain immutable. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./engine.js'):root.PlannerEngine);if(typeof module==='object'&&module.exports)module.exports=api;root.PlannerProcess=api;})(typeof globalThis!=='undefined'?globalThis:this,function(E){
 'use strict';
 const EPS=.001,PI=Math.PI,roots=new WeakMap();
 function split(id,r,axis,cut,kerf,a,b,extra={}){return{...E.freeNode(id,r.x,r.y,r.w,r.h),axis,cut,kerf,waste:false,children:[a,b].filter(Boolean),...extra};}
 function manufacturingRoot(board){
  const t=Number(board.trim)||0,W=board.length,H=board.width;
  if(!t)return board.root;
  const stamp=[t,W,H,board.kerf].join('|'),cached=roots.get(board);if(cached?.source===board.root&&cached.stamp===stamp)return cached.root;
  let serial=0;const id=()=> 'physical-'+board.id+'-'+(++serial),blank=r=>E.freeNode(id(),r.x,r.y,r.w,r.h),dim=a=>a==='x'?'w':'h';
  function partition(r,a,cut){const d=dim(a),kerf=Math.min(board.kerf,Math.max(0,r[d]-cut)),one={...r,[d]:cut},two={...r,[a]:r[a]+cut+kerf,[d]:Math.max(0,r[d]-cut-kerf)};return{kerf,one,two};}
  function lead(r,a,amount,next){const d=dim(a),kerf=Math.min(board.kerf,amount),cut=amount-kerf,off={...r,[d]:cut},keep={...r,[a]:r[a]+amount,[d]:r[d]-amount};
   return split(id(),r,a,cut,kerf,{...blank(off),trimWaste:true},next(keep),{kind:'trim',edge:a==='x'?'lewa':'górna',allowance:amount});}
  function finish(n,r){for(const a of ['x','y']){const d=dim(a),before=n[a]-r[a],after=r[a]+r[d]-n[a]-n[d];
    if(before>EPS)return lead(r,a,before,keep=>finish(n,keep));
    if(after>EPS){const q=partition(r,a,n[d]);return split(id(),r,a,n[d],q.kerf,finish(n,q.one),q.two[d]>EPS?{...blank(q.two),trimWaste:true}:null,{kind:'trim',edge:a==='x'?'prawa':'dolna',allowance:after});}
   }return{...n,...r,children:[]};}
  function expand(n,r){if(!n.axis)return n.piece?finish(n,r):blank(r);
   const a=n.axis,d=dim(a),before=n[a]-r[a];if(before>EPS)return lead(r,a,before,keep=>expand(n,keep));
   const q=partition(r,a,n.cut),one=expand(n.children[0],q.one),two=q.two[d]>EPS?(n.children[1]?expand(n.children[1],q.two):blank(q.two)):null;
   return split(n.id,r,a,n.cut,q.kerf,one,two,{kind:n.kind||'cut',nativeId:n.nativeId});
  }
  // Keep raw cross-edges on each strip until that edge is actually needed.
  // Waste leaves are never trimmed; finished leaves alone require exact final edges.
  const root=expand(board.root,{x:0,y:0,w:W,h:H});roots.set(board,{source:board.root,stamp,root});return root;
 }
 function sequence(board){
  const out=[];
  function visit(n,depth){if(!n.axis)return;
   out.push({id:board.id+':'+n.id,sheetId:board.id,source:n,axis:n.axis,cut:n.cut,kerf:n.kerf,children:n.children,depth,kind:n.kind||'cut',edge:n.edge||'',allowance:n.allowance??(n.kind==='trim'?board.trim:0),fromEnd:!!n.fromEnd});
   // Finish parallel cuts while the remaining board is already aligned.
   const children=n.children.filter(c=>c.axis);
   if(board.cutOrder!=='strip')children.sort((a,b)=>Number(b.axis===n.axis&&!!b.fromEnd===!!n.fromEnd)-Number(a.axis===n.axis&&!!a.fromEnd===!!n.fromEnd));
   children.forEach(c=>visit(c,depth+1));
  }visit(manufacturingRoot(board),1);return out;
 }
 function inventory(board,step){const available=new Map([[manufacturingRoot(board).id,manufacturingRoot(board)]]),finished=[],waste=[];
  for(const op of sequence(board).slice(0,step)){available.delete(op.source.id);for(const c of op.children){if(c.piece)finished.push(c);else if(c.axis)available.set(c.id,c);else waste.push(c);}}
  return{available:[...available.values()],finished,waste};
 }
 function angle(op){return op.axis==='x'?-PI/2:op.fromEnd?0:PI;}
 function rotate(x,y,a){return{x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};}
 function center(n){return{x:n.x+n.w/2,y:n.y+n.h/2};}
 function cutPoint(op){const n=op.source,c=center(n);if(op.axis==='x')c.x=n.x+op.cut+op.kerf/2;else c.y=op.fromEnd?n.y+n.h-op.cut-op.kerf/2:n.y+op.cut+op.kerf/2;return c;}
 function cutPose(op){const p=cutPoint(op),c=center(op.source),a=angle(op),v=rotate(p.x-c.x,p.y-c.y,a);return{x:-v.x,y:-v.y,angle:a};}
 function childPose(op,child){const p=cutPose(op),a=center(op.source),b=center(child),v=rotate(b.x-a.x,b.y-a.y,p.angle);return{x:p.x+v.x,y:p.y+v.y,angle:p.angle};}
 function metrics(sheets){let cuts=0,trims=0,rotations=0,retrievals=0,travel=0,maxPhases=0;
  for(const b of sheets){const ops=sequence(b),phases=new Map();let previous=null;
   for(const op of ops){cuts++;if(op.kind==='trim')trims++;travel+=op.axis==='x'?op.source.h:op.source.w;
    const continuation=previous?.children.some(c=>c.id===op.source.id)&&Math.abs(angle(previous)-angle(op))<EPS;
    if(!continuation)retrievals++;
    const parentAngle=previous?.children.some(c=>c.id===op.source.id)?angle(previous):(phases.get(op.source.id)?.angle??angle(op));
    if(Math.abs(parentAngle-angle(op))>EPS)rotations++;
    const level=(phases.get(op.source.id)?.level||1);
    maxPhases=Math.max(maxPhases,level);
    for(const c of op.children)if(c.axis)phases.set(c.id,{angle:angle(op),level:level+(c.axis!==op.axis?1:0)});
    previous=op;
   }
  }return{cuts,trims,rotations,retrievals,travel,maxPhases,work:cuts+4*rotations+3*retrievals+travel/10000};
 }
 function compile(board){
  const ops=sequence(board),span=Math.max(board.length,board.width),available=new Map(),completed=[],slots=new Map();
  const first=manufacturingRoot(board);available.set(first.id,{node:first,pose:{x:0,y:span*1.1,angle:ops.length?angle(ops[0]):0},kind:'load'});
  const frames=[];
  for(let i=0;i<ops.length;i++){
   const op=ops[i],source=available.get(op.source.id);if(!source)throw Error('Brak fragmentu dla operacji '+op.id);
   const before=[...available.values()],past=completed.slice(-5);available.delete(op.source.id);slots.delete(op.source.id);
   const pose=cutPose(op),outputs=[];
   for(const c of op.children){
    const start=childPose(op,c);let end,kind;
    if(c.axis){kind='buffer';if(ops[i+1]?.source.id===c.id){end={...start};kind='table';}
     else{let slot=0;while([...slots.values()].includes(slot))slot++;slots.set(c.id,slot);end={x:span*1.25,y:span*.3+slot*span*.22,angle:pose.angle};}
     available.set(c.id,{node:c,pose:end,kind});
    }else if(c.piece){kind='finished';end={x:-span*1.15,y:span*.65+(completed.length%5)*span*.04,angle:pose.angle};completed.push({node:c,pose:end});}
    else{kind='waste';end={x:start.x,y:span*1.6,angle:pose.angle};}
    outputs.push({node:c,start,end,kind});
   }
   const oldAngle=source.pose.angle,target=angle(op);let delta=target-oldAngle;while(delta>PI)delta-=2*PI;while(delta<-PI)delta+=2*PI;
   const staging={x:0,y:span*.62,angle:oldAngle};
   const continuation=Math.abs(delta)<EPS&&source.kind==='table',axisLength=op.axis==='x'?op.source.w:op.source.h,infeed={x:0,y:-axisLength/2-span*.10,angle:pose.angle};
   frames.push({op,before,past,sourcePose:source.pose,staging,infeed,cutPose:pose,outputs,delta,continuation});
  }return{ops,frames,span};
 }
 return{manufacturingRoot,sequence,inventory,metrics,angle,rotate,center,cutPoint,cutPose,childPose,compile,invalidate(board){roots.delete(board);}};
});
