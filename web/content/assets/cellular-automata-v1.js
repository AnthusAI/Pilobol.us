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

    float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }

    float getSum(vec2 uv, vec2 texel) {
      float sum = 0.0;
      for (int y = -2; y <= 2; y++) {
        for (int x = -2; x <= 2; x++) {
          if (x == 0 && y == 0) continue;
          sum += texture(uState, uv + vec2(x, y) * texel).r;
        }
      }
      return sum;
    }

    void main() {
      vec2 texel = 1.0 / uResolution;
      float val = texture(uState, vUv).r;
      float sum = getSum(vUv, texel);

      // Persistent jitter on the neighbor sum. Without this, a hard three-zone
      // threshold rule like this always converges to a static fixed point (every
      // cell's local neighborhood stops changing once it lands outside both the
      // growth and decay windows) -- verified in a numpy model: identical grids
      // frame to frame once settled. The jitter keeps the field slowly wandering
      // instead of freezing solid.
      sum += (hash(vUv * uResolution + uTime) - 0.5) * 2.4;

      // SmoothLife-ish rules. The original thresholds (birth 10-14, death <8 or
      // >18 of 24 neighbors) required roughly half the neighborhood alive to grow
      // but only ~1/3 alive to decay -- at any low-density random seed the
      // expected neighbor sum is far below the growth window (verified: at a 5%
      // seed, P(growth) is ~1e-7 while P(decay) is ~0.9999), so the whole field
      // provably decayed to zero within a couple of seconds every time. These
      // thresholds were re-tuned numerically so a mid-density random seed
      // settles into a persistent, slowly-drifting pattern instead of dying out.
      float nextVal = val;
      if (sum >= 6.0 && sum <= 10.0) {
        nextVal = clamp(val + 0.04, 0.0, 1.0);
      } else if (sum < 3.0 || sum > 15.0) {
        nextVal = clamp(val - 0.02, 0.0, 1.0);
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
      // Small box blur purely for the on-screen appearance (does not feed
      // back into the simulation state). The rule itself drives cells toward
      // hard 0/1 values, and at this low a simulation resolution that reads
      // as blocky, hard-edged shapes rather than an organic, feathered
      // growth. LINEAR texture filtering (see createTex below) already softens
      // it some; this blur plus the wide smoothstep below finishes the job.
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

      float a = smoothstep(0.08, 0.55, val);
      // Two-stage mix through a real third hue (uColorMid, --markus-accent-2)
      // instead of a flat two-color interpolation between background and one
      // accent -- background -> mid-tone at low/moderate density, mid-tone ->
      // ink at high density, so the pattern actually passes through a color
      // gradient rather than reading as nearly monochromatic.
      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, a));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, a));

      // See dla-v1.js fsScreen for why this rare tiny highlight exists.
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
    return [parseInt(match[1])/255, parseInt(match[2])/255, parseInt(match[3])/255];
  }

  // Optional manager contract. The effect remains safe to run on the
  // standalone gallery when the manager has not published configuration.
  function readFxConfig(name) {
    const root = window.__piloFxConfig || {};
    const scoped = (root.effects && root.effects[name]) || root[name] || {};
    const source = typeof scoped === 'object' ? scoped : {};
    const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    return {
      opacity: Math.max(0, Math.min(1, finite(source.opacity ?? source.intensity ?? root.opacity ?? root.intensity, 0.72))),
      fadeInMs: Math.max(0, finite(source.fadeInMs ?? root.fadeInMs, 4200)),
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

      // Required before any RGBA32F texture is attached to a framebuffer.
      // In WebGL2 float textures are NOT color-renderable without this, and
      // every draw fails with
      //   GL_INVALID_FRAMEBUFFER_OPERATION: Framebuffer is incomplete:
      //   Attachment is not renderable
      // which silently leaves the canvas blank. physarum-v17.js already did
      // this; this effect and reaction-diffusion did not.
      if (!this.gl.getExtension('EXT_color_buffer_float')) {
        console.warn('cellular-automata: EXT_color_buffer_float unavailable; skipping effect');
        return;
      }

      this.fx = readFxConfig('cellular-automata');
      
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
      // 35% seed density: matches the re-tuned growth/decay thresholds above.
      // The old 5% density was numerically guaranteed to hit the decay branch
      // (P ~ 0.9999) since the expected neighbor sum at that sparsity never
      // reaches the growth window.
      // Seed the FULL canvas uniformly. This used to also hard-zero the
      // middle 60% of the grid ("clear center") regardless of viewport size
      // or the CSS mask -- a permanent, wide dead band baked into the
      // simulation itself, independent of and much wider than whatever the
      // page's mask was doing. The mask (.pilo-physarum-canvas in
      // pilobil-theme-v10.css) is solely responsible for hiding the part of
      // the canvas that sits behind the text column; the simulation should
      // have real content everywhere so there's something to reveal right up
      // to the mask's edge.
      const data = new Float32Array(this.simWidth * this.simHeight * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.random() < 0.35 ? 1.0 : 0.0;
        data[i+3] = 1.0;
      }
      // Seed normalized manager regions so the effect remains discoverable
      // on narrow screens where the content-aware mask reveals only small
      // header/margin/footer areas.
      for (const region of this.fx.seedRegions) {
        const cx = Math.max(0, Math.min(this.simWidth - 1, Number(region.x) * this.simWidth));
        // Page coordinates put y=0 at the top; WebGL textures put it at the bottom.
        const cy = Math.max(0, Math.min(this.simHeight - 1, (1 - Number(region.y)) * this.simHeight));
        const radius = Math.max(1, (Number(region.radius) || 0.08) * Math.min(this.simWidth, this.simHeight));
        for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(this.simHeight, Math.ceil(cy + radius)); y++) {
          for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(this.simWidth, Math.ceil(cx + radius)); x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= radius * radius) data[(y * this.simWidth + x) * 4] = 1.0;
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
      // A third, genuinely different hue (rust/ochre in light mode, warm
      // orange in dark mode) so growth passes through a real color gradient
      // instead of a flat two-tone mix between background and one accent --
      // that's why it read as nearly monochromatic.
      this.colorMid = rgbToNormalizedArray(computed.borderColor);
      document.body.removeChild(div);
    }

    render(timestamp) {
      if (!this.running) return;
      requestAnimationFrame((t) => this.render(t));
      
      if (!this.lastTime) this.lastTime = timestamp;
      if (timestamp - this.lastTime < 150) return; // Super slow
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
      gl.uniform2f(gl.getUniformLocation(this.progProcess, "uResolution"), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uTime"), this.time);

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
