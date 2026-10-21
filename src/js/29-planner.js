/* ---------- sidebar widths ---------- */
// Drag the edge of the binder or of the Inkling panel to widen it (or focus the edge and use the arrow keys);
// double-click an edge to put it back. Kept per device, like the rest of the appearance (LOOK.bw, LOOK.iw).
const SIDES={bw:{def:272,min:200,max:620,el:'#szL',dir:1,label:'binder'},iw:{def:308,min:260,max:640,el:'#szR',dir:-1,label:'Inkling panel'}};
const sideWant=k=>{ const v=+LOOK[k]; return v>0?v:SIDES[k].def; };
function sideRoom(k){ const o=k==='bw'?'iw':'bw'; return Math.max(SIDES[k].min,Math.min(SIDES[k].max,innerWidth-Math.min(sideWant(o),SIDES[o].max)-440)); }
const sideW=k=>Math.round(Math.max(SIDES[k].min,Math.min(sideWant(k),sideRoom(k))));
function applySides(){
  const r=document.documentElement;
  Object.keys(SIDES).forEach(k=>{ const w=sideW(k); r.style.setProperty(k==='bw'?'--bw':'--iw',w+'px');
    const h=$(SIDES[k].el); if(h){ h.setAttribute('aria-valuenow',w); h.setAttribute('aria-valuemin',SIDES[k].min); h.setAttribute('aria-valuemax',sideRoom(k)); } });
}
function setSide(k,w){ LOOK[k]=Math.round(Math.max(SIDES[k].min,Math.min(w,sideRoom(k)))); applySides(); }
function bindSizers(){
  Object.keys(SIDES).forEach(k=>{
    const o=SIDES[k], h=$(o.el); if(!h) return;
    h.addEventListener('pointerdown',e=>{
      if(e.button!==0) return; e.preventDefault(); const x0=e.clientX, w0=sideW(k);
      try{ h.setPointerCapture(e.pointerId); }catch(_){}
      h.classList.add('on'); document.body.classList.add('sizing');
      const mv=ev=>setSide(k,w0+(ev.clientX-x0)*o.dir);
      const up=()=>{ h.removeEventListener('pointermove',mv); h.removeEventListener('pointerup',up); h.removeEventListener('pointercancel',up);
        h.classList.remove('on'); document.body.classList.remove('sizing'); saveLook(); };
      h.addEventListener('pointermove',mv); h.addEventListener('pointerup',up); h.addEventListener('pointercancel',up);
    });
    h.addEventListener('dblclick',()=>{ delete LOOK[k]; saveLook(); });
    h.addEventListener('keydown',e=>{
      const d={ArrowLeft:-16,ArrowRight:16}[e.key];
      if(d){ e.preventDefault(); setSide(k,sideW(k)+d*o.dir); saveLook(); }
      else if(e.key==='Home'||e.key==='Escape'){ e.preventDefault(); delete LOOK[k]; saveLook(); }
    });
  });
  addEventListener('resize',applySides);
}

