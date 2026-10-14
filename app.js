// ============================================================
// Ulys landing — interactions
// ============================================================

/* ---- Light / dark theme toggle ---- */
(function theme() {
  const root = document.documentElement;
  const KEY = 'ulys-theme';
  // DARK is the default; the toggle switches to the light variant (saved as 'light').
  function apply(t) {
    if (t === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }
  // a page can pin its theme (e.g. Season 1 matches dark-only ulys.ai)
  const locked = root.getAttribute('data-theme-lock');
  if (locked) { apply(locked); return; }
  // sync with any stored preference (init script already ran in <head>)
  try { apply(localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'); } catch (e) { apply('dark'); }
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

/* ---- Hero: type an idea, Ulys builds a basket for it ----
   One iPhone per idea in a 3-phone carousel. The center phone builds its
   basket live; the side phones show finished baskets, faded. When the idea
   changes the next phone rotates into the center. The bar's arrow skips
   ahead, and clicking a side phone jumps to it.
   Everything is illustrative: fixed weights and a made-up "today" move. */
(function ideaBasket() {
  const typed = document.getElementById('typed');
  const carousel = document.getElementById('bkCarousel');
  if (!typed || !carousel) return;

  const caret = document.querySelector('.caret');
  const status = document.getElementById('basketStatus');
  const send = document.getElementById('commandSend');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const IDEAS = [
    {
      chip: 'Vintage cards onchain',
      prompt: 'Vintage trading cards are moving onchain',
      title: 'Vintage Cards Onchain', change: -4.44, orb: ['#e8833a', '#7aa7e6'],
      picks: [
        { name: 'Collector Crypt', tk: 'CARDS', pct: 35, color: '#ef8a3c', icon: ['#2f7de1', 'C'], why: 'This is the purest listed bet on tokenized card collecting, with activity tied directly to card trading.' },
        { name: 'eBay', tk: 'EBAY', pct: 30, color: '#7fb2f0', icon: ['#ffffff', 'e', '#e53238'], why: 'It owns TCGplayer and takes a cut when trading-card volume moves online.' },
        { name: 'GameStop', tk: 'GME', pct: 20, color: '#b8893a', icon: ['#111111', 'G', '#d4a64a', '#b8893a'], why: 'It is turning trading cards and collectibles into a much bigger part of its business.' },
        { name: 'Solana', tk: 'SOL', pct: 15, color: '#8b3dff', icon: ['linear-gradient(135deg,#00d6a3,#9945ff)', 'S'], why: 'It is the main chain under the tokenized collectibles activity you want exposure to.' },
      ],
    },
    {
      chip: 'AI agents',
      prompt: 'AI agents are going to run the internet',
      title: 'AI Agents Onchain', change: 3.12, orb: ['#30d1c4', '#7b6cf6'],
      picks: [
        { name: 'NVIDIA', tk: 'NVDA', pct: 30, color: '#76b900', icon: ['#76b900', 'N'], why: 'Its chips power nearly every AI model being trained and run today.' },
        { name: 'Virtuals Protocol', tk: 'VIRTUAL', pct: 30, color: '#30d1c4', icon: ['#0f8f86', 'V'], why: 'It is the launchpad where most onchain AI agents are created and traded.' },
        { name: 'Bittensor', tk: 'TAO', pct: 25, color: '#c9c9c9', icon: ['#222222', 'τ', '#fff', 'rgba(255,255,255,.35)'], why: 'It pays a global network of miners to train and serve open AI models.' },
        { name: 'Solana', tk: 'SOL', pct: 15, color: '#8b3dff', icon: ['linear-gradient(135deg,#00d6a3,#9945ff)', 'S'], why: 'Fast, cheap transactions make it a natural home for agents that trade on their own.' },
      ],
    },
    {
      chip: 'Sports betting',
      prompt: 'Sports betting is going mainstream',
      title: 'Sports Betting Boom', change: 2.36, orb: ['#53d337', '#1493ff'],
      picks: [
        { name: 'DraftKings', tk: 'DKNG', pct: 30, color: '#53d337', icon: ['#0b0b0b', 'D', '#53d337', '#53d337'], why: 'It is one of the biggest US sports betting apps and grows with every new state that legalizes.' },
        { name: 'Flutter', tk: 'FLUT', pct: 25, color: '#1493ff', icon: ['#1493ff', 'F'], why: 'It owns FanDuel, the largest sports betting brand in the US.' },
        { name: 'Chiliz', tk: 'CHZ', pct: 25, color: '#e3344f', icon: ['#cd0124', 'C'], why: 'It powers fan tokens for major soccer clubs like FC Barcelona and PSG.' },
        { name: 'Genius Sports', tk: 'GENI', pct: 20, color: '#a78bfa', icon: ['#6d28d9', 'G'], why: 'It supplies the official league data that betting apps and onchain markets run on.' },
      ],
    },
  ];

  // real logos for every asset (assets/logos); letter badges are only a fallback
  const LOGO = { CARDS: 'cards.png', EBAY: 'ebay.svg', GME: 'gme.svg', SOL: 'sol.png', NVDA: 'nvda.svg', VIRTUAL: 'virtual.png', TAO: 'tao.png', DKNG: 'dkng.png', FLUT: 'flut.svg', CHZ: 'chz.png', GENI: 'geni.png' };

  const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  // small deterministic sparkline that ends up or down to match `change`
  function spark(change, seed) {
    let s = seed;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const n = 22, pts = [];
    let y = 0;
    for (let i = 0; i < n; i++) { y += (rnd() - 0.5) * 1.4 + (change < 0 ? -0.32 : 0.32); pts.push(y); }
    const min = Math.min(...pts), max = Math.max(...pts), W = 84, H = 26;
    const xy = pts.map((v, i) => [(i / (n - 1)) * W, H - 3 - ((v - min) / (max - min || 1)) * (H - 6)]);
    const line = xy.map(([x, yy], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${yy.toFixed(1)}`).join(' ');
    const col = change < 0 ? '#ff5a6e' : '#34c759';
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><linearGradient id="sg${seed}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><path d="${line} L${W} ${H} L0 ${H} Z" fill="url(#sg${seed})"/><path d="${line}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  function skeleton() {
    const row = '<li class="bk-row"><span class="bk-icon"></span><div><span class="sk" style="width:58%;height:15px"></span><span class="sk" style="width:92%;height:11px;margin-top:8px"></span><span class="sk" style="width:70%;height:11px;margin-top:6px"></span></div><span class="sk" style="width:46px;height:16px"></span></li>';
    return `<div class="bk-orb"></div>
      <div class="bk-title"><span class="sk" style="width:62%;height:22px;margin:3px auto 0"></span></div>
      <div class="bk-change"><span class="sk" style="width:150px;height:14px"></span></div>
      <div class="bk-bar"><span class="sk" style="width:100%"></span></div>
      <ul class="bk-rows">${row.repeat(4)}</ul>
      <div class="bk-actions"><button class="bk-invest" type="button" tabindex="-1">Invest in this idea</button><button class="bk-share" type="button" tabindex="-1" aria-label="Share">${SHARE}</button></div>`;
  }

  function filled(idea, seed) {
    const up = idea.change >= 0;
    const col = up ? '#34c759' : '#ff5a6e';
    const rows = idea.picks.map((p) => {
      const [bg, letter, fg, ring] = p.icon;
      const icon = LOGO[p.tk]
        ? `<span class="bk-icon logo"><img src="assets/logos/${LOGO[p.tk]}" alt="" /></span>`
        : `<span class="bk-icon" style="background:${bg};color:${fg || '#fff'}${ring ? `;box-shadow:inset 0 0 0 2px ${ring}` : ''}">${letter}</span>`;
      return `<li class="bk-row">
        ${icon}
        <div><div class="bk-name">${p.name}<span>${p.tk}</span></div><div class="bk-why">${p.why}</div></div>
        <span class="bk-pct"><i style="background:${p.color}"></i><b data-pct="${p.pct}">0%</b>${CHEV}</span>
      </li>`;
    }).join('');
    return `<div class="bk-orb" style="--c1:${idea.orb[0]};--c2:${idea.orb[1]}"></div>
      <div class="bk-title">${idea.title}</div>
      <div class="bk-change">${spark(idea.change, seed)}<span class="val" style="color:${col}">${up ? '▲' : '▼'} ${Math.abs(idea.change).toFixed(2)}%</span><span>today</span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></div>
      <div class="bk-bar">${idea.picks.map((p) => `<span style="background:${p.color}" data-w="${p.pct}"></span>`).join('')}</div>
      <ul class="bk-rows">${rows}</ul>
      <div class="bk-actions"><button class="bk-invest" type="button" tabindex="-1">Invest in this idea</button><button class="bk-share" type="button" tabindex="-1" aria-label="Share">${SHARE}</button></div>`;
  }

  function setStatus(text, kind) {
    if (!status) return;
    if (!text) { status.innerHTML = ''; return; }
    const lead = kind === 'ok' ? '<span class="ok">✓</span>' : '<span class="pulse"></span>';
    status.innerHTML = `${lead}<span>${text}</span>`;
  }

  // one phone per idea, cloned from the phone in the markup
  const tpl = carousel.querySelector('.bk-phone');
  const phones = IDEAS.map((idea, k) => {
    const el = k === 0 ? tpl : carousel.appendChild(tpl.cloneNode(true));
    return { el, idea, seed: k + 7, screen: el.querySelector('.bk-screen'), bubble: el.querySelector('.bk-bubble'), card: el.querySelector('.basket-card') };
  });

  function showSkeleton(p, thinking) {
    p.card.className = 'basket-card is-skeleton' + (thinking ? ' is-thinking' : '');
    p.card.innerHTML = skeleton();
  }

  function growBars(p) {
    const n = p.idea.picks.length, gap = 4;
    p.card.querySelectorAll('.bk-bar span').forEach((s) => { s.style.width = `calc(${s.dataset.w}% - ${(gap * (n - 1)) / n}px)`; });
  }

  // finished basket, no animation (side phones)
  function fillStatic(p) {
    p.bubble.textContent = p.idea.prompt;
    p.bubble.hidden = false;
    p.card.className = 'basket-card';
    p.card.innerHTML = filled(p.idea, p.seed);
    growBars(p);
    p.card.querySelectorAll('.bk-row').forEach((r) => r.classList.add('in'));
    p.card.querySelectorAll('[data-pct]').forEach((b) => { b.textContent = `${b.dataset.pct}%`; });
    p.card.querySelector('.bk-actions').classList.add('in');
    p.done = true;
  }

  // put phone `c` in the center, the next one on the right, the other on the left
  function place(c) {
    const n = phones.length;
    phones.forEach((p, k) => {
      const off = (k - c + n) % n;
      p.el.dataset.pos = off === 0 ? 'center' : off === 1 ? 'right' : 'left';
      p.el.setAttribute('aria-hidden', off === 0 ? 'false' : 'true');
      if (off !== 0 && !p.done) fillStatic(p);
    });
  }

  function countUp(el, to) {
    if (reduce) { el.textContent = `${to}%`; return; }
    const t0 = performance.now(), dur = 700;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = `${Math.round(to * (1 - Math.pow(1 - k, 3)))}%`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // each run gets an id; anything from an older run stops at its next await
  let run = 0;

  async function typeText(text, my) {
    if (caret) caret.style.display = '';
    typed.textContent = '';
    for (let i = 1; i <= text.length; i++) {
      if (my !== run) return false;
      typed.textContent = text.slice(0, i);
      await wait(36 + Math.random() * 30);
    }
    return true;
  }

  async function build(c, my) {
    const p = phones[c];
    p.done = false;
    p.bubble.hidden = true;
    showSkeleton(p, false);
    place(c);
    setStatus('');
    if (!(await typeText(p.idea.prompt, my))) return false;
    await wait(350);
    if (my !== run) return false;
    if (send) { send.classList.add('is-pressed'); setTimeout(() => send.classList.remove('is-pressed'), 180); }
    p.bubble.textContent = p.idea.prompt;
    p.bubble.hidden = false;

    showSkeleton(p, true);
    for (const msg of ['Reading your idea', 'Finding the right assets', 'Weighting your basket']) {
      setStatus(msg);
      await wait(700);
      if (my !== run) return false;
    }

    p.card.className = 'basket-card';
    p.card.innerHTML = filled(p.idea, p.seed);
    setStatus('Basket ready', 'ok');
    await wait(60);
    if (my !== run) return false;
    growBars(p);
    for (const r of p.card.querySelectorAll('.bk-row')) {
      r.classList.add('in');
      countUp(r.querySelector('[data-pct]'), Number(r.querySelector('[data-pct]').dataset.pct));
      await wait(140);
      if (my !== run) return false;
    }
    p.card.querySelector('.bk-actions').classList.add('in');
    p.done = true;
    return true;
  }

  let cur = 0;
  async function autoplay() {
    const my = ++run;
    while (my === run) {
      if (!(await build(cur, my))) return;
      await wait(5200);
      if (my !== run) return;
      cur = (cur + 1) % phones.length;
    }
  }

  // the bar's arrow jumps to the next idea; clicking a side phone jumps to it
  if (send) send.addEventListener('click', () => { cur = (cur + 1) % phones.length; autoplay(); });
  phones.forEach((p, k) => p.el.addEventListener('click', () => {
    if (p.el.dataset.pos === 'center') return;
    cur = k;
    autoplay();
  }));

  // scale each 390pt-wide screen to its frame
  const fit = (scr) => scr.style.setProperty('--s', scr.clientWidth / 390);
  phones.forEach((p) => fit(p.screen));
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target)));
    phones.forEach((p) => ro.observe(p.screen));
  } else {
    window.addEventListener('resize', () => phones.forEach((p) => fit(p.screen)), { passive: true });
  }

  autoplay();
})();

/* ---- Phone screens: scale every 390pt-wide screen to its frame ---- */
(function fitScreens() {
  const screens = [...document.querySelectorAll('.bk-screen')].filter((s) => s.querySelector('.bk-screen-inner'));
  if (!screens.length) return;
  const fit = (s) => s.style.setProperty('--s', s.clientWidth / 390);
  screens.forEach(fit);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => entries.forEach((e) => fit(e.target)));
    screens.forEach((s) => ro.observe(s));
  } else {
    window.addEventListener('resize', () => screens.forEach(fit), { passive: true });
  }
})();

/* ---- Edit-weights screen: drag one slider, the rest rebalance to 100% ---- */
const tuneWeights = (function tune() {
  const root = document.querySelector('.s-tune');
  if (!root) return null;
  const picks = [
    { name: 'Collector Crypt', tk: 'CARDS', w: 35, color: '#ef8a3c', icon: '<span class="bk-icon logo"><img src="assets/logos/cards.png" alt="" /></span>' },
    { name: 'eBay', tk: 'EBAY', w: 30, color: '#7fb2f0', icon: '<span class="bk-icon logo"><img src="assets/logos/ebay.svg" alt="" /></span>' },
    { name: 'GameStop', tk: 'GME', w: 20, color: '#b8893a', icon: '<span class="bk-icon logo"><img src="assets/logos/gme.svg" alt="" /></span>' },
    { name: 'Solana', tk: 'SOL', w: 15, color: '#8b3dff', icon: '<span class="bk-icon logo"><img src="assets/logos/sol.png" alt="" /></span>' },
  ];
  const bar = root.querySelector('.s-tune-bar');
  const list = root.querySelector('.s-sliders');
  const total = root.querySelector('.s-total b');
  bar.innerHTML = picks.map((p) => `<span style="background:${p.color}"></span>`).join('');
  list.innerHTML = picks.map((p, i) => `
    <div class="s-slide">
      <div class="s-slide-top">${p.icon}<b>${p.name}<em>${p.tk}</em></b><span class="val">${p.w}%</span></div>
      <input class="s-range" type="range" min="0" max="100" step="1" value="${p.w}" data-i="${i}" aria-label="${p.name} weight" style="--c:${p.color}" />
    </div>`).join('');
  const inputs = [...list.querySelectorAll('.s-range')];
  const vals = [...list.querySelectorAll('.val')];
  const segs = [...bar.children];
  let touched = false;

  function render() {
    const n = picks.length, gap = 4;
    picks.forEach((p, i) => {
      inputs[i].value = p.w;
      inputs[i].style.setProperty('--v', `${p.w}%`);
      vals[i].textContent = `${p.w}%`;
      segs[i].style.width = `calc(${p.w}% - ${(gap * (n - 1)) / n}px)`;
    });
    total.textContent = `${picks.reduce((a, p) => a + p.w, 0)}%`;
  }

  // set pick i to v, scale the others proportionally, keep integer total of 100
  function set(i, v) {
    v = Math.max(0, Math.min(100, Math.round(v)));
    const others = picks.filter((_, j) => j !== i);
    const rest = others.reduce((a, p) => a + p.w, 0);
    const left = 100 - v;
    const raw = others.map((p) => (rest > 0 ? (p.w / rest) * left : left / others.length));
    const floor = raw.map(Math.floor);
    let spare = left - floor.reduce((a, b) => a + b, 0);
    raw.map((r, k) => [r - floor[k], k]).sort((a, b) => b[0] - a[0]).forEach(([, k]) => { if (spare > 0) { floor[k]++; spare--; } });
    picks[i].w = v;
    others.forEach((p, k) => { p.w = floor[k]; });
    render();
  }

  inputs.forEach((inp) => inp.addEventListener('input', () => { touched = true; set(Number(inp.dataset.i), Number(inp.value)); }));
  render();

  // a gentle demo nudge the first time the step is shown (skipped once someone drags)
  let demoed = false;
  return function demo() {
    if (demoed || touched || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    demoed = true;
    const from = picks[1].w, keys = [[from, 0], [46, 900], [40, 1500]];
    const t0 = performance.now();
    const step = (t) => {
      if (touched) return;
      const e = t - t0;
      let k = 1; while (k < keys.length - 1 && e > keys[k][1]) k++;
      const [a, ta] = keys[k - 1], [b, tb] = keys[k];
      const q = Math.min(1, Math.max(0, (e - ta) / (tb - ta)));
      set(1, a + (b - a) * (1 - Math.pow(1 - q, 3)));
      if (e < keys[keys.length - 1][1]) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 500);
  };
})();

/* ---- Pinned story: scroll position picks the step ---- */
(function story() {
  const sec = document.querySelector('.story');
  if (!sec) return;
  const stage = sec.querySelector('.story-stage');
  const steps = [...sec.querySelectorAll('.story-step')];
  const screens = [...sec.querySelectorAll('.story-screen')];
  const bars = [...sec.querySelectorAll('.story-progress button')];
  const copyBtn = sec.querySelector('.s-copybtn');
  const n = steps.length;
  let cur = -1, copyTimer = null;

  function activate(i) {
    if (i === cur) return;
    cur = i;
    stage.dataset.step = i;
    steps.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-past', k < i); s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
    screens.forEach((s, k) => s.classList.toggle('is-active', k === i));
    bars.forEach((b, k) => b.classList.toggle('is-active', k === i));
    if (i === 1 && tuneWeights) tuneWeights();
    clearTimeout(copyTimer);
    if (copyBtn) { copyBtn.classList.remove('done'); if (i === 3) copyTimer = setTimeout(() => copyBtn.classList.add('done'), 1400); }
  }

  function onScroll() {
    const r = sec.getBoundingClientRect();
    const span = sec.offsetHeight - window.innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / span));
    const f = p * n;
    activate(Math.min(n - 1, Math.floor(f)));
    bars.forEach((b, k) => b.style.setProperty('--fill', Math.min(1, Math.max(0, f - k))));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  // clicking a step scrolls to it
  bars.forEach((b, k) => b.addEventListener('click', () => {
    const top = sec.getBoundingClientRect().top + window.scrollY;
    const span = sec.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * ((k + 0.5) / n), behavior: 'smooth' });
  }));
})();

/* ---- Bento: phones drift up as you scroll; spotlight follows the mouse ---- */
(function bento() {
  const cards = [...document.querySelectorAll('.bcard')];
  if (!cards.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phones = cards.flatMap((c) => [...c.querySelectorAll('.bcard-visual .bk-phone')].map((p, k) => ({ c, p, k })));
  let ticking = false;
  function update() {
    ticking = false;
    const vh = window.innerHeight;
    phones.forEach(({ c, p, k }) => {
      const r = c.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      const t = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height))); // 0 entering → 1 leaving
      p.style.setProperty('--py', `${(1 - t) * (90 + k * 30) - 20}px`);
    });
  }
  if (!reduce) {
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
  cards.forEach((c) => c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
    // normalized -1..1 for the floating coins' parallax
    c.style.setProperty('--px', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    c.style.setProperty('--pq', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  }));
  cards.forEach((c) => c.addEventListener('pointerleave', () => { c.style.setProperty('--px', 0); c.style.setProperty('--pq', 0); }));
})();

/* ---- Headlines that light up word by word as they scroll into view ---- */
(function litHeadlines() {
  const heads = [...document.querySelectorAll('.lit')];
  if (!heads.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sets = heads.map((h) => {
    h.setAttribute('aria-label', h.textContent);
    h.innerHTML = h.textContent.trim().split(/\s+/).map((w) => `<span class="w" aria-hidden="true">${w}</span>`).join(' ');
    return { h, words: [...h.querySelectorAll('.w')] };
  });
  function update() {
    const vh = window.innerHeight;
    sets.forEach(({ h, words }) => {
      const r = h.getBoundingClientRect();
      const p = reduce ? 1 : Math.min(1, Math.max(0, (vh * 0.88 - r.top) / (vh * 0.5)));
      const lit = p * words.length;
      words.forEach((w, i) => { w.style.opacity = String(0.22 + 0.78 * Math.min(1, Math.max(0, lit - i))); });
    });
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();
})();

/* ---- Neural engine: an idea flows through a minimal layered network into the app ----
   Canvas covers the section. Layers of nodes joined by hairlines; the idea types out
   on the left and dissolves into the input layer, pulses travel layer to layer, and the
   four output nodes each send a real asset logo into its row in the phone. On screen only. */
(function neural() {
  const sec = document.querySelector('.neural');
  if (!sec || sec.hidden) return;
  const cv = sec.querySelector('.neural-canvas');
  const ctx = cv.getContext('2d');
  const netEl = sec.querySelector('.neural-brain');
  const stage = sec.querySelector('.neural-stage');
  const pauseBtn = sec.querySelector('.n-pause');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const steps = [...sec.querySelectorAll('.neural-steps li')];
  const bubble = sec.querySelector('.n-bubble');
  const title = sec.querySelector('.n-title');
  const sub = sec.querySelector('.n-sub');
  const orb = sec.querySelector('.n-orb');
  const segs = [...sec.querySelectorAll('.n-bar span')];
  const rows = [...sec.querySelectorAll('.n-row')];
  const btn = sec.querySelector('.n-btn');

  const IDEAS = [
    { text: 'AI agents are going to run the internet', title: 'AI Agents Onchain', orb: ['#30d1c4', '#7b6cf6'], picks: [
      { tk: 'NVDA', name: 'NVIDIA', pct: 30, color: '#76b900', logo: 'nvda.svg' },
      { tk: 'VIRTUAL', name: 'Virtuals', pct: 30, color: '#30d1c4', logo: 'virtual.png' },
      { tk: 'TAO', name: 'Bittensor', pct: 25, color: '#c9c9c9', logo: 'tao.png' },
      { tk: 'SOL', name: 'Solana', pct: 15, color: '#8b3dff', logo: 'sol.png' } ] },
    { text: 'Vintage trading cards are moving onchain', title: 'Vintage Cards Onchain', orb: ['#e8833a', '#7aa7e6'], picks: [
      { tk: 'CARDS', name: 'Collector Crypt', pct: 35, color: '#ef8a3c', logo: 'cards.png' },
      { tk: 'EBAY', name: 'eBay', pct: 30, color: '#7fb2f0', logo: 'ebay.svg' },
      { tk: 'GME', name: 'GameStop', pct: 20, color: '#b8893a', logo: 'gme.svg' },
      { tk: 'SOL', name: 'Solana', pct: 15, color: '#8b3dff', logo: 'sol.png' } ] },
    { text: 'Sports betting is going mainstream', title: 'Sports Betting Boom', orb: ['#53d337', '#1493ff'], picks: [
      { tk: 'DKNG', name: 'DraftKings', pct: 30, color: '#53d337', logo: 'dkng.png' },
      { tk: 'FLUT', name: 'Flutter', pct: 25, color: '#1493ff', logo: 'flut.svg' },
      { tk: 'CHZ', name: 'Chiliz', pct: 25, color: '#e3344f', logo: 'chz.png' },
      { tk: 'GENI', name: 'Genius Sports', pct: 20, color: '#a78bfa', logo: 'geni.png' } ] },
    { text: 'Robots are taking over factories', title: 'Robotics Revolution', orb: ['#9aa4b2', '#ff8a3d'], picks: [
      { tk: 'NVDA', name: 'NVIDIA', pct: 35, color: '#76b900', logo: 'nvda.svg' },
      { tk: 'TSLA', name: 'Tesla', pct: 25, color: '#e82127', logo: 'tsla.svg' },
      { tk: 'PEAQ', name: 'peaq', pct: 20, color: '#2ec5d3', logo: 'peaq.png' },
      { tk: 'RENDER', name: 'Render', pct: 20, color: '#c9c9c9', logo: 'render.png' } ] },
  ];
  const imgs = {};
  IDEAS.forEach((i) => i.picks.forEach((p) => { if (!imgs[p.logo]) { const im = new Image(); im.src = `assets/logos/${p.logo}`; imgs[p.logo] = im; } }));

  // ---------- geometry: layers of nodes ----------
  let W = 0, H = 0, layers = [], textAt = { x: 0, y: 0 }, mobile = false;
  function build() {
    const sr = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = sr.width; H = sr.height; mobile = false;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = netEl.getBoundingClientRect();
    const x0 = r.left - sr.left, y0 = r.top - sr.top, w = r.width, h = r.height;
    const sizes = [3, 5, 4];
    // leave room on the left for the idea text (desktop); on phones the text sits above
    const left = x0 + w * 0.06, right = x0 + w * 0.94;
    const top = y0 + h * 0.3, bot = y0 + h * 0.95;
    layers = sizes.map((n, li) => {
      const x = left + ((right - left) * li) / (sizes.length - 1);
      const span = (bot - top) * (n / 5);
      const cy = (top + bot) / 2;
      return Array.from({ length: n }, (_, k) => ({ x, y: n === 1 ? cy : cy - span / 2 + (span * k) / (n - 1), g: 0 }));
    });
    textAt = { x: x0 + w * 0.06, y: y0 + h * 0.04 };
  }

  // ---------- moving things ----------
  let pulses = [], outs = [], heat = new Map();
  const key = (li, a, b) => `${li}:${a}:${b}`;
  function firePulse(toOut) {
    // a path: input → hidden → hidden → output (optionally a chosen output)
    const path = layers.map((L, li) => (li === layers.length - 1 && toOut != null ? toOut : Math.floor(Math.random() * L.length)));
    pulses.push({ path, li: 0, t: 0, speed: 1.6 + Math.random() * 0.9 });
  }

  // typed idea text on the left
  let typed = '', typing = null;
  function typeIdea(text) {
    typed = ''; let i = 0;
    clearInterval(typing);
    typing = setInterval(() => { typed = text.slice(0, ++i); if (i >= text.length) clearInterval(typing); }, 38);
  }
  let textAlpha = 1;

  // ---------- phone ----------
  function setStep(k) { steps.forEach((s, i) => { s.classList.toggle('on', i === k); s.classList.toggle('done', i < k); }); }
  function resetPhone() {
    bubble.classList.remove('in'); bubble.textContent = '';
    title.innerHTML = '<i class="sk"></i>'; sub.textContent = 'Building your basket'; sub.classList.remove('ok');
    orb.style.background = '';
    segs.forEach((s) => { s.style.width = '0'; });
    rows.forEach((r) => { r.classList.remove('filled'); r.querySelector('.n-ic').innerHTML = ''; r.querySelector('.n-name').innerHTML = '<i class="sk"></i>'; r.querySelector('.n-pct').innerHTML = ''; });
    btn.classList.remove('ready');
    setStep(-1);
  }
  function fillRow(idea, k) {
    const p = idea.picks[k], r = rows[k];
    r.classList.add('filled');
    r.querySelector('.n-ic').innerHTML = `<img src="assets/logos/${p.logo}" alt="" />`;
    r.querySelector('.n-name').innerHTML = `${p.name}<em>${p.tk}</em>`;
    r.querySelector('.n-pct').innerHTML = `<i style="background:${p.color}"></i>${p.pct}%`;
    const n = idea.picks.length;
    segs[k].style.background = p.color;
    segs[k].style.width = `calc(${p.pct}% - ${(4 * (n - 1)) / n}px)`;
  }
  function slot(k) {
    const ic = rows[k].querySelector('.n-ic').getBoundingClientRect(), sr = stage.getBoundingClientRect();
    return { x: ic.left - sr.left + ic.width / 2, y: ic.top - sr.top + ic.height / 2, r: ic.width / 2 };
  }

  // ---------- the cycle ----------
  let idx = 0, phase = 0, t = 0;
  function cycle(dt) {
    const idea = IDEAS[idx];
    t += dt;
    if (phase === 0) { resetPhone(); textAlpha = 1; typeIdea(idea.text); phase = 1; t = 0; }
    else if (phase === 1 && t > idea.text.length * 0.038 + 0.5) {
      bubble.textContent = idea.text; bubble.classList.add('in'); setStep(0);
      for (let i = 0; i < 6; i++) setTimeout(() => firePulse(), i * 120);
      phase = 2; t = 0;
    } else if (phase === 2 && t > 1.4) {
      setStep(1); title.textContent = idea.title;
      orb.style.background = `radial-gradient(circle at 28% 30%, ${idea.orb[0]} 0, transparent 62%), radial-gradient(circle at 72% 70%, ${idea.orb[1]} 0, transparent 66%), #3a3833`;
      idea.picks.forEach((p, k) => setTimeout(() => firePulse(k), k * 420)); // each pick rides a pulse to its output node
      phase = 3; t = 0;
    } else if (phase === 3 && rows.every((r) => r.classList.contains('filled'))) {
      setStep(3); sub.textContent = 'Basket ready'; sub.classList.add('ok'); btn.classList.add('ready');
      phase = 4; t = 0;
    } else if (phase === 4 && t > 3.4) { idx = (idx + 1) % IDEAS.length; phase = 0; }
    if (phase >= 2) textAlpha = Math.max(0.28, textAlpha - dt * 0.9);
  }

  // ---------- drawing ----------
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  let clock = 0, idle = 0;
  function frame(dt) {
    clock += dt;
    ctx.clearRect(0, 0, W, H);
    // light/dark palette (re-read every frame so the theme toggle applies live)
    const L = document.documentElement.getAttribute('data-theme') !== 'dark';
    const ink = (a) => (L ? `rgba(26,26,25,${a})` : `rgba(255,255,255,${a})`);
    const out = layers[layers.length - 1];

    // hairline connections between layers
    ctx.lineWidth = 1;
    for (let li = 0; li < layers.length - 1; li++) {
      layers[li].forEach((a, i) => layers[li + 1].forEach((b, j) => {
        const h = heat.get(key(li, i, j)) || 0;
        ctx.strokeStyle = ink((L ? 0.07 : 0.045) + h * 0.4);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (h) heat.set(key(li, i, j), Math.max(0, h - dt * 1.6));
      }));
    }
    // output → phone row hairlines
    out.forEach((o, k) => {
      const s = slot(k), h = heat.get(`o${k}`) || 0;
      ctx.strokeStyle = ink((L ? 0.09 : 0.06) + h * 0.35);
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.moveTo(o.x, o.y);
      if (mobile) ctx.bezierCurveTo(o.x, o.y + 80, s.x, s.y - 80, s.x - s.r, s.y);
      else ctx.bezierCurveTo(o.x + (s.x - o.x) * 0.5, o.y, o.x + (s.x - o.x) * 0.5, s.y, s.x - s.r - 6, s.y);
      ctx.stroke(); ctx.setLineDash([]);
      if (h) heat.set(`o${k}`, Math.max(0, h - dt * 0.9));
    });
    // nodes
    layers.forEach((L) => L.forEach((n) => {
      ctx.beginPath(); ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = L ? '#f7f6f3' : '#0b0b0d'; ctx.fill();
      ctx.strokeStyle = ink(0.32 + n.g * 0.68); ctx.lineWidth = 1; ctx.stroke();
      if (n.g > 0.02) {
        ctx.beginPath(); ctx.arc(n.x, n.y, 1.6 + n.g * 1.4, 0, Math.PI * 2); ctx.fillStyle = ink(n.g); ctx.fill();
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 16); g.addColorStop(0, L ? `rgba(60,120,220,${n.g * 0.18})` : `rgba(200,240,255,${n.g * 0.28})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, 16, 0, Math.PI * 2); ctx.fill();
      }
      n.g = Math.max(0, n.g - dt * 1.5);
    }));

    // pulses
    pulses = pulses.filter((p) => {
      p.t += dt * p.speed;
      if (p.t >= 1) {
        heat.set(key(p.li, p.path[p.li], p.path[p.li + 1]), 1);
        p.li++; p.t = 0;
        const n = layers[p.li][p.path[p.li]]; n.g = 1;
        if (p.li === layers.length - 1) {
          // arriving at an output node: if a pick is waiting for this node, launch its logo
          const idea = IDEAS[idx], k = p.path[p.li];
          if (phase === 3 && !rows[k].classList.contains('filled') && !outs.some((o) => o.k === k)) {
            outs.push({ k, idea, img: imgs[idea.picks[k].logo], t: 0 }); heat.set(`o${k}`, 1);
          }
          return false;
        }
      }
      const a = layers[p.li][p.path[p.li]], b = layers[p.li + 1][p.path[p.li + 1]];
      const e = ease(p.t), x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7); g.addColorStop(0, L ? 'rgba(26,26,25,1)' : 'rgba(255,255,255,1)'); g.addColorStop(0.35, L ? 'rgba(70,120,215,.45)' : 'rgba(190,235,255,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      return true;
    });

    // logos travelling from output nodes into their rows
    outs = outs.filter((o) => {
      o.t += dt / 1.0;
      const k = Math.min(1, o.t), e = ease(k), a = out[o.k], s = slot(o.k);
      let x, y;
      if (mobile) { const u = 1 - e; x = u * u * u * a.x + 3 * u * u * e * a.x + 3 * u * e * e * s.x + e * e * e * s.x; y = u * u * u * a.y + 3 * u * u * e * (a.y + 80) + 3 * u * e * e * (s.y - 80) + e * e * e * s.y; }
      else { const mx = a.x + (s.x - a.x) * 0.5, u = 1 - e; x = u * u * u * a.x + 3 * u * u * e * mx + 3 * u * e * e * mx + e * e * e * s.x; y = u * u * u * a.y + 3 * u * u * e * a.y + 3 * u * e * e * s.y + e * e * e * s.y; }
      const r = 11 + (s.r - 11) * e;
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.strokeStyle = ink(L ? 0.35 : 0.5); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#1a1a1f'; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      if (o.img && o.img.complete && o.img.naturalWidth) ctx.drawImage(o.img, x - r, y - r, r * 2, r * 2);
      ctx.restore();
      if (k >= 1) { fillRow(o.idea, o.k); if (rows.filter((rw) => rw.classList.contains('filled')).length === 1) setStep(2); return false; }
      return true;
    });

    // the idea, typed out in mono on the left
    if (typed) {
      ctx.save();
      ctx.font = `400 ${W < 520 ? 12 : 14}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx.fillStyle = L ? `rgba(26,26,25,${textAlpha})` : `rgba(242,241,238,${textAlpha})`; ctx.textBaseline = 'middle';
      const maxW = layers[layers.length - 1][0].x - textAt.x;
      // wrap to two lines if needed
      const words = typed.split(' '); let line = '', lines = [];
      words.forEach((w) => { const t2 = line ? `${line} ${w}` : w; if (ctx.measureText(t2).width > maxW && line) { lines.push(line); line = w; } else line = t2; });
      lines.push(line);
      const lh = W < 520 ? 17 : 21, y0 = textAt.y + lh / 2;
      lines.forEach((ln, i) => ctx.fillText(ln, textAt.x, y0 + i * lh));
      if (phase === 1 && Math.floor(clock * 2) % 2 === 0) { const lw = ctx.measureText(lines[lines.length - 1]).width; ctx.fillRect(textAt.x + lw + 3, y0 + (lines.length - 1) * lh - 8, 2, 16); }
      // a faint guide from the text into the input layer
      const gy = y0 + (lines.length - 1) * lh + 14;
      ctx.strokeStyle = ink(0.07 * textAlpha + 0.03); ctx.setLineDash([2, 6]);
      layers[0].forEach((n) => { ctx.beginPath(); ctx.moveTo(textAt.x + 4, gy); ctx.lineTo(n.x, n.y - 5); ctx.stroke(); });
      ctx.setLineDash([]);
      ctx.restore();
    }

    // gentle idle activity
    idle += dt; if (idle > 1.1) { idle = 0; firePulse(); }
    cycle(dt);
  }

  function still() {
    resetPhone();
    const idea = IDEAS[0];
    typed = idea.text; textAlpha = 0.8;
    bubble.textContent = idea.text; bubble.classList.add('in'); title.textContent = idea.title;
    idea.picks.forEach((_, k) => fillRow(idea, k));
    sub.textContent = 'Basket ready'; sub.classList.add('ok'); btn.classList.add('ready'); setStep(3);
    phase = 5; frame(0);
  }

  let running = false, last = 0, raf = 0;
  const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; frame(dt); if (running) raf = requestAnimationFrame(loop); };
  build();
  if (reduce) { still(); window.addEventListener('resize', () => { build(); still(); }); return; }
  let visible = false, paused = false;
  const sync = () => {
    const want = visible && !paused;
    if (want && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    else if (!want && running) { running = false; cancelAnimationFrame(raf); }
  };
  new IntersectionObserver((es) => es.forEach((e) => { visible = e.isIntersecting; sync(); }), { threshold: 0.05 }).observe(stage);
  if (pauseBtn) pauseBtn.addEventListener('click', () => {
    paused = !paused; sync();
    pauseBtn.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
    pauseBtn.innerHTML = paused
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 5.5v13l11-6.5z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="5" width="3" height="14" rx=".5"/><rect x="14" y="5" width="3" height="14" rx=".5"/></svg>';
  });
  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); pulses = []; outs = []; heat = new Map(); phase = 0; }, 150); });
})();

/* ---- Closing CTA: type "one prompt away." when it scrolls into view ---- */
(function ctaType() {
  const el = document.querySelector('.tw-cta .tw-typed');
  if (!el) return;
  const text = el.dataset.text;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { el.textContent = text; return; }
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return;
    io.disconnect();
    let i = 0;
    setTimeout(function tick() {
      el.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(tick, 70 + Math.random() * 50);
    }, 450);
  }, { threshold: 0.6 });
  io.observe(el.closest('h2'));
})();

/* ---- Smart Orders card: a trigger on a basket — the line climbs to the trigger, the order executes ---- */
(function triggerCard() {
  const box = document.querySelector('.bcard-visual.trig');
  if (!box) return;
  const $ = (sel) => box.querySelector(sel);
  const cond = $('.trig-cond'), src = $('.trig-src'), num = $('.trig-num'), thrEl = $('.trig-thr em');
  const path = $('.trig-path'), area = $('.trig-area'), dot = $('.trig-dot'), ping = $('.trig-ping'), thrLine = $('.trig-line-thr');
  const orb = $('.trig-orb'), what = $('.trig-what'), status = $('.trig-status');
  const basketOrb = (a, b) => `radial-gradient(circle at 28% 30%, ${a} 0, transparent 62%), radial-gradient(circle at 72% 70%, ${b} 0, transparent 66%), #3a3833`;
  const SC = [
    { cond: 'NVIDIA beats earnings', src: 'Polymarket odds', from: 38, to: 77, thr: 70, fmt: (v) => `${Math.round(v)}%`, thrLabel: '70%', buy: 'Buy $250 of', name: 'AI Agents Onchain', orb: basketOrb('#30d1c4', '#7b6cf6') },
    { cond: 'Bitcoin drops 8%', src: 'Price', from: 0, to: -8.9, thr: -8, fmt: (v) => `${v <= 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}%`, thrLabel: '−8%', buy: 'Buy $100 of', name: 'Bitcoin', img: 'assets/logos/btc.png' },
    { cond: 'Clarity Act passes in 2026', src: 'Polymarket odds', from: 31, to: 67, thr: 60, fmt: (v) => `${Math.round(v)}%`, thrLabel: '60%', buy: 'Buy $200 of', name: 'Ethereum', img: 'assets/logos/eth.png' },
  ];
  const W = 300, H = 110, N = 64;
  let si = 0, pts = [], series = [], i = 0, hit = false, timer = 0, running = false, ymap = null;

  function prep(sc) {
    // eased drift from → to with a little noise that settles near the end
    series = []; let n = 0;
    for (let k = 0; k <= N; k++) {
      const t = k / N, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      n = n * 0.7 + (Math.random() - 0.5) * Math.abs(sc.to - sc.from) * 0.09;
      series.push(sc.from + (sc.to - sc.from) * e + n * (1 - t * 0.8));
    }
    const lo = Math.min(...series, sc.thr), hi = Math.max(...series, sc.thr), pad = (hi - lo) * 0.18;
    ymap = (v) => H - 6 - ((v - (lo - pad)) / ((hi + pad) - (lo - pad))) * (H - 12);
    const ty = ymap(sc.thr).toFixed(1);
    thrLine.setAttribute('y1', ty); thrLine.setAttribute('y2', ty);
    cond.textContent = sc.cond; src.textContent = sc.src; thrEl.textContent = sc.thrLabel;
    what.innerHTML = `${sc.buy} <b>${sc.name}</b>`;
    orb.style.background = sc.img ? `center / cover no-repeat url(${sc.img})` : sc.orb;
    status.textContent = 'Watching'; box.classList.remove('hit');
    pts = []; i = 0; hit = false;
  }
  function draw(sc) {
    const x = (i / N) * W, y = ymap(series[i]);
    pts.push([x, y]);
    const d = pts.map(([px, py], k) => `${k ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
    path.setAttribute('d', d);
    area.setAttribute('d', `${d} L${x.toFixed(1)} ${H} L0 ${H} Z`);
    dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1));
    num.textContent = sc.fmt(series[i]);
    const crossed = sc.to > sc.from ? series[i] >= sc.thr : series[i] <= sc.thr;
    if (crossed && !hit) {
      hit = true; box.classList.add('hit'); status.textContent = 'Executed ✓';
      ping.setAttribute('cx', x.toFixed(1)); ping.setAttribute('cy', y.toFixed(1));
      ping.classList.remove('go'); void ping.getBBox(); ping.classList.add('go');
    }
  }
  // frame-clock driven (setTimeout gets throttled in some browsers): one point per 70ms, then a 2.6s hold
  let acc = 0, hold = 0, last = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(250, now - last); last = now;
    const sc = SC[si];
    if (i <= N) {
      acc += dt;
      while (acc >= 70 && i <= N) { acc -= 70; draw(sc); i++; }
    } else if ((hold += dt) > 2600) {
      hold = 0; acc = 0; si = (si + 1) % SC.length; prep(SC[si]);
    }
    timer = requestAnimationFrame(frame);
  }
  prep(SC[0]);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { for (; i <= N; i++) draw(SC[0]); return; }
  new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting && !running) { running = true; last = performance.now(); timer = requestAnimationFrame(frame); }
    else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(timer); }
  }), { threshold: 0.2 }).observe(box);
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
