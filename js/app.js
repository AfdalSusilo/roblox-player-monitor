/* Simulasi Banjir — Dashboard v4 (Supabase + SQLite fallback) */
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const SB='https://qbxvttgzxlfjockyrxne.supabase.co/rest/v1';
const SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFieHZ0dGd6eGxmam9ja3lyeG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjczNzAsImV4cCI6MjA5ODEwMzM3MH0.GiQcsITIxZbCaDn6746Wds-0Cf5IbwH7_xFDtWe5HW0';
const API='https://laser-cakes-pennsylvania-pike.trycloudflare.com';
const H={apikey:SK,Authorization:'Bearer '+SK};

let SB_ONLINE=true;
async function F(endpoint,fallback){
  if(SB_ONLINE){try{const r=await fetch(SB+endpoint,{headers:H, signal:AbortSignal.timeout(5000)});if(r.ok)return await r.json();}catch(e){SB_ONLINE=false;console.warn('Supabase down, switching to SQLite');}}
  try{const r=await fetch(API+fallback);if(r.ok){const d=await r.json();return d.data||d;}}catch(e){console.warn('All backends down');}
  return [];
}

const S={tab:'behavior',raw:{behavior:[],gui:[],npc:[]},fil:[],ap:[],sp:'',dl:'',et:'',sr:'',p:1,rpp:50,sc:null,sd:'asc',ri:15,rt:null,ls:0,backend:'Supabase'};
const M={behavior:{fk:'behavior_code'},gui:{fk:'ui_element'},npc:{fk:'npc_name'},overview:{fk:null}};

async function init(){tick();setInterval(tick,1e3);await load();disc();fsetup();tsetup();ssetup();esetup();rsetup();ltimer();seqTimerSetup();sw('behavior')}
function tick(){const n=new Date();if($('#currentDate'))$('#currentDate').textContent=n.toLocaleDateString('id-ID',{weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});if($('#footerUpdate'))$('#footerUpdate').textContent=S.backend+' · '+n.toLocaleTimeString('id-ID');}

async function load(){try{const[b,n,g]=await Promise.all([F('/behavior_logs?select=*&order=created_at.desc&limit=5000','/api/behaviors?limit=5000'),F('/npc_interactions?select=*&order=created_at.desc&limit=2000','/api/npc-chats?limit=2000'),F('/gui_logs?select=*&order=created_at.desc&limit=2000','/api/gui-logs?limit=2000')]);S.raw.behavior=b||[];S.raw.npc=n||[];S.raw.gui=g||[];S.backend=SB_ONLINE?'Supabase':'SQLite';console.log(S.backend,S.raw.behavior.length,S.raw.npc.length,S.raw.gui.length);}catch(e){}}
function disc(){const m=new Map();for(const t of['behavior','gui','npc'])for(const r of S.raw[t]){const id=r.player_id||'?';if(!m.has(id))m.set(id,{id,name:r.player_name||'?',ts:r.created_at||r.timestamp||''});const p=m.get(id);const ts=r.created_at||r.timestamp||'';if(ts>p.ts)p.ts=ts;}S.ap=[...m.values()].sort((a,b)=>b.ts.localeCompare(a.ts));}

