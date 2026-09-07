// Diffusion-Limited Aggregation: dendritic frost/coral branching.
//
// Classic DLA (Witten & Sander 1981) walks random particles until they touch
// existing structure and freeze there. A literal random-walk needs one agent
// per particle; this is a shader-friendly approximation of the same visual
// result -- a cell freezes with a small, per-step probability if it already
// borders frozen structure -- which produces the same sparse, branching
// "growth reaches out, doesn't fill in" look without per-particle tracking.
const DLA = (() => {
  const vsQuad = `#version 300 es
    in vec2 position;
    out vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fsProcess = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uState;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uFrontierThreshold;
    uniform float uFreezeChance;
    uniform float uErosion;

    float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

    void main() {
      vec2 texel = 1.0 / uResolution;
      float val = texture(uState, vUv).r;

      float neighborSum = 0.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          if (x == 0 && y == 0) continue;
          neighborSum += texture(uState, vUv + vec2(x, y) * texel).r;
        }
      }

      float roll = hash(vUv * uResolution + uTime * 41.0);
      float nextVal = val;
      // Freeze only at the frontier (touches existing structure) and only
      // sometimes -- a low, roughly-constant freeze chance per exposed cell
      // is what makes DLA branch sparsely instead of filling in solid the
      // way a straight neighbor-majority rule (like the cellular-automata
      // effect) does.
      if (val < 0.5 && neighborSum > uFrontierThreshold && roll < uFreezeChance) {
        nextVal = 1.0;
      }
      // Frozen structure erodes very slowly instead of being permanent, so
      // the frost pattern keeps slowly turning over -- new branches reach
      // out from the frontier as old growth fades, rather than the whole
      // canvas eventually freezing solid and stopping.
      nextVal = max(0.0, nextVal - uErosion);

      outColor = vec4(nextVal, 0.0, 0.0, 1.0);
    }
  `;

  const fsScreen = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uState;
    uniform vec2 uResolution;
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    uniform vec3 uColorMid;
    uniform float uOpacity;
    uniform float uFade;

    void main() {
      vec2 texel = 1.0 / uResolution;
      float val = 0.0;
      val += texture(uState, vUv).r * 0.4;
      val += texture(uState, vUv + vec2(texel.x, 0.0)).r * 0.12;
      val += texture(uState, vUv - vec2(texel.x, 0.0)).r * 0.12;
      val += texture(uState, vUv + vec2(0.0, texel.y)).r * 0.12;
      val += texture(uState, vUv - vec2(0.0, texel.y)).r * 0.12;
      val += texture(uState, vUv + texel).r * 0.03;
      val += texture(uState, vUv - texel).r * 0.03;
      val += texture(uState, vUv + vec2(texel.x, -texel.y)).r * 0.03;
      val += texture(uState, vUv + vec2(-texel.x, texel.y)).r * 0.03;

      float a = smoothstep(0.06, 0.5, val);
      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, a));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, a));

      // A fungal stain reads as darker paper, not lighter -- normal blending
      // (see pilobol-theme-v10.css; multiply guaranteed darker-or-equal but
      // could never go lighter even briefly) means the shader itself must
      // keep results darker than the page almost always. This is the one
      // deliberate exception: a rare, tiny bright fleck at peak density,
      // gated to a small fraction of pixels so it reads as an occasional
      // glinting frost crystal, not a general lightening.
      float glintGate = step(0.986, fract(sin(dot(vUv, vec2(41.3, 289.1))) * 43758.5453));
      float glint = glintGate * smoothstep(0.85, 1.0, a) * 0.12;
      col = mix(col, vec3(1.0), glint);

      float alpha = a * 0.7 * uOpacity * uFade;
      outColor = vec4(col * alpha, alpha);
    }
  `;

  function rgbToNormalizedArray(rgbString) {
    const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1]) / 255, parseInt(match[2]) / 255, parseInt(match[3]) / 255];
  }

  function readFxConfig(name) {
    const root = window.__piloFxConfig || {};
    const scoped = (root.effects && root.effects[name]) || root[name] || {};
    const source = typeof scoped === 'object' ? scoped : {};
    const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      presetName: typeof source.preset === 'string' ? source.preset : '',
      opacity: Math.max(0, Math.min(1, finite(source.opacity ?? source.intensity ?? root.opacity ?? root.intensity, 0.72))),
      fadeInMs: Math.max(0, finite(source.fadeInMs ?? root.fadeInMs, 4200)),
      motionScale: Math.max(0, Math.min(1, finite(source.motionScale ?? root.motionScale, 1))),
      reducedMotion: Boolean(source.reducedMotion ?? root.reducedMotion ?? (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)),
      seedRegions: Array.isArray(source.seedRegions ?? root.seedRegions) ? (source.seedRegions ?? root.seedRegions) : []
    };
  }

  function pickSeed(regions, width, height, fallback) {
    if (!regions.length) return fallback();
    const total = regions.reduce((sum, region) => sum + Math.max(0, Number(region.weight) || 0), 0);
    let roll = Math.random() * (total || regions.length);
    let selected = regions[0];
    for (const region of regions) {
      roll -= total ? Math.max(0, Number(region.weight) || 0) : 1;
      if (roll <= 0) { selected = region; break; }
    }
    const radiusX = Math.max(0, Number(selected.radiusX ?? selected.radius) || 0.08);
    const radiusY = Math.max(0, Number(selected.radiusY ?? selected.radius) || 0.08);
    const x = Number.isFinite(Number(selected.x)) ? Number(selected.x) : Math.random();
    const y = Number.isFinite(Number(selected.y)) ? Number(selected.y) : Math.random();
    return [
      Math.max(0, Math.min(width - 1, (x + (Math.random() - 0.5) * radiusX) * width)),
      Math.max(0, Math.min(height - 1, (1 - y + (Math.random() - 0.5) * radiusY) * height))
    ];
  }

  class Simulation {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
      if (!this.gl) return;

      if (!this.gl.getExtension('EXT_color_buffer_float')) {
        console.warn('dla: EXT_color_buffer_float unavailable; skipping effect');
        return;
      }

      this.fx = readFxConfig('dla');
      // Sparse, low-contrast branch families. Frost is the finest and most
      // transient; coral is denser and rounded; rootlets hold longer, with
      // fewer initiation points and outward-reaching forks.
      this.presets = {
        frost: { seedCount: 46, seedRadius: [1, 2], frontierThreshold: 0.45, freezeChance: 0.036, erosion: 0.00019 },
        coral: { seedCount: 34, seedRadius: [2, 3], frontierThreshold: 0.30, freezeChance: 0.064, erosion: 0.00014 },
        rootlets: { seedCount: 18, seedRadius: [1, 2], frontierThreshold: 0.55, freezeChance: 0.042, erosion: 0.000075 }
      };
      const presetNames = Object.keys(this.presets);
      const chosenName = this.presets[this.fx.presetName]
        ? this.fx.presetName
        : presetNames[Math.floor(Math.random() * presetNames.length)];
      this.currentPreset = this.presets[chosenName];
      this.canvas.dataset.piloFxVariant = chosenName;

      this.colorBase = [0, 0, 0];
      this.colorTip = [1, 1, 1];
      this.colorMid = [0.6, 0.6, 0.6];
      this.readColors();
      this.fadeStart = performance.now();

      this.initGL();
      this.resize();
      this.canvas.dataset.piloFxReady = 'true';
      this.canvas.dataset.piloFxMode = 'live';
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('pilo:canvasresize', () => this.resize());

      this.time = 0;
      this.running = true;
      requestAnimationFrame((t) => this.render(t));
      document.addEventListener('visibilitychange', () => {
        const visible = document.visibilityState === 'visible';
        if (visible === this.running) return;
        this.running = visible;
        if (visible) {
          this.lastTime = 0;
          requestAnimationFrame((t) => this.render(t));
        }
      });
    }

    initGL() {
      const gl = this.gl;
      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, vsQuad); gl.compileShader(vs);

      const compile = (fsSource) => {
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fsSource); gl.compileShader(fs);
        const p = gl.createProgram();
        gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
        return p;
      };

      this.progProcess = compile(fsProcess);
      this.progScreen = compile(fsScreen);

      const quadData = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
      this.vao = gl.createVertexArray();
      const vbo = gl.createBuffer();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }

    resize() {
      const pageHeight = Math.max(window.innerHeight, this.canvas.clientHeight || 0);
      const maxCanvas = this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE) || 8192;
      const dprLimit = pageHeight > window.innerHeight * 2 ? 1.25 : 2.0;
      const dpr = Math.min(window.devicePixelRatio, dprLimit, maxCanvas / window.innerWidth, maxCanvas / pageHeight);
      this.simWidth = Math.floor(window.innerWidth / 3);
      this.simHeight = Math.floor(pageHeight / 3);
      this.canvas.width = Math.floor(window.innerWidth * dpr);
      this.canvas.height = Math.floor(pageHeight * dpr);
      this.resetTextures();
    }

    resetTextures() {
      const gl = this.gl;
      const data = new Float32Array(this.simWidth * this.simHeight * 4);
      // Many small nucleation seeds scattered across the full canvas (not
      // just the outer margins) -- unlike a single-source DLA cluster, this
      // gives several independent frost structures that read well whether
      // only a narrow strip either side of the mask ends up visible.
      const seedCount = this.currentPreset.seedCount;
      for (let s = 0; s < seedCount; s++) {
        const [cx, cy] = pickSeed(this.fx.seedRegions, this.simWidth, this.simHeight, () => [Math.random() * this.simWidth, Math.random() * this.simHeight]);
        const r = this.currentPreset.seedRadius[0] + Math.floor(Math.random() * (this.currentPreset.seedRadius[1] - this.currentPreset.seedRadius[0] + 1));
        for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(this.simHeight, Math.ceil(cy + r)); y++) {
          for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(this.simWidth, Math.ceil(cx + r)); x++) {
            const idx = (y * this.simWidth + x) * 4;
            data[idx] = 1.0;
            data[idx + 3] = 1.0;
          }
        }
      }
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] === 0) data[i] = 1.0;
      }

      const createTex = (d) => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.simWidth, this.simHeight, 0, gl.RGBA, gl.FLOAT, d);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
      };

      this.texA = createTex(data);
      this.texB = createTex(null);
      this.fboA = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texA, 0);
      this.fboB = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texB, 0);
    }

    readColors() {
      const div = document.createElement('div');
      div.style.color = 'var(--markus-ink)';
      div.style.backgroundColor = 'var(--markus-accent)';
      div.style.borderColor = 'var(--markus-accent-2)';
      document.body.appendChild(div);
      const computed = getComputedStyle(div);
      this.colorBase = rgbToNormalizedArray(computed.color);
      this.colorTip = rgbToNormalizedArray(computed.backgroundColor);
      this.colorMid = rgbToNormalizedArray(computed.borderColor);
      document.body.removeChild(div);
    }

    render(timestamp) {
      if (!this.running) return;
      requestAnimationFrame((t) => this.render(t));

      if (!this.lastTime) this.lastTime = timestamp;
      if (timestamp - this.lastTime < 150) return;
      this.lastTime = timestamp;

      this.time += 0.01 * (this.fx.reducedMotion ? 0.12 : this.fx.motionScale);
      if (Math.floor(this.time * 100) % 60 === 0) {
        this.readColors();
      }

      const gl = this.gl;
      if (window.__piloNutrients) {
        window.__piloNutrients.paint(gl, this.texA, this.simWidth, this.simHeight, 'density');
      }
      gl.bindVertexArray(this.vao);

      gl.useProgram(this.progProcess);
      gl.uniform2f(gl.getUniformLocation(this.progProcess, 'uResolution'), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uTime'), this.time);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uFrontierThreshold'), this.currentPreset.frontierThreshold);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uFreezeChance'), this.currentPreset.freezeChance);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uErosion'), this.currentPreset.erosion);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
      gl.viewport(0, 0, this.simWidth, this.simHeight);
      gl.bindTexture(gl.TEXTURE_2D, this.texA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      let tempTex = this.texA; this.texA = this.texB; this.texB = tempTex;
      let tempFbo = this.fboA; this.fboA = this.fboB; this.fboB = tempFbo;

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);

      gl.useProgram(this.progScreen);
      gl.uniform2f(gl.getUniformLocation(this.progScreen, 'uResolution'), this.simWidth, this.simHeight);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, 'uColorBase'), this.colorBase[0], this.colorBase[1], this.colorBase[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, 'uColorTip'), this.colorTip[0], this.colorTip[1], this.colorTip[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, 'uColorMid'), this.colorMid[0], this.colorMid[1], this.colorMid[2]);
      gl.uniform1f(gl.getUniformLocation(this.progScreen, 'uOpacity'), this.fx.opacity);
      gl.uniform1f(gl.getUniformLocation(this.progScreen, 'uFade'), Math.min(1, (performance.now() - this.fadeStart) / this.fx.fadeInMs));

      gl.bindTexture(gl.TEXTURE_2D, this.texA);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  const init = () => {
    const canvas = document.getElementById('pilo-physarum-bg');
    if (canvas) new Simulation(canvas);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
