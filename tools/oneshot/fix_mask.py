with open("web/content/assets/physarum.js", "r") as f:
    js = f.read()

replacement_glsl = """
    uniform sampler2D uTrail;
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    uniform vec2 uResolution;
    
    void main() {
      float val = texture(uTrail, vUv).r;
      vec3 col = mix(uColorBase, uColorTip, val);
      
      // Calculate absolute distance from center in pixels
      float pixelX = vUv.x * uResolution.x;
      float centerPixel = uResolution.x * 0.5;
      float distFromCenterPixels = abs(pixelX - centerPixel);
      
      // Mask out exactly 850px (425px on each side) to protect the 50rem text column
      // Fade it over 40px
      float mask = smoothstep(425.0, 465.0, distFromCenterPixels);
      
      outColor = vec4(col, val * 0.85 * mask); 
    }
"""

js = js.replace("""
    uniform sampler2D uTrail;
    uniform vec3 uColorBase;
    uniform vec3 uColorTip;
    
    void main() {
      float val = texture(uTrail, vUv).r;
      vec3 col = mix(uColorBase, uColorTip, val);
      
      // Calculate distance from center (assuming text is in the center)
      // We'll mask out the center 600px roughly. 
      // uResolution is available? Wait, uResolution isn't passed to fsDrawScreen!
      // We'll use vUv.x and assume a typical aspect ratio.
      float mask = smoothstep(0.20, 0.28, abs(vUv.x - 0.5));
      
      outColor = vec4(col, val * 0.85 * mask); 
    }
""", replacement_glsl)

replacement_uniform = """
      gl.uniform1i(gl.getUniformLocation(this.progScreen, "uTrail"), 0);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorBase"), this.colorBase[0], this.colorBase[1], this.colorBase[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorTip"), this.colorTip[0], this.colorTip[1], this.colorTip[2]);
      gl.uniform2f(gl.getUniformLocation(this.progScreen, "uResolution"), this.canvas.width, this.canvas.height);
"""

js = js.replace("""
      gl.uniform1i(gl.getUniformLocation(this.progScreen, "uTrail"), 0);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorBase"), this.colorBase[0], this.colorBase[1], this.colorBase[2]);
      gl.uniform3f(gl.getUniformLocation(this.progScreen, "uColorTip"), this.colorTip[0], this.colorTip[1], this.colorTip[2]);
""", replacement_uniform)

with open("web/content/assets/physarum.js", "w") as f:
    f.write(js)
