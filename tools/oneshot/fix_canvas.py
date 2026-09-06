import re

with open("web/css/pilobil-theme.css", "r") as f:
    css = f.read()

# Remove the mix-blend-mode directives entirely. 
# Blend modes affect stacking contexts in unpredictable ways and allow canvas colors to interact with layers below them (and sometimes visually appear to be on top).
css = re.sub(r'^\s*mix-blend-mode:.*?;.*?\n', '', css, flags=re.MULTILINE)

with open("web/css/pilobil-theme.css", "w") as f:
    f.write(css)
