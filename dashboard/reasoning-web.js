/*
 * Niumination reasoning constellation.
 * Vanilla adaptation of the interaction and visual language in APEX-UI's
 * ReasoningWeb component (MIT). See THIRD_PARTY_NOTICES.md.
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CENTER = { x: 500, y: 320 };
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
  const STATUS_COLORS = {
    online: '#34d399',
    busy: '#00e5ff',
    idle: '#f5a623',
    offline: '#fb7185',
  };

  const LAYOUT = [
    { id: 'chief', name: 'Hermes Chief', shortRole: 'ORCHESTRATOR', x: 500, y: 92, radius: 17, color: '#00e5ff', label: 'bottom' },
    { id: 'research', name: 'Research', shortRole: 'INTELLIGENCE', x: 210, y: 205, radius: 13, color: '#00e5ff', label: 'right' },
    { id: 'programmer', name: 'Programmer', shortRole: 'ENGINEERING', x: 265, y: 486, radius: 13, color: '#f5a623', label: 'right' },
    { id: 'qa', name: 'QA', shortRole: 'VERIFICATION', x: 735, y: 486, radius: 13, color: '#34d399', label: 'left' },
    { id: 'creator', name: 'Creator', shortRole: 'CONTENT', x: 790, y: 205, radius: 13, color: '#f5a623', label: 'left' },
  ];

  const nodes = new Map();
  const motes = [];
  let svg;
  let pulseLayer;
  let hiddenList;
  let dialog;
  let selectedAgent = null;
  let dialogOpener = null;
  let animationFrame = 0;
  let lastFrame = performance.now();
  let nextAmbient = lastFrame + 750;
  let state = 'standby';

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => el.setAttribute(key, String(value)));
    return el;
  }

  function pathTo(node) {
    const dx = node.x - CENTER.x;
    const dy = node.y - CENTER.y;
    const length = Math.hypot(dx, dy) || 1;
    const bend = node.id === 'chief' ? 0 : (node.x < CENTER.x ? -24 : 24);
    const midX = (CENTER.x + node.x) / 2 + (-dy / length) * bend;
    const midY = (CENTER.y + node.y) / 2 + (dx / length) * bend;
    return `M ${CENTER.x} ${CENTER.y} Q ${midX} ${midY} ${node.x} ${node.y}`;
  }

  function addDefs() {
    const defs = svgEl('defs');
    defs.innerHTML = `
      <filter id="rw-glow" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="2.4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="rw-soft-glow" x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="6"/>
      </filter>
      <filter id="rw-line-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>`;
    svg.appendChild(defs);
  }

  function addStructure() {
    const traceLayer = svgEl('g', { 'aria-hidden': 'true' });
    const ringLayer = svgEl('g', { 'aria-hidden': 'true' });
    const spokeLayer = svgEl('g', { 'aria-hidden': 'true' });
    pulseLayer = svgEl('g', { 'aria-hidden': 'true' });
    const nodeLayer = svgEl('g', { 'aria-hidden': 'true' });

    [112, 198, 286].forEach((radius) => {
      ringLayer.appendChild(svgEl('circle', {
        class: 'rw-ring', cx: CENTER.x, cy: CENTER.y, r: radius,
      }));
    });

    // Ordered PCB traces terminate at the viewport edges, echoing the source
    // interface without copying its 18-agent business roster.
    const traces = [
      [120, 246, 22, 224], [156, 300, 38, 334], [134, 384, 18, 406],
      [880, 246, 978, 224], [844, 300, 962, 334], [866, 384, 982, 406],
    ];
    traces.forEach(([startX, startY, endX, endY]) => {
      const middleX = startX < CENTER.x ? 74 : 926;
      traceLayer.appendChild(svgEl('path', {
        class: 'rw-trace', d: `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`,
      }));
      traceLayer.appendChild(svgEl('circle', {
        class: 'rw-trace-terminal', cx: endX, cy: endY, r: 2.4,
      }));
    });

    LAYOUT.forEach((layout) => {
      const agent = { ...layout, status: 'idle', model: '—', role: layout.shortRole.toLowerCase(), running: 0, completed: 0, failed: 0 };
      const group = svgEl('g', {
        class: 'rw-agent is-idle',
        'data-agent': agent.id,
        style: `--agent-color:${agent.color}`,
      });
      const spoke = svgEl('path', { class: 'rw-spoke', d: pathTo(agent), opacity: '.72' });
      group.appendChild(spoke);

      const halo = svgEl('circle', {
        class: 'rw-node-halo', cx: agent.x, cy: agent.y, r: agent.radius + 8,
      });
      const ring = svgEl('circle', {
        class: 'rw-node-ring', cx: agent.x, cy: agent.y, r: agent.radius,
      });
      const core = svgEl('circle', {
        class: 'rw-node-core', cx: agent.x, cy: agent.y, r: agent.id === 'chief' ? 5 : 3.5,
      });
      group.append(halo, ring, core);

      const labelData = labelPosition(agent);
      const name = svgEl('text', {
        class: 'rw-agent-label', x: labelData.x, y: labelData.y,
        'text-anchor': labelData.anchor,
      });
      name.textContent = agent.name;
      const role = svgEl('text', {
        class: 'rw-agent-role', x: labelData.x, y: labelData.y + 14,
        'text-anchor': labelData.anchor,
      });
      role.textContent = agent.shortRole;
      const status = svgEl('text', {
        class: 'rw-agent-status', x: labelData.x, y: labelData.y + 27,
        'text-anchor': labelData.anchor,
      });
      status.textContent = 'STANDBY';
      group.append(name, role, status);

      const hit = svgEl('circle', {
        class: 'rw-hit', cx: agent.x, cy: agent.y, r: Math.max(27, agent.radius + 14),
        tabindex: '-1',
      });
      hit.addEventListener('click', () => openDialog(agent.id, hit));
      group.appendChild(hit);

      nodeLayer.appendChild(group);
      nodes.set(agent.id, { agent, group, spoke, halo, ring, core, name, role, status });
    });

    svg.append(traceLayer, ringLayer, spokeLayer, pulseLayer, nodeLayer);

    // Spokes are inside each node group so status classes can energize them;
    // the empty layer remains as an explicit z-order slot for future links.
    void spokeLayer;
  }

  function labelPosition(agent) {
    if (agent.label === 'right') return { x: agent.x + agent.radius + 13, y: agent.y - 4, anchor: 'start' };
    if (agent.label === 'left') return { x: agent.x - agent.radius - 13, y: agent.y - 4, anchor: 'end' };
    return { x: agent.x, y: agent.y + agent.radius + 19, anchor: 'middle' };
  }

  function statusKind(agent) {
    const raw = String(agent.status || '').toLowerCase();
    if (Number(agent.running) > 0 || ['running', 'processing', 'working'].includes(raw)) return 'busy';
    if (['offline', 'error', 'failed', 'unavailable'].includes(raw)) return 'offline';
    if (['active', 'online', 'ready'].includes(raw)) return 'online';
    return 'idle';
  }

  function statusLabel(agent) {
    const kind = statusKind(agent);
    if (kind === 'busy') return `${Number(agent.running) || 1} ACTIVE`;
    if (kind === 'offline') return 'OFFLINE';
    if (kind === 'online') return 'ONLINE';
    return 'STANDBY';
  }

  function updateAgents(agentList) {
    if (!Array.isArray(agentList)) return;
    const busyBefore = new Set([...nodes.values()].filter((entry) => statusKind(entry.agent) === 'busy').map((entry) => entry.agent.id));

    agentList.forEach((incoming) => {
      const id = String(incoming.id || '').toLowerCase();
      const entry = nodes.get(id);
      if (!entry) return;

      // WS snapshots are intentionally light. Preserve richer REST counters
      // unless a field is actually present in the incoming object.
      Object.keys(incoming).forEach((key) => {
        if (incoming[key] !== undefined && incoming[key] !== null) entry.agent[key] = incoming[key];
      });
      entry.agent.name = incoming.name || entry.agent.name;
      entry.agent.model = incoming.model || entry.agent.model;
      entry.agent.role = incoming.role || entry.agent.role;

      const kind = statusKind(entry.agent);
      entry.group.setAttribute('class', `rw-agent is-${kind}`);
      entry.status.textContent = statusLabel(entry.agent);
      entry.name.textContent = displayName(entry.agent);
      entry.role.textContent = String(entry.agent.role || entry.agent.shortRole).toUpperCase();

      if (kind === 'busy' && !busyBefore.has(id)) fire(id);
    });

    refreshHiddenList();
    if (selectedAgent) populateDialog(selectedAgent);

    const busy = [...nodes.values()].filter((entry) => statusKind(entry.agent) === 'busy');
    if (busy.length > 1) flashCollaborations(busy);
    document.dispatchEvent(new CustomEvent('mission-agents-updated', {
      detail: { agents: [...nodes.values()].map((entry) => ({ ...entry.agent })), busy: busy.map((entry) => entry.agent.id) },
    }));
  }

  function displayName(agent) {
    if (agent.id === 'chief') return 'Hermes Chief';
    return String(agent.name || agent.id).replace(/\s+Agent$/i, '');
  }

  function fire(id) {
    const entry = nodes.get(id);
    if (!entry) return;
    entry.group.classList.add('is-fired');
    const count = REDUCED_MOTION.matches ? 0 : 12;
    for (let i = 0; i < count; i += 1) {
      window.setTimeout(() => spawnMote(entry.spoke, false), i * 85);
    }
    window.setTimeout(() => entry.group.classList.remove('is-fired'), 1900);
  }

  function flashCollaborations(entries) {
    const existing = pulseLayer.querySelectorAll('.rw-link');
    existing.forEach((line) => line.remove());
    entries.slice(0, 4).forEach((entry, index, list) => {
      const next = list[index + 1];
      if (!next) return;
      const line = svgEl('line', {
        class: 'rw-link',
        x1: entry.agent.x, y1: entry.agent.y,
        x2: next.agent.x, y2: next.agent.y,
      });
      pulseLayer.appendChild(line);
      window.setTimeout(() => line.remove(), 2300);
    });
  }

  function spawnMote(spoke, ambient) {
    if (REDUCED_MOTION.matches || !spoke || motes.length > 20) return;
    const mote = svgEl('circle', {
      class: 'rw-mote', r: ambient ? .95 : 1.6, opacity: '0',
    });
    pulseLayer.appendChild(mote);
    let length = 0;
    try { length = spoke.getTotalLength(); } catch (_) { return; }
    motes.push({ el: mote, spoke, length, born: performance.now(), duration: ambient ? 920 : 650, ambient });
  }

  function animate(now) {
    const delta = Math.min(.05, (now - lastFrame) / 1000);
    lastFrame = now;
    void delta;

    if (!REDUCED_MOTION.matches && now >= nextAmbient && motes.length < 12) {
      const entries = [...nodes.values()];
      const pick = entries[Math.floor(Math.random() * entries.length)];
      if (pick) spawnMote(pick.spoke, true);
      nextAmbient = now + (state === 'processing' ? 260 : 680) + Math.random() * 420;
    }

    for (let i = motes.length - 1; i >= 0; i -= 1) {
      const mote = motes[i];
      const progress = (now - mote.born) / mote.duration;
      if (progress >= 1) {
        mote.el.remove();
        motes.splice(i, 1);
        continue;
      }
      const point = mote.spoke.getPointAtLength(progress * mote.length);
      mote.el.setAttribute('cx', point.x);
      mote.el.setAttribute('cy', point.y);
      mote.el.setAttribute('opacity', String((mote.ambient ? .45 : .92) * Math.sin(progress * Math.PI)));
    }
    animationFrame = requestAnimationFrame(animate);
  }

  function setState(next) {
    state = ['standby', 'processing', 'degraded'].includes(next) ? next : 'standby';
  }

  function setupDialog() {
    dialog = document.getElementById('core-agent-dialog');
    document.getElementById('core-agent-close')?.addEventListener('click', closeDialog);
    document.getElementById('core-agent-open')?.addEventListener('click', () => {
      closeDialog();
      if (typeof window.__openApp === 'function') window.__openApp('swarm');
    });
    document.addEventListener('keydown', (event) => {
      if (!dialog || dialog.hidden) return;
      if (event.key === 'Escape') {
        closeDialog();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll('button:not([disabled])')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  function openDialog(id, opener) {
    if (!nodes.has(id) || !dialog) return;
    selectedAgent = id;
    dialogOpener = opener || document.activeElement;
    populateDialog(id);
    dialog.hidden = false;
    document.getElementById('core-agent-close')?.focus({ preventScroll: true });
  }

  function closeDialog() {
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    selectedAgent = null;
    if (dialogOpener && typeof dialogOpener.focus === 'function') dialogOpener.focus({ preventScroll: true });
    dialogOpener = null;
  }

  function populateDialog(id) {
    const entry = nodes.get(id);
    if (!entry || !dialog) return;
    const agent = entry.agent;
    const kind = statusKind(agent);
    dialog.style.setProperty('--dialog-color', agent.color);
    dialog.style.setProperty('--dialog-status', STATUS_COLORS[kind]);
    setText('core-agent-name', displayName(agent));
    setText('core-agent-role', agent.role || agent.shortRole);
    setText('core-agent-model', agent.model || '—');
    setText('core-agent-running', String(Number(agent.running) || 0));
    setText('core-agent-completed', String(Number(agent.completed) || 0));
    setText('core-agent-failed', String(Number(agent.failed) || 0));
    setText('core-agent-status-text', kind === 'busy' ? 'Sedang mengeksekusi misi' : kind === 'offline' ? 'Agent tidak tersedia' : 'Siap menerima delegasi');
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function refreshHiddenList() {
    if (!hiddenList) return;
    hiddenList.replaceChildren();
    nodes.forEach((entry) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${displayName(entry.agent)} — ${entry.agent.role || entry.agent.shortRole}, ${statusLabel(entry.agent)}`;
      button.addEventListener('click', () => openDialog(entry.agent.id, button));
      item.appendChild(button);
      hiddenList.appendChild(item);
    });
  }

  function init() {
    svg = document.getElementById('reasoning-web');
    hiddenList = document.getElementById('core-agent-list');
    if (!svg || svg.dataset.ready === 'true') return;
    svg.dataset.ready = 'true';
    addDefs();
    addStructure();
    setupDialog();
    refreshHiddenList();
    animationFrame = requestAnimationFrame(animate);
  }

  window.addEventListener('pagehide', () => cancelAnimationFrame(animationFrame));

  window.NiuReasoningWeb = {
    init,
    updateAgents,
    setState,
    fire,
    openAgent: (id) => openDialog(id, document.activeElement),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
