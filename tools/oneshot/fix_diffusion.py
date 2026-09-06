import re
with open("web/content/assets/physarum-v14.js", "r") as f:
    js = f.read()

# Throttle the diffusion by 99% so it barely blurs outward at all per frame!
js = js.replace(
    '''      float blurred = sum / 9.0;
      float decayed = max(0.0, blurred - uDecay);''',
    '''      float current = texture(uTrail, vUv).r;
      float blurred = sum / 9.0;
      float finalBlur = mix(current, blurred, 0.02); // 98% rigid, 2% diffuse
      float decayed = max(0.0, finalBlur - uDecay);'''
)

with open("web/content/assets/physarum-v14.js", "w") as f:
    f.write(js)
