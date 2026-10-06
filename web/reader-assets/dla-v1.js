// Diffusion-Limited Aggregation: dendritic frost/coral branching.
//
// Continuous simulation that cycles continuously between two distinct phases:
// 1. DARKENING / GROWTH PHASE: Crystals slowly grow outward from seed nodes,
//    branching across the margins and header, darkening the page with intricate filigree.
// 2. LIGHTENING / THAW PHASE: Growth is completely shut off. A gentle thaw dissolves
//    the crystals from the tips inward, eroding every pixel back to transparency
//    so the page becomes 100% light, clean, and pristine again.
// 3. GERMINATION & REPEAT: Fresh microscopic seed buds sprout at new randomized
//    locations in the margins/header, and the darkening phase begins anew.
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
    uniform float uGrowthAllowed;
    uniform float uThawRate;
    uniform float uCyclePhase;
    uniform float uCycleIndex;
    uniform vec4 uTaps[4];

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }

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

      float nextVal = val;
      float roll = hash(vUv * uResolution + vec2(uTime * 17.0, 1.23));

      // 1. DARKENING / GROWTH PHASE:
      // STRICT REQUIREMENT: Only enabled when uGrowthAllowed > 0.001.
      // During thaw/lightening phase, uGrowthAllowed is EXACTLY 0.0, so NO FREEZING CAN EVER OCCUR.
      if (uGrowthAllowed > 0.001 && val < 0.25) {
        if (neighborSum >= uFrontierThreshold && neighborSum <= 3.2) {
          if (roll < uFreezeChance * uGrowthAllowed) {
            nextVal = 0.95;
          }
        }
      }

      // 2. LIGHTENING / THAW / DISSOLUTION PHASE:
      // When uThawRate > 0, branches dissolve from tips inward, returning the page to light.
      // Even during growth, subtle overcrowding suppression prevents solid black slabs.
      float crowdFactor = smoothstep(2.0, 4.5, neighborSum) * 2.5;
      float tipBoost = (1.0 - smoothstep(0.5, 3.5, neighborSum)) * 0.6;
      float thawWave = 1.0 + 0.3 * sin(vUv.x * 3.0 + vUv.y * 2.0 + uTime * 0.5);
      float currentThaw = (uThawRate * thawWave * (1.0 + tipBoost)) + (uErosion * (1.0 + crowdFactor));
      
      nextVal = max(0.0, nextVal - currentThaw);

      // 3. CYCLIC GERMINATION:
      // In the pristine window between cycles (when thaw has finished and canvas is light),
      // sprout fresh seed candidates in the margins and top-right header.
      if (uCyclePhase > 0.96 || uCyclePhase < 0.03) {
        float seedHash = hash(vUv * 97.3 + vec2(uCycleIndex * 31.7, 19.3));
        if (seedHash > 0.99988) {
          bool isHeader = (vUv.x > 0.55 && vUv.y > 0.70);
          bool isMargin = (vUv.x < 0.16 || vUv.x > 0.84);
          if (isHeader || isMargin) {
            nextVal = 0.95;
          }
        }
      }

      // 4. DIRECT TOUCH INOCULATION:
      // Touching or tapping deposits seeds directly under pointer
      for (int i = 0; i < 4; i++) {
        if (uTaps[i].z > 0.0 && uTaps[i].w > 0.0) {
          vec2 tapCoord = uTaps[i].xy;
          vec2 aspectDiff = (vUv - tapCoord) * vec2(uResolution.x / uResolution.y, 1.0);
          float dist = length(aspectDiff);
          float rad = uTaps[i].z;
          if (dist < rad) {
            float falloff = smoothstep(rad, 0.0, dist);
            float seedNoise = hash(vUv * 80.0 + uTaps[i].xy * 23.0);
            nextVal = max(nextVal, falloff * (0.85 + 0.15 * seedNoise));
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

      float a = smoothstep(0.06, 0.50, val);
      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, a));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, a));

      float glintGate = step(0.986, fract(sin(dot(vUv, vec2(41.3, 289.1))) * 43758.5453));
      float glint = glintGate * smoothstep(0.85, 1.0, a) * 0.12;
      col = mix(col, vec3(1.0), glint);

      float alpha = a * 0.88 * uOpacity * uFade;
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
        console.warn('dla: EXT_color_buffer_float unavailable; skipping effect');
        return;
      }

      this.fx = readFxConfig('dla');
      // Calm, majestic growth speed (~3x slower) with full macro cyclic turnover
      this.presets = {
        frost: { seedCount: 6, seedRadius: [1, 1], frontierThreshold: 0.55, freezeChance: 0.0060, erosion: 0.0004 },
        coral: { seedCount: 8, seedRadius: [1, 1], frontierThreshold: 0.40, freezeChance: 0.0075, erosion: 0.0005 },
        rootlets: { seedCount: 5, seedRadius: [1, 1], frontierThreshold: 0.60, freezeChance: 0.0065, erosion: 0.0004 }
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

      this.time = 0;
      this.cycleTime = 0;
      this.lastTime = 0;

      this.initGL();
      this.resize();
      this.canvas.dataset.piloFxReady = 'true';
      this.canvas.dataset.piloFxMode = 'live';
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('pilo:canvasresize', () => this.resize());

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

      // Distribute initial seed points sparsely in margins and header
      const seedPoints = [];
      if (this.fx.seedRegions && this.fx.seedRegions.length) {
        for (const r of this.fx.seedRegions) {
          seedPoints.push([r.x * this.simWidth, (1 - r.y) * this.simHeight]);
        }
      }
      const fallbackNodes = [
        [0.72 * this.simWidth, 0.86 * this.simHeight], // Top-right header bloom beside H1
        [0.85 * this.simWidth, 0.80 * this.simHeight], // Top-right outer corner
        [0.08 * this.simWidth, 0.70 * this.simHeight], // Upper left margin
        [0.06 * this.simWidth, 0.40 * this.simHeight], // Mid left margin
        [0.93 * this.simWidth, 0.55 * this.simHeight], // Mid right margin
        [0.92 * this.simWidth, 0.25 * this.simHeight], // Lower right margin
        [0.35 * this.simWidth, 0.08 * this.simHeight]  // Footer margin
      ];
      for (const node of fallbackNodes) seedPoints.push(node);

      const seedCount = this.currentPreset.seedCount;
      for (let s = 0; s < seedCount; s++) {
        const base = seedPoints[s % seedPoints.length];
        const cx = Math.max(1, Math.min(this.simWidth - 2, base[0] + (Math.random() - 0.5) * 16.0));
        const cy = Math.max(1, Math.min(this.simHeight - 2, base[1] + (Math.random() - 0.5) * 16.0));
        const r = this.currentPreset.seedRadius[0];
        for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(this.simHeight, Math.ceil(cy + r)); y++) {
          for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(this.simWidth, Math.ceil(cx + r)); x++) {
            const idx = (y * this.simWidth + x) * 4;
            data[idx] = 0.95;
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

      // Gentle warmup: 10 steps so delicate seedlings are visible immediately without blanketing screen
      this.stepSimulation(10, 0, null, 0.6, 0.0, 0.05, 0);
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

    stepSimulation(iterations, simTime, tapData, growthAllowed, thawRate, cyclePhase, cycleIndex) {
      const gl = this.gl;
      gl.bindVertexArray(this.vao);
      gl.useProgram(this.progProcess);
      gl.uniform2f(gl.getUniformLocation(this.progProcess, 'uResolution'), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uFrontierThreshold'), this.currentPreset.frontierThreshold);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uFreezeChance'), this.currentPreset.freezeChance);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uErosion'), this.currentPreset.erosion);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uGrowthAllowed'), growthAllowed);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uThawRate'), thawRate);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uCyclePhase'), cyclePhase);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uCycleIndex'), cycleIndex);
      gl.uniform4fv(gl.getUniformLocation(this.progProcess, 'uTaps'), tapData || this.emptyTaps);

      for (let i = 0; i < iterations; i++) {
        gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uTime'), simTime + i * 0.015);
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
      // 40ms cadence (~25 FPS) for calm, organic motion
      if (timestamp - this.lastTime < 40) return;
      const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000.0);
      this.lastTime = timestamp;

      // Advance clocks
      const speedScale = (this.fx.reducedMotion ? 0.2 : this.fx.motionScale);
      this.time += dt * 0.3 * speedScale;
      this.cycleTime += dt * speedScale;

      // 32-second full macro cycle: Darkening -> Hold -> Lightening -> Pristine Reseed
      const cycleDuration = 32.0;
      const cyclePhase = (this.cycleTime % cycleDuration) / cycleDuration;
      const cycleIndex = Math.floor(this.cycleTime / cycleDuration);

      let growthAllowed = 0.0;
      let thawRate = 0.0;

      if (cyclePhase < 0.45) {
        // DARKENING PHASE: Crystals slowly grow outward, darkening the page with filigree
        const t = cyclePhase / 0.45;
        growthAllowed = Math.sin(t * Math.PI);
        thawRate = 0.0;
      } else if (cyclePhase < 0.52) {
        // PEAK MATURITY PAUSE: Growth stops, intricate branches hold at full bloom
        growthAllowed = 0.0;
        thawRate = 0.0005;
      } else if (cyclePhase < 0.82) {
        // LIGHTENING / THAW PHASE: Growth completely disabled. Thaw dissolves branches back to 0
        growthAllowed = 0.0;
        const t = (cyclePhase - 0.52) / 0.30;
        thawRate = 0.007 + 0.009 * Math.sin(t * Math.PI);
      } else {
        // PRISTINE LIGHT & GERMINATION: Canvas is 100% light; new seeds sprout for next cycle
        growthAllowed = 0.0;
        thawRate = 0.0;
      }

      if (Math.floor(this.time * 100) % 60 === 0) {
        this.readColors();
      }

      // Drain nutrients and pass as smooth shader uniforms
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

      // 1 simulation step per frame with exact cycle parameters
      this.stepSimulation(1, this.time, tapData, growthAllowed, thawRate, cyclePhase, cycleIndex);

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

  return { Simulation };
})();
