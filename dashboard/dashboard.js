// ── Niu-MissionControl Dashboard — All Tab Init Functions ──
// Loaded via <script src="dashboard.js"> in index.html
// Requirements: API_BASE, fetchJSON, badge from index.html

// ============================================================
// OVERVIEW TAB
// ============================================================
window.initTab_overview = async function initOverview() {
  await Promise.allSettled([
    renderSystem(), renderAgents(), renderGateway(),
    renderKanban(), renderCron(), renderActivity(),
    renderStats(), renderTokens(), renderProjects()
  ]);
};

async function renderSystem() {
  const el = document.getElementById('system-widget');
  const data = await fetchJSON(API_BASE + '/api/mc/system');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const hRing = document.getElementById('healthRing');
  const score = data.health_score ?? 0;
  if (score >= 80) hRing.className = 'health-ring good'; else if (score >= 50) hRing.className = 'health-ring fair'; else hRing.className = 'health-ring bad';
  hRing.textContent = score;
  let diskHtml = (data.disks || []).map(d => '<div style="margin-bottom:6px;"><div class="row"><span class="label">' + d.mount + '</span><span class="value">' + d.free_gb + 'GB free / ' + d.total_gb + 'GB</span></div><div class="disk-bar"><div class="fill ' + d.status + '" style="width:' + d.used_pct + '%"></div></div></div>').join('');
  el.innerHTML = '<div class="card-content"><div class="row"><span class="label">Uptime</span><span class="value">' + (data.uptime || '?') + '</span></div><div class="row"><span class="label">Memory</span><span class="value">' + (data.memory?.free_gb || '?') + 'GB free / ' + (data.memory?.total_gb || '?') + 'GB</span></div><div class="row"><span class="label">Memory Pressure</span><span class="value">' + badge(data.memory?.pressure || 'unknown') + '</span></div><div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e293b;">' + diskHtml + '</div></div>';
}

