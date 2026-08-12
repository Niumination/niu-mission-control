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
