// Hermes Mission Control — WebSocket Client
// Live multi-terminal stream + agent status + kanban

const wsUrl = `ws://${window.location.host}/ws/swarm`;
let ws = null;
let reconnectTimer = null;

// ── WebSocket Connection ──────────────────────────────
function connect() {
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WS connected');
    clearInterval(reconnectTimer);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'init' || data.type === 'tick') {
      renderAgents(data.agents);
      renderLogs(data.logs);
    }
  };

  ws.onclose = () => {
    console.log('WS closed, reconnecting...');
    reconnectTimer = setInterval(connect, 3000);
  };

  ws.onerror = (err) => console.error('WS error', err);
}

// ── Render Agents ─────────────────────────────────────
function renderAgents(agents) {
  const container = document.getElementById('agentCards');
  if (!container) return;
  container.innerHTML = '';
  for (const [id, status] of Object.entries(agents)) {
    const names = {
      chief: { name: 'Hermes Chief', role: 'Orchestrator' },
      research: { name: 'Agent 01', role: 'Research & Learn' },
      programmer: { name: 'Agent 02', role: 'Programmer' },
      qa: { name: 'Agent 03', role: 'Tester & QA' },
    };
    const info = names[id] || { name: id, role: '' };
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.innerHTML = `
      <div class="name">${info.name}</div>
      <div class="role">${info.role}</div>
      <div class="status ${status}">${status}</div>
      <div class="cpu">CPU: ${Math.floor(Math.random() * 10)}%</div>
    `;
    container.appendChild(card);
  }
}

// ── Render Logs (Multi-Terminal) ──────────────────────
function renderLogs(logs) {
  const filter = document.getElementById('agentFilter')?.value || 'all';
  const map = {
    research: document.getElementById('termResearch'),
    programmer: document.getElementById('termProgrammer'),
    qa: document.getElementById('termQA'),
    chief: document.getElementById('termResearch'),
  };

  // Clear all
  for (const el of Object.values(map)) {
    if (el) el.innerHTML = '';
  }

  logs.forEach((log) => {
    if (filter !== 'all' && log.agent_id !== filter) return;
    const target = map[log.agent_id];
    if (!target) return;
    const line = document.createElement('div');
    const cls = log.level.toLowerCase();
    line.className = `term-line ${cls}`;
    const time = new Date(log.timestamp).toLocaleTimeString('id-ID', { hour12: false });
    line.textContent = `[${time}] ${log.message}`;
    target.appendChild(line);
  });

  // Auto-scroll
  for (const el of Object.values(map)) {
    if (el) el.scrollTop = el.scrollHeight;
  }
}

// ── Delegate Task ──────────────────────────────────────
async function delegate(agent) {
  const instructions = {
    research: 'Cari dokumentasi terbaik untuk stack project',
    programmer: 'Implementasikan modul berdasarkan spec',
    qa: 'Jalankan test suite untuk verifikasi',
  };
  try {
    const res = await fetch('/api/mc/delegate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent,
        instruction: instructions[agent] || 'Execute task',
      }),
    });
    const data = await res.json();
    console.log('Delegated:', data);
  } catch (e) {
    console.error('Delegate failed', e);
  }
}

// ── Telegram Bridge (simulasi) ─────────────────────────
function sendTg() {
  const input = document.getElementById('tgInput');
  const feed = document.getElementById('tgFeed');
  if (!input.value.trim()) return;
  const msg = document.createElement('div');
  msg.className = 'tg-msg';
  msg.innerHTML = `<span class="tg-user">User:</span> ${input.value}`;
  feed.appendChild(msg);
  feed.scrollTop = feed.scrollHeight;
  input.value = '';
}

// ── System Telemetry (poll) ────────────────────────────
async function loadTelemetry() {
  try {
    const res = await fetch('/api/mc/system');
    const data = await res.json();
    document.getElementById('cpuVal').textContent = data.cpu_percent + '%';
    document.getElementById('ramVal').textContent =
      data.memory.used_gb + ' / ' + data.memory.total_gb + ' GB';
    document.getElementById('usbR').textContent = '12MB/s';
    document.getElementById('usbW').textContent = '2MB/s';
    document.getElementById('ramBadge').innerHTML =
      'RAM: <strong>' + data.memory.percent + '%</strong>';
  } catch (e) {
    console.error('Telemetry failed', e);
  }
}

// ── Kanban (poll) ──────────────────────────────────────
async function loadKanban() {
  try {
    const res = await fetch('/api/mc/tasks');
    const data = await res.json();
    fillKanban('kbPending', data.pending);
    fillKanban('kbRunning', data.running);
    fillKanban('kbCompleted', data.completed);
    document.getElementById('kpiTasks').textContent =
      `${data.completed.length} Pass / ${data.failed?.length || 0} Fail`;
  } catch (e) {
    console.error('Kanban failed', e);
  }
}

