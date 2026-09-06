import re
with open("web/content/assets/physarum-v15.js", "r") as f:
    js = f.read()

presets_regex = r"this\.presets = \{.*?\};\s*this\.currentPreset = this\.presets\['default'\];"
new_presets = """this.presets = {
        'creeping_veins': { 
          sensorAngle: [0.30, 0.45], 
          sensorDist: [2.5, 4.0], 
          turnSpeed: [0.02, 0.05], 
          moveSpeed: [0.04, 0.08], 
          decay: [0.0001, 0.0002] 
        },
        'spore_burst': { 
          sensorAngle: [0.5, 0.8], 
          sensorDist: [1.5, 3.0], 
          turnSpeed: [0.1, 0.2], 
          moveSpeed: [0.08, 0.12], 
          decay: [0.0002, 0.0005] 
        },
        'mycelium_threads': { 
          sensorAngle: [0.1, 0.2], 
          sensorDist: [5.0, 8.0], 
          turnSpeed: [0.01, 0.03], 
          moveSpeed: [0.1, 0.2], 
          decay: [0.00005, 0.0001] 
        },
        'crystallizing': {
          sensorAngle: [0.7, 0.9],
          sensorDist: [2.0, 4.0],
          turnSpeed: [0.3, 0.5],
          moveSpeed: [0.03, 0.06],
          decay: [0.0001, 0.0003]
        }
      };

      const randomRange = (min, max) => min + Math.random() * (max - min);
      const presetKeys = Object.keys(this.presets);
      const chosenKey = presetKeys[Math.floor(Math.random() * presetKeys.length)];
      const rawPreset = this.presets[chosenKey];
      
      this.currentPreset = {
        sensorAngle: randomRange(rawPreset.sensorAngle[0], rawPreset.sensorAngle[1]),
        sensorDist: randomRange(rawPreset.sensorDist[0], rawPreset.sensorDist[1]),
        turnSpeed: randomRange(rawPreset.turnSpeed[0], rawPreset.turnSpeed[1]),
        moveSpeed: randomRange(rawPreset.moveSpeed[0], rawPreset.moveSpeed[1]),
        decay: randomRange(rawPreset.decay[0], rawPreset.decay[1])
      };"""

js = re.sub(presets_regex, new_presets, js, flags=re.DOTALL)

with open("web/content/assets/physarum-v15.js", "w") as f:
    f.write(js)
