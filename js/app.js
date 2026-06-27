/* ======================================================
   Roblox Player Monitor – Client-Side Dashboard
   Tanpa Database | Live Saat Halaman Dibuka | Ekspor Data
   ====================================================== */

// ── STATE ──
const STATE = {
  activeTab: 'behavior',
  data: { behavior: [], gui: [], npc: [] },
  fullData: { behavior: [], gui: [], npc: [] },
  fullLoaded: { behavior: false, gui: false, npc: false },
  fullLoading: false,
  filtered: [],
  page: 1,
  rowsPerPage: 50,
  search: '',
  filterType: '',
  chartTimeline: null,
  chartHeatmap: null,
};

// ── DOM REFS ──
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ── INIT ──
async function init() {
  $('#currentDate').textContent = new Date().toLocaleDateString('id-ID', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  $('#footerDate').textContent = '2026-06-25';

  await loadAllData();
  setupTabs();
  setupSearch();
  setupFilter();
  setupExport();
  setupPagination();
  render();
}

// ── DATA LOADING ──
async function loadAllData() {
  try {
    // Load sample for fast initial render
    STATE.data.behavior = await fetchJSON('data/behavior_logs_sample.json');
    STATE.data.gui = await fetchJSON('data/gui_logs_sample.json');
    STATE.data.npc = await fetchJSON('data/npc_interactions_sample.json');
    console.log('✅ Sample data loaded:', {
      behavior: STATE.data.behavior.length,
      gui: STATE.data.gui.length,
      npc: STATE.data.npc.length,
    });
    // Start background load of full data
    loadFullDataBackground();
  } catch (e) {
    console.error('Gagal memuat data:', e);
    document.getElementById('tableBody').innerHTML =
      '<tr><td colspan="99" style="color:var(--red);text-align:center;padding:40px;">❌ Gagal memuat data. Pastikan file JSON tersedia di folder data/.</td></tr>';
  }
}

async function loadFullDataBackground() {
  if (STATE.fullLoading) return;
  STATE.fullLoading = true;
  const types = ['behavior', 'gui', 'npc'];
  const urls = {
    behavior: 'data/behavior_logs.json',
    gui: 'data/gui_logs.json',
    npc: 'data/npc_interactions.json',
  };
  
  for (const type of types) {
    try {
      STATE.fullData[type] = await fetchJSON(urls[type]);
      STATE.fullLoaded[type] = true;
      console.log(`✅ Full ${type} data: ${STATE.fullData[type].length} rows`);
    } catch (e) {
      console.warn(`⚠️ Gagal memuat full ${type}, fallback ke sample`);
      STATE.fullData[type] = [...STATE.data[type]];
    }
  }
  
  // Update badge if user on the tab that now has full data
  updateFullDataBadge();
}

function updateFullDataBadge() {
  const type = STATE.activeTab;
  if (STATE.fullLoaded[type]) {
    const badge = document.getElementById('fullDataBadge');
    if (badge) badge.style.display = 'none';
  }
}

function useFullData() {
  const type = STATE.activeTab;
  if (STATE.fullLoaded[type]) {
    STATE.data[type] = STATE.fullData[type];
    STATE.page = 1;
    applyFilters();
    updateFullDataBadge();
    return true;
  }
  return false;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ── TAB LOGIC ──
function setupTabs() {
  $$('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.activeTab = btn.dataset.tab;
      STATE.page = 1;
      STATE.filterType = '';
      updateFilterOptions();
      render();
    });
  });
}

// ── SEARCH ──
function setupSearch() {
  $('#searchInput').addEventListener('input', debounce((e) => {
    STATE.search = e.target.value.toLowerCase();
    STATE.page = 1;
    applyFilters();
  }, 250));
}

// ── FILTER ──
function setupFilter() {
  $('#filterType').addEventListener('change', (e) => {
    STATE.filterType = e.target.value;
    STATE.page = 1;
    applyFilters();
  });
}

