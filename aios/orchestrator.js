/*═════════════════════════════════════════════════════
  HERMES MISSION CONTROL v4.0 — Orchestrator Module
  Live data wiring: API fetch + WS + render
  Vanilla JS · IIFE · No dependencies
═════════════════════════════════════════════════════*/
(function(){
'use strict';

const API = 'http://localhost:5200';
const $ = s => document.getElementById(s);
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const rand = (a,b) => Math.random()*(b-a)+a;
const randi = (a,b) => Math.floor(rand(a,b));
const pick = a => a[randi(0,a.length)];

/*── Fixed topology (dari ORCHESTRATOR.md) ──*/
const THREADS = [
  {id:1, nm:'Memory Indexer', sh:'MEMORY', ic:'fa-brain'},
  {id:2, nm:'Task Planner',   sh:'PLANNER', ic:'fa-diagram-project'},
  {id:3, nm:'Tool Engine',    sh:'TOOL', ic:'fa-terminal'},
  {id:4, nm:'Swarm Coord',    sh:'SWARM', ic:'fa-network-wired'},
  {id:5, nm:'Output Synth',   sh:'OUTPUT', ic:'fa-volume-high'},
];
const AGENTS = [
  {id:'chief',     nm:'Hermes Chief', tp:'Orchestrator', ic:'fa-user-astronaut'},
  {id:'research',  nm:'Agent 01',     tp:'Research',     ic:'fa-magnifying-glass'},
  {id:'programmer',nm:'Agent 02',     tp:'Programmer',   ic:'fa-code'},
  {id:'qa',        nm:'Agent 03',     tp:'QA Tester',    ic:'fa-bug'},
  {id:'creator',   nm:'Agent 04',     tp:'Content',      ic:'fa-pen-fancy'},
];

/*── Demo data (fallback saat API mati) ──*/
const DEMO_THREADS = [
  {cpu:65, mem:42, lat:14, st:'active'},
  {cpu:78, mem:55, lat:9,  st:'active'},
  {cpu:12, mem:28, lat:4,  st:'idle'},
  {cpu:58, mem:47, lat:16, st:'active'},
  {cpu:85, mem:62, lat:22, st:'throttled'},
];
const DEMO_AGENTS = [
  {st:'active', tok:2450, tsk:3},
  {st:'active', tok:4820, tsk:5},
  {st:'idle',   tok:1200, tsk:1},
  {st:'idle',   tok:800,  tsk:0},
  {st:'active', tok:3100, tsk:2},
];
const LOG_POOL = [
  {th:'MEMORY', m:'Vector sync completed — embeddings updated', lv:'ok'},
  {th:'PLANNER', m:'Chain-of-thought decomposition for task', lv:'info'},
  {th:'TOOL', m:'CLI executed: git status — 0 errors', lv:'ok'},
  {th:'SWARM', m:'Research dispatched to sub-task cluster', lv:'info'},
  {th:'OUTPUT', m:'TTS buffer overflow — throttling enabled', lv:'warn'},
  {th:'MEMORY', m:'RAG context pruned — stale entries removed', lv:'warn'},
  {th:'TOOL', m:'Web scrape timeout after 30s — retrying', lv:'err'},
  {th:'PLANNER', m:'Goal hierarchy recalculated — 3 sub-goals', lv:'ok'},
  {th:'SWARM', m:'Programmer completed batch — files modified', lv:'ok'},
  {th:'OUTPUT', m:'Audio waveform rendered', lv:'info'},
  {th:'MEMORY', m:'Knowledge graph node linked to context', lv:'info'},
  {th:'TOOL', m:'Docker container restarted — health OK', lv:'ok'},
];
const ACT_POOL = [
  {t:'Research selesai batch pencarian web', c:'var(--green)'},
  {t:'Task baru masuk antrian Planner', c:'var(--or400)'},
  {t:'Programmer push 3 commit ke staging', c:'var(--blue)'},
  {t:'Memory pruned entri stale', c:'var(--am400)'},
  {t:'Swarm rebalanced — QA ambil 2 task', c:'var(--violet)'},
  {t:'Creator generate executive summary', c:'var(--green)'},
  {t:'System health check passed', c:'var(--green)'},
  {t:'QA flag latency spike pada T-005', c:'var(--red)'},
];
const pillCls = {active:'pill-a', idle:'pill-i', throttled:'pill-t', error:'pill-e'};

/*── State ──*/
let apiAlive = false;
let logCount = 0;
let ws = null;

/*── Helpers ──*/
const timeStr = () => new Date().toLocaleTimeString('en-US',{hour12:false});
const shortTime = () => new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit'});

async function safeFetch(url){
  try {
    const r = await fetch(url, {signal: AbortSignal.timeout(4000)});
    if (!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  } catch(e) { return null; }
}

/*── RENDER ──*/
function renderThreads(metrics){
  const el = $('threadList');
  if(!el) return;
  const frag = document.createDocumentFragment();
  THREADS.forEach((t,i)=>{
    const m = metrics[i] || DEMO_THREADS[i] || {cpu:20,mem:30,lat:5,st:'idle'};
    const d = document.createElement('div');
    d.className = 'tc gl';
    d.dataset.threadId = t.id;
    d.innerHTML = `<div class="tc-h"><div class="tc-info"><div class="tc-ico"><i class="fas ${t.ic}"></i></div><div><div class="tc-nm">${t.nm}</div><div class="tc-id">T-00${t.id} · ${t.sh}</div></div></div><div class="pill ${pillCls[m.st]||'pill-i'}">${m.st}</div></div>`+
      `<div class="tc-m"><div><div class="tc-ml"><i class="fas fa-microchip"></i>CPU</div><div class="tc-bar"><div class="tc-bf" style="width:${clamp(m.cpu,2,100)}%"></div></div><div class="tc-mv">${m.cpu}%</div></div>`+
      `<div><div class="tc-ml"><i class="fas fa-memory"></i>MEM</div><div class="tc-bar"><div class="tc-bf" style="width:${clamp(m.mem,2,100)}%"></div></div><div class="tc-mv">${m.mem}%</div></div>`+
      `<div><div class="tc-ml"><i class="fas fa-gauge"></i>LAT</div><div class="tc-bar"><div class="tc-bf" style="width:${clamp(m.lat*2,2,100)}%"></div></div><div class="tc-mv">${m.lat}ms</div></div></div>`;
    frag.appendChild(d);
  });
  el.innerHTML=''; el.appendChild(frag);
}

function renderAgents(states){
  const el = $('agentList');
  if(!el) return;
  const frag = document.createDocumentFragment();
  AGENTS.forEach((a,i)=>{
    const s = states[i] || DEMO_AGENTS[i] || {st:'idle',tok:0,tsk:0};
    const d = document.createElement('div');
    d.className = 'ac gl';
    d.innerHTML = `<div class="ac-h"><div class="ac-av"><i class="fas ${a.ic}"></i></div><div style="flex:1;min-width:0"><div class="ac-nm">${a.nm}</div><div class="ac-tp">${a.tp}</div></div><div class="pill ${pillCls[s.st]||'pill-i'}">${s.st}</div></div>`+
      `<div class="ac-st"><span><i class="fas fa-coins"></i>${(s.tok/1000).toFixed(1)}K tok</span><span><i class="fas fa-list-check"></i>${s.tsk} tasks</span></div>`;
    frag.appendChild(d);
  });
  el.innerHTML=''; el.appendChild(frag);
}

/*── LOGS & ACTIVITY ──*/
function addLog(entry){
  const logsEl = $('logs');
  if(!logsEl) return;
  const l = entry || pick(LOG_POOL);
  const d = document.createElement('div');
  d.className = 'lg-e';
  d.innerHTML = `<span class="lg-t">${timeStr()}</span><span class="lg-th">[${l.th}]</span><span class="lg-${l.lv||'info'}">${l.m}</span>`;
  logsEl.insertBefore(d, logsEl.firstChild);
  while(logsEl.children.length>30) logsEl.removeChild(logsEl.lastChild);
  logCount++;
  const meta = $('logMeta');
  if(meta) meta.textContent = logCount+' entries';
}

function addAct(){
  const actEl = $('activity');
  if(!actEl) return;
  const a = pick(ACT_POOL);
  const d = document.createElement('div');
  d.className = 'act-i';
  d.innerHTML = `<div class="act-d" style="background:${a.c}"></div><span class="act-tx">${a.t}</span><span class="act-tm">${shortTime()}</span>`;
  actEl.insertBefore(d, actEl.firstChild);
  while(actEl.children.length>20) actEl.removeChild(actEl.lastChild);
}

/*── STATS ──*/
function updateStats(sys, threadMetrics, agentStates){
  const avgCpu = threadMetrics.reduce((s,t)=>s+t.cpu,0)/threadMetrics.length;
  const avgLat = threadMetrics.reduce((s,t)=>s+t.lat,0)/threadMetrics.length;
  const active = agentStates.filter(a=>a.st==='active').length;
  const totalTok = agentStates.reduce((s,a)=>s+a.tok,0);

  const set = (id,v)=>{ const el=$(id); if(el) el.textContent=v; };
  set('svT', (totalTok/1000).toFixed(1)+'K');
  set('svA', active+'/'+agentStates.length);
  set('svL', avgLat.toFixed(1)+'ms');
  set('svS', Math.round(sys ? (sys.cpu_percent||avgCpu) : avgCpu)+'%');
  set('hdrLat', Math.round(avgLat)+'ms');
  set('agCount', active+'/'+agentStates.length);
  set('healthPct', clamp(100-Math.round((sys?(sys.cpu_percent||avgCpu):avgCpu)*.15),70,100)+'%');
}

function tickClock(){
  const c = $('clock');
  if(c) c.textContent = timeStr();
}

/*── LIVE TICK ──*/
async function tick(){
  // Parallel fetch
  const [sys, agents, logs] = await Promise.all([
    safeFetch(API+'/api/mc/system'),
    safeFetch(API+'/api/mc/agents'),
    safeFetch(API+'/api/mc/logs'),
  ]);

  apiAlive = !!(sys || agents);

  // Thread metrics: derive dari system + sedikit variasi
  const threadMetrics = DEMO_THREADS.map((d,i)=>{
    const base = sys ? (sys.cpu_percent||40) : d.cpu;
    return {
      cpu: Math.round(clamp(base*(0.6+Math.random()*0.6), 8, 95)),
      mem: Math.round(clamp(d.mem+rand(-8,8), 10, 90)),
      lat: Math.round(clamp(d.lat+rand(-5,5), 1, 50)),
      st: Math.random()>.85 ? pick(['active','idle','throttled']) : d.st,
    };
  });

  // Agent states: dari API bila ada
  let agentStates;
  if (Array.isArray(agents) && agents.length){
    agentStates = AGENTS.map((a,i)=>{
      const api = agents.find(x => (x.agent_id||'').toLowerCase() === a.id) || agents[i];
      const demo = DEMO_AGENTS[i];
      return {
        st: api && api.status ? String(api.status).toLowerCase() : demo.st,
        tok: demo.tok + randi(-200,300),
        tsk: demo.tsk,
      };
    });
  } else {
    agentStates = DEMO_AGENTS.map((a,i)=>({
      st: a.st,
      tok: clamp(a.tok+randi(-200,300),200,9999),
      tsk: clamp(a.tsk+pick([-1,1]),0,9),
    }));
  }

  renderThreads(threadMetrics);
  renderAgents(agentStates);
  updateStats(sys, threadMetrics, agentStates);
}

/*── WS: real-time feed (format server: init/tick) ──*/
function connectWS(){
  try {
    ws = new WebSocket('ws://localhost:5200/ws/swarm');
    ws.onmessage = (ev)=>{
      try {
        const msg = JSON.parse(ev.data);
        if (!msg || !msg.type) return;

        if (msg.type === 'init' || msg.type === 'tick'){
          // Agents live (bentuk: array ATAU dict {id: {status,...}}) → normalize
          const rawAgents = Array.isArray(msg.agents) ? msg.agents
            : (msg.agents && typeof msg.agents === 'object' ? Object.entries(msg.agents).map(([id,v])=>{
                const o = (v && typeof v === 'object') ? v : {};
                return { id, status: o.status || o.state || o.role || 'idle' };
              }) : []);
          if (rawAgents.length){
            window.__mcState.agents = rawAgents.map(a=>({
              id: a.id || a.agent_id || '?',
              status: a.status || a.state || 'idle',
            }));
            const states = AGENTS.map((ag,i)=>{
              const api = window.__mcState.agents.find(x=>x.id.toLowerCase()===ag.id);
              const demo = DEMO_AGENTS[i];
              return {
                st: api ? api.status : demo.st,
                tok: demo.tok + randi(-200,300),
                tsk: demo.tsk,
              };
            });
            renderAgents(states);
          }
          // Logs live → stream
          if (Array.isArray(msg.logs) && msg.logs.length){
            msg.logs.slice(0,5).forEach(l=>{
              addLog({
                th: (l.agent_id||'SYS').toUpperCase().slice(0,8),
                m: l.message || 'event',
                lv: String(l.level||'info').toLowerCase() === 'error' ? 'err'
                   : String(l.level||'').toLowerCase() === 'warning' ? 'warn'
                   : 'info',
              });
            });
          }
          // Skills live → log ringkas
          if (msg.skills && msg.skills.total != null){
            window.__mcState.skills = msg.skills;
          }
        } else if (msg.type === 'dispatch' && msg.dispatch){
          // Dispatch update realtime → simpan + feed
          const d = msg.dispatch;
          if (!Array.isArray(window.__mcState.dispatches)) window.__mcState.dispatches = [];
          const idx = window.__mcState.dispatches.findIndex(x=>x.id===d.id);
          if (idx >= 0) window.__mcState.dispatches[idx] = d;
          else window.__mcState.dispatches.unshift(d);
          window.__mcState.dispatches = window.__mcState.dispatches.slice(0,20);
          addLog({
            th: 'DSPTCH',
            m: `${d.from||'?'} → ${d.to} (${d.to_name||'?'}): ${(d.message||'').slice(0,40)} — ${d.status.toUpperCase()}`,
            lv: d.status==='error' ? 'err' : (d.status==='done' ? 'ok' : 'info'),
          });
          // Refresh dispatch view bila sedang aktif
          if (window.__MCViews && document.getElementById('viewHost')?.classList.contains('show')
              && document.querySelector('.vs.on')?.dataset.view === 'dispatch'){
            window.__MCViews.render('dispatch', document.getElementById('viewHost'));
          }
        }
      } catch(e){}
    };
    ws.onclose = ()=>{ ws = null; setTimeout(connectWS, 5000); };
  } catch(e){ ws = null; }
}

/*── INIT ──*/
// Export shared live-state untuk views.js (swarm/memory/logs) — SEBELUM connectWS
window.__mcState = { agents: [], logs: [], system: null, skills: null };

// Export feed-pause flag untuk multimodal (gesture)
window.__feedPaused = false;

renderThreads(DEMO_THREADS);
renderAgents(DEMO_AGENTS);
updateStats(null, DEMO_THREADS, DEMO_AGENTS);
for(let i=0;i<4;i++){ setTimeout(addLog, i*120); setTimeout(addAct, i*200); }
setInterval(tick, 3000);
setInterval(addAct, 4500);
setInterval(tickClock, 1000);
tickClock();
connectWS();

// Export feed-pause flag untuk multimodal (gesture)
window.__feedPaused = false;

// Space → fokus input (dari multimodal juga, dijaga double-safe)
document.addEventListener('keydown', e=>{
  if(e.code==='Space' && document.activeElement.tagName!=='INPUT' && !window.__feedPaused){
    e.preventDefault();
    const inp = $('vInput');
    if(inp) inp.focus();
  }
});

})();
