/* ---------- world: calendars and money ---------- */
// meta.world.cals: invented calendars {id,name,months[[name,days]],week (comma list),era,first (number of the first year)};
// meta.world.coins: currencies {id,name,units[[name,per]],note}: units from largest to smallest, per = how many of the
// next unit make one of this. View {k:'world'} (renderWorld). A calendar can set a timeline's scale (TL presets).
function normWorld(w){
  w=w&&typeof w==='object'?w:{}; const ok=x=>x&&typeof x==='object'&&/^[\w-]{1,40}$/.test(x.id);
  return {cals:(Array.isArray(w.cals)?w.cals:[]).filter(ok).slice(0,20).map(c=>({id:c.id,name:String(c.name||'Calendar').slice(0,80),
      months:(Array.isArray(c.months)?c.months:[]).slice(0,40).map(x=>[String((x||[])[0]||'Month').slice(0,40),Math.max(1,Math.min(999,Math.round(+(x||[])[1]||30)))]),
      week:String(c.week||'').slice(0,400),era:String(c.era||'').slice(0,20),first:Math.round(+c.first||1)})),
    coins:(Array.isArray(w.coins)?w.coins:[]).filter(ok).slice(0,20).map(c=>({id:c.id,name:String(c.name||'Currency').slice(0,80),
      units:(Array.isArray(c.units)?c.units:[]).slice(0,12).map(x=>[String((x||[])[0]||'Coin').slice(0,40),Math.max(1,Math.min(1e6,Math.round(+(x||[])[1]||1)))]),note:String(c.note||'').slice(0,2000)}))};
}
const calYear=c=>c.months.reduce((a,x)=>a+x[1],0)||1;
const calWeek=c=>c.week.split(',').map(x=>x.trim()).filter(Boolean);
// Day 1 is the first day of the first year. Returns {y,mi,d,wd}.
function calDate(c,n){
  n=Math.round(n); const Y=calYear(c), yi=Math.floor((n-1)/Y); let r=n-1-yi*Y, mi=0;
  while(mi<c.months.length&&r>=c.months[mi][1]){ r-=c.months[mi][1]; mi++; }
  const wk=calWeek(c); return {y:c.first+yi,mi,d:r+1,wd:wk.length?wk[((n-1)%wk.length+wk.length)%wk.length]:''};
}
function calDay(c,y,mi,d){ let n=(y-c.first)*calYear(c); for(let i=0;i<mi;i++) n+=c.months[i][1]; return n+d; }
const calFmt=(c,o)=>(o.wd?o.wd+', ':'')+o.d+' '+(c.months[o.mi]||['?'])[0]+', year '+o.y+(c.era?' '+c.era:'');
function coinBreak(c,total){   // an amount in the smallest unit → "2 Crowns, 3 Shillings"
  const vals=coinVals(c), out=[]; let r=Math.round(total);
  c.units.forEach((u,i)=>{ const q=Math.floor(r/vals[i]); if(q){ out.push(q+' '+u[0]); r-=q*vals[i]; } });
  return out.join(', ')||'0 '+(c.units[c.units.length-1]||['coins'])[0];
}
const coinOut=(c,tot)=>'= '+fmt(tot)+' '+(c.units[c.units.length-1]||[''])[0]+(c.units.length>1?' · '+coinBreak(c,tot):'');
function coinVals(c){ const v=new Array(c.units.length).fill(1); for(let i=c.units.length-2;i>=0;i--) v[i]=v[i+1]*c.units[i][1]; return v; }
function worldDefCal(){ return {id:uid('cal'),name:'New calendar',months:[['First Month',30],['Second Month',30],['Third Month',30],['Fourth Month',30],['Fifth Month',30],['Sixth Month',30],['Seventh Month',30],['Eighth Month',30],['Ninth Month',30],['Tenth Month',30],['Eleventh Month',30],['Twelfth Month',35]],week:'Moonday, Tidesday, Ashday, Hearthday, Starday, Restday',era:'',first:1}; }
function worldDefCoin(){ return {id:uid('cn'),name:'New currency',units:[['Crown',20],['Shilling',12],['Penny',1]],note:''}; }
function renderWorld(el){
  const W=S.meta.world, f=ui.wf||(ui.wf={});
  const cal=c=>{ const Y=calYear(c), k=f[c.id]||(f[c.id]={n:1,a:'',b:''}), o=calDate(c,k.n||1);
    return '<section class="pf w-cal" data-cal="'+c.id+'"><div class="th-row"><input class="w-name" data-w="name" value="'+esc(c.name)+'" maxlength="80" aria-label="Calendar name"><button class="ibtn" data-w="delcal" aria-label="Delete calendar" title="Delete calendar">'+ico('trash',14)+'</button></div>'
      +'<p class="fine">'+c.months.length+' months, '+Y+' days a year'+(calWeek(c).length?', a '+calWeek(c).length+'-day week':'')+'.</p>'
      +'<div class="w-months">'+c.months.map((x,i)=>'<div class="w-m"><input data-w="mname" data-i="'+i+'" value="'+esc(x[0])+'" maxlength="40" aria-label="Month '+(i+1)+' name"><input type="number" min="1" max="999" data-w="mdays" data-i="'+i+'" value="'+x[1]+'" aria-label="Days in month '+(i+1)+'"><button class="ibtn" data-w="delm" data-i="'+i+'" aria-label="Remove month" title="Remove month">'+ico('x',12)+'</button></div>').join('')
      +'<button class="btn sm" data-w="addm">'+ico('plus',13)+'<span>Month</span></button></div>'
      +'<div class="two"><label class="f">Days of the week (separate with commas)<input data-w="week" value="'+esc(c.week)+'" maxlength="400" placeholder="Moonday, Tidesday, …"></label>'
      +'<div class="two"><label class="f">Era<input data-w="era" value="'+esc(c.era)+'" maxlength="20" placeholder="AR"></label><label class="f">First year<input type="number" data-w="first" value="'+c.first+'"></label></div></div>'
      +'<div class="w-tool"><label class="f">Day number<input type="number" data-w="n" value="'+(k.n||1)+'"></label><span class="w-out" data-w-out="n">'+esc(calFmt(c,o))+'</span></div>'
      +'<p class="fine">Day 1 is the first day of year '+c.first+(c.era?' '+esc(c.era):'')+'. Use it to work out dates, ages and how long journeys take.</p></section>'; };
  const coin=c=>{ const k=f[c.id]||(f[c.id]={q:1,u:0}), vals=coinVals(c), tot=(k.q||0)*(vals[k.u]||1);
    return '<section class="pf w-coin" data-coin="'+c.id+'"><div class="th-row"><input class="w-name" data-w="name" value="'+esc(c.name)+'" maxlength="80" aria-label="Currency name"><button class="ibtn" data-w="delcoin" aria-label="Delete currency" title="Delete currency">'+ico('trash',14)+'</button></div>'
      +'<div class="w-units">'+c.units.map((u,i)=>'<div class="w-u"><span>1</span><input data-w="uname" data-i="'+i+'" value="'+esc(u[0])+'" maxlength="40" aria-label="Unit name">'+(i<c.units.length-1?'<span>=</span><input type="number" min="1" data-w="uper" data-i="'+i+'" value="'+u[1]+'" aria-label="How many '+esc(c.units[i+1][0])+'"><span class="muted">'+esc(c.units[i+1][0])+'</span>':'<span class="muted">smallest coin</span>')+'<button class="ibtn" data-w="delu" data-i="'+i+'" aria-label="Remove unit" title="Remove unit">'+ico('x',12)+'</button></div>').join('')
      +'<button class="btn sm" data-w="addu">'+ico('plus',13)+'<span>Smaller unit</span></button></div>'
      +'<div class="w-tool"><label class="f">Amount<input type="number" min="0" data-w="q" value="'+(k.q??1)+'"></label><label class="f">of<select data-w="u">'+c.units.map((u,i)=>'<option value="'+i+'"'+(k.u===i?' selected':'')+'>'+esc(u[0])+'</option>').join('')+'</select></label>'
      +'<span class="w-out" data-w-out="q">'+esc(coinOut(c,tot))+'</span></div>'
      +'<label class="f">What things cost<textarea data-w="note" rows="2" placeholder="A loaf of bread: 2 pennies. A horse: 4 crowns.">'+esc(c.note)+'</textarea></label></section>'; };
  el.innerHTML='<div class="main-head">'+backBtn()+'<span class="kind">'+ico('cal',16)+'</span><h1 class="mh-title">Calendars &amp; money</h1></div><div class="pf-wrap">'
    +'<section class="pf"><h2>Your world</h2><p class="fine">Invent calendars and currencies for your world. Rules of magic and technology, and invented words, have their own story pages: turn on <b>'+esc(LP('rule'))+'</b> and <b>'+esc(LP('term'))+'</b> in the binder (Customize binder). Glossary words are linked in your scenes like names, with their pronunciation when you point at them.</p>'
    +'<div class="w-add"><button class="btn" data-w="addcal">'+ico('plus',14)+'<span>Calendar</span></button><button class="btn" data-w="addcoin">'+ico('plus',14)+'<span>Currency</span></button>'
    +(secOn('rule')&&secOn('term')?'':'<button class="btn" data-w="secs">Show '+esc(LP('rule'))+' and '+esc(LP('term'))+' in the binder</button>')+'</div></section>'
    +(W.cals.length?'<h3 class="w-h">Calendars</h3>'+W.cals.map(cal).join(''):'')+(W.coins.length?'<h3 class="w-h">Money</h3>'+W.coins.map(coin).join(''):'')+'</div>';
  const find=t=>{ const c=t.closest('[data-cal]'), m=t.closest('[data-coin]'); return c?{x:W.cals.find(q=>q.id===c.dataset.cal),cal:1}:m?{x:W.coins.find(q=>q.id===m.dataset.coin)}:{}; };
  const save=()=>dirty('meta');
  el.onclick=e=>{ const b=e.target.closest('button[data-w]'); if(!b) return; const k=b.dataset.w, {x}=find(b), i=+b.dataset.i;
    if(k==='addcal'){ W.cals.push(worldDefCal()); save(); renderWorld(el); }
    else if(k==='addcoin'){ W.coins.push(worldDefCoin()); save(); renderWorld(el); }
    else if(k==='secs'){ S.meta.secs.rule=S.meta.secs.term=true; ui.openSec.rule=ui.openSec.term=true; save(); renderBinder(); renderWorld(el); }
    else if(k==='addm'&&x){ x.months.push(['Month '+(x.months.length+1),30]); save(); renderWorld(el); }
    else if(k==='delm'&&x&&x.months.length>1){ x.months.splice(i,1); save(); renderWorld(el); }
    else if(k==='addu'&&x){ x.units.push(['Unit',1]); if(x.units.length>1) x.units[x.units.length-2][1]=Math.max(1,x.units[x.units.length-2][1]); save(); renderWorld(el); }
    else if(k==='delu'&&x&&x.units.length>1){ x.units.splice(i,1); save(); renderWorld(el); }
    else if(k==='delcal'||k==='delcoin'){ ask('Delete “'+x.name+'”?','It will be gone for good.',[['yes','Delete','danger'],['no','Cancel']]).then(r=>{ if(r!=='yes') return; const L=k==='delcal'?W.cals:W.coins; L.splice(L.indexOf(x),1); save(); renderWorld(el); }); }
  };
  const upd=(t,live)=>{ const k=t.dataset.w, {x,cal}=find(t); if(!x||!k) return; const i=+t.dataset.i, v=t.value, st=f[x.id]||(f[x.id]={});
    if(k==='name') x.name=v.slice(0,80)||(cal?'Calendar':'Currency');
    else if(k==='mname') x.months[i][0]=v.slice(0,40)||'Month';
    else if(k==='mdays'){ if(live) return; x.months[i][1]=Math.max(1,Math.min(999,Math.round(+v||1))); }
    else if(k==='week') x.week=v.slice(0,400);
    else if(k==='era') x.era=v.slice(0,20);
    else if(k==='first'){ if(live) return; x.first=Math.round(+v||1); }
    else if(k==='uname') x.units[i][0]=v.slice(0,40)||'Coin';
    else if(k==='uper'){ if(live) return; x.units[i][1]=Math.max(1,Math.min(1e6,Math.round(+v||1))); }
    else if(k==='note') x.note=v.slice(0,2000);
    else if(k==='n'){ st.n=Math.round(+v||1); const o=$('[data-w-out="n"]',t.closest('section')); if(o) o.textContent=calFmt(x,calDate(x,st.n)); return; }
    else if(k==='q'||k==='u'){ if(live&&k==='u') return; st[k]=k==='u'?+v:Math.max(0,+v||0); const o=$('[data-w-out="q"]',t.closest('section')); if(o) o.textContent=coinOut(x,(st.q??1)*(coinVals(x)[st.u||0]||1)); return; }
    save(); if(!live) renderWorld(el); };
  el.oninput=e=>upd(e.target,true);
  el.onchange=e=>upd(e.target,false);
}