async function renderKanban() {
  const el = document.getElementById('kanban-widget');
  const data = await fetchJSON('http://localhost:5199/api/stats');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ Kanban offline (http://localhost:5199)</div>'; return; }
  let rows = (data.byStatus || []).map(s => '<div class="row"><span class="label">' + badge(s.status) + ' ' + s.status + '</span><span class="value">' + s.count + '</span></div>').join('');
  let priRows = (data.byPriority || []).map(p => '<div class="row"><span class="label">Priority ' + p.priority + '</span><span class="value">' + p.count + '</span></div>').join('');
  el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;"><div><h4 style="font-size:11px;color:#64748b;margin-bottom:8px;">By Status</h4>' + rows + '</div><div><h4 style="font-size:11px;color:#64748b;margin-bottom:8px;">By Priority</h4>' + priRows + '</div></div><div style="margin-top:12px;padding-top:12px;border-top:1px solid #1e293b;font-size:12px;text-align:center;"><strong>' + (data.total || 0) + '</strong> total tasks</div>';
}

async function renderAgents() {
  const el = document.getElementById('agents-widget');
  const c = document.getElementById('agent-count');
  const data = await fetchJSON(API_BASE + '/api/mc/agents');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const agents = data.agents || [];
  c.textContent = agents.length ? '(' + agents.length + ')' : '(0)';
  if (agents.length === 0) { el.innerHTML = '<div class="card-content" style="color:#64748b;">No herdr agents spawned.</div>'; return; }
  const emojiMap = { 'builder':'🏗️','pembangun':'🏗️','pengawas':'🔍','arsitek':'📐','penjaga':'🛡️','scribe':'✍️','reach':'📡' };
  const html = agents.map(a => { const name = (a.name || '').toLowerCase(); const emoji = Object.entries(emojiMap).find(([k]) => name.includes(k))?.[1] || '🤖'; return '<div class="agent-row"><span class="emoji">' + emoji + '</span><span class="name">' + a.name + '</span>' + badge(a.status) + '<span class="status-text">' + (a.tab || '') + '</span></div>'; }).join('');
  el.innerHTML = '<div class="card-content" style="margin-bottom:6px;">herdr: ' + badge(data.herdr_connected ? 'connected' : 'offline') + '</div>' + html;
}

async function renderGateway() {
  const el = document.getElementById('gateway-widget');
  const data = await fetchJSON(API_BASE + '/api/mc/gateway');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const gw = data.gateway_state || {};
  el.innerHTML = '<div class="card-content"><div class="row"><span class="label">launchd</span><span class="value">' + (data.launchd_status?.gateway_running ? badge('running') : badge('stopped')) + '</span></div><div class="row"><span class="label">PID</span><span class="value">' + (gw.pid || '-') + '</span></div><div class="row"><span class="label">State</span><span class="value">' + badge(gw.gateway_state || 'unknown') + '</span></div><div class="row"><span class="label">Lock file</span><span class="value">' + (data.gateway_lock?.exists ? '✅' : '❌') + '</span></div><div class="row"><span class="label">Agen aktif</span><span class="value">' + (gw.active_agents ?? '?') + '</span></div><div class="row"><span class="label">Platform</span><span class="value">' + Object.keys(gw.platforms || {}).length + '</span></div></div>';
}

async function renderCron() {
  const el = document.getElementById('cron-widget');
  const data = await fetchJSON(API_BASE + '/api/mc/cron');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const jobs = data.cron_jobs || data.state_db_cron || [];
  if (jobs.length === 0) { el.innerHTML = '<div class="card-content" style="color:#64748b;">Tidak ada cron jobs</div>'; return; }
  let rows = jobs.slice(0, 8).map(j => '<div class="row"><span class="label">' + ((j.enabled !== false) ? '' : '⏸ ') + (j.name || j.job_name || j.id || '?') + '</span><span class="value">' + badge(j.last_status || j.status || 'unknown') + ' ' + (j.schedule || j.cron_expr || j.interval || '?') + '</span></div>').join('');
  el.innerHTML = '<div class="card-content"><div class="row"><span class="label">Total jobs</span><span class="value">' + jobs.length + '</span></div>' + rows + '</div>';
}

async function renderActivity() {
  const el = document.getElementById('activity-widget');
  const data = await fetchJSON(API_BASE + '/api/mc/activity?limit=8');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const items = data.activities || data.data || [];
  if (items.length === 0) { el.innerHTML = '<div class="card-content" style="color:#64748b;">Belum ada aktivitas tercatat</div>'; return; }
  let rows = items.slice(0, 8).map(a => '<div class="row"><span class="label">' + (a.agent || a.type || '?') + '</span><span class="value">' + (a.message || a.action || '').substring(0, 50) + '</span></div>').join('');
  el.innerHTML = '<div class="card-content">' + rows + '</div>';
}

async function renderStats() {
  const el = document.getElementById('stats-widget');
  const agg = await fetchJSON(API_BASE + '/api/mc/aggregated');
  el.innerHTML = '<div class="card-content"><div class="row"><span class="label">Git repos</span><span class="value">' + ((agg.projects || {}).total_repos || 0) + ' (' + ((agg.projects || {}).dirty_repos || 0) + ' dirty)</span></div><div class="row"><span class="label">Agen</span><span class="value">' + ((agg.agents || {}).agent_count || 0) + ' deployed</span></div><div class="row"><span class="label">Kanban</span><span class="value">' + ((agg.kanban || {}).total || '?') + ' tasks</span></div><div class="row"><span class="label">Host</span><span class="value">' + ((agg.system || {}).hostname || '?') + '</span></div><div class="row"><span class="label">Uptime</span><span class="value">' + ((agg.system || {}).uptime || '?') + '</span></div></div>';
}

async function renderTokenChart(tokens) {
  const canvas = document.getElementById('tokenChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (window._tokenChart) window._tokenChart.destroy();
  const labels = tokens.slice(0, 8).map(t => t.model || t.provider || '?');
  const inData = tokens.slice(0, 8).map(t => t.tokens_in || t.in || 0);
  const outData = tokens.slice(0, 8).map(t => t.tokens_out || t.out || 0);
  if (inData.length === 0 && outData.length === 0) return;
  if (typeof Chart === 'undefined') return;
  window._tokenChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Input', data: inData, backgroundColor: '#22d3ee44', borderColor: '#22d3ee', borderWidth: 1 },
        { label: 'Output', data: outData, backgroundColor: '#34d39944', borderColor: '#34d399', borderWidth: 1 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10, family: 'JetBrains Mono' } } } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: '#1e293b' } }
      }
    }
  });
}

async function renderTokens() {
  const el = document.getElementById('tokens-widget');
  const data = await fetchJSON(API_BASE + '/api/mc/tokens');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const tokens = data.token_usage || data.data || [];
  renderTokenChart(tokens);
  if (tokens.length === 0) { el.innerHTML = '<div class="card-content" style="color:#64748b;">Belum ada data token</div>'; return; }
  let total = tokens.reduce((s, t) => s + (t.total_tokens || t.tokens || 0), 0);
  let rows = tokens.slice(0, 5).map(t => '<div class="row"><span class="label">' + (t.model || t.provider || '?') + '</span><span class="value">' + (t.total_tokens || t.tokens || 0).toLocaleString() + '</span></div>').join('');
  el.innerHTML = '<div class="card-content"><div class="row"><span class="label">Total token</span><span class="value">' + total.toLocaleString() + '</span></div>' + rows + '</div>';
}

