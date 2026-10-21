/* ---------- continuity ---------- */
// Checks the scenes against the story pages: facts that disagree (eyes, hair, age), names that look misspelled,
// characters who drop out of the story, and pages never mentioned. Results are cached for a few seconds.
const CONT_COLORS='blue green brown hazel grey gray black amber violet red auburn blond blonde brunette ginger silver white golden gold dark fair copper chestnut raven pale yellow purple pink orange'.split(' ');
const CONT_NUMS={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
function parseFacts(t){ const f={}; String(t||'').split('\n').forEach(l=>{ const m=l.match(/^\s*([^:=]{2,30})\s*[:=]\s*(.+?)\s*$/); if(!m) return;
  const k=m[1].toLowerCase().trim(), v=m[2].toLowerCase().trim(); const key=/\beyes?\b/.test(k)?'eyes':/\bhair\b/.test(k)?'hair':/\bage\b|\bhow old\b/.test(k)?'age':k; f[key]=v; }); return f; }
const ageNum=w=>{ w=String(w).toLowerCase(); if(/^\d+$/.test(w)) return +w; const p=w.split(/[- ]/); return p.reduce((a,x)=>a+(CONT_NUMS[x]||0),0)||null; };
function lev1(a,b){ if(a===b) return false; if(Math.abs(a.length-b.length)>1) return false; let i=0; while(i<a.length&&a[i]===b[i]) i++;
  if(a.length===b.length){ if(a.slice(i+1)===b.slice(i+1)) return true; return a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2); }
  const [s2,l2]=a.length<b.length?[a,b]:[b,a]; return s2.slice(i)===l2.slice(i+1); }
