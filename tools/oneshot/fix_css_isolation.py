import re

with open("web/css/pilobil-theme.css", "r") as f:
    css = f.read()

# Add isolation: isolate to the body to force a new stacking context that contains the canvas
if "isolation: isolate;" not in css:
    css += "\n  body {\n    isolation: isolate;\n  }\n"

with open("web/css/pilobil-theme.css", "w") as f:
    f.write(css)
