import re
with open("web/content/assets/physarum-v16.js", "r") as f:
    js = f.read()

# Boost move speeds massively since diffusion is so rigid now.
# They will draw sharp, beautiful veins at ~10-20 pixels per second.
js = js.replace(
    '''        'creeping_veins': { 
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
        }''',
    '''        'creeping_veins': { 
          sensorAngle: [0.30, 0.45], 
          sensorDist: [2.5, 4.0], 
          turnSpeed: [0.02, 0.05], 
          moveSpeed: [0.5, 1.0], 
          decay: [0.0001, 0.0002] 
        },
        'spore_burst': { 
          sensorAngle: [0.5, 0.8], 
          sensorDist: [1.5, 3.0], 
          turnSpeed: [0.1, 0.2], 
          moveSpeed: [0.8, 1.5], 
          decay: [0.0002, 0.0005] 
        },
        'mycelium_threads': { 
          sensorAngle: [0.1, 0.2], 
          sensorDist: [5.0, 8.0], 
          turnSpeed: [0.01, 0.03], 
          moveSpeed: [1.0, 2.0], 
          decay: [0.00005, 0.0001] 
        },
        'crystallizing': {
          sensorAngle: [0.7, 0.9],
          sensorDist: [2.0, 4.0],
          turnSpeed: [0.3, 0.5],
          moveSpeed: [0.4, 0.8], 
          decay: [0.0001, 0.0003]
        }'''
)

with open("web/content/assets/physarum-v16.js", "w") as f:
    f.write(js)
