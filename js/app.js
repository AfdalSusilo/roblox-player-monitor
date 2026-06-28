/* ======================================================
   Simulasi Banjir — Player Monitor Dashboard
   Data dari Collector (port 9002) → GitHub → Vercel
   ====================================================== */

const $ = s => document.querySelector(s);
const DATA = {
  npc: [], behavior: [], gui: [],
  players: {}, npcs: {},
  lastUpdate: null,
};

// ── INIT ──
async function init() {
  await loadAll();
  renderAll();
  setInterval(refreshData, 10000);
  updateClock();
}

function updateClock() {
  const now = new Date();
  $('#lastUpdate').textContent = '🕐 ' + now.toLocaleTimeString('id-ID');
}

// ── DATA LOADING ──
async function loadAll() {
  try {
    const [npcRes, behaviorRes, guiRes] = await Promise.all([
      fetch('data/npc_interactions.json').then(r => r.json()).catch(() => []),
      fetch('data/behavior_logs.json').then(r => r.json()).catch(() => []),
      fetch('data/gui_logs.json').then(r => r.json()).catch(() => []),
    ]);
    DATA.npc = Array.isArray(npcRes) ? npcRes : [];
    DATA.behavior = Array.isArray(behaviorRes) ? behaviorRes : [];
    DATA.gui = Array.isArray(guiRes) ? guiRes : [];
    DATA.lastUpdate = new Date();
  } catch(e) {
    console.warn('Load error:', e);
  }
  computeStats();
}

function computeStats() {
  const playerSet = new Set();
  const npcCount = {};
  
  for (const row of DATA.npc) {
    if (row.player_name) playerSet.add(row.player_name);
    if (row.npc_name) {
      npcCount[row.npc_name] = (npcCount[row.npc_name] || 0) + 1;
    }
  }
  for (const row of DATA.behavior) {
    if (row.player_name) playerSet.add(row.player_name);
  }
  for (const row of DATA.gui) {
    if (row.player_name) playerSet.add(row.player_name);
  }
  
  DATA.players = {};
  for (const name of playerSet) {
    const chats = DATA.npc.filter(r => r.player_name === name).length;
    const moves = DATA.behavior.filter(r => r.player_name === name).length;
    const guis = DATA.gui.filter(r => r.player_name === name).length;
    DATA.players[name] = { chats, moves, guis };
  }
  DATA.npcs = Object.entries(npcCount)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 10);
}

// ── REFRESH ──
async function refreshData() {
  await loadAll();
  renderAll();
  updateClock();
}

// ── RENDER ALL ──
function renderAll() {
  renderStats();
  renderChat();
  renderBehavior();
  renderGui();
  renderPlayers();
  renderNpcs();
  renderFilters();
}

// ── STATS ──
function renderStats() {
  $('#statChats').textContent = DATA.npc.length.toLocaleString();
  $('#statMoves').textContent = DATA.behavior.length.toLocaleString();
  $('#statGui').textContent = DATA.gui.length.toLocaleString();
  $('#statPlayers').textContent = Object.keys(DATA.players).length;
  $('#statNpcs').textContent = Object.keys(DATA.npcs).length || 56;
  $('#playerCount').textContent = Object.keys(DATA.players).length + ' pemain';
}

// ── CHAT RENDER ──
function renderChat() {
  const container = $('#chatLog');
  const playerFilter = $('#npcPlayerFilter')?.value || '';
  const npcFilter = $('#npcNameFilter')?.value || '';
  
  let chats = [...DATA.npc].reverse();
  if (playerFilter) chats = chats.filter(r => r.player_name === playerFilter);
  if (npcFilter) chats = chats.filter(r => r.npc_name === npcFilter);
  
  if (chats.length === 0) {
    container.innerHTML = '<div class="empty-state">💬 Belum ada percakapan NPC</div>';
    return;
  }
  
  container.innerHTML = chats.slice(0, 100).map(row => {
    const time = row.timestamp ? new Date(row.timestamp).toLocaleTimeString('id-ID') : '';
    const msg = row.message || '(pesan kosong)';
    return `
      <div class="chat-bubble player">
        <div class="npc-label">🤖 ${escHtml(row.npc_name || 'NPC')}</div>
        <div class="sender">${escHtml(row.player_name || 'Player')}</div>
        <div>${escHtml(msg)}</div>
        <div class="time">${time}</div>
      </div>
    `;
  }).join('');
  
  container.scrollTop = container.scrollHeight;
}

// ── BEHAVIOR TABLE ──
function renderBehavior() {
  const filter = $('#behaviorPlayerFilter')?.value || '';
  let data = [...DATA.behavior].reverse();
  if (filter) data = data.filter(r => r.player_name === filter);
  
  const tbody = $('#behaviorBody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">🏃 Belum ada data pergerakan</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.slice(0, 200).map(row => {
    const time = row.timestamp ? new Date(row.timestamp).toLocaleString('id-ID') : '—';
    const pos = row.position ? `${row.position.x || '?'}, ${row.position.y || '?'}` : '—';
    return `<tr>
      <td>${time}</td>
      <td>${escHtml(row.player_name || '—')}</td>
      <td>(${pos})</td>
    </tr>`;
  }).join('');
}

