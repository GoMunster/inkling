/* ---------- focus timer (pomodoro) and writing sessions ---------- */
// Timer state lives only in this page (T); each finished or stopped focus session is saved to S.ss with the
// new words credited while it ran (same rules as the daily goal) and the scenes typed in.
const T={phase:'focus',running:false,endAt:0,left:null,count:0,cur:null,tick:null};
const PM_PHASE={focus:'Focus',short:'Short break',long:'Long break'};
function normPomo(p){
  p=p&&typeof p==='object'?p:{}; const n=(v,d,a,b)=>clamp(Math.round(num(v,d)),a,b);
  return {focus:n(p.focus,25,1,180),short:n(p.short,5,1,60),long:n(p.long,15,1,120),every:n(p.every,4,1,12),goal:n(p.goal,0,0,20000),autoBreak:p.autoBreak!==false,autoFocus:!!p.autoFocus,sound:p.sound!==false};
}
const pmLen=ph=>S.meta.pomo[ph]*60000;
const pmLeft=()=>T.running?Math.max(0,T.endAt-Date.now()):(T.left!=null?T.left:pmLen(T.phase));
const mmss=ms=>{ const s=Math.ceil(ms/1000); return Math.floor(s/60)+':'+pad(s%60); };
let AC=null;
function pmAudio(){ try{ if(!AC&&S.meta.pomo.sound) AC=new (window.AudioContext||window.webkitAudioContext)(); if(AC&&AC.state==='suspended') AC.resume(); }catch(e){} }
function pmChime(up){
  if(!S.meta.pomo.sound||!AC) return;
  try{ const t=AC.currentTime; (up?[523.25,659.25,783.99]:[659.25,523.25]).forEach((f,i)=>{ const o=AC.createOscillator(), g=AC.createGain(), s0=t+i*.18;
    o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(0,s0); g.gain.linearRampToValueAtTime(.16,s0+.02); g.gain.exponentialRampToValueAtTime(.001,s0+.9);
    o.connect(g); g.connect(AC.destination); o.start(s0); o.stop(s0+1); }); }catch(e){}
}
function pmStart(){
  if(T.running) return; const left=pmLeft(); T.endAt=Date.now()+left; T.running=true; T.left=null;
  if(T.phase==='focus'){ if(!T.cur) T.cur={start:Date.now(),ms:0,words:0,total0:totalWords(),scenes:new Set()}; T.cur.since=Date.now();
    if(ui.view&&ui.view.k==='scene') T.cur.scenes.add(ui.view.id);
    say(pick(['Timer on. I will keep watch while you write.','Focus time! Words first, worries later.','Go! I am counting your words.'])); }
  hereSoon(); pmAudio(); clearInterval(T.tick); T.tick=setInterval(pmTick,250); pmPaint();
}
function pmPause(){ if(!T.running) return; hereSoon(); T.left=pmLeft(); T.running=false; clearInterval(T.tick); if(T.cur) T.cur.ms+=Date.now()-T.cur.since; pmPaint(); }
function pmRecord(done){
  const c=T.cur; T.cur=null; if(!c) return null; if(T.running) c.ms+=Date.now()-c.since;
  if(c.ms<60000&&!c.words) return null;   // under a minute with nothing written is not worth keeping
  const k=Math.floor(T.count/S.meta.pomo.every); if(!T.cyc||T.cyc.k!==k) T.cyc={k,id:uid('cy_')};   // the sessions up to a long break
  const id=uid('w_'); S.ss[id]={start:c.start,end:Date.now(),planned:S.meta.pomo.focus,mins:Math.round(c.ms/6000)/10,words:c.words,net:totalWords()-c.total0,done:!!done,scenes:[...c.scenes],cyc:T.cyc.id};
  dirty('ss_'+id); if(ui.view&&ui.view.k==='ss') renderMain(); return S.ss[id];
}
function pmTick(){ if(!T.running) return; if(Date.now()>=T.endAt) pmEnd(); else pmPaint(); }
function pmNext(rec){ T.count++; T.phase=T.count%S.meta.pomo.every===0?'long':'short'; return rec; }
function pmEnd(){
  clearInterval(T.tick); const P2=S.meta.pomo, wasFocus=T.phase==='focus'; let r=null; hereSoon();
  if(wasFocus){ r=pmRecord(true); if(r) todoTick('sprint'); }
  T.running=false; T.left=null;
  if(wasFocus){ pmNext();
    const msg=(r?'Session done: '+fmt(r.words)+' new word'+(r.words===1?'':'s')+(r.mins?', '+wpmFmt(wpmOf(r))+' a minute':'')+'. ':'Session done. ')+(T.phase==='long'?'Take a long break, you earned it.':'Stretch, sip something, back soon.');
    pmChime(true); cheer(msg,!!(r&&P2.goal&&r.words>=P2.goal)); checkAch(); if(P2.autoBreak) pmStart();
    if(r&&T.phase==='long') setTimeout(()=>pmReport(r.cyc),400); }
  else { T.phase='focus'; pmChime(false); toast('Break is over. Ready when you are.'); say('Break is over. Shall we write?'); if(P2.autoFocus) pmStart(); }
  pmPaint();
}
function pmStop(){
  const wasFocus=T.phase==='focus'&&T.cur, r=wasFocus?pmRecord(false):null;
  clearInterval(T.tick); T.running=false; T.left=null; T.cur=null; pmPaint(); hereSoon();
  if(r) toast('Saved this session: '+fmt(r.words)+' new words in '+r.mins+' min.',{plain:true});
}
function pmSkip(){
  if(T.phase==='focus'){ const r=pmRecord(false); clearInterval(T.tick); T.running=false; T.left=null; pmNext(); if(r) toast('Saved this session ('+fmt(r.words)+' new words). On to your break.',{plain:true}); if(r&&T.phase==='long') setTimeout(()=>pmReport(r.cyc),400); }
  else { clearInterval(T.tick); T.running=false; T.left=null; T.phase='focus'; }
  pmPaint();
}
function pmHalt(){ if(T.cur) pmRecord(false); clearInterval(T.tick); T.running=false; T.left=null; T.cur=null; T.phase='focus'; pmPaint(); }
const RING2=2*Math.PI*52;
function pmPaint(){
  if(!S) return; const left=pmLeft(), len=pmLen(T.phase), P2=S.meta.pomo, active=T.running||T.left!=null||!!T.cur;
  const chip=$('#pmChip'); if(chip){ chip.hidden=!active; chip.lastChild.textContent=(T.phase==='focus'?'':'Break ')+mmss(left); chip.classList.toggle('brk',T.phase!=='focus'); chip.classList.toggle('paused',!T.running); }
  const el=$('#pmTime'); if(!el) return; const box=$('#pomo');
  box.dataset.ph=T.phase; box.classList.toggle('run',T.running);
  el.textContent=mmss(left); $('#pmPhase').textContent=PM_PHASE[T.phase]+(!T.running&&T.left!=null?' · paused':'');
  const fr=Math.min(1,Math.max(0,1-left/len)), arc=$('#pmArc'); arc.style.strokeDasharray=(RING2*fr).toFixed(1)+' '+RING2.toFixed(1); arc.style.opacity=fr>0?1:0;
  $('#pmGo').innerHTML=T.running?ico('pause',14)+'<span>Pause</span>':ico('play',14)+'<span>'+(T.left!=null?'Resume':T.phase==='focus'?'Start focus':'Start break')+'</span>';
  const done=T.count%P2.every; $('#pmDots').innerHTML=Array.from({length:P2.every},(_,i)=>'<i class="'+(i<done?'on':'')+'"></i>').join('')+'<span>'+(done?done+' of '+P2.every+' before a long break':P2.every+' focus sessions, then a long break')+'</span>';
  const lg=$('.pm-log span'); if(lg) lg.textContent='Past sessions ('+mySs().length+')';
  const today=mySs().filter(x=>keyOf(new Date(x.start))===todayKey());
  $('#pmNow').innerHTML=T.cur?'This session: <b>'+fmt(T.cur.words)+'</b> new word'+(T.cur.words===1?'':'s')+(P2.goal?' of '+fmt(P2.goal):'')
    :(today.length?'Today: '+today.length+' session'+(today.length===1?'':'s')+', '+fmt(today.reduce((a,x)=>a+x.words,0))+' new words.':'Write in focused bursts. Each session and its word count is saved.');
}
function pomoHtml(){
  const P2=S.meta.pomo, n=mySs().length, num2=(k,l,mn,mx)=>'<label class="f">'+l+'<input type="number" inputmode="numeric" min="'+mn+'" max="'+mx+'" data-pms="'+k+'" value="'+P2[k]+'"></label>';
  return '<section class="psec pomo" id="pomo" data-ph="focus"><h3><span>Focus timer</span><span class="pm-tools"><button class="ibtn" data-pm="log" title="Past sessions" aria-label="Past sessions">'+ico('list',15)+'</button><button class="ibtn" data-pm="set" aria-expanded="'+!!ui.pmSet+'" title="Timer settings" aria-label="Timer settings">'+ico('sliders',15)+'</button></span></h3>'
    +'<div class="pm-face"><svg viewBox="0 0 120 120" class="pm-ring" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="52"/><circle class="arc" id="pmArc" cx="60" cy="60" r="52" transform="rotate(-90 60 60)"/></svg><div class="pm-txt" role="timer" aria-live="off"><b class="mono" id="pmTime"></b><span id="pmPhase"></span></div></div>'
    +'<div class="pm-dots" id="pmDots"></div>'
    +'<div class="pm-btns"><button class="btn pri" id="pmGo" data-pm="go"></button><button class="btn" data-pm="stop" title="Stop and save this session">'+ico('stop',14)+'<span>Stop</span></button><button class="btn" data-pm="skip" title="Skip to the next part">'+ico('skip',14)+'<span>Skip</span></button></div>'
    +'<p class="fine" id="pmNow"></p>'
    +(ui.pmSet?'<div class="pm-set"><div class="two">'+num2('focus','Focus (minutes)',1,180)+num2('short','Short break',1,60)+num2('long','Long break',1,120)+num2('every','Long break after',1,12)+'</div>'
      +num2('goal','Words to aim for each session (0 for none)',0,20000)
      +[['autoBreak','Start breaks automatically'],['autoFocus','Start the next focus session after a break'],['sound','Play a chime']].map(o=>'<label class="ck"><input type="checkbox" data-pms="'+o[0]+'"'+(P2[o[0]]?' checked':'')+'>'+o[1]+'</label>').join('')
      +'<p class="fine">Changes apply from the next session. "Long break after" counts focus sessions.</p></div>':'')
    +'<button class="btn sm pm-log" data-pm="log">'+ico('list',14)+'<span>Past sessions ('+n+')</span></button></section>';
}
function bindPomo(){
  const box=$('#pomo'); if(!box) return;
  box.addEventListener('click',e=>{ const b=e.target.closest('[data-pm]'); if(!b||b.tagName==='INPUT') return; const a=b.dataset.pm;
    if(a==='go'){ if(T.running) pmPause(); else pmStart(); }
    else if(a==='stop') pmStop(); else if(a==='skip') pmSkip();
    else if(a==='set'){ ui.pmSet=!ui.pmSet; renderInspector(); }
    else if(a==='log') go({k:'ss'}); });
  box.addEventListener('change',e=>{ const x=e.target, k=x.dataset.pms; if(!k) return; const P2=S.meta.pomo;
    if(x.type==='checkbox') P2[k]=x.checked; else { S.meta.pomo=normPomo(Object.assign({},P2,{[k]:x.value})); x.value=S.meta.pomo[k]; }
    dirty('meta'); pmPaint(); });
}
/* ---------- writing report after a full focus cycle ---------- */
// Each focus session records its cycle (cyc: the sessions up to a long break). When the last focus session before
// the long break ends, a report shows words per minute for each session and on average, against your usual pace.
const wpmOf=x=>x.mins>0?x.words/x.mins:0, wpmFmt=v=>(Math.round(v*10)/10).toLocaleString();
function pmReport(cyc){
  const all=mySs(), list=all.filter(x=>x.cyc===cyc).sort((a,b)=>a.start-b.start); if(!list.length) return;
  const words=list.reduce((a,x)=>a+x.words,0), mins=list.reduce((a,x)=>a+x.mins,0), avg=mins?words/mins:0;
  const before=all.filter(x=>x.cyc!==cyc&&x.start<list[0].start&&x.mins>=1), bm=before.reduce((a,x)=>a+x.mins,0), usual=bm?before.reduce((a,x)=>a+x.words,0)/bm:0;
  const best=list.reduce((b,x)=>wpmOf(x)>wpmOf(b)?x:b,list[0]), top=Math.max(1,...list.map(wpmOf));
  const pace=arr=>{ const m=arr.reduce((a,x)=>a+x.mins,0); return m?arr.reduce((a,x)=>a+x.words,0)/m:0; }, h1=pace(list.slice(0,Math.floor(list.length/2))), h2=pace(list.slice(Math.ceil(list.length/2)));
  const trend=list.length<2||!h1||!h2?'':h2>h1*1.15?'You sped up as you went.':h2<h1*.85?'You started fast and eased off.':'A steady pace all the way through.';
  const pct=usual?Math.round((avg/usual-1)*100):0;
  const cmp=before.length<3||!usual?'Your first report for this project. Next time you will see how it compares.'
    :pct>=5?pct+'% faster than your usual '+wpmFmt(usual)+' words a minute.':pct<=-5?'A little under your usual '+wpmFmt(usual)+' words a minute. Thinking and revising count too.':'Right on your usual pace of '+wpmFmt(usual)+' words a minute.';
  const left=Math.max(0,S.meta.target-totalWords()), hrs=avg>0?left/avg/60:0;
  const scenes=[...new Set(list.flatMap(x=>x.scenes))].filter(id=>S.meta.scenes[id]);
  const hm=t=>{ const d=new Date(t); return pad(d.getHours())+':'+pad(d.getMinutes()); };
  const nm=S.meta.pet.name, say2=!words?'Some sessions are for thinking. That counts.':pct>=5&&usual?'Look at you go! '+nm+' can barely keep up.':avg>=20?nm+' is impressed. That is a lot of ink.':'Steady words, steady progress. '+nm+' approves.';
  const ov=document.createElement('div'); ov.className='pj-ov ask-ov';
  ov.innerHTML='<div class="pj-dlg rp" role="dialog" aria-modal="true" aria-labelledby="rpH"><div class="rp-top"><span class="rp-pet">'+petSVG(words?'party':'happy',petStage())+'</span><div><h2 id="rpH">Writing report</h2>'
    +'<p class="muted">'+list.length+' focus session'+(list.length===1?'':'s')+' · '+wpmFmt(mins)+' minutes focused · '+hm(list[0].start)+'–'+hm(list[list.length-1].end)+'</p></div></div>'
    +'<div class="rp-big"><div><b class="mono" id="rpWpm">'+wpmFmt(avg)+'</b><span>words a minute on average</span></div><div><b class="mono">'+fmt(words)+'</b><span>new words</span></div></div>'
    +'<div class="rp-bars">'+list.map((x,i)=>'<div class="rp-row'+(x===best&&list.length>1?' best':'')+'"><span>Session '+(i+1)+'</span><div class="bar"><i style="width:'+(wpmOf(x)/top*100).toFixed(1)+'%"></i></div><b class="mono">'+wpmFmt(wpmOf(x))+'</b><small>'+fmt(x.words)+' words · '+wpmFmt(x.mins)+' min</small></div>').join('')+'</div>'
    +'<ul class="rp-notes">'+(list.length>1?'<li>Best: session '+(list.indexOf(best)+1)+', '+wpmFmt(wpmOf(best))+' words a minute.</li>':'')+(trend?'<li>'+trend+'</li>':'')+'<li>'+esc(cmp)+'</li>'
    +(avg>0&&left?'<li>At this pace, the rest of your '+fmt(S.meta.target)+'-word goal is about '+(hrs<1?Math.max(1,Math.round(hrs*60))+' minutes':wpmFmt(hrs)+' hours')+' of focus.</li>':'')
    +(scenes.length?'<li>Worked on: '+scenes.slice(0,5).map(id=>'“'+esc(S.meta.scenes[id].title)+'”').join(', ')+(scenes.length>5?' and more':'')+'.</li>':'')+'</ul>'
    +'<p class="rp-say">'+esc(say2)+'</p><div class="ask-btns"><button class="btn" data-v="ss">All sessions</button><button class="btn pri" data-v="ok">'+(T.phase==='long'?'Enjoy the break':'Close')+'</button></div></div>';
  const done=v=>{ ov.remove(); document.removeEventListener('keydown',k,true); if(v==='ss') go({k:'ss'}); };
  const k=e=>{ if(e.key==='Escape'){ e.stopPropagation(); e.preventDefault(); done(''); } };
  ov.addEventListener('click',e=>{ const b=e.target.closest('[data-v]'); if(b) done(b.dataset.v); else if(e.target===ov) done(''); });
  document.addEventListener('keydown',k,true); document.body.appendChild(ov); $('[data-v="ok"]',ov).focus();
}
// Writing sessions belong to the writer who recorded them (shared projects keep everyone's in one place).
const mySs=()=>Object.keys(S.ss).map(id=>Object.assign({id},S.ss[id])).filter(x=>x._by?nameKey(x._by)===myKey():(!myKey()||!x._dev||x._dev===DEVICE));
function renderSs(el){
  const list=mySs().sort((a,b)=>b.start-a.start), cf=ui.confirm;
  const tot=list.reduce((a,x)=>({mins:a.mins+x.mins,words:a.words+x.words}),{mins:0,words:0}), best=list.reduce((b,x)=>!b||x.words>b.words?x:b,null);
  const dur=m=>m>=60?Math.floor(m/60)+' h '+Math.round(m%60)+' min':(Math.round(m*10)/10)+' min';
  const hm=t=>{ const d=new Date(t); return pad(d.getHours())+':'+pad(d.getMinutes()); };
  const dayName=t=>new Date(t).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const days=[]; list.forEach(x=>{ const k=keyOf(new Date(x.start)); let d=days[days.length-1]; if(!d||d.k!==k){ d={k,items:[]}; days.push(d); } d.items.push(x); });
  const tile=(v,l)=>'<div class="ss-tile"><b class="mono">'+v+'</b><span>'+l+'</span></div>', lastOf={}, nOf={};
  list.slice().reverse().forEach(x=>{ if(x.cyc){ lastOf[x.cyc]=x.id; nOf[x.cyc]=(nOf[x.cyc]||0)+1; } }); Object.keys(nOf).forEach(c=>{ if(nOf[c]<2) delete lastOf[c]; });
  el.innerHTML='<div class="main-head">'+backBtn()+'<span class="kind">'+ico('timer',16)+'</span><h1 class="mh-title">Writing sessions</h1>'
    +(list.length?'<button class="btn danger" data-ss="all">'+ico('trash')+'<span>'+(cf==='ssall'?'Click again to delete every session':'Delete all')+'</span></button>':'')+'</div>'
    +'<div class="ss-wrap"><p class="muted ss-sub">Focus timer sessions for <b>'+esc(S.meta.title)+'</b>. New words are counted the same way as your daily goal: pasted blocks over 600 words are left out.</p>'
    +'<section class="wc-box" id="wcBox"></section>'
    +(list.length?'<div class="ss-tiles">'+tile(list.length,'sessions')+tile(dur(tot.mins),'focused')+tile(fmt(tot.words),'new words')+tile(fmt(tot.words/list.length),'words per session')
      +tile(tot.mins?(Math.round(tot.words/tot.mins*10)/10):0,'words per minute')+tile(best?fmt(best.words):0,'best session')+'</div>'
      +days.map(d=>{ const w=d.items.reduce((a,x)=>a+x.words,0), m=d.items.reduce((a,x)=>a+x.mins,0);
        return '<section class="ss-day"><header><h2>'+esc(dayName(d.items[0].start))+'</h2><span class="muted">'+d.items.length+' session'+(d.items.length===1?'':'s')+' · '+dur(m)+' · '+fmt(w)+' new words</span>'
          +'<button class="btn sm'+(cf==='ssd'+d.k?' danger':'')+'" data-ss="day" data-id="'+d.k+'">'+(cf==='ssd'+d.k?'Delete this day?':'Delete day')+'</button></header>'
          +d.items.map(x=>'<div class="ss-row"><span class="mono ss-time">'+hm(x.start)+'–'+hm(x.end)+'</span>'
            +'<span class="ss-badge '+(x.done?'ok':'early')+'">'+(x.done?'Completed':'Stopped early')+'</span>'
            +'<span class="ss-dur">'+dur(x.mins)+(x.planned?' <span class="muted">of '+x.planned+'</span>':'')+'</span>'
            +'<b class="ss-w">'+fmt(x.words)+' <span>new words</span></b>'
            +'<span class="muted ss-net">'+(x.net>=0?'+':'')+fmt(x.net)+' net · '+(x.mins?Math.round(x.words/x.mins*10)/10:0)+'/min</span>'
            +'<span class="ss-sc">'+x.scenes.filter(id=>S.meta.scenes[id]).map(id=>'<button class="tc-sc" data-ss="open" data-id="'+id+'">'+ico('pen',12)+'<span>'+esc(S.meta.scenes[id].title)+'</span></button>').join('')+'</span>'
            +(x.cyc&&lastOf[x.cyc]===x.id?'<button class="btn sm" data-ss="rep" data-id="'+x.cyc+'" title="Words per minute for this run of sessions">Report</button>':'')
            +'<button class="ibtn'+(cf==='ss'+x.id?' on':'')+'" data-ss="del" data-id="'+x.id+'" aria-label="Delete this session">'+(cf==='ss'+x.id?'Delete?':ico('trash',14))+'</button></div>').join('')+'</section>'; }).join('')
      :'<div class="ss-empty"><b>No sessions yet</b><p class="muted">Start the focus timer next to '+esc(S.meta.pet.name)+' and write. Each focus session is saved here with its word count.</p><button class="btn pri" data-ss="timer">'+ico('play',14)+'<span>Start a focus session</span></button></div>')+'</div>';
  drawWcBox($('#wcBox',el));
  const gone=ids=>{ ids.forEach(id=>{ delete S.ss[id]; forget('ss_'+id); }); dirty('meta'); renderSs(el); renderInspector(); };
  el.onclick=ev=>{ const b=ev.target.closest('[data-ss]'); if(!b) return; const a=b.dataset.ss, id=b.dataset.id, rr=()=>renderSs(el);
    if(a==='open') go({k:'scene',id});
    else if(a==='rep') pmReport(id);
    else if(a==='timer'){ pmStart(); ui.tab='pet'; syncTab(); }
    else if(a==='del') confirmDo('ss'+id,()=>gone([id]),rr);
    else if(a==='day') confirmDo('ssd'+id,()=>gone(mySs().filter(x=>keyOf(new Date(x.start))===id).map(x=>x.id)),rr);
    else if(a==='all') confirmDo('ssall',()=>{ gone(mySs().map(x=>x.id)); toast('All sessions for this project deleted.',{plain:true}); },rr); };
}

