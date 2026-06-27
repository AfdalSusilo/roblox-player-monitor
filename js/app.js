/* ======================================================
   Roblox Player Monitor – v2.0
   Multi-player · Date filter · Auto-refresh · Overview
   Tanpa Database · Live Saat Dibuka
   ====================================================== */

// ── STATE ──
const STATE = {
  activeTab: 'behavior',
  // All raw data loaded from JSON
  rawData: { behavior: [], gui: [], npc: [] },
  // Filtered data (after applying player + date + event type + search)
  filtered: [],
  // All unique players discovered
  allPlayers: [],
  selectedPlayer: '',    // '' = all
  dateStart: '',
  dateEnd: '',
  eventType: '',
  search: '',
  page: 1,
  rowsPerPage: 50,
  sortCol: null,
  sortDir: 'asc',
  // Refresh
  refreshInterval: 30,
  refreshTimer: null,
  liveSeconds: 0,
  liveTimerId: null,
  // Charts
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
  renderAll();
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
      console.warn(`⚠️ Gagal load ${type}, coba sample...`);
      try {
        STATE.rawData[type] = await fetchJSON(`data/${type}_logs_sample.json`);
        console.warn(`   Fallback sample: ${STATE.rawData[type].length} rows`);
      } catch (e2) {
        console.error(`❌ ${type}: no data`);
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
      if (id && !playerMap.has(id)) {
        playerMap.set(id, {
          id,
          name: row.player_name || 'Unknown',
          counts: { behavior: 0, gui: 0, npc: 0 },
          firstSeen: row.timestamp || '',
          lastSeen: row.timestamp || '',
        });
      }
      if (id) {
        const p = playerMap.get(id);
        p.counts[type] = (p.counts[type] || 0) + 1;
        if (row.timestamp) {
          if (!p.firstSeen || row.timestamp < p.firstSeen) p.firstSeen = row.timestamp;
          if (!p.lastSeen || row.timestamp > p.lastSeen) p.lastSeen = row.timestamp;
        }
      }
    }
  }
  STATE.allPlayers = [...playerMap.values()].sort((a, b) =>
    (b.counts.behavior + b.counts.gui + b.counts.npc) -
    (a.counts.behavior + a.counts.gui + a.counts.npc)
  );
  console.log(`👥 Players: ${STATE.allPlayers.length}`, STATE.allPlayers.map(p => p.name));
}

// ── FILTER SETUP ──
function setupFilters() {
  // Player dropdown
  const sel = $('#playerFilter');
  sel.innerHTML = '<option value="">Semua Player</option>' +
    STATE.allPlayers.map(p =>
      `<option value="${escHtml(p.id)}">${escHtml(p.name)} (${p.id})</option>`
    ).join('');

  sel.addEventListener('change', () => {
    STATE.selectedPlayer = sel.value;
    updatePlayerListSelection();
  });

  // Date inputs
  $('#dateStart').addEventListener('change', () => { STATE.dateStart = $('#dateStart').value; });
  $('#dateEnd').addEventListener('change', () => { STATE.dateEnd = $('#dateEnd').value; });

  // Auto-detect date range from data
  const allTimestamps = [];
  for (const type of ['behavior', 'gui', 'npc']) {
    for (const row of STATE.rawData[type]) {
      if (row.timestamp) allTimestamps.push(row.timestamp);
    }
  }
  if (allTimestamps.length > 0) {
    allTimestamps.sort();
    const first = allTimestamps[0].slice(0, 10);
    const last = allTimestamps[allTimestamps.length - 1].slice(0, 10);
    $('#dateStart').value = first;
    $('#dateEnd').value = last;
    STATE.dateStart = first;
    STATE.dateEnd = last;
  }

  // Apply button
  $('#applyFiltersBtn').addEventListener('click', () => {
    STATE.selectedPlayer = $('#playerFilter').value;
    STATE.dateStart = $('#dateStart').value;
    STATE.dateEnd = $('#dateEnd').value;
    STATE.page = 1;
    applyAllFilters();
    showToast('✅ Filter diterapkan');
  });

  // Reset button
  $('#resetFiltersBtn').addEventListener('click', () => {
    $('#playerFilter').value = '';
    STATE.selectedPlayer = '';
    updatePlayerListSelection();
    // Reset dates to full range
    const allTimestamps = [];
    for (const type of ['behavior', 'gui', 'npc']) {
      for (const row of STATE.rawData[type]) {
        if (row.timestamp) allTimestamps.push(row.timestamp);
      }
    }
    if (allTimestamps.length > 0) {
      allTimestamps.sort();
      $('#dateStart').value = allTimestamps[0].slice(0, 10);
      $('#dateEnd').value = allTimestamps[allTimestamps.length - 1].slice(0, 10);
      STATE.dateStart = $('#dateStart').value;
      STATE.dateEnd = $('#dateEnd').value;
    }
    $('#filterType').value = '';
    STATE.eventType = '';
    STATE.search = '';
    $('#searchInput').value = '';
    STATE.page = 1;
    applyAllFilters();
    showToast('🔄 Filter direset');
  });
}

