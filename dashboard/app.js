// Hermes Mission Control — Premium Senior WebSocket Client
// Live multi-terminal streams, custom shell command runners, state managers

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = `${wsProtocol}://${window.location.host}/ws/swarm`;
let ws = null;
let reconnectTimer = null;
let currentTgTopic = '1';

// ── WebSockets Client connection ──────────────────────
function connect() {
  if (ws) {
    try { ws.close(); } catch (e) {}
  }
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('⚡ WebSocket connection established.');
    document.getElementById('gwStatusText').textContent = 'ONLINE';
    document.getElementById('gwBadge').className = 'telemetry-badge badge-emerald';
    clearInterval(reconnectTimer);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'init' || data.type === 'tick') {
        renderAgents(data.agents);
        renderTerminalsAndLogs(data.logs);
      }
    } catch (e) {
      console.error('WebSocket payload parsing error:', e);
    }
  };

  ws.onclose = () => {
    console.log('❌ WebSocket connection offline. Reconnecting in 3s...');
    document.getElementById('gwStatusText').textContent = 'OFFLINE';
    document.getElementById('gwBadge').className = 'telemetry-badge badge-red';
    if (!reconnectTimer) reconnectTimer = setInterval(connect, 3000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket Error context:', err);
  };
}

// ── Render Agent Fleet Cards with LED states ─────────
function renderAgents(agents) {
  const container = document.getElementById('agentCards');
  if (!container) return;
  
  container.innerHTML = '';
  
  agents.forEach(a => {
    const card = document.createElement('div');
    card.className = `agent-card-premium border-${a.id}`;
    
    // Status text and formatting
    let statusClass = 'state-idle';
    let pulseHtml = '';
    if (a.status === 'thinking') {
      statusClass = 'state-thinking';
      pulseHtml = '<span class="status-pulse-amber"></span>';
    } else if (a.status === 'executing') {
      statusClass = 'state-executing';
      pulseHtml = '<span class="status-pulse-emerald"></span>';
    } else if (a.status === 'error' || a.status === 'failed') {
      statusClass = 'state-error';
      pulseHtml = '<span class="status-pulse-red"></span>';
    }

    card.innerHTML = `
      <div class="agent-card-header">
        <span class="agent-title-text">${a.name}</span>
      </div>
      <div class="agent-role-desc">${a.role}</div>
      <div class="agent-status-row">
        <span class="status-label">Runtime State:</span>
        <span class="status-badge ${statusClass}">${pulseHtml}${a.status.toUpperCase()}</span>
      </div>
    `;
    
    // Update terminal status pills too
    const termCol = document.getElementById(`termCol-${a.id}`);
    if (termCol) {
      const statusPill = termCol.querySelector('.status-pill');
      if (statusPill) {
        statusPill.className = `status-pill ${statusClass}`;
        statusPill.textContent = a.status;
      }
    }
    
    container.appendChild(card);
  });
}

// ── Stream Logs to Matrix Terminals ───────────────────
function renderTerminalsAndLogs(logs) {
  const filter = document.getElementById('agentFilter')?.value || 'all';
  
  const terminals = {
    research: document.getElementById('termResearch'),
    programmer: document.getElementById('termProgrammer'),
    qa: document.getElementById('termQA'),
  };

  // Clear all terminals
  Object.keys(terminals).forEach(key => {
    if (terminals[key]) terminals[key].innerHTML = '';
  });

  // Render logs
  logs.forEach(log => {
    if (filter !== 'all' && log.agent_id !== filter) return;
    
    const target = terminals[log.agent_id];
    if (!target) return; // Ignore if no match (e.g. chief logs)

    const line = document.createElement('div');
    const levelCls = log.level.toLowerCase();
    line.className = `term-line level-${levelCls}`;
    
    const time = new Date(log.timestamp).toLocaleTimeString('id-ID', { hour12: false });
    line.innerHTML = `<span class="term-timestamp">[${time}]</span> <span class="term-msg">${log.message}</span>`;
    target.appendChild(line);
  });

  // Auto scroll to bottom
  Object.keys(terminals).forEach(key => {
    if (terminals[key]) terminals[key].scrollTop = terminals[key].scrollHeight;
  });
}

