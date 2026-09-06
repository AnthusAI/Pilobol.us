const Physarum = (() => {
  const vsQuad = `#version 300 es
    in vec2 position;
    out vec2 vUv;
    void main() {
      float val = texture(uTrail, vUv).r;
      vec3 col = mix(uColorBase, uColorTip, val);
      outColor = vec4(col, val * 0.85); // Alpha based on density
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

  class Simulation {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext('webgl2', { alpha: true, antialias: false });
      if (!this.gl) throw new Error("WebGL2 not supported");
      
      const ext = this.gl.getExtension("EXT_color_buffer_float");
      if (!ext) console.warn("EXT_color_buffer_float not available, might fail");

      this.presets = {
        'default': { sensorAngle: 0.35, sensorDist: 4.0, turnSpeed: 0.1, moveSpeed: 0.4, decay: 0.0005 },
        'bloom': { sensorAngle: 0.6, sensorDist: 3.0, turnSpeed: 0.2, moveSpeed: 0.3, decay: 0.002 },
        'threads': { sensorAngle: 0.15, sensorDist: 8.0, turnSpeed: 0.03, moveSpeed: 0.6, decay: 0.0002 }
      };

      this.currentPreset = this.presets['default'];
      this.agentTexSize = Math.ceil(Math.sqrt(50000)); 
      this.numAgents = this.agentTexSize * this.agentTexSize;
      
      this.colorBase = [0, 0, 0];
      this.colorTip = [0.5, 1, 0.5];
      
      this.init();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      
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
      const dpr = Math.min(window.devicePixelRatio, 2.0);
      this.simWidth = Math.floor(window.innerWidth / 2);
      this.simHeight = Math.floor(window.innerHeight / 2);
      
      this.canvas.width = window.innerWidth * dpr;
      this.canvas.height = window.innerHeight * dpr;
      
      this.resetTextures();
    }
    
    resetTextures() {
      const gl = this.gl;
      
      const agentsData = new Float32Array(this.numAgents * 4);
      for (let i = 0; i < this.numAgents; i++) {
        const cx = this.simWidth / 2;
        const cy = this.simHeight / 2;
        const r = Math.random() * 20.0; // small 20px radius
        const theta = Math.random() * Math.PI * 2.0;
        
        agentsData[i*4 + 0] = cx + Math.cos(theta) * r;
        agentsData[i*4 + 1] = cy + Math.sin(theta) * r;
        
        // Point outwards so they grow away from the center
        agentsData[i*4 + 2] = theta;
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
      document.body.appendChild(div);
      const computed = getComputedStyle(div);
      
      this.colorBase = rgbToNormalizedArray(computed.color);
      this.colorTip = rgbToNormalizedArray(computed.backgroundColor);
      document.body.removeChild(div);
    }

    render(timestamp) {
      if (!this.running) return;
      requestAnimationFrame((t) => this.render(t));
      
      this.time += 0.01;
      // Read colors every 60 frames to save overhead
      if (Math.floor(this.time * 100) % 60 === 0) {
          this.readColors();
      }
      
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
      gl.uniform2f(gl.getUniformLocation(this.progScreen, "uResolution"), window.innerWidth, window.innerHeight);
      
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this.vaoQuad);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.BLEND);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pilo-physarum-bg');
    if (canvas) {
      window.piloPhysarum = new Simulation(canvas);
      const bodyPreset = document.body.getAttribute('data-physarum-preset');
      if (bodyPreset && window.piloPhysarum.presets[bodyPreset]) {
        window.piloPhysarum.currentPreset = window.piloPhysarum.presets[bodyPreset];
      }
    }
  });

})();
