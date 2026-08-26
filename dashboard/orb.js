/*
 * NIU // MISSION CORE
 * Three.js command core + live FastAPI telemetry.
 * The gold-frame/cyan-core state language is adapted from APEX-UI (MIT).
 */
(function () {
  'use strict';

  const canvas = document.getElementById('orb-canvas');
  const world = document.getElementById('mission-core-world');
  const stateLabel = document.getElementById('core-state-label');
  const stateDetail = document.getElementById('core-state-detail');
  const wsIndicator = document.getElementById('ws-ind');
  const graph = window.NiuReasoningWeb;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let visualState = 'standby';
  let demoProcessing = false;
  let demoTimer = 0;
  let liveAgents = new Map();
  let restAgentsAvailable = false;
  let wsConnected = false;
  let sceneController = null;

  buildEqualizer();
  graph?.init();
  sceneController = createMissionCoreScene();
  setupCoreActivation();
  setupTelemetry();
  setupRoutines();
  setupGestureControl();

  function apiHeaders(extra) {
    const headers = { ...(extra || {}) };
    try {
      const key = localStorage.getItem('mc_api_key');
      if (key) headers['X-API-Key'] = key;
    } catch (_) { /* localStorage can be unavailable in hardened iframes */ }
    return headers;
  }

  async function apiFetch(path, options) {
    const response = await fetch(path, {
      ...(options || {}),
      headers: apiHeaders(options?.headers),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function buildEqualizer() {
    const equalizer = document.getElementById('core-equalizer');
    if (!equalizer) return;
    const bars = 19;
    for (let i = 0; i < bars; i += 1) {
      const distance = Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
      const bar = document.createElement('i');
      bar.style.setProperty('--bar-height', `${5 + (1 - distance) * 19}px`);
      bar.style.setProperty('--bar-speed', `${.62 + (i % 5) * .14}s`);
      bar.style.setProperty('--bar-delay', `${(i % 7) * .07}s`);
      equalizer.appendChild(bar);
    }
  }

  function setVisualState(next, detail) {
    const allowed = ['standby', 'processing', 'degraded'];
    visualState = allowed.includes(next) ? next : 'standby';
    world?.setAttribute('data-state', visualState);
    graph?.setState(visualState);
    sceneController?.setState(visualState);

    if (stateLabel) {
      stateLabel.textContent = visualState === 'processing' ? 'PROCESSING' : visualState === 'degraded' ? 'DEGRADED' : 'STANDBY';
    }
    if (stateDetail) {
      stateDetail.textContent = detail || (visualState === 'degraded'
        ? 'TELEMETRY TERPUTUS · MENCOBA HUBUNGKAN ULANG'
        : '5 AGENT TERHUBUNG · PILIH NODE UNTUK DETAIL');
    }
  }

  function setupCoreActivation() {
    const activation = document.getElementById('core-activation');
    if (!activation) return;
    activation.addEventListener('click', () => {
      demoProcessing = true;
      window.clearTimeout(demoTimer);
      graph?.fire('chief');
      setVisualState('processing', 'MANUAL ENERGY PULSE · REASONING PATH ACTIVE');
      demoTimer = window.setTimeout(() => {
        demoProcessing = false;
        syncCoreState();
      }, 6000);
    });
  }

  function syncCoreState() {
    if (demoProcessing) return;
    const agents = [...liveAgents.values()];
    const busy = agents.filter(isAgentBusy);
    if (busy.length) {
      const names = busy.map((agent) => shortAgentName(agent)).join(' + ');
      setVisualState('processing', `${names.toUpperCase()} · MISSION IN PROGRESS`);
      return;
    }
    if (!wsConnected && !restAgentsAvailable) {
      setVisualState('degraded');
      return;
    }
    setVisualState('standby', `${agents.length || 5} AGENT TERHUBUNG · PILIH NODE UNTUK DETAIL`);
  }

  // Shared mapping: recognises production statuses (thinking/executing) too.
  function isAgentBusy(agent) {
    return (window.NiuAgentState || { isAgentBusy: function () { return false; } }).isAgentBusy(agent);
  }

  function shortAgentName(agent) {
    return String(agent.name || agent.id || 'agent').replace(/\s+Agent$/i, '');
  }

  function mergeAgents(incoming, source) {
    if (!Array.isArray(incoming)) return [];
    incoming.forEach((agent) => {
      if (!agent || !agent.id) return;
      const id = String(agent.id).toLowerCase();
      const previous = liveAgents.get(id) || { id };
      const merged = { ...previous };
      Object.entries(agent).forEach(([key, value]) => {
        if (value !== undefined && value !== null) merged[key] = value;
      });

      // The lightweight WS feed reports Chief as "active" to mean available,
      // while REST exposes running counters. Never let that erase real counters.
      if (source === 'ws' && !Object.prototype.hasOwnProperty.call(agent, 'running')) {
        merged.running = Number(previous.running) || 0;
      }
      liveAgents.set(id, merged);
    });
    const agents = [...liveAgents.values()];
    renderAgents(agents);
    graph?.updateAgents(agents);
    syncCoreState();
    return agents;
  }

  function setupTelemetry() {
    loadSystem();
    loadAgents();
    window.setInterval(loadSystem, 15000);
    window.setInterval(loadAgents, 15000);
    connectWebSocket();
  }

  async function loadSystem() {
    const panel = document.getElementById('system-stats');
    try {
      const data = await apiFetch('/api/mc/system');
      if (!panel) return;
      panel.replaceChildren();
      appendStat(panel, 'Status', String(data.status || data.data?.status || 'OK').toUpperCase(), 'ok');
      appendStat(panel, 'Uptime', formatUptime(data.uptime ?? data.data?.uptime));
      const memory = Number(data.memory?.percent ?? data.ram_pct ?? data.data?.memory?.percent);
      if (Number.isFinite(memory)) {
        appendStat(panel, 'Memory', `${Math.round(memory)}%`, memory > 85 ? 'warn' : '');
        updateMeter('ram', memory);
      }
      const cpu = Number(data.cpu_percent ?? data.cpu ?? data.data?.cpu_percent);
      if (Number.isFinite(cpu)) updateMeter('cpu', cpu);
    } catch (error) {
      if (panel) {
        panel.replaceChildren();
        appendStat(panel, 'API', 'OFFLINE', 'err');
      }
    }
  }

  function formatUptime(value) {
    if (value === undefined || value === null || value === '') return '—';
    if (typeof value === 'number') {
      const days = Math.floor(value / 86400);
      const hours = Math.floor((value % 86400) / 3600);
      return days ? `${days}d ${hours}h` : `${hours}h`;
    }
    return String(value);
  }

  async function loadAgents() {
    try {
      const data = await apiFetch('/api/mc/agents');
      const agents = data.agents || data.data?.agents || data.data || [];
      restAgentsAvailable = Array.isArray(agents) && agents.length > 0;
      mergeAgents(agents, 'rest');
    } catch (error) {
      restAgentsAvailable = false;
      if (!liveAgents.size) renderAgentError('Agent API offline');
      syncCoreState();
    }
  }

  function appendStat(parent, label, value, className) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = `value${className ? ` ${className}` : ''}`;
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    parent.appendChild(row);
  }

  function renderAgents(agents) {
    const panel = document.getElementById('agents-panel');
    if (!panel || !agents.length) return;
    panel.replaceChildren();
    agents.forEach((agent) => {
      const status = String(agent.status || 'idle').toLowerCase();
      const dotClass = ['offline', 'error', 'failed'].includes(status)
        ? 'offline' : isAgentBusy(agent) || ['active', 'online'].includes(status) ? 'online' : 'idle';
      const item = document.createElement('div');
      item.className = 'agent-item';
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `Detail ${shortAgentName(agent)}`);
      item.addEventListener('click', () => graph?.openAgent(String(agent.id).toLowerCase()));
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          graph?.openAgent(String(agent.id).toLowerCase());
        }
      });
      const dot = document.createElement('span');
      dot.className = `agent-dot ${dotClass}`;
      const name = document.createElement('span');
      name.className = 'agent-name';
      name.textContent = shortAgentName(agent);
      const model = document.createElement('span');
      model.className = 'agent-model';
      model.textContent = agent.model || agent.thread || '';
      item.append(dot, name, model);
      panel.appendChild(item);
    });
  }

  function renderAgentError(message) {
    const panel = document.getElementById('agents-panel');
    if (!panel) return;
    panel.replaceChildren();
    appendStat(panel, 'Agents', message, 'err');
  }

  function updateMeter(id, value) {
    const numeric = Math.max(0, Math.min(100, Number(value) || 0));
    let label = document.getElementById(`meter-${id}`);
    if (!label) {
      const systemPanel = document.getElementById('system-stats');
      if (!systemPanel) return;
      let meter = systemPanel.querySelector('.meter');
      if (!meter) {
        meter = document.createElement('div');
        meter.className = 'meter';
        ['cpu', 'ram'].forEach((meterId) => {
          const row = document.createElement('div');
          row.className = 'meter-row';
          row.innerHTML = `<span>${meterId.toUpperCase()}</span><div class="meter-bar"><div class="meter-fill" id="meter-${meterId}-fill" style="width:0%"></div></div><span id="meter-${meterId}">—</span>`;
          meter.appendChild(row);
        });
        systemPanel.appendChild(meter);
      }
      label = document.getElementById(`meter-${id}`);
    }
    const fill = document.getElementById(`meter-${id}-fill`);
    if (fill) {
      fill.style.width = `${numeric}%`;
      fill.classList.toggle('warn', numeric > 80);
    }
    if (label) label.textContent = `${Math.round(numeric)}%`;
  }

  function connectWebSocket() {
    let retryCount = 0;
    let retryTimer = 0;
    let socket = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${protocol}://${location.host}/ws/swarm`);
      wsIndicator.textContent = '○ CONNECTING';
      wsIndicator.classList.add('off');

      socket.addEventListener('open', () => {
        wsConnected = true;
        retryCount = 0;
        wsIndicator.textContent = '● LIVE';
        wsIndicator.classList.remove('off');
        syncCoreState();
      });

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!['init', 'tick'].includes(payload.type)) return;
          if (Array.isArray(payload.agents)) mergeAgents(payload.agents, 'ws');
          if (Array.isArray(payload.dispatches)) pulseRecentDispatch(payload.dispatches);
        } catch (_) { /* ignore malformed telemetry frames */ }
      });

      socket.addEventListener('close', () => {
        wsConnected = false;
        wsIndicator.textContent = '○ RECONNECTING';
        wsIndicator.classList.add('off');
        syncCoreState();
        retryCount += 1;
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(connect, Math.min(30000, 1500 * (2 ** Math.min(retryCount, 4))));
      });

      socket.addEventListener('error', () => {
        try { socket.close(); } catch (_) { /* no-op */ }
      });
    };

    connect();
    window.addEventListener('pagehide', () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      try { socket?.close(); } catch (_) { /* no-op */ }
    }, { once: true });
  }

  let lastDispatchId = null;
  function pulseRecentDispatch(dispatches) {
    const latest = dispatches[0];
    if (!latest) return;
    const id = latest.id || latest.dispatch_id || latest.task_id;
    if (!id || id === lastDispatchId) return;
    lastDispatchId = id;
    const candidates = [latest.agent, latest.to, latest.target].filter(Boolean).map(String);
    const topicToAgent = { '1': 'chief', '802': 'research', '803': 'programmer', '804': 'qa', '1172': 'creator' };
    const target = candidates.map((value) => topicToAgent[value] || value.toLowerCase()).find((value) => liveAgents.has(value));
    if (target) graph?.fire(target);
  }

  function setupRoutines() {
    const routineMeta = {
      'morning-brief': { icon: '◐', label: 'Morning Brief' },
      'rekap-harian': { icon: '▦', label: 'Rekap Harian' },
      'daily-report': { icon: '▦', label: 'Rekap Harian' },
      'sync-proyek': { icon: '◇', label: 'Sync Proyek' },
      'project-sync': { icon: '◇', label: 'Sync Proyek' },
    };

    async function loadRoutines() {
      const container = document.getElementById('routine-buttons');
      try {
        const data = await apiFetch('/api/mc/routines');
        if (container) {
          container.replaceChildren();
          (data.routines || []).forEach((routine) => {
            const meta = routineMeta[routine] || { icon: '⚡', label: routine };
            const button = document.createElement('button');
            button.className = 'routine-btn';
            button.type = 'button';
            const left = document.createElement('span');
            const icon = document.createElement('span');
            icon.className = 'r-icon';
            icon.textContent = meta.icon;
            left.append(icon, document.createTextNode(meta.label));
            const status = document.createElement('span');
            status.className = 'r-status';
            status.textContent = 'run';
            button.append(left, status);
            button.addEventListener('click', () => runRoutine(routine, button));
            container.appendChild(button);
          });
        }
        renderProjects(data.projects || []);
        if (data.capture_today !== undefined) {
          const stats = document.getElementById('system-stats');
          if (stats && !stats.querySelector('[data-capture-stat]')) {
            const before = stats.children.length;
            appendStat(stats, 'Capture', String(data.capture_today), 'ok');
            stats.children[before]?.setAttribute('data-capture-stat', 'true');
          }
        }
      } catch (_) {
        if (container) {
          container.replaceChildren();
          appendStat(container, 'Routines', 'API offline', 'err');
        }
      }
    }

    async function runRoutine(name, button) {
      const output = document.getElementById('routine-output');
      if (button) button.disabled = true;
      if (output) output.textContent = `▶ Menjalankan ${name}...`;
      try {
        const data = await apiFetch('/api/mc/routine/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        if (output) output.textContent = String(data.output || data.status || 'selesai').slice(0, 500);
      } catch (error) {
        if (output) output.textContent = `Error: ${error.message}`;
      } finally {
        if (button) button.disabled = false;
      }
    }

    function renderProjects(projects) {
      const container = document.getElementById('proj-list');
      if (!container) return;
      container.replaceChildren();
      projects.slice(0, 4).forEach((project) => {
        const item = document.createElement('div');
        item.className = 'proj-item';
        const dot = document.createElement('span');
        dot.className = 'p-dot';
        const name = document.createTextNode(project.name || 'Project');
        const status = document.createElement('span');
        status.style.cssText = 'margin-left:auto;color:#718397;font-size:.55rem';
        status.textContent = String(project.status || '').slice(0, 25);
        item.append(dot, name, status);
        container.appendChild(item);
      });
    }

    window.__runRoutine = (name) => runRoutine(name, null);
    loadRoutines();
    window.setInterval(loadRoutines, 30000);
  }

  function setupGestureControl() {
    let gestureOn = false;
    let hands = null;
    let cameraHandle = null;
    let video = null;
    let lastPinch = null;

    window.__toggleGesture = async function () {
      const button = document.getElementById('gesture-btn');
      video = document.getElementById('cam');
      if (gestureOn) {
        gestureOn = false;
        try { await cameraHandle?.stop(); } catch (_) { /* no-op */ }
        if (video?.srcObject) video.srcObject.getTracks().forEach((track) => track.stop());
        if (video) video.style.display = 'none';
        if (button) button.textContent = '✋ GESTURE OFF';
        lastPinch = null;
        return;
      }

      if (typeof window.Hands === 'undefined' || typeof window.Camera === 'undefined') {
        if (button) button.textContent = '✋ UNAVAILABLE';
        return;
      }

      try {
        gestureOn = true;
        hands = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: .6, minTrackingConfidence: .55 });
        hands.onResults((results) => {
          const landmarks = results.multiHandLandmarks?.[0];
          if (!landmarks) { lastPinch = null; return; }
          const thumb = landmarks[4];
          const index = landmarks[8];
          const distance = Math.hypot(thumb.x - index.x, thumb.y - index.y);
          if (distance < .08) {
            if (lastPinch) sceneController?.nudgeRotation((index.y - lastPinch.y) * 2.5, (index.x - lastPinch.x) * 2.5);
            lastPinch = { x: index.x, y: index.y };
          } else {
            lastPinch = null;
          }
        });
        cameraHandle = new window.Camera(video, {
          onFrame: async () => hands.send({ image: video }),
          width: 160,
          height: 120,
        });
        video.style.display = 'block';
        await cameraHandle.start();
        if (button) button.textContent = '✋ GESTURE ON';
      } catch (_) {
        gestureOn = false;
        if (video) video.style.display = 'none';
        if (button) button.textContent = '✋ CAM ERR';
      }
    };
  }

  function createMissionCoreScene() {
    if (!canvas || typeof window.THREE === 'undefined') {
      document.body.classList.add('no-webgl');
      return { setState() {}, nudgeRotation() {} };
    }

    const THREE = window.THREE;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (_) {
      document.body.classList.add('no-webgl');
      return { setState() {}, nudgeRotation() {} };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, .1, 100);
    let targetZoom = 9.2;
    camera.position.z = targetZoom;

    const group = new THREE.Group();
    scene.add(group);

    const gold = 0xf5a623;
    const cyan = 0x00e5ff;
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.62, 2),
      new THREE.MeshBasicMaterial({ color: gold, wireframe: true, transparent: true, opacity: .46 }),
    );
    group.add(shell);

    const meridian = new THREE.Mesh(
      new THREE.SphereGeometry(1.88, 18, 12),
      new THREE.MeshBasicMaterial({ color: gold, wireframe: true, transparent: true, opacity: .13 }),
    );
    meridian.rotation.set(.28, .1, .2);
    group.add(meridian);

    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 28, 20),
      new THREE.MeshBasicMaterial({ color: cyan, transparent: true, opacity: .055, depthWrite: false }),
    );
    group.add(coreGlow);

    const coreGeometry = new THREE.BufferGeometry();
    const coreCount = reducedMotion.matches ? 360 : 1100;
    const corePositions = new Float32Array(coreCount * 3);
    const coreSeeds = new Float32Array(coreCount);
    for (let i = 0; i < coreCount; i += 1) {
      const radius = .12 + Math.pow(Math.random(), .58) * 1.18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      corePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      corePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      corePositions[i * 3 + 2] = radius * Math.cos(phi);
      coreSeeds[i] = Math.random() * Math.PI * 2;
    }
    coreGeometry.setAttribute('position', new THREE.BufferAttribute(corePositions, 3));
    const coreMaterial = new THREE.PointsMaterial({ color: cyan, size: .038, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
    const corePoints = new THREE.Points(coreGeometry, coreMaterial);
    group.add(corePoints);

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(2.12, .018, 8, 96),
      new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: .58 }),
    );
    ring1.rotation.x = Math.PI / 2.25;
    group.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.34, .012, 8, 96),
      new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: .28 }),
    );
    ring2.rotation.set(Math.PI / 1.75, .22, .35);
    group.add(ring2);

    const fieldGeometry = new THREE.BufferGeometry();
    const fieldCount = reducedMotion.matches ? 120 : 430;
    const fieldPositions = new Float32Array(fieldCount * 3);
    for (let i = 0; i < fieldCount; i += 1) {
      const radius = 4.2 + Math.random() * 5.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      fieldPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      fieldPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      fieldPositions[i * 3 + 2] = radius * Math.cos(phi);
    }
    fieldGeometry.setAttribute('position', new THREE.BufferAttribute(fieldPositions, 3));
    const field = new THREE.Points(
      fieldGeometry,
      new THREE.PointsMaterial({ color: cyan, size: .022, transparent: true, opacity: .34, depthWrite: false }),
    );
    scene.add(field);

    let targetRotX = .08;
    let targetRotY = 0;
    let dragging = false;
    let pointerX = 0;
    let pointerY = 0;
    let sceneState = 'standby';
    let contextLost = false;

    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      contextLost = true;
      document.body.classList.add('no-webgl');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      contextLost = false;
      document.body.classList.remove('no-webgl');
    });

    canvas.addEventListener('pointerdown', (event) => {
      dragging = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      targetRotY += (event.clientX - pointerX) * .005;
      targetRotX += (event.clientY - pointerY) * .005;
      pointerX = event.clientX;
      pointerY = event.clientY;
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointercancel', () => { dragging = false; });
    canvas.addEventListener('wheel', (event) => {
      targetZoom = Math.max(7.3, Math.min(12, targetZoom + event.deltaY * .004));
      event.preventDefault();
    }, { passive: false });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      if (contextLost) return;
      const elapsed = clock.getElapsedTime();
      group.rotation.x += (targetRotX - group.rotation.x) * .07;
      group.rotation.y += (targetRotY - group.rotation.y) * .07;
      if (!reducedMotion.matches) {
        const energy = sceneState === 'processing' ? 1 : .34;
        targetRotY += .0007 + energy * .0007;
        shell.rotation.y += .0017 + energy * .0012;
        meridian.rotation.y -= .0009 + energy * .0007;
        ring1.rotation.z += .0018 + energy * .0018;
        ring2.rotation.z -= .0012 + energy * .0014;
        field.rotation.y += .00018;
        corePoints.rotation.y -= .0012 + energy * .0007;
        const pulse = 1 + Math.sin(elapsed * (sceneState === 'processing' ? 3.7 : 1.55)) * (sceneState === 'processing' ? .045 : .018);
        corePoints.scale.setScalar(pulse * (sceneState === 'processing' ? 1.08 : 1));
        coreMaterial.opacity = .72 + pulse * .15;
        coreGlow.material.opacity = sceneState === 'processing' ? .095 : .05;
      }
      camera.position.z += (targetZoom - camera.position.z) * .075;
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    });

    return {
      setState(next) { sceneState = next; },
      nudgeRotation(dx, dy) { targetRotX += dx; targetRotY += dy; },
    };
  }
})();
