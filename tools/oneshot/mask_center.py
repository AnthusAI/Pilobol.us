with open("web/content/assets/physarum.js", "r") as f:
    js = f.read()

replacement = """
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
"""

js = js.replace("""
    void main() {
      float val = texture(uTrail, vUv).r;
      vec3 col = mix(uColorBase, uColorTip, val);
      outColor = vec4(col, val * 0.85); // Alpha based on density
    }
""", replacement)

with open("web/content/assets/physarum.js", "w") as f:
    f.write(js)
