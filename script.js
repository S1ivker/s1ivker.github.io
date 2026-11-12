/* ============ WEBGL SHADER BACKGROUND ============ */
(function initShader() {
  const canvas = document.getElementById('shader-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    // WebGL недоступен — показываем fallback, выходим
    canvas.style.display = 'none';
    return;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  const vertSrc = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const fragSrc = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform vec2 u_mouse;

    // 2D hash + noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
        mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x),
        u.y
      );
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.05;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res.xy;
      vec2 p = (gl_FragCoord.xy * 2.0 - u_res.xy) / min(u_res.x, u_res.y);

      // мышь в нормализованных координатах
      vec2 m = (u_mouse * 2.0 - 1.0);
      m.x *= u_res.x / min(u_res.x, u_res.y);
      m.y *= u_res.y / min(u_res.x, u_res.y);

      float t = u_time * 0.18;

      // искажение от мыши
      float distToMouse = length(p - m);
      float mousePull = exp(-distToMouse * 1.6) * 0.35;

      // слоистый fbm
      vec2 q = vec2(0.0);
      q.x = fbm(p * 1.4 + vec2(t, 0.0));
      q.y = fbm(p * 1.4 + vec2(0.0, t));

      vec2 r = vec2(0.0);
      r.x = fbm(p * 1.8 + 4.0 * q + vec2(t * 1.2, t * 0.7));
      r.y = fbm(p * 1.8 + 4.0 * q + vec2(t * 0.7, t * 1.1));

      float f = fbm(p + r + mousePull);

      // палитра — тёмно-синий → голубой → циан
      vec3 c1 = vec3(0.01, 0.02, 0.05); // почти чёрный
      vec3 c2 = vec3(0.00, 0.10, 0.28); // глубокий синий
      vec3 c3 = vec3(0.00, 0.55, 0.95); // голубой
      vec3 c4 = vec3(0.00, 0.90, 1.00); // циан

      vec3 col = mix(c1, c2, smoothstep(0.0, 1.0, f));
      col = mix(col, c3, smoothstep(0.35, 0.85, f + 0.2 * r.x));
      col = mix(col, c4, smoothstep(0.75, 1.1, f + 0.4 * q.x) * 0.7);

      // лёгкий ореол вокруг мыши
      col += vec3(0.0, 0.5, 0.9) * mousePull * 0.6;

      // виньетка
      float vig = 1.0 - smoothstep(0.6, 1.5, length(p));
      col *= vig;

      // очень лёгкий «звёздный» шум
      float grain = hash(gl_FragCoord.xy + u_time * 60.0) * 0.04;
      col += grain;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('Shader compile error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) {
    canvas.style.display = 'none';
    return;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('Program link error:', gl.getProgramInfoLog(prog));
    canvas.style.display = 'none';
    return;
  }
  gl.useProgram(prog);

  // fullscreen quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1, -1, 1,
    -1,  1,  1, -1,  1, 1
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');

  let mouse = { x: 0.5, y: 0.5 };
  let targetMouse = { x: 0.5, y: 0.5 };

  window.addEventListener('mousemove', (e) => {
    targetMouse.x = e.clientX / window.innerWidth;
    targetMouse.y = 1.0 - e.clientY / window.innerHeight;
  });

  const start = performance.now();
  let raf;

  function render() {
    // плавно подтягиваем мышь
    mouse.x += (targetMouse.x - mouse.x) * 0.05;
    mouse.y += (targetMouse.y - mouse.y) * 0.05;

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (performance.now() - start) / 1000.0);
    gl.uniform2f(uMouse, mouse.x, mouse.y);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    raf = requestAnimationFrame(render);
  }

  // при первом кадре показываем плавно
  requestAnimationFrame(() => {
    canvas.classList.add('ready');
    // и прячем старый fallback, чтоб не тратить CPU
    const fallback = document.getElementById('bg-canvas');
    if (fallback) fallback.classList.add('hidden');
    render();
  });

  // пауза когда таб неактивен (экономит батарею)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      render();
    }
  });
})();
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
  window.dispatchEvent(new Event('langchange'));
}
document.querySelectorAll('.lang-switch button').forEach(b => {
  b.addEventListener('click', () => applyLang(b.dataset.lang));
});

/* ============ REVEAL + GLITCH ============ */
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      // если это заголовок секции — запускаем глитч
      if (e.target.classList.contains('section-title')) {
        triggerGlitch(e.target);
      }
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reveal, .section-title').forEach(el => observer.observe(el));

function triggerGlitch(el) {
  // обновляем data-text на случай смены языка
  el.setAttribute('data-text', el.textContent);
  el.classList.remove('glitch');
  void el.offsetWidth; // рефлоу чтоб анимация перезапустилась
  el.classList.add('glitch');
  setTimeout(() => el.classList.remove('glitch'), 450);
}

// при смене языка — обновить data-text у заголовков
window.addEventListener('langchange', () => {
  document.querySelectorAll('.section-title').forEach(el => {
    el.setAttribute('data-text', el.textContent);
  });
});

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