function fsetup(){const s=$('#playerFilter');s.innerHTML='<option value="">Semua Player</option>'+S.ap.map(p=>'<option value="'+escA(p.name)+'">'+escH(p.name)+'</option>').join('');s.addEventListener('change',()=>{S.sp=s.value;});$('#dateLive').addEventListener('change',()=>{S.dl=$('#dateLive').value;});const d=latestDate();$('#dateLive').value=d;S.dl=d;$('#applyFiltersBtn').addEventListener('click',()=>{S.sp=$('#playerFilter').value;S.dl=$('#dateLive').value;S.p=1;apply();});$('#resetFiltersBtn').addEventListener('click',()=>{$('#playerFilter').value='';S.sp='';S.dl=latestDate();$('#dateLive').value=S.dl;S.et='';S.sr='';$('#searchInput').value='';S.p=1;apply();});}
function latestDate(){let d='';for(const t of['behavior','gui','npc'])for(const r of S.raw[t]){const ts=r.created_at||r.timestamp||'';if(ts>d)d=ts;}return d.slice(0,10);}
function tsetup(){$$('.tab').forEach(b=>b.addEventListener('click',()=>sw(b.dataset.tab)));}
function sw(t){S.tab=t;S.p=1;S.et='';$$('.tab').forEach(b=>b.classList.remove('active'));const btn=document.querySelector('.tab[data-tab="'+t+'"]');if(btn)btn.classList.add('active');$$('.tab-view').forEach(v=>v.classList.remove('active'));const dv=document.getElementById('view-'+t);if(dv)dv.classList.add('active');updET();apply();}
function ssetup(){$('#searchInput').addEventListener('input',deb(e=>{S.sr=e.target.value.toLowerCase();S.p=1;apply();},250));}
$('#filterType').addEventListener('change',e=>{S.et=e.target.value;S.p=1;apply();});
function updET(){if(S.tab==='overview'||S.tab==='npc'||S.tab==='sequence')return;const d=grd();const s=$('#filterType');s.innerHTML='<option value="">Semua</option>';const k=M[S.tab]?.fk;if(!k)return;[...new Set(d.map(r=>Array.isArray(r[k])?r[k][0]:r[k]).filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=String(v).slice(0,40);s.appendChild(o);});}
function rsetup(){$('#refreshInterval').addEventListener('change',e=>{S.ri=parseInt(e.target.value);clearInterval(S.rt);if(S.ri>0)S.rt=setInterval(ref,S.ri*1e3);});if(S.ri>0)S.rt=setInterval(ref,S.ri*1e3);}
async function ref(){await load();disc();S.dl=latestDate();if($('#dateLive'))$('#dateLive').value=S.dl;apply();rnote();}
function rnote(){const n=new Date();['refreshNote','refreshNoteGui'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=S.backend+' · '+n.toLocaleTimeString('id-ID');});}
function ltimer(){setInterval(()=>{S.ls++;const m=Math.floor(S.ls/60),s=S.ls%60;if($('#liveTimer'))$('#liveTimer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');},1e3);}

function grd(){if(S.tab==='overview'||S.tab==='npc'||S.tab==='sequence')return[];return S.raw[S.tab]||[];}
function apply(){if(S.tab==='overview'){S.fil=[];rall();return;}if(S.tab==='npc'){rall();return;}if(S.tab==='sequence'){rall();return;}let d=[...grd()];if(S.sp)d=d.filter(r=>r.player_name===S.sp);if(S.dl)d=d.filter(r=>{const ts=r.created_at||r.timestamp||'';return ts.slice(0,10)===S.dl;});if(S.et){const k=M[S.tab]?.fk;if(k)d=d.filter(r=>{const v=r[k];return Array.isArray(v)?v[0]===S.et:v===S.et;});}if(S.sr)d=d.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(S.sr)));S.fil=d;rall();}
function sb(c){if(S.sc===c)S.sd=S.sd==='asc'?'desc':'asc';else{S.sc=c;S.sd='asc';}apply();}
function gp(p){S.p=p;apply();}

function rall(){ustats();ubadge();rnote();if(S.tab==='overview')rov();else if(S.tab==='npc')rnpc();else if(S.tab==='sequence')rseq();else rtab();dmap();}
function ustats(){$('#statChats').textContent=(S.raw.npc||[]).length;$('#statMoves').textContent=(S.raw.behavior||[]).length;$('#statGui').textContent=(S.raw.gui||[]).length;$('#statPlayers').textContent=S.ap.length;}
function ubadge(){if($('#playerCountBadge'))$('#playerCountBadge').textContent=S.ap.length+' Pemain · '+S.backend;}

