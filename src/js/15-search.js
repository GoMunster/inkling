/* ---------- search everything ---------- */
// One search over scenes (text, titles, synopses, notes, sticky notes), chapters, story pages, notes and
// brainstorms, outlines, timelines, maps and trees. Each hit knows how to open its place (saOpen): a scene selects
// the match (ui.findSel), others open the item and flash the line, card, idea or bubble.
const SA_AREAS=[['scene','Scenes'],['ent','Story pages'],['nt','Notes'],['ol','Outlines'],['tl','Timelines'],['cv','Maps and trees']];
function saRegex(q,o){
  const e=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  try{ return new RegExp(o.ww?'(?<![\\p{L}\\p{N}_])'+e+'(?![\\p{L}\\p{N}_])':e,(o.mc?'g':'gi')+'u'); }catch(x){ return null; }
}
function searchAll(q,o){
  const out=[], re=q&&q.trim()?saRegex(q.trim(),o):null; if(!re) return out; const m=S.meta;
  const add=(area,label,where,text,open)=>{ text=String(text||''); if(!text) return; re.lastIndex=0; let mm, n=0, s=-1, len=0;
    while((mm=re.exec(text))){ if(!n){ s=mm.index; len=mm[0].length; } n++; if(!mm[0].length) re.lastIndex++; if(n>=999) break; }
    if(!n) return; const a=Math.max(0,s-60), b=Math.min(text.length,s+len+90);
    const snip=(a?'…':'')+esc(text.slice(a,s))+'<mark>'+esc(text.slice(s,s+len))+'</mark>'+esc(text.slice(s+len,b))+(b<text.length?'…':'');
    out.push({area,label,where,n,snip:snip.replace(/\n+/g,' ¶ '),open:Object.assign({s,e:s+len},open),pri:open.text||open.field||open.flash||open.card||open.sel?0:1}); };
  m.chapters.forEach(c=>{
    add('scene',c.title,'Chapter title',c.title,{k:'cork',ch:c.id}); add('scene',c.title,'Chapter notes',(S.ch[c.id]||{}).notes,{k:'cork',ch:c.id});
    c.scenes.forEach(id=>{ const sc=m.scenes[id], d=S.sc[id]; if(!sc||!d) return;
      add('scene',sc.title,c.title,plainText(d.text),{k:'scene',id,text:1});
      add('scene',sc.title,c.title+' · title',sc.title,{k:'scene',id}); add('scene',sc.title,c.title+' · synopsis',d.synopsis,{k:'scene',id}); add('scene',sc.title,c.title+' · notes',d.notes,{k:'scene',id});
      (d.stickies||[]).forEach(n=>add('scene',sc.title,c.title+' · sticky note',n.text,{k:'scene',id})); }); });
  Object.values(m.ents).forEach(e=>{ const f=(S.en[e.id]||{}).fields||{}, labels=Object.fromEntries(entFields(e.type));
    add('ent',e.name,LS(e.type),[e.name].concat(e.aliases||[]).join(', '),{k:'ent',id:e.id}); add('ent',e.name,LS(e.type)+' · tag',e.tag,{k:'ent',id:e.id});
    Object.keys(f).forEach(k=>add('ent',e.name,LS(e.type)+' · '+(k==='facts'?'Key facts':labels[k]||k),f[k],{k:'ent',id:e.id,field:k})); });
  m.nts.forEach(x=>{ const d=S.nt[x.id]; if(!d) return; add('nt',x.name,x.kind==='board'?'Brainstorm':'Notes page',x.name,{k:'nt',id:x.id});
    if(x.kind==='board') d.ideas.forEach(i=>add('nt',x.name,'Brainstorm idea',i.text,{k:'nt',id:x.id,flash:'.idea[data-id="'+i.id+'"]'}));
    else if(x.kind==='map') (d.pins||[]).forEach(pn=>{ add('nt',mpName(pn),x.name+' · map pin',pn.ent?'':pn.name,{k:'nt',id:x.id,pin:pn.id}); add('nt',mpName(pn),x.name+' · pin note',pn.note,{k:'nt',id:x.id,pin:pn.id}); });
    else add('nt',x.name,'Notes page',d.text,{k:'nt',id:x.id}); });
  m.ols.forEach(x=>{ const d=S.ol[x.id]; if(!d) return; add('ol',x.name,LS('ol'),x.name,{k:'ol',id:x.id});
    d.items.forEach(i=>{ add('ol',x.name,'Line',i.text,{k:'ol',id:x.id,flash:'.ol-row[data-i="'+i.id+'"]'}); add('ol',x.name,'Line note',i.note,{k:'ol',id:x.id,flash:'.ol-row[data-i="'+i.id+'"]'}); }); });
  m.tls.forEach(x=>{ const t=S.tl[x.id]; if(!t) return; add('tl',x.name,LS('tl'),x.name,{k:'tl',id:x.id});
    Object.keys(t.cards).forEach(cid=>{ const c=t.cards[cid]; add('tl',c.title||'Untitled card',x.name,[c.title,c.when,c.body].filter(Boolean).join(' · '),{k:'tl',id:x.id,card:cid}); });
    (t.marks||[]).forEach(mk=>add('tl',mk.label,x.name+' · era',mk.label,{k:'tl',id:x.id})); });
  m.rms.forEach(x=>{ const r=S.rm[x.id]; if(!r) return;
    r.nodes.forEach(n=>{ add('cv',rmName(n),x.name,n.ent?'':n.name,{k:'rm',id:x.id,sel:{k:'node',id:n.id}}); add('cv',rmName(n),x.name+' · note',n.note,{k:'rm',id:x.id,sel:{k:'node',id:n.id}}); });
    r.edges.forEach(ed=>add('cv',[ed.label,ed.note].filter(Boolean).join(' · '),x.name+' · connection',[ed.label,ed.note].filter(Boolean).join(' · '),{k:'rm',id:x.id,sel:{k:'edge',id:ed.id}})); });
  m.fts.forEach(x=>{ const t=S.ft[x.id]; if(!t) return;
    t.people.forEach(p=>add('cv',ftName(p),x.name,[p.ent?'':p.name,p.title,p.note].filter(Boolean).join(' · '),{k:'ft',id:x.id,sel:{k:'person',id:p.id}})); });
  return out.map((r,i)=>[r,i]).sort((a,b)=>a[0].pri-b[0].pri||a[1]-b[1]).map(x=>x[0]);   // what is written first, then titles and names
}
function saOpen(o){
  if(o.k==='cork'){ ui.cork=o.ch; go({k:'cork'}); return; }
  if(o.k==='scene'){ if(o.text) ui.findSel={id:o.id,s:o.s,e:o.e}; go({k:'scene',id:o.id}); return; }
  if(o.k==='rm'||o.k==='ft'){ ui.cvFor=o.id; ui.cvSel=o.sel; go({k:o.k,id:o.id}); return; }
  if(o.pin){ ui.mpSel=o.pin; go({k:'nt',id:o.id}); return; }
  go({k:o.k,id:o.id});
  if(o.k==='tl'&&o.card) tlOpenCard(o.card,true);
  const sel=o.flash||(o.field?'[data-k="'+o.field+'"]':''); if(!sel) return;
  setTimeout(()=>{ const x=document.querySelector('#main '+sel); if(!x) return; x.scrollIntoView({block:'center'}); x.classList.add('flash'); setTimeout(()=>x.classList.remove('flash'),2000); if(o.field&&x.focus) x.focus(); },80);
}
function renderSearch(el){
  const sa=ui.sa=ui.sa||{q:'',mc:false,ww:false,area:''};
  el.innerHTML='<div class="main-head">'+backBtn()+'<span class="kind">'+ico('search',16)+'</span><h1 class="mh-title">Search everything</h1><button class="btn" data-sa="find">Find and replace in scenes…</button></div>'
    +'<div class="sa-wrap"><div class="sa-bar"><input id="saQ" type="search" placeholder="Search scenes, story pages, notes, outlines, timelines, maps…" value="'+esc(sa.q)+'" aria-label="Search everything" autocomplete="off">'
    +'<label class="ck"><input type="checkbox" id="saMc"'+(sa.mc?' checked':'')+'>Match case</label><label class="ck"><input type="checkbox" id="saWw"'+(sa.ww?' checked':'')+'>Whole words</label></div>'
    +'<div class="sa-areas" id="saAreas"></div><div id="saList" class="sa-list"></div></div>';
  const draw=()=>{
    const all=searchAll(sa.q,sa), cnt={}; all.forEach(r=>{ cnt[r.area]=(cnt[r.area]||0)+1; });
    if(sa.area&&!cnt[sa.area]) sa.area='';
    $('#saAreas',el).innerHTML=sa.q.trim()?'<button data-area=""'+(sa.area?'':' class="on"')+'>All <span>'+all.length+'</span></button>'+SA_AREAS.filter(a=>cnt[a[0]]).map(a=>'<button data-area="'+a[0]+'"'+(sa.area===a[0]?' class="on"':'')+'>'+esc(a[0]==='ent'?'Story pages':a[1])+' <span>'+cnt[a[0]]+'</span></button>').join(''):'';
    const list=all.filter(r=>!sa.area||r.area===sa.area); ui.saHits=list;
    $('#saList',el).innerHTML=!sa.q.trim()?'<p class="muted sa-none">Type to search the whole project. '+MODK+'+K opens this from anywhere.</p>'
      :!list.length?'<p class="muted sa-none">Nothing found for “'+esc(sa.q)+'”.</p>'
      :SA_AREAS.filter(a=>list.some(r=>r.area===a[0])).map(a=>'<section class="sa-sec"><h2>'+esc(a[1])+'</h2>'+list.map((r,i)=>r.area!==a[0]?'':'<button class="sa-hit" data-hit="'+i+'"><span class="sa-top"><b>'+esc(r.label||'Untitled')+'</b><span class="muted">'+esc(r.where)+'</span>'+(r.n>1?'<span class="sa-n">'+r.n+'×</span>':'')+'</span><span class="sa-snip">'+r.snip+'</span></button>').join('')+'</section>').join('');
  };
  draw();
  const q=$('#saQ',el); q.focus(); q.setSelectionRange(q.value.length,q.value.length);
  q.addEventListener('input',()=>{ sa.q=q.value; clearTimeout(ui.saT); ui.saT=setTimeout(draw,140); });
  q.addEventListener('keydown',e=>{ if(e.key==='Enter'&&ui.saHits&&ui.saHits[0]) saOpen(ui.saHits[0].open); });
  $('#saMc',el).addEventListener('change',e=>{ sa.mc=e.target.checked; draw(); }); $('#saWw',el).addEventListener('change',e=>{ sa.ww=e.target.checked; draw(); });
  el.onclick=e=>{ const h=e.target.closest('[data-hit]'), ar=e.target.closest('[data-area]'), f=e.target.closest('[data-sa="find"]');
    if(h){ const r=ui.saHits[+h.dataset.hit]; if(r) saOpen(r.open); }
    else if(ar){ sa.area=ar.dataset.area; draw(); }
    else if(f){ ui.find=ui.find||{q:'',r:'',mc:false,ww:false,scope:'all'}; ui.find.q=sa.q; go({k:'find'}); } };
}

