#!/usr/bin/env python3
"""Build the UNIFIED Mission Control dashboard:
ORB base + launcher + taskbar + 12 page sections as floating windows.
Extracts content from the backup (pre-refactor) index.html so NOTHING is lost.
"""
import re
import pathlib

BACKUP = pathlib.Path('/Users/zaryu/Desktop/Niumination/services/niu-mission-control/dashboard_backup_refactor_20260816/index.html')
OUT = pathlib.Path('/Users/zaryu/Desktop/Niumination/services/niu-mission-control/dashboard/index.html')

src = BACKUP.read_text()

# ── 1. Extract <header>…</header> (telemetry badges, commander role) ──
m = re.search(r'(<header[^>]*>.*?</header>)', src, re.S)
header = m.group(1)
print(f"[ok] header: {len(header)} chars")

# ── 2. Extract each <section class="page" id="page-XXX">…</section> robustly ──
starts = [(mm.start(), mm.group(1), mm.group(0)) for mm in re.finditer(r'<section\s+class="page[^"]*"\s+id="page-([a-z-]+)"[^>]*>', src)]
print(f"[ok] sections found: {len(starts)}")

sections = {}
for i, (pos, pid, open_tag) in enumerate(starts):
    # find matching close with tag-depth counting
    depth = 1
    j = pos + len(open_tag)
    # scan for <section and </section>
    pat = re.compile(r'<section\b|</section>')
    for mm in pat.finditer(src, j):
        if mm.group(0) == '<section':
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                end = mm.end()
                break
    raw = src[pos:end]
    sections[pid] = raw
    print(f"[ok] section {pid}: {len(raw)} chars")

print(f"[ok] total sections: {len(sections)}")

# Inject header (telemetry badges) ke atas section dashboard — elemen gwStatusText dll
# di-update oleh WebSocket di app.js, jadi WAJIB ada di DOM.
if 'dashboard' in sections:
    sections['dashboard'] = sections['dashboard'].replace(
        '<section class="page active" id="page-dashboard">',
        '<section class="page active" id="page-dashboard">\n' + header, 1
    ) if '<section class="page active" id="page-dashboard">' in sections['dashboard'] else header + sections['dashboard']
    print("[ok] header injected into page-dashboard")

# Inject health-gauge (healthPct/healthFill) + tombol checkpoint dari sidebar-footer
# — direferensikan app.js tanpa null-check, WAJIB ada di DOM.
m = re.search(r'(<div class="health-gauge">.*?</div>\s*<button class="btn-checkpoint".*?</button>)', src, re.S)
if m and 'dashboard' in sections:
    gauge = '<div class="sidebar-footer" style="padding:0.6rem 0.2rem;">\n' + m.group(1) + '\n</div>'
    sections['dashboard'] = sections['dashboard'].replace(
        '<section class="page active" id="page-dashboard">',
        '<section class="page active" id="page-dashboard">\n' + gauge, 1
    ) if '<section class="page active" id="page-dashboard">' in sections['dashboard'] else gauge + sections['dashboard']
    print("[ok] health-gauge + checkpoint injected into page-dashboard")
else:
    print("[warn] health-gauge block not found")

# ── 3. Extract the final inline <script>…</script> (loaders + init) ──
scripts = re.findall(r'<script>(.*?)</script>', src, re.S)
inline = scripts[-1]
print(f"[ok] inline script: {len(inline)} chars")

# ── 4. Replace hash-routing block (nav-item based) with window-open logic ──
old_hash = re.search(r'// Hash routing:.*?location\.hash\.slice\(1\);\n    if \(h\) \{.*?\n    \}', inline, re.S)
hash_replacement = """// Hash routing: /#page-XXX → buka window tersebut
    const h = location.hash.slice(1);
    if (h && window.PAGES && PAGES[h]) {
      setTimeout(() => openWindow(h), 300);
    }"""
if old_hash:
    inline = inline[:old_hash.start()] + hash_replacement + inline[old_hash.end():]
    print("[ok] hash routing replaced")
else:
    print("[warn] hash routing block not found — manual check needed")

