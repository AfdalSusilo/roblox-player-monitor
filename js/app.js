/* ======================================================
   Simulasi Banjir — Player Monitor v3 (Supabase)
   Fetch langsung dari Supabase REST API
   ====================================================== */

const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

const SUPABASE_URL='https://qbxvttgzxlfjockyrxne.supabase.co/rest/v1';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFieHZ0dGd6eGxmam9ja3lyeG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MjczNzAsImV4cCI6MjA5ODEwMzM3MH0.GiQcsITIxZbCaDn6746Wds-0Cf5IbwH7_xFDtWe5HW0';

const HEADERS={'apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY};

async function fetchSB(endpoint){
  try{
    const r=await fetch(SUPABASE_URL+endpoint,{headers:HEADERS});
    if(!r.ok)throw new Error(r.status);
    return await r.json();
  }catch(e){console.warn('SB:',e);return[];}
}

const STATE={
  activeTab:'behavior',
  rawData:{behavior:[],gui:[],npc:[]},
  filtered:[],allPlayers:[],
  selectedPlayer:'',dateLive:'',eventType:'',search:'',
  page:1,rowsPerPage:50,sortCol:null,sortDir:'asc',
  refreshInterval:10,refreshTimer:null,liveSeconds:0,
};

const TAB_META={
  behavior:{filterKey:'behavior_sequence'},
  gui:{filterKey:'ui_element'},
  npc:{filterKey:'npc_name'},
  overview:{filterKey:null},
};

// ── INIT ──
async function init(){
  updateClock();setInterval(updateClock,1000);
  await loadAllData();discoverPlayers();
  setupFilters();setupTabs();setupSearch();setupExport();setupRefresh();
  startLiveTimer();switchToTab('behavior');
}
function updateClock(){
  const n=new Date();
  if($('#currentDate'))$('#currentDate').textContent=n.toLocaleDateString('id-ID',{weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  if($('#footerUpdate'))$('#footerUpdate').textContent='🕐 '+n.toLocaleTimeString('id-ID');
}

// ── DATA (Supabase) ──
async function loadAllData(){
  try{
    const[b,n,g]=await Promise.all([
      fetchSB('/behavior_logs?select=*&order=created_at.desc&limit=5000'),
      fetchSB('/npc_interactions?select=*&order=created_at.desc&limit=2000'),
      fetchSB('/gui_logs?select=*&order=created_at.desc&limit=2000'),
    ]);
    STATE.rawData.behavior=b||[];STATE.rawData.npc=n||[];STATE.rawData.gui=g||[];
    console.log('✅',STATE.rawData.behavior.length,'bhv |',STATE.rawData.npc.length,'npc |',STATE.rawData.gui.length,'gui');
  }catch(e){console.warn('Load:',e);}
}
function discoverPlayers(){
  const m=new Map();
  for(const t of['behavior','gui','npc']){
    for(const r of STATE.rawData[t]){
      const id=r.player_id;if(!id)continue;
      if(!m.has(id))m.set(id,{id,name:r.player_name||'Unknown',ts:r.created_at||''});
      const p=m.get(id);if(r.created_at&&(!p.ts||r.created_at>p.ts))p.ts=r.created_at;
    }
  }
  STATE.allPlayers=[...m.values()].sort((a,b)=>b.ts.localeCompare(a.ts));
}

// ── FILTERS ──
function findDate(){for(const t of['behavior','gui','npc'])for(const r of STATE.rawData[t])if(r.created_at)return r.created_at.slice(0,10);return new Date().toISOString().slice(0,10);}
function setupFilters(){
  const s=$('#playerFilter');
  s.innerHTML='<option value="">Semua Player</option>'+STATE.allPlayers.map(p=>'<option value="'+escAttr(p.name)+'">'+escHtml(p.name)+'</option>').join('');
  s.addEventListener('change',()=>{STATE.selectedPlayer=s.value;});
  $('#dateLive').addEventListener('change',()=>{STATE.dateLive=$('#dateLive').value;});
  const d=findDate();$('#dateLive').value=d;STATE.dateLive=d;
  $('#applyFiltersBtn').addEventListener('click',()=>{STATE.selectedPlayer=$('#playerFilter').value;STATE.dateLive=$('#dateLive').value;STATE.page=1;applyAllFilters();});
  $('#resetFiltersBtn').addEventListener('click',()=>{$('#playerFilter').value='';STATE.selectedPlayer='';STATE.dateLive=findDate();$('#dateLive').value=STATE.dateLive;STATE.eventType='';STATE.search='';$('#searchInput').value='';STATE.page=1;applyAllFilters();});
}
function setupTabs(){$$('.tab').forEach(b=>b.addEventListener('click',()=>switchToTab(b.dataset.tab)));}
function switchToTab(t){STATE.activeTab=t;STATE.page=1;STATE.eventType='';$$('.tab').forEach(b=>b.classList.remove('active'));const btn=document.querySelector('.tab[data-tab="'+t+'"]');if(btn)btn.classList.add('active');$$('.tab-view').forEach(v=>v.classList.remove('active'));document.getElementById('view-'+t)?.classList.add('active');updateEventTypeFilter();applyAllFilters();}
function setupSearch(){$('#searchInput').addEventListener('input',debounce(e=>{STATE.search=e.target.value.toLowerCase();STATE.page=1;applyAllFilters();},250));}
$('#filterType').addEventListener('change',e=>{STATE.eventType=e.target.value;STATE.page=1;applyAllFilters();});
function updateEventTypeFilter(){
  if(STATE.activeTab==='overview'||STATE.activeTab==='npc')return;
  const d=getCurrentRawData();const s=$('#filterType');s.innerHTML='<option value="">Semua</option>';
  const k=TAB_META[STATE.activeTab]?.filterKey;if(!k)return;
  [...new Set(d.map(r=>Array.isArray(r[k])?r[k][0]:r[k]).filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=String(v).slice(0,40);s.appendChild(o);});
}
function setupRefresh(){
  $('#refreshInterval').addEventListener('change',e=>{STATE.refreshInterval=parseInt(e.target.value);clearInterval(STATE.refreshTimer);if(STATE.refreshInterval>0)STATE.refreshTimer=setInterval(refreshData,STATE.refreshInterval*1000);});
  if(STATE.refreshInterval>0)STATE.refreshTimer=setInterval(refreshData,STATE.refreshInterval*1000);
}
async function refreshData(){await loadAllData();discoverPlayers();applyAllFilters();updateRefreshNote();}
function updateRefreshNote(){
  const n=new Date(),note='🔄 '+n.toLocaleTimeString('id-ID')+' · '+STATE.refreshInterval+'s';
  ['refreshNote','refreshNoteGui'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=note;});
  if($('#footerUpdate'))$('#footerUpdate').textContent='Terakhir: '+n.toLocaleTimeString('id-ID');
}
function startLiveTimer(){setInterval(()=>{STATE.liveSeconds++;const m=Math.floor(STATE.liveSeconds/60),s=STATE.liveSeconds%60;if($('#liveTimer'))$('#liveTimer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');},1000);}

// ── DATA HELPERS ──
function getCurrentRawData(){if(STATE.activeTab==='overview'||STATE.activeTab==='npc')return[];return STATE.rawData[STATE.activeTab]||[];}
function applyAllFilters(){
  if(STATE.activeTab==='overview'){STATE.filtered=[];renderAll();return;}
  if(STATE.activeTab==='npc'){renderAll();return;}
  let d=[...getCurrentRawData()];
  if(STATE.selectedPlayer)d=d.filter(r=>r.player_name===STATE.selectedPlayer);
  if(STATE.dateLive)d=d.filter(r=>!r.created_at||r.created_at.slice(0,10)===STATE.dateLive);
  if(STATE.eventType){const k=TAB_META[STATE.activeTab]?.filterKey;if(k)d=d.filter(r=>{const v=r[k];return Array.isArray(v)?v[0]===STATE.eventType:v===STATE.eventType;});}
  if(STATE.search)d=d.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(STATE.search)));
  if(STATE.sortCol){d.sort((a,b)=>{const va=a[STATE.sortCol]??'',vb=b[STATE.sortCol]??'';return STATE.sortDir==='asc'?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));});}
  STATE.filtered=d;renderAll();
}
function sortBy(c){if(STATE.sortCol===c)STATE.sortDir=STATE.sortDir==='asc'?'desc':'asc';else{STATE.sortCol=c;STATE.sortDir='asc';}applyAllFilters();}

