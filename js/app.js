/* ======================================================
   Simulasi Banjir — Player Monitor Dashboard v2
   Fetch dari API (SQLite) — bukan JSON file
   ====================================================== */

const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

const API_BASE='https://laser-cakes-pennsylvania-pike.trycloudflare.com';

const STATE={
  activeTab:'behavior',
  rawData:{behavior:[],gui:[],npc:[]},
  filtered:[],
  allPlayers:[],
  selectedPlayer:'',
  dateLive:'',
  eventType:'',
  search:'',
  page:1,rowsPerPage:50,
  sortCol:null,sortDir:'asc',
  refreshInterval:10,
  refreshTimer:null,
  liveSeconds:0,
};

const TAB_META={
  behavior:{filterKey:'behavior_code'},
  gui:{filterKey:'section'},
  npc:{filterKey:'npc_name'},
  overview:{filterKey:null},
};

// ── INIT ──
async function init(){
  updateClock();setInterval(updateClock,1000);
  await loadAllData();
  discoverPlayers();
  setupFilters();setupTabs();setupSearch();setupExport();setupRefresh();
  startLiveTimer();
  switchToTab('behavior');
}
function updateClock(){
  const now=new Date();
  if($('#currentDate'))$('#currentDate').textContent=now.toLocaleDateString('id-ID',{weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  if($('#footerUpdate'))$('#footerUpdate').textContent='🕐 '+now.toLocaleTimeString('id-ID');
}

// ── DATA LOADING (from API) ──
async function loadAllData(){
  try{
    const [bhv,npc,gui]=await Promise.all([
      fetch(API_BASE+'/api/behaviors?limit=5000').then(r=>r.json()).catch(()=>({data:[]})),
      fetch(API_BASE+'/api/npc-chats?limit=2000').then(r=>r.json()).catch(()=>({data:[]})),
      fetch(API_BASE+'/api/gui-logs?limit=2000').then(r=>r.json()).catch(()=>({data:[]})),
    ]);
    STATE.rawData.behavior=bhv.data||[];
    STATE.rawData.npc=npc.data||[];
    STATE.rawData.gui=gui.data||[];
    console.log('✅',STATE.rawData.behavior.length,'behavior |',STATE.rawData.npc.length,'npc |',STATE.rawData.gui.length,'gui');
  }catch(e){console.warn('Load error:',e);}
}

function discoverPlayers(){
  const playerMap=new Map();
  for(const type of['behavior','gui','npc']){
    for(const row of STATE.rawData[type]){
      const id=row.player_id;if(!id)continue;
      if(!playerMap.has(id))playerMap.set(id,{id,name:row.player_name||'Unknown',firstSeen:row.timestamp||'',lastSeen:row.timestamp||''});
      const p=playerMap.get(id);
      if(row.timestamp){if(!p.firstSeen||row.timestamp<p.firstSeen)p.firstSeen=row.timestamp;if(!p.lastSeen||row.timestamp>p.lastSeen)p.lastSeen=row.timestamp;}
    }
  }
  STATE.allPlayers=[...playerMap.values()].sort((a,b)=>{
    const ca=STATE.rawData.behavior.filter(r=>String(r.player_id)===a.id).length;
    const cb=STATE.rawData.behavior.filter(r=>String(r.player_id)===b.id).length;
    return cb-ca;
  });
}

// ── FILTER SETUP ──
function findDataDate(){
  for(const type of['behavior','gui','npc']){for(const row of STATE.rawData[type]){if(row.timestamp)return row.timestamp.slice(0,10);}}
  return new Date().toISOString().slice(0,10);
}
function setupFilters(){
  const sel=$('#playerFilter');
  sel.innerHTML='<option value="">Semua Player</option>'+STATE.allPlayers.map(p=>'<option value="'+escAttr(p.name)+'">'+escHtml(p.name)+' ('+p.id+')</option>').join('');
  sel.addEventListener('change',()=>{STATE.selectedPlayer=sel.value;});
  $('#dateLive').addEventListener('change',()=>{STATE.dateLive=$('#dateLive').value;});
  const today=new Date().toISOString().slice(0,10);
  $('#dateLive').value=today;STATE.dateLive=today;
  $('#applyFiltersBtn').addEventListener('click',()=>{STATE.selectedPlayer=$('#playerFilter').value;STATE.dateLive=$('#dateLive').value;STATE.page=1;applyAllFilters();});
  $('#resetFiltersBtn').addEventListener('click',resetFilters);
}
function resetFilters(){
  $('#playerFilter').value='';STATE.selectedPlayer='';
  const dd=findDataDate();$('#dateLive').value=dd;STATE.dateLive=dd;
  $('#filterType').value='';STATE.eventType='';STATE.search='';$('#searchInput').value='';STATE.page=1;
  applyAllFilters();
}

// ── TABS ──
function setupTabs(){$$('.tab').forEach(btn=>{btn.addEventListener('click',()=>switchToTab(btn.dataset.tab));});}
function switchToTab(tabName){
  STATE.activeTab=tabName;STATE.page=1;STATE.eventType='';
  $$('.tab').forEach(b=>b.classList.remove('active'));
  const btn=document.querySelector('.tab[data-tab="'+tabName+'"]');if(btn)btn.classList.add('active');
  $$('.tab-view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+tabName)?.classList.add('active');
  updateEventTypeFilter();applyAllFilters();
}

// ── SEARCH ──
function setupSearch(){$('#searchInput').addEventListener('input',debounce(e=>{STATE.search=e.target.value.toLowerCase();STATE.page=1;applyAllFilters();},250));}
function updateEventTypeFilter(){
  if(STATE.activeTab==='overview'||STATE.activeTab==='npc')return;
  const data=getCurrentRawData();const sel=$('#filterType');sel.innerHTML='<option value="">Semua</option>';
  const key=TAB_META[STATE.activeTab]?.filterKey;if(!key)return;
  [...new Set(data.map(r=>r[key]).filter(Boolean))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=String(v).slice(0,50);sel.appendChild(o);});
}
$('#filterType').addEventListener('change',e=>{STATE.eventType=e.target.value;STATE.page=1;applyAllFilters();});

// ── REFRESH ──
function setupRefresh(){
  $('#refreshInterval').addEventListener('change',e=>{STATE.refreshInterval=parseInt(e.target.value);clearInterval(STATE.refreshTimer);if(STATE.refreshInterval>0)STATE.refreshTimer=setInterval(refreshData,STATE.refreshInterval*1000);});
  if(STATE.refreshInterval>0)STATE.refreshTimer=setInterval(refreshData,STATE.refreshInterval*1000);
}
async function refreshData(){await loadAllData();discoverPlayers();applyAllFilters();updateRefreshNote();}
function updateRefreshNote(){
  const now=new Date();const note='🔄 '+now.toLocaleTimeString('id-ID')+' · '+STATE.refreshInterval+'s';
  ['refreshNote','refreshNoteGui'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=note;});
  if($('#footerUpdate'))$('#footerUpdate').textContent='Terakhir: '+now.toLocaleTimeString('id-ID');
}
function startLiveTimer(){
  setInterval(()=>{STATE.liveSeconds++;const m=Math.floor(STATE.liveSeconds/60),s=STATE.liveSeconds%60;if($('#liveTimer'))$('#liveTimer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');},1000);
}

// ── DATA HELPERS ──
function getCurrentRawData(){if(STATE.activeTab==='overview'||STATE.activeTab==='npc')return[];return STATE.rawData[STATE.activeTab]||[];}
function applyAllFilters(){
  if(STATE.activeTab==='overview'){STATE.filtered=[];renderAll();return;}
  if(STATE.activeTab==='npc'){renderAll();return;}
  let data=[...getCurrentRawData()];
  if(STATE.selectedPlayer)data=data.filter(r=>r.player_name===STATE.selectedPlayer);
  if(STATE.dateLive)data=data.filter(r=>!r.timestamp||r.timestamp.slice(0,10)===STATE.dateLive);
  if(STATE.eventType){const key=TAB_META[STATE.activeTab]?.filterKey;if(key)data=data.filter(r=>r[key]===STATE.eventType);}
  if(STATE.search)data=data.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(STATE.search)));
  if(STATE.sortCol){data.sort((a,b)=>{const va=a[STATE.sortCol]??'',vb=b[STATE.sortCol]??'';const cmp=va<vb?-1:va>vb?1:0;return STATE.sortDir==='asc'?cmp:-cmp;});}
  STATE.filtered=data;renderAll();
}
function sortBy(col){if(STATE.sortCol===col){STATE.sortDir=STATE.sortDir==='asc'?'desc':'asc';}else{STATE.sortCol=col;STATE.sortDir='asc';}applyAllFilters();}

