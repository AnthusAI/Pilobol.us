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

    void main() {
      float B = texture(uState, vUv).g;
      float val = smoothstep(0.1, 0.6, B);
      // See physarum-v17.js fsDrawScreen for why this mixes toward uColorBase
      // (dark ink in light mode) rather than uColorTip (accent) as density
      // rises: the densest pattern should read as the strongest stain, not
      // the lightest pixel on the page. Two-stage mix through uColorMid
      // (--markus-accent-2) for a real color gradient instead of a flat
      // two-tone interpolation.
      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, val));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, val));
      float alpha = val * 0.7;
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

      const randomRange = (min, max) => min + Math.random() * (max - min);
      const keys = Object.keys(this.presets);
      const chosen = keys[Math.floor(Math.random() * keys.length)];
      const raw = this.presets[chosen];
      
      this.currentPreset = {
        f: randomRange(raw.f[0], raw.f[1]),
        k: randomRange(raw.k[0], raw.k[1]),
        dA: 1.0,
        dB: 0.5
      };

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
      // Simulating RD at full res is too expensive. We run at 1/3 resolution.
      const dpr = Math.min(window.devicePixelRatio, 2.0);
      this.simWidth = Math.floor(window.innerWidth / 3);
      this.simHeight = Math.floor(window.innerHeight / 3);
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
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
      
      // Seed 20 random spots strictly in the outer 25% margins
      for (let s = 0; s < 20; s++) {
        let isLeft = Math.random() > 0.5;
        let cx = isLeft ? Math.random() * (this.simWidth * 0.25) : this.simWidth - Math.random() * (this.simWidth * 0.25);
        let cy = Math.random() * this.simHeight;
        
        let radius = 5 + Math.random() * 5;
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
      
      // Throttle for slow growth. Was 66ms (~15fps) x 4 sub-steps/frame below,
      // i.e. ~60 simulation steps/sec -- far too fast for a "gradual, creeping"
      // feel. Slowed ~6x overall between this and the sub-step count below.
      if (!this.lastTime) this.lastTime = timestamp;
      if (timestamp - this.lastTime < 150) return;
      this.lastTime = timestamp;
      
      this.time += 0.01;
      if (Math.floor(this.time * 100) % 60 === 0) {
          this.readColors();
      }
      
      const gl = this.gl;
      gl.bindVertexArray(this.vao);
      
      // Process Pass
      gl.useProgram(this.progProcess);
      gl.uniform2f(gl.getUniformLocation(this.progProcess, "uResolution"), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "f"), this.currentPreset.f);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "k"), this.currentPreset.k);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "dA"), this.currentPreset.dA);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "dB"), this.currentPreset.dB);

      for (let i = 0; i < 1; i++) {
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