# ── 5. Launcher / taskbar definitions ──
APPS = [
    ('dashboard',     'Dashboard',       'Overview',        'fa-table-columns', '#7c3aed', '#4f46e5'),
    ('ecosystem',     'Ecosystem',       '39+ Projects',    'fa-globe',         '#059669', '#22c55e'),
    ('swarm',         'Swarm',           'Topology',        'fa-network-wired', '#7c3aed', '#8b5cf6'),
    ('taskqueue',     'Task Queue',      'Kanban',          'fa-list-check',    '#d97706', '#f59e0b'),
    ('terminal',      'Terminal',        'Shell Hub',       'fa-terminal',      '#0891b2', '#06b6d4'),
    ('telegram',      'Telegram',        'Bridge',          'fa-paper-plane',   '#2563eb', '#3b82f6'),
    ('storage',       'Storage',         'USB & WAL',       'fa-database',      '#059669', '#10b981'),
    ('skills',        'Skill Bank',      '40 Skills',       'fa-brain',         '#db2777', '#ec4899'),
    ('skills-market', 'Skill Market',    'Sync Hub',        'fa-store',         '#e11d48', '#f43f5e'),
    ('system',        'System',          'Config',          'fa-gear',          '#475569', '#94a3b8'),
    ('cost',          'Cost',            'Monitor',         'fa-coins',         '#d97706', '#fbbf24'),
    ('deploy',        'Deploy',          'Pipelines',       'fa-rocket',        '#ea580c', '#f97316'),
]

launcher_btns = '\n'.join(
    f'  <button class="launch-btn" data-app="{pid}" title="Buka {name}" aria-pressed="false">'
    f'<span class="lb-ico" style="background:linear-gradient(135deg,{c1},{c2})"><i class="fas {ico}" aria-hidden="true"></i></span>'
    f'<span class="lb-txt">{name.upper()}<small>{sub}</small></span></button>'
    for pid, name, sub, ico, c1, c2 in APPS
)

taskbar_btns = '\n'.join(
    f'  <div class="tb-btn" data-app="{pid}" role="button" tabindex="0" aria-label="Toggle {name}"><i class="fas {ico}" style="color:{c2}" aria-hidden="true"></i>{name.upper()}</div>'
    for pid, name, sub, ico, c1, c2 in APPS
)

pages_js = ',\n'.join(
    f"  {pid if pid.isidentifier() else repr(pid)}: {{ title: '{name}', ico: '{ico}', accent: '{c2}', w: {w}, h: {h} }}"
    for (pid, name, sub, ico, c1, c2), (w, h) in zip(APPS, [
        (940, 640), (900, 620), (820, 600), (920, 640), (860, 580), (860, 580),
        (840, 580), (880, 620), (880, 620), (860, 600), (840, 580), (840, 580),
    ])
)

