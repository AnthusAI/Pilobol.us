import re
with open("web/css/pilobil-theme-v7.css", "r") as f:
    css = f.read()

# Add hardware acceleration to force correct Z-sorting
css = css.replace(
    'z-index: 100 !important;',
    'z-index: 100 !important; transform: translateZ(0) !important; backface-visibility: hidden;'
)

css = css.replace(
    '''  .pilo-physarum-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -1;
    pointer-events: none;
    opacity: 0.65;
  }''',
    '''  .pilo-physarum-canvas {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: -1;
    pointer-events: none;
    opacity: 0.65;
    /* Create a permanent transparent tunnel down the middle matching the text column */
    /* If the screen is narrower than 900px, it will hide the animation completely (which is the only option) */
    mask-image: linear-gradient(to right, black 0%, black calc(50% - 28rem), transparent calc(50% - 26rem), transparent calc(50% + 26rem), black calc(50% + 28rem), black 100%);
    -webkit-mask-image: linear-gradient(to right, black 0%, black calc(50% - 28rem), transparent calc(50% - 26rem), transparent calc(50% + 26rem), black calc(50% + 28rem), black 100%);
  }'''
)

with open("web/css/pilobil-theme-v7.css", "w") as f:
    f.write(css)
