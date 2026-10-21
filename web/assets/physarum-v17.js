const Physarum = (() => {
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
    uniform sampler2D uTrail;
    
    uniform vec2 uResolution;
    uniform float uSensorAngle;
    uniform float uSensorDist;
    uniform float uTurnSpeed;
    uniform float uMoveSpeed;
    uniform float uTime;
    uniform vec4 uTaps[4];
    
    // Standard robust GLSL hash functions
    float hash(float n) { return fract(sin(n) * 43758.5453123); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }
    
    float sense(vec2 pos, float angle) {
      vec2 dir = vec2(cos(angle), sin(angle));
      vec2 sensorPos = pos + dir * uSensorDist;
      vec2 uv = sensorPos / uResolution;
      uv = clamp(uv, vec2(0.0), vec2(1.0));
      return texture(uTrail, uv).r;
    }
    
    void main() {
      vec4 agent = texture(uAgents, vUv);
      vec2 pos = agent.xy;
      float angle = agent.z;

      // Touch inoculation: burst a cluster of new exploratory agents
      // directly at the tapped spot, radiating outward
      for (int i = 0; i < 4; i++) {
        if (uTaps[i].z > 0.0 && uTaps[i].w > 0.0) {
          float agentHash = hash(vUv * 73.19 + vec2(uTime * 17.3, float(i) * 9.1));
          if (agentHash < 0.045) { // ~3,000 agents per tap burst outward
            vec2 tapSimPos = uTaps[i].xy * uResolution;
            float r = sqrt(hash(vUv * 157.3 + vec2(uTime, 1.23))) * uTaps[i].z * min(uResolution.x, uResolution.y) * 0.8;
            float a = hash(vUv * 91.7 + vec2(uTime * 2.1, 4.56)) * 6.2831853;
            pos = tapSimPos + vec2(cos(a), sin(a)) * r;
            angle = a;
          }
        }
      }
      
      float weightF = sense(pos, angle);
      float weightL = sense(pos, angle + uSensorAngle);
      float weightR = sense(pos, angle - uSensorAngle);
      
      // Continuous subtle wandering noise so agents maintain organic curvature
      float wander = (hash(pos + vec2(uTime * 0.2, vUv.x * 100.0)) - 0.5) * 0.14;
      
      if (weightF > weightL && weightF > weightR) {
        // Front smells strongest: advance with gentle wander
        angle += wander * 0.4;
      } else if (weightF < weightL && weightF < weightR) {
        // Both flanks smell stronger than forward: choose a branch
        float pick = hash(pos.xy + vec2(uTime, 3.14));
        angle += (pick > 0.5 ? uTurnSpeed : -uTurnSpeed) + wander;
      } else if (weightL > weightR) {
        angle += uTurnSpeed + wander;
      } else if (weightR > weightL) {
        angle -= uTurnSpeed + wander;
      } else {
        // Equal scent (open space or uniform trail): explore freely
        angle += wander * 2.2;
      }
      
      // Dynamic branching: when inside an overcrowded vein, break out
      // to seek fresh uncolonized territory and spawn new shoots
      if (weightF > 0.82) {
        float branchNoise = hash(pos * 1.33 + vec2(uTime, 7.19));
        angle += (branchNoise - 0.5) * 0.45;
      }
      
      vec2 dir = vec2(cos(angle), sin(angle));
      pos += dir * uMoveSpeed;
      
      // Soft boundary reflection
      if (pos.x < 1.0 || pos.x >= uResolution.x - 1.0) {
        pos.x = clamp(pos.x, 1.0, uResolution.x - 2.0);
        angle = 3.14159265 - angle + wander;
      }
      if (pos.y < 1.0 || pos.y >= uResolution.y - 1.0) {
        pos.y = clamp(pos.y, 1.0, uResolution.y - 2.0);
        angle = -angle + wander;
      }
      
      outColor = vec4(pos, angle, 1.0);
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
      
      vec2 pos = agent.xy;
      vec2 ndc = (pos / uResolution) * 2.0 - 1.0;
      
      gl_Position = vec4(ndc, 0.0, 1.0);
      gl_PointSize = 1.0;
    }
  `;

  const fsRenderAgents = `#version 300 es
    precision highp float;
    out vec4 outColor;
    void main() {
      // Additive deposit per agent
      outColor = vec4(0.20, 0.20, 0.20, 1.0);
    }
  `;

  const fsProcessTrail = `#version 300 es
    precision highp float;
    
    in vec2 vUv;
    out vec4 outColor;
    
    uniform sampler2D uTrail;
    uniform vec2 uResolution;
    uniform float uDecay;
    uniform vec4 uTaps[4];
    
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123); }
    
    void main() {
      vec2 texel = 1.0 / uResolution;
      
      // 3x3 weighted Gaussian diffusion kernel
      float sum = 0.0;
      sum += texture(uTrail, vUv + vec2(-1.0, -1.0) * texel).r * 0.0625;
      sum += texture(uTrail, vUv + vec2( 0.0, -1.0) * texel).r * 0.1250;
      sum += texture(uTrail, vUv + vec2( 1.0, -1.0) * texel).r * 0.0625;
      sum += texture(uTrail, vUv + vec2(-1.0,  0.0) * texel).r * 0.1250;
      sum += texture(uTrail, vUv).r * 0.2500;
      sum += texture(uTrail, vUv + vec2( 1.0,  0.0) * texel).r * 0.1250;
      sum += texture(uTrail, vUv + vec2(-1.0,  1.0) * texel).r * 0.0625;
      sum += texture(uTrail, vUv + vec2( 0.0,  1.0) * texel).r * 0.1250;
      sum += texture(uTrail, vUv + vec2( 1.0,  1.0) * texel).r * 0.0625;
      
      float current = texture(uTrail, vUv).r;
      float diffused = mix(current, sum, 0.22);
      float decayed = max(0.0, diffused - uDecay);
      
      // Smooth circular tap nutrient deposits with mottled organic spore knot
      for (int i = 0; i < 4; i++) {
        if (uTaps[i].z > 0.0 && uTaps[i].w > 0.0) {
          vec2 tapCoord = uTaps[i].xy;
          // Scale aspect ratio so nutrient deposit is a true circle
          vec2 aspectDiff = (vUv - tapCoord) * vec2(uResolution.x / uResolution.y, 1.0);
          float dist = length(aspectDiff);
          float rad = uTaps[i].z;
          if (dist < rad) {
            float knotNoise = hash(vUv * 90.0 + uTaps[i].xy * 41.0);
            float falloff = smoothstep(rad, 0.0, dist);
            // Persistent rich mold knot
            decayed = max(decayed, falloff * (0.88 + 0.12 * knotNoise));
          }
        }
      }
      
      decayed = clamp(decayed, 0.0, 1.0);
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
      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.45, val));
      col = mix(col, uColorBase, smoothstep(0.35, 0.95, val));

      // Rare subtle spore glint
      float glintGate = step(0.986, fract(sin(dot(vUv, vec2(41.3, 289.1))) * 43758.5453));
      float glint = glintGate * smoothstep(0.85, 1.0, val) * 0.12;
      col = mix(col, vec3(1.0), glint);

      float alpha = smoothstep(0.015, 0.30, val) * 0.88 * uOpacity * uFade;
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  function createFBO(gl, tex) {
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return fbo;
  }

  function rgbToNormalizedArray(rgbStr) {
    let match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        return [parseInt(match[1])/255, parseInt(match[2])/255, parseInt(match[3])/255];
    }
    return [0, 0, 0];
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
      reducedMotion: Boolean(source.reducedMotion ?? root.reducedMotion ?? (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)),
      seedRegions: Array.isArray(source.seedRegions ?? root.seedRegions) ? (source.seedRegions ?? root.seedRegions) : []
    };
  }

  class Simulation {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext("webgl2", { alpha: true, antialias: false });
      if (!this.gl) throw new Error("WebGL2 not supported");
      
      const ext = this.gl.getExtension("EXT_color_buffer_float");
      if (!ext) console.warn("EXT_color_buffer_float not available, might fail");

      // Calibrated presets: active continuous branching, balanced decay, and organic creep
      this.presets = {
        "creeping_veins": {
          sensorAngle: [0.35, 0.50],
          sensorDist: [8.0, 14.0],
          turnSpeed: [0.15, 0.25],
          moveSpeed: [0.75, 1.15],
          decay: [0.003, 0.005]
        },
        "spore_burst": {
          sensorAngle: [0.5, 0.75],
          sensorDist: [6.0, 10.0],
          turnSpeed: [0.20, 0.35],
          moveSpeed: [0.85, 1.30],
          decay: [0.004, 0.006]
        },
        "mycelium_threads": {
          sensorAngle: [0.22, 0.38],
          sensorDist: [12.0, 18.0],
          turnSpeed: [0.10, 0.18],
          moveSpeed: [0.80, 1.20],
          decay: [0.002, 0.004]
        },
        "crystallizing": {
          sensorAngle: [0.65, 0.90],
          sensorDist: [5.0, 9.0],
          turnSpeed: [0.28, 0.45],
          moveSpeed: [0.70, 1.05],
          decay: [0.003, 0.005]
        }
      };

      this.fx = readFxConfig("physarum", this.presets);

      const chooseRange = (min, max) => this.fx.preset ? (min + max) / 2 : min + Math.random() * (max - min);
      const presetKeys = Object.keys(this.presets);
      const chosenKey = this.fx.preset ? this.fx.presetName : presetKeys[Math.floor(Math.random() * presetKeys.length)];
      const rawPreset = this.presets[chosenKey];
      
      this.currentPreset = {
        sensorAngle: chooseRange(rawPreset.sensorAngle[0], rawPreset.sensorAngle[1]),
        sensorDist: chooseRange(rawPreset.sensorDist[0], rawPreset.sensorDist[1]),
        turnSpeed: chooseRange(rawPreset.turnSpeed[0], rawPreset.turnSpeed[1]),
        moveSpeed: chooseRange(rawPreset.moveSpeed[0], rawPreset.moveSpeed[1]),
        decay: chooseRange(rawPreset.decay[0], rawPreset.decay[1])
      };
      if (this.fx.preset) {
        const p = this.fx.preset;
        this.currentPreset = {
          sensorAngle: chooseRange(p.sensorAngle[0], p.sensorAngle[1]),
          sensorDist: chooseRange(p.sensorDist[0], p.sensorDist[1]),
          turnSpeed: chooseRange(p.turnSpeed[0], p.turnSpeed[1]),
          moveSpeed: chooseRange(p.moveSpeed[0], p.moveSpeed[1]),
          decay: chooseRange(p.decay[0], p.decay[1])
        };
      }

      this.agentTexSize = 256; 
      this.numAgents = this.agentTexSize * this.agentTexSize; // 65,536 agents
      this.emptyTaps = new Float32Array(16);
      this.activeTaps = [];
      
      this.colorBase = [0, 0, 0];
      this.colorTip = [0.5, 1, 0.5];
      this.colorMid = [0.6, 0.6, 0.6];
      this.readColors();
      this.fadeStart = performance.now();

      this.init();
      this.resize();
      this.canvas.dataset.piloFxReady = "true";
      this.canvas.dataset.piloFxMode = "live";
      window.addEventListener("resize", () => this.resize());
      document.addEventListener("pilo:canvasresize", () => this.resize());
      
      this.time = 0;
      this.running = true;
      requestAnimationFrame((t) => this.render(t));
      
      this.setupObserver();
    }
    
    setupObserver() {
      document.addEventListener("visibilitychange", () => {
        this.running = document.visibilityState === "visible";
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
      
      const quadData = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
      this.quadVbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
      
      this.vaoQuad = gl.createVertexArray();
      gl.bindVertexArray(this.vaoQuad);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
      const posLoc = gl.getAttribLocation(this.progProcess, "position"); 
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
      
      // Establish key colony habitat nodes across the unmasked regions
      // (header bloom whitespace, left margin, right margin, footer)
      const habitatAnchors = [];
      if (this.fx.seedRegions && this.fx.seedRegions.length) {
        for (const region of this.fx.seedRegions) {
          habitatAnchors.push({
            x: region.x * this.simWidth,
            y: (1 - region.y) * this.simHeight,
            radius: (region.radius || 0.16) * Math.min(this.simWidth, this.simHeight)
          });
        }
      }
      
      // Additional well-distributed nodes to guarantee full coverage across the margins and header
      const coverageNodes = [
        { x: 0.70, y: 0.15, r: 0.22 }, // Header bloom whitespace
        { x: 0.86, y: 0.20, r: 0.15 }, // Header top right
        { x: 0.08, y: 0.22, r: 0.14 }, // Left margin upper
        { x: 0.06, y: 0.48, r: 0.15 }, // Left margin mid
        { x: 0.09, y: 0.76, r: 0.14 }, // Left margin lower
        { x: 0.93, y: 0.32, r: 0.14 }, // Right margin upper
        { x: 0.94, y: 0.58, r: 0.15 }, // Right margin mid
        { x: 0.92, y: 0.82, r: 0.14 }, // Right margin lower
        { x: 0.32, y: 0.94, r: 0.18 }, // Footer left
        { x: 0.68, y: 0.96, r: 0.18 }  // Footer right
      ];
      for (const node of coverageNodes) {
        habitatAnchors.push({
          x: node.x * this.simWidth,
          y: (1 - node.y) * this.simHeight,
          radius: node.r * Math.min(this.simWidth, this.simHeight)
        });
      }

      // Seed agents: 70% in habitat colonies, 30% as pioneer hyphae across margins
      const clusterAgentCount = Math.floor(this.numAgents * 0.70);
      for (let i = 0; i < clusterAgentCount; i++) {
        const anchor = habitatAnchors[i % habitatAnchors.length];
        const r = Math.sqrt(Math.random()) * anchor.radius;
        const theta = Math.random() * Math.PI * 2.0;
        
        agentsData[i*4 + 0] = Math.max(1, Math.min(this.simWidth - 2, anchor.x + Math.cos(theta) * r));
        agentsData[i*4 + 1] = Math.max(1, Math.min(this.simHeight - 2, anchor.y + Math.sin(theta) * r));
        agentsData[i*4 + 2] = Math.random() * Math.PI * 2.0;
        agentsData[i*4 + 3] = 1.0;
      }
      
      for (let i = clusterAgentCount; i < this.numAgents; i++) {
        const isLeft = Math.random() > 0.5;
        const marginX = isLeft 
          ? Math.random() * (this.simWidth * 0.18) 
          : this.simWidth - Math.random() * (this.simWidth * 0.18);
        agentsData[i*4 + 0] = marginX;
        agentsData[i*4 + 1] = Math.random() * (this.simHeight - 2) + 1;
        agentsData[i*4 + 2] = Math.random() * Math.PI * 2.0;
        agentsData[i*4 + 3] = 1.0;
      }
      
      this.texAgentsA = createTexture(gl, this.agentTexSize, this.agentTexSize, agentsData, gl.RGBA32F, gl.RGBA, gl.FLOAT);
      this.texAgentsB = createTexture(gl, this.agentTexSize, this.agentTexSize, null, gl.RGBA32F, gl.RGBA, gl.FLOAT);
      
      this.fboAgentsA = createFBO(gl, this.texAgentsA);
      this.fboAgentsB = createFBO(gl, this.texAgentsB);
      
      this.texTrailA = createTexture(gl, this.simWidth, this.simHeight, null, gl.R32F, gl.RED, gl.FLOAT);
      this.texTrailB = createTexture(gl, this.simWidth, this.simHeight, null, gl.R32F, gl.RED, gl.FLOAT);
      
      this.fboTrailA = createFBO(gl, this.texTrailA);
      this.fboTrailB = createFBO(gl, this.texTrailB);

      // GPU Warm-Start: run 70 simulation passes synchronously so that on frame 0,
      // an intricate network of branching veins and hyphae already spans the page
      for (let w = 0; w < 70; w++) {
        this.stepSimulation(w * 0.05, null);
      }
    }
    
    readColors() {
      const div = document.createElement("div");
      div.style.color = "var(--markus-ink)";
      div.style.backgroundColor = "var(--markus-accent)";
      div.style.borderColor = "var(--markus-accent-2)";
      document.body.appendChild(div);
      const computed = getComputedStyle(div);

      this.colorBase = rgbToNormalizedArray(computed.color);
      this.colorTip = rgbToNormalizedArray(computed.backgroundColor);
      this.colorMid = rgbToNormalizedArray(computed.borderColor);
      document.body.removeChild(div);
    }

    stepSimulation(simTime, tapData) {
      const gl = this.gl;

      // 1. Update Agents
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboAgentsB);
      gl.viewport(0, 0, this.agentTexSize, this.agentTexSize);
      gl.useProgram(this.progUpdate);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texAgentsA);
      gl.uniform1i(gl.getUniformLocation(this.progUpdate, "uAgents"), 0);
      
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texTrailA);
      gl.uniform1i(gl.getUniformLocation(this.progUpdate, "uTrail"), 1);
      
      gl.uniform2f(gl.getUniformLocation(this.progUpdate, "uResolution"), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progUpdate, "uSensorAngle"), this.currentPreset.sensorAngle);
      gl.uniform1f(gl.getUniformLocation(this.progUpdate, "uSensorDist"), this.currentPreset.sensorDist);
      gl.uniform1f(gl.getUniformLocation(this.progUpdate, "uTurnSpeed"), this.currentPreset.turnSpeed);
      gl.uniform1f(gl.getUniformLocation(this.progUpdate, "uMoveSpeed"), this.currentPreset.moveSpeed);
      gl.uniform1f(gl.getUniformLocation(this.progUpdate, "uTime"), simTime);
      gl.uniform4fv(gl.getUniformLocation(this.progUpdate, "uTaps"), tapData || this.emptyTaps);
      
      gl.bindVertexArray(this.vaoQuad);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      // 2. Draw Agents to Trail
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboTrailA);
      gl.viewport(0, 0, this.simWidth, this.simHeight);
      gl.useProgram(this.progRenderAgents);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texAgentsB);
      gl.uniform1i(gl.getUniformLocation(this.progRenderAgents, "uAgents"), 0);
      gl.uniform2f(gl.getUniformLocation(this.progRenderAgents, "uResolution"), this.simWidth, this.simHeight);
      
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.bindVertexArray(this.vaoAgents);
      gl.drawArrays(gl.POINTS, 0, this.numAgents);
      gl.disable(gl.BLEND);
      
      // Swap agent buffers
      let tempTex = this.texAgentsA; this.texAgentsA = this.texAgentsB; this.texAgentsB = tempTex;
      let tempFbo = this.fboAgentsA; this.fboAgentsA = this.fboAgentsB; this.fboAgentsB = tempFbo;
      
      // 3. Process Trail (Diffusion, Decay, and smooth Tap nutrients)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboTrailB);
      gl.viewport(0, 0, this.simWidth, this.simHeight);
      gl.useProgram(this.progProcess);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texTrailA);
      gl.uniform1i(gl.getUniformLocation(this.progProcess, "uTrail"), 0);
      gl.uniform2f(gl.getUniformLocation(this.progProcess, "uResolution"), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uDecay"), this.currentPreset.decay);
      gl.uniform4fv(gl.getUniformLocation(this.progProcess, "uTaps"), tapData || this.emptyTaps);
      
      gl.bindVertexArray(this.vaoQuad);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      // Swap trail buffers
      tempTex = this.texTrailA; this.texTrailA = this.texTrailB; this.texTrailB = tempTex;
      tempFbo = this.fboTrailA; this.fboTrailA = this.fboTrailB; this.fboTrailB = tempFbo;
    }

    render(timestamp) {
      if (!this.running) return;
      requestAnimationFrame((t) => this.render(t));
      
      if (!this.lastTime) this.lastTime = timestamp;
      if (timestamp - this.lastTime < 32) return; // Smooth ~30 FPS cadence
      this.lastTime = timestamp;
      
      this.time += 0.015 * (this.fx.reducedMotion ? 0.15 : this.fx.motionScale);
      if (Math.floor(this.time * 100) % 60 === 0) {
        this.readColors();
      }
      
      // Smooth circular tap nutrient deposits sustained across frames
      if (window.__piloNutrients) {
        const deposits = window.__piloNutrients.drain(4);
        for (const item of deposits) {
          this.activeTaps.push({
            x: item.x,
            y: 1.0 - item.y, // WebGL UV bottom-up
            radius: item.radius * 1.6,
            strength: item.strength,
            framesLeft: 10 // sustain for 10 frames (~300ms)
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

      this.stepSimulation(this.time, tapData);

      // 4. Draw Screen
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.progScreen);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texTrailA);
      gl.uniform1i(gl.getUniformLocation(this.progScreen, "uTrail"), 0);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorBase"), this.colorBase[0], this.colorBase[1], this.colorBase[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorTip"), this.colorTip[0], this.colorTip[1], this.colorTip[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorMid"), this.colorMid[0], this.colorMid[1], this.colorMid[2]);
      gl.uniform1f(gl.getUniformLocation(this.progScreen, "uOpacity"), this.fx.opacity);
      gl.uniform1f(gl.getUniformLocation(this.progScreen, "uFade"), Math.min(1, (performance.now() - this.fadeStart) / this.fx.fadeInMs));
      
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(this.vaoQuad);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  const init = () => {
    const canvas = document.getElementById("pilo-physarum-bg");
    if (canvas) {
      window.piloPhysarum = new Simulation(canvas);
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