# ── 6. Assemble ──
body = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HERMES // MISSION CONTROL — UNIFIED</title>
  <meta name="description" content="Hermes Mission Control — dashboard operasional ekosistem Niumination: ORB 3D, telemetry agent, kanban, terminal, dan 12 panel realtime.">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050811">
  <meta name="color-scheme" content="dark">
  <meta name="author" content="Niumination Ecosystem">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Hermes Mission Control — Unified Dashboard">
  <meta property="og:description" content="Dashboard operasional ekosistem Niumination — ORB 3D, telemetry agent, kanban, terminal, 12 panel realtime.">
  <meta property="og:locale" content="id_ID">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@300;400;500;600;700;800&family=Orbitron:wght@500;700;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@300;400;500;600;700;800&family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet"></noscript>

  <!-- FontAwesome -->
  <link rel="stylesheet" href="/static/static/fontawesome/css/all.min.css" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="/static/static/fontawesome/css/all.min.css"></noscript>

  <!-- Dashboard theme + floating-window chrome -->
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>

  <h1 class="visually-hidden">Hermes Mission Control — Unified Dashboard</h1>

  <!-- ══════ ORB BASE — fullscreen animation (selalu tampil) ══════ -->
  <div class="orb-base">
    <iframe src="/static/orb.html" title="ORB Command Center" id="orbFrame" loading="eager"></iframe>
  </div>
  <div class="orb-dim" id="orbDim" aria-hidden="true"></div>

  <!-- ══════ LAUNCHER — pojok kanan atas, tidak menutupi orb ══════ -->
  <nav class="launcher" id="launcher" aria-label="Aplikasi Mission Control">
{launcher_btns}
  </nav>

  <!-- ══════ FLOATING WINDOWS MOUNT ══════ -->
  <main id="winMount" aria-label="Jendela dashboard"></main>

  <!-- ══════ PAGE VAULT — semua halaman tersimpan di sini (hidden) ══════ -->
  <div id="pageVault" aria-hidden="true">
{sections.get('dashboard', '')}
{sections.get('ecosystem', '')}
{sections.get('swarm', '')}
{sections.get('taskqueue', '')}
{sections.get('terminal', '')}
{sections.get('telegram', '')}
{sections.get('storage', '')}
{sections.get('system', '')}
{sections.get('skills', '')}
{sections.get('deploy', '')}
{sections.get('cost', '')}
{sections.get('skills-market', '')}
  </div>

  <!-- ══════ TASKBAR — bawah tengah ══════ -->
  <div class="taskbar" id="taskbar" role="toolbar" aria-label="Taskbar Mission Control">
    <div class="tb-brand"><i class="fas fa-bolt" aria-hidden="true"></i>MISSION CONTROL</div>
    <div class="tb-sep" aria-hidden="true"></div>
{taskbar_btns}
    <div class="tb-sep" aria-hidden="true"></div>
    <div class="tb-live"><span class="dot" aria-hidden="true"></span>ORB LIVE</div>
    <div class="tb-sep" aria-hidden="true"></div>
    <div class="tb-clock"><i class="far fa-clock" aria-hidden="true"></i><span id="clock" aria-label="Jam saat ini">00:00:00</span></div>
  </div>

  <script src="/static/app.js"></script>
  <script>
