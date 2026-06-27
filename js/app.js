/* ======================================================
   Roblox Player Monitor — v3.0
   Clear tab switching · Separate views per tab · Content header
   Tanpa Database · Live Saat Dibuka
   ====================================================== */

// ── TAB METADATA ──
const TAB_META = {
  behavior: {
    icon: '🏃', title: 'Behavior Logs', desc: 'Log pergerakan dan event player di dalam game',
    statEventsLabel: 'Unique Events', filterKey: 'event_type',
  },
  gui: {
    icon: '🖥️', title: 'GUI Logs', desc: 'Log interaksi antarmuka, form, dan checklist player',
    statEventsLabel: 'UI Elements', filterKey: 'ui_element',
  },
  npc: {
    icon: '💬', title: 'NPC Interactions', desc: 'Log percakapan antara player dan NPC',
    statEventsLabel: 'NPC Targets', filterKey: 'npc_target',
  },
  overview: {
    icon: '📊', title: 'Overview', desc: 'Ringkasan aktivitas seluruh player dan distribusi event',
    statEventsLabel: 'Event Types', filterKey: null,
  },
};

// ── STATE ──
const STATE = {
  activeTab: 'behavior',
  rawData: { behavior: [], gui: [], npc: [] },
  filtered: [],
  allPlayers: [],
  selectedPlayer: '',
  dateLive: '',
  eventType: '',
  search: '',
  page: 1,
  rowsPerPage: 50,
  sortCol: null,
  sortDir: 'asc',
  refreshInterval: 30,
  refreshTimer: null,
  liveSeconds: 0,
  liveTimerId: null,
  charts: {},
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ── INIT ──
async function init() {
  updateClock();
  setInterval(updateClock, 1000);

  await loadAllData();
  discoverPlayers();
  setupFilters();
  setupTabs();
  setupSearch();
  setupEventTypeFilter();
  setupExport();
  setupPagination();
  setupRefresh();
  startLiveTimer();
  switchToTab('behavior');
}

function updateClock() {
  const now = new Date();
  $('#currentDate').textContent = now.toLocaleDateString('id-ID', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── DATA LOADING ──
async function loadAllData() {
  const types = ['behavior', 'gui', 'npc'];
  const files = {
    behavior: 'data/behavior_logs.json',
    gui: 'data/gui_logs.json',
    npc: 'data/npc_interactions.json',
  };
  for (const type of types) {
    try {
      STATE.rawData[type] = await fetchJSON(files[type]);
      console.log(`✅ ${type}: ${STATE.rawData[type].length} rows`);
    } catch (e) {
      console.warn(`⚠️ ${type}, fallback sample`);
      try {
        STATE.rawData[type] = await fetchJSON(`data/${type}_logs_sample.json`);
      } catch (e2) {
        STATE.rawData[type] = [];
      }
    }
  }
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── PLAYER DISCOVERY ──
function discoverPlayers() {
  const playerMap = new Map();
  for (const type of ['behavior', 'gui', 'npc']) {
    for (const row of STATE.rawData[type]) {
      const id = row.player_id;
      if (!id) continue;
      if (!playerMap.has(id)) {
        playerMap.set(id, {
          id, name: row.player_name || 'Unknown',
          counts: { behavior: 0, gui: 0, npc: 0 },
          firstSeen: row.timestamp || '',
          lastSeen: row.timestamp || '',
        });
      }
      const p = playerMap.get(id);
      p.counts[type] = (p.counts[type] || 0) + 1;
      if (row.timestamp) {
        if (!p.firstSeen || row.timestamp < p.firstSeen) p.firstSeen = row.timestamp;
        if (!p.lastSeen || row.timestamp > p.lastSeen) p.lastSeen = row.timestamp;
      }
    }
  }
  STATE.allPlayers = [...playerMap.values()].sort((a, b) =>
    (b.counts.behavior + b.counts.gui + b.counts.npc) -
    (a.counts.behavior + a.counts.gui + a.counts.npc)
  );
  console.log(`👥 ${STATE.allPlayers.length} players`);
}

// ── FILTER SETUP ──
function setupFilters() {
  const sel = $('#playerFilter');
  sel.innerHTML = '<option value="">Semua Player</option>' +
    STATE.allPlayers.map(p => `<option value="${escAttr(p.id)}">${escHtml(p.name)} (${p.id})</option>`).join('');
  sel.addEventListener('change', () => { STATE.selectedPlayer = sel.value; });

  $('#dateLive').addEventListener('change', () => { STATE.dateLive = $('#dateLive').value; });

  // Set today's date as default — NOT from database
  const today = new Date().toISOString().slice(0, 10);
  $('#dateLive').value = today;
  STATE.dateLive = today;

  $('#applyFiltersBtn').addEventListener('click', () => {
    STATE.selectedPlayer = $('#playerFilter').value;
    STATE.dateLive = $('#dateLive').value;
    STATE.page = 1;
    applyAllFilters();
    showToast('✅ Filter diterapkan');
  });

  $('#resetFiltersBtn').addEventListener('click', resetFilters);
}

function resetFilters() {
  $('#playerFilter').value = '';
  STATE.selectedPlayer = '';
  const today = new Date().toISOString().slice(0, 10);
  $('#dateLive').value = today;
  STATE.dateLive = today;
  $('#filterType').value = '';
  STATE.eventType = '';
  STATE.search = '';
  $('#searchInput').value = '';
  STATE.page = 1;
  applyAllFilters();
  showToast('🔄 Filter direset');
}

// ── TABS ──
function setupTabs() {
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      switchToTab(btn.dataset.tab);
    });
  });
}