const contKey=x=>[x.kind,x.ent||'',x.scene||'',x.word||x.said||''].join(':');
function contCheck(force){
  if(!force&&ui.cont&&Date.now()-ui.cont.at<4000&&ui.cont.v===S.meta.saved) return ui.cont.list;
  const m=S.meta, ents=Object.values(m.ents), scenes=orderedScenes(), out=[], facts={}, ign=m.contIgnore||{};
  ents.forEach(e=>{ const f=parseFacts(((S.en[e.id]||{}).fields||{}).facts); if(Object.keys(f).length) facts[e.id]=f; });
  const chIdx={}; m.chapters.forEach((c,i)=>chIdx[c.id]=i);
  const seen={}, nameWords=new Set(), cand={};
  ents.forEach(e=>[e.name].concat(e.aliases||[]).forEach(n=>String(n).split(/\s+/).forEach(w=>{ w=w.replace(/[^\p{L}'’-]/gu,''); if(w) nameWords.add(w); })));
  const cv='('+CONT_COLORS.join('|')+')', eyeRe=new RegExp('\\b'+cv+'(?:[- ]\\w+)?[- ]eyed\\b|\\b'+cv+'(?:[- ]\\w+)?\\s+eyes?\\b|\\beyes?\\s+(?:were|was|are|is|of|gone|now)?\\s*(?:a\\s+)?(?:\\w+\\s+)?'+cv+'\\b','gi');
  const hairRe=new RegExp('\\b'+cv+'(?:[- ]\\w+)?[- ]haired\\b|\\b'+cv+'(?:[- ]\\w+)?\\s+(?:hair|curls|braids?|locks|ponytail)\\b|\\bhair\\s+(?:was|were|is|now|gone|turned)?\\s*(?:\\w+\\s+)?'+cv+'\\b','gi');
  const ageRe=/\b(\d{1,3}|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?)[- ]years?[- ]old\b/gi;
  scenes.forEach(o=>{
    const vis=plainText(S.sc[o.id].text), links=findLinks(vis);
    links.forEach(l=>{ const s2=seen[l.id]||(seen[l.id]={n:0,first:null,last:null,chs:new Set()}); s2.n++; if(!s2.first) s2.first={scene:o.id,s:l.s,e:l.e}; s2.last={scene:o.id,s:l.s,e:l.e}; s2.chs.add(chIdx[o.ch.id]); });
    if(Object.keys(facts).length){
      const sre=/[^.!?\n]+[.!?]*/g; let sm, li=0;
      while((sm=sre.exec(vis))){
        const s0=sm.index, e0=s0+sm[0].length; while(li<links.length&&links[li].e<=s0) li++;
        const inS=[]; for(let k=li;k<links.length&&links[k].s<e0;k++) inS.push(links[k]); if(!inS.length) continue;
        const owner=p=>{ let best=null; inS.forEach(l=>{ if(l.s<p) best=l; }); return best||inS[0]; };
        [['eyes',eyeRe],['hair',hairRe]].forEach(([attr,re])=>{ re.lastIndex=0; let mm;
          while((mm=re.exec(sm[0]))){ const said=(mm[1]||mm[2]||mm[3]||'').toLowerCase(), p=s0+mm.index, ow=owner(p), f=facts[ow.id];
            if(!f||!f[attr]||!said||f[attr].includes(said)||(said==='grey'&&f[attr].includes('gray'))||(said==='gray'&&f[attr].includes('grey'))) continue;
            out.push({kind:'fact',ent:ow.id,scene:o.id,s:p,e:p+mm[0].length,attr,said,fact:f[attr],text:sm[0].trim()}); } });
        ageRe.lastIndex=0; let am;
        while((am=ageRe.exec(sm[0]))){ const p=s0+am.index, ow=owner(p), f=facts[ow.id]; if(!f||!f.age) continue; const a=ageNum(am[1]), fa=ageNum(f.age.match(/[\w-]+/)[0]);
          if(a&&fa&&a!==fa) out.push({kind:'fact',ent:ow.id,scene:o.id,s:p,e:p+am[0].length,attr:'age',said:String(a),fact:f.age,text:sm[0].trim()}); }
      }
    }
    const wre=/\b\p{Lu}[\p{Ll}'’]{3,}\b/gu; let wm;
    while((wm=wre.exec(vis))){ const w=wm[0].replace(/['’].*$/,''); if(w.length<4||nameWords.has(w)) continue; const c=cand[w]||(cand[w]={n:0,scene:o.id,s:wm.index,e:wm.index+w.length}); c.n++; }
  });
  Object.keys(cand).forEach(w=>{ for(const nw of nameWords){ if(nw.length>=4&&nw[0]===w[0]&&lev1(w,nw)){ const c=cand[w]; out.push({kind:'spell',word:w,likely:nw,n:c.n,scene:c.scene,s:c.s,e:c.e}); break; } } });
  const nch=m.chapters.length;
  ents.forEach(e=>{ const s2=seen[e.id];
    if(!s2){ out.push({kind:'unused',ent:e.id}); return; }
    if(e.type!=='char'||s2.n<2||nch<5) return;
    const idx=[...s2.chs].sort((a,b)=>a-b), lastCh=idx[idx.length-1];
    if(nch-1-lastCh>=3) out.push({kind:'gone',ent:e.id,since:lastCh,left:nch-1-lastCh,scene:s2.last.scene,s:s2.last.s,e:s2.last.e});
    else for(let k=1;k<idx.length;k++) if(idx[k]-idx[k-1]>=5){ out.push({kind:'gap',ent:e.id,from:idx[k-1],to:idx[k]}); break; }
  });
  const list=out.filter(x=>!ign[contKey(x)]);
  ui.cont={at:Date.now(),v:S.meta.saved,list,seen}; return list;
}
const contCount=()=>contCheck().filter(x=>x.kind==='fact'||x.kind==='spell').length;
function contLabel(x){
  const m=S.meta, e=x.ent&&m.ents[x.ent], nm=e?e.name:'', ch=i=>(m.chapters[i]||{}).title||'chapter '+(i+1);
  if(x.kind==='fact') return '<b>'+esc(nm)+'</b>: '+esc({eyes:'eyes',hair:'hair',age:'age'}[x.attr]||x.attr)+' are “'+esc(x.said)+'” here, but the page says “'+esc(x.fact)+'”.';
  if(x.kind==='spell') return '“<b>'+esc(x.word)+'</b>” ('+x.n+'×) looks like “'+esc(x.likely)+'”. A typo?';
  if(x.kind==='gone') return '<b>'+esc(nm)+'</b> has not appeared since '+esc(ch(x.since))+' ('+x.left+' chapter'+(x.left===1?'':'s')+' ago).';
  if(x.kind==='gap') return '<b>'+esc(nm)+'</b> disappears between '+esc(ch(x.from))+' and '+esc(ch(x.to))+'.';
  if(x.kind==='unused') return '<b>'+esc(nm)+'</b> is not mentioned in any scene yet.';
  return '';
}
function contItem(x){
  const sc=x.scene&&S.meta.scenes[x.scene];
  return '<div class="ct-item k-'+x.kind+'"><div class="ct-t">'+contLabel(x)+(x.text?'<span class="ct-q">“'+esc(trunc(x.text,160))+'”</span>':'')+'</div><div class="ct-a">'
    +(sc?'<button class="btn sm" data-ct="go" data-sc="'+x.scene+'" data-s="'+x.s+'" data-e="'+x.e+'">'+esc(trunc(sc.title,26))+'</button>':'')
    +(x.ent?'<button class="btn sm" data-ct="page" data-id="'+x.ent+'">Page</button>':'')
    +'<button class="ibtn" data-ct="ign" data-k="'+esc(contKey(x))+'" title="Not a problem: hide this" aria-label="Hide this">'+ico('x',14)+'</button></div></div>';
}
function contClick(e){
  const b=e.target.closest('[data-ct]'); if(!b) return false; const a=b.dataset.ct;
  if(a==='go'){ ui.findSel={id:b.dataset.sc,s:+b.dataset.s,e:+b.dataset.e}; go({k:'scene',id:b.dataset.sc}); }
  else if(a==='page') go({k:'ent',id:b.dataset.id});
  else if(a==='ign'){ S.meta.contIgnore=S.meta.contIgnore||{}; S.meta.contIgnore[b.dataset.k]=1; dirty('meta'); contCheck(true); renderMain(); renderInspector(); }
  return true;
}
function renderCont(el){
  const list=contCheck(true), g=k=>list.filter(x=>x.kind===k), nIgn=Object.keys(S.meta.contIgnore||{}).length;
  const sec=(t,sub,items,empty)=>'<section class="pf"><h2>'+t+' <span class="muted">'+items.length+'</span></h2><p class="fine">'+sub+'</p>'+(items.length?items.map(contItem).join(''):'<p class="ct-none">'+empty+'</p>')+'</section>';
  el.innerHTML='<div class="main-head">'+backBtn()+'<span class="kind">'+ico('search',16)+'</span><h1 class="mh-title">Continuity</h1>'+(nIgn?'<button class="btn" data-ct="unign">Show '+nIgn+' hidden</button>':'')+'</div><div class="pf-wrap">'
    +sec('Facts that disagree','Add key facts to a story page (like <b>eyes: green</b>, <b>hair: auburn</b>, <b>age: 34</b>) and Inkling checks every scene against them.',[...g('fact')],'No disagreements found.')
    +sec('Possible typos in names','Words that differ by one letter from a name or alias.',g('spell'),'No look-alike names found.')
    +sec('Characters who drop out','Characters mentioned more than once who vanish for several chapters (books with 5 or more chapters).',[...g('gone'),...g('gap')],'Everyone keeps turning up.')
    +sec('Pages not mentioned yet','Story pages whose name or aliases do not appear in any scene.',g('unused'),'Every page is mentioned somewhere.')+'</div>';
  el.onclick=e=>{ if(e.target.closest('[data-ct="unign"]')){ S.meta.contIgnore={}; dirty('meta'); renderCont(el); return; } contClick(e); };
}
function entContHtml(e){
  const list=contCheck(), mine=list.filter(x=>x.ent===e.id&&x.kind!=='unused'), s2=(ui.cont.seen||{})[e.id], m=S.meta;
  const chName=id=>{ const c=m.chapters.find(c2=>c2.scenes.includes(id)); return c?c.title:''; };
  return '<section class="facts"><h3>Key facts</h3><p class="sub">One per line, like <b>eyes: green</b>, <b>hair: auburn</b>, <b>age: 34</b>. Inkling checks your scenes against these.</p>'
    +'<textarea data-k="facts" rows="3" placeholder="eyes: green&#10;hair: auburn&#10;age: 34">'+esc(((S.en[e.id]||{}).fields||{}).facts||'')+'</textarea>'
    +(s2?'<p class="sub ct-seen">First seen in <b>'+esc(m.scenes[s2.first.scene].title)+'</b> ('+esc(chName(s2.first.scene))+'), last seen in <b>'+esc(m.scenes[s2.last.scene].title)+'</b> ('+esc(chName(s2.last.scene))+'). '+s2.n+' mention'+(s2.n===1?'':'s')+'.</p>':'')
    +(mine.length?'<div class="ct-list">'+mine.map(contItem).join('')+'</div>':'')+'</section>';
}
function mentionCounts(){ contCheck(); const out={}, sn=(ui.cont&&ui.cont.seen)||{}; Object.keys(sn).forEach(k=>out[k]=sn[k].n); return out; }

