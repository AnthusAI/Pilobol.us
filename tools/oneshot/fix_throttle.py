import re
with open("web/content/assets/physarum-v13.js", "r") as f:
    js = f.read()

# Throttle to 12fps (83ms) for an ultra-slow biological timelapse feel
js = js.replace(
    '''    render(timestamp) {
      if (!this.running) return;
      requestAnimationFrame((t) => this.render(t));''',
    '''    render(timestamp) {
      if (!this.running) return;
      requestAnimationFrame((t) => this.render(t));
      
      if (!this.lastTime) this.lastTime = timestamp;
      if (timestamp - this.lastTime < 83) return; // ~12 FPS throttle
      this.lastTime = timestamp;'''
)

# And slow the presets down even MORE just to be absolutely certain it is subtle
js = re.sub(
    r"'default': \{.*?\}",
    "'default': { sensorAngle: 0.35, sensorDist: 3.0, turnSpeed: 0.03, moveSpeed: 0.05, decay: 0.0001 }",
    js
)

with open("web/content/assets/physarum-v13.js", "w") as f:
    f.write(js)