function updateFilterOptions() {
  const data = getCurrentData();
  const sel = $('#filterType');
  sel.innerHTML = '<option value="">Semua</option>';

  let key;
  if (STATE.activeTab === 'behavior') key = 'event_type';
  else if (STATE.activeTab === 'gui') key = 'ui_element';
  else key = 'npc_target';

  const uniq = [...new Set(data.map(r => r[key]).filter(Boolean))].sort();
  uniq.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  });
  sel.value = STATE.filterType;
}

// ── DATA ──
function getCurrentData() {
  // Auto-use full data if loaded
  const type = STATE.activeTab;
  if (STATE.fullLoaded[type] && STATE.data[type].length < STATE.fullData[type].length) {
    STATE.data[type] = STATE.fullData[type];
  }
  return STATE.data[STATE.activeTab] || [];
}

function applyFilters() {
  let data = getCurrentData();
  const search = STATE.search;
  const ft = STATE.filterType;

  if (search) {
    data = data.filter(r =>
      Object.values(r).some(v =>
        v != null && String(v).toLowerCase().includes(search)
      )
    );
  }

  if (ft) {
    let key;
    if (STATE.activeTab === 'behavior') key = 'event_type';
    else if (STATE.activeTab === 'gui') key = 'ui_element';
    else key = 'npc_target';
    data = data.filter(r => r[key] === ft);
  }

  STATE.filtered = data;
  render();
}

// ── RENDER ──
function render() {
  const data = getCurrentData();
  applyFiltersQuick(data);
  updateStats(data);
  renderTable();
  renderPagination();
  updateExtraPanels(data);
}

function applyFiltersQuick(data) {
  let filtered = data;
  if (STATE.search) {
    filtered = filtered.filter(r =>
      Object.values(r).some(v =>
        v != null && String(v).toLowerCase().includes(STATE.search)
      )
    );
  }
  if (STATE.filterType) {
    let key;
    if (STATE.activeTab === 'behavior') key = 'event_type';
    else if (STATE.activeTab === 'gui') key = 'ui_element';
    else key = 'npc_target';
    filtered = filtered.filter(r => r[key] === STATE.filterType);
  }
  STATE.filtered = filtered;
}

// ── STATS ──
function updateStats(data) {
  const filtered = STATE.filtered;
  $('#statTotal').textContent = filtered.length.toLocaleString();

  if (STATE.activeTab === 'behavior') {
    const events = [...new Set(filtered.map(r => r.event_type))];
    $('#statEvents').textContent = events.length;
  } else if (STATE.activeTab === 'gui') {
    const els = [...new Set(filtered.map(r => r.ui_element))];
    $('#statEvents').textContent = els.length;
  } else {
    const npcs = [...new Set(filtered.map(r => r.npc_target))];
    $('#statEvents').textContent = npcs.length;
  }

  // Time range
  const timestamps = filtered.map(r => r.timestamp).filter(Boolean).sort();
  if (timestamps.length > 0) {
    const first = new Date(timestamps[0]);
    const last = new Date(timestamps[timestamps.length - 1]);
    const diffMin = Math.round((last - first) / 60000);
    $('#statFirstSeen').textContent = first.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    $('#statLastSeen').textContent = last.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    $('#statTimeRange').textContent = diffMin < 60 ? `${diffMin} menit` : `${Math.round(diffMin/60)} jam ${diffMin%60} m`;
  } else {
    $('#statFirstSeen').textContent = '—';
    $('#statLastSeen').textContent = '—';
    $('#statTimeRange').textContent = '—';
  }
}

// ── TABLE ──
function renderTable() {
  const filtered = STATE.filtered;
  const start = (STATE.page - 1) * STATE.rowsPerPage;
  const end = start + STATE.rowsPerPage;
  const pageData = filtered.slice(start, end);

  if (filtered.length === 0) {
    $('#tableHead').innerHTML = '';
    $('#tableBody').innerHTML =
      '<tr><td colspan="99" style="text-align:center;padding:40px;color:var(--text2);">📭 Tidak ada data yang cocok.</td></tr>';
    $('#rowsShown').textContent = 'Menampilkan 0 dari 0';
    return;
  }

  // Build headers from first row keys
  const cols = Object.keys(filtered[0]);

  $('#tableHead').innerHTML = `<tr>${cols.map(c => `<th>${formatHeader(c)}</th>`).join('')}</tr>`;

  $('#tableBody').innerHTML = pageData.map(row =>
    `<tr>${cols.map(c => `<td title="${escAttr(String(row[c] ?? ''))}" class="${cellClass(c, row[c])}">${formatCell(c, row[c])}</td>`).join('')}</tr>`
  ).join('');

  $('#rowsShown').textContent = `Menampilkan ${start + 1}–${Math.min(end, filtered.length)} dari ${filtered.length}`;
}

