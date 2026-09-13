const OrganicImage = (() => {
  const vs = `#version 300 es
    uniform vec2 uResolution;
    uniform float uScroll;
    uniform float uTime;
    
    out vec2 vUv;
    out float vAlpha;
    
    // Simplex noise function
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }
    
    void main() {
      // Calculate grid position
      float x = float(gl_VertexID % int(uResolution.x));
      float y = float(gl_VertexID / int(uResolution.x));
      vUv = vec2(x, y) / uResolution;
      
      // Calculate target NDC position (assembled)
      vec2 targetPos = vUv * 2.0 - 1.0;
      targetPos.y = -targetPos.y; // Flip Y for WebGL texture vs NDC
      
      // Calculate shattered position (organic noise)
      float n1 = snoise(vUv * 3.0 + uTime * 0.1);
      float n2 = snoise(vUv * 3.0 - uTime * 0.1 + 100.0);
      vec2 shatteredPos = targetPos + vec2(n1, n2) * 1.5;
      
      // Assembly factor (1.0 = assembled, 0.0 = shattered). Not driven by scroll.
      // We use a smoothstep so it snaps together nicely.
      float assembleProgress = smoothstep(0.0, 1.0, uScroll);
      vec2 currentPos = mix(shatteredPos, targetPos, assembleProgress);
      
      gl_Position = vec4(currentPos, 0.0, 1.0);
      
      // Particles are slightly larger when shattered
      gl_PointSize = mix(2.5, 1.5, assembleProgress);
      
      // Fade out completely if totally shattered
      vAlpha = smoothstep(0.0, 0.4, uScroll);
    }
  `;

  const fs = `#version 300 es
    precision highp float;
    
    in vec2 vUv;
    in float vAlpha;
    out vec4 outColor;
    
    uniform sampler2D uImage;
    uniform float uScroll;
    
    void main() {
      // Make particles round
      vec2 pt = gl_PointCoord - vec2(0.5);
      if(dot(pt, pt) > 0.25) discard;
      
      vec4 texColor = texture(uImage, vUv);
      outColor = vec4(texColor.rgb, texColor.a * vAlpha);
    }
  `;

  function initWebGL(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: true });
    if (!gl) return null;
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vs);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(vertexShader));
    }
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fs);
    gl.compileShader(fragmentShader);
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    return { gl, program };
  }

  class OrganicImage {
    constructor(container) {
      this.container = container;
      this.src = container.getAttribute('data-src');
      this.fallback = container.querySelector('.pilo-organic-fallback');
      
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      // Purely decorative: this canvas has no pointer handlers (only window
      // resize/scroll). Keeping it click-through means that if the container
      // ever loses `position: relative`, the canvas escapes to the initial
      // containing block but still cannot swallow clicks on the page.
      this.canvas.style.pointerEvents = 'none';
      this.container.appendChild(this.canvas);
      
      this.scrollProgress = 0;
      this.targetScrollProgress = 0;
      this.time = 0;
      // Begin drawing immediately. IntersectionObserver still pauses the
      // animation later, but relying on its first asynchronous callback left
      // some browsers with a permanently blank canvas.
      this.isVisible = true;
      
      this.loadImage().then(() => this.init());
    }
    
    loadImage() {
      return new Promise((resolve) => {
        this.img = new Image();
        this.img.onload = resolve;
        this.img.src = this.src;
      });
    }
    
    init() {
      // The WebGL point renderer silently painted a blank canvas in the local
      // preview. A modest 2D mosaic has the same broken-to-assembled image
      // behavior without depending on that GPU path.
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) return;
      if (this.fallback) this.fallback.hidden = true;
      this.particleResX = 48;
      this.particleResY = Math.max(28, Math.round(
        this.particleResX * this.img.height / this.img.width
      ));
      
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('scroll', () => this.onScroll(), { passive: true });
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible) this.render(); // kickstart
        });
      }, { threshold: 0.0, rootMargin: '200px' });
      observer.observe(this.container);
      
      this.onScroll();
      this.render();
    }
    
    resize() {
      const rect = this.container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2.0);
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.onScroll();
    }
    
    onScroll() {
      const rect = this.container.getBoundingClientRect();
      const distance = Math.abs(
        rect.top + rect.height / 2 - window.innerHeight / 2
      );
      // Give the reader a generous fully-readable plateau. The image only
      // breaks apart near the approach/departure edges of the viewport.
      const plateau = window.innerHeight * 0.30;
      const edge = window.innerHeight * 0.95;
      const progress = distance <= plateau
        ? 1
        : 1 - (distance - plateau) / (edge - plateau);
      const clamped = Math.max(0, Math.min(1, progress));
      this.targetScrollProgress = clamped * clamped * (3 - 2 * clamped);
    }
    
    render() {
      if (!this.isVisible) return; // Pause when offscreen
      requestAnimationFrame(() => this.render());
      
      // Lerp for smoothness
      this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * 0.1;
      this.time += 0.002;
      
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;
      const cols = this.particleResX;
      const rows = this.particleResY;
      const tileW = width / cols;
      const tileH = height / rows;
      const sourceW = this.img.width / cols;
      const sourceH = this.img.height / rows;
      const scatter = Math.pow(1 - this.scrollProgress, 2.0) * 0.82;
      const fade = 0.12 + this.scrollProgress * 0.88;
      const settleRaw = Math.max(0, Math.min(1, (this.scrollProgress - 0.52) / 0.43));
      const settle = settleRaw * settleRaw * (3 - 2 * settleRaw);

      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const seed = col * 73.13 + row * 29.71;
          const driftX = Math.sin(seed + this.time * 11) * tileW * 8 * scatter;
          const driftY = Math.cos(seed * 1.7 - this.time * 9) * tileH * 8 * scatter;
          const grain = 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(seed));
          ctx.globalAlpha = fade * grain;
          ctx.drawImage(
            this.img,
            col * sourceW, row * sourceH, sourceW + 1, sourceH + 1,
            col * tileW + driftX, row * tileH + driftY, tileW + 1, tileH + 1
          );
        }
      }
      // Crossfade a clean source image over the last part of the assembly.
      // This preserves the uncanny breakup without a visible threshold cut.
      if (settle > 0) {
        ctx.globalAlpha = settle;
        ctx.drawImage(this.img, 0, 0, width, height);
      }
      ctx.globalAlpha = 1;
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pilo-organic-image').forEach(el => new OrganicImage(el));
  });

})();