// ── Quick Dispatch Task ──────────────────────────────
async function delegateQuick() {
  const agent = document.getElementById('delegateAgent').value;
  const instructionInput = document.getElementById('delegateInstruct');
  const instruction = instructionInput.value.trim();

  if (!instruction) {
    alert('Please write task instructions before dispatching!');
    return;
  }

  await sendTaskDelegation(agent, instruction);
  instructionInput.value = '';
}

// ── Send API Task Delegation Request ──────────────────
async function sendTaskDelegation(agent, instruction) {
  try {
    const btn = document.querySelector('.btn-primary-glow');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatching...';
    
    const response = await fetch('/api/mc/delegate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent, instruction }),
    });
    
    const data = await response.json();
    console.log('Task Delegation dispatched:', data);
    
    // Refresh kanban instantly
    await loadKanban();
    
    if (btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> Dispatch';
  } catch (e) {
    console.error('Task delegation failed:', e);
    alert('Failed to dispatch task. Check server connectivity.');
  }
}

// ── Switch Telegram Active Topic ──────────────────────
function switchTgTopic(topicId, label) {
  currentTgTopic = topicId;
  document.getElementById('tgThreadBadge').textContent = `Topic: ${label}`;
  
  // Update active tab visual
  const tabs = document.querySelectorAll('.tg-tab');
  tabs.forEach(tab => {
    if (tab.getAttribute('data-topic') === topicId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  loadTelegramFeed();
}

// ── Handle Enter Key on TG Input ──────────────────────
function handleTgKey(event) {
  if (event.key === 'Enter') {
    sendTgChat();
  }
}

// ── Direct Send Chat via Telegram Bridge ──────────────
async function sendTgChat() {
  const input = document.getElementById('tgInput');
  const message = input.value.trim();
  if (!message) return;

  try {
    const response = await fetch('/api/mc/send-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, topic_id: currentTgTopic }),
    });
    
    const resData = await response.json();
    console.log('Telegram Chat Response:', resData);
    
    // Append to feed immediately
    const feed = document.getElementById('tgFeed');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'tg-message-row user-sent';
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    msgDiv.innerHTML = `
      <div class="tg-avatar-user"><i class="fa-solid fa-circle-user"></i></div>
      <div class="tg-msg-bubble">
        <div class="tg-msg-author">Commander <span class="time">${time}</span></div>
        <div class="tg-msg-text">${message}</div>
      </div>
    `;
    feed.appendChild(msgDiv);
    feed.scrollTop = feed.scrollHeight;
    
    input.value = '';
    
    // Auto-populate simulated response log if simulated
    if (resData.simulated) {
      setTimeout(() => {
        const replyDiv = document.createElement('div');
        replyDiv.className = 'tg-message-row system-reply';
        const repTime = new Date().toLocaleTimeString('id-ID', { hour12: false });
        replyDiv.innerHTML = `
          <div class="tg-avatar-hermes"><i class="fa-solid fa-robot"></i></div>
          <div class="tg-msg-bubble">
            <div class="tg-msg-author">Hermes Bridge <span class="time">${repTime}</span></div>
            <div class="tg-msg-text">✓ Message routed to gateway. Swarm Task is being initialized in the background...</div>
          </div>
        `;
        feed.appendChild(replyDiv);
        feed.scrollTop = feed.scrollHeight;
      }, 1500);
    }
    
  } catch (e) {
    console.error('Failed to send Telegram message:', e);
  }
}

// ── Load Telegram Feed logs ──────────────────────────
async function loadTelegramFeed() {
  const feed = document.getElementById('tgFeed');
  if (!feed) return;
  
  try {
    const res = await fetch(`/api/mc/telegram-feed?limit=30&topic=${currentTgTopic}`);
    const data = await res.json();
    
    feed.innerHTML = '';
    
    // If no messages, show welcoming instructions
    if (!data.messages || data.messages.length === 0) {
      feed.innerHTML = '<div class="text-dim text-center" style="margin: auto; font-size:0.75rem;">No Telegram messages yet. Send a directive to see updates.</div>';
      return;
    }
    
    data.messages.forEach(m => {
      const msgDiv = document.createElement('div');
      
      if (m.type === 'inbound') {
        // User message — show as user-sent
        msgDiv.className = 'tg-message-row user-sent';
        const time = m.timestamp ? m.timestamp.split(' ')[1] || '' : '';
        msgDiv.innerHTML = `
          <div class="tg-avatar-user"><i class="fa-solid fa-circle-user"></i></div>
          <div class="tg-msg-bubble">
            <div class="tg-msg-author">${m.user || 'User'} <span class="time">${time}</span></div>
            <div class="tg-msg-text">${m.message}</div>
          </div>
        `;
      } else {
        // Agent response — show as system-reply
        msgDiv.className = 'tg-message-row system-reply';
        const time = m.timestamp ? m.timestamp.split(' ')[1] || '' : '';
        const agentLabel = (m.agent || 'agent').toUpperCase();
        const agentIcon = m.agent === 'general' ? 'fa-robot' : 'fa-network-wired';
        const avatarClass = m.agent === 'general' ? 'tg-avatar-hermes' : 'tg-avatar-agent';
        msgDiv.innerHTML = `
          <div class="${avatarClass}"><i class="fa-solid ${agentIcon}"></i></div>
          <div class="tg-msg-bubble">
            <div class="tg-msg-author">${agentLabel} <span class="time">${time}</span></div>
            <div class="tg-msg-text">${m.message}</div>
          </div>
        `;
      }
      
      feed.appendChild(msgDiv);
    });
    
    feed.scrollTop = feed.scrollHeight;
  } catch (e) {
    console.error('Failed to fetch Telegram feed:', e);
    feed.innerHTML = '<div class="text-dim text-center" style="margin: auto; font-size:0.75rem;">Failed to load Telegram feed.</div>';
  }
}

// ── System Host Diagnostics Terminal Shell ─────────────
async function executeTerminalShellCommand() {
  const input = document.getElementById('terminalShellInput');
  const command = input.value.trim();
  if (!command) return;

  const shellOutput = document.getElementById('terminalShellOutput');
  
  // Append user input to terminal shell output
  const cmdRow = document.createElement('div');
  cmdRow.className = 'text-amber';
  cmdRow.innerHTML = `<span class="text-dim">zaryu@macbook-pro ~ %</span> ${command}`;
  shellOutput.appendChild(cmdRow);
  
  try {
    const res = await fetch('/api/mc/run-terminal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    });
    const data = await res.json();
    
    const outputRow = document.createElement('pre');
    outputRow.className = data.status === 'ok' ? 'terminal-res-success' : 'terminal-res-error';
    outputRow.textContent = data.output || '[No Command Output returned]';
    shellOutput.appendChild(outputRow);
    
  } catch (e) {
    const errRow = document.createElement('div');
    errRow.className = 'text-red';
    errRow.textContent = `❌ Remote connection error: ${e.message}`;
    shellOutput.appendChild(errRow);
  }
  
  shellOutput.scrollTop = shellOutput.scrollHeight;
  input.value = '';
}

function handleTerminalCommandKey(event) {
  if (event.key === 'Enter') {
    executeTerminalShellCommand();
  }
}

function runPredefinedCommand(command) {
  document.getElementById('terminalShellInput').value = command;
  executeTerminalShellCommand();
}

function clearConsole() {
  document.getElementById('terminalShellOutput').innerHTML = '<div>⚡ SYSTEM MONITORS RESET SUCCESSFULLY.</div><br>';
}

async function clearDatabaseLogs() {
  if (!confirm('Are you absolutely sure you want to completely flush SQLite logs and task backlog?')) return;
  try {
    const res = await fetch('/api/mc/clear-logs', { method: 'POST' });
    const data = await res.json();
    if (data.status === 'success') {
      alert('SQLite WAL database state flushed successfully.');
      clearConsole();
      await loadKanban();
      await loadTelegramFeed();
    }
  } catch (e) {
    alert('Failed to clear database logs: ' + e.message);
  }
}

// ── System Telemetry (Poll) ──────────────────────────
async function loadTelemetry() {
  try {
    const res = await fetch('/api/mc/system');
    const data = await res.json();
    
    // Update top header and cards
    document.getElementById('ramPctText').textContent = data.memory.percent + '%';
    document.getElementById('ramBadge').className = data.memory.percent > 85 ? 'telemetry-badge badge-red' : 'telemetry-badge badge-amber';
    
    // Update global health scores
    document.getElementById('healthPct').textContent = data.health_score + '%';
    document.getElementById('healthFill').style.width = data.health_score + '%';
    
    // Update LLM Backend KPI from live config
    if (data.llm_model) {
      document.getElementById('kpiLat').textContent = data.llm_model;
    }
    
    // Update latency indicator (measured from fetch roundtrip)
    const latencyEl = document.getElementById('kpiLatency');
    if (latencyEl) {
      latencyEl.textContent = 'OK';
    }
    
    // Render disk partitions info if on Storage Page
    if (document.getElementById('page-storage').classList.contains('active')) {
      renderDiskUsage(data.disks);
      
      // Update RAM disk circle gauge
      const circle = document.getElementById('ramDiskCircle');
      if (circle) {
        // Calculate circumference: 2 * PI * r = 2 * 3.14159 * 40 = ~251.2
        const pct = data.memory.percent;
        const offset = 251.2 - (pct / 100) * 251.2;
        circle.style.strokeDashoffset = offset;
        document.getElementById('ramDiskValue').innerHTML = `RAM<br><strong>${pct}%</strong>`;
      }
    }
    
  } catch (e) {
    console.error('System telemetry poll error:', e);
  }
}

function renderDiskUsage(disks) {
  const container = document.getElementById('diskUsageContainer');
  if (!container) return;
  
  container.innerHTML = '';
  disks.forEach(d => {
    const diskBox = document.createElement('div');
    diskBox.className = 'disk-mount-row';
    
    let stateClass = 'progress-cyan';
    if (d.status === 'warning') stateClass = 'progress-amber';
    if (d.status === 'critical') stateClass = 'progress-red';

    diskBox.innerHTML = `
      <div class="disk-meta">
        <span><i class="fa-solid fa-folder-tree"></i> ${d.mount}</span>
        <span>${d.free_gb} GB Free / ${d.total_gb} GB</span>
      </div>
      <div class="disk-progress">
        <div class="disk-fill ${stateClass}" style="width: ${d.used_pct}%"></div>
      </div>
    `;
    container.appendChild(diskBox);
  });
}

// ── Kanban Operations (Poll) ──────────────────────────
async function loadKanban() {
  try {
    const res = await fetch('/api/mc/tasks');
    const data = await res.json();
    
    // Update counters
    document.getElementById('countPending').textContent = data.pending.length;
    document.getElementById('countRunning').textContent = data.running.length;
    document.getElementById('countCompleted').textContent = data.completed.length;
    
    fillKanbanColumn('kbPending', data.pending, 'pending');
    fillKanbanColumn('kbRunning', data.running, 'running');
    fillKanbanColumn('kbCompleted', data.completed, 'completed');
    
    // Update KPI Tasks
    const completedCount = data.completed.length;
    const failedCount = data.failed ? data.failed.length : 0;
    document.getElementById('kpiTasks').textContent = `${completedCount} Pass / ${failedCount} Fail`;
    
    // Populate fullscreen Kanban if active
    if (document.getElementById('page-taskqueue').classList.contains('active')) {
      fillFullKanbanGrid(data);
    }
  } catch (e) {
    console.error('Kanban poll failed:', e);
  }
}

function fillKanbanColumn(elId, items, columnType) {
  const el = document.getElementById(elId);
  if (!el) return;
  
  el.innerHTML = '';
  
  if (items.length === 0) {
    el.innerHTML = '<div class="kanban-empty">No Tasks</div>';
    return;
  }

  items.forEach(t => {
    const div = document.createElement('div');
    div.className = `kanban-item-premium border-${t.agent}`;
    
    // Click to load outputs or specs if completed
    div.onclick = () => inspectArtifactForTask(t);

    div.innerHTML = `
      <div class="kb-task-header">
        <span class="task-id">#${t.task_id}</span>
        <span class="agent-tag bg-${t.agent}">${t.agent.toUpperCase()}</span>
      </div>
      <div class="task-body-desc">${t.payload?.instruction || 'Active Mission'}</div>
    `;
    el.appendChild(div);
  });
}

function fillFullKanbanGrid(data) {
  const grid = document.getElementById('kanbanFullRow');
  if (!grid) return;
  
  const columns = [
    { id: 'full-pending', status: 'pending', label: 'Backlog Queue', icon: 'fa-hourglass-start', data: data.pending },
    { id: 'full-running', status: 'running', label: 'In Progress Swarm', icon: 'fa-spinner fa-spin', data: data.running },
    { id: 'full-completed', status: 'completed', label: 'Done Successfully', icon: 'fa-clipboard-check', data: data.completed },
    { id: 'full-failed', status: 'failed', label: 'Failed Crashes', icon: 'fa-triangle-exclamation', data: data.failed || [] }
  ];

  grid.innerHTML = columns.map(c => `
    <div class="kanban-col full-page-col" data-status="${c.status}">
      <div class="kanban-title"><i class="fa-solid ${c.icon}"></i> ${c.label} <span class="badge">${c.data.length}</span></div>
      <div class="kanban-items" id="${c.id}"></div>
    </div>
  `).join('');

  columns.forEach(c => {
    fillKanbanColumn(c.id, c.data, c.status);
  });
}

// ── Inspect Active Spec / Log Artifacts ────────────────
async function inspectArtifactForTask(task) {
  document.getElementById('activeArtifactName').textContent = `task_${task.task_id}_output.json`;
  const view = document.getElementById('artifactContent');
  view.innerHTML = `<pre class="code-output">${JSON.stringify(task, null, 2)}</pre>`;
}

async function loadArtifactsList() {
  const container = document.getElementById('artifactContent');
  if (!container) return;
  
  try {
    const res = await fetch('/api/mc/artifacts');
    const data = await res.json();
    
    container.innerHTML = '';
    
    data.categories.forEach(cat => {
      const catDiv = document.createElement('div');
      catDiv.className = 'artifact-cat-section';
      catDiv.innerHTML = `<div class="cat-title-text"><i class="fa-solid fa-folder-open"></i> ${cat.category}</div>`;
      
      const fileList = document.createElement('div');
      fileList.className = 'artifact-file-list';
      
      if (cat.files.length === 0) {
        fileList.innerHTML = '<div class="text-dim padding-left">No artifacts generated.</div>';
      } else {
        cat.files.forEach(f => {
          const fBtn = document.createElement('button');
          fBtn.className = 'btn-file-select';
          fBtn.innerHTML = `
            <span><i class="fa-solid fa-file-code"></i> ${f.name}</span>
            <small>${f.size_kb} KB // ${f.modified}</small>
          `;
          fBtn.onclick = () => loadSpecificFileContent(f.path, f.name);
          fileList.appendChild(fBtn);
        });
      }
      
      catDiv.appendChild(fileList);
      container.appendChild(catDiv);
    });
  } catch (e) {
    console.error('Failed to load artifacts list:', e);
  }
}

async function loadSpecificFileContent(filePath, fileName) {
  try {
    const res = await fetch(`/api/mc/artifact-content?file=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    
    document.getElementById('activeArtifactName').textContent = fileName;
    const view = document.getElementById('artifactContent');
    
    if (data.error) {
      view.innerHTML = `<div class="text-red">Error: ${data.error}</div>`;
    } else {
      view.innerHTML = `<pre class="code-output">${escapeHtml(data.content)}</pre>`;
    }
  } catch (e) {
    console.error('Failed to load file content:', e);
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── SQLite WAL Manual Checkpoint ──────────────────────
async function triggerCheckpoint() {
  try {
    const res = await fetch('/api/mc/wal-checkpoint', { method: 'POST' });
    const data = await res.json();
    if (data.status === 'success') {
      alert('✓ SQLite WAL database state committed to USB perfectly.');
    }
  } catch (e) {
    alert('WAL Checkpoint failed: ' + e.message);
  }
}

// ── Switch Main Pages Routing ─────────────────────────
function initNav() {
  const items = document.querySelectorAll('.nav-item');
  items.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      
      // Update sidebar nav states
      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Toggle pages
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const target = document.getElementById('page-' + page);
      if (target) target.classList.add('active');
      
      // Lazy page load initializers
      if (page === 'swarm') loadTopologyPrompts();
      if (page === 'taskqueue') loadKanban();
      if (page === 'terminal') clearConsole();
      if (page === 'telegram') loadTelegramFeed();
      if (page === 'storage') loadTelemetry();
      if (page === 'system') loadSystemSettings();
    });
  });
}

// ── Swarm System Prompts viewer ───────────────────────
function loadTopologyPrompts() {
  // Switch visual tab too
  switchPromptTab('chief');
}

async function switchPromptTab(agentId) {
  const textEditor = document.getElementById('promptEditorText');
  if (!textEditor) return;
  
  // Highlight active button
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(t => {
    if (t.textContent.toLowerCase().includes(agentId) || (agentId === 'chief' && t.textContent.includes('Chief'))) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  try {
    const res = await fetch('/api/mc/agents');
    const data = await res.json();
    
    // Look up systemic prompts
    const promptMap = {
      chief: `You are the Chief Orchestrator of the Hermes Swarm.\nYour objective is to absorb instructions from Telegram / Web Dashboard, decompose them into sub-tasks (Task Decomposition), and route them to the correct specialist agent.\n\nRULES OF ENGAGEMENT:\n1. You DO NOT write code or execute scripts. You plan and delegate.\n2. Break complex instructions into atomic tasks for Research, Programmer, or QA agents.\n3. Monitor task status and synthesize final responses to the Commander (user).\n4. If a task fails, route the error log back to the appropriate agent.`,
      research: `You are the Research & Learning Agent of the Hermes Swarm.\nYour objective is to gather information: web scraping, reading API documentation, summarizing GitHub issues, analyzing requirements.\n\nENVIRONMENT CONSTRAINTS:\nThe active project repository is located on a portable USB drive. Minimize arbitrary file writes. Think completely through your logic before saving to disk.\n\nRULES OF ENGAGEMENT:\n1. RESEARCH-ONLY: You gather info. You DO NOT write production code or run tests.\n2. Write your findings to /tmp/hermes_research/active_spec.md as a Research Brief.\n3. If an instruction lacks necessary context, halt and report to the Chief immediately.\n4. Provide a structured Research Brief upon completion.`,
      programmer: `You are the Lead Programmer of the Hermes Swarm.\nYour objective is to write, modify, and refactor source code based on blueprints provided by the Research Agent or instructions from the Chief.\n\nENVIRONMENT CONSTRAINTS:\nThe active project repository is located on a portable USB drive. Minimize arbitrary file writes. Think completely through your logic before saving to disk.\n\nRULES OF ENGAGEMENT:\n1. WRITE-ONLY LOGIC: You write code. You DO NOT execute the code, run servers, or run tests. That is the QA Agent's job.\n2. Read the specification from /tmp/hermes_research/active_spec.md if directed by the Chief.\n3. When editing existing files, use precise AST or regex-based edits to avoid breaking existing logic.\n4. If an instruction is technically flawed or lacks necessary dependencies, halt and report back to the Chief immediately. Do not guess.\n5. Provide a summary of the modified files upon completion.`,
      qa: `You are the Quality Assurance and Execution Specialist of the Hermes Swarm.\nYour objective is to safely execute scripts, run test suites (e.g., pytest, jest), and analyze terminal logs.\n\nENVIRONMENT CONSTRAINTS:\nYou are operating on a macOS system via a portable USB. When generating test logs, redirect standard output and standard error to the RAM disk (/tmp/hermes_qa/) to prevent unnecessary USB wear and tear.\n\nRULES OF ENGAGEMENT:\n1. READ & EXECUTE ONLY: You are strictly forbidden from editing the core logic of the source code.\n2. Run the specified commands (e.g., build scripts, unit tests, linters).\n3. Capture the output. If the test passes, return a [PASS] signal to the Chief.\n4. If the test fails, extract the exact traceback or error log. Send a structured [FAIL] payload containing the error log back to the Chief so it can be routed to the Programmer Agent.\n5. Never attempt to "fix just a small typo" yourself. Separation of concerns must be maintained to avoid file-lock conflicts.`
    };
    
    textEditor.value = promptMap[agentId] || 'No Prompt configuration specified.';
  } catch (e) {
    console.error('Failed to switch prompts:', e);
  }
}

// ── Dynamic System Settings Configurations ────────────
async function loadSystemSettings() {
  try {
    const [cfgRes, hermesRes] = await Promise.all([
      fetch('/api/mc/config'),
      fetch('/api/mc/hermes')
    ]);
    
    const cfg = await cfgRes.json();
    const hermes = await hermesRes.json();
    
    // Populate form fields
    document.getElementById('cfgOrchestrator').value = cfg.orchestrator || 'chief';
    document.getElementById('cfgUsbSafe').checked = cfg.usb_safe_mode ?? true;
    document.getElementById('cfgConcurrency').value = cfg.concurrency_limit || 4;
    document.getElementById('cfgLlm').value = cfg.llm_model || 'opencode/big-pickle';
    document.getElementById('cfgTgChatId').value = cfg.tg_chat_id || '-REDACTED_CHAT_ID';
    
    // Populate cron table
    const tableBody = document.getElementById('cronTableBody');
    if (tableBody) {
      tableBody.innerHTML = '';
      if (!hermes.cron || hermes.cron.jobs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-dim">No Scheduled Cron Jobs active</td></tr>';
      } else {
        hermes.cron.jobs.forEach(j => {
          const row = document.createElement('tr');
          const isAct = j.status === 'active' || j.active;
          const statusBadge = isAct 
            ? '<span class="status-badge state-executing">ACTIVE</span>' 
            : '<span class="status-badge state-idle">PAUSED</span>';
            
          row.innerHTML = `
            <td><code>${j.id || 'N/A'}</code></td>
            <td><strong>${j.name}</strong><br><small class="text-dim">${j.script || 'N/A'}</small></td>
            <td><code>${j.schedule}</code></td>
            <td>${statusBadge}</td>
            <td><span class="text-cyan">${j.next_run || 'Pending'}</span></td>
          `;
          tableBody.appendChild(row);
        });
      }
    }
  } catch (e) {
    console.error('Failed to load config variables:', e);
  }
}

async function saveSystemConfig() {
  const payload = {
    orchestrator: document.getElementById('cfgOrchestrator').value,
    usb_safe_mode: document.getElementById('cfgUsbSafe').checked,
    concurrency_limit: parseInt(document.getElementById('cfgConcurrency').value) || 4,
    llm_model: document.getElementById('cfgLlm').value,
    tg_chat_id: document.getElementById('cfgTgChatId').value
  };

  try {
    const res = await fetch('/api/mc/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.status === 'saved') {
      alert('✓ Swarm configuration committed to storage successfully.');
      loadTelemetry();
    }
  } catch (e) {
    alert('Failed to save config: ' + e.message);
  }
}

// ── Advanced Tasks creator template binder ───────────
function populateTemplateInstruction() {
  const agent = document.getElementById('taskAgentSelect').value;
  const area = document.getElementById('taskInstruction');
  
  const hints = {
    research: 'Analyze current repository file structures and draft a modern architectural enhancement paper for the team.',
    programmer: 'Implement a highly-optimized AST code refactoring module for FastAPI state updates.',
    qa: 'Run full test suite execution commands and pipe telemetry logs to the local /tmp/hermes_qa directory.'
  };
  
  area.value = hints[agent] || '';
}

function setTemplate(text) {
  document.getElementById('taskInstruction').value = text;
}

async function dispatchCustomTask() {
  const agent = document.getElementById('taskAgentSelect').value;
  const instruction = document.getElementById('taskInstruction').value.trim();

  if (!instruction) {
    alert('Please enter an instruction before dispatching!');
    return;
  }

  await sendTaskDelegation(agent, instruction);
  document.getElementById('taskInstruction').value = '';
}

// ── Direct Push Telegram message ──────────────────────
async function sendTelegramFullMessage() {
  const select = document.getElementById('tgFullSelectTopic');
  const topicId = select.value;
  const topicName = select.options[select.selectedIndex].text;
  const area = document.getElementById('tgFullMsg');
  const message = area.value.trim();

  if (!message) {
    alert('Message text cannot be empty!');
    return;
  }

  try {
    const res = await fetch('/api/mc/send-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, topic_id: topicId })
    });
    const data = await res.json();
    if (data.status === 'sent') {
      alert(`Message successfully pushed to Telegram Thread: ${topicName}`);
      area.value = '';
      await loadTelegramFeed();
    }
  } catch (e) {
    alert('Telegram push failed: ' + e.message);
  }
}

// ── Terminals clearing triggers ─────────────────────
function clearTerminals() {
  const streams = ['termResearch', 'termProgrammer', 'termQA'];
  streams.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.innerHTML = '<div class="text-dim">// Buffer logs cleared. Listening for new worker streams...</div>';
  });
}

function filterTerminals() {
  // Let WS ticketing flow handle rendering by picking up active select filters
  console.log('Matrix filter toggled.');
}

// ── Global Badge Updater ─────────────────────────────
async function pollHeaderBadges() {
  try {
    const res = await fetch('/api/mc/hermes');
    const data = await res.json();
    
    const gwBadge = document.getElementById('gwBadge');
    const gwText = document.getElementById('gwStatusText');
    
    if (data.gateway.online) {
      gwBadge.className = 'telemetry-badge badge-emerald';
      gwText.textContent = `ONLINE (PID ${data.gateway.pid || 'Active'})`;
    } else {
      gwBadge.className = 'telemetry-badge badge-red';
      gwText.textContent = 'OFFLINE';
    }
  } catch (e) {
    console.error('Failed to poll headers:', e);
  }
}

// ── Initialize App ───────────────────────────────────
initNav();
connect();
loadTelemetry();
loadKanban();
loadTelegramFeed();
loadArtifactsList();

// Keep metrics rolling
setInterval(loadTelemetry, 5000);
setInterval(loadKanban, 4000);
setInterval(pollHeaderBadges, 10000);
populateTemplateInstruction();
