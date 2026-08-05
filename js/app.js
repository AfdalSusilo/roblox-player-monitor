/* Simulasi Banjir — Dashboard v5 (Supabase + SQLite fallback + Feedback) */
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const SB='https://qbxvttgzxlfjockyrxne.supabase.co/rest/v1';
const SK='eyJhbG...5HW0';
const API='https://laser-cakes-pennsylvania-pike.trycloudflare.com';
const H={apikey:SK,Aut...arer '+SK};

let SB_ONLINE=true;
async function F(endpoint,fallback){
  if(SB_ONLINE){try{const r=await fetch(SB+endpoint,{headers:H, signal:AbortSignal.timeout(5000)});if(r.ok)return await r.json();}catch(e){SB_ONLINE=false;console.warn('Supabase down, switching to SQLite');}}
  try{const r=await fetch(API+fallback);if(r.ok){const d=await r.json();return d.data||d;}}catch(e){console.warn('All backends down');}
  return [];
}


// Data cache
let _cache={data:null,ts:0};
const CACHE_TTL=10000; // 10 seconds
const S={tab:'behavior',raw:{behavior:[],gui:[],npc:[],feedback:[]},fil:[],ap:[],sp:'',dl:'',et:'',sr:'',p:1,rpp:50,sc:null,sd:'asc',ri:15,rt:null,ls:0,backend:'Supabase'};
const M={behavior:{fk:'behavior_code'},gui:{fk:'ui_element'},npc:{fk:'npc_name'},feedback:{fk:'frame'},overview:{fk:null}};

async function init(){tick();setInterval(tick,1e3);await load();disc();fsetup();tsetup();ssetup();esetup();rsetup();ltimer();seqTimerSetup();sw('behavior')}
function tick(){const n=new Date();if($('#currentDate'))$('#currentDate').textContent=n.toLocaleDateString('id-ID',{weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});if($('#footerUpdate'))$('#footerUpdate').textContent=S.backend+' · '+n.toLocaleTimeString('id-ID');}

async function load(){
  const now=Date.now();
  if(_cache.data&&(now-_cache.ts)<CACHE_TTL){
    const d=_cache.data;
    S.raw.behavior=d.b;S.raw.npc=d.n;S.raw.gui=d.g;S.raw.feedback=d.f;
    S.backend=d.backend;
    console.log('Cache hit','b:'+d.b.length,'n:'+d.n.length,'g:'+d.g.length,'f:'+d.f.length);
    return;
  }
  try{const[b,n,g]=await Promise.all([
  F('/behavior_logs?select=id,player_id,player_name,behavior_sequence,position_history,created_at&order=created_at.desc&limit=500','/api/behaviors?limit=500'),
  F('/npc_interactions?select=id,player_id,player_name,npc_name,message,created_at&order=created_at.desc&limit=500','/api/npc-chats?limit=500'),
  F('/gui_logs?select=id,player_id,player_name,ui_element,input_data,created_at&order=created_at.desc&limit=1000','/api/gui-logs?limit=1000')
]);S.raw.behavior=b||[];S.raw.npc=n||[];S.raw.gui=g||[];S.raw.feedback=(g||[]).map(r=>{let fd={};try{fd=JSON.parse(r.input_data||'{}')}catch(e){}return{id:r.id,player_id:r.player_id,player_name:r.player_name,created_at:r.created_at,frame:fd.frame||'',feedback_type:fd.feedback_type||r.ui_element||'',player_answer:fd.player_answer||fd.answer||fd.jawaban||'',feedback_message:fd.feedback_message||'',is_correct:fd.is_correct||false,attempt_count:fd.attempt_count||0,question_num:fd.question||fd.questionNum||0};});S.backend=SB_ONLINE?'Supabase':'SQLite';console.log(S.backend,'b:'+S.raw.behavior.length,'n:'+S.raw.npc.length,'g:'+S.raw.gui.length,'f:'+S.raw.feedback.length);_cache={data:{b:S.raw.behavior,n:S.raw.npc,g:S.raw.gui,f:S.raw.feedback,backend:S.backend},ts:Date.now()};}catch(e){console.error('Load:',e);}}
function disc(){const m=new Map();for(const t of['behavior','gui','npc','feedback'])for(const r of S.raw[t]){const id=r.player_id||'?';if(!m.has(id))m.set(id,{id,name:r.player_name||'?',ts:r.created_at||r.timestamp||''});const p=m.get(id);const ts=r.created_at||r.timestamp||'';if(ts>p.ts)p.ts=ts;}S.ap=[...m.values()].sort((a,b)=>b.ts.localeCompare(a.ts));}

function fsetup(){const s=$('#playerFilter');s.innerHTML='<option value="">Semua Player</option>'+S.ap.map(p=>'<option value="'+escA(p.name)+'">'+escH(p.name)+'</option>').join('');s.addEventListener('change',()=>{S.sp=s.value;});$('#dateLive').addEventListener('change',()=>{S.dl=$('#dateLive').value;});const d=latestDate();$('#dateLive').value=d;S.dl=d;$('#applyFiltersBtn').addEventListener('click',()=>{S.sp=$('#playerFilter').value;S.dl=$('#dateLive').value;S.p=1;apply();});$('#resetFiltersBtn').addEventListener('click',()=>{$('#playerFilter').value='';S.sp='';S.dl=latestDate();$('#dateLive').value=S.dl;S.et='';S.sr='';$('#searchInput').value='';S.p=1;apply();});}
function latestDate(){let d='';for(const t of['behavior','gui','npc','feedback'])for(const r of S.raw[t]){const ts=r.created_at||r.timestamp||'';if(ts>d)d=ts;}return d.slice(0,10);}
function tsetup(){$$('.tab').forEach(b=>b.addEventListener('click',()=>sw(b.dataset.tab)));}
function sw(t){S.tab=t;S.p=1;S.et='';$$('.tab').forEach(b=>b.classList.remove('active'));const btn=document.querySelector('.tab[data-tab="'+t+'"]');if(btn)btn.classList.add('active');$$('.tab-view').forEach(v=>v.classList.remove('active'));const dv=document.getElementById('view-'+t);if(dv)dv.classList.add('active');updET();apply();}
function ssetup(){$('#searchInput').addEventListener('input',deb(e=>{S.sr=e.target.value.toLowerCase();S.p=1;apply();},250));}
$('#filterType').addEventListener('change',e=>{S.et=e.target.value;S.p=1;apply();});
function updET(){if(S.tab==='overview'||S.tab==='npc'||S.tab==='sequence')return;const d=grd();const s=$('#filterType');s.innerHTML='<option value="">Semua</option>';const k=M[S.tab]?.fk;if(!k)return;[...new Set(d.map(r=>Array.isArray(r[k])?r[k][0]:r[k]).filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=String(v).slice(0,40);s.appendChild(o);});}
function rsetup(){$('#refreshInterval').addEventListener('change',e=>{S.ri=parseInt(e.target.value);clearInterval(S.rt);if(S.ri>0)S.rt=setInterval(ref,S.ri*1e3);});if(S.ri>0)S.rt=setInterval(ref,S.ri*1e3);}
async function ref(){await load();disc();S.dl=latestDate();if($('#dateLive'))$('#dateLive').value=S.dl;apply();rnote();}
function rnote(){const n=new Date();['refreshNote','refreshNoteGui','refreshNoteFeedback'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=S.backend+' · '+n.toLocaleTimeString('id-ID');});}
function ltimer(){setInterval(()=>{S.ls++;const m=Math.floor(S.ls/60),s=S.ls%60;if($('#liveTimer'))$('#liveTimer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');},1e3);}

