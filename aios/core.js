/*═════════════════════════════════════════════════════
  HERMES MISSION CONTROL v4.0 — Core Visual Module
  Holographic core · Digital human · 7-phase face cycle
  Vanilla JS · IIFE · No dependencies · No modules
  Pola: references/hermes-dashboard-v3-final.html + face-hologram
═════════════════════════════════════════════════════*/
(function(){
'use strict';

const $ = s => document.getElementById(s);
const pick = a => a[Math.floor(Math.random()*a.length)];
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const SPEECHES = [
  'Halo! Saya Hermes AI. Ada yang bisa saya bantu?',
  'Saya sedang memproses task aktif sekarang.',
  'Semua sistem normal. Load rata-rata stabil.',
  'Agent Research baru selesai sinkronisasi data.',
  'Mau saya buatkan laporan harian hari ini?',
  'Swarm stabil — semua agent terhubung.',
  'Saya bisa membantu coding, analisis, dan riset.',
  'Klik thread card untuk detail performa.',
];

/*═══════════════════════════════════════
  HOLOGRAPHIC CORE (Canvas 2D)
  Pre-computed particles, zero GC pressure
═══════════════════════════════════════*/
const holo = $('holo');
let holoCtx = null, cw = 0, ch = 0;

if (holo) {
  holoCtx = holo.getContext('2d', {alpha:true});
  const DPR = Math.min(window.devicePixelRatio||1, 2);

  function resizeHolo(){
    const r = holo.parentElement.getBoundingClientRect();
    cw = r.width; ch = r.height;
    holo.width = cw*DPR; holo.height = ch*DPR;
    holo.style.width = cw+'px'; holo.style.height = ch+'px';
    holoCtx.setTransform(DPR,0,0,DPR,0,0);
  }
  resizeHolo();
  window.addEventListener('resize', resizeHolo, {passive:true});

  // Pre-generate particles
  const PC = 220;
  const px = new Float32Array(PC), py = new Float32Array(PC), pz = new Float32Array(PC),
        ps = new Float32Array(PC), po = new Float32Array(PC);
  for(let i=0;i<PC;i++){
    const th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1), r = 110+Math.random()*55;
    px[i]=r*Math.sin(ph)*Math.cos(th); py[i]=r*Math.sin(ph)*Math.sin(th); pz[i]=r*Math.cos(ph);
    ps[i]=Math.random()*2+.5; po[i]=Math.random();
  }

  let ang = 0, cmxI = 0, cmyI = 0, smx = 0, smy = 0;
  holo.addEventListener('mousemove', e => {
    const r = holo.getBoundingClientRect();
    cmxI = (e.clientX-r.left-r.width/2)/r.width*.25;
    cmyI = (e.clientY-r.top-r.height/2)/r.height*.25;
  }, {passive:true});

  function drawHolo(){
    holoCtx.clearRect(0,0,cw,ch);
    const cx = cw/2, cy = ch/2;
    smx += (cmxI-smx)*.04; smy += (cmyI-smy)*.04;

    // Core glow
    const g1 = holoCtx.createRadialGradient(cx,cy,0,cx,cy,80);
    g1.addColorStop(0,'rgba(249,115,22,.22)'); g1.addColorStop(.4,'rgba(249,115,22,.06)'); g1.addColorStop(1,'rgba(249,115,22,0)');
    holoCtx.fillStyle = g1;
    holoCtx.beginPath(); holoCtx.arc(cx,cy,80,0,Math.PI*2); holoCtx.fill();

    // Inner core
    const g2 = holoCtx.createRadialGradient(cx,cy,0,cx,cy,35);
    g2.addColorStop(0,'rgba(251,191,36,.35)'); g2.addColorStop(.6,'rgba(249,115,22,.1)'); g2.addColorStop(1,'rgba(249,115,22,0)');
    holoCtx.fillStyle = g2;
    holoCtx.beginPath(); holoCtx.arc(cx,cy,35,0,Math.PI*2); holoCtx.fill();

    // Orbital rings
    holoCtx.save(); holoCtx.translate(cx,cy);
    const a1 = ang+smx;
    holoCtx.strokeStyle='rgba(249,115,22,.3)'; holoCtx.lineWidth=1.2;
    holoCtx.beginPath(); holoCtx.ellipse(0,0,145,50,a1,0,Math.PI*2); holoCtx.stroke();
    holoCtx.strokeStyle='rgba(251,191,36,.18)'; holoCtx.lineWidth=.8;
    holoCtx.beginPath(); holoCtx.ellipse(0,0,170,65,-ang*.6+smy,0,Math.PI*2); holoCtx.stroke();
    holoCtx.strokeStyle='rgba(249,115,22,.08)'; holoCtx.lineWidth=.5;
    holoCtx.beginPath(); holoCtx.ellipse(0,0,195,78,ang*.3,0,Math.PI*2); holoCtx.stroke();
    holoCtx.restore();

    // Particles (batched)
    const cosA=Math.cos(ang+smx), sinA=Math.sin(ang+smx);
    const cosB=Math.cos(smy*.5), sinB=Math.sin(smy*.5);
    for(let i=0;i<PC;i++){
      let x=px[i]*cosA-pz[i]*sinA;
      let z=px[i]*sinA+pz[i]*cosA;
      let y=py[i]*cosB-z*sinB;
      z=py[i]*sinB+z*cosB;
      const sc=280/(280+z);
      const sx=cx+x*sc, sy=cy+y*sc;
      const op=clamp((z+180)/360,0,1)*.6;
      if(op<.05) continue;
      holoCtx.globalAlpha=op;
      holoCtx.fillStyle='#f97316';
      holoCtx.beginPath(); holoCtx.arc(sx,sy,ps[i]*sc,0,Math.PI*2); holoCtx.fill();
      if(po[i]>.88&&op>.25){
        holoCtx.globalAlpha=op*.12;
        holoCtx.strokeStyle='#f97316'; holoCtx.lineWidth=.4;
        holoCtx.beginPath(); holoCtx.moveTo(cx,cy); holoCtx.lineTo(sx,sy); holoCtx.stroke();
      }
    }
    holoCtx.globalAlpha=1;

    // Data stream rays
    for(let i=0;i<4;i++){
      const ra=ang*1.8+i*(Math.PI/2);
      const x1=cx+Math.cos(ra)*42, y1=cy+Math.sin(ra)*42*.38;
      const x2=cx+Math.cos(ra)*130, y2=cy+Math.sin(ra)*130*.38;
      const lg=holoCtx.createLinearGradient(x1,y1,x2,y2);
      lg.addColorStop(0,'rgba(249,115,22,.25)'); lg.addColorStop(1,'rgba(249,115,22,0)');
      holoCtx.strokeStyle=lg; holoCtx.lineWidth=.8;
      holoCtx.beginPath(); holoCtx.moveTo(x1,y1); holoCtx.lineTo(x2,y2); holoCtx.stroke();
    }

    ang += reduceMotion ? .0005 : .003;
    requestAnimationFrame(drawHolo);
  }
  drawHolo();
}

/*═══════════════════════════════════════
  FACE HOLOGRAM — 7-phase cycle
  Anatomically-placed wireframe face
═══════════════════════════════════════*/
const face = $('holoFace');
if (face) {
  const fctx = face.getContext('2d');
  const DPRf = Math.min(window.devicePixelRatio||1, 2);
  let fw = 0, fh = 0;

  function resizeFace(){
    const r = face.parentElement.getBoundingClientRect();
    fw = r.width; fh = r.height;
    face.width = fw*DPRf; face.height = fh*DPRf;
    face.style.width = fw+'px'; face.style.height = fh+'px';
    fctx.setTransform(DPRf,0,0,DPRf,0,0);
  }
  resizeFace();
  window.addEventListener('resize', resizeFace, {passive:true});

  // ── Vertices (x,y,z) — wajah manusia proporsional ──
  // Outline wajah (oval)
  const V = [];
  function addV(x,y,z){ V.push([x,y,z]); }
  // Lingkaran wajah — 24 titik
  for(let i=0;i<24;i++){
    const a = i/24*Math.PI*2;
    addV(Math.cos(a)*58, Math.sin(a)*72, 0);
  }
  // Mata kiri (5) & kanan (5)
  const eyeL = [[-20,-18,-4],[-12,-22,-6],[-6,-18,-4],[-8,-12,-2],[-16,-12,-2]];
  const eyeR = [[6,-18,-4],[12,-22,-6],[20,-18,-4],[16,-12,-2],[8,-12,-2]];
  eyeL.forEach(v=>addV(...v)); eyeR.forEach(v=>addV(...v));
  // Alis
  addV(-24,-28,-2); addV(-16,-32,-4); addV(-6,-30,-2);
  addV(6,-30,-2); addV(16,-32,-4); addV(24,-28,-2);
  // Hidung
  addV(0,-14,-2); addV(-4,-6,4); addV(0,2,8); addV(4,-6,4);
  // Mulut
  addV(-16,26,4); addV(-8,32,6); addV(0,34,6); addV(8,32,6); addV(16,26,4);
  addV(-10,40,2); addV(0,42,2); addV(10,40,2);
  // Dagu & pipi
  addV(-10,56,2); addV(0,62,0); addV(10,56,2);
  addV(-34,20,2); addV(34,20,2); addV(-38,40,0); addV(38,40,0);

  const V0 = 24; // offset: outline
  const E = [];
  function addE(a,b){ E.push([a,b]); }
  // Outline terhubung berurutan (lingkaran)
  for(let i=0;i<24;i++) addE(i, (i+1)%24);
  // Mata kiri
  addE(24,25); addE(25,26); addE(26,27); addE(27,28); addE(28,24);
  // Mata kanan
  addE(29,30); addE(30,31); addE(31,32); addE(32,33); addE(33,29);
  // Alis
  addE(34,35); addE(35,36); addE(37,38); addE(38,39);
  // Hidung
  addE(40,41); addE(41,42); addE(42,43); addE(43,40);
  addE(40,28); addE(43,32); // hidung ke mata
  // Mulut luar
  addE(44,45); addE(45,46); addE(46,47); addE(47,48); addE(48,44);
  // Mulut dalam
  addE(49,50); addE(50,51); addE(51,49);
  // Mulut ke pipi
  addE(44,49); addE(48,51);
  // Dagu
  addE(52,53); addE(53,54); addE(54,52);
  addE(52,21); addE(54,23); // dagu ke outline bawah
  // Pipi ke outline
  addE(55,16); addE(56,20);
  // Outline ke mata (tulang pipi)
  addE(55,28); addE(56,33);

  // ── Phase engine ──
  const PHASES = ['PARTICLE CONVERGENCE','FACIAL RECONSTRUCTION','NEURAL MAPPING','BIOMETRIC ANALYSIS','DIGITAL FRAGMENTATION','SYSTEM RECOVERY','HOLOGRAM ONLINE'];
  const PHASE_DUR = reduceMotion ? [10,8,10,8,6,6,10] : [3,2.5,3.5,3,2,2,3.5];
  const TOTAL_CYCLE = PHASE_DUR.reduce((a,b)=>a+b,0);
  let phase = 0, phaseTime = 0, cycleTime = 0, last = performance.now(), fps = 60;

  const hudStatus = $('hudStatus'), hudPhase = $('hudPhase'), hudVerts = $('hudVerts'),
        hudEdges = $('hudEdges'), hudFps = $('hudFps'), hudCycle = $('hudCycle'),
        phaseLabel = $('phaseLabel'), scanBeam = $('scanBeam');

  if (hudVerts) hudVerts.textContent = V.length;
  if (hudEdges) hudEdges.textContent = E.length;

  function showPhaseLabel(txt){
    if(!phaseLabel) return;
    phaseLabel.textContent = txt;
    phaseLabel.classList.add('show');
    setTimeout(()=>phaseLabel.classList.remove('show'), 1800);
  }

  function project(x,y,z,cx,cy,fov){
    const s = fov/(fov+z);
    return [cx+x*s*fov*.5, cy-y*s*fov*.5, s];
  }

  function drawFace(){
    const now = performance.now();
    const dt = Math.min((now-last)/1000, .1);
    last = now;
    fps = fps*.9 + (1/dt)*.1;
    if (hudFps) hudFps.textContent = Math.round(fps);

    cycleTime += dt;
    phaseTime += dt;
    if (phaseTime >= PHASE_DUR[phase]){
      phaseTime = 0;
      phase = (phase+1)%PHASES.length;
      if (hudStatus) hudStatus.textContent = PHASES[phase];
      if (hudPhase) hudPhase.textContent = PHASES[phase].split(' ')[0];
      showPhaseLabel(PHASES[phase]);
    }
    if (hudCycle) hudCycle.textContent = cycleTime.toFixed(1)+'s';
    if (cycleTime > TOTAL_CYCLE) cycleTime = 0;

    fctx.clearRect(0,0,fw,fh);
    const cx = fw/2, cy = fh/2, fov = Math.min(fw,fh)*.55;
    const pp = clamp(phaseTime/PHASE_DUR[phase], 0, 1);
    const rotY = performance.now()*.0004;

    // Phase 0: particles converge
    if (phase === 0){
      const target = V;
      for(let i=0;i<Math.min(target.length,80);i++){
        const t = target[i];
        const seed = (i*13)%100;
        const spread = (1-pp)*90;
        const sx = t[0]+Math.sin(seed+performance.now()*.002)*spread;
        const sy = t[1]+Math.cos(seed*.7+performance.now()*.002)*spread;
        const sz = t[2]+Math.sin(seed*.3)*spread*.3;
        const p = project(sx,sy,sz,cx,cy,fov);
        fctx.globalAlpha = clamp(pp,0,1)*.7;
        fctx.fillStyle = '#22d3ee';
        fctx.beginPath(); fctx.arc(p[0],p[1],1.5*p[2],0,Math.PI*2); fctx.fill();
      }
    }

    // Phases 1-6: wireframe
    if (phase >= 1){
      let build = 1;
      if (phase === 1) build = pp;            // wireframe build
      if (phase === 4) build = 1-pp;          // dissolve
      const showCount = Math.floor(E.length*build);

      // Rotate Y
      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const pts = V.map(v=>{
        const x = v[0]*cosY - v[2]*sinY;
        const z = v[0]*sinY + v[2]*cosY;
        return project(x, v[1], z, cx, cy, fov);
      });

      // Edges
      for(let i=0;i<showCount;i++){
        const e = E[i];
        const a = pts[e[0]], b = pts[e[1]];
        if (!a || !b) continue;
        fctx.globalAlpha = clamp(pp,0,1)*.5;
        fctx.strokeStyle = i%3===0 ? 'rgba(34,211,238,.7)' : 'rgba(249,115,22,.5)';
        fctx.lineWidth = .7;
        fctx.beginPath(); fctx.moveTo(a[0],a[1]); fctx.lineTo(b[0],b[1]); fctx.stroke();
      }

      // Vertices
      fctx.fillStyle = '#fbbf24';
      for(let i=0;i<pts.length;i++){
        fctx.globalAlpha = clamp(pp,0,1)*.8;
        fctx.beginPath(); fctx.arc(pts[i][0],pts[i][1],1.2*pts[i][2],0,Math.PI*2); fctx.fill();
      }
    }

    // Phase 2: neural mapping — scanline overlay
    if (phase === 2){
      const yLine = cy + (pp*2-1)*fh*.35;
      fctx.globalAlpha = .25;
      fctx.strokeStyle = '#22d3ee'; fctx.lineWidth = 1;
      fctx.beginPath(); fctx.moveTo(cx-90,yLine); fctx.lineTo(cx+90,yLine); fctx.stroke();
    }

    // Phase 3: biometric scan beam
    if (phase === 3 && scanBeam){
      scanBeam.style.opacity = '1';
      const scanY = cy - (pp*2-1)*fov*.5;
      scanBeam.style.top = (scanY-1)+'px';
      if (hudStatus) hudStatus.textContent = 'BIOMETRIC SCAN '+Math.round(pp*100)+'%';
    } else if (scanBeam) {
      scanBeam.style.opacity = '0';
    }

    // Phase 5: system recovery — flash
    if (phase === 5){
      fctx.globalAlpha = .08*Math.sin(pp*Math.PI);
      fctx.fillStyle = '#22d3ee';
      fctx.fillRect(0,0,fw,fh);
    }

    // Phase 6: full power — glow pulse
    if (phase === 6){
      const g = fctx.createRadialGradient(cx,cy,0,cx,cy,120);
      g.addColorStop(0,`rgba(34,211,238,${.15+.1*Math.sin(pp*Math.PI)})`);
      g.addColorStop(1,'rgba(34,211,238,0)');
      fctx.fillStyle = g;
      fctx.fillRect(0,0,fw,fh);
    }

    fctx.globalAlpha = 1;
    requestAnimationFrame(drawFace);
  }
  drawFace();
}

/*═══════════════════════════════════════
  DIGITAL HUMAN — speech & interaction
═══════════════════════════════════════*/
const hum = $('hum'), sp = $('sp'), humSt = $('humSt');
let speechTimer = null, autoSpeechTimer = null;

function showSpeech(txt){
  if(!sp) return;
  sp.innerHTML = txt+'<span class="sp-tp"><span></span><span></span><span></span></span>';
  sp.classList.add('show');
  clearTimeout(speechTimer);
  speechTimer = setTimeout(()=>sp.classList.remove('show'), 5500);
}

if (hum) {
  hum.addEventListener('click', ()=>{
    if (humSt) humSt.innerHTML = '<div class="pdot on" style="background:var(--or400)"></div>Speaking...';
    showSpeech(pick(SPEECHES));
    setTimeout(()=>{ if(humSt) humSt.innerHTML = '<div class="pdot on" style="background:var(--green)"></div>Listening...'; }, 3500);
  });
}

function startAutoSpeech(){
  clearInterval(autoSpeechTimer);
  autoSpeechTimer = setInterval(()=>{
    if (sp && !sp.classList.contains('show')) showSpeech(pick(SPEECHES));
  }, 18000);
}
startAutoSpeech();
setTimeout(()=>showSpeech(SPEECHES[0]), 2500);

// Pause auto-speech when hidden
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden) clearInterval(autoSpeechTimer);
  else startAutoSpeech();
});

/*═══════════════════════════════════════
  VIEW SWITCH — core vs swarm/memory/logs
═══════════════════════════════════════*/
document.querySelectorAll('.vs').forEach(v=>{
  v.addEventListener('click', ()=>{
    document.querySelectorAll('.vs').forEach(x=>x.classList.remove('on'));
    v.classList.add('on');
    const view = v.dataset.view;
    const viewHost = $('viewHost');

    if (view === 'core'){
      if (viewHost){ viewHost.classList.remove('show'); viewHost.innerHTML=''; }
      if (face) face.style.display = 'block';
      if (holo) holo.style.display = 'block';
      if (hudStatus) hudStatus.textContent = PHASES[phase] || 'STANDBY';
    } else {
      if (face) face.style.display = 'none';
      if (holo) holo.style.display = 'none';
      if (scanBeam) scanBeam.style.opacity = '0';
      if (hudStatus) hudStatus.textContent = 'STANDBY';
      if (viewHost){
        viewHost.classList.add('show');
        if (window.__MCViews && typeof window.__MCViews.render === 'function'){
          window.__MCViews.render(view, viewHost);
        }
      }
    }
  });
});

})();