async function renderProjects() {
  const el = document.getElementById('projects-widget');
  const c = document.getElementById('proj-count');
  const data = await fetchJSON(API_BASE + '/api/mc/projects');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const cats = data.categories || {};
  c.textContent = '(' + (data.total_repos || 0) + ' repos, ' + (data.dirty_repos || 0) + ' dirty)';
  let html = '';
  for (const [catName, repos] of Object.entries(cats)) {
    const entries = Object.entries(repos);
    if (entries.length === 0) continue;
    html += '<div style="margin-bottom:12px;"><h4 style="font-size:10px;color:#64748b;margin-bottom:6px;">' + catName + '</h4><div class="project-grid">';
    for (const [name, info] of entries) {
      html += '<div class="project-card"><div class="proj-name">' + name + ' ' + badge(info.dirty ? 'yellow' : 'green') + '</div><div class="proj-meta">' + (info.branch || '?') + ' · ' + (info.changes || 0) + ' changes</div></div>';
    }
    html += '</div></div>';
  }
  el.innerHTML = html || '<div class="card-content" style="color:#64748b;">Tidak ada git repos</div>';
}

// ============================================================
// AGENTS TAB
// ============================================================
window.initTab_agents = async function initAgents() {
  await Promise.allSettled([
    renderToolCard(2, 'builder'), renderToolCard(3, 'pengawas'),
    renderToolCard(4, 'arsitek'), renderToolCard(5, 'penjaga'),
    renderToolCard(6, 'scribe'), renderToolCard(7, 'reach'),
    renderHeatmap(), renderActivityChart()
  ]);
};

const TOOL_AGENTS = {
  2: { name: 'Builder', emoji: '🏗️', color: '#22d3ee' },
  3: { name: 'Pengawas', emoji: '🔍', color: '#fbbf24' },
  4: { name: 'Arsitek', emoji: '📐', color: '#a78bfa' },
  5: { name: 'Penjaga', emoji: '🛡️', color: '#34d399' },
  6: { name: 'Scribe', emoji: '✍️', color: '#f472b6' },
  7: { name: 'Reach', emoji: '📡', color: '#fb923c' }
};

async function renderToolCard(topicId, toolName) {
  const el = document.getElementById('agent-' + topicId + '-status');
  try {
    const contentData = await fetchJSON(API_BASE + '/api/mc/content?agent=' + toolName);
    const activityData = await fetchJSON(API_BASE + '/api/mc/activity?limit=5');
    const activities = (activityData.activities || activityData.data || []).filter(a => (a.agent || '').toLowerCase() === toolName);
    const items = contentData.data || contentData.contents || [];
    el.innerHTML = '<div class="row"><span class="label">Status</span><span class="value">' + badge('ready') + '</span></div>' +
                   '<div class="row"><span class="label">Item Konten</span><span class="value">' + items.length + '</span></div>' +
                   '<div class="row"><span class="label">Aktivitas</span><span class="value">' + activities.length + ' terkini</span></div>' +
                   (activities.length > 0 ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e293b;font-size:10px;color:#64748b;">' + 
                     activities.slice(0, 3).map(a => '• ' + (a.message || a.action || '').substring(0, 40)).join('<br>') + '</div>' : '');
  } catch (e) {
    el.innerHTML = '<div class="error-state">⚠ ' + e.message + '</div>';
  }
}

async function renderHeatmap() {
  const el = document.getElementById('heatmap-widget');
  const data = await fetchJSON(API_BASE + '/api/mc/activity/stats');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const stats = data.stats || data.data || [];
  if (stats.length === 0) {
    el.innerHTML = '<div class="card-content" style="color:#64748b;">Belum cukup data untuk heatmap (butuh minimal 7 hari aktivitas)</div>';
    return;
  }
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const agentNames = ['builder', 'pengawas', 'arsitek', 'penjaga', 'scribe', 'reach'];
  const agentEmoji = { builder:'🏗️', pengawas:'🔍', arsitek:'📐', penjaga:'🛡️', scribe:'✍️', reach:'📡' };
  let html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:11px;">';
  html += '<tr><td style="padding:4px 8px;color:#64748b;">Agen</td>';
  for (let d = 6; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    html += '<td style="padding:4px 6px;text-align:center;color:#64748b;">' + days[date.getDay()] + '<br><span style="font-size:9px;">' + date.getDate() + '/' + (date.getMonth()+1) + '</span></td>';
  }
  html += '</tr>';
  for (const agent of agentNames) {
    html += '<tr><td style="padding:4px 8px;">' + (agentEmoji[agent] || '🤖') + ' ' + agent + '</td>';
    for (let d = 6; d >= 0; d--) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      const count = (stats.find(s => s.agent === agent && s.date === dateStr) || {}).count || 0;
      const intensity = count > 10 ? '#22d3ee' : count > 5 ? '#0891b2' : count > 2 ? '#155e75' : count > 0 ? '#0c4a6e' : '#1e293b';
      html += '<td style="padding:4px 6px;text-align:center;background:' + intensity + ';border-radius:4px;font-size:10px;color:' + (count > 2 ? '#fff' : '#475569') + ';">' + (count || '·') + '</td>';
    }
    html += '</tr>';
  }
  html += '</table><div style="margin-top:8px;font-size:9px;color:#475569;text-align:right;">Semakin terang = semakin aktif</div></div>';
  el.innerHTML = html;
}