function grd(){if(S.tab==='overview'||S.tab==='npc'||S.tab==='sequence')return[];return S.raw[S.tab]||[];}
function apply(){if(S.tab==='overview'){S.fil=[];rall();return;}if(S.tab==='npc'){rall();return;}if(S.tab==='sequence'){rall();return;}if(S.tab==='feedback'){rall();return;}let d=[...grd()];if(S.sp)d=d.filter(r=>r.player_name===S.sp);if(S.dl)d=d.filter(r=>{const ts=r.created_at||r.timestamp||'';return ts.slice(0,10)===S.dl;});if(S.et){const k=M[S.tab]?.fk;if(k)d=d.filter(r=>{const v=r[k];return Array.isArray(v)?v[0]===S.et:v===S.et;});}if(S.sr)d=d.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(S.sr)));S.fil=d;rall();}
function sb(c){if(S.sc===c)S.sd=S.sd==='asc'?'desc':'asc';else{S.sc=c;S.sd='asc';}apply();}
function gp(p){S.p=p;apply();}

function rall(){ustats();ubadge();rnote();if(S.tab==='overview')rov();else if(S.tab==='npc')rnpc();else if(S.tab==='sequence')rseq();else rtab();dmap();}
function ustats(){$('#statChats').textContent=(S.raw.npc||[]).length;$('#statMoves').textContent=(S.raw.behavior||[]).length;$('#statGui').textContent=(S.raw.gui||[]).length;$('#statFeedback').textContent=(S.raw.feedback||[]).length;$('#statPlayers').textContent=S.ap.length;}
function ubadge(){if($('#playerCountBadge'))$('#playerCountBadge').textContent=S.ap.length+' Pemain · '+S.backend;}

