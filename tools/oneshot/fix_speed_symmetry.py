import re
with open("web/content/assets/physarum-v12.js", "r") as f:
    js = f.read()

# 1. Slow it way down
js = re.sub(
    r"'default': \{.*?\}",
    "'default': { sensorAngle: 0.35, sensorDist: 4.0, turnSpeed: 0.05, moveSpeed: 0.1, decay: 0.0003 }",
    js
)

# 2. Make it asymmetric with multiple scattered spores
spawn_regex = r"for \(let i = 0; i < this\.numAgents; i\+\+\) \{.*?agentsData\[i\*4 \+ 3\] = 1\.0;\s*\}"
new_spawn = """const spores = [];
      for (let s = 0; s < 7; s++) {
         // Bias heavily towards edges (e.g. outer 20% of the screen)
         let isLeft = Math.random() > 0.5;
         spores.push({
           x: isLeft ? Math.random() * (this.simWidth * 0.2) : this.simWidth - Math.random() * (this.simWidth * 0.2),
           y: Math.random() * this.simHeight
         });
      }

      for (let i = 0; i < this.numAgents; i++) {
        const spore = spores[i % spores.length];
        const r = Math.random() * 20.0;
        const theta = Math.random() * Math.PI * 2.0;
        
        agentsData[i*4 + 0] = spore.x + Math.cos(theta) * r;
        agentsData[i*4 + 1] = spore.y + Math.sin(theta) * r;
        agentsData[i*4 + 2] = Math.random() * Math.PI * 2.0; // Random direction
        agentsData[i*4 + 3] = 1.0;
      }"""
js = re.sub(spawn_regex, new_spawn, js, flags=re.DOTALL)

with open("web/content/assets/physarum-v12.js", "w") as f:
    f.write(js)