function formatHeader(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCell(key, val) {
  if (val == null) return '<span style="color:var(--text2);font-style:italic;">—</span>';
  const s = String(val);
  if (s.length > 60) return s.slice(0, 60) + '…';
  return escHtml(s);
}

function cellClass(key, val) {
  if (key === 'event_type' || key === 'ui_element') {
    if (val === 'move') return 'badge badge-move';
    if (val && String(val).toLowerCase().includes('click')) return 'badge badge-click';
    return 'badge badge-default';
  }
  if (key === 'role') {
    return val === 'user' ? 'role-user' : val === 'assistant' ? 'role-assistant' : '';
  }
  if (key === 'behavior_code') return 'style="max-width:200px;"';
  return '';
}

function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function escAttr(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── PAGINATION ──
function setupPagination() {
  $('#rowsPerPage').addEventListener('change', (e) => {
    STATE.rowsPerPage = parseInt(e.target.value);
    STATE.page = 1;
    render();
  });
}

function renderPagination() {
  const total = STATE.filtered.length;
  const totalPages = Math.ceil(total / STATE.rowsPerPage);
  const container = $('#pagination');

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button class="page-btn" ${STATE.page <= 1 ? 'disabled' : ''} onclick="goPage(${STATE.page - 1})">‹</button>`;

  const visiblePages = 5;
  let start = Math.max(1, STATE.page - Math.floor(visiblePages / 2));
  let end = Math.min(totalPages, start + visiblePages - 1);
  if (end - start < visiblePages - 1) start = Math.max(1, end - visiblePages + 1);

  if (start > 1) html += `<button class="page-btn" onclick="goPage(1)">1</button>`;
  if (start > 2) html += `<span style="color:var(--text2);padding:4px;">…</span>`;

  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn ${i === STATE.page ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
  }

  if (end < totalPages - 1) html += `<span style="color:var(--text2);padding:4px;">…</span>`;
  if (end < totalPages) html += `<button class="page-btn" onclick="goPage(${totalPages})">${totalPages}</button>`;

  html += `<button class="page-btn" ${STATE.page >= totalPages ? 'disabled' : ''} onclick="goPage(${STATE.page + 1})">›</button>`;

  container.innerHTML = html;
}

function goPage(p) {
  STATE.page = p;
  render();
}

// ── EXPORT ──
function setupExport() {
  $('#exportCSV').addEventListener('click', exportCSV);
  $('#exportExcel').addEventListener('click', exportExcel);
  $('#exportJSON').addEventListener('click', exportJSON);
  $('#loadFullBtn').addEventListener('click', () => {\n    const btn = $('#loadFullBtn');\n    const type = STATE.activeTab;\n    if (STATE.fullLoaded[type]) {\n      // Force refresh\n      STATE.data[type] = STATE.fullData[type];\n      STATE.page = 1;\n      applyFilters();\n      return;\n    }\n    btn.textContent = '⏳ Loading…';\n    btn.disabled = true;\n    // Trigger background load if not started\n    if (!STATE.fullLoading) {\n      loadFullDataBackground().then(() => {\n        useFullData();\n        btn.textContent = '✅ Full Loaded';\n        setTimeout(() => { btn.textContent = '📦 Muat Full'; btn.disabled = true; }, 2000);\n      });\n    } else {\n      // Already loading, poll\n      const check = setInterval(() => {\n        if (STATE.fullLoaded[type]) {\n          clearInterval(check);\n          useFullData();\n          btn.textContent = '✅ Full Loaded';\n          setTimeout(() => { btn.textContent = '📦 Muat Full'; btn.disabled = true; }, 2000);\n        }\n      }, 500);\n    }\n  });\n  // Disable button once full data auto-loads\n  setInterval(() => {\n    const type = STATE.activeTab;\n    const btn = $('#loadFullBtn');\n    if (STATE.fullLoaded[type]) {\n      btn.textContent = '✅ Full Ready';\n      btn.disabled = true;\n    }\n  }, 2000);\n}

function getExportData() {
  const type = STATE.activeTab;
  // Use full data for export if available
  const source = (STATE.fullLoaded[type] && STATE.fullData[type].length > 0)
    ? STATE.fullData[type]
    : getCurrentData();
  // If user has active search/filter, export filtered; otherwise export all
  if (STATE.search || STATE.filterType) {
    return STATE.filtered.length > 0 ? STATE.filtered : source;
  }
  return source;
}

function exportCSV() {
  const data = getExportData();
  if (!data.length) return alert('Tidak ada data untuk diekspor.');
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
  downloadFile(csvRows.join('\n'), `${STATE.activeTab}_logs_${dateStamp()}.csv`, 'text/csv');
}

function exportExcel() {
  const data = getExportData();
  if (!data.length) return alert('Tidak ada data untuk diekspor.');
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ARG_Report');
  XLSX.writeFile(wb, `${STATE.activeTab}_logs_${dateStamp()}.xlsx`);
}

function exportJSON() {
  const data = getExportData();
  if (!data.length) return alert('Tidak ada data untuk diekspor.');
  downloadFile(JSON.stringify(data, null, 2), `${STATE.activeTab}_logs_${dateStamp()}.json`, 'application/json');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType }); // BOM for Excel UTF-8 compat
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── EXTRA PANELS (Behavior) ──
function updateExtraPanels(data) {
  const panelDiv = $('#extraPanels');
  if (STATE.activeTab === 'behavior' && data.length > 0) {
    panelDiv.style.display = 'grid';
    drawTimeline(data);
    drawHeatmap(data);
  } else {
    panelDiv.style.display = 'none';
    if (STATE.chartTimeline) { STATE.chartTimeline.destroy(); STATE.chartTimeline = null; }
    if (STATE.chartHeatmap) { STATE.chartHeatmap.destroy(); STATE.chartHeatmap = null; }
  }
}

function drawTimeline(data) {
  // Aggregate moves by second
  const buckets = {};
  data.forEach(r => {
    if (r.timestamp) {
      const sec = r.timestamp.slice(0, 19); // YYYY-MM-DDTHH:MM:SS
      buckets[sec] = (buckets[sec] || 0) + 1;
    }
  });

  const sorted = Object.entries(buckets).sort();
  // Sample if too many
  const maxPoints = 120;
  const step = Math.max(1, Math.ceil(sorted.length / maxPoints));
  const sampled = sorted.filter((_, i) => i % step === 0);

  const labels = sampled.map(([k]) => new Date(k + '.000Z').toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const values = sampled.map(([, v]) => v);

  const ctx = $('#timelineCanvas').getContext('2d');
  if (STATE.chartTimeline) STATE.chartTimeline.destroy();

  STATE.chartTimeline = new Chart(ctx, {
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
}

function drawHeatmap(data) {
  const ctx = $('#heatmapCanvas').getContext('2d');
  if (STATE.chartHeatmap) STATE.chartHeatmap.destroy();

  // Collect X,Y positions
  const points = data
    .filter(r => r.x != null && r.y != null)
    .map(r => ({ x: parseFloat(r.x), y: parseFloat(r.y) }));

  if (points.length < 2) {
    ctx.fillStyle = '#8b8fa3';
    ctx.font = '14px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('Data posisi tidak cukup', 200, 200);
    return;
  }

  STATE.chartHeatmap = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Posisi',
        data: points,
        backgroundColor: 'rgba(88,101,242,.4)',
        borderColor: 'rgba(88,101,242,.8)',
        pointRadius: 3,
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

// ── UTILS ──
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ── START ──
document.addEventListener('DOMContentLoaded', init);
