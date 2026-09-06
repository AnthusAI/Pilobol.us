import re
with open("web/css/pilobil-theme-v8.css", "r") as f:
    css = f.read()

# 1. Remove background-color from pilo-page-wrapper
css = css.replace('background-color: var(--markus-paper) !important;', '')
# Remove box-shadow from wrapper
css = css.replace('box-shadow: 0 0 100px 80px var(--markus-paper);', '')

# 2. Put mix-blend-mode back on the canvas for beautiful spore blending
css = css.replace(
    'opacity: 0.65;',
    'opacity: 0.65; mix-blend-mode: multiply;'
)

# Dark mode mix-blend-mode
css = css.replace(
    'opacity: 0.8;',
    'opacity: 0.8; mix-blend-mode: screen;'
)

# 3. Add mask-image to the canvas (it's already there from my previous fix_compositing.py! Let me verify)
with open("web/css/pilobil-theme-v8.css", "w") as f:
    f.write(css)