// ── TABLE ──
function rtab(){
  const m={
    behavior:{tid:'dataTable',hid:'tableHead',bid:'tableBody',rid:'rowsShown',pid:'pagination'},
    gui:{tid:'dataTableGui',hid:'tableHeadGui',bid:'tableBodyGui',rid:'rowsShownGui',pid:'paginationGui'},
    feedback:{tid:'dataTableFeedback',hid:'tableHeadFeedback',bid:'tableBodyFeedback',rid:'rowsShownFeedback',pid:'paginationFeedback'}
  }[S.tab];
  if(!m)return;
  // For feedback tab, use raw data directly
  let f;
  if(S.tab==='feedback'){
    f=[...S.raw.feedback||[]];
    if(S.sp)f=f.filter(r=>r.player_name===S.sp);
    if(S.dl)f=f.filter(r=>{const ts=r.created_at||r.timestamp||'';return ts.slice(0,10)===S.dl;});
    if(S.sr)f=f.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(S.sr)));
  }else{
    f=S.fil;
  }
  const st=(S.p-1)*S.rpp,en=Math.min(st+S.rpp,f.length),pd=f.slice(st,en);
  if(!f.length){document.getElementById(m.hid).innerHTML='';document.getElementById(m.bid).innerHTML='<tr><td colspan="99" class="empty-state">📭 Tidak ada data</td></tr>';document.getElementById(m.rid).textContent='Menampilkan 0 dari 0';document.getElementById(m.pid).innerHTML='';return;}
  const cols=(S.tab==='behavior'?['created_at','player_name','position_history','behavior_sequence','section']:(S.tab==='gui'?['created_at','player_name','ui_element','input_data']:(S.tab==='feedback'?['created_at','player_name','frame','feedback_type','player_answer','feedback_message','is_correct','attempt_count']:Object.keys(f[0]).filter(c=>c!=='id'&&!c.startsWith('_')))));
  document.getElementById(m.hid).innerHTML='<tr>'+cols.map(c=>'<th onclick="sb(\''+c+'\')">'+fhdr(c)+'<span class="sort-arrow">'+(S.sc===c?(S.sd==='asc'?'▲':'▼'):'')+'</span></th>').join('')+'</tr>';
  document.getElementById(m.bid).innerHTML=pd.map(r=>'<tr>'+cols.map(c=>'<td title="'+escA(String(r[c]??''))+'">'+fcell(c,r[c],r)+'</td>').join('')+'</tr>').join('');
  document.getElementById(m.rid).textContent='Menampilkan '+(st+1)+'–'+en+' dari '+f.length.toLocaleString();
  const tp=Math.ceil(f.length/S.rpp),pe=document.getElementById(m.pid);if(tp<=1)pe.innerHTML='';else{let h='<button class="page-btn"'+(S.p<=1?' disabled':'')+' onclick="gp('+(S.p-1)+')">‹</button>';for(let i=1;i<=tp;i++)h+='<button class="page-btn'+(i===S.p?' active':'')+'" onclick="gp('+i+')">'+i+'</button>';h+='<button class="page-btn"'+(S.p>=tp?' disabled':'')+' onclick="gp('+(S.p+1)+')">›</button>';pe.innerHTML=h;}
}

// ── NPC CHAT ──
function rnpc(){let c=[...S.raw.npc].reverse();if(S.sp)c=c.filter(r=>r.player_name===S.sp);if(S.dl)c=c.filter(r=>{const ts=r.created_at||r.timestamp||'';return ts.slice(0,10)===S.dl;});if(S.sr)c=c.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(S.sr)));const box=$('#chatLogBox');if(!box)return;if(!c.length){box.innerHTML='<div class="empty-state">💬 Belum ada percakapan</div>';return;}const st=(S.p-1)*S.rpp,en=Math.min(st+S.rpp,c.length);
box.innerHTML=c.slice(st,en).map(r=>{
  const ts=r.created_at||r.timestamp||'';const t=ts?new Date(ts).toLocaleTimeString('id-ID'):'';
  const msg=r.message||'';const isAI=msg.startsWith('[assistant]');const isUser=msg.startsWith('[user]');
  const clean=isAI?msg.replace('[assistant] ','').replace('[assistant]',''):isUser?msg.replace('[user] ','').replace('[user]',''):msg;
  const npc=r.npc_name||'NPC';const role=r.role||(isAI?'assistant':'user');
  const cls=role==='assistant'?'npc':'player';
  const sender=role==='assistant'?'🤖 '+escH(npc):'👤 '+escH(r.player_name||'Player');
  return'<div class="chat-bubble '+cls+'"><div class="sender">'+sender+'</div><div>'+escH(clean)+'</div><div class="time">'+t+'</div></div>';
}).join('');
box.scrollTop=box.scrollHeight;
if($('#rowsShownNpc'))$('#rowsShownNpc').textContent='Menampilkan '+(st+1)+'–'+en+' dari '+c.length.toLocaleString();}

