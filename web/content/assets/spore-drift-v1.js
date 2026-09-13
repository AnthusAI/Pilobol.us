// Spores drifting on an air current: agents advected by a curl-noise flow
// field (Bridson et al.), depositing a short, fast-decaying trail instead of
// physarum-v17.js's reinforced, persistent trail network. Visually this
// reads as loose drifting motes rather than a growing vein structure --
// deliberately the most "ambient" of the effects, no branching or growth.
const SporeDrift = (() => {
  const vsQuad = `#version 300 es
    in vec2 position;
    out vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fsUpdateAgents = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;

    uniform sampler2D uAgents;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uMoveSpeed;
    uniform vec2 uDrift;
    uniform vec4 uTaps[4];

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    // Curl of a scalar noise potential is divergence-free
    vec2 curl(vec2 p) {
      float e = 0.7;
      float n1 = valueNoise(p + vec2(0.0, e));
      float n2 = valueNoise(p - vec2(0.0, e));
      float n3 = valueNoise(p + vec2(e, 0.0));
      float n4 = valueNoise(p - vec2(e, 0.0));
      float dx = (n1 - n2) / (2.0 * e);
      float dy = (n3 - n4) / (2.0 * e);
      return vec2(dy, -dx);
    }

    void main() {
      vec4 agent = texture(uAgents, vUv);
      vec2 pos = agent.xy;

      vec2 flow = curl(pos * 0.006 + vec2(uTime * 0.03, -uTime * 0.02));
      pos += (flow + uDrift) * uMoveSpeed;

      // Touch responsiveness: if an agent is near a tap, burst/scatter outward
      for (int i = 0; i < 4; i++) {
        if (uTaps[i].z > 0.0 && uTaps[i].w > 0.0) {
          vec2 tapCoord = uTaps[i].xy * uResolution;
          vec2 diff = pos - tapCoord;
          float dist = length(diff);
          float rad = uTaps[i].z * uResolution.y;
          if (dist < rad && dist > 0.001) {
            float burstForce = (1.0 - dist / rad) * 12.0 * uTaps[i].w;
            vec2 dir = diff / dist;
            pos += dir * burstForce;
          }
        }
      }

      // Wrap rather than reflect
      pos = mod(pos, uResolution);

      outColor = vec4(pos, agent.z, 1.0);
    }
  `;

  const vsRenderAgents = `#version 300 es
    precision highp float;
    uniform sampler2D uAgents;
    uniform vec2 uResolution;
    void main() {
      int texSize = textureSize(uAgents, 0).x;
      int x = gl_VertexID % texSize;
      int y = gl_VertexID / texSize;
      vec2 uv = (vec2(x, y) + 0.5) / float(texSize);
      vec4 agent = texture(uAgents, uv);
      vec2 ndc = (agent.xy / uResolution) * 2.0 - 1.0;
      gl_Position = vec4(ndc, 0.0, 1.0);
      gl_PointSize = 1.5;
    }
  `;

  const fsRenderAgents = `#version 300 es
    precision highp float;
    out vec4 outColor;
    void main() { outColor = vec4(0.7, 0.7, 0.7, 1.0); }
  `;

  const fsProcessTrail = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;
    uniform sampler2D uTrail;
    uniform vec2 uResolution;
    uniform float uDiffusion;
    uniform float uDecay;
    uniform vec4 uTaps[4];

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }

    void main() {
      vec2 texel = 1.0 / uResolution;
      float current = texture(uTrail, vUv).r;
      float sum = 0.0;
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          sum += texture(uTrail, fract(vUv + vec2(x, y) * texel)).r;
        }
      }
      float blurred = sum / 9.0;
      float finalBlur = mix(current, blurred, uDiffusion);
      float decayed = clamp(finalBlur - uDecay, 0.0, 1.0);

      // Smooth circular tap deposit in the trail buffer
      for (int i = 0; i < 4; i++) {
        if (uTaps[i].z > 0.0 && uTaps[i].w > 0.0) {
          vec2 tapCoord = uTaps[i].xy;
          vec2 aspectDiff = (vUv - tapCoord) * vec2(uResolution.x / uResolution.y, 1.0);
          float dist = length(aspectDiff);
          float rad = uTaps[i].z;
          if (dist < rad) {
            float falloff = smoothstep(rad, 0.0, dist);
            float mottle = 0.8 + 0.2 * hash(vUv * 50.0 + uTaps[i].xy * 19.0);
            decayed = max(decayed, falloff * mottle * uTaps[i].w * 0.95);
          }
        }
      }

      outColor = vec4(decayed, decayed, decayed, 1.0);
    }
  `;

  const fsDrawScreen = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outColor;
    uniform sampler2D uTrail;
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    uniform vec3 uColorMid;
    uniform float uOpacity;
    uniform float uFade;

    void main() {
      float val = texture(uTrail, vUv).r;
      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, val));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, val));

      // Tiny glint highlight
      float glintGate = step(0.986, fract(sin(dot(vUv, vec2(41.3, 289.1))) * 43758.5453));
      float glint = glintGate * smoothstep(0.85, 1.0, val) * 0.12;
      col = mix(col, vec3(1.0), glint);

      float alpha = val * 0.75 * uOpacity * uFade;
      outColor = vec4(col * alpha, alpha);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  function createTexture(gl, width, height, data, internalFormat, format, type) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return tex;
  }

  function createFBO(gl, tex) {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return fbo;
  }

  function rgbToNormalizedArray(rgbStr) {
    const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) return [parseInt(match[1]) / 255, parseInt(match[2]) / 255, parseInt(match[3]) / 255];
    return [0, 0, 0];
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
      if (!this.gl) throw new Error('WebGL2 not supported');

      if (!this.gl.getExtension('EXT_color_buffer_float')) {
        console.warn('spore-drift: EXT_color_buffer_float unavailable; skipping effect');
        return;
      }

      this.fx = readFxConfig('spore-drift');
      // Substantially increased spore counts (3x-4x) for lush, visible motes & ribbons
      this.presets = {
        'still-air': { agentCount: 16384, moveSpeed: 0.22, drift: [0.00, 0.04], diffusion: 0.032, decay: 0.022 },
        crosswind: { agentCount: 22500, moveSpeed: 0.40, drift: [0.82, 0.03], diffusion: 0.020, decay: 0.028 },
        updraft: { agentCount: 19600, moveSpeed: 0.32, drift: [0.05, 0.92], diffusion: 0.026, decay: 0.024 }
      };
      const presetNames = Object.keys(this.presets);
      const chosenName = this.presets[this.fx.presetName]
        ? this.fx.presetName
        : presetNames[Math.floor(Math.random() * presetNames.length)];
      this.currentPreset = this.presets[chosenName];
      this.canvas.dataset.piloFxVariant = chosenName;

      this.emptyTaps = new Float32Array(16);
      this.activeTaps = [];

      this.moveSpeed = this.currentPreset.moveSpeed * this.fx.motionScale;
      this.agentTexSize = Math.ceil(Math.sqrt(this.currentPreset.agentCount));
      this.numAgents = this.agentTexSize * this.agentTexSize;

      this.colorBase = [0, 0, 0];
      this.colorTip = [1, 1, 1];
      this.colorMid = [0.6, 0.6, 0.6];
      this.readColors();
      this.fadeStart = performance.now();

      this.init();
      this.resize();
      this.canvas.dataset.piloFxReady = 'true';
      this.canvas.dataset.piloFxMode = 'live';
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('pilo:canvasresize', () => this.resize());

      this.time = 0;
      this.running = true;
      requestAnimationFrame((t) => this.render(t));

      document.addEventListener('visibilitychange', () => {
        this.running = document.visibilityState === 'visible';
        if (this.running) requestAnimationFrame((t) => this.render(t));
      });
    }

    init() {
      const gl = this.gl;
      const vsQ = createShader(gl, gl.VERTEX_SHADER, vsQuad);
      const vsR = createShader(gl, gl.VERTEX_SHADER, vsRenderAgents);
      const fsU = createShader(gl, gl.FRAGMENT_SHADER, fsUpdateAgents);
      const fsR = createShader(gl, gl.FRAGMENT_SHADER, fsRenderAgents);
      const fsP = createShader(gl, gl.FRAGMENT_SHADER, fsProcessTrail);
      const fsS = createShader(gl, gl.FRAGMENT_SHADER, fsDrawScreen);

      this.progUpdate = createProgram(gl, vsQ, fsU);
      this.progRenderAgents = createProgram(gl, vsR, fsR);
      this.progProcess = createProgram(gl, vsQ, fsP);
      this.progScreen = createProgram(gl, vsQ, fsS);

      const quadData = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
      this.quadVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);

      this.vaoQuad = gl.createVertexArray();
      gl.bindVertexArray(this.vaoQuad);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      const posLoc = gl.getAttribLocation(this.progProcess, 'position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      this.vaoAgents = gl.createVertexArray();
    }

    resize() {
      const pageHeight = Math.max(window.innerHeight, this.canvas.clientHeight || 0);
      const maxCanvas = this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE) || 8192;
      const dprLimit = pageHeight > window.innerHeight * 2 ? 1.25 : 2.0;
      const dpr = Math.min(window.devicePixelRatio, dprLimit, maxCanvas / window.innerWidth, maxCanvas / pageHeight);
      this.simWidth = Math.floor(window.innerWidth / 2);
      this.simHeight = Math.floor(pageHeight / 2);
      this.canvas.width = Math.floor(window.innerWidth * dpr);
      this.canvas.height = Math.floor(pageHeight * dpr);
      this.resetTextures();
    }

    resetTextures() {
      const gl = this.gl;
      const agentsData = new Float32Array(this.numAgents * 4);

      // Header-anchored nodes in WebGL bottom-up coordinates (y = 1.0 - page_fraction)
      // Viewport header height in sim coordinates:
      const viewportFraction = Math.min(1.0, window.innerHeight / Math.max(1, this.canvas.clientHeight || window.innerHeight));
      const headerTop = this.simHeight;
      const headerBottom = Math.max(0, this.simHeight * (1.0 - 0.35 * viewportFraction));

      // Dense spore clusters in the top-right header area next to H1:
      // In WebGL bottom-up, top of page is y ~ 0.85 - 0.98
      const headerClusters = [
        [0.68 * this.simWidth, 0.92 * this.simHeight, 45.0], // Top right header immediate beside H1
        [0.78 * this.simWidth, 0.90 * this.simHeight, 55.0], // Top right header bloom center
        [0.88 * this.simWidth, 0.88 * this.simHeight, 60.0], // Top right outer corner
        [0.62 * this.simWidth, 0.85 * this.simHeight, 50.0], // Under header bloom
        [0.82 * this.simWidth, 0.82 * this.simHeight, 50.0]  // Diagonal drift plume
      ];

      // Margin and body coverage nodes
      const marginNodes = [
        [0.08 * this.simWidth, 0.78 * this.simHeight, 40.0],
        [0.06 * this.simWidth, 0.50 * this.simHeight, 45.0],
        [0.09 * this.simWidth, 0.25 * this.simHeight, 40.0],
        [0.93 * this.simWidth, 0.65 * this.simHeight, 45.0],
        [0.94 * this.simWidth, 0.40 * this.simHeight, 45.0],
        [0.92 * this.simWidth, 0.18 * this.simHeight, 40.0],
        [0.35 * this.simWidth, 0.08 * this.simHeight, 50.0],
        [0.65 * this.simWidth, 0.05 * this.simHeight, 50.0]
      ];

      for (let i = 0; i < this.numAgents; i++) {
        let seedX, seedY;
        const roll = Math.random();
        if (roll < 0.55) {
          // 55% of all spores densely seeded in the top-right header beside H1
          const cluster = headerClusters[i % headerClusters.length];
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.sqrt(Math.random()) * cluster[2];
          seedX = Math.max(1, Math.min(this.simWidth - 1, cluster[0] + Math.cos(angle) * dist));
          seedY = Math.max(headerBottom, Math.min(this.simHeight - 1, cluster[1] + Math.sin(angle) * dist));
        } else if (roll < 0.80) {
          // 25% along margin paths
          const node = marginNodes[i % marginNodes.length];
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.sqrt(Math.random()) * node[2];
          seedX = Math.max(1, Math.min(this.simWidth - 1, node[0] + Math.cos(angle) * dist));
          seedY = Math.max(1, Math.min(this.simHeight - 1, node[1] + Math.sin(angle) * dist));
        } else {
          // 20% broad atmospheric drift
          seedX = Math.random() * this.simWidth;
          seedY = Math.random() * this.simHeight;
        }
        agentsData[i * 4 + 0] = seedX;
        agentsData[i * 4 + 1] = seedY;
        agentsData[i * 4 + 2] = 0.0;
        agentsData[i * 4 + 3] = 1.0;
      }
      this.texAgentsA = createTexture(gl, this.agentTexSize, this.agentTexSize, agentsData, gl.RGBA32F, gl.RGBA, gl.FLOAT);
      this.texAgentsB = createTexture(gl, this.agentTexSize, this.agentTexSize, null, gl.RGBA32F, gl.RGBA, gl.FLOAT);
      this.fboAgentsA = createFBO(gl, this.texAgentsA);
      this.fboAgentsB = createFBO(gl, this.texAgentsB);

      this.texTrailA = createTexture(gl, this.simWidth, this.simHeight, null, gl.R32F, gl.RED, gl.FLOAT);
      this.texTrailB = createTexture(gl, this.simWidth, this.simHeight, null, gl.R32F, gl.RED, gl.FLOAT);
      this.fboTrailA = createFBO(gl, this.texTrailA);
      this.fboTrailB = createFBO(gl, this.texTrailB);

      // GPU Warm-Start: 70 iterations so drifting ribbons and trails are fully formed on frame 0
      this.stepSimulation(70, 0, null);
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
      for (let i = 0; i < iterations; i++) {
        const stepTime = simTime + i * 0.02;

        // 1. Update Spore Positions
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboAgentsB);
        gl.viewport(0, 0, this.agentTexSize, this.agentTexSize);
        gl.useProgram(this.progUpdate);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texAgentsA);
        gl.uniform1i(gl.getUniformLocation(this.progUpdate, 'uAgents'), 0);
        gl.uniform2f(gl.getUniformLocation(this.progUpdate, 'uResolution'), this.simWidth, this.simHeight);
        gl.uniform1f(gl.getUniformLocation(this.progUpdate, 'uTime'), stepTime);
        gl.uniform1f(gl.getUniformLocation(this.progUpdate, 'uMoveSpeed'), this.moveSpeed);
        gl.uniform2f(gl.getUniformLocation(this.progUpdate, 'uDrift'), this.currentPreset.drift[0], this.currentPreset.drift[1]);
        gl.uniform4fv(gl.getUniformLocation(this.progUpdate, 'uTaps'), tapData || this.emptyTaps);
        gl.bindVertexArray(this.vaoQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 2. Render Spore Points to Trail
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboTrailA);
        gl.viewport(0, 0, this.simWidth, this.simHeight);
        gl.useProgram(this.progRenderAgents);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texAgentsB);
        gl.uniform1i(gl.getUniformLocation(this.progRenderAgents, 'uAgents'), 0);
        gl.uniform2f(gl.getUniformLocation(this.progRenderAgents, 'uResolution'), this.simWidth, this.simHeight);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.bindVertexArray(this.vaoAgents);
        gl.drawArrays(gl.POINTS, 0, this.numAgents);
        gl.disable(gl.BLEND);

        let tempTex = this.texAgentsA; this.texAgentsA = this.texAgentsB; this.texAgentsB = tempTex;
        let tempFbo = this.fboAgentsA; this.fboAgentsA = this.fboAgentsB; this.fboAgentsB = tempFbo;

        // 3. Process Trail Diffusion, Decay, and Circular Tap Deposits
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboTrailB);
        gl.viewport(0, 0, this.simWidth, this.simHeight);
        gl.useProgram(this.progProcess);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texTrailA);
        gl.uniform1i(gl.getUniformLocation(this.progProcess, 'uTrail'), 0);
        gl.uniform2f(gl.getUniformLocation(this.progProcess, 'uResolution'), this.simWidth, this.simHeight);
        gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uDiffusion'), this.currentPreset.diffusion);
        gl.uniform1f(gl.getUniformLocation(this.progProcess, 'uDecay'), this.currentPreset.decay);
        gl.uniform4fv(gl.getUniformLocation(this.progProcess, 'uTaps'), tapData || this.emptyTaps);
        gl.bindVertexArray(this.vaoQuad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        tempTex = this.texTrailA; this.texTrailA = this.texTrailB; this.texTrailB = tempTex;
        tempFbo = this.fboTrailA; this.fboTrailA = this.fboTrailB; this.fboTrailB = tempFbo;
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
      gl.useProgram(this.progScreen);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texTrailA);
      gl.uniform1i(gl.getUniformLocation(this.progScreen, 'uTrail'), 0);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, 'uColorBase'), this.colorBase[0], this.colorBase[1], this.colorBase[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, 'uColorTip'), this.colorTip[0], this.colorTip[1], this.colorTip[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, 'uColorMid'), this.colorMid[0], this.colorMid[1], this.colorMid[2]);
      gl.uniform1f(gl.getUniformLocation(this.progScreen, 'uOpacity'), this.fx.opacity);
      gl.uniform1f(gl.getUniformLocation(this.progScreen, 'uFade'), Math.min(1, (performance.now() - this.fadeStart) / this.fx.fadeInMs));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.vaoQuad);
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
