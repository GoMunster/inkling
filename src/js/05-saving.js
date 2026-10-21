/* ---------- persistence ---------- */
function setStatus(k){
  const el=$('#saveSt'); if(!el) return; el.dataset.s=k;
  el.lastChild.textContent={saving:'Saving…',saved:'Saved to your account',local:'Saved on this device',disk:'Saved on this computer',locked:'Read-only: made by a newer Inkling',error:'Could not save, retrying'}[k]||'Saved';
}
function dirty(){
  ui.touched=true; const now=Date.now();
  for(const k of arguments){ P.dirty.add(k); P.gone.delete(k); const d=docData(k); if(d&&typeof d==='object'){ d._m=now; d._dev=DEVICE; if(ME.name) d._by=ME.name; else delete d._by; } if(S.meta.gone[k]) delete S.meta.gone[k]; }
  if(P.dirty.has('meta')) S.meta.saved=Date.now();
  if(ui.split) splitTouch([...arguments]);
  schedule(1400);
}
// A record the writer deleted: drop it from the store and leave a dated marker in meta.gone.
function forget(k){ P.gone.add(k); P.dirty.delete(k); S.meta.gone[k]=Date.now(); }
function schedule(ms){ clearTimeout(P.timer); P.timer=setTimeout(flush,ms); }
function docData(k){
  if(k==='meta') return S.meta;
  const pre=k.slice(0,2); if(k[2]==='_'&&DOCS.includes(pre)) return S[pre][k.slice(3)]||null;
  return null;
}
function lockNewer(v){
  ui.locked=v; clearTimeout(P.timer); setStatus('locked');
  toast('This project was saved by a newer version of Inkling (format '+v+'). Update Inkling to keep working on it. Nothing here will overwrite it.',{plain:true});
}
function mirrorLocal(){
  if(DESK||ui.locked) return;
  try{ const s=JSON.stringify(snapshot()); if(s.length<4500000) localStorage.setItem('inkling:project',s); }catch(e){}
}
// Where the open project is saved. Every store gets the same call, write(keys, gone): `keys` are the records that
// changed ('meta' or '<prefix>_<id>', read them with docData) and `gone` the ones deleted. A cloud store is one more
// entry here, plus a load path like connectDb()/deskOpen(). `label` is the save-status text key.
const STORES={
  local:{label:'local',async write(){ /* mirrorLocal(), called by flush() before every write, is this store */ }},
  claude:{label:'saved',async write(keys,gone){
    const col=P.db.collection(P.base);
    for(const k of keys){ const d=docData(k); if(d==null) continue; await col.doc(k).set(d); P.keys.add(k); }
    for(const k of gone){ await col.doc(k).delete(); P.keys.delete(k); }
  }},
  desktop:{label:'disk',async write(){ if(!PJ.id) return; const json=JSON.stringify(snapshot()), r=await DESK.save(PJ.id,json,deskInfo());
    if(r&&r.conflict) await deskSync(); else PJ.base=JSON.parse(json); }}
};
let store=DESK?STORES.desktop:STORES.local;
async function flush(){
  if(ui.locked) return;   // a project from a newer Inkling is shown but never overwritten
  if(P.busy){ P.again=true; return; }
  P.busy=true; const keys=[...P.dirty], gone=[...P.gone]; P.dirty.clear(); P.gone.clear();
  setStatus('saving'); mirrorLocal();
  try{ await store.write(keys,gone); P.fails=0; setStatus(store.label); }
  catch(e){
    keys.forEach(k=>P.dirty.add(k)); gone.forEach(k=>P.gone.add(k)); P.fails++; setStatus('error');
    if(DESK&&P.fails===1) toast('Could not save to this computer: '+((e&&e.message)||'unknown error')+'. Retrying.',{plain:true});
    if(P.fails<=4) schedule(4000*P.fails);
  }finally{
    P.busy=false;
    if(P.again){ P.again=false; schedule(200); }
  }
}
function allKeys(st){ return new Set(['meta'].concat(...DOCS.map(p=>Object.keys(st[p]||{}).map(k=>p+'_'+k)))); }
function markAllDirty(){
  const nk=allKeys(S);
  P.keys.forEach(k=>{ if(!nk.has(k)) P.gone.add(k); });
  nk.forEach(k=>{ P.dirty.add(k); P.gone.delete(k); });
  schedule(600);
}
async function connectDb(local){
  try{
    const cl=window.claude; if(!cl||!cl.use) return;
    const dbs=await Promise.all([cl.use('db'),cl.use('user')]);
    const db=dbs[0], user=dbs[1]; if(!db||!user) return;
    const id=await user.id(); if(!id) return;
    P.db=db; P.base='data/users/'+id; store=STORES.claude;
    const snap=await db.collection(P.base).get();
    const docs={}; snap.docs.forEach(d=>{docs[d.id]=d.data(); P.keys.add(d.id);});
    if(docs.meta){
      const o={meta:docs.meta}; DOCS.forEach(p=>{ o[p]={}; });
      Object.keys(docs).forEach(k=>{ const pre=k.slice(0,2); if(k[2]==='_'&&DOCS.includes(pre)) o[pre][k.slice(3)]=docs[k]; });
      let remote; try{ remote=normalize(o); }catch(e){ if(e.code==='newer'){ lockNewer(e.v); return; } throw e; }
      if(ui.touched||(local&&S.meta.saved>remote.meta.saved)){ markAllDirty(); }
      else{
        S=remote; linker=buildLinker(); mirrorLocal();
        if(!viewValid(ui.view)) ui.view=firstView();
        ui.hist=ui.hist.filter(viewValid); renderAll();
      }
    } else markAllDirty();
    setStatus('saved');
  }catch(e){ P.db=null; setStatus('local'); }
}