// ── RENDER ──
function renderAll(){updateStats();updatePlayerBadge();updateRefreshNote();if(STATE.activeTab==='overview')renderOverview();else if(STATE.activeTab==='npc')renderNpcChat();else renderTableView();drawMinimap();}
function updateStats(){
  if($('#statChats'))$('#statChats').textContent=(STATE.rawData.npc||[]).length.toLocaleString();
  if($('#statMoves'))$('#statMoves').textContent=(STATE.rawData.behavior||[]).length.toLocaleString();
  if($('#statGui'))$('#statGui').textContent=(STATE.rawData.gui||[]).length.toLocaleString();
  if($('#statPlayers'))$('#statPlayers').textContent=STATE.allPlayers.length;
}
function updatePlayerBadge(){if($('#playerCountBadge'))$('#playerCountBadge').textContent=STATE.allPlayers.length+' Pemain';}

// ── TABLE ──
function renderTableView(){
  const m={behavior:{tid:'dataTable',hid:'tableHead',bid:'tableBody',rid:'rowsShown',pid:'pagination'},gui:{tid:'dataTableGui',hid:'tableHeadGui',bid:'tableBodyGui',rid:'rowsShownGui',pid:'paginationGui'}}[STATE.activeTab];
  if(!m)return;
  const f=STATE.filtered,st=(STATE.page-1)*STATE.rowsPerPage,en=Math.min(st+STATE.rowsPerPage,f.length),pd=f.slice(st,en);
  if(!f.length){document.getElementById(m.hid).innerHTML='';document.getElementById(m.bid).innerHTML='<tr><td colspan="99" class="empty-state">📭 Tidak ada data</td></tr>';document.getElementById(m.rid).textContent='Menampilkan 0 dari 0';document.getElementById(m.pid).innerHTML='';return;}
  const cols=Object.keys(f[0]).filter(c=>!c.startsWith('_'));
  document.getElementById(m.hid).innerHTML='<tr>'+cols.map(c=>'<th onclick="sortBy(\''+c+'\')">'+fmtHdr(c)+'<span class="sort-arrow">'+(STATE.sortCol===c?(STATE.sortDir==='asc'?'▲':'▼'):'')+'</span></th>').join('')+'</tr>';
  document.getElementById(m.bid).innerHTML=pd.map(r=>'<tr>'+cols.map(c=>'<td title="'+escAttr(String(r[c]??''))+'">'+fmtCell(c,r[c])+'</td>').join('')+'</tr>').join('');
  document.getElementById(m.rid).textContent='Menampilkan '+(st+1)+'–'+en+' dari '+f.length.toLocaleString();
  const tp=Math.ceil(f.length/STATE.rowsPerPage),pe=document.getElementById(m.pid);if(tp<=1)pe.innerHTML='';else{let h='<button class="page-btn"'+(STATE.page<=1?' disabled':'')+' onclick="goPage('+(STATE.page-1)+')">‹</button>';for(let i=1;i<=tp;i++)h+='<button class="page-btn'+(i===STATE.page?' active':'')+'" onclick="goPage('+i+')">'+i+'</button>';h+='<button class="page-btn"'+(STATE.page>=tp?' disabled':'')+' onclick="goPage('+(STATE.page+1)+')">›</button>';pe.innerHTML=h;}
}
function goPage(p){STATE.page=p;applyAllFilters();}

