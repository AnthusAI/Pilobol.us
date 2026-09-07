// Crustose lichen: slow patches spreading from several points until they
// meet and merge, with irregular boundaries (a static per-pixel "resistance"
// field standing in for rock/bark texture) instead of smooth circles. Unlike
// cellular-automata-v1.js's binary growth/decay rule, this relaxes each cell
// slowly toward a target set by its neighborhood, which is what gives the
// mottled, patchy edge real lichen colonies have instead of a clean blob.
const Lichen = (() => {
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
    uniform float uResistanceScale;
    uniform float uResistanceAmplitude;
    uniform float uRelaxation;
    uniform float uDecay;

    float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

    void main() {
      vec2 texel = 1.0 / uResolution;
      float val = texture(uState, vUv).r;

      float sum = 0.0;
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          if (x == 0 && y == 0) continue;
          sum += texture(uState, vUv + vec2(x, y) * texel).r;
        }
      }
      float avg = sum / 8.0;

      // A static per-pixel resistance (does not depend on time, only
      // position) stands in for the substrate's own texture -- growth only
      // takes where the neighborhood average clears the local resistance,
      // so the colony's edge comes out irregular and patchy rather than a
      // smooth expanding circle.
      float resistance = hash(vUv * uResolution * uResistanceScale) * uResistanceAmplitude;
      float target = avg > resistance ? 1.0 : val * (1.0 - uDecay);
      // Slow relaxation toward the target -- this is what makes the spread
      // gradual instead of the whole frontier jumping in one step.
      float nextVal = mix(val, target, uRelaxation);

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

    float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

    void main() {
      vec2 texel = 1.0 / uResolution;
      float val = 0.0;
      val += texture(uState, vUv).r * 0.5;
      val += texture(uState, vUv + vec2(texel.x, 0.0)).r * 0.1;
      val += texture(uState, vUv - vec2(texel.x, 0.0)).r * 0.1;
      val += texture(uState, vUv + vec2(0.0, texel.y)).r * 0.1;
      val += texture(uState, vUv - vec2(0.0, texel.y)).r * 0.1;
      val += texture(uState, vUv + texel).r * 0.025;
      val += texture(uState, vUv - texel).r * 0.025;
      val += texture(uState, vUv + vec2(texel.x, -texel.y)).r * 0.025;
      val += texture(uState, vUv + vec2(-texel.x, texel.y)).r * 0.025;

      float a = smoothstep(0.15, 0.6, val);
      // A static mottling texture multiplied into the alpha -- crustose
      // lichen isn't a flat wash of color, it's grainy/textured even within
      // a single colony patch.
      float mottle = 0.75 + 0.25 * hash(vUv * uResolution * 1.3);

      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, a));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, a));

      // See dla-v1.js fsScreen for why this rare tiny highlight exists.
      float glintGate = step(0.986, fract(sin(dot(vUv, vec2(41.3, 289.1))) * 43758.5453));
      float glint = glintGate * smoothstep(0.85, 1.0, a) * 0.12;
      col = mix(col, vec3(1.0), glint);

      float alpha = a * mottle * 0.65 * uOpacity * uFade;
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
        console.warn('lichen: EXT_color_buffer_float unavailable; skipping effect');
        return;
      }

      this.fx = readFxConfig('lichen');
      // Surface families vary the substrate rather than the colour: dusting
      // stays granular, islands joins into rounded colonies, and old-wall
      // spreads as patient, resistant patches.
      this.presets = {
        dusting: { seedCount: 34, seedRadius: [1, 2], resistanceScale: 1.30, resistanceAmplitude: 0.70, relaxation: 0.018, decay: 0.0012 },
        islands: { seedCount: 9, seedRadius: [4, 7], resistanceScale: 0.42, resistanceAmplitude: 0.34, relaxation: 0.035, decay: 0.0003 },
        'old-wall': { seedCount: 19, seedRadius: [2, 5], resistanceScale: 0.82, resistanceAmplitude: 0.54, relaxation: 0.022, decay: 0.00065 }
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
      // A handful of small colony seeds, scattered across the full canvas.
      const seedCount = this.currentPreset.seedCount;
      for (let s = 0; s < seedCount; s++) {
        const [cx, cy] = pickSeed(this.fx.seedRegions, this.simWidth, this.simHeight, () => [Math.random() * this.simWidth, Math.random() * this.simHeight]);
        const r = this.currentPreset.seedRadius[0] + Math.floor(Math.random() * (this.currentPreset.seedRadius[1] - this.currentPreset.seedRadius[0] + 1));
        for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(this.simHeight, Math.ceil(cy + r)); y++) {
          for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(this.simWidth, Math.ceil(cx + r)); x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r * r) {
              const idx = (y * this.simWidth + x) * 4;
              data[idx] = 1.0;
            }
          }
        }
      }
      for (let i = 3; i < data.length; i += 4) data[i] = 1.0;

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
      if (timestamp - this.lastTime < 180) return;
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
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uResistanceScale'), this.currentPreset.resistanceScale);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uResistanceAmplitude'), this.currentPreset.resistanceAmplitude);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uRelaxation'), this.currentPreset.relaxation);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uDecay'), this.currentPreset.decay);

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
