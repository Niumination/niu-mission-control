/*═══════════════════════════════════════
  UNIFIED WINDOW MANAGER — ORB base + floating windows
═══════════════════════════════════════*/
(function(){
'use strict';

const PAGES = {
  dashboard: { title: 'Dashboard', ico: 'fa-table-columns', accent: '#4f46e5', w: 940, h: 640 },
  ecosystem: { title: 'Ecosystem', ico: 'fa-globe', accent: '#22c55e', w: 900, h: 620 },
  swarm: { title: 'Swarm', ico: 'fa-network-wired', accent: '#8b5cf6', w: 820, h: 600 },
  taskqueue: { title: 'Task Queue', ico: 'fa-list-check', accent: '#f59e0b', w: 920, h: 640 },
  terminal: { title: 'Terminal', ico: 'fa-terminal', accent: '#06b6d4', w: 860, h: 580 },
  telegram: { title: 'Telegram', ico: 'fa-paper-plane', accent: '#3b82f6', w: 860, h: 580 },
  storage: { title: 'Storage', ico: 'fa-database', accent: '#10b981', w: 840, h: 580 },
  skills: { title: 'Skill Bank', ico: 'fa-brain', accent: '#ec4899', w: 880, h: 620 },
  'skills-market': { title: 'Skill Market', ico: 'fa-store', accent: '#f43f5e', w: 880, h: 620 },
  inspector: { title: 'Inspector', ico: 'fa-search-plus', accent: '#38bdf8', w: 960, h: 680 },
  system: { title: 'System', ico: 'fa-gear', accent: '#94a3b8', w: 860, h: 600 },
  cost: { title: 'Cost', ico: 'fa-coins', accent: '#fbbf24', w: 840, h: 580 },
  deploy: { title: 'Deploy', ico: 'fa-rocket', accent: '#f97316', w: 840, h: 580 }
};

const mount = document.getElementById('winMount');
const vault = document.getElementById('pageVault');
const orbDim = document.getElementById('orbDim');
const taskbar = document.getElementById('taskbar');
let zTop = 100;
const openApps = new Set();
const LAZY = {
  ecosystem: () => { try { loadEcosystem(); } catch(e){} },
  swarm: () => { try { loadTopologyPrompts(); } catch(e){} },
  taskqueue: () => { try { loadKanban(); } catch(e){} },
  terminal: () => { try { clearConsole(); } catch(e){} },
  telegram: () => { try { loadTelegramFeed(); } catch(e){} },
  storage: () => { try { loadTelemetry(); } catch(e){} },
  skills: () => { try { loadSkills(); } catch(e){} },
  system: () => { try { loadSystemSettings(); } catch(e){} },
};

window.PAGES = PAGES;
window.openWindow = openWindow;
window.closeWindow = closeWindow;
window.minimizeWindow = minimizeWindow;
window.restoreWindow = restoreWindow;
window.toggleMax = toggleMax;

/*── Clock ──*/
setInterval(()=>{
  const c = document.getElementById('clock');
  if (c) c.textContent = new Date().toLocaleTimeString('en-US',{hour12:false});
}, 1000);

/*── Posisi window (kaskade berantai — titlebar selalu terlihat) ──*/
let lastPos = null;
function cascadePos(){
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(880, vw-48), h = Math.min(600, vh-100);
  if (!lastPos) lastPos = { x: Math.max(20, (vw-w)/2 - 140), y: Math.max(20, (vh-h)/2 - 100) };
  const nx = lastPos.x + 52, ny = lastPos.y + 42;
  if (nx + Math.min(680, w) > vw - 12 || ny + 80 > vh - 64) {
    lastPos = { x: 20, y: 20 };
  } else {
    lastPos = { x: nx, y: ny };
  }
  return { x: lastPos.x, y: lastPos.y, w, h };
}

/*── Buka window ──*/
function openWindow(appId){
  if (openApps.has(appId)){ focusWindow(appId); return; }
  const cfg = PAGES[appId];
  if (!cfg) return;
  let section = document.getElementById('page-' + appId);

  // Dynamic page creation untuk inspector
  if (!section && appId === 'inspector') {
    section = document.createElement('section');
    section.className = 'page';
    section.id = 'page-inspector';
    section.innerHTML = `
      <div class="inspector-container">
        <div class="inspector-header">
          <h2 style="color:var(--t1,#f1f5f9);margin:0;font-size:1.1rem"><i class="fas fa-search-plus" style="color:#38bdf8"></i> Inspector</h2>
          <div class="inspector-search">
            <input type="text" id="inspectorSearch" placeholder="Enter task ID..." style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#f1f5f9;padding:6px 10px;border-radius:8px;font-size:.82rem;width:200px">
            <button onclick="loadInspector()" style="background:#38bdf8;color:#000;border:none;padding:6px 12px;border-radius:8px;font-size:.75rem;cursor:pointer">Load</button>
            <button onclick="loadInspectorAudit()" style="background:rgba(255,255,255,.1);color:#94a3b8;border:none;padding:6px 12px;border-radius:8px;font-size:.75rem;cursor:pointer">Audit Log</button>
            <button onclick="loadInspectorCost()" style="background:rgba(255,255,255,.1);color:#94a3b8;border:none;padding:6px 12px;border-radius:8px;font-size:.75rem;cursor:pointer">Cost</button>
          </div>
        </div>
        <div id="inspectorOutput" class="inspector-output">
          <div class="inspector-placeholder">
            <i class="fas fa-search" style="font-size:2rem;color:rgba(255,255,255,.15)"></i>
            <p style="color:var(--t3,#7c8ba0);font-size:.82rem">Masukkan Task ID atau klik Audit Log / Cost untuk inspeksi</p>
          </div>
        </div>
      </div>`;
    vault.appendChild(section);
  }

  if (!section) return;

  openApps.add(appId);
  orbDim.classList.add('show');
  const pos = cascadePos();

  const win = document.createElement('div');
  win.className = 'fwin';
  win.dataset.app = appId;
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', cfg.title);
  win.tabIndex = -1;
  win.style.left = pos.x+'px';
  win.style.top = pos.y+'px';
  win.style.width = pos.w+'px';
  win.style.height = pos.h+'px';

  win.innerHTML =
    `<div class="fwin-bar">
       <div class="fwin-dots" aria-hidden="true">
         <div class="fdot fdot-close" data-act="close" title="Tutup"></div>
         <div class="fdot fdot-min" data-act="min" title="Minimize"></div>
         <div class="fdot fdot-max" data-act="max" title="Maximize"></div>
       </div>
       <div class="fwin-title"><i class="fas ${cfg.ico}" style="color:${cfg.accent}" aria-hidden="true"></i>${cfg.title}</div>
       <div class="fwin-actions">
         <button class="fwin-act" data-act="min" title="Minimize" aria-label="Minimize ${cfg.title}"><i class="fas fa-minus" aria-hidden="true"></i></button>
         <button class="fwin-act" data-act="max" title="Maximize" aria-label="Maximize ${cfg.title}"><i class="fas fa-expand" aria-hidden="true"></i></button>
         <button class="fwin-act" data-act="close" title="Close" aria-label="Close ${cfg.title}"><i class="fas fa-xmark" aria-hidden="true"></i></button>
       </div>
     </div>
     <div class="fwin-body" id="fwin-body-${appId}"></div>
     <div class="fwin-resize" aria-hidden="true"></div>`;

  // Pindahkan section dari vault ke window body
  const body = win.querySelector('.fwin-body');
  body.appendChild(section);
  section.classList.add('active');

  mount.appendChild(win);
  focusWindow(appId);

  // Jika dibuka via keyboard → pindah fokus ke window (WCAG 2.4.3)
  const srcBtn = document.querySelector(`.launch-btn[data-app="${appId}"]`);
  if (srcBtn && document.activeElement === srcBtn) win.focus();

  requestAnimationFrame(()=>requestAnimationFrame(()=>win.classList.add('open')));

  // Kontrol titlebar
  win.querySelectorAll('[data-act]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const act = btn.dataset.act;
      if (act==='close') closeWindow(appId);
      else if (act==='min') minimizeWindow(appId);
      else if (act==='max') toggleMax(appId);
    });
  });

  // Drag
  const bar = win.querySelector('.fwin-bar');
  let dragging = false, dx0=0, dy0=0, ox=0, oy=0;
  bar.addEventListener('mousedown', e=>{
    if (e.target.closest('[data-act]')) return;
    dragging = true;
    const r = win.getBoundingClientRect();
    ox = r.left; oy = r.top;
    dx0 = e.clientX; dy0 = e.clientY;
    bar.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e=>{
    if (!dragging) return;
    const nx = ox + (e.clientX-dx0);
    const ny = oy + (e.clientY-dy0);
    win.style.left = Math.max(-win.offsetWidth+80, Math.min(nx, window.innerWidth-80))+'px';
    win.style.top = Math.max(0, Math.min(ny, window.innerHeight-60))+'px';
  });
  document.addEventListener('mouseup', ()=>{ dragging = false; bar.style.cursor = 'grab'; });

  // Resize
  const rz = win.querySelector('.fwin-resize');
  let resizing = false, rx0=0, ry0=0, rw0=0, rh0=0;
  rz.addEventListener('mousedown', e=>{
    resizing = true;
    rx0 = e.clientX; ry0 = e.clientY;
    rw0 = win.offsetWidth; rh0 = win.offsetHeight;
    e.preventDefault(); e.stopPropagation();
  });
  document.addEventListener('mousemove', e=>{
    if (!resizing) return;
    win.style.width = Math.max(360, rw0 + (e.clientX-rx0))+'px';
    win.style.height = Math.max(260, rh0 + (e.clientY-ry0))+'px';
  });
  document.addEventListener('mouseup', ()=>{ resizing = false; });

  // Klik → fokus
  win.addEventListener('mousedown', ()=>focusWindow(appId), true);

  // Taskbar + launcher state
  taskbar.querySelector(`.tb-btn[data-app="${appId}"]`)?.classList.add('open');
  const lbtn = document.querySelector(`.launch-btn[data-app="${appId}"]`);
  if (lbtn) { lbtn.classList.add('on'); lbtn.setAttribute('aria-pressed', 'true'); }

  // Lazy init halaman
  if (LAZY[appId]) LAZY[appId]();
}