// ── NPC CHAT ──
function renderNpcChat(){
  let c=[...STATE.rawData.npc].reverse();
  if(STATE.selectedPlayer)c=c.filter(r=>r.player_name===STATE.selectedPlayer);
  if(STATE.dateLive)c=c.filter(r=>!r.created_at||r.created_at.slice(0,10)===STATE.dateLive);
  if(STATE.search)c=c.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(STATE.search)));
  const box=$('#chatLogBox');if(!box)return;
  if(!c.length){box.innerHTML='<div class="empty-state">💬 Belum ada percakapan NPC</div>';return;}
  const st=(STATE.page-1)*STATE.rowsPerPage,en=Math.min(st+STATE.rowsPerPage,c.length);
  box.innerHTML=c.slice(st,en).map(r=>{const t=r.created_at?new Date(r.created_at).toLocaleTimeString('id-ID'):'';return'<div class="chat-bubble player"><div class="npc-label">🤖 '+escHtml(r.npc_name||'NPC')+'</div><div class="sender">'+escHtml(r.player_name||'Player')+'</div><div>'+escHtml(r.message||'(kosong)')+'</div><div class="time">'+t+'</div></div>';}).join('');
  box.scrollTop=box.scrollHeight;
  if($('#rowsShownNpc'))$('#rowsShownNpc').textContent='Menampilkan '+(st+1)+'–'+en+' dari '+c.length.toLocaleString();
}