function fillKanban(elId, items) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  items.forEach((t) => {
    const div = document.createElement('div');
    div.className = 'kb-item';
    div.innerHTML = `
      <div class="task-id">#${t.task_id}</div>
      <div>${t.payload?.instruction || 'Task'}</div>
      <div class="agent">${t.agent}</div>
    `;
    el.appendChild(div);
  });
}

// ── Navigation Routing ────────────────────────────────
function initNav() {
  const items = document.querySelectorAll('.nav-item');
  items.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      // Toggle active nav
      items.forEach((i) => i.classList.remove('active'));
      item.classList.add('active');
      // Toggle page
      document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
      const target = document.getElementById('page-' + page);
      if (target) target.classList.add('active');
      // Lazy-populate
      if (page === 'swarm') populateSwarm();
      if (page === 'taskqueue') loadKanbanFull();
      if (page === 'terminal') populateTerminal();
      if (page === 'telegram') loadTelegramFull();
      if (page === 'storage') loadStorage();
      if (page === 'system') loadSystem();
    });
  });
}

// ── Populate Pages ─────────────────────────────────────
function populateSwarm() {
  const el = document.getElementById('swarmDetail');
  if (!el || el.dataset.done) return;
  el.innerHTML = document.getElementById('agentCards').innerHTML;
  el.dataset.done = '1';
}

function populateTerminal() {
  const el = document.getElementById('terminalFull');
  if (!el || el.dataset.done) return;
  el.innerHTML = document.getElementById('terminalMatrix').innerHTML;
  el.dataset.done = '1';
}

async function loadKanbanFull() {
  const el = document.getElementById('kanbanFull');
  if (!el) return;
  try {
    const res = await fetch('/api/mc/tasks');
    const data = await res.json();
    const cols = [
      { status: 'pending', title: 'Backlog' },
      { status: 'running', title: 'In Progress' },
      { status: 'completed', title: 'Done' },
      { status: 'failed', title: 'Failed' },
    ];
    el.innerHTML = cols.map((c) => `
      <div class="kanban-col" data-status="${c.status}">
        <div class="kanban-title">${c.title}</div>
        <div class="kanban-items" id="full-${c.status}"></div>
      </div>
    `).join('');
    fillKanban('full-pending', data.pending);
    fillKanban('full-running', data.running);
    fillKanban('full-completed', data.completed);
    fillKanban('full-failed', data.failed || []);
  } catch (e) { console.error('KanbanFull failed', e); }
}

async function loadTelegramFull() {
  const el = document.getElementById('tgFeedFull');
  if (!el) return;
  try {
    const res = await fetch('/api/mc/logs?limit=100');
    const data = await res.json();
    el.innerHTML = data.logs.map((l) => {
      const cls = l.agent_id === 'chief' ? 'tg-hermes' : 'tg-user';
      const time = new Date(l.timestamp).toLocaleTimeString('id-ID', { hour12: false });
      return `<div class="tg-msg"><span class="${cls}">[${time}] ${l.agent_id}:</span> ${l.message}</div>`;
    }).join('');
    el.scrollTop = el.scrollHeight;
  } catch (e) { console.error('TG full failed', e); }
}

function sendTgFull() {
  const input = document.getElementById('tgInputFull');
  const feed = document.getElementById('tgFeedFull');
  if (!input.value.trim() || !feed) return;
  const msg = document.createElement('div');
  msg.className = 'tg-msg';
  msg.innerHTML = `<span class="tg-user">User:</span> ${input.value}`;
  feed.appendChild(msg);
  feed.scrollTop = feed.scrollHeight;
  input.value = '';
}

async function loadStorage() {
  try {
    const res = await fetch('/api/mc/system');
    const data = await res.json();
    document.getElementById('diskTotal').textContent = data.disk.total_gb + ' GB';
    document.getElementById('diskFree').textContent = data.disk.free_gb + ' GB';
    document.getElementById('ramVal2').textContent =
      data.memory.used_gb + ' / ' + data.memory.total_gb + ' GB';
  } catch (e) { console.error('Storage failed', e); }
}

async function loadSystem() {
  try {
    const res = await fetch('/api/mc/system');
    const data = await res.json();
    document.getElementById('hostVal').textContent = data.hostname;
    document.getElementById('cpuVal2').textContent = data.cpu_percent + '%';
    document.getElementById('ramVal3').textContent =
      data.memory.used_gb + ' / ' + data.memory.total_gb + ' GB';
  } catch (e) { console.error('System failed', e); }
}

// ── Init ───────────────────────────────────────────────
initNav();
connect();
loadTelemetry();
loadKanban();
setInterval(loadTelemetry, 5000);
setInterval(loadKanban, 3000);
