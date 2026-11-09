/* Real SVG-to-PNG rendering without controlling a browser. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Resvg}=require(path.join(process.env.TEMP,'planer-render-deps/node_modules/@resvg/resvg-js'));
const app=path.resolve(__dirname,'../..'),out=path.join(app,'docs/podglady-naklejek');fs.mkdirSync(out,{recursive:true});
global.LBLD=require('../lbld.js');global.PlannerEngine=require('../engine.js');global.PlannerLabelData=require('../label-contract.js');
for(const file of ['lbld-example.js','lbld-assets.js','lbld-graphics.js','lbld-render.js','lbld-native-contract.js','lbld-presets.js'])vm.runInThisContext(fs.readFileSync(path.join(app,'js',file),'utf8'));
const cases=[['z-kodem',{name:'Bok_Lewy',length:1038,width:474,code:'ASLaz0000057',material:'U3261_VL',thickness:18,edges:[1,0,0,0]},{name:'ASLaz'}],['bez-kodu',{name:'Polka',length:1044,width:501,code:'',material:'K099_SU',thickness:18,edges:[1,0,0,0]},{name:'ASKuch'}],['przegroda',{name:'Przegroda',length:891,width:250,code:'L151Kuch0070',material:'U_3293_SM',thickness:18,edges:[1,0,0,0]},{name:'L151Kuch'}]];
for(const [name,part,project]of cases){const values=PlannerLabelData.values(part,project),doc=PlannerLbldPresets.make({values,fixed:true}),svg=PlannerLbldRenderer.svg(doc,{width:226,height:169.5}),png=new Resvg(svg,{fitTo:{mode:'width',value:945},font:{loadSystemFonts:true,defaultFontFamily:'Segoe UI'}}).render().asPng();fs.writeFileSync(path.join(out,name+'.svg'),svg);fs.writeFileSync(path.join(out,name+'.png'),png);fs.writeFileSync(path.join(out,name+'.edytowalny.lbld'),doc.compactSave());fs.writeFileSync(path.join(out,name+'.lbld'),PlannerLbldPresets.fromBitmap(png).compactSave());console.log(JSON.stringify({name,objects:doc.items.length,bytes:png.length}));}

const b64=p=>fs.readFileSync(p).toString('base64');let comparison='<svg xmlns="http://www.w3.org/2000/svg" width="1960" height="1550"><rect width="1960" height="1550" fill="#eaf0f6"/><g font-family="Segoe UI,Arial" font-size="28" fill="#34516e"><text x="22" y="37">WZORY UŻYTKOWNIKA</text><text x="990" y="37">RENDER PO POPRAWKACH</text></g>';
comparison+='<image x="20" y="55" width="945" height="709" href="data:image/png;base64,'+b64(path.join(app,'przyklady/Wzór naklejki.png'))+'"/>';
comparison+='<image x="990" y="55" width="945" height="709" href="data:image/png;base64,'+b64(path.join(out,'z-kodem.png'))+'"/>';
comparison+='<svg x="20" y="795" width="945" height="709" viewBox="39 40 621 584" preserveAspectRatio="none"><image width="759" height="683" href="data:image/png;base64,'+b64(path.join(app,'przyklady/Wzór naklejkio_2.png'))+'"/></svg>';
comparison+='<image x="990" y="795" width="945" height="709" href="data:image/png;base64,'+b64(path.join(out,'bez-kodu.png'))+'"/></svg>';
fs.writeFileSync(path.join(out,'porownanie-wzorow.svg'),comparison);fs.writeFileSync(path.join(out,'porownanie-wzorow.png'),new Resvg(comparison,{font:{loadSystemFonts:true}}).render().asPng());
