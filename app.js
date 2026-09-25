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

/* ---- Faithful, interactive rebuild of the Ulys smart-order flow ---- */
(function uapp() {
  const root = document.getElementById('uapp');
  if (!root) return;
  const $ = (id) => document.getElementById(id);
  const scCompose = $('scCompose'), scCard = $('scCard'), scDone = $('scDone');
  const composeText = $('composeText'), assetRow = $('assetRow'), suggestRow = $('suggestRow');
  const sendBtn = $('composeSend'), hint = $('composeHint');

  const AMOUNTS = ['$15', '$50', '$100', '$250', '$500'];
  const CONDS = [
    { t: 'Clarity Act (H.R.3633) signed into law in 2026', o: 6 },
    { t: 'Bitcoin reaches $150,000 by Dec 31, 2026', o: 12 },
    { t: 'Fed cuts rates before March 2026', o: 41 },
    { t: 'SpaceX lands on Mars by 2027', o: 3 },
  ];
  const order = { name: '', sym: '', amount: '', cond: '', odds: 6, reach: 10, mode: 'odds' };
  let stage = 'asset';

  const clearSuggest = () => { suggestRow.innerHTML = ''; suggestRow.className = 'uapp-suggest'; };
  function chipRow(items, fn) {
    clearSuggest(); suggestRow.className = 'uapp-suggest row';
    items.forEach((it) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'uasset'; b.textContent = it;
      b.addEventListener('click', () => fn(it));
      suggestRow.appendChild(b);
    });
  }
  function condList() {
    clearSuggest();
    CONDS.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'usuggest';
      b.innerHTML = `<span>${c.t}</span><span class="odds">${c.o}% odds</span>`;
      b.addEventListener('click', () => pickCond(c));
      suggestRow.appendChild(b);
    });
  }
  const setText = () => {
    let s = 'Buy ';
    if (order.name) s += order.name + ' ';
    if (order.amount) s += order.amount + ' ';
    if (order.cond) s += 'if ' + order.cond;
    composeText.textContent = s;
  };

  // step 1: asset
  assetRow.querySelectorAll('.uasset').forEach((b) => b.addEventListener('click', () => {
    order.name = b.dataset.name; order.sym = b.dataset.sym; setText();
    hint.textContent = 'How much?'; stage = 'amount';
    chipRow(AMOUNTS, (a) => { order.amount = a; setText(); hint.textContent = 'Add a condition — when should it run?'; stage = 'cond'; condList(); });
  }));
  function pickCond(c) {
    order.cond = c.t; order.odds = c.o; order.reach = Math.min(99, c.o + 4);
    setText(); clearSuggest(); hint.textContent = 'Looks good — send it'; stage = 'ready';
    sendBtn.classList.add('active');
  }

  sendBtn.addEventListener('click', () => { if (stage === 'ready') openCard(); });

  // ---- order card ----
  const cReach = $('cReach'), cCurrent = $('cCurrent'), cFill = $('cFill'), cKnob = $('cKnob'), cSlider = $('cSlider');
  const cOdds = document.querySelector('.oc-odds');
  function openCard() {
    $('cTitle').textContent = `Buy ${order.name} (${order.sym})`;
    $('cAmount').textContent = order.amount;
    $('cCond').textContent = 'if ' + order.cond;
    cCurrent.textContent = order.odds + '%';
    setReach(order.reach);
    scCompose.hidden = true; scDone.hidden = true; scCard.hidden = false;
    resetPuck();
  }
  function setReach(v) {
    order.reach = Math.max(1, Math.min(99, Math.round(v)));
    cReach.textContent = order.reach + '%';
    cFill.style.width = order.reach + '%';
    cKnob.style.left = order.reach + '%';
  }
  function sliderFromX(clientX) {
    const r = cSlider.getBoundingClientRect();
    setReach(((clientX - r.left) / r.width) * 100);
  }
  let sliding = false;
  cSlider.addEventListener('pointerdown', (e) => { if (order.mode !== 'odds') return; sliding = true; cSlider.setPointerCapture(e.pointerId); sliderFromX(e.clientX); });
  cSlider.addEventListener('pointermove', (e) => { if (sliding) sliderFromX(e.clientX); });
  cSlider.addEventListener('pointerup', () => { sliding = false; });

  // Odds / Event toggle
  $('cToggle').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    $('cToggle').querySelectorAll('button').forEach((x) => x.classList.remove('on'));
    b.classList.add('on'); order.mode = b.dataset.t;
    if (order.mode === 'event') {
      cSlider.style.display = 'none';
      cOdds.innerHTML = 'Buy the moment it becomes <strong>official</strong><br />Resolved by the event source';
    } else {
      cSlider.style.display = '';
      cOdds.innerHTML = `Currently at <strong id="cCurrent">${order.odds}%</strong><br />Buy when odds reach <strong id="cReach">${order.reach}%</strong>`;
    }
  }));

  // slide to confirm
  const cConfirm = $('cConfirm'), cPuck = $('cPuck'), cConfirmText = $('cConfirmText');
  let dragging = false, startX = 0, puckX = 0, maxX = 0;
  function resetPuck() { cPuck.style.transition = ''; cPuck.style.transform = 'translateX(0)'; cConfirmText.style.opacity = '1'; puckX = 0; }
  cPuck.addEventListener('pointerdown', (e) => { dragging = true; startX = e.clientX; maxX = cConfirm.clientWidth - cPuck.offsetWidth - 8; cPuck.style.transition = 'none'; cPuck.setPointerCapture(e.pointerId); });
  cPuck.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    puckX = Math.max(0, Math.min(maxX, e.clientX - startX));
    cPuck.style.transform = `translateX(${puckX}px)`;
    cConfirmText.style.opacity = String(1 - puckX / maxX);
  });
  cPuck.addEventListener('pointerup', () => {
    dragging = false;
    if (puckX > maxX * 0.82) { cPuck.style.transition = 'transform .18s'; cPuck.style.transform = `translateX(${maxX}px)`; confirm(); }
    else { cPuck.style.transition = 'transform .25s'; resetPuck(); }
  });

  function confirm() {
    $('dTitle').textContent = `Buy ${order.name} (${order.sym})`;
    $('dAmount').textContent = order.amount;
    $('dCond').textContent = 'if ' + order.cond;
    $('dPlaced').textContent = order.odds + '%';
    $('dTrigger').textContent = order.reach + '%';
    setTimeout(() => { scCard.hidden = true; scDone.hidden = false; }, 220);
  }

  function resetAll() {
    order.name = ''; order.sym = ''; order.amount = ''; order.cond = ''; order.mode = 'odds';
    stage = 'asset'; hint.textContent = 'Type any asset to buy';
    clearSuggest(); setText(); sendBtn.classList.remove('active');
    scCard.hidden = true; scDone.hidden = true; scCompose.hidden = false;
  }
  $('cCancel').addEventListener('click', resetAll);
  $('dReset').addEventListener('click', resetAll);
  $('uappX').addEventListener('click', resetAll);

  resetAll();
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