/*═══════════════════════════════════════
  UNIFIED WINDOW MANAGER — ORB base + floating windows
═══════════════════════════════════════*/
(function(){{
'use strict';

const PAGES = {{
{pages_js}
}};

const mount = document.getElementById('winMount');
const vault = document.getElementById('pageVault');
const orbDim = document.getElementById('orbDim');
const taskbar = document.getElementById('taskbar');
let zTop = 100;
const openApps = new Set();
const LAZY = {{
  ecosystem: () => {{ try {{ loadEcosystem(); }} catch(e){{}} }},
  swarm: () => {{ try {{ loadTopologyPrompts(); }} catch(e){{}} }},
  taskqueue: () => {{ try {{ loadKanban(); }} catch(e){{}} }},
  terminal: () => {{ try {{ clearConsole(); }} catch(e){{}} }},
  telegram: () => {{ try {{ loadTelegramFeed(); }} catch(e){{}} }},
  storage: () => {{ try {{ loadTelemetry(); }} catch(e){{}} }},
  skills: () => {{ try {{ loadSkills(); }} catch(e){{}} }},
  system: () => {{ try {{ loadSystemSettings(); }} catch(e){{}} }},
}};

window.PAGES = PAGES;
window.openWindow = openWindow;
window.closeWindow = closeWindow;
window.minimizeWindow = minimizeWindow;
window.restoreWindow = restoreWindow;
window.toggleMax = toggleMax;

/*── Clock ──*/
setInterval(()=>{{
  const c = document.getElementById('clock');
  if (c) c.textContent = new Date().toLocaleTimeString('en-US',{{hour12:false}});
}}, 1000);

/*── Posisi window (kaskade berantai — titlebar selalu terlihat) ──*/
let lastPos = null;
function cascadePos(){{
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = Math.min(880, vw-48), h = Math.min(600, vh-100);
  if (!lastPos) lastPos = {{ x: Math.max(20, (vw-w)/2 - 140), y: Math.max(20, (vh-h)/2 - 100) }};
  const nx = lastPos.x + 52, ny = lastPos.y + 42;
  if (nx + Math.min(680, w) > vw - 12 || ny + 80 > vh - 64) {{
    lastPos = {{ x: 20, y: 20 }};
  }} else {{
    lastPos = {{ x: nx, y: ny }};
  }}
  return {{ x: lastPos.x, y: lastPos.y, w, h }};
}}

/*── Buka window ──*/
function openWindow(appId){{
  if (openApps.has(appId)){{ focusWindow(appId); return; }}
  const cfg = PAGES[appId];
  if (!cfg) return;
  const section = document.getElementById('page-' + appId);
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
       <div class="fwin-title"><i class="fas ${{cfg.ico}}" style="color:${{cfg.accent}}" aria-hidden="true"></i>${{cfg.title}}</div>
       <div class="fwin-actions">
         <button class="fwin-act" data-act="min" title="Minimize" aria-label="Minimize ${{cfg.title}}"><i class="fas fa-minus" aria-hidden="true"></i></button>
         <button class="fwin-act" data-act="max" title="Maximize" aria-label="Maximize ${{cfg.title}}"><i class="fas fa-expand" aria-hidden="true"></i></button>
         <button class="fwin-act" data-act="close" title="Close" aria-label="Close ${{cfg.title}}"><i class="fas fa-xmark" aria-hidden="true"></i></button>
       </div>
     </div>
     <div class="fwin-body" id="fwin-body-${{appId}}"></div>
     <div class="fwin-resize" aria-hidden="true"></div>`;

  // Pindahkan section dari vault ke window body
  const body = win.querySelector('.fwin-body');
  body.appendChild(section);
  section.classList.add('active');

  mount.appendChild(win);
  focusWindow(appId);

  // Jika dibuka via keyboard → pindah fokus ke window (WCAG 2.4.3)
  const srcBtn = document.querySelector(`.launch-btn[data-app="${{appId}}"]`);
  if (srcBtn && document.activeElement === srcBtn) win.focus();

  requestAnimationFrame(()=>requestAnimationFrame(()=>win.classList.add('open')));

  // Kontrol titlebar
  win.querySelectorAll('[data-act]').forEach(btn=>{{
    btn.addEventListener('click', e=>{{
      e.stopPropagation();
      const act = btn.dataset.act;
      if (act==='close') closeWindow(appId);
      else if (act==='min') minimizeWindow(appId);
      else if (act==='max') toggleMax(appId);
    }});
  }});

  // Drag
  const bar = win.querySelector('.fwin-bar');
  let dragging = false, dx0=0, dy0=0, ox=0, oy=0;
  bar.addEventListener('mousedown', e=>{{
    if (e.target.closest('[data-act]')) return;
    dragging = true;
    const r = win.getBoundingClientRect();
    ox = r.left; oy = r.top;
    dx0 = e.clientX; dy0 = e.clientY;
    bar.style.cursor = 'grabbing';
    e.preventDefault();
  }});
  document.addEventListener('mousemove', e=>{{
    if (!dragging) return;
    const nx = ox + (e.clientX-dx0);
    const ny = oy + (e.clientY-dy0);
    win.style.left = Math.max(-win.offsetWidth+80, Math.min(nx, window.innerWidth-80))+'px';
    win.style.top = Math.max(0, Math.min(ny, window.innerHeight-60))+'px';
  }});
  document.addEventListener('mouseup', ()=>{{ dragging = false; bar.style.cursor = 'grab'; }});

  // Resize
  const rz = win.querySelector('.fwin-resize');
  let resizing = false, rx0=0, ry0=0, rw0=0, rh0=0;
  rz.addEventListener('mousedown', e=>{{
    resizing = true;
    rx0 = e.clientX; ry0 = e.clientY;
    rw0 = win.offsetWidth; rh0 = win.offsetHeight;
    e.preventDefault(); e.stopPropagation();
  }});
  document.addEventListener('mousemove', e=>{{
    if (!resizing) return;
    win.style.width = Math.max(360, rw0 + (e.clientX-rx0))+'px';
    win.style.height = Math.max(260, rh0 + (e.clientY-ry0))+'px';
  }});
  document.addEventListener('mouseup', ()=>{{ resizing = false; }});

  // Klik → fokus
  win.addEventListener('mousedown', ()=>focusWindow(appId), true);

  // Taskbar + launcher state
  taskbar.querySelector(`.tb-btn[data-app="${{appId}}"]`)?.classList.add('open');
  const lbtn = document.querySelector(`.launch-btn[data-app="${{appId}}"]`);
  if (lbtn) {{ lbtn.classList.add('on'); lbtn.setAttribute('aria-pressed', 'true'); }}

  // Lazy init halaman
  if (LAZY[appId]) LAZY[appId]();
}}

function focusWindow(appId){{
  const win = mount.querySelector(`.fwin[data-app="${{appId}}"]`);
  if (!win) return;
  if (win.classList.contains('minimized')){{ restoreWindow(appId); return; }}
  zTop++;
  win.style.zIndex = zTop;
  win.classList.add('focused');
  mount.querySelectorAll('.fwin').forEach(w=>{{ if(w!==win) w.classList.remove('focused'); }});
}}

function closeWindow(appId){{
  const win = mount.querySelector(`.fwin[data-app="${{appId}}"]`);
  if (!win) return;
  win.classList.remove('open');
  win.classList.add('closing');
  const section = win.querySelector('.fwin-body .page');
  setTimeout(()=>{{
    if (section) vault.appendChild(section);
    section && section.classList.remove('active');
    win.remove();
  }}, 240);
  openApps.delete(appId);
  taskbar.querySelector(`.tb-btn[data-app="${{appId}}"]`)?.classList.remove('open');
  const lbtn = document.querySelector(`.launch-btn[data-app="${{appId}}"]`);
  if (lbtn) {{ lbtn.classList.remove('on'); lbtn.setAttribute('aria-pressed', 'false'); }}
  updateDim();
}}

function minimizeWindow(appId){{
  const win = mount.querySelector(`.fwin[data-app="${{appId}}"]`);
  if (!win) return;
  win.classList.add('minimized');
  win.style.display = 'none';
  taskbar.querySelector(`.tb-btn[data-app="${{appId}}"]`)?.classList.add('minimized');
  updateDim();
}}

function restoreWindow(appId){{
  const win = mount.querySelector(`.fwin[data-app="${{appId}}"]`);
  if (!win) return;
  win.classList.remove('minimized');
  win.style.display = 'flex';
  taskbar.querySelector(`.tb-btn[data-app="${{appId}}"]`)?.classList.remove('minimized');
  focusWindow(appId);
  updateDim();
}}

function toggleMax(appId){{
  const win = mount.querySelector(`.fwin[data-app="${{appId}}"]`);
  if (!win) return;
  if (win.dataset.max === '1'){{
    win.dataset.max = '0';
    win.style.left = win.dataset.ox+'px';
    win.style.top = win.dataset.oy+'px';
    win.style.width = win.dataset.ow+'px';
    win.style.height = win.dataset.oh+'px';
  }} else {{
    win.dataset.max = '1';
    win.dataset.ox = win.style.left;
    win.dataset.oy = win.style.top;
    win.dataset.ow = win.style.width;
    win.dataset.oh = win.style.height;
    win.style.left = '12px';
    win.style.top = '12px';
    win.style.width = (window.innerWidth-24)+'px';
    win.style.height = (window.innerHeight-24)+'px';
  }}
}}

function updateDim(){{
  orbDim.classList.toggle('show', openApps.size > 0);
}}

/*── Launcher click ──*/
document.querySelectorAll('.launch-btn').forEach(btn=>{{
  btn.addEventListener('click', ()=>openWindow(btn.dataset.app));
}});

/*── Taskbar click (minimize/restore toggle) + keyboard (WCAG 2.1.1) ──*/
function tbToggle(app){{
  const win = mount.querySelector(`.fwin[data-app="${{app}}"]`);
  if (!win){{ openWindow(app); return; }}
  if (win.classList.contains('minimized')) restoreWindow(app);
  else minimizeWindow(app);
}}
document.querySelectorAll('.tb-btn').forEach(btn=>{{
  btn.addEventListener('click', ()=>tbToggle(btn.dataset.app));
  btn.addEventListener('keydown', e=>{{
    if (e.key === 'Enter' || e.key === ' '){{ e.preventDefault(); tbToggle(btn.dataset.app); }}
  }});
}});

/*── Sembunyikan window saat klik di luar (opsional: orb tetap interaktif) ──*/
document.addEventListener('keydown', e=>{{
  if (e.key === 'Escape'){{
    const top = mount.querySelector('.fwin.focused');
    if (top) closeWindow(top.dataset.app);
  }}
}});

}}());

{inline}
  </script>
</body>
</html>
"""

OUT.write_text(body)
print(f"\n[done] wrote {OUT} ({len(body)} chars)")