// ── OVERVIEW ──
function renderOverview(){
  const pl={};
  for(const r of[...STATE.rawData.behavior,...STATE.rawData.npc,...STATE.rawData.gui]){const n=r.player_name||'Unknown';if(!pl[n])pl[n]={name:n,chats:0,moves:0,guis:0};if(r.npc_name)pl[n].chats++;else if(r.position_history)pl[n].moves++;else pl[n].guis++;}
  const ps=Object.values(pl).sort((a,b)=>(b.chats+b.moves+b.guis)-(a.chats+a.moves+a.guis));
  if($('#playerListPanel'))$('#playerListPanel').innerHTML=ps.length?ps.slice(0,15).map(p=>'<div class="player-item" onclick="filterByPlayer(\''+escAttr(p.name)+'\')"><span class="player-name">👤 '+escHtml(p.name)+'</span><span class="player-count-badge-sm">'+(p.chats+p.moves+p.guis)+'</span></div>').join(''):'<div class="empty-state" style="padding:20px">Belum ada pemain</div>';
  const nc={};for(const r of STATE.rawData.npc){if(r.npc_name)nc[r.npc_name]=(nc[r.npc_name]||0)+1;}
  const ns=Object.entries(nc).sort((a,b)=>b[1]-a[1]);
  if($('#npcListPanel'))$('#npcListPanel').innerHTML=ns.length?ns.slice(0,15).map(([n,c])=>'<div class="npc-item"><span>🤖 '+escHtml(n)+'</span><span class="npc-count-badge">'+c+' chat</span></div>').join(''):'<div class="empty-state" style="padding:20px">Belum ada interaksi</div>';
  drawActivityChart();
}
function drawActivityChart(){
  const cv=$('#activityChart');if(!cv)return;const ctx=cv.getContext('2d'),w=cv.parentElement.clientWidth-28;cv.width=w;cv.height=250;ctx.clearRect(0,0,cv.width,cv.height);
  const bk={};
  for(const r of[...STATE.rawData.behavior,...STATE.rawData.npc,...STATE.rawData.gui]){if(!r.created_at)continue;const t=r.created_at.slice(0,16);if(!bk[t])bk[t]={b:0,n:0,g:0};if(r.position_history)bk[t].b++;else if(r.npc_name)bk[t].n++;else bk[t].g++;}
  const ks=Object.keys(bk).sort();if(ks.length<2){ctx.fillStyle='#8b8fa3';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('📈 Butuh lebih banyak data',cv.width/2,cv.height/2);return;}
  const pad=40,pw=cv.width-pad*2,ph=cv.height-pad*2,mx=Math.max(1,...ks.map(k=>bk[k].b+bk[k].n+bk[k].g));
  ctx.strokeStyle='#2e3242';ctx.lineWidth=0.5;for(let i=0;i<=4;i++){const y=pad+ph*(1-i/4);ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(cv.width-pad,y);ctx.stroke();}
  const bw=Math.max(2,Math.min(12,pw/ks.length-2));
  ks.forEach((k,i)=>{const x=pad+i*(pw/ks.length)+bw/2,b=bk[k];ctx.fillStyle='#5865f2';ctx.fillRect(x,pad+ph-(b.b/mx)*ph,bw,(b.b/mx)*ph);ctx.fillStyle='#f59e0b';ctx.fillRect(x,pad+ph-((b.b+b.n)/mx)*ph,bw,(b.n/mx)*ph);ctx.fillStyle='#06b6d4';ctx.fillRect(x,pad+ph-((b.b+b.n+b.g)/mx)*ph,bw,(b.g/mx)*ph);});
  ks.forEach((k,i)=>{if(i%Math.ceil(ks.length/8)===0||i===ks.length-1){ctx.fillStyle='#8b8fa3';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText(k.slice(11,16),pad+i*(pw/ks.length)+bw/2,cv.height-8);}});
  ctx.fillStyle='#5865f2';ctx.fillRect(pad+10,10,10,10);ctx.fillStyle='#e1e4ed';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('Behavior',pad+24,20);ctx.fillStyle='#f59e0b';ctx.fillRect(pad+100,10,10,10);ctx.fillText('NPC Chat',pad+114,20);ctx.fillStyle='#06b6d4';ctx.fillRect(pad+190,10,10,10);ctx.fillText('GUI',pad+204,20);
}

