/* ======================================================
   Simulasi Banjir — Player Monitor Dashboard
   Fitur: Behavior, Chat NPC, GUI Logs, Overview, Minimap
   ====================================================== */

const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

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
  liveSeconds:0,liveTimerId:null,
};

const TAB_META={
  behavior:{filterKey:'event_type',tableId:'dataTable',headId:'tableHead',bodyId:'tableBody',rowsId:'rowsShown',pagId:'pagination'},
  gui:{filterKey:'section',tableId:'dataTableGui',headId:'tableHeadGui',bodyId:'tableBodyGui',rowsId:'rowsShownGui',pagId:'paginationGui'},
  npc:{filterKey:'npc_name'},
  overview:{filterKey:null},
};

// ── INIT ──
async function init(){
  updateClock();
  setInterval(updateClock,1000);
  await loadAllData();
  discoverPlayers();
  setupFilters();
  setupTabs();
  setupSearch();
  setupExport();
  setupRefresh();
  startLiveTimer();
  switchToTab('behavior');
}

function updateClock(){
  const now=new Date();
  if($('#currentDate')) $('#currentDate').textContent=now.toLocaleDateString('id-ID',{weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

// ── DATA LOADING ──
async function loadAllData(){
  const files={behavior:'data/behavior_logs.json',gui:'data/gui_logs.json',npc:'data/npc_interactions.json'};
  for(const type of['behavior','gui','npc']){
    try{
      STATE.rawData[type]=await fetchJSON(files[type]);
      console.log('✅',type,STATE.rawData[type].length,'rows');
    }catch(e){
      console.warn('⚠️',type,'fallback sample');
      try{STATE.rawData[type]=await fetchJSON('data/'+type+'_logs_sample.json');}catch(e2){STATE.rawData[type]=[];}
    }
  }
}
async function fetchJSON(url){
  const res=await fetch(url);
  if(!res.ok)throw new Error('HTTP '+res.status);
  return res.json();
}

// ── PLAYER DISCOVERY ──
function discoverPlayers(){
  const playerMap=new Map();
  for(const type of['behavior','gui','npc']){
    for(const row of STATE.rawData[type]){
      const id=row.player_id;
      if(!id)continue;
      if(!playerMap.has(id)){
        playerMap.set(id,{id,name:row.player_name||'Unknown',firstSeen:row.timestamp||'',lastSeen:row.timestamp||''});
      }
      const p=playerMap.get(id);
      if(row.timestamp){
        if(!p.firstSeen||row.timestamp<p.firstSeen)p.firstSeen=row.timestamp;
        if(!p.lastSeen||row.timestamp>p.lastSeen)p.lastSeen=row.timestamp;
      }
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
  for(const type of['behavior','gui','npc']){
    for(const row of STATE.rawData[type]){if(row.timestamp)return row.timestamp.slice(0,10);}
  }
  return new Date().toISOString().slice(0,10);
}
function setupFilters(){
  const sel=$('#playerFilter');
  sel.innerHTML='<option value="">Semua Player</option>'+STATE.allPlayers.map(p=>'<option value="'+escAttr(p.id)+'">'+escHtml(p.name)+' ('+p.id+')</option>').join('');
  sel.addEventListener('change',()=>{STATE.selectedPlayer=sel.value;});
  $('#dateLive').addEventListener('change',()=>{STATE.dateLive=$('#dateLive').value;});
  const today=new Date().toISOString().slice(0,10);
  $('#dateLive').value=today;STATE.dateLive=today;
  $('#applyFiltersBtn').addEventListener('click',()=>{
    STATE.selectedPlayer=$('#playerFilter').value;
    STATE.dateLive=$('#dateLive').value;
    STATE.page=1;
    applyAllFilters();
  });
  $('#resetFiltersBtn').addEventListener('click',resetFilters);
}
function resetFilters(){
  $('#playerFilter').value='';
  STATE.selectedPlayer='';
  const dataDate=findDataDate();
  $('#dateLive').value=dataDate;STATE.dateLive=dataDate;
  $('#filterType').value='';STATE.eventType='';
  STATE.search='';$('#searchInput').value='';
  STATE.page=1;
  applyAllFilters();
}

// ── TABS ──
function setupTabs(){
  $$('.tab').forEach(btn=>{btn.addEventListener('click',()=>switchToTab(btn.dataset.tab));});
}
function switchToTab(tabName){
  STATE.activeTab=tabName;STATE.page=1;STATE.eventType='';
  $$('.tab').forEach(b=>b.classList.remove('active'));
  const btn=document.querySelector('.tab[data-tab="'+tabName+'"]');
  if(btn)btn.classList.add('active');
  $$('.tab-view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+tabName)?.classList.add('active');
  updateEventTypeFilter();
  applyAllFilters();
}

// ── SEARCH ──
function setupSearch(){
  $('#searchInput').addEventListener('input',debounce(e=>{
    STATE.search=e.target.value.toLowerCase();STATE.page=1;applyAllFilters();
  },250));
}
function setupEventTypeFilter(){
  $('#filterType').addEventListener('change',e=>{STATE.eventType=e.target.value;STATE.page=1;applyAllFilters();});
}
function updateEventTypeFilter(){
  if(STATE.activeTab==='overview'||STATE.activeTab==='npc')return;
  const data=getCurrentRawData();
  const sel=$('#filterType');
  sel.innerHTML='<option value="">Semua</option>';
  const key=TAB_META[STATE.activeTab]?.filterKey;
  if(!key)return;
  const uniq=[...new Set(data.map(r=>r[key]).filter(Boolean))].sort();
  uniq.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=String(v).slice(0,50);sel.appendChild(o);});
}

// ── REFRESH ──
function setupRefresh(){
  $('#refreshInterval').addEventListener('change',e=>{
    STATE.refreshInterval=parseInt(e.target.value);
    clearInterval(STATE.refreshTimer);
    if(STATE.refreshInterval>0){
      STATE.refreshTimer=setInterval(refreshData,STATE.refreshInterval*1000);
    }
  });
  if(STATE.refreshInterval>0){STATE.refreshTimer=setInterval(refreshData,STATE.refreshInterval*1000);}
}
async function refreshData(){
  await loadAllData();
  discoverPlayers();
  applyAllFilters();
  updateRefreshNote();
}
function updateRefreshNote(){
  const now=new Date();
  const note='🔄 '+now.toLocaleTimeString('id-ID')+' · '+STATE.refreshInterval+'s';
  ['refreshNote','refreshNoteGui'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=note;});
  if($('#footerUpdate'))$('#footerUpdate').textContent='Terakhir: '+now.toLocaleTimeString('id-ID');
}
function startLiveTimer(){
  STATE.liveTimerId=setInterval(()=>{
    STATE.liveSeconds++;
    const m=Math.floor(STATE.liveSeconds/60),s=STATE.liveSeconds%60;
    if($('#liveTimer'))$('#liveTimer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  },1000);
}

// ── DATA HELPERS ──
function getCurrentRawData(){
  if(STATE.activeTab==='overview'||STATE.activeTab==='npc')return[];
  return STATE.rawData[STATE.activeTab]||[];
}
function applyAllFilters(){
  if(STATE.activeTab==='overview'){STATE.filtered=[];renderAll();return;}
  if(STATE.activeTab==='npc'){renderAll();return;}
  let data=[...getCurrentRawData()];
  if(STATE.selectedPlayer)data=data.filter(r=>String(r.player_id)===STATE.selectedPlayer);
  if(STATE.dateLive)data=data.filter(r=>!r.timestamp||r.timestamp.slice(0,10)===STATE.dateLive);
  if(STATE.eventType){
    const key=TAB_META[STATE.activeTab]?.filterKey;
    if(key)data=data.filter(r=>r[key]===STATE.eventType);
  }
  if(STATE.search)data=data.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(STATE.search)));
  if(STATE.sortCol){
    data.sort((a,b)=>{const va=a[STATE.sortCol]??'',vb=b[STATE.sortCol]??'';const cmp=va<vb?-1:va>vb?1:0;return STATE.sortDir==='asc'?cmp:-cmp;});
  }
  STATE.filtered=data;
  renderAll();
}
function sortBy(col){
  if(STATE.sortCol===col){STATE.sortDir=STATE.sortDir==='asc'?'desc':'asc';}else{STATE.sortCol=col;STATE.sortDir='asc';}
  applyAllFilters();
}

// ── RENDER ALL ──
function renderAll(){
  updateStats();
  updatePlayerBadge();
  updateRefreshNote();
  if(STATE.activeTab==='overview')renderOverview();
  else if(STATE.activeTab==='npc')renderNpcChat();
  else renderTableView();
  drawMinimap();
}

function updateStats(){
  const npc=STATE.rawData.npc||[],bhv=STATE.rawData.behavior||[],gui=STATE.rawData.gui||[];
  if($('#statChats'))$('#statChats').textContent=npc.length.toLocaleString();
  if($('#statMoves'))$('#statMoves').textContent=bhv.length.toLocaleString();
  if($('#statGui'))$('#statGui').textContent=gui.length.toLocaleString();
  if($('#statPlayers'))$('#statPlayers').textContent=STATE.allPlayers.length;
}
function updatePlayerBadge(){
  const count=STATE.selectedPlayer
    ?STATE.filtered.length
    :STATE.rawData.behavior.length+STATE.rawData.gui.length+STATE.rawData.npc.length;
  if($('#playerCountBadge'))$('#playerCountBadge').textContent=STATE.allPlayers.length+' Pemain';
}

// ── TABLE VIEW (behavior, gui) ──
function renderTableView(){
  const tab=STATE.activeTab;
  const meta=TAB_META[tab];
  const filtered=STATE.filtered;
  const start=(STATE.page-1)*STATE.rowsPerPage;
  const end=Math.min(start+STATE.rowsPerPage,filtered.length);
  const pageData=filtered.slice(start,end);

  const tableId=meta.tableId,headId=meta.headId,bodyId=meta.bodyId,rowsId=meta.rowsId,pagId=meta.pagId;

  if(filtered.length===0){
    const icon={behavior:'🏃',gui:'🖥️'}[tab]||'📭';
    document.getElementById(headId).innerHTML='';
    document.getElementById(bodyId).innerHTML='<tr><td colspan="99" style="text-align:center;padding:48px;color:var(--text2);">'+icon+' Tidak ada data untuk <b>'+(STATE.dateLive||'semua')+'</b>'+ (STATE.selectedPlayer?' · Player: '+STATE.selectedPlayer:'')+'</td></tr>';
    document.getElementById(rowsId).textContent='Menampilkan 0 dari 0';
    document.getElementById(pagId).innerHTML='';
    return;
  }

  const cols=Object.keys(filtered[0]).filter(c=>!c.startsWith('_'));
  document.getElementById(headId).innerHTML='<tr>'+cols.map(c=>'<th onclick="sortBy(\''+c+'\')" title="Klik sort">'+formatHeader(c)+'<span class="sort-arrow">'+(STATE.sortCol===c?(STATE.sortDir==='asc'?'▲':'▼'):'')+'</span></th>').join('')+'</tr>';
  document.getElementById(bodyId).innerHTML=pageData.map(row=>'<tr>'+cols.map(c=>{const val=row[c];const cls=cellClass(c,val);return '<td'+(cls?' class="'+cls+'"':'')+' title="'+escAttr(String(val??''))+'">'+formatCell(c,val)+'</td>';}).join('')+'</tr>').join('');
  document.getElementById(rowsId).textContent='Menampilkan '+(start+1)+'–'+end+' dari '+filtered.length.toLocaleString();

  const totalPages=Math.ceil(filtered.length/STATE.rowsPerPage);
  const pagEl=document.getElementById(pagId);
  if(totalPages<=1){pagEl.innerHTML=totalPages===1?'<span style="color:var(--text2);font-size:0.72rem;">Hal 1 dari 1</span>':'';}
  else pagEl.innerHTML=buildPaginationHTML(totalPages);
}
function buildPaginationHTML(totalPages){
  let html='';
  html+='<button class="page-btn" '+(STATE.page<=1?'disabled':'')+' onclick="goPage('+(STATE.page-1)+')">‹</button>';
  const maxVis=7;
  const pages=[];
  if(totalPages<=maxVis){for(let i=1;i<=totalPages;i++)pages.push(i);}
  else{
    if(STATE.page<=4){pages.push(1,2,3,4,5);pages.push('…',totalPages);}
    else if(STATE.page>=totalPages-3){pages.push(1,'…');for(let i=totalPages-4;i<=totalPages;i++)pages.push(i);}
    else{pages.push(1,'…');for(let i=STATE.page-2;i<=STATE.page+2;i++)pages.push(i);pages.push('…',totalPages);}
  }
  pages.forEach(p=>{if(p==='…')html+='<span class="page-btn" disabled>…</span>';else html+='<button class="page-btn'+(p===STATE.page?' active':'')+'" onclick="goPage('+p+')">'+p+'</button>';});
  html+='<button class="page-btn" '+(STATE.page>=totalPages?'disabled':'')+' onclick="goPage('+(STATE.page+1)+')">›</button>';
  return html;
}
function goPage(p){STATE.page=p;applyAllFilters();}

// ── NPC CHAT ──
function renderNpcChat(){
  const npc=STATE.rawData.npc||[];
  let chats=[...npc].reverse();
  if(STATE.selectedPlayer)chats=chats.filter(r=>String(r.player_id)===STATE.selectedPlayer);
  if(STATE.dateLive)chats=chats.filter(r=>!r.timestamp||r.timestamp.slice(0,10)===STATE.dateLive);
  if(STATE.search)chats=chats.filter(r=>Object.values(r).some(v=>v!=null&&String(v).toLowerCase().includes(STATE.search)));
  
  const box=$('#chatLogBox');
  if(!box)return;
  if(chats.length===0){box.innerHTML='<div class="empty-state">💬 Belum ada percakapan NPC</div>';return;}
  
  const start=(STATE.page-1)*STATE.rowsPerPage;
  const end=Math.min(start+STATE.rowsPerPage,chats.length);
  const pageData=chats.slice(start,end);
  
  box.innerHTML=pageData.map(row=>{
    const time=row.timestamp?new Date(row.timestamp).toLocaleTimeString('id-ID'):'';
    const msg=row.message||'(kosong)';
    return '<div class="chat-bubble player"><div class="npc-label">🤖 '+escHtml(row.npc_name||'NPC')+'</div><div class="sender">'+escHtml(row.player_name||'Player')+'</div><div>'+escHtml(msg)+'</div><div class="time">'+time+'</div></div>';
  }).join('');
  box.scrollTop=box.scrollHeight;

  if($('#rowsShownNpc'))$('#rowsShownNpc').textContent='Menampilkan '+(start+1)+'–'+end+' dari '+chats.length.toLocaleString();
  const totalPages=Math.ceil(chats.length/STATE.rowsPerPage);
  const pagEl=$('#paginationNpc');
  if(pagEl){
    if(totalPages<=1)pagEl.innerHTML='';
    else pagEl.innerHTML=buildPaginationHTML(totalPages);
  }
}

// ── OVERVIEW ──
function renderOverview(){
  const npc=STATE.rawData.npc||[],bhv=STATE.rawData.behavior||[],gui=STATE.rawData.gui||[];
  
  // Player list
  const playerMap={};
  for(const row of[...npc,...bhv,...gui]){
    const name=row.player_name||'Unknown';
    if(!playerMap[name])playerMap[name]={name,chats:0,moves:0,guis:0};
    if(row.npc_name)playerMap[name].chats++;
    else if(row.position)playerMap[name].moves++;
    else playerMap[name].guis++;
  }
  const players=Object.values(playerMap).sort((a,b)=>(b.chats+b.moves+b.guis)-(a.chats+a.moves+a.guis));
  
  if($('#playerListPanel')){
    if(players.length===0)$('#playerListPanel').innerHTML='<div class="empty-state" style="padding:20px">Belum ada pemain</div>';
    else $('#playerListPanel').innerHTML=players.slice(0,15).map(p=>'<div class="player-item" onclick="filterByPlayer(\''+escAttr(p.name)+'\')"><span class="player-name">👤 '+escHtml(p.name)+'</span><span class="player-count-badge-sm">'+(p.chats+p.moves+p.guis)+'</span></div>').join('');
  }

  // NPC list
  const npcCount={};
  for(const row of npc){if(row.npc_name)npcCount[row.npc_name]=(npcCount[row.npc_name]||0)+1;}
  const npcs=Object.entries(npcCount).sort((a,b)=>b[1]-a[1]);
  if($('#npcListPanel')){
    if(npcs.length===0)$('#npcListPanel').innerHTML='<div class="empty-state" style="padding:20px">Belum ada interaksi</div>';
    else $('#npcListPanel').innerHTML=npcs.slice(0,15).map(([n,c])=>'<div class="npc-item"><span>🤖 '+escHtml(n)+'</span><span class="npc-count-badge">'+c+' chat</span></div>').join('');
  }

  // Activity chart
  drawActivityChart(bhv,npc,gui);
}

function drawActivityChart(bhv,npc,gui){
  const canvas=$('#activityChart');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const w=canvas.parentElement.clientWidth-28;
  canvas.width=w;canvas.height=250;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  // Aggregate per 10-minute buckets
  const buckets={};
  const all=[...bhv,...npc,...gui];
  for(const row of all){
    if(!row.timestamp)continue;
    const t=row.timestamp.slice(0,16);
    if(!buckets[t])buckets[t]={bhv:0,npc:0,gui:0};
    if(row.position)buckets[t].bhv++;
    else if(row.npc_name)buckets[t].npc++;
    else buckets[t].gui++;
  }
  
  const keys=Object.keys(buckets).sort();
  if(keys.length<2){ctx.fillStyle='#8b8fa3';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('📈 Butuh lebih banyak data untuk grafik',canvas.width/2,canvas.height/2);return;}
  
  const pad=40,plotW=canvas.width-pad*2,plotH=canvas.height-pad*2;
  const maxVal=Math.max(1,...keys.map(k=>buckets[k].bhv+buckets[k].npc+buckets[k].gui));
  
  // Grid
  ctx.strokeStyle='#2e3242';ctx.lineWidth=0.5;
  for(let i=0;i<=4;i++){const y=pad+plotH*(1-i/4);ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(canvas.width-pad,y);ctx.stroke();}
  
  // Bars
  const barW=Math.max(2,Math.min(12,plotW/keys.length-2));
  keys.forEach((k,i)=>{
    const x=pad+i*(plotW/keys.length)+barW/2;
    const b=buckets[k];
    const hB=(b.bhv/maxVal)*plotH,hN=(b.npc/maxVal)*plotH,hG=(b.gui/maxVal)*plotH;
    
    ctx.fillStyle='#5865f2';ctx.fillRect(x,pad+plotH-hB,barW,hB);
    ctx.fillStyle='#f59e0b';ctx.fillRect(x,pad+plotH-hB-hN,barW,hN);
    ctx.fillStyle='#06b6d4';ctx.fillRect(x,pad+plotH-hB-hN-hG,barW,hG);
  });
  
  // X labels (every ~8)
  keys.forEach((k,i)=>{if(i%Math.ceil(keys.length/8)===0||i===keys.length-1){ctx.fillStyle='#8b8fa3';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText(k.slice(11,16),pad+i*(plotW/keys.length)+barW/2,canvas.height-8);}});
  
  // Legend
  ctx.fillStyle='#5865f2';ctx.fillRect(pad+10,10,10,10);
  ctx.fillStyle='#e1e4ed';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText('Behavior',pad+24,20);
  ctx.fillStyle='#f59e0b';ctx.fillRect(pad+100,10,10,10);
  ctx.fillText('NPC Chat',pad+114,20);
  ctx.fillStyle='#06b6d4';ctx.fillRect(pad+200,10,10,10);
  ctx.fillText('GUI',pad+214,20);
}

// ── MINIMAP ──
function drawMinimap(){
  const canvas=$('#minimapCanvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const size=280;
  canvas.width=size;canvas.height=size;
  ctx.clearRect(0,0,size,size);
  
  // Background
  ctx.fillStyle='#121520';
  ctx.fillRect(0,0,size,size);
  
  // Grid
  ctx.strokeStyle='#1e2438';ctx.lineWidth=0.5;
  for(let i=0;i<=size;i+=size/10){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,size);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(size,i);ctx.stroke();}
  
  // Get player positions from behavior data
  const positions={};
  const now=new Date();
  for(const row of(STATE.rawData.behavior||[])){
    const name=row.player_name||'unknown';
    const pos=row.position;
    if(!pos||pos.x==null||pos.y==null)continue;
    if(!positions[name]||(row.timestamp>positions[name].timestamp)){
      positions[name]={x:pos.x,y:pos.y,timestamp:row.timestamp};
    }
  }
  
  const entries=Object.entries(positions);
  if(entries.length===0){
    ctx.fillStyle='#8b8fa3';ctx.font='13px system-ui';ctx.textAlign='center';
    ctx.fillText('🗺️ Menunggu data posisi',size/2,size/2);
    ctx.font='10px system-ui';
    ctx.fillText('Playtest untuk melihat minimap',size/2,size/2+20);
    return;
  }
  
  // Calculate bounds with padding
  const padding=30;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const[,p] of entries){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  
  const rangeX=maxX-minX||10,rangeY=maxY-minY||10;
  const scale=Math.min((size-padding*2)/rangeX,(size-padding*2)/rangeY);
  const offX=(size-(rangeX*scale))/2-minX*scale;
  const offY=(size-(rangeY*scale))/2-minY*scale;
  
  // Axis labels
  ctx.fillStyle='#4a5068';ctx.font='8px monospace';ctx.textAlign='center';
  ctx.fillText(Math.round(minX)+' , '+Math.round(maxY),padding,size-padding+14);
  ctx.fillText(Math.round(maxX)+' , '+Math.round(maxY),size-padding,size-padding+14);
  ctx.fillText(Math.round(minX)+' , '+Math.round(minY),padding,12);
  
  // Draw players
  for(const[name,p] of entries){
    const px=p.x*scale+offX,py=size-(p.y*scale+offY);
    if(px<5||px>size-5||py<5||py>size-5)continue;
    
    // Determine color by recency
    const age=(now-new Date(p.timestamp))/1000/60; // minutes
    let color='#22c55e',glow='rgba(34,197,94,.6)',radius=5;
    if(age>15){color='#8b8fa3';glow='rgba(139,143,163,.3)';radius=3;}
    else if(age>5){color='#f59e0b';glow='rgba(245,158,11,.4)';radius=4;}
    
    // Glow
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(px,py,radius+3,0,Math.PI*2);ctx.fill();
    // Dot
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fill();
    // Label
    ctx.fillStyle='#e1e4ed';ctx.font='9px system-ui';ctx.textAlign='center';
    ctx.fillText(name.slice(0,10),px,py-10);
  }
  
  // Also draw player list on minimap right side
  renderPlayerList();
}

function renderPlayerList(){
  const container=$('#playerList');
  if(!container)return;
  const players=STATE.allPlayers;
  if(players.length===0){container.innerHTML='<div class="empty-state" style="padding:15px">Belum ada pemain</div>';return;}
  container.innerHTML=players.slice(0,20).map(p=>{
    const chats=STATE.rawData.npc.filter(r=>r.player_name===p.name).length;
    const moves=STATE.rawData.behavior.filter(r=>r.player_name===p.name).length;
    const guis=STATE.rawData.gui.filter(r=>r.player_name===p.name).length;
    return '<div class="player-item" onclick="filterByPlayer(\''+escAttr(p.name)+'\')"><span class="player-name">👤 '+escHtml(p.name)+'</span><span class="player-count-badge-sm">'+(chats+moves+guis)+'</span></div>';
  }).join('');
}

function filterByPlayer(name){
  const sel=$('#playerFilter');if(sel){sel.value=STATE.allPlayers.find(p=>p.name===name)?.id||'';STATE.selectedPlayer=sel.value;}
  STATE.page=1;applyAllFilters();
}

// ── EXPORT ──
function setupExport(){
  $('#exportCSV')?.addEventListener('click',exportCSV);
  $('#exportJSON')?.addEventListener('click',exportJSON);
  document.getElementById('rowsPerPage')?.addEventListener('change',e=>{STATE.rowsPerPage=parseInt(e.target.value);STATE.page=1;applyAllFilters();});
}
function exportCSV(){
  if(STATE.activeTab==='npc')return;
  const data=getCurrentRawData();
  if(data.length===0)return;
  const cols=Object.keys(data[0]);
  const csv=cols.join(',')+'\n'+data.map(r=>cols.map(c=>'"'+String(r[c]||'').replace(/"/g,'""')+'"').join(',')).join('\n');
  downloadFile('export_'+STATE.activeTab+'.csv',csv,'text/csv');
}
function exportJSON(){
  const data=STATE.activeTab==='npc'?STATE.rawData.npc:getCurrentRawData();
  downloadFile('export_'+STATE.activeTab+'.json',JSON.stringify(data,null,2),'application/json');
}
function downloadFile(name,content,type){
  const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}

// ── FORMAT HELPERS ──
function formatHeader(c){return c.replace(/_/g,' ').replace(/\b\w/g,l=>l.toUpperCase());}
function formatCell(c,v){
  if(v==null)return '—';
  if(c==='timestamp'||c==='last_push')try{return new Date(v).toLocaleString('id-ID');}catch(e){return String(v);}
  if(typeof v==='object')return JSON.stringify(v).slice(0,60);
  return String(v).slice(0,100);
}
function cellClass(c,v){
  if(c==='section'||c==='npc_name')return 'badge-section';
  return '';
}

// ── UTILS ──
function debounce(fn,ms){let t;return function(...args){clearTimeout(t);t=setTimeout(()=>fn.apply(this,args),ms);};}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// ── START ──
init();
