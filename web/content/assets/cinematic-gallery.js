const CinematicGallery = (() => {
  const vs = `#version 300 es
    in vec2 position;
    out vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      // Flip Y for WebGL texture
      vUv.y = 1.0 - vUv.y;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fs = `#version 300 es
    precision highp float;
    
    in vec2 vUv;
    out vec4 outColor;
    
    uniform sampler2D uTexCurrent;
    uniform sampler2D uTexNext;
    uniform float uProgress; // 0 to 1
    uniform vec2 uMouse;     // normalized mouse coords
    uniform float uIntensity;
    
    // Zoom blur function
    vec4 zoomBlur(sampler2D tex, vec2 uv, vec2 center, float strength) {
      vec4 color = vec4(0.0);
      float total = 0.0;
      vec2 toCenter = center - uv;
      float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0); // Simple jitter

      for (float t = 0.0; t <= 20.0; t++) {
        float percent = (t + offset) / 20.0;
        float weight = 2.0 * (1.0 - percent);
        vec2 sampleUv = uv + toCenter * percent * strength;
        color += texture(tex, sampleUv) * weight;
        total += weight;
      }
      return color / total;
    }
    
    float random(vec3 scale, float seed) {
      return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);
    }

    void main() {
      // Background parallax slightly
      vec2 uv = vUv + (uMouse - 0.5) * 0.05 * (1.0 - uProgress);
      
      // Calculate blur strength
      float strength = smoothstep(0.0, 0.5, uProgress) * smoothstep(1.0, 0.5, uProgress) * 0.5;
      strength += uIntensity * 0.1; // Add mouse speed intensity
      
      // We flip uMouse Y to match WebGL UVs
      vec2 center = vec2(uMouse.x, 1.0 - uMouse.y);
      
      vec4 color1 = zoomBlur(uTexCurrent, uv, center, strength);
      vec4 color2 = zoomBlur(uTexNext, uv, center, strength);
      
      outColor = mix(color1, color2, smoothstep(0.3, 0.7, uProgress));
    }
  `;

  function initWebGL(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: true });
    if (!gl) return null;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vs);
    gl.compileShader(vertexShader);
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fs);
    gl.compileShader(fragmentShader);
    
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(fragmentShader));
    }
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    return { gl, program };
  }

  class Gallery {
    constructor(container) {
      this.container = container;
      const imgs = Array.from(container.querySelectorAll('img'));
      if (imgs.length === 0) return;
      
      this.srcs = imgs.map(img => img.src);
      
      // Hide original images
      imgs.forEach(img => img.style.display = 'none');
      
      this.canvas = document.createElement('canvas');
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.display = 'block';
      this.canvas.style.cursor = 'pointer';
      this.container.appendChild(this.canvas);
      
      this.currentIndex = 0;
      this.nextIndex = 0;
      this.progress = 0;
      this.targetProgress = 0;
      
      this.mouse = { x: 0.5, y: 0.5 };
      this.targetMouse = { x: 0.5, y: 0.5 };
      this.intensity = 0;
      this.lastMouse = { x: 0.5, y: 0.5 };
      
      this.isVisible = false;
      this.textures = [];
      
      this.loadImages().then(() => this.init());
    }
    
    async loadImages() {
      const promises = this.srcs.map(src => {
        return new Promise(resolve => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        });
      });
      this.loadedImages = await Promise.all(promises);
    }
    
    init() {
      const { gl, program } = initWebGL(this.canvas);
      if (!gl) return;
      this.gl = gl;
      this.program = program;
      
      // Create textures
      this.textures = this.loadedImages.map(img => {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
      });
      
      // Quad VBO
      const quadData = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
      this.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, quadData, gl.STATIC_DRAW);
      
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const posLoc = gl.getAttribLocation(this.program, "position");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      
      this.resize();
      window.addEventListener('resize', () => this.resize());
      
      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        this.targetMouse.x = (e.clientX - rect.left) / rect.width;
        this.targetMouse.y = (e.clientY - rect.top) / rect.height;
        
        // Add intensity based on mouse movement speed
        const dx = this.targetMouse.x - this.lastMouse.x;
        const dy = this.targetMouse.y - this.lastMouse.y;
        this.intensity = Math.min(1.0, this.intensity + Math.sqrt(dx*dx + dy*dy) * 5.0);
        this.lastMouse.x = this.targetMouse.x;
        this.lastMouse.y = this.targetMouse.y;
      });
      
      this.canvas.addEventListener('click', () => {
        if (this.targetProgress !== 1) {
          this.nextIndex = (this.currentIndex + 1) % this.textures.length;
          this.targetProgress = 1;
        }
      });
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible) this.render();
        });
      }, { threshold: 0.0 });
      observer.observe(this.container);
      
      this.render();
    }
    
    resize() {
      const rect = this.container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2.0);
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    render() {
      if (!this.isVisible) return;
      requestAnimationFrame(() => this.render());
      
      this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.1;
      this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.1;
      this.intensity *= 0.9; // decay
      
      this.progress += (this.targetProgress - this.progress) * 0.05;
      
      if (this.progress > 0.99 && this.targetProgress === 1) {
        this.currentIndex = this.nextIndex;
        this.progress = 0;
        this.targetProgress = 0;
      }
      
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      gl.useProgram(this.program);
      gl.bindVertexArray(this.vao);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[this.currentIndex]);
      gl.uniform1i(gl.getUniformLocation(this.program, "uTexCurrent"), 0);
      
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.textures[this.nextIndex]);
      gl.uniform1i(gl.getUniformLocation(this.program, "uTexNext"), 1);
      
      gl.uniform1f(gl.getUniformLocation(this.program, "uProgress"), this.progress);
      gl.uniform2f(gl.getUniformLocation(this.program, "uMouse"), this.mouse.x, this.mouse.y);
      gl.uniform1f(gl.getUniformLocation(this.program, "uIntensity"), this.intensity);
      
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pilo-cinematic-gallery').forEach(el => new Gallery(el));
  });
})();