// ── RENDER ALL ──
function renderAll(){updateStats();updatePlayerBadge();updateRefreshNote();if(STATE.activeTab==='overview')renderOverview();else if(STATE.activeTab==='npc')renderNpcChat();else renderTableView();drawMinimap();}
function updateStats(){
  const b=STATE.rawData.behavior||[],n=STATE.rawData.npc||[],g=STATE.rawData.gui||[];
  if($('#statChats'))$('#statChats').textContent=n.length.toLocaleString();
  if($('#statMoves'))$('#statMoves').textContent=b.length.toLocaleString();
  if($('#statGui'))$('#statGui').textContent=g.length.toLocaleString();
  if($('#statPlayers'))$('#statPlayers').textContent=STATE.allPlayers.length;
}
function updatePlayerBadge(){if($('#playerCountBadge'))$('#playerCountBadge').textContent=STATE.allPlayers.length+' Pemain';}

// ── TABLE VIEW ──
function renderTableView(){
  const meta={behavior:{tid:'dataTable',hid:'tableHead',bid:'tableBody',rid:'rowsShown',pid:'pagination'},gui:{tid:'dataTableGui',hid:'tableHeadGui',bid:'tableBodyGui',rid:'rowsShownGui',pid:'paginationGui'}}[STATE.activeTab];
  if(!meta)return;
  const filtered=STATE.filtered;
  const start=(STATE.page-1)*STATE.rowsPerPage,end=Math.min(start+STATE.rowsPerPage,filtered.length);
  const pageData=filtered.slice(start,end);
  
  if(filtered.length===0){
    document.getElementById(meta.hid).innerHTML='';
    document.getElementById(meta.bid).innerHTML='<tr><td colspan="99" class="empty-state">📭 Tidak ada data</td></tr>';
    document.getElementById(meta.rid).textContent='Menampilkan 0 dari 0';
    document.getElementById(meta.pid).innerHTML='';return;
  }
  
  const cols=Object.keys(filtered[0]).filter(c=>!c.startsWith('_'));
  document.getElementById(meta.hid).innerHTML='<tr>'+cols.map(c=>'<th onclick="sortBy(\''+c+'\')">'+formatHeader(c)+'<span class="sort-arrow">'+(STATE.sortCol===c?(STATE.sortDir==='asc'?'▲':'▼'):'')+'</span></th>').join('')+'</tr>';
  document.getElementById(meta.bid).innerHTML=pageData.map(row=>'<tr>'+cols.map(c=>{const v=row[c];return'<td title="'+escAttr(String(v??''))+'">'+formatCell(c,v)+'</td>';}).join('')+'</tr>').join('');
  document.getElementById(meta.rid).textContent='Menampilkan '+(start+1)+'–'+end+' dari '+filtered.length.toLocaleString();
  
  const tp=Math.ceil(filtered.length/STATE.rowsPerPage);
  const pel=document.getElementById(meta.pid);
  if(tp<=1)pel.innerHTML='';else{
    let h='<button class="page-btn"'+(STATE.page<=1?' disabled':'')+' onclick="goPage('+(STATE.page-1)+')">‹</button>';
    for(let i=1;i<=tp;i++)h+='<button class="page-btn'+(i===STATE.page?' active':'')+'" onclick="goPage('+i+')">'+i+'</button>';
    h+='<button class="page-btn"'+(STATE.page>=tp?' disabled':'')+' onclick="goPage('+(STATE.page+1)+')">›</button>';
    pel.innerHTML=h;
  }
}
function goPage(p){STATE.page=p;applyAllFilters();}