// ── TABLE ──
function rtab(){const m={behavior:{tid:'dataTable',hid:'tableHead',bid:'tableBody',rid:'rowsShown',pid:'pagination'},gui:{tid:'dataTableGui',hid:'tableHeadGui',bid:'tableBodyGui',rid:'rowsShownGui',pid:'paginationGui'}}[S.tab];if(!m)return;const f=S.fil,st=(S.p-1)*S.rpp,en=Math.min(st+S.rpp,f.length),pd=f.slice(st,en);if(!f.length){document.getElementById(m.hid).innerHTML='';document.getElementById(m.bid).innerHTML='<tr><td colspan="99" class="empty-state">📭 Tidak ada data</td></tr>';document.getElementById(m.rid).textContent='Menampilkan 0 dari 0';document.getElementById(m.pid).innerHTML='';return;}
const cols=(S.tab==='behavior'?['created_at','player_name','position_history','behavior_sequence','section']:(S.tab==='gui'?['created_at','player_name','ui_element','input_data']:Object.keys(f[0]).filter(c=>c!=='id'&&!c.startsWith('_'))));
document.getElementById(m.hid).innerHTML='<tr>'+cols.map(c=>'<th onclick="sb(\''+c+'\')">'+fhdr(c)+'<span class="sort-arrow">'+(S.sc===c?(S.sd==='asc'?'▲':'▼'):'')+'</span></th>').join('')+'</tr>';
document.getElementById(m.bid).innerHTML=pd.map(r=>'<tr>'+cols.map(c=>'<td title="'+escA(String(r[c]??''))+'">'+fcell(c,r[c],r)+'</td>').join('')+'</tr>').join('');
document.getElementById(m.rid).textContent='Menampilkan '+(st+1)+'–'+en+' dari '+f.length.toLocaleString();
const tp=Math.ceil(f.length/S.rpp),pe=document.getElementById(m.pid);if(tp<=1)pe.innerHTML='';else{let h='<button class="page-btn"'+(S.p<=1?' disabled':'')+' onclick="gp('+(S.p-1)+')">‹</button>';for(let i=1;i<=tp;i++)h+='<button class="page-btn'+(i===S.p?' active':'')+'" onclick="gp('+i+')">'+i+'</button>';h+='<button class="page-btn"'+(S.p>=tp?' disabled':'')+' onclick="gp('+(S.p+1)+')">›</button>';pe.innerHTML=h;}}

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
function dchart(){const cv=$('#activityChart');if(!cv)return;const ctx=cv.getContext('2d'),w=cv.parentElement.clientWidth-28;cv.width=w;cv.height=250;ctx.clearRect(0,0,cv.width,cv.height);const bk={};for(const r of[...S.raw.behavior,...S.raw.npc,...S.raw.gui]){const ts=r.created_at||r.timestamp||'';if(!ts)continue;const t=ts.slice(0,16);if(!bk[t])bk[t]={b:0,n:0,g:0};if(r.position_history||r.x!=null)bk[t].b++;else if(r.npc_name)bk[t].n++;else bk[t].g++;}const ks=Object.keys(bk).sort();if(ks.length<2){ctx.fillStyle='#8b8fa3';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('📈 Butuh data',cv.width/2,cv.height/2);return;}const pad=40,pw=cv.width-pad*2,ph=cv.height-pad*2,mx=Math.max(1,...ks.map(k=>bk[k].b+bk[k].n+bk[k].g));ctx.strokeStyle='#2e3242';ctx.lineWidth=0.5;for(let i=0;i<=4;i++){const y=pad+ph*(1-i/4);ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(cv.width-pad,y);ctx.stroke();}const bw=Math.max(2,Math.min(12,pw/ks.length-2));ks.forEach((k,i)=>{const x=pad+i*(pw/ks.length)+bw/2,b=bk[k];ctx.fillStyle='#5865f2';ctx.fillRect(x,pad+ph-(b.b/mx)*ph,bw,(b.b/mx)*ph);ctx.fillStyle='#f59e0b';ctx.fillRect(x,pad+ph-((b.b+b.n)/mx)*ph,bw,(b.n/mx)*ph);ctx.fillStyle='#06b6d4';ctx.fillRect(x,pad+ph-((b.b+b.n+b.g)/mx)*ph,bw,(b.g/mx)*ph);});ks.forEach((k,i)=>{if(i%Math.ceil(ks.length/8)===0||i===ks.length-1){ctx.fillStyle='#8b8fa3';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText(k.slice(11,16),pad+i*(pw/ks.length)+bw/2,cv.height-8);}});ctx.fillStyle='#5865f2';ctx.fillRect(pad+10,10,10,10);ctx.fillStyle='#e1e4ed';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('Behavior',pad+24,20);ctx.fillStyle='#f59e0b';ctx.fillRect(pad+100,10,10,10);ctx.fillText('NPC',pad+114,20);ctx.fillStyle='#06b6d4';ctx.fillRect(pad+190,10,10,10);ctx.fillText('GUI',pad+204,20);}

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
    // Reverse agar dari LAMA → BARU (kiri = awal, kanan = akhir)
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

// ── MINIMAP v2 ──
function dmap(){const cv=$('#minimapCanvas');if(!cv)return;const ctx=cv.getContext('2d'),sz=280;cv.width=sz;cv.height=sz;
// Background
ctx.fillStyle='#0d1117';ctx.fillRect(0,0,sz,sz);
// Grid with labels
ctx.strokeStyle='#1a2233';ctx.lineWidth=0.5;
for(let i=0;i<=sz;i+=sz/8){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,sz);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(sz,i);ctx.stroke();}
// Border
ctx.strokeStyle='#2e3a50';ctx.lineWidth=2;ctx.strokeRect(1,1,sz-2,sz-2);