async function renderActivityChart() {
  const el = document.getElementById('activity-chart-widget');
  const data = await fetchJSON(API_BASE + '/api/mc/activity/stats');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const stats = data.stats || data.data || [];
  if (stats.length === 0) {
    el.innerHTML = '<div class="card-content" style="color:#64748b;">Belum ada data aktivitas untuk ditampilkan</div>';
    return;
  }
  const agentMap = {};
  for (const s of stats) {
    if (!agentMap[s.agent]) agentMap[s.agent] = 0;
    agentMap[s.agent] += s.count || 0;
  }
  const sorted = Object.entries(agentMap).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0]?.[1] || 1;
  const agentEmoji = { builder:'🏗️', pengawas:'🔍', arsitek:'📐', penjaga:'🛡️', scribe:'✍️', reach:'📡' };
  const colors = ['#22d3ee', '#fbbf24', '#a78bfa', '#34d399', '#f472b6', '#fb923c'];
  let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
  sorted.forEach(([agent, count], i) => {
    const pct = (count / maxCount) * 100;
    html += '<div style="display:flex;align-items:center;gap:8px;"><span style="min-width:80px;font-size:11px;">' + (agentEmoji[agent] || '🤖') + ' ' + agent + '</span><div style="flex:1;height:20px;background:#1e293b;border-radius:4px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:' + (colors[i] || '#22d3ee') + ';border-radius:4px;transition:width 0.5s;"></div></div><span style="min-width:50px;text-align:right;font-size:11px;color:#94a3b8;">' + count + '</span></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

// ============================================================
// CHAT TAB
// ============================================================
window.initTab_chat = async function initChat() {
  const data = await fetchJSON(API_BASE + '/api/mc/activity?limit=10');
  const el = document.getElementById('chat-history');
  const items = Array.isArray(data) ? data : (data.activities || data.data || []);
  if (items.length === 0) {
    el.innerHTML = '<div class="card-content" style="color:#64748b;">Belum ada riwayat chat. Kirim pesan melalui Telegram atau gunakan form di atas.</div>';
  } else {
    let html = items.map(a => {
      const time = (a.created_at || '').substring(0, 16);
      const emojiMap = { builder:'🏗️', pengawas:'🔍', arsitek:'📐', penjaga:'🛡️', scribe:'✍️', reach:'📡' };
      const emoji = emojiMap[a.agent] || '💬';
      return '<div class="agent-row"><span class="emoji">' + emoji + '</span><span class="name">' + (a.agent || 'system') + '</span>' + badge(a.status || 'unknown') + '<span class="status-text">' + (a.task || a.message || a.action || '').substring(0, 80) + '</span><span style="font-size:9px;color:#475569;margin-left:auto;">' + time + '</span></div>';
    }).join('');
    el.innerHTML = '<div class="card-content">' + html + '</div>';
  }
};

async function sendChatMessage() {
  const topic = document.getElementById('chat-topic').value;
  const text = document.getElementById('chat-input').value.trim();
  const respEl = document.getElementById('chat-response');
  if (!text) { respEl.innerHTML = '<span style="color:#ef4444;">⚠ Ketik pesan terlebih dahulu</span>'; return; }
  respEl.innerHTML = '<span style="color:#fbbf24;">⏳ Mengirim ke topic #' + topic + '...</span>';
  try {
    const r = await fetch(API_BASE + '/api/mc/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, topic_id: topic })
    });
    const result = await r.json();
    if (result.status === 'sent') {
      respEl.innerHTML = '<span style="color:#34d399;">✅ Pesan terkirim ke ' + (result.persona || 'topic ' + topic) + '</span>';
    } else {
      respEl.innerHTML = '<span style="color:#ef4444;">⚠ ' + (result.message || 'Gagal kirim') + '</span>';
    }
  } catch (e) {
    respEl.innerHTML = '<span style="color:#ef4444;">⚠ ' + e.message + '</span>';
  }
  document.getElementById('chat-input').value = '';
  initChat();
}

// ============================================================
// CONTENT TAB
// ============================================================
window.initTab_content = async function initContent() {
  loadContent();
};

async function loadContent() {
  const el = document.getElementById('content-list');
  const countEl = document.getElementById('content-count');
  const agent = document.getElementById('content-filter').value;
  let url = API_BASE + '/api/mc/content';
  if (agent) url += '?agent=' + encodeURIComponent(agent);
  const data = await fetchJSON(url);
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const items = Array.isArray(data) ? data : (data.contents || data.data || []);
  countEl.textContent = items.length + ' dokumen';
  if (items.length === 0) { el.innerHTML = '<div class="card-content" style="color:#64748b;">Belum ada konten tersimpan</div>'; return; }
  const agentEmoji = { builder:'🏗️', pengawas:'🔍', arsitek:'📐', penjaga:'🛡️', scribe:'✍️', reach:'📡' };
  let html = items.map(c => {
    const agentName = c.agent || '?';
    const emoji = agentEmoji[agentName] || '📄';
    return '<div style="margin-bottom:8px;padding:10px;background:#1e293b;border-radius:6px;border-left:3px solid #22d3ee;">' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">' +
      '<span style="font-size:11px;font-weight:600;color:#f1f5f9;">' + emoji + ' ' + (c.title || c.name || 'Untitled') + '</span>' +
      '<span style="font-size:10px;color:#64748b;">' + badge(c.status || 'draft') + '</span></div>' +
      '<div style="font-size:10px;color:#94a3b8;">' + (c.description || c.summary || '').substring(0, 120) + '</div>' +
      '<div style="font-size:9px;color:#475569;margin-top:4px;display:flex;justify-content:space-between;">' +
      '<span>' + emoji + ' ' + agentName + '</span>' +
      '<span>' + (c.word_count || 0) + ' kata · ' + (c.created_at || '').substring(0, 10) + '</span></div>' +
      '</div>';
  }).join('');
  el.innerHTML = html;
}

// ============================================================
// SCHEDULE TAB
// ============================================================
window.initTab_schedule = async function initSchedule() {
  const [cronData, activityData] = await Promise.allSettled([
    fetchJSON(API_BASE + '/api/mc/cron'),
    fetchJSON(API_BASE + '/api/mc/activity?limit=20')
  ]);
  renderCronFull(cronData.value);
  renderCronUpcoming(cronData.value);
  renderCronHistory(activityData.value);
};

function renderCronFull(data) {
  const el = document.getElementById('cron-full');
  if (data && data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const jobs = (data && data.cron_jobs) || (data && data.state_db_cron) || [];
  if (jobs.length === 0) { el.innerHTML = '<div class="card-content" style="color:#64748b;">Tidak ada cron jobs terdaftar</div>'; return; }
  let rows = jobs.map(j => {
    const jobId = j.id || '';
    const name = j.name || j.job_name || j.id || 'Unnamed';
    const schedule = j.schedule || j.cron_expr || j.interval || '?';
    const status = j.last_status || j.status || 'unknown';
    const lastRun = j.last_run_at ? new Date(j.last_run_at).toLocaleString('id-ID') : (j.last_run || '-');
    return '<div class="card-content" style="margin-bottom:8px;padding:8px;background:#1e293b;border-radius:6px;">' +
      '<div class="row"><span class="label">' + (j.enabled !== false ? '' : '⏸ ') + name + '</span><span class="value">' + badge(status) + '</span></div>' +
      '<div class="row"><span class="label">Jadwal</span><span class="value">' + schedule + '</span></div>' +
      '<div class="row"><span class="label">Terakhir</span><span class="value">' + lastRun + '</span></div>' +
      '<div style="display:flex;gap:8px;margin-top:8px;">' +
      '<button onclick="triggerCron(\'' + jobId + '\')" style="background:#0f172a;border:1px solid #22d3ee;color:#22d3ee;font-family:monospace;font-size:10px;padding:4px 10px;border-radius:4px;cursor:pointer;">▶ Jalankan</button>' +
      '</div></div>';
  }).join('');
  el.innerHTML = rows;
}

function renderCronUpcoming(data) {
  const el = document.getElementById('cron-upcoming');
  if (data && data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const jobs = (data && data.cron_jobs) || (data && data.state_db_cron) || [];
  const now = new Date();
  let upcoming = jobs.filter(j => j.next_run || j.next_run_at).map(j => ({
    name: j.name || j.job_name || j.id || 'Unnamed',
    next: new Date(j.next_run || j.next_run_at),
    schedule: j.schedule || j.cron_expr || j.interval || '?'
  })).sort((a, b) => a.next - b.next).slice(0, 10);
  if (upcoming.length === 0) { el.innerHTML = '<div class="card-content" style="color:#64748b;">Tidak ada jadwal mendatang</div>'; return; }
  let rows = upcoming.map(u => {
    const diff = u.next - now;
    const diffStr = diff > 0 ? Math.round(diff / 3600000) + 'j lagi' : 'sekarang';
    return '<div class="card-content" style="margin-bottom:6px;padding:6px;background:#1e293b;border-radius:4px;">' +
      '<div class="row"><span class="label">' + u.name + '</span><span class="value">' + diffStr + '</span></div>' +
      '<div class="row"><span class="label">' + u.next.toLocaleString('id-ID') + '</span><span class="value">' + u.schedule + '</span></div></div>';
  }).join('');
  el.innerHTML = rows;
}

async function triggerCron(jobId) {
  if (!jobId) return;
  const btn = event.target;
  btn.textContent = '⏳...';
  btn.disabled = true;
  try {
    const r = await fetch(API_BASE + '/api/mc/cron/run/' + encodeURIComponent(jobId), { method: 'POST' });
    const result = await r.json();
    if (result.status === 'triggered') {
      btn.textContent = '✅ Triggered';
      setTimeout(() => { btn.textContent = '▶ Jalankan'; btn.disabled = false; }, 2000);
    } else {
      btn.textContent = '⚠ Gagal';
      setTimeout(() => { btn.textContent = '▶ Jalankan'; btn.disabled = false; }, 3000);
    }
  } catch (e) {
    btn.textContent = '⚠ Error';
    setTimeout(() => { btn.textContent = '▶ Jalankan'; btn.disabled = false; }, 3000);
  }
  setTimeout(initSchedule, 2000);
}

function renderCronHistory(data) {
  const el = document.getElementById('cron-history');
  const items = Array.isArray(data) ? data : ((data && data.activities) || (data && data.data) || []);
  if (items.length === 0) { el.innerHTML = '<div class="card-content" style="color:#64748b;">Belum ada riwayat eksekusi</div>'; return; }
  let html = '<div class="card-content">';
  items.slice(0, 20).forEach(a => {
    const time = a.created_at || a.timestamp || '';
    const emojiMap = { builder:'🏗️', pengawas:'🔍', arsitek:'📐', penjaga:'🛡️', scribe:'✍️', reach:'📡' };
    const emoji = emojiMap[a.agent] || '📊';
    html += '<div class="row"><span class="label">' + emoji + ' ' + (a.agent || 'system') + '</span><span class="value">' + badge(a.status || 'unknown') + ' ' + (a.task || a.message || a.action || '').substring(0, 50) + '</span></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

// ============================================================
// DOCS TAB
// ============================================================
window.initTab_docs = async function initDocs() {
  const el = document.getElementById('docs-list');
  // Try scanning DOX directory via terminal
  try {
    const r = await fetch(API_BASE + '/api/mc/terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'ls -la DOX/' })
    });
    const result = await r.json();
    const output = result.output || '';
    if (output) {
      const lines = output.split('\n').filter(l => l.includes('.md'));
      if (lines.length > 0) {
        let html = lines.map(line => {
          const parts = line.trim().split(/\s+/);
          const filename = parts[parts.length - 1];
          const size = parts[4] || '?';
          const date = parts[5] + ' ' + parts[6] || '';
          const emoji = filename.includes('MASTERPLAN') ? '📋' :
                       filename.includes('PRD') ? '📋' :
                       filename.includes('TECHSPEC') ? '🔧' :
                       filename.includes('UX') ? '🎨' :
                       filename.includes('TIMELINE') ? '📅' :
                       filename.includes('TESTING') ? '🧪' :
                       filename.includes('DEPLOY') ? '🚀' :
                       filename.includes('AGENTS') ? '🤖' :
                       filename.includes('RUNBOOK') ? '📘' :
                       filename.includes('PLAN') ? '📝' : '📄';
          return '<div class="project-card"><div class="proj-name">' + emoji + ' ' + filename + '</div><div class="proj-meta">' + size + 'B · Terakhir: ' + date + '</div></div>';
        }).join('');
        el.innerHTML = html;
        return;
      }
    }
  } catch (e) {}
  renderStaticDocs(el);
};

function renderStaticDocs(el) {
  el.innerHTML = `
    <div class="project-card"><div class="proj-name">📋 MASTERPLAN.md</div><div class="proj-meta">1159 baris · Rencana induk proyek · 17 Jul 2026</div></div>
    <div class="project-card"><div class="proj-name">📋 DOX/PRD.md</div><div class="proj-meta">Product Requirements Document · Spesifikasi fitur lengkap</div></div>
    <div class="project-card"><div class="proj-name">📋 DOX/TECHSPEC.md</div><div class="proj-meta">Technical Specification · Arsitektur & API</div></div>
    <div class="project-card"><div class="proj-name">📋 DOX/UX.md</div><div class="proj-meta">UserFlow & Wireframe · 6 perjalanan pengguna</div></div>
    <div class="project-card"><div class="proj-name">📋 DOX/TIMELINE.md</div><div class="proj-meta">Timeline · 6 fase dengan milestones</div></div>
    <div class="project-card"><div class="proj-name">📋 DOX/TESTING.md</div><div class="proj-meta">Testing & QA · 100% smoke test coverage</div></div>
    <div class="project-card"><div class="proj-name">📋 DOX/DEPLOY.md</div><div class="proj-meta">Deployment · RTO 15 menit, RPO 1 jam</div></div>
    <div class="project-card"><div class="proj-name">📋 DOX/AGENTS.md</div><div class="proj-meta">Panduan agent persona</div></div>
    <div class="project-card"><div class="proj-name">📋 DOX/RUNBOOK.md</div><div class="proj-meta">Runbook operasional</div></div>
    <div class="project-card"><div class="proj-name">📋 DOX/PLAN.md</div><div class="proj-meta">Rencana kerja agent</div></div>
  `;
}

// ============================================================
// OFFICE TAB
// ============================================================
window.initTab_office = async function initOffice() {
  await Promise.allSettled([renderTowers(), renderEcosystem()]);
};

async function renderTowers() {
  const el = document.getElementById('tower-container');
  const [aggData, statsData] = await Promise.allSettled([
    fetchJSON(API_BASE + '/api/mc/aggregated'),
    fetchJSON(API_BASE + '/api/mc/activity/stats')
  ]);
  const agg = aggData.value || {};
  const stats = statsData.value || {};
  const agentStats = stats.by_agent || {};
  const agents = [
    { id: 'builder', name: 'Builder', emoji: '🏗️', color: '#22d3ee', glow: '#22d3ee' },
    { id: 'pengawas', name: 'Pengawas', emoji: '🔍', color: '#34d399', glow: '#34d399' },
    { id: 'arsitek', name: 'Arsitek', emoji: '📐', color: '#fbbf24', glow: '#fbbf24' },
    { id: 'penjaga', name: 'Penjaga', emoji: '🛡️', color: '#a78bfa', glow: '#a78bfa' },
    { id: 'scribe', name: 'Scribe', emoji: '✍️', color: '#f472b6', glow: '#f472b6' },
    { id: 'reach', name: 'Reach', emoji: '📡', color: '#fb923c', glow: '#fb923c' },
  ];
  const maxCount = Math.max(1, ...agents.map(a => agentStats[a.id] || 1));
  let html = agents.map(a => {
    const count = agentStats[a.id] || 0;
    const height = Math.max(30, Math.round((count / maxCount) * 180));
    const isActive = count > 0;
    return '<div class="agent-tower">' +
      '<div class="tower-body" style="height:' + height + 'px;background:linear-gradient(180deg,' + a.color + '44,' + a.color + '22);border:1px solid ' + a.color + '66;">' +
      '<div class="tower-glow" style="background:' + a.glow + ';box-shadow:0 0 12px ' + a.glow + '66;' + (isActive ? '' : 'opacity:0.3;') + '"></div>' +
      '<span style="font-size:16px;display:block;text-align:center;margin-top:' + Math.max(4, height - 40) + 'px;">' + a.emoji + '</span></div>' +
      '<div class="tower-base" style="background:' + a.color + '44' + ';border:1px solid ' + a.color + '44' + ';"></div>' +
      '<div class="tower-label" style="color:' + a.color + ';">' + a.name + '</div>' +
      '<div class="tower-count">' + count + ' tasks</div>' +
      '</div>';
  }).join('');
  el.innerHTML = html;
}

async function renderEcosystem() {
  const el = document.getElementById('office-ecosystem');
  const [agg, projects] = await Promise.allSettled([
    fetchJSON(API_BASE + '/api/mc/aggregated'),
    fetchJSON(API_BASE + '/api/mc/projects')
  ]);
  const a = agg.value || {};
  const p = projects.value || {};
  const cats = p.categories || {};
  let totalRepos = 0;
  let repoList = '';
  for (const [catName, repos] of Object.entries(cats)) {
    const entries = Object.entries(repos);
    if (entries.length === 0) continue;
    totalRepos += entries.length;
    repoList += '<div style="margin-bottom:6px;"><span style="font-size:10px;color:#64748b;">' + catName + ':</span> ';
    repoList += entries.slice(0, 5).map(([name]) => name).join(', ');
    if (entries.length > 5) repoList += ' +' + (entries.length - 5) + ' lainnya';
    repoList += '</div>';
  }
  el.innerHTML = '<div class="card-content"><div class="row"><span class="label">Total Repos</span><span class="value">' + (p.total_repos || totalRepos || '?') + '</span></div><div class="row"><span class="label">Dirty</span><span class="value">' + (p.dirty_repos || 0) + '</span></div><div class="row"><span class="label">Cron Jobs</span><span class="value">' + ((a.cron || {}).cron_count || 0) + '</span></div><div style="margin-top:12px;padding-top:12px;border-top:1px solid #1e293b;font-size:10px;">' + repoList + '</div></div>';
}

async function runOfficeCmd() {
  const input = document.getElementById('office-cmd');
  const output = document.getElementById('office-output');
  const cmd = input.value.trim();
  if (!cmd) { output.innerHTML = '<span style="color:#ef4444;">⚠ Masukkan perintah</span>'; return; }
  output.innerHTML = '<span style="color:#fbbf24;">⏳ Menjalankan: ' + cmd + '</span>';
  try {
    const r = await fetch(API_BASE + '/api/mc/terminal', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ cmd: cmd }) });
    const result = await r.json();
    output.innerHTML = '<pre style="font-size:9px;color:#94a3b8;white-space:pre-wrap;">' + (result.output || result.error || 'ok').substring(0, 500) + '</pre>';
  } catch (e) {
    output.innerHTML = '<span style="color:#ef4444;">⚠ ' + e.message + '</span>';
  }
  input.value = '';
}

// ============================================================
// TASKS TAB
// ============================================================
window.initTab_tasks = async function initTasks() {
  const el = document.getElementById('tasks-list');
  const data = await fetchJSON('http://localhost:5199/api/tasks');
  if (data.error) {
    el.innerHTML = '<div class="error-state">⚠ Kanban tidak terhubung (http://localhost:5199)</div>';
    return;
  }
  const tasks = data.tasks || data.data || [];
  if (tasks.length === 0) { el.innerHTML = '<div class="card-content" style="color:#64748b;">Belum ada task. Tambahkan via Kanban di port 5199.</div>'; return; }
  const priColors = { P0:'#ef4444', P1:'#fbbf24', P2:'#22d3ee', P3:'#64748b' };
  let html = tasks.slice(0, 30).map(t => '<div style="margin-bottom:6px;padding:8px;background:#1e293b;border-radius:6px;border-left:3px solid ' + (priColors[t.priority] || '#64748b') + ';">' +
    '<div style="display:flex;justify-content:space-between;"><span style="font-size:11px;color:#f1f5f9;">' + (t.title || t.name || 'Task') + '</span>' +
    '<span>' + badge(t.status || t.state || 'backlog') + ' <span style="font-size:10px;color:#64748b;">' + (t.priority || 'P3') + '</span></span></div>' +
    (t.description ? '<div style="font-size:10px;color:#94a3b8;margin-top:4px;">' + t.description.substring(0, 100) + '</div>' : '') +
    '</div>').join('');
  el.innerHTML = html;
};

async function addTask() {
  const input = document.getElementById('task-input');
  const priority = document.getElementById('task-priority').value;
  const title = input.value.trim();
  if (!title) { alert('Masukkan judul task'); return; }
  alert('Fitur tambah task via dashboard akan tersedia di fase berikutnya. Gunakan Kanban langsung.');
  input.value = '';
}

// ============================================================
// PROJECTS TAB
// ============================================================
window.initTab_projects = async function initProjects() {
  const data = await fetchJSON(API_BASE + '/api/mc/projects');
  const agg = await fetchJSON(API_BASE + '/api/mc/aggregated');
  renderProjectsFull(data);
  renderProjectsSummary(agg);
};

function renderProjectsFull(data) {
  const el = document.getElementById('projects-full');
  if (data.error) { el.innerHTML = '<div class="error-state">⚠ ' + data.error + '</div>'; return; }
  const cats = data.categories || {};
  let html = '';
  for (const [catName, repos] of Object.entries(cats)) {
    const entries = Object.entries(repos);
    if (entries.length === 0) continue;
    html += '<div style="margin-bottom:16px;"><h4 style="font-size:11px;color:#64748b;margin-bottom:8px;text-transform:uppercase;">' + catName + ' (' + entries.length + ')</h4><div class="project-grid">';
    for (const [name, info] of entries) {
      const clean = info.dirty ? 'yellow' : 'green';
      html += '<div class="project-card"><div class="proj-name">' + name + ' ' + badge(clean) + '</div>' +
        '<div class="proj-meta">🔀 ' + (info.branch || '?') + ' · 📝 ' + (info.changes || 0) + ' perubahan' +
        (info.ahead > 0 ? ' · ⬆ +' + info.ahead : '') + (info.behind > 0 ? ' · ⬇ -' + info.behind : '') + '</div>' +
        (info.last_commit ? '<div class="proj-meta" style="margin-top:2px;">' + (info.last_commit || '').substring(0, 50) + '</div>' : '') +
        '</div>';
    }
    html += '</div></div>';
  }
  el.innerHTML = html || '<div class="card-content" style="color:#64748b;">Tidak ada repositori terdeteksi</div>';
}

function renderProjectsSummary(data) {
  const el = document.getElementById('projects-summary');
  const cats = data.categories || {};
  let total = 0, dirty = 0;
  let catList = Object.entries(cats).map(([name, repos]) => {
    const entries = Object.entries(repos);
    total += entries.length;
    const dirtyInCat = entries.filter(([, info]) => info.dirty).length;
    dirty += dirtyInCat;
    return '<div class="row"><span class="label">' + name + '</span><span class="value">' + entries.length + ' repos' + (dirtyInCat > 0 ? ' (' + dirtyInCat + ' dirty)' : '') + '</span></div>';
  }).join('');
  el.innerHTML = '<div class="card-content"><div class="row"><span class="label">Total repositori</span><span class="value">' + total + '</span></div><div class="row"><span class="label">Dirty (ada perubahan)</span><span class="value">' + dirty + '</span></div><div class="row"><span class="label">Bersih</span><span class="value">' + (total - dirty) + '</span></div>' +
    (catList ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e293b;">' + catList + '</div>' : '') +
    '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #1e293b;font-size:9px;color:#475569;">' +
    'Path: ' + (data.base_path || '~/Desktop/Niumination/') + '</div></div>';
}