// ── TABS ──
function setupTabs() {
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.activeTab = btn.dataset.tab;
      STATE.page = 1;
      updateEventTypeFilter();
      renderAll();
    });
  });
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
  const data = getCurrentRawData();
  const sel = $('#filterType');
  sel.innerHTML = '<option value="">Semua Event</option>';

  let key;
  if (STATE.activeTab === 'behavior') key = 'event_type';
  else if (STATE.activeTab === 'gui') key = 'ui_element';
  else key = 'npc_target';

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
      STATE.refreshTimer = setInterval(() => {
        refreshData();
      }, STATE.refreshInterval * 1000);
      showToast(`🔄 Auto-refresh: ${STATE.refreshInterval}s`);
    } else {
      showToast('⏸️ Auto-refresh: Mati');
    }
  });

  // Start with default 30s
  if (STATE.refreshInterval > 0) {
    STATE.refreshTimer = setInterval(() => refreshData(), STATE.refreshInterval * 1000);
  }
}

async function refreshData() {
  console.log('🔄 Refreshing data...');
  await loadAllData();
  discoverPlayers();
  updatePlayerDropdown();
  applyAllFilters();
  updateRefreshNote();
}

function updateRefreshNote() {
  const now = new Date();
  $('#refreshNote').textContent =
    `Data diperbarui: ${now.toLocaleTimeString('id-ID')} · Auto-refresh: ${STATE.refreshInterval}s`;
}