const pos={};const nw=new Date();
for(const r of(S.raw.behavior||[])){
  // Try position_history first, then direct x,y
  let px=null,py=null;
  const ph=r.position_history;if(ph&&ph.length){const lp=ph[ph.length-1];px=lp.x;py=lp.y;}
  if(px==null&&r.x!=null){px=r.x;py=r.y;}
  if(px==null||py==null)continue;
  const nm=r.player_name||'?';const ts=r.created_at||r.timestamp||'';
  if(!pos[nm]||ts>pos[nm].ts)pos[nm]={x:parseFloat(px),y:parseFloat(py),ts};
}
const es=Object.entries(pos);
if(!es.length){ctx.fillStyle='#4a5568';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText('🗺️ Minimap',sz/2,sz/2-10);ctx.font='10px system-ui';ctx.fillText('Playtest untuk lihat posisi',sz/2,sz/2+12);rpl();return;}

let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
for(const[,p]of es){mnX=Math.min(mnX,p.x);mnY=Math.min(mnY,p.y);mxX=Math.max(mxX,p.x);mxY=Math.max(mxY,p.y);}
// Add 20% padding
const rx=mxX-mnX||50,ry=mxY-mnY||50;
mnX-=rx*0.1;mxX+=rx*0.1;mnY-=ry*0.1;mxY+=ry*0.1;
const pd=25,rX=mxX-mnX,rY=mxY-mnY,sc=Math.min((sz-pd*2)/rX,(sz-pd*2)/rY),ox=(sz-(rX*sc))/2-mnX*sc,oy=(sz-(rY*sc))/2-mnY*sc;

// Draw compass rose
ctx.fillStyle='#4a5568';ctx.font='10px system-ui';ctx.textAlign='center';
ctx.fillText('N',sz-15,18);ctx.fillText('↑',sz-15,30);

// Axis labels
ctx.fillStyle='#5a6578';ctx.font='8px monospace';
ctx.fillText(Math.round(mnX)+','+Math.round(mxY),pd,sz-pd+12);
ctx.fillText(Math.round(mxX)+','+Math.round(mxY),sz-pd,sz-pd+12);
ctx.fillText(Math.round(mnX)+','+Math.round(mnY),pd,12);
ctx.fillText(Math.round(mxX)+','+Math.round(mnY),sz-pd,12);

// Scale bar
ctx.fillStyle='#5a6578';ctx.fillRect(pd+5,sz-pd-8,40,2);
ctx.fillText(Math.round(40/sc)+' studs',pd+25,sz-pd-2);

for(const[nm,p]of es){
  const px=p.x*sc+ox,py=sz-(p.y*sc+oy);
  if(px<0||px>sz||py<0||py>sz)continue;
  const ag=(nw-new Date(p.ts))/6e4;
  let cl='#22c55e',gl='rgba(34,197,94,.7)',r=5;
  if(ag>15){cl='#8b8fa3';gl='rgba(139,143,163,.4)';r=3;}
  else if(ag>5){cl='#f59e0b';gl='rgba(245,158,11,.5)';r=4;}
  // Outer glow
  ctx.fillStyle=gl;ctx.beginPath();ctx.arc(px,py,r+4,0,Math.PI*2);ctx.fill();
  // Inner dot
  ctx.fillStyle=cl;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
  // White center
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py,1.5,0,Math.PI*2);ctx.fill();
  // Label with background
  const lbl=nm.slice(0,8);ctx.font='8px system-ui';const tw=ctx.measureText(lbl).width;
  ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(px-tw/2-3,py-22,tw+6,12);
  ctx.fillStyle='#e1e4ed';ctx.textAlign='center';ctx.fillText(lbl,px,py-12);
}
rpl();}
function rpl(){const c=$('#playerList');if(!c)return;c.innerHTML=S.ap.length?S.ap.slice(0,20).map(p=>{const ch=S.raw.npc.filter(r=>r.player_name===p.name||r.player_name===p.id).length,mv=S.raw.behavior.filter(r=>r.player_name===p.name||r.player_name===p.id).length,gu=S.raw.gui.filter(r=>r.player_name===p.name).length;return'<div class="player-item" onclick="fbp(\''+escA(p.name)+'\')"><span class="player-name">👤 '+escH(p.name)+'</span><span class="player-count-badge-sm">'+(ch+mv+gu)+'</span></div>';}).join(''):'<div class="empty-state" style="padding:15px">Belum ada pemain</div>';}
function fbp(n){const s=$('#playerFilter');if(s){s.value=n;S.sp=n;}S.p=1;apply();}