function switchToTab(tabName) {
  STATE.activeTab = tabName;
  STATE.page = 1;
  STATE.eventType = '';
  STATE.search = '';
  $('#searchInput').value = '';
  $('#filterType').value = '';

  // Update tab buttons
  $$('.tab').forEach(b => b.classList.remove('active'));
  const activeTabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (activeTabBtn) activeTabBtn.classList.add('active');

  // Update content header
  const meta = TAB_META[tabName];
  $('#tabContentIcon').textContent = meta.icon;
  $('#tabContentTitle').textContent = meta.title;
  $('#tabContentDesc').textContent = meta.desc;
  $('#statEventsLabel').textContent = meta.statEventsLabel;

  // Update badge count
  const rawCount = STATE.rawData[tabName] ? STATE.rawData[tabName].length : 0;
  $('#tabContentBadge').textContent = rawCount.toLocaleString() + ' baris';

  // Hide all tab views, show active
  $$('.tab-view').forEach(v => v.classList.remove('active'));
  const viewEl = document.getElementById(`view-${tabName}`);
  if (viewEl) viewEl.classList.add('active');

  updateEventTypeFilter();
  applyAllFilters();
}

// ── SEARCH ──
function setupSearch() {
  $('#searchInput').addEventListener('input', debounce((e) => {
    STATE.search = e.target.value.toLowerCase();
    STATE.page = 1;
    applyAllFilters();
  }, 250));
}

// ── EVENT TYPE FILTER ──
function setupEventTypeFilter() {
  $('#filterType').addEventListener('change', (e) => {
    STATE.eventType = e.target.value;
    STATE.page = 1;
    applyAllFilters();
  });
}

function updateEventTypeFilter() {
  if (STATE.activeTab === 'overview') return;
  const data = getCurrentRawData();
  const sel = $('#filterType');
  sel.innerHTML = '<option value="">Semua Event</option>';
  const key = TAB_META[STATE.activeTab].filterKey;
  if (!key) return;
  const uniq = [...new Set(data.map(r => r[key]).filter(Boolean))].sort();
  uniq.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = String(v).slice(0, 50);
    sel.appendChild(opt);
  });
}

