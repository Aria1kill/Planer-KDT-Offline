/* App rendering only: no browser automation. The generated SVG is self-contained. */
(function(root){
 'use strict';
 async function png(svg,width=945,height=709){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Nie udało się wyrenderować etykiety.')),15000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(Error('Nie można odczytać obrazu etykiety.'));};image.src=url;});const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Nie udało się zapisać obrazu etykiety.');return new Uint8Array(await blob.arrayBuffer());}finally{URL.revokeObjectURL(url);}
 }
 root.PlannerLabelRaster={png};
})(typeof globalThis!=='undefined'?globalThis:this);
