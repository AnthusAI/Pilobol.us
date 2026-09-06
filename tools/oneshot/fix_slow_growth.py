import re
with open("web/content/assets/physarum-v10.js", "r") as f:
    js = f.read()

# 1. Update presets to be extremely slow and creeping
js = re.sub(
    r"'default': \{.*?\}",
    "'default': { sensorAngle: 0.4, sensorDist: 3.0, turnSpeed: 0.08, moveSpeed: 0.25, decay: 0.0001 }",
    js
)
js = re.sub(
    r"'bloom': \{.*?\}",
    "'bloom': { sensorAngle: 0.6, sensorDist: 2.0, turnSpeed: 0.15, moveSpeed: 0.15, decay: 0.0003 }",
    js
)
js = re.sub(
    r"'threads': \{.*?\}",
    "'threads': { sensorAngle: 0.15, sensorDist: 6.0, turnSpeed: 0.02, moveSpeed: 0.4, decay: 0.00005 }",
    js
)

# 2. Change spawn behavior from center to uniform across the whole screen, so they appear in margins immediately
spawn_regex = r"for \(let i = 0; i < this\.numAgents; i\+\+\) \{.*?agentsData\[i\*4 \+ 3\] = 1\.0;\s*\}"
new_spawn = """for (let i = 0; i < this.numAgents; i++) {
        agentsData[i*4 + 0] = Math.random() * this.simWidth;
        agentsData[i*4 + 1] = Math.random() * this.simHeight;
        agentsData[i*4 + 2] = Math.random() * Math.PI * 2.0;
        agentsData[i*4 + 3] = 1.0;
      }"""
js = re.sub(spawn_regex, new_spawn, js, flags=re.DOTALL)

# 3. Change edge wrapping to edge BOUNCING so they stay on screen and accumulate
wrap_regex = r"if \(pos\.x < 0\.0\) pos\.x \+= uResolution\.x;\s*if \(pos\.x >= uResolution\.x\) pos\.x -= uResolution\.x;\s*if \(pos\.y < 0\.0\) pos\.y \+= uResolution\.y;\s*if \(pos\.y >= uResolution\.y\) pos\.y -= uResolution\.y;"
new_bounce = """if (pos.x < 0.0 || pos.x >= uResolution.x) {
        pos.x = clamp(pos.x, 0.0, uResolution.x - 1.0);
        angle = 3.14159265 - angle;
      }
      if (pos.y < 0.0 || pos.y >= uResolution.y) {
        pos.y = clamp(pos.y, 0.0, uResolution.y - 1.0);
        angle = -angle;
      }"""
js = re.sub(wrap_regex, new_bounce, js)

with open("web/content/assets/physarum-v10.js", "w") as f:
    f.write(js)