// ── OVERVIEW ──
function rov(){const pl={};const seq={};for(const r of[...S.raw.behavior]){const n=r.player_name||'?';if(!pl[n])pl[n]={name:n,chats:0,moves:0,guis:0,seqs:[]};pl[n].moves++;const code=Array.isArray(r.behavior_sequence)?r.behavior_sequence[0]:r.behavior_code||'';if(code){if(!seq[n])seq[n]=[];seq[n].push({code,ts:r.created_at||r.timestamp||''});}}for(const r of[...S.raw.npc,...S.raw.gui]){const n=r.player_name||'?';if(!pl[n])pl[n]={name:n,chats:0,moves:0,guis:0,seqs:[]};if(r.npc_name)pl[n].chats++;else pl[n].guis++;}const ps=Object.values(pl).sort((a,b)=>(b.chats+b.moves+b.guis)-(a.chats+a.moves+a.guis));if($('#playerListPanel'))$('#playerListPanel').innerHTML=ps.length?ps.slice(0,15).map(p=>{const sq=(seq[p.name]||[]).sort((a,b)=>a.ts.localeCompare(b.ts)).map(s=>s.code).join('→');return'<div class="player-item" onclick="fbp(\''+escA(p.name)+'\')"><span class="player-name">👤 '+escH(p.name)+'</span><span class="player-count-badge-sm">'+(p.chats+p.moves+p.guis)+'</span><div style="font-size:0.6rem;color:var(--text2);margin-top:2px">'+escH(sq||'—')+'</div></div>';}).join(''):'<div class="empty-state" style="padding:20px">Belum ada pemain</div>';const nc={};for(const r of S.raw.npc){if(r.npc_name)nc[r.npc_name]=(nc[r.npc_name]||0)+1;}const ns=Object.entries(nc).sort((a,b)=>b[1]-a[1]);if($('#npcListPanel'))$('#npcListPanel').innerHTML=ns.length?ns.slice(0,15).map(([n,c])=>'<div class="npc-item"><span>🤖 '+escH(n)+'</span><span class="npc-count-badge">'+c+' chat</span></div>').join(''):'<div class="empty-state" style="padding:20px">Belum ada interaksi</div>';dchart();}
function dchart(){const cv=$('#activityChart');if(!cv)return;const ctx=cv.getContext('2d'),w=cv.parentElement.clientWidth-28;cv.width=w;cv.height=250;ctx.clearRect(0,0,cv.width,cv.height);const bk={};for(const r of[...S.raw.behavior,...S.raw.npc,...S.raw.gui,...S.raw.feedback]){const ts=r.created_at||r.timestamp||'';if(!ts)continue;const t=ts.slice(0,16);if(!bk[t])bk[t]={b:0,n:0,g:0,f:0};if(r.position_history||r.x!=null)bk[t].b++;else if(r.npc_name)bk[t].n++;else if(r.hint_type)bk[t].f++;else bk[t].g++;}const ks=Object.keys(bk).sort();if(ks.length<2){ctx.fillStyle='#8b8fa3';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('📈 Butuh data',cv.width/2,cv.height/2);return;}const pad=40,pw=cv.width-pad*2,ph=cv.height-pad*2,mx=Math.max(1,...ks.map(k=>bk[k].b+bk[k].n+bk[k].g+bk[k].f));ctx.strokeStyle='#2e3242';ctx.lineWidth=0.5;for(let i=0;i<=4;i++){const y=pad+ph*(1-i/4);ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(cv.width-pad,y);ctx.stroke();}const bw=Math.max(2,Math.min(12,pw/ks.length-2));ks.forEach((k,i)=>{const x=pad+i*(pw/ks.length)+bw/2,b=bk[k];ctx.fillStyle='#5865f2';ctx.fillRect(x,pad+ph-(b.b/mx)*ph,bw,(b.b/mx)*ph);ctx.fillStyle='#f59e0b';ctx.fillRect(x,pad+ph-((b.b+b.n)/mx)*ph,bw,(b.n/mx)*ph);ctx.fillStyle='#06b6d4';ctx.fillRect(x,pad+ph-((b.b+b.n+b.g)/mx)*ph,bw,(b.g/mx)*ph);ctx.fillStyle='#a855f7';ctx.fillRect(x,pad+ph-((b.b+b.n+b.g+b.f)/mx)*ph,bw,(b.f/mx)*ph);});ks.forEach((k,i)=>{if(i%Math.ceil(ks.length/8)===0||i===ks.length-1){ctx.fillStyle='#8b8fa3';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText(k.slice(11,16),pad+i*(pw/ks.length)+bw/2,cv.height-8);}});ctx.fillStyle='#5865f2';ctx.fillRect(pad+10,10,10,10);ctx.fillStyle='#e1e4ed';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('Behavior',pad+24,20);ctx.fillStyle='#f59e0b';ctx.fillRect(pad+100,10,10,10);ctx.fillText('NPC',pad+114,20);ctx.fillStyle='#06b6d4';ctx.fillRect(pad+170,10,10,10);ctx.fillText('GUI',pad+184,20);ctx.fillStyle='#a855f7';ctx.fillRect(pad+240,10,10,10);ctx.fillText('Feedback',pad+254,20);}

