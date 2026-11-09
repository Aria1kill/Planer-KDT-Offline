/* Local research viewer. Does not modify projects or communicate with the saw. */
(() => {
  'use strict';
  const data = window.KDTResearch;
  const $ = id => document.getElementById(id);
  const fmt = value => Number(value).toLocaleString('pl-PL', {maximumFractionDigits:4});
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let example = 0, selected = '1';
  const panel = () => data.mcut[example].panels[0];
  function rect(node) {
    return {x:+node.x, y:+node.y, w:+node[node.axis === 'y' ? 'w' : 'l'], h:+node[node.axis === 'y' ? 'l' : 'w']};
  }
  function svgRect(r, H, attributes) {
    return '<rect x="'+r.x+'" y="'+(H-r.y-r.h)+'" width="'+r.w+'" height="'+r.h+'" '+attributes+'/>';
  }
  function render() {
    const p = panel(), W = +p.attributes.w, H = +p.attributes.l;
    const node = p.nodes.find(n => n.id === selected) || p.nodes[0];
    selected = node.id;
    $('mcutMetrics').innerHTML = [
      [fmt(W)+' × '+fmt(H)+' mm','płyta · grubość '+fmt(p.attributes.thickness)+' mm'],
      [p.node_count,'węzłów w pliku'],[p.leaf_count,'gotowych elementów'],[fmt(p.max_coordinate_error_mm)+' mm','maks. różnica współrzędnych']
    ].map(([v,l]) => '<div class="metric"><b>'+esc(v)+'</b><span>'+esc(l)+'</span></div>').join('');
    $('nodeTree').innerHTML = p.nodes.map(n => '<button type="button" class="node-button '+(n.id===selected?'selected':'')+'" data-node="'+n.id+'" style="padding-left:'+(8+n.depth*15)+'px" aria-pressed="'+(n.id===selected)+'">'+(n.parts.length?'▾ ':'· ')+'ID '+n.id+' <small>'+esc(n.tag)+' · '+(n.parts.length?'dalsze cięcia':'gotowy element')+'</small></button>').join('');
    const pad = Math.max(W,H)*0.035;
    $('boardDrawing').setAttribute('viewBox', [-pad,-pad,W+pad*2,H+pad*2].join(' '));
    let drawing = '<rect width="'+W+'" height="'+H+'" fill="#34404a"/>';
    for (const leaf of p.nodes.filter(n => !n.parts.length)) {
      const r = rect(leaf);
      drawing += svgRect(r,H,'class="board-piece '+(leaf.id===selected?'selected':'')+'" data-node="'+leaf.id+'"')+'<text x="'+(r.x+r.w/2)+'" y="'+(H-r.y-r.h/2+7)+'" text-anchor="middle">'+leaf.id+'</text>';
    }
    const r = rect(node);
    if(node.parts.length) {
      drawing += svgRect(r,H,'class="node-outline"');
      if(+node.trim>0) {
        const t = {...r};
        if(node.axis==='x')t.w=+node.trim;else t.h=+node.trim;
        drawing += svgRect(t,H,'class="trim-area"');
      }
      for(const part of node.parts) {
        const child=p.nodes.find(n=>n.id===part.id), c=rect(child);
        const x1=node.axis==='x'?c.x+c.w:r.x, x2=node.axis==='x'?x1:r.x+r.w;
        const y1=node.axis==='y'?H-c.y-c.h:H-r.y-r.h, y2=node.axis==='y'?y1:H-r.y;
        drawing += '<line x1="'+x1+'" x2="'+x2+'" y1="'+y1+'" y2="'+y2+'" class="cut-guide"/>';
      }
    }
    $('boardDrawing').innerHTML=drawing;
    const text = '<h3>'+esc(node.tag)+' / ID '+node.id+'</h3><div>Prostokąt na płycie: <strong>'+fmt(r.w)+' × '+fmt(r.h)+' mm</strong> · x='+fmt(r.x)+' · y='+fmt(r.y)+' od dołu · layer='+node.layer+'</div>';
    let detail=node.parts.length?'<p>Oś podziału w układzie płyty: <b>'+node.axis.toUpperCase()+'</b> · brzegowanie <b>'+fmt(node.trim)+' mm</b> · rzaz <b>'+fmt(p.attributes.saw)+' mm</b>.</p><ul>'+node.parts.map(c=>'<li><code>part id="'+c.id+'" cut="'+c.cut+'" type="'+c.type+'"</code> → '+(c.has_children?'dalsze cięcia':'gotowy element')+'; pozycja '+fmt(c.actual_position)+' mm</li>').join('')+'</ul><p>Odstęp od końca ostatniego elementu do końca fragmentu: <b>'+fmt(node.end_clearance_before_optional_final_kerf)+' mm</b> przed ewentualnym końcowym rzazem.</p>':'<p>Węzeł bez kolejnych instrukcji. Jest liściem drzewa — gotowym elementem w tym przykładzie.</p>';
    $('nodeDetails').innerHTML=text+detail;
    const lines=data.mcut[example].xml.split(/\r?\n/);
    let within=false;
    $('sourceCode').innerHTML=lines.map(line=>{
      if(line.includes('<'+node.tag+' '))within=true;
      const active=within;
      if(line.includes('</'+node.tag+'>')||(within && /\/>\s*$/.test(line)&&line.includes('<'+node.tag+' ')))within=false;
      return '<span class="source-line '+(active?'active':'')+'">'+esc(line)+'</span>';
    }).join('');
    const sourceBox=$('sourceCode'), first=sourceBox.querySelector('.active');
    if(first)sourceBox.scrollTop+=first.getBoundingClientRect().top-sourceBox.getBoundingClientRect().top-10;
  }
  document.addEventListener('click', e=>{
    const target=e.target.closest('[data-node]');
    if(target){selected=target.dataset.node;render();}
  });
  $('exampleSelect').addEventListener('change',()=>{example=+$('exampleSelect').value;selected='1';render();});
  $('copySource').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(data.mcut[example].xml);$('copyStatus').textContent='Skopiowano XML';}
    catch{const range=document.createRange();range.selectNodeContents($('sourceCode'));const s=window.getSelection();s.removeAllRanges();s.addRange(range);$('copyStatus').textContent='Zaznaczono — naciśnij Ctrl+C';}
  });
  $('labelEvidence').innerHTML='<div class="label-grid">'+data.labels.map(file=>'<div><h3>'+esc(file.file.split(/[\\/]/).pop())+'</h3><table><thead><tr><th>Typ i pole danych</th><th>Pozycja / rozmiar w pliku</th></tr></thead><tbody>'+file.shapes.map(s=>{
    const pos=s['Shape+_location'],size=s['Shape+_sizef'];
    const source=s['BindingShape+_dataSourse']??s['Shape+_dataSourse'];
    return '<tr><td><b>'+esc(s.$class.replace('LabelDesign.',''))+'</b><br><code>'+esc(source??'tekst stały')+'</code></td><td>x '+fmt(pos.x)+', y '+fmt(pos.y)+'<br>'+fmt(size.width)+' × '+fmt(size.height)+'</td></tr>';
  }).join('')+'</tbody></table></div>').join('')+'</div>';
  render();
})();
