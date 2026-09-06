import re
with open("web/content/assets/physarum-v9.js", "r") as f:
    js = f.read()

# Disable blending for the screen quad, we are replacing the clear buffer entirely!
js = js.replace(
    '''      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);''',
    '''      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.BLEND);'''
)

with open("web/content/assets/physarum-v9.js", "w") as f:
    f.write(js)