// ── NPC CHAT ──
function renderNpcChat(){
  let chats=[...STATE.rawData.npc].reverse();
  if(STATE.selectedPlayer)chats=chats.filter(r=>r.player_name===STATE.selectedPlayer);
  if(STATE.dateLive)chats=chats.filter(r=>!r.timestamp||r.timestamp.slice(0,10)===STATE.dateLive);
  if(STATE.search)chats=chats.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(STATE.search)));
  
  const box=$('#chatLogBox');if(!box)return;
  if(chats.length===0){box.innerHTML='<div class="empty-state">💬 Belum ada percakapan NPC</div>';return;}
  
  const start=(STATE.page-1)*STATE.rowsPerPage,end=Math.min(start+STATE.rowsPerPage,chats.length);
  box.innerHTML=chats.slice(start,end).map(row=>{
    const time=row.timestamp?new Date(row.timestamp).toLocaleTimeString('id-ID'):'';
    const msg=row.message||'(kosong)';const npc=row.npc_name||'NPC';
    return'<div class="chat-bubble player"><div class="npc-label">🤖 '+escHtml(npc)+'</div><div class="sender">'+escHtml(row.player_name||'Player')+'</div><div>'+escHtml(msg)+'</div><div class="time">'+time+'</div></div>';
  }).join('');
  box.scrollTop=box.scrollHeight;
  if($('#rowsShownNpc'))$('#rowsShownNpc').textContent='Menampilkan '+(start+1)+'–'+end+' dari '+chats.length.toLocaleString();
}

