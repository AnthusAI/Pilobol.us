import re
with open("web/build.py", "r") as f:
    py = f.read()

py = py.replace(
    '("The infiltrated circle", "articles/infiltrated-circle.html"),',
    '("The infiltrated circle", "articles/infiltrated-circle.html"),\n    ("Effects Index", "effects/index.html"),'
)

with open("web/build.py", "w") as f:
    f.write(py)