// ── REFRESH ──
function setupRefresh() {
  $('#refreshInterval').addEventListener('change', (e) => {
    STATE.refreshInterval = parseInt(e.target.value);
    clearInterval(STATE.refreshTimer);
    if (STATE.refreshInterval > 0) {
      STATE.refreshTimer = setInterval(refreshData, STATE.refreshInterval * 1000);
      showToast(`🔄 Auto-refresh: ${STATE.refreshInterval}s`);
    } else {
      showToast('⏸️ Auto-refresh: Mati');
    }
  });
  if (STATE.refreshInterval > 0) {
    STATE.refreshTimer = setInterval(refreshData, STATE.refreshInterval * 1000);
  }
}

async function refreshData() {
  console.log('🔄 Refreshing data...');
  await loadAllData();
  discoverPlayers();
  applyAllFilters();
  updateRefreshNote();
}

function updateRefreshNote() {
  const now = new Date();
  const note = `Data diperbarui: ${now.toLocaleTimeString('id-ID')} · Auto-refresh: ${STATE.refreshInterval}s`;
  ['refreshNote', 'refreshNoteGui', 'refreshNoteNpc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = note;
  });
}

// ── LIVE TIMER ──
function startLiveTimer() {
  STATE.liveTimerId = setInterval(() => {
    STATE.liveSeconds++;
    const m = Math.floor(STATE.liveSeconds / 60);
    const s = STATE.liveSeconds % 60;
    $('#liveTimer').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, 1000);
}

// ── DATA HELPERS ──
function getCurrentRawData() {
  if (STATE.activeTab === 'overview') return [];
  return STATE.rawData[STATE.activeTab] || [];
}

function applyAllFilters() {
  if (STATE.activeTab === 'overview') {
    STATE.filtered = [];
    renderAll();
    return;
  }

  let data = [...getCurrentRawData()];

  if (STATE.selectedPlayer) {
    data = data.filter(r => String(r.player_id) === STATE.selectedPlayer);
  }
  if (STATE.dateLive) {
    data = data.filter(r => {
      if (!r.timestamp) return true;
      return r.timestamp.slice(0, 10) === STATE.dateLive;
    });
  }
  if (STATE.eventType) {
    const key = TAB_META[STATE.activeTab].filterKey;
    if (key) data = data.filter(r => r[key] === STATE.eventType);
  }
  if (STATE.search) {
    data = data.filter(r =>
      Object.values(r).some(v => v != null && String(v).toLowerCase().includes(STATE.search))
    );
  }

  if (STATE.sortCol) {
    data.sort((a, b) => {
      const va = a[STATE.sortCol] ?? '';
      const vb = b[STATE.sortCol] ?? '';
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return STATE.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  STATE.filtered = data;
  renderAll();
}

// ── RENDER ALL ──
function renderAll() {
  updateStats();
  updatePlayerBadge();
  updateContentBadge();

  if (STATE.activeTab === 'overview') {
    renderOverviewContent();
  } else {
    renderTableView();
  }
  updateRefreshNote();
}

function updateContentBadge() {
  if (STATE.activeTab === 'overview') {
    $('#tabContentBadge').textContent = `${STATE.allPlayers.length} player`;
  } else {
    const raw = getCurrentRawData();
    $('#tabContentBadge').textContent = raw.length.toLocaleString() + ' baris';
  }
}

// ── TABLE VIEW (behavior, gui, npc) ──
function renderTableView() {
  const tab = STATE.activeTab;
  const filtered = STATE.filtered;
  const start = (STATE.page - 1) * STATE.rowsPerPage;
  const end = Math.min(start + STATE.rowsPerPage, filtered.length);
  const pageData = filtered.slice(start, end);

  // Get correct DOM IDs based on tab
  let tableId, headId, bodyId, rowsShownId, paginationId;
  if (tab === 'behavior') {
    tableId = 'dataTable'; headId = 'tableHead'; bodyId = 'tableBody';
    rowsShownId = 'rowsShown'; paginationId = 'pagination';
  } else if (tab === 'gui') {
    tableId = 'dataTableGui'; headId = 'tableHeadGui'; bodyId = 'tableBodyGui';
    rowsShownId = 'rowsShownGui'; paginationId = 'paginationGui';
  } else {
    tableId = 'dataTableNpc'; headId = 'tableHeadNpc'; bodyId = 'tableBodyNpc';
    rowsShownId = 'rowsShownNpc'; paginationId = 'paginationNpc';
  }

  if (filtered.length === 0) {
    document.getElementById(headId).innerHTML = '';
    document.getElementById(bodyId).innerHTML =
      '<tr><td colspan="99" style="text-align:center;padding:48px;color:var(--text2);">📭 Tidak ada data yang cocok dengan filter.</td></tr>';
    document.getElementById(rowsShownId).textContent = 'Menampilkan 0 dari 0';
    document.getElementById(paginationId).innerHTML = '';
    return;
  }

  const cols = Object.keys(filtered[0]);

  document.getElementById(headId).innerHTML = `<tr>${cols.map(c =>
    `<th onclick="sortBy('${c}')" title="Klik untuk sort">
      ${formatHeader(c)}
      <span class="sort-arrow">${STATE.sortCol === c ? (STATE.sortDir === 'asc' ? '▲' : '▼') : ''}</span>
    </th>`
  ).join('')}</tr>`;

  document.getElementById(bodyId).innerHTML = pageData.map(row =>
    `<tr>${cols.map(c => {
      const val = row[c];
      const cls = cellClass(c, val);
      const title = val != null ? escAttr(String(val)) : '';
      return `<td${cls ? ` class="${cls}"` : ''} title="${title}">${formatCell(c, val)}</td>`;
    }).join('')}</tr>`
  ).join('');

  document.getElementById(rowsShownId).textContent =
    `Menampilkan ${start + 1}–${end} dari ${filtered.length.toLocaleString()}`;

  // Pagination
  const totalPages = Math.ceil(filtered.length / STATE.rowsPerPage);
  const pagEl = document.getElementById(paginationId);
  if (totalPages <= 1) {
    pagEl.innerHTML = totalPages === 1
      ? '<span style="color:var(--text2);font-size:0.76rem;">Halaman 1 dari 1</span>'
      : '';
  } else {
    pagEl.innerHTML = buildPaginationHTML(totalPages);
  }

  // Charts
  if (tab === 'behavior') {
    drawTimelineCanvas();
    drawHeatmapCanvas();
  } else if (tab === 'gui') {
    drawGUITimelineCanvas();
  }
}

function sortBy(col) {
  STATE.sortCol = (STATE.sortCol === col) ? col : col;
  STATE.sortDir = (STATE.sortCol === col && STATE.sortDir === 'asc') ? 'desc' : 'asc';
  STATE.sortCol = col;
  applyAllFilters();
}

function buildPaginationHTML(totalPages) {
  let html = '';
  html += `<button class="page-btn" ${STATE.page <= 1 ? 'disabled' : ''} onclick="goPage(${STATE.page - 1})">‹</button>`;
  const maxVis = 7;
  const pages = [];
  if (totalPages <= maxVis) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    const left = Math.max(2, STATE.page - 2);
    const right = Math.min(totalPages - 1, STATE.page + 2);
    if (left > 2) pages.push('…');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('…');
    pages.push(totalPages);
  }
  for (const p of pages) {
    if (p === '…') html += '<span style="color:var(--text2);padding:4px 6px;">…</span>';
    else html += `<button class="page-btn ${p === STATE.page ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
  }
  html += `<button class="page-btn" ${STATE.page >= totalPages ? 'disabled' : ''} onclick="goPage(${STATE.page + 1})">›</button>`;
  return html;
}

function goPage(p) {
  STATE.page = p;
  renderAll();
}

// ── STATS ──
function updateStats() {
  const filtered = STATE.filtered;
  const raw = STATE.activeTab === 'overview' ? [] : getCurrentRawData();

  $('#statTotal').textContent = filtered.length.toLocaleString();

  if (STATE.activeTab === 'overview') {
    const allEv = new Set();
    for (const type of ['behavior', 'gui', 'npc']) {
      for (const row of STATE.rawData[type]) {
        const k = type === 'behavior' ? row.event_type : type === 'gui' ? row.ui_element : row.npc_target;
        if (k) allEv.add(k);
      }
    }
    $('#statEvents').textContent = allEv.size;
  } else {
    const key = TAB_META[STATE.activeTab].filterKey;
    if (key) {
      const uniq = [...new Set(filtered.map(r => r[key]).filter(Boolean))];
      $('#statEvents').textContent = uniq.length;
    }
  }

  const playersInView = STATE.activeTab === 'overview'
    ? STATE.allPlayers.length
    : [...new Set(raw.map(r => r.player_id).filter(Boolean))].length;
  $('#statPlayers').textContent = playersInView;

  const timestamps = filtered.map(r => r.timestamp).filter(Boolean).sort();
  if (timestamps.length > 0) {
    const first = new Date(timestamps[0]);
    const last = new Date(timestamps[timestamps.length - 1]);
    const diffMin = Math.round((last - first) / 60000);
    $('#statFirstSeen').textContent = formatDateTime(first);
    $('#statLastSeen').textContent = formatDateTime(last);
    $('#statTimeRange').textContent =
      diffMin < 60 ? `${diffMin} mnt` : diffMin < 1440 ? `${Math.floor(diffMin/60)}j ${diffMin%60}m` : `${Math.floor(diffMin/1440)}h ${Math.floor((diffMin%1440)/60)}j`;
  } else {
    $('#statFirstSeen').textContent = '—';
    $('#statLastSeen').textContent = '—';
    $('#statTimeRange').textContent = '—';
  }
}

function updatePlayerBadge() {
  if (STATE.selectedPlayer) {
    const p = STATE.allPlayers.find(p => p.id === STATE.selectedPlayer);
    $('#playerCountBadge').textContent = p ? p.name : '1 Player';
  } else {
    $('#playerCountBadge').textContent = `${STATE.allPlayers.length} Player`;
  }
}

// ── CHARTS: Behavior ──
function drawTimelineCanvas() {
  const ctx = document.getElementById('timelineCanvas');
  if (!ctx) return;
  destroyChart('timeline');

  const buckets = {};
  STATE.filtered.forEach(r => {
    if (r.timestamp) {
      const sec = r.timestamp.slice(0, 19);
      buckets[sec] = (buckets[sec] || 0) + 1;
    }
  });
  const sorted = Object.entries(buckets).sort();
  const maxPoints = 120;
  const step = Math.max(1, Math.ceil(sorted.length / maxPoints));
  const sampled = sorted.filter((_, i) => i % step === 0);

  const labels = sampled.map(([k]) =>
    new Date(k + '.000Z').toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const values = sampled.map(([, v]) => v);

  STATE.charts.timeline = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Events/detik', data: values,
        borderColor: '#5865f2', backgroundColor: 'rgba(88,101,242,.08)',
        fill: true, tension: 0.3, pointRadius: 0,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b8fa3', maxTicksLimit: 20 }, grid: { color: 'rgba(46,50,66,.3)' } },
        y: { ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(46,50,66,.3)' } }
      }
    }
  });
}

function drawHeatmapCanvas() {
  const ctx = document.getElementById('heatmapCanvas');
  if (!ctx) return;
  destroyChart('heatmap');

  const points = STATE.filtered
    .filter(r => r.x != null && r.y != null)
    .map(r => ({ x: parseFloat(r.x), y: parseFloat(r.y) }));

  if (points.length < 2) {
    const c = ctx.getContext('2d');
    c.fillStyle = '#8b8fa3';
    c.font = '14px Segoe UI';
    c.textAlign = 'center';
    c.fillText('Data posisi tidak cukup', 200, 200);
    return;
  }

  STATE.charts.heatmap = new Chart(ctx.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Posisi',
        data: points,
        backgroundColor: 'rgba(88,101,242,.25)', borderColor: 'rgba(88,101,242,.5)',
        pointRadius: 2.5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'X Position', color: '#8b8fa3' }, ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(46,50,66,.3)' } },
        y: { title: { display: true, text: 'Y Position', color: '#8b8fa3' }, ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(46,50,66,.3)' } }
      }
    }
  });
}

// ── CHARTS: GUI ──
function drawGUITimelineCanvas() {
  const ctx = document.getElementById('guiTimelineCanvas');
  if (!ctx) return;
  destroyChart('guiTimeline');

  const buckets = {};
  STATE.filtered.forEach(r => {
    if (r.timestamp) {
      const min = r.timestamp.slice(0, 16);
      buckets[min] = (buckets[min] || 0) + 1;
    }
  });
  const sorted = Object.entries(buckets).sort();
  const labels = sorted.map(([k]) => new Date(k + ':00.000Z').toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  const values = sorted.map(([, v]) => v);

  STATE.charts.guiTimeline = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'GUI Events', data: values,
        backgroundColor: 'rgba(88,101,242,.5)', borderColor: '#5865f2', borderWidth: 1,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b8fa3', maxTicksLimit: 20 }, grid: { color: 'rgba(46,50,66,.3)' } },
        y: { ticks: { color: '#8b8fa3', stepSize: 1 }, grid: { color: 'rgba(46,50,66,.3)' } }
      }
    }
  });
}

// ── OVERVIEW ──
function renderOverviewContent() {
  renderPlayerList();
  renderPlayerActivityChart();
  renderEventDistChart();
}

function renderPlayerList() {
  const list = $('#playerList');
  let players = STATE.selectedPlayer
    ? STATE.allPlayers.filter(p => p.id === STATE.selectedPlayer)
    : STATE.allPlayers;
  list.innerHTML = players.map(p => {
    const total = p.counts.behavior + p.counts.gui + p.counts.npc;
    return `<div class="player-list-item${p.id === STATE.selectedPlayer ? ' selected' : ''}"
                onclick="selectPlayer('${escAttr(p.id)}')">
      <div>
        <div class="player-list-name">${escHtml(p.name)}</div>
        <div class="player-list-meta">ID: ${escHtml(p.id)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:600;color:var(--accent);">${total.toLocaleString()}</div>
        <div class="player-list-meta">total</div>
      </div>
    </div>`;
  }).join('');
}

function selectPlayer(id) {
  STATE.selectedPlayer = id;
  $('#playerFilter').value = id;
  STATE.page = 1;
  applyAllFilters();
}

function renderPlayerActivityChart() {
  destroyChart('playerActivity');
  const ctx = document.getElementById('playerActivityChart');
  if (!ctx) return;
  const players = STATE.selectedPlayer
    ? STATE.allPlayers.filter(p => p.id === STATE.selectedPlayer)
    : STATE.allPlayers.slice(0, 10);
  STATE.charts.playerActivity = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: players.map(p => p.name),
      datasets: [
        { label: 'Behavior', data: players.map(p => p.counts.behavior), backgroundColor: '#5865f2' },
        { label: 'GUI', data: players.map(p => p.counts.gui), backgroundColor: '#7c3aed' },
        { label: 'NPC', data: players.map(p => p.counts.npc), backgroundColor: '#06b6d4' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b8fa3' } } },
      scales: {
        x: { stacked: true, ticks: { color: '#8b8fa3', maxRotation: 45 }, grid: { color: 'rgba(46,50,66,.3)' } },
        y: { stacked: true, ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(46,50,66,.3)' } }
      }
    }
  });
}

function renderEventDistChart() {
  destroyChart('eventDist');
  const ctx = document.getElementById('eventDistChart');
  if (!ctx) return;
  const counts = {};
  for (const type of ['behavior', 'gui', 'npc']) {
    for (const row of STATE.rawData[type]) {
      if (STATE.selectedPlayer && String(row.player_id) !== STATE.selectedPlayer) continue;
      let key;
      if (type === 'behavior') key = row.event_type || 'unknown';
      else if (type === 'gui') key = row.ui_element || 'unknown';
      else key = row.npc_target || 'unknown';
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  STATE.charts.eventDist = new Chart(ctx.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k]) => String(k).slice(0, 20)),
      datasets: [{
        data: sorted.map(([, v]) => v),
        backgroundColor: ['#5865f2', '#7c3aed', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'],
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b8fa3', font: { size: 10 } } } }
    }
  });
}

function destroyChart(key) {
  if (STATE.charts[key]) { STATE.charts[key].destroy(); STATE.charts[key] = null; }
}

// ── EXPORT ──
function setupExport() {
  $('#exportCSV').addEventListener('click', exportCSV);
  $('#exportExcel').addEventListener('click', exportExcel);
  $('#exportJSON').addEventListener('click', exportJSON);
}

function getExportData() {
  if (STATE.activeTab === 'overview') {
    return showToast('⚠️ Pilih tab Behavior/GUI/NPC untuk ekspor');
  }
  const hasFilters = STATE.selectedPlayer || STATE.dateLive || STATE.eventType || STATE.search;
  return (hasFilters && STATE.filtered.length > 0) ? STATE.filtered : getCurrentRawData();
}

function exportCSV() {
  const data = getExportData();
  if (!data || !data.length) return showToast('⚠️ Tidak ada data');
  const cols = Object.keys(data[0]);
  const csvRows = [cols.join(',')];
  for (const row of data) {
    csvRows.push(cols.map(c => {
      const v = row[c];
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','));
  }
  downloadFile('\uFEFF' + csvRows.join('\n'), `${STATE.activeTab}_logs_${dateStamp()}.csv`, 'text/csv;charset=utf-8');
  showToast('📥 CSV terunduh');
}

function exportExcel() {
  const data = getExportData();
  if (!data || !data.length) return showToast('⚠️ Tidak ada data');
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ARG_Report');
  XLSX.writeFile(wb, `${STATE.activeTab}_logs_${dateStamp()}.xlsx`);
  showToast('📊 Excel terunduh');
}

function exportJSON() {
  const data = getExportData();
  if (!data || !data.length) return showToast('⚠️ Tidak ada data');
  downloadFile(JSON.stringify(data, null, 2), `${STATE.activeTab}_logs_${dateStamp()}.json`, 'application/json');
  showToast('📋 JSON terunduh');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── PAGINATION SETUP ──
function setupPagination() {
  ['rowsPerPage', 'rowsPerPageGui', 'rowsPerPageNpc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', (e) => {
        STATE.rowsPerPage = parseInt(e.target.value);
        STATE.page = 1;
        // Sync all selects
        ['rowsPerPage', 'rowsPerPageGui', 'rowsPerPageNpc'].forEach(sid => {
          const sel = document.getElementById(sid);
          if (sel && sel !== e.target) sel.value = e.target.value;
        });
        renderAll();
      });
    }
  });
}

// ── FORMAT HELPERS ──
function formatHeader(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCell(key, val) {
  if (val == null) return '<span style="color:var(--text2);font-style:italic;">—</span>';
  const s = String(val);
  if (s.length > 80) return escHtml(s.slice(0, 80)) + '…';
  return escHtml(s);
}

function cellClass(key, val) {
  if (key === 'event_type') {
    if (val === 'move') return 'badge badge-move';
    if (val && String(val).toLowerCase().includes('click')) return 'badge badge-click';
    if (val && String(val).toLowerCase().includes('interact')) return 'badge badge-interact';
  }
  if (key === 'role') {
    return val === 'user' ? 'role-user' : val === 'assistant' ? 'role-assistant' : '';
  }
  return '';
}

function formatDateTime(d) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ' ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, ' ');
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ── START ──
document.addEventListener('DOMContentLoaded', init);