/* ---------- deadline planner ---------- */
// meta.plan (personal, like the daily goal): reach `target` words by `by`, writing on the weekdays in wd[0..6]
// (getDay order) except days in off{key:1}. mode 'total': the manuscript's word count (base = its count when the plan
// started, worked out from meta.days); mode 'new': new words written since `start` (One Book a Month). Today's goal is what
// is left at the start of today spread over the writing days left, so it stays put while you write and catches up (or
// eases off) the next day. With `auto`, meta.goal follows it. log{day:{p,g}} keeps each day's progress and goal for
// the chart and the calendar.
const PLAN_WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const isDayKey=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'');
const dayDate=k=>new Date(k+'T12:00');
const addDays=(k,n)=>{ const d=dayDate(k); d.setDate(d.getDate()+n); return keyOf(d); };
const fmtDay=(k,o)=>dayDate(k).toLocaleDateString(undefined,o||{day:'numeric',month:'short'});
function normPlan(x,len){
  x=x&&typeof x==='object'?x:{};
  const wd=Array.isArray(x.wd)&&x.wd.length===7&&x.wd.some(Boolean)?x.wd.map(Boolean):[true,true,true,true,true,true,true];
  const off={}; Object.keys(x.off||{}).filter(isDayKey).slice(-400).forEach(k=>{ off[k]=1; });
  const log={}; Object.keys(x.log||{}).filter(isDayKey).sort().slice(-500).forEach(k=>{ const v=x.log[k]||{}; log[k]={p:Math.max(0,Math.round(num(v.p,0))),g:Math.max(0,Math.round(num(v.g,0)))}; });
  const start=isDayKey(x.start)?x.start:todayKey(), by=isDayKey(x.by)?x.by:addDays(start,90);
  return {on:!!x.on&&by>start, mode:x.mode==='new'?'new':'total', target:clamp(Math.round(num(x.target,len||80000)),100,2000000),
    start, by, base:Math.max(0,Math.round(num(x.base,0))), based:isDayKey(x.based)?x.based:'', wd, off, auto:x.auto!==false, log, doneAt:+x.doneAt||0};
}
// Writing days from a to b (keys, inclusive).
function planDays(p,a,b){ const out=[]; if(a>b) return out; const d=dayDate(a);
  for(let i=0;i<1500;i++){ const k=keyOf(d); if(k>b) break; if(p.wd[d.getDay()]&&!p.off[k]) out.push(k); d.setDate(d.getDate()+1); } return out; }