function focusWindow(appId){
  const win = mount.querySelector(`.fwin[data-app="${appId}"]`);
  if (!win) return;
  if (win.classList.contains('minimized')){ restoreWindow(appId); return; }
  zTop++;
  win.style.zIndex = zTop;
  win.classList.add('focused');
  mount.querySelectorAll('.fwin').forEach(w=>{ if(w!==win) w.classList.remove('focused'); });
}

function closeWindow(appId){
  const win = mount.querySelector(`.fwin[data-app="${appId}"]`);
  if (!win) return;
  win.classList.remove('open');
  win.classList.add('closing');
  const section = win.querySelector('.fwin-body .page');
  setTimeout(()=>{
    if (section) vault.appendChild(section);
    section && section.classList.remove('active');
    win.remove();
  }, 240);
  openApps.delete(appId);
  taskbar.querySelector(`.tb-btn[data-app="${appId}"]`)?.classList.remove('open');
  const lbtn = document.querySelector(`.launch-btn[data-app="${appId}"]`);
  if (lbtn) { lbtn.classList.remove('on'); lbtn.setAttribute('aria-pressed', 'false'); }
  updateDim();
}

function minimizeWindow(appId){
  const win = mount.querySelector(`.fwin[data-app="${appId}"]`);
  if (!win) return;
  win.classList.add('minimized');
  win.style.display = 'none';
  taskbar.querySelector(`.tb-btn[data-app="${appId}"]`)?.classList.add('minimized');
  updateDim();
}

