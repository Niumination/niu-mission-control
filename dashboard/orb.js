/* HERMES // ORB — Three.js scene + data HUD (ULTRON-inspired, v1) */
(function () {
  const canvas = document.getElementById('orb-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 7;

  // ── Lighting ──────────────────────────────
  scene.add(new THREE.AmbientLight(0x334466, 0.6));
  const pointLight = new THREE.PointLight(0x6fd8ff, 1.2, 30);
  pointLight.position.set(5, 3, 5);
  scene.add(pointLight);
  const backLight = new THREE.PointLight(0x9b6dff, 0.5, 30);
  backLight.position.set(-5, -3, -5);
  scene.add(backLight);

  // ── Orb: layered wireframe shells ─────────
  const group = new THREE.Group();
  scene.add(group);

  const shellMat = new THREE.MeshBasicMaterial({ color: 0x6fd8ff, wireframe: true, transparent: true, opacity: 0.25 });
  const shell1 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 24), shellMat);
  group.add(shell1);

  const shellMat2 = new THREE.MeshBasicMaterial({ color: 0x9b6dff, wireframe: true, transparent: true, opacity: 0.15 });
  const shell2 = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 20), shellMat2);
  shell2.rotation.x = Math.PI / 6;
  group.add(shell2);

  // inner glow core
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.12 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 32), coreMat);
  group.add(core);

  // spiral ring
  const ringGeom = new THREE.TorusGeometry(3.2, 0.03, 8, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0.35 });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.rotation.x = Math.PI / 2.4;
  group.add(ring);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.015, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0x9b6dff, transparent: true, opacity: 0.2 }));
  ring2.rotation.x = Math.PI / 1.8;
  ring2.rotation.y = Math.PI / 5;
  group.add(ring2);

  // ── Particles ────────────────────────────
  const particles = new THREE.BufferGeometry();
  const COUNT = 800;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = 3.5 + Math.random() * 4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  particles.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: 0x6fd8ff, size: 0.03, transparent: true, opacity: 0.7 });
  const pPoints = new THREE.Points(particles, pm);
  scene.add(pPoints);

  // ── Interaction: drag + zoom ─────────────
  let isDragging = false, prevX = 0, prevY = 0;
  let rotX = 0, rotY = 0, zoom = 7;

  canvas.addEventListener('mousedown', (e) => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    rotY += (e.clientX - prevX) * 0.005;
    rotX += (e.clientY - prevY) * 0.005;
    prevX = e.clientX; prevY = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => {
    zoom = Math.max(4, Math.min(12, zoom + e.deltaY * 0.005));
    e.preventDefault();
  }, { passive: false });
  // touch
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { isDragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; } }, { passive: true });
  canvas.addEventListener('touchend', () => { isDragging = false; }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const t = e.touches[0];
    rotY += (t.clientX - prevX) * 0.005;
    rotX += (t.clientY - prevY) * 0.005;
    prevX = t.clientX; prevY = t.clientY;
  }, { passive: true });

  // ── Data fetch ───────────────────────────
  async function loadSystem() {
    try {
      const res = await fetch('/api/mc/system');
      const d = await res.json();
      const panel = document.getElementById('system-stats');
      const rows = [
        ['Status', d.status || d.data?.status || 'OK', 'ok'],
        ['Uptime', (d.uptime ?? d.data?.uptime ?? '-') + 's', ''],
        ['Hermes', d.hermes || d.data?.hermes || '-', ''],
      ];
      panel.innerHTML = rows.map(([l, v, cls]) =>
        `<div class="stat-row"><span class="label">${l}</span><span class="value ${cls}">${v}</span></div>`).join('');
    } catch (e) {
      document.getElementById('system-stats').innerHTML =
        `<div class="stat-row"><span class="label">API offline</span></div>`;
    }
  }

  async function loadAgents() {
    try {
      const res = await fetch('/api/mc/agents');
      const d = await res.json();
      const agents = d.agents || d.data?.agents || d.data || [];
      const panel = document.getElementById('agents-panel');
      if (!agents.length) {
        panel.innerHTML = `<div class="stat-row"><span class="label">Tidak ada agen</span></div>`;
        return;
      }
      panel.innerHTML = agents.map((a) => {
        const st = (a.status || 'idle').toLowerCase();
        const dot = st === 'online' || st === 'running' || st === 'active' ? 'online' : (st === 'offline' || st === 'error' ? 'offline' : 'idle');
        return `<div class="agent-item">
          <span class="agent-dot ${dot}"></span>
          <span class="agent-name">${a.name || a.id || '?'}</span>
          <span class="agent-model">${a.model || a.thread || ''}</span>
        </div>`;
      }).join('');
    } catch (e) {
      document.getElementById('agents-panel').innerHTML =
        `<div class="stat-row"><span class="label">API offline</span></div>`;
    }
  }

  loadSystem();
  loadAgents();
  setInterval(() => { loadSystem(); loadAgents(); }, 15000);

  // ── Routines (control surface) ──────────────
  const routineBtns = {
    'morning-brief': { icon: '🌅', label: 'Morning Brief' },
    'daily-report': { icon: '📊', label: 'Rekap Harian' },
    'project-sync': { icon: '📁', label: 'Sync Proyek' },
  };

  async function loadRoutines() {
    try {
      const res = await fetch('/api/mc/routines');
      const d = await res.json();
      const btns = document.getElementById('routine-buttons');
      btns.innerHTML = (d.routines || []).map((r) =>
        `<button class="routine-btn" onclick="window.__runRoutine('${r}')">
          <span><span class="r-icon">${routineBtns[r]?.icon || '⚡'}</span>${routineBtns[r]?.label || r}</span>
          <span class="r-status">run</span>
        </button>`).join('');
      // projects
      const projs = document.getElementById('proj-list');
      projs.innerHTML = (d.projects || []).slice(0, 4).map((p) =>
        `<div class="proj-item"><span class="p-dot"></span>${p.name} <span style="margin-left:auto;color:#5a6a8a;font-size:0.55rem">${p.status.slice(0, 25) || ''}</span></div>`).join('');
      // capture count → system panel tambahan
      if (d.capture_today !== undefined) {
        const sp = document.getElementById('system-stats');
        if (!sp.innerHTML.includes('Capture')) {
          sp.innerHTML += `<div class="stat-row"><span class="label">Capture</span><span class="value ok">${d.capture_today}</span></div>`;
        }
      }
    } catch (e) {
      document.getElementById('routine-buttons').innerHTML = '<div class="stat-row"><span class="label">API offline</span></div>';
    }
  }

  window.__runRoutine = async function (name) {
    const out = document.getElementById('routine-output');
    out.textContent = `▶ Menjalankan ${name}...`;
    try {
      const res = await fetch('/api/mc/routine/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      out.textContent = (d.output || d.status || 'selesai').slice(0, 500);
    } catch (e) {
      out.textContent = 'Error: ' + e.message;
    }
  };

  loadRoutines();
  setInterval(loadRoutines, 30000);

  // ── WebSocket live (ULTRON v3) ─────────────
  const wsInd = document.getElementById('ws-ind');
  let ws = null;
  let wsRetry = 0;

  function connectWS() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws/orb`);

    ws.onopen = () => {
      wsInd.textContent = '● LIVE';
      wsInd.classList.remove('off');
      wsRetry = 0;
    };
    ws.onclose = () => {
      wsInd.textContent = '○ OFFLINE';
      wsInd.classList.add('off');
      wsRetry++;
      setTimeout(connectWS, Math.min(30000, 2000 * wsRetry));
    };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
    ws.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        if (d.type !== 'tick') return;
        // live CPU/RAM meter
        updateMeter('cpu', d.system.cpu);
        updateMeter('ram', d.system.ram_pct);
        // agents live status
        if (d.agents && d.agents.agents) {
          renderAgentsLive(d.agents.agents);
        }
      } catch (e) { /* ignore */ }
    };
  }

  function updateMeter(id, val) {
    let row = document.getElementById(`meter-${id}`);
    if (!row) {
      const sysPanel = document.getElementById('system-stats');
      const meter = document.createElement('div');
      meter.className = 'meter';
      meter.innerHTML = `
        <div class="meter-row"><span>CPU</span><div class="meter-bar"><div class="meter-fill" id="meter-cpu-fill" style="width:0%"></div></div><span id="meter-cpu">0%</span></div>
        <div class="meter-row"><span>RAM</span><div class="meter-bar"><div class="meter-fill" id="meter-ram-fill" style="width:0%"></div></div><span id="meter-ram">0%</span></div>`;
      sysPanel.appendChild(meter);
      row = meter;
    }
    const fill = document.getElementById(`meter-${id}-fill`);
    const label = document.getElementById(`meter-${id}`);
    if (fill) { fill.style.width = val + '%'; fill.classList.toggle('warn', val > 80); }
    if (label) label.textContent = Math.round(val) + '%';
  }

  function renderAgentsLive(agents) {
    const panel = document.getElementById('agents-panel');
    if (!agents.length) return;
    panel.innerHTML = agents.map((a) => {
      const st = (a.status || 'idle').toLowerCase();
      const dot = st === 'online' || st === 'running' || st === 'active' ? 'online' : (st === 'offline' || st === 'error' ? 'offline' : 'idle');
      return `<div class="agent-item">
        <span class="agent-dot ${dot}"></span>
        <span class="agent-name">${a.name || a.id || '?'}</span>
        <span class="agent-model">${a.model || a.thread || ''}</span>
      </div>`;
    }).join('');
  }

  connectWS();

  // ── Gesture control (MediaPipe hands) — v3 ──
  let gestureOn = false;
  let hands = null, camHandle = null, videoEl = null;
  let lastPinch = null; // {x, y}

  window.__toggleGesture = async function () {
    gestureOn = !gestureOn;
    const btn = document.getElementById('gesture-btn');
    const cam = document.getElementById('cam');
    if (gestureOn) {
      if (typeof Hands === 'undefined') {
        btn.textContent = '✋ UNAVAILABLE';
        gestureOn = false;
        return;
      }
      try {
        videoEl = cam;
        videoEl.style.display = 'block';
        videoEl.width = 160; videoEl.height = 120;
        camHandle = new Camera(videoEl, {
          onFrame: async () => { if (hands) await hands.send({ image: videoEl }); },
          width: 160, height: 120
        });
        await camHandle.start();
        hands = new Hands({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
        });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.6 });
        hands.onResults(onHandResults);
        btn.textContent = '✋ GESTURE ON';
      } catch (e) {
        btn.textContent = '✋ CAM ERR';
        gestureOn = false;
        videoEl.style.display = 'none';
      }
    } else {
      if (camHandle) { try { await camHandle.stop(); } catch (e) {} }
      if (videoEl) videoEl.style.display = 'none';
      btn.textContent = '✋ GESTURE OFF';
      lastPinch = null;
    }
  };

  function onHandResults(results) {
    if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
      lastPinch = null;
      return;
    }
    const lm = results.multiHandLandmarks[0];
    // pinch: thumb (4) + index (8) distance
    const thumb = lm[4], index = lm[8];
    const dx = thumb.x - index.x, dy = thumb.y - index.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.08) {
      // pinch held → drag orb by hand x/y
      if (lastPinch) {
        rotY += (lm[8].x - lastPinch.x) * 2.5;
        rotX += (lm[8].y - lastPinch.y) * 2.5;
      }
      lastPinch = { x: lm[8].x, y: lm[8].y };
    } else {
      lastPinch = null;
    }
  }

  // ── Animation loop ───────────────────────
  function animate() {
    requestAnimationFrame(animate);
    group.rotation.x += (rotX - group.rotation.x) * 0.08;
    group.rotation.y += (rotY - group.rotation.y) * 0.08;
    // idle spin
    group.rotation.y += 0.001;
    shell1.rotation.y += 0.002;
    shell2.rotation.y -= 0.0015;
    ring.rotation.z += 0.003;
    ring2.rotation.z -= 0.002;
    pPoints.rotation.y += 0.0005;
    camera.position.z += (zoom - camera.position.z) * 0.08;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();
