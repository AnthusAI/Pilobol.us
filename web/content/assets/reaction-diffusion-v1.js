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
    uniform float f;
    uniform float k;
    uniform float dA;
    uniform float dB;
    
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
      
      float nextA = A + (dA * laplace.r - reaction + f * (1.0 - A));
      float nextB = B + (dB * laplace.g + reaction - (k + f) * B);
      
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

      // Show the living boundary and mid-concentration bands, not merely a
      // smooth, filled B-concentration blob. This is where the recognisable
      // coral / mitosis / maze structure lives in a Gray-Scott field.
      float band = smoothstep(0.045, 0.15, B) * (1.0 - smoothstep(0.34, 0.54, B));
      float core = smoothstep(0.20, 0.44, B);
      float boundary = smoothstep(0.006, 0.075, abs(B - neighbours));
      float val = clamp(band * 0.74 + core * 0.34 + boundary * 0.68, 0.0, 1.0);
      // See physarum-v17.js fsDrawScreen for why this mixes toward uColorBase
      // (dark ink in light mode) rather than uColorTip (accent) as density
      // rises: the densest pattern should read as the strongest stain, not
      // the lightest pixel on the page. Two-stage mix through uColorMid
      // (--markus-accent-2) for a real color gradient instead of a flat
      // two-tone interpolation.
      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, val));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, val));

      // See dla-v1.js fsScreen for why this rare tiny highlight exists.
      float glintGate = step(0.986, fract(sin(dot(vUv, vec2(41.3, 289.1))) * 43758.5453));
      float glint = glintGate * smoothstep(0.85, 1.0, val) * 0.12;
      col = mix(col, vec3(1.0), glint);

      float alpha = val * 0.92 * uOpacity * uFade;
      outColor = vec4(col * alpha, alpha);
    }
  `;

  function rgbToNormalizedArray(rgbString) {
    const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1])/255, parseInt(match[2])/255, parseInt(match[3])/255];
  }

  // Optional manager contract. Standalone effect pages continue to use the
  // built-in random presets when no config was published.
  function readFxConfig(name, presets) {
    const root = window.__piloFxConfig || {};
    const scoped = (root.effects && root.effects[name]) || root[name] || {};
    const source = typeof scoped === 'object' ? scoped : {};
    // Root preset names describe placement (header-bloom, footer-rise, ...),
    // so only an effect-scoped preset may select this algorithm's variant.
    const presetName = typeof source.preset === 'string' ? source.preset : '';
    const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      presetName,
      preset: presets[presetName] || null,
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
      if (!this.gl) throw new Error("WebGL2 not supported");

      // Required before any RGBA32F texture is attached to a framebuffer.
      // Without it WebGL2 float textures are not color-renderable and every
      // draw fails with 'Framebuffer is incomplete: Attachment is not
      // renderable', leaving the canvas blank with no visible error.
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

      // An explicitly named profile is exact; only the unconfigured gallery
      // chooses a point inside the deliberately narrow family range.
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
      this.warmupRemaining = 600;

      // See physarum-v17.js constructor for why readColors() is called here
      // immediately rather than left to the periodic call ~60 frames in --
      // that's now ~11 real seconds of using these arbitrary placeholder
      // colors instead of the theme's actual palette.
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
      // One simulation pixel becomes four CSS pixels. That is large enough
      // for the characteristic cellular bands to survive page compositing,
      // while keeping a full-document framebuffer practical on mobile.
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
      
      // Many small inoculation points generate separated fronts and cellular
      // interiors. The old 5-10px discs were so large that their first phase
      // read as a handful of creeping radial gradients.
      const seedCount = Math.max(24, Math.min(48, Math.round(this.simHeight / 26)));
      for (let s = 0; s < seedCount; s++) {
        let isLeft = Math.random() > 0.5;
        const [seedX, seedY] = pickSeed(this.fx.seedRegions, this.simWidth, this.simHeight, () => [
          isLeft ? Math.random() * (this.simWidth * 0.25) : this.simWidth - Math.random() * (this.simWidth * 0.25),
          Math.random() * this.simHeight
        ]);
        let cx = seedX;
        let cy = seedY;
        
        let radius = 1.25 + Math.random() * 1.5;
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
      this.warmupRemaining = 600;
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
      
      // The display remains deliberately unhurried, but chemical time cannot
      // run at display time: Gray-Scott structure takes hundreds of numerical
      // iterations to form. The old one-step/150ms loop needed minutes before
      // it showed anything beyond the initial soft discs.
      if (!this.lastTime) this.lastTime = timestamp;
      if (timestamp - this.lastTime < 120) return;
      this.lastTime = timestamp;
      
      this.time += 0.01 * (this.fx.reducedMotion ? 0.12 : this.fx.motionScale);
      if (Math.floor(this.time * 100) % 60 === 0) {
          this.readColors();
      }
      
      const gl = this.gl;
      if (window.__piloNutrients) {
        window.__piloNutrients.paint(gl, this.texA, this.simWidth, this.simHeight, 'reaction');
      }
      gl.bindVertexArray(this.vao);
      
      // Process Pass
      gl.useProgram(this.progProcess);
      gl.uniform2f(gl.getUniformLocation(this.progProcess, "uResolution"), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "f"), this.currentPreset.f);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "k"), this.currentPreset.k);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "dA"), this.currentPreset.dA);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "dB"), this.currentPreset.dB);

      const baseIterations = this.fx.reducedMotion
        ? 1
        : Math.max(6, Math.round(12 * this.fx.motionScale));
      const warmupIterations = Math.min(30, this.warmupRemaining);
      const iterations = baseIterations + warmupIterations;
      this.warmupRemaining = Math.max(0, this.warmupRemaining - warmupIterations);
      for (let i = 0; i < iterations; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
        gl.viewport(0, 0, this.simWidth, this.simHeight);
        gl.bindTexture(gl.TEXTURE_2D, this.texA);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        let tempTex = this.texA; this.texA = this.texB; this.texB = tempTex;
        let tempFbo = this.fboA; this.fboA = this.fboB; this.fboB = tempFbo;
      }
      
      // Screen Pass
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