function restoreWindow(appId){
  const win = mount.querySelector(`.fwin[data-app="${appId}"]`);
  if (!win) return;
  win.classList.remove('minimized');
  win.style.display = 'flex';
  taskbar.querySelector(`.tb-btn[data-app="${appId}"]`)?.classList.remove('minimized');
  focusWindow(appId);
  updateDim();
}

function toggleMax(appId){
  const win = mount.querySelector(`.fwin[data-app="${appId}"]`);
  if (!win) return;
  if (win.dataset.max === '1'){
    win.dataset.max = '0';
    win.style.left = win.dataset.ox+'px';
    win.style.top = win.dataset.oy+'px';
    win.style.width = win.dataset.ow+'px';
    win.style.height = win.dataset.oh+'px';
  } else {
    win.dataset.max = '1';
    win.dataset.ox = win.style.left;
    win.dataset.oy = win.style.top;
    win.dataset.ow = win.style.width;
    win.dataset.oh = win.style.height;
    win.style.left = '12px';
    win.style.top = '12px';
    win.style.width = (window.innerWidth-24)+'px';
    win.style.height = (window.innerHeight-24)+'px';
  }
}

function updateDim(){
  orbDim.classList.toggle('show', openApps.size > 0);
}

/*── Launcher click ──*/
document.querySelectorAll('.launch-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>openWindow(btn.dataset.app));
});

