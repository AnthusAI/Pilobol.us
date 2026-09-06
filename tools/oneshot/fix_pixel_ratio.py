with open("web/content/assets/physarum-v5.js", "r") as f:
    js = f.read()

# Instead of this.canvas.width, pass window.innerWidth so the shader uses CSS pixels!
js = js.replace(
    'gl.uniform2f(gl.getUniformLocation(this.progScreen, "uResolution"), this.canvas.width, this.canvas.height);',
    'gl.uniform2f(gl.getUniformLocation(this.progScreen, "uResolution"), window.innerWidth, window.innerHeight);'
)

with open("web/content/assets/physarum-v5.js", "w") as f:
    f.write(js)
