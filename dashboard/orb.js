/* ══════════════════════════════════════════════════════════════════════════
   APEX-MC orb.js — vanilla, no deps.
   - Graph node = ekosistem (trio + kategori proyek)
   - Orb state = Hermes gateway (idle/thinking/speaking) dari /api/mc/hermes
   - Reduced-motion: animasi dimatikan, data tetap live
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SVG_NS = "http://www.w3.org/2000/svg";

  // ── Node graph data (trio + kategori ekosistem) ──
  // Diisi dari /api/mc/ecosystem saat load; fallback statis ini.
  const STATIC_NODES = [
    { key: "hermes",   name: "Hermes",     cat: "trio", color: "#00e5ff" },
    { key: "jcode",    name: "JCode",      cat: "trio", color: "#34d399" },
    { key: "opencode", name: "OpenCode",   cat: "trio", color: "#f5c542" },
    { key: "apps",     name: "Apps",       cat: "cat",  color: "#00e5ff" },
    { key: "services", name: "Services",   cat: "cat",  color: "#00e5ff" },
    { key: "sites",    name: "Sites",      cat: "cat",  color: "#00e5ff" },
    { key: "desktop",  name: "Desktop",    cat: "cat",  color: "#7f9bb3" },
    { key: "agents",   name: "Agents",     cat: "cat",  color: "#7f9bb3" },
    { key: "labs",     name: "Labs",       cat: "cat",  color: "#7f9bb3" },
    { key: "skills",   name: "Skill Bank", cat: "cat",  color: "#f5c542" },
  ];

  let NODES = STATIC_NODES.slice();
  let nodeData = {}; // key -> {status, detail}

  // ── Build SVG graph (orbit rings) ──
  function layoutGraph() {
    const cx = 500, cy = 500;
    const ringR = [180, 280, 360]; // 3 orbit rings
    const groups = { trio: ringR[0], cat: ringR[1], skills: ringR[2] };
    // place 'skills' on outer ring too
    const edgesG = document.getElementById("edges");
    const nodesG = document.getElementById("nodes");
    edgesG.innerHTML = "";
    nodesG.innerHTML = "";

    NODES.forEach((n, i) => {
      const r = n.cat === "trio" ? groups.trio : n.key === "skills" ? groups.skills : groups.cat;
      const angle = (i / NODES.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      n._x = x; n._y = y;

      // edge to center
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", cx); line.setAttribute("y1", cy);
      line.setAttribute("x2", x); line.setAttribute("y2", y);
      line.setAttribute("class", "edge");
      edgesG.appendChild(line);

      // hit area
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "node-hit");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", n.name);
      const ring = document.createElementNS(SVG_NS, "circle");
      ring.setAttribute("cx", x); ring.setAttribute("cy", y); ring.setAttribute("r", 26);
      ring.setAttribute("class", "node-ring");
      ring.setAttribute("stroke", n.color);
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", x); dot.setAttribute("cy", y); dot.setAttribute("r", 7);
      dot.setAttribute("class", "node-dot");
      dot.setAttribute("fill", n.color);
      const txt = document.createElementNS(SVG_NS, "text");
      txt.setAttribute("x", x); txt.setAttribute("y", y + 44);
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("fill", "rgba(240,237,232,0.7)");
      txt.setAttribute("font-size", "13");
      txt.setAttribute("font-family", "var(--font-mono)");
      txt.textContent = n.name;
      g.appendChild(ring); g.appendChild(dot); g.appendChild(txt);
      g.addEventListener("click", () => openCard(n));
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(n); } });
      nodesG.appendChild(g);
      n._dot = dot; n._ring = ring;
    });

    // keyboard nav list
    const nav = document.getElementById("graph-nav-list");
    nav.innerHTML = "";
    NODES.forEach((n) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = n.name;
      btn.addEventListener("click", () => openCard(n));
      li.appendChild(btn); nav.appendChild(li);
    });
  }

  // ── Orb state ──
  let orbState = "idle"; // idle | thinking | speaking
  function setOrb(state) {
    orbState = state;
    const light = document.getElementById("lightcast");
    const label = document.getElementById("orb-label");
    const sbState = document.getElementById("sb-state");
    light.classList.toggle("speaking", state === "speaking");
    label.textContent = state === "speaking" ? "SPEAKING" : state === "thinking" ? "THINKING" : "STANDBY";
    sbState.textContent = label.textContent;
    sbState.className = state === "speaking" ? "ok" : state === "thinking" ? "warn" : "ok";
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

  // ── Overview card ──
  const card = document.getElementById("card");
  function openCard(n) {
    const d = nodeData[n.key] || {};
    document.getElementById("card-title").textContent = n.name.toUpperCase();
    document.getElementById("card-sub").textContent = d.role || (n.cat === "trio" ? "Agent Trio" : "Kategori Ekosistem");
    const body = document.getElementById("card-body");
    let html = "";
    if (d.caps) {
      html += '<div><div class="cap-label">WHAT IT HANDLES</div>';
      d.caps.forEach((c) => { html += '<div class="cap">' + c + "</div>"; });
      html += "</div>";
    }
    if (d.meta) {
      html += '<div class="meta">' + d.meta + "</div>";
    } else {
      html += '<div class="meta">Status: <b>' + (d.status || "aktif") + "</b></div>";
    }
    body.innerHTML = html;
    card.classList.add("open");
    card.querySelector("#card-close").focus();
  }
  document.getElementById("card-close").addEventListener("click", () => card.classList.remove("open"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") card.classList.remove("open"); });

  // ── Overview HUD toggle ──
  const ovFil = document.getElementById("ov-filament");
  ovFil.addEventListener("click", () => {
    const open = ovFil.getAttribute("aria-expanded") === "true";
    ovFil.setAttribute("aria-expanded", String(!open));
    document.getElementById("ov-tiles").style.display = open ? "none" : "flex";
    document.getElementById("ov-status").style.display = open ? "none" : "flex";
  });
  ovFil.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ovFil.click(); }
  });

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
      // orb reflects hermes activity (thinking if cron running, else idle)
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
      // enrich node data with real project counts
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
      const total = d.total || 68;
      document.getElementById("sb-skill").textContent = total;
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
  layoutGraph();
  setOrb("idle");
  refresh();
  setInterval(refresh, 15000);

  // expose for debugging
  window.__mc = { setOrb, refresh, NODES };
})();
