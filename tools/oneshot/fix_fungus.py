import re
with open("web/content/assets/physarum-v11.js", "r") as f:
    js = f.read()

# 1. Fix sensor wrapping to clamping so they don't sense across the screen
js = js.replace(
    "uv = fract(uv);",
    "uv = clamp(uv, vec2(0.0), vec2(1.0));"
)

# 2. Fix preset for beautiful creeping growth (slightly faster than 0.25, maybe 0.6)
# decay 0.001 (accumulates nicely without instantly becoming white)
js = re.sub(
    r"'default': \{.*?\}",
    "'default': { sensorAngle: 0.35, sensorDist: 5.0, turnSpeed: 0.15, moveSpeed: 0.6, decay: 0.001 }",
    js
)

# 3. Spawn in two small circles in the left and right margins, pointing outward
spawn_regex = r"for \(let i = 0; i < this\.numAgents; i\+\+\) \{.*?agentsData\[i\*4 \+ 3\] = 1\.0;\s*\}"
new_spawn = """for (let i = 0; i < this.numAgents; i++) {
        // Half on left, half on right
        const isLeft = (i % 2 === 0);
        const cx = isLeft ? Math.min(100, this.simWidth * 0.1) : Math.max(this.simWidth - 100, this.simWidth * 0.9);
        const cy = this.simHeight / 2;
        
        const r = Math.random() * 10.0;
        const theta = Math.random() * Math.PI * 2.0;
        
        agentsData[i*4 + 0] = cx + Math.cos(theta) * r;
        agentsData[i*4 + 1] = cy + Math.sin(theta) * r;
        agentsData[i*4 + 2] = theta; // point outwards
        agentsData[i*4 + 3] = 1.0;
      }"""
js = re.sub(spawn_regex, new_spawn, js, flags=re.DOTALL)

with open("web/content/assets/physarum-v11.js", "w") as f:
    f.write(js)
