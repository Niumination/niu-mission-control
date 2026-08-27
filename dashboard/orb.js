/* ══════════════════════════════════════════════════════════════════════════
   APEX-MC orb.js — vanilla, no deps.
   Faithful APEX-UI replication (apex-ui-xi.vercel.app):
   - Golden ring (R=220) mengisi layar + sound waves + inner swirl
   - Particle core: SVG dots mengorbit di dalam ring (pengganti three.js)
   - Equalizer bars kiri & kanan ring
   - Reasoning nodes mengorbit (trio + kategori ekosistem)
   - Orb state = Hermes gateway (idle/thinking/speaking) dari /api/mc/hermes
   - Reduced-motion: animasi mati, data tetap live
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const CX = 450, CY = 280;

  const STATIC_NODES = [
    { key: "hermes",   name: "Hermes",   color: "#00e5ff", tier: 0 },
    { key: "jcode",    name: "JCode",    color: "#34d399", tier: 0 },
    { key: "opencode", name: "OpenCode", color: "#f5c542", tier: 0 },
    { key: "apps",     name: "Apps",     color: "#f5a623", tier: 1 },
    { key: "services", name: "Services", color: "#f5a623", tier: 1 },
    { key: "sites",    name: "Sites",    color: "#f5a623", tier: 1 },
    { key: "desktop",  name: "Desktop",  color: "#7f9bb3", tier: 1 },
    { key: "agents",   name: "Agents",   color: "#7f9bb3", tier: 1 },
    { key: "labs",     name: "Labs",     color: "#7f9bb3", tier: 1 },
    { key: "skills",   name: "Skill",    color: "#f5a623", tier: 1 },
  ];

  let NODES = STATIC_NODES.slice();
  let nodeData = {};

  // ── Particle core (mengorbit di dalam ring R~120) ──
  const PARTICLES = [];
  function buildParticles() {
    const g = document.getElementById("particles");
    const count = reduced ? 0 : 46;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 95; // 30..125
      const speed = 0.002 + Math.random() * 0.006;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const size = 1 + Math.random() * 2.2;
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("r", size.toFixed(1));
      c.setAttribute("fill", i % 3 === 0 ? "#ffd080" : "#f5a623");
      c.setAttribute("opacity", (0.4 + Math.random() * 0.5).toFixed(2));
      g.appendChild(c);
      PARTICLES.push({ el: c, angle, r, speed: speed * dir, baseR: r });
    }
  }
  function animateParticles() {
    if (reduced) return;
    PARTICLES.forEach((p) => {
      p.angle += p.speed;
      p.r = p.baseR + Math.sin(p.angle * 2) * 8;
      const x = CX + p.r * Math.cos(p.angle);
      const y = CY + p.r * Math.sin(p.angle);
      p.el.setAttribute("cx", x.toFixed(1));
      p.el.setAttribute("cy", y.toFixed(1));
    });
    requestAnimationFrame(animateParticles);
  }

  // ── Equalizer bars (kiri & kanan ring) ──
  function buildWaveform() {
    const left = document.getElementById("waveform-left");
    const right = document.getElementById("waveform-right");
    const barCount = 14, barW = 4, gap = 3, maxH = 70;
    const startL = CX - 250, startR = CX + 250 - (barCount * (barW + gap));
    for (let i = 0; i < barCount; i++) {
      const h = 8 + Math.abs(Math.sin(i * 0.7)) * (maxH - 8);
      const xL = startL + i * (barW + gap);
      const xR = startR + i * (barW + gap);
      [["L", xL], ["R", xR]].forEach(([side, x]) => {
        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", CY - h / 2);
        rect.setAttribute("width", barW);
        rect.setAttribute("height", h);
        rect.setAttribute("rx", 2);
        rect.setAttribute("fill", "#f5a623");
        rect.setAttribute("class", "wavebar wavebar-" + (i % 7));
        rect.style.transformBox = "fill-box";
        rect.style.transformOrigin = "center";
        (side === "L" ? left : right).appendChild(rect);
      });
    }
  }

  // ── Reasoning nodes orbit (R=315) ──
  function buildNodes() {
    const g = document.getElementById("nodes");
    g.innerHTML = "";
    const ringR = 315;
    NODES.forEach((n, i) => {
      const angle = (i / NODES.length) * Math.PI * 2 - Math.PI / 2;
      const x = CX + ringR * Math.cos(angle);
      const y = CY + ringR * Math.sin(angle);
      n._x = x; n._y = y;

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", CX); line.setAttribute("y1", CY);
      line.setAttribute("x2", x); line.setAttribute("y2", y);
      line.setAttribute("class", "node-spoke");
      g.appendChild(line);

      const hit = document.createElementNS(SVG_NS, "g");
      hit.setAttribute("class", "node-hit");
      hit.setAttribute("tabindex", "0");
      hit.setAttribute("role", "button");
      hit.setAttribute("aria-label", n.name);

      const ring = document.createElementNS(SVG_NS, "circle");
      ring.setAttribute("cx", x); ring.setAttribute("cy", y); ring.setAttribute("r", 22);
      ring.setAttribute("class", "node-ring");
      ring.setAttribute("stroke", n.color);

      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("r", 5);
      dot.setAttribute("class", "node-dot");
      dot.setAttribute("fill", n.color);

      const txt = document.createElementNS(SVG_NS, "text");
      txt.setAttribute("x", x); txt.setAttribute("y", y + 38);
      txt.setAttribute("class", "node-label");
      txt.textContent = n.name;

      hit.appendChild(ring); hit.appendChild(dot); hit.appendChild(txt);
      hit.addEventListener("click", () => openCard(n));
      hit.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(n); } });
      g.appendChild(hit);
      n._dot = dot;
    });

    const nav = document.getElementById("graph-nav-list");
    nav.innerHTML = "";
    NODES.forEach((n) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button"; btn.textContent = n.name;
      btn.addEventListener("click", () => openCard(n));
      li.appendChild(btn); nav.appendChild(li);
    });
  }

  // ── Orb state ──
  let orbState = "idle";
  function setOrb(state) {
    orbState = state;
    document.getElementById("orb-stage").setAttribute("data-state", state);
    const label = document.getElementById("orb-label");
    const sb = document.getElementById("sb-state");
    label.textContent = state === "speaking" ? "SPEAKING" : state === "thinking" ? "PROCESSING" : "STANDBY";
    sb.textContent = label.textContent;
    sb.className = state === "speaking" ? "warn" : "ok";
  }

  function boost() {
    const next = orbState === "idle" ? "thinking" : orbState === "thinking" ? "speaking" : "idle";
    setOrb(next);
    if (!reduced) setTimeout(() => { if (orbState === next) setOrb("idle"); }, 8000);
  }
  document.getElementById("orb-tap").addEventListener("click", boost);
  document.getElementById("orb-tap").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); boost(); }
  });

  // ── Node card ──
  const card = document.getElementById("card");
  function openCard(n) {
    const d = nodeData[n.key] || {};
    document.getElementById("card-title").textContent = n.name.toUpperCase();
    document.getElementById("card-sub").textContent = d.role || (n.tier === 0 ? "Agent Trio" : "Kategori Ekosistem");
    const body = document.getElementById("card-body");
    let html = "";
    if (d.caps) {
      html += '<div><div class="cap-label">WHAT IT HANDLES</div>';
      d.caps.forEach((c) => { html += '<div class="cap">' + c + "</div>"; });
      html += "</div>";
    }
    if (d.meta) html += '<div class="meta">' + d.meta + "</div>";
    else html += '<div class="meta">Status: <b>' + (d.status || "aktif") + "</b></div>";
    body.innerHTML = html;
    card.classList.add("open");
    document.getElementById("card-close").focus();
  }
  document.getElementById("card-close").addEventListener("click", () => card.classList.remove("open"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") card.classList.remove("open"); });

  // ── Overview toggle ──
  const ovFil = document.getElementById("ov-filament");
  ovFil.addEventListener("click", () => {
    const open = ovFil.getAttribute("aria-expanded") === "true";
    ovFil.setAttribute("aria-expanded", String(!open));
    document.getElementById("ov-tiles").style.display = open ? "none" : "flex";
    document.getElementById("ov-status").style.display = open ? "none" : "flex";
  });
  ovFil.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ovFil.click(); } });

  // ── Clock ──
  function tickClock() {
    const now = new Date();
    document.getElementById("ov-clock").textContent = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("ov-date").textContent = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  tickClock(); setInterval(tickClock, 30000);

  // ── Live data ──
  async function loadHermes() {
    try {
      const r = await fetch("/api/mc/hermes");
      const d = await r.json();
      const gw = d.gateway || {};
      const online = gw.online === true;
      document.getElementById("ov-hermes").textContent = online ? "ONLINE (PID " + (gw.pid || "?") + ")" : "OFFLINE";
      document.getElementById("sb-gw").textContent = online ? "UP" : "DOWN";
      document.getElementById("sb-gw").className = online ? "ok" : "bad";
      setOrb(online ? "thinking" : "idle");
    } catch (e) {
      document.getElementById("ov-hermes").textContent = "ERR";
      document.getElementById("sb-gw").textContent = "ERR";
      document.getElementById("sb-gw").className = "bad";
    }
  }
  async function loadEcosystem() {
    try {
      const r = await fetch("/api/mc/ecosystem?type=projects");
      const d = await r.json();
      const projs = d.projects || [];
      document.getElementById("sb-proj").textContent = projs.length;
      const byCat = {};
      projs.forEach((p) => { byCat[p.category] = (byCat[p.category] || 0) + 1; });
      Object.keys(byCat).forEach((c) => {
        const n = NODES.find((x) => x.key === c);
        if (n) nodeData[c] = { status: "aktif", meta: "Proyek: <b>" + byCat[c] + "</b>" };
      });
      nodeData["skills"] = { status: "aktif", meta: "Bank skill: <b>68</b>" };
      nodeData["hermes"] = { role: "Agent Utama", caps: ["Orkestrasi ekosistem", "Gateway Telegram aktif", "Trio: Hermes+JCode+OpenCode"], status: "online" };
      nodeData["jcode"] = { role: "Agent Coding", caps: ["Next.js / cc-acehtengah", "Deploy Vercel"], status: "standby" };
      nodeData["opencode"] = { role: "Agent Coding", caps: ["CLI coding assistant"], status: "standby" };
    } catch (e) { /* keep static */ }
  }
  async function loadSkills() {
    try {
      const r = await fetch("/api/mc/skills/stats");
      const d = await r.json();
      document.getElementById("sb-skill").textContent = d.total || 68;
    } catch (e) { document.getElementById("sb-skill").textContent = "68"; }
  }
  async function loadMC() {
    try {
      const r = await fetch("/healthz");
      const up = r.ok;
      document.getElementById("ov-mc").textContent = up ? "UP" : "DOWN";
      document.getElementById("sb-mc").textContent = up ? "UP" : "DOWN";
      document.getElementById("sb-mc").className = up ? "ok" : "bad";
    } catch (e) {
      document.getElementById("ov-mc").textContent = "DOWN";
      document.getElementById("sb-mc").className = "bad";
    }
  }
  async function refresh() {
    await Promise.all([loadMC(), loadHermes(), loadEcosystem(), loadSkills()]);
  }

  // ── Init ──
  buildParticles();
  buildWaveform();
  buildNodes();
  setOrb("idle");
  if (!reduced) animateParticles();
  refresh();
  setInterval(refresh, 15000);

  window.__mc = { setOrb, refresh, NODES };
})();