function updatePlayerDropdown() {
  const sel = $('#playerFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">Semua Player</option>' +
    STATE.allPlayers.map(p =>
      `<option value="${escHtml(p.id)}" ${p.id === current ? 'selected' : ''}>${escHtml(p.name)} (${p.id})</option>`
    ).join('');
}

// ── LIVE TIMER ──
function startLiveTimer() {
  STATE.liveTimerId = setInterval(() => {
    STATE.liveSeconds++;
    const m = Math.floor(STATE.liveSeconds / 60);
    const s = STATE.liveSeconds % 60;
    $('#liveTimer').textContent =
      `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, 1000);
}

// ── DATA HELPERS ──
function getCurrentRawData() {
  return STATE.rawData[STATE.activeTab] || [];
}

function applyAllFilters() {
  let data = getCurrentRawData();

  // Player filter
  if (STATE.selectedPlayer) {
    data = data.filter(r => String(r.player_id) === STATE.selectedPlayer);
  }

  // Date filter
  if (STATE.dateStart || STATE.dateEnd) {
    data = data.filter(r => {
      if (!r.timestamp) return true;
      const d = r.timestamp.slice(0, 10); // YYYY-MM-DD
      if (STATE.dateStart && d < STATE.dateStart) return false;
      if (STATE.dateEnd && d > STATE.dateEnd) return false;
      return true;
    });
  }

  // Event type filter
  if (STATE.eventType) {
    let key;
    if (STATE.activeTab === 'behavior') key = 'event_type';
    else if (STATE.activeTab === 'gui') key = 'ui_element';
    else key = 'npc_target';
    data = data.filter(r => r[key] === STATE.eventType);
  }

  // Search
  if (STATE.search) {
    data = data.filter(r =>
      Object.values(r).some(v =>
        v != null && String(v).toLowerCase().includes(STATE.search)
      )
    );
  }

  // Sort if needed
  if (STATE.sortCol) {
    data = [...data].sort((a, b) => {
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
  updateEventTypeFilter();
  renderTable();
  renderPagination();
  renderExtraPanels();
  renderOverviewPanels();
  updateRefreshNote();
}

// ── STATS ──
function updateStats() {
  const filtered = STATE.filtered;
  const raw = getCurrentRawData();

  $('#statTotal').textContent = filtered.length.toLocaleString();

  if (STATE.activeTab === 'behavior') {
    const events = [...new Set(filtered.map(r => r.event_type))];
    $('#statEvents').textContent = events.length;
  } else if (STATE.activeTab === 'gui') {
    const els = [...new Set(filtered.map(r => r.ui_element))];
    $('#statEvents').textContent = els.length;
  } else if (STATE.activeTab === 'npc') {
    const npcs = [...new Set(filtered.map(r => r.npc_target))];
    $('#statEvents').textContent = npcs.length;
  }

  // Players in current view
  const playersInView = [...new Set(raw.map(r => r.player_id).filter(Boolean))];
  $('#statPlayers').textContent = playersInView.length;

  // Time range
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
    $('#playerCountBadge').textContent = p ? `${p.name}` : '1 Player';
  } else {
    $('#playerCountBadge').textContent = `${STATE.allPlayers.length} Player`;
  }
}

// ── TABLE ──
function renderTable() {
  if (STATE.activeTab === 'overview') {
    $('#tableContainer').style.display = 'none';
    return;
  }
  $('#tableContainer').style.display = 'block';

  const filtered = STATE.filtered;
  const start = (STATE.page - 1) * STATE.rowsPerPage;
  const end = Math.min(start + STATE.rowsPerPage, filtered.length);
  const pageData = filtered.slice(start, end);

  if (filtered.length === 0) {
    $('#tableHead').innerHTML = '';
    $('#tableBody').innerHTML =
      '<tr><td colspan="99" style="text-align:center;padding:48px;color:var(--text2);">📭 Tidak ada data yang cocok dengan filter.</td></tr>';
    $('#rowsShown').textContent = 'Menampilkan 0 dari 0';
    return;
  }

  // Build headers from first row keys
  const cols = Object.keys(filtered[0]);

  $('#tableHead').innerHTML = `<tr>${cols.map(c =>
    `<th onclick="sortBy('${c}')" title="Klik untuk sort">
      ${formatHeader(c)}
      <span class="sort-arrow">${STATE.sortCol === c ? (STATE.sortDir === 'asc' ? '▲' : '▼') : ''}</span>
    </th>`
  ).join('')}</tr>`;

  $('#tableBody').innerHTML = pageData.map(row =>
    `<tr>${cols.map(c => {
      const val = row[c];
      const cls = cellClass(c, val);
      const title = val != null ? escAttr(String(val)) : '';
      return `<td${cls ? ` class="${cls}"` : ''} title="${title}">${formatCell(c, val)}</td>`;
    }).join('')}</tr>`
  ).join('');

  $('#rowsShown').textContent =
    `Menampilkan ${start + 1}–${end} dari ${filtered.length.toLocaleString()}`;
}

function sortBy(col) {
  if (STATE.sortCol === col) {
    STATE.sortDir = STATE.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    STATE.sortCol = col;
    STATE.sortDir = 'asc';
  }
  applyAllFilters();
}

// ── PAGINATION ──
function setupPagination() {
  $('#rowsPerPage').addEventListener('change', (e) => {
    STATE.rowsPerPage = parseInt(e.target.value);
    STATE.page = 1;
    renderAll();
  });
}

function renderPagination() {
  const total = STATE.filtered.length;
  const totalPages = Math.ceil(total / STATE.rowsPerPage);
  const container = $('#pagination');

  if (totalPages <= 1) {
    container.innerHTML = totalPages === 1
      ? '<span style="color:var(--text2);font-size:0.78rem;">Halaman 1 dari 1</span>'
      : '';
    return;
  }

  let html = '';
  html += `<button class="page-btn" ${STATE.page <= 1 ? 'disabled' : ''} onclick="goPage(${STATE.page - 1})">‹</button>`;

  const maxVisible = 7;
  let pages = [];
  if (totalPages <= maxVisible) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
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
    if (p === '…') {
      html += '<span style="color:var(--text2);padding:4px 6px;">…</span>';
    } else {
      html += `<button class="page-btn ${p === STATE.page ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`;
    }
  }

  html += `<button class="page-btn" ${STATE.page >= totalPages ? 'disabled' : ''} onclick="goPage(${STATE.page + 1})">›</button>`;
  container.innerHTML = html;
}

function goPage(p) {
  STATE.page = p;
  renderAll();
}

// ── EXPORT ──
function setupExport() {
  $('#exportCSV').addEventListener('click', exportCSV);
  $('#exportExcel').addEventListener('click', exportExcel);
  $('#exportJSON').addEventListener('click', exportJSON);
}

function getExportData() {
  // Export filtered data, or all current raw data if no filters active
  const hasFilters = STATE.selectedPlayer || STATE.dateStart || STATE.dateEnd ||
    STATE.eventType || STATE.search;
  return hasFilters ? STATE.filtered : getCurrentRawData();
}

function exportCSV() {
  const data = getExportData();
  if (!data.length) return showToast('⚠️ Tidak ada data untuk diekspor');
  const cols = Object.keys(data[0]);
  const csvRows = [cols.join(',')];
  for (const row of data) {
    csvRows.push(cols.map(c => {
      const v = row[c];
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(','));
  }
  downloadFile('\uFEFF' + csvRows.join('\n'), `${STATE.activeTab}_logs_${dateStamp()}.csv`, 'text/csv;charset=utf-8');
  showToast('📥 CSV terunduh');
}

function exportExcel() {
  const data = getExportData();
  if (!data.length) return showToast('⚠️ Tidak ada data untuk diekspor');
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ARG_Report');
  XLSX.writeFile(wb, `${STATE.activeTab}_logs_${dateStamp()}.xlsx`);
  showToast('📊 Excel terunduh');
}

function exportJSON() {
  const data = getExportData();
  if (!data.length) return showToast('⚠️ Tidak ada data untuk diekspor');
  downloadFile(JSON.stringify(data, null, 2), `${STATE.activeTab}_logs_${dateStamp()}.json`, 'application/json');
  showToast('📋 JSON terunduh');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── EXTRA PANELS ──
function renderExtraPanels() {
  const container = $('#extraPanels');

  if (STATE.activeTab === 'behavior' && STATE.filtered.length > 0) {
    container.style.display = 'grid';
    drawTimeline();
    drawHeatmap();
  } else if (STATE.activeTab === 'gui') {
    container.style.display = 'grid';
    drawGUIChart();
    // Hide heatmap panel for GUI
    $('#panelHeatmap').style.display = 'none';
    $('#panelTimeline').querySelector('h3').textContent = '📊 GUI Activity Timeline';
  } else {
    container.style.display = 'none';
    destroyChart('timeline');
    destroyChart('heatmap');
  }
}

function destroyChart(key) {
  if (STATE.charts[key]) { STATE.charts[key].destroy(); STATE.charts[key] = null; }
}

function drawTimeline() {
  // Aggregate events by second
  const buckets = {};
  STATE.filtered.forEach(r => {
    if (r.timestamp) {
      const sec = r.timestamp.slice(0, 19);
      buckets[sec] = (buckets[sec] || 0) + 1;
    }
  });

  const sorted = Object.entries(buckets).sort();
  // Sample for performance
  const maxPoints = 120;
  const step = Math.max(1, Math.ceil(sorted.length / maxPoints));
  const sampled = sorted.filter((_, i) => i % step === 0);

  const labels = sampled.map(([k]) =>
    new Date(k + '.000Z').toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const values = sampled.map(([, v]) => v);

  destroyChart('timeline');
  const ctx = document.getElementById('timelineCanvas').getContext('2d');
  STATE.charts.timeline = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Events/detik',
        data: values,
        borderColor: '#5865f2',
        backgroundColor: 'rgba(88,101,242,.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b8fa3', maxTicksLimit: 20 }, grid: { color: 'rgba(46,50,66,.3)' } },
        y: { ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(46,50,66,.3)' } }
      }
    }
  });
  $('#panelTimeline').querySelector('h3').textContent = '📈 Timeline Pergerakan';
  $('#panelHeatmap').style.display = '';
  $('#panelHeatmap').querySelector('h3').textContent = '🗺️ Heatmap Posisi (X/Y)';
}