// ── BEHAVIOR SEQUENCE TAB ──
function buildPlayerSeq(){
  const pl={};
  for(const r of[...S.raw.behavior]){
    const n=r.player_name||'?';const pid=r.player_id||'?';
    if(!pl[n])pl[n]={player_id:pid,player_name:n,total_actions:0,sequence:[],timestamps:[],sections:[],lastTs:''};
    const code=Array.isArray(r.behavior_sequence)?r.behavior_sequence[0]:(Array.isArray(r.behavior_code)?r.behavior_code[0]:r.behavior_code||'');
    const ts=r.created_at||r.timestamp||'';
    let sec=r.section||'';
    if(!sec&&Array.isArray(r.position_history)&&r.position_history.length)sec=r.position_history[r.position_history.length-1].section||'';
    if(code){pl[n].sequence.push(code);pl[n].timestamps.push(ts);pl[n].sections.push(sec);pl[n].total_actions++;if(ts>pl[n].lastTs)pl[n].lastTs=ts;}
  }
  return Object.values(pl).sort((a,b)=>b.total_actions-a.total_actions);
}
function rseq(){
  const container=$('#sequenceContainer');if(!container)return;
  let list=buildPlayerSeq();
  if(S.sp)list=list.filter(p=>p.player_name===S.sp);
  if(S.dl)list=list.filter(p=>p.lastTs.slice(0,10)===S.dl);
  if($('#seqCount'))$('#seqCount').textContent=list.length+' pemain dengan behavior sequence';
  if(!list.length){container.innerHTML='<div class="empty-state">🔀 Belum ada data behavior sequence</div>';return;}
  container.innerHTML=list.map(p=>{
    const seq=[...p.sequence].reverse();
    const deduped=[];
    let prev='',count=0;
    for(const code of seq){
      if(code===prev){count++;}
      else{if(prev)deduped.push({code:prev,count});prev=code;count=1;}
    }
    if(prev)deduped.push({code:prev,count});
    
    const steps=deduped.map(item=>{
      const cls='code-'+String(item.code).charAt(0);
      const label=item.count>1?String(item.code)+'×'+item.count:String(item.code);
      return'<span class="seq-step '+cls+'">'+escH(label)+'</span>';
    }).join('<span class="seq-arrow">→</span>');
    
    const sections=[...new Set(p.sections.filter(Boolean))];
    const lastTime=p.lastTs?new Date(p.lastTs).toLocaleTimeString('id-ID'):'—';
    
    const codeCounts={};
    for(const c of seq)codeCounts[c]=(codeCounts[c]||0)+1;
    const summary=Object.entries(codeCounts).sort((a,b)=>b[1]-a[1]).map(([c,n])=>c+':'+n).join(' ');
    
    return'<div class="seq-card">'+
      '<div class="seq-header">'+
        '<div class="seq-header-left"><span class="seq-player">👤 '+escH(p.player_name)+'</span>'+
        '<span class="seq-count">'+p.total_actions+' aksi</span></div>'+
        '<span class="seq-string" title="Summary">'+escH(summary)+'</span>'+
      '</div>'+
      '<div class="seq-bar">'+steps+'</div>'+
      '<div class="seq-meta">'+
        '<span>📍 '+escH(sections.join(', ')||'—')+'</span>'+
        '<span>🕐 '+lastTime+'</span>'+
      '</div>'+
    '</div>';
  }).join('');
}
function seqTimerSetup(){
  let countdown=60;
  setInterval(()=>{
    countdown--;
    if($('#seqTimerBadge'))$('#seqTimerBadge').textContent='⟳ '+countdown+'s';
    if(countdown<=0){
      countdown=60;
      if(S.tab==='sequence'){
        load().then(()=>{disc();rseq();});
        if($('#seqLastUpdate'))$('#seqLastUpdate').textContent='Diperbarui: '+new Date().toLocaleTimeString('id-ID');
      }
    }
  },1e3);
}

