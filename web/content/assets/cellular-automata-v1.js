const CellularAutomata = (() => {
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
    uniform float uB1;
    uniform float uB2;
    uniform float uD1;
    uniform float uD2;
    uniform float uDt;
    uniform float uSporeNoise;
    uniform vec4 uTaps[4]; // (x, y, radius, strength)

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    float sigmoid(float x, float a, float alpha) {
      return 1.0 / (1.0 + exp(-4.0 * (x - a) / alpha));
    }

    float interval(float x, float a, float b, float alpha) {
      return sigmoid(x, a, alpha) * (1.0 - sigmoid(x, b, alpha));
    }

    void main() {
      vec2 texel = 1.0 / uResolution;
      float val = texture(uState, vUv).r;

      // SmoothLife 7x7 sampling kernel:
      // Inner core (radius <= 1.3): 5 sample points (center + 4 direct neighbors)
      // Outer annulus (1.3 < radius <= 3.3): 32 sample points
      float innerSum = 0.0;
      float outerSum = 0.0;
      for (int y = -3; y <= 3; y++) {
        for (int x = -3; x <= 3; x++) {
          float d = length(vec2(x, y));
          if (d <= 1.3) {
            innerSum += texture(uState, vUv + vec2(x, y) * texel).r;
          } else if (d <= 3.3) {
            outerSum += texture(uState, vUv + vec2(x, y) * texel).r;
          }
        }
      }
      float m = innerSum / 5.0;
      float n = outerSum / 32.0;

      // Active spatio-temporal wandering drift across the sheet creates
      // continuous biological flow at a calm, deliberate fungal pace.
      vec2 p = vUv * 5.0 + vec2(uTime * 0.18, uTime * 0.12);
      float drift = sin(p.x + cos(p.y * 1.5)) * 0.022;

      float b1 = uB1 + drift;
      float b2 = uB2 + drift;
      float d1 = uD1 + drift;
      float d2 = uD2 + drift;

      const float alpha_n = 0.028;
      const float alpha_m = 0.147;

      float B = interval(n, b1, b2, alpha_n);
      float D = interval(n, d1, d2, alpha_n);
      float S = mix(B, D, sigmoid(m, 0.5, alpha_m));

      float nextVal = clamp(val + uDt * (2.0 * S - 1.0), 0.0, 1.0);

      // Rare micro-spore germination in completely empty areas ensures
      // the canvas remains perpetually alive across all margins.
      float spark = hash(vUv * 120.0 + fract(uTime * 0.07));
      if (spark > (1.0 - uSporeNoise) && n < 0.15 && m < 0.1) {
        nextVal = max(nextVal, 0.7);
      }

      // Smooth, non-destructive tap / pointer inoculation.
      // Aspect-ratio corrected circular falloff that blends additively
      // into the simulation without square bounding box artifacts.
      float aspect = uResolution.x / uResolution.y;
      for (int i = 0; i < 4; i++) {
        if (uTaps[i].w > 0.001) {
          vec2 dCoord = (vUv - uTaps[i].xy) * vec2(aspect, 1.0);
          float dist = length(dCoord);
          if (dist < uTaps[i].z) {
            float f = max(0.0, 1.0 - dist / uTaps[i].z);
            nextVal = max(nextVal, f * f * uTaps[i].w);
          }
        }
      }

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
      // Small box blur for smooth, organic edges on screen
      vec2 texel = 1.0 / uResolution;
      float val = 0.0;
      val += texture(uState, vUv).r * 0.28;
      val += texture(uState, vUv + vec2(texel.x, 0.0)).r * 0.12;
      val += texture(uState, vUv - vec2(texel.x, 0.0)).r * 0.12;
      val += texture(uState, vUv + vec2(0.0, texel.y)).r * 0.12;
      val += texture(uState, vUv - vec2(0.0, texel.y)).r * 0.12;
      val += texture(uState, vUv + texel).r * 0.06;
      val += texture(uState, vUv - texel).r * 0.06;
      val += texture(uState, vUv + vec2(texel.x, -texel.y)).r * 0.06;
      val += texture(uState, vUv + vec2(-texel.x, texel.y)).r * 0.06;

      float a = smoothstep(0.06, 0.48, val);
      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, a));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, a));

      float glintGate = step(0.986, fract(sin(dot(vUv, vec2(41.3, 289.1))) * 43758.5453));
      float glint = glintGate * smoothstep(0.85, 1.0, a) * 0.12;
      col = mix(col, vec3(1.0), glint);

      float alpha = a * 0.72 * uOpacity * uFade;
      outColor = vec4(col * alpha, alpha);
    }
  `;

  function rgbToNormalizedArray(rgbString) {
    const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1])/255, parseInt(match[2])/255, parseInt(match[3])/255];
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
        console.warn('cellular-automata: EXT_color_buffer_float unavailable; skipping effect');
        return;
      }

      this.fx = readFxConfig('cellular-automata');

      // Continuous SmoothLife rules tuned for long-term active motility.
      // Narrowing d2 forces large stagnant blobs to hollow out and divide,
      // creating continuous life-cycle oscillations and wandering amoebae.
      const basePresets = {
        colonies: { b1: 0.270, b2: 0.360, d1: 0.260, d2: 0.405, dt: 0.13, sporeNoise: 0.0004, seedDensity: 0.28 },
        crystal:  { b1: 0.280, b2: 0.345, d1: 0.250, d2: 0.425, dt: 0.12, sporeNoise: 0.00025, seedDensity: 0.24 },
        embers:   { b1: 0.260, b2: 0.370, d1: 0.255, d2: 0.395, dt: 0.15, sporeNoise: 0.0006, seedDensity: 0.32 }
      };
      const presetNames = Object.keys(basePresets);
      const chosenName = basePresets[this.fx.presetName]
        ? this.fx.presetName
        : presetNames[Math.floor(Math.random() * presetNames.length)];
      const base = basePresets[chosenName];

      const jitter = (val, range = 0.03) => val * (1 + (Math.random() * 2 - 1) * range);
      this.currentPreset = {
        name: chosenName,
        b1: jitter(base.b1, 0.02),
        b2: jitter(base.b2, 0.02),
        d1: jitter(base.d1, 0.02),
        d2: jitter(base.d2, 0.02),
        dt: jitter(base.dt, 0.05),
        sporeNoise: jitter(base.sporeNoise, 0.15),
        seedDensity: jitter(base.seedDensity, 0.05)
      };
      this.canvas.dataset.piloFxVariant = chosenName;

      this.colorBase = [0.13, 0.11, 0.09];
      this.colorTip = [0.25, 0.36, 0.26];
      this.colorMid = [0.64, 0.35, 0.16];
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
      this.lastTime = 0;
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

      const quadData = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
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

      // Base diffuse seed
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.random() < this.currentPreset.seedDensity ? (0.2 + Math.random() * 0.8) : 0.0;
        data[i+3] = 1.0;
      }

      // Pre-seed clustered colony discs across the sheet
      const colonyCount = Math.floor(Math.max(20, (this.simWidth * this.simHeight) / 2000));
      for (let c = 0; c < colonyCount; c++) {
        const cx = Math.random() * this.simWidth;
        const cy = Math.random() * this.simHeight;
        const cr = 3 + Math.random() * 6;
        const minX = Math.max(0, Math.floor(cx - cr));
        const maxX = Math.min(this.simWidth - 1, Math.ceil(cx + cr));
        const minY = Math.max(0, Math.floor(cy - cr));
        const maxY = Math.min(this.simHeight - 1, Math.ceil(cy + cr));
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const d = Math.hypot(x - cx, y - cy);
            if (d <= cr) {
              const idx = (y * this.simWidth + x) * 4;
              data[idx] = Math.max(data[idx], Math.cos((d / cr) * Math.PI * 0.5));
            }
          }
        }
      }

      // Seed normalized manager regions (header, margins, footer)
      for (const region of this.fx.seedRegions) {
        const cx = Math.max(0, Math.min(this.simWidth - 1, Number(region.x) * this.simWidth));
        const cy = Math.max(0, Math.min(this.simHeight - 1, (1 - Number(region.y)) * this.simHeight));
        const radius = Math.max(2, (Number(region.radius) || 0.08) * Math.min(this.simWidth, this.simHeight));
        const minX = Math.max(0, Math.floor(cx - radius));
        const maxX = Math.min(this.simWidth - 1, Math.ceil(cx + radius));
        const minY = Math.max(0, Math.floor(cy - radius));
        const maxY = Math.min(this.simHeight - 1, Math.ceil(cy + radius));
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const d = Math.hypot(x - cx, y - cy);
            if (d <= radius) {
              const idx = (y * this.simWidth + x) * 4;
              const factor = Math.cos((d / radius) * Math.PI * 0.5);
              if (Math.random() < 0.75) {
                data[idx] = Math.max(data[idx], factor);
              }
            }
          }
        }
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

      // Pre-compute 30 rapid GPU steps synchronously right now in resetTextures()
      // so the simulation begins in an already mature, fully-differentiated living state
      // on the very first painted frame. Takes < 2ms on GPU and completely eliminates
      // any initial startup delay.
      gl.bindVertexArray(this.vao);
      gl.useProgram(this.progProcess);
      gl.uniform2f(gl.getUniformLocation(this.progProcess, "uResolution"), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uB1"), this.currentPreset.b1);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uB2"), this.currentPreset.b2);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uD1"), this.currentPreset.d1);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uD2"), this.currentPreset.d2);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uDt"), this.currentPreset.dt);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uSporeNoise"), 0.0);
      gl.uniform4fv(gl.getUniformLocation(this.progProcess, "uTaps"), new Float32Array(16));

      for (let s = 0; s < 45; s++) {
        gl.uniform1f(gl.getUniformLocation(this.progProcess, "uTime"), s * 0.02);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
        gl.viewport(0, 0, this.simWidth, this.simHeight);
        gl.bindTexture(gl.TEXTURE_2D, this.texA);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        let tempTex = this.texA; this.texA = this.texB; this.texB = tempTex;
        let tempFbo = this.fboA; this.fboA = this.fboB; this.fboB = tempFbo;
      }
    }

    readColors() {
      const div = document.createElement('div');
      div.style.color = 'var(--markus-ink, #211d17)';
      div.style.backgroundColor = 'var(--markus-accent, #3f5d43)';
      div.style.borderColor = 'var(--markus-accent-2, #a35a2a)';
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
      const stepInterval = this.fx.reducedMotion ? 90 : 30;
      if (timestamp - this.lastTime < stepInterval) return;
      this.lastTime = timestamp;

      this.time += 0.02 * (this.fx.reducedMotion ? 0.15 : this.fx.motionScale);
      if (Math.floor(this.time * 100) % 60 === 0) {
        this.readColors();
      }

      // Collect user pointer/tap deposits from the manager
      const tapData = new Float32Array(16);
      if (window.__piloNutrients) {
        const deposits = window.__piloNutrients.drain(4);
        for (let i = 0; i < deposits.length && i < 4; i++) {
          const item = deposits[i];
          tapData[i * 4 + 0] = item.x;
          tapData[i * 4 + 1] = 1.0 - item.y; // WebGL UV is bottom-up
          tapData[i * 4 + 2] = item.radius;
          tapData[i * 4 + 3] = item.strength;
        }
      }

      const gl = this.gl;
      gl.bindVertexArray(this.vao);

      gl.useProgram(this.progProcess);
      gl.uniform2f(gl.getUniformLocation(this.progProcess, "uResolution"), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uTime"), this.time);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uB1"), this.currentPreset.b1);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uB2"), this.currentPreset.b2);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uD1"), this.currentPreset.d1);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uD2"), this.currentPreset.d2);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uDt"), this.currentPreset.dt);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uSporeNoise"), this.currentPreset.sporeNoise);
      gl.uniform4fv(gl.getUniformLocation(this.progProcess, "uTaps"), tapData);

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
      gl.uniform2f(gl.getUniformLocation(this.progScreen, "uResolution"), this.simWidth, this.simHeight);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorBase"), this.colorBase[0], this.colorBase[1], this.colorBase[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorTip"), this.colorTip[0], this.colorTip[1], this.colorTip[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorMid"), this.colorMid[0], this.colorMid[1], this.colorMid[2]);
      gl.uniform1f(gl.getUniformLocation(this.progScreen, "uOpacity"), this.fx.opacity);
      gl.uniform1f(gl.getUniformLocation(this.progScreen, "uFade"), Math.min(1, (performance.now() - this.fadeStart) / this.fx.fadeInMs));

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
