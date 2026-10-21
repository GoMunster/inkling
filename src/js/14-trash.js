/* ---------- trash ---------- */
// Deleting a scene, chapter, story page, timeline, outline, notes page, map or tree moves it to S.tr (one doc per
// item, so it syncs and merges like everything else): {kind, at, by, title, sub, d}, where d holds everything needed
// to put it back (a scene's snapshots, a page's picture and its links from maps and trees). Items older than
// TRASH_DAYS go for good when a project loads (trashPurge); that is also when a page's picture is removed.
const TRASH_DAYS=30;
const TRASH_KINDS={scene:['Scene','pen'],chapter:['Chapter','book'],ent:['Story page','note'],tl:['Timeline','time'],ol:['Outline','list'],nt:['Notes','note'],rm:['Relationship map','web'],ft:['Family tree','tree']};
const bare=x=>{ const o=clone(x); if(o&&typeof o==='object') ['_m','_dev','_by'].forEach(k=>{ delete o[k]; }); return o; };
const snOf=sid=>Object.keys(S.sn).filter(k=>S.sn[k].scene===sid).map(k=>Object.assign({id:k},bare(S.sn[k])));
ADD_DOCS.push((o,out)=>{
  const i=o.tr&&typeof o.tr==='object'?o.tr:{}, r={};
  Object.keys(i).forEach(id=>{ const x=i[id]; if(!x||!TRASH_KINDS[x.kind]||!x.d||typeof x.d!=='object') return;
    r[id]={kind:x.kind,at:+x.at||Date.now(),by:String(x.by||'').slice(0,60),title:String(x.title||'').slice(0,120),sub:String(x.sub||'').slice(0,120),d:x.d}; });
  out.tr=r;
});
function trashPut(kind,title,sub,d){
  const id=uid('x_'); S.tr[id]={kind,at:Date.now(),by:ME.name||'',title:String(title||'').slice(0,120),sub:String(sub||'').slice(0,120),d}; dirty('tr_'+id);
  toast('“'+trunc(title||TRASH_KINDS[kind][0],40)+'” is in the Trash.',{plain:true,act:['Undo',()=>trashRestore(id)]});
  return id;
}
function putScene(sid,meta,sc,sn){
  S.sc[sid]=Object.assign({text:'',synopsis:'',notes:''},sc); S.sc[sid].stickies=normStickies(S.sc[sid].stickies);
  S.meta.scenes[sid]=Object.assign({title:'Untitled scene',status:'draft'},meta,{words:wc(S.sc[sid].text)}); dirty('sc_'+sid);
  (sn||[]).forEach(s=>{ const nid=S.sn[s.id]?uid('n_'):s.id, r=Object.assign({},s,{scene:sid}); delete r.id; S.sn[nid]=r; dirty('sn_'+nid); });
}
// Puts an item back where it was (or as near as it can), and returns the view to open.
function trashRestore(id){
  const x=S.tr[id]; if(!x) return null; const m=S.meta, d=x.d; let to=null;
  if(x.kind==='scene'){
    let c=m.chapters.find(c2=>c2.id===d.ch)||m.chapters[m.chapters.length-1];
    if(!c){ c={id:uid('c_'),title:'Chapter 1',open:true,scenes:[]}; m.chapters.push(c); S.ch[c.id]={notes:''}; dirty('ch_'+c.id); }
    const sid=m.scenes[d.id]?uid('s_'):d.id; putScene(sid,d.meta,d.sc,d.sn); c.scenes.splice(Math.min(+d.i||0,c.scenes.length),0,sid); c.open=true; to={k:'scene',id:sid};
  } else if(x.kind==='chapter'){
    const cid=m.chapters.some(c=>c.id===d.chap.id)?uid('c_'):d.chap.id, chap=Object.assign({},d.chap,{id:cid,scenes:[],open:true});
    (d.chap.scenes||[]).forEach(s=>{ const r=d.scenes&&d.scenes[s]; if(!r) return; const sid=m.scenes[s]?uid('s_'):s; putScene(sid,r.meta,r.sc,r.sn); chap.scenes.push(sid); });
    m.chapters.splice(Math.min(+d.i||0,m.chapters.length),0,chap); S.ch[cid]=Object.assign({notes:''},d.ch||{}); dirty('ch_'+cid);
    to=chap.scenes.length?{k:'scene',id:chap.scenes[0]}:{k:'cork'};
  } else if(x.kind==='ent'){
    const eid=m.ents[d.id]?uid('e_'):d.id; m.ents[eid]=Object.assign({aliases:[],tag:''},d.meta,{id:eid});
    S.en[eid]=Object.assign({fields:{}},d.en||{}); S.en[eid].pic=normPic(S.en[eid].pic); dirty('en_'+eid);
    const links=d.links||{}, name=m.ents[eid].name;   // its bubbles on maps and people in trees link back to it
    ['rm','ft'].forEach(k=>Object.keys(links[k]||{}).forEach(mid=>{ const doc=S[k][mid]; if(!doc) return; let ch=false;
      (k==='rm'?doc.nodes:doc.people).forEach(n=>{ if(links[k][mid].includes(n.id)&&!n.ent&&n.name===name){ n.ent=eid; ch=true; } }); if(ch) dirty(k+'_'+mid); }));
    linker=buildLinker(); to={k:'ent',id:eid};
  } else {
    const k=x.kind, list=m[k+'s'], did=S[k][d.id]?uid(k+'_'):d.id;
    S[k][did]=d.rec; list.splice(Math.min(+d.i||0,list.length),0,Object.assign({},d.item,{id:did})); secOn(k)||(m.secs[k]=true); ui.openSec[k]=true; dirty(k+'_'+did); to={k,id:did};
  }
  delete S.tr[id]; forget('tr_'+id); dirty('meta'); renderAll(); return to;
}
function trashDrop(id){
  const x=S.tr[id]; if(!x) return;
  if(x.kind==='ent'&&x.d.en&&x.d.en.pic&&!S.meta.ents[x.d.id]) dropPic(x.d.id,x.d.en.pic);
  if(x.kind==='nt'&&x.d.rec&&x.d.rec.pic&&!S.nt[x.d.id]) dropPic(x.d.id,x.d.rec.pic);
  delete S.tr[id]; forget('tr_'+id);
}
function trashPurge(){
  if(!S||!S.tr||ui.locked) return; const cut=Date.now()-TRASH_DAYS*864e5; let n=0;
  Object.keys(S.tr).forEach(id=>{ if(S.tr[id].at<cut){ trashDrop(id); n++; } }); if(n) dirty('meta');
}
function trashPeek(x){
  const d=x.d;
  if(x.kind==='scene') return trunc(plainText((d.sc||{}).text||'').replace(/\s+/g,' ').trim(),180)||'(empty scene)';
  if(x.kind==='chapter'){ const ids=(d.chap||{}).scenes||[], w=ids.reduce((a,s)=>a+wc(((d.scenes||{})[s]||{sc:{}}).sc.text||''),0); return ids.length+' scene'+(ids.length===1?'':'s')+', '+fmt(w)+' words'; }
  if(x.kind==='ent'){ const f=(d.en||{}).fields||{}, k=Object.keys(f).find(k2=>String(f[k2]).trim()); return k?trunc(String(f[k]).replace(/\s+/g,' '),160):((d.meta||{}).tag||''); }
  if(x.kind==='nt') return (d.rec||{}).ideas&&(d.item||{}).kind==='board'?d.rec.ideas.length+' ideas':trunc(String((d.rec||{}).text||'').replace(/\s+/g,' ').trim(),160);
  if(x.kind==='ol') return ((d.rec||{}).items||[]).length+' lines';
  if(x.kind==='tl') return Object.keys((d.rec||{}).cards||{}).length+' cards';
  return '';
}
function renderTrash(el){
  trashPurge();
  const list=Object.keys(S.tr).map(id=>Object.assign({id},S.tr[id])).sort((a,b)=>b.at-a.at), cf=ui.confirm;
  el.innerHTML='<div class="main-head">'+backBtn()+'<span class="kind">'+ico('trash',16)+'</span><h1 class="mh-title">Trash</h1>'
    +(list.length?'<button class="btn danger" data-tr="empty">'+ico('trash')+'<span>Empty the Trash</span></button>':'')+'</div>'
    +'<div class="pf-wrap"><p class="fine tr-sub">Deleted scenes, chapters, story pages, notes, outlines, timelines, maps and trees wait here for '+TRASH_DAYS+' days, then go for good.'+(DESK?' On a shared project, co-writers see the same Trash.':'')+'</p>'
    +(list.length?'<div class="tr-list">'+list.map(x=>{ const k=TRASH_KINDS[x.kind], left=Math.max(1,Math.ceil((x.at+TRASH_DAYS*864e5-Date.now())/864e5));
        return '<div class="tr-row" data-id="'+x.id+'"><span class="tr-ico">'+ico(k[1],16)+'</span><div class="tr-t"><b>'+esc(x.title||'Untitled')+'</b><span class="muted">'+esc(k[0]+(x.sub?' · '+x.sub:''))+'</span>'
          +'<span class="tr-peek">'+esc(trashPeek(x))+'</span><small class="muted">Deleted '+esc(ago(x.at))+(x.by&&DESK?' by '+esc(x.by):'')+' · gone in '+left+' day'+(left===1?'':'s')+'</small></div>'
          +'<div class="tr-a"><button class="btn pri" data-tr="back">Restore</button><button class="btn'+(cf==='tr'+x.id?' danger':'')+'" data-tr="drop">'+(cf==='tr'+x.id?'Delete forever?':'Delete forever')+'</button></div></div>'; }).join('')+'</div>'
      :'<div class="ss-empty"><b>The Trash is empty</b><p class="muted">When you delete something, it comes here first, so you can change your mind.</p></div>')+'</div>';
  el.onclick=e=>{ const b=e.target.closest('[data-tr]'); if(!b) return; const a=b.dataset.tr, row=b.closest('.tr-row'), id=row&&row.dataset.id;
    if(a==='back'){ const to=trashRestore(id); toast('Restored.',{plain:true}); if(to) go(to); }
    else if(a==='drop') confirmDo('tr'+id,()=>{ trashDrop(id); dirty('meta'); renderTrash(el); renderBinder(); },()=>renderTrash(el));
    else if(a==='empty') ask('Empty the Trash?','The '+list.length+' item'+(list.length===1?'':'s')+' in it will be gone for good. Inkling’s backups still keep older copies of the project.',[['go','Empty the Trash','danger'],['','Keep them']])
      .then(v=>{ if(v!=='go') return; Object.keys(S.tr).forEach(trashDrop); dirty('meta'); renderTrash(el); renderBinder(); });
  };
}