// ── GUI TABLE ──
function renderGui() {
  const playerFilter = $('#guiPlayerFilter')?.value || '';
  const sectionFilter = $('#guiSectionFilter')?.value || '';
  
  let data = [...DATA.gui].reverse();
  if (playerFilter) data = data.filter(r => r.player_name === playerFilter);
  if (sectionFilter) data = data.filter(r => r.section === sectionFilter);
  
  const tbody = $('#guiBody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">🖥️ Belum ada interaksi GUI</td></tr>';
    return;
  }
  
  tbody.innerHTML = data.slice(0, 200).map(row => {
    const time = row.timestamp ? new Date(row.timestamp).toLocaleString('id-ID') : '—';
    return `<tr>
      <td>${time}</td>
      <td>${escHtml(row.player_name || '—')}</td>
      <td><span class="badge-section">${escHtml(row.section || '—')}</span></td>
      <td>${escHtml(row.element_name || row.input_type || '—')}</td>
      <td>${escHtml(String(row.value || row.form_data || '—').substring(0, 80))}</td>
    </tr>`;
  }).join('');
}

// ── PLAYER LIST ──
function renderPlayers() {
  const container = $('#playerList');
  const entries = Object.entries(DATA.players).sort((a,b) => (b[1].chats + b[1].moves + b[1].guis) - (a[1].chats + a[1].moves + a[1].guis));
  
  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state small">Belum ada pemain</div>';
    return;
  }
  
  container.innerHTML = entries.map(([name, stats]) => `
    <div class="player-item" onclick="filterPlayer('${escAttr(name)}')">
      <span class="player-name">👤 ${escHtml(name)}</span>
      <span class="player-count-badge">${stats.chats + stats.moves + stats.guis} event</span>
    </div>
  `).join('');
}

// ── NPC LIST ──
function renderNpcs() {
  const container = $('#npcList');
  if (DATA.npcs.length === 0) {
    container.innerHTML = '<div class="empty-state small">Belum ada interaksi NPC</div>';
    return;
  }
  
  container.innerHTML = DATA.npcs.map(([name, count]) => `
    <div class="npc-item" onclick="filterNpc('${escAttr(name)}')">
      <span>🤖 ${escHtml(name)}</span>
      <span class="npc-count-badge">${count} chat</span>
    </div>
  `).join('');
}

// ── FILTERS ──
function renderFilters() {
  const names = Object.keys(DATA.players).sort();
  const npcNames = [...new Set(DATA.npc.map(r => r.npc_name).filter(Boolean))].sort();
  const sections = [...new Set(DATA.gui.map(r => r.section).filter(Boolean))].sort();
  
  const playerFilter = $('#npcPlayerFilter');
  const npcFilter = $('#npcNameFilter');
  const behaviorFilter = $('#behaviorPlayerFilter');
  const guiPlayerFilter = $('#guiPlayerFilter');
  const guiSectionFilter = $('#guiSectionFilter');
  
  if (playerFilter) {
    const cur = playerFilter.value;
    playerFilter.innerHTML = '<option value="">Semua Pemain</option>' +
      names.map(n => `<option value="${escAttr(n)}" ${n === cur ? 'selected' : ''}>${escHtml(n)}</option>`).join('');
  }
  if (npcFilter) {
    const cur = npcFilter.value;
    npcFilter.innerHTML = '<option value="">Semua NPC</option>' +
      npcNames.map(n => `<option value="${escAttr(n)}" ${n === cur ? 'selected' : ''}>${escHtml(n)}</option>`).join('');
  }
  if (behaviorFilter) {
    const cur = behaviorFilter.value;
    behaviorFilter.innerHTML = '<option value="">Semua Pemain</option>' +
      names.map(n => `<option value="${escAttr(n)}" ${n === cur ? 'selected' : ''}>${escHtml(n)}</option>`).join('');
  }
  if (guiPlayerFilter) {
    const cur = guiPlayerFilter.value;
    guiPlayerFilter.innerHTML = '<option value="">Semua Pemain</option>' +
      names.map(n => `<option value="${escAttr(n)}" ${n === cur ? 'selected' : ''}>${escHtml(n)}</option>`).join('');
  }
  if (guiSectionFilter) {
    const cur = guiSectionFilter.value;
    guiSectionFilter.innerHTML = '<option value="">Semua Section</option>' +
      sections.map(s => `<option value="${escAttr(s)}" ${s === cur ? 'selected' : ''}>${escHtml(s)}</option>`).join('');
  }
  
  // Attach change listeners
  if (playerFilter && !playerFilter._bound) {
    playerFilter._bound = true;
    playerFilter.addEventListener('change', renderChat);
  }
  if (npcFilter && !npcFilter._bound) {
    npcFilter._bound = true;
    npcFilter.addEventListener('change', renderChat);
  }
  if (behaviorFilter && !behaviorFilter._bound) {
    behaviorFilter._bound = true;
    behaviorFilter.addEventListener('change', renderBehavior);
  }
  if (guiPlayerFilter && !guiPlayerFilter._bound) {
    guiPlayerFilter._bound = true;
    guiPlayerFilter.addEventListener('change', renderGui);
  }
  if (guiSectionFilter && !guiSectionFilter._bound) {
    guiSectionFilter._bound = true;
    guiSectionFilter.addEventListener('change', renderGui);
  }
}

// ── CLICK HANDLERS ──
function filterPlayer(name) {
  const pf = $('#npcPlayerFilter');
  if (pf) { pf.value = name; renderChat(); }
  const bf = $('#behaviorPlayerFilter');
  if (bf) { bf.value = name; renderBehavior(); }
  const gf = $('#guiPlayerFilter');
  if (gf) { gf.value = name; renderGui(); }
}
function filterNpc(name) {
  const nf = $('#npcNameFilter');
  if (nf) { nf.value = name; renderChat(); }
}

// ── TABS ──
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
    });
  });
});

// ── UTILS ──
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── START ──
init();