function drawHeatmap() {
  const points = STATE.filtered
    .filter(r => r.x != null && r.y != null)
    .map(r => ({ x: parseFloat(r.x), y: parseFloat(r.y) }));

  destroyChart('heatmap');
  const ctx = document.getElementById('heatmapCanvas').getContext('2d');

  if (points.length < 2) {
    ctx.fillStyle = '#8b8fa3';
    ctx.font = '14px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('Data posisi tidak cukup', 200, 200);
    return;
  }

  STATE.charts.heatmap = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Posisi',
        data: points,
        backgroundColor: 'rgba(88,101,242,.3)',
        borderColor: 'rgba(88,101,242,.6)',
        pointRadius: 2.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: 'X Position', color: '#8b8fa3' }, ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(46,50,66,.3)' } },
        y: { title: { display: true, text: 'Y Position', color: '#8b8fa3' }, ticks: { color: '#8b8fa3' }, grid: { color: 'rgba(46,50,66,.3)' } }
      }
    }
  });
}

function drawGUIChart() {
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

  destroyChart('timeline');
  const ctx = document.getElementById('timelineCanvas').getContext('2d');
  STATE.charts.timeline = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'GUI Events',
        data: values,
        backgroundColor: 'rgba(88,101,242,.5)',
        borderColor: '#5865f2',
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b8fa3', maxTicksLimit: 20 }, grid: { color: 'rgba(46,50,66,.3)' } },
        y: { ticks: { color: '#8b8fa3', stepSize: 1 }, grid: { color: 'rgba(46,50,66,.3)' } }
      }
    }
  });
}

