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
    uniform float uTime;
    uniform float uResistanceScale;
    uniform float uResistanceAmplitude;
    uniform float uRelaxation;
    uniform float uDecay;
    uniform vec4 uTaps[4];

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

      // Dynamic seasonal breathing wave:
      // Lichen grows and darkens during the growth phase, then naturally recedes and thaws
      // during the sloughing phase so the canvas breathes between dark and light cycles.
      float seasonWave = sin(uTime * 0.16 + vUv.x * 2.5 + vUv.y * 3.2);
      float seasonThaw = max(0.0, -seasonWave) * 0.008;

      // Static per-pixel resistance field + time micro-wobble + seasonal resistance spike
      // Keep the wobble deliberately small: it should make the colony edge
      // breathe without changing the underlying resistance map each frame.
      float timeWobble = 0.035 * (0.5 + 0.5 * sin(uTime * 0.23 + vUv.x * 5.0 - vUv.y * 3.0));
      float resistance = hash(vUv * uResolution * uResistanceScale) * (uResistanceAmplitude + timeWobble) + seasonThaw * 20.0;
      float target = avg > resistance ? 1.0 : max(0.0, val * (1.0 - uDecay) - seasonThaw);
      
      // Slow relaxation toward target
      float nextVal = mix(val, target, uRelaxation);

      // Continuous renewal: spontaneous thallus crust spores in margins during rising growth
      float spontaneous = hash(vUv * 45.0 + vec2(uTime * 0.05, 3.14));
      if (seasonWave > -0.1 && spontaneous > 0.9997 && avg > 0.02) {
        nextVal = max(nextVal, 0.6);
      }

      // Smooth circular tap inoculation: new lichen crust blooms directly under touch
      for (int i = 0; i < 4; i++) {
        if (uTaps[i].z > 0.0 && uTaps[i].w > 0.0) {
          vec2 tapCoord = uTaps[i].xy;
          vec2 aspectDiff = (vUv - tapCoord) * vec2(uResolution.x / uResolution.y, 1.0);
          float dist = length(aspectDiff);
          float rad = uTaps[i].z;
          if (dist < rad) {
            float falloff = smoothstep(rad, 0.0, dist);
            float mottle = 0.8 + 0.2 * hash(vUv * 60.0 + uTaps[i].xy * 17.0);
            nextVal = max(nextVal, falloff * mottle * uTaps[i].w);
          }
        }
      }

      outColor = vec4(clamp(nextVal, 0.0, 1.0), 0.0, 0.0, 1.0);
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

      float a = smoothstep(0.12, 0.55, val);
      // Crustose lichen mottling texture
      float mottle = 0.75 + 0.25 * hash(vUv * uResolution * 1.3);

      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, a));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, a));

      // Tiny glint highlight
      float glintGate = step(0.986, fract(sin(dot(vUv, vec2(41.3, 289.1))) * 43758.5453));
      float glint = glintGate * smoothstep(0.85, 1.0, a) * 0.12;
      col = mix(col, vec3(1.0), glint);

      float alpha = a * mottle * 0.75 * uOpacity * uFade;
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
      fadeInMs: Math.max(0, finite(source.fadeInMs ?? root.fadeInMs, 400)),
      motionScale: Math.max(0, Math.min(1, finite(source.motionScale ?? root.motionScale, 1))),
      reducedMotion: Boolean(source.reducedMotion ?? root.reducedMotion ?? (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)),
      seedRegions: Array.isArray(source.seedRegions ?? root.seedRegions) ? (source.seedRegions ?? root.seedRegions) : []
    };
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
      this.presets = {
        dusting: { seedCount: 48, seedRadius: [2, 4], resistanceScale: 1.30, resistanceAmplitude: 0.65, relaxation: 0.035, decay: 0.0006 },
        islands: { seedCount: 22, seedRadius: [4, 8], resistanceScale: 0.42, resistanceAmplitude: 0.32, relaxation: 0.045, decay: 0.0002 },
        'old-wall': { seedCount: 32, seedRadius: [3, 6], resistanceScale: 0.82, resistanceAmplitude: 0.50, relaxation: 0.038, decay: 0.0004 }
      };
      const presetNames = Object.keys(this.presets);
      const chosenName = this.presets[this.fx.presetName]
        ? this.fx.presetName
        : presetNames[Math.floor(Math.random() * presetNames.length)];
      this.currentPreset = this.presets[chosenName];
      this.canvas.dataset.piloFxVariant = chosenName;

      this.emptyTaps = new Float32Array(16);
      this.activeTaps = [];

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

      // Distribute initial lichen colonies across header, margins, and body
      const seedPoints = [];
      if (this.fx.seedRegions && this.fx.seedRegions.length) {
        for (const r of this.fx.seedRegions) {
          seedPoints.push([r.x * this.simWidth, (1 - r.y) * this.simHeight]);
        }
      }
      const fallbackNodes = [
        [0.72 * this.simWidth, 0.86 * this.simHeight],
        [0.85 * this.simWidth, 0.80 * this.simHeight],
        [0.65 * this.simWidth, 0.88 * this.simHeight],
        [0.08 * this.simWidth, 0.75 * this.simHeight],
        [0.06 * this.simWidth, 0.50 * this.simHeight],
        [0.09 * this.simWidth, 0.25 * this.simHeight],
        [0.93 * this.simWidth, 0.65 * this.simHeight],
        [0.94 * this.simWidth, 0.40 * this.simHeight],
        [0.92 * this.simWidth, 0.18 * this.simHeight],
        [0.35 * this.simWidth, 0.08 * this.simHeight],
        [0.65 * this.simWidth, 0.05 * this.simHeight]
      ];
      for (const node of fallbackNodes) seedPoints.push(node);

      const seedCount = this.currentPreset.seedCount;
      for (let s = 0; s < seedCount; s++) {
        const base = seedPoints[s % seedPoints.length];
        const cx = Math.max(2, Math.min(this.simWidth - 3, base[0] + (Math.random() - 0.5) * 24.0));
        const cy = Math.max(2, Math.min(this.simHeight - 3, base[1] + (Math.random() - 0.5) * 24.0));
        const r = this.currentPreset.seedRadius[0] + Math.floor(Math.random() * (this.currentPreset.seedRadius[1] - this.currentPreset.seedRadius[0] + 1));
        for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(this.simHeight, Math.ceil(cy + r)); y++) {
          for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(this.simWidth, Math.ceil(cx + r)); x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r * r) {
              const idx = (y * this.simWidth + x) * 4;
              data[idx] = 1.0;
              data[idx + 3] = 1.0;
            }
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

      // GPU Warm-Start: 80 iterations on frame 0 so full crustose pattern is immediately visible
      this.stepSimulation(80, 0, null);
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

    stepSimulation(iterations, simTime, tapData) {
      const gl = this.gl;
      gl.bindVertexArray(this.vao);
      gl.useProgram(this.progProcess);
      gl.uniform2f(gl.getUniformLocation(this.progProcess, 'uResolution'), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uResistanceScale'), this.currentPreset.resistanceScale);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uResistanceAmplitude'), this.currentPreset.resistanceAmplitude);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uRelaxation'), this.currentPreset.relaxation);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uDecay'), this.currentPreset.decay);
      gl.uniform4fv(gl.getUniformLocation(this.progProcess, 'uTaps'), tapData || this.emptyTaps);

      for (let i = 0; i < iterations; i++) {
        gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uTime'), simTime + i * 0.05);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
        gl.viewport(0, 0, this.simWidth, this.simHeight);
        gl.bindTexture(gl.TEXTURE_2D, this.texA);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        let tempTex = this.texA; this.texA = this.texB; this.texB = tempTex;
        let tempFbo = this.fboA; this.fboA = this.fboB; this.fboB = tempFbo;
      }
    }

    render(timestamp) {
      if (!this.running) return;
      requestAnimationFrame((t) => this.render(t));

      if (!this.lastTime) this.lastTime = timestamp;
      if (timestamp - this.lastTime < 32) return; // ~30 FPS cadence
      this.lastTime = timestamp;

      this.time += 0.015 * (this.fx.reducedMotion ? 0.15 : this.fx.motionScale);
      if (Math.floor(this.time * 100) % 60 === 0) {
        this.readColors();
      }

      // Inoculate user taps directly as smooth shader uniforms
      if (window.__piloNutrients) {
        const deposits = window.__piloNutrients.drain(4);
        for (const item of deposits) {
          this.activeTaps.push({
            x: item.x,
            y: 1.0 - item.y, // WebGL UV bottom-up
            radius: item.radius * 1.5,
            strength: item.strength,
            framesLeft: 8
          });
        }
      }
      const tapData = new Float32Array(16);
      for (let i = 0; i < this.activeTaps.length && i < 4; i++) {
        const tap = this.activeTaps[i];
        tapData[i * 4 + 0] = tap.x;
        tapData[i * 4 + 1] = tap.y;
        tapData[i * 4 + 2] = tap.radius;
        tapData[i * 4 + 3] = tap.strength;
        tap.framesLeft--;
      }
      this.activeTaps = this.activeTaps.filter(t => t.framesLeft > 0);

      const stepsPerFrame = this.fx.reducedMotion ? 1 : 2;
      this.stepSimulation(stepsPerFrame, this.time, tapData);

      // Screen Pass
      const gl = this.gl;
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