/* ---------- word-count history ---------- */
// New words per day (meta.days) as one series of bars, with the daily goal as a reference line.
function wcSeries(range){
  const out=[], now=new Date(), days=S.meta.days; now.setHours(12,0,0,0);
  if(range==='year'){
    const mon=new Date(now); mon.setDate(mon.getDate()-((mon.getDay()+6)%7));
    for(let w=51;w>=0;w--){ const st=new Date(mon); st.setDate(mon.getDate()-w*7); let v=0;
      for(let i=0;i<7;i++){ const x=new Date(st); x.setDate(st.getDate()+i); v+=days[keyOf(x)]||0; } out.push({d:st,v}); }
  } else { const n=range==='90'?90:30; for(let i=n-1;i>=0;i--){ const x=new Date(now); x.setDate(now.getDate()-i); out.push({d:x,v:days[keyOf(x)]||0}); } }
  return out;
}
function niceMax(v){ if(v<=0) return 100; const e=Math.pow(10,Math.floor(Math.log10(v))), f=v/e; return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e; }
function drawWcBox(box){
  if(!box) return; const range=['30','90','year'].includes(ui.wcRange)?ui.wcRange:'30', wk=range==='year', goal=S.meta.goal, data=wcSeries(range);
  const tot=data.reduce((a,x)=>a+x.v,0), act=data.filter(x=>x.v>0), best=data.reduce((b,x)=>x.v>b.v?x:b,{v:0});
  let streak=0; { const d=new Date(); if(!S.meta.days[keyOf(d)]) d.setDate(d.getDate()-1); while(S.meta.days[keyOf(d)]>0){ streak++; d.setDate(d.getDate()-1); } }
  const fd=(d,o)=>d.toLocaleDateString(undefined,o||{month:'short',day:'numeric'}), tile=(v,l)=>'<div class="ss-tile"><b class="mono">'+v+'</b><span>'+l+'</span></div>';
  box.innerHTML='<div class="wc-head"><h2>New words '+(wk?'per week':'per day')+'</h2><div class="seg">'+[['30','30 days'],['90','90 days'],['year','12 months']].map(r=>'<button data-wr="'+r[0]+'"'+(range===r[0]?' class="on"':'')+'>'+r[1]+'</button>').join('')+'</div>'
    +'<button class="btn sm" data-wr="table" aria-pressed="'+(!!ui.wcTable)+'">'+(ui.wcTable?'Show chart':'Show table')+'</button></div>'
    +'<div class="ss-tiles">'+tile(fmt(tot),'new words')+tile(fmt(act.length?tot/act.length:0),wk?'per writing week':'per writing day')
    +tile(best.v?fmt(best.v):'–','best '+(wk?'week':'day')+(best.v?' · '+fd(best.d):''))+tile(streak,'day streak')+(wk?'':tile(data.filter(x=>x.v>=goal).length,'days at goal'))+'</div>'
    +(ui.wcTable?'<div class="wc-table"><table><thead><tr><th>'+(wk?'Week of':'Day')+'</th><th>New words</th></tr></thead><tbody>'
        +(act.length?act.slice().reverse().map(x=>'<tr><td>'+fd(x.d,{weekday:wk?undefined:'short',month:'short',day:'numeric',year:'numeric'})+'</td><td class="mono">'+fmt(x.v)+'</td></tr>').join(''):'<tr><td colspan="2" class="muted">No words written in this time yet.</td></tr>')+'</tbody></table></div>'
      :'<div class="wc-plot"><svg id="wcSvg" role="img" aria-label="'+esc('Bar chart of new words '+(wk?'per week':'per day')+': '+fmt(tot)+' in total, best '+fmt(best.v))+'"></svg><div class="wc-tip" id="wcTip" hidden></div></div>');
  box.onclick=e=>{ const b=e.target.closest('[data-wr]'); if(!b) return; if(b.dataset.wr==='table') ui.wcTable=!ui.wcTable; else ui.wcRange=b.dataset.wr; drawWcBox(box); };
  const svg=$('#wcSvg',box); if(!svg) return;
  const plot=()=>{
    const W=Math.max(260,svg.parentNode.clientWidth), H=210, L=46, R=wk?10:58, T=12, B=26, pw=W-L-R, ph=H-T-B, n=data.length;
    const max=niceMax(Math.max(...data.map(x=>x.v),wk?0:goal)*1.05), y=v=>T+ph-v/max*ph, slot=pw/n, bw=Math.max(1.5,slot-2), r=Math.min(4,bw/2);
    let h='';
    for(let i=0;i<=4;i++){ const v=max*i/4, yy=Math.round(y(v))+.5; h+='<line class="wc-grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'"/><text class="wc-ax" x="'+(L-8)+'" y="'+(yy+4)+'" text-anchor="end">'+(v>=1000?(Math.round(v/100)/10)+'k':Math.round(v))+'</text>'; }
    data.forEach((x,i)=>{ if(!x.v) return; const x0=L+i*slot+(slot-bw)/2, y0=y(x.v), b=T+ph, rr=Math.min(r,b-y0);
      h+='<path class="wc-bar" data-i="'+i+'" d="M'+x0+' '+b+'V'+(y0+rr)+'Q'+x0+' '+y0+' '+(x0+rr)+' '+y0+'H'+(x0+bw-rr)+'Q'+(x0+bw)+' '+y0+' '+(x0+bw)+' '+(y0+rr)+'V'+b+'Z"/>'; });
    if(!wk&&goal){ const gy=Math.round(y(goal))+.5; h+='<line class="wc-goal" x1="'+L+'" x2="'+(W-R)+'" y1="'+gy+'" y2="'+gy+'"/><text class="wc-ax" x="'+(W-R+6)+'" y="'+(gy+4)+'">goal '+fmt(goal)+'</text>'; }
    const every=Math.max(1,Math.ceil(70/slot)); let last=-1;
    data.forEach((x,i)=>{ const isEnd=i===n-1; if(i%every&&!isEnd) return; if(isEnd&&last>=0&&(i-last)*slot<70) return; last=i;
      h+='<text class="wc-ax" x="'+(L+i*slot+slot/2)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(isEnd&&!wk?'Today':fd(x.d))+'</text>'; });
    h+='<line class="wc-base" x1="'+L+'" x2="'+(W-R)+'" y1="'+(T+ph+.5)+'" y2="'+(T+ph+.5)+'"/><rect class="wc-hit" x="'+L+'" y="'+T+'" width="'+pw+'" height="'+ph+'"/>';
    svg.setAttribute('viewBox','0 0 '+W+' '+H); svg.setAttribute('width',W); svg.setAttribute('height',H); svg.innerHTML=h;
    const tip=$('#wcTip',box), hit=$('.wc-hit',svg);
    const show=e=>{ const bx=svg.getBoundingClientRect(), i=Math.max(0,Math.min(n-1,Math.floor((e.clientX-bx.left-L)/slot))), x=data[i];
      svg.querySelectorAll('.wc-bar.on').forEach(b=>b.classList.remove('on')); const bar=svg.querySelector('.wc-bar[data-i="'+i+'"]'); if(bar) bar.classList.add('on');
      let cross=svg.querySelector('.wc-cross'); if(!cross){ cross=document.createElementNS('http://www.w3.org/2000/svg','line'); cross.setAttribute('class','wc-cross'); svg.insertBefore(cross,svg.firstChild); }
      const cx=L+i*slot+slot/2; cross.setAttribute('x1',cx); cross.setAttribute('x2',cx); cross.setAttribute('y1',T); cross.setAttribute('y2',T+ph);
      tip.innerHTML='<span>'+esc(wk?'Week of '+fd(x.d):fd(x.d,{weekday:'short',month:'short',day:'numeric'}))+'</span><b class="mono">'+fmt(x.v)+'</b> new words'+(!wk&&x.v>=goal&&x.v?' · goal met':'');
      tip.hidden=false; const tw=tip.offsetWidth; tip.style.left=Math.max(0,Math.min(W-tw,cx-tw/2))+'px'; tip.style.top=Math.max(0,(bar?y(x.v):T+ph)-44)+'px'; };
    const hide=()=>{ tip.hidden=true; svg.querySelectorAll('.wc-bar.on').forEach(b=>b.classList.remove('on')); const c=svg.querySelector('.wc-cross'); if(c) c.remove(); };
    hit.addEventListener('pointermove',show); hit.addEventListener('pointerdown',show); hit.addEventListener('pointerleave',hide);
  };
  plot();
  if(window.ResizeObserver){ let w=svg.parentNode.clientWidth; const ro=new ResizeObserver(()=>{ if(!svg.isConnected){ ro.disconnect(); return; } const nw=svg.parentNode.clientWidth; if(Math.abs(nw-w)>4){ w=nw; plot(); } }); ro.observe(svg.parentNode); }
}

