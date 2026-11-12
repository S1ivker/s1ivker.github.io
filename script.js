/* ============ CUSTOM CURSOR ============ */
const cursorDot = document.querySelector('.cursor-dot');
const cursorRing = document.querySelector('.cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursorDot.style.left = mx + 'px';
  cursorDot.style.top  = my + 'px';
});

function animRing() {
  rx += (mx - rx) * 0.18;
  ry += (my - ry) * 0.18;
  cursorRing.style.left = rx + 'px';
  cursorRing.style.top  = ry + 'px';
  requestAnimationFrame(animRing);
}
animRing();

document.querySelectorAll('a, button, input').forEach(el => {
  el.addEventListener('mouseenter', () => cursorRing.classList.add('hover'));
  el.addEventListener('mouseleave', () => cursorRing.classList.remove('hover'));
});

/* ============ PARTICLE BACKGROUND ============ */
const bg = document.getElementById('bg-canvas');
const bctx = bg.getContext('2d');
let particles = [];
let pmx = window.innerWidth / 2, pmy = window.innerHeight / 2;

function resizeBg() {
  bg.width = window.innerWidth;
  bg.height = window.innerHeight;
}
resizeBg();
window.addEventListener('resize', resizeBg);

document.addEventListener('mousemove', e => { pmx = e.clientX; pmy = e.clientY; });

for (let i = 0; i < 90; i++) {
  particles.push({
    x: Math.random() * bg.width,
    y: Math.random() * bg.height,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    r: Math.random() * 1.6 + 0.4
  });
}

function drawParticles() {
  bctx.clearRect(0, 0, bg.width, bg.height);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > bg.width) p.vx *= -1;
    if (p.y < 0 || p.y > bg.height) p.vy *= -1;

    const dx = p.x - pmx, dy = p.y - pmy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const near = dist < 160;

    bctx.beginPath();
    bctx.arc(p.x, p.y, p.r + (near ? 1.2 : 0), 0, Math.PI * 2);
    bctx.fillStyle = near ? 'rgba(0,229,255,0.9)' : 'rgba(0,180,255,0.5)';
    bctx.shadowBlur = near ? 14 : 6;
    bctx.shadowColor = '#00e5ff';
    bctx.fill();
    bctx.shadowBlur = 0;

    for (let j = i + 1; j < particles.length; j++) {
      const q = particles[j];
      const dx2 = p.x - q.x, dy2 = p.y - q.y;
      const d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      if (d < 110) {
        bctx.strokeStyle = `rgba(0,180,255,${0.14 - d / 900})`;
        bctx.lineWidth = 0.5;
        bctx.beginPath();
        bctx.moveTo(p.x, p.y);
        bctx.lineTo(q.x, q.y);
        bctx.stroke();
      }
    }
  }
  requestAnimationFrame(drawParticles);
}
drawParticles();

/* ============ PRELOADER ============ */
const preloader = document.getElementById('preloader');
const preFill = document.getElementById('pre-fill');
const prePercent = document.getElementById('pre-percent');
const skipBtn = document.getElementById('skip-btn');

let loaded = false, progress = 0;

function startPreloader() {
  const iv = setInterval(() => {
    progress += Math.random() * 8 + 3;
    if (progress >= 100) { progress = 100; clearInterval(iv); setTimeout(finishLoad, 300); }
    preFill.style.width = progress + '%';
    prePercent.textContent = Math.floor(progress);
  }, 90);
}

function finishLoad() {
  if (loaded) return;
  loaded = true;
  preloader.classList.add('hidden');
  document.querySelectorAll('#hero .reveal').forEach(el => el.classList.add('visible'));
  startTerminal();
  animateCounters();
}

skipBtn.addEventListener('click', finishLoad);
startPreloader();

/* ============ TERMINAL TYPE ============ */
function startTerminal() {
  const el = document.getElementById('terminal-text');
  const lang = document.documentElement.lang || 'ru';
  const txt = (window.LOCALES[lang] && window.LOCALES[lang].terminal) || '';
  let i = 0;
  el.textContent = '';
  const iv = setInterval(() => {
    el.textContent += txt[i] || '';
    i++;
    if (i > txt.length) clearInterval(iv);
  }, 45);
}

/* ============ COUNTERS ============ */
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    let n = 0;
    const step = Math.max(1, target / 50);
    const iv = setInterval(() => {
      n += step;
      if (n >= target) { n = target; clearInterval(iv); }
      el.textContent = Math.floor(n);
    }, 20);
  });
}

/* ============ LANG ============ */
function applyLang(lang) {
  const pack = window.LOCALES[lang];
  if (!pack) return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (pack[k]) el.textContent = pack[k];
  });
  document.querySelectorAll('.lang-switch button').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
  });
  document.documentElement.lang = lang === 'es' ? 'es' : lang;
  startTerminal();
}
document.querySelectorAll('.lang-switch button').forEach(b => {
  b.addEventListener('click', () => applyLang(b.dataset.lang));
});

/* ============ REVEAL ============ */
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

document.getElementById('year').textContent = new Date().getFullYear();

/* ============ GAME 1: REACTION ============ */
const reactionBtn = document.getElementById('reaction-btn');
const reactionResult = document.getElementById('reaction-result');
let reactionState = 'idle';
let reactionTimeout, reactionStart;