/*── Taskbar click (minimize/restore toggle) + keyboard (WCAG 2.1.1) ──*/
function tbToggle(app){
  const win = mount.querySelector(`.fwin[data-app="${app}"]`);
  if (!win){ openWindow(app); return; }
  if (win.classList.contains('minimized')) restoreWindow(app);
  else minimizeWindow(app);
}
document.querySelectorAll('.tb-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>tbToggle(btn.dataset.app));
  btn.addEventListener('keydown', e=>{
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); tbToggle(btn.dataset.app); }
  });
});

/*── Sembunyikan window saat klik di luar (opsional: orb tetap interaktif) ──*/
document.addEventListener('keydown', e=>{
  if (e.key === 'Escape'){
    const top = mount.querySelector('.fwin.focused');
    if (top) closeWindow(top.dataset.app);
  }
});

}());

/*═══════════════════════════════════════
  ⌘K COMMAND PALETTE
═══════════════════════════════════════*/
(function(){
'use strict';

const cmds = [
  {name:'Dashboard', app:'dashboard', ico:'fa-chart-line'},
  {name:'Ecosystem', app:'ecosystem', ico:'fa-diagram-project'},
  {name:'Swarm', app:'swarm', ico:'fa-network-wired'},
  {name:'Task Kanban', app:'taskqueue', ico:'fa-columns'},
  {name:'Terminal', app:'terminal', ico:'fa-terminal'},
  {name:'Telegram', app:'telegram', ico:'fa-paper-plane'},
  {name:'Storage', app:'storage', ico:'fa-hdd'},
  {name:'Skill Bank', app:'skills', ico:'fa-brain'},
  {name:'Skill Market', app:'skills-market', ico:'fa-store'},
  {name:'System', app:'system', ico:'fa-cog'},
  {name:'Cost Monitor', app:'cost', ico:'fa-coins'},
  {name:'Deploy', app:'deploy', ico:'fa-rocket'},
  {name:'Close All Windows', action:'closeAll', ico:'fa-xmark'},
];

function createPalette(){
  const overlay = document.createElement('div');
  overlay.id = 'cmdPalette';
  overlay.innerHTML = `
    <div class="cmd-overlay" data-close></div>
    <div class="cmd-box">
      <div class="cmd-input-wrap">
        <i class="fas fa-search cmd-search-ico"></i>
        <input type="text" class="cmd-input" placeholder="Type a command..." autofocus aria-label="Command palette">
      </div>
      <div class="cmd-list"></div>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('.cmd-input');
  const list = overlay.querySelector('.cmd-list');
  const box = overlay.querySelector('.cmd-box');

  function render(filter){
    const f = filter.toLowerCase();
    const filtered = cmds.filter(c => c.name.toLowerCase().includes(f));
    list.innerHTML = filtered.map((c,i) => `
      <div class="cmd-item${i===0?' active':''}" data-cmd="${JSON.stringify(c).replace(/"/g,'&quot;')}">
        <i class="fas ${c.ico}"></i> ${c.name}
      </div>`).join('');
  }

  input.addEventListener('input', ()=>render(input.value));

  list.addEventListener('click', e=>{
    const item = e.target.closest('.cmd-item');
    if(!item) return;
    const cmd = JSON.parse(item.dataset.cmd);
    if(cmd.action==='closeAll'){
      document.querySelectorAll('.fwin').forEach(w => closeWindow(w.dataset.app));
    } else if(cmd.app){
      openWindow(cmd.app);
    }
    overlay.remove();
  });

  input.addEventListener('keydown', e=>{
    const items = list.querySelectorAll('.cmd-item');
    const active = list.querySelector('.cmd-item.active');
    let idx = Array.from(items).indexOf(active);
    if(e.key==='ArrowDown'){ idx = Math.min(idx+1, items.length-1); }
    else if(e.key==='ArrowUp'){ idx = Math.max(idx-1, 0); }
    else if(e.key==='Enter' && active){ active.click(); return; }
    else if(e.key==='Escape'){ overlay.remove(); return; }
    else return;
    items.forEach(i=>i.classList.remove('active'));
    items[idx]?.classList.add('active');
    items[idx]?.scrollIntoView({block:'nearest'});
    e.preventDefault();
  });

  overlay.querySelector('[data-close]').addEventListener('click', ()=>overlay.remove());
  input.focus();
}

// Keyboard shortcut: ⌘K or Ctrl+K
document.addEventListener('keydown', e=>{
  if((e.metaKey||e.ctrlKey) && e.key==='k'){
    e.preventDefault();
    const existing = document.getElementById('cmdPalette');
    if(existing) existing.remove();
    else createPalette();
  }
});

/*═══════════════════════════════════════
  L3 INSPECTOR FUNCTIONS
═══════════════════════════════════════*/
async function loadInspector(){
  const taskId = document.getElementById('inspectorSearch')?.value?.trim();
  if (!taskId) return;
  const out = document.getElementById('inspectorOutput');
  out.innerHTML = '<div style="color:#38bdf8;padding:1rem"><i class="fas fa-spinner fa-spin"></i> Loading task ' + taskId + '...</div>';
  try {
    const r = await fetch('/api/mc/task/' + taskId);
    const data = await r.json();
    if (data.error) { out.innerHTML = '<div style="color:#ff3366;padding:1rem">Error: ' + data.error + '</div>'; return; }
    const t = data.task;
    out.innerHTML = `
      <div class="inspector-grid">
        <div class="inspector-panel">
          <h3 style="color:#38bdf8;font-size:.9rem;margin:0 0 8px">Task Detail</h3>
          <div class="inspector-row"><span class="il">ID</span><span class="iv mono">${t.id}</span></div>
          <div class="inspector-row"><span class="il">Title</span><span class="iv">${t.title || t.instruction || 'N/A'}</span></div>
          <div class="inspector-row"><span class="il">Status</span><span class="iv"><span class="status-pill status-${t.status}">${t.status}</span></span></div>
          <div class="inspector-row"><span class="il">Agent</span><span class="iv">${t.agent || 'N/A'}</span></div>
          <div class="inspector-row"><span class="il">Created</span><span class="iv mono">${t.created_at || 'N/A'}</span></div>
          <div class="inspector-row"><span class="il">Updated</span><span class="iv mono">${t.updated_at || 'N/A'}</span></div>
        </div>
        <div class="inspector-panel">
          <h3 style="color:#38bdf8;font-size:.9rem;margin:0 0 8px">Timeline</h3>
          ${data.events.length ? data.events.map(e => `
            <div class="inspector-timeline-item">
              <span class="tl-time">${e.ts || ''}</span>
              <span class="tl-type">${e.type}</span>
              <span class="tl-source">${e.source || ''}</span>
            </div>`).join('') : '<div class="iv" style="color:#7c8ba0">No events</div>'}
        </div>
        <div class="inspector-panel">
          <h3 style="color:#38bdf8;font-size:.9rem;margin:0 0 8px">Audit Log</h3>
          ${data.audit.length ? data.audit.map(a => `
            <div class="inspector-timeline-item">
              <span class="tl-time">${a.ts || ''}</span>
              <span class="tl-type">${a.actor} → ${a.action}</span>
            </div>`).join('') : '<div class="iv" style="color:#7c8ba0">No audit entries</div>'}
        </div>
        <div class="inspector-panel">
          <h3 style="color:#38bdf8;font-size:.9rem;margin:0 0 8px">Cost</h3>
          ${data.cost.length ? data.cost.map(c => `
            <div class="inspector-timeline-item">
              <span class="tl-type">${c.agent || 'N/A'}</span>
              <span class="iv">${c.model || ''} — $${(c.cost_usd || 0).toFixed(4)}</span>
            </div>`).join('') : '<div class="iv" style="color:#7c8ba0">No cost data</div>'}
        </div>
      </div>`;
  } catch(e) {
    out.innerHTML = '<div style="color:#ff3366;padding:1rem">Error: ' + e.message + '</div>';
  }
}

async function loadInspectorAudit(){
  const out = document.getElementById('inspectorOutput');
  out.innerHTML = '<div style="color:#38bdf8;padding:1rem"><i class="fas fa-spinner fa-spin"></i> Loading audit log...</div>';
  try {
    const r = await fetch('/api/mc/audit?limit=50');
    const data = await r.json();
    out.innerHTML = `
      <h3 style="color:#38bdf8;font-size:.9rem;margin:0 0 8px">Audit Log (${data.count} entries)</h3>
      <table class="inspector-table">
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th></tr></thead>
        <tbody>
          ${data.entries.map(e => `<tr>
            <td class="mono">${e.ts || ''}</td>
            <td>${e.actor || ''}</td>
            <td>${e.action || ''}</td>
            <td class="mono">${e.target || ''}</td>
            <td>${e.result || ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch(e) {
    out.innerHTML = '<div style="color:#ff3366;padding:1rem">Error: ' + e.message + '</div>';
  }
}

async function loadInspectorCost(){
  const out = document.getElementById('inspectorOutput');
  out.innerHTML = '<div style="color:#38bdf8;padding:1rem"><i class="fas fa-spinner fa-spin"></i> Loading cost breakdown...</div>';
  try {
    const r = await fetch('/api/mc/cost/agents');
    const data = await r.json();
    const agents = data.agents || data.breakdown || [];
    out.innerHTML = `
      <h3 style="color:#38bdf8;font-size:.9rem;margin:0 0 8px">Cost Breakdown</h3>
      ${agents.length ? `
        <table class="inspector-table">
          <thead><tr><th>Agent</th><th>Model</th><th>Tokens In</th><th>Tokens Out</th><th>Cost (USD)</th></tr></thead>
          <tbody>
            ${agents.map(a => `<tr>
              <td>${a.agent || a.name || 'N/A'}</td>
              <td>${a.model || 'N/A'}</td>
              <td class="mono">${(a.tokens_in || a.total_in || 0).toLocaleString()}</td>
              <td class="mono">${(a.tokens_out || a.total_out || 0).toLocaleString()}</td>
              <td>$${(a.cost_usd || a.total_cost || 0).toFixed(4)}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<div class="iv" style="color:#7c8ba0">No cost data yet</div>'}
  } catch(e) {
    out.innerHTML = '<div style="color:#ff3366;padding:1rem">Error: ' + e.message + '</div>';
  }
}
}());


  // ── Directive & Live Telemetry (template integration) ──
  const THREAD_NAMES = { '1': 'General', '802': 'Research', '803': 'Coder', '804': 'QA', '1172': 'Konten Kreator' };
  const THREAD_ORDER = ['1', '802', '803', '804', '1172'];

  async function loadDirective() {
    try {
      const res = await fetch('/api/mc/directive');
      const data = await res.json();
      if (!data.threads || !data.threads.length) return;
      const threads = data.threads;

      // Directive — thread paling baru aktif
      let active = threads[0];
      for (const t of threads) {
        if ((t.updated_at || '') > (active.updated_at || '')) active = t;
      }
      const elId = document.getElementById('dirThreadId');
      const elText = document.getElementById('dirText');
      const elMeta = document.getElementById('dirThreadMeta');
      if (elId) elId.textContent = `Thread ${active.thread_id} · ${THREAD_NAMES[active.thread_id] || '—'}`;
      if (elText) elText.textContent = active.directive || 'Tidak ada direktif khusus untuk thread ini (default agent).';
      if (elMeta) elMeta.textContent = `Model: ${active.model} · Update: ${(active.updated_at || '—').slice(0, 16).replace('T', ' ')}`;

      // Context window rows (template style)
      const grid = document.getElementById('ctxGrid');
      if (grid) {
        grid.innerHTML = '';
        for (const t of threads) {
          const pct = Math.min(t.context_pct || 0, 100);
          const warn = pct > 80 ? ' warn' : '';
          const row = document.createElement('div');
          row.className = 'at-context-row';
          row.innerHTML = `
            <div class="at-context-head">
              <span class="at-name">#${t.thread_id} · ${THREAD_NAMES[t.thread_id] || '—'}</span>
              <span class="at-pct">${(t.context_tokens / 1000).toFixed(1)}K/${(t.context_max / 1000).toFixed(0)}K · ${t.context_pct || 0}%</span>
            </div>
            <div class="at-context-bar"><div class="at-context-fill${warn}" style="width:${pct}%"></div></div>`;
          grid.appendChild(row);
        }
      }
    } catch (e) {
      console.warn('loadDirective failed:', e);
    }
  }

  async function loadTelemetry() {
    try {
      const res = await fetch('/api/mc/system');
      const s = await res.json();
      const up = document.getElementById('tileUptime');
      if (up) up.textContent = s.uptime || '—';
      // VPS bars
      const setVps = (labelId, barId, pct, text) => {
        const l = document.getElementById(labelId);
        const b = document.getElementById(barId);
        if (l) l.textContent = text;
        if (b) b.style.width = Math.min(pct, 100) + '%';
      };
      if (s.cpu_percent !== undefined) setVps('vpsCpuLabel', 'vpsCpuBar', s.cpu_percent, s.cpu_percent + '%');
      if (s.memory && s.memory.percent !== undefined) setVps('vpsRamLabel', 'vpsRamBar', s.memory.percent, s.memory.percent + '% (' + (s.memory.used_gb || 0).toFixed(1) + '/' + (s.memory.total_gb || 0).toFixed(0) + ' GB)');
      if (s.disk && s.disk.percent !== undefined) setVps('vpsDiskLabel', 'vpsDiskBar', s.disk.percent, s.disk.percent + '%');
      const dbEl = document.getElementById('vpsDbLabel');
      if (dbEl && s.disk && s.disk.free_gb !== undefined) {
        dbEl.textContent = s.disk.free_gb.toFixed(1) + ' GB free';
        document.getElementById('vpsDbBar').style.width = '25%';
      }
    } catch (e) {}
    try {
      const res = await fetch('/api/mc/tasks');
      const t = await res.json();
      const pending = (t.pending || []).length + (t.queue || []).length;
      const all = [...(t.pending || []), ...(t.running || []), ...(t.done || []), ...(t.completed || [])];
      const today = new Date().toISOString().slice(0, 10);
      const doneToday = all.filter(it => (it.created_at || it.updated_at || it.completed_at || '').slice(0, 10) === today).length;
      const q = document.getElementById('tileQueue');
      if (q) q.textContent = pending;
      const td = document.getElementById('tileToday');
      if (td) td.textContent = doneToday;
      const th = document.getElementById('statThroughput');
      if (th) th.textContent = all.length || '—';
    } catch (e) {}
    try {
      const res = await fetch('/api/mc/ws/sessions?limit=100');
      const s = await res.json();
      const el = document.getElementById('tileSessions');
      if (el) el.textContent = (s.sessions || []).length;
    } catch (e) {}
    try {
      const res = await fetch('/api/mc/errors?limit=1');
      if (res.ok) {
        const d = await res.json();
        const el = document.getElementById('tileErrors');
        if (el) el.textContent = d.count !== undefined ? d.count : '—';
      }
    } catch (e) {}
  }

  async function loadStatsStrip() {
    try {
      // Integrity: hitung dari errors — 100 - (errors_hari_ini * 2), floor 0
      const er = await fetch('/api/mc/errors?limit=1');
      if (er.ok) {
        const d = await er.json();
        const integrity = Math.max(0, Math.round(100 - (d.count || 0) * 1.5));
        const el = document.getElementById('statIntegrity');
        if (el) el.textContent = integrity + '%';
      }
    } catch (e) {}
    try {
      // Agent Calls & Messages: dari log swarm (data nyata)
      const lr = await fetch('/api/mc/logs?limit=500');
      if (lr.ok) {
        const ld = await lr.json();
        const logs = ld.logs || [];
        const calls = new Set(logs.map(l => l.task_id)).size;
        const elC = document.getElementById('statCalls');
        if (elC) elC.textContent = calls || '—';
        const elM = document.getElementById('statMessages');
        if (elM) elM.textContent = logs.length || '—';
      }
    } catch (e) {}
    try {
      const dr = await fetch('/api/mc/directive');
      const d = await dr.json();
      const threads = d.threads || [];
      let tokens = 0;
      for (const t of threads) tokens += t.context_tokens || 0;
      const elT = document.getElementById('statTokens');
      if (elT) elT.textContent = tokens ? (tokens / 1000000).toFixed(1) + 'M' : '—';
    } catch (e) {}
  }

  async function loadActivity() {
    try {
      const res = await fetch('/api/mc/logs?limit=15');
      const d = await res.json();
      const logs = d.logs || [];
      const feed = document.getElementById('activityFeed');
      if (!feed) return;
      if (!logs.length) {
        feed.innerHTML = '<div style="color:var(--at-text-muted);font-size:12px;font-family:var(--at-font-mono)">Belum ada aktivitas tercatat.</div>';
        return;
      }
      feed.innerHTML = '';
      const badgeMap = { research: 'badge-research', programmer: 'badge-coder', coder: 'badge-coder', qa: 'badge-qa', creator: 'badge-creator', chief: 'badge-orch', orchestrator: 'badge-orch' };
      for (const log of logs.slice(0, 15)) {
        const agent = (log.agent_id || log.agent || 'chief').toLowerCase();
        const status = (log.status || 'ok').toLowerCase();
        const text = log.task || log.message || log.summary || JSON.stringify(log).slice(0, 120);
        const time = (log.created_at || log.ts || log.timestamp || '').toString().slice(11, 16) || '';
        const item = document.createElement('div');
        item.className = 'at-feed-item';
        item.innerHTML = `
          <span class="at-feed-badge ${badgeMap[agent] || 'badge-orch'}">${agent.toUpperCase().slice(0, 5)}</span>
          <span class="at-feed-text" title="${text.replace(/"/g, '&quot;')}">${text}</span>
          <span class="at-feed-time ${status === 'error' || status === 'err' ? 'at-feed-err' : 'at-feed-ok'}">${status === 'error' || status === 'err' ? 'ERR' : 'OK'}${time ? ' · ' + time : ''}</span>`;
        feed.appendChild(item);
      }
    } catch (e) {}
    try {
      const res = await fetch('/api/mc/agents');
      const d = await res.json();
      const agents = d.agents || [];
      const mini = document.getElementById('swarmMini');
      if (mini) {
        mini.innerHTML = agents.map(a =>
          `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span>${a.name || a.id}</span>
            <span style="color:${(a.status || 'idle') === 'active' ? 'var(--at-mint)' : 'var(--at-amber)'}">${(a.status || 'idle').toUpperCase()}</span>
          </div>`).join('') || '—';
      }
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Hash routing: /#page-XXX → buka window tersebut
    const h = location.hash.slice(1);
    if (h && window.PAGES && PAGES[h]) {
      setTimeout(() => openWindow(h), 300);
    }
    loadDirective();
    loadTelemetry();
    loadStatsStrip();
    loadActivity();
    setInterval(() => { loadDirective(); loadTelemetry(); loadStatsStrip(); loadActivity(); }, 30000);
    // Hash berubah saat sudah di dashboard (klik link / manual) → reuse initNav
    window.addEventListener('hashchange', () => {
      const h2 = location.hash.slice(1);
      if (!h2) return;
      const it2 = document.querySelector(`.nav-item[data-page="${h2}"]`);
      if (it2) it2.click();
    });
  });
  