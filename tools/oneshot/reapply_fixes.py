import re
with open("web/content/assets/physarum.js", "r") as f:
    js = f.read()

# 1. Decay rates
js = js.replace(
    "'default': { sensorAngle: 0.35, sensorDist: 4.0, turnSpeed: 0.1, moveSpeed: 0.4, decay: 0.003 }",
    "'default': { sensorAngle: 0.35, sensorDist: 4.0, turnSpeed: 0.1, moveSpeed: 0.4, decay: 0.0005 }"
)
js = js.replace(
    "'bloom': { sensorAngle: 0.6, sensorDist: 3.0, turnSpeed: 0.2, moveSpeed: 0.3, decay: 0.01 }",
    "'bloom': { sensorAngle: 0.6, sensorDist: 3.0, turnSpeed: 0.2, moveSpeed: 0.3, decay: 0.002 }"
)
js = js.replace(
    "'threads': { sensorAngle: 0.15, sensorDist: 8.0, turnSpeed: 0.03, moveSpeed: 0.6, decay: 0.002 }",
    "'threads': { sensorAngle: 0.15, sensorDist: 8.0, turnSpeed: 0.03, moveSpeed: 0.6, decay: 0.0002 }"
)

# 2. Spawn in center
spawn_old = """      for (let i = 0; i < this.numAgents; i++) {
        agentsData[i*4 + 0] = Math.random() * this.simWidth;
        agentsData[i*4 + 1] = Math.random() * this.simHeight;
        const cx = this.simWidth / 2;
        const cy = this.simHeight / 2;
        const dx = agentsData[i*4] - cx;
        const dy = agentsData[i*4+1] - cy;
        agentsData[i*4 + 2] = Math.atan2(dy, dx);
        agentsData[i*4 + 3] = 1.0;
      }"""

spawn_new = """      for (let i = 0; i < this.numAgents; i++) {
        const cx = this.simWidth / 2;
        const cy = this.simHeight / 2;
        const r = Math.random() * 20.0;
        const theta = Math.random() * Math.PI * 2.0;
        
        agentsData[i*4 + 0] = cx + Math.cos(theta) * r;
        agentsData[i*4 + 1] = cy + Math.sin(theta) * r;
        agentsData[i*4 + 2] = theta;
        agentsData[i*4 + 3] = 1.0;
      }"""

js = js.replace(spawn_old, spawn_new)

with open("web/content/assets/physarum.js", "w") as f:
    f.write(js)
