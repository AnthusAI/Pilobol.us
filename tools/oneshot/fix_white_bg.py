import re
with open("web/content/assets/physarum-v8.js", "r") as f:
    js = f.read()

# Remove premultipliedAlpha: false
js = js.replace(
    "{ alpha: true, antialias: false, premultipliedAlpha: false }",
    "{ alpha: true, antialias: false }"
)

# Premultiply the alpha in the shader
js = re.sub(
    r'outColor = vec4\(col, val \* 0\.85\); \/\/ Alpha based on density',
    '''float alpha = val * 0.85;
      outColor = vec4(col * alpha, alpha);''',
    js
)

with open("web/content/assets/physarum-v8.js", "w") as f:
    f.write(js)