reactionBtn.addEventListener('click', () => {
  const lang = document.documentElement.lang;
  const startLabel = (window.LOCALES[lang] && window.LOCALES[lang].game1_start) || 'START';
  if (reactionState === 'idle') {
    reactionState = 'waiting';
    reactionBtn.classList.remove('ready', 'too-soon');
    reactionBtn.textContent = '...';
    const delay = 1200 + Math.random() * 3000;
    reactionTimeout = setTimeout(() => {
      reactionState = 'ready';
      reactionBtn.classList.add('ready');
      reactionBtn.textContent = '!!!';
      reactionStart = Date.now();
    }, delay);
  } else if (reactionState === 'waiting') {
    clearTimeout(reactionTimeout);
    reactionState = 'idle';
    reactionBtn.classList.add('too-soon');
    reactionBtn.textContent = startLabel;
    reactionResult.textContent = '⏱ too soon';
    reactionResult.style.color = '#ff1744';
  } else if (reactionState === 'ready') {
    const time = Date.now() - reactionStart;
    reactionState = 'idle';
    reactionBtn.classList.remove('ready');
    reactionBtn.textContent = startLabel;
    reactionResult.textContent = `⚡ ${time} ms`;
    reactionResult.style.color = '#00e5ff';
  }
});

/* ============ GAME 2: GUESS ============ */
let secretNumber = Math.floor(Math.random() * 100) + 1;
let guessAttempts = 0;
const guessInput = document.getElementById('guess-input');
const guessBtn = document.getElementById('guess-btn');
const guessResult = document.getElementById('guess-result');

guessBtn.addEventListener('click', () => {
  const val = parseInt(guessInput.value);
  if (!val || val < 1 || val > 100) {
    guessResult.textContent = '1–100';
    guessResult.style.color = '#ff1744';
    return;
  }
  guessAttempts++;
  if (val === secretNumber) {
    guessResult.textContent = `🎉 WIN · ${guessAttempts}`;
    guessResult.style.color = '#00e676';
    setTimeout(() => {
      secretNumber = Math.floor(Math.random() * 100) + 1;
      guessAttempts = 0;
      guessInput.value = '';
      guessResult.textContent = '';
    }, 2500);
  } else if (val < secretNumber) {
    guessResult.textContent = `📈 higher · ${guessAttempts}`;
    guessResult.style.color = '#00b4ff';
  } else {
    guessResult.textContent = `📉 lower · ${guessAttempts}`;
    guessResult.style.color = '#00b4ff';
  }
  guessInput.value = '';
  guessInput.focus();
});
guessInput.addEventListener('keypress', e => { if (e.key === 'Enter') guessBtn.click(); });

/* ============ GAME 3: CATCH NODE ============ */
const cCanvas = document.getElementById('catch-canvas');
const cctx = cCanvas.getContext('2d');
const catchBtn = document.getElementById('catch-btn');
const catchResult = document.getElementById('catch-result');

let catchRunning = false;
let catchTime = 0;
let catchScore = 0;
let nodeX = 0, nodeY = 0;
let nodeR = 14;
let mouseInCanvas = false;
let catchTimer, catchSpawner;
let cmx = -999, cmy = -999;

function spawnNode() {
  nodeR = 12 + Math.random() * 6;
  nodeX = 30 + Math.random() * (cCanvas.width - 60);
  nodeY = 30 + Math.random() * (cCanvas.height - 60);
}

cCanvas.addEventListener('mousemove', e => {
  const r = cCanvas.getBoundingClientRect();
  cmx = (e.clientX - r.left) * (cCanvas.width / r.width);
  cmy = (e.clientY - r.top)  * (cCanvas.height / r.height);
});
cCanvas.addEventListener('mouseleave', () => { cmx = -999; cmy = -999; });

function drawCatch() {
  cctx.clearRect(0, 0, cCanvas.width, cCanvas.height);

  const grad = cctx.createRadialGradient(nodeX, nodeY, 0, nodeX, nodeY, nodeR * 3);
  grad.addColorStop(0, 'rgba(0,229,255,0.7)');
  grad.addColorStop(1, 'rgba(0,180,255,0)');
  cctx.fillStyle = grad;
  cctx.beginPath();
  cctx.arc(nodeX, nodeY, nodeR * 3, 0, Math.PI * 2);
  cctx.fill();

  cctx.beginPath();
  cctx.arc(nodeX, nodeY, nodeR, 0, Math.PI * 2);
  cctx.fillStyle = '#00e5ff';
  cctx.shadowBlur = 20;
  cctx.shadowColor = '#00e5ff';
  cctx.fill();
  cctx.shadowBlur = 0;

  if (catchRunning) {
    const dx = cmx - nodeX, dy = cmy - nodeY;
    if (Math.sqrt(dx * dx + dy * dy) < nodeR + 6) {
      catchScore++;
      spawnNode();
    }
  }

  if (catchRunning) {
    catchResult.textContent = `⏱ ${catchTime}s · ★ ${catchScore}`;
    catchResult.style.color = '#00e5ff';
  }
  requestAnimationFrame(drawCatch);
}

catchBtn.addEventListener('click', () => {
  if (catchRunning) return;
  catchRunning = true;
  catchTime = 15;
  catchScore = 0;
  catchBtn.disabled = true;
  spawnNode();
  clearInterval(catchTimer);
  clearInterval(catchSpawner);
  catchTimer = setInterval(() => {
    catchTime--;
    if (catchTime <= 0) endCatch();
  }, 1000);
  catchSpawner = setInterval(() => { if (catchRunning) spawnNode(); }, 1400);
});

function endCatch() {
  catchRunning = false;
  clearInterval(catchTimer);
  clearInterval(catchSpawner);
  catchBtn.disabled = false;
  catchResult.textContent = `DONE · ★ ${catchScore}`;
  catchResult.style.color = '#00e676';
}

drawCatch();
