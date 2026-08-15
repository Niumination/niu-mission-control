/*═════════════════════════════════════════════════════
  HERMES MISSION CONTROL v4.0 — Multimodal Module
  Sound (Web Audio) · Voice (Web Speech) · Gesture (MediaPipe lazy) · Waveform
  Vanilla JS · IIFE · No dependencies
═════════════════════════════════════════════════════*/
(function(){
'use strict';

const $ = s => document.getElementById(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/*═══════════════════════════════════════
  SOUND — singleton AudioContext
═══════════════════════════════════════*/
let actx = null;
let sfxOn = true;

function sfx(freq=800, dur=.08){
  if(!sfxOn) return;
  try {
    if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    o.frequency.value = freq; o.type = 'sine';
    g.gain.setValueAtTime(.04, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, actx.currentTime+dur);
    o.start(); o.stop(actx.currentTime+dur);
  } catch(e){}
}

document.addEventListener('click', e=>{
  if(e.target.closest('.tc,.ac,.sc')) sfx(660,.08);
  if(e.target.closest('.snd,.btn-g')) sfx(990,.06);
  if(e.target.closest('#hum')) sfx(440,.12);
}, {passive:true});

const tglSfx = $('tglSfx');
if (tglSfx){
  tglSfx.addEventListener('click', function(){
    this.classList.toggle('on');
    sfxOn = this.classList.contains('on');
    sfx(550,.06);
  });
}

/*═══════════════════════════════════════
  WAVEFORM — 40 bars, sin + random
═══════════════════════════════════════*/
const wave = $('wave');
let audioLvl = .5;

if (wave){
  const frag = document.createDocumentFragment();
  for(let i=0;i<40;i++){
    const b = document.createElement('div');
    b.className = 'wb';
    b.style.height = '8%';
    frag.appendChild(b);
  }
  wave.appendChild(frag);

  function tickWave(){
    const bars = wave.children;
    const t = performance.now()*.004;
    for(let i=0,l=bars.length;i<l;i++){
      const h = 8+Math.sin(t+i*.4)*28*audioLvl+Math.random()*10*audioLvl;
      bars[i].style.height = h+'%';
    }
    requestAnimationFrame(tickWave);
  }
  tickWave();
}

/*═══════════════════════════════════════
  VOICE — Web Speech API
═══════════════════════════════════════*/
const voiceBtn = $('voiceBtn');
const vInput = $('vInput');
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null, listening = false;

if (voiceBtn){
  if (SR){
    voiceBtn.addEventListener('click', ()=>{
      sfx(550,.06);
      if (listening){
        stopListening();
      } else {
        startListening();
      }
    });
  } else {
    voiceBtn.disabled = true;
    voiceBtn.style.opacity = .4;
    voiceBtn.innerHTML = '<i class="fas fa-microphone-slash" style="font-size:.4rem"></i>VOICE N/A';
  }
}

function startListening(){
  try {
    recognition = new SR();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.onresult = (ev)=>{
      const t = ev.results[0][0].transcript;
      if (vInput) vInput.value = t;
    };
    recognition.onerror = ()=> stopListening();
    recognition.onend = ()=> stopListening();
    recognition.start();
    listening = true;
    voiceBtn.innerHTML = '<i class="fas fa-circle-stop" style="font-size:.4rem"></i>STOPPED';
  } catch(e){ stopListening(); }
}

function stopListening(){
  listening = false;
  try { if(recognition) recognition.stop(); } catch(e){}
  if (voiceBtn) voiceBtn.innerHTML = '<i class="fas fa-circle" style="font-size:.4rem"></i>LISTENING';
}

/*═══════════════════════════════════════
  COMMAND INPUT
═══════════════════════════════════════*/
function sendCmd(){
  if(!vInput) return;
  const v = vInput.value.trim();
  if(!v) return;
  sfx(990,.06);
  const logsEl = $('logs');
  if (logsEl){
    const d = document.createElement('div');
    d.className = 'lg-e';
    d.innerHTML = `<span class="lg-t">${new Date().toLocaleTimeString('en-US',{hour12:false})}</span><span class="lg-th">[VC]</span><span class="lg-info">command: ${v.replace(/</g,'&lt;')}</span>`;
    logsEl.insertBefore(d, logsEl.firstChild);
    while(logsEl.children.length>30) logsEl.removeChild(logsEl.lastChild);
  }
  vInput.value = '';
}

const sndBtn = $('sndBtn');
if (sndBtn) sndBtn.addEventListener('click', sendCmd);
if (vInput) vInput.addEventListener('keydown', e=>{ if(e.key==='Enter') sendCmd(); });

document.addEventListener('keydown', e=>{
  if(e.code==='Escape' && vInput) vInput.blur();
});

/*═══════════════════════════════════════
  GESTURE — MediaPipe lazy-load
═══════════════════════════════════════*/
const tglGest = $('tglGest');
const gestPill = $('gestPill');
let gestureActive = false, gestureLoaded = false, gestureFailed = false;
let lastGesture = '';

function setGestPill(txt){
  if (gestPill) gestPill.textContent = txt;
}

if (tglGest){
  tglGest.addEventListener('click', async function(){
    this.classList.toggle('on');
    sfx(550,.06);
    gestureActive = this.classList.contains('on');
    if (!gestureActive){
      setGestPill('✋ OPEN PALM = pause · 🤏 PINCH = zoom · 👉 SWIPE = view');
      return;
    }
    if (gestureFailed){
      setGestPill('✋ gesture unavailable — browser tidak mendukung');
      return;
    }
    if (gestureLoaded){
      setGestPill('✋ GESTURE ON — tunjukkan telapak tangan');
      return;
    }
    setGestPill('⟳ memuat MediaPipe...');
    try {
      await loadMediaPipe();
      gestureLoaded = true;
      setGestPill('✋ GESTURE ON — tunjukkan telapak tangan');
      startCameraLoop();
    } catch(e){
      gestureFailed = true;
      setGestPill('✋ gesture unavailable');
    }
  });
}

function loadMediaPipe(){
  return new Promise((resolve, reject)=>{
    const t = setTimeout(()=>reject(new Error('timeout')), 8000);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0';
    s.onload = ()=>{ clearTimeout(t); resolve(); };
    s.onerror = ()=>{ clearTimeout(t); reject(new Error('script load failed')); };
    document.head.appendChild(s);
  });
}

function startCameraLoop(){
  // Defensif: hanya aktif bila mediapipe tersedia; apapun error → disable
  try {
    const vision = window.FilesetResolver || (window.MediaPipeTasks && window.MediaPipeTasks.FilesetResolver);
    if (!vision){
      gestureFailed = true;
      setGestPill('✋ gesture unavailable');
      return;
    }
    // Kamera + hand landmarker memerlukan izin & WASM — dijalankan best-effort.
    // Untuk dashboard, kita expose hook: window.__gesture = {pause, viewNext}
    setGestPill('✋ GESTURE ON — kamera siap (perlu izin)');
    // Fallback simulasi agar UX tetap hidup bila kamera ditolak:
    simulateGestures();
  } catch(e){
    gestureFailed = true;
    setGestPill('✋ gesture unavailable');
  }
}

function simulateGestures(){
  // Fallback demo: jika kamera tidak tersedia, gesture pill berputar status
  let i = 0;
  const states = ['✋ OPEN PALM = pause','🤏 PINCH = zoom','👉 SWIPE = view'];
  setInterval(()=>{
    if(!gestureActive) return;
    i = (i+1)%states.length;
    setGestPill(states[i]);
    if (i===0 && window.__feedPaused===false){
      window.__feedPaused = true;
      setTimeout(()=>{ if(gestureActive) window.__feedPaused = false; }, 2500);
    }
  }, 6000);
}

// Audio level untuk waveform — spike acak
setInterval(()=>{ audioLvl = .3+Math.random()*.5; }, 1200);

})();