function sumDays(a,b){ const d=S.meta.days; let n=0; Object.keys(d).forEach(k=>{ if(k>=a&&k<=b) n+=d[k]||0; }); return n; }
function planState(){
  const p=S.meta.plan; if(!p||!p.on) return null;
  const today=todayKey(), tw=S.meta.days[today]||0, started=today>=p.start, past=today>p.by;
  const from=p.mode==='new'?0:p.base, done=p.mode==='new'?(started?sumDays(p.start,today):0):totalWords();
  const dayStart=started&&!past?done-tw:done, all=planDays(p,p.start,p.by), N=Math.max(1,all.length);
  const left=planDays(p,started?today:p.start,p.by), writingToday=started&&left[0]===today, remaining=Math.max(0,p.target-done);
  const share=k=>{ let c=0; for(const x of all){ if(x<=k) c++; else break; } return c; };
  const ideal=k=>from+(p.target-from)*share(k)/N;
  const goalNow=Math.max(0,Math.ceil(Math.max(0,p.target-dayStart)/Math.max(1,left.length)));
  const todayGoal=writingToday?goalNow:0, nextGoal=writingToday?goalNow:Math.max(0,Math.ceil(remaining/Math.max(1,left.length)));
  const nextDay=writingToday?today:left[0]||'';
  let status='ok', diff=0;
  if(remaining<=0) status='done';
  else if(!started) status='soon';
  else if(past) status='past';
  else { const a=done-ideal(today); if(a>=Math.max(50,p.target*.002)){ status='ahead'; diff=Math.round(a); }
    else if(dayStart>=ideal(addDays(today,-1))-1) status='ok';
    else { status='behind'; diff=Math.round(ideal(today)-done); } }
  const elapsed=all.filter(k=>k<today).length, pace=elapsed?(dayStart-from)/elapsed:0;
  let finish='';
  if(remaining>0&&pace>0){ let need=remaining; const d=dayDate(writingToday?today:(left[0]||today));
    for(let i=0;i<3000&&need>0;i++){ const k=keyOf(d); if(p.wd[d.getDay()]&&!p.off[k]) need-=pace; if(need<=0){ finish=k; break; } d.setDate(d.getDate()+1); } }
  return {p,today,started,past,from,done,dayStart,all,left,writingToday,remaining,todayGoal,nextGoal,nextDay,ideal,status,diff,pace,finish,elapsed};
}
function planLabel(st){
  const by=fmtDay(st.p.by);
  if(st.status==='done') return 'Deadline goal reached!';
  if(st.status==='soon') return 'Starts '+fmtDay(st.p.start)+' · '+fmt(st.nextGoal)+' a writing day';
  if(st.status==='past') return 'Deadline passed: '+fmt(st.remaining)+' to go';
  const today=st.writingToday?fmt(st.todayGoal)+' today':'rest day';
  if(st.status==='ahead') return fmt(st.diff)+' ahead · '+today+' · by '+by;
  if(st.status==='behind') return fmt(st.diff)+' behind · '+today+' · by '+by;
  return 'On track · '+today+' · by '+by;
}
// Keeps the plan's bookkeeping current: the base count once the plan starts, today's log, the daily goal, the cheer.
function planSync(){
  const p=S.meta.plan; if(!p||!p.on) return;
  const today=todayKey(); let ch=false;
  if(p.mode==='total'&&today>=p.start&&p.based!==p.start){ p.base=Math.max(0,totalWords()-sumDays(p.start,today)); p.based=p.start; ch=true; }
  const st=planState(); if(!st) return;
  if(st.started&&!st.past){ const g=st.writingToday?st.todayGoal:0, cur=p.log[today]; if(!cur||cur.p!==st.done||cur.g!==g){ p.log[today]={p:st.done,g}; ch=true; } }
  if(p.auto&&st.started&&st.status!=='done'&&!st.past){ const g=clamp(st.writingToday?st.todayGoal:st.nextGoal,50,20000); if(g!==S.meta.goal){ S.meta.goal=g; ch=true; const gi=$('#goalIn'); if(gi) gi.value=g; } }
  if(st.status==='done'&&!p.doneAt){ p.doneAt=Date.now(); ch=true; cheer(pick(['You reached '+fmt(p.target)+' words'+(st.past?'':' before your deadline')+'! '+S.meta.pet.name+' is beside itself.','Deadline goal: done! '+fmt(p.target)+' words.']),true); }
  if(ch) dirty('meta');
}
function planPaint(){
  const el=$('#planLine'); if(!el) return; const st=planState();
  el.innerHTML=ico('cal',13)+'<span>'+(st?esc(planLabel(st)):'Plan a deadline…')+'</span>'; el.className='plan-line'+(st?' s-'+st.status:' off');
}
// "Behind / ahead" for Inky when a project opens.
function planGreet(){
  const st=planState(); if(!st||!st.started||st.past) return '';
  if(st.status==='ahead') return 'We are '+fmt(st.diff)+' words ahead of schedule. Nice!';
  if(st.status==='behind') return 'We are a little behind the plan, but today’s '+fmt(st.todayGoal)+' words catch us up.';
  return st.writingToday?'Today’s plan: '+fmt(st.todayGoal)+' words. You can do this.':'';
}
function planChart(st){
  const p=st.p, W=640, H=220, L=54, R=14, T=14, B=26, pw=W-L-R, ph=H-T-B, days=[];
  for(let k=p.start,i=0;k<=p.by&&i<1500;k=addDays(k,1),i++) days.push(k);
  const n=Math.max(1,days.length-1), max=Math.max(p.target,st.done)*1.04, min=p.mode==='new'?0:Math.max(0,Math.min(st.from,st.done)*.96);
  const x=i=>L+i/n*pw, y=v=>T+ph-(v-min)/Math.max(1,max-min)*ph;
  let ideal='', act='', prev=st.from, ti=-1;
  days.forEach((k,i)=>{ ideal+=(i?'L':'M')+x(i).toFixed(1)+' '+y(st.ideal(k)).toFixed(1);
    if(k<=st.today){ const lg=p.log[k]; let v=k===st.today?st.done:lg?lg.p:p.mode==='new'?sumDays(p.start,k):prev; prev=v; act+=(act?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1); if(k===st.today) ti=i; } });
  let h='';
  for(let i=0;i<=4;i++){ const v=min+(max-min)*i/4, yy=Math.round(y(v))+.5; h+='<line class="wc-grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'"/><text class="wc-ax" x="'+(L-8)+'" y="'+(yy+4)+'" text-anchor="end">'+(v>=1000?(Math.round(v/100)/10)+'k':Math.round(v))+'</text>'; }
  h+='<line class="pl-tgt" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(p.target)+'" y2="'+y(p.target)+'"/>';
  h+='<path class="pl-ideal" d="'+ideal+'"/>'+(act?'<path class="pl-act" d="'+act+'"/>':'');
  if(ti>=0) h+='<line class="pl-now" x1="'+x(ti)+'" x2="'+x(ti)+'" y1="'+T+'" y2="'+(T+ph)+'"/><circle class="pl-dot" cx="'+x(ti)+'" cy="'+y(st.done)+'" r="4.5"/>';
  h+='<text class="wc-ax" x="'+L+'" y="'+(H-8)+'">'+esc(fmtDay(p.start))+'</text><text class="wc-ax" x="'+(W-R)+'" y="'+(H-8)+'" text-anchor="end">'+esc(fmtDay(p.by))+'</text>';
  return '<svg class="pl-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc('Progress: '+fmt(st.done)+' of '+fmt(p.target)+' words, against the plan')+'">'+h+'</svg>'
    +'<div class="pl-key"><span><i class="k-act"></i>You</span><span><i class="k-ideal"></i>The plan</span></div>';
}
function planCal(st){
  const p=st.p, span=Math.round((dayDate(p.by)-dayDate(p.start))/864e5);
  let a=p.start, b=p.by, note='';
  if(span>126){ a=st.today<p.start?p.start:addDays(st.today,-14); if(a<p.start) a=p.start; b=addDays(a,83); if(b>p.by) b=p.by; note='<p class="fine">Showing '+fmtDay(a)+' to '+fmtDay(b)+'.</p>'; }
  const d0=dayDate(a); d0.setDate(d0.getDate()-((d0.getDay()+6)%7)); let h='<div class="pl-cal"><div class="pl-wk">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(w=>'<b>'+w+'</b>').join('')+'</div>';
  const fut=st.writingToday?st.todayGoal:st.nextGoal;
  for(let w=0;w<30;w++){ const ws=new Date(d0); ws.setDate(d0.getDate()+w*7); if(keyOf(ws)>b) break; h+='<div class="pl-wk">';
    for(let i=0;i<7;i++){ const dd=new Date(ws); dd.setDate(ws.getDate()+i); const k=keyOf(dd);
      if(k<a||k>b){ h+='<span class="pl-d out"></span>'; continue; }
      const wr=p.wd[dd.getDay()]&&!p.off[k], words=S.meta.days[k]||0, lg=p.log[k], g=lg?lg.g:Math.ceil((p.target-st.from)/Math.max(1,st.all.length)), isT=k===st.today;   // days before the log: the plan's even share
      let cls='pl-d', sub='';
      if(!wr){ cls+=' rest'; sub=words?fmt(words):(p.off[k]?'off':'rest'); }
      else if(k>st.today){ cls+=' fut'; sub=fmt(fut); }
      else { const goal=isT?st.todayGoal:g; if(goal&&words>=goal) cls+=' met'; else if(words>0) cls+=' part'; else if(!isT) cls+=' miss'; sub=fmt(words)+(isT&&goal?' / '+fmt(goal):''); }
      if(isT) cls+=' today';
      h+='<button class="'+cls+'" data-day="'+k+'"'+(k>=st.today&&p.wd[dd.getDay()]?'':' disabled')+' title="'+esc(fmtDay(k,{weekday:'long',day:'numeric',month:'long'})+(k>=st.today&&p.wd[dd.getDay()]?(p.off[k]?' · click to write this day after all':' · click to take this day off'):''))+'"><b>'+dd.getDate()+'</b><small>'+esc(sub)+'</small></button>'; }
    h+='</div>'; }
  return note+h+'</div>';
}
function renderPlan(el){
  const m=S.meta, p=m.plan, st=planState(), today=todayKey();
  const tile=(v,l,c)=>'<div class="ss-tile'+(c?' '+c:'')+'"><b class="mono">'+v+'</b><span>'+l+'</span></div>';
  const sl={done:'Goal reached',soon:'Not started yet',past:'Deadline passed',ahead:fmt(st?st.diff:0)+' ahead',behind:fmt(st?st.diff:0)+' behind',ok:'On track'};
  el.innerHTML='<div class="main-head">'+backBtn()+'<span class="kind">'+ico('cal',16)+'</span><h1 class="mh-title">Deadline planner</h1>'
    +(p.on?'<button class="btn" data-pl="stop">Stop the plan</button>':'')+'</div><div class="pf-wrap pl">'
    +(st?'<section class="pf pl-now-box s-'+st.status+'"><h2>'+esc(sl[st.status])+'</h2><p class="pl-say">'+esc(st.status==='done'?'You reached '+fmt(p.target)+' words. Set a new goal below to keep going.':st.status==='past'?'The deadline was '+fmtDay(p.by,{day:'numeric',month:'long'})+'. Choose a new date below and Inkling works out a fresh daily goal.':st.status==='soon'?'Your plan starts on '+fmtDay(p.start,{weekday:'long',day:'numeric',month:'long'})+'.':st.status==='behind'?'No stress: the missed words are spread over the days left, so today’s goal is a little higher.':st.status==='ahead'?'Your extra words lower the goal for the days left.':'Write today’s goal and you stay on course.')+'</p>'
      +'<div class="ss-tiles">'+tile(st.writingToday?fmt(st.todayGoal):st.status==='done'?'✓':'–',st.writingToday?'words today':'today is a rest day','hi')
      +tile(fmt(st.done),p.mode==='new'?'new words so far':'words in the draft')+tile(fmt(st.remaining),'words to go')+tile(st.left.length,'writing days left')
      +(st.status!=='done'&&!st.writingToday&&st.nextDay?tile(fmt(st.nextGoal),'a day from '+fmtDay(st.nextDay)):'')
      +(st.pace?tile(fmt(st.pace),'your average per writing day'):'')+(st.finish?tile(fmtDay(st.finish),'finish at this pace',st.finish>p.by?'warn':''):'')+'</div>'
      +'<div class="bar lg pl-bar"><i style="width:'+Math.min(100,(st.done-st.from)/Math.max(1,p.target-st.from)*100)+'%"></i></div></section>'
      +(st.started?'<section class="pf"><h2>Progress</h2>'+planChart(st)+'</section>':'')
      +'<section class="pf"><h2>Calendar</h2><p class="fine">Click a coming day to take it off, or to put it back. The goal for the other days adjusts.</p>'+planCal(st)+'</section>':'')
    +'<section class="pf"><h2>'+(p.on?'Your plan':'Set a deadline')+'</h2>'
    +(p.on?'':'<p class="fine">Tell Inkling where you want to get to and by when. It works out how much to write each day, and adjusts when you write more or less.</p>')
    +'<div class="seg pl-mode"><button data-pm2="total"'+(p.mode==='total'?' class="on"':'')+'>Finish my draft</button><button data-pm2="new"'+(p.mode==='new'?' class="on"':'')+'>Write new words</button></div>'
    +'<p class="fine">'+(p.mode==='total'?'Counts the whole manuscript: reach this many words in total.':'Counts only new words written from the start date, as in One Book a Month.')+'</p>'
    +'<div class="two"><label class="f">'+(p.mode==='total'?'Manuscript length':'New words')+'<input id="plTarget" type="number" min="100" step="1000" value="'+p.target+'"></label><label class="f">Deadline<input id="plBy" type="date" value="'+p.by+'"></label></div>'
    +'<div class="two"><label class="f">Start<input id="plStart" type="date" value="'+p.start+'"></label><div></div></div>'
    +'<span class="sec-l">Days I write</span><div class="pl-wd">'+[1,2,3,4,5,6,0].map(i=>'<button data-wd="'+i+'" aria-pressed="'+p.wd[i]+'"'+(p.wd[i]?' class="on"':'')+'>'+PLAN_WD[i]+'</button>').join('')+'</div>'
    +'<label class="ck"><input type="checkbox" id="plAuto"'+(p.auto?' checked':'')+'>Set my daily goal from this plan</label>'
    +'<p class="fine pl-err" id="plErr" hidden></p>'
    +'<div class="ts-row">'+(p.on?'':'<button class="btn pri" data-pl="go">'+ico('cal',14)+'<span>Start the plan</span></button>')+'<button class="btn" data-pl="month" title="50,000 new words in a month, starting today">One Book a Month</button></div>'
    +(DESK?'<p class="fine">Your plan is yours alone on a shared project, like your daily goal.</p>':'')+'</section></div>';
  const err=$('#plErr',el), check=()=>{ const bad=p.by<=p.start?'The deadline needs to be after the start.':!planDays(p,p.start,p.by).length?'There are no writing days before the deadline.':''; err.textContent=bad; err.hidden=!bad; return !bad; };
  check();
  const apply=()=>{ S.meta.plan=normPlan(Object.assign({},p,{on:p.on&&p.by>p.start})); planSync(); dirty('meta'); updateStats(); renderInspector(); renderPlan(el); };
  el.onchange=e=>{ const x=e.target;
    if(x.id==='plTarget') p.target=clamp(Math.round(+x.value||p.target),100,2000000);
    else if(x.id==='plBy'&&isDayKey(x.value)) p.by=x.value;
    else if(x.id==='plStart'&&isDayKey(x.value)){ p.start=x.value; p.based=''; }
    else if(x.id==='plAuto') p.auto=x.checked;
    else return;
    if(!check()) return; apply(); };
  el.onclick=e=>{
    const b=e.target.closest('[data-pl],[data-pm2],[data-wd],[data-day]'); if(!b||b.disabled) return;
    if(b.dataset.pm2){ p.mode=b.dataset.pm2; p.based=''; if(p.mode==='new'&&p.target>=S.meta.target) p.target=50000; else if(p.mode==='total'&&p.target<totalWords()) p.target=S.meta.target; apply(); return; }
    if(b.dataset.wd){ const i=+b.dataset.wd; p.wd[i]=!p.wd[i]; if(!p.wd.some(Boolean)) p.wd[i]=true; if(check()) apply(); else renderPlan(el); return; }
    if(b.dataset.day){ const k=b.dataset.day; if(p.off[k]) delete p.off[k]; else p.off[k]=1; apply(); return; }
    const a=b.dataset.pl;
    if(a==='go'){ if(!check()) return; p.on=true; p.based=''; p.doneAt=0; apply(); toast('Plan started. '+(p.auto?'Your daily goal now follows it.':''),{plain:true}); }
    else if(a==='stop') ask('Stop the plan?','Your daily goal stays at '+fmt(S.meta.goal)+' words, and you can start a new plan any time.',[['stop','Stop the plan','danger'],['','Keep it']]).then(v=>{ if(v!=='stop') return; p.on=false; dirty('meta'); updateStats(); renderInspector(); renderPlan(el); });
    else if(a==='month'){ const d=dayDate(today); d.setMonth(d.getMonth()+1); d.setDate(d.getDate()-1);   // One Book a Month: 50,000 new words, starting today
      Object.assign(p,{mode:'new',target:50000,start:today,by:keyOf(d),wd:[true,true,true,true,true,true,true],based:''}); if(check()) apply(); }
  };
}

