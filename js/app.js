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

// ── PLAYER DISCOVERY (static base, but counts always from dynamic filters) ──
function discoverPlayers() {
  const playerMap = new Map();
  for (const type of ['behavior', 'gui', 'npc']) {
    for (const row of STATE.rawData[type]) {
      const id = row.player_id;
      if (!id) continue;
      if (!playerMap.has(id)) {
        playerMap.set(id, {
          id, name: row.player_name || 'Unknown',
          firstSeen: row.timestamp || '',
          lastSeen: row.timestamp || '',
        });
      }
      const p = playerMap.get(id);
      if (row.timestamp) {
        if (!p.firstSeen || row.timestamp < p.firstSeen) p.firstSeen = row.timestamp;
        if (!p.lastSeen || row.timestamp > p.lastSeen) p.lastSeen = row.timestamp;
      }
    }
  }
  STATE.allPlayers = [...playerMap.values()].sort((a, b) => {
    const ca = filterRawData('behavior').filter(r => String(r.player_id) === a.id).length +
               filterRawData('gui').filter(r => String(r.player_id) === a.id).length +
               filterRawData('npc').filter(r => String(r.player_id) === a.id).length;
    const cb = filterRawData('behavior').filter(r => String(r.player_id) === b.id).length +
               filterRawData('gui').filter(r => String(r.player_id) === b.id).length +
               filterRawData('npc').filter(r => String(r.player_id) === b.id).length;
    return cb - ca;
  });
  console.log(`👥 ${STATE.allPlayers.length} players`);
}

