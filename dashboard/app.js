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

// ── Init ───────────────────────────────────────────────
connect();
loadTelemetry();
loadKanban();
setInterval(loadTelemetry, 5000);
setInterval(loadKanban, 3000);
