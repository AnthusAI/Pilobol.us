with open("web/content/assets/physarum-v5.js", "r") as f:
    js = f.read()

import re

js = re.sub(
    r'void main\(\) \{.*?outColor = vec4\(col, val \* 0\.85 \* mask\);\s*\}',
    '''void main() {
      float val = texture(uTrail, vUv).r;
      vec3 col = mix(uColorBase, uColorTip, val);
      outColor = vec4(col, val * 0.85); // Alpha based on density
    }''',
    js,
    flags=re.DOTALL
)

with open("web/content/assets/physarum-v5.js", "w") as f:
    f.write(js)