// ── OVERVIEW ──
function renderOverview(){
  const players={};
  for(const row of[...STATE.rawData.npc,...STATE.rawData.behavior,...STATE.rawData.gui]){
    const name=row.player_name||'Unknown';if(!players[name])players[name]={name,chats:0,moves:0,guis:0};
    if(row.npc_name)players[name].chats++;else if(row.x!=null)players[name].moves++;else players[name].guis++;
  }
  const plist=Object.values(players).sort((a,b)=>(b.chats+b.moves+b.guis)-(a.chats+a.moves+a.guis));
  if($('#playerListPanel'))$('#playerListPanel').innerHTML=plist.length===0?'<div class="empty-state" style="padding:20px">Belum ada pemain</div>':plist.slice(0,15).map(p=>'<div class="player-item" onclick="filterByPlayer(\''+escAttr(p.name)+'\')"><span class="player-name">👤 '+escHtml(p.name)+'</span><span class="player-count-badge-sm">'+(p.chats+p.moves+p.guis)+'</span></div>').join('');
  
  const npcCount={};
  for(const row of STATE.rawData.npc){if(row.npc_name)npcCount[row.npc_name]=(npcCount[row.npc_name]||0)+1;}
  const npcs=Object.entries(npcCount).sort((a,b)=>b[1]-a[1]);
  if($('#npcListPanel'))$('#npcListPanel').innerHTML=npcs.length===0?'<div class="empty-state" style="padding:20px">Belum ada interaksi</div>':npcs.slice(0,15).map(([n,c])=>'<div class="npc-item"><span>🤖 '+escHtml(n)+'</span><span class="npc-count-badge">'+c+' chat</span></div>').join('');
  
  drawActivityChart();
}
function drawActivityChart(){
  const canvas=$('#activityChart');if(!canvas)return;
  const ctx=canvas.getContext('2d'),w=canvas.parentElement.clientWidth-28;canvas.width=w;canvas.height=250;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const buckets={};
  for(const row of[...STATE.rawData.behavior,...STATE.rawData.npc,...STATE.rawData.gui]){
    if(!row.timestamp)continue;const t=row.timestamp.slice(0,16);
    if(!buckets[t])buckets[t]={b:0,n:0,g:0};
    if(row.x!=null)buckets[t].b++;else if(row.npc_name)buckets[t].n++;else buckets[t].g++;
  }
  const keys=Object.keys(buckets).sort();
  if(keys.length<2){ctx.fillStyle='#8b8fa3';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('📈 Butuh lebih banyak data',canvas.width/2,canvas.height/2);return;}
  const pad=40,plotW=canvas.width-pad*2,plotH=canvas.height-pad*2;
  const maxV=Math.max(1,...keys.map(k=>buckets[k].b+buckets[k].n+buckets[k].g));
  ctx.strokeStyle='#2e3242';ctx.lineWidth=0.5;
  for(let i=0;i<=4;i++){const y=pad+plotH*(1-i/4);ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(canvas.width-pad,y);ctx.stroke();}
  const barW=Math.max(2,Math.min(12,plotW/keys.length-2));
  keys.forEach((k,i)=>{
    const x=pad+i*(plotW/keys.length)+barW/2,b=buckets[k];
    ctx.fillStyle='#5865f2';ctx.fillRect(x,pad+plotH-(b.b/maxV)*plotH,barW,(b.b/maxV)*plotH);
    ctx.fillStyle='#f59e0b';ctx.fillRect(x,pad+plotH-((b.b+b.n)/maxV)*plotH,barW,(b.n/maxV)*plotH);
    ctx.fillStyle='#06b6d4';ctx.fillRect(x,pad+plotH-((b.b+b.n+b.g)/maxV)*plotH,barW,(b.g/maxV)*plotH);
  });
  keys.forEach((k,i)=>{if(i%Math.ceil(keys.length/8)===0||i===keys.length-1){ctx.fillStyle='#8b8fa3';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText(k.slice(11,16),pad+i*(plotW/keys.length)+barW/2,canvas.height-8);}});
  ctx.fillStyle='#5865f2';ctx.fillRect(pad+10,10,10,10);ctx.fillStyle='#e1e4ed';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('Behavior',pad+24,20);
  ctx.fillStyle='#f59e0b';ctx.fillRect(pad+100,10,10,10);ctx.fillText('NPC Chat',pad+114,20);
  ctx.fillStyle='#06b6d4';ctx.fillRect(pad+190,10,10,10);ctx.fillText('GUI',pad+204,20);
}

