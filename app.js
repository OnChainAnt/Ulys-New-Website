// ============================================================
// Ulys landing — interactions
// ============================================================

/* ---- Light / dark theme toggle ---- */
(function theme() {
  const root = document.documentElement;
  const KEY = 'ulys-theme';
  // Editorial redesign: LIGHT is the default; toggle switches to a dark variant.
  function apply(t) {
    if (t === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }
  // sync with any stored preference (init script already ran in <head>)
  try { apply(localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'); } catch (e) { /* ignore */ }
  // the toggle may be injected by partials.js, so bind on any click
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#themeToggle');
    if (!btn) return;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (err) { /* ignore */ }
  });
})();

/* ---- LightRays background (React Bits @react-bits/LightRays) -------------
   Vanilla raw-WebGL port of the ogl component: same vertex/fragment shaders,
   same props. Light rays fan out from the top-center over the hero. */
(function lightRays() {
  const container = document.getElementById('lightRays');
  if (!container) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.appendChild(canvas);
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
  if (!gl) { container.style.display = 'none'; return; }

  // props (exactly the config requested)
  const config = {
    raysOrigin: 'top-center', raysColor: '#ffffff', raysSpeed: 1,
    lightSpread: 1, rayLength: 2, pulsating: false, fadeDistance: 1,
    saturation: 1, followMouse: true, mouseInfluence: 0.1,
    noiseAmount: 0, distortion: 0,
  };
  const hexToRgb = (hex) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
  };
  const getAnchorAndDir = (origin, w, h) => {
    const o = 0.2;
    switch (origin) {
      case 'top-left': return { anchor: [0, -o * h], dir: [0, 1] };
      case 'top-right': return { anchor: [w, -o * h], dir: [0, 1] };
      case 'left': return { anchor: [-o * w, 0.5 * h], dir: [1, 0] };
      case 'right': return { anchor: [(1 + o) * w, 0.5 * h], dir: [-1, 0] };
      case 'bottom-left': return { anchor: [0, (1 + o) * h], dir: [0, -1] };
      case 'bottom-center': return { anchor: [0.5 * w, (1 + o) * h], dir: [0, -1] };
      case 'bottom-right': return { anchor: [w, (1 + o) * h], dir: [0, -1] };
      default: return { anchor: [0.5 * w, -o * h], dir: [0, 1] };
    }
  };

  const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  const frag = `precision highp float;
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
uniform float uRainbow;
varying vec2 vUv;
float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}
vec3 hue2rgb(float h) {
  vec3 p = abs(fract(h + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return clamp(p - 1.0, 0.0, 1.0);
}
float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);
  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;
  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );
  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }
  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);
  fragColor = rays1 * 0.5 + rays2 * 0.4;
  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }
  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;
  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }
  fragColor.rgb *= raysColor;
  // light-mode: recolor the rays as a soft rainbow gradient across the fan
  if (uRainbow > 0.5) {
    float s = clamp(rays1.a * 0.5 + rays2.a * 0.4, 0.0, 1.0);
    float hue = coord.x / iResolution.x;
    vec3 rc = mix(vec3(1.0), hue2rgb(hue), 0.55); // pastel / soft
    fragColor = vec4(rc * s, s * 0.9);
  }
}
void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('LightRays shader:', gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error('LightRays link:', gl.getProgramInfoLog(prog)); container.style.display = 'none'; return; }
  gl.useProgram(prog);

  // fullscreen triangle
  const posLoc = gl.getAttribLocation(prog, 'position');
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['iTime', 'iResolution', 'rayPos', 'rayDir', 'raysColor', 'raysSpeed', 'lightSpread', 'rayLength', 'pulsating', 'fadeDistance', 'saturation', 'mousePos', 'mouseInfluence', 'noiseAmount', 'distortion', 'uRainbow'].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

  gl.uniform3fv(U.raysColor, hexToRgb(config.raysColor));
  gl.uniform1f(U.raysSpeed, config.raysSpeed);
  gl.uniform1f(U.lightSpread, config.lightSpread);
  gl.uniform1f(U.rayLength, config.rayLength);
  gl.uniform1f(U.pulsating, config.pulsating ? 1.0 : 0.0);
  gl.uniform1f(U.fadeDistance, config.fadeDistance);
  gl.uniform1f(U.saturation, config.saturation);
  gl.uniform1f(U.mouseInfluence, config.mouseInfluence);
  gl.uniform1f(U.noiseAmount, config.noiseAmount);
  gl.uniform1f(U.distortion, config.distortion);

  // rainbow rays in light mode; plain rays in dark. Re-applies on theme toggle.
  const isLight = () => document.documentElement.getAttribute('data-theme') === 'light';
  const applyTheme = () => { gl.useProgram(prog); gl.uniform1f(U.uRainbow, isLight() ? 1.0 : 0.0); };
  applyTheme();
  new MutationObserver(() => { applyTheme(); render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    const wCSS = container.clientWidth, hCSS = container.clientHeight;
    const w = Math.max(1, Math.floor(wCSS * dpr)), h = Math.max(1, Math.floor(hCSS * dpr));
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.iResolution, w, h);
    const { anchor, dir } = getAnchorAndDir(config.raysOrigin, w, h);
    gl.uniform2f(U.rayPos, anchor[0], anchor[1]);
    gl.uniform2f(U.rayDir, dir[0], dir[1]);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  const mouse = { x: 0.5, y: 0.5 }, smooth = { x: 0.5, y: 0.5 };
  if (config.followMouse) {
    window.addEventListener('mousemove', (e) => {
      const r = container.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width;
      mouse.y = (e.clientY - r.top) / r.height;
    }, { passive: true });
  }

  gl.clearColor(0, 0, 0, 0);
  const render = () => { gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3); };

  if (reduce) {
    gl.uniform1f(U.iTime, 1.0);
    gl.uniform2f(U.mousePos, 0.5, 0.5);
    render();
  } else {
    const frame = (t) => {
      gl.uniform1f(U.iTime, t * 0.001);
      if (config.followMouse && config.mouseInfluence > 0.0) {
        const s = 0.92;
        smooth.x = smooth.x * s + mouse.x * (1 - s);
        smooth.y = smooth.y * s + mouse.y * (1 - s);
        gl.uniform2f(U.mousePos, smooth.x, smooth.y);
      }
      render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
})();

/* ---- AI command bar: rotating examples + interactive order builder ---- */
(function commandBar() {
  const el = document.getElementById('typed');
  if (!el) return;

  const idle = document.getElementById('commandIdle');
  const builder = document.getElementById('builder');
  const orderCard = document.getElementById('orderCard');
  const tryBtn = document.getElementById('tryIt');
  const caret = document.querySelector('.caret');
  const cmd = document.getElementById('command');
  const send = document.getElementById('commandSend');

  // ----- idle: rotating conditional-order examples -----
  const examples = [
    'Buy $50 of ETH if the Clarity Act passes by end of 2026',
    'Buy $250 of PENGU if SpaceX lands on Mars by 2027',
    'Buy $100 of BTC when it drops 8%',
    'Buy $15 of SOL every Friday',
  ];
  let p = 0, i = 0, deleting = false, typingTimer = null, typingOn = true;

  function tick() {
    if (!typingOn) return;
    const word = examples[p];
    if (!deleting) {
      el.textContent = word.slice(0, ++i);
      if (i === word.length) { deleting = true; typingTimer = setTimeout(tick, 2200); return; }
    } else {
      el.textContent = word.slice(0, --i);
      if (i === 0) { deleting = false; p = (p + 1) % examples.length; }
    }
    typingTimer = setTimeout(tick, deleting ? 24 : 46 + Math.random() * 34);
  }
  function stopTyping() { typingOn = false; clearTimeout(typingTimer); if (caret) caret.style.display = 'none'; }
  function startTyping() { typingOn = true; if (caret) caret.style.display = ''; i = 0; deleting = false; el.textContent = ''; tick(); }
  tick();

  // ----- interactive builder -----
  const NAMES = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', PENGU: 'Pengu', SPCX: 'SpaceX' };
  const steps = [
    { key: 'action', label: 'Do what?', options: [
      { v: 'Buy', dot: '#0be0ed' }, { v: 'Sell', dot: '#f0322e' } ] },
    { key: 'token', label: 'With what?', options: ['BTC', 'ETH', 'SOL', 'PENGU', 'SPCX'].map((v) => ({ v })) },
    { key: 'amount', label: 'How much?', options: ['$15', '$50', '$100', '$250', '$500'].map((v) => ({ v })) },
    { key: 'when', label: 'When?', options: [
      'when it drops 8%', 'if the Clarity Act passes by end of 2026', 'every Friday', 'if SpaceX lands on Mars by 2027' ].map((v) => ({ v })) },
  ];
  const pick = {};
  let stepIdx = 0;

  const label = document.getElementById('builderLabel');
  const chips = document.getElementById('builderChips');
  const stepEl = document.getElementById('builderStep');
  const backBtn = document.getElementById('builderBack');
  const restartBtn = document.getElementById('builderRestart');

  function sentence() {
    let s = pick.action || '';
    if (pick.amount) s += ` ${pick.amount} of`;
    if (pick.token) s += ` ${pick.token}`;
    if (pick.when) s += ` ${pick.when}`;
    return s.trim();
  }

  function renderStep() {
    const step = steps[stepIdx];
    label.textContent = step.label;
    stepEl.textContent = `${stepIdx + 1} of 4`;
    backBtn.style.visibility = stepIdx === 0 ? 'hidden' : 'visible';
    chips.innerHTML = '';
    step.options.forEach((opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'builder-chip';
      b.innerHTML = opt.dot ? `<span class="chip-dot" style="background:${opt.dot}"></span>${opt.v}` : opt.v;
      b.addEventListener('click', () => choose(opt.v));
      chips.appendChild(b);
    });
  }

  function choose(v) {
    pick[steps[stepIdx].key] = v;
    el.textContent = sentence();
    if (stepIdx < steps.length - 1) { stepIdx++; renderStep(); }
    else finish();
  }

  function enterBuilder() {
    stopTyping();
    for (const k in pick) delete pick[k];
    stepIdx = 0;
    el.textContent = '';
    idle.hidden = true;
    orderCard.hidden = true;
    builder.hidden = false;
    restartBtn.hidden = true;
    tryBtn.classList.add('is-active');
    renderStep();
    cmd.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function finish() {
    el.textContent = sentence();
    label.textContent = 'Ready when you are.';
    chips.innerHTML = '';
    stepEl.textContent = '4 of 4';
    backBtn.style.visibility = 'visible';
    restartBtn.hidden = false;
    // fill + show the summary card
    document.getElementById('ocLabel').textContent = `${(pick.action || 'Buy').toUpperCase()} ${(NAMES[pick.token] || pick.token || '').toUpperCase()}`;
    document.getElementById('ocAmount').textContent = pick.amount || '';
    document.getElementById('ocCond').textContent = (pick.when || '').replace(/^if /, '').replace(/^when /, '');
    document.getElementById('ocToken').textContent = pick.token || '';
    orderCard.hidden = false;
  }

  function exitBuilder() {
    builder.hidden = true;
    orderCard.hidden = true;
    idle.hidden = false;
    tryBtn.classList.remove('is-active');
    startTyping();
  }

  backBtn.addEventListener('click', () => {
    orderCard.hidden = true;
    if (stepIdx === 0) { exitBuilder(); return; }
    delete pick[steps[stepIdx].key];
    stepIdx--;
    delete pick[steps[stepIdx].key];
    el.textContent = sentence();
    restartBtn.hidden = true;
    renderStep();
  });
  restartBtn.addEventListener('click', enterBuilder);
  tryBtn.addEventListener('click', () => (builder.hidden ? enterBuilder() : exitBuilder()));
  if (send) send.addEventListener('click', () => { if (builder.hidden) enterBuilder(); });
})();

/* ---- Scroll reveal ---- */
(function reveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    els.forEach((e) => e.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  els.forEach((e) => io.observe(e));
})();

/* ---- Nav: scroll-reactive condense (ported from UlysTreasury Nav.tsx) ----
   Full-width pill at the very top; once you scroll down past the threshold it
   collapses to a compact centered logo pill and stays there, re-expanding only
   when you return to the top. Hysteresis (80 down / 20 up) prevents flicker. */
(function nav() {
  const nav = document.getElementById('siteNav');
  if (!nav) return;
  let condensed = false;
  const onScroll = () => {
    const y = window.scrollY;
    if (!condensed && y > 80) { condensed = true; nav.classList.add('is-condensed'); }
    else if (condensed && y < 20) { condensed = false; nav.classList.remove('is-condensed'); }
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();
