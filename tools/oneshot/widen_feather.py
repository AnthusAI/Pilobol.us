import re
with open("web/css/pilobil-theme-v9.css", "r") as f:
    css = f.read()

# Replace the 2rem fade (26 to 28) with a 6rem fade (26 to 32)
css = css.replace(
    'calc(50% - 28rem)',
    'calc(50% - 32rem)'
)
css = css.replace(
    'calc(50% + 28rem)',
    'calc(50% + 32rem)'
)

with open("web/css/pilobil-theme-v9.css", "w") as f:
    f.write(css)