// ── OVERVIEW PANELS ──
function renderOverviewPanels() {
  const container = $('#overviewPanels');
  if (STATE.activeTab !== 'overview') {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'grid';
  renderPlayerList();
  renderPlayerActivityChart();
  renderEventDistChart();
}

function renderPlayerList() {
  const list = $('#playerList');
  let players = STATE.allPlayers;
  if (STATE.selectedPlayer) {
    players = players.filter(p => p.id === STATE.selectedPlayer);
  }
  list.innerHTML = players.map(p => {
    const total = p.counts.behavior + p.counts.gui + p.counts.npc;
    return `<div class="player-list-item${p.id === STATE.selectedPlayer ? ' selected' : ''}"
                onclick="selectPlayer('${escHtml(p.id)}')">
      <div>
        <div class="player-list-name">${escHtml(p.name)}</div>
        <div class="player-list-meta">ID: ${escHtml(p.id)}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:600;color:var(--accent);">${total.toLocaleString()}</div>
        <div class="player-list-meta">total logs</div>
      </div>
    </div>`;
  }).join('');
}

function selectPlayer(id) {
  STATE.selectedPlayer = id;
  $('#playerFilter').value = id;
  STATE.page = 1;
  applyAllFilters();
  updatePlayerListSelection();
}

function updatePlayerListSelection() {
  if (STATE.activeTab === 'overview') renderPlayerList();
}

function renderPlayerActivityChart() {
  destroyChart('playerActivity');
  const ctx = document.getElementById('playerActivityChart').getContext('2d');

  const players = STATE.selectedPlayer
    ? STATE.allPlayers.filter(p => p.id === STATE.selectedPlayer)
    : STATE.allPlayers.slice(0, 10);

  STATE.charts.playerActivity = new Chart(ctx, {
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
      responsive: true,
      maintainAspectRatio: false,
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
  const ctx = document.getElementById('eventDistChart').getContext('2d');

  // Aggregate all event types
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

  STATE.charts.eventDist = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k]) => String(k).slice(0, 20)),
      datasets: [{
        data: sorted.map(([, v]) => v),
        backgroundColor: ['#5865f2', '#7c3aed', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b8fa3', font: { size: 10 } } } }
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