/* ---------- derived data ---------- */
const todayWords=()=>S.meta.days[todayKey()]||0;
function totalWords(){ return Object.values(S.meta.scenes).reduce((a,s)=>a+(s.words||0),0); }
function streak(){
  const g=S.meta.goal, d=S.meta.days; if(!(g>0)) return 0;
  const cur=new Date(); if((d[keyOf(cur)]||0)<g) cur.setDate(cur.getDate()-1);
  let n=0; while((d[keyOf(cur)]||0)>=g){ n++; cur.setDate(cur.getDate()-1); }
  return n;
}
function curMood(){ const w=todayWords(), g=S.meta.goal; if(w>=g) return 'party'; if(w>=g*.5) return 'hype'; if(w>0) return 'happy'; return 'sleepy'; }
function orderedScenes(){ const out=[]; S.meta.chapters.forEach(c=>c.scenes.forEach(id=>out.push({id,ch:c}))); return out; }
function firstView(){ const s=orderedScenes()[0]; return s?{k:'scene',id:s.id}:{k:'cork'}; }
function viewValid(v){ if(!v) return false; if(v.k==='scene') return !!S.meta.scenes[v.id]; if(v.k==='ent') return !!S.meta.ents[v.id]; if(v.k==='tl') return !!(S.tl[v.id]&&S.meta.tls.some(x=>x.id===v.id)); if(v.k==='nt') return !!(S.nt[v.id]&&S.meta.nts.some(x=>x.id===v.id)); if(v.k==='ol') return !!(S.ol[v.id]&&S.meta.ols.some(x=>x.id===v.id)); if(v.k==='rm'||v.k==='ft') return !!(S[v.k][v.id]&&S.meta[v.k+'s'].some(x=>x.id===v.id)); if(v.k==='snap') return !!S.meta.scenes[v.id]; return v.k==='cork'||v.k==='ss'||v.k==='prefs'||v.k==='find'||v.k==='help'||v.k==='den'||v.k==='cont'||v.k==='layout'||v.k==='plan'||v.k==='trash'||v.k==='search'||v.k==='story'||v.k==='world'||v.k==='series'; }
function viewName(v){ if(v.k==='scene') return S.meta.scenes[v.id].title; if(v.k==='ent') return S.meta.ents[v.id].name; if(v.k==='tl') return S.meta.tls.find(x=>x.id===v.id).name; if(v.k==='nt') return S.meta.nts.find(x=>x.id===v.id).name; if(v.k==='ol') return S.meta.ols.find(x=>x.id===v.id).name; if(v.k==='rm'||v.k==='ft') return S.meta[v.k+'s'].find(x=>x.id===v.id).name; if(v.k==='ss') return 'Writing sessions'; if(v.k==='prefs') return 'Settings'; if(v.k==='find') return 'Find and replace'; if(v.k==='help') return 'How sharing works'; if(v.k==='den') return S.meta.pet.name+'’s room'; if(v.k==='cont') return 'Continuity'; if(v.k==='layout') return 'Project settings'; if(v.k==='plan') return 'Deadline planner'; if(v.k==='trash') return 'Trash'; if(v.k==='search') return 'Search'; if(v.k==='story') return 'Story insights'; if(v.k==='world') return 'Calendars & money'; if(v.k==='series') return 'Series bible'; if(v.k==='snap') return 'Snapshots: '+S.meta.scenes[v.id].title; return 'Corkboard'; }

