const ReactionDiffusion = (() => {
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
    uniform float f;
    uniform float k;
    uniform float dA;
    uniform float dB;
    uniform vec4 uTaps[4];
    
    void main() {
      vec2 texel = 1.0 / uResolution;
      vec2 center = texture(uState, vUv).rg;
      float A = center.r;
      float B = center.g;
      
      vec2 laplace = -center * 1.0;
      laplace += texture(uState, vUv + vec2(-1.0, 0.0) * texel).rg * 0.2;
      laplace += texture(uState, vUv + vec2(1.0, 0.0) * texel).rg * 0.2;
      laplace += texture(uState, vUv + vec2(0.0, -1.0) * texel).rg * 0.2;
      laplace += texture(uState, vUv + vec2(0.0, 1.0) * texel).rg * 0.2;
      laplace += texture(uState, vUv + vec2(-1.0, -1.0) * texel).rg * 0.05;
      laplace += texture(uState, vUv + vec2(1.0, -1.0) * texel).rg * 0.05;
      laplace += texture(uState, vUv + vec2(-1.0, 1.0) * texel).rg * 0.05;
      laplace += texture(uState, vUv + vec2(1.0, 1.0) * texel).rg * 0.05;
      
      float reaction = A * B * B;
      
      // Subtle dynamic spatio-temporal modulation keeps the Gray-Scott patterns continually
      // dividing, branching, and evolving rather than locking into a dead static state
      float localF = f + sin(uTime * 0.15 + vUv.x * 6.28) * 0.0008;
      float localK = k + cos(uTime * 0.12 + vUv.y * 6.28) * 0.0008;
      
      float nextA = A + (dA * laplace.r - reaction + localF * (1.0 - A));
      float nextB = B + (dB * laplace.g + reaction - (localK + localF) * B);
      
      // Smooth circular tap inoculation: inject chemical B at user touch spots
      for (int i = 0; i < 4; i++) {
        if (uTaps[i].z > 0.0 && uTaps[i].w > 0.0) {
          vec2 tapCoord = uTaps[i].xy;
          vec2 aspectDiff = (vUv - tapCoord) * vec2(uResolution.x / uResolution.y, 1.0);
          float dist = length(aspectDiff);
          float rad = uTaps[i].z;
          if (dist < rad) {
            float falloff = smoothstep(rad, 0.0, dist);
            nextB = max(nextB, falloff * 0.92);
            nextA = min(nextA, 1.0 - falloff * 0.75);
          }
        }
      }
      
      outColor = vec4(clamp(nextA, 0.0, 1.0), clamp(nextB, 0.0, 1.0), 0.0, 1.0);
    }
  `;

  const fsScreen = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;
    
    uniform sampler2D uState;
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    uniform vec3 uColorMid;
    uniform vec2 uResolution;
    uniform float uOpacity;
    uniform float uFade;

    void main() {
      float B = texture(uState, vUv).g;
      vec2 texel = 1.0 / uResolution;
      float neighbours = (
        texture(uState, vUv + vec2(texel.x, 0.0)).g +
        texture(uState, vUv - vec2(texel.x, 0.0)).g +
        texture(uState, vUv + vec2(0.0, texel.y)).g +
        texture(uState, vUv - vec2(0.0, texel.y)).g
      ) * 0.25;

      float band = smoothstep(0.04, 0.15, B) * (1.0 - smoothstep(0.34, 0.54, B));
      float core = smoothstep(0.18, 0.44, B);
      float boundary = smoothstep(0.005, 0.075, abs(B - neighbours));
      float val = clamp(band * 0.74 + core * 0.38 + boundary * 0.70, 0.0, 1.0);
      
      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, val));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, val));

      float glintGate = step(0.986, fract(sin(dot(vUv, vec2(41.3, 289.1))) * 43758.5453));
      float glint = glintGate * smoothstep(0.85, 1.0, val) * 0.12;
      col = mix(col, vec3(1.0), glint);

      float alpha = val * 0.95 * uOpacity * uFade;
      outColor = vec4(col * alpha, alpha);
    }
  `;

  function rgbToNormalizedArray(rgbString) {
    const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1])/255, parseInt(match[2])/255, parseInt(match[3])/255];
  }

  function readFxConfig(name, presets) {
    const root = window.__piloFxConfig || {};
    const scoped = (root.effects && root.effects[name]) || root[name] || {};
    const source = typeof scoped === 'object' ? scoped : {};
    const presetName = typeof source.preset === 'string' ? source.preset : '';
    const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      presetName,
      preset: presets[presetName] || null,
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
      if (!this.gl) throw new Error("WebGL2 not supported");

      if (!this.gl.getExtension('EXT_color_buffer_float')) {
        console.warn('reaction-diffusion: EXT_color_buffer_float unavailable; skipping effect');
        return;
      }
      
      this.presets = {
        'coral': { f: [0.054, 0.056], k: [0.061, 0.063] },
        'mitosis': { f: [0.036, 0.038], k: [0.064, 0.066] },
        'maze': { f: [0.028, 0.030], k: [0.056, 0.058] }
      };

      this.fx = readFxConfig('reaction-diffusion', this.presets);

      const chooseRange = (min, max) => this.fx.preset ? (min + max) / 2 : min + Math.random() * (max - min);
      const keys = Object.keys(this.presets);
      const chosen = this.fx.preset ? this.fx.presetName : keys[Math.floor(Math.random() * keys.length)];
      const raw = this.presets[chosen];
      
      this.currentPreset = {
        f: chooseRange(raw.f[0], raw.f[1]),
        k: chooseRange(raw.k[0], raw.k[1]),
        dA: 1.0,
        dB: 0.5
      };

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
      this.simWidth = Math.max(1, Math.floor(window.innerWidth / 4));
      this.simHeight = Math.max(1, Math.floor(pageHeight / 4));
      this.canvas.width = Math.floor(window.innerWidth * dpr);
      this.canvas.height = Math.floor(pageHeight * dpr);
      this.resetTextures();
    }
    
    resetTextures() {
      const gl = this.gl;
      const data = new Float32Array(this.simWidth * this.simHeight * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 1.0;
        data[i+1] = 0.0;
        data[i+2] = 0.0;
        data[i+3] = 1.0;
      }
      
      // Habitat coverage nodes (header bloom whitespace, left/right margins, footer)
      const seedPoints = [];
      if (this.fx.seedRegions && this.fx.seedRegions.length) {
        for (const r of this.fx.seedRegions) {
          seedPoints.push([r.x * this.simWidth, (1 - r.y) * this.simHeight]);
        }
      }
      const fallbackCoverage = [
        [0.70 * this.simWidth, 0.85 * this.simHeight],
        [0.86 * this.simWidth, 0.80 * this.simHeight],
        [0.08 * this.simWidth, 0.75 * this.simHeight],
        [0.06 * this.simWidth, 0.50 * this.simHeight],
        [0.09 * this.simWidth, 0.25 * this.simHeight],
        [0.93 * this.simWidth, 0.65 * this.simHeight],
        [0.94 * this.simWidth, 0.40 * this.simHeight],
        [0.92 * this.simWidth, 0.18 * this.simHeight],
        [0.35 * this.simWidth, 0.06 * this.simHeight],
        [0.65 * this.simWidth, 0.04 * this.simHeight]
      ];
      for (const p of fallbackCoverage) seedPoints.push(p);

      const seedCount = Math.max(32, Math.min(64, Math.round(this.simHeight / 20)));
      for (let s = 0; s < seedCount; s++) {
        const base = seedPoints[s % seedPoints.length];
        const cx = Math.max(2, Math.min(this.simWidth - 3, base[0] + (Math.random() - 0.5) * 24.0));
        const cy = Math.max(2, Math.min(this.simHeight - 3, base[1] + (Math.random() - 0.5) * 24.0));
        
        let radius = 1.5 + Math.random() * 2.0;
        for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(this.simHeight, cy + radius); y++) {
          for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(this.simWidth, cx + radius); x++) {
            let dist = Math.sqrt((x - cx)*(x - cx) + (y - cy)*(y - cy));
            if (dist < radius) {
              let idx = (y * this.simWidth + x) * 4;
              data[idx+1] = 1.0; 
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

      // GPU Warm-Start: run 450 passes synchronously so patterns are fully formed on frame 0
      this.stepSimulation(450, 0, null);
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
      gl.uniform2f(gl.getUniformLocation(this.progProcess, "uResolution"), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uTime"), simTime);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "f"), this.currentPreset.f);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "k"), this.currentPreset.k);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "dA"), this.currentPreset.dA);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "dB"), this.currentPreset.dB);
      gl.uniform4fv(gl.getUniformLocation(this.progProcess, "uTaps"), tapData || this.emptyTaps);

      for (let i = 0; i < iterations; i++) {
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

      const stepsPerFrame = this.fx.reducedMotion ? 2 : Math.max(6, Math.round(10 * this.fx.motionScale));
      this.stepSimulation(stepsPerFrame, this.time, tapData);
      
      // Screen Pass
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      
      gl.useProgram(this.progScreen);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorBase"), this.colorBase[0], this.colorBase[1], this.colorBase[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorTip"), this.colorTip[0], this.colorTip[1], this.colorTip[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorMid"), this.colorMid[0], this.colorMid[1], this.colorMid[2]);
      gl.uniform2f(gl.getUniformLocation(this.progScreen, "uResolution"), this.simWidth, this.simHeight);
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
