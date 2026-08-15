/*═════════════════════════════════════════════════════
  HERMES MISSION CONTROL v4.0 — View Modes Module
  SWARM topology graph · MEMORY ecosystem map · LOGS stream
  Vanilla JS · IIFE · No dependencies
═════════════════════════════════════════════════════*/
(function(){
'use strict';

const API = 'http://localhost:5200';
const $ = s => document.getElementById(s);
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const STATUS_COLOR = {
  stable:'#22c55e', active:'#f97316', running:'#3b82f6', degraded:'#f59e0b',
  error:'#ef4444', idle:'#52525b', unknown:'#52525b'
};

async function safeFetch(url, timeout=8000){
  try {
    const r = await fetch(url, {signal: AbortSignal.timeout(timeout)});
    if (!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  } catch(e){ return null; }
}

/*── Data source: WS state (live) → fallback API → fallback demo ──*/
function getAgents(){
  const st = window.__mcState && window.__mcState.agents;
  if (Array.isArray(st) && st.length) return st;
  return null;
}

/*═══════════════════════════════════════
  VIEW: SWARM — topology graph (SVG)
═══════════════════════════════════════*/
const FIXED_AGENTS = [
  {id:'chief',     nm:'Hermes Chief', tp:'Orchestrator'},
  {id:'research',  nm:'Agent 01',     tp:'Research'},
  {id:'programmer',nm:'Agent 02',     tp:'Programmer'},
  {id:'qa',        nm:'Agent 03',     tp:'QA Tester'},
  {id:'creator',   nm:'Agent 04',     tp:'Content'},
];

function renderSwarm(host){
  const agents = getAgents();
  const W = 720, H = 300, CX = W/2, CY = H/2, R = 92;

  // Node status map: dari data live (status string) atau demo
  const statusOf = {};
  const demoSt = ['active','active','idle','idle','active'];
  FIXED_AGENTS.forEach((a,i)=>{
    let st = demoSt[i];
    if (agents){
      const match = agents.find(x => (x.id||x.agent_id||'').toLowerCase() === a.id);
      if (match) st = String(match.status || match.state || 'idle').toLowerCase();
    }
    statusOf[a.id] = st;
  });

  const nodes = FIXED_AGENTS.map((a,i)=>{
    const ang = (i/FIXED_AGENTS.length)*Math.PI*2 - Math.PI/2;
    return { ...a, x: CX + Math.cos(ang)*R, y: CY + Math.sin(ang)*R, st: statusOf[a.id] };
  });
  const chief = nodes[0];

  let svg = `<svg class="swarm-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Swarm topology">`;
  svg += `<defs><radialGradient id="swGrad" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="rgba(249,115,22,.25)"/><stop offset="100%" stop-color="rgba(249,115,22,0)"/></radialGradient></defs>`;

  // Core glow
  svg += `<circle cx="${CX}" cy="${CY}" r="70" fill="url(#swGrad)"/>`;

  // Links (chief → semua)
  nodes.slice(1).forEach(n=>{
    const active = n.st === 'active';
    svg += `<line class="swarm-link" x1="${chief.x}" y1="${chief.y}" x2="${n.x}" y2="${n.y}"
      stroke="${active ? 'rgba(249,115,22,.45)' : 'rgba(82,82,91,.25)'}" stroke-width="${active ? 1.2 : .7}"
      stroke-dasharray="${active ? 'none' : '3 4'}"/>`;
  });
  // Links antar agent (mesh)
  for(let i=1;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){
      if (i+j > 8) continue;
      svg += `<line class="swarm-link" x1="${nodes[i].x}" y1="${nodes[i].y}" x2="${nodes[j].x}" y2="${nodes[j].y}"
        stroke="rgba(139,92,246,.12)" stroke-width=".5"/>`;
    }
  }

  // Nodes
  nodes.forEach((n,i)=>{
    const c = STATUS_COLOR[n.st] || STATUS_COLOR.unknown;
    const pulse = n.st === 'active' ? ' swarm-pulse' : '';
    const r = i===0 ? 16 : 12;
    svg += `<circle class="swarm-node${pulse}" cx="${n.x}" cy="${n.y}" r="${r+4}" fill="rgba(4,4,4,.6)"/>`;
    svg += `<circle class="swarm-node${pulse}" cx="${n.x}" cy="${n.y}" r="${r}" fill="none" stroke="${c}" stroke-width="1.5"/>`;
    svg += `<circle class="swarm-node" cx="${n.x}" cy="${n.y}" r="${r-4}" fill="${c}" opacity=".25"/>`;
    svg += `<circle class="swarm-node" cx="${n.x}" cy="${n.y}" r="3.5" fill="${c}"/>`;
    // Label
    svg += `<text x="${n.x}" y="${n.y+r+16}" text-anchor="middle" font-size="9" font-family="Space Grotesk, sans-serif" fill="#d4d4d8">${esc(n.nm)}</text>`;
    svg += `<text x="${n.x}" y="${n.y+r+27}" text-anchor="middle" font-size="7" font-family="JetBrains Mono, monospace" fill="#52525b">${esc(n.tp)}</text>`;
  });

  // Chief label
  svg += `<text x="${chief.x}" y="${chief.y-24}" text-anchor="middle" font-size="8" font-family="JetBrains Mono, monospace" fill="#f97316" letter-spacing="2">CHIEF</text>`;
  svg += `</svg>`;

  const legend = Object.entries({active:'Active',idle:'Idle',degraded:'Degraded',error:'Error'})
    .map(([k,v])=>`<span><div class="pdot" style="background:${STATUS_COLOR[k]}"></div>${v}</span>`).join('');

  host.innerHTML =
    `<div class="vh-title"><i class="fas fa-network-wired"></i>SWARM TOPOLOGY · ${FIXED_AGENTS.length} AGENT MESH</div>` +
    svg +
    `<div class="swarm-legend">${legend}</div>`;
}

/*═══════════════════════════════════════
  VIEW: MEMORY — ecosystem knowledge map
═══════════════════════════════════════*/
let memCache = null, memCacheT = 0;

async function renderMemory(host){
  host.innerHTML = `<div class="vh-title"><i class="fas fa-brain"></i>KNOWLEDGE BASE · ECOSYSTEM MAP</div><div class="mem-empty">⟳ memuat data ecosystem...</div>`;

  // Cache 30s (ecosystem scan lambat — timeout 15s)
  if (!memCache || Date.now()-memCacheT > 30000){
    memCache = await safeFetch(API+'/api/mc/ecosystem', 15000);
    memCacheT = Date.now();
  }
  const data = memCache;
  if (!data || !Array.isArray(data.projects)){
    host.innerHTML = `<div class="vh-title"><i class="fas fa-brain"></i>KNOWLEDGE BASE</div><div class="mem-empty">tidak ada data ecosystem (API off)</div>`;
    return;
  }

  const cats = {};
  data.projects.forEach(p=>{
    const c = p.category || 'other';
    (cats[c] = cats[c] || []).push(p);
  });
  const catOrder = Object.keys(cats).sort((a,b)=>cats[b].length-cats[a].length);

  let html = `<div class="vh-title"><i class="fas fa-brain"></i>KNOWLEDGE BASE · ${data.projects.length} PROJECTS · ${catOrder.length} CATEGORIES</div>`;
  catOrder.forEach(cat=>{
    const projs = cats[cat];
    const ok = projs.filter(p=>String(p.status).toLowerCase()==='stable').length;
    html += `<div class="vh-title" style="margin-top:.8rem;font-size:.6rem"><i class="fas fa-folder-open" style="font-size:.55rem"></i>${esc(cat)} · ${ok}/${projs.length} STABLE</div>`;
    html += `<div class="mem-grid">`;
    projs.forEach(p=>{
      const st = String(p.status||'unknown').toLowerCase();
      const c = STATUS_COLOR[st] || STATUS_COLOR.unknown;
      const git = p.is_git ? '<i class="fas fa-code-branch" style="color:var(--t3);font-size:.5rem"></i>' : '';
      const depl = p.deploy_url ? '<i class="fas fa-globe" style="color:var(--or400);font-size:.5rem"></i>' : '';
      html += `<div class="mem-card"><div class="mem-nm">${git}${depl}&nbsp;${esc(p.name)}</div>`+
        `<div class="mem-cat">${esc(p.category||'—')}</div>`+
        `<div class="mem-st"><div class="pdot" style="background:${c}"></div>${esc(st)}</div></div>`;
    });
    html += `</div>`;
  });
  host.innerHTML = html;
}

/*═══════════════════════════════════════
  VIEW: LOGS — agent log stream
═══════════════════════════════════════*/
let logsCache = null, logsCacheT = 0;

async function renderLogs(host){
  host.innerHTML = `<div class="vh-title"><i class="fas fa-terminal"></i>AGENT LOG STREAM</div><div class="mem-empty">⟳ memuat logs...</div>`;

  if (!logsCache || Date.now()-logsCacheT > 8000){
    logsCache = await safeFetch(API+'/api/mc/logs');
    logsCacheT = Date.now();
  }
  const data = logsCache;
  if (!data || !Array.isArray(data.logs) || !data.logs.length){
    host.innerHTML = `<div class="vh-title"><i class="fas fa-terminal"></i>AGENT LOG STREAM</div><div class="mem-empty">belum ada log aktivitas</div>`;
    return;
  }

  const rows = data.logs.slice(0, 40).map(l=>{
    const lv = String(l.level||'INFO').toUpperCase();
    const lvCls = ['WARN','ERROR','OK'].includes(lv) ? lv : (lv==='DEBUG' ? 'INFO' : lv);
    return `<div class="lv-l"><span class="lv-t">${esc(l.timestamp||'')}</span><span class="lv-a">[${esc(l.agent_id||'?')}]</span>`+
      `<span class="lv-${lvCls}">${lv}</span><span class="lv-msg">${esc(l.message||'')}</span></div>`;
  }).join('');

  host.innerHTML = `<div class="vh-title"><i class="fas fa-terminal"></i>AGENT LOG STREAM · ${data.logs.length} ENTRIES</div><div class="lv">${rows}</div>`;
}

/*═══════════════════════════════════════
  VIEW: DISPATCH — pipeline antar-thread realtime
═══════════════════════════════════════*/
const THREAD_LABELS = [
  {id:'1', nm:'General'},
  {id:'802', nm:'Research'},
  {id:'803', nm:'Programmer'},
  {id:'804', nm:'QA / Pengawas'},
  {id:'1172', nm:'Kreator'},
];
const STATUS_PILL = {
  pending: '<span class="pill pill-t">⟳ PENDING</span>',
  sent: '<span class="pill pill-t">📨 SENT</span>',
  done: '<span class="pill pill-a">✅ DONE</span>',
  error: '<span class="pill pill-e">❌ ERROR</span>',
};

function escDp(s){ return esc(s); }

function renderDispatchList(host, list){
  if (!list || !list.length){
    host.innerHTML = `<div class="dp-empty">belum ada dispatch — kirim perintah pertama via form di atas</div>`;
    return;
  }
  const rows = list.map(d=>{
    const pill = STATUS_PILL[d.status] || STATUS_PILL.pending;
    const res = d.result ? `<div class="dp-res">${escDp(d.result.slice(0,500))}</div>` : '';
    const err = d.error ? `<div class="dp-res" style="color:var(--red);border-top-color:rgba(239,68,68,.15)">⚠ ${escDp(d.error)}</div>` : '';
    return `<div class="dp-item">`+
      `<div class="dp-h"><span class="dp-route"><i class="fas fa-arrow-right" style="color:var(--t3)"></i>${escDp(d.from||'general')} <i class="fas fa-arrow-right" style="color:var(--or400)"></i> ${escDp(d.to||'?')} (${escDp(d.to_name||'')})</span>${pill}<span class="dp-ts">${escDp((d.ts||'').slice(11,19))}</span></div>`+
      `<div class="dp-msg">${escDp(d.message)}</div>${res}${err}</div>`;
  }).join('');
  host.innerHTML = rows;
}

function renderDispatchForm(host){
  const opts = THREAD_LABELS.map(t=>`<option value="${t.id}">${t.nm} (${t.id})</option>`).join('');
  const form = document.createElement('div');
  form.className = 'dp-form';
  form.innerHTML = `<select id="dpTarget">${opts}</select>`+
    `<input id="dpMsg" type="text" placeholder="Perintah untuk agent... (mis: audit struktur proyek)">`+
    `<button class="btn-g" id="dpSend"><i class="fas fa-paper-plane"></i> DISPATCH</button>`;
  host.prepend(form);

  form.querySelector('#dpSend').addEventListener('click', async ()=>{
    const target = form.querySelector('#dpTarget').value;
    const msg = form.querySelector('#dpMsg').value.trim();
    if (!msg) return;
    const btn = form.querySelector('#dpSend');
    btn.disabled = true; btn.style.opacity = .5;
    try {
      const r = await fetch(API+'/api/mc/dispatch', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({to:target, message:msg, source:'dashboard'}),
        signal: AbortSignal.timeout(20000),
      });
      const data = await r.json();
      if (data && data.id){
        form.querySelector('#dpMsg').value = '';
        await refreshDispatch(host, false);
      } else {
        alert('Gagal dispatch: '+(data.error||'unknown'));
      }
    } catch(e){
      alert('Gagal dispatch: '+e.message);
    }
    btn.disabled = false; btn.style.opacity = 1;
  });
}

async function refreshDispatch(host, initial){
  try {
    const r = await fetch(API+'/api/mc/dispatches?limit=20', {signal: AbortSignal.timeout(8000)});
    const data = await r.json();
    const list = (data && data.dispatches) || [];
    // Simpan di shared state agar WS update bisa pakai
    if (window.__mcState) window.__mcState.dispatches = list;
    const oldForm = host.querySelector('.dp-form');
    if (oldForm) oldForm.remove();
    renderDispatchList(host, list);
    renderDispatchForm(host);
  } catch(e){
    host.innerHTML = `<div class="dp-empty">tidak bisa akses API dispatch (${e.message})</div>`;
  }
}

async function renderDispatch(host){
  host.innerHTML = `<div class="vh-title"><i class="fas fa-paper-plane" style="color:var(--am400)"></i>THREAD DISPATCH PIPELINE</div><div class="dp-empty">⟳ memuat...</div>`;
  await refreshDispatch(host, true);
}

/*═══════════════════════════════════════
  PUBLIC API
═══════════════════════════════════════*/
let activeView = null, activeHost = null, refreshTimer = null;

function refreshActive(){
  if (!activeView || !activeHost) return;
  render(activeView, activeHost, true);
}

async function render(view, host, silent){
  activeView = view; activeHost = host;
  clearInterval(refreshTimer);
  if (view === 'swarm'){
    renderSwarm(host);
    refreshTimer = setInterval(()=>{ if(activeView==='swarm') renderSwarm(activeHost); }, 5000);
  } else if (view === 'memory'){
    await renderMemory(host);
    refreshTimer = setInterval(()=>{ if(activeView==='memory') renderMemory(activeHost); }, 30000);
  } else if (view === 'logs'){
    await renderLogs(host);
    refreshTimer = setInterval(()=>{ if(activeView==='logs') renderLogs(activeHost); }, 8000);
  } else if (view === 'dispatch'){
    await renderDispatch(host);
    refreshTimer = setInterval(()=>{ if(activeView==='dispatch') refreshDispatch(activeHost, false); }, 5000);
  }
}

window.__MCViews = { render };

})();