// ── MINIMAP ──
function drawMinimap(){
  const cv=$('#minimapCanvas');if(!cv)return;const ctx=cv.getContext('2d'),sz=280;cv.width=sz;cv.height=sz;
  ctx.fillStyle='#121520';ctx.fillRect(0,0,sz,sz);ctx.strokeStyle='#1e2438';ctx.lineWidth=0.5;
  for(let i=0;i<=sz;i+=sz/10){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,sz);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(sz,i);ctx.stroke();}
  const pos={};const nw=new Date();
  for(const r of(STATE.rawData.behavior||[])){
    const ph=r.position_history;if(!ph||!ph.length)continue;
    const lp=ph[ph.length-1];if(lp.x==null&&lp.y==null)continue;
    const nm=r.player_name||'unknown';
    if(!pos[nm]||(r.created_at>pos[nm].ts))pos[nm]={x:parseFloat(lp.x),y:parseFloat(lp.y),ts:r.created_at};
  }
  const es=Object.entries(pos);
  if(!es.length){ctx.fillStyle='#8b8fa3';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('🗺️ Menunggu playtest',sz/2,sz/2);}
  else{
    let mnX=Infinity,mnY=Infinity,mxX=-Infinity,mxY=-Infinity;
    for(const[,p]of es){mnX=Math.min(mnX,p.x);mnY=Math.min(mnY,p.y);mxX=Math.max(mxX,p.x);mxY=Math.max(mxY,p.y);}
    const pd=30,rX=mxX-mnX||10,rY=mxY-mnY||10,sc=Math.min((sz-pd*2)/rX,(sz-pd*2)/rY),ox=(sz-(rX*sc))/2-mnX*sc,oy=(sz-(rY*sc))/2-mnY*sc;
    for(const[nm,p]of es){
      const px=p.x*sc+ox,py=sz-(p.y*sc+oy);if(px<5||px>sz-5||py<5||py>sz-5)continue;
      const ag=(nw-new Date(p.ts))/60000;let cl='#22c55e',gl='rgba(34,197,94,.6)',r=5;if(ag>15){cl='#8b8fa3';gl='rgba(139,143,163,.3)';r=3;}else if(ag>5){cl='#f59e0b';gl='rgba(245,158,11,.4)';r=4;}
      ctx.fillStyle=gl;ctx.beginPath();ctx.arc(px,py,r+3,0,Math.PI*2);ctx.fill();ctx.fillStyle=cl;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e1e4ed';ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillText(nm.slice(0,10),px,py-10);
    }
  }
  renderPlayerList();
}
function renderPlayerList(){
  const c=$('#playerList');if(!c)return;
  c.innerHTML=STATE.allPlayers.length?STATE.allPlayers.slice(0,20).map(p=>{const ch=STATE.rawData.npc.filter(r=>r.player_name===p.name).length,mv=STATE.rawData.behavior.filter(r=>r.player_name===p.name).length,gu=STATE.rawData.gui.filter(r=>r.player_name===p.name).length;return'<div class="player-item" onclick="filterByPlayer(\''+escAttr(p.name)+'\')"><span class="player-name">👤 '+escHtml(p.name)+'</span><span class="player-count-badge-sm">'+(ch+mv+gu)+'</span></div>';}).join(''):'<div class="empty-state" style="padding:15px">Belum ada pemain</div>';
}
function filterByPlayer(n){const s=$('#playerFilter');if(s){s.value=n;STATE.selectedPlayer=n;}STATE.page=1;applyAllFilters();}

// ── EXPORT ──
function setupExport(){$('#exportCSV')?.addEventListener('click',exportCSV);$('#exportJSON')?.addEventListener('click',exportJSON);$('#rowsPerPage')?.addEventListener('change',e=>{STATE.rowsPerPage=parseInt(e.target.value);STATE.page=1;applyAllFilters();});}
function exportCSV(){if(STATE.activeTab==='npc')return;const d=getCurrentRawData();if(!d.length)return;const cs=Object.keys(d[0]);downloadFile('export_'+STATE.activeTab+'.csv',cs.join(',')+'\n'+d.map(r=>cs.map(c=>'"'+String(r[c]||'').replace(/"/g,'""')+'"').join(',')).join('\n'),'text/csv');}
function exportJSON(){const d=STATE.activeTab==='npc'?STATE.rawData.npc:getCurrentRawData();downloadFile('export_'+STATE.activeTab+'.json',JSON.stringify(d,null,2),'application/json');}
function downloadFile(n,c,t){const b=new Blob([c],{type:t}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=n;a.click();URL.revokeObjectURL(u);}

// ── FORMAT ──
function fmtHdr(c){return c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());}
function fmtCell(c,v){if(v==null)return'—';if(c==='created_at')try{return new Date(v).toLocaleString('id-ID');}catch(e){return String(v);}if(typeof v==='object')return JSON.stringify(v).slice(0,60);return String(v).slice(0,100);}

// ── UTILS ──
function debounce(fn,ms){let t;return function(...args){clearTimeout(t);t=setTimeout(()=>fn.apply(this,args),ms);};}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
init();