function esetup(){$('#exportCSV')?.addEventListener('click',exCSV);$('#exportJSON')?.addEventListener('click',exJSON);$('#exportSeqCSV')?.addEventListener('click',exSeqCSV);$('#exportSeqJSON')?.addEventListener('click',exSeqJSON);$('#exportSeqCSV2')?.addEventListener('click',exSeqCSV);$('#exportSeqJSON2')?.addEventListener('click',exSeqJSON);$('#rowsPerPage')?.addEventListener('change',e=>{S.rpp=parseInt(e.target.value);S.p=1;apply();});}
function exCSV(){
  let data,cols;
  if(S.tab==='npc'){
    data=S.raw.npc||[];cols=['created_at','player_name','npc_name','message'];
  }else if(S.tab==='behavior'){
    data=S.raw.behavior||[];cols=['created_at','player_name','position_history','behavior_code','behavior_sequence','section'];
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
  else data=S.raw.gui||[];
  if(!data.length){alert('Tidak ada data!');return;}
  dl('export_'+S.tab+'_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json');
}
function dl(n,c,t){const b=new Blob([c],{type:t}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=n;a.click();URL.revokeObjectURL(u);}

// ── EXPORT BEHAVIOR SEQUENCE (Overview) ──
function buildSeqData(){
  const pl={};
  for(const r of[...S.raw.behavior]){
    const n=r.player_name||'?';const pid=r.player_id||'?';
    if(!pl[n])pl[n]={player_id:pid,player_name:n,total_actions:0,sequence:[],timestamps:[],sections:[]};
    const code=Array.isArray(r.behavior_sequence)?r.behavior_sequence[0]:(Array.isArray(r.behavior_code)?r.behavior_code[0]:r.behavior_code||'');
    const ts=r.created_at||r.timestamp||'';
    let sec=r.section||'';
    if(!sec&&Array.isArray(r.position_history)&&r.position_history.length)sec=r.position_history[r.position_history.length-1].section||'';
    if(code){pl[n].sequence.push(code);pl[n].timestamps.push(ts);pl[n].sections.push(sec);pl[n].total_actions++;}
  }
  return Object.values(pl).sort((a,b)=>b.total_actions-a.total_actions);
}
function exSeqCSV(){
  const data=buildSeqData();
  if(!data.length){alert('Tidak ada data behavior untuk diexport!');return;}
  const cols=['player_name','total_actions','behavior_sequence','timestamps','sections'];
  const csv=cols.map(c=>'"'+c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase())+'"').join(',')+'\n'+
    data.map(r=>{
      return[
        '"'+String(r.player_name).replace(/"/g,'""')+'"',
        r.total_actions,
        '"'+r.sequence.join('→')+'"',
        '"'+r.timestamps.join('; ')+'"',
        '"'+r.sections.join('; ')+'"'
      ].join(',');
    }).join('\n');
  dl('behavior_sequence_'+new Date().toISOString().slice(0,10)+'.csv',csv,'text/csv;charset=utf-8');
}
function exSeqJSON(){
  const data=buildSeqData();
  if(!data.length){alert('Tidak ada data behavior untuk diexport!');return;}
  const out=data.map(r=>({
    player_id:r.player_id,player_name:r.player_name,
    total_actions:r.total_actions,
    behavior_sequence:r.sequence,
    sequence_string:r.sequence.join('→'),
    detail:r.sequence.map((code,i)=>({code,timestamp:r.timestamps[i],section:r.sections[i]}))
  }));
  dl('behavior_sequence_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(out,null,2),'application/json');
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
  if(c==='input_data'&&typeof v==='string'){try{const j=JSON.parse(v);return j.value||j.section||v.slice(0,50);}catch(e){return v.slice(0,60);}}
  if(Array.isArray(v))return v[0]||'';
  if(typeof v==='object')return JSON.stringify(v).slice(0,50);
  return String(v).slice(0,100);
}

function deb(fn,ms){let t;return function(...args){clearTimeout(t);t=setTimeout(()=>fn.apply(this,args),ms);};}
function escH(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escA(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
init();
