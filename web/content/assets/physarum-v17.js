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
    
    // Hash function for random noise
    float hash(float n) { return fract(sin(n) * 1e4); }
    float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }
    
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
      
      float weightF = sense(pos, angle);
      float weightL = sense(pos, angle + uSensorAngle);
      float weightR = sense(pos, angle - uSensorAngle);
      
      float randomSteer = (hash(pos + uTime) - 0.5) * 0.1;
      
      if (weightF > weightL && weightF > weightR) {
        // stay same
      } else if (weightF < weightL && weightF < weightR) {
        if (hash(pos.x + uTime) > 0.5) {
          angle += uTurnSpeed + randomSteer;
        } else {
          angle -= uTurnSpeed + randomSteer;
        }
      } else if (weightL > weightR) {
        angle += uTurnSpeed + randomSteer;
      } else if (weightR > weightL) {
        angle -= uTurnSpeed + randomSteer;
      }
      
      vec2 dir = vec2(cos(angle), sin(angle));
      pos += dir * uMoveSpeed;
      
      if (pos.x < 0.0 || pos.x >= uResolution.x) {
        pos.x = clamp(pos.x, 0.0, uResolution.x - 1.0);
        angle = 3.14159265 - angle;
      }
      if (pos.y < 0.0 || pos.y >= uResolution.y) {
        pos.y = clamp(pos.y, 0.0, uResolution.y - 1.0);
        angle = -angle;
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
      outColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `;

  const fsProcessTrail = `#version 300 es
    precision highp float;
    
    in vec2 vUv;
    out vec4 outColor;
    
    uniform sampler2D uTrail;
    uniform vec2 uResolution;
    uniform float uDecay;
    
    void main() {
      vec2 texel = 1.0 / uResolution;
      
      float sum = 0.0;
      for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
          vec2 offset = vec2(x, y) * texel;
          sum += texture(uTrail, fract(vUv + offset)).r;
        }
      }
      
      float current = texture(uTrail, vUv).r;
      float blurred = sum / 9.0;
      float finalBlur = mix(current, blurred, 0.02); // 98% rigid, 2% diffuse
      float decayed = max(0.0, finalBlur - uDecay);
      
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
      // Growth trends toward uColorBase (the theme's ink color: dark in light
      // mode, pale in dark mode), not uColorTip (accent). With the old
      // mix(colorBase, colorTip, val) the densest, most-established trails --
      // the areas that should read as the strongest stain -- ended up
      // *lighter* under a light-mode multiply blend than sparse trail edges
      // did, since colorTip is lighter than colorBase there. A fungal stain
      // should get darker where it's most established, not lighter.
      //
      // Two-stage mix through uColorMid (--markus-accent-2, a genuinely
      // different hue) instead of a flat two-color interpolation -- a single
      // background->accent mix read as nearly monochromatic.
      vec3 col = mix(uColorTip, uColorMid, smoothstep(0.0, 0.5, val));
      col = mix(col, uColorBase, smoothstep(0.4, 1.0, val));

      // See dla-v1.js fsScreen for why this rare tiny highlight exists.
      float glintGate = step(0.986, fract(sin(dot(vUv, vec2(41.3, 289.1))) * 43758.5453));
      float glint = glintGate * smoothstep(0.85, 1.0, val) * 0.12;
      col = mix(col, vec3(1.0), glint);

      float alpha = val * 0.7 * uOpacity * uFade;
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
    let match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
        return [parseInt(match[1])/255, parseInt(match[2])/255, parseInt(match[3])/255];
    }
    return [0, 0, 0];
  }

  // The page manager publishes this optional contract before loading an
  // effect. Keep the effect usable in the gallery (and on older pages) when
  // the contract is absent or partially populated.
  function readFxConfig(name, presets) {
    const root = window.__piloFxConfig || {};
    const scoped = (root.effects && root.effects[name]) || root[name] || {};
    const source = typeof scoped === 'object' ? scoped : {};
    // The manager's root preset is a layout preset (header-bloom, etc.), not
    // a Physarum simulation preset. Only an explicitly effect-scoped preset
    // may select one of this script's algorithm variants.
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
      // Page coordinates put y=0 at the top; WebGL puts it at the bottom.
      Math.max(0, Math.min(height - 1, (1 - y + (Math.random() - 0.5) * radiusY) * height))
    ];
  }

  class Simulation {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
      if (!this.gl) throw new Error("WebGL2 not supported");
      
      const ext = this.gl.getExtension("EXT_color_buffer_float");
      if (!ext) console.warn("EXT_color_buffer_float not available, might fail");

      // moveSpeed cut ~4x from the original presets (0.4-2.0 -> 0.1-0.5) and
      // the frame throttle below slowed from ~12fps to ~5fps -- combined,
      // roughly a 9x reduction in how fast agents visibly travel. It read as
      // continuous flowing motion rather than the slow, gradual creep this
      // effect is supposed to be.
      this.presets = {
        'creeping_veins': {
          sensorAngle: [0.30, 0.45],
          sensorDist: [2.5, 4.0],
          turnSpeed: [0.02, 0.05],
          moveSpeed: [0.12, 0.25],
          decay: [0.0001, 0.0002]
        },
        'spore_burst': {
          sensorAngle: [0.5, 0.8],
          sensorDist: [1.5, 3.0],
          turnSpeed: [0.1, 0.2],
          moveSpeed: [0.2, 0.38],
          decay: [0.0002, 0.0005]
        },
        'mycelium_threads': {
          sensorAngle: [0.1, 0.2],
          sensorDist: [5.0, 8.0],
          turnSpeed: [0.01, 0.03],
          moveSpeed: [0.25, 0.5],
          decay: [0.00005, 0.0001]
        },
        'crystallizing': {
          sensorAngle: [0.7, 0.9],
          sensorDist: [2.0, 4.0],
          turnSpeed: [0.3, 0.5],
          moveSpeed: [0.1, 0.2],
          decay: [0.0001, 0.0003]
        }
      };

      this.fx = readFxConfig('physarum', this.presets);

      // Gallery visits get a gentle variation inside each family; an explicit
      // effect-scoped preset is deliberately exact so art-directed pages and
      // visual regression captures remain reproducible.
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
      // A named manager preset wins over the random range, while preserving
      // the legacy range-based presets used by the standalone gallery.
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
      this.agentTexSize = Math.ceil(Math.sqrt(50000)); 
      this.numAgents = this.agentTexSize * this.agentTexSize;
      
      // Placeholder fallbacks in case readColors() below can't run yet for
      // some reason (no document.body). Not meant to ever actually be seen.
      this.colorBase = [0, 0, 0];
      this.colorTip = [0.5, 1, 0.5];
      this.colorMid = [0.6, 0.6, 0.6];
      // readColors() was previously only called periodically, ~60 frames in
      // -- at the current throttle that's ~11 real seconds before the theme's
      // actual colors ever get used. Agents start tightly clustered at their
      // spawn points, so peak density there swings from very-high (mapping to
      // the black fallback above) down to moderate (mapping to the bright
      // green fallback above) as the cluster disperses, all before the real
      // colors ever apply -- exactly the "dark spots that suddenly turn
      // light, and the light is too bright" sequence. Reading real colors
      // immediately removes the placeholder window entirely.
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
      const spores = [];
      for (let s = 0; s < 7; s++) {
         // Bias heavily towards edges (e.g. outer 20% of the screen)
         let isLeft = Math.random() > 0.5;
         const [seedX, seedY] = pickSeed(this.fx.seedRegions, this.simWidth, this.simHeight, () => [
           isLeft ? Math.random() * (this.simWidth * 0.2) : this.simWidth - Math.random() * (this.simWidth * 0.2),
           Math.random() * this.simHeight
         ]);
         spores.push({ x: seedX, y: seedY });
      }

      for (let i = 0; i < this.numAgents; i++) {
        const spore = spores[i % spores.length];
        const r = Math.random() * 20.0;
        const theta = Math.random() * Math.PI * 2.0;
        
        agentsData[i*4 + 0] = spore.x + Math.cos(theta) * r;
        agentsData[i*4 + 1] = spore.y + Math.sin(theta) * r;
        agentsData[i*4 + 2] = Math.random() * Math.PI * 2.0; // Random direction
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
    }
    
    readColors() {
      // Create a temporary element to read css variables accurately
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
      
      if (!this.lastTime) this.lastTime = timestamp;
      if (timestamp - this.lastTime < 180) return; // ~5.5 FPS throttle (was ~12fps)
      this.lastTime = timestamp;
      
      this.time += 0.01 * (this.fx.reducedMotion ? 0.12 : this.fx.motionScale);
      // Read colors every 60 frames to save overhead
      if (Math.floor(this.time * 100) % 60 === 0) {
          this.readColors();
      }
      
      const gl = this.gl;
      if (window.__piloNutrients) {
        window.__piloNutrients.paint(gl, this.texTrailA, this.simWidth, this.simHeight, 'trail');
      }

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
      gl.uniform1f(gl.getUniformLocation(this.progUpdate, "uTime"), this.time);
      
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
      
      // Swap agents
      let tempTex = this.texAgentsA; this.texAgentsA = this.texAgentsB; this.texAgentsB = tempTex;
      let tempFbo = this.fboAgentsA; this.fboAgentsA = this.fboAgentsB; this.fboAgentsB = tempFbo;
      
      // 3. Process Trail (Blur & Decay)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboTrailB);
      gl.viewport(0, 0, this.simWidth, this.simHeight);
      gl.useProgram(this.progProcess);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texTrailA);
      gl.uniform1i(gl.getUniformLocation(this.progProcess, "uTrail"), 0);
      gl.uniform2f(gl.getUniformLocation(this.progProcess, "uResolution"), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.progProcess, "uDecay"), this.currentPreset.decay);
      
      gl.bindVertexArray(this.vaoQuad);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      
      // Swap trails
      tempTex = this.texTrailA; this.texTrailA = this.texTrailB; this.texTrailB = tempTex;
      tempFbo = this.fboTrailA; this.fboTrailA = this.fboTrailB; this.fboTrailB = tempFbo;
      
      // 4. Draw Screen
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
      gl.disable(gl.BLEND);
    }
  }

  // This script is injected dynamically (background-manager.js appends it to
  // <head> well after initial page load), so DOMContentLoaded has already
  // fired by the time this line runs. Listening for it here means the
  // listener never fires and Simulation is never constructed -- 100%
  // reproducible, not a random flake. Match the readyState-check pattern
  // cellular-automata-v1.js and reaction-diffusion-v1.js already use.
  const init = () => {
    const canvas = document.getElementById('pilo-physarum-bg');
    if (canvas) {
      window.piloPhysarum = new Simulation(canvas);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
