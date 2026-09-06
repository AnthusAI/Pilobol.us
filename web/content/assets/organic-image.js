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
      
      // Interpolate based on scroll (1.0 = assembled, 0.0 = completely shattered)
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
      
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'absolute';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.container.appendChild(this.canvas);
      
      this.scrollProgress = 0;
      this.targetScrollProgress = 0;
      this.time = 0;
      this.isVisible = false;
      
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
      const { gl, program } = initWebGL(this.canvas);
      if (!gl) return;
      this.gl = gl;
      this.program = program;
      
      // We don't need one particle per pixel, that's too heavy.
      // We will render it at a fixed particle resolution, say 300x200
      this.particleResX = 300;
      this.particleResY = Math.floor((this.particleResX * this.img.height) / this.img.width);
      this.numParticles = this.particleResX * this.particleResY;
      
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      // Empty VAO
      this.vao = gl.createVertexArray();
      
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('scroll', () => this.onScroll(), {passive: true});
      
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
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      this.onScroll();
    }
    
    onScroll() {
      const rect = this.container.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // We want uScroll to be 1.0 when the element is in the middle of the screen
      // and 0.0 when it is at the very edges or outside.
      const center = rect.top + rect.height / 2;
      const screenCenter = windowHeight / 2;
      
      const distFromCenter = Math.abs(center - screenCenter);
      // Normalized distance (0 = center, 1 = edge)
      const maxDist = windowHeight / 1.5; 
      let p = 1.0 - (distFromCenter / maxDist);
      p = Math.max(0, Math.min(1, p));
      
      // Smooth curve
      this.targetScrollProgress = p * p * (3 - 2 * p);
    }
    
    render() {
      if (!this.isVisible) return; // Pause when offscreen
      requestAnimationFrame(() => this.render());
      
      // Lerp for smoothness
      this.scrollProgress += (this.targetScrollProgress - this.scrollProgress) * 0.1;
      this.time += 0.002;
      
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      gl.useProgram(this.program);
      gl.bindVertexArray(this.vao);
      
      gl.uniform2f(gl.getUniformLocation(this.program, "uResolution"), this.particleResX, this.particleResY);
      gl.uniform1f(gl.getUniformLocation(this.program, "uScroll"), this.scrollProgress);
      gl.uniform1f(gl.getUniformLocation(this.program, "uTime"), this.time);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.uniform1i(gl.getUniformLocation(this.program, "uImage"), 0);
      
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      
      gl.drawArrays(gl.POINTS, 0, this.numParticles);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pilo-organic-image').forEach(el => new OrganicImage(el));
  });

})();