// ── MINIMAP ──
function drawMinimap(){
  const canvas=$('#minimapCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d'),size=280;canvas.width=size;canvas.height=size;
  ctx.fillStyle='#121520';ctx.fillRect(0,0,size,size);
  ctx.strokeStyle='#1e2438';ctx.lineWidth=0.5;
  for(let i=0;i<=size;i+=size/10){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,size);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(size,i);ctx.stroke();}
  
  const pos={};const now=new Date();
  for(const row of(STATE.rawData.behavior||[])){
    if(row.x==null&&row.y==null)continue;
    const name=row.player_name||'unknown';
    if(!pos[name]||(row.timestamp>pos[name].timestamp))pos[name]={x:parseFloat(row.x),y:parseFloat(row.y),timestamp:row.timestamp};
  }
  const entries=Object.entries(pos);
  if(entries.length===0){ctx.fillStyle='#8b8fa3';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('🗺️ Menunggu playtest',size/2,size/2);}
  else{
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const[,p]of entries){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
    const pad=30,rX=maxX-minX||10,rY=maxY-minY||10;
    const sc=Math.min((size-pad*2)/rX,(size-pad*2)/rY);
    const ox=(size-(rX*sc))/2-minX*sc,oy=(size-(rY*sc))/2-minY*sc;
    for(const[name,p]of entries){
      const px=p.x*sc+ox,py=size-(p.y*sc+oy);if(px<5||px>size-5||py<5||py>size-5)continue;
      const age=(now-new Date(p.timestamp))/60000;
      let col='#22c55e',glow='rgba(34,197,94,.6)',r=5;if(age>15){col='#8b8fa3';glow='rgba(139,143,163,.3)';r=3;}else if(age>5){col='#f59e0b';glow='rgba(245,158,11,.4)';r=4;}
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(px,py,r+3,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=col;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#e1e4ed';ctx.font='9px system-ui';ctx.textAlign='center';ctx.fillText(name.slice(0,10),px,py-10);
    }
  }
  renderPlayerList();
}
function renderPlayerList(){
  const c=$('#playerList');if(!c)return;
  const pl=STATE.allPlayers;
  c.innerHTML=pl.length===0?'<div class="empty-state" style="padding:15px">Belum ada pemain</div>':pl.slice(0,20).map(p=>{
    const ch=STATE.rawData.npc.filter(r=>r.player_name===p.name).length;
    const mv=STATE.rawData.behavior.filter(r=>r.player_name===p.name).length;
    const gu=STATE.rawData.gui.filter(r=>r.player_name===p.name).length;
    return'<div class="player-item" onclick="filterByPlayer(\''+escAttr(p.name)+'\')"><span class="player-name">👤 '+escHtml(p.name)+'</span><span class="player-count-badge-sm">'+(ch+mv+gu)+'</span></div>';
  }).join('');
}
function filterByPlayer(name){const s=$('#playerFilter');if(s){s.value=name;STATE.selectedPlayer=name;}STATE.page=1;applyAllFilters();}

// ── EXPORT ──
function setupExport(){$('#exportCSV')?.addEventListener('click',exportCSV);$('#exportJSON')?.addEventListener('click',exportJSON);$('#rowsPerPage')?.addEventListener('change',e=>{STATE.rowsPerPage=parseInt(e.target.value);STATE.page=1;applyAllFilters();});}
function exportCSV(){if(STATE.activeTab==='npc')return;const data=getCurrentRawData();if(!data.length)return;const cols=Object.keys(data[0]);downloadFile('export_'+STATE.activeTab+'.csv',cols.join(',')+'\n'+data.map(r=>cols.map(c=>'"'+String(r[c]||'').replace(/"/g,'""')+'"').join(',')).join('\n'),'text/csv');}
function exportJSON(){const data=STATE.activeTab==='npc'?STATE.rawData.npc:getCurrentRawData();downloadFile('export_'+STATE.activeTab+'.json',JSON.stringify(data,null,2),'application/json');}
function downloadFile(n,c,t){const b=new Blob([c],{type:t}),u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=n;a.click();URL.revokeObjectURL(u);}

// ── FORMAT ──
function formatHeader(c){return c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());}
function formatCell(c,v){if(v==null)return'—';if(c==='timestamp')try{return new Date(v).toLocaleString('id-ID');}catch(e){return String(v);}if(typeof v==='object')return JSON.stringify(v).slice(0,60);return String(v).slice(0,100);}

// ── UTILS ──
function debounce(fn,ms){let t;return function(...args){clearTimeout(t);t=setTimeout(()=>fn.apply(this,args),ms);};}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
init();