// ── FILTER SETUP ──
function findDataDate() {
  for (const type of ['behavior', 'gui', 'npc']) {
    for (const row of STATE.rawData[type]) {
      if (row.timestamp) return row.timestamp.slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function setupFilters() {
  const sel = $('#playerFilter');
  sel.innerHTML = '<option value="">Semua Player</option>' +
    STATE.allPlayers.map(p => `<option value="${escAttr(p.id)}">${escHtml(p.name)} (${p.id})</option>`).join('');
  sel.addEventListener('change', () => { STATE.selectedPlayer = sel.value; });

  $('#dateLive').addEventListener('change', () => { STATE.dateLive = $('#dateLive').value; });

  // Default to TODAY (bukan data's date) — user bisa pilih tanggal lain
  const today = new Date().toISOString().slice(0, 10);
  $('#dateLive').value = today;
  STATE.dateLive = today;

  $('#applyFiltersBtn').addEventListener('click', () => {
    STATE.selectedPlayer = $('#playerFilter').value;
    STATE.dateLive = $('#dateLive').value;
    STATE.page = 1;
    applyAllFilters();
    pulseStats();
    showToast('✅ Filter diterapkan');
  });

  $('#resetFiltersBtn').addEventListener('click', resetFilters);
}

function resetFilters() {
  $('#playerFilter').value = '';
  STATE.selectedPlayer = '';
  const dataDate = findDataDate();
  $('#dateLive').value = dataDate;
  STATE.dateLive = dataDate;
  $('#filterType').value = '';
  STATE.eventType = '';
  STATE.search = '';
  $('#searchInput').value = '';
  STATE.page = 1;
  applyAllFilters();
  pulseStats();
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

  // Badge will be updated by renderAll → updateContentBadge → dynamic count

  // Hide all tab views, show active + animate
  $$('.tab-view').forEach(v => v.classList.remove('active'));
  const viewEl = document.getElementById(`view-${tabName}`);
  if (viewEl) viewEl.classList.add('active');

  // Animate icon bump
  $('#tabContentIcon').style.transform = 'scale(1.3)';
  setTimeout(() => { $('#tabContentIcon').style.transform = 'scale(1)'; }, 200);

  // Re-pulse live dot
  const dot = document.querySelector('.live-dot');
  if (dot) { dot.classList.remove('pulse'); void dot.offsetWidth; dot.classList.add('pulse'); }

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
  pulseStats();

  // Pulse live label to show refresh happened
  const liveLabel = document.querySelector('.live-label');
  if (liveLabel) {
    liveLabel.style.transform = 'scale(1.2)';
    liveLabel.style.color = '#4ade80';
    setTimeout(() => { liveLabel.style.transform = 'scale(1)'; liveLabel.style.color = ''; }, 400);
  }
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
  updateTabDescription();

  if (STATE.activeTab === 'overview') {
    renderOverviewContent();
  } else {
    renderTableView();
  }
  updateRefreshNote();
}

function updateTabDescription() {
  let desc = TAB_META[STATE.activeTab].desc;
  const parts = [];
  if (STATE.selectedPlayer) {
    const p = STATE.allPlayers.find(x => x.id === STATE.selectedPlayer);
    parts.push(`Player: ${p ? p.name : STATE.selectedPlayer}`);
  }
  if (STATE.dateLive) parts.push(`Tanggal: ${STATE.dateLive}`);
  if (parts.length) desc += ' · ' + parts.join(' · ');
  $('#tabContentDesc').textContent = desc;
}

function updateContentBadge() {
  if (STATE.activeTab === 'overview') {
    // Dynamic: only players matching current filter
    const filteredPlayers = getFilteredPlayerCount();
    $('#tabContentBadge').textContent = `${filteredPlayers} player`;
  } else {
    // Dynamic: filtered row count, not total
    $('#tabContentBadge').textContent = STATE.filtered.length.toLocaleString() + ' baris';
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
      `<tr><td colspan="99" style="text-align:center;padding:48px;color:var(--text2);">
        📭 Tidak ada data untuk tanggal <b>${STATE.dateLive || '(semua)'}</b>
        ${STATE.selectedPlayer ? ' · Player: ' + STATE.selectedPlayer : ''}
        <br><small style="color:var(--accent);">Coba ubah filter tanggal atau player</small>
      </td></tr>`;
    document.getElementById(rowsShownId).textContent = 'Menampilkan 0 dari 0';
    document.getElementById(paginationId).innerHTML = '';
    clearAllCharts(tab);
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

// ── STATS (fully dynamic, based on applied filters) ──
function updateStats() {
  const filtered = STATE.filtered;

  // TOTAL RECORDS
  if (STATE.activeTab === 'overview') {
    let totalAcrossAll = 0;
    for (const type of ['behavior', 'gui', 'npc']) {
      totalAcrossAll += countFilteredAcross(type);
    }
    $('#statTotal').textContent = totalAcrossAll.toLocaleString();
  } else {
    $('#statTotal').textContent = filtered.length.toLocaleString();
  }

  // UNIQUE EVENTS
  if (STATE.activeTab === 'overview') {
    const allEv = new Set();
    for (const type of ['behavior', 'gui', 'npc']) {
      const data = filterRawData(type);
      for (const row of data) {
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

  // PLAYERS ACTIVE — fully dynamic from filtered data
  if (STATE.activeTab === 'overview') {
    const pids = new Set();
    for (const type of ['behavior', 'gui', 'npc']) {
      for (const row of filterRawData(type)) {
        if (row.player_id) pids.add(row.player_id);
      }
    }
    $('#statPlayers').textContent = pids.size;
  } else {
    const pids = new Set(filtered.map(r => r.player_id).filter(Boolean));
    $('#statPlayers').textContent = pids.size;
  }

  // TIME RANGE / FIRST / LAST
  const timestamps = filtered.map(r => r.timestamp).filter(Boolean).sort();
  if (timestamps.length > 0) {
    const first = new Date(timestamps[0]);
    const last = new Date(timestamps[timestamps.length - 1]);
    const diffMin = Math.round((last - first) / 60000);
    $('#statFirstSeen').textContent = formatDateTime(first);
    $('#statLastSeen').textContent = formatDateTime(last);
    STATE._liveFirst = first;
    STATE._liveLast = last;
    $('#statTimeRange').textContent =
      diffMin < 60 ? `${diffMin} mnt` : diffMin < 1440 ? `${Math.floor(diffMin/60)}j ${diffMin%60}m` : `${Math.floor(diffMin/1440)}h ${Math.floor((diffMin%1440)/60)}j`;
  } else if (STATE.activeTab === 'overview') {
    // Overview: calculate across all types
    const allTS = [];
    for (const type of ['behavior', 'gui', 'npc']) {
      for (const row of filterRawData(type)) {
        if (row.timestamp) allTS.push(row.timestamp);
      }
    }
    allTS.sort();
    if (allTS.length > 0) {
      const first = new Date(allTS[0]);
      const last = new Date(allTS[allTS.length - 1]);
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
  } else {
    $('#statFirstSeen').textContent = STATE._liveFirst ? formatDateTime(STATE._liveFirst) : '—';
    $('#statLastSeen').textContent = STATE._liveLast ? formatDateTime(STATE._liveLast) : '—';
    $('#statTimeRange').textContent = '—';
  }
}

// Dynamic helpers: apply player + date filter to raw data of any type
function filterRawData(type) {
  let data = STATE.rawData[type] || [];
  if (STATE.selectedPlayer) {
    data = data.filter(r => String(r.player_id) === STATE.selectedPlayer);
  }
  if (STATE.dateLive) {
    data = data.filter(r => {
      if (!r.timestamp) return true;
      return r.timestamp.slice(0, 10) === STATE.dateLive;
    });
  }
  return data;
}

function countFilteredAcross(type) {
  return filterRawData(type).length;
}

function getFilteredPlayerCount() {
  const pids = new Set();
  for (const type of ['behavior', 'gui', 'npc']) {
    for (const row of filterRawData(type)) {
      if (row.player_id) pids.add(row.player_id);
    }
  }
  return pids.size;
}

function updatePlayerBadge() {
  const count = getFilteredPlayerCount();
  if (STATE.selectedPlayer) {
    const p = STATE.allPlayers.find(p => p.id === STATE.selectedPlayer);
    $('#playerCountBadge').textContent = p ? p.name : '1 Player';
  } else {
    $('#playerCountBadge').textContent = `${count} Player Aktif`;
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

  // Dynamic: only players matching current filter
  const filteredPids = new Set();
  for (const type of ['behavior', 'gui', 'npc']) {
    const data = filterRawData(type);
    for (const row of data) {
      if (row.player_id) filteredPids.add(row.player_id);
    }
  }

  const players = STATE.allPlayers.filter(p => filteredPids.has(p.id));
  if (players.length === 0) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);">Tidak ada player dengan filter ini</div>';
    return;
  }

  // Count from filtered data
  const getCount = (p, type) => filterRawData(type).filter(r => String(r.player_id) === p.id).length;

  list.innerHTML = players.map(p => {
    const total = getCount(p, 'behavior') + getCount(p, 'gui') + getCount(p, 'npc');
    return `<div class="player-list-item${p.id === STATE.selectedPlayer ? ' selected' : ''}"
                onclick="selectPlayer('${escAttr(p.id)}')">
      <div>
        <div class="player-list-name">${escHtml(p.name)}</div>
        <div class="player-list-meta">ID: ${escHtml(p.id)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:600;color:var(--accent);">${total.toLocaleString()}</div>
        <div class="player-list-meta">logs</div>
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

  // Dynamic: only players matching current filter
  const filteredPids = new Set();
  for (const type of ['behavior', 'gui', 'npc']) {
    for (const row of filterRawData(type)) {
      if (row.player_id) filteredPids.add(row.player_id);
    }
  }
  const players = STATE.allPlayers
    .filter(p => filteredPids.has(p.id))
    .slice(0, 10);

  if (players.length === 0) {
    STATE.charts.playerActivity = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels: ['Tidak ada data'], datasets: [{ label: '', data: [0], backgroundColor: '#2e3242' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    return;
  }

  // Dynamic counts from filtered data
  const getFilteredCount = (p, type) => {
    const data = filterRawData(type);
    return data.filter(r => String(r.player_id) === p.id).length;
  };

  STATE.charts.playerActivity = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: players.map(p => p.name),
      datasets: [
        { label: 'Behavior', data: players.map(p => getFilteredCount(p, 'behavior')), backgroundColor: '#5865f2' },
        { label: 'GUI', data: players.map(p => getFilteredCount(p, 'gui')), backgroundColor: '#7c3aed' },
        { label: 'NPC', data: players.map(p => getFilteredCount(p, 'npc')), backgroundColor: '#06b6d4' },
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

  // Dynamic counts from filtered data
  const counts = {};
  for (const type of ['behavior', 'gui', 'npc']) {
    const data = filterRawData(type);
    for (const row of data) {
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

function pulseStats() {
  document.querySelectorAll('.stat-value').forEach(el => {
    el.style.color = '#4ade80';
    el.style.transform = 'scale(1.06)';
    setTimeout(() => { el.style.color = ''; el.style.transform = ''; }, 500);
  });
}

function clearAllCharts(tab) {
  if (tab === 'behavior') {
    destroyChart('timeline');
    destroyChart('heatmap');
  } else if (tab === 'gui') {
    destroyChart('guiTimeline');
  }
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