// ── MINIMAP REMOVED ──
function dmap(){return;}
function rpl(){const c=$('#playerList');if(!c)return;c.innerHTML=S.ap.length?S.ap.slice(0,20).map(p=>{const ch=S.raw.npc.filter(r=>r.player_name===p.name||r.player_name===p.id).length,mv=S.raw.behavior.filter(r=>r.player_name===p.name||r.player_name===p.id).length,gu=S.raw.gui.filter(r=>r.player_name===p.name).length,fb=S.raw.feedback.filter(r=>r.player_name===p.name).length;return'<div class="player-item" onclick="fbp(\''+escA(p.name)+'\')"><span class="player-name">👤 '+escH(p.name)+'</span><span class="player-count-badge-sm">'+(ch+mv+gu+fb)+'</span></div>';}).join(''):'<div class="empty-state" style="padding:15px">Belum ada pemain</div>';}
function fbp(n){const s=$('#playerFilter');if(s){s.value=n;S.sp=n;}S.p=1;apply();}

function esetup(){$('#exportCSV')?.addEventListener('click',exCSV);$('#exportJSON')?.addEventListener('click',exJSON);$('#exportSeqCSV')?.addEventListener('click',exSeqCSV);$('#exportSeqJSON')?.addEventListener('click',exSeqJSON);$('#exportSeqCSV2')?.addEventListener('click',exSeqCSV);$('#exportSeqJSON2')?.addEventListener('click',exSeqJSON);$('#exportSeqDOCX')?.addEventListener('click',exSeqDOCX);$('#exportSeqDOCX2')?.addEventListener('click',exSeqDOCX);$('#rowsPerPage')?.addEventListener('change',e=>{S.rpp=parseInt(e.target.value);S.p=1;apply();});}
function exCSV(){
  let data,cols;
  if(S.tab==='npc'){
    data=S.raw.npc||[];cols=['created_at','player_name','npc_name','message'];
  }else if(S.tab==='behavior'){
    data=S.raw.behavior||[];cols=['created_at','player_name','position_history','behavior_code','behavior_sequence','section'];
  }else if(S.tab==='feedback'){
    data=S.raw.feedback||[];cols=['created_at','player_name','frame','feedback_type','player_answer','feedback_message','is_correct','attempt_count','question_num'];
  }else{
    data=S.raw.gui||[];cols=['created_at','player_name','ui_element','input_data'];
  }
  if(!data.length){alert('Tidak ada data untuk diexport!');return;}
  const csv=cols.map(fhdr).join(',')+'\n'+data.map(r=>cols.map(c=>{
    let v=r[c];
    if(c==='position_history'&&Array.isArray(v)&&v.length){
      const p=v[v.length-1];
      return'"('+Math.round(p.x||0)+', '+Math.round(p.y||0)+(p.z!=null?', '+Math.round(p.z):'')+')"';
    }
    if(c==='behavior_sequence'&&Array.isArray(v))return'"'+v.join('→')+'"';
    if(c==='behavior_code'&&Array.isArray(v))return'"'+(v[0]||'')+'"';
    if(c==='created_at')try{v=new Date(v).toLocaleString('id-ID');}catch(e){}
    if(typeof v==='object')v=JSON.stringify(v);
    return'"'+String(v||'').replace(/"/g,'""')+'"';
  }).join(',')).join('\n');
  dl('export_'+S.tab+'_'+new Date().toISOString().slice(0,10)+'.csv',csv,'text/csv;charset=utf-8');
}
function exJSON(){
  let data;
  if(S.tab==='npc')data=S.raw.npc||[];
  else if(S.tab==='behavior')data=S.raw.behavior||[];
  else if(S.tab==='feedback')data=S.raw.feedback||[];
  else data=S.raw.gui||[];
  if(!data.length){alert('Tidak ada data!');return;}
  dl('export_'+S.tab+'_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json');
}
function dl(n,c,t){const b=new Blob([c],{type:t}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=n;a.click();URL.revokeObjectURL(u);}

// ── EXPORT BEHAVIOR SEQUENCE (Visual Format) ──
function getFilteredSeqData(){
  let list=buildPlayerSeq();
  if(S.sp)list=list.filter(p=>p.player_name===S.sp);
  if(S.dl)list=list.filter(p=>p.lastTs.slice(0,10)===S.dl);
  console.log('[Export] Data:',list.length,'players');
  list.forEach(p=>{
    const counts={};
    for(const c of p.sequence)counts[c]=(counts[c]||0)+1;
    console.log(`[Export] ${p.player_name}: ${p.total_actions} aksi →`,counts);
  });
  return list;
}
function dedupSequence(seq){
  const rev=[...seq].reverse();
  const result=[];let prev='',count=0;
  for(const code of rev){
    if(code===prev){count++;}
    else{if(prev)result.push({code,count});prev=code;count=1;}
  }
  if(prev)result.push({code:prev,count});
  return result;
}
function seqToString(deduped){
  return deduped.map(item=>item.count>1?item.code+'×'+item.count:item.code).join(' → ');
}
function seqToSummary(seq){
  const counts={};
  for(const c of seq)counts[c]=(counts[c]||0)+1;
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([c,n])=>c+':'+n).join(', ');
}
function exSeqCSV(){
  const data=getFilteredSeqData();
  if(!data.length){alert('Tidak ada data behavior untuk diexport!');return;}
  const cols=['Player Name','Total Aksi','Urutan Behavior (Lama→Baru)','Ringkasan','Section','Aktivitas Terakhir'];
  const csv=cols.map(c=>'"'+c+'"').join(',')+'\n'+
    data.map(r=>{
      const deduped=dedupSequence(r.sequence);
      const seqStr=seqToString(deduped);
      const summary=seqToSummary(r.sequence);
      const sections=[...new Set(r.sections.filter(Boolean))].join(', ');
      const lastTs=r.lastTs||'';
      return[
        '"'+String(r.player_name).replace(/"/g,'""')+'"',
        r.total_actions,
        '"'+seqStr+'"',
        '"'+summary+'"',
        '"'+sections+'"',
        '"'+lastTs+'"'
      ].join(',');
    }).join('\n');
  dl('behavior_sequence_'+new Date().toISOString().slice(0,10)+'.csv',csv,'text/csv;charset=utf-8');
}
function exSeqJSON(){
  const data=getFilteredSeqData();
  if(!data.length){alert('Tidak ada data behavior!');return;}
  const out=data.map(r=>{
    const deduped=dedupSequence(r.sequence);
    return{
      player_id:r.player_id,player_name:r.player_name,
      total_actions:r.total_actions,
      urutan_visual:seqToString(deduped),
      ringkasan:seqToSummary(r.sequence),
      behavior_sequence_full:r.sequence,
      sections:[...new Set(r.sections.filter(Boolean))],
      detail:r.sequence.map((code,i)=>({code,timestamp:r.timestamps[i],section:r.sections[i]}))
    };
  });
  dl('behavior_sequence_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(out,null,2),'application/json');
}
function exSeqDOCX(){
  const data=getFilteredSeqData();
  if(!data.length){alert('Tidak ada data behavior untuk diexport!');return;}
  
  const today=new Date().toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  
  let html=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8">
<style>
body{font-family:Calibri,sans-serif;font-size:11pt;color:#222}
h1{font-size:16pt;text-align:center;color:#1a1a2e;margin-bottom:4px}
h2{font-size:12pt;color:#5865f2;margin:18px 0 8px;border-bottom:2px solid #5865f2;padding-bottom:4px}
.subtitle{text-align:center;color:#666;font-size:10pt;margin-bottom:18px}
table{border-collapse:collapse;width:100%;margin:8px 0 16px}
th{background:#5865f2;color:#fff;padding:8px 10px;text-align:left;font-size:10pt;border:1px solid #4752c4}
td{padding:6px 10px;border:1px solid #ddd;font-size:10pt;vertical-align:top}
tr:nth-child(even){background:#f8f9fa}
.seq-badge{display:inline-block;padding:1px 6px;border-radius:4px;font-weight:bold;font-size:9pt;margin:1px}
.code-E{background:#d4edda;color:#155724}.code-R{background:#cce5ff;color:#004085}
.code-A{background:#fff3cd;color:#856404}.code-C{background:#d4edda;color:#155724}
.code-I{background:#f8d7da;color:#721c24}.code-F{background:#e2d5f1;color:#5b2c8b}
.code-Q{background:#d1ecf1;color:#0c5460}.code-S{background:#e2e3e5;color:#383d41}
.summary{font-size:9pt;color:#666}
.footer{text-align:center;color:#999;font-size:9pt;margin-top:24px;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<h1>📊 Behavior Sequence Report</h1>
<p class="subtitle">Simulasi Banjir — Desa Sukamaju<br>${today}</p>

<h2>📋 Ringkasan Per Pemain</h2>
<table>
<tr><th>No</th><th>Player</th><th>Total Aksi</th><th>Urutan Behavior</th><th>Ringkasan</th><th>Section</th></tr>`;

  data.forEach((r,i)=>{
    const deduped=dedupSequence(r.sequence);
    const seqHTML=deduped.map(item=>{
      const cls='code-'+item.code.charAt(0);
      const label=item.count>1?item.code+'×'+item.count:item.code;
      return'<span class="seq-badge '+cls+'">'+label+'</span>';
    }).join(' → ');
    
    const summary=seqToSummary(r.sequence);
    const sections=[...new Set(r.sections.filter(Boolean))].join(', ')||'—';
    
    html+='<tr><td>'+(i+1)+'</td><td><b>'+r.player_name+'</b></td><td>'+r.total_actions+
      '</td><td>'+seqHTML+'</td><td class="summary">'+summary+'</td><td>'+sections+'</td></tr>';
  });

  html+=`</table>

<h2>📖 Kode Behavior (Wang et al., 2025)</h2>
<table>
<tr><th>Code</th><th>Nama</th><th>Deskripsi</th></tr>
<tr><td><span class="seq-badge code-E">E</span></td><td>Explore</td><td>Pemain menjelajahi lingkungan Desa Sukamaju</td></tr>
<tr><td><span class="seq-badge code-R">R</span></td><td>Read</td><td>Pemain membaca/membuka modul CPS</td></tr>
<tr><td><span class="seq-badge code-A">A</span></td><td>Answer</td><td>Pemain mengirim jawaban pada tahap CPS</td></tr>
<tr><td><span class="seq-badge code-C">C</span></td><td>Correct</td><td>Jawaban valid — keyword ditemukan</td></tr>
<tr><td><span class="seq-badge code-I">I</span></td><td>Incorrect</td><td>Jawaban tidak valid — keyword tidak ditemukan</td></tr>
<tr><td><span class="seq-badge code-F">F</span></td><td>Feedback</td><td>Sistem menampilkan hints/feedback</td></tr>
<tr><td><span class="seq-badge code-Q">Q</span></td><td>Query</td><td>Pemain bertanya ke NPC</td></tr>
<tr><td><span class="seq-badge code-S">S</span></td><td>Skip</td><td>Pemain melewati tahap CPS</td></tr>
</table>

<p class="footer">Generated by Simulasi Banjir — Player Monitor Dashboard<br>Data: Supabase + SQLite | ${data.length} pemain</p>
</body></html>`;

  dl('behavior_sequence_'+new Date().toISOString().slice(0,10)+'.doc',html,'application/msword');
}

function fhdr(c){if(c==='posisi')return'Posisi';return c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());}
function fcell(c,v,r){
  if(v==null)return'—';
  if(c==='created_at'||c==='timestamp')try{return new Date(v).toLocaleString('id-ID');}catch(e){return String(v);}
  if(c==='posisi'){
    if(Array.isArray(v)&&v.length){const p=v[v.length-1];return'('+Math.round(p.x)+', '+Math.round(p.y)+(p.z!=null?', '+Math.round(p.z):'')+')';}
    return'—';
  }
  if(c==='position_history'&&Array.isArray(v)&&v.length){const p=v[v.length-1];return'('+Math.round(p.x)+', '+Math.round(p.y)+(p.z!=null?', '+Math.round(p.z):'')+')';}
  if(c==='behavior_code'){
    const code=Array.isArray(v)?v[0]:v;
    return'<span class="badge-code code-'+escA(String(code||'').charAt(0))+'">'+escH(String(code||'—'))+'</span>';
  }
  if(c==='behavior_sequence'){
    if(Array.isArray(v)&&v.length){
      return v.map(code=>'<span class="badge-code code-'+escA(String(code).charAt(0))+'">'+escH(String(code))+'</span>').join('<span style="opacity:.4;font-size:.6rem">→</span>');
    }
    const code=v||'—';
    return'<span class="badge-code code-'+escA(String(code).charAt(0))+'">'+escH(String(code))+'</span>';
  }
  if(c==='section'){
    let sec=v||'';
    if(!sec){const ph=r['position_history'];if(Array.isArray(ph)&&ph.length)sec=ph[ph.length-1].section||'';}
    if(sec)return'<span class="badge-section">'+escH(String(sec))+'</span>';
    return'<span style="opacity:.4">—</span>';
  }
  if(c==='hint_type'){
    const colors={prompt:'#f59e0b',hint:'#f59e0b',guidance:'#f59e0b',brainstorm:'#f59e0b',correct:'#22c55e',achievement:'#06b6d4'};
    const color=colors[v]||'#8b8fa3';
    return'<span style="color:'+color+';font-weight:bold">'+escH(String(v||'—'))+'</span>';
  }
  if(c==='hint_message'){
    return'<span style="font-size:0.85rem;opacity:0.8">'+escH(String(v||'').slice(0,80))+'</span>';
  }
  if(c==='input_data'&&typeof v==='string'){try{const j=JSON.parse(v);return j.value||j.section||v.slice(0,50);}catch(e){return v.slice(0,60);}}
  if(Array.isArray(v))return v[0]||'';
  if(typeof v==='object')return JSON.stringify(v).slice(0,50);
  return String(v).slice(0,100);
}

function deb(fn,ms){let t;return function(...args){clearTimeout(t);t=setTimeout(()=>fn.apply(this,args),ms);};}
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escA(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
init();
