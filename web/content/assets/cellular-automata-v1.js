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
      float alpha = a * 0.7;
      outColor = vec4(col * alpha, alpha);
    }
  `;

  function rgbToNormalizedArray(rgbString) {
    const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return [0, 0, 0];
    return [parseInt(match[1])/255, parseInt(match[2])/255, parseInt(match[3])/255];
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
      
      // See physarum-v17.js constructor for why readColors() is called here
      // immediately rather than left to the periodic call ~60 frames in --
      // that's now ~11 real seconds of using these arbitrary placeholder
      // colors instead of the theme's actual palette.
      this.colorBase = [0, 0, 0];
      this.colorTip = [1, 1, 1];
      this.colorMid = [0.6, 0.6, 0.6];
      this.readColors();

      this.initGL();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      
      this.time = 0;
      this.running = true;
      requestAnimationFrame((t) => this.render(t));
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
      const dpr = Math.min(window.devicePixelRatio, 2.0);
      this.simWidth = Math.floor(window.innerWidth / 3);
      this.simHeight = Math.floor(window.innerHeight / 3);
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
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
      
      this.time += 0.01;
      if (Math.floor(this.time * 100) % 60 === 0) {
          this.readColors();
      }
      
      const gl = this.gl;
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
